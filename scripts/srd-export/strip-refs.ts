// Removes references to removed non-SRD class ids in the COPY: object properties keyed by them and
// string-literal array members equal to them (e.g. spell `classes: ['artificer', 'wizard']`).
// Usage (cwd = copy root): npx tsx <path>/strip-refs.ts id1,id2,...
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const ids = new Set(process.argv[2].split(','));
const root = process.cwd();
function walk(d: string, out: string[] = []): string[] {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    if (['node_modules', '.git', 'assets', '__tests__'].includes(e.name)) continue;
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p, out); else if (/\.tsx?$/.test(e.name) && !/\.test\./.test(e.name)) out.push(p);
  }
  return out;
}
let total = 0;
for (const file of [...walk(path.join(root, 'src')), ...walk(path.join(root, 'app'))]) {
  const text = fs.readFileSync(file, 'utf8');
  if (![...ids].some(i => text.includes(i))) continue;
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, file.endsWith('x') ? ts.ScriptKind.TSX : undefined);
  const ranges: [number, number][] = [];
  const del = (n: ts.Node) => {
    let end = n.getEnd();
    const m = /^\s*,/.exec(text.slice(end)); if (m) end += m[0].length;
    ranges.push([n.getFullStart(), end]);
  };
  const visit = (n: ts.Node) => {
    if (ts.isPropertyAssignment(n) || ts.isShorthandPropertyAssignment(n)) {
      const k = n.name;
      const key = ts.isIdentifier(k) || ts.isStringLiteral(k) ? k.text : null;
      if (key && ids.has(key)) { del(n); return; }
    }
    if (ts.isArrayLiteralExpression(n)) {
      for (const el of n.elements) if (ts.isStringLiteral(el) && ids.has(el.text)) del(el);
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);
  if (!ranges.length) continue;
  ranges.sort((a, b) => a[0] - b[0] || b[1] - a[1]);
  const merged: [number, number][] = [];
  for (const r of ranges) { const last = merged[merged.length - 1]; if (last && r[0] < last[1]) last[1] = Math.max(last[1], r[1]); else merged.push([...r]); }
  let out = '', p = 0;
  for (const [s, e] of merged) { out += text.slice(p, s); p = e; }
  fs.writeFileSync(file, out + text.slice(p));
  total += merged.length;
  console.log(String(merged.length).padStart(4), path.relative(root, file));
}
console.log('total', total);
