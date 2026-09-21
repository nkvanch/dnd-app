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

1. **Create your release key** (one time) and back it up off this PC: `.\scripts\make-release-keystore.ps1`
2. **Build the creator APK from the public SRD repository** (`D:\Documents\grimoire`, https://github.com/nkvanch/Grimoire), never from this private repo, and sign it:
   ```powershell
   $env:GRIMOIRE_KEYSTORE_PASSWORD = Read-Host "Keystore password"
   npm run build:apk -- -KeystorePath D:\Keys\grimoire-release.jks
   ```
   It prints who signed it and the SHA-256. The password is read from the environment, never stored.
3. **Scan the built APK** for non-SRD content (step 2 of the checklist) and verify the SRD attribution, before any link exists.
4. Run the safe Maestro suite on that exact APK, do one character export → delete → import round trip, then record the demo (`demo/DEMO_SCRIPT.md`).
5. **Host the download**: a *published* GitHub pre-release (a Draft isn't visible to creators) or a **Restricted** itch.io page (password or download keys; not Draft), using `release/`.
6. Test the demo and download links logged out, then **send wave 1 only** (DM V, Zellorea, Jonoman3000). Wait for a substantive reply before changing wave-2 wording.

## The APK content question, resolved by the SRD repository

The public repository https://github.com/nkvanch/Grimoire contains only SRD 5.1 (CC-BY-4.0) and original content: the non-SRD entries are removed from the source and from `assets/content.db`, not just hidden in the UI (see its `docs/SRD_EDITION.md`). The creator APK is built from that repository. The private repo's own builds still contain the broader catalog and must not be handed to anyone.

Still to do: scan the finished APK for non-SRD names (checklist step 2) and build with your release key. The SRD flags are the project's own audit; nobody has reviewed them legally.

## Caveats I could not resolve from here

- The personal details in the messages (what each creator makes) come from your plan; I can't browse Patreon/Reddit to confirm them.
- I verified the packs in tests at engine level, not by tapping through the phone UI. In particular, confirm a homebrew subclass is offered at Bard level 3 before recording DM V's video.
- "Nika" and "Grimoire" as the sign-off are used exactly as in your messages.
