// app/sheet/[id].tsx
// Character sheet — 6-tab sheet with persistent rest bar.
// All values read from entity.derived — never computed in components.
import { useState, useCallback } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCharacterStore, DEFAULT_RULES } from '../../src/store/characterStore';
import { useCampaignStore } from '../../src/store/campaignStore';
import { useSessionStore }  from '../../src/store/sessionStore';
import { recomputeDerived } from '../../src/engine/pipeline';
import { applyDamage, applyHealing } from '../../src/engine/combat';
import { applyCondition, removeCondition } from '../../src/engine/conditions';
import { takeRest } from '../../src/engine/rest';
import { expireOverrides } from '../../src/engine/dmOverride';
import { Entity } from '../../src/engine/types';
import { ALL_ITEMS } from '../../src/content/items/index';
import { CONDITIONS_BY_ID } from '../../src/content/conditions/index';
import { TabCharacter } from '../../src/components/sheet/TabCharacter';
import { TabActions }   from '../../src/components/sheet/TabActions';
import { TabAbilities } from '../../src/components/sheet/TabAbilities';
import { TabFeatures }  from '../../src/components/sheet/TabFeatures';
import { TabInventory } from '../../src/components/sheet/TabInventory';
import { TabNotes }     from '../../src/components/sheet/TabNotes';
import { GlobalDiceRoller } from '../../src/components/GlobalDiceRoller';
import { SyncStatusDot }   from '../../src/components/SyncStatusDot';
import { SafeBottomView }  from '../../src/components/SafeBottomView';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../../src/theme';

type TabId = 'character' | 'actions' | 'abilities' | 'features' | 'inventory' | 'notes';

const TABS: { id: TabId; label: string }[] = [
  { id: 'character',  label: 'Combat'     },
  { id: 'actions',    label: 'Actions'    },
  { id: 'abilities',  label: 'Abilities'  },
  { id: 'features',   label: 'Features'   },
  { id: 'inventory',  label: 'Inventory'  },
  { id: 'notes',      label: 'Notes'      },
];

export default function CharacterSheetScreen() {
  const { id }   = useLocalSearchParams<{ id: string }>();
  const router   = useRouter();
  // Individual selectors — never object literals, which create a new reference every render
  // and trigger React's useSyncExternalStore infinite-loop guard.
  const characters      = useCharacterStore(s => s.characters);
  const updateCharacter = useCharacterStore(s => s.updateCharacter);
  const rules           = useCharacterStore(s => s.rules);
  const isDm        = useCampaignStore(s => s.isDm);
  const campaignId  = useCampaignStore(s => s.activeCampaign?.id ?? '');
  const deviceId    = useSessionStore(s => s.session?.deviceId ?? '');

  const entity = characters.find(c => c.id === id);
  const [activeTab, setActiveTab] = useState<TabId>('character');

  const mutate = useCallback((updater: (e: Entity) => Entity) => {
    if (!id) return;
    updateCharacter(id, e => {
      const updated = updater(e);
      return recomputeDerived(updated, rules);
    });
  }, [id, updateCharacter, rules]);

  if (!entity) {
    return (
      <View style={styles.screen}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backTxt}>← Back</Text>
        </Pressable>
        <View style={styles.center}>
          <Text style={styles.errorTxt}>Character not found.</Text>
        </View>
      </View>
    );
  }

  const { identity, resources, derived } = entity;

  // Header stat colours
  const hpPct   = resources.hp.maximum > 0
    ? resources.hp.current / resources.hp.maximum : 0;
  const hpColor = hpPct > 0.5 ? Colors.green : hpPct > 0.25 ? Colors.gold : Colors.red;

  // ── Handlers (all pure engine calls → mutate) ─────────────────────────────

  const handleDamage = useCallback((amount: number) => {
    mutate(e => applyDamage(e, amount, rules));
  }, [mutate, rules]);

  const handleHeal = useCallback((amount: number) => {
    mutate(e => applyHealing(e, amount, rules));
  }, [mutate, rules]);

  const handleAddCondition = useCallback((condId: string) => {
    // Look up the condition's mechanical features from content so the engine
    // can enforce them (e.g. Grappled sets speed to 0 in the pipeline).
    const condContent = CONDITIONS_BY_ID[condId];
    mutate(e => applyCondition(e, condId, 'manual', rules, condContent?.features));
  }, [mutate, rules]);

  const handleRemoveCondition = useCallback((condId: string) => {
    mutate(e => removeCondition(e, condId, rules));
  }, [mutate, rules]);

  const handleResourceChange = useCallback((resourceId: string, delta: number) => {
    mutate(e => ({
      ...e,
      resources: {
        ...e.resources,
        custom: e.resources.custom.map(r =>
          r.id === resourceId
            ? { ...r, current: Math.max(0, Math.min(r.maximum, r.current + delta)) }
            : r
        ),
      },
    }));
  }, [mutate]);

  const handleSpendSlot = useCallback((tier: string) => {
    mutate(e => {
      if (!e.spellcasting) return e;
      const slot = e.spellcasting.slots[tier as keyof typeof e.spellcasting.slots];
      if (!slot || slot.used >= slot.total) return e;
      return {
        ...e,
        spellcasting: {
          ...e.spellcasting,
          slots: {
            ...e.spellcasting.slots,
            [tier]: { ...slot, used: slot.used + 1 },
          },
        },
      };
    });
  }, [mutate]);

  const handleRestoreSlot = useCallback((tier: string) => {
    mutate(e => {
      if (!e.spellcasting) return e;
      const slot = e.spellcasting.slots[tier as keyof typeof e.spellcasting.slots];
      if (!slot || slot.used <= 0) return e;
      return {
        ...e,
        spellcasting: {
          ...e.spellcasting,
          slots: {
            ...e.spellcasting.slots,
            [tier]: { ...slot, used: slot.used - 1 },
          },
        },
      };
    });
  }, [mutate]);

  const handleEquip = useCallback((itemId: string) => {
    mutate(e => {
      const inst = e.inventory.carried.find(i => i.itemId === itemId);
      if (!inst) return e;
      // Hydrate features from the content definition at equip time.
      // Inventory instances are created with `features: []` (resolveChoice and
      // the equipment screen only store the itemId) — without this, equipping
      // armor adds an item with zero effects and AC never changes.
      const def      = ALL_ITEMS.find(i => i.id === itemId);
      const hydrated = def ? { ...inst, features: def.features } : inst;
      return {
        ...e,
        inventory: {
          ...e.inventory,
          carried:  e.inventory.carried.filter(i => i.itemId !== itemId),
          equipped: [...e.inventory.equipped, hydrated],
        },
      };
    });
  }, [mutate]);

  const handleUnequip = useCallback((itemId: string) => {
    mutate(e => {
      const inst = e.inventory.equipped.find(i => i.itemId === itemId);
      if (!inst) return e;
      return {
        ...e,
        inventory: {
          ...e.inventory,
          equipped: e.inventory.equipped.filter(i => i.itemId !== itemId),
          carried:  [...e.inventory.carried, inst],
        },
      };
    });
  }, [mutate]);

  const handleSaveNotes = useCallback((notes: string) => {
    mutate(e => ({ ...e, notes }));
  }, [mutate]);

  const handleRest = useCallback((kind: 'short' | 'long') => {
    mutate(e => {
      let updated = takeRest(e, kind, rules);
      // Long rest also expires 'end_of_session' DM overrides
      if (kind === 'long') updated = expireOverrides(updated, 'end_of_session', rules);
      return updated;
    });
  }, [mutate, rules]);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <View style={styles.screen}>

      {/* Header — name + always-visible HP / AC / Speed */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Pressable style={styles.backBtn} onPress={() => router.back()}>
            <Text style={styles.backTxt}>← Back</Text>
          </Pressable>
          <Text style={styles.charName} numberOfLines={1}>
            {identity.name || 'Unnamed'}
          </Text>
          <SyncStatusDot />
        </View>
        <View style={styles.headerStats}>
          <Text style={styles.charSub}>
            Lv {identity.level}  ·  {identity.classId || '—'}
          </Text>
          <View style={styles.statPills}>
            {/* HP */}
            <View style={[styles.statPill, { borderColor: hpColor + '88' }]}>
              <Text style={[styles.statPillValue, { color: hpColor }]}>
                {resources.hp.current}
                <Text style={styles.statPillMax}>/{resources.hp.maximum}</Text>
              </Text>
              <Text style={styles.statPillLabel}>HP</Text>
            </View>
            {/* AC */}
            <View style={styles.statPill}>
              <Text style={styles.statPillValue}>{derived.ac}</Text>
              <Text style={styles.statPillLabel}>AC</Text>
            </View>
            {/* Speed */}
            <View style={styles.statPill}>
              <Text style={styles.statPillValue}>{derived.speed}</Text>
              <Text style={styles.statPillLabel}>ft</Text>
            </View>
            {/* Temp HP badge — only when active */}
            {resources.hp.temp > 0 && (
              <View style={[styles.statPill, { borderColor: Colors.blue + '88' }]}>
                <Text style={[styles.statPillValue, { color: Colors.blue }]}>
                  +{resources.hp.temp}
                </Text>
                <Text style={styles.statPillLabel}>TMP</Text>
              </View>
            )}
          </View>
        </View>
      </View>

      {/* Tab Bar */}
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

      {/* Tab Content */}
      <View style={styles.tabContent}>
        {activeTab === 'character' && (
          <TabCharacter
            entity={entity}
            rules={rules}
            isDm={isDm}
            campaignId={campaignId}
            deviceId={deviceId}
            onDamage={handleDamage}
            onHeal={handleHeal}
            onAddCondition={handleAddCondition}
            onRemoveCondition={handleRemoveCondition}
            onResourceChange={handleResourceChange}
            onSpendSlot={handleSpendSlot}
            onRestoreSlot={handleRestoreSlot}
            onEntityUpdate={updated => mutate(() => updated)}
          />
        )}
        {activeTab === 'actions' && (
          <TabActions
            entity={entity}
            rules={rules}
            onEntityUpdate={updated => mutate(() => updated)}
          />
        )}
        {activeTab === 'abilities' && (
          <TabAbilities
            entity={entity}
            rules={rules}
            isDm={isDm}
            campaignId={campaignId}
            deviceId={deviceId}
            onEntityUpdate={updated => mutate(() => updated)}
          />
        )}
        {activeTab === 'features' && (
          <TabFeatures
            entity={entity}
            rules={rules}
            onEntityUpdate={updated => mutate(() => updated)}
          />
        )}
        {activeTab === 'inventory' && (
          <TabInventory
            entity={entity}
            onEquip={handleEquip}
            onUnequip={handleUnequip}
          />
        )}
        {activeTab === 'notes' && (
          <TabNotes notes={entity.notes} onSave={handleSaveNotes} />
        )}
      </View>

      {/* Persistent Rest Bar — wrapped so it stays above the Android nav bar */}
      <SafeBottomView>
        <View style={styles.restBar}>
          <Pressable style={styles.restBtn} onPress={() => handleRest('short')}>
            <Text style={styles.restBtnTxt}>☕  Short Rest</Text>
          </Pressable>
          <Pressable style={[styles.restBtn, styles.restBtnLong]} onPress={() => handleRest('long')}>
            <Text style={styles.restBtnTxt}>🌙  Long Rest</Text>
          </Pressable>
        </View>
      </SafeBottomView>

      {/* Global dice roller — floats above rest bar */}
      <GlobalDiceRoller bottom={72} right={12} />

    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  errorTxt: { color: Colors.red, fontSize: FontSize.lg },

  header: {
    backgroundColor:   Colors.surfaceHigh,
    paddingTop:        Spacing.xl + 8,
    paddingBottom:     Spacing.sm,
    paddingHorizontal: Spacing.md,
    gap:               Spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTop: {
    flexDirection:  'row',
    alignItems:     'center',
    gap:            Spacing.sm,
  },
  headerStats: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    paddingLeft:    2,
  },
  backBtn:  { paddingRight: Spacing.xs },
  backTxt:  { color: Colors.gold, fontSize: FontSize.md, fontWeight: FontWeight.bold },
  charName: { flex: 1, fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  charSub:  { fontSize: FontSize.xs, color: Colors.textSecondary },

  statPills: { flexDirection: 'row', gap: Spacing.xs },
  statPill: {
    backgroundColor:  Colors.surface,
    borderRadius:     Radius.md,
    borderWidth:      1,
    borderColor:      Colors.border,
    paddingHorizontal: Spacing.sm,
    paddingVertical:  3,
    alignItems:       'center',
    minWidth:         44,
  },
  statPillValue: {
    fontSize:   FontSize.md,
    fontWeight: FontWeight.bold,
    color:      Colors.textPrimary,
    lineHeight: 20,
  },
  statPillMax:  { fontSize: FontSize.xs, color: Colors.textDim, fontWeight: FontWeight.normal },
  statPillLabel:{ fontSize: FontSize.xs, color: Colors.textDim, lineHeight: 14 },

  tabBar: {
    flexDirection:     'row',
    backgroundColor:   Colors.surfaceHigh,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  tabBtn: {
    flex: 1, paddingVertical: Spacing.sm,
    alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent',
  },
  tabBtnActive:  { borderBottomColor: Colors.gold },
  tabTxt:        { fontSize: FontSize.xs, color: Colors.textDim, fontWeight: FontWeight.bold },
  tabTxtActive:  { color: Colors.gold },

  tabContent: { flex: 1 },

  restBar: {
    flexDirection:   'row',
    gap:             Spacing.sm,
    padding:         Spacing.sm,
    backgroundColor: Colors.surfaceHigh,
    borderTopWidth:  1,
    borderTopColor:  Colors.border,
  },
  restBtn: {
    flex: 1, backgroundColor: Colors.surface,
    borderRadius: Radius.md, padding: Spacing.sm,
    alignItems: 'center', borderWidth: 1, borderColor: Colors.border,
  },
  restBtnLong: { borderColor: Colors.blue + '88' },
  restBtnTxt:  { color: Colors.textPrimary, fontWeight: FontWeight.bold, fontSize: FontSize.sm },
});
