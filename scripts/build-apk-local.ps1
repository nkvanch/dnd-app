<#
  Local (no EAS cloud) release APK build for Grimoire.

  Usage (from the repo root, PowerShell):
    .\scripts\build-apk-local.ps1                 # arm64 only (fast, fits nearly every phone)
    .\scripts\build-apk-local.ps1 -AllAbis        # arm64 + armv7 + x86 + x86_64 (big, slow)
    .\scripts\build-apk-local.ps1 -Clean          # gradle clean first
    .\scripts\build-apk-local.ps1 -Prebuild       # regenerate ./android from app.json first
    .\scripts\build-apk-local.ps1 -FullContent    # don't set EXPO_PUBLIC_SRD_ONLY (default matches eas "preview")
    .\scripts\build-apk-local.ps1 -KeystorePath D:\Keys\grimoire-release.jks   # sign with YOUR release key, not the debug key
        # (password is read from $env:GRIMOIRE_KEYSTORE_PASSWORD - never a parameter or a file; see scripts\make-release-keystore.ps1)

  Everything heavy lives on D: (Gradle cache, build temp). Output APK -> .\builds\
#>
param(
  [switch]$AllAbis,
  [switch]$Clean,
  [switch]$Prebuild,
  [switch]$FullContent,
  [string]$KeystorePath,
  [string]$KeyAlias = 'grimoire',
  [string]$CacheRoot = 'D:\DevCache'
)

$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
Set-Location $repo

# --- toolchain (Android Studio's bundled JDK + the SDK already on this machine) ---
if (-not $env:JAVA_HOME -or -not (Test-Path "$env:JAVA_HOME\bin\java.exe")) {
  $env:JAVA_HOME = 'C:\Program Files\Android\Android Studio\jbr'
}
if (-not $env:ANDROID_HOME -or -not (Test-Path $env:ANDROID_HOME)) {
  $env:ANDROID_HOME = 'D:\Dev\Android\sdk'
}
$env:ANDROID_SDK_ROOT = $env:ANDROID_HOME
$env:Path = "$env:JAVA_HOME\bin;$env:ANDROID_HOME\platform-tools;$env:Path"

# --- keep the big stuff off C: ---
$gradleHome = Join-Path $CacheRoot 'gradle'
$tmp        = Join-Path $CacheRoot 'tmp'
New-Item -ItemType Directory -Force -Path $gradleHome, $tmp | Out-Null
$env:GRADLE_USER_HOME = $gradleHome
$env:TEMP = $tmp; $env:TMP = $tmp
$env:GRADLE_OPTS = "-Djava.io.tmpdir=$tmp"

# --- same env the EAS "preview" profile uses ---
if (-not $FullContent) { $env:EXPO_PUBLIC_SRD_ONLY = 'true' }
$env:NODE_ENV = 'production'

# Keep the private development seed intact: public release inputs are staged
# only while Gradle packages the APK, then restored in the outer finally.
$publicStage = $null
$savedContentDb = $null
$savedContentVersion = $null
if (-not $FullContent) {
  $publicStage = Join-Path $tmp ('grimoire-public-content-' + [guid]::NewGuid().ToString())
  New-Item -ItemType Directory -Force -Path $publicStage | Out-Null
  $savedContentDb = Join-Path $publicStage 'content.db.private'
  $savedContentVersion = Join-Path $publicStage 'contentDbVersion.ts.private'
  Copy-Item 'assets\content.db' $savedContentDb
  Copy-Item 'src\content\contentDbVersion.ts' $savedContentVersion
  $env:CONTENT_DB_OUT_PATH = Join-Path $publicStage 'content.db.public'
  $env:CONTENT_DB_VERSION_OUT_PATH = Join-Path $publicStage 'contentDbVersion.ts.public'
  npx tsx scripts/generate-public-content-snapshot.ts
  npx tsx scripts/generate-content-db.mjs
  if ($LASTEXITCODE -ne 0) { throw "public content generation failed ($LASTEXITCODE)" }
  Copy-Item $env:CONTENT_DB_OUT_PATH 'assets\content.db' -Force
  Copy-Item $env:CONTENT_DB_VERSION_OUT_PATH 'src\content\contentDbVersion.ts' -Force
  Remove-Item Env:CONTENT_DB_OUT_PATH
  Remove-Item Env:CONTENT_DB_VERSION_OUT_PATH
}

if (-not (Test-Path 'node_modules')) { npm ci }
if ($Prebuild -or -not (Test-Path 'android\gradlew.bat')) {
  npx expo prebuild --platform android --no-install
}

$abis = if ($AllAbis) { 'armeabi-v7a,arm64-v8a,x86,x86_64' } else { 'arm64-v8a' }

# --- optional: sign with a real release key (otherwise the generated project signs with the debug key) ---
$signArgs = @()
if ($KeystorePath) {
  if (-not (Test-Path $KeystorePath)) { throw "Keystore not found: $KeystorePath" }
  if (-not $env:GRIMOIRE_KEYSTORE_PASSWORD) { throw 'Set $env:GRIMOIRE_KEYSTORE_PASSWORD first (it is never passed as a parameter).' }
  $keyPw = if ($env:GRIMOIRE_KEY_PASSWORD) { $env:GRIMOIRE_KEY_PASSWORD } else { $env:GRIMOIRE_KEYSTORE_PASSWORD }
  $signArgs = @(
    "-Pandroid.injected.signing.store.file=$((Resolve-Path $KeystorePath).Path)",
    "-Pandroid.injected.signing.store.password=$env:GRIMOIRE_KEYSTORE_PASSWORD",
    "-Pandroid.injected.signing.key.alias=$KeyAlias",
    "-Pandroid.injected.signing.key.password=$keyPw"
  )
}

$androidPushed = $false
try {
  Push-Location android
  $androidPushed = $true
  if ($Clean) { .\gradlew.bat clean }
  # The public database is staged immediately before this invocation. Force
  # asset/bundle tasks to observe it instead of reusing a prior full-content
  # Gradle output from the same checkout.
  $releaseArgs = @('assembleRelease', "-PreactNativeArchitectures=$abis") + $signArgs + @('--no-daemon')
  if (-not $FullContent) { $releaseArgs += '--rerun-tasks' }
  .\gradlew.bat @releaseArgs
  if ($LASTEXITCODE -ne 0) { throw "gradle failed ($LASTEXITCODE)" }
} finally {
  if ($androidPushed) { Pop-Location }
  if ($savedContentDb) { Copy-Item $savedContentDb (Join-Path $repo 'assets\content.db') -Force }
  if ($savedContentVersion) { Copy-Item $savedContentVersion (Join-Path $repo 'src\content\contentDbVersion.ts') -Force }
}

$apk = Get-ChildItem 'android\app\build\outputs\apk\release\*.apk' | Sort-Object LastWriteTime -Descending | Select-Object -First 1
if (-not $apk) { throw 'Build finished but no APK was found.' }
${outputRoot} = 'D:\Documents\dnd-app\builds'
New-Item -ItemType Directory -Force -Path $outputRoot | Out-Null
$dest = Join-Path $outputRoot ("grimoire-local-{0}.apk" -f (Get-Date -Format 'yyyyMMdd-HHmm'))
Copy-Item $apk.FullName $dest
Write-Host ("`nAPK ready: {0}  ({1:N1} MB)" -f (Resolve-Path $dest), ($apk.Length / 1MB))
Write-Host 'Install: adb install -r <that file>   (or copy it to the phone)'

# --- report who actually signed it, plus the SHA-256 to publish alongside it ---
# Some build-tools versions print nothing under this JDK, so try each until one reports a signer.
$signer = $null
foreach ($tool in (Get-ChildItem (Join-Path $env:ANDROID_HOME 'build-tools\*\apksigner.bat') -ErrorAction SilentlyContinue | Sort-Object FullName -Descending)) {
  $report = cmd /c "`"$($tool.FullName)`" verify --print-certs `"$dest`" 2>&1" | Select-String 'Signer #1 certificate DN'
  if ($report) { $signer = $report.ToString().Trim(); break }
}
if ($signer) { Write-Host $signer } else { Write-Host 'Could not read the signer with apksigner - check it manually before publishing.' -ForegroundColor Yellow }
Write-Host ('SHA-256: ' + (Get-FileHash $dest -Algorithm SHA256).Hash.ToLower())
if (-not $KeystorePath) { Write-Host 'NOTE: signed with the DEBUG key - fine for your own device, not for a public release.' -ForegroundColor Yellow }

