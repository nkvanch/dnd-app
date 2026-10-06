// ============================================================================
// FILE: src/content/conditions/resolve.ts
// One condition record per id for a ruleset. 5e and 5.5e have the same condition ids (`blinded`, `grappled`: the engine reads them)
// with different wording, so the two editions' records are told apart by `rulesetId` and a character resolves its own edition's:
// a record written for the ruleset wins, then one written for no particular ruleset, then the last record there is.
// ============================================================================
import type { Condition, RulesetId } from '../../engine/types';
import { matchesRuleset } from '../../engine/types';

export function conditionForRuleset(records: readonly Condition[], id: string, target: RulesetId | undefined): Condition | undefined {
  const versions = records.filter(c => c.id === id);
  if (versions.length === 0) return undefined;
  const last = <T,>(l: T[]): T | undefined => l[l.length - 1];
  if (!target) return last(versions.filter(v => !v.rulesetId)) ?? last(versions);
  return last(versions.filter(v => v.rulesetId === target)) ?? last(versions.filter(v => !v.rulesetId));
}

/** The conditions of a ruleset, one per id, in the order the records first appear. With no ruleset, every record (all editions). */
export function conditionsForRuleset(records: readonly Condition[], target: RulesetId | undefined): Condition[] {
  if (!target) return [...records];
  const ids = [...new Set(records.map(c => c.id))];
  return ids
    .map(id => conditionForRuleset(records.filter(c => matchesRuleset(c.rulesetId, target)), id, target))
    .filter((c): c is Condition => !!c);
}
