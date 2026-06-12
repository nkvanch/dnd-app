# D&D 5e Companion App — Design & Architecture

A personal tabletop RPG companion for running and playing D&D 5e. Offline-first,
runs on iOS and Android, with optional local-WiFi multiplayer for a table sharing
one DM device.

---

## 1. The idea

A single app that handles the full mechanical complexity of D&D 5e so the table
doesn't have to. It does three jobs:

1. **Character building** — a guided wizard that produces a rules-correct character
   (race, class, background, ability scores, skills, equipment, spells), with every
   number derived programmatically rather than entered by hand.
2. **Playing** — a live character sheet that tracks HP, conditions, spell slots,
   resources, death saves, and attacks during a session, and explains where every
   number comes from (tap any value to see its audit trail).
3. **Running the table (DM)** — a dashboard where the DM sees every player's sheet,
   builds encounters from a monster library, and can override any value transparently
   (players see a ✱ and can read the reason).

The defining principle: **characters and monsters are the same kind of thing.** Both
are an `Entity` run through the same rules engine. A monster's AC is computed the same
way a player's is. This is what keeps the engine small and consistent — one pipeline,
not two.

The second principle: **every number is explainable.** The UI never computes stats
itself. It reads `entity.derived`, and any value can be tapped to show the full
breakdown of contributions (base + race + class + items + conditions + DM overrides).

---

## 2. How a character comes to life (data flow)

This is the most important thing to understand, because almost every bug we've fixed
traces back to it.

```
Content (static data)        Engine (pure functions)        State (Zustand + SQLite)
─────────────────────        ───────────────────────        ────────────────────────
races, classes,              applyGrant / levelUp           draft (being built)
backgrounds, spells,    ──>  recomputeDerived          ──>  characters[] (saved)
items, monsters,             resolveEffectsForTarget        persisted to SQLite
subclasses, feats            audit / explainValue
```

1. **Content** is plain data. A class progression lists, per level, the HP die, the
   features granted, and the choices offered. A race lists its features. Nothing in
   content "runs" — it's all describable values.

2. **Features carry Effects.** Everything that changes a number is a `Feature`
   containing `Effect`s. "Dwarf CON +2" is a `stat_modifier` effect. "Unarmored
   Defense" is a `base_ac_formula` effect with `formulaAbilities: ['dex','con']`.
   The engine never checks `if (race === 'dwarf')` — it just sums effects. (This is an
   architectural invariant: no class/race name string literals in engine logic.)

3. **`recomputeDerived(entity, rules)` is the heart.** It collects every active effect
   from features, equipped items, and conditions; applies them in a fixed priority
   order; and writes the results into `entity.derived`. It is pure and cheap, and is
   called after **every** mutation. The pipeline order is:

   ```
   base stats
     → ability-score modifiers (race bonuses fold into effectiveStats)
     → AC formula (Unarmored Defense etc.) + flat AC bonuses (shields, items)
     → speed (respecting "set" operations like Dwarf 25)
     → saves, skills, passives, spell DC/attack
     → DM overrides (applied LAST; win over everything; never touch stats/features)
   ```

4. **State** holds the `draft` (the character under construction) and the saved
   `characters[]`. Zustand is the synchronous source of truth for the UI; every
   change fires an async SQLite write so it survives app restarts.

### Why this matters for bugs we hit
- **AC double-counted to 21** because the AC-formula effect (value 10) was being summed
  both as the formula base *and* as a flat bonus. Fix: exclude `base_ac_formula` from
  the flat-bonus pass.
- **Changing class zeroed everything** because `levelUp` only applies levels *above* the
  current one, and the level wasn't reset to 0 — so level 1 was skipped. Fix: reset
  level in `clearClassData`.
- **HP showed stale** because HP is set by `applyHP`/`recalculateAllHP`, not by
  `recomputeDerived`. AC updates live; HP didn't until we recomputed it on score
  confirmation.

---

## 3. Architecture by layer

### Engine (`src/engine/`) — pure, no React, no I/O
| File | Responsibility |
|---|---|
| `types.ts` | The `Entity` contract and every supporting type. The spine of the app. |
| `pipeline.ts` | `recomputeDerived`, `collectAllEffects`, `applyStatModifiers`, `modifier`. |
| `resolver.ts` | `resolveEffectsForTarget` — the 5 effect-stacking strategies. |
| `leveling.ts` | `applyGrant`, `levelUp`, `resolveChoice`, `recalculateAllHP`, `reconcileConHp`, `applyAsiToEntity`, `applyFeatToEntity`. |
| `audit.ts` | `explainValue` — the tap-to-explain breakdown for any stat. |
| `conditions.ts` | Condition application with suppression (Blindsight suppresses Blinded without removing it). |
| `combat.ts` | Concentration, combat resolution helpers. |
| `rest.ts` | Short/long rest, `spendHitDie` (roll a hit die + heal), `discardHitDie` (spend one, no heal). |
| `dice.ts` | Dice expression parser/roller, ability-score roll sets. |
| `actionCards.ts` | Turns features/spells into the tappable "cards" the sheet shows. |
| `dmOverride.ts` | DM override model + `hasActiveOverride`. |
| `monsterFactory.ts` | Builds a monster `Entity` from statblock data (shares the engine). |
| `wikiImporter.ts` | Parses external statblocks via the Anthropic API (untested on real URLs). |
| `homebrewValidator.ts` | Validates user-authored content before it enters the DB. |

**The 5 effect-stacking strategies** (in `resolver.ts`) are how the engine resolves
multiple effects hitting the same target:
1. **combine** — sum (most bonuses)
2. **same-name dedup** — don't stack two copies of the same named bonus
3. **binary collapse** — advantage/disadvantage are boolean, not additive
4. **choose-max** — temp HP takes the highest, doesn't add
5. **base-formula exclusion** — AC formulas set the base, not a bonus (the source of the 21-AC bug)

### State (`src/store/`) — Zustand, SQLite-backed
`characterStore` (draft + saved characters), `campaignStore`, `combatStore`,
`sessionStore`, `homebrewStore`, `syncStore`. Pattern: synchronous Zustand update for
instant UI, async SQLite write as a side effect.

### Persistence (`src/db/`) — SQLite, offline-first
One full copy of the data on every device. `schema.ts` defines tables; the `*Repo.ts`
files are the read/write API for entities, campaigns, sessions, combat, sync, and a
content cache. Guarded with `Platform.OS === 'web'` so it no-ops in the browser.

### Sync (`src/sync/`) — local WiFi, optional
The DM device runs a WebSocket server; players join with a 6-digit room code + QR.
Each device holds the full DB; sync broadcasts entity snapshots. `syncManager` is the
public surface; `server`/`client`/`protocol`/`discovery` are the plumbing. **Combat
resolution is player-facing (Option A):** the app shows the dice expression and consumes
the resource, the player rolls physical dice and announces the result.

### Content (`src/content/`) — static rules data
9 races (+subraces), 12 classes (full L1–20), 24 subclasses (2 per class; features not
yet authored into progressions), 13 backgrounds, **82 feats**, **487 spells**
(class-tagged, in `generated.ts`), a starter set of SRD monsters, and items. This is
where all the D&D-specific knowledge lives — never in the engine.

### UI (`app/` — expo-router)
- `app/(tabs)/` — home, characters, campaigns, homebrew
- `app/creation/` — the wizard (name → hub → race → class → background → scores → skills → equipment → spells → review, plus level-up). Now wrapped by a shared safe-area `CreationHeader`.
- `app/sheet/[id].tsx` — the live character sheet host; tabs live in `src/components/sheet/`.
- `app/dm/` — dashboard, encounter, monsters, per-character view.
- `app/homebrew/` — spell/class/race builders, import review.

> Note: `src/screens/` contains an older navigator (`CreationNavigator`, `HomeScreen`,
> `NameLevelScreen`) that predates the move to expo-router `app/`. It appears to be dead
> code and is a candidate for deletion to avoid confusion.

---

## 4. The development roadmap (9 phases)

Sequenced deliberately: foundational systems before UI, persistence before sync,
single-player before multiplayer.

| Phase | Scope | Status |
|---|---|---|
| 1 | Content foundation (types, content data) | ✅ Complete |
| 2 | Action Card engine | ✅ Complete |
| 3 | Navigation restructure | ✅ Complete |
| 4 | Character sheet | ✅ Complete |
| 5 | SQLite persistence (offline-first) | ✅ Complete |
| 6 | Campaign system + DM Override model | 🟡 Partial |
| 7 | DM Dashboard | 🟡 Partial |
| 8 | Monster System (shares Entity engine) | 🟡 Partial |
| 9 | Homebrew + D&D Wiki import | 🟡 Built, untested on real data |

---

## 5. Current backlog (as of this session)

### Near-term / correctness
- [x] **Feats + ASI/feat picker** — 82 feats authored; the shared `AsiFeatPicker` resolves
      ASI-or-feat in both creation and in-play level-up. Retroactive CON→HP applied.
- [~] **Spells (class-tagged)** — 487 spells generated into `generated.ts` with a
      `classes` field. *Next:* wire into the aggregator + class-filtered picker in
      `spells.tsx`, then spell-selection-on-level-up.
- [ ] **Level-up completeness** — audit all 12 progressions; mid/high levels are HP-only
      stubs and subclass features aren't authored yet.
- [ ] **Conditions as content** — `globalContentDB.conditions` is still `[]`; sheet
      reminders are hardcoded.

### Known smaller gaps
- [ ] PHB *fixed* starting equipment (only choice-based gear is granted today).
- [ ] Inspiration toggle, XP bar (when `rules.useXP`), consumables/potions, an
      actions-remaining tracker, custom-condition editor.
- [ ] More monsters (12 today), more subclasses, a handful of skipped spells.

### Phases to finish
- [ ] Phase 6 — campaign management + DM override flows end to end.
- [ ] Phase 7 — DM dashboard (live player views, encounter builder).
- [ ] Phase 8 — monster system fleshed out via the shared Entity engine.
- [ ] Phase 9 — test homebrew + wiki import against real input (needs API key).
- [ ] Live two-device sync test (currently blocked: only one Android device available).

---

## 6. Invariants — do not break these

1. `makeEmptyEntity()` in `characterStore.ts` is the **only** from-scratch Entity constructor.
2. Every mutation uses an immutable spread, then `recomputeDerived(entity, rules)`.
3. DM overrides apply **last** in `recomputeDerived` and never touch `entity.stats`/`features`.
4. Passive `Effect`s fire in `recomputeDerived`; active `AbilityEffect`s fire on card use. Never mixed.
5. `router.push/replace/back` is **never** called during render — only in `useEffect` or handlers.
6. Engine files contain **zero** class/race/spell name string literals in conditional logic; all such logic lives in `src/content/`.
7. Zustand selectors must not return new references (no inline `.find()` / object literals) — that causes the "getSnapshot infinite loop" crash.
8. All React hooks are declared at the top of a component, before any conditional return.

---

## 7. How we work on it

- **Direct edits (default):** diagnosis and surgical fixes happen against the real files
  in `C:\Users\nk\dnd-app`. Find the real root cause in the actual code, then edit.
- **Claude Code (for bulk):** self-contained generation it can build/test/iterate on its
  own (e.g. scaffolding all 12 progressions until `tsc` is clean).
- **The loop:** edit → `npx tsc --noEmit` → `npx expo run:android` → test on device →
  report symptoms → edit. `tsc` is the static gate; device behavior is verified by hand.
