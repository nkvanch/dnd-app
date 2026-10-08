// ============================================================================
// FILE: src/content/trustedKeys.ts
// The public keys whose signatures on a content pack the app accepts. A pack signed by one of these is shown as signed and
// installs without a warning; a pack signed by no key the app knows, or not signed, installs only after the player confirms.
// The matching private key never leaves the author's machine (release/keys, git-ignored; scripts/make-pack-signing-key.ts).
// To rotate: add the new key here, keep the old one while packs signed with it are still in use, and re-sign the packs.
// ============================================================================
export type TrustedKey = { keyId: string; publicKey: string; note: string };

export const TRUSTED_PACK_KEYS: TrustedKey[] = [
  { keyId: 'grimoire-2026-1', publicKey: 'eae27109d5a18778437110f63044d9f0545d24062d042019657220a7aa2df429', note: 'Grimoire pack signing key' },
];
