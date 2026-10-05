// ============================================================================
// FILE: src/content/spells/spellVersions.ts
// One spell id, several editions. The library holds one record per spell id; for a character on the 2024 ruleset
// the same id resolves to the System Reference Document 5.2.1 version of it (spellVersions2024.ts), overlaid on the
// library record so everything the version does not state (classes, tags, srd flag) is kept. Any other ruleset, and
// every spell without a version (homebrew, the six spells new in 2024), resolves to the record itself. Results are
// cached per id so repeated lookups return the same object.
// ============================================================================
import type { RulesetId, Spell } from '../../engine/types';
import { SPELL_VERSIONS_2024 } from './spellVersions2024';

const RULESET_2024: RulesetId = 'dnd5e-2024' as RulesetId;
const cache = new Map<string, Spell>();

/** Whether this spell has a different version under the ruleset. */
export function hasSpellVersion(spellId: string, rulesetId?: RulesetId | null): boolean {
  return rulesetId === RULESET_2024 && spellId in SPELL_VERSIONS_2024;
}

export function resolveSpellVersion<T extends Spell | undefined>(spell: T, rulesetId?: RulesetId | null): T {
  if (!spell || rulesetId !== RULESET_2024) return spell;
  // A spell that belongs to one ruleset by definition (the six new in 2024) has nothing to override.
  if (spell.rulesetId) return spell;
  const version = SPELL_VERSIONS_2024[spell.id];
  if (!version) return spell;
  const cached = cache.get(spell.id);
  if (cached && cached.srd === spell.srd && cached.classes === spell.classes) return cached as T;
  const resolved: Spell = { ...spell, ...version, rulesetId: RULESET_2024 };
  cache.set(spell.id, resolved);
  return resolved as T;
}
