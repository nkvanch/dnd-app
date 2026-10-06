// ============================================================================
// FILE: src/content/spellAbilityChoice.ts
// "Intelligence, Wisdom, or Charisma is your spellcasting ability for these spells": the choice 2024 species lineages and
// Magic Initiate ask the player to make. Each option is a plain feature named `<from>_<ability>`; a grant_spell effect that sets
// `spellcastingAbilityFrom: <from>` reads which one the character holds (engine/grantedSpellAbility.ts).
// ============================================================================
import type { Ability, ChoiceDefinition, Effect, FeatureSource } from '../engine/types';
import { CHOOSABLE_CASTING_ABILITIES } from '../engine/grantedSpellAbility';
import { feature } from './homebrewPack/helpers';

const NAME: Record<string, string> = { int: 'Intelligence', wis: 'Wisdom', cha: 'Charisma' };

export function spellAbilityChoice(args: { choiceId: string; from: string; source: FeatureSource; what: string; fallback: Ability }): ChoiceDefinition {
  return {
    id: args.choiceId,
    prompt: `${args.what}: choose Intelligence, Wisdom, or Charisma as your spellcasting ability for these spells.`,
    kind: 'feature_pool', count: 1, grants: [], required: true, resolved: false,
    pool: CHOOSABLE_CASTING_ABILITIES.map(ab => ({
      id: `${args.from}_${ab}`, label: `${NAME[ab]}${ab === args.fallback ? ' (suggested)' : ''}`,
      value: feature({
        id: `${args.from}_${ab}`, name: `Spellcasting Ability: ${NAME[ab]}`, source: args.source,
        description: `${NAME[ab]} is your spellcasting ability for ${args.what}.`,
      }),
    })),
  };
}

/** A grant_spell effect whose ability is the chosen one (the fallback until it is chosen). */
export const chosenAbility = (eff: Effect, from: string, fallback: Ability): Effect => ({ ...eff, spellcastingAbility: fallback, spellcastingAbilityFrom: from });
