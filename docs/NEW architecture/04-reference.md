# 04 — Reference

Glossary, invariants, data catalog and database implications. Dip in as needed rather than
reading straight through.

---

# Part A — Glossary

**Purpose.** Every term has one meaning and only one, everywhere — in code, in docs, in the
UI, and in conversation. If something cannot be described using these words, then either a
term is missing or the model is wrong. Both are useful to discover.

## A0. Colliding terms — settle these once

D&D's own vocabulary reuses several words. In the vault this already causes trouble; in the
most important case the usage is **inverted relative to the rulebook**.

| Word | Meaning 1 | Meaning 2 | Resolution |
|---|---|---|---|
| **Ability** ⚠ | STR/DEX/CON/INT/WIS/CHA (the rulebook meaning) | "something you can do" (`AbilityDefinition`) | `Stat` = the score; **`Activation`** = the usable thing |
| **Modifier** | `(score − 10) / 2` | any bonus on a roll | `StatModifier` / `Bonus` |
| **Level** | character level | class level | `CharacterLevel` / `ClassLevel` / `SpellRank` |
| **Condition** | Poisoned, Prone | a logical condition | `Condition` for the game only; logic is `Predicate` |
| **Save** | saving throw | writing to disk | `SavingThrow` / `Persist` |
| **Class** | Fighter, Wizard | a programming class | `CharacterClass` / `ClassDefinition` |
| **Action** | action-economy unit | any deed | `ActionCost` / `TurnResource` |
| **Effect** | passive, continuous modification | "what a spell does" | `Effect` is passive only; results are `Outcome` |
| **Source** | the book (PHB, SRD) | where a bonus came from | `SourceBook` / `Origin` |
| **Range** | weapon reach | spell range | `WeaponRange` / `SpellRange` |

⚠ **`Ability` is the dangerous one.** The vault uses `StatId` for STR/DEX and `AbilityId` for
actions — the reverse of the rulebook. Anyone reading the rules and the code together will
mix them up. Agreed resolution: `AbilityDefinition` → **`ActivationDefinition`**.

## A1. Ruleset layer

| Term | Meaning |
|---|---|
| **Ruleset** | One game system (`dnd5e-2014`, `dnd5e-2024`, `pf2e`). Consists of a `RulesetModule` (code) plus ruleset data. |
| **RulesetModule** | The code implementing one system's rules. **The only place game constants live.** |
| **RulesetId** | Identifies a ruleset. Every Entity and every Definition carries one. |
| **OutcomeId** | A category of resolution result. 5e: `hit`, `miss`. PF2e: `critSuccess`, `success`, `failure`, `critFailure`. **The ruleset defines the list.** |

## A2. Content layer — "what can exist"

| Term | Meaning |
|---|---|
| **ContentDefinition** | An immutable description of something that can exist. **Never changes at run time.** |
| **ContentHeader** | The part every definition shares: id, rulesetId, name, description, sourceBook, tags, version. |
| **ContentType** | Class, Species, Background, Feat, Spell, Item, Condition, Monster, Feature. |
| **ContentId** | Identity within `(rulesetId, contentType)`. Typed: `SpellId` is not `ItemId`. |
| **ContentReference** | A pointer to a definition, resolved through the registry. |
| **Pack** | A distributable file of content. Belongs to exactly one rulesetId. |
| **Feature** | **The central concept.** A named bundle of mechanical consequences: passive Effects, Activations, Resources, Choices. Darkvision, Rage and Sneak Attack are all Features. |
| **Feat** | A content type that **grants Features**. A Feat is not a Feature. |
| **Activation** | Something a creature **deliberately uses**. Has ActionCost, Target, Resolution, Outcomes. Fireball, Second Wind and a sword swing are all Activations. |
| **Effect** | A **passive, continuous** modification to derived state: "+2 AC", "darkvision 60ft". **Not an event and not an action.** |
| **Grant** | "This content gives the entity something new." Applies at build and level-up time. |
| **Choice** | A decision the player must make. The result is stored on the Entity. |
| **Predicate** | A logical condition evaluated against a context (self, target, environment). |
| **ResourceDefinition** | A countable, spendable pool: Rage, Ki, spell slots, hit dice, item charges. |
| **ConditionDefinition** | A named state (Poisoned) with its Effects and duration rules. |

## A3. Runtime layer — "what exists now"

| Term | Meaning |
|---|---|
| **Entity** | Any creature that exists. **A player character and a monster are the same type.** |
| **EntityKind** | Character / Monster / NPC / Companion / Summon. |
| **FeatureInstance** | A Feature the entity actually has, with its `Origin`. |
| **ItemInstance** | A specific object: quantity, equipped, attuned, charges, custom name. |
| **ConditionInstance** | A specific condition: who applied it, when it expires, how many stacks. |
| **ResourceState** | `{ definitionId, current, maximum }`. |
| **ChoiceSelection** | A decision that was made, keyed by `(origin, choiceId)`. |
| **Origin** | **Where this came from**: "Fighter level 2", "Elf", "Longsword #82fa". Required for explanation and for removal. |
| **BaseStats** | The stored starting scores. |
| **DerivedStats** | **Computed** state. Never stored. |
| **ResolvedValue** | A computed value plus the list of contributions that produced it. |
| **Contribution** | One term inside a ResolvedValue: `{ amount, origin, label }`. |

## A4. Process layer

| Term | Meaning |
|---|---|
| **Command** | An intent to change state. Travels from UI into Application. |
| **DomainEvent** | A record of **what happened**: `DamageApplied`, `ResourceSpent`. |
| **Trigger** | `DomainEvent → Predicate → response`. This is the piece missing from the notes. |
| **Check / Attack / SavingThrow** | The three kinds of resolution. Each returns an `OutcomeId`. |
| **collectEffects()** | Gather every active Effect from every source. |
| **resolveEffects()** | Combine them according to stacking rules. |
| **recomputeDerived()** | `(Entity, Content, Ruleset) → DerivedStats`. A pure function. |
| **Issue** | A detected problem with a character (missing pack, lapsed prerequisite). **Reported, never silently fixed.** |

---

# Part B — Invariants

**What an invariant is:** a statement that is **always true**. If one is ever violated, that
is a bug — regardless of whether the app appears to work. Invariants are the basis for tests.

## B1. Definition / Instance

| # | Invariant | Why |
|---|---|---|
| **INV-1** | A `ContentDefinition` is **immutable** once loaded. No code path mutates one. | Mutating definitions to hold state is the classic fatal bug in this domain |
| **INV-2** | Everything that changes during play lives on an **instance**, never a definition. | |
| **INV-3** | An instance holds a **reference** to its definition, not a copy — except for a deliberate snapshot. | So pack updates take effect |

## B2. Computed state

| # | Invariant | Why |
|---|---|---|
| **INV-4** | `DerivedStats` is **never persisted**. It is always recomputed. | Two sources of truth drift apart |
| **INV-5** | `recomputeDerived()` is a **pure function**: same input, same output. No I/O, no clock, no randomness. | Testability |
| **INV-6** | Every computed number carries a full trace, and **the contributions sum to the value**. | Directly testable in one line |
| **INV-7** | The **order** in which effects are collected does not affect the result. | Otherwise the same character yields different AC on different runs |
| **INV-8** | Stacking rules are **deterministic and come from the ruleset**, not from whoever authored the effect. | |

## B3. Identity and provenance

| # | Invariant | Why |
|---|---|---|
| **INV-9** | Every `FeatureInstance` knows its `Origin`. | Removing the source removes the feature |
| **INV-10** | Every runtime Effect knows which instance it came from. | Explanation and removal |
| **INV-11** | ContentId is unique within `(rulesetId, contentType)`. | |

## B4. Ruleset

| # | Invariant | Why |
|---|---|---|
| **INV-12** | An Entity belongs to **exactly one** ruleset and never changes it. | |
| **INV-13** | Content from ruleset A is **never** applied to an entity of ruleset B. | |
| **INV-14** | **No game constants in Core.** No `+2`, no `d20`, no `(score − 10) / 2`. All of them live in `Dnd5eRuleset`. | This is the single thing that makes multi-ruleset possible at all |

## B5. Layers and purity

| # | Invariant | Why |
|---|---|---|
| **INV-15** | Core performs no I/O, reads no clock, generates no randomness. RNG is **passed in**. | Testability and determinism |
| **INV-16** | Core does not depend on Application, Infrastructure or UI. | |
| **INV-17** | Every state change goes through a **Command**. The UI never mutates an Entity directly. | Precondition for v2 (DM tools, sync) |
| **INV-18** | Every state-changing Command returns a **new Entity plus a list of DomainEvents**. | |
| **INV-19** | DomainEvents are a **record of the past**. State is not rebuilt from them (this is not event sourcing). | |

## B6. Choices and validation

| # | Invariant | Why |
|---|---|---|
| **INV-20** | A `ChoiceSelection` is keyed by `(origin, choiceId)` and is **never silently discarded**. | The same choiceId legitimately appears twice when multiclassed |
| **INV-21** | If a choice becomes invalid, it is reported as an **`Issue`**; it is not auto-corrected. | Silent correction is data loss |
| **INV-22** | Level-up is a **state with outstanding choices**, not an atomic operation. | |

## B7. Resources and rest

| # | Invariant | Why |
|---|---|---|
| **INV-23** | Always `0 ≤ current ≤ maximum`. | |
| **INV-24** | Rest **knows no specific features**. It emits an event; resources respond for themselves. | |

## B8. Persistence and compatibility

| # | Invariant | Why |
|---|---|---|
| **INV-25** | A character **always opens**, even if a pack is gone — degraded, with a list of Issues. | Losing user data is unacceptable |
| **INV-26** | A saved Entity records the `(packId, version)` of every definition it references. | |

## B9. Dice

| # | Invariant | Why |
|---|---|---|
| **INV-27** | **Every roll the app makes can be replaced by a hand-entered value.** | Many players roll physical dice. This is a product requirement, not an option (see `03`, Q4) |

## B10. Ruleset independence

| # | Invariant | Why |
|---|---|---|
| **INV-28** | Adding a new ruleset requires editing **no UI file**. | The measurable payoff of the standard answer catalog (`02`, section 4) |

## How these become tests

| Invariant | Test |
|---|---|
| INV-6 | For every `ResolvedValue`: `sum(contributions) == value` |
| INV-7 | Same entity, effect list randomly shuffled → identical DerivedStats |
| INV-5 | Same input twice → byte-identical output |
| INV-14 | grep Core for rule constants: `20`, `d20`, `10`, `2` |
| INV-23 | Property test: random spend/restore sequences never breach the bounds |
| INV-25 | Save a character, delete the pack, reopen → opens, with Issues |
| INV-28 | Adding a stub second ruleset compiles and runs without touching UI code |

---

# Part C — Data catalog

> Every claim below that depends on game knowledge is tagged `F-NN` and listed in
> `03-questions-for-author.md` for verification.

## C0. The volume picture — and why it is unusual

| Measure | Size |
|---|---|
| Content records (SRD 5e) | ~1,200 – 1,500 |
| Content records (all official books) | ~8,000 – 12,000 |
| Total content size | **~3–8 MB** (SRD) / ~30–50 MB (everything) |
| One character | ~5–30 KB |
| Characters per user | 1 – 50 |

**The conclusion that changes database design:**

In a typical business system the problem is **volume** — millions of rows, indexes, query
performance. **Here it is the opposite.** The data is small enough that the entire content
set fits comfortably in a phone's memory.

> **The problem is structural variability, not volume.**

So the database is not being optimised for query speed. It is being optimised for
**uniformity, integrity checking and versioning.**

## C1. Fixed primitives

Small closed lists. They come from the ruleset, not from packs. They do not change.

| Type | Count (5e) | Structure |
|---|---|---|
| **Stat** | 6 | `id, caption, abbrev` |
| **Skill** | 18 | `id, caption, statId` |
| **DamageType** | 13 | `id, caption, isPhysical` |
| **Condition** | 15 | `id, caption, effects[]` |
| **ProficiencyLevel** | 3 (none / proficient / expertise) | `id, caption, multiplier` (`F-06`) |
| **RestType** | 2 (short / long) | `id, caption` (`F-17`) |
| **ActionCost** | 4 (action / bonus / reaction / movement) | `id, caption, perTurn` |
| **School** | 8 | `id, caption` |

Variability: **zero.** These can live in code or in a small table. They are precisely what
differs *in count* between rulesets (`F-30`, `F-31`).

## C2. Content types — pack rows

| Type | SRD count | Body variability | Complexity |
|---|---|---|---|
| **Class** | 12 | HIGH | 20 levels x grants |
| **Subclass** | 12 (SRD: one per class) | HIGH | extra progression |
| **Species** | ~9 (+ subspecies) | medium | grants + choices |
| **Background** | 1 in SRD / ~13 full | low | grants |
| **Feat** | 1 in SRD / ~42 full | medium | prerequisite + grants |
| **Spell** | ~320 | **VERY HIGH** | `F-28` — the long tail |
| **Item** | ~300 | medium | categories + embedded Features |
| **Monster** | ~325 | medium | statblock + Features + Activations |

### C2.1 Class — the most complex structure

```
ClassDefinition
├── header                       // id, name, source, tags
├── hitDie                       // d6 | d8 | d10 | d12
├── initialProficiencies[]       // weapons, armour, skills, saves
├── subclassSlots[]              // at which level the subclass is chosen
└── levels[1..20]
     └── ClassLevelDefinition
          ├── grants[]           // Feature | Proficiency | Resource
          ├── choices[]          // ASI/Feat, Fighting Style, Subclass
          └── resources[]        // Rage 3/day, spell slots
```

12 classes x 20 levels = **240 level records**, averaging 1–3 grants each → roughly 400–600
grants, plus subclasses. Features defined by classes: **~400–500**.

### C2.2 Spell — the most variable body

```
SpellDefinition
├── header
├── metadata  (uniform, indexable)
│    level, school, castingTime, range, duration,
│    components (V/S/M), concentration, ritual
└── cast: ActivationDefinition   (VERY variable)
     ├── target
     ├── resolution              // attack | save | none
     ├── outcomes: Map<OutcomeId, Effect[]>
     └── upcasting               // F-14
```

**Key structural finding (`F-28`):** most spells fit a handful of templates, but a meaningful
minority are unique (Wish, Polymorph, Simulacrum, Plane Shift). No data model reaches 100%.
See `03`, Q2.

## C3. Mechanical atoms

Not standalone content types — these are embedded in the types above.

| Atom | Appears in | Approx. count |
|---|---|---|
| **Feature** | Class, Species, Background, Feat, Item, Monster | **~1,500 – 2,500** |
| **Effect** | Feature, Condition | ~2,000 – 3,000 |
| **Activation** | Feature, Spell, Item, Monster | ~800 – 1,200 |
| **Grant** | Class level, Species, Background, Feat | ~800 – 1,200 |
| **Choice** | Class level, Species, Background, Feat | ~150 – 250 |
| **Predicate** | Feat, Effect, Activation, Item | ~300 – 500 |
| **Resource** | Class, Feature, Item | ~80 – 150 |

Feature is the only atom that recurs everywhere. That drives C4.3.

---

# Part D — Database implications

## D1. Envelope / body split

Every content record divides in two:

| | Contains | Variability | Used for |
|---|---|---|---|
| **Envelope** | id, rulesetId, contentType, name, source, tags, version, search fields | zero | SQL: search, filter, sort |
| **Body** | the mechanical definition | VERY HIGH | **never queried by SQL** — loaded whole |

→ **Schema: columns for the envelope, a serialised document for the body.** Normalising the
body is pure cost — it is never needed relationally.

## D2. The whole content set lives in memory

At 3–8 MB, everything loads once into the registry at startup. No lazy loading, no cache, no
query optimisation. This removes a large amount of architecture that would otherwise be
needed.

## D3. Feature is its own table, not embedded

Features appear inside Class, Item, Species and Monster. Two options:

| | Embedded | Own row with an ID |
|---|---|---|
| Search ("where does Darkvision appear?") | impossible | yes |
| Effect source tracing | weak | yes (INV-9, INV-10) |
| Homebrew referencing an existing feature | no | yes |
| UI: open "Action Surge" as a page | no | yes |

→ **Feature gets its own table.** Anonymous inline features receive a synthesised ID at pack
build time.

## D4. Foreign keys cannot protect referential integrity

Content spans multiple pack files. A feat in pack A may reference a feature in pack B; SQL
foreign keys cannot span files.

→ **A validation pass runs when a pack is installed**, returning `Issue[]`.

## D5. Entity is a different kind of data

| | Content | Entity |
|---|---|---|
| Changes | rarely (pack updates) | **constantly** |
| Count | ~1,500 | 1 – 50 |
| Profile | almost read-only | write-heavy |

→ **A separate store.** Envelope in columns (so characters can be listed and searched, and so
INV-25 holds when a ruleset is missing); payload as a document.

## D6. Payload shape — recommended

Two options were considered for the entity payload:

| | Generic structure, ruleset interprets | Opaque blob, ruleset owns the format |
|---|---|---|
| Backup, diff, sync, migration | written once, works for all rulesets | must be rewritten per ruleset |
| Flexibility for exotic rulesets | slightly constrained | maximal |

**Recommended: generic structure** (Stats, Proficiencies, Resources, Features as maps), with
the ruleset supplying meaning rather than format. An `extra: Map<string, Value>` escape hatch
is acceptable, but note the risk that it gradually absorbs everything.

The envelope stays universal in all cases, so a character can always be listed and opened
even when its ruleset or packs are missing (INV-25).
