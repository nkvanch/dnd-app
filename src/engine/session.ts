// ============================================================================
// FILE: src/engine/session.ts
// Item 14 (Sessions) — real-world play-session lifecycle, built on top of
// the already-shipped Campaign.sessionLog free-text log rather than
// replacing it. A session is "active" precisely when the newest log entry
// has startedAt set but no endedAt — see SessionLogEntry's own doc comment
// in engine/types.ts for why this is the one source of truth instead of a
// separate Campaign.activeSessionId field.
// ============================================================================
import { Campaign, SessionLogEntry } from './types';

function genId(): string {
  return `sess_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/** The currently-running session's log entry, or null if none is active. */
export function activeSession(campaign: Campaign): SessionLogEntry | null {
  const newest = (campaign.sessionLog ?? [])[0];
  return newest && newest.startedAt !== undefined && newest.endedAt === undefined ? newest : null;
}

/** Starts a new session: a fresh SessionLogEntry with startedAt set and an
 *  attendance snapshot of the campaign's current roster, prepended to the
 *  log. No-op (returns the campaign unchanged) if a session is already
 *  active — starting a second one instead of ending the first would leave
 *  the first's endedAt permanently unset. */
export function startSession(campaign: Campaign): Campaign {
  if (activeSession(campaign)) return campaign;
  const entry: SessionLogEntry = {
    id: genId(), summary: '', date: Date.now(),
    startedAt: Date.now(), attendedCharacterIds: [...campaign.characterIds],
  };
  return { ...campaign, sessionLog: [entry, ...(campaign.sessionLog ?? [])] };
}

/** Ends the active session, stamping endedAt and setting its summary (blank
 *  summary leaves whatever was already there, e.g. from manual mid-session
 *  edits — never overwrites real content with nothing). No-op if no
 *  session is currently active. */
export function endSession(campaign: Campaign, summary: string): Campaign {
  const active = activeSession(campaign);
  if (!active) return campaign;
  const trimmed = summary.trim();
  return {
    ...campaign,
    sessionLog: (campaign.sessionLog ?? []).map(e =>
      e.id === active.id ? { ...e, endedAt: Date.now(), summary: trimmed || e.summary } : e
    ),
  };
}
