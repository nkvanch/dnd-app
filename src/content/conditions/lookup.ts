// ============================================================================
// FILE: src/content/conditions/lookup.ts
// The condition an ability applies by id, for the edition of whoever it is applied to: a 5.5e character gets the 2024 record
// (same id, 2024 wording and the Petrified poison immunity), anyone else the 2014 one. Installed packs are consulted first
// (officialSource.ts), then the built-in records, then the homebrew conditions the homebrew store registered.
// ============================================================================
import type { Condition, RulesetId } from '../../engine/types';
import { getOfficialContentProvider } from '../officialSource';
import { ALL_CONDITIONS, lookupCondition } from './index';
import { CONDITIONS_2024 } from './conditions2024';
import { conditionForRuleset } from './resolve';

export function lookupConditionFor(id: string, ruleset: RulesetId | undefined): Condition | undefined {
  const provider = getOfficialContentProvider();
  const official = provider ? provider.getCondition(id, ruleset) : conditionForRuleset([...ALL_CONDITIONS, ...CONDITIONS_2024], id, ruleset);
  return official ?? lookupCondition(id);
}
