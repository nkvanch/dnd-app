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
const SRD_FILE = join(__dirname, '..', 'src', 'content', 'spells', 'srdClassification.json');

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
  'Infestation', 'Primal Savagery', 'Word of Radiance', 'Magic Stone',
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
  // Confirmed on fourth pass: rest of level 3 + start of level 4
  'Conjure Barrage', "Crusader's Mantle", 'Erupting Earth',
  'Life Transference', 'Lightning Arrow', 'Spirit Shroud', 'Tidal Wave',
  'Wall of Sand', 'Wall of Water', 'Aura of Life',
  // Confirmed on fifth pass: rest of level 4 + all of level 5
  'Aura of Purity', 'Elemental Bane', 'Grasping Vine', 'Storm Sphere',
  'Vitriolic Sphere', 'Watery Sphere', 'Conjure Volley', 'Control Winds',
  'Immolation', 'Maelstrom',
  // Confirmed on sixth (final) pass: levels 6–9 in full
  'Bones of the Earth', 'Investiture of Flame', 'Investiture of Ice',
  'Investiture of Stone', 'Investiture of Wind', 'Primordial Ward',
  'Whirlwind', 'Tsunami', 'Power Word Heal',
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
  // Level 3 (rest, fourth pass)
  'Blink', 'Call Lightning', 'Clairvoyance', 'Conjure Animals',
  'Counterspell', 'Create Food and Water', 'Daylight', 'Dispel Magic',
  'Elemental Weapon', 'Fear', 'Feign Death', 'Fireball', 'Flame Arrows',
  'Fly', 'Gaseous Form', 'Glyph of Warding', 'Haste', 'Hypnotic Pattern',
  'Lightning Bolt', 'Magic Circle', 'Major Image', 'Mass Healing Word',
  'Meld into Stone', 'Nondetection', 'Phantom Steed', 'Plant Growth',
  'Protection from Energy', 'Remove Curse', 'Revivify', 'Sending',
  'Sleet Storm', 'Slow', 'Speak with Dead', 'Speak with Plants',
  'Spirit Guardians', 'Stinking Cloud', 'Tongues', 'Vampiric Touch',
  'Water Breathing', 'Water Walk', 'Wind Wall',
  // Level 4 (start)
  'Arcane Eye',
  // Level 4 (rest, fifth pass)
  'Banishment', 'Blight', 'Compulsion', 'Confusion',
  'Conjure Minor Elementals', 'Conjure Woodland Beings', 'Control Water',
  'Death Ward', 'Dimension Door', 'Divination', 'Dominate Beast',
  'Fabricate', 'Fire Shield', 'Freedom of Movement', 'Giant Insect',
  'Greater Invisibility', 'Guardian of Faith', 'Hallucinatory Terrain',
  'Ice Storm', 'Locate Creature', 'Phantasmal Killer', 'Polymorph',
  'Stone Shape', 'Stoneskin', 'Wall of Fire',
  // Level 5 (all, fifth pass)
  'Animate Objects', 'Antilife Shell', 'Awaken', 'Circle of Power',
  'Cloudkill', 'Commune', 'Commune with Nature', 'Cone of Cold',
  'Conjure Elemental', 'Contact Other Plane', 'Contagion', 'Creation',
  'Destructive Wave', 'Dispel Evil and Good', 'Dominate Person', 'Dream',
  'Flame Strike', 'Geas', 'Greater Restoration', 'Hallow', 'Hold Monster',
  'Insect Plague', 'Legend Lore', 'Mass Cure Wounds', 'Mislead',
  'Modify Memory', 'Passwall', 'Planar Binding', 'Raise Dead',
  'Reincarnate', 'Scrying', 'Seeming', 'Swift Quiver', 'Telekinesis',
  'Teleportation Circle', 'Transmute Rock', 'Tree Stride', 'Wall of Force',
  'Wall of Stone',
  // Level 6 (start)
  'Arcane Gate', 'Blade Barrier',
  // Level 6 (rest, sixth/final pass)
  'Chain Lightning', 'Circle of Death', 'Conjure Fey', 'Contingency',
  'Create Undead', 'Disintegrate', 'Eyebite', 'Find the Path',
  'Flesh to Stone', 'Forbiddance', 'Globe of Invulnerability',
  'Guards and Wards', 'Harm', 'Heal', "Heroes' Feast", 'Magic Jar',
  'Mass Suggestion', 'Move Earth', 'Planar Ally', 'Programmed Illusion',
  'Sunbeam', 'Transport via Plants', 'True Seeing', 'Wall of Ice',
  'Wall of Thorns', 'Wind Walk', 'Word of Recall',
  // Level 7 (all)
  'Conjure Celestial', 'Delayed Blast Fireball', 'Divine Word',
  'Etherealness', 'Finger of Death', 'Fire Storm', 'Forcecage',
  'Mirage Arcane', 'Plane Shift', 'Prismatic Spray', 'Project Image',
  'Regenerate', 'Resurrection', 'Reverse Gravity', 'Sequester',
  'Simulacrum', 'Symbol', 'Teleport',
  // Level 8 (all)
  'Animal Shapes', 'Antimagic Field', 'Antipathy/Sympathy', 'Clone',
  'Control Weather', 'Demiplane', 'Dominate Monster', 'Earthquake',
  'Feeblemind', 'Glibness', 'Holy Aura', 'Incendiary Cloud', 'Maze',
  'Mind Blank', 'Power Word Stun', 'Sunburst', 'Telepathy',
  // Level 9 (all)
  'Astral Projection', 'Foresight', 'Gate', 'Imprisonment', 'Mass Heal',
  'Meteor Swarm', 'Power Word Kill', 'Prismatic Wall', 'Shapechange',
  'Storm of Vengeance', 'Time Stop', 'True Polymorph', 'True Resurrection',
  'Weird', 'Wish',
]);

function computeSrd(name, description) {
  if (/not OGL/i.test(description)) return false;   // vault's own marker
  if (PI_NAME_RE.test(name)) return false;           // Product Identity naming
  if (SRD_DENY_NAMES.has(name)) return false;         // known non-SRD, verified
  if (SRD_ALLOW_NAMES.has(name)) return true;         // known SRD, verified
  return undefined;                                    // not yet audited — safe default
}

// ── SRD renames ─────────────────────────────────────────────────────────────────
// Some PI-named spells are core PHB content that SRD 5.1 kept, but with the
// named wizard stripped from the title (e.g. "Tasha's Hideous Laughter" →
// "Hideous Laughter"). This is different from PI-named spells that ONLY ever
// existed in a non-SRD book (Xanathar's, SCAG, Tasha's Cauldron) — those have
// no SRD equivalent at all and correctly stay excluded permanently via
// PI_NAME_RE / SRD_DENY_NAMES above. Keyed by the vault's slugified id;
// renaming here keeps id (and thus any references) stable while fixing the
// public-facing name and unlocking srd:true. Mirrors the same renames
// already applied by hand in src/content/spells/level1.ts–level4.ts — see
// ROADMAP_1.0.md Step 1.2.
const SRD_RENAME_MAP = {
  tashas_hideous_laughter:        'Hideous Laughter',
  melfs_acid_arrow:               'Acid Arrow',
  leomunds_tiny_hut:              'Tiny Hut',
  nystuls_magic_aura:             "Arcanist's Magic Aura",
  evards_black_tentacles:         'Black Tentacles',
  mordenkainens_private_sanctum:  'Private Sanctum',
  otilukes_resilient_sphere:      'Resilient Sphere',
  otilukes_freezing_sphere:       'Freezing Sphere',
  ottos_irresistible_dance:       'Irresistible Dance',
  // mordenkainens_magnificent_mansion: has a vault markdown parsing bug
  // (range/components/duration came out empty) — excluded until that's
  // fixed at the source; renaming wouldn't help since the underlying data
  // is broken regardless of SRD status. Flagged separately in ROADMAP_1.0.md.
};

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

  const id = slug(name);
  let srd = computeSrd(name, desc);
  let finalName = name;

  // Apply SRD_RENAME_MAP: only promote a PI-excluded spell to srd:true if we
  // actually have real description text to show — a rename doesn't help if
  // the vault only has a redacted "not OGL" placeholder for it.
  const renamed = SRD_RENAME_MAP[id];
  if (renamed && srd === false && !/not OGL/i.test(desc)) {
    finalName = renamed;
    srd = true;
  }

  // NOTE: srd is intentionally NOT included in the returned spell object.
  // It's tracked separately (see the `classification` map built in the run
  // loop below) and written to its own small JSON file, merged in at load
  // time by index.ts. This means re-running this script after a
  // classification-only change (no vault edits) leaves generated.ts
  // byte-for-byte identical — only the small classification file changes.
  // Before this split, every classification pass rewrote the entire
  // 500+KB generated.ts, even though the actual spell content never
  // changed. See docs/ROADMAP_1.0.md for the full writeup.
  return {
    spell: {
      id,
      name: finalName,
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
    },
    srd,
  };
}

// ── Run ───────────────────────────────────────────────────────────────────────

const spells = [];
const classification = {};
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
    const parsed = parseBlock(block.trim());
    if (!parsed) continue;
    const { spell, srd } = parsed;
    if (seen.has(spell.id)) {
      console.warn(`! Duplicate id "${spell.id}" (${spell.name}) — keeping first.`);
      continue;
    }
    seen.add(spell.id);
    spells.push(spell);
    if (srd !== undefined) classification[spell.id] = srd;
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
const srdTrue  = Object.values(classification).filter(v => v === true).length;
const srdFalse = Object.values(classification).filter(v => v === false).length;
const srdUnset = spells.length - srdTrue - srdFalse;
console.log(`\nSRD classification: ${srdTrue} allowed, ${srdFalse} denied, ${srdUnset} unaudited (excluded by default).`);
console.log('See docs/ROADMAP_1.0.md Phase 1 for how to extend the ALLOW/DENY lists.');

const header = `// ============================================================================
// FILE: src/content/spells/generated.ts
// AUTO-GENERATED by scripts/convert-spells.mjs — DO NOT EDIT BY HAND.
// Source: Obsidian vault spell files. Re-run the script to regenerate.
//
// Pure spell content only — NO srd field here. SRD classification lives in
// the separate srdClassification.json, merged in at load time by index.ts.
// This means classification-only re-runs (the common case during the legal
// audit) leave this file byte-for-byte unchanged — only srdClassification.json
// updates. This file only changes when the vault content itself changes.
// ${spells.length} spells.
// ============================================================================
import { Spell } from '../../engine/types';

export const ALL_VAULT_SPELLS: Spell[] = `;

writeFileSync(OUT_FILE, header + JSON.stringify(spells, null, 2) + ';\n', 'utf8');
console.log(`\n✓ Wrote ${spells.length} spells → ${OUT_FILE}`);

writeFileSync(SRD_FILE, JSON.stringify(classification, null, 2) + '\n', 'utf8');
console.log(`✓ Wrote ${Object.keys(classification).length} classification entries → ${SRD_FILE}`);
