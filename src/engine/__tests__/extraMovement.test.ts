import { newChar, toLevel, bindSubclass } from '../../content/classes2024/testKit';
import { recomputeDerived } from '../pipeline';
import { equipItem } from '../inventory';
import { applyCondition } from '../conditions';
import { DEFAULT_RULES } from '../../store/characterStore';
import { FULL_ITEM_LIBRARY } from '../../content/items/index';
import { ALL_CONDITIONS } from '../../content/conditions/index';
import { Entity } from '../types';

const def = (id: string) => FULL_ITEM_LIBRARY.find((i: any) => i.id === id) as any;
const wear = (e: Entity, id: string): Entity => {
  const withItem = { ...e, inventory: { ...e.inventory, carried: [...e.inventory.carried, { id: `i_${id}`, itemId: id, quantity: 1, attuned: false, features: [] }] } };
  return equipItem(withItem, id, def(id), DEFAULT_RULES);
};

describe('movement speeds equal to your Speed', () => {
  it('Ranger Roving: Speed +10, and Climb and Swim follow the final Speed', () => {
    let e = newChar('ranger');
    expect(e.derived.movement.climb).toBeUndefined();
    const base = e.derived.speed;
    e = toLevel(e, 'ranger', 6);
    expect(e.derived.speed).toBe(base + 10);
    expect(e.derived.movement).toMatchObject({ climb: base + 10, swim: base + 10 });
  });

  it('Heavy armor removes the Speed bonus, and the Climb/Swim speeds follow it down', () => {
    let e = toLevel(newChar('ranger', { str: 18 }), 'ranger', 6);
    const base = e.derived.speed - 10;
    e = wear(e, 'chain_mail');
    expect(e.derived.speed).toBe(base);
    expect(e.derived.movement).toMatchObject({ climb: base, swim: base });
    // Medium armor is not Heavy: the bonus stays.
    let m = toLevel(newChar('ranger'), 'ranger', 6);
    m = wear(m, 'breastplate');
    expect(m.derived.speed).toBe(base + 10);
  });

  it("Monk Unarmored Movement needs no armor and no Shield; the Thief's Climb Speed equals the Speed", () => {
    let e = toLevel(newChar('monk'), 'monk', 2);
    const unarmored = e.derived.speed;
    expect(wear(e, 'shield').derived.speed).toBe(unarmored - 10);
    expect(wear(e, 'leather_armor').derived.speed).toBe(unarmored - 10);

    let r = bindSubclass(toLevel(newChar('rogue'), 'rogue', 3), 'rogue');
    expect(r.derived.movement.climb).toBe(r.derived.speed);
  });

  it('Barbarian Fast Movement ignores medium armor but not heavy', () => {
    let e = toLevel(newChar('barbarian'), 'barbarian', 5);
    const fast = e.derived.speed;
    expect(wear(e, 'chain_mail').derived.speed).toBe(fast - 10);
    expect(wear(e, 'breastplate').derived.speed).toBe(fast);
  });
});

describe('conditional movement', () => {
  it('Dragon Wings give a 60 ft. Fly Speed only while the wings are out', () => {
    let e = bindSubclass(toLevel(newChar('sorcerer'), 'sorcerer', 3), 'sorcerer');
    e = toLevel(e, 'sorcerer', 14);
    expect(e.derived.movement.fly).toBeUndefined();
    const out = recomputeDerived({ ...e, situationalAnswers: { ...(e.situationalAnswers ?? {}), dragon_wings_out: true } }, DEFAULT_RULES);
    expect(out.derived.movement.fly).toBe(60);
    const away = recomputeDerived({ ...out, situationalAnswers: { dragon_wings_out: false } }, DEFAULT_RULES);
    expect(away.derived.movement.fly).toBeUndefined();
  });

  it('a Speed of 0 from a condition leaves no speed of any kind', () => {
    let e = toLevel(newChar('ranger'), 'ranger', 6);
    expect(e.derived.movement.climb).toBeGreaterThan(0);
    const grappled = (ALL_CONDITIONS as any[]).find(c => c.id === 'grappled');
    e = applyCondition(e, 'grappled', 'test', DEFAULT_RULES, grappled?.features);
    expect(e.derived.speed).toBe(0);
    expect(e.derived.movement.climb).toBeUndefined();
    expect(e.derived.movement.swim).toBeUndefined();
  });
});
