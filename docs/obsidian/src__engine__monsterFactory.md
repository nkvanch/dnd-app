---
tags: [grimoire, engine]
type: "Engine"
source: "src/engine/monsterFactory.ts"
---

# monsterFactory

> **Engine**  ·  `src/engine/monsterFactory.ts`

## Functions

### `spawnMonster(`

Spawns a live Entity from a MonsterTemplate.
HP is rolled using the template's dice expression (or averaged in 'fixed' mode).
All template features are applied as active FeatureInstances.

---

## Imports

- [[src__content__monsters__types|types]]  ·  `src/content/monsters/types.ts`
- [[src__engine__dice|dice]]  ·  `src/engine/dice.ts`
- [[src__engine__pipeline|pipeline]]  ·  `src/engine/pipeline.ts`
- [[src__engine__types|types]]  ·  `src/engine/types.ts`
- [[src__store__characterStore|characterStore]]  ·  `src/store/characterStore.ts`

## Used by

- [[app__dm__monsters|monsters]]  ·  `app/dm/monsters.tsx`
