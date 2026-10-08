// src/components/InfusionPicker.tsx
// Resolves an 'infusion' pending choice — learning N new infusions (grows
// with Artificer level). Mirrors SubclassPicker.tsx's shape: presentational,
// applies through applyInfusionChoiceToEntity (bypasses resolveChoice, same
// reason ASI/feat/subclass do — pool is the 'all' sentinel).
import { useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { applyInfusionChoiceToEntity } from '../engine/leveling';
import { infusions } from '../content/runtimeRules';
import { Entity, ChoiceState, CampaignRules } from '../engine/types';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../theme';

export function InfusionPicker({
  entity,
  choice,
  rules,
  onResolved,
  onClose,
}: {
  entity:     Entity;
  choice:     ChoiceState;
  rules:      CampaignRules;
  onResolved: (updated: Entity) => void;
  onClose?:   () => void;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const known = entity.knownInfusionIds ?? [];
  const level = entity.identity.level;

  const options = useMemo(
    () => infusions().filter(i => i.minLevel <= level && !known.includes(i.id)),
    [level, known],
  );

  function toggle(id: string) {
    setSelected(prev => {
      if (prev.includes(id)) return prev.filter(x => x !== id);
      if (prev.length >= choice.definition.count) return prev;
      return [...prev, id];
    });
  }

  function commit() {
    if (selected.length !== choice.definition.count) return;
    onResolved(applyInfusionChoiceToEntity(entity, choice.id, selected, rules));
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.headerRow}>
        <Text style={styles.heading}>Learn Infusions</Text>
        {onClose && (
          <Pressable onPress={onClose} hitSlop={8}>
            <Text style={styles.close}>✕</Text>
          </Pressable>
        )}
      </View>
      <Text style={styles.sub}>{choice.definition.prompt}</Text>
      <Text style={styles.count}>Selected {selected.length}/{choice.definition.count}</Text>

      <View style={styles.list}>
        {options.map(i => {
          const isSel = selected.includes(i.id);
          return (
            <Pressable key={i.id} style={[styles.row, isSel && styles.rowSelected]} onPress={() => toggle(i.id)}>
              <View style={styles.rowHeader}>
                <Text style={styles.rowName}>{i.name}{isSel ? ' ✓' : ''}</Text>
                <Text style={styles.rowType}>{i.itemType}</Text>
              </View>
              <Text style={styles.rowDesc}>{i.description}</Text>
              {!i.feature && <Text style={styles.rowFlavor}>Flavor-only — no mechanical effect in-app yet.</Text>}
            </Pressable>
          );
        })}
        {options.length === 0 && (
          <Text style={styles.empty}>No new infusions available to learn at your level.</Text>
        )}
      </View>

      <Pressable
        style={[styles.applyBtn, selected.length !== choice.definition.count && styles.applyBtnDisabled]}
        disabled={selected.length !== choice.definition.count}
        onPress={commit}
      >
        <Text style={styles.applyTxt}>Learn {selected.length} Infusion{selected.length !== 1 ? 's' : ''} →</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  content:   { padding: Spacing.lg, paddingBottom: Spacing.xxl },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  heading:   { fontSize: FontSize.xxl, fontWeight: FontWeight.black, color: Colors.gold, marginBottom: Spacing.xs },
  close:     { fontSize: FontSize.xl, color: Colors.textSecondary, paddingLeft: Spacing.md },
  sub:       { fontSize: FontSize.md, color: Colors.textSecondary },
  count:     { fontSize: FontSize.sm, color: Colors.gold, fontWeight: FontWeight.bold, marginBottom: Spacing.md },
  empty:     { fontSize: FontSize.sm, color: Colors.textDim, fontStyle: 'italic', textAlign: 'center', padding: Spacing.lg },

  list: { gap: Spacing.sm, marginBottom: Spacing.lg },
  row: {
    backgroundColor: Colors.surface, borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.border, padding: Spacing.md,
  },
  rowSelected: { borderColor: Colors.gold, backgroundColor: Colors.gold + '22' },
  rowHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rowName: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  rowType: { fontSize: FontSize.xs, color: Colors.textDim, fontWeight: FontWeight.bold },
  rowDesc: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 4, lineHeight: 18 },
  rowFlavor: { fontSize: FontSize.xs, color: Colors.textDim, fontStyle: 'italic', marginTop: 4 },

  applyBtn: { backgroundColor: Colors.gold, borderRadius: Radius.md, paddingVertical: Spacing.md, alignItems: 'center' },
  applyBtnDisabled: { backgroundColor: Colors.goldDim },
  applyTxt: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.bg },
});
