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

  beforeEach(() => {
    saveCampaignSpy   = jest.spyOn(campaignRepo, 'saveCampaign').mockResolvedValue(undefined);
    deleteCampaignSpy = jest.spyOn(campaignRepo, 'deleteCampaign').mockResolvedValue(undefined);
    setCampaignIdSpy  = jest.spyOn(useSessionStore.getState(), 'setCampaignId').mockResolvedValue(undefined);
    startAsServerSpy  = jest.spyOn(syncManager, 'startAsServer').mockResolvedValue('DEF5678');
    startAsClientSpy  = jest.spyOn(syncManager, 'startAsClient').mockResolvedValue(undefined);
    stopAllSpy        = jest.spyOn(syncManager, 'stopAll').mockImplementation(() => {});
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
      expect(startAsServerSpy).toHaveBeenCalledWith('campB', 'dm-device', 'dm-device', 'DM');
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
});
