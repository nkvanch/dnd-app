// Engine / editor parity: mechanics the engine already honors that the homebrew trait editor could not author
// (speed & initiative modifiers, saving-throw bonuses, weapon/armor proficiency, condition immunity), plus a
// save DC that scales with the character instead of a hard-coded number. Each case compiles a draft the way the
// builders do, applies it to a character, and checks the SHEET changed (not just that an effect was emitted).
import { newDraftTrait, buildTraitFeature, buildRequiresSave, STAT_BONUS_TARGETS, EFFECT_KIND_LABELS } from '../traitCompiler';
import { makeEmptyEntity, DEFAULT_RULES } from '../../store/characterStore';
import { recomputeDerived } from '../../engine/pipeline';
import { applyGrant } from '../../engine/leveling';
import { applyCondition, isImmuneToCondition } from '../../engine/conditions';
import { buildLayer3 } from '../../engine/actionCards';
import type { DraftTrait, Entity } from '../../engine/types';

const compile = (patch: Partial<DraftTrait>) => {
  const t: DraftTrait = { ...newDraftTrait('Test Trait'), ...patch };
  return buildTraitFeature(t, { idPrefix: 'p', sourceKind: 'feat', sourceRefId: 'p', level: null });
};
const character = (level = 5): Entity => recomputeDerived({ ...makeEmptyEntity('c'), identity: { ...makeEmptyEntity('c').identity, level } }, DEFAULT_RULES);
const apply = (e: Entity, patch: Partial<DraftTrait>): Entity => {
  const { feature, resource } = compile(patch);
  let out = applyGrant(e, { kind: 'feature', value: feature }, 1);
  if (resource) out = applyGrant(out, { kind: 'resource', value: resource }, 1);
  return recomputeDerived(out, DEFAULT_RULES);
};

describe("stat_bonus: speed / initiative / extra attacks / spell DC / passives / saves", () => {
  const base = character();

  it('walking speed +10 (the gap the stress test found: "Grants movement" was fly/swim/climb/burrow only)', () => {
    expect(apply(base, { effectKind: 'stat_bonus', statTarget: 'speed', statOperation: 'add', statAmount: '10' }).derived.speed).toBe(base.derived.speed + 10);
  });
  it('speed can be set (a slow race: 25 ft)', () => {
    expect(apply(base, { effectKind: 'stat_bonus', statTarget: 'speed', statOperation: 'set', statAmount: '25' }).derived.speed).toBe(25);
  });
  it('speed can be doubled (the scale operation, reachable from the editor)', () => {
    expect(apply(base, { effectKind: 'stat_bonus', statTarget: 'speed', statOperation: 'scale', statAmount: '2' }).derived.speed).toBe(base.derived.speed * 2);
  });
  it('initiative +2', () => {
    expect(apply(base, { effectKind: 'stat_bonus', statTarget: 'initiative', statOperation: 'add', statAmount: '2' }).derived.initiative).toBe(base.derived.initiative + 2);
  });
  it('a bonus to every saving throw', () => {
    const after = apply(base, { effectKind: 'stat_bonus', statTarget: 'saving_throw', statSaveAbility: 'all', statOperation: 'add', statAmount: '1' });
    for (const ab of ['str', 'dex', 'con', 'int', 'wis', 'cha'] as const) expect(after.derived.savingThrows[ab]).toBe(base.derived.savingThrows[ab] + 1);
  });
  it('a bonus to ONE saving throw only', () => {
    const after = apply(base, { effectKind: 'stat_bonus', statTarget: 'saving_throw', statSaveAbility: 'wis', statOperation: 'add', statAmount: '2' });
    expect(after.derived.savingThrows.wis).toBe(base.derived.savingThrows.wis + 2);
    expect(after.derived.savingThrows.str).toBe(base.derived.savingThrows.str);
  });
  it('an extra attack', () => {
    const before = base.derived.attackActionAttacks;
    expect(apply(base, { effectKind: 'stat_bonus', statTarget: 'extra_attack', statOperation: 'add', statAmount: '1' }).derived.attackActionAttacks).toBe(before + 1);
  });
  it('passive Perception +5 (Observant-style)', () => {
    expect(apply(base, { effectKind: 'stat_bonus', statTarget: 'passive_perception', statOperation: 'add', statAmount: '5' }).derived.passivePerception).toBe(base.derived.passivePerception + 5);
  });

  it('an operation the target does not support falls back to a plain bonus (no silent nonsense)', () => {
    const { feature } = compile({ effectKind: 'stat_bonus', statTarget: 'spell_save_dc', statOperation: 'scale', statAmount: '2' });
    expect(feature.effects).toEqual([expect.objectContaining({ target: 'spell_save_dc', operation: 'add', value: 2 })]);
  });
  it('empty, zero and x1 do nothing', () => {
    expect(compile({ effectKind: 'stat_bonus', statTarget: 'speed', statOperation: 'add', statAmount: '' }).feature.effects).toEqual([]);
    expect(compile({ effectKind: 'stat_bonus', statTarget: 'speed', statOperation: 'add', statAmount: '0' }).feature.effects).toEqual([]);
    expect(compile({ effectKind: 'stat_bonus', statTarget: 'speed', statOperation: 'scale', statAmount: '1' }).feature.effects).toEqual([]);
  });
  it('every target the editor offers is one the compiler emits an effect for', () => {
    for (const spec of STAT_BONUS_TARGETS) {
      expect(compile({ effectKind: 'stat_bonus', statTarget: spec.key, statOperation: 'add', statAmount: '1', statSaveAbility: 'all' }).feature.effects.length).toBeGreaterThan(0);
    }
  });
});

describe('gear_proficiency', () => {
  it('heavy armor', () => {
    expect(apply(character(), { effectKind: 'gear_proficiency', gearKind: 'armor', gearName: 'heavy' }).proficiencies.armor.map(a => a.toLowerCase())).toContain('heavy');
  });
  it('shields', () => {
    expect(apply(character(), { effectKind: 'gear_proficiency', gearKind: 'armor', gearName: 'shields' }).proficiencies.armor.map(a => a.toLowerCase())).toContain('shields');
  });
  it('martial weapons and a specific weapon', () => {
    expect(apply(character(), { effectKind: 'gear_proficiency', gearKind: 'weapon', gearName: 'martial' }).proficiencies.weapons.map(a => a.toLowerCase())).toContain('martial');
    expect(apply(character(), { effectKind: 'gear_proficiency', gearKind: 'weapon', gearName: 'Hand Crossbow' }).proficiencies.weapons.map(a => a.toLowerCase())).toContain('hand crossbow');
  });
  it('a blank name grants nothing', () => {
    expect(compile({ effectKind: 'gear_proficiency', gearKind: 'weapon', gearName: '  ' }).feature.effects).toEqual([]);
  });
});

describe('condition_immunity', () => {
  it('the character can no longer be poisoned (the app refuses the condition)', () => {
    const e = apply(character(), { effectKind: 'condition_immunity', conditionImmunityTarget: 'poisoned' });
    expect(isImmuneToCondition(e, 'poisoned')).toBe(true);
    expect(isImmuneToCondition(e, 'charmed')).toBe(false);
    const attempted = applyCondition(e, 'poisoned', 'manual', DEFAULT_RULES, []);
    expect(attempted.features.some(f => f.id === 'poisoned' || f.source?.refId === 'poisoned')).toBe(false);
  });
});

describe('a save DC that scales with the character (no more hard-coded "DC 13")', () => {
  const draft: Partial<DraftTrait> = {
    effectKind: 'resource_ability', name: 'Dazzling Verse', limitedUse: false, uses: '2', recharge: 'long_rest',
    saveEnabled: true, saveAbility: 'wis', saveDcMode: 'ability', saveDcAbility: 'cha', healDice: '',
  };

  it("ability mode: requiresSave.dc is the character's own 8 + proficiency + CHA modifier", () => {
    expect(buildRequiresSave({ ...newDraftTrait('x'), ...draft })).toEqual({ ability: 'wis', dc: { ability: 'cha' } });
  });
  it('spell mode follows the spell save DC; fixed mode keeps a number', () => {
    expect(buildRequiresSave({ ...newDraftTrait('x'), ...draft, saveDcMode: 'spell' })).toEqual({ ability: 'wis', dc: 'spell_save_dc' });
    expect(buildRequiresSave({ ...newDraftTrait('x'), ...draft, saveDcMode: 'fixed', saveDcFixed: '15' })).toEqual({ ability: 'wis', dc: 15 });
  });
  it('off by default, so existing traits are unchanged', () => {
    expect(buildRequiresSave(newDraftTrait('x'))).toBeNull();
    expect(compile({ effectKind: 'resource_ability' }).feature.activation?.requiresSave).toBeNull();
  });

  it('the card shows a DC that GROWS when the character levels (level 1 vs level 9, CHA 16)', () => {
    const cardAt = (level: number) => {
      const e0 = character(level);
      const e = recomputeDerived({ ...e0, stats: { ...e0.stats, cha: 16 } } as Entity, DEFAULT_RULES);
      const { feature } = compile(draft);
      return buildLayer3(feature, e);
    };
    const lvl1 = cardAt(1);
    const lvl9 = cardAt(9);
    expect(lvl1).toMatch(/WIS Save vs DC \d+/);
    const n = (s: string | null) => Number(/DC (\d+)/.exec(s ?? '')![1]);
    expect(n(lvl1)).toBe(8 + 2 + 3);          // prof +2, CHA 16 => +3
    expect(n(lvl9)).toBe(8 + 4 + 3);          // prof +4
    expect(n(lvl9)).toBeGreaterThan(n(lvl1));
  });

  it('a save-forcing ability targets someone else, not self', () => {
    expect(compile(draft).feature.activation?.target).toBe('single');
    expect(compile({ effectKind: 'resource_ability' }).feature.activation?.target).toBe('self');
  });

  it('works on the limited-use overlay of any effect kind too', () => {
    const { feature } = compile({ effectKind: 'damage_resistance', damageType: 'fire', limitedUse: true, saveEnabled: true, saveAbility: 'con', saveDcMode: 'ability', saveDcAbility: 'wis' });
    expect(feature.activation?.requiresSave).toEqual({ ability: 'con', dc: { ability: 'wis' } });
  });
});

describe('every effect kind has a label (builders no longer render blank for the newer kinds)', () => {
  it.each(['stat_bonus', 'gear_proficiency', 'condition_immunity', 'damage_resistance', 'unarmored_defense', 'movement_condition'] as const)('%s', kind => {
    expect(EFFECT_KIND_LABELS[kind]).toBeTruthy();
  });
});
