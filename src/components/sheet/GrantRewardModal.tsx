// src/components/sheet/GrantRewardModal.tsx
// Grants (or upgrades) a mid-campaign reward: a track of tiers such as Weight of Authority. Each tier
// is a set of homebrew Features tagged with `rewardTrack`; granting a higher tier REPLACES the lower
// ones (engine/rewardTracks.ts), so nothing stacks and no level-up or respec is involved.
import { useMemo } from 'react';
import { Modal, View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { Entity, CampaignRules, Feature } from '../../engine/types';
import { useHomebrewStore } from '../../store/homebrewStore';
import { grantRewardTier, currentRewardTier, rewardTiers } from '../../engine/rewardTracks';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../../theme';

interface Props {
  visible:   boolean;
  entity:    Entity;
  rules:     CampaignRules;
  onConfirm: (updated: Entity, label: string) => void;
  onCancel:  () => void;
}

const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V'];

export function GrantRewardModal({ visible, entity, rules, onConfirm, onCancel }: Props) {
  const features = useHomebrewStore(s => s.features);
  const tracks = useMemo(() => {
    const byTrack = new Map<string, { name: string; features: Feature[] }>();
    for (const f of features) {
      if (!f.rewardTrack) continue;
      const t = byTrack.get(f.rewardTrack.trackId) ?? { name: f.rewardTrack.trackName, features: [] };
      t.features.push(f);
      byTrack.set(f.rewardTrack.trackId, t);
    }
    return [...byTrack.entries()].map(([id, t]) => ({ id, ...t }));
  }, [features]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onCancel} />
        <View style={styles.sheet}>
          <Text style={styles.title}>Grant a Reward</Text>
          <Text style={styles.note}>
            A higher tier replaces the lower one instead of stacking with it. No level-up or rebuild needed.
          </Text>
          <ScrollView style={{ maxHeight: 420 }} contentContainerStyle={{ gap: Spacing.sm }}>
            {tracks.length === 0 && <Text style={styles.empty}>No reward tracks are available.</Text>}
            {tracks.map(track => {
              const held = currentRewardTier(entity, track.id);
              return (
                <View key={track.id} style={styles.card}>
                  <Text style={styles.cardTitle}>{track.name}</Text>
                  <Text style={styles.cardSub}>{held === 0 ? 'Not yet granted' : `Currently Tier ${ROMAN[held]}`}</Text>
                  {rewardTiers(track.features, track.id).map(tier => {
                    const tierFeatures = track.features.filter(f => f.rewardTrack!.tier === tier);
                    const main = tierFeatures[0];
                    const disabled = held >= tier;
                    return (
                      <Pressable
                        key={tier}
                        disabled={disabled}
                        style={[styles.tierBtn, disabled && styles.tierBtnDisabled]}
                        onPress={() => onConfirm(
                          grantRewardTier(entity, tierFeatures, rules),
                          `${held === 0 ? 'Granted' : 'Upgraded to'} ${track.name} Tier ${ROMAN[tier]}`,
                        )}
                      >
                        <Text style={styles.tierTxt}>Tier {ROMAN[tier]}{disabled ? (held === tier ? ' (current)' : '') : held === 0 ? ' - Grant' : ' - Upgrade'}</Text>
                        <Text style={styles.tierDesc} numberOfLines={3}>{main.name}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              );
            })}
          </ScrollView>
          <Pressable style={styles.closeBtn} onPress={onCancel}>
            <Text style={styles.closeTxt}>Close</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: '#000000cc', justifyContent: 'center', padding: Spacing.md },
  sheet: { backgroundColor: Colors.surfaceHigh, borderRadius: Radius.lg, padding: Spacing.md, gap: Spacing.sm },
  title: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.gold, textAlign: 'center' },
  note: { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center' },
  empty: { fontSize: FontSize.md, color: Colors.textDim, textAlign: 'center', paddingVertical: Spacing.md },
  card: { backgroundColor: Colors.surface, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, padding: Spacing.sm, gap: Spacing.xs },
  cardTitle: { fontSize: FontSize.md, color: Colors.textPrimary, fontWeight: FontWeight.bold },
  cardSub: { fontSize: FontSize.xs, color: Colors.textDim },
  tierBtn: { backgroundColor: Colors.surfaceHigh, borderRadius: Radius.sm, borderWidth: 1, borderColor: Colors.gold, padding: Spacing.sm },
  tierBtnDisabled: { opacity: 0.4, borderColor: Colors.border },
  tierTxt: { fontSize: FontSize.sm, color: Colors.gold, fontWeight: FontWeight.bold },
  tierDesc: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },
  closeBtn: { alignItems: 'center', padding: Spacing.sm },
  closeTxt: { color: Colors.textSecondary, fontSize: FontSize.md },
});
