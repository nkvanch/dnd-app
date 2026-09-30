import { newCampaignPrep, findLiveFields, toLiveEncounterInput } from '../prep';
import {
  addEncounter, addEffect, addTemplate, addNote, addPlan, togglePlanItem, removeItem, importPlannerEncounter,
  parseCombatants, parseSignedInt, describeEffectComponent, describeDuration,
} from '../prepEdit';

const fresh = () => newCampaignPrep('c', 'Camp', 1);

describe('prepEdit helpers', () => {
  it('parses combatants; a leading ? hides one from the public projection', () => {
    const cs = parseCombatants('Bandit, ?Doppelganger,, Captain', 'e1');
    expect(cs.map(c => [c.name, !!c.hidden])).toEqual([['Bandit', false], ['Doppelganger', true], ['Captain', false]]);
    const enc = addEncounter(fresh(), { id: 'e1', name: ' Ambush ', combatantsText: 'Bandit, ?Doppelganger', dmNotes: 'private' });
    const live = toLiveEncounterInput(enc.encounters[0], 'live1');
    expect(live.combatants.map(c => c.name)).toEqual(['Bandit']);
    expect(JSON.stringify(live)).not.toMatch(/Doppelganger|private/);
    expect(enc.encounters[0].name).toBe('Ambush');
  });

  it('imports an Encounter Planner record: quantities expand, hidden/notes stay private, link is kept', () => {
    const p = importPlannerEncounter(fresh(), {
      id: 'planner-1', name: 'Cave', description: 'DM only description',
      combatants: [{ id: 'a', monsterId: 'goblin', quantity: 2 }, { id: 'b', monsterId: 'ogre', displayName: 'Big Boss', quantity: 1, hidden: true, notes: 'secret plan' }],
    }, 'enc-new', id => id.toUpperCase());
    const e = p.encounters[0];
    expect(e.sourceEncounterId).toBe('planner-1');
    expect(e.combatants.map(c => c.name)).toEqual(['GOBLIN 1', 'GOBLIN 2', 'Big Boss']);
    const live = toLiveEncounterInput(e, 'x');
    expect(live.combatants.map(c => c.name)).toEqual(['GOBLIN 1', 'GOBLIN 2']);
    expect(JSON.stringify(live)).not.toMatch(/secret plan|DM only/);
  });

  it('adds effects, templates, notes and plans without producing live-only fields', () => {
    let p = fresh();
    p = addEffect(p, { id: 'f', name: 'Curse', description: 'd', source: 's', notes: 'n', hiddenDurationReason: '', visibility: 'secret', components: [{ stat: 'ac', operation: 'add', value: -1 }], duration: { unit: 'manual' } });
    p = addTemplate(p, { id: 't', label: ' Drain ', changes: [{ kind: 'max_hp', delta: -3 }] });
    p = addNote(p, { id: 'n', text: ' remember ' });
    p = addPlan(p, { id: 'pl', name: 'S1' });
    expect(p.notes[0]).toEqual({ id: 'n', text: 'remember', dmOnly: true });
    expect(p.templates[0].label).toBe('Drain');
    expect(findLiveFields(p)).toEqual([]);
  });

  it('plan membership toggles and removing an item cleans plan references', () => {
    let p = addEncounter(fresh(), { id: 'e', name: 'E', combatantsText: '', dmNotes: '' });
    p = addPlan(p, { id: 'pl', name: 'S1' });
    p = togglePlanItem(p, 'pl', 'encounterIds', 'e');
    expect(p.plans[0].encounterIds).toEqual(['e']);
    p = togglePlanItem(p, 'pl', 'encounterIds', 'e');
    expect(p.plans[0].encounterIds).toEqual([]);
    p = togglePlanItem(p, 'pl', 'encounterIds', 'e');
    p = removeItem(p, 'encounters', 'e');
    expect(p.encounters).toEqual([]);
    expect(p.plans[0].encounterIds).toEqual([]);
  });

  it('numeric input parsing is strict', () => {
    expect(parseSignedInt('-5')).toBe(-5);
    expect(parseSignedInt('+3')).toBe(3);
    expect(parseSignedInt(' 12 ')).toBe(12);
    for (const bad of ['', 'abc', '1.5', '--1', '12345', '1e3']) expect(parseSignedInt(bad)).toBeNull();
  });

  it('describes components and durations', () => {
    expect(describeEffectComponent({ stat: 'ac', operation: 'add', value: -1 })).toBe('AC -1');
    expect(describeEffectComponent({ stat: 'speed', operation: 'add', value: 10 })).toBe('Speed +10');
    expect(describeDuration({ unit: 'manual' })).toBe('Manual');
    expect(describeDuration({ unit: 'rounds', total: 10, remaining: 4 })).toBe('4/10 rounds');
  });
});
