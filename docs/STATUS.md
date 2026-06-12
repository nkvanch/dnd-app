# Grimoire — Project Status & Direction

*The single source of truth for where this project is. Read `ABOUT.md` for the
recruiting pitch, `DESIGN.md` for the architecture, `ROADMAP.md` for the sequenced
plan. This file ties them together: **what the app is, what's built, what's next, and
the final aim.***

*Last updated: after the feats / in-play level-up / hit-dice / spell-conversion work.*

---

## 1. What the app is

Grimoire (working name) is a **rules-aware tabletop RPG companion**. Its first and
default ruleset is **D&D 5th Edition**, but the architecture treats rules, content, and
workflow as *data*, not hardcoded logic — so the long-term shape is less "a D&D app" and
more "an engine that runs tabletop rulesets, with D&D 5e as the first one loaded."

It runs on **iOS and Android**, works **fully offline**, and can sync a table together
over **local WiFi** with no server, account, or internet.

It does three jobs:

1. **Build characters** through a guided wizard that produces a rules-correct character —
   every number (AC, HP, save DC, proficiency bonus) computed by the engine, never typed
   in by hand.
2. **Play** with a live character sheet that tracks HP, conditions, spell slots,
   resources, hit dice, and death saves, and can **explain every number** — tap a value
   to see its full breakdown.
3. **Run the table (DM)** with a dashboard of every player's sheet, a monster library,
   an encounter builder, and transparent overrides (players see a ✱ and the reason).

### The two ideas everything rests on

- **Characters and monsters are the same `Entity`**, run through the same rules engine.
  We write combat/stat/condition logic once; players and monsters both benefit.
- **Every number is explainable.** The UI never does math — it reads `entity.derived`,
  and any value drills down to base + race + class + item + condition + DM override.
  This is structural: the same machinery that *computes* a value can *explain* it,
  because everything that changes a number is a `Feature` carrying `Effect`s that the
  engine resolves in a fixed priority order.

---

## 2. Where it stands today (current capabilities)

### Character creation — working
Guided wizard: name & level → race (with subraces) → class → background → ability scores
(standard array / point buy / manual / 4d6 roll, with live race-bonus preview) → skills →
starting equipment → spells → review. Produces a rules-correct character with HP, AC,
saves, and proficiencies derived automatically. Shared safe-area `CreationHeader` with
back + cancel. Switching race or class cleanly re-applies from scratch (no stale
features, HP, or AC).

### The living character sheet — working
Six tabs:
- **Combat** — HP (damage / heal / temp / manual set / set-max override), **hit dice
  with two actions: Roll (app rolls + heals) and Use (spend one, roll your own)**, death
  saves, weapon attacks, conditions with mechanical reminders, resources, spell slots,
  concentration checks, and an in-place **Level Up** button.
- **Actions** — action cards generated from features.
- **Abilities** — ability scores, skills, passive Perception/Investigation/Insight.
- **Features** — features grouped by source.
- **Inventory** — carried/equipped items, carry weight, currency.
- **Notes**.

Tap any derived value (AC, speed, initiative, passive perception) for its audit trail.
A persistent rest bar (short/long) sits above the Android nav bar; a floating dice
roller is always available.

### Leveling up — working (single-class)
- **In-play level-up**: the Combat-tab Level Up button advances the character through the
  engine, grants features, grows spell slots, and — when the level grants an Ability
  Score Improvement — opens the **ASI / Feat picker** right there.
- **ASI / Feat picker** (shared between creation and in-play, so they never drift):
  +2 to one stat, +1 to two, or take a **Feat** from a searchable list of all 82 feats.
- **Rules-correct HP**: proficiency bonus grows by level automatically; per-level Hit Die
  HP; and the **retroactive CON→HP rule** (raising your CON modifier increases max HP by
  1 per level) is applied on both ASI and feat, without wiping rolled HP.

### Content — substantial
- 9 races (+subraces), 12 classes (full L1–20 progressions), 13 backgrounds, items, a
  starter set of SRD monsters.
- **82 feats** (`src/content/feats/`), each selectable in place of an ASI; the
  mechanically simple ones auto-apply their effects (e.g. Alert +5 initiative, Durable
  +1 CON, Mobile +10 speed), the rest apply as described features.
- **487 spells** parsed from the vault into `src/content/spells/generated.ts`, each tagged
  with the **classes** that can cast it. *(Generated and type-checked; not yet wired into
  the app's spell picker — that's the immediate next step.)*

### DM tools — partial
Dashboard, monster library, encounter screen, per-character view, and a transparent
DM-override model exist. Override values apply last in the pipeline and show a ✱ with a
reason. Not yet a complete end-to-end DM flow.

### Offline & multiplayer — built, sync untested at a real table
Every device keeps a full SQLite copy (works with no signal). Local-WiFi sync: DM device
hosts a WebSocket server, players join via 6-digit code + QR. Combat resolution is
player-facing — the app shows the dice expression and consumes the resource; the player
rolls physical dice. *(Two-device sync is unverified — only one Android device on hand.)*

### Homebrew — built, unverified on real input
Builders for custom spells/classes/races and a feature editor exist; official and
homebrew content already merge through one `ContentDB` so the engine can't tell them
apart. The external-statblock importer (`wikiImporter`) is untested on a real URL (needs
an API key).

---

## 3. What we've built recently (changelog)

In rough order across the recent sessions:

- **Device-test bug fixes**: class-change corruption (zeroed HP / missing equipment / no
  AC bonus), stale HP during creation, AC double-counting (21 instead of 15), creation
  header + cancel, spell-slot growth on level-up, temp-HP controls, set-max-HP override,
  death-save reset.
- **Strategic reframe** to "tabletop RPG operating system," captured in `ABOUT.md`,
  `DESIGN.md`, `ROADMAP.md`. Verified the engine is already ~80% aligned with that vision.
- **Feats** (was completely empty): added the `Feat` type, authored all 82 feats from the
  vault, wired them into the content DB and the homebrew merge.
- **ASI / Feat picker**: built the shared `AsiFeatPicker` component; the creation level-up
  screen and the in-play sheet both use it. Consolidated to a single level-up button.
- **In-play level-up**: the Combat-tab button now levels the character and resolves the
  ASI/feat choice; deduped the class-progression map to one canonical source.
- **Retroactive CON→HP** rule and shared `applyAsiToEntity` / `applyFeatToEntity` engine
  helpers; `spendHitDie` now uses effective CON.
- **Hit-dice actions**: split into **Roll Hit Die** (app rolls + heals) and **Use Hit
  Die** (`discardHitDie` — spend one, no auto-heal).
- **Spell conversion**: added a `classes` field to the `Spell` type and wrote
  `scripts/convert-spells.mjs`, which parsed **487** class-tagged spells from the vault
  into `src/content/spells/generated.ts`.

---

## 4. What's next

### Immediate (spells — in progress)
1. **Wire `generated.ts` into the app.** Decide replace-vs-merge with the existing
   hand-authored spells, point the aggregator at the 487-spell corpus.
2. **Class-filtered spell picker.** Use each spell's `classes` tag to show only the
   relevant list in the creation spell step (`spells.tsx`).
3. **Spell selection on level-up.** Let casters learn/prepare new spells as they level —
   needs a small per-class spellcasting-progression table (known vs. prepared, counts by
   level). The biggest of the three; scoped after the data is wired.

### Near-term correctness / depth
- **Level-up completeness**: audit all 12 progressions; many mid/high levels are HP-only
  stubs and subclass features aren't authored yet.
- **Conditions as content**: `globalContentDB.conditions` is still empty; the sheet's
  condition reminders are hardcoded. Move them into content so the engine *applies* them.
- **PHB fixed starting equipment** (only choice-based gear is granted today).
- Smaller: inspiration toggle, XP bar (when `rules.useXP`), consumables/potions,
  actions-remaining tracker, more monsters/subclasses.

### The differentiators (from the roadmap)
- **Rule Debugger** — a read-only screen dumping an entity's features/effects/overrides
  in resolution order. Cheap; accelerates everything else.
- **Recursive Explain-Everything** — make the audit modal drill down (AC → DEX modifier →
  racial +2 → the feature). Nearly free given the data model; the flagship feature.
- **Content Pack architecture** — wrap existing content as a built-in pack, load enabled
  packs in order (house rules override PHB), add pack provenance. Delivers the
  "rules-as-data platform" spirit cheaply.
- **Feature-first homebrew builder** — author a Feature; races/classes/items are just
  named collections of Features.
- **Encounter runtime + condition intelligence** — one combat screen (initiative, rounds,
  per-combatant HP/conditions/concentration); conditions that actually apply their effects.

### Deliberately deferred (until a real second use case forces them)
Multiclassing (rewrites the identity model), re-authoring official content as JSON,
generic resource pools replacing spell slots, any non-D&D ruleset, full session replay.
Alignment / languages / inspiration are small separate tasks, not level-up mechanics.

---

## 5. The final aim

A single tool where a table can **build, modify, and run their own game** without being
boxed in by a fixed ruleset:

- A player can invent a race, class, spell, feat, resource, condition, or house rule, and
  the engine can **understand it, validate it, explain it, and run it** — because it's all
  data flowing through the same Feature/Effect pipeline that official content uses.
- Every number on every sheet is **inspectable to its roots** — a learning tool for new
  players and a trust tool for veterans.
- The DM runs encounters from one screen, with transparent overrides and a monster library
  that shares the exact same engine as the player characters.
- It all works **offline first**, with optional local-WiFi sync as a convenience, never a
  requirement.

D&D 5e is the proof that the engine works. The north star is that the engine isn't
*about* D&D at all — D&D is just the first content pack.

---

## 6. How we work

- **Direct edits (default):** diagnosis and surgical fixes happen against the real files.
- **Claude Code (for bulk):** self-contained generation it can build/test itself.
- **Scripts (for data):** one-off converters like `scripts/convert-spells.mjs`, re-runnable
  against the source vault.
- **The loop:** edit → `npx tsc --noEmit` → `npx expo run:android` → test on device →
  report → edit. `tsc` is the static gate; device behavior is verified by hand.

### Honest current limitations
- In-play level-up resolves ASI/feat; other queued choices (a caster's new spells, the
  level-3 subclass pick) are not yet resolvable from the sheet.
- Feat prerequisites are shown, not enforced (player/DM judges).
- Two-device sync is unverified (one device on hand).
- The 487-spell corpus is generated but not yet consumed by the app.
- Homebrew + wiki import are built but untested on real input.
