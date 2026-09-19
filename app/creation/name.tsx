// app/creation/name.tsx
// Step 1: Character name, starting level, optional campaign.
// Campaign Settings (table house rules) are accessible here as a card —
// they live in Character Basics, not as a step in the creation flow.
import { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useCharacterStore, makeEmptyEntity } from '../../src/store/characterStore';
import { RulesetId } from '../../src/engine/types';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../../src/theme';

const LEVEL_OPTIONS = [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20];

/** Parses the {targetLevel, campaign} JSON this screen stashes in
 *  entity.notes (see handleContinue below) back out, for pre-filling the
 *  form when re-entering an already-started draft. Same shape name.tsx has
 *  always written; not a general notes parser. */
function parseBasics(notes: string): { targetLevel: number; campaign: string } | null {
  try {
    const parsed = JSON.parse(notes) as { targetLevel?: unknown; campaign?: unknown };
    if (typeof parsed.targetLevel === 'number') {
      return { targetLevel: parsed.targetLevel, campaign: typeof parsed.campaign === 'string' ? parsed.campaign : '' };
    }
  } catch { /* not this screen's JSON shape (e.g. real session notes already written later) */ }
  return null;
}

export default function NameScreen() {
  const router   = useRouter();
  const setDraft = useCharacterStore(s => s.setDraft);
  // Re-audit A09 (item 11): read the CURRENT draft once at mount, not
  // reactively — re-entering this screen (e.g. via Back from Hub) should
  // pre-fill from and continue editing whatever draft already exists
  // rather than silently starting a brand new entity with a new id, which
  // used to orphan every step already completed on the old draft.
  const [existingDraft] = useState(() => useCharacterStore.getState().draft);
  const existingBasics = existingDraft ? parseBasics(existingDraft.notes) : null;

  const [name,     setName]     = useState(existingDraft?.identity.name ?? '');
  const [level,    setLevel]    = useState(existingBasics?.targetLevel ?? 1);
  const [campaign, setCampaign] = useState(existingBasics?.campaign ?? '');

  function handleContinue() {
    const trimmed = name.trim();
    if (!trimmed) return;

    // Mutate the existing draft in place (same id) when one is already in
    // progress, instead of always minting a fresh entity — see the
    // existingDraft comment above.
    let entity = existingDraft ?? makeEmptyEntity(Date.now().toString());
    entity = {
      ...entity,
      identity: { ...entity.identity, name: trimmed },
      notes: JSON.stringify({ targetLevel: level, campaign: campaign.trim() }),
      // LIVE-RULESET-4 (item 8): every NEW character gets a canonical
      // rulesetId from the moment it's created, rather than starting
      // untagged and only ever getting one via a later, optional Change
      // Ruleset action. 'dnd5e-2014' is this app's own long-standing
      // implicit baseline — every piece of content authored before the
      // 5.5e proof-of-concept was written against it, and it's already the
      // fallback RulesetChangeModal's own picker assumes for an untagged
      // character (gameIdForRuleset(RULESETS['dnd5e-2014'].id)). Making
      // that assumption explicit and stored, rather than re-derived every
      // time, is the "canonical, not silently defaulted" outcome the spec
      // asks for. Existing (already-saved) untagged characters are
      // deliberately NOT touched by this — see loadCharacters()'s own
      // comment for why a blanket migration isn't done.
      rulesetId: 'dnd5e-2014' as RulesetId,
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

        {/* Header — title + original app settings button */}
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
        <View style={styles.campaignBox}>
          <TextInput
            style={styles.campaignInput}
            placeholder="None Selected"
            placeholderTextColor={Colors.textDim}
            value={campaign}
            onChangeText={setCampaign}
            returnKeyType="done"
          />
        </View>

        {/* Campaign Settings — lives here in Character Basics, not in the creation flow */}
        <Pressable style={styles.campaignSettingsCard} onPress={() => router.push('/creation/rules')}>
          <Text style={styles.campaignSettingsIcon}>📖</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.campaignSettingsTitle}>Campaign Settings</Text>
            <Text style={styles.campaignSettingsDesc}>
              HP mode · skills · ASI · feats · resting · homebrew…
            </Text>
          </View>
          <Text style={styles.campaignSettingsArrow}>›</Text>
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
  inner: { padding: Spacing.lg, paddingTop: Spacing.xxl, paddingBottom: Spacing.xxl },

  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.md },
  headerSpacer: { width: 32 },
  heading: { fontSize: FontSize.xxl, fontWeight: FontWeight.black, color: Colors.textPrimary, textAlign: 'center', flex: 1 },
  settingsBtn: { width: 32, alignItems: 'center' },
  settingsBtnText: { fontSize: 20 },

  divider: { height: 1, backgroundColor: Colors.border, marginVertical: Spacing.lg },

  label: {
    fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.textSecondary,
    marginBottom: Spacing.sm, textTransform: 'uppercase', letterSpacing: 1,
  },
  optional: { fontWeight: FontWeight.normal, textTransform: 'none', color: Colors.textDim },

  input: {
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.md,
    fontSize: FontSize.lg, color: Colors.textPrimary, marginBottom: Spacing.lg,
  },

  levelGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.lg },
  levelBtn: {
    width: 44, height: 44, borderRadius: Radius.md,
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  levelBtnActive:     { backgroundColor: Colors.gold, borderColor: Colors.gold },
  levelBtnText:       { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.textSecondary },
  levelBtnTextActive: { color: Colors.bg },

  campaignBox: {
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.md, marginBottom: Spacing.lg,
  },
  campaignInput: {
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.md,
    fontSize: FontSize.md, color: Colors.textPrimary,
  },

  campaignSettingsCard: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    backgroundColor: Colors.surface, borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.border,
    padding: Spacing.md, marginBottom: Spacing.sm,
  },
  campaignSettingsIcon:  { fontSize: FontSize.xl },
  campaignSettingsTitle: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  campaignSettingsDesc:  { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },
  campaignSettingsArrow: { fontSize: FontSize.xl, color: Colors.textDim },

  continueBtn: {
    backgroundColor: Colors.gold, borderRadius: Radius.md,
    paddingVertical: Spacing.md, alignItems: 'center',
  },
  continueBtnDisabled: { backgroundColor: Colors.goldDim },
  continueBtnText: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.bg },
});
