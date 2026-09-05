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
  Race, Subrace, CharClass, HomebrewSubclass, Spell, Feature, Background, Item, Feat, ContentDB,
  RulesetId, matchesRuleset,
} from '../engine/types';
import { MonsterTemplate } from '../content/monsters/types';
import {
  saveHomebrewContent, loadAllHomebrew, deleteHomebrewContent,
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
  isLoading:   boolean;

  /** Load all homebrew from SQLite and merge built-in homebrew. */
  loadHomebrew: () => Promise<void>;

  /** Merge official + homebrew into a single ContentDB. */
  getMergedContentDB: (activeRuleset?: RulesetId) => ContentDB;

  /** Save a new or updated homebrew item. */
  saveItem: (type: ContentCacheType, item: HomebrewContent) => Promise<void>;

  /** Delete a homebrew item by type and id. */
  deleteItem: (type: ContentCacheType, id: string) => Promise<void>;

  /** Fetch version history for one item (on-demand, not cached in the store). */
  loadVersionHistory: (type: ContentCacheType, id: string) => Promise<ContentVersionEntry[]>;

  /** Restore an old version as current, then refresh the in-memory copy. */
  restoreVersion: (type: ContentCacheType, id: string, version: string) => Promise<void>;
};

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
        isLoading:   false,
      });
    } catch (e) {
      console.error('[homebrewStore] loadHomebrew failed:', e);
      set({ isLoading: false });
    }
  },

  getMergedContentDB: (activeRuleset?: RulesetId): ContentDB => {
    const { races, subraces, classes, spells, backgrounds, features, items, feats } = get();
    const allRaces = [...globalContentDB.races, ...races];
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
    return {
      races:       racesWithStandaloneSubraces.filter(r => matchesRuleset(r.rulesetId, activeRuleset)),
      classes:     [...globalContentDB.classes,     ...classes].filter(c => matchesRuleset(c.rulesetId, activeRuleset)),
      // Official spell content moved out of globalContentDB and into
      // spellRepo (SQLite-backed on native, still eager on web) — see
      // src/content/spellRepo.ts. Nothing currently reads ContentDB.spells
      // off this merged object (only .races/.classes are consumed), so this
      // intentionally carries homebrew spells only from here on; browse UIs
      // that need the full official+homebrew spell list use
      // spellRepo.getIndex() directly instead.
      spells:      spells,
      backgrounds: [...globalContentDB.backgrounds, ...backgrounds].filter(b => matchesRuleset(b.rulesetId, activeRuleset)),
      conditions:  globalContentDB.conditions.filter(c => matchesRuleset(c.rulesetId, activeRuleset)),
      // Same rationale as .spells above — official item content lives in
      // itemRepo now, not globalContentDB.
      items:       items,
      features:    [...globalContentDB.features,    ...features],
      feats:       [...(globalContentDB.feats ?? []), ...feats].filter(f => matchesRuleset(f.rulesetId, activeRuleset)),
    };
  },

  saveItem: async (type, item) => {
    await saveHomebrewContent(type, item);
    set(state => {
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
        default:           return state;
      }
    });
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
        default:           return state;
      }
    });
  },
}));
