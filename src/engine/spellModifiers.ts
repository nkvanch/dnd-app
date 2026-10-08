// ============================================================================
// FILE: src/engine/spellModifiers.ts
// Typed modifications to a spell the character already has, authored as ordinary stat_modifier
// effects on a target that names the spell:
//
//   spell_range:<spellId>          operation 'set', value = feet      "Eldritch Blast's range becomes 300 ft"
//   spell_damage_bonus:<spellId>   operation 'add', value and/or      "add your Charisma modifier to the
//                                  addAbilityModifier                  damage of Eldritch Blast"
//
// Deliberately only these two typed modifications, not a formula language: the proposal this comes
// from asks for typed changes (range, extra damage, ...) rather than arbitrary expressions. They are
// read when an action card is built, so the card shows the real range and per-hit damage. Spell
// resolution itself stays with the player, as everywhere else in the app.
// ============================================================================
import { Entity } from './types';
import { collectAllEffects, effectiveAbilityScores, modifier } from './pipeline';

/** The longest `set` range (in feet) any active effect gives this spell, or null for no override. */
export function spellRangeOverride(entity: Entity, spellId: string): number | null {
  const target = `spell_range:${spellId}`;
  const values = collectAllEffects(entity)
    .filter(ae => ae.effect.target === target && ae.effect.operation === 'set' && typeof ae.effect.value === 'number')
    .map(ae => ae.effect.value as number);
  return values.length ? Math.max(...values) : null;
}

/** Total flat damage added per hit of this spell by active effects (0 when none). */
export function spellDamageBonus(entity: Entity, spellId: string): number {
  const target = `spell_damage_bonus:${spellId}`;
  const matching = collectAllEffects(entity).filter(ae => ae.effect.target === target && ae.effect.operation === 'add');
  if (matching.length === 0) return 0;
  const scores = effectiveAbilityScores(entity);
  return matching.reduce((sum, ae) => {
    const flat = typeof ae.effect.value === 'number' ? ae.effect.value : 0;
    const ability = ae.effect.addAbilityModifier ? modifier(scores[ae.effect.addAbilityModifier]) : 0;
    return sum + flat + ability;
  }, 0);
}
