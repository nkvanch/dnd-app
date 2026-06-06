// ============================================================================
// FILE: src/engine/homebrewValidator.ts
// Validates homebrew content before it enters the content database.
// ============================================================================
import { Race, CharClass, Spell, Feature, Background } from './types';

export type ValidationResult = {
  valid:    boolean;
  warnings: string[];
  errors:   string[];
};

// ── Feature validator ─────────────────────────────────────────────────────────

function validateFeature(f: unknown, path: string): ValidationResult {
  const errors:   string[] = [];
  const warnings: string[] = [];

  if (!f || typeof f !== 'object') {
    return { valid: false, errors: [`${path}: not an object`], warnings: [] };
  }
  const feat = f as Partial<Feature>;

  if (!feat.id    || typeof feat.id    !== 'string') errors.push(`${path}.id: required string`);
  if (!feat.name  || typeof feat.name  !== 'string') errors.push(`${path}.name: required string`);
  if (!feat.source || typeof feat.source !== 'object') errors.push(`${path}.source: required`);

  const VALID_SOURCE_KINDS = new Set(['race','class','subclass','background','feat','item','spell','condition','campaign']);
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
  if (typeof spell.level !== 'number' || spell.level < 0 || spell.level > 9) {
    errors.push('level: must be 0–9');
  }
  if (typeof spell.ritual        !== 'boolean') warnings.push('ritual: missing (defaulting false)');
  if (typeof spell.concentration !== 'boolean') warnings.push('concentration: missing (defaulting false)');
  if (!Array.isArray(spell.components)) warnings.push('components: missing (defaulting [])');

  return { valid: errors.length === 0, errors, warnings };
}

// ── Generic content validator ─────────────────────────────────────────────────

export function validateContent(
  type: 'race' | 'class' | 'spell' | 'background' | 'feature',
  data: unknown
): ValidationResult {
  switch (type) {
    case 'race':       return validateRace(data);
    case 'class':      return validateClass(data);
    case 'spell':      return validateSpell(data);
    case 'background': return validateRace(data); // same shape: id + name + features[]
    case 'feature':    return validateFeature(data, 'feature');
    default:           return { valid: false, errors: [`Unknown type: ${type}`], warnings: [] };
  }
}
