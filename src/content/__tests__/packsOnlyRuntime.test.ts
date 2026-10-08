// The app as it ships: every catalog module is the empty one (metro.config.js), and content comes only from installed packs. This
// runs the real flows on that: install the signed bundled packs, build 5e and 5.5e characters, level them, read spells, items,
// monsters, conditions, beast forms and rules tables. Anything that still leaned on a built-in catalog would find nothing here.
jest.mock('../spells/index', () => jest.requireActual('../empty/spells'));
jest.mock('../items/index', () => jest.requireActual('../empty/items'));
jest.mock('../classes/index', () => jest.requireActual('../empty/classes'));
jest.mock('../races/index', () => jest.requireActual('../empty/races'));
jest.mock('../backgrounds/index', () => jest.requireActual('../empty/backgrounds'));
jest.mock('../feats/index', () => jest.requireActual('../empty/feats'));
jest.mock('../subclasses/index', () => jest.requireActual('../empty/subclasses'));
jest.mock('../monsters/srd', () => jest.requireActual('../empty/monsters'));
jest.mock('../beastforms/index', () => jest.requireActual('../empty/beastforms'));
jest.mock('../infusions/index', () => jest.requireActual('../empty/infusions'));
jest.mock('../companions/index', () => jest.requireActual('../empty/companions'));
jest.mock('../conditions/index', () => jest.requireActual('../empty/conditions'));
jest.mock('../conditions/conditions2024', () => jest.requireActual('../empty/conditions2024'));
jest.mock('../spells/spellVersions2024', () => jest.requireActual('../empty/spellVersions2024'));
jest.mock('../feats/origin2024', () => jest.requireActual('../empty/origin2024'));
jest.mock('../rules/rulesReference2024Data', () => jest.requireActual('../empty/rulesReference2024Data'));
jest.mock('../builtinHomebrew', () => jest.requireActual('../empty/builtinHomebrew'));

import { BUNDLED_PACKS, installBundledPacks } from '../bundledPacks';
import { PackStore, resetOfficialPackService, installedOfficialPacks } from '../officialPackService';
import { clearOfficialPacks } from '../officialPacks';
import { getOfficialContentProvider } from '../officialSource';
import { globalContentDB } from '../classes/library';
import { createCharacter } from '../provider/createCharacter';
import { findBeastForm, officialMonsters, originFeats } from '../runtimeRules';
import { lookupConditionFor } from '../conditions/lookup';
import { mergeItemIndex, resolveItemById, mergeMonsterIndex } from '../contentResolution';
import { spellRepo } from '../spellRepo';
import { itemRepo } from '../itemRepo';
import { getSubclassesForClass } from '../subclasses';
import { useHomebrewStore } from '../../store/homebrewStore';
import { applyPoolChoiceToEntity } from '../../engine/leveling';
import { buildDemoCharacter } from '../../engine/demoCharacter';
import { DEFAULT_RULES } from '../../store/characterStore';
import { Entity, RulesetId } from '../../engine/types';

const R2024 = 'dnd5e-2024' as RulesetId;
const store: PackStore = { save: async () => {}, load: async () => [], remove: async () => {} };
const stats = { str: 15, dex: 14, con: 14, int: 10, wis: 12, cha: 8 };

describe('the shipped app, packs only', () => {
  it('has no content at all until packs are installed', () => {
    resetOfficialPackService(); clearOfficialPacks();
    expect(globalContentDB.classes).toEqual([]);
    expect(globalContentDB.races).toEqual([]);
    expect(globalContentDB.conditions).toEqual([]);
    expect(officialMonsters()).toEqual([]);
    expect(spellRepo.getIndex()).toEqual([]);
    expect(itemRepo.getIndex()).toEqual([]);
    expect(() => buildDemoCharacter(DEFAULT_RULES)).toThrow(/SRD 5\.1 content pack/);
  });

  describe('with the bundled SRD packs installed', () => {
    beforeAll(async () => {
      resetOfficialPackService(); clearOfficialPacks();
      expect(await installBundledPacks(BUNDLED_PACKS.map(p => p.id), store)).toEqual({ ok: true });
    });
    afterAll(() => { resetOfficialPackService(); clearOfficialPacks(); });

    it('serves classes, species, backgrounds, feats, subclasses, conditions and monsters from the packs', () => {
      expect(installedOfficialPacks()).toHaveLength(2);
      const ids = globalContentDB.classes.map(c => c.id);
      expect(ids).toEqual(expect.arrayContaining(['fighter', 'wizard', 'fighter_2024', 'druid_2024']));
      expect(ids).not.toContain('artificer');
      expect(globalContentDB.races.length).toBeGreaterThanOrEqual(18);
      expect(getSubclassesForClass('fighter').length).toBeGreaterThan(0);
      expect(officialMonsters().length).toBe(322);
      expect(mergeMonsterIndex([]).length).toBe(322);
      expect(originFeats().map(f => f.id)).toContain('alert_2024');
      expect(lookupConditionFor('blinded', R2024)!.rulesetId).toBe(R2024);
      expect(lookupConditionFor('blinded', undefined)).toBeTruthy();
      expect(useHomebrewStore.getState().getMergedContentDB(R2024).conditions).toHaveLength(14);
    });

    it('serves spells and items through the repos, and item editions resolve', () => {
      expect(spellRepo.getIndex().length).toBeGreaterThan(300);
      expect(spellRepo.getSpellSync('fireball')?.name).toBe('Fireball');
      expect(itemRepo.getIndex().length).toBeGreaterThan(300);
      expect(mergeItemIndex([], R2024).some(i => i.id === 'bag_of_holding_2024')).toBe(true);
      expect(resolveItemById('bag_of_holding', [], R2024)!.id).toBe('bag_of_holding_2024');
    });

    it('serves the rules tables: beast forms, companions and infusions come from the packs, with no non-SRD content present', () => {
      expect(findBeastForm('wolf')).toBeTruthy();
      expect(findBeastForm('wolf_2024')).toBeTruthy();
      expect(findBeastForm('air_elemental')).toBeTruthy();
      expect(getOfficialContentProvider()!.ruleRecords('infusions')).toEqual([]);
      expect(getOfficialContentProvider()!.ruleRecords('companions')).toEqual([]);
    });

    it('builds and levels a 5e Fighter and a 5.5e Druid from packs alone', () => {
      const p = getOfficialContentProvider()!;
      const fighter = createCharacter(p, { id: 'f', name: 'F', classId: 'fighter', raceId: 'human', backgroundId: 'acolyte', stats, level: 3 }, DEFAULT_RULES);
      expect(fighter.identity.level).toBe(3);
      expect(fighter.derived.ac).toBeGreaterThan(9);
      let druid: Entity = createCharacter(p.rulesetId ? p : p, { id: 'd', name: 'D', classId: 'druid_2024', raceId: 'elf_2024', backgroundId: 'sage_2024', stats, level: 2 }, DEFAULT_RULES);
      const forms = druid.choices.find(c => c.definition.id === 'druid_2024_wild_forms_2')!;
      expect(forms.definition.count).toBe(4);
      druid = applyPoolChoiceToEntity(druid, forms.id, ['wild_form_wolf_2024', 'wild_form_rat_2024', 'wild_form_spider_2024', 'wild_form_riding_horse_2024'], DEFAULT_RULES);
      expect(druid.features.some(f => f.name === 'Wild Shape: Wolf')).toBe(true);
    });

    it('builds the sample character from the packs', () => {
      const demo = buildDemoCharacter(DEFAULT_RULES);
      expect(demo.identity.classId).toBe('fighter');
      expect(demo.identity.level).toBe(3);
    });
  });
});
