# Grimoire — Project Status & Direction

*Single source of truth for where the project is right now. `ROADMAP.md` is
now an archival build log for the original pre-release push (June 2026) —
every item in its checklist shipped; this file is the only one that gets
kept current going forward. Read `PRODUCT_PRINCIPLES.md` for philosophy,
`UI_RULES.md` for UI constraints, `ARCHITECTURE.md` for technical design,
`IMPLEMENTATION.md` for concrete schemas and protocols.*

*Last updated: after a rating/gap-analysis pass surfaced several places
where this doc and `ROADMAP.md` had drifted out of sync with each other and
with the actual shipped code (see §3 for what was corrected), a bug-fix
batch, and a full multiclassing implementation. See §3 changelog for the
full list.*

---

## 1. What the app is

Grimoire is a **rules-aware tabletop RPG companion**. Its first ruleset is D&D 5e,
but the architecture treats rules as data — so the long-term shape is a platform
that runs tabletop rulesets, not a D&D-specific app.

It runs on **Android** (iOS untested — no device available to test on), works
**fully offline**, and can sync a table over **local WiFi** (TCP, no server,
no account).

Three jobs:
1. **Build characters** — guided wizard, every number computed by the engine.
2. **Play** — live sheet tracking HP, conditions, spell slots, resources, hit dice,
   death saves, multiclassing, with an audit trail behind every value.
3. **Run the table (DM)** — party dashboard, monster library, encounter tracker,
   transparent overrides.

### The two load-bearing ideas

**Characters and monsters are the same `Entity`**, run through one engine.
Combat logic, stat logic, and condition logic are written once.

**Every number is explainable.** The UI never computes anything — it reads
`entity.derived`. Tap any value → see base + race + class + item + condition +
DM override. This is structural: the machinery that computes a value can explain
it, because all changes flow through the Feature / Effect pipeline.

---

## 2. Current capabilities

### Character creation ✅ working

Full wizard: name & level → race (mandatory subrace where applicable) → class →
background → ability scores (standard array / point buy / manual / 4d6) → skills →
equipment → spells → review. Produces a rules-correct character with HP, AC, saves,
proficiencies, and features derived automatically. A ⚙️ settings shortcut on the
first screen reaches Campaign Settings without leaving the flow.

**Data-integrity guarantees (all verified):**
- Switching class clears old class skills/features/ASI stats; re-applies background skills.
- Switching background clears old background skills; applies new ones.
- Setting ability scores after an ASI is resolved re-applies the ASI (never lost).
- ASI stat bumps are stripped before class change so they don't ghost-stack.
- Racial bonuses show in the scores step as an annotation, never baked into base scores.

### Character sheet ✅ working (7 tabs)

**Combat** — header always shows HP/AC/Speed. HP block (damage/heal/temp/set/set-max),
death saves, stat row (AC/Speed/Init/Perc — each tappable for audit), Level Up
(single-class characters get one button; with multiclassing on, one button per
class already taken plus "+ Add a Class" — see §2's Multiclassing entry below),
weapon attacks with computed bonus (through the pipeline, audited), hit dice
(Roll = app heals; Use = spend, player rolls), conditions with mechanical
reminders, concentration tracking, resources, spell slot pips.

**Actions** — auto-generated cards grouped into Actions / Bonus Actions / Reactions,
color-coded by purpose. Cards grey out with reason when unaffordable.

**Abilities** — effective scores (base + racial/feat bonuses, not raw base), saving
throws, passive scores, all 18 skills with proficiency dots. Tapping any value opens
the audit modal.

**Features** — features by source (Race / Class / Subclass / Background / Feat).
Pending Choices section at the top: skill choices resolve inline, ASI/feat choices
open the picker, subclass choices open a real picker (applies the chosen subclass's
features immediately, for every class, and now correctly targets the right class
for a multiclassed character), infusion choices (Artificer) open a picker too.

**Items** — weight bar (effective STR, race/feat bonuses included), currency,
equipped/carried with equip toggle. Equipping armor updates AC immediately through
the pipeline. Artificer characters also get an Infusions section: learn known
infusions, apply one additively to an owned item (cap-enforced), remove it again.

**Spells** — seventh tab, only rendered for spellcasters (multiclass-aware: shows
for a character with a caster class in *any* slot, not just the primary one).
Browse by level, prepared/known distinction for prepared casters, concentration/
ritual tags, Cast button shares the same code path as the Actions tab's Use button.

**Notes** — free text, auto-saves.

**Persistent rest bar** — Short rest (hit dice, short-rest resources, and pact
spell slots for any pact-caster class present) and Long rest (full HP, all slots
including pact slots, full hit-dice pool, −1 exhaustion).

### Engine correctness (all verified)

| Value | Status |
|---|---|
| AC from armor (light/medium/heavy) | ✅ Correct formula + DEX cap enforced |
| AC from Unarmored Defense | ✅ base_ac_formula with formulaAbilities |
| Medium armor DEX cap (+2 max) | ✅ formulaAbilityCap on effect |
| Speed (race set, condition set, additive) | ✅ Resolved correctly |
| Race bonuses in HP calculation | ✅ effectiveStats.con used |
| Race bonuses on Abilities tab | ✅ effectiveStats displayed, not base |
| ASI cap vs effective score | ✅ Capped against effective, not base |
| Hit dice Roll healing | ✅ Uses effective CON (with racial bonus) |
| Retroactive CON→HP on ASI | ✅ reconcileConHp applied |
| Proficiency grants from class | ✅ Populates armor/weapons/tools/languages |
| Speed grants from class | ✅ Adds to entity.resources.speed |
| Subclass unlock | ✅ Real picker; applies chosen subclass's features immediately, all classes, multiclass-aware |
| Spell slots on level-up | ✅ Grow from PHB table automatically; combined multiclass table + separate pact slots when multiclassed |
| Attack bonuses | ✅ Computed once in the pipeline (`computeWeaponAttackBonuses`), not ad-hoc per screen |
| Conditions enforce mechanical effects | ✅ Grappled/Restrained/Paralyzed/Stunned/Petrified set speed 0 |
| Equipped armor persists after restart | ✅ Hydrated in loadCharacters |
| Carry capacity | ✅ Uses effective STR (race/feat bonuses), not raw |

### Audit trail (tap any value)

AC, Speed, Initiative, Passive Perception, all 6 ability scores, all 6 saving throws,
all 18 skills, Spell Save DC, Spell Attack Bonus — each produces a complete breakdown
showing base + every contributor + DM override if any. All use effective stats (race
bonuses appear correctly in breakdowns).

### Leveling ✅ single-class AND multiclass working

In-play level-up → engine applies new level → ASI/feat picker opens if needed.
Shared `AsiFeatPicker` used by both creation and in-play (no drift). 82 feats
available. Subclass unlock opens a real picker (`SubclassPicker`) at the class's
actual unlock level; the chosen subclass's own progression is merged in so later
level-ups keep granting its features too (`mergeSubclassIntoProgression`).

**Multiclassing** (Campaign Settings' "Multiclassing" toggle — previously present
in the UI but fully inert, now live): once on, the Level Up section shows one
button per class already taken plus "+ Add a Class." Taking a second-or-later
class grants the PHB's reduced multiclass proficiency table instead of a fresh
class's full kit, and correctly grants no bonus saving throws. Spell slots use
the combined multiclass caster table (full/half casters count toward one shared
pool) with pact-caster slots (Warlock, and the homebrew Blood Hunter Profane
Soul / Abyss Knight) tracked and recharged separately. Proficiency bonus and hit
points are correctly based on total character level. Known limitations: hit dice
from different-die-size classes are tracked as a combined count rather than an
exact mixed pool (short-rest recovery uses whichever class was most recently
leveled as the die size); there's no hard ability-score-prerequisite check
before adding a class (an advisory note only, matching how feat prerequisites
are already handled); a couple of display screens (character list, exports, DM
dashboard) still show only the primary class's label for a multiclassed
character rather than "Fighter 3 / Wizard 2."

### Content

| Category | Count | Status |
|---|---|---|
| Races | 9 base (+ subraces, ~80 total selectable options) | ✅ Full |
| Classes | 13 (12 official + Artificer; plus homebrew-registered Abyss Knight and Blood Hunter) | ✅ L1–20 progressions; mid/high levels often HP-only stubs for the base class chassis |
| Subclasses | 16 files, ~870+ individual subclass entries | ✅ Every official subclass for every class, both Artificer UA variants, all 4 Blood Hunter Orders, and a 13-subclass UA/Amonkhet sweep — real mechanical depth, not just flavor text, wherever the engine has a matching hook |
| Backgrounds | 13 | ✅ Full |
| Feats | 82 | ✅ Full |
| Spells | ~489 | ✅ Class-filtered in creation |
| Conditions | 15 | ✅ Authored as content; 5 auto-enforce speed=0, the rest are reminder text |
| Items | ~1,679 named entries | ✅ With correct AC formulas |
| Monsters | 23 SRD entries | ⚠️ Partial — the one content category noticeably thinner than the rest |

### DM tools ⚠️ partial

Dashboard (live party HP/conditions/resources), monster browser, encounter screen,
per-character view, transparent overrides (✱ badge + reason in audit). Not yet a
complete end-to-end DM session flow.

### Sync ⚠️ built, untested two-device

TCP + NDJSON + event-sourcing, 6-digit room code + QR join. Only one Android device
on hand — two-device reconnect/conflict handling unverified.

### Homebrew ✅ builders for every content type; wiring into creation and library management done

Builders exist for every content type: race, subrace, class, subclass, background,
item, spell, generic feature, feat, and monster. Class builder's per-level features
carry real mechanical effect kinds, same as race traits, not just flavor text.
Subrace and subclass builders attach to ANY existing race/class — official SRD or
homebrew. Homebrew races, classes, spells, backgrounds, and features are all wired
into the creation wizard's own pickers (not just the library). The Homebrew Library
screen has a search box and category filter chips with live counts for navigating
a growing collection. Import pipeline (Claude parses a URL → content) is built but
untested on real input.

---

## 3. Recent changelog (most recent first)

### Doc reconciliation + bug fixes + multiclassing (this session)

- **`ROADMAP.md` and this file had drifted out of sync**, in both directions:
  `ROADMAP.md`'s pre-release checklist (all 8 items, June 2026) was genuinely
  complete, but this file's §4/§5 still listed several of those exact items
  (Settings screen, Spellbook tab, character-header AC, homebrew-in-creation)
  as open blockers — stale leftover text that was never updated when they
  shipped. Separately, "No Feat or Monster homebrew builder" and "Attack
  bonuses not in pipeline" were also stale — both builders and the real
  pipeline computation already existed in the current code. All corrected in
  §2/§4/§5 below by checking the actual source, not trusting either doc.
  `ROADMAP.md` itself now points here and is kept only as a historical build
  log.
- **Subclass choice wasn't popping up on level-up** (user-reported): a
  homebrew class with an attached subclass queued a pending choice with
  `kind:'custom'`, which only ever rendered an inert "ask your DM" note —
  every OFFICIAL class already used the real `kind:'subclass'` path (which
  opens `SubclassPicker`) and was unaffected. Fixed.
- Class-selection screen's expandable dropdown now lists each class's
  subclasses (official + homebrew) inline, tapping through to the existing
  read-only preview.
- Homebrew Library gained a search box + category filter chips (live counts).
- Carry capacity was reading raw STR instead of effective STR (missed
  race/feat bonuses) — fixed.
- **Real multiclassing implemented** — see §2's Multiclassing entry for the
  user-facing summary. `Identity` gained an optional `classes[]` array (one
  entry per class taken); the existing single-class scalar fields stay as a
  kept-in-sync mirror so every pre-existing single-class code path needed no
  changes. New `levelUpClass()` engine function, multiclass-aware spell
  slots (combined table + separate pact-slot tracking), PHB reduced
  multiclass proficiencies, and a new Level Up UI. Two real latent bugs
  fixed as a byproduct (both namespacing issues that only bite once a
  second class exists): the subclass-unlock pending-choice id and a couple
  of `applyGrant` lookups were keyed off the character's primary class
  rather than whichever class was actually being leveled.

### Real subclass selection, companions, infusions, Artificer (2026-08-26, cont'd 2)

- **Subclass selection now works for real, for every class** — previously either
  missing entirely (11/12 classes) or throwing (Rogue's lone broken choice).
  Full writeup, verification notes, and the companion/infusion/Artificer work in
  `docs/ROADMAP_1.0.md`'s matching session batch.
- **Companion creatures** (Steel Defender, Eldritch Cannon) — live HP/level sync
  from the owner, own action cards, own HP/AC tracked separately.
- **Item infusions** (Artificer's Infuse Item) — learn, apply additively to an
  owned item, remove; cap-enforced by level.
- **Artificer added**: Armorer, Alchemist, Artillerist, Battle Smith (official,
  TCE/Eberron) plus Archivist (Unearthed Arcana, explicitly labeled non-official).

### Navigation & UI fixes (2026-08-26)

- **`GO_BACK was not handled by any navigator` crash fixed.** 5 creation-wizard
  screens called raw `router.back()` in a mount-time effect guard with no history
  check; `src/hooks/useSafeGoBack.ts` (already used by every homebrew builder)
  applied there and swept across 15 more latent call sites app-wide.
- **Deprecated `shadow*` style prop warning fixed** in `GlobalDiceRoller.tsx` via
  `Platform.select` (native keeps real shadow props, web gets `boxShadow`).

### Homebrew — subrace/subclass attachment (2026-08-26)

- New `app/homebrew/subrace-builder.tsx` / `app/homebrew/subclass-builder.tsx` —
  attach a homebrew subrace/subclass to any existing race/class, official or
  homebrew, via a standalone `parentId`/`classId` record rather than requiring the
  player to own/fork the whole parent.
- Class features (`CharClass.levelFeatures`) gained the same real effect-kind system
  race traits already had — see `docs/ROADMAP_1.0.md`'s 2026-08-26 session batch for
  the full writeup (data model, `getMergedContentDB()` rewrite, the `src/content/
  traitCompiler.ts` / `src/components/homebrew/TraitEditor.tsx` split that keeps
  `src/content/**` free of React/RN imports).

### Trait/effect system expansion (2026-08-26, cont'd)

- 6 new trait effect kinds (Unarmored Defense, searchable tool proficiency,
  richer limited-use abilities, movement conditions, resistance/immunity/
  vulnerability, spell granting) — full writeup in `docs/ROADMAP_1.0.md`'s
  second 2026-08-26 session batch.
- ⚠️ **Resistance/immunity are now actually functional in combat** — they
  were previously authored as data (Dwarf's poison resistance, etc.) but
  never consulted by damage application at all (`resolveResistance()` was
  dead code with a target-string bug). Fixed for both new homebrew content
  and existing official races. `HpModal`/DM QuickPanel gained an optional
  damage-type selector.
- Spell granting required real engine additions: a `cast_spell` ability
  effect, a new level-gate mechanism for race/subrace features (previously
  nonexistent — levels were silently zeroed), and an additive widening of
  `buildTraitFeature()`'s return shape.

### Pre-release push (June 2026) — complete, archived

All 8 of `ROADMAP.md`'s original pre-release priorities (character header,
class-change warning, Settings screen, homebrew-in-creation Part A, Spellbook
tab, plain-language audit view, campaign overview screen, home-screen campaign
state) shipped and were verified working — see `ROADMAP.md` for the detailed,
dated session-by-session log. A large batch of engine correctness fixes also
landed in this window (armor-equip AC, speed audit, race bonuses in HP/
Abilities/ASI picker, skill/ASI state bugs on class or background change,
several `applyGrant` no-ops, medium-armor DEX cap, conditions-as-content,
audit-trail base-vs-effective-stat bugs) — full detail also in `ROADMAP.md`.

---

## 4. What's next (ordered)

Everything that was ever tracked here as a "pre-release blocker" is done —
see §3. The list below is what actually remains, reconciled against the
current code rather than carried forward from either doc's old copy.

### User's explicit next-up order (in progress)

1. ~~Fix reported bugs~~ ✅ done, see §3.
2. ~~Multiclassing~~ ✅ done, see §3.
3. ~~Homebrew library search/filter~~ ✅ done, see §3.
4. ~~Reconcile `ROADMAP.md` and this file~~ ✅ this pass.
5. **Fill in level 6–20** for the base classes that are currently HP-only
   stubs past their early levels — the subclass depth built on top of them
   deserves a base chassis that's equally real.
6. **Spell selection on level-up** for classes with a fixed number of known
   spells (Wizard, Sorcerer, Bard, Warlock, Ranger) — currently only
   ASI/feat is handled at level-up; new spells known isn't queued at all.
7. **A real engine test suite** — currently 2 test files for a rules engine
   this load-bearing, with no CI.
8. **Grow the monster library** — 23 SRD entries is the one content
   category well behind everything else (compare ~1,679 items / 489 spells
   / 870+ subclass entries).
9. Then start on the post-release backlog below.

### Post-release backlog

- Audit trail completeness gate — every number listed in `UI_RULES.md` Rule 2
  should produce a non-empty breakdown; not yet verified for every value.
- Ruleset concept formalized (`CampaignRules` → a full `Ruleset` object with
  name + content pack list + override declarations).
- Content pack architecture — named, versioned, enable/disable packs layering
  over official content (distinct from the already-shipped `.grimoire-pack`
  cross-device homebrew *sharing* feature, which is a one-off export/import,
  not a standing enable/disable system).
- Condition advantage/disadvantage effects — only 5 of 15 conditions
  mechanically enforce anything (speed=0); the rest are reminder text.
- Proficiency display on the sheet — the proficiency block is populated
  correctly (including the new multiclass reduced-proficiency logic) but has
  no dedicated UI surface anywhere on the character sheet.
- Character Timeline — automated milestones (level-up, ASI, feat taken,
  death/revival) plus manual narrative journal entries in one chronological
  view. Not started.
- Quest log / shared session journal — partially covered already by the
  shipped Campaign overview screen (session log + quest tracker + notes +
  party list); NPC/location notes specifically are still unbuilt.
- A couple of multiclassing follow-ups (see §2): wire `formatClassLabel()`
  into the character list / export / DM dashboard screens so a multiclassed
  character shows "Fighter 3 / Wizard 2" instead of just the primary class;
  a real ability-score-prerequisite check before adding a class instead of
  an advisory note only; exact mixed hit-die pools instead of an
  approximated combined count; third-caster subclasses (Eldritch Knight,
  Arcane Trickster) contributing to the combined multiclass caster level.

### Explicitly deferred

These are understood, valued, and deliberately not being built yet:

- **Cloud sync** — local WiFi sync is sufficient for table play, and
  offline-first is a product principle. Defer until local sync is proven
  and there's a real demand signal for it.
- **Non-D&D rulesets** — the engine is generic, but content/UI/creation
  wizard are all D&D-specific today. Excellent D&D 5e first, generalize
  later based on real second-system requirements.
- **Generic resource pools replacing spell slots** — spell slots (including
  the new multiclass combined table and pact-slot split) work correctly
  today; replacing them with a generic pool abstraction is pure refactoring
  risk until a second system actually needs it.
- **Full session replay / time travel** — the event log exists; full replay
  is a debugging nicety, not a table feature.
- **Marketplace / import ecosystem** — the import pipeline (Claude parses a
  URL into content) is built but untested on real input; getting it
  reliable is the near-term goal, a sharing marketplace is much further out.

(Multiclassing was on this list as of the last update — it no longer is; see §3.)

---

## 5. Known gaps (honest, verified against current code)

| Gap | Impact | Status |
|---|---|---|
| Monster library is thin (23 SRD entries) | DMs will hit this immediately; every other content category is deep | Real gap |
| Many mid/high-level class entries are HP stubs | Level 6+ is mechanically thin on the base class chassis (subclasses layered on top are much deeper) | Real gap, next up (§4 item 5) |
| No spell selection on level-up | Known-spell casters can't gain new spells as they level | Real gap, next up (§4 item 6) |
| Near-zero test coverage, no CI | 2 test files for a load-bearing rules engine | Real gap, next up (§4 item 7) |
| Some subclass files are feature-thin | Selection works everywhere; a few subclasses have fewer authored levels than others | Minor |
| Conditions only auto-enforce speed | Poisoned/Blinded etc. are reminders only | Known, by design so far |
| Two-device sync untested | Reconnect/conflict handling unverified — only one physical device on hand | Known |
| Proficiency block not displayed anywhere in the UI | Populated correctly (incl. multiclass) but no dedicated screen surface | Minor |
| Feat prerequisites not enforced (advisory only) | Player/DM judgment only — deliberate house style, now also how multiclass ability-score prerequisites work | By design |
| The character Issue[] validator (`src/engine/validation.ts`) can't check feat prerequisites | `Feat.prerequisite` is free text ("Strength 13 or higher"), not a structured shape — nothing to compare a character's stats against without either parsing English or first migrating every feat's prerequisite into structured data | Real gap, needs a content-model change first |
| The validator can't flag "unsupported mechanic" content | No signal distinguishes "deliberately descriptive-only" (by design — Sneak Attack's scaling, weapon mastery, etc. all use this pattern on purpose) from "should have an `Effect` but doesn't." Nothing in the content model marks a feature supported/unsupported | By design elsewhere in the engine; not solvable by the validator without a human judgment call per feature |
| Pack version-mismatch not diagnosable | `InstalledPack` (`src/db/packRegistryRepo.ts`) has no per-pack content-version field — only `GrimoirePack.formatVersion`, which is the *file schema* version (already checked on import) not a per-pack semantic version like "Bestiary v1.3." No way for an author to stamp one or for the registry to remember one | Real gap, needs a registry schema change first |
| No generic "Form" (alternate-statblock) primitive | Audited: `WildShapeState` (types.ts) already IS that shape in substance — one clean override point in `recomputeDerived` (STR/DEX/CON from the beast form, INT/WIS/CHA carried through, per the book rule) plus a small separate HP/duration overlay, not scattered `if (wildShape...)` branches across multiple rules systems. Polymorph — the only other spell that would need it — is deliberately description-only, same as every complex spell effect this app doesn't auto-model, so there's no second real consumer yet to generalize for | Not a gap — verified sufficient as-is; promote only when a second real consumer (e.g. an automated Polymorph) actually needs it |
| No three-valued (true/false/unknown) predicate system | Audited: every place the engine evaluates a condition (`Effect.condition` in `pipeline.ts`) checks state the app already tracks itself (a flag, an active condition) — genuinely boolean, no "unknown" case exists. Facts the app truly can't know (battlefield position, visibility, DM judgment — the reviewer's own motivating examples) are never auto-gated on at all; they're surfaced as plain disclosed text for the player to self-resolve (e.g. Sneak Attack's A-58 trigger string), which sidesteps the true/false/unknown problem structurally rather than needing to model it | Not a gap — the app's existing "disclose, don't auto-gate" design already avoids the failure mode a `Predicate` type would fix; matches the `While(predicate)` cut already made once in the engine-hardening track |
| No general roll-modifier pipeline (reroll/minimum/replacement) | Audited real content: every reroll-shaped mechanic in the game (Great Weapon Fighting, Halfling Lucky, Portent, Reliable Talent, a dozen+ subclass features) is either already a normal player-initiated ActionCard the player resolves manually, or explicitly disclosed as "apply this manually at the table" (Reliable Talent). None need the app to auto-modify a roll it computes itself. One real, adjacent, smaller finding fixed instead: `rollWithAdvantage`/`rollWithDisadvantage` (`src/engine/dice.ts`) already existed but had zero callers anywhere — now wired into `GlobalDiceRoller` as quick-roll buttons | Not a gap for reroll/minimum/replacement — no automatable consumer found. Advantage/disadvantage rolling itself was a real, now-fixed gap (dead code, wired up) |
| Multiclass display polish incomplete | A couple of screens show only the primary class's label for a multiclassed character | Minor, see §4 |
| No portraits/identity art | Flat character cards | Minor |
| `src/screens/` directory | Predates expo-router, dead code | Cleanup |
| iOS untested | No iOS device available | Known, can't be resolved without hardware |

---

## 6. How we work

**Edit loop:** Claude edits files via Filesystem MCP → `npx tsc --noEmit` (static gate)
→ EAS cloud build (`eas build --profile preview --platform android`) for device testing.
Local `npx expo run:android` can deadlock on Windows during C++ compilation; prefer EAS
or Expo Go for iteration.

**Commit discipline:** always `npm install` → `git add -A` → `git commit` → `git push`
before triggering an EAS build. EAS runs `npm ci` which requires lock file and source
to be in sync.

**`edit_file` reliability:** always re-read the file after every edit. The read result
is ground truth; tool response is not.
