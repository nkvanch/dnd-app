# 06 — Reconciliation

This merges the review's proposals (`A-01 … A-16`) with your response (`R-01 … R-24`) into a
single register.

**Your numbering is the spine.** Where we disagreed and you were right, the entry says so and
the review's version is withdrawn. Where something we raised has no counterpart in your list,
it appears as a proposed addition (`R-25 …`) rather than being folded in silently.

---

## 1. What changed on our side

**The review assumed a greenfield project.** The vault contains no code, and
`Physical layout.md` describes a directory structure in the future tense, so we read the notes
as a design not yet built.

Your response says otherwise, in several places: pure mutators exist, stacking strategies
exist in the resolver, LAN sync exists, DM tools and combat exist.

That premise error invalidates two of our sixteen decisions outright — **A-01 and A-06 both
proposed replacing things that are already written.** They are withdrawn below.

Two further corrections we owe you:

- **On 4e** (`01`, P1): we wrote that "the direction of the resolution pipeline reverses."
  That is wrong. What changes is which resolution strategy the *content* declares — in 5e a
  fireball triggers a defender's save; in 4e the same effect is an attack against Reflex. One
  parameter (whose modifiers sit on the roll), not a different architecture. Your
  strategy-based model handles it.
- **On proficiency values** (`A-03`): we argued that typed IDs preserve type safety, then left
  the *value* as a bare `Integer` whose meaning varied by ruleset. That was inconsistent.
  Your `ProficiencyValue = Binary | Expertise | Rank | SkillRanks` is correct.

## 2. What we are not able to check

We have not seen the code. Several of your positions rest on what already exists — most
importantly §2F, where you note the stacking review may be identifying "a documentation gap
rather than an implementation gap."

We cannot tell which. So the same discipline used for domain facts (`F-NN`) is extended to
implementation: **section 6 lists what we understood to exist as `I-NN` claims, for you to
confirm or correct.** Without that, we risk specifying things that are already built.

---

## 3. Status legend

| Mark | Meaning |
|---|---|
| **AGREED** | Both arrived at the same position |
| **YOURS** | We proposed something different; your version is adopted and ours withdrawn |
| **REFINED** | Agreed in substance, with a detail added or narrowed |
| **PROPOSED** | Raised in the review, absent from your list — needs a decision |
| **OPEN** | Blocked on an `F-` fact or an `I-` claim |

---

## 4. The merged register

### Foundations

| # | Decision | Status | Note |
|---|---|---|---|
| **R-01** | Entity is serialisable runtime data | **AGREED** | = A-02. No ruleset subclasses; behaviour lives outside it |
| **R-02** | Definitions and Instances remain separate | **AGREED** | Original vault principle; unchanged |
| **R-03** | Stats / saves / skills / defenses use open typed-ID shapes | **REFINED** | = A-03, improved. Values keep their type: `ProficiencyValue` union, not a bare integer |
| **R-05** | Feature is the common mechanical bundle | **AGREED** | |
| **R-06** | Feature contains Effects, Activations, TriggeredActivations, Resources, Grants, Choices | **AGREED** | Covers A-08's trigger requirement structurally |
| **R-10** | Predicates are the shared conditional mechanism | **AGREED** | One mechanism for prerequisites, availability, effect conditions and trigger conditions |

### Ruleset architecture

| # | Decision | Status | Note |
|---|---|---|---|
| **R-04** | Rulesets configure **one shared d20 engine** through data and closed strategies | **YOURS** | See 5.1 — A-01 withdrawn |
| **R-07** | Activation outcomes use ruleset-defined `OutcomeId`s | **AGREED** | The one generalisation both sides consider mandatory now |

### Mechanics

| # | Decision | Status | Note |
|---|---|---|---|
| **R-08** | Effects remain a closed tagged union | **AGREED** | |
| **R-09** | Expressions use a closed, non-Turing-complete arithmetic AST | **AGREED** | Your node list matches ours; `Predicate` keeps conditional logic out of it |
| **R-11** | Durations and concentration are first-class | **AGREED** | Your `DurationDefinition` / `DurationState` split is more complete than our sketch |
| **R-12** | Stacking is deterministic and ruleset-configured | **OPEN** | Agreed in principle. Depends on `I-02` (what the resolver already does) and `F-04`/`F-05` (competing base-AC rule) |
| **R-13** | Derived values originate in Core and carry explanation traces | **AGREED** | = A-05. Never persisted; memoisation stays available without changing the contract |

### Mutation, history and synchronisation

| # | Decision | Status | Note |
|---|---|---|---|
| **R-14** | Persistent UI mutations pass through one application mutation boundary | **YOURS** | See 5.2 — A-06's Command reification withdrawn. One refinement proposed below |
| **R-15** | Core mutators remain pure `Entity → Entity` | **AGREED** | |
| **R-16** | Undo/redo uses bounded application-layer snapshots | **AGREED** | `before[]` / `after[]` as arrays from the start is the right call |
| **R-17** | Timeline is persistent and separate from undo | **AGREED** | |
| **R-18** | Trigger signals are separate from timeline entries | **YOURS** | See 5.3 — better than our unified DomainEvent |
| **R-23** | Existing diff-based LAN sync remains until evidence requires intent-based sync | **YOURS** | See 5.4 |
| **R-24** | Multi-entity capability retained throughout core and application | **AGREED** | = A-13, with the premise corrected: this already exists rather than being a v2 provision |

### Content, homebrew and data safety

| # | Decision | Status | Note |
|---|---|---|---|
| **R-19** | Homebrew and official content share one engine path | **AGREED** | = A-16 |
| **R-20** | Manual / live modification is a runtime layer, not homebrew | **REFINED** | Your reclassification is better than our "narrow the OverrideLayer". Detail in 4.1 |
| **R-21** | Content identity and versioning preserve character loadability | **AGREED** | = A-12 |
| **R-22** | Long-tail mechanics stay manual until a repeated pattern justifies a new primitive | **YOURS** | Better than our three fixed options — a rule rather than a quota |

### 4.1 — R-20 detail

The distinction worth keeping explicit, because it is what stops this layer from becoming the
dumping ground:

```
ManualEffect / ManualGrant      → goes through the normal Effect / Feature pipeline
                                  (so it stacks correctly and explains itself)

ResolvedValueOverride           → raw "set the number", used only when nothing else fits
```

Both must appear in the trace, labelled and removable:

```
AC = 19
  10  Base
  +3  DEX
  +4  Armor
  +2  Manual: Shrine Blessing
```

The first form should be the default; the second is the exception, not the mechanism.

---

## 5. Withdrawn — where your position is adopted

### 5.1 — A-01 (`RulesetModule` as a polymorphic spine) → R-04

Your distinction is the correct one, and not only because code already exists:

```
one engine + selectable strategies        (yours)
several engines + a common shell          (ours, at the limit)
```

The stronger argument is one you implied rather than stated: our proposal was **one wide
interface**, so a new system would have to implement all fifteen methods even if it differed
on a single axis. Your decomposition —

```
ProficiencyModel  { ProficiencyBonus | BaseAttackBonus | THAC0 | ProficiencyRank | ... }
AttackModel
SaveModel
ActionEconomy
ProgressionModel
```

— means a system overrides **only the axis on which it differs.** That is better design
independent of the existing codebase.

We checked the decomposition against your target family and it holds: 4e's
At-Will/Encounter/Daily fits the resource model; PF2e's three actions fit action economy; its
archetype multiclassing fits the progression model; THAC0 and descending AC fit the
proficiency and attack models; PF2e's four degrees fit `OutcomeId` plus an attack model.

**One thing to carry across.** A-01 existed partly to enforce an invariant that survives
independently of the mechanism:

> **INV-14 — no game constants in Core.** No `+2`, no `d20`, no `(score − 10) / 2`. They live
> in the strategy objects.

"Compiled strategies remain allowed" satisfies this — but only if it is held as a rule.
Without it, constants drift back into shared code one convenience at a time, and the drift is
invisible until a second system arrives. This is R-29 below.

### 5.2 — A-06 (Commands as the universal mutation model) → R-14 + R-15

Accepted. Your `characterStore.mutate(entityId, mutator, label, timelineInfo)` provides the
same single choke point — undo, persistence, timeline, sync orchestration — without a Command
class per operation, and without rewriting mutators that already work.

The only thing reification adds is **serialisability** (a Command can cross a network or be
written to a log; a closure cannot), and since R-23 keeps diff-based sync, that motivation is
absent. Your revisit condition — real conflict behaviour showing diffs are insufficient — is
the right trigger.

**One refinement proposed (R-25).** A closure cannot be inspected before it runs, so the
boundary cannot answer "what is about to happen". Passing a small descriptor alongside it —

```
mutate(entityId, mutator, descriptor, label, timelineInfo)
    descriptor: { kind, targetIds, requiresConfirmation? }
```

— costs one field now and is what later makes permissions (DM versus player over the same
entity), confirmation prompts and sync filtering possible. Not needed today; cheap today.

### 5.3 — Unified DomainEvent → R-18

Your split is correct and ours conflated two responsibilities:

| | Timeline entry | Trigger signal |
|---|---|---|
| Lifetime | persistent, survives restart | transient, in-process |
| Storage | SQLite | none |
| Audience | the user | the rules engine |
| Volume | one per meaningful action | potentially many per action |
| Emitted by | any mutation worth recording | only operations with reactive semantics |

Merging them would have meant either persisting trigger noise or under-specifying the user's
log. "Not every mutation must emit a TriggerSignal" is the right constraint.

### 5.4 — Commands as the sync unit → R-23

Withdrawn. The review argued this from a greenfield position, where the unit of
synchronisation is still open. It is not open here — sync exists and works. Rewriting working
synchronisation on an architectural argument alone is not justified.

---

## 6. Implementation claims to confirm (`I-NN`)

We understood the following from your response. Each shapes what is still worth specifying,
and we cannot verify any of them.

**Format:** confirm, correct, or say "partially — here is what is missing."

| # | Claim | ✓ |
|---|---|---|
| **I-01** | Pure mutators exist with signature `Entity → Entity`: `applyDamage`, `applyCondition`, `applyGrant`, `takeRest`, `levelUp` | |
| **I-02** | The resolver already implements stacking strategies. **Which of the seven pipeline phases are covered** — competing base setters, typed bonuses, untyped bonuses, minimums, multipliers, clamps, rounding? Is collection order already stabilised (INV-7)? | |
| **I-03** | LAN synchronisation exists: authoritative state, state diff, ownership rules | |
| **I-04** | DM tools, combat, initiative and monster spawning exist | |
| **I-05** | `ResolvedValue` with contribution traces is **implemented**, not only designed | |
| **I-06** | Content packs load from SQLite; a content registry exists at runtime | |
| **I-07** | Undo/redo exists, or is planned as described in §9 | |
| **I-08** | A timeline exists, or is planned as described in §10 | |
| **I-09** | Which content is authored so far — spells, classes, monsters, and roughly how much? (This determines the cost of the `OutcomeId` migration in R-07) | |

**I-09 matters most for sequencing.** R-07 changes the shape of every activation record. If
little content is authored, it is a cheap change now; if a large amount exists, it needs a
migration plan before anything else in this register.

---

## 7. Proposed additions

Raised in the review, with no counterpart in `R-01 … R-24`. Each needs an accept, reject or
"already exists".

| # | Proposal | Why | Was |
|---|---|---|---|
| **R-25** | The mutation boundary receives an operation **descriptor**, not only a closure | Enables permissions, confirmation and sync filtering later; one field now | 5.2 |
| **R-26** | **Feature has stable identity**, including features declared inline inside items, classes or monsters — synthesised IDs assigned at pack build | Without it, `Origin` traces degrade to anonymous numbers, removing a source cannot reliably remove what it granted, and homebrew cannot reference official features | A-10 |
| **R-27** | Content storage splits **envelope (columns) from body (document)**: id, rulesetId, type, name, source, tags, version are indexed; the mechanical body is stored whole and never queried relationally | The body is highly variable and never needed relationally; normalising it is cost without benefit. Content totals 3–8 MB, so the whole registry can load into memory — no lazy loading or query optimisation needed | A-11 |
| **R-28** | **No global mutable state in Core.** Registry, ruleset and RNG are passed explicitly | A global registry makes two rulesets in memory impossible — which happens the moment a user has a 5e and a PF2e character. A global RNG breaks reproducibility and therefore golden tests | A-14 |
| **R-29** | **INV-14 held as a rule:** game constants live only in ruleset strategy objects | Preserves what A-01 was protecting, under your architecture. Testable by grepping Core for rule constants | 5.1 |
| **R-30** | **Every roll the application makes can be replaced by a hand-entered value** | You answered yes to Q4. Recording it as a structural rule because it touches every screen and cannot be retrofitted cheaply | Q4 |
| **R-31** | Validation and loading return `Issue[]` **as data**; exceptions are reserved for programming errors | Implied by your §15 and §16 but not stated as a rule. It is what makes "a character always opens" implementable rather than aspirational | A-15 |

### Also to record explicitly

| Item | Status |
|---|---|
| **The UI boundary** (`ResolvedValue`, `StatGroup`, `AvailableAction`, `PendingChoice`, `Issue`) | You accepted this in §7 but it is absent from `R-01 … R-24`. It should be an R-entry — the contract is what makes the rest work |
| **INV-28 revised** | Our "adding a ruleset must not require editing a single UI file" is replaced by yours: *"must not require changes to existing ruleset-independent UI infrastructure."* Ruleset-specific presentation is legitimate — a 4e sheet may reasonably differ |
| **Choice lifecycle** | Your §16 accepts `(origin, choiceId)` keying, Issue reporting rather than silent repair, and level-up as a state with pending choices. Not in the R-list; should be |

---

## 8. Still blocking

### The 32 domain facts

`03-questions-for-author.md` remains unanswered. Q1–Q6 were answered; `F-01 … F-32` were not.

These are the claims nobody else in this process can verify. Specific consequences:

| Fact | Blocks |
|---|---|
| `F-04`, `F-05` | **R-12.** When several base-AC formulas apply, does the player choose, or does the highest win automatically? The rules appear to allow choosing; apps generally take the highest. This determines the default in the competing-base-setter phase |
| `F-16` | **R-06.** Are "once per turn", "once per round" and "once per rest" three distinct limiter kinds? |
| `F-11` ⚑ | Whether `ConditionInstance` needs `Stacks: Integer` or a boolean |
| `F-25` ⚑ | Whether `Effect` needs a set/minimum operation distinct from add |
| `F-27`, `F-28` ⚑ | Content volumes and the long-tail proportion |

The remaining facts are lower-stakes individually but the table in `03` section 4 shows what
each one decides.

### Technology — two practical items

Your §17 settles the stack: C++20, CMake, Qt 6/QML, SQLite, Asio. Two things worth checking
early rather than late, neither of which affects the domain model:

- **Qt licensing on iOS.** LGPL requires dynamic linking, which is awkward on iOS; a
  commercial licence may be needed for App Store distribution. Worth confirming before iOS
  work starts rather than after.
- **A Mac is required** to build and sign for iOS, on every stack. If one is not available,
  Android and Windows are a complete target set on their own.

---

## 9. Where this leaves the architecture

Of the review's sixteen decisions: **eleven are agreed or refined**, **three are withdrawn in
favour of your versions** (A-01, A-06, and the unified DomainEvent), and **seven proposals
remain open** as R-25 … R-31.

Of your twenty-four: all are accepted. Three (R-04, R-14, R-18) improve on what the review
proposed, for reasons stated above rather than by deferral.

The governing principle in your §20 —

> *When a real mechanic breaks the current model, extract the smallest reusable abstraction
> that explains the break. Do not design the abstraction before the break exists.*

— is right, and it is the same principle as the review's guard-rail G-1. The one qualification
worth holding alongside it is the asymmetry between **cheap-now / expensive-later** changes
and the rest. `R-07` (outcome maps) is the clearest case: it costs almost nothing today and
becomes a full content migration once packs are written. That is why it is worth doing before
the break rather than after — and it is the reason `I-09` (how much content already exists)
is the most useful single answer you can give us next.
