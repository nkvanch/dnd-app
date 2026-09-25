// ============================================================================
// FILE: src/engine/entitlements.ts
// Closure pass 2 (source ownership): the explicit, source-removable half of
// proficiency/expertise/language provenance — see EntitlementRecord's own
// doc comment (engine/types.ts) for the full model and why effect-driven
// grants deliberately stay OUT of this array.
//
// Pure functions only — no recomputeDerived call here, matching every other
// add/remove primitive in leveling.ts; the caller's simulate()/mutate()
// recomputes.
// ============================================================================
import { Entity, EntitlementRecord, EntitlementKind, EntitlementSourceKind, SkillName, Spell } from './types';
import { spellRepo } from '../content/spellRepo';
import { getClassLevels } from './multiclass';

function sameEntitlement(a: EntitlementRecord, b: EntitlementRecord): boolean {
  return a.kind === b.kind && a.key === b.key
    && a.sourceKind === b.sourceKind && a.sourceId === b.sourceId && a.choiceId === b.choiceId;
}

/** Rebuilds resource maxima from base values plus active upgrade records.
 * Spent amount is preserved and clamped; this is never a recharge. */
export function recomputeResourceMaximums(entity: Entity): Entity {
  // No dormant upgrades: historical choices do not own active contributions.
  const resourceIds = new Set(entity.resources.custom.map(r => r.id));
  const records = entity.entitlements ?? [];
  const upgrades = records.filter(e => e.kind !== 'resource_upgrade' || resourceIds.has(e.key));
  const entitlementsChanged = upgrades.length !== records.length;
  let changed = false;
  const custom = entity.resources.custom.map(resource => {
    const resourceUpgrades = upgrades.filter(e => e.kind === 'resource_upgrade' && e.key === resource.id);
    if (resourceUpgrades.length === 0 && resource.baseMaximum === undefined) return resource;
    const contributed = resourceUpgrades
      .reduce((sum, e) => sum + (e.amount ?? 0), 0);
    const baseMaximum = resource.baseMaximum ?? Math.max(0, resource.maximum - contributed);
    const maximum = Math.max(0, baseMaximum + contributed);
    const spent = Math.max(0, resource.maximum - resource.current);
    const current = Math.max(0, Math.min(maximum, maximum - spent));
    if (baseMaximum === resource.baseMaximum && maximum === resource.maximum && current === resource.current) return resource;
    changed = true;
    return { ...resource, baseMaximum, maximum, current };
  });
  if (!changed && !entitlementsChanged) return entity;
  return { ...entity,
    ...(entitlementsChanged ? { entitlements: upgrades } : {}),
    resources: changed ? { ...entity.resources, custom } : entity.resources,
  };
}

/** Appends one entitlement record, deduplicated against an identical
 *  existing one (same kind/key/source/choice) — safe to call repeatedly
 *  (e.g. re-applying a class's starting proficiencies on reselection). */
export function grantEntitlement(entity: Entity, record: EntitlementRecord): Entity {
  entity = initializeEntitlementInputs(entity);
  const existing = entity.entitlements ?? [];
  if (existing.some(e => sameEntitlement(e, record))) return entity;
  // An already-existing untracked resource is independent manual/legacy ownership.
  // Preserve that ownership before registering its first additional source.
  const baseOwner: EntitlementRecord[] = record.kind === 'resource_grant'
    && entity.resources.custom.some(r => r.id === record.key)
    && !existing.some(e => e.kind === 'resource_grant' && e.key === record.key)
    && record.sourceKind !== 'manual'
      ? [{ kind: 'resource_grant', key: record.key, sourceKind: 'manual' }] : [];
  const next = { ...entity, entitlements: [...existing, ...baseOwner, record] };
  const grants = deriveProficienciesFromEntitlements(next);
  // Eager compatibility projection for callers displaying a grant before recompute.
  // Ownership is already persisted; this projection is never read back as input.
  return { ...next,
    proficiencies: { ...next.proficiencies, armor: grants.armor, weapons: grants.weapons,
      tools: grants.tools, languages: grants.languages },
    spellcasting: next.spellcasting ? { ...next.spellcasting,
      known: grants.spells, cantrips: grants.cantrips } : null,
  };
}

export function grantEntitlements(entity: Entity, records: EntitlementRecord[]): Entity {
  return records.reduce(grantEntitlement, entity);
}

/**
 * Removes every entitlement this specific source granted — used when a
 * source (a subclass being changed, a background being swapped, a manually-
 * added feature being removed, ...) goes away. `sourceId` narrows to one
 * specific instance of that source kind (e.g. one particular subclass id);
 * omit it to remove every entitlement of that sourceKind regardless of id
 * (rarely correct — most callers should pass a specific id).
 */
export function revokeEntitlementsFromSource(
  entity: Entity, sourceKind: EntitlementSourceKind, sourceId?: string,
): Entity {
  entity = initializeEntitlementInputs(entity);
  const existing = entity.entitlements;
  if (!existing || existing.length === 0) return entity;
  const next = existing.filter(e => !(e.sourceKind === sourceKind && (sourceId === undefined || e.sourceId === sourceId)));
  if (next.length === existing.length) return entity;
  return reconcileRevokedResources(entity, next);
}

/** Removes every entitlement produced by resolving one specific choice —
 *  used when the choice's originating source is removed (see item 4: a
 *  resolved choice's grant must disappear with its origin, independent of
 *  whatever sourceKind/sourceId the entitlement itself also carries). */
export function revokeEntitlementsFromChoice(entity: Entity, choiceId: string): Entity {
  entity = initializeEntitlementInputs(entity);
  const existing = entity.entitlements;
  if (!existing || existing.length === 0) return entity;
  const next = existing.filter(e => e.choiceId !== choiceId);
  if (next.length === existing.length) return entity;
  return reconcileRevokedResources(entity, next);
}

export function hasEntitlement(entity: Entity, kind: EntitlementKind, key: string): boolean {
  return (entity.entitlements ?? []).some(e => e.kind === kind && e.key === key);
}

export type DerivedProficiencies = {
  armor:     string[];
  weapons:   string[];
  tools:     string[];
  languages: string[];
  skills: {
    trained:   Set<SkillName>;
    expertise: Set<SkillName>;
  };
  /** Closure pass 3: source-owned spell/cantrip ACCESS ids (not
   *  preparation/known-vs-prepared bookkeeping — see A14, out of scope). */
  spells:   string[];
  cantrips: string[];
};

/**
 * Pure derivation from entity.entitlements ALONE — the caller (recompute
 * Derived, pipeline.ts) unions this with the separately-tracked effect-
 * derived set from currently active source definitions to produce
 * the final flat proficiencies/skills fields. Idempotent by construction:
 * calling this twice against the same entitlements array always returns
 * the same sets, since it only ever reads, never mutates or accumulates.
 */
export function deriveProficienciesFromEntitlements(entity: Entity): DerivedProficiencies {
  const result: DerivedProficiencies = {
    armor: [], weapons: [], tools: [], languages: [], spells: [], cantrips: [],
    skills: { trained: new Set(), expertise: new Set() },
  };
  for (const e of entity.entitlements ?? []) {
    switch (e.kind) {
      case 'armor_proficiency':  if (!result.armor.includes(e.key))     result.armor.push(e.key);     break;
      case 'weapon_proficiency': if (!result.weapons.includes(e.key))   result.weapons.push(e.key);   break;
      case 'tool_proficiency':   if (!result.tools.includes(e.key))     result.tools.push(e.key);     break;
      case 'language':           if (!result.languages.includes(e.key)) result.languages.push(e.key); break;
      case 'skill_proficiency':  result.skills.trained.add(e.key as SkillName);   break;
      case 'skill_expertise':    result.skills.expertise.add(e.key as SkillName); break;
      case 'spell_access':       if (!result.spells.includes(e.key))    result.spells.push(e.key);    break;
      case 'cantrip_access':     if (!result.cantrips.includes(e.key))  result.cantrips.push(e.key);  break;
      case 'resource_grant':
      case 'resource_upgrade': break; // handled by resource ownership/reconciliation
    }
  }
  return result;
}

/**
 * Physical ownership is a surviving resource_grant record (including manual).
 * A physical resource never tracked by such a record is independent base/legacy
 * state and is preserved. baseMaximum describes capacity, not ownership.
 * resource_upgrade records never keep a resource alive.
 */
function reconcileRevokedResources(entity: Entity, next: EntitlementRecord[]): Entity {
  const previouslyOwned = new Set((entity.entitlements ?? [])
    .filter(e => e.kind === 'resource_grant').map(e => e.key));
  const stillOwned = new Set(next.filter(e => e.kind === 'resource_grant').map(e => e.key));
  const custom = entity.resources.custom.filter(r => !previouslyOwned.has(r.id) || stillOwned.has(r.id));
  return recomputeResourceMaximums({
    ...entity, entitlements: next, resources: { ...entity.resources, custom },
  });
}

/** Compatibility entry point: all source and choice revocation shares one lifecycle. */
export function revokeResourceSource(
  entity: Entity, sourceKind: EntitlementSourceKind, sourceId?: string,
): Entity {
  return revokeEntitlementsFromSource(entity, sourceKind, sourceId);
}

/**
 * Rules-engine blocker closure (prepared-spell legality, 1D — legacy/
 * migrated characters): a spell_access/cantrip_access entitlement stamped
 * sourceKind:'manual' — either by the one-time migration below (a save
 * predating the entitlement system, see the `add()` calls at the bottom of
 * initializeEntitlementInputs) or by TabSpells' addSpell BEFORE its own
 * closure-1C fix — makes isSpellPreparationLegal treat that spell as
 * permanently exempt from preparation, even when it's actually a real
 * Wizard/Cleric/Druid/Paladin/Artificer spell that should require prep.
 *
 * Reclassifies a manual spell/cantrip entitlement to sourceKind:'class' when
 * EXACTLY ONE of the character's own current classes has that spell on its
 * class spell list (Spell.classes) — the same single-candidate rule
 * addSpell now uses going forward (TabSpells.tsx); see closure 1G. Zero
 * candidates is a genuinely untraceable grant (no class list contains it at
 * all — e.g. a scroll/item grant) and is left as an ordinary, unrestricted
 * manual entry, unchanged.
 *
 * Rules-engine blocker RE-AUDIT closure (1F): 2+ candidates — a spell shared
 * by two of the character's OWN classes, where which one "owns" it can't be
 * recovered — is genuine, UNRESOLVED ambiguity, not an ordinary manual
 * grant. This is now tagged explicitly via `ambiguousClassIds` (ordinary
 * `manual` with this field absent still means exactly what it always has:
 * unrestricted, no class opinion) rather than left silently
 * indistinguishable from a true manual grant — actionCards.ts's
 * resolveSpellCastingContexts reads this field to build one REAL casting
 * context per candidate class instead of a single always-legal blanket one,
 * so the player is offered an explicit source choice instead of the spell
 * silently behaving as globally unrestricted forever.
 *
 * Not gated by entitlementInputsVersion: runs every recompute, but is
 * naturally idempotent and cheap — once a key is reclassified to
 * sourceKind:'class' it no longer matches sourceKind==='manual' on the next
 * pass; an already-correctly-ambiguousClassIds-tagged record is left
 * untouched (same-set comparison) rather than re-written every pass.
 */
function sameStringSet(a: string[] | undefined, b: string[]): boolean {
  if (!a || a.length !== b.length) return false;
  return a.every(x => b.includes(x));
}

/**
 * `homebrewSpells` (rules-engine blocker RE-AUDIT closure — dependency
 * inversion, 1A/1B): explicit, application-resolved homebrew spell list —
 * this function never reaches into a store for it. Omitting it (the
 * default) means "no homebrew spell fallback, official spellRepo content
 * only" (a deterministic static default: candidates simply resolve to
 * fewer/no matches for a homebrew-only spell, never a crash or a guess).
 */
function reclassifyManualSpellSources(entity: Entity, homebrewSpells: readonly Spell[] = []): Entity {
  const records = entity.entitlements;
  if (!records || records.length === 0) return entity;
  if (!records.some(r => (r.kind === 'spell_access' || r.kind === 'cantrip_access') && r.sourceKind === 'manual')) {
    return entity;
  }
  const ownedClassIds = getClassLevels(entity).map(c => c.classId as string);
  if (ownedClassIds.length === 0) return entity;

  let changed = false;
  const next = records.map(r => {
    if (r.sourceKind !== 'manual' || (r.kind !== 'spell_access' && r.kind !== 'cantrip_access')) return r;
    const spell = spellRepo.getSpellSync(r.key) ?? homebrewSpells.find(s => s.id === r.key);
    const candidates = (spell?.classes ?? []).filter(id => ownedClassIds.includes(id));
    if (candidates.length === 1) {
      changed = true;
      return { ...r, sourceKind: 'class' as const, sourceId: candidates[0], ambiguousClassIds: undefined };
    }
    if (candidates.length >= 2) {
      if (sameStringSet(r.ambiguousClassIds, candidates)) return r; // already correctly flagged
      changed = true;
      return { ...r, ambiguousClassIds: candidates };
    }
    return r; // 0 candidates — genuinely untraceable, left as an ordinary manual grant
  });
  if (!changed) return entity;
  return { ...entity, entitlements: next };
}

/**
 * One-time compatibility boundary. Historical unowned grants remain manual.
 * Previous derived snapshots are migration evidence only, never runtime ownership.
 * Run BEFORE a source mutation, so grant/remove needs no intervening recompute.
 * `homebrewSpells` — see reclassifyManualSpellSources' own doc comment;
 * threaded straight through, same explicit/no-store contract.
 */
export function initializeEntitlementInputs(entity: Entity, homebrewSpells: readonly Spell[] = []): Entity {
  if (entity.entitlementInputsVersion === 1) return reclassifyManualSpellSources(entity, homebrewSpells);
  const records = [...(entity.entitlements ?? [])];
  const previous = entity.effectGrantedProficiencies;
  const add = (kind: EntitlementKind, keys: string[], derived: string[] = []) => {
    for (const key of keys) {
      if (!derived.includes(key) && !records.some(r => r.kind === kind && r.key === key)) {
        records.push({ kind, key, sourceKind: 'manual' });
      }
    }
  };
  add('armor_proficiency', entity.proficiencies.armor, previous?.armor);
  add('weapon_proficiency', entity.proficiencies.weapons, previous?.weapons);
  add('tool_proficiency', entity.proficiencies.tools, previous?.tools);
  add('language', entity.proficiencies.languages, previous?.languages);
  for (const [key, skill] of Object.entries(entity.skills.skills)) {
    if (skill.trained) add('skill_proficiency', [key], previous?.skills);
    if (skill.expertise) add('skill_expertise', [key], previous?.skills);
  }
  add('spell_access', entity.spellcasting?.known ?? [], previous?.spells);
  add('cantrip_access', entity.spellcasting?.cantrips ?? [], previous?.cantrips);
  return reclassifyManualSpellSources({ ...entity, entitlements: records, entitlementInputsVersion: 1,
    effectGrantedProficiencies: undefined }, homebrewSpells);
}

/** Manual editing owns only manual grants; it cannot revoke a class/race source. */
export function setManualEntitlement(entity: Entity, kind: EntitlementKind, key: string, enabled: boolean): Entity {
  entity = initializeEntitlementInputs(entity);
  if (enabled) return grantEntitlement(entity, { kind, key, sourceKind: 'manual' });
  return { ...entity, entitlements: entity.entitlements!.filter(e =>
    !(e.kind === kind && e.key === key && e.sourceKind === 'manual')) };
}
