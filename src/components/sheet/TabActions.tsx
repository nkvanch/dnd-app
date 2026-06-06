// app/sheet/TabActions.tsx
// Tab 2 — Action Cards. [Use] consumes resources and shows a dice result modal.
import { useState, useCallback } from 'react';
import { ScrollView, View, Text, Pressable, StyleSheet, Modal } from 'react-native';
import { Entity, ActionCard, CampaignRules } from '../../engine/types';
import { generateAllActionCards } from '../../engine/actionCards';
import { rollExpression } from '../../engine/dice';
import { DiceRoll } from '../../engine/types';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../../theme';

const CARD_COLORS: Record<ActionCard['color'], string> = {
  red:    Colors.red,
  green:  Colors.green,
  blue:   Colors.blue,
  purple: Colors.purple,
  gray:   Colors.textDim,
};

// ── Use Result Modal ──────────────────────────────────────────────────────────

interface UseModalProps {
  card:    ActionCard | null;
  onRoll:  () => DiceRoll | null;
  onClose: () => void;
}

function UseModal({ card, onRoll, onClose }: UseModalProps) {
  const [result, setResult] = useState<DiceRoll | null>(null);

  if (!card) return null;

  // Extract the primary dice expression from abilityEffects via layer2
  const diceExpr = card.layer2.match(/(\d+d\d+(?:[+-]\d+)?)/)?.[1] ?? null;

  function handleRoll() {
    setResult(onRoll());
  }

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <Pressable style={styles.modalSheet} onPress={e => e.stopPropagation()}>
          <View style={[styles.modalColorBar, { backgroundColor: CARD_COLORS[card.color] }]} />

          <Text style={styles.modalName}>{card.name}</Text>
          <Text style={styles.modalL1}>{card.layer1}</Text>
          <Text style={styles.modalL2}>{card.layer2}</Text>
          {card.layer3 ? <Text style={styles.modalL3}>{card.layer3}</Text> : null}

          {diceExpr && !result && (
            <View style={styles.rollPrompt}>
              <Text style={styles.rollExpr}>Roll: {diceExpr}</Text>
              <Pressable style={styles.rollBtn} onPress={handleRoll}>
                <Text style={styles.rollBtnTxt}>🎲 Roll</Text>
              </Pressable>
            </View>
          )}

          {result && (
            <View style={styles.resultBox}>
              <Text style={styles.resultTotal}>{result.total}</Text>
              <Text style={styles.resultBreakdown}>
                [{result.rolls.join(', ')}]{result.modifier !== 0 ? ` + ${result.modifier}` : ''}
              </Text>
              <Text style={styles.resultExpr}>{result.expression}</Text>
            </View>
          )}

          <Pressable style={styles.closeBtn} onPress={onClose}>
            <Text style={styles.closeBtnTxt}>Done</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ── Action Card Row ───────────────────────────────────────────────────────────

interface CardRowProps {
  card:    ActionCard;
  onUse:   (card: ActionCard) => void;
}

function ActionCardRow({ card, onUse }: CardRowProps) {
  const borderColor = CARD_COLORS[card.color];
  return (
    <View style={[styles.card, { borderLeftColor: borderColor }]}>
      <View style={styles.cardBody}>
        <Text style={styles.cardName}>{card.name}</Text>
        <Text style={styles.cardL1}>{card.layer1}</Text>
        <Text style={styles.cardL2}>{card.layer2}</Text>
        {card.layer3 ? <Text style={styles.cardL3}>{card.layer3}</Text> : null}
        {!card.available && card.unavailableReason && (
          <Text style={styles.cardUnavail}>{card.unavailableReason}</Text>
        )}
      </View>
      <Pressable
        style={[styles.useBtn, !card.available && styles.useBtnDisabled]}
        disabled={!card.available}
        onPress={() => onUse(card)}
      >
        <Text style={[styles.useBtnTxt, !card.available && styles.useBtnTxtDisabled]}>
          {card.available ? 'Use' : 'N/A'}
        </Text>
      </Pressable>
    </View>
  );
}

// ── Section ───────────────────────────────────────────────────────────────────

function Section({ title, cards, onUse }: {
  title: string; cards: ActionCard[]; onUse: (c: ActionCard) => void
}) {
  if (cards.length === 0) return null;
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {cards.map(c => <ActionCardRow key={c.featureId} card={c} onUse={onUse} />)}
    </View>
  );
}

// ── Tab Actions ───────────────────────────────────────────────────────────────

interface Props {
  entity:       Entity;
  rules?:       CampaignRules;
  onEntityUpdate?: (updated: Entity) => void;
}

export function TabActions({ entity, rules, onEntityUpdate }: Props) {
  const [activeCard, setActiveCard] = useState<ActionCard | null>(null);

  const all        = generateAllActionCards(entity).filter(c => c.tabs.includes('actions'));
  const actions      = all.filter(c => c.activation.actionType === 'action');
  const bonusActions = all.filter(c => c.activation.actionType === 'bonus_action');
  const reactions    = all.filter(c => c.activation.actionType === 'reaction');

  const handleUse = useCallback((card: ActionCard) => {
    if (!onEntityUpdate || !rules) {
      // No update handler — just show the roll modal
      setActiveCard(card);
      return;
    }

    const cost = card.resourceCost;
    if (!cost) {
      setActiveCard(card);
      return;
    }

    // Consume the resource, then open the result modal
    let updated = entity;

    if (cost.resourceId === 'spell_slots') {
      if (!updated.spellcasting) return;
      const tier = String(cost.spellSlotTier ?? 1) as keyof typeof updated.spellcasting.slots;
      const slot = updated.spellcasting.slots[tier];
      if (!slot || slot.used >= slot.total) return;
      updated = {
        ...updated,
        spellcasting: {
          ...updated.spellcasting,
          slots: {
            ...updated.spellcasting.slots,
            [tier]: { ...slot, used: slot.used + 1 },
          },
        },
      };
    } else {
      const res = updated.resources.custom.find(r => r.id === cost.resourceId);
      if (!res || res.current < cost.quantity) return;
      updated = {
        ...updated,
        resources: {
          ...updated.resources,
          custom: updated.resources.custom.map(r =>
            r.id === cost.resourceId
              ? { ...r, current: Math.max(0, r.current - cost.quantity) }
              : r
          ),
        },
      };
    }

    onEntityUpdate(updated);
    setActiveCard(card);
  }, [entity, rules, onEntityUpdate]);

  function rollForCard(): DiceRoll | null {
    if (!activeCard) return null;
    const expr = activeCard.layer2.match(/(\d+d\d+(?:[+-]\d+)?)/)?.[1];
    if (!expr) return null;
    try { return rollExpression(expr, activeCard.name); }
    catch { return null; }
  }

  const isEmpty = all.length === 0;

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      {isEmpty && (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>⚔️</Text>
          <Text style={styles.emptyTxt}>No action cards yet.</Text>
          <Text style={styles.emptySubTxt}>Level up or learn spells to unlock abilities.</Text>
        </View>
      )}
      <Section title="ACTIONS"       cards={actions}      onUse={handleUse} />
      <Section title="BONUS ACTIONS" cards={bonusActions} onUse={handleUse} />
      <Section title="REACTIONS"     cards={reactions}    onUse={handleUse} />

      <UseModal
        card={activeCard}
        onRoll={rollForCard}
        onClose={() => setActiveCard(null)}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll:  { flex: 1 },
  content: { padding: Spacing.md, gap: Spacing.md, paddingBottom: Spacing.xxl },

  section:      { gap: Spacing.sm },
  sectionTitle: { fontSize: FontSize.xs, color: Colors.textSecondary, letterSpacing: 2, fontWeight: FontWeight.bold },

  card: {
    backgroundColor: Colors.surface, borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.border, borderLeftWidth: 4,
    padding: Spacing.md, flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
  },
  cardBody:    { flex: 1, gap: 3 },
  cardName:    { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  cardL1:      { fontSize: FontSize.xs, color: Colors.textDim },
  cardL2:      { fontSize: FontSize.sm, color: Colors.textSecondary },
  cardL3:      { fontSize: FontSize.xs, color: Colors.textDim, fontStyle: 'italic' },
  cardUnavail: { fontSize: FontSize.xs, color: Colors.red, marginTop: 2 },

  useBtn:            { backgroundColor: Colors.gold, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm },
  useBtnDisabled:    { backgroundColor: Colors.surfaceHigh, borderWidth: 1, borderColor: Colors.border },
  useBtnTxt:         { color: Colors.bg, fontWeight: FontWeight.bold, fontSize: FontSize.sm },
  useBtnTxtDisabled: { color: Colors.textDim },

  empty:      { alignItems: 'center', gap: Spacing.sm, paddingTop: Spacing.xxl },
  emptyIcon:  { fontSize: 48 },
  emptyTxt:   { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textSecondary },
  emptySubTxt:{ fontSize: FontSize.sm, color: Colors.textDim },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: '#000000bb', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: Colors.surfaceHigh,
    borderTopLeftRadius: Radius.lg, borderTopRightRadius: Radius.lg,
    padding: Spacing.lg, gap: Spacing.sm, overflow: 'hidden',
  },
  modalColorBar: { position: 'absolute', top: 0, left: 0, right: 0, height: 4 },
  modalName: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.textPrimary, marginTop: 4 },
  modalL1:   { fontSize: FontSize.xs, color: Colors.textDim },
  modalL2:   { fontSize: FontSize.sm, color: Colors.textSecondary },
  modalL3:   { fontSize: FontSize.xs, color: Colors.textDim, fontStyle: 'italic' },

  rollPrompt:  { backgroundColor: Colors.surface, borderRadius: Radius.md, padding: Spacing.md, alignItems: 'center', gap: Spacing.sm },
  rollExpr:    { fontSize: FontSize.lg, color: Colors.textPrimary, fontWeight: FontWeight.bold },
  rollBtn:     { backgroundColor: Colors.gold, borderRadius: Radius.md, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm },
  rollBtnTxt:  { color: Colors.bg, fontWeight: FontWeight.bold, fontSize: FontSize.md },

  resultBox: {
    backgroundColor: Colors.surface, borderRadius: Radius.lg,
    padding: Spacing.md, alignItems: 'center', gap: Spacing.xs,
    borderWidth: 1, borderColor: Colors.gold + '66',
  },
  resultTotal:     { fontSize: 48, fontWeight: FontWeight.bold, color: Colors.gold },
  resultBreakdown: { fontSize: FontSize.md, color: Colors.textSecondary },
  resultExpr:      { fontSize: FontSize.xs, color: Colors.textDim },

  closeBtn:    { backgroundColor: Colors.surface, borderRadius: Radius.md, padding: Spacing.sm, alignItems: 'center', marginTop: Spacing.xs },
  closeBtnTxt: { color: Colors.textSecondary, fontSize: FontSize.md },
});
