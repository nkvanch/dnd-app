# Grimoire — Roadmap

Sequenced priorities for development. Each item is either done, in progress,
or explicitly deferred with a reason. Items are grouped by the question
"what makes the biggest difference to someone using this at their table?"

Read PRODUCT_PRINCIPLES.md for the philosophy, UI_RULES.md for UI constraints,
ARCHITECTURE.md for the technical design, IMPLEMENTATION.md for schemas.

---

## 📍 Status Tracker — read this first

**You are here:** All 8 pre-release priorities are done. 🎉

| #   | Item                                                            | Status         | Notes                                                                                                                                                                                                                                                                                                                                                                                                                         |
| --- | --------------------------------------------------------------- | -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Character header — HP/AC/Speed always visible                   | ✅ Done         | Already in `app/sheet/[id].tsx` header (`statPills`)                                                                                                                                                                                                                                                                                                                                                                          |
| 2   | Class change warning (Q29)                                      | ✅ Done         | Custom dark/gold modal in `class-detail.tsx` (restyled 2026-06-14; was a native `Alert`)                                                                                                                                                                                                                                                                                                                                      |
| 3   | Settings screen                                                 | ✅ Done         | `app/settings.tsx` — HP mode, level cap, feats/multiclass/XP toggles, ability score cap                                                                                                                                                                                                                                                                                                                                       |
| 4a  | Wire homebrew into creation (races/spells/backgrounds/features) | ✅ Done         | All four wired via `useHomebrewStore`: races (`race.tsx`/`race-detail.tsx`), spells (`spells.tsx`, tagged + override official by id), backgrounds (`background.tsx`, generalized skill-proficiency marking from feature effects), features (`AsiFeatPicker.tsx` — homebrew Features reshaped to `Feat` and merged into the Feat picker, used by both creation and in-play level-up). Classes intentionally excluded — see 4b. |
| 4b  | Homebrew classes/subclasses (full progression authoring)        | ✅ Phase 2 done | Phase 1: stub progression (HP/ASI). Phase 2: full authoring — saving throws, armor/weapon profs, spellcasting (ability + slot table + start level), per-level features, custom ASI levels. Engine: `spell_slots` grant now accepts inline `slotsTable`.                                                                                                                                                                       |
| 5   | Spellbook tab                                                   | ✅ Done         | Seventh sheet tab (`TabSpells.tsx`), conditional on `entity.spellcasting` non-null. Tab bar made scrollable (`ScrollView` horizontal) to accommodate 7 tabs for spellcasters. Shares `UseModal` + slot-spend logic with TabActions — no parallel cast implementation. Prepared-caster toggle (Wizard/Cleric/Druid/Paladin) wired to `entity.spellcasting.prepared`.                                                           |
| 6   | Plain-language audit view                                       | ✅ Done         | Plain/Technical toggle in `AuditModal.tsx`. Plain view builds a single readable sentence from the existing `AuditEntry` list: "17 = 10 base + 3 DEX modifier + 2 Chain Shirt". Technical view unchanged. No engine changes.                                                                                                                                                                                                   |
| 7   | Campaign overview screen                                        | ✅ Done         | `campaigns.tsx` expanded: Notes (editable for DM, read-only for player), Quest tracker (add/cycle status Active→Done→Failed/delete), Session log (DM adds timestamped entries, newest-first, collapsible), Party (HP bar per character). `Campaign` type gained optional `sessionLog` and `quests` fields.                                                                                                                    |
| 8   | Home screen campaign state                                      | ✅ Done          | `index.tsx` replaced the hardcoded stub with `ActiveCampaignCard`: no-campaign shows stub unchanged; between-sessions shows name, active quest/party pills, last session snippet; live shows green LIVE badge, player count, DM Dashboard shortcut. Quick Actions swaps "Join" for "Open Campaign" when a campaign is active. |

**All 8 pre-release priorities are complete.** 🎉 See "After release" section for the post-launch backlog.

### Recent session log
*(most recent first — one entry per session, updated whenever a change lands)*

- **2026-06-18 (3):** Three fixes + inline homebrew creation in the wizard.
  **Fix 1 — Abyss Knight/Skeleton not showing:** The seed flag
  `builtin_homebrew_seeded_v1` was set in a prior session before
  `builtinHomebrew.ts` existed on the real machine, causing `seedBuiltinHomebrew`
  to return early without seeding. Bumped to `builtin_homebrew_seeded_v2` to
  force a fresh seed on next launch. **Fix 2 — spellcasting abilities:**
  `class-builder.tsx` `SPELL_ABILITIES` expanded from `['int','wis','cha']` to
  all six abilities, supporting STR/DEX/CON-based casters (e.g. some homebrew
  variants). **Fix 3 — dead code cleanup:** Removed `abyss_knight` from
  `CASTER_TYPE` and `CLASS_DESCRIPTIONS` in `class.tsx` (now homebrew-only);
  removed the broken "New Background" button from the homebrew CreatePanel
  (it incorrectly routed to `race-builder`). **Inline homebrew creation:**
  Class and race pickers gained a persistent `+ Create new` chip alongside the
  `HOMEBREW [TYPE]` section header — always visible, not only when the list is
  empty. Spells screen gained a `+ Create new homebrew spell` link near the
  search bar. Background picker got the same header layout; its button routes to
  the Homebrew tab (no dedicated background builder exists yet — noted as a gap).
  The builders are already wired to call `router.back()` after saving and update
  `homebrewStore` in-memory, so returning to the picker immediately shows the
  new item. Not yet verified with `npx tsc --noEmit`.

- **2026-06-18 (2):** Built-in homebrew migration — Abyss Knight + Skeleton.
  of official content into the seeded homebrew store so they exercise the real
  homebrew pipeline (the stated goal: find bugs in active use). **Type:** `CharClass`
  gained `rawProgression?: ClassProgression` — an escape hatch for hand-authored
  classes too complex for the simplified builder fields (Abyss Knight has a baked
  Oozing Knight subclass, level-2 known-spell grants, a custom slot table, and
  per-level effect-bearing features). Both `buildProgressionFromClass` and
  `getProgressionForClass` return `cls.rawProgression` verbatim when present.
  **Seed:** `src/content/builtinHomebrew.ts` defines `abyssKnightClass` (carrying
  `rawProgression: abyssKnightProgression` + `savingThrows: ['str','con']`) and
  re-exports `raceSkeleton`; `BUILTIN_HOMEBREW_SEED` is the [type,item] list.
  `src/db/appMetaRepo.ts` (`getMeta`/`setMeta`) + the `app_meta` table back a
  one-time `builtin_homebrew_seeded_v1` flag. `homebrewStore.seedBuiltinHomebrew()`
  loops the seed list calling `saveHomebrewContent`, guarded by the flag, and
  `_layout.tsx` calls it BEFORE `loadHomebrew` so the rows load on the same launch.
  **Removal:** `abyss_knight` is gone from `ALL_CLASS_PROGRESSIONS` + `ALL_CHAR_CLASSES`
  and the import in `classes/index.ts`; `raceSkeleton` is gone from `ALL_RACES`. Both
  underlying `export const`s (the progression file, the race definition) REMAIN so
  `builtinHomebrew.ts` can import them — they're just no longer registered as official.
  Net effect: both appear ONLY under the Homebrew sections, are deletable (the flag
  keeps a deleted entry gone), and round-trip faithfully through select → play →
  delete. **Storage reality confirmed:** `contentCacheRepo` stores `JSON.stringify`
  of any shape, so `rawProgression` persists through SQLite fine. **The edit-path
  finding (the real value of this test):** the homebrew builders (`class-builder.tsx`,
  `race-builder.tsx`) are CREATE-ONLY — there is no edit-load path, and the Library
  panel only offers delete. So the flatten-on-edit risk is currently UNREACHABLE.
  When an edit feature is built later, it MUST add a flatten warning: editing
  Abyss Knight in the simplified class-builder would drop `rawProgression` (losing
  the subclass, known spells, custom slots), and editing Skeleton in the race-builder
  would drop its resistances, poison immunity, and Giant subrace (the builder only
  authors ASI + speed + darkvision + one free-text trait). The `Race` type needs no
  extension (it already holds everything); only the builder UI is the limiter.
  Not yet verified with `npx tsc --noEmit`. **Next:** inline homebrew creation in
  the wizard (a "+ Create new" affordance in each picker that opens the builder and
  returns with the new item selectable).

- **2026-06-18:** Sync fixes (C1 + C2 + DM-taps-player). **C1 — reconnect double-count
  bug:** `syncManager` kept its own `_clientCount` that blindly incremented on every
  `onClientJoined`, so a player who dropped and rejoined inflated the count. Replaced
  it with `this.server.clientCount` (the actual `Map.size`), which is authoritative.
  Also made the server's socket `close` handler reconnect-safe: it now only evicts a
  roster entry if the closing socket is still the *current* socket for that deviceId,
  so a late 'close' from a dead socket can't remove a player who already reconnected.
  The `hello` handler destroys any lingering prior socket for the same deviceId.
  **C2 — player identity:** the `hello` message now carries `characterId`; added a
  `claim_character` message and a `ConnectedPlayer` roster type (deviceId, nickname,
  characterId). The server tracks the roster and fires `onRosterChanged`; `SyncStatus`
  gained a `roster` field. Players can now push their own entity up to the DM — added
  an inbound `entity_snapshot` handler on the server (applies locally via new
  `onEntityReceived` callback + relays to other players) and a `pushEntity()` /
  `claimCharacter()` pair on the client + manager. **UI:** the DM Dashboard gained a
  "Connected Players" section showing each live player, which character they're
  controlling, and a tap-through to that character's sheet (`/dm/character/[id]`).
  The player's campaign view gained a "Your Character" picker that assigns the
  character to the campaign, pushes it to the DM, and claims it on the roster.
  Not yet verified with `npx tsc --noEmit`. **Next:** homebrew migration (Abyss
  Knight + Skeleton into the homebrew store) + inline homebrew creation in the wizard.

- **2026-06-17 (4):** #8 Home screen campaign state shipped. `index.tsx` imported
  `useCampaignStore` and `useSyncStore` and replaced the hardcoded stub with
  `ActiveCampaignCard`, a component rendering one of three states: no campaign
  (stub unchanged); between-sessions (gold-bordered card: campaign name, active
  quest count + party size as small pills, last session log entry as a gold
  left-bordered snippet, "Tap to open" hint); live (green border + ● LIVE badge,
  player count or "Connected to DM", DM Dashboard shortcut for DM only, Open
  Campaign secondary button). The Quick Actions row conditionally swaps "Join
  Campaign" for "Open Campaign" (→ campaigns tab) when a campaign is active.
  `loadCampaigns()` called on mount so the state is always fresh on tab focus.
  With this, all 8 pre-release priorities are complete.

- **2026-06-17 (3):** #7 Campaign overview screen shipped. `Campaign` type in
  `types.ts` gained two optional fields: `sessionLog: SessionLogEntry[]` (id,
  summary, date) and `quests: Quest[]` (id, name, description, status). All
  existing `Campaign` objects remain valid. `campaigns.tsx` was rewritten to
  expand the DM and Player active views from near-empty stubs into a proper
  between-sessions surface. Both views share four section components:
  `NotesSection` (editable `TextInput` for DM, read-only text for player; saves
  on blur to the existing `Campaign.notes` field), `QuestsSection` (add via modal,
  tap ↻ to cycle Active→Completed→Failed, tap ✕ to delete with confirmation;
  status shown as a colored chip — green/gold/red), `SessionLogSection` (DM adds
  timestamped entries via modal; entries listed newest-first; collapses to 3
  with "Show N more" link; DM can delete entries), `PartySection` (character
  name + class + level + HP bar). The DM view also keeps the connection block
  (room code, QR, DM Dashboard button) at the top; player view gets a clean
  status block instead. `updateCampaign` in the campaign store already handles
  arbitrary field patches so no store changes were needed. Not yet verified with
  `npx tsc --noEmit`.

- **2026-06-17 (2):** #6 Plain-language audit view shipped. `AuditModal.tsx` gained
  a Plain/Technical segment control toggle (pill-style, defaults to Technical to not
  surprise existing users). Plain mode calls `buildPlainSentence(total, entries)` which
  filters out zero-value entries, signs all contributors after the first (first has no
  prefix, subsequent get `+` or `−`), and produces e.g. "17 = 10 base armor  + 3 DEX
  modifier  + 2 Chain Shirt  + 2 Shield". The only engine-side change was importing
  `AuditEntry` in the modal (it was already exported from `types.ts`). The technical
  breakdown view is unchanged. The modal's `scroll` max-height was trimmed from 280 to
  240px to keep the layout stable with the extra toggle row. No `npx tsc` run yet.

- **2026-06-17:** #4b Phase 2 shipped. **Type layer:** `CharClass` extended with
  eight optional Phase 2 fields: `savingThrows`, `armorProfs`, `weaponProfs`,
  `spellcastingAbility`, `spellcastingStyle` (`'full'|'half'|'pact'`),
  `spellcastingStartLevel`, `asiLevels`, and `levelFeatures`. All old `CharClass`
  objects remain valid. **Engine:** `applyGrant` for `spell_slots` now accepts
  `slotsTable` embedded in the grant value; homebrew classes embed the relevant
  `SpellSlotRow[]` directly so the engine doesn't need a `SLOT_TABLES` entry for
  every homebrew classId — official classes are unaffected (no `slotsTable` in their
  grants, falls through to classId lookup as before). **Progression builder:**
  `buildStubProgression` replaced by `buildProgressionFromClass` (old name kept as
  alias) which reads all Phase 2 fields to emit real `proficiency`,
  `init_spellcasting`, `spell_slots`, and `feature` grants level by level; Phase 1
  behavior fully preserved for old homebrew classes. **Class detail:** homebrew
  fallback display now shows saving throws, proficiencies, and spellcasting from the
  `CharClass` fields; the "not configured yet" note only shows for unset fields;
  `doSelect()` applies `cls.savingThrows` to the proficiency block. **Class builder
  UI** (`class-builder.tsx`): complete rewrite into a 6-section authoring flow —
  Basics, Saving Throws (6 ability toggles), Starting Proficiencies (armor + weapon),
  Spellcasting (toggle + ability + Full/Half/Pact + start level), Per-Level Features
  ("+Add Feature" bottom sheet: level 1–20, name, description; listed by level with
  delete), ASI Levels (1–20 grid, toggleable, defaults pre-populated in gold).
  Not yet verified with `npx tsc --noEmit`.

- **2026-06-16:** #5 Spellbook tab shipped. `src/components/sheet/TabSpells.tsx` is a new
  seventh sheet tab, inserted after Actions and **conditional** on `entity.spellcasting`
  being non-null — non-spellcasters (Fighter, Barbarian, etc.) see only 6 tabs unchanged.
  For spellcasters the tab bar grows to 7; to keep it usable I converted it from a `View`
  with `flex:1` tabs to a horizontal `ScrollView` with `contentContainerStyle.minWidth:'100%'`
  and a computed `minWidth` per tab so 6 tabs still fill the screen and 7 tabs can scroll.
  **Cast flow:** `UseModal` and its `UseModalProps` type are now exported from `TabActions`;
  `TabSpells` imports them and uses the same slot-decrement code path — one implementation,
  two entry points, per the roadmap principle. **Spell display:** groups action cards by
  `card.resourceCost?.spellSlotTier ?? 0` (level 0 = cantrips). Each level section header
  shows a live slot count badge (blue, greyed when empty). Each spell row shows name,
  Concentration + Ritual tags, school and casting time; tapping expands range, duration,
  components, layer2/layer3 effect summary, full description, and At Higher Levels.
  **Prepared casters** (Wizard/Cleric/Druid/Paladin): a ✓/○ toggle button per leveled spell
  adds/removes from `entity.spellcasting.prepared`, persisted via `onEntityUpdate`.
  **Spell lookup:** merges `ALL_VAULT_SPELLS` + hand-authored corpus + homebrew for
  description expansion — vault spells not in the hand-authored set still show their
  action-card layer2/layer3 summary. Also: renamed 'Inventory' tab label to 'Items' in the
  base tab list (saves space in 7-tab view). `npx tsc --noEmit` not yet verified for this batch.

- **2026-06-15 (4):** 4B Phase 1 shipped — homebrew classes are now selectable,
  levelable, and non-crashing, via a generated "stub progression" rather than the
  full level-by-level editor (Phase 2, separate project). **Root cause** was:
  `class-builder.tsx` only ever saved `CharClass{id,name,hitDie,features:[]}`
  (description was collected but discarded — now fixed); `class.tsx`/`class-detail.tsx`
  only read `globalContentDB.classes` (homebrew excluded, per 4a); and
  `class-detail.tsx`'s `selectClass()` did `const progression = PROGRESSIONS[cls.id]`
  then `if (progression) levelUp(...)` — for homebrew this silently skipped
  `levelUp`, leaving the character permanently at level 0/0 HP (no crash, but
  completely unplayable); `TabCharacter.tsx`'s in-play Level Up button used
  `if (!progression) return null`, hiding the button entirely for homebrew classes.
  **Fix:** `src/content/classes/progressions.ts` gains `buildStubProgression(cls)`
  (20 levels, `hpDie: cls.hitDie`, level-1 grants from `cls.features`, ASI choices at
  4/8/12/16/19) and `getProgressionForClass(cls)` (`ALL_PROGRESSIONS[cls.id] ??
  buildStubProgression(cls)` — never null). `class.tsx`/`class-detail.tsx`/
  `TabCharacter.tsx` now merge `useHomebrewStore().classes` (with a "Homebrew"
  tag/section, mirroring 4a's race/background/spell pattern) and call
  `getProgressionForClass` unconditionally. `class-detail.tsx` shows a fallback view
  for classes with no `CLASS_DETAIL` entry: description, hit die, a features list,
  and an info note that saving throws/proficiencies/spellcasting aren't generated
  yet. `CharClass` gained an optional `description?: string`; `class-builder.tsx`
  now actually saves it (previously collected and silently dropped) and its info
  card describes Phase 1 accurately instead of claiming a level-by-level editor that
  doesn't exist. Not yet verified with `npx tsc --noEmit`.

- **2026-06-15 (3):** Added a ⚙️ settings button to the "Character Basics" screen
  (`app/creation/name.tsx`, header row, navigates to `/settings`) — campaign rules
  are now reachable from the start of creation, not just the Characters tab. In
  `app/settings.tsx`, added an "Uncapped" chip to both **Maximum Level** (sets
  `rules.maxLevel = null`) and **Ability Score Maximum** (sets
  `rules.maxAbilityScore = null`), with hint text explaining each. Also fixed the
  pre-existing chip layout bug where each chip was individually wrapped in
  `chipRow` (forcing one chip per visual row) — all chips in a section now share
  one wrapping row. Engine-side: `rules.maxAbilityScore ?? 20` (3 call sites —
  `reapplyResolvedAsi`, `applyAsiToEntity` in `leveling.ts`, and `AsiFeatPicker.tsx`)
  changed to `?? Infinity`, since `null` now means "no cap" and the old fallback
  would have silently re-capped "Uncapped" at 20. `rules.maxLevel`'s one consumer
  (`TabCharacter.tsx`'s Level Up button gate, `rules.maxLevel ?? 20`) needed **no**
  change — 20 is both "no DM-imposed cap" and the engine's hard ceiling (every
  class progression, including Abyss Knight, defines levels 1–20 and no further),
  so `null ?? 20` already resolves correctly.

- **2026-06-15 (2):** #4a completed — the remaining three categories (spells,
  backgrounds, features) are now wired into creation, following the races pattern
  from earlier today. **Spells** (`spells.tsx`): homebrew spells merged into
  `allSpells` (override official-by-id), tagged with a gold "Homebrew" pill in
  `SpellRow`, flows through both the content-based picker and any future
  ChoiceDefinition-based spell choices. **Backgrounds** (`background.tsx`): list
  screen merges `useHomebrewStore().backgrounds` into a "Homebrew" section (tag, or
  "create one" → `/homebrew` if empty); detail screen resolves homebrew backgrounds
  and renders a generic Features list + "Homebrew" tag when there's no `BG_DETAIL`
  entry. Generalized the skill-proficiency-marking logic in `selectBackground()`:
  in addition to the hardcoded `BG_DETAIL`-driven pass (kept for PHB, now redundant
  but harmless), a new pass scans every background feature's `effects` for
  `grant_proficiency` on `skill:*` and marks those trained — this is what makes
  homebrew backgrounds grant proficiencies correctly with no per-background data
  entry needed. **Features** (`AsiFeatPicker.tsx`): homebrew "Features" (built in
  the Feature Editor, authored with `source:{kind:'feat',refId:id}` — i.e. already
  shaped as standalone feats) are reshaped to `Feat` and merged into the Feat-mode
  list, search, dedup (`takenFeatIds` already matches on `source.refId`), and apply
  path (`applyFeatToEntity`) alongside the 82 official feats, tagged "Homebrew" in
  gold. Since `AsiFeatPicker` is shared, this also reaches in-play level-up, not
  just creation. **Flagged, not fixed:** Homebrew tab's "New Background" button
  routes to `/homebrew/race-builder`, which saves a `Race` — homebrew backgrounds
  have no real authoring path yet (only via the import pipeline). #4a is now fully
  ✅ for Part A; #4b (homebrew classes) remains its own project. Not yet verified
  with `npx tsc --noEmit`.

- **2026-06-15:** #4a (races) shipped — `race.tsx` and `race-detail.tsx` now merge
  `useHomebrewStore` races into the creation picker with a "Homebrew" section/tag,
  replacing the dead placeholder row. Separately, authored a full official-pattern
  content package for the user's real level-2 campaign character: **Skeleton race**
  with a **Giant** lineage (Large size, Undead traits — darkvision, necrotic/poison
  resistance, poisoned immunity, Doomed Touch chill touch, Restoring Limbs), a new
  **Abyss Knight** class (`src/content/classes/abyssKnight.ts`, d10, CHA pact-magic-
  style spellcasting from level 2) with the **Oozing Knight** Demonic Patron baked in
  as `source.kind:'subclass'` features (L1 tiny-space movement/no food/acid option +
  Indiscernible Anatomy, L6 Pseudopods, L10 Amorphous incl. acid resistance, L14
  Consume), and three custom items (Greatsword of Life Drinking 2d8 w/ life-steal
  reminder text, Cast-Off Breastplate, Rope of Mending). Added two missing SRD spells
  (Arms of Hadar, Hellish Rebuke) to `level1.ts`. Added a small additive engine
  feature: a new `known_spells` grant kind (`types.ts` + `leveling.ts`) so a class/
  race can grant fixed known spells — used for Abyss Knight's level-2 spells, and
  generally useful for the "spell selection on level-up" gap. Added `ABYSS_KNIGHT_SLOTS`
  to `spellSlotTables.ts` and a `CLASS_DETAIL['abyss_knight']` entry in
  `class-detail.tsx` (without it, saving-throw proficiencies wouldn't have been set
  at all). Granted heavy armor proficiency directly in the class's base proficiencies
  to cover the practical effect of the "Heavily Armored" feat, since no ASI/feat slot
  exists before level 4. Not yet verified with `npx tsc --noEmit` or in-app creation.

- **2026-06-14:** Death Saves redesigned to match Hit Dice (manual Success/Failure
  buttons + Roll, inline result text, no native dialogs). Fixed a JSX nesting bug in
  `TabCharacter.tsx` that had swallowed the Conditions section into Hit Dice. Removed
  Level Up's inline Yes/Cancel confirm — it's a single immediate tap now, consistent
  with the "no secondary confirmations on the sheet" rule. Restyled `class-detail.tsx`'s
  native "Change Class?" `Alert` into a custom dark/gold modal. Fixed `contentCacheRepo.ts`
  missing `Platform.OS === 'web'` guards (was throwing "SQLite is not available on web"
  on every homebrew load). Fixed the Skills screen being permanently read-only after
  the first confirmation — added a "Change Skills" re-edit flow. Verified #1–#3 above
  are already complete; confirmed #4a is not started.

---

## Current state (what works today)

- Character creation wizard (13 classes incl. Abyss Knight, 10 races incl. Skeleton, 13 backgrounds)
- Live character sheet (6 tabs, rest bar, conditions, spell slots, hit dice)
- Rules engine: effects, pipeline, audit trail, action cards
- 82 feats with ASI/feat picker (creation + in-play level-up)
- 489 class-tagged spells wired into class-filtered creation picker
- All 15 PHB conditions authored as content; 5 auto-enforce speed=0 in engine
- Proficiency, speed, and subclass_unlock grants implemented
- Medium armor DEX cap (+2) enforced
- Armor features hydrated at load time (AC survives app restart)
- DM dashboard (party view, encounter, monsters)
- Homebrew builders (spell, race, feature, class scaffold)
- Local WiFi sync (TCP, NDJSON, event-sourced, not yet tested two-device)
- SQLite persistence, offline-first

---

## Pre-release priorities (in order)

### 1. Character header — HP and AC always visible
**Size:** hours.
**Impact:** every player at every session.

The most-used values are not in the most-visible place.
Move HP + AC + Speed into the persistent sheet header.
No engineering work — purely moving UI elements.
Do this before anything else because it affects everyone immediately.

### 2. Class change warning (Q29 from spec)
**Size:** small — one confirmation modal.
**Impact:** prevents silent data loss; required by design spec.

Currently `clearClassData` executes immediately with no warning. The spec (Q29)
requires the app to list exactly what will be lost before proceeding:
- Features that will be removed (count + names)
- Choices that will be dropped (skill picks, equipment picks, resolved ASIs)
- That HP will be recalculated from the new class's hit die
- That spellcasting resets if switching between caster and non-caster

This is a confirmation modal in `class-detail.tsx` before `handleConfirm` fires.
Small to build, high trust value — players currently have no idea what changing
class does until it is already done.

### 3. Settings screen
**Size:** small.
**Impact:** philosophical requirement.

The vision is "the app adapts to your table." Without configurable rules,
the app imposes its defaults on every table. Settings must expose at minimum:
- Level cap (default 20)
- HP mode: fixed (class max), rolled, average
- Multiclassing on/off
- Feat option on/off
- XP vs milestone leveling

These already exist in CampaignRules in the engine. The work is surfacing them
in a UI and connecting them to the active rules object.

### 4. Wire homebrew into character creation
**Size:** medium (see split below).
**Impact:** closes the core differentiator gap.

Today homebrew follows this path:
  Create → Saved → Dead end

It should follow:
  Create → Saved → Available in creation → Appears on sheet → Works in campaign

**Part A (do first — one sprint):**
Wire homebrew races, spells, backgrounds, and features into the creation wizard.
These already have the right shape (they're Feature/Effect data).
The creation wizard reads from globalContentDB; add homebrew items into that merge.
Custom race appears in the race picker. Custom spell appears in spell selection.
This closes the loop for the most common homebrew use cases.

**Part B (separate project — larger):**
Homebrew classes and subclasses.
A class is not just data — it's a level-1-to-20 progression with choices, grants,
spellcasting init, resource scaling, and ASIs. The class builder currently produces
a scaffold. Turning that into a real playable class requires designing an authoring
surface for progressions.
Do not block Part A on Part B.

**Update (2026-06-15):** Part B Phase 1 is done — `getProgressionForClass()` generates
a stub progression (HP by hit die, ASI at 4/8/12/16/19, level-1 features from the
class's own `features[]`) for any homebrew class with no authored progression, so
saving a class in the builder makes it immediately selectable and levelable with no
crashes or dead ends. Phase 2 — a real level-by-level editor (saving throws,
proficiencies, spellcasting, per-level features, subclasses) replacing the stub —
remains the larger, separate project described above.

### 5. Spellbook tab
**Size:** medium.
**Impact:** every spellcasting player session.

Add a seventh in-page sheet tab: **Spells**.
This tab only renders for characters with a spellcasting class.
(Barbarians and Fighters do not see an empty Spells tab.)

The Spells tab must show:
- Cantrips, then levels 1–9 in collapsible sections
- Each spell: name, school, casting time, concentration tag, ritual tag
- Prepared vs unprepared (for prepared casters: Wizard, Cleric, Druid, Paladin)
- A Cast button that uses the same code path as the action card Use button
- On cast: spell slot consumed, concentration dialog if applicable

One cast function. Two entry points (action card + spellbook).
The existing action card Use → resource consume → modal flow is the reference.
Do not write a parallel implementation.

See UI_RULES.md Rule 6 for the complete specification.

### 6. Plain-language audit view
**Size:** small — display layer only, no engine changes needed.
**Impact:** makes "Explain Any Number" accessible to new players, not just veterans.

The spec requires two audit modes (Section 2, Audit Trail System):
- **Technical view** (current): labelled list of contributors with values.
- **Plain-language view** (new): a single readable sentence, e.g.
  "Your AC is 17 = 10 base + 3 DEX + 2 Chain Shirt + 2 DM Blessing"

The audit data already exists in the correct shape — this is purely a rendering
change in the audit modal. A toggle at the top switches between modes. The
plain-language sentence is built by joining the existing `AuditEntry` list:
`${total} = ${entries.map(e => `${e.value > 0 ? '+' : ''}${e.value} ${e.label}`).join(' ')}`.

This matters because "Explain Any Number" is the headline differentiator.
Right now it requires reading a technical list. The plain-language view answers
the actual question a player at the table is asking.

### 7. Campaign overview screen (between-sessions surface)
**Size:** medium.
**Impact:** engagement between sessions, party-platform feel.

The campaign pillar currently exists only for live sync (DM tools, encounter).
Players need a surface that's useful on a Wednesday, not just on game night.

Additions:
- Session log (the DM can record a short session summary after each session)
- Quest tracker (Active / Completed / Failed — DM-managed)
- Campaign notes (free text, shared read-only with players)
- Party member list with HP, class, level (read-only for players)

This does not require live sync — it uses the existing campaign data model and
SQLite persistence. It is stored per-campaign and readable offline.

### 8. Home screen campaign state
**Size:** small (given #7 is done).
**Impact:** the "platform vs builder" feeling.

Once #7 exists, surface the relevant data on Home when a campaign is active.
See UI_RULES.md Rule 7 for the three states (no campaign / between sessions / live).

Without a campaign overview (#7), this screen has nothing to show.
Build #7 first or Home will still feel empty.

---

## After release

### Character Timeline (Q40 from spec)
Automated milestones + manual narrative journal entries in one chronological view.

Automated events written by the engine at key mutations:
- Character created
- Race / class / background selected or changed
- Level-up (with new level number)
- ASI resolved (with which stat increased)
- Feat taken (with feat name)
- Death / revival / stabilized

Manual entries: player-written freeform text alongside the automated log,
creating a campaign memoir rather than just a technical changelog.

Data model: add `timeline: TimelineEntry[]` to Entity, where
`TimelineEntry = { id: string; kind: 'auto' | 'manual'; text: string; level: number; timestamp: number }`.
Auto entries are written at engine mutation points (levelUp, applyFeat, etc.).
Manual entries are added from a new Timeline section in the Notes tab or a
dedicated Timeline tab. The combined view is sorted by timestamp.

This is the feature that gives players a reason to open the app on a Tuesday,
not just on game night. Nothing else in the roadmap fills that role.

### Audit trail completeness
Every number that appears in the UI must produce a non-empty, correct audit trail.
The product principle "every number is explainable" creates this as a contract.

Priority audit targets (must all produce Base + Contributors = Total, always):
- AC, Speed, Initiative
- All 6 ability scores (effective)
- All 6 saving throws
- All 18 skills
- Passive Perception, Investigation, Insight
- Spell Save DC, Spell Attack Bonus
- HP maximum
- Proficiency Bonus

When this is complete, the "Explain Any Number" feature is marketable.

### Spell selection on level-up
Casters who know a fixed number of spells (Wizard, Sorcerer, Bard, Warlock, Ranger)
must choose new spells when leveling up. Currently level-up handles ASI/feats but
not spell selection.

Required: a per-class known/prepared counts-by-level table, and a level-up flow
that queues a spell selection choice alongside or after the ASI choice.

### Quest log and shared journal
Extend the campaign overview (#5 above) with:
- Quest log (Active / Completed / Failed)
- Shared session journal (DM writes, players read)
- NPC notes
- Location notes

This is the primary between-sessions engagement surface.

### Ruleset concept (architecture, not UI)
Formalize the implicit "ruleset" that already exists as CampaignRules.
A ruleset is: a set of rules + a default content pack + a name.
Today: D&D 5e is the only ruleset and it's implicit.
Future: "D&D 5e", "Nick's House Rules", "Nika's Campaign Rules" are different rulesets
that a campaign can declare.

This does not require a user-facing tab. It is an architectural concept that enables:
- Campaigns declaring their exact rules version
- House rule packs layering on top of the SRD pack
- Future: different base systems (Pathfinder, custom) as different rulesets

The current CampaignRules type is the seed. Growing it into a full Ruleset object
(with name, content pack list, and override declarations) is the prep work.

### Content pack architecture
Wrap contentDB as named, versioned, enable/disable packs.
The existing getMergedContentDB() merge becomes: merge all enabled packs in order,
later packs override earlier ones by id.

This delivers: pack provenance in audit trails, house-rule overrides of official
content, shareable homebrew packs, and the content layer of the Ruleset concept.

### Shared inventory and party loot
A campaign-level inventory for loot and shared items.
DM adds items, distributed to party members or held in the shared pool.

### Class builder — full progression authoring
See Pre-release priority #3 Part B.
A UI for authoring a full class progression: features per level, choices, spellcasting,
resources, ASI slots. This is the authoring-surface completion of homebrew-first.

---

## Explicitly deferred

These are understood, valued, and deliberately not being built yet.

**Multiclassing** — requires significant identity model rework. The entity has one
classId; multiclassing requires a list. Good constraint: don't build until the single-
class experience is excellent. Setting: keep the "allowMulticlass" flag off and obvious.

**Cloud sync** — local WiFi sync is sufficient for table play, and offline-first is
a product principle. Cloud requires accounts, servers, and latency handling. Defer
until local experience is complete and there's a real demand signal.

**Non-D&D rulesets** — the engine is generic, which is good. But the content,
UI language, and creation wizard are all D&D. "Make it work for Pathfinder" is a
multi-month project. The right sequencing: excellent D&D 5e first, then generalize
based on real second-system requirements.

**Generic resource pools replacing spell slots** — spell slots work correctly today.
Replacing them with a generic pool system is refactoring risk with zero user-visible
benefit. The abstraction will emerge naturally if and when a second system needs it.

**Full session replay / time travel** — the event log exists. Full replay is a nice
debugging tool but not a table feature. Defer.

**Marketplace / import ecosystem** — the import pipeline (Claude parses a URL into
content) is built but untested. Getting it working reliably on real input is the
near-term goal. A marketplace or sharing ecosystem is much further out.
