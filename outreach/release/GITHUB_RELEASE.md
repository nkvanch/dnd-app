# GitHub Release, draft copy

Hosting: creators need a link that opens for them, and a GitHub Draft release is only visible to repository collaborators, so a Draft cannot be the download link. Use a published Pre-release on nkvanch/dnd-app (marked "pre-release", not "latest"), or another host creators can open, for example the Restricted itch.io page in ITCH_PAGE.md.

A published GitHub release is public to anyone with the repository URL, so publish it only after PRE_SEND_CHECKLIST.md passes, including the decision about what the APK contains. You can prepare it as a Draft while you work, but it must be published before any link is sent. Nothing has been created.

Tag: v1.0.0-alpha.1 (proposed, app.json says 1.0.0, pick your own)
Title: Grimoire alpha 1, Android
Mark as: pre-release

Body:

> Alpha, for testers. Grimoire is a free, open-source 5e-compatible character and campaign tool for Android. It works offline and requires no account or external server.
>
> Install: download grimoire-1.0.0-alpha.1.apk and see INSTALL.md. It is not from the Play Store, so Android will ask you to allow installing from your browser, and Play Protect may show a warning. That is expected for a sideloaded alpha.
>
> What is in the build: the rules engine and the homebrew builders. This build runs in SRD-only mode, so only SRD 5.1 (CC-BY-4.0) and original content is shown in the app.
>
> Sample packs, all original, labelled "(Demo)", imported from the Homebrew tab: Aster Test Pack, Breadth Test Pack, Stormbound Test Pack, Understudy Test Pack.
>
> Known limits: Android only. Reactive features and outcomes are shown as text and are not resolved automatically. Homebrew is 5e-compatible only. See the README.
>
> SHA-256: (paste from Get-FileHash)
>
> Licence: the code is GPL-3.0-or-later and the SRD content is CC-BY-4.0. Not affiliated with or endorsed by Wizards of the Coast.

Assets to attach: the signed APK, the four .grimoire-pack files, and a SHA256SUMS.txt.

Before publishing: rebuild the APK from the final commit with npm run build:apk (SRD-only by default, do not pass -FullContent), sign it with your own release key (see outreach/README.md), install it on a clean device, import each pack, and confirm the README Releases link works.
