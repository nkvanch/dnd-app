// End-to-end regression for the Create Campaign device failure: completing the normal wizard must land on an OFFLINE DM campaign
// (Host Session offered, no Stop Hosting, no room code, no QR, no server), and hosting happens only through the explicit
// Host Session button. The store tests alone passed while the device showed "Stop Hosting", because the screen drew an unconditional
// Stop Hosting button, so this renders the real screen and presses the real buttons.
const mockPush = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush, back: jest.fn(), replace: jest.fn() }), useLocalSearchParams: () => ({}) }));
jest.mock('react-native-qrcode-svg', () => { const { Text } = require('react-native'); return { __esModule: true, default: () => <Text>QR-CODE</Text> }; });
jest.mock('../components/live/LiveSessionStart', () => ({ HostModal: () => null, JoinModal: () => null }));
jest.mock('../components/CampaignPacksNote', () => ({ CampaignPacksNote: () => null }));
jest.mock('../db/packRegistryRepo', () => ({ loadInstalledPacks: () => Promise.resolve([]) }));
jest.mock('../db/customRuleProfileRepo', () => ({ loadCustomRuleProfiles: () => Promise.resolve([]), saveCustomRuleProfile: jest.fn(), deleteCustomRuleProfile: jest.fn() }));
jest.mock('../utils/alert', () => ({
  // confirmations are answered with the destructive/confirming button, as a user pressing it would
  Alert: { alert: jest.fn((_t: string, _m?: string, buttons?: { text: string; style?: string; onPress?: () => void }[]) => { buttons?.find(b => b.style === 'destructive')?.onPress?.(); }) },
}));

import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import CampaignsScreen from '../../app/(tabs)/campaigns';
import { useCampaignStore } from '../store/campaignStore';
import { useSessionStore } from '../store/sessionStore';
import { useSyncStore } from '../store/syncStore';
import { syncManager } from '../sync/syncManager';
import * as campaignRepo from '../db/campaignRepo';
import * as appMetaRepo from '../db/appMetaRepo';
import { Campaign } from '../engine/types';

const texts = (r: TestRenderer.ReactTestRenderer): string[] => {
  const out: string[] = [];
  const walk = (n: unknown) => {
    if (typeof n === 'string') { out.push(n); return; }
    if (!n || typeof n !== 'object') return;
    ((n as { children?: unknown[] }).children ?? []).forEach(walk);
  };
  walk(r.toJSON());
  return out;
};
const screenText = (r: TestRenderer.ReactTestRenderer) => texts(r).join(' | ');
const byId = (r: TestRenderer.ReactTestRenderer, id: string) => r.root.findAll(n => n.props.testID === id && typeof n.props.onPress === 'function' || n.props.testID === id && typeof n.props.onChangeText === 'function')[0];
const hasId = (r: TestRenderer.ReactTestRenderer, id: string) => r.root.findAll(n => n.props.testID === id).length > 0;
const press = (r: TestRenderer.ReactTestRenderer, id: string) => act(async () => { await byId(r, id).props.onPress(); });
const pressLabel = (r: TestRenderer.ReactTestRenderer, label: string) => {
  const btn = r.root.findAll(n => typeof n.props.onPress === 'function' && n.findAll(c => c.children.includes(label)).length > 0)[0];
  if (!btn) throw new Error(`no pressable "${label}" in: ${screenText(r)}`);
  return act(async () => { await btn.props.onPress(); });
};

let saved: Campaign[];
let startAsServer: jest.SpyInstance, stopAll: jest.SpyInstance, announceClosing: jest.SpyInstance, startAsClient: jest.SpyInstance;

function resetStores() {
  useCampaignStore.setState({ campaigns: [], activeCampaign: null, isDm: false, liveSession: false });
  useSyncStore.getState().setStatus({ role: 'offline', connected: false, clientCount: 0, roomCode: null, sessionId: null, roster: [], lastError: null });
}

beforeEach(() => {
  saved = [];
  jest.spyOn(campaignRepo, 'saveCampaign').mockImplementation(async c => { saved = [...saved.filter(x => x.id !== c.id), JSON.parse(JSON.stringify(c))]; });
  jest.spyOn(campaignRepo, 'loadAllCampaigns').mockImplementation(async () => JSON.parse(JSON.stringify(saved)));
  jest.spyOn(appMetaRepo, 'getMeta').mockResolvedValue(null);
  jest.spyOn(appMetaRepo, 'setMeta').mockResolvedValue(undefined);
  // The real manager reports through the sync store; the spy does the same so the screen sees what a started server would show.
  startAsServer = jest.spyOn(syncManager, 'startAsServer').mockImplementation(async () => {
    useSyncStore.getState().setStatus({ role: 'dm', connected: true, clientCount: 0, roomCode: 'ROOM123', sessionId: 's', roster: [], lastError: null });
    return 'ROOM123';
  });
  startAsClient = jest.spyOn(syncManager, 'startAsClient').mockResolvedValue(undefined);
  announceClosing = jest.spyOn(syncManager, 'announceClosing').mockResolvedValue(undefined);
  stopAll = jest.spyOn(syncManager, 'stopAll').mockImplementation(() => {
    useSyncStore.getState().setStatus({ role: 'offline', connected: false, clientCount: 0, roomCode: null, sessionId: null, roster: [], lastError: null });
  });
  // the device session is persisted, so the active campaign id survives a restart exactly as it does on the device
  jest.spyOn(useSessionStore.getState(), 'setCampaignId').mockImplementation(async id => {
    useSessionStore.setState(st => ({ session: st.session ? { ...st.session, campaignId: id } : st.session }));
  });
  useSessionStore.setState({ session: { deviceId: 'dm-device', nickname: 'DM', role: 'dm', campaignId: null } as never });
  resetStores();
});
const mounted: TestRenderer.ReactTestRenderer[] = [];
afterEach(() => { for (const r of mounted.splice(0)) act(() => { r.unmount(); }); jest.restoreAllMocks(); resetStores(); });

async function mountAndCreate(): Promise<TestRenderer.ReactTestRenderer> {
  let r!: TestRenderer.ReactTestRenderer;
  await act(async () => { r = TestRenderer.create(<CampaignsScreen />); await Promise.resolve(); });
  mounted.push(r);
  expect(screenText(r)).toContain('No Active Campaign');
  await pressLabel(r, '👑 Create Campaign');
  await act(async () => { byId(r, 'wiz-name').props.onChangeText('OfflineAudit'); });
  for (let i = 0; i < 4; i++) await press(r, 'wiz-next');          // Basics, Rules, Permissions, Content, Review
  await press(r, 'wiz-create');
  return r;
}

describe('Create Campaign wizard, through the real screen', () => {
  it('finishing the wizard lands on an offline DM campaign: Host Session offered, nothing hosting', async () => {
    const r = await mountAndCreate();
    const t = screenText(r);

    // what the user sees
    expect(t).toContain('OfflineAudit');
    expect(t).toContain('Open DM Dashboard');
    expect(hasId(r, 'campaign-host-session')).toBe(true);
    expect(t).toContain('Host Session');
    expect(t).not.toContain('Stop Hosting');
    expect(hasId(r, 'campaign-stop-hosting')).toBe(false);
    expect(hasId(r, 'campaign-end-live-session')).toBe(false);
    expect(t).not.toContain('ROOM CODE');
    expect(t).not.toContain('QR-CODE');
    expect(t).toContain('Offline campaign, no live session');

    // what actually exists, independent of any button text
    const s = useCampaignStore.getState();
    expect(s.activeCampaign?.name).toBe('OfflineAudit');
    expect(s.isDm).toBe(true);
    expect(s.liveSession).toBe(false);
    expect(s.activeCampaign?.joinCode).toBe('');
    expect(saved).toHaveLength(1);
    expect(saved[0].joinCode).toBe('');
    expect(startAsServer).not.toHaveBeenCalled();
    expect(startAsClient).not.toHaveBeenCalled();
    expect(useSyncStore.getState().status.roomCode).toBeNull();
    expect(syncManager.getStatus()).toMatchObject({ role: 'offline', connected: false, roomCode: null, sessionId: null });

    // the DM tools do not depend on a session
    await pressLabel(r, '🎲 Open DM Dashboard');
    expect(mockPush).toHaveBeenCalledWith('/dm/dashboard');
  });

  it('Host Session starts the server once and shows the room code, QR and Stop Hosting; End Live Session returns to the offline campaign', async () => {
    const r = await mountAndCreate();
    await press(r, 'campaign-host-session');

    expect(startAsServer).toHaveBeenCalledTimes(1);
    expect(useCampaignStore.getState().liveSession).toBe(true);
    let t = screenText(r);
    expect(t).toContain('ROOM CODE');
    expect(t).toContain('ROOM123');
    expect(t).toContain('QR-CODE');
    expect(t).toContain('Stop Hosting');
    expect(hasId(r, 'campaign-host-session')).toBe(false);
    expect(hasId(r, 'campaign-end-live-session')).toBe(true);

    await press(r, 'campaign-end-live-session');

    expect(announceClosing).toHaveBeenCalled();
    expect(stopAll).toHaveBeenCalled();
    t = screenText(r);
    expect(t).not.toContain('Stop Hosting');
    expect(t).not.toContain('ROOM CODE');
    expect(t).not.toContain('QR-CODE');
    expect(hasId(r, 'campaign-host-session')).toBe(true);
    const s = useCampaignStore.getState();
    expect(s.liveSession).toBe(false);
    expect(s.activeCampaign?.name).toBe('OfflineAudit');
    expect(s.isDm).toBe(true);
    expect(s.activeCampaign?.joinCode).toBe('');
    expect(useSyncStore.getState().status.roomCode).toBeNull();
    expect(startAsServer).toHaveBeenCalledTimes(1);
  });

  it('Stop Hosting at the bottom of the page ends the live session too', async () => {
    const r = await mountAndCreate();
    await press(r, 'campaign-host-session');
    await press(r, 'campaign-stop-hosting');
    expect(useCampaignStore.getState().liveSession).toBe(false);
    expect(hasId(r, 'campaign-stop-hosting')).toBe(false);
    expect(screenText(r)).toContain('Host Session');
  });
});

describe('restart', () => {
  async function coldBoot() {
    // a new process: the stores start empty, the database is what survives (the layout runs loadCampaigns then resumeSync)
    for (const m of mounted.splice(0)) act(() => { m.unmount(); });
    resetStores();
    await useCampaignStore.getState().loadCampaigns();
    await useCampaignStore.getState().resumeSync();
  }

  it('an offline campaign comes back offline: restored, DM-owned, nothing hosting', async () => {
    await mountAndCreate();
    await coldBoot();
    const s = useCampaignStore.getState();
    expect(s.activeCampaign?.name).toBe('OfflineAudit');
    expect(s.isDm).toBe(true);
    expect(s.liveSession).toBe(false);
    expect(startAsServer).not.toHaveBeenCalled();
    expect(useSyncStore.getState().status.roomCode).toBeNull();
    const r = await (async () => { let x!: TestRenderer.ReactTestRenderer; await act(async () => { x = TestRenderer.create(<CampaignsScreen />); await Promise.resolve(); }); mounted.push(x); return x; })();
    expect(screenText(r)).not.toContain('Stop Hosting');
    expect(hasId(r, 'campaign-host-session')).toBe(true);
  });

  it('a campaign that was hosting does not resume hosting after a restart, and its old room code is discarded', async () => {
    const r = await mountAndCreate();
    await press(r, 'campaign-host-session');
    expect(saved[0].joinCode).toBe('ROOM123');            // the code was persisted while live
    startAsServer.mockClear();

    await coldBoot();                                      // app killed and reopened

    const s = useCampaignStore.getState();
    expect(s.activeCampaign?.name).toBe('OfflineAudit');
    expect(s.isDm).toBe(true);
    expect(s.liveSession).toBe(false);
    expect(s.activeCampaign?.joinCode).toBe('');
    expect(startAsServer).not.toHaveBeenCalled();
    expect(useSyncStore.getState().status.roomCode).toBeNull();
    let x!: TestRenderer.ReactTestRenderer;
    await act(async () => { x = TestRenderer.create(<CampaignsScreen />); await Promise.resolve(); });
    mounted.push(x);
    expect(screenText(x)).not.toContain('Stop Hosting');
    expect(screenText(x)).not.toContain('ROOM CODE');
    expect(hasId(x, 'campaign-host-session')).toBe(true);
  });
});
