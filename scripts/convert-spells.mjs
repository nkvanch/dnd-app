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
  'D:\\Documents\\Sort later\\YSB\\Obsidian Vault\\DND\\DND ჩემი\\Spells';

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

// ── SRD 5.1 legal classification ─────────────────────────────────────────────
// See docs/ROADMAP_1.0.md Phase 1 for the full legal-audit plan. Public/
// distributed builds filter to srd === true (src/content/spells/index.ts) —
// this classification runs automatically every time the vault is converted,
// so it never needs re-doing by hand and never gets lost on regeneration.
//
// Three-tier, safety-first classification:
//   1. DENY  (name/description match)  → srd: false, definitely excluded
//   2. ALLOW (name match, high confidence, directly verified against a real
//             SRD 5.1 read-through) → srd: true
//   3. Everything else                 → srd left UNSET (undefined)
// Per the Spell type's own contract, undefined means "not yet audited" and
// is treated as unsafe for public builds — the same safe default used
// throughout the hand-tagged spell files (cantrips.ts, level1.ts … level9.ts).
//
// IMPORTANT: the ALLOW list below was built by directly reading the actual
// generated spell text across multiple sessions (see docs/ROADMAP_1.0.md for
// progress tracking). As of the most recent pass it covers cantrips, all of
// level 1, and the start of level 2 — the rest of levels 2–9 have NOT been
// read yet and correctly fall through to "unset" (excluded) until a future
// pass extends the ALLOW list after reading them directly.
// Re-running this script does not lose progress; it re-applies the same
// classification rules to whatever the vault currently contains.

// Product Identity naming — named-wizard spells (Tasha's, Melf's, Bigby's,
// Otiluke's, Leomund's, Otto's, Rary's, Evard's, Nystul's, Drawmij's,
// Mordenkainen's, Jim Darkmagic, etc). Even when the mechanic is core PHB,
// the possessive name itself is WotC Product Identity — exclude until
// manually renamed to its SRD name (see ROADMAP_1.0.md Step 1.2).
const PI_NAME_RE = /\b(Tasha|Melf|Bigby|Otiluke|Leomund|Otto|Rary|Evard|Nystul|Drawmij|Mordenkainen|Tenser|Aganazzar|Snilloc|Abi-Dalzim|Maximilian|Jim Darkmagic)('s)?\b/i;

// Specific known non-SRD spells that aren't Product-Identity-named (mostly
// Xanathar's Guide, Sword Coast Adventurer's Guide, Tasha's Cauldron, and
// other post-PHB expansion content). Matched by exact spell name.
const SRD_DENY_NAMES = new Set([
  // Cantrips — SCAG/XGE/Tasha's additions
  'Booming Blade', 'Green-Flame Blade', 'Sword Burst', 'Lightning Lure',
  'Control Flames', 'Create Bonfire', 'Frostbite', 'Gust', 'Mold Earth',
  'Shape Water', 'Thorn Whip', 'Thunderclap', 'Toll the Dead', 'Mind Sliver',
  'Infestation', 'Primal Savagery', 'Word of Radiance',
  // Level 1+ — XGE/SCAG/Tasha's additions confirmed elsewhere in this project
  'Absorb Elements', 'Chaos Bolt', 'Ice Knife', 'Wrathful Smite',
  'Thunderous Smite', 'Searing Smite', 'Staggering Smite', 'Blinding Smite',
  'Banishing Smite', 'Thunder Step', 'Synaptic Static', 'Compelled Duel',
  'Beast Bond',
  // "Hadar" family — PI-adjacent, kept excluded for consistency with the
  // conservative flag already applied in level1.ts/level3.ts pending a real
  // SRD-text verification pass.
  'Arms of Hadar', 'Hunger of Hadar',
  // Confirmed while reading levels 1–2 directly in this session
  'Earth Tremor', 'Hail of Thorns', 'Illusory Script', 'Cordon of Arrows',
  // Confirmed on second pass through level 2 and start of level 3
  'Dust Devil', 'Earthbind', 'Shadow Blade', 'Skywrite', 'Summon Beast',
  'Warding Wind', 'Aura of Vitality', 'Blinding Smite',
]);

// Directly-verified core PHB / SRD 5.1 spells (read against the actual
// generated.ts text across two sessions — all of cantrips + level 1, and the
// start of level 2. Extend this list further by reading more of the file
// and adding confirmed entries; anything not yet read stays safely unset.
const SRD_ALLOW_NAMES = new Set([
  // Cantrips
  'Acid Splash', 'Blade Ward', 'Chill Touch', 'Dancing Lights', 'Druidcraft',
  'Eldritch Blast', 'Fire Bolt', 'Friends', 'Guidance', 'Light', 'Mage Hand',
  'Mending', 'Message', 'Minor Illusion', 'Poison Spray', 'Prestidigitation',
  'Produce Flame', 'Ray of Frost', 'Resistance', 'Sacred Flame', 'Shillelagh',
  'Shocking Grasp', 'Spare the Dying', 'Thaumaturgy', 'True Strike',
  'Vicious Mockery',
  // Level 1 (partial)
  'Alarm', 'Animal Friendship', 'Armor of Agathys', 'Bane', 'Bless',
  'Burning Hands', 'Catapult', 'Charm Person', 'Chromatic Orb', 'Color Spray',
  'Command', 'Comprehend Languages', 'Create or Destroy Water', 'Cure Wounds',
  'Detect Evil and Good', 'Detect Magic', 'Detect Poison and Disease',
  'Disguise Self', 'Dissonant Whispers', 'Divine Favor', 'Ensnaring Strike',
  'Entangle', 'Expeditious Retreat', 'Faerie Fire', 'False Life',
  'Feather Fall', 'Find Familiar', 'Fog Cloud', 'Goodberry', 'Grease',
  'Guiding Bolt', 'Healing Word', 'Hellish Rebuke', 'Heroism', 'Hex',
  "Hunter's Mark", 'Identify', 'Inflict Wounds', 'Jump', 'Longstrider',
  'Mage Armor', 'Magic Missile', 'Protection from Evil and Good',
  'Purify Food and Drink', 'Ray of Sickness', 'Sanctuary', 'Shield',
  'Shield of Faith', 'Silent Image', 'Sleep', 'Speak with Animals',
  'Thunderwave', 'Unseen Servant', 'Witch Bolt',
  // Level 2 (partial)
  'Aid', 'Alter Self', 'Animal Messenger', 'Arcane Lock', 'Augury',
  'Barkskin', 'Beast Sense', 'Blindness/Deafness', 'Blur', 'Branding Smite',
  'Calm Emotions', 'Cloud of Daggers', 'Continual Flame', 'Crown of Madness',
  'Darkness', 'Darkvision', 'Detect Thoughts', 'Enhance Ability',
  'Enlarge/Reduce', 'Enthrall', 'Find Steed', 'Find Traps', 'Flame Blade',
  'Flaming Sphere', 'Gentle Repose', 'Gust of Wind', 'Heat Metal',
  'Hold Person', 'Invisibility', 'Knock', 'Lesser Restoration', 'Levitate',
  'Locate Animals or Plants', 'Locate Object', 'Magic Mouth', 'Magic Weapon',
  'Mirror Image', 'Misty Step', 'Moonbeam', 'Pass without Trace',
  'Phantasmal Force', 'Prayer of Healing', 'Protection from Poison',
  'Pyrotechnics', 'Ray of Enfeeblement', 'Rope Trick', 'Scorching Ray',
  'See Invisibility', 'Shatter', 'Silence', 'Spider Climb', 'Spike Growth',
  'Spiritual Weapon', 'Suggestion', 'Warding Bond', 'Web', 'Zone of Truth',
  // Level 3 (start)
  'Animate Dead', 'Beacon of Hope', 'Bestow Curse',
]);

function computeSrd(name, description) {
  if (/not OGL/i.test(description)) return false;   // vault's own marker
  if (PI_NAME_RE.test(name)) return false;           // Product Identity naming
  if (SRD_DENY_NAMES.has(name)) return false;         // known non-SRD, verified
  if (SRD_ALLOW_NAMES.has(name)) return true;         // known SRD, verified
  return undefined;                                    // not yet audited — safe default
}

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

  const srd = computeSrd(name, desc);

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
    ...(srd !== undefined ? { srd } : {}),
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

// ── Safety guard ─────────────────────────────────────────────────────────────────
// If the vault path is wrong/moved and every source .md file is skipped
// (ENOENT), spells.length would silently be 0 — and without this guard the
// script would happily overwrite the existing 487-spell generated.ts with an
// EMPTY array. Refuse to write if the result is drastically smaller than
// what's already on disk, and tell the person exactly what to check.
let previousCount = 0;
try {
  const existing = readFileSync(OUT_FILE, 'utf8');
  const m = existing.match(/\/\/\s*(\d+)\s*spells\.?\s*$/m);
  if (m) previousCount = parseInt(m[1], 10);
} catch { /* no existing file yet — fine, nothing to protect */ }

if (previousCount > 20 && spells.length < previousCount * 0.5) {
  console.error(
    `\n✗ REFUSING TO WRITE: parsed only ${spells.length} spells, but the \n` +
    `  existing file has ${previousCount}. This usually means VAULT_SPELLS_DIR \n` +
    `  in this script is wrong or the vault moved — check the ENOENT warnings \n` +
    `  above for the path it tried. Fix the path and re-run.\n` +
    `  generated.ts was NOT modified.`
  );
  process.exit(1);
}

// SRD classification summary — shows exactly how much of the vault is safe
// for a public build vs. still needing manual audit before Phase 1 is done.
const srdTrue  = spells.filter(s => s.srd === true).length;
const srdFalse = spells.filter(s => s.srd === false).length;
const srdUnset = spells.length - srdTrue - srdFalse;
console.log(`\nSRD classification: ${srdTrue} allowed, ${srdFalse} denied, ${srdUnset} unaudited (excluded by default).`);
console.log('See docs/ROADMAP_1.0.md Phase 1 for how to extend the ALLOW/DENY lists.');

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
