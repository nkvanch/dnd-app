// app/sheet/[id].tsx
// Character sheet — 6-tab sheet with persistent rest bar.
// All values read from entity.derived — never computed in components.
import { useState, useCallback, useEffect } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, Dimensions, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCharacterStore, DEFAULT_RULES } from '../../src/store/characterStore';
import { useHomebrewStore } from '../../src/store/homebrewStore';
import { setMeta } from '../../src/db/appMetaRepo';
import { Alert } from '../../src/utils/alert';
import { useCampaignStore } from '../../src/store/campaignStore';
import { useSessionStore }  from '../../src/store/sessionStore';
import { recomputeDerived } from '../../src/engine/pipeline';
import { applyDamage, applyHealing, applyWildShapeDamage } from '../../src/engine/combat';
import { applyCondition, removeCondition } from '../../src/engine/conditions';
import { playerFreeEditLocked, shortRestMinutes, longRestHours } from '../../src/engine/houseRules';
import { equipItem, unequipItem, toggleAttunement } from '../../src/engine/inventory';
import { simulate } from '../../src/engine/simulate';
import { Entity, ItemInstance, DurationTracker } from '../../src/engine/types';
import { itemRepo } from '../../src/content/itemRepo';
import { getInfusion, maxInfusedItems } from '../../src/content/infusions';
import { CONDITIONS_BY_ID } from '../../src/content/conditions/index';
import { TabCharacter } from '../../src/components/sheet/TabCharacter';
import { TabExploration } from '../../src/components/sheet/TabExploration';
import { TabActions }   from '../../src/components/sheet/TabActions';
import { TabAbilities } from '../../src/components/sheet/TabAbilities';
import { TabFeatures }  from '../../src/components/sheet/TabFeatures';
import { TabInventory } from '../../src/components/sheet/TabInventory';
import { TabNotes }     from '../../src/components/sheet/TabNotes';
import { TabSpells }    from '../../src/components/sheet/TabSpells';
import { FreeEditModal } from '../../src/components/sheet/FreeEditModal';
import { CharacterHistoryModal } from '../../src/components/sheet/CharacterHistoryModal';
import { RestPreviewModal, buildRestMutation } from '../../src/components/sheet/RestPreviewModal';
import { EquipmentPreviewModal } from '../../src/components/sheet/EquipmentPreviewModal';
import { ExportFormatSheet } from '../../src/components/ExportFormatSheet';
import { exportCharacter, ExportFormat, ExportAction } from '../../src/io/exportShare';
import { GlobalDiceRoller } from '../../src/components/GlobalDiceRoller';
import { SyncStatusDot }   from '../../src/components/SyncStatusDot';
import { SafeBottomView }  from '../../src/components/SafeBottomView';
import { useSafeGoBack }   from '../../src/hooks/useSafeGoBack';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../../src/theme';

type TabId = 'character' | 'actions' | 'spells' | 'abilities' | 'features' | 'inventory' | 'notes';

const BASE_TABS: { id: TabId; label: string }[] = [
  { id: 'character',  label: 'Combat'     },
  { id: 'actions',    label: 'Actions'    },
  { id: 'abilities',  label: 'Abilities'  },
  { id: 'features',   label: 'Features'   },
  { id: 'inventory',  label: 'Items'      },
  { id: 'notes',      label: 'Notes'      },
];

const SPELLS_TAB: { id: TabId; label: string } = { id: 'spells', label: 'Spells' };

export default function CharacterSheetScreen() {
  const { id }   = useLocalSearchParams<{ id: string }>();
  const router   = useRouter();
  // Individual selectors — never object literals, which create a new reference every render
  // and trigger React's useSyncExternalStore infinite-loop guard.
  const characters      = useCharacterStore(s => s.characters);
  const updateCharacter = useCharacterStore(s => s.updateCharacter);
  const rules           = useCharacterStore(s => s.rules);
  const undoStack       = useCharacterStore(s => s.undoStack);
  const redoStack       = useCharacterStore(s => s.redoStack);
  const undo            = useCharacterStore(s => s.undo);
  const redo            = useCharacterStore(s => s.redo);
  const isDm        = useCampaignStore(s => s.isDm);
  const campaignId  = useCampaignStore(s => s.activeCampaign?.id ?? '');
  const deviceId    = useSessionStore(s => s.session?.deviceId ?? '');
  const homebrewItems = useHomebrewStore(s => s.items);

  const entity = characters.find(c => c.id === id);
  const [activeTab, setActiveTab] = useState<TabId>('character');
  const [sheetMode, setSheetMode] = useState<'combat' | 'exploration'>('combat');
  const [freeEditOpen, setFreeEditOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [exportSheetOpen, setExportSheetOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const goBack = useSafeGoBack('/(tabs)');

  // Track "last opened" explicitly — the Home screen's old heuristic
  // (last entry in the in-memory characters array) reflected creation
  // order, not viewing order, and drifted from reality within a session
  // since local edits don't reorder that array. No-ops on web.
  useEffect(() => {
    if (id) setMeta('last_opened_character_id', id).catch(() => { /* non-critical */ });
  }, [id]);

  const handleExportFormat = useCallback(async (format: ExportFormat, action: ExportAction) => {
    setExportSheetOpen(false);
    if (!entity) return;
    setExporting(true);
    try {
      await exportCharacter(entity, format, action);
    } catch (e: any) {
      Alert.alert('Export failed', e?.message ?? 'Something went wrong.');
    } finally {
      setExporting(false);
    }
  }, [entity]);

  // Free-edit a character's own data. Hidden only when a DM has explicitly
  // locked player edits via the house rule (the DM keeps the button). Being
  // nominally in a campaign no longer hides it — a player editing their own
  // sheet is normal, and the lock toggle is the real control.
  const freeEditAllowed = !playerFreeEditLocked(rules) || isDm;

  // Build tab list: Spells tab is inserted after Actions for spellcasters.
  // Also show it for Skeleton characters (Doomed Touch grants chill touch) even
  // if their spellcasting block hasn't been initialised yet — the tab provides
  // the repair action that initialises it.
  const isSkeletonChar =
    entity?.identity.raceId    === 'skeleton' ||
    entity?.identity.subRaceId === 'skeleton_giant' ||
    !!entity?.features.some(f => f.id === 'skeleton_doomed_touch');
  const showSpellsTab = !!entity?.spellcasting || isSkeletonChar;
  const TABS: { id: TabId; label: string }[] = showSpellsTab
    ? [BASE_TABS[0], BASE_TABS[1], SPELLS_TAB, ...BASE_TABS.slice(2)]
    : BASE_TABS;

  // Tab min-width: fills screen for 6 tabs, scrollable for 7.
  const TAB_MIN_W = Math.floor(Dimensions.get('window').width / 6);

  const mutate = useCallback((updater: (e: Entity) => Entity, label?: string) => {
    if (!id) return;
    updateCharacter(id, e => {
      const updated = updater(e);
      return recomputeDerived(updated, rules);
    }, label);
  }, [id, updateCharacter, rules]);

  // ── Handlers (all pure engine calls → mutate) ─────────────────────────────

  const handleDamage = useCallback((amount: number, damageType?: string) => {
    // While Wild Shaped, damage hits the BEAST's hp pool, not the player's
    // real HP underneath (which is untouched and resumes exactly where it
    // was on revert, per the book rule). See combat.ts's applyWildShapeDamage.
    // Wild Shape beast HP has no resistance concept, so damageType only
    // applies to the real-HP path.
    mutate(e => e.wildShapeState?.active
      ? applyWildShapeDamage(e, amount, rules)
      : applyDamage(e, amount, rules, damageType), `Took ${amount}${damageType ? ` ${damageType}` : ''} damage`);
  }, [mutate, rules]);

  const handleHeal = useCallback((amount: number) => {
    // Per the book rule, healing has no effect on a Wild Shape beast form's
    // hit points — no-op while transformed, rather than incorrectly healing
    // the player's real HP underneath (which isn't the pool being damaged).
    mutate(e => e.wildShapeState?.active ? e : applyHealing(e, amount, rules), `Healed ${amount}`);
  }, [mutate, rules]);

  const handleAddCondition = useCallback((condId: string, duration: DurationTracker | null) => {
    // Look up the condition's mechanical features from content so the engine
    // can enforce them (e.g. Grappled sets speed to 0 in the pipeline).
    const condContent = CONDITIONS_BY_ID[condId];
    mutate(e => applyCondition(e, condId, 'manual', rules, condContent?.features, duration), `Added condition: ${condContent?.name ?? condId}`);
  }, [mutate, rules]);

  const handleRemoveCondition = useCallback((condId: string) => {
    mutate(e => removeCondition(e, condId, rules), `Removed condition: ${CONDITIONS_BY_ID[condId]?.name ?? condId}`);
  }, [mutate, rules]);

  const handleResourceChange = useCallback((resourceId: string, delta: number) => {
    const resourceName = entity?.resources.custom.find(r => r.id === resourceId)?.name ?? resourceId;
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
    }), `${delta > 0 ? 'Restored' : 'Spent'} ${resourceName}`);
  }, [mutate, entity]);

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
    }, `Spent level ${tier} spell slot`);
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
    }, `Restored level ${tier} spell slot`);
  }, [mutate]);

  // Set by handleEquip/handleUnequip once the change has been simulated but
  // not yet resolved — drives EquipmentPreviewModal. Both resolve the
  // item's definition first (itemRepo only ever holds the OFFICIAL catalog —
  // a homebrew item's definition lives in homebrewStore instead, so it
  // needs its own fallback lookup here or every homebrew item previews/
  // equips with permanently empty features: no attack card, no AC change,
  // nothing), purely so the preview can show the item's name and (for
  // equip) hydrate its features — the actual mutation is the pure
  // equipItem()/unequipItem() (src/engine/inventory.ts), so it's usable
  // directly as a simulate() mutator.
  const [equipPreview, setEquipPreview] = useState<{
    kind: 'equip' | 'unequip'; itemName: string; before: Entity; after: Entity;
  } | null>(null);

  const handleEquip = useCallback(async (itemId: string) => {
    if (!entity) return;
    await itemRepo.ensureLoaded([itemId]);
    const def = itemRepo.getItemSync(itemId) ?? homebrewItems.find(i => i.id === itemId);
    const { before, after } = simulate(entity, e => equipItem(e, itemId, def, rules), rules);
    setEquipPreview({ kind: 'equip', itemName: def?.name ?? itemId, before, after });
  }, [entity, homebrewItems, rules]);

  const handleUnequip = useCallback(async (itemId: string) => {
    if (!entity) return;
    await itemRepo.ensureLoaded([itemId]); // symmetry — resolves the name for display
    const def = itemRepo.getItemSync(itemId) ?? homebrewItems.find(i => i.id === itemId);
    const { before, after } = simulate(entity, e => unequipItem(e, itemId, rules), rules);
    setEquipPreview({ kind: 'unequip', itemName: def?.name ?? itemId, before, after });
  }, [entity, homebrewItems, rules]);

  const confirmEquipPreview = useCallback(() => {
    if (!equipPreview) return;
    mutate(() => equipPreview.after, `${equipPreview.kind === 'equip' ? 'Equipped' : 'Unequipped'} ${equipPreview.itemName}`);
    setEquipPreview(null);
  }, [mutate, equipPreview]);

  // Looks up an item's display name for a mutate() label — falls back to the
  // raw id when the definition isn't loaded/found, same fallback every other
  // item-name lookup in this file already uses (handleEquip/handleUnequip).
  const itemName = useCallback((itemId: string) =>
    itemRepo.getItemSync(itemId)?.name ?? homebrewItems.find(i => i.id === itemId)?.name ?? itemId,
  [homebrewItems]);

  // A plain boolean flip, unlike equip/unequip — no AC/attack-bonus change
  // to preview, so this mutates directly like handleAddItem/handleRemoveItem
  // rather than going through a simulate()-backed preview modal. The cap
  // check itself lives in toggleAttunement() (a no-op past the cap); the UI
  // (TabInventory) checks countAttuned()/attunementCap() itself first so it
  // can show an explanatory Alert instead of a silent no-op.
  const handleToggleAttune = useCallback((itemId: string) => {
    mutate(e => toggleAttunement(e, itemId), `Toggled attunement: ${itemName(itemId)}`);
  }, [mutate, itemName]);

  const handleAddItem = useCallback(async (itemId: string) => {
    await itemRepo.ensureLoaded([itemId]);
    mutate(e => {
      // Stack onto an existing carried instance of the same item (arrows,
      // potions, torches, etc.) instead of adding a second duplicate row —
      // "+ Add Item" on something already in the bag should read as "add
      // one more", matching the ×N badge ItemRow already renders.
      const existing = e.inventory.carried.find(i => i.itemId === itemId);
      const carried = existing
        ? e.inventory.carried.map(i => i.itemId === itemId ? { ...i, quantity: i.quantity + 1 } : i)
        : [...e.inventory.carried, { itemId, quantity: 1, attuned: false, features: [] }];
      return { ...e, inventory: { ...e.inventory, carried } };
    }, `Added item: ${itemName(itemId)}`);
  }, [mutate, itemName]);

  const handleRemoveItem = useCallback((itemId: string) => {
    mutate(e => ({
      ...e,
      inventory: {
        ...e.inventory,
        equipped: e.inventory.equipped.filter(i => i.itemId !== itemId),
        carried:  e.inventory.carried.filter(i => i.itemId !== itemId),
      },
    }), `Removed item: ${itemName(itemId)}`);
  }, [mutate, itemName]);

  // +/- stepper on a carried stack's quantity. Dropping to 0 removes it
  // outright — same "gone" result as tapping the ✕ button, just reachable
  // from the stepper too so the player doesn't need both controls.
  const handleUpdateQuantity = useCallback((itemId: string, delta: number) => {
    mutate(e => {
      const inst = e.inventory.carried.find(i => i.itemId === itemId);
      if (!inst) return e;
      const nextQty = inst.quantity + delta;
      const carried = nextQty <= 0
        ? e.inventory.carried.filter(i => i.itemId !== itemId)
        : e.inventory.carried.map(i => i.itemId === itemId ? { ...i, quantity: nextQty } : i);
      return { ...e, inventory: { ...e.inventory, carried } };
    }, `${delta > 0 ? '+' : ''}${delta} ${itemName(itemId)}`);
  }, [mutate, itemName]);

  // Typed exact quantity (e.g. "you just picked up 20 arrows") — same
  // 0-removes-the-stack behavior as the +/- stepper above.
  const handleSetQuantity = useCallback((itemId: string, quantity: number) => {
    mutate(e => {
      const inst = e.inventory.carried.find(i => i.itemId === itemId);
      if (!inst) return e;
      const carried = quantity <= 0
        ? e.inventory.carried.filter(i => i.itemId !== itemId)
        : e.inventory.carried.map(i => i.itemId === itemId ? { ...i, quantity } : i);
      return { ...e, inventory: { ...e.inventory, carried } };
    }, `Set ${itemName(itemId)} quantity to ${quantity}`);
  }, [mutate, itemName]);

  const handleApplyInfusion = useCallback((itemId: string, infusionId: string, damageType?: string) => {
    mutate(e => {
      const infusion = getInfusion(infusionId);
      if (!infusion) return e;
      const cap = maxInfusedItems(e.identity.level);
      const infusedCount = [...e.inventory.equipped, ...e.inventory.carried].filter(i => i.infusedWith).length;
      if (infusedCount >= cap) return e;

      // Resistant Armor ships with a placeholder target — substitute the
      // player's chosen damage type before the feature is appended.
      let feature = infusion.feature;
      if (feature && infusion.id === 'resistant_armor' && damageType) {
        feature = {
          ...feature,
          effects: feature.effects.map(eff =>
            eff.target === '__CHOOSE_DAMAGE_TYPE__' ? { ...eff, target: damageType } : eff
          ),
        };
      }

      // Additive — unlike handleEquip's hydration, which replaces an item
      // instance's features wholesale, an infusion must stack alongside
      // whatever features the base item definition already carries.
      function applyTo(inst: ItemInstance): ItemInstance {
        if (inst.itemId !== itemId || inst.infusedWith) return inst;
        return {
          ...inst,
          infusedWith: infusionId,
          features: feature ? [...inst.features, feature] : inst.features,
        };
      }

      return {
        ...e,
        inventory: {
          ...e.inventory,
          equipped: e.inventory.equipped.map(applyTo),
          carried:  e.inventory.carried.map(applyTo),
        },
      };
    }, `Infused ${itemName(itemId)}: ${getInfusion(infusionId)?.name ?? infusionId}`);
  }, [mutate, itemName]);

  const handleRemoveInfusion = useCallback((itemId: string) => {
    mutate(e => {
      function removeFrom(inst: ItemInstance): ItemInstance {
        if (inst.itemId !== itemId || !inst.infusedWith) return inst;
        const featureId = `infusion_${inst.infusedWith}`;
        return { ...inst, infusedWith: null, features: inst.features.filter(f => f.id !== featureId) };
      }
      return {
        ...e,
        inventory: {
          ...e.inventory,
          equipped: e.inventory.equipped.map(removeFrom),
          carried:  e.inventory.carried.map(removeFrom),
        },
      };
    }, `Removed infusion from ${itemName(itemId)}`);
  }, [mutate, itemName]);

  const handleUpdateCurrency = useCallback((currency: import('../../src/engine/types').Currency) => {
    mutate(e => ({ ...e, inventory: { ...e.inventory, currency } }), 'Updated currency');
  }, [mutate]);

  const handleSaveNotes = useCallback((notes: string) => {
    mutate(e => ({ ...e, notes }), 'Edited notes');
  }, [mutate]);

  // Wild Shape duration is tracked in hours (wildShapeState.expiresAt), but
  // the app has no granular hour-by-hour game clock anywhere else to tick it
  // down against. A rest (short or long) always represents at least the
  // beast form's remaining duration passing in practice, so reverting on any
  // rest is a reasonable practical proxy for real duration expiry rather
  // than building a full time-tracking system that doesn't exist elsewhere
  // in the app. See docs/ROADMAP_1.0.md Phase 3.4 for the honest gap this
  // simplifies. (This composition lives in buildRestMutation, shared with
  // RestPreviewModal, so the preview and the real action can never drift.)
  const handleRest = useCallback((kind: 'short' | 'long') => {
    mutate(buildRestMutation(kind, rules), kind === 'short' ? 'Short Rest' : 'Long Rest');
  }, [mutate, rules]);

  const [restPreview, setRestPreview] = useState<'short' | 'long' | null>(null);

  // ── Render ─────────────────────────────────────────────────────────────────

  // All hooks above run unconditionally (Rules of Hooks). Only now, after every
  // hook has been called, do we branch on a missing entity.
  if (!entity) {
    return (
      <View style={styles.screen}>
        <Pressable style={styles.backBtn} onPress={goBack}>
          <Text style={styles.backTxt}>← Back</Text>
        </Pressable>
        <View style={styles.center}>
          <Text style={styles.errorTxt}>Character not found.</Text>
        </View>
      </View>
    );
  }

  const { identity, resources, derived } = entity;

  // Header stat colours — while Wild Shaped, show the beast's hp pool (the
  // one actually taking damage right now), not the player's real HP
  // underneath, which is untouched and would misleadingly look unchanged.
  const wildShaped = entity.wildShapeState?.active;
  const headerHpCurrent = wildShaped ? entity.wildShapeState!.beastHp    : resources.hp.current;
  const headerHpMax     = wildShaped ? entity.wildShapeState!.beastHpMax : resources.hp.maximum;
  const hpPct   = headerHpMax > 0 ? headerHpCurrent / headerHpMax : 0;
  const hpColor = hpPct > 0.5 ? Colors.green : hpPct > 0.25 ? Colors.gold : Colors.red;

  return (
    <View style={styles.screen}>

      {/* Header — name + always-visible HP / AC / Speed */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Pressable style={styles.backBtn} onPress={goBack}>
            <Text style={styles.backTxt}>← Back</Text>
          </Pressable>
          <Text style={styles.charName} numberOfLines={1}>
            {identity.name || 'Unnamed'}
          </Text>
          {/* Session-local undo/redo — see characterStore.ts's UndoEntry doc
              comment. Scoped to THIS character: the underlying stacks are
              global across every updateCharacter call site (this screen,
              app/dm/encounter.tsx, app/dm/character/[id].tsx), so a button
              here only enables when the top entry actually belongs to the
              character being viewed — otherwise a DM undoing on this
              screen could silently undo an unrelated character's last
              action from the encounter panel. */}
          <Pressable
            style={styles.freeEditBtn}
            disabled={undoStack[0]?.entityId !== id}
            onPress={undo}
          >
            <Text style={[styles.freeEditTxt, undoStack[0]?.entityId !== id && styles.undoRedoTxtDisabled]}>↩</Text>
          </Pressable>
          <Pressable
            style={styles.freeEditBtn}
            disabled={redoStack[0]?.entityId !== id}
            onPress={redo}
          >
            <Text style={[styles.freeEditTxt, redoStack[0]?.entityId !== id && styles.undoRedoTxtDisabled]}>↪</Text>
          </Pressable>
          <Pressable style={styles.freeEditBtn} onPress={() => setHistoryOpen(true)}>
            <Text style={styles.freeEditTxt}>🕘</Text>
          </Pressable>
          {/* Free-edit is offered outside a campaign, unless the DM has locked it. */}
          {freeEditAllowed && (
            <Pressable style={styles.freeEditBtn} onPress={() => setFreeEditOpen(true)}>
              <Text style={styles.freeEditTxt}>🔓 Edit</Text>
            </Pressable>
          )}
          <Pressable
            style={styles.freeEditBtn}
            disabled={exporting}
            onPress={() => setExportSheetOpen(true)}
          >
            {exporting
              ? <ActivityIndicator size="small" color={Colors.gold} />
              : <Text style={styles.freeEditTxt}>📤</Text>}
          </Pressable>
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
                {headerHpCurrent}
                <Text style={styles.statPillMax}>/{headerHpMax}</Text>
              </Text>
              <Text style={styles.statPillLabel}>{wildShaped ? 'BEAST HP' : 'HP'}</Text>
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

      {/* Tab Bar — horizontal ScrollView so spellcasters' 7 tabs can scroll */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tabBarScroll}
        contentContainerStyle={styles.tabBarContent}
      >
        {TABS.map(t => {
          // Pending Choices (skill picks, ASI/feat, subclass, etc.) only ever
          // resolve from the Features tab — a badge here is the "notice this
          // from any tab" signal for a choice that just unlocked (e.g. right
          // after a level-up), since the Combat tab's Level Up button gives no
          // other indication one is waiting.
          const pendingCount = t.id === 'features'
            ? (entity?.choices.filter(c => !c.resolved).length ?? 0)
            : 0;
          return (
            <Pressable
              key={t.id}
              style={[styles.tabBtn, { minWidth: TAB_MIN_W }, activeTab === t.id && styles.tabBtnActive]}
              onPress={() => setActiveTab(t.id)}
            >
              <View style={styles.tabLabelRow}>
                <Text style={[styles.tabTxt, activeTab === t.id && styles.tabTxtActive]}>
                  {t.label}
                </Text>
                {pendingCount > 0 && (
                  <View style={styles.tabBadge}>
                    <Text style={styles.tabBadgeTxt}>{pendingCount}</Text>
                  </View>
                )}
              </View>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Tab Content */}
      <View style={styles.tabContent}>
        {activeTab === 'character' && (
          <View style={{ flex: 1 }}>
            {/* Combat / Exploration mode switch */}
            <View style={styles.modeSwitch}>
              {(['combat', 'exploration'] as const).map(m => (
                <Pressable
                  key={m}
                  style={[styles.modeBtn, sheetMode === m && styles.modeBtnActive]}
                  onPress={() => setSheetMode(m)}
                >
                  <Text style={[styles.modeTxt, sheetMode === m && styles.modeTxtActive]}>
                    {m === 'combat' ? '⚔️  Combat' : '🧭  Exploration'}
                  </Text>
                </Pressable>
              ))}
            </View>

            {sheetMode === 'combat' ? (
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
                onEntityUpdate={updated => mutate(() => updated, 'Character progression')}
              />
            ) : (
              <TabExploration
                entity={entity}
                rules={rules}
                onEntityUpdate={updated => mutate(() => updated, 'Exploration action')}
                onDamage={handleDamage}
                onHeal={handleHeal}
                onAddCondition={handleAddCondition}
                onRemoveCondition={handleRemoveCondition}
                onSaveNotes={handleSaveNotes}
              />
            )}
          </View>
        )}
        {activeTab === 'actions' && (
          <TabActions
            entity={entity}
            rules={rules}
            onEntityUpdate={updated => mutate(() => updated, 'Used action card')}
          />
        )}
        {activeTab === 'spells' && (
          <TabSpells
            entity={entity}
            rules={rules}
            onEntityUpdate={updated => mutate(() => updated, 'Cast spell')}
          />
        )}
        {activeTab === 'abilities' && (
          <TabAbilities
            entity={entity}
            rules={rules}
            isDm={isDm}
            campaignId={campaignId}
            deviceId={deviceId}
            onEntityUpdate={updated => mutate(() => updated, 'Ability override')}
          />
        )}
        {activeTab === 'features' && (
          <TabFeatures
            entity={entity}
            rules={rules}
            onEntityUpdate={updated => mutate(() => updated, 'Edited features')}
          />
        )}
        {activeTab === 'inventory' && (
          <TabInventory
            entity={entity}
            rules={rules}
            onEquip={handleEquip}
            onUnequip={handleUnequip}
            onAddItem={handleAddItem}
            onRemoveItem={handleRemoveItem}
            onUpdateQuantity={handleUpdateQuantity}
            onSetQuantity={handleSetQuantity}
            onUpdateCurrency={handleUpdateCurrency}
            onApplyInfusion={handleApplyInfusion}
            onRemoveInfusion={handleRemoveInfusion}
            onToggleAttune={handleToggleAttune}
          />
        )}
        {activeTab === 'notes' && (
          <TabNotes notes={entity.notes} onSave={handleSaveNotes} />
        )}
      </View>

      {/* Persistent Rest Bar — wrapped so it stays above the Android nav bar */}
      <SafeBottomView>
        <View style={styles.restBar}>
          <Pressable style={styles.restBtn} onPress={() => setRestPreview('short')}>
            <Text style={styles.restBtnTxt}>☕  Short Rest</Text>
            <Text style={styles.restBtnSub}>{formatShortRest(shortRestMinutes(rules))}</Text>
          </Pressable>
          <Pressable style={[styles.restBtn, styles.restBtnLong]} onPress={() => setRestPreview('long')}>
            <Text style={styles.restBtnTxt}>🌙  Long Rest</Text>
            <Text style={styles.restBtnSub}>{longRestHours(rules)} hours</Text>
          </Pressable>
        </View>
      </SafeBottomView>

      {/* Global dice roller — floats above rest bar */}
      <GlobalDiceRoller bottom={72} right={12} />

      {/* Free-edit modal (solo/prep only) */}
      <FreeEditModal
        visible={freeEditOpen}
        entity={entity}
        rules={rules}
        onApply={updated => mutate(() => updated, 'Free edit')}
        onClose={() => setFreeEditOpen(false)}
      />

      <CharacterHistoryModal
        visible={historyOpen}
        entityId={id}
        onClose={() => setHistoryOpen(false)}
      />

      <RestPreviewModal
        visible={restPreview !== null}
        kind={restPreview ?? 'short'}
        entity={entity}
        rules={rules}
        onConfirm={() => { handleRest(restPreview!); setRestPreview(null); }}
        onCancel={() => setRestPreview(null)}
      />

      <EquipmentPreviewModal
        visible={equipPreview !== null}
        kind={equipPreview?.kind ?? 'equip'}
        itemName={equipPreview?.itemName ?? ''}
        before={equipPreview?.before ?? null}
        after={equipPreview?.after ?? null}
        onConfirm={confirmEquipPreview}
        onCancel={() => setEquipPreview(null)}
      />

      <ExportFormatSheet
        visible={exportSheetOpen}
        title={`Export "${entity.identity.name || 'Character'}"`}
        onSelect={handleExportFormat}
        onClose={() => setExportSheetOpen(false)}
      />

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
  charName: { flex: 1, flexShrink: 1, fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  freeEditBtn: {
    flexShrink: 0,
    backgroundColor: Colors.gold + '22', borderRadius: Radius.full,
    borderWidth: 1, borderColor: Colors.gold + '66',
    paddingHorizontal: Spacing.sm, paddingVertical: 3, marginRight: Spacing.xs,
  },
  freeEditTxt: { fontSize: FontSize.xs, color: Colors.gold, fontWeight: FontWeight.bold },
  undoRedoTxtDisabled: { color: Colors.textDim },
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

  tabBarScroll: {
    backgroundColor:   Colors.surfaceHigh,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    flexGrow:          0,
  },
  tabBarContent: {
    flexDirection: 'row',
    minWidth:      '100%',
  },
  tabBtn: {
    flex: 1,
    paddingVertical: Spacing.sm,
    alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent',
  },
  tabBtnActive:  { borderBottomColor: Colors.gold },
  tabTxt:        { fontSize: FontSize.xs, color: Colors.textDim, fontWeight: FontWeight.bold },
  tabTxtActive:  { color: Colors.gold },
  tabLabelRow:   { flexDirection: 'row', alignItems: 'center', gap: 4 },
  tabBadge: {
    minWidth: 16, height: 16, borderRadius: 8, backgroundColor: Colors.gold,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3,
  },
  tabBadgeTxt: { fontSize: 10, fontWeight: FontWeight.bold, color: Colors.bg },

  tabContent: { flex: 1 },

  modeSwitch: {
    flexDirection: 'row', gap: Spacing.xs,
    padding: Spacing.sm,
    backgroundColor: Colors.bg,
  },
  modeBtn: {
    flex: 1, paddingVertical: Spacing.sm, alignItems: 'center',
    backgroundColor: Colors.surface, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border,
  },
  modeBtnActive: { backgroundColor: Colors.gold + '22', borderColor: Colors.gold },
  modeTxt:       { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: FontWeight.bold },
  modeTxtActive: { color: Colors.gold },

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
  restBtnSub:  { color: Colors.textDim, fontSize: FontSize.xs, marginTop: 1 },
});

function formatShortRest(minutes: number): string {
  if (minutes >= 60) return minutes === 60 ? '1 hour' : `${minutes / 60} hours`;
  return `${minutes} min`;
}
