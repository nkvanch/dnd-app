import { ALL_CONDITIONS } from '../index';
import { CONDITIONS_2024 } from '../conditions2024';
import { conditionsForRuleset, conditionForRuleset } from '../resolve';
import { lookupConditionFor } from '../lookup';
import { applyCondition } from '../../../engine/conditions';
import { collectAllEffects } from '../../../engine/pipeline';
import { makeEmptyEntity, DEFAULT_RULES } from '../../../store/characterStore';
import { useHomebrewStore } from '../../../store/homebrewStore';
import { buildSrd51Pack, buildSrd521Pack, serializePack } from '../../packs/srdPacks';
import { PackStore, installOfficialPack, resetOfficialPackService } from '../../officialPackService';
import { clearOfficialPacks } from '../../officialPacks';
import { getOfficialContentProvider } from '../../officialSource';
import { RulesetId } from '../../../engine/types';

const R2024 = 'dnd5e-2024' as RulesetId;
const R2014 = 'dnd5e-2014' as RulesetId;
const store: PackStore = { save: async () => {}, load: async () => [], remove: async () => {} };
const json = (p: unknown) => JSON.parse(serializePack(p as never));
beforeEach(() => { resetOfficialPackService(); clearOfficialPacks(); });
afterAll(() => { resetOfficialPackService(); clearOfficialPacks(); });

describe('2024 conditions', () => {
  it('are the same conditions under the same ids, tagged 5.5e, with the SRD 5.2.1 wording', () => {
    expect(CONDITIONS_2024.map(c => c.id)).toEqual(ALL_CONDITIONS.map(c => c.id));
    for (const c of CONDITIONS_2024) { expect(c.rulesetId).toBe(R2024); expect(c.description.length).toBeGreaterThan(40); }
    expect(CONDITIONS_2024.find(c => c.id === 'frightened')!.description).toMatch(/Can't Approach/);
    expect(CONDITIONS_2024.find(c => c.id === 'unconscious')!.description).toMatch(/Inert\. You have the Incapacitated and Prone conditions/);
    expect(ALL_CONDITIONS.every(c => !c.rulesetId)).toBe(true);
    expect(ALL_CONDITIONS.find(c => c.id === 'frightened')!.description).not.toMatch(/Can't Approach/);
  });

  it('Petrified gives Immunity to the Poisoned condition in 5.5e only', () => {
    const effects = (list: typeof ALL_CONDITIONS) => list.find(c => c.id === 'petrified')!.features.flatMap(f => f.effects).filter(e => e.type === 'condition_immunity');
    expect(effects(CONDITIONS_2024)).toHaveLength(1);
    expect(effects(CONDITIONS_2024)[0].target).toBe('poisoned');
    expect(effects(ALL_CONDITIONS)).toHaveLength(0);
  });

  it('resolve per ruleset: a 5.5e character gets its own record, everyone else the 2014 one, "everything" gets both', () => {
    const all = [...ALL_CONDITIONS, ...CONDITIONS_2024];
    expect(conditionsForRuleset(all, R2024)).toHaveLength(14);
    expect(conditionsForRuleset(all, R2024).every(c => c.rulesetId === R2024)).toBe(true);
    expect(conditionsForRuleset(all, R2014)).toHaveLength(14);
    expect(conditionsForRuleset(all, R2014).every(c => !c.rulesetId)).toBe(true);
    expect(conditionsForRuleset(all, undefined)).toHaveLength(28);
    expect(conditionForRuleset(all, 'prone', R2024)!.rulesetId).toBe(R2024);
    expect(conditionForRuleset(all, 'prone', undefined)!.rulesetId).toBeUndefined();
    expect(conditionForRuleset(ALL_CONDITIONS, 'prone', R2024)!.id).toBe('prone');   // no 2024 record: the shared one
  });

  it('an ability that applies a condition gives a 5.5e character the 2024 record', () => {
    expect(lookupConditionFor('petrified', R2024)!.features.some(f => f.id === 'petrified_poison_immunity')).toBe(true);
    expect(lookupConditionFor('petrified', R2014)!.features.some(f => f.id === 'petrified_poison_immunity')).toBe(false);
    const e = makeEmptyEntity('c');
    const features = lookupConditionFor('petrified', R2024)!.features;
    const petrified = applyCondition({ ...e, rulesetId: R2024 }, 'petrified', 'manual', DEFAULT_RULES, features);
    expect(collectAllEffects(petrified).some(a => a.effect.type === 'condition_immunity' && a.effect.target === 'poisoned')).toBe(true);
  });

  it('with the packs installed each edition resolves its own, and the content DB offers one per id for the character\'s ruleset', async () => {
    for (const p of [buildSrd51Pack(), buildSrd521Pack()]) expect(await installOfficialPack(json(p), store)).toEqual({ ok: true });
    const provider = getOfficialContentProvider()!;
    expect(provider.getCondition('blinded', R2024)!.rulesetId).toBe(R2024);
    expect(provider.getCondition('blinded', R2014)!.rulesetId).toBeUndefined();
    const db = (r?: RulesetId) => useHomebrewStore.getState().getMergedContentDB(r).conditions;
    expect(db(R2024)).toHaveLength(14);
    expect(db(R2024).every(c => c.rulesetId === R2024)).toBe(true);
    expect(db(R2014).every(c => !c.rulesetId)).toBe(true);
    expect(lookupConditionFor('petrified', R2024)!.features.length).toBe(3);
  });
});
