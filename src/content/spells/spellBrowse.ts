// src/content/spells/spellBrowse.ts
// SHARED-QUERY-1: Spell sort options, following the same pattern as
// raceBrowse.ts/classBrowse.ts/backgroundBrowse.ts/featBrowse.ts. Spell has
// no per-item sourcebook field (confirmed — only Feat does), so
// spellSourceLabel resolves through getContentProvenance() the same way
// every other type's does, and will only ever land on "SRD 5.1"/undefined
// for official content (matches app/creation/spells.tsx's own long-standing
// comment about this).
//
// Casting Time sort reuses spellFilterUtils.ts's existing actionType()
// bucket classification (Action/Bonus Action/Reaction/Ritual-Long/Other)
// rather than inventing a second, competing casting-time taxonomy — same
// "don't build an inferior second classification" rule that led to
// actionType() being extracted and shared in the first place.
import { SortOption, nameSortOptions, sourceSortOption } from '../contentQuery';
import { getContentProvenance } from '../provenance';
import { actionType, ACTION_TYPES } from '../spellFilterUtils';
import type { SpellIndexEntry } from '../spellRepo.types';

export function spellSourceLabel(spell: SpellIndexEntry, isHomebrew: boolean): string | undefined {
  return getContentProvenance(spell, { isHomebrew }).sourceLabel;
}

const ACTION_TYPE_RANK: Record<string, number> = Object.fromEntries(
  [...ACTION_TYPES, 'Other'].map((t, i) => [t, i])
);

export function spellSortOptions(isHomebrewOf: (spell: SpellIndexEntry) => boolean): SortOption<SpellIndexEntry>[] {
  return [
    ...nameSortOptions<SpellIndexEntry>(),
    {
      id: 'level', label: 'Spell Level',
      compare: (a, b) => a.level - b.level || a.name.localeCompare(b.name),
    },
    {
      id: 'school', label: 'School',
      compare: (a, b) => a.school.localeCompare(b.school) || a.name.localeCompare(b.name),
    },
    {
      id: 'casting_time', label: 'Casting Time',
      compare: (a, b) => (ACTION_TYPE_RANK[actionType(a)] ?? 99) - (ACTION_TYPE_RANK[actionType(b)] ?? 99) || a.name.localeCompare(b.name),
    },
    sourceSortOption<SpellIndexEntry>(s => spellSourceLabel(s, isHomebrewOf(s))),
  ];
}
