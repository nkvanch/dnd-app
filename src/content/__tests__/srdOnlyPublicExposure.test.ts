// ============================================================================
// SRD-only public exposure — pinned counts, explicit deny/allow cases, nested
// subrace exposure, and hidden-id search/favorites behavior.
//
// Authority for every case below is the official System Reference Document 5.1
// (Wizards of the Coast LLC, CC-BY-4.0 International). The content libraries
// keep their broader definitions; this file locks what a public build EXPOSES.
//
// These tests load the real content modules with EXPO_PUBLIC_SRD_ONLY set the
// way the production EAS profile sets it, so the actual bundle filters
// (ALL_SPELLS / ALL_ITEMS / ALL_RACES / ...) and the Compendium's
// officialCatalog path run — nothing is re-filtered inside the test.
// ============================================================================
import { favoriteKey } from '../favorites';
import { matchesSearchText } from '../contentQuery';

type Mods = {
  spells: typeof import('../spells/index');
  items: typeof import('../items/index');
  races: typeof import('../races/index');
  classes: typeof import('../classes/index');
  subclasses: typeof import('../subclasses/index');
  backgrounds: typeof import('../backgrounds/index');
  feats: typeof import('../feats/index');
  monsters: typeof import('../monsters/srd');
  exposure: typeof import('../contentExposure');
  browse: typeof import('../compendiumBrowse');
  catalog: typeof import('../officialCatalog');
  refs: typeof import('../officialRefs');
};

/** Loads a fresh module graph with the build mode set, exactly as the bundler
 *  evaluates `process.env.EXPO_PUBLIC_SRD_ONLY` once at module load. */
function loadContent(srdOnly: boolean): Mods {
  const previous = process.env.EXPO_PUBLIC_SRD_ONLY;
  process.env.EXPO_PUBLIC_SRD_ONLY = srdOnly ? 'true' : 'false';
  let mods!: Mods;
  try {
    jest.isolateModules(() => {
      // The web repos are thin wrappers over the same ALL_SPELLS / ALL_ITEMS the
      // app bundles; jest-expo would otherwise resolve the SQLite-backed .native
      // variants, which have their own parity test (contentDbSrdParity.test.ts).
      jest.doMock('../spellRepo', () => jest.requireActual('../spellRepo.ts'));
      jest.doMock('../itemRepo', () => jest.requireActual('../itemRepo.ts'));
      mods = {
        spells: require('../spells/index'),
        items: require('../items/index'),
        races: require('../races/index'),
        classes: require('../classes/index'),
        subclasses: require('../subclasses/index'),
        backgrounds: require('../backgrounds/index'),
        feats: require('../feats/index'),
        monsters: require('../monsters/srd'),
        exposure: require('../contentExposure'),
        browse: require('../compendiumBrowse'),
        catalog: require('../officialCatalog'),
        refs: require('../officialRefs'),
      };
    });
  } finally {
    if (previous === undefined) delete process.env.EXPO_PUBLIC_SRD_ONLY;
    else process.env.EXPO_PUBLIC_SRD_ONLY = previous;
  }
  return mods;
}

let pub: Mods;
let full: Mods;
beforeAll(() => {
  pub = loadContent(true);
  full = loadContent(false);
});

const publicSpellIds = () => new Set(pub.spells.ALL_SPELLS.map(s => s.id));
const publicItemIds = () => new Set(pub.items.ALL_ITEMS.map(i => i.id));
const nestedSubraceCount = (races: readonly { subraces?: readonly unknown[] }[]) =>
  races.reduce((n, r) => n + (r.subraces?.length ?? 0), 0);

const FALSE_POSITIVE_SPELLS = [
  'hex', 'chromatic_orb', 'witch_bolt', 'phantasmal_force', 'destructive_wave', 'blade_ward', 'friends',
  'armor_of_agathys', 'catapult', 'dissonant_whispers', 'ensnaring_strike', 'ray_of_sickness', 'beast_sense',
  'cloud_of_daggers', 'crown_of_madness', 'pyrotechnics', 'elemental_weapon', 'feign_death', 'flame_arrows',
  'circle_of_power', 'swift_quiver', 'transmute_rock', 'arcane_gate', 'telepathy',
];

// id -> official generic SRD 5.1 display name (ids are unchanged for saves).
const RESTORED_SPELLS: Record<string, string> = {
  illusory_script: 'Illusory Script',
  bigbys_hand: 'Arcane Hand',
  mordenkainens_sword: 'Arcane Sword',
  mordenkainens_faithful_hound: 'Faithful Hound',
  tensers_floating_disk: 'Floating Disk',
  drawmijs_instant_summons: 'Instant Summons',
  mordenkainens_magnificent_mansion: 'Magnificent Mansion',
  leomunds_secret_chest: 'Secret Chest',
  rarys_telepathic_bond: 'Telepathic Bond',
};

const RESTORED_ITEMS = [
  'wondrous_figurine_silver_raven', 'wondrous_figurine_bronze_griffon', 'wondrous_figurine_ebony_fly',
  'wondrous_figurine_golden_lions', 'wondrous_figurine_ivory_goats', 'wondrous_figurine_marble_elephant',
  'wondrous_figurine_obsidian_steed', 'wondrous_figurine_onyx_dog', 'wondrous_figurine_serpentine_owl',
  'feather_token', 'staff',
];

const NON_SRD_ITEM_FAMILIES: Record<string, string[]> = {
  'Weapon of Warning': [
    'weapon_of_warning', 'battleaxe_of_warning', 'blowgun_of_warning', 'club_of_warning', 'dagger_of_warning',
    'dart_of_warning', 'glaive_of_warning', 'greatclub_of_warning', 'halberd_of_warning', 'lance_of_warning',
    'light_hammer_of_warning', 'longbow_of_warning', 'morningstar_of_warning', 'pike_of_warning',
  ],
  'Adamantine armor': [
    'adamantine_breastplate', 'adamantine_chain_mail', 'adamantine_chain_shirt', 'adamantine_half_plate_armor',
    'adamantine_plate_armor', 'adamantine_ring_mail', 'adamantine_scale_mail', 'adamantine_splint_armor',
  ],
  'Mithral armor': ['mithral_chain_mail', 'mithral_half_plate', 'mithral_plate_armor'],
  'Efreeti / Dwarven half plate': ['efreeti_chain_mail', 'efreeti_chain_shirt', 'dwarven_half_plate_armor'],
  'Scroll of Protection': [
    'aberrations', 'beasts', 'celestials', 'elementals', 'fey', 'fiends', 'plants', 'undead',
  ].map(t => `scroll_of_protection_against_${t}`),
  'Instrument of the Bards': [
    'doss_lute', 'fochlucan_bandore', 'mac_fuirmidh_cittern', 'canaith_mandolin', 'cli_lyre', 'anstruth_harp', 'ollamh_harp',
  ].map(t => `instrument_of_the_bards_${t}`),
  'Rod of the Pact Keeper': ['rod_of_the_pact_keeper_1', 'rod_of_the_pact_keeper_2', 'rod_of_the_pact_keeper_3'],
  'Other verified non-SRD items': [
    'harp_of_charming', 'instrument_of_illusions', 'energy_longbow', 'energy_shortbow', 'pole_of_collapsing',
    'cornucopia_of_plenty', 'gunner_s_pack', 'tome_of_the_stilled_tongue', 'burglar_s_key', 'kitchen_knife', 'ladle',
    'boots_of_false_tracks', 'horn_of_silent_alarm', 'elixir_of_health', 'bead_of_nourishment', 'sending_stones',
    'saddle_of_the_cavalier', 'pipe_of_smoke_monsters', 'staff_of_the_adder', 'staff_of_wizardry',
    'rod_of_resurrection', 'sentinel_shield', 'harp', 'grinder_s_tools', 'frying_pan',
  ],
};

// The SRD magic-weapon families are restricted by base weapon: Defender, Dragon
// Slayer, Flame Tongue, Frost Brand and Dancing Sword to "any sword"; Giant
// Slayer to "any axe or sword"; Sword of Sharpness to a slashing sword.
const OVEREXTENDED_WEAPON_VARIANTS = [
  ...['club', 'dagger', 'greatclub', 'handaxe', 'javelin', 'light_hammer', 'mace', 'quarterstaff', 'sickle', 'spear',
    'trident', 'war_pick', 'warhammer', 'whip'].map(w => `defender_${w}`),
  ...['battleaxe', 'dagger', 'quarterstaff', 'spear', 'trident', 'warhammer'].map(w => `dragon_slayer_${w}`),
  'flame_tongue_battleaxe', 'flame_tongue_glaive', 'frost_brand_battleaxe', 'giant_slayer_warhammer', 'greataxe_of_sharpness',
];
const VALID_WEAPON_VARIANTS = [
  'defender_rapier', 'defender_scimitar', 'defender_shortsword', 'dragon_slayer_greatsword', 'dragon_slayer_longsword',
  'flame_tongue_greatsword', 'flame_tongue_longsword', 'flame_tongue_rapier', 'flame_tongue_scimitar',
  'flame_tongue_shortsword', 'frost_brand_greatsword', 'frost_brand_longsword', 'frost_brand_rapier',
  'frost_brand_scimitar', 'frost_brand_shortsword', 'giant_slayer_battleaxe', 'giant_slayer_greatsword',
  'giant_slayer_longsword', 'dancing_greatsword', 'dancing_longsword', 'dancing_rapier', 'dancing_scimitar',
  'dancing_shortsword', 'greatsword_of_sharpness', 'longsword_of_sharpness',
];

describe('SRD-only runtime exposure counts (golden)', () => {
  // These are PUBLIC-BUILD EXPOSURE counts (EXPO_PUBLIC_SRD_ONLY=true), not the
  // number of definitions in source. A change here means the public catalog
  // changed and needs a deliberate, SRD-verified reason.
  it('pins the public counts', () => {
    const publicSubraces = pub.races.ALL_RACES.flatMap(r =>
      pub.exposure.exposedSubraces(r.subraces, { srdOnly: true }));
    expect({
      baseRaces: pub.races.ALL_RACES.length,
      publicSubraces: publicSubraces.length,
      classes: pub.classes.ALL_CHAR_CLASSES.length,
      subclasses: pub.subclasses.ALL_SUBCLASSES.length,
      backgrounds: pub.backgrounds.ALL_BACKGROUNDS.length,
      feats: pub.feats.ALL_FEATS.length,
      spells: pub.spells.ALL_SPELLS.length,
      monsters: pub.monsters.ALL_MONSTER_TEMPLATES.length,
      items: pub.items.ALL_ITEMS.length,
    }).toEqual({
      baseRaces: 9, publicSubraces: 4, classes: 12, subclasses: 12, backgrounds: 1, feats: 1,
      spells: 319, monsters: 322, items: 95,
    });
  });

  it('the four public subraces are exactly the SRD 5.1 subraces', () => {
    const ids = pub.races.ALL_RACES.flatMap(r =>
      pub.exposure.exposedSubraces(r.subraces, { srdOnly: true })).map(s => s.id).sort();
    expect(ids).toEqual(['high_elf', 'hill_dwarf', 'lightfoot_halfling', 'rock_gnome']);
  });

  it('broader/private definitions are preserved in full mode (no destructive removal)', () => {
    expect({
      races: full.races.ALL_RACES.length,
      subraces: nestedSubraceCount(full.races.ALL_RACES),
      spells: full.spells.ALL_SPELLS.length,
      items: full.items.ALL_ITEMS.length,
      monsters: full.monsters.ALL_MONSTER_TEMPLATES.length,
      subclasses: full.subclasses.ALL_SUBCLASSES.length,
    }).toEqual({ races: 40, subraces: 61, spells: 489, items: 891, monsters: 322, subclasses: 138 });
    // The public build is a strict subset of the full library.
    expect(pub.spells.ALL_SPELLS.every(s => full.spells.FULL_SPELL_LIBRARY.some(f => f.id === s.id))).toBe(true);
    expect(pub.items.ALL_ITEMS.every(i => full.items.FULL_ITEM_LIBRARY.some(f => f.id === i.id))).toBe(true);
  });
});

describe('SRD-only deny cases', () => {
  it('excludes all 24 removed spells publicly but keeps them in the full catalog', () => {
    const publicIds = publicSpellIds();
    const fullIds = new Set(full.spells.ALL_SPELLS.map(s => s.id));
    expect(FALSE_POSITIVE_SPELLS).toHaveLength(24);
    for (const id of FALSE_POSITIVE_SPELLS) {
      expect(publicIds.has(id)).toBe(false);
      expect(fullIds.has(id)).toBe(true);
    }
  });

  it.each(Object.entries(NON_SRD_ITEM_FAMILIES))('excludes the %s family publicly but keeps it in full', (_family, ids) => {
    const publicIds = publicItemIds();
    const fullIds = new Set(full.items.ALL_ITEMS.map(i => i.id));
    for (const id of ids) {
      expect(publicIds.has(id)).toBe(false);
      expect(fullIds.has(id)).toBe(true);
    }
  });

  it('excludes every magic-weapon variant that goes beyond the SRD family wording', () => {
    expect(OVEREXTENDED_WEAPON_VARIANTS).toHaveLength(25);
    const publicIds = publicItemIds();
    const fullIds = new Set(full.items.ALL_ITEMS.map(i => i.id));
    for (const id of OVEREXTENDED_WEAPON_VARIANTS) {
      expect(publicIds.has(id)).toBe(false);
      expect(fullIds.has(id)).toBe(true);
    }
  });

  it('does not expose even otherwise-permitted variants before per-entry provenance is verified', () => {
    const publicIds = publicItemIds();
    for (const id of VALID_WEAPON_VARIANTS) expect(publicIds.has(id)).toBe(false);
  });

  it('exposes the canonical entry, not the duplicate, for the confirmed duplicates', () => {
    const spells = publicSpellIds();
    const items = publicItemIds();
    expect(spells.has('black_tentacles')).toBe(true);
    expect(spells.has('evards_black_tentacles')).toBe(false);
    expect(items.has('healers_kit')).toBe(true);
    expect(items.has('healer_s_kit')).toBe(false);
    expect(items.has('burglars_pack')).toBe(false);
    expect(items.has('burglar_s_pack')).toBe(false);
    expect(items.has('plate_mail')).toBe(true);
    expect(items.has('plate_armor')).toBe(false);
    // Duplicates stay in the full catalog so existing saves keep resolving.
    const fullItems = new Set(full.items.ALL_ITEMS.map(i => i.id));
    for (const id of ['healer_s_kit', 'burglar_s_pack', 'plate_armor']) expect(fullItems.has(id)).toBe(true);
    expect(full.spells.ALL_SPELLS.some(s => s.id === 'evards_black_tentacles')).toBe(true);
  });

  it('never exposes wizard proper names (Product Identity) in any public spell', () => {
    const PI = /\b(Tasha|Melf|Bigby|Otiluke|Leomund|Otto|Rary|Evard|Nystul|Drawmij|Mordenkainen|Tenser)('s)?\b/;
    const offenders = pub.spells.ALL_SPELLS.filter(s => PI.test(`${s.name}\n${s.description}\n${s.upcast ?? ''}`));
    expect(offenders.map(s => s.id)).toEqual([]);
  });
});

describe('SRD-only allow cases', () => {
  it('exposes the nine verified SRD spells under their generic names, with stable ids', () => {
    for (const [id, name] of Object.entries(RESTORED_SPELLS)) {
      const spell = pub.spells.ALL_SPELLS.find(s => s.id === id);
      expect(spell?.name).toBe(name);
    }
  });

  it('exposed text of the renamed spells contains none of the removed wizard names', () => {
    const PI = /Bigby|Mordenkainen|Tenser|Drawmij|Leomund|Rary/i;
    for (const id of Object.keys(RESTORED_SPELLS)) {
      const s = pub.spells.ALL_SPELLS.find(x => x.id === id)!;
      expect(`${s.name}\n${s.description}\n${s.upcast ?? ''}`).not.toMatch(PI);
    }
  });

  it('carries the official SRD headers for the two spells whose vault fields were malformed', () => {
    const byId = (id: string) => pub.spells.ALL_SPELLS.find(s => s.id === id)!;
    expect(byId('mordenkainens_magnificent_mansion')).toMatchObject({
      level: 7, school: 'Conjuration', castingTime: '1 minute', range: '300 feet',
      components: ['V', 'S', 'M'], duration: '24 hours', concentration: false, ritual: false,
    });
    expect(byId('mordenkainens_sword')).toMatchObject({
      level: 7, school: 'Evocation', castingTime: '1 action', range: '60 feet',
      components: ['V', 'S', 'M'], duration: 'Concentration, up to 1 minute', concentration: true, ritual: false,
    });
    expect(byId('illusory_script')).toMatchObject({
      level: 1, school: 'Illusion', castingTime: '1 minute', range: 'Touch', components: ['S', 'M'],
      duration: '10 days', ritual: true, concentration: false,
    });
  });

  it('keeps magic variants blocked until canonical generation has model-safe fields', () => {
    const publicIds = publicItemIds();
    for (const id of RESTORED_ITEMS.filter(id => id !== 'staff')) expect(publicIds.has(id)).toBe(false);
    expect(publicIds.has('staff')).toBe(true);
    expect(RESTORED_ITEMS.filter(id => id.startsWith('wondrous_figurine_'))).toHaveLength(9);
  });

  it('retains official SRD display names in the full catalog while public provenance is pending', () => {
    const name = (id: string) => full.items.FULL_ITEM_LIBRARY.find(i => i.id === id)?.name;
    expect(name('plate_mail')).toBe('Plate');
    expect(name('carrion_crawler_mucus')).toBe('Crawler Mucus');
  });
});

describe('nested subrace exposure', () => {
  const elfIn = (m: Mods) => m.races.ALL_RACES.find(r => r.id === 'elf')!;

  it('SRD-only: a public race keeps only its SRD subraces', () => {
    const elf = elfIn(pub);
    expect(elf.srd).toBe(true);
    const listed = pub.exposure.exposedSubraces(elf.subraces, { srdOnly: true }).map(s => s.id);
    expect(listed).toEqual(['high_elf']);
    // Non-SRD nested options (e.g. Wood Elf, Drow, Eladrin) stay in the data...
    expect(elf.subraces!.length).toBeGreaterThan(1);
    // ...but are not browsable.
    for (const hidden of ['wood_elf', 'drow', 'eladrin', 'pallid_elf']) expect(listed).not.toContain(hidden);
  });

  it('SRD-only: a subrace with an unknown/undefined tag is hidden', () => {
    expect(pub.exposure.exposedSubraces([{ id: 'x' }, { id: 'y', srd: false }, { id: 'z', srd: true }], { srdOnly: true }).map(s => s.id))
      .toEqual(['z']);
  });

  it('SRD-only: homebrew subraces keep their own visibility', () => {
    const subs = [{ id: 'hb' }, { id: 'official_nonsrd', srd: false }];
    expect(pub.exposure.exposedSubraces(subs, { srdOnly: true }, s => s.id === 'hb').map(s => s.id)).toEqual(['hb']);
  });

  it('a public base race is not hidden because some subraces are non-SRD', () => {
    for (const id of ['human', 'elf', 'dwarf', 'halfling', 'gnome']) {
      expect(pub.races.ALL_RACES.some(r => r.id === id)).toBe(true);
    }
  });

  it('full/private mode: every subrace stays available', () => {
    const elf = elfIn(full);
    const listed = full.exposure.exposedSubraces(elf.subraces, { srdOnly: false }).map(s => s.id);
    expect(listed).toEqual(elf.subraces!.map(s => s.id));
    for (const id of ['high_elf', 'wood_elf', 'drow', 'eladrin']) expect(listed).toContain(id);
    const humanListed = full.exposure.exposedSubraces(full.races.ALL_RACES.find(r => r.id === 'human')!.subraces, { srdOnly: false });
    expect(humanListed.map(s => s.id)).toContain('variant_human');
  });

  it('the creation screen reads subraces through the shared exposure rule', () => {
    const fs = require('fs') as typeof import('fs');
    const path = require('path') as typeof import('path');
    const src = fs.readFileSync(path.resolve(__dirname, '../../../app/creation/race-detail.tsx'), 'utf8');
    expect(src).toMatch(/exposedSubraces\(\s*race\?\.subraces,\s*CONTENT_EXPOSURE,\s*isHomebrewSubrace\s*\)/);
    expect(src).toMatch(/const CONTENT_EXPOSURE = currentContentExposure\(\);/);
    expect(src).not.toMatch(/race\?\.subraces \?\? \[\]/);
  });

  it('Compendium subrace rows carry the subrace\'s OWN srd tag, not the parent race\'s', () => {
    const rows = pub.browse.flattenSubraces(pub.races.ALL_RACES);
    const wood = rows.find(r => r.id === 'wood_elf')!;
    expect(wood.parentRaceId).toBe('elf');
    expect(wood.srd).toBe(false);
    const exposed = rows.filter(r => pub.exposure.isContentExposed(pub.browse.subraceToBrowsable(r, false), { srdOnly: true }));
    expect(exposed.map(r => r.id).sort()).toEqual(['high_elf', 'hill_dwarf', 'lightfoot_halfling', 'rock_gnome']);
  });

  it('official-ref detection treats hidden subraces as non-official in SRD-only, all of them official in full', () => {
    expect(pub.refs.isOfficialRef({ type: 'subrace', id: 'high_elf' } as never)).toBe(true);
    expect(pub.refs.isOfficialRef({ type: 'subrace', id: 'wood_elf' } as never)).toBe(false);
    expect(full.refs.isOfficialRef({ type: 'subrace', id: 'wood_elf' } as never)).toBe(true);
    expect(pub.refs.isOfficialRef({ type: 'race', id: 'elf' } as never)).toBe(true);
  });
});

describe('hidden content: search and favorites', () => {
  const entries = () => pub.catalog.officialSpellIndex().map(s => pub.browse.spellToBrowsable(s, false));

  it('the Official spell/item indexes the Compendium reads never contain hidden ids', () => {
    const spellIds = new Set(pub.catalog.officialSpellIndex().map(s => s.id));
    const itemIds = new Set(pub.catalog.officialItemIndex().map(i => i.id));
    for (const id of FALSE_POSITIVE_SPELLS) expect(spellIds.has(id)).toBe(false);
    for (const id of ['weapon_of_warning', 'defender_club', 'adamantine_plate_armor']) expect(itemIds.has(id)).toBe(false);
  });

  it('an exact-name search cannot surface a hidden spell', () => {
    const hits = pub.exposure.selectExposedContent(entries(), { srdOnly: true }, e => matchesSearchText(e.name, [], 'hex'));
    expect(hits.map(e => e.id)).not.toContain('hex');
  });

  it('a previously favorited hidden id does not reappear (exposure wins over the favorite)', () => {
    const favorites = new Set([favoriteKey('spell', 'hex'), favoriteKey('spell', 'fireball'), favoriteKey('item', 'defender_club')]);
    const shown = pub.exposure.selectExposedContent(entries(), { srdOnly: true }, () => true, e => favorites.has(favoriteKey(e.type, e.id)));
    expect(shown.map(e => e.id)).toContain('fireball');
    expect(shown.map(e => e.id)).not.toContain('hex');
    // Even if a native-style index carried the raw hidden row, the same exposure rule removes it.
    const withHiddenRow = full.spells.ALL_SPELLS.map(s => pub.browse.spellToBrowsable(
      { id: s.id, name: s.name, level: s.level, school: s.school, castingTime: s.castingTime, ritual: s.ritual, concentration: s.concentration, classes: s.classes, srd: s.srd, rulesetId: s.rulesetId, components: s.components }, false));
    const shownFromFull = pub.exposure.selectExposedContent(withHiddenRow, { srdOnly: true }, () => true, e => favorites.has(favoriteKey(e.type, e.id)));
    expect(shownFromFull.map(e => e.id)).toEqual(['fireball']);
    // The saved favorite itself is untouched.
    expect(favorites.has(favoriteKey('spell', 'hex'))).toBe(true);
  });
});

