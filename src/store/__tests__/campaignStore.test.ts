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
    useCampaignStore.setState({ campaigns: [], activeCampaign: null, isDm: false });
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
    it('stops the previously-active campaign and hosts the target one, without losing either', async () => {
      const campaignA = makeCampaign({ id: 'campA', name: 'Campaign A' });
      const campaignB = makeCampaign({ id: 'campB', name: 'Campaign B', joinCode: '' });
      useCampaignStore.setState({ campaigns: [campaignA, campaignB], activeCampaign: campaignA, isDm: true });

      await useCampaignStore.getState().switchToCampaign('campB');

      expect(stopAllSpy).toHaveBeenCalled(); // stopped hosting A before switching
      // sessionId (2nd arg) is now a freshly-generated id, distinct from the
      // DM's permanent deviceId — see ARCH-4's regression test below for the
      // dedicated proof; this call site only needs to confirm campaignId/
      // deviceId/nickname are still passed correctly.
      expect(startAsServerSpy).toHaveBeenCalledWith('campB', expect.any(String), 'dm-device', 'DM');
      expect(startAsServerSpy.mock.calls[0][1]).not.toBe('dm-device');
      expect(useCampaignStore.getState().activeCampaign?.id).toBe('campB');
      // Both campaigns still exist locally — switching never deletes.
      expect(useCampaignStore.getState().campaigns.map(c => c.id).sort()).toEqual(['campA', 'campB']);
    });

    it('persists the freshly-hosted room code onto the target campaign', async () => {
      const campaignB = makeCampaign({ id: 'campB', joinCode: '' });
      useCampaignStore.setState({ campaigns: [campaignB], activeCampaign: null, isDm: false });

      await useCampaignStore.getState().switchToCampaign('campB');

      expect(saveCampaignSpy).toHaveBeenCalledWith(expect.objectContaining({ id: 'campB', joinCode: 'DEF5678' }));
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
      startAsServerSpy.mockRejectedValueOnce(new Error('native module not linked'));
      const campaignB = makeCampaign({ id: 'campB' });
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

  describe('ARCH-4 — startAsServer gets a fresh sessionId, distinct from deviceId', () => {
    it('createCampaign passes a sessionId different from deviceId', async () => {
      await useCampaignStore.getState().createCampaign('New Campaign');
      const [, sessionId, deviceId] = startAsServerSpy.mock.calls[0];
      expect(sessionId).not.toBe(deviceId);
      expect(deviceId).toBe('dm-device');
    });

    it('two separate hosting runs (e.g. createCampaign then a re-host) get different sessionIds', async () => {
      await useCampaignStore.getState().createCampaign('Campaign A');
      const firstSessionId = startAsServerSpy.mock.calls[0][1];

      const campaignB = makeCampaign({ id: 'campB' });
      useCampaignStore.setState({ campaigns: [campaignB], activeCampaign: null, isDm: false });
      await useCampaignStore.getState().switchToCampaign('campB');
      const secondSessionId = startAsServerSpy.mock.calls[1][1];

      expect(firstSessionId).not.toBe(secondSessionId);
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
