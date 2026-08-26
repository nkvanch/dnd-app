// src/components/sheet/CompanionSection.tsx
// Shows a player-owned companion (Steel Defender, Eldritch Cannon, etc.) on
// the OWNER's own sheet — its own HP/AC tracked independently, its own
// action cards, distinct from the owner's stats. Self-contained: reads/
// writes the companion Entity directly via useCharacterStore rather than
// being threaded through the sheet's prop chain, since a companion is just
// another normal entity in the same store (see src/engine/companion.ts).
import { useState, useMemo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Entity, CampaignRules } from '../../engine/types';
import { useCharacterStore } from '../../store/characterStore';
import { createCompanion, syncCompanionFromOwner } from '../../engine/companion';
import { COMPANION_TEMPLATES_BY_GRANT_FEATURE } from '../../content/companions';
import { applyDamage, applyHealing } from '../../engine/combat';
import { HpModal } from './HpModal';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../../theme';

export function CompanionSection({ owner, rules }: { owner: Entity; rules: CampaignRules }) {
  const characters = useCharacterStore(s => s.characters);
  const applyIncomingEntity = useCharacterStore(s => s.applyIncomingEntity);
  const [hpOpen, setHpOpen] = useState(false);

  // Which companion template(s) this owner currently has access to, keyed by
  // the id of the feature that grants them (see companions/index.ts's doc
  // comment) — an owner could in principle have more than one grant active
  // across their features, though in practice Artificer subclasses grant one.
  const availableGrants = useMemo(
    () => owner.features
      .filter(f => f.isActive && COMPANION_TEMPLATES_BY_GRANT_FEATURE[f.id])
      .map(f => COMPANION_TEMPLATES_BY_GRANT_FEATURE[f.id]),
    [owner.features],
  );

  const rawCompanion = characters.find(c => c.identity.companionOf === owner.id);
  // Re-derive level/ability-synced fields live for display — never trust a
  // stored snapshot once the owner may have leveled up since it was saved.
  const template = rawCompanion ? availableGrants.find(t => t.id === rawCompanion.identity.classId) : null;
  const companion = rawCompanion && template
    ? syncCompanionFromOwner(rawCompanion, owner, template, rules)
    : rawCompanion;

  if (availableGrants.length === 0) return null;

  function summon(templateId: string) {
    const tpl = availableGrants.find(t => t.id === templateId);
    if (!tpl) return;
    applyIncomingEntity(createCompanion(owner, tpl, rules));
  }

  function handleDamage(amount: number, damageType?: string) {
    if (!companion) return;
    applyIncomingEntity(applyDamage(companion, amount, rules, damageType));
  }
  function handleHeal(amount: number) {
    if (!companion) return;
    applyIncomingEntity(applyHealing(companion, amount, rules));
  }

  if (!companion) {
    return (
      <View style={styles.panel}>
        <Text style={styles.title}>🔧 Companion</Text>
        {availableGrants.map(t => (
          <Pressable key={t.id} style={styles.summonBtn} onPress={() => summon(t.id)}>
            <Text style={styles.summonTxt}>Summon {t.name}</Text>
          </Pressable>
        ))}
      </View>
    );
  }

  const hp = companion.resources.hp;
  // syncCompanionFromOwner() above already calls recomputeDerived(), which
  // computes actionCards as part of the same pass — reading it here avoids
  // a second, redundant generateAllActionCards() call on every render.
  const cards = companion.actionCards ?? [];

  return (
    <View style={styles.panel}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>🔧 {companion.identity.name}</Text>
        <Text style={styles.meta}>AC {companion.derived.ac}</Text>
      </View>
      <Pressable style={styles.hpRow} onPress={() => setHpOpen(true)}>
        <View style={styles.hpBarBg}>
          <View style={[styles.hpBarFill, { width: `${hp.maximum > 0 ? Math.max(0, Math.min(1, hp.current / hp.maximum)) * 100 : 0}%` }]} />
        </View>
        <Text style={styles.hpTxt}>{hp.current}/{hp.maximum} HP</Text>
      </Pressable>
      {cards.length > 0 && (
        <View style={styles.cardList}>
          {cards.map(c => (
            <View key={c.featureId} style={styles.cardRow}>
              <Text style={styles.cardName}>{c.name}</Text>
              <Text style={styles.cardL1}>{c.layer1}</Text>
              {c.layer2 ? <Text style={styles.cardL2}>{c.layer2}</Text> : null}
            </View>
          ))}
        </View>
      )}
      <HpModal
        visible={hpOpen}
        currentHp={hp.current}
        maxHp={hp.maximum}
        onDamage={handleDamage}
        onHeal={handleHeal}
        onClose={() => setHpOpen(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: Colors.surface, borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.border, padding: Spacing.md, gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.gold },
  meta:  { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: FontWeight.bold },

  summonBtn: {
    backgroundColor: Colors.surfaceHigh, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.gold + '66', padding: Spacing.sm, alignItems: 'center',
  },
  summonTxt: { color: Colors.gold, fontWeight: FontWeight.bold, fontSize: FontSize.sm },

  hpRow: { gap: 4 },
  hpBarBg: { height: 8, borderRadius: Radius.full, backgroundColor: Colors.surfaceHigh, overflow: 'hidden' },
  hpBarFill: { height: '100%', backgroundColor: Colors.green, borderRadius: Radius.full },
  hpTxt: { fontSize: FontSize.xs, color: Colors.textSecondary, fontWeight: FontWeight.bold },

  cardList: { gap: 6 },
  cardRow: {
    backgroundColor: Colors.surfaceHigh, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border, padding: Spacing.sm,
  },
  cardName: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  cardL1:   { fontSize: FontSize.xs, color: Colors.textDim, marginTop: 1 },
  cardL2:   { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 1 },
});
