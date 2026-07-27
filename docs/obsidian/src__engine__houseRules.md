---
tags: [grimoire, engine]
type: "Engine"
source: "src/engine/houseRules.ts"
---

# houseRules

> **Engine**  ·  `src/engine/houseRules.ts`

Registry and accessors for optional table rules. Rules are stored as key-value
pairs in CampaignRules.customRules (a Record<string, unknown>) so old saves
remain valid when new rules are added.

Three rule kinds: boolean (Book / Homebrew toggle), choice (pick one option),
and number (stepper). The HOUSE_RULES array drives both the Campaign Settings
UI and the engine accessor functions — add a rule once, it appears everywhere.

reminderOnly rules are surfaced as table notes but NOT auto-enforced (the app
doesn't model the action economy they would require).

---

## Types

### `HouseRuleDef`

Schema for one configurable rule: key (stable id), label (UI title), description, kind, section (groups in UI), bookLabel / homebrewLabel (for boolean controls), options / choiceDefault (for choice), numberDefault / min / max (for number), and reminderOnly (shown as a table note, not auto-enforced).

### `HouseRuleKind`

### `HouseRuleOption`

## Functions

### `activeReminders(rules: CampaignRules): string[]`

Returns labels of all reminder-only rules currently toggled on — for surfacing as table notes.

### `asiMode(rules: CampaignRules): 'asi_or_feat' | 'asi_only' | 'feat_only' | 'both'`

Returns the ASI grant mode: asi_or_feat (book) | asi_only | feat_only | both.

### `bloodiedThreshold(rules: CampaignRules): number`

Returns the HP fraction considered bloodied (0.5 / 0.33 / 0.25). Default: 0.5.

### `bonusFeatEveryLevel(rules: CampaignRules): boolean`

True if the table grants a bonus feat choice at every level, not just ASI levels.

### `critMode(rules: CampaignRules): 'double_dice' | 'max_plus_roll'`

Returns double_dice (book) or max_plus_roll. Reminder-only — the app does not auto-apply crits.

### `deathSavesPersist(rules: CampaignRules): boolean`

### `getHouseChoice(rules: CampaignRules, key: string): string`

Reads a choice rule's selected value string, falling back to choiceDefault.

### `getHouseNumber(rules: CampaignRules, key: string): number`

Reads a numeric rule value, falling back to numberDefault.

### `getHouseRule(rules: CampaignRules, key: string): boolean`

Reads a boolean rule from customRules, falling back to bookDefault (always false = book).

### `hpMinHalfDie(rules: CampaignRules): boolean`

True if rolled HP below half the die is bumped up to ⌈die/2⌉ on level-up.

### `longRestHours(rules: CampaignRules): number`

Returns the configured long rest length in hours (8 / 24). Default: 8.

### `longRestRestoresAllHitDice(rules: CampaignRules): boolean`

### `monsterHpDisplay(rules: CampaignRules): 'off' | 'bloodied' | 'percent' | 'exact'`

Returns how much HP info players see: off | bloodied | percent | exact.

### `playerFreeEditLocked(rules: CampaignRules): boolean`

### `pointBuyConfig(rules: CampaignRules):`

Returns { points, max, min } for the point-buy ability score method. Reads three separate house rule keys.

### `revealMonsterAc(rules: CampaignRules): 'never' | 'after_hit' | 'always'`

### `setHouseRule(rules: CampaignRules, key: string, value: boolean): Record<string, unknown>`

### `setHouseRuleValue(`

Returns a new customRules object with one rule set. Spread into existing rules to preserve other settings.

### `shortRestMinutes(rules: CampaignRules): number`

Returns the configured short rest length in minutes (1 / 10 / 60). Default: 60.

### `skillOverlapMode(rules: CampaignRules): 'replacement' | 'warn'`

Returns "replacement" (never lose a skill pick) or "warn" (stay on class list, confirm loss). Default: replacement.

### `usesLargeCreatureWeaponDice(rules: CampaignRules): boolean`

── Convenience predicates ───────────────────────────────────────────────────

## Constants

### `HOUSE_RULES: HouseRuleDef[]`

Registry array of all configurable table rules. Each entry is a HouseRuleDef with a stable key, kind (boolean/choice/number), section, default, labels, and description. Adding a rule here makes it appear in the Campaign Settings UI automatically.

---

## Imports

- [[src__engine__types|types]]  ·  `src/engine/types.ts`

## Used by

- [[app__creation__hub|hub]]  ·  `app/creation/hub.tsx`
- [[app__creation__rules|rules]]  ·  `app/creation/rules.tsx`
- [[app__creation__scores|scores]]  ·  `app/creation/scores.tsx`
- [[app__creation__skills|skills]]  ·  `app/creation/skills.tsx`
- [[app__sheet__[id]|[id]]]  ·  `app/sheet/[id].tsx`
- [[src__components__AsiFeatPicker|AsiFeatPicker]]  ·  `src/components/AsiFeatPicker.tsx`
- [[src__components__sheet__TabInventory|TabInventory]]  ·  `src/components/sheet/TabInventory.tsx`
- [[src__engine__actionCards|actionCards]]  ·  `src/engine/actionCards.ts`
- [[src__engine__leveling|leveling]]  ·  `src/engine/leveling.ts`
- [[src__engine__rest|rest]]  ·  `src/engine/rest.ts`
