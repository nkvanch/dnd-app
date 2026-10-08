// src/content/backgrounds/__tests__/backgroundBrowse.test.ts
// FILTER-METADATA-2: backgroundSkillGrants() replaces the old screen-local
// BG_SKILL_MAP/BG_DETAIL.skillProficiencies duplication — this locks in
// that it reads the real grant_proficiency effects correctly for both
// official content and an equivalent homebrew shape.
import { backgroundSkillGrants } from '../backgroundBrowse';
import { bgAcolyte, bgCriminal, ALL_BACKGROUNDS } from '../index';
import type { Background } from '../../../engine/types';

describe('backgroundSkillGrants', () => {
  it('derives Acolyte\'s real skill grants from its own feature effects', () => {
    expect(backgroundSkillGrants(bgAcolyte).sort()).toEqual(['insight', 'religion'].sort());
  });

  it('derives Criminal\'s real skill grants', () => {
    expect(backgroundSkillGrants(bgCriminal).sort()).toEqual(['deception', 'stealth'].sort());
  });

  it('returns an empty array for a background with no skill-granting feature', () => {
    const bg: Background = {
      id: 'blank', name: 'Blank', features: [
        { id: 'f1', name: 'Flavor', description: 'x', source: { kind: 'background', refId: 'blank' }, level: null, effects: [], actions: [], choices: [], passive: true },
      ],
    };
    expect(backgroundSkillGrants(bg)).toEqual([]);
  });

  it('works identically for a homebrew-shaped background (same Effect shape)', () => {
    const bg: Background = {
      id: 'hb_test', name: 'Homebrew Test', features: [
        {
          id: 'hb_test_skills', name: 'Skills', description: '', source: { kind: 'background', refId: 'hb_test' },
          level: null, actions: [], choices: [], passive: true,
          effects: [{ type: 'grant_proficiency', target: 'skill:arcana', operation: 'add', value: null, condition: null }],
        },
      ],
    };
    expect(backgroundSkillGrants(bg)).toEqual(['arcana']);
  });

  it('every classic PHB background has a toolProficiencies field (even if empty array, never undefined)', () => {
    // The 5.5e proof-slice background (acolyte_2024) deliberately leaves
    // this disclosed-only (its own doc comment explains why — no BG_DETAIL
    // equivalent was ever authored for it), so it's excluded here.
    for (const bg of ALL_BACKGROUNDS.filter(b => !b.rulesetId)) {
      expect(bg.toolProficiencies).toBeDefined();
    }
  });
});
