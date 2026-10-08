import { createHash } from 'crypto';
import { sha256Hex } from '../../engine/sha256';
import { buildSrd51Pack, buildSrd521Pack, serializePack } from '../packs/srdPacks';
import {
  PackStore, previewOfficialPack, installOfficialPack, removeOfficialPack, bootOfficialPacks, installedOfficialPacks,
  isOfficialPackFile, onOfficialPacksChanged, resetOfficialPackService,
} from '../officialPackService';
import { clearOfficialPacks, officialPacksInstalled } from '../officialPacks';
import { globalContentDB } from '../classes/library';
import { spellRepo } from '../spellRepo';
import { RulesetId } from '../../engine/types';

const file = (p: unknown) => JSON.parse(serializePack(p as never));
const pack51 = file(buildSrd51Pack());
const pack521 = file(buildSrd521Pack());

function memoryStore(): PackStore & { rows: Map<string, { version: string; pack: unknown }> } {
  const rows = new Map<string, { version: string; pack: unknown }>();
  return {
    rows,
    save: async (id, version, pack) => { rows.set(id, { version, pack }); },
    load: async () => [...rows.entries()].map(([id, r]) => ({ id, version: r.version, pack: r.pack })),
    remove: async id => { rows.delete(id); },
  };
}

beforeEach(() => { resetOfficialPackService(); clearOfficialPacks(); });
afterAll(() => { resetOfficialPackService(); clearOfficialPacks(); });

describe('sha256Hex', () => {
  it('matches Node for ASCII, empty, block-boundary and non-ASCII text', () => {
    for (const text of ['', 'abc', 'a'.repeat(55), 'a'.repeat(56), 'a'.repeat(64), 'a'.repeat(1000), 'Artificer’s Lore — déjà vu 🐉 龍']) {
      expect(sha256Hex(text)).toBe(createHash('sha256').update(text, 'utf8').digest('hex'));
    }
  });
});

describe('previewing an official pack file', () => {
  it('accepts the real packs, saying what installing does', () => {
    const p = previewOfficialPack(pack51, []);
    expect(p.ok).toBe(true);
    if (p.ok) {
      expect(p.action).toBe('install');
      expect(p.notes.join(' ')).toMatch(/official content/);
      expect(p.manifest.id).toBe('grimoire.srd.5.1');
    }
  });

  it('refuses a pack whose content was changed (hash), one with a bad envelope, and a file that is not a first-party pack', () => {
    const tampered = file(pack51);
    tampered.homebrew.spells[0].name = 'Tampered';
    const t = previewOfficialPack(tampered, []);
    expect(t).toEqual({ ok: false, problems: [expect.stringMatching(/content hash/)] });
    expect(previewOfficialPack({ nope: true }, [])).toMatchObject({ ok: false });
    const homebrew = { ...pack51, manifest: { ...pack51.manifest, officialFirstPartyPack: false } };
    expect(isOfficialPackFile(homebrew)).toBe(false);
    expect(previewOfficialPack(homebrew, [])).toMatchObject({ ok: false, problems: [expect.stringMatching(/not a first-party/)] });
  });

  it('refuses the 5.2.1 pack until the 5.1 pack it depends on is installed', () => {
    const alone = previewOfficialPack(pack521, []);
    expect(alone).toMatchObject({ ok: false, problems: [expect.stringMatching(/grimoire\.srd\.5\.1.*not installed/)] });
    expect(previewOfficialPack(pack521, [pack51]).ok).toBe(true);
  });

  it('tells install, update and same-version apart', () => {
    const newer = file(pack51);
    newer.manifest.version = '1.0.1';
    // the hash covers the content, not the version, so a version bump alone still verifies
    const asUpdate = previewOfficialPack(newer, [pack51]);
    expect(asUpdate).toMatchObject({ ok: true, action: 'update', previousVersion: '1.0.0' });
    expect(previewOfficialPack(pack51, [pack51])).toMatchObject({ ok: true, action: 'same' });
  });
});

describe('installing and removing', () => {
  it('installs into the store and makes the packs the official catalog; removing restores the built-in one', async () => {
    const store = memoryStore();
    let notified = 0;
    const off = onOfficialPacksChanged(() => { notified++; });
    const builtIn = globalContentDB.classes.length;

    expect(await installOfficialPack(pack51, store)).toEqual({ ok: true });
    expect(await installOfficialPack(pack521, store)).toEqual({ ok: true });
    expect([...store.rows.keys()].sort()).toEqual(['grimoire.srd.5.1', 'grimoire.srd.5.2.1']);
    expect(installedOfficialPacks().map(p => p.manifest.id)).toEqual(['grimoire.srd.5.1', 'grimoire.srd.5.2.1']);
    expect(officialPacksInstalled()).toBe(true);
    expect(globalContentDB.classes.map(c => c.id)).toEqual(expect.arrayContaining(['wizard_2024', 'fighter']));
    expect(spellRepo.getSpellSync('acid_splash', 'dnd5e-2024' as RulesetId)?.school).toBe('Evocation');
    expect(notified).toBe(2);

    // 5.2.1 needs 5.1: removing 5.1 first is refused and changes nothing.
    const refused = await removeOfficialPack('grimoire.srd.5.1', store);
    expect(refused).toEqual({ ok: false, problems: [expect.stringMatching(/Grimoire SRD 5\.2\.1 needs Grimoire SRD 5\.1/)] });
    expect(store.rows.size).toBe(2);

    expect(await removeOfficialPack('grimoire.srd.5.2.1', store)).toEqual({ ok: true });
    expect(await removeOfficialPack('grimoire.srd.5.1', store)).toEqual({ ok: true });
    expect(store.rows.size).toBe(0);
    expect(officialPacksInstalled()).toBe(false);
    expect(globalContentDB.classes.length).toBe(builtIn);
    off();
  });

  it('a pack that cannot be installed changes nothing and stores nothing', async () => {
    const store = memoryStore();
    const before = globalContentDB.classes.length;
    const result = await installOfficialPack(pack521, store);          // its dependency is missing
    expect(result.ok).toBe(false);
    expect(store.rows.size).toBe(0);
    expect(officialPacksInstalled()).toBe(false);
    expect(globalContentDB.classes.length).toBe(before);
  });

  it('a failed save puts the catalog back as it was', async () => {
    const store = memoryStore();
    await installOfficialPack(pack51, store);
    const failing: PackStore = { ...store, save: async () => { throw new Error('disk full'); } };
    const result = await installOfficialPack(pack521, failing);
    expect(result).toEqual({ ok: false, problems: [expect.stringMatching(/could not be saved: disk full/)] });
    expect(installedOfficialPacks().map(p => p.manifest.id)).toEqual(['grimoire.srd.5.1']);
    expect(globalContentDB.classes.some(c => c.id === 'wizard_2024')).toBe(false);   // only the 5.1 pack is active
  });

  it('an update replaces the installed version in place', async () => {
    const store = memoryStore();
    await installOfficialPack(pack51, store);
    const newer = file(pack51); newer.manifest.version = '1.0.1';
    expect(await installOfficialPack(newer, store)).toEqual({ ok: true });
    expect(installedOfficialPacks().map(p => p.manifest.version)).toEqual(['1.0.1']);
    expect(store.rows.get('grimoire.srd.5.1')!.version).toBe('1.0.1');
  });
});

describe('restoring at app start', () => {
  it('stored packs become the official catalog again, and with none stored nothing changes', async () => {
    expect(await bootOfficialPacks(memoryStore())).toEqual({ ok: true });
    expect(officialPacksInstalled()).toBe(false);

    const store = memoryStore();
    store.rows.set('grimoire.srd.5.1', { version: '1.0.0', pack: pack51 });
    store.rows.set('grimoire.srd.5.2.1', { version: '1.0.0', pack: pack521 });
    expect(await bootOfficialPacks(store)).toEqual({ ok: true });
    expect(officialPacksInstalled()).toBe(true);
    expect(globalContentDB.classes.some(c => c.id === 'sorcerer_2024')).toBe(true);
  });

  it('stored packs that do not resolve leave the built-in catalog and report why, never throwing', async () => {
    const store = memoryStore();
    store.rows.set('grimoire.srd.5.2.1', { version: '1.0.0', pack: pack521 });   // its dependency is not stored
    const result = await bootOfficialPacks(store);
    expect(result.ok).toBe(false);
    expect(officialPacksInstalled()).toBe(false);
    const broken: PackStore = { ...store, load: async () => { throw new Error('db gone'); } };
    expect((await bootOfficialPacks(broken)).ok).toBe(false);
  });
});
