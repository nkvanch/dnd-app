// Compendium → Official is official-only; Compendium → Homebrew is the sole
// Homebrew library. These tests populate the homebrew store with recognisable
// user content — including one entry that shares an id with an official race —
// and prove it never reaches the Official data path.
import * as fs from 'fs';
import * as path from 'path';
import { useHomebrewStore } from '../../store/homebrewStore';
import { useCompendiumModeStore } from '../../store/compendiumModeStore';
import {
  officialContentDB, officialSpellIndex, officialItemIndex, officialMonsterTemplates, officialSubclassEntries,
} from '../officialCatalog';
import { buildLibraryEntries, filterLibraryEntries, DEFAULT_LIBRARY_FILTER } from '../homebrewLibrary';
import { matchesSearchText } from '../contentQuery';
import { isContentExposed, selectExposedContent } from '../contentExposure';
import { FULL_SPELL_LIBRARY } from '../spells/index';
import { FULL_ITEM_LIBRARY } from '../items/index';

const root = path.resolve(__dirname, '../../..');
const read = (rel: string) => fs.readFileSync(path.join(root, rel), 'utf8');
const hb = (o: Record<string, unknown>) => o as never;

const MARK = 'Zzqx';
const HOMEBREW = {
  races:       [hb({ id: 'zzqx_race', name: `${MARK} Homebrew Race`, features: [] }), hb({ id: 'human', name: `${MARK} Human Override`, features: [] })],
  classes:     [hb({ id: 'zzqx_class', name: `${MARK} Homebrew Class`, hitDie: 8, features: [] })],
  subclasses:  [hb({ id: 'zzqx_subclass', name: `${MARK} Homebrew Subclass`, classId: 'fighter', entries: [] })],
  spells:      [hb({ id: 'zzqx_spell', name: `${MARK} Homebrew Spell`, level: 1, school: 'Evocation', castingTime: '1 action', ritual: false, concentration: false, classes: [] })],
  backgrounds: [hb({ id: 'zzqx_background', name: `${MARK} Homebrew Background`, features: [] })],
  items:       [hb({ id: 'zzqx_item', name: `${MARK} Homebrew Item`, weight: 1, cost: '1 gp', properties: [], features: [] })],
  feats:       [hb({ id: 'zzqx_feat', name: `${MARK} Homebrew Feat`, prerequisite: null, description: '' })],
  monsters:    [hb({ id: 'zzqx_monster', name: `${MARK} Homebrew Monster`, cr: 1 })],
  conditions:  [hb({ id: 'zzqx_condition', name: `${MARK} Homebrew Condition`, description: '', features: [] })],
  subraces: [], features: [],
};

beforeEach(() => {
  useHomebrewStore.setState(HOMEBREW as never);
  useCompendiumModeStore.setState({ mode: 'official', selectedPackId: null });
});
afterEach(() => {
  useHomebrewStore.setState({
    races: [], subraces: [], classes: [], subclasses: [], spells: [], backgrounds: [], features: [], items: [], feats: [], monsters: [], conditions: [],
  } as never);
});

/** Every name Official mode can list, across all ten content types. */
function officialNames(): string[] {
  const db = officialContentDB();
  return [
    ...db.races, ...db.classes, ...db.backgrounds, ...db.feats, ...db.conditions,
    ...officialSpellIndex(), ...officialItemIndex(), ...officialMonsterTemplates(),
    ...officialSubclassEntries(db.classes),
  ].map(x => x.name);
}

function libraryEntries() {
  const s = useHomebrewStore.getState();
  return buildLibraryEntries(s, [], []);
}

describe('Official mode cannot return user Homebrew', () => {
  it('lists none of the homebrew entries, for any content type', () => {
    expect(officialNames().filter(n => n.includes(MARK))).toEqual([]);
  });

  it('an official entry keeps its official definition even when Homebrew reuses its id', () => {
    const human = officialContentDB().races.find(r => r.id === 'human');
    expect(human).toBeDefined();
    expect(human!.name).not.toContain(MARK);
    // …while the merged content DB (used by character creation) does let homebrew win
    expect(useHomebrewStore.getState().getMergedContentDB().races.find(r => r.id === 'human')!.name).toContain(MARK);
  });

  it('exact search for a homebrew name finds nothing in Official', () => {
    for (const name of HOMEBREW.races.map(r => (r as unknown as { name: string }).name)) {
      expect(officialNames().filter(n => matchesSearchText(n, [], name))).toEqual([]);
    }
    expect(officialNames().filter(n => matchesSearchText(n, [], `${MARK} Homebrew Spell`))).toEqual([]);
    // spells/items are repo-backed on device; the canonical libraries hold no homebrew either
    expect([...FULL_SPELL_LIBRARY, ...FULL_ITEM_LIBRARY].filter(x => matchesSearchText(x.name, [], MARK))).toEqual([]);
    // and the official spell path takes no homebrew input at all (mergeSpellIndex([]))
    expect(officialSpellIndex().filter(x => x.id === 'zzqx_spell')).toEqual([]);
  });

  it('the Official data module never reads the homebrew store, and the view no longer uses it', () => {
    expect(read('src/content/officialCatalog.ts')).not.toMatch(/homebrewStore|getMergedContentDB/);
    const view = read('app/(tabs)/compendium.tsx');
    expect(view).not.toContain('useHomebrewStore');
    expect(view).not.toContain('getMergedContentDB');
  });
});

describe('Homebrew mode returns user Homebrew', () => {
  it('lists every homebrew entry, including the one that overrides an official id', () => {
    const names = libraryEntries().map(e => e.item.name);
    for (const list of Object.values(HOMEBREW)) for (const e of list) expect(names).toContain((e as unknown as { name: string }).name);
    expect(names.filter(n => n.includes(MARK))).toHaveLength(10);
  });

  it('exact search for a homebrew name finds it', () => {
    const entries = libraryEntries();
    const f = { ...DEFAULT_LIBRARY_FILTER, packOwnership: new Map(), search: `${MARK} Homebrew Spell` };
    expect(filterLibraryEntries(entries, f).map(e => e.item.id)).toEqual(['zzqx_spell']);
  });

  it('is the only library: the old Homebrew-tab library is gone', () => {
    expect(read('app/(tabs)/homebrew.tsx')).not.toMatch(/function LibraryPanel/);
    expect(read('app/(tabs)/compendium.tsx')).toMatch(/mode === 'homebrew' && <HomebrewLibraryView/);
  });
});

describe('Switching modes', () => {
  // Each mode reads exactly one source; the store only records which is showing.
  const results = (mode: 'official' | 'homebrew' | 'packages') =>
    mode === 'homebrew' ? libraryEntries().map(e => e.item.name)
    : mode === 'official' ? officialNames()
    : [];

  it('Homebrew → Official removes the Homebrew results', () => {
    useCompendiumModeStore.getState().setMode('homebrew');
    expect(results(useCompendiumModeStore.getState().mode).filter(n => n.includes(MARK)).length).toBeGreaterThan(0);
    useCompendiumModeStore.getState().setMode('official');
    expect(results(useCompendiumModeStore.getState().mode).filter(n => n.includes(MARK))).toEqual([]);
  });
});

describe('SRD-only exposure still hides broader official content', () => {
  const srdOnly = { srdOnly: true };

  it('drops every non-SRD official race, class, background, feat and spell, keeping SRD ones', () => {
    const db = officialContentDB();
    // spells/items are repo-backed on device (empty index under jest), so their canonical libraries stand in here
    for (const list of [db.races, db.classes, db.backgrounds, db.feats, FULL_SPELL_LIBRARY, FULL_ITEM_LIBRARY] as { srd?: boolean }[][]) {
      const shown = selectExposedContent(list, srdOnly);
      expect(shown.every(x => x.srd === true)).toBe(true);
      expect(shown.length).toBeGreaterThan(0);
      expect(shown.length).toBeLessThan(list.length + 1);
    }
    // a known non-SRD official entry is present in the raw official list but hidden by exposure
    const aarakocra = db.races.find(r => r.id === 'aarakocra');
    expect(aarakocra).toBeDefined();
    expect(isContentExposed({ srd: aarakocra!.srd, type: 'race' }, srdOnly)).toBe(false);
  });

  it('official conditions remain available (rules vocabulary)', () => {
    const conditions = officialContentDB().conditions.map(c => ({ ...c, type: 'condition' as const }));
    expect(selectExposedContent(conditions, srdOnly)).toHaveLength(conditions.length);
  });

  it('the Official view still applies the exposure decision to every row', () => {
    const view = read('app/(tabs)/compendium.tsx');
    expect(view).toContain('currentContentExposure');
    expect(view).toMatch(/isContentExposed\(\{ isHomebrew, srd, type \}, CONTENT_EXPOSURE\)/);
  });
});

describe('No redundant Official/Homebrew source selector in Official mode', () => {
  const view = read('app/(tabs)/compendium.tsx');

  it('the selector, its state and its active-filter chip are gone', () => {
    expect(view).not.toContain('OfficialHomebrewChipRow');
    expect(view).not.toContain('officialFilter');
    expect(view).not.toContain('setOfficialFilter');
    expect(view).not.toContain('label="Official / Homebrew"');
  });

  it('the remaining global filters each have more than one possible value (Game / Ruleset are shown only when >1 exist)', () => {
    expect(view).toMatch(/availableGames\.length > 1 && \(\s*<FilterSection label="Game">/);
    expect(view).toMatch(/availableRulesets\.length > 1 && \(\s*<FilterSection label="Ruleset \/ Version">/);
  });

  it('the maestro safe flows no longer expect the selector', () => {
    expect(read('.maestro/preserve-state/compendium-srd.yaml')).not.toMatch(/assertVisible: "Official \/ Homebrew"/);
    expect(read('.maestro/preserve-state/compendium-modes.yaml')).toContain('assertNotVisible: "Official / Homebrew"');
  });
});
