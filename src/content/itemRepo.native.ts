// ============================================================================
// FILE: src/content/itemRepo.native.ts
// Native (SQLite-backed) implementation — Metro resolves this file in place
// of itemRepo.ts on iOS/Android builds via its .native platform-extension
// convention, so the ~541KB static item array
// (src/content/items/importedItems.ts) is never pulled into this file's
// import tree and therefore never bundled on native. Mirrors
// spellRepo.native.ts's two-tier cache design exactly — see that file's
// header for the full rationale.
// ============================================================================
import { Item } from '../engine/types';
import { getContentDb } from '../db/contentDb';
import type { ItemIndexEntry, ItemRepo } from './itemRepo.types';

const SRD_ONLY = process.env.EXPO_PUBLIC_SRD_ONLY === 'true';

type ItemIndexRow = {
  id: string; name: string; weight: number; cost: string;
  properties: string; hasDamageEffect: number; weaponRange: string | null;
  srd: number | null;
};

let index: ItemIndexEntry[] = [];
const fullCache = new Map<string, Item>();

async function init(): Promise<void> {
  if (index.length > 0) return;
  const db = getContentDb();
  const rows = await db.getAllAsync<ItemIndexRow>(
    'SELECT id, name, weight, cost, properties, hasDamageEffect, weaponRange, srd FROM items'
  );
  index = rows
    .filter(r => !SRD_ONLY || r.srd === 1)
    .map(r => ({
      id:              r.id,
      name:            r.name,
      weight:          r.weight,
      cost:            r.cost,
      properties:      JSON.parse(r.properties) as string[],
      hasDamageEffect: r.hasDamageEffect === 1,
      weaponRange:     r.weaponRange,
      srd:             r.srd === null ? undefined : r.srd === 1,
    }));
}

function getIndex(): ItemIndexEntry[] {
  return index;
}

async function ensureLoaded(ids: string[]): Promise<void> {
  const missing = Array.from(new Set(ids)).filter(id => !fullCache.has(id));
  if (missing.length === 0) return;
  const db = getContentDb();
  const placeholders = missing.map(() => '?').join(',');
  const rows = await db.getAllAsync<{ id: string; data: string }>(
    `SELECT id, data FROM items WHERE id IN (${placeholders})`,
    missing
  );
  for (const row of rows) {
    fullCache.set(row.id, JSON.parse(row.data) as Item);
  }
}

function getItemSync(id: string): Item | undefined {
  return fullCache.get(id);
}

export const itemRepo: ItemRepo = { init, getIndex, ensureLoaded, getItemSync };
