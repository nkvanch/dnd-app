# Grimoire 5.5e / 2024 current-state audit (SRD 5.2.1)

**Audited:** branch `simulation-preview`, started at `f868d80`; fixes landed in `07cfedb` and `062ae67`, and this document is committed on top of them. The earlier claims in previous audits and notes were not trusted: every item below was re-run against the current tree.

## Final verdict: READY WITH KNOWN LIMITATIONS

An outside tester can create, level (1 to 20), save, reload and play a representative 2024 character without being silently given 2014 rules, **after the two defects this audit found and fixed** (section 3). None of the hard gates fails. Two things stay unproven and are listed honestly: there is no real-device run (section 14), and word-for-word fidelity of class and species text is checked by an overlap measure, not a full diff (section 1).

### Hard gates

| Gate | Result |
|---|---|
| Public provenance of the 2024 content can be proven | Pass. The SRD 5.2.1 PDF is in `third_party/wotc/srd/5.2.1/` with its SHA-256 (`8974902d…e3d87`), license and URL in `SOURCE.md`; the pack manifest carries `sources`; every one of the 836 records carries `provenance`. |
| Changed same-name 2024 spells never silently resolve to 2014 | Pass at the data and provider level (308 same-name spells have a separate 2024 record, 0 wrong resolutions). Three UI paths did resolve 2014 text; fixed (section 3). |
| Common 2024 creation completes | Pass. All 12 classes, level 1 to 20, no pick that cannot be made except Ability Score Improvement, which is made on its own screen. |
| Class progression state not materially wrong | Pass for slots, cantrips, prepared counts, Weapon Mastery slots, ASI/subclass levels. One real defect (pact slots on a short rest) fixed. |
| Pack and content version separation intact | Pass. |
| SRD 5.2.1 not presented as verified without establishable fidelity | Pass, with the scope stated in section 1. |
| 2024 state survives save and restart | Pass at the repository layer (real `saveEntity`/`loadEntity`, fresh module registry). Not run on a device. |

## 1. Canonical source and provenance

- Source: *System Reference Document 5.2.1*, CC-BY-4.0, committed with hash. `scripts/verify-srd-5-2-1.ts` reads it with `pdftotext` and fails if the hash differs from `SOURCE.md`.
- Mechanically compared with the PDF:
  - **Spells:** 339 in the pack, 339 blocks in the PDF, 0 spells missing either way; level, school, casting time, range, duration, components and description for each. 333 match; 6 are below the 90% text-overlap bar and are explained:
    - Zone of Truth: parser artifact (its PDF block runs into the Rules Glossary); the pack text is correct.
    - Animate Objects, Find Steed, Giant Insect, Summon Dragon, Elementalism: the SRD's embedded stat-block or option tables are not in the pack text. **Limitation**, see section 21.
  - **Feats:** 19, name and category (prerequisites not compared). **Weapon Mastery column:** 38 of 38 in table order. **Magic items:** 257, name and text.
- Compared by other means:
  - Class features: `scripts/verify-srd-5-2-1-features.ts` finds each feature's title in the PDF and measures word overlap with the passage. 281 of 363 features share at least 80% of their words, 33 are naming-convention title mismatches (for example "Draconic Ancestry: Black", level-gated lineage spells) and 49 are low-coverage. The ones read by hand (Extra Attack, Defense, Indomitable, Bardic Inspiration, Resourceful) are the SRD text, so the low scores are matching artifacts or the app's own added notes. Not a proof of identical wording.
  - Cantrip and prepared-spell columns: all 8 caster classes agree with the SRD feature tables (4 by script, 4 read from the PDF text by hand; Sorcerer partly).
  - Slot tables (all 20 levels, 7 slot casters plus Pact Magic) and Weapon Mastery slots by level: asserted in tests against the SRD tables.
  - Backgrounds: the four SRD backgrounds match the PDF on abilities, Origin feat, skills and tool.
  - Species: spot-checked against the PDF (size, speed, Darkvision, resistances, lineage spells at 3 and 5). No discrepancy found.
- **Not machine-verified:** weapon and armor cost/weight/damage, tool list, species text word for word. Stated in the verifier header so nothing implies more than is checked.

## 2. Pack architecture

- `grimoire.srd.5.1` (2014) and `grimoire.srd.5.2.1` (2024), both signed (Ed25519, key `grimoire-2026-1`), `CC-BY-4.0`, content hash in the manifest. The 2024 pack depends on the 5.1 pack for shared equipment and monsters.
- The packs are JSON embedded in the app bundle and installed on first run; there is no remote download in the default path. They are installable, removable and verified by `officialPackService` tests.
- The catalog modules are replaced by empty ones in the app build (Metro); the guard tests (`packsOnlyBundle`, `packsOnlyRuntime`, `srdOnlyPublicExposure`) pass. Emperor Warlock and other non-SRD material ship only in separate private packs, not in either SRD pack (0 mentions in both).
- The 2024 pack has **no monsters**: a 5.5e campaign uses the 2014 SRD 5.1 stat blocks. Limitation (section 21).

## 3. Defects found and fixed in this audit

1. **A 2024 Warlock did not get its pact slots back on a short rest.** `warlock_2024` was not registered as a pact class, and a solo Warlock's slots live in `pactSlots` while the short rest only refilled `slots`. Fixed in `src/engine/rest.ts` and `src/content/classes/spellSlotTables.ts`, with a regression test in `rest.test.ts` and the harness. This was the "pact-slot short-rest regression" and would have been a **BLOCKER** for any Warlock tester.
2. **2014 spell text shown to 2024 characters.** Ruleset-less spell lookups meant the action cards of species- and feat-granted spells (Elf and Tiefling lineage spells, Magic Initiate), the Compendium spell detail, the Exploration spell list and the manual spell-source entitlement read the 2014 record. Fixed by passing the character's ruleset (`actionCards.ts`, `CompendiumSpellDetail.tsx`, `TabExploration.tsx`, `entitlements.ts`, `spellDetail.ts`). Test: `readiness2024b.test.ts`.
3. Summon Dragon material component corrected (500+ GP object), and the verifier header corrected to state exactly what it checks.

## 4. Representative characters

`readiness2024.test.ts` builds Orc Fighter (Soldier), Human Wizard (Sage) and Dragonborn Warlock (Acolyte) from the installed packs, resolves every pick, levels to 20 through 3/5/9/11/17/20, rests, saves and reloads. Invariants hold: no duplicate feature, finite AC and speed, pools refill, JSON round trip identical, shape valid, derived stats recompute equal. `readiness2024Persistence.test.ts` repeats this through the real repository layer after a simulated restart (ruleset, identity, features, choices, pools, HP, Heroic Inspiration, mastery picks, pact slots preserved).

## 5. Species, backgrounds, Origin feats

Dragonborn, Dwarf, Elf, Gnome, Goliath, Halfling, Orc, Tiefling and Human all present, with level-gated traits (Draconic Flight and Large Form at 5, lineage spells at 3 and 5), PB-scaled pools, Dwarven Toughness, size choice and the spellcasting-ability choice. Backgrounds change cleanly (old skills, tool and Origin feat with its spells removed, new ones granted). Human Versatile and Magic Initiate have tests. Limitation: species speed is a base 30 with overrides rather than a stored field.

## 6. Classes 1 to 20

All 12 classes level 1 to 20 with their SRD subclass, no stuck pick, subclass choice at level 3 only, ASI levels as the SRD (extra for Fighter at 6 and 14, Rogue at 10, Epic Boon at 19). Of the class and subclass features modelled, roughly half are fully mechanical or tracked (effects, abilities, resource pools) and the rest are text: structural (Spellcasting, Subclass markers) or table-resolved (see section 20). Full per-class counts are in `release/audit2024.json`.

## 7. Heroic Inspiration

First-class state (`Entity.heroicInspiration`), never stacks, spendable, persists, shown only for 2024 characters, granted by Human Resourceful on a long rest and not a short one. Tested.

## 8. Weapon Mastery

Capacity by level matches the SRD for Barbarian, Fighter, Paladin, Ranger, Rogue; mastery table 38 of 38; picks persist; casters and 2014 characters have none.

## 9. Spell versioning

| List | Count | Notes |
|---|---|---|
| Shared (same rules text in both editions) | 9 | True Resurrection, Magic Mouth, Magic Circle, Fabricate, Hallucinatory Terrain, Commune, Forbiddance, Planar Ally, Mirage Arcane |
| Version-specific (separate 2024 record) | 308 | 2024 characters get the 2024 record, 2014 characters the 5.1 record, 0 wrong. 272 differ in school, range, duration, components or concentration beyond formatting. |
| Unresolved | 1 | `branding_smite` (5.1 only, replaced by Shining Smite) is visible in 2024 browsing and manual-add lists because it carries no ruleset tag. It is on no 2024 class list. **POLISH.** |

2024-only spells (Divine Smite, Hex, Ray of Sickness, Summon Dragon, and others) are invisible to a 2014 provider. Feeblemind keeps its id and resolves to the 2024 Befuddlement text.

## 10. Cross-list spell picks

Blessed Warrior (Cleric cantrips), Druidic Warrior (Druid cantrips), Bard Magical Secrets (four lists from level 10, not before), Pact of the Tome (three cantrips and two level 1 rituals from any list) and Mystic Arcanum (Warlock spells of its level) all go through the real pickers and offer exactly the right lists.

## 11. Option replacement and invocation prerequisites

Fighting Style, Metamagic and Invocations carry a replace rule. Invocation prerequisites are enforced when picking and when swapping (level, a required invocation held, a prerequisite of another held invocation cannot be swapped out). The comment at the top of `warlock.ts` still says the picker does not enforce prerequisites; it is stale (**POLISH**).

## 12. Movement and auras

Ranger Roving (climb and swim equal to Speed, Speed +10), Thief climb, Monk and Barbarian speed bonuses are mechanical. Dragon Wings fly 60 is a situational effect (tracked, the player says when the wings are out). Paladin Aura of Protection adds the Charisma modifier to the Paladin's own saves; the allies' share and the aura's range are text. **TABLE-RESOLVED BY DESIGN**, as the project decided.

## 13. Rests and resources

Short and long rests, Hit Dice, pools and Pact Magic verified after fix 1. Slots by level are asserted for all caster classes.

## 14. Real-device smoke test

**Not run.** No device or emulator was attached (`adb devices` empty) and no APK was built for this audit. Everything above is Jest and script evidence. This is the main reason the verdict is not "READY FOR EXTERNAL ALPHA" without qualification.

## 15. 2014 / 2024 separation

Providers filter classes, species, backgrounds, feats and spells by ruleset in both directions; items share an id unless they differ (`<id>_2024`); conditions resolve by ruleset; 2014 characters get no mastery and no Heroic Inspiration panel. After fix 2 no remaining ruleset-less lookup affects rules text (the remaining ones read names only).

## 16. Emperor Warlock

Grimoire homebrew, not SRD 5.2.1, not tagged to any ruleset, built on 5e rules, shipped only in the private homebrew package. It has no 2024 version (no mastery or other 2024 rules) and is not claimed as 5.5e content. **TABLE-RESOLVED BY DESIGN.**

## 17. Automated results (final tree)

| Check | Result |
|---|---|
| `npx tsc --noEmit` | exit 0 |
| `npx jest` (full) | 257 suites, 3437 tests, all pass |
| 2024 tests | `readiness2024` (29), `readiness2024b` (38 at last count with all describes), `readiness2024Persistence` (3), class tests, race, background, feat, mastery, Heroic Inspiration, rulesets |
| Pack and content validation | `officialPackService`, `packSigning`, `bundledPacks`, `packsOnlyBundle`, `provenance` pass |
| Database parity | `contentDb` / native item and spell parity pass |
| `git diff --check` | exit 0 |
| `scripts/verify-srd-5-2-1.ts` | exit 1 by design: 6 residuals listed in section 1 |

## 18. Classification

**BLOCKER:** none open. (Closed this audit: Warlock pact slots on a short rest.)

**HIGH-PRIORITY LIMITATION**
- No real-device run of the 2024 flows.
- The 2024 pack has no SRD 5.2.1 monsters; a 5.5e campaign uses the 2014 stat blocks.
- Stat-block or option tables missing from five spells' text (Animate Objects, Find Steed, Giant Insect, Summon Dragon, Elementalism).

**TABLE-RESOLVED BY DESIGN:** ally half of Paladin auras and aura range; text-only features such as Evasion, Reliable Talent, Jack of All Trades, Relentless Rage and Persistent Rage; Emperor Warlock; exotic Dragon Wings timing.

**POLISH:** `branding_smite` visible in 2024 browsing; stale `warlock.ts` header comment; weapon and armor table cost/weight not machine-verified.

## 19. Remaining work, in order

1. Run the 2024 flows on a device from a fresh APK (create, level, rest, kill the app, reopen).
2. Add the five missing stat-block tables to their spells.
3. Add SRD 5.2.1 monsters to the 2024 pack, or label campaigns that use 2014 monsters.
4. Extend the verifier to weapon and armor cost, weight and damage and to species text.
5. Tag 5.1-only spells so 2024 browsing hides them.

## 20. Reproducing

```
npx tsc --noEmit
npx jest
npx tsx scripts/verify-srd-5-2-1.ts
npx tsx scripts/verify-srd-5-2-1-features.ts
npx tsx scripts/audit-caster-tables.ts
npx tsx scripts/audit-spell-versions.ts
```
(`release/srd521.txt` is produced by the first script.)

## 21. Notes on limits of this audit

Word-for-word equality of class and species text was not established, only overlap. The caster-table script reads layouts that vary by class, so four classes were read by hand. No device evidence exists.
