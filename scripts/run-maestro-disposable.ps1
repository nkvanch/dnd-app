param(
  [string]$DeviceId,
  [switch]$ConfirmDestructive
)

$ErrorActionPreference = 'Stop'
if (-not $ConfirmDestructive) {
  Write-Host 'THIS MAY MODIFY OR ERASE GRIMOIRE TEST DATA. Re-run with -ConfirmDestructive to continue.' -ForegroundColor Red
  exit 2
}
$repo = Split-Path -Parent $PSScriptRoot
$suite = Join-Path $repo '.maestro\disposable'
$artifactRoot = Join-Path $repo 'builds\maestro-artifacts\disposable'
$maestro = 'D:\Dev\Maestro\bin\maestro.bat'
$adb = 'D:\Dev\Android\sdk\platform-tools\adb.exe'
if (-not (Test-Path -LiteralPath $maestro)) { throw "Maestro not found: $maestro" }
if (-not (Test-Path -LiteralPath $adb)) { throw "ADB not found: $adb" }
$deviceIds = @(& $adb devices | Select-Object -Skip 1 | Where-Object { $_ -match '\sdevice$' } | ForEach-Object { ($_ -split '\s+')[0] })
if ($DeviceId) {
  if ($DeviceId -notin $deviceIds) { throw "ADB device '$DeviceId' is not connected and authorized." }
} elseif ($deviceIds.Count -eq 1) { $DeviceId = $deviceIds[0] }
elseif ($deviceIds.Count -eq 0) { throw 'No connected, authorized Android device was found.' }
else { throw "Multiple devices are connected. Pass -DeviceId. Found: $($deviceIds -join ', ')" }
$runId = Get-Date -Format 'yyyyMMdd-HHmmss'
$runDir = Join-Path $artifactRoot $runId
New-Item -ItemType Directory -Force -Path $runDir | Out-Null
$env:JAVA_HOME = 'C:\Program Files\Android\Android Studio\jbr'
$env:ANDROID_HOME = 'D:\Dev\Android\sdk'
$env:ANDROID_SDK_ROOT = $env:ANDROID_HOME
$env:GRADLE_USER_HOME = 'D:\DevCache\gradle'
$env:LOCALAPPDATA = "D:\DevCache\maestro\localappdata\disposable-$runId"
$env:TEMP = 'D:\DevCache\tmp'; $env:TMP = $env:TEMP
$env:MAESTRO_CLI_NO_ANALYTICS = 'true'
$env:Path = "D:\Dev\Android\sdk\platform-tools;D:\Dev\Maestro\bin;$env:JAVA_HOME\bin;$env:Path"
New-Item -ItemType Directory -Force -Path $env:LOCALAPPDATA, $env:TEMP | Out-Null
Write-Warning 'THIS MAY MODIFY OR ERASE GRIMOIRE TEST DATA.'
$previousErrorActionPreference = $ErrorActionPreference
$ErrorActionPreference = 'Continue'
& $maestro --device $DeviceId test $suite --test-output-dir $runDir --debug-output $runDir 2>&1 | Tee-Object -FilePath (Join-Path $runDir 'console.log')
$code = $LASTEXITCODE
$ErrorActionPreference = $previousErrorActionPreference
if ($code -eq 0) { Write-Host "PASS: disposable suite completed on $DeviceId." }
else { Write-Host "FAIL: disposable suite exited with code $code. See $runDir" }
exit $code




