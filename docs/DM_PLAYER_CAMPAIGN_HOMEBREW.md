# DM, Player, Campaign, and Homebrew — How They Work

A reference for how the app's multiplayer/content system actually behaves today,
written against the current code (not the roadmap docs, which describe intent
and can drift). If something here disagrees with `docs/NAVIGATION_MAP.md` or
`docs/PAGE_REFERENCE.md`, trust this file or re-check the source — those may be
stale.

Four bottom tabs make up the whole app: **Home**, **Campaigns**, **Characters**,
**Homebrew**. Everything below hangs off those.

---

## 1. Core concepts

Three pieces of state everything else is built from:

- **`DeviceSession`** (`src/store/sessionStore.ts`, persisted in SQLite) — one
  per physical device/install: `deviceId` (random, generated once),
  `nickname`, `role` (`'dm' | 'player'` — advisory only, see below), and
  `campaignId` (which campaign this device currently has active). Created
  once on first launch via `getOrCreateSession()`.
- **`Campaign`** (`src/engine/types.ts`) — `id`, `name`, `dmDeviceId` (whichever
  device created it), `joinCode`, `rules` (house rules for this table),
  `playerIds`/`characterIds`, `notes`, `sessionLog`, `quests`. Persisted per
  device in local SQLite (`src/db/campaignRepo.ts`) — **there is no cloud
  copy**; each device that has ever created or joined a campaign holds its
  own local record of it.
- **`Entity`** — the character/monster/companion data model. Same shape is
  used for a player's PC, a DM-spawned monster, and a companion. This is the
  thing that actually syncs over the network; campaigns and homebrew content
  do not.

**Who's the DM?** Not a fixed setting — computed per campaign:
`isDm = campaign.dmDeviceId === session.deviceId`. Whoever's device created
the campaign is the DM *for that campaign*. The same physical device can be
the DM of one campaign and a player in another (they're just never both at
once — see §2).

---

## 2. Campaigns

### 2.1 Creating one

Campaigns tab → "👑 Create Campaign (DM)" → name it → `campaignStore.createCampaign()`:

1. Builds a `Campaign` record, `dmDeviceId = session.deviceId`.
2. Starts hosting (`syncManager.startAsServer`) — see §2.3, this **always
   succeeds** regardless of WiFi.
3. Persists the campaign, sets it active, sets `isDm: true`.

### 2.2 Joining one

Campaigns tab → "🗡 Join Campaign (Player)" → enter the 7-character room code
(or scan a QR) → `campaignStore.joinCampaign()`:

1. Connects as a TCP client to the DM's device (`syncManager.startAsClient`).
2. On `welcome`, the DM immediately pushes every character it knows about as
   a full snapshot — this is how the party roster shows up on a fresh join.
3. Saves a **local stub campaign record** (`id: joined_<code>`) so the device
   has something to show immediately; the real name/rules arrive with the
   first sync from the DM.

A player only ever holds a local *copy* — the DM's device is the source of
truth for that campaign's real data.

### 2.3 Hosting — CampaignHost vs. NetworkHostAvailability

This is worth understanding precisely because it's not what the naming
("Create Campaign") suggests. Hosting is split into two independent things:

- **CampaignHost** — the session/role state: `isDm`, `activeCampaign`, and a
  TCP server actually running on this device. This part **never depends on
  network availability**. `syncManager.startAsServer()` always starts the
  server (it binds to `0.0.0.0`, which doesn't require an active interface)
  and only throws for a genuine platform issue (web, which has no raw TCP
  socket API at all, or a native module that isn't linked in this build) —
  never for "no WiFi."
- **NetworkHostAvailability** — whether the 7-character room code is
  currently real and dialable. This *does* depend on having a resolvable
  local IP (WiFi or a mobile hotspot). If there's no usable network, the
  room code is `null`/empty and the DM sees a banner: *"No local network is
  available. You can still use this campaign on this device, but other
  players cannot join. Enable Wi-Fi or a mobile hotspot for live
  multiplayer."* This is a notice, not a blocker — every local DM tool still
  works.

`syncManager` watches for connectivity changes while hosting
(`expo-network`'s change listener) and regenerates the room code automatically
the moment a network appears, without tearing down the server or requiring
the campaign to be recreated. If the network drops mid-session, already
-connected players may disconnect (normal socket behavior), but the DM's
session and all local data are untouched.

### 2.4 Owning multiple campaigns

A device hosts/connects to **one campaign at a time**, but can *own* several.
Leaving a campaign (`leaveCampaign()`) just stops the transport and clears
which one is active — it does **not** delete it. The Campaigns tab's empty
state lists every campaign this device has created or joined, each with:

- **Resume** — `switchToCampaign(id)`: stops whatever was active, then hosts
  (if this device is the DM) or reconnects (if it's a player) the selected
  one. Never destroys the one you're switching away from.
- **🗑 Delete** — a separate, explicit, confirmed action
  (`deleteCampaignPermanently`). This is the only thing that actually removes
  a campaign.

A regular DM-side "leave" button is labeled **"⏸ Stop Hosting"** — it
disconnects any connected players (same as a network outage) but the
campaign itself is fine and can be resumed later from the list.

### 2.5 Room codes going stale

The room code encodes the DM's current local IP. If the DM's phone gets a
new IP (different network, router reassigns a lease, etc.) between
sessions, the old code stops working. `resumeSync()` regenerates it
automatically on app boot; a connected player whose socket drops can tap
"Reconnect" and paste in a fresh code from the DM (`reconnectWithCode`)
without leaving the campaign.

---

## 3. The DM

Everything DM-specific lives under `app/dm/`, gated on `isDm === true` for
the active campaign (not a global setting — a player-role device sees none
of this for a campaign it didn't create).

### 3.1 DM Dashboard (`app/dm/dashboard.tsx`)

The party-overview landing screen: a card per character in the campaign,
showing HP bar, AC, conditions, concentration, and (if the "full stat
visibility" house rule is on) full ability scores — otherwise just what a DM
would reasonably glance at. Also shows the room code / QR and the live
connected-player roster. Tapping a character opens the DM character view
(§3.3). A button starts an encounter with the current party.

### 3.2 Encounter / Combat tracker (`app/dm/encounter.tsx`)

- **Setup mode**: add party members and spawn monsters (§3.4) into the
  initiative order before combat starts.
- **Live combat**: initiative order, turn advancement (ticks
  condition/concentration durations), and a **QuickPanel** per selected
  combatant with:
  - Damage / Heal / Kill (Wild Shape–aware — hits the beast's HP pool, not
    the player's real HP, while transformed)
  - Add/remove conditions
  - A concentration-save prompt, auto-triggered when a concentrating
    combatant takes damage
- Every QuickPanel action is diffed against the combatant's *live* state
  before applying (not a stale local snapshot) and pushed to
  `characterStore`, so it syncs to the real player if one's connected — see
  §4.2 for why this matters.

### 3.3 DM character view (`app/dm/character/[id].tsx`)

A read-only mirror of the player's own 6-tab sheet, except the DM can't
directly edit notes/inventory — instead every derived stat is tappable and
opens the **DM Override** system (`src/engine/dmOverride.ts`): a DM can set
or add-adjust any numeric derived stat (AC, a save, a skill, speed, etc.)
without touching the character's real base stats or features. Overrides are
applied last, after everything else, and can be toggled off individually to
restore the original computed value — nothing is ever destructively
overwritten.

### 3.4 Monster library (`app/dm/monsters.tsx`)

Browse the full SRD monster list (322 monster templates — the SRD 5.1 set, with a few variants counted as separate entries)
plus any homebrew monsters, merged with homebrew taking precedence on a
shared id. Search by name, filter by CR range, preview the full stat block,
and spawn directly into the current encounter (`spawnMonster()` turns the
static template into a live `Entity` using the exact same
Feature/Effect/`recomputeDerived` pipeline a player character uses).

**Known gaps, not yet wired to anything:**
- `legendaryActions`/`lairActions` exist as fields on the monster data model.
  `lairActions` is never consumed anywhere. `legendaryActions` is a bare
  count — only ONE monster (the Lich) also has the matching `resources`/
  `features` entries the QuickPanel legendary-actions UI actually reads
  (`resourceId: 'legendary_actions'`, the same generic ResourceCost
  mechanism spell slots use); the other 28 declaring `legendaryActions`
  spawn with no mechanical support (audit finding LEGENDARY-1) — this was
  previously stated as "no monster has this wired," which understated the
  Lich as a real, working exception.
- No way to save/name a prepared encounter roster for reuse. A DM builds
  the monster list live in setup mode, every session.

---

## 4. The Player

### 4.1 Claiming a character

After joining a campaign, a player picks one of their own characters and
taps "Claim" (`assignCharacterToCampaign`): this announces to the DM which
character this device controls (`syncManager.claimCharacter`) and pushes a
full snapshot up so it appears on the DM's dashboard immediately. A device
can only actively control one claimed character per campaign at a time.

### 4.2 The character sheet

Same 6-tab sheet (`app/sheet/[id].tsx`) whether or not the character is in an
active campaign — playing solo and playing synced use identical UI:

| Tab | What it's for |
|---|---|
| Combat | HP/AC/conditions, Combat/Exploration mode switch, Wild Shape |
| Actions | Every usable feature/spell as an action card, action-economy tracked |
| Abilities | Ability scores, saves, skills — tap any number for its audit trail |
| Features | Racial/class/feat features, remove/add features live |
| Items | Inventory, equip/unequip, attunement, infusions |
| Notes | Free text |

Every mutation (damage, a spent spell slot, equipping armor, a level-up)
goes through one choke point, `characterStore.updateCharacter`, which:
records it for **undo**, writes it to the **persistent timeline** (a
per-character history log, viewable via the 🕘 button), and — if this
device is in a live campaign — **syncs the diff** to the DM.

### 4.3 What syncs, and how

The wire protocol (`src/sync/protocol.ts`) is small: `hello`/`welcome` on
connect, `entity_snapshot` (a full character), `entity_patch` (a computed
diff of just what changed — the normal case for an in-play edit),
`claim_character`, and a generic `sync_event`. A player never has to think
about this — it's automatic on every mutation while connected.

**Reconnect safety** (fixed recently — worth knowing about): if a player's
device goes offline mid-session and takes an action (damage, a spent spell
slot) that never reaches the DM, reconnecting used to let the DM's stale
copy silently overwrite the player's own correct, newer local state. Fixed:
a device's own copy of a character it currently owns is now authoritative
against an incoming full snapshot for that same character — the device
pushes its local copy back up instead of accepting an overwrite.

**A player cannot:**
- See or set DM overrides directly (those only apply visually/mechanically
  on top of the real numbers; a player sees the *result*, not the override
  UI).
- Access anything under `app/dm/`.
- Edit another player's character.

---

## 5. DM ↔ Player interaction, summarized

| Action | Who does it | What the other side sees |
|---|---|---|
| Player takes damage / casts a spell / levels up | Player | DM dashboard updates live (a patch arrives) |
| DM applies damage/heal/condition via QuickPanel | DM | Player's own device gets the same patch, applied on top of *their* current state, not a DM-side snapshot |
| DM sets a stat override | DM | Player sees the adjusted number on their own sheet; the override itself isn't separately surfaced as "a DM did this," just a changed number |
| DM starts/advances combat | DM | Reflected in the party dashboard; the player's own sheet doesn't currently show "it's your turn" as a distinct signal beyond the DM's own encounter screen |
| Player reconnects after a drop | Player | DM sees them rejoin the roster; the player's own newer local edits are preserved, not clobbered |
| DM ends hosting for the night | DM | Player's socket drops (shows "Reconnecting…"); nothing is lost on either side; resuming later just needs the DM to open the campaign again |

---

## 6. Homebrew

### 6.1 Where it lives

The Homebrew tab (`app/(tabs)/homebrew.tsx`) has three panels:

- **Installed Packs** — `.grimoire-pack` files imported as a named, removable
  group (see §6.4).
- **Create** — one flat grid of 12 buttons, each opening a dedicated builder
  screen:

  | Button | Builder | Authors |
  |---|---|---|
  | ⚔️ New Race | `race-builder` | Full races: age/size/languages, multi-trait system, subraces |
  | 🧬 New Subrace | `subrace-builder` | Attach a subrace to *any* race, official or homebrew |
  | 🎓 New Class | `class-builder` | Full class: saves, proficiencies, spellcasting, per-level features, ASI levels |
  | 🎭 New Subclass | `subclass-builder` | Attach a subclass to *any* class, official or homebrew |
  | 📜 New Background | `background-builder` | Skills/tools/languages/equipment + custom features |
  | 🧰 New Item | `item-builder` | Category-specific fields (weapon/armor/wondrous/etc.), rarity, mechanical effects |
  | 💎 Rare Items | `rare-items` | Not an author screen — a rarity-filtered *browser* over official + homebrew items |
  | ✨ New Spell | `spell-builder` | Full spell definition with quick-pick presets |
  | 📖 New Feature | `feature-editor` | The generic building block — name/description/effects/activation |
  | 🌟 New Feat | `feat-builder` | Metadata + one Feature + optional ability/skill choice, resolved the same way official feats are |
  | 🐉 New Monster | `monster-builder` | Flat stat-block record; spawns through the same pipeline as official monsters |
  | 🩹 New Condition | `condition-builder` | id + name + description + features — the simplest content shape |

  *(This is what you're seeing as "New Feat / New Monster / New Condition" —
  three of the twelve equally-weighted buttons in one grid, not a separate
  duplicated section. Each also becomes that screen's own title when
  creating fresh content, e.g. opening the feat builder titles itself "New
  Feat" until you've actually saved something, then switches to "Edit Feat."
  If you're seeing something visually different from a single 12-button
  grid — e.g. an actual second header elsewhere — that'd be worth a
  screenshot, because it doesn't match the current source.)*

- **Library** — every piece of homebrew content you've authored, searchable
  and filterable by type, with export/edit/version-history/delete per item.
  Official read-only content (conditions) appears here too for browsing.

### 6.2 Storage: per device, not per campaign

Homebrew content (`useHomebrewStore`, `src/db/contentCacheRepo.ts`) is
**global to the device**, with no campaign scoping at all. Authoring a race
on your phone makes it available to every character/campaign on *that
phone* — it is not tied to, or shared through, any particular campaign.

### 6.3 Precedence: homebrew wins by id

Every place the app resolves content by id (race/class/subclass/spell/item/
feat/monster/condition), homebrew is checked first and wins if it shares an
id with official content (`src/content/contentResolution.ts`,
`homebrewWinsById` in `homebrewStore.ts`). This is how you can override an
official piece of content — reuse its id in a homebrew record with the same
id, and your version takes precedence everywhere it's referenced.

### 6.4 Getting homebrew onto another device — this is the part that surprises people

**Homebrew content never travels over the LAN sync protocol.** Only
character (`Entity`) data syncs live between a DM and a player. If a
character uses homebrew content, the *receiving* device must already have
that exact content installed locally, or the reference won't resolve.

The only ways homebrew content moves between devices:

1. **Export a single item** (Library panel → export) as a shareable file,
   imported on the other device via the same builder/import flow.
2. **Export/import a full `.grimoire-pack`** (`app/backup.tsx`) — this is
   also the personal backup/restore mechanism. A `content-pack`-type pack
   (no characters, just homebrew) gets registered in **Installed Packs** as
   one named, removable group.

Import is validated before anything is committed: every homebrew item runs
through the same per-type structural validator every builder uses
(`homebrewValidator.ts`), and every character's own embedded features are
checked too — a structurally broken pack is rejected outright rather than
silently corrupting the local library or crashing the app later.

### 6.5 How homebrew reaches a character

- At **character creation**, every content-picking screen (race, class,
  background, feats, spells, equipment) merges official + homebrew via the
  precedence rule above — homebrew races/classes/etc. show up right
  alongside official ones, indistinguishable in the picker.
- **In play**, `TabFeatures` lets a player (or DM, via the character view)
  add an existing feat (via the same picker) or author a one-off custom
  feature on the spot, and swap a character's background entirely — all
  going through the same engine mutators official content uses, so nothing
  about a character being "homebrew-powered" is a special case anywhere
  else in the app.

### 6.6 How homebrew interacts with the DM specifically

- **Diagnostics before deletion**: `diagnosePack()` (`src/engine/packDiagnostics.ts`)
  checks whether any saved character still references a pack's content before
  a DM removes it, so deleting a pack doesn't silently orphan a character
  mid-campaign.
- **Test bench**: several builders (feat, monster, condition, feature) have
  a "🧪 Test" button that runs the draft content against a disposable
  scratch character and shows a before/after diff — a DM or player can see
  exactly what a homebrew feat/condition actually *does* mechanically before
  ever saving or using it at the table.
- Monsters authored in the homebrew Monster builder show up directly in the
  DM's monster library (§3.4) alongside the SRD list — no separate step
  needed to make a custom monster spawnable.

---

## Appendix: known declared-but-unused fields

Worth knowing about if you're reading the code, not user-visible gaps:

- `Campaign.playerIds` is set once at join time but never read anywhere —
  the live "who's connected" roster actually comes from `syncStatus.roster`,
  computed fresh by the server on every connection change, not this field.
- `MonsterTemplate.legendaryActions` — declared and consumed for exactly one
  monster (the Lich); `lairActions` is declared and never consumed at all
  (see §3.4).
