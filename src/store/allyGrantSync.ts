// src/store/allyGrantSync.ts
// Store-side glue for the pure ally-grant engine (src/engine/allyGrants.ts):
// re-syncs every aura across the characters on this device and persists only
// the characters whose receivedGrants actually changed.
import { useCharacterStore, DEFAULT_RULES } from './characterStore';
import { useHomebrewStore } from './homebrewStore';
import { syncAllyGrants } from '../engine/allyGrants';
import { recomputeDerived } from '../engine/pipeline';
import type { Entity } from '../engine/types';

/**
 * `overrides` lets a caller feed a holder it has just changed but not yet
 * committed (so the sync sees the new aura checklist). Returns the ids it
 * updated. Only `receivedGrants` is written back, so committing the
 * override entity separately (the caller's own update) never conflicts.
 */
export function syncAllyGrantsInStore(overrides: Entity[] = []): string[] {
  const { characters, updateCharacter } = useCharacterStore.getState();
  const roster = characters.map(c => overrides.find(o => o.id === c.id) ?? c);
  const synced = syncAllyGrants(roster, DEFAULT_RULES, useHomebrewStore.getState().items);
  const changed: string[] = [];
  synced.forEach((next, i) => {
    if (next === roster[i]) return;
    changed.push(next.id);
    updateCharacter(next.id, e => recomputeDerived({ ...e, receivedGrants: next.receivedGrants }, DEFAULT_RULES), 'Ally aura updated');
  });
  return changed;
}
