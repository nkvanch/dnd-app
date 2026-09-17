# Grimoire — Response to Architecture Review

This document is a response to the proposed architecture review and its sixteen structural decisions.

The review is useful. It correctly identifies several gaps in the current design, especially around outcomes, timing, triggers, expressions, versioning, and terminology. Those findings should be incorporated.

However, some of the proposed fixes go further than the problems require. In particular:

- the proposal to make a polymorphic `RulesetModule` the architectural spine
    
- the proposal that every state change becomes a Command returning DomainEvents
    
- the proposal to use Commands as the future synchronisation unit
    

Those would replace working architectural patterns rather than extend them.

The intended direction remains:

> **Generalise only where a real ruleset or mechanic forces the generalisation. Preserve existing pure mutators and shared d20 machinery wherever possible.**

The long-term product scope is unchanged:

- D&D 5e 2014
    
- D&D 5e 2024 / 5.5e
    
- OSE / B/X-style systems
    
- D&D 3.5 / Pathfinder 1e
    
- Pathfinder 2e
    
- D&D 4e
    
- AD&D 1e / 2e
    

Implementation remains incremental. Supporting that eventual family does not mean implementing abstractions for every historical difference before those systems are reached.

---

# 1. Overall position

The review's diagnosis of the existing architecture is largely accepted.

The following existing principles remain foundational:

- Definition and Instance are separate.
    
- `Entity` is runtime data, not a rules object.
    
- Official and homebrew content use the same mechanical path.
    
- `Feature`, `Effect`, `Grant`, `Choice`, `Resource`, and `Predicate` remain shared primitives.
    
- Derived values are computed, not stored.
    
- Explainability originates in Core.
    
- Content IDs remain typed.
    
- The engine does not hardcode named content such as `HeavyArmorMaster`.
    
- Arbitrary scripting/plugin execution remains out of scope.
    

These are correctly identified as strengths in the review.

The review also identifies several real missing pieces which should now be added to the architecture.

---

# 2. Accepted changes

## A — `AbilityDefinition` becomes `ActivationDefinition`

Accepted.

"Ability" has a conflicting meaning in the source rules and in the current architecture.

Use:

```text
Stat
= STR / DEX / CON / INT / WIS / CHA

Activation
= something an entity deliberately uses
```

The corresponding model becomes:

```text
FeatureDefinition
├── Effects[]
├── Activations[]
├── TriggeredActivations[]
├── Resources[]
├── Grants[]
└── Choices[]
```

This terminology is clearer and avoids mixing game vocabulary with internal architecture terminology.

---

## B — Fixed `onHit/onMiss` fields become Outcome maps

Accepted.

An activation must not assume that resolution always has two outcomes.

Use:

```text
ActivationDefinition
    outcomes: Map<OutcomeId, Effect[]>
```

Examples:

```text
5e attack
├── hit
└── miss
```

```text
5e saving throw
├── success
└── failure
```

```text
PF2e
├── critical_success
├── success
├── failure
└── critical_failure
```

This is a cheap structural generalisation now and an expensive content migration later.

The review is correct that fixed `onHit/onMiss` fields bake 5e's result shape directly into every content definition.

---

## C — Triggered mechanics become first-class

Accepted conceptually.

The architecture must represent reactive mechanics such as:

```text
Sneak Attack
→ on hit

Shield
→ when hit

Opportunity Attack
→ creature leaves reach

Concentration
→ damage taken

Turn effects
→ start/end of turn
```

These do not fit passive `Effect`, and they are not ordinary voluntary Activations.

Add:

```text
TriggeredActivationDefinition
├── trigger
├── predicate
├── actionCost
├── resourceCost?
├── limiter?
└── outcomes
```

The review correctly identifies this as a gap.

However, the mechanism by which triggers execute is modified later in this document.

---

## D — A closed arithmetic expression model is needed

Accepted.

The project rejects a general scripting language, but mechanics already require expressions such as:

```text
10 + DEX modifier + CON modifier
1d10 + Fighter level
+1d6 per slot level
```

Therefore the engine needs a small, validated arithmetic representation.

Use a closed expression AST:

```text
Expression
├── Integer
├── Dice
├── Reference
│   ├── Stat
│   ├── StatModifier
│   ├── CharacterLevel
│   ├── ClassLevel
│   ├── Proficiency
│   ├── ResourceCurrent
│   ├── ResourceMaximum
│   └── SlotLevel
│
├── Add
├── Subtract
├── Multiply
├── Divide
├── Min
├── Max
├── Floor
└── Ceil
```

Not included:

```text
loops
assignment
user-defined functions
arbitrary branching
external calls
```

Predicates remain the mechanism for conditional logic.

This satisfies the need for formulas without turning the pack format into a scripting runtime.

---

## E — Duration and concentration receive explicit models

Accepted.

Add an explicit duration system.

Conceptually:

```text
DurationDefinition
├── Permanent
├── Rounds(n)
├── Time(duration)
├── UntilTurnStart(entity)
├── UntilTurnEnd(entity)
├── UntilRest(restType)
├── Concentration
└── While(predicate)
```

Runtime state is separate:

```text
DurationState
├── startedAt
├── remainingRounds?
├── owner?
└── expiryState
```

Concentration becomes explicit entity state rather than being reconstructed from spell text.

The review is correct that duration and concentration touch spells, conditions, damage, combat, and the character sheet simultaneously and therefore need one coherent model.

---

## F — Deterministic stacking remains a first-class concern

Accepted, with one qualification.

The proposed conceptual pipeline is useful:

```text
base
→ competing base setters
→ typed bonuses
→ untyped bonuses
→ multipliers
→ clamps / minimums
→ rounding
```

The result must be deterministic and order-independent.

However, before introducing new stacking architecture, the proposal must be compared against the existing resolver implementation. The current implementation already contains stacking strategies, so this review may be identifying a documentation gap rather than an implementation gap.

The invariant remains:

> Shuffling the collected Effects must not change the derived result.

The review correctly identifies stacking as one of the easiest places for subtle rules errors to appear.

---

## G — Homebrew is normal content

Accepted fully.

Homebrew is not a second engine.

```text
Official content
      │
      ▼
ContentDefinition
      │
      ▼
shared engine

Homebrew content
      │
      ▼
ContentDefinition
      │
      ▼
same shared engine
```

The difference is provenance:

```text
source
pack
version
trust / validation state
```

not mechanics.

The review correctly identifies a contradiction in older notes and resolves it in favour of the unified content path.

---

# 3. Clarification — the old "homebrew override" concept

The old "homebrew override" terminology was misleading.

Its likely purpose was not authored homebrew at all.

It was intended for live play changes such as:

```text
add a custom feat
add/remove an ability
change movement
grant a sense
change a proficiency
disable a feature
set a derived value
add a temporary blessing
```

This functionality remains useful, but should be separated from Homebrew.

Rename the concept to something like:

```text
ManualModification
```

or:

```text
FreeEditLayer
```

Conceptually:

```text
ManualModification
├── label
├── source
├── active
├── Grants[]
├── Effects[]
├── Overrides[]
└── RemovedReferences[]
```

Examples:

```text
"Shrine Blessing"
├── Grant Darkvision
└── +10 ft movement
```

```text
"DM correction"
└── Override AC = 19
```

This produces an important distinction:

```text
HOME BREW
= reusable authored content

MANUAL MODIFICATION
= live runtime intervention
```

The latter must remain visible in explainability traces and must not become the fallback implementation mechanism for every mechanic that is hard to model.

---

# 4. Long-tail mechanics policy

The proposed long-tail options are too discrete.

The intended policy is:

```text
Encounter unusual mechanic
        │
        ▼
Can existing primitives represent it cleanly?
        │
    yes ─────► model normally
        │
        no
        ▼
Has the same mechanical pattern appeared several times?
        │
    no ──────► manual/reminder fallback
        │
       yes
        ▼
extract reusable primitive
```

Examples of possible promoted primitives:

```text
new Effect type
new Activation shape
new Trigger
new Resource model
new Predicate
new Resolution strategy
new Duration rule
```

The important rule is:

> Do not hardcode a named feature merely because it is unusual. If several unusual features share the same structure, extract the structure. If no reusable structure exists, leave the mechanic partially manual.

This keeps the engine extensible without drifting into a scripting language.

---

# 5. Ruleset architecture — modified

The review proposes:

```text
RulesetModule
= abstract class
= one subclass per game system
```

and makes this the architectural spine.

The reasoning is understandable: behaviour differs between systems, and that variation needs a home.

However, this proposal is too broad for the current project.

A `RulesetModule` with methods such as:

```text
ResolveAttack
ResolveSave
RecomputeDerived
DescribeSheet
ValidateBuild
ProficiencyFor
```

risks turning each game system into a separate rules engine.

The long-term product goal is instead:

> one shared d20 engine, with rulesets selecting or configuring the pieces that differ.

Therefore the preferred model remains:

```text
RulesetDefinition
├── identity
├── terminology
├── stats
├── skills
├── saves
├── defenses
├── bonus types
├── modifier model
├── proficiency model
├── attack model
├── save model
├── action economy
├── progression model
└── resource/rest configuration
```

Compiled strategies remain allowed.

For example:

```text
ProficiencyModel
├── ProficiencyBonus
├── BaseAttackBonus
├── THAC0
├── ProficiencyRank
└── future model when required
```

The engine calls:

```text
resolveAttack(context, ruleset.attackModel)
```

rather than delegating the entire rules engine to:

```text
ruleset.ResolveAttack(context)
```

The distinction matters.

The first architecture means:

```text
one engine
+ several selectable strategies
```

The second trends toward:

```text
several engines
+ one common shell
```

The current scope favours the former.

If a future ruleset proves that a particular axis genuinely requires polymorphism, that axis can become a strategy interface at that point.

The architecture should not assume in advance that every system needs an entirely separate `RulesetModule`.

---

# 6. Open data shapes — accepted with stronger typing

The review is correct that fixed shapes such as:

```text
STR
DEX
CON
INT
WIS
CHA
```

or:

```text
AC
initiative
speed
```

cannot represent every supported system.

So maps keyed by typed IDs remain appropriate.

Examples:

```text
Stats: Map<StatId, value>
Skills: Map<SkillId, value>
Saves: Map<SaveId, value>
Defenses: Map<DefenseId, ResolvedValue>
```

However, this proposal:

```text
Proficiencies["skill:stealth"] = 2
```

with `2` meaning:

```text
5e      expertise
PF2e    expert
3.5     two ranks
```

is too weak semantically.

The shape should be open without throwing away type information.

For example:

```text
ProficiencyValue
├── Binary
├── Expertise
├── Rank
└── SkillRanks
```

or an equivalent ruleset-appropriate typed representation.

General storage should not mean "everything is an integer with meaning hidden elsewhere."

---

# 7. UI boundary — accepted with qualification

The review's "answer shape" idea is strong.

The UI should primarily consume stable result objects such as:

```text
ResolvedValue
StatGroup
AvailableAction
PendingChoice
Issue
```

This keeps the UI from directly depending on rules-engine internals.

However, this acceptance criterion is too strict:

> Adding a ruleset must not require editing a single UI file.

Replace it with:

> Adding a ruleset must not require changes to existing ruleset-independent UI infrastructure.

Ruleset-specific presentation is allowed.

A 5e character sheet and a 4e character sheet may legitimately benefit from different layouts.

What must remain shared is the data contract and common UI infrastructure, not every screen arrangement.

---

# 8. Commands — rejected as the universal mutation model

The review proposes:

```text
Command
→ core operation
→ new Entity + DomainEvent[] + Issue[]
```

for every state change.

This is rejected as a primary architecture.

The existing engine already contains pure immutable mutators:

```text
applyDamage(Entity)      → Entity
applyCondition(Entity)   → Entity
applyGrant(Entity)       → Entity
takeRest(Entity)         → Entity
levelUp(Entity)          → Entity
```

Rewriting those around Commands provides little value.

The real missing piece is an application-level enforcement point.

Use:

```text
UI
 ↓
Application mutation boundary
 ↓
existing pure core mutator
 ↓
new Entity
 ↓
persistence / sync / timeline / undo
```

Example:

```text
characterStore.mutate(
    entityId,
    mutator,
    label,
    timelineInfo
)
```

The mutation boundary owns:

```text
undo snapshot
redo invalidation
state replacement
persistence
timeline
sync orchestration
```

The UI must not directly perform persistent Entity mutations.

This gives the same central seam without restructuring the rules core.

---

# 9. Undo / redo

Undo and redo are application concerns.

Use bounded snapshots.

```text
HistoryEntry
├── label
├── timestamp
├── before[]
└── after[]
```

Arrays are used from the beginning so one action can later mutate several entities.

Typical size:

```text
50 actions
```

Undo:

```text
restore before[]
push entry to redo
```

Redo:

```text
restore after[]
push entry to undo
```

Any new user mutation clears the redo stack.

Undo/redo does not need to survive an application restart.

---

# 10. Timeline

The mechanical timeline is separate from undo.

Timeline is persistent and session-scoped.

```text
TimelineEntry
├── id
├── sessionId
├── entityIds[]
├── timestamp
├── category
├── message
├── source?
└── metadata?
```

Stored in SQLite.

Example:

```text
19:14 Took 8 fire damage
19:15 Gained Poisoned
19:17 Used Second Wind
19:17 Recovered 9 HP
```

It survives app restart.

Undo history does not.

---

# 11. DomainEvents — rejected as a universal primitive

The review makes DomainEvents both:

```text
historical records
```

and:

```text
trigger inputs
```

This combines two different responsibilities.

Use two concepts instead.

## Timeline entry

Persistent historical/audit record:

```text
"Took 8 fire damage"
```

## Trigger signal

Transient rules-processing information:

```text
OnDamageTaken
├── target
├── amount
├── damageType
└── source
```

Not every mutation must emit a TriggerSignal.

Only operations with reactive semantics need to produce one.

This avoids turning the logging model into part of the rules engine.

---

# 12. Synchronisation — keep the existing strategy

The review argues that Commands should become the network message.

That is not currently justified.

LAN synchronisation already exists.

The current direction remains:

```text
authoritative state
+
state diff
+
ownership rules
```

Do not rewrite working synchronisation around command replay unless real conflict behaviour demonstrates that state diffs are insufficient.

The application mutation boundary is still useful here:

```text
local user change
→ mutate()
→ persist
→ calculate/send diff
```

Remote state updates use a separate path:

```text
remote patch
→ applyRemotePatch()
→ update state
→ persist

NO local undo entry
NO duplicate locally-generated timeline entry
```

---

# 13. Multi-entity architecture

Accepted, but not because DM tools are hypothetical.

DM tools, combat, monster spawning and LAN sync already exist in the application, though they are not currently the product's main focus.

Therefore the statement:

```text
v1 is player-only
v2 introduces DM tools
```

should not be treated literally as the state of the existing project.

The useful architectural part remains:

```text
ApplicationState contains multiple entities
Core functions accept Entity, not Character
EntityKind distinguishes runtime kind
selection of "current character" is a UI concern
```

That should remain.

The review's multi-entity recommendation is structurally useful even though its project-history premise is inaccurate.

---

# 14. OverrideLayer — narrowed definition

`OverrideLayer` must not become the place where unsupported mechanics go.

Its role is specifically:

> explicit manual intervention in live runtime state.

Examples:

```text
set AC to 18
set Perception bonus to +7
set passive Perception to 19
temporarily change movement to 40 ft
```

Every override must contain:

```text
target
value / operation
label
source
active state
```

and must appear in explainability:

```text
AC = 19

10 Base
+3 DEX
+4 Armor
+2 Manual Override: Shrine Blessing
```

Manual grants can use normal Effects/Features instead of abusing raw value overrides.

---

# 15. Content versioning

Accepted.

Characters must not become unusable because a pack disappears or updates.

The exact storage policy may evolve, but the invariant is:

> A character always opens.

If a referenced definition is missing:

```text
character loads
→ affected content marked degraded
→ Issue reported
→ user data preserved
```

Content versioning must identify:

```text
rulesetId
packId
contentId
version
```

and snapshots/fallback data should be retained where required to preserve a usable character.

The review is correct that silent failure here is a data-loss problem rather than merely a rules bug.

---

# 16. Choice lifecycle

Accepted.

Selections should not be keyed only by `choiceId`.

Use an origin-qualified identity:

```text
(origin, choiceId)
```

because the same choice definition may appear through multiple progression sources.

If a choice later becomes invalid:

```text
report Issue
```

not:

```text
silently replace/remove it
```

Level-up may contain unresolved pending choices rather than being treated as one indivisible atomic operation.

This is a useful refinement.

---

# 17. Technology

The architecture should remain language-independent.

The current implementation direction remains C++.

Likely tooling:

```text
C++20
CMake
Qt 6 / QML
SQLite
Asio
```

The review correctly notes that this is a harder implementation path than Flutter/Dart for deeply nested tagged unions and serialisation.

That is a real engineering cost, but it does not change the domain architecture.

The technology decision should not force the domain model to become more inheritance-heavy merely because C++ supports virtual classes.

---

# 18. Answers to the open author questions

## Q1 — How many rule systems must the architecture accommodate?

The long-term target remains:

```text
D&D 5e 2014
D&D 5e 2024
OSE / B/X
D&D 3.5
Pathfinder 1e
Pathfinder 2e
D&D 4e
AD&D 1e / 2e
```

This is a product direction, not a requirement to fully abstract all of them today.

The implementation rule is:

> Current abstractions must not unnecessarily block these systems, but no new abstraction is added solely because a future system might need it.

5e/5.5e remain the immediate implementation target.

Each later system is allowed to force new primitives when reached.

Therefore none of the proposed Q1 options is accepted exactly as written. The scope stays broad; implementation stays narrow and incremental.

---

## Q2 — What is the coverage target for the long tail?

Use the long-tail promotion rule:

```text
supported primitive exists
→ automate

no primitive, one unusual case
→ manual/reminder

several cases share mechanic
→ extract reusable primitive
```

Avoid content-name hardcoding wherever possible.

Manual toggles remain an intentional escape hatch, not a failure.

---

## Q3 — Technology stack

C++ remains the intended direction.

The domain model and architectural specifications remain independent of that decision.

---

## Q4 — Manual dice entry

Yes.

Every roll generated by the application should permit physical-dice input.

Conceptually:

```text
Roll
├── Roll digitally
└── Enter result manually
```

The application should not force digital dice at a physical tabletop.

---

## Q5 — Homebrew model

Yes:

> Homebrew is identical content with different provenance.

There is no special homebrew engine path.

The old "homebrew override" concept is reclassified as Live/Manual Modification, not content authoring.

---

## Q6 — `OverrideLayer`

Purpose:

> live manual correction or temporary intervention when the table changes something outside normal calculated state.

Examples:

```text
custom temporary blessing
DM-granted movement
manual save adjustment
set AC
temporary feature
remove/disable feature
```

The implementation should distinguish:

```text
ManualEffect / ManualGrant
```

from:

```text
ResolvedValueOverride
```

rather than treating everything as a raw override.

It must remain visible, labeled, removable, and auditable.

---

# 19. Revised structural decisions

The resulting architecture should approximately settle on:

```text
R-01  Entity is serialisable runtime data.
R-02  Definitions and Instances remain separate.
R-03  Stats/saves/skills/defenses use open typed-ID shapes.
R-04  Rulesets configure one shared d20 engine through data and
      closed strategies.
R-05  Feature is the common mechanical bundle.
R-06  Feature contains Effects, Activations, TriggeredActivations,
      Resources, Grants and Choices.
R-07  Activation outcomes use ruleset-defined OutcomeIds.
R-08  Effects remain a closed tagged union.
R-09  Expressions use a closed non-Turing-complete arithmetic AST.
R-10  Predicates are the shared conditional mechanism.
R-11  Durations and concentration are first-class.
R-12  Stacking is deterministic and ruleset-configured.
R-13  Derived values originate in Core and carry explanation traces.
R-14  Persistent UI mutations pass through one application mutation boundary.
R-15  Core mutators remain primarily pure Entity → Entity transformations.
R-16  Undo/redo uses bounded application-layer snapshots.
R-17  Timeline is persistent and separate from undo.
R-18  Rule trigger signals are separate from historical timeline entries.
R-19  Homebrew and official content share one engine path.
R-20  Manual/live modification is a runtime layer, not homebrew.
R-21  Content identity/versioning preserves character loadability.
R-22  Unsupported long-tail mechanics remain manual until a reusable
      pattern justifies a new primitive.
R-23  Existing diff-based LAN sync remains until evidence requires
      intent/command-based synchronisation.
R-24  Multi-entity capability is retained throughout the core/application
      model even when a screen displays only one entity.
```

---

# 20. Final position

The review should be merged into the current architecture rather than treated as a replacement architecture.

Its strongest contributions are:

```text
Outcome model
Triggered activations
Duration/concentration
Expression AST
Choice lifecycle
Versioning policy
Terminology cleanup
Stacking formalisation
```

Its main overreach is treating:

```text
polymorphic ruleset modules
+
universal Commands
+
universal DomainEvents
```

as prerequisites for the rest of the system.

Those mechanisms should only be introduced where concrete ruleset or synchronisation requirements demonstrate that the existing shared strategies and immutable mutation architecture are insufficient.

The governing principle remains:

> **When a real mechanic breaks the current model, extract the smallest reusable abstraction that explains the break. Do not design the abstraction before the break exists.**
I think Draft 2 is substantially better than Draft 1. The stress-test against actual mechanics was exactly the right move: it found missing abstractions by failure rather than by speculation, and the document explicitly says five of the fifteen tested mechanics did not fit the previous model. 

I would accept **most of the nine additions**, but I would push back on three parts of the specification before calling it canonical:

1. **fully normalized SQLite for content**
2. **local numeric content identity as a domain invariant**
3. a few places where a useful mechanism has been promoted into a stronger top-level abstraction than I think the evidence warrants.

## The nine Draft-2 additions

### G1 — `Form`

**Accept the mechanism; refine the type.**

The identified problem is real: alternate forms need to preserve entity identity, maintain separate state, and decide which characteristics come from the original versus the form. The spec explicitly models one active form while identity remains constant, with per-characteristic carry-over. 

That is much better than:

```text
Wild Shape = giant pile of stat overrides
```

and much better than:

```text
Wild Shape = second Entity
```

Your current app already has the most important evidence for this abstraction: **Wild Shape has a separate HP pool and DM damage already understands it.**

So I would use something like:

```text
Entity
├── BaseState
└── ActiveForm?
     ├── definitionRef
     ├── formState
     ├── hpState?
     └── sourcingPolicy
```

rather than necessarily storing the *base form itself* as another `Form` row.

The document proposes:

```text
base form
dire wolf form
```

as peer rows. That is elegant relationally, but it may unnecessarily reshape your existing Entity model.

The key abstraction is:

> **An active form may replace selected characteristic sources without replacing entity identity.**

I would preserve that principle, not necessarily the exact table arrangement.

Also, `F-48` is explicitly still unverified, and the specification acknowledges that the separate-HP decision depends on it. 

So don't let:

```text
every Form has own HP
```

become universal until the supported transformation mechanics are checked.

---

### G2 — three-valued predicates

**Strong accept.**

This is one of the best additions.

The spec gives exactly the problem:

```text
ally adjacent?
target visible?
target surprised?
```

With no battlefield model, Grimoire cannot honestly return either `true` or `false`. Treating missing context as false silently disables abilities; treating it as true silently enables them. 

So:

```cpp
enum class PredicateResult {
    True,
    False,
    Unknown
};
```

is better than `bool`.

I especially like:

```text
unknown
→ pending question
→ user supplies missing fiction/context
```

The computation section carries `unknown` separately rather than including or rejecting it. 

One refinement: **don't automatically pop a modal for every unknown predicate**.

The rules layer should produce:

```text
PendingQuestion
```

and the UI decides how intrusive to be.

For example:

```text
Sneak Attack
○ Context required
```

then tapping it asks:

```text
Is an ally within 5 ft of the target?
```

That's better UX than the sheet constantly interrogating the user during recomputation.

---

### G3 — `Option`

**Accept the concept, rename/narrow it.**

The underlying discovery is valid. These are different from character-building `Choice`s:

```text
Character Choice
→ persistent selection during build/level-up

Use-time choice
→ decision made during one activation
```

The examples establish a repeated pattern: before-roll selection, after-hit selection, and resource-pool selection at casting time. 

But I would not make generic `Option` a broad top-level domain word.

Use:

```text
ActivationOption
```

because otherwise you now have:

```text
Choice
Selection
Option
Outcome
```

and "Option" is extremely generic.

I'd model:

```text
ActivationDefinition
├── options[]
├── costs[]
├── resolution
└── outcomes[]
```

where an `ActivationOption` can have:

```text
whenChosen
predicate
cost
effects
```

This is clearly supported by the three mechanics without pretending Options exist independently of Activations.

---

### G4 — triggering signal data in evaluation context

**Accept.**

Absolutely necessary.

An `OnDamageTaken` predicate or expression may need:

```text
damage amount
damage type
attacker
target
attack result
source ability
```

not just the Entity's current state.

So:

```text
EvaluationContext
├── self
├── target?
├── ruleset
├── environment?
├── trigger?
│    ├── kind
│    ├── source
│    └── payload
└── userSuppliedContext?
```

The current document rightly identifies this as a requirement created by reactive mechanics rather than inventing a global event system again. 

---

### G5 — v1 has no clock

**The principle is good; the version language is wrong for your actual application.**

The specification says combat/initiative is v2 and therefore duration information is stored but not automatically advanced. 

But your actual app already has combat/initiative/DM tooling.

So I would rewrite this as a capability distinction:

```text
Without active combat timing:
    durations are recorded/manual

With active CombatState:
    turn/round durations may advance automatically
```

Not:

```text
v1 never advances durations
v2 does
```

That would describe the actual architecture instead of the review's product staging.

---

### G6 — roll modifiers beyond advantage

**Accept the problem, slightly refine the solution.**

The document correctly identifies:

```text
advantage
reroll
minimum
replacement
```

as different procedural modifications to rolling. They don't necessarily commute. 

I agree with:

```text
ruleset controls ordering
```

but I would avoid making them purely arbitrary vocabulary.

`RollModifierId = "reroll"` is insufficient unless compiled code knows what a reroll actually means.

So use:

```text
RollModification
├── AdvantageModel
├── RerollModel
├── MinimumRollModel
├── ReplacementModel
└── ...
```

with ruleset configuration determining:

```text
supported models
ordering
interaction/cancellation rules
```

That is consistent with R-04:

> data chooses closed strategies; generic Core does not invent procedure.

---

### G7 — source of trigger signal

**Accept.**

This is simple and useful.

The spec points out that without other-entity automation, a user must be able to say:

```text
"The enemy started casting a spell."
```

so Counterspell-like content can still work. 

That's exactly aligned with your product philosophy:

> the app assists with rules; it does not pretend it knows the fiction.

So:

```text
TriggerSource
├── EntityAction
├── UserDeclaration
├── OtherEntity
└── System
```

is reasonable.

---

### G8 — explicit expression-reference vocabulary

**Accept strongly.**

We already accepted a closed Expression AST, and this is the missing half.

If arbitrary strings can become expression references:

```text
"whatever.some.path"
```

you have quietly recreated an untyped scripting interface.

So the valid references should be closed:

```text
StatScore
StatModifier
CharacterLevel
ClassLevel
DerivedValue
ResourceCurrent
ResourceMax
SelectedOptionValue
TriggerValue
...
```

and extended only when a real mechanic requires one.

This is exactly the right kind of restriction.

---

### G9 — nonnumeric effect operations

**Mostly already implied by our Effect union.**

The spec gives examples:

- resistance = membership/set-like
- darkvision = capability
- advantage = roll modification
- death = state change
- speed halving = multiplication. 

I agree with the principle.

But this isn't really a newly discovered requirement relative to the architecture we already had, because we already rejected a numeric-only Effect model and had semantic Effect variants.

So I would record this as:

> **confirmation of R-08, not a new architectural layer.**

Don't invent one universal:

```text
EffectOperation
```

that tries to encompass every Effect kind.

Keep semantic variants.

---

# The ruleset axis design is now very good

This is probably the strongest part of the specification.

The ruleset is now explicitly:

```text
Ruleset
├── vocabulary
└── axes
     ├── StatModel
     ├── ProficiencyModel
     ├── StackingModel
     ├── AttackModel
     ├── SaveModel
     ├── CheckModel
     ├── DefenceModel
     ├── OutcomeModel
     ├── DamageModel
     ├── ActionEconomy
     └── ProgressionModel
```

with shared implementations referenced rather than copied. 

This is much closer to the architecture we wanted than the original `RulesetModule`.

I would accept the concept.

But I would **not freeze exactly ten axes as eternal architecture**.

The test should remain:

> An axis exists when at least two supported systems differ procedurally in a way content data cannot represent.

The specification actually states essentially this criterion itself. 

So I would describe the current set as:

```text
runtime v1 axis catalogue
```

not:

```text
all d20 systems have exactly ten variation axes forever
```

The proposed four-system audit is worthwhile, particularly for catching accidental 5e assumptions. 

But I would relax its success condition:

```text
"No cell requires adding an axis"
```

is too strong.

If AD&D reveals an actual missing independent axis, **the audit succeeded by finding it**.

Better:

> Every cell must be expressible without ruleset-specific branching leaking into shared Core; if a genuinely new procedural axis is discovered, add it deliberately.

That matches your long-tail/generalisation philosophy.

---

# The biggest disagreement: fully normalized persistence

This is the part I would **not accept yet**.

The specification withdraws R-27 and now says:

> all persistent content and character data should be fully normalized; no structured document/blob columns anywhere. 

I agree with half of that:

## Runtime character state

Normalization is reasonable for:

```text
HP
resources
conditions
inventory instances
selections
origins
forms
```

because those are frequently mutated independently.

So:

```text
entity
entity_resource
entity_condition
entity_item
entity_selection
...
```

makes sense.

But their critique of snapshots is weak:

> undo granularity becomes the entire character.

That's not actually a problem because **we deliberately chose whole-Entity snapshots for undo**.

Undo is:

```text
before[]
after[]
```

not database transaction reversal.

So row-level undo granularity is not a benefit for the design we've chosen.

Likewise, their sync argument assumes row diffs are your sync representation. Your current implementation already has structural/deep diffs; a document does not necessarily mean “transmit the whole document.”

So the character-side argument is reasonable but not as decisive as the specification claims.

---

# Fully normalizing immutable content is even less convincing

They acknowledge that the original content arguments remain true:

- highly variable shape
- not queried relationally
- loaded entirely into memory. 

Then they normalize content anyway for “one storage philosophy.”

I don't think:

> one storage philosophy

is sufficient architectural justification.

Content and runtime state **have fundamentally different write profiles**.

It's perfectly valid for:

```text
runtime Entity state
→ normalized relational rows
```

while:

```text
immutable ContentDefinition
→ indexed envelope + serialized mechanical definition
```

The specification says a serialized content body creates a second serialization/version format.

But §9 itself still has an author-facing structured format—the examples are JSON-like source definitions—which means there is still a content representation outside the SQL schema. 

So full normalization doesn't actually make serialization disappear.

It gives you:

```text
authoring representation
        ↓
normalized SQL AST
        ↓
runtime C++ objects
```

instead of:

```text
authoring representation
        ↓
serialized definition
        ↓
runtime C++ objects
```

Both need conversion/validation.

And SQL tables like:

```text
expr_node
pred_node
effect
activation
activation_option
activation_outcome
resource_def
resource_restore
...
```

are essentially a relational serialization format for your AST. 

That's not necessarily bad—but it **is** substantial complexity.

I would prefer this hybrid until real needs prove otherwise:

```text
USER DATABASE
├── normalized runtime entity state
├── timeline
├── version metadata
└── authored content metadata/index

PACKS / CONTENT
├── indexed metadata
└── structured serialized Definition body
```

Runtime still loads everything into `ContentRegistry`.

That preserves:

- simple pack creation
- simple versioned definition migration
- simple export/import
- no SQL reconstruction of large object graphs
- relational durability for frequently changed character state

So I would **reopen R-27 instead of accepting its withdrawal**.

---

# The numeric-ID scheme is overengineered for your scale

This is my second major pushback.

The specification proposes:

```text
human-readable authoring key
        ↓ install
per-installation permanent uint32 ID
        ↓
all database/runtime references
```

because integer FKs are smaller/faster. 

Then, because those integers are local to each installation, networking/export requires translation at the boundary. 

That's a lot of architecture to avoid storing a few thousand short strings.

And the specification itself says:

```text
~12,000 content records maximum
30–50 MB content
1–50 characters
```

and explicitly calls the dataset small. 

At this scale, I would prioritize **globally meaningful stable identity** over narrower FKs.

Something like:

```text
ContentKey {
    rulesetId
    namespace / packId
    contentType
    localId
}
```

serialized canonically as:

```text
dnd5e-2014:srd:spell:fireball
```

or equivalent.

Then:

```text
database
sync
export
logs
debugging
content registry
```

all refer to the same semantic identity.

You may still intern it to an integer **in memory** if profiling ever shows a need.

SQLite may also use a surrogate row ID internally.

But I would not make:

> locally assigned permanent uint32

part of the domain identity contract.

It causes additional machinery:

```text
persistent registry
retired IDs
install-time assignment
cross-device translation
session mapping
authoring-key reverse lookup
```

to solve a performance problem the spec explicitly says you do not have.

The document itself admits Scheme A—strings persisted, integers interned in memory—is correct and its costs are modest at this scale. 

That would be my choice unless measurements demonstrate otherwise.

---

# One identity issue I would definitely keep

Stable feature identity is correct.

I like deterministic synthetic IDs for inline Features.

But I would change one detail.

The document suggests deriving synthetic keys partly from **name and position**, and acknowledges moving the feature can change identity. 

I'd rather require a stable local key once something is publishable:

```text
feature localId = "action-surge"
```

even if the editor generates it automatically initially.

Names and ordering are presentation/editing properties.

Identity should not depend on either after creation.

So:

```text
class.fighter/features/action-surge
```

is good because `"action-surge"` is the stable authored local ID.

Not because it happened to be named Action Surge and appeared at index 4 during a build.

---

# Content precedence is missing again

I searched specifically for the issue you just discovered in the real app:

```text
homebrew spell with same id
→ homebrew shadows official spell
```

The new spec spends a lot of effort on **identity collisions between packs**, but that's a different issue.

It says pack-key collisions should block installation and identities are namespaced by `(pack_key, local_key, type)`. 

That's fine for identity.

But it does **not answer R-34**:

> Which effective definition wins when multiple installed sources intentionally provide variants/overrides for the same semantic content slot?

Especially:

```text
legacy untagged human
dnd5e-2024 human

official human
homebrew replacement human
```

Those don't necessarily have the same pack key, so the registry identity scheme doesn't solve resolution precedence.

I would keep R-34 explicitly:

```text
ContentResolution
1. ruleset compatibility/specificity
2. semantic content identity
3. source precedence
4. explicit conflict reporting if precedence cannot resolve
```

This matters immediately for Phase 5.

---

# `Form`, `Option`, and three-valued predicates pass your own generalization test

What I like most about Draft 2 is that these weren't invented because they “might be useful.”

They came from repeated failures:

```text
Form
← Wild Shape / Polymorph / Shapechange

ActivationOption
← GWM / Smite / multiple slot pools

Unknown Predicate
← positioning / visibility / DM judgement
```

The document explicitly says `Option` and three-valued predicates appeared across three unrelated mechanics, satisfying the repeated-pattern threshold. 

That is exactly how I would want Grimoire to evolve.

---

# One more place I'd push back: “24 total types”

The spec now says:

> every domain concept is one of these 24 types or a composition; a new top-level type requires a new observation. 

The discipline is good.

The number is not important.

Don't make “24 types” an architecture constraint.

What matters is:

> A new top-level domain type needs a genuinely new semantic responsibility that cannot be represented by composition of existing primitives.

If the answer eventually becomes 27, that's fine.

---

# My status on Draft 2

I would classify it like this:

| Change | My position |
|---|---|
| `Form` | **Accept, refine shape/HP assumption** |
| Three-valued Predicate | **Accept strongly** |
| `ActivationOption` | **Accept, rename from generic Option** |
| Trigger context payload | **Accept** |
| No automatic clock without combat state | **Accept concept, remove v1/v2 assumption** |
| Roll modifiers beyond advantage | **Accept, model as closed strategies** |
| User-declared trigger source | **Accept** |
| Explicit expression references | **Accept** |
| Non-numeric Effect behavior | **Already implied / confirm R-08** |
| Ten ruleset axes | **Accept as current catalogue, not eternal set** |
| Four-system audit | **Do it, relax pass criterion** |
| Stable Feature identity | **Accept** |
| Fully normalized character runtime state | **Reasonable / likely accept** |
| Fully normalized content | **Do not accept yet** |
| Local permanent uint32 content identity | **Reject as domain invariant; optional optimization** |
| Content precedence R-34 | **Still missing; keep it** |
| Closures + descriptor mutation boundary | **Accept** |
| State-based LAN sync | **Accept** |

So the specification is getting much closer, but it has now shifted from **under-designed mechanics** to a different danger: **over-specifying persistence/identity infrastructure before checking what the current code actually needs.**

The mechanical side is stronger than ever. The database/ID sections are where I would slow down.

**Which should I tackle next: `storage + IDs` critique, the `Form/Option/Predicate` model, or the four-system audit?**