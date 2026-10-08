import { spellDetail } from '../spellDetail';
import { SPELL_VERSIONS_2024 } from '../spellVersions2024';
import { FULL_SPELL_LIBRARY } from '../index';
import type { RulesetId } from '../../../engine/types';

const R2024 = 'dnd5e-2024' as RulesetId;
const R2014 = 'dnd5e-2014' as RulesetId;

describe('Compendium spell detail', () => {
  const id = Object.keys(SPELL_VERSIONS_2024).find(k => {
    const lib = FULL_SPELL_LIBRARY.find(s => s.id === k);
    return lib && lib.description !== SPELL_VERSIONS_2024[k].description && !lib.rulesetId;
  })!;
  const spell = FULL_SPELL_LIBRARY.find(s => s.id === id)!;

  it('shows the SRD 5.2.1 version, labelled, when the ruleset is 2024', () => {
    const d = spellDetail(spell, R2024);
    expect(d.versionLabel).toBe('SRD 5.2.1 version');
    expect(d.description).toBe(SPELL_VERSIONS_2024[id].description);
    expect(d.stats.map(s => s.label)).toEqual(expect.arrayContaining(['Casting Time', 'Range', 'Duration']));
  });

  it('shows the library record, unlabelled, for 2014 or no ruleset', () => {
    for (const r of [R2014, undefined, null]) {
      const d = spellDetail(spell, r);
      expect(d.versionLabel).toBeUndefined();
      expect(d.description).toBe(spell.description);
    }
  });

  it('a spell with no 2024 version is not labelled under 2024', () => {
    const plain = FULL_SPELL_LIBRARY.find(s => !(s.id in SPELL_VERSIONS_2024) && !s.rulesetId)!;
    expect(spellDetail(plain, R2024).versionLabel).toBeUndefined();
  });
});
