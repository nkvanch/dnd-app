// Removes comments in the COPY that name non-SRD content (sourcebooks, removed entries, third-party classes).
// Comments only; code is never touched. Usage (cwd = copy root): npx tsx <path>/scrub-comments.ts <sets.json> [--dry]
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const setsPath = process.argv[2];
const dry = process.argv.includes('--dry');
const sets = JSON.parse(fs.readFileSync(setsPath, 'utf8'));
const root = process.cwd();

const keep = new Set<string>();
for (const t of Object.keys(sets)) for (const n of sets[t].keepNames ?? []) keep.add(n.toLowerCase());
// Names that are also ordinary English words, so a hit does not mean the comment is about that entry.
const COMMON = new Set(['resilient', 'telepathic', 'invulnerability', 'scatter', 'mobile', 'durable', 'skilled', 'healer', 'sentinel', 'athlete', 'observant', 'lucky', 'tough', 'alert', 'actor', 'linguist', 'inspiring leader', 'skulker', 'crusher', 'piercer', 'slasher', 'poisoner', 'gunner', 'prodigy', 'staff', 'whirlwind', 'phantom', 'mastermind', 'inquisitive', 'swashbuckler', 'gambler', 'entertainer', 'charlatan', 'criminal', 'hermit', 'outlander', 'sailor', 'soldier', 'urchin', 'noble', 'sage', 'folk hero', 'guild artisan']);
const terms = new Set<string>();
for (const t of ['spells', 'items', 'races', 'feats', 'backgrounds', 'subclasses', 'classes', 'infusions']) {
  for (const n of sets[t].removeNames ?? []) {
    const l = n.toLowerCase();
    if (l.length >= 8 && !keep.has(l) && !COMMON.has(l)) terms.add(l);
  }
}
for (const x of ['xanathar', 'tasha', 'fizban', "volo's", 'mordenkainen', 'eberron', 'strixhaven', 'spelljammer', 'planescape', 'dragonlance', 'critical role', 'kobold press', 'blood hunter', 'abyss knight', 'artificer', 'hexblade', 'eladrin', 'aasimar', 'genasi', 'warforged', 'changeling', 'kalashtar', 'dragonmark', 'unearthed arcana', 'forgotten realms', 'sword coast', "explorer's guide", 'wildemount', 'theros', 'ravnica', 'acquisitions inc', 'bigby', "tasha's", 'homebrew item', 'nick\'s own', 'nick’s own', 'personal-use', 'personal use', 'play store']) terms.add(x);
const termList = [...terms];

function walk(d: string, out: string[] = []): string[] {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    if (['node_modules', '.git', 'assets'].includes(e.name)) continue;
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(ts|tsx|js|mjs)$/.test(e.name) && !/(__tests__|\.test\.)/.test(p)) out.push(p);
  }
  return out;
}

let removedTotal = 0, filesTouched = 0;
for (const file of ['src', 'app', 'scripts', 'App.tsx', 'index.ts'].flatMap(p => {
  const full = path.join(root, p);
  if (!fs.existsSync(full)) return [];
  return fs.statSync(full).isDirectory() ? walk(full) : [full];
})) {
  const text = fs.readFileSync(file, 'utf8');
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, file.endsWith('x') ? ts.ScriptKind.TSX : undefined);
  const seen = new Set<number>();
  const kill: [number, number][] = [];
  const consider = (ranges: ts.CommentRange[] | undefined) => {
    for (const r of ranges ?? []) {
      if (seen.has(r.pos)) continue;
      seen.add(r.pos);
      const body = text.slice(r.pos, r.end).toLowerCase();
      if (termList.some(t => body.includes(t))) kill.push([r.pos, r.end]);
    }
  };
  const visit = (n: ts.Node) => {
    consider(ts.getLeadingCommentRanges(text, n.getFullStart()));
    consider(ts.getTrailingCommentRanges(text, n.getEnd()));
    ts.forEachChild(n, visit);
  };
  visit(sf);
  consider(ts.getTrailingCommentRanges(text, sf.getEnd()));
  if (!kill.length) continue;
  kill.sort((a, b) => a[0] - b[0]);
  // widen each range to the whole line(s) when the comment is alone on its line
  const widened: [number, number][] = kill.map(([s, e]) => {
    const ls = text.lastIndexOf('\n', s - 1) + 1;
    let le = text.indexOf('\n', e); if (le < 0) le = text.length;
    const before = text.slice(ls, s), after = text.slice(e, le);
    return !before.trim() && !after.trim() ? [ls, Math.min(le + 1, text.length)] : [s, e];
  });
  removedTotal += widened.length; filesTouched++;
  if (dry) { console.log(String(widened.length).padStart(4), path.relative(root, file)); continue; }
  let out = '', p = 0;
  for (const [s, e] of widened) { if (s < p) continue; out += text.slice(p, s); p = e; }
  fs.writeFileSync(file, out + text.slice(p));
}
console.log(dry ? 'DRY' : 'DONE', 'comments removed:', removedTotal, 'in', filesTouched, 'files');
