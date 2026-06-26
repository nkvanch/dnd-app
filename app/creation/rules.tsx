// app/creation/rules.tsx
// Campaign Settings screen. Lives in Character Basics — accessible from the
// name screen before creation starts. Not a step in the creation flow.
// Renders three control types: boolean (descriptive labels), choice (chips),
// and number (stepper). Reminder-only rules are clearly labelled as notes.
import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useCharacterStore } from '../../src/store/characterStore';
import {
  HOUSE_RULES, HouseRuleDef,
  getHouseRule, getHouseChoice, getHouseNumber, setHouseRuleValue,
} from '../../src/engine/houseRules';
import { Entity } from '../../src/engine/types';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../../src/theme';

export default function CreationRulesScreen() {
  const router   = useRouter();
  const draft    = useCharacterStore(s => s.draft);
  const setDraft = useCharacterStore(s => s.setDraft);
  const rules    = useCharacterStore(s => s.rules);
  const setRules = useCharacterStore(s => s.setRules);

  // Accessible from Character Basics (no draft) and from within creation (draft
  // exists). When no draft, "Done" goes back; otherwise pushes to hub.
  const hasDraft = !!draft;

  function setValue(key: string, value: boolean | string | number) {
    setRules({ customRules: setHouseRuleValue(rules, key, value) });
  }

  function handleDone() {
    if (!hasDraft) { router.back(); return; }
    const notes = (() => { try { return JSON.parse(draft!.notes || '{}'); } catch { return {}; } })();
    const updated: Entity = { ...draft!, notes: JSON.stringify({ ...notes, rulesVisited: true }) };
    setDraft(updated);
    router.push('/creation/hub');
  }

  const sections = HOUSE_RULES.reduce<Record<string, HouseRuleDef[]>>((acc, r) => {
    (acc[r.section] ??= []).push(r);
    return acc;
  }, {});

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.heading}>Campaign Settings</Text>
      <View style={styles.divider} />

      <View style={styles.infoCard}>
        <Text style={styles.infoTxt}>
          Configure your table's rules here. Everything defaults to standard 5e —
          change only what your table plays differently. Settings like HP mode,
          point-buy, and skill overlap affect the creation steps that follow.
        </Text>
      </View>

      {Object.entries(sections).map(([section, defs]) => (
        <View key={section}>
          <Text style={styles.sectionHeading}>{section}</Text>
          {defs.map(rule => (
            <View key={rule.key} style={styles.ruleCard}>
              <Text style={styles.ruleLabel}>
                {rule.label}
                {rule.reminderOnly && <Text style={styles.reminderTag}>  · reminder only</Text>}
              </Text>

              {rule.kind === 'boolean' && (
                <BooleanControl
                  on={getHouseRule(rules, rule.key)}
                  bookLabel={rule.bookLabel ?? 'Standard'}
                  homebrewLabel={rule.homebrewLabel ?? 'Homebrew'}
                  onSet={v => setValue(rule.key, v)}
                />
              )}

              {rule.kind === 'choice' && rule.options && (
                <ChoiceControl
                  options={rule.options}
                  selected={getHouseChoice(rules, rule.key)}
                  onSet={v => setValue(rule.key, v)}
                />
              )}

              {rule.kind === 'number' && (
                <NumberControl
                  value={getHouseNumber(rules, rule.key)}
                  min={rule.min ?? 0}
                  max={rule.max ?? 99}
                  onSet={v => setValue(rule.key, v)}
                />
              )}

              <Text style={styles.ruleDesc}>{rule.description}</Text>
            </View>
          ))}
        </View>
      ))}

      <View style={styles.divider} />
      <Pressable style={styles.doneBtn} onPress={handleDone}>
        <Text style={styles.doneBtnTxt}>
          {hasDraft ? 'Done \u2192' : '\u2190 Back to Basics'}
        </Text>
      </Pressable>
    </ScrollView>
  );
}

// ── Controls ──────────────────────────────────────────────────────────────────
function BooleanControl({ on, bookLabel, homebrewLabel, onSet }: {
  on: boolean; bookLabel: string; homebrewLabel: string; onSet: (v: boolean) => void;
}) {
  return (
    <View style={styles.segment}>
      <Pressable style={[styles.segBtn, !on && styles.segBtnActiveBook]} onPress={() => onSet(false)}>
        <Text style={[styles.segTxt, !on && styles.segTxtActive]}>{bookLabel}</Text>
      </Pressable>
      <Pressable style={[styles.segBtn, on && styles.segBtnActiveHome]} onPress={() => onSet(true)}>
        <Text style={[styles.segTxt, on && styles.segTxtActive]}>{homebrewLabel}</Text>
      </Pressable>
    </View>
  );
}

function ChoiceControl({ options, selected, onSet }: {
  options: { value: string; label: string }[]; selected: string; onSet: (v: string) => void;
}) {
  return (
    <View style={styles.choiceWrap}>
      {options.map(opt => {
        const active = opt.value === selected;
        return (
          <Pressable
            key={opt.value}
            style={[styles.choiceChip, active && styles.choiceChipActive]}
            onPress={() => onSet(opt.value)}
          >
            <Text style={[styles.choiceChipTxt, active && styles.choiceChipTxtActive]}>
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function NumberControl({ value, min, max, onSet }: {
  value: number; min: number; max: number; onSet: (v: number) => void;
}) {
  return (
    <View style={styles.numberRow}>
      <Pressable
        style={[styles.numBtn, value <= min && styles.numBtnDisabled]}
        onPress={() => onSet(Math.max(min, value - 1))}
        disabled={value <= min}
      >
        <Text style={styles.numBtnTxt}>−</Text>
      </Pressable>
      <Text style={styles.numValue}>{value}</Text>
      <Pressable
        style={[styles.numBtn, value >= max && styles.numBtnDisabled]}
        onPress={() => onSet(Math.min(max, value + 1))}
        disabled={value >= max}
      >
        <Text style={styles.numBtnTxt}>+</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  content:   { padding: Spacing.lg, paddingBottom: Spacing.xxl },
  heading:   { fontSize: FontSize.xxl, fontWeight: FontWeight.black, color: Colors.textPrimary, textAlign: 'center', marginBottom: Spacing.md },
  divider:   { height: 1, backgroundColor: Colors.border, marginVertical: Spacing.lg },

  infoCard: { backgroundColor: Colors.surfaceHigh, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, padding: Spacing.md, marginBottom: Spacing.lg },
  infoTxt:  { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 20 },

  sectionHeading: { fontSize: FontSize.sm, fontWeight: FontWeight.black, color: Colors.gold, letterSpacing: 1.5, textTransform: 'uppercase', marginTop: Spacing.md, marginBottom: Spacing.sm },

  ruleCard: { backgroundColor: Colors.surface, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border, padding: Spacing.md, marginBottom: Spacing.sm, gap: Spacing.sm },
  ruleLabel: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  reminderTag: { fontSize: FontSize.xs, color: Colors.textDim, fontWeight: FontWeight.normal, fontStyle: 'italic' },
  ruleDesc:  { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 19 },

  segment: { flexDirection: 'row', borderRadius: Radius.full, overflow: 'hidden', borderWidth: 1, borderColor: Colors.border, alignSelf: 'flex-start' },
  segBtn:  { paddingHorizontal: Spacing.md, paddingVertical: 6 },
  segBtnActiveBook: { backgroundColor: Colors.blue + '33' },
  segBtnActiveHome: { backgroundColor: Colors.gold + '33' },
  segTxt:       { fontSize: FontSize.xs, color: Colors.textSecondary, fontWeight: FontWeight.bold },
  segTxtActive: { color: Colors.textPrimary },

  choiceWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  choiceChip: { backgroundColor: Colors.surfaceHigh, borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: Spacing.md, paddingVertical: 6 },
  choiceChipActive: { backgroundColor: Colors.gold + '22', borderColor: Colors.gold },
  choiceChipTxt: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: FontWeight.bold },
  choiceChipTxtActive: { color: Colors.gold },

  numberRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, alignSelf: 'flex-start' },
  numBtn: { width: 40, height: 40, borderRadius: Radius.md, backgroundColor: Colors.surfaceHigh, borderWidth: 1, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center' },
  numBtnDisabled: { opacity: 0.3 },
  numBtnTxt: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.gold },
  numValue: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.textPrimary, minWidth: 40, textAlign: 'center' },

  doneBtn: { backgroundColor: Colors.gold, borderRadius: Radius.md, paddingVertical: Spacing.md, alignItems: 'center' },
  doneBtnTxt: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.bg },
});
