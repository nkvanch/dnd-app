# App Quirks & Conventions

This is not a feature list — it's the particular, sometimes non-obvious
behaviors and house-style conventions that make Grimoire work the way it
does. Verified against actual source this pass; file:line citations point
at the real implementation, not a description of intent.

## Free Edit vs. DM Override — two systems, one engine underneath

These look like separate features and are exposed through separate modals,
but **Free Edit is implemented as a special case of the DM Override
engine**, not a parallel system:

- **Free Edit** (`src/components/sheet/FreeEditModal.tsx`) is
  player-facing. It edits two different kinds of data differently:
  - *Base data* (ability scores, hit dice, speed, base AC, spell slots) is
    written directly onto the entity (`onApply({ ...entity, ... })`).
    Changing CON specifically ripples into HP via `reconcileConHp()` — a
    surgical CON-delta adjustment, not a full HP recompute, so a manually
    set or rolled HP total isn't clobbered.
  - *Derived display stats* (initiative, passive perception, final AC) go
    through `applyDmOverride()` with `dmDeviceId: 'free-edit'` and
    `label: 'Free edit'` — the exact same function the DM's own override
    modal calls. This is why a Free Edit change to AC can show up
    alongside DM overrides in the same "active overrides" listing.
  - "AC Bonus (add)" is a deliberately *separate*, additive override on
    the same `ac` stat as "AC (final)" — `DmOverride` supports stacking a
    `set` and an `add` on one stat, applied in order, so this models a
    real stacking bonus (Shield spell, a temporary buff) rather than
    replacing whatever "AC (final)" set.
- **DM Override** (`src/components/sheet/DmOverrideModal.tsx`,
  `src/engine/dmOverride.ts`) is DM-facing, opened by tapping an entry in
  the audit trail. Every override requires an operation (`set`/`add`), a
  value, a **label** (shown in the audit trail — there's no anonymous
  override), and an expiry (`manual` / `end_of_encounter` /
  `end_of_session`).
- The shared engine (`dmOverride.ts:1-9`) guarantees overrides:
  - sit in `entity.dmOverrides[]` and apply **last**, after every feature,
    equipment, and condition effect;
  - **never touch** `entity.stats` or `entity.features` — the underlying
    character data stays clean;
  - are only accepted for scalar numeric targets in `DERIVED_NUMERIC_KEYS`
    (or a `savingThrows.X` path) — anything else is silently ignored with
    a console warning, so a typo'd stat name can't corrupt state;
  - are cancelled by flipping `active: false`, never deleted — the full
    history stays inspectable, and `recomputeDerived()` restores the
    original value automatically once an override is inactive.

## Editing your build vs. editing during play — a soft split, not a lock

Character creation writes to an isolated `draft` entity
(`app/creation/review.tsx`), separate from the list of finalized
characters, until `handleSave()` commits it. That save runs
`recomputeDerived → recalculateAllHP → recomputeDerived` — **twice**,
deliberately, so the final HP total is independent of *which order* you
made creation choices in (e.g. picking your class before vs. after setting
ability scores must land on the same HP).

Past that point, **nothing is locked by default.** The in-play sheet stays
fully editable, Free Edit included, at any time — there's no separate
"build mode" vs. "play mode" the app enforces structurally. The only gate
is a single DM-controlled house rule, `lockPlayerFreeEdit`:

```ts
freeEditAllowed = !playerFreeEditLocked(rules) || isDm
```

Worth knowing: this used to be gated on campaign membership (Free Edit
hidden simply for being "in a campaign"), and was deliberately changed —
being in a campaign no longer hides it on its own; the house-rule toggle is
now the only real control.

## Homebrew authoring style: structured per-type builders, not one generic form

Each content type gets its own purpose-built builder
(`app/homebrew/race-builder.tsx`, `class-builder.tsx`, `feat-builder.tsx`,
etc.) with fields matching that content type's real mechanics — e.g.
`race-builder.tsx` assembles `stat_modifier`/`grant_sense`/`grant_movement`
`Effect` objects from typed number/toggle inputs, not from a generic
picker. `TraitEditor.tsx` and `PickOrCustom.tsx`
(`src/components/homebrew/`) are shared sub-components reused for
trait-list editing across the race/subrace builders specifically.

Separately, `app/homebrew/feature-editor.tsx` is a **generic** builder used
for freeform homebrew features/feats. Its effect-type chip picker only
exposes **6 of the engine's 13** `Effect` types: `stat_modifier`,
`grant_proficiency`, `grant_resistance`, `grant_immunity`,
`apply_condition`, `base_ac_formula`. Missing from that generic picker:
`grant_resource`, `override_rule`, `suppress_condition_effects`,
`condition_immunity`, `grant_spell`, `grant_sense`, `grant_movement` — the
last two exist as real mechanics, just only reachable via race-builder's
own dedicated fields, not through the shared generic editor.

Validation is intentionally shallow right now: the only enforced rule is a
non-empty `name` gating the Save button. `homebrewStore.saveItem()` does no
schema validation of its own — it persists and upserts into the
type-specific in-memory array as given.

## House rules: three different behaviors under one system

`HOUSE_RULES` (`src/engine/houseRules.ts`) defines roughly 20 rules across
six sections — Character Build, Combat, Resting, Death & Recovery, DM
Visibility, Monster Info, Homebrew, and Table Reminders. A few worth
knowing about specifically:

- `skillOverlapMode` (`replacement`/`warn`) — the rule behind an earlier
  real bug (Bard's "choose any 3 skills" silently granting zero skills
  under `warn` mode).
- `asiMode` (`asi_or_feat` / `asi_only` / `feat_only` / `both`),
  `bonusFeatEveryLevel`, `featAtCreation`, point-buy budget/min/max,
  `flankingMode`, `hpMinHalfDie`, `largeCreatureWeaponDice`,
  `deathSavesPersist` (accumulated death-save failures carry over instead
  of resetting).
- `dmFullStatVisibility` — deliberately **gates DM Override visibility
  together with full stat visibility**, on the reasoning that "overriding a
  stat the DM can't see doesn't make sense."
- `allowHomebrew` (`off`/`campaign`/`global`), `homebrewNeedsApproval`,
  `lockPlayerFreeEdit` (see above).

Distinct from all of those: some entries carry `reminderOnly: true` — a
rule the engine displays as a table note but **never mechanically
enforces** (e.g. `critMaxPlusRoll`, potions-as-bonus-action, unlimited
rituals, opportunity-attacks-on-forced-movement). `activeReminders()`
surfaces just this subset. Worth remembering the app has two categories of
"house rule" — enforced and reminder-only — not one.

## The `sourceKind`/`sourceId` provenance convention

A deliberate, consistently-applied pattern: several runtime types carry an
optional field tracing what granted them, not just two isolated cases.
Confirmed present on `CustomResource.sourceKind`/`sourceId`,
`Feature.source: FeatureSource`, `ActiveEffect.sourceId`/`sourceKind`, and
`AuditEntry.sourceKind`/`sourceId` (typed `AuditSourceKind`, explicitly
documented in `types.ts` as mirroring `FeatureSource.kind` plus `'base'`
and `'dm_override'` — the code itself carries a comment flagging that the
two enums must be kept in sync). If a new runtime instance type is ever
added, giving it a `sourceKind`/`sourceId` pair is the established
convention, not a one-off.

**False friend to know about**: `Feat.source: string` is an unrelated
field — a sourcebook citation string ("PHB", "Xanathar's"), not a
provenance tag. Same name, different meaning; don't confuse the two when
reading or writing content code.

## Other implementation quirks

- **`Alert.alert` is a no-op on React Native Web.** Confirmed in
  `src/utils/alert.ts` — any new confirm/alert dialog must import `Alert`
  from this shim, not from `react-native`, or it will silently do nothing
  on web. The shim assumes every confirm-style call site follows a
  "Cancel first, action second" two-button shape and maps it onto
  `window.confirm` — a real assumption baked into the implementation, not
  just a convenience wrapper.
- **Full recompute, never incremental patching.** `recomputeDerived()` is
  explicitly documented as "pure and cheap — call it after every
  mutation," and that's exactly how it's used: every state change
  triggers a full spreadsheet-style recalculation from base data, never an
  incremental patch to derived stats. This discipline is also *why* the
  proposed Simulation primitive (see [ARCHITECTURE.md](ARCHITECTURE.md))
  would be cheap to add — before/after diffing is nearly free precisely
  because recompute-from-scratch is already the norm.
- **Wild Shape shadows HP with its own pool.** While transformed, damage
  and healing route to the beast form's separate HP pool instead of the
  player's real HP, which stays frozen and resumes exactly where it was on
  reverting — matching the actual 5e rule, and the fix for a real DM-side
  bug found earlier (DM damage controls were hitting real HP instead of
  the beast form's pool before this was corrected).
