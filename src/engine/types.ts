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
  id:          string;
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
  feature: Feature;
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
      | { kind: 'two_one_or_three_one' };
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
  age?:       string;
  size?:      'Tiny' | 'Small' | 'Medium' | 'Large';
  languages?: string[];
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
   * Escape hatch for hand-authored classes too complex for the simplified
   * builder fields (subclass features, known-spell grants, custom slot tables,
   * per-level effect-bearing features). When present, getProgressionForClass
   * uses this verbatim and ignores all the simplified fields above. The class
   * builder cannot create this — it's only set by seeded built-in homebrew or
   * the import pipeline — and editing such a class in the builder will drop it.
   */
  rawProgression?:        ClassProgression;
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
};
export type Condition  = { id: string; name: string; description: string; features: Feature[] };

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

/** One class the character has taken. `level` is the level in THIS class only — not the character's total level. */
export type ClassLevelEntry = {
  classId:    string;
  subclassId: string | null;
  level:      number;
};

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
  /**
   * Active advantage/disadvantage grants, aggregated from any Effect with
   * operation 'advantage'/'disadvantage' (see resolver.ts's resolveBinary
   * for the neutralization rule — if both are present for the same target,
   * they cancel to straight and don't appear here at all). `target` is a
   * free-text description of what it applies to (e.g. "Wisdom saving
   * throws against being charmed"), matching the same free-text pattern
   * already used for condition mechanical reminders (CONDITION_WARNINGS in
   * TabCharacter.tsx) — 5e's variety here is too large to enumerate as a
   * fixed set of targets. Display/reminder only, same as everywhere else
   * in the app with no attack-roll automation: shown to the player so they
   * remember to roll 2d20, not auto-applied to any roll.
   */
  advantageStates:   { target: string; state: 'advantage' | 'disadvantage' }[];
};

/**
 * The scalar numeric fields inside DerivedStats that DM overrides may target.
 * savingThrows and attackBonuses are excluded — they are compound, not scalar.
 */
export const DERIVED_NUMERIC_KEYS = new Set<string>([
  'proficiencyBonus', 'ac', 'initiative', 'speed',
  'passivePerception', 'passiveInvestigation', 'passiveInsight',
  'spellSaveDC', 'spellAttackBonus',
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

export type ChoiceOption = {
  id:    string;
  label: string;
  value: unknown;
};

export type ChoiceDefinition = {
  id:       string;
  prompt:   string;
  kind:     'skill' | 'spell' | 'language' | 'tool' | 'equipment' | 'feat' | 'asi' | 'custom'
          | 'spellcasting_ability' | 'subclass' | 'infusion' | 'feature_pool';
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
};

export type ItemInstance = {
  itemId:   string;
  quantity: number;
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
           | 'grant_spell'
           // Grants a special sense (darkvision/blindsight/tremorsense/truesight).
           // Aggregated into derived.senses; same type keeps the largest range.
           | 'grant_sense'
           // Grants a non-walking movement speed (fly/swim/climb/burrow).
           // Aggregated into derived.movement; same type keeps the largest value.
           | 'grant_movement';
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
  /** Player-set: marks this feature as exploration-relevant for the Exploration view filter. */
  explorationTag?: boolean;
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
  | 'none' | 'ability_score' | 'unarmored_defense' | 'skill_proficiency' | 'tool_proficiency'
  | 'advantage_disadvantage' | 'sense' | 'movement' | 'movement_condition'
  | 'damage_resistance' | 'damage_immunity' | 'damage_vulnerability'
  | 'spell_grant' | 'resource_ability';

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
    recharge:     'short_rest' | 'long_rest' | 'other';
    rechargeOther: string;
    uses:         string;
    minSlotLevel: string;
  }[];
  // resource_ability (e.g. Chi Pulse: bonus action, 1/rest, heal)
  actionType:      'action' | 'bonus_action' | 'reaction' | 'other';
  actionTypeOther: string;
  recharge:        'short_rest' | 'long_rest' | 'other';
  rechargeOther:   string;
  uses:            string;
  healDice:        string;
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
  dmOverrides:      DmOverride[];     // always [] for new entities
  wildShapeState:   WildShapeState | null;
  notes:            string;
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
  id:   string;
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
  | { type: 'restore_resource'; resourceId: string; amount: number | 'full' }
  /** Casts a known spell by id, spending whatever this Feature's own
   * activation.resourceCost specifies (a dedicated pool OR a real spell
   * slot) — NOT entity.spellcasting.known's normal slot-consumption path.
   * See traitCompiler.ts's spell_grant effect kind. */
  | { type: 'cast_spell';       spellId: string };

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
