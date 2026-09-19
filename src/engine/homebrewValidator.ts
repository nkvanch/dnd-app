// ============================================================================
// FILE: src/engine/homebrewValidator.ts
// Validates homebrew content before it enters the content database.
// ============================================================================
import { Race, CharClass, Spell, Feature, Background, Feat, HomebrewSubclass, Item } from './types';
import { MonsterTemplate } from '../content/monsters/types';
import { validateEntityDeep } from './entityValidation';

export type ValidationResult = {
  valid:    boolean;
  warnings: string[];
  errors:   string[];
};

// ── Feature validator ─────────────────────────────────────────────────────────

export function validateFeature(f: unknown, path: string): ValidationResult {
  const errors:   string[] = [];
  const warnings: string[] = [];

  if (!f || typeof f !== 'object') {
    return { valid: false, errors: [`${path}: not an object`], warnings: [] };
  }
  const feat = f as Partial<Feature>;

  if (!feat.id    || typeof feat.id    !== 'string') errors.push(`${path}.id: required string`);
  if (!feat.name  || typeof feat.name  !== 'string') errors.push(`${path}.name: required string`);
  if (!feat.source || typeof feat.source !== 'object') errors.push(`${path}.source: required`);

  const VALID_SOURCE_KINDS = new Set(['race','class','subclass','background','feat','item','spell','condition','campaign','manual']);
  if (feat.source && !VALID_SOURCE_KINDS.has((feat.source as any).kind)) {
    warnings.push(`${path}.source.kind: "${(feat.source as any).kind}" is not a known kind`);
  }

  if (!Array.isArray(feat.effects))  errors.push(`${path}.effects: must be an array`);
  if (!Array.isArray(feat.actions))  warnings.push(`${path}.actions: missing (using [])`);
  if (!Array.isArray(feat.choices))  warnings.push(`${path}.choices: missing (using [])`);

  // Validate each effect
  if (Array.isArray(feat.effects)) {
    const VALID_EFFECT_TYPES = new Set([
      'stat_modifier','grant_proficiency','grant_resistance','grant_immunity',
      'apply_condition','grant_resource','override_rule','base_ac_formula',
      'suppress_condition_effects','condition_immunity',
    ]);
    for (const [i, e] of feat.effects.entries()) {
      if (!VALID_EFFECT_TYPES.has((e as any).type)) {
        warnings.push(`${path}.effects[${i}].type: "${(e as any).type}" is not a known effect type`);
      }
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

// ── Race validator ────────────────────────────────────────────────────────────

export function validateRace(data: unknown): ValidationResult {
  const errors:   string[] = [];
  const warnings: string[] = [];

  if (!data || typeof data !== 'object') {
    return { valid: false, errors: ['Root: not an object'], warnings: [] };
  }
  const race = data as Partial<Race>;

  if (!race.id   || typeof race.id   !== 'string') errors.push('id: required string');
  if (!race.name || typeof race.name !== 'string') errors.push('name: required string');
  if (!Array.isArray(race.features)) {
    errors.push('features: must be an array');
  } else {
    for (const [i, f] of race.features.entries()) {
      const r = validateFeature(f, `features[${i}]`);
      errors.push(...r.errors);
      warnings.push(...r.warnings);
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

// ── Class validator ───────────────────────────────────────────────────────────

export function validateClass(data: unknown): ValidationResult {
  const errors:   string[] = [];
  const warnings: string[] = [];

  if (!data || typeof data !== 'object') {
    return { valid: false, errors: ['Root: not an object'], warnings: [] };
  }
  const cls = data as Partial<CharClass>;

  if (!cls.id     || typeof cls.id     !== 'string') errors.push('id: required string');
  if (!cls.name   || typeof cls.name   !== 'string') errors.push('name: required string');
  if (typeof cls.hitDie !== 'number' || ![4,6,8,10,12].includes(cls.hitDie)) {
    errors.push('hitDie: must be 4, 6, 8, 10, or 12');
  }
  if (!Array.isArray(cls.features)) errors.push('features: must be an array');

  return { valid: errors.length === 0, errors, warnings };
}

// ── Spell validator ───────────────────────────────────────────────────────────

export function validateSpell(data: unknown): ValidationResult {
  const errors:   string[] = [];
  const warnings: string[] = [];

  if (!data || typeof data !== 'object') {
    return { valid: false, errors: ['Root: not an object'], warnings: [] };
  }
  const spell = data as Partial<Spell>;

  if (!spell.id          || typeof spell.id          !== 'string') errors.push('id: required string');
  if (!spell.name        || typeof spell.name        !== 'string') errors.push('name: required string');
  if (!spell.school      || typeof spell.school      !== 'string') errors.push('school: required string');
  if (!spell.castingTime || typeof spell.castingTime !== 'string') errors.push('castingTime: required string');
  if (!spell.range       || typeof spell.range       !== 'string') errors.push('range: required string');
  if (!spell.duration    || typeof spell.duration    !== 'string') errors.push('duration: required string');
  if (!spell.description || typeof spell.description !== 'string') errors.push('description: required string');
  if (typeof spell.level !== 'number' || spell.level < 0 || !Number.isInteger(spell.level)) {
    errors.push('level: must be a whole number, 0 or higher');
  } else if (spell.level > 9) {
    warnings.push('level: beyond 9 has no spell-slot tier to consume from (will display correctly, but can\'t be tracked as "slots remaining")');
  }
  if (typeof spell.ritual        !== 'boolean') warnings.push('ritual: missing (defaulting false)');
  if (typeof spell.concentration !== 'boolean') warnings.push('concentration: missing (defaulting false)');
  if (!Array.isArray(spell.components)) warnings.push('components: missing (defaulting [])');

  return { valid: errors.length === 0, errors, warnings };
}

// ── Feat validator ────────────────────────────────────────────────────────────

export function validateFeat(data: unknown): ValidationResult {
  const errors:   string[] = [];
  const warnings: string[] = [];

  if (!data || typeof data !== 'object') {
    return { valid: false, errors: ['Root: not an object'], warnings: [] };
  }
  const feat = data as Partial<Feat>;

  if (!feat.id          || typeof feat.id          !== 'string') errors.push('id: required string');
  if (!feat.name        || typeof feat.name        !== 'string') errors.push('name: required string');
  if (!feat.description || typeof feat.description !== 'string') errors.push('description: required string');
  if (!feat.feature || typeof feat.feature !== 'object') {
    errors.push('feature: required object');
  } else {
    const r = validateFeature(feat.feature, 'feature');
    errors.push(...r.errors);
    warnings.push(...r.warnings);
  }

  if (feat.abilityChoice) {
    if (!Array.isArray(feat.abilityChoice.options) || feat.abilityChoice.options.length === 0) {
      errors.push('abilityChoice.options: must be a non-empty array');
    }
    if (typeof feat.abilityChoice.amount !== 'number' || feat.abilityChoice.amount <= 0) {
      errors.push('abilityChoice.amount: must be a positive number');
    }
  }
  if (feat.skillChoice) {
    if (!Array.isArray(feat.skillChoice.picks) || feat.skillChoice.picks.length === 0) {
      errors.push('skillChoice.picks: must be a non-empty array');
    } else {
      for (const [i, p] of feat.skillChoice.picks.entries()) {
        if (!p.id || !p.label) errors.push(`skillChoice.picks[${i}]: id and label are required`);
        if (p.mode !== 'proficiency' && p.mode !== 'expertise') errors.push(`skillChoice.picks[${i}].mode: must be "proficiency" or "expertise"`);
        if (p.from !== 'any' && p.from !== 'proficient') errors.push(`skillChoice.picks[${i}].from: must be "any" or "proficient"`);
      }
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

// ── Subclass validator ────────────────────────────────────────────────────────
// HomebrewSubclass = ClassProgression & {id, name} — a genuinely different
// shape from CharClass (classId + entries[], not id/hitDie/features[]), so
// this can't reuse validateClass the way background/condition reuse
// validateRace.

export function validateSubclass(data: unknown): ValidationResult {
  const errors:   string[] = [];
  const warnings: string[] = [];

  if (!data || typeof data !== 'object') {
    return { valid: false, errors: ['Root: not an object'], warnings: [] };
  }
  const sub = data as Partial<HomebrewSubclass>;

  if (!sub.id      || typeof sub.id      !== 'string') errors.push('id: required string');
  if (!sub.name    || typeof sub.name    !== 'string') errors.push('name: required string');
  if (!sub.classId || typeof sub.classId !== 'string') errors.push('classId: required string');
  if (!Array.isArray(sub.entries)) {
    errors.push('entries: must be an array');
  } else {
    for (const [i, entry] of sub.entries.entries()) {
      if (typeof entry.level !== 'number') errors.push(`entries[${i}].level: required number`);
      if (!Array.isArray(entry.grants))  warnings.push(`entries[${i}].grants: missing (using [])`);
      if (!Array.isArray(entry.choices)) warnings.push(`entries[${i}].choices: missing (using [])`);
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

// ── Item validator ────────────────────────────────────────────────────────────

export function validateItem(data: unknown): ValidationResult {
  const errors:   string[] = [];
  const warnings: string[] = [];

  if (!data || typeof data !== 'object') {
    return { valid: false, errors: ['Root: not an object'], warnings: [] };
  }
  const item = data as Partial<Item>;

  if (!item.id   || typeof item.id   !== 'string') errors.push('id: required string');
  if (!item.name || typeof item.name !== 'string') errors.push('name: required string');
  if (!Array.isArray(item.features)) {
    errors.push('features: must be an array');
  } else {
    for (const [i, f] of item.features.entries()) {
      const r = validateFeature(f, `features[${i}]`);
      errors.push(...r.errors);
      warnings.push(...r.warnings);
    }
  }
  if (typeof item.weight !== 'number') warnings.push('weight: missing (using 0)');
  if (typeof item.cost   !== 'string') warnings.push('cost: missing (using "")');
  if (!Array.isArray(item.properties)) warnings.push('properties: missing (using [])');

  return { valid: errors.length === 0, errors, warnings };
}

// ── Monster validator ─────────────────────────────────────────────────────────

export function validateMonster(data: unknown): ValidationResult {
  const errors:   string[] = [];
  const warnings: string[] = [];

  if (!data || typeof data !== 'object') {
    return { valid: false, errors: ['Root: not an object'], warnings: [] };
  }
  const m = data as Partial<MonsterTemplate>;

  if (!m.id        || typeof m.id        !== 'string') errors.push('id: required string');
  if (!m.name      || typeof m.name      !== 'string') errors.push('name: required string');
  if (typeof m.cr !== 'number' || m.cr < 0) errors.push('cr: must be a number, 0 or higher');
  if (!m.size      || typeof m.size      !== 'string') errors.push('size: required string');
  if (!m.type      || typeof m.type      !== 'string') errors.push('type: required string');
  if (!m.alignment || typeof m.alignment !== 'string') errors.push('alignment: required string');

  const abilities: (keyof MonsterTemplate['stats'])[] = ['str','dex','con','int','wis','cha'];
  if (!m.stats || typeof m.stats !== 'object') {
    errors.push('stats: required object');
  } else {
    for (const a of abilities) {
      const v = m.stats[a];
      if (typeof v !== 'number') errors.push(`stats.${a}: required number`);
      else if (v < 1 || v > 30) warnings.push(`stats.${a}: ${v} is outside the usual 1-30 range`);
    }
  }

  if (!m.hp || typeof m.hp.dice !== 'string' || !m.hp.dice.trim()) errors.push('hp.dice: required string');
  else if (!/^\d+d\d+([+-]\d+)?$/.test(m.hp.dice.trim())) warnings.push(`hp.dice: "${m.hp.dice}" doesn't look like a dice expression (e.g. "2d6+2")`);
  if (!m.hp || typeof m.hp.average !== 'number' || m.hp.average <= 0) errors.push('hp.average: must be a positive number');

  if (!m.ac || typeof m.ac.value !== 'number' || m.ac.value <= 0) errors.push('ac.value: must be a positive number');

  if (typeof m.speed !== 'number' || m.speed < 0) errors.push('speed: must be a number, 0 or higher');
  if (!Array.isArray(m.features)) warnings.push('features: missing (using [])');

  return { valid: errors.length === 0, errors, warnings };
}

// ── Generic content validator ─────────────────────────────────────────────────

export function validateContent(
  type: 'race' | 'subrace' | 'class' | 'subclass' | 'spell' | 'background'
      | 'feature' | 'feat' | 'item' | 'monster' | 'condition',
  data: unknown
): ValidationResult {
  switch (type) {
    case 'race':       return validateRace(data);
    case 'subrace':    return validateRace(data); // same shape: id + name + features[]
    case 'class':      return validateClass(data);
    case 'subclass':   return validateSubclass(data);
    case 'spell':      return validateSpell(data);
    case 'background': return validateRace(data); // same shape: id + name + features[]
    case 'condition':  return validateRace(data); // same shape: id + name + features[]
    case 'feature':    return validateFeature(data, 'feature');
    case 'feat':       return validateFeat(data);
    case 'item':       return validateItem(data);
    case 'monster':    return validateMonster(data);
    default:           return { valid: false, errors: [`Unknown type: ${type}`], warnings: [] };
  }
}

// Canonical structural validation lives in entityValidation.ts so every
// persistence/import boundary shares one deep definition of a safe Entity.
export function validateEntityShape(raw: unknown): ValidationResult {
  return validateEntityDeep(raw);
}
