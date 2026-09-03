---
tags: [grimoire, store]
type: "Store"
source: "src/store/characterStore.ts"
---

# characterStore

> **Store**  ·  `src/store/characterStore.ts`

Central Zustand store for character creation and per-session character state.
Holds the creation draft entity, the campaign rules, and the active
character entity once the sheet is open.

Also owns DEFAULT_RULES (the by-the-book CampaignRules) and makeEmptyEntity
(a blank entity with all required fields). Other stores import DEFAULT_RULES
from here rather than redefining it.

---

## Functions

### `makeEmptyEntity(id: string, kind: Entity['kind']`

Creates a blank Entity with every required field initialised to its zero value. senses: [], movement: {}, conditionMonitor: {active:[], exhaustion:0, flags:{}}, etc. Used at the start of character creation and by the monster factory.

## Constants

### `useCharacterStore`

Zustand store. Key slices: draft (Entity | null for the creation flow), rules (CampaignRules for the current character), setDraft, setRules, saveEntity (persists to SQLite), loadEntity.

---

## Imports

- [[src__content__items__index|items]]  ·  `src/content/items/index.ts`
- [[src__db__entityRepo|entityRepo]]  ·  `src/db/entityRepo.ts`
- [[src__engine__types|types]]  ·  `src/engine/types.ts`
- [[src__sync__syncManager|syncManager]]  ·  `src/sync/syncManager.ts`

## Used by

- [[app___layout|_layout]]  ·  `app/_layout.tsx`
- [[app__tabs__campaigns|campaigns]]  ·  `app/(tabs)/campaigns.tsx`
- [[app__tabs__characters|characters]]  ·  `app/(tabs)/characters.tsx`
- [[app__tabs__index|(tabs)]]  ·  `app/(tabs)/index.tsx`
- [[app__creation__background|background]]  ·  `app/creation/background.tsx`
- [[app__creation__class-detail|class-detail]]  ·  `app/creation/class-detail.tsx`
- [[app__creation__equipment|equipment]]  ·  `app/creation/equipment.tsx`
- [[app__creation__feats|feats]]  ·  `app/creation/feats.tsx`
- [[app__creation__hub|hub]]  ·  `app/creation/hub.tsx`
- [[app__creation__level-up|level-up]]  ·  `app/creation/level-up.tsx`
- [[app__creation__name|name]]  ·  `app/creation/name.tsx`
- [[app__creation__race-detail|race-detail]]  ·  `app/creation/race-detail.tsx`
- [[app__creation__review|review]]  ·  `app/creation/review.tsx`
- [[app__creation__rules|rules]]  ·  `app/creation/rules.tsx`
- [[app__creation__scores|scores]]  ·  `app/creation/scores.tsx`
- [[app__creation__skills|skills]]  ·  `app/creation/skills.tsx`
- [[app__creation__spells|spells]]  ·  `app/creation/spells.tsx`
- [[app__dm__character__[id]|[id]]]  ·  `app/dm/character/[id].tsx`
- [[app__dm__dashboard|dashboard]]  ·  `app/dm/dashboard.tsx`
- [[app__dm__encounter|encounter]]  ·  `app/dm/encounter.tsx`
- [[app__dm__monsters|monsters]]  ·  `app/dm/monsters.tsx`
- [[app__settings|settings]]  ·  `app/settings.tsx`
- [[app__sheet__[id]|[id]]]  ·  `app/sheet/[id].tsx`
- [[src__components__CreationHeader|CreationHeader]]  ·  `src/components/CreationHeader.tsx`
- [[src__components__sheet__TabCharacter|TabCharacter]]  ·  `src/components/sheet/TabCharacter.tsx`
- [[src__engine__combat|combat]]  ·  `src/engine/combat.ts`
- [[src__engine__conditions|conditions]]  ·  `src/engine/conditions.ts`
- [[src__engine__monsterFactory|monsterFactory]]  ·  `src/engine/monsterFactory.ts`
- [[src__engine__rest|rest]]  ·  `src/engine/rest.ts`
- [[src__store__campaignStore|campaignStore]]  ·  `src/store/campaignStore.ts`
- [[src__store__combatStore|combatStore]]  ·  `src/store/combatStore.ts`
