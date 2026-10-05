// src/components/sheet/ReplaceChoicePanel.tsx
// Swapping a held option of a replaceable choice (Fighting Style, Metamagic, Eldritch Invocations, Hunter's Prey,
// Defensive Tactics, Fiendish Resilience) as one step: pick the option to give up, pick its replacement, confirm.
// The rule for when it is allowed is shown on the confirm step; the app does not track level-ups or rests for this,
// so honoring the timing is the player's, the same as Weapon Mastery. Prerequisites and "needed by another option"
// are enforced by the engine (replacePoolOption), and the reasons are shown here. Renders nothing when the
// character has no replaceable choice that has been made.
import { useState } from 'react';
import { View, Text, Pressable, ScrollView, Modal, StyleSheet } from 'react-native';
import { Entity, CampaignRules, Feature } from '../../engine/types';
import { replacePoolOption, replaceableOptions } from '../../engine/leveling';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../../theme';

const TIMING_LABEL = { level_up: 'on level-up', rest: 'after a rest', long_rest: 'after a Long Rest' } as const;

export function replaceableChoices(entity: Entity) {
  return entity.choices.filter(c => c.resolved && !!c.definition.replace && Array.isArray(c.definition.pool) && c.selections.length > 0);
}

export function ReplaceChoicePanel({ entity, rules, onEntityUpdate }: { entity: Entity; rules: CampaignRules; onEntityUpdate: (e: Entity) => void }) {
  const [target, setTarget] = useState<{ choiceId: string; optionId: string } | null>(null);
  const [pick, setPick] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const choices = replaceableChoices(entity);
  if (choices.length === 0) return null;

  const detail = target
    ? replaceableOptions(entity, target.choiceId).find(o => o.optionId === target.optionId)
    : undefined;
  const targetChoice = target ? entity.choices.find(c => c.id === target.choiceId) : undefined;
  const pool = Array.isArray(targetChoice?.definition.pool) ? targetChoice!.definition.pool : [];

  function close() { setTarget(null); setPick(null); setError(null); }
  function confirm() {
    if (!target || !pick) return;
    try { onEntityUpdate(replacePoolOption(entity, target.choiceId, target.optionId, pick, rules)); close(); }
    catch (e) { setError(e instanceof Error ? e.message : 'That swap is not allowed.'); }
  }

  return (
    <>
      <View style={styles.card}>
        <Text style={styles.kicker}>SWAPPABLE CHOICES</Text>
        {choices.map(c => {
          const options = replaceableOptions(entity, c.id);
          return (
            <View key={c.id} style={styles.group}>
              <Text style={styles.groupTitle}>{c.definition.prompt.replace(/:.*$/, '')} <Text style={styles.timing}>· {TIMING_LABEL[c.definition.replace!.timing]}</Text></Text>
              {options.map(o => (
                <View key={o.optionId} style={styles.row}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowName}>{o.label}</Text>
                    {o.blockedBy && <Text style={styles.blocked}>{o.blockedBy}</Text>}
                  </View>
                  <Pressable
                    style={[styles.btn, !!o.blockedBy && styles.btnOff]} disabled={!!o.blockedBy}
                    onPress={() => { setTarget({ choiceId: c.id, optionId: o.optionId }); setPick(null); setError(null); }}
                    accessibilityLabel={`Replace ${o.label}`}
                  >
                    <Text style={styles.btnTxt}>Replace</Text>
                  </Pressable>
                </View>
              ))}
            </View>
          );
        })}
      </View>

      <Modal visible={!!target} transparent animationType="fade" onRequestClose={close}>
        <View style={styles.backdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={close} />
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>Replace {detail?.label}</Text>
            {targetChoice?.definition.replace && <Text style={styles.rule}>{targetChoice.definition.replace.rule}</Text>}
            <ScrollView style={{ maxHeight: 360 }}>
              {(detail?.candidates ?? []).map(cand => {
                const locked = cand.unmet.length > 0;
                const feature = pool.find(o => o.id === cand.id)?.value as Feature | undefined;
                return (
                  <Pressable key={cand.id} disabled={locked} onPress={() => setPick(cand.id)}
                    style={[styles.pick, pick === cand.id && styles.pickOn, locked && styles.pickOff]}
                    accessibilityState={{ disabled: locked, selected: pick === cand.id }}>
                    <Text style={styles.pickName}>{cand.label}{pick === cand.id ? ' ✓' : ''}</Text>
                    {locked && <Text style={styles.blocked}>Requires: {cand.unmet.join(', ')}</Text>}
                    {!!feature?.description && <Text style={styles.pickDesc} numberOfLines={3}>{feature.description}</Text>}
                  </Pressable>
                );
              })}
              {(detail?.candidates ?? []).length === 0 && <Text style={styles.rule}>There is nothing else to swap to.</Text>}
            </ScrollView>
            {error && <Text style={styles.blocked}>{error}</Text>}
            <View style={styles.actions}>
              <Pressable style={styles.cancel} onPress={close}><Text style={styles.cancelTxt}>Cancel</Text></Pressable>
              <Pressable style={[styles.confirm, !pick && styles.btnOff]} disabled={!pick} onPress={confirm}>
                <Text style={styles.confirmTxt}>Swap</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: Colors.surface, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, padding: Spacing.md, marginBottom: Spacing.md, gap: Spacing.sm },
  kicker: { color: Colors.textSecondary, fontSize: FontSize.xs, fontWeight: FontWeight.bold, letterSpacing: 1 },
  group: { gap: 4 },
  groupTitle: { color: Colors.textPrimary, fontSize: FontSize.md, fontWeight: FontWeight.bold },
  timing: { color: Colors.textDim, fontSize: FontSize.sm, fontWeight: FontWeight.normal },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  rowName: { color: Colors.textPrimary, fontSize: FontSize.md },
  blocked: { color: Colors.red, fontSize: FontSize.sm },
  btn: { backgroundColor: Colors.surfaceHigh, borderWidth: 1, borderColor: Colors.gold, borderRadius: Radius.sm, paddingVertical: 6, paddingHorizontal: Spacing.md },
  btnOff: { opacity: 0.4 },
  btnTxt: { color: Colors.gold, fontWeight: FontWeight.bold },
  backdrop: { flex: 1, backgroundColor: '#000000cc', justifyContent: 'center', padding: Spacing.md },
  sheet: { backgroundColor: Colors.surfaceHigh, borderRadius: Radius.lg, padding: Spacing.md, gap: Spacing.sm },
  sheetTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.gold, textAlign: 'center' },
  rule: { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center' },
  pick: { backgroundColor: Colors.surface, borderRadius: Radius.sm, borderWidth: 1, borderColor: Colors.border, padding: Spacing.sm, marginBottom: Spacing.xs },
  pickOn: { borderColor: Colors.gold },
  pickOff: { opacity: 0.55 },
  pickName: { color: Colors.textPrimary, fontSize: FontSize.md, fontWeight: FontWeight.bold },
  pickDesc: { color: Colors.textSecondary, fontSize: FontSize.sm, marginTop: 2 },
  actions: { flexDirection: 'row', gap: Spacing.sm },
  cancel: { flex: 1, backgroundColor: Colors.surface, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, padding: Spacing.md, alignItems: 'center' },
  cancelTxt: { color: Colors.textSecondary, fontWeight: FontWeight.bold, fontSize: FontSize.md },
  confirm: { flex: 1, backgroundColor: Colors.gold, borderRadius: Radius.md, padding: Spacing.md, alignItems: 'center' },
  confirmTxt: { color: Colors.bg, fontWeight: FontWeight.bold, fontSize: FontSize.md },
});
