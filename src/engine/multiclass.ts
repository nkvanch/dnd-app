// src/engine/multiclass.ts
// Central helpers for reading/writing Identity.classes. Every multiclass-aware
// call site should go through these rather than touching identity.classId/
// identity.classes directly, so the legacy single-class fallback logic (for
// characters saved before this field existed, and for monster/companion/npc
// entities that never populate it) lives in exactly one place.
import { Entity, ClassLevelEntry, CharClass, asClassId, asSubclassId, EntitlementRecord, SkillName } from './types';

/**
 * Returns this entity's classes, oldest-first (index 0 = "primary"/first
 * class taken). Falls back to a single-entry array synthesized from the
 * legacy identity.classId/subclassId/level scalars when identity.classes
 * is absent or empty — true for every entity saved before multiclassing
 * existed, and for every monster/companion/npc entity (which reuse classId
 * as an unrelated template id, e.g. CompanionSection's Steel Defender).
 */
export function getClassLevels(entity: Entity): ClassLevelEntry[] {
  if (entity.identity.classes && entity.identity.classes.length > 0) {
    return entity.identity.classes;
  }
  if (!entity.identity.classId) return [];
  // identity.classId/subclassId are deliberately unbranded (see their doc
  // comment in types.ts — reused as a companion-template id for
  // monster/companion entities), so a cast is needed here to bridge into
  // the branded ClassLevelEntry shape. No behavior change: this mirrors
  // exactly what was already stored, cast, not converted.
  return [{
    classId:    asClassId(entity.identity.classId),
    subclassId: entity.identity.subclassId ? asSubclassId(entity.identity.subclassId) : null,
    level:      entity.identity.level,
  }];
}

export function isMulticlassed(entity: Entity): boolean {
  return getClassLevels(entity).length > 1;
}

export function getClassEntry(entity: Entity, classId: string): ClassLevelEntry | null {
  return getClassLevels(entity).find(c => c.classId === classId) ?? null;
}

export function hasClassId(entity: Entity, classId: string): boolean {
  return getClassLevels(entity).some(c => c.classId === classId);
}

export function totalLevelOf(classes: ClassLevelEntry[]): number {
  return classes.reduce((sum, c) => sum + c.level, 0);
}

/**
 * Re-derives identity.classId/subclassId/level from identity.classes after
 * any mutation to the array — classId/subclassId mirror classes[0] (the
 * primary class), level becomes the sum across all classes. Call this at
 * the end of every multiclass-aware mutation so every pre-existing reader
 * of the three legacy scalar fields (list screens, exports, rest.ts's non-
 * Warlock paths, etc.) keeps showing correct data without being rewritten.
 * No-op (returns entity unchanged) when identity.classes is absent, so
 * single-class code paths that never touch classes[] are unaffected.
 */
export function syncLegacyIdentity(entity: Entity): Entity {
  const classes = entity.identity.classes;
  if (!classes || classes.length === 0) return entity;
  const primary = classes[0];
  return {
    ...entity,
    identity: {
      ...entity.identity,
      classId:    primary.classId,
      subclassId: primary.subclassId,
      level:      totalLevelOf(classes),
    },
  };
}

/**
 * "Fighter 5" for a single-classed character, "Fighter 3 / Wizard 2" for a
 * multiclassed one. `resolveName` looks up a class's display name (official
 * + homebrew classes usually live in different arrays/stores, so the caller
 * supplies the lookup rather than this module importing every content
 * source).
 */
export function formatClassLabel(
  entity: Entity,
  resolveName: (classId: string) => string,
): string {
  const classes = getClassLevels(entity);
  if (classes.length <= 1) {
    const c = classes[0];
    return c ? `${resolveName(c.classId)} ${c.level}` : '';
  }
  return classes.map(c => `${resolveName(c.classId)} ${c.level}`).join(' / ');
}

/**
 * PHB "Multiclassing Proficiencies" table — what a class grants when taken
 * as a SECOND-OR-LATER class, looked up off the class's own
 * multiclassProficiencies field. Returns null (grant nothing) when absent,
 * per that field's documented conservative-default semantics.
 */
export function multiclassProficienciesFor(cls: CharClass | null | undefined) {
  return cls?.multiclassProficiencies ?? null;
}

/**
 * Migrates a just-loaded Entity to the current shape. Idempotent — safe to
 * call on an already-migrated entity. Currently handles: synthesizing
 * identity.classes for character-kind entities that predate multiclassing.
 * Call this in every entityRepo.ts read path (loadEntity, loadAllEntities),
 * never in saveEntity — every load path migrates on the way in, so by the
 * time an entity is saved it's already in the current shape.
 */
export function migrateEntity(raw: Entity): Entity {
  if (raw.kind !== 'character') return raw;
  let entity = raw;
  if (!(entity.identity.classes && entity.identity.classes.length > 0) && entity.identity.classId) {
    entity = {
      ...entity,
      identity: {
        ...entity.identity,
        classes: [{
          classId:    asClassId(entity.identity.classId),
          subclassId: entity.identity.subclassId ? asSubclassId(entity.identity.subclassId) : null,
          level:      entity.identity.level,
        }],
      },
    };
  }
  return migrateEntitlements(entity);
}

/**
 * Closure pass 2 (source ownership, section 11 — migration/backward
 * compatibility): seeds Entity.entitlements exactly once for an entity that
 * predates the field, from whatever flat proficiencies/skills it already
 * has — every value is tagged sourceKind:'manual', deliberately
 * conservative per the spec ("classify truly untraceable historical
 * entitlements as legacy/manual rather than deleting them"). A value that's
 * ACTUALLY currently granted by an active race/subclass/feat effect gets a
 * redundant manual entitlement too — harmless (recompute unions effect-
 * derived and entitlement-derived sets, so double-tagging changes nothing
 * today), and is what makes this migration safe: removing that effect's
 * source later still won't silently drop a proficiency this character had
 * before entitlements existed. Runs once — a later call is a no-op because
 * `entitlements` is already an array (even an empty one counts as
 * "migrated", so a fresh character with genuinely zero proficiencies isn't
 * re-scanned every load).
 */
function migrateEntitlements(entity: Entity): Entity {
  if (entity.entitlements) return entity;
  const records: EntitlementRecord[] = [
    ...entity.proficiencies.armor.map(key     => ({ kind: 'armor_proficiency'  as const, key, sourceKind: 'manual' as const })),
    ...entity.proficiencies.weapons.map(key   => ({ kind: 'weapon_proficiency' as const, key, sourceKind: 'manual' as const })),
    ...entity.proficiencies.tools.map(key     => ({ kind: 'tool_proficiency'   as const, key, sourceKind: 'manual' as const })),
    ...entity.proficiencies.languages.map(key => ({ kind: 'language'          as const, key, sourceKind: 'manual' as const })),
  ];
  for (const [skillName, entry] of Object.entries(entity.skills.skills) as [SkillName, { trained: boolean; expertise: boolean }][]) {
    if (entry.trained)   records.push({ kind: 'skill_proficiency', key: skillName, sourceKind: 'manual' });
    if (entry.expertise) records.push({ kind: 'skill_expertise',   key: skillName, sourceKind: 'manual' });
  }
  // Closure pass 3 (item 2): same conservative seeding for spell/cantrip
  // access — a pre-existing known spell/cantrip becomes a permanent
  // sourceKind:'manual' entitlement, so removing some unrelated source
  // later can never silently drop it, and a NEWLY applied source-owned
  // grant of the SAME spell afterward still correctly overlaps/removes
  // independently (see grantEntitlement's dedupe-by-full-record-identity).
  if (entity.spellcasting) {
    for (const key of entity.spellcasting.known)    records.push({ kind: 'spell_access',   key, sourceKind: 'manual' });
    for (const key of entity.spellcasting.cantrips) records.push({ kind: 'cantrip_access', key, sourceKind: 'manual' });
  }
  return { ...entity, entitlements: records };
}
