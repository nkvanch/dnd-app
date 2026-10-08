// src/store/requiredItemContextStore.ts
// STARTING-EQUIPMENT-2: carries a RequiredEquipmentChoice's full context
// into the homebrew Item Builder and back, so "Create New Homebrew Item"
// from a constrained required picker can (a) tell the builder what
// constraint/remaining count it's creating for, and (b) let the picker
// screen reconstruct exactly where the player left off — which choice,
// which option (for exact/bundle styles carrying a nested itemFilter), and
// which items were already selected before navigating away — without
// depending on component state surviving the round trip (it doesn't,
// reliably, in this app's navigation stack — see feats.tsx's own
// "lazy peek at pending" precedent).
//
// Generic by construction, not a one-off for Fighter's weapon choice:
// `constraint` is the same ruleset-agnostic, independent-axis
// ItemFilterConstraint every other equipment predicate in this app already
// uses (src/engine/types.ts), and `originContext` is a discriminated union
// so a future constrained picker (a different content type, or a future
// ruleset's own structured predicate) can add a sibling variant here
// instead of inventing a parallel store.
import { create } from 'zustand';
import { ItemFilterConstraint } from '../engine/types';

export type RequiredItemOrigin = {
  originContext: 'requiredEquipmentChoice';
  requiredChoiceId: string;
  /** The picker's own display title (an option's label, or the choice's
   *  prompt for a top-level filtered_item choice) — carried through so the
   *  picker can be reconstructed with the same heading after the round
   *  trip, without the caller needing to re-derive it from a possibly-
   *  stale ChoiceState. */
  title: string;
  constraint: ItemFilterConstraint;
  quantity: number;
  /** Present only for exact_options/bundle_options styles, where the
   *  filtered pick is nested under a chosen pool option rather than being
   *  the whole choice. Absent for a top-level filtered_item choice. */
  optionId?: string;
  alreadySelectedItemIds: string[];
};

export type RequiredItemResult =
  | { kind: 'eligible'; itemId: string; requiredChoiceId: string }
  | { kind: 'ineligible'; itemId: string; requiredChoiceId: string; reason: string };

type Store = {
  context: RequiredItemOrigin | null;
  result:  RequiredItemResult | null;
  setContext: (ctx: RequiredItemOrigin) => void;
  /** Read without clearing — the builder needs this available for its
   *  whole session (constraint banner, prefill, save-time validation),
   *  not just once on mount. */
  peekContext: () => RequiredItemOrigin | null;
  /** Clears it — called only by the picker screen once it has fully
   *  handled the round trip (resolved, reopened, or the player cancelled
   *  out of the whole equipment choice). */
  consumeContext: () => RequiredItemOrigin | null;
  setResult: (r: RequiredItemResult) => void;
  consumeResult: () => RequiredItemResult | null;
};

export const useRequiredItemContextStore = create<Store>((set, get) => ({
  context: null,
  result: null,
  setContext: (ctx) => set({ context: ctx }),
  peekContext: () => get().context,
  consumeContext: () => {
    const c = get().context;
    set({ context: null });
    return c;
  },
  setResult: (r) => set({ result: r }),
  consumeResult: () => {
    const r = get().result;
    set({ result: null });
    return r;
  },
}));
