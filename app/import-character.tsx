import { useState } from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { pickPortableCharacter } from '../src/io/characterPortable';
import { useCharacterStore } from '../src/store/characterStore';
import { useCustomRuleProfileStore } from '../src/store/customRuleProfileStore';
import { Alert } from '../src/utils/alert';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../src/theme';

export default function ImportCharacterScreen() {
  const router = useRouter();
  const [picking, setPicking] = useState(false);
  const profiles = useCustomRuleProfileStore(s => s.profiles);
  const importProfile = useCustomRuleProfileStore(s => s.importProfile);
  const importCharacter = useCharacterStore(s => s.importCharacter);

  async function chooseFile() {
    setPicking(true);
    try {
      const parsed = await pickPortableCharacter(profiles);
      if (!parsed) return;
      if (parsed.profileToImport) {
        const imported = await importProfile(parsed.profileToImport);
        parsed.entity = { ...parsed.entity, customRuleProfileId: imported.id, rulesetId: imported.baseRulesetId };
      }
      if (!(await importCharacter(parsed.entity))) throw new Error('The character could not be saved.');
      const name = parsed.entity.identity.name?.replace(/ \(Imported Copy\)$/, '') || 'Unnamed';
      Alert.alert('Character imported', parsed.importedAsCopy ? `Imported ${name} as a copy` : `Imported ${name}`, [
        { text: 'Done', onPress: () => router.replace('/(tabs)/characters') },
      ]);
    } catch (error) {
      Alert.alert('Import failed', `Could not import character: ${error instanceof Error ? error.message : 'Invalid character file.'}`);
    } finally {
      setPicking(false);
    }
  }

  return <View style={styles.screen} testID="import-character-screen">
    <View style={styles.header}>
      <Pressable testID="import-character-back" accessibilityRole="button" accessibilityLabel="Back to Characters" onPress={() => router.back()}><Text style={styles.back}>← Characters</Text></Pressable>
      <Text style={styles.title}>Import Character</Text>
    </View>
    <View style={styles.body}>
      <Text style={styles.icon}>⇩</Text>
      <Text style={styles.helper}>Choose a Grimoire Character JSON file exported from another Grimoire installation.</Text>
      <Pressable testID="choose-character-file" accessibilityRole="button" accessibilityLabel="Choose Character File" style={[styles.button, picking && styles.disabled]} disabled={picking} onPress={() => { void chooseFile(); }}>
        {picking ? <ActivityIndicator color={Colors.bg} /> : <Text style={styles.buttonText}>Choose Character File</Text>}
      </Pressable>
      <Text style={styles.note}>Homebrew packages belong in Homebrew → Import Homebrew.</Text>
    </View>
  </View>;
}

const styles = StyleSheet.create({
  screen:{flex:1,backgroundColor:Colors.bg}, header:{paddingTop:Spacing.xl+8,paddingHorizontal:Spacing.md,paddingBottom:Spacing.md,borderBottomWidth:1,borderBottomColor:Colors.border,gap:Spacing.sm},
  back:{color:Colors.gold,fontSize:FontSize.sm,fontWeight:FontWeight.bold}, title:{color:Colors.textPrimary,fontSize:FontSize.xl,fontWeight:FontWeight.bold},
  body:{flex:1,alignItems:'center',justifyContent:'center',padding:Spacing.xl,gap:Spacing.md}, icon:{fontSize:54,color:Colors.gold},
  helper:{color:Colors.textSecondary,fontSize:FontSize.md,textAlign:'center',lineHeight:22,maxWidth:480}, button:{backgroundColor:Colors.gold,borderRadius:Radius.md,paddingHorizontal:Spacing.lg,paddingVertical:Spacing.md,minWidth:220,alignItems:'center'},
  buttonText:{color:Colors.bg,fontSize:FontSize.md,fontWeight:FontWeight.bold}, disabled:{opacity:.6}, note:{color:Colors.textDim,fontSize:FontSize.sm,textAlign:'center'},
});
