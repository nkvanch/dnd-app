// app/homebrew/item-builder.tsx
// Homebrew item builder — name, cost, weight, properties, description, plus
// optional structured effects for the common cases (armor AC, weapon damage,
// stat bonus, and granting a sense). Saves an Item into the homebrew library,
// which then appears in the inventory Add-Item picker (categorised by its
// properties, exactly like official items).
import { useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, TextInput, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Item, Feature, Effect, AbilityEffect, SenseType, Ability } from '../../src/engine/types';
import { useHomebrewStore } from '../../src/store/homebrewStore';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../../src/theme';

function toId(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

// The kinds of mechanical behaviour a homebrew item can carry. Kept small and
// concrete so the form stays usable; anything more exotic can be authored via
// the generic property tags + the Feature Editor.
type ItemEffectKind = 'none' | 'armor_ac' | 'weapon_damage' | 'stat_bonus' | 'grant_sense' | 'grant_movement';
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
const DAMAGE_TYPES = ['slashing','piercing','bludgeoning','fire','cold','lightning','acid','poison','necrotic','radiant','psychic','thunder','force'];

export default function ItemBuilderScreen() {
  const router   = useRouter();
  const saveItem = useHomebrewStore(s => s.saveItem);

  const [name, setName]         = useState('');
  const [cost, setCost]         = useState('');
  const [weight, setWeight]     = useState('');
  const [props, setProps]       = useState('');
  const [description, setDescription] = useState('');

  // Effect builder
  const [effectKind, setEffectKind] = useState<ItemEffectKind>('none');
  // armor_ac
  const [acValue, setAcValue]   = useState('');
  const [acAddsDex, setAcAddsDex] = useState(false);
  // weapon_damage
  const [dmgDice, setDmgDice]   = useState('1d8');
  const [dmgType, setDmgType]   = useState('slashing');
  // stat_bonus
  const [statAbility, setStatAbility] = useState<Ability>('str');
  const [statAmount, setStatAmount]   = useState('1');
  // grant_sense
  const [senseType, setSenseType] = useState<SenseType>('darkvision');
  const [senseRange, setSenseRange] = useState('60');
  const [senseNote, setSenseNote]   = useState('');
  // grant_movement
  const [moveType, setMoveType] = useState<MoveType>('fly');
  const [moveRange, setMoveRange] = useState('30');

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

    switch (effectKind) {
      case 'armor_ac': {
        const base10 = parseInt(acValue, 10);
        if (isNaN(base10)) return base; // no valid AC → just a described item
        const effect: Effect = {
          type: 'base_ac_formula', target: 'ac', operation: 'set',
          value: base10, condition: null,
          formulaAbilities: acAddsDex ? ['dex'] : [],
        };
        return { ...base, effects: [effect] };
      }
      case 'weapon_damage': {
        // Weapon damage lives in abilityEffects (fires on attack, not passively).
        const ae: AbilityEffect = { type: 'damage', dice: dmgDice.trim() || '1d8', damageType: dmgType };
        return {
          ...base,
          abilityEffects: [ae],
          activation: {
            actionType:   'action',
            resourceCost: null,
            range:        '5 feet',
            target:       'single',
            requiresSave: null,
          },
        };
      }
      case 'stat_bonus': {
        const amt = parseInt(statAmount, 10);
        if (isNaN(amt)) return base;
        const effect: Effect = {
          type: 'stat_modifier', target: statAbility, operation: 'add',
          value: amt, condition: null,
        };
        return { ...base, effects: [effect] };
      }
      case 'grant_sense': {
        const r = parseInt(senseRange, 10);
        if (isNaN(r) || r <= 0) return base;
        const effect: Effect = {
          type: 'grant_sense', target: 'senses', operation: 'add',
          value: null, condition: null,
          senseType, senseRange: r, senseNote: senseNote.trim() || undefined,
        };
        return { ...base, effects: [effect] };
      }
      case 'grant_movement': {
        const r = parseInt(moveRange, 10);
        if (isNaN(r) || r <= 0) return base;
        const effect: Effect = {
          type: 'grant_movement', target: 'movement', operation: 'add',
          value: null, condition: null,
          movementType: moveType, movementRange: r,
        };
        return { ...base, effects: [effect] };
      }
      default:
        return base;
    }
  }

  async function handleSave() {
    if (!name.trim()) { Alert.alert('Name required', 'Give your item a name.'); return; }
    const id = 'hb_' + (toId(name) || 'item') + '_' + Date.now().toString(36);

    const propList = props.trim()
      ? props.split(',').map(p => p.trim().toLowerCase()).filter(Boolean)
      : [];

    const feature = buildFeature(id);
    const item: Item = {
      id,
      name: name.trim(),
      weight: parseFloat(weight) || 0,
      cost: cost.trim() || '—',
      properties: propList,
      features: feature ? [feature] : [],
    };

    await saveItem('item', item);
    Alert.alert('Saved!', `"${item.name}" added to your homebrew library. It will appear in the inventory Add-Item list.`, [
      { text: 'OK', onPress: () => router.back() },
    ]);
  }

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backTxt}>← Back</Text>
        </Pressable>
        <Text style={styles.title}>New Item</Text>
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

        <Text style={styles.fieldLabel}>Properties (comma-separated)</Text>
        <TextInput style={styles.input} value={props} onChangeText={setProps}
          placeholder="e.g. magic item, wondrous, rare" placeholderTextColor={Colors.textDim} />
        <Text style={styles.hint}>
          These drive how the item is categorised in your inventory. Include "magic item"
          and a rarity (common/uncommon/rare/very rare/legendary) for magic gear, or a base
          type like "heavy armor", "martial", "shield".
        </Text>

        <Text style={styles.fieldLabel}>Description</Text>
        <TextInput style={[styles.input, styles.textArea]} value={description} onChangeText={setDescription}
          placeholder="What does this item do?" placeholderTextColor={Colors.textDim}
          multiline textAlignVertical="top" />

        {/* Mechanical effect */}
        <Text style={styles.fieldLabel}>Mechanical Effect (optional)</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: Spacing.xs }}>
          {([
            ['none', 'None'], ['armor_ac', 'Armor (AC)'], ['weapon_damage', 'Weapon'],
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
                {acAddsDex ? '✓ Adds DEX modifier (light/medium)' : 'Flat AC (heavy)'}
              </Text>
            </Pressable>
          </View>
        )}

        {effectKind === 'weapon_damage' && (
          <View style={styles.effectPanel}>
            <Text style={styles.fieldLabel}>Damage Dice</Text>
            <TextInput style={styles.input} value={dmgDice} onChangeText={setDmgDice}
              placeholder="e.g. 1d8" placeholderTextColor={Colors.textDim} />
            <Text style={styles.fieldLabel}>Damage Type</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: Spacing.xs }}>
              {DAMAGE_TYPES.map(t => (
                <Pressable key={t} style={[styles.chip, dmgType === t && styles.chipActive]} onPress={() => setDmgType(t)}>
                  <Text style={[styles.chipTxt, dmgType === t && styles.chipTxtActive]}>{t}</Text>
                </Pressable>
              ))}
            </ScrollView>
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

      <View style={styles.footer}>
        <Pressable style={[styles.saveBtn, !name.trim() && styles.btnDisabled]} onPress={handleSave} disabled={!name.trim()}>
          <Text style={styles.saveBtnTxt}>💾 Save Item</Text>
        </Pressable>
      </View>
    </View>
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
});
