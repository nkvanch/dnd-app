// ============================================================================
// FILE: src/session/peer.ts
// SessionPeer: the client side of the session layer, used by Host devices,
// DM devices and Player devices alike (capabilities decide what a peer may do;
// the Host core re-checks every op, so a locally-permitted call is never the
// security boundary).
//
// A peer keeps: a replica of its authorized projection, an ordered queue of
// unacknowledged ops (resent verbatim after reconnect: idempotent), and, for
// players, the ledger of change requests already applied to the character.
// ============================================================================
import {
  Capability, CharacterAdapter, CharacterChange, ClientMessage, Op, OpBody, OpResult, ParticipantId,
  ServerMessage, ViewState, LiveEvent, ChangeRequest, LiveEffect, EffectApplication, SecretEffectMeta,
  EffectComponent, EffectDuration, EffectDefinitionInput, MonsterVisibility,
} from './types';
import { applyEvent } from './state';
import { ClientTransport, Connection, decodeFrame, encodeFrame } from './transport';
import { KeyValueStore } from './kv';
import { PrepService, SecretVault, toEffectInput, toLiveEncounterInput, toLivePolicyInput } from './prep';

export type PeerStatus = 'disconnected' | 'connecting' | 'connected';

export type PeerConfig = {
  participantId:         ParticipantId;
  nickname:              string;
  requestedCapabilities: Capability[];
  characterId?:          string | null;
  transport:             ClientTransport;
  kv:                    KeyValueStore;
  /** Token issued out-of-band (the Host device's own participant is registered locally). */
  initialToken?:         string;
  /** Persistence key override (a device keeps separate identity state per Host it has joined). */
  storageKey?:           string;
  /** Deterministic id source for tests; defaults to random. */
  newId?:                (prefix: string) => string;
  character?:            CharacterAdapter;
  prep?:                 PrepService;
  vault?:                SecretVault;
  /** Installed-pack names, for resolving a prepared campaign's requiredPackIds into human-readable
   *  CampaignPolicy.requiredPacks (see prep.ts's toLivePolicyInput). Injected rather than imported
   *  directly — this is DB-backed (native-only) and the deterministic test harness (testing/
   *  harness.ts) never initializes a real db; omitted = no required-pack names resolved (empty list),
   *  never a runtime failure. */
  installedPacks?:       () => Promise<{ id: string; name: string }[]>;
};

type PeerPersisted = {
  participantId:   ParticipantId;
  token:           string | null;
  opCounter:       number;
  unacked:         Op[];
  appliedRequests: string[];
  view:            ViewState | null;
};

/** The storage key a join() at host:port persists its identity under — exported so callers can
 *  look up a PRIOR join's identity without connecting (see loadStoredIdentity below) using the
 *  exact same key join() itself will use, rather than a second, driftable copy of this format. */
export function peerStorageKey(participantId: ParticipantId, host: string, port: number): string {
  return `session.peer.${participantId}@${host}:${port}`;
}

export type StoredIdentity = {
  nickname:     string;
  capabilities: Capability[];
  characterId:  string | null;
};

/**
 * Reads the last-known identity for a PRIOR join to host:port, without connecting or affecting
 * this device's actual connection state — the Join modal's reconnect-by-token screen
 * (JOIN_SESSION_FLOW_SPEC.md: "Previous participant found... Reconnect"). The room code only
 * tells the app which room; this is what tells it who the device already is there. Returns null
 * if this device never joined that exact address, or has no view yet to recover an identity from
 * (e.g. it joined but disconnected before ever receiving a welcome).
 */
export async function loadStoredIdentity(
  kv: KeyValueStore, participantId: ParticipantId, host: string, port: number,
): Promise<StoredIdentity | null> {
  const saved = await kv.get<PeerPersisted>(peerStorageKey(participantId, host, port));
  if (!saved || saved.participantId !== participantId || !saved.view) return null;
  const me = saved.view.participants[participantId];
  if (!me) return null;
  return { nickname: me.nickname, capabilities: me.capabilities, characterId: me.characterId };
}

export class NotCapableError extends Error {
  constructor(cap: Capability) { super(`This participant lacks the ${cap} capability`); }
}

export class SessionPeer {
  status: PeerStatus = 'disconnected';
  capabilities: Capability[] = [];
  view: ViewState | null = null;
  lastError: string | null = null;
  readonly results = new Map<string, OpResult>();

  private conn: Connection | null = null;
  private token: string | null = null;
  private opCounter = 0;
  private unacked: Op[] = [];
  private appliedRequests = new Set<string>();
  private buffered = new Map<number, LiveEvent | null>();
  private resyncRequested = false;
  private listeners = new Set<() => void>();
  private saving: Promise<void> = Promise.resolve();
  private secretCache: Record<string, SecretEffectMeta> = {};
  private idCounter = 0;

  private constructor(readonly cfg: PeerConfig) {}

  static async create(cfg: PeerConfig): Promise<SessionPeer> {
    const p = new SessionPeer(cfg);
    const saved = await cfg.kv.get<PeerPersisted>(p.key());
    if (saved && saved.participantId === cfg.participantId) {
      p.token = saved.token;
      p.opCounter = saved.opCounter;
      p.unacked = saved.unacked;
      p.appliedRequests = new Set(saved.appliedRequests);
      p.view = saved.view;
      p.capabilities = saved.view?.participants[cfg.participantId]?.capabilities ?? [];
    }
    if (!p.token && cfg.initialToken) p.token = cfg.initialToken;
    if (cfg.vault) p.secretCache = await cfg.vault.all();
    return p;
  }

  get participantId(): ParticipantId { return this.cfg.participantId; }
  get revision(): number { return this.view?.revision ?? 0; }

  private key(): string { return this.cfg.storageKey ?? `session.peer.${this.cfg.participantId}`; }

  private id(prefix: string): string {
    if (this.cfg.newId) return this.cfg.newId(prefix);
    return `${prefix}_${this.cfg.participantId}_${Date.now().toString(36)}_${(++this.idCounter).toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
  }

  // ── Observation ────────────────────────────────────────────────────────────

  subscribe(cb: () => void): () => void {
    this.listeners.add(cb);
    return () => { this.listeners.delete(cb); };
  }
  private notify(): void { this.listeners.forEach(l => l()); }

  /** Resolves once queued persistence has completed (tests call this before simulating a restart). */
  flush(): Promise<void> { return this.saving; }

  private persist(): void {
    const snapshot: PeerPersisted = {
      participantId: this.cfg.participantId, token: this.token, opCounter: this.opCounter,
      unacked: this.unacked, appliedRequests: [...this.appliedRequests], view: this.view,
    };
    this.saving = this.saving.then(() => this.cfg.kv.set(this.key(), snapshot));
  }

  // ── Connection ─────────────────────────────────────────────────────────────

  async connect(): Promise<void> {
    if (this.status !== 'disconnected') return;
    this.status = 'connecting';
    this.notify();
    let conn: Connection;
    try {
      conn = await this.cfg.transport.connect();
    } catch (e) {
      this.status = 'disconnected';
      this.lastError = (e as Error).message;
      this.notify();
      throw e;
    }
    this.conn = conn;
    conn.onFrame(f => this.onFrame(conn, f));
    conn.onClose(() => {
      if (this.conn !== conn) return;
      this.conn = null;
      this.status = 'disconnected';
      this.notify();
    });
    this.sendMsg({
      type: 'hello', participantId: this.cfg.participantId, token: this.token, nickname: this.cfg.nickname,
      requestedCapabilities: this.cfg.requestedCapabilities, characterId: this.cfg.characterId ?? null,
      lastRevision: this.revision,
    });
  }

  disconnect(): void {
    const c = this.conn;
    this.conn = null;
    this.status = 'disconnected';
    c?.close();
    this.notify();
  }

  private sendMsg(msg: ClientMessage): void {
    this.conn?.send(encodeFrame(msg));
  }

  // ── Incoming ───────────────────────────────────────────────────────────────

  private onFrame(conn: Connection, frame: string): void {
    if (this.conn !== conn) return;
    const msg = decodeFrame<ServerMessage>(frame);
    if (!msg) return;
    switch (msg.type) {
      case 'welcome':
        // A different Host session means our op sequence, queued ops and old replica belong to another
        // table: start ordering from scratch or the new Host would wait forever for the "missing" ops.
        if (this.view && this.view.sessionId !== msg.sessionId) {
          this.opCounter = 0;
          this.unacked = [];
          this.results.clear();
          this.buffered.clear();
        }
        this.token = msg.token;
        this.capabilities = msg.capabilities;
        this.status = 'connected';
        this.lastError = null;
        this.adoptView(msg.view);
        for (const op of this.unacked) this.sendMsg({ type: 'op', op });      // idempotent replay
        this.persist();
        this.afterViewChange();
        this.notify();
        break;
      case 'snapshot':
        this.adoptView(msg.view);
        this.capabilities = msg.view.participants[this.cfg.participantId]?.capabilities ?? this.capabilities;
        this.persist();
        this.afterViewChange();
        this.notify();
        break;
      case 'event':
        this.onEvent(msg.revision, msg.event);
        break;
      case 'result':
        this.onResult(msg.result);
        break;
      case 'error':
        this.lastError = msg.message;
        this.notify();
        break;
    }
  }

  /** The Host is authoritative: its view always replaces ours. */
  private adoptView(view: ViewState): void {
    this.view = view;
    this.resyncRequested = false;
    // Drain anything that arrived ahead of the snapshot.
    for (const rev of [...this.buffered.keys()].filter(r => r <= view.revision)) this.buffered.delete(rev);
    this.drainBuffered();
  }

  private onEvent(revision: number, event: LiveEvent | null): void {
    if (!this.view) return;
    const cur = this.view.revision;
    if (revision <= cur) return;                        // duplicate / replay: ignore
    if (revision > cur + 1) {                            // gap: buffer and ask for the truth
      this.buffered.set(revision, event);
      if (!this.resyncRequested) {
        this.resyncRequested = true;
        this.sendMsg({ type: 'resync' });
      }
      return;
    }
    this.applyOne(revision, event);
    this.drainBuffered();
    this.persist();
    this.afterViewChange();
    this.notify();
  }

  private applyOne(revision: number, event: LiveEvent | null): void {
    if (!this.view) return;
    this.view = event ? applyEvent(this.view, event) : { ...this.view, revision };
    this.capabilities = this.view.participants[this.cfg.participantId]?.capabilities ?? this.capabilities;
  }

  private drainBuffered(): void {
    while (this.view && this.buffered.has(this.view.revision + 1)) {
      const rev = this.view.revision + 1;
      const ev = this.buffered.get(rev) ?? null;
      this.buffered.delete(rev);
      this.applyOne(rev, ev);
    }
  }

  private onResult(result: OpResult): void {
    this.results.set(result.opId, result);
    this.unacked = this.unacked.filter(o => o.opId !== result.opId);
    this.persist();
    this.notify();
  }

  // ── Ops ────────────────────────────────────────────────────────────────────

  /** Sends an op without any local capability check. Tests use this to prove the Host enforces authorization. */
  sendRaw(body: OpBody): string {
    const op: Op = { opId: `${this.cfg.participantId}:${this.opCounter + 1}`, seq: this.opCounter + 1, body };
    this.opCounter += 1;
    this.unacked.push(op);
    this.persist();
    if (this.status === 'connected') this.sendMsg({ type: 'op', op });
    return op.opId;
  }

  private need(cap: Capability): void {
    if (!this.capabilities.includes(cap)) throw new NotCapableError(cap);
  }

  /** Forgets this device's identity on the current Host (used after an authentication failure). */
  resetIdentity(): void {
    this.token = null;
    this.unacked = [];
    this.view = null;
    this.capabilities = [];
    this.persist();
    this.notify();
  }

  /** Ops queued but not yet acknowledged (survives restart). */
  get pendingOps(): readonly Op[] { return this.unacked; }

  resultOf(opId: string): OpResult | undefined { return this.results.get(opId); }

  // ── Host operations ────────────────────────────────────────────────────────

  assignCapabilities(participantId: ParticipantId, capabilities: Capability[]): string {
    this.need('host');
    return this.sendRaw({ kind: 'host.assign_capabilities', participantId, capabilities });
  }

  endSession(): string {
    this.need('host');
    return this.sendRaw({ kind: 'host.end_session' });
  }

  // ── DM operations ──────────────────────────────────────────────────────────

  async selectCampaign(campaignId: string): Promise<string> {
    this.need('dm');
    const prep = await this.cfg.prep?.load(campaignId);
    if (!prep) throw new Error(`No preparation for campaign ${campaignId}`);
    const installedPacks = (await this.cfg.installedPacks?.()) ?? [];
    const policy = toLivePolicyInput(prep, campaignId, prep.name, installedPacks);
    return this.sendRaw({ kind: 'dm.select_campaign', campaignRevision: prep.campaignRevision, policy });
  }

  /** Prepared encounter -> live. Only the public projection leaves the device. */
  async activateEncounter(campaignId: string, prepEncounterId: string): Promise<string> {
    this.need('dm');
    const prep = await this.cfg.prep?.load(campaignId);
    const enc = prep?.encounters.find(e => e.id === prepEncounterId);
    if (!enc) throw new Error(`No prepared encounter ${prepEncounterId}`);
    return this.sendRaw({ kind: 'dm.activate_encounter', encounter: toLiveEncounterInput(enc, this.id('enc')) });
  }

  endEncounter(encounterId: string): string {
    this.need('dm');
    return this.sendRaw({ kind: 'dm.end_encounter', encounterId });
  }

  /** `order` may mix LiveCombatant ids and ParticipantIds — a player's own character takes a
   *  turn in initiative too. No numeric initiative is tracked on the wire; roll/track it at the
   *  table and send the resulting order. */
  setTurnOrder(encounterId: string, order: string[]): string {
    this.need('dm');
    return this.sendRaw({ kind: 'dm.set_turn_order', encounterId, order });
  }

  nextTurn(encounterId: string): string {
    this.need('dm');
    return this.sendRaw({ kind: 'dm.next_turn', encounterId });
  }

  previousTurn(encounterId: string): string {
    this.need('dm');
    return this.sendRaw({ kind: 'dm.previous_turn', encounterId });
  }

  addCombatant(encounterId: string, combatant: { id: string; name: string; hpState?: 'healthy' | 'bloodied' | 'down'; ac?: number }): string {
    this.need('dm');
    return this.sendRaw({ kind: 'dm.add_combatant', encounterId, combatant: { hpState: 'healthy', ...combatant } });
  }

  removeCombatant(encounterId: string, combatantId: string): string {
    this.need('dm');
    return this.sendRaw({ kind: 'dm.remove_combatant', encounterId, combatantId });
  }

  setCombatantHpState(encounterId: string, combatantId: string, hpState: 'healthy' | 'bloodied' | 'down'): string {
    this.need('dm');
    return this.sendRaw({ kind: 'dm.set_combatant_hp', encounterId, combatantId, hpState });
  }

  /** Real numbers, opt-in — see MonsterVisibility's own doc comment for why this stays separate
   *  from the coarse hpState. */
  setCombatantExactHp(encounterId: string, combatantId: string, current: number, max: number): string {
    this.need('dm');
    return this.sendRaw({ kind: 'dm.set_combatant_exact_hp', encounterId, combatantId, current, max });
  }

  /** Per-field reveal state (DM_SCREEN_SPEC.md item 9) — see MonsterVisibility's own doc comment. */
  setCombatantVisibility(encounterId: string, combatantId: string, visibility: MonsterVisibility): string {
    this.need('dm');
    return this.sendRaw({ kind: 'dm.set_combatant_visibility', encounterId, combatantId, visibility });
  }

  /** Prepared effect -> live applications. Secret identity stays in the local vault. */
  async applyPreparedEffect(campaignId: string, prepEffectId: string, targets: ParticipantId[]): Promise<{ opId: string; effectId: string }> {
    this.need('dm');
    const prep = await this.cfg.prep?.load(campaignId);
    const fx = prep?.effects.find(e => e.id === prepEffectId);
    if (!fx) throw new Error(`No prepared effect ${prepEffectId}`);
    const effectId = this.id('fx');
    const { input, secret } = toEffectInput(fx, effectId);
    if (secret && this.cfg.vault) {
      await this.cfg.vault.put(secret);
      this.secretCache[effectId] = secret;
    }
    const opId = this.sendRaw({ kind: 'dm.apply_effect', effect: input, targets });
    return { opId, effectId };
  }

  /**
   * A "Quick Override" (DM_SCREEN_SPEC.md item 12) — a one-off exception the DM builds on the
   * spot, rather than something pre-authored in DM Preparation. Same underlying op as
   * applyPreparedEffect; source is always 'DM Override' so it's visibly distinguishable from a
   * prepared effect. Deliberately public/target only — a Quick Override that needed secret
   * identity would need the SecretVault round-trip applyPreparedEffect uses, which doesn't fit
   * "quick."
   */
  applyQuickEffect(
    input: { name: string; description?: string; visibility: 'public' | 'target'; components: EffectComponent[]; duration: EffectDuration },
    targets: ParticipantId[],
  ): { opId: string; effectId: string } {
    this.need('dm');
    const effectId = this.id('qfx');
    const defInput: EffectDefinitionInput = {
      id: effectId, name: input.name, description: input.description ?? null, source: 'DM Override',
      visibility: input.visibility, components: input.components, duration: input.duration,
    };
    const opId = this.sendRaw({ kind: 'dm.apply_effect', effect: defInput, targets });
    return { opId, effectId };
  }

  markDue(applicationId: string): string {
    this.need('dm');
    return this.sendRaw({ kind: 'dm.mark_due', applicationId });
  }

  tickRounds(rounds: number): string {
    this.need('dm');
    return this.sendRaw({ kind: 'dm.tick_rounds', rounds });
  }

  endEffect(effectId: string, applicationId?: string): string {
    this.need('dm');
    return this.sendRaw({ kind: 'dm.end_effect', effectId, ...(applicationId ? { applicationId } : {}) });
  }

  /** Prepared change template -> live request; captures the CURRENT target revision. */
  async requestChangeFromTemplate(campaignId: string, templateId: string, targetId: ParticipantId): Promise<{ opId: string; requestId: string }> {
    this.need('dm');
    const prep = await this.cfg.prep?.load(campaignId);
    const tpl = prep?.templates.find(t => t.id === templateId);
    if (!tpl) throw new Error(`No prepared change template ${templateId}`);
    return this.requestChange(targetId, tpl.label, tpl.changes);
  }

  requestChange(targetId: ParticipantId, label: string, changes: CharacterChange[]): { opId: string; requestId: string } {
    this.need('dm');
    const requestId = this.id('req');
    const baseRevision = this.view?.characters[targetId]?.revision ?? 0;
    const opId = this.sendRaw({ kind: 'dm.request_change', requestId, targetId, baseRevision, label, changes });
    return { opId, requestId };
  }

  cancelRequest(requestId: string): string {
    this.need('dm');
    return this.sendRaw({ kind: 'dm.cancel_request', requestId });
  }

  /** `dmResponse` is required for 'modify', ignored otherwise. */
  resolveRuleSuggestion(suggestionId: string, decision: 'accept' | 'modify' | 'reject', dmResponse?: string): string {
    this.need('dm');
    return this.sendRaw({ kind: 'dm.resolve_rule_suggestion', suggestionId, decision, ...(dmResponse ? { dmResponse } : {}) });
  }

  /** Effects as the DM sees them, with secret identity joined in from the local vault. */
  dmEffects(): { effectId: string; displayName: string; secret: SecretEffectMeta | null; effect: LiveEffect }[] {
    return Object.entries(this.view?.effects ?? {}).map(([effectId, effect]) => {
      const secret = this.secretCache[effectId] ?? null;
      return { effectId, displayName: secret?.name ?? effect.definition.name ?? effectId, secret, effect };
    });
  }

  // ── Player operations ──────────────────────────────────────────────────────

  respond(requestId: string, decision: 'accept' | 'reject' | 'modify',
    opts: { modified?: CharacterChange[]; acknowledgeStale?: boolean } = {}): string {
    this.need('player');
    if (!this.cfg.character) throw new Error('No character attached to this peer');
    return this.sendRaw({
      kind: 'player.respond', requestId, decision,
      ...(opts.modified ? { modified: opts.modified } : {}),
      currentRevision: this.cfg.character.getRevision(),
      ...(opts.acknowledgeStale ? { acknowledgeStale: true } : {}),
    });
  }

  reportCharacter(): string | null {
    const ch = this.cfg.character;
    if (!ch) return null;
    this.need('player');
    return this.sendRaw({ kind: 'player.report_character', characterId: ch.characterId, revision: ch.getRevision(), summary: ch.summary() });
  }

  pendingRequests(): ChangeRequest[] {
    return Object.values(this.view?.requests ?? {}).filter(r => r.status === 'PENDING' && r.targetId === this.cfg.participantId);
  }

  /** DM_SCREEN_SPEC.md item 5 — Players can suggest campaign-rule changes by default. See
   *  RuleSuggestion's own doc comment for why accepting one doesn't auto-apply anything. */
  suggestRule(rule: string, proposedValue: string, note = ''): string {
    this.need('player');
    const suggestionId = this.id('sug');
    return this.sendRaw({ kind: 'player.suggest_rule', suggestionId, rule, proposedValue, note });
  }

  /** What this player may see about active effects (mechanics only for secret ones). */
  visibleEffects(): { effectId: string; label: string | null; components: LiveEffect['definition']['components']; app: EffectApplication }[] {
    const out: { effectId: string; label: string | null; components: LiveEffect['definition']['components']; app: EffectApplication }[] = [];
    for (const [effectId, eff] of Object.entries(this.view?.effects ?? {})) {
      for (const app of Object.values(eff.applications)) {
        if (app.state === 'ENDED') continue;
        out.push({ effectId, label: eff.definition.name, components: eff.definition.components, app });
      }
    }
    return out;
  }

  /**
   * Applies accepted/modified requests to the real character exactly once, driven
   * by the authoritative record (not by the local click), so crashes and replays
   * can neither lose nor duplicate an application.
   */
  private afterViewChange(): void {
    const ch = this.cfg.character;
    if (!ch || !this.view) return;
    let applied = false;
    for (const r of Object.values(this.view.requests)) {
      if (r.targetId !== this.cfg.participantId) continue;
      if ((r.status !== 'ACCEPTED' && r.status !== 'MODIFIED') || !r.finalApplied) continue;
      if (this.appliedRequests.has(r.id)) continue;
      ch.applyChanges(r.finalApplied, r.id);
      this.appliedRequests.add(r.id);
      applied = true;
    }
    if (applied) {
      this.persist();
      if (this.status === 'connected' && this.capabilities.includes('player')) this.reportCharacter();
    }
  }

  /** For tests / diagnostics. */
  get appliedRequestIds(): string[] { return [...this.appliedRequests]; }

  /** Player-side: call after the character changes for reasons other than requests. */
  characterChanged(): void {
    if (this.status === 'connected') this.reportCharacter();
  }

  /** Sends the initial character report; call once connected. */
  announceCharacter(): void {
    this.reportCharacter();
  }
}
