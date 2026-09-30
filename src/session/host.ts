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
  ChangeRequest, LiveEncounter, ReportedCharacter, CharacterChange,
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
      this.state = emptyLiveState(opts.sessionId);
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
        if (!str(body.campaignId) || !str(body.name)) return done('rejected', 'malformed');
        this.commit({ t: 'campaign_linked', campaignId: body.campaignId, name: body.name }, pid,
          { kind: 'campaign', text: `Campaign "${body.name}" linked`, scope: 'all' });
        return done('applied');
      }

      case 'dm.activate_encounter': {
        const e = body.encounter;
        if (!isObj(e) || !str(e.id) || !str(e.name) || !Array.isArray(e.combatants)) return done('rejected', 'malformed');
        if (this.state.encounters[e.id]) return done('rejected', 'encounter-exists');
        const enc: LiveEncounter = {
          id: e.id, name: e.name, active: true,
          combatants: e.combatants.map(c => ({
            id: String(c.id), name: String(c.name),
            hpState: c.hpState === 'down' || c.hpState === 'bloodied' ? c.hpState : 'healthy',
            ...(typeof c.ac === 'number' ? { ac: c.ac } : {}),
          })),
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
        const prev = this.state.characters[pid];
        if (prev && (body.revision < prev.revision)) return done('rejected', 'stale-report');
        if (prev && prev.revision === body.revision && prev.characterId === body.characterId
          && JSON.stringify(prev.summary) === JSON.stringify(body.summary)) return done('applied', 'no-op');
        const character: ReportedCharacter = {
          participantId: pid, characterId: body.characterId, revision: body.revision,
          summary: { name: s.name, hp: s.hp, maxHp: s.maxHp, ac: s.ac },
        };
        this.commit({ t: 'character_reported', character }, pid, null);
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
}
