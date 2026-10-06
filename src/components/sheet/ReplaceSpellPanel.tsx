// src/components/sheet/ReplaceSpellPanel.tsx
// Swapping one chosen cantrip of a spell choice that allows it (Blessed Warrior, Druidic Warrior: "whenever you gain
// a Paladin/Ranger level, you can replace one of these cantrips with another"). The engine (replaceSpellChoiceSelection)
// checks the choice's own spell filter; the app does not track level-ups, so honoring the timing is the player's, and
// the rule is shown on the confirm step. Renders nothing when the character has no such choice.
import { useState } from 'react';
import { View, Text, Pressable, ScrollView, Modal, StyleSheet } from 'react-native';
import { Entity, CampaignRules } from '../../engine/types';
import { replaceSpellChoiceSelection } from '../../engine/leveling';
import { FULL_SPELL_LIBRARY } from '../../content/spells/index';
import { candidateSpellsForChoice } from '../../content/spellChoiceFilter';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../../theme';

const nameOf = (id: string) => FULL_SPELL_LIBRARY.find(s => s.id === id)?.name ?? id;

export function replaceableSpellChoices(entity: Entity) {
  return entity.choices.filter(c => c.resolved && c.definition.kind === 'spell' && !!c.definition.replace && c.selections.length > 0);
}

export function ReplaceSpellPanel({ entity, rules, onEntityUpdate }: { entity: Entity; rules: CampaignRules; onEntityUpdate: (e: Entity) => void }) {
  const [target, setTarget] = useState<{ choiceId: string; spellId: string } | null>(null);
  const [pick, setPick] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const choices = replaceableSpellChoices(entity);
  if (choices.length === 0) return null;

  const choice = target ? entity.choices.find(c => c.id === target.choiceId) : undefined;
  const known = new Set([...(entity.spellcasting?.cantrips ?? []), ...(entity.spellcasting?.known ?? []), ...(entity.spellcasting?.prepared ?? [])]);
  const candidates = choice
    ? candidateSpellsForChoice(FULL_SPELL_LIBRARY, choice.definition, { ownClassId: choice.definition.forClassId ?? entity.identity.classId, maxCastableLevel: 9 })
        .filter(s => !known.has(s.id))
    : [];

  function close() { setTarget(null); setPick(null); setError(null); }
  function confirm() {
    if (!target || !pick) return;
    try { onEntityUpdate(replaceSpellChoiceSelection(entity, target.choiceId, target.spellId, pick, rules)); close(); }
    catch (e) { setError(e instanceof Error ? e.message : 'That swap is not allowed.'); }
  }

  return (
    <>
      <View style={styles.card}>
        <Text style={styles.kicker}>SWAPPABLE SPELLS</Text>
        {choices.map(c => (
          <View key={c.id} style={styles.group}>
            <Text style={styles.groupTitle}>{c.definition.prompt.replace(/:.*$/, '')}</Text>
            {c.selections.map(id => (
              <View key={id} style={styles.row}>
                <Text style={[styles.rowName, { flex: 1 }]}>{nameOf(id)}</Text>
                <Pressable style={styles.btn} onPress={() => { setTarget({ choiceId: c.id, spellId: id }); setPick(null); setError(null); }}
                  accessibilityLabel={`Replace ${nameOf(id)}`}>
                  <Text style={styles.btnTxt}>Replace</Text>
                </Pressable>
              </View>
            ))}
          </View>
        ))}
      </View>

      <Modal visible={!!target} transparent animationType="fade" onRequestClose={close}>
        <View style={styles.backdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={close} />
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>Replace {target ? nameOf(target.spellId) : ''}</Text>
            {choice?.definition.replace && <Text style={styles.rule}>{choice.definition.replace.rule}</Text>}
            <ScrollView style={{ maxHeight: 360 }}>
              {candidates.map(s => (
                <Pressable key={s.id} onPress={() => setPick(s.id)} style={[styles.pick, pick === s.id && styles.pickOn]} accessibilityState={{ selected: pick === s.id }}>
                  <Text style={styles.pickName}>{s.name}{pick === s.id ? ' ✓' : ''}</Text>
                </Pressable>
              ))}
              {candidates.length === 0 && <Text style={styles.rule}>There is nothing else to swap to.</Text>}
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
  pickName: { color: Colors.textPrimary, fontSize: FontSize.md, fontWeight: FontWeight.bold },
  actions: { flexDirection: 'row', gap: Spacing.sm },
  cancel: { flex: 1, backgroundColor: Colors.surface, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, padding: Spacing.md, alignItems: 'center' },
  cancelTxt: { color: Colors.textSecondary, fontWeight: FontWeight.bold, fontSize: FontSize.md },
  confirm: { flex: 1, backgroundColor: Colors.gold, borderRadius: Radius.md, padding: Spacing.md, alignItems: 'center' },
  confirmTxt: { color: Colors.bg, fontWeight: FontWeight.bold, fontSize: FontSize.md },
});
