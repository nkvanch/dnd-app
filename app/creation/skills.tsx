import { revokeEntitlementsFromChoice } from '../../src/engine/entitlements';
import { recomputeDerived } from '../../src/engine/pipeline';
// app/creation/skills.tsx
// Skill selection. Shows already-owned proficiencies at top, then choices below.
// Two overlap modes (set in Campaign Settings):
//   'replacement' — opens extra skills so you never lose a pick
//   'warn'        — stay on class list; warn inline when you'll lose picks
import { useState, useEffect } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useCharacterStore } from '../../src/store/characterStore';
import { resolveChoice } from '../../src/engine/leveling';
import { skillOverlapMode } from '../../src/engine/houseRules';
import { ChoiceOption, SkillName } from '../../src/engine/types';
import { useSafeGoBack } from '../../src/hooks/useSafeGoBack';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../../src/theme';

const SKILL_LABELS: Record<string, string> = {
  athletics: 'Athletics', acrobatics: 'Acrobatics', sleight_of_hand: 'Sleight of Hand',
  stealth: 'Stealth', arcana: 'Arcana', history: 'History', investigation: 'Investigation',
  nature: 'Nature', religion: 'Religion', animal_handling: 'Animal Handling',
  insight: 'Insight', medicine: 'Medicine', perception: 'Perception', survival: 'Survival',
  deception: 'Deception', intimidation: 'Intimidation', performance: 'Performance',
  persuasion: 'Persuasion',
};

export default function SkillsScreen() {
  const router   = useRouter();
  const safeGoBack = useSafeGoBack('/(tabs)');
  const draft    = useCharacterStore(s => s.draft);
  const setDraft = useCharacterStore(s => s.setDraft);
  const rules    = useCharacterStore(s => s.rules);

  const allSkillChoices      = draft ? draft.choices.filter(c => c.definition.kind === 'skill') : [];
  const pendingSkillChoices  = allSkillChoices.filter(c => !c.resolved);
  const resolvedSkillChoices = allSkillChoices.filter(c =>  c.resolved);

  const alreadyTrained = draft
    ? Object.entries(draft.skills.skills)
        .filter(([, entry]) => entry.trained)
        .map(([name]) => SKILL_LABELS[name] ?? name)
    : [];

  const [selections, setSelections] = useState<Record<string, string[]>>(
    Object.fromEntries(pendingSkillChoices.map(c => [c.id, []]))
  );
  // Controls the inline loss-confirmation box in warn mode.
  // Only opens when the user explicitly taps the Confirm button — NOT on selection.
  const [showWarnBox, setShowWarnBox] = useState(false);

  useEffect(() => {
    if (!draft) router.replace('/creation/name');
  }, [draft?.id]);

  if (!draft) return null;

  const ALL_SKILL_KEYS = Object.keys(SKILL_LABELS) as SkillName[];
  const overlapMode = skillOverlapMode(rules);

  // Some classes/subclasses grant "choose N of ANY skill" (e.g. Bard's level-1
  // "Choose any 3 skills") — content marks this with the pool:'all' sentinel
  // (see spellChoice()'s identical convention in classes/index.ts) rather
  // than a literal 18-option array. Expand it here so every pool-reading
  // helper below sees a real array; a bare `Array.isArray` check would
  // otherwise treat it as an empty pool.
  function basePoolFor(choice: typeof pendingSkillChoices[number]): ChoiceOption[] {
    if (choice.definition.pool === 'all') {
      return ALL_SKILL_KEYS.map(sk => ({ id: sk, label: SKILL_LABELS[sk], value: sk }));
    }
    return Array.isArray(choice.definition.pool) ? choice.definition.pool as ChoiceOption[] : [];
  }

  function poolFor(choice: typeof pendingSkillChoices[number]):
    (ChoiceOption & { isReplacement?: boolean })[] {
    const basePool = basePoolFor(choice);

    if (overlapMode === 'warn') return basePool;

    const pickableInClass = basePool.filter(
      o => !draft!.skills.skills[o.value as SkillName]?.trained
    ).length;
    const shortfall = choice.definition.count - pickableInClass;
    if (shortfall <= 0) return basePool;

    const inPool = new Set(basePool.map(o => o.value));
    const replacements: (ChoiceOption & { isReplacement?: boolean })[] = ALL_SKILL_KEYS
      .filter(sk => !inPool.has(sk) && !draft!.skills.skills[sk]?.trained)
      .map(sk => ({ id: `repl_${sk}`, label: SKILL_LABELS[sk], value: sk, isReplacement: true }));
    return [...basePool, ...replacements];
  }

  // How many picks are achievable for this choice given current overlap.
  function achievableCount(choice: typeof pendingSkillChoices[number]): number {
    if (overlapMode === 'replacement') return choice.definition.count;
    const basePool = basePoolFor(choice);
    const pickable = basePool.filter(
      o => !draft!.skills.skills[o.value as SkillName]?.trained
    ).length;
    return Math.min(choice.definition.count, pickable);
  }

  function overlapCount(choice: typeof pendingSkillChoices[number]): number {
    const basePool = basePoolFor(choice);
    return basePool.filter(o => !!draft!.skills.skills[o.value as SkillName]?.trained).length;
  }

  // Total picks being lost across all pending choices in warn mode.
  const totalLost = pendingSkillChoices.reduce(
    (sum, c) => sum + (c.definition.count - achievableCount(c)), 0
  );

  function toggle(choiceId: string, optId: string, max: number) {
    setShowWarnBox(false);  // hide warn box if user changes selection
    setSelections(prev => {
      const cur = prev[choiceId] ?? [];
      if (cur.includes(optId)) return { ...prev, [choiceId]: cur.filter(id => id !== optId) };
      if (cur.length >= max) return prev;
      return { ...prev, [choiceId]: [...cur, optId] };
    });
  }

  // All pending choices have reached their achievable count.
  function canProceed(): boolean {
    return pendingSkillChoices.every(c => {
      const target   = achievableCount(c);
      const selected = selections[c.id]?.length ?? 0;
      return selected === target;
    });
  }

  // True when warn mode has losses but the user hasn't yet confirmed.
  // Only becomes true after the user explicitly taps the Confirm button.

  function startEditingSkills() {
    let updated = draft!;
    const newSelections: Record<string, string[]> = {};

    for (const choice of resolvedSkillChoices) {
      updated = revokeEntitlementsFromChoice(updated, choice.id);
      newSelections[choice.id] = [...choice.selections];
      updated = {
        ...updated,
        choices: updated.choices.map(c => c.id === choice.id ? { ...c, resolved: false, selections: [] } : c),
      };
    }

    setDraft(recomputeDerived(updated, rules));
    setSelections(prev => ({ ...prev, ...newSelections }));
  }

  function commit() {
    let updated = draft!;
    for (const choice of pendingSkillChoices) {
      const chosen = selections[choice.id] ?? [];
      if (chosen.length !== achievableCount(choice)) continue;

      // resolveChoice() only ever resolves against a literal pool array — a
      // choice whose content-authored pool is the 'all' sentinel (e.g.
      // Bard's "Choose any 3 skills") gets its resolved array substituted in
      // here first, same trick both branches below need.
      const pool = poolFor(choice);
      const augmented = {
        ...updated,
        choices: updated.choices.map(c =>
          c.id === choice.id
            ? { ...c, definition: { ...c.definition, pool: pool as ChoiceOption[] } }
            : c
        ),
      };
      if (overlapMode === 'replacement') {
        updated = resolveChoice(augmented, choice.id, chosen, rules);
      } else {
        // Warn mode: pad to full count with overlap ids (already-trained skills
        // are idempotent re-grants so resolveChoice's count check passes).
        const basePool = basePoolFor(choice);
        const overlapIds = basePool
          .filter(o => !!draft!.skills.skills[o.value as SkillName]?.trained)
          .map(o => o.id);
        const needPad = choice.definition.count - chosen.length;
        const padded  = [...chosen, ...overlapIds.slice(0, Math.max(0, needPad))];
        if (padded.length === choice.definition.count) {
          updated = resolveChoice(augmented, choice.id, padded, rules);
        } else {
          // Edge: not enough overlap ids to pad (shouldn't happen). Mark resolved
          // with what we have so the hub doesn't loop back here forever.
          updated = {
            ...updated,
            choices: updated.choices.map(c =>
              c.id === choice.id ? { ...c, resolved: true, selections: chosen } : c
            ),
          };
        }
      }
    }
    setDraft(updated);
    router.push('/creation/hub');
  }

  // ── Case 1: no skill choices ───────────────────────────────────────────────
  if (allSkillChoices.length === 0) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Pressable style={styles.backBtn} onPress={safeGoBack}>
          <Text style={styles.backBtnTxt}>← Back</Text>
        </Pressable>
        <Text style={styles.heading}>Skill Selection</Text>
        <View style={styles.divider} />
        <Text style={styles.emptyNote}>No additional skill choices for this class.</Text>
        <Pressable style={styles.nextBtn} onPress={() => router.push('/creation/hub')}>
          <Text style={styles.nextBtnText}>Continue →</Text>
        </Pressable>
      </ScrollView>
    );
  }

  // ── Case 2: all resolved (re-entering) ────────────────────────────────────
  if (pendingSkillChoices.length === 0) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Pressable style={styles.backBtn} onPress={safeGoBack}>
          <Text style={styles.backBtnTxt}>← Back</Text>
        </Pressable>
        <Text style={styles.heading}>Skill Selection</Text>
        <View style={styles.divider} />
        <Text style={styles.ownedTitle}>Skills already chosen:</Text>
        {resolvedSkillChoices.map(c => {
          const pool = basePoolFor(c);
          return c.selections.map(selId => {
            const opt   = pool.find(o => o.id === selId);
            const label = opt ? (SKILL_LABELS[opt.label.toLowerCase().replace(/ /g, '_')] ?? opt.label)
              : SKILL_LABELS[selId] ?? selId;
            return <Text key={selId} style={styles.ownedSkill}>✓ {label}</Text>;
          });
        })}
        <View style={styles.divider} />
        <Pressable style={styles.changeBtn} onPress={startEditingSkills}>
          <Text style={styles.changeBtnTxt}>✎ Change Skills</Text>
        </Pressable>
        <Pressable style={styles.nextBtn} onPress={() => router.push('/creation/hub')}>
          <Text style={styles.nextBtnText}>Continue →</Text>
        </Pressable>
      </ScrollView>
    );
  }

  // ── Case 3: pending choices ───────────────────────────────────────────────
  const ready = canProceed();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Pressable style={styles.backBtn} onPress={safeGoBack}>
        <Text style={styles.backBtnTxt}>← Back</Text>
      </Pressable>
      <Text style={styles.heading}>Skill Selection</Text>
      <View style={styles.divider} />

      {alreadyTrained.length > 0 && (
        <View style={styles.ownedBlock}>
          <Text style={styles.ownedTitle}>Already proficient:</Text>
          {alreadyTrained.map(s => <Text key={s} style={styles.ownedSkill}>{s}</Text>)}
          <View style={styles.divider} />
        </View>
      )}

      {pendingSkillChoices.map(choice => {
        const pool    = poolFor(choice);
        const chosen  = selections[choice.id] ?? [];
        const need    = achievableCount(choice);
        const overlap = overlapCount(choice);
        const losing  = choice.definition.count - need;
        // How many extra (non-list) skills poolFor actually appended below —
        // NOT the same as `overlap`. A choice can have background overlap
        // without ever needing a replacement (e.g. only 1 of 8 skills
        // overlaps and you're only picking 1) — the old condition
        // (`overlap > 0`) showed "N replacement picks opened" in that case
        // even though the pool below was still just the plain restricted
        // list, which was misleading.
        const replacementsAdded = pool.filter(o => o.isReplacement).length;

        return (
          <View key={choice.id} style={styles.choiceBlock}>
            <Text style={styles.choicePrompt}>
              Choose {need} {need === 1 ? 'Skill' : 'Skills'}
            </Text>
            <Text style={styles.choiceCount}>
              Selected: {chosen.length} / {need}
            </Text>

            {replacementsAdded > 0 && overlapMode === 'replacement' && (
              <Text style={styles.replacementNote}>
                Your background already covers {overlap} of this choice's skill{overlap === 1 ? '' : 's'}.
                {' '}{replacementsAdded} replacement pick{replacementsAdded === 1 ? '' : 's'} opened below — you don't lose any.
              </Text>
            )}
            {losing > 0 && overlapMode === 'warn' && (
              <Text style={styles.lossNote}>
                Your background covers {overlap} of this choice's skills, so you can pick {need} instead of {choice.definition.count} (losing {losing} pick{losing === 1 ? '' : 's'}).
              </Text>
            )}

            {pool.map(opt => {
              const isAlreadyTrained = !!draft.skills.skills[opt.value as SkillName]?.trained;
              const isSelected       = chosen.includes(opt.id);
              const isDisabled       = isAlreadyTrained || (!isSelected && chosen.length >= need);
              return (
                <Pressable
                  key={opt.id}
                  style={[styles.option, isSelected && styles.optionSelected, isDisabled && styles.optionDisabled]}
                  onPress={() => { if (!isAlreadyTrained) toggle(choice.id, opt.id, need); }}
                  disabled={isDisabled}
                >
                  <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
                    {isSelected && <Text style={styles.checkmark}>✓</Text>}
                  </View>
                  <Text style={[
                    styles.optionText,
                    isSelected && styles.optionTextSelected,
                    isAlreadyTrained && styles.optionTextMuted,
                  ]}>
                    {SKILL_LABELS[opt.label.toLowerCase().replace(/ /g, '_')] ?? opt.label}
                  </Text>
                  {isAlreadyTrained && <Text style={styles.alreadyTag}>From background</Text>}
                  {opt.isReplacement && !isAlreadyTrained && (
                    <Text style={styles.replacementTag}>Replacement</Text>
                  )}
                </Pressable>
              );
            })}
          </View>
        );
      })}

      {/* Inline warn confirmation — only appears after tapping Confirm */}
      {showWarnBox && (
        <View style={styles.warnConfirmBox}>
          <Text style={styles.warnConfirmTitle}>Confirm skill loss</Text>
          <Text style={styles.warnConfirmBody}>
            You'll get {totalLost} fewer skill {totalLost === 1 ? 'proficiency' : 'proficiencies'} than normal
            because your background overlaps your class skills. Continue?
          </Text>
          <View style={styles.warnConfirmRow}>
            <Pressable style={styles.warnCancelBtn} onPress={() => setShowWarnBox(false)}>
              <Text style={styles.warnCancelTxt}>Cancel</Text>
            </Pressable>
            <Pressable style={styles.warnOkBtn} onPress={() => { setShowWarnBox(false); commit(); }}>
              <Text style={styles.warnOkTxt}>Yes, continue (−{totalLost} skill{totalLost === 1 ? '' : 's'})</Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* Confirm button */}
      <Pressable
        style={[styles.nextBtn, (!ready || showWarnBox) && styles.nextBtnDisabled]}
        onPress={() => {
          if (!ready || showWarnBox) return;
          if (overlapMode === 'warn' && totalLost > 0) {
            setShowWarnBox(true);   // show inline confirmation
          } else {
            commit();
          }
        }}
        disabled={!ready || showWarnBox}
      >
        <Text style={styles.nextBtnText}>
          {ready && overlapMode === 'warn' && totalLost > 0
            ? `Confirm Skills (losing ${totalLost} pick${totalLost === 1 ? '' : 's'})`
            : 'Confirm Skills'}
        </Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  content:   { padding: Spacing.lg, paddingBottom: Spacing.xxl },

  backBtn: { marginBottom: Spacing.md },
  backBtnTxt: { fontSize: FontSize.md, color: Colors.gold, fontWeight: FontWeight.bold },

  heading: { fontSize: FontSize.xxl, fontWeight: FontWeight.black, color: Colors.textPrimary, textAlign: 'center', marginBottom: Spacing.md },
  divider: { height: 1, backgroundColor: Colors.border, marginVertical: Spacing.lg },
  emptyNote: { color: Colors.textSecondary, fontSize: FontSize.md, marginBottom: Spacing.xl },

  ownedBlock: { marginBottom: Spacing.sm },
  ownedTitle: { fontSize: FontSize.sm, color: Colors.textSecondary, marginBottom: Spacing.sm, fontWeight: FontWeight.bold },
  ownedSkill: { fontSize: FontSize.md, color: Colors.green, marginBottom: Spacing.xs },

  choiceBlock:  { marginBottom: Spacing.xl },
  choicePrompt: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary, marginBottom: Spacing.xs },
  choiceCount:  { fontSize: FontSize.sm, color: Colors.textSecondary, marginBottom: Spacing.md },

  replacementNote: { fontSize: FontSize.sm, color: Colors.blue, marginBottom: Spacing.md, lineHeight: 19 },
  lossNote:        { fontSize: FontSize.sm, color: Colors.gold, marginBottom: Spacing.md, lineHeight: 19,
                     backgroundColor: Colors.gold + '11', borderRadius: Radius.sm, padding: Spacing.sm,
                     borderLeftWidth: 3, borderLeftColor: Colors.gold },

  option: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    paddingVertical: Spacing.sm, paddingHorizontal: Spacing.sm,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  optionSelected:     { backgroundColor: Colors.surfaceHigh },
  optionDisabled:     { opacity: 0.4 },
  checkbox: {
    width: 22, height: 22, borderRadius: 4,
    borderWidth: 2, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  checkboxSelected:   { backgroundColor: Colors.gold, borderColor: Colors.gold },
  checkmark:          { fontSize: 12, color: Colors.bg, fontWeight: FontWeight.bold },
  optionText:         { fontSize: FontSize.md, color: Colors.textPrimary, flex: 1 },
  optionTextSelected: { fontWeight: FontWeight.bold },
  optionTextMuted:    { color: Colors.textDim },
  alreadyTag:         { fontSize: FontSize.xs, color: Colors.green, fontWeight: FontWeight.bold },
  replacementTag:     { fontSize: FontSize.xs, color: Colors.blue, fontWeight: FontWeight.bold },

  // Inline warn confirmation (replaces Alert.alert)
  warnConfirmBox: {
    backgroundColor: Colors.gold + '11', borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.gold + '55',
    padding: Spacing.md, gap: Spacing.sm, marginTop: Spacing.md,
  },
  warnConfirmTitle: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.gold },
  warnConfirmBody:  { fontSize: FontSize.sm, color: Colors.textPrimary, lineHeight: 20 },
  warnConfirmRow:   { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.xs },
  warnCancelBtn: {
    flex: 1, backgroundColor: Colors.surface, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border,
    paddingVertical: Spacing.sm, alignItems: 'center',
  },
  warnCancelTxt: { color: Colors.textSecondary, fontWeight: FontWeight.bold, fontSize: FontSize.sm },
  warnOkBtn: {
    flex: 2, backgroundColor: Colors.gold, borderRadius: Radius.md,
    paddingVertical: Spacing.sm, alignItems: 'center',
  },
  warnOkTxt: { color: Colors.bg, fontWeight: FontWeight.bold, fontSize: FontSize.sm },

  nextBtn:         { backgroundColor: Colors.gold, borderRadius: Radius.md, paddingVertical: Spacing.md, alignItems: 'center', marginTop: Spacing.lg },
  nextBtnDisabled: { backgroundColor: Colors.goldDim },
  nextBtnText:     { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.bg },

  changeBtn: {
    backgroundColor: Colors.surfaceHigh, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.gold + '66',
    paddingVertical: Spacing.sm, alignItems: 'center',
  },
  changeBtnTxt: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.gold },
});
