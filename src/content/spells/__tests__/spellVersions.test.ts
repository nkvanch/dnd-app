// Jest resolves the SQLite-backed (native) spell repo by default; these tests use the in-memory one the web build uses.
jest.mock('../../spellRepo', () => jest.requireActual('../../spellRepo.ts'));

import { FULL_SPELL_LIBRARY } from '../index';
import { SPELL_VERSIONS_2024 } from '../spellVersions2024';
import { resolveSpellVersion, hasSpellVersion } from '../spellVersions';
import { spellRepo } from '../../spellRepo';
import { resolveSpellById } from '../../contentResolution';
import { generateSpellCard } from '../../../engine/actionCards';
import { newChar } from '../../classes2024/testKit';
import { Spell } from '../../../engine/types';

const lib = FULL_SPELL_LIBRARY as Spell[];
const base = (id: string) => lib.find(s => s.id === id)!;
const R2024 = 'dnd5e-2024' as never;

describe('spell versions (SRD 5.2.1)', () => {
  it('covers 333 library spells, every id exists, and every version is complete', () => {
    const ids = Object.keys(SPELL_VERSIONS_2024);
    expect(ids).toHaveLength(333);
    const known = new Set(lib.map(s => s.id));
    expect(ids.filter(id => !known.has(id))).toEqual([]);
    for (const id of ids) {
      const v = SPELL_VERSIONS_2024[id];
      expect(v.description.length).toBeGreaterThan(20);
      expect(v.castingTime).toBeTruthy();
      expect(v.range).toBeTruthy();
      expect(v.duration).toBeTruthy();
      expect(v.components.length).toBeGreaterThan(0);
      expect(v.components.every(c => ['V', 'S', 'M'].includes(c))).toBe(true);
      expect(v.level).toBeGreaterThanOrEqual(0);
      expect(v.level).toBeLessThanOrEqual(9);
      expect(v.description).not.toMatch(/Rules Glossary|System Reference Document/);
    }
  });

  it('a 2024 character sees the 2024 version; every other ruleset keeps the library record', () => {
    const acid = base('acid_splash');
    expect(acid.school).toBe('Conjuration');
    const v = resolveSpellVersion(acid, R2024);
    expect(v.school).toBe('Evocation');
    expect(v.castingTime).toBe('Action');
    expect(v.description).toMatch(/5-foot-radius Sphere/);
    expect(v.classes).toBe(acid.classes);            // everything the version does not state is kept
    expect(resolveSpellVersion(acid, undefined)).toBe(acid);
    expect(resolveSpellVersion(acid, 'dnd5e-2014' as never)).toBe(acid);
    expect(resolveSpellVersion(acid, null)).toBe(acid);
  });

  it('is cached, and a spell that belongs to one ruleset by definition has nothing to override', () => {
    const a = resolveSpellVersion(base('fireball'), R2024);
    expect(resolveSpellVersion(base('fireball'), R2024)).toBe(a);
    const smite = base('divine_smite');
    expect(resolveSpellVersion(smite, R2024)).toBe(smite);
    expect(hasSpellVersion('divine_smite', R2024)).toBe(false);
    expect(hasSpellVersion('fireball', R2024)).toBe(true);
    expect(hasSpellVersion('fireball', undefined)).toBe(false);
  });

  it('keeps ritual and concentration from the 2024 text, the material component and the upcast text', () => {
    expect(resolveSpellVersion(base('alarm'), R2024)).toMatchObject({ ritual: true, material: 'a bell and silver wire' });
    expect(resolveSpellVersion(base('fireball'), R2024).upcast).toMatch(/for each spell slot level above 3/);
    expect(resolveSpellVersion(base('hold_person'), R2024).concentration).toBe(true);
  });

  it('the spell repo and the content resolver hand the 2024 version to a 2024 character', () => {
    expect(spellRepo.getSpellSync('acid_splash')!.school).toBe('Conjuration');
    expect(spellRepo.getSpellSync('acid_splash', R2024)!.school).toBe('Evocation');
    expect(resolveSpellById('acid_splash', [], R2024)!.school).toBe('Evocation');
    expect(resolveSpellById('acid_splash', [])!.school).toBe('Conjuration');
  });

  it("a homebrew spell with an official id wins and is never replaced by the SRD version", () => {
    const mine = { ...base('fireball'), description: 'My table fireball.' } as Spell;
    expect(resolveSpellById('fireball', [mine], R2024)!.description).toBe('My table fireball.');
  });

  it("a spell card for a 2024 character uses the 2024 data (Acid Splash is Evocation in 2024, Conjuration before)", () => {
    let e = newChar('wizard');
    e = { ...e, spellcasting: { ...e.spellcasting!, cantrips: ['acid_splash'] } };
    expect(generateSpellCard('acid_splash', e)!.layer1).toMatch(/Evocation/);
    expect(generateSpellCard('acid_splash', { ...e, rulesetId: 'dnd5e-2014' as never })!.layer1).toMatch(/Conjuration/);
  });
});
