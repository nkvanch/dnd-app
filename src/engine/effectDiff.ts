// src/engine/effectDiff.ts
// Before/after diff of the NON-NUMERIC things a piece of content changes on a character: damage
// resistances/immunities/vulnerabilities, condition immunities, senses, non-walking movement,
// advantage/disadvantage, and tool/weapon/armor/language proficiencies. The numeric diff (abilities, AC, speed,
// HP, skills) lives in the row builders; this is what the Test button used to leave out, so a homebrew trait
// like "resistance to psychic damage" worked on the sheet but never showed up when a creator tested it.
import type { Entity, ActiveEffect } from './types';
import { collectAllEffects } from './pipeline';

export type EffectSetDiff = { gained: string[]; lost: string[] };

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** The set of human-readable defensive/utility facts an entity currently has, keyed so before/after can be compared. */
function facts(entity: Entity): Map<string, string> {
  const out = new Map<string, string>();
  const effects: ActiveEffect[] = collectAllEffects(entity);
  for (const ae of effects) {
    const e = ae.effect;
    if (e.type === 'grant_resistance') {
      const kind = e.operation === 'vulnerability' ? 'Vulnerability' : 'Resistance';
      out.set(`res:${kind}:${e.target}`, `${kind}: ${e.target}`);
    } else if (e.type === 'grant_immunity') {
      out.set(`imm:${e.target}`, `Immunity: ${e.target}`);
    } else if (e.type === 'condition_immunity') {
      out.set(`cimm:${e.target}`, `Immune to being ${e.target}`);
    }
  }
  for (const s of entity.derived.senses ?? []) out.set(`sense:${s.type}`, `${cap(s.type)}: ${s.range} ft`);
  for (const [type, range] of Object.entries(entity.derived.movement ?? {})) {
    if (range) out.set(`move:${type}`, `${cap(type)} speed: ${range} ft`);
  }
  for (const a of entity.derived.advantageStates ?? []) {
    out.set(`adv:${a.state}:${a.target}`, `${cap(a.state)}: ${a.target}`);
  }
  const p = entity.proficiencies;
  for (const t of p.tools ?? []) out.set(`tool:${t.toLowerCase()}`, `Tool proficiency: ${t}`);
  for (const w of p.weapons ?? []) out.set(`weapon:${w.toLowerCase()}`, `Weapon proficiency: ${w}`);
  for (const a of p.armor ?? []) out.set(`armor:${a.toLowerCase()}`, `Armor proficiency: ${a}`);
  for (const l of p.languages ?? []) out.set(`lang:${l.toLowerCase()}`, `Language: ${l}`);
  return out;
}

export function diffEffectSets(before: Entity, after: Entity): EffectSetDiff {
  const b = facts(before);
  const a = facts(after);
  return {
    gained: [...a].filter(([k]) => !b.has(k)).map(([, label]) => label),
    lost: [...b].filter(([k]) => !a.has(k)).map(([, label]) => label),
  };
}
