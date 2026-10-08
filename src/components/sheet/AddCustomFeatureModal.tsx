// src/components/sheet/AddCustomFeatureModal.tsx
// Phase 3 of the live feature/background editing track: a DM (or player)
// authoring a one-off feature on the spot — "you now have this" — rather
// than picking from the existing feat catalog (Phase 2). Reuses
// TraitEditorModal, the same authoring UI already used across every
// homebrew builder (ability bonus / proficiency / resistance / sense /
// movement / limited-use resource), NOT feature-editor.tsx's cruder
// raw-effect-array tool (that one has no DraftTrait model at all and is
// meant for authoring reusable homebrew content, not one-off live grants).
//
// Three-step flow: author (TraitEditorModal) → duration (Permanent / Until
// Next Rest / N Rounds — same 3 options the condition-duration picker
// offers, for the same reason: those are the only DurationTracker units
// anything in the app actually ticks) → preview (simulate() +
// buildFeatureGrantRows, reused from Phase 1) → Confirm → onEntityUpdate.
//
// A-26 (generalized temporary/live effects): this is that generalization.
// applyCondition() already accepted an arbitrary Feature[] + DurationTracker
// — nothing about it is specific to the named Condition catalog, that's
// just the only caller it had before now. Routing a timed custom feature
// through it means it ticks/expires via the exact same mechanism (End Turn,
// longRest's until_rest sweep) conditions already use, with zero new engine
// code. A permanent grant keeps using applyGrant, unchanged from before.
import { useState, useEffect } from 'react';
import { Modal, View, Text, Pressable, TextInput, StyleSheet } from 'react-native';
import { Entity, CampaignRules, DraftTrait, DurationTracker } from '../../engine/types';
import { newDraftTrait, buildTraitFeature, TraitEditorModal } from '../homebrew/TraitEditor';
import { applyGrant } from '../../engine/leveling';
import { applyCondition } from '../../engine/conditions';
import { simulate } from '../../engine/simulate';
import { buildFeatureGrantRows } from './featureGrantRows';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../../theme';

/** Compiles the draft and applies the resulting feature (+ any extra
 *  features a spell_grant trait produces). A null duration grants
 *  permanently via applyGrant — the same primitive every other grant path
 *  in the app uses — source-tagged 'manual' so removeFeature can strip it
 *  later. A real duration instead routes the feature(s) through
 *  applyCondition, source-tagged 'condition' and ticking/expiring the same
 *  way any named condition does. Resource grants (rare on a "temporary"
 *  buff, but TraitEditor allows one) always apply permanently regardless of
 *  duration — applyCondition has no resource-grant concept, and a
 *  time-limited resource pool isn't a case any content in this app models
 *  today; disclosed in the preview screen when it applies. */
export function grantCustomFeature(
  entity: Entity, draft: DraftTrait, rules: CampaignRules, duration: DurationTracker | null = null,
): Entity {
  const compiled = buildTraitFeature(draft, {
    idPrefix: draft.localId, sourceKind: 'manual', sourceRefId: draft.localId, level: null,
  });
  const features = [compiled.feature, ...(compiled.extraFeatures ?? [])];

  let updated = entity;
  const manualSource = { kind: 'manual' as const, id: compiled.feature.id };
  if (compiled.resource) {
    updated = applyGrant(updated, { kind: 'resource', value: compiled.resource }, 0, undefined, manualSource);
  }
  for (const er of compiled.extraResources ?? []) {
    updated = applyGrant(updated, { kind: 'resource', value: er }, 0, undefined, manualSource);
  }

  if (duration) {
    updated = applyCondition(updated, compiled.feature.id, 'manual', rules, features, duration);
  } else {
    for (const f of features) {
      updated = applyGrant(updated, { kind: 'feature', value: f }, 0);
    }
  }
  return updated;
}

interface Props {
  visible:   boolean;
  entity:    Entity;
  rules:     CampaignRules;
  onConfirm: (updated: Entity) => void;
  onCancel:  () => void;
}

type Step = 'editing' | 'duration' | 'preview';

export function AddCustomFeatureModal({ visible, entity, rules, onConfirm, onCancel }: Props) {
  const [draft, setDraft] = useState<DraftTrait>(() => newDraftTrait('New Feature'));
  const [step, setStep] = useState<Step>('editing');
  const [duration, setDuration] = useState<DurationTracker | null>(null);
  const [roundsText, setRoundsText] = useState('');

  // Fresh draft every time this flow is (re)opened — visible flips false→true
  // between separate additions, this component instance stays mounted.
  useEffect(() => {
    if (visible) {
      setDraft(newDraftTrait('New Feature'));
      setStep('editing');
      setDuration(null);
      setRoundsText('');
    }
  }, [visible]);

  if (!visible) return null;

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
            <Text style={styles.title}>How long — {draft.name || 'New Feature'}?</Text>
            <Pressable style={styles.durationItem} onPress={() => { setDuration(null); setStep('preview'); }}>
              <Text style={styles.durationItemTxt}>Permanent</Text>
              <Text style={styles.durationItemNote}>Lasts until manually removed — today's existing behavior.</Text>
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

  const { before, after } = simulate(entity, e => grantCustomFeature(e, draft, rules, duration), rules);
  const rows = buildFeatureGrantRows(before, after);
  const durationLabel = duration === null ? 'Permanent'
    : duration.unit === 'until_rest' ? 'Until Next Rest'
    : `${duration.remaining} round${duration.remaining === 1 ? '' : 's'}`;
  const compiled = buildTraitFeature(draft, { idPrefix: draft.localId, sourceKind: 'manual', sourceRefId: draft.localId, level: null });
  const grantsResource = !!compiled.resource || (compiled.extraResources ?? []).length > 0;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable style={styles.backdrop} onPress={onCancel}>
        <Pressable style={styles.sheet} onPress={e => e.stopPropagation()}>
          <Text style={styles.title}>Add {draft.name || 'New Feature'}</Text>
          <Text style={styles.durationSummary}>Duration: {durationLabel}</Text>

          {rows.length === 0 ? (
            <Text style={styles.emptyTxt}>
              This feature's effects aren't automatically tracked — see its description.
            </Text>
          ) : (
            <View style={styles.rowsBox}>
              {rows.map((row, i) => (
                <View key={i} style={styles.row}>
                  <Text style={styles.rowTxt}>{row.label}</Text>
                  {row.note && <Text style={styles.rowNote}>{row.note}</Text>}
                </View>
              ))}
            </View>
          )}
          {duration !== null && grantsResource && (
            <Text style={styles.rowNote}>
              Any resource this feature grants applies permanently — timed resource pools aren't modeled.
            </Text>
          )}

          <View style={styles.actions}>
            <Pressable style={styles.cancelBtn} onPress={() => setStep('duration')}>
              <Text style={styles.cancelTxt}>← Duration</Text>
            </Pressable>
            <Pressable style={styles.confirmBtn} onPress={() => onConfirm(after)}>
              <Text style={styles.confirmTxt}>Confirm</Text>
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
