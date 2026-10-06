// The creation screens read races, classes, backgrounds, feats and subclasses through the official catalog
// (globalContentDB, the merged content database, subclass browsing). These tests make installed packs the official
// source and check that exactly those readers now serve pack content, and that a character built the way the class
// screen builds one comes out the same as from the hardcoded catalog.
import { buildSrd51Pack, buildSrd521Pack, serializePack } from '../../packs/srdPacks';
import { packContentProvider, InstalledPack } from '../contentProvider';
import { setOfficialContentProvider, officialContentVersion } from '../../officialSource';
import { globalContentDB } from '../../classes/library';
import { subclassEntriesForClassMerged } from '../../subclasses/subclassBrowse';
import { useHomebrewStore } from '../../../store/homebrewStore';
import { officialContentDB } from '../../officialCatalog';
import { isOfficialRef } from '../../officialRefs';
import { currentContentExposure } from '../../contentExposure';
import { makeEmptyEntity, DEFAULT_RULES } from '../../../store/characterStore';
import { acquireClass, levelUpClass, applySubclassToEntity } from '../../../engine/leveling';
import { getProgressionForClass, mergeSubclassIntoProgression } from '../../classes/progressions';
import { RulesetId } from '../../../engine/types';
import { useOfficialPacks, clearOfficialPacks, officialPacksInstalled } from '../../officialPacks';

const R2024 = 'dnd5e-2024' as RulesetId;
const R2014 = 'dnd5e-2014' as RulesetId;

const packs: InstalledPack[] = [buildSrd51Pack(), buildSrd521Pack()].map(p => JSON.parse(serializePack(p)));
const merged = (ruleset?: RulesetId) => useHomebrewStore.getState().getMergedContentDB(ruleset);
const strip = (r: unknown) => { const { provenance, rawProgression, ...rest } = r as Record<string, unknown>; void provenance; void rawProgression; return JSON.stringify(rest); };

afterEach(() => setOfficialContentProvider(null));

describe('creation screens on installed packs', () => {
  it('switching the official source changes what the catalog and the merged database serve', () => {
    const before = officialContentVersion();
    const staticClasses = globalContentDB.classes;
    expect(staticClasses.some(c => c.id === 'artificer')).toBe(true);        // the hardcoded catalog carries classes outside the SRD
    setOfficialContentProvider(packContentProvider(packs));
    expect(officialContentVersion()).toBe(before + 1);
    const ids = globalContentDB.classes.map(c => c.id);
    expect(ids).toEqual(expect.arrayContaining(['fighter', 'wizard', 'fighter_2024', 'wizard_2024']));
    expect(ids).not.toContain('artificer');                                    // a pack never carries private content
    expect(merged(R2024).classes.map(c => c.id)).toEqual(expect.arrayContaining(['fighter_2024', 'warlock_2024']));
    expect(merged(R2024).classes.some(c => c.id === 'artificer')).toBe(false);
  });

  it('every pack record the screens list is identical to the hardcoded catalog record (provenance aside)', () => {
    const catalog = { races: globalContentDB.races, classes: globalContentDB.classes, backgrounds: globalContentDB.backgrounds, feats: globalContentDB.feats ?? [] };
    setOfficialContentProvider(packContentProvider(packs));
    const fromPacks = { races: globalContentDB.races, classes: globalContentDB.classes, backgrounds: globalContentDB.backgrounds, feats: globalContentDB.feats ?? [] };
    for (const kind of ['races', 'backgrounds', 'feats', 'classes'] as const) {
      const byId = new Map<string, unknown>(catalog[kind].map(r => [r.id, r]));
      const differing: string[] = [];
      for (const rec of fromPacks[kind]) {
        const base = byId.get(rec.id);
        if (!base) { differing.push(`${rec.id} (not in the catalog)`); continue; }
        if (strip(base) !== strip(rec)) differing.push(rec.id);
      }
      expect([kind, differing]).toEqual([kind, []]);
      expect(fromPacks[kind].every(r => (r as { provenance?: { kind: string } }).provenance?.kind === 'srd')).toBe(true);
    }
  });

  it('the Official view, the official-reference check and the exposure rule follow the packs', () => {
    setOfficialContentProvider(packContentProvider(packs));
    expect(officialContentDB(R2024).classes.some(c => c.id === 'sorcerer_2024')).toBe(true);
    expect(officialContentDB(R2024).feats.some(f => f.id === 'alert_2024')).toBe(true);
    expect(isOfficialRef({ type: 'class', id: 'wizard_2024' } as never)).toBe(true);
    expect(isOfficialRef({ type: 'class', id: 'artificer' } as never)).toBe(false);
    expect(currentContentExposure().srdOnly).toBe(false);                         // pack content is not filtered by the SRD 5.1 flag
    setOfficialContentProvider(null);
    expect(isOfficialRef({ type: 'class', id: 'artificer' } as never)).toBe(true);
  });

  it('subclass browsing reads the pack: the 2024 subclass and the 2014 ones are found by class', () => {
    setOfficialContentProvider(packContentProvider(packs));
    const names = (classId: string, rs: RulesetId) => subclassEntriesForClassMerged(classId, [], rs).map(e => e.name);
    expect(names('fighter_2024', R2024)).toEqual(['Champion']);
    expect(names('wizard_2024', R2024)).toEqual(['Evoker']);
    expect(names('fighter', R2014)).toEqual(['Champion']);
  });

  it('a character built the way the class screen builds one is the same from packs as from the catalog', () => {
    const build = () => {
      const db = merged(R2024);
      const cls = db.classes.find(c => c.id === 'fighter_2024')!;
      let e = makeEmptyEntity('screen');
      e = { ...e, rulesetId: R2024 };
      e = acquireClass(e, cls, DEFAULT_RULES, db.classes);
      for (let level = 2; level <= 3; level++) e = levelUpClass(e, cls.id, getProgressionForClass(cls), DEFAULT_RULES, cls, db.classes);
      const entry = subclassEntriesForClassMerged(cls.id, [], R2024).find(s => s.name === 'Champion')!;
      const choice = e.choices.find(c => c.definition.kind === 'subclass')!;
      e = applySubclassToEntity(e, choice.id, entry.id, mergeSubclassIntoProgression(getProgressionForClass(cls), entry.progression) && entry.progression, DEFAULT_RULES);
      return e;
    };
    const fromCatalog = build();
    setOfficialContentProvider(packContentProvider(packs));
    const fromPacks = build();
    const summary = (e: ReturnType<typeof build>) => ({
      level: e.identity.level, classId: e.identity.classId, subclassId: e.identity.subclassId,
      features: e.features.map(f => f.id).sort(), resources: e.resources.custom.map(r => `${r.id}:${r.maximum}`).sort(),
      hp: e.resources.hp.maximum, choices: e.choices.map(c => c.definition.id).sort(),
    });
    expect(summary(fromPacks)).toEqual(summary(fromCatalog));
    expect(fromPacks.features.some(f => f.id === 'fighter_2024_second_wind')).toBe(true);
    expect(fromPacks.identity.subclassId).toBe('champion_2024');
  });

  it('removing the provider restores the hardcoded catalog (and the merged-database cache follows)', () => {
    const withCatalog = merged(R2024).classes.length;
    setOfficialContentProvider(packContentProvider(packs));
    const withPacks = merged(R2024).classes.length;
    expect(withPacks).toBeLessThan(withCatalog);
    setOfficialContentProvider(null);
    expect(merged(R2024).classes.length).toBe(withCatalog);
  });

  it('installing packs is all or nothing: a bad pack changes nothing and says why', () => {
    const before = globalContentDB.classes.length;
    const noManifest = { ...packs[1], manifest: undefined };
    expect(useOfficialPacks([packs[0], noManifest])).toEqual({ ok: false, problems: [expect.stringMatching(/no manifest/)] });
    expect(officialPacksInstalled()).toBe(false);
    expect(globalContentDB.classes.length).toBe(before);
    // The 5.2.1 pack alone is refused: it depends on the 5.1 pack.
    const alone = useOfficialPacks([packs[1]]);
    expect(alone.ok).toBe(false);
    expect(alone.ok ? '' : alone.problems[0]).toMatch(/grimoire\.srd\.5\.1.*not installed/);
    expect(officialPacksInstalled()).toBe(false);
    const good = useOfficialPacks(packs);
    expect(good).toMatchObject({ ok: true, packs: [{ id: 'grimoire.srd.5.1' }, { id: 'grimoire.srd.5.2.1' }] });
    expect(officialPacksInstalled()).toBe(true);
    clearOfficialPacks();
    expect(officialPacksInstalled()).toBe(false);
  });
});
