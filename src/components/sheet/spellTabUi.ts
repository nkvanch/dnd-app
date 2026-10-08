// src/components/sheet/spellTabUi.ts
// Small, pure/UI-agnostic pieces shared by the Spells and Character tabs so
// both behave identically: the "End concentration" confirm dialog, and the
// label/availability rules that distinguish a spell-slot cast from a ritual.
import { Alert } from '../../utils/alert';

/**
 * Confirm-then-end for manual concentration. A tap on a small button next to
 * a live effect is easy to mis-hit mid-combat, and ending concentration also
 * removes the spell's linked effects, so it asks first — and says exactly
 * what will go away.
 */
export function confirmEndConcentration(
  spellName: string,
  linkedEffectNames: string[],
  onConfirm: () => void,
): void {
  const linked = linkedEffectNames.length > 0
    ? `This also ends: ${linkedEffectNames.join(', ')}.`
    : 'No other effects are linked to it.';
  Alert.alert(
    `End concentration on ${spellName}?`,
    `${linked} Use this when the concentration is broken, dispelled, or you decide it ended.`,
    [
      { text: 'Keep Concentrating', style: 'cancel' },
      { text: 'End Concentration', style: 'destructive', onPress: onConfirm },
    ],
  );
}

/**
 * Timeline/undo label for a cast. A ritual-capable spell can be paid two
 * different ways, so its history entry says which one was used: "(Ritual)"
 * or "(spell slot)". Spells that can't be ritual-cast keep the plain label —
 * there is nothing to distinguish.
 */
export function castHistoryLabel(opts: {
  name: string;
  castMode?: 'ritual';
  ritualCapable: boolean;
  baseLevel?: number;
  castLevel?: number;
  ordinal: (level: number) => string;
}): string {
  const { name, castMode, ritualCapable, baseLevel, castLevel, ordinal } = opts;
  if (castMode === 'ritual') return `Cast ${name} (Ritual)`;
  if (baseLevel && castLevel && castLevel > baseLevel) {
    return `Cast ${name} at ${ordinal(castLevel)} level${ritualCapable ? ' (spell slot)' : ''}`;
  }
  return ritualCapable ? `Cast ${name} (spell slot)` : `Cast ${name}`;
}

/**
 * Availability of the two cast buttons on a spell row. They are separate
 * because they have different requirements: the slot cast needs a slot (or a
 * one-off override), while the ritual cast spends no slot at all — so a
 * ritual-capable spell whose slots are all spent is still castable as a ritual.
 */
export function castButtonStates(card: {
  available: boolean;
  ritualEligible?: boolean;
  preparationOverridable?: boolean;
  incapacitatedOverridable?: boolean;
}): { slotCastDisabled: boolean; showRitual: boolean; rowDimmed: boolean } {
  const overridable = card.preparationOverridable === true || card.incapacitatedOverridable === true;
  const slotCastDisabled = !card.available && !overridable;
  const showRitual = card.ritualEligible === true;
  return { slotCastDisabled, showRitual, rowDimmed: slotCastDisabled && !showRitual };
}
