// app/homebrew/class-builder.tsx
// Homebrew class builder — Phase 2 full authoring UI.
// Sections: Basics → Saving Throws → Proficiencies →
//           Spellcasting → Per-Level Features → ASI Levels → Save
import { useState } from 'react';
import {
  View, Text, ScrollView, Pressable, StyleSheet, TextInput, Alert, Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import { CharClass, Ability } from '../../src/engine/types';
import { useHomebrewStore } from '../../src/store/homebrewStore';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../../src/theme';

// ── Constants ─────────────────────────────────────────────────────────────────

const HIT_DICE = [4, 6, 8, 10, 12] as const;

const ABILITIES: Ability[] = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
const ABILITY_LABELS: Record<Ability, string> = {
  str: 'STR', dex: 'DEX', con: 'CON', int: 'INT', wis: 'WIS', cha: 'CHA',
};

const ARMOR_PROFS = ['light', 'medium', 'heavy', 'shield'] as const;
const WEAPON_PROFS = ['simple', 'martial'] as const;

const SPELL_ABILITIES: Ability[] = ['int', 'wis', 'cha'];
const SPELL_STYLES = [
  { key: 'full', label: 'Full Caster', sub: 'Wizard/Cleric slots' },
  { key: 'half', label: 'Half Caster', sub: 'Paladin/Ranger slots' },
  { key: 'pact', label: 'Pact Magic',  sub: 'Warlock-style slots' },
] as const;

const DEFAULT_ASI_LEVELS = [4, 8, 12, 16, 19];

function toId(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

type LevelFeature = { level: number; name: string; description: string };

// ── Section header component ───────────────────────────────────────────────────

function SectionHeader({ title, n }: { title: string; n: number }) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionNum}><Text style={styles.sectionNumTxt}>{n}</Text></View>
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
  );
}

// ── Main screen ────────────────────────────────────────────────────────────────

export default function ClassBuilderScreen() {
  const router   = useRouter();
  const saveItem = useHomebrewStore(s => s.saveItem);

  // ── Basics
  const [name,        setName]        = useState('');
  const [hitDie,      setHitDie]      = useState<4|6|8|10|12>(8);
  const [description, setDescription] = useState('');

  // ── Saving Throws
  const [savingThrows, setSavingThrows] = useState<Ability[]>([]);

  // ── Proficiencies
  const [armorProfs,  setArmorProfs]  = useState<string[]>([]);
  const [weaponProfs, setWeaponProfs] = useState<string[]>([]);

  // ── Spellcasting
  const [isCaster,        setIsCaster]        = useState(false);
  const [spellAbility,    setSpellAbility]    = useState<Ability>('cha');
  const [spellStyle,      setSpellStyle]      = useState<'full'|'half'|'pact'>('full');
  const [spellStartLevel, setSpellStartLevel] = useState('1');

  // ── Per-level features
  const [levelFeatures, setLevelFeatures] = useState<LevelFeature[]>([]);
  const [addModal, setAddModal] = useState(false);
  const [addLevel, setAddLevel] = useState('1');
  const [addName,  setAddName]  = useState('');
  const [addDesc,  setAddDesc]  = useState('');

  // ── ASI levels
  const [asiLevels, setAsiLevels] = useState<number[]>([...DEFAULT_ASI_LEVELS]);

  // ── Helpers ────────────────────────────────────────────────────────────────

  function toggleSavingThrow(ab: Ability) {
    setSavingThrows(prev =>
      prev.includes(ab) ? prev.filter(a => a !== ab) : [...prev, ab]
    );
  }
  function toggleArmorProf(prof: string) {
    setArmorProfs(prev =>
      prev.includes(prof) ? prev.filter(p => p !== prof) : [...prev, prof]
    );
  }
  function toggleWeaponProf(prof: string) {
    setWeaponProfs(prev =>
      prev.includes(prof) ? prev.filter(p => p !== prof) : [...prev, prof]
    );
  }
  function toggleAsiLevel(lvl: number) {
    setAsiLevels(prev =>
      prev.includes(lvl) ? prev.filter(l => l !== lvl) : [...prev, lvl].sort((a, b) => a - b)
    );
  }
  function addFeature() {
    const lvl = parseInt(addLevel, 10);
    if (!addName.trim() || isNaN(lvl) || lvl < 1 || lvl > 20) return;
    setLevelFeatures(prev => [
      ...prev,
      { level: lvl, name: addName.trim(), description: addDesc.trim() },
    ]);
    setAddName('');
    setAddDesc('');
    setAddLevel('1');
    setAddModal(false);
  }
  function deleteFeature(idx: number) {
    setLevelFeatures(prev => prev.filter((_, i) => i !== idx));
  }

  // ── Save ───────────────────────────────────────────────────────────────────

  async function handleSave() {
    if (!name.trim()) { Alert.alert('Name required'); return; }
    const startLvl = parseInt(spellStartLevel, 10);
    const cls: CharClass = {
      id:          toId(name) || 'homebrew_class',
      name:        name.trim(),
      hitDie,
      features:    [],
      description: description.trim() || undefined,
      savingThrows:            savingThrows.length > 0 ? savingThrows : undefined,
      armorProfs:              armorProfs.length > 0   ? armorProfs   : undefined,
      weaponProfs:             weaponProfs.length > 0  ? weaponProfs  : undefined,
      spellcastingAbility:     isCaster ? spellAbility : undefined,
      spellcastingStyle:       isCaster ? spellStyle   : undefined,
      spellcastingStartLevel:  isCaster && startLvl > 1 ? startLvl : undefined,
      asiLevels:               JSON.stringify(asiLevels) !== JSON.stringify(DEFAULT_ASI_LEVELS)
                                 ? asiLevels : undefined,
      levelFeatures:           levelFeatures.length > 0 ? levelFeatures : undefined,
    };
    await saveItem('class', cls);
    Alert.alert('Saved!', `"${cls.name}" is ready to use in character creation.`, [
      { text: 'OK', onPress: () => router.back() },
    ]);
  }

  // ── Feature list grouped by level ─────────────────────────────────────────

  const featuresByLevel = new Map<number, { idx: number; name: string; description: string }[]>();
  levelFeatures.forEach((f, idx) => {
    if (!featuresByLevel.has(f.level)) featuresByLevel.set(f.level, []);
    featuresByLevel.get(f.level)!.push({ idx, ...f });
  });
  const sortedLevels = Array.from(featuresByLevel.keys()).sort((a, b) => a - b);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <View style={styles.screen}>

      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backTxt}>← Back</Text>
        </Pressable>
        <Text style={styles.title}>New Class</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >

        {/* ── 1. Basics ─────────────────────────────────────────────────── */}
        <SectionHeader title="Basics" n={1} />

        <Text style={styles.fieldLabel}>Class Name *</Text>
        <TextInput style={styles.input} value={name} onChangeText={setName}
          placeholder="e.g. Blood Hunter" placeholderTextColor={Colors.textDim} />

        <Text style={styles.fieldLabel}>Hit Die</Text>
        <View style={styles.chipRow}>
          {HIT_DICE.map(d => (
            <Pressable key={d} style={[styles.chip, hitDie === d && styles.chipActive]}
              onPress={() => setHitDie(d)}>
              <Text style={[styles.chipTxt, hitDie === d && styles.chipTxtActive]}>d{d}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.fieldLabel}>Description</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={description}
          onChangeText={setDescription}
          placeholder="Describe this class…"
          placeholderTextColor={Colors.textDim}
          multiline
          textAlignVertical="top"
        />

        {/* ── 2. Saving Throws ──────────────────────────────────────────── */}
        <View style={styles.divider} />
        <SectionHeader title="Saving Throws" n={2} />
        <Text style={styles.hint}>
          Which saving throws does this class grant proficiency in?
        </Text>
        <View style={styles.chipRow}>
          {ABILITIES.map(ab => {
            const active = savingThrows.includes(ab);
            return (
              <Pressable key={ab}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => toggleSavingThrow(ab)}
              >
                <Text style={[styles.chipTxt, active && styles.chipTxtActive]}>
                  {ABILITY_LABELS[ab]}
                </Text>
              </Pressable>
            );
          })}
        </View>
        {savingThrows.length > 2 && (
          <Text style={styles.warn}>⚠ Most classes use exactly 2 saving throw proficiencies.</Text>
        )}

        {/* ── 3. Starting Proficiencies ─────────────────────────────────── */}
        <View style={styles.divider} />
        <SectionHeader title="Starting Proficiencies" n={3} />

        <Text style={styles.fieldLabel}>Armor</Text>
        <View style={styles.chipRow}>
          {ARMOR_PROFS.map(p => {
            const active = armorProfs.includes(p);
            return (
              <Pressable key={p}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => toggleArmorProf(p)}
              >
                <Text style={[styles.chipTxt, active && styles.chipTxtActive]}>
                  {p.charAt(0).toUpperCase() + p.slice(1)}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.fieldLabel}>Weapons</Text>
        <View style={styles.chipRow}>
          {WEAPON_PROFS.map(p => {
            const active = weaponProfs.includes(p);
            return (
              <Pressable key={p}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => toggleWeaponProf(p)}
              >
                <Text style={[styles.chipTxt, active && styles.chipTxtActive]}>
                  {p.charAt(0).toUpperCase() + p.slice(1)}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* ── 4. Spellcasting ───────────────────────────────────────────── */}
        <View style={styles.divider} />
        <SectionHeader title="Spellcasting" n={4} />

        <Pressable style={styles.toggleRow} onPress={() => setIsCaster(v => !v)}>
          <View style={[styles.toggle, isCaster && styles.toggleOn]}>
            <View style={[styles.toggleThumb, isCaster && styles.toggleThumbOn]} />
          </View>
          <Text style={styles.toggleLabel}>
            {isCaster ? 'Spellcasting class' : 'Non-spellcasting (martial)'}
          </Text>
        </Pressable>

        {isCaster && (
          <View style={styles.spellConfig}>
            <Text style={styles.fieldLabel}>Spellcasting Ability</Text>
            <View style={styles.chipRow}>
              {SPELL_ABILITIES.map(ab => {
                const active = spellAbility === ab;
                return (
                  <Pressable key={ab}
                    style={[styles.chip, active && styles.chipActive]}
                    onPress={() => setSpellAbility(ab)}
                  >
                    <Text style={[styles.chipTxt, active && styles.chipTxtActive]}>
                      {ABILITY_LABELS[ab]}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={styles.fieldLabel}>Slot Table</Text>
            {SPELL_STYLES.map(s => {
              const active = spellStyle === s.key;
              return (
                <Pressable key={s.key}
                  style={[styles.styleRow, active && styles.styleRowActive]}
                  onPress={() => setSpellStyle(s.key)}
                >
                  <View style={[styles.styleRadio, active && styles.styleRadioActive]}>
                    {active && <View style={styles.styleRadioDot} />}
                  </View>
                  <View>
                    <Text style={[styles.styleLabel, active && styles.styleLabelActive]}>
                      {s.label}
                    </Text>
                    <Text style={styles.styleSub}>{s.sub}</Text>
                  </View>
                </Pressable>
              );
            })}

            <Text style={styles.fieldLabel}>Spellcasting Begins at Level</Text>
            <TextInput
              style={[styles.input, styles.smallInput]}
              value={spellStartLevel}
              onChangeText={setSpellStartLevel}
              keyboardType="number-pad"
              placeholder="1"
              placeholderTextColor={Colors.textDim}
            />
            <Text style={styles.hint}>
              Set to 2+ for classes where slots begin later (e.g. Paladin starts at level 2).
            </Text>
          </View>
        )}

        {/* ── 5. Per-Level Features ─────────────────────────────────────── */}
        <View style={styles.divider} />
        <SectionHeader title="Per-Level Features" n={5} />
        <Text style={styles.hint}>
          Add the class features characters gain at each level. Tap "+ Add Feature" to begin.
        </Text>

        {sortedLevels.length === 0 ? (
          <Text style={styles.emptyNote}>No features added yet.</Text>
        ) : (
          sortedLevels.map(lvl => (
            <View key={lvl} style={styles.featureLevelGroup}>
              <Text style={styles.featureLevelLabel}>LEVEL {lvl}</Text>
              {featuresByLevel.get(lvl)!.map(({ idx, name: fn, description: fd }) => (
                <View key={idx} style={styles.featureItem}>
                  <View style={styles.featureItemBody}>
                    <Text style={styles.featureItemName}>{fn}</Text>
                    {fd ? (
                      <Text style={styles.featureItemDesc} numberOfLines={2}>{fd}</Text>
                    ) : null}
                  </View>
                  <Pressable
                    style={styles.featureDeleteBtn}
                    onPress={() => deleteFeature(idx)}
                    hitSlop={8}
                  >
                    <Text style={styles.featureDeleteTxt}>✕</Text>
                  </Pressable>
                </View>
              ))}
            </View>
          ))
        )}

        <Pressable style={styles.addFeatureBtn} onPress={() => setAddModal(true)}>
          <Text style={styles.addFeatureBtnTxt}>+ Add Feature</Text>
        </Pressable>

        {/* ── 6. ASI Levels ─────────────────────────────────────────────── */}
        <View style={styles.divider} />
        <SectionHeader title="Ability Score Improvements" n={6} />
        <Text style={styles.hint}>
          Tap levels to toggle ASIs. Default (gold) matches most official classes.
        </Text>

        <View style={styles.asiGrid}>
          {Array.from({ length: 20 }, (_, i) => i + 1).map(lvl => {
            const active = asiLevels.includes(lvl);
            return (
              <Pressable
                key={lvl}
                style={[styles.asiCell, active && styles.asiCellActive]}
                onPress={() => toggleAsiLevel(lvl)}
              >
                <Text style={[styles.asiCellTxt, active && styles.asiCellTxtActive]}>
                  {lvl}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={styles.hint}>
          Selected: {asiLevels.length > 0 ? asiLevels.join(', ') : 'none (no ASIs)'}
        </Text>

      </ScrollView>

      {/* Footer: Save */}
      <View style={styles.footer}>
        <Pressable
          style={[styles.saveBtn, !name.trim() && styles.btnDisabled]}
          onPress={handleSave}
          disabled={!name.trim()}
        >
          <Text style={styles.saveBtnTxt}>💾 Save Class</Text>
        </Pressable>
      </View>

      {/* ── Add Feature Modal ─────────────────────────────────────────────── */}
      <Modal
        visible={addModal}
        transparent
        animationType="slide"
        onRequestClose={() => setAddModal(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setAddModal(false)}>
          <Pressable style={styles.modalSheet} onPress={e => e.stopPropagation()}>
            <Text style={styles.modalTitle}>Add Feature</Text>

            <Text style={styles.fieldLabel}>Level (1–20)</Text>
            <TextInput
              style={[styles.input, styles.smallInput]}
              value={addLevel}
              onChangeText={setAddLevel}
              keyboardType="number-pad"
              placeholder="1"
              placeholderTextColor={Colors.textDim}
            />

            <Text style={styles.fieldLabel}>Feature Name *</Text>
            <TextInput
              style={styles.input}
              value={addName}
              onChangeText={setAddName}
              placeholder="e.g. Second Wind"
              placeholderTextColor={Colors.textDim}
            />

            <Text style={styles.fieldLabel}>Description</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={addDesc}
              onChangeText={setAddDesc}
              placeholder="Describe what this feature does…"
              placeholderTextColor={Colors.textDim}
              multiline
              textAlignVertical="top"
            />

            <View style={styles.modalBtns}>
              <Pressable style={styles.modalCancelBtn} onPress={() => setAddModal(false)}>
                <Text style={styles.modalCancelTxt}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.modalAddBtn, !addName.trim() && styles.btnDisabled]}
                onPress={addFeature}
                disabled={!addName.trim()}
              >
                <Text style={styles.modalAddTxt}>Add Feature</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bg },
  header: {
    backgroundColor:   Colors.surfaceHigh,
    paddingTop:        Spacing.xl + 8,
    paddingBottom:     Spacing.md,
    paddingHorizontal: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backBtn: { marginBottom: 4 },
  backTxt: { color: Colors.gold, fontSize: FontSize.md, fontWeight: FontWeight.bold },
  title:   { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.textPrimary },

  scroll:  { flex: 1 },
  content: { padding: Spacing.md, gap: Spacing.md, paddingBottom: Spacing.xxl },

  divider: { height: 1, backgroundColor: Colors.border, marginVertical: Spacing.xs },

  // Section header
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center',
    gap: Spacing.sm, marginBottom: Spacing.xs,
  },
  sectionNum: {
    width: 24, height: 24, borderRadius: Radius.full,
    backgroundColor: Colors.gold + '33', borderWidth: 1, borderColor: Colors.gold + '66',
    alignItems: 'center', justifyContent: 'center',
  },
  sectionNumTxt: { fontSize: FontSize.xs, color: Colors.gold, fontWeight: FontWeight.bold },
  sectionTitle:  { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.textPrimary },

  // Form elements
  fieldLabel: {
    fontSize: FontSize.xs, color: Colors.textSecondary,
    letterSpacing: 1, fontWeight: FontWeight.bold, marginTop: Spacing.sm,
  },
  hint: { fontSize: FontSize.xs, color: Colors.textDim, lineHeight: 16, marginTop: 2 },
  warn: { fontSize: FontSize.xs, color: Colors.gold, marginTop: 4 },

  input: {
    backgroundColor: Colors.surface, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border,
    padding: Spacing.sm, color: Colors.textPrimary, fontSize: FontSize.md,
  },
  textArea:   { minHeight: 100 },
  smallInput: { maxWidth: 80 },

  // Chips
  chipRow: {
    flexDirection: 'row', flexWrap: 'wrap',
    gap: Spacing.sm, marginTop: Spacing.xs,
  },
  chip: {
    backgroundColor: Colors.surface, borderRadius: Radius.md,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    borderWidth: 1, borderColor: Colors.border,
  },
  chipActive:    { borderColor: Colors.gold, backgroundColor: Colors.gold + '22' },
  chipTxt:       { color: Colors.textSecondary, fontWeight: FontWeight.bold, fontSize: FontSize.sm },
  chipTxtActive: { color: Colors.gold },

  // Spellcasting toggle
  toggleRow: {
    flexDirection: 'row', alignItems: 'center',
    gap: Spacing.sm, paddingVertical: Spacing.xs,
  },
  toggle: {
    width: 44, height: 24, borderRadius: Radius.full,
    backgroundColor: Colors.border, justifyContent: 'center', paddingHorizontal: 2,
  },
  toggleOn:      { backgroundColor: Colors.green + '88' },
  toggleThumb: {
    width: 20, height: 20, borderRadius: Radius.full,
    backgroundColor: Colors.textDim, alignSelf: 'flex-start',
  },
  toggleThumbOn: { backgroundColor: Colors.green, alignSelf: 'flex-end' },
  toggleLabel:   { fontSize: FontSize.md, color: Colors.textPrimary, flex: 1 },

  spellConfig: { gap: Spacing.sm, marginTop: Spacing.xs },

  // Slot style radio rows
  styleRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    padding: Spacing.sm, borderRadius: Radius.md,
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
  },
  styleRowActive:  { borderColor: Colors.gold, backgroundColor: Colors.gold + '11' },
  styleRadio: {
    width: 18, height: 18, borderRadius: Radius.full,
    borderWidth: 2, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  styleRadioActive: { borderColor: Colors.gold },
  styleRadioDot:   { width: 8, height: 8, borderRadius: Radius.full, backgroundColor: Colors.gold },
  styleLabel:      { fontSize: FontSize.md, color: Colors.textSecondary, fontWeight: FontWeight.bold },
  styleLabelActive:{ color: Colors.gold },
  styleSub:        { fontSize: FontSize.xs, color: Colors.textDim },

  // Per-level features
  emptyNote:         { color: Colors.textDim, fontSize: FontSize.sm, fontStyle: 'italic' },
  featureLevelGroup: { gap: Spacing.xs },
  featureLevelLabel: {
    fontSize: FontSize.xs, fontWeight: FontWeight.bold, color: Colors.textDim,
    letterSpacing: 2, marginTop: Spacing.sm,
  },
  featureItem: {
    flexDirection: 'row', alignItems: 'flex-start',
    backgroundColor: Colors.surface, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border,
    padding: Spacing.sm, gap: Spacing.sm,
  },
  featureItemBody:  { flex: 1 },
  featureItemName:  { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  featureItemDesc:  { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2, lineHeight: 15 },
  featureDeleteBtn: { paddingLeft: Spacing.xs },
  featureDeleteTxt: { color: Colors.textDim, fontSize: FontSize.md },

  addFeatureBtn: {
    backgroundColor: Colors.surfaceHigh, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.gold + '66',
    padding: Spacing.sm, alignItems: 'center', marginTop: Spacing.xs,
  },
  addFeatureBtnTxt: { color: Colors.gold, fontWeight: FontWeight.bold, fontSize: FontSize.sm },

  // ASI grid
  asiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginTop: Spacing.xs },
  asiCell: {
    width: 40, height: 40, borderRadius: Radius.md,
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  asiCellActive:    { borderColor: Colors.gold, backgroundColor: Colors.gold + '22' },
  asiCellTxt:       { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: FontWeight.bold },
  asiCellTxtActive: { color: Colors.gold },

  // Footer
  footer: {
    padding: Spacing.sm, backgroundColor: Colors.surfaceHigh,
    borderTopWidth: 1, borderTopColor: Colors.border,
  },
  saveBtn:     { backgroundColor: Colors.gold, borderRadius: Radius.md, padding: Spacing.md, alignItems: 'center' },
  btnDisabled: { opacity: 0.4 },
  saveBtnTxt:  { color: Colors.bg, fontWeight: FontWeight.bold, fontSize: FontSize.md },

  // Add feature modal
  modalBackdrop: { flex: 1, backgroundColor: '#000000bb', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: Colors.surfaceHigh,
    borderTopLeftRadius: Radius.lg, borderTopRightRadius: Radius.lg,
    borderTopWidth: 1, borderColor: Colors.border,
    padding: Spacing.lg, gap: Spacing.sm,
    paddingBottom: Spacing.xxl,
  },
  modalTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  modalBtns:  { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm },
  modalCancelBtn: {
    flex: 1, backgroundColor: Colors.surface, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border, padding: Spacing.sm, alignItems: 'center',
  },
  modalCancelTxt: { color: Colors.textSecondary, fontWeight: FontWeight.bold },
  modalAddBtn:    { flex: 2, backgroundColor: Colors.gold, borderRadius: Radius.md, padding: Spacing.sm, alignItems: 'center' },
  modalAddTxt:    { color: Colors.bg, fontWeight: FontWeight.bold, fontSize: FontSize.md },
});
