// Quick Override (DM_SCREEN_SPEC.md item 12) — a DM-built-on-the-spot effect, same underlying
// op as a prepared effect (dm.apply_effect), but with source always forced to 'DM Override' so
// it's visibly distinguishable from something pre-authored in DM Preparation.
import { newRig, addDm, addPlayer } from '../testing/harness';

describe('peer.applyQuickEffect', () => {
  it('applies with source always "DM Override", visible to the target', async () => {
    const rig = await newRig();
    const dm = await addDm(rig);
    const alice = await addPlayer(rig, 'alice');
    dm.peer.applyQuickEffect({ name: 'Blessed Ground', visibility: 'public', components: [{ stat: 'ac', operation: 'add', value: 2 }], duration: { unit: 'manual' } }, ['alice']);
    await rig.settle();

    const effect = Object.values(alice.peer.view!.effects)[0];
    expect(effect.definition.name).toBe('Blessed Ground');
    expect(effect.definition.source).toBe('DM Override');
    expect(effect.definition.components).toEqual([{ stat: 'ac', operation: 'add', value: 2 }]);
  });

  it('a note-only override (no stat picked) applies with an empty component list', async () => {
    const rig = await newRig();
    const dm = await addDm(rig);
    const alice = await addPlayer(rig, 'alice');
    dm.peer.applyQuickEffect({ name: 'Reminder', description: 'Watch the north door', visibility: 'public', components: [], duration: { unit: 'manual' } }, ['alice']);
    await rig.settle();

    const effect = Object.values(alice.peer.view!.effects)[0];
    expect(effect.definition.components).toEqual([]);
    expect(effect.definition.description).toBe('Watch the north door');
  });

  it('"target" visibility is seen by the target but not by an uninvolved player', async () => {
    const rig = await newRig();
    const dm = await addDm(rig);
    const alice = await addPlayer(rig, 'alice');
    const bob = await addPlayer(rig, 'bob');
    dm.peer.applyQuickEffect({ name: 'Marked', visibility: 'target', components: [{ stat: 'save', operation: 'add', value: -1 }], duration: { unit: 'manual' } }, ['alice']);
    await rig.settle();

    expect(Object.keys(alice.peer.view!.effects)).toHaveLength(1);
    expect(Object.keys(bob.peer.view!.effects)).toHaveLength(0);
  });

  it('respects a rounds duration, same as a prepared effect', async () => {
    const rig = await newRig();
    const dm = await addDm(rig);
    const alice = await addPlayer(rig, 'alice');
    dm.peer.applyQuickEffect({ name: 'Haste', visibility: 'public', components: [{ stat: 'initiative', operation: 'add', value: 2 }], duration: { unit: 'rounds', total: 3, remaining: 3 } }, ['alice']);
    await rig.settle();

    const effect = Object.values(alice.peer.view!.effects)[0];
    const app = Object.values(effect.applications)[0];
    expect(app.remaining).toBe(3);
    expect(effect.definition.duration).toEqual({ unit: 'rounds', total: 3, remaining: 3 });
  });

  it('the Host sees nothing — same visibility rule as every other effect', async () => {
    const rig = await newRig();
    const dm = await addDm(rig);
    const alice = await addPlayer(rig, 'alice');
    dm.peer.applyQuickEffect({ name: 'Blessing', visibility: 'public', components: [], duration: { unit: 'manual' } }, ['alice']);
    await rig.settle();
    expect(rig.hostPeer.view!.effects).toEqual({});
  });
});
