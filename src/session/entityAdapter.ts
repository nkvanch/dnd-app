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
import { useCharacterStore } from '../store/characterStore';
import { CharacterAdapter, CharacterChange, CharacterSummary } from './types';
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
