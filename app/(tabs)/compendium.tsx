// app/(tabs)/compendium.tsx
// COMPENDIUM-2: the multi-type Compendium rewrite. Was Conditions-only
// (see this file's prior header comment, kept below in spirit) — now
// supports Race/Subrace/Class/Subclass/Background/Feat/Spell/Item/Monster/
// Condition, built entirely on the shared content-query/filter
// infrastructure (contentQuery.ts, SortControl, each type's own *Browse.ts
// module) rather than a second, parallel browsing system. Favorites are
// now generalized across every supported type (src/content/favorites.ts)
// instead of Condition-only, with the old Condition-only favorites
// migrated forward automatically. Search/filters/sort/content-type
// selection persist across navigation via browseStateStore (session-local,
// not app-restart-persisted — matches every other screen this pass).
import { useState, useEffect, useMemo, useCallback } from 'react';
import { View, Text, ScrollView, FlatList, Pressable, StyleSheet, TextInput, InteractionManager } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useBrowseStateStore } from '../../src/store/browseStateStore';
import { loadFavorites, saveFavorites, favoriteKey } from '../../src/content/favorites';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../../src/theme';
import {
  FilterSection, FilterChipRow, MultiSelectChipRow,
  ActiveFilterChips, ZeroResultsState,
} from '../../src/components/FilterChipRow';
import { SortControl } from '../../src/components/SortControl';
import { NonSrdBadge, isNonSrd } from '../../src/components/NonSrdBadge';
import {
  ContentTypeId, CONTENT_TYPE_LABELS, BrowsableEntry, SortOption,
  nameSortOptions, sourceSortOption, contentTypeSortOption, sortByOption,
  matchesSearchText,
} from '../../src/content/contentQuery';
import { matchesGame } from '../../src/content/rulesets';
import { currentContentExposure, isContentExposed } from '../../src/content/contentExposure';
import { GAMES, RULESETS, gameIdForRuleset } from '../../src/content/rulesets';
import { GameId, RulesetId, Ability, SkillName, Feat, ContentDB, matchesRuleset } from '../../src/engine/types';
import {
  flattenSubraces, attachParentClassNames, raceToBrowsable, subraceToBrowsable,
  classToBrowsable, subclassToBrowsable, backgroundToBrowsable, featToBrowsable,
  spellToBrowsable, itemToBrowsable, monsterToBrowsable, conditionToBrowsable,
  summaryLine, entrySourceLabel, CONTENT_TYPE_VISUALS, SubraceWithParent, SubclassEntryWithParent,
} from '../../src/content/compendiumBrowse';
import {
  RACE_SIZE_ORDER, RACE_MOVEMENT_TYPES, hasDarkvision, raceMovementTypes, hasSubraces, raceSortOptions,
} from '../../src/content/races/raceBrowse';
import {
  SubraceOwnTrait, SUBRACE_OWN_TRAIT_LABELS, subraceOwnTraits, subraceSortOptions,
} from '../../src/content/races/subraceBrowse';
import { CASTER_TYPE, CASTER_TYPES, classSortOptions } from '../../src/content/classes/classBrowse';
import {
  SubclassAddition, SUBCLASS_ADDITION_LABELS, subclassAdditions,
  subclassSortOptions,
} from '../../src/content/subclasses/subclassBrowse';
import { backgroundSkillGrants, backgroundSortOptions } from '../../src/content/backgrounds/backgroundBrowse';
import {
  primaryPrereqCategory, featGrantsAsi, featGrantsProficiency, featGrantsActivation, featSortOptions,
} from '../../src/content/feats/featBrowse';
import { spellSortOptions } from '../../src/content/spells/spellBrowse';
import { actionType, ACTION_TYPES } from '../../src/content/spellFilterUtils';
import {
  itemCategory, ITEM_CATEGORY_LABELS, ItemCategoryId, isMagic, isMartialWeapon, isRangedWeapon,
  armorWeight, rarityOf, RARITY_TIERS, itemSortOptions,
} from '../../src/content/items/itemBrowse';
import {
  MONSTER_SIZE_ORDER, MONSTER_MOVEMENT_TYPES, monsterMovementTypes, monsterResistances,
  monsterImmunities, monsterConditionImmunities, monsterHasDarkvision, monsterIsSpellcaster,
  monsterSortOptions,
} from '../../src/content/monsters/monsterBrowse';
import { conditionSortOptions } from '../../src/content/conditions/conditionBrowse';
import {
  officialContentDB, officialSpellIndex, officialItemIndex, officialMonsterTemplates, officialSubclassEntries,
} from '../../src/content/officialCatalog';
import { makeEmptyEntity } from '../../src/store/characterStore';
import { useCompendiumModeStore } from '../../src/store/compendiumModeStore';
import { CompendiumMode, parseCompendiumMode } from '../../src/content/compendiumModes';
import { CompendiumModeSwitch } from '../../src/components/compendium/CompendiumModeSwitch';
import { HomebrewLibraryView } from '../../src/components/compendium/HomebrewLibraryView';
import { InstalledPackagesView } from '../../src/components/compendium/InstalledPackagesView';

const SCREEN_KEY = 'compendium';
const ABILITY_LABELS: Record<Ability, string> = { str: 'STR', dex: 'DEX', con: 'CON', int: 'INT', wis: 'WIS', cha: 'CHA' };
const ARMOR_LABELS: Record<string, string> = { light: 'Light', medium: 'Medium', heavy: 'Heavy', shield: 'Shield' };
const WEAPON_LABELS: Record<string, string> = { simple: 'Simple', martial: 'Martial' };
const skillLabel = (s: string) => s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
// Stable empty-array reference — contentDB.feats is optional (ContentDB.feats?),
// so `?? []` would otherwise create a new array every render and break
// downstream useMemo referential-equality checks that depend on `feats`.
const EMPTY_FEATS: Feat[] = [];
// PERF-COMPENDIUM-1: shared stable-reference empty array — returned by any
// per-type filter memo that's skipped this render (see `single` guards
// below), so skipping never allocates a fresh array and never breaks a
// downstream useMemo's referential-equality check.
const EMPTY_RESULTS: never[] = [];
const EMPTY_CONTENT_DB: ContentDB = {
  races: [], classes: [], backgrounds: [], spells: [], items: [], conditions: [], features: [], feats: [],
};

const CONTENT_EXPOSURE = currentContentExposure();
/** Official mode never lists homebrew — passed wherever a sort option asks "is this entry homebrew?". */
const notHomebrew = () => false;

const CONTENT_TYPE_ORDER: ContentTypeId[] = [
  'race', 'subrace', 'class', 'subclass', 'background', 'feat', 'spell', 'item', 'monster', 'condition',
];

/** Official mode: the ordinary Compendium browser (search/filters/sort/favorites/detail, SRD exposure). Unchanged apart from the screen title/switch moving into CompendiumScreen below. */
function OfficialCompendiumView() {

  // ── Restore browse state (search/filters/sort/content type) — session-
  // local, survives navigating away (e.g. into a detail expand or a
  // homebrew builder) and back, since this reads a plain Zustand store, not
  // component state. Lazy initializers so the restore runs exactly once,
  // before the first render, not as a post-mount effect (which would flash
  // the default state first).
  const saved = useBrowseStateStore.getState().getBrowseState(SCREEN_KEY);
  const setBrowseState = useBrowseStateStore(s => s.setBrowseState);

  const [contentType, setContentType] = useState<ContentTypeId | 'all'>((saved.contentType as ContentTypeId | 'all') ?? 'all');
  const [search, setSearch] = useState(saved.search ?? '');
  const [sort, setSort] = useState(saved.sort ?? 'name_asc');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  // PERF-COMPENDIUM-1 (item 1): the shell (header/search box/type chips/
  // Filters toggle) must be interactive on the very FIRST paint, before the
  // full content merge + filter + sort pass (the actually expensive part —
  // full spell/item/monster indices, 10 content types' worth of filtering)
  // ever runs. `contentReady` starts false so that first render commits
  // with the shell fully built and an empty/loading result list; the
  // effect below flips it on the very next tick (after the browser has
  // already painted the shell), which is what actually lets a user tap
  // into the search box or Filters toggle immediately instead of waiting
  // for one big synchronous first render to finish.
  const [contentReady, setContentReady] = useState(false);
  // Re-audit item 20: re-measured on the current build rather than
  // assuming the existing contentReady staging (above) had already closed
  // this — it hadn't fully. A bare `useEffect` still fires within the same
  // JS-thread turn React uses to finish mounting/registering touch
  // responders, so the ~10-content-type merge+filter+sort pass it
  // triggers (heaviest in the default "All Content" view, where every
  // category's skip flag is false — see the `single`/`skipX` values below)
  // could still run before the shell was genuinely touch-ready.
  // InteractionManager.runAfterInteractions is RN's own idiom for "wait
  // until touch/animation handling has actually settled" — a real fix for
  // time-to-interactive specifically, not a speculative cache.
  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => setContentReady(true));
    return () => task.cancel();
  }, []);

  const f = saved.filters ?? {};
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [gameFilter, setGameFilter] = useState<GameId | null>((f.gameFilter as GameId) ?? null);
  const [rulesetFilter, setRulesetFilter] = useState<RulesetId | null>((f.rulesetFilter as RulesetId) ?? null);

  // Race
  const [raceSize, setRaceSize] = useState<string | null>((f.raceSize as string) ?? null);
  const [raceDarkvision, setRaceDarkvision] = useState(!!f.raceDarkvision);
  const [raceMovement, setRaceMovement] = useState<Set<string>>(new Set((f.raceMovement as string[]) ?? []));
  const [raceHasSubracesOnly, setRaceHasSubracesOnly] = useState(!!f.raceHasSubracesOnly);
  // Subrace
  const [subraceParent, setSubraceParent] = useState<string | null>((f.subraceParent as string) ?? null);
  const [subraceTraits, setSubraceTraits] = useState<Set<SubraceOwnTrait>>(new Set((f.subraceTraits as SubraceOwnTrait[]) ?? []));
  // Class
  const [classCaster, setClassCaster] = useState<string | null>((f.classCaster as string) ?? null);
  const [classHitDie, setClassHitDie] = useState<number | null>((f.classHitDie as number) ?? null);
  const [classSave, setClassSave] = useState<Set<Ability>>(new Set((f.classSave as Ability[]) ?? []));
  const [classArmor, setClassArmor] = useState<Set<string>>(new Set((f.classArmor as string[]) ?? []));
  const [classWeapon, setClassWeapon] = useState<Set<string>>(new Set((f.classWeapon as string[]) ?? []));
  // Subclass
  const [subclassParent, setSubclassParent] = useState<string | null>((f.subclassParent as string) ?? null);
  const [subclassAdds, setSubclassAdds] = useState<Set<SubclassAddition>>(new Set((f.subclassAdds as SubclassAddition[]) ?? []));
  // Background
  const [backgroundSkill, setBackgroundSkill] = useState<Set<SkillName>>(new Set((f.backgroundSkill as SkillName[]) ?? []));
  const [backgroundTool, setBackgroundTool] = useState<Set<string>>(new Set((f.backgroundTool as string[]) ?? []));
  // Feat
  const [featPrereqType, setFeatPrereqType] = useState<string | null>((f.featPrereqType as string) ?? null);
  const [featGrants, setFeatGrants] = useState<Set<'asi' | 'proficiency' | 'activation'>>(new Set((f.featGrants as ('asi' | 'proficiency' | 'activation')[]) ?? []));
  // Spell
  const [spellSchool, setSpellSchool] = useState<string | null>((f.spellSchool as string) ?? null);
  const [spellCast, setSpellCast] = useState<'all' | 'ritual' | 'concentration'>((f.spellCast as 'all' | 'ritual' | 'concentration') ?? 'all');
  const [spellAction, setSpellAction] = useState<string | null>((f.spellAction as string) ?? null);
  const [spellComponents, setSpellComponents] = useState<Set<string>>(new Set((f.spellComponents as string[]) ?? []));
  // Item
  const [itemCat, setItemCat] = useState<ItemCategoryId | null>((f.itemCat as ItemCategoryId) ?? null);
  const [itemMagical, setItemMagical] = useState<'all' | 'magical' | 'mundane'>((f.itemMagical as 'all' | 'magical' | 'mundane') ?? 'all');
  const [itemWeaponClass, setItemWeaponClass] = useState<'martial' | 'simple' | null>((f.itemWeaponClass as 'martial' | 'simple') ?? null);
  const [itemWeaponRange, setItemWeaponRange] = useState<'melee' | 'ranged' | null>((f.itemWeaponRange as 'melee' | 'ranged') ?? null);
  const [itemArmorWeightF, setItemArmorWeightF] = useState<'heavy' | 'medium' | 'light' | null>((f.itemArmorWeight as 'heavy' | 'medium' | 'light') ?? null);
  const [itemRarity, setItemRarity] = useState<Set<string>>(new Set((f.itemRarity as string[]) ?? []));
  // Monster
  const [monsterType, setMonsterType] = useState<string | null>((f.monsterType as string) ?? null);
  const [monsterSize, setMonsterSize] = useState<string | null>((f.monsterSize as string) ?? null);
  const [monsterAlignment, setMonsterAlignment] = useState<string | null>((f.monsterAlignment as string) ?? null);
  const [monsterCrMin, setMonsterCrMin] = useState((f.monsterCrMin as string) ?? '');
  const [monsterCrMax, setMonsterCrMax] = useState((f.monsterCrMax as string) ?? '');
  const [monsterMovement, setMonsterMovement] = useState<Set<string>>(new Set((f.monsterMovement as string[]) ?? []));
  const [monsterResistance, setMonsterResistance] = useState<Set<string>>(new Set((f.monsterResistance as string[]) ?? []));
  const [monsterImmunity, setMonsterImmunity] = useState<Set<string>>(new Set((f.monsterImmunity as string[]) ?? []));
  const [monsterCondImmunity, setMonsterCondImmunity] = useState<Set<string>>(new Set((f.monsterCondImmunity as string[]) ?? []));
  const [monsterLanguage, setMonsterLanguage] = useState<Set<string>>(new Set((f.monsterLanguage as string[]) ?? []));
  const [monsterLegendary, setMonsterLegendary] = useState(!!f.monsterLegendary);
  const [monsterLair, setMonsterLair] = useState(!!f.monsterLair);
  const [monsterDarkvision, setMonsterDarkvision] = useState(!!f.monsterDarkvision);
  const [monsterSpellcaster, setMonsterSpellcaster] = useState(!!f.monsterSpellcaster);

  // Favorites: loaded once on mount (async, SQLite-backed — no-op on web,
  // same limitation as every other SQLite-backed feature in this app).
  useEffect(() => {
    loadFavorites().then(setFavorites).catch(e => console.error('[compendium] loading favorites failed:', e));
  }, []);
  const toggleFavorite = useCallback((type: ContentTypeId, id: string) => {
    setFavorites(prev => {
      const key = favoriteKey(type, id);
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      saveFavorites(next).catch(e => console.error('[compendium] saving favorites failed:', e));
      return next;
    });
  }, []);

  // Persist browse state whenever it changes — one write covers search,
  // sort, content type, and every filter (bundled into one object so a
  // single effect suffices instead of one per field).
  useEffect(() => {
    setBrowseState(SCREEN_KEY, {
      search, sort, contentType,
      filters: {
        gameFilter, rulesetFilter,
        raceSize, raceDarkvision, raceMovement: Array.from(raceMovement), raceHasSubracesOnly,
        subraceParent, subraceTraits: Array.from(subraceTraits),
        classCaster, classHitDie, classSave: Array.from(classSave), classArmor: Array.from(classArmor), classWeapon: Array.from(classWeapon),
        subclassParent, subclassAdds: Array.from(subclassAdds),
        backgroundSkill: Array.from(backgroundSkill), backgroundTool: Array.from(backgroundTool),
        featPrereqType, featGrants: Array.from(featGrants),
        spellSchool, spellCast, spellAction, spellComponents: Array.from(spellComponents),
        itemCat, itemMagical, itemWeaponClass, itemWeaponRange, itemArmorWeight: itemArmorWeightF, itemRarity: Array.from(itemRarity),
        monsterType, monsterSize, monsterAlignment, monsterCrMin, monsterCrMax,
        monsterMovement: Array.from(monsterMovement), monsterResistance: Array.from(monsterResistance),
        monsterImmunity: Array.from(monsterImmunity), monsterCondImmunity: Array.from(monsterCondImmunity),
        monsterLanguage: Array.from(monsterLanguage), monsterLegendary, monsterLair, monsterDarkvision, monsterSpellcaster,
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    search, sort, contentType, gameFilter, rulesetFilter,
    raceSize, raceDarkvision, raceMovement, raceHasSubracesOnly, subraceParent, subraceTraits,
    classCaster, classHitDie, classSave, classArmor, classWeapon, subclassParent, subclassAdds,
    backgroundSkill, backgroundTool, featPrereqType, featGrants,
    spellSchool, spellCast, spellAction, spellComponents,
    itemCat, itemMagical, itemWeaponClass, itemWeaponRange, itemArmorWeightF, itemRarity,
    monsterType, monsterSize, monsterAlignment, monsterCrMin, monsterCrMax,
    monsterMovement, monsterResistance, monsterImmunity, monsterCondImmunity, monsterLanguage,
    monsterLegendary, monsterLair, monsterDarkvision, monsterSpellcaster,
  ]);

  // ── Data sources — same paths every other screen already uses ──
  // PERF-COMPENDIUM-1: every one of these is the actually-expensive part
  // (full content merge, full spell/item/monster index build) — gated
  // behind `contentReady` so NONE of it runs during the first synchronous
  // render that paints the shell. Falls back to cheap, stable-reference
  // empty containers until the post-paint effect flips `contentReady`.
  const activeRuleset = rulesetFilter ?? undefined;
  // Official mode reads ONLY official content (see src/content/officialCatalog.ts):
  // nothing here depends on the homebrew store.
  const contentDB = useMemo(
    () => contentReady ? officialContentDB(activeRuleset) : EMPTY_CONTENT_DB,
    [contentReady, activeRuleset],
  );
  const races = contentDB.races;
  const classes = contentDB.classes;
  const backgrounds = contentDB.backgrounds;
  const feats = contentDB.feats ?? EMPTY_FEATS;
  const conditions = contentDB.conditions;
  const subraces: SubraceWithParent[] = useMemo(() => contentReady ? flattenSubraces(races) : EMPTY_RESULTS, [contentReady, races]);
  const subclassEntries: SubclassEntryWithParent[] = useMemo(() => {
    if (!contentReady) return EMPTY_RESULTS;
    return attachParentClassNames(officialSubclassEntries(classes), classes);
  }, [contentReady, classes]);
  const spellIndex = useMemo(() => contentReady ? officialSpellIndex(activeRuleset) : EMPTY_RESULTS, [contentReady, activeRuleset]);
  const itemIndex = useMemo(() => contentReady ? officialItemIndex(activeRuleset) : EMPTY_RESULTS, [contentReady, activeRuleset]);
  const monsterTemplates = useMemo(() => contentReady ? officialMonsterTemplates(activeRuleset) : EMPTY_RESULTS, [contentReady, activeRuleset]);

  const scratchEntity = useMemo(() => makeEmptyEntity('compendium'), []);

  // Available Game/Ruleset options — REAL, present-only, derived from
  // whatever's actually tagged across every content type right now, never
  // a hardcoded D&D-only list (GAME-AGNOSTIC-1).
  const availableRulesetIds = useMemo(() => {
    const set = new Set<RulesetId>();
    for (const arr of [races, classes, backgrounds, feats, conditions] as { rulesetId?: RulesetId }[][]) {
      for (const c of arr) if (c.rulesetId) set.add(c.rulesetId);
    }
    for (const s of spellIndex) if (s.rulesetId) set.add(s.rulesetId);
    for (const i of itemIndex) if (i.rulesetId) set.add(i.rulesetId);
    for (const m of monsterTemplates) if (m.rulesetId) set.add(m.rulesetId);
    for (const e of subclassEntries) if (e.progression.rulesetId) set.add(e.progression.rulesetId);
    return Array.from(set);
  }, [races, classes, backgrounds, feats, conditions, spellIndex, itemIndex, monsterTemplates, subclassEntries]);
  const availableGameIds = useMemo(() => Array.from(new Set(availableRulesetIds.map(gameIdForRuleset).filter((g): g is GameId => !!g))), [availableRulesetIds]);
  const availableGames = availableGameIds.map(id => ({ id, label: Object.values(GAMES).find(g => g.id === id)?.name ?? id }));
  const availableRulesets = availableRulesetIds
    .filter(r => !gameFilter || gameIdForRuleset(r) === gameFilter)
    .map(id => ({ id, label: RULESETS[id]?.name ?? id }));

  // ── Per-type sourceLabel-capable sort options (Official mode: nothing here is homebrew) ──
  const raceSorts = raceSortOptions(notHomebrew);
  const subraceSorts = subraceSortOptions(notHomebrew);
  const classSorts = classSortOptions(notHomebrew);
  const subclassSorts = subclassSortOptions(notHomebrew);
  const backgroundSorts = backgroundSortOptions(notHomebrew);
  const featSorts = featSortOptions(scratchEntity, notHomebrew);
  const spellSorts = spellSortOptions(notHomebrew);
  const itemSorts = itemSortOptions(notHomebrew);
  const monsterSorts = monsterSortOptions(notHomebrew);
  const conditionSorts = conditionSortOptions(notHomebrew);
  const mixedSorts: SortOption<BrowsableEntry>[] = [
    ...nameSortOptions<BrowsableEntry>(),
    contentTypeSortOption<BrowsableEntry>(),
    sourceSortOption<BrowsableEntry>(entrySourceLabel),
  ];

  // ── Global predicate (Game/Ruleset/Official-Homebrew) — same for every
  // type, applied before any type-specific filter. ──
  const matchesGlobal = useCallback((rulesetId: RulesetId | undefined, isHomebrew: boolean, srd: boolean | undefined, type: ContentTypeId): boolean => {
    if (!isContentExposed({ isHomebrew, srd, type }, CONTENT_EXPOSURE)) return false;
    if (!matchesGame(rulesetId, gameFilter ?? undefined)) return false;
    if (!matchesRuleset(rulesetId, rulesetFilter ?? undefined)) return false;
    return true;
  }, [gameFilter, rulesetFilter]);
  const matchesFav = useCallback((type: ContentTypeId, id: string): boolean => {
    return !favoritesOnly || favorites.has(favoriteKey(type, id));
  }, [favoritesOnly, favorites]);

  const q = search.trim().toLowerCase();

  // ── Per-type filtered + sorted raw arrays (type-specific filters only
  // apply in single-type mode — see the `single` guard on each). ──
  const single = contentType !== 'all';

  // PERF-COMPENDIUM-1 (item 2): a specific OTHER type being selected means
  // this type's rows are never read (`entriesByType[contentType]` picks
  // only the active type; 'all' mode is the only case that reads every
  // type) — skip the filter+sort pass entirely rather than computing rows
  // nobody will see. `single && contentType !== '<this type>'` is the
  // exact "some other type is exclusively active" condition.
  const skipRace = single && contentType !== 'race';
  const filteredRaces = useMemo(() => {
    if (!contentReady || skipRace) return EMPTY_RESULTS;
    return sortByOption(races.filter(r => {
    if (!matchesGlobal(r.rulesetId, false, r.srd, 'race') || !matchesFav('race', r.id)) return false;
    if (!matchesSearchText(r.name, [], q)) return false;
    if (single && contentType === 'race') {
      if (raceSize && r.size !== raceSize) return false;
      if (raceDarkvision && !hasDarkvision(r)) return false;
      if (raceMovement.size > 0 && !Array.from(raceMovement).some(m => raceMovementTypes(r).includes(m))) return false;
      if (raceHasSubracesOnly && !hasSubraces(r)) return false;
    }
    return true;
  }), raceSorts, sort);
  }, [contentReady, skipRace, races, q, single, contentType, raceSize, raceDarkvision, raceMovement, raceHasSubracesOnly, sort, raceSorts, matchesGlobal, matchesFav]);

  const skipSubrace = single && contentType !== 'subrace';
  const filteredSubraces = useMemo(() => {
    if (!contentReady || skipSubrace) return EMPTY_RESULTS;
    return sortByOption(subraces.filter(sr => {
    if (!matchesGlobal(sr.rulesetId, false, sr.srd, 'subrace')) return false;
    if (!matchesFav('subrace', sr.id)) return false;
    if (!matchesSearchText(sr.name, [sr.parentRaceName], q)) return false;
    if (single && contentType === 'subrace') {
      if (subraceParent && sr.parentRaceId !== subraceParent) return false;
      if (subraceTraits.size > 0) {
        const own = subraceOwnTraits(sr);
        if (!Array.from(subraceTraits).some(t => own.has(t))) return false;
      }
    }
    return true;
  }), subraceSorts, sort);
  }, [contentReady, skipSubrace, subraces, q, single, contentType, subraceParent, subraceTraits, sort, subraceSorts, matchesGlobal, matchesFav]);

  const skipClass = single && contentType !== 'class';
  const filteredClasses = useMemo(() => {
    if (!contentReady || skipClass) return EMPTY_RESULTS;
    return sortByOption(classes.filter(c => {
    if (!matchesGlobal(c.rulesetId, false, c.srd, 'class') || !matchesFav('class', c.id)) return false;
    if (!matchesSearchText(c.name, [], q)) return false;
    if (single && contentType === 'class') {
      if (classCaster && (CASTER_TYPE[c.id] ?? 'Martial') !== classCaster) return false;
      if (classHitDie && c.hitDie !== classHitDie) return false;
      if (classSave.size > 0 && !Array.from(classSave).some(a => c.savingThrows?.includes(a))) return false;
      if (classArmor.size > 0 && !Array.from(classArmor).some(a => c.armorProfs?.includes(a))) return false;
      if (classWeapon.size > 0 && !Array.from(classWeapon).some(w => c.weaponProfs?.includes(w))) return false;
    }
    return true;
  }), classSorts, sort);
  }, [contentReady, skipClass, classes, q, single, contentType, classCaster, classHitDie, classSave, classArmor, classWeapon, sort, classSorts, matchesGlobal, matchesFav]);

  const skipSubclass = single && contentType !== 'subclass';
  const filteredSubclasses = useMemo(() => {
    if (!contentReady || skipSubclass) return EMPTY_RESULTS;
    return sortByOption(subclassEntries.filter(s => {
    if (!matchesGlobal(s.progression.rulesetId, false, s.progression.srd, 'subclass') || !matchesFav('subclass', s.id)) return false;
    if (!matchesSearchText(s.name, [s.parentClassName], q)) return false;
    if (single && contentType === 'subclass') {
      if (subclassParent && s.classId !== subclassParent) return false;
      if (subclassAdds.size > 0) {
        const adds = subclassAdditions(s.progression);
        if (!Array.from(subclassAdds).some(a => adds.has(a))) return false;
      }
    }
    return true;
  }), subclassSorts, sort);
  }, [contentReady, skipSubclass, subclassEntries, q, single, contentType, subclassParent, subclassAdds, sort, subclassSorts, matchesGlobal, matchesFav]);

  const skipBackground = single && contentType !== 'background';
  const filteredBackgrounds = useMemo(() => {
    if (!contentReady || skipBackground) return EMPTY_RESULTS;
    return sortByOption(backgrounds.filter(b => {
    if (!matchesGlobal(b.rulesetId, false, b.srd, 'background') || !matchesFav('background', b.id)) return false;
    if (!matchesSearchText(b.name, [], q)) return false;
    if (single && contentType === 'background') {
      if (backgroundSkill.size > 0 && !Array.from(backgroundSkill).some(s => backgroundSkillGrants(b).includes(s))) return false;
      if (backgroundTool.size > 0 && !Array.from(backgroundTool).some(t => (b.toolProficiencies ?? []).includes(t))) return false;
    }
    return true;
  }), backgroundSorts, sort);
  }, [contentReady, skipBackground, backgrounds, q, single, contentType, backgroundSkill, backgroundTool, sort, backgroundSorts, matchesGlobal, matchesFav]);

  const skipFeat = single && contentType !== 'feat';
  const filteredFeats = useMemo(() => {
    if (!contentReady || skipFeat) return EMPTY_RESULTS;
    return sortByOption(feats.filter(ft => {
    if (!matchesGlobal(ft.rulesetId, false, ft.srd, 'feat') || !matchesFav('feat', ft.id)) return false;
    if (!matchesSearchText(ft.name, [], q)) return false;
    if (single && contentType === 'feat') {
      if (featPrereqType && primaryPrereqCategory(ft.prerequisite) !== featPrereqType) return false;
      if (featGrants.size > 0) {
        const grants = new Set<string>();
        if (featGrantsAsi(ft)) grants.add('asi');
        if (featGrantsProficiency(ft)) grants.add('proficiency');
        if (featGrantsActivation(ft)) grants.add('activation');
        if (!Array.from(featGrants).some(g => grants.has(g))) return false;
      }
    }
    return true;
  }), featSorts, sort);
  }, [contentReady, skipFeat, feats, q, single, contentType, featPrereqType, featGrants, sort, featSorts, matchesGlobal, matchesFav]);

  const skipSpell = single && contentType !== 'spell';
  const filteredSpells = useMemo(() => {
    if (!contentReady || skipSpell) return EMPTY_RESULTS;
    return sortByOption(spellIndex.filter(s => {
    if (!matchesGlobal(s.rulesetId, false, s.srd, 'spell') || !matchesFav('spell', s.id)) return false;
    if (!matchesSearchText(s.name, [s.school], q)) return false;
    if (single && contentType === 'spell') {
      if (spellSchool && s.school !== spellSchool) return false;
      if (spellCast !== 'all' && (spellCast === 'ritual' ? !s.ritual : !s.concentration)) return false;
      if (spellAction && actionType(s) !== spellAction) return false;
      if (spellComponents.size > 0 && !Array.from(spellComponents).some(c => (s.components ?? []).includes(c))) return false;
    }
    return true;
  }), spellSorts, sort);
  }, [contentReady, skipSpell, spellIndex, q, single, contentType, spellSchool, spellCast, spellAction, spellComponents, sort, spellSorts, matchesGlobal, matchesFav]);

  const skipItem = single && contentType !== 'item';
  const filteredItems = useMemo(() => {
    if (!contentReady || skipItem) return EMPTY_RESULTS;
    return sortByOption(itemIndex.filter(i => {
    if (!matchesGlobal(i.rulesetId, false, i.srd, 'item') || !matchesFav('item', i.id)) return false;
    if (!matchesSearchText(i.name, [], q)) return false;
    if (single && contentType === 'item') {
      if (itemCat && itemCategory(i) !== itemCat) return false;
      if (itemMagical !== 'all' && (itemMagical === 'magical') !== isMagic(i)) return false;
      if (itemWeaponClass && (itemCategory(i) !== 'weapon' || (itemWeaponClass === 'martial' ? !isMartialWeapon(i) : isMartialWeapon(i)))) return false;
      if (itemWeaponRange && (itemCategory(i) !== 'weapon' || (itemWeaponRange === 'ranged' ? !isRangedWeapon(i) : isRangedWeapon(i)))) return false;
      if (itemArmorWeightF && armorWeight(i) !== itemArmorWeightF) return false;
      if (itemRarity.size > 0 && (rarityOf(i) === null || !itemRarity.has(rarityOf(i)!))) return false;
    }
    return true;
  }), itemSorts, sort);
  }, [contentReady, skipItem, itemIndex, q, single, contentType, itemCat, itemMagical, itemWeaponClass, itemWeaponRange, itemArmorWeightF, itemRarity, sort, itemSorts, matchesGlobal, matchesFav]);

  const skipMonster = single && contentType !== 'monster';
  const filteredMonsters = useMemo(() => {
    if (!contentReady || skipMonster) return EMPTY_RESULTS;
    return sortByOption(monsterTemplates.filter(m => {
    if (!matchesGlobal(m.rulesetId, false, m.srd, 'monster') || !matchesFav('monster', m.id)) return false;
    if (!matchesSearchText(m.name, [m.type], q)) return false;
    if (single && contentType === 'monster') {
      const min = parseFloat(monsterCrMin), max = parseFloat(monsterCrMax);
      if (!isNaN(min) && m.cr < min) return false;
      if (!isNaN(max) && m.cr > max) return false;
      if (monsterType && m.type !== monsterType) return false;
      if (monsterSize && m.size !== monsterSize) return false;
      if (monsterAlignment && m.alignment !== monsterAlignment) return false;
      if (monsterLegendary && (m.legendaryActions ?? 0) === 0) return false;
      if (monsterLair && (m.lairActions?.length ?? 0) === 0) return false;
      if (monsterDarkvision && !monsterHasDarkvision(m)) return false;
      if (monsterSpellcaster && !monsterIsSpellcaster(m)) return false;
      if (monsterMovement.size > 0 && !Array.from(monsterMovement).some(mv => monsterMovementTypes(m).has(mv))) return false;
      if (monsterResistance.size > 0 && !Array.from(monsterResistance).some(r => monsterResistances(m).has(r))) return false;
      if (monsterImmunity.size > 0 && !Array.from(monsterImmunity).some(im => monsterImmunities(m).has(im))) return false;
      if (monsterCondImmunity.size > 0 && !Array.from(monsterCondImmunity).some(ci => monsterConditionImmunities(m).has(ci))) return false;
      if (monsterLanguage.size > 0 && !Array.from(monsterLanguage).some(l => m.languages.includes(l))) return false;
    }
    return true;
  }), monsterSorts, sort);
  }, [
    contentReady, skipMonster, monsterTemplates, q, single, contentType,
    monsterCrMin, monsterCrMax, monsterType, monsterSize, monsterAlignment, monsterLegendary, monsterLair, monsterDarkvision,
    monsterSpellcaster, monsterMovement, monsterResistance, monsterImmunity, monsterCondImmunity, monsterLanguage, sort, monsterSorts,
    matchesGlobal, matchesFav,
  ]);

  const skipCondition = single && contentType !== 'condition';
  const filteredConditions = useMemo(() => {
    if (!contentReady || skipCondition) return EMPTY_RESULTS;
    return sortByOption(conditions.filter(c => {
    if (!matchesGlobal(c.rulesetId, false, undefined, 'condition') || !matchesFav('condition', c.id)) return false;
    if (!matchesSearchText(c.name, [c.description], q)) return false;
    return true;
  }), conditionSorts, sort);
  }, [contentReady, skipCondition, conditions, q, sort, conditionSorts, matchesGlobal, matchesFav]);

  // ── Wrap into BrowsableEntry[] for rendering — single-type mode picks
  // just the active type's list; All mode concatenates every type (each
  // already global-filtered above, type-specific filters simply never
  // apply since contentType !== that type) and re-sorts with the mixed
  // A–Z/Content Type/Source sort options. ──
  const entriesByType: Record<ContentTypeId, BrowsableEntry[]> = {
    race:       filteredRaces.map(r => raceToBrowsable(r, false)),
    subrace:    filteredSubraces.map(s => subraceToBrowsable(s, false)),
    class:      filteredClasses.map(c => classToBrowsable(c, false)),
    subclass:   filteredSubclasses.map(s => subclassToBrowsable(s, false)),
    background: filteredBackgrounds.map(b => backgroundToBrowsable(b, false)),
    feat:       filteredFeats.map(ft => featToBrowsable(ft, false)),
    spell:      filteredSpells.map(s => spellToBrowsable(s, false)),
    item:       filteredItems.map(i => itemToBrowsable(i, false)),
    monster:    filteredMonsters.map(m => monsterToBrowsable(m, false)),
    condition:  filteredConditions.map(c => conditionToBrowsable(c, false)),
  };

  const results: BrowsableEntry[] = contentType === 'all'
    ? sortByOption(CONTENT_TYPE_ORDER.flatMap(t => entriesByType[t]), mixedSorts, sort)
    : entriesByType[contentType];

  // SortControl only ever reads `.id`/`.label` off these (the actual
  // per-type compare logic already ran above, inside each `filtered*`
  // useMemo) — cast through unknown since the branches are genuinely
  // heterogeneous SortOption<T> types with no shared T.
  const activeSortOptions = (contentType === 'all' ? mixedSorts
    : contentType === 'race' ? raceSorts
    : contentType === 'subrace' ? subraceSorts
    : contentType === 'class' ? classSorts
    : contentType === 'subclass' ? subclassSorts
    : contentType === 'background' ? backgroundSorts
    : contentType === 'feat' ? featSorts
    : contentType === 'spell' ? spellSorts
    : contentType === 'item' ? itemSorts
    : contentType === 'monster' ? monsterSorts
    : conditionSorts) as unknown as SortOption<unknown>[];

  // Reset to that type's default sort id when switching content type, so a
  // stale sort id from a different type's option list never silently no-ops.
  function changeContentType(next: ContentTypeId | 'all') {
    setContentType(next);
    setSort('name_asc');
    setExpandedId(null);
  }

  // PERF-COMPENDIUM-1 (item 2): these are the actual "type-specific filter
  // MODEL" the spec asks to defer — every one of them is now (a) memoized
  // (previously recomputed on every render for ANY reason, including
  // renders triggered by an entirely different tab's state changing) and
  // (b) gated to only build for the currently-selected single type, so
  // e.g. `availableMonsterResistances` never runs a full monster-catalog
  // flatMap while the user is on the Race tab.
  const availableItemRarities = useMemo(
    () => (single && contentType === 'item') ? RARITY_TIERS.filter(r => itemIndex.some(i => rarityOf(i) === r)) : EMPTY_RESULTS,
    [single, contentType, itemIndex],
  );
  const availableSpellSchools = useMemo(
    () => (single && contentType === 'spell') ? Array.from(new Set(spellIndex.map(s => s.school))).sort() : EMPTY_RESULTS,
    [single, contentType, spellIndex],
  );
  const availableSpellComponents = useMemo(
    () => (single && contentType === 'spell') ? Array.from(new Set(spellIndex.flatMap(s => s.components ?? []))) : EMPTY_RESULTS,
    [single, contentType, spellIndex],
  );
  const availableBgSkills = useMemo(
    () => (single && contentType === 'background') ? Array.from(new Set(backgrounds.flatMap(backgroundSkillGrants))).sort().map(s => ({ id: s, label: skillLabel(s) })) : EMPTY_RESULTS,
    [single, contentType, backgrounds],
  );
  const availableBgTools = useMemo(
    () => (single && contentType === 'background') ? Array.from(new Set(backgrounds.flatMap(b => b.toolProficiencies ?? []))).sort() : EMPTY_RESULTS,
    [single, contentType, backgrounds],
  );
  const availableClassHitDice = useMemo(
    () => (single && contentType === 'class') ? Array.from(new Set(classes.map(c => c.hitDie))).sort((a, b) => a - b) : EMPTY_RESULTS,
    [single, contentType, classes],
  );
  const availableClassSaves = useMemo(
    () => (single && contentType === 'class') ? Array.from(new Set(classes.flatMap(c => c.savingThrows ?? []))) : EMPTY_RESULTS,
    [single, contentType, classes],
  );
  const availableClassArmor = useMemo(
    () => (single && contentType === 'class') ? Array.from(new Set(classes.flatMap(c => c.armorProfs ?? []))) : EMPTY_RESULTS,
    [single, contentType, classes],
  );
  const availableClassWeapon = useMemo(
    () => (single && contentType === 'class') ? Array.from(new Set(classes.flatMap(c => c.weaponProfs ?? []))) : EMPTY_RESULTS,
    [single, contentType, classes],
  );
  const availableRaceSizes = useMemo(
    () => (single && contentType === 'race') ? RACE_SIZE_ORDER.filter(s => races.some(r => r.size === s)) : EMPTY_RESULTS,
    [single, contentType, races],
  );
  const availableRaceMovement = useMemo(
    () => (single && contentType === 'race') ? RACE_MOVEMENT_TYPES.filter(m => races.some(r => raceMovementTypes(r).includes(m))) : EMPTY_RESULTS,
    [single, contentType, races],
  );
  const availableMonsterTypes = useMemo(
    () => (single && contentType === 'monster') ? Array.from(new Set(monsterTemplates.map(m => m.type))).sort() : EMPTY_RESULTS,
    [single, contentType, monsterTemplates],
  );
  const availableMonsterSizes = useMemo(
    () => (single && contentType === 'monster') ? MONSTER_SIZE_ORDER.filter(s => monsterTemplates.some(m => m.size === s)) : EMPTY_RESULTS,
    [single, contentType, monsterTemplates],
  );
  const availableMonsterAlignments = useMemo(
    () => (single && contentType === 'monster') ? Array.from(new Set(monsterTemplates.map(m => m.alignment))).sort() : EMPTY_RESULTS,
    [single, contentType, monsterTemplates],
  );
  const availableMonsterResistances = useMemo(
    () => (single && contentType === 'monster') ? Array.from(new Set(monsterTemplates.flatMap(m => Array.from(monsterResistances(m))))).sort() : EMPTY_RESULTS,
    [single, contentType, monsterTemplates],
  );
  const availableMonsterImmunities = useMemo(
    () => (single && contentType === 'monster') ? Array.from(new Set(monsterTemplates.flatMap(m => Array.from(monsterImmunities(m))))).sort() : EMPTY_RESULTS,
    [single, contentType, monsterTemplates],
  );
  const availableMonsterCondImmunities = useMemo(
    () => (single && contentType === 'monster') ? Array.from(new Set(monsterTemplates.flatMap(m => Array.from(monsterConditionImmunities(m))))).sort() : EMPTY_RESULTS,
    [single, contentType, monsterTemplates],
  );
  const availableMonsterLanguages = useMemo(
    () => (single && contentType === 'monster') ? Array.from(new Set(monsterTemplates.flatMap(m => m.languages))).sort() : EMPTY_RESULTS,
    [single, contentType, monsterTemplates],
  );

  const globalFilterChips = [
    ...(gameFilter ? [{ key: 'game', label: Object.values(GAMES).find(g => g.id === gameFilter)?.name ?? gameFilter, onClear: () => { setGameFilter(null); setRulesetFilter(null); } }] : []),
    ...(rulesetFilter ? [{ key: 'ruleset', label: RULESETS[rulesetFilter]?.name ?? rulesetFilter, onClear: () => setRulesetFilter(null) }] : []),
  ];
  function clearAllFilters() {
    setGameFilter(null); setRulesetFilter(null);
    setRaceSize(null); setRaceDarkvision(false); setRaceMovement(new Set()); setRaceHasSubracesOnly(false);
    setSubraceParent(null); setSubraceTraits(new Set());
    setClassCaster(null); setClassHitDie(null); setClassSave(new Set()); setClassArmor(new Set()); setClassWeapon(new Set());
    setSubclassParent(null); setSubclassAdds(new Set());
    setBackgroundSkill(new Set()); setBackgroundTool(new Set());
    setFeatPrereqType(null); setFeatGrants(new Set());
    setSpellSchool(null); setSpellCast('all'); setSpellAction(null); setSpellComponents(new Set());
    setItemCat(null); setItemMagical('all'); setItemWeaponClass(null); setItemWeaponRange(null); setItemArmorWeightF(null); setItemRarity(new Set());
    setMonsterType(null); setMonsterSize(null); setMonsterAlignment(null); setMonsterCrMin(''); setMonsterCrMax('');
    setMonsterMovement(new Set()); setMonsterResistance(new Set()); setMonsterImmunity(new Set()); setMonsterCondImmunity(new Set());
    setMonsterLanguage(new Set()); setMonsterLegendary(false); setMonsterLair(false); setMonsterDarkvision(false); setMonsterSpellcaster(false);
  }

  return (
    <View style={styles.screen} testID="compendium-screen">
      <View style={styles.header}>
        <Text style={styles.subtitle}>{contentType === 'all' ? 'All Content' : CONTENT_TYPE_LABELS[contentType]}</Text>
      </View>

      <View style={styles.searchWrap}>
        <View style={styles.searchRow}>
          <TextInput
            testID="compendium-search"
            accessibilityLabel="Compendium search"
            style={[styles.searchInput, styles.searchInputFlex]}
            value={search}
            onChangeText={setSearch}
            placeholder="Search everything…"
            placeholderTextColor={Colors.textDim}
          />
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.typeRow} contentContainerStyle={styles.typeRowContent}>
          <Pressable style={[styles.typeChip, contentType === 'all' && styles.typeChipActive]} onPress={() => changeContentType('all')}>
            <Text style={[styles.typeChipTxt, contentType === 'all' && styles.typeChipTxtActive]}>All</Text>
          </Pressable>
          {CONTENT_TYPE_ORDER.map(t => (
            <Pressable key={t} style={[styles.typeChip, contentType === t && styles.typeChipActive]} onPress={() => changeContentType(t)}>
              <Text style={[styles.typeChipTxt, contentType === t && styles.typeChipTxtActive]}>{CONTENT_TYPE_LABELS[t]}</Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* PERF-SORT-1 (item 3): Filters + Sort share one row, pinned to
            opposite ends — the same layout ItemPickerModal.tsx already
            established, now applied consistently everywhere a browse
            screen has both controls, instead of Sort floating alone on its
            own left-aligned line. */}
        <View style={styles.controlsRow}>
          <Pressable testID="compendium-filters" accessibilityLabel="Compendium filters" style={[styles.favToggle, filtersOpen && styles.favToggleActive]} onPress={() => setFiltersOpen(v => !v)}>
            <Text style={[styles.favToggleTxt, filtersOpen && styles.favToggleTxtActive]}>Filters</Text>
          </Pressable>
          <SortControl options={activeSortOptions} value={sort} onChange={setSort} />
        </View>

        <Pressable style={[styles.favToggle, favoritesOnly && styles.favToggleActive]} onPress={() => setFavoritesOnly(v => !v)}>
          <Text style={[styles.favToggleTxt, favoritesOnly && styles.favToggleTxtActive]}>
            {favoritesOnly ? '⭐ Favorites only' : '☆ Favorites only'}
          </Text>
        </Pressable>

        {filtersOpen && (
          <View style={styles.filterPanel}>
            {availableGames.length > 1 && (
              <FilterSection label="Game">
                <FilterChipRow options={availableGames} value={gameFilter} onChange={v => { setGameFilter(v); setRulesetFilter(null); }} />
              </FilterSection>
            )}
            {availableRulesets.length > 1 && (
              <FilterSection label="Ruleset / Version">
                <FilterChipRow options={availableRulesets} value={rulesetFilter} onChange={setRulesetFilter} scrollable />
              </FilterSection>
            )}
            {contentType === 'all' && availableGames.length <= 1 && availableRulesets.length <= 1 && (
              <Text style={styles.filterHint}>Choose a content type above to see its filters.</Text>
            )}

            {contentType === 'race' && (
              <>
                <FilterSection label="Size">
                  <FilterChipRow options={availableRaceSizes.map(s => ({ id: s, label: s }))} value={raceSize} onChange={setRaceSize} />
                </FilterSection>
                <FilterSection label="Movement">
                  <MultiSelectChipRow options={availableRaceMovement.map(m => ({ id: m, label: m[0].toUpperCase() + m.slice(1) }))} values={raceMovement} onChange={setRaceMovement} />
                </FilterSection>
                <Pressable style={[styles.chip, raceHasSubracesOnly && styles.chipActive]} onPress={() => setRaceHasSubracesOnly(v => !v)}>
                  <Text style={[styles.chipTxt, raceHasSubracesOnly && styles.chipTxtActive]}>Has Subraces</Text>
                </Pressable>
                <Pressable style={[styles.chip, raceDarkvision && styles.chipActive]} onPress={() => setRaceDarkvision(v => !v)}>
                  <Text style={[styles.chipTxt, raceDarkvision && styles.chipTxtActive]}>Darkvision</Text>
                </Pressable>
              </>
            )}

            {contentType === 'subrace' && (
              <>
                {races.length > 1 && (
                  <FilterSection label="Parent Race">
                    <FilterChipRow options={races.map(r => ({ id: r.id, label: r.name }))} value={subraceParent} onChange={setSubraceParent} scrollable />
                  </FilterSection>
                )}
                <FilterSection label="Own Changes / Grants">
                  <MultiSelectChipRow
                    options={(Object.keys(SUBRACE_OWN_TRAIT_LABELS) as SubraceOwnTrait[]).map(t => ({ id: t, label: SUBRACE_OWN_TRAIT_LABELS[t] }))}
                    values={subraceTraits} onChange={setSubraceTraits} scrollable
                  />
                </FilterSection>
              </>
            )}

            {contentType === 'class' && (
              <>
                <FilterSection label="Caster Type">
                  <FilterChipRow options={CASTER_TYPES.map(ct => ({ id: ct, label: ct }))} value={classCaster} onChange={setClassCaster} />
                </FilterSection>
                <FilterSection label="Hit Die">
                  <FilterChipRow options={availableClassHitDice.map(d => ({ id: String(d), label: `d${d}` }))} value={classHitDie === null ? null : String(classHitDie)} onChange={v => setClassHitDie(v === null ? null : Number(v))} />
                </FilterSection>
                <FilterSection label="Saving Throw Proficiency">
                  <MultiSelectChipRow options={availableClassSaves.map(a => ({ id: a, label: ABILITY_LABELS[a] }))} values={classSave} onChange={setClassSave} />
                </FilterSection>
                <FilterSection label="Armor Proficiency">
                  <MultiSelectChipRow options={availableClassArmor.map(a => ({ id: a, label: ARMOR_LABELS[a] ?? a }))} values={classArmor} onChange={setClassArmor} />
                </FilterSection>
                <FilterSection label="Weapon Proficiency">
                  <MultiSelectChipRow options={availableClassWeapon.map(w => ({ id: w, label: WEAPON_LABELS[w] ?? w }))} values={classWeapon} onChange={setClassWeapon} />
                </FilterSection>
              </>
            )}

            {contentType === 'subclass' && (
              <>
                {classes.length > 1 && (
                  <FilterSection label="Parent Class">
                    <FilterChipRow options={classes.map(c => ({ id: c.id, label: c.name }))} value={subclassParent} onChange={setSubclassParent} scrollable />
                  </FilterSection>
                )}
                <FilterSection label="What It Adds">
                  <MultiSelectChipRow
                    options={(Object.keys(SUBCLASS_ADDITION_LABELS) as SubclassAddition[]).map(a => ({ id: a, label: SUBCLASS_ADDITION_LABELS[a] }))}
                    values={subclassAdds} onChange={setSubclassAdds} scrollable
                  />
                </FilterSection>
              </>
            )}

            {contentType === 'background' && (
              <>
                <FilterSection label="Skill Proficiency">
                  <MultiSelectChipRow options={availableBgSkills} values={backgroundSkill} onChange={setBackgroundSkill} scrollable />
                </FilterSection>
                {availableBgTools.length > 0 && (
                  <FilterSection label="Tool Proficiency">
                    <MultiSelectChipRow options={availableBgTools.map(t => ({ id: t, label: t }))} values={backgroundTool} onChange={setBackgroundTool} scrollable />
                  </FilterSection>
                )}
              </>
            )}

            {contentType === 'feat' && (
              <>
                <FilterSection label="Prerequisite Type">
                  <FilterChipRow
                    options={['Ability Score', 'Spellcasting', 'Armor Proficiency', 'Weapon Proficiency', 'Level', 'Race / Species', 'None'].map(c => ({ id: c, label: c }))}
                    value={featPrereqType} onChange={setFeatPrereqType} scrollable
                  />
                </FilterSection>
                <FilterSection label="Grants">
                  <MultiSelectChipRow
                    options={[{ id: 'asi', label: 'Ability Score' }, { id: 'proficiency', label: 'Proficiency' }, { id: 'activation', label: 'Activated Ability' }]}
                    values={featGrants} onChange={setFeatGrants}
                  />
                </FilterSection>
              </>
            )}

            {contentType === 'spell' && (
              <>
                <FilterSection label="School">
                  <FilterChipRow options={availableSpellSchools.map(s => ({ id: s, label: s }))} value={spellSchool} onChange={setSpellSchool} scrollable />
                </FilterSection>
                <FilterSection label="Ritual / Concentration">
                  <FilterChipRow options={[{ id: 'ritual' as const, label: 'Ritual' }, { id: 'concentration' as const, label: 'Concentration' }]} value={spellCast === 'all' ? null : spellCast} onChange={v => setSpellCast(v ?? 'all')} />
                </FilterSection>
                <FilterSection label="Casting Time">
                  <FilterChipRow options={ACTION_TYPES.map(a => ({ id: a, label: a }))} value={spellAction} onChange={setSpellAction} />
                </FilterSection>
                {availableSpellComponents.length > 1 && (
                  <FilterSection label="Components">
                    <MultiSelectChipRow options={availableSpellComponents.map(c => ({ id: c, label: c }))} values={spellComponents} onChange={setSpellComponents} />
                  </FilterSection>
                )}
              </>
            )}

            {contentType === 'item' && (
              <>
                <FilterSection label="Category">
                  <FilterChipRow options={(Object.keys(ITEM_CATEGORY_LABELS) as ItemCategoryId[]).map(id => ({ id, label: ITEM_CATEGORY_LABELS[id] }))} value={itemCat} onChange={setItemCat} scrollable />
                </FilterSection>
                <FilterSection label="Magical / Mundane">
                  <FilterChipRow options={[{ id: 'magical' as const, label: 'Magical' }, { id: 'mundane' as const, label: 'Mundane' }]} value={itemMagical === 'all' ? null : itemMagical} onChange={v => setItemMagical(v ?? 'all')} />
                </FilterSection>
                {itemCat === 'weapon' && (
                  <>
                    <FilterSection label="Weapon Class">
                      <FilterChipRow options={[{ id: 'martial' as const, label: 'Martial' }, { id: 'simple' as const, label: 'Simple' }]} value={itemWeaponClass} onChange={setItemWeaponClass} />
                    </FilterSection>
                    <FilterSection label="Weapon Range">
                      <FilterChipRow options={[{ id: 'melee' as const, label: 'Melee' }, { id: 'ranged' as const, label: 'Ranged' }]} value={itemWeaponRange} onChange={setItemWeaponRange} />
                    </FilterSection>
                  </>
                )}
                {itemCat === 'armor' && (
                  <FilterSection label="Armor Class">
                    <FilterChipRow options={[{ id: 'heavy' as const, label: 'Heavy' }, { id: 'medium' as const, label: 'Medium' }, { id: 'light' as const, label: 'Light' }]} value={itemArmorWeightF} onChange={setItemArmorWeightF} />
                  </FilterSection>
                )}
                {availableItemRarities.length > 0 && (
                  <FilterSection label="Rarity">
                    <MultiSelectChipRow options={availableItemRarities.map(r => ({ id: r, label: r[0].toUpperCase() + r.slice(1) }))} values={itemRarity} onChange={setItemRarity} />
                  </FilterSection>
                )}
              </>
            )}

            {contentType === 'monster' && (
              <>
                <View style={styles.crRow}>
                  <TextInput style={styles.crInput} value={monsterCrMin} onChangeText={setMonsterCrMin} placeholder="CR min" placeholderTextColor={Colors.textDim} keyboardType="decimal-pad" />
                  <TextInput style={styles.crInput} value={monsterCrMax} onChangeText={setMonsterCrMax} placeholder="CR max" placeholderTextColor={Colors.textDim} keyboardType="decimal-pad" />
                </View>
                <FilterSection label="Creature Type">
                  <FilterChipRow options={availableMonsterTypes.map(t => ({ id: t, label: t }))} value={monsterType} onChange={setMonsterType} scrollable />
                </FilterSection>
                <FilterSection label="Size">
                  <FilterChipRow options={availableMonsterSizes.map(s => ({ id: s, label: s[0].toUpperCase() + s.slice(1) }))} value={monsterSize} onChange={setMonsterSize} scrollable />
                </FilterSection>
                <FilterSection label="Alignment">
                  <FilterChipRow options={availableMonsterAlignments.map(a => ({ id: a, label: a }))} value={monsterAlignment} onChange={setMonsterAlignment} scrollable />
                </FilterSection>
                <FilterSection label="Movement">
                  <MultiSelectChipRow options={MONSTER_MOVEMENT_TYPES.map(m => ({ id: m, label: m }))} values={monsterMovement} onChange={setMonsterMovement} />
                </FilterSection>
                {availableMonsterResistances.length > 0 && (
                  <FilterSection label="Resistances">
                    <MultiSelectChipRow options={availableMonsterResistances.map(r => ({ id: r, label: r }))} values={monsterResistance} onChange={setMonsterResistance} scrollable />
                  </FilterSection>
                )}
                {availableMonsterImmunities.length > 0 && (
                  <FilterSection label="Immunities">
                    <MultiSelectChipRow options={availableMonsterImmunities.map(i => ({ id: i, label: i }))} values={monsterImmunity} onChange={setMonsterImmunity} scrollable />
                  </FilterSection>
                )}
                {availableMonsterCondImmunities.length > 0 && (
                  <FilterSection label="Condition Immunities">
                    <MultiSelectChipRow options={availableMonsterCondImmunities.map(c => ({ id: c, label: c }))} values={monsterCondImmunity} onChange={setMonsterCondImmunity} scrollable />
                  </FilterSection>
                )}
                {availableMonsterLanguages.length > 0 && (
                  <FilterSection label="Languages">
                    <MultiSelectChipRow options={availableMonsterLanguages.map(l => ({ id: l, label: l }))} values={monsterLanguage} onChange={setMonsterLanguage} scrollable />
                  </FilterSection>
                )}
                <FilterSection label="Other">
                  <View style={styles.chipRow}>
                    <Pressable style={[styles.chip, monsterLegendary && styles.chipActive]} onPress={() => setMonsterLegendary(v => !v)}><Text style={[styles.chipTxt, monsterLegendary && styles.chipTxtActive]}>Legendary Actions</Text></Pressable>
                    <Pressable style={[styles.chip, monsterLair && styles.chipActive]} onPress={() => setMonsterLair(v => !v)}><Text style={[styles.chipTxt, monsterLair && styles.chipTxtActive]}>Lair Actions</Text></Pressable>
                    <Pressable style={[styles.chip, monsterDarkvision && styles.chipActive]} onPress={() => setMonsterDarkvision(v => !v)}><Text style={[styles.chipTxt, monsterDarkvision && styles.chipTxtActive]}>Darkvision</Text></Pressable>
                    <Pressable style={[styles.chip, monsterSpellcaster && styles.chipActive]} onPress={() => setMonsterSpellcaster(v => !v)}><Text style={[styles.chipTxt, monsterSpellcaster && styles.chipTxtActive]}>Spellcaster</Text></Pressable>
                  </View>
                </FilterSection>
              </>
            )}
          </View>
        )}
        <ActiveFilterChips chips={globalFilterChips} onClearAll={clearAllFilters} />
      </View>

      {results.length === 0 ? (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
          <ZeroResultsState
            hasActiveFilters={globalFilterChips.length > 0 || filtersOpen}
            emptyMessage={favoritesOnly ? 'No favorites yet — tap ☆ on a result to add one.' : 'No results match your search.'}
            onClearFilters={clearAllFilters}
          />
        </ScrollView>
      ) : (
        // PERF-COMPENDIUM-1 (item 1, 17): virtualized — a plain `.map()`
        // inside a ScrollView used to mount every row (all of "All Content"
        // concatenated, in the worst case) as a real native view immediately.
        // FlatList only renders what's near the viewport.
        <FlatList
          style={styles.scroll}
          contentContainerStyle={styles.content}
          data={results}
          keyExtractor={entry => `${entry.type}:${entry.id}`}
          initialNumToRender={20}
          windowSize={7}
          maxToRenderPerBatch={20}
          removeClippedSubviews
          renderItem={({ item: entry }) => {
            const isFavorite = favorites.has(favoriteKey(entry.type, entry.id));
            const expanded = expandedId === `${entry.type}:${entry.id}`;
            const visual = CONTENT_TYPE_VISUALS[entry.type];
            const featureNames: string[] = Array.isArray((entry.raw as { features?: { name: string }[] })?.features)
              ? (entry.raw as { features: { name: string }[] }).features.map(f => f.name)
              : (entry.type === 'feat' ? [(entry.raw as { feature?: { name: string } }).feature?.name].filter((n): n is string => !!n) : []);
            return (
              <Pressable
                style={[styles.row, { borderLeftColor: visual.accent }]}
                onPress={() => setExpandedId(expanded ? null : `${entry.type}:${entry.id}`)}
              >
                <View style={styles.rowHeader}>
                  <View style={styles.rowNameLine}>
                    <View style={[styles.typeBadge, { borderColor: visual.accent + '88', backgroundColor: visual.accent + '22' }]}>
                      <Text style={[styles.typeBadgeTxt, { color: visual.accent }]}>{visual.icon} {CONTENT_TYPE_LABELS[entry.type]}</Text>
                    </View>
                    <Text style={styles.rowName}>{entry.name}</Text>
                    {!entry.isHomebrew && isNonSrd(entry.srd) && <NonSrdBadge />}
                  </View>
                  <View style={styles.rowBadges}>
                    <View style={[styles.provBadge, entry.isHomebrew ? styles.provBadgeHomebrew : styles.provBadgeOfficial]}>
                      <Text style={styles.provBadgeTxt}>{entry.isHomebrew ? 'Homebrew' : 'Official'}</Text>
                    </View>
                    <Pressable hitSlop={8} onPress={e => { e.stopPropagation(); toggleFavorite(entry.type, entry.id); }}>
                      <Text style={styles.starTxt}>{isFavorite ? '⭐' : '☆'}</Text>
                    </Pressable>
                  </View>
                </View>
                <Text style={styles.rowSummary}>{summaryLine(entry)}</Text>
                {expanded && (
                  <View style={styles.rowDetail}>
                    {entry.type === 'feat' && (entry.raw as { prerequisite: string | null }).prerequisite && (
                      <Text style={styles.rowDesc}>Prerequisite: {(entry.raw as { prerequisite: string }).prerequisite}</Text>
                    )}
                    {entry.type === 'condition' && (
                      <Text style={styles.rowDesc}>{(entry.raw as { description: string }).description || 'No description.'}</Text>
                    )}
                    {featureNames.length > 0 && (
                      <View style={styles.featureList}>
                        {featureNames.map((n, i) => <Text key={i} style={styles.featureTxt}>• {n}</Text>)}
                      </View>
                    )}
                  </View>
                )}
              </Pressable>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bg },
  // The screen title and the Official/Homebrew/Packages switch now live in CompendiumScreen (the shell).
  header: {
    paddingTop: Spacing.xs, paddingBottom: Spacing.xs,
    paddingHorizontal: Spacing.md,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  subtitle: { fontSize: FontSize.xs, color: Colors.textDim, letterSpacing: 2 },
  shellHeader: {
    paddingTop: Spacing.xl + 8, paddingBottom: Spacing.xs,
    paddingHorizontal: Spacing.md,
  },
  shellTitle: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.gold },

  searchWrap: { padding: Spacing.md, paddingBottom: Spacing.sm, gap: Spacing.xs },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  searchInput: {
    backgroundColor: Colors.surface, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: Spacing.sm, paddingVertical: 8, color: Colors.textPrimary,
  },
  searchInputFlex: { flex: 1 },

  typeRow: { flexGrow: 0 },
  typeRowContent: { gap: Spacing.xs, paddingVertical: 2 },
  // PERF-SORT-1 (item 3): Filters (start) + Sort (end) share one row.
  controlsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: Spacing.xs },
  typeChip: {
    backgroundColor: Colors.surface, borderRadius: Radius.full,
    borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: Spacing.sm, paddingVertical: 5,
  },
  typeChipActive: { backgroundColor: Colors.blue + '22', borderColor: Colors.blue },
  typeChipTxt:    { fontSize: FontSize.xs, color: Colors.textSecondary, fontWeight: FontWeight.bold },
  typeChipTxtActive: { color: Colors.blue },

  filterPanel: { paddingTop: Spacing.xs, gap: 2 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs, paddingHorizontal: Spacing.lg, marginBottom: Spacing.sm },
  chip: {
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.sm, paddingVertical: 4, borderRadius: Radius.full,
    borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface,
  },
  chipActive: { backgroundColor: Colors.gold + '22', borderColor: Colors.gold },
  chipTxt:    { fontSize: FontSize.xs, color: Colors.textSecondary, fontWeight: FontWeight.bold },
  chipTxtActive: { color: Colors.gold },

  crRow: { flexDirection: 'row', gap: Spacing.xs, paddingHorizontal: Spacing.lg, marginBottom: Spacing.sm },
  crInput: {
    flex: 1, backgroundColor: Colors.surface, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: Spacing.sm, paddingVertical: 6, color: Colors.textPrimary, fontSize: FontSize.sm,
  },

  favToggle: {
    alignSelf: 'flex-start', borderRadius: Radius.full,
    borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: Spacing.sm, paddingVertical: 4,
  },
  favToggleActive: { borderColor: Colors.gold, backgroundColor: Colors.gold + '22' },
  favToggleTxt: { fontSize: FontSize.xs, color: Colors.textSecondary, fontWeight: FontWeight.bold },
  favToggleTxtActive: { color: Colors.gold },
  filterHint: { fontSize: FontSize.xs, color: Colors.textDim, fontStyle: 'italic' },

  scroll:  { flex: 1 },
  content: { paddingHorizontal: Spacing.md, paddingBottom: Spacing.xxl, gap: Spacing.xs },

  row: {
    backgroundColor: Colors.surface, borderRadius: Radius.md,
    borderWidth: 1, borderLeftWidth: 4, borderColor: Colors.border, padding: Spacing.sm,
  },
  rowHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rowNameLine: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, flex: 1, flexWrap: 'wrap' },
  rowName:   { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  rowSummary: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },
  rowBadges: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  typeBadge: {
    backgroundColor: Colors.blue + '22', borderRadius: Radius.sm,
    borderWidth: 1, borderColor: Colors.blue + '66', paddingHorizontal: 6, paddingVertical: 1,
  },
  typeBadgeTxt: { fontSize: 10, color: Colors.blue, fontWeight: FontWeight.bold },
  provBadge: { borderRadius: Radius.sm, borderWidth: 1, paddingHorizontal: 6, paddingVertical: 2 },
  provBadgeOfficial: { backgroundColor: Colors.surfaceHigh, borderColor: Colors.border },
  provBadgeHomebrew: { backgroundColor: Colors.gold + '22', borderColor: Colors.gold + '66' },
  provBadgeTxt: { fontSize: FontSize.xs, color: Colors.textSecondary, fontWeight: FontWeight.bold },
  starTxt: { fontSize: FontSize.lg },

  rowDetail: { marginTop: Spacing.xs, paddingTop: Spacing.xs, borderTopWidth: 1, borderTopColor: Colors.border, gap: 4 },
  rowDesc:   { fontSize: FontSize.sm, color: Colors.textSecondary },
  featureList: { gap: 2, marginTop: 2 },
  featureTxt:  { fontSize: FontSize.xs, color: Colors.textDim },
});

// ── Compendium shell ─────────────────────────────────────────────────────────
// Official / Homebrew / Packages, switched in place (no navigation). Only the
// active mode is mounted, so the other two never load their data. Per-mode
// search/filter/sort state lives in browseStateStore (Official: 'compendium';
// Homebrew/Packages: their own keys) and the selected mode in
// compendiumModeStore, so both survive leaving and returning to this tab.
// `?mode=` deep links (e.g. the old Homebrew-tab library/packages links,
// redirected from app/(tabs)/homebrew.tsx) select a mode on arrival.
export default function CompendiumScreen() {
  const params = useLocalSearchParams<{ mode?: string }>();
  const mode = useCompendiumModeStore(s => s.mode);
  const setMode = useCompendiumModeStore(s => s.setMode);
  const closePack = useCompendiumModeStore(s => s.closePack);

  const paramMode = parseCompendiumMode(params.mode);
  useEffect(() => {
    if (paramMode) setMode(paramMode);
  }, [paramMode, setMode]);

  const changeMode = useCallback((m: CompendiumMode) => {
    if (m !== 'packages') closePack();
    setMode(m);
  }, [setMode, closePack]);

  return (
    <View style={styles.screen}>
      <View style={styles.shellHeader}>
        <Text style={styles.shellTitle}>Compendium</Text>
      </View>
      <CompendiumModeSwitch mode={mode} onChange={changeMode} />
      {mode === 'official' && <OfficialCompendiumView />}
      {mode === 'homebrew' && <HomebrewLibraryView />}
      {mode === 'packages' && <InstalledPackagesView />}
    </View>
  );
}
