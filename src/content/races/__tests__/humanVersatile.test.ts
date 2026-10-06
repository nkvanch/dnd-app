// Human (2024) Versatile: an Origin feat of the player's choice, granted for real, with the picks the feat asks for.
import { makeEmptyEntity, DEFAULT_RULES } from '../../../store/characterStore';
import { recomputeDerived } from '../../../engine/pipeline';
import { applyGrant, queueChoice, applyPoolChoiceToEntity } from '../../../engine/leveling';
import { Entity } from '../../../engine/types';
import { raceHuman2024 } from '../index';
import { ORIGIN_FEATS_2024 } from '../../feats/origin2024';

function human(): Entity {
  let e = makeEmptyEntity('h');
  e = { ...e, identity: { ...e.identity, level: 1, raceId: raceHuman2024.id }, stats: { str: 10, dex: 10, con: 14, int: 10, wis: 10, cha: 10 } };
  for (const f of raceHuman2024.features) e = applyGrant(e, { kind: 'feature', value: { ...f, isActive: true } }, 0);
  for (const c of raceHuman2024.pendingChoices ?? []) e = queueChoice(e, c, 0, undefined, { kind: 'race', id: raceHuman2024.id });
  return recomputeDerived(e, DEFAULT_RULES);
}
const versatile = (e: Entity) => e.choices.find(c => c.definition.id.endsWith('human_2024_versatile'))!;

describe('Human: Versatile', () => {
  it('is a pending pick of the Origin feats', () => {
    const c = versatile(human());
    expect(c.resolved).toBe(false);
    expect((c.definition.pool as { id: string }[]).map(o => o.id)).toEqual(ORIGIN_FEATS_2024.map(f => `human_2024_versatile_${f.id}`));
    expect(c.definition.count).toBe(1);
  });

  it('Alert: grants its initiative bonus (Proficiency Bonus) as a species feature', () => {
    let e = human();
    const base = e.derived.initiative;
    e = applyPoolChoiceToEntity(e, versatile(e).id, ['human_2024_versatile_alert_2024'], DEFAULT_RULES);
    const f = e.features.find(x => x.id === 'human_2024_versatile_alert_2024')!;
    expect(f.name).toBe('Alert (Versatile)');
    expect(f.source).toMatchObject({ kind: 'race', refId: 'human_2024' });
    expect(e.derived.initiative).toBe(base + e.derived.proficiencyBonus);
  });

  it('Skilled: queues its three skill picks', () => {
    let e = human();
    e = applyPoolChoiceToEntity(e, versatile(e).id, ['human_2024_versatile_skilled_2024'], DEFAULT_RULES);
    expect(e.choices.some(c => !c.resolved && c.definition.kind === 'skill' && c.definition.count === 3)).toBe(true);
  });

  it('Magic Initiate: queues the ability, cantrip and spell picks, whose features belong to the species, and brings its free-cast pool', () => {
    let e = human();
    e = applyPoolChoiceToEntity(e, versatile(e).id, ['human_2024_versatile_magic_initiate_wizard_2024'], DEFAULT_RULES);
    const queued = e.choices.filter(c => !c.resolved && c.id.includes('magic_initiate_wizard_2024'));
    expect(queued.map(c => c.definition.id)).toEqual(expect.arrayContaining(['ability', 'cantrips', 'spell']));
    expect(e.resources.custom.some(r => r.id === 'magic_initiate_wizard_2024_cast')).toBe(true);
    const spell = queued.find(c => c.definition.id.endsWith('spell'))!;
    const option = (spell.definition.pool as { id: string; value: { source: { kind: string } } }[])[0];
    expect(option.value.source.kind).toBe('race');
    const ability = queued.find(c => c.definition.id.endsWith('ability'))!;
    e = applyPoolChoiceToEntity(e, ability.id, ['magic_initiate_wizard_2024_ability_cha'], DEFAULT_RULES);
    expect(e.features.some(f => f.id === 'magic_initiate_wizard_2024_ability_cha')).toBe(true);
  });
});
