// Compares each 2024 caster class's cantrip and prepared-spell counts (src/content/classes2024/<class>.ts) with the SRD 5.2.1 class feature tables:
// the model's 20-number array must appear as a row of the class's Features table in the PDF text.
import fs from 'fs';
import path from 'path';

const root = path.join(__dirname, '..');
const flat = fs.readFileSync(path.join(root, 'release', 'srd521.txt'), 'utf8').replace(/\f/g, '\n').replace(/\s+/g, ' ');
const out: string[] = [];
for (const c of ['bard', 'cleric', 'druid', 'paladin', 'ranger', 'sorcerer', 'warlock', 'wizard']) {
  const name = c[0].toUpperCase() + c.slice(1);
  const i = flat.indexOf(`${name} Features`);
  const seg = flat.slice(i, i + 6000);
  const src = fs.readFileSync(path.join(root, 'src', 'content', 'classes2024', `${c}.ts`), 'utf8');
  for (const key of ['cantrips', 'prepared']) {
    const m = new RegExp(String.raw`${key}: \[([\d, ]+)\]`).exec(src);
    if (!m) { out.push(`${c} ${key}: not a table in the model (${key === 'cantrips' ? 'no cantrips' : 'not prepared'})`); continue; }
    const arr = m[1].split(',').map(s => s.trim()).join(' ');
    out.push(`${c} ${key}: ${seg.includes(arr) ? 'matches an SRD table row' : `NOT FOUND in the SRD table: ${arr}`}`);
  }
}
console.log(out.join('\n'));
