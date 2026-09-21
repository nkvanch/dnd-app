// After stripping, removes top-level declarations/imports in src/content/** (non-test) that the strip left unused.
// Loops `tsc --noUnusedLocals` until nothing more can be removed. Operates on the COPY only.
// Usage (cwd = copy root): npx tsx <path>/prune-unused.ts
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import ts from 'typescript';

const root = process.cwd();
function unusedErrors() {
  let out = '';
  try { execSync('npx tsc --noEmit --noUnusedLocals', { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 1 << 28 }); }
  catch (e: any) { out = String(e.stdout ?? ''); }
  const rows: { file: string; line: number; col: number; name: string }[] = [];
  for (const l of out.split(/\r?\n/)) {
    const m = /^(.+?)\((\d+),(\d+)\): error TS(6133|6196|6192): '([^']+)'/.exec(l);
    if (!m) continue;
    const file = path.resolve(root, m[1]);
    if (!/[\\/]src[\\/]content[\\/]/.test(file) || /__tests__|\.test\./.test(file)) continue;
    rows.push({ file, line: +m[2], col: +m[3], name: m[5] });
  }
  return rows;
}

for (let pass = 1; pass <= 12; pass++) {
  const rows = unusedErrors();
  if (!rows.length) { console.log('pass', pass, 'nothing left'); break; }
  const byFile = new Map<string, typeof rows>();
  for (const r of rows) byFile.set(r.file, [...(byFile.get(r.file) ?? []), r]);
  let removed = 0;
  for (const [file, list] of byFile) {
    const text = fs.readFileSync(file, 'utf8');
    const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
    const ranges: [number, number][] = [];
    for (const r of list) {
      const pos = sf.getPositionOfLineAndCharacter(r.line - 1, r.col - 1);
      let node: ts.Node | undefined;
      const find = (n: ts.Node) => { if (n.getStart() <= pos && pos < n.getEnd()) { node = n; ts.forEachChild(n, find); } };
      find(sf);
      let n: ts.Node | undefined = node;
      while (n && n.parent && n.parent !== sf && !ts.isImportSpecifier(n)) n = n.parent;
      if (!n) continue;
      if (ts.isImportSpecifier(n)) {
        const named = n.parent; const decl = named.parent.parent;
        if (named.elements.length === 1 && !decl.importClause?.name) ranges.push([decl.getFullStart(), decl.getEnd()]);
        else { let end = n.getEnd(); const m = /^\s*,/.exec(text.slice(end)); if (m) end += m[0].length; ranges.push([n.getFullStart(), end]); }
        continue;
      }
      if (n.parent === sf && (ts.isFunctionDeclaration(n) || (ts.isVariableStatement(n) && n.declarationList.declarations.length === 1))) {
        ranges.push([n.getFullStart(), n.getEnd()]);
      }
    }
    if (!ranges.length) continue;
    ranges.sort((a, b) => a[0] - b[0] || b[1] - a[1]);
    const merged: [number, number][] = [];
    for (const r of ranges) { const last = merged[merged.length - 1]; if (last && r[0] < last[1]) last[1] = Math.max(last[1], r[1]); else merged.push([...r]); }
    let out = '', p = 0;
    for (const [s, e] of merged) { out += text.slice(p, s); p = e; }
    fs.writeFileSync(file, out + text.slice(p));
    removed += merged.length;
    console.log('  ', merged.length, path.relative(root, file));
  }
  console.log('pass', pass, 'removed', removed);
  if (!removed) break;
}
