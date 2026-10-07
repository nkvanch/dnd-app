import fs from 'fs';
import path from 'path';
import { buildSrd51Pack, buildSrd521Pack, serializePack, sha256, canonicalJson, SRD_5_1_PACK_ID } from '../srdPacks';
import { buildNonSrd51Pack, buildNonSrd521Pack, buildSrd51UnverifiedPack, NON_SRD_5_1_PACK_ID, SRD_5_1_UNVERIFIED_PACK_ID } from '../nonSrdPacks';
import { validateManifest } from '../../../engine/contentPackManifest';
import { validateGrimoirePack } from '../../../engine/backup';
import { BUNDLED_PACKS } from '../../bundledPacks';
import { PackStore, installOfficialPack, installedOfficialPacks, previewOfficialPack, resetOfficialPackService } from '../../officialPackService';
import { clearOfficialPacks } from '../../officialPacks';
import { getOfficialContentProvider } from '../../officialSource';

const nonSrd = buildNonSrd51Pack();
const s51 = buildSrd51Pack();
const s521 = buildSrd521Pack();
const recordsOf = (p: { homebrew?: unknown }) => (p.homebrew ?? {}) as Record<string, { id: string }[]>;

function memoryStore(): PackStore {
  return { save: async () => {}, load: async () => [], remove: async () => {} };
}
beforeEach(() => { resetOfficialPackService(); clearOfficialPacks(); });
afterAll(() => { resetOfficialPackService(); clearOfficialPacks(); });

describe('the private non-SRD 5e pack', () => {
  it('has a valid manifest, a private licence, a verified hash, and depends on the SRD 5.1 pack', () => {
    expect(validateManifest(nonSrd.manifest)).toEqual([]);
    expect(nonSrd.manifest).toMatchObject({ id: NON_SRD_5_1_PACK_ID, ruleset: 'dnd5e-2014', sourceFamily: 'NON_SRD_5E' });
    expect(nonSrd.manifest.license).toMatch(/not licensed for redistribution/);
    expect(nonSrd.manifest.attribution).toMatch(/not part of any System Reference Document/);
    expect(nonSrd.manifest.dependencies.map(d => d.id)).toEqual([SRD_5_1_PACK_ID]);
    expect(nonSrd.manifest.contentHash).toBe(sha256(canonicalJson({ homebrew: nonSrd.homebrew, rules: nonSrd.rules ?? null })));
    expect(validateGrimoirePack(JSON.parse(serializePack(nonSrd)))).toBeNull();
  });

  it('holds the official non-SRD 5e content: Artificer, its subclasses, and the other books\' options', () => {
    const r = recordsOf(nonSrd);
    expect(r.classes.map(c => c.id)).toEqual(['artificer']);
    expect(nonSrd.manifest.counts).toMatchObject({ classes: 1 });
    expect(nonSrd.manifest.counts.subclasses).toBeGreaterThan(100);
    expect(nonSrd.manifest.counts.races).toBeGreaterThanOrEqual(20);
    expect(nonSrd.manifest.counts.feats).toBeGreaterThan(100);
    expect(nonSrd.manifest.counts.spells).toBeGreaterThan(100);
    expect(r.subclasses.some(s => (s as { classId?: string }).classId === 'artificer')).toBe(true);
  });

  it('carries nothing the SRD packs already carry, and nothing from 2024', () => {
    const mine = recordsOf(nonSrd);
    for (const [category, records] of Object.entries(mine)) {
      const others = new Set([...(recordsOf(s51)[category] ?? []), ...(recordsOf(s521)[category] ?? [])].map(x => x.id));
      // The one deliberate overlap: an SRD race that gains non-SRD subraces appears here in full (every subrace), replacing the public SRD-only record.
      const overlap = records.filter(x => others.has(x.id)).filter(x => {
        if (category !== 'races') return true;
        const own = ((x as { subraces?: { id: string }[] }).subraces ?? []).length;
        const pub = ((recordsOf(s51).races ?? []).find(r => r.id === x.id) as { subraces?: unknown[] } | undefined)?.subraces?.length ?? 0;
        return own <= pub;
      });
      expect(overlap.map(x => `${category}:${x.id}`)).toEqual([]);
      expect(records.filter(x => (x as { rulesetId?: string }).rulesetId === 'dnd5e-2024').map(x => x.id)).toEqual([]);
      const ids = records.map(x => x.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it('names nothing private to the author, and no spell is tagged for a class outside the packs', () => {
    const text = serializePack(nonSrd);
    expect(text).not.toMatch(/emperor_warlock|abyss_knight|blood_hunter|Blood Hunter|Abyss Knight|Emperor Warlock|glassback|pressure.?vault|stress.?pack/i);
    const classIds = new Set([...(recordsOf(s51).classes ?? []), ...(recordsOf(nonSrd).classes ?? [])].map(c => c.id));
    for (const s of recordsOf(nonSrd).spells as { id: string; classes?: string[] }[]) for (const c of s.classes ?? []) expect(classIds.has(c)).toBe(true);
  });

  it('is private: not bundled with the app and not among the files assets/packs holds', () => {
    expect(BUNDLED_PACKS.map(p => p.id).filter(id => id.includes('nonsrd'))).toEqual([]);
    const files = fs.readdirSync(path.resolve(process.cwd(), 'assets', 'packs'));
    expect(files.filter(f => f.includes('nonsrd'))).toEqual([]);
  });

  it('installs on top of the SRD 5.1 pack (not alone), and then the app offers Artificer and the extra options', async () => {
    const store = memoryStore();
    const alone = previewOfficialPack(JSON.parse(serializePack(nonSrd)));
    expect(alone.ok).toBe(false);
    expect(await installOfficialPack(JSON.parse(serializePack(s51)), store)).toEqual({ ok: true });
    expect(await installOfficialPack(JSON.parse(serializePack(nonSrd)), store)).toEqual({ ok: true });
    expect(installedOfficialPacks().map(p => p.manifest.id)).toEqual([SRD_5_1_PACK_ID, NON_SRD_5_1_PACK_ID]);
    const provider = getOfficialContentProvider()!;
    expect(provider.classes().map(c => c.id)).toContain('artificer');
    expect(provider.classes().map(c => c.id)).toContain('wizard');
    expect(provider.races().map(r => r.id)).toEqual(expect.arrayContaining(['aasimar', 'tabaxi']));
    expect(provider.items().length).toBeGreaterThan(350);   // the 95 verified + the non-SRD items; the unverified SRD items are their own pack
  });
});

describe('the 5.5e non-SRD pack', () => {
  it('is not built: every 2024 record in the app is part of SRD 5.2.1', () => {
    expect(buildNonSrd521Pack()).toBeUndefined();
  });
});

describe('the private unverified-SRD 5e item pack', () => {
  const unv = buildSrd51UnverifiedPack();
  it('holds the items marked SRD that fail the strict audit, with no licence claim, and overlaps no other pack', () => {
    expect(validateManifest(unv.manifest)).toEqual([]);
    expect(unv.manifest).toMatchObject({ id: SRD_5_1_UNVERIFIED_PACK_ID, sourceFamily: 'SRD_5_1_UNVERIFIED' });
    expect(unv.manifest.license).toMatch(/Unverified/);
    expect(unv.manifest.attribution).toMatch(/not offered as the SRD text/);
    expect(unv.manifest.dependencies.map(d => d.id)).toEqual([SRD_5_1_PACK_ID]);
    expect(Object.keys(unv.manifest.counts)).toEqual(['items']);
    expect(unv.manifest.counts.items).toBeGreaterThan(200);
    const mine = new Set((recordsOf(unv).items ?? []).map(i => i.id));
    for (const other of [s51, s521, nonSrd]) for (const i of recordsOf(other).items ?? []) expect(mine.has(i.id)).toBe(false);
    for (const i of recordsOf(unv).items ?? []) expect((i as { srd?: boolean }).srd).toBe(true);
    expect(validateGrimoirePack(JSON.parse(serializePack(unv)))).toBeNull();
  });

  it('together with the SRD and non-SRD packs it covers the whole 5e item catalog', () => {
    const catalog = new Set<string>();
    for (const p of [s51, unv, nonSrd, s521]) for (const i of recordsOf(p).items ?? []) catalog.add(i.id);
    const { FULL_ITEM_LIBRARY } = require('../../items/index') as typeof import('../../items/index');
    expect(FULL_ITEM_LIBRARY.filter((i: { id: string }) => !catalog.has(i.id)).map((i: { id: string }) => i.id)).toEqual([]);
  });
});
