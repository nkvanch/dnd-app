// app/creation/weapon-mastery.tsx
// Creation step for classes that have Weapon Mastery (2024 / 5.5e Barbarian, Fighter, Paladin, Ranger, Rogue): pick the weapon
// kinds whose mastery property the character can use. The same panel lives on the Features tab afterwards (the rules let you
// swap one after each Long Rest).
import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useCharacterStore } from '../../src/store/characterStore';
import { WeaponMasteryPanel } from '../../src/components/sheet/WeaponMasteryPanel';
import { weaponMasteryCapacity, masteredWeaponIds } from '../../src/engine/weaponMastery';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../../src/theme';
import { SafeBottomView } from '../../src/components/SafeBottomView';

export default function CreationWeaponMasteryScreen() {
  const router = useRouter();
  const draft = useCharacterStore(s => s.draft);
  const setDraft = useCharacterStore(s => s.setDraft);
  if (!draft) return null;
  const capacity = weaponMasteryCapacity(draft);
  const picked = masteredWeaponIds(draft).length;

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Weapon Mastery</Text>
        <Text style={styles.body}>
          Your class trains you to use the mastery property of {capacity} kind{capacity === 1 ? '' : 's'} of weapon (for example Cleave on a
          Greataxe or Vex on a Rapier). Pick them now; you can swap one after each Long Rest.
        </Text>
        <WeaponMasteryPanel entity={draft} onEntityUpdate={setDraft} />
      </ScrollView>
      <SafeBottomView>
        <View style={styles.footer}>
          <Pressable style={styles.btn} onPress={() => router.replace('/creation/hub')} testID="weapon-mastery-continue">
            <Text style={styles.btnTxt}>{picked >= capacity ? 'Continue' : `Continue (${picked}/${capacity} picked)`}</Text>
          </Pressable>
        </View>
      </SafeBottomView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bg },
  content: { padding: Spacing.lg, gap: Spacing.md },
  title: { fontSize: FontSize.xxl, fontWeight: FontWeight.black, color: Colors.gold },
  body: { fontSize: FontSize.md, color: Colors.textPrimary, lineHeight: 22 },
  footer: { padding: Spacing.md },
  btn: { backgroundColor: Colors.gold, borderRadius: Radius.md, padding: Spacing.md, alignItems: 'center' },
  btnTxt: { color: Colors.bg, fontWeight: FontWeight.bold, fontSize: FontSize.md },
});
