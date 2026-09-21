# Android physical-device E2E

## Machine layout

The repository and all APK/test artifacts live under 'D:\Documents\dnd-app'. The Android SDK is 'D:\Dev\Android\sdk', Gradle user home is 'D:\DevCache\gradle', npm cache is 'D:\DevCache\npm', and Maestro is 'D:\Dev\Maestro'. Android Studio's bundled JDK remains at 'C:\Program Files\Android\Android Studio\jbr'.

Android Studio currently records 'C:\Users\nk\AppData\Local\Android\Sdk' in '%APPDATA%\Google\AndroidStudio2026.1.1\options\android.sdk.path.xml'. In Android Studio, open **Settings > Languages & Frameworks > Android SDK**, change **Android SDK Location** to 'D:\Dev\Android\sdk', apply, restart Android Studio, and verify a project sync before removing the old SDK.

## Primary-phone workflow

Use the primary everyday phone only for the preservation-safe suite:

```powershell
Set-Location 'D:\Documents\dnd-app'
.\scripts\install-latest-apk.ps1
.\scripts\run-maestro-safe.ps1
```

Both scripts accept '-DeviceId <adb-id>'. APK installation uses 'adb install -r', which updates the package without clearing application data. The safe runner executes only '.maestro\preserve-state', rejects destructive tokens before execution, keeps the latest five runs, and writes under 'builds\maestro-artifacts\preserve-state'.

Use a disposable phone or emulator for the mutating suite:

```powershell
.\scripts\run-maestro-disposable.ps1 -DeviceId <adb-id> -ConfirmDestructive
```

The destructive switch is mandatory. Back up or export important characters before explicitly choosing to run this suite on a primary phone.

## Test suite matrix

### Preserve-state automated

- Startup and tab navigation
- Characters navigation without entering creation
- Character Import UI without opening the system picker
- SRD Compendium exposure and read-only filter visibility
- Compendium structural controls and deterministic content markers
- Existing-character header/menu when a character exists
- Rules information opened and closed without choosing a ruleset/profile
- Export format visibility without invoking save/share
- Free Edit lock state, or open-and-close inspection when already enabled
- Dice roller because its recent-roll history is process-memory-only and is not persisted as character or profile state

Optional-character flows use a Maestro condition. They pass without opening a sheet when the Home screen says no characters exist.

### Disposable automated

- Character creation and creation resume
- Point Buy changes
- Equipment changes
- Free Edit mutations
- Weapon equip/unequip
- HP, resource, action, and spell mutations
- Import/export round trips when system-picker automation is reliable

The current destructive/reset-based flows are under '.maestro\disposable'. Legacy preconditioned inspection flows remain under '.maestro\requires-character'; neither directory is called by the safe runner.

### Manual

- Subjective color quality, spacing, font sizing, and exact clipping
- Gesture-navigation versus three-button-navigation visual layout
- Subjective Compendium filter usability
- System document picker behavior when its provider cannot be driven reliably

## Manual character import round trip

This test intentionally changes character data and must not be part of the preserve-state suite:

1. Export Alice using **Grimoire Character** JSON and confirm the file was saved.
2. Delete Alice and confirm Characters no longer contains Alice.
3. Open **Characters > Import Character** and choose the exported JSON.
4. Confirm Alice imports and her sheet opens.
5. Confirm embedded custom-profile semantics, if the export contains them.
6. Import the same file again and confirm the expected copy/conflict behavior.

## Tool verification

```powershell
& 'D:\Dev\Android\sdk\platform-tools\adb.exe' version
& 'D:\Dev\Maestro\bin\maestro.bat' --version
$env:GRADLE_USER_HOME = 'D:\DevCache\gradle'
.\android\gradlew.bat --version
npm config get cache
```

Do not remove the old 'C:' Android SDK until Android Studio uses the D: SDK and a project sync succeeds. Old Gradle, npm, Expo, Temp, and Downloads data must be reviewed separately; the test scripts never delete them.
