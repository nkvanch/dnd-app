// src/sync/__tests__/syncManager.test.ts
// First test coverage for this file. Locks in the CampaignHost /
// NetworkHostAvailability split: startAsServer must succeed (never throw)
// regardless of whether a usable local network is currently available —
// hosting is a session/role concept, independent of whether anyone can
// currently connect. Only the room code (NetworkHostAvailability) depends
// on having a real IP to encode.
//
// Network calls (expo-network's getIpAddressAsync) aren't mocked here —
// in this Jest environment they reliably fail/resolve to no address
// (discovery.ts's getLocalIp() already catches and returns null for any
// failure), which is exactly the "no usable local network" scenario this
// suite needs — the same reason __mocks__/react-native-tcp-socket.js's own
// header comment gives for not calling into the real native sync layer:
// nothing here exercises actual native networking, only the pure state
// machine built on top of it.
// SyncServer's own start() requires NativeModules.TcpSockets to be linked —
// a real native-bridge concern the __mocks__/react-native-tcp-socket.js
// package mock doesn't cover (it stubs the JS package's exports, not the
// native module registry entry server.ts checks directly). Out of scope
// here: this suite tests syncManager's own role/roomCode decision logic
// (CampaignHost independent of NetworkHostAvailability), not SyncServer's
// native transport — same "don't test the native layer" boundary
// __mocks__/react-native-tcp-socket.js's own header comment already draws.
const mockBroadcastCampaign = jest.fn();
const mockBroadcastCampaignPatch = jest.fn();
jest.mock('../server', () => ({
  SyncServer: jest.fn().mockImplementation(() => ({
    start:  () => Promise.resolve(),
    stop:   () => {},
    sendTo: () => {},
    broadcastCampaign:      (...args: unknown[]) => mockBroadcastCampaign(...args),
    broadcastCampaignPatch: (...args: unknown[]) => mockBroadcastCampaignPatch(...args),
    get clientCount() { return 0; },
  })),
}));

// Captures the ClientCallbacks object syncManager.startAsClient constructs,
// so PERSIST-1's regression test below can fire onEntitySnapshot directly
// without a real socket — same "don't test the native transport" boundary
// the server mock above already draws.
let capturedClientCallbacks: import('../client').ClientCallbacks | null = null;
jest.mock('../client', () => ({
  SyncClient: jest.fn().mockImplementation((_deviceId, _nickname, characterId, callbacks) => {
    capturedClientCallbacks = callbacks;
    return {
      connect:  () => {},
      disconnect: () => {},
      send: () => {},
      get ownedCharacterId() { return characterId; },
      get lastErrorMessage() { return null; },
      get target() { return ''; },
    };
  }),
}));

const mockSaveEntity = jest.fn().mockResolvedValue(undefined);
jest.mock('../../db/entityRepo', () => ({
  saveEntity: (...args: unknown[]) => mockSaveEntity(...args),
}));

import { syncManager } from '../syncManager';

describe('syncManager.startAsServer — CampaignHost is independent of NetworkHostAvailability', () => {
  afterEach(() => {
    syncManager.stopAll();
  });

  it('does not throw and enters the dm role even with no usable local network', async () => {
    // If this call rejects, the test fails via the unhandled/awaited
    // rejection — the real assertion here is that we ever reach the line
    // below at all.
    await syncManager.startAsServer('camp1', 'sess1', 'dev1', 'Nick');
    const status = syncManager.getStatus();
    expect(status.role).toBe('dm');
  });

  it('reports connected (the server is running) even when the room code is unavailable', async () => {
    await syncManager.startAsServer('camp1', 'sess1', 'dev1', 'Nick');
    const status = syncManager.getStatus();
    // In this test environment getIpAddressAsync() cannot resolve a real
    // LAN address, so roomCode is expected to be null here — the point
    // under test is that hosting (connected/role) doesn't depend on it.
    expect(status.connected).toBe(true);
  });

  it('ownedCharacterId stays null for the DM role (only meaningful for players)', async () => {
    await syncManager.startAsServer('camp1', 'sess1', 'dev1', 'Nick');
    expect(syncManager.ownedCharacterId).toBeNull();
  });

  it('stopAll() cleanly returns to offline with no lingering room code or roster', async () => {
    await syncManager.startAsServer('camp1', 'sess1', 'dev1', 'Nick');
    syncManager.stopAll();
    const status = syncManager.getStatus();
    expect(status.role).toBe('offline');
    expect(status.roomCode).toBeNull();
    expect(status.connected).toBe(false);
  });

  it('a second startAsServer call (re-host) also succeeds without throwing', async () => {
    await syncManager.startAsServer('camp1', 'sess1', 'dev1', 'Nick');
    await syncManager.startAsServer('camp1', 'sess1', 'dev1', 'Nick');
    expect(syncManager.getStatus().role).toBe('dm');
  });
});

describe('syncManager — network appearing/disappearing while already hosting (no restart needed)', () => {
  afterEach(() => {
    syncManager.stopAll();
    jest.resetModules();
    jest.dontMock('../discovery');
  });

  it('regenerates the room code reactively when a network becomes available, without a new startAsServer call', async () => {
    // Controls getLocalIp's answer per call and captures the change
    // listener the same way syncManager itself receives it, so the test
    // can simulate "the OS just told us connectivity changed" without any
    // real native network call.
    let currentIp: string | null = null;
    let fireNetworkChange: () => void = () => {};

    jest.resetModules();
    jest.doMock('../discovery', () => {
      const actual = jest.requireActual('../discovery');
      return {
        ...actual,
        getLocalIp: () => Promise.resolve(currentIp),
        watchNetworkChanges: (onChange: () => void) => {
          fireNetworkChange = onChange;
          return { remove: () => {} };
        },
      };
    });

    // Re-require with the mock applied — jest.doMock only affects modules
    // resolved after this point, so syncManager (and its own import of
    // discovery.ts) must be required fresh. Plain require(), not a dynamic
    // import() — this project's Babel/CommonJS Jest transform doesn't
    // support dynamic import() without --experimental-vm-modules.
    const { syncManager: freshManager } = require('../syncManager') as typeof import('../syncManager');

    await freshManager.startAsServer('camp1', 'sess1', 'dev1', 'Nick');
    expect(freshManager.getStatus().roomCode).toBeNull(); // no network yet

    currentIp = '192.168.1.42'; // WiFi/hotspot just connected
    fireNetworkChange();
    // refreshRoomCode's getLocalIp() call is async — flush microtasks.
    await Promise.resolve();
    await Promise.resolve();

    const afterConnect = freshManager.getStatus();
    expect(afterConnect.roomCode).not.toBeNull();
    expect(afterConnect.role).toBe('dm'); // still the same hosting session — never restarted

    currentIp = null; // network drops again
    fireNetworkChange();
    await Promise.resolve();
    await Promise.resolve();

    const afterDrop = freshManager.getStatus();
    expect(afterDrop.roomCode).toBeNull();
    expect(afterDrop.role).toBe('dm'); // host state preserved — joining just isn't available

    freshManager.stopAll();
  });
});

describe('syncManager.syncCampaignPatch — DM-only Campaign sync (CAMPAIGN-SYNC-1)', () => {
  afterEach(() => {
    syncManager.stopAll();
    mockBroadcastCampaign.mockClear();
    mockBroadcastCampaignPatch.mockClear();
  });

  function fakeCampaign(overrides: Record<string, unknown> = {}) {
    return {
      id: 'camp1', name: 'Test', dmDeviceId: 'dm-device', joinCode: 'ABC1234',
      rules: {}, playerIds: [], characterIds: [], notes: '', createdAt: 0,
      ...overrides,
    } as unknown as import('../../engine/types').Campaign;
  }

  it('broadcasts a full snapshot when there is no prior campaign to diff against', async () => {
    await syncManager.startAsServer('camp1', 'sess1', 'dm-device', 'DM');
    syncManager.syncCampaignPatch('camp1', null, fakeCampaign());
    expect(mockBroadcastCampaign).toHaveBeenCalledWith(fakeCampaign());
    expect(mockBroadcastCampaignPatch).not.toHaveBeenCalled();
  });

  it('broadcasts only the diff when a prior campaign is given', async () => {
    await syncManager.startAsServer('camp1', 'sess1', 'dm-device', 'DM');
    syncManager.syncCampaignPatch('camp1', fakeCampaign({ notes: 'old' }), fakeCampaign({ notes: 'new' }));
    expect(mockBroadcastCampaignPatch).toHaveBeenCalledWith('camp1', { notes: 'new' });
    expect(mockBroadcastCampaign).not.toHaveBeenCalled();
  });

  it('does not broadcast anything when nothing actually changed', async () => {
    await syncManager.startAsServer('camp1', 'sess1', 'dm-device', 'DM');
    const c = fakeCampaign();
    syncManager.syncCampaignPatch('camp1', c, fakeCampaign());
    expect(mockBroadcastCampaign).not.toHaveBeenCalled();
    expect(mockBroadcastCampaignPatch).not.toHaveBeenCalled();
  });

  it('is a no-op when this device is not the DM (never started as server)', () => {
    syncManager.syncCampaignPatch('camp1', null, fakeCampaign());
    expect(mockBroadcastCampaign).not.toHaveBeenCalled();
  });
});

describe('syncManager.startAsClient — onEntitySnapshot does not persist directly (PERSIST-1 regression)', () => {
  afterEach(() => {
    syncManager.stopAll();
    capturedClientCallbacks = null;
    mockSaveEntity.mockClear();
  });

  it('does not call entityRepo.saveEntity itself when an entity snapshot arrives', async () => {
    // A previous bug: syncManager's onEntitySnapshot callback called
    // saveEntity(entity) directly AND ALSO forwarded to
    // callbacks.onEntityReceived — the latter (wired to characterStore's
    // applyIncomingEntity in the real app) already owns persistence,
    // conditioned on its own stale-snapshot guard. The direct call bypassed
    // that guard and could silently overwrite SQLite with a stale entity
    // even when applyIncomingEntity correctly rejected it in memory.
    //
    // This test proves the fix at the syncManager layer in isolation: no
    // matter what the store-level onEntityReceived callback decides (it's a
    // no-op stub here), syncManager itself must never touch entityRepo.
    let receivedEntity: unknown = null;
    syncManager.initialise({
      onStatusChange:        () => {},
      onEntityReceived:      (entity) => { receivedEntity = entity; },
      onEntityPatchReceived: () => {},
      onSyncEvent:           () => {},
    });

    await syncManager.startAsClient('0000001', 'dev1', 'Nick', 'char1');
    expect(capturedClientCallbacks).not.toBeNull();

    const fakeEntity = { id: 'char1', kind: 'character' } as unknown as import('../../engine/types').Entity;
    capturedClientCallbacks!.onEntitySnapshot(fakeEntity);

    expect(receivedEntity).toBe(fakeEntity); // still forwarded to the store layer
    expect(mockSaveEntity).not.toHaveBeenCalled(); // but never persisted by syncManager itself
  });
});
