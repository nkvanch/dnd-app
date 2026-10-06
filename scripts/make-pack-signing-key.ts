// Makes the Ed25519 key that signs content packs.
//   npx tsx scripts/make-pack-signing-key.ts [key-id]
// Writes the PRIVATE key to release/keys/pack-signing.key (release/ is git-ignored: back it up somewhere safe, and never commit or
// share it) and prints the PUBLIC key to put in src/content/trustedKeys.ts. Refuses to overwrite an existing key.
import fs from 'fs';
import path from 'path';
import { generateSigningKey } from '../src/content/packSigning';

const dir = path.join(__dirname, '..', 'release', 'keys');
const file = path.join(dir, 'pack-signing.key');
if (fs.existsSync(file)) { console.error(`${file} already exists; not overwriting it.`); process.exit(1); }
const keyId = process.argv[2] ?? `grimoire-${new Date().getFullYear()}-1`;
const { privateKey, publicKey } = generateSigningKey();
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(file, JSON.stringify({ keyId, privateKey }) + '\n', { mode: 0o600 });
console.log(`Private key written to ${file} (keep it secret and backed up).`);
console.log('Add this to TRUSTED_PACK_KEYS in src/content/trustedKeys.ts:');
console.log(`  { keyId: '${keyId}', publicKey: '${publicKey}', note: 'Grimoire pack signing key' },`);
