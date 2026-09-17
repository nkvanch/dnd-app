# Grimoire — Release & Presentability Audit
*Generated 2026-07-06. Code-level audit — the reviewer could not run the app; runtime findings come from reported bugs and code reading.*

---

## 1. SHIP-BLOCKERS (must fix before Play Store / public promotion)

### 1.1 ⚖️ WotC intellectual property (the big one)
**Status: highest-risk item. Personal table use is fine; public distribution is not, as-is.**

- `src/content/spells/generated.ts` contains 487 spells. 71 are already marked
  `"not OGL"` with paraphrased summaries (good instinct), **but**:
  - **Product Identity names are used verbatim**: Tasha's Caustic Brew, Tasha's
    Hideous Laughter, Tasha's Mind Whip, Melf's Acid Arrow, Melf's Minute
    Meteors, Nystul's Magic Aura, Leomund's Tiny Hut, Evard's Black Tentacles,
    Hunger/Arms of Hadar, Armor of Agathys. Named-wizard spells are explicit
    WotC Product Identity — not covered by any open license, even with a
    rewritten description.
  - **Non-SRD expansion spells are included**: Booming Blade, Green-Flame
    Blade, Mind Sliver, Toll the Dead, Absorb Elements, Chaos Bolt, Ice Knife,
    Zephyr Strike, Shadow Blade, etc. These come from SCAG/Xanathar's/Tasha's,
    which are NOT under the SRD/CC-BY license at all. A paraphrase with the
    same name and mechanics is still their content.
- **What to do for a public build:**
  1. SRD 5.1 (CC-BY-4.0) versions exist for the named-wizard spells with the
     name stripped (e.g. *Acid Arrow*, *Tiny Hut*, *Black Tentacles*,
     *Hideous Laughter*). Rename to the SRD names and use SRD text.
  2. Remove (or gate behind "homebrew import") all spells that have no SRD
     equivalent. Suggest an `srd: boolean` flag in the converter script and a
     build-time filter.
  3. Add the **CC-BY-4.0 attribution** required by the SRD 5.1 license to an
     About/Legal screen: *"This work includes material taken from the System
     Reference Document 5.1 ("SRD 5.1") by Wizards of the Coast LLC, available
     under the Creative Commons Attribution 4.0 International License."*
  4. Same audit needed for classes, races, backgrounds, feats, items, and
     monsters (not yet reviewed here — likely the same situation).
- **Store listing language:** never use "D&D", "Dungeons & Dragons", or "5e"
  in the app NAME or icon. In the description, "compatible with the world's
  most popular tabletop roleplaying game" or "for 5th-edition-compatible
  games" is the standard safe phrasing. "Grimoire" as a name is fine.

### 1.2 📦 Package ID is permanent — change it BEFORE first upload
`app.json` → `"package": "com.anonymous.dndapp"`. The application ID can
**never be changed** after the first Play Store upload. Change to something
you own, e.g. `com.nkvanch.grimoire`, then `npx expo prebuild --clean` and a
fresh install (existing installs will see it as a different app).

### 1.3 🔑 EXPO_PUBLIC_ANTHROPIC_API_KEY
`.env` has `EXPO_PUBLIC_ANTHROPIC_API_KEY=your_key_here` (placeholder — no
leak today). But **any `EXPO_PUBLIC_*` variable is bundled into the shipped
JS** and extractable from the APK by anyone. If a real key is ever put there,
it becomes public. Since the app's stated principle is *no AI*, this looks
like leftover scaffolding — remove the variable and any code reading it
before release.

### 1.4 📄 Play Store requirements
- **Privacy policy URL** — mandatory (the CAMERA permission for QR scanning
  alone triggers the Data Safety form). A one-page static policy is enough:
  "all data stored locally on device; camera used only for QR scanning; no
  data collected or transmitted to us."
- **Data safety form** — declare: no data collected. LAN sync is device-to-
  device and never touches your servers (a genuine selling point — say so).
- **Release signing** — generate an upload keystore (or use Play App Signing,
  recommended) — the debug signature you've been installing with cannot be
  used for release.
- **App name in app.json** — currently `"name": "dnd-app"`. Users see this
  under the icon. Change to `"Grimoire"`.
- **versionCode/versionName** — EAS `autoIncrement` is set for production
  profile; fine.
- **Target API** — compileSdk/targetSdk 36 is current; fine.

---

## 2. KNOWN FUNCTIONAL GAPS (honest-scoping items — decide before promoting)

These are *documented* limitations, not hidden bugs, but reviewers WILL find
them, so either implement or disclose:

| Gap | State |
|---|---|
| Death saves | Not tracked per-entity at all (rule downgraded to reminder-only). For a "table companion" pitch this is a visible hole — implement before promo. |
| Crit mode (max+roll) | Reminder-only, no attack-roll engine path. Acceptable if disclosed. |
| Rest lengths | Display-only (no game clock). Fine. |
| Campaigns on web | Correctly disabled (no TCP in browsers). Fine, honestly labeled. |
| VPN edge case | expo-network returns the active interface IP; hosting while on a VPN may give a non-LAN address. Add a "code looks wrong? disable VPN" hint if reports come in. |
| Exploration spell filtering | Manual star only (by design — no structured utility tags exist). Fine. |

---

## 3. UX / PRESENTABILITY PRIORITIES (for demo videos & first-time users)

Ordered by impact for a YouTuber/first-user's first 5 minutes:

1. **First-run onboarding.** Right now the app opens cold. Add a 2–3 screen
   intro: what Grimoire is → create your first character → (optional) how
   campaigns sync. A skippable carousel is enough; creators screen-record the
   first launch.
2. **Demo/sample character.** A pre-built level-3 character ("Try Grimoire
   with a sample character") lets a viewer see the *sheet* — the best screen
   in the app — in the first 30 seconds instead of after a 10-step creation
   flow.
3. **Empty states are good but static.** The campaigns "How it works" list is
   solid; consider one short looping GIF/diagram of two phones syncing — the
   LAN sync is the differentiator and it's currently only described in text.
4. **Creation flow length.** 8 steps is a lot on camera. The hub with ✓ marks
   helps; consider a "Quick Build" (pick class+race, standard array
   auto-assigned by class, default skills) that produces a playable character
   in ~4 taps, with the full flow still available.
5. **Consistency polish:** the number-input vertical alignment bug (fixed in
   this pass) can exist anywhere a fixed-height TextInput is used — audit
   other TextInputs for the same Android padding issue (HpModal, builders).
6. **App icon/splash.** Present (adaptive icons configured). Verify the icon
   reads at 48px — most store browsing happens at tiny sizes.
7. **Screenshots for the listing:** sheet (combat), sheet (exploration),
   spellbook, the QR/room-code campaign screen, homebrew builder. 8 max, put
   the character sheet first.

## 4. PITCH ANGLE (for creators/outreach)

The differentiators worth leading with, in order:
1. **Offline LAN sync** — HP/conditions sync DM↔players over table WiFi with
   no internet, no accounts, no subscription. Nobody's data leaves the room.
   (This is rare in this category and demo-friendly: two phones, one QR scan.)
2. **Honest engine** — rules the engine actually enforces vs. table reminders
   are explicitly labeled; no fake toggles. Reviewers notice this.
3. **House-rules first** — point-buy budgets, skill-overlap handling, ASI
   modes as first-class campaign settings, not homebrew hacks.
4. **Free/no account/no tracking** — pairs with the privacy story.

## 5. QUICK FIXES APPLIED IN THIS PASS
- FreeEditModal number inputs: Android vertical centering + internal-scroll
  fix (`paddingVertical: 0`, `textAlignVertical: 'center'`,
  `includeFontPadding: false`), cross-platform `keyboardType="numeric"`.
- `app.json` display name change to `Grimoire` (see §1.4) — pending, apply
  alongside the package-ID change since both need a prebuild.

## 6. NOT AUDITED (out of scope for this pass — flag for later)
- Classes/races/feats/items/monsters content for the same SRD/PI issues as
  spells (§1.1 point 4).
- Full accessibility pass (touch target sizes, screen reader labels).
- iOS build (no Apple accounts/hardware in evidence).
- Performance on low-end devices (487-spell list rendering is the main risk;
  consider FlatList if the spellbook stutters).
