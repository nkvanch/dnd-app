// Imported/saved traits carry compiled mechanics the builders can't turn back into an editable effect kind.
// They used to be labelled "Flavor only"; this summary is what the builders show instead.
import { describeFeatureMechanics, mechanicsLabel } from '../featureMechanics';
import { buildUnderstudyPack } from '../../../demo/sample-packs/samplePacks';
import type { Feature, ResourceGrant } from '../../engine/types';

const sub = buildUnderstudyPack().homebrew!.subclasses![0];
const featureByName = (name: string) =>
  sub.entries.flatMap(e => e.grants.filter(g => g.kind === 'feature').map(g => g.value as Feature)).find(f => f.name === name)!;
const poolsFor = (f: Feature) =>
  sub.entries.flatMap(e => e.grants.filter(g => g.kind === 'resource').map(g => g.value as ResourceGrant)).filter(r => r.resourceId.startsWith(f.id));

describe('the Understudy pack traits (the exact case the stress test hit)', () => {
  it('Borrowed Roles reports its resource pool', () => {
    const f = featureByName('Borrowed Roles');
    expect(mechanicsLabel([f], poolsFor(f))).toMatch(/^Mechanics kept: .*Borrowed Roles.*3\/long rest/);
  });
  it('Costume Guard reports the AC bonus', () => {
    expect(mechanicsLabel([featureByName('Costume Guard')])).toContain('AC +1');
  });
  it('Cue the Spotlight reports an action ability', () => {
    expect(mechanicsLabel([featureByName('Cue the Spotlight')])).toContain('action ability');
  });
  it('Steady Nerves reports psychic resistance', () => {
    expect(mechanicsLabel([featureByName('Steady Nerves')])).toContain('Resist psychic');
  });
  it('none of them is called Flavor only', () => {
    for (const n of ['Borrowed Roles', 'Costume Guard', 'Cue the Spotlight', 'Steady Nerves']) {
      const f = featureByName(n);
      expect(mechanicsLabel([f], poolsFor(f))).not.toBe('Flavor only');
    }
  });
});

describe('genuinely text-only traits stay labelled as such', () => {
  const text: Feature = { id: 't', name: 'Story', description: 'Just words', source: { kind: 'subclass', refId: 's' }, level: 3, effects: [], actions: [], choices: [], passive: true } as Feature;
  it('no effects, no activation, no resource => Flavor only', () => {
    expect(describeFeatureMechanics([text])).toEqual([]);
    expect(mechanicsLabel([text])).toBe('Flavor only');
  });
});

describe('describing the effect types', () => {
  const eff = (o: Record<string, unknown>) => ({ value: null, condition: null, ...o });
  const f = (effects: unknown[]): Feature => ({ id: 'x', name: 'X', description: '', source: { kind: 'feat', refId: 'x' }, level: null, effects, actions: [], choices: [], passive: true } as Feature);
  it.each([
    [eff({ type: 'stat_modifier', target: 'speed', operation: 'add', value: 10 }), 'SPEED +10'.toLowerCase()],
    [eff({ type: 'stat_modifier', target: 'con', operation: 'add', value: 1 }), 'CON +1'],
    [eff({ type: 'stat_modifier', target: 'speed', operation: 'scale', value: 2 }), 'speed ×2'],
    [eff({ type: 'grant_proficiency', target: 'skill:stealth', operation: 'multiply' }), 'Expertise: stealth'],
    [eff({ type: 'grant_proficiency', target: 'armor:heavy', operation: 'add' }), 'Proficiency: heavy'],
    [eff({ type: 'condition_immunity', target: 'poisoned', operation: 'immunity' }), 'Immune to being poisoned'],
    [eff({ type: 'grant_sense', target: 'senses', operation: 'add', senseType: 'darkvision', senseRange: 60 }), 'darkvision 60 ft'],
  ])('%j', (effect, expected) => {
    expect(describeFeatureMechanics([f([effect])]).join('|').toLowerCase()).toContain(String(expected).toLowerCase());
  });
});
