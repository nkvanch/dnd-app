// src/components/sheet/SwapChoicePanel.tsx
// "Replace one Edict you know" (and any other swappable feature_pool choice):
// pick a held option, then the option to swap it for. Enforces the per-level
// limit through the engine (swapPoolChoice returns the entity unchanged when
// refused, which this panel reports).
import { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Entity, CampaignRules, Feature } from '../../engine/types';
import { swapPoolChoice, swapsRemainingThisLevel } from '../../engine/leveling';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../../theme';

export function SwapChoicePanel({ entity, rules, onEntityUpdate }: { entity: Entity; rules?: CampaignRules; onEntityUpdate?: (e: Entity) => void }) {
  const [from, setFrom] = useState<{ choiceId: string; optionId: string } | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  if (!rules || !onEntityUpdate) return null;
  const groups = Array.from(new Set(entity.choices
    .filter(c => c.resolved && c.definition.kind === 'feature_pool' && c.definition.swappable)
    .map(c => c.definition.swappable!.group)));
  if (groups.length === 0) return null;

  return (
    <View style={styles.panel}>
      {groups.map(group => {
        const choices = entity.choices.filter(c => c.resolved && c.definition.kind === 'feature_pool' && c.definition.swappable?.group === group);
        const pool = Array.isArray(choices[0].definition.pool) ? choices[0].definition.pool : [];
        const known = new Set(entity.features.map(f => f.id));
        const left = swapsRemainingThisLevel(entity, group);
        const title = group.replace(/_/g, ' ').toUpperCase();
        return (
          <View key={group} style={{ gap: Spacing.xs }}>
            <Text style={styles.title}>REPLACE {title} ({left} swap{left === 1 ? '' : 's'} left this level)</Text>
            <Text style={styles.hint}>Each time you gain a level you may replace one you know. Tap the one to give up, then its replacement.</Text>
            <View style={styles.chips}>
              {choices.flatMap(c => c.selections.map(sel => ({ c, sel }))).map(({ c, sel }) => {
                const opt = pool.find(o => o.id === sel);
                const on = from?.optionId === sel;
                return (
                  <Pressable key={sel} style={[styles.chip, on && styles.chipOn]} onPress={() => { setMessage(null); setFrom(on ? null : { choiceId: c.id, optionId: sel }); }}>
                    <Text style={[styles.chipTxt, on && styles.chipTxtOn]}>{opt?.label ?? sel}</Text>
                  </Pressable>
                );
              })}
            </View>
            {from && (
              <>
                <Text style={styles.hint}>Replace with:</Text>
                <View style={styles.chips}>
                  {pool.filter(o => !known.has((o.value as Feature).id)).map(o => (
                    <Pressable key={o.id} style={styles.chip} onPress={() => {
                      const next = swapPoolChoice(entity, from.choiceId, from.optionId, o.id, rules);
                      if (next === entity) setMessage('That swap is not allowed right now (already swapped this level, or already known).');
                      else { onEntityUpdate(next); setFrom(null); setMessage(null); }
                    }}>
                      <Text style={styles.chipTxt}>{o.label}</Text>
                    </Pressable>
                  ))}
                </View>
              </>
            )}
            {message && <Text style={styles.warn}>{message}</Text>}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { backgroundColor: Colors.surface, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border, padding: Spacing.md, gap: Spacing.sm },
  title: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.gold, letterSpacing: 1 },
  hint: { fontSize: FontSize.xs, color: Colors.textDim, lineHeight: 16 },
  warn: { fontSize: FontSize.xs, color: Colors.red },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  chip: { backgroundColor: Colors.surfaceHigh, borderRadius: Radius.sm, paddingHorizontal: Spacing.sm, paddingVertical: 4, borderWidth: 1, borderColor: Colors.border },
  chipOn: { borderColor: Colors.gold, backgroundColor: Colors.gold + '22' },
  chipTxt: { fontSize: FontSize.xs, color: Colors.textSecondary },
  chipTxtOn: { color: Colors.gold, fontWeight: FontWeight.bold },
});
