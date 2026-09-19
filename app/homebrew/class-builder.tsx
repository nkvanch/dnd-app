// app/homebrew/class-builder.tsx
// Homebrew class builder — Phase 2 full authoring UI.
// Sections: Basics → Saving Throws → Proficiencies →
//           Spellcasting → Per-Level Features → ASI Levels → Save
import { useState, useEffect, useMemo } from 'react';
import {
  View, Text, ScrollView, Pressable, StyleSheet, TextInput, Modal,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { CharClass, Ability, DraftTrait, Entity, RulesetId, ChoiceDefinition } from '../../src/engine/types';
import {
  ChoiceDefinitionEditorModal, DraftChoice, newDraftChoice,
} from '../../src/components/homebrew/ChoiceDefinitionEditor';
import { draftChoiceToDefinition, definitionToDraftChoice } from '../../src/content/choiceDefinitionCompiler';
import { useHomebrewStore } from '../../src/store/homebrewStore';
import { usePendingSelectionStore } from '../../src/store/pendingSelectionStore';
import { GameRulesetPicker } from '../../src/components/homebrew/GameRulesetPicker';
import { gameIdForRuleset } from '../../src/content/rulesets';
import { Alert } from '../../src/utils/alert';
import { mergeItemIndex, resolveItemById } from '../../src/content/contentResolution';
import { useSafeGoBack } from '../../src/hooks/useSafeGoBack';
import { SafeBottomView } from '../../src/components/SafeBottomView';
import { newDraftTrait, TraitEditorModal, COMMON_TOOLS, disambiguateId } from '../../src/components/homebrew/TraitEditor';
import { globalContentDB } from '../../src/content/classes/library';
import { getProgressionForClass } from '../../src/content/classes/progressions';
import { simulate } from '../../src/engine/simulate';
import { applyGrant } from '../../src/engine/leveling';
import { buildFeatSummaryRows } from '../../src/components/FeatPreviewModal';
import { HomebrewTestModal, Row } from '../../src/components/homebrew/HomebrewTestModal';
import { useCharacterStore, makeEmptyEntity, DEFAULT_RULES } from '../../src/store/characterStore';
import { mergeHomebrewDefinition } from '../../src/engine/homebrewRoundTrip';
import { hydrateLeveledChoices, serializeLeveledChoices, LeveledLosslessDraftChoice } from '../../src/engine/homebrewNestedSerializers';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../../src/theme';

// ── Constants ─────────────────────────────────────────────────────────────────

const HIT_DICE = [4, 6, 8, 10, 12] as const;

const ABILITIES: Ability[] = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
const ABILITY_LABELS: Record<Ability, string> = {
  str: 'STR', dex: 'DEX', con: 'CON', int: 'INT', wis: 'WIS', cha: 'CHA',
};

const ARMOR_PROFS = ['light', 'medium', 'heavy', 'shield'] as const;
const WEAPON_PROFS = ['simple', 'martial'] as const;

const SPELL_ABILITIES: Ability[] = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
const SPELL_STYLES = [
  { key: 'full', label: 'Full Caster', sub: 'Wizard/Cleric slots' },
  { key: 'half', label: 'Half Caster', sub: 'Paladin/Ranger slots' },
  { key: 'pact', label: 'Pact Magic',  sub: 'Warlock-style slots' },
] as const;

const DEFAULT_ASI_LEVELS = [4, 8, 12, 16, 19];

function toId(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

type LevelFeature = DraftTrait & { level: number };
type LevelChoice = LeveledLosslessDraftChoice;

/**
 * Classes saved before class features gained real effect kinds have
 * levelFeatures entries shaped as just {level, name, description} — fill in
 * DraftTrait's other fields (effectKind defaulting to 'none', a fresh
 * localId if missing) so editing an old homebrew class in the builder
 * doesn't hand the trait editor an incomplete object.
 */
function normalizeLevelFeature(f: Partial<DraftTrait> & { level: number; name: string; description?: string }): LevelFeature {
  const base = newDraftTrait(f.name);
  return { ...base, ...f, localId: f.localId ?? base.localId, effectKind: f.effectKind ?? 'none' };
}

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
  const goBack   = useSafeGoBack('/(tabs)');
  const saveItem = useHomebrewStore(s => s.saveItem);
  const homebrewItems = useHomebrewStore(s => s.items);
  const homebrewClasses = useHomebrewStore(s => s.classes);
  const { editId } = useLocalSearchParams<{ editId?: string }>();
  const editing = editId ? homebrewClasses.find(c => c.id === editId) ?? null : null;
  const draftRulesetId = useCharacterStore(s => s.draft?.rulesetId);
  const [rulesetId, setRulesetId] = useState<RulesetId | undefined>(() => editing ? editing.rulesetId : draftRulesetId);

  // ── Basics
  const [name,        setName]        = useState('');
  const [hitDie,      setHitDie]      = useState<4|6|8|10|12>(8);
  const [hpAbility,   setHpAbility]   = useState<Ability>('con');
  const [description, setDescription] = useState('');

  // ── Saving Throws
  const [savingThrows, setSavingThrows] = useState<Ability[]>([]);

  // ── Proficiencies
  const [armorProfs,  setArmorProfs]  = useState<string[]>([]);
  const [weaponProfs, setWeaponProfs] = useState<string[]>([]);
  const [toolProfs,   setToolProfs]   = useState<string[]>([]);
  const [newTool,     setNewTool]     = useState('');

  // ── Starting Equipment
  const [startingEquipment, setStartingEquipment] = useState<{ id: string; name: string }[]>([]);
  const [equipSearch, setEquipSearch] = useState('');
  // Purely descriptive — deliberately NOT added to startingEquipment (which
  // holds real item ids the engine grants via a 'starting_item' Grant). A
  // fake item id here would push an unresolvable inventory entry onto any
  // character who takes this class — broken, not just incomplete. This is
  // shown as flavor text instead, same honest tradeoff as the background
  // builder's equipment field.
  const [equipmentNotes, setEquipmentNotes] = useState('');

  const [saving, setSaving] = useState(false);
  const [testOpen, setTestOpen] = useState(false);
  const [testRows, setTestRows] = useState<Row[]>([]);

  // ── Spellcasting
  const [isCaster,        setIsCaster]        = useState(false);
  // Multi-select: 1 selected = fixed ability (backward-compat behavior); 2+
  // selected = the player picks at creation (spellcastingAbilityOptions).
  const [spellAbilities,  setSpellAbilities]  = useState<Ability[]>(['cha']);
  const [spellStyle,      setSpellStyle]      = useState<'full'|'half'|'pact'>('full');
  const [spellStartLevel, setSpellStartLevel] = useState('1');

  // ── Per-level features
  const [levelFeatures, setLevelFeatures] = useState<LevelFeature[]>([]);
  const [addLevel, setAddLevel] = useState('1');
  const [addName,  setAddName]  = useState('');
  const [openFeatureId, setOpenFeatureId] = useState<string | null>(null);

  // ── Per-level player choices (Expertise/Tool/Language)
  const [levelChoicesList, setLevelChoicesList] = useState<LevelChoice[]>([]);
  const [addChoiceLevel, setAddChoiceLevel] = useState('1');
  const [openChoiceId, setOpenChoiceId] = useState<string | null>(null);

  // ── ASI levels
  const [asiLevels, setAsiLevels] = useState<number[]>([...DEFAULT_ASI_LEVELS]);

  // Edit mode: CharClass already stores every authoring field directly (it's
  // the same simplified shape the builder writes), so reloading is a direct
  // 1:1 field copy — no reverse-engineering from the compiled progression
  // needed. Runs once when the existing class first resolves.
  useEffect(() => {
    if (!editing) return;
    setName(editing.name);
    setRulesetId(editing.rulesetId);
    setHitDie(editing.hitDie as 4|6|8|10|12);
    setHpAbility(editing.hpAbility ?? 'con');
    setDescription(editing.description ?? '');
    setSavingThrows(editing.savingThrows ?? []);
    setArmorProfs(editing.armorProfs ?? []);
    setWeaponProfs(editing.weaponProfs ?? []);
    setToolProfs(editing.toolProfs ?? []);
    setStartingEquipment(
      (editing.startingEquipment ?? []).map(id => {
        // Bug fix (architecture review C9): this used to concat official +
        // homebrew with no dedup and official listed first, so a homebrew
        // item overriding an official one by id resolved to the official
        // name instead of the override — resolveItemById already centralizes
        // the correct homebrew-first precedence (contentResolution.ts).
        const found = resolveItemById(id, homebrewItems);
        return { id, name: found?.name ?? id };
      })
    );
    setEquipmentNotes(editing.equipmentNotes ?? '');
    setIsCaster(!!editing.spellcastingAbility || (editing.spellcastingAbilityOptions?.length ?? 0) > 0);
    setSpellAbilities(
      editing.spellcastingAbilityOptions?.length ? editing.spellcastingAbilityOptions
      : editing.spellcastingAbility ? [editing.spellcastingAbility]
      : ['cha']
    );
    setSpellStyle(editing.spellcastingStyle ?? 'full');
    setSpellStartLevel(String(editing.spellcastingStartLevel ?? 1));
    setLevelFeatures((editing.levelFeatures ?? []).map(normalizeLevelFeature));
    setAsiLevels(editing.asiLevels ?? [...DEFAULT_ASI_LEVELS]);
    // CHOICE-AUTHORING-1: CharClass.levelChoices stores already-compiled
    // ChoiceDefinition[] per level (unlike levelFeatures' draft-shaped
    // DraftTrait[]) — reconstruct via definitionToDraftChoice using the
    // exact idPrefix buildHomebrewClass() below composes at save time, so
    // re-saving without changes round-trips to the same ids.
    setLevelChoicesList(hydrateLeveledChoices(editing.levelChoices, editing.id));
  }, [editing?.id]);

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
  function addTool() {
    const t = newTool.trim();
    if (!t || toolProfs.includes(t)) return;
    setToolProfs(prev => [...prev, t]);
    setNewTool('');
  }
  function toggleTool(t: string) {
    setToolProfs(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]);
  }
  function removeTool(t: string) {
    setToolProfs(prev => prev.filter(x => x !== t));
  }
  function toggleSpellAbility(ab: Ability) {
    setSpellAbilities(prev =>
      prev.includes(ab)
        ? prev.length > 1 ? prev.filter(a => a !== ab) : prev  // keep at least 1 selected
        : [...prev, ab]
    );
  }
  function addStartingItem(id: string, name: string) {
    if (startingEquipment.some(i => i.id === id)) return;
    setStartingEquipment(prev => [...prev, { id, name }]);
    setEquipSearch('');
  }
  function removeStartingItem(id: string) {
    setStartingEquipment(prev => prev.filter(i => i.id !== id));
  }
  // Bug fix (architecture review C9): same unmerged-concat pattern as
  // above — mergeItemIndex already dedups by id (homebrew wins) instead of
  // showing a colliding homebrew/official pair as two separate rows.
  // BUILDER-PERF-1: mergeItemIndex (full ~891-item catalog merge) used to
  // rerun on every keystroke of equipSearch once it hit 2+ chars — split
  // into its own memo (only recomputes when homebrewItems actually
  // changes) so each keystroke only pays for the filter/slice, not the
  // full merge.
  const allItemIndex = useMemo(() => mergeItemIndex(homebrewItems), [homebrewItems]);
  const equipResults = useMemo(() => equipSearch.trim().length >= 2
    ? allItemIndex
        .filter(i => i.name.toLowerCase().includes(equipSearch.trim().toLowerCase()))
        .slice(0, 12)
    : [], [allItemIndex, equipSearch]);
  function toggleAsiLevel(lvl: number) {
    setAsiLevels(prev =>
      prev.includes(lvl) ? prev.filter(l => l !== lvl) : [...prev, lvl].sort((a, b) => a - b)
    );
  }
  function addFeature() {
    const lvl = parseInt(addLevel, 10);
    const nm  = addName.trim();
    if (!nm || isNaN(lvl) || lvl < 1 || lvl > 20) return;
    const f: LevelFeature = { ...newDraftTrait(nm), level: lvl };
    setLevelFeatures(prev => [...prev, f]);
    setAddName('');
    setOpenFeatureId(f.localId); // auto-open the editor — same pattern as race traits
  }
  function updateFeature(f: LevelFeature) {
    setLevelFeatures(prev => prev.map(x => x.localId === f.localId ? f : x));
  }
  function deleteFeature(localId: string) {
    setLevelFeatures(prev => prev.filter(x => x.localId !== localId));
    setOpenFeatureId(null);
  }

  function addLevelChoice() {
    const lvl = parseInt(addChoiceLevel, 10);
    if (isNaN(lvl) || lvl < 1 || lvl > 20) return;
    const d: LevelChoice = { ...newDraftChoice('tool'), level: lvl };
    setLevelChoicesList(prev => [...prev, d]);
    setOpenChoiceId(d.localId);
  }
  function updateLevelChoice(d: DraftChoice) {
    setLevelChoicesList(prev => prev.map(x => x.localId === d.localId ? { ...x, ...d } : x));
  }
  function deleteLevelChoice(localId: string) {
    setLevelChoicesList(prev => prev.filter(x => x.localId !== localId));
    setOpenChoiceId(null);
  }

  // ── Build / Save ───────────────────────────────────────────────────────────

  function buildHomebrewClass(): CharClass {
    const startLvl = parseInt(spellStartLevel, 10);
    // HOMEBREW-ID-COLLISION-1: see race-builder.tsx's identical fix for the
    // full explanation — auto-generated ids had no collision check against
    // official content.
    const takenClassIds = new Set([
      ...globalContentDB.classes.map(c => c.id),
      ...homebrewClasses.filter(c => c.id !== editing?.id).map(c => c.id),
    ]);
    const id = editing?.id ?? disambiguateId(toId(name) || 'homebrew_class', takenClassIds);
    const levelChoices = serializeLeveledChoices(editing?.levelChoices, levelChoicesList, id);
    return mergeHomebrewDefinition(editing, {
      id,
      name:        name.trim(),
      hitDie,
      features:    editing?.features ?? [],
      description: description.trim() || undefined,
      savingThrows:            savingThrows.length > 0 ? savingThrows : undefined,
      armorProfs:              armorProfs.length > 0   ? armorProfs   : undefined,
      weaponProfs:             weaponProfs.length > 0  ? weaponProfs  : undefined,
      toolProfs:               toolProfs.length > 0    ? toolProfs    : undefined,
      startingEquipment:       startingEquipment.length > 0 ? startingEquipment.map(i => i.id) : undefined,
      equipmentNotes:          equipmentNotes.trim() || undefined,
      hpAbility:               hpAbility !== 'con' ? hpAbility : undefined,
      spellcastingAbility:     isCaster && spellAbilities.length === 1 ? spellAbilities[0] : undefined,
      spellcastingAbilityOptions: isCaster && spellAbilities.length >= 2 ? spellAbilities : undefined,
      spellcastingStyle:       isCaster ? spellStyle   : undefined,
      spellcastingStartLevel:  isCaster && startLvl > 1 ? startLvl : undefined,
      asiLevels:               JSON.stringify(asiLevels) !== JSON.stringify(DEFAULT_ASI_LEVELS)
                                 ? asiLevels : undefined,
      levelFeatures:           levelFeatures.length > 0 ? levelFeatures : undefined,
      levelChoices,
      rulesetId,
      // Re-audit A39: this builder has no UI to author or edit either field
      // (both are import-only — an imported advanced class's full hand-
      // authored progression, or its PHB multiclass proficiency package).
      // Previously omitted from the returned object entirely, so editing an
      // imported class (even a rename-only save) silently deleted its real
      // progression/multiclass rules. Passed through unconditionally from
      // `editing` — there is nothing in this screen that could ever
      // intentionally change either, so no touched/dirty tracking is needed
      // here (unlike the trait-editor fields above).
      rawProgression:           editing?.rawProgression,
      multiclassProficiencies:  editing?.multiclassProficiencies,
    });
  }

  // Read-only test: reuses getProgressionForClass() — the SAME compile
  // function real class selection calls (progressions.ts:227) — to turn
  // the draft's simplified fields (savingThrows/armorProfs/levelFeatures/
  // spellcasting config/etc.) into real LevelEntry grants, so this test
  // can never drift from what picking the class for real would actually
  // produce. Same "combine every authored level at once, ignore the real
  // level-gate" approach as subclass-builder.tsx's runTest (verified safe
  // there: collectAllEffects only gates on Feature.isActive, never on
  // level) — a caster class's spell_slots grants specifically OVERWRITE
  // (not add to) the slot table each level (leveling.ts's "always zero
  // ALL tiers before applying the new row" comment), so applying every
  // level in order and keeping the LAST one is exactly right: it shows
  // the class's max slot table, not a broken accumulation. Only `entry
  // .grants` are applied — `entry.choices` (ASI/subclass-unlock/spellcasting-
  // ability picks) are skipped entirely, same as subclass-builder, since
  // none of them are specific to what THIS class's authored content does.
  function runTest() {
    const cls = buildHomebrewClass();
    const progression = getProgressionForClass(cls);
    const empty = makeEmptyEntity('homebrew-test');
    const scratch: Entity = { ...empty, identity: { ...empty.identity, level: 1 } };
    const { before, after } = simulate(scratch, e => {
      let updated = e;
      for (const entry of progression.entries) {
        for (const grant of entry.grants) {
          updated = applyGrant(updated, grant, entry.level, cls.id);
        }
      }
      return updated;
    }, DEFAULT_RULES);
    const rows = buildFeatSummaryRows(before, after);
    const beforeFeatureIds = new Set(before.features.map(f => f.id));
    for (const f of after.features) {
      if (!beforeFeatureIds.has(f.id)) rows.push({ label: `New feature: ${f.name}` });
    }
    const beforeResourceIds = new Set(before.resources.custom.map(r => r.id));
    for (const r of after.resources.custom) {
      if (!beforeResourceIds.has(r.id)) rows.push({ label: `New resource: ${r.name} (${r.maximum})` });
    }
    // Armor/weapon/tool proficiencies and starting equipment aren't part of
    // buildFeatSummaryRows either (it only diffs skill/save proficiencies) —
    // the 'proficiency' grant writes straight to entity.proficiencies.*,
    // never through a Feature, so it would otherwise be invisible here.
    const armorGained   = after.proficiencies.armor.filter(a => !before.proficiencies.armor.includes(a));
    const weaponsGained = after.proficiencies.weapons.filter(w => !before.proficiencies.weapons.includes(w));
    const toolsGained   = after.proficiencies.tools.filter(t => !before.proficiencies.tools.includes(t));
    if (armorGained.length > 0)   rows.push({ label: `Armor proficiency: ${armorGained.join(', ')}` });
    if (weaponsGained.length > 0) rows.push({ label: `Weapon proficiency: ${weaponsGained.join(', ')}` });
    if (toolsGained.length > 0)   rows.push({ label: `Tool proficiency: ${toolsGained.join(', ')}` });
    if (startingEquipment.length > 0) {
      rows.push({ label: `Starting equipment: ${startingEquipment.map(i => i.name).join(', ')}` });
    }
    // Spell slots aren't part of buildFeatSummaryRows/DERIVED_NUMERIC_KEYS —
    // show the class's eventual max slot table (the last level's grant,
    // per the "always overwrites" note above) same per-tier shape
    // LevelUpPreviewModal/RestPreviewModal already use.
    if (after.spellcasting) {
      for (const tier of ['1','2','3','4','5','6','7','8','9'] as const) {
        const total = after.spellcasting.slots[tier]?.total ?? 0;
        if (total > 0) rows.push({ label: `Level ${tier} slots (max): ${total}` });
      }
    } else if (isCaster && spellAbilities.length >= 2) {
      // Multi-ability casting defers the actual ability to a player choice
      // at creation (a non-auto-resolvable ChoiceDefinition, deliberately
      // not resolved by this test — see the comment above) — without an
      // init_spellcasting grant, the spell_slots grants that follow it all
      // no-op (leveling.ts's spell_slots case: "if (!entity.spellcasting)
      // return entity"), so slots can't be shown for this specific case.
      rows.push({ label: "This class lets the player choose a spellcasting ability at creation — spell slots aren't shown here since that choice isn't resolved in this test." });
    }
    if (rows.length > 0) {
      rows.push({ label: 'Shown combined across all authored levels (1-20) at once — not what a level 1 character of this class would actually have yet.' });
    }
    setTestRows(rows);
    setTestOpen(true);
  }

  async function handleSave() {
    if (!name.trim() || saving) return;
    setSaving(true);
    const cls = buildHomebrewClass();
    // Saves and navigates immediately rather than waiting on Alert's OK
    // button dismissal — React Native Web's Alert.alert has unreliable
    // callback-firing in some versions, so the actual save+navigate
    // shouldn't depend on it completing.
    try {
      await saveItem('class', cls);
      // SAVE-AND-ADD-1: tell class.tsx's class picker which class to
      // navigate to on return. No-op for any other caller.
      usePendingSelectionStore.getState().setPending('class_picker', cls.id);
      goBack();
    } catch (e) {
      console.error('[class-builder] save failed:', e);
      Alert.alert('Save failed', e instanceof Error ? e.message : 'Something went wrong. Check the console for details.');
    } finally {
      setSaving(false);
    }
  }

  // ── Feature list grouped by level ─────────────────────────────────────────

  const featuresByLevel = new Map<number, LevelFeature[]>();
  levelFeatures.forEach(f => {
    if (!featuresByLevel.has(f.level)) featuresByLevel.set(f.level, []);
    featuresByLevel.get(f.level)!.push(f);
  });
  const sortedLevels = Array.from(featuresByLevel.keys()).sort((a, b) => a - b);
  const openFeature = levelFeatures.find(f => f.localId === openFeatureId) ?? null;

  const EFFECT_KIND_LABELS: Record<string, string> = {
    none: 'Flavor only', ability_score: 'Ability score bonus', skill_proficiency: 'Skill proficiency',
    tool_proficiency: 'Tool proficiency', advantage_disadvantage: 'Advantage/Disadvantage',
    sense: 'Grants a sense', movement: 'Grants movement', resource_ability: 'Limited-use ability',
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>

      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={goBack}>
          <Text style={styles.backTxt}>← Back</Text>
        </Pressable>
        <Text style={styles.title}>{editing ? 'Edit Class' : 'New Class'}</Text>
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

        <Text style={styles.fieldLabel}>Game / Ruleset</Text>
        <GameRulesetPicker value={rulesetId} onChange={setRulesetId} defaultGameId={gameIdForRuleset(draftRulesetId)} />

        <Text style={styles.fieldLabel}>Hit Die</Text>
        <View style={styles.chipRow}>
          {HIT_DICE.map(d => (
            <Pressable key={d} style={[styles.chip, hitDie === d && styles.chipActive]}
              onPress={() => setHitDie(d)}>
              <Text style={[styles.chipTxt, hitDie === d && styles.chipTxtActive]}>d{d}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.fieldLabel}>HP Ability</Text>
        <Text style={styles.hint}>Which ability's modifier adds to HP gain each level. Standard is Constitution.</Text>
        <View style={styles.chipRow}>
          {ABILITIES.map(ab => (
            <Pressable key={ab} style={[styles.chip, hpAbility === ab && styles.chipActive]}
              onPress={() => setHpAbility(ab)}>
              <Text style={[styles.chipTxt, hpAbility === ab && styles.chipTxtActive]}>{ABILITY_LABELS[ab]}</Text>
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

        <Text style={styles.fieldLabel}>Tools</Text>
        <Text style={styles.hint}>Tap to add a common tool, or type your own below.</Text>
        <View style={styles.chipRow}>
          {COMMON_TOOLS.map(t => {
            const active = toolProfs.includes(t);
            return (
              <Pressable key={t} style={[styles.chip, active && styles.chipActive]} onPress={() => toggleTool(t)}>
                <Text style={[styles.chipTxt, active && styles.chipTxtActive]}>{t}</Text>
              </Pressable>
            );
          })}
        </View>
        {toolProfs.filter(t => !COMMON_TOOLS.includes(t)).length > 0 && (
          <View style={styles.chipRow}>
            {toolProfs.filter(t => !COMMON_TOOLS.includes(t)).map(t => (
              <Pressable key={t} style={[styles.chip, styles.chipActive]} onPress={() => removeTool(t)}>
                <Text style={[styles.chipTxt, styles.chipTxtActive]}>{t} ✕</Text>
              </Pressable>
            ))}
          </View>
        )}
        <View style={styles.inlineAddRow}>
          <TextInput style={[styles.input, { flex: 1 }]} value={newTool} onChangeText={setNewTool}
            placeholder="Something not listed above" placeholderTextColor={Colors.textDim} onSubmitEditing={addTool} />
          <Pressable style={styles.inlineAddBtn} onPress={addTool}>
            <Text style={styles.inlineAddTxt}>Add</Text>
          </Pressable>
        </View>

        {/* ── 3b. Starting Equipment ───────────────────────────── */}
        <View style={styles.divider} />
        <Text style={styles.fieldLabel}>Starting Equipment</Text>
        <Text style={styles.hint}>
          Fixed gear granted automatically — not a choice between options,
          just what this class always starts with.
        </Text>
        {startingEquipment.length > 0 && (
          <View style={styles.chipRow}>
            {startingEquipment.map(i => (
              <Pressable key={i.id} style={[styles.chip, styles.chipActive]} onPress={() => removeStartingItem(i.id)}>
                <Text style={[styles.chipTxt, styles.chipTxtActive]}>{i.name} ✕</Text>
              </Pressable>
            ))}
          </View>
        )}
        <TextInput style={styles.input} value={equipSearch} onChangeText={setEquipSearch}
          placeholder="Search items to add…" placeholderTextColor={Colors.textDim} />
        {equipResults.length > 0 && (
          <View style={styles.equipResults}>
            {equipResults.map(item => (
              <Pressable key={item.id} style={styles.equipResultRow} onPress={() => addStartingItem(item.id, item.name)}>
                <Text style={styles.equipResultTxt}>{item.name}</Text>
                <Text style={styles.equipResultAdd}>+ Add</Text>
              </Pressable>
            ))}
          </View>
        )}
        <Text style={[styles.fieldLabel, { marginTop: Spacing.sm }]}>Other Equipment Notes (optional)</Text>
        <Text style={styles.hint}>
          For gear that isn't a real item in the catalog — shown as flavor text only,
          not granted as an actual inventory item (there'd be nothing for it to resolve to).
        </Text>
        <TextInput style={[styles.input, styles.textArea]} value={equipmentNotes} onChangeText={setEquipmentNotes}
          placeholder="e.g. a set of masterwork lockpicks, a tattered field journal…"
          placeholderTextColor={Colors.textDim} multiline textAlignVertical="top" />

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
            <Text style={styles.hint}>
              Select one for a fixed ability, or two+ for a rare case where the
              player chooses their casting ability at creation.
            </Text>
            <View style={styles.chipRow}>
              {SPELL_ABILITIES.map(ab => {
                const active = spellAbilities.includes(ab);
                return (
                  <Pressable key={ab}
                    style={[styles.chip, active && styles.chipActive]}
                    onPress={() => toggleSpellAbility(ab)}
                  >
                    <Text style={[styles.chipTxt, active && styles.chipTxtActive]}>
                      {ABILITY_LABELS[ab]}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            {spellAbilities.length >= 2 && (
              <Text style={styles.warn}>
                ℹ Player will choose between {spellAbilities.map(a => a.toUpperCase()).join(', ')} at creation.
              </Text>
            )}

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
              {featuresByLevel.get(lvl)!.map(f => (
                <Pressable key={f.localId} style={styles.featureItem} onPress={() => setOpenFeatureId(f.localId)}>
                  <View style={styles.featureItemBody}>
                    <Text style={styles.featureItemName}>{f.name}</Text>
                    <Text style={styles.featureItemDesc} numberOfLines={1}>{EFFECT_KIND_LABELS[f.effectKind]}</Text>
                  </View>
                  <Pressable
                    style={styles.featureDeleteBtn}
                    onPress={() => deleteFeature(f.localId)}
                    hitSlop={8}
                  >
                    <Text style={styles.featureDeleteTxt}>✕</Text>
                  </Pressable>
                </Pressable>
              ))}
            </View>
          ))
        )}

        <Text style={styles.hint}>
          Add a feature by name and level, then tap it to optionally add a description and
          choose what it actually does — an ability score bonus, a skill proficiency, a sense,
          extra movement, or a limited-use ability.
        </Text>
        <View style={styles.inlineAddRow}>
          <TextInput
            style={[styles.input, styles.smallInput]}
            value={addLevel}
            onChangeText={setAddLevel}
            keyboardType="number-pad"
            placeholder="Lv"
            placeholderTextColor={Colors.textDim}
          />
          <TextInput
            style={[styles.input, { flex: 1 }]}
            value={addName}
            onChangeText={setAddName}
            placeholder="Feature name (e.g. Second Wind)"
            placeholderTextColor={Colors.textDim}
            onSubmitEditing={addFeature}
          />
          <Pressable style={styles.inlineAddBtn} onPress={addFeature}>
            <Text style={styles.inlineAddTxt}>Add</Text>
          </Pressable>
        </View>

        {/* ── 5b. Per-Level Player Choices ──────────────────────────────── */}
        <View style={styles.divider} />
        <Text style={styles.fieldLabel}>Per-Level Player Choices</Text>
        <Text style={styles.hint}>
          A real choice the player resolves at a specific level — e.g. "at level 3,
          choose one tool proficiency." Distinct from a Feature above: this doesn't
          grant anything by itself, it queues a pick.
        </Text>
        {levelChoicesList.length === 0 ? (
          <Text style={styles.emptyNote}>No player choices added yet.</Text>
        ) : (
          Array.from(new Set(levelChoicesList.map(c => c.level))).sort((a, b) => a - b).map(lvl => (
            <View key={lvl} style={styles.featureLevelGroup}>
              <Text style={styles.featureLevelLabel}>LEVEL {lvl}</Text>
              {levelChoicesList.filter(c => c.level === lvl).map(c => (
                <Pressable key={c.localId} style={styles.featureItem} onPress={() => setOpenChoiceId(c.localId)}>
                  <View style={styles.featureItemBody}>
                    <Text style={styles.featureItemName}>{c.kind === 'expertise' ? 'Expertise' : c.kind === 'tool' ? 'Tool Proficiency' : 'Language'} choice</Text>
                    <Text style={styles.featureItemDesc} numberOfLines={1}>Choose {c.count}</Text>
                  </View>
                  <Pressable style={styles.featureDeleteBtn} onPress={() => deleteLevelChoice(c.localId)} hitSlop={8}>
                    <Text style={styles.featureDeleteTxt}>✕</Text>
                  </Pressable>
                </Pressable>
              ))}
            </View>
          ))
        )}
        <View style={styles.inlineAddRow}>
          <TextInput
            style={[styles.input, styles.smallInput]}
            value={addChoiceLevel}
            onChangeText={setAddChoiceLevel}
            keyboardType="number-pad"
            placeholder="Lv"
            placeholderTextColor={Colors.textDim}
          />
          <Pressable style={[styles.inlineAddBtn, { flex: 1 }]} onPress={addLevelChoice}>
            <Text style={styles.inlineAddTxt}>+ Add Player Choice</Text>
          </Pressable>
        </View>

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

      {/* Footer: Test + Save */}
      <SafeBottomView>
        <View style={styles.footer}>
          <Pressable
            style={[styles.testBtn, !name.trim() && styles.btnDisabled]}
            onPress={runTest}
            disabled={!name.trim()}
          >
            <Text style={styles.testBtnTxt}>🧪 Test</Text>
          </Pressable>
          <Pressable
            style={[styles.saveBtn, (!name.trim() || saving) && styles.btnDisabled]}
            onPress={() => { void handleSave(); }}
            disabled={!name.trim() || saving}
          >
            <Text style={styles.saveBtnTxt}>{saving ? 'Saving...' : 'Save Class'}</Text>
          </Pressable>
        </View>
      </SafeBottomView>

      {/* ── Feature effect editor — same component race traits use ───────────── */}
      <TraitEditorModal
        trait={openFeature}
        visible={!!openFeature}
        onChange={t => updateFeature(t as LevelFeature)}
        onDone={() => setOpenFeatureId(null)}
        onDelete={() => openFeature && deleteFeature(openFeature.localId)}
      />

      <HomebrewTestModal
        visible={testOpen}
        title={`Testing: ${name.trim() || 'New Class'}`}
        rows={testRows}
        onClose={() => setTestOpen(false)}
      />

      <ChoiceDefinitionEditorModal
        draft={levelChoicesList.find(c => c.localId === openChoiceId) ?? null}
        visible={!!openChoiceId}
        onChange={updateLevelChoice}
        onDone={() => setOpenChoiceId(null)}
        onDelete={() => openChoiceId && deleteLevelChoice(openChoiceId)}
      />

    </KeyboardAvoidingView>
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

  inlineAddRow: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.xs },
  inlineAddBtn: { backgroundColor: Colors.gold, borderRadius: Radius.md, paddingHorizontal: Spacing.md, justifyContent: 'center' },
  inlineAddTxt: { color: Colors.bg, fontWeight: FontWeight.bold, fontSize: FontSize.sm },

  equipResults: {
    backgroundColor: Colors.surface, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border, marginTop: 4, overflow: 'hidden',
  },
  equipResultRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  equipResultTxt: { color: Colors.textPrimary, fontSize: FontSize.sm, flex: 1 },
  equipResultAdd: { color: Colors.gold, fontSize: FontSize.xs, fontWeight: FontWeight.bold },

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
    flexDirection: 'row', gap: Spacing.sm,
    padding: Spacing.sm, backgroundColor: Colors.surfaceHigh,
    borderTopWidth: 1, borderTopColor: Colors.border,
  },
  testBtn:     { flex: 1, backgroundColor: Colors.surface, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, padding: Spacing.md, alignItems: 'center' },
  testBtnTxt:  { color: Colors.textSecondary, fontWeight: FontWeight.bold, fontSize: FontSize.md },
  saveBtn:     { flex: 1, backgroundColor: Colors.gold, borderRadius: Radius.md, padding: Spacing.md, alignItems: 'center' },
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
