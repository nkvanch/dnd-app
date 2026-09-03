---
tags: [grimoire, store]
type: "Store"
source: "src/store/campaignStore.ts"
---

# campaignStore

> **Store**  ·  `src/store/campaignStore.ts`

Manages the list of campaigns, the currently active campaign, and the
networking layer (hosting / joining via TCP). Imports DEFAULT_RULES from
characterStore so there's a single canonical definition.

The DM hosts a campaign server on port 7742 (0.0.0.0 bind). Players join with
a 6-character room code. State sync flows through syncManager.

---

## Constants

### `useCampaignStore`

---

## Imports

- [[src__db__campaignRepo|campaignRepo]]  ·  `src/db/campaignRepo.ts`
- [[src__engine__types|types]]  ·  `src/engine/types.ts`
- [[src__store__characterStore|characterStore]]  ·  `src/store/characterStore.ts`
- [[src__store__sessionStore|sessionStore]]  ·  `src/store/sessionStore.ts`
- [[src__sync__syncManager|syncManager]]  ·  `src/sync/syncManager.ts`

## Used by

- [[app___layout|_layout]]  ·  `app/_layout.tsx`
- [[app__tabs__campaigns|campaigns]]  ·  `app/(tabs)/campaigns.tsx`
- [[app__tabs__index|(tabs)]]  ·  `app/(tabs)/index.tsx`
- [[app__dm__character__[id]|[id]]]  ·  `app/dm/character/[id].tsx`
- [[app__dm__dashboard|dashboard]]  ·  `app/dm/dashboard.tsx`
- [[app__dm__encounter|encounter]]  ·  `app/dm/encounter.tsx`
- [[app__sheet__[id]|[id]]]  ·  `app/sheet/[id].tsx`
