# Pre-send checklist

Nothing below is done for you, these are the things only you (or a phone) can verify. **Work through it in order; no link goes in any message until step 7 is ticked.**

## Sequence

1. - [ ] **Produce the exact creator APK from the public SRD repository** (`D:\Documents\grimoire`, https://github.com/nkvanch/Grimoire, a clean checkout of the commit you will tag): `npm run build:apk -- -KeystorePath <your .jks>` (see README). Never build the creator APK from the private repo. The script must print **your release key** as the signer (no yellow "DEBUG key" warning), plus a SHA-256. Keep that exact file, every later step uses it.
2. - [ ] **Scan that APK for non-SRD content.** The SRD repository holds only SRD 5.1 and original content, so the source is settled. This step checks the *built file*: unzip the APK and search the JS bundle and `content.db` for the names of removed content (the scan list is kept privately). Any hit means stop and fix the repo first. The SRD flags are the project's own audit, not a legal review, so decide consciously that you accept that.
3. - [ ] **Verify SRD attribution / licence notices** in that APK: the in-app About & Legal text matches what CC BY 4.0 requires for SRD 5.1 material, and the release/itch copy carries the same attribution and the "not affiliated with Wizards of the Coast" line.
4. - [ ] **Run the safe Maestro suite on that exact APK** (`.\scripts\run-maestro-safe.ps1`, real device, no state cleared). It includes the Compendium three-mode flow.
5. - [ ] **Do one real character round trip by hand:** export a character → delete it → import it back through the document picker. Confirm nothing is lost.
6. - [ ] **Record the 60-second demo** per `demo/DEMO_SCRIPT.md`: only "(Demo)" content on screen, uploaded unlisted.
7. - [ ] **Test the demo and download links logged out / incognito, on a phone that isn't yours.**
8. - [ ] **Send wave 1 only** (DM V, Zellorea, Jonoman3000).
9. - [ ] **Wait for at least one substantive reply before changing the wave-2 wording** (Nathan, Lee, Antonio).

## Hosting (needed for step 7)
- [ ] The download link is one creators can actually open: a **published GitHub pre-release** (a Draft is visible only to collaborators, so it doesn't count), or a **Restricted** itch.io page (password or per-person download keys; itch's Draft is owner-only and isn't for distribution), or another creator-accessible host.
- [ ] A published release on the public repo is visible to anyone, which is fine for SRD-only content, but only after step 2 passes.
- [ ] Each creator's page is filled in (no `[…LINK]` placeholders left) and opens on a phone.
- [ ] https://github.com/nkvanch/Grimoire opens logged out, the repo is public, LICENSE and README render, and README's Releases link resolves.

## Claims to check against *this* build
- [ ] Free ✔ · open source (GPL-3.0-or-later) ✔ · **works offline, requires no account or external server** ✔ (no network calls in the app code; campaign sync is optional, device-to-device on your LAN) · Android only ✔
- [ ] Installed on a clean phone (uninstall first): opens, no crash, a created character is still there after closing and reopening.
- [ ] All four `.grimoire-pack` files import from the phone's storage, each showing a preview first and importing without warnings.

## Before each message
- [ ] Re-read that creator's public page; the personal details in the message are still accurate.
- [ ] Discord/Patreon: message has **no links**; email: links included.
- [ ] Antonio: the "not asking to redistribute your homebrew" sentence is still in; no pre-made pack; sent last.
- [ ] You're comfortable with the sign-off: "Nika" on Discord and Patreon, "Nikoloz Kvanchakhadze (Nika)" with your email on the two emails.
