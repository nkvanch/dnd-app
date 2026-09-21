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
import { useLastCharacterStore } from './lastCharacterStore';
import {
  saveEntity, loadAllEntities, deleteEntity, loadAllEntityMeta, persistedCharacterExists, EntityMeta,
} from '../db/entityRepo';
import { recordTimelineEntry, TimelineCategory } from '../db/timelineRepo';
import { saveDraftState, clearDraftState } from '../db/draftRepo';
import { syncManager } from '../sync/syncManager';
import { deepMerge } from '../sync/diff';
import { spellRepo } from '../content/spellRepo';
import { spellIdsOnEntity } from '../content/spellRepo.types';
import { itemRepo } from '../content/itemRepo';
import { itemIdsOnEntity } from '../content/itemRepo.types';
import { recomputeDerived } from '../engine/pipeline';
import { useHomebrewStore } from './homebrewStore';
import { hydrateItemInstanceDefinitionFacts, resolveItemDefinition } from '../engine/itemMechanics';

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
    const def = resolveItemDefinition(inst.itemId);
    return hydrateItemInstanceDefinitionFacts(inst, def);
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

/**
 * Self-heals a Feature whose activation.resourceCost points at a resource
 * id that's gone missing from entity.resources.custom — shows up as e.g.
 * a Bonus Action card reading `Resource "foo_pool" not found`. Happens when
 * a homebrew race/subrace's resource_ability trait (Chi Pulse, etc.) gets
 * edited in the builder after a character already selected it: the
 * character's own resources.custom snapshot is frozen at selection time
 * (see race-detail.tsx's selectRace), so it can drift from whatever the
 * race/subrace's CURRENT compiled `resources` list says. Re-grants the
 * missing resource from that current definition — same
 * fall-back-to-current-definition shape hydrateItemFeatures uses for items,
 * just for races/subraces instead. Class/subclass resource drift isn't
 * covered here (not the reported case, and class resources rarely get
 * renamed after being taken) but could use the same fix if it ever surfaces.
 */
function hydrateMissingResources(entity: Entity): Entity {
  const missingIds = new Set<string>();
  for (const f of entity.features) {
    const rid = f.activation?.resourceCost?.resourceId;
    if (rid && rid !== 'spell_slots' && !entity.resources.custom.some(r => r.id === rid)) {
      missingIds.add(rid);
    }
  }
  if (missingIds.size === 0) return entity;

  const db      = useHomebrewStore.getState().getMergedContentDB();
  const race    = db.races.find(r => r.id === entity.identity.raceId);
  const subrace = race?.subraces?.find(s => s.id === entity.identity.subRaceId);
  const pool    = [...(race?.resources ?? []), ...(subrace?.resources ?? [])];

  const healed = [...entity.resources.custom];
  for (const rid of missingIds) {
    const found = pool.find(r => r.resourceId === rid);
    if (found) {
      healed.push({ id: found.resourceId, name: found.name, current: found.maximum, maximum: found.maximum, recharge: found.recharge });
    }
  }
  if (healed.length === entity.resources.custom.length) return entity;
  return { ...entity, resources: { ...entity.resources, custom: healed } };
}

// ── Debounced SQLite writes ───────────────────────────────────────────────────
// updateCharacter() fires on every HP tap, condition toggle, resource spend —
// far more often than the SQLite write actually needs to happen. Debouncing
// per entity id (trailing edge) collapses a burst of taps into one write,
// cutting both write volume and battery drain. Zustand state itself still
// updates synchronously on every call — this only delays the disk write.
const SAVE_DEBOUNCE_MS = 600;
// Re-audit A01/A29 (item 14): this used to be a Map<string, Entity>, storing
// the entity SNAPSHOT captured at schedule time. That snapshot could go
// stale — if an inbound sync patch/snapshot landed and persisted its own
// immediate write (applyIncomingEntity/applyIncomingPatch, both call
// saveEntity() directly, not debounced) during this timer's debounce
// window, the eventual flush would silently overwrite that newer SQLite
// row with the older captured snapshot, reverting the merge on disk while
// Zustand/the UI kept showing the correct merged state. Storing only the
// id and re-reading the CURRENT live entity at flush time makes that class
// of staleness structurally impossible — flush always persists whatever is
// actually true in the store at that moment, never a closure from the past.
const pendingSaveIds = new Set<string>();
const saveTimers     = new Map<string, ReturnType<typeof setTimeout>>();

/**
 * Reports a SQLite write outcome onto the store's lastPersistError field —
 * cleared on the next successful write, set (with a user-readable message)
 * on failure. `useCharacterStore` is referenced here even though it's
 * declared later in this module: these are plain functions only ever
 * INVOKED at runtime (via a debounce timer or an async continuation), by
 * which point the whole module — including the `export const
 * useCharacterStore = create(...)` assignment below — has already finished
 * evaluating.
 */
function reportPersistOutcome(context: string, error: unknown | null): void {
  if (error === null) {
    useCharacterStore.setState({ lastPersistError: null });
    return;
  }
  console.error(`[characterStore] ${context} failed:`, error);
  useCharacterStore.setState({
    lastPersistError: `Couldn't save your last change (${context}) — it may be lost if the app closes.`,
  });
}

function scheduleSave(entityId: string): void {
  pendingSaveIds.add(entityId);
  const existing = saveTimers.get(entityId);
  if (existing) clearTimeout(existing);
  saveTimers.set(entityId, setTimeout(() => {
    saveTimers.delete(entityId);
    pendingSaveIds.delete(entityId);
    // Re-read the live entity rather than trusting a captured snapshot —
    // see pendingSaveIds' own comment above for why.
    const toSave = useCharacterStore.getState().characters.find(c => c.id === entityId);
    if (toSave) {
      saveEntity(toSave).then(
        () => reportPersistOutcome('debounced save', null),
        e  => reportPersistOutcome('debounced save', e)
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
  const ids = Array.from(pendingSaveIds);
  pendingSaveIds.clear();
  const characters = useCharacterStore.getState().characters;
  for (const id of ids) {
    const entity = characters.find(c => c.id === id);
    if (!entity) continue; // deleted since scheduling — nothing to save
    saveEntity(entity).then(
      () => reportPersistOutcome('flush on background', null),
      e  => reportPersistOutcome('flush on background', e)
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
  abilityGenerationMode: 'standard',
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
    kiSaveDC:          null,
    abilityBasedDC:    { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
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
    characterOverrides: [],
    dmOverrides:      [],
    wildShapeState:   null,
    notes:            '',
  };
}

// ── Store ─────────────────────────────────────────────────────────────────────

/**
 * One undoable step. `before` is an array (not a bare Entity) even though
 * every current mutation is single-entity — avoids a reshape later if a
 * future bulk action needs to undo several entities as one step.
 * Session-local only — NOT persisted (see character_timeline, Phase B, for
 * the persistent equivalent). Cleared on app restart.
 */
export type UndoEntry = {
  entityId:  string;
  before:    Entity[];
  label:     string;
  timestamp: number;
  /**
   * Closure item 13 (was `afterRevision`, re-audit A01/A29 item 14): the
   * entity's Entity.revision at the moment this entry was captured.
   * Entity.revision is now bumped ONLY by successfully-applied EXTERNAL/
   * inbound updates (applyIncomingEntity/applyIncomingPatch) — ordinary
   * local mutations (updateCharacter/undo/redo) never touch it. That's the
   * fix for the original design's regression: because local traversal
   * leaves revision untouched, a chain of local undo→undo→redo→redo always
   * sees the SAME revision value at every step and never invalidates
   * itself. undo()/redo() still compare this against the live entity's
   * current revision before acting — a mismatch now means specifically
   * "an external/inbound update landed since this entry was captured",
   * never "some other local history traversal happened in between".
   */
  entityRevision: number;
};

/** Fixed entry count, not a memory-size heuristic — Entity objects here are
 *  small (~5-30KB, see schema.ts's own reasoning for the same data) and JS
 *  memory estimation is unreliable, so a simple cap is the right tool. */
const UNDO_STACK_LIMIT = 50;

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
  /** Session-local undo/redo history — see UndoEntry's own doc comment. */
  undoStack: UndoEntry[];
  redoStack: UndoEntry[];
  /**
   * Human-readable message for the most recent SQLite write failure on
   * this store (debounced save, draft save, incoming-sync persist, or
   * delete), or null once the next write succeeds. Every write here used
   * to be fire-and-forget with only a console.error on failure — the UI
   * kept showing the successful in-memory mutation while the disk write
   * silently failed, discovered only after a later restart reverted the
   * change with no explanation (audit finding PERSIST-5). Mirrors the
   * existing syncStatus.lastError pattern (src/store/syncStore.ts),
   * already rendered as a small banner elsewhere in the app. Also reused
   * (re-audit A01/A29, item 14) for a refused undo/redo — "this character
   * changed elsewhere since then" is the same class of "something about
   * the last state-changing action needs your attention" message this
   * banner already exists to show, not a new UI concept.
   */
  lastPersistError: string | null;

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

  /**
   * Sets the in-progress creation draft AND persists it to SQLite (fire-
   * and-forget) — re-audit A09 (item 11), so an app kill mid-creation
   * doesn't lose the player's progress. Every creation-flow screen already
   * calls this on every meaningful step (race/class/scores/etc.), so no
   * new call sites are needed for the persistence to take effect.
   */
  setDraft:   (entity: Entity)  => void;
  /** Clears the draft from both memory and its persisted SQLite row —
   *  the explicit "discard my in-progress character" action (see
   *  CreationHeader.tsx's Cancel button). */
  clearDraft: ()                => void;
  /**
   * Saves the draft to the characters list and persists it to SQLite.
   * Re-audit A09 (item 11): the draft (both in memory and its SQLite row)
   * is deliberately NOT cleared until the SQLite write for the FINAL
   * character actually succeeds — clearing it optimistically, before that
   * write is confirmed, would mean a failed save loses the character with
   * no way to recover it (the in-progress creation flow's own draft would
   * already be gone too). On failure, the optimistic `characters` list
   * update is rolled back and the draft (and its persisted row) are left
   * exactly as they were, so the Review screen can retry. Returns whether
   * the save actually succeeded, so callers know whether it's safe to
   * navigate away.
   */
  saveDraft:  () => Promise<boolean>;

  // ── Character management ─────────────────────────────────────────────────

  /**
   * Replace an existing character using a pure updater function.
   * Zustand state updates synchronously; SQLite write fires async.
   * `label` (default 'Edit') is what the undo/redo UI and the persistent
   * mechanical timeline show for this step — every existing call site
   * omitting it keeps compiling and just shows the generic default.
   */
  updateCharacter: (id: string, updater: (e: Entity) => Entity, label?: string, category?: TimelineCategory) => void;
  deleteCharacter: (id: string) => void;
  importCharacter: (entity: Entity) => Promise<boolean>;

  /** Steps back one entry in undoStack, pushing the replaced state onto
   *  redoStack (a true inverse of redo()). No-op if undoStack is empty. */
  undo: () => void;
  /** Steps forward one entry in redoStack, pushing the replaced state onto
   *  undoStack. No-op if redoStack is empty. Cleared by any NEW
   *  updateCharacter call — the standard "branching history invalidates
   *  the old redo path" rule. */
  redo: () => void;

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
  undoStack:     [],
  redoStack:     [],
  lastPersistError: null,

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
      const characters = preHydration.map(hydrateItemFeatures).map(hydrateMissingResources);

      // Warm the Tier-2 spell cache for every known/prepared/cantrip spell
      // across every loaded character, once, before the engine pipeline
      // (recomputeDerived, generateAllActionCards) runs against them.
      const allSpellIds = new Set<string>();
      for (const c of characters) for (const id of spellIdsOnEntity(c)) allSpellIds.add(id);
      await spellRepo.ensureLoaded(Array.from(allSpellIds));

      // `derived` is a cache, not a persisted source of truth — recompute it
      // fresh on every load rather than trusting whatever blob was last
      // saved. Without this, a character saved before a new DerivedStats
      // field existed (e.g. advantageStates) loads with that field simply
      // missing, crashing the first screen that reads it before any mutation
      // ever triggers a recompute. The comment above already described this
      // as the intent; the actual call was missing.
      const rules = get().rules;
      const recomputed = characters.map(c => recomputeDerived(c, rules));

      set({ characters: recomputed, isLoading: false });
    } catch (e) {
      console.error('[characterStore] loadCharacters failed:', e);
      set({ isLoading: false });
    }
  },

  // ── Draft management ──────────────────────────────────────────────────────

  setDraft: (entity) => {
    set({ draft: entity });
    saveDraftState(entity).catch(e => console.error('[characterStore] failed to persist creation draft:', e));
  },
  clearDraft: () => {
    set({ draft: null });
    clearDraftState().catch(() => { /* non-critical — a leftover row is just re-offered/overwritten next time */ });
  },

  saveDraft: async () => {
    const { draft, characters } = get();
    if (!draft) return false;

    const exists = characters.some(c => c.id === draft.id);
    const updated = exists
      ? characters.map(c => c.id === draft.id ? draft : c)
      : [...characters, draft];

    // Optimistic Zustand update — UI (e.g. the character list) reflects
    // immediately. The draft itself is deliberately NOT cleared here — see
    // this method's own doc comment in the store type above.
    set({ characters: updated });

    try {
      await saveEntity(draft);
      reportPersistOutcome('saveDraft', null);
      // Only now — after the durable write is confirmed — clear the draft
      // from both memory and its persisted SQLite row.
      set({ draft: null });
      await clearDraftState();
      return true;
    } catch (e) {
      reportPersistOutcome('saveDraft', e);
      // Roll back the optimistic characters-list change so state doesn't
      // claim a character exists that was never durably saved. The draft
      // (and its SQLite row) are untouched, so the caller can retry.
      set({ characters });
      return false;
    }
  },

  // ── Character management ───────────────────────────────────────────────────

  updateCharacter: (id, updater, label = 'Edit', category) => {
    let updated: Entity | null = null;
    let previous: Entity | null = null;
    const timestamp = Date.now();

    set(state => {
      const next = state.characters.map(c => {
        if (c.id !== id) return c;
        previous = c;
        // Closure item 13: local edits do NOT bump revision — only
        // applyIncomingEntity/applyIncomingPatch (genuine external updates)
        // do. `updater`'s own output already carries `c.revision` through
        // unchanged via its own spread (every mutator in this codebase
        // spreads the input entity), so no explicit stamping is needed here.
        updated = updater(c);
        return updated;
      });
      if (!previous || !updated) return { characters: next };
      // A real, new mutation invalidates any prior redo path — standard
      // undo/redo branching-history rule.
      const undoEntry: UndoEntry = { entityId: id, before: [previous], label, timestamp, entityRevision: previous.revision ?? 0 };
      return {
        characters: next,
        undoStack: [undoEntry, ...state.undoStack].slice(0, UNDO_STACK_LIMIT),
        redoStack: [],
      };
    });

    if (updated) {
      // Debounced SQLite persist — see scheduleSave's doc comment above.
      // Zustand state (read by every screen) is already updated synchronously
      // above; this only delays the disk write, not the UI.
      scheduleSave(id);
      // Persistent mechanical timeline — same label/timestamp as the
      // session-local undo entry above, fire-and-forget (never awaited),
      // same non-blocking style scheduleSave already uses. Survives app
      // restart, unlike undoStack — that's the deliberate distinction.
      void recordTimelineEntry(id, label, timestamp, category);
      // Sync only what changed since `previous` — role-aware: broadcasts
      // directly if we're the DM, or pushes up to the DM (who relays onward)
      // if we're a player. No-op if offline. Sending a diff instead of the
      // full entity (and merging on receive, not replacing) is what fixes
      // "every minor change overwrites unrelated fields on other devices" —
      // see syncEntityPatch's doc comment in syncManager.ts.
      syncManager.syncEntityPatch(id, previous, updated);
    }
  },

  /**
   * Steps back one undo entry: replaces the current entity with the stored
   * "before" snapshot, and pushes what it replaced onto redoStack (the true
   * inverse of redo()). Bypasses updateCharacter entirely — going through
   * it would push ANOTHER undo entry for the undo itself. Still goes through
   * the same scheduleSave/syncEntityPatch persist+sync path every other
   * mutation does, so an undo is indistinguishable from a normal edit to
   * SQLite or sync peers. Self-healing if the target character no longer
   * exists (e.g. deleted since the entry was pushed): the stale entry is
   * still popped so it can't block future undos, it just skips the
   * persist/sync/redo-push.
   *
   * Closure item 13 (was: re-audit A01/A29 item 14, which had a real
   * regression): before restoring, compares the live entity's
   * Entity.revision against the entry's `entityRevision`. Since local
   * mutations never touch Entity.revision (see UndoEntry's own doc comment
   * — only applyIncomingEntity/applyIncomingPatch do), this check can ONLY
   * fail due to a genuine external/inbound update landing since the entry
   * was captured — a chain of purely local undo→undo→redo→redo never
   * touches revision at all, so it can never invalidate itself. A mismatch
   * means blindly restoring `before` would silently discard that external
   * change. The entry is still popped (so a stale/conflicting entry can't
   * permanently block the stack), but nothing is applied, and the conflict
   * is surfaced via lastPersistError rather than staying silent.
   */
  undo: () => {
    const entry = get().undoStack[0];
    if (!entry) return;
    const { entityId: id, before: [restored], label, entityRevision } = entry;
    const live = get().characters.find(c => c.id === id);

    if (live && (live.revision ?? 0) !== entityRevision) {
      set(state => ({ undoStack: state.undoStack.slice(1) }));
      set({ lastPersistError: `Can't undo "${label}" — this character changed elsewhere since then.` });
      return;
    }

    let replaced: Entity | null = null;

    set(state => {
      const characters = state.characters.map(c => {
        if (c.id !== id) return c;
        replaced = c;
        return restored;
      });
      // `restored` already carries the correct (unchanged-by-local-edits)
      // revision from when IT was captured — no re-stamping needed.
      const redoEntry: UndoEntry | null = replaced
        ? { entityId: id, before: [replaced], label, timestamp: Date.now(), entityRevision: replaced.revision ?? 0 }
        : null;
      return {
        characters,
        undoStack: state.undoStack.slice(1),
        redoStack: redoEntry ? [redoEntry, ...state.redoStack].slice(0, UNDO_STACK_LIMIT) : state.redoStack,
      };
    });

    if (replaced) {
      scheduleSave(id);
      syncManager.syncEntityPatch(id, replaced, restored);
    }
  },

  /** Steps forward one redo entry — the exact mirror of undo() above,
   *  including the same revision-conflict check and self-healing behavior. */
  redo: () => {
    const entry = get().redoStack[0];
    if (!entry) return;
    const { entityId: id, before: [restored], label, entityRevision } = entry;
    const live = get().characters.find(c => c.id === id);

    if (live && (live.revision ?? 0) !== entityRevision) {
      set(state => ({ redoStack: state.redoStack.slice(1) }));
      set({ lastPersistError: `Can't redo "${label}" — this character changed elsewhere since then.` });
      return;
    }

    let replaced: Entity | null = null;

    set(state => {
      const characters = state.characters.map(c => {
        if (c.id !== id) return c;
        replaced = c;
        return restored;
      });
      const undoEntry: UndoEntry | null = replaced
        ? { entityId: id, before: [replaced], label, timestamp: Date.now(), entityRevision: replaced.revision ?? 0 }
        : null;
      return {
        characters,
        redoStack: state.redoStack.slice(1),
        undoStack: undoEntry ? [undoEntry, ...state.undoStack].slice(0, UNDO_STACK_LIMIT) : state.undoStack,
      };
    });

    if (replaced) {
      scheduleSave(id);
      syncManager.syncEntityPatch(id, replaced, restored);
    }
  },

  applyIncomingEntity: async (entity) => {
    // Bug fix (architecture review P1, S0): an incoming FULL snapshot for a
    // character THIS device already has locally AND currently owns/controls
    // (syncManager.ownedCharacterId) used to unconditionally overwrite local
    // state. In practice, the only thing that ever sends a player an
    // entity_snapshot for an already-existing character is the DM's
    // reconnect-triggered push (server.ts's onEntitySyncRequested, fired on
    // every 'hello') — built from the DM's OWN possibly-stale copy. There is
    // no offline mutation queue for entity patches (syncEntityPatch/
    // syncEntity just silently no-op via SyncClient.send while
    // disconnected, with nothing queued to replay) — so a WiFi blip during
    // which the player took an action (damage, a spell slot spent — saved
    // correctly to THIS device's own store, just never transmitted) was
    // silently reverted, in both memory and local SQLite, the moment the
    // socket reconnected and the DM's stale snapshot arrived.
    //
    // This device's own local copy of a character IT owns is authoritative
    // for that character — the DM only ever legitimately edits an owned
    // character via a PATCH now (applyIncomingPatch, deep-merged, never a
    // wholesale replace — see the U1/U2 fix), so a full-snapshot push for
    // an owned, already-known entity always means "the sender's copy may be
    // stale," never "here's an intentional edit to accept." Push the local
    // copy back up instead of accepting the overwrite, correcting the
    // sender rather than silently losing local state.
    const state = get();
    const localCopy = state.characters.find(c => c.id === entity.id);
    if (localCopy && entity.id === syncManager.ownedCharacterId) {
      syncManager.pushEntity(localCopy);
      return;
    }

    // A remote device can push spell/item ids this device has never locally
    // browsed — warm Tier 2 before the entity lands in state so the engine
    // pipeline never hits a synchronous cache miss for it.
    await Promise.all([
      spellRepo.ensureLoaded(spellIdsOnEntity(entity)),
      itemRepo.ensureLoaded(itemIdsOnEntity(entity)),
    ]);
    let stampedEntity: Entity = entity;
    set(state => {
      const existing = state.characters.find(c => c.id === entity.id);
      // Re-audit A01/A29 (item 14): stamp a fresh local revision on the
      // accepted entity, ignoring whatever revision (if any) came over the
      // wire — this is a local, monotonic conflict-detection counter, not
      // a synced value. Advancing it here is what lets undo() notice "an
      // inbound sync update landed since this undo entry was captured"
      // instead of silently restoring an obsolete snapshot over it.
      stampedEntity = { ...entity, revision: (existing?.revision ?? 0) + 1 };
      const updated = existing
        ? state.characters.map(c => c.id === entity.id ? stampedEntity : c)
        : [...state.characters, stampedEntity];
      return { characters: updated };
    });
    // Persist locally so the entity survives an app restart
    saveEntity(stampedEntity).then(
      () => reportPersistOutcome('applyIncomingEntity', null),
      e  => reportPersistOutcome('applyIncomingEntity', e)
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
        // Re-audit A01/A29 (item 14): stamp a fresh local revision after
        // merging, same reasoning as applyIncomingEntity above — the patch
        // itself may carry an unrelated `revision` value from the sender,
        // which must not leak into this device's own monotonic counter.
        merged = { ...deepMerge(c, patch), revision: (c.revision ?? 0) + 1 };
        return merged;
      });
      return { characters: next };
    });
    if (merged) {
      saveEntity(merged).then(
        () => reportPersistOutcome('applyIncomingPatch', null),
        e  => reportPersistOutcome('applyIncomingPatch', e)
      );
    }
    // If we don't have a local copy at all, there's nothing to merge onto —
    // this shouldn't normally happen since a full snapshot always precedes
    // patches (see server.ts's onEntitySyncRequested on every 'hello'), but
    // silently doing nothing is the safe behavior rather than guessing.
  },

  importCharacter: async (entity) => {
    try {
      if (await persistedCharacterExists(entity.id)) return false;
      await saveEntity(entity);
      set(state => ({ characters: [entity, ...state.characters.filter(c => c.id !== entity.id)] }));
      reportPersistOutcome('importCharacter', null);
      return true;
    } catch (error) {
      reportPersistOutcome('importCharacter', error);
      return false;
    }
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
    pendingSaveIds.delete(id);

    void useLastCharacterStore.getState().clearIfDeleted(id).catch(() => {});
    deleteEntity(id).then(
      () => reportPersistOutcome('deleteCharacter', null),
      e  => reportPersistOutcome('deleteCharacter', e)
    );
  },

  // ── Rules ─────────────────────────────────────────────────────────────────

  setRules: (partial) =>
    set(state => ({ rules: { ...state.rules, ...partial } })),
}));
