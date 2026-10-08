// src/engine/featPrereq.ts
// Evaluates a feat's free-text `prerequisite` string against an entity.
//
// Prerequisites in the catalog follow a handful of recognizable shapes:
//   • Ability minimums      — "Strength 13+", "Dexterity 13+",
//                             "Intelligence or Wisdom 13+"
//   • Spellcasting          — "The ability to cast at least one spell",
//                             "Spellcasting or Pact Magic feature",
//                             "Spellcasting feature or Rune Carver background"
//   • Armor proficiency     — "Proficiency with medium armor",
//                             "Proficiency with heavy armor"
//   • Weapon proficiency    — "Proficiency with a martial weapon"
//   • Race                  — "Halfling", "Dragonborn", "Elf (drow)",
//                             "Elf or half-elf", "Half-elf, half-orc, or human",
//                             "Dwarf or a Small race"
//   • Level / feature gates — "4th level, Strike of the Giants (Fire Strike)"
//
// The evaluator is deliberately conservative: when it cannot confidently parse
// a prerequisite, it returns met:false with needsManualCheck:true so the UI can
// surface the requirement to the player (who can still "get anyway"). It never
// blocks silently and never throws.

import { Entity, Ability } from './types';
import { applyStatModifiers, collectAllEffects } from './pipeline';

export type PrereqResult = {
  met:              boolean;
  /** Human-readable explanation, e.g. "Requires Strength 13 (you have 11)." */
  reason:           string;
  /** True when the requirement couldn't be auto-verified and is shown as advisory. */
  needsManualCheck: boolean;
};

const ABILITY_WORDS: Record<string, Ability> = {
  strength: 'str', dexterity: 'dex', constitution: 'con',
  intelligence: 'int', wisdom: 'wis', charisma: 'cha',
};

const ABILITY_LABEL: Record<Ability, string> = {
  str: 'Strength', dex: 'Dexterity', con: 'Constitution',
  int: 'Intelligence', wis: 'Wisdom', cha: 'Charisma',
};

/** Effective ability scores (base + race/feat effects), matching the sheet. */
function effectiveScores(entity: Entity) {
  return applyStatModifiers(entity.stats, collectAllEffects(entity));
}

/** Does the entity have any spellcasting capability? */
function canCastSpells(entity: Entity): boolean {
  if (entity.spellcasting) return true;
  // Some casters gain it via a feature even before the block initialises.
  return entity.features.some(f =>
    /spellcasting|pact magic/i.test(f.name) ||
    f.effects?.some(e => e.type === 'grant_spell'),
  );
}

function hasArmorProf(entity: Entity, weight: 'light' | 'medium' | 'heavy'): boolean {
  return entity.proficiencies.armor.some(a => a.toLowerCase().includes(weight));
}

function hasMartialWeaponProf(entity: Entity): boolean {
  return entity.proficiencies.weapons.some(w => w.toLowerCase().includes('martial'));
}

/** Normalises a race/subrace id like "wood_elf" -> "wood elf" for matching. */
function raceWords(entity: Entity): string[] {
  return [entity.identity.raceId, entity.identity.subRaceId ?? '']
    .filter(Boolean)
    .map(s => s.replace(/_/g, ' ').toLowerCase());
}

/**
 * Evaluates a single prerequisite string. Returns met:true with an empty reason
 * when there is no prerequisite (null/empty).
 */
export function evaluatePrerequisite(entity: Entity, prereq: string | null): PrereqResult {
  if (!prereq || prereq.trim() === '') {
    return { met: true, reason: '', needsManualCheck: false };
  }

  const text = prereq.trim();
  const lower = text.toLowerCase();

  // -- 2024 style: "Level 4+" alone or combined, "Level 4+, Strength or Dexterity 13+" --
  // Every comma-separated part must hold; the first unmet one is reported.
  const parts = text.split(/,\s*(?=level\s+\d|strength|dexterity|constitution|intelligence|wisdom|charisma|fighting style|spellcasting)/i);
  if (parts.length > 1 || /^level\s+\d+\+?$/i.test(text) || /fighting style feature/i.test(text)) {
    for (const part of parts) {
      const lv = /^level\s+(\d+)\+?$/i.exec(part.trim());
      if (lv) {
        const need = parseInt(lv[1], 10);
        if (entity.identity.level < need) return { met: false, reason: `Requires level ${need} or higher (you are level ${entity.identity.level}).`, needsManualCheck: false };
        continue;
      }
      if (/^fighting style feature$/i.test(part.trim())) {
        if (!entity.features.some(f => /fighting style/i.test(f.name))) return { met: false, reason: 'Requires the Fighting Style class feature.', needsManualCheck: false };
        continue;
      }
      const r = evaluatePrerequisite(entity, part.trim());
      if (!r.met) return r;
    }
    return { met: true, reason: '', needsManualCheck: false };
  }

  // -- Ability minimums, possibly with "X or Y NN+" --
  // Matches "Strength 13+", "Dexterity 13", "Intelligence or Wisdom 13+".
  const abilityMatch = lower.match(/((?:strength|dexterity|constitution|intelligence|wisdom|charisma)(?:\s+or\s+(?:strength|dexterity|constitution|intelligence|wisdom|charisma))*)\s+(\d+)\+?/);
  if (abilityMatch) {
    const threshold = parseInt(abilityMatch[2], 10);
    const abilNames = abilityMatch[1].split(/\s+or\s+/).map(s => s.trim());
    const scores    = effectiveScores(entity);
    const options   = abilNames
      .map(n => ABILITY_WORDS[n])
      .filter(Boolean) as Ability[];
    const met = options.some(ab => scores[ab] >= threshold);
    if (met) return { met: true, reason: '', needsManualCheck: false };
    const detail = options
      .map(ab => `${ABILITY_LABEL[ab]} ${scores[ab]}`)
      .join(', ');
    const want = options.map(ab => ABILITY_LABEL[ab]).join(' or ');
    return {
      met: false,
      reason: `Requires ${want} ${threshold}+ (you have ${detail}).`,
      needsManualCheck: false,
    };
  }

  // -- Spellcasting / pact magic --
  if (/cast at least one spell|spellcasting|pact magic/.test(lower)) {
    if (canCastSpells(entity)) return { met: true, reason: '', needsManualCheck: false };
    // "Spellcasting feature or Rune Carver background" -- the background half
    // can't be auto-checked reliably, so mark advisory rather than a hard fail.
    const hasBackgroundAlt = /background/.test(lower);
    return {
      met: false,
      reason: hasBackgroundAlt
        ? 'Requires a spellcasting/pact feature (or the named background - check manually).'
        : 'Requires the ability to cast at least one spell.',
      needsManualCheck: hasBackgroundAlt,
    };
  }

  // -- Armor proficiency --
  const armorMatch = lower.match(/proficiency with (light|medium|heavy) armor/);
  if (armorMatch) {
    const weight = armorMatch[1] as 'light' | 'medium' | 'heavy';
    if (hasArmorProf(entity, weight)) return { met: true, reason: '', needsManualCheck: false };
    return {
      met: false,
      reason: `Requires proficiency with ${weight} armor.`,
      needsManualCheck: false,
    };
  }

  // -- Martial weapon proficiency (possibly with a background alternative) --
  if (/proficiency with a martial weapon/.test(lower)) {
    if (hasMartialWeaponProf(entity)) return { met: true, reason: '', needsManualCheck: false };
    const hasAlt = /background/.test(lower);
    return {
      met: false,
      reason: hasAlt
        ? 'Requires martial-weapon proficiency (or the named background - check manually).'
        : 'Requires proficiency with a martial weapon.',
      needsManualCheck: hasAlt,
    };
  }

  // -- Level gates (e.g. "4th level, Strike of the Giants (Fire Strike)") --
  const levelMatch = lower.match(/(\d+)(?:st|nd|rd|th)\s+level/);
  if (levelMatch) {
    const reqLevel = parseInt(levelMatch[1], 10);
    const metLevel = entity.identity.level >= reqLevel;
    // These also name a feature gate we can't verify; always advisory.
    return {
      met: false,
      reason: metLevel
        ? `You meet the level requirement, but this also needs: ${text}. Verify the feature prerequisite.`
        : `Requires ${text}.`,
      needsManualCheck: true,
    };
  }

  // -- Race gates --
  // The prerequisite is a race/subrace phrase. Try to match any listed race
  // token against the entity's race/subrace ids.
  const races = raceWords(entity);
  // Split on "or"/commas, strip parentheticals like "Elf (drow)" -> "elf", "drow".
  const tokens = lower
    .replace(/\bor\b/g, ',')
    .split(',')
    .map(s => s.trim())
    .flatMap(s => {
      const paren = s.match(/^(.*?)\s*\((.*?)\)\s*$/);
      if (paren) return [paren[1].trim(), paren[2].trim()];
      return [s];
    })
    .filter(Boolean)
    // Drop filler words.
    .filter(s => !['a', 'an', 'the', 'small', 'race'].includes(s));

  if (tokens.length > 0) {
    // Bug fix (architecture review E4): this used to be a bidirectional
    // substring match (`r.includes(tok) || tok.includes(r)`), which matches
    // any race whose name is a substring of another — e.g. a plain Elf
    // satisfied a "Half-Elf, Half-Orc, or Human" prerequisite, since
    // "half-elf".includes("elf"). Normalize hyphens to spaces (matching
    // raceWords' own underscore-to-space normalization) and require an
    // exact match instead.
    const met = tokens.some(tok => {
      const normTok = tok.replace(/-/g, ' ').trim();
      return races.some(r => r === normTok);
    });
    if (met) return { met: true, reason: '', needsManualCheck: false };
    // "Dwarf or a Small race" has a size clause we can't verify from race id.
    const hasSizeClause = /small race/.test(lower);
    return {
      met: false,
      reason: hasSizeClause
        ? `Requires: ${text}. (Size requirement can't be auto-checked.)`
        : `Requires race: ${text}.`,
      needsManualCheck: hasSizeClause,
    };
  }

  // -- Fallback - unparseable prerequisite, surface as advisory --
  return {
    met: false,
    reason: `Has a prerequisite: ${text}. Verify it applies to your character.`,
    needsManualCheck: true,
  };
}
