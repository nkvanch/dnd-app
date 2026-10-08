// src/components/GlobalDiceRoller.tsx
// Floating dice button + modal. Import and add to any screen that needs it.
import { useState, useEffect, useRef } from 'react';
import {
  View, Text, Pressable, StyleSheet, Modal,
  TextInput, ScrollView, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useDiceLogStore } from '../store/diceLogStore';
import { ManualRollInput } from './ManualRollInput';
import { rollWithAdvantage, rollWithDisadvantage } from '../engine/dice';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const QUICK_DICE = ['1d4','1d6','1d8','1d10','1d12','1d20','d100','2d6','4d6kh3'];

interface Props {
  /** Override position of the floating button. Default: bottom-right. */
  bottom?: number;
  right?:  number;
}

export function GlobalDiceRoller({ bottom = 88, right = 16 }: Props) {
  const [open,    setOpen]    = useState(false);
  const [expr,    setExpr]    = useState('1d20');
  const [label,   setLabel]   = useState('');
  const [error,   setError]   = useState('');
  const [historyOpen, setHistoryOpen] = useState(false);
  const insets = useSafeAreaInsets();
  const history   = useDiceLogStore(s => s.history);
  const rollAndLog = useDiceLogStore(s => s.rollAndLog);
  const pushRoll   = useDiceLogStore(s => s.pushRoll);

  // Auto-open the roller whenever a new roll appears (e.g. a skill tap from the
  // exploration tab) so the result is actually visible. We track the latest
  // roll id and pop the sheet open when it changes from outside.
  const lastSeenId = useRef<string | null>(history[0]?.id ?? null);
  useEffect(() => {
    const top = history[0]?.id ?? null;
    if (top && top !== lastSeenId.current && !open) {
      setOpen(true);
    }
    lastSeenId.current = top;
  }, [history, open]);

  function roll() {
    try {
      setError('');
      rollAndLog(expr.trim() || '1d20', label.trim() || undefined);
    } catch {
      setError(`Invalid expression: "${expr}"`);
    }
  }

  // A-59 (adjacent finding): rollWithAdvantage/rollWithDisadvantage
  // (src/engine/dice.ts) already existed — 2d20, keep higher/lower — but
  // had zero callers anywhere in the app. This is their first real wiring.
  // Reads a plain "+3"/"3"/"-1"-shaped expression as the modifier (a
  // natural thing to type before tapping one of these); anything else
  // (blank, a full dice expression) rolls at +0 rather than guessing.
  function rollD20WithState(kind: 'advantage' | 'disadvantage') {
    setError('');
    const typed = expr.trim();
    const modifier = /^[+-]?\d+$/.test(typed) ? parseInt(typed, 10) : 0;
    const rollFn = kind === 'advantage' ? rollWithAdvantage : rollWithDisadvantage;
    pushRoll(rollFn(modifier, label.trim() || undefined));
  }

  const latest = history[0] ?? null;

  return (
    <>
      {/* Floating button */}
      <Pressable
        testID="dice-roller"
        accessibilityLabel="Dice Roller"
        style={[styles.fab, { bottom, right }]}
        onPress={() => setOpen(true)}
      >
        <Text style={styles.fabTxt}>🎲</Text>
      </Pressable>

      {/* Modal */}
      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <KeyboardAvoidingView
          style={styles.overlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <Pressable style={styles.backdrop} onPress={() => setOpen(false)} />
          <ScrollView style={styles.sheet} contentContainerStyle={[styles.sheetContent, { paddingBottom: Math.max(insets.bottom, Spacing.md) }]} keyboardShouldPersistTaps="handled">
            <Text style={styles.title}>Dice Roller</Text>

            {/* Quick dice */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickRow}>
              {QUICK_DICE.map(q => (
                <Pressable key={q} style={styles.quickBtn} onPress={() => { setExpr(q); setError(''); }}>
                  <Text style={styles.quickBtnTxt}>{q}</Text>
                </Pressable>
              ))}
            </ScrollView>

            {/* Expression input */}
            <TextInput
              style={styles.exprInput}
              value={expr}
              onChangeText={t => { setExpr(t); setError(''); }}
              placeholder="e.g. 2d6+3"
              placeholderTextColor={Colors.textDim}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TextInput
              style={styles.labelInput}
              value={label}
              onChangeText={setLabel}
              placeholder="Label (optional)"
              placeholderTextColor={Colors.textDim}
            />

            {error ? <Text style={styles.errorTxt}>{error}</Text> : null}

            <Pressable testID="dice-roll" accessibilityLabel="Roll dice" style={styles.rollBtn} onPress={roll}>
              <Text style={styles.rollBtnTxt}>Roll</Text>
            </Pressable>

            <View style={styles.advRow}>
              <Pressable style={styles.advBtn} onPress={() => rollD20WithState('advantage')}>
                <Text style={styles.advBtnTxt}>▲ Advantage</Text>
              </Pressable>
              <Pressable style={styles.advBtn} onPress={() => rollD20WithState('disadvantage')}>
                <Text style={styles.advBtnTxt}>▼ Disadvantage</Text>
              </Pressable>
            </View>

            <ManualRollInput
              expression={expr.trim() || '1d20'}
              label={label.trim() || undefined}
              onSubmit={pushRoll}
            />

            {/* Latest result */}
            {latest && (
              <View style={styles.resultBox}>
                {latest.label ? <Text style={styles.resultLabel}>{latest.label}</Text> : null}
                <Text style={styles.resultTotal}>{latest.total}</Text>
                <Text style={styles.resultBreakdown}>
                  [{latest.rolls.join(', ')}]{latest.modifier !== 0 ? ` + ${latest.modifier}` : ''}
                </Text>
                <Text style={styles.resultExpr}>{latest.expression}</Text>
              </View>
            )}

            {/* Roll history stays collapsed by default and scrolls within a fixed region. */}
            {history.length > 1 && (
              <View style={styles.historySection}>
                <Pressable testID="recent-rolls" accessibilityLabel="Recent Rolls" onPress={() => setHistoryOpen(value => !value)}>
                  <Text style={styles.historyTitle}>RECENT ROLLS {historyOpen ? '▲' : '▼'}</Text>
                </Pressable>
                {historyOpen && <ScrollView style={styles.historyList} nestedScrollEnabled>
                  {history.slice(1).map(r => (
                    <View key={r.id} style={styles.historyRow}>
                      <Text style={styles.historyExpr}>{r.label ?? r.expression}</Text>
                      <Text style={styles.historyTotal}>{r.total}</Text>
                    </View>
                  ))}
                </ScrollView>}
              </View>
            )}

            <Pressable style={styles.closeBtn} onPress={() => setOpen(false)}>
              <Text style={styles.closeBtnTxt}>Close</Text>
            </Pressable>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  fab: {
    position:        'absolute',
    width:           48,
    height:          48,
    borderRadius:    Radius.full,
    backgroundColor: Colors.surfaceHigh,
    borderWidth:     1,
    borderColor:     Colors.border,
    alignItems:      'center',
    justifyContent:  'center',
    ...Platform.select({
      web:     { boxShadow: '0px 2px 4px rgba(0,0,0,0.3)' },
      default: { elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4 },
    }),
  },
  fabTxt: { fontSize: 22 },

  overlay:  { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: '#000000aa' },
  sheet: { maxHeight: '92%', backgroundColor: Colors.surfaceHigh,
    borderTopLeftRadius: Radius.lg, borderTopRightRadius: Radius.lg,
  },
  sheetContent: { padding: Spacing.lg, gap: Spacing.md },
  title: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.textPrimary, textAlign: 'center' },

  quickRow: { gap: Spacing.xs, paddingVertical: 2 },
  quickBtn: {
    backgroundColor: Colors.surface, borderRadius: Radius.sm,
    paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs,
    borderWidth: 1, borderColor: Colors.border,
  },
  quickBtnTxt: { color: Colors.textPrimary, fontSize: FontSize.sm, fontWeight: FontWeight.bold },

  exprInput: {
    backgroundColor: Colors.surface, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border,
    padding: Spacing.md, fontSize: FontSize.xl,
    color: Colors.textPrimary, textAlign: 'center', fontWeight: FontWeight.bold,
  },
  labelInput: {
    backgroundColor: Colors.surface, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border,
    padding: Spacing.sm, fontSize: FontSize.sm, color: Colors.textPrimary,
  },
  errorTxt: { color: Colors.red, fontSize: FontSize.sm, textAlign: 'center' },

  rollBtn: {
    backgroundColor: Colors.gold, borderRadius: Radius.md,
    padding: Spacing.md, alignItems: 'center',
  },
  rollBtnTxt: { color: Colors.bg, fontSize: FontSize.lg, fontWeight: FontWeight.bold },

  advRow: { flexDirection: 'row', gap: Spacing.sm },
  advBtn: {
    flex: 1, backgroundColor: Colors.surface, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border,
    paddingVertical: Spacing.sm, alignItems: 'center',
  },
  advBtnTxt: { color: Colors.textPrimary, fontSize: FontSize.sm, fontWeight: FontWeight.bold },

  resultBox: {
    backgroundColor: Colors.surface, borderRadius: Radius.lg,
    padding: Spacing.md, alignItems: 'center', gap: Spacing.xs,
    borderWidth: 1, borderColor: Colors.gold + '66',
  },
  resultLabel:     { fontSize: FontSize.sm, color: Colors.textSecondary },
  resultTotal:     { fontSize: 48, fontWeight: FontWeight.bold, color: Colors.gold },
  resultBreakdown: { fontSize: FontSize.md, color: Colors.textSecondary },
  resultExpr:      { fontSize: FontSize.xs, color: Colors.textDim },

  historySection: { gap: Spacing.xs },
  historyList: { maxHeight: 180 },
  historyTitle:   { fontSize: FontSize.xs, color: Colors.textDim, letterSpacing: 2 },
  historyRow:     { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  historyExpr:    { fontSize: FontSize.sm, color: Colors.textSecondary },
  historyTotal:   { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.textPrimary },

  closeBtn:    { alignItems: 'center', padding: Spacing.sm },
  closeBtnTxt: { color: Colors.textSecondary, fontSize: FontSize.md },
});
