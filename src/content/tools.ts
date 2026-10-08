// src/content/tools.ts
// CHOICE-EXPANSION-1: the narrowest normalized metadata layer needed to make
// Tool proficiency a real interactive choice (see TabFeatures.tsx's dispatch
// and leveling.ts's applyToolChoiceToEntity). Canonical ids — not display
// strings — are the identity; `entity.proficiencies.tools` stores these ids,
// same convention the engine's own `tool:<id>` Effect.target prefix already
// uses (pipeline.ts). Deliberately NOT ruleset-tagged — only one ruleset's
// tool list exists today; a future ruleset can add its own entries or an
// optional `rulesetId?: RulesetId` field later without changing this shape.
export type ToolCategory = 'artisan' | 'gaming_set' | 'musical_instrument' | 'other';

export type ToolDefinition = {
  id:       string;
  name:     string;
  category: ToolCategory;
};

export const ALL_TOOLS: ToolDefinition[] = [
  // Artisan's Tools
  { id: 'alchemists_supplies',   name: "Alchemist's Supplies",   category: 'artisan' },
  { id: 'brewers_supplies',      name: "Brewer's Supplies",      category: 'artisan' },
  { id: 'calligraphers_supplies', name: "Calligrapher's Supplies", category: 'artisan' },
  { id: 'carpenters_tools',      name: "Carpenter's Tools",      category: 'artisan' },
  { id: 'cartographers_tools',   name: "Cartographer's Tools",   category: 'artisan' },
  { id: 'cobblers_tools',        name: "Cobbler's Tools",        category: 'artisan' },
  { id: 'cooks_utensils',        name: "Cook's Utensils",        category: 'artisan' },
  { id: 'glassblowers_tools',    name: "Glassblower's Tools",    category: 'artisan' },
  { id: 'jewelers_tools',        name: "Jeweler's Tools",        category: 'artisan' },
  { id: 'leatherworkers_tools',  name: "Leatherworker's Tools",  category: 'artisan' },
  { id: 'masons_tools',          name: "Mason's Tools",          category: 'artisan' },
  { id: 'painters_supplies',     name: "Painter's Supplies",     category: 'artisan' },
  { id: 'potters_tools',         name: "Potter's Tools",         category: 'artisan' },
  { id: 'smiths_tools',          name: "Smith's Tools",          category: 'artisan' },
  { id: 'tinkers_tools',         name: "Tinker's Tools",         category: 'artisan' },
  { id: 'weavers_tools',         name: "Weaver's Tools",         category: 'artisan' },
  { id: 'woodcarvers_tools',     name: "Woodcarver's Tools",     category: 'artisan' },

  // Gaming Sets
  { id: 'dice_set',        name: 'Dice Set',        category: 'gaming_set' },
  { id: 'dragonchess_set', name: 'Dragonchess Set',  category: 'gaming_set' },
  { id: 'playing_card_set', name: 'Playing Card Set', category: 'gaming_set' },
  { id: 'three_dragon_ante_set', name: 'Three-Dragon Ante Set', category: 'gaming_set' },

  // Musical Instruments
  { id: 'bagpipes',  name: 'Bagpipes',  category: 'musical_instrument' },
  { id: 'drum',      name: 'Drum',      category: 'musical_instrument' },
  { id: 'dulcimer',  name: 'Dulcimer',  category: 'musical_instrument' },
  { id: 'flute',     name: 'Flute',     category: 'musical_instrument' },
  { id: 'lute',      name: 'Lute',      category: 'musical_instrument' },
  { id: 'lyre',      name: 'Lyre',      category: 'musical_instrument' },
  { id: 'horn',      name: 'Horn',      category: 'musical_instrument' },
  { id: 'pan_flute', name: 'Pan Flute', category: 'musical_instrument' },
  { id: 'shawm',     name: 'Shawm',     category: 'musical_instrument' },
  { id: 'viol',      name: 'Viol',      category: 'musical_instrument' },

  // Other
  { id: 'disguise_kit',    name: 'Disguise Kit',    category: 'other' },
  { id: 'forgery_kit',     name: 'Forgery Kit',     category: 'other' },
  { id: 'herbalism_kit',   name: 'Herbalism Kit',   category: 'other' },
  { id: 'navigators_tools', name: "Navigator's Tools", category: 'other' },
  { id: 'poisoners_kit',   name: "Poisoner's Kit",  category: 'other' },
  { id: 'thieves_tools',   name: "Thieves' Tools",  category: 'other' },
  { id: 'vehicles_land',   name: 'Vehicles (Land)', category: 'other' },
  { id: 'vehicles_water',  name: 'Vehicles (Water)', category: 'other' },
];

export function getToolById(id: string): ToolDefinition | undefined {
  return ALL_TOOLS.find(t => t.id === id);
}

export const TOOL_CATEGORY_LABELS: Record<ToolCategory, string> = {
  artisan:             "Artisan's Tools",
  gaming_set:           'Gaming Sets',
  musical_instrument:   'Musical Instruments',
  other:                'Other',
};

export const TOOL_CATEGORY_ORDER: ToolCategory[] = ['artisan', 'gaming_set', 'musical_instrument', 'other'];
