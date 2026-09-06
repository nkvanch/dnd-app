// app/sheet/TabActions.tsx
// Tab 2 — Action Cards. [Use] consumes resources and shows a dice result modal.
import { useState, useCallback, useEffect } from 'react';
import { ScrollView, View, Text, Pressable, StyleSheet, Modal } from 'react-native';
import { Entity, ActionCard, CampaignRules } from '../../engine/types';
import { applyAbilityEffects, endWildShape } from '../../engine/combat';
import { recomputeDerived } from '../../engine/pipeline';
import { rollExpression } from '../../engine/dice';
import { DiceRoll } from '../../engine/types';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../../theme';

/**
 * Spends a card's resource cost and applies its abilityEffects (set_flag,
 * transform, restore_resource, etc.) — the mutation half of "Use", pulled
 * out of TabActions' own handleUse so the Combat tab's FAVORITES section
 * can reuse the exact same logic instead of re-implementing resource
 * spending. Returns the entity unchanged if the cost can't be paid (caller
 * should check card.available before calling this, same as the Use button
 * already does via its disabled state).
 */
export function applyActionCardUse(entity: Entity, card: ActionCard, rules: CampaignRules): Entity {
  let updated = entity;
  const cost = card.resourceCost;

  if (cost) {
    if (cost.resourceId === 'spell_slots') {
      if (!updated.spellcasting) return entity;
      const tier = String(cost.spellSlotTier ?? 1) as keyof typeof updated.spellcasting.slots;
      const slot = updated.spellcasting.slots[tier];
      if (!slot || slot.used >= slot.total) return entity;
      updated = {
        ...updated,
        spellcasting: {
          ...updated.spellcasting,
          slots: { ...updated.spellcasting.slots, [tier]: { ...slot, used: slot.used + 1 } },
        },
      };
    } else {
      const res = updated.resources.custom.find(r => r.id === cost.resourceId);
      if (!res || res.current < cost.quantity) return entity;
      updated = {
        ...updated,
        resources: {
          ...updated.resources,
          custom: updated.resources.custom.map(r =>
            r.id === cost.resourceId ? { ...r, current: Math.max(0, r.current - cost.quantity) } : r
          ),
        },
      };
    }
  }

  // Look in both entity.features and equipped-item features since either
  // can produce an action card.
  const sourceFeature =
    updated.features.find(f => f.id === card.featureId) ??
    updated.inventory.equipped.flatMap(inst => inst.features).find(f => f.id === card.featureId);
  if (sourceFeature?.abilityEffects && sourceFeature.abilityEffects.length > 0) {
    updated = applyAbilityEffects(updated, sourceFeature.abilityEffects, rules);
  }

  return recomputeDerived(updated, rules);
}

/**
 * True if an action card is favorited — checks Entity.favoriteActionIds
 * first (the primary mechanism, works for ANY card: feature-backed,
 * weapon-attack, spell-based, or synthetic like Unarmed Strike), falling
 * back to a legacy true Feature.favoriteTag for characters saved before
 * favoriteActionIds existed (that field only ever got set on Feature-backed
 * cards, since spell/synthetic cards had no way to be favorited before this
 * fix — see favoriteActionIds' doc comment in types.ts).
 */
export function isFavoriteCard(entity: Entity, featureId: string): boolean {
  if ((entity.favoriteActionIds ?? []).includes(featureId)) return true;
  const f = entity.features.find(x => x.id === featureId)
    ?? entity.inventory.equipped.flatMap(inst => inst.features).find(x => x.id === featureId);
  return f?.favoriteTag === true;
}

/**
 * Toggles an Actions-tab favorite star (surfaces on Combat tab's FAVORITES
 * section when on). Writes to Entity.favoriteActionIds, NOT the underlying
 * Feature — that only worked for feature-backed cards, silently no-op'ing
 * for spell-based cards (ActionCard.featureId is a spell id, no Feature
 * with that id exists) and synthetic cards like Unarmed Strike (no backing
 * Feature at all). Toggling off also clears a legacy Feature.favoriteTag if
 * present, so switching off a pre-migration favorite actually turns it off
 * rather than isFavoriteCard's fallback keeping it lit.
 */
export function toggleFavoriteTag(entity: Entity, featureId: string): Entity {
  const current = entity.favoriteActionIds ?? [];
  if (isFavoriteCard(entity, featureId)) {
    return {
      ...entity,
      favoriteActionIds: current.filter(id => id !== featureId),
      features: entity.features.map(f => f.id === featureId ? { ...f, favoriteTag: false } : f),
      inventory: {
        ...entity.inventory,
        equipped: entity.inventory.equipped.map(inst => ({
          ...inst,
          features: inst.features.map(f => f.id === featureId ? { ...f, favoriteTag: false } : f),
        })),
      },
    };
  }
  return { ...entity, favoriteActionIds: [...current, featureId] };
}

const CARD_COLORS: Record<ActionCard['color'], string> = {
  red:    Colors.red,
  green:  Colors.green,
  blue:   Colors.blue,
  purple: Colors.purple,
  gray:   Colors.textDim,
};

// ── Use Result Modal ──────────────────────────────────────────────────────────

export interface UseModalProps {
  card:    ActionCard | null;
  onRoll:  () => DiceRoll | null;
  onClose: () => void;
}

export function UseModal({ card, onRoll, onClose }: UseModalProps) {
  const [result, setResult] = useState<DiceRoll | null>(null);

  // Reset the stored roll whenever the modal switches to a different card (or
  // closes). Without this, the previous spell's result lingers: the modal shows
  // a stale number and the `!result` guard hides the fresh Roll button, so a
  // different spell appears to "reuse" the last roll instead of rolling anew.
  const cardKey = card?.featureId ?? null;
  useEffect(() => {
    setResult(null);
  }, [cardKey]);

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
          {card.outcomes.map((line, i) => (
            <Text key={i} style={styles.modalOutcome}>{line}</Text>
          ))}

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
  /** Omit to hide the star entirely (not offered everywhere a card might render). */
  isFavorite?:       boolean;
  onToggleFavorite?: (card: ActionCard) => void;
}

export function ActionCardRow({ card, onUse, isFavorite, onToggleFavorite }: CardRowProps) {
  const borderColor = CARD_COLORS[card.color];
  return (
    <View style={[styles.card, { borderLeftColor: borderColor }]}>
      {onToggleFavorite && (
        <Pressable hitSlop={8} onPress={() => onToggleFavorite(card)}>
          <Text style={[styles.star, isFavorite && styles.starActive]}>{isFavorite ? '★' : '☆'}</Text>
        </Pressable>
      )}
      <View style={styles.cardBody}>
        <Text style={styles.cardName}>{card.name}</Text>
        <Text style={styles.cardL1}>{card.layer1}</Text>
        <Text style={styles.cardL2}>{card.layer2}</Text>
        {card.layer3 ? <Text style={styles.cardL3}>{card.layer3}</Text> : null}
        {card.outcomes.map((line, i) => (
          <Text key={i} style={styles.cardOutcome}>{line}</Text>
        ))}
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

function Section({ title, cards, onUse, favoriteIds, onToggleFavorite }: {
  title: string; cards: ActionCard[]; onUse: (c: ActionCard) => void;
  favoriteIds?: Set<string>; onToggleFavorite?: (c: ActionCard) => void;
}) {
  if (cards.length === 0) return null;
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {cards.map(c => (
        <ActionCardRow
          key={c.featureId}
          card={c}
          onUse={onUse}
          isFavorite={favoriteIds?.has(c.featureId)}
          onToggleFavorite={onToggleFavorite}
        />
      ))}
    </View>
  );
}

// ── Universal actions (always available, no class/resource involved) ──────────
// Every creature can take these on its turn regardless of class or level — the
// app has no Feature/resource driving them (there's nothing to "spend"), so
// they never show up as actionCards the way spells/class features do. Purely
// a reference list, collapsed by default since it's rarely-needed reminder
// text rather than something reached for every turn.

const UNIVERSAL_ACTIONS: { name: string; blurb: string }[] = [
  { name: 'Dash', blurb: "Gain extra movement for the turn, equal to your speed." },
  { name: 'Disengage', blurb: "Your movement doesn't provoke opportunity attacks for the rest of the turn." },
  { name: 'Dodge', blurb: 'Until your next turn, attacks against you have disadvantage if you can see the attacker, and you have advantage on Dexterity saves.' },
  { name: 'Help', blurb: 'Aid an ally on a task, granting advantage on their next check for it, or on their next attack against a creature within 5 feet of you.' },
  { name: 'Hide', blurb: 'Make a Stealth check to try to become unseen and unheard.' },
  { name: 'Ready', blurb: 'Prepare to act later this round — choose a trigger, then use your reaction to take the readied action when it happens.' },
  { name: 'Search', blurb: "Devote your full attention to finding something, usually with a Perception or Investigation check." },
  { name: 'Use an Object', blurb: 'Interact with a second object or feature of the environment this turn, beyond the one free interaction you already get.' },
];

function UniversalActionsSection() {
  const [open, setOpen] = useState(false);
  return (
    <View style={styles.section}>
      <Pressable style={styles.universalHeader} onPress={() => setOpen(o => !o)}>
        <Text style={styles.sectionTitle}>OTHER ACTIONS (ALWAYS AVAILABLE)</Text>
        <Text style={styles.universalChevron}>{open ? '▲' : '▼'}</Text>
      </Pressable>
      {open && UNIVERSAL_ACTIONS.map(a => (
        <View key={a.name} style={styles.universalRow}>
          <Text style={styles.universalName}>{a.name}</Text>
          <Text style={styles.universalBlurb}>{a.blurb}</Text>
        </View>
      ))}
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

  const all        = (entity.actionCards ?? []).filter(c => c.tabs.includes('actions'));
  const actions      = all.filter(c => c.activation.actionType === 'action');
  const bonusActions = all.filter(c => c.activation.actionType === 'bonus_action');
  const reactions    = all.filter(c => c.activation.actionType === 'reaction');
  // 'free' — usable alongside another action (e.g. a maneuver riding a normal
  // attack) rather than costing its own action/bonus action/reaction.
  const freeActions  = all.filter(c => c.activation.actionType === 'free');

  const handleUse = useCallback((card: ActionCard) => {
    if (!onEntityUpdate || !rules || !card.resourceCost) {
      // No update handler, or nothing to spend — just show the roll modal.
      setActiveCard(card);
      return;
    }
    onEntityUpdate(applyActionCardUse(entity, card, rules));
    setActiveCard(card);
  }, [entity, rules, onEntityUpdate]);

  const favoriteIds = new Set([
    ...(entity.favoriteActionIds ?? []),
    // Legacy fallback for characters saved before favoriteActionIds existed
    // — see isFavoriteCard's doc comment.
    ...entity.features.filter(f => f.favoriteTag).map(f => f.id),
    ...entity.inventory.equipped.flatMap(inst => inst.features).filter(f => f.favoriteTag).map(f => f.id),
  ]);
  const handleToggleFavorite = useCallback((card: ActionCard) => {
    if (onEntityUpdate) onEntityUpdate(toggleFavoriteTag(entity, card.featureId));
  }, [entity, onEntityUpdate]);

  function rollForCard(): DiceRoll | null {
    if (!activeCard) return null;
    const expr = activeCard.layer2.match(/(\d+d\d+(?:[+-]\d+)?)/)?.[1];
    if (!expr) return null;
    try { return rollExpression(expr, activeCard.name); }
    catch { return null; }
  }

  const isEmpty = all.length === 0;

  function handleRevert() {
    if (!rules || !onEntityUpdate) return;
    onEntityUpdate(endWildShape(entity, rules));
  }

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      {entity.wildShapeState?.active && (
        <View style={styles.wildShapeBanner}>
          <View style={{ flex: 1 }}>
            <Text style={styles.wildShapeBannerTitle}>🐾 Wild Shape Active</Text>
            <Text style={styles.wildShapeBannerSub}>
              Beast HP: {entity.wildShapeState.beastHp}/{entity.wildShapeState.beastHpMax}
            </Text>
          </View>
          <Pressable style={styles.revertBtn} onPress={handleRevert}>
            <Text style={styles.revertBtnTxt}>Revert</Text>
          </Pressable>
        </View>
      )}
      {isEmpty && (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>⚔️</Text>
          <Text style={styles.emptyTxt}>No action cards yet.</Text>
          <Text style={styles.emptySubTxt}>Level up or learn spells to unlock abilities.</Text>
        </View>
      )}
      <Section title="ACTIONS"       cards={actions}      onUse={handleUse} favoriteIds={favoriteIds} onToggleFavorite={handleToggleFavorite} />
      <Section title="BONUS ACTIONS" cards={bonusActions} onUse={handleUse} favoriteIds={favoriteIds} onToggleFavorite={handleToggleFavorite} />
      <Section title="REACTIONS"     cards={reactions}    onUse={handleUse} favoriteIds={favoriteIds} onToggleFavorite={handleToggleFavorite} />
      <Section title="FREE (WITH ANOTHER ACTION)" cards={freeActions} onUse={handleUse} favoriteIds={favoriteIds} onToggleFavorite={handleToggleFavorite} />
      <UniversalActionsSection />

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

  universalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 2 },
  universalChevron: { fontSize: FontSize.xs, color: Colors.textDim },
  universalRow: {
    backgroundColor: Colors.surface, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border,
    padding: Spacing.sm, marginTop: Spacing.xs, gap: 2,
  },
  universalName:   { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  universalBlurb:  { fontSize: FontSize.xs, color: Colors.textSecondary, lineHeight: 17 },

  card: {
    backgroundColor: Colors.surface, borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.border, borderLeftWidth: 4,
    padding: Spacing.md, flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
  },
  star:       { fontSize: FontSize.lg, color: Colors.textDim },
  starActive: { color: Colors.gold },
  cardBody:    { flex: 1, gap: 3 },
  cardName:    { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  cardL1:      { fontSize: FontSize.xs, color: Colors.textDim },
  cardL2:      { fontSize: FontSize.sm, color: Colors.textSecondary },
  cardL3:      { fontSize: FontSize.xs, color: Colors.textDim, fontStyle: 'italic' },
  cardOutcome: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 1 },
  cardUnavail: { fontSize: FontSize.xs, color: Colors.red, marginTop: 2 },

  useBtn:            { backgroundColor: Colors.gold, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm },
  useBtnDisabled:    { backgroundColor: Colors.surfaceHigh, borderWidth: 1, borderColor: Colors.border },
  useBtnTxt:         { color: Colors.bg, fontWeight: FontWeight.bold, fontSize: FontSize.sm },
  useBtnTxtDisabled: { color: Colors.textDim },

  empty:      { alignItems: 'center', gap: Spacing.sm, paddingTop: Spacing.xxl },
  emptyIcon:  { fontSize: 48 },
  emptyTxt:   { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textSecondary },
  emptySubTxt:{ fontSize: FontSize.sm, color: Colors.textDim },

  wildShapeBanner: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    backgroundColor: Colors.purple + '18', borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.purple + '66',
    padding: Spacing.md,
  },
  wildShapeBannerTitle: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.purple },
  wildShapeBannerSub:   { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 2 },
  revertBtn: { backgroundColor: Colors.purple, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm },
  revertBtnTxt: { color: Colors.white, fontWeight: FontWeight.bold, fontSize: FontSize.sm },

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
  modalOutcome: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 1 },

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
