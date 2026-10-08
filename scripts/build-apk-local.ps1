<#
  Local (no EAS cloud) release APK build for Grimoire.

  Usage (from the repo root, PowerShell):
    .\scripts\build-apk-local.ps1                 # arm64 only (fast, fits nearly every phone)
    .\scripts\build-apk-local.ps1 -AllAbis        # arm64 + armv7 + x86 + x86_64 (big, slow)
    .\scripts\build-apk-local.ps1 -Clean          # gradle clean first
    .\scripts\build-apk-local.ps1 -Prebuild       # regenerate ./android from app.json first
    .\scripts\build-apk-local.ps1 -KeystorePath D:\Keys\grimoire-release.jks   # sign with YOUR release key, not the debug key
        # (password is read from $env:GRIMOIRE_KEYSTORE_PASSWORD - never a parameter or a file; see scripts\make-release-keystore.ps1)

  Everything heavy lives on D: (Gradle cache, build temp). Output APK -> .\builds\
#>
param(
  [switch]$AllAbis,
  [switch]$Clean,
  [switch]$Prebuild,
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

# --- the app ships no built-in catalog: content comes only from the signed packs it bundles (assets/packs), and metro.config.js swaps the
# --- catalog modules for empty ones. There is no SRD-only / full-content split any more.
$env:NODE_ENV = 'production'

# The SRD packs the app bundles (assets/packs) are generated from the same content; regenerate them so the APK never ships a stale pack.
npx tsx scripts/build-srd-packs.ts
if ($LASTEXITCODE -ne 0) { throw "SRD pack generation failed ($LASTEXITCODE)" }

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
  $releaseArgs = @('assembleRelease', "-PreactNativeArchitectures=$abis") + $signArgs + @('--no-daemon')
  $releaseArgs += '--rerun-tasks'   # never reuse a bundle built before the packs or the empty catalog changed
  .\gradlew.bat @releaseArgs
  if ($LASTEXITCODE -ne 0) { throw "gradle failed ($LASTEXITCODE)" }
} finally {
  if ($androidPushed) { Pop-Location }
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

