// ============================================================================
// scripts/convert-spells.mjs
//
// One-off (re-runnable) converter: parses the Obsidian vault spell files into
// a single typed TS module the app consumes.
//
// Usage:
//   node scripts/convert-spells.mjs
//
// Reads:  <VAULT>/Cantrips.md, Level 1 Spells.md … Level 9 Spells.md
// Writes: src/content/spells/generated.ts  (export const ALL_VAULT_SPELLS: Spell[])
//
// Re-run any time you edit the vault spell files (e.g. fix a class tag).
// The output is AUTO-GENERATED — never hand-edit generated.ts.
// ============================================================================
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Config ────────────────────────────────────────────────────────────────────
// Edit this if the vault moves.
const VAULT_SPELLS_DIR =
  'C:\\Users\\nk\\Documents\\Sort later\\YSB\\Obsidian Vault\\DND\\DND ჩემი\\Spells';

const OUT_FILE = join(__dirname, '..', 'src', 'content', 'spells', 'generated.ts');

const FILES = [
  'Cantrips.md',
  'Level 1 Spells.md',
  'Level 2 Spells.md',
  'Level 3 Spells.md',
  'Level 4 Spells.md',
  'Level 5 Spells.md',
  'Level 6 Spells.md',
  'Level 7 Spells.md',
  'Level 8 Spells.md',
  'Level 9 Spells.md',
];

// ── Helpers ─────────────────────────────────────────────────────────────────

function slug(name) {
  return name
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function cap(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

function parseComponents(raw) {
  // raw e.g. "V, S, M (a melee weapon worth at least 1 sp)"
  const out = [];
  if (/\bV\b/.test(raw)) out.push('V');
  if (/\bS\b/.test(raw)) out.push('S');
  if (/\bM\b/.test(raw)) out.push('M');
  return out;
}

const FIELD = {
  castingTime: /^\*\*Casting Time\*\*:\s*(.+)$/im,
  range:       /^\*\*Range\*\*:\s*(.+)$/im,
  components:  /^\*\*Components\*\*:\s*(.+)$/im,
  duration:    /^\*\*Duration\*\*:\s*(.+)$/im,
  classes:     /^\*\*Classes\*\*:\s*(.+)$/im,
};
const LEVEL_RE = /^level\s+(\d+)\s*-\s*(.+)$/im;

function parseBlock(block) {
  const lines = block.split(/\r?\n/);
  const name = lines[0].replace(/^#\s*/, '').trim();
  if (!name) return null;

  const levelMatch = block.match(LEVEL_RE);
  if (!levelMatch) return null; // not a spell block
  const level  = parseInt(levelMatch[1], 10);
  const school = cap(levelMatch[2].trim().toLowerCase());

  const grab = (re) => { const m = block.match(re); return m ? m[1].trim() : ''; };
  const castingTime = grab(FIELD.castingTime);
  const range       = grab(FIELD.range);
  const components  = parseComponents(grab(FIELD.components));
  const duration    = grab(FIELD.duration);
  const classesRaw  = grab(FIELD.classes);
  const classes = classesRaw
    ? classesRaw.split(',').map(c => slug(c.trim())).filter(Boolean)
    : [];

  // Description = lines that aren't the header, the level line, or a metadata field.
  const isMeta = (ln) =>
    /^#\s/.test(ln) ||
    LEVEL_RE.test(ln) ||
    /^\*\*(Casting Time|Range|Components|Duration|Classes)\*\*:/i.test(ln);
  let desc = lines.filter(ln => !isMeta(ln)).join('\n').replace(/\n{3,}/g, '\n\n').trim();

  // Pull out an "At Higher Levels" paragraph as `upcast`, if present.
  let upcast = null;
  const paras = desc.split(/\n{2,}/);
  const idx = paras.findIndex(p => /^at higher levels/i.test(p.trim()));
  if (idx !== -1) {
    upcast = paras[idx].replace(/^at higher levels[.:]?\s*/i, '').trim();
    paras.splice(idx, 1);
    desc = paras.join('\n\n').trim();
  }

  const concentration = /concentration/i.test(duration);
  const ritual = /\britual\b/i.test(block);

  return {
    id: slug(name),
    name,
    level,
    school,
    castingTime,
    range,
    components,
    duration,
    description: desc,
    upcast,
    ritual,
    concentration,
    classes,
  };
}

// ── Run ───────────────────────────────────────────────────────────────────────

const spells = [];
const seen = new Set();

for (const file of FILES) {
  let text;
  try {
    text = readFileSync(join(VAULT_SPELLS_DIR, file), 'utf8');
  } catch (e) {
    console.warn(`! Skipping ${file}: ${e.message}`);
    continue;
  }
  // Split into blocks on top-level "# " headings.
  const blocks = text.split(/\n(?=#\s)/);
  let count = 0;
  for (const block of blocks) {
    if (!/^#\s/.test(block.trim())) continue;
    const spell = parseBlock(block.trim());
    if (!spell) continue;
    if (seen.has(spell.id)) {
      console.warn(`! Duplicate id "${spell.id}" (${spell.name}) — keeping first.`);
      continue;
    }
    seen.add(spell.id);
    spells.push(spell);
    count++;
  }
  console.log(`  ${file}: ${count} spells`);
}

spells.sort((a, b) => a.level - b.level || a.name.localeCompare(b.name));

const header = `// ============================================================================
// FILE: src/content/spells/generated.ts
// AUTO-GENERATED by scripts/convert-spells.mjs — DO NOT EDIT BY HAND.
// Source: Obsidian vault spell files. Re-run the script to regenerate.
// ${spells.length} spells.
// ============================================================================
import { Spell } from '../../engine/types';

export const ALL_VAULT_SPELLS: Spell[] = `;

writeFileSync(OUT_FILE, header + JSON.stringify(spells, null, 2) + ';\n', 'utf8');
console.log(`\n✓ Wrote ${spells.length} spells → ${OUT_FILE}`);
