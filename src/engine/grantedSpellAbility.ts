// ============================================================================
// FILE: src/engine/grantedSpellAbility.ts
// The spellcasting ability for a spell a feature grants (a species lineage spell, a Magic Initiate spell). Most grants fix it
// (`spellcastingAbility`). The 2024 rules let the player choose Intelligence, Wisdom or Charisma, so a grant can instead name a
// choice (`spellcastingAbilityFrom`): the choice's options are features whose ids are `<from>_int`, `<from>_wis` and `<from>_cha`,
// and the one the character holds is the ability. Until it is chosen the grant's own `spellcastingAbility` is the default.
// ============================================================================
import type { Ability, Effect, Entity } from './types';

export const CHOOSABLE_CASTING_ABILITIES: Ability[] = ['int', 'wis', 'cha'];

export function grantedSpellAbility(entity: Pick<Entity, 'features'>, eff: Pick<Effect, 'spellcastingAbility' | 'spellcastingAbilityFrom'>): Ability | undefined {
  if (eff.spellcastingAbilityFrom) {
    const chosen = CHOOSABLE_CASTING_ABILITIES.find(ab => entity.features.some(f => f.id === `${eff.spellcastingAbilityFrom}_${ab}` && f.isActive !== false));
    if (chosen) return chosen;
  }
  return eff.spellcastingAbility;
}
