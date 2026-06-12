// app/sheet/TabAbilities.tsx
// Tab 3 — Ability scores, saving throws, skills.
import { useState } from 'react';
import { ScrollView, View, Text, Pressable, StyleSheet } from 'react-native';
import { Entity, Ability, SkillName, CampaignRules } from '../../engine/types';
import { modifier, collectAllEffects, applyStatModifiers } from '../../engine/pipeline';
import { AuditModal } from './AuditModal';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../../theme';

const ABILITIES: { key: Ability; label: string }[] = [
  { key: 'str', label: 'STR' },
  { key: 'dex', label: 'DEX' },
  { key: 'con', label: 'CON' },
  { key: 'int', label: 'INT' },
  { key: 'wis', label: 'WIS' },
  { key: 'cha', label: 'CHA' },
];

const SKILLS: { name: SkillName; label: string; ability: Ability }[] = [
  { name: 'athletics',       label: 'Athletics',       ability: 'str' },
  { name: 'acrobatics',      label: 'Acrobatics',      ability: 'dex' },
  { name: 'sleight_of_hand', label: 'Sleight of Hand', ability: 'dex' },
  { name: 'stealth',         label: 'Stealth',         ability: 'dex' },
  { name: 'arcana',          label: 'Arcana',          ability: 'int' },
  { name: 'history',         label: 'History',         ability: 'int' },
  { name: 'investigation',   label: 'Investigation',   ability: 'int' },
  { name: 'nature',          label: 'Nature',          ability: 'int' },
  { name: 'religion',        label: 'Religion',        ability: 'int' },
  { name: 'animal_handling', label: 'Animal Handling', ability: 'wis' },
  { name: 'insight',         label: 'Insight',         ability: 'wis' },
  { name: 'medicine',        label: 'Medicine',        ability: 'wis' },
  { name: 'perception',      label: 'Perception',      ability: 'wis' },
  { name: 'survival',        label: 'Survival',        ability: 'wis' },
  { name: 'deception',       label: 'Deception',       ability: 'cha' },
  { name: 'intimidation',    label: 'Intimidation',    ability: 'cha' },
  { name: 'performance',     label: 'Performance',     ability: 'cha' },
  { name: 'persuasion',      label: 'Persuasion',      ability: 'cha' },
];

interface AbilitiesProps {
  entity:       Entity;
  rules:        CampaignRules;
  isDm:         boolean;
  campaignId:   string;
  deviceId:     string;
  onEntityUpdate: (updated: Entity) => void;
}

export function TabAbilities({ entity, rules, isDm, campaignId, deviceId, onEntityUpdate }: AbilitiesProps) {
  const [auditStat,  setAuditStat]  = useState<string | null>(null);
  const [auditLabel, setAuditLabel] = useState('');

  function openAudit(stat: string, label: string) {
    setAuditStat(stat);
    setAuditLabel(label);
  }

  const { stats, derived, proficiencies, skills } = entity;

  // Effective stats include race/feature bonuses — matches the engine's derived values.
  const effectiveStats = applyStatModifiers(stats, collectAllEffects(entity));

  // Passive score = 10 + ability mod + proficiency (×2 for expertise) + bonus.
  const passiveScore = (skill: SkillName): number => {
    const entry = skills.skills[skill];
    if (!entry) return 10;
    const baseMod  = modifier(effectiveStats[entry.ability]);
    const profMult = entry.expertise ? 2 : entry.trained ? 1 : 0;
    return 10 + baseMod + derived.proficiencyBonus * profMult + (entry.bonus ?? 0);
  };

  const PASSIVES: { skill: SkillName; label: string }[] = [
    { skill: 'perception',    label: 'Passive Perception' },
    { skill: 'investigation', label: 'Passive Investigation' },
    { skill: 'insight',       label: 'Passive Insight' },
  ];

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>

      {/* Ability Scores */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>ABILITY SCORES</Text>
        <View style={styles.abilityGrid}>
          {ABILITIES.map(({ key, label }) => {
            const score  = effectiveStats[key];   // effective = base + race/feat bonuses
            const mod    = modifier(score);
            const modStr = mod >= 0 ? `+${mod}` : String(mod);
            return (
              <Pressable key={key} style={styles.abilityBox}
                onPress={() => openAudit(key, `${label} (${score})`)}
              >
                <Text style={styles.abilityLabel}>{label}</Text>
                <Text style={styles.abilityMod}>{modStr}</Text>
                <Text style={styles.abilityScore}>{score}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* Saving Throws */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>SAVING THROWS</Text>
        {ABILITIES.map(({ key, label }) => {
          const val = derived.savingThrows[key];
          const proficient = proficiencies.savingThrows.includes(key);
          const valStr = val >= 0 ? `+${val}` : String(val);
          return (
            <Pressable key={key} style={styles.saveRow}
              onPress={() => openAudit(`save_${key}`, `${label} Save`)}
            >
              <View style={[styles.profDot, proficient && styles.profDotActive]} />
              <Text style={styles.saveLabel}>{label} Save</Text>
              <Text style={styles.saveVal}>{valStr}</Text>
            </Pressable>
          );
        })}
      </View>

      {/* Passive Scores */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>PASSIVE SCORES</Text>
        {PASSIVES.map(({ skill, label }) => (
          <Pressable key={skill} style={styles.saveRow} onPress={() => openAudit(skill, label)}>
            <Text style={styles.saveLabel}>{label}</Text>
            <Text style={styles.saveVal}>{passiveScore(skill)}</Text>
          </Pressable>
        ))}
      </View>

      {/* Skills */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>SKILLS</Text>
        {SKILLS.map(({ name, label, ability }) => {
          const entry  = skills.skills[name];
          const val    = entry?.bonus ?? 0;
          const modVal = modifier(effectiveStats[ability]) + (entry?.expertise ? derived.proficiencyBonus * 2 : entry?.trained ? derived.proficiencyBonus : 0) + (entry?.bonus ?? 0);
          const valStr = modVal >= 0 ? `+${modVal}` : String(modVal);
          const expertise  = entry?.expertise;
          const trained    = entry?.trained;
          return (
            <Pressable key={name} style={styles.skillRow}
              onPress={() => openAudit(name, label)}
            >
              <View style={[
                styles.profDot,
                trained && styles.profDotActive,
                expertise && styles.profDotExpertise,
              ]} />
              <Text style={styles.skillLabel}>{label}</Text>
              <Text style={styles.skillAbility}>{ability.toUpperCase()}</Text>
              <Text style={styles.skillVal}>{valStr}</Text>
            </Pressable>
          );
        })}
      </View>

      <AuditModal
        entity={entity}
        stat={auditStat}
        label={auditLabel}
        rules={rules}
        isDm={isDm}
        campaignId={campaignId}
        deviceId={deviceId}
        onUpdate={onEntityUpdate}
        onClose={() => setAuditStat(null)}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll:   { flex: 1 },
  content:  { padding: Spacing.md, gap: Spacing.md, paddingBottom: Spacing.xxl },

  section: {
    backgroundColor: Colors.surface, borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.border, padding: Spacing.md, gap: Spacing.sm,
  },
  sectionTitle: { fontSize: FontSize.xs, color: Colors.textSecondary, letterSpacing: 2, fontWeight: FontWeight.bold },

  abilityGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  abilityBox: {
    flex: 1, minWidth: 80, backgroundColor: Colors.surfaceHigh,
    borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border,
    padding: Spacing.sm, alignItems: 'center', gap: 2,
  },
  abilityLabel: { fontSize: FontSize.xs, color: Colors.textSecondary, letterSpacing: 1 },
  abilityMod:   { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  abilityScore: { fontSize: FontSize.sm, color: Colors.textDim },

  saveRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  saveLabel: { flex: 1, fontSize: FontSize.sm, color: Colors.textPrimary },
  saveVal:   { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.textPrimary, width: 36, textAlign: 'right' },

  skillRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  skillLabel:   { flex: 1, fontSize: FontSize.sm, color: Colors.textPrimary },
  skillAbility: { fontSize: FontSize.xs, color: Colors.textDim, width: 28 },
  skillVal:     { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.textPrimary, width: 36, textAlign: 'right' },

  profDot: {
    width: 10, height: 10, borderRadius: Radius.full,
    borderWidth: 1, borderColor: Colors.textDim, backgroundColor: 'transparent',
  },
  profDotActive:    { backgroundColor: Colors.gold, borderColor: Colors.gold },
  profDotExpertise: { backgroundColor: Colors.blue, borderColor: Colors.blue },
});
