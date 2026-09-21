// Source-level stripper for the SRD-only copy. Operates on a COPY (never on the private repo).
// Removes from src/content/**:
//   * top-level `const X = { ..., srd: false }` declarations (and `id` in the remove set) and every reference to X
//   * array elements that are object literals with `srd: false`, or (top-level arrays only) an `id` in the remove set
//   * array elements that are `feat('id', ...)` calls with a removed id
// Usage: npx tsx scripts/srd-export/strip.ts <targetRoot> <sets.json>
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const [target, setsPath] = process.argv.slice(2);
const sets = JSON.parse(fs.readFileSync(setsPath, 'utf8')) as Record<string, { remove: string[] }>;
const removeIds: Record<string, Set<string>> = {};
for (const [k, v] of Object.entries(sets)) removeIds[k] = new Set(v.remove);

const contentDir = path.join(target, 'src', 'content');
const skip = (p: string) => p.includes('__tests__') || /\.(test|spec)\.tsx?$/.test(p);
function walk(d: string, out: string[] = []): string[] {
  for (const n of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, n.name);
    if (n.isDirectory()) walk(p, out); else if (/\.tsx?$/.test(n.name) && !skip(p)) out.push(p);
  }
  return out;
}
const dirType = (p: string): string | null => {
  const m = /content[\\/](spells|items|races|feats|backgrounds|subclasses|classes)[\\/]/.exec(p);
  return m ? m[1] : null;
};

const unwrap = (e: ts.Expression): ts.Expression => {
  while (ts.isAsExpression(e) || ts.isParenthesizedExpression(e) || ts.isSatisfiesExpression(e)) e = e.expression;
  return e;
};
const prop = (o: ts.ObjectLiteralExpression, name: string) =>
  o.properties.find((p): p is ts.PropertyAssignment => ts.isPropertyAssignment(p) && (ts.isIdentifier(p.name) || ts.isStringLiteral(p.name)) && p.name.text === name);
const strVal = (e?: ts.Expression) => (e && (ts.isStringLiteral(e) || ts.isNoSubstitutionTemplateLiteral(e)) ? e.text : null);
const srdFalse = (o: ts.ObjectLiteralExpression) => prop(o, 'srd')?.initializer.kind === ts.SyntaxKind.FalseKeyword;
const objId = (o: ts.ObjectLiteralExpression) => strVal(prop(o, 'id')?.initializer);

const files = walk(contentDir);
const parsed = new Map<string, { text: string; sf: ts.SourceFile }>();
for (const f of files) {
  const text = fs.readFileSync(f, 'utf8');
  parsed.set(f, { text, sf: ts.createSourceFile(f, text, ts.ScriptTarget.Latest, true) });
}

// Pass 1: names of top-level consts to remove.
const removedNames = new Set<string>();
for (const [f, { sf }] of parsed) {
  const dt = dirType(f);
  for (const st of sf.statements) {
    if (!ts.isVariableStatement(st)) continue;
    for (const d of st.declarationList.declarations) {
      if (!d.initializer || !ts.isIdentifier(d.name)) continue;
      const init = unwrap(d.initializer);
      if (!ts.isObjectLiteralExpression(init)) continue;
      const id = objId(init);
      if (srdFalse(init) || (dt && id && removeIds[dt]?.has(id) && dt !== 'items' && dt !== 'spells')) removedNames.add(d.name.text);
    }
  }
}
console.log('removed top-level consts:', removedNames.size);

let totalEdits = 0;
for (const [f, { text, sf }] of parsed) {
  const dt = dirType(f);
  const ranges: [number, number][] = [];
  const addRange = (node: ts.Node, extendComma: boolean) => {
    let end = node.getEnd();
    if (extendComma) {
      const m = /^\s*,/.exec(text.slice(end));
      if (m) end += m[0].length;
    }
    ranges.push([node.getFullStart(), end]);
  };
  const isTopArray = (arr: ts.ArrayLiteralExpression) => {
    let n: ts.Node = arr.parent;
    while (ts.isAsExpression(n) || ts.isParenthesizedExpression(n) || ts.isSatisfiesExpression(n)) n = n.parent;
    return ts.isVariableDeclaration(n) && ts.isVariableStatement(n.parent.parent) && n.parent.parent.parent === sf;
  };
  const visit = (node: ts.Node) => {
    if (ts.isVariableStatement(node) && node.parent === sf) {
      const ds = node.declarationList.declarations;
      if (ds.length === 1 && ts.isIdentifier(ds[0].name) && removedNames.has(ds[0].name.text)) { addRange(node, false); return; }
    }
    if (ts.isImportDeclaration(node) && node.importClause?.namedBindings && ts.isNamedImports(node.importClause.namedBindings)) {
      const els = node.importClause.namedBindings.elements;
      const dead = els.filter(e => removedNames.has(e.name.text));
      if (dead.length === els.length && !node.importClause.name) { addRange(node, false); return; }
      for (const e of dead) addRange(e, true);
    }
    if (ts.isArrayLiteralExpression(node)) {
      const top = isTopArray(node);
      for (const el of node.elements) {
        let kill = false;
        const e = unwrap(el);
        if (ts.isIdentifier(e) && removedNames.has(e.text)) kill = true;
        else if (ts.isSpreadElement(el) && ts.isIdentifier(el.expression) && removedNames.has(el.expression.text)) kill = true;
        else if (ts.isObjectLiteralExpression(e)) {
          const id = objId(e);
          if (srdFalse(e)) kill = true;
          else if (top && dt && id && removeIds[dt]?.has(id)) kill = true;
        } else if (top && dt === 'feats' && ts.isCallExpression(e) && ts.isIdentifier(e.expression) && e.expression.text === 'feat') {
          const id = strVal(e.arguments[0]);
          if (id && removeIds.feats.has(id)) kill = true;
        }
        if (kill) addRange(el, true);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  if (!ranges.length) continue;
  // merge/dedupe overlapping ranges (a removed element may sit inside a removed statement)
  ranges.sort((a, b) => a[0] - b[0] || b[1] - a[1]);
  const merged: [number, number][] = [];
  for (const r of ranges) {
    const last = merged[merged.length - 1];
    if (last && r[0] < last[1]) last[1] = Math.max(last[1], r[1]); else merged.push([...r]);
  }
  let out = '', pos = 0;
  for (const [s, e] of merged) { out += text.slice(pos, s); pos = e; }
  out += text.slice(pos);
  fs.writeFileSync(f, out);
  totalEdits += merged.length;
  console.log(String(merged.length).padStart(4), path.relative(target, f));
}
console.log('total edits', totalEdits);
