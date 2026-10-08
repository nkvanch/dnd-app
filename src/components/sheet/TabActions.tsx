// app/sheet/TabActions.tsx
// Tab 2 — Action Cards. [Use] consumes resources and shows a dice result modal.
import { useState, useCallback, useEffect, memo } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScrollView, View, Text, Pressable, StyleSheet, Modal } from 'react-native';
import { Entity, ActionCard, CampaignRules, ActivationOption, SpellCastingContext } from '../../engine/types';
import { endWildShape, endAttackSequence } from '../../engine/combat';
import { collectAllEffects } from '../../engine/pipeline';
import { getTriggeredFeatures, isFeatureAvailable, formatCastingContextLabel, CardGenOptions, isContextLegalForCastMode, needsPreparationOverride } from '../../engine/actionCards';
import { applyActionCardUse } from '../../engine/actionUse';
import { useSpellPayment } from './SpellPaymentChooser';
import { doubleDiceCount } from '../../engine/dice';
import { useDiceLogStore } from '../../store/diceLogStore';
import { DiceRoll } from '../../engine/types';
import { ManualRollInput } from '../ManualRollInput';
import { Alert } from '../../utils/alert';
import { useHomebrewStore } from '../../store/homebrewStore';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../../theme';

/**
 * Rules-engine blocker RE-AUDIT closure (dependency inversion, 1B/1D): the
 * ONE place this file resolves the authoritative merged official + homebrew
 * + active-ruleset content — the engine (actionCards.ts/actionUse.ts) never
 * reads useHomebrewStore itself; it's computed here, in the UI layer, and
 * passed down explicitly to every engine call that needs it. Called from
 * both ActionCardRow (the chooser's labels) and TabActionsInner (the actual
 * cast) — getMergedContentDB is internally memoized by its own inputs, so
 * this is one resolution, not two merge implementations.
 */
export function useCardContent(entity: Entity): Pick<CardGenOptions, 'classDefs' | 'homebrewSpells' | 'races' | 'items'> {
  const mergedContentDB = useHomebrewStore(s => s.getMergedContentDB(entity.rulesetId));
  return { classDefs: mergedContentDB.classes, homebrewSpells: mergedContentDB.spells, races: mergedContentDB.races, items: mergedContentDB.items };
}

export { applyActionCardUse } from '../../engine/actionUse';

type CardLike = Pick<ActionCard, 'featureId' | 'sourceKind' | 'sourceId'>;

/**
 * Item-identity closure (pass 3, finding G): the ONE canonical identity for
 * an ActionCard, used for React keys AND favorite matching/storage alike —
 * `featureId` alone collides whenever two owned instances of the same item
 * (or an item and Additional Equipment/another grant of it) both author the
 * same feature, since sourceKind/sourceId (see actionUse.ts's own
 * stale-card-rejection fix) are the only things that actually distinguish
 * them. Non-item cards (class/spell/race/synthetic) have no instance to
 * disambiguate, so their identity stays exactly `featureId` — unchanged
 * from every card's identity before this closure.
 */
export function actionCardIdentity(card: CardLike): string {
  return card.sourceKind === 'item' && card.sourceId ? `item:${card.sourceId}:${card.featureId}` : card.featureId;
}

/**
 * True if an action card is favorited — checks Entity.favoriteActionIds
 * first, for the card's exact modern identity (the primary mechanism,
 * works for ANY card: feature-backed, weapon-attack, spell-based, or
 * synthetic like Unarmed Strike). Item-identity closure (pass 3, finding
 * G): also accepts a bare `featureId` string (used by every pre-existing
 * caller and test that predates per-instance identity — a non-item card's
 * identity IS its featureId, so this is lossless for them) alongside the
 * narrow legacy-compatibility fallback below.
 *
 * For an ITEM card specifically, a bare `featureId` entry in
 * favoriteActionIds (written by toggleFavoriteTag before this closure, when
 * no instance-aware identity existed yet) is also honored — deliberately
 * BROADER matching than the modern identity, since that old entry can't
 * know which instance the player meant. This is intentional, documented
 * legacy compatibility, not a second source of truth: toggleFavoriteTag
 * below converts it away the first time ANY instance of that card is
 * toggled, so the ambiguity never persists past one interaction.
 */
export function isFavoriteCard(entity: Entity, card: string | CardLike): boolean {
  const featureId = typeof card === 'string' ? card : card.featureId;
  const identity   = typeof card === 'string' ? card : actionCardIdentity(card);
  const favorites = entity.favoriteActionIds ?? [];
  if (favorites.includes(identity)) return true;
  if (identity !== featureId && favorites.includes(featureId)) return true; // legacy item-card fallback
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
 *
 * Item-identity closure (pass 3, finding G): stores/removes the card's
 * exact modern identity (see actionCardIdentity), never a bare featureId
 * for an item card — favoriting instance A must never implicitly favorite
 * instance B merely because they share featureId. When turning OFF an item
 * card that's currently favorited via the legacy bare-featureId fallback
 * (isFavoriteCard's own doc comment), this also removes that bare entry —
 * the player just told this app "this is off," and leaving the shared
 * legacy entry in place would keep every OTHER same-feature instance lit
 * with no way to turn it off independently. This is the one place that
 * ambiguous legacy state gets resolved into the modern per-instance model.
 */
export function toggleFavoriteTag(entity: Entity, card: string | CardLike): Entity {
  const featureId = typeof card === 'string' ? card : card.featureId;
  const identity   = typeof card === 'string' ? card : actionCardIdentity(card);
  const current = entity.favoriteActionIds ?? [];
  if (isFavoriteCard(entity, card)) {
    return {
      ...entity,
      favoriteActionIds: current.filter(id => id !== identity && id !== featureId),
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
  return { ...entity, favoriteActionIds: [...current, identity] };
}

/**
 * Extra Attack sequence closure: a fresh, opaque correlation token for one
 * Attack-action sequence — see AttackSequenceUse's own doc comment
 * (types.ts) for why this never needs to be unguessable/cryptographic. It
 * only correlates this UI's own successive calls against the engine's own
 * authoritative entity.attackSequence record; it grants no authority by
 * itself.
 */
function generateSequenceId(): string {
  return `attack-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

const CARD_COLORS: Record<ActionCard['color'], string> = {
  red:    Colors.red,
  green:  Colors.green,
  blue:   Colors.blue,
  purple: Colors.purple,
  gray:   Colors.textDim,
};

/**
 * Rules-engine blocker RE-AUDIT closure (2F — activation-option context
 * preservation): the transient UI/application state for a cast that's
 * paused waiting on an activation-option choice. Codex found that choosing
 * a casting source (and/or a preparation Cast Anyway decision) BEFORE the
 * option picker opened was silently discarded — the old flow only
 * remembered the bare `card`, so `handleChooseOption` always executed with
 * bypassSpellPreparation/selectedSpellCastingContext both undefined,
 * re-prompting or wrongly blocking a cast the player had already resolved.
 * This is deliberately local component state, not persisted anywhere on
 * the character.
 */
type PendingActionUse = {
  card: ActionCard;
  bypassSpellPreparation?: boolean;
  selectedSpellCastingContext?: SpellCastingContext;
  /**
   * Rules-engine HIGH-batch closure (C7/C8): the SAME `bypassIncapacitated`
   * flag applyActionCardUse accepts (actionUse.ts) — carried alongside the
   * card exactly like bypassSpellPreparation above, so a "Use Anyway"
   * decision made before an activation-option picker opens survives into
   * handleChooseOption instead of being silently discarded (the same bug
   * class closure 2F already fixed for bypassSpellPreparation).
   */
  bypassIncapacitated?: boolean;
  /** Rules-completeness batch (ritual casting): the SAME `castMode`
   *  decision already made before the activation-option picker opened —
   *  carried alongside every other already-resolved decision here so it
   *  survives into handleChooseOption, exactly like bypassSpellPreparation/
   *  bypassIncapacitated above (same bug class those two already fixed). */
  castMode?: 'ritual';
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
  const cardKey = card ? actionCardIdentity(card) : null;
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
  /**
   * Rules-engine HIGH-batch closure (C7): the SAME `bypassIncapacitated`
   * decision the player already made (before this picker opened) —
   * threaded through so an option row isn't disabled a SECOND time by the
   * exact status restriction they already agreed to override. Never
   * bypasses a genuinely missing resource/payment for that option.
   */
  bypassIncapacitated?: boolean;
}

export function ActivationOptionModal({ entity, card, onChoose, onClose, bypassIncapacitated }: ActivationOptionModalProps) {
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
                resourceCost: opt.resourceCost ?? card.resourceCost } }, entity, bypassIncapacitated).available}
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
  /** Rules-engine blocker RE-AUDIT closure (1C) — needed to resolve the
   *  merged/ruleset-aware class list for the "Cast as..." chooser's labels
   *  (formatCastingContextLabel). */
  entity:  Entity;
  /**
   * Rules-engine blocker closure (1F — Quick Override on all normal cast
   * surfaces): the second param is the SAME `bypassSpellPreparation` flag
   * applyActionCardUse already accepts (actionUse.ts). The third param
   * (closure 1B/1D) is the EXACT SpellCastingContext the player is casting
   * through — passed straight to applyActionCardUse's own matching param.
   * The fourth param (HIGH batch, C4) is the SAME `bypassIncapacitated`
   * flag applyActionCardUse also accepts — "Use Anyway" for a card blocked
   * ONLY by 0HP/Unconscious. All optional so every existing non-spell
   * caller (a plain feature card's [Use]) is unaffected.
   */
  onUse:   (card: ActionCard, bypassSpellPreparation?: boolean, selectedSpellCastingContext?: SpellCastingContext, bypassIncapacitated?: boolean, castMode?: 'ritual') => void;
  /** Omit to hide the star entirely (not offered everywhere a card might render). */
  isFavorite?:       boolean;
  onToggleFavorite?: (card: ActionCard) => void;
}

/**
 * Rules-engine blocker closure (1F): Codex found an unprepared spell's card
 * on the Actions tab and on Favorites showed a hard-disabled "N/A" with no
 * Quick Override — table-first "Cast Anyway" (see TabSpells.tsx's own
 * identical prompt) only existed on the Spells tab. ActionCardRow is the
 * ONE component both of those surfaces already render through (TabActions'
 * own Section, and TabCharacter.tsx's Favorites section) — fixing it here
 * once covers every normal cast surface without a second/third
 * implementation, per the task's own "create/reuse one shared action-use
 * attempt path" requirement.
 *
 * `card.preparationOverridable` (see its own doc comment, types.ts) is true
 * ONLY when preparation is the entire reason a card is blocked — the button
 * stays enabled and labeled "Use" in that case (never "N/A"), and tapping
 * it prompts Cancel/Cast Anyway instead of calling onUse directly. Any
 * OTHER unavailability (no slot, action economy spent, ...) is unaffected:
 * still a hard-disabled "N/A", exactly as before.
 *
 * Rules-engine blocker RE-AUDIT closure (1C) — when the card carries 2+
 * MECHANICALLY DISTINCT casting sources (card.spellCastingContexts), tapping
 * Use shows a "Cast as..." chooser instead of silently picking one; a
 * deliberately-selected prep-blocked source still offers its own Cast
 * Anyway. Single-source spells (the overwhelming majority) and every
 * non-spell card skip this entirely.
 *
 * Rules-engine HIGH-batch closure (C): `card.incapacitatedOverridable` (see
 * its own doc comment, types.ts) is true ONLY when 0HP/Unconscious is the
 * entire remaining reason a card is blocked — same "stays enabled, prompts
 * Cancel/Use Anyway instead of a hard N/A" pattern as preparationOverridable
 * above, and the two compose independently (C7): a spell blocked by BOTH
 * preparation and status resolves the preparation decision first (via
 * castViaContext/the existing prompt below), then finalizeUse checks status
 * on top before actually calling onUse — so either, both, or neither
 * override can apply to one cast without one masking the other.
 */
export function ActionCardRow({ card, entity, onUse, isFavorite, onToggleFavorite }: CardRowProps) {
  const borderColor = CARD_COLORS[card.color];
  const blockedOnlyByPreparation = card.preparationOverridable === true;
  const blockedByIncapacitation = card.incapacitatedOverridable === true;
  const overridable = blockedOnlyByPreparation || blockedByIncapacitation;
  // Rules-completeness batch (ritual casting): a ritual-eligible spell is
  // never hard-disabled by a missing spell slot alone — ritual mode spends
  // none — so the row stays tappable and lets handlePress below offer the
  // ritual path even when card.available is false purely for that reason.
  // Execution (applyActionCardUse) revalidates ritual eligibility fresh
  // regardless, so this is a display-only relaxation, never a legality one.
  const genuinelyUnavailable = !card.available && !overridable && !card.ritualEligible;
  const cardContent = useCardContent(entity);

  // Rules-engine HIGH-batch closure (C4): the LAST step before actually
  // calling onUse — after any preparation decision is already resolved,
  // checks whether status (0HP/Unconscious) still needs its own one-off
  // "Use Anyway" on top. card.unavailableReason already carries the exact
  // "At 0 HP"/"Unconscious" text (see generateSpellCard/generateActionCard),
  // so the prompt always reflects the entity's real current state.
  //
  // `castMode` (rules-completeness batch — ritual casting) rides alongside
  // every other already-resolved decision (context, preparation override,
  // incapacitation override) all the way to onUse, exactly like
  // bypassSpellPreparation/context do — never a separate, parallel cast path.
  function finalizeUse(bypassSpellPreparation: boolean, context?: SpellCastingContext, castMode?: 'ritual') {
    if (blockedByIncapacitation) {
      Alert.alert(
        `${card.name}: ${card.unavailableReason ?? 'Incapacitated'}`,
        'Use it anyway as a one-off table ruling? This does not change HP, conditions, or death-save state.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Use Anyway', onPress: () => onUse(card, bypassSpellPreparation, context, true, castMode) },
        ],
      );
      return;
    }
    onUse(card, bypassSpellPreparation, context, undefined, castMode);
  }

  // Rules-completeness batch (ritual casting), one-issue closure: checks the
  // SELECTED context against the ACTUAL cast mode (isContextLegalForCastMode
  // — `ritualLegal` for a ritual attempt, `legal` for a normal one), never a
  // bare `context.legal` unconditionally — that was exactly the bug this
  // closure fixes (a legal Wizard-spellbook ritual was still prompting Cast
  // Anyway because the check never looked at castMode at all).
  // needsPreparationOverride further distinguishes "genuinely blocked by
  // preparation on a source that can cast this way at all" (offer the
  // override) from "this source has no ritual-casting capability
  // whatsoever" (silently decline — Cast Anyway can't fix that, and
  // applyActionCardUse refuses it unconditionally regardless).
  function castViaContext(context: SpellCastingContext, castMode?: 'ritual') {
    if (needsPreparationOverride(context, castMode)) {
      Alert.alert(
        `${card.name} is not prepared.`,
        'Cast it anyway as a one-off? This does not add it to your prepared list.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Cast Anyway', onPress: () => finalizeUse(true, context, castMode) },
        ],
      );
      return;
    }
    if (!isContextLegalForCastMode(context, castMode)) return; // ritual-incapable source — nothing to override, decline silently
    finalizeUse(false, context, castMode);
  }

  // Every decision that used to start directly at handlePress — context
  // choice, preparation override — now runs identically for BOTH a normal
  // cast and a ritual cast, just carrying `castMode` through unchanged.
  // Ritual does NOT bypass preparation on its own (see castMode's own doc
  // comment, actionUse.ts) — an unprepared ritual-eligible spell still
  // prompts the SAME Cast Anyway here, exactly like a normal cast — UNLESS
  // the SELECTED context's own `ritualLegal` says otherwise (a Wizard
  // ritual straight from the spellbook), checked live below rather than
  // via the static, generation-time, normal-legality-only
  // `blockedOnlyByPreparation` flag — the exact mismatch this closure fixes.
  function proceed(castMode?: 'ritual') {
    if (card.spellCastingContexts && card.spellCastingContexts.length > 1) {
      const classDefs = cardContent.classDefs;
      Alert.alert(
        `Cast ${card.name} as...`,
        undefined,
        [
          ...card.spellCastingContexts.map(ctx => ({
            text: formatCastingContextLabel(entity, ctx, classDefs),
            onPress: () => castViaContext(ctx, castMode),
          })),
          { text: 'Cancel', style: 'cancel' as const },
        ],
      );
      return;
    }
    const context = card.spellCastingContext;
    if (context) {
      castViaContext(context, castMode);
      return;
    }
    // No SpellCastingContext at all — a non-spell feature card, for which
    // `preparationOverridable`/ritual casting were never a concept in the
    // first place (see generateActionCard vs generateSpellCard). Unchanged.
    if (blockedOnlyByPreparation) {
      Alert.alert(
        `${card.name} is not prepared.`,
        'Cast it anyway as a one-off? This does not add it to your prepared list.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Cast Anyway', onPress: () => finalizeUse(true, undefined, castMode) },
        ],
      );
      return;
    }
    finalizeUse(false, undefined, castMode);
  }

  // Rules-completeness batch (ritual casting), A3: an explicit peer choice
  // — never a silent default to either mode — offered only when the spell
  // is actually ritual-capable through some source the character has.
  function handlePress() {
    if (card.ritualEligible) {
      Alert.alert(
        `Cast ${card.name} as...`,
        undefined,
        [
          { text: 'Cast Normally', onPress: () => proceed(undefined) },
          { text: 'Cast as Ritual (no slot, +10 min)', onPress: () => proceed('ritual') },
          { text: 'Cancel', style: 'cancel' as const },
        ],
      );
      return;
    }
    proceed(undefined);
  }

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
        style={[styles.useBtn, genuinelyUnavailable && styles.useBtnDisabled]}
        disabled={genuinelyUnavailable}
        onPress={handlePress}
      >
        <Text style={[styles.useBtnTxt, genuinelyUnavailable && styles.useBtnTxtDisabled]}>
          {card.available || overridable || card.ritualEligible ? 'Use' : 'N/A'}
        </Text>
      </Pressable>
    </View>
  );
}

// ── Section ───────────────────────────────────────────────────────────────────

function Section({ title, cards, entity, onUse, onToggleFavorite }: {
  title: string; cards: ActionCard[]; entity: Entity;
  onUse: (c: ActionCard, bypassSpellPreparation?: boolean, selectedSpellCastingContext?: SpellCastingContext, bypassIncapacitated?: boolean, castMode?: 'ritual') => void;
  onToggleFavorite?: (c: ActionCard) => void;
}) {
  if (cards.length === 0) return null;
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {cards.map(c => (
        <ActionCardRow
          key={actionCardIdentity(c)}
          card={c}
          entity={entity}
          onUse={onUse}
          isFavorite={isFavoriteCard(entity, c)}
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

/** Universal actions a feature/condition forbids: an effect on target `disable_action:<name>`
 *  (e.g. `disable_action:dash` from the Braced condition) with operation 'set' and a truthy value. */
function disabledUniversalActions(entity: Entity): Set<string> {
  const out = new Set<string>();
  for (const ae of collectAllEffects(entity)) {
    const e = ae.effect;
    if (e.operation === 'set' && e.value && e.target.startsWith('disable_action:')) {
      out.add(e.target.slice('disable_action:'.length).toLowerCase());
    }
  }
  return out;
}

function UniversalActionsSection({ entity }: { entity: Entity }) {
  const [open, setOpen] = useState(false);
  const disabled = disabledUniversalActions(entity);
  return (
    <View style={styles.section}>
      <Pressable style={styles.universalHeader} onPress={() => setOpen(o => !o)}>
        <Text style={styles.sectionTitle}>OTHER ACTIONS (ALWAYS AVAILABLE)</Text>
        <Text style={styles.universalChevron}>{open ? '▲' : '▼'}</Text>
      </Pressable>
      {open && UNIVERSAL_ACTIONS.map(a => (
        <View key={a.name} style={styles.universalRow}>
          <Text style={[styles.universalName, disabled.has(a.name.toLowerCase()) && { textDecorationLine: 'line-through', opacity: 0.6 }]}>{a.name}</Text>
          <Text style={styles.universalBlurb}>
            {disabled.has(a.name.toLowerCase()) ? "Unavailable right now — an active condition or feature forbids it." : a.blurb}
          </Text>
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
  // otherwise spends immediately on tap. Rules-engine blocker RE-AUDIT
  // closure 2F: carries the bypass/context decision ALONGSIDE the card, not
  // just the card alone — see PendingActionUse's own doc comment.
  const [pendingUse, setPendingUse] = useState<PendingActionUse | null>(null);
  // Extra Attack sequence closure: which attack of the CURRENT Attack action
  // sequence comes next, plus the opaque `sequenceId` token correlating every
  // call in this sequence — transient UI-only state, never persisted (the
  // character only ever records entity.attackSequence, the ENGINE's own
  // authoritative, transient record — see AttackSequenceState's doc comment,
  // types.ts). `attackNumber`/`totalAttacks` here are for DISPLAY only (which
  // Alert prompt to show next); they are never trusted by the engine — every
  // call still passes `{ sequenceId }` and the engine re-derives the real
  // count from entity.attackSequence itself (Part N: UI may display sequence
  // state, but engine/application validation enforces it independently).
  // Null whenever no sequence is in progress (the overwhelmingly common case
  // for a character without Extra Attack).
  const [attackSequence, setAttackSequence] = useState<{ sequenceId: string; totalAttacks: number; attackNumber: number } | null>(null);

  const { requestPayment, paymentChooser } = useSpellPayment(entity);
  const cardContent = useCardContent(entity);
  const all        = (entity.actionCards ?? []).filter(c => c.tabs.includes('actions'));
  const actions      = all.filter(c => c.activation.actionType === 'action');
  const bonusActions = all.filter(c => c.activation.actionType === 'bonus_action');
  const reactions    = all.filter(c => c.activation.actionType === 'reaction');
  // 'free' — usable alongside another action (e.g. a maneuver riding a normal
  // attack) rather than costing its own action/bonus action/reaction.
  const freeActions  = all.filter(c => c.activation.actionType === 'free');

  // Extra Attack / action-structure batch, Part C: the Attack action's own
  // attack opportunities are exactly the cards flagged isWeaponAttack (see
  // that field's own doc comment, types.ts) — never every 'action'-type
  // card (that would wrongly include e.g. Second Wind). Shown as a
  // dedicated "Attack (N attacks)" entry ONLY when the character actually
  // has more than the base 1 (attackActionAttacks — see DerivedStats' own
  // doc comment) AND owns at least one such attack right now; a character
  // without Extra Attack never sees this at all, and their individual
  // weapon-attack cards below are completely unaffected.
  const eligibleAttacks = actions.filter(c => c.isWeaponAttack);
  const attackActionCount = entity.derived.attackActionAttacks ?? 1;
  const showAttackAction = attackActionCount > 1 && eligibleAttacks.length > 0;
  const canStartAttackAction = eligibleAttacks.some(c => c.available || c.incapacitatedOverridable);

  // Part C5/C9: one Alert-style chooser per attack, mirroring this file's
  // existing "Cast as..." context-chooser convention exactly — no target
  // binding (this app never models targets on any card, so C9's "each
  // attack may pick its own target" is already true by construction: the
  // player just says who out loud at the table), no forced same-weapon
  // (C4: recomputed fresh every call, so attack 2 can pick a different
  // card than attack 1), and no auto-roll (C5: picking a card here only
  // resolves payment/economy — the roll/manual-entry UseModal below still
  // requires its own explicit tap, exactly like a standalone attack).
  //
  // Extra Attack sequence closure, Part O: "Done"/"Cancel" both call
  // closeSequence() — a no-op via endAttackSequence when nothing has
  // succeeded yet (Cancel before attack 1: entity.attackSequence was never
  // set), and an explicit close of the authoritative engine-side record
  // otherwise (Done after 1+ successful attacks) so a stale sequenceId can
  // never be resumed later in the same turn.
  function openAttackChooser(attackNumber: number, totalAttacks: number, sequenceId: string) {
    const eligible = actions.filter(c => c.isWeaponAttack);
    if (eligible.length === 0) { closeSequence(); return; }
    Alert.alert(
      `Attack ${attackNumber} of ${totalAttacks}`,
      undefined,
      [
        ...eligible.map(card => ({
          text: card.name,
          onPress: () => handleAttackChoice(card, attackNumber, totalAttacks, sequenceId),
        })),
        { text: attackNumber > 1 ? 'Done' : 'Cancel', style: 'cancel' as const, onPress: () => closeSequence() },
      ],
    );
  }

  function closeSequence() {
    setAttackSequence(null);
    if (!onEntityUpdate) return;
    const closed = endAttackSequence(entity);
    // endAttackSequence is a no-op (returns the same reference) when there
    // was nothing to close — e.g. Cancel before any attack succeeded — so
    // this never pushes a spurious no-op update, matching every other
    // caller's `if (updated === entity) return;` convention in this file.
    if (closed !== entity) onEntityUpdate(closed);
  }

  // Part C7/H: calls applyActionCardUse DIRECTLY (weapon attacks never
  // carry a spell-slot resourceCost, so useSpellPayment's chooser would
  // just call its commit callback immediately anyway) with the SAME
  // `sequenceId` token on every call of this sequence — the engine (not
  // this attackNumber param, which is display-only) decides whether this is
  // the paying lead attack or a bypass-eligible chained one, by matching the
  // token against entity.attackSequence (see applyActionCardUse's own doc
  // comment for the full authority model). Preserves Use Anyway (K13) for a
  // lead attack blocked only by incapacitation, and preserves item-instance
  // stale-attack rejection (H2/K14) via the exact same revalidation
  // applyActionCardUse already does for every card.
  function handleAttackChoice(card: ActionCard, attackNumber: number, totalAttacks: number, sequenceId: string, bypassIncapacitated?: boolean) {
    if (!onEntityUpdate || !rules) return;
    const updated = applyActionCardUse(entity, card, rules, undefined, undefined, undefined, undefined, cardContent, bypassIncapacitated, undefined, { sequenceId });
    if (updated === entity) {
      if (!bypassIncapacitated && card.incapacitatedOverridable) {
        Alert.alert(
          `${card.name}: ${card.unavailableReason ?? 'Incapacitated'}`,
          'Use it anyway as a one-off table ruling? This does not change HP, conditions, or death-save state.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Use Anyway', onPress: () => handleAttackChoice(card, attackNumber, totalAttacks, sequenceId, true) },
          ],
        );
        return;
      }
      // Stale/removed weapon (H2), an exhausted/rejected sequence, or some
      // other now-illegal attack — never retargets a different same-
      // definition instance; the player picks again or ends the sequence.
      // The already-spent Action (if this isn't the lead attack) is
      // unaffected either way, and the count never advanced (Part J).
      Alert.alert(`Can't use ${card.name}`, card.unavailableReason ?? 'That attack is no longer available.', [
        { text: 'Try Again', onPress: () => openAttackChooser(attackNumber, totalAttacks, sequenceId) },
        { text: 'End Attack Action', style: 'cancel', onPress: () => closeSequence() },
      ]);
      return;
    }
    onEntityUpdate(updated);
    setActiveCard(card); // same roll/manual-entry UseModal every standalone attack already uses
    // Part C6/C7/E: the NEXT prompt is driven by the engine's OWN post-use
    // record (updated.attackSequence), never a locally-incremented counter —
    // null means the engine itself closed the sequence (exhausted after this
    // attack), so the chooser simply doesn't reopen. This is what makes
    // "cancel before the first attack" spend nothing (this function is never
    // called at all) and "stop after attack 1 of 2" leave the Action spent
    // with the second opportunity discarded — never a second Action, never
    // forced completion.
    const active = updated.attackSequence;
    setAttackSequence(active ? { sequenceId, totalAttacks: active.maxAttacks, attackNumber: active.usedAttacks + 1 } : null);
  }

  // Part H: the roll/manual-entry modal closing is what advances to the
  // NEXT attack chooser (if any remain) — so the player sees their damage
  // result before being asked to pick the next attack, and a sequence with
  // no attacks left to make (or that was ended early via "Done"/"End
  // Attack Action") never reopens anything.
  function handleCloseUseModal() {
    setActiveCard(null);
    if (attackSequence) openAttackChooser(attackSequence.attackNumber, attackSequence.totalAttacks, attackSequence.sequenceId);
  }

  const handleUse = useCallback((card: ActionCard, bypassSpellPreparation?: boolean, selectedSpellCastingContext?: SpellCastingContext, bypassIncapacitated?: boolean, castMode?: 'ritual') => {
    if (card.activation.options && card.activation.options.length > 0) {
      // Rules-engine blocker RE-AUDIT closure 2F (extended, HIGH batch C7/C8):
      // preserve whatever source/Cast-Anyway/Use-Anyway decision
      // ActionCardRow already made (bypassSpellPreparation/
      // selectedSpellCastingContext/bypassIncapacitated/castMode), not just
      // the bare card — handleChooseOption below reads these back out once
      // the option is picked.
      setPendingUse({ card, bypassSpellPreparation, selectedSpellCastingContext, bypassIncapacitated, castMode });
      return;
    }
    if (!onEntityUpdate || !rules) {
      // No update handler — just show the roll modal.
      setActiveCard(card);
      return;
    }
    // Rules-completeness batch (ritual casting), A4: never request a slot
    // payment for a ritual cast — the chooser modal simply never opens.
    if (castMode === 'ritual') {
      const updated = applyActionCardUse(entity, card, rules, undefined, undefined, bypassSpellPreparation, selectedSpellCastingContext, cardContent, bypassIncapacitated, castMode);
      if (updated === entity) return;
      onEntityUpdate(updated);
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
      const updated = applyActionCardUse(entity, card, rules, undefined, payment, bypassSpellPreparation, selectedSpellCastingContext, cardContent, bypassIncapacitated);
      if (updated === entity) return;
      onEntityUpdate(updated);
      setActiveCard(card);
    });
  }, [entity, rules, onEntityUpdate, requestPayment, cardContent]);

  const handleChooseOption = useCallback((option: ActivationOption) => {
    const pending = pendingUse;
    setPendingUse(null);
    if (!pending) return;
    const { card, bypassSpellPreparation, selectedSpellCastingContext, bypassIncapacitated, castMode } = pending;
    if (!onEntityUpdate || !rules) return;
    if (castMode === 'ritual') {
      const updated = applyActionCardUse(entity, card, rules, option, undefined, bypassSpellPreparation, selectedSpellCastingContext, cardContent, bypassIncapacitated, castMode);
      if (updated === entity) return;
      onEntityUpdate(updated);
      setActiveCard(card);
      return;
    }
    requestPayment(card, option, payment => {
      const updated = applyActionCardUse(entity, card, rules, option, payment, bypassSpellPreparation, selectedSpellCastingContext, cardContent, bypassIncapacitated);
      if (updated === entity) return;
      onEntityUpdate(updated);
      setActiveCard(card);
    });
  }, [entity, rules, onEntityUpdate, pendingUse, requestPayment, cardContent]);

  const handleToggleFavorite = useCallback((card: ActionCard) => {
    if (onEntityUpdate) onEntityUpdate(toggleFavoriteTag(entity, card));
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
      {/* Extra Attack / action-structure batch, Part I: kept minimal — one
          entry, only when it's actually meaningful, no combat planner. */}
      {showAttackAction && (
        <Pressable
          style={[styles.attackActionBtn, !canStartAttackAction && styles.attackActionBtnDisabled]}
          disabled={!canStartAttackAction}
          onPress={() => openAttackChooser(1, attackActionCount, generateSequenceId())}
        >
          <Text style={styles.attackActionBtnTxt}>⚔️ Attack</Text>
          <Text style={styles.attackActionBtnSub}>{attackActionCount} attacks</Text>
        </Pressable>
      )}
      <Section title="ACTIONS"       cards={actions}      entity={entity} onUse={handleUse} onToggleFavorite={handleToggleFavorite} />
      <Section title="BONUS ACTIONS" cards={bonusActions} entity={entity} onUse={handleUse} onToggleFavorite={handleToggleFavorite} />
      <Section title="REACTIONS"     cards={reactions}    entity={entity} onUse={handleUse} onToggleFavorite={handleToggleFavorite} />
      <Section title="FREE (WITH ANOTHER ACTION)" cards={freeActions} entity={entity} onUse={handleUse} onToggleFavorite={handleToggleFavorite} />
      <UniversalActionsSection entity={entity} />
      <TriggeredFeaturesSection entity={entity} />

      {paymentChooser}
      <UseModal
        card={activeCard}
        onRoll={rollForCard}
        onClose={handleCloseUseModal}
      />
      <ActivationOptionModal
        entity={entity}
        card={pendingUse?.card ?? null}
        onChoose={handleChooseOption}
        onClose={() => setPendingUse(null)}
        bypassIncapacitated={pendingUse?.bypassIncapacitated}
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

  attackActionBtn: {
    flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between',
    backgroundColor: Colors.red, borderRadius: Radius.md,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
  },
  attackActionBtnDisabled: { opacity: 0.4 },
  attackActionBtnTxt: { color: Colors.white, fontSize: FontSize.md, fontWeight: FontWeight.bold },
  attackActionBtnSub: { color: Colors.white, fontSize: FontSize.sm },

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
