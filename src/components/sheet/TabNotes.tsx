// app/sheet/TabNotes.tsx
// Tab 6 — Backstory, Session Notes, Personal Notes. Auto-save on blur.
import { useState, memo } from 'react';
import { ScrollView, View, Text, TextInput, StyleSheet } from 'react-native';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../../theme';

interface Props {
  notes:    string;   // JSON string: { backstory, sessionNotes, personalNotes, <field>UpdatedAt }
  onSave:   (notes: string) => void;
}

type NoteField = 'backstory' | 'sessionNotes' | 'personalNotes';

type ParsedNotes = {
  backstory: string; sessionNotes: string; personalNotes: string;
  backstoryUpdatedAt?: number; sessionNotesUpdatedAt?: number; personalNotesUpdatedAt?: number;
};

export function parseNotes(raw: string): ParsedNotes {
  try {
    const parsed = JSON.parse(raw);
    return {
      backstory:     parsed.backstory     ?? '',
      sessionNotes:  parsed.sessionNotes  ?? '',
      personalNotes: parsed.personalNotes ?? '',
      backstoryUpdatedAt:     parsed.backstoryUpdatedAt,
      sessionNotesUpdatedAt:  parsed.sessionNotesUpdatedAt,
      personalNotesUpdatedAt: parsed.personalNotesUpdatedAt,
    };
  } catch {
    return { backstory: raw, sessionNotes: '', personalNotes: '' };
  }
}

// Item 20 (QoL) — coarse, human-readable relative time. Doesn't need
// second-level precision (this is "last edited," not a live clock), so a
// small fixed set of buckets is enough — no library, no live-ticking timer.
export function timeAgo(ts: number): string {
  const diffMs = Date.now() - ts;
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  return `${day}d ago`;
}

function TabNotesInner({ notes, onSave }: Props) {
  const parsed = parseNotes(notes);
  const [backstory,     setBackstory]     = useState(parsed.backstory);
  const [sessionNotes,  setSessionNotes]  = useState(parsed.sessionNotes);
  const [personalNotes, setPersonalNotes] = useState(parsed.personalNotes);
  // Item 20 (QoL) — last-edited timestamps, kept in local state (not
  // re-derived from the `notes` prop on every render) so the label updates
  // immediately on save without waiting for the prop round-trip.
  const [updatedAt, setUpdatedAt] = useState({
    backstory: parsed.backstoryUpdatedAt, sessionNotes: parsed.sessionNotesUpdatedAt, personalNotes: parsed.personalNotesUpdatedAt,
  });

  // Merge onto the CURRENT `notes` prop, not the two other fields' local
  // state — local state was only seeded once at mount, so if `notes` changed
  // externally since then (e.g. a sync update from another device arriving
  // while this tab is open), saving from local state would silently stomp
  // that fresh change back to its stale pre-mount value.
  function save(field: NoteField, value: string) {
    const current = parseNotes(notes);
    const now = Date.now();
    const updated = { ...current, [field]: value, [`${field}UpdatedAt`]: now };
    onSave(JSON.stringify(updated));
    setUpdatedAt(prev => ({ ...prev, [field]: now }));
  }

  function editedLabel(field: NoteField): string | null {
    const ts = updatedAt[field];
    return ts ? `Last edited ${timeAgo(ts)}` : null;
  }

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

      <View style={styles.block}>
        <View style={styles.labelRow}>
          <Text style={styles.label}>BACKSTORY</Text>
          {editedLabel('backstory') && <Text style={styles.editedTxt}>{editedLabel('backstory')}</Text>}
        </View>
        <TextInput
          style={styles.area}
          value={backstory}
          onChangeText={setBackstory}
          onBlur={() => save('backstory', backstory)}
          multiline
          placeholder="Write your character's backstory…"
          placeholderTextColor={Colors.textDim}
          textAlignVertical="top"
        />
      </View>

      <View style={styles.block}>
        <View style={styles.labelRow}>
          <Text style={styles.label}>SESSION NOTES</Text>
          {editedLabel('sessionNotes') && <Text style={styles.editedTxt}>{editedLabel('sessionNotes')}</Text>}
        </View>
        <TextInput
          style={styles.area}
          value={sessionNotes}
          onChangeText={setSessionNotes}
          onBlur={() => save('sessionNotes', sessionNotes)}
          multiline
          placeholder="Notes from your current session…"
          placeholderTextColor={Colors.textDim}
          textAlignVertical="top"
        />
      </View>

      <View style={styles.block}>
        <View style={styles.labelRow}>
          <Text style={styles.label}>PERSONAL NOTES</Text>
          {editedLabel('personalNotes') && <Text style={styles.editedTxt}>{editedLabel('personalNotes')}</Text>}
        </View>
        <TextInput
          style={styles.area}
          value={personalNotes}
          onChangeText={setPersonalNotes}
          onBlur={() => save('personalNotes', personalNotes)}
          multiline
          placeholder="Goals, allies, enemies, reminders…"
          placeholderTextColor={Colors.textDim}
          textAlignVertical="top"
        />
      </View>

    </ScrollView>
  );
}

// EDIT-PERF-1: see TabCharacter.tsx's identical comment.
export const TabNotes = memo(TabNotesInner);

const styles = StyleSheet.create({
  scroll:   { flex: 1 },
  content:  { padding: Spacing.md, gap: Spacing.md, paddingBottom: Spacing.xxl },

  block: {
    backgroundColor: Colors.surface, borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.border, padding: Spacing.md, gap: Spacing.sm,
  },
  labelRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  label: { fontSize: FontSize.xs, color: Colors.textSecondary, letterSpacing: 2, fontWeight: FontWeight.bold },
  editedTxt: { fontSize: FontSize.xs, color: Colors.textDim, fontStyle: 'italic' },
  area:  {
    minHeight: 160, color: Colors.textPrimary, fontSize: FontSize.md,
    lineHeight: 22, padding: 0,
  },
});
