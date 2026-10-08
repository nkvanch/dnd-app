// src/content/backgrounds/backgroundBrowse.ts
// FILTER-METADATA-2: skill-grant derivation for the Background filter/browse
// UI. Every official background's skill proficiencies are ALREADY real,
// structured data — a grant_proficiency 'skill:X' Effect on one of the
// background's own Features (see src/content/backgrounds/index.ts) — this
// was previously only ever rendered as free text via a separate, screen-
// local hardcoded table (app/creation/background.tsx's BG_DETAIL). Reading
// it straight from the authoritative Feature/Effect data means homebrew
// backgrounds authored with an equivalent skill grant get a working filter
// for free too, not just the 13 official ones.
import { Background, SkillName } from '../../engine/types';
import { SortOption, nameSortOptions, sourceSortOption } from '../contentQuery';
import { getContentProvenance } from '../provenance';

export function backgroundSkillGrants(bg: Background): SkillName[] {
  const set = new Set<SkillName>();
  for (const f of bg.features) {
    for (const e of f.effects) {
      if (e.type === 'grant_proficiency' && e.operation === 'add' && e.target.startsWith('skill:')) {
        set.add(e.target.slice('skill:'.length) as SkillName);
      }
    }
  }
  return Array.from(set);
}

/** Real, structured field — Background.flexibleAsi presence. Language
 *  Grant / Granted Feat / Equipment Category are NOT offered anywhere for
 *  Background — confirmed no structured field or Effect-target convention
 *  exists for any of the three (the one 2024 proof-of-concept background's
 *  "Origin Feat" is disclosed-only flavor text, not a real Grant). */
export function backgroundGrantsAsi(bg: Background): boolean {
  return !!bg.flexibleAsi;
}

export function backgroundSourceLabel(bg: Background, isHomebrew: boolean): string | undefined {
  return getContentProvenance(bg, { isHomebrew }).sourceLabel;
}

export function backgroundSortOptions(isHomebrewOf: (bg: Background) => boolean): SortOption<Background>[] {
  return [
    ...nameSortOptions<Background>(),
    sourceSortOption<Background>(b => backgroundSourceLabel(b, isHomebrewOf(b))),
  ];
}
