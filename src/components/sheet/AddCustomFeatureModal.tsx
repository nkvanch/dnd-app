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
// Two-step flow: author (TraitEditorModal) → preview (simulate() +
// buildFeatureGrantRows, reused from Phase 1) → Confirm → onEntityUpdate.
// Tagging the compiled feature and any resource it grants with
// source.kind:'manual' / sourceId: <feature's own id> is what lets Phase
// 1's removeFeature cleanly remove both together later.
import { useState, useEffect } from 'react';
import { Modal, View, Text, Pressable, StyleSheet } from 'react-native';
import { Entity, CampaignRules, DraftTrait } from '../../engine/types';
import { newDraftTrait, buildTraitFeature, TraitEditorModal } from '../homebrew/TraitEditor';
import { applyGrant } from '../../engine/leveling';
import { simulate } from '../../engine/simulate';
import { buildFeatureGrantRows } from './featureGrantRows';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../../theme';

/** Compiles the draft and applies the resulting feature (+ any extra
 *  features/resources a spell_grant trait produces) via applyGrant — the
 *  same primitive every other grant path in the app uses, so grant_spell
 *  effects etc. get processed identically. Every grant is explicitly
 *  source-tagged 'manual', keyed to the compiled feature's own final id
 *  (not draft.localId — that's just the content-definition id buildTraitFeature
 *  derives the final feature id FROM), so removeFeature's sourceId match
 *  works correctly later. */
export function grantCustomFeature(entity: Entity, draft: DraftTrait): Entity {
  const compiled = buildTraitFeature(draft, {
    idPrefix: draft.localId, sourceKind: 'manual', sourceRefId: draft.localId, level: null,
  });
  let updated = applyGrant(entity, { kind: 'feature', value: compiled.feature }, 0);
  for (const ef of compiled.extraFeatures ?? []) {
    updated = applyGrant(updated, { kind: 'feature', value: ef }, 0);
  }
  const manualSource = { kind: 'manual' as const, id: compiled.feature.id };
  if (compiled.resource) {
    updated = applyGrant(updated, { kind: 'resource', value: compiled.resource }, 0, undefined, manualSource);
  }
  for (const er of compiled.extraResources ?? []) {
    updated = applyGrant(updated, { kind: 'resource', value: er }, 0, undefined, manualSource);
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

export function AddCustomFeatureModal({ visible, entity, rules, onConfirm, onCancel }: Props) {
  const [draft, setDraft] = useState<DraftTrait>(() => newDraftTrait('New Feature'));
  const [editing, setEditing] = useState(true);

  // Fresh draft every time this flow is (re)opened — visible flips false→true
  // between separate additions, this component instance stays mounted.
  useEffect(() => {
    if (visible) {
      setDraft(newDraftTrait('New Feature'));
      setEditing(true);
    }
  }, [visible]);

  if (!visible) return null;

  if (editing) {
    return (
      <TraitEditorModal
        trait={draft}
        visible
        onChange={setDraft}
        onDone={() => setEditing(false)}
        onDelete={onCancel}
      />
    );
  }

  const { before, after } = simulate(entity, e => grantCustomFeature(e, draft), rules);
  const rows = buildFeatureGrantRows(before, after);

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable style={styles.backdrop} onPress={onCancel}>
        <Pressable style={styles.sheet} onPress={e => e.stopPropagation()}>
          <Text style={styles.title}>Add {draft.name || 'New Feature'}</Text>

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

          <View style={styles.actions}>
            <Pressable style={styles.cancelBtn} onPress={() => setEditing(true)}>
              <Text style={styles.cancelTxt}>← Edit</Text>
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
