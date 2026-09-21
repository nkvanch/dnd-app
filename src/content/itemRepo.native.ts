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
import { Item, asRulesetId } from '../engine/types';
import { getContentDb } from '../db/contentDb';
import type { ItemIndexEntry, ItemRepo } from './itemRepo.types';
import { baseWeaponIdFromName } from './items/itemBrowse';

const SRD_ONLY = process.env.EXPO_PUBLIC_SRD_ONLY === 'true';

type ItemIndexRow = {
  id: string; name: string; weight: number; cost: string;
  properties: string; hasDamageEffect: number; weaponRange: string | null;
  srd: number | null; rulesetId: string | null;
};

let index: ItemIndexEntry[] = [];
const fullCache = new Map<string, Item>();

async function init(): Promise<void> {
  if (index.length > 0) return;
  try {
    const db = getContentDb();
    const rows = await db.getAllAsync<ItemIndexRow>(
      'SELECT id, name, weight, cost, properties, hasDamageEffect, weaponRange, srd, rulesetId FROM items'
    );
    const built: ItemIndexEntry[] = [];
    for (const r of rows) {
      if (SRD_ONLY && r.srd !== 1) continue;
      try {
        built.push({
          id:              r.id,
          name:            r.name,
          weight:          r.weight,
          cost:            r.cost,
          properties:      JSON.parse(r.properties) as string[],
          hasDamageEffect: r.hasDamageEffect === 1,
          weaponRange:     r.weaponRange,
          srd:             r.srd === null ? undefined : r.srd === 1,
          rulesetId:       r.rulesetId ? asRulesetId(r.rulesetId) : undefined,
        });
      } catch (e) {
        // One malformed row (e.g. bad `properties` JSON) shouldn't cost
        // every other item in the index.
        console.error(`[itemRepo] Skipping malformed item index row "${r.id}":`, e);
      }
    }
    index = built;
  } catch (e) {
    // Degrade gracefully — an empty item index means item pickers show
    // nothing rather than the whole boot sequence aborting downstream
    // (see app/_layout.tsx boot()).
    console.error('[itemRepo] init failed — item index unavailable this session:', e);
  }
}

function getIndex(): ItemIndexEntry[] {
  return index;
}

async function ensureLoaded(ids: string[]): Promise<void> {
  const requested = new Set(ids);
  for (const id of ids) {
    const entry = index.find(item => item.id === id);
    const baseId = entry ? baseWeaponIdFromName(entry.name) : null;
    if (baseId && baseId !== id) requested.add(baseId);
  }
  const missing = Array.from(requested).filter(id => !fullCache.has(id));
  if (missing.length === 0) return;
  try {
    const db = getContentDb();
    const placeholders = missing.map(() => '?').join(',');
    const rows = await db.getAllAsync<{ id: string; data: string }>(
      `SELECT id, data FROM items WHERE id IN (${placeholders})`,
      missing
    );
    for (const row of rows) {
      try {
        fullCache.set(row.id, JSON.parse(row.data) as Item);
      } catch (e) {
        // A malformed record just stays missing from the cache — callers
        // already handle an unresolved item id as "not found," and the id
        // stays eligible for a retry on the next ensureLoaded() call.
        console.error(`[itemRepo] Skipping malformed item record "${row.id}":`, e);
      }
    }
  } catch (e) {
    // Query-level failure (e.g. a SQLite hiccup) — leave `missing` uncached
    // rather than throwing, so one bad ensureLoaded() call doesn't take
    // down the caller (e.g. character hydration in characterStore.ts).
    console.error('[itemRepo] ensureLoaded failed:', e);
  }
}

function getItemSync(id: string): Item | undefined {
  return fullCache.get(id);
}

export const itemRepo: ItemRepo = { init, getIndex, ensureLoaded, getItemSync };
