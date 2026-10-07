// The app's own screens and engine must not carry descriptions of private (non-SRD) classes: such text would ship in the bundle even
// though the content packs are clean. The catalog modules that the packs are built from (and that Metro swaps for empty ones in the app
// build) and the tests are the only places allowed to name them.
import fs from 'fs';
import path from 'path';

const root = path.join(__dirname, '..', '..', '..', '..');
const SKIP_DIRS = [
  'src/content/classes/', 'src/content/classes2024/', 'src/content/subclasses/', 'src/content/races/', 'src/content/feats/', 'src/content/spells/',
  'src/content/items/', 'src/content/backgrounds/', 'src/content/monsters/', 'src/content/infusions/', 'src/content/companions/', 'src/content/homebrewPack/',
  'src/content/beastforms/', 'src/content/conditions/', 'src/content/rules/', 'src/content/public/', 'src/content/empty/', 'src/content/packs/', 'src/mocks/', 'src/demo/',
];
const SKIP_FILES = ['src/content/builtinHomebrew.ts'];
const FORBIDDEN = ['Artificer Specialist', 'Magical Tinkering', 'Blood Maledict', 'Crimson Rite', 'Abyssal Energy', 'Oozing Knight', 'Armorer, Alchemist'];

function walk(dir: string, out: string[]): void {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) { if (e.name === '__tests__' || e.name === 'node_modules') continue; walk(full, out); }
    else if (/\.(ts|tsx)$/.test(e.name) && !/\.test\./.test(e.name)) out.push(full);
  }
}

describe('app source outside the catalog', () => {
  it('has no text that describes a private class', () => {
    const files: string[] = [];
    walk(path.join(root, 'app'), files); walk(path.join(root, 'src'), files);
    const hits: string[] = [];
    for (const f of files) {
      const rel = path.relative(root, f).replace(/\\/g, '/');
      if (SKIP_DIRS.some(d => rel.startsWith(d)) || SKIP_FILES.includes(rel)) continue;
      // comments are not in the bundle; only strings and code are checked
      const text = fs.readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
      for (const w of FORBIDDEN) if (text.includes(w)) hits.push(`${rel}: ${w}`);
    }
    expect(hits).toEqual([]);
  });
});
