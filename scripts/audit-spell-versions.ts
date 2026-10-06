// Classifies every spell for the readiness audit:
//   shared          same name in both packs and the same mechanics line (level, school, casting time, range, duration, components) and near-identical text
//   version-specific  a separate 2024 record exists; the 2024 provider must hand out the 2024 one and the 2014 provider the 2014 one
//   unresolved      a 5.1-only spell a 2024 character's provider still hands out, or a 2024-only spell a 2014 character's provider does
import { buildSrd51Pack, buildSrd521Pack, serializePack } from '../src/content/packs/srdPacks';
import { packContentProvider } from '../src/content/provider/contentProvider';
import { RulesetId } from '../src/engine/types';

const packs = [buildSrd51Pack(), buildSrd521Pack()].map(p => JSON.parse(serializePack(p)));
const p14 = packContentProvider(packs, 'dnd5e-2014' as RulesetId);
const p24 = packContentProvider(packs, 'dnd5e-2024' as RulesetId);
const all14 = (packs[0].homebrew.spells ?? []) as any[];
const all24 = (packs[1].homebrew.spells ?? []) as any[];
const n = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '');
const names14 = new Map(all14.map(s => [n(s.name), s]));
const names24 = new Map(all24.map(s => [n(s.name), s]));
const mech = (s: any) => JSON.stringify([s.level, n(s.school), n(s.castingTime), n(s.range), n(s.duration), [...(s.components ?? [])].sort(), !!s.concentration, !!s.ritual]);
const words = (s: any) => new Set(n2(String([s.description, s.upcast].filter(Boolean).join(' '))).split(' '));
const n2 = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const overlap = (a: any, b: any) => { const x = words(a), y = words(b); return [...x].filter(w => y.has(w)).length / Math.max(x.size, y.size, 1); };

const sharedSameRules: string[] = [], versionSpecific: string[] = [], only51: string[] = [], only521: string[] = [], wrongResolution: string[] = [];
for (const [k, s14] of names14) {
  const s24 = names24.get(k);
  if (!s24) { only51.push(s14.name); continue; }
  if (mech(s14) === mech(s24) && overlap(s14, s24) >= 0.9) sharedSameRules.push(s14.name); else versionSpecific.push(s14.name);
  // whichever way it is classified, each ruleset's provider must return that ruleset's own record
  const r24 = p24.getSpell(s24.id), r14 = p14.getSpell(s14.id);
  if (!r24 || mech(r24) !== mech(s24) || overlap(r24, s24) < 0.99) wrongResolution.push(`${s24.name}: a 2024 character does not get the SRD 5.2.1 record`);
  if (!r14 || mech(r14) !== mech(s14) || overlap(r14, s14) < 0.99) wrongResolution.push(`${s14.name}: a 2014 character does not get the SRD 5.1 record`);
}
for (const [k, s24] of names24) if (!names14.has(k)) only521.push(s24.name);

const unresolved = {
  only51SeenBy2024: p24.spells().filter((x: any) => !x.rulesetId && !names24.has(n(x.name))).map((x: any) => x.name),
  only521SeenBy2014: p14.spells().filter((x: any) => names24.has(n(x.name)) && !names14.has(n(x.name))).map((x: any) => x.name),
  ruleset2024RecordsSeenBy2014: p14.spells().filter((x: any) => x.rulesetId === 'dnd5e-2024').map((x: any) => x.name),
};
const mechChanged = versionSpecific.filter(name => mech(names14.get(n(name))) !== mech(names24.get(n(name))));
console.log(JSON.stringify({
  counts: { pack51: all14.length, pack521: all24.length },
  sharedSameRules: sharedSameRules.length, versionSpecific: versionSpecific.length, mechanicsLineChanged: mechChanged.length,
  only51: only51.length, only521: only521.length, wrongResolution,
  unresolved, only51List: only51, only521List: only521, sharedList: sharedSameRules, mechanicsLineChangedList: mechChanged,
}, null, 1));
