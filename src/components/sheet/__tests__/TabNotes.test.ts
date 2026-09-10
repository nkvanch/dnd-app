// src/components/sheet/__tests__/TabNotes.test.ts
// Item 20 (QoL) — last-edited timestamps, added to the pre-existing
// notes JSON blob with no schema migration. Tests parseNotes/timeAgo
// directly (pure logic), matching this codebase's established preference
// over rendering the RN component.
import { parseNotes, timeAgo } from '../TabNotes';

describe('parseNotes', () => {
  it('parses all three fields plus their timestamps from a full JSON blob', () => {
    const raw = JSON.stringify({
      backstory: 'A', sessionNotes: 'B', personalNotes: 'C',
      backstoryUpdatedAt: 100, sessionNotesUpdatedAt: 200, personalNotesUpdatedAt: 300,
    });
    expect(parseNotes(raw)).toEqual({
      backstory: 'A', sessionNotes: 'B', personalNotes: 'C',
      backstoryUpdatedAt: 100, sessionNotesUpdatedAt: 200, personalNotesUpdatedAt: 300,
    });
  });

  it('defaults missing fields to empty strings and undefined timestamps (pre-item-20 saved notes)', () => {
    const raw = JSON.stringify({ backstory: 'Old note' });
    const parsed = parseNotes(raw);
    expect(parsed.backstory).toBe('Old note');
    expect(parsed.sessionNotes).toBe('');
    expect(parsed.personalNotes).toBe('');
    expect(parsed.backstoryUpdatedAt).toBeUndefined();
  });

  it('treats unparseable input as a legacy plain-text backstory (pre-JSON notes)', () => {
    const parsed = parseNotes('Just some old plain text notes');
    expect(parsed.backstory).toBe('Just some old plain text notes');
    expect(parsed.sessionNotes).toBe('');
    expect(parsed.personalNotes).toBe('');
  });

  it('treats an empty string as unparseable and falls back the same way', () => {
    const parsed = parseNotes('');
    expect(parsed.backstory).toBe('');
    expect(parsed.sessionNotes).toBe('');
  });
});

describe('timeAgo', () => {
  const NOW = 1_700_000_000_000;
  beforeEach(() => jest.spyOn(Date, 'now').mockReturnValue(NOW));
  afterEach(() => jest.restoreAllMocks());

  it('reports "just now" for under a minute', () => {
    expect(timeAgo(NOW - 30_000)).toBe('just now');
  });

  it('reports whole minutes under an hour', () => {
    expect(timeAgo(NOW - 5 * 60_000)).toBe('5m ago');
    expect(timeAgo(NOW - 59 * 60_000)).toBe('59m ago');
  });

  it('reports whole hours under a day', () => {
    expect(timeAgo(NOW - 60 * 60_000)).toBe('1h ago');
    expect(timeAgo(NOW - 23 * 60 * 60_000)).toBe('23h ago');
  });

  it('reports whole days at 24h and beyond', () => {
    expect(timeAgo(NOW - 24 * 60 * 60_000)).toBe('1d ago');
    expect(timeAgo(NOW - 3 * 24 * 60 * 60_000)).toBe('3d ago');
  });
});
