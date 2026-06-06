// ============================================================================
// FILE: src/sync/protocol.ts
// Newline-delimited JSON message framing for the TCP sync channel.
//
// Every message is one JSON object followed by '\n'.
// Receivers buffer incoming TCP chunks and split on '\n' to extract messages.
// ============================================================================
import { Entity, SyncEvent } from '../engine/types';

// ── Message union type ────────────────────────────────────────────────────────

export type SyncMessage =
  | { type: 'ping' }
  | { type: 'pong' }
  | { type: 'hello';          deviceId: string; nickname: string }
  | { type: 'welcome';        campaignId: string; sessionId: string }
  | { type: 'sync_event';     event: SyncEvent }
  | { type: 'request_entity'; entityId: string }
  | { type: 'entity_snapshot'; entity: Entity }
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
