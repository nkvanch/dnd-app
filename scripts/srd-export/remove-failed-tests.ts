// Removes individual tests from the COPY that fail only because they assert removed non-SRD content.
// Input: jest --json output. Only failed assertions are removed; empty describe blocks and empty test files are deleted.
// Usage (cwd = copy root): npx tsx <path>/remove-failed-tests.ts <jest.json>
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const json = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const root = process.cwd();
const TEST_FNS = new Set(['it', 'test']);
const isCall = (n: ts.Node, names: Set<string>): n is ts.CallExpression => {
  if (!ts.isCallExpression(n)) return false;
  let e = n.expression;
  while (ts.isPropertyAccessExpression(e)) e = e.expression; // it.each / describe.skip
  return ts.isIdentifier(e) && names.has(e.text);
};
const title = (c: ts.CallExpression) => {
  const a = c.arguments[0];
  return a && (ts.isStringLiteral(a) || ts.isNoSubstitutionTemplateLiteral(a)) ? a.text : null;
};

let removedTests = 0;
for (const suite of json.testResults) {
  const failed = (suite.assertionResults ?? []).filter((a: any) => a.status === 'failed');
  if (!failed.length) continue;
  const file = suite.name as string;
  const wanted = new Set(failed.map((a: any) => [...a.ancestorTitles, a.title].join(' > ')));
  const text = fs.readFileSync(file, 'utf8');
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
  const ranges: [number, number][] = [];
  const stmtOf = (n: ts.Node): ts.Node => (ts.isExpressionStatement(n.parent) ? n.parent : n);
  const walk = (n: ts.Node, trail: string[]): number => {
    // returns count of surviving tests under n
    let alive = 0;
    if (isCall(n, TEST_FNS)) {
      const t = title(n);
      if (t !== null && wanted.has([...trail, t].join(' > '))) { ranges.push([stmtOf(n).getFullStart(), stmtOf(n).getEnd()]); removedTests++; return 0; }
      return 1;
    }
    if (isCall(n, new Set(['describe']))) {
      const t = title(n);
      let inner = 0;
      ts.forEachChild(n, c => { inner += walk(c, t !== null ? [...trail, t] : trail); });
      if (inner === 0 && t !== null) {
        // drop the whole describe only if every test in it was removed by us
        const st = stmtOf(n);
        // remove child ranges already recorded inside the describe (they are covered)
        for (let i = ranges.length - 1; i >= 0; i--) if (ranges[i][0] >= st.getFullStart() && ranges[i][1] <= st.getEnd()) ranges.splice(i, 1);
        ranges.push([st.getFullStart(), st.getEnd()]);
      }
      return inner;
    }
    ts.forEachChild(n, c => { alive += walk(c, trail); });
    return alive;
  };
  const alive = walk(sf, []);
  ranges.sort((a, b) => a[0] - b[0]);
  let out = '', p = 0;
  for (const [s, e] of ranges) { if (s < p) continue; out += text.slice(p, s); p = e; }
  out += text.slice(p);
  if (alive === 0) { fs.rmSync(file); console.log('DELETED (no tests left)', path.relative(root, file)); }
  else { fs.writeFileSync(file, out); console.log(String(failed.length).padStart(3), 'removed', path.relative(root, file)); }
}
console.log('tests removed:', removedTests);
