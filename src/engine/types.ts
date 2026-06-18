// ============================================================================
// FILE: src/engine/types.ts
// PROJECT: D&D 5e Rules & State Mutation Engine Contract
//
// STRUCTURE:
//   1. Primitive aliases & shared enums
//   2. Static content schemas   (Race, Class, Spell, Item, …)
//   3. Entity runtime schemas   (Identity, Stats, Resources, …)
//   4. Condition system
//   5. Feature & passive Effect system   ← fires in recomputeDerived
//   6. Entity master type
//   7. Leveling schemas
//   8. DM Override system               ← separate record, applied LAST in pipeline
//   9. Audit trail system               ← every derived value is explainable
//  10. Action card system               ← active effects, card generator types
//  11. Sync & campaign system           ← offline-first, local WiFi sync
//  12. Dice roller
// ============================================================================

// ── 1. Primitive aliases & shared enums ─────────────────────────────────────

export type Ability = 'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha';

export type SkillName =
  | 'athletics' | 'acrobatics' | 'sleight_of_hand' | 'stealth'
  | 'arcana' | 'history' | 'investigation' | 'nature' | 'religion'
  | 'animal_handling' | 'insight' | 'medicine' | 'perception' | 'survival'
  | 'deception' | 'intimidation' | 'performance' | 'persuasion';

export type AdvantageState   = 'straight' | 'advantage' | 'disadvantage';
export type ResistanceState  = 'none' | 'resistance' | 'immunity' | 'vulnerability';
export type StrategyKind     = 'stat_modifier' | 'named_bonus' | 'advantage_track' | 'temp_hp' | 'base_ac_formula';

export interface AttackBonus {
  id:    string;
  name:  string;
  bonus: number;
  type:  'melee' | 'ranged' | 'spell' | string;
}

export type FilterExpression = Record<string, unknown>;

export type Action = {
  id:          string;
  name:        string;
  description: string;
};

export type GrantResult = {
  type:     string;
  targetId: string;
  value:    unknown;
};

export type CampaignRules = {
  maxAbilityScore: number | null;
  maxLevel:        number | null;
  useXP:           boolean;
  hpMode:          'fixed' | 'rolled' | 'max';
  allowMulticlass: boolean;
  customRules:     Record<string, unknown>;
};

// ── 2. Static content schemas ────────────────────────────────────────────────

/**
 * A subrace is a mandatory variant of a race.
 * Dwarves must choose Hill or Mountain; Elves must choose High, Wood, or Drow; etc.
 * Subrace features stack on top of base race features — all are applied.
 */
export type Subrace = {
  id:       string;
  name:     string;
  parentId: string;    // id of the parent Race
  features: Feature[];
};

export type Race = {
  id:        string;
  name:      string;
  features:  Feature[];    // base race features — all subraces get these
  subraces?: Subrace[];    // if present, player must pick one before confirming race
};
export type CharClass  = {
  id:          string;
  name:        string;
  hitDie:      number;
  features:    Feature[];     // level-1 features (backward-compat; Phase 2 uses levelFeatures)
  description?: string;

  // ── Phase 2: authored progression data (all optional) ─────────────────────────
  // When present, buildProgressionFromClass uses these instead of stub defaults.
  savingThrows?:          Ability[];     // e.g. ['str', 'con']
  armorProfs?:            string[];      // 'light' | 'medium' | 'heavy' | 'shield'
  weaponProfs?:           string[];      // 'simple' | 'martial'
  spellcastingAbility?:   Ability;       // 'int' | 'wis' | 'cha'
  spellcastingStyle?:     'full' | 'half' | 'pact'; // slot table to use
  spellcastingStartLevel?: number;       // first level that gets spell slots (default 1)
  asiLevels?:             number[];      // defaults to [4,8,12,16,19]
  // Per-level features authored by the player (replaces cls.features for level 1+)
  levelFeatures?:         { level: number; name: string; description: string }[];
  /**
   * Escape hatch for hand-authored classes too complex for the simplified
   * builder fields (subclass features, known-spell grants, custom slot tables,
   * per-level effect-bearing features). When present, getProgressionForClass
   * uses this verbatim and ignores all the simplified fields above. The class
   * builder cannot create this — it's only set by seeded built-in homebrew or
   * the import pipeline — and editing such a class in the builder will drop it.
   */
  rawProgression?:        ClassProgression;
};
export type Background = { id: string; name: string; features: Feature[] };
export type Condition  = { id: string; name: string; description: string; features: Feature[] };

export type Item = {
  id:         string;
  name:       string;
  weight:     number;
  cost:       string;
  properties: string[];
  features:   Feature[];
};

/**
 * A feat. Selected in place of an Ability Score Increase.
 * `feature` is the Feature applied when the feat is taken; it carries any
 * automated Effects (e.g. a fixed +1 to an ability, +5 initiative). Feats whose
 * benefits can't be fully automated yet still apply as a named, described Feature
 * the player tracks manually.
 */
export type Feat = {
  id:           string;
  name:         string;
  prerequisite: string | null;
  description:  string;
  source:       string;
  feature:      Feature;
};

export type ContentDB = {
  races:       Race[];
  classes:     CharClass[];
  backgrounds: Background[];
  spells:      Spell[];
  items:       Item[];
  conditions:  Condition[];
  features:    Feature[];
  feats?:      Feat[];   // optional so existing ContentDB literals remain valid
};

// ── 3. Entity runtime schemas ────────────────────────────────────────────────

export type Identity = {
  name:         string;
  level:        number;
  raceId:       string;
  subRaceId:    string | null;   // e.g. 'hill_dwarf', 'wood_elf' — null until player picks
  classId:      string;
  subclassId:   string | null;
  backgroundId: string;
  alignment:    string | null;
  xp:           number;
};

export type AbilityScores = Record<Ability, number>;

/** Computed from base stats + effects. Never set manually — always recomputed. */
export type DerivedStats = {
  proficiencyBonus:  number;
  ac:                number;
  initiative:        number;
  speed:             number;
  passivePerception: number;
  savingThrows:      Record<Ability, number>;
  attackBonuses:     AttackBonus[];
  spellSaveDC:       number | null;
  spellAttackBonus:  number | null;
};

/**
 * The scalar numeric fields inside DerivedStats that DM overrides may target.
 * savingThrows and attackBonuses are excluded — they are compound, not scalar.
 */
export const DERIVED_NUMERIC_KEYS = new Set<string>([
  'proficiencyBonus', 'ac', 'initiative', 'speed',
  'passivePerception', 'spellSaveDC', 'spellAttackBonus',
]);

export type SkillEntry = {
  ability:   Ability;
  trained:   boolean;
  expertise: boolean;
  bonus:     number | null;
};

export type SkillBlock = {
  skills: Record<SkillName, SkillEntry>;
};

export type ProficiencyBlock = {
  armor:        string[];
  weapons:      string[];
  tools:        string[];
  languages:    string[];
  savingThrows: Ability[];
};

export type HPBlock = {
  current: number;
  maximum: number;
  temp:    number;
};

/** Tracks the pool of hit dice available for short-rest healing. */
export type HitDiceBlock = {
  die:       number;   // Die size: 6, 8, 10, or 12
  total:     number;   // Equals character level
  remaining: number;   // How many are left to spend
};

export type CustomResource = {
  id:       string;
  name:     string;
  current:  number;
  maximum:  number;
  recharge: 'short_rest' | 'long_rest' | 'dawn' | 'never' | string;
};

export type ResourceBlock = {
  hp:      HPBlock;
  hitDice: HitDiceBlock;
  speed:   number;
  ac:      number;   // 0 = no armor; pipeline falls back to 10 + DEX
  custom:  CustomResource[];
};

export type ChoiceOption = {
  id:    string;
  label: string;
  value: unknown;
};

export type ChoiceDefinition = {
  id:       string;
  prompt:   string;
  kind:     'skill' | 'spell' | 'language' | 'tool' | 'equipment' | 'feat' | 'asi' | 'custom';
  count:    number;
  pool:     ChoiceOption[] | 'all' | FilterExpression;
  grants:   Grant[];
  required: boolean;
  resolved: boolean;
};

export type ChoiceState = {
  id:         string;
  definition: ChoiceDefinition;
  grantedAt:  number;
  resolved:   boolean;
  selections: string[];
};

export type SlotEntry   = { total: number; used: number };
export type SpellSlots  = Record<'1'|'2'|'3'|'4'|'5'|'6'|'7'|'8'|'9', SlotEntry>;

export type SpellcastingBlock = {
  ability:       Ability;
  slots:         SpellSlots;
  cantrips:      string[];
  known:         string[];
  prepared:      string[];
  concentrating: string | null;
};

export type Spell = {
  id:                       string;
  name:                     string;
  level:                    0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
  school:                   string;
  castingTime:              string;
  range:                    string;
  components:               string[];
  duration:                 string;
  description:              string;
  upcast:                   string | null;
  ritual:                   boolean;
  concentration:            boolean;
  /** Class IDs that can cast this spell (lowercased, e.g. 'wizard'). Drives class-filtered spell lists. */
  classes?:                 string[];
  /** Features applied to caster while concentrating — removed when concentration drops. */
  onConcentrationFeatures?: Feature[];
};

export type Currency     = { pp: number; gp: number; ep: number; sp: number; cp: number };

export type ItemInstance = {
  itemId:   string;
  quantity: number;
  attuned:  boolean;
  features: Feature[];
};

export type InventoryBlock = {
  equipped: ItemInstance[];
  carried:  ItemInstance[];
  currency: Currency;
};

// ── 4. Condition system ──────────────────────────────────────────────────────

/**
 * Structured duration tracker.
 * Every expirable effect (conditions, spells, buffs) uses this shape.
 */
export type DurationTracker = {
  unit:       'rounds' | 'minutes' | 'hours' | 'until_rest' | 'permanent';
  remaining:  number;
  expiresAt?: number;   // Absolute round number, for display
};

/**
 * A condition currently applied to an entity.
 * suppressedBy holds IDs of features that silence this condition's effects
 * WITHOUT removing the condition (e.g. Blindsight suppresses Blinded penalties).
 */
export type ActiveCondition = {
  id:           string;
  sourceId:     string;
  duration:     DurationTracker | null;
  suppressedBy: string[];
};

/**
 * Live condition state on an entity.
 * exhaustion is tracked as a numeric level (0–6), separate from the condition list.
 * flags is a runtime boolean map: "rage_active", "concentrating", etc.
 *   These gate conditional passive effects in collectAllEffects().
 */
export type ConditionMonitor = {
  active:     ActiveCondition[];
  exhaustion: number;
  flags:      Record<string, boolean>;
};

// ── 5. Feature & passive Effect system ──────────────────────────────────────

/**
 * FeatureSource.kind includes 'subclass' which must propagate to AuditEntry.sourceKind
 * (see section 9) to prevent type errors when audit.ts reads fi.source.kind.
 */
export type FeatureSource = {
  kind:  'race' | 'class' | 'subclass' | 'background' | 'feat'
       | 'item' | 'spell' | 'condition' | 'campaign';
  refId: string;
};

/**
 * Passive effects. These fire inside recomputeDerived().
 * They modify stats, grant proficiencies, apply conditions, etc.
 * For active (on-use) effects see AbilityEffect in section 10.
 */
export type Effect = {
  type:      'stat_modifier' | 'grant_proficiency' | 'grant_resistance' | 'grant_immunity'
           | 'apply_condition' | 'grant_resource' | 'override_rule' | 'base_ac_formula'
           | 'suppress_condition_effects' | 'condition_immunity'
           // Grants spells/cantrips to known spell list; safe on racial features
           // (initialises spellcasting if not yet active).
           | 'grant_spell';
  target:    string;
  operation: 'add' | 'multiply' | 'set' | 'advantage' | 'disadvantage'
           | 'resistance' | 'immunity' | 'vulnerability' | 'suppress';
  value:     number | string | string[] | null;
  condition: string | null;
  formulaAbilities?: Ability[];
  /**
   * Per-ability cap applied AFTER the modifier is computed, for medium armor.
   * e.g. { dex: 2 } means "add DEX modifier but cap it at +2".
   * Only meaningful when the ability appears in formulaAbilities.
   */
  formulaAbilityCap?: Partial<Record<Ability, number>>;
  // ── grant_spell-specific fields ───────────────────────────────────
  cantripIds?:         string[];
  spellIds?:           string[];
  spellcastingAbility?: Ability;
};

/**
 * A Feature is the universal rule container.
 * Everything in the system grants features: races, classes, backgrounds,
 * items, spells, conditions, and homebrew content.
 *
 * PASSIVE features: have effects[] that fire in recomputeDerived().
 * ACTIVE features:  also have activation + abilityEffects that fire when a card is used.
 * Both can coexist — Rage has passive resistance effects AND active "set flag" effects.
 */
export type Feature = {
  id:          string;
  name:        string;
  description: string;
  source:      FeatureSource;
  level:       number | null;
  /** Passive effects — fire in recomputeDerived(). Do not put combat dice here. */
  effects:     Effect[];
  actions:     Action[];
  choices:     ChoiceDefinition[];
  passive:     boolean;

  // ── Active ability fields (optional — undefined = passive feature, no card generated) ──
  /** How this ability is activated. null/undefined = passive, no Action Card generated. */
  activation?:    FeatureActivation;
  /** Classification tags used by the card generator. */
  tags?:          ActionCardTag[];
  /** Active effects that fire when the player uses this ability (NOT in recomputeDerived). */
  abilityEffects?: AbilityEffect[];
};

/** Feature with a runtime isActive flag for toggled abilities (Rage, Wild Shape, etc.). */
export type FeatureInstance = Feature & {
  isActive: boolean;
};

// ── 6. Entity master type ────────────────────────────────────────────────────

/**
 * The master entity. Characters, monsters, and NPCs all share this shape.
 *   conditions       = flat active condition list for UI rendering.
 *   conditionMonitor = full runtime state: exhaustion, flags, suppressions.
 *   dmOverrides      = DM stat overrides, applied LAST in recomputeDerived().
 *                      Entity base data is NEVER modified by overrides.
 *                      Cancel = set active:false, values restore automatically.
 */
export type Entity = {
  id:               string;
  kind:             'character' | 'monster' | 'npc';
  identity:         Identity;
  stats:            AbilityScores;
  derived:          DerivedStats;
  skills:           SkillBlock;
  proficiencies:    ProficiencyBlock;
  resources:        ResourceBlock;
  spellcasting:     SpellcastingBlock | null;
  inventory:        InventoryBlock;
  conditions:       ActiveCondition[];
  conditionMonitor: ConditionMonitor;
  features:         FeatureInstance[];
  choices:          ChoiceState[];
  dmOverrides:      DmOverride[];     // always [] for new entities
  notes:            string;
};

// ── 7. Leveling schemas ──────────────────────────────────────────────────────

export type LevelEntry = {
  level:   number;
  grants:  Grant[];
  choices: ChoiceDefinition[];
  hpDie:   4 | 6 | 8 | 10 | 12;
};

export type ClassProgression = {
  classId: string;
  entries: LevelEntry[];
};

export type Grant = {
  kind:  'feature' | 'resource' | 'resource_upgrade' | 'spell_slots' | 'proficiency'
       | 'speed' | 'subclass_unlock' | 'init_spellcasting' | 'known_spells';
  value: unknown;
};

/**
 * 'known_spells' grant value — adds fixed spell/cantrip ids to an already-
 * initialized spellcasting block (must come after 'init_spellcasting' in the
 * same level entry's grants array). Used for classes/races that grant specific
 * known spells rather than a player choice (e.g. innate spellcasting, or a
 * subclass that knows fixed spells at a given level).
 */
export type KnownSpellsGrant = {
  spellIds?:   string[];
  cantripIds?: string[];
};

/**
 * Proficiency grant — used by the class progression `proficiency` grant kind.
 * Each field is an array of string identifiers. Any field may be omitted.
 */
export type ProficiencyGrant = {
  armor?:     string[];
  weapons?:   string[];
  tools?:     string[];
  languages?: string[];
};

export type ResourceGrant = {
  resourceId: string;
  name:       string;
  maximum:    number;
  recharge:   'short_rest' | 'long_rest' | 'dawn' | 'never';
};

export type ResourceUpgrade = {
  resourceId: string;
  newMaximum: number;
};

export type SpellSlotRow = {
  level: number;
  slots: [number, number, number, number, number, number, number, number, number];
};

/** An Effect tagged with source metadata for the stacking resolver. */
export type ActiveEffect = {
  effect:     Effect;
  sourceName: string;
  sourceId:   string;
  appliedAt:  number;
};

// ── 8. DM Override system ────────────────────────────────────────────────────

/**
 * DM overrides apply on top of fully-computed derived stats.
 * They NEVER modify entity.stats, entity.features, or any base data.
 * Cancelling: set active = false → recomputeDerived restores originals automatically.
 * Multiple overrides on the same stat all apply in order of appliedAt.
 *
 * Override targets are limited to scalar numeric fields in DerivedStats.
 * See DERIVED_NUMERIC_KEYS for the allowed set.
 * savingThrows individual values e.g. "savingThrows.str" are targeted as strings.
 */
export type DmOverrideTarget =
  | 'proficiencyBonus' | 'ac' | 'initiative' | 'speed'
  | 'passivePerception' | 'spellSaveDC' | 'spellAttackBonus'
  | `savingThrows.${Ability}`   // e.g. "savingThrows.str"
  | string;                     // custom homebrew stats

export type DmOverride = {
  id:          string;
  campaignId:  string;
  entityId:    string;
  dmDeviceId:  string;

  /** Which derived stat is overridden. */
  stat:        DmOverrideTarget;
  operation:   'set' | 'add';
  value:       number;

  /**
   * Human-readable label shown in the audit trail and DM panel.
   * e.g. "Cursed by Artifact", "Encounter buff", "Bless (manual)"
   */
  label:       string;

  /** If true this override is applied in recomputeDerived. If false it is cancelled. */
  active:      boolean;
  appliedAt:   number;
  cancelledAt: number | null;

  /**
   * When to auto-expire:
   *   'manual'           = DM cancels explicitly
   *   'end_of_encounter' = cleared when DM ends the encounter
   *   'end_of_session'   = cleared on long rest
   */
  expiry: 'manual' | 'end_of_encounter' | 'end_of_session';
};

// ── 9. Audit trail system ────────────────────────────────────────────────────

/**
 * AuditEntry.sourceKind mirrors FeatureSource.kind plus 'base' and 'dm_override'.
 * 'subclass' is explicitly included to avoid type errors when reading fi.source.kind.
 */
export type AuditSourceKind =
  | 'base'        // raw stat, 10 + DEX, proficiency bonus formula
  | 'race'
  | 'class'
  | 'subclass'    // must be here — FeatureSource.kind includes 'subclass'
  | 'background'
  | 'feat'
  | 'item'
  | 'spell'
  | 'condition'
  | 'campaign'
  | 'dm_override';

/** One contribution to a derived value. */
export type AuditEntry = {
  label:      string;           // "DEX modifier", "Chain shirt", "DM override — cursed"
  value:      number;           // the contribution (positive, negative, or zero for notes)
  sourceKind: AuditSourceKind;
  sourceId:   string | null;    // feature/item/override ID, or null for base values
};

/** The full breakdown of how a derived value was computed. */
export type AuditTrail = {
  stat:    string;
  total:   number;
  entries: AuditEntry[];
};

// ── 10. Action card system ───────────────────────────────────────────────────

/**
 * How an active ability is used.
 * If activation is null/undefined on a Feature, no Action Card is generated.
 */
export type FeatureActivation = {
  actionType:   'action' | 'bonus_action' | 'reaction' | 'free' | 'passive';
  resourceCost: ResourceCost | null;
  range:        string | null;   // "self", "30 feet", "touch", etc.
  target:       'self' | 'single' | 'area' | 'multiple';
  requiresSave: { ability: Ability; dc: 'spell_save_dc' | number } | null;
};

/** Describes what resource(s) an ability consumes when used. */
export type ResourceCost = {
  /** ID from CustomResource or "spell_slots". */
  resourceId:     string;
  quantity:       number;
  /** For spell slots: minimum tier required (1–9). */
  spellSlotTier?: 1|2|3|4|5|6|7|8|9;
};

/**
 * Active effects fire when a player uses an ability (taps the action card).
 * These do NOT fire in recomputeDerived — that is the passive Effect system.
 * Phase 2 (option A): app shows dice expression, player announces it. No target selection.
 */
export type AbilityEffect =
  | { type: 'damage';           dice: string; damageType: string; saveOnSuccess?: 'half' | 'none' }
  | { type: 'heal';             dice: string; bonusMod?: Ability }
  | { type: 'apply_condition';  conditionId: string; duration: DurationTracker }
  | { type: 'remove_condition'; conditionId: string }
  | { type: 'grant_speed';      speedType: 'fly' | 'swim' | 'climb' | 'walk'; amount: number; duration: DurationTracker }
  | { type: 'transform';        formId: string }
  | { type: 'set_flag';         flag: string; value: boolean }
  | { type: 'spend_resource';   resourceId: string; amount: number }
  | { type: 'restore_resource'; resourceId: string; amount: number | 'full' };

/** Tags used to classify a feature and choose its card type. */
export type ActionCardTag =
  | 'damage' | 'healing' | 'buff' | 'control' | 'utility'
  | 'movement' | 'aoe' | 'concentration' | 'save' | 'attack' | 'transformation';

/** One of 6 card types. Determines card color and template. */
export type ActionCardType = 'damage' | 'healing' | 'buff' | 'control' | 'utility' | 'transformation';

/** Color of an action card in the UI. */
export type ActionCardColor = 'red' | 'green' | 'blue' | 'purple' | 'gray';

/**
 * The compiled, UI-ready representation of a Feature for the Actions tab.
 * Generated by generateActionCards() in actionCards.ts.
 * The same feature may appear in multiple tabs (same card, different context).
 */
export type ActionCard = {
  featureId:  string;
  name:       string;
  cardType:   ActionCardType;
  color:      ActionCardColor;

  /** Layer 1: source and type  e.g. "Lv 3 Spell • Damage" */
  layer1: string;
  /** Layer 2: key effect       e.g. "8d6 Fire • 20 ft radius" */
  layer2: string;
  /** Layer 3: save/attack/note e.g. "Dex Save (half)" — null if not needed */
  layer3: string | null;

  activation:   FeatureActivation;
  resourceCost: ResourceCost | null;

  /** Which sheet tabs this card appears in. Same feature, multiple contexts. */
  tabs: ('actions' | 'spellcasting' | 'features' | 'inventory')[];

  /** Runtime — recomputed on every render. Greyed-out when unavailable. */
  available:         boolean;
  /** e.g. "No 3rd-level spell slots remaining", "Already concentrating" */
  unavailableReason: string | null;
};

// ── 11. Sync & campaign system ───────────────────────────────────────────────

/**
 * All state mutations emit a SyncEvent.
 * Events are stored locally in SQLite with applied=false until the device
 * processes them, then applied=true. Unflushed events are replayed on reconnect.
 */
export type SyncChangeType =
  | 'hp_change'
  | 'resource_spend'
  | 'resource_restore'
  | 'condition_apply'
  | 'condition_remove'
  | 'spell_slot_spend'
  | 'spell_slot_restore'
  | 'dm_override_apply'
  | 'dm_override_cancel'
  | 'combat_event'
  | 'initiative_update'
  | 'entity_full_sync';     // sent when a player first joins — full entity snapshot

export type SyncEvent = {
  id:             string;
  sessionId:      string;
  entityId:       string;
  changeType:     SyncChangeType;
  payload:        unknown;
  authorDeviceId: string;
  timestamp:      number;
  applied:        boolean;
};

/**
 * One device's identity within the sync system.
 * deviceId is a UUID generated once on first install (stored in SecureStore).
 * No accounts or logins required.
 */
export type DeviceSession = {
  deviceId:   string;
  nickname:   string;   // "Nick's iPad" — user sets once
  role:       'dm' | 'player';
  campaignId: string | null;
};

export type SessionLogEntry = {
  id:        string;
  summary:   string;
  date:      number;   // timestamp
};

export type Quest = {
  id:          string;
  name:        string;
  description: string;
  status:      'active' | 'completed' | 'failed';
};

/**
 * A campaign is owned by one DM device.
 * Players join via a 6-digit room code (+ QR code) that resolves to the DM's local IP.
 */
export type Campaign = {
  id:           string;
  name:         string;
  dmDeviceId:   string;
  /** 6-digit code shown to players. Resolves to DM's local IP over WiFi. */
  joinCode:     string;
  rules:        CampaignRules;
  playerIds:    string[];
  characterIds: string[];
  notes:        string;
  createdAt:    number;
  /** DM-authored session summaries, newest first. */
  sessionLog?:  SessionLogEntry[];
  /** Quest tracker — DM manages status. */
  quests?:      Quest[];
};

/** A single event recorded in the combat log during a session. */
export type CombatEventType =
  | 'damage' | 'heal' | 'condition_apply' | 'condition_remove'
  | 'cast' | 'action_used' | 'death' | 'revive' | 'dm_override' | 'note';

export type CombatLogEntry = {
  id:        string;
  sessionId: string;
  round:     number;
  timestamp: number;
  type:      CombatEventType;
  actorId:   string;
  targetId:  string | null;
  /** Human-readable summary e.g. "Aric cast Fireball — roll 8d6 fire" */
  label:     string;
  value:     number | null;
};

// ── 12. Dice roller ──────────────────────────────────────────────────────────

/**
 * A single resolved dice roll.
 * Supports standard notation: "2d6+3", "1d20", "4d6kh3" (keep highest 3).
 */
export type DiceRoll = {
  id:         string;
  expression: string;    // original expression e.g. "2d6+3"
  rolls:      number[];  // individual die results before modifier
  modifier:   number;    // flat modifier
  total:      number;    // sum of rolls + modifier
  label:      string | null;   // "Attack roll", "Damage", "Ability score" etc.
  timestamp:  number;
};
