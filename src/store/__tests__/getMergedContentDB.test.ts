// src/store/__tests__/getMergedContentDB.test.ts
// Bug fix: getMergedContentDB used to plain-concatenate official content
// BEFORE homebrew for races/classes/backgrounds/conditions/feats, with no
// id-based dedup — every real `.find()`-based lookup (validation, derived
// stats, resource healing, export naming) therefore resolved to the
// OFFICIAL entry whenever a homebrew author cloned an official-id piece of
// content to customize it, silently discarding their edit. Spells/items
// already had this fixed via contentResolution.ts's mergeSpellIndex/
// mergeItemIndex (see that file's own tests); this locks in the equivalent
// fix for the other five content types, via homebrewWinsById.
import { useHomebrewStore } from '../homebrewStore';
import { Race, CharClass, Background, Condition, Feat } from '../../engine/types';

describe('getMergedContentDB — homebrew wins over official by id', () => {
  afterEach(() => {
    // Homebrew store is a module-level singleton — reset every array this
    // test touches so nothing leaks into a sibling test file.
    useHomebrewStore.setState({ races: [], classes: [], backgrounds: [], conditions: [], feats: [] });
  });

  it('a homebrew race sharing an official id wins, and there is only one entry for that id', () => {
    const officialHuman = useHomebrewStore.getState().getMergedContentDB().races.find(r => r.id === 'human');
    expect(officialHuman).toBeDefined(); // sanity: 'human' really is an official id in this content library

    const homebrewHuman: Race = { id: 'human', name: 'Human (Homebrew Override)', features: [] };
    useHomebrewStore.setState({ races: [homebrewHuman] });

    const merged = useHomebrewStore.getState().getMergedContentDB();
    const matches = merged.races.filter(r => r.id === 'human');
    expect(matches).toHaveLength(1); // no duplicate row — deduped, not just appended
    expect(matches[0].name).toBe('Human (Homebrew Override)');
  });

  it('a homebrew class sharing an official id wins, and there is only one entry for that id', () => {
    const homebrewFighter: CharClass = { id: 'fighter', name: 'Fighter (Homebrew Override)', hitDie: 10, features: [] };
    useHomebrewStore.setState({ classes: [homebrewFighter] });

    const merged = useHomebrewStore.getState().getMergedContentDB();
    const matches = merged.classes.filter(c => c.id === 'fighter');
    expect(matches).toHaveLength(1);
    expect(matches[0].name).toBe('Fighter (Homebrew Override)');
  });

  it('a homebrew background sharing an official id wins, and there is only one entry for that id', () => {
    const homebrewAcolyte: Background = { id: 'acolyte', name: 'Acolyte (Homebrew Override)', features: [] };
    useHomebrewStore.setState({ backgrounds: [homebrewAcolyte] });

    const merged = useHomebrewStore.getState().getMergedContentDB();
    const matches = merged.backgrounds.filter(b => b.id === 'acolyte');
    expect(matches).toHaveLength(1);
    expect(matches[0].name).toBe('Acolyte (Homebrew Override)');
  });

  it('a homebrew condition sharing an official id wins, and there is only one entry for that id', () => {
    const officialPoisoned = useHomebrewStore.getState().getMergedContentDB().conditions.find(c => c.id === 'poisoned');
    expect(officialPoisoned).toBeDefined(); // sanity

    const homebrewPoisoned: Condition = { id: 'poisoned', name: 'Poisoned (Homebrew Override)', description: '', features: [] };
    useHomebrewStore.setState({ conditions: [homebrewPoisoned] });

    const merged = useHomebrewStore.getState().getMergedContentDB();
    const matches = merged.conditions.filter(c => c.id === 'poisoned');
    expect(matches).toHaveLength(1);
    expect(matches[0].name).toBe('Poisoned (Homebrew Override)');
  });

  it('a homebrew feat sharing an official id wins, and there is only one entry for that id', () => {
    const officialGrappler = useHomebrewStore.getState().getMergedContentDB().feats?.find(f => f.id === 'grappler');
    expect(officialGrappler).toBeDefined(); // sanity — 'grappler' is the one official SRD feat in this library

    const homebrewGrappler: Feat = {
      id: 'grappler', name: 'Grappler (Homebrew Override)', prerequisite: null, description: '', source: 'homebrew',
      feature: { id: 'grappler_hb_f', name: 'Grappler', description: '', level: null, passive: true, source: { kind: 'feat', refId: 'grappler' }, effects: [], actions: [], choices: [] },
    };
    useHomebrewStore.setState({ feats: [homebrewGrappler] });

    const merged = useHomebrewStore.getState().getMergedContentDB();
    const matches = merged.feats?.filter(f => f.id === 'grappler') ?? [];
    expect(matches).toHaveLength(1);
    expect(matches[0].name).toBe('Grappler (Homebrew Override)');
  });

  it('official content with no homebrew id collision is unaffected', () => {
    useHomebrewStore.setState({ races: [{ id: 'not_a_real_id', name: 'Something Else', features: [] }] });
    const merged = useHomebrewStore.getState().getMergedContentDB();
    expect(merged.races.find(r => r.id === 'human')?.name).not.toBe('Human (Homebrew Override)');
    expect(merged.races.filter(r => r.id === 'human')).toHaveLength(1);
  });
});

// Item 15 (campaign content manifest) — the second, opt-in filter param.
// Every test above omits it entirely, proving the default (undefined) stays
// a true no-op — these tests exercise the filter itself.
describe('getMergedContentDB — bannedIds filter (item 15)', () => {
  afterEach(() => {
    useHomebrewStore.setState({ races: [], classes: [], items: [] });
  });

  it('excludes a homebrew race whose id is in the banned set', () => {
    useHomebrewStore.setState({ races: [{ id: 'homebrew_race_1', name: 'Banned Race', features: [] }] });
    const merged = useHomebrewStore.getState().getMergedContentDB(undefined, new Set(['homebrew_race_1']));
    expect(merged.races.some(r => r.id === 'homebrew_race_1')).toBe(false);
  });

  it('leaves content not in the banned set untouched', () => {
    useHomebrewStore.setState({ races: [{ id: 'homebrew_race_1', name: 'Not Banned', features: [] }] });
    const merged = useHomebrewStore.getState().getMergedContentDB(undefined, new Set(['some_other_id']));
    expect(merged.races.some(r => r.id === 'homebrew_race_1')).toBe(true);
  });

  it('is a true no-op when bannedIds is omitted, even with homebrew content present', () => {
    useHomebrewStore.setState({ races: [{ id: 'homebrew_race_1', name: 'X', features: [] }] });
    const merged = useHomebrewStore.getState().getMergedContentDB();
    expect(merged.races.some(r => r.id === 'homebrew_race_1')).toBe(true);
  });

  it('applies across multiple content types in one call', () => {
    useHomebrewStore.setState({
      races: [{ id: 'r1', name: 'R', features: [] }],
      classes: [{ id: 'c1', name: 'C', hitDie: 8, features: [] }],
    });
    const merged = useHomebrewStore.getState().getMergedContentDB(undefined, new Set(['r1', 'c1']));
    expect(merged.races.some(r => r.id === 'r1')).toBe(false);
    expect(merged.classes.some(c => c.id === 'c1')).toBe(false);
  });
});
