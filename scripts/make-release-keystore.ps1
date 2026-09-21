<#
  Creates a release signing key for Grimoire (one-time).

    .\scripts\make-release-keystore.ps1                       # -> D:\Keys\grimoire-release.jks
    .\scripts\make-release-keystore.ps1 -Path E:\Safe\g.jks

  This key IS the identity of your app: every future update must be signed with
  the same one, or phones will refuse to install it over the old version.
  BACK IT UP (and its password) somewhere other than this PC. Never commit it
  (*.jks / *.keystore are gitignored) and never paste the password into a file.
  keytool prompts for the passwords itself, so nothing secret appears on the command line.
#>
param(
  [string]$Path  = 'D:\Keys\grimoire-release.jks',
  [string]$Alias = 'grimoire'
)
$ErrorActionPreference = 'Stop'

$jbr = 'C:\Program Files\Android\Android Studio\jbr'
if ($env:JAVA_HOME -and (Test-Path "$env:JAVA_HOME\bin\keytool.exe")) { $jbr = $env:JAVA_HOME }
$keytool = Join-Path $jbr 'bin\keytool.exe'
if (-not (Test-Path $keytool)) { throw "keytool not found at $keytool" }
if (Test-Path $Path) { throw "$Path already exists - refusing to overwrite a signing key." }

New-Item -ItemType Directory -Force -Path (Split-Path $Path -Parent) | Out-Null
& $keytool -genkeypair -v -keystore $Path -alias $Alias -keyalg RSA -keysize 4096 -validity 10000 -dname 'CN=Grimoire, O=Grimoire'
if ($LASTEXITCODE -ne 0) { throw 'keytool failed' }

Write-Host "`nCreated $Path" -ForegroundColor Green
Write-Host 'Back it up now, then build a signed APK with:'
Write-Host '  $env:GRIMOIRE_KEYSTORE_PASSWORD = Read-Host "Keystore password"'
Write-Host "  npm run build:apk -- -KeystorePath $Path -KeyAlias $Alias"
