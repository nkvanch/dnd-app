// Jest resolves the SQLite-backed (native) spell repo by default; these tests use the in-memory one the web build uses.
jest.mock('../../spellRepo', () => jest.requireActual('../../spellRepo.ts'));

import { newChar, toLevel, bindSubclass } from '../testKit';
import { applyPoolChoiceToEntity } from '../../../engine/leveling';
import { DEFAULT_RULES } from '../../../store/characterStore';

describe('Warlock (2024)', () => {
  const max = (e: any, id: string) => e.resources.custom.find((r: any) => r.id === id)?.maximum;

  it('Pact Magic slots exist from level 1; Magical Cunning from 2', () => {
    let e = newChar('warlock');
    expect(e.spellcasting!.pactSlots).toBeTruthy();
    e = toLevel(e, 'warlock', 2);
    expect(max(e, 'magical_cunning')).toBe(1);
    e = toLevel(e, 'warlock', 9);
    expect(JSON.stringify(e.spellcasting!.pactSlots)).toContain('5');
  });

  it('Eldritch Invocations total 1 at level 1 and 10 at level 18', () => {
    let e = newChar('warlock');
    const total = (x: any) => x.choices.filter((c: any) => c.definition.id.includes('invocations_')).reduce((n: number, c: any) => n + c.definition.count, 0);
    expect(total(e)).toBe(1);
    e = toLevel(e, 'warlock', 20);
    expect(total(e)).toBe(10);
  });

  it('a spell invocation adds its feature to the sheet', () => {
    let e = newChar('warlock');
    const choice = e.choices.find(c => c.definition.id.includes('invocations_1'))!;
    e = applyPoolChoiceToEntity(e, choice.id, ['invocation_armor_of_shadows'], DEFAULT_RULES);
    expect(e.features.some(f => f.name === 'Armor of Shadows')).toBe(true);
  });

  it("Fiend Patron: Dark One's Own Luck uses = Charisma modifier from level 6; Fiendish Resilience is a choice at 10", () => {
    let e = bindSubclass(toLevel(newChar('warlock', { cha: 16 }), 'warlock', 3), 'warlock');
    e = toLevel(e, 'warlock', 6);
    expect(max(e, 'dark_ones_own_luck')).toBe(3);
    e = toLevel(e, 'warlock', 10);
    expect(e.choices.some(c => c.definition.id.includes('fiendish_resilience'))).toBe(true);
  });
});

describe('Warlock (2024) repeatable invocations', () => {
  const setup = () => {
    let e: any = toLevel(newChar('warlock'), 'warlock', 2);
    e = { ...e, spellcasting: { ...e.spellcasting, cantrips: ['eldritch_blast', 'chill_touch', 'mage_hand'] } };
    const ch = e.choices.filter((c: any) => c.definition.id.includes('invocations_') && !c.resolved);
    return { e, id: ch[ch.length - 1].id as string };
  };

  it('Agonizing Blast can be taken twice, each on a different cantrip, and records the target', () => {
    const { e, id } = setup();
    const out = applyPoolChoiceToEntity(e, id, ['invocation_agonizing_blast::eldritch_blast', 'invocation_agonizing_blast::chill_touch'], DEFAULT_RULES);
    const names = out.features.filter((f: any) => f.name.startsWith('Agonizing Blast')).map((f: any) => f.name);
    expect(names).toHaveLength(2);
    expect(names.join()).toMatch(/Eldritch Blast/i);
    expect(names.join()).toMatch(/Chill Touch/i);
  });

  it('refuses the same target twice, a cantrip the character lacks, or a cantrip that does not qualify', () => {
    const { e, id } = setup();
    expect(() => applyPoolChoiceToEntity(e, id, ['invocation_agonizing_blast::eldritch_blast', 'invocation_agonizing_blast::eldritch_blast'], DEFAULT_RULES)).toThrow();
    expect(() => applyPoolChoiceToEntity(e, id, ['invocation_agonizing_blast::fireball'], DEFAULT_RULES)).toThrow(/known cantrips/);
    expect(() => applyPoolChoiceToEntity(e, id, ['invocation_agonizing_blast::mage_hand'], DEFAULT_RULES)).toThrow(/does not qualify/);
    expect(() => applyPoolChoiceToEntity(e, id, ['invocation_thirsting_blade::eldritch_blast'], DEFAULT_RULES)).toThrow(/more than once/);
  });

  it('Lessons of the First Ones takes a different Origin feat each time', () => {
    const { e, id } = setup();
    const out = applyPoolChoiceToEntity(e, id, ['invocation_lessons_of_the_first_ones::alert_2024', 'invocation_lessons_of_the_first_ones::savage_attacker_2024'], DEFAULT_RULES);
    expect(out.features.filter((f: any) => f.name.startsWith('Lessons of the First Ones'))).toHaveLength(2);
    expect(() => applyPoolChoiceToEntity(e, id, ['invocation_lessons_of_the_first_ones::fighting_style'], DEFAULT_RULES)).toThrow(/Origin feat/);
  });

  it('a targeted invocation can later be swapped by its selection id', () => {
    const { e, id } = setup();
    const done = applyPoolChoiceToEntity(e, id, ['invocation_agonizing_blast::eldritch_blast', 'invocation_repelling_blast::eldritch_blast'], DEFAULT_RULES);
    const rep = require('../../../engine/leveling').replacePoolOption(done, id, 'invocation_agonizing_blast::eldritch_blast', 'invocation_armor_of_shadows', DEFAULT_RULES);
    expect(rep.features.some((f: any) => f.name === 'Armor of Shadows')).toBe(true);
    expect(rep.features.some((f: any) => f.name.startsWith('Agonizing Blast'))).toBe(false);
  });
});
