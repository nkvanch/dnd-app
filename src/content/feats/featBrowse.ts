// src/content/feats/featBrowse.ts
// FILTER-METADATA-3: derived, structured prerequisite-CATEGORY tags for
// filtering (distinct from src/engine/featPrereq.ts's evaluatePrerequisite,
// which answers "does THIS character meet it" against a real entity). These
// classifiers reuse the exact same regex vocabulary evaluatePrerequisite
// already trusts (see that file's own header comment listing the shapes
// prerequisites follow) — re-deriving structure already implicit in real,
// hand-authored text, not inventing a new taxonomy. Race requirement
// detection is best-effort: evaluatePrerequisite's own branch order treats
// "anything that isn't ability/spellcasting/armor/weapon/level" as a race
// gate (including genuinely unparseable text, which it also flags
// needsManualCheck) — same ambiguity here, disclosed rather than hidden.
//
// "Grants ASI"/"Grants proficiency"/"Grants activation" need no text
// parsing at all — they're real, structured Feat/Feature fields already.
import { Feat, Entity } from '../../engine/types';
import { evaluatePrerequisite } from '../../engine/featPrereq';
import { SortOption, nameSortOptions, sourceSortOption } from '../contentQuery';
import { getContentProvenance } from '../provenance';

export function hasAbilityRequirement(prereq: string | null): boolean {
  if (!prereq) return false;
  return /(?:strength|dexterity|constitution|intelligence|wisdom|charisma)(?:\s+or\s+(?:strength|dexterity|constitution|intelligence|wisdom|charisma))*\s+\d+\+?/i.test(prereq);
}

export function hasSpellcastingRequirement(prereq: string | null): boolean {
  if (!prereq) return false;
  return /cast at least one spell|spellcasting|pact magic/i.test(prereq);
}

export function hasArmorProfRequirement(prereq: string | null): boolean {
  if (!prereq) return false;
  return /proficiency with (light|medium|heavy) armor/i.test(prereq);
}

export function hasWeaponProfRequirement(prereq: string | null): boolean {
  if (!prereq) return false;
  return /proficiency with a martial weapon/i.test(prereq);
}

export function hasLevelRequirement(prereq: string | null): boolean {
  if (!prereq) return false;
  return /\d+(?:st|nd|rd|th)\s+level/i.test(prereq);
}

/** Best-effort — see this file's header. True for prerequisite text that
 *  doesn't match any of the other, more specific categories above. */
export function hasRaceRequirement(prereq: string | null): boolean {
  if (!prereq || prereq.trim() === '') return false;
  return !hasAbilityRequirement(prereq) && !hasSpellcastingRequirement(prereq) &&
    !hasArmorProfRequirement(prereq) && !hasWeaponProfRequirement(prereq) && !hasLevelRequirement(prereq);
}

/** Real structured data — Feat.abilityChoice, or a baked-in stat_modifier
 *  effect on the feat's own feature (a fixed, non-chosen ASI, e.g. some
 *  homebrew feats). */
export function featGrantsAsi(feat: Feat): boolean {
  return !!feat.abilityChoice || feat.feature.effects.some(e => e.type === 'stat_modifier');
}

/** Real structured data — Feat.skillChoice, or a baked-in grant_proficiency
 *  effect on the feat's own feature. */
export function featGrantsProficiency(feat: Feat): boolean {
  return !!feat.skillChoice || feat.feature.effects.some(e => e.type === 'grant_proficiency');
}

/** Real structured data — the feat's feature carries an activation
 *  (an action/bonus-action/reaction the player can use), not purely
 *  passive. */
export function featGrantsActivation(feat: Feat): boolean {
  return !!feat.feature.activation;
}

/** One label per prerequisite category, for the Prerequisite-Type sort —
 *  a feat's prerequisite can match more than one category (see
 *  featBrowse.test.ts's Cartomancer case), so this reports the FIRST
 *  matching category in a fixed, deterministic check order rather than an
 *  arbitrary one. */
export function primaryPrereqCategory(prereq: string | null): string {
  if (!prereq || prereq.trim() === '') return 'None';
  if (hasAbilityRequirement(prereq)) return 'Ability Score';
  if (hasSpellcastingRequirement(prereq)) return 'Spellcasting';
  if (hasArmorProfRequirement(prereq)) return 'Armor Proficiency';
  if (hasWeaponProfRequirement(prereq)) return 'Weapon Proficiency';
  if (hasLevelRequirement(prereq)) return 'Level';
  return 'Race / Species';
}

export function featSourceLabel(feat: Feat, isHomebrew: boolean): string | undefined {
  return getContentProvenance(feat, { isHomebrew }).sourceLabel ?? feat.source;
}

/** Eligibility sort needs a real Entity to evaluate against (same
 *  evaluatePrerequisite() the picker's own Eligibility filter uses) — met
 *  feats sort first, unmet last, matching the "Eligible" filter's own
 *  definition of the word. */
export function featSortOptions(entity: Entity, isHomebrewOf: (feat: Feat) => boolean): SortOption<Feat>[] {
  return [
    ...nameSortOptions<Feat>(),
    {
      id: 'eligibility', label: 'Eligibility',
      compare: (a, b) => {
        const ma = evaluatePrerequisite(entity, a.prerequisite).met;
        const mb = evaluatePrerequisite(entity, b.prerequisite).met;
        if (ma === mb) return a.name.localeCompare(b.name);
        return ma ? -1 : 1;
      },
    },
    sourceSortOption<Feat>(f => featSourceLabel(f, isHomebrewOf(f))),
    {
      id: 'prereq_type', label: 'Prerequisite Type',
      compare: (a, b) => primaryPrereqCategory(a.prerequisite).localeCompare(primaryPrereqCategory(b.prerequisite)) || a.name.localeCompare(b.name),
    },
  ];
}
