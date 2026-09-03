---
tags: [grimoire, engine]
type: "Engine"
source: "src/engine/leveling.ts"
---

# leveling

> **Engine**  ·  `src/engine/leveling.ts`

Level-up logic. Takes an entity and a target level, then walks each missing level
applying HP, grants (features, proficiencies, resources, spell slots), and queuing
any unresolved choices (skills, feats, ASIs, spells).

Also owns the choice-resolution functions: resolveChoice, applyAsiToEntity,
applyFeatToEntity. When a player makes a pick on a creation/level-up screen,
those functions apply the choice and mark it resolved.

---

## Functions

### `applyAsiToEntity(`

Applies an ability score increase to an entity and marks the ASI choice resolved. Accepts a partial Record<Ability, 1|2> so both +2-one and +1+1-two are handled.

### `applyFeatToEntity(`

Applies a feat's feature to the entity, grants any abilityChoice stat bonus or save proficiency, and marks the choice resolved. Called from AsiFeatPicker on confirm.

### `applyGrant(entity: Entity, grant: Grant, atLevel: number): Entity`

Applies one Grant item from a level entry: adds a feature, upgrades a resource, grants a proficiency, adds spell slots, etc. Handles all Grant kinds from the union type.

### `applyHP(`

Applies the HP gain for one level. Level 1 always uses the full die. Fixed mode = ⌊die/2⌋+1. Max mode = die. Rolled mode = rollDie(die). Optional rules param: if hpMinHalfDie(rules) is true, rolled values below ⌈die/2⌉ are bumped up.

### `levelUp(`

Main entry point. Takes an entity and a target level, iterates each missing level applying HP (applyHP), grants (applyGrant), and choices (queueChoice). If bonusFeatEveryLevel rule is on, injects a bonus feat-only ASI choice at every level.

### `reapplyResolvedAsi(entity: Entity, rules: CampaignRules): Entity`

── reapplyResolvedAsi ─────────────────────────────────────────────────────────
Re-applies every RESOLVED ASI selection on top of the entity's CURRENT base
stats. Needed because ASI increases live in base stats, and the scores screen
overwrites base stats wholesale — without this, re-confirming scores after
resolving an ASI silently erased the improvement (and since the choice stayed
resolved, it could never be taken again). Feat-based resolutions live in
features and are unaffected by a stat overwrite, so they're skipped here.
Selections are parsed from the labels applyAsiToEntity stores, e.g.
'con+2' or 'str+1,dex+1'. Each re-applied increase is capped by effective-
score headroom, mirroring applyAsiToEntity.

### `recalculateAllHP(entity: Entity, rules: CampaignRules): Entity`

Recomputes max HP from scratch (used when CON score changes mid-build). Does NOT re-roll in rolled mode — preserves previously rolled values stored on the entity.

### `reconcileConHp(prev: Entity, next: Entity): Entity`

── reconcileConHp ─────────────────────────────────────────────────────────────
PHB "Beyond 1st Level": when your Constitution modifier increases, your hit
point maximum increases by 1 for each level you have attained (and the reverse
if it drops). Call this after a PERMANENT Constitution change (an ASI or a
feat) to adjust max HP by (Δ CON modifier × level) WITHOUT recomputing rolled
HP from scratch — so a character who rolled HP keeps those rolls.
`prev` = entity before the change, `next` = entity after. Current HP moves
with maximum so the increase isn't "lost" as if the character were damaged.

### `resolveChoice(`

Marks a ChoiceState resolved and applies the selections. For skill choices, grants trained proficiency. For spell choices, adds to known/cantrip list. For equipment choices, adds to inventory.

### `rollDie(sides: number): number`

Rolls a single die of given sides. Used for rolled HP and any engine-side randomness.

### `stripResolvedAsiStats(entity: Entity): Entity`

Subtracts every resolved ASI's recorded increases from base stats.
Used when class data is cleared (class re-selection): the ASI choices are
about to be dropped and re-queued by the new class, so their stat bumps must
not survive as ghosts — otherwise resolving the new class's ASI stacks on top
(+2 STR becomes +4). Selections are the same parseable labels
applyAsiToEntity records ('con+2', 'str+1,dex+1'); feat selections are
skipped (feat features are removed separately).

---

## Imports

- [[src__content__classes__spellSlotTables|spellSlotTables]]  ·  `src/content/classes/spellSlotTables.ts`
- [[src__engine__houseRules|houseRules]]  ·  `src/engine/houseRules.ts`
- [[src__engine__pipeline|pipeline]]  ·  `src/engine/pipeline.ts`
- [[src__engine__types|types]]  ·  `src/engine/types.ts`

## Used by

- [[app__creation__background|background]]  ·  `app/creation/background.tsx`
- [[app__creation__class-detail|class-detail]]  ·  `app/creation/class-detail.tsx`
- [[app__creation__equipment|equipment]]  ·  `app/creation/equipment.tsx`
- [[app__creation__race-detail|race-detail]]  ·  `app/creation/race-detail.tsx`
- [[app__creation__review|review]]  ·  `app/creation/review.tsx`
- [[app__creation__scores|scores]]  ·  `app/creation/scores.tsx`
- [[app__creation__skills|skills]]  ·  `app/creation/skills.tsx`
- [[app__creation__spells|spells]]  ·  `app/creation/spells.tsx`
- [[src__components__AsiFeatPicker|AsiFeatPicker]]  ·  `src/components/AsiFeatPicker.tsx`
- [[src__components__sheet__FreeEditModal|FreeEditModal]]  ·  `src/components/sheet/FreeEditModal.tsx`
- [[src__components__sheet__TabCharacter|TabCharacter]]  ·  `src/components/sheet/TabCharacter.tsx`
- [[src__components__sheet__TabFeatures|TabFeatures]]  ·  `src/components/sheet/TabFeatures.tsx`
