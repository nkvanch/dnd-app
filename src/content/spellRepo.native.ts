// ============================================================================
// FILE: src/content/spellRepo.native.ts
// Native (SQLite-backed) implementation — Metro resolves this file in place
// of spellRepo.ts on iOS/Android builds via its .native platform-extension
// convention, so the giant static spell arrays
// (src/content/spells/generated.ts, ~550KB) are never pulled into this
// file's import tree and therefore never bundled on native. See
// scripts/generate-content-db.mjs for how the seed DB (assets/content.db)
// is produced, and src/db/contentDb.ts for how it's copied onto the device
// and opened.
//
// Two-tier cache:
//  - Tier 1 (index): eager, built once from the DB's lightweight indexed
//    columns — powers browse/search UIs, no description/upcast payload.
//  - Tier 2 (full records): warm on-demand Map<id, Spell>, populated by
//    ensureLoaded() for ids a loaded character actually references (or a
//    UI has actually expanded). Read synchronously via getSpellSync() so
//    the engine pipeline (recomputeDerived, generateAllActionCards) stays
//    fully synchronous — no async rewrite of the mutation handlers that
//    call it.
// ============================================================================
import { Spell, asRulesetId } from '../engine/types';
import { getContentDb } from '../db/contentDb';
import type { SpellIndexEntry, SpellRepo } from './spellRepo.types';

const SRD_ONLY = process.env.EXPO_PUBLIC_SRD_ONLY === 'true';

type SpellIndexRow = {
  id: string; name: string; level: number; school: string; castingTime: string;
  ritual: number; concentration: number; classes: string | null; srd: number | null;
  rulesetId: string | null; components: string | null;
};

let index: SpellIndexEntry[] = [];
const fullCache = new Map<string, Spell>();

async function init(): Promise<void> {
  if (index.length > 0) return;
  try {
    const db = getContentDb();
    const rows = await db.getAllAsync<SpellIndexRow>(
      'SELECT id, name, level, school, castingTime, ritual, concentration, classes, srd, rulesetId, components FROM spells'
    );
    const built: SpellIndexEntry[] = [];
    for (const r of rows) {
      if (SRD_ONLY && r.srd !== 1) continue;
      try {
        built.push({
          id:            r.id,
          name:          r.name,
          level:         r.level,
          school:        r.school,
          castingTime:   r.castingTime,
          ritual:        r.ritual === 1,
          concentration: r.concentration === 1,
          classes:       r.classes ? (JSON.parse(r.classes) as string[]) : undefined,
          srd:           r.srd === null ? undefined : r.srd === 1,
          rulesetId:     r.rulesetId ? asRulesetId(r.rulesetId) : undefined,
          components:    r.components ? (JSON.parse(r.components) as string[]) : undefined,
        });
      } catch (e) {
        // One malformed row (e.g. bad `classes` JSON) shouldn't cost every
        // other spell in the index.
        console.error(`[spellRepo] Skipping malformed spell index row "${r.id}":`, e);
      }
    }
    index = built;
  } catch (e) {
    // Degrade gracefully — an empty spell index means spell pickers show
    // nothing rather than the whole boot sequence aborting downstream
    // (see app/_layout.tsx boot()).
    console.error('[spellRepo] init failed — spell index unavailable this session:', e);
  }
}

function getIndex(): SpellIndexEntry[] {
  return index;
}

async function ensureLoaded(ids: string[]): Promise<void> {
  const missing = Array.from(new Set(ids)).filter(id => !fullCache.has(id));
  if (missing.length === 0) return;
  try {
    const db = getContentDb();
    const placeholders = missing.map(() => '?').join(',');
    const rows = await db.getAllAsync<{ id: string; data: string }>(
      `SELECT id, data FROM spells WHERE id IN (${placeholders})`,
      missing
    );
    for (const row of rows) {
      try {
        fullCache.set(row.id, JSON.parse(row.data) as Spell);
      } catch (e) {
        // A malformed record just stays missing from the cache — callers
        // already handle an unresolved spell id as "not found," and the id
        // stays eligible for a retry on the next ensureLoaded() call.
        console.error(`[spellRepo] Skipping malformed spell record "${row.id}":`, e);
      }
    }
  } catch (e) {
    // Query-level failure (e.g. a SQLite hiccup) — leave `missing` uncached
    // rather than throwing, so one bad ensureLoaded() call doesn't take
    // down the caller (e.g. character hydration in characterStore.ts).
    console.error('[spellRepo] ensureLoaded failed:', e);
  }
}

function getSpellSync(id: string): Spell | undefined {
  return fullCache.get(id);
}

export const spellRepo: SpellRepo = { init, getIndex, ensureLoaded, getSpellSync };
