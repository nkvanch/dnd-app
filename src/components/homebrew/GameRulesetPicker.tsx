// src/components/homebrew/GameRulesetPicker.tsx
// HOMEBREW-RULESET-1: the one Game/Ruleset authoring control every homebrew
// builder shares. Registry-driven (src/content/rulesets.ts) — never
// hardcodes D&D specifically, so a future non-D&D Game/Ruleset added to the
// registry is automatically offered here with zero changes to this file or
// any builder. Reuses FilterSection/FilterChipRow (src/components/
// FilterChipRow.tsx) — the same shared chip-row component Compendium/
// creation screens already use for their own (read-only-filter) Game/
// Ruleset rows — rather than inventing a second picker convention.
//
// Canonical identity is a single RulesetId | undefined value — Game is
// NEVER stored separately (matches rulesets.ts's own architecture: "A Game
// is never stored directly on content — only a RulesetId is... a content
// item's Game is always DERIVED by resolving its RulesetId through this
// registry"), so there is nothing else to persist or preserve alongside it.
//
// "Generic / Untagged" is offered as an explicit, named chip (not just "no
// selection") — item 1's requirement that the untagged state be a visible,
// deliberate choice rather than a silent default. Selecting a Game resets
// any previously-chosen Ruleset that no longer belongs to it, so an
// inconsistent (Ruleset, Game) pair can never be produced by this UI at all
// — the save-time validation this enables (item 11) is structural, not a
// separate runtime check bolted on afterward.
import { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { GameId, RulesetId } from '../../engine/types';
import { GAMES, RULESETS, gameIdForRuleset } from '../../content/rulesets';
import { FilterSection, FilterChipRow } from '../FilterChipRow';
import { Colors, Spacing, Radius, FontSize } from '../../theme';

const UNTAGGED = '__untagged__';

export function GameRulesetPicker({
  value, onChange, defaultGameId,
}: {
  value:    RulesetId | undefined;
  onChange: (v: RulesetId | undefined) => void;
  /** Context-sensitive default (item 2) — which Game's ruleset chips to
   *  show initially when `value` is untagged/unset. Purely a UI starting
   *  point; never overrides an already-set `value`. */
  defaultGameId?: GameId;
}) {
  // Degraded-state handling (item 11): `value` may be set to a rulesetId
  // this registry doesn't recognize (imported content, or a registry entry
  // later removed) — never silently clear or reinterpret it. `knownGameId`
  // is undefined in that case, same "can't derive a Game" signal
  // RulesetChangeModal already uses for a character's own unrecognized
  // ruleset.
  const valueKnown = value === undefined || RULESETS[value] !== undefined;
  const knownGameId = value !== undefined ? gameIdForRuleset(value) : undefined;
  const [selectedGameId, setSelectedGameId] = useState<GameId | undefined>(
    knownGameId ?? defaultGameId,
  );

  const gameOptions = Object.values(GAMES).map(g => ({ id: g.id, label: g.name }));
  const rulesetOptions = selectedGameId
    ? Object.values(RULESETS).filter(r => r.gameId === selectedGameId).map(r => ({ id: r.id, label: r.name }))
    : [];

  function handleGameChange(gameId: GameId | null) {
    setSelectedGameId(gameId ?? undefined);
    // Any previously-chosen ruleset almost certainly doesn't belong to the
    // newly-picked Game — reset to untagged rather than leaving a stale,
    // now-invalid pairing in place (this is what makes an inconsistent
    // (Ruleset, Game) save structurally impossible, per item 11).
    onChange(undefined);
  }

  return (
    <View style={styles.container}>
      {!valueKnown && (
        <Text style={styles.degradedBanner}>
          This content's ruleset ("{value}") isn't in the registry — preserved as-is. Pick a new one below to
          replace it, or leave it alone to keep editing in degraded mode.
        </Text>
      )}
      <FilterSection label="Game">
        <FilterChipRow
          options={gameOptions}
          value={selectedGameId ?? null}
          onChange={handleGameChange}
        />
      </FilterSection>
      {selectedGameId && (
        <FilterSection label="Ruleset">
          <FilterChipRow
            options={[{ id: UNTAGGED, label: 'Generic / Untagged' }, ...rulesetOptions]}
            value={value ?? (valueKnown ? UNTAGGED : null)}
            onChange={v => onChange(v === null || v === UNTAGGED ? undefined : v)}
            scrollable
          />
        </FilterSection>
      )}
      {!selectedGameId && (
        <Text style={styles.hint}>Pick a Game to choose a specific ruleset, or leave generic/untagged.</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: Spacing.xs },
  degradedBanner: {
    fontSize: FontSize.xs, color: Colors.gold, backgroundColor: Colors.surface,
    borderRadius: Radius.sm, padding: Spacing.sm, fontStyle: 'italic',
  },
  hint: { fontSize: FontSize.xs, color: Colors.textDim, fontStyle: 'italic' },
});
