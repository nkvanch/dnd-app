// ============================================================================
// FILE: src/content/classes/emperorWarlock/spellData.ts
// Pure data (spell ids only, no imports) for the Emperor Warlock: the class spell list, the Legacy
// Arcanum lists and each Bound Spirit's bonus spells (docs/homebrew/EMPEROR_WARLOCK.md, "Spirit
// Pact Magic" and "Spirit-granted spells"). Kept import-free so the spell library can tag its own
// spells with the class id without a dependency cycle.
//
// Official spells are REFERENCED by id, never copied. Where a referenced spell is unavailable in a
// public (SRD-only) build, the id simply resolves to nothing there: the class text and grants stay,
// and nothing embeds non-public spell text.
// ============================================================================

/** Spell name -> library id, matching src/content/spells ids (lowercase, no apostrophes, underscores). */
const ALIASES: Record<string, string> = {
  // Named for their authors in the spell library.
  'Private Sanctum': 'mordenkainens_private_sanctum',
  'Telepathic Bond': 'rarys_telepathic_bond',
};
export const spellId = (name: string): string => ALIASES[name] ??
  name.toLowerCase().replace(/['’]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

const ids = (...names: string[]) => names.map(spellId);

export const EMPEROR_CANTRIPS = ids(
  'Eldritch Blast', 'Mage Hand', 'Minor Illusion', 'Prestidigitation', 'Thaumaturgy', 'Toll the Dead',
  'Guidance', 'Message', 'Mind Sliver', 'Friends', 'Blade Ward', 'True Strike',
);

export const EMPEROR_SPELLS_BY_LEVEL: Record<number, string[]> = {
  1: ids('Armor of Agathys', 'Cause Fear', 'Charm Person', 'Command', 'Comprehend Languages', 'Detect Magic',
    'Disguise Self', 'Expeditious Retreat', 'False Life', 'Hex', 'Heroism', 'Illusory Script',
    'Protection from Evil and Good', 'Silent Image', 'Unseen Servant'),
  2: ids('Aid', 'Augury', 'Blur', 'Darkness', 'Detect Thoughts', 'Enhance Ability', 'Enthrall', 'Hold Person',
    'Invisibility', 'Locate Object', 'Misty Step', 'Pass without Trace', 'Phantasmal Force', 'See Invisibility',
    'Silence', 'Suggestion'),
  3: ids('Clairvoyance', 'Counterspell', 'Dispel Magic', 'Fear', 'Fly', 'Gaseous Form', 'Hypnotic Pattern',
    'Major Image', 'Phantom Steed', 'Protection from Energy', 'Sending', 'Speak with Dead', 'Spirit Guardians', 'Tongues'),
  // The spec lists a summon spell here only as a placeholder ("Summon Ancestor" considered for later); none is invented.
  4: ids('Banishment', 'Charm Monster', 'Confusion', 'Dimension Door', 'Divination', 'Freedom of Movement',
    'Greater Invisibility', 'Hallucinatory Terrain', 'Locate Creature', 'Phantasmal Killer', 'Private Sanctum', 'Arcane Eye'),
  5: ids('Contact Other Plane', 'Dream', 'Geas', 'Hold Monster', 'Legend Lore', 'Mislead', 'Modify Memory',
    'Scrying', 'Telepathic Bond', 'Wall of Force', 'Greater Restoration', 'Commune'),
};

/** Every spell the class can learn through Pact Magic (cantrips + levels 1-5). */
export const EMPEROR_CLASS_SPELLS = [...EMPEROR_CANTRIPS, ...Object.values(EMPEROR_SPELLS_BY_LEVEL).flat()];

/** Legacy Arcanum: one spell each at class levels 11/13/15/17 (spell levels 6/7/8/9), once per long rest. */
export const LEGACY_ARCANUM: { level: number; spellLevel: number; spells: string[]; favorites: string[] }[] = [
  { level: 11, spellLevel: 6,
    spells: ids('Mass Suggestion', 'True Seeing', "Heroes' Feast", 'Eyebite', 'Globe of Invulnerability', 'Guards and Wards', 'Magic Jar'),
    favorites: ids('Mass Suggestion', 'True Seeing', "Heroes' Feast", 'Magic Jar') },
  { level: 13, spellLevel: 7,
    spells: ids('Etherealness', 'Forcecage', 'Plane Shift', 'Project Image', 'Sequester', 'Teleport', 'Crown of Stars'),
    favorites: ids('Project Image', 'Teleport', 'Plane Shift', 'Sequester') },
  { level: 15, spellLevel: 8,
    spells: ids('Antimagic Field', 'Dominate Monster', 'Feeblemind', 'Glibness', 'Maze', 'Mind Blank', 'Power Word Stun'),
    favorites: ids('Glibness', 'Mind Blank') },
  { level: 17, spellLevel: 9,
    spells: ids('Foresight', 'Gate', 'Imprisonment', 'Power Word Kill', 'Psychic Scream', 'True Polymorph', 'Weird'),
    favorites: ids('Foresight') },
];

/** Each Bound Spirit's bonus spells: known only while that spirit is bound, not counted against spells known. */
export type SpiritSpells = { 1: string[]; 5: string[]; 10: string[]; 15: string[]; 20: string[] };

export const SPIRIT_SPELLS: Record<string, SpiritSpells> = {
  genghis_khan: { 1: ids('Longstrider', "Hunter's Mark"), 5: ids('Phantom Steed', 'Haste'), 10: ids('Swift Quiver', 'Commune with Nature'), 15: ids('Wind Walk'), 20: ids('Foresight') },
  stalin:       { 1: ids('Command', 'Cause Fear'), 5: ids('Fear', 'Animate Dead'), 10: ids('Geas', 'Modify Memory'), 15: ids('Finger of Death'), 20: ids('Power Word Kill') },
  hannibal:     { 1: ids('Longstrider', 'Fog Cloud'), 5: ids('Pass without Trace', 'Nondetection'), 10: ids('Freedom of Movement', 'Mislead'), 15: ids('Reverse Gravity'), 20: ids('Foresight') },
  napoleon:     { 1: ids('Command', 'Heroism'), 5: ids('Sending', 'Haste'), 10: ids('Scrying', 'Wall of Force'), 15: ids('Forcecage'), 20: ids('Meteor Swarm') },
  alexander:    { 1: ids('Heroism', 'Longstrider'), 5: ids('Haste', 'Phantom Steed'), 10: ids('Dominate Person', 'Steel Wind Strike'), 15: ids('Conjure Celestial'), 20: ids('Shapechange') },
  odysseus:     { 1: ids('Disguise Self', 'Silent Image'), 5: ids('Suggestion', 'Major Image'), 10: ids('Modify Memory', 'Mislead'), 15: ids('Project Image'), 20: ids('Foresight') },
  caesar:       { 1: ids('Command', 'Heroism'), 5: ids('Sending', 'Tongues'), 10: ids('Geas', 'Legend Lore'), 15: ids('Teleport'), 20: ids('Foresight') },
  saladin:      { 1: ids('Protection from Evil and Good', 'Heroism'), 5: ids('Beacon of Hope', 'Aura of Vitality'), 10: ids('Greater Restoration', 'Circle of Power'), 15: ids('Holy Aura'), 20: ids('Mass Heal') },
  montezuma:    { 1: ids('Entangle', "Hunter's Mark"), 5: ids('Plant Growth', 'Conjure Animals'), 10: ids('Commune with Nature', 'Insect Plague'), 15: ids('Animal Shapes'), 20: ids('Shapechange') },
  david:        { 1: ids('Shield of Faith', 'Heroism'), 5: ids("Crusader's Mantle", 'Spirit Guardians'), 10: ids('Wall of Stone', 'Greater Restoration'), 15: ids('Temple of the Gods'), 20: ids('Invulnerability') },
  sun_tzu:      { 1: ids('Fog Cloud', 'Silent Image'), 5: ids('Pass without Trace', 'Clairvoyance'), 10: ids('Mislead', 'Scrying'), 15: ids('Project Image'), 20: ids('Foresight') },
  joan:         { 1: ids('Heroism', 'Bless'), 5: ids('Beacon of Hope', "Crusader's Mantle"), 10: ids('Circle of Power', 'Greater Restoration'), 15: ids('Holy Aura'), 20: ids('Mass Heal') },
};

/** Spell ids (class list, Arcanum choices and spirit spells) — everything the class refers to. */
export const ALL_EMPEROR_SPELL_IDS: string[] = [...new Set([
  ...EMPEROR_CLASS_SPELLS,
  ...LEGACY_ARCANUM.flatMap(a => a.spells),
  ...Object.values(SPIRIT_SPELLS).flatMap(s => Object.values(s).flat()),
])];
