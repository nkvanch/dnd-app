# 05 — Architecture Decisions

These are **structural decisions**: how responsibilities are divided between classes, where
variation is allowed to live, and what the system's joints are. They are grouped here rather
than scattered through the other documents because they only make sense together — each one
assumes the others.

**These are stated as decisions, not questions.** That is deliberate. Product questions
(what the app is for, what is in v1, how much of the long tail to cover) remain yours and are
in `03-questions-for-author.md`. These are engineering questions where the cost of being
wrong is a rewrite, and where the right answer follows from the constraints rather than from
taste.

**Please disagree explicitly where you disagree.** Every entry carries its reasoning
precisely so that it can be argued with. Silent disagreement is the worst outcome: the
documents would then describe a system that does not exist.

Each entry states its **reversibility** — how expensive it is to change later. Positions here
are held firmly in proportion to that cost, not in proportion to confidence.

---

## 0. How the decisions fit together

```
                         A-01  Rules = polymorphic modules
                                (the spine)
                                      │
              ┌───────────────────────┼───────────────────────┐
              │                       │                       │
       A-02 Entity is data      A-03 Open shapes        A-04 Answer records
       (no behaviour)           (maps, not fields)      (the layer boundary)
              │                       │                       │
              │                       │                       │
       ┌──────┴──────┐         ┌──────┴──────┐         ┌──────┴──────┐
       │             │         │             │         │             │
  A-06 Commands  A-13 Multi-  A-07 Closed  A-10 Feature  A-05 Derived  A-15 Issues
  + events       entity core  grammar      addressable   + traced      as data
       │             │             │             │             │
       │             │        A-08 Triggers      │        A-09 Pipeline
       │             │             │             │             │
       └─────────────┴─────────────┴──────┬──────┴─────────────┘
                                          │
                        ┌─────────────────┴─────────────────┐
                        │                                   │
                A-11 Storage shape                  A-12 Versioning
                (envelope + body)                   (pin + snapshot)

              A-14 Explicit composition — cuts across all of the above
              A-16 Homebrew is content — a consequence of A-10 and A-11
```

Reading the diagram: **A-01 is the spine.** A-02, A-03 and A-04 are the three faces of the
same idea — behaviour, data and boundary. Everything below them is a consequence.

---

## A-01 — Rules live in polymorphic modules; the ruleset is a class, not a record

**Class:** Engineering
**Reversibility:** very low — changing this later touches persistence, sync and every screen

### Problem

Different game systems differ structurally, not just numerically (`01`, P1). Something has to
absorb that variation. Where?

### Options considered

| Option | Assessment |
|---|---|
| **(a) Hardcode 5e, branch later** | Produces `if RulesetId = 'dnd5e' then ... else if ...` in dozens of places. Each new system multiplies the branches. Rejected. |
| **(b) Overloaded procedures** | Overload resolution happens at **compile time**; the ruleset is known only at **run time**. Necessarily degenerates into (a). Rejected. |
| **(c) Everything as data + an interpreter** | Ends in a scripting VM — explicitly refused in `Dos and don'ts.md`, and correctly. Also the hardest thing in the project to debug. Rejected. |
| **(d) Abstract class with virtual methods, one subclass per system** | Dispatch resolved once, at load. Each system is plain, direct code in its own file. **Chosen.** |

### Decision

```pascal
type
  TRulesetModule = class abstract
  public
    function StatModifier(Score: Integer): Integer; virtual; abstract;
    function ProficiencyFor(E: TEntity; const Skill: TSkillId): TResolvedValue; virtual; abstract;
    function OutcomeSpace: TArray<TOutcomeId>; virtual; abstract;
    function ResolveAttack(const Ctx: TAttackContext): TOutcomeId; virtual; abstract;
    function ResolveSave(const Ctx: TSaveContext): TOutcomeId; virtual; abstract;
    function RecomputeDerived(E: TEntity; C: TContentRegistry): TDerivedStats; virtual; abstract;
    function DescribeSheet(E: TEntity): TArray<TStatGroup>; virtual; abstract;
    function ValidateBuild(E: TEntity): TArray<TIssue>; virtual; abstract;
  end;
```

**Target size: 10–15 methods.** If it grows past that, the extra variation belongs in content
data instead. A 200-method interface would mean 200 overrides per new system, which is the
same as having no abstraction.

### Role in the system

This is the **spine**. It is the single answer to "where do game constants live" (INV-14),
and every other decision here either supports it or follows from it:

- A-02 exists so that this class, not the Entity, carries behaviour
- A-03 exists because polymorphism alone cannot vary *stored shape*
- A-04 exists so the UI talks to this class through a stable contract

### If ignored

The 5e rules disperse into the codebase. The multi-system goal becomes unreachable, and this
is only discovered after 5e is finished — the most expensive possible moment.

### Backing out

If this turns out to be over-engineering (only 5e is ever wanted), the cost is one extra
indirection — a single class with one implementation. That is a trivial penalty. The
asymmetry is the point: being wrong in this direction is cheap; being wrong in the other
direction is a rewrite.

---

## A-02 — Entity is data. It has no behaviour and no ruleset subclasses

**Class:** Engineering
**Reversibility:** very low
**Depends on:** A-01

### Problem

Where do methods live — on the character, or outside it?

### Options considered

| Option | Assessment |
|---|---|
| **(a) `TDnd5eCharacter = class(TCharacter)`** | The instinctive answer, and wrong here. Three reasons below. Rejected. |
| **(b) Entity as a plain record; rules in a separate service** | **Chosen.** This is the Strategy pattern. |

Why (a) fails specifically:

1. **Entities are serialised.** Reading one back requires knowing which class to construct
   *before* having read it. Every save file, export and (in v2) network message hits this.
2. **Combinatorial growth.** Each ruleset needs a subclass for *every* entity kind —
   Character, Monster, NPC, Companion, Summon. Two systems, five kinds, ten classes.
3. **Generic tooling breaks.** Backup, export, diff, search and migration all have to
   downcast. The polymorphism leaks out of the place it was meant to be contained.

### Decision

```
TEntity        = data.      No behaviour, no inheritance, fully serialisable.
TRulesetModule = behaviour. Abstract base + overrides.
```

The character is never asked to do anything. It is **passed to** the rules object:

```pascal
Bonus := Ruleset.ProficiencyFor(Character, 'stealth');
```

### Role in the system

This is what makes A-06 (commands), A-11 (storage), A-12 (versioning) and v2 sync possible at
all. A polymorphic entity would compromise every one of them. It is also what keeps INV-5
(purity) achievable: a data record has no hidden state to mutate.

### If ignored

Serialisation becomes a permanent source of bugs, and every generic feature — backup,
export, undo, diff, sync — has to be written once per ruleset.

### Backing out

Cheap in one direction only: helper methods can always be added to a data record later.
Removing inheritance after the fact is a rewrite of the persistence layer.

---

## A-03 — Stored shapes are open: maps keyed by typed IDs, not fixed fields

**Class:** Engineering
**Reversibility:** very low — every content pack depends on it
**Depends on:** A-01

### Problem

A-01 handles *behaviour* that differs between systems. It does nothing for *stored shape*.
No amount of method overriding turns

```pascal
SkillProficient: array of Boolean;      // 5e
```

into PF2e's five-level rank or 3.5's integer ranks. This is a separate problem needing a
separate remedy.

### Options considered

| Option | Assessment |
|---|---|
| **(a) Fixed fields, one entity subclass per system** | This is A-02(a), already rejected. |
| **(b) One opaque blob per ruleset** | Maximum flexibility, but backup, diff, sync, search and migration must then be written per ruleset instead of once. Rejected. |
| **(c) Generic structure; the ruleset supplies meaning** | **Chosen.** |

### Decision

Store one general shape; let the ruleset interpret the values.

```pascal
TEntity = class
  RulesetId:     string;
  Stats:         TDictionary<TStatId, Integer>;
  Proficiencies: TDictionary<string, Integer>;   // ruleset interprets the value
  // ...
end;
```

`Proficiencies['skill:stealth'] = 2` means expertise in 5e, expert rank in PF2e, two ranks in
3.5. **One stored shape, three interpretations.**

The same principle everywhere:

```
// locks in 5e                        // stays open
StatBlock { Str, Dex, ... }           StatBlock { Stats: Map<StatId, Integer> }
DerivedStats { AC, Initiative }       DerivedStats { Defenses: Map<DefenseId, ResolvedValue> }
onHit / onMiss                        Outcomes: Map<OutcomeId, [Effect]>
Proficient: Boolean                   Proficiency: Integer (ruleset-interpreted)
Active: Boolean                       Stacks: Integer                        (F-11)
```

Type safety is preserved by **typed IDs** — `TSkillId` is not `TStatId` — not by having a
named field per concept.

Note: `Derived stats.md` in the vault **already reaches this conclusion independently**, with
the reasoning spelled out. The decision here is only to apply it consistently everywhere else.

### Role in the system

The data-side complement to A-01. Together they cover the whole variation surface:
polymorphism for behaviour, open shapes for data. Neither alone is sufficient — PF2e's
archetype-based multiclassing, for example, is not fixable by any virtual method; it needs
progression to be a general list of grants and choices (`F-32`).

### If ignored

The content model is 5e-shaped. Adding a second system means rewriting every pack and every
screen — which in practice means the second system never arrives.

### Backing out

Cheap. Concrete accessors can be layered over a map at any time
(`function Str: Integer; begin Result := Stats['str']; end;`). The reverse — widening fixed
fields into maps once packs are authored — is a data migration across everything.

---

## A-04 — The layer boundary is the shape of the answer, not the shape of the data

**Class:** Engineering
**Reversibility:** low
**Depends on:** A-01

### Problem

How does the UI stay independent of the ruleset? 5e has one defence (AC) and six saves; 4e has
four defences; PF2e has three saves plus Perception. A screen written against 5e's shape is a
5e screen.

### Options considered

| Option | Assessment |
|---|---|
| **(a) UI reads entity fields directly** | Every screen becomes ruleset-specific. Rejected. |
| **(b) Generic query channel: `function Ask(Q: string): Variant`** | Looks flexible; only relocates the problem. Type checking disappears and the branching reappears in the UI as string comparison — worse, because the compiler no longer helps. Rejected. |
| **(c) A small set of concrete, typed answer records** | **Chosen.** |

The reasoning for (c) over designing the interface from the rules upward: rules differ
endlessly between systems, so a bottom-up interface grows with every system added. **The
questions do not change.** The UI always needs "what is my AC", "what can I do", "what
happened" — in every system.

### Decision

Six answer types form the entire contract between the rules and everything above them:

```pascal
TResolvedValue   = record Value; Contributions: TArray<TContribution>; Display: string; end;
TStatGroup       = record Id, Caption: string; Entries: TArray<TStatEntry>; end;
TAvailableAction = record Id, Name, CostCaption; Enabled; DisabledReason; Outcomes; end;
TCommandResult   = record Entity; Events: TArray<TDomainEvent>; Issues: TArray<TIssue>; end;
TPendingChoice   = record Id, Prompt; Min, Max: Integer; Options; end;
TIssue           = record Severity; Message, Origin: string; end;
```

The load-bearing one is `DescribeSheet: TArray<TStatGroup>` — the ruleset tells the UI *what
to show*, and the UI draws groups without knowing how many there are or what they are called.

**Important qualification.** The rule is **not** "the UI must be generic" — a fully
descriptor-driven UI is a pile of featureless tables, and a 5e player wants the familiar
sheet. The rule is **"the UI reads only these answers"**. v1 can have a hand-laid-out,
attractive 5e sheet, as long as every number on it comes from a `TResolvedValue` rather than
from an entity field. Adding a generic mode later is then an evolution, not a rewrite.

### Role in the system

This is the **boundary** in the architecture: general in the middle, concrete on both sides.

```
   CONCRETE                 GENERAL                  CONCRETE
   Dnd5eRuleset      →   6 answer records   →   the 5e sheet screen
   plain 5e code           the only              laid out by hand
   no abstraction        general part
```

Measurable consequence: **adding a ruleset must not require editing a single UI file**
(INV-28). That is a testable claim, not an aspiration.

### If ignored

Every screen has to be rewritten per system, which is where most of the work in this app
actually lives.

---

## A-05 — Derived state is computed, never stored, and every value carries its trace

**Class:** Engineering
**Reversibility:** medium
**Depends on:** A-01, A-03

### Problem

Where does AC live? It depends on armour, Dexterity, spells, features, conditions and items,
any of which can change at any moment.

### Options considered

| Option | Assessment |
|---|---|
| **(a) Store it, invalidate on change** | Requires knowing every path that could affect it. Missing one produces a stale value that looks correct. This is the classic cache-invalidation bug and it is very hard to find. Rejected. |
| **(b) Compute on demand, pure function** | **Chosen.** |
| **(c) Compute + memoise** | The same as (b) plus a cache keyed on entity version. Deferred — see below. |

### Decision

```
recomputeDerived(Entity, Content, Ruleset) -> DerivedStats     // pure
```

`DerivedStats` is **never persisted** (INV-4). The function performs no I/O, reads no clock
and generates no randomness — the RNG is passed in (INV-15).

Every number in it is a `TResolvedValue` carrying its contributions, and **the contributions
sum to the value** (INV-6) — one line of test code that guards the entire effect system.

**On performance.** A character carries on the order of 50–200 effects; recomputation is
microseconds. If profiling later shows a problem, memoisation (c) can be added **without
changing the contract**, because purity means the result is a function of the inputs. This is
the reason the decision is only medium-reversibility rather than low: the optimisation door
stays open.

### Role in the system

Three things rest on this: correctness (no stale values), explainability (the product
differentiator from `01`, 2.4), and testability (INV-5, INV-6, INV-7 are all only checkable
because the function is pure). It is also, in practice, the debugging backbone — a wrong AC
comes with the list of contributions that produced it.

### If ignored

Numbers silently go stale. Since the error depends on which sequence of events occurred, it
is close to unreproducible.

---

## A-06 — All state change flows through Commands that return a new state plus events

**Class:** Engineering
**Reversibility:** low — retrofitting means rewriting the UI layer
**Depends on:** A-02

### Problem

How does anything change? The UI has a "take damage" button; what happens between the button
and the stored character?

### Options considered

| Option | Assessment |
|---|---|
| **(a) UI mutates the entity directly** | Fastest to write. No undo, no audit, no sync, no testable seam. Rejected. |
| **(b) Command in, `(new state, events)` out** | **Chosen.** |
| **(c) Full event sourcing** | State rebuilt from an event log. Powerful, but a large amount of machinery and a permanent migration burden for a solo project. The vault already rejects this in `Events.md`, correctly. Rejected. |

### Decision

```
Command  →  core operation  →  (new Entity, DomainEvent[], Issue[])
```

Domain events are a **record of what happened**, not the source of truth (INV-19).

The state requirement is *logical*: after a command, the previous state is still reachable.
Whether that is a persistent data structure, copy-on-write, or a plain copy is an
implementation choice that depends on the language. An entity is 5–30 KB, so a full copy per
command is not a performance concern.

### Role in the system

This is the seam where **four separate features attach**, each of which would otherwise cost
its own architecture:

| Feature | How it attaches |
|---|---|
| **Undo** | A bounded stack of previous entities |
| **Combat log** | The event stream, already produced |
| **v2 sync** | Commands *are* the natural network message — small, intentional, replayable |
| **Testing** | `apply(command, state)` is a pure function to assert against |

Building this once yields all four. Building it later means retrofitting all four.

### If ignored

v2 (DM tools, sync — decision D1) becomes a rewrite rather than an addition, which defeats
the stated intent of building v1 so that v2 slots in.

---

## A-07 — Effects are a closed union; the expression language is closed and non-Turing-complete

**Class:** Engineering
**Reversibility:** medium for the union, low for the grammar (it defines the pack format)

### Problem

`Dos and don'ts.md` forbids an expression VM. But `Effects.md` already contains
`"formula": "10 + dex_mod + con_mod"`, plus `DiceExpression`, `Heal(1d10 + fighterLevel)` and
`+1d6 / slot level`. **An evaluator is already required.** The open question is how much power
it gets.

### Options considered

| Option | Assessment |
|---|---|
| **(a) Numbers only, no expressions** | Cannot express Unarmored Defense or any level-scaling feature. Not viable. |
| **(b) A general scripting language** | Solves everything and cannot be un-shipped: it becomes an attack surface, an untestable region, and a permanent compatibility obligation. Rejected — and the vault rejects it too. |
| **(c) A closed, non-Turing-complete expression AST** | **Chosen.** |

### Decision

A fixed grammar, validated at pack load:

```
Expression :=
    Integer
  | Dice            NdM  (with explicit keep-highest / keep-lowest)
  | Reference       stat score | stat modifier | class level | character level
                  | proficiency bonus | resource current | resource maximum | slot level
  | Expression (+ | - | * | div) Expression
  | min(Expression, Expression) | max(Expression, Expression)
  | floor(Expression) | ceil(Expression)          -- rounding is always explicit
```

**Not in the grammar:** branching, loops, user-defined functions, assignment, comparison.
(Comparison lives in `Predicate`, which is a separate closed union — one mechanism, not two.)

Effects remain a tagged union, as `Effects.md` already proposes:

```
Effect = NumericEffect | ProficiencyEffect | AdvantageEffect | ResistanceEffect
       | CapabilityEffect | RollModifierEffect | RuleOverrideEffect
```

### Role in the system

This is the line between **data anyone may author** and **code we write**. It is what makes
homebrew safe (A-16): an untrusted pack cannot loop, cannot call out, cannot fail to
terminate. It is also what makes `Dos and don'ts.md` and `Effects.md` consistent with each
other, which today they are not.

### If ignored

Either the model cannot express real content, or the escape hatch quietly becomes a scripting
language — at which point homebrew becomes a security and stability problem and the grammar
can never be narrowed again.

---

## A-08 — Triggers are first-class, sharing the domain event bus

**Class:** Engineering
**Reversibility:** low once content is authored
**Depends on:** A-06, A-07

### Problem

A large share of content reacts to events rather than being used on a turn: Sneak Attack,
Divine Smite, reactions, concentration checks, "at the start of your turn" (`F-15`). Nothing
in the vault can express this (`01`, P2).

### Options considered

| Option | Assessment |
|---|---|
| **(a) Hardcode each case** | Exactly what `Feats.md` forbids, and it does not scale past a few dozen. Rejected. |
| **(b) Scripting** | Rejected by A-07. |
| **(c) Declarative triggers + manual toggles as escape hatch** | **Chosen.** |

### Decision

```
TriggeredActivation {
    when:      EventFilter     // OnHit, OnDamageTaken, OnTurnStart, OnLeaveReach, OnRest...
    condition: Predicate       // reuses the existing Predicate union
    cost:      ActionCost      // Reaction | free | none
    resourceCost
    limiter:   OncePerTurn | OncePerRound | PerRecharge     // F-16 — three distinct kinds
    outcomes:  Map<OutcomeId, [Effect]>
}
```

Plus **manually toggled features** for content that resists declaration — the player switches
an effect on. Both are needed: triggers for the common cases, toggles for the long tail.

### Role in the system

This is the piece that connects `Events` (A-06) to `Content`. Without it those two are
unrelated, and the app cannot represent Rogues, Paladins, reactions or concentration —
meaning several whole classes are unplayable.

It also completes A-06's justification: the event stream is not only a log, it is the
mechanism content hooks into. One bus, two uses.

### If ignored

Every reactive feature becomes a hardcoded exception in the engine.

---

## A-09 — Effect resolution is a deterministic, ordered pipeline; stacking rules belong to the ruleset

**Class:** Engineering
**Reversibility:** medium
**Depends on:** A-01, A-05
**Rests on facts:** `F-03`, `F-04`, `F-05`, `F-12`

### Problem

Fifty effects apply to one character. Combining them is not addition (`01`, P3).

### Options considered

| Option | Assessment |
|---|---|
| **(a) Sum everything** | Wrong for competing AC formulas, advantage, and resistance. Not viable. |
| **(b) Each effect declares how it combines** | Content authors then own correctness, and homebrew breaks the rules by accident. Rejected. |
| **(c) Ordered pipeline; the ruleset owns the combination rules** | **Chosen.** |

### Decision

```
1. setBase candidates      →  one winner, by a ruleset-defined rule
2. typed bonuses           →  combined per BonusTypeModel (5e: mostly stack; PF2e: highest per type)
3. untyped bonuses         →  sum
4. minimums / floors       →  setMinimum
5. multipliers             →  resistance, vulnerability
6. clamps
7. rounding                →  direction always explicit
```

Plus a `BonusTypeModel` in the ruleset, and — critically — **collection order must not affect
the result** (INV-7). Sort collected effects by a stable key `(origin, index)`.

**One point needs your confirmation.** In 5e, when several base-AC formulas apply, does the
player *choose* which to use, or does the highest automatically win? Apps generally take the
highest; the rules as written appear to let the player choose. This is why the selection rule
belongs to the ruleset rather than being hardcoded — but the default behaviour depends on your
answer (`F-04`, `F-05`).

### Role in the system

This is the correctness core. A-05 guarantees values are fresh; A-09 guarantees they are
*right*. INV-6 (contributions sum to value) and INV-7 (order independence) are both statements
about this pipeline, and both are directly testable — INV-7 by shuffling the effect list and
asserting an identical result.

### If ignored

Numbers are subtly wrong in ways that depend on which effects happen to be present, and if
order is not stabilised, **the same character produces different AC on different runs**.

---

## A-10 — Feature is a first-class, addressable entity, not an embedded fragment

**Class:** Engineering
**Reversibility:** low — content already authored would need IDs assigned retroactively

### Problem

Features appear inside Class, Species, Background, Feat, Item and Monster — an estimated
1,500–2,500 of them. Embedded documents or standalone records?

### Options considered

| Capability | Embedded | Own record with an ID |
|---|---|---|
| "Where does Darkvision appear?" | impossible | yes |
| Effect origin tracing (INV-9, INV-10) | weak | yes |
| Homebrew referencing an official feature | no | yes |
| Opening "Action Surge" as its own page | no | yes |

### Decision

Feature is a first-class record with an ID. Anonymous inline features receive a **synthesised
ID at pack build time**, so authors are not forced to name everything, and identity still
exists.

### Role in the system

`Origin` (INV-9, INV-10) is what makes explanation traces meaningful — "+2 AC *from Shield of
Faith*" rather than "+2 AC". Without addressable features, A-05's traces degrade to anonymous
numbers, and removing a source cannot reliably remove what it granted.

It is also the precondition for A-16: homebrew can only extend or reference official content
if that content has stable identity.

---

## A-11 — Content storage: envelope in columns, mechanical body as a document

**Class:** Engineering
**Reversibility:** medium — migration is possible but touches everything

### Problem

Content is structurally very variable (a spell's body ranges from three fields to deeply
nested outcome trees), yet must be searchable and filterable.

### Context that changes the usual answer

| Measure | Size |
|---|---|
| Content records (SRD 5e) | ~1,200–1,500 |
| Total content size | **3–8 MB** |

In a typical business system the problem is volume. **Here it is the opposite** — the entire
content set fits in a phone's memory. The database is therefore not a performance tool; it is
a tool for uniformity, integrity and versioning.

### Options considered

| Option | Assessment |
|---|---|
| **(a) Full normalisation** | Dozens of tables for structures that are never queried relationally. High cost, no benefit. Rejected. |
| **(b) Everything as documents** | No indexing for search or filtering, which the Content Browser needs. Rejected. |
| **(c) Hybrid** | **Chosen.** |

### Decision

| | Contents | Variability | Used for |
|---|---|---|---|
| **Envelope** — columns | id, rulesetId, contentType, name, source, tags, version | zero | SQL search, filter, sort |
| **Body** — serialised document | the mechanical definition | very high | never queried; loaded whole |

Consequences:

- **The whole registry loads into memory at startup.** No lazy loading, no cache, no query
  optimisation — a significant amount of architecture that simply is not needed.
- **Foreign keys cannot enforce integrity.** Content spans pack files; a feat in pack A may
  reference a feature in pack B. Integrity is enforced by a **validation pass at pack
  install**, returning `Issue[]` (A-15).
- **Entities get a separate store.** Content is read-mostly and changes rarely; characters
  change constantly. Same envelope/body split, different table, different access pattern.

### Role in the system

This is where A-03's open shapes actually land on disk. The envelope is what lets a character
be listed and opened even when its ruleset or packs are missing (A-12, INV-25).

---

## A-12 — Versioning: pin plus snapshot; a character always opens

**Class:** Engineering
**Reversibility:** very low — once data exists in the field, it is too late

### Problem

A pack is updated, or uninstalled. What happens to characters built from it? The vault has
`ContentVersion` and mentions `Snapshots`, but states no policy (`01`, P7).

### Options considered

| Option | Assessment |
|---|---|
| **(a) No pinning** | A pack update silently changes existing characters. Rejected. |
| **(b) Pin versions only** | The character knows what it needs but cannot open without it. A deleted pack means an unopenable character. Rejected. |
| **(c) Pin + snapshot the definitions actually used** | **Chosen.** |

### Decision

A character records `(packId, version)` for every definition it references (INV-26), **and**
stores a snapshot of the definitions it actually uses. A character **always opens** — degraded
if necessary, with a list of Issues (INV-25).

Cost check: a character references perhaps 50–100 definitions; a snapshot is on the order of
100–300 KB. Against content totalling 3–8 MB, this is not a concern.

### Role in the system

This is the data-safety guarantee. It is the one decision here whose failure mode is not a bug
but **losing a user's character** — which is unrecoverable trust, not just unrecoverable data.

---

## A-13 — The core is multi-entity from day one; only the UI is single-character

**Class:** Engineering
**Reversibility:** low
**Depends on:** A-02, A-06
**Serves:** D1 — "v1 is players only, but v2 must slot in"

### Problem

v1 is a player's character sheet. v2 adds DM tools, monsters and combat. Decision D1 says v2
must attach without rework. What has to be true in v1 for that to hold?

### Decision

v1 is built as a multi-entity system that happens to show one entity.

Concretely, in v1:

| Requirement | Why |
|---|---|
| `Entity` is kind-agnostic — Character and Monster are the same type, differing by `EntityKind` | The vault already gets this right; it must not regress |
| Core functions take `Entity`, never `Character` | `applyDamage`, `takeRest`, `applyCondition` work on anything |
| `ApplicationState` holds a **collection**, not a single character | A single-entity field is the assumption that is expensive to undo |
| Commands carry an `EntityId` | Even when there is only ever one |
| Domain events carry an `EntityId` | The combat log in v2 needs it |
| No UI-layer assumption of "the current character" beyond a selection | Selection is a view concern, not a model concern |

Nothing here costs meaningful work in v1. All of it is expensive to add later.

### Role in the system

This is the concrete content of decision D1. Without it, D1 is an intention rather than an
architecture, and v2 becomes a rewrite — the failure mode D1 exists to prevent.

### Explicitly out of scope for v1

Combat state, initiative, turn order, encounters, sync. These are v2 *features*. A-13 only
requires that v1 not make them impossible.

---

## A-14 — Dependencies are passed explicitly; no global singletons

**Class:** Engineering
**Reversibility:** medium, but it degrades quietly
**Cuts across:** everything

### Problem

`ContentRegistry`, `RulesetModule` and the RNG are needed almost everywhere. The convenient
answer is a global.

### Decision

They are passed in. No global mutable state anywhere in Core.

```pascal
function RecomputeDerived(E: TEntity; C: TContentRegistry; R: TRulesetModule): TDerivedStats;
```

### Reasoning

A global registry makes it impossible to hold two rulesets in memory at once — which breaks
the moment a user has a 5e character and a PF2e character side by side, and also breaks any
test that wants a fixture registry. A global RNG breaks INV-15 (purity) and therefore INV-5
(reproducibility), which makes golden tests impossible.

This is listed as a decision because it is a small convenience that is taken almost by
reflex, and each instance is individually harmless. The damage is cumulative and only
noticed when tests become impossible to write.

### Role in the system

It is the precondition for INV-5, INV-15 and every test in `04-reference.md`, Part B. It is
also what allows two rulesets to coexist — without which A-01 is theoretical.

---

## A-15 — Problems are returned as data, not raised as exceptions

**Class:** Engineering
**Reversibility:** medium — it appears in every signature

### Problem

A character references a missing pack. A feat's prerequisite no longer holds. A homebrew pack
points at a nonexistent feature. What happens?

### Options considered

| Option | Assessment |
|---|---|
| **(a) Raise an exception** | Aborts the operation. The character cannot be opened — the exact failure INV-25 forbids. Rejected. |
| **(b) Silently correct** | Deletes the user's choices without telling them. This is data loss wearing a helpful expression. Rejected (INV-21). |
| **(c) Return `Issue[]` alongside the result** | **Chosen.** |

### Decision

Validation, loading and commands all return `Issue[]` next to their result. Issues are shown
to the user; **nothing is silently repaired**.

```pascal
TIssue = record
  Severity: (isInfo, isWarning, isError);
  Message, Origin: string;
end;
```

Exceptions remain for genuine programming errors — a corrupt file, a failed assertion —
not for expected states of the data.

### Role in the system

INV-21 and INV-25 are both statements about this decision. It is what makes "the character
always opens" implementable rather than aspirational, and it is the mechanism through which
A-11's pack-install validation and A-12's missing-pack degradation report themselves.

---

## A-16 — Homebrew is content with different provenance, not a second path through the engine

**Class:** Engineering
**Reversibility:** medium
**Depends on:** A-07, A-10, A-11

### Problem

The vault contradicts itself. `Homebrew.md`: *"Official content → normal engine; Homebrew →
special override system."* `Homebrew editor architecture.md`: *"Underneath, it produces
exactly the same FeatDefinition used by official packs."*

### Decision

The second is right. Homebrew is **identical content** distinguished only by:

- `SourceBook` — where it came from
- a trust / validation flag — whether it passed pack validation
- pack precedence — which pack wins when IDs collide

There is no second code path.

### Reasoning

Two paths through the engine means every bug exists twice and every feature is implemented
twice. It also means homebrew is permanently second-class — it can never do what official
content does, which defeats the purpose. A-07's closed grammar is what makes a single path
*safe*: untrusted content cannot loop, call out, or fail to terminate, so it does not need to
be sandboxed differently.

### Role in the system

This is why A-07 (closed grammar), A-10 (addressable features) and A-11 (pack validation)
were worth their cost. Each of them exists partly to make one engine path safe for untrusted
content.

### Question for you

`Homebrew.md`'s "special override system" may have been aimed at a specific need that this
would lose. If so, what was it? It can almost certainly be met within one path.

---

## Guard-rails — the things that kill projects like this

Not architecture decisions, but failure patterns, listed so they can be recognised in advance.

| # | Pattern | Why it is fatal |
|---|---|---|
| **G-1** | Building the multi-ruleset abstraction before 5e works end to end | You cannot generalise well from one example you have not built. An abstraction designed before the second case is almost always wrong — and confidently so. **Write `Dnd5eRuleset` and only it. The seam is enough.** |
| **G-2** | Adding v1 scope — sync, monsters, homebrew editor, PDF — before the vertical slice runs | Every feature added before the first one works end to end pushes "working" further away. Ambitious projects die from scope, not from bad architecture. |
| **G-3** | The rewrite urge | Once the whole thing is understood there is a powerful pull to start again "properly". The second version accumulates its own mess and costs the working one. **Refactor in place.** |
| **G-4** | Persisting `DerivedStats` "for performance" | Reintroduces cache invalidation, which A-05 exists to eliminate. Memoise instead — same contract, no staleness. |
| **G-5** | Making `Entity` polymorphic "just for this one case" | Breaks A-02 and therefore serialisation, sync and undo. There is no small version of this. |
| **G-6** | Letting `OverrideLayer` grow | It is the escape hatch that absorbs everything difficult. Define it narrowly and always surface it in the trace as "Manual override". |
| **G-7** | Authoring content before the model is settled | Content is the expensive artefact. A model change after 300 spells are written is 300 rewrites. **Model first, then content.** |

---

## Summary

| # | Decision | Reversibility |
|---|---|---|
| A-01 | Rules as polymorphic modules | very low |
| A-02 | Entity is data, not behaviour | very low |
| A-03 | Open shapes — maps, not fields | very low |
| A-04 | Boundary is the answer shape | low |
| A-05 | Derived state computed + traced | medium |
| A-06 | Commands + domain events | low |
| A-07 | Closed union + closed grammar | medium / low |
| A-08 | Triggers first-class | low |
| A-09 | Deterministic pipeline, ruleset stacking | medium |
| A-10 | Feature addressable | low |
| A-11 | Envelope columns + document body | medium |
| A-12 | Pin + snapshot; always opens | very low |
| A-13 | Multi-entity core from day one | low |
| A-14 | Explicit composition, no singletons | medium |
| A-15 | Issues as data, not exceptions | medium |
| A-16 | Homebrew is content | medium |

Two of these rest on facts still to be verified: **A-09** depends on `F-04` and `F-05`
(competing AC formulas), and **A-08**'s limiter kinds depend on `F-16`. Neither is a `⚑` fact,
but both should be confirmed before they are treated as settled.
