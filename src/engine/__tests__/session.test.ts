// src/engine/__tests__/session.test.ts
// Item 14 (Sessions). A session is "active" precisely when the newest
// Campaign.sessionLog entry has startedAt set but no endedAt — no separate
// activeSessionId field, so these tests focus on that derivation plus the
// start/end lifecycle's no-op-when-already-in-that-state guards.
import { activeSession, startSession, endSession } from '../session';
import { DEFAULT_RULES } from '../../store/characterStore';
import { Campaign, SessionLogEntry } from '../types';

function makeCampaign(overrides: Partial<Campaign> = {}): Campaign {
  return {
    id: 'camp1', name: 'Test Campaign', dmDeviceId: 'dm-device', joinCode: 'ABC1234',
    rules: { ...DEFAULT_RULES }, playerIds: [], characterIds: ['c1', 'c2'], notes: '', createdAt: 0,
    ...overrides,
  };
}

describe('activeSession', () => {
  it('is null when there is no session log at all', () => {
    expect(activeSession(makeCampaign())).toBeNull();
  });

  it('is null when the newest entry is a plain summary-only note (no startedAt) — pre-item-14 entries', () => {
    const log: SessionLogEntry[] = [{ id: 'a', summary: 'Old-style note', date: 100 }];
    expect(activeSession(makeCampaign({ sessionLog: log }))).toBeNull();
  });

  it('is null when the newest entry has already ended', () => {
    const log: SessionLogEntry[] = [{ id: 'a', summary: 'x', date: 100, startedAt: 100, endedAt: 200 }];
    expect(activeSession(makeCampaign({ sessionLog: log }))).toBeNull();
  });

  it('is the newest entry when it has startedAt but no endedAt', () => {
    const log: SessionLogEntry[] = [
      { id: 'newest', summary: '', date: 200, startedAt: 200 },
      { id: 'older', summary: 'x', date: 100, startedAt: 100, endedAt: 150 },
    ];
    expect(activeSession(makeCampaign({ sessionLog: log }))?.id).toBe('newest');
  });
});

describe('startSession', () => {
  it('prepends a new entry with startedAt set and an attendance snapshot of characterIds', () => {
    const campaign = makeCampaign();
    const after = startSession(campaign);
    expect(after.sessionLog).toHaveLength(1);
    const entry = after.sessionLog![0];
    expect(entry.startedAt).toBeGreaterThan(0);
    expect(entry.endedAt).toBeUndefined();
    expect(entry.attendedCharacterIds).toEqual(['c1', 'c2']);
    expect(entry.summary).toBe('');
  });

  it('is a no-op when a session is already active — does not start a second one', () => {
    const campaign = startSession(makeCampaign());
    const after = startSession(campaign);
    expect(after).toBe(campaign);
    expect(after.sessionLog).toHaveLength(1);
  });

  it('prepends onto an existing log rather than replacing it', () => {
    const priorEntry: SessionLogEntry = { id: 'old', summary: 'Previous session', date: 50, startedAt: 50, endedAt: 60 };
    const campaign = makeCampaign({ sessionLog: [priorEntry] });
    const after = startSession(campaign);
    expect(after.sessionLog).toHaveLength(2);
    expect(after.sessionLog![1]).toBe(priorEntry);
  });
});

describe('endSession', () => {
  it('is a no-op when no session is active', () => {
    const campaign = makeCampaign();
    expect(endSession(campaign, 'summary')).toBe(campaign);
  });

  it('stamps endedAt and sets the summary on the active entry', () => {
    const campaign = startSession(makeCampaign());
    const after = endSession(campaign, 'We fought a dragon.');
    const entry = after.sessionLog![0];
    expect(entry.endedAt).toBeGreaterThan(0);
    expect(entry.summary).toBe('We fought a dragon.');
  });

  it('trims the summary and does not overwrite an existing summary with a blank one', () => {
    let campaign = startSession(makeCampaign());
    campaign = {
      ...campaign,
      sessionLog: campaign.sessionLog!.map(e => ({ ...e, summary: 'Mid-session note' })),
    };
    const after = endSession(campaign, '   ');
    expect(after.sessionLog![0].summary).toBe('Mid-session note');
  });

  it('only stamps the active entry, leaving other log entries untouched', () => {
    const oldEntry: SessionLogEntry = { id: 'old', summary: 'Prior', date: 50, startedAt: 50, endedAt: 60 };
    const campaign = startSession(makeCampaign({ sessionLog: [oldEntry] }));
    const after = endSession(campaign, 'New summary');
    expect(after.sessionLog![1]).toBe(oldEntry);
    expect(after.sessionLog![0].summary).toBe('New summary');
  });
});
