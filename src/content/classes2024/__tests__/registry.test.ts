import { CLASSES_2024, SUBCLASSES_2024 } from '../index';
import { FULL_ITEM_LIBRARY } from '../../items/index';
import { FULL_SPELL_LIBRARY } from '../../spells/index';
import { ALL_CHAR_CLASSES_CATALOG } from '../../classes/index';
import { ALL_SUBCLASSES } from '../../subclasses/index';

const itemIds = new Set(FULL_ITEM_LIBRARY.map((i: any) => i.id));
const spellIds = new Set(FULL_SPELL_LIBRARY.map((s: any) => s.id));

describe('2024 classes (SRD 5.2.1) registry', () => {
  it('has all twelve classes, each with one subclass, tagged dnd5e-2024 and not claiming to be SRD 5.1', () => {
    expect(CLASSES_2024.map(c => c.id).sort()).toEqual(['barbarian', 'bard', 'cleric', 'druid', 'fighter', 'monk', 'paladin', 'ranger', 'rogue', 'sorcerer', 'warlock', 'wizard'].map(n => `${n}_2024`));
    for (const c of CLASSES_2024) {
      expect(c.rulesetId).toBe('dnd5e-2024');
      expect(c.srd).toBe(false);
      expect(c.rawProgression!.entries).toHaveLength(20);
      expect(SUBCLASSES_2024.filter(s => s.classId === c.id)).toHaveLength(1);
    }
  });

  it("is reachable from the app's class and subclass catalogs", () => {
    for (const c of CLASSES_2024) expect(ALL_CHAR_CLASSES_CATALOG.some((x: any) => x.id === c.id)).toBe(true);
    for (const s of SUBCLASSES_2024) expect(ALL_SUBCLASSES.some((x: any) => x.id === s.id)).toBe(true);
  });

  it('every starting-equipment item id exists in the item catalog', () => {
    const missing: string[] = [];
    for (const c of CLASSES_2024) for (const e of c.rawProgression!.entries) for (const ch of e.choices) {
      if (ch.kind === 'equipment') for (const o of (Array.isArray(ch.pool) ? ch.pool : [])) for (const id of (o.value as string[])) if (!itemIds.has(id)) missing.push(`${c.id}:${id}`);
    }
    expect(missing).toEqual([]);
  });

  it('every always-prepared / granted spell id exists in the spell library', () => {
    const missing: string[] = [];
    const checkEffects = (owner: string, effects: any[]) => {
      for (const e of effects ?? []) for (const id of [...(e.spellIds ?? []), ...(e.cantripIds ?? [])]) if (!spellIds.has(id)) missing.push(`${owner}:${id}`);
    };
    const scan = (owner: string, grants: any[]) => {
      for (const g of grants) {
        if (g.kind === 'known_spells') for (const id of g.value.spellIds) if (!spellIds.has(id)) missing.push(`${owner}:${id}`);
        if (g.kind === 'feature') checkEffects(owner, g.value.effects);
      }
    };
    const scanChoices = (owner: string, choices: any[]) => {
      for (const ch of choices) for (const o of (Array.isArray(ch.pool) ? ch.pool : [])) checkEffects(owner, (o.value as any)?.effects);
    };
    for (const c of CLASSES_2024) for (const e of c.rawProgression!.entries) { scan(c.id, e.grants); scanChoices(c.id, e.choices); }
    for (const s of SUBCLASSES_2024) for (const e of s.entries) { scan(s.id, e.grants); scanChoices(s.id, e.choices); }
    expect(missing).toEqual([]);
  });

  it('every spellcasting class resolves a 2024 spell list', () => {
    for (const c of CLASSES_2024.filter(x => x.spellcastingAbility)) {
      const known = FULL_SPELL_LIBRARY.filter((s: any) => (s.classes ?? []).includes(c.id));
      expect(known.length).toBeGreaterThan(20);
    }
  });
});
