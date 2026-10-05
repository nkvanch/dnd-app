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

/**
 * Compile-time-only nominal typing for content ids — `Brand<string,'X'>` is
 * still a plain string at runtime (JSON/SQLite round-trips need no changes),
 * it just stops TypeScript from accepting a SpellId where a RaceId is
 * expected. Deliberately applied only at a few verified-unambiguous sites
 * (see the branded types below) — most content ids stay plain `string`
 * because they're either polymorphic (e.g. FeatureSource.refId holds a
 * different content type's id depending on `kind`) or hand-authored as
 * string literals across src/content/** in volumes that would make a full
 * branding rollout a large mechanical change for no near-term payoff. See
 * docs/NEW architecture/ (or the fundamental-changes migration plan) for
 * the full reasoning.
 */
type Brand<K, T extends string> = K & { readonly __brand: T };

export type RaceId       = Brand<string, 'RaceId'>;
export type SubraceId    = Brand<string, 'SubraceId'>;
export type ClassId      = Brand<string, 'ClassId'>;
export type SubclassId   = Brand<string, 'SubclassId'>;
export type BackgroundId = Brand<string, 'BackgroundId'>;
export type FeatId       = Brand<string, 'FeatId'>;
export type SpellId      = Brand<string, 'SpellId'>;
export type ItemId       = Brand<string, 'ItemId'>;
export type ConditionId  = Brand<string, 'ConditionId'>;
export type MonsterId    = Brand<string, 'MonsterId'>;
/** Not yet used — added now so the Phase 4 ContentHeader/rulesetId work doesn't need to reintroduce the Brand<> pattern. */
export type RulesetId    = Brand<string, 'RulesetId'>;
/**
 * Identifies a GAME SYSTEM (D&D, Pathfinder, Old-School Essentials, …) — one
 * level above RulesetId (a specific edition/printing WITHIN a game, e.g.
 * 'dnd5e-2014' vs 'dnd5e-2024'). Content is never tagged with a GameId
 * directly — only with a RulesetId — a content item's game is always
 * DERIVED via `gameIdForRuleset()` (src/content/rulesets.ts), which looks
 * the ruleset up in the static RULESETS registry and returns its `gameId`.
 * This is deliberate: duplicating the same Game value onto every content
 * definition alongside its RulesetId would be redundant, derivable data —
 * exactly the kind of duplicated-truth the ruleset/source/pack metadata
 * work (see ContentProvenance below) is designed to avoid.
 */
export type GameId       = Brand<string, 'GameId'>;

export const asRaceId       = (id: string): RaceId       => id as RaceId;
export const asSubraceId    = (id: string): SubraceId    => id as SubraceId;
export const asClassId      = (id: string): ClassId      => id as ClassId;
export const asSubclassId   = (id: string): SubclassId   => id as SubclassId;
export const asBackgroundId = (id: string): BackgroundId => id as BackgroundId;
export const asFeatId       = (id: string): FeatId       => id as FeatId;
export const asSpellId      = (id: string): SpellId      => id as SpellId;
export const asItemId       = (id: string): ItemId       => id as ItemId;
export const asConditionId  = (id: string): ConditionId  => id as ConditionId;
export const asMonsterId    = (id: string): MonsterId    => id as MonsterId;
export const asRulesetId    = (id: string): RulesetId    => id as RulesetId;
export const asGameId       = (id: string): GameId       => id as GameId;

/**
 * Documented reference shape, NOT a structural base type — no content type
 * `extends`/intersects this. Every content type (Race, CharClass, Spell,
 * Item, Feat, Background, ClassProgression, MonsterTemplate) informally
 * carries an `id`/`name`/`rulesetId?`/`srd?` shape close to this one, but
 * `Condition` doesn't carry `srd`, and nothing in the app today needs to
 * treat "any content type" polymorphically — restructuring every type to
 * literally extend a shared base would touch every content file for no
 * current consumer, the same mistake Phase 3 avoided for full id branding.
 * Exists here purely so the intended common shape has one documented name.
 */
export type ContentHeader = {
  id:         string;
  name:       string;
  /** Undefined = available under every ruleset (every piece of content authored before 5.5e, i.e. everything today). */
  rulesetId?: RulesetId;
  srd?:       boolean;
};

/**
 * True if a piece of content (via its own optional `rulesetId`) should be
 * visible under `activeRuleset`. Untagged content (`contentRulesetId`
 * undefined) is shared across every ruleset — most content stays untagged
 * indefinitely (5.5e reuses most 5e content unchanged, so only the pieces
 * 5.5e actually revises need to be tagged). An untagged `activeRuleset`
 * means no filter is active (matches everything) — the state of every
 * character/screen until Phase 6 ships an actual ruleset picker.
 */
export function matchesRuleset(
  contentRulesetId: RulesetId | undefined,
  activeRuleset:    RulesetId | undefined,
): boolean {
  return contentRulesetId === undefined || activeRuleset === undefined || contentRulesetId === activeRuleset;
}

/**
 * Same "untagged = shared/matches everything" compatibility policy as
 * matchesRuleset, one level up: a content item's Game is never stored
 * directly (see GameId's doc comment) — it's derived by resolving
 * `contentRulesetId` through the RULESETS registry (src/content/rulesets.ts,
 * which calls this indirectly via matchesGame there — kept here only as
 * the boolean-semantics primitive both matchesRuleset and matchesGame
 * share, so the "undefined means universal" rule is defined exactly once).
 */
export function matchesOptionalTag<T>(contentTag: T | undefined, activeTag: T | undefined): boolean {
  return contentTag === undefined || activeTag === undefined || contentTag === activeTag;
}

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
  /** Historically the equipped item's `itemId` (definition id) for a weapon
   *  attack, or a synthetic id ('unarmed_strike') otherwise — kept exactly
   *  as-is for every existing consumer. When TWO equipped instances share
   *  an `itemId`, computeWeaponAttackBonuses (pipeline.ts) still produces
   *  one AttackBonus per instance (never deduplicated), but `id` alone can
   *  no longer tell them apart — see `instanceId` below, the item-identity
   *  closure's fix for that. */
  id:          string;
  /** Item-identity closure: the equipped ItemInstance's own `id` (owned-
   *  copy identity), when the instance has one — undefined for a synthetic
   *  entry (Unarmed Strike) or a still-unmigrated instance. Lets a caller
   *  that HAS a specific ItemInstance in hand (e.g. actionCards.ts's
   *  equipped-item loop) find the EXACT matching AttackBonus instead of
   *  `.find(a => a.id === itemId)`'s old first-match-only behavior, which
   *  silently returned the same entry for every instance sharing itemId. */
  instanceId?: string;
  name:        string;
  bonus:       number;
  type:        'melee' | 'ranged' | 'spell' | string;
  ability:     'str' | 'dex';
  damageBonus: number;
  damageDice:  string;
  damageType:  string;
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

export type AbilityGenerationMode = 'standard' | 'pointbuy' | 'manual' | 'roll';
export type PointBuyConfig = { budget:number; minimum:number; maximum:number; costs:Record<number,number> };

export type CampaignRules = {
  maxAbilityScore: number | null;
  maxLevel:        number | null;
  useXP:           boolean;
  hpMode:          'fixed' | 'rolled' | 'max';
  allowMulticlass: boolean;
  customRules:     Record<string, unknown>;
  abilityGenerationMode?: AbilityGenerationMode;
  pointBuy?: PointBuyConfig;
};

/** Named, persisted overrides for rule values the current engine already understands. */
export type CustomRuleProfile = {
  id: string;
  name: string;
  gameId: GameId;
  baseRulesetId: RulesetId;
  rules: Partial<CampaignRules> & { customRules?: Record<string, unknown> };
  source: { kind: 'local' | 'imported' | 'preset'; label?: string };
  createdAt: number;
  updatedAt: number;
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
  // Not branded RaceId, despite being unambiguous in meaning — reverted
  // after discovering it has the same volume problem as Race.id itself:
  // every hand-authored subrace literal (~44 in src/content/races/index.ts
  // alone) sets this inline, so branding would force an `as RaceId` cast
  // onto each one for the same "no near-term payoff" reason Race.id etc.
  // are excluded. See the Brand<> comment near the top of this file.
  parentId: string;    // id of the parent Race
  features: Feature[];
  /**
   * Overrides the parent Race's size for this subrace specifically (e.g. a
   * "Giant" skeleton subrace that's Large while the base Skeleton race is
   * Medium). Mirrors Race.size's own optional shape — undefined means
   * "same size as the parent race." See isLargeCreature() in
   * engine/actionCards.ts for the one mechanical consumer (doubling weapon
   * damage dice for a Large creature, per the DMG house rule).
   */
  size?: Race['size'];
  /**
   * Resource pools this subrace grants (e.g. a limited-use racial ability).
   * Applied the same way class-level resource grants are — via applyGrant
   * with {kind:'resource', value: r} — reusing existing, already-tested
   * engine code rather than inventing new application logic for races.
   */
  resources?: ResourceGrant[];
  /**
   * Choices queued (not auto-resolved) at race-selection time — e.g. Variant
   * Human's "proficiency in one skill of your choice." Queued via
   * leveling.ts's queueChoice at grantedAt=0, alongside subrace feature
   * application in race-detail.tsx's selectRace(), then resolved through
   * whichever creation screen already generically handles that choice kind
   * (skills.tsx for 'skill', etc.) — same pending-choice objects, just
   * queued from race selection instead of leveling up a class.
   */
  pendingChoices?: ChoiceDefinition[];
  /**
   * Subrace-scoped version of Race.flexibleAsi — for a subrace that
   * replaces the base race's flat ASI with a player-directed one (e.g.
   * Variant Human), rather than every subrace of that race needing it (most
   * don't; Dragonborn's ancestryChoice is race-level precisely because it
   * DOES apply to every subrace). Only active once this specific subrace is
   * selected — see race-detail.tsx's `flexAsi` derivation.
   */
  flexibleAsi?: Race['flexibleAsi'];
  /**
   * Subrace-scoped OVERRIDE of Race.ancestryChoice — for a subrace whose
   * own ancestry-style choice replaces the base race's rather than adding
   * to it (e.g. Fizban's Chromatic/Metallic/Gem Dragonborn each choose from
   * their OWN narrower 5-color list with different mechanics, not the base
   * 10-color PHB list). When set, race-detail.tsx uses THIS instead of
   * `race.ancestryChoice` once the subrace is selected — the two never
   * combine. Most subraces leave this unset and simply inherit the race's
   * ancestryChoice unchanged (or the race has none at all).
   */
  ancestryChoice?: Race['ancestryChoice'];
  /**
   * Base race Feature ids this subrace replaces rather than adds to — e.g.
   * Variant Human replaces `human_asi` (its flat all-abilities-+1) with its
   * own `flexibleAsi` choice instead of stacking on top of it. Filtered out
   * of `race.features` before application in race-detail.tsx's
   * selectRace(). Most subraces (Hill Dwarf, High Elf, etc.) leave this
   * unset — they genuinely ADD to the base race per RAW.
   */
  replacesBaseFeatureIds?: string[];
  /** SRD 5.1 legal status — same semantics as Spell.srd. See docs/ROADMAP_1.0.md Phase 1 Step 1.4. */
  srd?:     boolean;
  /** Which ruleset this subrace belongs to. Undefined = available under every ruleset. See the ContentHeader comment near the top of this file. */
  rulesetId?: RulesetId;
  /**
   * Raw builder state, same purpose as Race.homebrewDraft (see that field's
   * doc comment) — lets app/homebrew/subrace-builder.tsx reload a standalone
   * subrace's exact authoring state on edit. A subrace authored inline while
   * building a brand-new race (race-builder.tsx's SubraceEditor) doesn't need
   * this — that flow's parent Race.homebrewDraft.subraces already carries the
   * full draft. The engine itself never reads this field.
   */
  homebrewDraft?: Record<string, unknown>;
};

/**
 * Required id prefix for every entry in Race/Subrace.pendingChoices — lets
 * race-detail.tsx's clearRaceFeatures() sweep previously-queued race choices
 * on race change/re-selection without needing to know each race's specific
 * choice ids in advance.
 */
export const RACE_CHOICE_PREFIX = 'race_choice_';

/**
 * One option within a Race.ancestryChoice — e.g. one dragon color for
 * Dragonborn's Draconic Ancestry. `feature` is a complete Feature (may
 * combine passive effects like grant_resistance with an active ability like
 * a breath weapon, same as Rage does) applied via applyGrant when this
 * option is picked, mirroring how a 'feature_pool' ChoiceDefinition option's
 * `value` is a full Feature literal — but resolved immediately alongside
 * subrace selection on the race-detail screen instead of as a deferred
 * pending choice, since (like subrace) it's decided once at race-pick time.
 */
export type AncestryOption = {
  id:      string;
  name:    string;
  blurb:   string;
  /** Applied via applyGrant when this option is chosen. Optional so an
   * option whose only outcome is a queued choice (see `pendingChoice`
   * below) doesn't need a no-op placeholder Feature. */
  feature?: Feature;
  /**
   * Queued (not auto-resolved) when this specific option is chosen — e.g.
   * Half-Elf Versatility's "Skill Versatility" option grants 2 skills of
   * the player's choice, which can't be expressed as a single fixed
   * Feature the way every other Versatility option can. Same RACE_CHOICE_
   * PREFIX/queueChoice mechanism as Race/Subrace.pendingChoices.
   */
  pendingChoice?: ChoiceDefinition;
};

export type Race = {
  id:        string;
  name:      string;
  features:  Feature[];    // base race features — all subraces get these
  subraces?: Subrace[];    // if present, player must pick one before confirming race
  /**
   * When true, `subraces` are alternates the player may opt into rather than
   * a mandatory split — e.g. Dragonborn's PHB form is already complete on
   * its own, and Wildemount's Draconblood/Ravenite are optional variants on
   * top of it (unlike Elf/Dwarf/Halfling/Gnome, where every PHB subrace is
   * itself mandatory — no plain, subrace-less version of those exists).
   * Defaults to false/unset, preserving every existing race's required
   * behavior.
   */
  subracesOptional?: boolean;
  /**
   * A same-screen, always-required choice within the race itself (not a
   * subrace) — e.g. Dragonborn's Draconic Ancestry, chosen alongside (and
   * independently of) any subrace. Applied via race-detail.tsx exactly like
   * subrace selection: pick one, its `feature` grants on confirm.
   */
  ancestryChoice?: { prompt: string; options: AncestryOption[] };
  /**
   * A player-directed ability score bonus — "two other ability scores of
   * your choice each increase by 1" (Half-Elf, Variant Human) or the
   * Tasha's/Fizban's-style "one score +2 and a different +1, OR three
   * different scores +1 each" flexible split. Resolved on the same screen
   * as subrace/ancestry (not a deferred pending choice), and compiled into
   * a single generated Feature's stat_modifier effects on confirm — see
   * race-detail.tsx's flexAsi state and applyGrant call.
   */
  flexibleAsi?: {
    prompt: string;
    mode:
      | { kind: 'two_distinct_plus_one'; exclude?: Ability[] }
      /**
       * restrictTo, added for Background.flexibleAsi (2024 backgrounds
       * restrict the split to 3 background-relevant abilities, e.g.
       * Acolyte's Wisdom/Intelligence/Charisma — unlike Variant Human/
       * Half-Elf's unrestricted any-ability picker). Undefined = any
       * ability, preserving every existing race's unrestricted behavior.
       */
      | { kind: 'two_one_or_three_one'; restrictTo?: Ability[] }
      /** Exactly "one ability +2 and a different ability +1" — no three-way alternative (Ballast). */
      | { kind: 'two_and_one' };
  };
  /** Same as Subrace.pendingChoices — see that field's doc comment. */
  pendingChoices?: ChoiceDefinition[];
  /** Same as Subrace.resources — see that field's doc comment. */
  resources?: ResourceGrant[];
  /**
   * Flavor/reference fields shown on the race detail screen. Official races
   * get this data from a hardcoded lookup table (app/creation/race-
   * detail.tsx's RACE_DETAIL) for historical reasons; homebrew races have
   * no such table to fall into, so these fields let a homebrew race
   * self-describe directly. race-detail.tsx prefers these when present,
   * falling back to RACE_DETAIL for the 9 official races that don't set them.
   */
  age?:         string;
  size?:        'Tiny' | 'Small' | 'Medium' | 'Large';
  languages?:   string[];
  /** Short flavor blurb shown at the top of the race detail screen. */
  description?: string;
  /**
   * Raw builder state (traits, subrace drafts, etc.) preserved alongside the
   * compiled `features`/`subraces` above, so editing an existing homebrew
   * race in the builder can reload the exact authoring state losslessly
   * instead of reverse-engineering it from compiled Effects (which loses
   * information — e.g. a flavor-only trait and a trait whose effect
   * resolved to nothing look identical once compiled). The engine itself
   * never reads this field; only race-builder.tsx does. Opaque/untyped
   * deliberately — this is builder-internal shape, not an engine contract.
   */
  homebrewDraft?: Record<string, unknown>;
  /**
   * SRD 5.1 (CC-BY-4.0) legal status. CONFIRMED via direct verification
   * against the actual SRD 5.1 text (5thsrd.org) on 2026-08-04: individual
   * dedicated pages exist for all 9 standard PHB races. This held up where
   * the equivalent "generous inclusion" assumption did NOT for feats or
   * backgrounds (both turned out to be single "one worked example" pages) —
   * races, like magic items, get a genuinely comprehensive treatment rather
   * than a curated sample. Same semantics as Spell.srd — undefined = not
   * yet audited = unsafe for public builds. See docs/ROADMAP_1.0.md Phase 1
   * Step 1.4 for the full verification writeup.
   */
  srd?:      boolean;
  /** Which ruleset this race belongs to. Undefined = available under every ruleset (every race authored before this field existed, including all official 5e content). See the ContentHeader comment near the top of this file. */
  rulesetId?: RulesetId;
};
/**
 * One switchable set of options ("modes") for a class. The app never rolls for the player: a
 * `selector.table` maps the result of the player's OWN physical die to an option, and there is no
 * calendar, so a "period" (an in-game month) ends only when the player presses the change button.
 */
export type ModeGroup = {
  id:          string;
  /** Name of the feature that owns it, e.g. 'Legacy Binding'. */
  name:        string;
  /** What one option is called to the player, e.g. 'Bound Spirit'. */
  optionLabel: string;
  /** What one period is called, e.g. 'month'. */
  periodLabel: string;
  classId:     string;
  /** HomebrewSubclass ids of this class that are the options of the group. */
  optionIds:   string[];
  selector: {
    die:   number;
    table: { value: number; optionId: string }[];
    /** Dice rolled per period by class level; the player picks which result answers. Default 1. */
    diceAtLevel?: { level: number; dice: number }[];
    /** Resource spent to throw a roll away and roll again (Council of Spirits), usable from this class level. */
    rerollResourceId?: string;
    rerollFromLevel?: number;
    /** From this class level the player simply chooses any option (Crown of Legends). */
    freeChoiceFromLevel?: number;
  };
  /** Resources made available again whenever a new period starts (Council of Spirits' once-per-month reroll). */
  restoreOnSwitch?: string[];
};

/**
 * Per-character state for one Mode Group. `stash` holds the current value of the resources an
 * option granted at the moment the character left it, keyed by option id, so returning to the
 * option later finds them spent or unspent exactly as they were — "mode-owned persistent state".
 */
export type ModeState = {
  stash:    Record<string, Record<string, number>>;
  /** How many times the group has changed option since it was first set; informational. */
  changes:  number;
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
  /** e.g. ["Thieves' Tools", "Herbalism Kit"] — free text, granted at level 1. */
  toolProfs?:             string[];
  /**
   * Fixed gear granted automatically at level 1 (item ids from the official +
   * homebrew item catalog). Unlike official classes' "(a) chain mail or (b)
   * leather armor" equipment CHOICES, this is guaranteed starting gear with
   * no alternative — simpler to author, and covers what most homebrew
   * classes actually need. See the 'starting_item' Grant kind.
   */
  startingEquipment?:     string[];
  /**
   * Free-text notes for gear that doesn't correspond to a real catalog item
   * (e.g. "a set of masterwork lockpicks" or setting-specific gear). Purely
   * descriptive — unlike startingEquipment, this is never turned into an
   * inventory grant, since there's no real Item for the engine to reference.
   */
  equipmentNotes?:        string;
  spellcastingAbility?:   Ability;       // 'int' | 'wis' | 'cha' — kept for backward compat; single-ability classes still just set this
  /**
   * Rare case: a class whose casting ability isn't fixed (the player picks
   * one at creation, e.g. "cast with INT or WIS, your choice"). When this has
   * 2+ entries, buildProgressionFromClass queues a 'spellcasting_ability'
   * choice instead of a fixed init_spellcasting grant — spellcastingAbility
   * above is ignored in that case. A single entry here behaves identically to
   * just setting spellcastingAbility.
   */
  spellcastingAbilityOptions?: Ability[];
  spellcastingStyle?:     'full' | 'half' | 'pact'; // slot table to use
  /**
   * Rules-engine blocker closure (prepared-spell legality, re-audit): which
   * preparation model this class uses for its LEVELED spells (cantrips are
   * never gated by this — see isSpellPreparationLegal's own doc comment,
   * actionCards.ts). Replaces a former hardcoded classId allowlist
   * (PREPARED_CASTER_CLASS_IDS used to be a fixed Set of class ids —
   * actionCards.ts now derives it FROM this field instead) so preparation
   * legality is driven by real per-class content metadata, ruleset-capable
   * by construction: a homebrew or alternate-ruleset variant of a class is
   * just another CharClass content entry (see rulesetId below) with its own
   * value here, no code change required.
   *   - 'known':              a fixed list of known spells, always castable
   *                           (Sorcerer, Bard, Ranger, Warlock's Pact Magic).
   *   - 'spellbook_prepared': maintains a spellbook (.known) and prepares a
   *                           subset each long rest (.prepared) — Wizard.
   *   - 'full_list_prepared': no separate "known" step; prepares directly
   *                           from the full class spell list each long rest
   *                           (Cleric, Druid, Paladin, Artificer).
   *   - 'always_available':  never gated by preparation at all (rare as a
   *                           base-class policy; mainly used internally for
   *                           non-class sources — subclass/race/feat/item
   *                           grants — which never require class-style prep).
   * Undefined (every class authored before this field existed, and any
   * homebrew class that hasn't set it) falls back to 'known' — fail-open,
   * matching this app's existing "an unrecognized source is never wrongly
   * blocked" conservatism, same as isSpellPreparationLegal's own fail-open
   * default for an untracked entitlement.
   */
  spellPreparationPolicy?: SpellPreparationPolicy;
  /**
   * Rules-completeness batch (ritual casting), HIGH-fix closure: WHICH
   * spell-access requirement applies when this class casts a spell as a
   * ritual — a SEPARATE axis from spellPreparationPolicy (a half-caster
   * like Paladin uses 'full_list_prepared' too but has no Ritual Casting
   * feature at all; the two must never be conflated), and a strictly finer
   * question than a plain "can this class ritual-cast at all" boolean (the
   * ORIGINAL, now-superseded shape of this field) — 2014 Wizard ritual
   * casting is legal straight from the spellbook, UNPREPARED, while 2014
   * Cleric/Druid ritual casting still requires preparation, even though
   * both classes "have Ritual Casting."
   *
   *   - 'none':      no Ritual Casting feature at all (Paladin, Ranger,
   *                  Sorcerer, ordinary Warlock, every non-caster). The
   *                  default for undefined — this app never grants a real-
   *                  rules mechanical capability a class didn't explicitly
   *                  author, matching KNOWN_ATTUNEMENT_ITEM_IDS' own
   *                  fail-closed convention.
   *   - 'spellbook': legal whenever the spell is in this class's own
   *                  known/spellbook collection — preparation is NOT
   *                  required for ritual purposes specifically, even though
   *                  normal (non-ritual) casting still requires it (Wizard).
   *   - 'prepared':  legal only when the spell is currently prepared —
   *                  identical requirement to normal casting, no ritual-
   *                  specific bypass (Cleric, Druid; Artificer if/when
   *                  modeled as ritual-capable, reusing its existing
   *                  prepared-source semantics unchanged).
   *   - 'known':     legal whenever the class provides access at all — the
   *                  class doesn't prepare in the first place, so there is
   *                  no separate "unprepared" state to bypass (Bard).
   *
   * Book of Ancient Secrets, subclass-granted ritual capability, and any
   * other feature-level ritual grant are explicitly OUT OF SCOPE — not
   * modeled by this field, which only ever describes a BASE CLASS's own
   * policy.
   */
  ritualCastingPolicy?: 'none' | 'known' | 'prepared' | 'spellbook';
  spellcastingStartLevel?: number;       // first level that gets spell slots (default 1)
  asiLevels?:             number[];      // defaults to [4,8,12,16,19]
  /**
   * Which ability modifier applies to HP gain per level. Defaults to 'con'
   * (standard 5e RAW) when absent — every existing class is unaffected.
   * Homebrew classes that reflavor HP around a different ability (e.g. an
   * "Abyss Knight" whose vitality comes from CHA instead) can override this.
   */
  hpAbility?:             Ability;
  // Per-level features authored by the player (replaces cls.features for level 1+).
  // DraftTrait (see the "5b" section below) so these carry a real mechanical
  // effect kind, same as race traits — not just flavor text. Classes saved
  // before this existed only have {level, name, description}; readers must
  // treat the rest of DraftTrait's fields (effectKind included) as optional
  // at runtime even though the type says otherwise — see progressions.ts's
  // buildProgressionFromClass, which defaults a missing effectKind to 'none'.
  levelFeatures?:         (DraftTrait & { level: number })[];
  /**
   * CHOICE-AUTHORING-1: real player choices (Expertise/Tool/Language today)
   * authored per-level, alongside levelFeatures above — e.g. "at level 3,
   * choose one tool proficiency." Merged into that level's own
   * LevelEntry.choices by buildProgressionFromClass (progressions.ts),
   * alongside the ASI/spellcasting-ability choices it already synthesizes.
   * Each ChoiceDefinition's id should already be namespaced (the builder
   * does this) so it can't collide with those synthesized ones.
   */
  levelChoices?:          { level: number; choices: ChoiceDefinition[] }[];
  /**
   * Escape hatch for hand-authored classes too complex for the simplified
   * builder fields (subclass features, known-spell grants, custom slot tables,
   * per-level effect-bearing features). When present, getProgressionForClass
   * uses this verbatim and ignores all the simplified fields above. The class
   * builder cannot create this — it's only set by seeded built-in homebrew or
   * the import pipeline — and editing such a class in the builder will drop it.
   */
  rawProgression?:        ClassProgression;
  /**
   * Mode Groups: sets of mutually exclusive, switchable options this class's character holds one
   * of at a time (Emperor Warlock's monthly Bound Spirit). Each option is a HomebrewSubclass of this
   * class, so switching reuses the subclass apply/strip machinery and the option's level-gated
   * progression (see engine/modes.ts). Built-in/imported content only; the builders do not author this.
   */
  modeGroups?:            ModeGroup[];
  /**
   * Where this class's spell choices come from by default: an existing homebrew Spell List, or the
   * spell list of another (official or homebrew) class. Unset = spells tagged for this class's own
   * id, as before. The picker's "Spell Source" filter can still switch to any other list.
   */
  spellListSource?:       { kind: 'class'; classId: string } | { kind: 'list'; listId: string };
  /**
   * PHB "Multiclassing Proficiencies" table entry for this class when taken
   * as a SECOND-OR-LATER class (not your starting class) — applied instead
   * of the class's normal level-1 proficiency grant by levelUpClass(). A
   * class with no reduced multiclass table entry (Wizard, Sorcerer) grants
   * nothing when multiclassed into and should leave this undefined; the
   * class-builder does not currently expose authoring this field, so
   * homebrew classes always fall back to granting nothing on multiclass —
   * a conservative, disclosed default rather than a guess.
   */
  multiclassProficiencies?: ProficiencyGrant;
  /**
   * SRD 5.1 (CC-BY-4.0) legal status. All 12 core PHB classes are SRD-safe
   * (SRD 5.1 includes the full class chassis, not just a stripped subset).
   * Same semantics as Spell.srd — undefined = not yet audited = unsafe for
   * public builds. Mirrors ClassProgression.srd (the mechanical-progression
   * half of a class); this field is the display-metadata half's own tag,
   * since CharClass and ClassProgression are two separate objects for the
   * same class (see ClassProgression's own doc comment).
   */
  srd?: boolean;
  /** Which ruleset this class belongs to. Undefined = available under every ruleset. See the ContentHeader comment near the top of this file. */
  rulesetId?: RulesetId;
};
export type Background = {
  id: string;
  name: string;
  features: Feature[];
  /** Same rationale as Race.homebrewDraft — lossless edit-mode round-tripping. */
  homebrewDraft?: Record<string, unknown>;
  /**
   * SRD 5.1 legal status. CONFIRMED via direct verification against the
   * actual SRD 5.1 text (5thsrd.org) on 2026-08-04: the Backgrounds section
   * contains ONLY Acolyte, explicitly framed as "the sample background" —
   * WotC's own site notes state "far, far more options available" outside
   * the SRD. This CORRECTS a prior optimistic tagging of all 13 standard
   * PHB backgrounds, based on a "generous inclusion" pattern that turned
   * out not to apply here (same lesson learned for feats — see Feat.srd).
   * See docs/ROADMAP_1.0.md Phase 1 Step 1.4 for the full verification.
   */
  srd?: boolean;
  /** Which ruleset this background belongs to. Undefined = available under every ruleset. See the ContentHeader comment near the top of this file. */
  rulesetId?: RulesetId;
  /**
   * A player-directed ability score bonus, same shape as Race.flexibleAsi —
   * the 2024 background-grants-ASI mechanic (species lost their flat ASI in
   * that revision). Resolved the same way race-detail.tsx resolves
   * Race.flexibleAsi: on the background-selection screen, compiled into one
   * generated Feature's stat_modifier effects on confirm. See
   * app/creation/background.tsx's flexAsi state and applyGrant call.
   */
  flexibleAsi?: Race['flexibleAsi'];
  /**
   * The Origin feat this background grants (2024: every background names one). Applied for real when the
   * background is selected, by engine/originFeat.ts: the feat's feature, its limited-use pools and any
   * picks it asks for (skills, spells) are granted with this background as their source, so changing the
   * background takes them all back out.
   */
  originFeat?: string;
  /**
   * FILTER-METADATA-2: free-text tool/vehicle proficiency names (e.g.
   * "Thieves' tools", "Vehicles (land)"), sourced from the same PHB text
   * app/creation/background.tsx's BG_DETAIL table already displays.
   * Deliberately NOT mechanically enforced — no grant_proficiency 'tool:'
   * effect exists for any official background (confirmed: this engine
   * currently grants zero tool proficiencies from background selection at
   * all, a real, separate, pre-existing gap, same shape as CharClass's
   * armor/weapon-proficiency gap — not fixed here). Skill proficiencies
   * deliberately have NO equivalent field here: they're already real,
   * structured data via each background's own grant_proficiency 'skill:'
   * Feature effects — see backgroundSkillGrants() in
   * src/content/backgrounds/backgroundBrowse.ts, which derives them
   * without duplicating the same fact in a second field.
   */
  toolProficiencies?: string[];
  /**
   * CHOICE-AUTHORING-1: choices queued (not auto-resolved) at background-
   * selection time — e.g. "choose one artisan's tool" or "learn two
   * languages of your choice." Same mechanism as Race.pendingChoices (see
   * that field's doc comment and BACKGROUND_CHOICE_PREFIX below): queued
   * via leveling.ts's queueChoice at grantedAt=0 from both
   * app/creation/background.tsx's selectBackground() and leveling.ts's
   * swapBackground(), and swept on background change the same way
   * Race.pendingChoices is swept on race change.
   */
  pendingChoices?: ChoiceDefinition[];
};

/**
 * Required id prefix for every entry in Background.pendingChoices — lets
 * swapBackground()/selectBackground() sweep previously-queued background
 * choices on background change without needing to know each background's
 * specific choice ids in advance. Mirrors RACE_CHOICE_PREFIX exactly.
 */
export const BACKGROUND_CHOICE_PREFIX = 'background_choice_';

/** rulesetId undefined = available under every ruleset. See the ContentHeader comment near the top of this file. */
export type Condition  = { id: string; name: string; description: string; features: Feature[]; rulesetId?: RulesetId };

export type Item = {
  id:         string;
  name:       string;
  weight:     number;
  cost:       string;
  properties: string[];
  features:   Feature[];
  /** Same rationale as Race.homebrewDraft — lossless edit-mode round-tripping. */
  homebrewDraft?: Record<string, unknown>;
  /**
   * SRD 5.1 legal status. Standard PHB weapons/armor/gear (Dagger, Chain
   * Mail, Explorer's Pack, etc.) carry no Product Identity naming risk at
   * all — confidently true. Named magic items need individual review
   * (Product Identity concerns apply the same way as spells). Same
   * semantics as Spell.srd. See docs/ROADMAP_1.0.md Phase 1 Step 1.4.
   */
  srd?:       boolean;
  /**
   * A user-picked reference photo (data: URI — base64-inlined, so it
   * round-trips through the same JSON blob SQLite already stores the whole
   * Item in, no separate file/blob storage needed). Homebrew items only;
   * official catalog entries never set this.
   */
  imageUri?:  string;
  /** Which ruleset this item belongs to. Undefined = available under every ruleset. See the ContentHeader comment near the top of this file. */
  rulesetId?: RulesetId;
  /**
   * Limited-use pools this item carries (a wand's charges, a standard's "3 charges, regains 1d3
   * at dawn"). Granted by inventory.ts's equipItem the first time the item is equipped, with
   * recharge 'dawn:<dice>' supported for a partial dawn refill (see rest.ts's parseDawnRecharge).
   * An activation on the item's feature spends the pool through its `resourceCost.resourceId`.
   * The pool stays with the character when the item is unequipped (charges are not lost by
   * putting the item away) and is dropped by removeFeature-style provenance cleanup only if the
   * source is revoked.
   */
  resources?: ResourceGrant[];
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
  /**
   * Some feats grant "+N to one of these abilities (your choice)". When present,
   * the feat picker collects the player's choice and injects the matching
   * stat_modifier effect into the feature before it's applied, so the bonus
   * actually lands on the sheet. Omitted for feats with a fixed or no ability bonus.
   *
   * `grantsSaveProficiency` (Resilient): the chosen ability also confers
   * proficiency in that ability's saving throws. The picker adds it to
   * entity.proficiencies.savingThrows on commit.
   */
  abilityChoice?: { options: Ability[]; amount: number; grantsSaveProficiency?: boolean };
  /**
   * Limited-use resource pools this feat grants (e.g. Anchor of Command's once-per-long-rest
   * Hold Fast). Applied by leveling.ts's applyFeatToEntity via the same `resource` grant races
   * and classes use, tagged with sourceKind 'feature' + this feat's feature id so removeFeature's
   * existing revokeResourceSource cleanup covers it with no extra wiring. A feature's activation
   * references the pool by `resourceId`.
   */
  resources?: ResourceGrant[];
  /**
   * Skill-granting feats (Skill Expert, Skilled, Prodigy). Each entry is one
   * pick the player must make; the picker injects a grant_proficiency effect
   * (operation 'add' = proficiency, 'multiply' = expertise) for the chosen
   * skill. `from: 'any'` = any skill; `from: 'proficient'` = only skills the
   * character is already proficient in (for expertise).
   */
  skillChoice?: {
    picks: { id: string; label: string; mode: 'proficiency' | 'expertise'; from: 'any' | 'proficient' }[];
  };
  /**
   * CHOICE-AUTHORING-1: real ChoiceDefinition-based choices this feat grants
   * beyond abilityChoice/skillChoice above (e.g. Prodigy's "one tool
   * proficiency and one language," Artificer Initiate's "one artisan's
   * tools of your choice"). Deliberately a SEPARATE field rather than
   * folded into skillChoice — abilityChoice/skillChoice are a narrower,
   * feat-specific mechanism resolved inline by AsiFeatPicker itself, while
   * this reuses the same queueChoice/RepeatedChoicePicker pipeline every
   * other content type's pendingChoices does. Queued via leveling.ts's
   * applyFeatToEntity at the moment the feat is taken, namespaced by the
   * compiled feature's own id (see FEAT_CHOICE_PREFIX below and
   * removeFeature's choice-sweep) so live feature removal cleans these up
   * the same way it already cleans up a feat-granted resource.
   */
  pendingChoices?: ChoiceDefinition[];
  /**
   * SRD 5.1 legal status. CONFIRMED via direct verification against the
   * actual SRD 5.1 text (5thsrd.org) on 2026-08-04: the Feats section
   * contains ONLY Grappler. This resolved a prior optimistic guess (all 42
   * PHB feats, based on a "generous inclusion" pattern seen in other
   * content types) that turned out NOT to apply to feats — the same
   * verification pass found the identical narrow-inclusion pattern for
   * backgrounds (only Acolyte). Computed in src/content/feats/index.ts as
   * `id === 'grappler'`. See docs/ROADMAP_1.0.md Phase 1 Step 1.4 for the
   * full verification writeup.
   */
  srd?: boolean;
  /** Which ruleset this feat belongs to. Undefined = available under every ruleset. See the ContentHeader comment near the top of this file. */
  rulesetId?: RulesetId;
};

/** Namespacing convention for Feat.pendingChoices ids — see that field's doc
 * comment. Unlike RACE_CHOICE_PREFIX/BACKGROUND_CHOICE_PREFIX, sweeping on
 * removal doesn't scan for this prefix directly; removeFeature() instead
 * namespaces by the compiled feature's own id via queueChoice's originId
 * param, since a feat (unlike a race/background) is removed individually
 * while others may remain. This prefix exists purely to avoid id collisions
 * with other choice sources when a feat is authored. */
export const FEAT_CHOICE_PREFIX = 'feat_choice_';

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

// ── Diagnostics (A-54) ───────────────────────────────────────────────────────
// Structured, non-blocking validation findings for an Entity. The governing
// rule, per the app's existing "disclosed, not silently repaired" philosophy:
// a detected problem never blocks the character from opening — it's surfaced
// as an Issue for the player/DM to see and decide what to do about, same as
// every other disclosed-gap pattern already used throughout this codebase.

export type IssueSeverity = 'error' | 'warning' | 'info';

export type IssueCode =
  | 'missing_race' | 'missing_subrace' | 'missing_class' | 'missing_subclass'
  | 'missing_background' | 'missing_spell' | 'missing_item'
  // LIVE-RULESET-1: validateEntity() doesn't check feat/condition
  // references at all today — added for src/engine/rulesetChange.ts's
  // preview, which is the first consumer that needs them (a character's
  // feat/condition picks can become unresolved after a ruleset switch the
  // same way a race/class/spell/item pick already could).
  | 'missing_feat' | 'missing_condition'
  // LIVE-RULESET-2: the engine-level guard in rulesetChange.ts refuses to
  // apply a switch to an unregistered ruleset id or across two known,
  // different Games — these two codes report why, distinct from
  // package_unsupported_ruleset (an IMPORT-time diagnostic for a different
  // flow entirely).
  | 'unsupported_ruleset' | 'cross_game_ruleset'
  | 'ruleset_mismatch' | 'orphaned_choice_selection'
  // A-62: pack-level diagnostics (see src/engine/packDiagnostics.ts).
  | 'pack_broken_reference' | 'pack_content_shadowed' | 'pack_ruleset_mixed'
  | 'pack_content_in_use'
  // HOMEBREW-PACKAGE-1: portable package export/import diagnostics (see
  // src/engine/contentDependencies.ts / src/io/packageIO.ts). Distinct from
  // the pack_* codes above, which are about an already-INSTALLED pack's
  // ongoing health — these fire during export (building a package) or
  // import (evaluating one before commit).
  | 'package_missing_dependency' | 'package_unresolved_reference'
  | 'package_unsupported_ruleset' | 'package_corrupt'
  | 'package_incompatible_version' | 'package_duplicate_id'
  // CHOICE-EXPANSION-1: Expertise/Tool/Language interactive choices.
  // unresolved_choice_kind fires for a pending ChoiceDefinition whose kind
  // has no picker UI (see TabFeatures.tsx's dispatch) — surfaces the gap as
  // a real Issue instead of only a silent "ask your DM" note in one screen.
  // invalid_expertise_target fires when a RESOLVED expertise choice's
  // selected skill is no longer trained (the one real path in this engine
  // where that can happen live — see swapBackground's skill-retrain
  // checklist) — expertise is never silently reassigned to another skill.
  // missing_tool_definition/missing_language_definition mirror
  // orphaned_choice_selection for the two content kinds that previously had
  // no registry to check selections against at all.
  | 'unresolved_choice_kind' | 'invalid_expertise_target'
  | 'missing_tool_definition' | 'missing_language_definition';

export type Issue = {
  severity: IssueSeverity;
  code:     IssueCode;
  message:  string;
  /** The content/selection id this issue is about, e.g. a race or spell id. */
  affectedId?: string;
  /** Where on the entity this was found, e.g. 'identity.raceId'. */
  source?: string;
  suggestedFix?: string;
};

// ── 3. Entity runtime schemas ────────────────────────────────────────────────

/** One class the character has taken. `level` is the level in THIS class only — not the character's total level. */
export type ClassLevelEntry = {
  classId:    ClassId;
  subclassId: SubclassId | null;
  level:      number;
};

export type Identity = {
  name:         string;
  level:        number;
  // raceId/classId (and subRaceId/subclassId/backgroundId) stay plain `string`,
  // not RaceId/ClassId — deliberately NOT branded (see Brand<> comment near the
  // top of this file). companion.ts's createCompanion sets both raceId and
  // classId to a CompanionTemplate id for kind:'monster' companions (see the
  // `classes` field's doc comment just below), so these fields are polymorphic
  // per Entity.kind, not safe to brand as a single content type.
  raceId:       string;
  subRaceId:    string | null;   // e.g. 'hill_dwarf', 'wood_elf' — null until player picks
  classId:      string;
  subclassId:   string | null;
  backgroundId: string;
  alignment:    string | null;
  xp:           number;
  /**
   * Set on a companion Entity (kind: 'monster') to the owning player
   * Entity's id — e.g. an Artificer's Steel Defender or Eldritch Cannon.
   * null for every normal character/monster. The companion is otherwise a
   * completely ordinary Entity (own id, own row in storage); this is the
   * only link back to its owner. See src/engine/combat.ts's
   * syncCompanionFromOwner for how level/ability-score-dependent stats stay
   * current without a one-shot spawn-time bake.
   */
  companionOf?: string | null;
  /**
   * Multiclassing source of truth for kind:'character' entities, one entry
   * per class taken (index 0 = "primary"/first class). Absent on entities
   * that have never gone through a multiclass-aware code path (including
   * every monster/companion/npc entity, which reuse classId as an unrelated
   * template id — see CompanionSection) and on characters saved before this
   * field existed. Always read via getClassLevels(entity) from
   * src/engine/multiclass.ts rather than this field directly, so callers
   * don't have to duplicate the legacy single-class fallback. classId/
   * subclassId/level above stay in sync as a mirror of classes[0] and the
   * level sum — see syncLegacyIdentity() — so every pre-existing reader of
   * those three scalar fields keeps working unchanged for both single- and
   * multi-classed characters.
   */
  classes?: ClassLevelEntry[];
};

export type AbilityScores = Record<Ability, number>;

/** A special sense. `note` carries homebrew flavour like 'in color' or 'heat-based'. */
export type SenseType = 'darkvision' | 'blindsight' | 'tremorsense' | 'truesight';
export type Sense = {
  type:  SenseType;
  range: number;       // feet
  note?: string;       // optional flavour, e.g. 'in color', 'thermal/heat', 'blind beyond'
};

/** Non-walking movement speeds (feet). 0 / undefined means the creature lacks it. */
export type MovementSpeeds = {
  fly?:   number;
  swim?:  number;
  climb?: number;
  burrow?: number;
};

/** Computed from base stats + effects. Never set manually — always recomputed. */
export type DerivedStats = {
  proficiencyBonus:  number;
  ac:                number;
  initiative:        number;
  speed:             number;
  passivePerception: number;
  passiveInvestigation: number;
  passiveInsight:    number;
  senses:            Sense[];
  movement:          MovementSpeeds;
  savingThrows:      Record<Ability, number>;
  attackBonuses:     AttackBonus[];
  spellSaveDC:       number | null;
  spellAttackBonus:  number | null;
  /** 8 + proficiency + WIS mod — Monk's ki-ability save DC (Stunning Strike,
   * etc.). Separate from spellSaveDC because Monk isn't a spellcaster. Null
   * for anyone without Martial Arts. */
  kiSaveDC:          number | null;
  /**
   * 8 + proficiency + [ability] mod, precomputed for all six abilities —
   * generic version of kiSaveDC for every OTHER non-caster class feature
   * with its own save DC (Barbarian's Intimidating Presence is STR-based,
   * etc.). Always populated (no gating check needed, unlike kiSaveDC/
   * spellSaveDC) — a Feature's requiresSave.dc references the one it needs
   * via `{ ability: 'str' }` etc.
   */
  abilityBasedDC:    Record<Ability, number>;
  /**
   * Active advantage/disadvantage grants, aggregated from any Effect with
   * operation 'advantage'/'disadvantage' (see resolver.ts's resolveBinary
   * for the neutralization rule — if both are present for the same target,
   * they cancel to straight and don't appear here at all). `target` is a
   * free-text description of what it applies to (e.g. "Wisdom saving
   * throws against being charmed"), matching the same free-text pattern
   * condition content itself now authors for its own self-side roll
   * modifiers (see content/conditions/index.ts's rollModifierFeature, and
   * CONDITION_MECHANICS in TabCharacter.tsx for the UI split) — 5e's
   * variety here is too large to enumerate as a
   * fixed set of targets. Display/reminder only, same as everywhere else
   * in the app with no attack-roll automation: shown to the player so they
   * remember to roll 2d20, not auto-applied to any roll.
   */
  advantageStates:   { target: string; state: 'advantage' | 'disadvantage' }[];
  /**
   * Extra Attack / action-structure batch: how many individual attacks the
   * character's Attack action contains — `1 + resolveExtraAttack(allEffects)`
   * (resolver.ts). Extra Attack-granting features author a `stat_modifier`
   * effect targeting `'extra_attack'` with `operation: 'set'` and a value
   * one less than the total attack count (Fighter 5's value is `1` → 2
   * total attacks); resolveExtraAttack takes the MAXIMUM across every such
   * effect rather than summing them, so a Fighter 5/Paladin 5 multiclass
   * correctly stays at 2, never 3 — see resolveExtraAttack's own doc
   * comment for the full multiclassing rationale. This field describes ONLY
   * how many attack opportunities the Attack action contains; it never
   * implies multiple action-economy spends — a single Attack action with
   * this many attacks still consumes exactly one Action (see
   * applyActionCardUse's `attackSequence` parameter, actionUse.ts, and
   * AttackSequenceState's own doc comment, section 6 below).
   */
  attackActionAttacks: number;
};

/**
 * The scalar numeric fields inside DerivedStats that DM overrides may target.
 * savingThrows and attackBonuses are excluded — they are compound, not scalar.
 */
export const DERIVED_NUMERIC_KEYS = new Set<string>([
  'proficiencyBonus', 'ac', 'initiative', 'speed',
  'passivePerception', 'passiveInvestigation', 'passiveInsight',
  'spellSaveDC', 'spellAttackBonus', 'kiSaveDC',
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
  /**
   * How much of `maximum` currently comes from effects targeting 'max_hp' (a feature's
   * "+5 maximum hit points"). recomputeDerived resolves the CURRENT bonus from active effects
   * and applies only the DIFFERENCE to `maximum`/`current`, so a tiered reward that REPLACES
   * +5 with +10 nets +5 (never +15) and removing the feature takes its bonus back out.
   * Absent on characters saved before this field existed — read as 0, so nothing changes for them.
   */
  bonusApplied?: number;
};

/** One die-size's own total/remaining count within a mixed hit-dice pool. */
export type HitDicePool = {
  die:       number;
  total:     number;
  remaining: number;
};

/**
 * Tracks the pool of hit dice available for short-rest healing.
 *
 * Bug fix: a multiclass character's hit dice used to be tracked as a
 * single {die, total, remaining} triple — every level-up (in ANY class)
 * unconditionally overwrote `die` with whatever die size that class uses,
 * silently mislabeling every hit die from OTHER classes (e.g. a Fighter
 * 3/Wizard 1 would show 4 d6 hit dice, losing the 3 real d10s, and roll
 * the wrong die size — and wrong average heal — for 3 of the 4 spends).
 *
 * `pools` fixes this by tracking each distinct die size separately once a
 * character actually has more than one. It's absent for single-class
 * characters and multiclass characters whose classes all share one die
 * size (Fighter/Paladin, both d10) — those cases are already exact via
 * `die`/`total`/`remaining` alone, so there's no reason to carry the extra
 * structure. `total`/`remaining` always stay the correct SUM across every
 * pool regardless, so every existing reader that only wants the aggregate
 * count (rest previews, level-up previews, the sheet's progress display)
 * keeps working unchanged.
 */
export type HitDiceBlock = {
  die:       number;   // Die size: 4, 6, 8, 10, or 12. Once `pools` has more
                        // than one entry this is only a display fallback (the
                        // most-recently-added die size) — read `pools` for
                        // anything that needs to be exact.
  total:     number;   // Sum across every pool. Equals character level.
  remaining: number;   // Sum across every pool. How many are left to spend.
  pools?:    HitDicePool[];
};

export type CustomResource = {
  id:       string;
  name:     string;
  current:  number;
  maximum:  number;
  /** Authoritative maximum before source-owned upgrades are applied. */
  baseMaximum?: number;
  recharge: 'short_rest' | 'long_rest' | 'dawn' | 'never' | string;
  /** Maximum equals the character's proficiency bonus ("PB uses per Long Rest"); kept in step on every recompute. */
  perProficiencyBonus?: boolean;
  /** Maximum equals this ability's modifier, minimum 1 (Bardic Inspiration: Charisma); kept in step on every recompute. */
  perAbilityModifier?: Ability;
  /** Maximum equals the character's level times this (Sorcery Points and Focus Points: 1; Lay on Hands: 5). */
  perLevel?: number;
  /** What granted this resource — lets clearClassData (app/creation/class-
   * detail.tsx) tell a class-owned resource pool apart from a racial one and
   * wipe only the former on class (re)selection. Optional so resources on
   * already-serialized characters predating this field stay valid; treated
   * as "not class-owned" (never auto-wiped) when absent. Reuses
   * FeatureSource['kind'], plus 'subrace' since a resource can be granted by
   * a subrace specifically (not just its parent race). */
  sourceKind?: EntitlementSourceKind;
  sourceId?:   string;
};

/** Shared by CustomResource.sourceKind and EntitlementRecord.sourceKind.
 *  A superset of FeatureSource['kind'] (adds 'subrace', since a resource/
 *  entitlement can be granted by a subrace specifically, and 'feature' for
 *  a manually-added custom feature's own grants — see leveling.ts's
 *  removeFeature) — every FeatureSource.kind value is a valid
 *  EntitlementSourceKind, so a granting Feature's own `.source.kind` can
 *  always be used directly to tag an entitlement it produces (e.g. a
 *  grant_spell effect's resulting spell_access/cantrip_access record). */
export type EntitlementSourceKind =
  'race' | 'subrace' | 'subclass' | 'class' | 'background' | 'feat' | 'feature'
  | 'item' | 'spell' | 'condition' | 'campaign' | 'manual';

export type EntitlementKind =
  'skill_proficiency' | 'skill_expertise' | 'tool_proficiency' | 'armor_proficiency' | 'weapon_proficiency' | 'language'
  // Closure pass 3: source-owned spell/cantrip ACCESS (not preparation —
  // see A14, explicitly out of scope). `key` is the spell/cantrip id.
  | 'spell_access' | 'cantrip_access'
  // Closure pass 3 (item 3): tracks WHICH sources currently want a given
  // CustomResource (by its `key` = CustomResource.id) to exist — lets two
  // different sources granting a resource with the same id both register
  // as contributors without either one's removal wiping an entry the OTHER
  // still wants, and without resetting current/spent state on removal of
  // just one contributor. See entitlements.ts's revokeResourceSource.
  | 'resource_grant' | 'resource_upgrade';

/**
 * Closure pass 2 (source ownership): an explicit, typed record of WHY the
 * entity currently has some proficiency/expertise/language — replacing the
 * old approach of inferring provenance from the final flattened array/flag,
 * which can't distinguish "a manual/base grant" from "an active source's
 * grant that happens to produce the same effective value" (removing the
 * source silently erased the manual grant too). Not a general scripting/
 * event system — a plain typed reference, same shape as CustomResource's
 * own sourceKind/sourceId, plus an optional choiceId when the entitlement
 * came from resolving a specific ChoiceState (see ChoiceState.sourceKind/
 * sourceId for how the choice itself is tagged).
 *
 * Effect-driven proficiency grants (grant_proficiency Effects on a Feature
 * that has its own Feature.source) are NOT stored here — they're re-derived
 * fresh from collectAllEffects() every recompute pass, which is already
 * fully source-accurate and naturally self-reconciling (the effect simply
 * stops existing once its granting feature is removed). This array is for
 * the grants that have no backing Feature/Effect at all: raw `proficiency`-
 * kind Grants (race/class/subclass/background/feat progression entries),
 * resolved skill/tool/language choices, and manually-set proficiencies —
 * see recomputeDerived's own use of deriveProficienciesFromEntitlements.
 */
export type EntitlementRecord = {
  kind:       EntitlementKind;
  /** SkillName for skill_proficiency/skill_expertise; a tool/armor/weapon
   *  proficiency string, or a language name, matching whatever string the
   *  existing ProficiencyBlock arrays already store for that category. */
  key:        string;
  sourceKind: EntitlementSourceKind;
  sourceId?:  string;
  choiceId?:  string;
  /** Additive maximum contribution for resource_upgrade records. */
  amount?:    number;
  /** A spell/cantrip the source grants from a given CHARACTER level on (Circle of the Land's level 5/7/9 spells, a lineage spell at 3 and 5). Absent = from the start. */
  minLevel?:  number;
  /**
   * Rules-engine blocker closure (1F — ambiguous legacy/migrated
   * provenance): set ONLY on a sourceKind:'manual' spell_access/
   * cantrip_access record produced by legacy migration
   * (reclassifyManualSpellSources, entitlements.ts) when the spell/cantrip
   * matches 2+ of the character's OWN classes' spell lists — genuine,
   * unresolved ambiguity (e.g. a Wizard/Sorcerer character's legacy
   * Fireball), not an ordinary "no plausible class" manual grant. A plain
   * `manual` record with this field absent/empty means exactly what it
   * always has — an unrestricted, non-gated grant. Runtime (actionCards.ts's
   * resolveSpellCastingContexts) must NOT treat an ambiguous record as
   * automatically legal-with-no-ability-opinion the way a true manual grant
   * is — it instead builds one real casting context PER candidate class id
   * here, each with that class's own actual preparation policy/ability, so
   * the player is offered an explicit source choice rather than the spell
   * silently behaving as globally unrestricted. Never silently collapsed
   * back to a single resolved class — see 1G for the one case that DOES
   * safely auto-resolve (exactly one candidate, handled directly by
   * reclassifyManualSpellSources instead of via this field at all).
   */
  ambiguousClassIds?: string[];
};

/**
 * Rules-engine blocker closure (re-audit, Closure 1 — explicit spell
 * casting context): the ONE unit both preparation legality and casting
 * ability resolve from (see actionCards.ts's resolveSpellCastingContexts/
 * selectSpellCastingContext), and — new this closure — the unit an
 * ActionCard PRESERVES so the exact same context that was shown to the
 * player is the one validated and executed, never silently re-resolved to
 * a different source. Pure runtime/derived data: never persisted as its
 * own authoritative record (see EntitlementRecord for the real ownership
 * data this is derived FROM), and never stores a calculated DC/attack
 * number — those stay recomputed from `castingAbility` at display time
 * (see resolveSpellSaveDC/resolveSpellAttackBonus).
 */
export type SpellCastingContext = {
  /**
   * Stable identity for this EXACT context — deterministic function of
   * sourceKind/sourceId/classId, so the same real-world source always
   * produces the same key across candidate generation, card display, and
   * execution-time revalidation (resolveSpellCastingContexts is re-run
   * fresh at execution; matching by this key, not object identity or array
   * position, is what lets applyActionCardUse detect "this exact source
   * still exists" vs "it disappeared since the card was generated").
   */
  contextKey:        string;
  sourceKind:        EntitlementSourceKind;
  sourceId?:         string;
  /** The owning class, when resolvable — direct 'class' source, an
   *  ambiguous-legacy candidate (see EntitlementRecord.ambiguousClassIds),
   *  or a 'subclass' source resolved to its parent class via the
   *  character's own ClassLevelEntry.subclassId. Undefined for race/feat/
   *  item/genuine-manual/etc sources, which have no class to prepare from. */
  classId?:          string;
  preparationPolicy: SpellPreparationPolicy;
  castingAbility:    Ability;
  /** Preparation-only legality for THIS source. */
  legal:             boolean;
  /** True only for a context built from a grant_spell EFFECT's own
   *  authored spellcastingAbility — the single most specific signal
   *  content can author, so selectSpellCastingContext always prefers it. */
  explicitAbility?:  boolean;
  /** True for a candidate generated from an unresolved-ambiguous legacy
   *  manual entitlement (EntitlementRecord.ambiguousClassIds) — signals
   *  the UI that this context was never confirmed by the player and a
   *  source choice should be offered rather than silently assumed. */
  unresolvedLegacy?: boolean;
  /**
   * Rules-completeness batch (ritual casting): true only when THIS source
   * is a class/subclass whose class has a `CharClass.ritualCastingPolicy`
   * other than `'none'` (see that field's own doc comment) — independent of
   * `legal`/prepared status. A spell is only actually ritual-castable
   * through this context when it is ALSO ritual-tagged content
   * (`Spell.ritual`); this field alone answers "may this SOURCE cast
   * something as a ritual at all," never "is THIS attempt currently legal"
   * (see `ritualLegal` below for that) or "is this specific spell a
   * ritual." Undefined/false for every non-class-rooted source (race/feat/
   * item/manual/etc.) — no ritual-casting policy is modeled for those, so
   * they conservatively never offer ritual mode rather than guessing.
   */
  ritualEligible?: boolean;
  /**
   * Rules-completeness batch (ritual casting), HIGH-fix closure: whether a
   * RITUAL attempt through THIS SPECIFIC context is legal RIGHT NOW —
   * computed from the class's own `ritualCastingPolicy`, deliberately
   * SEPARATE from `legal` (normal-cast preparation legality), because the
   * two genuinely disagree for a `'spellbook'`-policy class: a Wizard's
   * ritual is legal straight from the spellbook whether or not it's
   * prepared (`ritualLegal` true even when `legal` is false), while a
   * `'prepared'`-policy class's ritual (Cleric, Druid) requires the exact
   * same preparation a normal cast does (`ritualLegal` always equals
   * `isPrepared`, same value as `legal` computes to for that policy) — and
   * a `'known'`-policy class (Bard) is unconditionally legal either way,
   * same as `legal` already is for it. `applyActionCardUse` uses THIS field
   * (not `legal`) to gate a `castMode: 'ritual'` attempt, so Cast Anyway
   * (`bypassSpellPreparation`) is never needed for a legal Wizard-spellbook
   * ritual, while it remains available (and required) for an unprepared
   * Cleric/Druid ritual exactly as it already is for a normal cast.
   * Undefined/false wherever `ritualEligible` is false — there is no
   * "legal ritual" through a source that cannot ritual-cast at all.
   */
  ritualLegal?: boolean;
};

/** See CharClass.spellPreparationPolicy's own doc comment for the full
 *  meaning of each value — this is the shared type, referenced both there
 *  and by SpellCastingContext.preparationPolicy (actionCards.ts). */
export type SpellPreparationPolicy = 'known' | 'spellbook_prepared' | 'full_list_prepared' | 'always_available';

/**
 * Death save tracking. Only meaningful while hp.current === 0 and the
 * entity hasn't stabilized. 3 successes -> stable (stops rolling, stays at
 * 0 HP until healed). 3 failures -> dead. A natural 20 on the save
 * instead heals 1 HP and clears both counters (handled in the UI action,
 * not stored as separate state here). Reset on any HP gain above 0 or on
 * stabilizing, per the book rule. See docs/ROADMAP_1.0.md Phase 3.1 and
 * the `deathSavesPersist` house rule in houseRules.ts.
 */
export type DeathSaves = {
  successes: number;   // 0-3
  failures:  number;   // 0-3
  stable:    boolean;  // true once 3 successes are reached
};

export type ResourceBlock = {
  hp:         HPBlock;
  hitDice:    HitDiceBlock;
  speed:      number;
  ac:         number;   // 0 = no armor; pipeline falls back to 10 + DEX
  custom:     CustomResource[];
  deathSaves: DeathSaves;
};

// ── STARTING-EQUIPMENT-1 ─────────────────────────────────────────────────────
// Structured, ruleset-agnostic constraint for "any item matching X" equipment
// choices (e.g. "any Simple Melee Weapon") — reuses the SAME independent-axis
// taxonomy src/content/items/itemBrowse.ts already defines for browsing
// (Category/WeaponClass/WeaponRange/ArmorWeight), never a scripting DSL or a
// combined-concept string like "Martial Melee". Every field is optional and
// AND-combined; an empty object matches every item (rare, but valid for a
// genuinely unconstrained "any item" pick).
export type ItemFilterConstraint = {
  category?:    'weapon' | 'armor' | 'shield' | 'ammunition' | 'tool' | 'focus' | 'gear';
  weaponClass?: 'martial' | 'simple';
  weaponRange?: 'melee' | 'ranged';
  armorWeight?: 'heavy' | 'medium' | 'light';
};

export type ChoiceOption = {
  id:    string;
  label: string;
  value: unknown;
  /**
   * STARTING-EQUIPMENT-1: when present, selecting this option ALSO requires
   * picking `quantity` real items matching `constraint` from the shared Item
   * browser (in RequiredEquipmentChoice context — see itemBrowseContext.ts),
   * in addition to (not instead of) any fixed `value` items. This is what
   * lets an ExactOptions/BundleOptions option represent something like
   * "a martial weapon and a shield" (fixed shield + 1 filtered martial
   * weapon) without hardcoding a specific weapon as the option's label —
   * the anti-pattern this whole mechanism replaces (e.g. "two simple
   * weapons (Daggers shown)" baking in one example as if it were the only
   * legal choice).
   */
  itemFilter?: { constraint: ItemFilterConstraint; quantity: number };
};

export type ChoiceDefinition = {
  id:       string;
  prompt:   string;
  kind:     'skill' | 'spell' | 'language' | 'tool' | 'equipment' | 'feat' | 'asi' | 'custom'
          | 'spellcasting_ability' | 'subclass' | 'infusion' | 'feature_pool' | 'expertise';
  count:    number;
  pool:     ChoiceOption[] | 'all' | FilterExpression;
  grants:   Grant[];
  required: boolean;
  resolved: boolean;
  /**
   * Which class this choice belongs to — set by levelUpClass() when a
   * multiclassed character has more than one pending choice of the same
   * kind (e.g. two subclass choices) so each resolves against the right
   * class. undefined for single-class characters and non-class choices
   * (race/background/feat) — every existing choice literal in src/content
   * stays valid without edits.
   */
  forClassId?: string;
  /**
   * Player-facing noun for a `kind: 'subclass'` choice that is not conventionally a subclass
   * (Emperor Warlock's "Bound Spirit"). The picker heading, the Features tab button and the
   * creation hub all use it instead of "Subclass". Undefined = "Subclass".
   */
  subclassLabel?: string;
  /**
   * STARTING-EQUIPMENT-1: only meaningful for kind:'equipment'. Undefined
   * (every existing equipment choice literal across src/content) means
   * 'exact_options' — the original, unchanged behavior (a fixed pool of
   * named options, each granting a fixed item list). 'bundle_options' is
   * structurally identical (a whole-pack either/or) — the distinct name
   * exists for UI/semantic clarity (pack contents render expanded) and so
   * a future divergence doesn't need a new discriminant. 'filtered_item'
   * means there is no fixed pool at all — `itemFilter` + `count` alone
   * describe "choose `count` items matching this constraint," and the
   * player picks real items from the shared Item browser.
   */
  equipmentStyle?: 'exact_options' | 'bundle_options' | 'filtered_item';
  /** Only used when equipmentStyle === 'filtered_item'. */
  itemFilter?: ItemFilterConstraint;
  /** Free-text display grouping for the Starting Equipment progress panel
   *  (e.g. "Armor", "Weapons", "Pack") — purely presentational, never used
   *  for legality/matching. Undefined groups under a generic "Equipment"
   *  heading, so no existing choice literal needs to change. */
  equipmentGroup?: string;
};

export type ChoiceState = {
  id:         string;
  definition: ChoiceDefinition;
  grantedAt:  number;
  resolved:   boolean;
  // selections stays plain string[], not branded — a selection's referent
  // (a feat id, spell id, skill name, subclass id, ...) depends on
  // `definition.kind`, so it's polymorphic the same way FeatureSource.refId
  // is. See the Brand<> comment near the top of this file.
  selections: string[];
  /**
   * Closure pass 2: explicit provenance for this pending/resolved choice —
   * which content source queued it, so resolving it can tag the resulting
   * grant(s) with real, removable source ownership instead of the grant
   * becoming untraceable the moment the choice resolves. Optional/undefined
   * on choices queued before this field existed, or where the queuing call
   * site genuinely has no better source than 'manual' — resolveChoice falls
   * back to sourceKind:'manual' in that case (conservative, matches the
   * migration philosophy: an untraceable grant is treated as permanent
   * rather than guessed at).
   */
  sourceKind?: EntitlementSourceKind;
  sourceId?:   string;
  /**
   * Item-identity closure (pass 3, finding F): for a RESOLVED `kind:
   * 'equipment'` choice, the exact ItemInstance ids it granted into
   * inventory.carried — lets reopenEquipmentChoice (equipmentDisplay.ts)
   * remove precisely what THIS choice added, never the first same-itemId
   * row it happens to find (which, now that duplicate stateful
   * ItemDefinitions are legitimately allowed, could belong to a DIFFERENT
   * choice, Additional Equipment, or another grant entirely). Optional/
   * undefined for a non-equipment choice, an unresolved choice, or one
   * resolved before this field existed — reopenEquipmentChoice falls back
   * to its original itemId-based removal in that case (a documented,
   * least-destructive legacy compromise, not a claim that old data secretly
   * tracked per-instance provenance it never recorded).
   */
  grantedItemInstanceIds?: string[];
};

export type SlotEntry   = { total: number; used: number };
export type SpellSlots  = Record<'1'|'2'|'3'|'4'|'5'|'6'|'7'|'8'|'9', SlotEntry>;

export type SpellcastingBlock = {
  ability:       Ability;
  slots:         SpellSlots;
  /**
   * Warlock/pact-magic slots, tracked separately from `slots` because they
   * recover on a SHORT rest (see rest.ts) and are never combined with the
   * multiclass spellcaster slot table (PHB "Multiclassing" rules — pact
   * slots are explicitly excluded from the combined caster table). Present
   * only when the entity has taken levels in a pact-caster class (Warlock,
   * or the homebrew Blood Hunter Profane Soul / Abyss Knight). undefined
   * for every non-pact caster, so existing single-class non-Warlock
   * entities are unaffected.
   */
  pactSlots?:    SpellSlots;
  cantrips:      string[];
  known:         string[];
  prepared:      string[];
  concentrating: string | null;
  /**
   * Rounds-remaining countdown for the spell currently being concentrated
   * on, parsed from that spell's Spell.duration at cast time by
   * parseConcentrationDuration() (combat.ts). undefined when not
   * concentrating, or when concentrating on a spell whose duration string
   * didn't match a known round/minute/hour pattern (fail-open —
   * concentration itself still works, it just has no ticking countdown or
   * "Xr" display). Ticked down by tickConcentrationDuration() (combat.ts),
   * called alongside tickDurations() from the same End Turn action.
   * Optional + additive: existing saved characters simply lack this field
   * until their next concentration cast.
   */
  concentratingDuration?: DurationTracker;
};

export type Spell = {
  id:                       string;
  name:                     string;
  /**
   * Widened from a strict `0|1|2|...|9` union to allow homebrew levels
   * beyond the standard range. KNOWN LIMITATION, disclosed not hidden: the
   * spell slot system (SpellSlots type) only has tiers 1-9 — a homebrew
   * spell authored at level 10+ has no slot tier to consume from, so it
   * displays correctly but can't be tracked as "slots remaining" the way
   * levels 1-9 are. Same reminder-only pattern used elsewhere in the app
   * for mechanics the engine doesn't fully model.
   */
  level:                    number;
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
  /**
   * Free-form categorization tags (e.g. 'damage', 'buff', 'debuff', 'healing',
   * 'control', 'utility', 'summoning') for filtering/browsing. Display and
   * search aid only — not mechanically enforced by the engine.
   */
  spellType?:               string[];
  /** Features applied to caster while concentrating — removed when concentration drops. */
  onConcentrationFeatures?: Feature[];
  /**
   * True if this spell (its NAME and mechanical text) is part of the SRD 5.1
   * (CC-BY-4.0). False for anything using WotC Product Identity naming
   * (e.g. "Tasha's...", "Melf's...") or sourced from a non-SRD expansion book
   * (Xanathar's, Tasha's Cauldron, SCAG). Public/distributed builds MUST
   * filter to srd === true — see src/content/spells/index.ts.
   * Undefined = not yet audited; treated as NOT safe for public builds.
   */
  srd?:                     boolean;
  /** Which ruleset this spell belongs to. Undefined = available under every ruleset. See the ContentHeader comment near the top of this file. */
  rulesetId?:               RulesetId;
};

/**
 * A named, author-curated collection of spell ids — homebrew content in its
 * own right (create/export/import like any other builder type), distinct
 * from `Spell.classes` (which just tags which official classes a single
 * spell belongs to). A SpellList exists to give a class an ALTERNATE pool to
 * draw from — most commonly a homebrew class with no official spell list of
 * its own, or an optional/variant list for an existing class — without
 * having to retag every individual spell's `classes` field. `classId` is the
 * suggested/default class this list is for; it does not restrict who can
 * pick the list (see filterSpellsForClass in content/spellLists.ts), since
 * nothing stops a DM from offering the same curated list to more than one
 * class at their table.
 */
export type SpellList = {
  id:          string;
  name:        string;
  description?: string;
  classId?:    string;
  spellIds:    string[];
  srd?:        boolean;
  rulesetId?:  RulesetId;
};

export type Currency     = { pp: number; gp: number; ep: number; sp: number; cp: number };

/**
 * A beast (or other creature) an entity can temporarily transform into via
 * Wild Shape. Small, curated content type — v1 ships a handful of SRD-legal
 * low/mid-CR beasts, not a builder. See docs/ROADMAP_1.0.md "FEATURE DESIGN:
 * Wild Shape" for the full design and scope cut.
 */
export type BeastForm = {
  id:              string;
  name:            string;
  /** CR gate for player-facing pickers (e.g. "only CR ≤ 1/4 beasts at level 2"). */
  challengeRating: number;
  size:            'Tiny' | 'Small' | 'Medium' | 'Large';
  stats:           AbilityScores;       // the beast's own STR/DEX/CON/INT/WIS/CHA
  ac:              number;
  hp:              number;              // flat HP pool for the beast form
  speed:           number;              // walking speed in feet
  swimSpeed?:      number;
  flySpeed?:       number;
  climbSpeed?:     number;
  senses?:         Sense[];
  /** Simple attacks, shown as ActionCards while transformed — same as any other AbilityEffect-driven attack in the app. */
  attacks:         { name: string; effect: AbilityEffect }[];
  /** Free-text trait summaries (e.g. "Keen Smell", "Pack Tactics") — display-only in v1, not mechanically enforced. */
  traits?:         string[];
  /**
   * Rules-engine blocker RE-AUDIT closure (Closure 3 — native BeastForm
   * defenses): plain damage-type strings (the SAME taxonomy
   * grant_resistance's own `target` field already uses everywhere else in
   * the app — 'fire', 'lightning', 'acid', ... — no second damage-type
   * taxonomy). Only unconditional, always-on resistances/immunities/
   * vulnerabilities belong here — a qualified one (e.g. 5e's "bludgeoning/
   * piercing/slashing from NONMAGICAL attacks") has no representation in
   * this engine (resolveResistance has no "was this attack magical" input)
   * and is deliberately left undeclared rather than represented incorrectly
   * as an unconditional resistance; see beastforms/index.ts's own per-form
   * comment for exactly what's included/excluded for each shipped form.
   * Read by pipeline.ts's collectAllEffects while `wildShapeState.active`
   * is true — never copied onto the base entity, so a plain revert
   * (wildShapeState -> null) makes these vanish with zero cleanup.
   */
  damageResistances?:    string[];
  damageImmunities?:     string[];
  damageVulnerabilities?: string[];
  /**
   * Rules-engine blocker RE-AUDIT closure (3B): the standard 5e elemental
   * innate resistance to bludgeoning/piercing/slashing damage from
   * NONMAGICAL attacks/weapons — a real, RAW-significant defense every
   * shipped elemental form has, but one this engine cannot infer on its
   * own (it has no concept of an attack being magical/nonmagical).
   * Deliberately NOT folded into `damageResistances` above: that list
   * means "always resisted, unconditionally," which this qualified
   * resistance is not. Investigated reusing Effect.situational/
   * Entity.situationalAnswers (the app's existing manual yes/no mechanism)
   * first, per this closure's own instruction — rejected because that
   * mechanism is PERSISTENT entity state meant for slow-changing facts
   * ("an ally within 5 feet"), and this fact can change every single hit;
   * forcing the DM to toggle persistent state before/after every attack
   * would be poor table-first UX. Instead consulted via a small, explicit,
   * PER-HIT parameter at the point damage is entered — see
   * applyWildShapeDamage's own `isNonmagicalAttack` parameter (combat.ts)
   * and the DM/player damage-entry UI's "Nonmagical attack" checkbox.
   * Bounded to exactly this one 5e distinction — not a general magical/
   * nonmagical attack-qualifier system.
   */
  nonmagicalPhysicalResistance?: boolean;
};

export type ItemInstance = {
  /**
   * Item-identity closure: stable identity for THIS OWNED COPY, distinct
   * from `itemId` (the shared ItemDefinition/content id two independently-
   * owned copies of the same magic item both point at). Two ItemInstances
   * may legally share `itemId` while having different `id` — that's exactly
   * what makes "two identical swords, one equipped+attuned, one not" a
   * legal, stable state instead of one shared mutable row. Generated once
   * at a mutation boundary (add/duplicate/import) — see
   * generateItemInstanceId (inventory.ts) — never inside recomputeDerived
   * or another pure derivation function.
   *
   * Optional so every pre-existing ItemInstance literal across the app
   * (test fixtures, and any character saved before this field existed)
   * stays valid — the SAME disclosed-migration-gap convention this type's
   * own requiresAttunement/wearsArmorOrShield fields already use.
   * characterStore.ts's load hydration backfills a stable id for any
   * instance missing one, exactly once, so nothing regenerates it on
   * every recompute. Code that needs to target ONE SPECIFIC owned
   * instance (equip/unequip/attune/remove/resource lookups) should match
   * on `id`, not `itemId` — matching on `itemId` can silently pick
   * whichever same-definition copy happens to be first in the array.
   */
  id?:      string;
  itemId:   string;
  quantity: number;
  /** Stable owner for creation-time additional items. */
  acquisitionSourceId?: string;
  attuned:  boolean;
  features: Feature[];
  /**
   * Id of the infusion (src/content/infusions/index.ts) currently occupying
   * this specific item instance, if any — null/undefined for an uninfused
   * item. The infusion's own Feature is additively appended to `features`
   * (never replacing the base item's own features, unlike equip hydration —
   * see app/sheet/[id].tsx's handleApplyInfusion), so removing it means
   * both stripping that Feature back out AND clearing this field.
   */
  infusedWith?: string | null;
  /**
   * Re-audit A17: hydrated ONCE at equip time (see equipItem, engine/
   * inventory.ts) from the item content definition's own
   * itemRequiresAttunement() check — the SAME pattern `features` above
   * already uses to get content-definition data onto a pure ItemInstance
   * without the engine pipeline needing a live content-store lookup.
   * undefined/false means "no attunement requirement" (every existing
   * saved instance, and anything equipped before this field existed,
   * parses as not-required until re-equipped — a disclosed migration
   * gap, not a silent behavior change for anything already correct).
   * Consumers (collectAllEffects, action-card generation) gate an
   * equipped item's effects/actions on `!requiresAttunement || attuned`.
   */
  requiresAttunement?: boolean;
  /**
   * Re-audit A19: hydrated ONCE at equip time (see equipItem, engine/
   * inventory.ts), from the same armorWeight()/isShield() classifiers the
   * Compendium/equipment-picker filters already use — true when this item
   * IS armor or a shield. Lets a effect on a DIFFERENT equipped item (e.g.
   * Bracers of Defense) check Effect.requiresNoArmorOrShield against the
   * rest of entity.inventory.equipped without a content-store lookup.
   * undefined/false for every non-armor/shield item, and for anything
   * equipped before this field existed (disclosed migration gap, same as
   * requiresAttunement's own — re-equip refreshes it).
   */
  wearsArmorOrShield?: boolean;
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
       | 'item' | 'spell' | 'condition' | 'campaign' | 'manual';
  // refId stays plain `string`, not branded — the concrete content type it
  // references (RaceId/ClassId/SpellId/...) depends on the sibling `kind`
  // field, so a single branded type here would be wrong for most `kind`
  // values, and a union would force a `kind`-narrowing cast at every read
  // site for no near-term payoff. See the Brand<> comment near the top of
  // this file.
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
           | 'grant_spell'
           // Grants a special sense (darkvision/blindsight/tremorsense/truesight).
           // Aggregated into derived.senses; same type keeps the largest range.
           | 'grant_sense'
           // Grants a non-walking movement speed (fly/swim/climb/burrow).
           // Aggregated into derived.movement; same type keeps the largest value.
           | 'grant_movement';
  target:    string;
  operation: 'add' | 'multiply' | 'set' | 'advantage' | 'disadvantage'
           | 'resistance' | 'immunity' | 'vulnerability' | 'suppress'
           /**
            * 'scale' — multiply the FULLY RESOLVED stat ("double your speed", "halve your
            * initiative"). Deliberately separate from 'multiply', which the resolver has always
            * applied to the accumulated bonus pool of that target (and which a locked-in audit
            * test documents, and which expertise markers reuse). Applied last, after every
            * set/add, floored to a whole number; several scales multiply together in any order.
            * Supported on ability scores, speed, initiative and AC. See resolver.ts's
            * resolveScaleFactor.
            */
           | 'scale';
  value:     number | string | string[] | null;
  condition: string | null;
  /**
   * Item 9 (context-dependent/three-state mechanics): distinct from
   * `condition` above, which gates on state the ENGINE already tracks
   * (an active flag/condition id). `situational` marks an effect whose
   * applicability depends on a real-world fact the app has no way to
   * observe (positioning, "an ally within 5 feet", "if this is the first
   * attack this turn") — e.g. Pack Tactics. Three real states: unanswered
   * (id absent from Entity.situationalAnswers — conservative default,
   * treated as "No" so a bonus is never silently overstated), explicit
   * Yes (`situationalAnswers[id] === true`), explicit No (`=== false`).
   * See collectAllEffects' gating and TabFeatures.tsx's "Situational
   * Effects" toggle list, the one UI that writes to
   * Entity.situationalAnswers. `id` should be stable/shared across
   * entities carrying the same content (e.g. every Wolf's Pack Tactics
   * uses the same id) so the question only needs answering once per
   * genuinely distinct fact, not once per feature instance.
   */
  situational?: { id: string; question: string } | null;
  /**
   * Re-audit A19: gates an item-sourced effect on "no OTHER currently
   * equipped item is armor or a shield" — the real equipment predicate
   * Bracers of Defense's own RAW text requires ("+2 AC while you are
   * wearing no armor and using no shield") but had no enforcement
   * mechanism at all before this field. Checked against each OTHER
   * equipped ItemInstance's hydrated `wearsArmorOrShield` flag (set once
   * at equip time — see ItemInstance's own doc comment) — deliberately
   * NOT reusing `condition` above, which gates on a REQUIRED active flag/
   * condition, the opposite polarity from this ("requires the ABSENCE of
   * armor/shield"). Optional; absent/false means "no such restriction",
   * unaffected — every existing effect keeps working exactly as before.
   */
  requiresNoArmorOrShield?: boolean;
  formulaAbilities?: Ability[];
  /**
   * "Add your Charisma modifier to X": on a numeric `add` stat_modifier, this ability's final
   * modifier is added to `value` (which may be 0/omitted) when derived stats are computed.
   */
  addAbilityModifier?: Ability;
  /** "Add your proficiency bonus": PB is added to this effect's numeric `value` (Alert's initiative). */
  addProficiencyBonus?: boolean;
  /** The effect does nothing until the character reaches this level (Nature's Ward's resistance at 10). Works on any feature's effect. */
  minLevel?: number;
  /** "...and again whenever you gain a level": this many points per CHARACTER level are added to `value` (Dwarven Toughness: 1). */
  addPerLevel?: number;
  /**
   * On a `set` of an ability score: a floor ("becomes 24 if lower", "rise to at least 22") applied
   * after every other effect, so it can raise the score but never lower a higher one.
   */
  atLeast?: boolean;
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
  // ── grant_sense-specific fields ───────────────────────────────────
  senseType?:  SenseType;
  senseRange?: number;
  senseNote?:  string;
  // ── grant_movement-specific fields ───────────────────────────────────────────
  movementType?:  'fly' | 'swim' | 'climb' | 'burrow';
  movementRange?: number;
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
  /**
   * Purely descriptive outcome-branch text ("on hit, you also...") — never
   * auto-applied. See OutcomeMap's doc comment. Sibling to abilityEffects
   * (same category: consequences), not nested inside activation (which
   * stays about cost/target/range/save-DC).
   */
  outcomes?: OutcomeMap;
  /**
   * Short, human-readable description of the triggering moment — "Once per
   * turn, when you hit with a weapon attack and have advantage..." for
   * Sneak Attack. Purely descriptive, independent of `activation` (works
   * with or without one): a feature with both gets one extra note line on
   * its action card; a feature with `trigger` but no `activation` (Sneak
   * Attack itself — passive:true, no activation at all) is never given a
   * synthesized fake activation just to be describable — it surfaces
   * instead in TabActions.tsx's TriggeredFeaturesSection, a reference list
   * alongside the existing UniversalActionsSection.
   */
  trigger?: string;
  /**
   * Limited-use pools this feature brings with it (Weight of Authority's reroll uses). Granted by
   * leveling.ts's applyGrant 'feature' case, tagged sourceKind 'feature' + this feature's id, so
   * removeFeature's existing resource cleanup removes them with the feature. Features that pair a
   * separate `resource` grant (every class-progression feature) simply leave this unset.
   */
  resources?: ResourceGrant[];
  /**
   * Marks this feature as one tier of an upgradeable reward (a DM-granted mid-campaign feature):
   * granting a higher tier of the same `trackId` REPLACES every lower-tier feature of that track
   * instead of stacking with it. See engine/rewardTracks.ts.
   */
  rewardTrack?: { trackId: string; tier: number; trackName: string };
  /**
   * Id of an earlier feature this one REPLACES when granted: the old feature object is removed first
   * so no stale duplicate lingers ("Firing Squad becomes 6d6", "Imperial Command's die becomes a d8").
   * Resource pools are not touched — they are granted separately and keep their spent state.
   */
  upgradeOf?: string;
  /** Player-set: marks this feature as exploration-relevant for the Exploration view filter. */
  explorationTag?: boolean;
  /**
   * LEGACY — superseded by Entity.favoriteActionIds (see its doc comment),
   * which correctly covers spell-based and synthetic action cards this
   * field never could. Kept read-only for backward compat with characters
   * saved before that field existed; new favorite toggles no longer write
   * here (see TabActions.tsx's toggleFavoriteTag()).
   */
  favoriteTag?: boolean;
};

/** Feature with a runtime isActive flag for toggled abilities (Rage, Wild Shape, etc.). */
export type FeatureInstance = Feature & {
  isActive: boolean;
};

// ── 5b. Homebrew draft-trait model ───────────────────────────────────────────
// The in-progress shape a single "trait" (racial trait, class/subclass feature)
// is authored in across every homebrew builder, before being compiled into a
// real Feature (+ possibly a ResourceGrant) by buildTraitFeature() in
// src/components/homebrew/TraitEditor.tsx. Lives here (not in that component
// file) so CharClass.levelFeatures — read by the plain-TS progression compiler
// in src/content/classes/progressions.ts — can reference it without a
// components → engine dependency.

export type TraitEffectKind =
  | 'none' | 'ability_score' | 'unarmored_defense' | 'ac_bonus' | 'skill_proficiency' | 'tool_proficiency'
  | 'advantage_disadvantage' | 'sense' | 'movement' | 'movement_condition'
  | 'damage_resistance' | 'damage_immunity' | 'damage_vulnerability'
  | 'spell_grant' | 'resource_ability'
  // Added for engine/editor parity (see docs/EFFECT_AUTHORING_PARITY.md):
  | 'stat_bonus' | 'gear_proficiency' | 'condition_immunity';

/** Stats the 'stat_bonus' kind can modify. Every one is honored by the pipeline (see traitCompiler's STAT_BONUS_TARGETS). */
export type StatBonusTarget =
  | 'speed' | 'initiative' | 'extra_attack' | 'spell_save_dc' | 'spell_attack_bonus'
  | 'passive_perception' | 'passive_investigation' | 'passive_insight' | 'saving_throw';

export type DraftTrait = {
  localId:     string;
  name:        string;
  description: string;
  effectKind:  TraitEffectKind;
  // ability_score
  abilityTarget: Ability;
  abilityAmount: string;
  // unarmored_defense
  unarmoredBase:      string;
  unarmoredAbilities: Ability[];
  unarmoredCaps:      Partial<Record<Ability, string>>;
  /**
   * ac_bonus — a flat +N (or -N) AC modifier, stacking additively on top of
   * whatever sets the base (armor, Unarmored Defense, the 10+DEX fallback —
   * see pipeline.ts's acBonus/calculatedBaseAc split). Separate from
   * unarmored_defense because that kind REPLACES the base formula; this one
   * only ever adds to it, so it works for a feat/ring/racial trait granting
   * "+1 AC" regardless of what's providing the base.
   */
  acBonusAmount: string;
  // skill_proficiency
  skillTarget:    SkillName;
  skillExpertise: boolean;
  // tool_proficiency
  toolName: string;
  // advantage_disadvantage
  advDirection: 'advantage' | 'disadvantage';
  advTarget:    string;
  // sense
  senseType:  SenseType;
  senseRange: string;
  // movement
  moveType:  'fly' | 'swim' | 'climb' | 'burrow';
  moveRange: string;
  // movement_condition — immunity to specific conditions' speed-zeroing effect,
  // plus an explicitly-flavor-only note for movement rules the engine has no
  // hook for at all (e.g. difficult terrain — see traitCompiler.ts).
  moveCondTargets: string[];
  moveCondFlavor:  string;
  // damage_resistance / damage_immunity / damage_vulnerability
  damageType: string;
  // spell_grant — an at-will cantrip plus any number of level-gated leveled
  // spells, each independently resource-pool- or spell-slot-consuming.
  spellGrantCantripId: string;
  spellGrantAbility:   Ability;
  spellGrants: {
    localId:      string;
    spellId:      string;
    spellName:    string;
    // Derived from the real Spell's own castingTime when picked in the UI
    // (src/components/homebrew/TraitEditor.tsx) — kept here rather than
    // looked up inside buildTraitFeature() so src/content/traitCompiler.ts
    // never needs to import spell content (it's used by progressions.ts,
    // which must stay import-cycle-safe with the content layer).
    actionType:   'action' | 'bonus_action' | 'reaction';
    unlockLevel:  string;
    mode:         'resource' | 'slot';
    recharge:     'short_rest' | 'long_rest' | 'dawn' | 'other';
    rechargeOther: string;
    uses:         string;
    minSlotLevel: string;
  }[];
  // resource_ability (e.g. Chi Pulse: bonus action, 1/rest, heal)
  actionType:      'action' | 'bonus_action' | 'reaction' | 'other';
  actionTypeOther: string;
  recharge:        'short_rest' | 'long_rest' | 'dawn' | 'other';
  rechargeOther:   string;
  uses:            string;
  healDice:        string;
  /**
   * Layers a limited-use counter (max uses + recharge, same shape as
   * resource_ability's) on top of ANY effectKind — e.g. a "3/short rest"
   * damage-resistance trait, or Monk's Opportunist (a plain reaction with
   * no coded effect of its own, kind 'none', but still a tracked once-able
   * reaction). Reuses actionType/actionTypeOther/recharge/rechargeOther/uses
   * above rather than duplicating fields — no conflict, since resource_ability
   * and spell_grant already fully own their own resource wiring and ignore
   * this flag (see buildTraitFeature in traitCompiler.ts).
   */
  limitedUse: boolean;
  // stat_bonus: a modifier to speed / initiative / extra attacks / spell DC / spell attack / passive senses / saves.
  statTarget?:      StatBonusTarget;
  /** For statTarget 'saving_throw': which save (or all six). */
  statSaveAbility?: Ability | 'all';
  statOperation?:   'add' | 'set' | 'scale';
  statAmount?:      string;
  // gear_proficiency: a weapon or armor proficiency.
  gearKind?:        'weapon' | 'armor';
  gearName?:        string;
  // condition_immunity: cannot be affected by this condition.
  conditionImmunityTarget?: string;
  // Saving-throw DC for an ability that forces a save (limited-use abilities). See traitCompiler's buildRequiresSave.
  saveEnabled?:     boolean;
  saveAbility?:     Ability;
  /** 'ability' scales with the character (8 + proficiency + that ability's modifier); 'spell' = their spell save DC; 'fixed' = a set number. */
  saveDcMode?:      'ability' | 'spell' | 'fixed';
  saveDcAbility?:   Ability;
  saveDcFixed?:     string;
  /**
   * Set ONLY when a builder hydrates a saved/imported (already-compiled) feature it cannot turn back into an
   * editable effect kind: a one-line summary of the mechanics the compiled feature really carries (see
   * content/featureMechanics.ts). Display-only — it lets the trait row say what the trait does instead of
   * "Flavor only", and tells the save path the mechanics must be kept. Never persisted by the compiler.
   */
  mechanicsSummary?: string;
};

// ── 6. Entity master type ────────────────────────────────────────────────────

/**
 * Runtime Wild Shape state on an entity. Null when not transformed.
 * Mirrors the DmOverride philosophy: this is a layer applied on top during
 * recomputeDerived, never a mutation of entity.stats/entity.features. Revert
 * (set back to null) restores the entity exactly as it was.
 */
export type WildShapeState = {
  active:      boolean;
  formId:      string;
  /** The beast form's own HP pool while transformed — tracked separately from the player's real HP, which is untouched and resumes exactly where it was on revert. */
  beastHp:     number;
  beastHpMax:  number;
  /** Per the book duration rule (half druid level in hours, minimum 1). */
  expiresAt:   DurationTracker;
};

/**
 * A-25 — the core 5e action economy (action / bonus action / reaction),
 * reset at the start of each of the entity's own turns via startTurn().
 * Deliberately just these 3 slots, not a generic once-per-turn/round
 * limiter system for arbitrary abilities (Sneak Attack-style limits) —
 * that's a separate, harder, still-open design question (even the
 * aspirational architecture-review docs flag it unresolved). Movement-per-
 * turn is also deliberately not tracked here yet — a numeric budget with
 * its own UI, lower urgency than the 3 boolean slots. A reaction resets at
 * the start of the entity's OWN turn but can be spent on any turn (5e's
 * real rule) — that already falls out correctly here: nothing resets it
 * except this entity's own next startTurn() call.
 */
export type TurnState = {
  actionUsed:      boolean;
  bonusActionUsed: boolean;
  reactionUsed:    boolean;
};

/**
 * Extra Attack sequence closure (single-HIGH final closure): the engine-
 * owned, per-entity record of an IN-PROGRESS Attack action containing
 * multiple attacks (Extra Attack / Multiattack) — replaces the removed
 * `isChainedAttack?: boolean` escape hatch, which let any caller claim "this
 * is a chained attack" and bypass action economy with zero verification
 * (CALLER BOOLEAN ≠ AUTHORITY). This is the single source of truth
 * applyActionCardUse (actionUse.ts) consults to decide whether a given
 * attack is a legitimate continuation of an already-paid-for Attack action.
 *
 * Deliberately NOT a durable/persisted character fact — it exists only for
 * the duration of one Attack action and is cleared (`null`) the moment the
 * sequence closes (exhausted, or the player presses Done/Cancel) or a fresh
 * turn starts (startTurn, combat.ts, resets it alongside turnState). A
 * saved/reloaded character with a leftover non-null value here (e.g. the app
 * closed mid-sequence) is harmless: the next attempt to CONTINUE it either
 * matches (and simply resumes, still bounded by maxAttacks/usedAttacks) or
 * fails the actorId/sequenceId match and is treated as a fresh lead attack.
 *
 * `sequenceId` is an opaque, caller-supplied correlation token (see
 * AttackSequenceUse below) — it is NEVER trusted as authority on its own.
 * The only thing that grants a call "chained" status is an EXACT match
 * against THIS entity's OWN currently-stored AttackSequenceState, which the
 * caller cannot fabricate: a token that doesn't match `entity.attackSequence`
 * (because none exists yet, or it belongs to a different/closed sequence) is
 * always treated as an attempt to start a brand-new, independent lead attack
 * instead — which then pays its own Action normally, and is therefore
 * blocked by ordinary action economy if the Action was already spent this
 * turn. See applyActionCardUse's own doc comment for the full validation.
 */
export type AttackSequenceState = {
  sequenceId:  string;
  /** The Entity.id this sequence belongs to — re-checked on every
   *  continuation attempt so one entity's in-progress sequence can never be
   *  advanced by a call operating on a DIFFERENT entity, even one that
   *  somehow carries a matching sequenceId (Part F — sequence ownership). */
  actorId:     string;
  /** Snapshot of DerivedStats.attackActionAttacks at the moment the LEAD
   *  attack succeeded — the hard ceiling on how many attacks this sequence
   *  may ever execute, regardless of what a later call claims. */
  maxAttacks:  number;
  /** How many attacks (lead + chained) have successfully executed so far.
   *  Only incremented on a SUCCESSFUL attack — a rejected child (stale item,
   *  resource unavailable, incapacitated, wrong card kind, exhausted, etc.)
   *  never advances this (Part J — failure must not advance the count). */
  usedAttacks: number;
};

/**
 * The master entity. Characters, monsters, and NPCs all share this shape.
 *   conditions       = flat active condition list for UI rendering.
 *   conditionMonitor = full runtime state: exhaustion, flags, suppressions.
 *   dmOverrides      = DM stat overrides, applied LAST in recomputeDerived().
 *                      Entity base data is NEVER modified by overrides.
 *                      Cancel = set active:false, values restore automatically.
 *   wildShapeState   = Wild Shape override layer, same non-mutating philosophy
 *                      as dmOverrides — null when not transformed.
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
  characterOverrides?: CharacterOverride[]; // character-owned replacements, before DM overrides
  dmOverrides:      DmOverride[];     // always [] for new entities
  wildShapeState:   WildShapeState | null;
  notes:            string;
  /**
   * The Exploration tab's own structured notes (scratch text + objectives/
   * npcs/clues/locations lists), as its own field — separate from `notes`
   * above, which is the Notes tab's own pure-JSON backstory/session/
   * personal-notes blob. Both tabs used to share the single `notes` field
   * with incompatible serialization schemes (a marker-delimited scheme
   * here, plain JSON there), so using both features on one character
   * silently corrupted and truncated the other's data (audit finding
   * NOTES-CORRUPT-1). Optional so an already-saved character with no
   * exploration notes yet parses fine — TabExploration.tsx's own parseNotes
   * falls back to reading the OLD marker-embedded format out of `notes`
   * for backward compatibility with characters saved before this field
   * existed, but never writes back there again once edited.
   */
  explorationNotes?: string;
  /**
   * Infusion ids (see src/content/infusions/index.ts) this entity currently
   * KNOWS — separate from which items are actually infused right now (that's
   * ItemInstance.infusedWith). Grows via 'infusion'-kind ChoiceDefinitions,
   * same shape as ASI's level-gated choice injection. Optional/defaults to
   * [] so existing saved entities parse unchanged.
   */
  knownInfusionIds?: string[];
  /**
   * Every action card (spells + activatable features + equipped-item
   * attacks) for this entity, computed once by recomputeDerived() —
   * the single choke point every mutation passes through — instead of
   * being regenerated by every consuming component on every render.
   * Optional/defaults to [] so existing saved entities parse unchanged;
   * recomputeDerived() always fills it in on the very next mutation.
   * See src/engine/actionCards.ts's generateAllActionCards().
   */
  actionCards?: ActionCard[];
  /**
   * Action-card ids (Feature.id, a spell id, or a synthetic card id like
   * 'unarmed_strike') the player has starred on the Actions tab, surfaced
   * in the Combat tab's FAVORITES section. Deliberately entity-level and
   * keyed by ActionCard.featureId, NOT stored on the Feature that (maybe)
   * backs the card — Feature.favoriteTag (below, now legacy/read-only for
   * pre-existing saves) only works for cards backed by a real Feature
   * object, which spell-based cards and synthetic cards like Unarmed
   * Strike never have, so favoriting them silently no-op'd. Optional/
   * defaults to [] so existing saved entities parse unchanged; a legacy
   * true Feature.favoriteTag is still honored for backward compat (see
   * TabActions.tsx's isFavoriteCard()) but new toggles only write here.
   */
  favoriteActionIds?: string[];
  /**
   * Which ruleset this character was created under. Undefined = the app's
   * original/default ruleset (5e — every character created before this
   * field existed, and every character created today, since 5.5e content
   * doesn't exist yet). Top-level on Entity rather than nested in Identity
   * because it governs which content pool the character draws from, more
   * fundamental than identity fields like race/class. See the ContentHeader
   * comment near the top of this file.
   */
  rulesetId?: RulesetId;
  /** Optional named rule-profile overlay; rulesetId remains the base official ruleset. */
  customRuleProfileId?: string;
  /** Creation-only provenance persisted with drafts; totals derive from stats + active rules. */
  creationAbilityMode?: AbilityGenerationMode;
  /**
   * Action/bonus-action/reaction usage for the entity's current turn. Null
   * when not actively tracked (outside combat, or before the first
   * startTurn() call this session) — every consumer (isFeatureAvailable,
   * the Combat tab's pills) treats null as "don't gate/show anything",
   * same optional-overlay philosophy as wildShapeState. Optional/defaults
   * to undefined so existing saved entities parse unchanged.
   */
  turnState?: TurnState | null;
  /**
   * Extra Attack sequence closure: the currently in-progress Attack-action
   * sequence (Extra Attack/Multiattack), if any — see AttackSequenceState's
   * own doc comment for the full model. Null/undefined means "no sequence in
   * progress," true for every entity outside an active multi-attack Attack
   * action, including every character without Extra Attack at all.
   */
  attackSequence?: AttackSequenceState | null;
  /**
   * Item 9 (context-dependent/three-state mechanics) — the player/DM's
   * current answer to each situational fact a currently-held Effect asks
   * about (keyed by Effect.situational.id). Absent key = unanswered
   * (conservative default: the effect does not apply — see
   * Effect.situational's own doc comment). Optional/defaults to {} so
   * existing saved entities parse unchanged.
   */
  situationalAnswers?: Record<string, boolean>;
  /** Mode Group state by group id (engine/modes.ts). Absent for every character with no mode group. */
  modeState?: Record<string, ModeState>;
  /** Weapon Mastery (2024): the weapon kinds the player chose to master, as weapon ids. See engine/weaponMastery.ts. */
  weaponMastery?: { picks: string[] };
  /**
   * Item 13 (build comparison/checkpoints/loadouts) — named, saved
   * equipment + prepared-spell configurations a player can swap between
   * (e.g. "Dungeon Loadout" vs "Social Loadout"), applied via
   * engine/loadout.ts's applyLoadout(). Deliberately scoped smaller than
   * "checkpoints" (a full character snapshot with restore) or "build
   * comparison" (two hypothetical builds diffed side by side) — both
   * disclosed as separately-scoped, not built here; see loadout.ts's own
   * doc comment for the full reasoning. Optional/defaults to [] so
   * existing saved entities parse unchanged.
   */
  loadouts?: Loadout[];
  /** Deprecated migration evidence only. New recomputations never populate it. */
  effectGrantedProficiencies?: {
    skills: SkillName[]; tools: string[]; weapons: string[]; armor: string[];
    languages?: string[]; spells?: string[]; cantrips?: string[];
  };
  /**
   * Re-audit A01/A29 (minimum commit-safety fix, item 14): monotonically
   * incremented by characterStore.ts on every local edit, undo, redo, or
   * successfully-applied inbound sync update (updateCharacter/undo/redo/
   * applyIncomingEntity/applyIncomingPatch). Purely a conflict-detection
   * signal — lets undo() notice "something else changed this character
   * (most likely an inbound sync patch) since this undo entry was
   * captured" instead of blindly restoring an obsolete snapshot over it.
   * NOT a full command/event log or CRDT — that's explicitly out of scope
   * for this pass. Optional/undefined on any entity created before this
   * field existed, or never mutated through the store yet; treated as 0.
   */
  revision?: number;
  /**
   * Closure pass 2 (source ownership): explicit, source-removable
   * proficiency/expertise/language grants — see EntitlementRecord's own doc
   * comment for the full model and what's deliberately NOT stored here
   * (effect-driven grants are derived from active source definitions). Authoritative for the categories it
   * covers; entity.proficiencies.{armor,weapons,tools,languages} and
   * entity.skills.skills[x].{trained,expertise} are DERIVED output,
   * rewritten from this array (unioned with the effect-derived set) on
   * every recomputeDerived pass — see deriveProficienciesFromEntitlements
   * in entitlements.ts. Optional/undefined on any entity created before
   * this field existed; migrateEntity() seeds it once from whatever flat
   * proficiencies/skills the entity already has, tagged sourceKind:'manual'
   * (a conservative migration — an untraceable historical entitlement is
   * treated as permanent, never silently dropped or guessed at).
   */
  entitlements?: EntitlementRecord[];
  /** Once initialized, entitlements and current source definitions are the
   * authoritative grant inputs. Flat proficiency/spell arrays are output only. */
  entitlementInputsVersion?: 1;
};

/**
 * Extra Attack sequence closure (two-issue final closure, Part B): the ONE
 * shared normalizer that strips runtime-only state which must NEVER survive
 * a durable boundary — today, just `attackSequence`. AttackSequenceState's
 * own doc comment (above) already documents it as transient/never-
 * persisted, but a plain Entity is serialized/deserialized generically
 * (SQLite row, portable export/import, sync entity/patch), so without this
 * an in-progress sequence recorded at save time would come back unchanged
 * on load — a stale, already-paid-for Action-economy bypass a caller could
 * then "continue" with the old sequenceId after a reload.
 *
 * Defined here (types.ts), not combat.ts, specifically so db/entityRepo.ts's
 * own per-row read path (parseEntityRow — the single choke point behind
 * BOTH loadEntity and loadAllEntities/loadEntitiesByKind) can call it
 * without a circular import: combat.ts transitively imports DEFAULT_RULES
 * from store/characterStore.ts, which itself imports entityRepo.ts.
 * types.ts has no such dependency. combat.ts re-exports this for callers
 * that already import turn-economy helpers from there.
 *
 * Called at every durable ingress point a raw/deserialized Entity can enter
 * normal runtime through — entityRepo.ts's parseEntityRow (covers
 * characterStore.ts's boot-time loadCharacters AND any direct loadEntity/
 * loadAllEntities/loadEntitiesByKind caller), applyIncomingEntity (sync full
 * snapshot AND backup restore, which reuses it — see app/backup.tsx),
 * applyIncomingPatch (on the merged result, so an incoming patch can never
 * SET attackSequence either), importCharacter, and portable character
 * import (characterPortable.ts) — mirroring the same set of call sites
 * hydrateLegacyItemInstanceIds (itemMechanics.ts) already uses for the
 * equivalent item-identity concern, rather than duplicating ad hoc
 * `{ attackSequence: null }` patches at each one individually.
 *
 * Deliberately narrower than startTurn's own reset (combat.ts): this must
 * run regardless of whether a turn is currently active (a save mid-turn,
 * mid-sequence, then reloaded), whereas startTurn only fires when a NEW turn
 * begins. `turnState` is intentionally left untouched — it has its own,
 * already-correct persistence semantics (a save mid-turn should still show
 * the same action-economy state on reload), and this closure is scoped to
 * `attackSequence` only.
 *
 * A no-op (returns the same reference) when there's nothing to strip,
 * matching this codebase's existing "avoid unnecessary object creation"
 * convention for hydration helpers (see hydrateItemFeatures,
 * characterStore.ts).
 */
export function stripTransientRuntimeState(entity: Entity): Entity {
  if (!entity.attackSequence) return entity;
  return { ...entity, attackSequence: null };
}

/** See Entity.loadouts' doc comment. `equippedItemIds`/`preparedSpellIds`
 *  are itemId/spellId lists, not full instance snapshots — applying a
 *  loadout moves matching items between carried/equipped and re-derives
 *  everything, rather than restoring stored feature/effect data that could
 *  drift from the item's actual current content definition. */
export type Loadout = {
  id:                string;
  name:              string;
  /** Definition ids of the items this loadout equips — kept for
   *  itemRepo.ensureLoaded()/display-name lookups and as the LEGACY
   *  targeting field for a loadout saved before `equippedItemInstanceIds`
   *  existed. Never the sole targeting key for a NEWLY captured loadout —
   *  see `equippedItemInstanceIds`'s own doc comment (item-identity
   *  closure, pass 2 finding E). */
  equippedItemIds:   string[];
  /**
   * Item-identity closure (pass 2, finding E): the OWNED ItemInstance ids
   * this loadout equips — captured alongside `equippedItemIds` above so a
   * loadout can distinguish which SPECIFIC copy of a duplicated stateful
   * item it wants equipped (two identical swords: Loadout 1 equips A,
   * Loadout 2 equips B). Optional so a loadout saved before this field
   * existed still parses; applyLoadout (loadout.ts) falls back to
   * itemId-only matching (first eligible instance — a loadout literally
   * cannot know which historical duplicate it meant) only when this is
   * absent. A loadout captured or re-saved under the current app always
   * populates it.
   */
  equippedItemInstanceIds?: string[];
  preparedSpellIds:  string[];
  createdAt:         number;
};

// ── 7. Leveling schemas ──────────────────────────────────────────────────────

export type LevelEntry = {
  level:   number;
  grants:  Grant[];
  choices: ChoiceDefinition[];
  hpDie:   4 | 6 | 8 | 10 | 12;
};

export type ClassProgression = {
  // Not branded ClassId, despite being unambiguous in meaning — reverted
  // after discovering the same volume problem as CharClass.id: every
  // hand-authored class/subclass progression literal across
  // src/content/classes/** and src/content/subclasses/** sets this inline
  // (dozens of sites), so branding would force an `as ClassId` cast onto
  // each one. See the Brand<> comment near the top of this file.
  classId: string;
  entries: LevelEntry[];
  /**
   * Which ability governs HP gain per level. Defaults to 'con' when absent
   * (standard 5e RAW) — see CharClass.hpAbility's doc comment for why this
   * exists. leveling.ts's applyHP/recalculateAllHP read this.
   */
  hpAbility?: Ability;
  /**
   * SRD 5.1 (CC-BY-4.0) legal status. All 12 core PHB classes are SRD-safe
   * (SRD 5.1 includes the full class chassis, not just a stripped subset) —
   * true for all of them. For SUBCLASSES (see SubclassProgression in
   * src/content/subclasses/), the SRD includes exactly ONE subclass per
   * class; all others are non-SRD and must be excluded from public builds.
   * Same semantics as Spell.srd — undefined = not yet audited = unsafe.
   * See docs/ROADMAP_1.0.md Phase 1 Step 1.4.
   */
  srd?: boolean;
  /** Which ruleset this progression (class or subclass) belongs to. Undefined = available under every ruleset. See the ContentHeader comment near the top of this file. */
  rulesetId?: RulesetId;
};

/**
 * A homebrew subclass, attachable to ANY class (official or homebrew) via
 * `classId`. Unlike SubclassProgression (src/content/subclasses/), which
 * derives its id by scanning features for a `source.refId` (fine for
 * hand-authored official files), homebrew subclasses need an explicit `id`
 * since src/db/contentCacheRepo.ts keys storage rows off it directly.
 * Selection itself is out of scope (see the subclass_unlock choice in
 * leveling.ts) — this only makes homebrew subclasses author-able and
 * browsable at parity with official ones.
 */
export type HomebrewSubclass = ClassProgression & {
  id:   SubclassId;
  name: string;
};

export type Grant = {
  kind:  'feature' | 'resource' | 'resource_upgrade' | 'spell_slots' | 'proficiency'
       | 'speed' | 'subclass_unlock' | 'init_spellcasting' | 'known_spells'
       | 'starting_item';
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
  /** `string` covers a homebrew-authored custom recharge description (see
   * DraftTrait's 'other' recharge option) — displayed as-is by CustomResource,
   * which already allows the same free-text escape hatch. */
  recharge:   'short_rest' | 'long_rest' | 'dawn' | 'never' | string;
  /** When true `maximum` is only the starting value: the pool's maximum tracks the proficiency bonus (Command Dice, "PB uses per Long Rest"). */
  perProficiencyBonus?: boolean;
  /** `maximum` is only the starting value: the maximum tracks this ability's modifier (minimum 1). */
  perAbilityModifier?: Ability;
  /** `maximum` is only the starting value: the maximum tracks character level times this. */
  perLevel?: number;
};

export type ResourceUpgrade = {
  resourceId: string;
  newMaximum: number;
  /** Also changes how the pool recharges (Bardic Inspiration returns on a Short Rest from level 5). */
  recharge?: string;
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
  /** Optional — lets audit.ts label a contribution without re-walking
   * entity.features/inventory itself. See AuditSourceKind. */
  sourceKind?: AuditSourceKind;
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

export type CharacterOverride = {
  id:string; entityId:string; stat:DmOverrideTarget; operation:'set'|'add'; value:number;
  label:string; active:boolean; appliedAt:number; cancelledAt:number|null;
};

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
  | 'manual'
  | 'dm_override'
  | 'character_override';

/** One contribution to a derived value. */
export type AuditEntry = {
  label:      string;           // "DEX modifier", "Chain shirt", "DM override — cursed"
  value:      number;           // the contribution (positive, negative, or zero for notes)
  sourceKind: AuditSourceKind;
  sourceId:   string | null;    // feature/item/override ID, or null for base values
  replacement?: { from: number; to: number }; // set override, not an additive +0
};

/** The full breakdown of how a derived value was computed. */
export type AuditTrail = {
  stat: string; total: number; entries: AuditEntry[];
  calculated?: number; override?: number | null; effective?: number;
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
  /**
   * 'ki_save_dc' parallels 'spell_save_dc' for Monk's ki-fueled abilities
   * (Stunning Strike, etc.) — Monk has no entity.spellcasting block, so
   * spellSaveDC stays null for it; kiSaveDC (DerivedStats) is the separate,
   * always-WIS-based formula those features need instead.
   * `{ ability }` is the generic version of the same idea for every OTHER
   * non-caster class-feature DC (Barbarian's Intimidating Presence is STR,
   * etc.) — DerivedStats.abilityBasedDC precomputes 8 + prof + mod for all
   * six abilities so any such feature can reference the right one without
   * needing its own bespoke DerivedStats field like kiSaveDC got first.
   */
  requiresSave: { ability: Ability; dc: 'spell_save_dc' | 'ki_save_dc' | { ability: Ability } | number } | null;
  /**
   * A-57: discrete alternative ways to use this same activation — e.g.
   * Divine Smite's choice of which spell-slot tier to expend for more
   * damage, or Great Weapon Master's -5-to-hit/+10-damage tradeoff.
   * Undefined/empty means "use it the one way `resourceCost` already
   * describes," exactly like every card before this field existed — zero
   * behavior change for the ~600 existing cards that don't set it.
   * Purely descriptive beyond `resourceCost` itself: this app doesn't
   * auto-resolve combat (see actionCards.ts's own "app shows dice
   * expression, player announces it" philosophy), so `description` is text
   * for the player to read, not a computed effect.
   */
  options?: ActivationOption[];
};

/**
 * One entry in FeatureActivation.options (A-57). Choosing an option with a
 * `resourceCost` REPLACES the activation's own `resourceCost` for that use
 * (see applyActionCardUse in engine/actionUse.ts) —
 * omitting it means "same cost as the base activation, this option only
 * changes flavor" (e.g. Great Weapon Master's two attack choices cost
 * nothing extra either way).
 */
/**
 * Extra Attack sequence closure: the caller's request to treat one weapon-
 * attack use as part of an Attack-action sequence (Extra Attack/Multiattack)
 * — see AttackSequenceState's own doc comment (section 3, above) for the
 * full authority model this replaces the old, unconstrained
 * `isChainedAttack: true` boolean with. `sequenceId` is generated ONCE by
 * the application/UI layer when it opens the FIRST attack chooser (any
 * opaque unique string — e.g. a uuid, or `${Date.now()}-${Math.random()}`)
 * and passed unchanged on every subsequent attack of that same sequence.
 * Passing this on the first attack of a fresh sequence (entity.attackSequence
 * is null, or doesn't match) is always safe — it behaves EXACTLY like an
 * ordinary single attack (same cost, same action-economy spend) and only
 * additionally marks entity.attackSequence for potential continuation on
 * success. Only a call whose sequenceId matches an entity's OWN currently-
 * active AttackSequenceState is ever treated as a bypass-eligible
 * continuation — see applyActionCardUse (actionUse.ts). Omitted entirely
 * (undefined) for every ordinary, non-Attack-action card use.
 */
export type AttackSequenceUse = {
  sequenceId: string;
};

export type ActivationOption = {
  id:            string;
  label:         string;         // e.g. "2nd-level slot"
  resourceCost?: ResourceCost;
  description?:  string;         // e.g. "+3d8 radiant damage"
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
 *
 * This variant's id fields (conditionId/resourceId/formId) are left plain
 * `string`, not branded, for now — out of scope for the initial branded-id
 * pass (see the Brand<> comment near the top of this file); resourceId in
 * particular is often a runtime/grant-authored id rather than a global
 * content-registry id, so it doesn't map cleanly onto one branded type.
 */
export type AbilityEffect =
  | { type: 'damage';           dice: string; damageType: string; saveOnSuccess?: 'half' | 'none';
      /** Scaling dice by character level (Dragonborn's Breath Weapon: 1d10, 2d10 at 5, 3d10 at 11, 4d10 at 17): the
       *  highest tier at or below the character's level replaces `dice` when the card is shown. */
      diceByLevel?: { level: number; dice: string }[] }
  | { type: 'heal';             dice: string; bonusMod?: Ability }
  | { type: 'apply_condition';  conditionId: string; duration: DurationTracker }
  | { type: 'remove_condition'; conditionId: string }
  | { type: 'grant_speed';      speedType: 'fly' | 'swim' | 'climb' | 'walk'; amount: number; duration: DurationTracker }
  | { type: 'transform';        formId: string }
  | { type: 'set_flag';         flag: string; value: boolean }
  | { type: 'spend_resource';   resourceId: string; amount: number }
  | { type: 'restore_resource'; resourceId: string; amount: number | 'full' }
  /** Casts a known spell by id, spending whatever this Feature's own
   * activation.resourceCost specifies (a dedicated pool OR a real spell
   * slot) — NOT entity.spellcasting.known's normal slot-consumption path.
   * See traitCompiler.ts's spell_grant effect kind. */
  | { type: 'cast_spell';       spellId: string };

/**
 * Purely descriptive outcome-branch data for an activated ability — "what
 * happens on a hit/miss/success/failure," for the player to read and
 * self-resolve. NEVER auto-applied: this app shows the dice expression and
 * lets the player announce/apply the result themselves (see AbilityEffect's
 * own doc comment), and outcomes follow the exact same philosophy. `effects`
 * reuses AbilityEffect only for the shape the action-card renderer already
 * knows how to summarize (set_flag, restore_resource, transform); anything
 * else — a compound or free-form consequence — goes in `description`
 * instead of forcing a new AbilityEffect variant to exist just to be
 * describable.
 */
export type OutcomeKey = 'hit' | 'miss' | 'success' | 'failure';
export type ActivationOutcome = { description?: string; effects?: AbilityEffect[] };
export type OutcomeMap = Partial<Record<OutcomeKey, ActivationOutcome>>;

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
  /** One rendered line per populated OutcomeMap entry, e.g. "On hit: ...".
   *  Empty when the source Feature has no `outcomes`. Purely descriptive —
   *  see OutcomeMap's own doc comment. */
  outcomes: string[];
  /** The source Feature's `trigger` text, verbatim — null when it has none
   *  (or has one but no `activation`, in which case it never gets a card
   *  at all; see TriggeredFeaturesSection instead). Purely descriptive. */
  triggerNote: string | null;

  activation:   FeatureActivation;
  resourceCost: ResourceCost | null;

  /** Which sheet tabs this card appears in. Same feature, multiple contexts. */
  tabs: ('actions' | 'spellcasting' | 'features' | 'inventory')[];

  /** Runtime — recomputed on every render. Greyed-out when unavailable. */
  available:         boolean;
  /** e.g. "No 3rd-level spell slots remaining", "Already concentrating" */
  unavailableReason: string | null;
  /**
   * Rules-engine blocker fix (prepared-spell eligibility): true ONLY for a
   * leveled spell card whose entire unavailability is that it isn't
   * prepared — every other legality/cost check (slot availability, action
   * economy, resource cost) already passed. The UI uses this to offer a
   * table-first "Cast Anyway" Quick Override on top of the normal disabled
   * state, instead of requiring Free Edit to force a one-off exception.
   * false/undefined for every non-spell card, every cantrip, and a spell
   * blocked by anything else (or nothing) — see isSpellPreparationLegal's
   * own doc comment (actionCards.ts) for the exact source-aware policy.
   * Optional so the many non-spell ActionCard literals throughout this file
   * don't all need to set it explicitly.
   */
  preparationOverridable?: boolean;
  /**
   * Rules-engine HIGH-batch closure (C): true ONLY when the entity is
   * incapacitated (0 HP or the explicit Unconscious condition — see
   * isIncapacitated, combat.ts) AND that status is the card's ENTIRE
   * remaining unavailability — every other legality check (resource cost,
   * action economy, and for a spell card, preparation) already passed. The
   * UI offers a table-first "Use Anyway" Quick Override on top of the
   * normal disabled state when this is true, mirroring
   * preparationOverridable's own pattern exactly. false/undefined for a
   * healthy entity, a Dead entity (hard blocker, never overridable — see
   * isDead's own doc comment), or a card blocked by anything else.
   */
  incapacitatedOverridable?: boolean;
  /**
   * Rules-engine blocker closure (1B — ActionCard must preserve context):
   * the SpellCastingContext this card was generated to represent — the
   * default/primary one when several exist (see spellCastingContexts
   * below). Undefined for every non-spell card. applyActionCardUse
   * revalidates THIS EXACT context (by contextKey) fresh at execution time
   * rather than silently re-resolving a possibly-different source — if the
   * selected context no longer exists among the entity's current sources,
   * execution fails safely rather than switching source.
   */
  spellCastingContext?: SpellCastingContext;
  /**
   * Every MECHANICALLY DISTINCT candidate context for this spell (collapsed
   * — two contexts with the same ability/policy/legality count as one),
   * only populated (length > 1) when the player actually has a real choice
   * to make (e.g. a Wizard/Sorcerer character's shared spell). The UI shows
   * a "Cast as..." chooser when this has more than one entry; a single-
   * entry or absent array means there's nothing to choose between, so the
   * normal single-tap Cast/Cast-Anyway flow applies unchanged.
   */
  spellCastingContexts?: SpellCastingContext[];
  /**
   * Item-identity closure (pass 2, finding D): when this card was generated
   * from an authored Feature living on a SPECIFIC equipped ItemInstance
   * (not a class/race/feat Feature on entity.features), `sourceKind:'item'`
   * + `sourceId: <that ItemInstance.id>` records exactly which owned copy
   * it came from — `featureId` above stays the plain Feature.id (shared by
   * every instance of the same ItemDefinition, since two identical items
   * carry the identical authored feature), so content/definition lookups by
   * featureId are unaffected. applyActionCardUse (actionUse.ts) revalidates
   * `sourceId` is STILL an equipped instance before executing, and resolves
   * the feature from THAT instance alone — never a flat search across every
   * equipped item's features, which would silently execute a stale card
   * (its instance already removed/unequipped) against an identical
   * remaining copy instead of rejecting it. undefined for every non-item
   * card, and for a card generated before this fix existed (legacy
   * fallback: the old flat-search behavior, unchanged).
   */
  sourceKind?: 'item';
  sourceId?:   string;
  /**
   * Rules-completeness batch (ritual casting): true when this is a spell
   * card AND the spell is ritual-tagged (Spell.ritual) AND at least one of
   * this card's candidate SpellCastingContexts has ritualEligible === true
   * (see that field's own doc comment). Undefined for every non-spell card
   * and every spell that isn't ritual-capable through any source the
   * character currently has. Purely a "should the UI offer a Cast-Normally-
   * vs-Cast-as-Ritual choice at all" signal generated against the BEST-
   * EFFORT/default context; applyActionCardUse revalidates the SPECIFIC
   * selected context's own ritualEligible flag fresh at execution time
   * (never trusts this precomputed card-level flag alone), so a card that
   * over-offers ritual mode for a context that turns out not to support it
   * fails safely at execution rather than casting for free.
   */
  ritualEligible?: boolean;
  /**
   * Extra Attack / action-structure batch: true only for a card that
   * represents an actual weapon-or-unarmed ATTACK usable with the Attack
   * action — the synthetic basic-weapon-attack card, the synthetic Unarmed
   * Strike card, and an equipped item's own authored attack feature (a
   * `damage`-type abilityEffect) WHEN that item is itself a weapon, per the
   * SAME isWeapon() classifier every other weapon check in this codebase
   * already uses (see generateAllActionCards, actionCards.ts, for exactly
   * where each is set). Undefined for every spell card and every non-attack
   * class/race/item feature — those are never eligible for Extra Attack's
   * extra attack opportunities even when they also happen to be
   * `cardType: 'damage'`. This is the ONE signal the player-facing Attack
   * Action sequence (TabActions.tsx) uses to decide which cards to offer as
   * attack choices; it never infers attack-eligibility from `cardType`
   * alone, which also covers non-weapon damage sources like a spell.
   *
   * Extra Attack sequence closure (two-issue final closure, Part A): ALSO
   * requires `activation.actionType === 'action'` — a weapon's own authored
   * attack feature that activates as a Bonus Action or Reaction (deals
   * damage, belongs to a weapon, but isn't a genuine Attack-action attack)
   * must never be true, since that would let it be used as a free Extra
   * Attack continuation. The two hardcoded synthetic cards (basic weapon
   * attack, Unarmed Strike) are unconditionally `actionType: 'action'` by
   * construction, so this never excludes them. `applyActionCardUse`
   * (actionUse.ts) independently re-checks `activation.actionType ===
   * 'action'` at execution time — never trusts this flag alone — so a
   * misclassified or forged `true` here still can't bypass action economy.
   */
  isWeaponAttack?: boolean;
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

/**
 * Item 14 (Sessions) — a real-world sit-down play session, distinct from
 * DeviceSession (the LAN connection identity) and SyncEvent.sessionId (the
 * connection-session id, which changes every time the DM re-hosts). A
 * session is "active" precisely when the newest entry in
 * Campaign.sessionLog has `startedAt` set but no `endedAt` — deliberately
 * not a separate Campaign.activeSessionId field, so there's exactly one
 * source of truth for session state instead of two that could drift.
 * `startedAt`/`endedAt`/`attendedCharacterIds` are optional so every
 * existing hand-added "+ Add Session Note" entry (summary-only, no real
 * start/end) keeps parsing unchanged — those are just session notes not
 * tied to a tracked start/end, same as before this existed.
 */
export type SessionLogEntry = {
  id:        string;
  summary:   string;
  date:      number;   // timestamp — kept as the "when this entry was created" field, unchanged
  startedAt?: number;
  endedAt?:   number;
  /** Snapshot of campaign.characterIds at the moment the session was
   *  started — "who was expected," not a live minute-by-minute attendance
   *  log (the app has no per-player join/leave tracking beyond the sync
   *  roster, which is connection state, not attendance). */
  attendedCharacterIds?: string[];
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
  /**
   * Item 15 (campaign content manifest) — InstalledPack.id values (see
   * src/db/packRegistryRepo.ts) the DM has banned from this specific
   * campaign. Deliberately scoped to whole homebrew packs, not individual
   * content or official content — see packDiagnostics.ts's
   * bannedContentIds() for the full reasoning. Optional/defaults to [] so
   * every existing campaign parses unchanged and is fully unrestricted.
   */
  bannedPackIds?: string[];
  /** Optional free-text blurb set at creation (CREATE_CAMPAIGN_FLOW_SPEC.md's Basics step). */
  description?:   string;
  /** The ruleset this campaign is built for. Optional — undefined means no restriction, same
   *  "unset = unrestricted" convention as everywhere else a RulesetId is optional in this file. */
  rulesetId?:     RulesetId;
};

// ── Prepared Encounters ──────────────────────────────────────────────────────
// Planning data, deliberately separate from runtime combat state
// (CombatState/InitiativeEntry in engine/combat.ts — the "ActiveEncounter").
// A PreparedEncounter never holds live HP/conditions/derived stats; it holds
// enough to INSTANTIATE those via preparedEncounter.ts's
// instantiatePreparedEncounter(), which spawns fresh Entity instances the
// same way monsters.tsx's "spawn into encounter" already does. Starting the
// same template twice must produce two independent sets of entities, and
// starting it must never write back into the template.

export type EncounterStatus = 'draft' | 'ready' | 'completed' | 'archived';

export type PreparedCombatantHpMode = 'average' | 'max' | 'roll' | 'manual';

/**
 * One row in a prepared encounter's combatant list. `quantity` avoids
 * needing N identical rows for "Goblin x6" — expanded into N entities at
 * instantiation, each independently mutable afterward (that expansion, not
 * this row, is where "duplicates become independent" actually happens).
 */
export type PreparedCombatant = {
  id:          string;              // stable id within this encounter, NOT the monster's own id
  monsterId:   string;              // MonsterTemplate.id (official or homebrew)
  displayName?: string;             // e.g. "Goblin (Lookout)" instead of the template's own name
  quantity:    number;
  hpMode:      PreparedCombatantHpMode;
  manualHp?:   number;              // used when hpMode === 'manual'
  groupId?:    string;              // EncounterGroup.id — DM-UI organization only
  waveId?:     string;              // EncounterWave.id — undefined means "present from the start"
  startingConditionIds?: string[];  // Condition ids applied at instantiation
  /** Resource pool id -> current value to start at (e.g. Glassback's Pressure at 2 rather than its maximum of 3). Clamped to 0..maximum. */
  startingResources?: Record<string, number>;
  notes?:      string;
  hidden?:     boolean;             // DM-only — not yet revealed to players
  initiativePreference?: number;    // fixed initiative instead of rolling, if set
};

/** DM-UI organization only — see PreparedEncounter's own doc comment. */
export type EncounterGroup = {
  id:   string;
  name: string;
};

/**
 * A reinforcement wave. Deployment is manual-first (a Deploy button) —
 * triggerKind is informational/organizational, not a scripting engine. A
 * 'descriptive' trigger (e.g. "when the alarm bell rings") is just stored
 * as text; the DM still presses Deploy when it happens at the table.
 */
export type EncounterWaveTriggerKind = 'manual' | 'round' | 'descriptive';

export type EncounterWave = {
  id:            string;
  name:          string;
  triggerKind:   EncounterWaveTriggerKind;
  triggerRound?: number;   // used when triggerKind === 'round' (shown as a reminder, not auto-fired)
  triggerNote?:  string;   // free text — the 'descriptive' trigger text, or flavor for any kind
};

export type EncounterEnvironmentEntry = {
  id:          string;
  label:       string;        // "Difficult terrain", "Darkness", "Poison gas", or custom text
  description?: string;
  /** 'secret' = DM-only (never shown to players, e.g. a hidden Collapse Counter hazard); undefined/'public' = visible to all. */
  visibility?: 'public' | 'secret';
  /** Optional link to a real Condition for an actual mechanical effect
   *  (e.g. an environmental hazard that behaves like a Condition already
   *  in the compendium). Left unset, this stays purely descriptive — never
   *  auto-applied to anyone, matching the "disclosed, not automated"
   *  pattern used throughout this app for content the engine can't safely
   *  auto-resolve on its own. */
  conditionId?: string;
};

export type EncounterRewardKind = 'xp' | 'currency' | 'item' | 'custom';

export type EncounterReward = {
  id:      string;
  kind:    EncounterRewardKind;
  label:   string;     // "150 XP", "50 gp", "Potion of Healing x2", or custom text
  amount?: number;     // numeric amount for xp/currency, optional even then
  itemId?: string;     // for kind 'item', links to a real Item id
};

export type PreparedEncounter = {
  id:           string;
  /** Undefined = a reusable template, not tied to one campaign. */
  campaignId?:  string;
  /** Item 14 (Sessions) — the SessionLogEntry.id active when this encounter
   *  was created, if any (see SessionLogEntry's own doc comment). Lets a
   *  DM later see which encounters were prepared/run during a given
   *  session. Undefined for an encounter created outside an active
   *  session, or one created before this field existed. */
  sessionId?:   string;
  name:         string;
  description?: string;
  location?:    string;
  dmNotes?:     string;
  tags:         string[];
  status:       EncounterStatus;
  combatants:   PreparedCombatant[];
  groups:       EncounterGroup[];
  waves:        EncounterWave[];
  environment:  EncounterEnvironmentEntry[];
  tacticsNotes?:     string;
  victoryNotes?:     string;
  rewards:           EncounterReward[];
  expectedPartyNote?: string;   // e.g. "4 players, level 5" — free text, no enforcement
  createdAt:    number;
  updatedAt:    number;
  /** Informational only — does not block re-starting the same template
   *  again (starting twice must produce two independent active encounters). */
  lastStartedAt?: number;
  /** Set when a DM marks this completed after combat. The template's own
   *  combatant list is never overwritten with live HP/conditions — see
   *  preparedEncounter.ts's own doc comment. */
  completedAt?:   number;
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
