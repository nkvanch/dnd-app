/** @jest-environment node */
// The app ships no built-in catalog: metro.config.js replaces the catalog modules with the empty ones in src/content/empty. This test walks
// the imports the app can reach (from app/** and index.ts, through the replacements) and fails if catalog data becomes reachable again, and
// checks that each empty module exports every name the app imports from the module it replaces.
import fs from 'fs';
import path from 'path';

const root = path.resolve(__dirname, '../../..');
const rel = (f: string) => path.relative(root, f).split(path.sep).join('/');
const metro = fs.readFileSync(path.join(root, 'metro.config.js'), 'utf8');

/** The replacements, read from metro.config.js so the two cannot drift apart. */
const replacements = new Map<string, string>();
for (const m of metro.matchAll(/\['([^']+\.ts)',\s*'([^']+\.ts)'\]/g)) replacements.set(path.join(root, 'src/content', m[1]), path.join(root, 'src/content/empty', m[2]));

const isTest = (f: string) => /__tests__|\.test\.|\/testing\//.test(f.split(path.sep).join('/'));
function walk(dir: string, out: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (!['node_modules', '__tests__'].includes(e.name)) walk(p, out); }
    else if (/\.(ts|tsx)$/.test(e.name) && !isTest(p)) out.push(p);
  }
  return out;
}
const exts = ['', '.ts', '.tsx', '/index.ts', '/index.tsx'];
function resolveImport(from: string, spec: string): string | null {
  if (!spec.startsWith('.')) return null;
  const base = path.resolve(path.dirname(from), spec);
  for (const x of exts) { const c = path.normalize(base + x); if (fs.existsSync(c) && fs.statSync(c).isFile()) return c; }
  return null;
}
const importRe = /(?:^|\n)\s*(import|export)\s+(type\s+)?(?:[^'";]*?\s+from\s+)?['"]([^'"]+)['"]|require\(\s*['"]([^'"]+)['"]\s*\)/g;
function runtimeImports(file: string): string[] {
  const src = fs.readFileSync(file, 'utf8');
  const out: string[] = [];
  for (const m of src.matchAll(importRe)) {
    if (m[2]) continue;   // `import type` / `export type` is erased
    const r = resolveImport(file, m[3] ?? m[4]);
    if (r) out.push(replacements.get(r) ?? r);
  }
  return out;
}

const entries = [...walk(path.join(root, 'app')), path.join(root, 'index.ts')].filter(f => fs.existsSync(f));
const reached = new Set<string>(entries);
const queue = [...entries];
while (queue.length) {
  const f = queue.shift()!;
  for (const i of runtimeImports(f)) if (!reached.has(i)) { reached.add(i); queue.push(i); }
}
const reachedRel = [...reached].map(rel);

describe('the app ships no built-in catalog', () => {
  it('Metro replaces every catalog module, and each replacement exists', () => {
    expect(replacements.size).toBeGreaterThanOrEqual(17);
    for (const [from, to] of replacements) { expect(fs.existsSync(from)).toBe(true); expect(fs.existsSync(to)).toBe(true); }
  });

  it('no catalog data is reachable from the app', () => {
    const forbidden = reachedRel.filter(f =>
      /^src\/content\/(classes2024|homebrewPack|classes\/emperorWarlock)\//.test(f)
      || /^src\/content\/classes\/(abyssKnight|bloodHunter|artificer|fighter|rogue|wizard|cleric|barbarian|ranger|paladin|druid|bard|monk|sorcerer|warlock)\.ts$/.test(f)
      || /^src\/content\/subclasses\/(?!subclassBrowse|index)[a-z]+\.ts$/.test(f)
      || /^src\/content\/(items\/(importedItems|generatedSrdItems|srdProvenance)|spells\/(generated|importedSpells|spellVersions2024)|monsters\/srd|races\/(races2024|index)|feats\/(feats2024|origin2024)|rules\/rulesReference2024Data|beastforms\/(index|beastforms2024Data)|infusions\/index|companions\/index|builtinHomebrew)\b/.test(f)
      || /^src\/content\/packs\//.test(f)
      || /^scripts\//.test(f));
    expect(forbidden).toEqual([]);
  });

  it('no content file of any real size is reachable (the empty modules are tiny)', () => {
    const big = [...reached].filter(f => rel(f).startsWith('src/content/') && fs.statSync(f).size > 60_000).map(rel);
    expect(big).toEqual([]);
  });

  it('every name the app imports from a replaced module is exported by its empty replacement', () => {
    const missing: string[] = [];
    for (const file of reached) {
      if (!/\.(ts|tsx)$/.test(file)) continue;
      const src = fs.readFileSync(file, 'utf8');
      for (const m of src.matchAll(/(?:^|\n)\s*import\s+(type\s+)?\{([^}]*)\}\s+from\s+['"]([^'"]+)['"]/g)) {
        if (m[1]) continue;
        const target = resolveImport(file, m[3]);
        const empty = target ? replacements.get(target) : undefined;
        if (!empty) continue;
        const emptySrc = fs.readFileSync(empty, 'utf8');
        for (const raw of m[2].split(',')) {
          const name = raw.trim().replace(/^type\s+/, '').split(/\s+as\s+/)[0];
          if (!name) continue;
          const word = new RegExp(`\\b${name}\\b`);
          const exported = emptySrc.split('\n').some(line => /^export /.test(line) && word.test(line));
          if (!exported) missing.push(`${rel(file)} imports ${name} from ${rel(target!)}`);
        }
      }
    }
    expect(missing).toEqual([]);
  });
});
