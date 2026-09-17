// ============================================================================
// FILE: src/db/campaignRepo.ts
// CRUD operations for Campaign objects.
// ============================================================================
import { Platform } from 'react-native';
import { Campaign } from '../engine/types';
import { getDb } from './db';

type CampaignRow = {
  id:        string;
  data:      string;
  updatedAt: number;
};

/** Upsert a Campaign. */
export async function saveCampaign(campaign: Campaign): Promise<void> {
  if (Platform.OS === 'web') return;
  const db = getDb();
  await db.runAsync(
    `INSERT INTO campaigns (id, data, updatedAt)
     VALUES (?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       data      = excluded.data,
       updatedAt = excluded.updatedAt`,
    [campaign.id, JSON.stringify(campaign), Date.now()]
  );
}

/** Load a single Campaign by id. Returns null if not found. */
export async function loadCampaign(id: string): Promise<Campaign | null> {
  if (Platform.OS === 'web') return null;
  const db  = getDb();
  const row = await db.getFirstAsync<CampaignRow>(
    'SELECT * FROM campaigns WHERE id = ?',
    [id]
  );
  if (!row) return null;
  return JSON.parse(row.data) as Campaign;
}

/**
 * Load all saved campaigns sorted by updatedAt descending. A malformed row
 * is skipped (and logged) rather than aborting the whole list — previously
 * one bad row threw inside the .map(), silently returning an empty list
 * and hiding every other valid campaign (audit finding PERSIST-4).
 */
export async function loadAllCampaigns(): Promise<Campaign[]> {
  if (Platform.OS === 'web') return [];
  const db   = getDb();
  const rows = await db.getAllAsync<CampaignRow>(
    'SELECT * FROM campaigns ORDER BY updatedAt DESC'
  );
  return rows
    .map(r => {
      try {
        return JSON.parse(r.data) as Campaign;
      } catch (e) {
        console.error(`[campaignRepo] skipping malformed row id=${r.id}:`, e);
        return null;
      }
    })
    .filter((c): c is Campaign => c !== null);
}

/** Permanently delete a campaign by id. */
export async function deleteCampaign(id: string): Promise<void> {
  if (Platform.OS === 'web') return;
  const db = getDb();
  await db.runAsync('DELETE FROM campaigns WHERE id = ?', [id]);
}
