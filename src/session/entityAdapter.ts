// ============================================================================
// FILE: src/session/entityAdapter.ts
// Connects the session layer's CharacterAdapter contract to the real character
// store. "Revision" here is deliberately the *material* state a DM change
// request depends on (max HP, ability scores, exhaustion, level): it advances
// only when one of those actually changes, so ordinary play (spending a slot,
// taking damage) does not make a DM's pending request stale, but a real change
// to what the request targets does.
// ============================================================================
import { Entity } from '../engine/types';
import { recomputeDerived } from '../engine/pipeline';
import { applyCondition, removeCondition } from '../engine/conditions';
import { useCharacterStore } from '../store/characterStore';
import { useHomebrewStore } from '../store/homebrewStore';
import { CharacterAdapter, CharacterChange, CharacterSummary, CharacterVitals } from './types';
import { KeyValueStore } from './kv';

const ABILITIES = ['str', 'dex', 'con', 'int', 'wis', 'cha'] as const;

export function materialFingerprint(e: Entity): string {
  return JSON.stringify([
    e.resources.hp.maximum, e.identity.level, e.conditionMonitor.exhaustion,
    ABILITIES.map(a => e.stats[a]),
  ]);
}

/** Pure: applies persistent changes to an entity. Exhaustion is 0..6; scores never drop below 1; max HP never below 1. */
export function applyChangesToEntity(entity: Entity, changes: CharacterChange[], rules: Parameters<typeof recomputeDerived>[1]): Entity {
  let next: Entity = entity;
  for (const c of changes) {
    if (c.kind === 'exhaustion') {
      next = { ...next, conditionMonitor: { ...next.conditionMonitor, exhaustion: Math.min(6, Math.max(0, next.conditionMonitor.exhaustion + c.delta)) } };
    } else if (c.kind === 'max_hp') {
      const maximum = Math.max(1, next.resources.hp.maximum + c.delta);
      next = { ...next, resources: { ...next.resources, hp: { ...next.resources.hp, maximum, current: Math.min(next.resources.hp.current, maximum) } } };
    } else if (c.kind === 'hp') {
      const current = Math.max(0, Math.min(next.resources.hp.maximum, next.resources.hp.current + c.delta));
      next = { ...next, resources: { ...next.resources, hp: { ...next.resources.hp, current } } };
    } else if (c.kind === 'temp_hp') {
      // 5e temp HP doesn't stack — take the higher of what's already there, never add.
      const temp = Math.max(next.resources.hp.temp, c.amount);
      next = { ...next, resources: { ...next.resources, hp: { ...next.resources.hp, temp } } };
    } else if (c.kind === 'condition_add') {
      // Same primitive and content lookup the character sheet's own condition toggle uses
      // (app/sheet/[id].tsx) — mechanical features attach exactly as they would locally.
      const contentDB = useHomebrewStore.getState().getMergedContentDB(next.rulesetId);
      const cond = contentDB.conditions.find(x => x.id === c.conditionId);
      next = applyCondition(next, c.conditionId, 'dm', rules, cond?.features);
    } else if (c.kind === 'condition_remove') {
      next = removeCondition(next, c.conditionId, rules);
    } else if (c.kind === 'concentration_break') {
      if (next.spellcasting) {
        next = { ...next, spellcasting: { ...next.spellcasting, concentrating: null, concentratingDuration: undefined } };
      }
    } else if (c.kind === 'stabilize') {
      next = { ...next, resources: { ...next.resources, deathSaves: { successes: 0, failures: 0, stable: true } } };
    } else {
      next = { ...next, stats: { ...next.stats, [c.ability]: Math.max(1, next.stats[c.ability] + c.delta) } };
    }
  }
  return recomputeDerived(next, rules);
}

type RevState = { fingerprint: string; counter: number };

export class EntityAdapter implements CharacterAdapter {
  private state: RevState | null = null;

  constructor(readonly characterId: string, private readonly kv?: KeyValueStore) {}

  private key(): string { return `session.charrev.${this.characterId}`; }

  /** Loads the persisted revision counter so revisions stay monotonic across app restarts. */
  async load(): Promise<void> {
    if (!this.kv) return;
    this.state = await this.kv.get<RevState>(this.key());
  }

  private entity(): Entity | undefined {
    return useCharacterStore.getState().characters.find(c => c.id === this.characterId);
  }

  getRevision(): number {
    const e = this.entity();
    if (!e) return this.state?.counter ?? 0;
    const fp = materialFingerprint(e);
    if (!this.state) {
      this.state = { fingerprint: fp, counter: 1 };
      void this.kv?.set(this.key(), this.state);
    } else if (this.state.fingerprint !== fp) {
      this.state = { fingerprint: fp, counter: this.state.counter + 1 };
      void this.kv?.set(this.key(), this.state);
    }
    return this.state.counter;
  }

  summary(): CharacterSummary {
    const e = this.entity();
    if (!e) return { name: 'Unknown', hp: 0, maxHp: 0, ac: 0 };
    return { name: e.identity.name || 'Unnamed', hp: e.resources.hp.current, maxHp: e.resources.hp.maximum, ac: e.derived.ac };
  }

  /** DM_SCREEN_SPEC.md item 2's Party Dashboard fields — see CharacterVitals's own doc comment. */
  vitals(): CharacterVitals {
    const e = this.entity();
    if (!e) {
      return { tempHp: 0, speed: 0, exhaustion: 0, conditions: [], concentration: null, deathSaves: { successes: 0, failures: 0, stable: false }, resources: [], spellSlots: null };
    }
    return {
      tempHp: e.resources.hp.temp, speed: e.resources.speed, exhaustion: e.conditionMonitor.exhaustion,
      conditions: e.conditionMonitor.active.map(c => c.id),
      concentration: e.spellcasting?.concentrating ?? null,
      deathSaves: { ...e.resources.deathSaves },
      resources: e.resources.custom.map(r => ({ id: r.id, name: r.name, current: r.current, maximum: r.maximum })),
      spellSlots: e.spellcasting ? Object.fromEntries(Object.entries(e.spellcasting.slots).filter(([, s]) => s.total > 0)) : null,
    };
  }

  applyChanges(changes: CharacterChange[], requestId: string): number {
    const store = useCharacterStore.getState();
    store.updateCharacter(
      this.characterId,
      e => applyChangesToEntity(e, changes, store.rules),
      `DM request accepted (${requestId})`,
      'other',
    );
    return this.getRevision();
  }
}
