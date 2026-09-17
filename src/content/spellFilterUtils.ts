// src/content/spellFilterUtils.ts
// Shared spell-filter predicates — extracted from AddSpellModal.tsx (the
// character sheet's spell browser) so character-creation's own spell
// picker (app/creation/spells.tsx) can reuse the exact same casting-time
// classification instead of re-deriving it independently (item 8/9 of the
// creation-filters audit: "do not implement an inferior second spell-
// filter system"). Pure functions only — no React/RN imports — so either
// screen can use them.
import type { SpellIndexEntry } from './spellRepo.types';

export const ACTION_TYPES = ['Action', 'Bonus Action', 'Reaction', 'Ritual / Long'] as const;

/** Casting-time → action-type bucket, for the action-type filter. */
export function actionType(s: SpellIndexEntry): string {
  const t = s.castingTime.toLowerCase();
  if (t.includes('bonus')) return 'Bonus Action';
  if (t.includes('reaction')) return 'Reaction';
  if (t.includes('action')) return 'Action';
  if (t.includes('minute') || t.includes('hour')) return 'Ritual / Long';
  return 'Other';
}
