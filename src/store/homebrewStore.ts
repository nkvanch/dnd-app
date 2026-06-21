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
import { Race, CharClass, Spell, Feature, Background, Item, ContentDB } from '../engine/types';
import {
  saveHomebrewContent, loadAllHomebrew, deleteHomebrewContent,
  ContentCacheType, HomebrewContent,
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
  classes:     CharClass[];
  spells:      Spell[];
  backgrounds: Background[];
  features:    Feature[];
  items:       Item[];
  isLoading:   boolean;

  /** Load all homebrew from SQLite and merge built-in homebrew. */
  loadHomebrew: () => Promise<void>;

  /** Merge official + homebrew into a single ContentDB. */
  getMergedContentDB: () => ContentDB;

  /** Save a new or updated homebrew item. */
  saveItem: (type: ContentCacheType, item: HomebrewContent) => Promise<void>;

  /** Delete a homebrew item by type and id. */
  deleteItem: (type: ContentCacheType, id: string) => Promise<void>;
};

export const useHomebrewStore = create<HomebrewStore>((set, get) => ({
  races:       [],
  classes:     [],
  spells:      [],
  backgrounds: [],
  features:    [],
  items:       [],
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
        spells:      (all.spell      ?? []) as Spell[],
        backgrounds: (all.background ?? []) as Background[],
        features:    (all.feature    ?? []) as Feature[],
        items:       (all.item       ?? []) as Item[],
        isLoading:   false,
      });
    } catch (e) {
      console.error('[homebrewStore] loadHomebrew failed:', e);
      set({ isLoading: false });
    }
  },

  getMergedContentDB: (): ContentDB => {
    const { races, classes, spells, backgrounds, features, items } = get();
    return {
      races:       [...globalContentDB.races,       ...races],
      classes:     [...globalContentDB.classes,     ...classes],
      spells:      [...globalContentDB.spells,      ...spells],
      backgrounds: [...globalContentDB.backgrounds, ...backgrounds],
      conditions:  globalContentDB.conditions,
      items:       [...globalContentDB.items,       ...items],
      features:    [...globalContentDB.features,    ...features],
      feats:       globalContentDB.feats,
    };
  },

  saveItem: async (type, item) => {
    await saveHomebrewContent(type, item);
    set(state => {
      switch (type) {
        case 'race':       return { races:       [...state.races.filter(r => r.id !== (item as Race).id),             item as Race] };
        case 'class':      return { classes:     [...state.classes.filter(c => c.id !== (item as CharClass).id),     item as CharClass] };
        case 'spell':      return { spells:      [...state.spells.filter(s => s.id !== (item as Spell).id),          item as Spell] };
        case 'background': return { backgrounds: [...state.backgrounds.filter(b => b.id !== (item as Background).id), item as Background] };
        case 'feature':    return { features:    [...state.features.filter(f => f.id !== (item as Feature).id),      item as Feature] };
        case 'item':       return { items:       [...state.items.filter(it => it.id !== (item as Item).id),         item as Item] };
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
        case 'class':      return { classes:     state.classes.filter(c => c.id !== id) };
        case 'spell':      return { spells:      state.spells.filter(s => s.id !== id) };
        case 'background': return { backgrounds: state.backgrounds.filter(b => b.id !== id) };
        case 'feature':    return { features:    state.features.filter(f => f.id !== id) };
        case 'item':       return { items:       state.items.filter(it => it.id !== id) };
        default:           return state;
      }
    });
  },
}));
