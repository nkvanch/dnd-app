---
tags: [grimoire, database]
type: "Database"
source: "src/db/campaignRepo.ts"
---

# campaignRepo

> **Database**  ·  `src/db/campaignRepo.ts`

SQLite read/write for Campaign objects and campaign membership. Handles the
mapping between a campaign and its member character IDs.

---

## Functions

### `deleteCampaign(id: string): Promise<void>`

Permanently delete a campaign by id.

### `loadAllCampaigns(): Promise<Campaign[]>`

Load all saved campaigns sorted by updatedAt descending.

### `loadCampaign(id: string): Promise<Campaign | null>`

Load a single Campaign by id. Returns null if not found.

### `saveCampaign(campaign: Campaign): Promise<void>`

Upsert a Campaign.

---

## Imports

- [[src__db__db|db]]  ·  `src/db/db.ts`
- [[src__engine__types|types]]  ·  `src/engine/types.ts`

## Used by

- [[src__store__campaignStore|campaignStore]]  ·  `src/store/campaignStore.ts`
