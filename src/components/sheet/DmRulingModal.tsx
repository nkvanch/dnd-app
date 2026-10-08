// src/components/sheet/DmRulingModal.tsx
// DM temporary rulings: a DM authoring an ad-hoc mechanical ruling on the
// spot ("disadvantage on STR checks to open this door", "the blessed altar
// grants +2 to saves this fight") and applying it to one entity, a
// multi-selected group, or every combatant in the encounter — the
// multi-target generalization of AddCustomFeatureModal.tsx's single-entity
// "A-26 generalized temporary/live effects" flow.
//
// Deliberately does NOT duplicate that flow's compile/apply logic — reuses
// grantCustomFeature (exported from AddCustomFeatureModal.tsx) exactly as
// TabFeatures.tsx's single-entity version does, just called once per target
// entity instead of once. Same TraitEditorModal authoring UI, same 3-option
// duration picker (Permanent / Until Next Rest / N Rounds — the only
// DurationTracker units anything in the app actually ticks), same
// disclosed-effects philosophy: a mechanical effect not expressible via
// TraitEditor (e.g. automatic damage-per-round) isn't silently dropped —
// the DM just writes it in the ruling's name/description and it stays
// visible as a disclosed reminder (the condition chip on each targeted
// combatant's row), same as every other "disclosed, not simulated"
// mechanic already in this app.
import { useState, useEffect } from 'react';
import { Modal, View, Text, Pressable, TextInput, StyleSheet } from 'react-native';
import { Entity, CampaignRules, DraftTrait, DurationTracker } from '../../engine/types';
import { newDraftTrait, TraitEditorModal } from '../homebrew/TraitEditor';
import { grantCustomFeature } from './AddCustomFeatureModal';
import { simulate } from '../../engine/simulate';
import { buildFeatureGrantRows } from './featureGrantRows';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../../theme';

interface Props {
  visible:  boolean;
  entities: Entity[]; // targets, already resolved by the caller (one entity, a multi-selection, or "everyone")
  rules:    CampaignRules;
  /** One entry per target — same shape applyEntityUpdate/handleBulkUpdate
   *  already expect (before/after pair per entity), so the caller's
   *  existing undo/timeline/character-patch wiring applies unchanged. */
  onApply:  (updates: { before: Entity; after: Entity }[]) => void;
  onCancel: () => void;
}

type Step = 'editing' | 'duration' | 'preview';

export function DmRulingModal({ visible, entities, rules, onApply, onCancel }: Props) {
  const [draft, setDraft] = useState<DraftTrait>(() => newDraftTrait('New Ruling'));
  const [step, setStep] = useState<Step>('editing');
  const [duration, setDuration] = useState<DurationTracker | null>(null);
  const [roundsText, setRoundsText] = useState('');

  useEffect(() => {
    if (visible) {
      setDraft(newDraftTrait('New Ruling'));
      setStep('editing');
      setDuration(null);
      setRoundsText('');
    }
  }, [visible]);

  if (!visible || entities.length === 0) return null;

  if (step === 'editing') {
    return (
      <TraitEditorModal
        trait={draft}
        visible
        onChange={setDraft}
        onDone={() => setStep('duration')}
        onDelete={onCancel}
      />
    );
  }

  if (step === 'duration') {
    const rounds = parseInt(roundsText, 10);
    const roundsValid = !isNaN(rounds) && rounds >= 1;
    return (
      <Modal visible transparent animationType="fade" onRequestClose={onCancel}>
        <Pressable style={styles.backdrop} onPress={onCancel}>
          <Pressable style={styles.sheet} onPress={e => e.stopPropagation()}>
            <Text style={styles.title}>How long — {draft.name || 'New Ruling'}?</Text>
            <Text style={styles.targetSummary}>
              Applies to {entities.length} target{entities.length === 1 ? '' : 's'}: {entities.map(e => e.identity.name).join(', ')}
            </Text>
            <Pressable style={styles.durationItem} onPress={() => { setDuration(null); setStep('preview'); }}>
              <Text style={styles.durationItemTxt}>Permanent</Text>
              <Text style={styles.durationItemNote}>Lasts until manually removed.</Text>
            </Pressable>
            <Pressable
              style={styles.durationItem}
              onPress={() => { setDuration({ unit: 'until_rest', remaining: 0 }); setStep('preview'); }}
            >
              <Text style={styles.durationItemTxt}>Until Next Rest</Text>
            </Pressable>
            <View style={styles.durationItem}>
              <Text style={styles.durationItemTxt}>N Rounds</Text>
              <View style={styles.roundsRow}>
                <TextInput
                  style={styles.roundsInput}
                  value={roundsText}
                  onChangeText={setRoundsText}
                  keyboardType="number-pad"
                  placeholder="e.g. 3"
                  placeholderTextColor={Colors.textDim}
                />
                <Pressable
                  style={[styles.roundsBtn, !roundsValid && styles.roundsBtnDisabled]}
                  disabled={!roundsValid}
                  onPress={() => { setDuration({ unit: 'rounds', remaining: rounds }); setStep('preview'); }}
                >
                  <Text style={styles.roundsBtnTxt}>Set</Text>
                </Pressable>
              </View>
            </View>
            <Pressable style={styles.cancelBtn} onPress={() => setStep('editing')}>
              <Text style={styles.cancelTxt}>← Back</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    );
  }

  // Preview is computed against entities[0] only — simulate()/
  // buildFeatureGrantRows are single-entity. The same ruling (same
  // compiled feature id, since draft.localId is fixed for this whole
  // flow) applies independently to every other target on Confirm;
  // disclosed below rather than silently implying it's a shared preview.
  const { before, after } = simulate(entities[0], e => grantCustomFeature(e, draft, rules, duration), rules);
  const rows = buildFeatureGrantRows(before, after);
  const durationLabel = duration === null ? 'Permanent'
    : duration.unit === 'until_rest' ? 'Until Next Rest'
    : `${duration.remaining} round${duration.remaining === 1 ? '' : 's'}`;

  function confirm() {
    const updates = entities.map(e => ({ before: e, after: grantCustomFeature(e, draft, rules, duration) }));
    onApply(updates);
  }

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable style={styles.backdrop} onPress={onCancel}>
        <Pressable style={styles.sheet} onPress={e => e.stopPropagation()}>
          <Text style={styles.title}>{draft.name || 'New Ruling'}</Text>
          <Text style={styles.durationSummary}>Duration: {durationLabel}</Text>
          <Text style={styles.targetSummary}>
            Applies to {entities.length} target{entities.length === 1 ? '' : 's'}
          </Text>

          {rows.length === 0 ? (
            <Text style={styles.emptyTxt}>
              No automatically-tracked mechanical effect — this ruling is a disclosed reminder only
              (visible as a condition tag on each targeted combatant). Describe what it does in the
              ruling's name/description for the table to see.
            </Text>
          ) : (
            <View style={styles.rowsBox}>
              <Text style={styles.rowsBoxLabel}>Effect on {entities[0].identity.name} (applies the same way to every other target):</Text>
              {rows.map((row, i) => (
                <View key={i} style={styles.row}>
                  <Text style={styles.rowTxt}>{row.label}</Text>
                  {row.note && <Text style={styles.rowNote}>{row.note}</Text>}
                </View>
              ))}
            </View>
          )}

          <View style={styles.actions}>
            <Pressable style={styles.cancelBtn} onPress={() => setStep('duration')}>
              <Text style={styles.cancelTxt}>← Duration</Text>
            </Pressable>
            <Pressable style={styles.confirmBtn} onPress={confirm}>
              <Text style={styles.confirmTxt}>Apply Ruling</Text>
            </Pressable>
          </View>
          <Pressable style={styles.discardBtn} onPress={onCancel}>
            <Text style={styles.discardTxt}>Discard</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: '#000000cc', justifyContent: 'center', padding: Spacing.md },
  sheet: {
    backgroundColor: Colors.surfaceHigh,
    borderRadius: Radius.lg,
    padding: Spacing.md, gap: Spacing.sm,
  },
  title: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.gold, textAlign: 'center' },
  emptyTxt: { fontSize: FontSize.md, color: Colors.textDim, textAlign: 'center', paddingVertical: Spacing.md },
  durationSummary: { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center', marginTop: -4 },
  targetSummary:   { fontSize: FontSize.xs, color: Colors.textDim, textAlign: 'center' },

  durationItem: {
    backgroundColor: Colors.surface, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border, padding: Spacing.sm,
  },
  durationItemTxt: { fontSize: FontSize.md, color: Colors.textPrimary, fontWeight: FontWeight.bold },
  durationItemNote: { fontSize: FontSize.xs, color: Colors.textDim, marginTop: 2 },
  roundsRow: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.xs, alignItems: 'center' },
  roundsInput: {
    flex: 1, backgroundColor: Colors.surfaceHigh, borderRadius: Radius.sm,
    borderWidth: 1, borderColor: Colors.border, padding: Spacing.xs, color: Colors.textPrimary,
  },
  roundsBtn: { backgroundColor: Colors.gold, borderRadius: Radius.sm, paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs },
  roundsBtnDisabled: { opacity: 0.4 },
  roundsBtnTxt: { color: Colors.bg, fontWeight: FontWeight.bold, fontSize: FontSize.sm },

  rowsBox: {
    backgroundColor: Colors.surface, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border, padding: Spacing.sm, gap: Spacing.xs,
  },
  rowsBoxLabel: { fontSize: FontSize.xs, color: Colors.textDim, marginBottom: 2 },
  row: { paddingVertical: 2 },
  rowTxt: { fontSize: FontSize.sm, color: Colors.textPrimary },
  rowNote: { fontSize: FontSize.xs, color: Colors.textDim, marginTop: 1 },

  actions: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm },
  cancelBtn: {
    flex: 1, backgroundColor: Colors.surface, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border, padding: Spacing.md, alignItems: 'center',
  },
  cancelTxt: { color: Colors.textSecondary, fontWeight: FontWeight.bold, fontSize: FontSize.md },
  confirmBtn: {
    flex: 1, backgroundColor: Colors.gold, borderRadius: Radius.md,
    padding: Spacing.md, alignItems: 'center',
  },
  confirmTxt: { color: Colors.bg, fontWeight: FontWeight.bold, fontSize: FontSize.md },
  discardBtn: { alignItems: 'center', padding: Spacing.sm },
  discardTxt: { color: Colors.red, fontSize: FontSize.sm },
});
