# Grimoire — Specification

**Status: complete — all 11 sections. Draft 2.**

| § | Contents | State |
|---|---|---|
| 1 | Requirements and constraints | ✅ this document |
| 2 | Domain model from first principles | ✅ this document |
| 3 | Layers and dependency rules | ✅ this document |
| 4 | Ruleset extension model | ✅ this document |
| 5 | Data and identity | ✅ this document |
| 6 | Persistence — database schema | ✅ this document |
| 7 | Computation pipeline | ✅ this document |
| 8 | Mutation, history, synchronisation | ✅ this document |
| 9 | Content pack format | ✅ this document |
| 10 | Invariants | ✅ this document |
| 11 | Conformance checklist | ✅ this document |

---

## 0. How to read this document

### 0.1 What this is

This is a specification of the system described in your vault notes, **written
independently of your existing implementation.**

We have not seen your code. That is deliberate. If we had read it, this document would
have drifted towards describing what is already there, and it would then be useless for
the one purpose it has: giving you something external to compare against.

So this is not a review of your code, and nothing in it is a claim that your code is
wrong. It is a second, independent derivation of the same system, done from the same
requirements. Where it agrees with what you built, you gain confidence. Where it differs,
**one of the two is wrong and you now know exactly where to look.** Sometimes it will
be this document.

### 0.2 How it is written

Every statement that can be checked is numbered — `S-1.4`, `S-2.11`, and so on. A
numbered statement is a claim about the system that is either true of an implementation
or false of it. Section 11 collects them all into a checklist you can walk through against
your own code.

That is why the prose is written the way it is. Descriptive text explains *why* a
statement is there; the numbered statement is what you actually check.

Three markers appear throughout:

| Marker | Meaning |
|---|---|
| `F-NN` | Depends on a domain fact from `03-questions-for-author.md`. **Still unverified.** If the fact is wrong, the statement changes. |
| `⊕` | This statement costs almost nothing now and is expensive to retrofit. |
| `◇` | Genuine design freedom. We state a position but the reasoning, not the conclusion, is what matters. |

### 0.3 Relation to the other documents

`01`, `02` and `05` were written before we knew an implementation existed, and `06`
reconciles them with your answers. **This document supersedes all four** where they
conflict, because it is the first one written with the full picture: your answers, your
stack decision, and the storage decision that came after them.

Two things settled after `06` and are used here without further argument:

- **Identity.** Content identity is a string in authoring and exchange, and a fixed-width
  numeric handle at runtime and in the database. Section 5 covers this properly.
- **Storage.** All persistent data lives in a normalised SQLite schema. No JSON document
  columns. Section 6 covers this properly.

> ⚠️ **One thing you agreed to has since been withdrawn from our side.** You accepted
> `R-27` in `06` — content stored as an indexed envelope plus a serialised body. **We no
> longer hold that position.** It is weak for characters in particular: a single point of
> damage rewrites the whole record, row-level difference-based synchronisation becomes
> difficult, undo granularity is coarse, and nothing is queryable. Section 6 replaces it
> with full normalisation and gives the argument in detail. We are flagging it here rather
> than letting the contradiction sit between two documents you have both accepted.

## 0.4 What changed in Draft 2, and why

Draft 1 was written, then tested — and it broke in five places.

After sending Draft 1 we ran the model on paper against fifteen real 5e mechanics: Unarmoured
Defense on a Barbarian/Monk multiclass, Rage, Sneak Attack, Divine Smite, concentration,
stacked armour-class sources, Great Weapon Master, Extra Attack across two classes, Wild
Shape, Counterspell, Warlock pact magic beside Wizard slots, the multiclass slot table,
Elven Accuracy, Exhaustion, and the level-4 choice between an ability increase and a feat.

Six fitted unchanged. Four fitted with tension. **Five did not fit.**

That is the result the exercise was for. Nothing here was found by looking at your code — it
was found by testing our own document, which is what a specification is supposed to survive.

### The nine changes

| | Change | Found by |
|---|---|---|
| **G1** | **Entity form replacement** — an entirely missing mechanism. Added as a type, a schema table and a sourcing rule | Wild Shape |
| **G2** | **Predicates are three-valued** — `true` / `false` / **`unknown`**. The application often cannot know | Sneak Attack, Counterspell, Divine Smite |
| **G3** | **Activation options** — decisions made at the moment of use, not written into content | Great Weapon Master, Divine Smite, Warlock slots |
| **G4** | The evaluation context includes **the triggering signal's data**, not only entity state | Concentration |
| **G5** | In v1, durations are **recorded but not advanced** — there is no clock | Rage, Sneak Attack |
| **G6** | **Roll modifiers beyond advantage** are a ruleset-declared set with a defined application order | Elven Accuracy, Reliable Talent |
| **G7** | Trigger signals declare their **source**, including "the user said so" | Counterspell |
| **G8** | Reference kinds are an **explicit list** and include derived values | Unarmoured Defense |
| **G9** | Effect operations are **not all numeric** | Exhaustion |

`G2` and `G3` each surfaced in three independent mechanics. That is what makes them
structural rather than special cases — and it is the condition `S-1.18` names for promoting
something into the model.

### If you already answered section 11

Two questions are new (`A15`, `A16`) and three are added lower down (`C24`, `C25`, `D16`).
Nothing previously asked has changed its meaning. **Everything you have already answered
still stands.**

---

# 1. Requirements and constraints

This section fixes what the system must do before any structure is proposed. Everything
in sections 2–11 exists to satisfy something stated here. If a requirement here is wrong,
that is the cheapest possible place to find out.

## 1.1 What the application is

> **Grimoire is a character sheet that knows the rules.**

That sentence is the whole product, and it is worth being precise about the two halves,
because most of the difficulty lives in the second one.

A *character sheet* is a record: numbers, lists, and check-boxes describing one creature.
A paper sheet is exactly this and nothing more — it stores, but does not compute.

*Knowing the rules* means the application can answer questions about that record which the
sheet itself does not contain: what your Armour Class actually is once every source has
been accounted for, which of your abilities you can use right now, what happens when you
use one, and what the consequences are for everything else on the sheet.

Everything hard about this project comes from the second half. Storage is easy at this
scale. **Computation that is correct, explainable, and not welded to one game system is
not.**

| # | Statement |
|---|---|
| **S-1.1** | The application is authoritative about derived values: the user never has to compute a number the application already knows. |
| **S-1.2** | The application is *not* authoritative about the fiction. It never blocks a legal-in-the-fiction action because its model disagrees; it reports a problem and continues. |

`S-1.2` is a product stance, not a technical one, and it recurs throughout the design. The
alternative — a system that enforces its own model — fails the moment a table plays with
a house rule, which is most tables.

## 1.2 Users and scope

| Version | User | Capability |
|---|---|---|
| **v1** | Player | Build, view, and play one character |
| **v2** | Dungeon Master | Multiple creatures, combat tracking, monsters, encounter state |
| **v2** | Table | Sharing state between devices on a local network |

The scope decision `D1` says v1 is players only, **and that v2 must slot in without a
rewrite.** Those two halves pull against each other, and how the tension resolves is a
structural decision, not a scheduling one.

The naïve reading of "players only" is: build the system around one character. That is
the trap. A system built around a single implicit current character requires surgery at
every layer to hold more than one, and the surgery lands in exactly the places that are
hardest to change — the computation core and the storage schema.

The correct reading is narrower and much cheaper:

| # | Statement | |
|---|---|---|
| **S-1.3** | The core operates on a set of entities. Nothing in it assumes there is exactly one, or that one of them is special. | ⊕ |
| **S-1.4** | "Player mode" is a v1 *user interface* restriction — one entity is shown — not a core capability restriction. | ⊕ |
| **S-1.5** | Combat, initiative order, and encounter state are v2 and are not modelled in v1. | |
| **S-1.19** | v1 has no clock. Durations and turn-scoped limits are **recorded and displayed, but never advanced automatically** — the user ends them. | |

`S-1.19` was added in Draft 2. Rage lasts ten rounds and ends early if you have not attacked
or taken damage since your last turn; Sneak Attack applies once per turn. Both are expressible
in the model, and **neither can be counted in v1**, because counting requires the turn
structure that `S-1.5` defers.

The resolution is to keep the data and drop only the automation. The duration is authored,
stored, and shown — *"about 10 rounds"* — and the user says when it ends. If instead v1
omitted the duration data, v2 would arrive to find that no content had ever recorded it.

The distinction between `S-1.3` and `S-1.5` is the point. Being multi-entity from the
first day costs approximately nothing — it means a collection where you would otherwise
have a variable. Modelling combat in v1 costs a great deal and buys nothing. **Make the
shape v2-ready; do not build v2's features.**

## 1.3 Functional requirements

These are grouped by the question each answers. Grouping this way is not cosmetic: section
2 derives the domain model directly from these groups, and section 4 uses the same grouping
to define what a ruleset must supply.

### FR-A — Content

| # | Requirement |
|---|---|
| **FR-A1** | Load game content (classes, species, backgrounds, feats, spells, items, conditions, monsters) from distributable files. |
| **FR-A2** | Load more than one content file at once, including files from different authors. |
| **FR-A3** | Browse and search content independently of any character. |
| **FR-A4** | Let the user author their own content, in the same form as distributed content. |
| **FR-A5** | Report, rather than hide, content that is broken or refers to things that are not installed. |

### FR-B — Character construction

| # | Requirement |
|---|---|
| **FR-B1** | Create a character by choosing from installed content. |
| **FR-B2** | Advance a character in level, presenting the choices that advancement offers. |
| **FR-B3** | Retain every choice made, together with what prompted it. |
| **FR-B4** | Detect when a character no longer satisfies a requirement, and report it without silently altering the character. |
| **FR-B5** | Allow a character to be revised after the fact (re-specification), with the same validation applied. |

### FR-C — Derived state

| # | Requirement |
|---|---|
| **FR-C1** | Compute every derived value on the sheet from stored state plus content. |
| **FR-C2** | For any derived value, show every contribution to it and where each came from. |
| **FR-C3** | Recompute correctly when anything the value depends on changes. |
| **FR-C4** | Present temporary modifications (conditions, ongoing effects) as part of the derived value, distinguishable from permanent ones. |

`FR-C2` is the requirement most likely to be underestimated. It is not a debugging
convenience — it is the feature that makes the application trustworthy to a player who
can do the arithmetic themselves and will notice when the number is wrong. It is also
the single requirement with the widest structural reach: it constrains what a computed
value *is* (§2, §7), what the core is allowed to do while computing (§3), and how the
computation is ordered (§7). Retrofitting it into a system that returns bare integers
means touching every calculation in the system.

| # | Statement | |
|---|---|---|
| **S-1.6** | Every derived numeric value carries its contributions with it. Explainability is a property of the value, not a separate reporting path. | ⊕ |

### FR-D — Play

| # | Requirement |
|---|---|
| **FR-D1** | Present what the character can do now, filtered by what is actually available. |
| **FR-D2** | Perform an action and apply its consequences to the character. |
| **FR-D3** | Track expendable resources: spend, restore, and enforce bounds. |
| **FR-D4** | Apply and remove states that modify the character (conditions, ongoing effects). |
| **FR-D5** | Track duration and expiry for anything temporary. |
| **FR-D6** | Handle rest, restoring what each resource declares that rest restores. |
| **FR-D7** | Roll dice when needed — **and accept a manually entered result anywhere a roll would occur.** |
| **FR-D8** | Record what happened, in a form the user can read and refer back to. |
| **FR-D9** | Undo recent changes. |

`FR-D7` is a product requirement and not an option. A large share of the intended users
roll physical dice at the table and type the result in. An application that only supports
its own generator is unusable for them at exactly the moments that matter most.

| # | Statement | |
|---|---|---|
| **S-1.7** | Every random draw the system makes is substitutable by a supplied value, through the same interface, with no separate code path. | ⊕ |

`FR-D8` and `FR-D9` sound like one feature and are two. The history the user reads is a
narrative record that persists — it survives closing the application, and entries are
never removed because they are old. Undo is a bounded technical facility for reversing a
mistake made moments ago. Conflating them produces either an unbounded memory cost or a
history that quietly deletes itself.

| # | Statement |
|---|---|
| **S-1.8** | The user-visible history and the undo facility are separate mechanisms with separate lifetimes. |

### FR-E — Persistence and portability

| # | Requirement |
|---|---|
| **FR-E1** | Characters survive application restart, update, and content changes. |
| **FR-E2** | A character opens even when content it refers to is missing — degraded, with the problems listed. |
| **FR-E3** | Content updates do not silently change an existing character's numbers. |
| **FR-E4** | Characters can be exported and imported. |

`FR-E2` deserves emphasis because the obvious implementation violates it. If loading a
character means resolving every reference and failing on the first one that is missing,
then uninstalling one content file destroys access to a character that took hours to
build. **Data loss is never an acceptable response to a missing reference.**

| # | Statement |
|---|---|
| **S-1.9** | Loading a character never fails because of missing or changed content. Unresolvable references become reported problems, and the rest of the character loads. |

## 1.4 Quality requirements

| # | Requirement | Consequence |
|---|---|---|
| **NFR-1** | **Offline by default.** Full function with no network. | Content ships as files; no server dependency anywhere in the core paths. |
| **NFR-2** | **Determinism.** Same inputs, same outputs, always. | No wall-clock time, no ambient randomness, and no iteration-order dependence inside computation. |
| **NFR-3** | **Explainability.** Any number can be justified. | See `S-1.6`. |
| **NFR-4** | **Responsiveness.** Interaction feels immediate on a mid-range phone. | Achievable by a wide margin at this data scale — see 1.5. |
| **NFR-5** | **Data durability.** User content and characters are never lost by application action. | Bounded blast radius on any write; no whole-record rewrite for a small change. |
| **NFR-6** | **Extensibility to further rule systems** without modifying the user interface or the core. | The subject of §4. |

`NFR-2` is worth stating as a design rule rather than an aspiration, because both ways of
violating it are easy and neither is obvious:

| # | Statement | |
|---|---|---|
| **S-1.10** | Computation reads no clock and generates no randomness. Both are supplied as inputs. | ⊕ |
| **S-1.11** | The result of computation does not depend on the order in which sources were collected, nor on the memory addresses or insertion order of any container. | ⊕ |

`S-1.11` is the one that gets violated by accident. Iterating a hash-based container gives
an order that can differ between runs, platforms, or library versions; if the computation
is order-sensitive anywhere, the same character produces different numbers on the phone
and on the desktop, intermittently. §7 specifies the ordering discipline that prevents it.

## 1.5 Constraints

### 1.5.1 Platform

Android, iOS, Windows (`D2`). Two consequences follow from iOS that are worth stating in
the specification rather than discovering later:

- **Building for iOS requires a Mac.** This is Apple's constraint and no choice of
  framework avoids it.
- **Framework licensing must be checked for iOS specifically.** Qt under LGPL requires
  dynamic linking, which interacts awkwardly with iOS packaging. This is a real question
  with a real answer, and the answer should be found before the first release build, not
  during it.

### 1.5.2 Data scale — and why it inverts the usual advice

| Measure | Size |
|---|---|
| Content records, SRD 5e | ~1 200 – 1 500 |
| Content records, all official material | ~8 000 – 12 000 |
| Total content volume | ~3–8 MB (SRD) / ~30–50 MB (full) |
| One character | ~5–30 KB |
| Characters per user | 1 – 50 |

This is a *small* dataset. The entire content corpus fits comfortably in the memory of a
low-end phone, with room to spare.

That single fact removes an entire category of design work. There is no need for lazy
loading, query optimisation, caching layers, or pagination. All content is loaded once
at startup into memory and stays there.

| # | Statement |
|---|---|
| **S-1.12** | All installed content is loaded into memory at startup. Content lookup at runtime is an in-memory operation, never a query. |
| **S-1.13** | The database exists for durability and structured change, not for query performance. |

`S-1.13` is the sentence that keeps the schema honest. When performance is not the reason
for a schema decision, correctness and granularity of change are — which is precisely the
argument for normalisation in §6.

> **The problem in this project is structural variability, not volume.** Optimising for
> throughput here is effort spent on a problem that does not exist, and it usually costs
> exactly the flexibility that the real problem requires.

### 1.5.3 Content licensing

| Material | Status |
|---|---|
| SRD 5.1 / 5.2 | CC-BY-4.0 — redistributable with attribution |
| Non-SRD official material | Not redistributable |
| User-authored content | The user's own |

| # | Statement |
|---|---|
| **S-1.14** | The application ships only content it is licensed to distribute. Everything else is a file the user supplies. |
| **S-1.15** | Nothing in the architecture distinguishes shipped content from user-supplied content, other than provenance metadata. |

`S-1.15` is doing real work. It means the mechanism by which the application's own content
is defined is the same mechanism a user has for defining theirs. If that is true, the
authoring path is exercised constantly during development instead of being a
rarely-tested afterthought — and homebrew stops being a second, weaker route into the
engine.

### 1.5.4 Technology

C++20, CMake, Qt 6 / QML, SQLite, Asio.

This specification is deliberately written so that almost none of it depends on that
choice. Where the language matters — and there are two places where it genuinely does,
both concerning how variant types are represented — it is called out explicitly. Elsewhere,
the structure would be the same in any statically typed language.

| # | Statement |
|---|---|
| **S-1.16** | No domain concept in the core is defined in terms of a framework type. Framework types do not appear in core signatures. |

## 1.6 Non-goals

Stating these matters as much as stating the requirements. Each is something a reasonable
person might assume is in scope, and each would materially change the design.

| # | Non-goal | Why |
|---|---|---|
| **NG-1** | A virtual tabletop — maps, tokens, movement, line of sight | A different application with a different core. |
| **NG-2** | A rules *scripting* language exposed to users | §4 and §7 explain the alternative. A scripting VM is a large, permanent commitment with sandboxing, versioning and debuggability costs. |
| **NG-3** | Automating the Dungeon Master's judgement | `S-1.2`. |
| **NG-4** | Cloud accounts, sync services, multi-user identity | `NFR-1`. Local sharing (v2) is not the same thing. |
| **NG-5** | Complete coverage of every published rules element | A product decision, still open, and one only you can make — see 1.7. |

## 1.7 The one requirement that is not yet decided

`NG-5` is the load-bearing open question in the entire specification, and it is a product
decision rather than a technical one.

The shape of the problem is this: content in these games is not uniformly complex. The
large majority of spells, features and items follow a small number of mechanical patterns
that a data model can represent completely. A minority — meaningful in size, small in
proportion — do something structurally unique. `Wish` is the extreme case, but it is not
alone.

**No data model reaches one hundred per cent.** That is not a failure of modelling; it is a
property of the material, which was written for human referees rather than for machines.

So there are only three possible strategies, and the choice among them is yours:

| Strategy | Description | Cost |
|---|---|---|
| **Model everything** | Extend the model until every case fits | Unbounded. The model becomes a scripting language by accident — the thing `NG-2` rejects, arrived at without ever deciding to. |
| **Model the common, describe the rest** | Structured mechanics for what fits; descriptive text plus manual adjustment for what does not | Bounded and honest. Some content is text the user acts on themselves. |
| **Restrict the content** | Ship only what the model represents | Bounded, but the missing items are frequently the memorable ones. |

The second is recommended, with one addition that makes it work rather than merely
survive:

| # | Statement | |
|---|---|---|
| **S-1.17** | Content that cannot be fully modelled is representable as descriptive text with a manual adjustment facility, and is marked as such. It is never silently misrepresented as modelled. | ◇ |
| **S-1.18** | A pattern is promoted from manual handling into the model when it has appeared often enough to be recognised — the model follows observed demand rather than anticipating it. | ◇ |

`S-1.18` is your `R-22` restated as a specification statement. It is the discipline that
stops `S-1.17` from becoming an excuse, and it is also the answer to the perennial "should
I generalise this?" question: **not yet, and here is the specific condition under which
the answer changes.**

**This depends on `F-28`, which is still unverified** — specifically, what proportion of
content is actually unusual. That number determines whether "model the common" covers 95%
of a player's experience or 70%, and those are different products.

---

# 2. Domain model from first principles

## 2.1 Method

This section does not begin from D&D and it does not begin from your notes. It begins from
the requirements in section 1, and derives the types that are necessary to satisfy them.

The reason for working this way is specific. A model derived from one game's vocabulary
inherits that game's assumptions invisibly — not as decisions anyone made, but as shapes
that seemed natural because that was the only game in view. Those assumptions surface years
later as the reason a second rule system will not fit.

Each subsection below states an observation about the requirements, then names the type
that observation forces into existence. If an observation is wrong, the type it produced
is wrong, and you can see immediately which one.

## 2.2 The four questions

Every functional requirement in 1.3 reduces to one of four questions asked of a character:

| | Question | From |
|---|---|---|
| **Q-A** | *What is true of this character right now?* | FR-C |
| **Q-B** | *What can this character do right now?* | FR-D1 |
| **Q-C** | *What happens if they do it?* | FR-D2 … FR-D6 |
| **Q-D** | *How did we get here, and why is that number what it is?* | FR-C2, FR-D8 |

These four questions are the same in every d20-family rule system. **The answers differ;
the questions do not.** That asymmetry is the foundation of the entire design, and it is
where the layer boundary belongs — a point section 3 develops and section 4 depends on.

| # | Statement | |
|---|---|---|
| **S-2.1** | The interface between the rules and everything above them is defined by the *shape of the answers* to Q-A … Q-D, not by the shape of the underlying data. | ⊕ |

## 2.3 Observation 1 — described versus present

Content describes what *can* exist: the Longsword, the Fighter class, the Fireball spell.
There is one description of the Longsword no matter how many exist in the world.

A character has things that *do* exist: this particular longsword, with these charges, in
this character's hands.

These are different in kind, not merely in scope. The description never changes during
play. The instance changes constantly.

> **Type 1: `Definition`** — an immutable description of something that can exist.
> **Type 2: `Instance`** — a specific existing thing, referring to its definition.

| # | Statement | |
|---|---|---|
| **S-2.2** | Definitions are immutable after loading. No code path modifies a definition. | ⊕ |
| **S-2.3** | Everything that changes during play lives on an instance. | ⊕ |
| **S-2.4** | An instance stores a *reference* to its definition, not a copy — except where a snapshot is deliberately taken (see §5). | |

Storing state on a definition is the characteristic failure of this domain, and it does
not announce itself. It works perfectly with one character. It produces two characters who
share a longsword's remaining charges. The bug appears months after the mistake, in a
feature unrelated to the one that caused it.

`S-2.4` has a real cost that must be acknowledged: because instances hold references,
updating content changes existing characters. That is usually what you want (a corrected
spell description should appear everywhere) and occasionally what you do not (a rebalanced
spell should not silently alter a character mid-campaign). §5 resolves this with pinning
and snapshots. The point here is that the reference is the default and the copy is the
exception, not the reverse.

## 2.4 Observation 2 — stored versus computed

Look at any character sheet and every number on it falls into exactly one of two
categories:

- **Stored**: someone wrote it down and nothing derives it. Ability scores as chosen at
  creation. Current hit points. Which items are carried.
- **Computed**: it follows from stored values plus the rules. Armour Class. Attack
  bonuses. Saving throw modifiers. Maximum hit points (`F-07`). Skill modifiers.

The distinction is not a matter of convenience. Storing a computed value creates a second
source of truth, and the two sources diverge — not hypothetically, but reliably, the first
time something changes through a path that forgot to recompute.

> **Type 3: `BaseState`** — what is stored.
> **Type 4: `DerivedState`** — what is computed, never stored.

| # | Statement | |
|---|---|---|
| **S-2.5** | Derived values are never persisted. They are recomputed from base state plus content. | ⊕ |
| **S-2.6** | Computing derived state is a pure function of (base state, content, ruleset). | ⊕ |

`S-2.6` is what makes the system testable at all. A pure function can be verified by
comparing its output against a value computed by hand, which is the only verification
method available for a domain where correctness means "matches what the rulebook says".

The obvious objection to `S-2.5` is performance: recomputing on every read. At this data
scale (1.5.2) a full recomputation is a few thousand arithmetic operations over data
already in memory — far below the threshold of perception. **If it ever becomes a real
cost, caching a derived value is a safe, local optimisation. Storing one is not.** The
difference is that a cache can be discarded at any time without loss.

## 2.5 Observation 3 — every computed number has sources

`FR-C2` requires that any derived number can be explained. That requirement, taken
seriously, changes what a computed value *is*.

If `armourClass` is an integer, the explanation has to be reconstructed afterwards by
re-running the calculation while recording what happened. That means two code paths that
must agree — the fast one and the explaining one — and they will not stay in agreement.

If instead the computed value carries its sources, there is one path and no possibility of
divergence.

> **Type 5: `Contribution`** — one source's effect on a value: an amount, where it came
> from, and how it applied.
> **Type 6: `ResolvedValue`** — a final value together with the ordered contributions
> that produced it.

| # | Statement | |
|---|---|---|
| **S-2.7** | Computed values are returned as value-plus-contributions. There is no separate "explain" operation. | ⊕ |
| **S-2.8** | For any `ResolvedValue`, applying its contributions in order reproduces its value exactly. | |

`S-2.8` is mechanically testable, and it is worth making a permanent test rather than a
one-off check: it catches any calculation that quietly bypasses the contribution
mechanism, which is the only way explainability rots.

Note that `S-2.8` says *applying in order*, not *summing*. Not every contribution is an
addition — some set a value, some multiply, some clamp (`F-04`, `F-05`, `F-12`, `F-25`).
The contribution record must therefore carry the operation, not just a number. §7 defines
the operations and the order in which they apply.

## 2.6 Observation 4 — contributions come from named things

A contribution does not appear from nowhere. It comes from something with a name that the
user recognises: *Ring of Protection*, *Rage*, *Unarmoured Defense*, *Poisoned*.

These named things are not all the same category of object from the game's perspective —
one is an item, one a class feature, one a condition. But mechanically they are identical:
each is a named bundle of consequences.

> **Type 7: `Feature`** — a named bundle of mechanical consequences.

This is the single most important unification in the model. A class feature, a species
trait, a feat's effect, an item's property, and a monster's special ability are all
`Feature`. They differ in *how they are acquired*, not in *what they are*.

| # | Statement | |
|---|---|---|
| **S-2.9** | `Feature` is one type. Class features, species traits, feat effects, item properties and monster abilities are all instances of it. | ⊕ |
| **S-2.10** | A feature has a stable identity that can be referenced from outside the thing that contains it. | ⊕ |

`S-2.10` is the one to be careful about, because the natural implementation violates it
without any visible symptom for a long time. It is natural to write a feature inline inside
its class definition, as an anonymous nested structure. Everything works. Then:

- a contribution needs to say which feature produced it — and there is no way to name it;
- the user taps "Rage: +2 damage" expecting to see what Rage does — and there is nothing to
  navigate to;
- homebrew content wants to modify an existing feature — and it cannot address it;
- you want to find every feature granting darkvision — and there is no way to ask.

Every one of those is retrofittable only by assigning identities to features, which means
touching all content. **Give features identity from the first day.** Anonymous inline
features can be assigned synthetic identities when content is built, but the identity must
exist.

## 2.7 Observation 5 — features arrive from somewhere

`FR-B3` requires that we know why a character has what it has, and `FR-B4` requires
detecting when something no longer applies. Both need the same information: what caused
this feature to be present.

That information also answers a question that arises constantly in play: if the character
takes off the ring, which contributions disappear?

> **Type 8: `Origin`** — the reason an instance exists: *Fighter level 2*, *Elf*, *this
> particular longsword*.
> **Type 9: `Grant`** — the mechanism by which content confers something on a character.

| # | Statement | |
|---|---|---|
| **S-2.11** | Every instance carries its origin. | ⊕ |
| **S-2.12** | Removing an origin removes exactly the instances that origin produced, and nothing else. | |

`S-2.12` is what makes re-specification (`FR-B5`) tractable rather than terrifying. Undoing
a level means removing everything that level's origin granted — a well-defined operation —
rather than trying to reason backwards about what a level "probably" added.

## 2.8 Observation 6 — some things are used deliberately

Some consequences are continuous: darkvision is simply true. Others happen only when the
character decides to make them happen: casting a spell, attacking, using a class ability.

These require entirely different machinery. The first is collected when computing derived
state. The second has a cost, a target, a resolution procedure and results.

> **Type 10: `Effect`** — a passive, continuous modification to derived state.
> **Type 11: `Activation`** — something a creature deliberately does. Has a cost, may have
> a target, may require resolution, produces outcomes.

| # | Statement |
|---|---|
| **S-2.13** | `Effect` is passive only. It never means "something happened". |
| **S-2.14** | `Activation` is the only representation of a deliberate action. |

This is a place where your vault's vocabulary was ambiguous, and the ambiguity is worth
naming precisely because it is so easy to reintroduce. "Effect" is used in the source
material to mean both "a lasting modifier" and "what a spell does when it goes off". Those
are different mechanisms — one is collected into a computation, the other is executed as a
consequence — and one word for both guarantees they get confused in code.

## 2.9 Observation 7 — resolution has variable outcomes

An activation frequently has an uncertain result. The character attacks; it hits or it
misses. The character casts; the target saves or does not.

The natural model is a pair of branches: on-hit and on-miss. **That model is wrong**, and
it is wrong in a way that is cheap to avoid now and very expensive to fix later.

Two independent reasons:

1. **The number of outcomes is a property of the rule system, not of the world.** 5e has
   two (`F-13`). Pathfinder 2e has four — critical success, success, failure, critical
   failure — and this is not an edge case but the standard structure of essentially every
   check in that system (`F-29`).
2. **Even within 5e, two branches are not enough.** "Half damage on a successful save" is
   an outcome, not a variant of "miss".

> **Type 12: `OutcomeId`** — a category of resolution result, defined by the ruleset.
> **Type 13: `Outcome`** — the consequences associated with one `OutcomeId`.

| # | Statement | |
|---|---|---|
| **S-2.15** | An activation's results are a mapping from `OutcomeId` to consequences, not a fixed set of named branches. | ⊕ |
| **S-2.16** | The set of valid `OutcomeId` values is supplied by the ruleset, not fixed in the core. | ⊕ |

**This is the highest-value statement in section 2**, measured by cost-of-omission. Fields
named `onHit` and `onMiss` cost nothing to write and are correct for 5e today. Changing
them later means rewriting every activation in every content file that exists at that
moment, plus every piece of code that reads them. A map costs the same to write today.

The migration cost is entirely determined by how much content exists when the change is
made — which is `I-09`, the implementation question we most need answered.

## 2.10 Observation 8 — some things happen without being chosen

`F-15`: a substantial class of abilities activates in response to something else happening,
not on the character's own initiative. A reaction to being attacked. An extra effect when
an attack hits. A saving throw provoked by taking damage while concentrating (`F-10`).

None of these fit `Activation` as defined, because nobody chose to do them at that moment.
Nor do they fit `Effect`, because they are not continuous — they fire, once, in response to
something.

> **Type 14: `Trigger`** — a rule of the form: *when this happens, if this is true, then
> this may occur.*

| # | Statement | |
|---|---|---|
| **S-2.17** | Triggers are a first-class part of the model: content declares them as data, they are not special-cased in code. | ⊕ |
| **S-2.18** | A trigger has three parts: the signal it listens for, a condition on the current situation, and the response. | |

This type is absent from the vault notes entirely, and its absence is the largest gap we
found. It is not a missing feature — it is a missing *category*. Without it, every
triggered ability becomes a special case written into the code that happens to be nearby,
and the count of such abilities is in the hundreds.

There is a corollary about signals that matters for §8. The signals triggers listen to are
not the same thing as the history entries the user reads (`FR-D8`), even though both
describe "something that happened":

| | Trigger signal | History entry |
|---|---|---|
| Purpose | Machine dispatch | Human reading |
| Lifetime | Momentary | Persistent |
| Granularity | Fine — every mechanical step | Coarse — meaningful events |
| Audience | The rules | The user |

| # | Statement |
|---|---|
| **S-2.19** | Trigger signals and user-visible history entries are separate concerns and are not the same records. |

## 2.11 Observation 9 — things run out

Spell slots, rage uses, ki points, hit dice, item charges. All are the same mechanism:
a bounded quantity that is spent and restored under stated conditions.

> **Type 15: `Resource`** — a bounded, expendable quantity with rules for restoration.

| # | Statement |
|---|---|
| **S-2.20** | Resources are declarative: each resource states what restores it. |
| **S-2.21** | Rest logic contains no knowledge of specific resources. It announces that a rest occurred; resources respond according to their own declarations. |
| **S-2.22** | `0 ≤ current ≤ maximum` holds at all times, enforced at the point of change. |

`S-2.21` is the difference between a rest implementation that is twenty lines and never
changes, and one that grows a new branch for every class ever added. The test is simple:
**if the word "rage" appears anywhere in the rest code, this statement is violated.**

There is a second axis here that `F-16` says is genuinely three separate things rather than
one: *once per turn*, *once per round*, and *once per rest* are different limiters with
different reset points. A single "uses remaining" counter cannot express all three. This
matters for the type's shape and is one of the facts most worth verifying.

## 2.12 Observation 10 — states come and go

Poisoned. Prone. Blessed. Concentrating. Each is a named state that modifies the character
while it lasts, and each has rules about when it ends.

> **Type 16: `Condition`** — a named state carrying effects, with duration rules.

| # | Statement |
|---|---|
| **S-2.23** | A condition instance records its source and its expiry rule, not merely that it is present. |
| **S-2.24** | Conditions carry an intensity (`F-11` — exhaustion has levels), not merely presence. |

`S-2.23` is needed because "how does this end?" has several distinct answers — after a
number of rounds, at the end of the applier's next turn, when a saving throw succeeds, when
concentration breaks, when someone removes it — and a boolean cannot express any of them.

Concentration (`F-10`) is worth a specific note: it is a state with an unusual shape.
Exactly one may be held; taking damage provokes a check to keep it; starting a new one ends
the old. It is representable as a condition, but only if conditions carry a source
reference (to know what to end) and support exclusivity.

## 2.13 Observation 11 — the character is shaped by decisions

`FR-B2` and `FR-B3`: advancement presents choices, and choices persist. A fighting style
selected at level 1 is still in force at level 12, and it must be possible to see that it
was chosen, when, and why.

> **Type 17: `Choice`** — a decision the user must make, offered by content.
> **Type 18: `Selection`** — a decision made, identified by what prompted it.

| # | Statement | |
|---|---|---|
| **S-2.25** | A selection is identified by (origin, choice), not by the choice alone. | ⊕ |
| **S-2.26** | Choices can produce further choices. Validation is therefore recursive. | |
| **S-2.27** | Advancement is a state that may contain unresolved choices — not an atomic operation. | |
| **S-2.28** | An invalidated selection is reported, never silently discarded or reassigned. | |

`S-2.25` looks pedantic and is not. Multiclassing produces the same choice identifier
twice, from different sources — two classes each offering a skill proficiency choice, for
instance. Keying on the choice alone means the second selection overwrites the first,
silently, and the character loses a proficiency that the user chose and will not think to
check.

`S-2.27` is the difference between advancement that can be interrupted and resumed, and
advancement that must be completed in one modal interaction that cannot be closed. The
latter is unpleasant on a phone, which is the primary platform.

## 2.14 Observation 12 — numbers are formulas

*Sneak attack damage is `d6` per two class levels, rounded up.* *Rage damage is +2, rising
at levels 9 and 16.* *A cantrip's damage scales with character level.*

None of these are numbers. They are expressions over character state, and content must be
able to express them without becoming a program.

> **Type 19: `Expression`** — a closed-form calculation over character state.

| # | Statement | |
|---|---|---|
| **S-2.29** | Expressions are a closed grammar: literals, dice, references to character state, arithmetic, min/max, rounding. Nothing else. | ⊕ |
| **S-2.30** | The grammar has no loops, no assignment, no user-defined functions, and no general branching. Every expression terminates. | ⊕ |

`S-2.30` is what keeps `NG-2` honest, and the boundary is sharper than it looks. An
expression language with branching and a way to bind names is a programming language, and
once content contains programs you have acquired — permanently, without deciding to — a
sandbox to maintain, a debugger to build, versioning semantics to define, and a security
surface to defend. The closed grammar delivers the flexibility content actually needs and
none of that cost.

There is exactly one thing the closed grammar cannot do that content sometimes wants:
choose between two calculations based on a condition. That need is real, and it is met
without opening the grammar — by attaching a `Predicate` to the effect rather than putting
a conditional inside the expression. Two effects with different predicates express the
branch, and the branch stays in a form the system can inspect, explain and validate.

## 2.15 Observation 13 — applicability is conditional

*Only while raging.* *Only if wearing no armour.* *Only against creatures you can see.*
*Only if you have a free hand.*

> **Type 20: `Predicate`** — a logical condition evaluated against a context.

| # | Statement |
|---|---|
| **S-2.31** | Predicates are a closed grammar over inspectable state, in the same sense as expressions. |
| **S-2.32** | A predicate is always evaluated against an explicit context. It reads no ambient state. |

Predicates and expressions are structurally parallel: both are small closed trees over
character state, one returning a number and one returning a truth value. That parallel is
worth preserving in the implementation — they share evaluation machinery, storage shape
(§6), and validation.

## 2.16 Observation 14 — things go wrong and must be visible

`FR-A5`, `FR-B4`, `FR-E2`: content can be broken, prerequisites can lapse, references can
dangle. In every case the requirement is to *report*, not to fail and not to fix.

> **Type 21: `Issue`** — a detected problem, as data.

| # | Statement | |
|---|---|---|
| **S-2.33** | Problems are returned as data, not raised as exceptions and not written to a log. | ⊕ |
| **S-2.34** | An issue identifies what is affected, what is wrong, and — where one exists — what the user can do about it. | |
| **S-2.35** | The presence of issues never prevents loading, viewing, or continuing to use a character. | |

The reason `S-2.33` is marked as cheap-now-expensive-later is that exceptions and issues
have opposite control flow. An exception abandons the operation; an issue accompanies its
result. Code written to throw cannot be converted to code that collects without
restructuring every call site along the path — and validation, which is where issues
mostly arise, has deep call paths by nature.

## 2.17 Observation 15 — the character is not the only creature

`S-1.3`: the core is multi-entity. A monster and a player character have the same six
ability scores, take the same kind of actions, and are subject to the same conditions
(`F-22`). They differ in construction: a character is built from class levels and choices,
a monster is stated directly.

> **Type 22: `Entity`** — anything that exists and can be acted upon.

| # | Statement | |
|---|---|---|
| **S-2.36** | `Entity` is one type. Player characters, monsters, companions and summons are all entities. | ⊕ |
| **S-2.37** | An entity is data. It has no behaviour of its own; rules operate on it. | ⊕ |
| **S-2.38** | An entity belongs to exactly one ruleset for its whole life. | |

`S-2.37` is a structural decision that deserves its reasoning stated, because the
alternative is the more obvious design and it is the one that fails.

The obvious design is inheritance: `Dnd5eCharacter` extends `Character`, `Pf2eCharacter`
extends `Character`, each overriding the rules it needs. It reads naturally and it collapses
under three specific pressures:

| Pressure | What breaks |
|---|---|
| Two axes of variation | Ruleset (5e/PF2e) and kind (character/monster) are independent. Inheritance gives one axis; the second forces either a combinatorial explosion of classes or duplicated logic. |
| Data and rules change independently | A rules correction should not touch stored data. When the rules *are* the object, every rules change is a change to the thing being stored and loaded. |
| Serialisation | Polymorphic objects need type-tagged serialisation, and the type is a code artefact. Renaming a class breaks saved characters. |

Separating data from rules resolves all three: an entity is a record, a ruleset is a set of
operations selected at runtime, and the pairing is made by data (`S-2.38`) rather than by
type.

`S-2.38` is what makes that pairing safe. Mixing content from two rule systems on one
entity is not a feature to support carefully; it is an incoherent state to make
unrepresentable.

## 2.16a Observation 14a — some conditions cannot be evaluated

*Only if an ally is adjacent to your target. Only against a creature you can see. Only if the
target is surprised.*

These are ordinary predicates and the application **cannot evaluate any of them.** There is
no battlefield in v1, no position, no line of sight, and no knowledge of what another
creature is doing. In v2 there is more, but never all of it: whether a target is surprised
is frequently a referee's judgement.

The reflex is to treat what cannot be evaluated as false. That is wrong, and wrong in the
direction that loses the player's abilities: Sneak Attack would simply never apply.

Treating it as true is equally wrong in the other direction.

> **A predicate has three results, not two.**

```
    true     the condition holds        → the effect applies
    false    it does not hold           → the effect does not apply
    unknown  the system cannot tell     → ask
```

| # | Statement | |
|---|---|---|
| **S-2.44** | Predicate evaluation is three-valued: `true`, `false`, `unknown`. | ⊕ |
| **S-2.45** | An `unknown` result is surfaced to the user as a question. It is never silently resolved in either direction. | ⊕ |
| **S-2.46** | An incomplete context is a normal operating state, not an error. | |

This is a change with reach: it affects the predicate type, the gathering stage (§7.3), the
set of answer shapes crossing to the interface (`S-3.23` gains *pending questions*), and how
much of the long tail (§1.7) is actually reachable — because "ask the user" turns a large
class of unmodellable conditions into modellable ones.

`S-2.46` is the sentence that matters most. A system that treats missing information as a
failure will spend its life reporting failures, because in this domain the information is
missing by design: the referee holds it.

## 2.16b Observation 14b — some decisions are made at the moment of use

Three unrelated mechanics turn out to need the same thing:

| Mechanic | The decision |
|---|---|
| Great Weapon Master | Take −5 to the attack for +10 damage? Chosen **before** the roll |
| Divine Smite | Spend a spell slot, and which level? Chosen **after** the hit is known |
| Warlock beside Wizard | Which of two slot pools pays for this spell? Chosen **at casting** |

None of these fits the existing types. Not `Effect`, because they are optional rather than
continuous. Not `Activation`, because they are not separate actions — they modify one. Not
`Trigger`, because in two of the three cases the choice precedes the event entirely.

> **Type 23: `Option`** — a choice attached to an activation, selected by the user at the
> moment of use, carrying its own cost and its own effects.

| # | Statement | |
|---|---|---|
| **S-2.47** | An activation may declare options. An option has a cost, a predicate, and effects that apply only when it is selected. | ⊕ |
| **S-2.48** | A trigger declares whether it fires automatically or is **offered** to the user for a decision. | ⊕ |
| **S-2.49** | A selected option appears in the trace as its own contribution, labelled and attributable. | |

`S-2.48` is the other half of the same observation. Divine Smite is a trigger whose response
is a question rather than an effect, and without the distinction every reactive ability would
fire on its own — which is wrong for most of them.

**Three independent mechanics requiring one mechanism is the evidence threshold `S-1.18`
names.** One would have been handled in the long tail; three is a primitive.

## 2.17a Observation 15a — a creature can become something else

`F-20`, `F-48`: Wild Shape, Polymorph, Shapechange. The creature takes another form.
Physical characteristics come from the new form, mental ones stay. Some features carry over
and some do not. **The new form has its own hit points**, and when they run out the original
returns, carrying any excess damage.

Nothing in the model so far can express this:

| Attempt | Fails because |
|---|---|
| An `Effect` that sets each stat | It is a replacement, not a modification — and the set of things replaced is not fixed |
| A `Condition` carrying effects | Same problem; a condition is a bundle of modifications |
| A second `Entity` | Identity is lost. Hit points must return; features must carry; it is still the same character |

> **Type 24: `Form`** — an alternate source of an entity's characteristics, active for a
> time, with its own hit point pool and a declared rule for what comes from where.

```
    entity  ───────────────────────────────────────────►  identity, always the same
      │
      ├── form (base)         stats, features, hp        ◄── inactive while shifted
      └── form (dire wolf)    stats, features, hp        ◄── active
                                    ▲
                      carry-over map declares, per characteristic,
                      whether it comes from the form or from the base
```

| # | Statement | |
|---|---|---|
| **S-2.50** | An entity may have alternate forms. Exactly one is active. Entity identity is unaffected by which. | ⊕ |
| **S-2.51** | Each form has its own hit point pool. Leaving a form restores the underlying pool, with the rules for excess damage supplied by the ruleset. | ⊕ |
| **S-2.52** | For each characteristic, a declared carry-over rule says whether the active form or the base supplies it. That declaration is content, not code. | ⊕ |

`S-2.52` is what keeps this from becoming a special case for one class. The mechanism is
fixed; *which* characteristics transfer is data — and it differs between Wild Shape,
Polymorph and their equivalents in other systems. §4.7 explains why this makes forms
**content plus a fixed mechanism rather than a new ruleset axis.**

This was a genuine omission in Draft 1. `F-20` was in the fact list from the beginning; no
type was ever built for it.

## 2.14a Observation 12a — expressions reference more than base state

Three of the fifteen test mechanics needed a reference the grammar did not clearly permit:

| Needed | Example |
|---|---|
| A **derived** value | Unarmoured Defense: `10 + DEX modifier + CON modifier` — modifiers are derived, not stored |
| The **subject's own** properties | Exhaustion: *"this effect applies if my own stack count is at least 3"* |
| The **triggering event's** data | Concentration: `DC = max(10, floor(damage taken / 2))` |

| # | Statement | |
|---|---|---|
| **S-2.53** | The reference kinds an expression or predicate may use are an explicit closed list, published with the grammar. | ⊕ |
| **S-2.54** | The list includes derived values, the referring instance's own properties, and — where one exists — the triggering signal's data. | ⊕ |
| **S-2.55** | The evaluation context is therefore `(entity, content, ruleset, signal?)`, not entity state alone. | ⊕ |

`S-2.54`'s first clause has a consequence worth stating plainly: **because expressions may
reference derived values, the cycle hazard of §7.10 is not exotic — it is present in every
armour-class formula.** What prevents a cycle there is that the dependency happens to be
acyclic, not that references to derived values are rare.

## 2.8a Observation 6a — not every effect is a number

Draft 1 described `Effect` as a modification to derived state and left the impression that
modifications are arithmetic. Several are not:

| Effect | Operation |
|---|---|
| Resistance to slashing damage | add a member to a set |
| Darkvision 60 feet | establish a capability with a value |
| Advantage on Strength saves | a non-numeric roll modifier (`S-7.19`) |
| Exhaustion level 6: the creature dies | set a state |
| Your speed is halved | a multiplier |

| # | Statement |
|---|---|
| **S-2.56** | Effect operations are a closed set that includes non-numeric kinds: set membership, capability grants, roll modifiers and state changes. |

## 2.10a Observation 8a — where a trigger signal comes from

`S-2.18` said a trigger listens for a signal. It did not say who emits one, and the answer
differs by version:

| Source | Example | Version |
|---|---|---|
| The entity's own action | *my attack hit* | v1 |
| **The user declaring it** | *the enemy is casting a spell* | **v1 — otherwise every reaction is dead code** |
| Another entity | the same, observed | v2 |

| # | Statement |
|---|---|
| **S-2.57** | A trigger signal names its source. User-declared signals are a first-class source, not a testing facility. |

Without `S-2.57`, Counterspell and every other reaction to another creature cannot exist in
v1 at all — the trigger is authored, valid, and can never fire.


## 2.18 The complete type catalogue

Twenty-four types, derived from twenty observations about the requirements. The two marked
➕ were added in Draft 2 after the model failed against real mechanics (§0.4):

| Group | Types |
|---|---|
| **Content** | `Definition`, `Feature`, `Effect`, `Activation`, `Outcome`, ➕ `Option`, `Grant`, `Choice`, `Resource`, `Condition` |
| **Expression** | `Expression`, `Predicate` |
| **Instance** | `Entity`, ➕ `Form`, `Instance`, `Origin`, `Selection` |
| **Computation** | `BaseState`, `DerivedState`, `ResolvedValue`, `Contribution` |
| **Behaviour** | `Trigger`, `OutcomeId` |
| **Reporting** | `Issue` |

| # | Statement |
|---|---|
| **S-2.39** | Every domain concept in the system is one of these types or a composition of them. A new top-level type requires a new observation about the requirements. |

`S-2.39` is a discipline rather than a prohibition. When something does not fit, the
question to ask first is which of the twenty observations was incomplete. Most of the time
the answer is that the new thing is a composition — and adding a type would have produced
two ways to express one idea.

## 2.19 What deliberately has no type

Equally important, and easier to get wrong by omission:

| Not a type | Why | It is instead |
|---|---|---|
| `Character` (distinct from monster) | `F-22` — same mechanics, different construction | `Entity` with a kind |
| `Spell` (distinct from ability) | `F-21` — metadata plus an activation | `Definition` + `Activation` |
| `Weapon`, `Armour`, `Potion` | Item categories are ruleset data | `Definition` with a category |
| `Class` as behaviour | A class is a progression of grants | `Definition` containing `Grant`s |
| `Damage` as a first-class type | Damage is an effect with a type and an expression | `Effect` |
| `Round`, `Turn` | v2 combat structure (`S-1.5`) | — |

The pattern is consistent: **things that differ only in their data are not different types.**
Every entry in this table is something a beginner's model typically makes into a class, and
every one of them, once it is a class, becomes a place where ruleset assumptions hide.

---

# 3. Layers and dependency rules

## 3.1 Why this section exists at all

Layering is the least glamorous part of a design and the part that determines whether the
system is still workable in year two.

The reason is narrow and specific: **dependencies are transitive, and they accumulate
silently.** One `#include` of a database header inside a computation file is not a problem
on the day it is written. It becomes one when it means the computation cannot be tested
without a database, which means it is tested less, which means it is trusted less, which
means changes to it become frightening.

Layer rules are cheap to maintain from the beginning and effectively impossible to impose
retroactively on a system of any size.

## 3.2 The four layers

```
┌────────────────────────────────────────────────────────────┐
│  UI                                                        │
│  Presentation. Knows nothing about rules.                  │
└───────────────────────────┬────────────────────────────────┘
                            │ calls
┌───────────────────────────▼────────────────────────────────┐
│  APPLICATION                                               │
│  Orchestration, session state, the mutation boundary,      │
│  history, undo, issue collection.                          │
└───────────────────────────┬────────────────────────────────┘
                            │ calls
┌───────────────────────────▼────────────────────────────────┐
│  CORE                                                      │
│  Domain types, computation, rules, ruleset strategies.     │
│  Pure. No I/O, no clock, no randomness, no framework.      │
└───────────────────────────▲────────────────────────────────┘
                            │ implements interfaces declared here
┌───────────────────────────┴────────────────────────────────┐
│  INFRASTRUCTURE                                            │
│  SQLite, files, network, clock, random source.             │
└────────────────────────────────────────────────────────────┘
```

| # | Statement | |
|---|---|---|
| **S-3.1** | Dependencies point inward: UI → Application → Core. Core depends on nothing in this diagram. | ⊕ |
| **S-3.2** | Infrastructure implements interfaces declared by Core and Application. Neither knows which implementation it is given. | ⊕ |
| **S-3.3** | No layer reaches past its neighbour. The UI does not call Infrastructure; Core does not call Application. | |

The arrow from Infrastructure pointing *up* into Core is the part that is easy to get
backwards, and it is the whole trick. Core declares what it needs — "something that can
give me a random number", "something that can tell me the time" — as an interface it owns.
Infrastructure provides an object satisfying it. Core therefore has no compile-time
knowledge of SQLite, of Qt, or of the network, and can be built and tested with neither
present.

## 3.3 Core

Core is where correctness lives, and it is defined as much by its prohibitions as by its
contents.

**Contains:** the twenty-two types from §2 · computation (derived state, stacking,
resolution) · expression and predicate evaluation · rule strategies · validation ·
mutation functions.

**Must not contain:**

| # | Prohibition | Mechanical test | |
|---|---|---|---|
| **S-3.4** | No I/O of any kind — no file, database, or network access | Core builds and links with no I/O library | ⊕ |
| **S-3.5** | No reading of the clock | `grep` for time functions in Core returns nothing | |
| **S-3.6** | No generation of randomness | `grep` for RNG functions in Core returns nothing; randomness arrives as a parameter | ⊕ |
| **S-3.7** | No user-interface framework types | `grep` for framework headers in Core returns nothing | |
| **S-3.8** | No global mutable state, no singletons | Two independent instances can exist in one process without interfering | ⊕ |
| **S-3.9** | No hard-coded game constants | See below — this is the important one | ⊕ |

### S-3.9 in detail

> **No number that means something in a game rule appears in Core.**

Not `20`. Not `d20`. Not `(score − 10) / 2`. Not `8 + proficiency`. Not the list of six
ability scores, thirteen damage types, or eighteen skills.

These are 5e's values. Pathfinder 2e computes proficiency completely differently (`F-30`).
Older editions descend rather than ascend. Every such constant that reaches Core is a place
that must be found and changed to support a second rule system — and constants are the
hardest thing in a codebase to find, because they look like arithmetic.

This is the single invariant that determines whether `NFR-6` is achievable. It is also the
easiest one to verify: search Core for numeric literals, and every one that survives should
be either 0, 1, or an obviously structural bound.

| # | Statement | |
|---|---|---|
| **S-3.10** | Core is testable with no database, no filesystem, no network, and no user interface. | ⊕ |

`S-3.10` is not a separate requirement — it is the observable consequence of `S-3.4`
through `S-3.8`. It is listed separately because it is the one you can check in five
minutes: if Core's tests need a fixture, a temporary directory, or a running anything, one
of the prohibitions is being violated somewhere.

## 3.4 Where the rules live

The rules belong in **Core**, not in a layer of their own and not in Application.

This is worth stating because a five-layer arrangement — with rules as a separate layer
between Core and Application — looks tidier and is worse. The rules *are* the domain logic.
Separating them from the types they operate on produces two modules that cannot be
understood or changed independently, and an interface between them that has to carry the
entire domain vocabulary.

| # | Statement |
|---|---|
| **S-3.11** | Rule implementations live inside Core, selected at runtime by the entity's ruleset. |
| **S-3.12** | Core contains no ruleset-specific *branching*. It never asks which ruleset it is operating under; it invokes a selected implementation. |

`S-3.12` is the operational form of `S-3.9`, and the test for it is a search for the name
of a rule system in Core. `if (ruleset == Dnd5e)` in Core is the beginning of a system that
supports exactly one rule system with a second one permanently three months away.

§4 specifies what those selected implementations are and how narrow each one should be.

## 3.5 Application

Application is where the impure work happens: sequencing, state that persists across
operations, and everything that has to know about time and identity.

**Contains:** the loaded content registry · open entities · **the mutation boundary** ·
history · undo · issue accumulation · coordination of load and save · synchronisation (v2).

| # | Statement | |
|---|---|---|
| **S-3.13** | All state changes to an entity pass through a single mutation boundary in Application. | ⊕ |
| **S-3.14** | The mutation boundary is where history entries, undo records and change notifications are produced — not scattered through the code that performs changes. | ⊕ |
| **S-3.15** | Core mutation functions are pure: entity in, entity out. They do not record history and do not notify. | ⊕ |

The division in `S-3.15` is the one that makes the whole arrangement work, and it is worth
being explicit about why.

A change like "take 8 damage" has two aspects. One is *what the rules say happens* —
resistance applied, temporary hit points consumed first, unconsciousness at zero, concentration
checked. That is a rules question, it is pure, and it belongs in Core where it can be tested
by comparing against a hand-computed result.

The other is *what the system does about it having happened* — write it to history, make it
undoable, tell the interface to redraw, propagate to other devices. That is not a rules
question. It is identical for every kind of change, and it belongs in exactly one place.

Merging the two means every mutation function must remember to record history, and one of
them eventually will not. Separating them means history is produced by the boundary, for
every change, without any individual mutation function knowing that history exists.

| # | Statement |
|---|---|
| **S-3.16** | Every mutation passing the boundary carries a description sufficient to render it in history and to reverse it. |

## 3.6 Infrastructure

**Contains:** the database implementation · file access · content pack reading · the random
source · the clock · networking (v2).

| # | Statement |
|---|---|
| **S-3.17** | Infrastructure implements interfaces it does not define. |
| **S-3.18** | Substituting an implementation — in-memory database, fixed random source, frozen clock — requires no change above Infrastructure. |
| **S-3.19** | No domain logic lives in Infrastructure. Loading content constructs domain objects; it does not interpret rules. |

`S-3.18` is the practical payoff of the whole arrangement. A fixed random source makes
resolution testable. A frozen clock makes duration testable. An in-memory database makes
the whole persistence path testable without touching a disk. None of these are possible
if the dependencies point the other way, and all three are things you will want within
weeks.

## 3.7 UI

**Contains:** presentation, layout, input, navigation.

| # | Statement | |
|---|---|---|
| **S-3.20** | The UI never modifies an entity directly. It requests changes through Application. | ⊕ |
| **S-3.21** | The UI contains no rule knowledge — no formulas, no game constants, no ruleset-specific layout. | ⊕ |
| **S-3.22** | Adding a rule system requires no UI change. | ⊕ |

`S-3.22` is the sharpest available test of whether the layering actually holds, and it is
worth returning to periodically because it is testable long before a second ruleset is
implemented. Ask of any screen: *what would have to change here to display a Pathfinder 2e
character?* If the answer is "nothing structural — different labels come from the ruleset,
different values come from the same computation", the layering is sound. If the answer
involves a conditional on which ruleset is loaded, the boundary has already been crossed
and it will not be the only place.

The most common way `S-3.21` gets violated is subtle and worth naming: a screen that
displays six ability scores because it has six hard-coded slots. That is a rule constant
living in the presentation layer. The correct shape is a screen that displays the ability
scores the ruleset declares, however many there are.

## 3.8 What crosses each boundary

Boundaries are defined by what passes through them, and this is where §2's answer-shape
argument (`S-2.1`) becomes concrete:

| Boundary | Downward | Upward |
|---|---|---|
| UI → Application | Requests: *"apply 8 damage"*, *"cast this"*, *"level up"* | Views: current derived state, available actions, pending choices, issues |
| Application → Core | Entity, content, ruleset selection, supplied randomness | New entity value, resolved values, issues |
| Core → Infrastructure | *(nothing — Core does not call downward)* | — |
| Application → Infrastructure | Load, save, persist a change | Content, entities, an indication of failure |

| # | Statement | |
|---|---|---|
| **S-3.23** | What crosses Application → UI is a small fixed set of answer shapes — resolved values, available actions, pending choices, issues, history entries — that do not change when a ruleset is added. | ⊕ |

`S-3.23` is the concrete form of the observation in §2.2 that the questions are stable
while the answers vary. The UI is built against the shape of the answer. A new ruleset
changes what fills that shape, never the shape itself — and that is precisely why
`S-3.22` can be true.

## 3.9 Physical organisation

The layers should be visible in the directory structure, because a rule that is invisible
in the file layout is a rule that gets broken without anybody noticing.

```
core/           no dependencies on anything below
  domain/       the 22 types
  compute/      derived state, stacking, expressions, predicates
  rules/        ruleset strategy implementations
  validate/     prerequisites, integrity, issue production
app/            depends on core only
  session/      loaded content, open entities
  mutate/       the mutation boundary, history, undo
  load/         orchestration of loading (not the reading itself)
infra/          depends on core and app interfaces
  db/           SQLite
  packs/        content file reading
  platform/     clock, random, filesystem
ui/             depends on app only
```

| # | Statement |
|---|---|
| **S-3.24** | The dependency rule is enforced by the build system, not only by convention — a violation fails the build rather than being noticed in review. |

`S-3.24` is worth the small effort it takes to set up. With CMake this is a matter of
declaring targets and their link dependencies honestly: if `core` does not link `infra`,
then a stray include in Core is a build error on the day it is written rather than a
discovery in month eight. **Conventions that are only documented are conventions that
erode.**

---

# 4. The ruleset extension model

## 4.1 The problem, stated precisely

`NFR-6` requires that a second rule system can be supported without modifying the core or
the user interface. Everything in this section exists to make that sentence mean something
checkable rather than aspirational.

It is worth being exact about what the requirement is *not*. It is not "support every rule
system ever published" — that is unbounded and nobody needs it. It is this:

> **When a rule system differs from the one already implemented, the amount of work is
> proportional to the number of ways in which it differs — and nothing else.**

A system that differs on one axis should cost one axis of work. The failure mode the
requirement is guarding against is the one where a system that differs on one axis costs a
rewrite, because the assumption it violates is spread across four hundred files.

| # | Statement |
|---|---|
| **S-4.1** | The cost of supporting an additional rule system is proportional to the number of axes on which it differs from an existing one. |

`S-4.2` below makes this testable. `S-4.1` on its own is a goal.

## 4.2 What actually varies

The starting assumption in the vault notes was that these systems share one data structure
and differ only in quantities. That is half right, and the half that is wrong is the
important half.

**The object model does generalise.** Entity, Feature, Effect, Grant, Choice, Predicate,
Resource, Condition — these are genuinely the same shapes in every system in the family.
That was a good instinct and section 2 confirms it independently.

**The resolution and progression layers do not.** The differences there are structural, not
numeric:

| Question | 5e (2014) | PF2e | 4e | 3.5 / PF1 | AD&D 2e |
|---|---|---|---|---|---|
| Training → number | binary + expertise (`F-06`) | rank + level (`F-40`) | binary + half level | ranks bought per level (`F-39`) | roll-under ability |
| Attack target | ascending AC | ascending AC | one of four defences (`F-37`) | ascending AC | descending AC via THAC0 (`F-36`) |
| Who rolls a save | the defender | the defender | **nobody — the attacker rolls** (`F-37`) | the defender | the defender |
| Outcome categories | 2 (`F-13`) | 4, by margin of 10 (`F-33`) | 2 | 2 | 2 |
| Bonus stacking | no general type system (`F-43`) | 3 types, highest of each (`F-35`) | typed | many types, same type does not stack (`F-34`) | few bonuses |
| Resistance arithmetic | halves (`F-12`) | subtracts a flat amount (`F-41`) | subtracts | subtracts | varies |
| Action economy | action / bonus / reaction | 3 actions (`F-31`) | standard / move / minor | standard / move / free | segments |
| Spell resources | slots by level | slots + focus (`F-08` for 5e) | at-will / encounter / daily (`F-38`) | slots, prepared or spontaneous | memorisation (`F-42`) |
| Multiclassing | levels accumulate | archetype feats (`F-32`) | hybrid / feats | levels accumulate | level limits |

Read the columns rather than the rows and a pattern appears that determines the whole
design: **no two systems differ on all axes, and no two systems agree on all of them.**
5e (2014) and 5e (2024) differ on perhaps two. 5e and PF2e differ on six. 5e and AD&D
differ on nine.

That is what makes axis decomposition the right structure and any single-switch approach
the wrong one. If differences came in bundles, one interface per system would be
appropriate. They do not; they come one axis at a time.

## 4.3 The shared skeleton

Because the object model generalises, there is a sequence of steps common to every system
in the family. Naming it precisely is what makes the rest of this section possible.

```
                              ┌──────────────────────────────┐
   1  GATHER      ────────────│ collect what applies:        │
                              │ features, effects, items,    │
                              │ conditions — filtered by     │
                              │ predicates                   │
                              └──────────────┬───────────────┘
                                             │
                              ┌──────────────▼───────────────┐
   2  COMPUTE     ────────────│ combine contributions into   │◄── ✱ StackingModel
                              │ resolved values              │◄── ✱ StatModel
                              └──────────────┬───────────────┘◄── ✱ ProficiencyModel
                                             │
                              ┌──────────────▼───────────────┐
   3  OFFER       ────────────│ determine what is available  │◄── ✱ ActionEconomy
                              │ now, and at what cost        │
                              └──────────────┬───────────────┘
                                             │
                              ┌──────────────▼───────────────┐
   4  RESOLVE     ────────────│ assemble a roll, compare it, │◄── ✱ AttackModel
                              │ produce an outcome           │◄── ✱ SaveModel
                              └──────────────┬───────────────┘◄── ✱ CheckModel
                                             │                ◄── ✱ DefenceModel
                              ┌──────────────▼───────────────┐◄── ✱ OutcomeModel
   5  APPLY       ────────────│ execute the outcome's        │◄── ✱ DamageModel
                              │ consequences                 │
                              └──────────────┬───────────────┘
                                             │
                              ┌──────────────▼───────────────┐
   6  REACT       ────────────│ fire triggers, re-evaluate   │
                              │ durations                    │
                              └──────────────────────────────┘

   ✱ = a variation point. The step is fixed; what fills the hole is not.
```

Every system in the target family performs these six steps in this order. What differs is
what fills the marked holes.

| # | Statement | |
|---|---|---|
| **S-4.2** | There is one engine. The sequence of steps is fixed and shared by all rule systems; only the marked variation points are supplied per system. | ⊕ |
| **S-4.3** | Steps 1, 3, 5 and 6 contain no ruleset-specific logic at all. They operate on the outputs of the variation points. | |

`S-4.3` is more useful than it looks. It says that roughly two thirds of the engine is
written once and never touched again when a system is added. If a new system requires
editing the gathering step or the trigger step, something has been modelled in the wrong
place — and that is a signal worth acting on rather than working around.

This is the "one shared d20 engine with selectable strategies" position, and it is worth
stating why it beats the alternative it is most often confused with:

```
✅  one engine + selectable strategies
       ── the skeleton is shared; systems fill named holes
       ── a system that differs on one axis fills one hole differently

❌  several engines + a common shell
       ── each system implements the whole pipeline
       ── shared behaviour is duplicated, drifts, and is fixed in one copy only
```

## 4.4 Rejected: one wide interface

An earlier draft of this review proposed a single `RulesetModule` interface with roughly
fifteen methods, implemented once per rule system. **That proposal is withdrawn**, and the
reason is worth recording because it is not obvious and it generalises to other decisions.

The problem is not the number of methods. It is that **a wide interface makes every
difference cost the same as every other difference.**

Under a wide interface, 5e (2024) — which differs from 5e (2014) on perhaps two axes — must
still supply an implementation of all fifteen methods. Thirteen of them are copies. Copies
drift: a fix applied to one is not applied to the other, and nothing in the type system
notices. Within a year there are two subtly different implementations of a rule that was
supposed to be identical.

The decomposed alternative inverts this. A system supplies only the axes on which it
differs, and inherits the rest by explicit reference. `S-4.1` becomes true by construction
instead of by discipline.

| # | Statement | |
|---|---|---|
| **S-4.4** | Variation points are separate, narrow objects — one per axis — not methods on a single wide interface. | ⊕ |
| **S-4.5** | A rule system supplies an implementation only for the axes on which it differs. Every other axis is a shared reference, not a copy. | ⊕ |

`S-4.5` is the statement to check hardest when a second version of a system is added,
because copying is the path of least resistance at that moment and the cost arrives later.

## 4.5 Rejected: the other three approaches

Three further approaches deserve explicit rejection, since each is the obvious answer from
some direction and each fails for a different reason.

### Inheritance on the entity

`Dnd5eCharacter : Character`, with rules as overridden methods.

Rejected in §2.17, and the reasons are worth restating in this context: ruleset and entity
kind are independent axes, so inheritance can express one of them and not both; data and
rules then change together when they should change independently; and polymorphic objects
make serialisation depend on class names, so renaming a class breaks saved characters.

### Data only — no rule code at all

Everything, including resolution procedures, expressed as content data.

This fails on a specific and demonstrable point. `F-37`: in 4e nobody rolls a saving throw
against an attack — the attacker rolls against a defence. That is not a different value in
a formula; it is a different party performing a different operation with a different set of
modifiers applying. Expressing it as data requires the data language to describe
procedures, which means it stops being data.

The boundary is where it should be:

| # | Statement |
|---|---|
| **S-4.6** | Content is data. Rules are compiled code. The line between them is that data describes *what exists and what it does*; code describes *how the system arrives at an answer*. |

### A scripting language for rules

Rejected by `NG-2`, and the failure mode is worth naming because it is arrived at by
accident rather than by decision. Nobody sets out to build a scripting VM. They add a
conditional to the expression language, then a way to bind a temporary name, then a
loop — each addition individually reasonable — and at some point the content contains
programs. From that moment the project owns a sandbox, a debugger, execution-semantics
versioning and a security surface, permanently.

The closed grammar of `S-2.29` plus the axis decomposition of `S-4.4` gives the same
expressive reach without any of that. The distinction that makes it work: **content varies
the values and the composition; code varies the procedure.**

## 4.6 The axes

Ten axes. Each is listed with the question it answers, what varies, and — this is the
important column — the evidence that it is a genuine axis rather than an invented one.

An axis earns its place only if **two systems in the target family differ on it, and the
difference cannot be expressed as content data.** Both halves are required. §4.7 lists
candidates that fail one or the other.

### Group 1 — computing numbers (step 2)

| Axis | Answers | Varies as | Evidence |
|---|---|---|---|
| **StatModel** | What does a raw ability score contribute? | formula or table | 5e: `floor((s−10)/2)` (`F-01`). Earlier editions use non-linear tables with separate columns per application. |
| **ProficiencyModel** | How does training become a number? | `Binary` \| `Expertise` \| `Rank` \| `SkillRanks` \| `BaseAttackBonus` \| `THAC0` | Four structurally different answers across the family: `F-06`, `F-40`, `F-39`, `F-36`. This is the axis with the most variation. |
| **StackingModel** | Which contributions combine, which compete, in what order? | typed / untyped rules, competition policy | `F-43` vs `F-34` vs `F-35`. Also `F-04`/`F-05` within 5e alone. |

`ProficiencyModel` is the clearest demonstration that the vault's original assumption fails.
A boolean, an enumerated rank, an integer point total and a descending target number are not
the same value with different magnitudes. They are different types with different
arithmetic. A field declared `proficient: bool` is a decision that only one of them will ever
be supported.

| # | Statement | |
|---|---|---|
| **S-4.7** | Proficiency is a ruleset-defined value type, not a boolean and not a bare integer. | ⊕ |

### Group 2 — resolving (step 4)

| Axis | Answers | Varies as | Evidence |
|---|---|---|---|
| **AttackModel** | How is an attack assembled and compared? | what is added, what it is compared against, ascending or descending | `F-36` (descending, THAC0), `F-37` (four defences) |
| **SaveModel** | How is a save assembled, and **who rolls it**? | defender rolls / attacker rolls against a static defence | `F-37` — the sharpest structural difference in the family |
| **CheckModel** | How is a non-combat check assembled? | modifier composition, degrees | 5e: flat DC comparison. PF2e: same roll, four degrees (`F-29`). |
| **DefenceModel** | What defences exist and how is each computed? | one AC / four defences / descending AC | `F-37`, `F-36`, and `F-04`/`F-05` for the competing-formula case |
| **OutcomeModel** | How does a resolved roll become an outcome? | the set of outcomes and the mapping | 5e: 2 (`F-13`). PF2e: 4, determined by margin, with natural 20/1 shifting a degree (`F-33`) |

Three points about this group.

**`AttackModel` and `SaveModel` are separate axes even though they look similar**, and
`F-37` is the reason. In 4e a system can differ on the save axis while agreeing on the
attack axis. If they were one object, that system would have to reimplement both to change
one.

**`OutcomeModel` is separate from both.** A house rule adding critical fumbles to 5e
changes only how a roll maps to an outcome — nothing about how the attack was assembled.
Keeping it separate means that house rule is one small object rather than a fork of attack
resolution.

**Advantage is not a number, and this constrains the group.** `F-03`: advantage and
disadvantage do not accumulate, and one of each cancels completely. A design that treats
advantage as `+5` or as a counter produces wrong results the moment two sources apply. The
correct representation is a pair of flags resolved at the end of assembly — which means the
resolution step must have a defined final stage where that resolution happens.

| # | Statement | |
|---|---|---|
| **S-4.8** | The set of outcome categories is declared by the ruleset, and the mapping from roll to outcome is a separate variation point from roll assembly. | ⊕ |
| **S-4.9** | Roll modifiers that are not numeric — advantage and its equivalents — are represented distinctly and resolved at a defined point, never as a numeric bonus. | |

### Group 3 — consequences (step 5)

| Axis | Answers | Varies as | Evidence |
|---|---|---|---|
| **DamageModel** | How is damage reduced, multiplied and rounded? | halving vs flat subtraction; what a critical multiplies | 5e halves (`F-12`) and doubles dice only (`F-24`); PF2e subtracts a flat amount (`F-41`) and doubles the total |

Damage arithmetic is a single axis because the whole sequence — sum, apply
resistance/vulnerability/immunity, round — has to be specified as one ordered procedure.
Splitting it into separate variation points would create ordering ambiguity between them,
and ordering is exactly what determines the result.

### Group 4 — structure of play and advancement

| Axis | Answers | Varies as | Evidence |
|---|---|---|---|
| **ActionEconomy** | What may be spent on a turn, and what does an action cost? | action/bonus/reaction; three actions; standard/move/minor | `F-31` — PF2e activities cost 1, 2 or 3 actions with *different effects per cost* |
| **ResourceModel** | How are expendable pools defined and restored? | slot tables; at-will/encounter/daily; memorisation | `F-08`, `F-38`, `F-42` |
| **ProgressionModel** | How does advancement produce grants, and what is legal? | level accumulation vs archetype feats; prerequisites | `F-32`, `F-08`, `F-09` |

`ActionEconomy` carries a consequence for the content model that is easy to miss. `F-31`
says a PF2e activity's *effect* changes with how many actions are spent — not merely its
availability. That means the cost is a dimension of the activation itself, not a filter
applied to it. An activation model with a single fixed cost field cannot express it.

| # | Statement | |
|---|---|---|
| **S-4.10** | Action cost is part of an activation's structure, not a scalar attached to it. An activation may define different behaviour at different costs. | ⊕ |

`ProgressionModel` absorbs build legality — multiclass prerequisites, attunement limits
(`F-18`), level caps. These could be a separate axis; they are not, because no system in
the target family differs on legality while agreeing on progression. That is the test from
§4.6 applied honestly, and it removes an axis that would otherwise exist for symmetry
rather than for need.

## 4.7 What is deliberately not an axis

Rejecting candidate axes matters as much as accepting them. Each of these looks like a
variation point and is not, and in each case the reason is the same test applied
differently.

| Candidate | Why not | It is instead |
|---|---|---|
| **RestModel** | Systems differ in *which* rests exist, not in how rest works. The procedure is identical: announce that a rest of a given kind occurred; each resource responds according to its own declaration (`S-2.21`, `F-17`). | Vocabulary + `ResourceModel` |
| **ConditionModel** | Conditions differ entirely in content — which exist, what effects they carry. The machinery for applying, tracking and expiring them does not vary. | Content |
| **ItemModel** | Item categories, slots and attunement rules are data the ruleset declares. No system needs a different *procedure* for equipping. | Vocabulary + `ProgressionModel` |
| **SpellModel** | `F-21` — a spell is metadata plus an activation. Casting differs through `ResourceModel` and `ActionEconomy`, both of which already exist. | Content + existing axes |
| **CombatModel** | v2 (`S-1.5`). Adding it now would define a variation point against zero evidence of how it varies. | — |

The pattern is consistent: **if two systems differ only in which named things exist, that is
vocabulary or content, not an axis.** An axis is required only where the *procedure*
differs.

| # | Statement |
|---|---|
| **S-4.11** | An axis exists only where two systems in the target family differ in procedure and the difference cannot be expressed as content or vocabulary. |
### Why forms are **not** an axis

`Form` (§2.17a) is new, and the obvious next move is to give it an eleventh axis — systems
surely differ in how shape-changing works.

Applying §4.6's own test says no.

What differs between 5e's Wild Shape, 5e's Polymorph and their equivalents elsewhere is
**which characteristics come from the form and which are retained** — a table of
characteristic against source. That is data. The *procedure* — one active form, its own hit
point pool, characteristics sourced by a declared rule, excess damage on reversion — does not
differ.

| # | Statement |
|---|---|
| **S-4.26** | Forms are a fixed mechanism plus a content-supplied carry-over declaration. No form axis exists. |

This is the ladder (§4.8) working as intended, and it is worth noticing that the answer came
out at rung 1 even though the mechanism itself was new. A new *type* does not imply a new
*axis*.

## 4.8 The ladder — where does a new rule go?

This is the decision procedure to apply when something does not fit. It is written as a
ladder because the order matters: **each rung is tried before the next, and stopping at the
lowest rung that works is the whole discipline.**

```
  1. Can it be expressed as CONTENT?
     ── a new Feature, Effect, Predicate, Expression using existing primitives
     ── cost: authoring only.  No code changes.

  2. Can it be expressed as VOCABULARY?
     ── a new StatId, DamageTypeId, OutcomeId, BonusTypeId, ActionCostId
     ── cost: one row of ruleset data.  No code changes.

  3. Does it fit an EXISTING AXIS?
     ── a new StackingModel, a new ProficiencyModel variant
     ── cost: one new strategy object.  No changes to shared code.

  4. Does it need a NEW AXIS?
     ── the engine skeleton gains a variation point
     ── cost: touches the shared engine.  Requires two systems as evidence.

  5. Does it need a NEW ENGINE STEP?
     ── the six-step skeleton is wrong
     ── cost: architectural.  Requires strong evidence and deliberate decision.
```

| # | Statement | |
|---|---|---|
| **S-4.12** | New mechanics are placed at the lowest rung of the ladder that can express them. Moving up a rung requires evidence that the rung below cannot. | ◇ |
| **S-4.13** | A new axis (rung 4) requires at least two systems that genuinely differ on it. One system's peculiarity is handled at rung 3 or below. | |

`S-4.13` is what stops the axis list growing without bound. There is a strong temptation,
when a new system introduces something unfamiliar, to give it its own variation point.
Requiring two systems as evidence means an axis is only created when the variation is real
rather than anticipated — which is the same principle as `S-1.18` and your `R-22`, applied
to structure rather than to content.

The rungs are also a good diagnostic in the other direction. If most new content requires
rung 3 or higher, the primitive set in §2 is too narrow and the right response is to widen
it, not to keep adding strategies.

## 4.9 Vocabulary — the sets a ruleset declares

Rung 2 needs saying properly, because it is where most of the "5e has six of these, PF2e
has three" differences actually live — and it is where hard-coded fields do the most
damage.

A ruleset declares the members of these sets:

| Set | 5e (2014) | Note |
|---|---|---|
| `StatId` | 6 | Not a fixed six-field structure |
| `SkillId` | 18 | Each maps to a stat |
| `DamageTypeId` | 13 | `F-12` interacts with `DamageModel` |
| `DefenceId` | 1 (AC) | 4 in 4e (`F-37`) |
| `SaveId` | 6 | 3 in PF2e |
| `OutcomeId` | 2 (`F-13`) | 4 in PF2e (`F-29`) |
| `BonusTypeId` | few (`F-43`) | many in PF1 (`F-34`), 3 in PF2e (`F-35`) |
| `ActionCostId` | 4 | 3 in PF2e (`F-31`) |
| `RestTypeId` | 2 (`F-17`) | |
| `ProficiencyRankId` | 3 (`F-06`) | 5 in PF2e (`F-40`) |
| `SchoolId` | 8 | Presentation only |
| `RollModifierId` | advantage, disadvantage | see below |

### Roll modifiers are vocabulary too

`S-7.19` established that advantage is not a number. The fifteen-mechanic test found that it
is also not alone (`F-50`):

| Mechanic | What it does to the roll |
|---|---|
| Advantage / disadvantage | roll twice, take the better or worse |
| Elven Accuracy | with advantage, reroll one of the dice |
| Halfling Lucky | reroll a natural 1 |
| Reliable Talent | treat a result below 10 as 10 |
| Portent | replace the result with a stored value |

Each modifies the *procedure* of rolling rather than the result. They are not numbers, they
do not commute, and **two of them applying at once has a defined order** that the engine must
follow rather than invent.

| # | Statement | |
|---|---|---|
| **S-4.27** | Roll modifier kinds are declared by the ruleset, along with the order in which they apply. | ⊕ |
| **S-4.28** | The engine implements the declared kinds; it contains no knowledge of which mechanics produce them. | |


| # | Statement | |
|---|---|---|
| **S-4.14** | These sets are declared by the ruleset. Nothing in Core or the UI assumes a count or a specific member. | ⊕ |
| **S-4.15** | A character's stats are a mapping from `StatId` to value, not a structure with six named fields. The same applies to saves, defences and skills. | ⊕ |

`S-4.15` is the cheapest possible statement to satisfy today and one of the more expensive
to retrofit, because a six-field structure propagates outward: into the schema, into every
screen that reads it, into every piece of content authored against it. A map costs the same
to write. The only thing given up is a compile-time guarantee about member names — and
typed identifiers (§5) recover most of that.

## 4.10 What a ruleset is, concretely

Gathering everything above:

```
Ruleset
├── identity          rulesetId, name, version
├── vocabulary        the declared sets from §4.9
├── axes              a selection for each of the ten axes in §4.6
│    ├── StatModel            ─┐
│    ├── ProficiencyModel      │
│    ├── StackingModel         │  each is either
│    ├── AttackModel           │  · a reference to a shared implementation
│    ├── SaveModel             ├─ · or an implementation specific to this ruleset
│    ├── CheckModel            │
│    ├── DefenceModel          │
│    ├── OutcomeModel          │
│    ├── DamageModel           │
│    ├── ActionEconomy         │
│    └── ProgressionModel     ─┘
└── defaults          starting values, character creation procedure
```

| # | Statement | |
|---|---|---|
| **S-4.16** | A ruleset is a named selection of axis implementations plus vocabulary. It is not a class hierarchy and not a subtype of anything. | ⊕ |
| **S-4.17** | Ruleset selection happens by data at load time. Core contains no compile-time knowledge of which rulesets exist. | ⊕ |
| **S-4.18** | Rulesets are not global. Two rulesets can be live in one process simultaneously, with no shared mutable state between them. | ⊕ |

`S-4.18` is not hypothetical and it is the reason singletons are excluded. A user with one
5e character and one PF2e character will have both open. A global "current ruleset", or a
global content registry, makes that state either impossible or corrupting — and it is the
kind of assumption that is invisible until the day it fails, because everything works
perfectly while there is only one.

The same reasoning applies to the random source. A global generator makes reproducible tests
impossible, and reproducibility is the only practical way to verify a rules engine.

| # | Statement | |
|---|---|---|
| **S-4.19** | Content registry, ruleset and random source are passed explicitly. Core contains no global mutable state. | ⊕ |

## 4.11 Composition — versions of the same system

5e (2014) and 5e (2024) are separate rulesets. They differ on a small number of axes and
agree on the rest.

The right relationship between them is composition, not inheritance and not copying:

```
dnd5e-2014          dnd5e-2024
├── StatModel       ────────────►  same object, referenced
├── ProficiencyModel ───────────►  same object, referenced
├── AttackModel     ────────────►  same object, referenced
├── StackingModel   ────────────►  same object, referenced
├── ProgressionModel ..............  its own — advancement rules differ
└── vocabulary      ..............  its own — the content sets differ
```

| # | Statement | |
|---|---|---|
| **S-4.20** | A ruleset that shares an axis with another references the same implementation. Copy-and-modify is not used to create a ruleset variant. | ⊕ |

`S-4.20` is the practical form of `S-4.5`, and it is worth stating twice because the
temptation is strongest at exactly the moment the cost is invisible. Copying an axis
implementation to make a variant takes ten seconds and works immediately. The consequence
arrives months later as a bug fixed in one copy and not the other, with nothing to indicate
that a second copy existed.

House rules follow the same pattern. A table that plays 5e with one altered rule is a
ruleset that references every standard axis and supplies one of its own. That is a
legitimate and cheap thing to exist, and it is only cheap because of `S-4.5`.

## 4.12 The boundary of homebrew

`S-1.15` says nothing in the architecture distinguishes shipped content from user content.
This section is where that claim meets its limit, and the limit needs to be explicit rather
than discovered.

| A user can | A user cannot |
|---|---|
| Create any content: features, spells, items, classes, species, conditions, monsters | Add a new axis implementation |
| Use every effect, expression and predicate primitive | Change how the engine's steps are ordered |
| Declare new vocabulary members where the ruleset permits it | Introduce a new step |
| Modify or extend existing content | Write procedural code |
| Compose a ruleset variant from existing axis implementations *(if the application chooses to expose this)* | Write a new axis implementation |

| # | Statement |
|---|---|
| **S-4.21** | User-authored content uses the same loading path, the same validation and the same engine as shipped content. There is no second, weaker route into the engine. |
| **S-4.22** | Users author content and may select among existing axis implementations. Authoring a new axis implementation requires code and is not a user-facing capability. |

`S-4.21` is the one that carries practical weight, and its value is mostly indirect: if the
application's own content is defined through the same mechanism a user has, then that
mechanism is exercised constantly during development. Homebrew stops being a
lightly-tested feature bolted on at the end and becomes the thing the whole application is
built on.

`S-4.22` is the honest limit. A user cannot express "in my game, saves work like 4e". That
is a code change. Stating this plainly is better than an authoring system that appears
open-ended and fails at an arbitrary point the user discovers by hitting it.

## 4.13 Verification — the four-system audit

`NFR-6` is testable long before a second ruleset is implemented, and it should be tested
early precisely because the cost of discovering a violation grows with every month of
content and code.

**Procedure.** For each of the ten axes, and for each of four systems — 5e (2014), 5e
(2024), PF2e, and one deliberately distant system (AD&D 2e or 4e) — write down on paper how
that system fills that axis. Forty cells.

The audit succeeds when:

| # | Statement |
|---|---|
| **S-4.23** | Every cell in the audit is fillable within the axis's declared shape, without adding an axis and without modifying an engine step. |
| **S-4.24** | No cell requires a change to Core outside an axis implementation. |
| **S-4.25** | No cell requires a change to the UI. |

This costs a day and it is the highest-value day available in the whole project. A failing
cell is not a defeat — it is the cheapest possible discovery of a structural problem, found
on paper rather than in a codebase with thousands of content records committed to the shape
that turned out to be wrong.

Two cells are known in advance to be the hardest, and they are the ones to write first:

- **AD&D 2e × ProficiencyModel** — a descending target number is not a bonus at all (`F-36`).
  If `ProficiencyModel` can only return "a number to add", this cell fails.
- **4e × SaveModel** — the defender does not roll (`F-37`). If `SaveModel` assumes a
  defender's roll anywhere in its shape, this cell fails.

If both of those fill cleanly, the decomposition is sound. Note that neither system needs to
be *implemented* for the audit to be worth doing — the point is only to prove that the
shapes admit them.

## 4.14 Cost summary

What each kind of change actually costs under this model:

| Change | Touches | Cost |
|---|---|---|
| New spell, item, feat | content only | authoring |
| New damage type, new outcome category | ruleset vocabulary | one row |
| House rule on stacking | one axis implementation | one small object |
| 5e (2024) alongside 5e (2014) | 2 axes + vocabulary | days |
| PF2e | ~6 axes + vocabulary + content | weeks, no core changes |
| AD&D 2e | ~9 axes + vocabulary + content | weeks, no core changes |
| A system needing a seventh engine step | the engine skeleton | architectural — requires a decision |

The bottom row is the one that should be rare, and the four-system audit is what establishes
in advance that it will be.

## 4.15 New domain facts introduced in this section

The axis decomposition rests on claims about systems other than 5e. Following the same
discipline as `F-01 … F-32`, they are numbered so that a wrong claim collapses only what it
supports. **These are additions to `03-questions-for-author.md`.**

| # | Fact | Supports |
|---|---|---|
| **F-33** | In PF2e the degree of success is determined by the margin: beating or missing the DC by 10 or more shifts the result one degree, and a natural 20 or 1 shifts it one degree further | `OutcomeModel` as a separate axis |
| **F-34** | In 3.5/PF1 bonuses have named types; two bonuses of the same type do not stack (the highest applies); untyped bonuses stack; dodge bonuses are an exception that stacks | `StackingModel` |
| **F-35** ⚑ | PF2e uses three bonus types — circumstance, status, item — and the highest of each type applies; penalties follow the same rule | `StackingModel` |
| **F-36** | In AD&D 2e, attack success uses THAC0 against descending AC: the roll needed is THAC0 minus the target's AC | `ProficiencyModel`, `AttackModel`, `DefenceModel` |
| **F-37** | In 4e the attacker always rolls, against one of four defences (AC, Fortitude, Reflex, Will); defenders do not roll saving throws against attacks | `SaveModel`, `DefenceModel` — the strongest single piece of evidence in §4 |
| **F-38** | In 4e, powers are classified At-Will / Encounter / Daily, which is a recovery rule rather than a count of a pool | `ResourceModel` |
| **F-39** | In 3.5/PF1, skills are bought with ranks from a per-level budget rather than being a binary proficiency | `ProficiencyModel` |
| **F-40** ⚑ | In PF2e, a proficiency bonus is character level plus a rank bonus (trained +2, expert +4, master +6, legendary +8); untrained adds neither the rank bonus nor the level | `ProficiencyModel` |
| **F-41** ⚑ | PF2e resistance subtracts a flat value from damage of that type, rather than halving it as 5e does | `DamageModel` |
| **F-42** | In AD&D, a prepared spell is expended on casting and must be re-memorised — the resource is per-prepared-spell rather than a per-level slot pool | `ResourceModel` |
| **F-43** ⚑ | 5e has no general typed-bonus system; the governing rule is that identical named effects do not stack, stated per effect rather than by bonus type | `StackingModel` |

If `F-37` is wrong, the case for splitting `AttackModel` from `SaveModel` weakens
considerably and the two could merge. If `F-36` is wrong, `ProficiencyModel` need not
accommodate a descending target number. Those are the two cells that carry the most weight,
which is why they are also the two named in the audit.

---

# 5. Data and identity

## 5.1 Why identity gets its own section

Identity looks like a detail and behaves like a foundation. Almost every hard problem later
in this specification — how a character survives a missing content pack, how two content
packs from different authors coexist, how synchronisation compares two versions of the same
thing, how the database stores a reference — is an identity problem wearing a different
hat.

It is also the decision with the worst asymmetry between the cost of getting it right and
the cost of changing it later. An identifier scheme, once content has been authored against
it and characters have been saved referencing it, is present in every table, every content
file, and every saved character simultaneously. **There is no incremental migration path
for an identifier scheme.**

## 5.2 The mistake to avoid: one identifier for two jobs

Identity in this system does two jobs that pull in opposite directions.

| | Authoring identity | Runtime handle |
|---|---|---|
| Who writes it | a human, by hand, in a content file | the system, automatically |
| Must be | readable, memorable, collision-free across independent authors | small, fast to compare, compact as a foreign key |
| Lives in | content files, exchange formats, error messages | memory, database columns |
| Changes when | never (it is the content's public name) | never (once assigned locally) |
| Natural type | **string** | **integer** |

Picking one type for both jobs fails in a predictable direction whichever way it is picked.

**Strings everywhere** means every reference in every database row is a variable-length
blob; every comparison is a memory comparison rather than a register comparison; every
lookup allocates; foreign keys are wide; indexes are large; and a character with two hundred
references stores two hundred strings that are the same handful of strings repeated.

**Integers everywhere** means content authors write numbers by hand, two independent
homebrew authors both choose 1000, and a content file becomes unreadable and undiffable.

The resolution is not a compromise between them. It is a boundary:

| # | Statement | |
|---|---|---|
| **S-5.1** | Content identity has two representations: a string in authoring and exchange, and a fixed-width integer at runtime and in the database. | ⊕ |
| **S-5.2** | The conversion between them happens at exactly one place — content installation — and nowhere else. | ⊕ |

`S-5.2` is the statement that makes `S-5.1` safe rather than confusing. Two representations
are only a problem when the conversion is scattered; with a single conversion point, every
layer above it deals in integers exclusively and never sees a string identifier at all.

## 5.3 The trap in the obvious implementation

The obvious way to implement `S-5.1` is interning at load time: as packs load, assign each
string an integer from a counter, keep a map, and use the integer thereafter.

This works perfectly and then destroys data.

The integer produced by load-time interning depends on **which packs were loaded and in
what order**. Install a new pack, or uninstall an old one, and the same string gets a
different number. Any integer stored outside that one process run — in a saved character,
in a database row, in a synchronisation message — now means something else.

The failure has an unpleasant shape: it is silent, and it corrupts rather than crashes. The
character does not fail to load. It loads, and the longsword has become a potion.

| # | Statement |
|---|---|
| **S-5.3** | No identifier whose value depends on load order or on the set of installed packs is ever persisted or transmitted. |

This is the constraint that any identity scheme has to satisfy. There are three ways to
satisfy it, and the choice among them is the real decision in this section.

## 5.4 The three candidate schemes

### Scheme A — strings in storage, integers only in memory

Persist strings; intern to integers at load; convert back when saving.

Correct, and simple to reason about. Its costs are real but modest at this data scale: a
character with two hundred references stores two hundred short strings, and the database
stores text where it could store integers.

The reason to reject it is not size. It is that **every reference in the database is then
a string**, which makes foreign keys wide, makes referential structure between tables
awkward, and makes row-level comparison for synchronisation compare text. Under §6's fully
normalised schema, references are the most common thing in the database. Making the most
common thing the most expensive thing is the wrong default.

### Scheme B — the pack assigns permanent numbers

The pack build tool assigns each content item a permanent integer, stored in the pack
alongside its string identifier.

This gives stable integers, and it is the scheme that first suggests itself once one
decides integers should be stored. It has one flaw, and the flaw is fatal in exactly the
case the project cares about.

**Independent authors collide.** Two homebrew packs both number their first spell 1. A
character referencing spell 1 is ambiguous. Fixing this requires either a central authority
assigning number ranges — which does not exist and cannot exist for user-authored
content — or making every reference a *pair* of (pack, local number), which means every
foreign key is composite, every index is wider, and the scheme's only advantage over
Scheme A is diminished.

### Scheme C — the installation assigns permanent numbers ✅

**The local database is the authority for numeric identity.**

Packs contain only strings. When a pack is installed, every content item in it is entered
into a registry table in the user's own database, and *that table* assigns a permanent
integer. Everything above that point — memory, every other table, every saved
character — uses the integer.

```
      pack file (authored, portable)
      ┌──────────────────────────────────────────┐
      │  pack key : "srd-5.1"                    │
      │  spell    : "fireball"                   │
      │  requires : "srd-5.1:feature.evocation"  │
      └────────────────────┬─────────────────────┘
                           │  installation — the one conversion point (S-5.2)
                           ▼
      ┌──────────────────────────────────────────┐
      │  content_id                               │
      │  ┌────┬──────────┬────────────┬────────┐  │
      │  │ id │ pack_key │ local_key  │ type   │  │
      │  ├────┼──────────┼────────────┼────────┤  │
      │  │ 47 │ srd-5.1  │ fireball   │ spell  │  │
      │  └────┴──────────┴────────────┴────────┘  │
      └────────────────────┬─────────────────────┘
                           │
                           ▼
      everything above this line uses 47 — memory, every table,
      every saved character, every synchronisation message
```

Why this resolves what the other two cannot:

| Requirement | How Scheme C satisfies it |
|---|---|
| Integers in every database column and every reference (`D14`) | The integer is assigned before anything else stores a reference |
| Authors never coordinate | Uniqueness is enforced locally on `(pack_key, local_key)`, never globally on a number |
| Stable across restarts, installs and uninstalls | The row is permanent and the number is never reassigned |
| A character opens when a pack is missing (`S-1.9`) | The registry row survives uninstall; the reference resolves to a known identity whose *definition* is absent — which is an `Issue`, not a dangling number |
| Reinstalling restores the same references | The `(pack_key, local_key)` pair maps back to the same row |
| Deterministic ordering (`S-1.11`) | Integer identity gives a cheap total order that does not depend on hashing |

| # | Statement | |
|---|---|---|
| **S-5.4** | Numeric content identity is assigned by the local installation, not by the pack and not by load order. | ⊕ |
| **S-5.5** | The pair `(pack key, local key)` is unique and is the only thing an author controls. Uniqueness is never required of a number across authors. | ⊕ |
| **S-5.6** | A numeric identifier is never reused. Uninstalling content retires its number; it is not given to something else. | ⊕ |

`S-5.6` is short and it is the whole reason the scheme is safe. A reused number is the
load-order trap returning in a different form: a stored reference that quietly comes to mean
something else. The registry table is append-only in practice, and at this data scale
(~12 000 records at the outside) the cost of never reclaiming a number is nothing.

The one thing Scheme C gives up: **the integer is local to one installation.** It is
meaningful on this device and nowhere else. That constrains exactly two things — export and
synchronisation — and §5.10 handles both. It does not constrain anything internal, which is
where the cost of string identity would otherwise have been paid on every row.

## 5.5 The shape of an identifier

| | |
|---|---|
| **Type** | Unsigned 32-bit integer |
| **Zero** | Reserved, meaning *none* — never a valid identifier |
| **Range** | ~4 billion against a realistic maximum of ~12 000 |
| **Assignment** | Sequential from the registry, permanent |

32 bits is not a close call. Even with every published book, every homebrew pack a user
might install, and never reclaiming a retired number, the space is over-provisioned by five
orders of magnitude. 64 bits would double the size of the most common column in the database
for no benefit.

| # | Statement |
|---|---|
| **S-5.7** | Identifier zero is reserved as *no identifier* and is never assigned. |

`S-5.7` is worth stating because the alternative — a nullable reference, or a sentinel of
−1, or an optional wrapper — costs more in every row and every comparison than reserving one
value out of four billion.

## 5.6 Typed identifiers

An identifier is an integer, but a `SpellId` and an `ItemId` are not interchangeable, and
the type system should say so.

```
    ❌  uint32_t spellId, itemId;
        applyItem(entity, spellId);        // compiles. wrong.

    ✅  SpellId, ItemId  — distinct types over uint32_t
        applyItem(entity, spellId);        // does not compile.
```

| # | Statement | |
|---|---|---|
| **S-5.8** | Identifiers are distinct types by content type. Passing one where another is expected is a compile-time error. | ⊕ |
| **S-5.9** | Typed identifiers have no runtime cost: the same size, the same comparison, the same storage as the underlying integer. | |

`S-5.9` matters because it removes the only argument against `S-5.8`. In C++ this is a
struct wrapping a `uint32_t` with comparison and hashing defined and no implicit conversion
in either direction — identical machine representation, zero overhead, and the compiler
catches an entire class of mistake that is otherwise found by a user noticing that their
sword casts fireball.

The type is a compile-time property only. **In the database, an identifier is a plain
integer column.** The type discipline lives where types exist.

## 5.7 Authoring keys

The string half of `S-5.1`. It is what a human writes and what appears in a diff, an error
message, or an exchange file.

```
    srd-5.1:spell.fireball
    └─────┬─────┘ └───┬───┘
      pack key    local key
```

| Part | Rule |
|---|---|
| **Pack key** | Unique among installed packs. Lower case, no spaces. A collision is detected at install and reported — it is not silently resolved. |
| **Local key** | Unique within the pack, per content type. Readable. Stable for the life of the content. |
| **Reference** | Within a pack, the local key alone. Across packs, the full form. |

| # | Statement |
|---|---|
| **S-5.10** | An authoring key is permanent once published. Renaming content changes its display name, never its key. |
| **S-5.11** | A pack key collision at install time is reported as a conflict and blocks the install. It is never resolved automatically. |

`S-5.10` is the rule most likely to be broken by accident, because changing a key during
development is harmless right up to the moment someone else's content references it or a
saved character depends on it. The display name and the key are different things, and
conflating them means a spelling correction breaks references.

### Inline content and synthetic keys

`S-2.10` requires that features have stable identity, including features written inline
inside a class, item or monster rather than declared separately. Those need keys they were
never given.

They are synthesised at pack build — and **how** they are synthesised is the part that
matters:

```
    ✅  srd-5.1:class.fighter/level-2/action-surge
        derived from position and name — the same input produces the same key

    ❌  srd-5.1:feature.00417
        derived from a build counter — a new key every time the pack is rebuilt
```

| # | Statement | |
|---|---|---|
| **S-5.12** | Synthetic keys are derived deterministically from the content's position and name. The same pack source always produces the same keys. | ⊕ |

A counter-derived key means every rebuild of a pack produces a pack whose features have
different identity from the previous build — so an existing character's references break on
a content update that changed nothing relevant to it. Deterministic derivation makes a
rebuild a no-op for identity, which is what a rebuild should be.

Deterministic derivation has one consequence to accept openly: moving an inline feature
within its parent changes its key. That is the correct behaviour for content still being
authored, and once content is published it is the same rule as `S-5.10` — restructuring
published content is a versioning event, not an edit.

## 5.8 Instance identity

Content identity names *what something is*. A second kind of identity is needed for *which
one this is*.

| Kind | Identifies | Scope |
|---|---|---|
| **Entity id** | one creature | the user's database |
| **Instance id** | one carried item, one applied condition, one held feature | within its entity |
| **Origin id** | one reason something is present | within its entity |

Instance identity is what makes two longswords distinguishable, and what lets a contribution
say *this* ring rather than *a* ring.

Origin identity deserves particular care because `S-2.12` rests entirely on it: removing an
origin must remove exactly what that origin granted. That is only implementable if the
origin is a stored thing with an identity, referenced by everything it produced.

```
    origin       #12  "Fighter, level 2"
      ├── feature instance  #88   Action Surge      origin = 12
      └── resource          #91   Action Surge uses origin = 12

    remove origin 12  →  delete exactly the rows whose origin is 12
```

| # | Statement | |
|---|---|---|
| **S-5.13** | Origin is a stored record with its own identity, not a descriptive string attached to instances. | ⊕ |
| **S-5.14** | Every instance references its origin. Removing an origin removes exactly the instances referencing it. | ⊕ |

Recording an origin as text — `"from Fighter level 2"` — is the shortcut that looks
sufficient and is not. It displays correctly, which is why it survives review, and it makes
`S-5.14` unimplementable: undoing a level then requires string matching, and re-specification
becomes a feature nobody wants to touch.

## 5.9 Versioning: what a saved character actually references

`S-1.9` requires that a character always opens. `FR-E3` requires that content updates do not
silently change an existing character's numbers. Those two requirements point in opposite
directions and identity is where they are reconciled.

Three levels, and the distinction between them is a product decision as much as a technical
one:

| Level | What is stored | When to use |
|---|---|---|
| **Reference** | the identifier | the default — a corrected description should appear everywhere |
| **Pin** | identifier + pack version | when the character should keep the rules it was built with |
| **Snapshot** | a full copy of the definition | when the source may vanish entirely, or has been manually altered |

| # | Statement |
|---|---|
| **S-5.15** | A character records the pack and version of every pack it draws on, whether or not individual references are pinned. |
| **S-5.16** | A reference that cannot be resolved becomes an `Issue` naming the missing pack and the missing key. It never becomes a blank, a default, or a silently substituted value. |
| **S-5.17** | Snapshots are explicit and visible to the user. Content that has been snapshotted is marked as no longer tracking its source. |

`S-5.16` is the operational form of `S-1.9`, and the reason it names *both* the pack and the
key is that the two failures need different remedies: a missing pack is fixed by installing
it, a missing key by finding what replaced it. An error that says only "unresolved reference
47" tells the user nothing they can act on — which is why the registry keeps the strings
even for content that is no longer installed.

`S-5.17` is what stops snapshots from becoming an invisible divergence. A snapshotted spell
that no longer receives corrections is a reasonable thing to have; a snapshotted spell the
user believes is still current is not.

## 5.10 The export boundary

Scheme C's one limitation, handled where it belongs.

A local numeric identifier means nothing on another device. So anything leaving the
installation converts back to authoring keys:

```
    inside the installation        crossing to another device
    ────────────────────────       ──────────────────────────
    entity_item.item_id = 47   →   "srd-5.1:item.longsword"
```

| # | Statement |
|---|---|
| **S-5.18** | Exported characters and packs contain authoring keys, never local numeric identifiers. |
| **S-5.19** | Import resolves keys through the local registry, assigning new numbers for content not yet known, and reports as `Issue`s any key that cannot be resolved. |

This is the same conversion as `S-5.2`, in the same place, run in reverse. It is not a second
mechanism.

**Synchronisation (v2) is the case to think about carefully.** Two devices in a session have
different local numbers for the same content. Row-level differences that carry raw
identifiers are therefore not directly comparable between them. Two possible resolutions —
translating at the session boundary, or negotiating a shared identifier mapping when the
session opens — are both workable, and the choice belongs in §8 where the synchronisation
model is specified. What matters here is that the requirement is visible now rather than
discovered during implementation.

## 5.11 What is never an identifier

| Not an identifier | Why | Consequence if used |
|---|---|---|
| **Display name** | Names are localised, edited, and duplicated | Two items named "Dagger" become one; a spelling fix breaks references |
| **Array index or row position** | Position changes on insert, delete or sort | References silently point at the wrong element after any edit |
| **Pointer or object address** | Not stable across runs; not storable | Undefined behaviour after a reload |
| **A hash of the content** | Changes when the content is edited | Every correction to a description breaks every reference to it |
| **Load-order integer** | `S-5.3` | Silent data corruption on install or uninstall |

The first two are the ones that actually happen, and both happen for the same reason: they
work during early development, when there is one of everything and nothing has been edited
yet.

| # | Statement |
|---|---|
| **S-5.20** | Identity is independent of content. Editing a definition never changes its identifier. |

## 5.12 The registry

Pulling §5.4 together into the one structure the scheme requires:

```
content_id
    id          integer   primary key, permanent, never reused
    pack_key    text      the authoring pack key
    local_key   text      the authoring local key
    type_id     integer   which kind of content
    unique (pack_key, local_key, type_id)
```

Four columns, and a great deal follows from them:

- Every other table in §6 references content by `id` — a narrow integer foreign key.
- Uninstalling a pack deletes its *definitions* and keeps these rows, so `S-5.16` can name
  what is missing.
- Reinstalling matches on `(pack_key, local_key, type_id)` and recovers the same `id`.
- Import (`S-5.19`) is a lookup against this table, with insertion for anything unknown.
- Sorting by `id` gives a stable total order for `S-1.11` at no cost.

| # | Statement | |
|---|---|---|
| **S-5.21** | The registry is persistent, append-only in effect, and independent of which packs are currently installed. | ⊕ |
| **S-5.22** | Every reference stored anywhere in the database is a registry identifier. No table stores an authoring key as a reference. | ⊕ |

`S-5.22` is the statement that connects this section to §6. It is what makes the normalised
schema uniform: every relationship in the database, without exception, is an integer
pointing at a registry row.

## 5.13 What this section settles

| Question | Answer |
|---|---|
| String or integer? | Both, with one conversion point (`S-5.1`, `S-5.2`) |
| Who assigns the number? | The local installation (`S-5.4`) |
| How do independent authors avoid collision? | They only guarantee `(pack key, local key)` (`S-5.5`) |
| What happens on uninstall? | The number is retired; the registry row remains (`S-5.6`, `S-5.16`) |
| How wide? | 32 bits, zero reserved (`S-5.7`) |
| Type safety? | Distinct types, no runtime cost (`S-5.8`) |
| Inline features? | Deterministic synthetic keys (`S-5.12`) |
| How is "remove this source" implemented? | Origin identity (`S-5.13`, `S-5.14`) |
| What crosses to another device? | Authoring keys only (`S-5.18`) |

---

# 6. Persistence

## 6.1 The position this section replaces

`R-27`, which you accepted in `06`, said: store an indexed envelope in columns and the
mechanical body as a serialised document.

**We no longer hold that position, and this section is the argument.** It was our proposal,
not yours, so this is a correction to our own reasoning rather than a disagreement with
yours.

The original argument was: the mechanical body is highly variable, it is never queried
relationally, and the whole content set fits in memory anyway — so normalising it is cost
without benefit. Every clause in that sentence is true. The conclusion does not follow,
because the argument was made about *content* and then applied to *characters*, and
characters have the opposite write profile.

### Where it fails for characters

| | Document body | Normalised rows |
|---|---|---|
| Recording one point of damage | rewrite the entire record | update one row |
| Row-level difference for synchronisation (`R-23`) | compare two documents; the difference is the whole document | compare rows; the difference is the row |
| Undo granularity | the unit is the whole character | the unit is the change |
| "Which of my characters has darkvision?" | not answerable | a query |
| A write interrupted mid-way | the whole character is at risk | one row is at risk |

A character is written to constantly — every hit point, every spent slot, every applied
condition. A document body makes the cost of a write proportional to the size of the
character rather than to the size of the change. At 30 KB per character that is not a
performance problem, but it is a *durability* problem (`NFR-5`) and a *synchronisation*
problem, and both matter more than the write cost.

The synchronisation point is decisive on its own. Difference-based synchronisation over
documents means either shipping whole documents or building a document-diff algorithm and
a merge policy for it. Row-level differences give both for free, because rows already have
identity and the unit of change is already the unit of transmission.

### Where it fails for content

The content argument was better and still fails, for two reasons that only became clear
once identity was settled in §5.

**One storage philosophy is worth more than a local optimisation.** A serialised body needs
its own format, its own version numbering, and its own migration path when the shape of an
effect changes — separately from and in addition to the database's. Two versioning systems
is more than twice the work of one, because they can disagree.

**A discriminated node table is not actually more work.** §6.6 shows that recursive content
structures need one generic table each, not one table per variant, and that adding a new
kind of effect or expression is a new discriminator value rather than a schema change. The
cost that the envelope/body split was avoiding turns out to be much smaller than it looked.

| # | Statement | |
|---|---|---|
| **S-6.1** | All persistent data is stored in normalised relational form. No column holds a serialised object, document or blob of structured data. | ⊕ |
| **S-6.2** | Content and characters use the same storage philosophy and the same schema conventions. There is no second serialisation format. | ⊕ |

## 6.2 Physical layout

Three kinds of file, and the distinction between them is functional rather than
organisational:

```
   ┌─────────────────────────────────────────────────────────────────┐
   │  PACK FILES            read-only, distributable, immutable      │
   │  srd-5.1.pack          SQLite, content schema (§6.5)            │
   │  homebrew-goblins.pack                                          │
   └───────────────────────────────┬─────────────────────────────────┘
                                   │  installed / loaded
   ┌───────────────────────────────▼─────────────────────────────────┐
   │  USER DATABASE         read-write, one per installation         │
   │  ├── registry          content_id  (§5.12)                      │
   │  ├── characters        entity_* tables (§6.4)                   │
   │  ├── local content     the same content schema — homebrew       │
   │  │                     being authored, and snapshots            │
   │  └── history           timeline (§6.9)                          │
   └─────────────────────────────────────────────────────────────────┘
```

| # | Statement |
|---|---|
| **S-6.3** | A content pack is a SQLite file using the content schema. There is no separate pack format. |
| **S-6.4** | Pack files are never written to by the application. Installing a pack does not modify it. |
| **S-6.5** | User-authored content and snapshots live in the user database using the same content schema as packs. |

`S-6.5` closes something §5 left open. A snapshot (`S-5.17`) is a copy of a definition that
no longer tracks its source — and the obvious way to store a copy of a definition is as a
serialised document, which `S-6.1` forbids. The resolution is that a snapshot is content,
stored as content, in a local content area of the user database. The same area holds
homebrew the user is authoring.

That gives one mechanism for three things that would otherwise each need their own:
authoring, snapshotting, and shipped content. It is also the concrete form of `S-1.15` —
the application's own content and the user's use the same machinery, so the machinery is
exercised constantly.

**Packs are not imported into the user database.** They stay as files and are read at
startup. Installing a pack means registering its content in the registry (§5.12) and
recording that the file is present; it does not copy 30–50 MB of rows. Uninstalling means
forgetting the file — the registry rows remain, which is exactly what `S-5.16` requires in
order to name what is missing.

## 6.3 The one structural rule: Feature is the only owner

Before any table: a decision that determines whether the schema is enforceable or merely
conventional.

Mechanical elements — effects, activations, resources, grants, choices, triggers — have to
belong to something. The natural approach is a polymorphic owner: two columns, one saying
what kind of thing owns this and one saying which. It is flexible and **SQL cannot enforce
it.** A foreign key cannot point at "one of six tables depending on the value of a
neighbouring column", so referential integrity becomes something the application promises
rather than something the database guarantees.

There is no need for it here, because §2 already established that `Feature` is the universal
bundle (`S-2.9`) and your `R-05`/`R-06` say the same thing: a feature is what contains
effects, activations, resources, grants and choices.

So:

| # | Statement | |
|---|---|---|
| **S-6.6** | Every mechanical element belongs to exactly one feature. `feature_id` is a real foreign key, not a polymorphic reference. | ⊕ |
| **S-6.7** | Content that carries mechanics owns one or more features. A class level, an item, a spell and a monster all attach their mechanics through features rather than directly. | |

This is worth the small indirection it costs. It means the database can enforce that no
effect is orphaned, that deleting content removes exactly its mechanics, and that a query
for "everything this feature does" is one join rather than six.

It also matches `S-2.10` and your `R-26`: features are addressable, so making them the
attachment point costs nothing that was not already required.

## 6.4 The character schema

```sql
entity              (id, ruleset_id, kind_id, name, notes_id,
                     created_at, updated_at)

entity_pack         (entity_id, pack_key, pack_version)

entity_base_stat    (entity_id, stat_id, value)

entity_progression  (entity_id, ord, class_id, level)

entity_form         (id, entity_id, ord, source_id, statblock_id,
                     hp_current, active)

entity_origin       (id, entity_id, kind_id, source_id, ord)

entity_feature      (entity_id, feature_id, origin_id, active)

entity_resource     (entity_id, resource_id, origin_id, current)

entity_condition    (id, entity_id, condition_id, source_entity_id,
                     origin_id, stacks, expiry_kind_id, expiry_value)

entity_item         (id, entity_id, item_id, origin_id, qty,
                     equipped, attuned, charges, custom_name)

entity_choice       (entity_id, origin_id, choice_id, ord, selected_id)

entity_override     (id, entity_id, target_kind_id, target_id,
                     op_id, value, label, active)
```

Every non-key column is either a number, a short string, or a registry identifier (`S-5.22`).
Nothing here is variable in shape. **A character is a set of homogeneous lists**, which is
precisely the case relational storage handles best.

Four things in this schema are decisions rather than transcription.

### `entity` holds no game values

No ability scores, no hit points, no armour class. Only identity and ruleset-neutral
metadata.

A column named for a game concept is a vocabulary assumption baked into the schema, and §4
established that vocabulary is ruleset-declared (`S-4.14`). Six ability-score columns is the
same mistake as a six-field structure in memory, made somewhere much harder to change.

| # | Statement | |
|---|---|---|
| **S-6.8** | No table column is named for a game concept. Game concepts appear as identifier values in keyed rows, never as schema. | ⊕ |

### Hit points are a resource

This follows from `S-6.8` rather than being an independent choice, and it turns out to be
correct on its own merits. Hit points are a bounded quantity that is spent, restored by
rest according to declared rules (`F-17`), and whose maximum is derived (`F-07`). That is
the definition of a resource (`S-2.20`).

Storing them as `entity_resource` rather than as a column on `entity` means rest logic,
bounds checking (`S-2.22`) and restoration all work on hit points without a special case.

### `entity_resource` stores `current` and not `maximum`

Maximum is derived (`S-2.5`, `F-07`: a change in Constitution retroactively changes maximum
hit points). Storing it would create the second source of truth that `S-2.5` exists to
prevent.

| # | Statement |
|---|---|
| **S-6.9** | Only current values are stored. Maxima, limits and every other derived quantity are recomputed. |

The bound `0 ≤ current ≤ maximum` is enforced at the mutation boundary, which has derived
state available. It is not a database constraint, because the database does not know the
maximum — and that is the correct division.

### `entity_origin` is a table

`S-5.13`. Origin is a row with an identity, referenced by every instance it produced. This
is what makes "remove this source" a delete by foreign key rather than a reconstruction.

```
entity_origin  #12   kind = class-level,  source = fighter,  ord = 2
   ├── entity_feature   feature = action-surge   origin_id = 12
   └── entity_resource  resource = surge-uses    origin_id = 12
```

| # | Statement | |
|---|---|---|
| **S-6.10** | Every instance row references an origin row. Removing an origin deletes exactly the rows referencing it, by foreign key. | ⊕ |

### `entity_override` — the manual layer

Your `R-20`, given a place to live. Two forms, distinguished by `op_id`: a manual effect
that enters the normal pipeline and stacks and explains itself, and a raw override that
sets a resolved value directly.

| # | Statement |
|---|---|
| **S-6.11** | Manual modifications are stored as data in the same form as any other contribution, appear in traces labelled as manual, and are individually removable. |

### Forms

`S-2.50` – `S-2.52`:

```sql
entity_form   (id, entity_id, ord, source_id, statblock_id,
               hp_current, active)
```

| # | Statement |
|---|---|
| **S-6.28** | Forms are rows on the entity, not separate entities. Entity identity is independent of which form is active. |
| **S-6.29** | Each form row carries its own current hit points. Reversion restores the underlying row, which was never overwritten. |

Exactly one row per entity has `active` set. The base form is a row like any other, which
means the reversion case needs no special handling: it is a change of which row is active.

## 6.5 The content schema

```sql
content            (id, type_id, name, sort_name, text_id,
                    source_book_id, version)
content_tag        (content_id, tag_id)

feature            (id, content_id, name, text_id)

effect             (id, feature_id, ord, kind_id, target_id, op_id,
                    expr_id, bonus_type_id, predicate_id)

activation         (id, feature_id, ord, action_cost_id,
                    target_kind_id, resolution_kind_id, predicate_id)
activation_cost    (activation_id, cost_id, variant_ord)
activation_option  (id, activation_id, ord, name, predicate_id)
activation_outcome (id, activation_id, outcome_id)
outcome_effect     (activation_outcome_id, ord, effect_id)

resource_def       (id, feature_id, max_expr_id, initial_expr_id)
resource_restore   (resource_def_id, rest_type_id, mode_id, amount_expr_id)
resource_limit     (resource_def_id, limit_kind_id, amount)

grant              (id, feature_id, ord, kind_id, target_id, predicate_id)

choice             (id, feature_id, ord, kind_id, count,
                    filter_predicate_id)
choice_option      (choice_id, ord, target_id)

trigger            (id, feature_id, signal_kind_id, predicate_id,
                    activation_id)

duration           (id, owner_kind_id, owner_id, kind_id, amount_expr_id,
                    ends_on_id, concentration)

class_level        (id, class_id, level)
class_level_grant  (class_level_id, ord, feature_id)

expr_node          (id, root_id, parent_id, ord, kind_id,
                    int_val, ref_kind_id, ref_id)
pred_node          (id, root_id, parent_id, ord, kind_id,
                    ref_kind_id, ref_id, int_val)

text               (id, lang, body)
```

Three points about the shape.

**`activation_outcome` is a table, not a pair of columns.** This is `S-2.15` in the schema:
outcomes are a map keyed by a ruleset-defined `outcome_id`. A 5e spell has two rows; a PF2e
spell has four (`F-29`); a 5e spell with "half damage on a save" has two rows with different
effects. Columns named `on_hit` and `on_miss` would make PF2e a schema migration and a full
content rewrite.

**`activation_cost` has a `variant_ord`.** `F-31` — a PF2e activity's effect changes with
how many actions are spent. This is `S-4.10` in the schema.

**Descriptive text is a separate table.** Descriptions are large, are never needed during
computation, and are the only thing that needs localisation. Keeping them out of the hot
tables keeps those tables narrow, and narrow tables are what makes the bulk-load discipline
in §6.7 fast.

| # | Statement |
|---|---|
| **S-6.12** | Descriptive text is stored separately from mechanical structure and is not loaded on the computation path. |

### Options

`S-2.47`:

```sql
activation_option (id, activation_id, ord, name, predicate_id)
option_cost       (option_id, kind_id, resource_id, amount_expr_id)
option_effect     (option_id, ord, effect_id)

entity_form_carry (statblock_id, characteristic_id, source_id)
```

| # | Statement |
|---|---|
| **S-6.30** | Options are rows attached to an activation, with their own costs and effects. They are content, not code. |
| **S-6.31** | A form's carry-over rules are rows, one per characteristic. Adding a form with different rules requires no code. |

## 6.6 Recursive structures

Expressions and predicates are trees of unbounded depth (`S-2.29`, `S-2.31`). Damage is
`2d6 + max(STR, DEX) + floor(level / 2)`, and any node may be another expression.

The reflex is that this needs a table per node kind — twelve tables for twelve kinds of
expression node, each with a different shape — and that adding a node kind means a schema
migration. **It does not.** One table with a discriminator holds the whole grammar:

```sql
expr_node (id, root_id, parent_id, ord, kind_id,
           int_val, ref_kind_id, ref_id)
```

`2d6 + STR modifier`:

```
   id  root  parent  ord  kind      int_val  ref
   ────────────────────────────────────────────────
   100  100   NULL    0   add         –        –
   101  100   100     0   dice        2        d6
   102  100   100     1   reference   –        stat:str
```

This is an adjacency list. `root_id` groups a whole tree so it can be fetched in one query;
`parent_id` and `ord` give the structure and the order of operands.

| # | Statement | |
|---|---|---|
| **S-6.13** | Recursive structures use one generic node table per grammar, with a discriminator column, in adjacency-list form. | ⊕ |
| **S-6.14** | Adding a new node kind — a new effect kind, a new expression kind, a new predicate kind — is a new discriminator value. It is not a schema change. | ⊕ |

`S-6.14` is the answer to the objection that motivated `R-27`. The variability of the
mechanical body was the argument for storing it as a document; discriminated node tables
absorb that variability without a document, and without the second versioning system a
document format would bring.

The trade-off is honest and worth stating: a generic node table means some columns are
unused for some kinds — an `add` node has no `int_val`. That is a few null columns in a
table of a few tens of thousands of rows. In exchange the structure is queryable,
validatable by the database, and diffable. At this data scale the trade is not close.

## 6.7 The loading discipline

Full normalisation has exactly one real hazard, and it is severe enough that it deserves to
be specified rather than left to judgement.

**The wrong way** — the natural way, when objects are loaded one at a time:

```
for each spell:                          320 queries
    select its features                  320 queries
    for each feature:
        select its effects               ~900 queries
        for each effect:
            select its expression tree   ~900 queries
```

Roughly 2 500 queries for 320 spells, and it gets worse as content grows. On a phone this is
the difference between a startup that is instant and one that is visibly slow.

**The right way** — one query per table, ordered, assembled in a single pass:

```
   SELECT * FROM content     ORDER BY id
   SELECT * FROM feature     ORDER BY content_id, id
   SELECT * FROM effect      ORDER BY feature_id, ord
   SELECT * FROM expr_node   ORDER BY root_id, parent_id, ord
   ...

   → assemble in memory: each result set is already grouped by owner,
     so a single pass links children to parents with no lookup at all
```

Twelve to fifteen queries for the entire content corpus, regardless of its size.

| # | Statement | |
|---|---|---|
| **S-6.15** | Content is loaded table by table with bulk queries ordered by owner, and assembled in memory in a single pass. | ⊕ |
| **S-6.16** | No query is issued per content item. The number of queries executed during load is a constant, independent of how much content is installed. | ⊕ |

`S-6.16` is checkable directly: count the queries during startup. If the count grows with
the amount of content installed, `S-6.15` is being violated somewhere.

This discipline is also why `S-6.12` matters. Text rows are the bulk of the data by volume
and are not needed to build the mechanical graph, so they are loaded separately — or on
demand, since unlike mechanics they *can* be fetched lazily without breaking anything.

## 6.8 Writing

The write profile is the reverse of the read profile: reads are bulk and rare, writes are
small and constant.

| Operation | Rows touched |
|---|---|
| Take 8 damage | 1 |
| Spend a spell slot | 1 |
| Apply a condition | 1 insert |
| Equip an item | 1 |
| Make a choice during advancement | 1 |
| Gain a level | 1 origin + n features + n resources + n choices |

| # | Statement | |
|---|---|---|
| **S-6.17** | A change writes only the rows that changed. No operation rewrites a whole character. | ⊕ |
| **S-6.18** | Every mutation is one transaction. A partially applied change is never visible and never persisted. | |

`S-6.18` costs one line and is what makes `NFR-5` true rather than hoped for. Levelling up
touches a dozen rows; if the application is closed halfway through, the transaction boundary
is what decides whether the character is intact or in a state that no code path expects.

## 6.9 History and undo

`S-1.8` separates these. The schema reflects that separation:

```sql
timeline        (id, entity_id, seq, at, kind_id, label,
                 origin_id, actor_entity_id)
timeline_detail (timeline_id, ord, field_kind_id, ref_id,
                 before_value, after_value)
```

| # | Statement |
|---|---|
| **S-6.19** | The timeline is persistent, append-only, and never pruned automatically. |
| **S-6.20** | Undo is bounded and lives in memory. It is not persisted and does not survive restart. |
| **S-6.21** | Timeline entries are structured rows, not formatted strings. Presentation is applied when they are displayed. |

`S-6.21` is easy to get wrong and expensive to reverse. Storing `"Took 8 slashing damage
from Goblin"` seems economical until the text needs translating, or the user changes a
creature's name, or the history has to be filtered by kind. Structured rows can always be
rendered as text; text can never be recovered into structure.

`S-6.20` follows from your `R-16` and is worth stating in the negative: persisting undo would
make the undo stack part of the durable state, which means migrating it, synchronising it,
and bounding it in storage. Undo is a convenience for a mistake made moments ago. The
timeline is the durable record.

## 6.10 What is never stored

| Not stored | Why |
|---|---|
| Derived state — armour class, attack bonuses, maximum hit points, skill modifiers | `S-2.5`, `S-6.9`. A second source of truth diverges. |
| Trigger signals | `S-2.19`. Transient, machine-facing, high volume. |
| Interned lookup tables built at load | Derivable from the registry. |
| Formatted text for display | `S-6.21`. |

| # | Statement | |
|---|---|---|
| **S-6.22** | No derived value appears in any table. A column that could be recomputed is a defect. | ⊕ |

`S-6.22` is stated absolutely on purpose. Caching a derived value in memory is legitimate and
can be added at any time without consequence, because a cache can be discarded. Persisting
one is not, because it survives the thing it was derived from.

## 6.11 Integrity — what the database can and cannot enforce

This divides cleanly, and knowing where the line falls determines what has to be validated
in code.

**Enforceable by the database:**

| | |
|---|---|
| Within a pack | Every foreign key. An effect belongs to a real feature; an expression node belongs to a real tree. `S-6.6` is what makes this true. |
| Within the user database | Every entity row references a real registry identity and a real origin. |
| Uniqueness | `(pack_key, local_key, type_id)` in the registry (`S-5.5`). |
| Bounds expressible without game knowledge | `qty ≥ 0`, `stacks ≥ 0`, `ord ≥ 0`. |

**Not enforceable by the database:**

| | Why | Handled by |
|---|---|---|
| Cross-pack references | Different files; no foreign key spans them | Validation at install, returning `Issue[]` |
| A reference to content not currently installed | The registry knows the identity, not whether a definition is present | `S-5.16` — an `Issue`, by design |
| Rule-level validity — prerequisites, attunement limits, legal builds | Requires the ruleset | Validation in Core, returning `Issue[]` |
| `0 ≤ current ≤ maximum` | Maximum is derived and the database does not know it | The mutation boundary |

| # | Statement |
|---|---|
| **S-6.23** | Everything the database can enforce is declared in the schema and enforced there, not re-checked in application code. |
| **S-6.24** | Everything it cannot enforce is validated explicitly and reported as `Issue[]` data, never as an exception and never silently repaired. |

The second row of the second table is the one worth dwelling on. A reference to
uninstalled content is **not an integrity violation** — it is a correct reference to a known
identity whose definition is absent. That distinction is what allows `S-1.9`: the character
loads, the reference is understood, and the user is told precisely which pack to install.

## 6.12 Schema evolution

Two version numbers, for two different things, changing on different schedules:

| Version | Belongs to | Changes when |
|---|---|---|
| **Database schema version** | the user database | a table or column changes |
| **Pack format version** | a pack file | the content schema changes |

| # | Statement |
|---|---|
| **S-6.25** | The user database records its schema version and migrations are applied in order at startup. |
| **S-6.26** | A pack declares the format version it was built for. A pack too new for the application is reported, not partially read. |
| **S-6.27** | New discriminator values are not schema changes and require no migration (`S-6.14`). |

`S-6.27` is where the design pays off most visibly. The most frequent kind of change in a
system like this is a new kind of effect, a new expression node, a new predicate. Under a
schema of one table per variant, each is a migration applied to every installed database.
Under discriminated node tables, each is a new value in a lookup table — new content works
in the existing schema, and content using an unknown discriminator is reported as an
`Issue` rather than crashing.

That last part matters: a pack built for a newer version of the application will contain
discriminator values this version does not recognise. The correct behaviour is to load
everything else and report what could not be understood, which is the same behaviour as
`S-5.16` and for the same reason.

## 6.13 What this section settles

| Question | Answer |
|---|---|
| Documents or rows? | Rows, everywhere (`S-6.1`) |
| Where do packs live? | Separate read-only SQLite files, never imported (`S-6.3`, `S-6.4`) |
| Where do homebrew and snapshots live? | A local content area in the user database, same schema (`S-6.5`) |
| How do mechanics attach to content? | Through features, a real foreign key (`S-6.6`) |
| Ability scores as columns? | No — no column is named for a game concept (`S-6.8`) |
| Hit points? | A resource, not a field |
| Maxima? | Derived, never stored (`S-6.9`, `S-6.22`) |
| Recursive structures? | One discriminated node table per grammar (`S-6.13`) |
| A new effect kind? | A discriminator value, not a migration (`S-6.14`, `S-6.27`) |
| The N+1 hazard? | Bulk load per table, constant query count (`S-6.15`, `S-6.16`) |
| Integrity? | Database where it can, `Issue[]` where it cannot (`S-6.23`, `S-6.24`) |

---

# 7. The computation pipeline

## 7.1 What this section specifies

One function, and everything that has to be true about it:

```
    recompute(entity, content, ruleset)  →  DerivedState
```

Pure (`S-2.6`), deterministic (`S-1.10`, `S-1.11`), and producing values that carry their own
explanation (`S-1.6`, `S-2.7`).

This is where the largest number of subtle correctness bugs live in systems of this kind,
and almost all of them have the same two causes: **the order of operations was not
specified**, or **the order of collection leaked into the result**. Both are avoidable by
construction, and both are extremely hard to find afterwards, because the symptom is a
number that is wrong occasionally rather than a number that is wrong.

## 7.2 Two computations, one machine

The system computes two different kinds of thing, and it is worth seeing that they share
their machinery before specifying either.

| | Derived state | Resolution |
|---|---|---|
| Question | *What is my armour class?* | *Does this attack hit?* |
| Trigger | anything changed | the user acts |
| Randomness | none | a die is rolled — or supplied (`S-1.7`) |
| Result | a value with contributions | an outcome identifier |

Both begin identically: gather everything that applies, then combine it in a defined order.
Resolution then adds a roll and a comparison. So the pipeline is specified once and used
twice.

| # | Statement |
|---|---|
| **S-7.1** | Derived state and roll assembly use the same gathering and combination machinery. Resolution is that machinery plus a roll and an outcome mapping. |

## 7.3 Stage 1 — gathering

Collect every contribution that might apply to the value being computed.

Sources, in no significant order (the ordering rules come in §7.4):

```
    base value from the ruleset
    stats                       (entity_base_stat)
    features held               (entity_feature → effect)
    items equipped or attuned   (entity_item → feature → effect)
    conditions active           (entity_condition → condition → effect)
    manual modifications        (entity_override)
```

Each candidate contribution carries a predicate (`S-2.31`). *Only while raging. Only if
wearing no armour.* Gathering evaluates the predicate and keeps the contribution only if it
holds.

| # | Statement |
|---|---|
| **S-7.2** | Gathering produces a set of candidate contributions, each with its origin, its operation, its value expression and its bonus type. |
| **S-7.3** | A contribution whose predicate does not hold is excluded at gathering and does not appear in the trace as a zero. |

`S-7.3` is a small decision with a visible consequence. A trace listing every effect the
character possesses, most of them contributing nothing, is unreadable. The trace should
show what applied.

There is a legitimate exception worth allowing deliberately: when the user is asking *why
something did not apply*, showing excluded contributions with their failed predicate is
useful. That is a distinct query — "explain what is not applying" — and not the default
trace.

### When a predicate cannot be evaluated

`S-2.44`: predicates are three-valued, and gathering is where that becomes concrete.

```
    true      →  the contribution is included
    false     →  it is excluded
    unknown   →  it is set aside as a pending question
```

| # | Statement | |
|---|---|---|
| **S-7.29** | A contribution whose predicate is `unknown` is neither included nor discarded. It is collected as a pending question with the contribution attached. | ⊕ |
| **S-7.30** | Pending questions cross to the interface as their own answer shape (`S-3.23`), alongside resolved values. | |
| **S-7.31** | Once answered, the answer applies for the duration the ruleset declares — a single roll, a turn, or until revoked. It is not asked again within that scope. | |

`S-7.31` is what keeps this usable rather than exhausting. Without a scope, attacking three
times would ask three times whether an ally is adjacent.

The derived value in the meantime is computed **without** the unknown contribution and marked
as provisional. That is the honest presentation: the number the system can justify, plus a
visible statement of what it does not know.

## 7.4 The ordering problem

`S-1.11` requires that the result not depend on the order in which contributions were
collected. This sounds automatic and is not, for two independent reasons.

**Collection order is not deterministic.** Contributions arrive from iteration over
containers. If any of those is hash-based, the order can differ between runs, between
platforms, and between library versions. The same character then computes different
numbers on the phone and on the desktop — intermittently, which is the worst kind of
intermittently.

**Some operations are not commutative.** Addition is. Setting a value is not. Multiplying
and then clamping is not the same as clamping and then multiplying. So order-independence
cannot be achieved by making operations commutative; it has to be achieved by making the
order *defined*.

Two mechanisms together, and both are needed:

| # | Statement | |
|---|---|---|
| **S-7.4** | Contributions are sorted into a canonical order before combination. The sort key is `(phase, bonus type, origin identifier, contribution index)` and is a total order. | ⊕ |
| **S-7.5** | The sort is stable and depends on no value that varies between runs — no memory addresses, no pointer values, no hash iteration order. | ⊕ |

The origin identifier in the sort key is the reason §5 insisted that identity be numeric and
permanent. A stable total order over contributions requires a stable total order over their
sources, and integer identity provides one at no cost.

`S-7.4` and `S-7.5` are directly testable:

| # | Statement |
|---|---|
| **S-7.6** | Computing the same derived state from the same inputs with the candidate contributions randomly permuted produces byte-identical results. |

This should be an automated test rather than a claim, and it should run on every derived
value the system computes. It is the only practical way to catch an order dependence, since
by nature it will not appear in ordinary use until it does.

## 7.5 The phases

The combination stage is a fixed sequence of phases. **The sequence is part of the engine
and does not vary between rule systems. What varies is the policy inside each phase**, which
is the `StackingModel` axis from §4.6.

```
   ┌─────────────────────────────────────────────────────────────────┐
   │  0  BASE            the starting value declared by the ruleset  │
   ├─────────────────────────────────────────────────────────────────┤
   │  1  SET-BASE        contributions that replace the base         │
   │                     ── these COMPETE; they do not accumulate    │
   │                     ── policy: highest wins / user chooses      │
   ├─────────────────────────────────────────────────────────────────┤
   │  2  TYPED           bonuses that carry a type                   │
   │                     ── policy per type: highest / sum / once    │
   ├─────────────────────────────────────────────────────────────────┤
   │  3  UNTYPED         bonuses with no type — these accumulate     │
   ├─────────────────────────────────────────────────────────────────┤
   │  4  SCOPED ×        multipliers applied to ONE contribution     │
   ├─────────────────────────────────────────────────────────────────┤
   │  5  FLOOR / SET     minimums and value-setting                  │
   ├─────────────────────────────────────────────────────────────────┤
   │  6  TOTAL ×         multipliers applied to the whole value      │
   ├─────────────────────────────────────────────────────────────────┤
   │  7  CLAMP           caps and bounds                             │
   ├─────────────────────────────────────────────────────────────────┤
   │  8  ROUND           the ruleset's rounding rule                 │
   └─────────────────────────────────────────────────────────────────┘
```

| # | Statement | |
|---|---|---|
| **S-7.7** | The phase sequence is fixed and shared by every rule system. Only the policy within a phase is ruleset-supplied. | ⊕ |
| **S-7.8** | Every contribution declares which phase it belongs to. A contribution cannot be applied out of phase. | ⊕ |

Five of these phases exist because of a specific mechanic that cannot be expressed without
them. Each is worth its own note.

### Phase 1 — set-base contributions compete

`F-04`, `F-05`: a character has one armour class, and the several formulas that can produce
it are alternatives rather than addends. Armour gives one. Unarmoured Defense gives another.
Mage Armor gives a third. **They do not sum** — a barbarian in no armour with Mage Armor
active does not get both base values.

This is the phase that a naive additive model gets wrong, and it gets it wrong silently: the
number is simply too high, and it looks plausible.

| # | Statement |
|---|---|
| **S-7.9** | Contributions that set a base value compete. Exactly one wins, chosen by the ruleset's policy. |
| **S-7.10** | Every competing contribution appears in the trace, with the losers marked as superseded rather than omitted. |

`S-7.10` matters for a reason beyond tidiness. When a player disagrees with the number, the
question is almost always *"why is it not using my armour?"* — and a trace that silently
dropped the losing candidate cannot answer it.

**Whether the winner is chosen by the rules or by the player is `F-04`/`F-05`, and it is
still unverified.** The rules appear to let a character choose which formula to use;
applications generally take the highest automatically. The two differ whenever the highest
is not what the player wants — which happens, for example, when a formula the player
prefers has a side condition. The pipeline supports either policy; **which is the default is
your decision, and it is one we cannot make for you.**

### Phases 2 and 3 — typed and untyped

The distinction only exists in systems that have bonus types, and those systems differ
sharply in how many and how they combine:

| System | Types | Rule |
|---|---|---|
| 5e | effectively none (`F-43`) | identical named effects do not stack, stated per effect |
| PF2e | 3 — circumstance, status, item (`F-35`) | highest of each type applies |
| 3.5 / PF1 | many (`F-34`) | same type does not stack; untyped stacks; dodge is an exception |

This is a large structural difference, and it lands entirely inside two phases with a
per-type policy. That is the `StackingModel` axis earning its place: three genuinely
different systems, one phase structure, three policy objects.

| # | Statement |
|---|---|
| **S-7.11** | Bonus types and their combination policies are ruleset data. The engine applies the declared policy; it contains no knowledge of specific types. |

### Phase 4 versus phase 6 — multiplier scope

This is the distinction most likely to be missed, and it produces wrong numbers that are
hard to trace.

A multiplier can apply to **one contribution** or to **the whole value**, and they are not
interchangeable:

| Mechanic | Scope | Phase |
|---|---|---|
| Expertise doubles the proficiency bonus (`F-06`, `F-44`) | one contribution | 4 |
| Resistance halves the damage total (`F-12`) | the whole value | 6 |

If expertise were applied at phase 6, it would double everything — the ability modifier and
every other bonus as well. If resistance were applied at phase 4, it would halve only one
component.

| # | Statement | |
|---|---|---|
| **S-7.12** | A multiplier declares its scope: a single contribution or the whole value. The two are applied in different phases. | ⊕ |

### Phase 5 — setting and minimums

`F-25`: some effects set a value outright ("your speed becomes 40") and some establish a
floor ("your speed is at least 30"). Neither is an addition, and both must apply after
additions or the bonuses they were meant to override would be lost.

Two set-contributions can conflict, so this phase needs the same competition policy as
phase 1.

| # | Statement |
|---|---|
| **S-7.13** | Setting and minimum operations are distinct from addition and apply after it. |

### Phase 8 — rounding once, at the end

`F-12`: resistance halves and rounds down. `F-01`: the ability modifier is a floor division.
Rounding in the middle of a calculation and rounding at the end give different answers, and
the difference is exactly the kind of one-point discrepancy a player will notice and report.

| # | Statement |
|---|---|
| **S-7.14** | Rounding happens once, at the end of the pipeline, according to the ruleset's rule. Intermediate values are not rounded. |

## 7.6 Damage: the same pipeline, one level down

Damage is a value computed by this pipeline, but `F-12` fixes an order that must be
respected: **sum all damage first, then apply resistance.** Applying resistance to each
component separately and then summing gives a different — and wrong — answer whenever
rounding is involved.

`F-24` adds a second constraint: a critical hit doubles only the dice, not the modifiers. So
damage has internal structure that a single number cannot carry.

| # | Statement | |
|---|---|---|
| **S-7.15** | A damage value keeps its dice and its modifiers separately until the point at which they are combined. | ⊕ |
| **S-7.16** | Damage of several types is summed per type, then reduction is applied per type, then the results are combined. | |

`S-7.15` is cheap now and awkward later. A damage model that produces `8` cannot answer
"what would this be on a critical hit"; one that produces `2d6 + 3` can. Since critical hits
are not an edge case, the structured form is the one to build.

The interaction between a critical and resistance is a matter of ordering — the critical
applies to the dice at roll time, the reduction applies to the total afterwards (`F-45`).
This is a fact worth confirming, because if it is wrong the two phases swap.

## 7.7 The trace is a by-product

`FR-C2` and `S-2.7`: the explanation is part of the value, not a separate operation.

Concretely, this means the pipeline appends a record at every step it takes, and the result
is the value plus that list. There is no second traversal, no "explain mode", and no
possibility of the explanation disagreeing with the number — because they are produced by
the same statements.

```
    AC = 17
      10   base                    ruleset
      +2   DEX modifier            stat
     [13   Unarmoured Defense      superseded by armour]      ← S-7.10
      +4   Chain Shirt             item: chain shirt
      +1   Ring of Protection      item: ring (deflection)
```

| # | Statement | |
|---|---|---|
| **S-7.17** | The trace is produced during computation, by the same code that computes the value. There is no separate explanation path. | ⊕ |
| **S-7.18** | Replaying the trace's operations in order reproduces the value exactly. | |

`S-7.18` is the precise form of `S-2.8`, and the precision matters. It is **not** "the
contributions sum to the value" — with set-base, multipliers and clamps in the pipeline,
they do not. It is that the recorded sequence of operations, replayed, gives the recorded
result.

That is mechanically testable on every value the system produces, and it should be a
permanent test rather than a review item. It is the only thing that detects a calculation
which has quietly bypassed the contribution mechanism, which is the way explainability
decays: not all at once, but one shortcut at a time.

## 7.8 Advantage is not a number

`F-03`: advantage and disadvantage do not accumulate, and one of each cancels completely.
Three sources of advantage and one of disadvantage produce a normal roll.

This will not fit in the numeric pipeline, and every attempt to make it fit is wrong:

| Attempted representation | Fails because |
|---|---|
| `+5` to the roll | Two sources would give `+10`; the statistics are wrong anyway |
| A counter, net of both | Three advantage and one disadvantage would leave advantage — `F-03` says it does not |
| A boolean pair set anywhere | Whichever source is processed last wins |

The correct representation is a pair of flags, collected from all sources and resolved once
at the end:

```
    hasAdvantage    = any source grants it
    hasDisadvantage = any source imposes it

    both  →  normal        neither →  normal
    only advantage →  advantage    only disadvantage →  disadvantage
```

| # | Statement | |
|---|---|---|
| **S-7.19** | Non-numeric roll modifiers are collected separately from numeric contributions and resolved by their own rule at a defined point. | ⊕ |
| **S-7.20** | The sources of advantage and disadvantage appear in the trace even though they contribute no number. | |

`S-7.20` exists because "why do I have disadvantage?" is one of the most frequently asked
questions at a table, and it is unanswerable if the flags are collected without their
origins.

### The order of roll modifiers

`S-4.27`: modifiers apply in a ruleset-declared order, and the order matters.

```
    1  collect     every source of every modifier kind, with its origin
    2  resolve     opposing kinds cancel per the ruleset's rule (F-03)
    3  roll        draw the dice the resolved kinds require
    4  adjust      rerolls, minimums, replacements — in declared order
    5  select      take the result the resolved kinds indicate
```

| # | Statement |
|---|---|
| **S-7.32** | Roll modifiers are applied in the ruleset's declared order. The engine does not choose an order. |
| **S-7.33** | Every roll modifier appears in the trace with its origin, whether or not it changed the outcome. |

### Sourcing under an active form

`S-2.52`: when a form is active, each characteristic comes from the form or from the base
according to the carry-over declaration.

| # | Statement |
|---|---|
| **S-7.34** | Where a characteristic comes from is resolved before gathering. Contributions are then collected against the resolved source in the normal way. |
| **S-7.35** | The trace names which form supplied a value when a form is active. |

## 7.9 Recomputation

The naive strategy — recompute everything whenever anything changes — is correct, and at
this scale it is also fast enough. `S-2.5` requires that derived state never be stored, so
there is nothing to invalidate.

| # | Statement |
|---|---|
| **S-7.21** | Recomputation is whole-entity by default. No dependency graph is maintained. |
| **S-7.22** | Memoisation, if added, is a cache that can be discarded at any moment without changing any result. |

`S-7.22` is the line between an optimisation and a design change. A cache that can be
dropped safely is free to add later; one that becomes the source of truth is `S-2.5`
violated by another route.

A rough sense of the cost: a character has on the order of a hundred active effects and a
few dozen derived values. A full recomputation is a few thousand arithmetic operations over
data already in memory — microseconds. Optimising it before measuring it would be effort
spent against a problem that does not exist, and it would cost the simplicity that makes
the pipeline verifiable.

## 7.10 Cycles

A real hazard, and one that is only detectable if it is looked for.

Predicates can depend on derived values: *"+2 armour class while your armour class is below
15"*. So can expressions. Content can therefore describe a value that depends on itself,
directly or through a chain — and nothing in the content model prevents an author from
writing one, since each individual piece is legitimate.

| # | Statement |
|---|---|
| **S-7.23** | The computation detects circular dependency and reports it as an `Issue` naming the participants in the cycle. |
| **S-7.24** | A cycle does not crash, does not hang, and does not silently produce a value. |

`S-7.24` is stated in the negative because all three failures are plausible. Unbounded
recursion crashes; a fixed iteration limit hangs or produces a value that depends on the
limit; and an uninitialised default silently produces a wrong number. The correct behaviour
is to stop, report which effects form the cycle, and compute everything else — which is
`S-2.35` applied here.

## 7.11 Resolution

The second use of the machinery.

```
   1  ASSEMBLE   build the roll's modifier using §7.3 – §7.5
                 collect advantage/disadvantage separately (S-7.19)

   2  ROLL       draw from the supplied source — or take a value
                 entered by the user (S-1.7)

   3  COMPARE    against the target, per the ruleset's attack,
                 save or check model (§4.6)

   4  MAP        turn the comparison into an OutcomeId
                 5e: 2 outcomes · PF2e: 4, by margin (F-33)

   5  APPLY      execute the effects the content declares for
                 that OutcomeId (S-2.15)

   6  SIGNAL     emit trigger signals; triggers may respond (S-2.17)
```

| # | Statement | |
|---|---|---|
| **S-7.25** | Every step of resolution is traced: the modifier and its parts, the roll, the comparison, the outcome chosen. | |
| **S-7.26** | The roll source is a parameter. A hand-entered value enters at exactly the same point as a generated one, through the same interface. | ⊕ |
| **S-7.27** | Steps 3 and 4 are separate. Assembling and comparing a roll is one variation point; mapping the comparison to an outcome is another. | ⊕ |

`S-7.26` is `FR-D7` made structural. The temptation is to treat manual entry as a special
mode that bypasses the normal path — and then every feature added afterwards works in one
mode and not the other. If the roll is a parameter, there is no second path to keep in step.

`S-7.27` is `S-4.8` seen from the pipeline side, and the practical test is a house rule: a
table that adds critical fumbles to 5e should be changing one small object, not forking
attack resolution.

## 7.12 Testing

The pipeline is the part of the system where testing is both most valuable and most
straightforward, because `S-2.6` made it a pure function.

| Test | What it establishes |
|---|---|
| **Golden values** — a character computed by hand, compared against the system | The rules are implemented correctly. The only test that can establish this. |
| **Permutation** — the same inputs with contributions shuffled (`S-7.6`) | No order dependence |
| **Trace replay** — every `ResolvedValue` replayed (`S-7.18`) | Nothing bypasses the contribution mechanism |
| **Repetition** — the same inputs twice, byte-compared | No hidden state, no ambient time or randomness |
| **Fixed roll source** — resolution with a supplied sequence | Resolution is deterministic and testable at all |
| **Constant search** — `grep` Core for rule constants (`S-3.9`) | Nothing has drifted into shared code |

| # | Statement |
|---|---|
| **S-7.28** | A golden-value test set exists for at least one fully worked character, covering every derived value, and is maintained as the rules implementation changes. |

The golden test is the one that cannot be substituted. Every other test on this list checks
that the system is *consistent*; only a hand-computed character checks that it is *right*.
A system can be perfectly deterministic, perfectly order-independent, perfectly traced, and
wrong.

## 7.13 What this section settles

| Question | Answer |
|---|---|
| How is order-independence achieved? | Canonical sort before combination (`S-7.4`, `S-7.5`) |
| Where does stacking live? | Nine fixed phases, ruleset-supplied policy inside each (`S-7.7`) |
| Competing armour-class formulas? | Phase 1 — they compete, losers stay in the trace (`S-7.9`, `S-7.10`) |
| Expertise versus resistance? | Multiplier scope: one contribution or the whole value (`S-7.12`) |
| Where does the trace come from? | The pipeline itself, as it works (`S-7.17`) |
| Advantage? | Not a number — flags with their own rule (`S-7.19`) |
| Recomputation strategy? | Recompute everything; caching optional and discardable (`S-7.21`) |
| Circular content? | Detected, reported, does not crash (`S-7.23`) |
| Manual dice? | A parameter, not a mode (`S-7.26`) |

## 7.14 New domain facts introduced in this section

| # | Fact | Supports |
|---|---|---|
| **F-44** | In 5e, expertise doubles the proficiency bonus itself rather than adding a separate equal bonus — so it multiplies one contribution, not the total | `S-7.12`, multiplier scope |
| **F-45** ⚑ | When a critical hit and damage resistance both apply, the critical multiplies the dice at the point of rolling and resistance halves the resulting total afterwards | `S-7.15`, phase order |

`F-04` and `F-05` remain the most important unverified facts for this section: **they decide
the default policy in phase 1**, which is the phase that most visibly produces a wrong
number when the policy is wrong.

---

# 8. Mutation, history and synchronisation

## 8.1 Why these three are one section

They look like three features and they are one mechanism seen from three angles.

Every change to a character has to be applied, recorded, made reversible, and — in v2 —
propagated to another device. If each of those is implemented where it happens, then each
one is implemented many times, and each one will eventually be forgotten somewhere. The
symptom is familiar: a change that works but does not appear in the history, or one that
cannot be undone, or one that does not reach the other device. Every such bug is the same
bug.

So the four responsibilities are given one place to live, and the code that performs a
change knows about none of them.

| # | Statement | |
|---|---|---|
| **S-8.1** | Applying, recording, making reversible and propagating a change are the responsibility of one boundary, not of the code that performs the change. | ⊕ |

## 8.2 The mutation boundary

```
    mutate(entityId, mutator, descriptor, label)
```

Everything that changes a persistent entity passes through this one call.

| # | Statement | |
|---|---|---|
| **S-8.2** | No code outside the boundary writes entity state to the database. | ⊕ |
| **S-8.3** | The user interface never modifies an entity. It calls the boundary. | ⊕ |

The sequence the boundary performs, in this order:

```
    1  load        the current entity value
    2  apply       run the mutator — a pure Entity → Entity function
    3  recompute   derive state from the result (§7)
    4  check       enforce invariants that need derived state
    5  persist     write only the changed rows, in one transaction
    6  record      append a timeline entry
    7  retain      push an undo record
    8  signal      emit trigger signals; triggers may respond
    9  notify      tell the interface what changed
```

| # | Statement |
|---|---|
| **S-8.4** | The steps happen in this order, and steps 5 to 9 happen only if steps 2 to 4 succeeded. |
| **S-8.5** | Step 5 is a single transaction (`S-6.18`). A change is either wholly persisted or not persisted. |

Step 4 is where `S-2.22` (`0 ≤ current ≤ maximum`) is enforced, and it is placed after
recomputation because the maximum is derived (`S-6.9`) and does not exist before step 3.
This is the reason the boundary — and not the database, and not the mutator — is the place
where that bound is checked.

Step 8 is inside the boundary rather than after it because a trigger's response is itself a
change, and it must pass through the same sequence. A trigger firing another trigger is
therefore bounded by the same rules as anything else.

| # | Statement |
|---|---|
| **S-8.6** | A trigger's response re-enters the boundary as a change in its own right. Trigger cascades have a depth limit; exceeding it produces an `Issue` rather than a hang. |

## 8.3 What stays in Core

`S-3.15`: mutators are pure `Entity → Entity`. They express what the rules say happens and
nothing else.

```
    Core                              Application
    ────────────────────────          ───────────────────────────
    applyDamage(entity, n)            history
    applyCondition(entity, c)         undo
    takeRest(entity, kind)            persistence
    levelUp(entity, choice)           notification
    ↑                                 synchronisation
    the rules                         everything about the change
                                      having happened
```

| # | Statement | |
|---|---|---|
| **S-8.7** | A mutator computes a new entity value. It does not write to a database, record history, notify anything, or know that it is being recorded. | ⊕ |
| **S-8.8** | Mutators are testable in isolation: given an entity and an argument, assert on the resulting entity. No infrastructure is involved. | |

The division has a test that is easy to apply and hard to argue with: **if a mutator's
signature mentions anything but domain types, it has acquired a responsibility that belongs
to the boundary.**

## 8.4 The descriptor

A mutator passed as a closure cannot be examined before it runs. The boundary can execute
it; it cannot ask what it is about to do.

That is sufficient today and it forecloses several things that are not needed today and
will be:

| Question | Needs |
|---|---|
| *Is this user allowed to do this?* (DM and player over the same entity) | to know what it is before running it |
| *Should this be confirmed?* (irreversible or destructive changes) | the same |
| *Should this be propagated?* (private notes need not synchronise) | the same |
| *What is happening?* (a meaningful label without hand-writing one every time) | the same |

So a small descriptor travels alongside the closure:

```
    descriptor {
        kind                 what class of change this is
        targetIds            which entities it affects
        requiresConfirmation optional
        scope                private / shared
    }
```

| # | Statement | |
|---|---|---|
| **S-8.9** | Every mutation carries a descriptor stating what it is, independently of the code that performs it. | ⊕ |
| **S-8.10** | The boundary can inspect, authorise, filter and label a mutation without executing it. | ⊕ |

This is your `R-25`. It costs one parameter now. Retrofitting it means visiting every call
site, and by then the call sites are the whole application.

## 8.5 Reopened: should mutations be reified as objects?

An earlier draft proposed a `Command` object per operation, replacing the closure entirely.
It was withdrawn in `06` mainly because an implementation already existed — which is not an
argument about the design. `D13` asked for this to be re-examined on a clean sheet, so here
it is examined on a clean sheet.

**What reification would add** is one thing only: a mutation becomes a value that can be
stored, transmitted, replayed and inspected in full. A closure cannot leave the process.

**What it costs** is a class per operation, a serialisation format for each, and a version
of that format that has to remain readable by future versions of the application.

The question is therefore whether anything actually requires a mutation to leave the
process. There is exactly one candidate: synchronisation. If devices exchanged *intentions*
rather than *results*, mutations would have to be serialisable and reification would be
mandatory.

### Why intent-based synchronisation is the wrong choice here

This is not a close call, and the reason is specific to this application rather than
general.

Replaying an intention on another device produces the same result **only if that device
computes the same answer** — which requires the same ruleset code, the same content packs,
at the same versions, with the same content installed.

**This application cannot guarantee any of that.** Two players at one table will have
different content installed; one may have updated the application and the other not; a
homebrew pack may exist on one device only. Under intent-based synchronisation, each of
those differences produces silent divergence — the two devices believe different things
about the same character, and nothing detects it.

State-based synchronisation has no such requirement. A row that says *current hit points
are 23* means the same thing on both devices regardless of what either has installed.

| # | Statement | |
|---|---|---|
| **S-8.11** | Synchronisation transmits resulting state, not intentions. Devices are never required to compute the same answer from the same inputs. | ⊕ |

With `S-8.11`, the only motivation for reification disappears, and the conclusion is:

| # | Statement |
|---|---|
| **S-8.12** | Mutations are not reified as serialisable objects. The behaviour is a function; the *description* of the change is reified as the descriptor (`S-8.9`). |

That is the useful formulation: **reify the description, not the behaviour.** The descriptor
gives inspection, authorisation, filtering and labelling — everything reification was wanted
for — without a class hierarchy or a serialisation format.

The condition under which this should be revisited is worth stating so that it is a
decision rather than an assumption: if real conflict behaviour shows that state-based
differences produce results a user considers wrong — two devices changing related things
where the merged outcome is incoherent — then intent becomes worth its cost. That is
evidence, and it does not exist yet.

## 8.6 Composite changes

Some changes are many changes: levelling up creates an origin, grants features, adds
resources and opens choices.

| # | Statement |
|---|---|
| **S-8.13** | A composite change is one mutation: one transaction, one timeline entry, one undo record. |
| **S-8.14** | Advancement is a state that may hold unresolved choices (`S-2.27`). Entering that state, and each choice made within it, are separate mutations. |

These two are consistent, though at first reading they look opposed. `S-8.13` says the
*application* of a level's grants is atomic. `S-8.14` says arriving at level 5 is not a
single indivisible act, because it may require decisions that the user has not yet made and
may take an hour to make. The atomic unit is each step; the level as a whole is a state.

That is also what makes advancement resumable rather than a modal dialogue that cannot be
closed — which matters most on the platform this application primarily targets.

## 8.7 The timeline

`S-1.8`: the user-visible record and the undo facility are different mechanisms with
different lifetimes. This is the first of the two.

| | |
|---|---|
| Purpose | The user's record of what happened |
| Lifetime | Persistent, survives restart, not pruned automatically |
| Granularity | One entry per meaningful change |
| Produced by | The boundary, step 6 — never by the code performing the change |

| # | Statement |
|---|---|
| **S-8.15** | Timeline entries are produced by the boundary. No mutator writes one. |
| **S-8.16** | An entry records what changed, by how much, from what origin, and when — as structured fields, not as a formatted sentence (`S-6.21`). |
| **S-8.17** | Not every mutation produces an entry. The descriptor's kind determines whether a change is worth recording. |

`S-8.17` prevents the timeline from filling with noise. Toggling a display preference is a
mutation; it is not history. The judgement lives in the descriptor, where it can be seen and
changed, rather than being distributed through the code as a decision made repeatedly.

`S-8.16` is the one that is expensive to reverse. Storing *"Took 8 slashing damage from
Goblin"* works until the text needs translating, or a creature is renamed, or the user wants
to filter to damage only, or a total is wanted. Structure renders to text; text does not
recover into structure.

## 8.8 Undo

The second mechanism, and deliberately much smaller.

| | |
|---|---|
| Purpose | Reverse a mistake made moments ago |
| Lifetime | The session. Bounded. Not persisted (`S-6.20`) |
| Mechanism | Before-and-after values for the rows a change touched |

| # | Statement |
|---|---|
| **S-8.18** | Undo stores the changed rows before and after, not an inverse operation. |
| **S-8.19** | The undo stack is bounded by a fixed count and discarded on close. |

`S-8.18` is the decision worth explaining, because inverse operations are the more elegant
answer and they are wrong here.

The inverse of *"take 8 damage"* looks like *"heal 8"* and is not: if the damage took the
character to zero and triggered unconsciousness, and if temporary hit points absorbed part
of it, then healing 8 does not restore the prior state. Every mutator would need a correctly
written inverse, each with its own edge cases, and each one is a place to be wrong in a way
that produces a plausible but incorrect state.

Before-and-after row values have none of that. They are exactly correct by construction, and
`S-6.17` already established that a change touches few rows — so the storage cost is
negligible.

| # | Statement |
|---|---|
| **S-8.20** | Undo restores stored values. It does not recompute, re-derive, or re-run rules. |

## 8.9 Synchronisation (v2)

Not built in v1. Specified now because — as `S-8.11` has already shown — it constrains
decisions that are being made now.

### The model

| # | Statement |
|---|---|
| **S-8.21** | Each entity has exactly one owner device at any time. Only the owner changes it; others hold a copy. |
| **S-8.22** | Changes propagate as row-level differences (`S-8.11`). |
| **S-8.23** | Each entity carries a monotonically increasing sequence number, incremented by its owner on every change. |

Single ownership per entity is what makes this simple, and it is not a limitation in
practice: a player owns their character, the DM owns the monsters. The hard case in
distributed systems — two writers to one record — mostly does not arise here because the
domain does not require it.

Where it does arise, it is bounded and specific. A DM applies damage to a player's
character. The resolution is that the DM sends a *request* to the owner, which applies it
and propagates the result; the DM does not write to another device's entity. `S-8.21` holds,
and the descriptor's `targetIds` (`S-8.9`) is what makes such a request expressible.

### What crosses the wire

`S-5.18`: identifiers are local to an installation. Two devices have different numbers for
the same content, so a row containing `item_id = 47` cannot be sent as-is.

Two workable resolutions:

| Approach | How |
|---|---|
| **Translate per message** | Convert identifiers to authoring keys when sending, resolve on receipt |
| **Negotiate once per session** | Exchange identifier mappings when the session opens; send raw numbers thereafter |

| # | Statement |
|---|---|
| **S-8.24** | Identifiers are translated at the session boundary. No message contains an identifier whose meaning depends on the sender's installation. |

The second approach is more efficient and the first is simpler; either satisfies `S-8.24`,
and the choice can be made when synchronisation is built. What cannot be deferred is the
recognition that a translation is required at all — a protocol designed without it works
perfectly between two identical installations and corrupts data between two different ones.

### Conflict

| # | Statement |
|---|---|
| **S-8.25** | A change from a non-owner is rejected, not merged. |
| **S-8.26** | A change whose sequence number is not the successor of the last received triggers a full resynchronisation of that entity rather than a partial application. |

`S-8.26` is a deliberate choice of robustness over efficiency. Reconstructing what was
missed from a partial history is where distributed systems acquire their subtlest bugs.
Sending a whole entity is a few tens of kilobytes on a local network — it costs nothing and
it cannot be subtly wrong.

## 8.10 What synchronisation requires of everything above

This section's decisions are only affordable because of decisions made earlier. Setting them
out shows that the design is coherent rather than merely consistent:

| Requirement | Provided by |
|---|---|
| Rows are the unit of change | `S-6.1` — normalised storage. A document body would make the unit the whole character |
| Rows have stable identity | `S-5.4`, `S-5.6` — permanent numeric identity, never reused |
| Identifiers can cross devices | `S-5.5`, `S-5.18` — authoring keys survive translation |
| Derived state need not be transmitted | `S-2.5`, `S-6.22` — it is recomputed locally from what was received |
| One place to intercept propagation | `S-8.1` — the boundary |
| Filtering what propagates | `S-8.9` — the descriptor's scope |
| Rules versions need not match | `S-8.11` — state, not intent |

The fourth row is worth pausing on. Because derived state is never stored, it is never
synchronised — so two devices with different content installed can hold the same character
state and each compute what it can from what it has. The device missing a pack reports
`Issue`s (`S-5.16`) and shows what it can. Under a design that stored derived values, the
missing pack would instead propagate wrong numbers.

`S-2.5` was argued in §2 purely as a correctness rule about a second source of truth. It
turns out to be what makes synchronisation between unequal devices possible at all. That is
usually how these things go: the constraint pays somewhere other than where it was
introduced.

## 8.11 What this section settles

| Question | Answer |
|---|---|
| Where do changes happen? | One boundary, always (`S-8.1`, `S-8.2`) |
| What does Core do? | Pure `Entity → Entity`, nothing else (`S-8.7`) |
| Commands or closures? | Closures plus a descriptor — reify the description, not the behaviour (`S-8.12`) |
| Why not intent-based sync? | It requires devices to compute identically; they cannot be made to (`S-8.11`) |
| Levelling up? | One mutation per step; advancement is a state (`S-8.13`, `S-8.14`) |
| Timeline? | Structured, persistent, produced by the boundary (`S-8.15`, `S-8.16`) |
| Undo? | Stored before-and-after values, bounded, in memory (`S-8.18`, `S-8.19`) |
| Two writers? | One owner per entity; others request (`S-8.21`) |
| Identifiers across devices? | Translated at the session boundary (`S-8.24`) |
| Missed a message? | Resynchronise the entity whole (`S-8.26`) |

`A-06` and `R-23` were both marked as reopened by `D13`. **Both are now closed on the merits
rather than on the existence of code:** state-based synchronisation is correct because
devices cannot be required to hold identical rules and content, and reification is therefore
unnecessary. Your original positions were right, and this is the argument for them that did
not exist before.

---

# 9. The content pack format

## 9.1 What is already fixed

From §6: a pack is a SQLite file using the content schema (`S-6.3`), never written to by
the application (`S-6.4`), and not imported into the user database — it stays as a file and
is read at startup.

From §5: content inside a pack is identified by authoring keys, and numeric identity is
assigned locally at install (`S-5.4`).

What remains to specify is everything around that file: what an author writes, how the file
is produced, what is validated and when, what a version means, and what an update is allowed
to do.

## 9.2 Two representations

A pack has a **source** form and a **built** form, and conflating them causes the confusion
that usually surrounds this topic.

```
    SOURCE                    BUILD                   PACK
    text files            ┌──────────────┐        srd-5.1.pack
    or the in-app     ──► │  validate    │ ──►    SQLite, content
    editor                │  synthesise  │        schema, read-only
                          │  resolve     │
                          │  checksum    │
                          └──────────────┘
    diffable                                      loaded directly,
    version-controllable                          no parsing
    never shipped                                 no interpretation
```

| # | Statement |
|---|---|
| **S-9.1** | The source form is a build-time artefact. It is never loaded by the application at runtime. |
| **S-9.2** | The built pack contains no text that must be parsed to be understood. Loading is reading rows (`S-6.15`). |

`S-9.1` is what keeps this consistent with `S-6.1`. That statement forbids serialised
documents in *storage*; it says nothing about what a human types into a text editor before a
build tool turns it into rows. Source files are like source code — they exist to be written
and reviewed, and they are compiled into the form the program actually uses.

The gain from `S-9.2` is concrete: startup does no parsing, no schema validation, and no
error handling for malformed input, because a built pack is either a valid database or not a
database at all. Everything that could go wrong went wrong at build time, in front of the
author, with a line number.

## 9.3 The source format

◇ **This is a genuine choice and the reasoning matters more than the conclusion.**

The instinct is to pick the format that is most pleasant to write by hand. That instinct
optimises for the wrong case, because of who actually writes content:

| Route | Volume | Written by |
|---|---|---|
| Bulk conversion — SRD material into a pack | The large majority | A script |
| The in-app editor | Most user content | The application (`S-6.5`) |
| Hand-edited text files | A minority | A person |

Most content is produced by tools, not typed. The format should therefore be chosen for
**unambiguous parsing and universal tool support**, not for hand-writing comfort:

| Format | For | Against |
|---|---|---|
| **JSON** ✅ | One interpretation, no whitespace semantics, every language has a solid parser, trivial to generate | Verbose; no comments |
| YAML | Comfortable to write, comments | Whitespace-significant; a well-known set of implicit-typing surprises; parser behaviour varies |
| TOML | Excellent for flat configuration | Poor at deep nesting, which is exactly what content is |

| # | Statement | |
|---|---|---|
| **S-9.3** | The source format is JSON. Comments, where needed, are a documented field rather than a syntax extension. | ◇ |
| **S-9.4** | The primary authoring surface is the in-app editor, not a text file. The text format exists for bulk conversion and version control. | ◇ |

The objection to JSON is real — writing 320 spells in it by hand is unpleasant. `S-9.4` is
the answer: nobody should be doing that. The editor is where content is authored, and it is
the same editor the application's own content could be built with, which is `S-1.15` again.

## 9.4 The manifest

Every pack declares itself:

```json
{
  "packKey":     "srd-5.1",
  "name":        "System Reference Document 5.1",
  "version":     "1.2.0",
  "rulesetId":   "dnd5e-2014",
  "formatVersion": 3,
  "requires":    [ { "packKey": "core-vocab", "minVersion": "1.0.0" } ],
  "license":     "CC-BY-4.0",
  "attribution": "...",
  "author":      "..."
}
```

| # | Statement |
|---|---|
| **S-9.5** | A pack belongs to exactly one ruleset and declares it. Content from a pack is never used with an entity of another ruleset (`S-2.38`). |
| **S-9.6** | A pack declares the format version it was built for. A pack built for a newer format is reported and not partially read (`S-6.26`). |
| **S-9.7** | A pack declares its licence and attribution, and the application displays them. |

`S-9.7` is not decoration. SRD 5.1 and 5.2 are distributable under CC-BY-4.0, which requires
attribution — a condition the application must actually satisfy, not merely intend to. Making
it a field the format requires means it cannot be forgotten, and it is also what makes the
distinction visible to a user who wants to know what they are allowed to share.

| # | Statement |
|---|---|
| **S-9.8** | The application ships only content it is licensed to distribute (`S-1.14`). Everything else is a file the user supplies. |

## 9.5 Dependencies between packs

A pack may reference content in another: a homebrew subclass extends an official class, a
monster pack uses conditions defined elsewhere.

| # | Statement |
|---|---|
| **S-9.9** | Cross-pack dependencies are declared in the manifest with a minimum version. |
| **S-9.10** | An undeclared cross-pack reference is a validation error at build time, not a runtime surprise. |
| **S-9.11** | A pack with an unsatisfied dependency still installs. The content that cannot resolve is marked unusable and reported as `Issue`s; the rest works. |

`S-9.11` follows the same principle as `S-1.9` and is worth defending explicitly, because
refusing the install is the more obvious behaviour.

Refusing means a pack of two hundred monsters, one of which references a missing condition,
provides nothing. Installing means it provides a hundred and ninety-nine monsters and a
clear statement of what is missing and which pack supplies it. The second is better in every
case, and the first offers no compensating safety — nothing is protected by withholding the
content that does resolve.

## 9.6 The build

What the build tool does, in order:

```
   1  PARSE        read source; report syntax errors with locations
   2  VALIDATE     structure: every required field, every value in range
   3  SYNTHESISE   assign deterministic keys to inline content (S-5.12)
   4  RESOLVE      turn intra-pack references into rows; report unresolved
   5  CHECK        cross-pack references are declared (S-9.10)
   6  EMIT         write the SQLite file
   7  SEAL         record a checksum of the content
```

| # | Statement | |
|---|---|---|
| **S-9.12** | The build is deterministic: the same source produces a pack with identical content and identical identities (`S-5.12`). | ⊕ |
| **S-9.13** | A built pack carries a checksum over its content, verified at install. | |
| **S-9.14** | Every build error names a location in the source and what is wrong with it. | |

`S-9.12` is what makes rebuilding safe. If a rebuild reassigned identities, then republishing
a pack with a corrected description would break every character referencing anything in it —
a change with no relationship to what the author actually edited.

`S-9.14` is not a nicety. This tool is the interface through which all content — the
application's own included — is created, so its error messages determine how expensive
content authoring is. An error that says only "validation failed" makes a five-second fix
into a twenty-minute search.

## 9.7 Validation

Four levels, at three different times. Knowing which check happens when is what keeps each
of them cheap.

| Level | Checks | When | Produces |
|---|---|---|---|
| **Structural** | Required fields, types, ranges | Build | Build error |
| **Referential (internal)** | Every reference within the pack resolves | Build | Build error |
| **Referential (external)** | Cross-pack references resolve | Install | `Issue[]` (`S-9.11`) |
| **Semantic** | The ruleset considers this content coherent | Install | `Issue[]` |

| # | Statement |
|---|---|
| **S-9.15** | Structural and internal referential errors are build errors. A pack containing them cannot be produced. |
| **S-9.16** | External and semantic problems are `Issue`s. They never prevent installation or loading (`S-2.33`, `S-2.35`). |

The division is the same one as §6.11 — what can be guaranteed locally is enforced
absolutely, and what depends on the environment is reported. It has the same justification:
a check that can be made total should be, and a check that cannot should never pretend to be.

Semantic validation is where the ruleset gets involved: an effect targeting a stat this
ruleset does not declare, an outcome identifier outside the ruleset's outcome set (`S-4.8`),
a resource restored by a rest type that does not exist. None of these are structural — the
rows are well-formed — and none can be detected without knowing the ruleset.

## 9.8 Versions and updates

A pack version says something about compatibility, and what it says should be defined rather
than assumed.

| Change | Version | Effect on existing characters |
|---|---|---|
| Correcting a description | patch | None |
| Adding new content | minor | None |
| Changing a mechanic | minor | Numbers may change — intentionally |
| Renaming displayed text | patch | None |
| **Changing an authoring key** | — | **Not allowed** (`S-5.10`) |
| **Removing content** | major | References become `Issue`s |

| # | Statement |
|---|---|
| **S-9.17** | An authoring key is permanent. Content is retired rather than renamed, and retired content remains in the pack marked as such. |
| **S-9.18** | Removing content from a pack is a breaking change and requires a major version. |
| **S-9.19** | A character records the version of every pack it draws on (`S-5.15`), and can pin content to survive later changes (`S-5.16`, `S-5.17`). |

`S-9.17` is the rule an author is most likely to break, because renaming looks like tidying.
Retirement — the row stays, marked retired, no longer offered when building a character — is
what lets an existing character keep working while nobody new acquires the content.

`FR-E3` said content updates must not silently change an existing character's numbers, and
the row for "changing a mechanic" appears to contradict it. It does not: the point is that
the change is not *silent*. The character records the pack version it was built against
(`S-9.19`), so an update that alters numbers is detectable, reportable, and — through
pinning — refusable. The user finds out; the application does not decide for them.

## 9.9 What an author actually writes

The most useful test of the whole model in this specification: express a real mechanic and
see whether the primitives suffice.

**Rage**, which exercises a resource with limits and restoration, an activation, a duration,
effects with predicates, and an expression that scales with level:

```json
{
  "id": "rage",
  "type": "feature",
  "name": "Rage",
  "text": "...",

  "resources": [{
    "id": "rage-uses",
    "max": { "kind": "table", "by": "class-level:barbarian",
             "values": { "1": 2, "3": 3, "6": 4, "12": 5, "17": 6 } },
    "restore": [{ "on": "rest:long", "mode": "full" }]
  }],

  "activations": [{
    "id": "enter-rage",
    "cost": "action:bonus",
    "consumes": [{ "resource": "rage-uses", "amount": 1 }],
    "requires": { "kind": "not", "of": { "kind": "wearing", "category": "armor:heavy" }},
    "applies": { "condition": "raging",
                 "duration": { "kind": "rounds", "amount": 10,
                               "endsOn": ["unconscious", "no-attack-or-damage-taken"] }}
  }],

  "effects": [
    { "when": { "kind": "hasCondition", "condition": "raging" },
      "target": "damage:melee-strength",
      "op":     "add",
      "value":  { "kind": "table", "by": "class-level:barbarian",
                  "values": { "1": 2, "9": 3, "16": 4 } },
      "bonusType": "rage" },

    { "when": { "kind": "hasCondition", "condition": "raging" },
      "target": "resistance",
      "op":     "grant",
      "value":  ["bludgeoning", "piercing", "slashing"] },

    { "when": { "kind": "hasCondition", "condition": "raging" },
      "target": "save:str",
      "op":     "advantage" }
  ]
}
```

Every element here maps onto something already specified: `resources` to `S-2.20`, `restore`
to `S-2.21`, `requires` and `when` to predicates (`S-2.31`), `value` to the closed expression
grammar (`S-2.29`), `bonusType` to the stacking phases (`S-7.11`), `advantage` to the
non-numeric path (`S-7.19`).

**Sneak Attack**, which exercises the trigger model and a once-per-turn limiter:

```json
{
  "id": "sneak-attack",
  "type": "feature",
  "name": "Sneak Attack",

  "triggers": [{
    "on": "attack-hit",
    "when": { "kind": "all", "of": [
      { "kind": "weaponHasProperty", "property": "finesse-or-ranged" },
      { "kind": "any", "of": [
        { "kind": "hasAdvantage" },
        { "kind": "allyAdjacentToTarget" }
      ]}
    ]},
    "limit": { "kind": "once-per-turn" },
    "applies": {
      "target": "damage",
      "op": "add",
      "value": { "kind": "dice", "count":
                 { "kind": "ceil", "of": { "kind": "div",
                   "left": "class-level:rogue", "right": 2 }},
                 "die": 6 }
    }
  }]
}
```

| # | Statement |
|---|---|
| **S-9.20** | Every mechanic expressible in the model is expressible in the source format, and the source format offers nothing the model cannot represent. |

`S-9.20` is the correspondence that keeps the two honest. A format richer than the model
produces content that loads and does not work; a model richer than the format produces
capabilities nobody can reach.

**These two examples are also the best available test of §2.** If a mechanic cannot be
written in this form, either a primitive is missing or the mechanic belongs in the manual
long tail (`S-1.17`) — and knowing which is exactly the judgement `S-1.18` is about.

### Options in the source format

`S-2.47`, from the Great Weapon Master case:

```json
{
  "id": "great-weapon-master",
  "type": "feature",
  "name": "Great Weapon Master",

  "activationOptions": [{
    "id": "power-attack",
    "appliesTo": { "kind": "attack", "with": "heavy-melee" },
    "prompt": "Take −5 to hit for +10 damage?",
    "decidedAt": "before-roll",
    "effects": [
      { "target": "attack-roll", "op": "add", "value": -5 },
      { "target": "damage",      "op": "add", "value": 10 }
    ]
  }]
}
```

and the offered-trigger form, from Divine Smite:

```json
{
  "triggers": [{
    "on": "attack-hit",
    "mode": "offered",
    "when": { "kind": "weaponIsMelee" },
    "options": [{
      "id": "smite",
      "cost": { "resource": "spell-slot", "level": "chosen" },
      "effects": [{
        "target": "damage", "op": "add", "type": "radiant",
        "value": { "kind": "dice", "count":
                   { "kind": "add", "of": [1, "ref:chosen-slot-level"] },
                   "die": 8 }
      }]
    }]
  }]
}
```

| # | Statement |
|---|---|
| **S-9.26** | Options, their prompts, their costs and when they are decided are all content. No option is implemented in code. |

## 9.10 The editor

`S-9.4` makes the in-app editor the primary authoring surface, which means it is not a
secondary feature.

| # | Statement |
|---|---|
| **S-9.21** | The editor writes into the local content area of the user database (`S-6.5`), using the same schema as a pack. |
| **S-9.22** | Content being edited is usable immediately, without a build step. |
| **S-9.23** | Exporting builds a pack from the local content area, applying the same validation as any other build (`S-9.6`). |

`S-9.22` is what makes the editor usable: change a feature, look at the character, see the
effect. That is only possible because the editor's output is already in the runtime form —
which is a direct consequence of `S-6.5`, and one more return on having a single storage
philosophy.

`S-9.23` means shared content and built-in content have passed identical checks. There is no
category of content that is trusted less by the engine, only content whose provenance is
displayed differently.

## 9.11 Packs are data

`NG-2` and `S-4.6`: content is data, rules are compiled code. A pack contains no executable
anything.

| # | Statement |
|---|---|
| **S-9.24** | A pack cannot execute code, and installing one grants no capability beyond adding content. |
| **S-9.25** | Structural limits — expression depth, node count, tree size — are enforced at build and at install. |

`S-9.24` is a security property obtained for free from a decision made for entirely
different reasons. The closed expression grammar (`S-2.30`) was chosen to avoid owning a
scripting VM; it also means the worst a hostile pack can do is describe wrong game content.

`S-9.25` covers what remains, which is resource exhaustion rather than compromise: an
expression tree a million nodes deep is not an attack, but it is a way to make the
application unusable, and a limit costs nothing.

## 9.12 What this section settles

| Question | Answer |
|---|---|
| What is a pack? | A SQLite file in the content schema, read-only (`S-6.3`) |
| What does an author write? | JSON source, or the editor — never the pack directly (`S-9.3`, `S-9.4`) |
| Is source loaded at runtime? | No. It is a build-time artefact (`S-9.1`) |
| Missing dependency? | Installs anyway; unresolvable content reported (`S-9.11`) |
| What is a build error, what is an `Issue`? | Local and total → error. Environmental → `Issue` (`S-9.15`, `S-9.16`) |
| Can a key be renamed? | No. Content is retired, never renamed (`S-9.17`) |
| Can an update change numbers? | Yes, but never silently — versions are recorded and content can be pinned (`S-9.19`) |
| Where does the editor write? | The local content area, same schema, usable immediately (`S-9.21`, `S-9.22`) |
| Can a pack do harm? | It is data. Only structural limits are needed (`S-9.24`, `S-9.25`) |

---

# 10. Invariants

## 10.1 What this section is

An invariant is a statement that is **always true of a running system**. Not a goal, not a
guideline, not something to aim for — something that, if it is ever false, means there is a
defect, whether or not anything visible has gone wrong yet.

That distinction is what makes invariants useful. Most defects in a system like this are
discovered by a user noticing a wrong number, which is late and unreliable. An invariant
turns a class of defect into something a machine can detect, on every build, before anyone
sees it.

**Every invariant here has a test.** An invariant without one is an opinion, and it will
drift.

### Relation to the specification statements

Sections 1–9 numbered their claims `S-1.1 … S-9.25`. Those are design claims: they say how
the system is put together. The invariants below are the subset that can be checked
continuously, restated as properties rather than as decisions, with the method of checking
attached.

Some invariants correspond to one statement; some consolidate several. Each names its source.

### Relation to `04-reference.md`

`04` listed `INV-1 … INV-28`. **The numbering is kept**, because you have read it, and
changing numbers would break every reference. Four of them are revised in light of decisions
made in sections 1–9, and each revision says what changed and why. `INV-29 … INV-45` are new.

## 10.2 Kinds of test

| Kind | Method | Runs |
|---|---|---|
| **Static** | Search or build configuration — a violation cannot compile or is found by a text search | Every build |
| **Property** | Randomised inputs, asserting a relationship rather than a value | Every build |
| **Unit** | A specific case with a known answer | Every build |
| **Runtime** | An assertion inside the system, active in development builds | Continuously |
| **Audit** | A person reads and judges | Deliberately, on a schedule |

The ordering is by reliability. A static test cannot be forgotten; an audit is only as good
as the last time it was done. **Where an invariant can be turned into a static test, it
should be** — that is why §3's prohibitions were phrased as things a search can find.

## 10.3 Definitions and instances

| # | Invariant | From | Test |
|---|---|---|---|
| **INV-1** | A content definition is immutable after loading. No code path modifies one. | `S-2.2` | **Static** — definitions are constant in the type system; a write does not compile |
| **INV-2** | Everything that changes during play is on an instance, never on a definition. | `S-2.3` | **Static**, as INV-1 |
| **INV-3** | An instance stores a reference to its definition, not a copy — except where a snapshot is deliberate and marked. | `S-2.4`, `S-5.17` | **Unit** — change a definition, confirm existing instances observe it; confirm snapshotted ones do not |

`INV-1` is the one to make structurally impossible rather than merely tested. Storing state
on a definition is the characteristic failure of this domain, it works perfectly with one
character, and it surfaces months later as two characters sharing a sword's charges.

## 10.4 Derived state

| # | Invariant | From | Test |
|---|---|---|---|
| **INV-4** | No derived value is stored anywhere — not in the database, not on the entity. | `S-2.5`, `S-6.22` | **Static** — no column in the schema corresponds to a derived value; reviewed when the schema changes |
| **INV-5** | Recomputation is pure: the same inputs give the same outputs, with no I/O, clock or randomness. | `S-2.6`, `S-1.10` | **Unit** — run twice, compare byte for byte. **Static** — search Core for time and random functions |
| **INV-6** ⚠️ **revised** | Every computed value carries a trace, and **replaying the trace's operations in order reproduces the value exactly.** | `S-2.8`, `S-7.18` | **Property** — for every `ResolvedValue` produced by any test, replay and compare |

> **`INV-6` is revised.** `04` stated it as *"the contributions sum to the value"*. That is
> false once the pipeline includes competing base setters, scoped multipliers, floors and
> clamps (§7.5) — none of which are additions. The correct property is replay, and it is
> equally testable.

## 10.5 Determinism and ordering

| # | Invariant | From | Test |
|---|---|---|---|
| **INV-7** | The order in which contributions are collected does not affect the result. | `S-1.11`, `S-7.6` | **Property** — permute the candidate set randomly, assert identical output |
| **INV-8** | Stacking is deterministic and its policy comes from the ruleset, not from the content author. | `S-7.7`, `S-7.11` | **Unit** per policy. **Static** — no stacking constant in shared engine code |
| **INV-35** | Every contribution declares its phase and is applied only in that phase. | `S-7.8` | **Runtime** — assert on phase during combination |
| **INV-44** | Advantage and disadvantage are never represented as numbers. | `S-7.19` | **Static** — no numeric bonus carries an advantage semantic; **Unit** — three advantage plus one disadvantage yields a normal roll (`F-03`) |

`INV-7` is the invariant most likely to be violated without anybody noticing, because the
violation is usually an iteration over a hash-based container and the symptom is a number
that is wrong on one platform only. The permutation test is cheap and it is the only thing
that finds it.

## 10.6 Identity and origin

| # | Invariant | From | Test |
|---|---|---|---|
| **INV-9** | Every instance knows its origin. | `S-2.11`, `S-5.13` | **Static** — origin is a required field, not nullable |
| **INV-10** | Every contribution knows which instance produced it. | `S-2.7` | **Property** — every trace entry names a resolvable origin |
| **INV-11** | Content identity is unique on `(pack key, local key, type)`. | `S-5.5` | **Static** — a database uniqueness constraint |
| **INV-30** | A numeric identifier is never reused. | `S-5.6` | **Runtime** — the registry only appends; **Unit** — uninstall and reinstall, confirm the same number returns and no other content acquired it |
| **INV-31** | No persisted or transmitted identifier depends on load order or on which packs are installed. | `S-5.3` | **Unit** — save a character, install another pack, reload, confirm every reference still resolves to the same content |
| **INV-32** | Every reference stored in the database is a registry identifier. No table stores an authoring key as a reference. | `S-5.22` | **Static** — schema review; no text column is a foreign key |
| **INV-39** | An authoring key is permanent. Content is retired, never renamed. | `S-9.17` | **Unit** — the build tool rejects a key that disappeared without being retired |

`INV-31` is the invariant that protects against the worst failure mode in the whole
specification: silent reference corruption. Its test is short and should exist before any
content is authored, because after that the failure is expensive rather than merely
alarming.

## 10.7 Ruleset isolation

| # | Invariant | From | Test |
|---|---|---|---|
| **INV-12** | An entity belongs to exactly one ruleset for its whole life. | `S-2.38` | **Static** — no operation changes an entity's ruleset |
| **INV-13** | Content from one ruleset is never applied to an entity of another. | `S-9.5` | **Runtime** — assert on ruleset match wherever content is applied |
| **INV-14** | **No game constants in Core.** No `+2`, no `d20`, no `(score − 10) / 2`. | `S-3.9`, `R-29` | **Static** — search Core for numeric literals; every survivor is 0, 1, or a structural bound |
| **INV-34** | Core holds no global mutable state. Two rulesets can be live in one process with no interference. | `S-4.18`, `S-4.19` | **Static** — no singleton, no global registry, no global random source. **Unit** — construct two independent engines and operate both |
| **INV-43** | The set of outcome categories comes from the ruleset. No fixed outcome fields exist anywhere. | `S-2.16`, `S-4.8` | **Static** — no type or column named for a specific outcome |

`INV-14` is the single invariant on which `NFR-6` depends, and it is the easiest of all of
them to check — which is fortunate, because it is also the one that erodes most quietly.
Constants do not arrive in a commit called "hard-code 5e"; they arrive one convenience at a
time, and each is individually reasonable.

`INV-43` is worth its own entry rather than being folded into `INV-14`, because a field
named `onHit` is not a numeric constant and a search for numbers will not find it.

## 10.8 Layering

| # | Invariant | From | Test |
|---|---|---|---|
| **INV-15** | Core performs no I/O, reads no clock, generates no randomness. | `S-3.4` … `S-3.6` | **Static** — Core builds and links without those libraries |
| **INV-16** | Core does not depend on Application, Infrastructure or the user interface. | `S-3.1`, `S-3.24` | **Static** — enforced by build targets; a violation fails the build |
| **INV-28** ⚠️ **revised** | Adding a rule system requires **no change to existing ruleset-independent interface infrastructure.** Ruleset-specific presentation is legitimate. | `S-3.22`, `06` §7 | **Audit** — the four-system audit (§4.13) |

> **`INV-28` is revised** to your formulation from `06`. Ours said "not a single UI file",
> which is wrong: a 4e sheet may reasonably look different from a 5e sheet, and forbidding
> that would force ruleset differences into places worse suited to them. What must not
> change is the shared infrastructure.

`INV-16`'s test deserves emphasis because it costs almost nothing to set up and replaces a
convention that would otherwise erode. If `core` does not link `infra`, a stray include is a
build error on the day it is written rather than a discovery in month eight.

## 10.9 Mutation and history

| # | Invariant | From | Test |
|---|---|---|---|
| **INV-17** ⚠️ **revised** | Every persistent state change passes through the **application mutation boundary**. | `S-8.1`, `S-8.2`, `R-14` | **Static** — no write to entity tables outside the boundary |
| **INV-18** ⚠️ **revised** | Core mutators are pure `Entity → Entity`. They record nothing and notify nothing. | `S-8.7`, `R-15` | **Static** — a mutator's signature mentions only domain types |
| **INV-19** | The timeline is a record of what happened. State is not reconstructed from it. | `S-6.19` | **Audit** — no code path rebuilds an entity by replaying timeline entries |
| **INV-42** | Every mutation is one transaction. A partially applied change is never persisted. | `S-6.18`, `S-8.5` | **Unit** — inject a failure mid-mutation, confirm nothing was written |
| **INV-27** | Every roll the system makes can be replaced by a supplied value, through the same interface. | `S-1.7`, `S-7.26` | **Static** — the roll source is a parameter, with no alternative path. **Unit** — resolve with a fixed sequence |
| **INV-37** | Synchronisation transmits resulting state, never intentions. | `S-8.11` | **Audit** — no message contains an operation to be replayed |
| **INV-38** | An entity has exactly one owner. A change from a non-owner is rejected, not merged. | `S-8.21`, `S-8.25` | **Unit** — a non-owner change is refused |

> **`INV-17` and `INV-18` are revised.** `04` said changes happen "via a Command" and that
> commands return "a new entity plus domain events". §8 closed that question differently and
> on the merits (`S-8.12`): mutations are not reified, the description is. And per your
> `R-18`, timeline entries and trigger signals are separate things rather than one event
> stream.

## 10.10 Resources, rest and bounds

| # | Invariant | From | Test |
|---|---|---|---|
| **INV-23** | `0 ≤ current ≤ maximum`, always. | `S-2.22` | **Property** — random sequences of spend and restore never breach the bounds |
| **INV-24** | Rest logic contains no knowledge of specific features or resources. | `S-2.21` | **Static** — the name of no specific resource appears in rest code |

`INV-24` has the most memorable test in this section: **if the word "rage" appears anywhere
in the rest implementation, the invariant is violated.** The same applies to "ki", "slot"
and every other specific name.

## 10.11 Choices and validation

| # | Invariant | From | Test |
|---|---|---|---|
| **INV-20** | A selection is identified by `(origin, choice)` and is never silently discarded. | `S-2.25`, `S-2.28` | **Unit** — a multiclass build offering the same choice twice retains both selections |
| **INV-21** | An invalidated selection is reported as an `Issue`, never automatically repaired. | `S-2.28` | **Unit** — remove a prerequisite, confirm an `Issue` and no silent change |
| **INV-22** | Advancement is a state that may hold unresolved choices, not an atomic operation. | `S-2.27`, `S-8.14` | **Unit** — begin advancement, close the application, reopen, confirm it resumes |

`INV-20`'s test is worth writing early even though multiclassing is not a first-week feature,
because the failure is invisible: the second selection overwrites the first, the user loses a
proficiency they chose, and nothing anywhere reports it.

## 10.12 Storage

| # | Invariant | From | Test |
|---|---|---|---|
| **INV-29** | No table column is named for a game concept. | `S-6.8` | **Static** — schema review; no column named for an ability score, a defence, or a damage type |
| **INV-33** | The number of queries executed during content load is constant, independent of how much content is installed. | `S-6.16` | **Unit** — count queries with a small and a large content set; the counts are equal |
| **INV-40** | The build is deterministic: the same source produces identical content and identical identities. | `S-9.12` | **Unit** — build twice, compare |
| **INV-41** | A pack cannot execute code. Installing one grants no capability beyond adding content. | `S-9.24` | **Static** — no interpreter, no evaluation of content-supplied text as code |

`INV-33` is the check that keeps full normalisation honest. It is the one place where the
storage decision could genuinely hurt, and it converts a discipline that is easy to violate
into a number that is easy to compare.

## 10.13 Failure behaviour

| # | Invariant | From | Test |
|---|---|---|---|
| **INV-25** | A character always opens, even when content it references is missing — degraded, with the problems listed. | `S-1.9`, `S-5.16` | **Unit** — save a character, remove a pack, open it, confirm it loads with `Issue`s |
| **INV-26** | A saved character records the pack and version of everything it draws on. | `S-5.15`, `S-9.19` | **Static** — required field. **Unit** — round-trip |
| **INV-36** | A circular dependency in content is detected and reported. It never crashes, never hangs, and never silently produces a value. | `S-7.23`, `S-7.24` | **Unit** — author content with a deliberate cycle; assert an `Issue` and a finite computation |
| **INV-45** | Problems are returned as data. Exceptions are reserved for programming errors. | `S-2.33`, `R-31` | **Static** — validation and loading signatures return issue collections and do not throw |

`INV-25`'s test is the single most valuable test in this specification, measured by what it
protects: hours of a user's work against an uninstalled pack. It takes ten minutes to write
and it should be written before the first content pack exists, because afterwards it is a
test of a system that has already been designed around the assumption.

## 10.13a Invariants added in Draft 2

| # | Invariant | From | Test |
|---|---|---|---|
| **INV-46** | A form is never a separate entity. Entity identity does not change when a form is entered or left. | `S-2.50`, `S-6.28` | **Unit** — shift, revert, confirm the same entity and the same identifiers throughout |
| **INV-47** | An `unknown` predicate result is never silently treated as `false` or as `true`. | `S-2.45`, `S-7.29` | **Unit** — author content with an unevaluable condition; assert a pending question, not a missing effect |
| **INV-48** | An option's effects apply only when the option was selected, and the selection appears in the trace. | `S-2.49` | **Unit** — resolve with and without the option; compare traces |
| **INV-49** | Roll modifiers are applied in a declared order, and the result does not depend on collection order. | `S-7.32` | **Property** — permute modifier sources, assert identical outcomes |
| **INV-50** | In v1, no code advances a clock. Durations are recorded, displayed, and ended by the user. | `S-1.19` | **Static** — no timer, no turn counter, no automatic expiry |
| **INV-51** | Every reference kind used by any content is in the published list. | `S-2.53` | **Static** — the build tool rejects an unknown reference kind |
| **INV-52** | Every trigger signal names its source. | `S-2.57` | **Static** — source is a required field |

## 10.14 The minimum harness

If only a few of these can exist at the start, these are the ones. Each catches a class of
defect that is otherwise found late and by a user:

| Priority | Test | Catches |
|---|---|---|
| **1** | Golden character — every derived value hand-computed and compared (`S-7.28`) | The rules being wrong. **Nothing else catches this.** |
| **2** | Permutation (`INV-7`) | Order dependence — otherwise found as an intermittent platform-specific wrong number |
| **3** | Trace replay (`INV-6`) | Calculations bypassing the contribution mechanism |
| **4** | Missing pack (`INV-25`) | Data loss |
| **5** | Constant search (`INV-14`) | Ruleset assumptions drifting into Core |
| **6** | Two engines (`INV-34`) | Global state, discovered otherwise on the day a user has two characters in different systems |
| **7** | Query count (`INV-33`) | Load time degrading silently as content grows |

The first is different in kind from the rest. Every other test on the list establishes that
the system is *consistent*. Only a hand-computed character establishes that it is *right* —
and a system can be perfectly deterministic, perfectly ordered, perfectly traced, and wrong
about every number it produces.

## 10.15 What cannot be tested automatically

Three of these depend on judgement, and pretending otherwise would be worse than admitting
it:

| # | Invariant | Why not automatable | Instead |
|---|---|---|---|
| **INV-19** | "Not event sourcing" is an architectural property, not a runtime one | Review when the timeline is touched |
| **INV-28** | Requires knowing what a second ruleset would need | The four-system audit (§4.13) — one day, on paper |
| **INV-37** | Requires reading what messages mean, not just their shape | Review when the protocol is designed |

`INV-28`'s audit is the one to schedule rather than intend. It is the only check that
validates `NFR-6` before a second ruleset exists — and after a second ruleset exists, it is
no longer a check, it is a repair.

## 10.16 Invariants resting on unverified facts

Three invariants have a shape that depends on a domain fact nobody has confirmed. They are
stated in their current form; if the fact is wrong, the invariant changes rather than being
abandoned.

| Invariant | Depends on | If the fact is wrong |
|---|---|---|
| `INV-8` (phase 1 policy) | `F-04`, `F-05` — whether competing base formulas are chosen by the player or resolved by the rules | The default policy changes; the phase does not |
| `INV-23` (bounds) | `F-16` — whether "once per turn", "once per round" and "once per rest" are three distinct limiters | Resources need three limiter kinds rather than one counter |
| `INV-44` (advantage) | `F-03` — that advantage does not accumulate | If it accumulates, it becomes numeric and moves into the pipeline |

## 10.17 Summary

Forty-five invariants. Forty-two are checkable by a machine; three (§10.15) require judgement.

| Group | Invariants |
|---|---|
| Definitions and instances | 1, 2, 3 |
| Derived state | 4, 5, 6 |
| Determinism and ordering | 7, 8, 35, 44 |
| Identity and origin | 9, 10, 11, 30, 31, 32, 39 |
| Ruleset isolation | 12, 13, 14, 34, 43 |
| Layering | 15, 16, 28 |
| Mutation and history | 17, 18, 19, 27, 37, 38, 42 |
| Resources and bounds | 23, 24 |
| Choices | 20, 21, 22 |
| Storage | 29, 33, 40, 41 |
| Failure behaviour | 25, 26, 36, 45 |

**Revised from `04`:** `INV-6` (replay, not sum), `INV-17` (boundary, not command),
`INV-18` (pure mutators, no events returned), `INV-28` (shared infrastructure, not every
file).

**New:** `INV-29` … `INV-45`.

---

# 11. Conformance checklist

## 11.1 What this is, and how it differs from everything before it

Sections 1–10 are an argument. This section is not.

Every item below is a **question about your code** with a factual answer. Not a position to
agree or disagree with — a thing that is either true of your implementation or is not, and
which you can determine by looking.

That distinction is deliberate and it is the reason this section exists. Agreement is not
useful here. If you read a recommendation and agree with it, nothing has been established:
neither of us knows whether your code does that thing. If you answer *"no — my resolver
returns a bare integer"*, something real has been learned, by both of us, in one sentence.

**So the only wrong way to use this checklist is to agree with it.**

## 11.2 How to answer

| Mark  | Meaning                                                             |
| ----- | ------------------------------------------------------------------- |
| ✅     | Yes. You can name where.                                            |
| ⚠️    | Partly. Some cases, or one layer but not another.                   |
| ❌     | No.                                                                 |
| —     | Not applicable, or not built yet                                    |
| **?** | You are not sure. **This is a legitimate answer and a useful one.** |

For anything not ✅, two lines are worth more than a paragraph:

```
    where    which file or component this lives in
    cost     what changing it would touch
```

The second line is what actually matters, and it is the reason the checklist is ordered the
way it is.

## 11.3 The ordering

Not by section. **By what it costs to be wrong**, most expensive first.

```
   A  REWRITE      wrong → structural rework across many files
   B  MIGRATION    wrong → existing content or saved data must be converted
   C  REFACTOR     wrong → a contained change in known places
   D  ADDITIVE     wrong → something is missing and can be added
```

Group A is where an hour spent now is worth a month later. Group D can wait indefinitely
without penalty. **If time is short, answer A and stop.**

---

## Group A — rewrite class

If any of these is ❌, the cost of correcting it grows with every week of development.

| # | Question | How to check | If **no** |
|---|---|---|---|
| **A1** | Is `Entity` plain data, with the rules living outside it? | Look for a ruleset-specific subclass of your character type | Two independent axes (ruleset × kind) cannot both be expressed by inheritance; serialisation becomes tied to class names — §2.17 |
| **A2** | Does the core operate on a *set* of entities, with nothing assuming a single current one? | Search for a global "current character" | v2 requires surgery in the core and the schema — §1.2 |
| **A3** | Are stats, saves, defences and skills keyed collections rather than fixed named fields? | Look for a structure with six ability fields, or an `ac` field | Every ruleset difference in vocabulary becomes a schema and interface change — `S-4.15` |
| **A4** | Are an activation's results a **map keyed by a ruleset-defined outcome**? | Look for `onHit` / `onMiss` | Every activation in every content file must be rewritten to support PF2e's four degrees — `S-2.15`, the highest-value item on this list |
| **A5** | Is the ruleset a set of **narrow per-axis** strategies, not one wide interface? | Count the methods one ruleset must implement | A system differing on one axis pays for all of them; copies drift — `S-4.4` |
| **A6** | Does a ruleset variant **reference** shared axis implementations rather than copying them? | Compare your 5e-2014 and 5e-2024 arrangement, if both exist | A fix applied to one copy and not the other, with nothing to detect it — `S-4.5` |
| **A7** | Does Core contain **zero** game constants? | `grep` Core for numeric literals; every survivor should be 0, 1 or a structural bound | The single invariant that makes a second ruleset possible — `INV-14` |
| **A8** | Is there any global mutable state — content registry, current ruleset, random source? | Search for singletons and global instances | Two rulesets cannot be live at once; reproducible tests become impossible — `S-4.19` |
| **A9** | Do computed values carry their contributions, produced by the **same code** that computes them? | Is there a separate "explain" path? | Two paths that must agree and will not — `S-7.17` |
| **A10** | Is derived state **never** persisted? | Search the schema for anything recomputable | A second source of truth that silently diverges — `INV-4` |
| **A11** | Are triggers a first-class declarative construct that content can author? | Is "on hit, add sneak attack damage" data or code? | Hundreds of abilities each become a special case — `S-2.17` |
| **A12** | Do features have stable identity, **including features declared inline** inside classes, items and monsters? | Can you reference one from outside its container? | Traces cannot name their source; removing an origin cannot be reliable; homebrew cannot extend official content — `S-2.10` |
| **A13** | Does the interface depend only on answer shapes that do not change when a ruleset is added? | Ask of one screen: what changes to show a PF2e character? | Ruleset knowledge in the presentation layer, in many places at once — `S-3.23` |
| **A14** | Are the layer dependencies **enforced by the build**, not by convention? | Does Core link anything from Infrastructure? | Conventions that are only documented erode — `S-3.24` |
| **A15** | Is there a mechanism for **replacing an entity's characteristics with another form**, keeping identity and a separate hit point pool? | Look for how Wild Shape is handled, if at all | Every shape-changing mechanic becomes a special case, and the Druid class cannot be represented — §2.17a |
| **A16** | Is predicate evaluation **three-valued**, with `unknown` distinct from `false`? | Find a predicate the application cannot evaluate — an ally's position — and see what it returns | Abilities silently never apply, or always apply. Both are wrong and neither is visible — `S-2.44` |

---

## Group B — migration class

If any of these is ❌, correcting it means converting content or saved characters. The cost
depends almost entirely on how much of both exists — which is why `I-09` is the one thing we
most need from you.

| # | Question | How to check | If **no** |
|---|---|---|---|
| **B1** | Do stored references use numeric identity that does **not** depend on load order or on which packs are installed? | Save a character, install another pack, reload | Silent reference corruption: the sword becomes a potion, and nothing reports it — `S-5.3` |
| **B2** | Is a numeric identifier **never** reused after content is removed? | Uninstall, install something else, check | The same failure as B1, arriving later — `S-5.6` |
| **B3** | Are authoring keys permanent — content retired rather than renamed? | Has any key ever changed? | Every reference to the renamed content breaks — `S-9.17` |
| **B4** | Are synthetic keys for inline content derived **deterministically** from position and name, not from a build counter? | Build the same pack twice, compare identities | A rebuild that changed nothing relevant breaks existing characters — `S-5.12` |
| **B5** | Is `Origin` a stored record with its own identity, rather than a descriptive string? | Look at how "remove this level" is implemented | Undoing a level becomes string matching; re-specification becomes untouchable — `S-5.13` |
| **B6** | Is all persistent data normalised, with no column holding a serialised object? | Look for JSON or blob columns | A one-point change rewrites the whole record; row-level synchronisation is unavailable; undo is coarse — §6.1 |
| **B7** | Is any table column named for a game concept? | Read the schema | The schema encodes one ruleset's vocabulary — `S-6.8` |
| **B8** | Are recursive structures (expressions, predicates) stored as **generic node tables with a discriminator**? | Count your expression tables | Either a table per node kind, or a serialised body with its own versioning — `S-6.13` |
| **B9** | Is adding a new effect or expression kind a **discriminator value** rather than a schema migration? | What did the last new effect kind require? | Every new mechanic becomes a migration on every installed database — `S-6.14` |
| **B10** | Does a saved character record the pack and version of everything it draws on? | Look at the save | Content updates change numbers with no way to detect or refuse it — `S-5.15` |

---

## Group C — refactor class

Contained changes in known places. Worth correcting, not urgent.

| # | Question | If **no** |
|---|---|---|
| **C1** | Are contributions sorted into a canonical order before being combined? | Results can differ between platforms, intermittently — `S-7.4` |
| **C2** | Is the phase sequence explicit, with every contribution declaring its phase? | Ordering becomes accidental and unverifiable — `S-7.7`, `S-7.8` |
| **C3** | Do base-setting contributions **compete** rather than accumulate? | Armour class is silently too high — `S-7.9` |
| **C4** | Do losing base setters still appear in the trace, marked superseded? | *"Why isn't it using my armour?"* is unanswerable — `S-7.10` |
| **C5** | Do multipliers declare their **scope** — one contribution or the whole value? | Expertise doubles everything, or resistance halves one component — `S-7.12` |
| **C6** | Does rounding happen once, at the end? | One-point discrepancies that users notice and report — `S-7.14` |
| **C7** | Does a damage value keep dice and modifiers separate until combination? | Critical hits cannot be computed correctly — `S-7.15`, `F-24` |
| **C8** | Is advantage a pair of flags rather than a number? | Wrong whenever two sources apply — `S-7.19`, `F-03` |
| **C9** | Are circular dependencies in content detected and reported? | A crash, a hang, or a silently wrong number — `S-7.23` |
| **C10** | Is the roll source a parameter, with hand-entered values on the **same** path? | Two paths; features work in one and not the other — `S-7.26` |
| **C11** | Do all persistent changes pass through one mutation boundary? | Changes that are not recorded, not undoable, or not propagated — `S-8.2` |
| **C12** | Are core mutators pure `Entity → Entity`, recording and notifying nothing? | Rules become untestable without infrastructure — `S-8.7` |
| **C13** | Does each mutation carry a **descriptor** describing what it is? | Permissions, confirmation and filtering cannot be added later without visiting every call site — `S-8.9` |
| **C14** | Is each mutation a single transaction? | A partially applied change survives a crash — `S-8.5` |
| **C15** | Are timeline entries structured rows rather than formatted sentences? | Cannot translate, filter, total, or re-render — `S-8.16` |
| **C16** | Does undo store before-and-after values rather than inverse operations? | Every mutator needs a correct inverse; each is a place to be subtly wrong — `S-8.18` |
| **C17** | Are undo and the user-visible history separate mechanisms? | Either unbounded memory or a history that deletes itself — `S-1.8` |
| **C18** | Does rest logic contain the name of no specific resource? | A branch per class, forever — `S-2.21` |
| **C19** | Are selections keyed by `(origin, choice)`? | Multiclassing silently overwrites a chosen proficiency — `S-2.25` |
| **C20** | Is advancement a resumable state rather than an atomic operation? | A modal dialogue that cannot be closed, on a phone — `S-2.27` |
| **C21** | Are problems returned as data rather than raised as exceptions? | *"A character always opens"* becomes unimplementable — `S-2.33` |
| **C22** | Is the expression grammar closed — no branching, binding, loops or user functions? | A scripting VM acquired by accident, with everything that implies — `S-2.30` |
| **C23** | Is proficiency a ruleset-defined value type rather than a boolean or bare integer? | Only one system's proficiency model can ever be supported — `S-4.7` |
| **C24** | Can an activation carry **options chosen at the moment of use**, with their own costs and effects? | Look at Great Weapon Master, Divine Smite, or paying from one of two slot pools | Three separate mechanics each become code — `S-2.47` |
| **C25** | Does the evaluation context include **the triggering signal's data**, not only entity state? | Look at the concentration save DC | Any effect whose value depends on what just happened cannot be expressed — `S-2.55` |

---

## Group D — additive class

Missing rather than wrong. Add when convenient.

| # | Question | Reference |
|---|---|---|
| **D1** | Is the number of queries during content load constant, independent of content volume? | `S-6.16` |
| **D2** | Is descriptive text stored separately from mechanical structure? | `S-6.12` |
| **D3** | Are packs read-only files, rather than imported into the user database? | `S-6.4` |
| **D4** | Does the editor write into the same schema, with content usable immediately and no build step? | `S-9.21`, `S-9.22` |
| **D5** | Are cross-pack dependencies declared, and does a pack with an unmet dependency still install? | `S-9.9`, `S-9.11` |
| **D6** | Is the build deterministic, and does a pack carry a checksum? | `S-9.12`, `S-9.13` |
| **D7** | Does a pack declare its licence and attribution, and does the application display them? | `S-9.7` |
| **D8** | Are there structural limits — expression depth, node count — enforced at build and install? | `S-9.25` |
| **D9** | Does a character open when a pack it uses is missing? | `INV-25` |
| **D10** | Does a golden-value test exist — one character, every derived value hand-computed? | `S-7.28` |
| **D11** | Does a permutation test exist — the same inputs with contributions shuffled? | `S-7.6` |
| **D12** | Can two independent engines with different rulesets run in one process? | `S-4.18` |
| **D13** | Does synchronisation transmit state rather than intentions? | `S-8.11` |
| **D14** | Does each entity have exactly one owner, with non-owner changes rejected? | `S-8.21` |
| **D15** | Are identifiers translated at the session boundary, so no message depends on the sender's installation? | `S-8.24` |
| **D16** | Are roll modifier kinds — advantage, reroll, minimum, replacement — a ruleset-declared set applied in a declared order? | `S-4.27`, `S-7.32` |

---

## 11.4 If you answer only seven

Ordered by cost of being wrong multiplied by how likely we think it is that the answer is
not ✅:

| | Question | Why this one |
|---|---|---|
| **1** | **A4** — outcomes as a ruleset-keyed map | Costs nothing today; costs every content file later. The single highest-value item |
| **2** | **A7** — no game constants in Core | The one invariant that decides whether a second ruleset is possible, and the easiest to check |
| **3** | **B1** — identifiers independent of load order | Protects against silent data corruption, the worst failure in the specification |
| **4** | **A12** — features have stable identity, inline ones included | Blocks explanation, removal and homebrew simultaneously if absent |
| **5** | **A9** — the trace produced by the computing code | Retrofitting explainability means touching every calculation |
| **6** | **A1** — entity is data | The hardest to reverse of all of them |
| **7** | **C3** — competing base setters | Produces a wrong number that looks plausible, today, in 5e |

## 11.5 What we still need from you

The specification cannot be finished from this side. Three things, in order of how much they
block:

| | What | Why it blocks |
|---|---|---|
| **1** | **`I-09`** — how much content is authored so far, and of what kinds | Decides whether `A4` is an afternoon or a migration project, and therefore the order of everything else |
| **2** | **`F-01` … `F-45`** — the domain facts in `03`, plus `F-33 … F-43` from §4 and `F-44`, `F-45` from §7 | `F-04`/`F-05` decide the default policy in phase 1 — the one place where a wrong default puts a wrong number on the screen today. `F-16` decides the shape of resource limiters. `F-36`/`F-37` carry the axis decomposition in §4 |
| **3** | **`F-28`** — what proportion of content resists modelling | Decides §1.7, which is a product decision only you can make |

And one thing that is not a question but a task worth a day:

> **The four-system audit (§4.13).** Ten axes × four rule systems, forty cells, on paper.
> It validates `NFR-6` before a second ruleset exists. After one exists, it is no longer a
> check — it is a repair.

## 11.6 What a "no" means

Not a failure. There are three quite different reasons for a ❌ and they lead to different
places:

| Reason | Response |
|---|---|
| It has not been built yet | Nothing to do. Note it and move on |
| It was built differently, and you have a reason | **Tell us the reason.** This is the most valuable outcome available: it means the specification is wrong, or is missing a constraint you know about |
| It was built differently, without a reason | Now it is a decision instead of an accident. Fix it if the group says it is worth fixing |

The second row is the one to take seriously. This specification was written without seeing
your code, deliberately (§0.1), and that method has a known weakness: it cannot account for
constraints that only become visible while building. **If a recommendation here is wrong,
the argument that shows it is wrong is worth more to this project than the recommendation
was.**

We have been wrong twice already in this process and said so both times — on 4th-edition
resolution, and on storing content as documents (`R-27`, which §6.1 withdraws in full). Both
corrections improved the design. A third would too.

## 11.7 Where each item is argued

| Group | Sections |
|---|---|
| A1 – A2 | §1.2, §2.17 |
| A3, A5 – A7 | §4 |
| A4 | §2.9, §4.6 |
| A8 | §4.10 |
| A9 – A10 | §2.4, §2.5, §7.7 |
| A11 – A12 | §2.10, §2.6 |
| A13 – A14 | §3 |
| B1 – B5 | §5 |
| B6 – B10 | §6 |
| C1 – C10 | §7 |
| C11 – C17 | §8 |
| C18 – C23 | §2, §4.6 |
| D1 – D3 | §6 |
| D4 – D8 | §9 |
| D9 – D15 | §8, §10.14 |

---

# End of specification

Eleven sections. 264 numbered statements, 52 invariants, and 67 questions.

**Draft 2.** Nine changes from Draft 1, listed in §0.4 — all of them found by testing this
document against fifteen real mechanics, none by looking at your code.

**The eleven sections are the argument. This last one is the only part that asks you
anything** — and the answers to it are what turn a document into information about a real
system.
