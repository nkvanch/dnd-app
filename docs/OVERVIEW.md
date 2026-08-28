# Grimoire — Project Overview

> A single, current narrative of what this project is, what exists today, what's
> coming, and what it's ultimately for. For deeper architectural detail see
> `DESIGN.md`; for current status and what's next see `STATUS.md` (`ROADMAP.md`
> is an archived historical build log, no longer kept current); for the
> recruiting/elevator pitch see `ABOUT.md`.

---

## 1. What Grimoire is

Grimoire is a **digital companion for tabletop role-playing games**, built first
and foremost around **D&D 5e**. It runs on phones and tablets (iOS and Android),
works **fully offline**, and is designed so that an entire group — players and a
DM — can use it at the table together.

But the deeper ambition is structural. Most D&D apps hard-code the rules: a
fireball is a special case in the code, a barbarian's unarmored defense is an
`if (class === 'barbarian')` somewhere. Grimoire is built the opposite way. It is
a **rules engine where the rules are data**, and D&D 5e is simply the first set
of data loaded into it.

Two ideas sit at the center of the whole design:

**One Entity for everything.** A player character, a monster, and an NPC are all
the same data shape (`Entity`). The same code that computes a wizard's spell save
DC computes a dragon's. There is no separate "monster system" — a statblock is
just an Entity with different content attached. This is what will eventually make
the DM's encounter tools and the player's character sheet share one engine.

**Every number is explainable.** No stat is a magic value. Your AC of 17 is the
sum of traceable contributions — base armor, a shield, a Dexterity modifier, a
spell, a DM's ruling — and the app can show you that breakdown. This "audit
trail" is not a debugging feature bolted on; it's the core promise. The long-term
goal is that you can tap *any* number and drill all the way down to first
principles.

**Tech stack:** React Native (Expo SDK ~52), TypeScript, Zustand for state,
expo-sqlite for storage. Offline-first, with optional local-WiFi multiplayer (no
servers, no accounts).

---

## 2. How it works (the shape of the system)

The codebase is split cleanly into **engine** (pure rules logic) and **content**
(the actual D&D data). The engine never mentions "barbarian" or "fireball" by
name — all such specifics live in content files. This separation is what makes a
second ruleset, or heavy homebrew, possible later.

The spine is the **Feature → Effect pipeline**:

- Everything that changes a character — races, classes, subclasses, backgrounds,
  feats, items, spells, conditions — grants **Features**.
- Features carry **Effects** (e.g. "+1 to Constitution", "AC = 10 + DEX + CON",
  "proficiency in Perception").
- After *any* change to a character, a single pure function, `recomputeDerived`,
  walks every active Effect and recomputes all derived stats from scratch (AC,
  initiative, saves, skills, spell DC, and so on). The UI only ever *reads* these
  computed values; it never calculates them itself.
- **DM overrides** apply last and win over everything, without ever touching the
  character's underlying data — so cancelling an override restores the original
  value automatically.

State lives in **Zustand stores** (characters, combat, campaign, session,
homebrew, sync), each backed by **SQLite** so everything survives an app restart.
Mutations update memory instantly and persist asynchronously.

**Multiplayer** is peer-to-peer over local WiFi: the DM's device acts as host,
players join with a code, and entity changes broadcast to connected peers. No
internet required.

---

## 3. What's built today

**Character creation** — a full step-by-step wizard: name, race (with subraces),
class, background, ability scores (standard array, point buy, manual, or 4d6
roll), skills, starting equipment, and spells, with a hub screen that tracks
completion.

**The character sheet** — a six-tab sheet that is the heart of play:
- *Combat:* HP with a damage/heal pad, manual HP/temp-HP controls, the stat row
  (AC / Speed / Initiative / Passive Perception) where every value is tappable to
  see its audit breakdown, death saving throws, a concentration-check prompt on
  damage, custom resources, spell slots, **hit dice (Roll vs. Use)**, conditions
  with mechanical reminders, and the **Level Up** button.
- *Actions, Abilities, Features, Inventory, Notes* — the rest of the sheet.

**The rules engine** — derived-stat pipeline, effect-stacking resolver, leveling,
short/long rest recovery, conditions, combat (damage/healing/concentration), the
audit trail, dice, action-card generation, DM overrides, and a monster factory.

**Leveling** — characters advance through authored class progressions (all 12
classes, levels 1–20). Leveling grants HP, features, and refreshes spell slots,
and queues the choices a level requires. Ability Score Improvements and **feats**
are resolved through a shared picker (used by both creation and in-play
level-up), and the PHB "raising Constitution raises HP retroactively" rule is
applied.

**Content scale:** 9 races (plus subraces), 12 classes with full 1–20
progressions, 24 subclass files, 13 backgrounds, a starter item and SRD-monster
set, **82 feats**, and **487 spells** now converted from the vault — each tagged
with the classes that can cast it.

**DM tools (partial):** stat overrides with labels and expiry, an encounter/
dashboard scaffold, and monster browsing.

**Built but not yet hardware-tested:** local-WiFi sync, the homebrew builders
(spell / class / race / feature editors), and AI-assisted wiki import.

---

## 4. Recent work (this development arc)

- Added a **feats system** (82 feats) and a single shared **ASI/Feat picker**
  component used by both the creation flow and the in-play sheet.
- Implemented the **retroactive Constitution → HP** rule on ability increases,
  without overwriting rolled HP.
- **Consolidated leveling** to one Level Up button (on the Combat tab) that opens
  the ASI/feat picker, removing a duplicate and collapsing two competing class-
  progression maps into the single canonical `ALL_PROGRESSIONS`.
- Split **hit dice** into two actions: *Roll Hit Die* (the app rolls + heals) and
  *Use Hit Die* (spends one with no auto-heal, for rolling physical dice), and
  fixed hit-die healing to use effective Constitution.
- Converted the full spell corpus: **487 spells** parsed from the Obsidian vault
  into typed app content via a re-runnable script, with a new `classes` field on
  every spell.

---

## 5. What's next

**Immediate (spells):**
1. Wire the generated 487-spell file into the app's spell list.
2. Add **class filtering** to the spell picker so each class sees only its spells.
3. Build **spell selection on level-up** — the largest of the three, because the
   number of spells a class learns/prepares varies by class and level, so it needs
   a small per-class spellcasting-progression table.

**After that:**
- *Level-up completeness:* author subclass features and the choices (beyond ASI)
  that some levels require, so leveling is fully resolvable from the sheet.
- *Conditions as content:* move condition rules into the content layer so they're
  data-driven like everything else (today some are display-only reminders).
- *The differentiators* — the features meant to set Grimoire apart:
  - **Recursive "explain everything"** — drill into any number to its roots.
  - **Rule debugger** — see exactly which effects fired and why.
  - **Encounter runtime + condition intelligence** — run a fight with the engine
    tracking initiative, conditions, and their mechanical consequences.
  - **Action cards as primary UX** — abilities and spells as tappable cards.
  - **Content packs** — formalize "a ruleset is just data" so homebrew and other
    systems can be loaded.

**Deliberately deferred (with reasons):**
- **Multiclassing** — a large feature that reshapes the identity model (one class
  → many class/level pairs) plus multiclass spell slots and prerequisites; its own
  phase, not a quick add.
- **XP-based leveling, alignment, languages, inspiration** — small, self-contained
  additions to schedule individually.
- **Sync polish** — needs two physical devices to test; functional but unproven.

---

## 6. The final aim

Grimoire is meant to become a **tabletop RPG operating system**: a single engine
that can run a game's rules from data, with D&D 5e as the first complete content
pack. The end state is an app where:

- A player builds, levels, and plays a character whose every value is transparent
  and explainable down to first principles.
- A DM runs encounters with the same engine the players use, applying rulings and
  conditions that flow through the rules automatically.
- The whole table stays in sync over local WiFi, fully offline.
- Homebrew is first-class — new feats, spells, classes, even whole rulesets are
  authored as content, not code.

The guiding principle is **honesty of the rules**: the app should never be a black
box. If it changes a number, it can always tell you why.

---

## 7. Honest limitations (today)

- Leveling resolves ASI/feat choices from the sheet; other queued choices (a
  caster's new spells, the level-3 subclass pick) are not yet resolvable in-play.
- Subclass features and some mid/high class levels are HP-only stubs, not yet
  fully authored.
- The 487-spell corpus is generated but not yet wired into the app's spell list.
- Sync, homebrew builders, and wiki import are implemented but untested on
  hardware.
- Conditions are partly display-only reminders rather than fully data-driven.
- This is an actively evolving personal project; data shapes may still change.
