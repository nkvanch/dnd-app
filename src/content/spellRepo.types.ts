// ============================================================================
// FILE: src/content/spellRepo.types.ts
// Shared types for spellRepo.ts (web/default) and spellRepo.native.ts
// (SQLite-backed). Both implementations import these so callers get a
// single, platform-independent type surface regardless of which one Metro
// actually resolves.
// ============================================================================
import { Entity, Feature, Spell, RulesetId } from '../engine/types';

/**
 * Tier 1 — the lightweight fields browse/filter/search UIs actually key on.
 * Deliberately excludes description/upcast/components/duration/range: those
 * are the bulk of a Spell record's size and are only needed for a spell a
 * player has actually expanded or added, which is what Tier 2
 * (ensureLoaded/getSpellSync) is for.
 */
export type SpellIndexEntry = {
  id:            string;
  name:          string;
  level:         number;
  school:        string;
  castingTime:   string;
  ritual:        boolean;
  concentration: boolean;
  classes?:      string[];
  srd?:          boolean;
  /**
   * TIER1-EXT-1: added so Ruleset (and the derived Source filter — see
   * getContentProvenance()) don't need a Tier-2 full-record load just to
   * filter — same reasoning as ItemIndexEntry.rulesetId.
   */
  rulesetId?:    RulesetId;
  /**
   * TIER1-EXT-1: V/S/M component letters — real field on the full Spell
   * type (`components: string[]`), added here specifically so the
   * Components filter doesn't need Tier-2 loading. A prior header comment
   * in AddSpellModal.tsx claimed this filter already existed when it
   * didn't (fixed this session) — this is what makes that claim true.
   */
  components?:   string[];
};

export interface SpellRepo {
  /** Must be called once at app startup before any other method is used. */
  init(): Promise<void>;
  /** The full lightweight index — every spell, eager, already SRD-filtered. */
  getIndex(): SpellIndexEntry[];
  /** Warms the Tier-2 full-record cache for the given ids. Idempotent. */
  ensureLoaded(ids: string[]): Promise<void>;
  /** Synchronous full-record lookup. Only returns a hit for ids already passed to ensureLoaded(). */
  getSpellSync(id: string): Spell | undefined;
}

/**
 * Every spell id a character actually references — cantrips, known,
 * prepared, PLUS spells granted by a feature rather than added to the
 * known-spell lists (a `cast_spell` abilityEffect, e.g. a racial "cast
 * Misty Step once per day", or a feature sourced directly from a spell —
 * see traitCompiler.ts's spell_grant effect kind and actionCards.ts's
 * findGrantedSpell). Tolerant of a partial entity (e.g. from a sync patch
 * that only touched some of these fields).
 */
export function spellIdsOnEntity(
  entity: { spellcasting?: Partial<Entity['spellcasting']> | null; features?: Feature[] }
): string[] {
  const ids = new Set<string>();
  if (entity.spellcasting) {
    for (const id of entity.spellcasting.cantrips ?? []) ids.add(id);
    for (const id of entity.spellcasting.known ?? [])    ids.add(id);
    for (const id of entity.spellcasting.prepared ?? []) ids.add(id);
  }
  for (const feature of entity.features ?? []) {
    if (feature.source?.kind === 'spell') ids.add(feature.source.refId);
    for (const effect of feature.abilityEffects ?? []) {
      if (effect.type === 'cast_spell') ids.add(effect.spellId);
    }
  }
  return Array.from(ids);
}
