import { ensureBundledPacks, AUTO_INSTALL_KEY, MetaStore } from '../firstRunPacks';
import { BUNDLED_PACKS } from '../bundledPacks';
import { PackStore, installedOfficialPacks, resetOfficialPackService, removeOfficialPack } from '../officialPackService';
import { clearOfficialPacks } from '../officialPacks';

const store: PackStore = { save: async () => {}, load: async () => [], remove: async () => {} };
const memoryMeta = (): MetaStore & { data: Map<string, string> } => { const data = new Map<string, string>(); return { data, get: async k => data.get(k) ?? null, set: async (k, v) => { data.set(k, v); } }; };
beforeEach(() => { resetOfficialPackService(); clearOfficialPacks(); });
afterAll(() => { resetOfficialPackService(); clearOfficialPacks(); });

describe('first run packs', () => {
  it('installs the bundled signed packs once when none are installed', async () => {
    const meta = memoryMeta();
    expect(await ensureBundledPacks(store, meta)).toBe(true);
    expect(installedOfficialPacks().map(p => p.manifest.id).sort()).toEqual(BUNDLED_PACKS.map(p => p.id).sort());
    expect(meta.data.get(AUTO_INSTALL_KEY)).toBe('1');
  });

  it('does nothing when packs are installed, and does not reinstall after the player removed them', async () => {
    const meta = memoryMeta();
    await ensureBundledPacks(store, meta);
    expect(await ensureBundledPacks(store, meta)).toBe(false);
    await removeOfficialPack('grimoire.srd.5.2.1', store);
    await removeOfficialPack('grimoire.srd.5.1', store);
    expect(installedOfficialPacks()).toHaveLength(0);
    expect(await ensureBundledPacks(store, meta)).toBe(false);
    expect(installedOfficialPacks()).toHaveLength(0);
  });

  it('a failed install is reported, leaves nothing installed and is tried again next launch', async () => {
    const meta = memoryMeta();
    const failing: PackStore = { ...store, save: async () => { throw new Error('disk full'); } };
    expect(await ensureBundledPacks(failing, meta)).toBe(false);
    expect(meta.data.has(AUTO_INSTALL_KEY)).toBe(false);
    expect(installedOfficialPacks()).toHaveLength(0);
  });
});
