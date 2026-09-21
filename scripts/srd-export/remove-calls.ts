import fs from 'node:fs';
import ts from 'typescript';
const [file, fn] = process.argv.slice(2);
const text = fs.readFileSync(file, 'utf8');
const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
const ranges: [number, number][] = [];
const visit = (n: ts.Node) => {
  if (ts.isArrayLiteralExpression(n)) for (const el of n.elements) {
    if (ts.isCallExpression(el) && ts.isIdentifier(el.expression) && el.expression.text === fn) {
      let end = el.getEnd(); const m = /^\s*,/.exec(text.slice(end)); if (m) end += m[0].length;
      ranges.push([el.getFullStart(), end]);
    }
  }
  ts.forEachChild(n, visit);
};
visit(sf);
let out = '', p = 0;
for (const [s, e] of ranges) { out += text.slice(p, s); p = e; }
fs.writeFileSync(file, out + text.slice(p));
console.log('removed', ranges.length);
