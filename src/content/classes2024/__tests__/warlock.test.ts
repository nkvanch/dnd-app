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
