// src/components/FeaturePoolPicker.tsx
// Resolves a 'feature_pool' pending choice — "pick N options, each granting
// a different Feature" (Battle Master's maneuvers, Ranger Hunter's four
// sub-choices). Mirrors InfusionPicker.tsx's shape: presentational, applies
// through applyPoolChoiceToEntity (bypasses resolveChoice for the same
// reason ASI/feat/subclass/infusion do — each option needs its own outcome,
// not one shared `grants` array).
import { useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { applyPoolChoiceToEntity } from '../engine/leveling';
import { checkPrerequisites, splitSelection, cantripQualifies, lookupSpell } from '../engine/prerequisites';
import { originFeats } from '../content/runtimeRules';
import { Entity, ChoiceState, CampaignRules, Feature, ChoiceOption } from '../engine/types';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../theme';

export function FeaturePoolPicker({
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
  // A pool can be reused across multiple choice entries (e.g. Battle Master's
  // maneuver pool at L3/L7/L15) — exclude options whose Feature id the
  // character already has, so the same maneuver can't be picked twice.
  const knownFeatureIds = new Set(entity.features.map(f => f.id));
  const pool = (Array.isArray(choice.definition.pool) ? choice.definition.pool : [])
    .filter(opt => opt.repeatable || !knownFeatureIds.has((opt.value as Feature | undefined)?.id ?? ''));

  // A repeatable option (Agonizing Blast, Lessons of the First Ones) is taken once per target, so it lists its targets.
  const takenSelections = new Set<string>();
  for (const c of entity.choices) if (c.resolved) for (const sel of c.selections) takenSelections.add(String(sel));
  const targetsFor = (opt: ChoiceOption): { id: string; label: string }[] => {
    if (!opt.repeatable) return [];
    const raw = opt.repeatable.target === 'cantrip'
      ? (entity.spellcasting?.cantrips ?? []).flatMap(id => { const sp = lookupSpell(id); return sp && cantripQualifies(sp, opt.requires) ? [{ id, label: sp.name ?? id }] : []; })
      : originFeats().map(f => ({ id: f.id, label: f.name }));
    return raw.filter(t => !takenSelections.has(`${opt.id}::${t.id}`));
  };

  const classContext = choice.definition.forClassId ?? entity.identity.classId;
  // What stops an option being taken, given what is already selected in this sitting (an option can need another one
  // picked alongside it, such as Eldritch Smite with Pact of the Blade).
  const unmetFor = (optId: string, others: string[]): string[] =>
    checkPrerequisites(entity, pool.find(o => o.id === splitSelection(optId).optionId)?.requires,
      { alsoHeld: others.map(x => splitSelection(x).optionId).filter(x => x !== splitSelection(optId).optionId), classId: classContext }).unmet;

  function toggle(id: string) {
    setSelected(prev => {
      if (prev.includes(id)) {
        // Dropping an option also drops anything picked only because of it.
        let next = prev.filter(x => x !== id);
        let changed = true;
        while (changed) {
          const before = next.length;
          next = next.filter(x => unmetFor(x, next).length === 0);
          changed = next.length !== before;
        }
        return next;
      }
      if (prev.length >= choice.definition.count) return prev;
      if (unmetFor(id, prev).length > 0) return prev;
      return [...prev, id];
    });
  }

  const [error, setError] = useState<string | null>(null);
  function commit() {
    if (selected.length !== choice.definition.count) return;
    try { onResolved(applyPoolChoiceToEntity(entity, choice.id, selected, rules)); }
    catch (e) { setError(e instanceof Error ? e.message : 'That choice is not allowed.'); }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.headerRow}>
        <Text style={styles.heading}>{choice.definition.prompt}</Text>
        {onClose && (
          <Pressable onPress={onClose} hitSlop={8}>
            <Text style={styles.close}>✕</Text>
          </Pressable>
        )}
      </View>
      <Text style={styles.count}>Selected {selected.length}/{choice.definition.count}</Text>

      <View style={styles.list}>
        {pool.map(opt => {
          const feature = opt.value as Feature;
          const targets = targetsFor(opt);
          if (opt.repeatable) {
            const unmetRep = unmetFor(opt.id, selected);
            return (
              <View key={opt.id} style={[styles.row, unmetRep.length > 0 && styles.rowLocked]}>
                <Text style={styles.rowName}>{opt.label} (repeatable: choose {opt.repeatable.target === 'cantrip' ? 'a cantrip' : 'an Origin feat'})</Text>
                {unmetRep.length > 0 && <Text style={styles.rowUnmet}>Requires: {unmetRep.join(', ')}</Text>}
                {!!feature?.description && <Text style={styles.rowDesc}>{feature.description}</Text>}
                {unmetRep.length === 0 && targets.length === 0 && <Text style={styles.rowDesc}>No target left for this option.</Text>}
                {unmetRep.length === 0 && targets.map(t => {
                  const sel = `${opt.id}::${t.id}`;
                  const on = selected.includes(sel);
                  return (
                    <Pressable key={sel} style={[styles.row, on && styles.rowSelected, { marginTop: Spacing.xs }]} onPress={() => toggle(sel)}
                      accessibilityState={{ selected: on }}>
                      <Text style={styles.rowName}>{t.label}{on ? ' ✓' : ''}</Text>
                    </Pressable>
                  );
                })}
              </View>
            );
          }
          const isSel   = selected.includes(opt.id);
          const isReal  = !!feature?.activation;
          const unmet   = isSel ? [] : unmetFor(opt.id, selected);
          return (
            <Pressable key={opt.id} style={[styles.row, isSel && styles.rowSelected, unmet.length > 0 && styles.rowLocked]}
              onPress={() => toggle(opt.id)} disabled={unmet.length > 0}
              accessibilityState={{ disabled: unmet.length > 0, selected: isSel }}>
              <View style={styles.rowHeader}>
                <Text style={styles.rowName}>{opt.label}{isSel ? ' ✓' : ''}</Text>
                {!isReal && <Text style={styles.rowFlavorTag}>flavor-only</Text>}
              </View>
              {unmet.length > 0 && <Text style={styles.rowUnmet}>Requires: {unmet.join(', ')}</Text>}
              {!!feature?.description && <Text style={styles.rowDesc}>{feature.description}</Text>}
            </Pressable>
          );
        })}
        {pool.length === 0 && (
          <Text style={styles.empty}>No options available.</Text>
        )}
      </View>

      {error && <Text style={styles.rowUnmet}>{error}</Text>}
      <Pressable
        style={[styles.applyBtn, selected.length !== choice.definition.count && styles.applyBtnDisabled]}
        disabled={selected.length !== choice.definition.count}
        onPress={commit}
      >
        <Text style={styles.applyTxt}>Confirm {selected.length} Choice{selected.length !== 1 ? 's' : ''} →</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  content:   { padding: Spacing.lg, paddingBottom: Spacing.xxl },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  heading:   { flex: 1, fontSize: FontSize.xl, fontWeight: FontWeight.black, color: Colors.gold, marginBottom: Spacing.xs },
  close:     { fontSize: FontSize.xl, color: Colors.textSecondary, paddingLeft: Spacing.md },
  count:     { fontSize: FontSize.sm, color: Colors.gold, fontWeight: FontWeight.bold, marginBottom: Spacing.md },
  empty:     { fontSize: FontSize.sm, color: Colors.textDim, fontStyle: 'italic', textAlign: 'center', padding: Spacing.lg },

  list: { gap: Spacing.sm, marginBottom: Spacing.lg },
  row: {
    backgroundColor: Colors.surface, borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.border, padding: Spacing.md,
  },
  rowSelected: { borderColor: Colors.gold, backgroundColor: Colors.gold + '22' },
  rowLocked: { opacity: 0.55 },
  rowUnmet: { fontSize: FontSize.sm, color: Colors.red, marginTop: 4, fontWeight: FontWeight.bold },
  rowHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rowName: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.textPrimary, flexShrink: 1 },
  rowFlavorTag: { fontSize: FontSize.xs, color: Colors.textDim, fontStyle: 'italic' },
  rowDesc: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 4, lineHeight: 18 },

  applyBtn: { backgroundColor: Colors.gold, borderRadius: Radius.md, paddingVertical: Spacing.md, alignItems: 'center' },
  applyBtnDisabled: { backgroundColor: Colors.goldDim },
  applyTxt: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.bg },
});
