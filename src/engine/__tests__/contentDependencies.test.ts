// src/engine/__tests__/contentDependencies.test.ts
import { collectContentDependencies, buildDependencyClosure, DependencyRef } from '../contentDependencies';
import type { Subrace, HomebrewSubclass, CharClass, Feature, Spell, Race } from '../../engine/types';
import type { HomebrewContent } from '../../db/contentCacheRepo';

function mkFeature(over: Partial<Feature> = {}): Feature {
  return {
    id: 'f1', name: 'F1', description: '', source: { kind: 'race', refId: 'x' },
    level: null, effects: [], actions: [], choices: [], passive: true,
    ...over,
  };
}

describe('collectContentDependencies', () => {
  it('a Subrace depends on its parent Race', () => {
    const sr: Subrace = { id: 'reefborn', name: 'Reefborn', parentId: 'tideborn', features: [] };
    expect(collectContentDependencies('subrace', sr)).toEqual([{ type: 'race', id: 'tideborn' }]);
  });

  it('a Subrace also picks up spell/condition refs from its own features', () => {
    const sr: Subrace = {
      id: 'reefborn', name: 'Reefborn', parentId: 'tideborn',
      features: [mkFeature({
        effects: [{ type: 'grant_spell', target: 'na', operation: 'set', value: null, condition: null, spellIds: ['pressure_lance'], cantripIds: ['ray_of_frost'] } as any],
      })],
    };
    const refs = collectContentDependencies('subrace', sr);
    expect(refs).toEqual(expect.arrayContaining([
      { type: 'race', id: 'tideborn' },
      { type: 'spell', id: 'pressure_lance' },
      { type: 'spell', id: 'ray_of_frost' },
    ]));
  });

  it('a HomebrewSubclass depends on its parent Class and any known_spells grants in its entries', () => {
    const sc: HomebrewSubclass = {
      id: 'tidewater_domain' as any, name: 'Tidewater Domain', classId: 'cleric',
      entries: [{
        level: 1, hpDie: 8, choices: [],
        grants: [{ kind: 'known_spells', value: { spellIds: ['control_water'], cantripIds: [] } }],
      }],
    };
    expect(collectContentDependencies('subclass', sc)).toEqual(expect.arrayContaining([
      { type: 'class', id: 'cleric' },
      { type: 'spell', id: 'control_water' },
    ]));
  });

  it('a Class depends on its startingEquipment items and any spell_grant DraftTrait level features', () => {
    const cls: CharClass = {
      id: 'stormcaller', name: 'Stormcaller', hitDie: 8, features: [],
      startingEquipment: ['quarterstaff', 'leather_armor'],
      levelFeatures: [{
        level: 1, localId: 't1', name: 'Storm Cantrip', description: '', effectKind: 'spell_grant',
        spellGrantCantripId: 'shocking_grasp', spellGrantAbility: 'int',
        spellGrants: [{ localId: 'g1', spellId: 'call_lightning', spellName: 'Call Lightning', actionType: 'action', unlockLevel: '5' }],
      } as any],
    };
    const refs = collectContentDependencies('class', cls);
    expect(refs).toEqual(expect.arrayContaining([
      { type: 'item', id: 'quarterstaff' },
      { type: 'item', id: 'leather_armor' },
      { type: 'spell', id: 'shocking_grasp' },
      { type: 'spell', id: 'call_lightning' },
    ]));
  });

  it('excludes self-references (a feature whose source points back at its own owning content)', () => {
    const race: Race = {
      id: 'tideborn', name: 'Tideborn',
      features: [mkFeature({ source: { kind: 'race', refId: 'tideborn' } })],
    } as Race;
    // No effects reference anything, and the feature's own source.refId
    // (handled elsewhere, not walked as a dependency at all) shouldn't
    // produce a spurious self-edge either way.
    expect(collectContentDependencies('race', race)).toEqual([]);
  });

  it('a plain Spell has no dependencies', () => {
    const spell: Spell = { id: 'fireball', name: 'Fireball', level: 3, school: 'Evocation', description: '' } as Spell;
    expect(collectContentDependencies('spell', spell)).toEqual([]);
  });

  // HOMEBREW-PACKAGE-1 item 4: real combinations beyond a single hop.
  it('a Feat depends on the Spell(s) its embedded Feature grants (Feat → Feature → Spell)', () => {
    const feat: HomebrewContent = {
      id: 'amphibious_adept', name: 'Amphibious Adept', prerequisite: null, description: '', source: 'Homebrew',
      feature: mkFeature({
        id: 'aa_f', source: { kind: 'feat', refId: 'amphibious_adept' },
        effects: [{ type: 'grant_spell', target: 'na', operation: 'set', value: null, condition: null, spellIds: ['pressure_lance'] } as any],
      }),
    } as any;
    expect(collectContentDependencies('feat', feat)).toEqual([{ type: 'spell', id: 'pressure_lance' }]);
  });

  it('a Subclass depends on the Spell(s) granted by a Feature nested in one of its entries (Subclass → Class → Feature → Spell)', () => {
    const grantedFeature = mkFeature({
      id: 'oceans_wrath', name: "Ocean's Wrath", source: { kind: 'subclass', refId: 'tidewater_domain' },
      effects: [{ type: 'grant_spell', target: 'na', operation: 'set', value: null, condition: null, spellIds: ['control_water'] } as any],
    });
    const sc: HomebrewSubclass = {
      id: 'tidewater_domain' as any, name: 'Tidewater Domain', classId: 'cleric',
      entries: [{ level: 1, hpDie: 8, choices: [], grants: [{ kind: 'feature', value: grantedFeature }] }],
    };
    const refs = collectContentDependencies('subclass', sc);
    expect(refs).toEqual(expect.arrayContaining([
      { type: 'class', id: 'cleric' },
      { type: 'spell', id: 'control_water' },
    ]));
  });

  it('a Class depends on an Item granted via rawProgression (escape hatch) alongside a Feature-granted Spell (Class → Feature → Spell, → Item)', () => {
    const grantedFeature = mkFeature({
      id: 'storm_bond', effects: [{ type: 'grant_spell', target: 'na', operation: 'set', value: null, condition: null, cantripIds: ['shocking_grasp'] } as any],
    });
    const cls: CharClass = {
      id: 'stormcaller', name: 'Stormcaller', hitDie: 8, features: [],
      rawProgression: {
        classId: 'stormcaller' as any,
        entries: [{
          level: 1, hpDie: 8, choices: [],
          grants: [
            { kind: 'feature', value: grantedFeature },
            { kind: 'starting_item', value: 'storm_rod' },
          ],
        }],
      },
    } as any;
    const refs = collectContentDependencies('class', cls);
    expect(refs).toEqual(expect.arrayContaining([
      { type: 'spell', id: 'shocking_grasp' },
      { type: 'item', id: 'storm_rod' },
    ]));
  });
});

describe('buildDependencyClosure', () => {
  const RACE: Race = { id: 'tideborn', name: 'Tideborn', features: [] } as Race;
  const SUBRACE: Subrace = { id: 'reefborn', name: 'Reefborn', parentId: 'tideborn', features: [] };
  const SPELL: Spell = { id: 'pressure_lance', name: 'Pressure Lance', level: 1, school: 'Evocation', description: '' } as Spell;
  const FEAT_WITH_SPELL: HomebrewContent = {
    id: 'amphibious_adept', name: 'Amphibious Adept', prerequisite: null, description: '', source: 'Homebrew',
    feature: mkFeature({
      id: 'aa_f', source: { kind: 'feat', refId: 'amphibious_adept' },
      effects: [{ type: 'grant_spell', target: 'na', operation: 'set', value: null, condition: null, spellIds: ['pressure_lance'] } as any],
    }),
  } as any;

  function mkLookup(items: Record<string, HomebrewContent & { rulesetId?: string }>) {
    return (ref: DependencyRef) => items[`${ref.type}:${ref.id}`];
  }

  it('pulls in the full closure for a selection spanning race/subrace/feat/spell', () => {
    const lookup = mkLookup({
      'race:tideborn': RACE,
      'subrace:reefborn': SUBRACE,
      'feat:amphibious_adept': FEAT_WITH_SPELL,
      'spell:pressure_lance': SPELL,
    });
    const { closure, unresolved } = buildDependencyClosure(
      [{ type: 'race', id: 'tideborn' }, { type: 'subrace', id: 'reefborn' }, { type: 'feat', id: 'amphibious_adept' }],
      lookup,
    );
    expect(unresolved).toEqual([]);
    const keys = closure.map(c => `${c.type}:${c.id}`).sort();
    expect(keys).toEqual(['feat:amphibious_adept', 'race:tideborn', 'spell:pressure_lance', 'subrace:reefborn']);
    // Selected items are tagged 'selected', the pulled-in spell is 'dependency'.
    expect(closure.find(c => c.id === 'tideborn')!.included).toBe('selected');
    expect(closure.find(c => c.id === 'reefborn')!.included).toBe('selected');
    expect(closure.find(c => c.id === 'pressure_lance')!.included).toBe('dependency');
  });

  it('reports an unresolved dependency instead of silently dropping it', () => {
    const lookup = mkLookup({ 'subrace:reefborn': SUBRACE }); // parent Race "tideborn" missing
    const { closure, unresolved } = buildDependencyClosure([{ type: 'subrace', id: 'reefborn' }], lookup);
    expect(closure.map(c => `${c.type}:${c.id}`)).toEqual(['subrace:reefborn']);
    expect(unresolved).toEqual([{ type: 'race', id: 'tideborn' }]);
  });

  it('a dependency that is ALSO independently selected stays tagged selected (explicit picks win)', () => {
    const lookup = mkLookup({ 'race:tideborn': RACE, 'subrace:reefborn': SUBRACE });
    const { closure } = buildDependencyClosure(
      [{ type: 'subrace', id: 'reefborn' }, { type: 'race', id: 'tideborn' }],
      lookup,
    );
    expect(closure.find(c => c.id === 'tideborn')!.included).toBe('selected');
  });

  it('converges two paths to the SAME dependency without duplicating it or infinite-looping (diamond shape: sr_a → race_a ← sr_b)', () => {
    // Two subraces of the same race, both reached via the queue — proves
    // dedup/visited-set correctness (the BFS in buildDependencyClosure is
    // exactly what would infinite-loop on a real graph cycle if it weren't
    // tracking visited nodes). Note: the actual content schema's
    // dependency edges (Subrace→Race, Subclass→Class, Class/Subclass/Feat
    // →Spell/Item/Condition) only ever point from more-specific content
    // toward more-fundamental/leaf content, never the reverse — so a
    // literal A→B→A cycle isn't constructible through real field usage
    // (confirmed by inspecting every case in collectContentDependencies's
    // switch). This diamond convergence is the practically-relevant shape
    // spec item 8's "avoid duplicate exported definitions" actually cares
    // about, and it exercises the same visited-set machinery a true cycle
    // would need.
    const raceA: Race = { id: 'race_a', name: 'A', features: [] } as Race;
    const srA: Subrace = { id: 'sr_a', name: 'SR A', parentId: 'race_a', features: [] };
    const srB: Subrace = { id: 'sr_b', name: 'SR B', parentId: 'race_a', features: [] };
    const lookup = mkLookup({ 'race:race_a': raceA, 'subrace:sr_a': srA, 'subrace:sr_b': srB });
    const { closure, unresolved } = buildDependencyClosure(
      [{ type: 'subrace', id: 'sr_a' }, { type: 'subrace', id: 'sr_b' }],
      lookup,
    );
    expect(unresolved).toEqual([]);
    expect(closure.map(c => `${c.type}:${c.id}`).sort()).toEqual(['race:race_a', 'subrace:sr_a', 'subrace:sr_b']);
    // Exactly one entry for race_a, not two — the actual "no duplicate
    // exported definitions" assertion item 8/item 4 ask for.
    expect(closure.filter(c => c.id === 'race_a')).toHaveLength(1);
  });

  it('a shared dependency referenced by TWO different selected items appears exactly once in the closure (spec item 4/8 example)', () => {
    // Selected A (a Race) and Selected B (a Feat) both grant the same
    // Spell via their own embedded Feature — the package must contain
    // that Spell once, not twice.
    const sharedSpell: Spell = { id: 'pressure_lance', name: 'Pressure Lance', level: 1, school: 'Evocation', description: '' } as Spell;
    const raceWithSpell: Race = {
      id: 'tideborn', name: 'Tideborn',
      features: [mkFeature({
        effects: [{ type: 'grant_spell', target: 'na', operation: 'set', value: null, condition: null, spellIds: ['pressure_lance'] } as any],
      })],
    } as Race;
    const lookup = mkLookup({
      'race:tideborn': raceWithSpell,
      'feat:amphibious_adept': FEAT_WITH_SPELL, // also grants pressure_lance, see const above
      'spell:pressure_lance': sharedSpell,
    });
    const { closure, unresolved } = buildDependencyClosure(
      [{ type: 'race', id: 'tideborn' }, { type: 'feat', id: 'amphibious_adept' }],
      lookup,
    );
    expect(unresolved).toEqual([]);
    expect(closure.filter(c => c.type === 'spell' && c.id === 'pressure_lance')).toHaveLength(1);
    expect(closure.map(c => `${c.type}:${c.id}`).sort()).toEqual([
      'feat:amphibious_adept', 'race:tideborn', 'spell:pressure_lance',
    ]);
  });

  it('reports a missing dependency referenced by a Feat\'s embedded Feature (spec item 8\'s "A → missing X" example)', () => {
    const featWithMissingSpell: HomebrewContent = {
      id: 'sea_speaker', name: 'Sea Speaker', prerequisite: null, description: '', source: 'Homebrew',
      feature: mkFeature({
        effects: [{ type: 'grant_spell', target: 'na', operation: 'set', value: null, condition: null, spellIds: ['speak_with_fish'] } as any],
      }),
    } as any;
    const lookup = mkLookup({ 'feat:sea_speaker': featWithMissingSpell }); // 'speak_with_fish' deliberately absent
    const { closure, unresolved } = buildDependencyClosure([{ type: 'feat', id: 'sea_speaker' }], lookup);
    expect(closure.map(c => `${c.type}:${c.id}`)).toEqual(['feat:sea_speaker']);
    expect(unresolved).toEqual([{ type: 'spell', id: 'speak_with_fish' }]);
  });
});
