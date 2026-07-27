// scripts/generate-obsidian-graph.js
// Generates a rich Obsidian vault from the Grimoire codebase.
// Each .ts/.tsx file becomes a documented .md note. Imports become [[wikilinks]].
// Hand-written descriptions cover the key engine / store / component files.
// Everything else gets auto-extracted signatures + any existing code comments.
//
// Run:  node scripts/generate-obsidian-graph.js
// Then: open docs/obsidian/ as an Obsidian vault → Ctrl+G for graph view.

const fs   = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT  = path.join(ROOT, 'docs', 'obsidian');
const EXTS = new Set(['.ts', '.tsx']);
const SKIP = ['node_modules', '.expo', 'dist', 'web-build', '__tests__', '.test.', '.spec.', 'scripts'];

// ═══════════════════════════════════════════════════════════════════════════════
// HAND-WRITTEN DESCRIPTIONS
// Keys are relative paths from project root (forward slashes, no leading /).
// ═══════════════════════════════════════════════════════════════════════════════

const FILE_DESCRIPTIONS = {

  // ── Engine ──────────────────────────────────────────────────────────────────

  'src/engine/types.ts': `
Central type definitions for the entire app. Every store, engine function, and
component imports from here. Changing a type here ripples everywhere, which is
why \`npx tsc --noEmit\` is the first check after edits.

Organised in numbered sections (comments in file): ability scores, conditions,
skill block, inventory, spell slots, spellcasting, choice system, feature/effect
system, entity master type, leveling schemas, campaign rules.
`.trim(),

  'src/engine/pipeline.ts': `
Derives the computed ("derived") stats of an entity from its raw ability scores,
active features, and all their effects. This runs every time something changes
on a character — equipping an item, gaining a level, toggling a condition.

The pipeline is a pure function: Entity → DerivedStats. Nothing in the UI should
compute AC, saving throws, passives, senses, or movement directly — it all flows
through here.
`.trim(),

  'src/engine/combat.ts': `
Combat resolution engine. Handles initiative rolling, turn sequencing, damage
application (with resistance/immunity), concentration checks, death save triggers,
and condition application / removal.

Does NOT store state — that lives in combatStore. This is a pure-ish module of
functions that take the current CombatState and return a new one.
`.trim(),

  'src/engine/leveling.ts': `
Level-up logic. Takes an entity and a target level, then walks each missing level
applying HP, grants (features, proficiencies, resources, spell slots), and queuing
any unresolved choices (skills, feats, ASIs, spells).

Also owns the choice-resolution functions: resolveChoice, applyAsiToEntity,
applyFeatToEntity. When a player makes a pick on a creation/level-up screen,
those functions apply the choice and mark it resolved.
`.trim(),

  'src/engine/rest.ts': `
Short and long rest recovery. A long rest fully restores HP, spell slots, and
resources marked full-on-long-rest. A short rest restores resources marked
short-rest and lets the player spend Hit Dice.

Reads the house rules (rest lengths, full-hit-dice-on-long-rest) so the
recovery behaviour matches the table's configured rules.
`.trim(),

  'src/engine/houseRules.ts': `
Registry and accessors for optional table rules. Rules are stored as key-value
pairs in CampaignRules.customRules (a Record<string, unknown>) so old saves
remain valid when new rules are added.

Three rule kinds: boolean (Book / Homebrew toggle), choice (pick one option),
and number (stepper). The HOUSE_RULES array drives both the Campaign Settings
UI and the engine accessor functions — add a rule once, it appears everywhere.

reminderOnly rules are surfaced as table notes but NOT auto-enforced (the app
doesn't model the action economy they would require).
`.trim(),

  'src/engine/dice.ts': `
Dice rolling utilities. rollExpression parses and evaluates dice strings like
"2d6+3" or "4d6kh3" (keep highest 3). Returns a DiceRoll with the total,
individual rolls, modifier, and an optional label.

Used directly by the GlobalDiceRoller and by engine functions that need
randomness (initiative, rolled HP on level-up, death saves).
`.trim(),

  'src/engine/actionCards.ts': `
Builds the ActionCard display objects shown on the Combat tab. Each card
represents an ability the player can use: its name, activation cost, range,
damage expression, save requirement, and tags.

Reads Feature.activation and Feature.abilityEffects — passive features (no
activation) are filtered out. Spells are resolved from ALL_SPELLS for their
full descriptor.
`.trim(),

  'src/engine/resolver.ts': `
Low-level effect resolver. Given a list of Effect objects for a stat, combines
them in the right order: set operations first, then add, then advantage track.

Used internally by pipeline.ts — components never call this directly.
`.trim(),

  'src/engine/featPrereq.ts': `
Evaluates whether an entity meets a feat's prerequisite string (e.g. "STR 13",
"Proficiency with martial weapons", "Spellcasting"). Used by AsiFeatPicker to
grey out unavailable feats and show the unmet requirement.
`.trim(),

  // ── Stores ──────────────────────────────────────────────────────────────────

  'src/store/characterStore.ts': `
Central Zustand store for character creation and per-session character state.
Holds the creation draft entity, the campaign rules, and the active
character entity once the sheet is open.

Also owns DEFAULT_RULES (the by-the-book CampaignRules) and makeEmptyEntity
(a blank entity with all required fields). Other stores import DEFAULT_RULES
from here rather than redefining it.
`.trim(),

  'src/store/campaignStore.ts': `
Manages the list of campaigns, the currently active campaign, and the
networking layer (hosting / joining via TCP). Imports DEFAULT_RULES from
characterStore so there's a single canonical definition.

The DM hosts a campaign server on port 7742 (0.0.0.0 bind). Players join with
a 6-character room code. State sync flows through syncManager.
`.trim(),

  'src/store/combatStore.ts': `
Holds the current CombatState (initiative order, round number, active turn).
Wraps the pure engine functions from combat.ts in store actions that also
persist the state to the database after each change.
`.trim(),

  'src/store/homebrewStore.ts': `
Library of homebrew content the player/DM has created: races, classes, spells,
backgrounds, features, items. Persists to the SQLite content cache. Content is
merged with official content when building pickers (race selector, spell list, etc).
`.trim(),

  'src/store/diceLogStore.ts': `
Shared dice-roll history (capped at 20 entries). Both the GlobalDiceRoller and
the exploration tab's tap-to-roll skill checks write here. The roller subscribes
and auto-opens when a new roll arrives from outside it.
`.trim(),

  'src/store/sessionStore.ts': `
Tracks the local device's session: deviceId, the player's claimed character ID,
and connection status. Persists across restarts so a player can reconnect to a
campaign without re-entering the room code.
`.trim(),

  // ── DB ──────────────────────────────────────────────────────────────────────

  'src/db/entityRepo.ts': `
SQLite read/write for Entity objects. Serialises the full entity to JSON for
storage and deserialises on load. Also provides loadAllEntityMeta for the entity
list (id + name only, fast) and loadEntity for the full record.
`.trim(),

  'src/db/campaignRepo.ts': `
SQLite read/write for Campaign objects and campaign membership. Handles the
mapping between a campaign and its member character IDs.
`.trim(),

  'src/db/contentCacheRepo.ts': `
SQLite read/write for homebrew content (HomebrewContent records). Uses a
ContentCacheType discriminant ('race' | 'class' | 'spell' | 'item' | etc.)
to store all content types in one table.
`.trim(),

  // ── Components ──────────────────────────────────────────────────────────────

  'src/components/AsiFeatPicker.tsx': `
The level-up picker for ASI levels. Lets the player choose between:
  +2 to one ability, +1 to two abilities, or a feat.

Enforces the asiMode house rule:
  asi_or_feat (book) — both tabs shown.
  asi_only / feat_only — the other tab hidden.
  both — player picks an ASI first, then is required to also pick a feat.

The "both" flow stashes the ASI-applied entity in bothEntity state, switches
to the feat tab, then applies the feat on top before calling onResolved.
`.trim(),

  'src/components/GlobalDiceRoller.tsx': `
Floating dice roller that lives on top of the character sheet. Reads its roll
history from diceLogStore (shared) so rolls triggered anywhere — including
skill taps in the exploration tab — appear here automatically.

Auto-opens via useEffect when a new roll id appears in the store that wasn't
there on the previous render.
`.trim(),

  'src/components/sheet/TabCharacter.tsx': `
The Combat view of Tab 1 on the character sheet. Shows HP (tappable to edit),
AC, initiative, saving throws, action cards (generated by actionCards.ts),
spell slots, class resources, and conditions.

Paired with TabExploration; the sheet's [Combat | Exploration] toggle swaps
between them.
`.trim(),

  'src/components/sheet/TabExploration.tsx': `
The Exploration view of Tab 1. Designed for out-of-combat use: vitals (HP/AC/Speed),
travel speeds (walking + fly/swim/climb from derived.movement), all three passives,
vision & senses editor, tap-to-roll skills (writes to diceLogStore), languages,
tools, conditions (add/remove), features with a manual exploration star,
spell list with level badge and tap-for-description modal, inventory quick view,
and categorised Notes & Clues (Objectives / NPCs / Clues / Locations + scratch).
`.trim(),

  'src/components/sheet/TabInventory.tsx': `
Full inventory management. Categorises items by their properties array (armor,
weapons, magic items, tools, adventuring gear, currency). Handles equip/unequip,
quantity changes, and the quick-add picker. Keys use \`eq_\${itemId}_\${idx}\`
and \`ca_\${itemId}_\${idx}\` to avoid duplicate-key crashes when the same item
appears multiple times.
`.trim(),

  'src/components/sheet/TabAbilities.tsx': `
Skills, saving throws, and ability score overview. Shows effective skill bonuses
(applying stat modifiers + proficiency + expertise). Tapping a skill rolls it.
`.trim(),

  'src/components/sheet/HpModal.tsx': `
Modal for HP changes during a session. Two inputs: damage (reduces current HP,
respects temporary HP first) and healing (restores up to maximum). Called from
both the combat and exploration views.
`.trim(),

  // ── Screens ─────────────────────────────────────────────────────────────────

  'app/sheet/[id].tsx': `
Root of the character sheet. Loads the entity by id, subscribes to Zustand for
live updates, and renders a tab bar (Character / Abilities / Inventory / Spells).

Tab 1 has a [⚔️ Combat | 🧭 Exploration] segmented toggle at the top that swaps
TabCharacter ↔ TabExploration. The rest bar at the bottom shows configured rest
lengths and triggers takeRest() from rest.ts.
`.trim(),

  'app/creation/name.tsx': `
Step 0 of character creation: character name, starting level, optional campaign
name. Has a Campaign Settings (📖) card that opens the rules screen — rules live
here in Character Basics, not as a creation flow step.
`.trim(),

  'app/creation/rules.tsx': `
Campaign Settings screen. Renders all rules from the HOUSE_RULES registry using
three control types: boolean (descriptive Book / Homebrew labels), choice (option
chips), and number (stepper). Changes write to CampaignRules.customRules.

Accessible from Character Basics before creation starts and also revisitable
from the hub. Not a mandatory step in the creation flow.
`.trim(),

  'app/creation/hub.tsx': `
Creation flow overview. Lists all creation steps (Race / Class / Scores /
Background / Skills / Equipment / Spells) with ✓ / pending status. A step's done
function inspects the draft entity to determine completion. Shows a Review button
once all required steps are done.
`.trim(),

  'app/creation/scores.tsx': `
Ability score assignment. Four methods: Standard Array, Point Buy (reads
pointBuyConfig(rules) for budget/min/max with cost extrapolated above 15 at
+2/point), Manual entry, and Roll (4d6 drop lowest). Saves a scoresConfirmed
flag to draft.notes so the hub can detect completion.
`.trim(),

  'app/creation/skills.tsx': `
Skill proficiency selection for class skill choices. Handles background overlap
in two modes set by the skillOverlapMode house rule:

  replacement — opens extra untrained skills so you always reach the full count.
  warn        — stays on the class list; shows an inline confirmation box when
                you'll lose picks (no Alert.alert — shown on-screen instead).

Has a ← Back button and a Case 2 (re-entering after resolved) path with a
Change Skills option.
`.trim(),

  'app/(tabs)/campaigns.tsx': `
Campaign management tab. DMs can host a new campaign (generates QR code / room
code, starts TCP server). Players join with a 6-character code. Shows live
connection status, last error, and a reconnect flow for players who disconnected.
`.trim(),

  'app/(tabs)/homebrew.tsx': `
Homebrew library tab. Two panels: Create (links to race/class/item/spell/feature
builders) and Library (lists all saved homebrew with type badge and delete option).
`.trim(),

  'app/homebrew/race-builder.tsx': `
Homebrew race builder. Fields: name, speed, size, ability bonuses (multi-select
chips), a Senses editor (type + range + note → grant_sense effects on a race
feature), and a Movement editor (fly/swim/climb/burrow speeds → grant_movement
effects). Both feed into derived.senses and derived.movement via the pipeline.
`.trim(),

  'app/homebrew/item-builder.tsx': `
Homebrew item builder. Fields: name, cost, weight, properties (comma-separated,
drives inventory categorisation). Optional mechanical effects: Armor AC (with
optional DEX add), Weapon damage (full FeatureActivation), Stat bonus, grant_sense,
or grant_movement. Effects generate a Feature with the appropriate Effect on the
item, which the pipeline picks up when the item is equipped.
`.trim(),

};

// ── Per-symbol descriptions ───────────────────────────────────────────────────
// Key: relative file path → symbol name → description string.

const SYMBOL_DESCRIPTIONS = {

  'src/engine/types.ts': {
    Entity:
      'The master data model for any character, monster, or NPC. Contains identity, ' +
      'raw ability scores, derived stats, skills, proficiencies, resources, spellcasting, ' +
      'inventory, conditions, conditionMonitor, features, choices, dmOverrides, and notes.',
    DerivedStats:
      'Computed stats produced by the pipeline — never stored raw, always re-derived. ' +
      'Includes AC, initiative, speed, proficiencyBonus, saving throws, attack bonuses, ' +
      'spell DCs, all three passives (Perception / Investigation / Insight), ' +
      'senses (Sense[]) and movement (MovementSpeeds).',
    Feature:
      'An ability, trait, or passive power on an entity. Has an effects array (passive ' +
      'pipeline effects like grant_sense or stat_modifier) and optional abilityEffects / ' +
      'activation for active use cards. The explorationTag? boolean marks it as exploration-relevant.',
    FeatureInstance:
      'Feature extended with an isActive boolean — used for togglable abilities ' +
      'like Rage or Wild Shape.',
    Effect:
      'A single mechanical modifier that the pipeline processes. type determines what ' +
      'it does: stat_modifier, base_ac_formula, grant_sense, grant_movement, grant_resource, ' +
      'grant_proficiency, apply_condition, etc.',
    ChoiceDefinition:
      'Describes a player choice: what kind (skill/feat/asi/spell/equipment/custom), ' +
      'how many picks, what the pool is (array of options, "all", or a filter). ' +
      'Embedded in the entity\'s choices array.',
    ChoiceState:
      'Runtime wrapper around a ChoiceDefinition: tracks whether the choice has been ' +
      'resolved, which selections were made, and at which level it was granted.',
    CampaignRules:
      'Campaign configuration: ability score cap, max level, HP mode, multiclass flag, ' +
      'and customRules (the house-rules bag). Do NOT add parallel typed fields — all ' +
      'house rules live in customRules via houseRules.ts accessors.',
    HouseRules:
      'REMOVED — was reverted. House rules live in CampaignRules.customRules ' +
      'and are accessed through houseRules.ts. See DEFAULT_HOUSE_RULES comment.',
    Sense: 'A special vision mode: type (darkvision/blindsight/tremorsense/truesight), range in feet, optional note (e.g. "in color", "thermal").',
    SenseType: 'Union of the four structured sense types the pipeline aggregates: darkvision | blindsight | tremorsense | truesight.',
    MovementSpeeds: 'Non-walking speed modes: fly?, swim?, climb?, burrow? (all optional number, feet). Populated by grant_movement effects.',
    ConditionMonitor: 'Full runtime condition state: active ActiveCondition[], exhaustion level (0-6), and a flags Record for runtime booleans like "rage_active".',
    ActiveCondition: 'A condition currently applied to an entity: its id, the feature/action that caused it (sourceId), optional duration, and suppressedBy.',
    SpellSlots: 'Record<"1"|"2"|...|"9", {total, used}> — slot tiers and current usage. Used slots are restored on long rest.',
    InventoryBlock: 'The entity\'s gear: equipped ItemInstance[], carried ItemInstance[], and Currency.',
    ItemInstance: 'A reference to an Item in the entity\'s inventory: itemId, quantity, attuned flag, and per-instance feature overrides.',
    ResourceBlock: 'HP (current/max/temp), Hit Dice (current/max/die), and a Record of named class resources like Rage charges or Ki points.',
    ProficiencyBlock: 'All proficiencies: armor categories, weapon categories, tools (string[]), languages (string[]), and savingThrows (Ability[]).',
    FeatureActivation:
      'Metadata for an active ability card: actionType, resourceCost, range, target, requiresSave. ' +
      'ALL fields are required — missing one causes a tsc error. Undefined = passive (no card).',
    AbilityEffect:
      'On-use effect (not pipeline): damage {dice, damageType} or heal {dice, bonusMod}. ' +
      'Lives in Feature.abilityEffects, shown on action cards, rolled via the dice roller.',
    Grant: 'A level-up reward: feature, resource, proficiency, spell slot upgrade, known spells, etc. Applied by applyGrant() in leveling.ts.',
  },

  'src/engine/pipeline.ts': {
    recomputeDerived:
      'Full pipeline pass: collects all effects from active features → applies stat ' +
      'modifiers → computes AC (base_ac_formula takes max across formulas) → initiative → ' +
      'speed → proficiency bonus → saving throws → passives → senses → movement → attack ' +
      'bonuses → spell DCs. Returns an updated Entity.',
    collectAllEffects:
      'Gathers every Effect from every active FeatureInstance on the entity, respecting ' +
      'condition gates (a feature whose condition flag isn\'t set in conditionMonitor.flags is skipped).',
    applyStatModifiers:
      'Applies all stat_modifier effects to the raw AbilityScores, returning effective ' +
      'scores. Used whenever a skill bonus or save needs the effective stat, not the raw one.',
    modifier:
      'Standard 5e ability modifier: ⌊(score − 10) / 2⌋. Used everywhere — saves, skills, ' +
      'initiative, spell DC, HP. Negative for scores below 10.',
  },

  'src/engine/combat.ts': {
    InitiativeEntry:
      'One slot in the combat turn order: entityId, the rolled initiative value, ' +
      'and a tiebreaker. The initiative order is sorted descending by value.',
    CombatState:
      'Full snapshot of an active encounter: active boolean, the initiative order array, ' +
      'current round number, and the active turn index into the order.',
    startEncounter:
      'Rolls initiative for all combatants (1d20 + DEX modifier), sorts the order, ' +
      'and returns the initial CombatState with round 1 / turn 0.',
    endTurn:
      'Advances the active turn index, wrapping to the next round when the last ' +
      'combatant acts. Applies any end-of-turn condition ticks.',
    concentrationCheck:
      'Rolls a CON saving throw when a concentrating caster takes damage. DC = max(10, damage / 2). ' +
      'Reads derived.savingThrows.con for the effective modifier (includes proficiency from ' +
      'Resilient feat). Grants advantage if the entity has the War Caster feat (feat_war_caster).',
    applyDamage:
      'Applies damage to an entity: checks resistance / immunity from conditionMonitor, ' +
      'drains temp HP first, then reduces current HP. Returns updated entity.',
  },

  'src/engine/leveling.ts': {
    levelUp:
      'Main entry point. Takes an entity and a target level, iterates each missing ' +
      'level applying HP (applyHP), grants (applyGrant), and choices (queueChoice). ' +
      'If bonusFeatEveryLevel rule is on, injects a bonus feat-only ASI choice at every level.',
    applyHP:
      'Applies the HP gain for one level. Level 1 always uses the full die. ' +
      'Fixed mode = ⌊die/2⌋+1. Max mode = die. Rolled mode = rollDie(die). ' +
      'Optional rules param: if hpMinHalfDie(rules) is true, rolled values below ⌈die/2⌉ are bumped up.',
    applyGrant:
      'Applies one Grant item from a level entry: adds a feature, upgrades a resource, ' +
      'grants a proficiency, adds spell slots, etc. Handles all Grant kinds from the union type.',
    resolveChoice:
      'Marks a ChoiceState resolved and applies the selections. For skill choices, grants ' +
      'trained proficiency. For spell choices, adds to known/cantrip list. For equipment ' +
      'choices, adds to inventory.',
    applyAsiToEntity:
      'Applies an ability score increase to an entity and marks the ASI choice resolved. ' +
      'Accepts a partial Record<Ability, 1|2> so both +2-one and +1+1-two are handled.',
    applyFeatToEntity:
      'Applies a feat\'s feature to the entity, grants any abilityChoice stat bonus or ' +
      'save proficiency, and marks the choice resolved. Called from AsiFeatPicker on confirm.',
    rollDie:
      'Rolls a single die of given sides. Used for rolled HP and any engine-side randomness.',
    recalculateAllHP:
      'Recomputes max HP from scratch (used when CON score changes mid-build). ' +
      'Does NOT re-roll in rolled mode — preserves previously rolled values stored on the entity.',
  },

  'src/engine/houseRules.ts': {
    HOUSE_RULES:
      'Registry array of all configurable table rules. Each entry is a HouseRuleDef ' +
      'with a stable key, kind (boolean/choice/number), section, default, labels, and description. ' +
      'Adding a rule here makes it appear in the Campaign Settings UI automatically.',
    HouseRuleDef:
      'Schema for one configurable rule: key (stable id), label (UI title), description, ' +
      'kind, section (groups in UI), bookLabel / homebrewLabel (for boolean controls), ' +
      'options / choiceDefault (for choice), numberDefault / min / max (for number), ' +
      'and reminderOnly (shown as a table note, not auto-enforced).',
    getHouseRule:   'Reads a boolean rule from customRules, falling back to bookDefault (always false = book).',
    getHouseChoice: 'Reads a choice rule\'s selected value string, falling back to choiceDefault.',
    getHouseNumber: 'Reads a numeric rule value, falling back to numberDefault.',
    setHouseRuleValue: 'Returns a new customRules object with one rule set. Spread into existing rules to preserve other settings.',
    skillOverlapMode: 'Returns "replacement" (never lose a skill pick) or "warn" (stay on class list, confirm loss). Default: replacement.',
    asiMode:        'Returns the ASI grant mode: asi_or_feat (book) | asi_only | feat_only | both.',
    bonusFeatEveryLevel: 'True if the table grants a bonus feat choice at every level, not just ASI levels.',
    hpMinHalfDie:   'True if rolled HP below half the die is bumped up to ⌈die/2⌉ on level-up.',
    critMode:       'Returns double_dice (book) or max_plus_roll. Reminder-only — the app does not auto-apply crits.',
    pointBuyConfig: 'Returns { points, max, min } for the point-buy ability score method. Reads three separate house rule keys.',
    shortRestMinutes: 'Returns the configured short rest length in minutes (1 / 10 / 60). Default: 60.',
    longRestHours:  'Returns the configured long rest length in hours (8 / 24). Default: 8.',
    monsterHpDisplay: 'Returns how much HP info players see: off | bloodied | percent | exact.',
    bloodiedThreshold: 'Returns the HP fraction considered bloodied (0.5 / 0.33 / 0.25). Default: 0.5.',
    activeReminders: 'Returns labels of all reminder-only rules currently toggled on — for surfacing as table notes.',
  },

  'src/engine/dice.ts': {
    rollExpression:
      'Parses and evaluates a dice expression string ("2d6+3", "4d6kh3", "1d20-1"). ' +
      'Returns a DiceRoll with total, individual rolls array, modifier, optional label, ' +
      'and a unique id used by diceLogStore to detect new rolls.',
    DiceRoll:
      'Result of rollExpression: id (unique per roll), total, rolls (individual die values), ' +
      'modifier, expression string, optional label. The id is used by GlobalDiceRoller ' +
      'to detect when a new roll was pushed from outside.',
  },

  'src/store/characterStore.ts': {
    useCharacterStore:
      'Zustand store. Key slices: draft (Entity | null for the creation flow), ' +
      'rules (CampaignRules for the current character), setDraft, setRules, saveEntity ' +
      '(persists to SQLite), loadEntity.',
    makeEmptyEntity:
      'Creates a blank Entity with every required field initialised to its zero value. ' +
      'senses: [], movement: {}, conditionMonitor: {active:[], exhaustion:0, flags:{}}, etc. ' +
      'Used at the start of character creation and by the monster factory.',
    DEFAULT_RULES:
      'The canonical by-the-book CampaignRules. Imported by campaignStore and combatStore ' +
      'so there is exactly one definition in the codebase. Includes houseRules set to all ' +
      'book defaults via DEFAULT_HOUSE_RULES.',
  },

  'src/store/diceLogStore.ts': {
    useDiceLogStore:
      'Zustand store with three actions: pushRoll (log a pre-computed DiceRoll), ' +
      'rollAndLog (roll an expression string + push result), clear. History is capped ' +
      'at 20 entries. The GlobalDiceRoller auto-opens when a new roll id appears.',
  },

  'src/components/AsiFeatPicker.tsx': {
    AsiFeatPicker:
      'Level-up choice picker. Renders +2, +1+1, and/or Feat tabs based on asiMode rule. ' +
      '"both" mode: apply ASI → stash in bothEntity state → switch to feat tab → ' +
      'apply feat on top of bothEntity → onResolved(combined). ' +
      'featOnly prop (for ad-hoc feats from the sheet) always forces the feat tab.',
  },

  'src/components/GlobalDiceRoller.tsx': {
    GlobalDiceRoller:
      'Floating dice roller overlay. Reads history from useDiceLogStore. A useEffect ' +
      'watches history[0].id — when it changes and the roller is closed, the roller ' +
      'auto-opens so the result is visible. This makes tap-to-roll skills "just work" ' +
      'without the player having to open the roller manually.',
  },

  'src/components/sheet/TabExploration.tsx': {
    TabExploration:
      'Exploration view. Key design choice: spell/ability "utility" filtering is NOT ' +
      'auto-detected (prose descriptions have no structured tag). Instead features have ' +
      'an explorationTag?: boolean the player sets manually (tap the star). ' +
      'Notes are serialised into entity.notes with a NOTES_MARKER fence for backward compat.',
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// FILE DISCOVERY
// ═══════════════════════════════════════════════════════════════════════════════

function walk(dir, results = []) {
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (SKIP.some(s => full.includes(s))) continue;
    if (entry.isDirectory()) walk(full, results);
    else if (EXTS.has(path.extname(entry.name))) results.push(full);
  }
  return results;
}

// ═══════════════════════════════════════════════════════════════════════════════
// IMPORT PARSING
// ═══════════════════════════════════════════════════════════════════════════════

function parseImports(content, filePath) {
  const found = new Set();
  const re = /^import\b[^;]*?from\s+['"]([^'"]+)['"]/gm;
  let m;
  while ((m = re.exec(content)) !== null) {
    const raw = m[1];
    if (!raw.startsWith('.')) continue;
    const base = path.resolve(path.dirname(filePath), raw);
    for (const c of [base, base + '.ts', base + '.tsx', path.join(base, 'index.ts'), path.join(base, 'index.tsx')]) {
      if (fs.existsSync(c)) { found.add(c); break; }
    }
  }
  return found;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SYMBOL EXTRACTION
// Extracts exported symbols with any preceding comment block.
// ═══════════════════════════════════════════════════════════════════════════════

function extractSymbols(content) {
  const symbols = [];

  // Pattern: optional comment block + export declaration
  const pattern = /((?:\/\*\*[\s\S]*?\*\/\s*|\/\/[^\n]*\n\s*)*)export\s+((?:default\s+)?(?:async\s+)?(?:function|class|const|let|type|interface|enum))\s+(\w+)([^{;=\n]*)/gm;

  let m;
  while ((m = pattern.exec(content)) !== null) {
    const rawComment = (m[1] || '').trim();
    const keyword    = m[2].trim();
    const name       = m[3];
    const rest       = (m[4] || '').trim();

    // Clean up the extracted comment
    let comment = rawComment
      .replace(/\/\*\*|\*\//g, '')
      .replace(/^\s*\*\s?/gm, '')
      .replace(/\/\/\s?/g, '')
      .trim();

    // Skip internal/private-looking symbols
    if (name.startsWith('_')) continue;

    // Build a signature line
    let sig = '';
    if (keyword.includes('function')) {
      sig = `${name}${rest.split('{')[0].trim()}`;
    } else if (keyword.includes('const') || keyword.includes('let')) {
      sig = `${name}${rest.split('=')[0].trim()}`;
    } else {
      sig = name;
    }

    // Determine category
    let category = 'Constants';
    if (keyword.includes('function')) category = 'Functions';
    else if (keyword.includes('class')) category = 'Classes';
    else if (keyword.includes('type') || keyword.includes('interface')) category = 'Types';
    else if (keyword.includes('enum')) category = 'Enums';

    symbols.push({ name, sig: sig.trim(), comment, category, keyword });
  }

  // De-duplicate by name (keep first occurrence)
  const seen = new Set();
  return symbols.filter(s => {
    if (seen.has(s.name)) return false;
    seen.add(s.name);
    return true;
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

const relPath  = p => path.relative(ROOT, p).replace(/\\/g, '/');
const noExt    = p => p.replace(/\.(tsx?|jsx?)$/, '');
const noteSlug = p => noExt(relPath(p)).replace(/\//g, '__').replace(/[()]/g, '');
const noteLabel= p => {
  const base = path.basename(noExt(p));
  // For index files, use parent folder name to avoid collision
  if (base === 'index') return path.basename(path.dirname(p));
  return base;
};

function noteType(p) {
  const r = relPath(p);
  if (r.startsWith('src/engine/'))      return 'Engine';
  if (r.startsWith('src/store/'))       return 'Store';
  if (r.startsWith('src/components/'))  return 'Component';
  if (r.startsWith('src/content/'))     return 'Content';
  if (r.startsWith('src/db/'))          return 'Database';
  if (r.startsWith('src/sync/'))        return 'Sync';
  if (r.startsWith('src/'))             return 'Misc';
  if (r.startsWith('app/creation/'))    return 'Screen · Creation';
  if (r.startsWith('app/sheet/'))       return 'Screen · Sheet';
  if (r.startsWith('app/homebrew/'))    return 'Screen · Homebrew';
  if (r.startsWith('app/(tabs)/'))      return 'Screen · Tab';
  if (r.startsWith('app/'))             return 'Screen';
  return 'Other';
}

function noteTags(p) {
  return ['grimoire', noteType(p).toLowerCase().replace(/[·\s]+/g, '-')];
}

// ═══════════════════════════════════════════════════════════════════════════════
// NOTE BUILDER
// ═══════════════════════════════════════════════════════════════════════════════

function buildNote(filePath, imports, usedBy, allSet) {
  const r    = relPath(filePath);
  const type = noteType(filePath);
  const tags = noteTags(filePath);
  const name = noteLabel(filePath);
  const slug = noteSlug(filePath);

  // Read source for symbol extraction
  const source    = fs.readFileSync(filePath, 'utf-8');
  const symbols   = extractSymbols(source);
  const symDesc   = SYMBOL_DESCRIPTIONS[r] ?? {};
  const fileDesc  = FILE_DESCRIPTIONS[r] ?? '';

  const L = [];

  // ── Frontmatter ─────────────────────────────────────────────────────────────
  L.push('---');
  L.push(`tags: [${tags.join(', ')}]`);
  L.push(`type: "${type}"`);
  L.push(`source: "${r}"`);
  L.push('---');
  L.push('');

  // ── Title + meta ────────────────────────────────────────────────────────────
  L.push(`# ${name}`);
  L.push('');
  L.push(`> **${type}**  ·  \`${r}\``);
  L.push('');

  // ── File description ─────────────────────────────────────────────────────────
  if (fileDesc) {
    L.push(fileDesc);
    L.push('');
    L.push('---');
    L.push('');
  }

  // ── Symbols grouped by category ──────────────────────────────────────────────
  const CATEGORY_ORDER = ['Types', 'Enums', 'Classes', 'Functions', 'Constants'];
  const byCategory = {};
  for (const cat of CATEGORY_ORDER) byCategory[cat] = [];
  for (const sym of symbols) (byCategory[sym.category] ??= []).push(sym);

  // Sort within each category alphabetically
  for (const cat of CATEGORY_ORDER) {
    byCategory[cat].sort((a, b) => a.name.localeCompare(b.name));
  }

  let hasSymbols = false;
  for (const cat of CATEGORY_ORDER) {
    const syms = byCategory[cat];
    if (!syms?.length) continue;
    hasSymbols = true;
    L.push(`## ${cat}`);
    L.push('');

    for (const sym of syms) {
      // Signature as inline code in the heading
      L.push(`### \`${sym.sig}\``);
      L.push('');

      // Hand-written description takes priority
      const handDesc = symDesc[sym.name];
      if (handDesc) {
        L.push(handDesc);
        L.push('');
      } else if (sym.comment) {
        // Auto-extracted comment from code
        L.push(sym.comment);
        L.push('');
      }
    }
  }

  if (!hasSymbols && !fileDesc) {
    L.push('*No exported symbols detected.*');
    L.push('');
  }

  // ── Dependency links ─────────────────────────────────────────────────────────
  const deps = [...imports].filter(i => allSet.has(i)).sort((a, b) => relPath(a).localeCompare(relPath(b)));
  const consumers = [...(usedBy.get(filePath) ?? [])].filter(c => allSet.has(c)).sort((a, b) => relPath(a).localeCompare(relPath(b)));

  if (deps.length || consumers.length) {
    L.push('---');
    L.push('');
  }

  if (deps.length) {
    L.push('## Imports');
    L.push('');
    for (const d of deps) {
      L.push(`- [[${noteSlug(d)}|${noteLabel(d)}]]  ·  \`${relPath(d)}\``);
    }
    L.push('');
  }

  if (consumers.length) {
    L.push('## Used by');
    L.push('');
    for (const c of consumers) {
      L.push(`- [[${noteSlug(c)}|${noteLabel(c)}]]  ·  \`${relPath(c)}\``);
    }
    L.push('');
  }

  return L.join('\n');
}

// ═══════════════════════════════════════════════════════════════════════════════
// INDEX NOTE
// ═══════════════════════════════════════════════════════════════════════════════

function buildIndex(files) {
  const ORDER = [
    'Engine', 'Store', 'Database', 'Sync',
    'Component',
    'Screen · Tab', 'Screen · Sheet', 'Screen · Creation', 'Screen · Homebrew', 'Screen',
    'Content', 'Misc', 'Other',
  ];
  const byType = {};
  for (const f of files) (byType[noteType(f)] ??= []).push(f);

  const L = [
    '---', 'tags: [grimoire, index]', '---', '',
    '# Grimoire — Code Map', '',
    'Auto-generated by `scripts/generate-obsidian-graph.js`. Re-run after code changes.',
    '',
    '**Ctrl+G** (Win) / **Cmd+G** (Mac) → graph view.',
    '',
    '## Graph tips', '',
    '| Tip | How |',
    '|-----|-----|',
    '| Colour by layer | Graph → Groups → Add group → filter by tag (`engine`, `store`, `component`, `screen-·-creation` …) |',
    '| Focus on one file | Click a node → depth slider to expand neighbourhood |',
    '| Hide content noise | Filters → toggle off `content` tag |',
    '| Find a function | Ctrl+O → type the function name → opens its note |',
    '',
    '## Layers', '',
    '```',
    '  Screens (app/)         ← what the player sees',
    '       ↓',
    '  Components (src/components/)  ← reusable UI blocks',
    '       ↓',
    '  Stores (src/store/)    ← Zustand state + persistence',
    '       ↓',
    '  Engine (src/engine/)   ← pure logic, no UI',
    '       ↓',
    '  Content (src/content/) ← static data (spells, feats, items…)',
    '```',
    '',
    '---',
    '',
  ];

  for (const type of ORDER) {
    const group = byType[type];
    if (!group?.length) continue;
    L.push(`## ${type}`);
    L.push('');
    for (const f of group.sort((a, b) => noteLabel(a).localeCompare(noteLabel(b)))) {
      const desc = FILE_DESCRIPTIONS[relPath(f)];
      const oneliner = desc ? '  — ' + desc.split('\n')[0] : '';
      L.push(`- [[${noteSlug(f)}|${noteLabel(f)}]]${oneliner}`);
    }
    L.push('');
  }

  return L.join('\n');
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════════

function main() {
  console.log('🔍  Scanning…');
  const files  = [...walk(path.join(ROOT, 'src')), ...walk(path.join(ROOT, 'app'))];
  const allSet = new Set(files);
  console.log(`    ${files.length} TypeScript files found`);

  console.log('🔗  Parsing imports…');
  const importsMap = new Map();
  for (const f of files) {
    importsMap.set(f, parseImports(fs.readFileSync(f, 'utf-8'), f));
  }

  const usedBy = new Map();
  for (const [f, deps] of importsMap) {
    for (const d of deps) {
      if (!usedBy.has(d)) usedBy.set(d, new Set());
      usedBy.get(d).add(f);
    }
  }

  console.log('📝  Writing notes…');
  if (fs.existsSync(OUT)) fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });

  for (const f of files) {
    const note    = buildNote(f, importsMap.get(f), usedBy, allSet);
    const outPath = path.join(OUT, noteSlug(f) + '.md');
    fs.writeFileSync(outPath, note, 'utf-8');
  }

  fs.writeFileSync(path.join(OUT, 'index.md'), buildIndex(files), 'utf-8');

  // Obsidian vault config + graph colour groups
  const dot = path.join(OUT, '.obsidian');
  fs.mkdirSync(dot, { recursive: true });
  fs.writeFileSync(path.join(dot, 'app.json'), JSON.stringify({ legacyEditor: false, livePreview: true }, null, 2));
  fs.writeFileSync(path.join(dot, 'graph.json'), JSON.stringify({
    colorGroups: [
      { query: 'tag:engine',              color: { a: 1, rgb: 0xD84040 } },  // red
      { query: 'tag:store',               color: { a: 1, rgb: 0xFF8C00 } },  // orange
      { query: 'tag:component',           color: { a: 1, rgb: 0x4078C0 } },  // blue
      { query: 'tag:screen',              color: { a: 1, rgb: 0x4CAF50 } },  // green
      { query: 'tag:screen-·-creation',   color: { a: 1, rgb: 0x8BC34A } },  // light green
      { query: 'tag:content',             color: { a: 1, rgb: 0x9E9E9E } },  // grey
      { query: 'tag:database',            color: { a: 1, rgb: 0x9C27B0 } },  // purple
    ],
    hideUnresolved: true,
    repelStrength: 12,
    linkDistance: 200,
    scale: 1,
  }, null, 2));

  console.log(`\n✅  ${files.length} notes → docs/obsidian/`);
  console.log('\n   Open Obsidian → "Open folder as vault" → D:\\Documents\\dnd-app\\docs\\obsidian');
  console.log('   Ctrl+G for graph  ·  Ctrl+O to search by symbol name\n');
}

main();
