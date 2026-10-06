import { buildSrd51Pack, buildSrd521Pack, canonicalJson, sha256, serializePack, SRD_5_1_PACK_ID, SRD_5_2_1_PACK_ID } from '../srdPacks';
import { validateManifest, compareVersions } from '../../../engine/contentPackManifest';
import { validateGrimoirePack, validatePackContents } from '../../../engine/backup';

const a = buildSrd51Pack();
const b = buildSrd521Pack();
const all = (p: typeof a) => Object.values(p.homebrew ?? {}).flat() as { id: string; name?: string; provenance?: { kind: string; family?: string } }[];

describe('first-party SRD packs', () => {
  it('have valid manifests with explicit licence, attribution and first-party flag', () => {
    expect(validateManifest(a.manifest)).toEqual([]);
    expect(validateManifest(b.manifest)).toEqual([]);
    expect(a.manifest).toMatchObject({ id: SRD_5_1_PACK_ID, ruleset: 'dnd5e-2014', sourceFamily: 'SRD_5_1', license: 'CC-BY-4.0', officialFirstPartyPack: true });
    expect(b.manifest).toMatchObject({ id: SRD_5_2_1_PACK_ID, ruleset: 'dnd5e-2024', sourceFamily: 'SRD_5_2_1', license: 'CC-BY-4.0', officialFirstPartyPack: true });
    expect(a.manifest.attribution).toMatch(/System Reference Document 5\.1/);
    expect(b.manifest.attribution).toMatch(/dndbeyond\.com\/srd/);
    expect(b.manifest.dependencies.map(d => d.id)).toEqual([SRD_5_1_PACK_ID]);
    expect(a.manifest.dependencies).toEqual([]);
  });

  it('every record carries provenance naming the SRD family of its pack', () => {
    for (const r of all(a)) expect(r.provenance).toMatchObject({ kind: 'srd', family: '5.1' });
    for (const r of all(b)) expect(r.provenance).toMatchObject({ kind: 'srd', family: '5.2.1' });
    expect(all(a).length).toBeGreaterThan(700);
  });

  it('hold the expected content', () => {
    expect(a.manifest.counts).toMatchObject({ spells: 319, monsters: 322 });
    expect(a.manifest.counts.classes).toBeGreaterThanOrEqual(12);
    expect(b.manifest.counts).toMatchObject({ classes: 12, subclasses: 12, spells: 339, feats: 6 });
    expect(b.manifest.counts.races).toBe(9);
    expect(b.manifest.counts.items).toBe(20);   // the gear its starting packages name and the mastery weapons the 5.1 pack lacks
    expect(b.manifest.counts.backgrounds).toBe(4);
  });

  it('keep the editions apart: the 5.1 pack has no 2024 content, the 5.2.1 pack has no 2014 records', () => {
    expect(all(a).some(r => r.id.endsWith('_2024'))).toBe(false);
    for (const s of (a.homebrew!.spells as { classes?: string[] }[])) expect((s.classes ?? []).some(c => c.endsWith('_2024'))).toBe(false);
    for (const c of b.homebrew!.classes as { id: string }[]) expect(c.id).toMatch(/_2024$/);
    const text = (b.homebrew!.spells as { id: string; school: string }[]).find(s => s.id === 'acid_splash')!;
    expect(text.school).toBe('Evocation');
    expect((a.homebrew!.spells as { id: string; school: string }[]).find(s => s.id === 'acid_splash')!.school).toBe('Conjuration');
  });

  it('can never carry private or non-SRD content', () => {
    const ids = new Set([...all(a), ...all(b)].map(r => r.id));
    for (const banned of ['emperor_warlock', 'abyss_knight', 'blood_hunter', 'artificer', 'glassback', 'emperor_warlock_demo']) expect(ids.has(banned)).toBe(false);
    const text = serializePack(a) + serializePack(b);
    expect(text).not.toMatch(/Emperor Warlock|Abyss Knight|Blood Hunter|Creator Stress/);
    for (const r of a.homebrew!.classes as { srd?: boolean }[]) expect(r.srd).toBe(true);
    for (const r of a.homebrew!.items as { srd?: boolean }[]) expect(r.srd).not.toBe(false);
  });

  it('are self-describing JSON: no functions, round-trip unchanged, and the hash is stable and verifies the content', () => {
    for (const p of [a, b]) {
      const round = JSON.parse(serializePack(p));
      expect(canonicalJson(round.homebrew)).toBe(canonicalJson(p.homebrew));
      expect(sha256(canonicalJson({ homebrew: round.homebrew, rules: round.rules ?? null }))).toBe(p.manifest.contentHash);
    }
    expect(buildSrd51Pack().manifest.contentHash).toBe(a.manifest.contentHash);
    expect(buildSrd521Pack().manifest.contentHash).toBe(b.manifest.contentHash);
    expect(a.manifest.contentHash).not.toBe(b.manifest.contentHash);
  });

  it('the 5.2.1 pack carries its rules tables with provenance (Weapon Mastery and the class spell lists)', () => {
    const rules = b.rules as { weaponMastery: { weapons: unknown[]; properties: object; provenance: { family: string } }; spellLists: { byClass: Record<string, unknown> } };
    expect(rules.weaponMastery.weapons).toHaveLength(38);
    expect(Object.keys(rules.weaponMastery.properties)).toHaveLength(8);
    expect(rules.weaponMastery.provenance.family).toBe('5.2.1');
    expect(Object.keys(rules.spellLists.byClass).sort()).toEqual(['bard', 'cleric', 'druid', 'paladin', 'ranger', 'sorcerer', 'warlock', 'wizard']);
  });

  it('record ids are unique within each pack per type, so installing never duplicates', () => {
    for (const p of [a, b]) {
      for (const [cat, records] of Object.entries(p.homebrew ?? {})) {
        const ids = (records as { id: string }[]).map(r => r.id);
        expect([cat, ids.length - new Set(ids).size]).toEqual([cat, 0]);
      }
    }
  });

  it('versions compare semantically', () => {
    expect(compareVersions('1.0.1', '1.0.0')).toBeGreaterThan(0);
    expect(compareVersions('1.2.0', '1.10.0')).toBeLessThan(0);
    expect(compareVersions('1.0.0', '1.0.0')).toBe(0);
  });

  it('pass the same envelope and content validation every imported pack goes through', () => {
    for (const p of [a, b]) {
      expect(validateGrimoirePack(JSON.parse(serializePack(p)))).toBeNull();
      const problems = validatePackContents(JSON.parse(serializePack(p)));
      expect(problems.slice(0, 8)).toEqual([]);
    }
  });
});
