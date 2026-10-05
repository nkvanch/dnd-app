// src/components/sheet/HeroicInspirationPanel.tsx
// Heroic Inspiration (2024 rules): a visible have / don't-have state with Gain and Spend. You can never hold
// more than one: gaining it while you have it is refused with the rule's own outcome (it is lost unless you
// give it to a player character who lacks it, which is what Give away records). Shown for 2024-ruleset
// characters, and for anyone who currently holds it.
import { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Entity } from '../../engine/types';
import { hasHeroicInspiration, gainHeroicInspiration, spendHeroicInspiration, grantsHeroicInspirationOnLongRest } from '../../engine/heroicInspiration';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../../theme';

export function showsHeroicInspiration(entity: Entity): boolean {
  return entity.rulesetId === 'dnd5e-2024' || hasHeroicInspiration(entity);
}

export function HeroicInspirationPanel({ entity, onEntityUpdate }: { entity: Entity; onEntityUpdate: (e: Entity) => void }) {
  const [note, setNote] = useState<string | null>(null);
  if (!showsHeroicInspiration(entity)) return null;
  const has = hasHeroicInspiration(entity);

  function gain() {
    const r = gainHeroicInspiration(entity);
    if (r.overflow) { setNote('You already have Heroic Inspiration. The extra one is lost unless you give it to a player character who lacks it.'); return; }
    setNote(null);
    onEntityUpdate(r.entity);
  }
  function spend(why: 'reroll' | 'give') {
    setNote(why === 'reroll' ? 'Spent: reroll any die immediately after rolling it, and use the new roll.' : 'Given away to another player character.');
    onEntityUpdate(spendHeroicInspiration(entity));
  }

  return (
    <View style={[styles.card, has && styles.cardOn]} accessibilityLabel={has ? 'Heroic Inspiration: you have it' : 'Heroic Inspiration: you do not have it'}>
      <View style={styles.head}>
        <View style={{ flex: 1 }}>
          <Text style={styles.kicker}>HEROIC INSPIRATION</Text>
          <Text style={[styles.title, has && styles.titleOn]}>{has ? '★ You have it' : 'None'}</Text>
        </View>
        {has ? (
          <View style={styles.btnRow}>
            <Pressable style={styles.btn} onPress={() => spend('reroll')} accessibilityLabel="Spend Heroic Inspiration to reroll a die">
              <Text style={styles.btnTxt}>Spend</Text>
            </Pressable>
            <Pressable style={styles.btnGhost} onPress={() => spend('give')} accessibilityLabel="Give Heroic Inspiration to another player">
              <Text style={styles.btnGhostTxt}>Give away</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable style={styles.btn} onPress={gain} accessibilityLabel="Gain Heroic Inspiration">
            <Text style={styles.btnTxt}>Gain</Text>
          </Pressable>
        )}
      </View>
      <Text style={styles.hint}>
        Expend it to reroll any die immediately after rolling it; you must use the new roll. You can never have more than one.
        {grantsHeroicInspirationOnLongRest(entity) ? ' Resourceful: you gain it whenever you finish a Long Rest.' : ''}
      </Text>
      {note && <Text style={styles.note}>{note}</Text>}
      {has && (
        <Pressable style={styles.gainAgain} onPress={gain} accessibilityLabel="Record gaining another Heroic Inspiration">
          <Text style={styles.gainAgainTxt}>Something gave me another one</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: Colors.surface, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, padding: Spacing.md, marginBottom: Spacing.md, gap: 6 },
  cardOn: { borderColor: Colors.gold },
  head: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  kicker: { color: Colors.textSecondary, fontSize: FontSize.xs, fontWeight: FontWeight.bold, letterSpacing: 1 },
  title: { color: Colors.textPrimary, fontSize: FontSize.lg, fontWeight: FontWeight.bold },
  titleOn: { color: Colors.gold },
  btnRow: { flexDirection: 'row', gap: Spacing.sm },
  btn: { backgroundColor: Colors.gold, borderRadius: Radius.sm, paddingVertical: 8, paddingHorizontal: Spacing.md },
  btnTxt: { color: Colors.bg, fontWeight: FontWeight.bold },
  btnGhost: { borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.sm, paddingVertical: 8, paddingHorizontal: Spacing.md },
  btnGhostTxt: { color: Colors.textPrimary, fontWeight: FontWeight.bold },
  hint: { color: Colors.textSecondary, fontSize: FontSize.sm },
  note: { color: Colors.textPrimary, fontSize: FontSize.sm },
  gainAgain: { alignSelf: 'flex-start', paddingVertical: 4 },
  gainAgainTxt: { color: Colors.textSecondary, fontSize: FontSize.sm, textDecorationLine: 'underline' },
});
