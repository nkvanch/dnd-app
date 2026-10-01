// ============================================================================
// FILE: src/session/types.ts
// Host / DM / Player live-session layer: shared types.
//
// This layer is deliberately independent of src/sync/* (the legacy campaign
// sync, where the campaign creator's phone is Host AND DM). See
// artifacts/host-dm-rework/design.md.
// ============================================================================

// ── Roles ────────────────────────────────────────────────────────────────────

/** Independent capabilities. A participant holds any subset. */
export type Capability = 'host' | 'dm' | 'player';

export type ParticipantId = string;

export type PublicParticipant = {
  id:           ParticipantId;
  nickname:     string;
  capabilities: Capability[];
  connected:    boolean;
  characterId:  string | null;
  /** True while this participant asked for DM and the Host has not approved yet. */
  requestedDm?: boolean;
};

// ── Character changes (player-owned persistent changes) ──────────────────────

export type CharacterChange =
  | { kind: 'exhaustion'; delta: number }
  | { kind: 'max_hp';     delta: number }
  | { kind: 'ability';    ability: 'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha'; delta: number }
  /** Current HP damage (negative delta) or healing (positive delta), clamped to [0, maximum] on
   *  apply — see entityAdapter.ts's applyChangesToEntity. Same consent flow as every other
   *  CharacterChange (dm.request_change -> player.respond); there is no way for the DM to apply
   *  this directly without the player accepting/modifying it, same as a permanent change. */
  | { kind: 'hp';         delta: number }
  /** Grants temp HP — 5e temp HP doesn't stack, so apply takes the higher of current temp and
   *  this amount rather than adding (see applyChangesToEntity). */
  | { kind: 'temp_hp';    amount: number }
  /** DM_SCREEN_SPEC.md item 2's "Add Condition" fast action. `conditionId` is a raw content id
   *  (e.g. 'poisoned') — the player's own device resolves it against its own content registry to
   *  apply any mechanical features (see entityAdapter.ts), the same way the character sheet's own
   *  condition toggle already does; the DM side only ever needs the id to label the request. */
  | { kind: 'condition_add';    conditionId: string }
  | { kind: 'condition_remove'; conditionId: string }
  /** DM_SCREEN_SPEC.md item 2's "Concentration" fast action — breaks it, same as failing a
   *  concentration save; there is no "start concentrating on X" DM action, since the DM doesn't
   *  choose what a Player casts. */
  | { kind: 'concentration_break' }
  /** DM_SCREEN_SPEC.md item 2's "Stabilize" fast action — resets death save counters and marks
   *  the character stable, same end state 3 successful death saves already reach. */
  | { kind: 'stabilize' };

export type CharacterSummary = {
  name:  string;
  hp:    number;
  maxHp: number;
  ac:    number;
};

/**
 * DM_SCREEN_SPEC.md item 2's Party Dashboard fields beyond the bare CharacterSummary — reported
 * alongside it, read-only, DM-dashboard-only data: never given a Public Persona override (see
 * PublicPersona's own doc comment — it only ever carries name/hp/maxHp/ac) and never sent to a
 * peer player at all (state.ts's publicCharacterOf simply omits this field entirely, the same way
 * it already omits persona's raw config). Condition ids and the concentration spell id are raw
 * content ids, not resolved display names — resolving them would need the DM's device to share a
 * content registry with the player's, which isn't guaranteed; the DM-side UI formats the raw id
 * (capitalize, replace separators) instead, same tradeoff as everywhere else this wire deals in ids.
 */
export type CharacterVitals = {
  tempHp:        number;
  speed:         number;
  exhaustion:    number;
  conditions:    string[];
  concentration: string | null;
  deathSaves:    { successes: number; failures: number; stable: boolean };
  resources:     { id: string; name: string; current: number; maximum: number }[];
  /** null = this character has no spellcasting at all (not "caster with zero slots"). */
  spellSlots:    Record<string, { total: number; used: number }> | null;
};

/** What the player's device exposes so the session layer can apply accepted
 *  changes to the real character. */
export interface CharacterAdapter {
  characterId: string;
  /** Monotonic revision of the persistent character. Bumped by ANY local change. */
  getRevision(): number;
  summary(): CharacterSummary;
  /** Optional — a real character reports it, the test FakeCharacter may not. */
  vitals?(): CharacterVitals;
  /** Applies persistent changes; must bump the revision. Returns the new revision. */
  applyChanges(changes: CharacterChange[], requestId: string): number;
}

// ── Effects ──────────────────────────────────────────────────────────────────

export type EffectVisibility = 'public' | 'target' | 'secret';

/** A mechanical component; intentionally a small closed set so the player can
 *  always compute derived numbers without knowing the effect's identity. */
export type EffectComponent = {
  stat:      'ac' | 'speed' | 'initiative' | 'save' | 'spell_attack' | 'spell_dc';
  operation: 'add';
  value:     number;
};

export type EffectDuration =
  | { unit: 'manual' }
  | { unit: 'rounds'; total: number; remaining: number };

/** What the Host stores. For visibility 'secret', name/description/source are
 *  ALWAYS null on the Host: identity lives only in the DM's SecretVault. */
export type EffectDefinition = {
  id:          string;
  name:        string | null;
  description: string | null;
  source:      string | null;
  visibility:  EffectVisibility;
  components:  EffectComponent[];
  duration:    EffectDuration;
};

export type ApplicationState = 'ACTIVE' | 'DUE_TO_END' | 'ENDED';

export type EffectApplication = {
  id:        string;                 // `${effectId}:${targetId}`
  effectId:  string;
  targetId:  ParticipantId;
  state:     ApplicationState;
  remaining: number | null;          // rounds remaining, null for manual
  appliedAtRevision: number;
  endedAtRevision:   number | null;
};

export type LiveEffect = {
  definition:   EffectDefinition;
  applications: Record<string, EffectApplication>;
};

/** DM-private effect identity, never sent to the Host. */
export type SecretEffectMeta = {
  effectId:             string;
  name:                 string;
  description:          string;
  source:               string;
  notes:                string;
  hiddenDurationReason: string;
};

// ── Encounters (public projection only) ──────────────────────────────────────

/**
 * Per-field reveal state for one combatant (DM_SCREEN_SPEC.md item 9). Lives on the canonical
 * LiveCombatant and is sent to every viewer unchanged — knowing WHICH fields are currently gated
 * isn't itself sensitive, only the gated VALUES are. The DM's own view always has every field
 * populated regardless of these flags; a Player's projected copy (see state.ts's
 * combatantForPlayer) omits/substitutes whatever is set to false here.
 */
export type MonsterVisibility = {
  name:       boolean;
  hpState:    boolean;
  exactHp:    boolean;
  ac:         boolean;
  conditions: boolean;
};

export type LiveCombatant = {
  id:      string;
  name:    string;
  /** Deliberately coarse: exact HP stays DM-side unless the DM chooses to send it (exactHp
   *  below). Always populated on the canonical Host state; optional ONLY because a Player's
   *  projected copy omits it when visibility.hpState is false. */
  hpState?: 'healthy' | 'bloodied' | 'down';
  ac?:     number;
  /** Real numbers, opt-in — most tables never need this; see hpState's own doc comment for why
   *  it stays coarse by default. */
  exactHp?: { current: number; max: number };
  /**
   * Active condition ids (DM_SCREEN_SPEC.md items 6/9's "conditions" on a monster) — raw content
   * ids, same tradeoff as CharacterVitals.conditions (DM-side resolves the display name; no
   * shared content registry assumed over the wire). Deliberately NOT routed through the Effect/
   * EffectApplication system: that system models PLAYER-relevant numeric derived-stat changes
   * (EffectComponent's ac/speed/initiative/save/spell_attack/spell_dc), and a LiveCombatant has no
   * derived-stat model for those to attach to beyond the bare `ac` field above — a monster
   * "condition" here is DM-tracked narrative/mechanical bookkeeping, gated the same way hpState/
   * exactHp/ac already are, not a parallel effects pipeline. Always populated (possibly empty) on
   * the canonical Host state; optional ONLY because a Player's projected copy omits it entirely
   * when visibility.conditions is false (see combatantForPlayer).
   */
  conditions?: string[];
  /**
   * DM_SCREEN_SPEC.md item 6's "monster resource/recharge" (legendary actions, a breath weapon's
   * recharge, etc.) — always DM-only, never sent to a Player at all (no visibility flag, unlike
   * conditions/hpState/ac/exactHp above): item 9's own per-field toggle list never names
   * "resources", and this is DM encounter-running bookkeeping, not table-facing information. No
   * dice-rolling automation for recharge (e.g. "5-6 on a d6") — the DM rolls at the table and taps
   * Recharge/Use here, same "table-resolved, not simulated" tradeoff item 8 already allows for.
   */
  resources?: CombatantResource[];
  /** Defaults to {name:true, hpState:true, exactHp:false, ac:true, conditions:true} on creation —
   *  matches what a combatant already showed before this field existed, so nothing already in
   *  play silently loses information the instant this ships. */
  visibility: MonsterVisibility;
};

export type CombatantResource = {
  id:      string;
  name:    string;
  current: number;
  maximum: number;
};

export const STANDARD_MONSTER_VISIBILITY: MonsterVisibility = { name: true, hpState: true, exactHp: false, ac: true, conditions: true };

export type LiveEncounter = {
  id:         string;
  name:       string;
  combatants: LiveCombatant[];
  active:     boolean;
  /**
   * Turn order as a flat list of ids — EITHER a LiveCombatant.id (a monster/NPC) OR a
   * ParticipantId (a player's own character acts in initiative order too). No numeric
   * initiative score is tracked on the wire; the DM rolls/tracks initiative at the table and
   * tells the app the resulting order via dm.set_turn_order. Empty until the DM sets it —
   * activating an encounter does not imply an order.
   */
  turnOrder:        string[];
  /** Index into turnOrder whose turn it currently is, or null before the DM has started turns. */
  currentTurnIndex: number | null;
  /** Starts at 1 on activation; increments when dm.next_turn wraps past the end of turnOrder. */
  round:            number;
};

// ── Change requests ──────────────────────────────────────────────────────────

export type ChangeRequestStatus =
  | 'PENDING' | 'ACCEPTED' | 'MODIFIED' | 'REJECTED' | 'CANCELLED';

export type ChangeRequest = {
  id:            string;
  requesterId:   ParticipantId;      // the DM participant
  targetId:      ParticipantId;      // the player participant
  characterId:   string | null;
  label:         string;
  baseRevision:  number;             // target character revision the DM saw
  original:      CharacterChange[];  // never mutated after creation
  status:        ChangeRequestStatus;
  createdAtRevision: number;
  resolvedAtRevision: number | null;
  /** The exact changes applied on accept/modify; null otherwise. */
  finalApplied:  CharacterChange[] | null;
  /** Populated when the player modified the proposal (== finalApplied then). */
  playerModified: CharacterChange[] | null;
  /** True when the player accepted despite the character having changed since baseRevision. */
  acknowledgedStale: boolean;
  /** Set (without resolving) when a response was refused as stale. */
  staleAgainst:  number | null;
};

// ── Rule suggestions (DM_SCREEN_SPEC.md item 5) ───────────────────────────────
// Deliberately a structured proposal/decision record, NOT an auto-applying rule patcher — the
// live CampaignPolicy only carries a handful of fields (ruleset, max level, banned packs/
// subclasses, required packs); most real house rules (hp mode, multiclass, ability generation,
// table variants) have nowhere on the wire to auto-apply to. This matches the spec's own
// allowance ("whether it can be mechanically enforced or is reminder-only") — accepting a
// suggestion records the DM's decision and is visible to the table; actually changing campaign
// configuration (when the rule IS one of CampaignPolicy's fields) stays a manual DM action in DM
// Preparation, same as every other campaign-config edit.

export type RuleSuggestionStatus = 'PENDING' | 'ACCEPTED' | 'MODIFIED' | 'REJECTED';

export type RuleSuggestion = {
  id:                 string;
  playerId:           ParticipantId;
  /** Short label for what's being proposed, e.g. "Flanking" or "Critical hit table". */
  rule:               string;
  /** What the player wants changed to, in their own words. */
  proposedValue:      string;
  /** The player's reasoning — optional context, not re-validated. */
  note:                string;
  status:              RuleSuggestionStatus;
  /** The DM's own wording when status === MODIFIED; null otherwise. */
  dmResponse:          string | null;
  createdAtRevision:   number;
  resolvedAtRevision:  number | null;
};

// ── Rewards (DM_SCREEN_SPEC.md item 13) ───────────────────────────────────────
// A structured grant/decision record, same shape of compromise as RuleSuggestion just above:
// "stored homebrew feature", "resource", "proficiency" and "campaign boon" have nowhere on the
// wire to mechanically attach themselves to (CharacterAdapter.applyChanges only understands
// numeric hp/maxHp/exhaustion/ability/temp_hp deltas — see CharacterChange). Granting a Reward
// therefore records WHAT the DM gave and WHETHER the player accepted it, visible to both sides;
// actually adding the granted feature/proficiency/boon to the character sheet happens on the
// player's own device the same way any homebrew content gets added today, outside this wire.
// "permanent_modifier" is the one kind a DM could alternatively express as an ordinary
// dm.request_change (an ability-score or max-HP delta) — Rewards exists for the other five kinds
// that request_change categorically cannot carry, and permanent_modifier is included here only so
// a single "Grant Reward" action can cover the whole DM_SCREEN_SPEC list without the DM needing to
// know which of two forms to reach for.
//
// Always routed through Player accept/modify/reject, never auto-applied: CAMPAIGN_DM_AUTHORITY_
// RULES.md's "Apply Automatically" policy option would need a live CampaignPolicy field this wire
// format doesn't carry (see RuleSuggestion's own doc comment for the identical gap) — disclosed,
// not silently assumed.

export type RewardKind = 'homebrew_feature' | 'resource' | 'proficiency' | 'reward_tier' | 'permanent_modifier' | 'campaign_boon';

export type RewardStatus = 'PENDING' | 'ACCEPTED' | 'MODIFIED' | 'REJECTED' | 'CANCELLED' | 'SUPERSEDED';

export type Reward = {
  id:           string;
  requesterId:  ParticipantId;      // the DM participant
  targetId:     ParticipantId;      // the player participant
  kind:         RewardKind;
  label:        string;
  description:  string | null;
  /** Only meaningful for kind === 'reward_tier' — an upgrade-track name (e.g. "Mark of the
   *  Forge"), so a later tier granted in the same track can supersede this one on acceptance. Two
   *  rewards share a track only when both are 'reward_tier' and this string matches exactly. */
  tierTrack:    string | null;
  status:       RewardStatus;
  /** The player's own wording when status === MODIFIED; null otherwise (RuleSuggestion's
   *  dmResponse, mirrored in the other direction — here the PLAYER is the one responding). */
  playerNote:   string | null;
  /** Set once a newer reward_tier grant in the same tierTrack is accepted — see host.ts's
   *  respond_reward. The superseded record is kept, never deleted, preserving upgrade history
   *  (CAMPAIGN_DM_AUTHORITY_RULES.md item 18); "preserve spent uses" from the spec is NOT
   *  mechanically tracked (no resource/uses-remaining model exists on this wire at all — see this
   *  type's own doc comment) and is left as a note in `description` for the DM to carry forward by
   *  hand when granting the next tier. */
  supersededBy: string | null;
  createdAtRevision:  number;
  resolvedAtRevision: number | null;
};

// ── Audit / timeline ─────────────────────────────────────────────────────────

export type AuditEntry = {
  revision: number;
  at:       number;
  actorId:  ParticipantId | null;
  kind:     string;
  text:     string;
  refId?:   string;
  /** Who may read this entry. 'dm' = DM-capable viewers only; 'participants' = DMs plus the listed ids. */
  scope:    'all' | 'dm' | 'participants';
  participantIds?: ParticipantId[];
};

// ── Session log (DM_SCREEN_SPEC.md item 14) ───────────────────────────────────
// CAMPAIGN_DM_AUTHORITY_RULES.md item 21 is explicit that this and AuditEntry above are NOT the
// same list: AuditEntry is automatic technical/accountability bookkeeping generated by every op
// this file's events already cover (a request resolved, an effect applied, a reward granted...);
// SessionLogEntry is 100% DM-curated narrative history — nothing ever creates one automatically,
// only the DM's own explicit "Add to Session Log" action (dm.add_session_log) does, matching the
// spec's "do not auto-log every roll or HP change." The `kind`s below are UI presets for that one
// manual action, not triggers — granting a Reward, say, never appends to this list by itself, the
// DM decides moment-to-moment whether a thing was "major" enough to narrate for the table.
// Table-wide narrative recap, not DM-only bookkeeping: visible to the DM and every Player (see
// state.ts's projectState), same as the game itself; never to a Host-only participant, matching
// AuditEntry's existing Host carve-out. A DM wanting a private note instead has item 15 (DM-only
// notes) for that — a separate feature, not this one.

export type SessionLogKind =
  | 'major_event' | 'encounter_outcome' | 'npc_death' | 'quest_outcome'
  | 'reward' | 'milestone' | 'rule_change' | 'custom_note';

export type SessionLogEntry = {
  id:                string;
  kind:              SessionLogKind;
  text:              string;
  actorId:           ParticipantId | null;   // the DM who added it
  at:                number;
  createdAtRevision: number;
};

// ── Live state (canonical on the Host, projected on replicas) ────────────────

/**
 * A player's own "Public Persona" (LAN_PLAYER_SCREEN_SPEC.md's "What others see") — what OTHER
 * PLAYERS see about this character instead of the real summary, when enabled. All four fields are
 * always required rather than per-field optional overrides: the player's own device pre-fills the
 * form from their real current values, so leaving a field unedited already means "show the truth
 * for this one" — no separate "fall back to real" flag needed. The DM always sees BOTH this and
 * the real summary (never redacted for the DM — see state.ts's projectState), so they can compare,
 * per DM_SCREEN_SPEC.md item 10. Scope note: there is no "omit this field entirely" option, only
 * "show this value instead" — CharacterSummary's hp/maxHp/ac are plain required numbers everywhere
 * else in this file, and inventing a parallel optional-field shape just for this one feature
 * wasn't worth the ripple; a player who wants a field hidden fakes a value for it instead.
 */
export type PublicPersona = {
  enabled: boolean;
  name:    string;
  hp:      number;
  maxHp:   number;
  ac:      number;
};

export type ReportedCharacter = {
  participantId: ParticipantId;
  characterId:   string;
  revision:      number;
  summary:       CharacterSummary;
  /** Set via player.set_persona. Never sent to a PEER player directly — peers only ever receive
   *  the already-computed public projection (state.ts's publicCharacterOf), never the raw config,
   *  so there's nothing for them to reverse-engineer the real values from. */
  persona?:      PublicPersona;
  /** See CharacterVitals's own doc comment — DM-dashboard-only, never sent to a peer player. */
  vitals?:       CharacterVitals;
};

// CampaignPolicy (what a linked campaign publishes to the room — see its own doc comment) lives
// in engine/campaignCompatibility.ts, alongside the checker that consumes it, and is re-exported
// here since it's also part of this layer's own wire shapes (LiveState.campaign, the
// dm.select_campaign op, the campaign_linked event, and the unauthenticated 'peek' reply).
export type { CampaignPolicy } from '../engine/campaignCompatibility';
import type { CampaignPolicy } from '../engine/campaignCompatibility';

export type LiveState = {
  sessionId:       string;
  /** Set once at hosting start (HostOptions.roomName), never changed after — a temporary room's
   *  own label, distinct from any attached campaign's name. Optional per HOST_SESSION_FLOW_SPEC.md. */
  roomName:        string | null;
  /** Set once at hosting start (HostOptions.maxParticipants) — null means uncapped. Enforced in
   *  host.ts's onHello for a brand-new participant only; a RECONNECTING known participant is
   *  never refused on this, since they already hold a seat. */
  maxParticipants: number | null;
  revision:        number;              // LiveSessionRevision
  ended:           boolean;
  participants:    Record<ParticipantId, PublicParticipant>;
  campaign:        CampaignPolicy | null;
  encounters:      Record<string, LiveEncounter>;
  effects:         Record<string, LiveEffect>;
  requests:        Record<string, ChangeRequest>;
  ruleSuggestions: Record<string, RuleSuggestion>;
  characters:      Record<ParticipantId, ReportedCharacter>;
  rewards:         Record<string, Reward>;
  sessionLog:      SessionLogEntry[];
  audit:           AuditEntry[];
};

export function emptyLiveState(sessionId: string, roomName: string | null = null, maxParticipants: number | null = null): LiveState {
  return {
    sessionId, roomName, maxParticipants, revision: 0, ended: false,
    participants: {}, campaign: null, encounters: {}, effects: {},
    requests: {}, ruleSuggestions: {}, characters: {}, rewards: {}, sessionLog: [], audit: [],
  };
}

// ── Canonical events (one per accepted op = one revision) ────────────────────

export type LiveEventBody =
  | { t: 'participant_upsert'; participant: PublicParticipant }
  | { t: 'campaign_linked';    policy: CampaignPolicy }
  | { t: 'encounter_activated'; encounter: LiveEncounter }
  | { t: 'encounter_ended';     encounterId: string }
  | { t: 'turn_order_set';         encounterId: string; order: string[] }
  | { t: 'turn_advanced';          encounterId: string; currentTurnIndex: number; round: number }
  | { t: 'combatant_added';        encounterId: string; combatant: LiveCombatant }
  | { t: 'combatant_removed';      encounterId: string; combatantId: string }
  | { t: 'combatant_hp_state_set'; encounterId: string; combatantId: string; hpState: 'healthy' | 'bloodied' | 'down' }
  | { t: 'combatant_exact_hp_set'; encounterId: string; combatantId: string; current: number; max: number }
  | { t: 'combatant_conditions_set'; encounterId: string; combatantId: string; conditions: string[] }
  | { t: 'combatant_resources_set'; encounterId: string; combatantId: string; resources: CombatantResource[] }
  | { t: 'combatant_visibility_set'; encounterId: string; combatantId: string; visibility: MonsterVisibility }
  | { t: 'effect_applied';      definition: EffectDefinition; applications: EffectApplication[] }
  | { t: 'applications_due';    applicationIds: string[]; ticked?: { applicationId: string; remaining: number }[] }
  | { t: 'applications_ended';  applicationIds: string[] }
  | { t: 'request_created';     request: ChangeRequest }
  | { t: 'request_resolved';    requestId: string; status: ChangeRequestStatus;
      finalApplied: CharacterChange[] | null; playerModified: CharacterChange[] | null;
      acknowledgedStale: boolean }
  | { t: 'request_stale_flag';  requestId: string; staleAgainst: number }
  | { t: 'rule_suggestion_created';  suggestion: RuleSuggestion }
  | { t: 'rule_suggestion_resolved'; suggestionId: string; status: RuleSuggestionStatus; dmResponse: string | null }
  | { t: 'character_reported';  character: ReportedCharacter }
  | { t: 'persona_set';         participantId: ParticipantId; persona: PublicPersona }
  | { t: 'reward_granted';      reward: Reward }
  | { t: 'reward_resolved';     rewardId: string; status: RewardStatus; playerNote: string | null }
  | { t: 'reward_superseded';   rewardId: string; supersededBy: string }
  | { t: 'session_log_added';   entry: SessionLogEntry }
  | { t: 'campaign_unlinked' }
  | { t: 'effect_target_added'; effectId: string; application: EffectApplication }
  | { t: 'session_ended' };

export type LiveEvent = {
  revision: number;
  at:       number;
  actorId:  ParticipantId | null;
  body:     LiveEventBody;
  audit:    AuditEntry | null;
};

// ── Ops (client -> host) ─────────────────────────────────────────────────────

export type EffectDefinitionInput = {
  id:         string;
  name:       string | null;         // must be null when visibility === 'secret'
  description: string | null;
  source:     string | null;
  visibility: EffectVisibility;
  components: EffectComponent[];
  duration:   EffectDuration;
};

export type LiveEncounterInput = {
  id:         string;
  name:       string;
  combatants: LiveCombatant[];
};

export type OpBody =
  | { kind: 'dm.select_campaign';    campaignRevision: number; policy: CampaignPolicy }
  | { kind: 'dm.activate_encounter'; encounter: LiveEncounterInput }
  | { kind: 'dm.end_encounter';      encounterId: string }
  | { kind: 'dm.set_turn_order';   encounterId: string; order: string[] }
  | { kind: 'dm.next_turn';        encounterId: string }
  | { kind: 'dm.previous_turn';    encounterId: string }
  | { kind: 'dm.add_combatant';    encounterId: string; combatant: { id: string; name: string; hpState: 'healthy' | 'bloodied' | 'down'; ac?: number } }
  | { kind: 'dm.remove_combatant'; encounterId: string; combatantId: string }
  | { kind: 'dm.set_combatant_hp'; encounterId: string; combatantId: string; hpState: 'healthy' | 'bloodied' | 'down' }
  | { kind: 'dm.set_combatant_exact_hp'; encounterId: string; combatantId: string; current: number; max: number }
  | { kind: 'dm.set_combatant_conditions'; encounterId: string; combatantId: string; conditions: string[] }
  | { kind: 'dm.set_combatant_resources'; encounterId: string; combatantId: string; resources: CombatantResource[] }
  | { kind: 'dm.set_combatant_visibility'; encounterId: string; combatantId: string; visibility: MonsterVisibility }
  | { kind: 'dm.apply_effect';       effect: EffectDefinitionInput; targets: ParticipantId[] }
  | { kind: 'dm.mark_due';           applicationId: string }
  | { kind: 'dm.tick_rounds';        rounds: number }
  | { kind: 'dm.end_effect';         effectId: string; applicationId?: string }
  | { kind: 'dm.request_change';     requestId: string; targetId: ParticipantId; baseRevision: number;
      label: string; changes: CharacterChange[] }
  | { kind: 'dm.cancel_request';     requestId: string }
  | { kind: 'player.respond';        requestId: string; decision: 'accept' | 'reject' | 'modify';
      modified?: CharacterChange[]; currentRevision: number; acknowledgeStale?: boolean }
  | { kind: 'player.report_character'; characterId: string; revision: number; summary: CharacterSummary; vitals?: CharacterVitals }
  | { kind: 'player.set_persona';    persona: PublicPersona }
  | { kind: 'player.suggest_rule';   suggestionId: string; rule: string; proposedValue: string; note: string }
  | { kind: 'dm.resolve_rule_suggestion'; suggestionId: string; decision: 'accept' | 'modify' | 'reject'; dmResponse?: string }
  | { kind: 'dm.grant_reward';      rewardId: string; targetId: ParticipantId; rewardKind: RewardKind;
      label: string; description?: string | null; tierTrack?: string | null }
  | { kind: 'dm.cancel_reward';     rewardId: string }
  | { kind: 'player.respond_reward'; rewardId: string; decision: 'accept' | 'reject' | 'modify'; note?: string }
  | { kind: 'dm.add_session_log';   entryId: string; logKind: SessionLogKind; text: string }
  | { kind: 'dm.unlink_campaign' }
  | { kind: 'dm.add_effect_target'; effectId: string; targetId: ParticipantId }
  | { kind: 'host.assign_capabilities'; participantId: ParticipantId; capabilities: Capability[] }
  | { kind: 'host.end_session' };

export type Op = {
  opId:          string;
  seq:           number;             // per-participant, starts at 1, gapless
  body:          OpBody;
};

export type OpStatus = 'applied' | 'rejected' | 'stale' | 'forbidden';

export type OpResult = {
  opId:     string;
  status:   OpStatus;
  reason?:  string;
  revision: number;
  /** true when this is a replay answered from the idempotency ledger */
  duplicate?: boolean;
};

// ── Wire messages ────────────────────────────────────────────────────────────

export type ClientMessage =
  | { type: 'hello'; participantId: ParticipantId; token: string | null; nickname: string;
      requestedCapabilities: Capability[]; characterId: string | null; lastRevision: number }
  | { type: 'op'; op: Op }
  | { type: 'resync' }
  /** Room-info query that does NOT join — no participantId/hello, no registry entry, no
   *  authority granted. Lets the Join flow show a confirmation screen (Host identity, attached
   *  campaign, participant count, whether DM approval is required) before the user commits to a
   *  role. See host.ts's onPeek and session/roomPeek.ts for the one-shot client helper. */
  | { type: 'peek' };

/** A viewer-specific projection of the live state. */
export type ViewState = LiveState;

/** Everything a 'peek' may answer with, per CAMPAIGN_DM_AUTHORITY_RULES.md's room-code-is-not-
 *  identity rule — deliberately nothing privileged: a Player scanning a QR still learns nothing
 *  more than an unprivileged participant eventually would. */
export type PeekResult = {
  sessionId:          string;
  hostNickname:       string | null;
  roomName:           string | null;
  /** Full policy (not just the name) so a Player can check character compatibility before
   *  committing to anything — see CampaignPolicy's own doc comment. */
  campaign:           CampaignPolicy | null;
  participantCount:   number;
  /** null = uncapped. A peeker can see the room is already full before even trying to join. */
  maxParticipants:    number | null;
  dmApprovalRequired: boolean;
  ended:              boolean;
};

export type ServerMessage =
  | { type: 'welcome'; participantId: ParticipantId; token: string; capabilities: Capability[];
      sessionId: string; revision: number; view: ViewState }
  | { type: 'snapshot'; revision: number; view: ViewState }
  | { type: 'event'; revision: number; event: LiveEvent | null }   // null = tick (not visible to you)
  | { type: 'result'; result: OpResult }
  | { type: 'error'; message: string }
  | ({ type: 'peek_result' } & PeekResult);
