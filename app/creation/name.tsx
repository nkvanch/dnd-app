// app/creation/name.tsx
// Step 1: Character name, starting level, optional campaign.
import { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useCharacterStore, makeEmptyEntity } from '../../src/store/characterStore';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../../src/theme';

const LEVEL_OPTIONS = [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20];

export default function NameScreen() {
  const router   = useRouter();
  const setDraft = useCharacterStore(s => s.setDraft);

  const [name,     setName]     = useState('');
  const [level,    setLevel]    = useState(1);
  const [campaign, setCampaign] = useState('');

  function handleContinue() {
    const trimmed = name.trim();
    if (!trimmed) return;

    let entity = makeEmptyEntity(Date.now().toString());
    entity = {
      ...entity,
      identity: { ...entity.identity, name: trimmed },
      // Stash targetLevel + campaign in notes until class screen consumes it
      notes: JSON.stringify({ targetLevel: level, campaign: campaign.trim() }),
    };

    setDraft(entity);
    router.push('/creation/hub');
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.inner} keyboardShouldPersistTaps="handled">

        <View style={styles.headerRow}>
          <View style={styles.headerSpacer} />
          <Text style={styles.heading}>Character Basics</Text>
          <Pressable style={styles.settingsBtn} onPress={() => router.push('/settings')}>
            <Text style={styles.settingsBtnText}>⚙️</Text>
          </Pressable>
        </View>
        <View style={styles.divider} />

        {/* Name */}
        <Text style={styles.label}>Character Name</Text>
        <TextInput
          style={styles.input}
          placeholder="Enter name…"
          placeholderTextColor={Colors.textDim}
          value={name}
          onChangeText={setName}
          autoFocus
          returnKeyType="next"
        />

        {/* Level */}
        <Text style={styles.label}>Starting Level</Text>
        <View style={styles.levelGrid}>
          {LEVEL_OPTIONS.map(l => (
            <Pressable
              key={l}
              style={[styles.levelBtn, level === l && styles.levelBtnActive]}
              onPress={() => setLevel(l)}
            >
              <Text style={[styles.levelBtnText, level === l && styles.levelBtnTextActive]}>
                {l}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Campaign — optional */}
        <Text style={styles.label}>Campaign <Text style={styles.optional}>(Optional)</Text></Text>
        <Pressable style={styles.campaignBox}>
          <TextInput
            style={styles.campaignInput}
            placeholder="None Selected"
            placeholderTextColor={Colors.textDim}
            value={campaign}
            onChangeText={setCampaign}
            returnKeyType="done"
          />
        </Pressable>

        <View style={styles.divider} />

        <Pressable
          style={[styles.continueBtn, !name.trim() && styles.continueBtnDisabled]}
          onPress={handleContinue}
          disabled={!name.trim()}
        >
          <Text style={styles.continueBtnText}>Continue</Text>
        </Pressable>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  inner: {
    padding: Spacing.lg,
    paddingTop: Spacing.xxl,
    paddingBottom: Spacing.xxl,
  },

  heading: {
    fontSize: FontSize.xxl,
    fontWeight: FontWeight.black,
    color: Colors.textPrimary,
    textAlign: 'center',
    flex: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  headerSpacer: { width: 32 },
  settingsBtn: { width: 32, alignItems: 'center' },
  settingsBtnText: { fontSize: 20 },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: Spacing.lg,
  },

  label: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    color: Colors.textSecondary,
    marginBottom: Spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  optional: {
    fontWeight: FontWeight.normal,
    textTransform: 'none',
    color: Colors.textDim,
  },

  input: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    fontSize: FontSize.lg,
    color: Colors.textPrimary,
    marginBottom: Spacing.lg,
  },

  levelGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  levelBtn: {
    width: 44,
    height: 44,
    borderRadius: Radius.md,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  levelBtnActive:     { backgroundColor: Colors.gold, borderColor: Colors.gold },
  levelBtnText:       { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.textSecondary },
  levelBtnTextActive: { color: Colors.bg },

  campaignBox: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    marginBottom: Spacing.lg,
  },
  campaignInput: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    fontSize: FontSize.md,
    color: Colors.textPrimary,
  },

  continueBtn: {
    backgroundColor: Colors.gold,
    borderRadius: Radius.md,
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
  continueBtnDisabled: { backgroundColor: Colors.goldDim },
  continueBtnText: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: Colors.bg,
  },
});
