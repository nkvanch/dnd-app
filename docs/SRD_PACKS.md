# SRD content as installable packs

Direction: Grimoire is the engine, packs provide game content. The SRD 5.1 and SRD 5.2.1 content become two
first-party packs that use the same pack machinery as homebrew, and the app ships without an embedded catalog.

## Where this stands (5 October 2026)

Done:
1. **`ContentPackManifest`** (`src/engine/contentPackManifest.ts`): id, name, semantic version, ruleset, source family,
   licence and attribution, content hash, dependencies, replaces, author, `officialFirstPartyPack`, record counts; plus
   `RecordProvenance` for every record and `RequiredPack` for what a character or campaign needs. Schema only.
2. **The existing `.grimoire-pack` envelope represents SRD content** (`manifest` and a `rules` bag are optional members of
   it, so an ordinary homebrew export is still valid). The two packs pass `validateGrimoirePack` and
   `validatePackContents`, the same validation an imported homebrew pack goes through.
3. **The two packs are generated** (`npx tsx scripts/build-srd-packs.ts`, output in `release/packs/`, git-ignored):
   - `grimoire.srd.5.1` 1.0.0, ruleset `dnd5e-2014`: 12 classes, 12 subclasses, 9 species, 1 background, 1 feat,
     319 spells, 95 items, 322 monsters, 14 conditions (exactly what the SRD-only build ships today).
   - `grimoire.srd.5.2.1` 1.0.0, ruleset `dnd5e-2024`: 12 classes, 12 subclasses, 9 species, 4 backgrounds, 6 feats,
     339 spells (the library record with the SRD 5.2.1 text applied), 6 starting-gear items, and a `rules` section with the
     Weapon Mastery table and the class spell lists. It depends on the 5.1 pack for weapons, armor, packs, monsters and
     conditions, which are not separately authored for 5.2.1.
   - Every record carries `provenance` (`kind`, `family`, `sourceId`, and `derivedBy` where Grimoire normalized it); the
     manifest carries the hash of the canonical content, so an install can be verified; the build is deterministic.
   - Tests (`src/content/packs/__tests__/srdPacks.test.ts`) check manifests, per-record provenance, edition separation,
     that no private or non-SRD content can enter, hash stability, rules tables, unique ids and validator acceptance.
4. Building the packs found and fixed a real defect: ten library spells (Symbol, Simulacrum, Prismatic Spray, ...) had
   their range, components and duration merged into `castingTime`; Delayed Blast Fireball had no duration.

Not done (this is the migration, and it is large):
- **Runtime consumption.** The app still imports the hardcoded catalog (`ALL_*` arrays, 50+ importers, `content.db`) and
  filters it with `EXPO_PUBLIC_SRD_ONLY`. Nothing reads the packs yet, so the APK still embeds SRD content.
- Install, update and uninstall of first-party packs; first-run "Choose content packs" screen; the app running with no
  pack installed; missing-pack handling for characters; pack ids and versions on characters, campaigns and exports
  (`RequiredPack`); campaign allowed-packs; changed-record detection on update.
- The 2024 content is `srd: false` (that flag means SRD 5.1), so the current SRD-only APK hides every 2024 class,
  species and spell. The pack model fixes that by using the source family, not the flag.

## Order for the rest

4. Make 2024 character creation read installed-pack content only (the 2024 content is the smallest, newest and has no
   legacy importers, so it proves the loader).
5. Same for SRD 5.1.
6. Remove the hardcoded public catalog registration and the `SRD_ONLY` switches; `content.db` becomes the install target.
7. Missing-pack handling (a character whose pack is gone keeps its data and shows "Missing content dependency").
8. Install, update, uninstall UI and the first-run screen.
9. Pack ids and versions on characters and campaigns.
10. Rebuild the APK and assert that no SRD catalog is embedded.

The risk to manage in step 4 to 6 is the engine's static imports: `collectAllEffects`, `levelUp`, class progressions and
spell lookups read the static libraries directly. They need a content-provider seam (what the homebrew store already is)
before the statics can be deleted, and every existing test that imports a library will need to install a pack instead.
