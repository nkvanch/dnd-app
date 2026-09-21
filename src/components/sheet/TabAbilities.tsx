import { setManualEntitlement } from '../../engine/entitlements';
// app/sheet/TabAbilities.tsx
// Tab 3 — Ability scores, saving throws, skills.
import { useState, memo } from 'react';
import { ScrollView, View, Text, Pressable, StyleSheet, Modal, TextInput } from 'react-native';
import { Entity, Ability, SkillName, CampaignRules } from '../../engine/types';
import { modifier, effectiveAbilityScores, recomputeDerived } from '../../engine/pipeline';
import { applyDmOverride, getActiveOverrides, cancelDmOverride } from '../../engine/dmOverride';
import { AuditModal } from './AuditModal';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../../theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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

type ProficiencyCategory = 'armor' | 'weapons' | 'tools' | 'languages';

/** Cycles a skill's training: none -> trained -> expertise -> none. */
function cycleSkillProficiency(entity: Entity, skill: SkillName, rules: CampaignRules): Entity {
  const entry = entity.skills.skills[skill];
  const next = !entry.trained
    ? { ...entry, trained: true,  expertise: false }
    : !entry.expertise
      ? { ...entry, trained: true,  expertise: true }
      : { ...entry, trained: false, expertise: false };
  return recomputeDerived(setManualEntitlement(
    setManualEntitlement(entity, 'skill_proficiency', skill, next.trained),
    'skill_expertise', skill, next.expertise), rules);
}

function toggleSaveProficiency(entity: Entity, ability: Ability, rules: CampaignRules): Entity {
  const has = entity.proficiencies.savingThrows.includes(ability);
  const savingThrows = has
    ? entity.proficiencies.savingThrows.filter(a => a !== ability)
    : [...entity.proficiencies.savingThrows, ability];
  return recomputeDerived({
    ...entity,
    proficiencies: { ...entity.proficiencies, savingThrows },
  }, rules);
}

function addProficiencyItem(entity: Entity, category: ProficiencyCategory, value: string, rules: CampaignRules): Entity {
  const trimmed = value.trim();
  if (!trimmed || entity.proficiencies[category].includes(trimmed)) return entity;
  const kinds = { armor: 'armor_proficiency', weapons: 'weapon_proficiency', tools: 'tool_proficiency', languages: 'language' } as const;
  return recomputeDerived(setManualEntitlement(entity, kinds[category], trimmed, true), rules);
}

function removeProficiencyItem(entity: Entity, category: ProficiencyCategory, value: string, rules: CampaignRules): Entity {
  const kinds = { armor: 'armor_proficiency', weapons: 'weapon_proficiency', tools: 'tool_proficiency', languages: 'language' } as const;
  return recomputeDerived(setManualEntitlement(entity, kinds[category], value, false), rules);
}

const MANUAL_EDIT_LABEL = 'Manual edit';

/** A skill's flat manual bonus (SkillEntry.bonus) — a real field the total
 * calculation already reads (see the SKILLS section below), just never
 * exposed for editing until now. Direct field, no override system needed. */
function setSkillBonus(entity: Entity, skill: SkillName, value: number, rules: CampaignRules): Entity {
  const entry = entity.skills.skills[skill];
  return recomputeDerived({
    ...entity,
    skills: { ...entity.skills, skills: { ...entity.skills.skills, [skill]: { ...entry, bonus: value || null } } },
  }, rules);
}

/** Saving throws and passive scores have no dedicated "manual bonus" field
 * on the entity, unlike skills — reuse the DM-override engine instead (the
 * same mechanism FreeEditModal's "AC Bonus (add)" uses), just under a
 * player-facing label instead of an actual DM's. Re-setting replaces the
 * existing Manual-edit override on that stat rather than stacking with
 * itself, matching the AC Bonus precedent. */
function setOverrideBonus(entity: Entity, stat: string, value: number, rules: CampaignRules): Entity {
  const existing = getActiveOverrides(entity).filter(o => o.stat === stat && o.label === MANUAL_EDIT_LABEL);
  let e = entity;
  for (const o of existing) e = cancelDmOverride(e, o.id, rules);
  if (value !== 0) {
    e = applyDmOverride(e, {
      campaignId: '', entityId: entity.id, dmDeviceId: 'manual-edit',
      stat, operation: 'add', value, label: MANUAL_EDIT_LABEL, expiry: 'manual',
    }, rules);
  }
  return e;
}

function getOverrideBonus(entity: Entity, stat: string): number {
  return getActiveOverrides(entity)
    .filter(o => o.stat === stat && o.label === MANUAL_EDIT_LABEL)
    .reduce((sum, o) => sum + o.value, 0);
}

// Compact "label + number box" row for a manual bonus, committed on blur/submit
// (not on every keystroke) so typing "-2" doesn't get clobbered mid-entry.
// react-native-web doesn't fire onEndEditing on blur (only native does) — onBlur
// is the one that actually reaches us in the web build, so both are wired to
// the same commit logic and it's written to tolerate being called twice.
function BonusInputRow({ label, value, onChange }: { label: string; value: number; onChange: (n: number) => void }) {
  const [text, setText] = useState(String(value));
  const commit = () => {
    const n = parseInt(text, 10);
    const next = isNaN(n) ? 0 : n;
    setText(String(next));
    if (next !== value) onChange(next);
  };
  return (
    <View style={pStyles.bonusRow}>
      <Text style={pStyles.bonusLabel}>{label}</Text>
      <TextInput
        style={pStyles.bonusInput}
        value={text}
        onChangeText={setText}
        onEndEditing={commit}
        onBlur={commit}
        keyboardType="numbers-and-punctuation"
        placeholder="0"
        placeholderTextColor={Colors.textDim}
      />
    </View>
  );
}

// ── Proficiencies editor modal ───────────────────────────────────────────────
// Covers everything the sheet otherwise only sets at character creation or
// through content grants — for a proficiency picked up mid-campaign (a
// trained skill from downtime training, a tool/language/weapon/armor a DM
// hands you). Skills/saves toggle in place; the free-text categories use the
// same add-a-chip pattern as the Senses/Movement editors elsewhere on this
// sheet.
function ProficienciesModal({ visible, entity, rules, onUpdate, onClose }: {
  visible: boolean; entity: Entity; rules: CampaignRules; onUpdate: (u: Entity) => void; onClose: () => void;
}) {
  const [category, setCategory] = useState<ProficiencyCategory>('tools');
  const [text, setText] = useState('');
  const [bonusesOpen, setBonusesOpen] = useState(false);
  const insets = useSafeAreaInsets();

  const CATEGORY_TABS: { key: ProficiencyCategory; label: string }[] = [
    { key: 'tools',     label: 'Tools' },
    { key: 'weapons',   label: 'Weapons' },
    { key: 'armor',     label: 'Armor' },
    { key: 'languages', label: 'Languages' },
  ];

  function addItem() {
    if (!text.trim()) return;
    onUpdate(addProficiencyItem(entity, category, text, rules));
    setText('');
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={pStyles.backdrop} onPress={onClose}>
        <Pressable style={[pStyles.sheet, { paddingBottom: Math.max(insets.bottom, Spacing.md) }]} onPress={e => e.stopPropagation()}>
          <ScrollView keyboardShouldPersistTaps="handled">
            <Text style={pStyles.title}>Proficiencies</Text>

            <Text style={pStyles.sectionLabel}>Skills — tap to cycle: none / trained / expertise</Text>
            <View style={pStyles.chipWrap}>
              {SKILLS.map(({ name, label }) => {
                const entry = entity.skills.skills[name];
                return (
                  <Pressable
                    key={name}
                    style={[pStyles.chip, entry.trained && pStyles.chipActive, entry.expertise && pStyles.chipExpertise]}
                    onPress={() => onUpdate(cycleSkillProficiency(entity, name, rules))}
                  >
                    <Text style={[pStyles.chipTxt, (entry.trained || entry.expertise) && pStyles.chipTxtActive]}>
                      {label}{entry.expertise ? ' ★' : ''}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={pStyles.sectionLabel}>Saving Throws</Text>
            <View style={pStyles.chipWrap}>
              {ABILITIES.map(({ key, label }) => {
                const has = entity.proficiencies.savingThrows.includes(key);
                return (
                  <Pressable
                    key={key}
                    style={[pStyles.chip, has && pStyles.chipActive]}
                    onPress={() => onUpdate(toggleSaveProficiency(entity, key, rules))}
                  >
                    <Text style={[pStyles.chipTxt, has && pStyles.chipTxtActive]}>{label}</Text>
                  </Pressable>
                );
              })}
            </View>

            <Pressable style={pStyles.bonusToggle} onPress={() => setBonusesOpen(o => !o)}>
              <Text style={pStyles.sectionLabel}>
                Manual Bonuses (skills, saves, passives) {bonusesOpen ? '▲' : '▼'}
              </Text>
            </Pressable>
            {bonusesOpen && (
              <View style={pStyles.bonusPanel}>
                <Text style={pStyles.bonusGroupLabel}>Skills</Text>
                {SKILLS.map(({ name, label }) => (
                  <BonusInputRow
                    key={name}
                    label={label}
                    value={entity.skills.skills[name].bonus ?? 0}
                    onChange={n => onUpdate(setSkillBonus(entity, name, n, rules))}
                  />
                ))}
                <Text style={pStyles.bonusGroupLabel}>Saving Throws</Text>
                {ABILITIES.map(({ key, label }) => (
                  <BonusInputRow
                    key={key}
                    label={`${label} Save`}
                    value={getOverrideBonus(entity, `savingThrows.${key}`)}
                    onChange={n => onUpdate(setOverrideBonus(entity, `savingThrows.${key}`, n, rules))}
                  />
                ))}
                <Text style={pStyles.bonusGroupLabel}>Passive Scores</Text>
                {([
                  ['passivePerception', 'Passive Perception'],
                  ['passiveInvestigation', 'Passive Investigation'],
                  ['passiveInsight', 'Passive Insight'],
                ] as const).map(([stat, label]) => (
                  <BonusInputRow
                    key={stat}
                    label={label}
                    value={getOverrideBonus(entity, stat)}
                    onChange={n => onUpdate(setOverrideBonus(entity, stat, n, rules))}
                  />
                ))}
                <Text style={pStyles.bonusHint}>
                  Adds on top of the normal calculation — for a magic item, blessing,
                  or house rule that isn't otherwise modeled. Set back to 0 to clear.
                </Text>
              </View>
            )}

            <Text style={pStyles.sectionLabel}>Tools / Weapons / Armor / Languages</Text>
            <View style={pStyles.chipWrap}>
              {CATEGORY_TABS.map(t => (
                <Pressable key={t.key} style={[pStyles.chip, category === t.key && pStyles.chipActive]} onPress={() => setCategory(t.key)}>
                  <Text style={[pStyles.chipTxt, category === t.key && pStyles.chipTxtActive]}>{t.label}</Text>
                </Pressable>
              ))}
            </View>
            {entity.proficiencies[category].length > 0 && (
              <View style={pStyles.chipWrap}>
                {entity.proficiencies[category].map(item => (
                  <View key={item} style={pStyles.itemChip}>
                    <Text style={pStyles.itemChipTxt}>{item}</Text>
                    <Pressable onPress={() => onUpdate(removeProficiencyItem(entity, category, item, rules))} hitSlop={8}>
                      <Text style={pStyles.itemChipX}>✕</Text>
                    </Pressable>
                  </View>
                ))}
              </View>
            )}
            <View style={pStyles.inputRow}>
              <TextInput
                style={[pStyles.input, { flex: 1 }]}
                value={text}
                onChangeText={setText}
                placeholder={`Add a ${category.slice(0, -1)}…`}
                placeholderTextColor={Colors.textDim}
                onSubmitEditing={addItem}
              />
              <Pressable style={pStyles.addBtn} onPress={addItem}>
                <Text style={pStyles.addBtnTxt}>Add</Text>
              </Pressable>
            </View>

            <Pressable style={pStyles.doneBtn} onPress={onClose}>
              <Text style={pStyles.doneBtnTxt}>Done</Text>
            </Pressable>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const pStyles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: '#000000cc', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: Colors.surfaceHigh, borderTopLeftRadius: Radius.lg, borderTopRightRadius: Radius.lg,
    padding: Spacing.lg, gap: Spacing.sm, maxHeight: '85%',
  },
  title: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.textPrimary, textAlign: 'center', marginBottom: Spacing.sm },
  sectionLabel: { fontSize: FontSize.xs, color: Colors.textDim, fontWeight: FontWeight.bold, letterSpacing: 1, marginTop: Spacing.sm },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs, marginTop: Spacing.xs },
  chip: {
    backgroundColor: Colors.surface, borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: Spacing.sm, paddingVertical: 4,
  },
  chipActive:    { borderColor: Colors.gold, backgroundColor: Colors.gold + '22' },
  chipExpertise: { borderColor: Colors.blue, backgroundColor: Colors.blue + '22' },
  chipTxt:       { fontSize: FontSize.xs, color: Colors.textSecondary, fontWeight: FontWeight.bold },
  chipTxtActive: { color: Colors.gold },
  itemChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.blue + '22',
    borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.blue + '55',
    paddingHorizontal: Spacing.sm, paddingVertical: 4,
  },
  itemChipTxt: { fontSize: FontSize.xs, color: Colors.textPrimary, fontWeight: FontWeight.bold },
  itemChipX:   { color: Colors.red, fontSize: FontSize.sm },
  inputRow: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm },
  input: {
    backgroundColor: Colors.surface, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border,
    padding: Spacing.sm, color: Colors.textPrimary, fontSize: FontSize.md,
  },
  addBtn: { backgroundColor: Colors.gold, borderRadius: Radius.md, paddingHorizontal: Spacing.md, justifyContent: 'center' },
  addBtnTxt: { color: Colors.bg, fontWeight: FontWeight.bold, fontSize: FontSize.sm },
  doneBtn: { backgroundColor: Colors.surface, borderRadius: Radius.md, padding: Spacing.md, alignItems: 'center', marginTop: Spacing.md, borderWidth: 1, borderColor: Colors.border },
  doneBtnTxt: { color: Colors.textSecondary, fontSize: FontSize.md, fontWeight: FontWeight.bold },
  bonusToggle: { marginTop: Spacing.sm },
  bonusPanel: {
    backgroundColor: Colors.surface, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border,
    padding: Spacing.sm, marginTop: Spacing.xs, gap: 4,
  },
  bonusGroupLabel: {
    fontSize: FontSize.xs, color: Colors.gold, fontWeight: FontWeight.bold,
    marginTop: Spacing.sm, marginBottom: 2,
  },
  bonusRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 3,
  },
  bonusLabel: { fontSize: FontSize.sm, color: Colors.textSecondary, flex: 1 },
  bonusInput: {
    backgroundColor: Colors.surfaceHigh, borderRadius: Radius.sm, borderWidth: 1, borderColor: Colors.border,
    color: Colors.textPrimary, fontSize: FontSize.sm, fontWeight: FontWeight.bold,
    width: 56, textAlign: 'center', paddingVertical: 4, paddingHorizontal: 4,
  },
  bonusHint: {
    fontSize: FontSize.xs, color: Colors.textDim, marginTop: Spacing.sm, fontStyle: 'italic',
  },
});

interface AbilitiesProps {
  entity:       Entity;
  rules:        CampaignRules;
  isDm:         boolean;
  campaignId:   string;
  deviceId:     string;
  onEntityUpdate: (updated: Entity) => void;
}

function TabAbilitiesInner({ entity, rules, isDm, campaignId, deviceId, onEntityUpdate }: AbilitiesProps) {
  const [auditStat,  setAuditStat]  = useState<string | null>(null);
  const [auditLabel, setAuditLabel] = useState('');
  const [profOpen, setProfOpen] = useState(false);

  function openAudit(stat: string, label: string) {
    setAuditStat(stat);
    setAuditLabel(label);
  }

  const { derived, proficiencies, skills } = entity;

  // Effective stats include race/feature bonuses — matches the engine's derived values.
  const effectiveStats = effectiveAbilityScores(entity);

  // Bug fix (architecture review U6): this used to hand-recompute the
  // passive-score formula independently of entity.derived, so it had no way
  // to see a DM override on the passive score (entity.derived.
  // passivePerception correctly folds those in via recomputeDerived) — a
  // player could set a Manual Bonus override on Passive Perception and see
  // it apply everywhere on the sheet except here. Now reads the already-
  // computed, override-aware, Observant-feat-aware derived values directly.
  const PASSIVES: { skill: SkillName; stat: keyof Pick<typeof derived, 'passivePerception' | 'passiveInvestigation' | 'passiveInsight'>; label: string }[] = [
    { skill: 'perception',    stat: 'passivePerception',    label: 'Passive Perception' },
    { skill: 'investigation', stat: 'passiveInvestigation', label: 'Passive Investigation' },
    { skill: 'insight',       stat: 'passiveInsight',       label: 'Passive Insight' },
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

      {/* Other proficiencies — armor/weapons/tools/languages. Skills and
          saving throws stay in their own sections below (unchanged
          display), but all of it — including those — is editable from the
          one "✎ Edit" button here, since a proficiency picked up mid-
          campaign (downtime training, a DM hand-out) can land in any of
          these categories. */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>PROFICIENCIES</Text>
          <Pressable style={styles.editBtn} onPress={() => setProfOpen(true)}>
            <Text style={styles.editBtnTxt}>✎ Edit</Text>
          </Pressable>
        </View>
        {(['armor', 'weapons', 'tools', 'languages'] as const).map(cat => (
          proficiencies[cat].length > 0 && (
            <View key={cat} style={styles.profCatRow}>
              <Text style={styles.profCatLabel}>{cat}</Text>
              <Text style={styles.profCatItems}>{proficiencies[cat].join(', ')}</Text>
            </View>
          )
        ))}
        {(['armor', 'weapons', 'tools', 'languages'] as const).every(c => proficiencies[c].length === 0) && (
          <Text style={styles.emptyNote}>None yet — tap Edit to add tools, weapons, armor, or languages.</Text>
        )}
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
        {PASSIVES.map(({ skill, stat, label }) => (
          <Pressable key={skill} style={styles.saveRow} onPress={() => openAudit(stat, label)}>
            <Text style={styles.saveLabel}>{label}</Text>
            <Text style={styles.saveVal}>{derived[stat]}</Text>
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
              {val !== 0 && <Text style={styles.skillManualBonus}>{val > 0 ? `+${val}` : val}</Text>}
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

      <ProficienciesModal
        visible={profOpen}
        entity={entity}
        rules={rules}
        onUpdate={onEntityUpdate}
        onClose={() => setProfOpen(false)}
      />
    </ScrollView>
  );
}

// EDIT-PERF-1: see TabCharacter.tsx's identical comment.
export const TabAbilities = memo(TabAbilitiesInner);

const styles = StyleSheet.create({
  scroll:   { flex: 1 },
  content:  { padding: Spacing.md, gap: Spacing.md, paddingBottom: Spacing.xxl },

  section: {
    backgroundColor: Colors.surface, borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.border, padding: Spacing.md, gap: Spacing.sm,
  },
  sectionTitle: { fontSize: FontSize.xs, color: Colors.textSecondary, letterSpacing: 2, fontWeight: FontWeight.bold },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  editBtn: {
    backgroundColor: Colors.gold + '22', borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.gold + '66',
    paddingHorizontal: Spacing.sm, paddingVertical: 2,
  },
  editBtnTxt: { fontSize: FontSize.xs, color: Colors.gold, fontWeight: FontWeight.bold },
  profCatRow: { gap: 2 },
  profCatLabel: { fontSize: FontSize.xs, color: Colors.textDim, fontWeight: FontWeight.bold, textTransform: 'capitalize' },
  profCatItems: { fontSize: FontSize.sm, color: Colors.textPrimary },
  emptyNote: { fontSize: FontSize.sm, color: Colors.textDim, fontStyle: 'italic' },

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
  skillManualBonus: { fontSize: FontSize.xs, color: Colors.gold, marginRight: 4 },

  profDot: {
    width: 10, height: 10, borderRadius: Radius.full,
    borderWidth: 1, borderColor: Colors.textDim, backgroundColor: 'transparent',
  },
  profDotActive:    { backgroundColor: Colors.gold, borderColor: Colors.gold },
  profDotExpertise: { backgroundColor: Colors.blue, borderColor: Colors.blue },
});
