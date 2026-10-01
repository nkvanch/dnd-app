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
  | { kind: 'temp_hp';    amount: number };

export type CharacterSummary = {
  name:  string;
  hp:    number;
  maxHp: number;
  ac:    number;
};

/** What the player's device exposes so the session layer can apply accepted
 *  changes to the real character. */
export interface CharacterAdapter {
  characterId: string;
  /** Monotonic revision of the persistent character. Bumped by ANY local change. */
  getRevision(): number;
  summary(): CharacterSummary;
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
  name:    boolean;
  hpState: boolean;
  exactHp: boolean;
  ac:      boolean;
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
  /** Defaults to {name:true, hpState:true, exactHp:false, ac:true} on creation — matches what a
   *  combatant already showed before this field existed, so nothing already in play silently
   *  loses information the instant this ships. */
  visibility: MonsterVisibility;
};

export const STANDARD_MONSTER_VISIBILITY: MonsterVisibility = { name: true, hpState: true, exactHp: false, ac: true };

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

// ── Live state (canonical on the Host, projected on replicas) ────────────────

export type ReportedCharacter = {
  participantId: ParticipantId;
  characterId:   string;
  revision:      number;
  summary:       CharacterSummary;
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
  audit:           AuditEntry[];
};

export function emptyLiveState(sessionId: string, roomName: string | null = null, maxParticipants: number | null = null): LiveState {
  return {
    sessionId, roomName, maxParticipants, revision: 0, ended: false,
    participants: {}, campaign: null, encounters: {}, effects: {},
    requests: {}, ruleSuggestions: {}, characters: {}, audit: [],
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
  | { kind: 'player.report_character'; characterId: string; revision: number; summary: CharacterSummary }
  | { kind: 'player.suggest_rule';   suggestionId: string; rule: string; proposedValue: string; note: string }
  | { kind: 'dm.resolve_rule_suggestion'; suggestionId: string; decision: 'accept' | 'modify' | 'reject'; dmResponse?: string }
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
