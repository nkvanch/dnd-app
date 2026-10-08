// src/components/RulesSourcePicker.tsx
// Character Basics' "Rules" selector. Three groups, one active choice:
//   Campaign setting - the rules of the campaign this device is in
//   Custom           - the player's own saved rule profiles (Homebrew -> Custom Rule Profile)
//   Official         - the pre-written 5e (2014) / 5.5e (2024) rule sets (content/rulePresets.ts)
// Whatever is chosen decides the character's ruleset (and rule-profile overlay), and the content
// pickers then suggest that ruleset's content first (content/rulesetSuggestion.ts).
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { RulesetId } from '../engine/types';
import { useCustomRuleProfileStore } from '../store/customRuleProfileStore';
import { useCampaignStore } from '../store/campaignStore';
import { RULE_PRESETS, presetProfileId } from '../content/rulePresets';
import { rulesetLabel } from '../content/rulesets';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../theme';

export type RulesChoice = {
  rulesetId: RulesetId;
  /** Rule-profile overlay id (a preset or a custom profile); undefined = the ruleset's plain defaults. */
  profileId?: string;
  /** Which group made the choice, so the right chip lights up. */
  source: 'campaign' | 'custom' | 'preset';
};

/** The choice a brand-new character starts with: the 2014 as-written preset (the app's long-standing baseline). */
export const DEFAULT_RULES_CHOICE: RulesChoice = {
  rulesetId: 'dnd5e-2014' as RulesetId, profileId: presetProfileId('dnd5e-2014' as RulesetId), source: 'preset',
};

/** Reads a draft's saved ruleset/profile back into a RulesChoice (for resuming a draft). */
export function rulesChoiceFromDraft(draft: { rulesetId?: RulesetId; customRuleProfileId?: string } | null | undefined): RulesChoice {
  if (!draft?.rulesetId) return DEFAULT_RULES_CHOICE;
  const isPreset = RULE_PRESETS.some(p => presetProfileId(p.rulesetId) === draft.customRuleProfileId);
  return {
    rulesetId: draft.rulesetId, profileId: draft.customRuleProfileId,
    source: isPreset || !draft.customRuleProfileId ? 'preset' : 'custom',
  };
}

export function RulesSourcePicker({ value, onChange }: { value: RulesChoice; onChange: (next: RulesChoice) => void }) {
  const router = useRouter();
  const profiles = useCustomRuleProfileStore(s => s.profiles);
  const campaign = useCampaignStore(s => s.activeCampaign);
  const custom = profiles.filter(p => p.source.kind !== 'preset');
  const active = RULE_PRESETS.find(p => presetProfileId(p.rulesetId) === value.profileId)
    ?? (value.source === 'preset' ? RULE_PRESETS.find(p => p.rulesetId === value.rulesetId) : undefined);
  const activeCustom = value.source === 'custom' ? custom.find(p => p.id === value.profileId) : undefined;

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Rules</Text>
      <Text style={styles.sub}>Choose the rules this character is built under. That ruleset's content is suggested first as you build.</Text>

      <Text style={styles.group}>CAMPAIGN SETTING</Text>
      {campaign ? (
        <View style={styles.row}>
          <Chip
            label={`${campaign.name}${campaign.rulesetId ? ` · ${rulesetLabel(campaign.rulesetId)}` : ''}`}
            active={value.source === 'campaign'}
            onPress={() => onChange({ rulesetId: campaign.rulesetId ?? value.rulesetId, profileId: undefined, source: 'campaign' })}
          />
        </View>
      ) : (
        <Text style={styles.hint}>Open or join a campaign to use its rules here.</Text>
      )}

      <Text style={styles.group}>CUSTOM</Text>
      <View style={styles.row}>
        {custom.map(p => (
          <Chip key={p.id} label={p.name} active={value.source === 'custom' && value.profileId === p.id}
            onPress={() => onChange({ rulesetId: p.baseRulesetId, profileId: p.id, source: 'custom' })} />
        ))}
        <Chip label="+ New custom rules" active={false} onPress={() => router.push('/homebrew/rule-profile' as never)} dashed />
      </View>
      {custom.length === 0 && <Text style={styles.hint}>Your saved rule profiles will appear here.</Text>}

      <Text style={styles.group}>OFFICIAL RULE SETS</Text>
      <View style={styles.row}>
        {RULE_PRESETS.map(p => (
          <Chip key={p.rulesetId} label={p.name.replace(' — as written', '')}
            active={value.source === 'preset' && value.rulesetId === p.rulesetId}
            onPress={() => onChange({ rulesetId: p.rulesetId, profileId: presetProfileId(p.rulesetId), source: 'preset' })} />
        ))}
      </View>

      <View style={styles.detail}>
        <Text style={styles.detailTitle}>
          {value.source === 'campaign' && campaign ? `${campaign.name}'s rules`
            : activeCustom ? activeCustom.name : active?.name ?? rulesetLabel(value.rulesetId)}
        </Text>
        {(active?.highlights ?? []).map(h => <Text key={h} style={styles.detailLine}>• {h}</Text>)}
        {activeCustom && <Text style={styles.detailLine}>Built on {rulesetLabel(activeCustom.baseRulesetId)} with your own changes.</Text>}
        {value.source === 'campaign' && <Text style={styles.detailLine}>Uses the rules your DM set for the campaign.</Text>}
      </View>
    </View>
  );
}

function Chip({ label, active, onPress, dashed }: { label: string; active: boolean; onPress: () => void; dashed?: boolean }) {
  return (
    <Pressable style={[styles.chip, active && styles.chipOn, dashed && styles.chipDashed]} onPress={onPress} accessibilityRole="button" accessibilityState={{ selected: active }}>
      <Text style={[styles.chipTxt, active && styles.chipTxtOn]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: Colors.surface, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border, padding: Spacing.md, marginBottom: Spacing.sm, gap: Spacing.xs },
  title: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  sub: { fontSize: FontSize.xs, color: Colors.textSecondary },
  group: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, color: Colors.gold, letterSpacing: 0.5, marginTop: Spacing.sm },
  hint: { fontSize: FontSize.xs, color: Colors.textDim },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  chip: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs, borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surfaceHigh },
  chipOn: { borderColor: Colors.gold, backgroundColor: Colors.gold + '22' },
  chipDashed: { borderStyle: 'dashed' },
  chipTxt: { fontSize: FontSize.sm, color: Colors.textSecondary },
  chipTxtOn: { color: Colors.gold, fontWeight: FontWeight.bold },
  detail: { marginTop: Spacing.sm, padding: Spacing.sm, borderRadius: Radius.md, backgroundColor: Colors.surfaceHigh, gap: 2 },
  detailTitle: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  detailLine: { fontSize: FontSize.xs, color: Colors.textSecondary },
});
