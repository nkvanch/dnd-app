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
import { AppState } from 'react-native';
import { Entity, CampaignRules, SkillName, SkillEntry, AbilityScores, ItemInstance } from '../engine/types';
import {
  saveEntity, loadAllEntities, deleteEntity, loadAllEntityMeta, EntityMeta,
} from '../db/entityRepo';
import { syncManager } from '../sync/syncManager';
import { deepMerge } from '../sync/diff';
import { spellRepo } from '../content/spellRepo';
import { spellIdsOnEntity } from '../content/spellRepo.types';
import { itemRepo } from '../content/itemRepo';
import { itemIdsOnEntity } from '../content/itemRepo.types';

export type { EntityMeta };

// ── Item feature hydration ────────────────────────────────────────────────────

/**
 * Hydrates features on all equipped and carried ItemInstances from the content
 * definitions. ItemInstances are serialised with features:[] (only itemId is
 * stored) so on load we must re-attach the definition's features. Without this,
 * equipping armor has no AC effect after an app restart.
 *
 * Reads from itemRepo's Tier-2 cache, which the caller (loadCharacters(),
 * below) must have already warmed via ensureLoaded — this function itself
 * stays synchronous so it's a drop-in map over the character list.
 */
function hydrateItemFeatures(entity: Entity): Entity {
  function hydrateInstance(inst: ItemInstance): ItemInstance {
    if (inst.features.length > 0) return inst;   // already hydrated (e.g. from equip path)
    const def = itemRepo.getItemSync(inst.itemId);
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

// ── Debounced SQLite writes ───────────────────────────────────────────────────
// updateCharacter() fires on every HP tap, condition toggle, resource spend —
// far more often than the SQLite write actually needs to happen. Debouncing
// per entity id (trailing edge) collapses a burst of taps into one write,
// cutting both write volume and battery drain. Zustand state itself still
// updates synchronously on every call — this only delays the disk write.
const SAVE_DEBOUNCE_MS = 600;
const pendingSaves = new Map<string, Entity>();
const saveTimers   = new Map<string, ReturnType<typeof setTimeout>>();

function scheduleSave(entity: Entity): void {
  pendingSaves.set(entity.id, entity);
  const existing = saveTimers.get(entity.id);
  if (existing) clearTimeout(existing);
  saveTimers.set(entity.id, setTimeout(() => {
    saveTimers.delete(entity.id);
    const toSave = pendingSaves.get(entity.id);
    pendingSaves.delete(entity.id);
    if (toSave) {
      saveEntity(toSave).catch(e =>
        console.error('[characterStore] debounced saveEntity failed:', e)
      );
    }
  }, SAVE_DEBOUNCE_MS));
}

/**
 * Immediately persists every pending debounced write, bypassing the delay.
 * Wired to AppState below — mobile apps can be killed at any point once
 * backgrounded, with no further JS execution guaranteed, so a write still
 * sitting in the debounce window when that happens must be flushed first.
 */
export function flushPendingSaves(): void {
  for (const timer of saveTimers.values()) clearTimeout(timer);
  saveTimers.clear();
  const toFlush = Array.from(pendingSaves.values());
  pendingSaves.clear();
  for (const entity of toFlush) {
    saveEntity(entity).catch(e =>
      console.error('[characterStore] flushPendingSaves → saveEntity failed:', e)
    );
  }
}

AppState.addEventListener('change', (state) => {
  if (state === 'background' || state === 'inactive') {
    flushPendingSaves();
  }
});

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
    advantageStates:   [],
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
  applyIncomingEntity: (entity: Entity) => Promise<void>;

  /**
   * Apply a PARTIAL entity patch received from a sync peer (see
   * src/sync/diff.ts). Deep-merges onto THIS device's own current local
   * copy of the entity — never a wholesale replace — so a field this
   * device already has that the patch doesn't mention is preserved exactly.
   * This is the fix for the old "minor change overwrites unrelated fields"
   * sync problem. No-op if we don't have a local copy of this entity yet
   * (shouldn't normally happen — a full snapshot always precedes patches).
   */
  applyIncomingPatch: (entityId: string, patch: Record<string, unknown>) => Promise<void>;

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
      const preHydration = entities
        .filter(e => e.kind === 'character' || (e.kind === 'monster' && !!e.identity.companionOf));

      // Warm the Tier-2 item cache BEFORE hydrateItemFeatures — it reads
      // itemRepo.getItemSync() synchronously for every equipped/carried
      // instance, so the cache must already hold them by this point. This is
      // the single highest-priority ensureLoaded call in the app: every
      // equipped item's AC/attack effects depend on it running first, on
      // every boot.
      const allItemIds = new Set<string>();
      for (const e of preHydration) for (const id of itemIdsOnEntity(e)) allItemIds.add(id);
      await itemRepo.ensureLoaded(Array.from(allItemIds));

      // Hydrate item features on load — ItemInstances are stored with features:[]
      // so we re-attach definition features before the engine sees them.
      // Companions (kind:'monster' with identity.companionOf set — Steel
      // Defender, Eldritch Cannon) load into this same array so their owner
      // can find them by id, same as any normal character; they're
      // deliberately excluded from characterMeta/the character list below,
      // since they're not independently-playable characters.
      const characters = preHydration.map(hydrateItemFeatures);

      // Warm the Tier-2 spell cache for every known/prepared/cantrip spell
      // across every loaded character, once, before the engine pipeline
      // (recomputeDerived, generateAllActionCards) runs against them.
      const allSpellIds = new Set<string>();
      for (const c of characters) for (const id of spellIdsOnEntity(c)) allSpellIds.add(id);
      await spellRepo.ensureLoaded(Array.from(allSpellIds));

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
    let previous: Entity | null = null;

    set(state => {
      const next = state.characters.map(c => {
        if (c.id !== id) return c;
        previous = c;
        updated = updater(c);
        return updated;
      });
      return { characters: next };
    });

    if (updated) {
      // Debounced SQLite persist — see scheduleSave's doc comment above.
      // Zustand state (read by every screen) is already updated synchronously
      // above; this only delays the disk write, not the UI.
      scheduleSave(updated);
      // Sync only what changed since `previous` — role-aware: broadcasts
      // directly if we're the DM, or pushes up to the DM (who relays onward)
      // if we're a player. No-op if offline. Sending a diff instead of the
      // full entity (and merging on receive, not replacing) is what fixes
      // "every minor change overwrites unrelated fields on other devices" —
      // see syncEntityPatch's doc comment in syncManager.ts.
      syncManager.syncEntityPatch(id, previous, updated);
    }
  },

  applyIncomingEntity: async (entity) => {
    // A remote device can push spell/item ids this device has never locally
    // browsed — warm Tier 2 before the entity lands in state so the engine
    // pipeline never hits a synchronous cache miss for it.
    await Promise.all([
      spellRepo.ensureLoaded(spellIdsOnEntity(entity)),
      itemRepo.ensureLoaded(itemIdsOnEntity(entity)),
    ]);
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

  applyIncomingPatch: async (entityId, patch) => {
    // The patch may introduce spell ids this device has never seen (a
    // remote player learned a new spell) — warm Tier 2 for anything in the
    // incoming spellcasting block before merging, same rationale as
    // applyIncomingEntity above.
    if (patch.spellcasting) {
      await spellRepo.ensureLoaded(spellIdsOnEntity({
        spellcasting: patch.spellcasting as Partial<Entity['spellcasting']>,
      }));
    }
    if (patch.inventory) {
      await itemRepo.ensureLoaded(itemIdsOnEntity({
        inventory: patch.inventory as Entity['inventory'],
      }));
    }
    let merged: Entity | null = null;
    set(state => {
      const next = state.characters.map(c => {
        if (c.id !== entityId) return c;
        merged = deepMerge(c, patch);
        return merged;
      });
      return { characters: next };
    });
    if (merged) {
      saveEntity(merged).catch(e =>
        console.error('[characterStore] applyIncomingPatch → saveEntity failed:', e)
      );
    }
    // If we don't have a local copy at all, there's nothing to merge onto —
    // this shouldn't normally happen since a full snapshot always precedes
    // patches (see server.ts's onEntitySyncRequested on every 'hello'), but
    // silently doing nothing is the safe behavior rather than guessing.
  },

  deleteCharacter: (id) => {
    set(state => ({
      characters: state.characters.filter(c => c.id !== id),
    }));

    // Cancel any debounced write still pending for this id — otherwise it
    // could fire after deleteEntity() below and resurrect the row.
    const timer = saveTimers.get(id);
    if (timer) clearTimeout(timer);
    saveTimers.delete(id);
    pendingSaves.delete(id);

    deleteEntity(id).catch(e =>
      console.error('[characterStore] deleteCharacter → deleteEntity failed:', e)
    );
  },

  // ── Rules ─────────────────────────────────────────────────────────────────

  setRules: (partial) =>
    set(state => ({ rules: { ...state.rules, ...partial } })),
}));
