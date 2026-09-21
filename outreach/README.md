# Creator outreach kit

Everything needed to contact six creators is drafted here. **Nothing has been sent, published, uploaded or posted**, that's yours to do.

## What's ready

| Piece                                                                                        | Where                                                                    |
| -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Six messages, one file each, in your send format (To, Subject, Attach, Send, Before sending) | `to-send/` *(gitignored)*, originals kept in `to-send/_archive/`         |
| Send order, rules, tracking table                                                            | `private/SEND_PLAN.md` *(gitignored)*                                    |
| One page per creator (Watch → Try → Test → Sample → Source)                                  | `pages/*.md`                                                             |
| Zellorea's technical one-pager                                                               | `pages/zellorea-mechanics.md`                                            |
| 60-second demo scripts (general + DM V character-focused)                                    | `demo/DEMO_SCRIPT.md`                                                    |
| GitHub pre-release copy, itch.io (Restricted) copy, install steps                            | `release/`                                                               |
| Pre-send checklist (revised order)                                                           | `PRE_SEND_CHECKLIST.md`                                                  |
| Original demo packs (all names end "(Demo)"; **not** in the app bundle)                      | `../demo/aster-test-pack/`, `../demo/sample-packs/`                      |
| Local signed-APK build + key generator                                                       | `../scripts/build-apk-local.ps1`, `../scripts/make-release-keystore.ps1` |

Sample packs (regenerate with `npx tsx demo/aster-test-pack/build.ts` and `npx tsx demo/sample-packs/build.ts`; 34 tests in `demo/` keep them valid and behaving in the engine):

| Pack | For | Contents |
|---|---|---|
| Aster Test Pack | the recordings (deterministic demo) | species, feat, item, monster + spell & condition dependencies |
| Breadth Test Pack | Jonoman | 1 species, 1 subclass, 1 feat, 2 spells, 1 item, 1 monster |
| Stormbound Test Pack | Lee | feat, spell, weapon, creature, condition |
| Understudy Test Pack | DM V | one awkward character concept (resource, 3-stage progression, passive, active ability, condition) |
| *(none)* | Zellorea, Nathan, Antonio | they bring their own design, no Pointy Hat pack, ever |

## What needs you

Follow `PRE_SEND_CHECKLIST.md`, its order is the order to work in. In short:

1. **Create your release key** (one time) and back it up off this PC: `.scriptsmake-release-keystore.ps1`
2. **Build the creator APK** from the final commit and sign it:
   ```powershell
   $env:GRIMOIRE_KEYSTORE_PASSWORD = Read-Host "Keystore password"
   npm run build:apk -- -KeystorePath D:Keysgrimoire-release.jks
   ```
   It prints who signed it and the SHA-256. The password is read from the environment, never stored.
3. **Settle what that APK may contain** (see the next section) and verify the SRD attribution, before any link exists.
4. Run the safe Maestro suite on that exact APK, do one character export → delete → import round trip, then record the demo (`demo/DEMO_SCRIPT.md`).
5. **Host the download**: a *published* GitHub pre-release (a Draft isn't visible to creators) or a **Restricted** itch.io page (password or download keys; not Draft), using `release/`.
6. Test the demo and download links logged out, then **send wave 1 only** (DM V, Zellorea, Jonoman3000). Wait for a substantive reply before changing wave-2 wording.

## The APK content question, unresolved

The default build sets `EXPO_PUBLIC_SRD_ONLY=true`, so the app *shows* only SRD 5.1 and original content. That flag filters what is displayed; the bundled content database and the JavaScript bundle still contain the broader catalog (the existing A44 design decision, left untouched).
Hiding content in the UI does not stop the file distributing it, so **do not treat the current APK as safe to hand to anyone outside your own devices.** A separate creator-build pipeline that emits only distributable content is being scoped (not started); until it exists and its output is verified, the checklist's step 2 stays open. The release copy says only what is true ("runs in SRD-only mode").

## Caveats I could not resolve from here

- The personal details in the messages (what each creator makes) come from your plan; I can't browse Patreon/Reddit to confirm them.
- I verified the packs in tests at engine level, not by tapping through the phone UI. In particular, confirm a homebrew subclass is offered at Bard level 3 before recording DM V's video.
- "Nika" and "Grimoire" as the sign-off are used exactly as in your messages.
