# Grimoire — Multi-System Vision (d20/Level-Based Only)
*Scope decision, locked: Bucket A only (systems sharing D&D's core DNA).*
*Everything else (dice-pool systems, narrative/PbtA games) explicitly OUT of scope.*
*Nothing here is scheduled before 5e + 5.5e are genuinely complete — see ROADMAP_1.0.md.*

---

## THE SCOPE, PRECISELY

**In scope — Bucket A, "class-level d20" family:**
- D&D 5e (current, in progress)
- D&D 2024 / 5.5e (next, per ROADMAP_1.0.md)
- Old-School Essentials (B/X D&D)
- D&D 3.5e / Pathfinder 1e
- Pathfinder 2e
- D&D 4e
- AD&D 1e/2e

**Out of scope, permanently, per this decision:**
- Dice-pool systems (Vampire V5, Alien/Year Zero, Savage Worlds, Cyberpunk RED,
  Call of Cthulhu)
- Narrative/move-based systems (PbtA, Blades in the Dark, Daggerheart)
- Lancer (d20-adjacent roll math, but mech-loadout build model is alien to
  the class/level shape)

**Why this line, specifically:** every system in scope shares three load-
bearing assumptions the current engine already encodes: (1) a persistent
character advances through discrete **levels** that grant fixed content,
(2) resolution is **roll + modifier vs. a target number**, (3) a character
**is a stat block** — ability scores, derived combat numbers, a resource
list, a feature list. Everything excluded breaks at least one of these
(PbtA has no levels or stat block in this sense; dice-pool games resolve
differently enough that reusing the resolution pipeline buys little).

---

## WHAT "GENERIC D20/LEVEL ENGINE" ACTUALLY MEANS

Not a promise, a checklist. The current engine is 5e-shaped in ways that are
sometimes *load-bearing* (genuinely needed for any d20/level game) and
sometimes *accidentally specific* (just how 5e happens to work). Making the
engine "ready" means deliberately separating these two categories and only
genericizing the load-bearing ones.

### Confirmed load-bearing (keep, generalize)
- **Entity/Feature/Effect/Choice/Resource** — already abstract enough. A
  Feature doesn't know it's a "5e class feature"; it's just a bundle of
  Effects gated by level/choice. This pattern transfers to every Bucket A
  system without modification.
- **Roll + modifier vs. target number** (`rollExpression`, `modifier()`) —
  the *shape* is universal to d20 games. The specific formula
  `⌊(score-10)/2⌋` is 5e-only; needs to become a per-ruleset function.
- **Progression as data** (`ClassProgression`, level-by-level grants) —
  already the right shape. AD&D's XP-table-per-class and PF2e's proficiency
  ranks are still "at level N, grant X" — same data shape, different tables.

### Accidentally 5e-specific (must become ruleset-configurable)
- **`AbilityScores`** hardcodes six named stats (str/dex/con/int/wis/cha).
  Needs to become a ruleset-defined stat list — OSE and AD&D use the same
  six, but the *modifier table* differs (AD&D's is not the smooth 5e curve).
- **`modifier()`** — the 5e formula is one specific ruleset's function, not
  a law of physics. Needs to be a per-ruleset lookup/formula.
- **Proficiency bonus** — doesn't exist in 3.5e/PF1e (BAB instead, differs
  per class) or AD&D (THAC0) or PF2e (proficiency *ranks*, not a flat
  bonus). This is the single biggest structural fork in the list —
  `DerivedStats.proficiencyBonus` needs to become either optional or
  replaced by a ruleset-specific "attack/check resolution" strategy.
- **Saving throws keyed to the six abilities** — 3.5e/AD&D use Fort/Ref/Will
  (or worse, per-category saves in 1e), not ability-keyed saves. This needs
  its own abstraction: a ruleset defines its save categories and how they're
  computed, full stop.
- **`SpellSlots` as fixed tiers 1-9** — OSE and AD&D keep Vancian slots (so
  this mostly transfers), but 4e's power system (at-will/encounter/daily)
  doesn't use slots at all. Needs to become one option among several
  "resource models" a ruleset can declare, not the only one.
- **Skills as a closed union (`SkillName`)** — 3.5e/PF1e use skill *points*
  spent across a longer, edition-specific skill list; AD&D barely has skills
  at all (non-weapon proficiencies, optional). Needs to become ruleset-
  defined, not a hardcoded closed type.

### The real shape of the work
This is a **ruleset abstraction layer**, not a rewrite of Entity/Feature/
Effect (those survive as-is). Concretely: a `Ruleset` becomes a first-class
concept — analogous to how `CampaignRules`/house rules already work, but one
level up — defining: the stat list + modifier formula, the resolution
model (proficiency bonus / BAB / THAC0 / proficiency ranks), the save
categories, the resource model(s) available, and the skill list. `Entity`
gains a `rulesetId`; `recomputeDerived` dispatches to the ruleset's own
derivation function instead of hardcoding 5e math inline.

---

## SEQUENCING (nothing here jumps the 5e/5.5e queue)

| Phase | What |
|---|---|
| Now → 1.0 | Finish 5e (ROADMAP_1.0.md, unchanged) |
| 1.0 → 1.x | D&D 2024 / 5.5e — reuses ~90% of current pipeline as content, not new engine math. Doing this FIRST, before any abstraction work, is deliberate: two D&D-family systems inside the current 5e-shaped engine will show exactly which assumptions are truly load-bearing vs. accidental, from real evidence instead of guessing. |
| 2.0 | Ruleset abstraction layer (the checklist above), extracted retroactively from what 5e + 5.5e actually needed in common. Do NOT design this in the abstract before two real systems exist inside the engine. |
| 2.x | Old-School Essentials — deliberately the cheapest real second *non-D&D-2024* system. Confirms the ruleset abstraction on genuinely different math (AD&D-lineage saves, no feats, flat class tables) while still being small enough to fail cheaply if the abstraction is wrong. |
| 2.x+ | 3.5e/PF1e, then PF2e, then 4e, then AD&D 1e/2e — roughly in order of "how much of the abstraction layer already covers them," cheapest-fit first. Re-sequence based on what 2.x actually reveals; this order is a starting guess, not a commitment. |

**Hard rule carried over from ROADMAP_1.0.md:** no phase here starts before
the previous one is genuinely solid — same discipline that's kept the 5e
build honest (no faked functionality, no mixed signals about what's real).
A half-working Pathfinder 2e mode is worse than no Pathfinder 2e mode.

---

## WHAT DOESN'T CHANGE
Sync, campaigns, homebrew builders, the sheet UI shell, house rules — all of
this is ruleset-agnostic already or trivially made so (house rules are
already "optional config on top of a ruleset," which is the right pattern
to extend). The legal audit discipline (SRD/OGL for 5e, whatever the
equivalent open license is per system — OSE is OSR-licensed, PF2e content
is under the ORC license, etc.) applies fresh to each new ruleset and should
get its own Phase-1-style pass per system, not be assumed clean by analogy.
