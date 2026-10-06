// ============================================================================
// FILE: src/content/conditions/conditions2024.ts
// The conditions of the 2024 rules (System Reference Document 5.2.1, "Rules Glossary", Creative Commons Attribution 4.0), used by
// 5.5e characters and campaigns. They keep the 5e ids (`blinded`, `grappled`, ...) because the engine reads those ids (Incapacitated
// blocks actions, Speed 0 comes from the condition's feature), and are told apart by `rulesetId: 'dnd5e-2024'`: a 5.5e character
// resolves the 2024 record, every other character the 2014 one (conditionsForRuleset).
//
// What changed from the 2014 conditions, and what the app does with it:
//   - the wording is the SRD 5.2.1 glossary's, taken from the rules reference data so there is one copy of the text;
//   - Petrified now makes you immune to the Poisoned condition (modeled), instead of poison damage and disease;
//   - Grappled now gives Disadvantage on attacks against anyone but the grappler, Prone gives Advantage to attackers within
//     5 feet, Unconscious is Incapacitated and Prone, Incapacitated also breaks Concentration and gives Disadvantage on Initiative:
//     facts about who attacks whom, or about other conditions, that the engine does not track, so they stay text, as the
//     2014 conditions' target-side facts already do;
//   - the automated parts are the same as before: Speed 0, a creature's own attack rolls and checks having Disadvantage or
//     Advantage, Resistance to all damage, and the incapacitating conditions blocking actions.
// Exhaustion has its own rules (conditionMonitor and engine/exhaustion.ts), so it is not a record here.
// ============================================================================
import type { Condition, Effect, RulesetId } from '../../engine/types';
import { ALL_CONDITIONS } from './index';
import { GLOSSARY_2024 } from '../rules/rulesReference2024Data';

const R2024 = 'dnd5e-2024' as RulesetId;

const textOf = (name: string): string => {
  const entry = GLOSSARY_2024.find(e => e.name === name && e.tag === 'Condition');
  if (!entry) throw new Error(`The SRD 5.2.1 glossary has no ${name} condition.`);
  return entry.text.replace(/\n\n/g, ' ').replace(/\s+/g, ' ').trim();
};

const poisonImmunity = {
  id: 'petrified_poison_immunity', name: 'Petrified', description: 'You have Immunity to the Poisoned condition.',
  source: { kind: 'condition' as const, refId: 'petrified' }, level: null,
  effects: [{ type: 'condition_immunity', target: 'poisoned', operation: 'immunity', value: null, condition: null } as Effect],
  actions: [], choices: [], passive: true,
};

export const CONDITIONS_2024: Condition[] = ALL_CONDITIONS.map(c => ({
  ...c,
  rulesetId: R2024,
  description: textOf(c.name),
  features: c.id === 'petrified' ? [...c.features, poisonImmunity] : c.features,
}));
