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
import { spawnMonster } from './monsterFactory';
import { resolveMonsterById } from '../content/contentResolution';
import { applyCondition } from './conditions';
import { CONDITIONS_BY_ID } from '../content/conditions/index';
import { recomputeDerived } from './pipeline';
import { rollExpression } from './dice';

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

/** Overrides HP per the combatant's own hpMode, independent of the
 *  campaign's global rules.hpMode — a prepared encounter might want the
 *  boss at max HP and the mooks at average regardless of table house
 *  rules. Re-derives afterward since nothing else about the entity changed
 *  that recomputeDerived would need to touch, but it's cheap and matches
 *  the pattern every other resource-adjusting mutator in this codebase uses. */
function applyHpMode(entity: Entity, template: MonsterTemplate, combatant: PreparedCombatant, rules: CampaignRules): Entity {
  let hp: number;
  switch (combatant.hpMode) {
    case 'max':    hp = maxPossibleHp(template.hp.dice, template.hp.average); break;
    case 'manual': hp = combatant.manualHp && combatant.manualHp > 0 ? combatant.manualHp : template.hp.average; break;
    case 'roll':
      try { hp = rollExpression(template.hp.dice).total; } catch { hp = template.hp.average; }
      break;
    case 'average':
    default:       hp = template.hp.average;
  }
  hp = Math.max(1, hp);
  return recomputeDerived({
    ...entity,
    resources: { ...entity.resources, hp: { current: hp, maximum: hp, temp: 0 } },
  }, rules);
}

/** "Max possible" from a dice expression — every die at its highest face
 *  plus the flat modifier implied by (average - average of dice alone).
 *  Cheap and correct for the "NdX(+/-M)" shapes every monster hp.dice
 *  string in this content actually uses; falls back to the printed average
 *  if the expression doesn't parse (never worse than what spawnMonster
 *  itself already tolerates). */
function maxPossibleHp(dice: string, average: number): number {
  const m = dice.trim().match(/^(\d+)d(\d+)([+-]\d+)?$/i);
  if (!m) return average;
  const count = parseInt(m[1], 10);
  const sides = parseInt(m[2], 10);
  const flat  = m[3] ? parseInt(m[3], 10) : 0;
  return count * sides + flat;
}

/**
 * Spawns one entity for a single PreparedCombatant "unit" (quantity is
 * expanded by the caller — each call here is one independent copy).
 */
function spawnPreparedCombatant(
  combatant:        PreparedCombatant,
  template:         MonsterTemplate,
  rules:             CampaignRules,
  groups:           EncounterGroup[],
  copyIndex:        number,
  copyCount:        number,
): Entity {
  let entity = spawnMonster(template, rules);
  entity = applyHpMode(entity, template, combatant, rules);

  const baseName = combatant.displayName?.trim() || template.name;
  const suffixedName = copyCount > 1 ? `${baseName} ${copyIndex + 1}` : baseName;
  entity = { ...entity, identity: { ...entity.identity, name: suffixedName } };

  for (const conditionId of combatant.startingConditionIds ?? []) {
    const condition = CONDITIONS_BY_ID[conditionId];
    entity = applyCondition(entity, conditionId, 'prepared_encounter', rules, condition?.features);
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
