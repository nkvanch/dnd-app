# 02 — Recommended Approach

This document proposes a way forward and, for each proposal, the reasoning behind it.
Disagree with the reasoning where you think it is wrong — that is more useful than accepting
the conclusion.

---

## 1. The core idea: content is data, rules are swappable code

Problem P1 in `01` established that different game systems differ *structurally*, not just
numerically. There are two obvious responses, and both are traps:

| Response | Why it fails |
|---|---|
| "Hardcode 5e, generalise later" | The content model gets baked into 5e's shape. Every pack and every screen has to be rewritten for the second system. |
| "Make everything data" | Ends in a scripting language and an expression VM — the thing `Dos and don'ts.md` correctly refuses. |

The third path:

> **Content is data. Rules are code — but *replaceable* code.**

Concretely, `RulesetDefinition` is not only a record loaded from a pack. It is an **abstract
class with virtual methods**, and each game system is a subclass.

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

  TDnd5eRuleset = class(TRulesetModule)   // v1 — the only one
  TPf2eRuleset  = class(TRulesetModule)   // v2+ — a separate file, later
```

**Why this resolves the tension in `Dos and don'ts.md`.** No VM is needed, because the rules
are ordinary compiled code. What stays as data is *content* — classes, spells, feats, items —
which is what homebrew authors need to write, and which does not require branching or loops.

This is also how Foundry VTT works: game systems (`dnd5e`, `pf2e`) are separate modules;
content is data.

**Why virtual methods and not overloaded procedures.** Overload resolution happens at compile
time, but the character's ruleset is read from a file at run time. Overloading would
inevitably produce:

```pascal
if E.RulesetId = 'dnd5e' then ... else if E.RulesetId = 'pf2e' then ...
```

which is the exact thing being avoided, and which would appear in fifty places. Virtual
dispatch resolves once, at load, and never again.

---

## 2. Polymorphism solves behaviour, not data shape

This is the limit of section 1, and it is easy to miss.

A virtual method changes **how a number is computed**. It cannot change **what field is
stored on the object.**

```pascal
TCharacter = class
  SkillProficient: array of Boolean;   // 5e
end;
```

No amount of overriding turns `Boolean` into PF2e's five-level rank or 3.5's integer ranks.

So there are two distinct problems, needing two distinct remedies:

| Problem | Example | Remedy |
|---|---|---|
| **Behaviour differs** | how a skill bonus is computed | virtual method |
| **Stored shape differs** | `bool` vs rank vs int | **open shape** — a map, not a field |

### The open-shape remedy

Store one general shape; let the ruleset supply the meaning.

```pascal
TEntity = class
  RulesetId: string;
  Stats:         TDictionary<TStatId, Integer>;
  Proficiencies: TDictionary<string, Integer>;   // the ruleset interprets the value
  // ...
end;
```

`Proficiencies['skill:stealth'] = 2` means different things in different systems:

| System | 2 means |
|---|---|
| 5e | expertise (doubled proficiency) |
| PF2e | expert rank |
| 3.5 | 2 skill ranks |

And then:

```pascal
function TDnd5eRuleset.ProficiencyFor(E, Skill): TResolvedValue;
  // StatModifier + ProficiencyBonus(TotalLevel) * Proficiencies[Skill]

function TPf2eRuleset.ProficiencyFor(E, Skill): TResolvedValue;
  // if Rank > 0 then StatModifier + Level + RankBonus[Rank] else StatModifier
```

**One stored shape. Two interpretations.**

---

## 3. Entity is data, not behaviour

The instinctive design is:

```pascal
TCharacter      = class ... end;
TDnd5eCharacter = class(TCharacter) ... end;   // do not do this
TPf2eCharacter  = class(TCharacter) ... end;
```

Three reasons it fails here:

1. **Entities are serialised.** They go to disk and (in v2) over the network. Deserialising a
   polymorphic object means knowing which class to reconstruct before you have read it.
2. **Combinatorial growth.** Each new ruleset needs a new class for *every* entity kind —
   Character, Monster, NPC, Companion, Summon.
3. **Generic tooling stops working.** Backup, export, diff, search and migration all have to
   downcast, so the polymorphism leaks out of the place it was supposed to be contained.

The correct split:

```
TEntity        = data.      No behaviour, no inheritance, fully serialisable.
TRulesetModule = behaviour. Abstract base plus overrides.
```

The character does not *have* behaviour. It is *passed to* the rules object:

```pascal
Bonus := Ruleset.ProficiencyFor(Character, 'stealth');
```

This is the Strategy pattern. It keeps persistence, sync and tooling simple, and it keeps all
game constants in exactly one place per system.

---

## 4. The standard answer catalog

This is the most important structural idea in this document.

Rather than designing the ruleset interface **bottom-up** ("what do the rules differ on?"),
design it **top-down**: *what questions does the upper layer ask?*

The advantage is stability. Rules differ endlessly between systems, so a bottom-up interface
grows with every system added. But the **questions do not change** — the UI always needs
"what is my AC", "what can I do", "what happened". Those are the same in 5e and PF2e.

> Put the boundary on the **shape of the answer**, not on the shape of the data.

Six answer types cover it:

```pascal
// 1. "What is this number?"  (already in the notes as ResolvedValue - this generalises it)
TResolvedValue = record
  Value:         Integer;
  Contributions: TArray<TContribution>;   // (amount, origin, label)
  Display:       string;                  // '+7' | 'AC 18' | '2d6+3'
end;

// 2. "What goes on the character sheet?"   <-- the highest-value one
TStatGroup = record
  Id, Caption: string;                    // 'saves' / 'Saving Throws'
  Entries:     TArray<TStatEntry>;        // (id, caption, TResolvedValue)
end;

// 3. "What can this character do right now?"
TAvailableAction = record
  Id, Name, CostCaption: string;
  Enabled:        Boolean;
  DisabledReason: TArray<TContribution>;  // why not - explained, same as any other value
  Outcomes:       TArray<TOutcomeDescriptor>;
end;

// 4. The standard reaction: "done - here is the result"
TCommandResult = record
  Entity: TEntity;
  Events: TArray<TDomainEvent>;
  Issues: TArray<TIssue>;
end;

// 5. "What must the player choose?"
TPendingChoice = record
  Id, Prompt: string;
  MinSelections, MaxSelections: Integer;
  Options: TArray<TChoiceOption>;
end;

// 6. "What is wrong?"
TIssue = record
  Severity: (isInfo, isWarning, isError);
  Message, Origin: string;
end;
```

### Why `DescribeSheet` matters most

```pascal
function TRulesetModule.DescribeSheet(E: TEntity): TArray<TStatGroup>; virtual; abstract;
```

| System | Returns |
|---|---|
| 5e | Abilities(6), Saves(6), Skills(18), Defenses(**AC**), Combat |
| 4e | Abilities(6), Defenses(**AC, Fort, Ref, Will**), Skills(17) |
| PF2e | Abilities(6), Saves(3), Skills(17+Lore), Defenses(AC), Perception |

The UI draws groups **without knowing how many there are or what they are called.** One
defence or four — same code.

That gives a testable acceptance criterion:

> **Adding a new ruleset must not require editing a single UI file.**

### Two traps

**Trap 1 — the generic query channel.** The tempting shortcut:

```pascal
function Ask(const Question: string): Variant;   // do not
```

This looks flexible but only relocates the problem. Type checking disappears, and the
branching reappears in the UI as string comparison — which is worse, because the compiler no
longer helps. A standard answer means *a small number of concrete, typed records*, not one
universal question channel.

**Trap 2 — an over-generic UI is ugly.** If everything is drawn from descriptors, the app
becomes a pile of featureless tables. A 5e player wants the familiar sheet.

The resolution, and it is an important relief:

> The rule is **not** "the UI must be generic". The rule is **"the UI reads only standard
> answers"**.

v1 can absolutely have a hand-tuned, attractive 5e sheet. What matters is that every number
on it comes from a `TResolvedValue`, not from an entity field read directly. Then adding a
generic mode later is an evolution rather than a rewrite.

---

## 5. Open shapes — what to change today

These cost almost nothing now and are expensive later.

```pascal
// locks in 5e                          // stays open
StatBlock { Str, Dex, Con,              StatBlock { Stats: Map<StatId, Integer> }
            Int, Wis, Cha }

DerivedStats { AC, Initiative,          DerivedStats {
               Speed: Integer }           Defenses: Map<DefenseId, TResolvedValue>;
                                          Saves:    Map<SaveId,    TResolvedValue>;
                                          Skills:   Map<SkillId,   TResolvedValue> }

AbilityDefinition {                     ActivationDefinition {
  OnHit, OnMiss: [Effect] }               Outcomes: Map<OutcomeId, [Effect]> }

Proficient: Boolean                     Proficiency: Integer (ruleset-interpreted)

ConditionInstance { Active: Boolean }   ConditionInstance { Stacks: Integer }   // F-11
```

Note that `DerivedStats` in `Derived stats.md` **already does this correctly** — it uses
`StatMap`, `SaveMap`, `SkillMap`, `DefenseMap` rather than fixed fields, with the reasoning
spelled out. The recommendation is to apply that same instinct consistently everywhere else.

---

## 6. The decision rule

So that this does not have to be re-derived each time:

| The difference is in... | Remedy |
|---|---|
| **how a number is computed** | virtual method on `TRulesetModule` |
| **what is stored on the entity** | open shape — a map, not a field |
| **what content exists** | data — a pack |
| **how many outcomes a roll has** | ruleset descriptor + `Map<OutcomeId, ...>` |
| **what the sheet shows** | `DescribeSheet` returning `TStatGroup[]` |

Two guard-rails:

- **Keep the interface small.** If `TRulesetModule` grows to 200 virtual methods it becomes
  unusable — every new system would mean writing 200 overrides. Target **10-15 methods.**
  Everything else must fit in content data.
- **Some differences resist both remedies.** PF2e's multiclassing is a chain of feats, not
  class levels. No virtual method fixes that; the *content model* has to be general enough
  (progression as a list of grants and choices per level, which archetypes also fit). Virtual
  methods are necessary but not sufficient — open data shapes are the second half.

---

## 7. How the generality gets made concrete again

A fair objection to all of this: *"generalised code is vague and hard to work with."* The
answer is that generality lives at the **boundary**, and each side of the boundary stays
concrete.

```
        CONCRETE                    GENERAL                   CONCRETE
   ┌──────────────────┐      ┌──────────────────┐      ┌──────────────────┐
   │  Dnd5eRuleset    │ ---> │  TResolvedValue  │ ---> │  5e sheet screen │
   │                  │      │  TStatGroup      │      │                  │
   │  d20 + mod +     │      │  TAvailableAction│      │  AC box          │
   │  proficiency,    │      │  TCommandResult  │      │  6 save rows     │
   │  written plainly │      │                  │      │  18 skill rows   │
   └──────────────────┘      └──────────────────┘      └──────────────────┘
      ordinary code            6 record types            ordinary screens
      no abstraction            the only general           laid out by hand
                                    part
```

Inside `TDnd5eRuleset` you write plain, direct 5e code — no indirection, no interpretation,
no cleverness:

```pascal
function TDnd5eRuleset.ProficiencyBonus(TotalLevel: Integer): Integer;
begin
  Result := 2 + (TotalLevel - 1) div 4;
end;
```

That is as concrete as code gets. The generality is *only* in the six answer types in the
middle. That is what keeps the design workable rather than abstract for its own sake.

And when PF2e eventually arrives, its module is equally concrete — its own file, its own
plain code — and nothing on either side of the boundary has to move.

---

## 8. Proposed sequence

| Stage | Work | Done when |
|---|---|---|
| **1. Thought-testing** | Walk ~15 real 5e cases through the model on paper (Rage, Sneak Attack, Divine Smite, Concentration, Unarmored Defense, Wild Shape, Counterspell, multiclass slots, ...). Wherever it breaks, that is a gap. | Every case expressible without hardcoding, or the gap is written down |
| **2. Refine** | Fold in what stage 1 broke: `TriggeredActivation`, stacking model, duration/concentration, expression limits | The five problems from `01` have designs |
| **3. Specification** | Glossary, invariants, core types, `TRulesetModule` interface, decisions written down with reasons | Fighter/Wizard/Rogue levels 1-5 fully describable in data alone |
| **4. Architecture + database** | Layers, pack schema, entity persistence, migrations, versioning policy, **technology decision** | SRD Fighter fits the schema with no information loss |
| **5. Vertical slice** | SRD Fighter 1-5 + Elf + 5 items → derived stats with traces → damage / rest / level-up → content browser | Hand-computed level-5 Fighter matches the app, with full trace |

Stages 1-3 are **independent of the programming language**. They can proceed before the
technology question is settled, and they will make that question easier by revealing how
complex the model actually is.

---

## 9. Technology

### Requirements

- Android, iOS and Windows from one codebase (D2)
- Shipping the app is the priority (D3)
- Offline-first, local SQLite
- **Heavy use of sum types.** The whole design rests on
  `Effect = A | B | C`, `Grant = ...`, `Predicate = ...`. A language that expresses these
  well roughly halves the work; one that does not adds a large amount of boilerplate to the
  *core* of the project, not its edges.
- Serialisation of deeply nested variant structures

### Options

| | Android/iOS/Windows | Sum types | Serialisation | For a self-teaching developer |
|---|---|---|---|---|
| **Flutter / Dart** | all three, strong | sealed classes + pattern matching (Dart 3) | `freezed`, `json_serializable` | Best: hot reload, very large amount of learning material |
| **Kotlin Multiplatform + Compose** | all three (iOS needs a Mac) | **best in class** — sealed interfaces, exhaustive `when` | **best in class** — `kotlinx.serialization` | Good language, fiddlier setup |
| **C# / .NET + Avalonia** | all three | records + switch expressions, adequate | `System.Text.Json` | Good, slightly heavier than Flutter on mobile |
| **C++ / Qt** | all three, iOS painful | `std::variant` — verbose | manual, large amount of boilerplate | Hardest path |
| **Delphi / C++Builder (FireMonkey)** | all three genuinely | Object Pascal has no sum types; variant records are awkward | manual | Depends heavily on prior familiarity |

### On RAD Studio specifically

Since C++Builder is under consideration, a fair assessment:

**In favour.** FireMonkey genuinely targets Windows, Android and iOS from one codebase.
FireDAC has good SQLite support. If you already know the tool, the learning cost is zero,
and that is a real advantage — it is not a small factor.

**Against, for this particular project.**

- **Sum types.** `Effect`, `Grant` and `Predicate` as tagged unions are the *core* of the
  design, not a detail. Object Pascal expresses them poorly (variant records), and
  C++Builder inherits C++'s verbose `std::variant`.
- **Serialisation.** Writing deeply nested unions to and from SQLite by hand is a large
  amount of boilerplate and a steady source of bugs.
- **Ecosystem.** For someone learning, this matters practically: how many examples, answers
  and tutorials exist when you get stuck.
- **Cost.** RAD Studio licensing is significant. The Community Edition exists with revenue
  and single-developer limits — worth checking the current terms if this is the direction.

**One fact that applies to every stack:** building and signing for iOS requires a Mac
(for RAD Studio, via PAServer). This is not a technology choice; it is a hardware
prerequisite.

### Recommendation

If the priority is shipping on three platforms and the stack is genuinely open:
**Flutter / Dart**, with Kotlin Multiplatform as the close alternative if the domain modelling
is valued above ease of setup.

But this is the author's decision, and **it does not need to be made now.** Stages 1-3 above
produce the same artefacts regardless of language.

---

## 10. Notes for an ambitious developer

Offered as observations rather than advice; take what is useful.

**1. The instincts in these notes are good, and that is not a small thing.** Definition vs
instance, refusing to hardcode content, putting explainability in the core, refusing a
scripting VM — these are decisions that shipped commercial products get wrong. Whatever
happens to this specific project, that judgement transfers.

**2. The main risk is not being wrong. It is not finishing.** Ambitious projects rarely die
from bad architecture; they die from scope. Every feature added before the first one works
end-to-end pushes "working" further away.

**3. Build the narrow thing completely before the general thing.** You cannot generalise well
from one example you have not built. Write 5e completely, and the second system will *tell*
you what the abstraction should be. Abstractions designed before the second case exists are
almost always wrong, and worse, they are confidently wrong.

**4. Make it run early, and keep it running.** A rough vertical slice that works end-to-end
teaches more than three perfect layers that have never executed. Layers cannot be tested
against reality until something calls them.

**5. Invariants are thinking tools, not chores.** The list in `04-reference.md` is not
paperwork — it is the test list. "Contributions sum to the value" is one line of code and it
guards the entire explainability system.

**6. Explainability is the differentiator, and also the best debugger you will have.** When
AC comes out wrong at 2am, a contribution list tells you which effect misbehaved instantly.
Without it you are reading code.

**7. Write decisions down, with the reason.** In six months you will not remember why
`OutcomeId` is a map key rather than two fields, and you will be tempted to "simplify" it.
One paragraph per decision is enough.

**8. The long tail is normal, not a failure.** No rules engine covers 100% of the content.
Foundry uses JavaScript for the remainder. Decide the coverage target deliberately, provide
an honest escape hatch (free text plus manual toggles), and stop feeling bad about it.

**9. Get one real user early.** One friend using it at an actual game session will surface
more than months of design. Real play finds things design does not — mostly around what is
annoying rather than what is wrong.

**10. Resist the rewrite.** Once the whole thing is understood, there is a powerful urge to
start again "properly". That urge is close to universal and it is usually wrong: the second
version accumulates its own mess and costs the working version. Refactor in place instead.

**11. On the licensing question.** SRD 5.1 and 5.2 are CC-BY-4.0, so they can be shipped with
attribution. Content outside the SRD cannot. Design the pack system so users import or author
that content themselves — this is both the legal answer and, conveniently, the same
architecture homebrew needs.
