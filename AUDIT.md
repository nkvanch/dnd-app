# Grimoire — Full Codebase Static Audit
_Date: 2026-06-24 · Method: static read-through (no runtime/tsc/device execution)_

## Headline

The codebase is in **strong shape**. The entire backend — engine, stores, sync
layer, and database repos — was read in full. There are **no active crashes and
no broken core math** in the audited code. Every finding below is a *latent sharp
edge*, a *minor inaccuracy*, or a *known design tradeoff* — not an emergency.

Severity legend: 🔴 real bug worth fixing · 🟡 latent/edge-case · 🔵 minor/cosmetic · ⚪ design note

---

## Engine (`src/engine/`)

### 🟡 1. Spell-save-DC target name is split two ways
`pipeline.ts` reads effect bonuses for spell save DC via target `'spell_save_dc'`
(snake_case), and `resolver.ts`'s `TARGET_STRATEGY` agrees. But DM overrides and
`DERIVED_NUMERIC_KEYS` use `'spellSaveDC'` (camelCase). Both paths work, but a
feature author granting a flat spell-save-DC bonus must use the snake_case key,
while a DM override uses camelCase. Two keys for one stat → confusing, easy to get
wrong later. *Fix: pick one string and alias the other.*

### 🟡 2. `applyStatModifiers` ignores `set` on ability scores
`pipeline.ts` only applies `operation: 'add'` to abilities. Canonical items like a
Belt of Giant Strength (*set* STR to 21) would silently do nothing. Only bites if
item content uses `set` on an ability. *Fix: handle `set` (last-writer-wins) in the
ability loop.*

### 🟡 3. `resolveCombine` mixes add/multiply order-dependently
`resolver.ts` reduces `sum + value` (add) and `sum * value` (multiply) in array
order, so a +2 and a ×2 give different results depending on order, and a multiply
applies to the running sum rather than a base. Latent — only fires if content uses
`multiply` on a stackable numeric target (rare; expertise is handled separately).

### 🟡 4. `resolveChoice` throws on count mismatch
`leveling.ts`: `if (selections.length !== definition.count) throw`. This is the
exact constraint that forced the skill-overlap padding workaround. It's a strict
invariant, not a bug — but any *other* choice-resolution path must pad to `count`
or it will crash. Worth knowing it already bit once.

### 🟡 5. `combat.ts` uses raw stats, not effective, for DEX/CON
`dexMod` (initiative tiebreak) and `concentrationCheck` (CON save) read
`entity.stats` directly, bypassing racial/feat bonuses. Initiative tiebreak impact
is negligible; the **concentration save can be off by a race's CON bonus**.
*Fix: read `entity.derived.savingThrows.con` for the concentration save.*

### 🟡 6. `concentrationCheck` keys on drifted feature IDs
It looks for `f.id === 'resilient_con'` and `'war_caster'`, but the feats system
now creates Resilient with feature id `feat_resilient`. So War Caster / Resilient
concentration advantage won't be detected from the actual feats. Low impact (the UI
drives the real save). *Fix: match on the current feat ids.*

---

## Stores (`src/store/`)

### ⚪ 7. Full-entity, last-writer-wins sync is clobber-prone
`characterStore.applyIncomingEntity` overwrites the local entity wholesale, and
`updateCharacter` broadcasts on every change. Two devices editing the same entity
near-simultaneously overwrite each other with no merge. This is the documented sync
model, not a bug — but the real-world failure mode is "DM edited HP, a stale player
push overwrote it." Mitigation (per-field timestamps) is a real project, not a fix.

### 🟡 8. Player reconnect after restart can go stale
`campaignStore.resumeSync` reconnects a player using the stored join code. But room
codes are IP-derived; if the DM's IP changed (DM's own `resumeSync` regenerates the
code), the player's saved code is now wrong → "Reconnecting…". A genuine
resume-after-restart fragility, distinct from the current fresh-join issue.

### 🔵 9. `generateJoinCode()` is now dead code
In `campaignStore.createCampaign` it's a placeholder immediately overwritten by the
real LAN room code. Harmless but removable.

### 🔵 10. `DEFAULT_RULES` duplicated in 4 places
Defined identically in `characterStore`, `campaignStore`, `combatStore`, and
imported into `rest.ts`/`combat.ts`. Consolidate into one exported constant.

---

## Sync layer (`src/sync/`)

**Audited in full — genuinely well-engineered.** NDJSON framing with partial-line
buffering (`protocol.ts`), robust reconnect-safety (stale-socket guards on
close/hello in `server.ts`), correct offline event-queue replay. No bugs.

### ⚪ Relevant to the live "reconnecting" bug
- The **server binds to `0.0.0.0`** (all interfaces), so it listens correctly. A
  failed client connect is therefore *not* a server-bind problem — it's the room
  code encoding the wrong source IP, or the network blocking phone-to-phone
  (router AP/client isolation, or different subnets).
- The diagnostic surfacing added during sync-debug (client error → `lastError` →
  red line on the player screen; DM "Hosting on `<IP>`" line) will pin down which.

---

## Database (`src/db/`)

**Audited in full — clean.** JSON-blob storage (smart migration avoidance),
consistent web no-op guards, parameterized queries (no injection), idempotent table
creation, SecureStore-mirrored device id surviving reinstall. No bugs.

### 🔵 11. `loadAllEntityMeta` doesn't actually skip deserialization
Its comment claims it avoids parsing full blobs, but it `JSON.parse`s each row's
`data` to extract name/level/hp. Works fine; just not the optimization implied. True
fix would store those as columns.

---

## Front end (`src/components/`, `app/`)

`TabInventory` (the most logic-heavy screen) was audited in depth — the name-based
item classification, first-match categorisation, sorting, and custom-item quick-add
are all sound.

### 🔵 12. Item rows keyed by `itemId`, not a unique instance id
`TabInventory` uses `inst.itemId` as the React key. Two distinct `ItemInstance`s of
the same item would collide. Unlikely (quantity is used instead), but latent.

### 🔵 13. Carry capacity uses raw STR, not effective
`carryCapacity = entity.stats.str * (large ? 30 : 15)` ignores racial/feat STR
bonuses. Minor inaccuracy, same raw-vs-effective theme as #5/#6.

### Note on remaining screens
The other ~14 screens are largely presentational (render state, call store
actions). Their mechanical issues — unused vars, floating promises, missing hook
deps — are caught far more reliably by `tsc --noEmit` and the new ESLint config than
by eye. Recommend running both and cross-referencing rather than a manual read.

---

## Cross-cutting theme: raw vs. effective stats

Findings #5, #6, and #13 share one root: a few call sites read `entity.stats.X`
directly instead of the effective (post-effect) value. The pipeline already
computes effective scores. A small, safe cleanup would be to route these through
`entity.derived` / `applyStatModifiers`. None are emergencies; concentration saves
(#5/#6) are the most player-visible.

## Recommended fix order (when you move to repairs)

1. **Sync "reconnecting"** — already instrumented; needs the two-device data
   (player error line + DM hosting IP).
2. **#6** concentration feat-id drift — quick, real correctness.
3. **#5** concentration save uses raw CON — quick, real correctness.
4. **#8** player resume-after-restart stale code — real, surfaces on every restart.
5. **#1** unify the spell-save-DC target string — prevents future foot-guns.
6. **#2, #3** handle `set`/multiply edge cases — only if content needs them.
7. Cleanups: **#9** dead code, **#10** dedupe DEFAULT_RULES, **#13/#12** minor.

## What was verified clean (no issues)

types · pipeline (logic) · resolver (logic) · leveling · rest · conditions ·
dmOverride · dice · entire sync layer · all 8 db repos · all 5 stores ·
TabInventory classification · house-rules system · feats system wiring.
