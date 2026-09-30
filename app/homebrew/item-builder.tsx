// app/homebrew/item-builder.tsx
// Homebrew item builder — name/cost/weight/description stay as-is. Real
// category picker (Weapon/Armor/Wondrous Item/Potion/Scroll/Ring/Wand/Staff/
// Rod/Tool/Adventuring Gear/Other) with category-specific fields (weapon:
// MULTIPLE damage+type pairs + property tags; armor: AC+category), a rarity
// picker, and the mechanical-effect system (labeled "Additional Mechanical
// Effects" per request). Edit-mode reloads via homebrewDraft.
import { useState, useEffect } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, TextInput, KeyboardAvoidingView, Platform, Image } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Item, Feature, Effect, AbilityEffect, DraftTrait, Entity, RulesetId } from '../../src/engine/types';
import { useHomebrewStore } from '../../src/store/homebrewStore';
import { usePendingSelectionStore } from '../../src/store/pendingSelectionStore';
import { GameRulesetPicker } from '../../src/components/homebrew/GameRulesetPicker';
import { gameIdForRuleset } from '../../src/content/rulesets';
import { useRequiredItemContextStore } from '../../src/store/requiredItemContextStore';
import { toItemIndexEntry } from '../../src/content/itemRepo.types';
import { itemMatchesConstraint } from '../../src/content/items/itemBrowse';
import { describeConstraint } from '../../src/content/items/equipmentDisplay';
import { Alert } from '../../src/utils/alert';
import { useSafeGoBack } from '../../src/hooks/useSafeGoBack';
import { SafeBottomView } from '../../src/components/SafeBottomView';
import { newDraftTrait, buildTraitFeature, TraitEditorModal, EFFECT_KIND_LABELS as TRAIT_KIND_LABELS } from '../../src/components/homebrew/TraitEditor';
import { mechanicsLabel } from '../../src/content/featureMechanics';
import { simulate } from '../../src/engine/simulate';
import { equipItem } from '../../src/engine/inventory';
import { buildEquipmentSummaryRows } from '../../src/components/sheet/EquipmentPreviewModal';
import { HomebrewTestModal, Row } from '../../src/components/homebrew/HomebrewTestModal';
import { useCharacterStore, makeEmptyEntity, DEFAULT_RULES } from '../../src/store/characterStore';
import { mergeHomebrewDefinition } from '../../src/engine/homebrewRoundTrip';
import { hydrateItemBuilder, serializeItemBuilder } from '../../src/engine/homebrewNestedSerializers';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../../src/theme';

function toId(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

type ItemCategory = 'weapon' | 'armor' | 'wondrous' | 'potion' | 'scroll' | 'ring' | 'wand' | 'staff' | 'rod' | 'tool' | 'gear' | 'other';
const CATEGORIES: { key: ItemCategory; label: string }[] = [
  { key: 'weapon', label: 'Weapon' }, { key: 'armor', label: 'Armor' },
  { key: 'wondrous', label: 'Wondrous Item' }, { key: 'potion', label: 'Potion' },
  { key: 'scroll', label: 'Scroll' }, { key: 'ring', label: 'Ring' },
  { key: 'wand', label: 'Wand' }, { key: 'staff', label: 'Staff' }, { key: 'rod', label: 'Rod' },
  { key: 'tool', label: 'Tool' }, { key: 'gear', label: 'Adventuring Gear' }, { key: 'other', label: 'Other' },
];
const RARITIES = ['common', 'uncommon', 'rare', 'very rare', 'legendary', 'artifact'];
const WEAPON_PROPERTY_TAGS = ['finesse', 'light', 'heavy', 'two-handed', 'versatile', 'thrown', 'reach', 'ammunition', 'loading', 'special'];
const ARMOR_CATEGORIES = ['light armor', 'medium armor', 'heavy armor', 'shield'];
const DAMAGE_TYPES = ['slashing','piercing','bludgeoning','fire','cold','lightning','acid','poison','necrotic','radiant','psychic','thunder','force'];

// Same map feat-builder.tsx uses for its "Edit Effect" card preview — kept
// as a local copy rather than a shared export since it's just UI-label
// sugar, not part of the compiler.
const EFFECT_KIND_LABELS: Record<string, string> = {
  none: 'Flavor only', ability_score: 'Ability score bonus', unarmored_defense: 'Unarmored Defense',
  ac_bonus: 'AC bonus', skill_proficiency: 'Skill proficiency', tool_proficiency: 'Tool proficiency',
  advantage_disadvantage: 'Advantage/Disadvantage', sense: 'Grants a sense', movement: 'Grants movement',
  movement_condition: 'Movement conditions', damage_resistance: 'Resistance', damage_immunity: 'Immunity',
  damage_vulnerability: 'Vulnerability',
};

type DamageEntry = { dice: string; damageType: string };

export default function ItemBuilderScreen() {
  const goBack   = useSafeGoBack('/(tabs)');
  const saveItem = useHomebrewStore(s => s.saveItem);
  const homebrewItemsList = useHomebrewStore(s => s.items);
  const { editId } = useLocalSearchParams<{ editId?: string }>();
  const editing = editId ? homebrewItemsList.find(i => i.id === editId) ?? null : null;
  const draftRulesetId = useCharacterStore(s => s.draft?.rulesetId);
  const [rulesetId, setRulesetId] = useState<RulesetId | undefined>(() => editing ? editing.rulesetId : draftRulesetId);

  const [name, setName]         = useState('');
  const [cost, setCost]         = useState('');
  const [weight, setWeight]     = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [testOpen, setTestOpen] = useState(false);
  const [testRows, setTestRows] = useState<Row[]>([]);

  const [category, setCategory] = useState<ItemCategory>('gear');
  const [rarity, setRarity]     = useState<string | null>(null);
  const [imageUri, setImageUri] = useState<string | undefined>(undefined);
  const [armorCategory, setArmorCategory] = useState('light armor');
  const [weaponProps, setWeaponProps] = useState<string[]>([]);
  const [extraProps, setExtraProps] = useState('');
  // STARTING-EQUIPMENT-2: explicit Weapon Class / Weapon Range controls —
  // feed the SAME independent-axis properties itemMatchesConstraint()
  // already reads (isMartialWeapon/isRangedWeapon's explicit override
  // path), rather than relying on the player discovering the
  // "type martial into Additional Properties" workaround. null = unset
  // (existing weapon-authoring behavior, unaffected — isMartialWeapon/
  // isRangedWeapon fall back to their existing name/tag heuristics).
  const [weaponClass, setWeaponClass] = useState<'simple' | 'martial' | null>(null);
  const [weaponRangeSel, setWeaponRangeSel] = useState<'melee' | 'ranged' | null>(null);

  // STARTING-EQUIPMENT-2: when reached from a constrained required
  // equipment picker (equipment.tsx's "+ Create New Homebrew Item" inside
  // a filtered picker), this carries the constraint/remaining-count
  // context across the trip. Read via the reactive hook (not a one-shot
  // peek) since nothing else mutates it while this screen is open — see
  // requiredItemContextStore.ts's own header comment for the full
  // round-trip design. Not consumed here: equipment.tsx consumes it once
  // it has fully handled the return trip (resolved, reopened, or
  // cancelled), so Back/Cancel from this screen (which never calls
  // setResult) correctly reopens the exact same in-progress picker.
  const requiredContext = useRequiredItemContextStore(s => s.context);

  // Weapon damage: a real list now, not a single dice+type pair — a weapon
  // that deals e.g. both slashing AND necrotic damage (like the hand-authored
  // +1 Life-Drinking Greatsword already in the core catalog) needs more than
  // one entry. Maps directly onto AbilityEffect[], which already supported
  // this — the old UI just never exposed more than one.
  const [weaponDamage, setWeaponDamage] = useState<DamageEntry[]>([{ dice: '1d8', damageType: 'slashing' }]);

  const [acValue, setAcValue]   = useState('');
  const [acAddsDex, setAcAddsDex] = useState(false);

  // Any additional mechanical effect (stat bonus, sense, resistance, etc.) —
  // the same DraftTrait/TraitEditorModal system feat-builder.tsx uses, giving
  // homebrew items the same effect-kind range as feats instead of the old
  // 3-kind bespoke picker. Armor's AC formula stays a separate, always-on
  // field on the armor category itself (below), since it isn't one of
  // TraitEditor's kinds and every armor item needs it, not just some.
  const [trait, setTrait]     = useState<DraftTrait>(() => newDraftTrait('Effect'));
  const [traitOpen, setTraitOpen] = useState(false);
  const [mechanicsTouched, setMechanicsTouched] = useState(false);

  useEffect(() => {
    if (!editing) return;
    setName(editing.name);
    setRulesetId(editing.rulesetId);
    setCost(editing.cost === '-' ? '' : editing.cost);
    setWeight(editing.weight ? String(editing.weight) : '');
    setImageUri(editing.imageUri);
    const draft = hydrateItemBuilder(editing).draft as Record<string, unknown> | null;
    if (draft) {
      setDescription(String(draft.description ?? ''));
      setCategory((draft.category as ItemCategory) ?? 'gear');
      setRarity((draft.rarity as string) ?? null);
      setArmorCategory(String(draft.armorCategory ?? 'light armor'));
      setWeaponProps((draft.weaponProps as string[]) ?? []);
      setExtraProps(String(draft.extraProps ?? ''));
      setWeaponClass((draft.weaponClass as 'simple' | 'martial') ?? null);
      setWeaponRangeSel((draft.weaponRangeSel as 'melee' | 'ranged') ?? null);
      setWeaponDamage(
        (draft.weaponDamage as DamageEntry[])
        ?? (draft.dmgDice ? [{ dice: String(draft.dmgDice), damageType: String(draft.dmgType ?? 'slashing') }] : [{ dice: '1d8', damageType: 'slashing' }])
      );
      setAcValue(String(draft.acValue ?? ''));
      setAcAddsDex(!!draft.acAddsDex);
      // The compiled Feature can't be losslessly reversed back into a
      // DraftTrait (effects are already-compiled Effect objects) — edit mode
      // falls back to "Flavor only" with a generic description, same
      // accepted limitation feat-builder.tsx's edit-mode recovery has,
      // unless a DraftTrait was itself persisted (any item saved after this
      // migration).
      const legacySummary = mechanicsLabel(editing.features);
      setTrait((draft.trait as DraftTrait) ?? { ...newDraftTrait('Effect'), ...(legacySummary !== 'Flavor only' ? { mechanicsSummary: legacySummary } : {}) });
    } else {
      setDescription(editing.features[0]?.description ?? '');
    }
  }, [editing?.id]);

  // STARTING-EQUIPMENT-2: prefill category/weaponClass/weaponRange/
  // armorCategory from the constraint when launched from a constrained
  // required picker — helps the player create a valid item on the first
  // try. Skipped in edit mode (editing an existing item should never be
  // silently reshaped by an unrelated in-flight equipment choice) and only
  // runs once on mount (an empty dep array — the constraint doesn't change
  // while this screen is open).
  useEffect(() => {
    if (!requiredContext || editing) return;
    const c = requiredContext.constraint;
    if (c.category === 'weapon') {
      setCategory('weapon');
      if (c.weaponClass) setWeaponClass(c.weaponClass);
      if (c.weaponRange) setWeaponRangeSel(c.weaponRange);
    } else if (c.category === 'armor') {
      setCategory('armor');
      if (c.armorWeight) setArmorCategory(`${c.armorWeight} armor`);
    } else if (c.category === 'shield') {
      setCategory('armor');
      setArmorCategory('shield');
    } else if (c.category === 'tool') {
      setCategory('tool');
    } else if (c.category === 'gear' || c.category === 'ammunition' || c.category === 'focus') {
      setCategory('gear');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggleWeaponProp(p: string) {
    setMechanicsTouched(true);
    setWeaponProps(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]);
  }
  function addDamageEntry() {
    setMechanicsTouched(true);
    setWeaponDamage(prev => [...prev, { dice: '1d6', damageType: 'slashing' }]);
  }
  function updateDamageEntry(i: number, patch: Partial<DamageEntry>) {
    setMechanicsTouched(true);
    setWeaponDamage(prev => prev.map((d, idx) => idx === i ? { ...d, ...patch } : d));
  }
  function removeDamageEntry(i: number) {
    setMechanicsTouched(true);
    setWeaponDamage(prev => prev.length > 1 ? prev.filter((_, idx) => idx !== i) : prev);
  }

  // Stored as a base64 data: URI (see Item.imageUri) so it round-trips
  // through the same JSON blob SQLite already stores the whole Item in —
  // no separate file/asset storage to manage or that a backup/restore
  // could leave dangling.
  async function pickImage() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Grimoire needs photo library access to attach a reference image.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.6,
      base64: true,
      allowsEditing: true,
      aspect: [1, 1],
    });
    if (result.canceled || !result.assets[0]?.base64) return;
    const asset = result.assets[0];
    const mime = asset.mimeType ?? 'image/jpeg';
    setImageUri(`data:${mime};base64,${asset.base64}`);
  }

  function buildFeature(id: string): Feature | null {
    const base: Feature = {
      id: id + '_feat',
      name: name.trim() || 'Item',
      description: description.trim() || name.trim(),
      source: { kind: 'item', refId: id },
      level: null,
      effects: [],
      actions: [],
      choices: [],
      passive: true,
    };

    // Weapon damage and armor AC are handled separately from the trait
    // system below, since an item can ALSO have another effect layered on
    // top (e.g. a magic sword with both damage dice and a stat bonus, or
    // armor that also grants a sense) — matches how the hand-authored core
    // items already combine multiple effects/abilityEffects.
    const weaponEffects: AbilityEffect[] = category === 'weapon'
      ? weaponDamage
          .filter(d => d.dice.trim())
          .map(d => ({ type: 'damage' as const, dice: d.dice.trim(), damageType: d.damageType }))
      : [];

    const effects: Effect[] = [];
    if (category === 'armor') {
      const base10 = parseInt(acValue, 10);
      if (!isNaN(base10)) {
        effects.push({
          type: 'base_ac_formula', target: 'ac', operation: 'set',
          value: base10, condition: null,
          formulaAbilities: acAddsDex ? ['dex'] : [],
          // Medium armor caps its Dex bonus at +2 (PHB) — matches the
          // official catalog's own medium-armor entries (e.g. Hide,
          // src/content/items/index.ts), which all set this same cap.
          ...(acAddsDex && armorCategory === 'medium armor' ? { formulaAbilityCap: { dex: 2 } } : {}),
        });
      }
    }

    const { feature: traitFeature } = buildTraitFeature(trait, { idPrefix: id, sourceKind: 'item', sourceRefId: id, level: null });
    effects.push(...traitFeature.effects);

    if (weaponEffects.length > 0) {
      return {
        ...base, effects,
        abilityEffects: weaponEffects,
        activation: { actionType: 'action', resourceCost: null, range: '5 feet', target: 'single', requiresSave: null },
      };
    }
    return { ...base, effects };
  }

  function buildProperties(): string[] {
    const props: string[] = [];
    if (category === 'weapon') {
      props.push(...weaponProps);
      if (weaponClass) props.push(weaponClass);
      if (weaponRangeSel) props.push(weaponRangeSel);
    }
    if (category === 'armor') props.push(armorCategory);
    if (category === 'wondrous') props.push('wondrous item', 'magic item');
    if (category === 'potion') props.push('potion');
    if (category === 'scroll') props.push('scroll');
    if (category === 'ring') props.push('ring', 'magic item');
    if (category === 'wand') props.push('wand', 'magic item');
    if (category === 'staff') props.push('staff', 'magic item');
    if (category === 'rod') props.push('rod', 'magic item');
    if (category === 'tool') props.push('tool');
    if (rarity) props.push(rarity, 'magic item');
    if (extraProps.trim()) {
      props.push(...extraProps.split(',').map(p => p.trim().toLowerCase()).filter(Boolean));
    }
    return Array.from(new Set(props));
  }

  function buildItem(id: string): Item {
    const feature = buildFeature(id)!;
    const originalDraft = editing ? hydrateItemBuilder(editing).draft : null;
    const draft = { description, category, rarity, armorCategory, weaponProps, extraProps, weaponDamage, weaponClass, weaponRangeSel, acValue, acAddsDex, trait };
    const mechanicsChanged = !editing || mechanicsTouched || (originalDraft !== null && JSON.stringify(draft) !== JSON.stringify({ ...originalDraft, editorFeatureId: undefined }));
    const built = mergeHomebrewDefinition(editing, { id, name: name.trim(), weight: parseFloat(weight) || 0, cost: cost.trim() || '-',
      properties: buildProperties(), features: [feature], imageUri, rulesetId, homebrewDraft: draft });
    return serializeItemBuilder(editing, built, draft, mechanicsChanged);
  }

  // Read-only test: equip the draft item onto a disposable level-1 scratch
  // entity and show the same before/after summary the real in-play equip
  // preview shows (EquipmentPreviewModal.tsx) — AC, other derived-stat
  // changes, new/removed weapon attacks, resistance/immunity gained. No
  // save, no real character touched anywhere. The scratch entity needs the
  // draft item pre-loaded into `inventory.carried` since equipItem() (like
  // the real equip flow) only moves an item that's already there.
  function runTest() {
    const id = editing?.id ?? (toId(name) || 'test_item');
    const item = buildItem(id);
    const empty = makeEmptyEntity('homebrew-test');
    const scratch: Entity = {
      ...empty,
      identity: { ...empty.identity, level: 1 },
      inventory: {
        ...empty.inventory,
        carried: [{ itemId: item.id, quantity: 1, attuned: false, features: [] }],
      },
    };
    const { before, after } = simulate(scratch, e => equipItem(e, item.id, item, DEFAULT_RULES), DEFAULT_RULES);
    const rows = buildEquipmentSummaryRows(before, after);
    // Weapon to-hit/damage bonuses are computed by computeWeaponAttackBonuses()
    // (src/engine/pipeline.ts), which resolves the item's definition from
    // itemRepo/homebrewStore by id to read its damage-die feature and
    // properties (finesse/ranged/magic-bonus text) — an unsaved draft item
    // isn't in either catalog, so that lookup finds nothing and the "New
    // attack" row this weapon would otherwise get never appears. AC/
    // resistance/other trait-effect rows are unaffected (they read the
    // already-hydrated feature directly, no catalog lookup needed). Same
    // disclosed-gap pattern feat-builder.tsx uses for ability/skill choices
    // — surface it rather than silently under-report.
    if (category === 'weapon' && weaponDamage.some(d => d.dice.trim())) {
      rows.push({ label: "This weapon's to-hit/damage bonus isn't shown here — save the item first, then check its Attacks entry on a character sheet." });
    }
    setTestRows(rows);
    setTestOpen(true);
  }

  async function handleSave() {
    if (!name.trim() || saving) return;
    setSaving(true);
    const id = editing?.id ?? ('hb_' + (toId(name) || 'item') + '_' + Date.now().toString(36));
    const item = buildItem(id);

    try {
      await saveItem('item', item);
      if (requiredContext) {
        // STARTING-EQUIPMENT-2: ALWAYS save, regardless of eligibility —
        // an item invalid for THIS required choice may still be a
        // perfectly valid homebrew item globally. Evaluate through the
        // exact same authoritative itemMatchesConstraint() every other
        // item-picking surface uses; never a bespoke eligibility check
        // here.
        const entry = toItemIndexEntry(item);
        const eligible = itemMatchesConstraint(entry, requiredContext.constraint);
        useRequiredItemContextStore.getState().setResult(
          eligible
            ? { kind: 'eligible', itemId: item.id, requiredChoiceId: requiredContext.requiredChoiceId }
            : { kind: 'ineligible', itemId: item.id, requiredChoiceId: requiredContext.requiredChoiceId, reason: describeConstraint(requiredContext.constraint) }
        );
      } else {
        // SAVE-AND-ADD-1: lets the "+ Add Additional Item" flow (character
        // creation's Starting Equipment screen), if that's what sent us
        // here, add this item automatically on return instead of making
        // the player find it again. No-op for every other caller (nothing
        // consumes this key elsewhere).
        usePendingSelectionStore.getState().setPending('equipment_additional_item', item.id);
      }
      goBack();
    } catch (e) {
      console.error('[item-builder] save failed:', e);
      Alert.alert('Save failed', e instanceof Error ? e.message : 'Something went wrong. Check the console for details.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={goBack}>
          <Text style={styles.backTxt}>{'<- Back'}</Text>
        </Pressable>
        <Text style={styles.title}>{editing ? 'Edit Item' : 'New Item'}</Text>
      </View>

      {requiredContext && (
        <View style={styles.constraintBanner}>
          <Text style={styles.constraintBannerTxt}>
            Creating an item for: {describeConstraint(requiredContext.constraint)}
            {'  ·  '}Remaining: {requiredContext.quantity - requiredContext.alreadySelectedItemIds.length}
          </Text>
        </View>
      )}

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.fieldLabel}>Item Name *</Text>
        <TextInput style={styles.input} value={name} onChangeText={setName}
          placeholder="e.g. Cloak of the Deep" placeholderTextColor={Colors.textDim} />

        <Text style={styles.fieldLabel}>Game / Ruleset</Text>
        <GameRulesetPicker value={rulesetId} onChange={setRulesetId} defaultGameId={gameIdForRuleset(draftRulesetId)} />

        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={styles.fieldLabel}>Cost</Text>
            <TextInput style={styles.input} value={cost} onChangeText={setCost}
              placeholder="e.g. 500 gp" placeholderTextColor={Colors.textDim} />
          </View>
          <View style={{ width: 110 }}>
            <Text style={styles.fieldLabel}>Weight (lb)</Text>
            <TextInput style={styles.input} value={weight} onChangeText={setWeight}
              placeholder="0" placeholderTextColor={Colors.textDim} keyboardType="numeric" />
          </View>
        </View>

        <Text style={styles.fieldLabel}>Description</Text>
        <TextInput style={[styles.input, styles.textArea]} value={description} onChangeText={value => { setMechanicsTouched(true); setDescription(value); }}
          placeholder="What does this item do?" placeholderTextColor={Colors.textDim}
          multiline textAlignVertical="top" />

        <Text style={styles.fieldLabel}>Photo (optional)</Text>
        {imageUri ? (
          <View style={styles.photoRow}>
            <Image source={{ uri: imageUri }} style={styles.photoPreview} />
            <Pressable style={styles.photoRemoveBtn} onPress={() => setImageUri(undefined)}>
              <Text style={styles.photoRemoveTxt}>Remove Photo</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable style={styles.photoAddBtn} onPress={() => { pickImage().catch(() => {}); }}>
            <Text style={styles.photoAddTxt}>📷 Add Photo</Text>
          </Pressable>
        )}

        <Text style={styles.fieldLabel}>Category</Text>
        <View style={styles.chipWrap}>
          {CATEGORIES.map(c => (
            <Pressable key={c.key} style={[styles.chip, category === c.key && styles.chipActive]} onPress={() => { setMechanicsTouched(true); setCategory(c.key); }}>
              <Text style={[styles.chipTxt, category === c.key && styles.chipTxtActive]}>{c.label}</Text>
            </Pressable>
          ))}
        </View>

        {category === 'weapon' && (
          <View style={styles.effectPanel}>
            <Text style={styles.fieldLabel}>Weapon Properties</Text>
            <View style={styles.chipWrap}>
              {WEAPON_PROPERTY_TAGS.map(p => (
                <Pressable key={p} style={[styles.chip, weaponProps.includes(p) && styles.chipActive]} onPress={() => toggleWeaponProp(p)}>
                  <Text style={[styles.chipTxt, weaponProps.includes(p) && styles.chipTxtActive]}>{p}</Text>
                </Pressable>
              ))}
            </View>

            <Text style={[styles.fieldLabel, { marginTop: Spacing.sm }]}>Weapon Class</Text>
            <Text style={styles.hint}>Used to match "Choose a Martial/Simple Weapon"-style equipment requirements. Leave unset for a weapon that doesn't need to satisfy one of those.</Text>
            <View style={styles.chipWrap}>
              <Pressable style={[styles.chip, weaponClass === null && styles.chipActive]} onPress={() => { setMechanicsTouched(true); setWeaponClass(null); }}>
                <Text style={[styles.chipTxt, weaponClass === null && styles.chipTxtActive]}>Unset</Text>
              </Pressable>
              <Pressable style={[styles.chip, weaponClass === 'simple' && styles.chipActive]} onPress={() => { setMechanicsTouched(true); setWeaponClass('simple'); }}>
                <Text style={[styles.chipTxt, weaponClass === 'simple' && styles.chipTxtActive]}>Simple</Text>
              </Pressable>
              <Pressable style={[styles.chip, weaponClass === 'martial' && styles.chipActive]} onPress={() => { setMechanicsTouched(true); setWeaponClass('martial'); }}>
                <Text style={[styles.chipTxt, weaponClass === 'martial' && styles.chipTxtActive]}>Martial</Text>
              </Pressable>
            </View>

            <Text style={[styles.fieldLabel, { marginTop: Spacing.sm }]}>Weapon Range</Text>
            <View style={styles.chipWrap}>
              <Pressable style={[styles.chip, weaponRangeSel === null && styles.chipActive]} onPress={() => { setMechanicsTouched(true); setWeaponRangeSel(null); }}>
                <Text style={[styles.chipTxt, weaponRangeSel === null && styles.chipTxtActive]}>Unset</Text>
              </Pressable>
              <Pressable style={[styles.chip, weaponRangeSel === 'melee' && styles.chipActive]} onPress={() => { setMechanicsTouched(true); setWeaponRangeSel('melee'); }}>
                <Text style={[styles.chipTxt, weaponRangeSel === 'melee' && styles.chipTxtActive]}>Melee</Text>
              </Pressable>
              <Pressable style={[styles.chip, weaponRangeSel === 'ranged' && styles.chipActive]} onPress={() => { setMechanicsTouched(true); setWeaponRangeSel('ranged'); }}>
                <Text style={[styles.chipTxt, weaponRangeSel === 'ranged' && styles.chipTxtActive]}>Ranged</Text>
              </Pressable>
            </View>

            <Text style={[styles.fieldLabel, { marginTop: Spacing.sm }]}>Damage</Text>
            <Text style={styles.hint}>Most weapons have one damage entry; add more for weapons that deal multiple damage types (e.g. a flaming sword: slashing + fire).</Text>
            {weaponDamage.map((d, i) => (
              <View key={i} style={styles.damageRow}>
                <TextInput style={[styles.input, { flex: 1 }]} value={d.dice}
                  onChangeText={v => updateDamageEntry(i, { dice: v })}
                  placeholder="e.g. 1d8" placeholderTextColor={Colors.textDim} />
                <View style={{ flex: 2 }}>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: Spacing.xs }}>
                    {DAMAGE_TYPES.map(t => (
                      <Pressable key={t} style={[styles.chip, d.damageType === t && styles.chipActive]} onPress={() => updateDamageEntry(i, { damageType: t })}>
                        <Text style={[styles.chipTxt, d.damageType === t && styles.chipTxtActive]}>{t}</Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                </View>
                {weaponDamage.length > 1 && (
                  <Pressable onPress={() => removeDamageEntry(i)} hitSlop={8} style={styles.removeDamageBtn}>
                    <Text style={styles.removeDamageTxt}>X</Text>
                  </Pressable>
                )}
              </View>
            ))}
            <Pressable style={styles.addDamageBtn} onPress={addDamageEntry}>
              <Text style={styles.addDamageTxt}>+ Add another damage type</Text>
            </Pressable>
          </View>
        )}
        {category === 'armor' && (
          <View style={styles.effectPanel}>
            <Text style={styles.fieldLabel}>Armor Category</Text>
            <View style={styles.chipWrap}>
              {ARMOR_CATEGORIES.map(a => (
                <Pressable key={a} style={[styles.chip, armorCategory === a && styles.chipActive]} onPress={() => { setMechanicsTouched(true); setArmorCategory(a); }}>
                  <Text style={[styles.chipTxt, armorCategory === a && styles.chipTxtActive]}>{a}</Text>
                </Pressable>
              ))}
            </View>
            <Text style={[styles.fieldLabel, { marginTop: Spacing.sm }]}>Base AC</Text>
            <TextInput style={styles.input} value={acValue} onChangeText={value => { setMechanicsTouched(true); setAcValue(value); }}
              placeholder="e.g. 14" placeholderTextColor={Colors.textDim} keyboardType="numeric" />
            <Pressable style={[styles.toggle, acAddsDex && styles.toggleActive]} onPress={() => { setMechanicsTouched(true); setAcAddsDex(v => !v); }}>
              <Text style={[styles.toggleTxt, acAddsDex && styles.toggleTxtActive]}>
                {acAddsDex ? 'Adds DEX modifier (light/medium)' : 'Flat AC (heavy)'}
              </Text>
            </Pressable>
            {acAddsDex && armorCategory === 'medium armor' && (
              <Text style={styles.hint}>Dex bonus capped at +2, per medium armor's rule.</Text>
            )}
            <Text style={styles.hint}>Changes AC on the combat sheet while equipped.</Text>
          </View>
        )}

        {category !== 'gear' && category !== 'tool' && (
          <>
            <Text style={styles.fieldLabel}>Rarity</Text>
            <Text style={styles.hint}>Leave on "None" for mundane gear that just happens to be in this category.</Text>
            <View style={styles.chipWrap}>
              <Pressable style={[styles.chip, rarity === null && styles.chipActive]} onPress={() => { setMechanicsTouched(true); setRarity(null); }}>
                <Text style={[styles.chipTxt, rarity === null && styles.chipTxtActive]}>None</Text>
              </Pressable>
              {RARITIES.map(r => (
                <Pressable key={r} style={[styles.chip, rarity === r && styles.chipActive]} onPress={() => { setMechanicsTouched(true); setRarity(r); }}>
                  <Text style={[styles.chipTxt, rarity === r && styles.chipTxtActive]}>{r}</Text>
                </Pressable>
              ))}
            </View>
          </>
        )}

        <Text style={styles.fieldLabel}>Additional Properties (optional, comma-separated)</Text>
        <TextInput style={styles.input} value={extraProps} onChangeText={value => { setMechanicsTouched(true); setExtraProps(value); }}
          placeholder="Anything not covered above" placeholderTextColor={Colors.textDim} />

        <Text style={styles.fieldLabel}>Additional Mechanical Effect (optional)</Text>
        <Text style={styles.hint}>Layers on top of weapon damage / armor AC above — same effect system feats use (stat bonus, sense, resistance, proficiency, etc.). Granted while the item is equipped.</Text>
        <Pressable style={styles.effectCard} onPress={() => setTraitOpen(true)}>
          <Text style={styles.effectCardName}>Edit Effect</Text>
          <Text style={styles.effectCardDesc}>{trait.effectKind === 'none' && trait.mechanicsSummary ? trait.mechanicsSummary : (EFFECT_KIND_LABELS[trait.effectKind] ?? TRAIT_KIND_LABELS[trait.effectKind])}</Text>
        </Pressable>
      </ScrollView>

      <SafeBottomView>
        <View style={styles.footer}>
          <Pressable style={[styles.testBtn, !name.trim() && styles.btnDisabled]} onPress={runTest} disabled={!name.trim()}>
            <Text style={styles.testBtnTxt}>🧪 Test</Text>
          </Pressable>
          <Pressable style={[styles.saveBtn, (!name.trim() || saving) && styles.btnDisabled]} onPress={() => { void handleSave(); }} disabled={!name.trim() || saving}>
            <Text style={styles.saveBtnTxt}>{saving ? 'Saving...' : requiredContext ? 'Save & Select' : 'Save Item'}</Text>
          </Pressable>
        </View>
      </SafeBottomView>

      <TraitEditorModal
        trait={traitOpen ? trait : null}
        visible={traitOpen}
        onChange={value => { setMechanicsTouched(true); setTrait(value); }}
        onDone={() => setTraitOpen(false)}
        onDelete={() => { setMechanicsTouched(true); setTrait(newDraftTrait('Effect')); setTraitOpen(false); }}
        excludeKinds={['resource_ability', 'spell_grant']}
      />

      <HomebrewTestModal
        visible={testOpen}
        title={`Testing: ${name.trim() || 'New Item'}`}
        rows={testRows}
        onClose={() => setTestOpen(false)}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen:  { flex: 1, backgroundColor: Colors.bg },
  header:  { backgroundColor: Colors.surfaceHigh, paddingTop: Spacing.xl+8, paddingBottom: Spacing.md, paddingHorizontal: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.border },
  backBtn: { marginBottom: 4 },
  backTxt: { color: Colors.gold, fontSize: FontSize.md, fontWeight: FontWeight.bold },
  title:   { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  constraintBanner: {
    backgroundColor: Colors.gold + '18', borderBottomWidth: 1, borderBottomColor: Colors.gold + '66',
    paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md,
  },
  constraintBannerTxt: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.gold },
  scroll:  { flex: 1 },
  content: { padding: Spacing.md, gap: Spacing.sm, paddingBottom: Spacing.xxl },
  fieldLabel: { fontSize: FontSize.xs, color: Colors.textSecondary, letterSpacing: 1, fontWeight: FontWeight.bold, marginTop: Spacing.xs },
  input:   { backgroundColor: Colors.surface, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, padding: Spacing.sm, color: Colors.textPrimary, fontSize: FontSize.md },
  textArea:{ minHeight: 90 },
  photoRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  photoPreview: { width: 72, height: 72, borderRadius: Radius.md, backgroundColor: Colors.surfaceHigh },
  photoRemoveBtn: { paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs },
  photoRemoveTxt: { color: Colors.red, fontSize: FontSize.sm, fontWeight: FontWeight.bold },
  photoAddBtn: {
    backgroundColor: Colors.surface, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border,
    borderStyle: 'dashed', padding: Spacing.md, alignItems: 'center',
  },
  photoAddTxt: { color: Colors.textSecondary, fontSize: FontSize.sm, fontWeight: FontWeight.bold },
  hint:    { fontSize: FontSize.xs, color: Colors.textDim, lineHeight: 16, fontStyle: 'italic' },
  row:     { flexDirection: 'row', gap: Spacing.sm },
  effectPanel: { backgroundColor: Colors.surface, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border, padding: Spacing.md, gap: Spacing.xs, marginTop: Spacing.xs },
  chip:      { backgroundColor: Colors.surfaceHigh, borderRadius: Radius.sm, paddingHorizontal: Spacing.sm, paddingVertical: 4, borderWidth: 1, borderColor: Colors.border },
  chipActive:{ borderColor: Colors.gold, backgroundColor: Colors.gold + '22' },
  chipTxt:   { fontSize: FontSize.xs, color: Colors.textSecondary },
  chipTxtActive: { color: Colors.gold, fontWeight: FontWeight.bold },
  chipWrap:  { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  toggle:  { backgroundColor: Colors.surfaceHigh, borderRadius: Radius.md, padding: Spacing.sm, alignItems: 'center', borderWidth: 1, borderColor: Colors.border, marginTop: Spacing.xs },
  toggleActive: { borderColor: Colors.gold, backgroundColor: Colors.gold + '22' },
  toggleTxt:    { color: Colors.textSecondary, fontSize: FontSize.sm },
  toggleTxtActive: { color: Colors.gold, fontWeight: FontWeight.bold },
  effectCard: {
    backgroundColor: Colors.surface, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, padding: Spacing.md,
  },
  effectCardName: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  effectCardDesc: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 2 },
  btnDisabled: { opacity: 0.4 },
  footer:    { flexDirection: 'row', gap: Spacing.sm, padding: Spacing.sm, backgroundColor: Colors.surfaceHigh, borderTopWidth: 1, borderTopColor: Colors.border },
  testBtn:   { flex: 1, backgroundColor: Colors.surface, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, padding: Spacing.md, alignItems: 'center' },
  testBtnTxt:{ color: Colors.textSecondary, fontWeight: FontWeight.bold, fontSize: FontSize.md },
  saveBtn:   { flex: 1, backgroundColor: Colors.gold, borderRadius: Radius.md, padding: Spacing.md, alignItems: 'center' },
  saveBtnTxt:{ color: Colors.bg, fontWeight: FontWeight.bold, fontSize: FontSize.md },
  damageRow: { flexDirection: 'row', gap: Spacing.xs, alignItems: 'center', marginBottom: Spacing.xs },
  removeDamageBtn: { padding: Spacing.xs },
  removeDamageTxt: { color: Colors.red, fontSize: FontSize.md, fontWeight: FontWeight.bold },
  addDamageBtn: { alignSelf: 'flex-start', marginTop: 2 },
  addDamageTxt: { color: Colors.gold, fontSize: FontSize.xs, fontWeight: FontWeight.bold },
});
