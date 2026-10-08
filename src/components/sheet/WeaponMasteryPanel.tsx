// src/components/sheet/WeaponMasteryPanel.tsx
// Weapon Mastery (2024 rules): shows which weapon kinds the character has mastered and what each one's
// mastery property does, and lets the player change the picks (the rules let you swap one after each
// Long Rest; the app doesn't track rests for this, so the choice is the player's to honor).
// Renders nothing for a character whose class grants no Weapon Mastery.
import { useState } from 'react';
import { View, Text, Pressable, ScrollView, Modal, StyleSheet } from 'react-native';
import { Entity } from '../../engine/types';
import {
  weaponMasteryCapacity, masteredWeaponIds, eligibleMasteryWeapons, setWeaponMasteryPicks,
} from '../../engine/weaponMastery';
import { MASTERY_RULES, WEAPON_MASTERY_BY_ID } from '../../content/weaponMastery';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../../theme';

const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

export function WeaponMasteryPanel({ entity, onEntityUpdate }: { entity: Entity; onEntityUpdate: (e: Entity) => void }) {
  const capacity = weaponMasteryCapacity(entity);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<string[]>([]);
  if (capacity <= 0) return null;

  const mastered = masteredWeaponIds(entity);
  const eligible = eligibleMasteryWeapons(entity);

  function begin() { setDraft(mastered); setOpen(true); }
  function toggle(id: string) {
    setDraft(d => d.includes(id) ? d.filter(x => x !== id) : d.length >= capacity ? d : [...d, id]);
  }
  function save() { onEntityUpdate(setWeaponMasteryPicks(entity, draft)); setOpen(false); }

  return (
    <>
      <View style={styles.card}>
        <View style={styles.head}>
          <View style={{ flex: 1 }}>
            <Text style={styles.kicker}>WEAPON MASTERY</Text>
            <Text style={styles.title}>{mastered.length} of {capacity} weapon kinds mastered</Text>
          </View>
          <Pressable style={styles.btn} onPress={begin} accessibilityLabel="Choose mastered weapons">
            <Text style={styles.btnTxt}>{mastered.length < capacity ? 'Choose' : 'Change'}</Text>
          </Pressable>
        </View>
        {mastered.map(id => {
          const w = WEAPON_MASTERY_BY_ID[id];
          return (
            <View key={id} style={styles.row}>
              <Text style={styles.rowName}>{w.name} <Text style={styles.rowProp}>· {cap(w.mastery)}</Text></Text>
              <Text style={styles.rowDesc}>{MASTERY_RULES[w.mastery]}</Text>
            </View>
          );
        })}
        {mastered.length === 0 && <Text style={styles.hint}>Pick the weapons whose mastery property you can use.</Text>}
      </View>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <View style={styles.backdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setOpen(false)} />
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>Weapon Mastery</Text>
            <Text style={styles.sheetNote}>Choose up to {capacity}. After a Long Rest you may change one of them. ({draft.length}/{capacity})</Text>
            <ScrollView style={{ maxHeight: 380 }} contentContainerStyle={{ gap: Spacing.xs }}>
              {eligible.map(w => {
                const on = draft.includes(w.id);
                return (
                  <Pressable key={w.id} style={[styles.pick, on && styles.pickOn]} onPress={() => toggle(w.id)}>
                    <Text style={styles.pickTxt}>{on ? '☑' : '☐'}  {w.name}</Text>
                    <Text style={styles.pickProp}>{cap(w.mastery)}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
            <View style={styles.actions}>
              <Pressable style={styles.cancel} onPress={() => setOpen(false)}><Text style={styles.cancelTxt}>Cancel</Text></Pressable>
              <Pressable style={styles.confirm} onPress={save}><Text style={styles.confirmTxt}>Save</Text></Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: Colors.surface, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, padding: Spacing.sm, marginBottom: Spacing.sm, gap: Spacing.xs },
  head: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  kicker: { fontSize: FontSize.xs, color: Colors.gold, fontWeight: FontWeight.bold, letterSpacing: 0.5 },
  title: { fontSize: FontSize.md, color: Colors.textPrimary, fontWeight: FontWeight.bold },
  btn: { backgroundColor: Colors.gold, borderRadius: Radius.sm, paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs },
  btnTxt: { color: Colors.bg, fontWeight: FontWeight.bold, fontSize: FontSize.sm },
  row: { backgroundColor: Colors.surfaceHigh, borderRadius: Radius.sm, padding: Spacing.sm, gap: 2 },
  rowName: { color: Colors.textPrimary, fontSize: FontSize.sm, fontWeight: FontWeight.bold },
  rowProp: { color: Colors.gold },
  rowDesc: { color: Colors.textSecondary, fontSize: FontSize.xs },
  hint: { color: Colors.textDim, fontSize: FontSize.xs },
  backdrop: { flex: 1, backgroundColor: '#000000cc', justifyContent: 'center', padding: Spacing.md },
  sheet: { backgroundColor: Colors.surfaceHigh, borderRadius: Radius.lg, padding: Spacing.md, gap: Spacing.sm },
  sheetTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.gold, textAlign: 'center' },
  sheetNote: { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center' },
  pick: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: Colors.surface, borderRadius: Radius.sm, borderWidth: 1, borderColor: Colors.border, padding: Spacing.sm },
  pickOn: { borderColor: Colors.gold },
  pickTxt: { color: Colors.textPrimary, fontSize: FontSize.md },
  pickProp: { color: Colors.textDim, fontSize: FontSize.sm },
  actions: { flexDirection: 'row', gap: Spacing.sm },
  cancel: { flex: 1, backgroundColor: Colors.surface, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, padding: Spacing.md, alignItems: 'center' },
  cancelTxt: { color: Colors.textSecondary, fontWeight: FontWeight.bold, fontSize: FontSize.md },
  confirm: { flex: 1, backgroundColor: Colors.gold, borderRadius: Radius.md, padding: Spacing.md, alignItems: 'center' },
  confirmTxt: { color: Colors.bg, fontWeight: FontWeight.bold, fontSize: FontSize.md },
});
