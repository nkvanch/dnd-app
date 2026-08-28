// app/sheet/TabNotes.tsx
// Tab 6 — Backstory, Session Notes, Personal Notes. Auto-save on blur.
import { useState } from 'react';
import { ScrollView, View, Text, TextInput, StyleSheet } from 'react-native';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../../theme';

interface Props {
  notes:    string;   // JSON string: { backstory, sessionNotes, personalNotes }
  onSave:   (notes: string) => void;
}

function parseNotes(raw: string): { backstory: string; sessionNotes: string; personalNotes: string } {
  try {
    const parsed = JSON.parse(raw);
    return {
      backstory:     parsed.backstory     ?? '',
      sessionNotes:  parsed.sessionNotes  ?? '',
      personalNotes: parsed.personalNotes ?? '',
    };
  } catch {
    return { backstory: raw, sessionNotes: '', personalNotes: '' };
  }
}

export function TabNotes({ notes, onSave }: Props) {
  const parsed = parseNotes(notes);
  const [backstory,     setBackstory]     = useState(parsed.backstory);
  const [sessionNotes,  setSessionNotes]  = useState(parsed.sessionNotes);
  const [personalNotes, setPersonalNotes] = useState(parsed.personalNotes);

  // Merge onto the CURRENT `notes` prop, not the two other fields' local
  // state — local state was only seeded once at mount, so if `notes` changed
  // externally since then (e.g. a sync update from another device arriving
  // while this tab is open), saving from local state would silently stomp
  // that fresh change back to its stale pre-mount value.
  function save(field: 'backstory' | 'sessionNotes' | 'personalNotes', value: string) {
    const current = parseNotes(notes);
    const updated = { ...current, [field]: value };
    onSave(JSON.stringify(updated));
  }

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

      <View style={styles.block}>
        <Text style={styles.label}>BACKSTORY</Text>
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
        <Text style={styles.label}>SESSION NOTES</Text>
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
        <Text style={styles.label}>PERSONAL NOTES</Text>
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

const styles = StyleSheet.create({
  scroll:   { flex: 1 },
  content:  { padding: Spacing.md, gap: Spacing.md, paddingBottom: Spacing.xxl },

  block: {
    backgroundColor: Colors.surface, borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.border, padding: Spacing.md, gap: Spacing.sm,
  },
  label: { fontSize: FontSize.xs, color: Colors.textSecondary, letterSpacing: 2, fontWeight: FontWeight.bold },
  area:  {
    minHeight: 160, color: Colors.textPrimary, fontSize: FontSize.md,
    lineHeight: 22, padding: 0,
  },
});
