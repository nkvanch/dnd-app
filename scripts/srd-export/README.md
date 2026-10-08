# SRD export (private repo -> public `grimoire` repo)

Builds a source-level, SRD-only copy of the app. Nothing here edits this repo's content. Every script that
changes files takes the COPY as its target or runs with the copy as the working directory.

Order used for the first export (2026-09-21):

1. Copy the tracked app files (not docs/, outreach/, .obsidian/, dnd-app.zip, AGENTS/CLAUDE/AUDIT) to the new folder.
2. `npx tsx scripts/srd-export/compute-sets.ts <sets.json>`: keep/remove sets from the real catalog (`srd === true` keeps).
3. `npx tsx scripts/srd-export/strip.ts <copy> <sets.json>`: removes `srd:false` consts, array members, `feat()` calls, id-set members.
4. In the copy: delete the Artificer / Blood Hunter / Abyss Knight class and subclass files, filter both
   `srdClassification.json` files to `true` entries, empty infusions, rewrite `builtinHomebrew.ts`, fix the demo character.
5. `strip-refs.ts <ids>` (properties and string members naming removed classes/companions), `remove-calls.ts <file> <fn>`
   (helper-built subraces), `prune-unused.ts` (loops `tsc --noUnusedLocals`), `scrub-comments.ts <sets.json>`.
6. `remove-failed-tests.ts <jest.json>` and `fix-imports.ts` for tests that asserted removed content.
7. Regenerate `assets/content.db` with `scripts/generate-content-db.mjs`, then run `verify.ts <sets.json>` from the copy.

`verify.ts` is the gate: catalog ids must equal the keep set exactly, and every subrace must be `srd:true`.

## Decisions taken as defaults (change and re-run if you disagree)

- Unflagged entries are removed (conservative). Kept unflagged: conditions (SRD list) and beast forms (SRD monsters).
- Infusions and companions are empty. Built-in homebrew seeds (Abyss Knight, Blood Hunter, Skeleton) are gone.
- 5.5e-tagged Human (2024) and Acolyte (2024) are removed: not flagged SRD.
- Three original items of the author (life-drinking greatsword, rope of mending, cast-off breastplate) were also removed
  so the official edition does not present homebrew as official.
- `.maestro/disposable/package-builder.yaml` was dropped because it depended on the seeded homebrew.

## Open items

- The `srd` flags are the project's own audit. Text inside kept entries (SRD class feature text, option lists) was not
  re-audited line by line.
- The public repo carries the CC-BY notice in `NOTICE.md` and the in-app About screen.
