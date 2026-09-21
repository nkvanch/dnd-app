// app/sheet/TabActions.tsx
// Tab 2 — Action Cards. [Use] consumes resources and shows a dice result modal.
import { useState, useCallback, useEffect, memo } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScrollView, View, Text, Pressable, StyleSheet, Modal } from 'react-native';
import { Entity, ActionCard, CampaignRules, ActivationOption } from '../../engine/types';
import { endWildShape } from '../../engine/combat';
import { getTriggeredFeatures, isFeatureAvailable } from '../../engine/actionCards';
import { applyActionCardUse } from '../../engine/actionUse';
import { useSpellPayment } from './SpellPaymentChooser';
import { doubleDiceCount } from '../../engine/dice';
import { useDiceLogStore } from '../../store/diceLogStore';
import { DiceRoll } from '../../engine/types';
import { ManualRollInput } from '../ManualRollInput';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../../theme';

export { applyActionCardUse } from '../../engine/actionUse';
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
  /** `crit` (item 11 — roll improvements): true when the player has toggled
   *  "Critical Hit" before rolling — the caller is responsible for doubling
   *  the dice portion (dice.ts's doubleDiceCount) before rolling, not this
   *  modal, since only the caller knows which expression is actually being
   *  rolled and how to log it. */
  onRoll:  (crit: boolean) => DiceRoll | null;
  onClose: () => void;
}

export function UseModal({ card, onRoll, onClose }: UseModalProps) {
  const insets = useSafeAreaInsets();
  const [result, setResult] = useState<DiceRoll | null>(null);
  const [crit, setCrit] = useState(false);

  // Reset the stored roll whenever the modal switches to a different card (or
  // closes). Without this, the previous spell's result lingers: the modal shows
  // a stale number and the `!result` guard hides the fresh Roll button, so a
  // different spell appears to "reuse" the last roll instead of rolling anew.
  const cardKey = card?.featureId ?? null;
  useEffect(() => {
    setResult(null);
    setCrit(false);
  }, [cardKey]);

  if (!card) return null;

  // Extract the primary dice expression from abilityEffects via layer2
  const diceExpr = card.layer2.match(/(\d+d\d+(?:[+-]\d+)?)/)?.[1] ?? null;

  function handleRoll() {
    setResult(onRoll(crit));
  }

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <Pressable style={[styles.modalSheet, { paddingBottom: Math.max(Spacing.lg, insets.bottom + Spacing.md) }]} onPress={e => e.stopPropagation()}>
          <View style={[styles.modalColorBar, { backgroundColor: CARD_COLORS[card.color] }]} />

          <Text style={styles.modalName}>{card.name}</Text>
          <Text style={styles.modalL1}>{card.layer1}</Text>
          <Text style={styles.modalL2}>{card.layer2}</Text>
          {card.layer3 ? <Text style={styles.modalL3}>{card.layer3}</Text> : null}
          {card.triggerNote ? <Text style={styles.modalOutcome}>{card.triggerNote}</Text> : null}
          {card.outcomes.map((line, i) => (
            <Text key={i} style={styles.modalOutcome}>{line}</Text>
          ))}

          {diceExpr && !result && (
            <View style={styles.rollPrompt}>
              <Pressable style={[styles.critToggle, crit && styles.critToggleActive]} onPress={() => setCrit(c => !c)}>
                <Text style={[styles.critToggleTxt, crit && styles.critToggleTxtActive]}>💥 Critical Hit</Text>
              </Pressable>
              <Text style={styles.rollExpr}>Roll: {crit ? doubleDiceCount(diceExpr) : diceExpr}</Text>
              <Pressable style={styles.rollBtn} onPress={handleRoll}>
                <Text style={styles.rollBtnTxt}>🎲 Roll</Text>
              </Pressable>
              <ManualRollInput expression={crit ? doubleDiceCount(diceExpr) : diceExpr} label={card.name} onSubmit={setResult} />
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

// ── Activation option picker (A-57) ────────────────────────────────────────────
// Shown BEFORE spending, when a card's activation declares multiple discrete
// ways to use it (e.g. Divine Smite's spell-slot tier choice). Picking an
// option is what triggers applyActionCardUse — see handleChooseOption above.

interface ActivationOptionModalProps {
  entity: Entity;
  card:     ActionCard | null;
  onChoose: (option: ActivationOption) => void;
  onClose:  () => void;
}

export function ActivationOptionModal({ entity, card, onChoose, onClose }: ActivationOptionModalProps) {
  if (!card || !card.activation.options || card.activation.options.length === 0) return null;
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <Pressable style={styles.modalSheet} onPress={e => e.stopPropagation()}>
          <Text style={styles.modalName}>{card.name}</Text>
          <Text style={styles.modalL1}>Choose how to use this:</Text>
          {card.activation.options.map(opt => (
            <Pressable key={opt.id} style={styles.optionRow}
              disabled={!isFeatureAvailable({ activation: { ...card.activation, options: undefined,
                resourceCost: opt.resourceCost ?? card.resourceCost } }, entity).available}
              onPress={() => onChoose(opt)}>
              <Text style={styles.optionLabel}>{opt.label}</Text>
              {opt.description && <Text style={styles.optionDesc}>{opt.description}</Text>}
            </Pressable>
          ))}
          <Pressable style={styles.closeBtn} onPress={onClose}>
            <Text style={styles.closeBtnTxt}>Cancel</Text>
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
        {card.triggerNote ? <Text style={styles.cardOutcome}>{card.triggerNote}</Text> : null}
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

// ── Triggered features (trigger text, but no activation — no card to show) ────
// Sneak Attack is the headline example: passive:true, no activation at all, so
// generateActionCard's own gate never produces a card for it. Same collapsed
// reference-list shape as UniversalActionsSection, but DYNAMIC — driven by the
// entity's own active features instead of a hardcoded list.

function TriggeredFeaturesSection({ entity }: { entity: Entity }) {
  const [open, setOpen] = useState(false);
  const triggered = getTriggeredFeatures(entity);
  if (triggered.length === 0) return null;
  return (
    <View style={styles.section}>
      <Pressable style={styles.universalHeader} onPress={() => setOpen(o => !o)}>
        <Text style={styles.sectionTitle}>TRIGGERED FEATURES</Text>
        <Text style={styles.universalChevron}>{open ? '▲' : '▼'}</Text>
      </Pressable>
      {open && triggered.map(f => (
        <View key={f.id} style={styles.universalRow}>
          <Text style={styles.universalName}>{f.name}</Text>
          <Text style={styles.universalBlurb}>{f.trigger}</Text>
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
  /** Closure item 16 — the one authoritative End Turn entry point, shared
   *  verbatim with the Character and Spells tabs (see app/sheet/[id].tsx's
   *  handleEndTurn). Optional only so this component doesn't hard-require
   *  it in contexts that never render the End Turn button. */
  onEndTurn?: () => void;
}

function TabActionsInner({ entity, rules, onEntityUpdate, onEndTurn }: Props) {
  const [activeCard, setActiveCard] = useState<ActionCard | null>(null);
  // A-57: set instead of activeCard when a card declares activation.options
  // — the picker must resolve BEFORE spending, since handleUse below
  // otherwise spends immediately on tap.
  const [pendingOptionCard, setPendingOptionCard] = useState<ActionCard | null>(null);

  const { requestPayment, paymentChooser } = useSpellPayment(entity);
  const all        = (entity.actionCards ?? []).filter(c => c.tabs.includes('actions'));
  const actions      = all.filter(c => c.activation.actionType === 'action');
  const bonusActions = all.filter(c => c.activation.actionType === 'bonus_action');
  const reactions    = all.filter(c => c.activation.actionType === 'reaction');
  // 'free' — usable alongside another action (e.g. a maneuver riding a normal
  // attack) rather than costing its own action/bonus action/reaction.
  const freeActions  = all.filter(c => c.activation.actionType === 'free');

  const handleUse = useCallback((card: ActionCard) => {
    if (card.activation.options && card.activation.options.length > 0) {
      setPendingOptionCard(card);
      return;
    }
    if (!onEntityUpdate || !rules) {
      // No update handler — just show the roll modal.
      setActiveCard(card);
      return;
    }
    // Always run applyActionCardUse, even for cost-less cards (cantrips,
    // at-will attacks) — it already no-ops correctly when there's nothing
    // to spend (see its own cost-branch), but a cost-less concentration
    // cantrip (True Strike, etc.) still needs the concentration-tracking
    // half to run, which previously never fired because this whole call
    // was gated on resourceCost being truthy.
    requestPayment(card, undefined, payment => {
      const updated = applyActionCardUse(entity, card, rules, undefined, payment);
      if (updated === entity) return;
      onEntityUpdate(updated);
      setActiveCard(card);
    });
  }, [entity, rules, onEntityUpdate, requestPayment]);

  const handleChooseOption = useCallback((option: ActivationOption) => {
    const card = pendingOptionCard;
    setPendingOptionCard(null);
    if (!card) return;
    requestPayment(card, option, payment => {
      if (!onEntityUpdate || !rules) return;
      const updated = applyActionCardUse(entity, card, rules, option, payment);
      if (updated === entity) return;
      onEntityUpdate(updated);
      setActiveCard(card);
    });
  }, [entity, rules, onEntityUpdate, pendingOptionCard, requestPayment]);

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

  function rollForCard(crit: boolean): DiceRoll | null {
    if (!activeCard) return null;
    const expr = activeCard.layer2.match(/(\d+d\d+(?:[+-]\d+)?)/)?.[1];
    if (!expr) return null;
    const finalExpr = crit ? doubleDiceCount(expr) : expr;
    // rollAndLog (not a bare rollExpression call) so a card roll shows up in
    // the same shared history as GlobalDiceRoller's — item 11 (roll
    // improvements): these used to be two disconnected roll logs.
    try { return useDiceLogStore.getState().rollAndLog(finalExpr, activeCard.name); }
    catch { return null; }
  }

  const isEmpty = all.length === 0;

  function handleRevert() {
    if (!rules || !onEntityUpdate) return;
    onEntityUpdate(endWildShape(entity, rules));
  }

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      {/* Closure item 16: calls the ONE shared onEndTurn handler
          (app/sheet/[id].tsx's handleEndTurn) instead of computing
          playerEndTurn() locally and routing it through this tab's own
          differently-labeled onEntityUpdate — guarantees identical
          timeline label/category/sync/undo behavior regardless of which
          tab End Turn is pressed from. No preview gate (advancing a turn
          is expected/mundane, not a surprising commit). */}
      {onEndTurn && (
        <Pressable
          style={styles.endTurnBtn}
          onPress={onEndTurn}
        >
          <Text style={styles.endTurnBtnTxt}>⏭ End Turn</Text>
        </Pressable>
      )}
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
      <TriggeredFeaturesSection entity={entity} />

      {paymentChooser}
      <UseModal
        card={activeCard}
        onRoll={rollForCard}
        onClose={() => setActiveCard(null)}
      />
      <ActivationOptionModal
        entity={entity}
        card={pendingOptionCard}
        onChoose={handleChooseOption}
        onClose={() => setPendingOptionCard(null)}
      />
    </ScrollView>
  );
}

// EDIT-PERF-1: see TabCharacter.tsx's identical comment.
export const TabActions = memo(TabActionsInner);

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

  endTurnBtn: {
    alignSelf: 'flex-start', marginBottom: Spacing.sm,
    backgroundColor: Colors.surface, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: Spacing.sm, paddingVertical: 6,
  },
  endTurnBtnTxt: { color: Colors.textSecondary, fontSize: FontSize.sm, fontWeight: FontWeight.bold },

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
  critToggle: {
    borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: Spacing.sm, paddingVertical: 4,
  },
  critToggleActive:    { borderColor: Colors.red, backgroundColor: Colors.red + '22' },
  critToggleTxt:        { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: FontWeight.bold },
  critToggleTxtActive:  { color: Colors.red },

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

  // Activation option picker (A-57)
  optionRow: {
    backgroundColor: Colors.surface, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border,
    padding: Spacing.sm,
  },
  optionLabel: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  optionDesc:  { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 2 },
});
