// app/sheet/AuditModal.tsx
// Tappable stat → full audit trail breakdown modal.
// Two view modes:
//   Technical (default): labelled list of contributors with values.
//   Plain:              single readable sentence, e.g.
//                       "17 = 10 base + 3 DEX modifier + 2 Chain Shirt + 2 Shield"
// When isDm=true, shows an [Override] button on each scalar stat.
import { useState } from 'react';
import { Modal, View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { Entity, CampaignRules, AuditEntry } from '../../engine/types';
import { explainValue } from '../../engine/audit';
import { hasActiveOverride } from '../../engine/dmOverride';
import { DmOverrideModal } from './DmOverrideModal';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../../theme';

// ── Plain-language sentence builder ──────────────────────────────────────────────

function buildPlainSentence(total: number, entries: AuditEntry[]): string {
  if (entries.length === 0) return `${total}`;

  const parts = entries
    .filter(e => e.value !== 0)  // skip zero-value contributors (notes/labels)
    .map((e, i) => {
      const sign = i === 0 ? '' : e.value > 0 ? '+ ' : '\u2212 ';
      const abs  = i === 0 ? String(e.value) : String(Math.abs(e.value));
      return `${sign}${abs} ${e.label}`;
    });

  return `${total} = ${parts.join('  ')}`.trim();
}

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
  const [mode, setMode] = useState<'technical' | 'plain'>('technical');

  const trail    = stat ? explainValue(entity, stat) : null;
  const hasOv    = stat ? hasActiveOverride(entity, stat) : false;
  const total    = trail?.total ?? 0;
  const entries  = trail?.entries ?? [];

  return (
    <>
      <Modal visible={!!stat} transparent animationType="fade" onRequestClose={onClose}>
        <Pressable style={styles.backdrop} onPress={onClose}>
          <Pressable style={styles.sheet} onPress={e => e.stopPropagation()}>

            {/* Header */}
            <View style={styles.titleRow}>
              <Text style={styles.title}>{label}</Text>
              {hasOv && <Text style={styles.overrideStar}>✱</Text>}
            </View>

            <Text style={styles.total}>{total}</Text>

            {/* Mode toggle */}
            <View style={styles.modeRow}>
              <Pressable
                style={[styles.modeBtn, mode === 'plain' && styles.modeBtnActive]}
                onPress={() => setMode('plain')}
              >
                <Text style={[styles.modeTxt, mode === 'plain' && styles.modeTxtActive]}>
                  Plain
                </Text>
              </Pressable>
              <Pressable
                style={[styles.modeBtn, mode === 'technical' && styles.modeBtnActive]}
                onPress={() => setMode('technical')}
              >
                <Text style={[styles.modeTxt, mode === 'technical' && styles.modeTxtActive]}>
                  Technical
                </Text>
              </Pressable>
            </View>

            {/* Plain-language view */}
            {mode === 'plain' && (
              <View style={styles.plainCard}>
                {entries.length === 0 ? (
                  <Text style={styles.empty}>No breakdown available.</Text>
                ) : (
                  <Text style={styles.plainSentence}>
                    {buildPlainSentence(total, entries)}
                  </Text>
                )}
              </View>
            )}

            {/* Technical view */}
            {mode === 'technical' && (
              <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
                {entries.map((e, i) => (
                  <View key={i} style={styles.row}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.rowLabel}>{e.label}</Text>
                      {e.replacement && <Text style={styles.replacement}>{e.replacement.from} → {e.replacement.to}</Text>}
                    </View>
                    {!e.replacement && <Text style={[
                      styles.rowValue,
                      e.value < 0 && styles.neg,
                      e.sourceKind === 'dm_override' && styles.overrideVal,
                    ]}>
                      {e.value >= 0 ? `+${e.value}` : String(e.value)}
                      {e.sourceKind === 'dm_override' && ' ✱'}
                    </Text>}
                  </View>
                ))}
                {entries.length === 0 && (
                  <Text style={styles.empty}>No breakdown available.</Text>
                )}
              </ScrollView>
            )}

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
  titleRow:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  title:        { fontSize: FontSize.md, color: Colors.textSecondary, textAlign: 'center' },
  overrideStar: { fontSize: FontSize.md, color: Colors.gold },
  total:        { fontSize: 48, fontWeight: FontWeight.bold, color: Colors.gold, textAlign: 'center' },

  // Mode toggle
  modeRow: {
    flexDirection:   'row',
    backgroundColor: Colors.surface,
    borderRadius:    Radius.md,
    borderWidth:     1,
    borderColor:     Colors.border,
    padding:         2,
    gap:             2,
  },
  modeBtn: {
    flex: 1, paddingVertical: Spacing.xs,
    borderRadius: Radius.sm - 2, alignItems: 'center',
  },
  modeBtnActive:  { backgroundColor: Colors.surfaceHigh },
  modeTxt:        { fontSize: FontSize.xs, color: Colors.textDim, fontWeight: FontWeight.bold },
  modeTxtActive:  { color: Colors.gold },

  // Plain view
  plainCard: {
    backgroundColor: Colors.surface,
    borderRadius:    Radius.md,
    borderWidth:     1,
    borderColor:     Colors.border,
    padding:         Spacing.md,
    minHeight:       60,
    justifyContent:  'center',
  },
  plainSentence: {
    fontSize:   FontSize.md,
    color:      Colors.textPrimary,
    lineHeight: 24,
    textAlign:  'center',
  },

  // Technical view
  scroll: { maxHeight: 240 },
  row: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  rowLabel:    { fontSize: FontSize.sm, color: Colors.textPrimary, flex: 1 },
  replacement: { fontSize: FontSize.md, color: Colors.gold, marginTop: 2 },
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
