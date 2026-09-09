// ============================================================================
// FILE: src/store/combatTurnStore.ts
// Zustand store for the player-facing "whose turn is it" live-play banner —
// drives the same UI concern syncStore drives for connection status, just
// for combat turn state instead. Populated only on player devices, via
// syncManager's onCombatTurnReceived callback (app/_layout.tsx) broadcasting
// from the DM's combatStore.ts. Before this existed, a player device had
// zero visibility into DM-run combat at all (no CombatState/turn data was
// ever synced) — this is deliberately a lightweight summary, not the DM's
// full CombatState (initiative order, per-entry details), since a player
// only needs round + current actor to know "is it my turn."
// ============================================================================
import { create } from 'zustand';
import { CombatTurnState } from '../sync/protocol';

type CombatTurnStore = CombatTurnState & {
  setTurn: (turn: CombatTurnState) => void;
};

const DEFAULT_TURN: CombatTurnState = {
  active:          false,
  round:           0,
  currentEntityId: null,
  currentName:     null,
};

export const useCombatTurnStore = create<CombatTurnStore>(set => ({
  ...DEFAULT_TURN,
  setTurn: (turn) => set(turn),
}));
