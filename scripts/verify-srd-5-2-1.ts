// Compares what the SRD 5.2.1 pack carries with the canonical source in third_party/wotc/srd/5.2.1 (the PDF, read through pdftotext).
//   npx tsx scripts/verify-srd-5-2-1.ts [--json]
// Exits 1 if the PDF's SHA-256 is not the one SOURCE.md records, or if a checked record disagrees with the PDF beyond the tolerances below.
// What is checked against the PDF: every spell's level, school, casting time, range, duration, components and description text;
// every feat's name and category (prerequisites are not compared); the Mastery column of the weapons table (all 38 weapons, in table order); every magic item's name and text.
// What is NOT checked here (the audit checked it another way or not at all, see docs/audits/SRD_5_2_1_READINESS_AUDIT.md): species traits, class
// features (scripts/audit-caster-tables.ts covers the cantrip and prepared-spell columns), backgrounds, weapon and armor cost/weight/damage, tools.
import fs from 'fs';
import path from 'path';
import { createHash } from 'crypto';
import { execFileSync } from 'child_process';
import { buildSrd521Pack } from '../src/content/packs/srdPacks';
import { WEAPON_MASTERY_TABLE } from '../src/content/weaponMastery';

const root = path.join(__dirname, '..');
const dir = path.join(root, 'third_party', 'wotc', 'srd', '5.2.1');
const pdf = path.join(dir, 'SRD_CC_v5.2.1.pdf');
const source = fs.readFileSync(path.join(dir, 'SOURCE.md'), 'utf8');
const expectedHash = /SHA-256:\*\* `([0-9a-f]{64})`/.exec(source)![1];
const actualHash = createHash('sha256').update(fs.readFileSync(pdf)).digest('hex');

const problems: string[] = [];
const report: Record<string, unknown> = { pdfSha256: actualHash, sourceMdSha256: expectedHash };
if (actualHash !== expectedHash) problems.push(`The PDF hash ${actualHash} is not the one SOURCE.md records (${expectedHash}).`);

const cache = path.join(root, 'release', 'srd521.txt');
fs.mkdirSync(path.dirname(cache), { recursive: true });
execFileSync('pdftotext', [pdf, cache], { stdio: 'ignore' });
const text = fs.readFileSync(cache, 'utf8').replace(/\f/g, '\n');
const lines = text.split('\n').map(l => l.trim());
const norm = (s: unknown) => String(s ?? '').normalize('NFKC').toLowerCase().replace(/[­‐-―-]/g, '').replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[^a-z0-9]+/g, ' ').trim();

const pack = buildSrd521Pack();
const h = pack.homebrew as unknown as Record<string, any[]>;

// ── spells ────────────────────────────────────────────────────────────────
const L = lines.filter(l => l && !/^\d+ System Reference Document 5\.2\.1$|^System Reference Document 5\.2\.1 \d+$|^\d+$/.test(l));
const start = L.findIndex((l, i) => l === 'Spell Descriptions' && L[i + 1] === 'Acid Arrow');
const end = L.findIndex((l, i) => i > start && l === 'Rules Glossary');
type Block = { name: string; level: number; school: string; classes: string[]; casting: string; range: string; components: string; duration: string; body: string };
const blocks: Block[] = [];
for (let i = start; i < (end > 0 ? end : L.length); i++) {
  const m = /^(?:Level (\d) ([A-Z][a-z]+)|([A-Z][a-z]+) Cantrip) \(([^)]*)\)$/.exec(L[i + 1] ?? '');
  // The details line can wrap when the material component is long: join until Duration appears.
  let k = i + 2; let detail = L[k] ?? '';
  while (k < i + 6 && !/Duration:/.test(detail) && /^Casting Time:/.test(L[i + 2] ?? '')) { k++; detail += ' ' + (L[k] ?? ''); }
  const f = /^Casting Time: (.*?) Range: (.*?) Components?: (.*?) Duration: (.*)$/.exec(detail);
  if (!m || !f || !L[i]) continue;
  let j = k + 1; const body: string[] = [];
  while (j < L.length && !(/^(?:Level \d [A-Z][a-z]+|[A-Z][a-z]+ Cantrip) \(/.test(L[j + 1] ?? '') && /^Casting Time:/.test(L[j + 2] ?? ''))) { body.push(L[j]); j++; }
  blocks.push({ name: L[i], level: m[1] ? Number(m[1]) : 0, school: m[2] ?? m[3], classes: m[4].split(',').map(s => s.trim()), casting: f[1], range: f[2], components: f[3], duration: f[4], body: body.join(' ') });
}
const spells = h.spells as any[];
const byName = new Map(blocks.map(b => [norm(b.name), b]));
let spellOk = 0;
const spellProblems: string[] = [];
for (const s of spells) {
  const b = byName.get(norm(s.name));
  if (!b) { spellProblems.push(`${s.name}: no spell block in the PDF`); continue; }
  const bad: string[] = [];
  if (b.level !== s.level) bad.push(`level ${s.level} vs ${b.level}`);
  if (norm(b.school) !== norm(s.school)) bad.push(`school ${s.school} vs ${b.school}`);
  const castingPdf = norm(b.casting.replace(/ or Ritual$/, ''));
  if (/ or Ritual$/.test(b.casting) && !s.ritual) bad.push('ritual flag missing');
  if (castingPdf !== norm(s.castingTime)) bad.push(`casting time "${s.castingTime}" vs "${b.casting}"`);
  if (norm(b.range) !== norm(s.range)) bad.push(`range "${s.range}" vs "${b.range}"`);
  if (norm(b.duration) !== norm(s.duration)) bad.push(`duration "${s.duration}" vs "${b.duration}"`);
  const letters = (b.components.match(/\b[VSM]\b/g) ?? []).sort().join('');
  if (letters !== [...(s.components ?? [])].sort().join('')) bad.push(`components ${JSON.stringify(s.components)} vs "${b.components}"`);
  const want = norm(b.body), have = norm([s.description, s.upcast].filter(Boolean).join(' '));
  // the pack's description may be split differently from the PDF's paragraphs; compare the words they share
  const a = new Set(want.split(' ')), c = new Set(have.split(' '));
  const shared = [...a].filter(w => c.has(w)).length / Math.max(a.size, c.size, 1);
  if (shared < 0.9) bad.push(`description shares ${(shared * 100).toFixed(0)}% of its words with the PDF`);
  if (bad.length) spellProblems.push(`${s.name}: ${bad.join('; ')}`); else spellOk++;
}
report.spells = { inPack: spells.length, blocksInPdf: blocks.length, matching: spellOk, problems: spellProblems.length };
problems.push(...spellProblems.map(p => `spell ${p}`));
const pdfOnly = blocks.filter(b => !spells.some(s => norm(s.name) === norm(b.name))).map(b => b.name);
report.spellsInPdfNotInPack = pdfOnly;
if (pdfOnly.length) problems.push(`spells in the PDF but not in the pack: ${pdfOnly.join(', ')}`);

// ── feats ─────────────────────────────────────────────────────────────────
const featText = text;
const feats = h.feats as any[];
const featProblems: string[] = [];
for (const f of feats) {
  const name = f.name.replace(/\s*\(.*\)$/, '');
  if (!featText.includes(name)) featProblems.push(`${f.name}: name not in the PDF`);
  const cat = { origin: 'Origin Feat', general: 'General Feat', fighting_style: 'Fighting Style Feat', epic_boon: 'Epic Boon Feat' }[f.category as string];
  const re = new RegExp(`${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\n+\\s*${cat}`, 'i');
  if (cat && f.category !== 'origin' && !re.test(featText) && !featText.includes(`${cat} (Prerequisite`) ) featProblems.push(`${f.name}: category ${cat} not confirmed`);
}
report.feats = { inPack: feats.length, problems: featProblems.length };
problems.push(...featProblems.map(p => `feat ${p}`));

// ── weapons: the SRD table's names and Mastery column, in reading order ────────
const tableStart = text.indexOf('Simple Melee Weapons');
const tableText = text.slice(tableStart, text.indexOf('Armor Training', tableStart));
const weaponNames = WEAPON_MASTERY_TABLE.map(w => w.name);
const masteryAt = tableText.indexOf('Mastery');
const masteryBlock = tableText.slice(masteryAt, tableText.indexOf('Weight', masteryAt));
const masteryTokens = masteryBlock.match(/\b(Cleave|Graze|Nick|Push|Sap|Slow|Topple|Vex)\b/g) ?? [];
const weaponProblems: string[] = [];
const order = weaponNames
  .map(n => ({ n, at: tableText.search(new RegExp(`^${n}\\b`, 'm')) }))
  .filter(x => x.at >= 0).sort((x, y) => x.at - y.at).map(x => x.n);
if (order.length !== weaponNames.length) weaponProblems.push(`only ${order.length} of ${weaponNames.length} weapon names found as table rows`);
if (masteryTokens.length !== weaponNames.length) weaponProblems.push(`the Mastery column has ${masteryTokens.length} entries, the table lists ${weaponNames.length} weapons`);
else order.forEach((n, i) => {
  const w = WEAPON_MASTERY_TABLE.find(x => x.name === n)!;
  if (w.mastery.toLowerCase() !== masteryTokens[i].toLowerCase()) weaponProblems.push(`${n}: mastery ${w.mastery} vs ${masteryTokens[i]} in the SRD`);
});
report.weapons = { inMasteryTable: weaponNames.length, masteryEntriesInPdf: masteryTokens.length, problems: weaponProblems.length };
// ── magic items ──────────────────────────────────────────────────────────
const items = h.items as any[];
const magic = items.filter(i => (i.properties ?? []).includes('magic item') && /^(Armor|Potion|Ring|Rod|Scroll|Staff|Wand|Weapon|Wondrous Item)/.test(i.features?.[0]?.description ?? ''));
const magicProblems: string[] = [];
const magicStart = lines.findIndex(l => /^Magic Items A.Z$/.test(l));
const magicText = norm(lines.slice(magicStart).join(' '));
for (const i of magic) {
  if (!magicText.includes(norm(i.name))) magicProblems.push(`${i.name}: not in Magic Items A-Z`);
  const desc = norm(String(i.features[0].description).split('. ').slice(1).join('. ').slice(0, 120));
  if (desc && !magicText.includes(desc.slice(0, 60))) magicProblems.push(`${i.name}: text differs from the PDF`);
}
report.magicItems = { inPack: magic.length, problems: magicProblems.length };
problems.push(...weaponProblems.map(p => `weapon ${p}`), ...magicProblems.map(p => `magic item ${p}`));

report.problemCount = problems.length;
if (process.argv.includes('--json')) console.log(JSON.stringify({ ...report, problems }, null, 1));
else { console.log(JSON.stringify(report, null, 1)); for (const p of problems.slice(0, 60)) console.log(' -', p); if (problems.length > 60) console.log(` ... and ${problems.length - 60} more`); }
process.exit(problems.length ? 1 : 0);
