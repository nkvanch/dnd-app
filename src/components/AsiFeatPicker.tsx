// src/components/AsiFeatPicker.tsx
// Shared Ability Score Improvement / Feat picker.
// Presentational + applies the choice through the engine's ASI/feat helpers,
// then hands the updated entity back via onResolved. Used by the creation
// level-up screen and the in-play (sheet) level-up modal so the two never drift.
import { useState, useMemo } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, TextInput } from 'react-native';
import { applyAsiToEntity, applyFeatToEntity } from '../engine/leveling';
import { applyStatModifiers, collectAllEffects } from '../engine/pipeline';
import { ALL_FEATS } from '../content/feats/index';
import { Entity, ChoiceState, CampaignRules, Ability } from '../engine/types';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../theme';

const ABILITIES: { key: Ability; label: string }[] = [
  { key: 'str', label: 'Strength'     },
  { key: 'dex', label: 'Dexterity'   },
  { key: 'con', label: 'Constitution' },
  { key: 'int', label: 'Intelligence' },
  { key: 'wis', label: 'Wisdom'       },
  { key: 'cha', label: 'Charisma'     },
];

type Mode = '+2' | '+1+1' | 'feat';

export function AsiFeatPicker({
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
  const [mode,   setMode]   = useState<Mode>('+2');
  const [first,  setFirst]  = useState<Ability | null>(null);
  const [second, setSecond] = useState<Ability | null>(null);
  const [featId, setFeatId] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const maxScore = rules.maxAbilityScore ?? 20;

  // EFFECTIVE scores (base + racial/feat effects) — must match what the sheet's
  // Abilities tab shows, and the PHB cap of 20 applies to the effective score.
  const effectiveStats = useMemo(
    () => applyStatModifiers(entity.stats, collectAllEffects(entity)),
    [entity],
  );

  const takenFeatIds = useMemo(
    () => new Set(entity.features.filter(f => f.source.kind === 'feat').map(f => f.source.refId)),
    [entity.features],
  );
  const filteredFeats = useMemo(() => {
    const q = search.trim().toLowerCase();
    return ALL_FEATS
      .filter(f => !takenFeatIds.has(f.id))
      .filter(f => q === '' || f.name.toLowerCase().includes(q) || f.description.toLowerCase().includes(q));
  }, [search, takenFeatIds]);

  function canApply(): boolean {
    if (mode === '+2')   return first !== null;
    if (mode === '+1+1') return first !== null && second !== null && first !== second;
    return featId !== null;
  }

  function handleApply() {
    if (!canApply()) return;
    let updated: Entity;

    if (mode === 'feat' && featId) {
      const feat = ALL_FEATS.find(f => f.id === featId);
      if (!feat) return;
      updated = applyFeatToEntity(entity, choice.id, choice.grantedAt, feat.feature, feat.id, rules);
    } else {
      const increases: Partial<Record<Ability, number>> = {};
      if (mode === '+2' && first) {
        increases[first] = 2;
      } else if (mode === '+1+1' && first && second) {
        increases[first]  = (increases[first]  ?? 0) + 1;
        increases[second] = (increases[second] ?? 0) + 1;
      }
      updated = applyAsiToEntity(entity, choice.id, increases, rules);
    }

    // Reset local selection so the next pending choice (if any) starts clean.
    setMode('+2'); setFirst(null); setSecond(null); setFeatId(null); setSearch('');
    onResolved(updated);
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.headerRow}>
        <Text style={styles.heading}>Ability Score Improvement</Text>
        {onClose && (
          <Pressable onPress={onClose} hitSlop={8}>
            <Text style={styles.close}>✕</Text>
          </Pressable>
        )}
      </View>
      <Text style={styles.sub}>{choice.definition.prompt}</Text>

      {/* Mode picker */}
      <View style={styles.modeRow}>
        <Pressable
          style={[styles.modeBtn, mode === '+2' && styles.modeBtnActive]}
          onPress={() => { setMode('+2'); setFirst(null); setSecond(null); setFeatId(null); }}
        >
          <Text style={[styles.modeBtnTxt, mode === '+2' && styles.modeBtnTxtActive]}>+2 one</Text>
        </Pressable>
        <Pressable
          style={[styles.modeBtn, mode === '+1+1' && styles.modeBtnActive]}
          onPress={() => { setMode('+1+1'); setFirst(null); setSecond(null); setFeatId(null); }}
        >
          <Text style={[styles.modeBtnTxt, mode === '+1+1' && styles.modeBtnTxtActive]}>+1 two</Text>
        </Pressable>
        <Pressable
          style={[styles.modeBtn, mode === 'feat' && styles.modeBtnActive]}
          onPress={() => { setMode('feat'); setFirst(null); setSecond(null); }}
        >
          <Text style={[styles.modeBtnTxt, mode === 'feat' && styles.modeBtnTxtActive]}>Feat</Text>
        </Pressable>
      </View>

      {mode === 'feat' ? (
        <>
          <TextInput
            style={styles.search}
            placeholder="Search feats…"
            placeholderTextColor={Colors.textSecondary}
            value={search}
            onChangeText={setSearch}
          />
          <View style={styles.featList}>
            {filteredFeats.map(f => {
              const selected = featId === f.id;
              return (
                <Pressable
                  key={f.id}
                  style={[styles.featRow, selected && styles.featRowSelected]}
                  onPress={() => setFeatId(selected ? null : f.id)}
                >
                  <View style={styles.featHeader}>
                    <Text style={styles.featName}>{f.name}</Text>
                    {selected && <Text style={styles.featCheck}>✓</Text>}
                  </View>
                  {f.prerequisite && (
                    <Text style={styles.featPrereq}>Prerequisite: {f.prerequisite}</Text>
                  )}
                  <Text style={styles.featDesc} numberOfLines={selected ? undefined : 2}>
                    {f.description}
                  </Text>
                  <Text style={styles.featSource}>{f.source}</Text>
                </Pressable>
              );
            })}
            {filteredFeats.length === 0 && (
              <Text style={styles.featEmpty}>No feats match “{search}”.</Text>
            )}
          </View>
        </>
      ) : (
        <>
          <Text style={styles.pickLabel}>
            {mode === '+2'
              ? 'Pick one ability to increase by 2:'
              : first === null
                ? 'Pick first ability (+1):'
                : 'Pick second ability (+1):'}
          </Text>

          <View style={styles.abilityGrid}>
            {ABILITIES.map(({ key, label }) => {
              const score      = effectiveStats[key];
              const isFirst    = first  === key;
              const isSecond   = second === key;
              const isSelected = isFirst || isSecond;
              const maxed      = score >= maxScore;
              const plus       = mode === '+2' ? (isFirst ? 2 : 0) : (isFirst ? 1 : isSecond ? 1 : 0);
              const newScore   = Math.min(maxScore, score + plus);

              return (
                <Pressable
                  key={key}
                  style={[styles.abilityBtn, isSelected && styles.abilityBtnSelected, maxed && styles.abilityBtnMaxed]}
                  disabled={maxed}
                  onPress={() => {
                    if (mode === '+2') {
                      setFirst(key);
                    } else {
                      if (first === null) {
                        setFirst(key);
                      } else if (second === null && key !== first) {
                        setSecond(key);
                      } else if (key === first) {
                        setFirst(second);
                        setSecond(null);
                      } else if (key === second) {
                        setSecond(null);
                      }
                    }
                  }}
                >
                  <Text style={styles.abilityLabel}>{label}</Text>
                  <Text style={styles.abilityScore}>
                    {score}
                    {isSelected && plus > 0 ? (
                      <Text style={styles.abilityIncrease}> → {newScore}</Text>
                    ) : null}
                  </Text>
                  {maxed && <Text style={styles.abilityMaxed}>Max</Text>}
                </Pressable>
              );
            })}
          </View>
        </>
      )}

      <Pressable
        style={[styles.applyBtn, !canApply() && styles.applyBtnDisabled]}
        onPress={handleApply}
        disabled={!canApply()}
      >
        <Text style={styles.applyBtnTxt}>
          {mode === 'feat' ? 'Take Feat →' : 'Apply Improvement →'}
        </Text>
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
  sub:       { fontSize: FontSize.md, color: Colors.textSecondary, marginBottom: Spacing.xl },

  modeRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.lg },
  modeBtn: {
    flex: 1, padding: Spacing.md, borderRadius: Radius.md,
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    alignItems: 'center',
  },
  modeBtnActive:    { borderColor: Colors.gold, backgroundColor: Colors.gold + '22' },
  modeBtnTxt:       { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.textSecondary },
  modeBtnTxtActive: { color: Colors.gold },

  pickLabel: { fontSize: FontSize.sm, color: Colors.textSecondary, marginBottom: Spacing.md, fontWeight: FontWeight.bold },

  abilityGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.xl },
  abilityBtn: {
    width: '30%', backgroundColor: Colors.surface, borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.border, padding: Spacing.sm, alignItems: 'center',
  },
  abilityBtnSelected: { borderColor: Colors.gold, backgroundColor: Colors.gold + '22' },
  abilityBtnMaxed:    { opacity: 0.4 },
  abilityLabel:    { fontSize: FontSize.xs, color: Colors.textSecondary, letterSpacing: 1, fontWeight: FontWeight.bold },
  abilityScore:    { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.textPrimary, marginTop: 2 },
  abilityIncrease: { fontSize: FontSize.md, color: Colors.green },
  abilityMaxed:    { fontSize: FontSize.xs, color: Colors.red },

  search: {
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    color: Colors.textPrimary, fontSize: FontSize.md, marginBottom: Spacing.md,
  },
  featList: { gap: Spacing.sm, marginBottom: Spacing.xl },
  featRow: {
    backgroundColor: Colors.surface, borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.border, padding: Spacing.md,
  },
  featRowSelected: { borderColor: Colors.gold, backgroundColor: Colors.gold + '22' },
  featHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  featName:   { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  featCheck:  { fontSize: FontSize.md, color: Colors.gold, fontWeight: FontWeight.bold },
  featPrereq: { fontSize: FontSize.xs, color: Colors.gold, marginTop: 2, fontStyle: 'italic' },
  featDesc:   { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 4, lineHeight: 18 },
  featSource: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 4, opacity: 0.6 },
  featEmpty:  { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center', padding: Spacing.lg },

  applyBtn: {
    backgroundColor: Colors.gold, borderRadius: Radius.md,
    paddingVertical: Spacing.md, alignItems: 'center',
  },
  applyBtnDisabled: { backgroundColor: Colors.goldDim },
  applyBtnTxt:      { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.bg },
});
