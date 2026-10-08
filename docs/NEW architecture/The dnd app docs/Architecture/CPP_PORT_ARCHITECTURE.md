# Grimoire — Full Build Architecture (for the C++ Port)

> Source-verified against the actual TypeScript codebase (not the aspirational
> docs) as of 2026-09-03. Where an existing doc (`DESIGN.md`, `IMPLEMENTATION.md`,
> `PROJECT_WALKTHROUGH.md`, `DATA_MODEL.md`) disagreed with the code, the code
> wins and the discrepancy is called out explicitly. This document is the
> single reference for porting the app to C++: it describes every subsystem,
> the exact data shapes, and the exact control flow between them.

---

## 0. What this app is

**Grimoire** is an offline-first, no-account, no-cloud D&D 5e (SRD-compatible)
companion app for React Native/Expo. Three jobs: build a rules-correct
character, run a live character sheet during play (HP/conditions/slots/dice),
and let a DM run the table (dashboard, encounter tracker, monster library,
transparent stat overrides). Its standout feature is **LAN multiplayer with
zero servers** — the DM's device runs a small TCP server on the local WiFi
network; every player's device is a client. No internet is ever required.

Two architectural invariants drive almost every design decision below, and
should drive the C++ port too:

1. **Characters and monsters are the same kind of thing.** Both are an
   `Entity` run through one rules pipeline. There is one AC formula, not two.
2. **Every derived number is explainable and never hand-entered.** The UI
   never computes a stat — it reads `entity.derived.*`, which is rebuilt from
   scratch by a single pure function after every mutation. Any number can be
   tapped to show its full contribution breakdown (race + class + items +
   conditions + DM overrides).

---

## 1. Layering rule (the most important constraint to preserve)

```
src/engine/**   — plain functions, zero framework/platform imports
src/content/**  — plain data (races/classes/spells/items/…), zero framework imports
src/store/**    — Zustand: bridges engine+content to the UI, owns persistence calls
src/db/**       — SQLite access (expo-sqlite)
src/sync/**     — TCP networking (react-native-tcp-socket)
src/io/**       — file export/import, PDF generation
src/components/, app/  — React Native UI (Expo Router)
```

`engine` and `content` are portable, unit-testable pure TypeScript with **zero
imports from React, React Native, expo-*, or the database.** This is exactly
the split a C++ port should preserve: a portable "core" library (engine +
content, no platform dependency) linked into a platform shell (SQLite access,
networking, UI, file I/O). If you only port one thing exactly, port this
boundary — everything else follows from it.

---

## 2. The data model

There is **no separate schema definition** (no protobuf/JSON-Schema/normalized
SQL). The schema *is* the TypeScript type set in `src/engine/types.ts`
(~1226 lines), enforced at compile time. Everything downstream (SQLite JSON
blobs, wire messages, backup files) is this type set serialized to JSON. For
the C++ port, `types.ts` is effectively the header file to translate first —
it is the spine the rest of the app hangs off.

### 2.1 Content types (static game data — "the rules")

```
Race        { id, name, features: Feature[], subraces?: Subrace[], resources?, age?, size?, languages?, homebrewDraft?, srd? }
Subrace     { id, name, parentId, features: Feature[], resources?, srd?, homebrewDraft? }
CharClass   { id, name, hitDie, features: Feature[] (legacy L1),
              savingThrows?, armorProfs?, weaponProfs?, toolProfs?, startingEquipment?,
              spellcastingAbility?, spellcastingAbilityOptions?, spellcastingStyle? ('full'|'half'|'pact'),
              spellcastingStartLevel?, asiLevels?, hpAbility?,
              levelFeatures?: (DraftTrait & {level})[],
              rawProgression?: ClassProgression }
Background  { id, name, features: Feature[], homebrewDraft?, srd? }
Condition   { id, name, description, features: Feature[] }
Item        { id, name, weight, cost, properties: string[], features: Feature[], homebrewDraft?, srd? }
Feat        { id, name, prerequisite: string|null, description, source, feature: Feature,
              abilityChoice?, skillChoice?, srd? }
Spell       { id, name, level(0-9+), school, castingTime, range, components, duration, description,
              upcast, ritual, concentration, classes?, spellType?, onConcentrationFeatures?, srd? }
ContentDB   { races, classes, backgrounds, spells, items, conditions, features, feats? }
```

`ContentDB.features` is always `[]` in practice — homebrew Feature objects
enter only through the homebrew merge layer, not this array.

**`srd` field, everywhere**: `undefined` = not yet legally audited = treated
as unsafe for public distribution. `true`/`false` are the result of a manual
audit against the actual SRD 5.1 (CC-BY-4.0) text — see §7 (Content Pipeline)
for the exact audit methodology. This gate is what separates the public
Play-Store build from the personal/full-content build; the C++ port needs the
equivalent build-time filter (`content.srd === true` only) if it ever ships
publicly.

### 2.2 The universal rule container: `Feature` + `Effect`

Everything mechanical — a racial trait, a class feature, an item property, a
spell's passive benefit, a condition's penalty — reduces to a `Feature`
carrying `Effect[]`. **The engine never branches on a race/class/spell name.**
All such logic lives in content data, not in engine code (this is enforced as
an explicit invariant in the current codebase and must be preserved).

```ts
Effect = {
  type: 'stat_modifier' | 'grant_proficiency' | 'grant_resistance' | 'grant_immunity'
      | 'apply_condition' | 'grant_resource' | 'override_rule' | 'base_ac_formula'
      | 'suppress_condition_effects' | 'condition_immunity'
      | 'grant_spell' | 'grant_sense' | 'grant_movement',
  target: string,          // 'str' | 'ac' | 'speed' | 'skill:perception' | 'tool:thieves_tools' | damage type, etc.
  operation: 'add' | 'multiply' | 'set' | 'advantage' | 'disadvantage'
           | 'resistance' | 'immunity' | 'vulnerability' | 'suppress',
  value: number | string | string[] | null,
  condition: string | null,      // gates on a runtime flag or active-condition id
  formulaAbilities?: Ability[],       // base_ac_formula: which mods to add (e.g. ['dex','con'])
  formulaAbilityCap?: Partial<Record<Ability, number>>,  // per-ability cap, e.g. medium armor DEX+2
  // grant_spell: cantripIds?, spellIds?, spellcastingAbility?
  // grant_sense: senseType?, senseRange?, senseNote?
  // grant_movement: movementType?, movementRange?
}

Feature = {
  id, name, description, source: { kind: 'race'|'class'|'subclass'|'background'|'feat'|'item'|'spell'|'condition'|'campaign', refId },
  level: number|null, effects: Effect[], actions: Action[], choices: ChoiceDefinition[], passive: boolean,
  // active-ability fields (absent ⇒ passive, no action card generated):
  activation?: FeatureActivation, tags?: ActionCardTag[], abilityEffects?: AbilityEffect[],
  explorationTag?: boolean,
}
FeatureInstance = Feature & { isActive: boolean }   // as stored on an Entity
```

Two **separate** effect systems exist and must stay separate in the port:
- **Passive `Effect[]`** — fire inside `recomputeDerived()` every time it runs. Never contain dice/combat resolution.
- **Active `AbilityEffect[]`** — fire only when a player taps a card's "Use" button, via `applyAbilityEffects()`. Types: `damage`, `heal`, `apply_condition`, `remove_condition`, `grant_speed`, `transform`, `set_flag`, `spend_resource`, `restore_resource`, `cast_spell`. **`damage`/`heal` are deliberately never auto-resolved** — the app shows the dice expression and the resource is spent, but the player rolls physical dice and announces the result (a stated design choice, not a missing feature). Only `set_flag` and `transform` are currently wired to actually mutate state on use (see §3.5) — `apply_condition`/`remove_condition`/`grant_speed`/`restore_resource`/`spend_resource`-beyond-base-cost are defined in the type system but not yet implemented in `applyAbilityEffects()`. **A C++ port should either implement the full set or explicitly document the same gap — don't silently claim more is wired than is.**

### 2.3 The runtime object: `Entity`

The single object type for player characters, monsters, and NPCs.

```ts
Entity = {
  id, kind: 'character'|'monster'|'npc',
  identity: { name, level, raceId, subRaceId, classId, subclassId, backgroundId,
              alignment, xp, companionOf?: string|null },
  stats: AbilityScores,              // { str,dex,con,int,wis,cha: number } — BASE scores only
  derived: DerivedStats,             // NEVER set manually — always fully recomputed
  skills: { skills: Record<SkillName, {ability, trained, expertise, bonus:number|null}> },
  proficiencies: { armor[], weapons[], tools[], languages[], savingThrows: Ability[] },
  resources: { hp:{current,maximum,temp}, hitDice:{die,total,remaining}, speed, ac,
               custom: CustomResource[], deathSaves:{successes,failures,stable} },
  spellcasting: { ability, slots: Record<'1'..'9',{total,used}>, cantrips[], known[], prepared[], concentrating } | null,
  inventory: { equipped: ItemInstance[], carried: ItemInstance[], currency:{pp,gp,ep,sp,cp} },
  conditions: ActiveCondition[],             // flat list, for UI
  conditionMonitor: { active: ActiveCondition[], exhaustion:0-6, flags: Record<string,boolean> },
  features: FeatureInstance[],
  choices: ChoiceState[],                    // unresolved/resolved player decisions
  dmOverrides: DmOverride[],                 // always [] for new entities
  wildShapeState: WildShapeState | null,
  notes: string,                             // JSON-encoded {backstory, sessionNotes, personalNotes}
  knownInfusionIds?: string[],
}
```

`DerivedStats` (the ONLY output of the pipeline, rebuilt from scratch every
call — never patched incrementally):
```ts
DerivedStats = {
  proficiencyBonus, ac, initiative, speed,
  passivePerception, passiveInvestigation, passiveInsight,
  senses: Sense[], movement: MovementSpeeds,
  savingThrows: Record<Ability, number>,
  attackBonuses: AttackBonus[],   // currently always []
  spellSaveDC: number|null, spellAttackBonus: number|null,
  advantageStates: { target: string; state: 'advantage'|'disadvantage' }[],
}
```

`makeEmptyEntity(id, kind)` (in `characterStore.ts`) is the **only** valid
from-scratch constructor — a C++ port should have exactly one equivalent
factory function, not scattered struct literals, to guarantee every field
starts in a known-valid state.

### 2.4 Leveling-time schemas (distinct from runtime Effects)

```ts
ClassProgression = { classId, entries: LevelEntry[], hpAbility?, srd? }
LevelEntry        = { level, grants: Grant[], choices: ChoiceDefinition[], hpDie: 4|6|8|10|12 }
Grant             = { kind: 'feature'|'resource'|'resource_upgrade'|'spell_slots'|'proficiency'
                          |'speed'|'subclass_unlock'|'init_spellcasting'|'known_spells'|'starting_item',
                       value: unknown }   // interpreted per-kind by leveling.ts's applyGrant()
ChoiceDefinition  = { id, prompt, kind: 'skill'|'spell'|'language'|'tool'|'equipment'|'feat'|'asi'
                          |'custom'|'spellcasting_ability'|'subclass'|'infusion',
                       count, pool: ChoiceOption[]|'all'|FilterExpression, grants: Grant[],
                       required, resolved }
```

A class hands out `Grant`s at each level; `applyGrant()` interprets
`grant.value` differently per `kind`. This is a second, distinct "effect
system" from passive `Effect`/active `AbilityEffect` — don't conflate the
three when porting: **Effect** = what a granted Feature *does* continuously,
**AbilityEffect** = what happens on card-use, **Grant** = what leveling-up
*hands out* once.

### 2.5 DM Overrides and Wild Shape — the "apply on top, never mutate" pattern

Both follow the identical non-destructive philosophy, worth preserving as a
named pattern in the C++ port:

- **DM Override** (`dmOverrides: DmOverride[]`) — applied strictly LAST in
  `recomputeDerived()`, after every feature/item/condition. Never touches
  `entity.stats`/`entity.features`. Cancelling sets `active:false`; the value
  reverts automatically on the next recompute — no need to "undo" anything.
  Target is restricted to scalar `DerivedStats` fields (`DERIVED_NUMERIC_KEYS`)
  or `savingThrows.<ability>`; unknown targets are silently rejected with a
  warning, not applied.
- **Wild Shape** (`wildShapeState: WildShapeState|null`) — same idea: while
  active, `recomputeDerived` swaps STR/DEX/CON, AC, speed, senses, and
  movement to the beast form's values (INT/WIS/CHA and class features are
  kept per the book rule "you retain your own Intelligence, Wisdom, Charisma"),
  and the beast's own HP pool is tracked separately in `wildShapeState.beastHp`
  — the player's real `resources.hp` is never touched and resumes exactly
  where it was on revert. A known, documented approximation: there's no
  hour-by-hour game clock anywhere in the app, so Wild Shape's duration
  auto-reverts on any rest instead of ticking down in real time — a
  deliberate scope cut, not a bug.
- **Companion** (`identity.companionOf`) syncs a subset of its stats (HP max,
  sometimes a borrowed ability modifier) from its owner's *current* level and
  stats every time it's read, not baked once at spawn — same "recompute
  fresh, never freeze a snapshot" philosophy.

---

## 3. The rules engine (`src/engine/*.ts`)

Pure, synchronous, framework-free TypeScript. Every function takes an
`Entity` (+ `CampaignRules`) and returns a **new** `Entity` (immutable
update, always via spread — never in-place mutation). This immutable-update
discipline is what makes the whole system easy to reason about and safe to
sync/undo; preserve it in C++ via value semantics or explicit copy-on-write,
not shared mutable state.

### 3.1 `pipeline.ts` — `recomputeDerived()`, the single source of truth

Call this after **every** mutation. It is intentionally cheap (no caching —
correctness over micro-optimization). Fixed priority order (last wins):

```
base stats
  → collectAllEffects() — gather every active passive Effect from features,
    equipped items, and condition-sourced features (skips effects gated on
    an inactive flag/condition, and effects suppressed by e.g. Blindsight
    silencing Blinded without removing the condition)
  → applyStatModifiers() — race/feat stat_modifier effects fold into
    "effectiveStats" (used everywhere downstream: AC, saves, skills, HP)
  → Wild Shape stat substitution (STR/DEX/CON only) if transformed
  → grant_proficiency effects applied to the skill block (skills + tools)
  → AC: base_ac_formula effects (Unarmored Defense etc., MAX of all
    candidates) → else entity.resources.ac (armor equipped) → else 10+DEX;
    then a separate flat AC-bonus pass for shields/magic items (explicitly
    excludes base_ac_formula effects from double-counting — this exact bug
    happened once and is the reason for the exclusion, see §9)
  → speed: respects 'set' operations (Dwarf/Halfling/Gnome 25ft) vs 'add'
  → senses/movement: aggregate grant_sense/grant_movement, keep the LARGEST
    value per type (not sum)
  → advantage/disadvantage: binary collapse — if both present for the same
    target they neutralize to "straight", never partially cancel
  → saves, skills, passive Perception/Investigation/Insight, spell DC/attack
  → DM overrides — applied absolutely last, win over everything
```

`modifier(score) = floor((score-10)/2)` — the one formula every derived stat
ultimately runs through.

### 3.2 `resolver.ts` — the 5 effect-stacking strategies

Multiple effects can target the same stat; `resolveEffectsForTarget()`
classifies the target and dispatches to one of:

1. **combine** (default) — `set` operations establish a base (last one wins),
   then all `add`/`multiply` stack on top. Used for AC, ability scores,
   speed, spell DC, etc.
2. **same-name dedup** — group by source name, keep only the single highest
   value per name (e.g. two castings of "Bless" don't stack).
3. **binary collapse** — advantage/disadvantage: both present → straight.
4. **choose-max** — e.g. temp HP: keep the higher pool, don't add.
5. **base-formula exclusion** — AC formulas set a base, never a bonus.

Also here: `resolveResistance(damageType, effects)` → `none|resistance|
immunity|vulnerability`, with immunity overriding everything and
resistance+vulnerability on the same type neutralizing to `none`.

### 3.3 `leveling.ts`

- `applyGrant(entity, grant, atLevel)` — the interpreter for every `Grant.kind`
  (feature, resource, resource_upgrade, proficiency, subclass_unlock, speed,
  init_spellcasting, spell_slots, known_spells, starting_item). Notably,
  `spell_slots` always **zeroes all 9 tiers then reapplies the row** — this
  is what makes pact-magic tier upgrades correct (Warlock-style classes
  replace lower tiers with higher ones, not append).
- `applyHP` / `recalculateAllHP` — level-1 always max die; levels 2+ use
  `rolled|fixed|max` per `CampaignRules.hpMode`, each `max(1, roll+abilityMod)`.
- `reconcileConHp(prev, next)` — PHB rule: a CON modifier change retroactively
  adjusts max HP by `Δmod × level`, applied without re-rolling history.
- `applyAsiToEntity` / `applyFeatToEntity` — ASI increases are capped against
  **effective** (not base) scores so racial bonuses correctly consume headroom
  toward the campaign's max-score rule.
- `reapplyResolvedAsi` / `stripResolvedAsiStats` — defensive re-derivation
  functions that exist specifically because the ability-scores screen
  overwrites base stats wholesale; without them, re-confirming scores after
  an ASI silently erased the increase (a real bug fixed this way).
- `levelUp(entity, targetLevel, progression, rules)` — loops every level from
  current+1 to target, applying HP, grants, choices (auto-resolving trivial
  ones, queuing the rest as pending `ChoiceState`), refreshing spell slots
  from the level-appropriate PHB table every level (not just where a class
  explicitly grants slots — otherwise a caster leveled 1→5 in one jump would
  be stuck on level-1 slots).
- `resolveChoice` / `applySubclassToEntity` / `applyInfusionChoiceToEntity` —
  resolve a pending `ChoiceState` by id, applying its grants and recomputing.

### 3.4 `combat.ts`

- **Initiative**: `startEncounter()` rolls d20+DEXmod per entity, sorts
  descending, DEX mod as tiebreaker.
- **Turn loop**: `endTurn()` ticks round-based durations on the acting
  entity, advances the turn pointer, increments round on wraparound, resets
  `hasTakenTurn` flags each new round.
- **Concentration**: `castConcentrationSpell` auto-drops any prior
  concentration first (the "Hex → Fly" scenario). `concentrationCheck(entity,
  damageTaken)` — DC = `max(10, floor(damage/2))`, rolls the pipeline-computed
  CON save (so proficiency/race bonuses are included), doubles the roll (best
  of two) if the entity has the War Caster feat feature.
- **Damage/healing**: `applyDamage` absorbs into temp HP first, applies
  resistance/immunity/vulnerability if a damage type is given, tracks death
  saves (dropping to 0 fresh resets the count; taking further damage at 0 is
  one automatic failure; a `deathSavesPersist` house rule can carry failures
  across dying episodes instead of resetting). `applyHealing` clears death
  saves on any healing above 0. `recordDeathSave` — 3 successes → stable, 3
  failures → dead (no separate "dead" flag — UI infers it from failures===3).
- **Wild Shape**: `startWildShape`/`endWildShape`/`applyWildShapeDamage` — see
  §2.5. Beast HP hitting 0 force-reverts immediately with no carryover damage
  to the player's real HP (book rule).
- **`applyAbilityEffects(entity, effects)`** — the dispatcher for active
  `AbilityEffect[]` on card-use. **Currently only `set_flag` and `transform`
  are implemented**; this was the site of a real, previously-shipped bug (see
  §9) and is the highest-value function to get exactly right in the port.

### 3.5 `rest.ts`

- **Short rest**: recharges resources tagged `short_rest`/`long_rest`; only
  Warlocks (pact magic) recover spell slots; HP recovery is a separate
  player-initiated action (`spendHitDie`/`discardHitDie`).
- **Long rest**: HP to max + temp cleared, all custom resources recharged,
  hit dice restored by half-level-rounded-up-min-1 (or fully, under the
  `fullHitDiceOnLongRest` house rule), all spell slots restored, concentration
  dropped, `until_rest` conditions removed, exhaustion reduced by 1.
- `spendHitDie` rolls the die + effective CON mod (min 1 heal); `discardHitDie`
  just decrements the pool with no roll (for when the player rolls physical
  dice themselves).

### 3.6 `conditions.ts`

- Immunity checked before anything else (`condition_immunity` effect blocks
  application outright). Exhaustion is a numeric level (0–6), not a discrete
  condition entry, incremented separately.
- **Suppression** (`suppressedBy`): a condition can remain active while its
  *effects* are silenced by another feature (Blindsight silences Blinded's
  attack penalty without removing the Blinded condition itself) —
  `refreshSuppressors()` rebuilds this list whenever features change.
- `tickDurations` decrements round-based durations at end-of-turn, dropping
  conditions that reach 0.
- Runtime boolean `flags` (`conditionMonitor.flags`) are the general-purpose
  mechanism for toggled abilities like `rage_active`/`concentrating` — passive
  `Effect.condition` fields gate on these flags in `collectAllEffects()`.

### 3.7 `actionCards.ts` — the "Use" card generator

Turns a `Feature` (if it has `activation`) or a known/prepared spell into a
tappable `ActionCard` with 3 text layers:
- Layer 1: source+type, e.g. `"Lv 3 Spell • Damage"`.
- Layer 2: mechanical summary, e.g. `"8d6 Fire • 20 ft radius"` — includes
  computed weapon to-hit/damage bonus for item-sourced weapon attacks
  (finesse picks the higher of STR/DEX; ranged always DEX), and applies the
  `largeCreatureWeaponDice` house rule by doubling dice **only** for weapon
  (item-sourced) attacks, never spells/features.
- Layer 3: save/concentration/duration note, e.g. `"Dex Save (half)"`.

Also computes live `available`/`unavailableReason` by checking resource pools
and spell-slot tiers. `classifyFeature`/`classifySpell` infer a card
type/color (damage=red, healing=green, control=purple, buff=blue,
transformation=purple, utility=gray) from tags → abilityEffects → passive
effects → activation type, in that priority order.

### 3.8 `dmOverride.ts`, `houseRules.ts`, `audit.ts`, `dice.ts`, `featPrereq.ts`

- **`dmOverride.ts`** — apply/cancel/expire overrides (see §2.5). `expireOverrides`
  is called on `'end_of_encounter'` (DM ends combat) or `'end_of_session'`
  (long rest); `'manual'` overrides never auto-expire.
- **`houseRules.ts`** — a typed accessor layer over
  `CampaignRules.customRules: Record<string,unknown>`. ~25 rules across 7
  sections (Character Build, Combat, Resting, Death & Recovery, DM
  Visibility, Monster Info, Homebrew, Table Reminders), each with a `kind`
  (boolean/choice/number), a book default, and — critically — a
  `reminderOnly` flag for rules the app **cannot mechanically enforce** (e.g.
  "potions cost a bonus action") and only surfaces as a table note. **This
  reminder-only/enforced distinction is a real product-quality invariant**
  (documented as "no fake functionality" in the walkthrough doc) — the C++
  port should keep a rule from ever silently claiming automation it doesn't
  provide.
- **`audit.ts`** — `explainValue(entity, stat)` rebuilds the full contribution
  breakdown for any stat (ability score, save, skill, or scalar derived
  stat) as an ordered list of `{label, value, sourceKind, sourceId}` entries,
  by literally re-deriving the value from the same effect-collection logic
  the pipeline uses — **not** by reading `entity.derived` and reverse
  engineering it, so a real double-count bug shows up as wrong math in the
  audit trail too, rather than being hidden.
- **`dice.ts`** — dice notation parser/roller: `NdM`, `NdM±K`, `NdMkh K`/`kl K`
  (keep highest/lowest — ability-score rolling), flat numbers. All randomness
  routes through a single replaceable `randomSource` function (seedable for
  tests) — preserve this seam in C++ for deterministic testing.
- **`featPrereq.ts`** — a deliberately conservative free-text prerequisite
  parser (ability minimums, spellcasting, armor/weapon proficiency, race,
  level/feature gates). When it can't confidently parse a prerequisite it
  returns `needsManualCheck:true` rather than silently blocking or silently
  allowing.

### 3.9 `monsterFactory.ts`, `companion.ts`

- `spawnMonster(template, rules)` builds a monster `Entity` from a
  `MonsterTemplate` via `makeEmptyEntity()` + spreads — the same constructor
  every other Entity uses, then rolls/averages HP per `rules.hpMode` and
  marks every template feature active.
- Companions (Artificer's Steel Defender etc.) are ordinary `kind:'monster'`
  Entities linked via `identity.companionOf`, with `syncCompanionFromOwner`
  re-deriving owner-dependent fields (HP max, a borrowed ability modifier)
  fresh on every read — never a frozen spawn-time snapshot.

---

## 4. Content system (`src/content/*`)

### 4.1 Static content — what's hand-authored vs. generated

| Category                                                                                                | Authoring                                                     | Notes                                      |
| ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- | ------------------------------------------ |
| classes, subclasses, races, backgrounds, feats, conditions, monsters, beastforms, companions, infusions | 100% hand-authored TS                                         | Full L1–20 progressions for 12 PHB classes |
| spells                                                                                                  | Mixed: ~86 hand-authored + 487 auto-imported (`generated.ts`) | See §7                                     |
| items                                                                                                   | Mixed: ~90 hand-authored + auto-imported (`importedItems.ts`) | See §7                                     |

`globalContentDB` (`src/content/classes/library.ts`) is a **static, in-memory,
module-level singleton** assembled purely from bundled TS arrays — there is
no runtime content loading, no remote fetch, nothing lazy beyond normal JS
module evaluation. `ContentRegistry.ts` adds memoized `getAll()`/`getById()`
Map-based lookups on top for O(1) id lookups over the ~1300+ combined
items/spells. **For the C++ port this maps cleanly to a compiled-in data
table (or a data file loaded once at startup) plus a hash map index — no
database needed for official content.**

### 4.2 Collision rule between hand-authored and auto-imported content

**Items** (clean, explicit, in `src/content/items/index.ts`):
```
FULL_ITEM_LIBRARY = [...CORE_ITEMS, ...IMPORTED_ITEMS.filter(i => !CORE_IDS.has(i.id))]
```
Hand-authored always wins on id collision — imported duplicates are dropped
*before* concatenation. This is confirmed as deliberate on both sides (the
Python generator script's own docstring says the same thing).

**Spells** (inconsistent — flag for cleanup during the port, don't blindly
copy): the array is a plain concatenation with **no dedup step**. A
`Map`-based lookup (`ContentRegistry`) ends up with vault spells winning on
collision (last-in-wins); a linear `.find()` scan elsewhere would find the
hand-authored entry first. **Recommendation for the C++ port: normalize this
to the same explicit filter-then-concat pattern items already use, rather
than reproducing the ambiguity.**

### 4.3 Homebrew: user-authored content, layered on top

Two tiers of homebrew, both surfaced identically to the player:
- **"Built-in homebrew"** (`src/content/builtinHomebrew.ts`) — TS-authored
  content (Abyss Knight class, Skeleton race) deliberately kept *out* of the
  official arrays and injected only in-memory at load time by the homebrew
  store, filtered against a user-deletion list. **Not actually seeded into
  SQLite** despite a stale comment in the source claiming otherwise — verify
  actual behavior over doc comments when porting this specific piece.
- **User-authored homebrew** — created via 8 guided builder screens
  (`app/homebrew/*-builder.tsx`), persisted as rows in the `content_cache`
  SQLite table (see §5.3), merged with official content at query time via
  `getMergedContentDB()` (plain array concatenation per content type).

### 4.4 The trait compiler — homebrew authoring's shared core

`src/content/traitCompiler.ts` is deliberately UI-free plain TypeScript (so
the content-layer `progressions.ts` can call it without depending on React).
It compiles an author-time `DraftTrait` (one field set per possible mechanic:
ability score, unarmored defense, skill/tool proficiency, advantage/
disadvantage, sense, movement, movement-condition, damage resistance/
immunity/vulnerability, spell grant, resource ability) into a real `Feature`
(+ optional `ResourceGrant`). The React builder screens
(`src/components/homebrew/TraitEditor.tsx`) are a thin UI layer on top that
re-exports and calls this same compiler — meaning the *exact same compiler*
is reused by both the runtime homebrew editor and
`src/content/classes/progressions.ts`'s `buildProgressionFromClass()` for
simplified homebrew-class per-level features. **Port this as one shared
"compile an authoring-time draft into a real Feature" function, callable from
both an editor UI and a batch content-build tool — not two divergent
implementations.**

### 4.5 Class progression compilation (`progressions.ts`)

`getProgressionForClass(cls)` priority: (1) `cls.rawProgression` if hand-
authored in full, (2) the officially registered `ClassProgression` for
that class id, (3) else synthesize one from the class's simplified fields
via `buildProgressionFromClass()` (ASI levels, spellcasting slot table by
style, starting proficiencies/equipment, and per-level `DraftTrait`s compiled
through `traitCompiler.ts`). `mergeSubclassIntoProgression()` merges a
subclass's own `ClassProgression.entries` into the base class's by level
(concatenating grants/choices, not replacing).

---

## 5. Persistence (`src/db/*` — SQLite via expo-sqlite)

### 5.1 Physical schema — 6 tables, deliberately denormalized

```sql
CREATE TABLE entities (
  id TEXT PRIMARY KEY, kind TEXT DEFAULT 'character',   -- 'character'|'monster'|'npc'
  data TEXT NOT NULL,                                    -- JSON.stringify(Entity)
  updatedAt INTEGER NOT NULL                              -- Date.now() ms, set on every save
);
CREATE TABLE campaigns (
  id TEXT PRIMARY KEY, data TEXT NOT NULL,                -- JSON.stringify(Campaign)
  updatedAt INTEGER NOT NULL
);
CREATE TABLE sync_events (                                 -- offline mutation queue
  id TEXT PRIMARY KEY, sessionId TEXT, entityId TEXT, changeType TEXT,
  payload TEXT,                                            -- JSON, shape depends on changeType
  authorDeviceId TEXT, timestamp INTEGER, applied INTEGER DEFAULT 0
);
CREATE TABLE device_session (            -- singleton row, id always = 1
  id INTEGER PRIMARY KEY DEFAULT 1, deviceId TEXT, nickname TEXT DEFAULT '',
  role TEXT DEFAULT 'player', campaignId TEXT
);
CREATE TABLE content_cache (              -- homebrew content of every kind, one table
  id TEXT PRIMARY KEY,                    -- composite key: "<type>:<content.id>"
  type TEXT, data TEXT, version TEXT DEFAULT '1'   -- version is a dead field, always "1"
);
CREATE TABLE combat_state (               -- singleton row, id always = 1
  id INTEGER PRIMARY KEY DEFAULT 1, data TEXT NOT NULL, updatedAt INTEGER NOT NULL
);
CREATE TABLE app_meta (key TEXT PRIMARY KEY, value TEXT);  -- generic KV; only real key today: 'deleted_builtin_ids'
CREATE INDEX idx_entities_kind ON entities(kind);
CREATE INDEX idx_sync_events_applied ON sync_events(applied, sessionId);
CREATE INDEX idx_content_type ON content_cache(type);
```

Design principle stated in the source: **the database never holds mechanical
truth.** Everything loaded from disk is re-run through `recomputeDerived()`
before use, so a stale stored `derived` block can never desync from the
rules. Only columns that appear in a `WHERE` clause are real SQL columns;
everything else is an opaque JSON blob. This is the single biggest structural
decision to either preserve or deliberately replace in the C++ port — it
trades normalization for "never write a migration when the domain type grows
a field," which was true and load-bearing during this app's development
(death saves, Wild Shape state, etc. were all added to `Entity` mid-project
with zero schema changes).

### 5.2 Repo pattern (uniform across all 7 repo files)

- Every function starts with a `Platform.OS === 'web'` guard → no-op (SQLite
  isn't available on web) — irrelevant for a native C++ port.
- All writes are `INSERT ... ON CONFLICT(pk) DO UPDATE SET ...` (upsert),
  never `INSERT OR REPLACE` — so untouched columns survive.
- **No repo function wraps its own SQL in a transaction** — the only
  transaction anywhere in the DB layer is the one-time schema bootstrap.
  Multi-row/multi-step flows (e.g. import) are not atomic against a crash
  partway through.
- `updatedAt`/`timestamp` columns are always stamped with wall-clock
  `Date.now()` **inside the repo function**, never trusted from the caller.
- Error handling is inconsistent: most propagate; `combatRepo.ts` wraps in
  try/catch and swallows (so a corrupted combat blob degrades to "no active
  combat" instead of crashing on boot); `entityRepo.loadAllEntityMeta` guards
  per-row so one bad JSON blob doesn't break the whole character list.

Key functions per repo (exact SQL is in the doc comments above per-table, but
functionally): `entityRepo` (save/load/loadAll/loadByKind/loadAllMeta/delete),
`campaignRepo` (save/load/loadAll/delete), `contentCacheRepo`
(saveHomebrewContent/loadByType/loadAll/delete — composite `type:id` key),
`appMetaRepo` (get/set, generic string KV), `sessionRepo`
(generateDeviceId/getOrCreateSession/updateSession — device identity is
dual-persisted: SecureStore/platform-keychain for the canonical id, mirrored
into SQLite for fast reads; `deviceId` is immutable after creation, enforced
only at the type level, not by a DB constraint), `combatRepo`
(save/load/clear, defensive try/catch), `syncRepo` (queue/getUnflushed
[ordered by `timestamp ASC`]/markApplied/markAllApplied/pruneApplied — the
offline replay queue described in §8).

### 5.3 Content cache vs. static content — the two-tier model

Static/official content (`src/content/**`) never touches SQLite — it's
compiled into the app. Homebrew content lives in `content_cache`, keyed by a
synthesized `"<type>:<id>"` primary key so one table serves 8 different
content kinds (`race|subrace|class|subclass|spell|background|feature|item`)
without collision. The app merges the two tiers at read time
(`getMergedContentDB()`), never writing static content into the cache table.
**Port this as: a compiled/static content table + a separate mutable
homebrew table (SQLite or equivalent embedded DB) unioned at query time.**

---

## 6. State layer (`src/store/*` — Zustand)

This is the layer a C++ port's UI-state/viewmodel layer should mirror most
directly; it's the seam between the pure engine and the platform UI.

**Pattern, uniform across every store**: an action calls the synchronous
in-memory state update first (instant UI feedback), then fires an async
persistence write as an unawaited side effect (fire-and-forget, errors only
logged) — there is no "saving…" UI state anywhere. `updateCharacter(id,
updater)` (the core mutation entry point) captures `previous`/`next`,
updates Zustand state, then separately calls `saveEntity(next)` (SQLite) and
`syncManager.syncEntityPatch(id, previous, next)` (LAN broadcast of only the
diff) — both async, both non-blocking. **`recomputeDerived` is NOT inside
`updateCharacter` itself** — the caller's `updater` function is responsible
for calling it; in practice every call site wraps its update in a `mutate()`
helper that does `recomputeDerived(updater(entity), rules)`. A C++ port
should decide explicitly whether to centralize this (safer) or keep it
caller-responsibility (matches current behavior) — worth fixing during the
port rather than reproducing the "easy to forget" footgun.

Stores: `characterStore` (characters[], draft, rules, the mutation/sync
entry points, `makeEmptyEntity`), `campaignStore` (campaigns[],
activeCampaign, isDm flag derived from device identity, create/join/leave/
resumeSync — this is what starts/stops the TCP server or client), `combatStore`
(active encounter state, wraps `startEncounter`/`endTurn`/`endEncounter`),
`homebrewStore` (per-type homebrew arrays, built-in injection, merge with
static content), `sessionStore` (device identity: id/nickname/role), `syncStore`
(live connection status for UI), `diceLogStore` (shared roll history, capped
at 20, feeds a floating dice-roller widget from anywhere in the app).

**A documented, real footgun worth avoiding by construction in C++**: a
Zustand selector that returns a **new object/array literal every render**
breaks React's change-detection and infinite-loops. The fix pattern
enforced everywhere in this codebase: select a stable primitive or function
reference, never an inline `.map()`/`.find()`/object-literal inside a
selector. Not directly relevant to C++, but the underlying lesson —
"never return a value from your state-read path whose identity changes
every read even when the underlying data hasn't" — is worth keeping in mind
for whatever reactive/observer pattern the C++ UI layer uses.

---

## 7. Content pipeline & the SRD legal-content audit

Two **offline, build-time** Node/Python scripts convert a personal Obsidian
markdown vault into typed content — they never run inside the shipped app.

- **`scripts/convert-spells.mjs`** — parses `Cantrips.md`/`Level N Spells.md`
  into `Spell[]`, regex-extracting casting time/range/components/duration/
  classes/upcast text, slugifying names into ids. Outputs
  `src/content/spells/generated.ts` (the data, no `srd` field) **and a
  separate** `srdClassification.json` (id→boolean), deliberately split so a
  classification-only rerun leaves the large generated file byte-identical.
  Refuses to overwrite if the new parse count is <50% of the previous file's
  count (a guard against silently wiping content if the source path moved).
- **`scripts/parse_items.py`** — same shape for items: weapons get an
  attack `Feature` + `activation` block, armor gets a `base_ac_formula`
  effect, everything else a passive descriptive feature; also strips
  trademarked "D&D"/"Dungeons & Dragons" mentions from descriptions for
  storefront policy compliance.

**SRD classification methodology (both scripts, identical 3-tier logic)**:
1. **DENY** — explicit deny-name lists (confirmed non-SRD, book-cited in
   comments) + a Product-Identity name regex (Tasha, Melf, Bigby, Mordenkainen,
   Otiluke, etc.) → `srd: false`.
2. **ALLOW** — explicit allow-name lists, built by *directly reading the
   actual SRD 5.1 text* rather than assuming a pattern — the project's own
   postmortem calls out getting burned once by assuming "generous inclusion"
   held for feats/backgrounds the way it did for spells/classes/races, when
   the real SRD only includes one sample feat (Grappler) and one sample
   background (Acolyte). **Lesson for the port: verify SRD inclusion per
   content category independently — don't extrapolate from 2–3 categories.**
3. **Everything else** → `undefined`/omitted, which the type system treats as
   unsafe-by-default.

A single build flag (`EXPO_PUBLIC_SRD_ONLY`, set only on the production EAS
build profile) filters every content array down to `srd === true` for the
public build; the developer's own personal build always sees the full
catalog. **Replicate this exact two-build-target gate in the C++ port if it
is ever distributed publicly** — it's the mechanism that keeps
non-redistributable WotC content out of a shipped binary while keeping it
available for personal use.

`wikiImporter.ts` (an AI-powered runtime import feature) is dead code from a
removed feature — do not port it; there is no runtime content-import path in
the current app, only the two offline scripts above plus the manual homebrew
builder UI.

---

## 8. LAN sync (`src/sync/*`) — no server, no cloud, no internet

### 8.1 Topology

Star topology, DM device is the hub. DM runs a raw **TCP server**
(`react-native-tcp-socket`) bound to `0.0.0.0:7742`; every player device is a
TCP client that dials the DM's LAN IP directly. There is no peer-to-peer
mesh and no discovery broadcast (no mDNS/UDP) — "discovery" is a pure,
reversible **encoding of the DM's IPv4 address into a 7-character base-36
string** (the room code), packed as a big-endian 32-bit int from the 4
octets, optionally rendered as a QR code of that same string. **Note:**
existing docs say "6-digit code" — that's stale; the actual, enforced length
everywhere in the real code is **7 characters**. Port with 7.

### 8.2 Wire protocol

Framing: **newline-delimited JSON** — `JSON.stringify(msg) + '\n'` per
message; receivers buffer raw chunks and split on `\n`, keeping a trailing
partial line as `remainder` for the next chunk; malformed lines are dropped
with a warning, never fatal.

```
{"type":"ping"} / {"type":"pong"}
{"type":"hello","deviceId","nickname","characterId"}            // client → host
{"type":"welcome","campaignId","sessionId"}                     // host → client
{"type":"sync_event","event": SyncEvent}                        // either direction
{"type":"request_entity","entityId"}                             // client → host
{"type":"entity_snapshot","entity": Entity}                      // full replace, either direction
{"type":"entity_patch","entityId","patch": <deep-diff object>}   // partial merge, either direction
{"type":"claim_character","characterId"}                         // client → host
{"type":"error","message"}
```

Handshake: client connects → sends `hello` → host replies `welcome` and
immediately streams one `entity_snapshot` per entity it knows about (the
DM's full roster dump — this is the *only* "initial sync" mechanism; there
is no separate bulk-sync message type). Thereafter, incremental changes
travel as `entity_patch` (diff-based, see §8.3) or `sync_event` (discrete
typed events); `ping`/`pong` exist in the protocol but only the server
answers a `ping` — the client in this codebase never sends one.

**Relay rule (the core of "no player talks to another player directly")**:
when the DM receives a `sync_event`/`entity_snapshot`/`entity_patch` from one
player, it applies the change locally AND rebroadcasts it to every *other*
connected player (excluding the sender). When the DM itself makes a change,
it broadcasts directly to all players. The DM device is unconditionally
authoritative for relay, though **conflict resolution itself is last-write-
wins per field, not host-authoritative arbitration** — see §8.3.

**Reconnection**: clients are keyed server-side by `deviceId`, not by
socket. A `hello` from an already-known `deviceId` destroys any stale socket
and replaces the connection in-place — this is what makes a dropped WiFi
connection recoverable without losing roster identity. Client-side:
auto-reconnect every 5 seconds on `close`, re-sending `hello` (and thus
re-announcing `characterId`) on every attempt.

**No authentication or room-code validation on the server.** The join code
only tells a *client* which IP to dial; the server accepts any TCP
connection on port 7742 and trusts whatever `deviceId`/`nickname` the client
self-reports in `hello`. Stated threat model: "people at your own table,"
not a hostile network — an honest, disclosed limitation, not an oversight to
silently fix without telling the user during a port.

### 8.3 Diff/merge conflict model (`diff.ts`)

**Not** a CRDT, **not** vector-clocked. Field-level recursive diff/merge:

- `deepDiff(previous, next)` — walks the union of both objects' keys
  recursively; returns only the changed leaf paths as a nested patch object.
  **Arrays are always replaced wholesale** — no element-level diffing
  (deliberate; entity arrays like `conditions`/`features` are small).
  Key removal is represented as `{key: undefined}` in-memory — but
  `JSON.stringify` silently drops `undefined`, so a *removal* is currently
  lossy over the actual wire (a documented, accepted limitation, since real
  `Entity` fields are always initialized and never truly deleted, only
  changed in value). **A C++ port using real JSON should either explicitly
  encode deletions with a `null` sentinel or knowingly accept the same gap.**
- `deepMerge(local, patch)` — applies the patch onto the **receiver's own
  current local copy**, not the sender's stale base. This is the load-bearing
  property: two devices editing *different* fields concurrently both survive
  intact, because merge is scoped per-field, not whole-object. If two devices
  edit the **same** leaf field concurrently, whichever patch's message is
  applied last simply wins — no timestamp/version arbitration exists. This
  is an explicit, accepted trade-off (there's a regression test asserting a
  local unrelated-field edit survives an incoming patch for a different
  field — port that test verbatim, it's the one invariant this whole layer
  exists to guarantee).

### 8.4 Two channels: entity patches vs. discrete sync events

- **Entity state** (HP, conditions, inventory, everything on `Entity`) syncs
  via the diff/merge channel above — current-state only, no replay needed,
  since a fresh `entity_snapshot` on reconnect makes any missed patches moot.
- **Discrete typed events** (`SyncChangeType`: `hp_change`, `resource_spend`,
  `resource_restore`, `condition_apply/remove`, `spell_slot_spend/restore`,
  `dm_override_apply/cancel`, `combat_event`, `initiative_update`,
  `entity_full_sync`) go over a separate `sync_event` channel and — unlike
  entity patches — **are queued to the local `sync_events` SQLite table when
  offline and replayed in `timestamp ASC` order on reconnect** (idempotent by
  event id, so a replayed already-applied event is a safe no-op). This is
  the durability mechanism for "dropped connection self-heals."

### 8.5 Role-aware dispatch (`syncManager.ts`)

A single `syncEntity`/`syncEntityPatch` call site in the store layer is
role-agnostic — `syncManager` internally branches DM-vs-player and picks
`server.broadcast*` vs `client.send`. **Port this as one dispatch object with
an internal role enum, not two divergent call paths sprinkled through the
UI/store layer** — that's what keeps every mutation site in the app free of
networking logic.

---

## 9. Backup, export, and PDF

### 9.1 `.grimoire-pack` — the backup/export format

Plain UTF-8 JSON, pretty-printed (2-space indent), **uncompressed**:

```ts
GrimoirePack = {
  formatVersion: number,              // = 1 today
  packType: 'backup' | 'content-pack',  // 'content-pack' reserved for a future shared-homebrew-pack feature, unused today
  createdAt: number,                  // epoch ms
  appVersion: string,
  deviceId: string | null,            // provenance only, not used to gate import
  characters: Entity[],               // FULL Entity objects, verbatim — no reduced projection
  homebrew?: {                        // all optional arrays
    races?, classes?, items?, spells?, backgrounds?, features?    // NOTE: feats deliberately excluded — no homebrew-feat mechanism exists
  },
}
```

**Scope**: only characters + homebrew content. **Campaigns, sync state,
combat state, and dice log are explicitly NOT included** in a backup.

**Validation is intentionally shallow** (`validateGrimoirePack`): checks
`data` is an object, `formatVersion` is a number `≤` the current max (rejects
packs from a newer app version), `packType` is a known value, `characters`
is an array. It does **not** deep-validate individual Entity/homebrew object
shapes.

**Export flow**: build pack → `JSON.stringify(pack, null, 2)` → write to
`grimoire-backup-YYYY-MM-DD.grimoire-pack` in the app's cache directory → OS
share sheet (`expo-sharing`) so the user picks the actual destination (cloud
drive, email, AirDrop, etc.) — the app itself never transmits the file
anywhere, by design (a stated privacy point).

**Import flow (two-phase, preview-then-confirm)**: pick file (`expo-document-
picker`, broad `*/*` MIME since `.grimoire-pack` has no registered type) →
read text → `JSON.parse` (user-facing error on failure) → shallow-validate →
show a non-committal preview (character count, homebrew count, `createdAt`,
`appVersion`) → **only on explicit user confirmation**, upsert every
character by id (replace if exists, else insert — same `applyIncomingEntity`
code path used by live LAN sync, not a bespoke import path) and upsert every
homebrew item by id into its category. **This is a merge/upsert, not a
wipe-and-restore** — nothing absent from the pack is deleted, and there is no
transactional rollback if an error happens partway through (a partial-import
warning is shown instead).

### 9.2 PDF character sheet export

**Approach: HTML → PDF, not direct PDF drawing.** Builds a full styled HTML
document (US Letter, `@page` print CSS, 3-column stat grid, header/footer)
from the `Entity`'s stats/skills/saves/inventory/spellcasting/passive
features, computing modifiers/bonuses inline the same way the engine does.
Converts via `expo-print`'s `printToFileAsync({html})` (OS-level HTML→PDF
rendering), then hands the resulting file to the same OS share sheet used
for backup export. **For a C++ port**: either embed an HTML/CSS→PDF
rendering library, or hand-build an equivalent PDF layout with a PDF library
directly (more work, but avoids an HTML engine dependency) — both are valid,
but the exact field set to reproduce is documented in this module and should
be treated as the print-sheet spec.

---

## 10. UI / display layer (Expo Router + React Native)

*(For a C++ port targeting a different UI toolkit, this section is about
information architecture and the render-from-derived-state discipline, not
literal widget mapping.)*

### 10.1 Boot sequence (`app/_layout.tsx`)

1. Open/migrate SQLite (idempotent — `CREATE TABLE IF NOT EXISTS`).
2. Hydrate stores in parallel: characters, device session, homebrew (merges
   built-in homebrew in-memory, no DB seeding).
3. Restore any in-progress combat state (non-critical, errors swallowed).
4. Wire the sync manager's callbacks (entity received → apply; entity patch
   received → merge; discrete sync event → apply, with special-case
   auto-response to `entity_full_sync` requests by broadcasting the matching
   entity).
5. Load campaigns, then `resumeSync()` — re-hosts (DM) or reconnects
   (player) automatically if a campaign was active at last close; a DM's
   room code is **regenerated** here since a changed LAN IP invalidates the
   old encoded code.
6. Any boot error is logged, never blocks reaching the router — "always
   reach a usable screen" over "hang on a boot failure."
7. First-launch check (`app_meta.onboarding_complete`) routes to onboarding.

### 10.2 Screen map

- **Home tab** — continue-last-character card, active-campaign status card
  (3 states: none / between-sessions / live), quick actions, an
  always-available floating dice roller.
- **Campaigns tab** — the single largest screen; a 3-way state machine (No
  Campaign / DM Active / Player Active), room code + QR display/scan, notes/
  quests/session-log editing (DM), character-claim flow (player).
- **Characters tab** — list + delete.
- **Homebrew tab** — Create panel (8 builder entry points) + Library panel
  (flat list of every homebrew object with edit/delete).
- **Creation wizard** (`app/creation/`, its own nested stack + persistent
  header) — a *hub-and-spoke*, not a strict linear wizard: a central `hub`
  screen computes which sections are done (from predicates over the draft)
  and routes "Next" to the first incomplete one. Fixed content order: name/
  level → race → class → scores → background → skills → (feats, only if a
  house rule enables level-1 feats) → equipment → spells → review, plus two
  conditionally-surfaced screens (level-up ASI/feat resolution, and a rare
  spellcasting-ability picker for homebrew classes) that the hub inserts
  only when a matching pending `ChoiceState` exists.
- **Character sheet** (`app/sheet/[id].tsx`) — 6 base tabs (Combat/
  Exploration toggle, Actions, Abilities, Features, Items, Notes) plus a
  conditionally-shown 7th Spells tab. Always reads the entity live from the
  store by id (never holds its own copy). **The core edit pattern**: every
  handler is a thin wrapper calling `mutate(e => pureEngineFn(e, ...))`,
  where `mutate` = `updateCharacter(id, updater => recomputeDerived(updater(e),
  rules))` — no component ever hand-mutates an entity field; all mutation
  logic lives in the engine layer. This is the pattern to preserve most
  strictly in a C++ UI: **view code calls pure model functions and re-renders
  from the returned state; it never edits model fields directly.**
- **DM screens** (`app/dm/`) — party dashboard (visibility gated by the
  `dmFullStatVisibility` house rule), encounter/initiative tracker (same
  pure engine functions as the player sheet), monster browser (spawn via
  `monsterFactory`), and a read-only per-character mirror of the player
  sheet with DM-override controls instead of direct edit access.
- **Homebrew builders** (`app/homebrew/*-builder.tsx`) — 8 guided forms, one
  per content type, each round-tripping through `traitCompiler.ts` (§4.4) on
  save and storing the original authoring-time draft (`homebrewDraft`) so
  re-opening for edits reconstructs exact UI state losslessly rather than
  reverse-engineering it from compiled Effects.

### 10.3 The one invariant to keep above all others

> **The UI never computes a stat. It reads `entity.derived` after every
> mutation is run back through `recomputeDerived()`.**

Every real, previously-shipped bug in this app's history traces back to a
violation of either this rule or the "engine never checks a name string"
rule (§1). Preserve both as hard architectural boundaries in the C++ port —
enforce them structurally (e.g. `derived` fields are only ever produced by
one function, view code has no write access to model state) rather than by
convention alone.

### 10.4 Performance note worth carrying forward

Any list bound by **content-catalog size** (600+ spells, 900+ items) rather
than by user data (a character's own known spells, rarely >40) needs a
virtualized list — a real, fixed bug in this codebase was a spell browser
rendering the entire catalog eagerly in a plain scroll view. A C++ UI with
equivalent catalog sizes needs the same virtualized-list discipline for any
full-catalog browse screen (item picker, spell picker, monster browser).

---

## 11. Known gaps and deliberate scope cuts (carry these forward explicitly, don't silently "fix" them into false completeness)

- `applyAbilityEffects` only implements `set_flag`/`transform` — `apply_condition`,
  `remove_condition`, `grant_speed`, `restore_resource`, and `spend_resource`-
  beyond-base-cost are typed but not wired.
- Generic magic item bonuses aren't modeled — only weapons with real damage
  dice get mechanical effects from the auto-imported 835-item catalog;
  everything else is description-only (equipping a Ring of Protection
  doesn't change AC today).
- Subclass selection exists as a pending `ChoiceState` in the data model but
  isn't surfaced as a full interactive picker flow everywhere it could be.
- LAN sync is implemented but was, as of the source docs, **only tested on a
  single physical device** — reconnect/conflict edge cases beyond the unit-
  tested `deepDiff`/`deepMerge` invariants are unproven in the field.
- `homebrewValidator.ts`'s race/class/feature validators exist but have **no
  callers** — only the spell validator is actually wired to its builder
  screen. Don't assume homebrew content is validated end-to-end; only spells
  are today.
- Combat resolution is deliberately player-facing (Option A): the app shows
  a dice expression and spends the resource; the player rolls physical dice
  and announces the result. There is no attack-roll/hit automation anywhere
  in the app, and this is a stated design choice, not a missing feature —
  preserve it as intentional in the port unless the port's goals explicitly
  change.
- No authentication, no encryption, no message signing on the LAN protocol.
  Stated threat model is "people at your own table."

---

## 12. Summary map — TypeScript module → C++ port target

| TS module                                                                                                                                   | Responsibility                                      | C++ port target                                                                                                                                                       |
| ------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/engine/types.ts`                                                                                                                       | The entire data model                               | Core header(s) — structs/enums, zero dependencies                                                                                                                     |
| `src/engine/pipeline.ts`, `resolver.ts`                                                                                                     | Derived-stat computation                            | Core library, pure functions over value types                                                                                                                         |
| `src/engine/leveling.ts`, `combat.ts`, `rest.ts`, `conditions.ts`, `dmOverride.ts`, `audit.ts`, `dice.ts`, `featPrereq.ts`, `houseRules.ts` | Rules engine                                        | Core library, same layering (no I/O, no UI)                                                                                                                           |
| `src/engine/actionCards.ts`, `monsterFactory.ts`, `companion.ts`                                                                            | Derived/presentation-adjacent engine helpers        | Core library                                                                                                                                                          |
| `src/content/**`                                                                                                                            | Static game data + content pipeline output          | Compiled-in data tables or data files + startup-loaded index; homebrew as a separate mutable overlay table                                                            |
| `scripts/convert-spells.mjs`, `parse_items.py`                                                                                              | Offline content build tooling                       | Keep as offline tooling (any language) — never ships in the binary                                                                                                    |
| `src/db/schema.ts`, `*Repo.ts`                                                                                                              | SQLite persistence                                  | SQLite C API (or equivalent embedded DB) with the same table shapes and upsert semantics                                                                              |
| `src/store/*.ts`                                                                                                                            | App state + orchestration (mutate → persist → sync) | A view-model/state layer with the same "sync update, async side-effect persist+sync" pattern                                                                          |
| `src/sync/*.ts`                                                                                                                             | LAN TCP protocol, diff/merge                        | BSD sockets or a light networking lib; reproduce the exact NDJSON framing, message set, and diff/merge semantics for wire compatibility if desired                    |
| `src/io/backupIO.ts`, `characterSheetPdf.ts`, `engine/backup.ts`                                                                            | Backup/export, PDF                                  | File I/O + a PDF/HTML rendering approach; reproduce the exact `.grimoire-pack` JSON shape for cross-compatibility with existing backups                               |
| `app/**`, `src/components/**`                                                                                                               | UI                                                  | Whatever native/cross-platform UI toolkit is chosen; preserve the information architecture (screen map in §10.2) and the render-from-derived-state discipline (§10.3) |

---

## 13. Design rationale — why this way, and not another way

Every major decision below was a choice among real alternatives, not the
only option available. Recorded here so the C++ port can deliberately keep
or deliberately replace each one, instead of copying it by default without
knowing why it's there.

### 13.1 String slug ids (`fire_bolt`, `human`) instead of numeric ids

Content ids are mechanically derived from the display name (lowercase,
strip apostrophes, non-alphanumeric → `_` — see `convert-spells.mjs`'s
`slug()`), e.g. `"Fire Bolt"` → `fire_bolt`. Ephemeral runtime-only objects
(`DmOverride.id`, `DeviceSession.deviceId`) instead use random UUID-like hex,
never name-derived — two different id strategies for two different
lifetimes, not an inconsistency.

**Why not sequential integers, the obvious "efficient" alternative:**
- **No central id-issuing authority exists, and the app is built specifically
  to avoid needing one.** It's fully offline, multi-device, no server, no
  accounts — a DM's phone and a player's phone can each create homebrew
  content having never talked to each other. A sequential counter needs
  coordination; a name-derived slug or a random UUID needs none. This is the
  load-bearing reason, not a style preference — sequential ids would require
  building the exact centralized infrastructure the rest of the app
  deliberately doesn't have.
- **Content is regenerated from source repeatedly.** The offline vault-
  conversion scripts re-run against an editable markdown file. A slug is
  deterministic from the name, so a rerun doesn't renumber anything. A
  numeric scheme would need a persisted name→number table to survive a
  rename/reorder/insert without silently shifting every id after it.
- **Content is hand-typed and cross-referenced by humans (and an AI
  collaborator) constantly** — class progressions reference spell ids by
  hand, feat prerequisites reference ability names, item catalogs get
  eyeballed for id collisions in a diff. `spellIds: ['fireball']` is
  self-checking in review; `spellIds: [482]` is not.
- **Debugging cost.** SQLite Browse, console logs, and LAN wire-protocol
  JSON are all immediately legible with `"longsword"`; a numeric id needs a
  lookup table to mean anything while staring at a log line.
- **What numeric ids would actually buy**: smaller storage per reference
  (4–8 bytes vs. a variable-length string) and marginally faster equality/
  hash comparisons. At this content scale (low thousands of rows) neither
  is a real cost — worth reconsidering only if content ever grows into the
  hundreds of thousands of rows, which no d20 ruleset's content catalog
  realistically does.
- **Verdict for the port**: keep string slug ids for anything hand-authored
  or cross-referenced in source; keep random ids for anything ephemeral and
  device-generated. If the C++ port wants smaller in-memory keys, intern the
  strings into a hash once at load and use the resulting integer handle
  *internally* — but keep the string as the canonical, portable identity
  (what's stored on disk, sent over the wire, and typed by a human).

### 13.2 JSON blob in a thin SQL shell, instead of a fully normalized schema

`entities`/`campaigns`/`content_cache` store one big JSON column, not one row
per field. **Why not normalize** (a `character_stats` table, an
`inventory_items` table, a `known_spells` join table, etc., the textbook
relational answer): the domain type (`Entity`) grew constantly during
development — death saves, Wild Shape state, infusions were all added
*after* the schema existed — and a normalized schema means a migration every
time the type gains a field. JSON-blob storage means the TypeScript (or C++
struct) type itself is the schema, enforced at compile time, and adding a
field is a no-op at the storage layer. The real cost of this choice: you
lose the ability to `WHERE`-filter or aggregate on any field that isn't
pulled out into a real column (mitigated today by `EntityMeta`'s partial-
deserialize pattern for list screens), and you lose foreign-key integrity
enforcement — nothing stops a stale `raceId` from pointing at a deleted
race; the app currently doesn't need this because content is never actually
deleted, only added. **Verdict for the port**: keep the JSON-blob shell for
`Entity`/`Campaign` (rapidly-evolving domain types, no cross-table joins
needed); consider a real column only for fields that need `WHERE`/`ORDER BY`
(exactly what `id`/`kind`/`updatedAt` already are).

### 13.3 Full recompute (`recomputeDerived`) instead of incremental/dirty-flag updates

Every mutation reruns the *entire* derived-stat pipeline from base data,
rather than patching only the affected fields. **Why not incremental**: an
incremental system needs a dependency graph (which effects affect which
derived fields) and correct invalidation on every possible mutation path —
a whole category of bugs (stale derived values, forgotten invalidation)
that a full recompute makes structurally impossible. At this data size (one
character's full effect list, well under a hundred entries in the worst
case) a full recompute is microseconds — the performance argument for
incremental doesn't actually apply here. This is also what makes the audit
trail (`explainValue`) trustworthy: it re-derives from the same code path
`recomputeDerived` uses, so a bug shows up as visibly wrong math instead of
being silently hidden behind a cached, possibly-stale value. **Verdict for
the port**: keep full recompute. Don't introduce caching/memoization of
derived stats unless profiling on real hardware actually shows it's needed
— the correctness property is worth more than the (currently unneeded)
speed.

### 13.4 Raw TCP + newline-delimited JSON, instead of WebSocket/HTTP/gRPC

**Why not WebSocket**: WebSocket is an HTTP upgrade handshake on top of TCP
— extra protocol weight for zero benefit on a LAN where both ends are
purpose-built native clients, not browsers. Raw TCP removes that layer
entirely. Earlier internal docs actually mislabeled this as WebSocket; the
real implementation was always plain TCP. **Why not HTTP/REST**: sync here
is bidirectional, low-latency, and long-lived (an open session for the
whole table for the whole game session) — that's a persistent-connection
problem, not a request/response one; polling or long-polling over HTTP
would add latency and complexity for no gain. **Why not gRPC/protobuf**: a
binary schema-driven RPC framework is real engineering weight (codegen,
schema versioning, a runtime dependency) for a message set that's 9 small
variants and doesn't need cross-language codegen since both ends are the
same app. **Why NDJSON specifically over a length-prefixed binary frame**:
human-debuggable on the wire (a raw TCP dump is directly readable), trivial
to parse without a binary framing library, and the message volume/size here
is small enough that JSON's overhead is irrelevant. **Verdict for the
port**: keep raw sockets + NDJSON if wire compatibility with existing
clients matters; if starting fresh with no compatibility constraint, a
length-prefixed binary frame with a small fixed schema (still hand-rolled,
not gRPC) would be a reasonable, slightly more efficient alternative — but
the "no heavyweight RPC framework for 9 message types on a LAN" reasoning
holds either way.

### 13.5 Star topology (DM-as-hub relay), instead of full mesh

Every player talks only to the DM; the DM relays to everyone else. **Why
not full mesh** (every device connects to every other device directly):
mesh means `O(n²)` connections, each player device needs to accept inbound
connections (NAT/firewall complications even on a simple home LAN, and
mobile OSes are stingier about backgrounded listening sockets than a
laptop), and — the real killer — conflict resolution gets much harder
without a single point that seesomething close to "the whole table's
current state" to reconcile against. A star with the DM as hub means only
one device (the DM's, already the natural authority in the game itself)
needs to accept connections; every player device only ever needs to dial
out. **Verdict for the port**: keep the star topology — it maps onto the
game's real social structure (one DM, several players) instead of fighting
it, and it's the cheaper implementation on every axis that matters here.

### 13.6 Field-level diff/merge, instead of full-object replace or a CRDT

**Why not always send the full `Entity`** (simplest possible design): it
was tried implicitly first and produced a real, reported bug — one device's
unrelated field getting clobbered by another device's patch for a
completely different field, because "apply the incoming object" is
whole-object replace by construction. **Why not a CRDT** (the
textbook-correct answer for multi-writer offline-first state): a CRDT gives
strong convergence guarantees but requires redesigning every field as a
CRDT-compatible type (grow-only counters, OR-sets, etc.) — real engineering
cost for a problem whose actual shape is "3–6 people around one physical
table, each editing mostly their own character," where true concurrent
edits to the *same* field are rare and, when they do happen, last-write-wins
is an acceptable outcome (a DM and a player editing the same character's HP
in the same second is a vanishingly rare real-world case, not the common
path). Field-level diff/merge gets 90% of a CRDT's practical benefit (no
clobbering of *unrelated* fields, which was the actual bug) at a fraction
of the implementation cost. **Verdict for the port**: keep field-level
diff/merge; only reach for a CRDT if a specific field turns out to need true
concurrent-edit correctness in practice (a shared combat log/initiative
order is the most likely candidate, since multiple people legitimately
touch it in quick succession).

### 13.7 Fire-and-forget async persistence, instead of blocking/transactional writes

Every store action updates in-memory state synchronously, then kicks off an
async SQLite write with only console-logged error handling — the UI never
waits on disk I/O. **Why not await + block**: a phone's flash storage write
is unpredictable (tens of ms usually, much worse under load/low storage),
and blocking the UI thread on it for a single-player-app-shaped tap
(damage, heal, spend a slot) would make the app feel laggy for a benefit
(certainty the write finished before the next tap) that doesn't matter here
— worst case on a crash mid-write is losing the last few seconds of state,
recoverable by re-doing the last action. **Why this is more defensible than
it sounds**: the LAN sync layer already provides a second copy of live state
on every connected device, and the `sync_events` queue already handles
replay/durability for anything that needs it — so this isn't "no durability
story," it's "durability lives one layer up, not on every single write."
**Verdict for the port**: keep async, non-blocking persistence for routine
gameplay mutations; consider a synchronous/awaited write only for
genuinely destructive, rare operations (character deletion, a full backup
restore) where losing the operation silently would be worse than a few
extra milliseconds of UI latency.

### 13.8 Content compiled into the app today, vs. a loadable pack format for the port

Covered in depth in `RULESET_PACK_DESIGN.md` §"The problem this solves" —
short version: compiling content into the binary was the right call for a
single-ruleset app where content only changes when the whole app updates;
it stops being the right call the moment several rulesets exist with
independent update cadences (errata, new sourcebooks), which is exactly the
situation the C++ port is being designed for. See that doc for the full
alternatives analysis (SQLite pack files vs. flat JSON/flatbuffers, delta
patches vs. full replace, in-memory index vs. live queries).

### 13.9 Uncompressed pretty-printed JSON for `.grimoire-pack`, instead of a binary/compressed format

**Why not gzip or a binary serialization** (msgpack, protobuf, flatbuffers):
a backup file is written rarely (user-initiated export) and read rarely
(user-initiated import) — it's not a hot path, so the size/speed savings of
compression or binary encoding buy little, while plain JSON buys real
things: a user (or the developer, debugging a corrupted-import report) can
open the file in any text editor and read it directly, and it survives
being passed through email/cloud-drive/chat attachments (all of which
sometimes mangle binary attachments but never plain text) without a custom
tool. **Verdict for the port**: keep plain JSON for backups specifically —
compress only if real-world backup file sizes turn out to be large enough
that users complain (unlikely at "a handful of characters plus homebrew,"
likely never worth the tradeoff for this specific file's use case).

### 13.10 HTML→PDF for the character sheet, instead of direct PDF drawing

**Why not draw the PDF directly** (a PDF library placing text/lines/boxes
by hand): HTML+CSS already has print layout, page-break, and grid primitives
that a from-scratch PDF-drawing approach would have to reimplement by hand
(column layout, text wrapping, page sizing) — reusing the OS's HTML→PDF
renderer (`expo-print`) means the "layout engine" is free. **The real cost**:
depending on an HTML rendering engine being available at all, which is a
non-issue on mobile OSes (always present) but is a genuine dependency
decision on a from-scratch C++ target with no OS-level HTML renderer
available. **Verdict for the port**: if the target platform already ships
an HTML/WebView renderer, reuse it exactly as today (cheapest path); if not,
direct PDF drawing with a C++ PDF library is the right call specifically
*because* the sheet's layout is fixed and known (documented in this file's
§9.2) rather than needing a general-purpose layout engine — build a
hand-rolled layout, don't pull in a full HTML engine just for this one
screen.

### 13.11 IP-encoded room code for LAN "discovery," instead of mDNS/broadcast

**Why not mDNS/Bonjour/UDP broadcast-and-listen** (the standard LAN-service-
discovery answer): those require either a platform mDNS service (not
uniformly available/reliable across Android versions, and historically
gated behind location permissions on some Android versions the way
`react-native-network-info` was) or hand-rolled UDP broadcast handling
(more moving parts: a broadcast listener thread, timeout/retry logic,
handling multiple DMs answering on a shared venue WiFi). Encoding the DM's
own IP directly into a human-shareable 7-character code sidesteps all of
that: no listener, no broadcast, no permission prompt, and it doubles as
the exact mechanism a QR code or a spoken code needs anyway ("read me these
7 characters"). **The real cost**: the code goes stale if the DM's LAN IP
changes (DHCP lease renewal, switching WiFi networks) — mitigated today by
regenerating the code on every app boot, with a manual "reconnect with a new
code" path for a player when it happens mid-session. **Verdict for the
port**: keep IP-in-code encoding for its zero-infrastructure simplicity;
reach for real mDNS only if the port's target platform makes broadcast
discovery meaningfully easier than reading a phone's own IP + rendering a
QR code (unlikely to be a net win on any current mobile OS).
