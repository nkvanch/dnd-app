// app/dm/character/[id].tsx
// DM read-only character view with override controls on every stat.
// Mirrors the 6-tab sheet but the DM can't edit notes/inventory directly —
// instead they use the DM override system on every tappable stat.
import { useState, useCallback } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCharacterStore } from '../../../src/store/characterStore';
import { useCampaignStore }  from '../../../src/store/campaignStore';
import { useSessionStore }   from '../../../src/store/sessionStore';
import { recomputeDerived }  from '../../../src/engine/pipeline';
import { applyDamage, applyHealing, applyWildShapeDamage } from '../../../src/engine/combat';
import { applyCondition, removeCondition } from '../../../src/engine/conditions';
import { CONDITIONS_BY_ID } from '../../../src/content/conditions/index';
import { dmFullStatVisibility } from '../../../src/engine/houseRules';
import { Entity } from '../../../src/engine/types';
import { useSafeGoBack } from '../../../src/hooks/useSafeGoBack';
import { TabCharacter } from '../../../src/components/sheet/TabCharacter';
import { TabAbilities } from '../../../src/components/sheet/TabAbilities';
import { TabFeatures }  from '../../../src/components/sheet/TabFeatures';
import { TabActions }   from '../../../src/components/sheet/TabActions';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../../../src/theme';

type TabId = 'character' | 'actions' | 'abilities' | 'features';

const TABS: { id: TabId; label: string }[] = [
  { id: 'character',  label: 'Combat'    },
  { id: 'actions',    label: 'Actions'   },
  { id: 'abilities',  label: 'Abilities' },
  { id: 'features',   label: 'Features'  },
];

export default function DmCharacterView() {
  const { id }  = useLocalSearchParams<{ id: string }>();
  const router  = useRouter();
  const safeGoBack = useSafeGoBack('/(tabs)');
  const characters      = useCharacterStore(s => s.characters);
  const updateCharacter = useCharacterStore(s => s.updateCharacter);
  const rules           = useCharacterStore(s => s.rules);
  const campaignId = useCampaignStore(s => s.activeCampaign?.id ?? '');
  const deviceId   = useSessionStore(s => s.session?.deviceId ?? '');

  const entity     = characters.find(c => c.id === id);
  const [activeTab, setActiveTab] = useState<TabId>('character');
  // DM Override (the AuditModal, opened by tapping a stat box) is gated
  // behind the dmFullStatVisibility house rule — book default restricts the
  // DM to what they could reasonably observe (passive stats/HP/movement/AC,
  // handled on the dashboard) without full override capability. Damage,
  // healing, and condition controls below are NOT gated by this — those are
  // core GM tools needed to run the game regardless of the visibility rule.
  const showFull = dmFullStatVisibility(rules);

  const mutate = useCallback((updater: (e: Entity) => Entity, label?: string) => {
    if (!id) return;
    updateCharacter(id, e => recomputeDerived(updater(e), rules), label);
  }, [id, updateCharacter, rules]);

  if (!entity) {
    return (
      <View style={styles.screen}>
        <Pressable style={styles.backBtn} onPress={safeGoBack}>
          <Text style={styles.backTxt}>← Back</Text>
        </Pressable>
        <View style={styles.center}>
          <Text style={styles.errorTxt}>Character not found.</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={safeGoBack}>
          <Text style={styles.backTxt}>← Back</Text>
        </Pressable>
        <View style={styles.headerInfo}>
          <Text style={styles.charName}>{entity.identity.name || 'Unnamed'}</Text>
          <Text style={styles.charSub}>
            👑 DM View · Lv {entity.identity.level} {entity.identity.classId}
          </Text>
        </View>
        <View style={styles.hpPill}>
          <Text style={styles.hpPillTxt}>
            {entity.wildShapeState?.active
              ? `${entity.wildShapeState.beastHp}/${entity.wildShapeState.beastHpMax}`
              : `${entity.resources.hp.current}/${entity.resources.hp.maximum}`}
          </Text>
          <Text style={styles.hpPillLabel}>{entity.wildShapeState?.active ? 'Beast HP' : 'HP'}</Text>
        </View>
      </View>

      <View style={styles.tabBar}>
        {TABS.map(t => (
          <Pressable
            key={t.id}
            style={[styles.tabBtn, activeTab === t.id && styles.tabBtnActive]}
            onPress={() => setActiveTab(t.id)}
          >
            <Text style={[styles.tabTxt, activeTab === t.id && styles.tabTxtActive]}>
              {t.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.tabContent}>
        {activeTab === 'character' && (
          <TabCharacter
            entity={entity}
            rules={rules}
            isDm={showFull}
            campaignId={campaignId}
            deviceId={deviceId}
            // While Wild Shaped, damage/heal must hit the BEAST's hp pool, not
            // the player's real HP underneath — same rule app/sheet/[id].tsx's
            // own handleDamage/handleHeal already apply for player-side controls.
            onDamage={(amt, dt) => mutate(e => e.wildShapeState?.active
              ? applyWildShapeDamage(e, amt, rules)
              : applyDamage(e, amt, rules, dt), `Took ${amt}${dt ? ` ${dt}` : ''} damage`)}
            onHeal={amt => mutate(e => e.wildShapeState?.active ? e : applyHealing(e, amt, rules), `Healed ${amt}`)}
            onAddCondition={cId => mutate(e => applyCondition(e, cId, 'dm', rules), `DM: Added condition: ${CONDITIONS_BY_ID[cId]?.name ?? cId}`)}
            onRemoveCondition={cId => mutate(e => removeCondition(e, cId, rules), `DM: Removed condition: ${CONDITIONS_BY_ID[cId]?.name ?? cId}`)}
            onResourceChange={(rId, delta) => mutate(e => ({
              ...e,
              resources: {
                ...e.resources,
                custom: e.resources.custom.map(r =>
                  r.id === rId ? { ...r, current: Math.max(0, Math.min(r.maximum, r.current + delta)) } : r
                ),
              },
            }), `DM: ${delta > 0 ? 'Restored' : 'Spent'} ${entity.resources.custom.find(r => r.id === rId)?.name ?? rId}`)}
            onSpendSlot={tier => mutate(e => {
              if (!e.spellcasting) return e;
              const slot = e.spellcasting.slots[tier as keyof typeof e.spellcasting.slots];
              if (!slot || slot.used >= slot.total) return e;
              return { ...e, spellcasting: { ...e.spellcasting, slots: { ...e.spellcasting.slots, [tier]: { ...slot, used: slot.used + 1 } } } };
            }, `DM: Spent level ${tier} spell slot`)}
            onRestoreSlot={tier => mutate(e => {
              if (!e.spellcasting) return e;
              const slot = e.spellcasting.slots[tier as keyof typeof e.spellcasting.slots];
              if (!slot || slot.used <= 0) return e;
              return { ...e, spellcasting: { ...e.spellcasting, slots: { ...e.spellcasting.slots, [tier]: { ...slot, used: slot.used - 1 } } } };
            }, `DM: Restored level ${tier} spell slot`)}
            onEntityUpdate={updated => mutate(() => updated, 'DM: Character tab edit')}
          />
        )}
        {activeTab === 'actions'   && <TabActions   entity={entity} />}
        {activeTab === 'abilities' && (
          <TabAbilities
            entity={entity}
            rules={rules}
            isDm={showFull}
            campaignId={campaignId}
            deviceId={deviceId}
            onEntityUpdate={updated => mutate(() => updated, 'DM: Ability override')}
          />
        )}
        {activeTab === 'features'  && <TabFeatures entity={entity} />}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  errorTxt: { color: Colors.red, fontSize: FontSize.lg },
  header: {
    backgroundColor: Colors.surfaceHigh,
    paddingTop: Spacing.xl + 8, paddingBottom: Spacing.sm,
    paddingHorizontal: Spacing.md,
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  backBtn:     { paddingRight: Spacing.xs },
  backTxt:     { color: Colors.gold, fontSize: FontSize.md, fontWeight: FontWeight.bold },
  headerInfo:  { flex: 1 },
  charName:    { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  charSub:     { fontSize: FontSize.xs, color: Colors.gold, marginTop: 2 },
  hpPill: {
    backgroundColor: Colors.surface, borderRadius: Radius.md,
    paddingHorizontal: Spacing.sm, paddingVertical: 4, alignItems: 'center',
    borderWidth: 1, borderColor: Colors.border,
  },
  hpPillTxt:   { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.green },
  hpPillLabel: { fontSize: FontSize.xs, color: Colors.textDim },
  tabBar: {
    flexDirection: 'row', backgroundColor: Colors.surfaceHigh,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  tabBtn:       { flex: 1, paddingVertical: Spacing.sm, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabBtnActive: { borderBottomColor: Colors.gold },
  tabTxt:       { fontSize: FontSize.xs, color: Colors.textDim, fontWeight: FontWeight.bold },
  tabTxtActive: { color: Colors.gold },
  tabContent:   { flex: 1 },
});
