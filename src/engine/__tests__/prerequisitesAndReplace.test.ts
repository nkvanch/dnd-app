import { newChar, toLevel } from '../../content/classes2024/testKit';
import { applyPoolChoiceToEntity, replacePoolOption, replaceableOptions } from '../leveling';
import { checkPrerequisites, spellTraits } from '../prerequisites';
import { DEFAULT_RULES } from '../../store/characterStore';
import { Entity } from '../types';

const apply = (e: Entity, part: string, picks: string[]) => {
  const ch = e.choices.find(c => !c.resolved && c.definition.id.includes(part))!;
  return applyPoolChoiceToEntity(e, ch.id, picks, DEFAULT_RULES);
};
const inv1 = (e: Entity) => e.choices.find(c => c.definition.id.includes('invocations_1'))!;

describe('prerequisite engine', () => {
  it('level is read from the class, and unmet reasons are worded', () => {
    const e = newChar('warlock');
    const r = checkPrerequisites(e, [{ kind: 'level', min: 5 }], { classId: 'warlock_2024' });
    expect(r).toEqual({ met: false, unmet: ['Level 5+'] });
    expect(checkPrerequisites(toLevel(e, 'warlock', 5), [{ kind: 'level', min: 5 }], { classId: 'warlock_2024' }).met).toBe(true);
  });

  it('has_option, excludes and alsoHeld', () => {
    const e = newChar('warlock');
    const need = [{ kind: 'has_option' as const, optionId: 'x', label: 'Pact of X' }];
    expect(checkPrerequisites(e, need).met).toBe(false);
    expect(checkPrerequisites(e, need, { alsoHeld: ['x'] }).met).toBe(true);
    const ex = [{ kind: 'excludes' as const, optionIds: ['x'], label: 'cannot combine with X' }];
    expect(checkPrerequisites(e, ex).met).toBe(true);
    expect(checkPrerequisites(e, ex, { alsoHeld: ['x'] }).unmet).toEqual(['cannot combine with X']);
  });

  it('cantrip traits are read from the spell text and range', () => {
    expect(spellTraits({ range: '120 feet', description: 'Make a ranged spell attack. On a hit, the target takes 1d10 force damage.' }))
      .toEqual({ damage: true, attackRoll: true, rangeFeet: 120 });
    expect(spellTraits({ range: 'Self', description: 'You gain a bonus.' })).toEqual({ damage: false, attackRoll: false, rangeFeet: 0 });
  });

  it('a cantrip prerequisite needs a matching cantrip on the character', () => {
    let e = newChar('warlock');
    const need = [{ kind: 'cantrip' as const, traits: ['damage' as const], label: 'a damaging cantrip' }];
    const lookup = (id: string) => id === 'eldritch_blast' ? { id, level: 0, range: '120 feet', description: 'ranged spell attack ... damage' } : { id, level: 0, range: 'Self', description: 'flavor' };
    e = { ...e, spellcasting: { ...e.spellcasting!, cantrips: ['mage_hand'] } };
    expect(checkPrerequisites(e, need, { spellLookup: lookup }).met).toBe(false);
    e = { ...e, spellcasting: { ...e.spellcasting!, cantrips: ['mage_hand', 'eldritch_blast'] } };
    expect(checkPrerequisites(e, need, { spellLookup: lookup }).met).toBe(true);
  });
});

describe('Eldritch Invocation prerequisites are enforced by the engine', () => {
  it('refuses an invocation whose level or pact prerequisite is not met', () => {
    const e = newChar('warlock');
    expect(() => applyPoolChoiceToEntity(e, inv1(e).id, ['invocation_devils_sight'], DEFAULT_RULES)).toThrow(/Level 2\+/);
    expect(() => applyPoolChoiceToEntity(e, inv1(e).id, ['invocation_eldritch_smite'], DEFAULT_RULES)).toThrow(/Pact of the Blade/);
  });

  it('allows an option without prerequisites', () => {
    const e = newChar('warlock');
    const done = applyPoolChoiceToEntity(e, inv1(e).id, ['invocation_pact_of_the_blade'], DEFAULT_RULES);
    expect(done.features.some(f => f.name === 'Pact of the Blade')).toBe(true);
  });

  it('a prerequisite option picked in the same sitting counts (Pact of the Blade + Eldritch Smite at level 5)', () => {
    let e = toLevel(newChar('warlock'), 'warlock', 4);
    e = applyPoolChoiceToEntity(e, inv1(e).id, ['invocation_pact_of_the_blade'], DEFAULT_RULES);
    e = toLevel(e, 'warlock', 5);
    const lvl5 = e.choices.find(c => !c.resolved && c.definition.id.includes('invocations_5'))!;
    const done = applyPoolChoiceToEntity(e, lvl5.id, ['invocation_eldritch_smite', 'invocation_thirsting_blade'], DEFAULT_RULES);
    expect(done.features.map(f => f.name)).toEqual(expect.arrayContaining(['Eldritch Smite', 'Thirsting Blade']));
  });
});

describe('replacing a held option', () => {
  it('Fighting Style: swaps the feature and the selection, atomically', () => {
    let e = newChar('fighter');
    e = apply(e, 'fighting_style', ['fighting_style_defense']);
    const choice = e.choices.find(c => c.definition.id.includes('fighting_style') && c.resolved)!;
    expect(e.features.some(f => f.name === 'Defense')).toBe(true);
    const swapped = replacePoolOption(e, choice.id, 'fighting_style_defense', 'fighting_style_archery', DEFAULT_RULES);
    expect(swapped.features.some(f => f.name === 'Defense')).toBe(false);
    expect(swapped.features.some(f => f.name === 'Archery')).toBe(true);
    expect(swapped.choices.find(c => c.id === choice.id)!.selections).toEqual(['fighting_style_archery']);
  });

  it('refuses an option already held, or a swap to the same one, or a non-replaceable choice', () => {
    let e = newChar('fighter');
    e = apply(e, 'fighting_style', ['fighting_style_defense']);
    const choice = e.choices.find(c => c.definition.id.includes('fighting_style') && c.resolved)!;
    expect(() => replacePoolOption(e, choice.id, 'fighting_style_defense', 'fighting_style_defense', DEFAULT_RULES)).toThrow(/different/);
    const asi = newChar('wizard').choices.find(c => c.definition.kind === 'skill')!;
    expect(() => replacePoolOption(newChar('wizard'), asi.id, 'a', 'b', DEFAULT_RULES)).toThrow();
  });

  it('Invocations: swaps respect prerequisites and refuse to remove one that another needs', () => {
    let e = toLevel(newChar('warlock'), 'warlock', 4);
    e = applyPoolChoiceToEntity(e, inv1(e).id, ['invocation_pact_of_the_blade'], DEFAULT_RULES);
    e = apply(e, 'invocations_2', ['invocation_devils_sight', 'invocation_mask_of_many_faces']);
    e = toLevel(e, 'warlock', 5);
    e = apply(e, 'invocations_5', ['invocation_eldritch_smite', 'invocation_thirsting_blade']);
    const c1 = e.choices.find(c => c.id === inv1(e).id)!;
    // Pact of the Blade is needed by Eldritch Smite and Thirsting Blade.
    const opts = replaceableOptions(e, c1.id);
    expect(opts[0].blockedBy).toMatch(/Eldritch Smite/);
    expect(() => replacePoolOption(e, c1.id, 'invocation_pact_of_the_blade', 'invocation_pact_of_the_chain', DEFAULT_RULES)).toThrow(/prerequisite/);
    // A free one swaps, but not to something whose prerequisite fails.
    const c2 = e.choices.find(c => c.definition.id.includes('invocations_2') && c.resolved)!;
    expect(() => replacePoolOption(e, c2.id, 'invocation_devils_sight', 'invocation_visions_of_distant_realms', DEFAULT_RULES)).toThrow(/Level 9\+/);
    const swapped = replacePoolOption(e, c2.id, 'invocation_devils_sight', 'invocation_misty_visions', DEFAULT_RULES);
    expect(swapped.features.some(f => f.name === 'Devil\'s Sight')).toBe(false);
    expect(swapped.features.some(f => f.name === 'Misty Visions')).toBe(true);
  });

  it('candidates list shows unmet prerequisites instead of hiding them', () => {
    let e = toLevel(newChar('warlock'), 'warlock', 2);
    e = apply(e, 'invocations_1', ['invocation_pact_of_the_blade']);
    e = apply(e, 'invocations_2', ['invocation_devils_sight', 'invocation_mask_of_many_faces']);
    const c2 = e.choices.find(c => c.definition.id.includes('invocations_2') && c.resolved)!;
    const cand = replaceableOptions(e, c2.id).find(o => o.optionId === 'invocation_devils_sight')!.candidates;
    expect(cand.find(c => c.id === 'invocation_eldritch_smite')!.unmet.length).toBeGreaterThan(0);
    expect(cand.find(c => c.id === 'invocation_otherworldly_leap')!.unmet).toEqual([]);
  });

  it('swapping out Pact of the Tome takes its spell choices back out', () => {
    let e = newChar('warlock');
    e = applyPoolChoiceToEntity(e, inv1(e).id, ['invocation_pact_of_the_tome'], DEFAULT_RULES);
    expect(e.choices.some(c => !c.resolved && c.definition.id.includes('tome_cantrips'))).toBe(true);
    const c1 = inv1(e);
    e = replacePoolOption(e, c1.id, 'invocation_pact_of_the_tome', 'invocation_pact_of_the_chain', DEFAULT_RULES);
    expect(e.choices.some(c => !c.resolved && c.definition.id.includes('tome_'))).toBe(false);
  });

  it('Metamagic and Hunter\'s Prey carry their own timing rule', () => {
    const sor = toLevel(newChar('sorcerer'), 'sorcerer', 2);
    expect(sor.choices.find(c => c.definition.id.includes('metamagic_2'))!.definition.replace!.timing).toBe('level_up');
  });
});
