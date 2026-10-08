# 01 — Design Review

---

## 1. Summary

The notes describe a mobile D&D application built around a ruleset-agnostic core: clean
layering (UI → Application → Core, with Infrastructure implementing interfaces), content
shipped as SQLite packs, a definition/instance split, and effects/grants/choices/predicates
as the mechanical primitives.

**Assessment:** the architectural instincts are unusually sound. Several decisions here are
ones that professional codebases in this exact domain get wrong, and they were made
correctly and early.

The weaknesses are not in the skeleton. They are concentrated in **five specific places**,
all of which share a property: they are named in the notes but never designed. Those five
are also, not coincidentally, the five places where rules engines usually die.

One further finding sits above all of them, because it is a load-bearing assumption rather
than a missing piece — that is P1.

---

## 2. What is strong

This section is not politeness. These are the decisions that make the rest of the project
possible, and it is worth knowing which parts of the design to protect when things get
refactored later.

### 2.1 Definition vs Instance (`Definitions vs Instance.md`)

> *"This prevents a major future problem: mutating global definitions to represent state."*

This is the single most common fatal mistake in character-sheet applications, and the notes
identify and solve it on the first pass. Everything downstream — pack updates, homebrew,
undo, sync, multiple identical goblins in one fight — depends on this being right.

### 2.2 The engine knows nothing about specific content

> *"No hard coring anywhere in engine for example: `FeatType::HeavyArmorMaster`"*

Correct, and non-negotiable if homebrew is a goal. The alternative — a `switch` over feature
names — works fine for 20 features and collapses at 200.

### 2.3 Effect as a tagged union, not `target + numericValue` (`Effects.md`)

```
Effect =
    NumericEffect | ProficiencyEffect | AdvantageEffect
  | ResistanceEffect | CapabilityEffect | RollModifierEffect | RuleOverrideEffect
```

Most designs start with a single numeric shape and discover a year later that "advantage on
Dexterity saves" and "critical on 19-20" do not fit in it. The notes reach the right answer
before writing the code.

### 2.4 Explainability originates in Core (`Explainability.md`)

> *"This should originate in Core, not be reconstructed in UI."*

`ResolvedValue { value, contributions[] }` is the highest-value decision in the vault.

Two reasons it matters more than it looks. First, it is essentially impossible to retrofit —
by the time the UI has been built against plain integers, adding traces means touching
everything. Second, **it will be the best debugging tool in the project.** When AC comes out
wrong, a contribution list tells you which effect misbehaved in one glance.

It is also a genuine product differentiator. Most character-sheet apps show `AC 18`. Showing
*why* it is 18 is rare.

### 2.5 One unified `Predicate` (`Prerequisites and predicates.md`)

Feat prerequisites, multiclass requirements, "only while raging", "only if attuned", "while
wearing no armor" — one mechanism instead of four. This is exactly the right consolidation.

### 2.6 Recharge as event matching (`Recharge.md`)

> *"Then Rest doesn't know what specific features recharge. It asks: which ResourceStates
> have recharge matching this event?"*

Inverting the dependency here is correct, and it is what makes homebrew resources work for
free.

### 2.7 The "DO NOT GENERALIZE" list (`Dos and don'ts.md`)

Refusing an arbitrary scripting language, an expression VM, plugin-loaded native code and
"everything is a node" is a mark of maturity. Most projects at this stage over-generalise;
these notes explicitly guard against it. (See P8 for one tension inside this constraint.)

### 2.8 Typed IDs (`Content should use typed IDs.md`)

Cheap, and eliminates an entire category of bug. `equipItem(character, spellId)` should not
compile.

---

## 3. The five problems that matter most

For each: **what it is**, **why it matters**, **what happens if it is not fixed**, and a
**concrete example**.

---

### P1 — "Same structure, different numbers" is not true

**The assumption.** The project rests on the idea that D&D (all editions) and Pathfinder
share one data structure, and differ only in quantities.

**Where it is right.** At the level of the object model — Entity, Feature, Effect, Grant,
Choice, Predicate, Resource, Condition — it holds. That model really does generalise, and
that is why the design works.

**Where it breaks.** At the *resolution* layer (how a roll is made and read) and the
*progression* layer (how a character is built), the differences are structural — different
types, different field counts, sometimes the concept does not exist at all.

| Concern | D&D 5e | Pathfinder 2e | D&D 4e | AD&D 2e |
|---|---|---|---|---|
| Skill proficiency | `bool` (+ expertise) | `enum` of 5 ranks | `bool` + half level | roll *under* an ability score |
| Skill (3.5 / PF1) | — | — | — | `int` — points spent |
| Saving throws | 6, one per ability | 3, with ranks | **defender does not roll** | 5 threat categories |
| Roll outcomes | hit / miss | **four degrees** | hit / miss | hit / miss |
| Spell resource | slots 1-9 | slots + rank + focus | **At-Will / Encounter / Daily** | memorisation |
| Multiclass | class levels stack | **archetype feats** | hybrid / feats | level limits |
| Armour Class | ascending | ascending | 4 separate defences | **descending + THAC0** |

Two of these are decisive:

- **PF2e's four degrees of success** (`critical success / success / failure / critical
  failure`). Nearly every spell, skill action and ability spells out all four branches.
  `AbilityDefinition.onHit` cannot express this. Every content record changes shape.
- **In 4e the defender does not roll.** The attacker rolls against Fortitude/Reflex/Will.
  The direction of the resolution pipeline reverses.

**If not fixed.** You write the whole engine against 5e's shape, and adding the second system
means rewriting the content model — which means rewriting every content pack, and every UI
screen that reads it. The multi-system goal quietly becomes unreachable, and the cost is only
discovered after 5e is finished.

**The fix is not "make everything data".** That road leads to the scripting VM that
`Dos and don'ts.md` correctly rejects. The fix is in `02-recommended-approach.md`, section 1.
It is small, and most of it costs nothing today:

```
// locks you into 5e
AbilityDefinition { onHit: [Effect], onMiss: [Effect] }

// shape is general, meanings belong to the ruleset
ActivationDefinition { outcomes: Map<OutcomeId, [Effect]> }
//   5e:   { "hit": [...], "miss": [] }
//   PF2e: { "critSuccess": [...], "success": [...], "failure": [], "critFailure": [...] }
```

---

### P2 — There is no reactive / trigger layer

**What it is.** `Events.md` introduces domain events for logging and explainability. But
nothing in the vault lets *content react to an event*.

**Why it matters.** A large share of D&D content is reactive, not active:

| Feature | Trigger |
|---|---|
| Sneak Attack | on hit, once per turn, if conditions hold |
| Divine Smite | on hit, spend a spell slot after the roll |
| Shield (spell) | when you are hit, as a reaction |
| Opportunity Attack | when a creature leaves your reach |
| Concentration | when you take damage |
| "at the start of your turn" | turn boundary |

None of these can be expressed as a passive `Effect`, and none of them is something the
player "uses on their turn" in the sense `AbilityDefinition` assumes.

**If not fixed.** Every one of these ends up hardcoded as a special case in the engine —
exactly the thing `Feats.md` rightly forbids. Or they get dropped, and the app cannot
represent Rogues, Paladins, or reactions.

**Proposed shape.** Reuse the domain event bus that already exists for logging:

```
TriggeredActivation {
    when:      EventFilter     // OnHit, OnDamageTaken, OnTurnStart, OnLeaveReach...
    condition: Predicate       // Predicate already exists - reuse it
    cost:      ActionCost      // Reaction | none | free
    resourceCost
    outcomes:  Map<OutcomeId, [Effect]>
}
```

Adding this now is cheap: it reuses `Predicate`, `ActionCost` and the event types already
designed. Adding it later means revisiting `Feature`, `Activation`, and every piece of
content already authored.

**Partial alternative.** Some of the long tail can be handled by *manually toggled features*
— the player switches an effect on. Realistically both are needed: triggers for the common
cases, manual toggles as the escape hatch.

---

### P3 — `StackingPolicy` is named but never designed

**What it is.** `StackingPolicy` appears once, in `ConditionDefinition`. `resolveEffects()`
and "stacking" appear in the module lists. There is no design behind either.

**Why it matters.** This is the hardest single part of any rules engine. A sample of what it
has to decide:

- Two sources both set base AC — armour, Unarmored Defense, Mage Armor. **Which one wins?**
  They do not add. (`F-04`, `F-05`)
- Advantage does not accumulate; one disadvantage cancels any amount of advantage. (`F-03`)
- Resistance halves damage and does not stack with itself; immunity beats it; vulnerability
  doubles. Rounding happens at a specific point in the order. (`F-12`)
- PF2e adds *typed* bonuses (status / circumstance / item) where only the highest of each
  type applies.

**If not fixed.** Numbers come out wrong in ways that are extremely hard to diagnose, because
the error depends on which effects happen to be present. Worse, if collection order is not
deterministic, **the same character produces different AC on different runs.**

**Proposed shape.**

1. Put a `BonusTypeModel` in the ruleset (list of bonus types, and the combination rule per
   type — 5e mostly "everything stacks except same-named"; PF2e "highest per type").
2. Fix a deterministic pipeline:

```
base
  -> set_base candidates (competing - resolved by an explicit rule)
  -> typed bonuses
  -> untyped bonuses
  -> multipliers (resistance / vulnerability)
  -> clamps, minimums, rounding
```

3. Guarantee order independence: sort collected effects by a stable key. This is directly
   testable — shuffle the effect list, assert identical output (see `04`, INV-7).

---

### P4 — Duration, timing and concentration are absent

**What it is.** `DurationModel` and `DurationState` are mentioned once in `Conditions.md` and
never elaborated. Concentration does not appear anywhere in the vault.

**Why it matters.** Timing in 5e is fiddly and pervasive:

- `"until the end of your next turn"` versus `"1 minute"` versus `"1 hour"` — round-based and
  world-clock time coexist and interact.
- **Concentration** (`F-10`): one concentration spell at a time; taking damage forces a
  saving throw; casting another concentration spell ends the first. This is a mechanic that
  touches combat, damage, spells and the character sheet at once.
- What happens to an effect when its source dies, falls unconscious, or moves out of range.

**If not fixed.** Conditions and spells never expire correctly, which means the character
sheet drifts out of sync with the actual game state — and the app becomes something players
stop trusting mid-session. Concentration in particular is checked constantly in real play.

**Proposed shape.** An explicit time model with named expiry points (start/end of turn,
start/end of round, elapsed time), an owner reference on every timed instance, and
concentration as a single named slot on the entity plus a trigger on `OnDamageTaken` (which
is P2 again — these two problems are connected).

---

### P5 — Terminology collides with the game's own vocabulary

**What it is.** Several words carry two meanings, and in the most important case the vault
uses them **inverted relative to the rulebook**.

| Word | In the rulebook | In the vault |
|---|---|---|
| **Ability** | STR / DEX / CON / INT / WIS / CHA | "something you can do" (`AbilityDefinition`) |
| **Stat** | not used | STR / DEX / CON... (`StatId`) |

**Why it matters.** This is not a style preference. Anyone reading the rules and the code
side by side — which is the entire activity of building this app — will mix them up, and the
confusion gets written into the code and stays there.

Others, less severe but worth settling once:

| Word | Meaning 1 | Meaning 2 | Suggested |
|---|---|---|---|
| Modifier | `(score - 10) / 2` | any bonus to a roll | `StatModifier` / `Bonus` |
| Level | character level | class level | `CharacterLevel` / `ClassLevel` / `SpellRank` |
| Condition | Poisoned, Prone | a logical condition | `Condition` (game only); logic is `Predicate` |
| Save | saving throw | writing to disk | `SavingThrow` / `Persist` |
| Class | Fighter, Wizard | a programming class | `CharacterClass` / `ClassDefinition` |
| Action | action-economy unit | any deed | `ActionCost` / `TurnResource` |
| Effect | passive modification | "what a spell does" | `Effect` is passive only; results are `Outcome` |
| Source | the book (PHB, SRD) | where a bonus came from | `SourceBook` / `Origin` |

**Recommendation (already agreed):** `AbilityDefinition` → **`ActivationDefinition`**.
`Stat` stays as it is. Full glossary in `04-reference.md`.

One more worth stating explicitly, because it is used loosely in the notes:
**`Feature` is not `Feat`.** A Feature is a bundle of mechanical consequences (Rage,
Darkvision). A Feat is a content type that *grants* Features.

---

## 4. Further problems

### P6 — The Choices lifecycle is only half designed

`ChoiceDefinition` exists. The hard parts do not:

- Choices that unlock further choices — picking a subclass opens its own progression with its
  own choices (`F-19`).
- **Invalidation.** You lose the item that granted a proficiency that a feat required. What
  happens to the feat, and to everything the feat granted?
- Multiclass identity: the same `choiceId` can legitimately appear twice, from two different
  class levels. A bare `choiceId` is not a unique key.
- Respec and retroactive re-choosing.

**Recommendation.** Key every selection by the full path `(origin, choiceId)`. Add a
`validateEntity()` pass returning `Issue[]` — and **never silently auto-correct**, because
silent correction is data loss. Make level-up a *pending state* with outstanding choices,
not an atomic transaction.

### P7 — No content versioning policy

`ContentVersion` sits in `ContentHeader` and `Snapshots` is listed in the registry, but the
policy is undefined. The unanswered question is:

> **What happens to a character when a pack is updated, or uninstalled?**

This is a data-loss class of problem and it must be decided before anything ships.

**Recommendation.** A character pins `(rulesetId, packId, version)` for every definition it
references **and** stores a snapshot of the definitions it actually uses. A character must
always open, even with packs missing — degraded, with a list of Issues (`04`, INV-25).

### P8 — The scripting tension is unresolved

`Dos and don'ts.md` forbids an expression VM. But `Effects.md` already contains:

```
"value": { "formula": "10 + dex_mod + con_mod" }
```

plus `DiceExpression`, `Heal(1d10 + fighterLevel)`, and `scaling = +1d6 / slot level`.

**An expression evaluator is already required.** The real question is how constrained.

**Recommendation.** Decide this explicitly and early, because it defines the pack format:
a small, **closed, non-Turing-complete** expression AST — numbers, dice, and a fixed set of
named references (stats, levels, resources, proficiency). No branching, no loops, no
user-defined functions. Serialise it as structure, or as a string parsed into that AST at
pack load with a validator. This satisfies the spirit of the constraint — no general-purpose
scripting — while admitting what is genuinely needed.

### P9 — LAN sync is the riskiest infrastructure choice

"Diff transport" with last-writer-wins over nested entity state is a classic distributed
systems trap. Note that **`Command` is already the natural unit of synchronisation** — it is
an intent, it is small, and it is already in the design.

**Recommendation for v1** (which is player-only anyway): one authoritative host, others send
commands, with explicit ownership rules — the DM owns encounter and monster state, each
player owns their own character. Also budget for the mobile realities: mDNS discovery,
Android background restrictions, iOS local-network permission.

### P10 — Internal contradictions

**Homebrew.** `Homebrew.md` says *"Official content → normal engine; Homebrew → special
override system."* `Homebrew editor architecture.md` says *"Underneath, it produces exactly
the same FeatDefinition used by official packs."*

The second is right. Homebrew should be identical content with different **provenance**
(source plus a trust/validation flag), not a second path through the engine. Two paths means
every bug twice.

**Inline vs referenced definitions.** `Items.md` embeds full definitions
(`std::vector<FeatureDefinition> equippedFeatures`) while the rest of the design uses
references into the registry. Both are defensible, but an inline Feature must still receive
an identity (a synthesised ID at pack build), or effect-source tracing is lost.

**`OverrideLayer`** (in `Entity.md`) is undefined and dangerous. It is the escape hatch that
will absorb everything if left unconstrained. Define it narrowly, and always surface it in
the explanation trace as "Manual override".

### P11 — Race / Ancestry terminology

`enum ContentRole { Species, Ancestry, Race }` means editing an enum for every new system.
`RulesetDefinition` already lists `terminology / UI labels` — one internal concept plus a
ruleset-supplied label is the better mechanism.

---

## 5. Not covered anywhere in the notes

| Missing | Why it matters |
|---|---|
| **Entity persistence schema** | Content packs are designed; saving a *character* is not. Recommendation: blob (CBOR/JSON) plus indexed metadata columns, since the domain model will keep changing. |
| **Spellcasting model** | Prepared vs known vs spontaneous, spell lists, rituals, upcasting, pact magic, the multiclass slot table (`F-08`). `Resources.md` acknowledges slot structure, but spellcasting deserves a ruleset-level model the way action economy got one. |
| **Dice / RNG** | A `dice/` folder exists; no model. Critically: **many players roll physical dice.** Every roll the app makes must accept a hand-entered value (`04`, INV-27). Also seeding, for deterministic tests. |
| **Undo / Audit** | Listed once in the Application layer, never designed. A pure core returning new entities gives this almost for free — a bounded stack of previous states. |
| **Testing strategy** | The main payoff of a pure core. Recommendation: golden tests (canonical level-20 multiclass characters, expected derived stats) plus property tests for stacking determinism. |
| **Campaign model** | `campaign` appears in ApplicationState and `CampaignRules` in a Core test snippet; never defined. |
| **UI framework decision** | Qt is implied ("Core doesn't know Qt") but never stated. The generic Content Browser design depends on it. |
| **Licensing** | SRD 5.1 and 5.2 are CC-BY-4.0 and redistributable; non-SRD content is not. This shapes the entire pack strategy: ship SRD, let users import or homebrew the rest. For a content-heavy app on app stores this is a real risk, not a footnote. |

---

## 6. On scope

Multi-ruleset engine + content packs + homebrew editor + combat tracker + LAN sync + pack
builder tools + PDF export is a large undertaking for an experienced team.

The good news is that the notes' instinct — *shape the data so it can generalise later* — is
the right compromise, as opposed to *build the abstraction now*. The important discipline is
simply: **do not author PF2e content yet.**

A vertical slice that would prove the architecture:

> SRD 5e Fighter levels 1-5, plus Elf, plus five items → derived stats with full explanation
> traces → damage / rest / level-up → content browser.

If that works cleanly, the architecture is validated. Monsters, sync, homebrew editor and
PDF export come after.

---

## 7. Where this leaves things

| Problem | Cost to fix now | Cost to fix later |
|---|---|---|
| P1 — outcome space, open shapes | Low — mostly type declarations | Very high — rewrites all content |
| P2 — trigger layer | Low — reuses existing pieces | High — revisits Feature and Activation |
| P3 — stacking | Medium — needs a real design | High — subtle wrong numbers |
| P4 — duration / concentration | Medium | High — touches combat everywhere |
| P5 — terminology | **Trivial now** | Annoying forever |
| P6 — choices lifecycle | Medium | High — risks data loss |
| P7 — versioning | Low — a policy decision | Very high — data loss in the field |
| P8 — expression limits | Low — a decision | High — defines the pack format |

The proposed approach is in `02-recommended-approach.md`.
