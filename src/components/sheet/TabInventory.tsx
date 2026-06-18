// src/components/sheet/TabInventory.tsx
// Tab — Equipped items, carried items, currency.
// Supports adding items from the content DB (or homebrew),
// removing items, and adjusting money per denomination.
// Large creature rules are surfaced when the character is Large-sized.
import { useState } from 'react';
import {
  ScrollView, View, Text, Pressable, StyleSheet,
  Modal, TextInput, Alert,
} from 'react-native';
import { Entity, ItemInstance, Item, Currency } from '../../engine/types';
import { globalContentDB } from '../../content/classes/library';
import { useHomebrewStore } from '../../store/homebrewStore';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../../theme';

// ── Large creature detection ───────────────────────────────────────────────────

const LARGE_SUBRACE_IDS  = new Set(['skeleton_giant']);
const LARGE_RACE_IDS     = new Set<string>(); // extend as more Large races are added

function isLargeCreature(entity: Entity): boolean {
  if (entity.identity.subRaceId && LARGE_SUBRACE_IDS.has(entity.identity.subRaceId)) return true;
  if (entity.identity.raceId    && LARGE_RACE_IDS.has(entity.identity.raceId))       return true;
  return entity.features.some(f => f.id === 'skeleton_giant_remains');
}

// ── Currency helpers ───────────────────────────────────────────────────────────

const COIN_KEYS: (keyof Currency)[] = ['pp', 'gp', 'ep', 'sp', 'cp'];
const COIN_COLORS: Record<keyof Currency, string> = {
  pp: Colors.blue,
  gp: Colors.gold,
  ep: Colors.textSecondary,
  sp: Colors.textSecondary,
  cp: Colors.textSecondary,
};

// ── Item categories ───────────────────────────────────────────────────────────

type ItemCategory = {
  label:  string;
  emoji:  string;
  test:   (item: Item) => boolean;
};

const ITEM_CATEGORIES: ItemCategory[] = [
  {
    label: 'Magic Items',
    emoji: '✨',
    test: i => i.properties.some(p => p.toLowerCase().includes('magic')),
  },
  {
    label: 'Weapons — Martial Melee',
    emoji: '⚔️',
    test: i => {
      const isMeleeWeapon = i.features.some(
        f => f.abilityEffects?.some(e => e.type === 'damage') &&
             (f.activation?.range === '5 feet' || f.activation?.range === 'touch')
      );
      const isMartial = !i.properties.some(p =>
        ['light', 'finesse', 'thrown'].some(kw => p.toLowerCase().includes(kw)) &&
        !['heavy', 'two-handed', 'versatile'].some(kw => p.toLowerCase().includes(kw))
      );
      return isMeleeWeapon && (i.properties.some(p =>
        p.toLowerCase().includes('heavy') || p.toLowerCase().includes('versatile') ||
        ['greatsword','greataxe','maul','longsword','battleaxe','warhammer','rapier','scimitar'].some(n => i.id.includes(n))
      ));
    },
  },
  {
    label: 'Weapons — Simple Melee',
    emoji: '🗡️',
    test: i =>
      i.features.some(f => f.abilityEffects?.some(e => e.type === 'damage') &&
        (f.activation?.range === '5 feet' || f.activation?.range === 'touch')) &&
      ['dagger','handaxe','club','quarterstaff','javelin','spear','mace'].some(n => i.id.includes(n)),
  },
  {
    label: 'Weapons — Ranged',
    emoji: '🏹',
    test: i =>
      i.features.some(f => f.abilityEffects?.some(e => e.type === 'damage') &&
        f.activation?.range && !['5 feet','touch'].includes(f.activation.range)),
  },
  {
    label: 'Heavy Armor',
    emoji: '🛡️',
    test: i => i.properties.some(p => p.toLowerCase().includes('heavy armor')),
  },
  {
    label: 'Medium Armor',
    emoji: '🥋',
    test: i => i.properties.some(p => p.toLowerCase().includes('medium armor')),
  },
  {
    label: 'Light Armor',
    emoji: '👕',
    test: i => i.properties.some(p => p.toLowerCase().includes('light armor')),
  },
  {
    label: 'Shields',
    emoji: '🔰',
    test: i => i.properties.some(p => p.toLowerCase().includes('shield')),
  },
  {
    label: 'Ammunition',
    emoji: '🎯',
    test: i => i.properties.some(p => p.toLowerCase().includes('ammunition')) && !i.features.some(f => f.abilityEffects?.some(e => e.type === 'damage')),
  },
  {
    label: 'Tools & Kits',
    emoji: '🔧',
    test: i => i.properties.some(p => ['tool','kit','instrument'].some(kw => p.toLowerCase().includes(kw))),
  },
  {
    label: 'Spellcasting Focuses',
    emoji: '🔮',
    test: i => i.properties.some(p => ['focus','spellbook','component pouch'].some(kw => p.toLowerCase().includes(kw))),
  },
  {
    label: 'Adventuring Gear',
    emoji: '🎒',
    test: () => true,   // catch-all
  },
];

function categorise(items: Item[]): { cat: ItemCategory; items: Item[] }[] {
  const result: { cat: ItemCategory; items: Item[] }[] = [];
  const assigned = new Set<string>();
  for (const cat of ITEM_CATEGORIES) {
    const matched = items.filter(i => !assigned.has(i.id) && cat.test(i));
    if (matched.length > 0) {
      matched.forEach(i => assigned.add(i.id));
      result.push({ cat, items: matched });
    }
  }
  return result;
}

// ── Add Item Modal ─────────────────────────────────────────────────────────────

function AddItemModal({
  visible, equippedIds, carriedIds, onAdd, onClose,
}: {
  visible:     boolean;
  equippedIds: Set<string>;
  carriedIds:  Set<string>;
  onAdd:       (itemId: string) => void;
  onClose:     () => void;
}) {
  const homebrewItems = useHomebrewStore(s =>
    (s as any).items as Item[] | undefined
  ) ?? [];
  const [search,    setSearch]    = useState('');
  const [expanded, setExpanded]  = useState<string | null>(null);

  const allItems = [...globalContentDB.items, ...homebrewItems];
  const q = search.trim().toLowerCase();
  const filtered = q
    ? allItems.filter(i => i.name.toLowerCase().includes(q) ||
        i.properties.some(p => p.toLowerCase().includes(q)))
    : allItems;

  const groups = categorise(filtered);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={addStyles.backdrop} onPress={onClose}>
        <Pressable style={addStyles.sheet} onPress={e => e.stopPropagation()}>
          <Text style={addStyles.title}>Add Item</Text>
          <TextInput
            style={addStyles.search}
            value={search}
            onChangeText={setSearch}
            placeholder="Search all items…"
            placeholderTextColor={Colors.textDim}
            autoFocus
          />
          <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 480 }}>
            {groups.map(({ cat, items }) => (
              <View key={cat.label} style={addStyles.group}>
                <Pressable
                  style={addStyles.groupHeader}
                  onPress={() => setExpanded(e => e === cat.label ? null : cat.label)}
                >
                  <Text style={addStyles.groupEmoji}>{cat.emoji}</Text>
                  <Text style={addStyles.groupLabel}>{cat.label}</Text>
                  <Text style={addStyles.groupCount}>({items.length})</Text>
                  <Text style={addStyles.groupCaret}>
                    {expanded === cat.label || q ? '▲' : '▼'}
                  </Text>
                </Pressable>
                {(expanded === cat.label || !!q) && items.map(item => {
                  const owned = equippedIds.has(item.id) || carriedIds.has(item.id);
                  return (
                    <View key={item.id} style={[addStyles.itemRow, owned && addStyles.itemRowOwned]}>
                      <View style={addStyles.itemInfo}>
                        <Text style={[addStyles.itemName, owned && addStyles.itemNameOwned]}>
                          {item.name}
                        </Text>
                        {item.properties.length > 0 && (
                          <Text style={addStyles.itemProps} numberOfLines={1}>
                            {item.properties.join(' · ')}
                          </Text>
                        )}
                        {item.cost !== '0 gp' && item.cost && (
                          <Text style={addStyles.itemCost}>{item.cost}</Text>
                        )}
                      </View>
                      {owned ? (
                        <Text style={addStyles.ownedBadge}>In bag</Text>
                      ) : (
                        <Pressable
                          style={addStyles.addBtn}
                          onPress={() => { onAdd(item.id); }}
                        >
                          <Text style={addStyles.addBtnTxt}>+ Add</Text>
                        </Pressable>
                      )}
                    </View>
                  );
                })}
              </View>
            ))}
            {groups.length === 0 && (
              <Text style={addStyles.empty}>No items match "{search}".</Text>
            )}
          </ScrollView>
          <Pressable style={addStyles.cancelBtn} onPress={onClose}>
            <Text style={addStyles.cancelTxt}>Close</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const addStyles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: '#000000bb', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: Colors.surfaceHigh,
    borderTopLeftRadius: Radius.lg, borderTopRightRadius: Radius.lg,
    padding: Spacing.md, gap: Spacing.sm, paddingBottom: Spacing.xxl,
    maxHeight: '90%',
  },
  title:  { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  search: {
    backgroundColor: Colors.surface, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border,
    padding: Spacing.sm, color: Colors.textPrimary, fontSize: FontSize.md,
  },
  group:       { marginBottom: 2 },
  groupHeader: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.xs,
    backgroundColor: Colors.surface, borderRadius: Radius.sm,
    paddingVertical: Spacing.xs, paddingHorizontal: Spacing.sm, marginBottom: 2,
  },
  groupEmoji:  { fontSize: FontSize.sm },
  groupLabel:  { fontSize: FontSize.xs, color: Colors.textSecondary, fontWeight: FontWeight.bold, letterSpacing: 1, flex: 1 },
  groupCount:  { fontSize: FontSize.xs, color: Colors.textDim },
  groupCaret:  { fontSize: FontSize.xs, color: Colors.textDim, marginLeft: 4 },
  itemRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: Spacing.sm, paddingHorizontal: Spacing.sm,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
    gap: Spacing.sm,
  },
  itemRowOwned: { opacity: 0.5 },
  itemInfo:     { flex: 1 },
  itemName:     { fontSize: FontSize.sm, color: Colors.textPrimary, fontWeight: FontWeight.bold },
  itemNameOwned:{ color: Colors.textDim },
  itemProps:    { fontSize: FontSize.xs, color: Colors.textDim, marginTop: 1 },
  itemCost:     { fontSize: FontSize.xs, color: Colors.gold, marginTop: 1 },
  addBtn: {
    backgroundColor: Colors.gold + '22', borderRadius: Radius.full,
    borderWidth: 1, borderColor: Colors.gold + '66',
    paddingHorizontal: Spacing.sm, paddingVertical: 3,
  },
  addBtnTxt:   { fontSize: FontSize.xs, color: Colors.gold, fontWeight: FontWeight.bold },
  ownedBadge:  { fontSize: FontSize.xs, color: Colors.textDim, fontStyle: 'italic' },
  empty:       { color: Colors.textDim, fontStyle: 'italic', textAlign: 'center', padding: Spacing.lg },
  cancelBtn:   { alignItems: 'center', padding: Spacing.sm },
  cancelTxt:   { color: Colors.textSecondary, fontSize: FontSize.md },
});

// ── Currency Modal ─────────────────────────────────────────────────────────────

function CurrencyModal({
  visible, currency, onSave, onClose,
}: {
  visible:  boolean;
  currency: Currency;
  onSave:   (c: Currency) => void;
  onClose:  () => void;
}) {
  const [values, setValues] = useState<Record<keyof Currency, string>>({
    pp: String(currency.pp),
    gp: String(currency.gp),
    ep: String(currency.ep),
    sp: String(currency.sp),
    cp: String(currency.cp),
  });

  function handleSave() {
    const next: Currency = {
      pp: Math.max(0, parseInt(values.pp, 10) || 0),
      gp: Math.max(0, parseInt(values.gp, 10) || 0),
      ep: Math.max(0, parseInt(values.ep, 10) || 0),
      sp: Math.max(0, parseInt(values.sp, 10) || 0),
      cp: Math.max(0, parseInt(values.cp, 10) || 0),
    };
    onSave(next);
    onClose();
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={currStyles.backdrop} onPress={onClose}>
        <Pressable style={currStyles.sheet} onPress={e => e.stopPropagation()}>
          <Text style={currStyles.title}>Edit Currency</Text>
          <View style={currStyles.grid}>
            {COIN_KEYS.map(key => (
              <View key={key} style={currStyles.coinEdit}>
                <Text style={[currStyles.coinLabel, { color: COIN_COLORS[key] }]}>
                  {key.toUpperCase()}
                </Text>
                <TextInput
                  style={currStyles.coinInput}
                  value={values[key]}
                  onChangeText={v => setValues(prev => ({ ...prev, [key]: v }))}
                  keyboardType="numeric"
                  selectTextOnFocus
                />
              </View>
            ))}
          </View>
          <View style={currStyles.btns}>
            <Pressable style={currStyles.cancelBtn} onPress={onClose}>
              <Text style={currStyles.cancelTxt}>Cancel</Text>
            </Pressable>
            <Pressable style={currStyles.saveBtn} onPress={handleSave}>
              <Text style={currStyles.saveTxt}>Save</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const currStyles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: '#000000bb', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: Colors.surfaceHigh,
    borderTopLeftRadius: Radius.lg, borderTopRightRadius: Radius.lg,
    padding: Spacing.lg, gap: Spacing.md, paddingBottom: Spacing.xxl,
  },
  title: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  grid:  { flexDirection: 'row', gap: Spacing.sm },
  coinEdit:  { flex: 1, alignItems: 'center', gap: Spacing.xs },
  coinLabel: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, letterSpacing: 1 },
  coinInput: {
    backgroundColor: Colors.surface, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border,
    padding: Spacing.sm, color: Colors.textPrimary,
    fontSize: FontSize.lg, fontWeight: FontWeight.bold,
    textAlign: 'center', width: '100%',
  },
  btns: { flexDirection: 'row', gap: Spacing.sm },
  cancelBtn: { flex: 1, alignItems: 'center', padding: Spacing.sm },
  cancelTxt: { color: Colors.textSecondary, fontSize: FontSize.md },
  saveBtn:   { flex: 2, backgroundColor: Colors.gold, borderRadius: Radius.md, padding: Spacing.sm, alignItems: 'center' },
  saveTxt:   { color: Colors.bg, fontWeight: FontWeight.bold, fontSize: FontSize.md },
});

// ── Item Row ───────────────────────────────────────────────────────────────────

function ItemRow({
  instance, equipped, allItems, onToggle, onRemove,
}: {
  instance: ItemInstance;
  equipped: boolean;
  allItems: Item[];
  onToggle: () => void;
  onRemove: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const item  = allItems.find(i => i.id === instance.itemId);
  const name  = item?.name ?? instance.itemId;
  const props = item?.properties ?? [];
  const desc  = item?.features?.[0]?.description;

  return (
    <View style={styles.itemWrap}>
      <View style={styles.itemRow}>
        <Pressable style={styles.itemMain} onPress={() => setExpanded(e => !e)}>
          <View style={styles.itemInfo}>
            <Text style={styles.itemName}>{name}</Text>
            {props.length > 0 && (
              <Text style={styles.itemProps} numberOfLines={expanded ? undefined : 1}>
                {props.join(' · ')}
              </Text>
            )}
            {instance.quantity > 1 && (
              <Text style={styles.itemQty}>×{instance.quantity}</Text>
            )}
          </View>
          <Text style={styles.expandCaret}>{expanded ? '▲' : '▼'}</Text>
        </Pressable>
        <Pressable
          style={[styles.toggleBtn, equipped && styles.toggleBtnEquipped]}
          onPress={onToggle}
        >
          <Text style={[styles.toggleTxt, equipped && styles.toggleTxtEquipped]}>
            {equipped ? 'Unequip' : 'Equip'}
          </Text>
        </Pressable>
        <Pressable style={styles.removeBtn} onPress={onRemove} hitSlop={8}>
          <Text style={styles.removeTxt}>✕</Text>
        </Pressable>
      </View>
      {expanded && desc && (
        <View style={styles.itemDesc}>
          <Text style={styles.itemDescTxt}>{desc}</Text>
        </View>
      )}
    </View>
  );
}

// ── Main Tab ───────────────────────────────────────────────────────────────────

interface Props {
  entity:            Entity;
  onEquip:           (itemId: string) => void;
  onUnequip:         (itemId: string) => void;
  onAddItem:         (itemId: string) => void;
  onRemoveItem:      (itemId: string) => void;
  onUpdateCurrency:  (currency: Currency) => void;
}

export function TabInventory({
  entity, onEquip, onUnequip, onAddItem, onRemoveItem, onUpdateCurrency,
}: Props) {
  const { inventory } = entity;
  const { currency }  = inventory;
  const [addOpen,  setAddOpen]  = useState(false);
  const [currOpen, setCurrOpen] = useState(false);

  const homebrewItemList = useHomebrewStore(s => (s as any).items as Item[] | undefined) ?? [];
  const allItems = [...globalContentDB.items, ...homebrewItemList];

  const large          = isLargeCreature(entity);
  const carryCapacity  = entity.stats.str * (large ? 30 : 15);
  const totalWeight    = [...inventory.equipped, ...inventory.carried].reduce((sum, inst) => {
    const def = allItems.find(i => i.id === inst.itemId);
    return sum + (def?.weight ?? 0) * inst.quantity;
  }, 0);
  const weightPct  = carryCapacity > 0 ? totalWeight / carryCapacity : 0;
  const weightColor = weightPct > 1 ? Colors.red : weightPct >= 0.75 ? Colors.gold : Colors.green;

  const equippedIds = new Set(inventory.equipped.map(i => i.itemId));
  const carriedIds  = new Set(inventory.carried.map(i => i.itemId));

  function confirmRemove(itemId: string) {
    const item = allItems.find(i => i.id === itemId);
    Alert.alert('Remove Item', `Remove ${item?.name ?? itemId} from your inventory?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => onRemoveItem(itemId) },
    ]);
  }

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
        {large && (
          <Text style={styles.largePCNote}>
            🦴 Large creature — carry capacity doubled (STR × 30).
            Two-handed weapons can be wielded one-handed; versatile weapons use the higher die one-handed.
            Light weapons give disadvantage on attack rolls.
          </Text>
        )}
      </View>

      {/* Currency */}
      <View style={styles.section}>
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>CURRENCY</Text>
          <Pressable style={styles.editCurrBtn} onPress={() => setCurrOpen(true)}>
            <Text style={styles.editCurrTxt}>Edit</Text>
          </Pressable>
        </View>
        <View style={styles.currencyRow}>
          {COIN_KEYS.map(key => (
            <View key={key} style={styles.coinBox}>
              <Text style={[styles.coinValue, { color: COIN_COLORS[key] }]}>{currency[key]}</Text>
              <Text style={styles.coinLabel}>{key.toUpperCase()}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Equipped */}
      <View style={styles.section}>
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>EQUIPPED ({inventory.equipped.length})</Text>
          <Pressable style={styles.addBtn} onPress={() => setAddOpen(true)}>
            <Text style={styles.addBtnTxt}>+ Add Item</Text>
          </Pressable>
        </View>
        {inventory.equipped.length === 0 ? (
          <Text style={styles.emptyNote}>Nothing equipped</Text>
        ) : (
          inventory.equipped.map(inst => (
            <ItemRow
              key={inst.itemId}
              instance={inst}
              equipped
              allItems={allItems}
              onToggle={() => onUnequip(inst.itemId)}
              onRemove={() => confirmRemove(inst.itemId)}
            />
          ))
        )}
      </View>

      {/* Carried */}
      <View style={styles.section}>
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>CARRIED ({inventory.carried.length})</Text>
          {inventory.equipped.length > 0 ? null : (
            <Pressable style={styles.addBtn} onPress={() => setAddOpen(true)}>
              <Text style={styles.addBtnTxt}>+ Add Item</Text>
            </Pressable>
          )}
        </View>
        {inventory.carried.length === 0 ? (
          <Text style={styles.emptyNote}>Bag is empty — tap + Add Item to add gear</Text>
        ) : (
          inventory.carried.map(inst => (
            <ItemRow
              key={inst.itemId}
              instance={inst}
              equipped={false}
              allItems={allItems}
              onToggle={() => onEquip(inst.itemId)}
              onRemove={() => confirmRemove(inst.itemId)}
            />
          ))
        )}
        {/* Always show Add Item in carried section when bag is empty */}
        {inventory.carried.length === 0 && inventory.equipped.length > 0 && (
          <Pressable style={styles.addItemRow} onPress={() => setAddOpen(true)}>
            <Text style={styles.addBtnTxt}>+ Add Item to bag</Text>
          </Pressable>
        )}
      </View>

      <AddItemModal
        visible={addOpen}
        equippedIds={equippedIds}
        carriedIds={carriedIds}
        onAdd={onAddItem}
        onClose={() => setAddOpen(false)}
      />

      <CurrencyModal
        visible={currOpen}
        currency={currency}
        onSave={onUpdateCurrency}
        onClose={() => setCurrOpen(false)}
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
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },

  // Weight
  weightHeader:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  weightValue:    { fontSize: FontSize.sm, fontWeight: FontWeight.bold },
  weightBarOuter: {
    width: '100%', height: 6, backgroundColor: Colors.border,
    borderRadius: Radius.full, overflow: 'hidden', marginTop: 2,
  },
  weightBarFill: { height: '100%', borderRadius: Radius.full },
  overweight:    { fontSize: FontSize.xs, color: Colors.red },
  largePCNote:   {
    fontSize: FontSize.xs, color: Colors.gold, lineHeight: 16,
    backgroundColor: Colors.gold + '11', borderRadius: Radius.sm,
    padding: Spacing.xs, borderLeftWidth: 2, borderLeftColor: Colors.gold,
  },

  // Currency
  editCurrBtn: {
    backgroundColor: Colors.surfaceHigh, borderRadius: Radius.sm,
    borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: Spacing.sm, paddingVertical: 2,
  },
  editCurrTxt:  { fontSize: FontSize.xs, color: Colors.textSecondary, fontWeight: FontWeight.bold },
  currencyRow:  { flexDirection: 'row', justifyContent: 'space-around' },
  coinBox:      { alignItems: 'center', gap: 2 },
  coinValue:    { fontSize: FontSize.xl, fontWeight: FontWeight.bold },
  coinLabel:    { fontSize: FontSize.xs, color: Colors.textDim, letterSpacing: 1 },

  // Add item button
  addBtn: {
    backgroundColor: Colors.gold + '22', borderRadius: Radius.full,
    borderWidth: 1, borderColor: Colors.gold + '66',
    paddingHorizontal: Spacing.sm, paddingVertical: 2,
  },
  addBtnTxt: { fontSize: FontSize.xs, color: Colors.gold, fontWeight: FontWeight.bold },
  addItemRow: {
    paddingVertical: Spacing.sm, alignItems: 'center',
    borderTopWidth: 1, borderTopColor: Colors.border, marginTop: Spacing.xs,
  },

  // Item rows
  itemWrap: { borderBottomWidth: 1, borderBottomColor: Colors.border },
  itemRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: Spacing.sm, gap: Spacing.xs,
  },
  itemMain:  { flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  itemInfo:  { flex: 1 },
  itemName:  { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  itemProps: { fontSize: FontSize.xs, color: Colors.textDim, marginTop: 1, lineHeight: 14 },
  itemQty:   { fontSize: FontSize.sm, color: Colors.textSecondary },
  expandCaret: { fontSize: FontSize.xs, color: Colors.textDim, paddingHorizontal: 4 },
  itemDesc: {
    backgroundColor: Colors.surfaceHigh, borderRadius: Radius.sm,
    padding: Spacing.sm, marginBottom: Spacing.xs,
  },
  itemDescTxt: { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 20 },

  toggleBtn: {
    backgroundColor: Colors.surfaceHigh, borderRadius: Radius.md,
    paddingHorizontal: Spacing.sm, paddingVertical: 4,
    borderWidth: 1, borderColor: Colors.border,
  },
  toggleBtnEquipped: { borderColor: Colors.gold + '88', backgroundColor: Colors.gold + '22' },
  toggleTxt:         { fontSize: FontSize.sm, color: Colors.textSecondary },
  toggleTxtEquipped: { color: Colors.gold, fontWeight: FontWeight.bold },

  removeBtn: { padding: 4 },
  removeTxt: { fontSize: FontSize.md, color: Colors.textDim },

  emptyNote: { color: Colors.textDim, fontSize: FontSize.sm, fontStyle: 'italic' },
});
