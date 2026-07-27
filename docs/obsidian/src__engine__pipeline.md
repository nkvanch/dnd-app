---
tags: [grimoire, engine]
type: "Engine"
source: "src/engine/pipeline.ts"
---

# pipeline

> **Engine**  ·  `src/engine/pipeline.ts`

Derives the computed ("derived") stats of an entity from its raw ability scores,
active features, and all their effects. This runs every time something changes
on a character — equipping an item, gaining a level, toggling a condition.

The pipeline is a pure function: Entity → DerivedStats. Nothing in the UI should
compute AC, saving throws, passives, senses, or movement directly — it all flows
through here.

---

## Functions

### `applyStatModifiers(`

Applies all stat_modifier effects to the raw AbilityScores, returning effective scores. Used whenever a skill bonus or save needs the effective stat, not the raw one.

### `collectAllEffects(entity: Entity): ActiveEffect[]`

Gathers every Effect from every active FeatureInstance on the entity, respecting condition gates (a feature whose condition flag isn't set in conditionMonitor.flags is skipped).

### `recomputeDerived(entityParam: Entity, rules: CampaignRules): Entity`

Full pipeline pass: collects all effects from active features → applies stat modifiers → computes AC (base_ac_formula takes max across formulas) → initiative → speed → proficiency bonus → saving throws → passives → senses → movement → attack bonuses → spell DCs. Returns an updated Entity.

## Constants

### `modifier`

Standard 5e ability modifier: ⌊(score − 10) / 2⌋. Used everywhere — saves, skills, initiative, spell DC, HP. Negative for scores below 10.

---

## Imports

- [[src__engine__resolver|resolver]]  ·  `src/engine/resolver.ts`
- [[src__engine__types|types]]  ·  `src/engine/types.ts`

## Used by

- [[app__creation__class-detail|class-detail]]  ·  `app/creation/class-detail.tsx`
- [[app__creation__race-detail|race-detail]]  ·  `app/creation/race-detail.tsx`
- [[app__creation__review|review]]  ·  `app/creation/review.tsx`
- [[app__creation__scores|scores]]  ·  `app/creation/scores.tsx`
- [[app__dm__character__[id]|[id]]]  ·  `app/dm/character/[id].tsx`
- [[app__dm__encounter|encounter]]  ·  `app/dm/encounter.tsx`
- [[app__sheet__[id]|[id]]]  ·  `app/sheet/[id].tsx`
- [[src__components__AsiFeatPicker|AsiFeatPicker]]  ·  `src/components/AsiFeatPicker.tsx`
- [[src__components__sheet__TabAbilities|TabAbilities]]  ·  `src/components/sheet/TabAbilities.tsx`
- [[src__components__sheet__TabCharacter|TabCharacter]]  ·  `src/components/sheet/TabCharacter.tsx`
- [[src__components__sheet__TabExploration|TabExploration]]  ·  `src/components/sheet/TabExploration.tsx`
- [[src__engine__actionCards|actionCards]]  ·  `src/engine/actionCards.ts`
- [[src__engine__audit|audit]]  ·  `src/engine/audit.ts`
- [[src__engine__combat|combat]]  ·  `src/engine/combat.ts`
- [[src__engine__conditions|conditions]]  ·  `src/engine/conditions.ts`
- [[src__engine__dmOverride|dmOverride]]  ·  `src/engine/dmOverride.ts`
- [[src__engine__featPrereq|featPrereq]]  ·  `src/engine/featPrereq.ts`
- [[src__engine__leveling|leveling]]  ·  `src/engine/leveling.ts`
- [[src__engine__monsterFactory|monsterFactory]]  ·  `src/engine/monsterFactory.ts`
- [[src__engine__rest|rest]]  ·  `src/engine/rest.ts`
