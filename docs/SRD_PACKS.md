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
     339 spells (the library record with the SRD 5.2.1 text applied), 20 items (the gear its starting packages name and the weapons its Weapon Mastery table lists that the 5.1 pack's 95 items lack: Leather Armor, the adventuring packs, Holy Symbol, the crossbows and so on; the build fails if one is not marked SRD), and a `rules` section with the
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

## Step 4: content-provider seam (6 October 2026, screens done at the seam)

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
- **Creation screens: done at the seam, not yet switched on.** The screens did not need rewriting. They read the official
  catalog through `globalContentDB`, the merged content database, subclass browsing and the Compendium's Official view,
  so those readers now follow `officialSource.ts`: `activateOfficialPacks(packs)` validates the packs (all or nothing) and makes
  them the official source; `clearOfficialPacks()` restores the hardcoded catalog. With packs installed, races, classes,
  backgrounds, feats and subclasses on the screens are the pack records (tests show they equal the catalog's, provenance
  aside), the SRD-5.1 flag filter stops applying to them, and a Fighter built the way the class screen builds one equals
  the catalog's. What is not done: nothing in the running app calls `activateOfficialPacks` yet, because the app has no pack
  files to install (bundling versus downloading them is step 8), so the screens still show the hardcoded catalog.
  Conditions and the feature list still come from the catalog.
- `createCharacter` is no longer a duplicate path to maintain: the screens and it now read the same source.
- **Spells and items: done at the seam.** `spellRepo` and `itemRepo` (web and native) are wrapped (`packRepos.ts`): with packs
  installed, the index and the full records come from the provider, and the SQLite and in-memory stores are not read. A
  spell resolves per ruleset (`provider.getSpell(id, ruleset)`: a 2024 character gets the 5.2.1 pack's version, anyone else
  the shared 5.1 record, and a 2024-only spell such as Divine Smite is absent for a 2014 character); the browsing index
  has one entry per id carrying the class tags of every version, so 2024 class pickers work. Entitlements, action cards,
  the pipeline, the pickers and the prerequisite checks all read through the repos, so they follow with no change of
  their own; the three remaining direct readers of the hardcoded spell library (prerequisites, spell replacement, the
  Swappable Spells panel) now use the repo too. Tests run with no repo mocked and prove it: every always-prepared spell,
  every starting item of every 2024 class and background, and every Weapon Mastery weapon (bar the optional firearms)
  resolves from the packs alone.
- **Still static:** `leveling.ts` and `actionCards.ts` default `classDefinitions`/`classDefs` to the hardcoded `ALL_CHAR_CLASSES`
  (callers pass the provider's classes; the default is only for callers that pass nothing), conditions, monsters,
  `origin2024.ts` (which builds the Magic Initiate pools from the hardcoded spell library when it loads; the packs carry
  those feats already built), and the homebrew spell and item builders.
- **Finding:** the SRD-only build ships only 95 items, because the public-provenance gate is strict. Leather Armor, the
  adventuring packs, Holy Symbol, the crossbows and the sling are not among them, so today's SRD-only APK cannot resolve a
  2014 Fighter's or Rogue's own starting gear. The 5.1 pack mirrors that gate; widening it is a content-verification
  decision, not an engineering one.
- **No install registry or runtime hash check.** The provider takes packs it is given. Verifying `contentHash` needs a
  SHA-256 at runtime (build-time uses node `crypto`; React Native needs `expo-crypto`), and the install, update and
  uninstall store (steps 7 and 8) does not exist.

## Importing the official packs (6 October 2026)

An SRD pack imports through the same screen as homebrew (Homebrew → Import, or Compendium → Packages → Import):
- The picker recognises a first-party pack (`manifest.officialFirstPartyPack`) and shows its own confirm card instead of the
  homebrew conflict flow: name, version, ruleset, licence, counts, what installing does, the attribution, and the reason
  when it cannot be installed. Nothing is installed by picking.
- Before install: the envelope and manifest validate, the **content hash is checked** (a pure-TypeScript SHA-256,
  `engine/sha256.ts`, verified against Node's), the content passes the same validation as any imported pack, and the
  packs installed together must still resolve (a missing or too-old dependency, such as the 5.2.1 pack without the 5.1
  pack, is refused).
- Install is all or nothing and is stored whole in a new `official_packs` SQLite table; it is restored at every app start
  (`bootOfficialPacks`, before characters load; a problem leaves the built-in catalog and is logged). An update replaces
  the installed version. Removal (Compendium → Packages → Official content packs) is refused while another pack needs the
  one removed; removing the last pack restores the built-in catalog.
- Installing makes the packs the official catalog: anything they do not contain is hidden until they are removed. In a full
  (non-SRD-only) build that includes the Artificer and other non-SRD content; characters keep their saved data.
- Homebrew classes that draw on official spell lists (the Emperor Warlock) still see them: their class tags are added to
  pack spells at read time through `registerSpellTagOverlay`, not baked into the packs. Packs now carry only the class tags
  of the classes they contain.
- Not checked: authenticity. The hash proves the file is intact, not who made it; there is no signature.
- Not built yet (waiting on screen review): first-run "choose packs" screen, pack download or bundling, update checks, and
  pack ids and versions on characters and campaigns.

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
