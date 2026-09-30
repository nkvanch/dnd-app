import { SessionRuntime, RuntimeDeps, useSessionRuntime } from '../runtime';
import { InMemoryNetwork } from '../memoryTransport';
import { LoopbackNetwork } from '../loopbackTransport';
import { InMemoryKv } from '../kv';
import { SessionPeer } from '../peer';
import { PrepService } from '../prep';
import { SessionHost } from '../host';
import { FakeCharacter } from '../testing/harness';
import { destinationsFor, primaryDestination, capabilityLabel } from '../routing';
import type { ActiveComponents } from '../effectBridge';

function deps(net: InMemoryNetwork, kv: InMemoryKv, sink?: RuntimeDeps['effectSink']): RuntimeDeps {
  let n = 0;
  return {
    kv,
    remoteServer: () => net.server(),
    localLink: () => { const l = new LoopbackNetwork(); return { server: l.server(), client: l.client() }; },
    remoteClient: (host, port) => { void host; void port; return net.client('device'); },
    localAddress: () => Promise.resolve({ host: '10.0.0.5', code: 'ABC1234' }),
    port: 7743,
    newId: () => `id${++n}`,
    ...(sink ? { effectSink: sink } : {}),
  };
}

async function tick(net: InMemoryNetwork): Promise<void> {
  for (let i = 0; i < 5; i++) { await net.settle(); await new Promise(r => setTimeout(r, 0)); }
}

describe('routing from capabilities', () => {
  it('opens the single relevant screen and lets multi-role devices choose', () => {
    expect(primaryDestination(['host'])).toBe('host');
    expect(primaryDestination(['dm'])).toBe('dm');
    expect(primaryDestination(['player'])).toBe('player');
    expect(primaryDestination(['host', 'dm'])).toBeNull();
    expect(destinationsFor(['host', 'dm'])).toEqual(['host', 'dm']);
    expect(destinationsFor([])).toEqual([]);
    expect(capabilityLabel(['host', 'dm'])).toBe('Host + DM');
    expect(capabilityLabel([])).toBe('Waiting for a role');
  });

  it('a Host-only device is never routed to the DM screen', () => {
    expect(destinationsFor(['host'])).not.toContain('dm');
  });
});

describe('SessionRuntime', () => {
  beforeEach(() => useSessionRuntime.setState({ mode: 'idle', view: null, capabilities: [], status: 'disconnected', error: null }));

  it('Host only: routes to Host, exposes participants but no DM material', async () => {
    const net = new InMemoryNetwork();
    const rt = new SessionRuntime(deps(net, new InMemoryKv()));
    await rt.startHosting({ nickname: 'Hosty' });
    await tick(net);
    const s = useSessionRuntime.getState();
    expect(s.mode).toBe('hosting');
    expect(s.capabilities).toEqual(['host']);
    expect(s.status).toBe('connected');
    expect(s.address).toBe('10.0.0.5:7743');
    expect(destinationsFor(s.capabilities)).toEqual(['host']);
    expect(s.view!.effects).toEqual({});
    await rt.leave();
    expect(useSessionRuntime.getState().mode).toBe('idle');
  });

  it('Host + DM is an explicit combination and gets both screens', async () => {
    const net = new InMemoryNetwork();
    const rt = new SessionRuntime(deps(net, new InMemoryKv()));
    await rt.startHosting({ nickname: 'Both', extraCaps: ['dm'] });
    await tick(net);
    expect(useSessionRuntime.getState().capabilities.sort()).toEqual(['dm', 'host']);
    expect(destinationsFor(useSessionRuntime.getState().capabilities)).toEqual(['host', 'dm']);
    await rt.leave();
  });

  it('joining as DM without approval yields no DM screen until the Host approves', async () => {
    const net = new InMemoryNetwork();
    const hostKv = new InMemoryKv();
    const host = new SessionHost({ sessionId: 's', dmPolicy: 'manual' });
    await host.start(net.server());
    const rt = new SessionRuntime(deps(net, new InMemoryKv()));
    await rt.join({ host: '10.0.0.5', nickname: 'Tater', wants: ['dm'] });
    await tick(net);
    expect(useSessionRuntime.getState().capabilities).toEqual([]);
    expect(destinationsFor(useSessionRuntime.getState().capabilities)).toEqual([]);
    void hostKv;
    await rt.leave();
  });

  it('a player runtime pushes only its OWN active effect mechanics to the character sheet', async () => {
    const net = new InMemoryNetwork();
    let t = 0;
    const host = new SessionHost({ sessionId: 's', dmPolicy: 'auto-first', now: () => ++t });
    await host.start(net.server());
    const dmKv = new InMemoryKv();
    const dm = await SessionPeer.create({
      participantId: 'dm', nickname: 'DM', requestedCapabilities: ['dm'], transport: net.client('dm'), kv: dmKv,
      prep: new PrepService(dmKv), vault: undefined,
    });
    await dm.connect();
    const sinkCalls: [string, ActiveComponents[]][] = [];
    const character = new FakeCharacter('char_me', 'Me');
    const rt = new SessionRuntime(deps(net, new InMemoryKv(), (id, active) => { sinkCalls.push([id, active]); }));
    await rt.join({ host: '10.0.0.5', nickname: 'Me', wants: ['player'], character, characterId: 'char_me' });
    await tick(net);
    const other = await SessionPeer.create({ participantId: 'other', nickname: 'Other', requestedCapabilities: ['player'], transport: net.client('other'), kv: new InMemoryKv() });
    await other.connect();
    await tick(net);

    const me = useSessionRuntime.getState().participantId!;
    dm.sendRaw({ kind: 'dm.apply_effect', targets: [me], effect: { id: 'fx1', name: null, description: null, source: null, visibility: 'secret', components: [{ stat: 'ac', operation: 'add', value: -1 }], duration: { unit: 'manual' } } });
    dm.sendRaw({ kind: 'dm.apply_effect', targets: ['other'], effect: { id: 'fx2', name: 'Public buff', description: null, source: null, visibility: 'public', components: [{ stat: 'speed', operation: 'add', value: 10 }], duration: { unit: 'manual' } } });
    await tick(net);

    const last = sinkCalls[sinkCalls.length - 1];
    expect(last[0]).toBe('char_me');
    expect(last[1].map(a => a.applicationId)).toEqual([`fx1:${me}`]);       // not the buff on someone else
    expect(last[1][0].components).toEqual([{ stat: 'ac', operation: 'add', value: -1 }]);
    expect(JSON.stringify(sinkCalls)).not.toContain('Public buff');

    dm.sendRaw({ kind: 'dm.end_effect', effectId: 'fx1' });
    await tick(net);
    expect(sinkCalls[sinkCalls.length - 1][1]).toEqual([]);                 // ended effects come off the sheet

    await rt.leave();
    expect(sinkCalls[sinkCalls.length - 1][1]).toEqual([]);
  });

  it('a Host restart resumes the persisted live session with the same participants', async () => {
    const net = new InMemoryNetwork();
    const kv = new InMemoryKv();
    const rt1 = new SessionRuntime(deps(net, kv));
    await rt1.startHosting({ nickname: 'Hosty', extraCaps: ['dm'], dmPolicy: 'auto-first' });
    await tick(net);
    const before = useSessionRuntime.getState().view!.sessionId;
    expect(await rt1.hasResumableHostSession()).toBe(true);
    await rt1.leave();                                                   // app closed
    const rt2 = new SessionRuntime(deps(new InMemoryNetwork(), kv));
    await rt2.startHosting({ nickname: 'Hosty', extraCaps: ['dm'], resume: true });
    await tick(new InMemoryNetwork());
    expect(useSessionRuntime.getState().view!.sessionId).toBe(before);
    expect(useSessionRuntime.getState().capabilities.sort()).toEqual(['dm', 'host']);
    await rt2.endHostedSession();
    expect(await rt2.hasResumableHostSession()).toBe(false);
  });
});

describe('SessionRuntime reports the player character', () => {
  it('announces once per connection, again on reconnect, and on character change', async () => {
    const net = new InMemoryNetwork();
    const host = new SessionHost({ sessionId: 's', dmPolicy: 'auto-first' });
    await host.start(net.server());
    const character = new FakeCharacter('char_me', 'Me');
    let watcherCb: (() => void) | null = null;
    let unwatched = 0;
    const d = deps(net, new InMemoryKv());
    d.watchCharacter = (_id, cb) => { watcherCb = cb; return () => { unwatched += 1; }; };
    const rt = new SessionRuntime(d);
    await rt.join({ host: '10.0.0.5', nickname: 'Me', wants: ['player'], character, characterId: 'char_me' });
    await tick(net);
    const me = useSessionRuntime.getState().participantId!;
    expect(host.debugState().characters[me].summary.name).toBe('Me');
    expect(watcherCb).not.toBeNull();

    character.localEdit();                       // hp 19, revision 2
    watcherCb!();
    await tick(net);
    expect(host.debugState().characters[me].revision).toBe(2);

    rt.currentPeer!.disconnect();
    await tick(net);
    expect(unwatched).toBe(1);                   // watcher released while offline
    await rt.reconnect();
    await tick(net);
    expect(watcherCb).not.toBeNull();
    await rt.leave();
  });
});
