import { RULE_PRESETS, presetProfiles, presetProfileId, isPresetProfileId } from '../rulePresets';
import { suggestFirst, suggestionRank, isSuggested } from '../rulesetSuggestion';
import { sanitizeProfileRules, resolveEffectiveCampaignRules, isProfileCompatible } from '../../engine/customRuleProfiles';
import { DEFAULT_RULES } from '../../store/characterStore';
import { useCustomRuleProfileStore } from '../../store/customRuleProfileStore';
import { RulesetId } from '../../engine/types';

const R14 = 'dnd5e-2014' as RulesetId;
const R24 = 'dnd5e-2024' as RulesetId;

describe('rule presets', () => {
  it('there is one preset each for 5e (2014) and 5.5e (2024), as real profiles with stable ids', () => {
    const ps = presetProfiles();
    expect(ps.map(p => p.id)).toEqual([presetProfileId(R14), presetProfileId(R24)]);
    expect(ps.every(p => p.source.kind === 'preset' && isPresetProfileId(p.id))).toBe(true);
  });

  it('every preset survives the profile sanitizer unchanged (nothing unsupported is claimed)', () => {
    for (const p of RULE_PRESETS) expect(sanitizeProfileRules(p.rules)).toEqual(p.rules);
  });

  it('2024 differs from 2014 exactly where the books differ and the app has a switch', () => {
    const a = RULE_PRESETS.find(p => p.rulesetId === R14)!.rules.customRules!;
    const b = RULE_PRESETS.find(p => p.rulesetId === R24)!.rules.customRules!;
    expect([a.featAtCreation, a.fullHitDiceOnLongRest, a.reminderPotionsBonusAction]).toEqual([false, false, false]);
    expect([b.featAtCreation, b.fullHitDiceOnLongRest, b.reminderPotionsBonusAction]).toEqual([true, true, true]);
  });

  it('a character using the 2024 preset resolves its rules through the existing overlay', () => {
    const rules = resolveEffectiveCampaignRules(DEFAULT_RULES, { rulesetId: R24, customRuleProfileId: presetProfileId(R24) }, presetProfiles());
    expect(rules.customRules).toMatchObject({ featAtCreation: true, fullHitDiceOnLongRest: true });
    const other = resolveEffectiveCampaignRules(DEFAULT_RULES, { rulesetId: R14, customRuleProfileId: presetProfileId(R14) }, presetProfiles());
    expect(other.customRules).toMatchObject({ featAtCreation: false });
    expect(isProfileCompatible(presetProfiles()[0], R24)).toBe(true);   // same game: switchable between 5e and 5.5e
  });

  it('the profile store always offers the presets and refuses to save or delete them', async () => {
    const store = useCustomRuleProfileStore.getState();
    expect(store.profiles.map(p => p.id)).toEqual(expect.arrayContaining([presetProfileId(R14), presetProfileId(R24)]));
    const res = await store.remove(presetProfileId(R24), new Set());
    expect(res.ok).toBe(false);
    await store.save({ ...presetProfiles()[0], name: 'tampered' });
    expect(useCustomRuleProfileStore.getState().profiles.find(p => p.id === presetProfileId(R14))!.name).not.toBe('tampered');
  });
});

describe('suggest the ruleset\'s content first', () => {
  const items = [
    { id: 'a', rulesetId: R14 }, { id: 'b' }, { id: 'c', rulesetId: R24 }, { id: 'd' }, { id: 'e', rulesetId: R24 },
  ];

  it('puts the active ruleset first, shared content next, other rulesets last, keeping order within each group', () => {
    expect(suggestFirst(items, R24).map(i => i.id)).toEqual(['c', 'e', 'b', 'd', 'a']);
    expect(suggestFirst(items, R14).map(i => i.id)).toEqual(['a', 'b', 'd', 'c', 'e']);
  });

  it('hides nothing and leaves the list alone with no active ruleset', () => {
    expect(suggestFirst(items, R24)).toHaveLength(items.length);
    expect(suggestFirst(items, undefined).map(i => i.id)).toEqual(['a', 'b', 'c', 'd', 'e']);
    expect(suggestFirst(items, R24)).not.toBe(items);
  });

  it('ranks and badges only what is tagged for the active ruleset', () => {
    expect(suggestionRank({ rulesetId: R24 }, R24)).toBe(0);
    expect(suggestionRank({}, R24)).toBe(1);
    expect(suggestionRank({ rulesetId: R14 }, R24)).toBe(2);
    expect(isSuggested({ rulesetId: R24 }, R24)).toBe(true);
    expect(isSuggested({}, R24)).toBe(false);
  });
});
