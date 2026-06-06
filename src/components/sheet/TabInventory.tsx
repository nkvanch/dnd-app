// app/sheet/TabInventory.tsx
// Tab 5 — Equipped items, carried items, currency.
import { ScrollView, View, Text, Pressable, StyleSheet } from 'react-native';
import { Entity, ItemInstance } from '../../engine/types';
import { globalContentDB } from '../../content/classes/library';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../../theme';

interface Props {
  entity:         Entity;
  onEquip:        (itemId: string) => void;
  onUnequip:      (itemId: string) => void;
}

function ItemRow({
  instance, equipped, onToggle,
}: {
  instance: ItemInstance;
  equipped: boolean;
  onToggle: () => void;
}) {
  const item = globalContentDB.items.find(i => i.id === instance.itemId);
  const name = item?.name ?? instance.itemId;
  const props = item?.properties ?? [];

  return (
    <View style={styles.itemRow}>
      <View style={styles.itemInfo}>
        <Text style={styles.itemName}>{name}</Text>
        {props.length > 0 && (
          <Text style={styles.itemProps}>{props.join(', ')}</Text>
        )}
        {instance.quantity > 1 && (
          <Text style={styles.itemQty}>×{instance.quantity}</Text>
        )}
      </View>
      <Pressable
        style={[styles.toggleBtn, equipped && styles.toggleBtnEquipped]}
        onPress={onToggle}
      >
        <Text style={[styles.toggleTxt, equipped && styles.toggleTxtEquipped]}>
          {equipped ? 'Unequip' : 'Equip'}
        </Text>
      </Pressable>
    </View>
  );
}

export function TabInventory({ entity, onEquip, onUnequip }: Props) {
  const { inventory } = entity;
  const { currency } = inventory;

  // ── Carry weight ────────────────────────────────────────────────────────────
  const totalWeight = [...inventory.equipped, ...inventory.carried].reduce((sum, item) => {
    const itemDef = globalContentDB.items.find(i => i.id === item.itemId);
    return sum + (itemDef?.weight ?? 0) * item.quantity;
  }, 0);
  const carryCapacity = entity.stats.str * 15;
  const weightPct     = carryCapacity > 0 ? totalWeight / carryCapacity : 0;
  const weightColor   = weightPct > 1 ? Colors.red : weightPct >= 0.75 ? Colors.gold : Colors.green;

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>

      {/* Carry Weight */}
      <View style={styles.section}>
        <View style={styles.weightHeader}>
          <Text style={styles.sectionTitle}>WEIGHT</Text>
          <Text style={[styles.weightValue, { color: weightColor }]}>
            {Math.round(totalWeight * 10) / 10} / {carryCapacity} lbs
          </Text>
        </View>
        <View style={styles.weightBarOuter}>
          <View style={[styles.weightBarFill, {
            width: `${Math.round(Math.min(1, weightPct) * 100)}%` as any,
            backgroundColor: weightColor,
          }]} />
        </View>
        {weightPct > 1 && <Text style={styles.overweight}>⚠ Encumbered — over carry capacity</Text>}
      </View>

      {/* Currency */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>CURRENCY</Text>
        <View style={styles.currencyRow}>
          {[
            { label: 'PP', value: currency.pp, color: Colors.blue },
            { label: 'GP', value: currency.gp, color: Colors.gold },
            { label: 'EP', value: currency.ep, color: Colors.textSecondary },
            { label: 'SP', value: currency.sp, color: Colors.textSecondary },
            { label: 'CP', value: currency.cp, color: Colors.textSecondary },
          ].map(({ label, value, color }) => (
            <View key={label} style={styles.coinBox}>
              <Text style={[styles.coinValue, { color }]}>{value}</Text>
              <Text style={styles.coinLabel}>{label}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Equipped */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>EQUIPPED</Text>
        {inventory.equipped.length === 0 ? (
          <Text style={styles.emptyNote}>Nothing equipped</Text>
        ) : (
          inventory.equipped.map(inst => (
            <ItemRow
              key={inst.itemId}
              instance={inst}
              equipped
              onToggle={() => onUnequip(inst.itemId)}
            />
          ))
        )}
      </View>

      {/* Carried */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>CARRIED</Text>
        {inventory.carried.length === 0 ? (
          <Text style={styles.emptyNote}>Bag is empty</Text>
        ) : (
          inventory.carried.map(inst => (
            <ItemRow
              key={inst.itemId}
              instance={inst}
              equipped={false}
              onToggle={() => onEquip(inst.itemId)}
            />
          ))
        )}
      </View>

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

  weightHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  weightValue:  { fontSize: FontSize.sm, fontWeight: FontWeight.bold },
  weightBarOuter: {
    width: '100%', height: 6, backgroundColor: Colors.border,
    borderRadius: Radius.full, overflow: 'hidden', marginTop: 2,
  },
  weightBarFill: { height: '100%', borderRadius: Radius.full },
  overweight:    { fontSize: FontSize.xs, color: Colors.red, marginTop: 4 },

  currencyRow: { flexDirection: 'row', justifyContent: 'space-around' },
  coinBox:     { alignItems: 'center', gap: 2 },
  coinValue:   { fontSize: FontSize.xl, fontWeight: FontWeight.bold },
  coinLabel:   { fontSize: FontSize.xs, color: Colors.textDim, letterSpacing: 1 },

  itemRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    paddingVertical: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  itemInfo:  { flex: 1, gap: 2 },
  itemName:  { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  itemProps: { fontSize: FontSize.xs, color: Colors.textDim },
  itemQty:   { fontSize: FontSize.sm, color: Colors.textSecondary },

  toggleBtn: {
    backgroundColor: Colors.surfaceHigh, borderRadius: Radius.md,
    paddingHorizontal: Spacing.sm, paddingVertical: 4,
    borderWidth: 1, borderColor: Colors.border,
  },
  toggleBtnEquipped: { borderColor: Colors.gold + '88', backgroundColor: Colors.gold + '22' },
  toggleTxt:         { fontSize: FontSize.sm, color: Colors.textSecondary },
  toggleTxtEquipped: { color: Colors.gold, fontWeight: FontWeight.bold },

  emptyNote: { color: Colors.textDim, fontSize: FontSize.sm, fontStyle: 'italic' },
});
