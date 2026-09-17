# Grimoire — Proposed Architecture

Status: **proposed, not implemented.** This is a design target, developed
through a series of iterations, for evolving Grimoire from a character-sheet
app into a full local-first d20 campaign platform. See
[MUTATION_UNDO_TIMELINE.md](MUTATION_UNDO_TIMELINE.md) for the drill-down on
mutations/undo/redo/timeline specifically — that subsystem's design
superseded an earlier, more general Command/DomainEvent approach sketched
in an early draft of this document, and should be read as the current
answer, not the DomainEvent framing described briefly in §7 below.

## 1. Five products, one domain model

Grimoire is meant to function less like a single character-sheet app and
more like a local-first d20 campaign operating system, made of five
sub-products that all sit on the same mechanical core rather than five
disconnected apps:

- **Character Tool (BUILD)** — creation, multiclassing, inventory,
  attunement, resources, HP/conditions, wild shape, spell slots and special
  pools, favorites, notes, manual overrides, full explainability.
- **Live Play (PLAY)** — a dedicated combat-mode view: HP/AC/speed,
  conditions, resources, favorites, actions, dice roller, combat log,
  turn-aware effects. Eventually an "available now / unavailable /
  context-dependent" action filter instead of one flat action list.
- **DM Tool (RUN)** — campaign dashboard, party overview,
  encounter/initiative manager, monster spawning, DM overrides, LAN
  multiplayer with a DM device acting as session coordinator.
  **Explicitly postponed until the eventual C++ port** — a real DM tool
  needs native Windows and Linux desktop apps, not just what Expo/React
  Native comfortably targets.
- **Content Authoring (CREATE)** — a full searchable reference library,
  homebrew builders for every content type using real composable mechanics
  (not free text) that compile into the *same* domain objects as official
  content (no secondary homebrew engine), a homebrew test bench, and a pack
  system for distribution.
- **Rules Platform (UNDERSTAND)** — explainability, simulation/"what-if"
  previews, a progression planner, session history, undo/redo, a
  concentration subsystem, a smarter rest flow, multi-ruleset support, and
  house-rule profiles.

Three features are the signature differentiators, and the intended build
order follows their dependency chain:

```text
PAST                          PRESENT                      FUTURE
How did this happen?          Why is this true?             What would happen if...?
        │                             │                              │
        ▼                             ▼                              ▼
Mechanical History            Explainability                 Simulation / Preview
   (not built)                   (BUILT — audit.ts)            (not built)
```

Explainability is done. Simulation is the recommended next investment,
because Grimoire's derived-stat pipeline is already a pure recomputation
from scratch — before/after diffing is nearly free once it exists, and it
is the single primitive that would power equip-preview, feat-preview,
rest-preview, the level-up planner, the "what-if" sandbox, and the homebrew
test bench simultaneously.

## 2. Layered architecture

```text
                     ┌──────────────────────┐
                     │       UI / UX        │
                     │                      │
                     │ Player               │
                     │ DM                   │
                     │ Homebrew             │
                     │ Campaign             │
                     │ Combat               │
                     └──────────┬───────────┘
                                │
                                ▼
                     ┌──────────────────────┐
                     │     Application      │
                     │                      │
                     │ Mutation API         │
                     │ Undo / Redo          │
                     │ Timeline             │
                     │ Queries              │
                     │ Permissions          │
                     │ Session orchestration│
                     └──────────┬───────────┘
                                │
                                ▼
           ┌─────────────────────────────────────────┐
           │              PURE CORE                  │
           │                                         │
           │ Entity                                  │
           │ Features / Grants / Choices              │
           │ Effects / Resolver                      │
           │ Abilities / Resources                   │
           │ Conditions / Temporary Effects           │
           │ Combat / Rest / Leveling                │
           │ Derived Stats / Explainability           │
           │ Simulation / Preview                    │
           └───────────────────┬─────────────────────┘
                               │
                               ▼
           ┌─────────────────────────────────────────┐
           │          CONTENT / RULESETS             │
           │                                         │
           │ Classes / Races / Feats                 │
           │ Items / Spells / Monsters               │
           │ Backgrounds / Conditions                │
           │ Homebrew / Packs                        │
           │ RulesetDefinition                       │
           └───────────────────┬─────────────────────┘
                               │
             ┌─────────────────┴──────────────────┐
             ▼                                    ▼
      ┌──────────────┐                    ┌──────────────┐
      │ Persistence  │                    │ Sync         │
      │              │                    │              │
      │ SQLite       │                    │ LAN TCP      │
      │ Backups      │                    │ Discovery    │
      │ Pack files   │                    │ Diffs        │
      └──────────────┘                    └──────────────┘
```

The organizing principle: every product feature should sit on top of the
same mechanical core rather than reimplementing its own logic.

```text
DM Dashboard         → Application Mutation API + CombatState
Wild Shape           → Entity FormState
Homebrew Builders     → Content Definitions + shared Feature Editor
Pack Sharing          → Content Registry + Pack serialization
Explainability        → ResolvedValue traces
Manual stat edits     → Override layer
Favorites             → Application preference state
Multiclassing         → Progression sources
Dice Roller           → RollRequest + roll log
Undo                  → Application-owned snapshots (see MUTATION_UNDO_TIMELINE.md)
Mechanical timeline    → Application-owned log (see MUTATION_UNDO_TIMELINE.md)
Temporary buffs        → TemporaryEffectInstance
Rest preview / what-if → Simulation
Homebrew test mode      → Simulation + a scratch Entity
Encounter templates      → Content → spawn Entities
Party overview            → Application query over synced Entities
Ruleset compatibility      → Content validation
```

## 3. Core domain types

### Entity — the unified runtime model

`Entity` is the runtime truth for anything that participates in rules —
player character, monster, NPC, companion, or summon — so combat, effects,
and resources don't need separate engines per kind:

```ts
type Entity = {
  id: EntityId;
  rulesetId: RulesetId;
  kind: EntityKind;

  identity: EntityIdentity;
  baseStats: StatMap;

  progression?: ProgressionState;

  features: FeatureInstance[];
  resources: ResourceState[];
  conditions: ConditionInstance[];
  temporaryEffects: TemporaryEffectInstance[];

  inventory: ItemInstance[];
  choices: ChoiceSelection[];
  overrides: OverrideLayer[];

  runtime: RuntimeState;
};

type EntityKind = "character" | "monster" | "npc" | "companion" | "summon";
```

Player Character, Monster, Wild Shape, Companion, Summon, and NPC all use
exactly the same runtime model; differences come from how the `Entity` is
constructed, not from separate combat engines.

### Feature — the bridge between content and mechanics

```ts
type FeatureDefinition = {
  id: string;
  name: string;
  description?: string;

  effects: Effect[];
  abilities: AbilityDefinition[];
  resources: ResourceDefinition[];
  grants: Grant[];
  choices: ChoiceDefinition[];

  activeWhen?: Predicate;
};
```

Race trait, class feature, feat, item property, condition, spell effect,
and monster trait should all eventually produce a `Feature` (or its
`Effect`/`Ability`/`Grant`/`Resource` parts) — this is the single most
important design choice in the whole proposal.

### Effect — passive mechanical state

```ts
type Effect =
  | StatModifierEffect
  | DefenseEffect
  | ProficiencyEffect
  | MovementEffect
  | SenseEffect
  | DamageResponseEffect
  | RollModifierEffect
  | CapabilityEffect
  | RuleOverrideEffect;
```

e.g. `+2 Strength`, `+10 ft movement`, `Fire Resistance`,
`Darkvision 60 ft`, `Advantage on Wisdom saves vs fear`,
`Cannot be surprised`, `Critical range 19-20`. This is where the existing
trait compiler evolves.

### AbilityDefinition — active mechanics

Unifies weapon attacks, monster attacks, spells, class abilities, racial
abilities, item activations, healing abilities, and reactions into one
shape:

```ts
type AbilityDefinition = {
  id: string;
  name: string;

  activation: ActionCost;
  availability?: Predicate;
  target?: TargetDefinition;
  resolution?: ResolutionDefinition;
  effects: AbilityEffect[];
  resourceCost?: ResourceCost;
  tags?: string[];
};
```

```text
Second Wind        Longsword Attack        Fireball
 Bonus Action        Action                  Action
 Spend 1 use          Target in 5 ft          20 ft sphere
 Heal 1d10+lvl        Attack roll             DEX save, 8d6 fire, half on save
```

### ResourceDefinition — every expendable capacity, one framework

```ts
type ResourceDefinition = {
  id: string;
  name: string;
  capacity: CapacityDefinition;
  recharge: RechargeDefinition;
};

type ResourceState = {
  resourceId: string;
  current: number;
  maximum: number;
};
```

Rage, Ki, Sorcery Points, Action Surge, Second Wind, Wild Shape uses, item
charges, monster recharge abilities, spell slots, and Hit Dice don't need
identical shapes, but should share this conceptual system.

### Conditions vs. Temporary Effects — deliberately split

**Conditions** are known, reusable named state (Poisoned, Prone, Frightened,
Restrained, Stunned):

```ts
type ConditionDefinition = {
  id: string;
  name: string;
  effects: Effect[];
};

type ConditionInstance = {
  definitionId: string;
  sourceId?: EntityId;
  duration?: DurationState;
};
```

**Temporary effects** are ad hoc or sourced runtime effects (Bless, Haste,
Shield of Faith, a potion buff, an environmental penalty, a temporary
curse) that shouldn't become permanent `Feature` instances or get abused
through DM Override:

```ts
type TemporaryEffectInstance = {
  id: string;
  name: string;
  sourceId?: EntityId;

  effects: Effect[];
  duration?: DurationState;
  concentration?: ConcentrationLink;
};
```

This is currently a real gap — the engine models rounds-based durations and
ticks them, but there's no first-class runtime object for "Bless is active,
7 rounds remaining" separate from a permanent Condition.

### Duration and trigger framework

Reusable, structured durations so conditions, temporary effects, spells,
and monster abilities all share one system instead of each rolling their
own:

```ts
type DurationDefinition =
  | { kind: "rounds"; count: number }
  | { kind: "minutes"; count: number }
  | { kind: "until_turn_start"; entity: EntityId }
  | { kind: "until_turn_end"; entity: EntityId }
  | { kind: "until_rest"; rest: "short" | "long" }
  | { kind: "concentration" }
  | { kind: "permanent" };
```

A small **closed** trigger set — not a scripting language — lets
mechanics progressively automate without an expression VM:

```ts
type Trigger =
  | "turn_start" | "turn_end" | "on_hit" | "on_damage"
  | "on_critical" | "on_failed_save" | "short_rest" | "long_rest";
```

### Overrides — transform the result, never the source

```ts
type OverrideLayer = {
  id: string;
  label: string;
  source: "dm" | "player" | "campaign";
  target: DerivedTarget;
  mode: "set" | "add" | "remove";
  value: unknown;
  active: boolean;
};
```

```text
Base Entity
    ↓
Features / Equipment / Conditions
    ↓
Temporary Effects
    ↓
Campaign Rules
    ↓
DM Overrides
    ↓
Final Derived State
```

If a manual edit is really a permanent character change, it should update
the actual feature/content. If it's session-specific, it should become a
temporary effect or an override — the UI can ask "Apply as: permanent
character change / temporary effect / DM override?" instead of exposing
one generic "edit."

### Explainability

Already built (`src/engine/audit.ts`'s `explainValue()`, surfaced through
`AuditModal`), but the proposal frames it as a formal type so every derived
stat carries its trace, not just AC/saves/skills:

```ts
type ResolvedValue<T> = {
  value: T;
  contributions: Contribution[];
};
```

```text
AC 18
10 Base
+3 Dexterity
+3 Mage Armor
+2 Shield
```

### Simulation / preview

Because the core is pure, simulation is close to free:

```ts
simulateCommand(entity, command) => { before, after, diff, explanations }
```

```text
Equip Plate Armor
AC       15 → 18
Speed    30 → 20
Stealth  normal → disadvantage
```

The same infrastructure powers: level up, take feat, equip item, apply
condition, long rest, use ability, apply buff, change house rule.

### Combat state

Combat should hold coordination state, not duplicate `Entity` mechanics:

```ts
type CombatState = {
  id: string;
  participants: Combatant[];
  initiative: InitiativeState;
  round: number;
  activeTurn: number;
  eventLog: DomainEvent[]; // see note in §7 — superseded, use the Timeline design instead
};

type Combatant = {
  entityId: EntityId;
  initiative: number;
  team: string;
  turnState: TurnState;
};
```

`Entity` keeps holding HP, conditions, resources, features, inventory, and
temporary effects. Combat only tracks who's participating, whose turn it
is, and what round it is.

### Action economy — ruleset-defined

```ts
type ActionEconomyDefinition = {
  turnResources: ActionResourceDefinition[];
};
```

5e: Action / Bonus Action / Reaction / Movement. PF2e: 3 Actions / Reaction.
4e: Standard / Move / Minor / Immediate. Abilities consume whatever the
active ruleset defines. **Already correctly deferred** to the PF2e
milestone in the ruleset-generalization plan — 5.5e uses 5e's economy
as-is.

### Wild Shape / alternate forms

Model as an entity overlay, not bespoke branching scattered through the
app (a real bug already came from special-casing Wild Shape on the DM
side — see the bugfix-audit history):

```ts
type FormState = {
  formDefinitionId: string;
  temporaryStats: StatOverlay;
  formHp: { current: number; max: number };
  grantedFeatures: FeatureInstance[];
};
```

Damage resolution: if a form is active, damage hits `formHp` first — the
DM/player UI just sends a damage command; the engine decides which pool is
active, so callers never special-case Wild Shape themselves.

### Multiclassing

```ts
type ProgressionState = {
  sources: ProgressionSourceState[];
};
```

Each class contributes features, choices, resources, proficiencies, and
spell progression independently; shared systems derive total level,
combined slots, proficiency bonus, and hit dice. Pact slots remain a
separate resource model. (The existing engine's `multiclass.ts`/
`levelUpClass` is already close to this shape — likely a consolidation, not
a rewrite.)

## 4. Content authoring platform

### Common content metadata

```ts
type ContentMeta = {
  id: string;
  rulesetId: string;
  name: string;
  description?: string;
  source?: string;
  tags?: string[];
  version: number;
};

type FeatDefinition = ContentMeta & { /* ... */ };
type ItemDefinition = ContentMeta & { /* ... */ };
type SpellDefinition = ContentMeta & { /* ... */ };
```

### Versioning

Version definitions, not runtime instances:

```ts
type ContentReference = {
  rulesetId: string;
  type: string;
  id: string;
  version: number;
};
```

A content update can then produce a mechanically intelligent diff, not a
raw JSON diff:

```text
Version 1.2 → 1.3
Damage:    1d8 → 1d10
Uses:      2 → proficiency bonus
Recharge:  Long rest → Short or Long rest
Added:     Resistance to fire
```

And a character using a stale version gets notified with the option to
keep it, preview the new version, or update.

### Homebrew packs and campaign content layer

```text
Global Homebrew
      ↓
Campaign Content
      ↓
Character choices
      ↓
Temporary state
      ↓
DM override
```

A pack contains metadata, `rulesetId`, content definitions, dependencies,
and a version; it's a distribution unit. Runtime content loads into a
`ContentRegistry` so the app doesn't care whether content came from the
official pack, homebrew, a campaign pack, or an import. Campaign-only
content (a region-specific sword, a faction feat, a session curse)
shouldn't pollute the user's global library unless explicitly promoted.

### Homebrew test mode

One of the strongest ideas in the proposal, and cheap once Simulation
exists — point the same before/after diff primitive at a disposable
scratch `Entity`:

```text
Testing: Dragon Skin
BEFORE                    AFTER
AC 15                     AC 16
Fire Resistance: No       Fire Resistance: Yes
```

### Content validation

Three layers, not just schema validation:

```text
Schema Validation → Reference Validation → Semantic Validation

✓ valid JSON shape
✓ referenced spell exists
✓ referenced stat exists
✗ choice asks for 3 selections but pool only has 2
⚠ resource has no recharge specified
```

### Dependency viewer and broken-reference recovery

Before deleting shared content, show what uses it:

```text
Feature: Arcane Recovery
Used by: Wizard, Wizard Template, Homebrew Class: Magister, Campaign: Ashfall
```

If content disappears (a pack removed, a homebrew item deleted), don't
silently drop references — surface it and offer a resolution, using the
same snapshot/versioning infrastructure:

```text
Shadow Lance
⚠ Source missing
Snapshot available
[ Restore ]  [ Replace ]  [ Keep frozen copy ]
```

### Content library

A full searchable reference (classes, subclasses, races, backgrounds,
feats, spells, items, conditions, monsters) with search, filtering by
ruleset/source/tags, and per-entry mechanical breakdowns showing both
readable rules text and what the engine actually understands:

```text
SECOND WIND
Fighter 1
Activation: Bonus Action
Resource: 1 use, recharge short or long rest
Mechanical effect: Heal 1d10 + Fighter level
```

Currently fragmented per screen (creation flow, homebrew tab, DM monsters
tab) with no single cross-type compendium and no browse UI for conditions
at all.

## 5. Data portability

Three deliberately distinct mechanisms — already correctly separated in
the current codebase (`ExportFormatSheet`, `backup.ts` content-pack export,
`backup.ts` full-installation backup):

```text
Character Export     one entity, possibly snapshots — PDF/TXT/MD are
                      presentation exports, not authoritative restore formats
.grimoire-pack        shareable content, no personal runtime state
Full Backup            everything: characters, campaigns, homebrew,
                       settings, history
```

## 6. Multiplayer and permissions (DM-scoped, deferred)

Keep the existing diff-based LAN sync initially rather than moving to
command replay:

```text
Command → Entity change → deep diff → LAN
```

Establish clear per-domain ownership to reduce conflicts (Character X →
owning player device is authoritative; Combat and Campaign → DM device is
authoritative). Use capability-based permissions instead of scattered
`if (isDM)` checks:

```ts
type Permission =
  | "entity.view" | "entity.edit.self" | "entity.edit.any"
  | "combat.manage" | "damage.apply" | "condition.apply"
  | "override.apply" | "campaign.edit" | "content.edit";
```

Roles (Owner / Player / DM / Spectator) resolve into permissions rather
than being checked directly. **All of this — plus party overview,
encounter groups/templates, session handoff, campaign archive, and
player-to-DM requests — is explicitly out of scope until the C++ port**,
per the product-vision deferral. It's documented here so the design isn't
lost, not because it's scheduled.

## 7. Note on an earlier draft of this document

An earlier iteration of this proposal described mutations as flowing
through a formal `Command` → dispatcher → `DomainEvent` → reducer pipeline,
with every state change (`DamageEntityCommand`, `UseAbilityCommand`,
`ApplyConditionCommand`, etc.) modeled as a command producing typed domain
events, feeding undo, history, and sync uniformly. That was reconsidered:
it's a full CQRS/event-sourcing rewrite of engine files that already work
today (`combat.ts`, `conditions.ts`, `rest.ts`, `leveling.ts`), which is
more generalization than this project needs right now. **The current
design for mutation, undo/redo, and the mechanical timeline is in
[MUTATION_UNDO_TIMELINE.md](MUTATION_UNDO_TIMELINE.md)** and should be
treated as superseding this section — it keeps the engine's existing
`Entity → Entity` functions untouched and puts history/undo entirely in
the application layer instead.
