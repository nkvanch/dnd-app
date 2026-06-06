// app/sheet/TabFeatures.tsx
// Tab 4 — Features grouped by source, plus spells if applicable.
import { useState } from 'react';
import { ScrollView, View, Text, Pressable, StyleSheet, Modal } from 'react-native';
import { Entity, FeatureInstance, ActionCard } from '../../engine/types';
import { generateAllActionCards } from '../../engine/actionCards';
import { globalContentDB } from '../../content/classes/library';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../../theme';

const SOURCE_ORDER = ['race','class','subclass','background','feat','item','spell','condition','campaign'] as const;
const SOURCE_LABELS: Record<string, string> = {
  race: 'Race', class: 'Class', subclass: 'Subclass',
  background: 'Background', feat: 'Feat', item: 'Item',
  spell: 'Spell', condition: 'Condition', campaign: 'Campaign',
};

function FeatureRow({ feature }: { feature: FeatureInstance }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <Pressable style={styles.featureRow} onPress={() => setExpanded(e => !e)}>
      <View style={styles.featureHeader}>
        <Text style={styles.featureName}>{feature.name}</Text>
        <Text style={styles.featureChevron}>{expanded ? '▲' : '▼'}</Text>
      </View>
      {expanded && (
        <Text style={styles.featureDesc}>{feature.description}</Text>
      )}
    </Pressable>
  );
}

function SpellCardRow({ card }: { card: ActionCard }) {
  const [expanded, setExpanded] = useState(false);
  const spell = globalContentDB.spells.find(s => s.id === card.featureId);
  const borderColor = card.color === 'red' ? Colors.red : card.color === 'green' ? Colors.green : card.color === 'blue' ? Colors.blue : card.color === 'purple' ? Colors.purple : Colors.textDim;
  return (
    <Pressable style={[styles.spellCard, { borderLeftColor: borderColor }]} onPress={() => setExpanded(e => !e)}>
      <View style={styles.spellHeader}>
        <View style={styles.spellInfo}>
          <Text style={styles.spellName}>{card.name}</Text>
          <Text style={styles.spellL1}>{card.layer1}</Text>
          <Text style={styles.spellL2}>{card.layer2}</Text>
          {card.layer3 ? <Text style={styles.spellL3}>{card.layer3}</Text> : null}
        </View>
        <Text style={styles.featureChevron}>{expanded ? '▲' : '▼'}</Text>
      </View>
      {expanded && spell && (
        <View style={styles.spellExpanded}>
          <Text style={styles.spellDesc}>{spell.description}</Text>
          {spell.upcast && <Text style={styles.spellUpcast}>At Higher Levels: {spell.upcast}</Text>}
          <Text style={styles.spellMeta}>
            {spell.castingTime}  ·  {spell.range}  ·  {spell.duration}
          </Text>
          <Text style={styles.spellComponents}>Components: {spell.components.join(', ')}</Text>
        </View>
      )}
    </Pressable>
  );
}

function CollapsibleGroup({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <View style={styles.group}>
      <Pressable style={styles.groupHeader} onPress={() => setOpen(o => !o)}>
        <Text style={styles.groupTitle}>{title}</Text>
        <Text style={styles.featureChevron}>{open ? '▲' : '▼'}</Text>
      </Pressable>
      {open && <View style={styles.groupBody}>{children}</View>}
    </View>
  );
}

export function TabFeatures({ entity }: { entity: Entity }) {
  const { features, spellcasting, derived } = entity;

  // Group features by source kind
  const groups = new Map<string, FeatureInstance[]>();
  for (const f of features) {
    if (!f.isActive) continue;
    const kind = f.source.kind;
    if (!groups.has(kind)) groups.set(kind, []);
    groups.get(kind)!.push(f);
  }

  // Spell cards (prepared + known + cantrips)
  const spellCards = spellcasting
    ? generateAllActionCards(entity).filter(c => c.tabs.includes('spellcasting'))
    : [];

  const cantrips = spellCards.filter(c => {
    const sp = globalContentDB.spells.find(s => s.id === c.featureId);
    return sp?.level === 0;
  });
  const leveled = spellCards.filter(c => {
    const sp = globalContentDB.spells.find(s => s.id === c.featureId);
    return sp && sp.level > 0;
  });

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>

      {/* Feature groups */}
      {SOURCE_ORDER.filter(k => groups.has(k)).map(kind => (
        <CollapsibleGroup key={kind} title={SOURCE_LABELS[kind] ?? kind}>
          {groups.get(kind)!.map(f => <FeatureRow key={f.id} feature={f} />)}
        </CollapsibleGroup>
      ))}

      {/* Spellcasting section */}
      {spellcasting && (
        <CollapsibleGroup title="SPELLS">
          <View style={styles.spellMeta2}>
            <View style={styles.spellMetaPill}>
              <Text style={styles.spellMetaLabel}>Spell DC</Text>
              <Text style={styles.spellMetaValue}>{derived.spellSaveDC ?? '—'}</Text>
            </View>
            <View style={styles.spellMetaPill}>
              <Text style={styles.spellMetaLabel}>Attack</Text>
              <Text style={styles.spellMetaValue}>
                {derived.spellAttackBonus != null
                  ? (derived.spellAttackBonus >= 0 ? `+${derived.spellAttackBonus}` : String(derived.spellAttackBonus))
                  : '—'}
              </Text>
            </View>
            <View style={styles.spellMetaPill}>
              <Text style={styles.spellMetaLabel}>Ability</Text>
              <Text style={styles.spellMetaValue}>{spellcasting.ability.toUpperCase()}</Text>
            </View>
          </View>

          {/* Spell slots — all tiers that have slots, not just level 1 */}
          {(['1','2','3','4','5','6','7','8','9'] as const).some(t => spellcasting.slots[t]?.total > 0) && (
            <View style={styles.slotGrid}>
              {(['1','2','3','4','5','6','7','8','9'] as const).map(tier => {
                const slot = spellcasting.slots[tier];
                if (!slot || slot.total === 0) return null;
                return (
                  <View key={tier} style={styles.slotBlock}>
                    <Text style={styles.slotTier}>Lv {tier}</Text>
                    <View style={styles.slotPips}>
                      {Array.from({ length: slot.total }).map((_, i) => (
                        <View key={i} style={[styles.slotPip, i < slot.used && styles.slotPipUsed]} />
                      ))}
                    </View>
                    <Text style={styles.slotCount}>{slot.total - slot.used}/{slot.total}</Text>
                  </View>
                );
              })}
            </View>
          )}

          {cantrips.length > 0 && (
            <View style={styles.spellSubGroup}>
              <Text style={styles.spellSubTitle}>CANTRIPS</Text>
              {cantrips.map(c => <SpellCardRow key={c.featureId} card={c} />)}
            </View>
          )}
          {leveled.length > 0 && (
            <View style={styles.spellSubGroup}>
              <Text style={styles.spellSubTitle}>SPELLS</Text>
              {leveled.map(c => <SpellCardRow key={c.featureId} card={c} />)}
            </View>
          )}
          {spellCards.length === 0 && (
            <Text style={styles.emptyNote}>No spells prepared.</Text>
          )}
        </CollapsibleGroup>
      )}

      {features.filter(f => f.isActive).length === 0 && !spellcasting && (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>📜</Text>
          <Text style={styles.emptyTxt}>No features yet.</Text>
        </View>
      )}

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll:   { flex: 1 },
  content:  { padding: Spacing.md, gap: Spacing.sm, paddingBottom: Spacing.xxl },

  group: {
    backgroundColor: Colors.surface, borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.border, overflow: 'hidden',
  },
  groupHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: Spacing.md, backgroundColor: Colors.surfaceHigh,
  },
  groupTitle:    { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.gold, letterSpacing: 1 },
  groupBody:     { paddingHorizontal: Spacing.md, paddingBottom: Spacing.sm },
  featureChevron:{ fontSize: FontSize.xs, color: Colors.textDim },

  featureRow: {
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  featureHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  featureName:   { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.textPrimary, flex: 1 },
  featureDesc:   { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: Spacing.xs, lineHeight: 20 },

  spellMeta2: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.sm },
  spellMetaPill: {
    flex: 1, backgroundColor: Colors.surfaceHigh, borderRadius: Radius.md,
    padding: Spacing.sm, alignItems: 'center',
  },
  spellMetaLabel: { fontSize: FontSize.xs, color: Colors.textSecondary },
  spellMetaValue: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.blue },

  slotGrid:  { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md, marginBottom: Spacing.sm },
  slotBlock: { alignItems: 'center', gap: 4, minWidth: 48 },
  slotTier:  { fontSize: FontSize.xs, color: Colors.textSecondary, letterSpacing: 1 },
  slotPips:  { flexDirection: 'row', flexWrap: 'wrap', gap: 3, justifyContent: 'center' },
  slotPip:   { width: 10, height: 10, borderRadius: Radius.full, backgroundColor: Colors.blue },
  slotPipUsed: { backgroundColor: Colors.border },
  slotCount: { fontSize: FontSize.xs, color: Colors.textDim },

  spellSubGroup: { gap: Spacing.xs, marginBottom: Spacing.sm },
  spellSubTitle: { fontSize: FontSize.xs, color: Colors.textDim, letterSpacing: 2, marginBottom: 4 },

  spellCard: {
    backgroundColor: Colors.surfaceHigh, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border, borderLeftWidth: 3,
    padding: Spacing.sm, marginBottom: 4,
  },
  spellHeader:  { flexDirection: 'row', alignItems: 'flex-start' },
  spellInfo:    { flex: 1, gap: 2 },
  spellName:    { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  spellL1:      { fontSize: FontSize.xs, color: Colors.textDim },
  spellL2:      { fontSize: FontSize.sm, color: Colors.textSecondary },
  spellL3:      { fontSize: FontSize.xs, color: Colors.textDim, fontStyle: 'italic' },
  spellExpanded:{ marginTop: Spacing.sm, gap: Spacing.xs },
  spellDesc:    { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 20 },
  spellUpcast:  { fontSize: FontSize.sm, color: Colors.blue, lineHeight: 18 },
  spellMeta:    { fontSize: FontSize.xs, color: Colors.textDim },
  spellComponents:{ fontSize: FontSize.xs, color: Colors.textDim },

  emptyNote: { color: Colors.textDim, fontSize: FontSize.sm, fontStyle: 'italic', padding: Spacing.sm },
  empty:     { alignItems: 'center', gap: Spacing.sm, paddingTop: Spacing.xxl },
  emptyIcon: { fontSize: 48 },
  emptyTxt:  { fontSize: FontSize.lg, color: Colors.textSecondary },
});
