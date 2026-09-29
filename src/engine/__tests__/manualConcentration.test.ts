// Manual End Concentration (player/DM ends it by hand) + the pure rules the
// Spells tab uses to tell a spell-slot cast from a ritual cast.
import { makeEmptyEntity, DEFAULT_RULES } from '../../store/characterStore';
import { castConcentrationSpell, concentrationLinkedEffectNames, endConcentration } from '../combat';
import { castButtonStates, castHistoryLabel } from '../../components/sheet/spellTabUi';
import type { Entity, FeatureInstance, Spell } from '../types';

const slots = () => ({
  '1': { total: 2, used: 0 }, '2': { total: 0, used: 0 }, '3': { total: 0, used: 0 },
  '4': { total: 0, used: 0 }, '5': { total: 0, used: 0 }, '6': { total: 0, used: 0 },
  '7': { total: 0, used: 0 }, '8': { total: 0, used: 0 }, '9': { total: 0, used: 0 },
});
const caster = (): Entity => ({
  ...makeEmptyEntity('conc'),
  spellcasting: { ability: 'wis', slots: slots(), cantrips: [], known: [], prepared: [], concentrating: null },
});
const buffFeature = (name: string): FeatureInstance => ({
  id: 'f_' + name, name, description: '', level: null, effects: [], actions: [], choices: [],
  passive: true, isActive: true, source: { kind: 'spell', refId: 'bless' },
}) as FeatureInstance;
const bless = (): Spell => ({
  id: 'bless', name: 'Bless', level: 1, school: 'enchantment', castingTime: '1 action', range: '30 feet',
  components: ['V', 'S'], duration: 'Concentration, up to 1 minute', description: '', upcast: null,
  ritual: false, concentration: true, onConcentrationFeatures: [buffFeature('Blessed')],
} as Spell);

describe('endConcentration (manual)', () => {
  it('ends concentration, clears the duration tracker and removes the spell\'s linked effects', () => {
    const concentrating = castConcentrationSpell(caster(), bless(), DEFAULT_RULES);
    expect(concentrating.spellcasting!.concentrating).toBe('bless');
    expect(concentrating.features.some(f => f.name === 'Blessed')).toBe(true);

    const ended = endConcentration(concentrating, DEFAULT_RULES);
    expect(ended.spellcasting!.concentrating).toBeNull();
    expect(ended.spellcasting!.concentratingDuration).toBeUndefined();
    expect(ended.conditionMonitor.flags.concentrating).toBe(false);
    expect(ended.features.some(f => f.name === 'Blessed')).toBe(false);
  });

  it('leaves unrelated features alone', () => {
    const other: FeatureInstance = { ...buffFeature('Racial Trait'), source: { kind: 'race', refId: 'elf' } } as FeatureInstance;
    const e = castConcentrationSpell({ ...caster(), features: [other] }, bless(), DEFAULT_RULES);
    expect(endConcentration(e, DEFAULT_RULES).features.map(f => f.name)).toContain('Racial Trait');
  });

  it('is a no-op (same object) when not concentrating', () => {
    const e = caster();
    expect(endConcentration(e, DEFAULT_RULES)).toBe(e);
  });

  it('does not touch spell slots (ending is not casting)', () => {
    const e = castConcentrationSpell(caster(), bless(), DEFAULT_RULES);
    expect(endConcentration(e, DEFAULT_RULES).spellcasting!.slots).toEqual(e.spellcasting!.slots);
  });
});

describe('concentrationLinkedEffectNames', () => {
  it('lists exactly the effects that end with the concentration', () => {
    const e = castConcentrationSpell(caster(), bless(), DEFAULT_RULES);
    expect(concentrationLinkedEffectNames(e)).toEqual(['Blessed']);
  });
  it('is empty when not concentrating', () => {
    expect(concentrationLinkedEffectNames(caster())).toEqual([]);
  });
});

describe('castHistoryLabel — slot vs ritual is always distinguishable', () => {
  const ordinal = (l: number) => ['', '1st', '2nd', '3rd'][l] ?? `${l}th`;
  it('ritual cast says (Ritual)', () => {
    expect(castHistoryLabel({ name: 'Detect Magic', castMode: 'ritual', ritualCapable: true, ordinal })).toBe('Cast Detect Magic (Ritual)');
  });
  it('slot cast of a ritual-capable spell says (spell slot)', () => {
    expect(castHistoryLabel({ name: 'Detect Magic', ritualCapable: true, baseLevel: 1, castLevel: 1, ordinal })).toBe('Cast Detect Magic (spell slot)');
  });
  it('upcast slot cast of a ritual-capable spell keeps both facts', () => {
    expect(castHistoryLabel({ name: 'Detect Magic', ritualCapable: true, baseLevel: 1, castLevel: 3, ordinal })).toBe('Cast Detect Magic at 3rd level (spell slot)');
  });
  it('a spell that cannot be ritual-cast keeps the plain label', () => {
    expect(castHistoryLabel({ name: 'Fire Bolt', ritualCapable: false, ordinal })).toBe('Cast Fire Bolt');
    expect(castHistoryLabel({ name: 'Bless', ritualCapable: false, baseLevel: 1, castLevel: 2, ordinal })).toBe('Cast Bless at 2nd level');
  });
});

describe('castButtonStates', () => {
  it('ritual-capable spell with no slot left: slot Cast is disabled but Ritual stays available', () => {
    expect(castButtonStates({ available: false, ritualEligible: true })).toEqual({ slotCastDisabled: true, showRitual: true, rowDimmed: false });
  });
  it('ordinary spell with no slot: disabled and dimmed, no ritual button', () => {
    expect(castButtonStates({ available: false })).toEqual({ slotCastDisabled: true, showRitual: false, rowDimmed: true });
  });
  it('a spell blocked only by preparation stays castable (Cast Anyway path)', () => {
    expect(castButtonStates({ available: false, preparationOverridable: true }).slotCastDisabled).toBe(false);
  });
  it('an available ritual-capable spell offers both ways to cast', () => {
    expect(castButtonStates({ available: true, ritualEligible: true })).toEqual({ slotCastDisabled: false, showRitual: true, rowDimmed: false });
  });
});
