// ============================================================================
// FILE: src/store/homebrewStore.ts
// Homebrew content store — extends globalContentDB at runtime with
// user-created races, classes, spells, backgrounds, and features.
// ============================================================================
import { create } from 'zustand';
import { Race, CharClass, Spell, Feature, Background, ContentDB } from '../engine/types';
import {
  saveHomebrewContent, loadAllHomebrew, deleteHomebrewContent,
  ContentCacheType, HomebrewContent,
} from '../db/contentCacheRepo';
import { globalContentDB } from '../content/classes/library';

type HomebrewStore = {
  races:       Race[];
  classes:     CharClass[];
  spells:      Spell[];
  backgrounds: Background[];
  features:    Feature[];
  isLoading:   boolean;

  /** Load all homebrew from SQLite. Called after initDb(). */
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
  isLoading:   false,

  loadHomebrew: async () => {
    set({ isLoading: true });
    try {
      const all = await loadAllHomebrew();
      set({
        races:       (all.race        ?? []) as Race[],
        classes:     (all.class       ?? []) as CharClass[],
        spells:      (all.spell       ?? []) as Spell[],
        backgrounds: (all.background  ?? []) as Background[],
        features:    (all.feature     ?? []) as Feature[],
        isLoading:   false,
      });
    } catch (e) {
      console.error('[homebrewStore] loadHomebrew failed:', e);
      set({ isLoading: false });
    }
  },

  getMergedContentDB: (): ContentDB => {
    const { races, classes, spells, backgrounds, features } = get();
    return {
      races:       [...globalContentDB.races,       ...races],
      classes:     [...globalContentDB.classes,     ...classes],
      spells:      [...globalContentDB.spells,      ...spells],
      backgrounds: [...globalContentDB.backgrounds, ...backgrounds],
      conditions:  globalContentDB.conditions,
      items:       globalContentDB.items,
      features:    [...globalContentDB.features,    ...features],
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
        default:           return state;
      }
    });
  },

  deleteItem: async (type, id) => {
    await deleteHomebrewContent(type, id);
    set(state => {
      switch (type) {
        case 'race':       return { races:       state.races.filter(r => r.id !== id) };
        case 'class':      return { classes:     state.classes.filter(c => c.id !== id) };
        case 'spell':      return { spells:      state.spells.filter(s => s.id !== id) };
        case 'background': return { backgrounds: state.backgrounds.filter(b => b.id !== id) };
        case 'feature':    return { features:    state.features.filter(f => f.id !== id) };
        default:           return state;
      }
    });
  },
}));
