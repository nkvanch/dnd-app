# Mutation, Undo/Redo & Timeline — settled design

Status: **proposed, not implemented.** This is the final version of a design
that went through three rounds of revision in conversation. It deliberately
replaces an earlier, more general Command/DomainEvent/event-sourcing
approach (see the note at the end of [ARCHITECTURE.md](ARCHITECTURE.md)) —
that approach was rejected as more architecture than this project's current
scale justifies. The engine's existing pure mutator functions
(`applyDamage`, `applyCondition`, `applyGrant`, `takeRest`, etc. in
`src/engine/*.ts`) are meant to stay exactly as they are: `Entity → Entity`.
Everything below lives in the application layer, above the engine.

## The core problem this solves

Undo, a mechanical session timeline, and consistent persistence/sync all
need the same thing: a single point where every user-initiated character
mutation passes through, instead of trusting dozens of scattered UI call
sites (`TabCharacter.tsx`, `TabInventory.tsx`, `HpModal.tsx`,
`ConcentrationModal.tsx`, `DmOverrideModal.tsx`, `FreeEditModal.tsx`, and
more) to each remember to push an undo snapshot, log a timeline entry, and
persist correctly. Today those call sites invoke engine mutators fairly
directly. This design closes that off:

```text
UI may READ engine helpers.
UI may NOT perform persistent entity mutations directly.

UI → application/store mutation API → engine
```

## Architecture

```text
┌──────────────────────────────────────────────┐
│                     UI                       │
│                                              │
│ Character / Inventory / HP / Conditions      │
│ DM / Free Edit / Concentration / Combat      │
└──────────────────────┬───────────────────────┘
                       │
                       │ NO direct persistent
                       │ core mutation
                       ▼
┌──────────────────────────────────────────────┐
│           Application Mutation API           │
│                                              │
│ mutate(entityId, fn, options)                │
│ mutateMany(entityIds, fn, options)           │
│ undo()                                       │
│ redo()                                       │
│                                              │
│ owns:                                        │
│ • undo stack                                 │
│ • redo stack                                 │
│ • timeline creation                          │
│ • persistence orchestration                  │
│ • sync orchestration                         │
└──────────────────────┬───────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────┐
│               PURE RULES CORE                │
│                                              │
│ applyDamage / heal / applyCondition /        │
│ removeCondition / equipItem / applyGrant /   │
│ takeRest / levelUp / etc.                    │
│                                              │
│ normally:   Entity → Entity                  │
│ exception:  DamageResolution/HealingResolution│
└──────────────────────────────────────────────┘

           ┌────────────────────┐    ┌────────────────────┐
           │ Undo / Redo        │    │ Timeline           │
           │ RAM only           │    │ SQLite persistent  │
           │ max ~50 actions    │    │ session-scoped     │
           │ before[] + after[] │    │ small log entries  │
           └────────────────────┘    └────────────────────┘
```

In a future C++ port this most likely becomes an application service
rather than literally a Zustand `characterStore`, but the pattern — core
stays pure, application owns history — survives unchanged.

## The choke point

```ts
type MutationOptions = {
  label: string;
  timeline?: TimelineDraft;
  undoable?: boolean;
};

mutate(
  entityId: EntityId,
  mutator: (entity: Entity) => Entity,
  options: MutationOptions
): void
```

Internally:

```text
1. read current entity
2. save undo snapshot
3. clear redo stack
4. run pure mutator
5. update application state
6. persist entity
7. append timeline entry
8. sync resulting state diff
```

Call sites stop being able to implement only half the behavior:

```ts
characterStore.mutate(
  entityId,
  entity => applyDamage(entity, amount),
  {
    label: `Take ${amount} damage`,
    timeline: { category: "damage", message: `Took ${amount} damage` },
  }
);
```

For most mutation types the application layer already has enough context
to write an understandable timeline entry without any help from the core:

```ts
mutate(id, e => applyCondition(e, poisoned), {
  label: "Apply Poisoned",
  timeline: { category: "condition", message: "Poisoned applied", source: "Giant Spider" },
});
```

## Undo + redo

Store both sides of the mutation, not just `before` — redo then never needs
to re-run the mutator, which matters because a mutator's outcome can
involve a resolved dice roll or other state-sensitive behavior. Restoring a
stored snapshot is deterministic; re-running the mutator is not.

```ts
type EntitySnapshot = {
  entityId: EntityId;
  entity: Entity;
};

type HistoryEntry = {
  label: string;
  timestamp: number;
  before: EntitySnapshot[];
  after: EntitySnapshot[];
};
```

```text
Undo:  pop undo entry → restore before[] → push same entry to redo
Redo:  pop redo entry → restore after[]  → push same entry to undo
```

Standard clear-on-new-mutation semantics:

```text
A → B → C
Undo → back to B (C now sits on the redo stack)
Perform D → A → B → D (C is discarded)
```

```ts
mutate(...) {
  // ...
  redoStack.length = 0;
}
```

### Multi-entity actions, from day one

`before`/`after` are arrays even though today they'll almost always hold
exactly one entry — this costs nothing now and avoids a shape change later
for AoE damage, party-wide rest, mass healing, or DM bulk editing:

```ts
mutateMany(
  entityIds: EntityId[],
  mutator: (entities: Entity[]) => Entity[],
  options: MutationOptions
): void
```

```ts
characterStore.mutateMany(
  targetIds,
  entities => entities.map(e => applyDamage(e, damage)),
  { label: `Fireball: ${damage} fire damage` }
);
```

One user action produces one undo entry covering every affected entity,
not one entry per entity.

### Bounding

Fixed count, not a memory-size heuristic — `Entity` objects here are small
enough that estimating JS object size isn't worth the complexity:

```ts
const MAX_HISTORY = 50;

if (undoStack.length > MAX_HISTORY) {
  undoStack.shift();
}
```

50 actions is plenty for accidental-tap recovery; could become configurable
later, not worth building initially.

## Why `MutationResult<T>` was rejected as a general pattern

An intermediate version of this design let any core mutator optionally
return `{ value: Entity, log?: MechanicalLogEntry[] }` instead of a plain
`Entity`. That was deliberately walked back: letting every mutator opt into
a richer return shape "for consistency" is exactly the kind of generalization
this design otherwise avoids, and it forces every caller to remember which
mutators return which shape.

The contract stays `Entity → Entity`, full stop, for conditions, equipment,
rest, leveling, grants, overrides, and resources — the application already
knows enough to write a timeline entry for all of these on its own.

**Damage/healing are the deliberate, named exception**, not a template for
future mutators to follow: the engine computes mechanically useful
intermediate results (resistance, wild-shape-HP absorption, overflow) that
the application genuinely cannot reconstruct from `before`/`after` `Entity`
alone.

```ts
type DamageResolution = {
  entity: Entity;
  incoming: number;
  applied: number;
  resistanceApplied?: boolean;
  immunityApplied?: boolean;
  vulnerabilityApplied?: boolean;
  formDamage?: number;
  overflowDamage?: number;
};

resolveAndApplyDamage(...) => DamageResolution
```

Ordinary mutators keep returning `Entity`. Only damage/healing get the
detailed variant, and it should be the single implementation of that
math — a plain `applyDamage(entity, amount)` wrapper, if one is kept for
convenience, should just call the detailed version and discard the extra
fields, never reimplement damage resolution a second time.

## Timeline

Separate data structure from undo, with a separate lifetime:

```text
Undo history        RAM only, large snapshots, ephemeral, lost on restart
Mechanical timeline  small, readable, persistent, survives restart
```

```ts
type TimelineEntry = {
  id: string;
  sessionId: string;
  entityIds: EntityId[];
  timestamp: number;
  category: TimelineCategory;
  message: string;
  source?: TimelineSource;
  metadata?: Record<string, unknown>;
};
```

Persisted (SQLite is the natural fit — the app already uses it for
homebrew version history), and **never stores full `Entity` snapshots**,
only small structured log lines:

```text
22:13  Took 8 fire damage
22:14  Gained Poisoned
22:15  Used Second Wind
22:15  Healed 7 HP
```

### Session boundary

"Session" should be an explicit concept, not "until the app happens to
close":

```ts
type Session = {
  id: string;
  campaignId?: string;
  startedAt: number;
  endedAt?: number;
};
```

Started manually ("Start Session") or automatically when joining/hosting
LAN play; solo use can have one implicit active session. Restarting the
app keeps the same active session and its timeline visible; ending a
session archives it (`"Session 14 — September 4"`) for later review.

### Mutation scopes

Not every internal state change is a user action, and only user actions
should create history:

```ts
mutate(id, fn, { label: "...", undoable: true, timeline: { /* ... */ } });
```

`undoable: false` is for internal/maintenance operations — sync hydration,
database hydration, migration repair, a recompute-only cache update, remote
state reconciliation. Principle: **user-intent mutations produce undo
history; state maintenance does not.**

### Remote sync must not create local undo history

Important once LAN multiplayer exists: if a DM's damage arrives on a
player's device via sync, applying it must not go through the normal local
`mutate()` path, or the player could locally undo the DM's remote action
and diverge from shared state.

```text
Local user mutation   →  mutate()         → undo + timeline + persist + sync
Remote sync mutation  →  applyRemotePatch() → persist + state update, NO local undo
```

Timeline entries should be created by the originating device and synced
outward, rather than every peer independently synthesizing its own copy of
the same event. This is documented here for when multiplayer work resumes;
it does not need to be built now, since DM/multiplayer functionality is
deferred until the C++ port.

## Open engineering notes (from review, not yet resolved in the design)

These aren't objections to the shape above — they're gaps worth deciding
before implementation starts, surfaced during design review:

1. **No-op / failed mutations aren't handled.** `mutate()` as specified
   always runs all 8 steps unconditionally. Spending a resource already at
   0, equipping an already-equipped item, or any other mutator that
   shouldn't actually change anything would still push an undo entry, clear
   redo, and write a timeline line for nothing. Fix: let the mutator signal
   "no change" (e.g. return `null`, or the caller compares reference
   equality) and skip steps 2 and 4-8 in that case.
2. **`applyDamage` vs. `resolveAndApplyDamage`/`DamageResolution` must not
   become two independent implementations of damage math** — that would
   recreate the exact drift risk that the `audit.ts`/`pipeline.ts` formula
   unification (Phase 1 of the ruleset-generalization plan, see
   `docs/` root / the `fundamental-changes` branch) was built to eliminate.
   Keep exactly one real implementation; any simpler wrapper just discards
   fields from its result.
3. **There are now two sanctioned entry points into entity mutation**
   (`mutate()`/`mutateMany()` for local, `applyRemotePatch()` for remote),
   not one. That's necessary, but the "nothing bypasses this" property only
   holds if both live in the same module and nothing else is ever allowed
   to write to the entity store directly — worth an explicit rule (and
   ideally a lint boundary), not just convention.
4. **Ordering invariant needs to be explicit.** Rapid back-to-back
   mutations (e.g. a stepper firing quickly) are only race-free if step 5
   (in-memory state update) is synchronous and always completes before
   steps 6-8 (persist/timeline/sync, which may be async) even begin. State
   this as a hard invariant of `mutate()`, not an implementation detail.
5. **Redo interacting with entity deletion is unresolved.** If an entity
   involved in a `HistoryEntry` is deleted before its matching redo is
   invoked, does redo recreate it or invalidate that stack entry? Low
   probability for now (player-only entities aren't typically deleted
   mid-session), but pick one behavior before it comes up rather than
   leaving it ambiguous.
