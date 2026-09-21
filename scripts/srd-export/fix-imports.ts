// Removes import specifiers that tsc reports as missing exports (TS2305) in the COPY. Usage (cwd = copy root).
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import ts from 'typescript';

let out = '';
try { execSync('npx tsc --noEmit', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 1 << 28 }); } catch (e: any) { out = String(e.stdout ?? ''); }
const bad = new Map<string, Set<string>>();
for (const l of out.split(/\r?\n/)) {
  const m = /^(.+?)\(\d+,\d+\): error TS2305: .*has no exported member '([^']+)'/.exec(l);
  if (m) { const f = path.resolve(m[1]); (bad.get(f) ?? bad.set(f, new Set()).get(f)!).add(m[2]); }
}
for (const [file, names] of bad) {
  const text = fs.readFileSync(file, 'utf8');
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
  const ranges: [number, number][] = [];
  for (const st of sf.statements) {
    if (!ts.isImportDeclaration(st) || !st.importClause?.namedBindings || !ts.isNamedImports(st.importClause.namedBindings)) continue;
    const els = st.importClause.namedBindings.elements;
    const dead = els.filter(e => names.has((e.propertyName ?? e.name).text));
    if (!dead.length) continue;
    if (dead.length === els.length && !st.importClause.name) ranges.push([st.getFullStart(), st.getEnd()]);
    else for (const e of dead) { let end = e.getEnd(); const m = /^\s*,/.exec(text.slice(end)); if (m) end += m[0].length; ranges.push([e.getFullStart(), end]); }
  }
  ranges.sort((a, b) => a[0] - b[0]);
  let o = '', p = 0; for (const [s, e] of ranges) { o += text.slice(p, s); p = e; }
  fs.writeFileSync(file, o + text.slice(p));
  console.log(String(ranges.length).padStart(3), path.relative(process.cwd(), file));
}
