# Grimoire — Project Status & Direction

*Single source of truth for where the project is right now.*
*Read `PRODUCT_PRINCIPLES.md` for philosophy, `UI_RULES.md` for UI constraints,
`ROADMAP.md` for the sequenced plan, `ARCHITECTURE.md` for technical design,
`IMPLEMENTATION.md` for concrete schemas and protocols.*

*Last updated: after the engine audit / conditions-as-content / grant fixes / armor cap
/ feature hydration pass, plus the 2026-08-26 nav-crash fix / subrace & subclass
attachment session. See §3 changelog for the full list.*

---

## 1. What the app is

Grimoire is a **rules-aware tabletop RPG companion**. Its first ruleset is D&D 5e,
but the architecture treats rules as data — so the long-term shape is a platform
that runs tabletop rulesets, not a D&D-specific app.

It runs on **Android** (iOS untested), works **fully offline**, and can sync a table
over **local WiFi** (TCP, no server, no account).

Three jobs:
1. **Build characters** — guided wizard, every number computed by the engine.
2. **Play** — live sheet tracking HP, conditions, spell slots, resources, hit dice,
   death saves, with an audit trail behind every value.
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
proficiencies, and features derived automatically.

**Data-integrity guarantees (all verified):**
- Switching class clears old class skills/features/ASI stats; re-applies background skills.
- Switching background clears old background skills; applies new ones.
- Setting ability scores after an ASI is resolved re-applies the ASI (never lost).
- ASI stat bumps are stripped before class change so they don't ghost-stack.
- Racial bonuses show in the scores step as an annotation, never baked into base scores.

### Character sheet ✅ working (6 tabs)

**Combat** — HP block (damage/heal/temp/set/set-max), death saves, stat row
(AC/Speed/Init/Perc — each tappable for audit), level-up button, weapon attacks
with computed bonus, hit dice (Roll = app heals; Use = spend, player rolls), conditions
with mechanical reminders, concentration tracking, resources, spell slot pips.

**Actions** — auto-generated cards grouped into Actions / Bonus Actions / Reactions,
color-coded by purpose. Cards grey out with reason when unaffordable.

**Abilities** — effective scores (base + racial/feat bonuses, not raw base), saving
throws, passive scores, all 18 skills with proficiency dots. Tapping any value opens
the audit modal.

**Features** — features by source (Race / Class / Background / Feat). Pending Choices
section at the top: skill choices resolve inline, ASI/feat choices open the picker,
subclass choices show a "resolve with DM" note.

**Inventory** — weight bar, currency, equipped/carried with equip toggle. Equipping
armor updates AC immediately through the pipeline.

**Notes** — free text, auto-saves.

**Persistent rest bar** — Short rest (hit dice, short-rest resources) and Long rest
(full HP, all slots, full hit-dice pool, −1 exhaustion).

### Engine correctness (all verified post-audit)

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
| Subclass unlock at level 3 | ✅ Queues pending choice (resolves with DM) |
| Spell slots on level-up | ✅ Grow from PHB table automatically |
| Conditions enforce mechanical effects | ✅ Grappled/Restrained/Paralyzed/Stunned/Petrified set speed 0 |
| Equipped armor persists after restart | ✅ Hydrated in loadCharacters |

### Audit trail (tap any value)

AC, Speed, Initiative, Passive Perception, all 6 ability scores, all 6 saving throws,
all 18 skills, Spell Save DC, Spell Attack Bonus — each produces a complete breakdown
showing base + every contributor + DM override if any. All use effective stats (race
bonuses appear correctly in breakdowns).

### Leveling ✅ single-class working

In-play level-up button → engine applies new level → ASI/feat picker opens if needed.
Shared `AsiFeatPicker` used by both creation and in-play (no drift). 82 feats available.
Subclass unlock queues a visible pending choice at level 3.

### Content

| Category | Count | Status |
|---|---|---|
| Races | 9 (+subraces) | ✅ Full |
| Classes | 12 | ✅ L1–20 progressions; mid/high levels often HP-only stubs |
| Subclasses | 24 files | ⚠️ Files exist, features not authored into progressions |
| Backgrounds | 13 | ✅ Full |
| Feats | 82 | ✅ Full |
| Spells | 487 (vault) + ~181 (legacy) | ✅ Class-filtered in creation |
| Conditions | 15 | ✅ Authored as content; 5 auto-enforce speed=0 |
| Items | Weapons + armor + gear | ✅ With correct AC formulas |
| Monsters | SRD starter set | ⚠️ Partial |

### DM tools ⚠️ partial

Dashboard (live party HP/conditions/resources), monster browser, encounter screen,
per-character view, transparent overrides (✱ badge + reason in audit). Not yet a
complete end-to-end DM session flow.

### Sync ⚠️ built, untested two-device

TCP + NDJSON + event-sourcing, 6-digit room code + QR join. Only one Android device
on hand — two-device reconnect/conflict handling unverified.

### Homebrew ⚠️ built, unverified end-to-end

Spell builder (full, validates), race builder (full), class builder (full — as of
2026-08-26, per-level features carry real mechanical effect kinds, same as race
traits, not just flavor text), feature editor (partial). **New (2026-08-26): subrace
builder and subclass builder**, both attaching to ANY existing race/class — official
SRD or homebrew — not just ones the player authored themselves; see `docs/
ROADMAP_1.0.md`'s 2026-08-26 session batch for the data-model writeup. Import
pipeline (Claude parses URL → content) built but untested on real input.
**Homebrew races/classes/backgrounds still not wired into the creation wizard's own
pickers** — homebrew saves to library but doesn't appear as a selectable option there
(pre-release blocker, tracked in §4 below). Subraces and subclasses are the
exception: they DO now appear correctly in `race-detail.tsx` / `class-detail.tsx` /
`subclass-detail.tsx` once their parent is reached, since those screens read through
the merged content DB — but subclass *selection* during play is a separate, already-
tracked gap (see "Subclass features not authored" below) that predates homebrew
subclasses and isn't resolved by this addition.

---

## 3. Recent changelog (since last status update)

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

### Engine fixes

- **Armor equip now changes AC.** Root cause: `ItemInstance` stores with `features:[]`;
  `handleEquip` now hydrates features from content definition at equip time. Also fixed
  durably in `loadCharacters` so armor AC survives app restarts.
- **Speed audit was wrong for dwarves.** `buildSpeedEntries` was adding base 30 + set 25
  = 55. Rewritten: `set` operations replace the base entry; additive bonuses stack on top.
- **Race bonuses not showing in Abilities tab.** Tab was reading `entity.stats[key]`
  (base) instead of `effectiveStats[key]`. Fixed to use effective scores everywhere.
- **Race bonus missing from HP calculation.** `recalculateAllHP` and `applyHP` now both
  call `applyStatModifiers` to get effective CON.
- **ASI picker was showing base scores.** `AsiFeatPicker` now computes and displays
  effective scores; cap is enforced against effective, not base. Mountain Dwarf STR 18
  (effective 20) correctly shows 0 headroom.
- **ASI erased on score re-confirm.** `reapplyResolvedAsi` re-applies all resolved ASI
  selections after scores are overwritten. Called in `scores.tsx` on confirm.
- **Ghost ASI stats after class change.** `stripResolvedAsiStats` subtracts recorded
  increases before dropping choices; called in `clearClassData`.
- **Skills stacked on class change.** `clearClassData` now resets all skill trained flags,
  then re-applies background skills from `BG_SKILL_MAP`. Skills stacking on background
  change fixed in `selectBackground` similarly.
- **Skills page: re-entry showed "no choices."** Fixed: split into pending vs resolved
  choices; resolved state shows a read-only summary.
- **`applyGrant` proficiency case was a no-op.** Now correctly populates
  `entity.proficiencies.armor/weapons/tools/languages` from a `ProficiencyGrant` value.
- **`applyGrant` speed case was a no-op.** Now adds to `entity.resources.speed`.
- **`applyGrant` subclass_unlock was a no-op.** Now queues a pending custom choice
  that surfaces in the Features tab.
- **Medium armor DEX cap not enforced.** Added `formulaAbilityCap` field to `Effect` type;
  medium armor items carry `{ dex: 2 }`; pipeline and audit both respect the cap.
- **Conditions were hardcoded text, not engine content.** Created
  `src/content/conditions/index.ts` with all 15 PHB conditions as `Condition` objects.
  Five (Grappled, Restrained, Paralyzed, Stunned, Petrified) carry speed=0 effects.
  `applyCondition` now accepts optional features from the caller (avoiding circular dep)
  and adds them to `entity.features`; `removeCondition` already strips them by source.
  Speed audit now shows "Grappled (condition): set to 0" correctly.
- **Audit trail used base stats throughout.** `buildSaveEntries`, `buildSkillEntries`,
  `buildSpellSaveDcEntries`, `buildSpellAttackEntries`, `buildInitiativeEntries` all
  switched to `applyStatModifiers` so breakdowns show effective values.
- **AC audit inflated with both armor and Unarmored Defense formulas.** Rewritten to
  pick the winning (highest-total) formula and show only its contributions.
- **Feature hydration in UI layer only.** Moved to `loadCharacters` in `characterStore`
  so equipped items retain AC effects after every app restart, not just after fresh equip.

### Spell wiring

- **487 vault spells wired into creation.** `spells.tsx` now merges vault corpus
  (preferred) with legacy spells (fallback), filtered by `spell.classes` to show only
  the character's class.

### Documentation

Five new reference documents written to `docs/`:
- `PRODUCT_PRINCIPLES.md` — 7 governing principles in priority order.
- `UI_RULES.md` — 8 binding UI rules with forbidden word list and audit trail contract.
- `ROADMAP.md` — sequenced pre-release and post-release priorities with sizing.
- `NAVIGATION_MAP.md` — complete verified screen tree and answers to UX questions.
- `PAGE_REFERENCE.md` — detailed walkthrough of every screen and every choice.
- `QA_GUIDE.md` — step-by-step manual test procedures with exact expected values.

---

## 4. What's next (ordered)

### Pre-release (blocking)

1. **Character header: HP + AC always visible.** Hours of work, highest player impact.
   Currently AC only appears in the Combat tab's stat row.
2. **Settings screen.** Exposes `CampaignRules` (level cap, HP mode, multiclass,
   feats on/off, XP vs milestone). Required by the "table adapts to app" principle.
3. **Homebrew → creation wiring (Part A).** Custom races, spells, backgrounds, and
   features from the homebrew library appear in the creation wizard. The homebrew items
   already have the right shape — the creation wizard just needs to merge the library
   into its content sources. Part B (homebrew classes) is a separate larger project.
4. **Spellbook tab.** A seventh in-page tab (spellcasters only) for: browse by level,
   prepared/known distinction, concentration/ritual tags, Cast button that uses the same
   code path as the action card Use button.
5. **Campaign overview screen.** Between-sessions surface: session log, quest tracker,
   campaign notes, party member list. Makes the Campaigns tab useful on non-game days.
6. **Home screen campaign state.** Three states: no campaign, between sessions, live
   session. Requires #5 to have content to show.

### Post-release

- Spell selection on level-up (known/prepared count tables per class)
- Audit trail completeness gate — every number listed in `UI_RULES.md` Rule 2 must
  produce a non-empty breakdown
- Quest log and shared journal extension of #5
- Ruleset concept formalized (CampaignRules → Ruleset with name + content pack list)
- Content pack architecture
- Subclass features authored into progressions
- Attack bonuses through the pipeline (currently computed ad-hoc in TabCharacter)
- Condition advantage/disadvantage effects (currently reminder text only)
- Proficiency display on the sheet (the proficiency block is now populated correctly
  but not shown anywhere in the UI)

### Deliberately deferred

Multiclassing (identity model rewrite), cloud sync, non-D&D rulesets, generic resource
pools, full session replay. These wait for a proven second use case.

---

## 5. Known gaps (honest)

| Gap | Impact | Status |
|---|---|---|
| No Settings screen | DM can't configure rules | Pre-release blocker |
| Homebrew not wired into creation | Core differentiator incomplete | Pre-release blocker |
| No Spellbook tab | Casters manage spells across two tabs | Pre-release blocker |
| No character header AC | Players ask "what's my AC?" constantly | Pre-release blocker |
| Subclass features not authored | Level 3 subclass pick shows "resolve with DM" | Major gap |
| Many mid/high-level class entries are HP stubs | Level 6+ is mechanically thin | Major gap |
| Conditions only auto-enforce speed | Poisoned/Blinded etc. are reminders only | Known |
| Attack bonuses not in pipeline | No audit trail for attack rolls | Known |
| Two-device sync untested | Reconnect/conflict handling unverified | Known |
| Proficiency block not displayed | Populated but no UI surface | Minor |
| Feat prerequisites not enforced | Player/DM judgment only | Minor |
| No portraits/identity art | Flat character cards | Minor |
| `src/screens/` directory | Predates expo-router, dead code | Cleanup |
| No Feat or Monster homebrew builder | Every other content type (race, subrace, class, subclass, background, item, spell, generic feature) has one; feats/monsters remain static-registry-only | Known |

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
