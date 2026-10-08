// src/content/featureMechanics.ts
// A short, truthful summary of what a COMPILED feature actually does, for the homebrew builders' trait
// lists. Builders can't always turn a saved/imported feature back into an editable effect kind (the effects
// are already-compiled Effect objects), so they used to label every such trait "Flavor only" even when it
// carried real mechanics. This reads the mechanics off the compiled feature instead.
import type { Feature, Effect, ResourceGrant } from '../engine/types';

const pretty = (s: string) => s.replace(/^(skill|tool|weapon|armor):/, '').replace(/_/g, ' ');
const signed = (n: number) => `${n >= 0 ? '+' : ''}${n}`;

function describeEffect(e: Effect): string | null {
  switch (e.type) {
    case 'stat_modifier': {
      if (e.operation === 'advantage') return `Advantage: ${e.target}`;
      if (e.operation === 'disadvantage') return `Disadvantage: ${e.target}`;
      if (typeof e.value !== 'number') return null;
      const stat = e.target.length <= 3 ? e.target.toUpperCase() : e.target.replace(/_/g, ' ');
      if (e.operation === 'set') return `${stat} = ${e.value}`;
      if (e.operation === 'scale') return `${stat} ×${e.value}`;
      if (e.operation === 'multiply') return `${stat} ×${e.value} (bonus)`;
      return `${stat} ${signed(e.value)}`;
    }
    case 'base_ac_formula':
      return `AC = ${e.value ?? 10}${(e.formulaAbilities ?? []).map(a => ` + ${a.toUpperCase()}`).join('')}`;
    case 'grant_proficiency':
      return `${e.operation === 'multiply' ? 'Expertise' : 'Proficiency'}: ${pretty(e.target)}`;
    case 'grant_resistance':
      return e.operation === 'vulnerability' ? `Vulnerable to ${e.target}` : `Resist ${e.target}`;
    case 'grant_immunity': return `Immune to ${e.target}`;
    case 'condition_immunity': return `Immune to being ${e.target}`;
    case 'suppress_condition_effects': return `Ignores ${e.target} effects`;
    case 'grant_sense': return `${e.senseType ?? 'sense'} ${e.senseRange ?? 0} ft`;
    case 'grant_movement': return `${e.movementType ?? 'move'} ${e.movementRange ?? 0} ft`;
    case 'grant_spell': return 'Grants spells';
    default: return null;
  }
}

/** Every mechanical thing the given compiled features (plus any resource pools granted alongside) do. */
export function describeFeatureMechanics(features: readonly Feature[], resources: readonly ResourceGrant[] = []): string[] {
  const out: string[] = [];
  for (const f of features) {
    for (const e of f.effects ?? []) {
      const d = describeEffect(e);
      if (d) out.push(d);
    }
    if (f.activation) {
      const cost = f.activation.resourceCost ? ', uses a resource' : '';
      out.push(`${f.activation.actionType.replace('_', ' ')} ability${cost}`);
    }
  }
  for (const r of resources) out.push(`${r.name}: ${r.maximum}/${String(r.recharge).replace('_', ' ')}`);
  return out;
}

/** The one-line label for a trait row: real mechanics when the feature has any, "Flavor only" when it is text. */
export function mechanicsLabel(features: readonly Feature[], resources: readonly ResourceGrant[] = []): string {
  const parts = describeFeatureMechanics(features, resources);
  return parts.length > 0 ? `Mechanics kept: ${parts.join(' · ')}` : 'Flavor only';
}
