// ============================================================================
// FILE: src/content/spellChoiceFilter.ts
// What a `kind: 'spell'` choice offers. Without a `spellFilter` it is the original rule: the character's own
// class list, cantrips for a cantrip choice, otherwise level 1 up to the highest level they can cast. With a
// SpellPickFilter the choice can draw on other classes' lists (Magical Secrets, Blessed Warrior, Pact of the
// Tome), name exact levels (Mystic Arcanum) and ignore the slot cap. Pure, so the picker and the tests share it.
// ============================================================================
import { ChoiceDefinition, SpellPickFilter } from '../engine/types';
import { isSpellInClassPool } from './spellLists';

type PoolSpell = { id: string; level: number; school: string; ritual: boolean; classes?: string[] };

export const isCantripChoiceDef = (def: Pick<ChoiceDefinition, 'id'>): boolean => def.id.includes('cantrip');

/** True when the choice carries its own pool rules, so it is resolved on its own and never folded into the class's cantrip/spell groups. */
export const hasOwnSpellPool = (def: Pick<ChoiceDefinition, 'spellFilter'>): boolean => !!def.spellFilter;

export function spellMatchesChoice(
  spell: PoolSpell,
  def: Pick<ChoiceDefinition, 'id' | 'spellFilter'>,
  ctx: { ownClassId: string | null | undefined; maxCastableLevel: number },
): boolean {
  const f: SpellPickFilter | undefined = def.spellFilter;
  const cantrip = isCantripChoiceDef(def);

  if (f?.levels) {
    if (!f.levels.includes(spell.level)) return false;
  } else if (cantrip) {
    if (spell.level !== 0) return false;
  } else {
    if (spell.level === 0) { if (!f?.includeCantrips) return false; }
    else if (!f?.ignoreSlotCap && spell.level > ctx.maxCastableLevel) return false;
  }

  if (f?.schools && !f.schools.includes(spell.school)) return false;
  if (f?.ritualOnly && !spell.ritual) return false;

  if (!f?.lists) return isSpellInClassPool(spell, ctx.ownClassId ?? '');
  if (f.lists === 'any') return true;
  // An explicit list means explicit membership: an untagged spell is not on every class's list here.
  return f.lists.some(id => (spell.classes ?? []).includes(id));
}

export function candidateSpellsForChoice<T extends PoolSpell>(
  all: readonly T[],
  def: Pick<ChoiceDefinition, 'id' | 'spellFilter'>,
  ctx: { ownClassId: string | null | undefined; maxCastableLevel: number },
): T[] {
  return all.filter(s => spellMatchesChoice(s, def, ctx));
}
