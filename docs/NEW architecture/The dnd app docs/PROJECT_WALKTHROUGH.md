# Grimoire — Project Walkthrough & Interview Prep

*A reference document for genuinely understanding this codebase and being able to
talk about it under pressure. Written from the actual architecture and the
actual bugs found and fixed while building it — not generic advice.*

---

## PART 1 — THE ELEVATOR PITCH

### "Walk me through your project" (under 2 minutes)

> "Grimoire is a companion app for 5th-edition-compatible tabletop RPGs — the
> kind of app you'd have open on your phone at an actual table while playing
> D&D. It handles character sheets, dice, spell and item tracking, and — the
> part I think is most interesting — live sync between the DM's phone and
> every player's phone over the same WiFi network, with zero servers involved.
> No account, no cloud, no internet required at all once it's installed.
> Everything lives on-device in SQLite, and when you're at the table, the DM's
> device runs a small local server that the players' devices connect to
> directly — like a LAN party, not a web app.
>
> I built the whole rules engine myself: character creation, leveling,
> combat math (AC, damage, resistances, conditions), spell slots, rest
> mechanics, death saves — all as pure, testable functions that operate on a
> single `Entity` data structure. On top of that sits a legal-content layer,
> since D&D's actual rules text is Wizards of the Coast's intellectual
> property — I built a full audit system that tags every spell, class,
> race, background, feat, and item with its licensing status under Wizards'
> System Reference Document (their official CC-BY-licensed open ruleset), so
> the public build only ships content that's actually legal to distribute,
> while my own personal build keeps the full non-SRD content I actually play
> with."

**Who it's for:** Players and DMs who want a real digital character sheet at
a physical table — not a note-taking app, not a full virtual tabletop with a
map and tokens, specifically the character-sheet-and-dice layer, built to
actually run the mechanics rather than just display text.

### "What problem does this project solve?"

Two real problems, one obvious and one less obvious:

1. **The obvious one**: paper character sheets are error-prone and slow.
   Recomputing your AC after equipping armor, tracking twelve different
   resource pools (spell slots, ki points, rage uses, hit dice...), and
   doing death-save bookkeeping by hand is exactly the kind of thing
   software should do for you.
2. **The less obvious one**: most digital D&D tools assume you're playing
   remotely (VTTs like Roll20/Foundry) or assume a cloud account and a
   company server sitting between you and your own character data. Grimoire
   is built for people playing *in person*, at a table, who don't want their
   character data going through anyone's server, and who need it to work
   even if the venue's WiFi is bad or nonexistent for the solo/offline case.

### "Why did you choose to build this specific project?"

Genuine answer, not tutorial-driven: it comes from actually playing the
game and being frustrated with the existing options — either paper (slow,
error-prone) or an app that assumes internet connectivity and a company
account you don't want tied to your character. The legal-content question
(what's actually licensed vs. not) came up because the goal was always to
eventually put this on the Play Store, which meant the homebrew/personal
content mixed into a working prototype had to get separated from what's
actually safe to distribute — that's a real constraint a tutorial project
never makes you deal with.

---

## PART 2 — ARCHITECTURE MAP

*This is the "know every detail" foundation — the actual shape of the
codebase, so you can navigate it live in an interview if asked to share
your screen.*

```
grimoire/
├── app/                          Expo Router screens (file-based routing)
│   ├── (tabs)/                   Home tab group
│   ├── creation/                 Character creation wizard (9 screens)
│   ├── sheet/[id].tsx            THE character sheet — 6-7 tabs, central hub
│   ├── dm/                       DM dashboard, encounter tracker, monster browser
│   ├── homebrew/                 Homebrew content builders (race/class/spell/feature/item)
│   ├── settings.tsx, about.tsx, backup.tsx, onboarding.tsx
│   └── _layout.tsx               Root layout — boot sequence, DB init, sync wiring
│
├── src/
│   ├── engine/                   Pure rules engine — NO React, NO UI, fully testable
│   │   ├── types.ts              The data model (Entity, Spell, Feat, etc.) — ~600 lines
│   │   ├── pipeline.ts           recomputeDerived() — the single source of truth for AC/HP/etc.
│   │   ├── combat.ts             applyDamage, applyHealing, death saves, Wild Shape
│   │   ├── leveling.ts           levelUp(), applyGrant(), resolveChoice()
│   │   ├── rest.ts               takeRest() — short/long rest resource restoration
│   │   ├── conditions.ts         Condition application, duration ticking
│   │   ├── dmOverride.ts         DM-only stat overrides (apply-on-top, non-destructive)
│   │   ├── houseRules.ts         The house-rules registry (toggleable table variants)
│   │   ├── actionCards.ts        Generates the "Use" cards from a character's features
│   │   ├── monsterFactory.ts     Builds Entity objects from monster stat blocks
│   │   ├── backup.ts             .grimoire-pack schema for export/import
│   │   └── ...
│   │
│   ├── content/                  All game content — spells, classes, items, etc.
│   │   ├── spells/                146 hand-authored + 487 auto-imported (generated.ts)
│   │   ├── items/                 85 hand-authored + 835 auto-imported (importedItems.ts)
│   │   ├── classes/, subclasses/, races/, backgrounds/, feats/, monsters/, beastforms/
│   │   └── builtinHomebrew.ts
│   │
│   ├── store/                    Zustand state stores
│   │   ├── characterStore.ts     Characters, drafts, rules — the main store
│   │   ├── homebrewStore.ts      Homebrew content (races/classes/items/spells/etc.)
│   │   ├── campaignStore.ts      Active campaign, DM/player role
│   │   └── sessionStore.ts       Device identity
│   │
│   ├── sync/                     LAN multiplayer — the part with no cloud equivalent
│   │   ├── server.ts             DM device: TCP server, relays entity updates
│   │   ├── client.ts             Player device: TCP client
│   │   └── syncManager.ts        Role-aware dispatch (syncEntity() picks the right transport)
│   │
│   ├── db/                       SQLite persistence (expo-sqlite)
│   │   ├── db.ts                 Schema + migrations
│   │   ├── characterRepo.ts, contentCacheRepo.ts, appMetaRepo.ts
│   │
│   ├── components/sheet/         The 7 sheet tabs (Character, Actions, Spells,
│   │                             Abilities, Features, Inventory, Notes) + shared modals
│   │
│   └── io/                       backupIO.ts — file export/import + share sheet
│
├── scripts/                      Node/Python content pipelines
│   ├── convert-spells.mjs        Vault markdown → generated.ts, with SRD classification
│   └── parse_items.py            Vault markdown → importedItems.ts, with SRD classification
│
└── docs/                         Planning documents (this file included)
    ├── ROADMAP_1.0.md            The living plan — what's done, what's next, why
    ├── PRIVACY_POLICY.md
    └── Future/                   Longer-range vision docs (multi-system, homebrew import)
```

### The one diagram worth being able to draw from memory

**How a single button tap becomes a persisted, synced change:**

```
User taps "Use" on an action card (e.g. Rage)
        │
        ▼
TabActions.tsx: handleUse()
        │
        ├─► spends the resource cost (rage_pool -1)
        ├─► applyAbilityEffects() — applies set_flag/transform effects
        │     (this function didn't exist until this session — see Part 4)
        ▼
onEntityUpdate(updatedEntity)
        │
        ▼
app/sheet/[id].tsx: mutate()
        │
        ├─► recomputeDerived(entity, rules)   [pipeline.ts]
        │     recalculates AC, HP, speed, senses, everything derived —
        │     NEVER stored directly, always recomputed from source data
        ▼
characterStore.ts: updateCharacter()
        │
        ├─► saveEntity() ─────────► SQLite (local persistence)
        └─► syncManager.syncEntity() ─────► LAN sync (see below)
```

**How sync actually works (no server, no account):**

```
DM's phone                              Player's phone
┌─────────────────┐                    ┌─────────────────┐
│  TCP Server      │◄──── WiFi LAN ────►│  TCP Client      │
│  (server.ts)     │   (no internet)    │  (client.ts)     │
└─────────────────┘                    └─────────────────┘
        │
        │ When DM edits a character:
        │   server.broadcastEntity() → sent to ALL connected players
        │
        │ When a PLAYER edits their own character:
        │   client sends {type:'entity_snapshot', entity} UP to the DM
        │   DM's server applies it locally AND relays to every OTHER
        │   player (excluding the sender) — so the whole table converges
        │   on the same state without any player talking to another
        │   player directly. The DM device is the hub.
```

---

## PART 3 — ARCHITECTURE & TECH STACK Q&A

### "Why React Native / Expo instead of a native app or a web app?"

Because the actual use case is a phone at a physical table, and it needs to
work identically on iOS and Android without maintaining two codebases. Expo
specifically (over bare React Native) buys managed native-module tooling —
`expo-sqlite`, `expo-file-system`, `expo-sharing`, `expo-document-picker`
all come with consistent cross-platform APIs and a sane build pipeline
(`expo prebuild`, EAS builds) instead of hand-rolling native linking. A web
app was never right for this because the core sync feature depends on raw
TCP sockets between devices on a LAN — that's not something a browser can
do; it needs a real native networking layer (`react-native-tcp-socket`).

### "Why Zustand instead of Redux?"

Scale-appropriate tooling. This app has ~5 stores (characters, homebrew,
campaign, session) with straightforward read/update patterns — no complex
cross-cutting middleware needs, no time-travel debugging requirement.
Zustand gives hooks-based selectors with zero boilerplate (`useCharacterStore(s
=> s.characters)`) instead of actions/reducers/dispatch ceremony. The one
sharp edge worth knowing cold: Zustand selectors that return a *new object
literal* every render (`useStore(s => ({a: s.a, b: s.b}))`) break React's
`useSyncExternalStore` and cause infinite render loops — every selector in
this codebase is deliberately a single primitive or a stable reference for
that reason.

### "Why SQLite instead of a cloud database?"

This is the actual architectural centerpiece of the app, not an
afterthought — it's a deliberate privacy-and-offline-first decision, not
"whatever Expo suggested." A cloud database (Firebase, Supabase, whatever)
would mean: a company sitting between the player and their own character
data, the app breaking if a venue has no signal, and the app needing an
account system for something that doesn't conceptually need one — a
character sheet is fundamentally *yours*, not a shared multi-tenant record.
`expo-sqlite` gives real relational storage, on-device, no network
dependency, with the LAN sync layer handling the *only* case where data
needs to leave one device (another device at the same table).

### "How does the frontend communicate with the backend?"

There isn't a traditional backend — this is worth stating plainly rather
than dodging. The three real "communication" layers are:
1. **UI → local state**: React components call store actions
   (`updateCharacter`), which mutate Zustand state synchronously.
2. **State → persistence**: every mutation writes to SQLite via a repo
   function (`saveEntity`), async, fire-and-forget with error logging.
3. **State → other devices**: the sync layer (`syncManager.syncEntity`)
   sends the updated entity over a raw TCP socket to the DM (if you're a
   player) or broadcasts it to all players (if you're the DM). JSON
   messages, no HTTP, no REST, no GraphQL — a persistent socket connection
   is a better fit than request/response for "keep 4 phones in sync live
   during a session."

### "Walk me through how you designed your database. Why did you structure it this way?"

The core `entities` table stores one row per character/monster, keyed by
`id`, and the character data itself is stored as a serialized JSON blob of
the `Entity` type rather than fully normalized into dozens of relational
tables. That's a deliberate tradeoff: `Entity` is a deeply nested,
evolving TypeScript type (stats, resources, conditions, inventory,
spellcasting, choices...) — fully normalizing it into relational tables
would mean a schema migration every time the type gains a field, which
happened constantly during development (death saves, Wild Shape state,
etc. were all *added* to the type mid-project). Storing it as JSON with
`id`/`updatedAt` as real indexed columns gets fast lookup and sync-ordering
without needing a migration for every shape change, while the TypeScript
type itself is the actual schema contract enforced at compile time.
Separately, `content_cache` stores homebrew content (races, items, spells
a player authored) and `app_meta` is a generic key-value table for flags
like `onboarding_complete` — reused rather than building bespoke tables for
every single boolean flag the app needs.

### "How does authentication or security work in your app?"

Honest answer: there's no traditional authentication, and that's
intentional, not a gap. There's no login because there's no account system
— a device *is* the identity (a locally-generated `deviceId`), and a
character belongs to whichever device created or claimed it. The "security"
model that actually matters here is closer to privacy engineering than
auth: no data leaves the device except over the LAN to other devices *at
the same table*, there's no third-party SDK, no analytics, no ad network —
all stated plainly in the privacy policy since Play Store submission
requires disclosing exactly this. If pushed on "what if someone spoofs a
LAN connection" — the sync protocol doesn't currently have message signing
or a shared secret beyond the room code used to establish the connection,
which is an honest, real limitation worth naming rather than overselling
in an interview (this app's threat model is "people at your own table,"
not "hostile network").

---

## PART 4 — PROBLEM-SOLVING & CHALLENGES (real stories)

### "What was the hardest bug you faced, and how did you debug it?"

**The Rage bug — a whole category of game mechanics silently doing
nothing.** While building Wild Shape (a Druid ability to transform into an
animal), I needed a general mechanism for "apply this ability's effects to
the character when they tap Use" — beyond just spending a resource. Going
to wire that up, I discovered the function that handles tapping "Use" on
any action card (`handleUse` in `TabActions.tsx`) only ever spent the
resource cost. It never actually processed the ability's effects array at
all. That meant **Rage** — a core, already-shipped Barbarian feature — had
been spending its resource and displaying correctly on the card the whole
time, but the actual `set_flag: rage_active` that its damage-resistance
effect depends on had *never fired*. The feature looked completely
functional (card renders, button works, resource depletes) while doing
nothing mechanically.

How I found it: by tracing the *actual* code path an ability's effects
would need to take to reach the entity, rather than trusting that "the card
displays correctly" meant "the mechanic works." The fix was a new
`applyAbilityEffects()` function, wired into the same `handleUse` handler,
that actually processes `set_flag` and (the new) `transform` effect types
— which fixed Rage as a side effect of building Wild Shape properly instead
of building Wild Shape on top of the same silent gap.

**The lesson worth stating in an interview**: a feature that displays
correctly and consumes its resource correctly can still be doing nothing —
UI-level testing isn't the same as verifying the actual state mutation
happened. I only found it because I was building something new that forced
me to trace the full path, not because I was specifically testing Rage.

### "Tell me about a time you hit a roadblock. How did you pivot?"

**The SRD legal-content audit.** D&D's actual rules text is licensed under
Wizards of the Coast's System Reference Document (SRD) — some content is
free to redistribute under CC-BY, most isn't. Early in the audit I built a
classifier assuming a "generous inclusion" pattern (based on what I found
true for spells, classes, and races — the SRD includes almost the full
roster for those categories). I applied that same assumption to feats and
backgrounds. It was **wrong** — a live check against the actual SRD text
showed feats only include one sample feat (Grappler) and backgrounds only
include one sample background (Acolyte), not the full standard rosters I'd
assumed. The pivot: instead of trusting the pattern that had worked for
three categories in a row, I went back and did direct verification against
the primary source for every remaining category, and found the actual
inclusion rule varies by content type (comprehensive for some, a single
worked example for others) rather than following one universal rule. The
broader lesson: a pattern holding three times in a row is evidence, not
proof — worth checking the fourth and fifth time rather than extrapolating.

### "What's a technical compromise or 'hack' you had to use, and why?"

A few honest ones, stated plainly rather than hidden:

- **Wild Shape duration** is supposed to be tracked in hours and expire
  automatically. The app has no hour-by-hour game clock anywhere else, and
  building one just for this one feature would have been real scope creep.
  The compromise: Wild Shape auto-reverts on any rest instead, since a rest
  represents "enough time has passed" in virtually every real case. It's
  documented in the code as an approximation, not silently passed off as
  exact rules tracking.
- **Wild Shape beast selection** is one action card per beast form (Wild
  Shape: Wolf / Giant Spider / Brown Bear) rather than a single ability
  with a form-picker UI. The underlying effect type only supports a single
  fixed target, and building a picker UI for a v1 feature with exactly 3
  curated forms wasn't worth the added complexity — it reuses the existing
  "one card per ability" system instead of inventing a new UI pattern.
- **Item data collision handling**: the item catalog is 85 hand-authored
  items (mechanically correct, e.g. real AC formulas) plus 835
  auto-imported items (generated from a personal notes vault, mostly
  correct but with occasional formatting quirks). Rather than trying to
  reconcile them, hand-authored items simply win on id collision — a
  pragmatic "trust the more carefully-made version" rule instead of a
  complex merge strategy.

---

## PART 5 — OWNERSHIP & COLLABORATION

### "What was your exact role and what did you personally implement?"

This is worth answering honestly rather than either overclaiming solo
authorship or underselling the real skill involved — both read badly to an
experienced interviewer. The accurate framing: **this was built with
heavy AI pair-programming (Claude, via Anthropic's tools), directed and
verified by you.** That's an increasingly normal and expected way to build
software in 2026, and the actual skill it demonstrates is different from
"typed every line by hand" — worth naming clearly:

- **You made every real architectural and product decision** — local-first
  over cloud, no accounts, LAN sync over remote play, which features ship
  in 1.0 vs. get deferred, the entire roadmap sequencing.
- **You provided the domain expertise the AI didn't have** — D&D rules
  knowledge deep enough to catch real errors, including specifically
  correcting incorrect SRD-licensing assumptions (Cause Fear, Arms of
  Hadar, Path of the Totem Warrior, and several magic items) by checking
  primary sources yourself rather than trusting the AI's classification.
  That's a genuinely load-bearing contribution — the entire legal-audit
  system only works because you verified it against ground truth instead
  of accepting a plausible-sounding answer.
- **You did the QA and pushed back** — asking "does the DM's edit actually
  reach the player's device" surfaced a real, previously-undiscovered sync
  bug. Asking "what actually influences stats" surfaced the Rage bug. Those
  weren't things the AI proactively found; they came from your questions.
- **You set the standard the whole project holds itself to** — "no fake
  functionality" as an explicit, repeatedly-enforced value (reminder-only
  mechanics get labeled as such, not silently passed off as working)
  is a product-quality decision you made and maintained throughout.

If asked directly "did you write the code yourself" — the honest,
confident answer is: "I directed an AI collaborator through the
implementation, reviewed and tested everything it produced, caught and
corrected several of its mistakes with my own domain knowledge, and made
every architectural and scope decision." That's true, it's a real and
valuable skill set, and it holds up to follow-up questions far better than
a claim that doesn't.

### "Did you build this from scratch, or use starter code/templates?"

From scratch on top of standard tooling — `npx create-expo-app` as the
initial scaffold (routing, build config), but the entire rules engine,
data model, sync protocol, content pipeline, and every screen were built
for this project specifically. No character-sheet template, no D&D-app
boilerplate existed to start from.

---

## PART 6 — SCALABILITY & FUTURE SCOPE

### "If 10,000 users logged on right now, what would break first?"

Worth answering by first correctly reframing the question, since it
doesn't map directly onto this architecture — and pointing that out is
itself the strong answer, not a dodge. There's no central server for
10,000 concurrent users to hit; each device is independent and only
talks to a handful of other devices at its own table over LAN. The
actual scaling question that *does* apply is per-campaign, not
global: **how many players can one DM's phone handle as the sync hub?**
The DM device runs a TCP server on a phone's CPU/battery/network stack —
that would degrade well before 10,000 of anything; realistically a home
WiFi router and a phone acting as a server starts to strain somewhere in
the dozens of concurrent connections, far above any real D&D table size
(typically 3-6 players), so it's not a practical concern for the actual
use case, but it IS the honest answer to "what's the real scaling limit
here." The other real scaling question is content-database size — the
item catalog is already 920 items and the spell catalog 633; if that
grew 10x, the unvirtualized list screens I fixed this session
(`AddSpellModal`, converted from `ScrollView` to `SectionList`) would be
exactly the pattern that starts to matter, since `ScrollView` renders
every child eagerly regardless of scroll position.

### "If you had another month, what would you add or refactor?"

Real, currently-tracked items, not a hypothetical list:

- **Wire the remaining `abilityEffects` types** the Rage-bug fix
  didn't cover yet — `apply_condition`, `grant_speed`, `restore_resource`.
  Same category of fix, larger scope.
- **Wire generic magic item bonuses.** Right now equipping a Ring of
  Protection doesn't change your AC — the auto-imported item catalog
  (835 items from free-text descriptions) only generates real mechanical
  effects for weapons with damage dice; everything else is description-
  only. The fix is a curated override layer for the well-known magic
  items, not a full NLP parse of every description.
- **Subclass choice wiring** — things like a Barbarian's Totem Warrior
  totem-animal pick exist as pending choices in the data model but
  aren't yet surfaced as an interactive UI flow.
- **Refactor**: extend the SRD-legal audit's final verification pass —
  the classification work is done and self-documents its own confidence
  level (flagged `NEEDS VERIFICATION` comments throughout), but a full
  cross-check against the primary SRD text for every remaining flagged
  item is still open before a public release should ship.

### "How would you optimize performance?"

The concrete, already-applied example: `AddSpellModal` (the in-app spell
browser) used to render the *entire* spell corpus — 600+ spells across
official and homebrew content — inside a plain `ScrollView.map()`, which
renders every child eagerly regardless of what's actually visible on
screen. Converted to `SectionList` (React Native's virtualized list
component, chosen over flat `FlatList` because the data is naturally
grouped by spell level with section headers, which `SectionList` supports
natively) — it now only renders visible rows plus a small buffer, the
standard fix for "any list that could exceed roughly 50-100 items."
The broader principle, worth stating generally: `ScrollView` is fine for
bounded, small content (a character's known spells, rarely more than
30-40); anything that renders an unbounded or large content catalog needs
a virtualized list, and it's worth auditing every list in an app
specifically for "is this bounded by user data, or by the size of the
content database" — the two have very different growth characteristics.

---

## A note on how to actually use this document

Read this once fully, then before an interview, re-read Part 4 (the real
bug stories) and Part 5 (ownership framing) most closely — those are the
questions that separate "built something" from "understands what they
built," and they're the ones worth being able to tell fluently without
notes. Everything else you can reconstruct live if you understand the
architecture map in Part 2.
