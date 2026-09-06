// src/components/sheet/ChangeBackgroundModal.tsx
// Phase 4 (last, most complex) of the live feature/background editing track
// — a player or DM changing a character's background mid-session, not just
// at creation. Reuses swapBackground (engine/leveling.ts) for the actual
// mutation, buildFeatureGrantRows (Phase 1) for the mechanical-change
// summary, and ContentSearchPicker for the background search/pick step.
//
// The skill-retrain checklist is the one genuinely new piece of UI: a human-
// editable list of "keep this old-background skill trained?" checkboxes,
// defaulting to whatever swapBackground's own algorithm decides, so a human
// can correct the one case that algorithm structurally can't see (a class-
// driven skill choice trained the same skill with no backing Effect — see
// swapBackground's own doc comment).
import { useState, useEffect } from 'react';
import { Modal, View, Text, Pressable, StyleSheet } from 'react-native';
import { Entity, CampaignRules, Background, Ability, SkillName } from '../../engine/types';
import { swapBackground } from '../../engine/leveling';
import { simulate } from '../../engine/simulate';
import { buildFeatureGrantRows } from './featureGrantRows';
import { SKILL_LABELS } from './skillLabels';
import { ContentSearchPicker } from '../ContentSearchPicker';
import { useHomebrewStore } from '../../store/homebrewStore';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../../theme';

const ABILITIES: Ability[] = ['str', 'dex', 'con', 'int', 'wis', 'cha'];

/** Skills the entity's CURRENT background's own features grant via a
 *  grant_proficiency effect — small enough to inline rather than export
 *  from leveling.ts (single consumer). */
function currentBackgroundSkills(entity: Entity): SkillName[] {
  const skills = new Set<SkillName>();
  for (const f of entity.features) {
    if (f.source.kind !== 'background') continue;
    for (const e of f.effects) {
      if (e.type === 'grant_proficiency' && e.operation === 'add' && e.target.startsWith('skill:')) {
        skills.add(e.target.slice(6) as SkillName);
      }
    }
  }
  return [...skills];
}

interface Props {
  visible:   boolean;
  entity:    Entity;
  rules:     CampaignRules;
  onConfirm: (updated: Entity) => void;
  onCancel:  () => void;
}

export function ChangeBackgroundModal({ visible, entity, rules, onConfirm, onCancel }: Props) {
  const getMergedContentDB = useHomebrewStore(s => s.getMergedContentDB);
  const backgrounds = getMergedContentDB().backgrounds;

  const [selectedBg, setSelectedBg] = useState<Background | null>(null);
  const [flexPicks, setFlexPicks] = useState<Ability[]>([]);
  const [flexSubMode, setFlexSubMode] = useState<'2_1' | '3x1'>('2_1');
  const [skillChecklist, setSkillChecklist] = useState<Partial<Record<SkillName, boolean>>>({});

  useEffect(() => {
    if (visible) {
      setSelectedBg(null);
      setFlexPicks([]);
      setFlexSubMode('2_1');
      setSkillChecklist({});
    }
  }, [visible]);

  const oldBgSkills = currentBackgroundSkills(entity);

  // Initialize the checklist to swapBackground's own default decision (no
  // overrides) the moment a background is picked — the checklist then shows
  // exactly what WOULD happen, editable from there.
  useEffect(() => {
    if (!selectedBg) return;
    const defaultResult = swapBackground(entity, selectedBg, rules);
    const initial: Partial<Record<SkillName, boolean>> = {};
    for (const skill of oldBgSkills) {
      initial[skill] = defaultResult.skills.skills[skill]?.trained ?? false;
    }
    setSkillChecklist(initial);
    // Only re-derive when the background selection itself changes — not on
    // every entity/rules identity change (those don't change WHICH skills
    // are in play, only re-running this would just reset user edits).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBg?.id]);

  if (!visible) return null;

  if (!selectedBg) {
    return (
      <Modal visible transparent animationType="slide" onRequestClose={onCancel}>
        <Pressable style={styles.backdrop} onPress={onCancel}>
          <Pressable style={styles.sheet} onPress={e => e.stopPropagation()}>
            <Text style={styles.title}>Change Background</Text>
            <ContentSearchPicker items={backgrounds} onSelect={setSelectedBg} placeholder="Search backgrounds…" />
            <Pressable style={styles.discardBtn} onPress={onCancel}>
              <Text style={styles.discardTxt}>Cancel</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    );
  }

  const flexAsi = selectedBg.flexibleAsi;
  const flexRequiredCount = !flexAsi ? 0
    : flexAsi.mode.kind === 'two_distinct_plus_one' ? 2
    : flexSubMode === '2_1' ? 2 : 3;
  const flexComplete = !flexAsi || flexPicks.length === flexRequiredCount;
  const flexAbilityOptions: Ability[] = flexAsi?.mode.kind === 'two_one_or_three_one' && flexAsi.mode.restrictTo
    ? flexAsi.mode.restrictTo
    : ABILITIES;
  function toggleFlexPick(ab: Ability) {
    setFlexPicks(prev => {
      if (prev.includes(ab)) return prev.filter(a => a !== ab);
      if (prev.length >= flexRequiredCount) return prev;
      return [...prev, ab];
    });
  }

  const { before, after } = simulate(
    entity,
    e => swapBackground(e, selectedBg, rules, flexAsi ? flexPicks : undefined, skillChecklist),
    rules,
  );
  const rows = buildFeatureGrantRows(before, after);

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onCancel}>
      <Pressable style={styles.backdrop} onPress={onCancel}>
        <Pressable style={styles.sheet} onPress={e => e.stopPropagation()}>
          <Text style={styles.title}>Change Background → {selectedBg.name}</Text>

          {flexAsi && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{flexAsi.prompt}</Text>
              {flexAsi.mode.kind === 'two_one_or_three_one' && (
                <View style={styles.subModeRow}>
                  <Pressable
                    style={[styles.subModeBtn, flexSubMode === '2_1' && styles.subModeBtnActive]}
                    onPress={() => { setFlexSubMode('2_1'); setFlexPicks([]); }}
                  >
                    <Text style={[styles.subModeTxt, flexSubMode === '2_1' && styles.subModeTxtActive]}>+2 / +1</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.subModeBtn, flexSubMode === '3x1' && styles.subModeBtnActive]}
                    onPress={() => { setFlexSubMode('3x1'); setFlexPicks([]); }}
                  >
                    <Text style={[styles.subModeTxt, flexSubMode === '3x1' && styles.subModeTxtActive]}>+1 / +1 / +1</Text>
                  </Pressable>
                </View>
              )}
              <View style={styles.abilityRow}>
                {flexAbilityOptions.map(ab => {
                  const idx = flexPicks.indexOf(ab);
                  const picked = idx !== -1;
                  const amount = flexAsi.mode.kind === 'two_distinct_plus_one' ? 1
                    : flexPicks.length === 3 || flexSubMode === '3x1' ? 1 : (idx === 0 ? 2 : 1);
                  return (
                    <Pressable key={ab} style={[styles.abilityBtn, picked && styles.abilityBtnActive]} onPress={() => toggleFlexPick(ab)}>
                      <Text style={[styles.abilityTxt, picked && styles.abilityTxtActive]}>
                        {ab.toUpperCase()}{picked ? ` +${amount}` : ''}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          )}

          {oldBgSkills.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Skills from your old background</Text>
              {oldBgSkills.map(skill => {
                const keep = skillChecklist[skill] ?? false;
                return (
                  <Pressable
                    key={skill}
                    style={styles.checklistRow}
                    onPress={() => setSkillChecklist(prev => ({ ...prev, [skill]: !keep }))}
                  >
                    <Text style={styles.checklistCheckbox}>{keep ? '☑' : '☐'}</Text>
                    <Text style={styles.checklistLabel}>{SKILL_LABELS[skill]}</Text>
                    <Text style={styles.checklistState}>{keep ? 'kept' : 'untrained'}</Text>
                  </Pressable>
                );
              })}
            </View>
          )}

          {rows.length > 0 && (
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
            <Pressable style={styles.cancelBtn} onPress={() => setSelectedBg(null)}>
              <Text style={styles.cancelTxt}>← Back</Text>
            </Pressable>
            <Pressable
              style={[styles.confirmBtn, !flexComplete && styles.confirmBtnDisabled]}
              disabled={!flexComplete}
              onPress={() => onConfirm(after)}
            >
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
    padding: Spacing.md, gap: Spacing.sm, maxHeight: '85%',
  },
  title: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.gold, textAlign: 'center' },

  section: { gap: Spacing.xs },
  sectionTitle: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.textPrimary },

  subModeRow: { flexDirection: 'row', gap: Spacing.sm },
  subModeBtn: {
    flex: 1, backgroundColor: Colors.surface, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border, padding: Spacing.sm, alignItems: 'center',
  },
  subModeBtnActive: { backgroundColor: Colors.gold + '33', borderColor: Colors.gold },
  subModeTxt: { color: Colors.textSecondary, fontSize: FontSize.sm },
  subModeTxtActive: { color: Colors.gold, fontWeight: FontWeight.bold },

  abilityRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  abilityBtn: {
    backgroundColor: Colors.surface, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border, paddingVertical: Spacing.xs, paddingHorizontal: Spacing.sm,
  },
  abilityBtnActive: { backgroundColor: Colors.gold + '33', borderColor: Colors.gold },
  abilityTxt: { color: Colors.textSecondary, fontSize: FontSize.sm },
  abilityTxtActive: { color: Colors.gold, fontWeight: FontWeight.bold },

  checklistRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: 4 },
  checklistCheckbox: { fontSize: FontSize.md, color: Colors.gold },
  checklistLabel: { flex: 1, color: Colors.textPrimary, fontSize: FontSize.sm },
  checklistState: { color: Colors.textDim, fontSize: FontSize.xs },

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
  confirmBtnDisabled: { backgroundColor: Colors.surface, borderColor: Colors.border, borderWidth: 1 },
  confirmTxt: { color: Colors.bg, fontWeight: FontWeight.bold, fontSize: FontSize.md },
  discardBtn: { alignItems: 'center', padding: Spacing.sm },
  discardTxt: { color: Colors.red, fontSize: FontSize.sm },
});
