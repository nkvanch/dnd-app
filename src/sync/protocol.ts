// ============================================================================
// FILE: src/sync/protocol.ts
// Newline-delimited JSON message framing for the TCP sync channel.
//
// Every message is one JSON object followed by '\n'.
// Receivers buffer incoming TCP chunks and split on '\n' to extract messages.
// ============================================================================
import { Entity, SyncEvent, Campaign } from '../engine/types';

// ── Connected player roster entry ──────────────────────────────────────────────

/** A player currently connected to the DM's session. */
export type ConnectedPlayer = {
  deviceId:    string;
  nickname:    string;
  characterId: string | null;   // which character they're controlling, if any
};

// ── Message union type ────────────────────────────────────────────────────────

/** A lightweight snapshot of "whose turn is it right now" — deliberately NOT
 *  the DM's full CombatState (initiative order, per-entry details): players
 *  only need enough to show a live turn banner (round counter, current
 *  actor's name, and their own device's id to detect "it's my turn"), not
 *  the whole encounter roster. See combatStore.ts's broadcastTurn(). */
export type CombatTurnState = {
  active:          boolean;
  round:           number;
  currentEntityId: string | null;
  currentName:     string | null;
};

export type SyncMessage =
  | { type: 'ping' }
  | { type: 'pong' }
  | { type: 'hello';          deviceId: string; nickname: string; characterId: string | null }
  | { type: 'welcome';        campaignId: string; sessionId: string }
  | { type: 'sync_event';     event: SyncEvent }
  | { type: 'request_entity'; entityId: string }
  | { type: 'entity_snapshot'; entity: Entity }
  | { type: 'entity_patch';   entityId: string; patch: Record<string, unknown> }
  // DM-only, one-way (players never author Campaign edits) — pushed on
  // 'hello' so a newly-joined/reconnected player's local Campaign record
  // (previously a permanent join-time placeholder, see joinCampaign's own
  // doc comment) gets the DM's real name/rules/notes/quests/session log,
  // and again as a patch whenever the DM edits it (audit finding
  // CAMPAIGN-SYNC-1). Mirrors entity_snapshot/entity_patch's exact shape.
  | { type: 'campaign_snapshot'; campaign: Campaign }
  | { type: 'campaign_patch';   campaignId: string; patch: Record<string, unknown> }
  | { type: 'claim_character'; characterId: string | null }
  | ({ type: 'combat_turn_state' } & CombatTurnState)
  | { type: 'error';          message: string };

// ── Framing helpers ───────────────────────────────────────────────────────────

/** Serialise a message to a newline-terminated JSON string ready for TCP send. */
export function encodeMessage(msg: SyncMessage): string {
  return JSON.stringify(msg) + '\n';
}

/**
 * Parse a raw TCP data buffer into complete messages.
 *
 * Returns:
 *   messages  — zero or more fully-received messages (in order)
 *   remainder — any trailing bytes that did not form a complete line yet;
 *               the caller must prepend this to the next received chunk.
 */
export function parseBuffer(buffer: string): {
  messages:  SyncMessage[];
  remainder: string;
} {
  const lines = buffer.split('\n');
  // The last element is either empty (buffer ended with '\n') or a partial line.
  const remainder = lines.pop() ?? '';

  const messages: SyncMessage[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      messages.push(JSON.parse(trimmed) as SyncMessage);
    } catch {
      console.warn('[sync] Malformed message dropped:', trimmed.slice(0, 120));
    }
  }

  return { messages, remainder };
}
