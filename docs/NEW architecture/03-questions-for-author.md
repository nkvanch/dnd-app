# 03 — Questions for the Author

This document needs your answers. Nothing else in the review can be finalised without them.

It has two parts:

- **Section 2** — 32 factual claims about the game systems. These underpin the structural
  conclusions in `01` and `02`. They were written by someone who cannot verify their own
  recall, and **you are the only person in this loop who can check them.**
- **Section 3** — decisions that are genuinely yours, because they depend on judgement or on
  things nobody else knows.

**Section 4** maps each fact to the design conclusion that rests on it. If a fact turns out
to be wrong, that table tells you exactly what changes — so an error stays contained instead
of quietly propagating.

---

## 1. How to answer

For each fact: **yes** or **no**. If **no**, one line on how it actually works.

`⚑` marks lower confidence — checking these matters more than the others.

Do not worry about the ones that seem obvious. The obvious ones are load-bearing precisely
because nobody thinks to state them.

---

## 2. Domain facts

### 2.1 Computation

| # | Claim | ✓ |
|---|---|---|
| **F-01** | Ability modifier is `floor((score − 10) / 2)` — one formula for all six abilities, for every creature | |
| **F-02** | Proficiency bonus derives from **total character level**, not class level — including when multiclassed | |
| **F-03** | Advantage and disadvantage **do not accumulate**; having one of each cancels out entirely, regardless of how many sources | |
| **F-04** | A character has **one** AC at a time; multiple AC formulas **compete** rather than adding together | |
| **F-05** | The base AC formula comes from armour worn, *or* a feature (Unarmored Defense), *or* a spell (Mage Armor). A shield adds on top of whichever base applies | |
| **F-06** | Skill proficiency is binary, except Expertise, which **doubles** the proficiency bonus | |
| **F-07** | Maximum HP is the sum over levels of (hit die + CON modifier). **Changing CON retroactively changes maximum HP** | |
| **F-12** | Resistance **halves** damage (rounded down), does not stack with itself; immunity overrides it; vulnerability doubles. Order: all additions first, then resistance | |
| **F-24** | A critical hit doubles **only the dice**, not the modifiers | |
| **F-26** | Spell save DC is `8 + proficiency bonus + spellcasting ability modifier`, and when multiclassed it **depends on which class** the spell comes from | |

### 2.2 State and time

| # | Claim | ✓ |
|---|---|---|
| **F-10** | Only **one** concentration spell at a time; taking damage forces a CON save (DC 10, or half the damage taken, whichever is higher); casting another concentration spell ends the first | |
| **F-11** ⚑ | Conditions are binary (present or absent), **except Exhaustion**, which has levels | |
| **F-16** | "once per turn", "once per round" and "once per rest" are **three genuinely different** limiters | |
| **F-17** | There are two kinds of rest, and each resource declares for itself which kind restores it | |
| **F-20** | Some features **temporarily replace the entire statblock** (Wild Shape, Polymorph) | |

### 2.3 Character building and choices

| # | Claim | ✓ |
|---|---|---|
| **F-08** | Multiclass spell slots come from a **single combined table**, not the sum of each class's slots. Warlock pact slots are **separate** and do not merge into it | |
| **F-09** | Extra Attack does **not** stack across classes | |
| **F-15** | Some abilities trigger **on an event** rather than being used on your turn (reactions, on-hit riders) | |
| **F-18** | Some items require attunement, with a limit of **3** attuned at once | |
| **F-19** | Choices made on level-up are permanent; some choices **unlock further choices** (subclass) | |
| **F-25** ⚑ | Some effects **set** a value or impose a minimum rather than adding to it ("your speed becomes 40") | |

### 2.4 Shape of content

| # | Claim | ✓ |
|---|---|---|
| **F-13** | In 5e a spell's outcome has **two branches** (hit/miss, or saved/failed); "half damage on a successful save" is a common pattern | |
| **F-14** | Casting at a higher level (upcasting) changes the effect, and is normally described as a **delta** from the base | |
| **F-21** | A spell has **casting metadata** (level, school, casting time, range, components, duration) and, separately, **what it does** | |
| **F-22** | Monsters use the same six abilities and the same d20 test as characters, but are **not built from class levels** | |
| **F-23** | Damage is dice + modifier + **type**; one attack can deal more than one damage type | |

### 2.5 Pathfinder 2e — structural

These matter only if PF2e stays in scope (see Q1).

| # | Claim | ✓ |
|---|---|---|
| **F-29** | Practically every check has **four degrees**: critical success / success / failure / critical failure | |
| **F-30** | Proficiency is a **rank** (untrained … legendary); the bonus is level + rank bonus; untrained is 0 | |
| **F-31** | **3 actions** per turn; some activities have variable cost (1/2/3) with different effects at each | |
| **F-32** | Multiclassing happens through an **archetype dedication feat**, not by taking levels in another class | |

### 2.6 Volume

| # | Claim | ✓ |
|---|---|---|
| **F-27** ⚑ | SRD 5.1 contains roughly: 320 spells, 325 monsters, 12 classes, 18 skills, 15 conditions, 13 damage types. **Backgrounds and feats are almost absent from the SRD** (about one each) | |
| **F-28** ⚑ | **Long tail:** a meaningful minority of spells and features use unique mechanics that no common pattern will capture. **Roughly what fraction?** — see Q2 | |

---

## 3. Open decisions

### Q1 — How many rule systems must v1 accommodate?

The stated ambition is "every version of D&D plus Pathfinder" — roughly 45 years and eight
systems. `01`, problem P1 explains why the far ends of that range (AD&D, 4e) differ
structurally, not just numerically.

| Option | What it means |
|---|---|
| **A (recommended)** | Target family: **5e 2014 + 5e 2024 + PF2e.** Different enough that the abstraction is honest; similar enough to be achievable. Only `Dnd5eRuleset` is actually written in v1. 4e and AD&D remain possible later at the module level, but are not allowed to complicate today's model. |
| **B** | 5e only (2014 + 2024). Fastest to something usable. `TRulesetModule` still exists, but the content model is not stretched to fit PF2e. |
| **C** | Every version, from AD&D to PF2e. Honest to the original ambition, but the model has to carry descending AC, THAC0, At-Will/Encounter/Daily powers and defender-does-not-roll from day one — and v1 gets much further away. |

**Your call.** If it helps: option A costs very little more than B today, because it is mostly
about using maps instead of fixed fields.

---

### Q2 — What coverage target for the long tail? (`F-28`)

Some content will not fit any general model — "relive the last 8 hours", "turn into another
creature", "wish for anything". **No rules engine covers 100%.** Foundry VTT drops to
JavaScript for the remainder.

This is a product decision, not a technical one, and it directly determines how complicated
`Effect` has to be:

| Option | Result |
|---|---|
| **(a) Description only** | Unusual content shows its text; the app tracks nothing. Simplest model, honest, but the app does less. |
| **(b) Manual toggles** | The player switches effects on and off by hand. Middle ground; probably the pragmatic default. |
| **(c) Per-case handling** | Specific exceptions coded individually. Most capable, unbounded work, and it erodes "the engine knows nothing about specific content". |

Related: **roughly what percentage of 5e content is long tail?** Your estimate as a player is
worth more here than any analysis.

---

### Q3 — Technology stack

See `02`, section 9 for the full comparison. Open sub-questions:

- Is C++Builder a firm preference, or is the stack genuinely open?
- **Is there a Mac available?** iOS builds require one on every stack. If not, v1 is
  Android + Windows, and that is a perfectly reasonable v1.
- If RAD Studio: does the Community Edition cover this use, under its current terms?

**This decision can wait** until after stages 1-3 of the plan in `02` section 8.

---

### Q4 — Manual dice entry (`04`, INV-27)

Proposed as an invariant: **every roll the app makes can be replaced by a hand-entered
value**, because many players roll physical dice.

If true, it affects every screen and must be designed in from the start, not added later.
Do you agree it is a v1 requirement?

---

### Q5 — Homebrew model

`Homebrew.md` and `Homebrew editor architecture.md` contradict each other (`01`, P10).
Recommendation: homebrew is **identical content with different provenance**, not a separate
engine path. Do you agree, or was the "special override system" meant to solve something
specific that this would lose?

---

### Q6 — The `OverrideLayer` on `Entity`

Undefined in the notes. What was it for? It needs a narrow definition, or it becomes the
place where everything difficult ends up hiding.

---

## 4. Fact → consequence

**What each fact actually decides.** If a fact is wrong, the corresponding row changes.

| Fact | Structural consequence |
|---|---|
| `F-03` | Advantage **is not a number** and cannot be summed. Needs a `(hasAdvantage, hasDisadvantage)` pair, resolved at the end |
| `F-04` `F-05` | `Effect` needs two distinct operations: **`setBase`** (competing) and **`add`** (accumulating). The competing case needs an explicit winner rule |
| `F-06` `F-30` | Proficiency **is not a `Boolean`**. It must be a ruleset-interpreted value |
| `F-07` | Maximum HP is **computed, not stored**. Confirms invariant INV-4 |
| `F-10` | Requires concentration state on the entity, plus an `OnDamageTaken` trigger — which is problem P2 |
| `F-11` | `ConditionInstance` needs `Stacks: Integer`, not a boolean |
| `F-12` | The derived pipeline needs **ordered phases**: additions → multipliers → rounding |
| `F-13` `F-29` | `Activation.Outcomes` must be **`Map<OutcomeId, Effect[]>`**, not `onHit`/`onMiss` |
| `F-15` | Requires **`TriggeredActivation`** — entirely absent from the notes (P2) |
| `F-16` | `Resource` needs **three** different limiter kinds |
| `F-19` | A `Choice` can produce further `Choice`s → **recursive validation** |
| `F-20` | Requires a **statblock replacement** mechanism — a layer on the entity, not an effect |
| `F-24` | `Damage` must keep **dice and modifiers separate** |
| `F-26` | Spellcasting DC is bound to the **class**, not the entity → stored at feature/resource level |
| `F-28` | **Product decision**: coverage target plus the escape hatch (Q2) |
| `F-32` | `ProgressionState.classLevels` is **insufficient** → progression must be a list of grants and choices |
