// src/components/sheet/__tests__/CharacterHistoryModal.test.ts
// Item 17 (timeline improvements) — tests groupBySession directly (pure
// logic), matching this codebase's established preference over rendering
// the RN component. Session grouping is entirely derived from comparing
// each timeline entry's timestamp against each session's
// [startedAt, endedAt] range — no schema change to character_timeline.
import { groupBySession } from '../CharacterHistoryModal';
import { TimelineEntry } from '../../../db/timelineRepo';
import { SessionLogEntry } from '../../../engine/types';

function entry(id: number, timestamp: number, label = `entry${id}`): TimelineEntry {
  return { id, entityId: 'e1', label, timestamp, category: null };
}

function session(id: string, startedAt: number, endedAt?: number): SessionLogEntry {
  return { id, summary: '', date: startedAt, startedAt, endedAt };
}

describe('groupBySession', () => {
  it('returns a single ungrouped bucket when sessionLog is empty', () => {
    const entries = [entry(1, 100), entry(2, 200)];
    const groups = groupBySession(entries, []);
    expect(groups).toHaveLength(1);
    expect(groups[0].title).toBe('');
    expect(groups[0].entries).toEqual(entries);
  });

  it('returns a single ungrouped bucket when no session has startedAt set (pre-item-14 notes only)', () => {
    const entries = [entry(1, 100)];
    const log: SessionLogEntry[] = [{ id: 's1', summary: 'Old note', date: 50 }];
    const groups = groupBySession(entries, log);
    expect(groups).toHaveLength(1);
    expect(groups[0].title).toBe('');
  });

  it('buckets an entry into the session whose range contains its timestamp', () => {
    const s1 = session('s1', 100, 200);
    const entries = [entry(1, 150)];
    const groups = groupBySession(entries, [s1]);
    expect(groups).toHaveLength(1);
    expect(groups[0].title).toBe('Session 1');
    expect(groups[0].entries.map(e => e.id)).toEqual([1]);
  });

  it('numbers sessions oldest-first (Session 1 = earliest) but renders newest session first', () => {
    const older = session('older', 100, 200);
    const newer = session('newer', 300, 400);
    const entries = [entry(1, 150), entry(2, 350)];
    const groups = groupBySession(entries, [newer, older]); // newest-first input, like sessionLog itself
    expect(groups.map(g => g.title)).toEqual(['Session 2', 'Session 1']);
    expect(groups[0].entries.map(e => e.id)).toEqual([2]);
    expect(groups[1].entries.map(e => e.id)).toEqual([1]);
  });

  it('an entry after the active (open-ended) session\'s start falls into that session', () => {
    const active = session('active', 1000); // no endedAt — still running
    const entries = [entry(1, 1500)];
    const groups = groupBySession(entries, [active]);
    expect(groups[0].title).toBe('Session 1');
  });

  it('an entry with no matching session range falls into "Outside a session"', () => {
    const s1 = session('s1', 100, 200);
    const entries = [entry(1, 50)]; // before the only session started
    const groups = groupBySession(entries, [s1]);
    expect(groups).toHaveLength(1);
    expect(groups[0].title).toBe('Outside a session');
    expect(groups[0].entries.map(e => e.id)).toEqual([1]);
  });

  it('a session with zero matching entries produces no empty group', () => {
    const s1 = session('s1', 100, 200);
    const s2 = session('s2', 300, 400);
    const entries = [entry(1, 150)]; // only in s1's range
    const groups = groupBySession(entries, [s2, s1]);
    expect(groups.map(g => g.title)).toEqual(['Session 1']);
  });

  it('a later session\'s start correctly cuts off an earlier session\'s stale/unbounded range', () => {
    // Simulates a session that never got endSession() called (DM forgot) —
    // its range would otherwise swallow everything after it forever.
    const stale = session('stale', 100); // never ended
    const next = session('next', 500, 600);
    const entries = [entry(1, 300), entry(2, 550)];
    const groups = groupBySession(entries, [next, stale]);
    const bySessionTitle = new Map(groups.map(g => [g.title, g.entries.map(e => e.id)]));
    expect(bySessionTitle.get('Session 1')).toEqual([1]); // stale session only gets the entry before "next" started
    expect(bySessionTitle.get('Session 2')).toEqual([2]);
  });
});
