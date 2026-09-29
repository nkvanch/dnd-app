// Guards against the SCROLL-TOUCH-1 bug: a scrollable list inside a Modal whose
// sheet/backdrop is a touchable (Pressable with onPress). A touchable ancestor
// claims touches that begin on non-touchable children, so the list only
// scrolls when the drag starts on a button. The fix is a sibling backdrop
// (absoluteFill Pressable) with a plain-View sheet — see TabInventory's
// AddItemModal. This scans every app/src .tsx file so a new modal can't
// silently reintroduce it.
import * as fs from 'fs';
import * as path from 'path';
import * as ts from 'typescript';

const ROOT = path.resolve(__dirname, '..', '..');
const SCROLL = new Set(['ScrollView', 'FlatList', 'SectionList', 'VirtualizedList']);
const TOUCH = new Set(['Pressable', 'TouchableOpacity', 'TouchableWithoutFeedback', 'TouchableHighlight', 'TouchableNativeFeedback']);

function tsxFiles(dir: string, acc: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name.startsWith('.') || e.name === '__tests__') continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) tsxFiles(p, acc);
    else if (p.endsWith('.tsx')) acc.push(p);
  }
  return acc;
}

function offenders(file: string): string[] {
  const text = fs.readFileSync(file, 'utf8');
  if (!text.includes('<Modal')) return [];
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const found: string[] = [];
  const visit = (n: ts.Node): void => {
    if ((ts.isJsxOpeningElement(n) || ts.isJsxSelfClosingElement(n)) && SCROLL.has(n.tagName.getText())) {
      let p: ts.Node | undefined = n.parent;
      let touchable: string | null = null;
      let inModal = false;
      while (p) {
        if (ts.isJsxElement(p)) {
          const tag = p.openingElement.tagName.getText();
          if (tag === 'Modal') { inModal = true; break; }
          const pressable = p.openingElement.attributes.properties.some(
            a => ts.isJsxAttribute(a) && a.name.getText() === 'onPress');
          if (TOUCH.has(tag) && pressable) touchable = `${tag} at line ${sf.getLineAndCharacterOfPosition(p.getStart()).line + 1}`;
        }
        p = p.parent;
      }
      if (inModal && touchable) {
        found.push(`${path.relative(ROOT, file)}:${sf.getLineAndCharacterOfPosition(n.getStart()).line + 1} ${n.tagName.getText()} is inside a touchable (${touchable})`);
      }
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);
  return found;
}

describe('modal scroll containers', () => {
  it('are never nested inside a touchable backdrop/sheet', () => {
    const files = [...tsxFiles(path.join(ROOT, 'app')), ...tsxFiles(path.join(ROOT, 'src'))];
    const bad = files.flatMap(offenders);
    expect(bad).toEqual([]);
  });
});
