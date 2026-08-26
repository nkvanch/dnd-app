// src/content/classes/classBrowse.ts
// Helpers that derive the three browse layers from existing class data:
//   Layer 1 — Class Summary metadata (role, complexity, playstyle, …)
//   Layer 2 — Feature list (extracted from the progression's feature grants)
//   Layer 3 — Level progression table (level → feature names)
//
// Layers 2 & 3 are derived entirely from getProgressionForClass(), so they work
// for official AND homebrew classes with no extra authoring. Layer 1 metadata is
// optional enrichment (CLASS_META below); classes without an entry fall back to
// sensible defaults derived from their hit die and spellcasting config.
import { CharClass, Feature, Ability } from '../../engine/types';
import { getProgressionForClass } from './progressions';

// ── Layer 1: Class Summary metadata ─────────────────────────────────────────────

export type Complexity = 'Easy' | 'Moderate' | 'Complex';

export type ClassMeta = {
  role:          string;       // e.g. 'Frontline Tank'
  primaryAbility: Ability;     // main ability score
  shortDescription: string;
  keyMechanics:  string[];     // headline mechanics, e.g. ['Rage', 'Reckless Attack']
  playstyle:     string;
  complexity:    Complexity;
  recommendation?: string;     // build advice: ability priority + suggested background
};

// Hand-authored summaries for official classes. Homebrew / unlisted classes get
// a derived fallback (see classMeta()).
export const CLASS_META: Record<string, ClassMeta> = {
  barbarian: {
    role: 'Frontline Tank',
    primaryAbility: 'str',
    shortDescription: 'A relentless warrior fueled by primal rage, capable of absorbing punishment and dealing devastating melee damage.',
    keyMechanics: ['Rage', 'Reckless Attack', 'Danger Sense', 'Brutal Critical'],
    playstyle: 'High durability, aggressive melee combat, simple resource management.',
    complexity: 'Easy',
    recommendation: 'Make Strength your highest ability score, followed by Constitution, then Dexterity. The Outlander background suits a barbarian well.',
  },
  fighter: {
    role: 'Martial Striker / Defender',
    primaryAbility: 'str',
    shortDescription: 'A master of weapons and armor who adapts to any combat role through fighting styles and relentless attacks.',
    keyMechanics: ['Fighting Style', 'Second Wind', 'Action Surge', 'Extra Attack'],
    playstyle: 'Flexible weapon combat with the most attacks per turn of any class.',
    complexity: 'Easy',
    recommendation: 'Make Strength (or Dexterity for a finesse build) your highest score, then Constitution. The Soldier background fits most fighters.',
  },
  rogue: {
    role: 'Skirmisher / Skill Expert',
    primaryAbility: 'dex',
    shortDescription: 'A nimble scoundrel who strikes from the shadows, excels at skills, and avoids danger with uncanny reflexes.',
    keyMechanics: ['Sneak Attack', 'Cunning Action', 'Uncanny Dodge', 'Evasion'],
    playstyle: 'Burst single-target damage, mobility, and out-of-combat utility.',
    complexity: 'Moderate',
    recommendation: 'Make Dexterity your highest ability score, followed by Constitution, then Charisma or Wisdom. The Criminal background suits a rogue well.',
  },
  wizard: {
    role: 'Arcane Controller',
    primaryAbility: 'int',
    shortDescription: 'A scholarly spellcaster with the broadest spell list in the game, shaping the battlefield with arcane power.',
    keyMechanics: ['Spellcasting', 'Arcane Recovery', 'Spellbook', 'Arcane Tradition'],
    playstyle: 'Versatile, prepares spells daily; powerful but fragile.',
    complexity: 'Complex',
    recommendation: 'Make Intelligence your highest ability score, followed by Constitution, then Dexterity. The Sage background fits a wizard.',
  },
  cleric: {
    role: 'Divine Support / Healer',
    primaryAbility: 'wis',
    shortDescription: 'A divine agent who heals allies, smites foes, and channels the power of a deity through domain magic.',
    keyMechanics: ['Spellcasting', 'Channel Divinity', 'Divine Domain', 'Destroy Undead'],
    playstyle: 'Flexible support with strong healing and situational damage.',
    complexity: 'Moderate',
    recommendation: 'Make Wisdom your highest ability score, followed by Constitution, then Strength. The Acolyte background suits a cleric.',
  },
  ranger: {
    role: 'Martial / Nature Half-Caster',
    primaryAbility: 'dex',
    shortDescription: 'A wilderness warrior blending weapon skill with nature magic and unmatched tracking ability.',
    keyMechanics: ['Favored Enemy', 'Natural Explorer', 'Spellcasting', 'Extra Attack'],
    playstyle: 'Ranged or two-weapon combat with utility spells.',
    complexity: 'Moderate',
    recommendation: 'Make Dexterity your highest ability score, followed by Wisdom, then Constitution. The Outlander background suits a ranger.',
  },
  paladin: {
    role: 'Divine Frontline Striker',
    primaryAbility: 'str',
    shortDescription: 'A holy warrior bound by an oath, channeling divine power into devastating smites and protective auras.',
    keyMechanics: ['Divine Smite', 'Lay on Hands', 'Auras', 'Spellcasting'],
    playstyle: 'Durable melee with burst radiant damage and party support.',
    complexity: 'Moderate',
    recommendation: 'Make Strength your highest ability score, followed by Charisma, then Constitution. The Noble background suits a paladin.',
  },
  sorcerer: {
    role: 'Arcane Blaster',
    primaryAbility: 'cha',
    shortDescription: 'An innate spellcaster who bends magic with Metamagic, drawing power from a magical bloodline.',
    keyMechanics: ['Spellcasting', 'Sorcery Points', 'Metamagic', 'Sorcerous Origin'],
    playstyle: 'Focused spell list with flexible, on-the-fly spell modification.',
    complexity: 'Complex',
    recommendation: 'Make Charisma your highest ability score, followed by Constitution, then Dexterity. The Hermit background suits a sorcerer.',
  },
  warlock: {
    role: 'Arcane Striker',
    primaryAbility: 'cha',
    shortDescription: 'A wielder of eldritch power granted by an otherworldly patron, recharging spell slots on a short rest.',
    keyMechanics: ['Pact Magic', 'Eldritch Invocations', 'Pact Boon', 'Eldritch Blast'],
    playstyle: 'Few but powerful spell slots, reliable at-will damage.',
    complexity: 'Moderate',
    recommendation: 'Make Charisma your highest ability score, followed by Constitution, then Dexterity. The Charlatan background suits a warlock.',
  },
  bard: {
    role: 'Support / Face',
    primaryAbility: 'cha',
    shortDescription: 'A versatile performer who inspires allies, dabbles in any skill, and borrows magic from every class.',
    keyMechanics: ['Spellcasting', 'Bardic Inspiration', 'Jack of All Trades', 'Expertise'],
    playstyle: 'Flexible support, social powerhouse, broad utility.',
    complexity: 'Moderate',
    recommendation: 'Make Charisma your highest ability score, followed by Dexterity, then Constitution. The Entertainer background fits a bard.',
  },
  druid: {
    role: 'Nature Caster / Shapeshifter',
    primaryAbility: 'wis',
    shortDescription: 'A guardian of nature who casts primal magic and transforms into beasts via Wild Shape.',
    keyMechanics: ['Spellcasting', 'Wild Shape', 'Druid Circle'],
    playstyle: 'Adaptable caster with a unique shapeshifting resource.',
    complexity: 'Complex',
    recommendation: 'Make Wisdom your highest ability score, followed by Constitution, then Dexterity. The Hermit background suits a druid.',
  },
  monk: {
    role: 'Mobile Skirmisher',
    primaryAbility: 'dex',
    shortDescription: 'A martial artist who channels ki for flurries of blows, supernatural mobility, and defensive tricks.',
    keyMechanics: ['Martial Arts', 'Ki', 'Unarmored Movement', 'Stunning Strike'],
    playstyle: 'Fast, mobile melee with many small attacks and control.',
    complexity: 'Complex',
    recommendation: 'Make Dexterity your highest ability score, followed by Wisdom, then Constitution. The Hermit background suits a monk.',
  },
  artificer: {
    role: 'Support / Utility Half-Caster',
    primaryAbility: 'int',
    shortDescription: 'An inventor who channels magic through tools and infusions, casting spells from level 1 and enhancing gear for the whole party.',
    keyMechanics: ['Magical Tinkering', 'Spellcasting', 'Infuse Item', 'Artificer Specialist'],
    playstyle: 'Gear-focused support and utility, with a specialist subclass shaping combat role.',
    complexity: 'Moderate',
    recommendation: 'Make Intelligence your highest ability score, followed by Constitution, then Dexterity. The Guild Artisan background suits an artificer.',
  },
};

const ABILITY_NAMES: Record<Ability, string> = {
  str: 'Strength', dex: 'Dexterity', con: 'Constitution',
  int: 'Intelligence', wis: 'Wisdom', cha: 'Charisma',
};

export function abilityFullName(a: Ability): string {
  return ABILITY_NAMES[a];
}

/**
 * Returns Layer-1 metadata for a class, falling back to derived values for
 * homebrew classes with no CLASS_META entry.
 */
export function classMeta(cls: CharClass): ClassMeta {
  const authored = CLASS_META[cls.id];
  if (authored) return authored;

  // Fallback for homebrew: derive what we can from the CharClass fields.
  const isCaster = !!cls.spellcastingAbility;
  const primary: Ability = cls.spellcastingAbility
    ?? (cls.savingThrows?.[0] ?? 'str');
  const role = isCaster
    ? 'Spellcaster'
    : cls.hitDie >= 10 ? 'Frontline Martial' : 'Martial';
  const complexity: Complexity = isCaster ? 'Complex'
    : cls.hitDie >= 12 ? 'Easy' : 'Moderate';
  // Pull a few feature names from the progression as key mechanics
  const keyMechanics = layerFeatures(cls).slice(0, 4).map(f => f.name);

  return {
    role,
    primaryAbility: primary,
    shortDescription: cls.description ?? `A ${cls.name} class.`,
    keyMechanics,
    playstyle: isCaster
      ? 'Spell-focused play with resource management.'
      : 'Weapon-focused martial combat.',
    complexity,
  };
}

// ── Layer 2: Feature list ───────────────────────────────────────────────────────

export type BrowseFeature = {
  feature: Feature;
  level:   number;
};

/**
 * Extracts every feature granted across the class's full progression, in level
 * order, de-duplicated by feature id (keeping the earliest level it appears).
 */
export function layerFeatures(cls: CharClass): Feature[] {
  const prog = getProgressionForClass(cls);
  const seen = new Set<string>();
  const out: Feature[] = [];
  for (const entry of prog.entries) {
    for (const grant of entry.grants) {
      if (grant.kind === 'feature') {
        const f = grant.value as Feature;
        if (f && f.id && !seen.has(f.id)) {
          seen.add(f.id);
          out.push(f);
        }
      }
    }
  }
  return out;
}

/** Same as layerFeatures but pairs each feature with the level it's gained. */
export function featuresByLevel(cls: CharClass): BrowseFeature[] {
  const prog = getProgressionForClass(cls);
  const seen = new Set<string>();
  const out: BrowseFeature[] = [];
  for (const entry of prog.entries) {
    for (const grant of entry.grants) {
      if (grant.kind === 'feature') {
        const f = grant.value as Feature;
        if (f && f.id && !seen.has(f.id)) {
          seen.add(f.id);
          out.push({ feature: f, level: entry.level });
        }
      }
    }
  }
  return out;
}

// ── Layer 3: Progression table ──────────────────────────────────────────────────

export type ProgressionRow = {
  level:        number;
  features:     { id: string; name: string }[];   // features gained at this level
  featureNames: string[];   // names only (kept for back-compat / simple display)
  hasASI:       boolean;    // an ability-score-improvement choice at this level
  slotSummary:  string | null; // e.g. "2 × 1st" if spell slots change here
};

/**
 * Builds the level-by-level progression table. Feature names come from feature
 * grants; ASI is detected from choices; slot summary from spell_slots grants.
 */
export function progressionTable(cls: CharClass): ProgressionRow[] {
  const prog = getProgressionForClass(cls);
  const rows: ProgressionRow[] = [];

  for (const entry of prog.entries) {
    const features: { id: string; name: string }[] = [];
    const featureNames: string[] = [];
    let slotSummary: string | null = null;

    for (const grant of entry.grants) {
      if (grant.kind === 'feature') {
        const f = grant.value as Feature;
        if (f?.name) {
          features.push({ id: f.id, name: f.name });
          featureNames.push(f.name);
        }
      } else if (grant.kind === 'spell_slots') {
        const v = grant.value as { level: number; slotsTable?: { level: number; slots: number[] }[] };
        const table = v.slotsTable;
        const row = table?.find(r => r.level === v.level)?.slots;
        if (row) {
          // Find the highest tier with slots, and how many.
          let tier = 0, count = 0;
          for (let i = row.length - 1; i >= 0; i--) {
            if (row[i] > 0) { tier = i + 1; count = row[i]; break; }
          }
          if (count > 0) slotSummary = `${count} × ${ordinal(tier)}`;
        }
      }
    }

    const hasASI = entry.choices.some(c => c.kind === 'asi');

    rows.push({ level: entry.level, features, featureNames, hasASI, slotSummary });
  }

  return rows;
}

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
