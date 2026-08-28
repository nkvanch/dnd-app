// src/components/AsiFeatPicker.tsx
// Shared Ability Score Improvement / Feat picker.
// Presentational + applies the choice through the engine's ASI/feat helpers,
// then hands the updated entity back via onResolved. Used by the creation
// level-up screen and the in-play (sheet) level-up modal so the two never drift.
import { useState, useMemo, useEffect } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, TextInput, Modal } from 'react-native';
import { applyAsiToEntity, applyFeatToEntity } from '../engine/leveling';
import { applyStatModifiers, collectAllEffects } from '../engine/pipeline';
import { evaluatePrerequisite } from '../engine/featPrereq';
import { asiMode as getAsiMode } from '../engine/houseRules';
import { ALL_FEATS } from '../content/feats/index';
import { useHomebrewStore } from '../store/homebrewStore';
import { Entity, ChoiceState, CampaignRules, Ability, SkillName, Feat } from '../engine/types';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../theme';

const ABILITIES: { key: Ability; label: string }[] = [
  { key: 'str', label: 'Strength'     },
  { key: 'dex', label: 'Dexterity'   },
  { key: 'con', label: 'Constitution' },
  { key: 'int', label: 'Intelligence' },
  { key: 'wis', label: 'Wisdom'       },
  { key: 'cha', label: 'Charisma'     },
];

const SKILL_LIST: { key: SkillName; label: string }[] = [
  { key: 'athletics', label: 'Athletics' }, { key: 'acrobatics', label: 'Acrobatics' },
  { key: 'sleight_of_hand', label: 'Sleight of Hand' }, { key: 'stealth', label: 'Stealth' },
  { key: 'arcana', label: 'Arcana' }, { key: 'history', label: 'History' },
  { key: 'investigation', label: 'Investigation' }, { key: 'nature', label: 'Nature' },
  { key: 'religion', label: 'Religion' }, { key: 'animal_handling', label: 'Animal Handling' },
  { key: 'insight', label: 'Insight' }, { key: 'medicine', label: 'Medicine' },
  { key: 'perception', label: 'Perception' }, { key: 'survival', label: 'Survival' },
  { key: 'deception', label: 'Deception' }, { key: 'intimidation', label: 'Intimidation' },
  { key: 'performance', label: 'Performance' }, { key: 'persuasion', label: 'Persuasion' },
];

type Mode = '+2' | '+1+1' | 'feat';

export function AsiFeatPicker({
  entity,
  choice,
  rules,
  onResolved,
  onClose,
  featOnly = false,
}: {
  entity:     Entity;
  choice:     ChoiceState;
  rules:      CampaignRules;
  onResolved: (updated: Entity) => void;
  onClose?:   () => void;
  /** When true, only the Feat path is shown (used for feats taken at creation). */
  featOnly?:  boolean;
}) {
  const [mode,   setMode]   = useState<Mode>(
    featOnly ? 'feat' : '+2'
  );
  // The table's ASI rule controls which paths are offered. featOnly (a feat
  // taken at creation, not an ASI level) always forces the feat path.
  const ruleAsiMode = featOnly ? 'feat_only' : getAsiMode(rules);
  // 'both' = the player gets an ASI AND a feat at this level. We collect the ASI
  // first, then require a feat before applying both together.
  const requireBoth = ruleAsiMode === 'both';
  // Which top-level paths the mode picker exposes.
  const showAsiTabs  = ruleAsiMode === 'asi_or_feat' || ruleAsiMode === 'asi_only' || ruleAsiMode === 'both';
  const showFeatTab  = ruleAsiMode === 'asi_or_feat' || ruleAsiMode === 'feat_only';
  const [first,  setFirst]  = useState<Ability | null>(null);
  const [second, setSecond] = useState<Ability | null>(null);
  const [featId, setFeatId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  // When a player selects a feat whose prerequisite isn't met, we stash it here
  // to drive the "get anyway" confirmation popup.
  const [overridePrompt, setOverridePrompt] = useState<{ featId: string; reason: string } | null>(null);
  // For feats that grant "+1 to one of N abilities (your choice)", the player's pick.
  const [featAbility, setFeatAbility] = useState<Ability | null>(null);
  // For skill-granting feats: map of pick id -> chosen skill.
  const [featSkills, setFeatSkills] = useState<Record<string, SkillName>>({});
  // 'both' mode: after the ASI is applied we stash the updated entity here and
  // switch to the feat step; the feat is then applied on top of it.
  const [bothEntity, setBothEntity] = useState<Entity | null>(null);

  const maxScore = rules.maxAbilityScore ?? Infinity;
  // When the table rule is feat-only (but not the creation featOnly prop),
  // force the feat path on mount.
  useEffect(() => {
    if (ruleAsiMode === 'feat_only' && !featOnly) setMode('feat');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const homebrewFeatures = useHomebrewStore(s => s.features);

  // Homebrew "features" (built in the Feature Editor) are authored with
  // source: {kind:'feat', refId: id} — they're standalone custom feats.
  // Reshape them to the Feat type so they slot into the same list, search,
  // dedup, and apply path as the 82 official feats.
  const homebrewFeats: Feat[] = useMemo(
    () => homebrewFeatures.map(f => ({
      id: f.id, name: f.name, prerequisite: null,
      description: f.description, source: 'Homebrew', feature: f,
    })),
    [homebrewFeatures],
  );
  // Real homebrew feats authored via app/homebrew/feat-builder.tsx — merged
  // alongside the Feature-Editor workaround above, not replacing it (no
  // migration, existing homebrew feats made the old way keep working).
  const homebrewRealFeats = useHomebrewStore(s => s.feats);
  const allFeats = useMemo(
    () => [...ALL_FEATS, ...homebrewFeats, ...homebrewRealFeats],
    [homebrewFeats, homebrewRealFeats],
  );

  // Evaluate each feat's prerequisite against the current entity once.
  const prereqById = useMemo(() => {
    const map: Record<string, ReturnType<typeof evaluatePrerequisite>> = {};
    for (const f of allFeats) map[f.id] = evaluatePrerequisite(entity, f.prerequisite);
    return map;
  }, [allFeats, entity]);

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
    return allFeats
      .filter(f => !takenFeatIds.has(f.id))
      .filter(f => q === '' || f.name.toLowerCase().includes(q) || f.description.toLowerCase().includes(q));
  }, [search, takenFeatIds, allFeats]);

  function canApply(): boolean {
    if (mode === '+2')   return first !== null;
    if (mode === '+1+1') return first !== null && second !== null && first !== second;
    // Feat mode: need a feat, and if it has an ability/skill choice, those too.
    if (featId === null) return false;
    const f = allFeats.find(x => x.id === featId);
    if (f?.abilityChoice && featAbility === null) return false;
    if (f?.skillChoice && f.skillChoice.picks.some(p => !featSkills[p.id])) return false;
    return true;
  }

  // Build the feature to apply: inject the chosen ability's stat_modifier and
  // any chosen skill proficiencies/expertise so they land through the pipeline.
  function featureToApply(f: Feat): Feat['feature'] {
    const extra: Feat['feature']['effects'] = [];
    if (f.abilityChoice && featAbility) {
      extra.push({
        type: 'stat_modifier', target: featAbility,
        operation: 'add', value: f.abilityChoice.amount, condition: null,
      });
    }
    if (f.skillChoice) {
      for (const pick of f.skillChoice.picks) {
        const sk = featSkills[pick.id];
        if (!sk) continue;
        extra.push({
          type: 'grant_proficiency', target: `skill:${sk}`,
          // 'add' = proficiency, 'multiply' = expertise (per the pipeline).
          operation: pick.mode === 'expertise' ? 'multiply' : 'add',
          value: null, condition: null,
        });
      }
    }
    if (extra.length === 0) return f.feature;
    return { ...f.feature, effects: [...f.feature.effects, ...extra] };
  }

  function commitFeat(id: string) {
    const feat = allFeats.find(f => f.id === id);
    if (!feat) return;
    // Block commit if an ability or skill choice is required but unmade. This
    // can happen via the "take anyway" popup, which bypasses canApply — close
    // the popup and select the feat so its inline pickers show.
    const needsAbility = !!feat.abilityChoice && !featAbility;
    const needsSkill   = !!feat.skillChoice && feat.skillChoice.picks.some(p => !featSkills[p.id]);
    if (needsAbility || needsSkill) {
      setOverridePrompt(null);
      setFeatId(id);
      return;
    }
    // Resilient-style feats: the chosen ability also grants proficiency in that
    // ability's saving throws. Saving-throw proficiency is read directly from
    // entity.proficiencies.savingThrows (no effect path), so add it here before
    // the feat's feature and ability bonus are applied.
    let baseEntity = bothEntity ?? entity;
    if (feat.abilityChoice?.grantsSaveProficiency && featAbility &&
        !baseEntity.proficiencies.savingThrows.includes(featAbility)) {
      baseEntity = {
        ...baseEntity,
        proficiencies: {
          ...baseEntity.proficiencies,
          savingThrows: [...baseEntity.proficiencies.savingThrows, featAbility],
        },
      };
    }
    const updated = applyFeatToEntity(baseEntity, choice.id, choice.grantedAt, featureToApply(feat), feat.id, rules);
    setMode('+2'); setFirst(null); setSecond(null); setFeatId(null); setSearch('');
    setFeatAbility(null);
    setFeatSkills({});
    setOverridePrompt(null);
    setBothEntity(null);
    onResolved(updated);
  }

  // Tapping a feat row: if its prerequisite is unmet, raise the "get anyway"
  // popup instead of selecting immediately. Met feats select normally.
  function onFeatTap(id: string) {
    if (featId === id) { setFeatId(null); setFeatAbility(null); setFeatSkills({}); return; }
    setFeatAbility(null);
    setFeatSkills({});
    const res = prereqById[id];
    if (res && !res.met) {
      setOverridePrompt({ featId: id, reason: res.reason });
      return;
    }
    setFeatId(id);
  }

  function handleApply() {
    if (!canApply()) return;

    if (mode === 'feat' && featId) {
      commitFeat(featId);
      return;
    }

    const increases: Partial<Record<Ability, number>> = {};
    if (mode === '+2' && first) {
      increases[first] = 2;
    } else if (mode === '+1+1' && first && second) {
      increases[first]  = (increases[first]  ?? 0) + 1;
      increases[second] = (increases[second] ?? 0) + 1;
    }
    const asiUpdated = applyAsiToEntity(entity, choice.id, increases, rules);

    if (requireBoth) {
      // ASI done — now require a feat. Stash the ASI-applied entity and move to
      // the feat step; commitFeat applies the feat on top before resolving.
      setBothEntity(asiUpdated);
      setMode('feat');
      setFirst(null); setSecond(null);
      return;
    }

    setMode('+2'); setFirst(null); setSecond(null); setFeatId(null); setSearch('');
    onResolved(asiUpdated);
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.headerRow}>
        <Text style={styles.heading}>{featOnly ? 'Choose a Feat' : 'Ability Score Improvement'}</Text>
        {onClose && (
          <Pressable onPress={onClose} hitSlop={8}>
            <Text style={styles.close}>✕</Text>
          </Pressable>
        )}
      </View>
      <Text style={styles.sub}>{choice.definition.prompt}</Text>

      {/* Mode picker — visibility depends on the table's ASI rule. */}
      {!featOnly && (showAsiTabs || showFeatTab) && (
        <>
          {requireBoth && (
            <Text style={styles.bothHint}>
              {bothEntity
                ? 'Ability increase applied — now choose a feat to finish.'
                : 'This table grants BOTH an ability increase AND a feat. Choose your increase first.'}
            </Text>
          )}
          <View style={styles.modeRow}>
            {showAsiTabs && (
              <>
                <Pressable
                  style={[styles.modeBtn, mode === '+2' && styles.modeBtnActive]}
                  onPress={() => { setMode('+2'); setFirst(null); setSecond(null); setFeatId(null); }}
                  disabled={requireBoth && !!bothEntity}
                >
                  <Text style={[styles.modeBtnTxt, mode === '+2' && styles.modeBtnTxtActive]}>+2 one</Text>
                </Pressable>
                <Pressable
                  style={[styles.modeBtn, mode === '+1+1' && styles.modeBtnActive]}
                  onPress={() => { setMode('+1+1'); setFirst(null); setSecond(null); setFeatId(null); }}
                  disabled={requireBoth && !!bothEntity}
                >
                  <Text style={[styles.modeBtnTxt, mode === '+1+1' && styles.modeBtnTxtActive]}>+1 two</Text>
                </Pressable>
              </>
            )}
            {(showFeatTab || requireBoth) && (
              <Pressable
                style={[styles.modeBtn, mode === 'feat' && styles.modeBtnActive]}
                onPress={() => { if (!requireBoth || bothEntity) setMode('feat'); setFirst(null); setSecond(null); }}
                disabled={requireBoth && !bothEntity}
              >
                <Text style={[styles.modeBtnTxt, mode === 'feat' && styles.modeBtnTxtActive]}>Feat</Text>
              </Pressable>
            )}
          </View>
        </>
      )}

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
              const pr = prereqById[f.id];
              const unmet = pr && !pr.met;
              return (
                <Pressable
                  key={f.id}
                  style={[styles.featRow, selected && styles.featRowSelected, unmet && styles.featRowUnmet]}
                  onPress={() => onFeatTap(f.id)}
                >
                  <View style={styles.featHeader}>
                    <Text style={styles.featName}>{f.name}</Text>
                    {selected && <Text style={styles.featCheck}>✓</Text>}
                    {unmet && !selected && <Text style={styles.featLock}>⚠</Text>}
                  </View>
                  {f.prerequisite && (
                    <Text style={[styles.featPrereq, unmet && styles.featPrereqUnmet]}>
                      Prerequisite: {f.prerequisite}{unmet ? ' — not met' : ' ✓'}
                    </Text>
                  )}
                  <Text style={styles.featDesc} numberOfLines={selected ? undefined : 2}>
                    {f.description}
                  </Text>
                  {selected && f.abilityChoice && (
                    <View style={styles.featChoiceBox}>
                      <Text style={styles.featChoiceLabel}>
                        Choose which ability gets +{f.abilityChoice.amount}:
                      </Text>
                      <View style={styles.featChoiceRow}>
                        {f.abilityChoice.options.map(ab => {
                          const picked = featAbility === ab;
                          const abLabel = ABILITIES.find(a => a.key === ab)?.label ?? ab;
                          return (
                            <Pressable
                              key={ab}
                              style={[styles.featChoiceChip, picked && styles.featChoiceChipActive]}
                              onPress={() => setFeatAbility(picked ? null : ab)}
                            >
                              <Text style={[styles.featChoiceTxt, picked && styles.featChoiceTxtActive]}>
                                {abLabel}
                              </Text>
                            </Pressable>
                          );
                        })}
                      </View>
                    </View>
                  )}
                  {selected && f.skillChoice && f.skillChoice.picks.map(pick => {
                    // Proficiency picks offer skills the character isn't yet
                    // trained in; expertise picks offer only trained skills.
                    const eligible = SKILL_LIST.filter(s => {
                      const trained = entity.skills.skills[s.key]?.trained === true;
                      // Don't offer a skill already taken by the OTHER pick.
                      const takenByOther = Object.entries(featSkills)
                        .some(([pid, sk]) => pid !== pick.id && sk === s.key);
                      if (takenByOther) return false;
                      return pick.from === 'proficient' ? trained : !trained;
                    });
                    return (
                      <View key={pick.id} style={styles.featChoiceBox}>
                        <Text style={styles.featChoiceLabel}>{pick.label}:</Text>
                        {eligible.length === 0 ? (
                          <Text style={styles.featSkillEmpty}>
                            {pick.from === 'proficient'
                              ? 'No proficient skills available for expertise.'
                              : 'No untrained skills available.'}
                          </Text>
                        ) : (
                          <View style={styles.featChoiceRow}>
                            {eligible.map(s => {
                              const picked = featSkills[pick.id] === s.key;
                              return (
                                <Pressable
                                  key={s.key}
                                  style={[styles.featChoiceChip, picked && styles.featChoiceChipActive]}
                                  onPress={() => setFeatSkills(prev => {
                                    const next = { ...prev };
                                    if (picked) delete next[pick.id];
                                    else next[pick.id] = s.key;
                                    return next;
                                  })}
                                >
                                  <Text style={[styles.featChoiceTxt, picked && styles.featChoiceTxtActive]}>
                                    {s.label}
                                  </Text>
                                </Pressable>
                              );
                            })}
                          </View>
                        )}
                      </View>
                    );
                  })}
                  <Text style={[styles.featSource, f.source === 'Homebrew' && styles.featSourceHomebrew]}>
                    {f.source}
                  </Text>
                  {/* Inline confirm — commit right here so there's no need to
                      scroll to a button at the bottom of a long feat list. */}
                  {selected && (
                    <Pressable
                      style={[
                        styles.inlineTakeBtn,
                        !canApply() && styles.inlineTakeBtnDisabled,
                      ]}
                      disabled={!canApply()}
                      onPress={() => commitFeat(f.id)}
                    >
                      <Text style={styles.inlineTakeTxt}>
                        {!canApply() ? 'Complete the choices above' : `Take ${f.name} →`}
                      </Text>
                    </Pressable>
                  )}
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

      {mode !== 'feat' && (
        <Pressable
          style={[styles.applyBtn, !canApply() && styles.applyBtnDisabled]}
          onPress={handleApply}
          disabled={!canApply()}
        >
          <Text style={styles.applyBtnTxt}>Apply Improvement →</Text>
        </Pressable>
      )}

      {/* "Get anyway" override popup for feats whose prerequisite isn't met. */}
      <Modal
        visible={overridePrompt !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setOverridePrompt(null)}
      >
        <View style={styles.ovBackdrop}>
          <View style={styles.ovSheet}>
            <Text style={styles.ovTitle}>Prerequisite not met</Text>
            {overridePrompt && (() => {
              const f = allFeats.find(x => x.id === overridePrompt.featId);
              return (
                <>
                  <Text style={styles.ovFeatName}>{f?.name}</Text>
                  <Text style={styles.ovReason}>{overridePrompt.reason}</Text>
                  <Text style={styles.ovNote}>
                    Your DM may allow this anyway (homebrew, a story reason, or a
                    requirement the app can't verify). Take it regardless?
                  </Text>
                  <View style={styles.ovBtnRow}>
                    <Pressable style={styles.ovCancel} onPress={() => setOverridePrompt(null)}>
                      <Text style={styles.ovCancelTxt}>Cancel</Text>
                    </Pressable>
                    <Pressable
                      style={styles.ovConfirm}
                      onPress={() => commitFeat(overridePrompt.featId)}
                    >
                      <Text style={styles.ovConfirmTxt}>Take anyway</Text>
                    </Pressable>
                  </View>
                </>
              );
            })()}
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  content:   { padding: Spacing.lg, paddingBottom: Spacing.xxl },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  // flex:1 + flexShrink so a long heading ("Ability Score Improvement") wraps
  // instead of overflowing the row and pushing the close button off-screen —
  // that overflow is what made the X land "way too right" on a phone-width screen.
  heading:   { flex: 1, flexShrink: 1, fontSize: FontSize.xxl, fontWeight: FontWeight.black, color: Colors.gold, marginBottom: Spacing.xs },
  close:     { fontSize: FontSize.xl, color: Colors.textSecondary, paddingLeft: Spacing.md },
  sub:       { fontSize: FontSize.md, color: Colors.textSecondary, marginBottom: Spacing.xl },

  modeRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.lg },
  bothHint: { fontSize: FontSize.sm, color: Colors.gold, fontStyle: 'italic', marginBottom: Spacing.sm, lineHeight: 19 },
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
  featRowUnmet: { borderColor: Colors.red + '55' },
  featHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  featName:   { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  featCheck:  { fontSize: FontSize.md, color: Colors.gold, fontWeight: FontWeight.bold },
  featLock:   { fontSize: FontSize.md, color: Colors.red },
  featPrereq: { fontSize: FontSize.xs, color: Colors.gold, marginTop: 2, fontStyle: 'italic' },
  featPrereqUnmet: { color: Colors.red },
  featChoiceBox: { marginTop: Spacing.sm, gap: Spacing.xs },
  featChoiceLabel: { fontSize: FontSize.xs, color: Colors.gold, fontWeight: FontWeight.bold },
  featChoiceRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  featChoiceChip: {
    backgroundColor: Colors.surfaceHigh, borderRadius: Radius.full,
    borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: Spacing.sm, paddingVertical: 4,
  },
  featChoiceChipActive: { backgroundColor: Colors.gold + '33', borderColor: Colors.gold },
  featChoiceTxt: { fontSize: FontSize.xs, color: Colors.textSecondary, fontWeight: FontWeight.bold },
  featChoiceTxtActive: { color: Colors.gold },
  featSkillEmpty: { fontSize: FontSize.xs, color: Colors.textDim, fontStyle: 'italic' },
  featDesc:   { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 4, lineHeight: 18 },
  featSource: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 4, opacity: 0.6 },
  featSourceHomebrew: { color: Colors.gold, fontWeight: FontWeight.bold, opacity: 1 },
  featEmpty:  { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center', padding: Spacing.lg },

  applyBtn: {
    backgroundColor: Colors.gold, borderRadius: Radius.md,
    paddingVertical: Spacing.md, alignItems: 'center',
  },
  applyBtnDisabled: { backgroundColor: Colors.goldDim },
  applyBtnTxt:      { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.bg },

  inlineTakeBtn: {
    marginTop: Spacing.sm, backgroundColor: Colors.gold, borderRadius: Radius.md,
    paddingVertical: Spacing.sm, alignItems: 'center',
  },
  inlineTakeBtnDisabled: { backgroundColor: Colors.goldDim },
  inlineTakeTxt: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.bg },

  ovBackdrop: { flex: 1, backgroundColor: '#000000cc', justifyContent: 'center', alignItems: 'center', padding: Spacing.lg },
  ovSheet: {
    backgroundColor: Colors.surfaceHigh, borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.red + '55',
    padding: Spacing.lg, width: '100%', gap: Spacing.sm,
  },
  ovTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.red, textAlign: 'center' },
  ovFeatName: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.textPrimary, textAlign: 'center' },
  ovReason: { fontSize: FontSize.sm, color: Colors.textPrimary, lineHeight: 20 },
  ovNote: { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 19, fontStyle: 'italic' },
  ovBtnRow: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.xs },
  ovCancel: {
    flex: 1, backgroundColor: Colors.surface, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border, paddingVertical: Spacing.sm, alignItems: 'center',
  },
  ovCancelTxt: { color: Colors.textSecondary, fontWeight: FontWeight.bold, fontSize: FontSize.md },
  ovConfirm: {
    flex: 1, backgroundColor: Colors.gold, borderRadius: Radius.md,
    paddingVertical: Spacing.sm, alignItems: 'center',
  },
  ovConfirmTxt: { color: Colors.bg, fontWeight: FontWeight.bold, fontSize: FontSize.md },
});
