// src/content/spells/spellDetail.ts
// What the Compendium shows when a spell is expanded: the record resolved for the active ruleset (the SRD 5.2.1
// version under 2024, the library record otherwise) as display lines, and a label saying which version it is.
// Pure, so the screen and the tests share it.
import type { RulesetId, Spell } from '../../engine/types';
import { hasSpellVersion, resolveSpellVersion } from './spellVersions';

export type SpellDetail = {
  /** "SRD 5.2.1 version" when the 2024 version is shown, else undefined. */
  versionLabel?: string;
  stats: { label: string; value: string }[];
  description: string;
  upcast: string | null;
};

export function spellDetail(spell: Spell, rulesetId?: RulesetId | null): SpellDetail {
  const shown = resolveSpellVersion(spell, rulesetId);
  return {
    ...(hasSpellVersion(spell.id, rulesetId) && !spell.rulesetId ? { versionLabel: 'SRD 5.2.1 version' } : {}),
    stats: [
      { label: 'Casting Time', value: shown.castingTime },
      { label: 'Range', value: shown.range },
      { label: 'Components', value: (shown.components ?? []).join(', ') },
      { label: 'Duration', value: shown.duration },
    ].filter(s => !!s.value),
    description: shown.description,
    upcast: shown.upcast ?? null,
  };
}
