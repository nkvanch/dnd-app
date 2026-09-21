import type { ValidationResult } from './homebrewValidator';

const LIMITS = {
  maxDepth: 32,
  maxNodes: 100_000,
  maxArray: 10_000,
  maxString: 100_000,
  maxFeatures: 5_000,
  maxResources: 5_000,
  maxEntitlements: 20_000,
  maxInventory: 20_000,
  maxChoices: 10_000,
} as const;

const ABILITIES = new Set(['str', 'dex', 'con', 'int', 'wis', 'cha']);
const ENTITY_KINDS = new Set(['character', 'monster', 'npc']);
const ENTITLEMENT_KINDS = new Set([
  'skill_proficiency', 'skill_expertise', 'tool_proficiency', 'armor_proficiency',
  'weapon_proficiency', 'language', 'spell_access', 'cantrip_access',
  'resource_grant', 'resource_upgrade',
]);
const SOURCE_KINDS = new Set([
  'race', 'class', 'subclass', 'background', 'feat', 'feature', 'item',
  'spell', 'condition', 'campaign', 'manual', 'legacy',
]);

type Obj = Record<string, unknown>;
const object = (v: unknown): v is Obj => !!v && typeof v === 'object' && !Array.isArray(v);
const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const string = (v: unknown): v is string => typeof v === 'string';
const boolean = (v: unknown): v is boolean => typeof v === 'boolean';

function bounded(raw: unknown, errors: string[]) {
  let nodes = 0;
  const seen = new Set<object>();
  const visit = (value: unknown, depth: number, path: string) => {
    nodes++;
    if (nodes > LIMITS.maxNodes) { errors.push('entity: exceeds maximum structural size'); return; }
    if (depth > LIMITS.maxDepth) { errors.push(`${path}: exceeds maximum nesting depth`); return; }
    if (typeof value === 'string' && value.length > LIMITS.maxString) errors.push(`${path}: string is too long`);
    if (!value || typeof value !== 'object') return;
    if (seen.has(value)) { errors.push(`${path}: cyclic structure`); return; }
    seen.add(value);
    if (Array.isArray(value)) {
      if (value.length > LIMITS.maxArray) errors.push(`${path}: array is too large`);
      for (let i = 0; i < Math.min(value.length, LIMITS.maxArray + 1); i++) visit(value[i], depth + 1, `${path}[${i}]`);
    } else {
      for (const [key, child] of Object.entries(value)) visit(child, depth + 1, path ? `${path}.${key}` : key);
    }
    seen.delete(value);
  };
  visit(raw, 0, 'entity');
}

function requiredArray(parent: Obj, key: string, errors: string[]): unknown[] | null {
  if (!Array.isArray(parent[key])) { errors.push(`${key}: required array`); return null; }
  return parent[key] as unknown[];
}

function validateChoiceDefinition(raw: unknown, path: string, errors: string[]) {
  if (!object(raw) || !string(raw.id) || !string(raw.prompt) || !string(raw.kind)
    || !finite(raw.count) || raw.count < 1 || !Array.isArray(raw.grants)
    || !boolean(raw.required) || !boolean(raw.resolved)
    || !(raw.pool === 'all' || Array.isArray(raw.pool) || object(raw.pool))) {
    errors.push(`${path}: malformed choice definition`);
  }
}

function validateFeature(raw: unknown, path: string, errors: string[]) {
  if (!object(raw)) { errors.push(`${path}: must be an object`); return; }
  if (!string(raw.id) || !raw.id) errors.push(`${path}.id: required string`);
  if (!string(raw.name)) errors.push(`${path}.name: required string`);
  if (!object(raw.source) || !string(raw.source.kind) || !string(raw.source.refId)) errors.push(`${path}.source: invalid`);
  if (!Array.isArray(raw.effects)) errors.push(`${path}.effects: required array`);
  else raw.effects.forEach((effect, i) => {
    if (!object(effect) || !string(effect.type) || !string(effect.target) || !string(effect.operation)) {
      errors.push(`${path}.effects[${i}]: malformed effect`);
    } else if (effect.value !== null && effect.value !== undefined && typeof effect.value !== 'string'
      && typeof effect.value !== 'boolean' && !finite(effect.value)) {
      errors.push(`${path}.effects[${i}].value: invalid`);
    }
  });
  if (!Array.isArray(raw.actions)) errors.push(`${path}.actions: required array`);
  else raw.actions.forEach((action, i) => {
    if (!object(action) || !string(action.id) || !string(action.name) || !string(action.description))
      errors.push(`${path}.actions[${i}]: malformed action`);
  });
  if (!Array.isArray(raw.choices)) errors.push(`${path}.choices: required array`);
  else raw.choices.forEach((choice, i) => validateChoiceDefinition(choice, `${path}.choices[${i}]`, errors));
}

function validateItemInstance(raw: unknown, path: string, errors: string[]) {
  if (!object(raw)) { errors.push(`${path}: must be an object`); return; }
  if (!string(raw.itemId) || !raw.itemId) errors.push(`${path}.itemId: required string`);
  if (!finite(raw.quantity) || raw.quantity <= 0) errors.push(`${path}.quantity: must be finite and positive`);
  if (!boolean(raw.attuned)) errors.push(`${path}.attuned: required boolean`);
  if (raw.equipped !== undefined && !boolean(raw.equipped)) errors.push(`${path}.equipped: must be boolean`);
  if (!Array.isArray(raw.features)) errors.push(`${path}.features: required array`);
  else raw.features.forEach((feature, i) => validateFeature(feature, `${path}.features[${i}]`, errors));
}

function validateSlots(raw: unknown, path: string, errors: string[]) {
  if (!object(raw)) { errors.push(`${path}: required object`); return; }
  for (const [tier, pool] of Object.entries(raw)) {
    if (!/^[1-9]$/.test(tier) || !object(pool) || !finite(pool.total) || !finite(pool.used)
      || pool.total < 0 || pool.used < 0 || pool.used > pool.total) {
      errors.push(`${path}.${tier}: invalid slot pool`);
    }
  }
}

/** Canonical deep structural validator for migrated Entity data. */
export function validateEntityDeep(raw: unknown): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  bounded(raw, errors);
  if (!object(raw)) return { valid: false, errors: ['entity: not an object'], warnings };
  if (!string(raw.id) || !raw.id) errors.push('id: required string');
  if (!string(raw.kind) || !ENTITY_KINDS.has(raw.kind)) errors.push('kind: invalid');
  if (raw.rulesetId !== undefined && !string(raw.rulesetId)) errors.push('rulesetId: must be a string');

  if (!object(raw.identity)) errors.push('identity: required object');
  else {
    const identity = raw.identity;
    if (!string(identity.name)) errors.push('identity.name: required string');
    if (!finite(identity.level) || identity.level < 0) errors.push('identity.level: finite nonnegative number required');
    if (identity.classId !== undefined && identity.classId !== null && !string(identity.classId)) errors.push('identity.classId: invalid');
    if (identity.subclassId !== undefined && identity.subclassId !== null && !string(identity.subclassId)) errors.push('identity.subclassId: invalid');
    if (identity.classes !== undefined) {
      if (!Array.isArray(identity.classes)) errors.push('identity.classes: must be an array');
      else identity.classes.forEach((entry, i) => {
        if (!object(entry) || !string(entry.classId) || !finite(entry.level) || entry.level < 0
          || (entry.subclassId !== null && entry.subclassId !== undefined && !string(entry.subclassId))) {
          errors.push(`identity.classes[${i}]: malformed class entry`);
        }
      });
    }
  }

  if (!object(raw.stats)) errors.push('stats: required object');
  else for (const ability of ABILITIES) {
    const value = raw.stats[ability];
    if (!finite(value) || value < 0 || value > 100) errors.push(`stats.${ability}: finite value from 0 to 100 required`);
  }

  if (!object(raw.skills) || !object(raw.skills.skills)) errors.push('skills.skills: required object');
  else for (const [key, state] of Object.entries(raw.skills.skills)) {
    if (!object(state) || !boolean(state.trained) || !boolean(state.expertise)) errors.push(`skills.skills.${key}: invalid skill state`);
  }
  if (!object(raw.proficiencies)) errors.push('proficiencies: required object');
  else for (const key of ['savingThrows', 'armor', 'weapons', 'tools', 'languages']) {
    if (!Array.isArray(raw.proficiencies[key]) || !(raw.proficiencies[key] as unknown[]).every(string)) errors.push(`proficiencies.${key}: required string array`);
  }

  const features = requiredArray(raw, 'features', errors);
  if (features) {
    if (features.length > LIMITS.maxFeatures) errors.push('features: too many entries');
    features.forEach((feature, i) => validateFeature(feature, `features[${i}]`, errors));
  }

  if (!object(raw.derived)) errors.push('derived: required object');
  else {
    for (const key of ['proficiencyBonus', 'ac', 'initiative', 'speed', 'passivePerception', 'passiveInvestigation', 'passiveInsight'])
      if (!finite(raw.derived[key])) errors.push(`derived.${key}: finite number required`);
    if (!Array.isArray(raw.derived.attackBonuses) || !Array.isArray(raw.derived.senses) || !Array.isArray(raw.derived.advantageStates)
      || !object(raw.derived.savingThrows) || !object(raw.derived.movement) || !object(raw.derived.abilityBasedDC))
      errors.push('derived: malformed nested structure');
  }

  if (!object(raw.resources)) errors.push('resources: required object');
  else {
    const resources = raw.resources;
    if (!object(resources.hp)) errors.push('resources.hp: required object');
    else {
      const hp = resources.hp;
      if (!finite(hp.maximum) || hp.maximum < 0) errors.push('resources.hp.maximum: invalid');
      if (!finite(hp.current) || hp.current < 0 || (finite(hp.maximum) && hp.current > hp.maximum)) errors.push('resources.hp.current: invalid');
      if (!finite(hp.temp) || hp.temp < 0) errors.push('resources.hp.temp: invalid');
    }
    if (!object(resources.hitDice) || !finite(resources.hitDice.die) || !finite(resources.hitDice.total)
      || !finite(resources.hitDice.remaining) || resources.hitDice.total < 0 || resources.hitDice.remaining < 0
      || resources.hitDice.remaining > resources.hitDice.total
      || (resources.hitDice.pools !== undefined && !Array.isArray(resources.hitDice.pools)))
      errors.push('resources.hitDice: malformed');
    const custom = Array.isArray(resources.custom) ? resources.custom : null;
    if (!custom) errors.push('resources.custom: required array');
    else {
      if (custom.length > LIMITS.maxResources) errors.push('resources.custom: too many entries');
      custom.forEach((entry, i) => {
        if (!object(entry) || !string(entry.id) || !string(entry.name) || !finite(entry.current)
          || !finite(entry.maximum) || entry.current < 0 || entry.maximum < 0 || entry.current > entry.maximum
          || (entry.baseMaximum !== undefined && (!finite(entry.baseMaximum) || entry.baseMaximum < 0))
          || (entry.sourceKind !== undefined && !SOURCE_KINDS.has(entry.sourceKind as string))
          || (entry.sourceId !== undefined && !string(entry.sourceId))) {
          errors.push(`resources.custom[${i}]: malformed resource`);
        }
      });
    }
  }

  if (raw.entitlements !== undefined) {
    if (!Array.isArray(raw.entitlements)) errors.push('entitlements: must be an array');
    else {
      if (raw.entitlements.length > LIMITS.maxEntitlements) errors.push('entitlements: too many entries');
      raw.entitlements.forEach((entry, i) => {
        if (!object(entry) || !string(entry.kind) || !ENTITLEMENT_KINDS.has(entry.kind)
          || !string(entry.key) || !entry.key || !string(entry.sourceKind) || !SOURCE_KINDS.has(entry.sourceKind)
          || (entry.sourceId !== undefined && !string(entry.sourceId))
          || (entry.choiceId !== undefined && !string(entry.choiceId))
          || (entry.amount !== undefined && !finite(entry.amount))) {
          errors.push(`entitlements[${i}]: malformed entitlement`);
        }
      });
    }
  }

  if (raw.spellcasting !== null && raw.spellcasting !== undefined) {
    if (!object(raw.spellcasting)) errors.push('spellcasting: must be an object or null');
    else {
      const sc = raw.spellcasting;
      if (!string(sc.ability) || !ABILITIES.has(sc.ability)) errors.push('spellcasting.ability: invalid');
      for (const key of ['known', 'prepared', 'cantrips']) {
        if (!Array.isArray(sc[key]) || !(sc[key] as unknown[]).every(string)) errors.push(`spellcasting.${key}: required string array`);
      }
      validateSlots(sc.slots, 'spellcasting.slots', errors);
      if (sc.pactSlots !== undefined) validateSlots(sc.pactSlots, 'spellcasting.pactSlots', errors);
    }
  }

  if (!object(raw.inventory)) errors.push('inventory: required object');
  else for (const key of ['equipped', 'carried']) {
    const list = raw.inventory[key];
    if (!Array.isArray(list)) errors.push(`inventory.${key}: required array`);
    else {
      if (list.length > LIMITS.maxInventory) errors.push(`inventory.${key}: too many entries`);
      list.forEach((item, i) => validateItemInstance(item, `inventory.${key}[${i}]`, errors));
    }
  }

  if (!object(raw.conditionMonitor)) errors.push('conditionMonitor: required object');
  else {
    if (!Array.isArray(raw.conditionMonitor.active)) errors.push('conditionMonitor.active: required array');
    else {
      if (raw.conditionMonitor.active.length > LIMITS.maxArray) errors.push('conditionMonitor.active: too many entries');
      raw.conditionMonitor.active.forEach((condition, i) => {
        const path = 'conditionMonitor.active[' + i + ']';
        if (!object(condition)) { errors.push(path + ': malformed condition'); return; }
        if (!string(condition.id) || condition.id.trim().length === 0) errors.push(path + '.id: required nonempty string');
        if (!string(condition.sourceId) || condition.sourceId.trim().length === 0) errors.push(path + '.sourceId: required nonempty string');
        if (!Array.isArray(condition.suppressedBy) || !condition.suppressedBy.every(value => string(value) && value.trim().length > 0)) errors.push(path + '.suppressedBy: required nonempty string array');
        else if (condition.suppressedBy.length > LIMITS.maxArray) errors.push(path + '.suppressedBy: too many entries');
        if (condition.duration !== null) {
          const duration = condition.duration;
          const units = new Set(['rounds', 'minutes', 'hours', 'until_rest', 'permanent']);
          if (!object(duration)) errors.push(path + '.duration: must be an object or null');
          else {
            if (!string(duration.unit) || !units.has(duration.unit)) errors.push(path + '.duration.unit: invalid');
            if (!finite(duration.remaining) || !Number.isInteger(duration.remaining) || duration.remaining < 0) errors.push(path + '.duration.remaining: invalid');
            if (duration.expiresAt !== undefined && (!finite(duration.expiresAt) || !Number.isInteger(duration.expiresAt) || duration.expiresAt < 0)) errors.push(path + '.duration.expiresAt: invalid');
          }
        }
      });
    }
    if (!finite(raw.conditionMonitor.exhaustion) || raw.conditionMonitor.exhaustion < 0) errors.push('conditionMonitor.exhaustion: invalid');
    if (!object(raw.conditionMonitor.flags) || !Object.values(raw.conditionMonitor.flags).every(boolean)) errors.push('conditionMonitor.flags: boolean map required');
  }
  if (raw.characterOverrides !== undefined && !Array.isArray(raw.characterOverrides)) errors.push('characterOverrides: must be an array');
  if (raw.dmOverrides !== undefined && !Array.isArray(raw.dmOverrides)) errors.push('dmOverrides: must be an array');
  if (raw.wildShapeState !== undefined && raw.wildShapeState !== null) {
    const ws = raw.wildShapeState;
    if (!object(ws) || !boolean(ws.active) || !string(ws.formId) || !finite(ws.beastHp) || !finite(ws.beastHpMax)
      || ws.beastHp < 0 || ws.beastHpMax < 0 || ws.beastHp > ws.beastHpMax || !object(ws.expiresAt))
      errors.push('wildShapeState: malformed');
  }

  if (!Array.isArray(raw.conditions)) errors.push('conditions: required array');
  else raw.conditions.forEach((condition, i) => {
    if (!object(condition) || !string(condition.id) || !Array.isArray(condition.suppressedBy)
      || (condition.duration !== undefined && condition.duration !== null && !object(condition.duration))) {
      errors.push(`conditions[${i}]: malformed condition`);
    }
  });

  if (!Array.isArray(raw.choices)) errors.push('choices: required array');
  else {
    if (raw.choices.length > LIMITS.maxChoices) errors.push('choices: too many entries');
    raw.choices.forEach((choice, i) => {
      validateChoiceDefinition(object(choice) ? choice.definition : undefined, `choices[${i}].definition`, errors);
      if (!object(choice) || !string(choice.id) || !finite(choice.grantedAt) || !boolean(choice.resolved)
        || !Array.isArray(choice.selections) || !choice.selections.every(string) || !object(choice.definition)
        || (choice.sourceKind !== undefined && (!string(choice.sourceKind) || !SOURCE_KINDS.has(choice.sourceKind)))
        || (choice.sourceId !== undefined && !string(choice.sourceId))) {
        errors.push(`choices[${i}]: malformed choice`);
      }
    });
  }

  return { valid: errors.length === 0, errors: Array.from(new Set(errors)), warnings };
}

export { LIMITS as ENTITY_VALIDATION_LIMITS };
