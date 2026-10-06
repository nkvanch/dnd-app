// Prints a compact summary of each 2024 species as the app models it (for the readiness audit).
import { RACES_2024 } from '../src/content/races/races2024';
import { raceHuman2024 as human2024 } from '../src/content/races/index';

const eff = (e: any) => `${e.type}:${e.target || e.cantripIds || e.spellIds || e.senseType || ''}${e.value != null ? '=' + e.value : ''}${e.senseRange ? '/' + e.senseRange : ''}${e.minLevel ? '@L' + e.minLevel : ''}`;
const feat = (f: any) => `  - ${f.id}${f.level ? ' [L' + f.level + ']' : ''}${f.effects?.length ? ' {' + f.effects.map(eff).join(', ') + '}' : ''}${f.resourceGrants?.length ? ' pools:' + f.resourceGrants.map((r: any) => `${r.resourceId}(${r.maximum}${r.perProficiencyBonus ? ',PB' : ''},${r.recharge})`).join('|') : ''}`;
const all = [...RACES_2024, ...(human2024 ? [human2024] : [])] as any[];
for (const r of all) {
  console.log(`## ${r.id} size=${r.size ?? '?'} speed=${r.speed ?? '?'}`);
  r.features?.forEach((f: any) => console.log(feat(f)));
  r.subraces?.forEach((s: any) => { console.log(` sub ${s.id} size=${s.size ?? ''} speed=${s.speed ?? ''}`); s.features?.forEach((f: any) => console.log(' ' + feat(f))); });
  r.ancestryChoice?.options.forEach((o: any) => console.log(` anc ${o.id}: ${o.feature.effects?.map(eff).join(',')}`));
  if (r.choices) console.log(' choices:', JSON.stringify(r.choices.map((c: any) => c.id ?? c)).slice(0, 300));
}
