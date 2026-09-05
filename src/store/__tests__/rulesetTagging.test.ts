// src/store/__tests__/rulesetTagging.test.ts
// End-to-end proof for Phase 5 of the fundamental-changes migration: does
// the ruleset-tagging pipeline built in Phases 3/4 (branded RulesetId,
// Race.rulesetId/Background.rulesetId, matchesRuleset(),
// getMergedContentDB()'s ruleset filter) actually work, exercised by two
// real pieces of content (raceHuman2024 in src/content/races/index.ts,
// bgAcolyte2024 in src/content/backgrounds/index.ts) rather than just
// unit-tested in isolation? Lives here (not under content/races or
// content/backgrounds) because it's really testing homebrewStore's merge
// function, not any one content type.
import { useHomebrewStore } from '../homebrewStore';
import { asRulesetId } from '../../engine/types';

describe('ruleset tagging end-to-end (Phase 5 proof slice)', () => {
  it('a 5.5e-active view sees 5.5e-tagged races AND backgrounds, plus untagged/shared content', () => {
    const db = useHomebrewStore.getState().getMergedContentDB(asRulesetId('5.5e'));
    const raceIds = db.races.map(r => r.id);
    const bgIds   = db.backgrounds.map(b => b.id);
    expect(raceIds).toContain('human_2024'); // 5.5e-tagged — matches exactly
    expect(raceIds).toContain('human');      // untagged — shared across every ruleset
    expect(raceIds).toContain('elf');        // untagged — shared across every ruleset
    expect(bgIds).toContain('acolyte_2024'); // 5.5e-tagged — separate filter code path from races
    expect(bgIds).toContain('acolyte');      // untagged — shared across every ruleset
  });

  it('an explicit 5e-active view does NOT see 5.5e-tagged content, but still sees untagged/shared content', () => {
    const db = useHomebrewStore.getState().getMergedContentDB(asRulesetId('5e'));
    const raceIds = db.races.map(r => r.id);
    const bgIds   = db.backgrounds.map(b => b.id);
    expect(raceIds).not.toContain('human_2024');
    expect(raceIds).toContain('human');
    expect(raceIds).toContain('elf');
    expect(bgIds).not.toContain('acolyte_2024');
    expect(bgIds).toContain('acolyte');
  });

  it('no active ruleset (today\'s default, before any picker UI exists) applies no filter at all', () => {
    const db = useHomebrewStore.getState().getMergedContentDB();
    const raceIds = db.races.map(r => r.id);
    const bgIds   = db.backgrounds.map(b => b.id);
    expect(raceIds).toContain('human_2024');
    expect(raceIds).toContain('human');
    expect(raceIds).toContain('elf');
    expect(bgIds).toContain('acolyte_2024');
    expect(bgIds).toContain('acolyte');
  });
});
