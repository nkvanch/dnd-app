param([string]$DeviceId)

$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
$suite = Join-Path $repo '.maestro\preserve-state'
$artifactRoot = Join-Path $repo 'builds\maestro-artifacts\preserve-state'
$maestro = 'D:\Dev\Maestro\bin\maestro.bat'
$adb = 'D:\Dev\Android\sdk\platform-tools\adb.exe'

if (-not (Test-Path -LiteralPath $maestro)) { throw "Maestro not found: $maestro" }
if (-not (Test-Path -LiteralPath $adb)) { throw "ADB not found: $adb" }
if (-not (Test-Path -LiteralPath $suite)) { throw "Safe suite not found: $suite" }

$flowFiles = @(Get-ChildItem -LiteralPath $suite -File -Filter '*.yaml' | Sort-Object Name)
if ($flowFiles.Count -eq 0) { throw 'The preserve-state suite contains no flows.' }
$forbidden = '(?i)clearState|pm\s+clear|clear app data|reset database|\bdelete\b|uninstall'
$unsafe = @($flowFiles | Select-String -Pattern $forbidden)
if ($unsafe.Count -gt 0) {
  $unsafe | ForEach-Object { Write-Error ("Forbidden preserve-state token: {0}:{1}: {2}" -f $_.Path, $_.LineNumber, $_.Line.Trim()) }
  exit 2
}
$externalFlow = @($flowFiles | Select-String -Pattern '(?i)file\s*:\s*.*\.\.[\\/]')
if ($externalFlow.Count -gt 0) { Write-Error 'Preserve-state flows may not include flows outside their directory.'; exit 2 }

$deviceLines = @(& $adb devices | Select-Object -Skip 1 | Where-Object { $_ -match '\sdevice$' })
$deviceIds = @($deviceLines | ForEach-Object { ($_ -split '\s+')[0] })
if ($DeviceId) {
  if ($DeviceId -notin $deviceIds) { throw "ADB device '$DeviceId' is not connected and authorized." }
} elseif ($deviceIds.Count -eq 1) {
  $DeviceId = $deviceIds[0]
} elseif ($deviceIds.Count -eq 0) {
  throw 'No connected, authorized Android device was found.'
} else {
  throw "Multiple devices are connected. Pass -DeviceId. Found: $($deviceIds -join ', ')"
}

$runId = Get-Date -Format 'yyyyMMdd-HHmmss'
$runDir = Join-Path $artifactRoot $runId
New-Item -ItemType Directory -Force -Path $runDir | Out-Null
$env:JAVA_HOME = 'C:\Program Files\Android\Android Studio\jbr'
$env:ANDROID_HOME = 'D:\Dev\Android\sdk'
$env:ANDROID_SDK_ROOT = $env:ANDROID_HOME
$env:GRADLE_USER_HOME = 'D:\DevCache\gradle'
$env:LOCALAPPDATA = "D:\DevCache\maestro\localappdata\$runId"
$env:TEMP = 'D:\DevCache\tmp'
$env:TMP = $env:TEMP
$env:MAESTRO_CLI_NO_ANALYTICS = 'true'
$env:MAESTRO_CLI_ANALYSIS_NOTIFICATION_DISABLED = 'true'
$env:Path = "D:\Dev\Android\sdk\platform-tools;D:\Dev\Maestro\bin;$env:JAVA_HOME\bin;$env:Path"
New-Item -ItemType Directory -Force -Path $env:LOCALAPPDATA, $env:TEMP | Out-Null

Write-Host "Running $($flowFiles.Count) preserve-state flows on $DeviceId"
Write-Host "Artifacts: $runDir"
$previousErrorActionPreference = $ErrorActionPreference
$ErrorActionPreference = 'Continue'
& $maestro --device $DeviceId test $suite --test-output-dir $runDir --debug-output $runDir 2>&1 | Tee-Object -FilePath (Join-Path $runDir 'console.log')
$code = $LASTEXITCODE
$ErrorActionPreference = $previousErrorActionPreference

$oldRuns = @(Get-ChildItem -LiteralPath $artifactRoot -Directory | Sort-Object LastWriteTime -Descending | Select-Object -Skip 5)
$oldRuns | Remove-Item -Recurse -Force
if ($code -eq 0) {
  Write-Host "PASS: $($flowFiles.Count)/$($flowFiles.Count) preserve-state flows passed on $DeviceId."
} else {
  Write-Host "FAIL: preserve-state suite exited with code $code on $DeviceId. See $runDir"
}
exit $code




