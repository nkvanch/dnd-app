import { generateSigningKey, signPack, verifyPackSignature, signingPayload, publicKeyOf } from '../packSigning';
import { TRUSTED_PACK_KEYS } from '../trustedKeys';
import { buildSrd51Pack, serializePack } from '../packs/srdPacks';
import { BUNDLED_PACKS, installBundledPacks } from '../bundledPacks';
import { PackStore, installOfficialPack, previewOfficialPack, resetOfficialPackService, installedOfficialPacks } from '../officialPackService';
import { clearOfficialPacks } from '../officialPacks';

const store: PackStore = { save: async () => {}, load: async () => [], remove: async () => {} };
const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x)) as T;
beforeEach(() => { resetOfficialPackService(); clearOfficialPacks(); });
afterAll(() => { resetOfficialPackService(); clearOfficialPacks(); });

const key = generateSigningKey();
const trusted = [{ keyId: 'test-key', publicKey: key.publicKey, note: 'test' }];
const base = buildSrd51Pack();
const signed = signPack(base, 'test-key', key.privateKey);

describe('pack signing', () => {
  it('a signed pack verifies against its key, deterministically, and the key can be derived from the private one', () => {
    expect(verifyPackSignature(signed, trusted)).toEqual({ status: 'valid', keyId: 'test-key' });
    expect(signPack(base, 'test-key', key.privateKey).manifest.signature).toEqual(signed.manifest.signature);
    expect(publicKeyOf(key.privateKey)).toBe(key.publicKey);
    expect(signed.manifest.signature!.value).toMatch(/^[0-9a-f]{128}$/);
    expect(signingPayload(signed.manifest)).toBe(signingPayload(base.manifest));   // the signature is not part of what is signed
  });

  it('unsigned, unknown key and tampered packs are told apart', () => {
    expect(verifyPackSignature(base, trusted).status).toBe('unsigned');
    expect(verifyPackSignature(signed, []).status).toBe('unknown_key');
    expect(verifyPackSignature(signed, [{ ...trusted[0], publicKey: generateSigningKey().publicKey }]).status).toBe('invalid');
    for (const edit of [(m: any) => { m.version = '9.9.9'; }, (m: any) => { m.contentHash = '0'.repeat(64); }, (m: any) => { m.license = 'Proprietary'; }, (m: any) => { m.counts.items += 1; }]) {
      const t = clone(signed); edit(t.manifest);
      expect(verifyPackSignature(t, trusted).status).toBe('invalid');
    }
    const garbled = clone(signed); (garbled.manifest.signature as { value: string }).value = 'zz';
    expect(verifyPackSignature(garbled, trusted).status).toBe('invalid');
    expect(verifyPackSignature({ manifest: { ...signed.manifest, signature: { alg: 'rsa' as never, keyId: 'test-key', value: 'aa' } } }, trusted).status).toBe('invalid');
  });

  it('the app trusts the Grimoire key and the packs that ship with it are signed by it', () => {
    expect(TRUSTED_PACK_KEYS.map(k => k.keyId)).toContain('grimoire-2026-1');
    for (const b of BUNDLED_PACKS) expect(verifyPackSignature(b.load() as never).status).toBe('valid');
  });
});

describe('installing signed and unsigned packs', () => {
  it('the preview says how a pack is signed; a forged signature is refused; the bundled packs must be signed', async () => {
    const asFile = (p: unknown) => JSON.parse(serializePack(p as never));
    const unsigned = previewOfficialPack(asFile(base));
    expect(unsigned.ok && unsigned.signature.status).toBe('unsigned');
    expect(unsigned.ok && unsigned.notes.join(' ')).toMatch(/not signed/);
    const unknown = previewOfficialPack(asFile(signed));
    expect(unknown.ok && unknown.signature.status).toBe('unknown_key');
    const forged = clone(asFile(signed)); forged.manifest.signature = { alg: 'ed25519', keyId: 'grimoire-2026-1', value: '00'.repeat(64) };   // claims the app's own key
    const preview = previewOfficialPack(forged);
    expect(preview.ok).toBe(false);
    const bundled = previewOfficialPack(BUNDLED_PACKS[0].load());
    expect(bundled.ok && bundled.signature.status).toBe('valid');
    expect(bundled.ok && bundled.notes.join(' ')).not.toMatch(/signed/);
  });

  it('"require" refuses what a trusted key did not sign; the default leaves it to the caller', async () => {
    const asFile = (p: unknown) => JSON.parse(serializePack(p as never));
    const refused = await installOfficialPack(asFile(base), store, { signed: 'require' });
    expect(refused.ok).toBe(false);
    expect(refused.ok ? '' : refused.problems.join(' ')).toMatch(/not signed by a key this app trusts/);
    expect(installedOfficialPacks()).toHaveLength(0);
    expect(await installOfficialPack(asFile(base), store)).toEqual({ ok: true });
    expect(installedOfficialPacks()).toHaveLength(1);
    resetOfficialPackService(); clearOfficialPacks();
    expect(await installBundledPacks(['grimoire.srd.5.1'], store)).toEqual({ ok: true });
  });
});
