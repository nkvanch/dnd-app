# GitHub Release, draft copy

Hosting: creators need a link that opens for them, and a GitHub Draft release is only visible to repository collaborators, so a Draft cannot be the download link. Use a published Pre-release on nkvanch/Grimoire (marked "pre-release", not "latest"). Nothing has been created or published.

Release folder, ready to upload: `D:\Documents\grimoire\builds\release-0.1.0-alpha\` (the same folder holds RELEASE_NOTES.md, a copy of the text below).

Tag: v0.1.0-alpha (target: main, the commit that contains the permission change, bdb22a8 or later)
Title: Grimoire alpha 0.1.0, Android
Mark as: pre-release (untick "latest release")

Assets to attach, all from that folder: Grimoire-alpha-0.1.0.apk, SHA256SUMS.txt, and the four .grimoire-pack files.

Body:

> Alpha, for testers. Grimoire is a free, open-source 5e-compatible character and campaign tool for Android. It works offline and needs no account or external server.
>
> **Install**
> 1. On your phone, download Grimoire-alpha-0.1.0.apk (about 58 MB).
> 2. Open it. Android will ask you to allow installing apps from this source. Allow it for your browser or file manager only, and turn it off again afterwards.
> 3. Google Play Protect may say the app is unrecognised. That is expected, this is a sideloaded alpha and it is not on the Play Store. Choose "More details" and then "Install anyway" only if you are comfortable with that. The source code is public.
> 4. Open Grimoire. Everything stays on your device.
>
> **What is in the build**
> The rules engine, the character sheet, the homebrew builders, .grimoire-pack import and export, and optional campaign sync over your local network. It contains only SRD 5.1 (CC-BY-4.0) and original content, and asks only for the permissions it needs (camera to scan a campaign QR code, local network for sync). Anything else you play with is homebrew that you create or import yourself.
>
> **Sample packs**
> Four small original packs, all labelled "(Demo)": Aster Test Pack, Breadth Test Pack, Stormbound Test Pack and Understudy Test Pack. Save one to your phone, open Grimoire, go to Homebrew, choose import, and pick the file. You will see a preview of what it contains before anything is added.
>
> **Known limits**
> Android only, there is no iOS build. Reactive features and outcomes are shown as text and are not resolved automatically. Homebrew is 5e-compatible only.
>
> **Check your download (optional)**
> APK SHA-256: `9a29897c76f899332e1afc0fbd326665229ad4b9a769df5691e7a90e46d4f62a`
> All files are listed in SHA256SUMS.txt. On Windows run `Get-FileHash Grimoire-alpha-0.1.0.apk`, on Linux or macOS run `sha256sum -c SHA256SUMS.txt`.
> The APK is signed with the Grimoire release key, certificate SHA-256 `7829c0ec3638caa8f51d63c71d35b0745cebb7ec504a1db623fe3622ef0b7a0c`.
>
> **Feedback**
> Please tell me where it breaks: https://github.com/nkvanch/Grimoire/issues
>
> Licence: the code is GPL-3.0-or-later and the SRD content is CC-BY-4.0, see NOTICE.md. Not affiliated with or endorsed by Wizards of the Coast.

Before publishing:
- [ ] Push the Grimoire repo first (commits 5f783f8 and bdb22a8 are local), so the tag points at the commit the APK was built from.
- [ ] Install the APK on a clean phone and import each of the four packs (the tests and engine checks pass, this is the on-device check).
- [ ] Make sure https://github.com/nkvanch/Grimoire/issues is enabled (it is on by default for a new repo).
- [ ] Tick "pre-release", untick "latest".
- [ ] After publishing, open the release page logged out and download the APK once, then run the checksum against SHA256SUMS.txt.
