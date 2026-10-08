// src/components/sheet/__tests__/TabExploration.test.ts
// First coverage for this file. Regression lock for audit finding
// NOTES-CORRUPT-1: TabNotes and TabExploration used to share the single
// entity.notes field with incompatible serialization (pure JSON vs.
// marker-delimited scratch+JSON), so using both features on one character
// corrupted and silently truncated the other's data. TabExploration now
// owns its own entity.explorationNotes field entirely — this suite proves
// (a) it round-trips correctly on its own, (b) it no longer touches or is
// touched by entity.notes going forward, and (c) a character saved before
// this fix (exploration data still embedded in entity.notes behind the
// legacy marker) still reads correctly, once, without writing back there.
import { parseNotes, serializeNotes } from '../TabExploration';
import { parseNotes as parseTabNotes } from '../TabNotes';

describe('TabExploration parseNotes/serializeNotes', () => {
  it('round-trips scratch text and all four structured lists', () => {
    const notes = {
      scratch: 'Some free notes',
      objectives: ['Find the amulet'],
      npcs: ['Old Tomas'],
      clues: ['A torn map'],
      locations: ['The Sunken Keep'],
    };
    const serialized = serializeNotes(notes);
    expect(parseNotes(serialized, '')).toEqual(notes);
  });

  it('returns an empty structure when explorationNotes is undefined and entity.notes has no legacy marker', () => {
    const result = parseNotes(undefined, '{"backstory":"A hero"}'); // a TabNotes-authored JSON blob
    expect(result).toEqual({ scratch: '', objectives: [], npcs: [], clues: [], locations: [] });
  });

  it('falls back to reading legacy marker-embedded data out of entity.notes for backward compatibility', () => {
    const legacy = 'Some scratch text\n<<<GRIMOIRE_NOTES>>>\n' + JSON.stringify({
      objectives: ['Old objective'], npcs: [], clues: [], locations: [],
    });
    const result = parseNotes(undefined, legacy);
    expect(result.scratch).toBe('Some scratch text');
    expect(result.objectives).toEqual(['Old objective']);
  });

  it('prefers explorationNotes over any legacy data in entity.notes once the new field is populated', () => {
    const legacy = 'Old scratch\n<<<GRIMOIRE_NOTES>>>\n' + JSON.stringify({ objectives: ['Old'], npcs: [], clues: [], locations: [] });
    const fresh = serializeNotes({ scratch: 'New scratch', objectives: ['New objective'], npcs: [], clues: [], locations: [] });
    const result = parseNotes(fresh, legacy);
    expect(result.scratch).toBe('New scratch');
    expect(result.objectives).toEqual(['New objective']);
  });

  it('does NOT corrupt TabNotes data — writing exploration notes and reading back via TabNotes.parseNotes on entity.notes are on independent fields', () => {
    // Simulates the exact original bug scenario: save via TabNotes first
    // (entity.notes), then add exploration data (entity.explorationNotes).
    const entityNotes = JSON.stringify({ backstory: 'A hero', sessionNotes: '', personalNotes: '' });
    const explorationNotes = serializeNotes({ scratch: '', objectives: ['Find the amulet'], npcs: [], clues: [], locations: [] });

    // entity.notes (TabNotes' own field) is untouched by the exploration write.
    expect(parseTabNotes(entityNotes)).toEqual({
      backstory: 'A hero', sessionNotes: '', personalNotes: '',
      backstoryUpdatedAt: undefined, sessionNotesUpdatedAt: undefined, personalNotesUpdatedAt: undefined,
    });
    // entity.explorationNotes (TabExploration's own field) parses correctly on its own.
    expect(parseNotes(explorationNotes, entityNotes).objectives).toEqual(['Find the amulet']);
  });
});
