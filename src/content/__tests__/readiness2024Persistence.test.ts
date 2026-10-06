// A 2024 character written through the real entityRepo (saveEntity) and read back by it after a "restart" (a fresh module registry, so nothing in memory
// is reused) comes back with its ruleset, species, background, class, subclass, choices, Heroic Inspiration, weapon mastery and pools intact.
import { buildSrd51Pack, buildSrd521Pack, serializePack } from '../packs/srdPacks';
import { packContentProvider } from '../provider/contentProvider';
import { createCharacter, recomputeContentOf } from '../provider/createCharacter';
import { levelUpClass } from '../../engine/leveling';
import { recomputeDerived } from '../../engine/pipeline';
import { DEFAULT_RULES } from '../../store/characterStore';
import { gainHeroicInspiration } from '../../engine/heroicInspiration';
import { setWeaponMasteryPicks, eligibleMasteryWeapons } from '../../engine/weaponMastery';
import { Entity, RulesetId } from '../../engine/types';

const packs = [buildSrd51Pack(), buildSrd521Pack()].map(p => JSON.parse(serializePack(p)));
const provider = packContentProvider(packs, 'dnd5e-2024' as RulesetId);
const stats = { str: 15, dex: 14, con: 14, int: 12, wis: 12, cha: 10 };

describe('2024 character through the persistence layer', () => {
  for (const [classId, raceId, bg] of [['fighter_2024', 'orc_2024', 'soldier_2024'], ['wizard_2024', 'human_2024', 'sage_2024'], ['warlock_2024', 'dragonborn_2024', 'acolyte_2024']] as const) {
    it(`${classId}: saved, then loaded by a fresh repo, is the same character`, async () => {
      const cls = provider.getClass(classId)!;
      let e = createCharacter(provider, { id: classId, name: classId, classId, raceId, backgroundId: bg, stats, level: 1 }, DEFAULT_RULES);
      for (let l = 2; l <= 11; l++) e = levelUpClass(e, cls.id, cls.rawProgression!, DEFAULT_RULES, cls, provider.classes());
      e = gainHeroicInspiration(e).entity;
      if (classId === 'fighter_2024') e = setWeaponMasteryPicks(e, eligibleMasteryWeapons(e).slice(0, 3).map(w => w.id));
      e = recomputeDerived(e, DEFAULT_RULES, recomputeContentOf(provider));

      const rows = new Map<string, { id: string; kind: string; data: string; updatedAt: number }>();
      jest.resetModules();
      jest.doMock('../../db/db', () => ({ getDb: () => ({
        runAsync: async (_sql: string, p: unknown[]) => { rows.set(String(p[0]), { id: String(p[0]), kind: String(p[1]), data: String(p[2]), updatedAt: Number(p[3]) }); },
        getFirstAsync: async (_sql: string, p: unknown[]) => rows.get(String(p[0])) ?? null,
        getAllAsync: async () => [...rows.values()],
      }) }));
      const writer = require('../../db/entityRepo') as typeof import('../../db/entityRepo');
      await writer.saveEntity(e);
      jest.resetModules();                                       // the restart: nothing from the writer survives
      jest.doMock('../../db/db', () => ({ getDb: () => ({ getFirstAsync: async (_s: string, p: unknown[]) => rows.get(String(p[0])) ?? null, getAllAsync: async () => [...rows.values()], runAsync: async () => {} }) }));
      const reader = require('../../db/entityRepo') as typeof import('../../db/entityRepo');
      const back = (await reader.loadEntity(classId)) as Entity;

      expect(back).toBeTruthy();
      expect(back.rulesetId).toBe('dnd5e-2024');
      for (const k of ['classId', 'raceId', 'backgroundId', 'subclassId', 'level'] as const) expect(back.identity[k]).toEqual(e.identity[k]);
      expect(back.heroicInspiration).toBe(true);
      expect(back.features.map(f => f.id)).toEqual(e.features.map(f => f.id));
      expect(back.choices.map(c => [c.id, c.resolved, c.selections])).toEqual(e.choices.map(c => [c.id, c.resolved, c.selections]));
      expect(back.resources.custom.map(r => [r.id, r.maximum])).toEqual(e.resources.custom.map(r => [r.id, r.maximum]));
      expect(back.resources.hp.maximum).toBe(e.resources.hp.maximum);
      expect(back.derived.ac).toBe(e.derived.ac);
      expect(back.spellcasting?.known ?? []).toEqual(e.spellcasting?.known ?? []);
      expect(back.spellcasting?.pactSlots ?? null).toEqual(e.spellcasting?.pactSlots ?? null);
      expect(JSON.stringify(back.weaponMastery ?? null)).toBe(JSON.stringify(e.weaponMastery ?? null));
      if (classId === 'fighter_2024') expect(back.weaponMastery?.picks).toHaveLength(3);
    });
  }
});
