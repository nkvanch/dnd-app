# Grimoire Alpha: known limitations

For handpicked testers. This list separates what the app leaves to the table on purpose from what is broken or untested. If something is not here and misbehaves, please report it.

Build this applies to: commit `8488e59`, APK `grimoire-local-20261007-2256.apk`, SHA-256 `6e429198342bfb147977066976e8f9308b4cbf971d4c970b54e0a742fdd2d27b` (debug-signed).

## 1. Left to the table on purpose (not bugs)

The app tracks the number, the rest is yours to apply. These are marked "flavor-only" or show as plain text on the sheet.

- Many class and subclass features are text only, for example Evasion, Reliable Talent, Jack of All Trades, Relentless Rage, Persistent Rage, Indomitable Might, Supreme Healing. Roughly half of each class's features are fully automated or tracked (resource pools, effects); the rest are read-and-apply.
- Eldritch Invocations that grant a free spell (Armor of Shadows, Devil's Sight, Otherworldly Leap, and so on) are labelled flavor-only: the app records that you have them and checks their prerequisites, you cast or use them yourself.
- Paladin Aura of Protection adds the Charisma modifier to the Paladin's own saves; your allies add it themselves, and the aura's range is not measured.
- Dragon Wings (Draconic Sorcerer) and other situational movement are switches you set when they apply.
- Weapon and armor stats come from the packs; the app does not check line of sight, range bands or cover.
- Starting gear is saved as Carried, not worn. Open the Items tab and Equip armor, a shield and weapons: AC and attacks count only what is equipped (the Equip button shows the AC change first).
- Emperor Warlock and other private homebrew are not part of the public build.

## 2. Known gaps (real, but tolerable for an Alpha)

- **Two-device live play was tested only from one phone.** The host side was verified on a real device with a scripted player over the LAN (join, snapshot, session end message, rehost and rejoin). A second phone running the player app, including automatic reconnect after a drop, was not exercised.
- **No authentication on the LAN session.** Anyone on the same Wi-Fi who knows or guesses the room code (it is derived from the host's IP address) can join, and a joined client can push character data that the host accepts. Use it on a network you trust.
- **Players see the whole party.** The host sends every character stored on the DM's device to each joining player, and players' sheets (including their own notes) are relayed to the other players. Keep unrelated characters off the DM's device during a session.
- **The turn banner shows the acting creature's real name**, including a monster's name, during combat.
- **SRD 5.2.1 (5.5e) content gaps.** There are no 5.2.1 monsters (a 5.5e table uses the 5e SRD 5.1 stat blocks), and five spells lack their embedded stat-block or option tables in the app text: Animate Objects, Find Steed, Giant Insect, Summon Dragon, Elementalism. `docs/audits/SRD_5_2_1_READINESS_AUDIT.md` lists the rest.
- **Quick "Start Encounter" needs at least one character in the campaign.** The prepared-encounter route (Encounter Library, then Start) works with monsters only.
- **Hosting needs the same Wi-Fi.** There is no internet relay.
- **Backups and moving characters between phones** use the Import/Export buttons; they were not part of this device pass.
- The `branding_smite` spell (5e only) can still appear when browsing all spells under 5.5e. It is on no 5.5e class list.

## 3. What was checked on a real phone for this build

Clean install and first run; create, close, switch and reopen offline campaigns; Host Session, End Live Session, kill and relaunch (no stale room); the DM's private campaign notes never reach a player's socket; 2014 Fighter and 2024 Warlock creation, save, kill and relaunch with HP, AC, spells and pending choices intact; Warlock short rest restoring the pact slot; level 1 to 2 level-up; DM dashboard, monster library, prepared encounter and running combat; a Compendium with no non-SRD entries. Evidence is in `docs/audits/DEVICE_EXTERNAL_ALPHA_SMOKE_TEST.md`.

## 4. Not checked in this pass

Homebrew builder and package import, the Dice screen, character import and export, Settings, characters above level 2 on a device, Pathfinder and OSE modes.
