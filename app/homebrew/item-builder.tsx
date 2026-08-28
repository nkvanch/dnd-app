// app/homebrew/item-builder.tsx
// Homebrew item builder — name/cost/weight/description stay as-is. Real
// category picker (Weapon/Armor/Wondrous Item/Potion/Scroll/Ring/Wand/Staff/
// Rod/Tool/Adventuring Gear/Other) with category-specific fields (weapon:
// MULTIPLE damage+type pairs + property tags; armor: AC+category), a rarity
// picker, and the mechanical-effect system (labeled "Additional Mechanical
// Effects" per request). Edit-mode reloads via homebrewDraft.
import { useState, useEffect } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Item, Feature, Effect, AbilityEffect, SenseType, Ability } from '../../src/engine/types';
import { useHomebrewStore } from '../../src/store/homebrewStore';
import { Alert } from '../../src/utils/alert';
import { useSafeGoBack } from '../../src/hooks/useSafeGoBack';
import { SafeBottomView } from '../../src/components/SafeBottomView';
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

type ItemEffectKind = 'none' | 'armor_ac' | 'stat_bonus' | 'grant_sense' | 'grant_movement';
type MoveType = 'fly' | 'swim' | 'climb' | 'burrow';
const MOVE_TYPES: { key: MoveType; label: string }[] = [
  { key: 'fly', label: 'Fly' }, { key: 'swim', label: 'Swim' },
  { key: 'climb', label: 'Climb' }, { key: 'burrow', label: 'Burrow' },
];
const ABILITIES: { key: Ability; label: string }[] = [
  { key: 'str', label: 'STR' }, { key: 'dex', label: 'DEX' }, { key: 'con', label: 'CON' },
  { key: 'int', label: 'INT' }, { key: 'wis', label: 'WIS' }, { key: 'cha', label: 'CHA' },
];
const SENSE_TYPES: { key: SenseType; label: string }[] = [
  { key: 'darkvision', label: 'Darkvision' }, { key: 'blindsight', label: 'Blindsight' },
  { key: 'tremorsense', label: 'Tremorsense' }, { key: 'truesight', label: 'Truesight' },
];

type DamageEntry = { dice: string; damageType: string };

export default function ItemBuilderScreen() {
  const goBack   = useSafeGoBack('/(tabs)');
  const saveItem = useHomebrewStore(s => s.saveItem);
  const homebrewItemsList = useHomebrewStore(s => s.items);
  const { editId } = useLocalSearchParams<{ editId?: string }>();
  const editing = editId ? homebrewItemsList.find(i => i.id === editId) ?? null : null;

  const [name, setName]         = useState('');
  const [cost, setCost]         = useState('');
  const [weight, setWeight]     = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  const [category, setCategory] = useState<ItemCategory>('gear');
  const [rarity, setRarity]     = useState<string | null>(null);
  const [armorCategory, setArmorCategory] = useState('light armor');
  const [weaponProps, setWeaponProps] = useState<string[]>([]);
  const [extraProps, setExtraProps] = useState('');

  // Weapon damage: a real list now, not a single dice+type pair — a weapon
  // that deals e.g. both slashing AND necrotic damage (like the hand-authored
  // +1 Life-Drinking Greatsword already in the core catalog) needs more than
  // one entry. Maps directly onto AbilityEffect[], which already supported
  // this — the old UI just never exposed more than one.
  const [weaponDamage, setWeaponDamage] = useState<DamageEntry[]>([{ dice: '1d8', damageType: 'slashing' }]);

  const [effectKind, setEffectKind] = useState<ItemEffectKind>('none');
  const [acValue, setAcValue]   = useState('');
  const [acAddsDex, setAcAddsDex] = useState(false);
  const [statAbility, setStatAbility] = useState<Ability>('str');
  const [statAmount, setStatAmount]   = useState('1');
  const [senseType, setSenseType] = useState<SenseType>('darkvision');
  const [senseRange, setSenseRange] = useState('60');
  const [senseNote, setSenseNote]   = useState('');
  const [moveType, setMoveType] = useState<MoveType>('fly');
  const [moveRange, setMoveRange] = useState('30');

  useEffect(() => {
    if (!editing) return;
    setName(editing.name);
    setCost(editing.cost === '-' ? '' : editing.cost);
    setWeight(editing.weight ? String(editing.weight) : '');
    const draft = editing.homebrewDraft as Record<string, unknown> | undefined;
    if (draft) {
      setDescription(String(draft.description ?? ''));
      setCategory((draft.category as ItemCategory) ?? 'gear');
      setRarity((draft.rarity as string) ?? null);
      setArmorCategory(String(draft.armorCategory ?? 'light armor'));
      setWeaponProps((draft.weaponProps as string[]) ?? []);
      setExtraProps(String(draft.extraProps ?? ''));
      setWeaponDamage(
        (draft.weaponDamage as DamageEntry[])
        ?? (draft.dmgDice ? [{ dice: String(draft.dmgDice), damageType: String(draft.dmgType ?? 'slashing') }] : [{ dice: '1d8', damageType: 'slashing' }])
      );
      setEffectKind((draft.effectKind as ItemEffectKind) ?? 'none');
      setAcValue(String(draft.acValue ?? ''));
      setAcAddsDex(!!draft.acAddsDex);
      setStatAbility((draft.statAbility as Ability) ?? 'str');
      setStatAmount(String(draft.statAmount ?? '1'));
      setSenseType((draft.senseType as SenseType) ?? 'darkvision');
      setSenseRange(String(draft.senseRange ?? '60'));
      setSenseNote(String(draft.senseNote ?? ''));
      setMoveType((draft.moveType as MoveType) ?? 'fly');
      setMoveRange(String(draft.moveRange ?? '30'));
    } else {
      setDescription(editing.features[0]?.description ?? '');
    }
  }, [editing?.id]);

  function toggleWeaponProp(p: string) {
    setWeaponProps(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]);
  }
  function addDamageEntry() {
    setWeaponDamage(prev => [...prev, { dice: '1d6', damageType: 'slashing' }]);
  }
  function updateDamageEntry(i: number, patch: Partial<DamageEntry>) {
    setWeaponDamage(prev => prev.map((d, idx) => idx === i ? { ...d, ...patch } : d));
  }
  function removeDamageEntry(i: number) {
    setWeaponDamage(prev => prev.length > 1 ? prev.filter((_, idx) => idx !== i) : prev);
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

    // Weapon damage is handled separately from the effectKind switch below,
    // since a weapon can ALSO have another effect layered on (e.g. a magic
    // sword with both damage dice and a stat bonus) — matches how the
    // hand-authored core items already combine multiple abilityEffects.
    const weaponEffects: AbilityEffect[] = category === 'weapon'
      ? weaponDamage
          .filter(d => d.dice.trim())
          .map(d => ({ type: 'damage' as const, dice: d.dice.trim(), damageType: d.damageType }))
      : [];

    let extra: Partial<Feature> = {};
    switch (effectKind) {
      case 'armor_ac': {
        const base10 = parseInt(acValue, 10);
        if (!isNaN(base10)) {
          const effect: Effect = {
            type: 'base_ac_formula', target: 'ac', operation: 'set',
            value: base10, condition: null,
            formulaAbilities: acAddsDex ? ['dex'] : [],
            // Medium armor caps its Dex bonus at +2 (PHB) — matches the
            // official catalog's own medium-armor entries (e.g. Hide,
            // src/content/items/index.ts), which all set this same cap.
            ...(acAddsDex && armorCategory === 'medium armor' ? { formulaAbilityCap: { dex: 2 } } : {}),
          };
          extra = { effects: [effect] };
        }
        break;
      }
      case 'stat_bonus': {
        const amt = parseInt(statAmount, 10);
        if (!isNaN(amt)) {
          extra = { effects: [{ type: 'stat_modifier', target: statAbility, operation: 'add', value: amt, condition: null }] };
        }
        break;
      }
      case 'grant_sense': {
        const r = parseInt(senseRange, 10);
        if (!isNaN(r) && r > 0) {
          extra = { effects: [{
            type: 'grant_sense', target: 'senses', operation: 'add', value: null, condition: null,
            senseType, senseRange: r, senseNote: senseNote.trim() || undefined,
          }] };
        }
        break;
      }
      case 'grant_movement': {
        const r = parseInt(moveRange, 10);
        if (!isNaN(r) && r > 0) {
          extra = { effects: [{
            type: 'grant_movement', target: 'movement', operation: 'add', value: null, condition: null,
            movementType: moveType, movementRange: r,
          }] };
        }
        break;
      }
    }

    if (weaponEffects.length > 0) {
      return {
        ...base, ...extra,
        abilityEffects: weaponEffects,
        activation: { actionType: 'action', resourceCost: null, range: '5 feet', target: 'single', requiresSave: null },
      };
    }
    return { ...base, ...extra };
  }

  function buildProperties(): string[] {
    const props: string[] = [];
    if (category === 'weapon') props.push(...weaponProps);
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

  async function handleSave() {
    if (!name.trim() || saving) return;
    setSaving(true);
    const id = editing?.id ?? ('hb_' + (toId(name) || 'item') + '_' + Date.now().toString(36));

    const feature = buildFeature(id);
    const item: Item = {
      id,
      name: name.trim(),
      weight: parseFloat(weight) || 0,
      cost: cost.trim() || '-',
      properties: buildProperties(),
      features: feature ? [feature] : [],
      homebrewDraft: {
        description, category, rarity, armorCategory, weaponProps, extraProps, weaponDamage,
        effectKind, acValue, acAddsDex, statAbility, statAmount,
        senseType, senseRange, senseNote, moveType, moveRange,
      },
    };

    try {
      await saveItem('item', item);
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

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.fieldLabel}>Item Name *</Text>
        <TextInput style={styles.input} value={name} onChangeText={setName}
          placeholder="e.g. Cloak of the Deep" placeholderTextColor={Colors.textDim} />

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
        <TextInput style={[styles.input, styles.textArea]} value={description} onChangeText={setDescription}
          placeholder="What does this item do?" placeholderTextColor={Colors.textDim}
          multiline textAlignVertical="top" />

        <Text style={styles.fieldLabel}>Category</Text>
        <View style={styles.chipWrap}>
          {CATEGORIES.map(c => (
            <Pressable key={c.key} style={[styles.chip, category === c.key && styles.chipActive]} onPress={() => setCategory(c.key)}>
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
                <Pressable key={a} style={[styles.chip, armorCategory === a && styles.chipActive]} onPress={() => setArmorCategory(a)}>
                  <Text style={[styles.chipTxt, armorCategory === a && styles.chipTxtActive]}>{a}</Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.hint}>Set base AC below in Additional Mechanical Effects, Armor option.</Text>
          </View>
        )}

        {category !== 'gear' && category !== 'tool' && (
          <>
            <Text style={styles.fieldLabel}>Rarity</Text>
            <Text style={styles.hint}>Leave on "None" for mundane gear that just happens to be in this category.</Text>
            <View style={styles.chipWrap}>
              <Pressable style={[styles.chip, rarity === null && styles.chipActive]} onPress={() => setRarity(null)}>
                <Text style={[styles.chipTxt, rarity === null && styles.chipTxtActive]}>None</Text>
              </Pressable>
              {RARITIES.map(r => (
                <Pressable key={r} style={[styles.chip, rarity === r && styles.chipActive]} onPress={() => setRarity(r)}>
                  <Text style={[styles.chipTxt, rarity === r && styles.chipTxtActive]}>{r}</Text>
                </Pressable>
              ))}
            </View>
          </>
        )}

        <Text style={styles.fieldLabel}>Additional Properties (optional, comma-separated)</Text>
        <TextInput style={styles.input} value={extraProps} onChangeText={setExtraProps}
          placeholder="Anything not covered above" placeholderTextColor={Colors.textDim} />

        <Text style={styles.fieldLabel}>Additional Mechanical Effects (optional)</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: Spacing.xs }}>
          {([
            ['none', 'None'], ['armor_ac', 'Armor (AC)'],
            ['stat_bonus', 'Stat Bonus'], ['grant_sense', 'Sense'], ['grant_movement', 'Movement'],
          ] as [ItemEffectKind, string][]).map(([k, label]) => (
            <Pressable key={k} style={[styles.chip, effectKind === k && styles.chipActive]} onPress={() => setEffectKind(k)}>
              <Text style={[styles.chipTxt, effectKind === k && styles.chipTxtActive]}>{label}</Text>
            </Pressable>
          ))}
        </ScrollView>

        {effectKind === 'armor_ac' && (
          <View style={styles.effectPanel}>
            <Text style={styles.fieldLabel}>Base AC</Text>
            <TextInput style={styles.input} value={acValue} onChangeText={setAcValue}
              placeholder="e.g. 14" placeholderTextColor={Colors.textDim} keyboardType="numeric" />
            <Pressable style={[styles.toggle, acAddsDex && styles.toggleActive]} onPress={() => setAcAddsDex(v => !v)}>
              <Text style={[styles.toggleTxt, acAddsDex && styles.toggleTxtActive]}>
                {acAddsDex ? 'Adds DEX modifier (light/medium)' : 'Flat AC (heavy)'}
              </Text>
            </Pressable>
            {acAddsDex && armorCategory === 'medium armor' && (
              <Text style={styles.hint}>Dex bonus capped at +2, per medium armor's rule.</Text>
            )}
          </View>
        )}

        {effectKind === 'stat_bonus' && (
          <View style={styles.effectPanel}>
            <Text style={styles.fieldLabel}>Ability</Text>
            <View style={styles.chipWrap}>
              {ABILITIES.map(a => (
                <Pressable key={a.key} style={[styles.chip, statAbility === a.key && styles.chipActive]} onPress={() => setStatAbility(a.key)}>
                  <Text style={[styles.chipTxt, statAbility === a.key && styles.chipTxtActive]}>{a.label}</Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.fieldLabel}>Amount</Text>
            <TextInput style={styles.input} value={statAmount} onChangeText={setStatAmount}
              placeholder="e.g. 1 or 2" placeholderTextColor={Colors.textDim} keyboardType="numbers-and-punctuation" />
            <Text style={styles.hint}>Adds to the ability score while the item is equipped.</Text>
          </View>
        )}

        {effectKind === 'grant_sense' && (
          <View style={styles.effectPanel}>
            <Text style={styles.fieldLabel}>Sense</Text>
            <View style={styles.chipWrap}>
              {SENSE_TYPES.map(s => (
                <Pressable key={s.key} style={[styles.chip, senseType === s.key && styles.chipActive]} onPress={() => setSenseType(s.key)}>
                  <Text style={[styles.chipTxt, senseType === s.key && styles.chipTxtActive]}>{s.label}</Text>
                </Pressable>
              ))}
            </View>
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.fieldLabel}>Range (ft)</Text>
                <TextInput style={styles.input} value={senseRange} onChangeText={setSenseRange}
                  placeholder="60" placeholderTextColor={Colors.textDim} keyboardType="numeric" />
              </View>
              <View style={{ flex: 2 }}>
                <Text style={styles.fieldLabel}>Note</Text>
                <TextInput style={styles.input} value={senseNote} onChangeText={setSenseNote}
                  placeholder="e.g. in color, heat" placeholderTextColor={Colors.textDim} />
              </View>
            </View>
            <Text style={styles.hint}>Granted while the item is equipped.</Text>
          </View>
        )}

        {effectKind === 'grant_movement' && (
          <View style={styles.effectPanel}>
            <Text style={styles.fieldLabel}>Movement Type</Text>
            <View style={styles.chipWrap}>
              {MOVE_TYPES.map(m => (
                <Pressable key={m.key} style={[styles.chip, moveType === m.key && styles.chipActive]} onPress={() => setMoveType(m.key)}>
                  <Text style={[styles.chipTxt, moveType === m.key && styles.chipTxtActive]}>{m.label}</Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.fieldLabel}>Speed (ft)</Text>
            <TextInput style={styles.input} value={moveRange} onChangeText={setMoveRange}
              placeholder="30" placeholderTextColor={Colors.textDim} keyboardType="numeric" />
            <Text style={styles.hint}>Granted while the item is equipped. Shows in the Travel section.</Text>
          </View>
        )}
      </ScrollView>

      <SafeBottomView>
        <View style={styles.footer}>
          <Pressable style={[styles.saveBtn, (!name.trim() || saving) && styles.btnDisabled]} onPress={handleSave} disabled={!name.trim() || saving}>
            <Text style={styles.saveBtnTxt}>{saving ? 'Saving...' : 'Save Item'}</Text>
          </Pressable>
        </View>
      </SafeBottomView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen:  { flex: 1, backgroundColor: Colors.bg },
  header:  { backgroundColor: Colors.surfaceHigh, paddingTop: Spacing.xl+8, paddingBottom: Spacing.md, paddingHorizontal: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.border },
  backBtn: { marginBottom: 4 },
  backTxt: { color: Colors.gold, fontSize: FontSize.md, fontWeight: FontWeight.bold },
  title:   { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  scroll:  { flex: 1 },
  content: { padding: Spacing.md, gap: Spacing.sm, paddingBottom: Spacing.xxl },
  fieldLabel: { fontSize: FontSize.xs, color: Colors.textSecondary, letterSpacing: 1, fontWeight: FontWeight.bold, marginTop: Spacing.xs },
  input:   { backgroundColor: Colors.surface, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, padding: Spacing.sm, color: Colors.textPrimary, fontSize: FontSize.md },
  textArea:{ minHeight: 90 },
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
  btnDisabled: { opacity: 0.4 },
  footer:    { padding: Spacing.sm, backgroundColor: Colors.surfaceHigh, borderTopWidth: 1, borderTopColor: Colors.border },
  saveBtn:   { backgroundColor: Colors.gold, borderRadius: Radius.md, padding: Spacing.md, alignItems: 'center' },
  saveBtnTxt:{ color: Colors.bg, fontWeight: FontWeight.bold, fontSize: FontSize.md },
  damageRow: { flexDirection: 'row', gap: Spacing.xs, alignItems: 'center', marginBottom: Spacing.xs },
  removeDamageBtn: { padding: Spacing.xs },
  removeDamageTxt: { color: Colors.red, fontSize: FontSize.md, fontWeight: FontWeight.bold },
  addDamageBtn: { alignSelf: 'flex-start', marginTop: 2 },
  addDamageTxt: { color: Colors.gold, fontSize: FontSize.xs, fontWeight: FontWeight.bold },
});
