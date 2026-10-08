import { checkPackUrl, downloadText, parseCatalog, catalogStatus, FetchLike, PackDownloadError } from '../packDownload';
import { sha256Hex } from '../../engine/sha256';
import { buildSrd51Pack, serializePack } from '../packs/srdPacks';
import { BUNDLED_PACKS } from '../bundledPacks';
import { PackStore, installOfficialPack, previewOfficialPack, resetOfficialPackService, installedOfficialPacks } from '../officialPackService';
import { clearOfficialPacks } from '../officialPacks';

const store: PackStore = { save: async () => {}, load: async () => [], remove: async () => {} };
beforeEach(() => { resetOfficialPackService(); clearOfficialPacks(); });
afterAll(() => { resetOfficialPackService(); clearOfficialPacks(); });

const reply = (body: string, init: { ok?: boolean; status?: number; length?: number } = {}): FetchLike => async () => ({
  ok: init.ok ?? true, status: init.status ?? 200,
  headers: { get: (n: string) => (n.toLowerCase() === 'content-length' && init.length !== undefined ? String(init.length) : null) },
  text: async () => body,
});

describe('pack download addresses', () => {
  it('accepts https and this device/emulator over http; refuses everything else with a reason', () => {
    expect(checkPackUrl('https://example.com/a.grimoire-pack')).toBeNull();
    expect(checkPackUrl('http://localhost:8080/a')).toBeNull();
    expect(checkPackUrl('http://10.0.2.2:8000/a')).toBeNull();
    expect(checkPackUrl('http://example.com/a')).toMatch(/only downloaded over https/);
    expect(checkPackUrl('ftp://example.com/a')).toMatch(/not a web address/);
    expect(checkPackUrl('file:///sdcard/a')).toMatch(/not a web address/);
    expect(checkPackUrl('   ')).toMatch(/Enter a link/);
  });
});

describe('downloadText', () => {
  it('returns the text; checks the checksum when one is given', async () => {
    const body = '{"a":"héllo"}';
    expect(await downloadText('https://x.test/a', { fetchImpl: reply(body) })).toBe(body);
    expect(await downloadText('https://x.test/a', { fetchImpl: reply(body), expectedSha256: sha256Hex(body).toUpperCase() })).toBe(body);
    await expect(downloadText('https://x.test/a', { fetchImpl: reply(body), expectedSha256: '0'.repeat(64) })).rejects.toThrow(/does not match the checksum/);
  });

  it('refuses a bad address before any request, a failed request, an error status and an oversized file', async () => {
    const never: FetchLike = async () => { throw new Error('should not be called'); };
    await expect(downloadText('http://x.test/a', { fetchImpl: never })).rejects.toThrow(/https/);
    await expect(downloadText('https://x.test/a', { fetchImpl: async () => { throw new Error('offline'); } })).rejects.toThrow(/Could not reach.*offline/);
    await expect(downloadText('https://x.test/a', { fetchImpl: reply('nope', { ok: false, status: 404 }) })).rejects.toThrow(/answered 404/);
    await expect(downloadText('https://x.test/a', { fetchImpl: reply('x', { length: 999_999_999 }) })).rejects.toThrow(/more than the/);
    await expect(downloadText('https://x.test/a', { fetchImpl: reply('x'.repeat(100)), maxBytes: 10 })).rejects.toBeInstanceOf(PackDownloadError);
  });
});

describe('catalogs', () => {
  const sha = 'a'.repeat(64);
  const catalog = JSON.stringify({ format: 'grimoire-pack-catalog', version: 1, packs: [
    { id: 'grimoire.srd.5.1', name: 'SRD 5.1', version: '1.1.0', ruleset: 'dnd5e-2014', url: 'a.grimoire-pack', sha256: sha, size: 1000 },
    { id: 'grimoire.srd.5.1', name: 'SRD 5.1', version: '1.0.0', ruleset: 'dnd5e-2014', url: 'old.grimoire-pack', sha256: sha, size: 900 },
    { id: 'grimoire.srd.5.2.1', name: 'SRD 5.2.1', version: '1.0.0', ruleset: 'dnd5e-2024', url: 'https://cdn.test/b.grimoire-pack', sha256: sha.toUpperCase(), size: 2000, description: 'x' },
    { id: 'bad.sha', version: '1.0.0', url: 'c', sha256: 'zz' },
    { id: 'bad.url', version: '1.0.0', url: 'http://evil.test/c', sha256: sha },
  ] });

  it('parses a catalog: relative links resolve against the catalog, bad entries are dropped, hashes are lowercase', () => {
    const c = parseCatalog(catalog, 'https://host.test/packs/grimoire-packs.json');
    expect(c.packs.map(p => p.id)).toEqual(['grimoire.srd.5.1', 'grimoire.srd.5.1', 'grimoire.srd.5.2.1']);
    expect(c.packs[0].url).toBe('https://host.test/packs/a.grimoire-pack');
    expect(c.packs[2].url).toBe('https://cdn.test/b.grimoire-pack');
    expect(c.packs[2].sha256).toBe(sha);
  });

  it('rejects text that is not a catalog', () => {
    expect(() => parseCatalog('nope', 'https://h.test/x')).toThrow(/not valid JSON/);
    expect(() => parseCatalog('{"format":"other"}', 'https://h.test/x')).toThrow(/not a Grimoire pack catalog/);
  });

  it('says what is new, what has an update and what is up to date, newest listed version only', () => {
    const c = parseCatalog(catalog, 'https://host.test/packs/c.json');
    const st = (installed: { id: string; version: string }[]) => Object.fromEntries(catalogStatus(c, installed).map(e => [e.id, `${e.status}:${e.version}`]));
    expect(st([])).toEqual({ 'grimoire.srd.5.1': 'new:1.1.0', 'grimoire.srd.5.2.1': 'new:1.0.0' });
    expect(st([{ id: 'grimoire.srd.5.1', version: '1.0.0' }, { id: 'grimoire.srd.5.2.1', version: '1.0.0' }])).toEqual({ 'grimoire.srd.5.1': 'update:1.1.0', 'grimoire.srd.5.2.1': 'installed:1.0.0' });
  });
});

describe('a downloaded pack goes through the same checks as one picked from the device', () => {
  it('a signed pack downloaded with its catalog checksum previews as signed and installs', async () => {
    const text = JSON.stringify(BUNDLED_PACKS[0].load());
    const downloaded = await downloadText('https://host.test/a.grimoire-pack', { fetchImpl: reply(text), expectedSha256: sha256Hex(text) });
    const preview = previewOfficialPack(JSON.parse(downloaded));
    expect(preview.ok && preview.signature.status).toBe('valid');
    expect(await installOfficialPack(JSON.parse(downloaded), store, { signed: 'require' })).toEqual({ ok: true });
    expect(installedOfficialPacks().map(p => p.manifest.id)).toEqual([BUNDLED_PACKS[0].id]);
  });

  it('a tampered download is refused whether or not a checksum was given', async () => {
    const pack = JSON.parse(serializePack(buildSrd51Pack()));
    pack.homebrew.spells[0].name = 'Tampered';
    const text = JSON.stringify(pack);
    const downloaded = await downloadText('https://host.test/a.grimoire-pack', { fetchImpl: reply(text) });
    const preview = previewOfficialPack(JSON.parse(downloaded));
    expect(preview.ok).toBe(false);
    expect(!preview.ok && preview.problems.join(' ')).toMatch(/content hash/);
  });
});
