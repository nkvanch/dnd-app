// app/creation/scores.tsx
// Ability score generation. Manual mode: no cap, starts at 10, free text entry.
import { useState, useEffect } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useCharacterStore } from '../../src/store/characterStore';
import { recomputeDerived } from '../../src/engine/pipeline';
import { recalculateAllHP, reapplyResolvedAsi, stripResolvedAsiStats } from '../../src/engine/leveling';
import { rollAbilityScoreSet } from '../../src/engine/dice';
import { useCustomRuleProfileStore } from '../../src/store/customRuleProfileStore';
import { resolveEffectiveCampaignRules } from '../../src/engine/customRuleProfiles';
import { adjustPointBuy, minimumPointBuyScores, normalizePointBuyConfig, pointBuyCost, validatePointBuy } from '../../src/engine/pointBuy';
import { Ability, AbilityScores } from '../../src/engine/types';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../../src/theme';

const ABILITIES: Ability[] = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
const ABILITY_LABELS: Record<Ability, string> = {
  str: 'Strength', dex: 'Dexterity', con: 'Constitution',
  int: 'Intelligence', wis: 'Wisdom', cha: 'Charisma',
};

const STANDARD_ARRAY = [15, 14, 13, 12, 10, 8];
type Method = 'standard' | 'pointbuy' | 'manual' | 'roll';

function getRaceBonuses(
  draft: ReturnType<typeof useCharacterStore.getState>['draft']
): Partial<Record<Ability, number>> {
  if (!draft) return {};
  const bonuses: Partial<Record<Ability, number>> = {};
  for (const feature of draft.features) {
    for (const effect of feature.effects) {
      if (
        effect.type === 'stat_modifier' &&
        effect.operation === 'add' &&
        typeof effect.value === 'number' &&
        ABILITIES.includes(effect.target as Ability)
      ) {
        const ab = effect.target as Ability;
        bonuses[ab] = (bonuses[ab] ?? 0) + (effect.value as number);
      }
    }
  }
  return bonuses;
}

const DEFAULT_SCORES: AbilityScores = { str:10, dex:10, con:10, int:10, wis:10, cha:10 };

export default function ScoresScreen() {
  const router   = useRouter();
  const draft    = useCharacterStore(s => s.draft);
  const setDraft = useCharacterStore(s => s.setDraft);
  const campaignRules = useCharacterStore(s => s.rules);
  const profiles = useCustomRuleProfileStore(s=>s.profiles);
  const rules = draft ? resolveEffectiveCampaignRules(campaignRules,draft,profiles) : campaignRules;

  // All hooks must be called before any conditional return
  const raceBonuses = getRaceBonuses(draft);

  // Pre-populate from existing stats if returning to this screen.
  // Re-audit A26: draft.stats is NOT the base score once an ASI has been
  // resolved — a resolved Ability Score Improvement writes its +2/+1+1
  // directly into stats (reapplyResolvedAsi's own doc comment: "the +2/+1+1
  // lives in base stats"). Populating this screen straight from draft.stats
  // meant reopening Scores after resolving an ASI, then confirming with
  // every field UNCHANGED, fed the ALREADY-BUMPED value back in as the new
  // "base" — and handleConfirm's own reapplyResolvedAsi call below then
  // added the SAME ASI on top a second time. stripResolvedAsiStats (already
  // built for the class-reselection case — same "unwind ASI stat bumps back
  // to true base" primitive) reconstructs the true pre-ASI base here, so
  // reapplyResolvedAsi's later re-application is the ONLY place the bonus
  // gets added, no matter how many times this screen is reopened/confirmed.
  // Race bonuses still need no subtraction — they live in features, not stats.
  const existingBase: AbilityScores = (() => {
    if (!draft) return DEFAULT_SCORES;
    const trueBase = stripResolvedAsiStats(draft).stats;
    const base = {} as AbilityScores;
    for (const ab of ABILITIES) {
      base[ab] = trueBase[ab];
    }
    return base;
  })();

  const configuredMethod=(draft?.customRuleProfileId ? rules.abilityGenerationMode : draft?.creationAbilityMode ?? rules.abilityGenerationMode ?? 'standard') as Method;
  const [method, setMethod] = useState<Method>(configuredMethod);
  const pb = normalizePointBuyConfig(rules.pointBuy);
  const [rolledScores, setRolledScores] = useState<number[]>([]);
  const [rollAssignments, setRollAssignments] = useState<Partial<Record<Ability, number>>>({});
  const [rollSelected, setRollSelected] = useState<number | null>(null);
  const [assignments,  setAssignments]  = useState<Partial<Record<Ability, number>>>({});
  const [selected,     setSelected]     = useState<number | null>(null);
  const [pbScores, setPbScores] = useState<AbilityScores>(()=>validatePointBuy(existingBase,pb).valid?existingBase:minimumPointBuyScores(pb));
  function persistPointBuy(next:AbilityScores){ setPbScores(next); if(draft)setDraft({...draft,stats:next,creationAbilityMode:'pointbuy'}); }
  // Manual: string-based so user can type freely; stored as strings in the input
  const [manualText,   setManualText]   = useState<Record<Ability, string>>(
    Object.fromEntries(ABILITIES.map(ab => [ab, String(existingBase[ab])])) as Record<Ability, string>
  );

  // Navigation guards — useEffect, never during render
  useEffect(() => {
    if (!draft) router.replace('/creation/name');
  }, [draft]);
  useEffect(() => {
    setMethod(configuredMethod);
    if (configuredMethod === 'pointbuy' && !validatePointBuy(pbScores,pb).valid) persistPointBuy(minimumPointBuyScores(pb));
  }, [configuredMethod, pb.budget, pb.minimum, pb.maximum]);

  if (!draft) return null;

  const usedIndices = Object.values(assignments) as number[];

  function assignStandard(ab: Ability, idx: number) {
    setAssignments(prev => {
      const next = { ...prev };
      for (const a of ABILITIES) { if (next[a] === idx) delete next[a]; }
      next[ab] = idx;
      return next;
    });
    setSelected(null);
  }

  const pointState=validatePointBuy(pbScores,pb);
  const pointsLeft=pointState.remaining;
  function adjustedPB(ab:Ability,delta:-1|1){return adjustPointBuy(pbScores,ab,delta,pb);}
  function adjustPB(ab:Ability,delta:-1|1){persistPointBuy(adjustedPB(ab,delta));}

  // Manual: parse the typed text, defaulting to 10 only when it's actually
  // empty. `parseInt(text) || 10` (the previous version) silently turned a
  // deliberately-typed "0" into 10 — the input still showed "0" but the
  // value that actually got saved on Confirm was 10, with the display and
  // the saved score disagreeing.
  function parseManualScore(ab: Ability): number {
    const text = manualText[ab];
    return text === '' ? 10 : parseInt(text, 10);
  }

  // Manual: stepper buttons adjust the parsed value
  function adjustManual(ab: Ability, delta: number) {
    const next = Math.max(1, parseManualScore(ab) + delta);
    setManualText(prev => ({ ...prev, [ab]: String(next) }));
  }

  // Manual: direct text entry — allow any numeric input
  function setManualRaw(ab: Ability, text: string) {
    // Allow empty string while typing, or digits only
    if (text === '' || /^\d+$/.test(text)) {
      setManualText(prev => ({ ...prev, [ab]: text }));
    }
  }

  function getBaseScore(ab: Ability): number | null {
    if (method === 'standard') {
      const idx = assignments[ab];
      return idx !== undefined ? STANDARD_ARRAY[idx] : null;
    }
    if (method === 'pointbuy') return pbScores[ab];
    if (method === 'roll') {
      const idx = rollAssignments[ab];
      return idx !== undefined ? (rolledScores[idx] ?? null) : null;
    }
    return parseManualScore(ab);
  }

  function canConfirm() {
    if (method === 'standard') return ABILITIES.every(ab => assignments[ab] !== undefined);
    if (method === 'roll') return rolledScores.length === 6 && ABILITIES.every(ab => rollAssignments[ab] !== undefined);
    if (method === 'pointbuy') {
      // pbScores is seeded from whatever the player last confirmed via a
      // DIFFERENT method (Manual has no cap, Roll can exceed 15) — switching
      // to this tab without touching a stepper must not let an out-of-budget
      // or out-of-range state slip through Confirm just because every
      // ability happens to already have a value.
      return pointState.valid;
    }
    return true;
  }

  function assignRoll(ab: Ability, idx: number) {
    setRollAssignments(prev => {
      const next = { ...prev };
      for (const a of ABILITIES) { if (next[a] === idx) delete next[a]; }
      next[ab] = idx;
      return next;
    });
    setRollSelected(null);
  }

  function handleConfirm() {
    if (!draft) return;
    const base = {} as AbilityScores;
    for (const ab of ABILITIES) {
      base[ab] = getBaseScore(ab) ?? 10;
    }
    const existingNotes = (() => {
      try { return JSON.parse(draft.notes || '{}'); } catch { return {}; }
    })();
    const withFlag: import('../../src/engine/types').Entity = {
      ...draft,
      stats: base,
      notes: JSON.stringify({ ...existingNotes, scoresConfirmed: true }),
      creationAbilityMode: method,
    };
    // Setting base stats wholesale would erase any ASI already resolved during
    // creation (the +2/+1+1 lives in base stats). Re-apply resolved ASIs on top
    // so re-confirming scores never silently loses an Ability Score Improvement.
    let updated = reapplyResolvedAsi(withFlag, rules);
    updated = recomputeDerived(updated, rules);
    // Recompute HP now that final CON is known, so the sheet/hub don't show a
    // stale value computed at class-selection time (e.g. HP 13 instead of 16
    // when CON was raised to 18 after choosing the class). Only meaningful once
    // a class (hit die) has been chosen.
    if (updated.identity.classId && updated.resources.hitDice.die > 0) {
      updated = recalculateAllHP(updated, rules);
      updated = recomputeDerived(updated, rules);
    }
    setDraft(updated);
    router.push('/creation/hub');
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

        <Text style={styles.heading}>Ability Scores</Text>
        <View style={styles.divider} />

        {/* Method tabs */}
        <View style={styles.tabs}>
          {(['standard','pointbuy','manual','roll'] as Method[]).map(m => (
            <Pressable key={m} testID={`ability-method-${m}`} style={[styles.tab, method===m && styles.tabActive]} onPress={() => { setMethod(m); if(m==='pointbuy'){const next=validatePointBuy(pbScores,pb).valid?pbScores:minimumPointBuyScores(pb);persistPointBuy(next);}else if(draft)setDraft({...draft,creationAbilityMode:m}); }}>
              <Text style={[styles.tabText, method===m && styles.tabTextActive]}>
                {m === 'standard' ? 'Standard' : m === 'pointbuy' ? 'Point Buy' : m === 'manual' ? 'Manual' : '4d6'}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Roll mode */}
        {method === 'roll' && (
          <>
            <Text style={styles.hint}>Roll 4d6, drop lowest. Tap a result, then tap an ability.</Text>
            <View style={styles.rollRow}>
              <Pressable style={styles.rerollBtn} onPress={() => {
                setRolledScores(rollAbilityScoreSet());
                setRollAssignments({});
                setRollSelected(null);
              }}>
                <Text style={styles.rerollBtnText}>🎲 Roll All</Text>
              </Pressable>
            </View>
            {rolledScores.length > 0 && (
              <View style={styles.arrayRow}>
                {rolledScores.map((v, i) => {
                  const used  = Object.values(rollAssignments).includes(i);
                  const isSel = rollSelected === i;
                  return (
                    <Pressable
                      key={i}
                      style={[styles.arrayVal, used && styles.arrayValUsed, isSel && styles.arrayValSelected]}
                      onPress={() => { if (!used) setRollSelected(isSel ? null : i); }}
                    >
                      <Text style={[styles.arrayValText, used && { color: Colors.textDim }]}>{v}</Text>
                    </Pressable>
                  );
                })}
              </View>
            )}
          </>
        )}

        {/* Standard array picker */}
        {method === 'standard' && (
          <>
            <Text style={styles.hint}>Tap a value, then tap an ability to assign it.</Text>
            <View style={styles.arrayRow}>
              {STANDARD_ARRAY.map((v, i) => {
                const used  = usedIndices.includes(i);
                const isSel = selected === i;
                return (
                  <Pressable
                    key={i}
                    style={[styles.arrayVal, used && styles.arrayValUsed, isSel && styles.arrayValSelected]}
                    onPress={() => { if (!used) setSelected(i); }}
                  >
                    <Text style={[styles.arrayValText, used && { color: Colors.textDim }]}>{v}</Text>
                  </Pressable>
                );
              })}
            </View>
          </>
        )}
        {method === 'pointbuy' && <Text testID="pointbuy-remaining" style={styles.hint}>Points remaining: {pointsLeft} / {pb.budget}  (scores {pb.minimum}–{pb.maximum})</Text>}
        {method === 'pointbuy' && <Pressable style={styles.resetBtn} onPress={()=>persistPointBuy(minimumPointBuyScores(pb))}><Text style={styles.resetTxt}>Reset to minimum</Text></Pressable>}
        {method === 'manual'   && <Text style={styles.hint}>Enter any value. Use +/− or type directly.</Text>}

        {/* Ability rows */}
        {ABILITIES.map(ab => {
          const base  = getBaseScore(ab);
          const bonus = raceBonuses[ab] ?? 0;
          return (
            <View key={ab} style={styles.abilityRow}>
              <Text style={styles.abilityLabel}>{ABILITY_LABELS[ab]}</Text>

              {/* Point Buy */}
              {method === 'pointbuy' && (
                <View style={styles.stepper}>
                  <Pressable testID={`pointbuy-${ab}-minus`} accessibilityLabel={`${ABILITY_LABELS[ab]} minus`} style={[styles.stepBtn,adjustedPB(ab,-1)===pbScores&&styles.stepDisabled]} disabled={adjustedPB(ab,-1)===pbScores} onPress={() => adjustPB(ab, -1)}>
                    <Text style={styles.stepBtnText}>−</Text>
                  </Pressable>
                  <View><ScoreDisplay base={base} bonus={bonus} /><Text style={styles.costTxt}>Cost {base===null?'—':pointBuyCost(base,pb)}</Text></View>
                  <Pressable testID={`pointbuy-${ab}-plus`} accessibilityLabel={`${ABILITY_LABELS[ab]} plus`} style={[styles.stepBtn,adjustedPB(ab,1)===pbScores&&styles.stepDisabled]} disabled={adjustedPB(ab,1)===pbScores} accessibilityHint={adjustedPB(ab,1)===pbScores?'Maximum reached or not enough points':undefined} onPress={() => adjustPB(ab, 1)}>
                    <Text style={styles.stepBtnText}>+</Text>
                  </Pressable>
                </View>
              )}

              {/* Manual — stepper + free text input */}
              {method === 'manual' && (
                <View style={styles.stepper}>
                  <Pressable style={styles.stepBtn} onPress={() => adjustManual(ab, -1)}>
                    <Text style={styles.stepBtnText}>−</Text>
                  </Pressable>
                  <View style={styles.manualBox}>
                    <TextInput
                      style={styles.manualInput}
                      value={manualText[ab]}
                      onChangeText={t => setManualRaw(ab, t)}
                      keyboardType="number-pad"
                      maxLength={3}
                      selectTextOnFocus
                    />
                    {bonus !== 0 && (
                      <Text style={styles.manualBonus}>
                        +{bonus} → {parseManualScore(ab) + bonus}
                      </Text>
                    )}
                  </View>
                  <Pressable style={styles.stepBtn} onPress={() => adjustManual(ab, 1)}>
                    <Text style={styles.stepBtnText}>+</Text>
                  </Pressable>
                </View>
              )}

              {/* Standard */}
              {method === 'standard' && (
                <Pressable
                  style={[styles.abilityBox, selected !== null && styles.abilityBoxReady, base !== null && styles.abilityBoxFilled]}
                  onPress={() => {
                    if (selected !== null) assignStandard(ab, selected);
                    else if (assignments[ab] !== undefined) {
                      setAssignments(prev => { const n = {...prev}; delete n[ab]; return n; });
                    }
                  }}
                >
                  <ScoreDisplay base={base} bonus={bonus} />
                </Pressable>
              )}

              {/* Roll */}
              {method === 'roll' && (
                <Pressable
                  style={[styles.abilityBox, rollSelected !== null && styles.abilityBoxReady, base !== null && styles.abilityBoxFilled]}
                  onPress={() => {
                    if (rollSelected !== null) assignRoll(ab, rollSelected);
                    else if (rollAssignments[ab] !== undefined) {
                      setRollAssignments(prev => { const n = {...prev}; delete n[ab]; return n; });
                    }
                  }}
                >
                  <ScoreDisplay base={base} bonus={bonus} />
                </Pressable>
              )}
            </View>
          );
        })}

        <View style={styles.divider} />
        <Pressable
          style={[styles.nextBtn, !canConfirm() && styles.nextBtnDisabled]}
          onPress={handleConfirm}
          disabled={!canConfirm()}
        >
          <Text style={styles.nextBtnText}>Confirm Scores</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function ScoreDisplay({ base, bonus }: { base: number | null; bonus: number }) {
  const total = base !== null ? base + bonus : null;
  const mod   = total !== null ? Math.floor((total - 10) / 2) : null;
  return (
    <View style={sd.box}>
      <Text style={sd.base}>{base ?? '—'}</Text>
      {bonus !== 0 && base !== null && <Text style={sd.bonus}>+{bonus} race</Text>}
      {total !== null && bonus !== 0 && (
        <Text style={sd.total}>= {total} ({mod! >= 0 ? `+${mod}` : mod})</Text>
      )}
      {total !== null && bonus === 0 && (
        <Text style={sd.mod}>{mod! >= 0 ? `+${mod}` : mod}</Text>
      )}
    </View>
  );
}

const sd = StyleSheet.create({
  box:   { alignItems: 'center', minWidth: 72 },
  base:  { fontSize: FontSize.lg, fontWeight: FontWeight.black, color: Colors.textPrimary },
  bonus: { fontSize: FontSize.xs, color: Colors.gold },
  total: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.green },
  mod:   { fontSize: FontSize.xs, color: Colors.textSecondary },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  content:   { padding: Spacing.lg, paddingBottom: Spacing.xxl },
  backBtn:   { marginBottom: Spacing.md },
  backBtnText: { fontSize: FontSize.md, color: Colors.gold, fontWeight: FontWeight.bold },
  heading:   { fontSize: FontSize.xxl, fontWeight: FontWeight.black, color: Colors.textPrimary, textAlign: 'center', marginBottom: Spacing.md },
  divider:   { height: 1, backgroundColor: Colors.border, marginVertical: Spacing.lg },
  costTxt: {fontSize:FontSize.xs,color:Colors.textDim,textAlign:'center'},
  resetBtn:{alignSelf:'center',padding:Spacing.sm}, resetTxt:{color:Colors.gold,fontSize:FontSize.sm,fontWeight:FontWeight.bold},
  hint:      { fontSize: FontSize.sm, color: Colors.textSecondary, marginBottom: Spacing.md, textAlign: 'center' },

  tabs: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.lg },
  tab: { flex: 1, paddingVertical: Spacing.sm, borderRadius: Radius.md, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, alignItems: 'center' },
  tabActive:     { backgroundColor: Colors.gold, borderColor: Colors.gold },
  tabText:       { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.textSecondary },
  tabTextActive: { color: Colors.bg },

  arrayRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.lg, justifyContent: 'center' },
  arrayVal: { width: 48, height: 48, borderRadius: Radius.md, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center' },
  arrayValUsed:     { opacity: 0.3 },
  arrayValSelected: { borderColor: Colors.gold, backgroundColor: Colors.goldDim },
  arrayValText:     { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.textPrimary },

  abilityRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.sm, paddingVertical: Spacing.xs, borderBottomWidth: 1, borderBottomColor: Colors.border },
  abilityLabel: { fontSize: FontSize.md, color: Colors.textPrimary, flex: 1 },
  abilityBox:   { alignItems: 'center', padding: Spacing.sm, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border },
  abilityBoxReady:  { borderColor: Colors.gold },
  abilityBoxFilled: { borderColor: Colors.green },

  stepper: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  stepBtn: { width: 32, height: 32, borderRadius: Radius.md, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center' },
  stepDisabled:{opacity:0.35},
  stepBtnText: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.gold },

  // Manual text input
  manualBox: { alignItems: 'center', minWidth: 72 },
  manualInput: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.gold,
    borderRadius: Radius.md,
    color: Colors.textPrimary,
    fontSize: FontSize.lg,
    fontWeight: FontWeight.black,
    textAlign: 'center',
    width: 64,
    height: 40,
    paddingVertical: 0,
    textAlignVertical: 'center',
    includeFontPadding: false,
  },
  manualBonus: { fontSize: FontSize.xs, color: Colors.gold, marginTop: 2 },

  nextBtn: { backgroundColor: Colors.gold, borderRadius: Radius.md, paddingVertical: Spacing.md, alignItems: 'center' },
  nextBtnDisabled: { backgroundColor: Colors.goldDim },
  nextBtnText: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.bg },

  rollRow:       { flexDirection: 'row', justifyContent: 'center', marginBottom: Spacing.md },
  rerollBtn:     { backgroundColor: Colors.gold, borderRadius: Radius.md, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm },
  rerollBtnText: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.bg },
});
