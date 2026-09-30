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
  | { kind: 'ability';    ability: 'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha'; delta: number };

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

export type LiveCombatant = {
  id:      string;
  name:    string;
  /** Deliberately coarse: exact HP stays DM-side unless the DM chooses to send it. */
  hpState: 'healthy' | 'bloodied' | 'down';
  ac?:     number;
};

export type LiveEncounter = {
  id:         string;
  name:       string;
  combatants: LiveCombatant[];
  active:     boolean;
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

export type LiveState = {
  sessionId:    string;
  revision:     number;              // LiveSessionRevision
  ended:        boolean;
  participants: Record<ParticipantId, PublicParticipant>;
  campaign:     { campaignId: string; name: string } | null;
  encounters:   Record<string, LiveEncounter>;
  effects:      Record<string, LiveEffect>;
  requests:     Record<string, ChangeRequest>;
  characters:   Record<ParticipantId, ReportedCharacter>;
  audit:        AuditEntry[];
};

export function emptyLiveState(sessionId: string): LiveState {
  return {
    sessionId, revision: 0, ended: false,
    participants: {}, campaign: null, encounters: {}, effects: {},
    requests: {}, characters: {}, audit: [],
  };
}

// ── Canonical events (one per accepted op = one revision) ────────────────────

export type LiveEventBody =
  | { t: 'participant_upsert'; participant: PublicParticipant }
  | { t: 'campaign_linked';    campaignId: string; name: string }
  | { t: 'encounter_activated'; encounter: LiveEncounter }
  | { t: 'encounter_ended';     encounterId: string }
  | { t: 'effect_applied';      definition: EffectDefinition; applications: EffectApplication[] }
  | { t: 'applications_due';    applicationIds: string[]; ticked?: { applicationId: string; remaining: number }[] }
  | { t: 'applications_ended';  applicationIds: string[] }
  | { t: 'request_created';     request: ChangeRequest }
  | { t: 'request_resolved';    requestId: string; status: ChangeRequestStatus;
      finalApplied: CharacterChange[] | null; playerModified: CharacterChange[] | null;
      acknowledgedStale: boolean }
  | { t: 'request_stale_flag';  requestId: string; staleAgainst: number }
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
  | { kind: 'dm.select_campaign';    campaignId: string; name: string; campaignRevision: number }
  | { kind: 'dm.activate_encounter'; encounter: LiveEncounterInput }
  | { kind: 'dm.end_encounter';      encounterId: string }
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
  | { type: 'resync' };

/** A viewer-specific projection of the live state. */
export type ViewState = LiveState;

export type ServerMessage =
  | { type: 'welcome'; participantId: ParticipantId; token: string; capabilities: Capability[];
      sessionId: string; revision: number; view: ViewState }
  | { type: 'snapshot'; revision: number; view: ViewState }
  | { type: 'event'; revision: number; event: LiveEvent | null }   // null = tick (not visible to you)
  | { type: 'result'; result: OpResult }
  | { type: 'error'; message: string };
