// The 2024 rules let the player choose Intelligence, Wisdom or Charisma as the spellcasting ability of the Elf, Gnome and Tiefling
// lineage spells and of Magic Initiate. The choice is a real pending pick and the spells use the ability chosen.
import { makeEmptyEntity, DEFAULT_RULES } from '../../../store/characterStore';
import { recomputeDerived } from '../../../engine/pipeline';
import { applyGrant, queueChoice, applyPoolChoiceToEntity } from '../../../engine/leveling';
import { resolveSpellCastingContexts } from '../../../engine/actionCards';
import { grantedSpellAbility } from '../../../engine/grantedSpellAbility';
import { Entity, Race, Feat } from '../../../engine/types';
import { raceElf2024, raceGnome2024, raceTiefling2024 } from '../races2024';
import { ORIGIN_FEATS_2024 } from '../../feats/origin2024';

function withRace(level: number, race: Race, ancestryId: string, resolve?: string): Entity {
  let e = makeEmptyEntity('r');
  e = { ...e, identity: { ...e.identity, level, raceId: race.id }, stats: { str: 10, dex: 10, con: 14, int: 10, wis: 10, cha: 10 },
    resources: { ...e.resources, hp: { current: 20, maximum: 20, temp: 0 }, hitDice: { die: 8, total: level, remaining: level } } };
  for (const f of race.features) e = applyGrant(e, { kind: 'feature', value: { ...f, isActive: true } }, f.level ?? 0);
  for (const r of race.resources ?? []) e = applyGrant(e, { kind: 'resource', value: r }, 0, undefined, { kind: 'race', id: race.id });
  const opt = race.ancestryChoice!.options.find(o => o.id === ancestryId)!;
  e = applyGrant(e, { kind: 'feature', value: { ...opt.feature, isActive: true } }, 0);
  for (const c of race.pendingChoices ?? []) e = queueChoice(e, c, 0, undefined, { kind: 'race', id: race.id });
  e = recomputeDerived(e, DEFAULT_RULES);
  if (resolve) {
    const pending = e.choices.find(c => c.definition.id.endsWith('_spell_ability'))!;
    e = applyPoolChoiceToEntity(e, pending.id, [resolve], DEFAULT_RULES);
  }
  return e;
}
const abilityOf = (e: Entity, spellId: string) => resolveSpellCastingContexts(e, spellId).find(c => c.explicitAbility)?.castingAbility;
const pendingAbility = (e: Entity) => e.choices.find(c => c.definition.id.endsWith('_spell_ability') && !c.resolved);

describe('species lineage spells ask for their spellcasting ability', () => {
  it('Elf: a pending choice of Intelligence, Wisdom or Charisma; Wisdom until it is made, then the chosen one', () => {
    const e = withRace(5, raceElf2024, 'drow');
    const choice = pendingAbility(e)!;
    expect(choice.definition.pool).toHaveLength(3);
    expect((choice.definition.pool as { id: string }[]).map(o => o.id)).toEqual(['elf_2024_spell_ability_int', 'elf_2024_spell_ability_wis', 'elf_2024_spell_ability_cha']);
    expect(abilityOf(e, 'dancing_lights')).toBe('wis');
    expect(abilityOf(e, 'faerie_fire')).toBe('wis');
    const chosen = withRace(5, raceElf2024, 'drow', 'elf_2024_spell_ability_int');
    expect(pendingAbility(chosen)).toBeUndefined();
    expect(abilityOf(chosen, 'dancing_lights')).toBe('int');
    expect(abilityOf(chosen, 'faerie_fire')).toBe('int');
    expect(abilityOf(chosen, 'darkness')).toBe('int');
  });

  it('the level 3 and 5 lineage spells are always prepared once their level is reached, and stay off before it', () => {
    const at2 = withRace(2, raceElf2024, 'drow');
    expect(resolveSpellCastingContexts(at2, 'faerie_fire').some(c => c.explicitAbility)).toBe(false);
    const at3 = withRace(3, raceElf2024, 'drow', 'elf_2024_spell_ability_cha');
    expect(abilityOf(at3, 'faerie_fire')).toBe('cha');
    expect(abilityOf(at3, 'darkness')).toBeUndefined();
    expect(abilityOf(withRace(5, raceElf2024, 'drow', 'elf_2024_spell_ability_cha'), 'darkness')).toBe('cha');
  });

  it('Gnome (Intelligence by default) and Tiefling (Charisma by default) can choose another', () => {
    expect(abilityOf(withRace(1, raceGnome2024, 'forest'), 'minor_illusion')).toBe('int');
    expect(abilityOf(withRace(1, raceGnome2024, 'forest', 'gnome_2024_spell_ability_wis'), 'speak_with_animals')).toBe('wis');
    expect(abilityOf(withRace(1, raceGnome2024, 'rock', 'gnome_2024_spell_ability_cha'), 'mending')).toBe('cha');
    expect(abilityOf(withRace(1, raceTiefling2024, 'infernal'), 'fire_bolt')).toBe('cha');
    expect(abilityOf(withRace(1, raceTiefling2024, 'infernal', 'tiefling_2024_spell_ability_int'), 'thaumaturgy')).toBe('int');
    expect(abilityOf(withRace(3, raceTiefling2024, 'infernal', 'tiefling_2024_spell_ability_wis'), 'hellish_rebuke')).toBe('wis');
  });
});

describe('Magic Initiate asks for its spellcasting ability', () => {
  const feat = (id: string): Feat => ORIGIN_FEATS_2024.find(f => f.id === id)!;
  it('the ability is the first pick, and every spell it grants follows it', () => {
    const mi = feat('magic_initiate_cleric_2024');
    expect(mi.pendingChoices!.map(c => c.id)).toEqual(['ability', 'cantrips', 'spell']);
    const ab = mi.pendingChoices![0];
    expect((ab.pool as { id: string }[]).map(o => o.id)).toEqual(['magic_initiate_cleric_2024_ability_int', 'magic_initiate_cleric_2024_ability_wis', 'magic_initiate_cleric_2024_ability_cha']);
    expect((ab.pool as { label: string }[]).find(o => o.label.includes('suggested'))!.label).toBe('Wisdom (suggested)');
    // every granted spell reads its ability from that choice, defaulting to the list's own
    for (const c of mi.pendingChoices!.slice(1)) for (const o of c.pool as { value: { effects: { spellcastingAbilityFrom?: string; spellcastingAbility?: string }[] } }[]) {
      expect(o.value.effects[0].spellcastingAbilityFrom).toBe('magic_initiate_cleric_2024_ability');
      expect(o.value.effects[0].spellcastingAbility).toBe('wis');
    }
    expect((feat('magic_initiate_wizard_2024').pendingChoices![0].pool as { label: string }[])[0]).toMatchObject({ label: 'Intelligence (suggested)' });
  });

  it('the helper reads the held option and falls back to the default', () => {
    const eff = { spellcastingAbility: 'wis' as const, spellcastingAbilityFrom: 'x' };
    expect(grantedSpellAbility({ features: [] }, eff)).toBe('wis');
    expect(grantedSpellAbility({ features: [{ id: 'x_cha', isActive: true } as never] }, eff)).toBe('cha');
    expect(grantedSpellAbility({ features: [{ id: 'x_cha', isActive: false } as never] }, eff)).toBe('wis');
    expect(grantedSpellAbility({ features: [] }, { spellcastingAbility: 'int' })).toBe('int');
  });
});
