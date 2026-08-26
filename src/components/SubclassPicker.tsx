// src/components/SubclassPicker.tsx
// Resolves a 'subclass' pending choice — the real picker that was missing
// entirely before this pass (every class previously either had no choice at
// all, or Rogue's broken pool:'all'-with-no-picker choice). Mirrors
// AsiFeatPicker.tsx's shape: presentational, applies through a dedicated
// engine helper (applySubclassToEntity — bypasses resolveChoice the same
// reason ASI/feat do, since the pool is the 'all' sentinel), hands the
// updated entity back via onResolved. Shared by creation and in-play sheet.
import { useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { applySubclassToEntity } from '../engine/leveling';
import { subclassEntriesForClassMerged, subclassFeaturesByLevel } from '../content/subclasses/subclassBrowse';
import { useHomebrewStore } from '../store/homebrewStore';
import { Entity, ChoiceState, CampaignRules } from '../engine/types';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../theme';

export function SubclassPicker({
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
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const homebrewSubclasses = useHomebrewStore(s => s.subclasses);

  const options = useMemo(
    () => subclassEntriesForClassMerged(entity.identity.classId, homebrewSubclasses),
    [entity.identity.classId, homebrewSubclasses],
  );

  function commit(subclassId: string) {
    const entry = options.find(o => o.id === subclassId);
    if (!entry) return;
    const updated = applySubclassToEntity(entity, choice.id, subclassId, entry.progression, rules);
    setExpandedId(null);
    onResolved(updated);
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.headerRow}>
        <Text style={styles.heading}>Choose Your Subclass</Text>
        {onClose && (
          <Pressable onPress={onClose} hitSlop={8}>
            <Text style={styles.close}>✕</Text>
          </Pressable>
        )}
      </View>
      <Text style={styles.sub}>{choice.definition.prompt}</Text>

      {options.length === 0 ? (
        <Text style={styles.empty}>
          No subclasses defined for this class yet — author one in the Homebrew tab, or check
          back once official content is added.
        </Text>
      ) : (
        <View style={styles.list}>
          {options.map(o => {
            const expanded = expandedId === o.id;
            const featureRows = expanded ? subclassFeaturesByLevel(o.progression) : [];
            return (
              <Pressable
                key={o.id}
                style={[styles.row, expanded && styles.rowExpanded]}
                onPress={() => setExpandedId(expanded ? null : o.id)}
              >
                <View style={styles.rowHeader}>
                  <Text style={styles.rowName}>{o.name}</Text>
                  <Text style={styles.rowLevel}>Unlocks Lv {o.unlockLevel}</Text>
                </View>
                <Text style={styles.rowBlurb} numberOfLines={expanded ? undefined : 2}>{o.blurb}</Text>
                {expanded && featureRows.length > 0 && (
                  <View style={styles.featureList}>
                    {featureRows.map(({ feature, level }) => (
                      <View key={feature.id} style={styles.featureRow}>
                        <Text style={styles.featureLevel}>Lv {level}</Text>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.featureName}>{feature.name}</Text>
                          <Text style={styles.featureDesc}>{feature.description}</Text>
                        </View>
                      </View>
                    ))}
                  </View>
                )}
                {expanded && (
                  <Pressable style={styles.takeBtn} onPress={() => commit(o.id)}>
                    <Text style={styles.takeTxt}>Take {o.name} →</Text>
                  </Pressable>
                )}
              </Pressable>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  content:   { padding: Spacing.lg, paddingBottom: Spacing.xxl },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  heading:   { fontSize: FontSize.xxl, fontWeight: FontWeight.black, color: Colors.gold, marginBottom: Spacing.xs },
  close:     { fontSize: FontSize.xl, color: Colors.textSecondary, paddingLeft: Spacing.md },
  sub:       { fontSize: FontSize.md, color: Colors.textSecondary, marginBottom: Spacing.xl },
  empty:     { fontSize: FontSize.sm, color: Colors.textDim, fontStyle: 'italic', textAlign: 'center', padding: Spacing.lg },

  list: { gap: Spacing.sm },
  row: {
    backgroundColor: Colors.surface, borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.border, padding: Spacing.md,
  },
  rowExpanded: { borderColor: Colors.gold, backgroundColor: Colors.gold + '11' },
  rowHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rowName:   { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  rowLevel:  { fontSize: FontSize.xs, color: Colors.textDim, fontWeight: FontWeight.bold },
  rowBlurb:  { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 4, lineHeight: 18 },

  featureList: { marginTop: Spacing.sm, gap: Spacing.xs },
  featureRow: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'flex-start' },
  featureLevel: { fontSize: FontSize.xs, color: Colors.gold, fontWeight: FontWeight.bold, width: 40 },
  featureName: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  featureDesc: { fontSize: FontSize.xs, color: Colors.textSecondary, lineHeight: 16, marginTop: 1 },

  takeBtn: {
    marginTop: Spacing.md, backgroundColor: Colors.gold, borderRadius: Radius.md,
    paddingVertical: Spacing.sm, alignItems: 'center',
  },
  takeTxt: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.bg },
});
