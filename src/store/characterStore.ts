// ============================================================================
// FILE: src/store/characterStore.ts
// Character State Management (Zustand) — SQLite-backed.
//
// Design: Zustand state is always the in-memory source of truth for the UI.
// Every mutation updates Zustand synchronously (instant UI response), then
// fires an async SQLite write as a side-effect. No loading states needed for
// individual mutations — the write is near-instantaneous on device.
//
// On startup: call loadCharacters() after initDb() to hydrate from SQLite.
// ============================================================================
import { create } from 'zustand';
import { Entity, CampaignRules, SkillName, SkillEntry, AbilityScores, ItemInstance } from '../engine/types';
import {
  saveEntity, loadAllEntities, deleteEntity, loadAllEntityMeta, EntityMeta,
} from '../db/entityRepo';
import { syncManager } from '../sync/syncManager';
import { ALL_ITEMS } from '../content/items/index';

export type { EntityMeta };

// ── Item feature hydration ────────────────────────────────────────────────────

/**
 * Hydrates features on all equipped and carried ItemInstances from the content
 * definitions. ItemInstances are serialised with features:[] (only itemId is
 * stored) so on load we must re-attach the definition's features. Without this,
 * equipping armor has no AC effect after an app restart.
 */
function hydrateItemFeatures(entity: Entity): Entity {
  function hydrateInstance(inst: ItemInstance): ItemInstance {
    if (inst.features.length > 0) return inst;   // already hydrated (e.g. from equip path)
    const def = ALL_ITEMS.find(i => i.id === inst.itemId);
    return def ? { ...inst, features: def.features } : inst;
  }
  const equippedHydrated = entity.inventory.equipped.map(hydrateInstance);
  const carriedHydrated  = entity.inventory.carried.map(hydrateInstance);
  if (
    equippedHydrated.every((h, i) => h === entity.inventory.equipped[i]) &&
    carriedHydrated.every( (h, i) => h === entity.inventory.carried[i])
  ) return entity;   // nothing changed — avoid unnecessary object creation
  return {
    ...entity,
    inventory: { ...entity.inventory, equipped: equippedHydrated, carried: carriedHydrated },
  };
}

// ── Default campaign rules ────────────────────────────────────────────────────

export const DEFAULT_RULES: CampaignRules = {
  maxAbilityScore: 20,
  maxLevel:        20,
  useXP:           false,
  hpMode:          'fixed',
  allowMulticlass: false,
  customRules:     {},
};

// ── Default skill block ───────────────────────────────────────────────────────

const ALL_SKILLS: { name: SkillName; ability: 'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha' }[] = [
  { name: 'athletics',        ability: 'str' },
  { name: 'acrobatics',       ability: 'dex' },
  { name: 'sleight_of_hand',  ability: 'dex' },
  { name: 'stealth',          ability: 'dex' },
  { name: 'arcana',           ability: 'int' },
  { name: 'history',          ability: 'int' },
  { name: 'investigation',    ability: 'int' },
  { name: 'nature',           ability: 'int' },
  { name: 'religion',         ability: 'int' },
  { name: 'animal_handling',  ability: 'wis' },
  { name: 'insight',          ability: 'wis' },
  { name: 'medicine',         ability: 'wis' },
  { name: 'perception',       ability: 'wis' },
  { name: 'survival',         ability: 'wis' },
  { name: 'deception',        ability: 'cha' },
  { name: 'intimidation',     ability: 'cha' },
  { name: 'performance',      ability: 'cha' },
  { name: 'persuasion',       ability: 'cha' },
];

function makeDefaultSkills(): Record<SkillName, SkillEntry> {
  const skills = {} as Record<SkillName, SkillEntry>;
  for (const s of ALL_SKILLS) {
    skills[s.name] = { ability: s.ability, trained: false, expertise: false, bonus: null };
  }
  return skills;
}

// ── Empty entity factory ──────────────────────────────────────────────────────

/** Returns a fully-typed empty entity ready to receive leveling and creation steps. */
export function makeEmptyEntity(id: string, kind: Entity['kind'] = 'character'): Entity {
  const defaultStats: AbilityScores = { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 };

  const defaultDerived = {
    proficiencyBonus:  2,
    ac:                10,
    initiative:        0,
    speed:             30,
    passivePerception:    10,
    passiveInvestigation: 10,
    passiveInsight:       10,
    senses:            [],
    movement:          {},
    savingThrows:      { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 },
    attackBonuses:     [],
    spellSaveDC:       null,
    spellAttackBonus:  null,
  };

  return {
    id,
    kind,
    identity: {
      name:         '',
      level:        0,
      raceId:       '',
      subRaceId:    null,
      classId:      '',
      subclassId:   null,
      backgroundId: '',
      alignment:    null,
      xp:           0,
    },
    stats:   defaultStats,
    derived: defaultDerived,
    skills:  { skills: makeDefaultSkills() },
    proficiencies: {
      armor:        [],
      weapons:      [],
      tools:        [],
      languages:    [],
      savingThrows: [],
    },
    resources: {
      hp:      { current: 0, maximum: 0, temp: 0 },
      hitDice: { die: 8, total: 0, remaining: 0 },
      speed:   30,
      ac:      0,
      custom:  [],
      deathSaves: { successes: 0, failures: 0, stable: false },
    },
    spellcasting: null,
    inventory: {
      equipped: [],
      carried:  [],
      currency: { pp: 0, gp: 0, ep: 0, sp: 0, cp: 0 },
    },
    conditions:       [],
    conditionMonitor: { active: [], exhaustion: 0, flags: {} },
    features:         [],
    choices:          [],
    dmOverrides:      [],
    wildShapeState:   null,
    notes:            '',
  };
}

// ── Store ─────────────────────────────────────────────────────────────────────

type CharacterStore = {
  /** All saved characters (hydrated from SQLite on startup). */
  characters:  Entity[];
  /** Character being built in the creation wizard. */
  draft:       Entity | null;
  /** Active campaign rules applied to all engine calls. */
  rules:       CampaignRules;
  /** True while loadCharacters() is running on startup. */
  isLoading:   boolean;
  /** Lightweight metadata for the character list screen. */
  characterMeta: EntityMeta[];

  // ── Startup ──────────────────────────────────────────────────────────────

  /**
   * Hydrate only lightweight entity metadata for the character list screen.
   * Full entity JSON is loaded on demand via loadCharacters() or loadEntity().
   * Call this first on startup for instant list display.
   */
  loadCharactersMeta: () => Promise<void>;

  /**
   * Hydrate the characters array from SQLite.
   * Called once in app/_layout.tsx after initDb() completes.
   */
  loadCharacters: () => Promise<void>;

  // ── Draft management ─────────────────────────────────────────────────────

  setDraft:   (entity: Entity)  => void;
  clearDraft: ()                => void;
  /**
   * Saves the draft to the characters list, persists to SQLite, clears the draft.
   */
  saveDraft:  () => Promise<void>;

  // ── Character management ─────────────────────────────────────────────────

  /**
   * Replace an existing character using a pure updater function.
   * Zustand state updates synchronously; SQLite write fires async.
   */
  updateCharacter: (id: string, updater: (e: Entity) => Entity) => void;
  deleteCharacter: (id: string) => void;

  /**
   * Apply an entity snapshot received from a sync peer.
   * Merges into the local list and persists to SQLite.
   * No sync broadcast — we are the receiver, not the sender.
   */
  applyIncomingEntity: (entity: Entity) => void;

  // ── Rules ────────────────────────────────────────────────────────────────

  setRules: (rules: Partial<CampaignRules>) => void;
};

export const useCharacterStore = create<CharacterStore>((set, get) => ({
  characters:    [],
  characterMeta: [],
  draft:         null,
  rules:         DEFAULT_RULES,
  isLoading:     false,

  // ── Startup ───────────────────────────────────────────────────────────────

  loadCharactersMeta: async () => {
    set({ isLoading: true });
    try {
      const meta = await loadAllEntityMeta();
      set({ characterMeta: meta.filter(m => m.kind === 'character'), isLoading: false });
    } catch (e) {
      console.error('[characterStore] loadCharactersMeta failed:', e);
      set({ isLoading: false });
    }
  },

  loadCharacters: async () => {
    set({ isLoading: true });
    try {
      const entities = await loadAllEntities();
      // Hydrate item features on load — ItemInstances are stored with features:[]
      // so we re-attach definition features before the engine sees them.
      const characters = entities
        .filter(e => e.kind === 'character')
        .map(hydrateItemFeatures);
      set({ characters, isLoading: false });
    } catch (e) {
      console.error('[characterStore] loadCharacters failed:', e);
      set({ isLoading: false });
    }
  },

  // ── Draft management ──────────────────────────────────────────────────────

  setDraft:   (entity) => set({ draft: entity }),
  clearDraft: ()       => set({ draft: null }),

  saveDraft: async () => {
    const { draft, characters } = get();
    if (!draft) return;

    const exists = characters.some(c => c.id === draft.id);
    const updated = exists
      ? characters.map(c => c.id === draft.id ? draft : c)
      : [...characters, draft];

    // Synchronous Zustand update — UI reflects immediately
    set({ characters: updated, draft: null });

    // Async SQLite persist — fire and forget (errors logged, not thrown)
    saveEntity(draft).catch(e =>
      console.error('[characterStore] saveDraft → saveEntity failed:', e)
    );
  },

  // ── Character management ───────────────────────────────────────────────────

  updateCharacter: (id, updater) => {
    let updated: Entity | null = null;

    set(state => {
      const next = state.characters.map(c => {
        if (c.id !== id) return c;
        updated = updater(c);
        return updated;
      });
      return { characters: next };
    });

    if (updated) {
      // Async SQLite persist
      saveEntity(updated).catch(e =>
        console.error('[characterStore] updateCharacter → saveEntity failed:', e)
      );
      // Sync the change to the rest of the table — role-aware: broadcasts
      // directly if we're the DM, or pushes up to the DM (who relays onward)
      // if we're a player. No-op if offline. See syncManager.syncEntity for
      // why this replaced the DM-only broadcastEntity call here.
      syncManager.syncEntity(updated);
    }
  },

  applyIncomingEntity: (entity) => {
    set(state => {
      const exists  = state.characters.some(c => c.id === entity.id);
      const updated = exists
        ? state.characters.map(c => c.id === entity.id ? entity : c)
        : [...state.characters, entity];
      return { characters: updated };
    });
    // Persist locally so the entity survives an app restart
    saveEntity(entity).catch(e =>
      console.error('[characterStore] applyIncomingEntity → saveEntity failed:', e)
    );
  },

  deleteCharacter: (id) => {
    set(state => ({
      characters: state.characters.filter(c => c.id !== id),
    }));

    deleteEntity(id).catch(e =>
      console.error('[characterStore] deleteCharacter → deleteEntity failed:', e)
    );
  },

  // ── Rules ─────────────────────────────────────────────────────────────────

  setRules: (partial) =>
    set(state => ({ rules: { ...state.rules, ...partial } })),
}));
