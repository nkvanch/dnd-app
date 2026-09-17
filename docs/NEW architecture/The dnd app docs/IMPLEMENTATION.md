# Grimoire — Implementation Reference

> Companion to `ARCHITECTURE.md`. That document is **normative** ("how the system
> should be shaped"). This one is **descriptive**: the concrete language, data
> schemas, and wire protocol *as they exist in the code today*. When the two
> disagree, the code (and this file, kept in sync with it) is the source of truth
> for what's actually implemented; ARCHITECTURE.md remains the source of truth for
> intent.
>
> Cross-references: §A expands ARCHITECTURE §14–15; §B expands §2, §5–7; §C
> expands §16.

---

## A. Language & Runtime Stack

**Primary language: TypeScript** (`~6.0.3`, `strict: true`, extending
`expo/tsconfig.base`). There is no second language in the app itself; the one
build-time helper script (`scripts/convert-spells.mjs`) is plain ESM JavaScript on
Node, used only to generate typed content — it never ships.

| Concern | Choice | Notes |
|---|---|---|
| UI framework | **React 19.2.3 + React Native 0.85.3** | |
| App platform | **Expo SDK ~56** | managed workflow; `expo run:android` is the active target |
| JS engine | **Hermes** | RN default on device |
| Navigation | **expo-router ~56** | file-based routing under `app/` |
| State | **Zustand ^5** | synchronous in-memory store |
| Local storage | **expo-sqlite ~56** | offline-first durable store |
| Device identity | **expo-secure-store** | holds the install-time device UUID |
| QR (render / scan) | **react-native-qrcode-svg** / **expo-camera** | join-code sharing |
| Sync transport | **react-native-tcp-socket ^6.4.1** | raw TCP — *not* WebSocket |
| LAN discovery | **react-native-network-info** | resolves the device's local IP |
| AI import | **@anthropic-ai/sdk** | statblock/wiki importer (untested on real input) |
| Web shim | **react-native-web** | browser runs the UI; SQLite + sync no-op there |

**Layering rule the stack enforces:** `src/engine/**` and `src/content/**` are
**plain TypeScript with zero imports from React, React Native, expo-*, or the
database.** They are portable and unit-testable in a bare Node process. Only the
`src/store`, `src/db`, `src/sync`, `src/components`, and `app/` layers may import
platform APIs. If you ever find yourself `import`-ing from `react-native` inside
`src/engine`, that's a layering violation.

---

## B. Concrete Data Schemas

### B.0 Two representations, one source of truth

Grimoire has **no hand-written JSON Schema or normalized SQL schema** for its
domain objects, and that is deliberate. The schema *is* the TypeScript type set in
`src/engine/types.ts`, enforced at compile time by `strict` mode. Persistence then
stores most objects as **serialized JSON blobs inside a thin relational shell** —
only the columns that appear in a `WHERE` clause are real SQL columns; everything
else lives in a `data TEXT` column as `JSON.stringify(value)`.

So "the schema for a Feature" = the `Feature` TypeScript type, serialized to JSON.
There is intentionally no separate `features` table.

### B.1 Effect (the mechanical payload — passive)

The atomic unit that changes a number. Fires inside `recomputeDerived()`.

```ts
type Effect = {
  type:
    | 'stat_modifier' | 'grant_proficiency' | 'grant_resistance' | 'grant_immunity'
    | 'apply_condition' | 'grant_resource' | 'override_rule' | 'base_ac_formula'
    | 'suppress_condition_effects' | 'condition_immunity';
  target:    string;                 // e.g. 'con', 'ac', 'speed', 'perception'
  operation: 'add' | 'multiply' | 'set'
           | 'advantage' | 'disadvantage'
           | 'resistance' | 'immunity' | 'vulnerability' | 'suppress';
  value:     number | string | string[] | null;
  condition: string | null;          // runtime flag/condition id gating this effect
  formulaAbilities?: Ability[];       // base_ac_formula only, e.g. ['dex','con']
};
```

**Example (Mountain Dwarf STR +2), as stored JSON:**
```json
{ "type": "stat_modifier", "target": "str", "operation": "add",
  "value": 2, "condition": null }
```

**Example (Barbarian Unarmored Defense, AC = 10 + DEX + CON):**
```json
{ "type": "base_ac_formula", "target": "ac", "operation": "set",
  "value": 10, "condition": null, "formulaAbilities": ["dex", "con"] }
```

### B.2 Feature (the universal rule container)

Everything that can be granted to an Entity is a `Feature`. Passive features carry
`effects[]`; active (on-use) features additionally carry `activation` +
`abilityEffects[]` (the active system — see §B.5 — which does *not* run in
`recomputeDerived`).

```ts
type FeatureSource = {
  kind:  'race' | 'class' | 'subclass' | 'background' | 'feat'
       | 'item' | 'spell' | 'condition' | 'campaign';
  refId: string;
};

type Feature = {
  id:          string;
  name:        string;
  description: string;
  source:      FeatureSource;
  level:       number | null;
  effects:     Effect[];              // passive — fire in recomputeDerived()
  actions:     Action[];
  choices:     ChoiceDefinition[];
  passive:     boolean;

  // optional active-ability fields (absent ⇒ passive, no action card generated)
  activation?:     FeatureActivation;
  tags?:           ActionCardTag[];
  abilityEffects?: AbilityEffect[];
};

// As stored on an Entity, each feature carries a runtime toggle:
type FeatureInstance = Feature & { isActive: boolean };
```

### B.3 Content objects & the content database

Content is grouped by category in one `ContentDB`. Each category is an array of
typed records; every record reduces to Features (and, for spells, the spell record
plus optional concentration features).

```ts
type ContentDB = {
  races:       Race[];
  classes:     CharClass[];
  backgrounds: Background[];
  spells:      Spell[];
  items:       Item[];
  conditions:  Condition[];
  features:    Feature[];
  feats?:      Feat[];
};

type Race       = { id: string; name: string; features: Feature[]; subraces?: Subrace[] };
type CharClass  = { id: string; name: string; hitDie: number; features: Feature[] };
type Background = { id: string; name: string; features: Feature[] };
type Condition  = { id: string; name: string; description: string; features: Feature[] };
type Item       = { id: string; name: string; weight: number; cost: string;
                    properties: string[]; features: Feature[] };
type Feat       = { id: string; name: string; prerequisite: string | null;
                    description: string; source: string; feature: Feature };

type Spell = {
  id: string; name: string;
  level: 0|1|2|3|4|5|6|7|8|9;
  school: string; castingTime: string; range: string;
  components: string[]; duration: string; description: string;
  upcast: string | null; ritual: boolean; concentration: boolean;
  classes?: string[];                       // lowercased class ids that can cast it
  onConcentrationFeatures?: Feature[];
};
```

**Example (one generated spell row, JSON):**
```json
{ "id": "fire_bolt", "name": "Fire Bolt", "level": 0, "school": "Evocation",
  "castingTime": "1 action", "range": "120 feet", "components": ["V","S"],
  "duration": "Instantaneous", "description": "...", "upcast": null,
  "ritual": false, "concentration": false, "classes": ["sorcerer","wizard"] }
```

### B.4 Leveling-time grants vs. runtime effects

A class progression hands out `Grant`s at each level; `Grant.value` is `unknown`
and interpreted by the leveling engine according to `kind`. This is distinct from
`Effect` (which is what a granted Feature *does* at recompute time).

```ts
type ClassProgression = { classId: string; entries: LevelEntry[] };
type LevelEntry = { level: number; grants: Grant[];
                    choices: ChoiceDefinition[]; hpDie: 4|6|8|10|12 };
type Grant = {
  kind: 'feature' | 'resource' | 'resource_upgrade' | 'spell_slots'
      | 'proficiency' | 'speed' | 'subclass_unlock' | 'init_spellcasting';
  value: unknown;
};
```

### B.5 Active-ability effects (on card use — not in the pipeline)

```ts
type AbilityEffect =
  | { type: 'damage';           dice: string; damageType: string; saveOnSuccess?: 'half'|'none' }
  | { type: 'heal';             dice: string; bonusMod?: Ability }
  | { type: 'apply_condition';  conditionId: string; duration: DurationTracker }
  | { type: 'remove_condition'; conditionId: string }
  | { type: 'grant_speed';      speedType: 'fly'|'swim'|'climb'|'walk'; amount: number; duration: DurationTracker }
  | { type: 'transform';        formId: string }
  | { type: 'set_flag';         flag: string; value: boolean }
  | { type: 'spend_resource';   resourceId: string; amount: number }
  | { type: 'restore_resource'; resourceId: string; amount: number | 'full' };
```

### B.6 Physical schema (SQLite)

Six tables. Complex objects are JSON in a `data`/`payload` column; only queried
fields are real columns. (Verbatim from `src/db/schema.ts`.)

```sql
CREATE TABLE entities (
  id        TEXT PRIMARY KEY NOT NULL,
  kind      TEXT NOT NULL DEFAULT 'character',  -- 'character' | 'monster' | 'npc'
  data      TEXT NOT NULL,                       -- JSON.stringify(Entity)
  updatedAt INTEGER NOT NULL
);

CREATE TABLE campaigns (
  id TEXT PRIMARY KEY NOT NULL, data TEXT NOT NULL, updatedAt INTEGER NOT NULL
);                                               -- data = JSON.stringify(Campaign)

CREATE TABLE sync_events (
  id             TEXT PRIMARY KEY NOT NULL,
  sessionId      TEXT NOT NULL,
  entityId       TEXT NOT NULL,
  changeType     TEXT NOT NULL,                  -- SyncChangeType
  payload        TEXT NOT NULL,                  -- JSON; shape depends on changeType
  authorDeviceId TEXT NOT NULL,
  timestamp      INTEGER NOT NULL,
  applied        INTEGER NOT NULL DEFAULT 0      -- 0/1 (SQLite has no BOOLEAN)
);

CREATE TABLE device_session (                    -- singleton, id always = 1
  id INTEGER PRIMARY KEY NOT NULL DEFAULT 1,
  deviceId TEXT NOT NULL, nickname TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT 'player', campaignId TEXT
);

CREATE TABLE content_cache (                     -- official/homebrew/imported content
  id TEXT PRIMARY KEY NOT NULL, type TEXT NOT NULL,
  data TEXT NOT NULL, version TEXT NOT NULL DEFAULT '1'
);

CREATE TABLE combat_state (                      -- singleton, id always = 1
  id INTEGER PRIMARY KEY NOT NULL DEFAULT 1, data TEXT NOT NULL, updatedAt INTEGER NOT NULL
);

CREATE INDEX idx_entities_kind      ON entities    (kind);
CREATE INDEX idx_sync_events_applied ON sync_events (applied, sessionId);
CREATE INDEX idx_content_type       ON content_cache (type);
```

**Row → type mapping:** `entities.data` ⇄ `Entity`; `campaigns.data` ⇄ `Campaign`;
`combat_state.data` ⇄ the combat session object; `content_cache.data` ⇄ a content
record of the given `type`. **The database never holds mechanical truth** —
anything loaded from disk is re-run through `recomputeDerived()` before the UI uses
it, so a stale stored `derived` block can never desync from the rules.

---

## C. Sync Protocol (Local Wi-Fi)

### C.1 Transport & framing

- **Transport: raw TCP** via `react-native-tcp-socket`. The DM device runs a TCP
  **server** on the LAN (listening port defined in `src/sync/server.ts`); each
  player device is a TCP **client**. *(Earlier notes called this "WebSocket" —
  that's inaccurate; it's plain TCP.)*
- **Framing: newline-delimited JSON (NDJSON).** Each message is
  `JSON.stringify(msg) + '\n'`. Receivers buffer incoming chunks and split on
  `'\n'`; a trailing partial line is kept as `remainder` and prepended to the next
  chunk. (`encodeMessage` / `parseBuffer` in `src/sync/protocol.ts`.) Malformed
  lines are dropped with a warning, not fatal.

### C.2 Message set (`SyncMessage`, verbatim)

```ts
type SyncMessage =
  | { type: 'ping' }
  | { type: 'pong' }
  | { type: 'hello';           deviceId: string; nickname: string }   // client → host
  | { type: 'welcome';         campaignId: string; sessionId: string } // host → client
  | { type: 'sync_event';      event: SyncEvent }                      // either direction
  | { type: 'request_entity';  entityId: string }                      // client → host
  | { type: 'entity_snapshot'; entity: Entity }                        // host → client
  | { type: 'error';           message: string };
```

Flow: client connects → `hello` → host replies `welcome` → client `request_entity`
for each character it needs → host returns `entity_snapshot`. Thereafter,
incremental changes travel as `sync_event`; `ping`/`pong` keep the socket alive.

### C.3 Event-sourcing model

Every state mutation emits a **`SyncEvent`**, persisted to the `sync_events` table:

```ts
type SyncChangeType =
  | 'hp_change' | 'resource_spend' | 'resource_restore'
  | 'condition_apply' | 'condition_remove'
  | 'spell_slot_spend' | 'spell_slot_restore'
  | 'dm_override_apply' | 'dm_override_cancel'
  | 'combat_event' | 'initiative_update'
  | 'entity_full_sync';                       // full snapshot on first join

type SyncEvent = {
  id: string; sessionId: string; entityId: string;
  changeType: SyncChangeType; payload: unknown;
  authorDeviceId: string; timestamp: number; applied: boolean;
};
```

Events are written with `applied = 0`, processed, then flipped to `applied = 1`.
**Unflushed events replay on reconnect**, so a dropped connection self-heals.
Because each event has a stable `id`, apply is idempotent (replaying an
already-applied event is a no-op) — i.e. at-least-once delivery with idempotent
application. Host (DM) is authoritative; current conflict handling is host-
authoritative / last-write (the deeper merge logic lives in `server.ts` /
`client.ts` and is not yet hardened).

### C.4 Discovery, identity, join

- **Identity:** `DeviceSession.deviceId` is a UUID generated once at install and
  stored in **expo-secure-store**. No accounts, ever.
- **Join:** a `Campaign` carries a **6-digit `joinCode`** that resolves to the DM's
  **local IP** (obtained via `react-native-network-info`). A player types the code
  or scans a QR (rendered with `react-native-qrcode-svg`, scanned via
  `expo-camera`), connects over the LAN, and handshakes as in §C.2.

### C.5 Constraints

- **LAN only** — no internet, no cloud, no relay server.
- **Single-device must always work** — sync is strictly additive; with no network
  the app is fully functional.
- **Status:** implemented but **not yet verified across two physical devices**
  (only one Android device on hand), so reconnect/conflict edge cases are unproven.
