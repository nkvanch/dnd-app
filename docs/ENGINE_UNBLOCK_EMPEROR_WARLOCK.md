# Engine unblock for the Emperor Warlock — what was built, and what is still the table's

Branch `emperor-warlock-engine-unblock` (off `simulation-preview`). Five engine/builder changes, then the real Emperor Warlock built on them. Governing rule throughout: **nothing is described as automated unless a test exercises it; everything else is marked table-resolved.**

## Corrections to the pre-work audit

Verified against the source before building; three claims were out of date:

- **"Nothing rolls for Recharge 5–6."** It does: `parseRechargeThreshold` / `rollRecharge` / `findRechargeableFeatures` (combat.ts), the 🎲 button on the sheet and in the DM encounter panel, and `monsterFactory` synthesizing a resource per "(Recharge 5-6)" feature. What was genuinely missing was a **dice-sized amount** (`1d3`) and resource-threshold gating — both added.
- **"There is no add-feature-to-character control."** `AddCustomFeatureModal` + `removeFeature` exist (DraftTrait authoring, optional resource, optional duration). What was missing: max-HP bonuses, picking a stored homebrew Feature, and replace-with-history tiers.
- **"Pact slots are hardcoded to `classId === 'warlock'`."** `CharClass.spellcastingStyle: 'pact'` already existed for slot *creation*; what was hardcoded was the short-rest recharge (`rest.ts`) and the table (always Warlock's). Both generalized. A **separate, pre-existing bug** was found on the way: a solo pact caster built through `levelUp` keeps its slots in `spellcasting.pactSlots`, and a short rest restored only `.slots` — **the official Warlock did not recover spell slots on a short rest.** Fixed, with a regression test (`pactShortRest.test.ts`).

## The five phases

| # | Before | After |
|---|---|---|
| 1 Item charges | Builder hardcoded `resourceCost: null`; no way to give an item a pool | `Item.resources`, a Charges section in the item builder (max, starting, cost, recharge, action type, regain dice), pool registered on first equip and kept across unequip so charges can't be refilled by swapping |
| 2 Ally effects | Nothing could affect anyone but its holder; Aura of Protection/Courage shipped as text | `Feature.allyGrants`: **aura** (holder ticks which allies are in range; re-synced on every change) and **chosen** grant (target picker → die / temp HP / timed effects / note token). Paladin Aura of Protection and Aura of Courage are now real, including self |
| 3 Mid-campaign grants | No max-HP effect; no tiered reward history | `max_hp` effect target (reconciled, never double-counts, never revives), `grantFeatureBundle` with lineage + tier, **replace not stack**, spent uses preserved, full Tier I→II→III ledger, Grant Reward UI |
| 4 Mode groups | One-off `wildShapeState` singleton | `Feature.modeGroup`: self-scope (one active option, level-gated entries, mode-owned pools that keep their spent amount, spirit-granted spells that vanish on switch) and target-scope (per-target option, re-pickable, ends with concentration); selectors `choice` / `table` (roll, physical roll, roll-N-pick-1, re-roll pool, free choice from level L); `displayLabel`/`subclassLabel` so pickers say "Bound Spirit" |
| 5 Recharge + triggers | Fixed recharge only; Death Burst was flavor text | `rechargeAmount` dice; `Effect.requiresResource` and `activation.requiresResource` (Pressure tiers, "can't use at 0"); `onZeroHp` triggers that queue a resolved-by-hand banner with a ready damage roll. Dust/Ice/Magma/Steam Mephit and Magmin Death Bursts are now mechanical |

Also added because the Emperor needed them (and are general): swappable `feature_pool` choices (`swapPoolChoice`, once per level, history kept), Mystic-Arcanum-style spell choices (`ChoiceDefinition.arcanum`), proficiency-scaled pools, short-rest-if-empty regain, "proficiency or expertise if already proficient" (`expertiseIfProficient`), `CharClass.spellListClassId`, mode entries that replace a same-id feature as they level (no stale duplicate).

## Emperor Warlock

`src/content/homebrewDemo/` — one self-contained `CharClass` (installed from Homebrew → Playtest content) carrying 12 Bound Spirits and 17 Imperial Edicts, so it exports/imports as a single pack (`validatePackageForImport` round-trip is tested).

Fully real: Legacy Binding (d12 table; Council of Spirits re-roll; Two Voices; Crown of Legends free choice — all selector config), Bound Spirit wording everywhere, Command Dice (= PB, d6/d8/d10, hand to self or an ally, ally spends it, Tireless Command), Edicts (2/6/10/14/17, swap on level-up), Pact Magic (own slot table, short-rest recovery), Eldritch Blast + chosen cantrips, Legacy Arcanum 6–9 (pool + spell picker + cast from pool), Extra Attack, Commanding Presence aura, spirit proficiencies/expertise/numbers/pools/save DCs/damage dice, spirit spells (1st–5th as known spells, 6th+ cast from the matching Arcanum pool).

**Table-resolved, by design** (each feature's own text says so under `Table-resolved:`): summoned mobs/mounts/heroes/armies/units (Open the Vodka, Bucephalus, War Elephant, Eagle and Jaguar Host, Heroes of the Odyssey, Kartvelebi/Khevsurebi, Eyes of the Khan — the *use* and recharge are tracked, the creature is not), campaign-scale projects (Take the Country, Dictator Perpetuo), recurring income (Tribute, Comrades Provide), calendar cadences (once/month, /7 days, /year — manual pools), terrain, positioning and "who is within N ft", forced movement, advantage against being frightened (the engine does not model save-type advantage), saving-throw proficiency from a feature (Saladin L20), modifying Eldritch Blast's damage/range (Imperial Blast, Long-Range Artillery).

## Known limits

- Aura membership and "within N ft" are ticked by hand; there is no battle map. Recipients of ally grants must be characters on the same device.
- Chosen-grant durations of rounds tick at the end of the *recipient's* turn; minute-long grants are dismissed by hand.
- Spells known per level and cantrip counts follow the Warlock's (the spec is silent); the pact slot table is the Warlock's own numbers, written as the class's own table.
- Mode features cannot carry their own pending choices, so "expertise in one of …" picks inside a spirit are table-resolved.
- Ability-score *minimum* effects ("becomes at least 22") are modeled as `set`; they would lower a score already above the value.
- Authoring UI for ally grants and mode groups is not built — they are typed content data (the Emperor Warlock pack, tests). The item builder and reward-grant flow are UI.
