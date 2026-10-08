import { newRig, addDm, addPlayer } from '../testing/harness';
import { SessionPeer, NotCapableError } from '../peer';
import { InMemoryKv } from '../kv';

const applyFx = (id: string, targets: string[]) => ({
  kind: 'dm.apply_effect' as const,
  effect: {
    id, name: 'X', description: null, source: null, visibility: 'public' as const,
    components: [{ stat: 'ac' as const, operation: 'add' as const, value: 1 }], duration: { unit: 'manual' as const },
  },
  targets,
});

describe('role separation: Host is not DM', () => {
  it('a Host-only participant holds exactly the host capability', async () => {
    const rig = await newRig();
    expect(rig.hostPeer.capabilities).toEqual(['host']);
    expect(rig.host.debugState().participants.host1.capabilities).toEqual(['host']);
  });

  it('Host-only cannot DM-mutate, even by sending a raw forged DM op', async () => {
    const rig = await newRig();
    const p1 = await addPlayer(rig, 'p1');
    const before = rig.host.debugState().revision;
    const opId = rig.hostPeer.sendRaw(applyFx('fx-forged', ['p1']));
    await rig.settle();
    expect(rig.hostPeer.resultOf(opId)).toMatchObject({ status: 'forbidden', reason: 'requires-capability:dm' });
    expect(rig.host.debugState().effects['fx-forged']).toBeUndefined();
    expect(rig.host.debugState().revision).toBe(before);
    expect(p1.peer.visibleEffects()).toHaveLength(0);
  });

  it('the local guard also stops well-behaved Host-only code paths', async () => {
    const rig = await newRig();
    expect(() => rig.hostPeer.tickRounds(1)).toThrow(NotCapableError);
  });

  it('Host-only cannot forge player operations', async () => {
    const rig = await newRig();
    await addPlayer(rig, 'p1');
    const opId = rig.hostPeer.sendRaw({ kind: 'player.report_character', characterId: 'x', revision: 1, summary: { name: 'x', hp: 1, maxHp: 1, ac: 1 } });
    await rig.settle();
    expect(rig.hostPeer.resultOf(opId)?.status).toBe('forbidden');
  });

  it('a Player cannot DM-mutate or host-mutate', async () => {
    const rig = await newRig();
    const p1 = await addPlayer(rig, 'p1');
    const a = p1.peer.sendRaw(applyFx('fx-p', ['p1']));
    const b = p1.peer.sendRaw({ kind: 'host.assign_capabilities', participantId: 'p1', capabilities: ['dm'] });
    const c = p1.peer.sendRaw({ kind: 'host.end_session' });
    await rig.settle();
    for (const id of [a, b, c]) expect(p1.peer.resultOf(id)?.status).toBe('forbidden');
    expect(rig.host.debugState().participants.p1.capabilities).toEqual(['player']);
    expect(rig.host.debugState().ended).toBe(false);
  });

  it('a DM cannot perform Host operations or respond to requests as a player', async () => {
    const rig = await newRig();
    const dm = await addDm(rig);
    const a = dm.peer.sendRaw({ kind: 'host.end_session' });
    const b = dm.peer.sendRaw({ kind: 'player.respond', requestId: 'r', decision: 'reject', currentRevision: 1 });
    await rig.settle();
    expect(dm.peer.resultOf(a)?.status).toBe('forbidden');
    expect(dm.peer.resultOf(b)?.status).toBe('forbidden');
  });

  it('explicit Host+DM combination can do both capability sets', async () => {
    const rig = await newRig({ hostCapabilities: ['dm'], dmPolicy: 'manual' });
    expect(rig.hostPeer.capabilities.sort()).toEqual(['dm', 'host']);
    const p1 = await addPlayer(rig, 'p1');
    const applied = rig.hostPeer.sendRaw(applyFx('fx1', ['p1']));
    const ended = rig.hostPeer.assignCapabilities('p1', ['player']);
    await rig.settle();
    expect(rig.hostPeer.resultOf(applied)?.status).toBe('applied');
    expect(rig.hostPeer.resultOf(ended)?.status).toBe('applied');
    expect(p1.peer.visibleEffects()).toHaveLength(1);
  });

  it('host capability can never be requested or granted over the network', async () => {
    const rig = await newRig();
    const kv = new InMemoryKv();
    const sneaky = await SessionPeer.create({
      participantId: 'sneak', nickname: 'Sneak', requestedCapabilities: ['host', 'player'] as never,
      transport: rig.net.client('sneak'), kv,
    });
    await sneaky.connect();
    await rig.settle();
    expect(sneaky.capabilities).toEqual(['player']);
    const dm = await addDm(rig);
    const id = dm.peer.sendRaw({ kind: 'host.assign_capabilities', participantId: 'sneak', capabilities: ['host'] as never });
    await rig.settle();
    expect(dm.peer.resultOf(id)?.status).toBe('forbidden');
    expect(rig.host.debugState().participants.sneak.capabilities).toEqual(['player']);
  });

  it('DM under the manual policy must be approved by the Host', async () => {
    const rig = await newRig({ dmPolicy: 'manual' });
    const dm = await addDm(rig);
    expect(dm.peer.capabilities).toEqual([]);
    expect(rig.host.debugState().participants.dm1.requestedDm).toBe(true);
    // Not yet DM: forged op refused.
    const early = dm.peer.sendRaw(applyFx('fx-early', []));
    await rig.settle();
    expect(dm.peer.resultOf(early)?.status).toBe('forbidden');
    // Host approves.
    const id = rig.hostPeer.assignCapabilities('dm1', ['dm']);
    await rig.settle();
    expect(rig.hostPeer.resultOf(id)?.status).toBe('applied');
    expect(dm.peer.capabilities).toEqual(['dm']);
    expect(rig.host.debugState().participants.dm1.requestedDm).toBeUndefined();
  });

  it('auto-first grants DM once; a second claimant stays pending', async () => {
    const rig = await newRig({ dmPolicy: 'auto-first' });
    const dm1 = await addDm(rig, 'dmA');
    const dm2 = await addDm(rig, 'dmB');
    expect(dm1.peer.capabilities).toEqual(['dm']);
    expect(dm2.peer.capabilities).toEqual([]);
  });

  it('participant tokens stop identity theft on reconnect', async () => {
    const rig = await newRig();
    const dm = await addDm(rig);
    const thief = await SessionPeer.create({
      participantId: 'dm1', nickname: 'Thief', requestedCapabilities: ['dm'],
      transport: rig.net.client('thief'), kv: new InMemoryKv(),
    });
    await thief.connect();
    await rig.settle();
    expect(thief.status).not.toBe('connected');
    expect(thief.lastError).toMatch(/authentication/);
    expect(rig.host.debugState().participants.dm1.nickname).toBe('Dungeon Master');
    expect(dm.peer.capabilities).toEqual(['dm']);
  });

  it('a Host-only projection carries participants and revision but no effects, requests or characters', async () => {
    const rig = await newRig();
    const dm = await addDm(rig);
    const p1 = await addPlayer(rig, 'p1');
    dm.peer.requestChange('p1', 'Test', [{ kind: 'exhaustion', delta: 1 }]);
    dm.peer.sendRaw(applyFx('fx1', ['p1']));
    await rig.settle();
    const view = rig.hostPeer.view!;
    expect(Object.keys(view.participants).sort()).toEqual(['dm1', 'host1', 'p1']);
    expect(view.effects).toEqual({});
    expect(view.requests).toEqual({});
    expect(view.characters).toEqual({});
    expect(view.encounters).toEqual({});
    expect(p1.peer.view!.revision).toBe(view.revision);
  });
});

describe('returning participants can change what they ask for (but never lose or self-grant power)', () => {
  it('adds player when newly requested, keeps existing capabilities, and never removes any', async () => {
    const rig = await newRig({ dmPolicy: 'manual' });
    const first = await addDm(rig, 'wanderer');                     // asked for DM only, not approved
    expect(first.peer.capabilities).toEqual([]);
    first.peer.disconnect();
    await rig.settle();
    const back = await SessionPeer.create({
      participantId: 'wanderer', nickname: 'Wanderer', requestedCapabilities: ['player'],
      transport: rig.net.client('wanderer'), kv: first.kv,
    });
    await back.connect();
    await rig.settle();
    expect(back.capabilities).toEqual(['player']);                  // player grantable on return
    expect(rig.host.debugState().participants.wanderer.requestedDm).toBeUndefined();   // no longer asking for DM
  });

  it('a returning participant cannot self-promote to DM under the manual policy', async () => {
    const rig = await newRig({ dmPolicy: 'manual' });
    const p = await addPlayer(rig, 'pat');
    p.peer.disconnect();
    await rig.settle();
    const back = await SessionPeer.create({
      participantId: 'pat', nickname: 'pat', requestedCapabilities: ['player', 'dm'],
      transport: rig.net.client('pat'), kv: p.kv,
    });
    await back.connect();
    await rig.settle();
    expect(back.capabilities).toEqual(['player']);
    expect(rig.host.debugState().participants.pat.requestedDm).toBe(true);
  });

  it('a returning DM keeps DM when it reconnects asking only for player', async () => {
    const rig = await newRig({ dmPolicy: 'auto-first' });
    const dm = await addDm(rig, 'dmx');
    dm.peer.disconnect();
    await rig.settle();
    const back = await SessionPeer.create({
      participantId: 'dmx', nickname: 'dmx', requestedCapabilities: ['player'],
      transport: rig.net.client('dmx'), kv: dm.kv,
    });
    await back.connect();
    await rig.settle();
    expect(back.capabilities.sort()).toEqual(['dm', 'player']);
  });
});
