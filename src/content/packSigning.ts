// ============================================================================
// FILE: src/content/packSigning.ts
// Signs and verifies content packs with Ed25519 (pure JavaScript, @noble/curves, so it runs on the phone as it does in the build).
// What is signed is the manifest (id, version, ruleset, licence, attribution, dependencies, record counts, ...) including the
// content hash, and the content hash covers every record and rules table, so one signature covers the whole pack. A pack whose
// content, manifest or signature was changed no longer verifies. Keys are hex strings; the signature is hex.
// ============================================================================
import { ed25519 } from '@noble/curves/ed25519';
import { canonicalJson } from '../engine/contentPackManifest';
import type { ContentPackManifest, PackSignature } from '../engine/contentPackManifest';
import { TRUSTED_PACK_KEYS, TrustedKey } from './trustedKeys';

export type SignatureStatus = 'valid' | 'unsigned' | 'unknown_key' | 'invalid';

const hexToBytes = (hex: string): Uint8Array => {
  if (!/^([0-9a-f]{2})+$/i.test(hex)) throw new Error('not hex');
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
};
const bytesToHex = (b: Uint8Array): string => Array.from(b, x => x.toString(16).padStart(2, '0')).join('');
const utf8 = (s: string): Uint8Array => new TextEncoder().encode(s);

/** The text that is signed: the manifest without its signature. */
export function signingPayload(manifest: Omit<ContentPackManifest, 'signature'> & { signature?: unknown }): string {
  const { signature: _signature, ...rest } = manifest;
  void _signature;
  return `grimoire-pack-signature-v1\n${canonicalJson(rest)}`;
}

export function generateSigningKey(): { privateKey: string; publicKey: string } {
  const priv = ed25519.utils.randomPrivateKey();
  return { privateKey: bytesToHex(priv), publicKey: bytesToHex(ed25519.getPublicKey(priv)) };
}

export const publicKeyOf = (privateKeyHex: string): string => bytesToHex(ed25519.getPublicKey(hexToBytes(privateKeyHex)));

/** A copy of the pack with its manifest signed by the key (Ed25519 signatures are deterministic: the same pack always gets the same one). */
export function signPack<T extends { manifest: ContentPackManifest }>(pack: T, keyId: string, privateKeyHex: string): T {
  const unsigned = { ...pack.manifest } as ContentPackManifest;
  delete unsigned.signature;
  const value = bytesToHex(ed25519.sign(utf8(signingPayload(unsigned)), hexToBytes(privateKeyHex)));
  const signature: PackSignature = { alg: 'ed25519', keyId, value };
  return { ...pack, manifest: { ...unsigned, signature } };
}

/** Whether the pack carries a signature a trusted key made over its manifest. */
export function verifyPackSignature(pack: { manifest?: ContentPackManifest }, trusted: readonly TrustedKey[] = TRUSTED_PACK_KEYS): { status: SignatureStatus; keyId?: string } {
  const m = pack.manifest;
  const sig = m?.signature;
  if (!m || !sig) return { status: 'unsigned' };
  if (sig.alg !== 'ed25519' || typeof sig.keyId !== 'string' || typeof sig.value !== 'string') return { status: 'invalid', keyId: sig.keyId };
  const key = trusted.find(k => k.keyId === sig.keyId);
  if (!key) return { status: 'unknown_key', keyId: sig.keyId };
  try {
    const ok = ed25519.verify(hexToBytes(sig.value), utf8(signingPayload(m)), hexToBytes(key.publicKey));
    return ok ? { status: 'valid', keyId: sig.keyId } : { status: 'invalid', keyId: sig.keyId };
  } catch {
    return { status: 'invalid', keyId: sig.keyId };
  }
}
