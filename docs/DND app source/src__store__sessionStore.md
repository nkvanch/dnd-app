---
tags: [grimoire, store]
type: "Store"
source: "src/store/sessionStore.ts"
---

# sessionStore

> **Store**  ·  `src/store/sessionStore.ts`

Tracks the local device's session: deviceId, the player's claimed character ID,
and connection status. Persists across restarts so a player can reconnect to a
campaign without re-entering the room code.

---

## Constants

### `useSessionStore`

---

## Imports

- [[src__db__sessionRepo|sessionRepo]]  ·  `src/db/sessionRepo.ts`
- [[src__engine__types|types]]  ·  `src/engine/types.ts`

## Used by

- [[app___layout|_layout]]  ·  `app/_layout.tsx`
- [[app__tabs__campaigns|campaigns]]  ·  `app/(tabs)/campaigns.tsx`
- [[app__dm__character__[id]|[id]]]  ·  `app/dm/character/[id].tsx`
- [[app__dm__encounter|encounter]]  ·  `app/dm/encounter.tsx`
- [[app__sheet__[id]|[id]]]  ·  `app/sheet/[id].tsx`
- [[src__store__campaignStore|campaignStore]]  ·  `src/store/campaignStore.ts`
