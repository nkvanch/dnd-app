param(
  [Parameter(ValueFromRemainingArguments = $true)]
  [string[]]$MaestroArgs
)
$ErrorActionPreference = 'Stop'
$env:JAVA_HOME = 'C:\Program Files\Android\Android Studio\jbr'
$env:ANDROID_HOME = 'D:\Dev\Android\sdk'
$env:ANDROID_SDK_ROOT = $env:ANDROID_HOME
$env:GRADLE_USER_HOME = 'D:\DevCache\gradle'
$env:LOCALAPPDATA = 'D:\DevCache\maestro\localappdata'
$env:MAESTRO_CLI_NO_ANALYTICS = 'true'
$env:MAESTRO_CLI_ANALYSIS_NOTIFICATION_DISABLED = 'true'
$env:Path = "D:\Dev\Android\sdk\platform-tools;D:\Dev\Maestro\bin;$env:JAVA_HOME\bin;$env:Path"
New-Item -ItemType Directory -Force -Path $env:LOCALAPPDATA, 'D:\Documents\dnd-app\builds\maestro-artifacts' | Out-Null
& 'D:\Dev\Maestro\bin\maestro.bat' @MaestroArgs
exit $LASTEXITCODE
