// ============================================================================
// FILE: src/db/timelineRepo.ts
// CRUD for the persistent mechanical timeline (character_timeline table) —
// mirrors contentCacheRepo.ts's append-only history pattern: insert only,
// never delete, never overwrite, newest-first query.
// ============================================================================
import { Platform } from 'react-native';
import { getDb } from './db';

/**
 * A-63: closed set of coarse buckets for filtering a character's timeline
 * — matches this app's existing "closed union, not open string" pattern
 * (Effect.type, IssueCode, etc.). The `category` column has existed since
 * Phase B of the undo/redo track, but no caller ever passed one until now
 * — every stored entry's category was NULL. Old rows stay NULL (shown
 * under "Other" in the filter, never crash) rather than being
 * backfilled — there's no reliable way to infer a past entry's category
 * from its label text alone.
 */
export type TimelineCategory =
  | 'combat' | 'rest' | 'inventory' | 'spells' | 'leveling' | 'features' | 'ruleset' | 'other';

export type TimelineEntry = {
  id:        number;
  entityId:  string;
  label:     string;
  timestamp: number;
  category:  string | null;
};

type TimelineRow = {
  id:        number;
  entityId:  string;
  label:     string;
  timestamp: number;
  category:  string | null;
};

/**
 * Records one timeline entry. Fire-and-forget from the caller's
 * perspective (characterStore.ts's updateCharacter doesn't await this,
 * same non-blocking style scheduleSave already uses for the debounced
 * entity persist) — a failure here logs and is otherwise swallowed, never
 * blocking or corrupting the character mutation it's recording.
 */
export async function recordTimelineEntry(
  entityId: string,
  label:    string,
  timestamp: number,
  category?: TimelineCategory,
): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    const db = getDb();
    await db.runAsync(
      'INSERT INTO character_timeline (entityId, label, timestamp, category) VALUES (?, ?, ?, ?)',
      [entityId, label, timestamp, category ?? null]
    );
  } catch (e) {
    console.error('[timelineRepo] recordTimelineEntry failed:', e);
  }
}

/** A character's full timeline, newest first. Read-only — there is no
 *  restore-from-timeline action (see the plan's own reasoning: undo/redo
 *  already covers "step back a few actions"; restoring an ARBITRARY past
 *  snapshot is a separate, bigger, deliberately-deferred feature). */
export async function loadTimeline(entityId: string): Promise<TimelineEntry[]> {
  if (Platform.OS === 'web') return [];
  try {
    const db = getDb();
    const rows = await db.getAllAsync<TimelineRow>(
      'SELECT * FROM character_timeline WHERE entityId = ? ORDER BY id DESC',
      [entityId]
    );
    return rows;
  } catch (e) {
    console.error('[timelineRepo] loadTimeline failed:', e);
    return [];
  }
}
