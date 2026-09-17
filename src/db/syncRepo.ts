// ============================================================================
// FILE: src/db/syncRepo.ts
// Sync event queue — local buffer for offline-first mutations.
//
// Every state mutation emits a SyncEvent stored here with applied=false.
// When the device is online, unflushed events are sent to peers.
// On reconnect, all applied=false events are replayed in timestamp order.
// ============================================================================
import { Platform } from 'react-native';
import { SyncEvent } from '../engine/types';
import { getDb } from './db';

type SyncEventRow = {
  id:             string;
  sessionId:      string;
  entityId:       string;
  changeType:     string;
  payload:        string;
  authorDeviceId: string;
  timestamp:      number;
  applied:        number; // 0 | 1
};

/** Persist a new sync event (applied = false). */
export async function queueSyncEvent(event: SyncEvent): Promise<void> {
  if (Platform.OS === 'web') return;
  const db = getDb();
  await db.runAsync(
    `INSERT INTO sync_events
       (id, sessionId, entityId, changeType, payload, authorDeviceId, timestamp, applied)
     VALUES (?, ?, ?, ?, ?, ?, ?, 0)`,
    [
      event.id,
      event.sessionId,
      event.entityId,
      event.changeType,
      JSON.stringify(event.payload),
      event.authorDeviceId,
      event.timestamp,
    ]
  );
}

/**
 * Return all unapplied events for a session, sorted oldest-first
 * so they can be replayed in correct order on reconnect.
 */
export async function getUnflushedEvents(sessionId: string): Promise<SyncEvent[]> {
  if (Platform.OS === 'web') return [];
  const db   = getDb();
  const rows = await db.getAllAsync<SyncEventRow>(
    `SELECT * FROM sync_events
     WHERE sessionId = ? AND applied = 0
     ORDER BY timestamp ASC`,
    [sessionId]
  );
  // A single malformed payload (e.g. a half-write from an app kill mid-
  // queueSyncEvent) used to throw here unguarded — since this row is never
  // marked applied, every future call permanently fails before it even
  // reaches the healthy rows after it, stalling this device's entire
  // outbound queue. The malformed row's own data is unrecoverable either
  // way, so it's marked applied (removed from the pending queue) instead of
  // being retried forever — every other event still flushes normally.
  const events: SyncEvent[] = [];
  for (const row of rows) {
    try {
      events.push(rowToEvent(row));
    } catch (e) {
      console.error(`[syncRepo] skipping unrecoverable sync_events row id=${row.id}, marking applied so it doesn't block the queue:`, e);
      await markEventApplied(row.id).catch(err =>
        console.error(`[syncRepo] failed to mark malformed row ${row.id} applied:`, err)
      );
    }
  }
  return events;
}

/** Mark a single event as applied (flushed to peers). */
export async function markEventApplied(eventId: string): Promise<void> {
  if (Platform.OS === 'web') return;
  const db = getDb();
  await db.runAsync(
    'UPDATE sync_events SET applied = 1 WHERE id = ?',
    [eventId]
  );
}

/** Mark all unapplied events for a session as applied in bulk. */
export async function markAllEventsApplied(sessionId: string): Promise<void> {
  if (Platform.OS === 'web') return;
  const db = getDb();
  await db.runAsync(
    'UPDATE sync_events SET applied = 1 WHERE sessionId = ? AND applied = 0',
    [sessionId]
  );
}

/** Purge applied events older than cutoffTimestamp (housekeeping). */
export async function pruneAppliedEvents(cutoffTimestamp: number): Promise<void> {
  if (Platform.OS === 'web') return;
  const db = getDb();
  await db.runAsync(
    'DELETE FROM sync_events WHERE applied = 1 AND timestamp < ?',
    [cutoffTimestamp]
  );
}

function rowToEvent(row: SyncEventRow): SyncEvent {
  return {
    id:             row.id,
    sessionId:      row.sessionId,
    entityId:       row.entityId,
    changeType:     row.changeType as SyncEvent['changeType'],
    payload:        JSON.parse(row.payload),
    authorDeviceId: row.authorDeviceId,
    timestamp:      row.timestamp,
    applied:        row.applied === 1,
  };
}
