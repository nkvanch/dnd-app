// ============================================================================
// FILE: src/engine/preparedEncounter.ts
// Turns a PreparedEncounter (planning data) into fresh runtime Entity
// instances — the DM-prep equivalent of monsterFactory.ts's spawnMonster,
// which this reuses rather than duplicating. Deliberately never touches the
// PreparedEncounter itself: starting the same template twice must produce
// two fully independent sets of entities, and completing/ending combat must
// never write live HP/conditions back into the template (see
// PreparedEncounter's own doc comment in engine/types.ts).
// ============================================================================
import {
  Entity, CampaignRules, PreparedEncounter, PreparedCombatant, EncounterGroup,
  EncounterWave, EncounterEnvironmentEntry, EncounterReward,
} from './types';
import { MonsterTemplate } from '../content/monsters/types';
import { spawnMonster, isValidManualHp } from './monsterFactory';
import { resolveMonsterById } from '../content/contentResolution';
import { applyCondition } from './conditions';
import { recomputeDerived } from './pipeline';
import { lookupCondition } from '../content/conditions/index';

function genId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

// ── Constructors ─────────────────────────────────────────────────────────────

export function newPreparedEncounter(name: string, campaignId?: string, sessionId?: string): PreparedEncounter {
  const now = Date.now();
  return {
    id: genId('enc'), campaignId, sessionId, name, tags: [], status: 'draft',
    combatants: [], groups: [], waves: [], environment: [], rewards: [],
    createdAt: now, updatedAt: now,
  };
}

export function newPreparedCombatant(monsterId: string): PreparedCombatant {
  return { id: genId('pc'), monsterId, quantity: 1, hpMode: 'average' };
}

/**
 * Closure 3/final runtime boundary: the every combatant whose HP would be
 * silently wrong if this PreparedEncounter were instantiated right now —
 * set to Manual/Table-Rolled HP with no valid entry. `resolveMonsterHp`
 * (monsterFactory.ts) would otherwise fall back to the printed average for
 * each of these with no indication anything was wrong; that fallback is a
 * defensive safety net for a caller that skips validation entirely, not
 * something a real user-facing path should ever rely on. Reuses
 * isValidManualHp (monsterFactory.ts) — the exact same validator
 * app/dm/monsters.tsx's direct "Add Monster" screen already uses — rather
 * than a second, differently-behaved implementation. Returns the actual
 * combatants (not just a boolean) so a caller — the final runtime Start
 * boundary in app/dm/encounter.tsx in particular — can name them in a
 * user-facing message. Lives here (a plain engine module), not inside a
 * route file, so it's testable — importing a route file that calls
 * expo-router's useRouter at module scope breaks under Jest (see
 * app/creation/__tests__/hubProgress.test.ts's own doc comment for the
 * same, already-diagnosed issue).
 */
/**
 * The actual predicate, operating on a plain PreparedCombatant[] rather
 * than a whole PreparedEncounter — so it can validate any SUBSET of an
 * encounter's combatants (e.g. just one wave's, for handleDeployWave in
 * app/dm/encounter.tsx) without constructing a fake PreparedEncounter just
 * to satisfy a type. invalidManualHpCombatants (below) is the whole-
 * encounter convenience wrapper every existing caller already uses; both
 * share this ONE definition of "invalid" — never a second, duplicated
 * check written inline anywhere.
 */
export function combatantsWithInvalidManualHp(combatants: PreparedCombatant[]): PreparedCombatant[] {
  return combatants.filter(c => c.hpMode === 'manual' && !isValidManualHp(String(c.manualHp ?? '')));
}

export function invalidManualHpCombatants(prepared: PreparedEncounter): PreparedCombatant[] {
  return combatantsWithInvalidManualHp(prepared.combatants);
}

/** Convenience boolean form of invalidManualHpCombatants — gates
 *  app/dm/encounter-builder.tsx's Save and Review/Start actions, and (the
 *  authoritative check) app/dm/encounter.tsx's handleStartFromPrepared, the
 *  one runtime boundary every route that can start a prepared encounter
 *  (Encounter Library's "▶ Start," Builder's "Review & Start," this
 *  screen's own "Start This Encounter") converges on. handleDeployWave
 *  (same file) validates a wave's own combatant subset via
 *  combatantsWithInvalidManualHp directly, since a mid-combat wave deploy
 *  isn't "the whole encounter." */
export function hasInvalidManualHp(prepared: PreparedEncounter): boolean {
  return invalidManualHpCombatants(prepared).length > 0;
}

export function newEncounterGroup(name: string): EncounterGroup {
  return { id: genId('grp'), name };
}

export function newEncounterWave(name: string): EncounterWave {
  return { id: genId('wave'), name, triggerKind: 'manual' };
}

export function newEnvironmentEntry(label: string): EncounterEnvironmentEntry {
  return { id: genId('env'), label };
}

export function newReward(kind: EncounterReward['kind'], label: string): EncounterReward {
  return { id: genId('rwd'), kind, label };
}

// ── Instantiation ────────────────────────────────────────────────────────────

/** Merges a PreparedCombatant's own metadata into the notes JSON blob
 *  spawnMonster already writes (cr/size/type/senses/etc.) — additive, not a
 *  parallel storage mechanism, so anything that ever starts reading that
 *  blob back sees one consistent shape. */
function withPrepMetadata(entity: Entity, combatant: PreparedCombatant, groups: EncounterGroup[]): Entity {
  let existing: Record<string, unknown> = {};
  try { existing = JSON.parse(entity.notes || '{}'); } catch { /* ignore */ }
  const group = combatant.groupId ? groups.find(g => g.id === combatant.groupId) : undefined;
  return {
    ...entity,
    notes: JSON.stringify({
      ...existing,
      dmHidden:       combatant.hidden || undefined,
      groupName:      group?.name,
      combatantNotes: combatant.notes || undefined,
    }),
  };
}

/**
 * Spawns one entity for a single PreparedCombatant "unit" (quantity is
 * expanded by the caller — each call here is one independent copy).
 *
 * Closure fix (prepared monster HP must be resolved exactly once): this
 * used to call spawnMonster(template, rules) with no HP override — under a
 * campaign hpMode of 'rolled', spawnMonster ran its OWN real dice roll
 * internally — and then immediately overwrote the result with a second,
 * separately computed value (the combatant's own hpMode/manualHp). The
 * first roll was real (it consumed RNG) but its result was silently
 * discarded, and if the DM's chosen combatant.hpMode was itself 'roll',
 * this produced a completely hidden double roll with only the second
 * result ever visible. Passing hpOverride here makes spawnMonster's own
 * resolveMonsterHp (monsterFactory.ts) the ONLY HP computation that ever
 * runs — independent of the campaign's global hpMode exactly as before
 * (a prepared boss can still be Max while the campaign default is
 * Rolled), but now genuinely once: 'average'/'manual' never touch the
 * RNG at all, and 'roll' rolls exactly once.
 */
function spawnPreparedCombatant(
  combatant:        PreparedCombatant,
  template:         MonsterTemplate,
  rules:             CampaignRules,
  groups:           EncounterGroup[],
  copyIndex:        number,
  copyCount:        number,
): Entity {
  let entity = spawnMonster(template, rules, { mode: combatant.hpMode, manualHp: combatant.manualHp });

  const baseName = combatant.displayName?.trim() || template.name;
  const suffixedName = copyCount > 1 ? `${baseName} ${copyIndex + 1}` : baseName;
  entity = { ...entity, identity: { ...entity.identity, name: suffixedName } };

  for (const conditionId of combatant.startingConditionIds ?? []) {
    const condition = lookupCondition(conditionId);
    entity = applyCondition(entity, conditionId, 'prepared_encounter', rules, condition?.features);
  }

  const starts = combatant.startingResources;
  if (starts) {
    entity = {
      ...entity,
      resources: {
        ...entity.resources,
        custom: entity.resources.custom.map(r =>
          starts[r.id] === undefined ? r : { ...r, current: Math.max(0, Math.min(r.maximum, Math.trunc(starts[r.id]))) }),
      },
    };
    entity = recomputeDerived(entity, rules);
  }

  entity = withPrepMetadata(entity, combatant, groups);
  return entity;
}

/**
 * Turns a PreparedEncounter into fresh runtime Entity instances, ready to
 * hand to combatStore.startCombat (or useCombatStore.updateEntity for a
 * mid-combat reinforcement deploy — see deployWave below).
 *
 * `deployWaveIds` controls which wave-assigned combatants are included:
 * undefined/omitted means "only combatants with no waveId at all" (the
 * normal Start Encounter case — waves deploy later, on demand). Pass a
 * wave's id explicitly (deployWave, below) to instantiate just that wave.
 */
export function instantiatePreparedEncounter(
  prepared:        PreparedEncounter,
  rules:           CampaignRules,
  homebrewMonsters: MonsterTemplate[],
  deployWaveIds?:  string[] | 'all',
): Entity[] {
  const entities: Entity[] = [];
  for (const combatant of prepared.combatants) {
    const included = combatant.waveId
      ? deployWaveIds === 'all' || (Array.isArray(deployWaveIds) && deployWaveIds.includes(combatant.waveId))
      : !deployWaveIds || deployWaveIds === 'all'; // no wave = present from the start
    if (!included) continue;

    const template = resolveMonsterById(combatant.monsterId, homebrewMonsters);
    if (!template) continue; // missing content — surfaced as an Issue elsewhere, never crash

    const count = Math.max(1, combatant.quantity);
    for (let i = 0; i < count; i++) {
      entities.push(spawnPreparedCombatant(combatant, template, rules, prepared.groups, i, count));
    }
  }
  return entities;
}

/** Instantiates just one wave's combatants — the "Deploy" action during an
 *  already-active encounter (reinforcements). Same instantiation path as
 *  the initial Start Encounter, just scoped to one wave. */
export function instantiateWave(
  prepared:         PreparedEncounter,
  waveId:           string,
  rules:            CampaignRules,
  homebrewMonsters: MonsterTemplate[],
): Entity[] {
  return instantiatePreparedEncounter(prepared, rules, homebrewMonsters, [waveId]);
}

/** Every combatant not assigned to any wave — used for the Start Encounter
 *  preview/count, kept in one place so the preview and the real
 *  instantiation can never silently disagree on what "present from the
 *  start" means. */
export function startingCombatantCount(prepared: PreparedEncounter): number {
  return prepared.combatants
    .filter(c => !c.waveId)
    .reduce((sum, c) => sum + Math.max(1, c.quantity), 0);
}
