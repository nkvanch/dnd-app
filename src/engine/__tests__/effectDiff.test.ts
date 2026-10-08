// The Test button used to omit resistances (and other non-numeric effects): a homebrew trait granting psychic
// resistance worked on the sheet but the creator's Test showed nothing for it (Understudy / Steady Nerves).
import { makeEmptyEntity, DEFAULT_RULES } from '../../store/characterStore';
import { recomputeDerived } from '../pipeline';
import { applyGrant } from '../leveling';
import { simulate } from '../simulate';
import { diffEffectSets } from '../effectDiff';
import { buildFeatSummaryRows } from '../../components/FeatPreviewModal';
import { buildFeatureGrantRows } from '../../components/sheet/featureGrantRows';
import { buildUnderstudyPack } from '../../../demo/sample-packs/samplePacks';
import type { Entity, Feature, Effect } from '../types';

const eff = (o: Partial<Effect> & Pick<Effect, 'type' | 'target' | 'operation'>): Effect => ({ value: null, condition: null, ...o } as Effect);
const feat = (id: string, effects: Effect[]): Feature => ({
  id, name: id, description: '', source: { kind: 'feat', refId: id }, level: null, effects, actions: [], choices: [], passive: true,
} as Feature);
const scratch = (): Entity => recomputeDerived({ ...makeEmptyEntity('t'), identity: { ...makeEmptyEntity('t').identity, level: 1 } }, DEFAULT_RULES);
const grant = (f: Feature) => simulate(scratch(), e => applyGrant(e, { kind: 'feature', value: f }, 1), DEFAULT_RULES);

describe('diffEffectSets', () => {
  it.each([
    ['resistance', eff({ type: 'grant_resistance', target: 'psychic', operation: 'resistance' }), 'Resistance: psychic'],
    ['vulnerability', eff({ type: 'grant_resistance', target: 'fire', operation: 'vulnerability' }), 'Vulnerability: fire'],
    ['immunity', eff({ type: 'grant_immunity', target: 'poison', operation: 'immunity' }), 'Immunity: poison'],
    ['condition immunity', eff({ type: 'condition_immunity', target: 'poisoned', operation: 'immunity' }), 'Immune to being poisoned'],
    ['sense', eff({ type: 'grant_sense', target: 'senses', operation: 'add', senseType: 'darkvision', senseRange: 60 }), 'Darkvision: 60 ft'],
    ['flying', eff({ type: 'grant_movement', target: 'movement', operation: 'add', movementType: 'fly', movementRange: 30 }), 'Fly speed: 30 ft'],
    ['weapon proficiency', eff({ type: 'grant_proficiency', target: 'weapon:rapier', operation: 'add' }), 'Weapon proficiency: rapier'],
    ['armor proficiency', eff({ type: 'grant_proficiency', target: 'armor:heavy', operation: 'add' }), 'Armor proficiency: heavy'],
  ])('reports %s as gained', (_n, effect, label) => {
    const { before, after } = grant(feat('x', [effect]));
    expect(diffEffectSets(before, after).gained).toContain(label);
  });

  it('reports nothing when nothing changes', () => {
    const { before, after } = grant(feat('empty', []));
    expect(diffEffectSets(before, after)).toEqual({ gained: [], lost: [] });
  });

  it('is symmetric: removing content reports what was lost', () => {
    const { before, after } = grant(feat('r', [eff({ type: 'grant_resistance', target: 'psychic', operation: 'resistance' })]));
    expect(diffEffectSets(after, before).lost).toContain('Resistance: psychic');
  });
});

describe('the Test rows a creator sees', () => {
  it('the Understudy\'s Steady Nerves (psychic resistance) now appears in the subclass Test', () => {
    const sub = buildUnderstudyPack().homebrew!.subclasses![0];
    const { before, after } = simulate(scratch(), e => {
      let u = e;
      for (const entry of sub.entries) for (const g of entry.grants) u = applyGrant(u, g, entry.level, sub.classId);
      return u;
    }, DEFAULT_RULES);
    expect(buildFeatSummaryRows(before, after).map(r => r.label)).toContain('Resistance: psychic');
  });

  it('feature add/remove rows show gains and losses', () => {
    const { before, after } = grant(feat('r', [eff({ type: 'grant_resistance', target: 'psychic', operation: 'resistance' })]));
    expect(buildFeatureGrantRows(before, after).map(r => r.label)).toContain('Resistance: psychic');
    expect(buildFeatureGrantRows(after, before).map(r => r.label)).toContain('No longer: Resistance: psychic');
  });

  it('numeric rows are unchanged (AC still reported)', () => {
    const { before, after } = grant(feat('ac', [eff({ type: 'stat_modifier', target: 'ac', operation: 'add', value: 1 })]));
    expect(buildFeatSummaryRows(before, after).some(r => /AC/.test(r.label))).toBe(true);
  });
});
