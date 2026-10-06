// The author's built-in homebrew (Abyss Knight, Blood Hunter, both Emperor Warlocks, Ballast, Glassback, the stress-test pack) is not part
// of the app any more. This writes it as an ordinary homebrew package file to import from Homebrew > Import.
//   npx tsx scripts/build-private-homebrew-pack.ts
// PRIVATE: never share it or put it in a public repository. Output: release/packs/grimoire-private-homebrew-1.0.0.grimoire-pack
import fs from 'fs';
import path from 'path';
import { BUILTIN_HOMEBREW } from '../src/content/builtinHomebrew';
import { createPackageContentPack, GrimoirePackHomebrew, PackageContentRef } from '../src/engine/backup';

const TYPES: Record<string, string> = { classes: 'class', races: 'race', subclasses: 'subclass', feats: 'feat', items: 'item', monsters: 'monster', conditions: 'condition', spells: 'spell', features: 'feature' };
const homebrew = BUILTIN_HOMEBREW as unknown as GrimoirePackHomebrew;
const contents: PackageContentRef[] = Object.entries(BUILTIN_HOMEBREW).flatMap(([key, list]) =>
  (list as { id: string; name?: string; rulesetId?: string }[]).map(x => ({ type: TYPES[key] as never, id: x.id, name: x.name ?? x.id, included: 'selected' as const, ...(x.rulesetId ? { rulesetId: x.rulesetId as never } : {}) })));
const pack = createPackageContentPack(homebrew, contents, { name: 'Grimoire private homebrew', author: 'nk', description: 'Abyss Knight, Blood Hunter, Emperor Warlock, Ballast, Glassback and the creator stress-test pack. Private.', packageVersion: '1.0.0' }, null, 'build');
const dir = path.join(__dirname, '..', 'release', 'packs');
fs.mkdirSync(dir, { recursive: true });
const file = path.join(dir, 'grimoire-private-homebrew-1.0.0.grimoire-pack');
fs.writeFileSync(file, JSON.stringify(pack));
console.log(`${file}: ${Math.round(fs.statSync(file).size / 1024)} KB, ${contents.length} entries`);
