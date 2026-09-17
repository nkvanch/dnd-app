# 08 — What changed since you last read this

**Read this instead of re-reading anything. Ten minutes.**

You have already read `01`–`06` and Draft 1 of the specification. This page covers
everything that has changed since, and it is written so that **you do not need to open the
specification again unless you want the argument behind a change.**

---

## The short version

| | |
|---|---|
| **Nothing you have already read has been contradicted.** | Every conclusion in Draft 1 still stands |
| **Nine things were added**, because Draft 1 failed a test | §1 below |
| **Eighteen new facts need checking** | §4 below |
| **Five new questions** in the conformance checklist | §3 below — reproduced in full, so you need not open `07` |

If you already started answering the checklist in `07` §11: **keep every answer.** Nothing
previously asked has changed meaning. Five questions are added.

---

## 1. Why there is a Draft 2

After sending Draft 1 we tested our own model on paper against fifteen real 5e mechanics —
Unarmoured Defense on a Barbarian/Monk, Rage, Sneak Attack, Divine Smite, concentration,
stacked armour-class sources, Great Weapon Master, Extra Attack across two classes, Wild
Shape, Counterspell, Warlock pact magic beside Wizard slots, the multiclass slot table,
Elven Accuracy, Exhaustion, and the level-4 ability-increase-or-feat choice.

**Six fitted. Four fitted with tension. Five did not fit.**

None of this came from looking at your code. It came from testing the document, which is
what a specification is for.

### The nine changes

| | What was missing | Found by | Where the argument is |
|---|---|---|---|
| **G1** | Any mechanism for **replacing an entity's characteristics with another form** | Wild Shape | `07` §2.17a |
| **G2** | Predicates being **three-valued** — the application often cannot know | Sneak Attack, Counterspell | `07` §2.16a |
| **G3** | **Decisions made at the moment of use**, with their own cost | Great Weapon Master, Divine Smite, Warlock slots | `07` §2.16b |
| **G4** | The evaluation context including **the triggering event's data** | Concentration | `07` §2.14a |
| **G5** | Saying plainly that **v1 has no clock** | Rage, Sneak Attack | `07` §1.2 |
| **G6** | **Roll modifiers other than advantage** | Elven Accuracy, Reliable Talent | `07` §4.9 |
| **G7** | Where a **trigger signal comes from** | Counterspell | `07` §2.10a |
| **G8** | An explicit list of **what an expression may reference** | Unarmoured Defense | `07` §2.14a |
| **G9** | Effect operations that are **not numeric** | Exhaustion | `07` §2.8a |

`G2` and `G3` each appeared in three unrelated mechanics. That is what makes them structural
rather than special cases.

---

## 2. The two new types — enough detail that you need not open `07`

The type catalogue went from 22 to 24.

### `Form` — from Wild Shape

An entity may have alternate forms. Exactly one is active. **Entity identity never changes.**

```
    entity  ────────────────────────────►  always the same identity
      ├── form (base)      stats, features, own hit points
      └── form (dire wolf) stats, features, own hit points   ◄── active
                                  ▲
                    a carry-over declaration says, per characteristic,
                    whether it comes from the form or from the base
```

- Each form has **its own hit point pool**. Reverting restores the underlying one — it was
  never overwritten.
- **Which** characteristics transfer is *content*, not code. That is why this is a new type
  but **not** a new ruleset axis: the procedure is the same everywhere, only the table differs.
- In storage: rows on the entity, not a separate entity.

This was a genuine omission. `F-20` was in the fact list from the first day and no type was
ever built for it.

### `Option` — from Great Weapon Master, Divine Smite, Warlock slots

A choice attached to an activation, selected **at the moment of use**, carrying its own cost
and its own effects.

| Mechanic | The decision | When |
|---|---|---|
| Great Weapon Master | −5 to hit for +10 damage? | before the roll |
| Divine Smite | spend a slot, and which level? | after the hit is known |
| Warlock beside Wizard | which slot pool pays? | at casting |

None of these is an `Effect` (they are optional), an `Activation` (they modify one), or a
`Trigger` (two of the three are decided beforehand).

Alongside it, triggers now declare whether they **fire automatically or are offered** to the
user. Divine Smite is a trigger whose response is a question.

---

## 3. The five new questions

Reproduced in full so that you do not need to reopen `07` §11.

The same rule applies as before: **these are questions about your code, not positions to
agree with.** ✅ / ⚠️ / ❌ / **?** — and "?" is a useful answer.

### Group A — rewrite class

| # | Question | How to check | If **no** |
|---|---|---|---|
| **A15** | Is there a mechanism for **replacing an entity's characteristics with another form**, keeping identity and a separate hit point pool? | Look at how Wild Shape is handled, if at all | Every shape-changing mechanic becomes a special case, and the Druid class cannot be represented |
| **A16** | Is predicate evaluation **three-valued**, with `unknown` distinct from `false`? | Find a predicate the application cannot evaluate — an ally's position — and see what it returns | Abilities silently never apply, or always apply. Both are wrong and neither is visible |

### Group C — refactor class

| # | Question | If **no** |
|---|---|---|
| **C24** | Can an activation carry **options chosen at the moment of use**, with their own costs and effects? | Three separate mechanics each become code |
| **C25** | Does the evaluation context include **the triggering signal's data**, not only entity state? | Any effect whose value depends on what just happened cannot be expressed |

### Group D — additive

| # | Question |
|---|---|
| **D16** | Are roll modifier kinds — advantage, reroll, minimum, replacement — a ruleset-declared set applied in a declared order? |

---

## 4. Eighteen new facts to check

All are in `03-questions-for-author.md`, in two new sections at the end. Same instruction as
before: **yes or no, and one line if no.**

| Where | What | Count |
|---|---|---|
| `03` §5 | `F-33 … F-45` — mostly about rule systems other than 5e. These are what justify splitting the ruleset into ten narrow axes | 13 |
| `03` §7 | `F-46 … F-50` — from the fifteen-mechanic test | 5 |

### The four that carry the most weight

Everything else can wait. These four each decide whether a piece of structure should exist
at all:

| # | The claim | If it is wrong |
|---|---|---|
| **F-37** | In 4e the attacker always rolls; defenders never roll saves against attacks | Attack and save become **one** axis instead of two |
| **F-36** | AD&D uses THAC0 against descending AC | Proficiency need not express anything but "a number to add" — a simpler model |
| **F-48** | A Wild Shape form has its **own** hit point pool | `Form` may not need its own pool, and the mechanism gets considerably simpler |
| **F-46** | Divine Smite is decided **after** the hit is known | Triggers do not need an "offered" mode |

**A "no" on any of these is worth more to us than a "yes".** Each one caused something to be
*added* to the model. A wrong fact means a mechanism exists for a rule that does not — and
removing it now is cheaper than at any later moment.

---

## 5. What has **not** changed

So you can trust your existing reading:

| | |
|---|---|
| All eleven section numbers and their subjects | unchanged |
| Every statement `S-1.1` … `S-9.25` from Draft 1 | unchanged in meaning |
| The layer model, the identity scheme, the database schema, the pipeline phases | unchanged |
| Your `R-01` … `R-24` | all still accepted |
| The conclusions on synchronisation and on not reifying mutations | unchanged — `07` §8 gives the argument on the merits rather than on your code already existing |

**One thing to be aware of**, if you have not already seen it in `07` §0.3: you accepted
`R-27` in `06` — content stored as an envelope plus a serialised body. **We have since
withdrawn that**, and `07` §6.1 argues why: for characters it means rewriting the whole
record for one point of damage, row-level synchronisation becomes difficult, and undo gets
coarse. We are flagging it rather than letting two documents you have accepted contradict
each other.

---

## 6. What we need from you, in order

| | | Why it is first |
|---|---|---|
| **1** | **How much content have you authored so far** — spells, classes, monsters, roughly | It decides whether the outcome-map change (`A4`) is an afternoon or a migration project, and therefore the order of everything else |
| **2** | **The four facts above** — `F-37`, `F-36`, `F-48`, `F-46` | Each decides whether a piece of structure should exist |
| **3** | **Group A of the checklist** — 16 questions | The ones where being wrong costs the most |
| **4** | The remaining facts, and groups B, C, D | Whenever convenient |

And one task worth a day, which needs nothing from us:

> **The four-system audit** (`07` §4.13). Ten axes × four rule systems, forty cells, on
> paper. It tests whether a second rule system can actually be added, **before** one exists.
> Afterwards it is no longer a test — it is a repair.

---

## Reading order, if you want to open the specification

| You want | Open |
|---|---|
| Just the changes | `07` §0.4 — one page |
| The two new types | `07` §2.16a, §2.16b, §2.17a |
| Why forms are not a new ruleset axis | `07` §4.7 |
| What the new tables look like | `07` §6.4, §6.5 |
| How an unknown condition is handled in practice | `07` §7.3 |
| The new content examples | `07` §9.9 |
| Everything, as one list | `07` §11 |
