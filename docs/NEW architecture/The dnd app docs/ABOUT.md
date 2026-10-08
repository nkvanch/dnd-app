# Grimoire — a D&D 5e Companion App
*(working name — rename as you like)*

> A character builder, live play sheet, and DM dashboard for Dungeons & Dragons 5th
> Edition. Offline-first, runs on iOS and Android, and lets a whole table share a
> session over local WiFi. We're building the tool we wish existed at our own table.

---

## The one-paragraph pitch

Most D&D apps are either a glorified PDF of your character sheet or a paywalled
subscription that still makes you do the math. We're building something different: an
app that actually *understands the rules*. You build a character through a guided
wizard, and every number — your AC, your hit points, your spell save DC — is computed
by a real rules engine, not typed in by hand. During the game, the sheet is alive: tap
your AC and it shows you exactly why it's 17 (10 base + 2 Dex + 5 plate, with a ✱ if
the DM tweaked it). The DM gets a dashboard of the whole party plus a monster library
to run encounters. It works on a plane with no signal, and at the table it syncs over
local WiFi with no server, no account, no internet.

---

## Why this is interesting to build

**It's a real systems problem disguised as a hobby app.** D&D 5e is a deceptively
complex rules system — stacking bonuses, conditional modifiers, conditions that
suppress other conditions, spellcasting progressions that differ per class. Modeling
that *correctly and generically* (without a giant pile of `if class == "barbarian"`
special cases) is a genuinely satisfying engineering challenge. We solved it with one
core idea (below) and it makes the whole thing tractable.

**The architecture is clean and opinionated.** Pure rules engine with zero UI or I/O.
Immutable state. One code path for characters and monsters. Every value traceable to
its sources. If you like well-factored code, there's a lot to like here. If you've ever
been frustrated by spaghetti business logic, this is the antidote.

**It's the kind of project you can actually finish and use.** It's not a startup, not
a job — it's a tool for playing a game we enjoy, built to a real standard. You'll see
it used at a real table.

---

## The two ideas everything rests on

If you understand these two things, you understand the whole app.

### 1. Characters and monsters are the same thing

Both are an `Entity` — the same data structure — run through the same rules engine. A
goblin's AC is calculated exactly the way a player's is. This means we write the combat,
stat, and condition logic **once**. When we improve the engine, players and monsters
both benefit. No parallel code paths to keep in sync.

### 2. Every number is explainable

The UI never does math. It reads pre-computed values, and **any number can be tapped to
reveal its full breakdown**: base value, race bonus, class feature, magic item,
active condition, and any DM override (shown transparently with a ✱ and a reason — no
hidden fudging). This isn't a nice-to-have bolted on at the end; it's baked into how the
engine is structured. The same machinery that *computes* a value can *explain* it.

How it works under the hood: everything that affects a number — a racial bonus, a class
feature, a spell, a worn item — is a **Feature** that carries **Effects**. The engine
collects every active effect, applies them in a fixed priority order, and writes the
results out. Want to know why speed is 25 instead of 30? Because the Dwarf feature
carries a "set speed to 25" effect. The engine never hardcodes "dwarves are slow" — it
just resolves effects. Adding new content is data, not code.

---

## What it does today

**Character creation** — A step-by-step wizard: name & level, race (with subraces),
class, background, ability scores (standard array / point buy / manual / 4d6 roll),
skills, starting equipment, and spells. It produces a rules-correct character with HP,
AC, saves, and proficiencies all derived automatically.

**The living character sheet** — Six tabs covering combat (HP with damage/heal/temp,
hit dice, death saves, weapon attacks, conditions with their mechanical reminders),
ability scores & skills (with passive Perception/Investigation/Insight), features
grouped by source, full spellcasting management (slots for every tier, save DC, attack
bonus, prepared/known spells), and inventory with carry weight. Tap any value for its
audit trail.

**DM tools** — A dashboard to view every player's sheet live, a monster library, an
encounter builder, and a transparent override system (change any value; the player sees
why).

**Offline & local multiplayer** — Every device keeps a full local copy in SQLite, so it
works with no connection. At the table, the DM's device hosts a WebSocket server and
players join with a 6-digit code + QR — no internet, no account, no cloud.

**Homebrew (in progress)** — Builders for custom spells, classes, and races, plus an
experimental importer that reads external statblocks.

---

## Tech stack

| Area | Choice |
|---|---|
| Framework | React Native (Expo), TypeScript |
| State | Zustand |
| Persistence | SQLite (expo-sqlite), offline-first, one full copy per device |
| Multiplayer | Local-WiFi WebSocket (DM device hosts), 6-digit room code + QR |
| Navigation | expo-router |
| Platforms | iOS + Android (Android is the active dev target) |

**Mental model of the codebase:**

```
src/content/   →  the D&D rules data (races, classes, spells, monsters...). Pure data.
src/engine/    →  the rules engine. Pure functions. No React, no database, no network.
src/store/     →  app state (Zustand), backed by SQLite.
src/db/        →  SQLite schema + read/write.
src/sync/      →  local-WiFi multiplayer.
app/           →  the screens (expo-router): creation wizard, character sheet, DM tools.
```

The golden rule: **D&D-specific knowledge lives only in `src/content/`.** The engine
never knows what a "barbarian" is — it only knows how to resolve effects. This is what
keeps it maintainable.

---

## Where it's headed

Built in phases — foundations before UI, persistence before sync, single-player before
multiplayer. Phases 1–5 (content, engine, navigation, character sheet, persistence) are
done. In flight: campaign management and the DM override flows, the DM dashboard, a
fuller monster system, and homebrew + statblock import. Further out: completing every
class's level-up progression, more monsters and subclasses, and polish like inspiration,
XP tracking, consumables, and a custom-condition editor.

There's a detailed engineering spec in [`DESIGN.md`](./DESIGN.md) covering the data
flow, the effect-resolution pipeline, and the invariants that keep the codebase clean.

---

## Want to help?

Good first areas depending on what you enjoy:

- **Rules/content (TypeScript, no engine knowledge needed):** flesh out class
  progressions, add monsters, subclasses, and spells. It's structured data — you mostly
  describe what a feature *does* and the engine handles the rest. Great on-ramp.
- **Engine (for the systems-minded):** effect resolution, leveling, condition
  interactions, combat. Pure functions, highly testable, no UI to fight.
- **UI/UX (React Native):** the character sheet and DM dashboard always want polish, and
  mobile layout for dense game data is a fun constraint.
- **You play D&D and have opinions:** honestly some of the most valuable input. Tell us
  what's annoying at your table and what a good tool would do about it.

To get oriented: read the two core ideas above, skim `DESIGN.md`, then run the app
(`npx expo run:android`) and make a character. The wizard is the fastest way to see the
whole engine working end to end.
