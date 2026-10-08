// src/content/spells/spellDetail.ts
// What the Compendium shows when a spell is expanded: the record resolved for the active ruleset (the SRD 5.2.1
// version under 2024, the library record otherwise) as display lines, and a label saying which version it is.
// Pure, so the screen and the tests share it.
import type { RulesetId, Spell } from '../../engine/types';
import { hasSpellVersion, resolveSpellVersion } from './spellVersions';

const RULESET_2024 = 'dnd5e-2024' as RulesetId;

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
    // Under the built-in overlay the library record is replaced by its 2024 version; with content packs the repo already hands out
    // the 2024 record (tagged with its ruleset), so that is labelled the same way.
    ...((hasSpellVersion(spell.id, rulesetId) && !spell.rulesetId) || (rulesetId === RULESET_2024 && spell.rulesetId === RULESET_2024) ? { versionLabel: 'SRD 5.2.1 version' } : {}),
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
