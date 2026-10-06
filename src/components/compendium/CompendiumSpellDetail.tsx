// src/components/compendium/CompendiumSpellDetail.tsx
// The expanded body of a spell row in the Compendium. Loads the full record (the browser only holds the index) and
// shows the version for the Compendium's ruleset filter: with 2024 selected, the SRD 5.2.1 text.
import { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { RulesetId, Spell } from '../../engine/types';
import { spellRepo } from '../../content/spellRepo';
import { spellDetail } from '../../content/spells/spellDetail';
import { Colors, FontSize, FontWeight } from '../../theme';

export function CompendiumSpellDetail({ spellId, rulesetId }: { spellId: string; rulesetId?: RulesetId | null }) {
  const [spell, setSpell] = useState<Spell | undefined>(() => spellRepo.getSpellSync(spellId, rulesetId));
  useEffect(() => {
    let live = true;
    spellRepo.ensureLoaded([spellId]).then(() => { if (live) setSpell(spellRepo.getSpellSync(spellId, rulesetId)); }).catch(() => {});
    return () => { live = false; };
  }, [spellId, rulesetId]);
  if (!spell) return null;
  const d = spellDetail(spell, rulesetId);
  return (
    <View style={styles.box}>
      {d.versionLabel && <Text style={styles.version}>{d.versionLabel}</Text>}
      {d.stats.map(s => <Text key={s.label} style={styles.stat}><Text style={styles.statLabel}>{s.label}: </Text>{s.value}</Text>)}
      <Text style={styles.desc}>{d.description}</Text>
      {!!d.upcast && <Text style={styles.desc}><Text style={styles.statLabel}>Using a higher-level spell slot: </Text>{d.upcast}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { gap: 4 },
  version: { fontSize: FontSize.xs, color: Colors.gold, fontWeight: FontWeight.bold, letterSpacing: 1 },
  stat: { fontSize: FontSize.sm, color: Colors.textSecondary },
  statLabel: { fontWeight: FontWeight.bold, color: Colors.textPrimary },
  desc: { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 18 },
});
