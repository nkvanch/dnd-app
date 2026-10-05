import { FULL_SPELL_LIBRARY } from '../spells/index';
import { candidateSpellsForChoice, spellMatchesChoice } from '../spellChoiceFilter';
import { newChar, toLevel, bindSubclass } from '../classes2024/testKit';
import { applyPoolChoiceToEntity, applySpellChoiceToEntity } from '../../engine/leveling';
import { removeFeature } from '../../engine/leveling';
import { DEFAULT_RULES } from '../../store/characterStore';
import { Entity } from '../../engine/types';

const all = FULL_SPELL_LIBRARY as any[];
const level = (id: string) => all.find(s => s.id === id)?.level;
const ids = (list: any[]) => list.map(s => s.id);

describe('spell choice filter', () => {
  it('without a filter it is the original rule: own class list, slot-capped, cantrips by id', () => {
    const own = { ownClassId: 'wizard_2024', maxCastableLevel: 2 };
    const cantrips = candidateSpellsForChoice(all, { id: 'x_cantrips' }, own);
    expect(cantrips.every(s => s.level === 0)).toBe(true);
    const spells = candidateSpellsForChoice(all, { id: 'x_spells' }, own);
    expect(spells.every(s => s.level >= 1 && s.level <= 2)).toBe(true);
  });

  it('lists is a union of explicit lists; an untagged spell is not on every list', () => {
    const f = { id: 'c_cantrips', spellFilter: { lists: ['cleric_2024', 'druid_2024'] } };
    const out = candidateSpellsForChoice(all, f, { ownClassId: 'paladin_2024', maxCastableLevel: 1 });
    expect(out.length).toBeGreaterThan(5);
    expect(ids(out)).toContain('guidance');
    expect(out.every(s => (s.classes ?? []).some((c: string) => c === 'cleric_2024' || c === 'druid_2024'))).toBe(true);
  });

  it("'any' offers every list, and ritualOnly + levels narrow it", () => {
    const f = { id: 'tome_rituals', spellFilter: { lists: 'any' as const, levels: [1], ritualOnly: true } };
    const out = candidateSpellsForChoice(all, f, { ownClassId: 'warlock_2024', maxCastableLevel: 1 });
    expect(out.length).toBeGreaterThan(3);
    expect(out.every(s => s.level === 1 && s.ritual)).toBe(true);
  });

  it('exact levels ignore the slot cap (Mystic Arcanum picks a level 6 spell with only level 1 slots)', () => {
    const f = { id: 'arcanum_6', spellFilter: { lists: ['warlock_2024'], levels: [6], ignoreSlotCap: true } };
    const out = candidateSpellsForChoice(all, f, { ownClassId: 'warlock_2024', maxCastableLevel: 1 });
    expect(out.length).toBeGreaterThan(0);
    expect(out.every(s => s.level === 6)).toBe(true);
  });

  it('includeCantrips lets a leveled choice take cantrips too, but still caps leveled spells', () => {
    const f = { id: 'discoveries', spellFilter: { lists: ['wizard_2024'], includeCantrips: true } };
    const out = candidateSpellsForChoice(all, f, { ownClassId: 'bard_2024', maxCastableLevel: 2 });
    expect(out.some(s => s.level === 0)).toBe(true);
    expect(out.some(s => s.level === 3)).toBe(false);
    expect(spellMatchesChoice(all.find(s => s.id === 'fireball'), f, { ownClassId: 'bard_2024', maxCastableLevel: 2 })).toBe(false);
  });
});

describe('cross-list choices on the 2024 classes', () => {
  const pending = (e: Entity, part: string) => e.choices.find(c => !c.resolved && c.id.includes(part));
  const resolve = (e: Entity, choiceId: string, spellIds: string[]) => applySpellChoiceToEntity(e, choiceId, spellIds, level, DEFAULT_RULES);

  it("Paladin's Blessed Warrior opens a Cleric-cantrip choice, and the picks become cantrips of the Paladin", () => {
    let e = toLevel(newChar('paladin'), 'paladin', 2);
    const style = e.choices.find(c => c.definition.id.includes('fighting_style'))!;
    expect(pending(e, 'blessed_warrior_cantrips')).toBeUndefined();
    e = applyPoolChoiceToEntity(e, style.id, ['fighting_style_blessed_warrior'], DEFAULT_RULES);
    const ch = pending(e, 'blessed_warrior_cantrips')!;
    expect(ch.definition.count).toBe(2);
    expect(ch.definition.spellFilter).toMatchObject({ lists: ['cleric_2024'] });
    e = resolve(e, ch.id, ['guidance', 'sacred_flame']);
    expect(e.spellcasting!.cantrips).toEqual(expect.arrayContaining(['guidance', 'sacred_flame']));
  });

  it('removing the option takes the choice (and its cantrips) back out', () => {
    let e = toLevel(newChar('paladin'), 'paladin', 2);
    const style = e.choices.find(c => c.definition.id.includes('fighting_style'))!;
    e = applyPoolChoiceToEntity(e, style.id, ['fighting_style_blessed_warrior'], DEFAULT_RULES);
    expect(pending(e, 'blessed_warrior_cantrips')).toBeDefined();
    e = removeFeature(e, 'paladin_2024_fighting_style_blessed_warrior');
    expect(pending(e, 'blessed_warrior_cantrips')).toBeUndefined();
  });

  it("Ranger's Druidic Warrior opens a Druid-cantrip choice", () => {
    let e = toLevel(newChar('ranger'), 'ranger', 2);
    const style = e.choices.find(c => c.definition.id.includes('fighting_style'))!;
    e = applyPoolChoiceToEntity(e, style.id, ['fighting_style_druidic_warrior'], DEFAULT_RULES);
    expect(pending(e, 'druidic_warrior_cantrips')!.definition.spellFilter).toMatchObject({ lists: ['druid_2024'] });
  });

  it('Pact of the Tome opens three any-list cantrips and two any-list level 1 rituals', () => {
    let e = newChar('warlock');
    const inv = e.choices.find(c => c.definition.id.includes('invocations_1'))!;
    e = applyPoolChoiceToEntity(e, inv.id, ['invocation_pact_of_the_tome'], DEFAULT_RULES);
    const cantrips = pending(e, 'tome_cantrips')!;
    const rituals = pending(e, 'tome_rituals')!;
    expect(cantrips.definition.count).toBe(3);
    expect(rituals.definition.spellFilter).toMatchObject({ lists: 'any', levels: [1], ritualOnly: true });
  });

  it('Mystic Arcanum is a real level 6 Warlock spell choice at level 11', () => {
    const e = toLevel(newChar('warlock'), 'warlock', 11);
    const ch = pending(e, 'arcanum_6')!;
    expect(ch.definition.spellFilter).toMatchObject({ lists: ['warlock_2024'], levels: [6], ignoreSlotCap: true });
  });

  it('Bard prepared-spell picks draw on four lists from level 10; Lore Magical Discoveries is a two-spell choice at 6', () => {
    let e = toLevel(newChar('bard'), 'bard', 9);
    const early = e.choices.filter(c => c.definition.id.includes('spells_') && !c.resolved);
    expect(early.every(c => !c.definition.spellFilter)).toBe(true);
    e = toLevel(e, 'bard', 10);
    expect(pending(e, 'spells_10')!.definition.spellFilter).toMatchObject({ lists: ['bard_2024', 'cleric_2024', 'druid_2024', 'wizard_2024'] });
    let lore = bindSubclass(toLevel(newChar('bard'), 'bard', 3), 'bard');
    lore = toLevel(lore, 'bard', 6);
    const md = pending(lore, 'lore_magical_discoveries')!;
    expect(md.definition.count).toBe(2);
    expect(md.definition.spellFilter).toMatchObject({ includeCantrips: true });
  });

  it("the Thaumaturge's extra cantrip is only asked for when Thaumaturge is chosen", () => {
    let e = newChar('cleric');
    expect(pending(e, 'thaumaturge_cantrip')).toBeUndefined();
    const order = e.choices.find(c => c.definition.id.includes('divine_order'))!;
    e = applyPoolChoiceToEntity(e, order.id, ['divine_order_thaumaturge'], DEFAULT_RULES);
    expect(pending(e, 'thaumaturge_cantrip')).toBeDefined();
  });
});
