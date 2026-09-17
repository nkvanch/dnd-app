// app/creation/feats.tsx
// Optional creation-time feat selection (the common "feat at 1st level" house
// rule - variant human / custom origin, or simply a DM allowance). Lets the
// player add one or more feats to the draft and remove ones they've taken.
// Reuses the shared <AsiFeatPicker> in feat-only mode so prerequisite gating and
// the "take anyway" override behave exactly as they do on level-up.
import { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, Modal } from 'react-native';
import { useRouter } from 'expo-router';
import { useCharacterStore } from '../../src/store/characterStore';
import { AsiFeatPicker } from '../../src/components/AsiFeatPicker';
import { FEATS_BY_ID } from '../../src/content/feats/index';
import { Entity, ChoiceState } from '../../src/engine/types';
import { usePendingSelectionStore } from '../../src/store/pendingSelectionStore';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../../src/theme';

/** Builds a fresh, unresolved feat choice anchored at level 1 for the picker. */
function makeCreationFeatChoice(index: number): ChoiceState {
  const id = `creation_feat_${index}`;
  return {
    id,
    definition: {
      id,
      prompt:   'Choose a feat to gain at 1st level.',
      kind:     'feat',
      count:    1,
      pool:     'all',
      grants:   [],
      required: false,
      resolved: false,
    },
    grantedAt:  1,
    resolved:   false,
    selections: [],
  };
}

export default function CreationFeatsScreen() {
  const router   = useRouter();
  const draft    = useCharacterStore(s => s.draft);
  const setDraft = useCharacterStore(s => s.setDraft);
  const rules    = useCharacterStore(s => s.rules);

  // SAVE-AND-ADD-1: reopen the picker on return from "+ Create new homebrew
  // feat" so AsiFeatPicker's own effect can consume the pending selection —
  // this screen (and the Modal wrapping the picker) fully unmounts during
  // that navigation, so `pickerOpen` would otherwise reset to closed.
  const [pickerOpen, setPickerOpen] = useState(
    () => usePendingSelectionStore.getState().pending.feat_picker !== undefined
  );

  useEffect(() => {
    if (!draft) router.replace('/creation/name');
  }, [draft]);

  if (!draft) return null;

  // Feats already on the draft (taken at creation or otherwise).
  const takenFeats = draft.features.filter(f => f.source.kind === 'feat');

  // Index the next synthetic choice id so multiple creation feats don't collide.
  const nextIndex = draft.choices.filter(c => c.id.startsWith('creation_feat_')).length;

  function markVisited(e: Entity): Entity {
    const notes = (() => { try { return JSON.parse(e.notes || '{}'); } catch { return {}; } })();
    return { ...e, notes: JSON.stringify({ ...notes, featsVisited: true }) };
  }

  function removeFeat(featRefId: string) {
    if (!draft) return;
    // Drop the feat feature and any creation feat-choice that recorded it, then
    // let the engine's recompute run on next mutation. Feat effects live only in
    // the feature, so removing the feature removes the bonus.
    const updated: Entity = {
      ...draft,
      features: draft.features.filter(f => !(f.source.kind === 'feat' && f.source.refId === featRefId)),
      choices:  draft.choices.filter(c => !(c.id.startsWith('creation_feat_') && c.selections.includes(`feat:${featRefId}`))),
    };
    setDraft(markVisited(updated));
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.heading}>Feats</Text>
      <View style={styles.divider} />

      <View style={styles.infoCard}>
        <Text style={styles.infoTxt}>
          Some tables grant a feat at 1st level (variant human, custom origin, or
          a DM house rule). This step is optional - skip it if your game uses the
          standard rules.
        </Text>
      </View>

      <Text style={styles.sectionLabel}>FEATS TAKEN ({takenFeats.length})</Text>
      {takenFeats.length === 0 ? (
        <Text style={styles.emptyNote}>No feats yet.</Text>
      ) : (
        takenFeats.map(f => {
          const cat = FEATS_BY_ID[f.source.refId];
          return (
            <View key={f.id} style={styles.featRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.featName}>{f.name}</Text>
                <Text style={styles.featDesc} numberOfLines={2}>{f.description}</Text>
                {cat?.source && <Text style={styles.featSource}>{cat.source}</Text>}
              </View>
              <Pressable style={styles.removeBtn} onPress={() => removeFeat(f.source.refId)}>
                <Text style={styles.removeTxt}>Remove</Text>
              </Pressable>
            </View>
          );
        })
      )}

      <Pressable style={styles.addBtn} onPress={() => setPickerOpen(true)}>
        <Text style={styles.addBtnTxt}>+ Add a Feat</Text>
      </Pressable>

      <View style={styles.divider} />
      <Pressable
        style={styles.doneBtn}
        onPress={() => { setDraft(markVisited(draft)); router.push('/creation/hub'); }}
      >
        <Text style={styles.doneBtnTxt}>Done →</Text>
      </Pressable>

      {/* Feat picker (feat-only mode) */}
      <Modal visible={pickerOpen} animationType="slide" onRequestClose={() => setPickerOpen(false)}>
        <View style={styles.modalRoot}>
          <AsiFeatPicker
            entity={draft}
            choice={makeCreationFeatChoice(nextIndex)}
            rules={rules}
            featOnly
            onClose={() => setPickerOpen(false)}
            onResolved={(updated) => {
              setDraft(markVisited(updated));
              setPickerOpen(false);
            }}
            onCreateNewFeat={() => router.push('/homebrew/feat-builder')}
            browseStateKey="feat:creation"
          />
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  content:   { padding: Spacing.lg, paddingBottom: Spacing.xxl },
  heading:   { fontSize: FontSize.xxl, fontWeight: FontWeight.black, color: Colors.textPrimary, textAlign: 'center', marginBottom: Spacing.md },
  divider:   { height: 1, backgroundColor: Colors.border, marginVertical: Spacing.lg },

  infoCard: {
    backgroundColor: Colors.surfaceHigh, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border, padding: Spacing.md, marginBottom: Spacing.lg,
  },
  infoTxt: { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 20 },

  sectionLabel: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.textSecondary, letterSpacing: 1, marginBottom: Spacing.sm },
  emptyNote: { fontSize: FontSize.sm, color: Colors.textDim, fontStyle: 'italic', marginBottom: Spacing.md },

  featRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    backgroundColor: Colors.surface, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border,
    padding: Spacing.md, marginBottom: Spacing.sm,
  },
  featName:   { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  featDesc:   { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 2, lineHeight: 18 },
  featSource: { fontSize: FontSize.xs, color: Colors.textDim, marginTop: 2, opacity: 0.7 },
  removeBtn: {
    backgroundColor: Colors.red + '22', borderRadius: Radius.full,
    borderWidth: 1, borderColor: Colors.red + '55',
    paddingHorizontal: Spacing.sm, paddingVertical: 4,
  },
  removeTxt: { fontSize: FontSize.xs, color: Colors.red, fontWeight: FontWeight.bold },

  addBtn: {
    backgroundColor: Colors.gold + '22', borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.gold + '66',
    paddingVertical: Spacing.md, alignItems: 'center', marginTop: Spacing.xs,
  },
  addBtnTxt: { fontSize: FontSize.md, color: Colors.gold, fontWeight: FontWeight.bold },

  doneBtn: { backgroundColor: Colors.gold, borderRadius: Radius.md, paddingVertical: Spacing.md, alignItems: 'center' },
  doneBtnTxt: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.bg },

  modalRoot: { flex: 1, backgroundColor: Colors.bg, paddingTop: Spacing.xl + 8 },
});
