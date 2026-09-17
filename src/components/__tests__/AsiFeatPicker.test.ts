// src/components/__tests__/AsiFeatPicker.test.ts
// LIVE-RULESET-2 (item 9): pure-logic coverage for AsiFeatPicker's ruleset
// compatibility filter — filterFeatsByRuleset is the exact function the
// component itself calls to build its feat pool, so these tests exercise
// the real code path without rendering the RN component (no RTL/render
// harness exists anywhere in this repo — see rulesetChange.test.ts,
// FeatPreviewModal.test.ts, etc. for the same established pattern).
import { filterFeatsByRuleset } from '../AsiFeatPicker';
import { Feat, RulesetId } from '../../engine/types';

function feat(id: string, rulesetId?: string): Feat {
  return {
    id, name: id, prerequisite: null, description: '', source: 'test',
    feature: { id: `${id}_f`, name: id, description: '', source: { kind: 'feat', refId: id }, level: null, effects: [], actions: [], choices: [], passive: true },
    rulesetId: rulesetId as RulesetId | undefined,
  };
}

describe('filterFeatsByRuleset', () => {
  it('shows every feat, tagged or not, when the entity has no rulesetId of its own (today\'s default for every existing character)', () => {
    const feats = [feat('alert'), feat('human_bonus_feat_2024', 'dnd5e-2024'), feat('old_feat_2014', 'dnd5e-2014')];
    expect(filterFeatsByRuleset(feats, undefined).map(f => f.id)).toEqual(['alert', 'human_bonus_feat_2024', 'old_feat_2014']);
  });

  it('keeps an untagged feat visible regardless of the entity\'s ruleset — untagged = shared', () => {
    const feats = [feat('alert')];
    expect(filterFeatsByRuleset(feats, 'dnd5e-2024' as RulesetId).map(f => f.id)).toEqual(['alert']);
  });

  it('keeps a feat tagged for the entity\'s CURRENT ruleset visible', () => {
    const feats = [feat('weapon_mastery_feat', 'dnd5e-2024')];
    expect(filterFeatsByRuleset(feats, 'dnd5e-2024' as RulesetId).map(f => f.id)).toEqual(['weapon_mastery_feat']);
  });

  it('excludes a feat tagged for a DIFFERENT ruleset than the entity\'s current one', () => {
    const feats = [feat('old_only_feat', 'dnd5e-2014')];
    expect(filterFeatsByRuleset(feats, 'dnd5e-2024' as RulesetId)).toEqual([]);
  });

  it('a homebrew feat tagged only for the OLD ruleset becomes incompatible (excluded) after switching, and switching back re-includes it', () => {
    const homebrewFeat = feat('homebrew_2014_only', 'dnd5e-2014');
    const pool = [homebrewFeat];
    // Character starts on 2014 — visible.
    expect(filterFeatsByRuleset(pool, 'dnd5e-2014' as RulesetId).map(f => f.id)).toEqual(['homebrew_2014_only']);
    // Switches to 2024 — no longer offered as a NEW pick (it's still on
    // the character if already taken; this filter only governs what's
    // offered for a fresh pick).
    expect(filterFeatsByRuleset(pool, 'dnd5e-2024' as RulesetId)).toEqual([]);
    // Switches back to 2014 — visible again.
    expect(filterFeatsByRuleset(pool, 'dnd5e-2014' as RulesetId).map(f => f.id)).toEqual(['homebrew_2014_only']);
  });

  it('mixed pool: only the current-ruleset and untagged feats pass, the wrong-ruleset one is excluded', () => {
    const feats = [feat('alert'), feat('current', 'dnd5e-2024'), feat('other', 'dnd5e-2014')];
    expect(filterFeatsByRuleset(feats, 'dnd5e-2024' as RulesetId).map(f => f.id).sort()).toEqual(['alert', 'current']);
  });
});
