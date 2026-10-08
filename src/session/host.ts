// ============================================================================
// FILE: src/session/host.ts
// SessionHost: the authoritative live-session state machine.
//
// The Host owns: the transport, the participant registry (capabilities + tokens),
// the LiveSessionRevision stream, idempotency, and the canonical LiveState.
// It does NOT own and never receives: campaign preparation, DM notes,
// unrevealed encounters, secret-effect identity, prepared templates.
//
// Authorization is enforced here for every op. Nothing in a message can claim
// a capability; capabilities live only in this registry, keyed by participant
// id and authenticated by a per-participant token.
// ============================================================================
import {
  Capability, ClientMessage, ServerMessage, Op, OpBody, OpResult, LiveState, LiveEvent, LiveEventBody,
  emptyLiveState, PublicParticipant, ParticipantId, EffectApplication, EffectDefinition, AuditEntry,
  ChangeRequest, LiveEncounter, ReportedCharacter, CharacterChange, RuleSuggestion, RuleSuggestionStatus,
  STANDARD_MONSTER_VISIBILITY, MONSTER_VISIBILITY_PRESETS, MonsterVisibility, PublicPersona, Reward, RewardKind, RewardStatus,
  SessionLogEntry, SessionLogKind, CharacterVitals,
} from './types';
import { applyEvent, projectEvent, projectState, Viewer } from './state';
import { Connection, ServerTransport, decodeFrame, encodeFrame } from './transport';
import { isAuthorized, sanitizeRequested, validChanges, describeChanges, GRANTABLE } from './roles';

export type DmPolicy = 'manual' | 'auto-first' | 'never';

export type HostPersisted = {
  state:     LiveState;
  tokens:    Record<ParticipantId, string>;
  ledger:    Record<ParticipantId, OpResult[]>;
  nextSeq:   Record<ParticipantId, number>;
};

export type HostOptions = {
  sessionId:    string;
  /** HOST_SESSION_FLOW_SPEC.md's "room name, optional" — set once at hosting start, immutable
   *  for the room's lifetime. Distinct from any campaign attached later. */
  roomName?:    string | null;
  /** HOST_SESSION_FLOW_SPEC.md's "maximum participants, optional" — null/omitted = uncapped.
   *  Enforced only against a brand-new participant (see onHello) — never against a reconnect,
   *  and never against the Host's own local registerLocalHost. */
  maxParticipants?: number | null;
  now?:         () => number;
  dmPolicy?:    DmPolicy;
  newToken?:    () => string;
  ledgerLimit?: number;
  /** Called after every state change; used for Host-restart persistence. */
  persist?:     (p: HostPersisted) => void;
  restoreFrom?: HostPersisted;
};

type Entry = { conn: Connection | null };

const STATS = ['ac', 'speed', 'initiative', 'save', 'spell_attack', 'spell_dc'];

function isObj(x: unknown): x is Record<string, unknown> {
  return !!x && typeof x === 'object' && !Array.isArray(x);
}
function str(x: unknown): x is string {
  return typeof x === 'string' && x.length > 0 && x.length <= 200;
}
function optStr(x: unknown): x is string | null {
  return x === null || (typeof x === 'string' && x.length <= 2000);
}
function int(x: unknown): x is number {
  return typeof x === 'number' && Number.isInteger(x);
}
function validMonsterVisibility(x: unknown): x is MonsterVisibility {
  return isObj(x) && typeof x.name === 'boolean' && typeof x.hpState === 'boolean'
    && typeof x.exactHp === 'boolean' && typeof x.ac === 'boolean' && typeof x.conditions === 'boolean';
}
const REWARD_KINDS = new Set<RewardKind>(['homebrew_feature', 'resource', 'proficiency', 'reward_tier', 'permanent_modifier', 'campaign_boon']);
function rewardKind(x: unknown): x is RewardKind {
  return typeof x === 'string' && REWARD_KINDS.has(x as RewardKind);
}
const SESSION_LOG_KINDS = new Set<SessionLogKind>(['major_event', 'encounter_outcome', 'npc_death', 'quest_outcome', 'reward', 'milestone', 'rule_change', 'custom_note']);
function sessionLogKind(x: unknown): x is SessionLogKind {
  return typeof x === 'string' && SESSION_LOG_KINDS.has(x as SessionLogKind);
}
/** Session log text is narrative prose, not a short label — same ceiling as a RuleSuggestion note. */
function logText(x: unknown): x is string {
  return typeof x === 'string' && x.length > 0 && x.length <= 2000;
}

/** Lightweight structural validation — this is read-only DM-dashboard display data (see
 *  CharacterVitals's own doc comment), not something any op applies consequences from, so this
 *  checks shape/types rather than game-rule bounds (e.g. a homebrew resource's maximum isn't
 *  capped here). */
function validVitals(x: unknown): x is CharacterVitals {
  if (!isObj(x)) return false;
  if (typeof x.tempHp !== 'number' || typeof x.speed !== 'number') return false;
  if (!int(x.exhaustion) || x.exhaustion < 0 || x.exhaustion > 6) return false;
  if (!Array.isArray(x.conditions) || !x.conditions.every(c => typeof c === 'string')) return false;
  if (x.concentration !== null && typeof x.concentration !== 'string') return false;
  const ds = x.deathSaves;
  if (!isObj(ds) || !int(ds.successes) || !int(ds.failures) || typeof ds.stable !== 'boolean') return false;
  if (!Array.isArray(x.resources) || !x.resources.every(r =>
    isObj(r) && str(r.id) && str(r.name) && typeof r.current === 'number' && typeof r.maximum === 'number')) return false;
  if (x.spellSlots !== null) {
    if (!isObj(x.spellSlots)) return false;
    if (!Object.values(x.spellSlots).every(s => isObj(s) && typeof s.total === 'number' && typeof s.used === 'number')) return false;
  }
  return true;
}

export class SessionHost {
  private state: LiveState;
  private readonly now: () => number;
  private readonly dmPolicy: DmPolicy;
  private readonly newToken: () => string;
  private readonly ledgerLimit: number;
  private readonly persist?: (p: HostPersisted) => void;

  private tokens: Record<ParticipantId, string> = {};
  private ledger: Record<ParticipantId, OpResult[]> = {};
  private nextSeq: Record<ParticipantId, number> = {};
  private held: Record<ParticipantId, Map<number, Op>> = {};
  private entries = new Map<ParticipantId, Entry>();
  private bound = new Map<Connection, ParticipantId>();
  private server: ServerTransport | null = null;
  private tokenCounter = 0;

  constructor(opts: HostOptions) {
    this.now = opts.now ?? (() => Date.now());
    this.dmPolicy = opts.dmPolicy ?? 'manual';
    this.newToken = opts.newToken ?? (() => `t${++this.tokenCounter}_${Math.random().toString(36).slice(2, 12)}`);
    this.ledgerLimit = opts.ledgerLimit ?? 500;
    this.persist = opts.persist;
    if (opts.restoreFrom) {
      const r = JSON.parse(JSON.stringify(opts.restoreFrom)) as HostPersisted;
      this.state = r.state;
      this.tokens = r.tokens;
      this.ledger = r.ledger;
      this.nextSeq = r.nextSeq;
      // No connections survive a process restart.
      for (const p of Object.values(this.state.participants)) {
        p.connected = false;
        this.entries.set(p.id, { conn: null });
      }
    } else {
      this.state = emptyLiveState(opts.sessionId, opts.roomName ?? null, opts.maxParticipants ?? null);
    }
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  async start(server: ServerTransport): Promise<void> {
    this.server = server;
    await server.listen(conn => this.accept(conn));
  }

  stop(): void {
    this.server?.close();
    this.server = null;
  }

  /** Registers the Host device's own participant. `host` is only ever granted here. */
  registerLocalHost(id: ParticipantId, nickname: string, extra: Capability[] = []): string {
    const caps: Capability[] = ['host', ...extra.filter(c => GRANTABLE.includes(c))];
    const token = this.tokens[id] ?? this.newToken();
    this.tokens[id] = token;
    this.entries.set(id, this.entries.get(id) ?? { conn: null });
    const existing = this.state.participants[id];
    const participant: PublicParticipant = {
      id, nickname, capabilities: caps, connected: existing?.connected ?? false,
      characterId: existing?.characterId ?? null,
    };
    this.commit({ t: 'participant_upsert', participant }, id,
      { kind: 'participant', text: `${nickname} is hosting`, scope: 'all' });
    return token;
  }

  /** Test/diagnostic access to canonical state. Never handed to a UI for a Host-only device. */
  debugState(): LiveState {
    return JSON.parse(JSON.stringify(this.state)) as LiveState;
  }

  toPersisted(): HostPersisted {
    return JSON.parse(JSON.stringify({
      state: this.state, tokens: this.tokens, ledger: this.ledger, nextSeq: this.nextSeq,
    })) as HostPersisted;
  }

  // ── Connections ────────────────────────────────────────────────────────────

  private accept(conn: Connection): void {
    conn.onFrame(frame => this.onFrame(conn, frame));
    conn.onClose(() => this.onClose(conn));
  }

  private send(conn: Connection, msg: ServerMessage): void {
    conn.send(encodeFrame(msg));
  }

  private onClose(conn: Connection): void {
    const pid = this.bound.get(conn);
    this.bound.delete(conn);
    if (!pid) return;
    const entry = this.entries.get(pid);
    if (!entry || entry.conn !== conn) return;      // replaced by a newer connection
    entry.conn = null;
    const p = this.state.participants[pid];
    if (p?.connected) {
      this.commit({ t: 'participant_upsert', participant: { ...p, connected: false } }, pid,
        { kind: 'participant', text: `${p.nickname} disconnected`, scope: 'all' });
    }
  }

  private onFrame(conn: Connection, frame: string): void {
    const msg = decodeFrame<ClientMessage>(frame);
    if (!isObj(msg) || typeof msg.type !== 'string') {
      this.send(conn, { type: 'error', message: 'malformed message' });
      return;
    }
    // Unauthenticated, pre-hello — never registers a participant or grants anything.
    if (msg.type === 'peek') { this.onPeek(conn); return; }
    if (msg.type === 'hello') { this.onHello(conn, msg); return; }
    const pid = this.bound.get(conn);
    if (!pid || this.entries.get(pid)?.conn !== conn) {
      this.send(conn, { type: 'error', message: 'hello required' });
      return;
    }
    if (msg.type === 'resync') {
      this.sendSnapshot(pid);
      return;
    }
    if (msg.type === 'op') {
      this.onOp(pid, conn, msg.op);
      return;
    }
    this.send(conn, { type: 'error', message: 'unknown message type' });
  }

  private onHello(conn: Connection, msg: Extract<ClientMessage, { type: 'hello' }>): void {
    if (!str(msg.participantId) || !str(msg.nickname)) {
      this.send(conn, { type: 'error', message: 'malformed hello' });
      return;
    }
    const pid = msg.participantId;
    const known = this.state.participants[pid];
    let token: string;

    if (known) {
      if (!msg.token || msg.token !== this.tokens[pid]) {
        this.send(conn, { type: 'error', message: 'authentication failed' });
        conn.close();
        return;
      }
      token = this.tokens[pid];
      const old = this.entries.get(pid)?.conn;
      if (old && old !== conn) { this.bound.delete(old); old.close(); }
      this.entries.set(pid, { conn });
      this.bound.set(conn, pid);
      // A returning participant may change what it asks for. Player is freely grantable; DM follows the
      // policy (never auto-granted over an existing DM); nothing is ever REMOVED by a hello.
      const requested = sanitizeRequested(msg.requestedCapabilities);
      const caps: Capability[] = [...known.capabilities];
      if (requested.includes('player') && !caps.includes('player')) caps.push('player');
      let requestedDm = false;
      if (requested.includes('dm') && !caps.includes('dm')) {
        const dmHeld = Object.values(this.state.participants).some(p => p.capabilities.includes('dm'));
        if (this.dmPolicy === 'auto-first' && !dmHeld) caps.push('dm');
        else if (this.dmPolicy !== 'never') requestedDm = true;
      }
      const upserted: PublicParticipant = {
        ...known, nickname: msg.nickname, connected: true, capabilities: caps,
        characterId: typeof msg.characterId === 'string' ? msg.characterId : known.characterId,
      };
      delete upserted.requestedDm;
      if (requestedDm) upserted.requestedDm = true;
      // Announce reconnect to everyone else first; the joiner gets the fresh view in welcome.
      this.commit({ t: 'participant_upsert', participant: upserted }, pid,
        { kind: 'participant', text: `${msg.nickname} reconnected`, scope: 'all' }, conn);
    } else {
      if (this.state.maxParticipants !== null && this.connectedCount() >= this.state.maxParticipants) {
        this.send(conn, { type: 'error', message: 'This room is full.' });
        conn.close();
        return;
      }
      token = this.newToken();
      this.tokens[pid] = token;
      const requested = sanitizeRequested(msg.requestedCapabilities);
      const caps: Capability[] = [];
      let requestedDm = false;
      if (requested.includes('player')) caps.push('player');
      if (requested.includes('dm')) {
        const dmHeld = Object.values(this.state.participants).some(p => p.capabilities.includes('dm'));
        if (this.dmPolicy === 'auto-first' && !dmHeld) caps.push('dm');
        else if (this.dmPolicy !== 'never') requestedDm = true;
      }
      const participant: PublicParticipant = {
        id: pid, nickname: msg.nickname, capabilities: caps, connected: true,
        characterId: typeof msg.characterId === 'string' ? msg.characterId : null,
        ...(requestedDm ? { requestedDm: true } : {}),
      };
      this.entries.set(pid, { conn });
      this.bound.set(conn, pid);
      this.commit({ t: 'participant_upsert', participant }, pid,
        { kind: 'participant', text: `${msg.nickname} joined`, scope: 'all' }, conn);
    }

    const me = this.state.participants[pid];
    this.send(conn, {
      type: 'welcome', participantId: pid, token, capabilities: me.capabilities,
      sessionId: this.state.sessionId, revision: this.state.revision,
      view: projectState(this.state, this.viewerOf(pid)),
    });
    this.persistNow();
  }

  /** Answers a room-info query without registering a participant — see ClientMessage's 'peek'. */
  private connectedCount(): number {
    return Object.values(this.state.participants).filter(p => p.connected).length;
  }

  private onPeek(conn: Connection): void {
    const host = Object.values(this.state.participants).find(p => p.capabilities.includes('host'));
    this.send(conn, {
      type: 'peek_result',
      sessionId: this.state.sessionId,
      hostNickname: host?.nickname ?? null,
      roomName: this.state.roomName,
      campaign: this.state.campaign,
      participantCount: this.connectedCount(),
      maxParticipants: this.state.maxParticipants,
      // 'auto-first' is the only policy where a DM can join without the Host acting — every
      // other policy ('manual', 'never') means SOME participant request needs Host attention,
      // which is what "approval required" means to a prospective joiner.
      dmApprovalRequired: this.dmPolicy !== 'auto-first',
      ended: this.state.ended,
    });
  }

  private viewerOf(pid: ParticipantId): Viewer {
    return { id: pid, capabilities: this.state.participants[pid]?.capabilities ?? [] };
  }

  private sendSnapshot(pid: ParticipantId): void {
    const conn = this.entries.get(pid)?.conn;
    if (!conn) return;
    this.send(conn, {
      type: 'snapshot', revision: this.state.revision,
      view: projectState(this.state, this.viewerOf(pid)),
    });
  }

  // ── Event commit + broadcast ───────────────────────────────────────────────

  private commit(
    body: LiveEventBody, actorId: ParticipantId | null,
    audit: { kind: string; text: string; scope: AuditEntry['scope']; participantIds?: ParticipantId[]; refId?: string } | null,
    exceptConn?: Connection,
  ): LiveEvent {
    const revision = this.state.revision + 1;
    const at = this.now();
    const auditEntry: AuditEntry | null = audit
      ? { revision, at, actorId, kind: audit.kind, text: audit.text, scope: audit.scope,
          ...(audit.participantIds ? { participantIds: audit.participantIds } : {}),
          ...(audit.refId ? { refId: audit.refId } : {}) }
      : null;
    const ev: LiveEvent = { revision, at, actorId, body, audit: auditEntry };
    this.state = applyEvent(this.state, ev);
    for (const [pid, entry] of this.entries) {
      if (!entry.conn || entry.conn === exceptConn) continue;
      const projected = projectEvent(this.state, ev, this.viewerOf(pid));
      this.send(entry.conn, { type: 'event', revision, event: projected });
    }
    this.persistNow();
    return ev;
  }

  private persistNow(): void {
    this.persist?.(this.toPersisted());
  }

  // ── Ops ────────────────────────────────────────────────────────────────────

  private onOp(pid: ParticipantId, conn: Connection, op: Op): void {
    if (!isObj(op) || !str(op.opId) || !int(op.seq) || op.seq < 1 || !isObj(op.body) || typeof op.body.kind !== 'string') {
      this.send(conn, { type: 'result', result: { opId: String((op as Op | undefined)?.opId ?? ''), status: 'rejected', reason: 'malformed-op', revision: this.state.revision } });
      return;
    }
    const ledger = (this.ledger[pid] ??= []);
    const dup = ledger.find(r => r.opId === op.opId);
    if (dup) {
      this.send(conn, { type: 'result', result: { ...dup, duplicate: true } });
      return;
    }
    const expected = this.nextSeq[pid] ?? 1;
    if (op.seq < expected) {
      // A different opId reusing a consumed sequence number, or a ledger eviction.
      this.send(conn, { type: 'result', result: { opId: op.opId, status: 'rejected', reason: 'sequence-consumed', revision: this.state.revision } });
      return;
    }
    if (op.seq > expected) {
      (this.held[pid] ??= new Map()).set(op.seq, op);      // wait for the gap to fill
      return;
    }
    this.processInOrder(pid, conn, op);
    // Drain anything that was waiting for this sequence number.
    const heldOps = this.held[pid];
    while (heldOps && heldOps.has(this.nextSeq[pid] ?? 1)) {
      const next = heldOps.get(this.nextSeq[pid] ?? 1)!;
      heldOps.delete(next.seq);
      this.processInOrder(pid, conn, next);
    }
  }

  private processInOrder(pid: ParticipantId, conn: Connection, op: Op): void {
    this.nextSeq[pid] = op.seq + 1;
    let result: OpResult;
    try {
      result = this.execute(pid, op);
    } catch (e) {
      result = { opId: op.opId, status: 'rejected', reason: `internal: ${(e as Error).message}`, revision: this.state.revision };
    }
    const ledger = (this.ledger[pid] ??= []);
    ledger.push(result);
    if (ledger.length > this.ledgerLimit) ledger.shift();
    this.persistNow();
    const live = this.entries.get(pid)?.conn;
    this.send(live ?? conn, { type: 'result', result });
  }

  private execute(pid: ParticipantId, op: Op): OpResult {
    const actor = this.state.participants[pid];
    const body = op.body;
    const done = (status: OpResult['status'], reason?: string): OpResult =>
      ({ opId: op.opId, status, ...(reason ? { reason } : {}), revision: this.state.revision });

    if (!actor) return done('forbidden', 'unknown-participant');
    if (!isAuthorized(actor.capabilities, body.kind)) return done('forbidden', `requires-capability:${body.kind.split('.')[0]}`);
    if (this.state.ended) return done('rejected', 'session-ended');

    switch (body.kind) {
      case 'dm.select_campaign': {
        const p = body.policy;
        if (!isObj(p) || !str(p.campaignId) || !str(p.name) || !Array.isArray(p.bannedPackIds)
          || !Array.isArray(p.bannedSubclassIds) || !Array.isArray(p.requiredPacks)) return done('rejected', 'malformed');
        this.commit({ t: 'campaign_linked', policy: p }, pid,
          { kind: 'campaign', text: `Campaign "${p.name}" linked`, scope: 'all' });
        return done('applied');
      }

      case 'dm.activate_encounter': {
        const e = body.encounter;
        if (!isObj(e) || !str(e.id) || !str(e.name) || !Array.isArray(e.combatants)) return done('rejected', 'malformed');
        if (this.state.encounters[e.id]) return done('rejected', 'encounter-exists');
        const enc: LiveEncounter = {
          id: e.id, name: e.name, active: true,
          // Respects the per-combatant visibility the input actually carries (CampaignPrep's
          // configurable "default for new monsters" — DM_SCREEN_SPEC.md item 11 — resolved on the
          // DM's device by prep.ts's toLiveEncounterInput) rather than silently forcing Standard
          // regardless of what was requested; a malformed visibility object still falls back
          // safely instead of rejecting the whole encounter over one bad field.
          combatants: e.combatants.map(c => ({
            id: String(c.id), name: String(c.name),
            hpState: c.hpState === 'down' || c.hpState === 'bloodied' ? c.hpState : 'healthy',
            visibility: validMonsterVisibility(c.visibility) ? c.visibility : { ...STANDARD_MONSTER_VISIBILITY },
            ...(typeof c.ac === 'number' ? { ac: c.ac } : {}),
          })),
          turnOrder: [], currentTurnIndex: null, round: 1,
        };
        this.commit({ t: 'encounter_activated', encounter: enc }, pid,
          { kind: 'encounter', text: `Encounter "${enc.name}" started`, scope: 'all', refId: enc.id });
        return done('applied');
      }

      case 'dm.end_encounter': {
        const enc = this.state.encounters[body.encounterId];
        if (!enc || !enc.active) return done('rejected', 'no-active-encounter');
        this.commit({ t: 'encounter_ended', encounterId: enc.id }, pid,
          { kind: 'encounter', text: `Encounter "${enc.name}" ended`, scope: 'all', refId: enc.id });
        return done('applied');
      }

      case 'dm.set_turn_order': {
        const enc = this.state.encounters[body.encounterId];
        if (!enc || !enc.active) return done('rejected', 'no-active-encounter');
        const order = body.order;
        if (!Array.isArray(order) || order.length === 0 || !order.every((id: unknown) => typeof id === 'string')) {
          return done('rejected', 'malformed');
        }
        if (new Set(order).size !== order.length) return done('rejected', 'duplicate-entry');
        const combatantIds = new Set(enc.combatants.map(c => c.id));
        if (!order.every(id => combatantIds.has(id) || !!this.state.participants[id])) return done('rejected', 'unknown-entry');
        this.commit({ t: 'turn_order_set', encounterId: enc.id, order }, pid,
          { kind: 'encounter', text: `Turn order set for "${enc.name}"`, scope: 'all', refId: enc.id });
        return done('applied');
      }

      case 'dm.next_turn':
      case 'dm.previous_turn': {
        const enc = this.state.encounters[body.encounterId];
        if (!enc || !enc.active) return done('rejected', 'no-active-encounter');
        if (enc.turnOrder.length === 0) return done('rejected', 'no-turn-order');
        const forward = body.kind === 'dm.next_turn';
        let idx = enc.currentTurnIndex;
        let round = enc.round;
        if (idx === null) {
          idx = forward ? 0 : enc.turnOrder.length - 1;
        } else if (forward) {
          idx += 1;
          if (idx >= enc.turnOrder.length) { idx = 0; round += 1; }
        } else {
          idx -= 1;
          if (idx < 0) { idx = enc.turnOrder.length - 1; round = Math.max(1, round - 1); }
        }
        this.commit({ t: 'turn_advanced', encounterId: enc.id, currentTurnIndex: idx, round }, pid,
          { kind: 'encounter', text: `Round ${round}, turn ${idx + 1}/${enc.turnOrder.length} in "${enc.name}"`, scope: 'all', refId: enc.id });
        return done('applied');
      }

      case 'dm.add_combatant': {
        const enc = this.state.encounters[body.encounterId];
        if (!enc || !enc.active) return done('rejected', 'no-active-encounter');
        const c = body.combatant;
        if (!isObj(c) || !str(c.id) || !str(c.name)) return done('rejected', 'malformed');
        if (enc.combatants.some(x => x.id === c.id)) return done('rejected', 'combatant-exists');
        // A monster added mid-encounter gets the campaign's configured default too (DM_SCREEN_
        // SPEC.md item 11), same as one present when the encounter activated.
        const defaultPreset = this.state.campaign?.monsterHpVisibilityDefault ?? 'standard';
        const combatant = {
          id: c.id, name: c.name,
          hpState: c.hpState === 'down' || c.hpState === 'bloodied' ? c.hpState : 'healthy' as const,
          visibility: { ...MONSTER_VISIBILITY_PRESETS[defaultPreset] },
          ...(typeof c.ac === 'number' ? { ac: c.ac } : {}),
        };
        this.commit({ t: 'combatant_added', encounterId: enc.id, combatant }, pid,
          { kind: 'encounter', text: `${combatant.name} joined "${enc.name}"`, scope: 'all', refId: enc.id });
        return done('applied');
      }

      case 'dm.remove_combatant': {
        const enc = this.state.encounters[body.encounterId];
        if (!enc || !enc.active) return done('rejected', 'no-active-encounter');
        const target = enc.combatants.find(c => c.id === body.combatantId);
        if (!target) return done('rejected', 'unknown-combatant');
        this.commit({ t: 'combatant_removed', encounterId: enc.id, combatantId: target.id }, pid,
          { kind: 'encounter', text: `${target.name} left "${enc.name}"`, scope: 'all', refId: enc.id });
        return done('applied');
      }

      case 'dm.set_combatant_hp': {
        const enc = this.state.encounters[body.encounterId];
        if (!enc || !enc.active) return done('rejected', 'no-active-encounter');
        const target = enc.combatants.find(c => c.id === body.combatantId);
        if (!target) return done('rejected', 'unknown-combatant');
        if (body.hpState !== 'healthy' && body.hpState !== 'bloodied' && body.hpState !== 'down') return done('rejected', 'malformed');
        this.commit({ t: 'combatant_hp_state_set', encounterId: enc.id, combatantId: target.id, hpState: body.hpState }, pid,
          { kind: 'encounter', text: `${target.name} is now ${body.hpState}`, scope: 'all', refId: enc.id });
        return done('applied');
      }

      case 'dm.set_combatant_exact_hp': {
        const enc = this.state.encounters[body.encounterId];
        if (!enc || !enc.active) return done('rejected', 'no-active-encounter');
        const target = enc.combatants.find(c => c.id === body.combatantId);
        if (!target) return done('rejected', 'unknown-combatant');
        if (!int(body.current) || !int(body.max) || body.current < 0 || body.max < 1 || body.current > body.max) return done('rejected', 'malformed');
        this.commit({ t: 'combatant_exact_hp_set', encounterId: enc.id, combatantId: target.id, current: body.current, max: body.max }, pid,
          { kind: 'encounter', text: `${target.name}'s exact HP set to ${body.current}/${body.max}`, scope: 'dm', refId: enc.id });
        return done('applied');
      }

      case 'dm.set_combatant_conditions': {
        const enc = this.state.encounters[body.encounterId];
        if (!enc || !enc.active) return done('rejected', 'no-active-encounter');
        const target = enc.combatants.find(c => c.id === body.combatantId);
        if (!target) return done('rejected', 'unknown-combatant');
        if (!Array.isArray(body.conditions) || body.conditions.length > 20 || !body.conditions.every(c => str(c))) return done('rejected', 'malformed');
        this.commit({ t: 'combatant_conditions_set', encounterId: enc.id, combatantId: target.id, conditions: body.conditions }, pid,
          { kind: 'encounter', text: `${target.name}'s conditions updated`, scope: 'dm', refId: enc.id });
        return done('applied');
      }

      case 'dm.set_combatant_resources': {
        const enc = this.state.encounters[body.encounterId];
        if (!enc || !enc.active) return done('rejected', 'no-active-encounter');
        const target = enc.combatants.find(c => c.id === body.combatantId);
        if (!target) return done('rejected', 'unknown-combatant');
        if (!Array.isArray(body.resources) || body.resources.length > 20 || !body.resources.every(r =>
          isObj(r) && str(r.id) && str(r.name) && int(r.current) && int(r.maximum)
          && r.current >= 0 && r.maximum >= 1 && r.current <= r.maximum)) {
          return done('rejected', 'malformed');
        }
        this.commit({ t: 'combatant_resources_set', encounterId: enc.id, combatantId: target.id, resources: body.resources }, pid,
          { kind: 'encounter', text: `${target.name}'s resources updated`, scope: 'dm', refId: enc.id });
        return done('applied');
      }

      case 'dm.set_combatant_visibility': {
        const enc = this.state.encounters[body.encounterId];
        if (!enc || !enc.active) return done('rejected', 'no-active-encounter');
        const target = enc.combatants.find(c => c.id === body.combatantId);
        if (!target) return done('rejected', 'unknown-combatant');
        if (!validMonsterVisibility(body.visibility)) return done('rejected', 'malformed');
        const visibility: MonsterVisibility = { ...body.visibility };
        this.commit({ t: 'combatant_visibility_set', encounterId: enc.id, combatantId: target.id, visibility }, pid,
          { kind: 'encounter', text: `${target.name}'s visibility changed`, scope: 'dm', refId: enc.id });
        // The event alone only carries the new flags, not whatever field values just became
        // newly visible (or need to stop being shown) — a Player's replica never stored a
        // gated field's value while it was hidden, and hiding it again doesn't erase a value
        // already known from before. A full resync brings every connected viewer back in line
        // with "what SHOULD currently be visible," correct in both directions.
        for (const [otherId, entry] of this.entries) {
          if (entry.conn) this.sendSnapshot(otherId);
        }
        return done('applied');
      }

      case 'dm.apply_effect': return this.applyEffect(pid, op, body);

      case 'dm.mark_due': {
        const hit = this.findApp(body.applicationId);
        if (!hit || hit.app.state !== 'ACTIVE') return done('rejected', 'not-active');
        this.commit({ t: 'applications_due', applicationIds: [hit.app.id] }, pid,
          this.effectAudit(hit.def, [hit.app.targetId], 'is due to end', 'effect_due'));
        return done('applied');
      }

      case 'dm.tick_rounds': {
        if (!int(body.rounds) || body.rounds < 1 || body.rounds > 1000) return done('rejected', 'malformed');
        const ticked: { applicationId: string; remaining: number }[] = [];
        const due: string[] = [];
        for (const eff of Object.values(this.state.effects)) {
          for (const app of Object.values(eff.applications)) {
            if (app.state !== 'ACTIVE' || app.remaining === null) continue;
            const remaining = Math.max(0, app.remaining - body.rounds);
            ticked.push({ applicationId: app.id, remaining });
            if (remaining === 0) due.push(app.id);
          }
        }
        if (ticked.length === 0) return done('rejected', 'nothing-to-tick');
        this.commit({ t: 'applications_due', applicationIds: due, ticked }, pid,
          { kind: 'effect_tick', text: `${body.rounds} round(s) passed; ${due.length} effect(s) due to end`, scope: 'dm' });
        return done('applied');
      }

      case 'dm.end_effect': {
        const eff = this.state.effects[body.effectId];
        if (!eff) return done('rejected', 'unknown-effect');
        let ids: string[];
        if (body.applicationId !== undefined) {
          const app = eff.applications[body.applicationId];
          if (!app) return done('rejected', 'unknown-application');
          if (app.state === 'ENDED') return done('rejected', 'already-ended');
          ids = [app.id];
        } else {
          ids = Object.values(eff.applications).filter(a => a.state !== 'ENDED').map(a => a.id);
          if (ids.length === 0) return done('rejected', 'already-ended');
        }
        const targets = ids.map(id => eff.applications[id].targetId);
        this.commit({ t: 'applications_ended', applicationIds: ids }, pid,
          this.effectAudit(eff.definition, targets, ids.length === Object.keys(eff.applications).length ? 'ended for everyone' : 'ended', 'effect_end'));
        return done('applied');
      }

      case 'dm.request_change': return this.requestChange(pid, op, body);

      case 'dm.cancel_request': {
        const r = this.state.requests[body.requestId];
        if (!r) return done('rejected', 'unknown-request');
        if (r.status !== 'PENDING') return done('rejected', 'already-resolved');
        this.commit({ t: 'request_resolved', requestId: r.id, status: 'CANCELLED', finalApplied: null, playerModified: null, acknowledgedStale: false }, pid,
          { kind: 'request', text: `DM cancelled request "${r.label}"`, scope: 'participants', participantIds: [r.targetId], refId: r.id });
        return done('applied');
      }

      case 'player.respond': return this.respond(pid, actor, op, body);

      case 'player.report_character': {
        if (!str(body.characterId) || !int(body.revision) || body.revision < 0 || !isObj(body.summary)) return done('rejected', 'malformed');
        const s = body.summary;
        if (!str(s.name) || typeof s.hp !== 'number' || typeof s.maxHp !== 'number' || typeof s.ac !== 'number') return done('rejected', 'malformed');
        if (body.vitals !== undefined && !validVitals(body.vitals)) return done('rejected', 'malformed');
        const prev = this.state.characters[pid];
        if (prev && (body.revision < prev.revision)) return done('rejected', 'stale-report');
        if (prev && prev.revision === body.revision && prev.characterId === body.characterId
          && JSON.stringify(prev.summary) === JSON.stringify(body.summary)
          && JSON.stringify(prev.vitals) === JSON.stringify(body.vitals)) return done('applied', 'no-op');
        const character: ReportedCharacter = {
          participantId: pid, characterId: body.characterId, revision: body.revision,
          summary: { name: s.name, hp: s.hp, maxHp: s.maxHp, ac: s.ac },
          // Preserve an existing persona across an ordinary character report (HP changing, etc.)
          // — this op has nothing to do with Public Persona, so it must never silently clear one.
          ...(prev?.persona ? { persona: prev.persona } : {}),
          ...(body.vitals ? { vitals: body.vitals } : {}),
        };
        this.commit({ t: 'character_reported', character }, pid, null);
        return done('applied');
      }

      case 'player.set_persona': {
        const prev = this.state.characters[pid];
        if (!prev) return done('rejected', 'no-character-reported');
        const p = body.persona;
        if (!isObj(p) || typeof p.enabled !== 'boolean' || !str(p.name)
          || typeof p.hp !== 'number' || typeof p.maxHp !== 'number' || typeof p.ac !== 'number') {
          return done('rejected', 'malformed');
        }
        const persona: PublicPersona = { enabled: p.enabled, name: p.name, hp: p.hp, maxHp: p.maxHp, ac: p.ac };
        this.commit({ t: 'persona_set', participantId: pid, persona }, pid, null);
        return done('applied');
      }

      case 'player.suggest_rule': {
        // DM_SCREEN_SPEC.md item 11's "rule suggestions enabled" toggle — ENFORCED (default true:
        // a campaign linked before this field existed, or with no campaign at all, still allows it).
        if (this.state.campaign?.ruleSuggestionsEnabled === false) return done('rejected', 'rule-suggestions-disabled');
        if (!str(body.suggestionId) || !str(body.rule) || !str(body.proposedValue)) return done('rejected', 'malformed');
        if (typeof body.note !== 'string' || body.note.length > 2000) return done('rejected', 'malformed');
        if (this.state.ruleSuggestions[body.suggestionId]) return done('rejected', 'suggestion-exists');
        const suggestion: RuleSuggestion = {
          id: body.suggestionId, playerId: pid, rule: body.rule, proposedValue: body.proposedValue, note: body.note,
          status: 'PENDING', dmResponse: null,
          createdAtRevision: this.state.revision + 1, resolvedAtRevision: null,
        };
        this.commit({ t: 'rule_suggestion_created', suggestion }, pid,
          { kind: 'rule_suggestion', text: `${this.nick(pid)} suggested a rule change: "${suggestion.rule}"`, scope: 'participants', participantIds: [pid] });
        return done('applied');
      }

      case 'dm.resolve_rule_suggestion': {
        const sug = this.state.ruleSuggestions[body.suggestionId];
        if (!sug) return done('rejected', 'unknown-suggestion');
        if (sug.status !== 'PENDING') return done('rejected', 'already-resolved');
        if (body.decision !== 'accept' && body.decision !== 'modify' && body.decision !== 'reject') return done('rejected', 'malformed');
        if (body.decision === 'modify' && !str(body.dmResponse)) return done('rejected', 'malformed');
        const status: RuleSuggestionStatus = body.decision === 'accept' ? 'ACCEPTED' : body.decision === 'modify' ? 'MODIFIED' : 'REJECTED';
        const dmResponse = body.decision === 'modify' ? body.dmResponse! : null;
        this.commit({ t: 'rule_suggestion_resolved', suggestionId: sug.id, status, dmResponse }, pid,
          { kind: 'rule_suggestion', text: `DM ${body.decision === 'accept' ? 'accepted' : body.decision === 'modify' ? 'modified' : 'rejected'} "${sug.rule}"`, scope: 'participants', participantIds: [sug.playerId] });
        return done('applied');
      }

      case 'dm.grant_reward': {
        if (!str(body.rewardId) || !str(body.targetId) || !rewardKind(body.rewardKind) || !str(body.label)) return done('rejected', 'malformed');
        if (body.description !== undefined && !optStr(body.description)) return done('rejected', 'malformed');
        if (body.tierTrack !== undefined && body.tierTrack !== null && !str(body.tierTrack)) return done('rejected', 'malformed');
        if (this.state.rewards[body.rewardId]) return done('rejected', 'reward-exists');
        const target = this.state.participants[body.targetId];
        if (!target || !target.capabilities.includes('player')) return done('rejected', 'unknown-target');
        const reward: Reward = {
          id: body.rewardId, requesterId: pid, targetId: body.targetId, kind: body.rewardKind,
          label: body.label, description: body.description ?? null, tierTrack: body.tierTrack ?? null,
          status: 'PENDING', playerNote: null, supersededBy: null,
          createdAtRevision: this.state.revision + 1, resolvedAtRevision: null,
        };
        this.commit({ t: 'reward_granted', reward }, pid,
          { kind: 'reward', text: `DM granted ${this.nick(target.id)} a reward: "${reward.label}"`, scope: 'participants', participantIds: [target.id], refId: reward.id });
        // DM_SCREEN_SPEC.md item 13's "applies immediately" branch of the Permanent DM Rewards
        // policy (item 11) — ENFORCED, closing the gap Reward's own doc comment in types.ts
        // explicitly named ("this wire format doesn't carry [a policy field]... disclosed, not
        // silently assumed"). Default false (require Player approval, the PENDING status above).
        if (this.state.campaign?.permanentRewardsAutomatic === true) {
          const audienceScope = { scope: 'participants' as const, participantIds: [target.id], refId: reward.id };
          this.commit({ t: 'reward_resolved', rewardId: reward.id, status: 'ACCEPTED', playerNote: null }, pid,
            { kind: 'reward', text: `"${reward.label}" applied automatically (campaign policy)`, ...audienceScope });
          this.supersedePriorTier(reward, pid, audienceScope);
        }
        return done('applied');
      }

      case 'dm.cancel_reward': {
        const r = this.state.rewards[body.rewardId];
        if (!r) return done('rejected', 'unknown-reward');
        if (r.status !== 'PENDING') return done('rejected', 'already-resolved');
        this.commit({ t: 'reward_resolved', rewardId: r.id, status: 'CANCELLED', playerNote: null }, pid,
          { kind: 'reward', text: `DM withdrew the reward "${r.label}"`, scope: 'participants', participantIds: [r.targetId], refId: r.id });
        return done('applied');
      }

      case 'player.respond_reward': return this.respondReward(pid, actor, op, body);

      case 'dm.add_session_log': {
        if (!str(body.entryId) || !sessionLogKind(body.logKind) || !logText(body.text)) return done('rejected', 'malformed');
        if (this.state.sessionLog.some(e => e.id === body.entryId)) return done('rejected', 'entry-exists');
        const entry: SessionLogEntry = {
          id: body.entryId, kind: body.logKind, text: body.text, actorId: pid,
          at: this.now(), createdAtRevision: this.state.revision + 1,
        };
        // No audit scope entitles a Host-only viewer to this ('session_log' isn't in HOST_AUDIT_
        // KINDS) — matches sessionLog itself being withheld from that level in state.ts.
        this.commit({ t: 'session_log_added', entry }, pid, { kind: 'session_log', text: `Session log: ${entry.text}`, scope: 'all' });
        return done('applied');
      }

      case 'dm.convert_effect_visibility': {
        const eff = this.state.effects[body.effectId];
        if (!eff) return done('rejected', 'unknown-effect');
        if (body.visibility !== 'public' && body.visibility !== 'target' && body.visibility !== 'secret') return done('rejected', 'bad-visibility');
        const id = body.identity;
        if (!isObj(id) || !optStr(id.name) || !optStr(id.description) || !optStr(id.source)) return done('rejected', 'malformed');
        if (body.visibility === 'secret' && (id.name !== null || id.description !== null || id.source !== null)) {
          return done('rejected', 'secret-metadata-not-allowed');
        }
        if (body.visibility !== 'secret' && id.name === null) return done('rejected', 'malformed');
        this.commit({ t: 'effect_visibility_converted', effectId: eff.definition.id, visibility: body.visibility, name: id.name, description: id.description, source: id.source }, pid,
          { kind: 'effect_convert', text: `${id.name ?? eff.definition.id} is now ${body.visibility}`, scope: 'dm', refId: eff.definition.id });
        // Converting visibility can change WHO is entitled to see this effect at all (e.g. public
        // -> secret means non-targets must stop seeing it entirely; secret -> public means
        // everyone should start seeing identity they never had) — a narrow event can't express
        // that for a replica that has nothing, or too much, already. Full resync for everyone,
        // same fix as dm.set_combatant_visibility above.
        for (const [otherId, entry] of this.entries) {
          if (entry.conn) this.sendSnapshot(otherId);
        }
        return done('applied');
      }

      case 'dm.unlink_campaign': {
        if (!this.state.campaign) return done('rejected', 'no-campaign-linked');
        const name = this.state.campaign.name;
        this.commit({ t: 'campaign_unlinked' }, pid, { kind: 'campaign', text: `Campaign "${name}" unlinked from this room`, scope: 'all' });
        return done('applied');
      }

      case 'dm.add_effect_target': {
        const eff = this.state.effects[body.effectId];
        if (!eff) return done('rejected', 'unknown-effect');
        const target = this.state.participants[body.targetId];
        if (!target || !target.capabilities.includes('player')) return done('rejected', 'unknown-target');
        const already = Object.values(eff.applications).some(a => a.targetId === body.targetId && a.state !== 'ENDED');
        if (already) return done('rejected', 'already-targeted');
        const def = eff.definition;
        const application: EffectApplication = {
          id: `${def.id}:${body.targetId}`, effectId: def.id, targetId: body.targetId, state: 'ACTIVE',
          remaining: def.duration.unit === 'rounds' ? def.duration.remaining : null,
          appliedAtRevision: this.state.revision + 1, endedAtRevision: null,
        };
        this.commit({ t: 'effect_target_added', effectId: def.id, application }, pid,
          this.effectAudit(def, [body.targetId], 'added as a target of', 'effect_apply'));
        // The added target may never have seen this effect before (e.g. a 'target'-visibility
        // effect they weren't originally part of) — their replica would have nothing to attach
        // the new application to from the narrow event alone. A full resync is cheap and correct
        // regardless; same lesson as Monster Visibility's dm.set_combatant_visibility.
        this.sendSnapshot(body.targetId);
        return done('applied');
      }

      case 'host.assign_capabilities': {
        const target = this.state.participants[body.participantId];
        if (!target) return done('rejected', 'unknown-participant');
        const wanted = sanitizeRequested(body.capabilities);
        const caps: Capability[] = [...(target.capabilities.includes('host') ? ['host' as Capability] : []), ...wanted];
        const next: PublicParticipant = { ...target, capabilities: caps };
        delete next.requestedDm;
        this.commit({ t: 'participant_upsert', participant: next }, pid,
          { kind: 'roles', text: `${target.nickname} is now ${caps.join(' + ') || 'observer'}`, scope: 'all' });
        this.sendSnapshot(target.id);          // their view level may have changed
        return done('applied');
      }

      case 'host.end_session': {
        this.commit({ t: 'session_ended' }, pid, { kind: 'session', text: 'Session ended', scope: 'all' });
        return done('applied');
      }

      default:
        return done('rejected', 'unknown-op');
    }
  }

  // ── Op helpers ─────────────────────────────────────────────────────────────

  private findApp(applicationId: string): { def: EffectDefinition; app: EffectApplication } | null {
    for (const eff of Object.values(this.state.effects)) {
      const app = eff.applications[applicationId];
      if (app) return { def: eff.definition, app };
    }
    return null;
  }

  private nick(id: ParticipantId): string {
    return this.state.participants[id]?.nickname ?? id;
  }

  private effectAudit(def: EffectDefinition, targets: ParticipantId[], verb: string, kind: string) {
    const names = targets.map(t => this.nick(t)).join(', ');
    if (def.visibility === 'secret') {
      return { kind, text: `Secret effect ${def.id} ${verb} (${names})`, scope: 'dm' as const, refId: def.id };
    }
    const label = def.name ?? def.id;
    if (def.visibility === 'target') {
      return { kind, text: `${label} ${verb} (${names})`, scope: 'participants' as const, participantIds: targets, refId: def.id };
    }
    return { kind, text: `${label} ${verb} (${names})`, scope: 'all' as const, refId: def.id };
  }

  private applyEffect(pid: ParticipantId, op: Op, body: Extract<OpBody, { kind: 'dm.apply_effect' }>): OpResult {
    const done = (status: OpResult['status'], reason?: string): OpResult =>
      ({ opId: op.opId, status, ...(reason ? { reason } : {}), revision: this.state.revision });
    const e = body.effect;
    if (!isObj(e) || !str(e.id) || !Array.isArray(body.targets) || body.targets.length === 0) return done('rejected', 'malformed');
    if (this.state.effects[e.id]) return done('rejected', 'effect-exists');
    if (e.visibility !== 'public' && e.visibility !== 'target' && e.visibility !== 'secret') return done('rejected', 'bad-visibility');
    if (!optStr(e.name) || !optStr(e.description) || !optStr(e.source)) return done('rejected', 'malformed');
    if (e.visibility === 'secret' && (e.name !== null || e.description !== null || e.source !== null)) {
      return done('rejected', 'secret-metadata-not-allowed');
    }
    if (!Array.isArray(e.components)) return done('rejected', 'malformed');
    for (const c of e.components) {
      if (!isObj(c) || !STATS.includes(String(c.stat)) || c.operation !== 'add'
        || typeof c.value !== 'number' || !Number.isFinite(c.value)) return done('rejected', 'bad-component');
    }
    const d = e.duration;
    if (!isObj(d) || (d.unit !== 'manual' && d.unit !== 'rounds')) return done('rejected', 'bad-duration');
    if (d.unit === 'rounds' && (!int(d.total) || !int(d.remaining) || d.total < 1 || d.remaining < 0 || d.remaining > d.total)) {
      return done('rejected', 'bad-duration');
    }
    const targets = [...new Set(body.targets)];
    for (const t of targets) {
      const p = this.state.participants[t];
      if (!p || !p.capabilities.includes('player')) return done('rejected', 'unknown-target');
    }
    const revision = this.state.revision + 1;
    const definition: EffectDefinition = {
      id: e.id, name: e.name, description: e.description, source: e.source,
      visibility: e.visibility, components: e.components.map(c => ({ stat: c.stat, operation: c.operation, value: c.value })),
      duration: d.unit === 'manual' ? { unit: 'manual' } : { unit: 'rounds', total: d.total, remaining: d.remaining },
    };
    const applications: EffectApplication[] = targets.map(t => ({
      id: `${definition.id}:${t}`, effectId: definition.id, targetId: t, state: 'ACTIVE',
      remaining: definition.duration.unit === 'rounds' ? definition.duration.remaining : null,
      appliedAtRevision: revision, endedAtRevision: null,
    }));
    this.commit({ t: 'effect_applied', definition, applications }, pid,
      this.effectAudit(definition, targets, 'applied', 'effect_apply'));
    return done('applied');
  }

  private requestChange(pid: ParticipantId, op: Op, body: Extract<OpBody, { kind: 'dm.request_change' }>): OpResult {
    const done = (status: OpResult['status'], reason?: string): OpResult =>
      ({ opId: op.opId, status, ...(reason ? { reason } : {}), revision: this.state.revision });
    if (!str(body.requestId) || !str(body.targetId) || !int(body.baseRevision) || body.baseRevision < 0
      || !str(body.label) || !validChanges(body.changes)) return done('rejected', 'malformed');
    if (this.state.requests[body.requestId]) return done('rejected', 'request-exists');
    const target = this.state.participants[body.targetId];
    if (!target || !target.capabilities.includes('player')) return done('rejected', 'unknown-target');
    const request: ChangeRequest = {
      id: body.requestId, requesterId: pid, targetId: body.targetId,
      characterId: this.state.characters[body.targetId]?.characterId ?? target.characterId,
      label: body.label, baseRevision: body.baseRevision,
      original: JSON.parse(JSON.stringify(body.changes)) as CharacterChange[],
      status: 'PENDING', createdAtRevision: this.state.revision + 1, resolvedAtRevision: null,
      finalApplied: null, playerModified: null, acknowledgedStale: false, staleAgainst: null,
    };
    this.commit({ t: 'request_created', request }, pid,
      { kind: 'request', text: `DM requested "${request.label}": ${describeChanges(request.original)}`,
        scope: 'participants', participantIds: [target.id], refId: request.id });
    return done('applied');
  }

  private respond(pid: ParticipantId, actor: PublicParticipant, op: Op, body: Extract<OpBody, { kind: 'player.respond' }>): OpResult {
    const done = (status: OpResult['status'], reason?: string): OpResult =>
      ({ opId: op.opId, status, ...(reason ? { reason } : {}), revision: this.state.revision });
    const req = this.state.requests[body.requestId];
    if (!req) return done('rejected', 'unknown-request');
    if (req.targetId !== pid) return done('forbidden', 'not-your-request');
    if (req.status !== 'PENDING') return done('rejected', 'already-resolved');
    if (body.decision !== 'accept' && body.decision !== 'reject' && body.decision !== 'modify') return done('rejected', 'malformed');
    const audienceScope = { scope: 'participants' as const, participantIds: [req.targetId], refId: req.id };

    if (body.decision === 'reject') {
      this.commit({ t: 'request_resolved', requestId: req.id, status: 'REJECTED', finalApplied: null, playerModified: null, acknowledgedStale: false }, pid,
        { kind: 'request', text: `${actor.nickname} rejected "${req.label}"`, ...audienceScope });
      return done('applied');
    }

    if (!int(body.currentRevision)) return done('rejected', 'malformed');
    const isStale = body.currentRevision !== req.baseRevision;
    if (isStale && body.acknowledgeStale !== true) {
      if (req.staleAgainst !== body.currentRevision) {
        this.commit({ t: 'request_stale_flag', requestId: req.id, staleAgainst: body.currentRevision }, pid,
          { kind: 'request', text: `"${req.label}" is stale: character changed since it was requested`, ...audienceScope });
      }
      return done('stale', 'character-changed');
    }

    if (body.decision === 'modify') {
      if (!validChanges(body.modified)) return done('rejected', 'malformed');
      const modified = JSON.parse(JSON.stringify(body.modified)) as CharacterChange[];
      this.commit({ t: 'request_resolved', requestId: req.id, status: 'MODIFIED', finalApplied: modified, playerModified: modified, acknowledgedStale: isStale }, pid,
        { kind: 'request',
          text: `DM requested ${describeChanges(req.original)}; ${actor.nickname} modified it to ${describeChanges(modified)} and accepted${isStale ? ' (acknowledged the character had changed)' : ''}`,
          ...audienceScope });
      return done('applied');
    }

    const finalApplied = JSON.parse(JSON.stringify(req.original)) as CharacterChange[];
    this.commit({ t: 'request_resolved', requestId: req.id, status: 'ACCEPTED', finalApplied, playerModified: null, acknowledgedStale: isStale }, pid,
      { kind: 'request', text: `${actor.nickname} accepted "${req.label}": ${describeChanges(finalApplied)}${isStale ? ' (acknowledged the character had changed)' : ''}`, ...audienceScope });
    return done('applied');
  }

  private respondReward(pid: ParticipantId, actor: PublicParticipant, op: Op, body: Extract<OpBody, { kind: 'player.respond_reward' }>): OpResult {
    const done = (status: OpResult['status'], reason?: string): OpResult =>
      ({ opId: op.opId, status, ...(reason ? { reason } : {}), revision: this.state.revision });
    const reward = this.state.rewards[body.rewardId];
    if (!reward) return done('rejected', 'unknown-reward');
    if (reward.targetId !== pid) return done('forbidden', 'not-your-reward');
    if (reward.status !== 'PENDING') return done('rejected', 'already-resolved');
    if (body.decision !== 'accept' && body.decision !== 'reject' && body.decision !== 'modify') return done('rejected', 'malformed');
    if (body.note !== undefined && (typeof body.note !== 'string' || body.note.length > 2000)) return done('rejected', 'malformed');
    const audienceScope = { scope: 'participants' as const, participantIds: [reward.targetId], refId: reward.id };

    if (body.decision === 'reject') {
      this.commit({ t: 'reward_resolved', rewardId: reward.id, status: 'REJECTED', playerNote: body.note ?? null }, pid,
        { kind: 'reward', text: `${actor.nickname} declined the reward "${reward.label}"`, ...audienceScope });
      return done('applied');
    }

    if (body.decision === 'modify' && !str(body.note)) return done('rejected', 'malformed');
    const status: RewardStatus = body.decision === 'modify' ? 'MODIFIED' : 'ACCEPTED';
    const playerNote = body.decision === 'modify' ? body.note! : (body.note ?? null);
    this.commit({ t: 'reward_resolved', rewardId: reward.id, status, playerNote }, pid,
      { kind: 'reward', text: `${actor.nickname} accepted the reward "${reward.label}"${status === 'MODIFIED' ? ' (with their own note)' : ''}`, ...audienceScope });

    this.supersedePriorTier(reward, pid, audienceScope);
    return done('applied');
  }

  /** Tiered rewards replace the previous tier in the same track (DM_SCREEN_SPEC.md item 13) — the
   *  OLD tier is kept, only marked SUPERSEDED, never deleted (see Reward's own doc comment for why
   *  "preserve spent uses" stays a DM-carried note rather than a tracked number). Shared by both
   *  the Player's own accept/modify and dm.grant_reward's auto-apply path (permanentRewardsAutomatic). */
  private supersedePriorTier(reward: Reward, pid: ParticipantId, audienceScope: { scope: 'participants'; participantIds: ParticipantId[]; refId: string }): void {
    if (reward.kind !== 'reward_tier' || !reward.tierTrack) return;
    const prior = Object.values(this.state.rewards).find(r =>
      r.id !== reward.id && r.targetId === reward.targetId && r.kind === 'reward_tier' &&
      r.tierTrack === reward.tierTrack && (r.status === 'ACCEPTED' || r.status === 'MODIFIED'));
    if (prior) {
      this.commit({ t: 'reward_superseded', rewardId: prior.id, supersededBy: reward.id }, pid,
        { kind: 'reward', text: `"${reward.label}" supersedes the previous ${reward.tierTrack} tier`, ...audienceScope });
    }
  }
}
