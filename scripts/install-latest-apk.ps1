param([string]$DeviceId)

$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
$buildRoot = Join-Path $repo 'builds'
$adb = 'D:\Dev\Android\sdk\platform-tools\adb.exe'
if (-not (Test-Path -LiteralPath $adb)) { throw "ADB not found: $adb" }
$apk = Get-ChildItem -LiteralPath $buildRoot -File -Filter '*.apk' -Recurse | Sort-Object LastWriteTime -Descending | Select-Object -First 1
if (-not $apk) { throw "No APK found under $buildRoot" }
$deviceIds = @(& $adb devices | Select-Object -Skip 1 | Where-Object { $_ -match '\sdevice$' } | ForEach-Object { ($_ -split '\s+')[0] })
if ($DeviceId) {
  if ($DeviceId -notin $deviceIds) { throw "ADB device '$DeviceId' is not connected and authorized." }
} elseif ($deviceIds.Count -eq 1) { $DeviceId = $deviceIds[0] }
elseif ($deviceIds.Count -eq 0) { throw 'No connected, authorized Android device was found.' }
else { throw "Multiple devices are connected. Pass -DeviceId. Found: $($deviceIds -join ', ')" }
Write-Host "Installing without clearing app data: $($apk.FullName)"
& $adb -s $DeviceId install -r $apk.FullName
if ($LASTEXITCODE -ne 0) { throw "adb install -r failed with exit code $LASTEXITCODE" }
$packagePath = & $adb -s $DeviceId shell pm path com.nkvanch.grimoire
if ($LASTEXITCODE -ne 0 -or -not $packagePath) { throw 'Install returned success, but package com.nkvanch.grimoire was not found.' }
Write-Host "PASS: com.nkvanch.grimoire installed on $DeviceId"
Write-Host $packagePath
