// ============================================================================
// FILE: src/session/state.ts
// The ONE reducer for live-session state (used by the Host on canonical events
// and by every replica on projected events) plus the per-viewer projections.
// Pure: no I/O, no clocks, no randomness.
// ============================================================================
import {
  Capability, ParticipantId, LiveState, LiveEvent, ViewState, AuditEntry,
  EffectApplication, LiveEffect, PublicParticipant,
} from './types';

// ── Viewers ──────────────────────────────────────────────────────────────────

export type Viewer = { id: ParticipantId; capabilities: Capability[] };
export type ViewLevel = 'dm' | 'player' | 'host';

/** dm > player > host. A participant that is only Host gets the smallest view. */
export function viewLevel(v: Viewer): ViewLevel {
  if (v.capabilities.includes('dm')) return 'dm';
  if (v.capabilities.includes('player')) return 'player';
  return 'host';
}

// ── Reducer ──────────────────────────────────────────────────────────────────

function clone<T>(x: T): T {
  return JSON.parse(JSON.stringify(x)) as T;
}

function findApplication(
  effects: Record<string, LiveEffect>, applicationId: string,
): { effect: LiveEffect; app: EffectApplication } | null {
  for (const effect of Object.values(effects)) {
    const app = effect.applications[applicationId];
    if (app) return { effect, app };
  }
  return null;
}

/** Applies one event. Tolerates entities the viewer never saw (projected events). */
export function applyEvent(prev: LiveState, ev: LiveEvent): LiveState {
  const s = clone(prev);
  const b = ev.body;
  switch (b.t) {
    case 'participant_upsert':
      s.participants[b.participant.id] = b.participant;
      break;
    case 'campaign_linked':
      s.campaign = b.policy;
      break;
    case 'encounter_activated':
      s.encounters[b.encounter.id] = { ...b.encounter, active: true };
      break;
    case 'encounter_ended': {
      const enc = s.encounters[b.encounterId];
      if (enc) enc.active = false;
      break;
    }
    case 'turn_order_set': {
      const enc = s.encounters[b.encounterId];
      if (enc) enc.turnOrder = b.order;
      break;
    }
    case 'turn_advanced': {
      const enc = s.encounters[b.encounterId];
      if (enc) { enc.currentTurnIndex = b.currentTurnIndex; enc.round = b.round; }
      break;
    }
    case 'combatant_added': {
      const enc = s.encounters[b.encounterId];
      if (enc) enc.combatants.push(b.combatant);
      break;
    }
    case 'combatant_removed': {
      const enc = s.encounters[b.encounterId];
      if (enc) {
        enc.combatants = enc.combatants.filter(c => c.id !== b.combatantId);
        const removedIdx = enc.turnOrder.indexOf(b.combatantId);
        enc.turnOrder = enc.turnOrder.filter(id => id !== b.combatantId);
        // Keep "whose turn it is" stable across the removal: an entry before the current turn
        // shifts the index down by one; removing the current turn's own entry leaves the index
        // pointing at what now occupies that slot (the next combatant), same as advancing.
        if (enc.currentTurnIndex !== null && removedIdx !== -1 && removedIdx < enc.currentTurnIndex) {
          enc.currentTurnIndex -= 1;
        }
        if (enc.turnOrder.length === 0) enc.currentTurnIndex = null;
        else if (enc.currentTurnIndex !== null) enc.currentTurnIndex = Math.min(enc.currentTurnIndex, enc.turnOrder.length - 1);
      }
      break;
    }
    case 'combatant_hp_state_set': {
      const enc = s.encounters[b.encounterId];
      const c = enc?.combatants.find(x => x.id === b.combatantId);
      if (c) c.hpState = b.hpState;
      break;
    }
    case 'effect_applied': {
      const existing = s.effects[b.definition.id];
      const applications: Record<string, EffectApplication> = existing ? { ...existing.applications } : {};
      for (const a of b.applications) applications[a.id] = a;
      s.effects[b.definition.id] = { definition: b.definition, applications };
      break;
    }
    case 'applications_due': {
      for (const id of b.applicationIds) {
        const hit = findApplication(s.effects, id);
        if (hit && hit.app.state === 'ACTIVE') hit.app.state = 'DUE_TO_END';
      }
      for (const t of b.ticked ?? []) {
        const hit = findApplication(s.effects, t.applicationId);
        if (hit) hit.app.remaining = t.remaining;
      }
      break;
    }
    case 'applications_ended': {
      for (const id of b.applicationIds) {
        const hit = findApplication(s.effects, id);
        if (hit && hit.app.state !== 'ENDED') {
          hit.app.state = 'ENDED';
          hit.app.endedAtRevision = ev.revision;
        }
      }
      break;
    }
    case 'request_created':
      s.requests[b.request.id] = b.request;
      break;
    case 'request_resolved': {
      const r = s.requests[b.requestId];
      if (r) {
        r.status = b.status;
        r.finalApplied = b.finalApplied;
        r.playerModified = b.playerModified;
        r.acknowledgedStale = b.acknowledgedStale;
        r.resolvedAtRevision = ev.revision;
        r.staleAgainst = null;
      }
      break;
    }
    case 'request_stale_flag': {
      const r = s.requests[b.requestId];
      if (r) r.staleAgainst = b.staleAgainst;
      break;
    }
    case 'rule_suggestion_created':
      s.ruleSuggestions[b.suggestion.id] = b.suggestion;
      break;
    case 'rule_suggestion_resolved': {
      const sug = s.ruleSuggestions[b.suggestionId];
      if (sug) {
        sug.status = b.status;
        sug.dmResponse = b.dmResponse;
        sug.resolvedAtRevision = ev.revision;
      }
      break;
    }
    case 'character_reported':
      s.characters[b.character.participantId] = b.character;
      break;
    case 'session_ended':
      s.ended = true;
      break;
  }
  s.revision = ev.revision;
  if (ev.audit) s.audit.push(ev.audit);
  return s;
}

// ── Projection helpers ───────────────────────────────────────────────────────

/** A Host-only viewer sees session bookkeeping only, never gameplay history. */
const HOST_AUDIT_KINDS = new Set(['participant', 'roles', 'session', 'campaign']);

function auditVisible(a: AuditEntry, viewer: Viewer): boolean {
  const level = viewLevel(viewer);
  if (level === 'dm') return true;
  if (level === 'host') return a.scope === 'all' && HOST_AUDIT_KINDS.has(a.kind);
  if (a.scope === 'all') return true;
  if (a.scope === 'participants') return level === 'player' && (a.participantIds ?? []).includes(viewer.id);
  return false;
}

function appVisibleToPlayer(effect: LiveEffect, app: EffectApplication, viewer: Viewer): boolean {
  if (effect.definition.visibility === 'public') return true;
  return app.targetId === viewer.id;
}

function effectForPlayer(effect: LiveEffect, viewer: Viewer): LiveEffect | null {
  const applications: Record<string, EffectApplication> = {};
  for (const [id, app] of Object.entries(effect.applications)) {
    if (appVisibleToPlayer(effect, app, viewer)) applications[id] = app;
  }
  if (Object.keys(applications).length === 0) return null;
  const def = effect.definition;
  // Secret effects: the Host never had identity, but sanitize defensively so a
  // buggy or malicious upstream can never leak through this projection.
  const definition = def.visibility === 'secret'
    ? { ...def, name: null, description: null, source: null }
    : def;
  return { definition, applications };
}

/** The complete state a viewer is entitled to see. */
export function projectState(state: LiveState, viewer: Viewer): ViewState {
  const level = viewLevel(viewer);
  const out: ViewState = {
    sessionId: state.sessionId, roomName: state.roomName, maxParticipants: state.maxParticipants,
    revision: state.revision, ended: state.ended,
    participants: clone(state.participants), campaign: state.campaign ? { ...state.campaign } : null,
    encounters: {}, effects: {}, requests: {}, ruleSuggestions: {}, characters: {},
    audit: state.audit.filter(a => auditVisible(a, viewer)).map(a => clone(a)),
  };
  if (level === 'dm') {
    out.encounters = clone(state.encounters);
    out.effects = clone(state.effects);
    out.requests = clone(state.requests);
    out.ruleSuggestions = clone(state.ruleSuggestions);
    out.characters = clone(state.characters);
  } else if (level === 'player') {
    out.encounters = clone(state.encounters);
    for (const [id, eff] of Object.entries(state.effects)) {
      const e = effectForPlayer(eff, viewer);
      if (e) out.effects[id] = clone(e);
    }
    for (const [id, r] of Object.entries(state.requests)) {
      if (r.targetId === viewer.id) out.requests[id] = clone(r);
    }
    for (const [id, s] of Object.entries(state.ruleSuggestions)) {
      if (s.playerId === viewer.id) out.ruleSuggestions[id] = clone(s);
    }
    const own = state.characters[viewer.id];
    if (own) out.characters[viewer.id] = clone(own);
  }
  return out;
}

/**
 * The viewer-specific form of a canonical event, or null when the viewer must
 * not learn its content (they still receive a revision tick so gap detection
 * keeps working). `after` is the canonical state AFTER the event.
 */
export function projectEvent(after: LiveState, ev: LiveEvent, viewer: Viewer): LiveEvent | null {
  const level = viewLevel(viewer);
  const audit = ev.audit && auditVisible(ev.audit, viewer) ? ev.audit : null;
  const keep = (body: LiveEvent['body']): LiveEvent => ({ ...ev, body, audit });
  const b = ev.body;

  switch (b.t) {
    case 'participant_upsert':
    case 'campaign_linked':
    case 'session_ended':
      return keep(b);

    case 'encounter_activated':
    case 'encounter_ended':
    case 'turn_order_set':
    case 'turn_advanced':
    case 'combatant_added':
    case 'combatant_removed':
    case 'combatant_hp_state_set':
      return level === 'host' ? null : keep(b);

    case 'effect_applied': {
      if (level === 'host') return null;
      if (level === 'dm') return keep(b);
      const apps = b.applications.filter(a =>
        b.definition.visibility === 'public' || a.targetId === viewer.id);
      if (apps.length === 0) return null;
      const definition = b.definition.visibility === 'secret'
        ? { ...b.definition, name: null, description: null, source: null }
        : b.definition;
      return keep({ t: 'effect_applied', definition, applications: apps });
    }

    case 'applications_due':
    case 'applications_ended': {
      if (level === 'host') return null;
      if (level === 'dm') return keep(b);
      const visible = new Set<string>();
      for (const eff of Object.values(after.effects)) {
        for (const [id, app] of Object.entries(eff.applications)) {
          if (appVisibleToPlayer(eff, app, viewer)) visible.add(id);
        }
      }
      const ids = b.applicationIds.filter(id => visible.has(id));
      if (b.t === 'applications_due') {
        const ticked = (b.ticked ?? []).filter(t => visible.has(t.applicationId));
        if (ids.length === 0 && ticked.length === 0) return null;
        return keep({ t: 'applications_due', applicationIds: ids, ticked });
      }
      if (ids.length === 0) return null;
      return keep({ t: 'applications_ended', applicationIds: ids });
    }

    case 'request_created':
      if (level === 'host') return null;
      if (level === 'dm' || b.request.targetId === viewer.id) return keep(b);
      return null;

    case 'request_resolved':
    case 'request_stale_flag': {
      if (level === 'host') return null;
      if (level === 'dm') return keep(b);
      const req = after.requests[b.requestId];
      return req && req.targetId === viewer.id ? keep(b) : null;
    }

    case 'rule_suggestion_created':
      if (level === 'host') return null;
      if (level === 'dm' || b.suggestion.playerId === viewer.id) return keep(b);
      return null;

    case 'rule_suggestion_resolved': {
      if (level === 'host') return null;
      if (level === 'dm') return keep(b);
      const sug = after.ruleSuggestions[b.suggestionId];
      return sug && sug.playerId === viewer.id ? keep(b) : null;
    }

    case 'character_reported':
      if (level === 'host') return null;
      if (level === 'dm' || b.character.participantId === viewer.id) return keep(b);
      return null;
  }
}

/** Convenience for tests and UI. */
export function publicParticipants(view: ViewState): PublicParticipant[] {
  return Object.values(view.participants);
}
