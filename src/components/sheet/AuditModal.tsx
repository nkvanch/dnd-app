// app/sheet/AuditModal.tsx
// Tappable stat → full audit trail breakdown modal.
// When isDm=true, shows an [Override] button on each scalar stat.
import { useState } from 'react';
import { Modal, View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { Entity, CampaignRules } from '../../engine/types';
import { explainValue } from '../../engine/audit';
import { hasActiveOverride } from '../../engine/dmOverride';
import { DmOverrideModal } from './DmOverrideModal';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../../theme';

interface Props {
  entity:     Entity;
  stat:       string | null;   // null = closed
  label:      string;
  rules:      CampaignRules;
  isDm:       boolean;
  campaignId: string;
  deviceId:   string;
  onUpdate:   (updated: Entity) => void;
  onClose:    () => void;
}

export function AuditModal({
  entity, stat, label, rules, isDm,
  campaignId, deviceId, onUpdate, onClose,
}: Props) {
  const [overrideOpen, setOverrideOpen] = useState(false);

  const trail    = stat ? explainValue(entity, stat) : null;
  const hasOv    = stat ? hasActiveOverride(entity, stat) : false;

  return (
    <>
      <Modal visible={!!stat} transparent animationType="fade" onRequestClose={onClose}>
        <Pressable style={styles.backdrop} onPress={onClose}>
          <Pressable style={styles.sheet} onPress={e => e.stopPropagation()}>

            <View style={styles.titleRow}>
              <Text style={styles.title}>{label}</Text>
              {hasOv && <Text style={styles.overrideStar}>✱</Text>}
            </View>

            <Text style={styles.total}>{trail?.total ?? 0}</Text>

            <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
              {trail?.entries.map((e, i) => (
                <View key={i} style={styles.row}>
                  <Text style={styles.rowLabel}>{e.label}</Text>
                  <Text style={[
                    styles.rowValue,
                    e.value < 0 && styles.neg,
                    e.sourceKind === 'dm_override' && styles.overrideVal,
                  ]}>
                    {e.value >= 0 ? `+${e.value}` : String(e.value)}
                    {e.sourceKind === 'dm_override' && ' ✱'}
                  </Text>
                </View>
              ))}
              {(!trail || trail.entries.length === 0) && (
                <Text style={styles.empty}>No breakdown available.</Text>
              )}
            </ScrollView>

            {isDm && (
              <Pressable style={styles.overrideBtn} onPress={() => setOverrideOpen(true)}>
                <Text style={styles.overrideBtnTxt}>⚡ DM Override</Text>
              </Pressable>
            )}

            <Pressable style={styles.closeBtn} onPress={onClose}>
              <Text style={styles.closeTxt}>Close</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {stat && (
        <DmOverrideModal
          visible={overrideOpen}
          entity={entity}
          stat={stat}
          statLabel={label}
          rules={rules}
          campaignId={campaignId}
          deviceId={deviceId}
          onApply={updated => { onUpdate(updated); setOverrideOpen(false); }}
          onClose={() => setOverrideOpen(false)}
        />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1, backgroundColor: '#000000bb',
    justifyContent: 'center', alignItems: 'center', padding: Spacing.lg,
  },
  sheet: {
    backgroundColor: Colors.surfaceHigh,
    borderRadius:    Radius.lg,
    borderWidth:     1,
    borderColor:     Colors.border,
    padding:         Spacing.lg,
    width:           '100%',
    maxHeight:       '75%',
    gap:             Spacing.sm,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  title:    { fontSize: FontSize.md, color: Colors.textSecondary, textAlign: 'center' },
  overrideStar: { fontSize: FontSize.md, color: Colors.gold },
  total:    { fontSize: 48, fontWeight: FontWeight.bold, color: Colors.gold, textAlign: 'center' },
  scroll:   { maxHeight: 280 },
  row: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  rowLabel:    { fontSize: FontSize.sm, color: Colors.textPrimary, flex: 1 },
  rowValue:    { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.green },
  neg:         { color: Colors.red },
  overrideVal: { color: Colors.gold },
  empty:       { color: Colors.textDim, fontSize: FontSize.sm, textAlign: 'center', padding: Spacing.md },

  overrideBtn: {
    backgroundColor: Colors.gold + '22',
    borderRadius: Radius.md, padding: Spacing.sm,
    alignItems: 'center', borderWidth: 1, borderColor: Colors.gold + '66',
  },
  overrideBtnTxt: { color: Colors.gold, fontWeight: FontWeight.bold, fontSize: FontSize.sm },

  closeBtn: {
    backgroundColor: Colors.surface, borderRadius: Radius.md,
    padding: Spacing.sm, alignItems: 'center',
  },
  closeTxt: { color: Colors.textSecondary, fontSize: FontSize.md },
});
