// app/sheet/DmOverrideModal.tsx
// DM Override apply/cancel modal.
// Shown when isDm && user taps [Override] from the audit trail.
import { useState } from 'react';
import { Modal, View, Text, Pressable, TextInput, StyleSheet } from 'react-native';
import { Entity, DmOverride, CampaignRules } from '../../engine/types';
import { applyDmOverride, cancelDmOverride, getActiveOverrides } from '../../engine/dmOverride';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../../theme';

interface Props {
  visible:    boolean;
  entity:     Entity;
  stat:       string;
  statLabel:  string;
  rules:      CampaignRules;
  campaignId: string;
  deviceId:   string;
  onApply:    (updated: Entity) => void;
  onClose:    () => void;
}

type Operation = 'set' | 'add';
type Expiry    = 'manual' | 'end_of_encounter' | 'end_of_session';

const EXPIRY_LABELS: Record<Expiry, string> = {
  manual:           'Manual',
  end_of_encounter: 'End of Encounter',
  end_of_session:   'End of Session',
};

export function DmOverrideModal({
  visible, entity, stat, statLabel, rules,
  campaignId, deviceId, onApply, onClose,
}: Props) {
  const [operation, setOperation] = useState<Operation>('set');
  const [valueStr,  setValueStr]  = useState('');
  const [label,     setLabel]     = useState('');
  const [expiry,    setExpiry]    = useState<Expiry>('manual');

  const value  = parseFloat(valueStr);
  const valid  = !isNaN(value) && label.trim().length > 0;

  const activeOverrides = getActiveOverrides(entity).filter(o => o.stat === stat);

  function handleApply() {
    if (!valid) return;
    const updated = applyDmOverride(entity, {
      campaignId,
      entityId:   entity.id,
      dmDeviceId: deviceId,
      stat,
      operation,
      value,
      label:      label.trim(),
      expiry,
    }, rules);
    onApply(updated);
    setValueStr('');
    setLabel('');
    onClose();
  }

  function handleCancel(overrideId: string) {
    const updated = cancelDmOverride(entity, overrideId, rules);
    onApply(updated);
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={e => e.stopPropagation()}>
          <Text style={styles.title}>DM Override</Text>
          <Text style={styles.statName}>{statLabel}</Text>
          <Text style={styles.currentVal}>Current: {(entity.derived as any)[stat] ?? '—'}</Text>

          {/* Operation */}
          <Text style={styles.fieldLabel}>Operation</Text>
          <View style={styles.segmented}>
            {(['set', 'add'] as Operation[]).map(op => (
              <Pressable
                key={op}
                style={[styles.segBtn, operation === op && styles.segBtnActive]}
                onPress={() => setOperation(op)}
              >
                <Text style={[styles.segTxt, operation === op && styles.segTxtActive]}>
                  {op === 'set' ? 'Set to' : 'Add'}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Value */}
          <Text style={styles.fieldLabel}>Value</Text>
          <TextInput
            style={styles.input}
            value={valueStr}
            onChangeText={setValueStr}
            keyboardType="numbers-and-punctuation"
            placeholder={operation === 'set' ? 'e.g. 19' : 'e.g. +2 or -2'}
            placeholderTextColor={Colors.textDim}
          />

          {/* Label */}
          <Text style={styles.fieldLabel}>Label (shown in audit trail)</Text>
          <TextInput
            style={styles.input}
            value={label}
            onChangeText={setLabel}
            placeholder="e.g. Cursed by Artifact"
            placeholderTextColor={Colors.textDim}
          />

          {/* Expiry */}
          <Text style={styles.fieldLabel}>Expires</Text>
          <View style={styles.segmented}>
            {(Object.keys(EXPIRY_LABELS) as Expiry[]).map(e => (
              <Pressable
                key={e}
                style={[styles.segBtn, expiry === e && styles.segBtnActive]}
                onPress={() => setExpiry(e)}
              >
                <Text style={[styles.segTxt, expiry === e && styles.segTxtActive, { fontSize: FontSize.xs }]}>
                  {EXPIRY_LABELS[e]}
                </Text>
              </Pressable>
            ))}
          </View>

          <Pressable
            style={[styles.applyBtn, !valid && styles.btnDisabled]}
            onPress={handleApply}
            disabled={!valid}
          >
            <Text style={styles.applyBtnTxt}>Apply Override</Text>
          </Pressable>

          {/* Active overrides on this stat */}
          {activeOverrides.length > 0 && (
            <View style={styles.activeSection}>
              <Text style={styles.activeSectionTitle}>ACTIVE OVERRIDES</Text>
              {activeOverrides.map(o => (
                <View key={o.id} style={styles.overrideRow}>
                  <View style={styles.overrideInfo}>
                    <Text style={styles.overrideLabel}>{o.label}</Text>
                    <Text style={styles.overrideMeta}>
                      {o.operation === 'set' ? `Set to ${o.value}` : `${o.value >= 0 ? '+' : ''}${o.value}`}
                      {'  ·  '}
                      {EXPIRY_LABELS[o.expiry]}
                    </Text>
                  </View>
                  <Pressable style={styles.cancelOverrideBtn} onPress={() => handleCancel(o.id)}>
                    <Text style={styles.cancelOverrideTxt}>Cancel</Text>
                  </Pressable>
                </View>
              ))}
            </View>
          )}

          <Pressable style={styles.closeBtn} onPress={onClose}>
            <Text style={styles.closeTxt}>Close</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: '#000000cc', justifyContent: 'center', padding: Spacing.lg },
  sheet: {
    backgroundColor: Colors.surfaceHigh, borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.gold + '44',
    padding: Spacing.lg, gap: Spacing.sm,
  },
  title:      { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.gold, textAlign: 'center' },
  statName:   { fontSize: FontSize.md, color: Colors.textPrimary, textAlign: 'center' },
  currentVal: { fontSize: FontSize.sm, color: Colors.textDim, textAlign: 'center' },
  fieldLabel: { fontSize: FontSize.xs, color: Colors.textSecondary, letterSpacing: 1, fontWeight: FontWeight.bold },

  segmented: { flexDirection: 'row', gap: Spacing.xs },
  segBtn: {
    flex: 1, backgroundColor: Colors.surface, borderRadius: Radius.md,
    padding: Spacing.sm, alignItems: 'center',
    borderWidth: 1, borderColor: Colors.border,
  },
  segBtnActive: { backgroundColor: Colors.gold + '33', borderColor: Colors.gold },
  segTxt:       { fontSize: FontSize.sm, color: Colors.textSecondary },
  segTxtActive: { color: Colors.gold, fontWeight: FontWeight.bold },

  input: {
    backgroundColor: Colors.surface, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border,
    padding: Spacing.sm, color: Colors.textPrimary, fontSize: FontSize.md,
  },

  applyBtn: {
    backgroundColor: Colors.gold, borderRadius: Radius.md,
    padding: Spacing.md, alignItems: 'center', marginTop: Spacing.xs,
  },
  btnDisabled: { opacity: 0.4 },
  applyBtnTxt: { color: Colors.bg, fontWeight: FontWeight.bold, fontSize: FontSize.md },

  activeSection: {
    backgroundColor: Colors.surface, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border,
    padding: Spacing.sm, gap: Spacing.sm,
  },
  activeSectionTitle: { fontSize: FontSize.xs, color: Colors.textDim, letterSpacing: 2 },
  overrideRow:        { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  overrideInfo:       { flex: 1 },
  overrideLabel:      { fontSize: FontSize.sm, color: Colors.textPrimary, fontWeight: FontWeight.bold },
  overrideMeta:       { fontSize: FontSize.xs, color: Colors.textDim },
  cancelOverrideBtn:  {
    backgroundColor: Colors.red + '22', borderRadius: Radius.sm,
    paddingHorizontal: Spacing.sm, paddingVertical: 4,
    borderWidth: 1, borderColor: Colors.red + '44',
  },
  cancelOverrideTxt: { color: Colors.red, fontSize: FontSize.xs, fontWeight: FontWeight.bold },

  closeBtn: { alignItems: 'center', padding: Spacing.sm },
  closeTxt: { color: Colors.textSecondary, fontSize: FontSize.md },
});
