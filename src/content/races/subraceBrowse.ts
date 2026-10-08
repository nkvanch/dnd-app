// src/content/races/subraceBrowse.ts
// SHARED-QUERY-1: filter/sort helpers for Subrace pickers (character
// creation and, later, Compendium). Every predicate here scans ONLY
// `Subrace.features` — the subrace's own additive Feature list — never the
// parent Race's features. That's not an extra precaution: Subrace simply
// never stores the parent's features at all (they're applied separately,
// see race-detail.tsx's selectRace()), so any scan here is already
// correctly scoped to "this subrace's own contribution" by construction.
import { Subrace } from '../../engine/types';
import { SortOption, nameSortOptions, sourceSortOption } from '../contentQuery';
import { getContentProvenance } from '../provenance';

export type SubraceOwnTrait = 'size_override' | 'movement' | 'senses' | 'asi' | 'proficiency' | 'spellcasting' | 'defensive';

export const SUBRACE_OWN_TRAIT_LABELS: Record<SubraceOwnTrait, string> = {
  size_override: 'Size Override', movement: 'Movement Changes', senses: 'Sense Changes',
  asi: 'ASI / Stat Changes', proficiency: 'Proficiency Grants',
  spellcasting: 'Spellcasting / Spell Grants', defensive: 'Defensive Traits',
};

export function subraceOwnTraits(sub: Subrace): Set<SubraceOwnTrait> {
  const out = new Set<SubraceOwnTrait>();
  if (sub.size) out.add('size_override');
  if (sub.flexibleAsi) out.add('asi');
  for (const f of sub.features) {
    for (const e of f.effects) {
      if (e.type === 'grant_movement') out.add('movement');
      if (e.type === 'grant_sense') out.add('senses');
      if (e.type === 'stat_modifier') out.add('asi');
      if (e.type === 'grant_proficiency') out.add('proficiency');
      if (e.type === 'grant_spell') out.add('spellcasting');
      if (e.type === 'grant_resistance' || e.type === 'grant_immunity' || e.type === 'condition_immunity') out.add('defensive');
    }
  }
  return out;
}

export function subraceSourceLabel(sub: Subrace, isHomebrew: boolean): string | undefined {
  return getContentProvenance(sub, { isHomebrew }).sourceLabel;
}

export function subraceSortOptions(isHomebrewOf: (sub: Subrace) => boolean): SortOption<Subrace>[] {
  return [
    ...nameSortOptions<Subrace>(),
    sourceSortOption<Subrace>(s => subraceSourceLabel(s, isHomebrewOf(s))),
  ];
}
