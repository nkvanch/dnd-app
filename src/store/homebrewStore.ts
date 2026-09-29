// ============================================================================
// FILE: src/store/homebrewStore.ts
// Homebrew content store — extends globalContentDB at runtime with
// user-created races, classes, spells, backgrounds, and features.
//
// Built-in homebrew (Abyss Knight, Skeleton) is injected directly into the
// store at load time from BUILTIN_HOMEBREW — no SQLite seeding step needed.
// If a user deletes a built-in, its id is stored in app_meta so it stays gone
// across launches. If a user edits a built-in, the edited version is upserted
// to SQLite; on next load the SQLite copy takes precedence over the built-in.
// ============================================================================
import { create } from 'zustand';
import {
  Race, Subrace, CharClass, HomebrewSubclass, Spell, Feature, Background, Item, Feat, Condition, ContentDB,
  RulesetId, matchesRuleset,
} from '../engine/types';
import { MonsterTemplate } from '../content/monsters/types';
import {
  saveHomebrewContent, saveHomebrewContentBatch, loadAllHomebrew, deleteHomebrewContent,
  loadContentHistory, restoreContentVersion,
  ContentCacheType, HomebrewContent, ContentVersionEntry,
} from '../db/contentCacheRepo';
import { getMeta, setMeta } from '../db/appMetaRepo';
import { BUILTIN_HOMEBREW } from '../content/builtinHomebrew';
import { globalContentDB } from '../content/classes/library';

// ids of built-in items for fast lookup
const BUILTIN_IDS = new Set<string>([
  ...BUILTIN_HOMEBREW.classes.map(c => c.id),
  ...BUILTIN_HOMEBREW.races.map(r => r.id),
]);

/** Persist the set of deleted built-in ids to app_meta. */
async function persistDeletedBuiltins(ids: Set<string>): Promise<void> {
  await setMeta('deleted_builtin_ids', JSON.stringify([...ids]));
}

/** Load the set of deleted built-in ids from app_meta. */
async function loadDeletedBuiltins(): Promise<Set<string>> {
  try {
    const raw = await getMeta('deleted_builtin_ids');
    return new Set<string>(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set<string>();
  }
}

/**
 * Official + homebrew, deduped by id with homebrew winning — the same
 * precedence `contentResolution.ts`'s mergeSpellIndex/mergeItemIndex
 * already established and tested for spells/items. Bug fix: races,
 * classes, backgrounds, conditions, and feats never got the equivalent
 * fix in getMergedContentDB below — official content was plain-
 * concatenated FIRST, so a user's homebrew edit to an official-id race/
 * class/etc. was invisible everywhere (every real lookup is `.find()`,
 * which returns the first match). Every content type below now goes
 * through this so none of them can silently regress the same way again.
 */
export function homebrewWinsById<T extends { id: string }>(official: T[], homebrew: T[]): T[] {
  const homebrewIds = new Set(homebrew.map(x => x.id));
  return [...official.filter(x => !homebrewIds.has(x.id)), ...homebrew];
}

type HomebrewStore = {
  races:       Race[];
  subraces:    Subrace[];
  classes:     CharClass[];
  subclasses:  HomebrewSubclass[];
  spells:      Spell[];
  backgrounds: Background[];
  features:    Feature[];
  items:       Item[];
  feats:       Feat[];
  monsters:    MonsterTemplate[];
  conditions:  Condition[];
  isLoading:   boolean;

  /** Load all homebrew from SQLite and merge built-in homebrew. */
  loadHomebrew: () => Promise<void>;

  /** Merge official + homebrew into a single ContentDB. */
  getMergedContentDB: (activeRuleset?: RulesetId, bannedIds?: Set<string>) => ContentDB;

  /** Save a new or updated homebrew item. */
  saveItem: (type: ContentCacheType, item: HomebrewContent) => Promise<void>;

  /** HOMEBREW-PACKAGE-1 item 14: save several items as ONE atomic SQLite
   *  transaction (all-or-nothing) plus ONE in-memory state update (all
   *  items become visible in a single render, not one per item) — used by
   *  the package-import commit handler instead of looping saveItem(). */
  saveItems: (items: { type: ContentCacheType; item: HomebrewContent }[]) => Promise<void>;

  /** Delete a homebrew item by type and id. */
  deleteItem: (type: ContentCacheType, id: string) => Promise<void>;

  /** Fetch version history for one item (on-demand, not cached in the store). */
  loadVersionHistory: (type: ContentCacheType, id: string) => Promise<ContentVersionEntry[]>;

  /** Restore an old version as current, then refresh the in-memory copy. */
  restoreVersion: (type: ContentCacheType, id: string, version: string) => Promise<void>;
};

// CONTENT-REGISTRY-PERF-1: getMergedContentDB() previously re-ran the full
// official+homebrew merge (homebrewWinsById × 6 content types, standalone-
// subrace attachment, ruleset filtering) from scratch on EVERY call, with
// zero caching — confirmed via audit that many render-body callers across
// the app (race-detail.tsx, class-detail.tsx, TabCharacter.tsx,
// dm/encounter.tsx's QuickPanel, several homebrew builders) call this
// unmemoized, so a single re-render could redo this merge several times.
// Reference-equality cache keyed on the full argument tuple: since the
// store's own content arrays only get NEW references on an actual load/
// save/delete (never mutated in place — confirmed via loadHomebrew's
// `set({...})` calls and saveItem/deleteItem below), comparing by `===`
// against a previous call's inputs is a safe, correct way to skip redoing
// the merge when nothing has actually changed. `bannedIds` callers that
// construct a fresh Set every render (see race-detail.tsx) simply won't
// benefit from this cache themselves — the majority of call sites (which
// pass no bannedIds) still do, with no correctness change either way.
//
// Combat/Spells crash closure: this was a SINGLE-entry cache until this
// batch — reproduced live (web preview) as a genuine "Maximum update depth
// exceeded" on both the Combat and Spells tabs. Root cause: within one
// render tree, one component reads this through a Zustand selector that
// CALLS it with one argument shape (e.g. `s => s.getMergedContentDB(entity.
// rulesetId)` — TabCharacter.tsx's useCardContent, TabSpells.tsx's own
// call), while a sibling/child in the SAME tree (LevelUpSection inside
// TabCharacter.tsx, AddSpellModal under TabSpells.tsx) calls it directly in
// its own render body with a DIFFERENT shape (`getMergedContentDB()`, no
// args). A single-entry cache means the second call evicts the first
// call's entry; when Zustand's useSyncExternalStore machinery re-invokes
// the ORIGINAL selector right after commit to verify the snapshot hasn't
// changed, it gets a cache miss, recomputes, and returns a new object
// reference — which reads as "snapshot changed since render" and forces
// another re-render, repeating forever. Actions/Abilities/Features/Items
// never crashed because nothing in their own tree calls this with a second,
// different argument shape. Widening to a small multi-entry cache (find-by-
// key instead of a single slot) fixes this at the actual fault line — the
// cache's own fragility — rather than chasing down and re-auditing every
// current and future call site across the app for argument consistency.
type MergedContentDBCacheKey = readonly [
  unknown[], unknown[], unknown[], unknown[], unknown[], unknown[], unknown[], unknown[], unknown[],
  RulesetId | undefined, Set<string> | undefined,
];
// Small LRU, not unbounded — a handful of distinct argument shapes are
// legitimately in real use across the app at once (bare, ruleset-scoped,
// banned-ids-scoped); capping keeps this from growing without bound if a
// caller ever passes a fresh bannedIds Set every render (which never hits
// the cache anyway — see the doc comment above).
const MERGED_CONTENT_DB_CACHE_MAX = 6;
let mergedContentDBCacheEntries: { key: MergedContentDBCacheKey; value: ContentDB }[] = [];

/** The per-type upsert-into-array patch for ONE item — factored out of
 *  saveItem so saveItems (item 14's atomic batch import) can fold N items
 *  into a single combined state patch instead of one set() call per item. */
function applyOneItem(state: HomebrewStore, type: ContentCacheType, item: HomebrewContent): Partial<HomebrewStore> {
  switch (type) {
    case 'race':       return { races:       [...state.races.filter(r => r.id !== (item as Race).id),             item as Race] };
    case 'subrace':    return { subraces:    [...state.subraces.filter(sr => sr.id !== (item as Subrace).id),      item as Subrace] };
    case 'class':      return { classes:     [...state.classes.filter(c => c.id !== (item as CharClass).id),     item as CharClass] };
    case 'subclass':   return { subclasses:  [...state.subclasses.filter(sc => sc.id !== (item as HomebrewSubclass).id), item as HomebrewSubclass] };
    case 'spell':      return { spells:      [...state.spells.filter(s => s.id !== (item as Spell).id),          item as Spell] };
    case 'background': return { backgrounds: [...state.backgrounds.filter(b => b.id !== (item as Background).id), item as Background] };
    case 'feature':    return { features:    [...state.features.filter(f => f.id !== (item as Feature).id),      item as Feature] };
    case 'item':       return { items:       [...state.items.filter(it => it.id !== (item as Item).id),         item as Item] };
    case 'feat':       return { feats:       [...state.feats.filter(f => f.id !== (item as Feat).id),           item as Feat] };
    case 'monster':    return { monsters:    [...state.monsters.filter(m => m.id !== (item as MonsterTemplate).id), item as MonsterTemplate] };
    case 'condition':  return { conditions:  [...state.conditions.filter(c => c.id !== (item as Condition).id), item as Condition] };
    default:           return state;
  }
}

export const useHomebrewStore = create<HomebrewStore>((set, get) => ({
  races:       [],
  subraces:    [],
  classes:     [],
  subclasses:  [],
  spells:      [],
  backgrounds: [],
  features:    [],
  items:       [],
  feats:       [],
  monsters:    [],
  conditions:  [],
  isLoading:   false,

  loadHomebrew: async () => {
    set({ isLoading: true });
    try {
      const [all, deletedIds] = await Promise.all([
        loadAllHomebrew(),
        loadDeletedBuiltins(),
      ]);

      const sqliteClasses     = (all.class      ?? []) as CharClass[];
      const sqliteRaces        = (all.race       ?? []) as Race[];
      const sqliteClassIds    = new Set(sqliteClasses.map(c => c.id));
      const sqliteRaceIds     = new Set(sqliteRaces.map(r => r.id));

      // Inject built-in homebrew that hasn't been deleted and hasn't been
      // overridden by a user-edited SQLite copy (SQLite copy takes precedence).
      const builtinClasses = BUILTIN_HOMEBREW.classes.filter(
        c => !deletedIds.has(c.id) && !sqliteClassIds.has(c.id)
      );
      const builtinRaces = BUILTIN_HOMEBREW.races.filter(
        r => !deletedIds.has(r.id) && !sqliteRaceIds.has(r.id)
      );

      set({
        // Built-ins first so SQLite copies (edits) appear after and
        // dedup logic in pickers uses the last occurrence — but since
        // SQLite copies filtered out by id above, order doesn't matter.
        classes:     [...builtinClasses, ...sqliteClasses],
        races:       [...builtinRaces,   ...sqliteRaces],
        subraces:    (all.subrace    ?? []) as Subrace[],
        subclasses:  (all.subclass   ?? []) as HomebrewSubclass[],
        spells:      (all.spell      ?? []) as Spell[],
        backgrounds: (all.background ?? []) as Background[],
        features:    (all.feature    ?? []) as Feature[],
        items:       (all.item       ?? []) as Item[],
        feats:       (all.feat       ?? []) as Feat[],
        monsters:    (all.monster    ?? []) as MonsterTemplate[],
        conditions:  (all.condition  ?? []) as Condition[],
        isLoading:   false,
      });
    } catch (e) {
      console.error('[homebrewStore] loadHomebrew failed:', e);
      set({ isLoading: false });
    }
  },

  getMergedContentDB: (activeRuleset?: RulesetId, bannedIds?: Set<string>): ContentDB => {
    const { races, subraces, classes, spells, backgrounds, features, items, feats, conditions } = get();
    const cacheKey: MergedContentDBCacheKey = [
      races, subraces, classes, spells, backgrounds, features, items, feats, conditions,
      activeRuleset, bannedIds,
    ];
    const hit = mergedContentDBCacheEntries.find(entry => cacheKey.every((v, i) => v === entry.key[i]));
    if (hit) return hit.value;
    // Item 15 (campaign content manifest) — banned homebrew packs' content
    // ids, pre-computed by the caller (packDiagnostics.ts's
    // bannedContentIds()) from the active campaign's Campaign.bannedPackIds.
    // Every call site today omits this (undefined), so notBanned is a
    // guaranteed identity no-op until a caller actually passes a campaign's
    // ban set — same "opt-in filter, zero behavior change until wired"
    // shape activeRuleset already established above.
    const notBanned = <T extends { id: string }>(arr: T[]): T[] =>
      bannedIds ? arr.filter(x => !bannedIds.has(x.id)) : arr;
    const allRaces = homebrewWinsById(globalContentDB.races, races);
    // Attach standalone subraces (parentId may point at an official OR a
    // homebrew race) onto their parent at read time, rather than requiring
    // a subrace to be nested inside a race the user owns/authored — see
    // Subrace.parentId's doc comment. A race's own natively-nested subraces
    // (authored inline while building that race from scratch) win on id
    // collision since they're the race's own authored data.
    const racesWithStandaloneSubraces = allRaces.map(race => {
      const attached = subraces.filter(sr => sr.parentId === race.id);
      if (attached.length === 0) return race;
      const existingIds = new Set((race.subraces ?? []).map(s => s.id));
      return {
        ...race,
        subraces: [...(race.subraces ?? []), ...attached.filter(s => !existingIds.has(s.id))],
      };
    });
    // activeRuleset undefined (every call site today) means no filter is
    // active — matchesRuleset(_, undefined) is always true, so this is a
    // guaranteed no-op until Phase 6 actually passes a real ruleset here.
    // Deliberately NOT applied to .spells/.items — those are repo-backed
    // (spellRepo/itemRepo), not sourced from globalContentDB, and get their
    // own ruleset filtering whenever Phase 6 needs it.
    const result: ContentDB = {
      races:       notBanned(racesWithStandaloneSubraces.filter(r => matchesRuleset(r.rulesetId, activeRuleset))),
      classes:     notBanned(homebrewWinsById(globalContentDB.classes, classes).filter(c => matchesRuleset(c.rulesetId, activeRuleset))),
      // Official spell content moved out of globalContentDB and into
      // spellRepo (SQLite-backed on native, still eager on web) — see
      // src/content/spellRepo.ts. Nothing currently reads ContentDB.spells
      // off this merged object (only .races/.classes are consumed), so this
      // intentionally carries homebrew spells only from here on; browse UIs
      // that need the full official+homebrew spell list use
      // spellRepo.getIndex() directly instead.
      spells:      notBanned(spells),
      backgrounds: notBanned(homebrewWinsById(globalContentDB.backgrounds, backgrounds).filter(b => matchesRuleset(b.rulesetId, activeRuleset))),
      // Now includes homebrew conditions too (A-35) — previously official-only,
      // the one content type with zero homebrew authoring support at all.
      conditions:  notBanned(homebrewWinsById(globalContentDB.conditions, conditions).filter(c => matchesRuleset(c.rulesetId, activeRuleset))),
      // Same rationale as .spells above — official item content lives in
      // itemRepo now, not globalContentDB.
      items:       notBanned(items),
      features:    notBanned(homebrewWinsById(globalContentDB.features, features)),
      feats:       notBanned(homebrewWinsById(globalContentDB.feats ?? [], feats).filter(f => matchesRuleset(f.rulesetId, activeRuleset))),
    };
    // Most-recently-used first; evict the oldest entry once over the cap.
    mergedContentDBCacheEntries = [{ key: cacheKey, value: result }, ...mergedContentDBCacheEntries]
      .slice(0, MERGED_CONTENT_DB_CACHE_MAX);
    return result;
  },

  saveItem: async (type, item) => {
    await saveHomebrewContent(type, item);
    set(state => applyOneItem(state, type, item));
  },

  saveItems: async (items) => {
    if (items.length === 0) return;
    await saveHomebrewContentBatch(items.map(({ type, item }) => ({ type, content: item })));
    // One combined patch, one render — not items.length separate set() calls
    // (item 26: "refresh registry once" for a batch import).
    set(state => items.reduce((acc, { type, item }) => ({ ...acc, ...applyOneItem(acc, type, item) }), state));
  },

  deleteItem: async (type, id) => {
    if (BUILTIN_IDS.has(id)) {
      // Built-in: record deletion in app_meta so it stays gone across launches
      const deletedIds = await loadDeletedBuiltins();
      deletedIds.add(id);
      await persistDeletedBuiltins(deletedIds);
    } else {
      // User-created: remove from SQLite
      await deleteHomebrewContent(type, id);
    }
    // Remove from in-memory store regardless
    set(state => {
      switch (type) {
        case 'race':       return { races:       state.races.filter(r => r.id !== id) };
        case 'subrace':    return { subraces:    state.subraces.filter(sr => sr.id !== id) };
        case 'class':      return { classes:     state.classes.filter(c => c.id !== id) };
        case 'subclass':   return { subclasses:  state.subclasses.filter(sc => sc.id !== id) };
        case 'spell':      return { spells:      state.spells.filter(s => s.id !== id) };
        case 'background': return { backgrounds: state.backgrounds.filter(b => b.id !== id) };
        case 'feature':    return { features:    state.features.filter(f => f.id !== id) };
        case 'item':       return { items:       state.items.filter(it => it.id !== id) };
        case 'feat':       return { feats:       state.feats.filter(f => f.id !== id) };
        case 'monster':    return { monsters:    state.monsters.filter(m => m.id !== id) };
        case 'condition':  return { conditions:  state.conditions.filter(c => c.id !== id) };
        default:           return state;
      }
    });
  },

  loadVersionHistory: async (type, id) => {
    return loadContentHistory(type, id);
  },

  restoreVersion: async (type, id, version) => {
    const restored = await restoreContentVersion(type, id, version);
    // Same per-type upsert-into-array shape as saveItem — patched directly
    // rather than calling saveItem again, which would call
    // saveHomebrewContent a second time and double-increment the version.
    set(state => {
      switch (type) {
        case 'race':       return { races:       [...state.races.filter(r => r.id !== id),             restored as Race] };
        case 'subrace':    return { subraces:    [...state.subraces.filter(sr => sr.id !== id),         restored as Subrace] };
        case 'class':      return { classes:     [...state.classes.filter(c => c.id !== id),            restored as CharClass] };
        case 'subclass':   return { subclasses:  [...state.subclasses.filter(sc => sc.id !== id),       restored as HomebrewSubclass] };
        case 'spell':      return { spells:      [...state.spells.filter(s => s.id !== id),             restored as Spell] };
        case 'background': return { backgrounds: [...state.backgrounds.filter(b => b.id !== id),        restored as Background] };
        case 'feature':    return { features:    [...state.features.filter(f => f.id !== id),           restored as Feature] };
        case 'item':       return { items:       [...state.items.filter(it => it.id !== id),            restored as Item] };
        case 'feat':       return { feats:       [...state.feats.filter(f => f.id !== id),              restored as Feat] };
        case 'monster':    return { monsters:    [...state.monsters.filter(m => m.id !== id),           restored as MonsterTemplate] };
        case 'condition':  return { conditions:  [...state.conditions.filter(c => c.id !== id),         restored as Condition] };
        default:           return state;
      }
    });
  },
}));
