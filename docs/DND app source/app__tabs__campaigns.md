---
tags: [grimoire, screen-tab]
type: "Screen · Tab"
source: "app/(tabs)/campaigns.tsx"
---

# campaigns

> **Screen · Tab**  ·  `app/(tabs)/campaigns.tsx`

Campaign management tab. DMs can host a new campaign (generates QR code / room
code, starts TCP server). Players join with a 6-character code. Shows live
connection status, last error, and a reconnect flow for players who disconnected.

---

## Functions

### `CampaignsScreen()`

── Campaigns Screen ──────────────────────────────────────────────────────────

---

## Imports

- [[src__components__SyncStatusDot|SyncStatusDot]]  ·  `src/components/SyncStatusDot.tsx`
- [[src__engine__types|types]]  ·  `src/engine/types.ts`
- [[src__store__campaignStore|campaignStore]]  ·  `src/store/campaignStore.ts`
- [[src__store__characterStore|characterStore]]  ·  `src/store/characterStore.ts`
- [[src__store__sessionStore|sessionStore]]  ·  `src/store/sessionStore.ts`
- [[src__store__syncStore|syncStore]]  ·  `src/store/syncStore.ts`
- [[src__sync__discovery|discovery]]  ·  `src/sync/discovery.ts`
- [[src__sync__syncManager|syncManager]]  ·  `src/sync/syncManager.ts`
- [[src__theme|theme]]  ·  `src/theme.ts`
