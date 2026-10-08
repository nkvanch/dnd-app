// src/store/__tests__/campaignStore.test.ts
// First test coverage for this store. Locks in the fix for a real data-loss
// bug: leaveCampaign used to permanently DELETE the campaign whenever the
// DM left, which meant a DM could never own more than one campaign at a
// time — creating a second campaign required destroying the first, since
// there was no other way to "leave" one. Leaving is now non-destructive for
// both roles; deleteCampaignPermanently is the new, separate, explicit
// action for actual deletion; switchToCampaign lets a DM (or player) move
// between locally-known campaigns without losing any of them.
import { useCampaignStore } from '../campaignStore';
import { useSessionStore } from '../sessionStore';
import { syncManager } from '../../sync/syncManager';
import * as campaignRepo from '../../db/campaignRepo';
import * as appMetaRepo from '../../db/appMetaRepo';
import { DEFAULT_RULES } from '../characterStore';
import { Campaign, DeviceSession } from '../../engine/types';

function makeCampaign(overrides: Partial<Campaign> = {}): Campaign {
  return {
    id: 'camp1', name: 'Test Campaign', dmDeviceId: 'dm-device', joinCode: 'ABC1234',
    rules: { ...DEFAULT_RULES }, playerIds: [], characterIds: [], notes: '', createdAt: 0,
    ...overrides,
  };
}

function dmSession(): DeviceSession {
  return { deviceId: 'dm-device', nickname: 'DM', role: 'dm', campaignId: 'camp1' };
}

describe('campaignStore', () => {
  let saveCampaignSpy: jest.SpyInstance;
  let deleteCampaignSpy: jest.SpyInstance;
  let setCampaignIdSpy: jest.SpyInstance;
  let startAsServerSpy: jest.SpyInstance;
  let startAsClientSpy: jest.SpyInstance;
  let stopAllSpy: jest.SpyInstance;
  let announceClosingSpy: jest.SpyInstance;

  beforeEach(() => {
    saveCampaignSpy   = jest.spyOn(campaignRepo, 'saveCampaign').mockResolvedValue(undefined);
    deleteCampaignSpy = jest.spyOn(campaignRepo, 'deleteCampaign').mockResolvedValue(undefined);
    setCampaignIdSpy  = jest.spyOn(useSessionStore.getState(), 'setCampaignId').mockResolvedValue(undefined);
    startAsServerSpy  = jest.spyOn(syncManager, 'startAsServer').mockResolvedValue('DEF5678');
    startAsClientSpy  = jest.spyOn(syncManager, 'startAsClient').mockResolvedValue(undefined);
    stopAllSpy        = jest.spyOn(syncManager, 'stopAll').mockImplementation(() => {});
    announceClosingSpy = jest.spyOn(syncManager, 'announceClosing').mockResolvedValue(undefined);
    // SYNC-4 fix: hostOrConnectCampaign/reconnectWithCode/leaveCampaign now
    // read/write the claimed-character-id via the generic app_meta KV store
    // instead of hardcoding null — mocked here the same way campaignRepo is,
    // defaulting to "no claimed character" (null) so existing assertions
    // that predate this fix stay correct unless a test explicitly overrides it.
    jest.spyOn(appMetaRepo, 'getMeta').mockResolvedValue(null);
    jest.spyOn(appMetaRepo, 'setMeta').mockResolvedValue(undefined);
    useSessionStore.setState({ session: dmSession() });
  });

  afterEach(() => {
    jest.restoreAllMocks();
    useCampaignStore.setState({ campaigns: [], activeCampaign: null, isDm: false, liveSession: false });
  });

  describe('leaveCampaign — no longer destructive (the actual bug fix)', () => {
    it('a DM leaving keeps the campaign in the list — it used to be permanently deleted', async () => {
      const campaign = makeCampaign();
      useCampaignStore.setState({ campaigns: [campaign], activeCampaign: campaign, isDm: true });

      await useCampaignStore.getState().leaveCampaign();

      expect(deleteCampaignSpy).not.toHaveBeenCalled();
      expect(useCampaignStore.getState().campaigns).toEqual([campaign]);
      expect(useCampaignStore.getState().activeCampaign).toBeNull();
      expect(useCampaignStore.getState().isDm).toBe(false);
      expect(stopAllSpy).toHaveBeenCalled();
      expect(setCampaignIdSpy).toHaveBeenCalledWith(null);
    });

    it('a player leaving also keeps the campaign in the list (unchanged behavior)', async () => {
      const campaign = makeCampaign({ dmDeviceId: 'someone-else' });
      useSessionStore.setState({ session: { ...dmSession(), deviceId: 'player-device' } });
      useCampaignStore.setState({ campaigns: [campaign], activeCampaign: campaign, isDm: false });

      await useCampaignStore.getState().leaveCampaign();

      expect(deleteCampaignSpy).not.toHaveBeenCalled();
      expect(useCampaignStore.getState().campaigns).toEqual([campaign]);
      expect(useCampaignStore.getState().activeCampaign).toBeNull();
    });

    it('is a no-op when there is no active campaign', async () => {
      await useCampaignStore.getState().leaveCampaign();
      expect(stopAllSpy).not.toHaveBeenCalled();
    });
  });

  describe('CAMPAIGN-CLOSED-1 — connected players are told WHY hosting stopped', () => {
    it('a DM leaving announces a default reason before stopping the transport', async () => {
      const campaign = makeCampaign();
      useCampaignStore.setState({ campaigns: [campaign], activeCampaign: campaign, isDm: true });

      await useCampaignStore.getState().leaveCampaign();

      expect(announceClosingSpy).toHaveBeenCalledWith('The DM has stopped hosting this campaign.');
      // Must announce BEFORE stopping — a write after stop() would hit a
      // destroyed socket and never reach connected players.
      const announceOrder = announceClosingSpy.mock.invocationCallOrder[0];
      const stopOrder     = stopAllSpy.mock.invocationCallOrder[0];
      expect(announceOrder).toBeLessThan(stopOrder);
    });

    it('a custom reason overrides the default (used by deleteCampaignPermanently)', async () => {
      const campaign = makeCampaign();
      useCampaignStore.setState({ campaigns: [campaign], activeCampaign: campaign, isDm: true });

      await useCampaignStore.getState().leaveCampaign('The DM has deleted this campaign.');

      expect(announceClosingSpy).toHaveBeenCalledWith('The DM has deleted this campaign.');
    });

    it('a player leaving never announces — only the DM has clients to tell', async () => {
      const campaign = makeCampaign({ dmDeviceId: 'someone-else' });
      useSessionStore.setState({ session: { ...dmSession(), deviceId: 'player-device' } });
      useCampaignStore.setState({ campaigns: [campaign], activeCampaign: campaign, isDm: false });

      await useCampaignStore.getState().leaveCampaign();

      expect(announceClosingSpy).not.toHaveBeenCalled();
      expect(stopAllSpy).toHaveBeenCalled();
    });

    it('deleteCampaignPermanently on the active campaign announces the delete-specific reason', async () => {
      const campaign = makeCampaign();
      useCampaignStore.setState({ campaigns: [campaign], activeCampaign: campaign, isDm: true });

      await useCampaignStore.getState().deleteCampaignPermanently(campaign.id);

      expect(announceClosingSpy).toHaveBeenCalledWith('The DM has deleted this campaign.');
    });
  });

  describe('deleteCampaignPermanently — the new, explicit destructive action', () => {
    it('actually removes the campaign from SQLite and the local list', async () => {
      const campaign = makeCampaign();
      useCampaignStore.setState({ campaigns: [campaign], activeCampaign: null, isDm: false });

      await useCampaignStore.getState().deleteCampaignPermanently('camp1');

      expect(deleteCampaignSpy).toHaveBeenCalledWith('camp1');
      expect(useCampaignStore.getState().campaigns).toEqual([]);
    });

    it('leaves the campaign first if it is currently active, before deleting it', async () => {
      const campaign = makeCampaign();
      useCampaignStore.setState({ campaigns: [campaign], activeCampaign: campaign, isDm: true });

      await useCampaignStore.getState().deleteCampaignPermanently('camp1');

      expect(stopAllSpy).toHaveBeenCalled();
      expect(useCampaignStore.getState().activeCampaign).toBeNull();
      expect(useCampaignStore.getState().campaigns).toEqual([]);
    });
  });

  describe('switchToCampaign — a DM can own several campaigns, hosting one at a time', () => {
    it('stops the previously-active campaign\'s transport and opens the target one OFFLINE, without losing either', async () => {
      const campaignA = makeCampaign({ id: 'campA', name: 'Campaign A' });
      const campaignB = makeCampaign({ id: 'campB', name: 'Campaign B', joinCode: '' });
      useCampaignStore.setState({ campaigns: [campaignA, campaignB], activeCampaign: campaignA, isDm: true, liveSession: true });

      await useCampaignStore.getState().switchToCampaign('campB');

      expect(stopAllSpy).toHaveBeenCalled();                 // whatever was live stops
      expect(startAsServerSpy).not.toHaveBeenCalled();       // and the DM's target campaign opens no server
      expect(useCampaignStore.getState().activeCampaign?.id).toBe('campB');
      expect(useCampaignStore.getState().liveSession).toBe(false);
      expect(useCampaignStore.getState().campaigns.map(c => c.id).sort()).toEqual(['campA', 'campB']);
    });

    it('connects as a player (not host) when this device is not the campaign owner', async () => {
      const joined = makeCampaign({ id: 'joined1', dmDeviceId: 'the-real-dm', joinCode: 'ZZZ9999' });
      useCampaignStore.setState({ campaigns: [joined], activeCampaign: null, isDm: false });

      await useCampaignStore.getState().switchToCampaign('joined1');

      expect(startAsClientSpy).toHaveBeenCalledWith('ZZZ9999', 'dm-device', 'DM', null);
      expect(startAsServerSpy).not.toHaveBeenCalled();
      expect(useCampaignStore.getState().isDm).toBe(false);
    });

    it('throws for a campaign id this device has never seen locally', async () => {
      useCampaignStore.setState({ campaigns: [], activeCampaign: null, isDm: false });
      await expect(useCampaignStore.getState().switchToCampaign('nope')).rejects.toThrow();
    });

    it('is a no-op when the target is already the active campaign', async () => {
      const campaign = makeCampaign();
      useCampaignStore.setState({ campaigns: [campaign], activeCampaign: campaign, isDm: true });

      await useCampaignStore.getState().switchToCampaign('camp1');

      expect(stopAllSpy).not.toHaveBeenCalled();
      expect(startAsServerSpy).not.toHaveBeenCalled();
    });

    it('stays active locally even if the live transport attempt fails (graceful degradation, matches resumeSync)', async () => {
      startAsClientSpy.mockRejectedValueOnce(new Error('native module not linked'));
      const campaignB = makeCampaign({ id: 'campB', dmDeviceId: 'the-real-dm', joinCode: 'ZZZ9999' });
      useCampaignStore.setState({ campaigns: [campaignB], activeCampaign: null, isDm: false });

      await useCampaignStore.getState().switchToCampaign('campB');

      expect(useCampaignStore.getState().activeCampaign?.id).toBe('campB'); // switched locally regardless
    });
  });

  describe('SYNC-4 — a previously-claimed character survives reconnect instead of resetting to null', () => {
    it('assignCharacterToCampaign persists the claimed character id', async () => {
      jest.spyOn(campaignRepo, 'loadCampaign').mockResolvedValue(makeCampaign());
      const claimSpy = jest.spyOn(syncManager, 'claimCharacter').mockImplementation(() => {});
      jest.spyOn(syncManager, 'pushEntity').mockImplementation(() => {});
      useCampaignStore.setState({ isDm: false });

      await useCampaignStore.getState().assignCharacterToCampaign('char1', 'camp1');

      expect(claimSpy).toHaveBeenCalledWith('char1');
      expect(appMetaRepo.setMeta).toHaveBeenCalledWith('claimed_character_id', 'char1');
    });

    it('switchToCampaign (player path) re-announces a previously-claimed character instead of null', async () => {
      jest.spyOn(appMetaRepo, 'getMeta').mockResolvedValue('char1');
      const joined = makeCampaign({ id: 'joined1', dmDeviceId: 'the-real-dm', joinCode: 'ZZZ9999' });
      useCampaignStore.setState({ campaigns: [joined], activeCampaign: null, isDm: false });

      await useCampaignStore.getState().switchToCampaign('joined1');

      expect(startAsClientSpy).toHaveBeenCalledWith('ZZZ9999', 'dm-device', 'DM', 'char1');
    });

    it('reconnectWithCode re-announces a previously-claimed character instead of null', async () => {
      jest.spyOn(appMetaRepo, 'getMeta').mockResolvedValue('char1');
      useSessionStore.setState({ session: { deviceId: 'dm-device', nickname: 'DM', role: 'player', campaignId: 'camp1' } });
      const campaign = makeCampaign();
      useCampaignStore.setState({ campaigns: [campaign], activeCampaign: campaign, isDm: false });

      await useCampaignStore.getState().reconnectWithCode('NEW9999');

      expect(startAsClientSpy).toHaveBeenCalledWith('NEW9999', 'dm-device', 'DM', 'char1');
    });

    it('leaveCampaign clears the claimed character id so it does not leak into the next campaign', async () => {
      const campaign = makeCampaign();
      useCampaignStore.setState({ campaigns: [campaign], activeCampaign: campaign, isDm: false });

      await useCampaignStore.getState().leaveCampaign();

      expect(appMetaRepo.setMeta).toHaveBeenCalledWith('claimed_character_id', '');
    });
  });

  describe('createCampaign — Create Campaign wizard options (CREATE_CAMPAIGN_FLOW_SPEC.md)', () => {
    it('persists description, rulesetId and bannedPackIds when given, and omits them when not', async () => {
      const full = await useCampaignStore.getState().createCampaign({
        name: 'Full Campaign', description: 'A tale of woe', rulesetId: 'dnd5e-2024' as never, bannedPackIds: ['pack1'],
      });
      expect(full.description).toBe('A tale of woe');
      expect(full.rulesetId).toBe('dnd5e-2024');
      expect(full.bannedPackIds).toEqual(['pack1']);

      const bare = await useCampaignStore.getState().createCampaign({ name: 'Bare Campaign' });
      expect(bare.description).toBeUndefined();
      expect(bare.rulesetId).toBeUndefined();
      expect(bare.bannedPackIds).toBeUndefined();
    });

    it('uses a given `rules` object verbatim instead of DEFAULT_RULES — the wizard\'s chosen profile is copied in, not referenced', async () => {
      const customRules = { ...DEFAULT_RULES, maxLevel: 10, allowMulticlass: true, customRules: { lockPlayerFreeEdit: true } };
      const campaign = await useCampaignStore.getState().createCampaign({ name: 'Low Level', rules: customRules });
      expect(campaign.rules).toEqual(customRules);
      expect(campaign.rules).not.toBe(customRules);   // saved via the normal campaign object, not aliased
    });

    it('with no `rules` given, falls back to DEFAULT_RULES exactly as before', async () => {
      const campaign = await useCampaignStore.getState().createCampaign({ name: 'Defaults Only' });
      expect(campaign.rules).toEqual(DEFAULT_RULES);
    });

    it('trims a blank description down to omitted rather than storing whitespace', async () => {
      const campaign = await useCampaignStore.getState().createCampaign({ name: 'Blank Desc', description: '   ' });
      expect(campaign.description).toBeUndefined();
    });
  });

  describe('offline campaign, explicit live session (release blocker: createCampaign must not start LAN)', () => {
    it('1-4. createCampaign works with no network: no server, no room code, persisted, active, DM context set', async () => {
      const c = await useCampaignStore.getState().createCampaign({ name: 'Offline Campaign' });
      expect(startAsServerSpy).not.toHaveBeenCalled();
      expect(startAsClientSpy).not.toHaveBeenCalled();
      expect(c.joinCode).toBe('');
      expect(saveCampaignSpy).toHaveBeenCalledWith(expect.objectContaining({ id: c.id, joinCode: '' }));
      const state = useCampaignStore.getState();
      expect(state.activeCampaign?.id).toBe(c.id);
      expect(state.isDm).toBe(true);
      expect(state.liveSession).toBe(false);
      expect(setCampaignIdSpy).toHaveBeenCalledWith(c.id);
    });

    it('5-6. an offline campaign is restored after a restart with no live session, and resumeSync opens no server', async () => {
      const created = makeCampaign({ id: 'camp1', joinCode: '' });
      jest.spyOn(campaignRepo, 'loadAllCampaigns').mockResolvedValue([created]);
      useSessionStore.setState({ session: dmSession() });
      useCampaignStore.setState({ campaigns: [], activeCampaign: null, isDm: false, liveSession: true });

      await useCampaignStore.getState().loadCampaigns();
      await useCampaignStore.getState().resumeSync();

      const state = useCampaignStore.getState();
      expect(state.activeCampaign?.id).toBe('camp1');
      expect(state.isDm).toBe(true);
      expect(state.liveSession).toBe(false);
      expect(startAsServerSpy).not.toHaveBeenCalled();
    });

    it('a stale room code left from before a restart is dropped when the DM campaign loads', async () => {
      jest.spyOn(campaignRepo, 'loadAllCampaigns').mockResolvedValue([makeCampaign({ joinCode: 'OLD1234' })]);
      await useCampaignStore.getState().loadCampaigns();
      expect(useCampaignStore.getState().activeCampaign?.joinCode).toBe('');
    });

    it('7. startLiveSession opens the server, allocates the room code and stores it on the campaign', async () => {
      const campaign = makeCampaign({ joinCode: '' });
      useCampaignStore.setState({ campaigns: [campaign], activeCampaign: campaign, isDm: true, liveSession: false });

      const code = await useCampaignStore.getState().startLiveSession();

      expect(code).toBe('DEF5678');
      expect(startAsServerSpy).toHaveBeenCalledWith('camp1', expect.any(String), 'dm-device', 'DM');
      expect(startAsServerSpy.mock.calls[0][1]).not.toBe('dm-device');   // a fresh hosting-run id (audit finding ARCH-4)
      expect(useCampaignStore.getState().liveSession).toBe(true);
      expect(useCampaignStore.getState().activeCampaign?.joinCode).toBe('DEF5678');
    });

    it('starting twice does not open a second server', async () => {
      const campaign = makeCampaign({ joinCode: '' });
      useCampaignStore.setState({ campaigns: [campaign], activeCampaign: campaign, isDm: true, liveSession: false });
      await useCampaignStore.getState().startLiveSession();
      await useCampaignStore.getState().startLiveSession();
      expect(startAsServerSpy).toHaveBeenCalledTimes(1);
    });

    it('two live sessions of the same campaign get different hosting-run ids', async () => {
      const campaign = makeCampaign({ joinCode: '' });
      useCampaignStore.setState({ campaigns: [campaign], activeCampaign: campaign, isDm: true, liveSession: false });
      await useCampaignStore.getState().startLiveSession();
      await useCampaignStore.getState().endLiveSession();
      await useCampaignStore.getState().startLiveSession();
      expect(startAsServerSpy.mock.calls[0][1]).not.toBe(startAsServerSpy.mock.calls[1][1]);
    });

    it('8. endLiveSession tells players, stops the server, clears the code and leaves the campaign intact and active', async () => {
      const campaign = makeCampaign({ joinCode: '' });
      useCampaignStore.setState({ campaigns: [campaign], activeCampaign: campaign, isDm: true, liveSession: false });
      await useCampaignStore.getState().startLiveSession();

      await useCampaignStore.getState().endLiveSession();

      expect(announceClosingSpy).toHaveBeenCalled();
      expect(stopAllSpy).toHaveBeenCalled();
      const state = useCampaignStore.getState();
      expect(state.liveSession).toBe(false);
      expect(state.activeCampaign?.id).toBe('camp1');           // still active
      expect(state.activeCampaign?.joinCode).toBe('');
      expect(state.isDm).toBe(true);                             // DM screens stay reachable
      expect(state.campaigns).toHaveLength(1);
      expect(deleteCampaignSpy).not.toHaveBeenCalled();
    });

    it('only the campaign\'s DM can start a live session, and only with a campaign open', async () => {
      useCampaignStore.setState({ campaigns: [], activeCampaign: null, isDm: false });
      await expect(useCampaignStore.getState().startLiveSession()).rejects.toThrow(/Open one of your campaigns/);
      const theirs = makeCampaign({ dmDeviceId: 'someone-else' });
      useCampaignStore.setState({ campaigns: [theirs], activeCampaign: theirs, isDm: false });
      await expect(useCampaignStore.getState().startLiveSession()).rejects.toThrow();
      expect(startAsServerSpy).not.toHaveBeenCalled();
    });

    it('a failed server start leaves the campaign offline and active', async () => {
      startAsServerSpy.mockRejectedValueOnce(new Error('native module not linked'));
      const campaign = makeCampaign({ joinCode: '' });
      useCampaignStore.setState({ campaigns: [campaign], activeCampaign: campaign, isDm: true, liveSession: false });
      await expect(useCampaignStore.getState().startLiveSession()).rejects.toThrow('native module not linked');
      expect(useCampaignStore.getState().liveSession).toBe(false);
      expect(useCampaignStore.getState().activeCampaign?.id).toBe('camp1');
    });

    it('ending a live session that was never started is harmless', async () => {
      const campaign = makeCampaign({ joinCode: '' });
      useCampaignStore.setState({ campaigns: [campaign], activeCampaign: campaign, isDm: true, liveSession: false });
      await useCampaignStore.getState().endLiveSession();
      expect(useCampaignStore.getState().activeCampaign?.id).toBe('camp1');
    });
  });

  describe('CAMPAIGN-SYNC-1 — campaign metadata sync', () => {
    it('updateCampaign broadcasts the before/after diff via syncManager', async () => {
      const syncSpy = jest.spyOn(syncManager, 'syncCampaignPatch').mockImplementation(() => {});
      const campaign = makeCampaign({ notes: 'old notes' });
      useCampaignStore.setState({ campaigns: [campaign], activeCampaign: campaign, isDm: true });

      await useCampaignStore.getState().updateCampaign('camp1', c => ({ ...c, notes: 'new notes' }));

      expect(syncSpy).toHaveBeenCalledWith(
        'camp1',
        expect.objectContaining({ notes: 'old notes' }),
        expect.objectContaining({ notes: 'new notes' }),
      );
      syncSpy.mockRestore();
    });

    it('applyIncomingCampaign reconciles a join-time placeholder into the DM\'s real campaign record', async () => {
      const placeholder = makeCampaign({
        id: 'joined_ABC1234', name: 'Joined campaign (ABC1234)', dmDeviceId: 'remote', joinCode: 'ABC1234',
      });
      useSessionStore.setState({ session: { deviceId: 'player-device', nickname: 'P', role: 'player', campaignId: 'joined_ABC1234' } });
      useCampaignStore.setState({ campaigns: [placeholder], activeCampaign: placeholder, isDm: false });

      const real = makeCampaign({ id: 'real_camp_id', name: 'The Real Campaign', dmDeviceId: 'dm-device', joinCode: 'ABC1234' });
      await useCampaignStore.getState().applyIncomingCampaign(real);

      const state = useCampaignStore.getState();
      expect(state.campaigns.map(c => c.id)).toEqual(['real_camp_id']); // placeholder gone, replaced not appended
      expect(state.campaigns[0].name).toBe('The Real Campaign');
      expect(state.activeCampaign?.id).toBe('real_camp_id');
      expect(deleteCampaignSpy).toHaveBeenCalledWith('joined_ABC1234');
      expect(setCampaignIdSpy).toHaveBeenCalledWith('real_camp_id');
    });

    it('applyIncomingCampaign upserts normally once already reconciled (no placeholder left to match)', async () => {
      const real = makeCampaign({ id: 'real_camp_id', name: 'Old Name', dmDeviceId: 'dm-device', joinCode: 'ABC1234' });
      useCampaignStore.setState({ campaigns: [real], activeCampaign: real, isDm: false });

      const updated = makeCampaign({ id: 'real_camp_id', name: 'New Name', dmDeviceId: 'dm-device', joinCode: 'ABC1234' });
      await useCampaignStore.getState().applyIncomingCampaign(updated);

      expect(useCampaignStore.getState().campaigns).toHaveLength(1);
      expect(useCampaignStore.getState().campaigns[0].name).toBe('New Name');
    });

    it('applyIncomingCampaignPatch deep-merges onto the local copy', async () => {
      const campaign = makeCampaign({ notes: 'old' });
      useCampaignStore.setState({ campaigns: [campaign], activeCampaign: campaign, isDm: false });

      await useCampaignStore.getState().applyIncomingCampaignPatch('camp1', { notes: 'new from DM' });

      expect(useCampaignStore.getState().campaigns[0].notes).toBe('new from DM');
      expect(useCampaignStore.getState().activeCampaign?.notes).toBe('new from DM');
    });

    it('applyIncomingCampaignPatch is a no-op when the campaign is not known locally yet', async () => {
      useCampaignStore.setState({ campaigns: [], activeCampaign: null, isDm: false });
      await expect(useCampaignStore.getState().applyIncomingCampaignPatch('unknown', { notes: 'x' })).resolves.not.toThrow();
      expect(useCampaignStore.getState().campaigns).toEqual([]);
    });
  });
});
