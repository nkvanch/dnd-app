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

## Step 4: content-provider seam (6 October 2026, partly done)

Built:
- `ContentProvider` (`src/content/provider/contentProvider.ts`): classes, subclasses, species, backgrounds, feats and
  spells by id, for one ruleset. `packContentProvider(packs, ruleset)` reads installed `.grimoire-pack` envelopes:
  each pack is validated (`validateGrimoirePack`, `validateManifest`), dependencies are checked (missing, too old,
  installed twice, cycles) and ordered, records merge by id with later packs winning, and a record with no ruleset of
  its own takes its pack's ruleset (the 5.1 pack's untagged classes are 2014 content, not content for every ruleset).
  `staticContentProvider` puts the hardcoded catalog behind the same interface.
- `createCharacter(provider, spec, rules)` (`src/content/provider/createCharacter.ts`) builds a character from a
  provider alone: species features, resources and picks, background and its Origin feat (the feat comes from the
  provider), class and levels, subclass, and `spellCandidates`/`pickSpells` for spell choices filtered from the
  provider's spells. It uses the same engine functions the screens use.
- Tests (`src/content/provider/__tests__/packProvider.test.ts`): created from the generated packs round-tripped through
  JSON; a changed or removed pack record (class feature, Origin feat, species trait, spell) changes the character;
  missing content fails with a named error; a level 3 Evoker Wizard from packs equals the one from the static catalog.

Not done, and why (each is a reason the static catalog cannot be deleted yet):
- **The creation screens still read the static catalog** (`getMergedContentDB`). `createCharacter` duplicates the
  screens' steps (race, background, class, subclass) rather than the screens calling it; moving them is the next piece.
- **The engine still imports static content at module load**: `leveling.ts` and `actionCards.ts` default their
  `classDefinitions`/`classDefs` to `ALL_CHAR_CLASSES`, `ALL_RACES` and `spellRepo`/`itemRepo` are read for spell and
  item lookups (entitlements, action cards, pipeline), and `prerequisites.ts`/`replaceSpellChoiceSelection` read the
  spell library lazily. `createCharacter` passes the provider's classes, races and spells wherever the engine accepts
  them, so no static *record* is read for the pack-only tests, but a pack spell that is not also in the static library
  would not resolve in those lookups. The spell and item repos need the same provider seam.
- **No install registry or runtime hash check.** The provider takes packs it is given. Verifying `contentHash` needs a
  SHA-256 at runtime (build-time uses node `crypto`; React Native needs `expo-crypto`), and the install, update and
  uninstall store (steps 7 and 8) does not exist.
- Items: the 5.2.1 pack's gear depends on the 5.1 pack's weapons and armor; the provider does not serve items yet, so
  starting equipment still resolves through the static item repo.

## Order for the rest

4. (Partly done, above.) Make 2024 character creation read installed-pack content only (the 2024 content is the smallest, newest and has no
   legacy importers, so it proves the loader). Remaining: move the screens onto the provider, give the engine's spell,
   item and class lookups a provider, serve items.
5. Same for SRD 5.1.
6. Remove the hardcoded public catalog registration and the `SRD_ONLY` switches; `content.db` becomes the install target.
7. Missing-pack handling (a character whose pack is gone keeps its data and shows "Missing content dependency").
8. Install, update, uninstall UI and the first-run screen.
9. Pack ids and versions on characters and campaigns.
10. Rebuild the APK and assert that no SRD catalog is embedded.

The risk to manage in step 4 to 6 is the engine's static imports: `collectAllEffects`, `levelUp`, class progressions and
spell lookups read the static libraries directly. They need a content-provider seam (what the homebrew store already is)
before the statics can be deleted, and every existing test that imports a library will need to install a pack instead.
