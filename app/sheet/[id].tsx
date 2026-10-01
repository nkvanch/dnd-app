// app/sheet/[id].tsx
// Character sheet — 6-tab sheet with persistent rest bar.
// All values read from entity.derived — never computed in components.
import { useState, useCallback, useEffect, useMemo } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, Dimensions, Modal } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useCharacterStore } from '../../src/store/characterStore';
import { useCustomRuleProfileStore } from '../../src/store/customRuleProfileStore';
import { sheetRuleAccess } from '../../src/components/sheet/ruleProfileUi';
import { freeEditUiModel } from '../../src/components/sheet/sheetUiModel';
import { useHomebrewStore } from '../../src/store/homebrewStore';
import { useLastCharacterStore } from '../../src/store/lastCharacterStore';
import { Alert } from '../../src/utils/alert';
import { useCampaignStore } from '../../src/store/campaignStore';
import { useSessionStore }  from '../../src/store/sessionStore';
import { useCombatTurnStore } from '../../src/store/combatTurnStore';
import { recomputeDerived } from '../../src/engine/pipeline';
import { applyDamage, applyHealing, applyWildShapeDamage, playerEndTurn, endConcentration } from '../../src/engine/combat';
import { applyCondition, removeCondition } from '../../src/engine/conditions';
import { shortRestMinutes, longRestHours } from '../../src/engine/houseRules';
import { equipItem, unequipItem, toggleAttunement, generateItemInstanceId, isStatefulItem, applyItemInfusion, removeItemInfusion } from '../../src/engine/inventory';
import { commitSpellPayment, restoreSpellSlot, SpellPaymentOption } from '../../src/engine/spellPayment';
import { captureLoadout, applyLoadout, deleteLoadout } from '../../src/engine/loadout';
import { simulate } from '../../src/engine/simulate';
import { validateEntity } from '../../src/engine/validation';
import { Entity, ItemInstance, DurationTracker, Issue } from '../../src/engine/types';
import { itemRepo } from '../../src/content/itemRepo';
import { spellRepo } from '../../src/content/spellRepo';
import { spellIdsOnEntity } from '../../src/content/spellRepo.types';
import { getInfusion, maxInfusedItems } from '../../src/content/infusions';
import { TabCharacter } from '../../src/components/sheet/TabCharacter';
import { TabExploration } from '../../src/components/sheet/TabExploration';
import { syncAllyGrantsInStore } from '../../src/store/allyGrantSync';
import { TabActions }   from '../../src/components/sheet/TabActions';
import { TabAbilities } from '../../src/components/sheet/TabAbilities';
import { TabFeatures }  from '../../src/components/sheet/TabFeatures';
import { TabInventory } from '../../src/components/sheet/TabInventory';
import { TabNotes }     from '../../src/components/sheet/TabNotes';
import { TabSpells }    from '../../src/components/sheet/TabSpells';
import { FreeEditModal } from '../../src/components/sheet/FreeEditModal';
import { RulesetChangeModal } from '../../src/components/sheet/RulesetChangeModal';
import { CharacterHistoryModal } from '../../src/components/sheet/CharacterHistoryModal';
import { TimelineCategory } from '../../src/db/timelineRepo';
import { IssuesModal } from '../../src/components/sheet/IssuesModal';
import { RestPreviewModal, buildRestMutation } from '../../src/components/sheet/RestPreviewModal';
import { EquipmentPreviewModal } from '../../src/components/sheet/EquipmentPreviewModal';
import { ExportFormatSheet } from '../../src/components/ExportFormatSheet';
import { exportCharacter, ExportFormat, ExportAction } from '../../src/io/exportShare';
import { GlobalDiceRoller } from '../../src/components/GlobalDiceRoller';
import { SyncStatusDot }   from '../../src/components/SyncStatusDot';
import { SafeBottomView }  from '../../src/components/SafeBottomView';
import { ErrorBoundary }   from '../../src/components/ErrorBoundary';
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
  // Individual selectors — never object literals, which create a new reference every render
  // and trigger React's useSyncExternalStore infinite-loop guard.
  const characters      = useCharacterStore(s => s.characters);
  const updateCharacter = useCharacterStore(s => s.updateCharacter);
  const campaignRules   = useCharacterStore(s => s.rules);
  const customRuleProfiles = useCustomRuleProfileStore(s => s.profiles);
  const undoStack       = useCharacterStore(s => s.undoStack);
  const redoStack       = useCharacterStore(s => s.redoStack);
  const undo            = useCharacterStore(s => s.undo);
  const redo            = useCharacterStore(s => s.redo);
  const lastPersistError = useCharacterStore(s => s.lastPersistError);
  const isDm        = useCampaignStore(s => s.isDm);
  const campaignId  = useCampaignStore(s => s.activeCampaign?.id ?? '');
  // Item 17 (timeline improvements) — session grouping in CharacterHistoryModal.
  const activeCampaignSessionLog = useCampaignStore(s => s.activeCampaign?.sessionLog);
  const deviceId    = useSessionStore(s => s.session?.deviceId ?? '');
  const homebrewItems = useHomebrewStore(s => s.items);
  const homebrewSubclasses = useHomebrewStore(s => s.subclasses);
  const getMergedContentDB = useHomebrewStore(s => s.getMergedContentDB);

  const entity = characters.find(c => c.id === id);
  const ruleAccess = entity ? sheetRuleAccess(campaignRules, entity, customRuleProfiles) : { effectiveRules: campaignRules, canFreeEdit: true };
  const rules = ruleAccess.effectiveRules;
  const freeEditModel = entity ? freeEditUiModel(campaignRules,entity,customRuleProfiles) : null;
  const turn = useCombatTurnStore();
  const [activeTab, setActiveTab] = useState<TabId>('character');
  const [sheetMode, setSheetMode] = useState<'combat' | 'exploration'>('combat');
  const [freeEditOpen, setFreeEditOpen] = useState(false);
  const [rulesetChangeOpen, setRulesetChangeOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [issuesOpen, setIssuesOpen] = useState(false);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [exportSheetOpen, setExportSheetOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [headerMenuOpen, setHeaderMenuOpen] = useState(false);
  const goBack = useSafeGoBack('/(tabs)');

  // A-54: recompute diagnostics whenever the viewed entity actually changes
  // (a real mutation, not every render — `entity` is only a new object
  // reference after updateCharacter runs). Ensure-load the entity's own
  // spells/items first: on native both repos only warm their in-memory
  // cache on demand (getSpellSync/getItemSync read that cache synchronously
  // and never touch SQLite themselves), so calling validateEntity before
  // this would misreport real, present content as "missing" — the same
  // false-positive trap the level-up preview's own spellIdsOnEntity +
  // ensureLoaded pairing already avoids.
  useEffect(() => {
    if (!entity) { setIssues([]); return; }
    let cancelled = false;
    void (async () => {
      await spellRepo.ensureLoaded(spellIdsOnEntity(entity));
      await itemRepo.ensureLoaded([
        ...entity.inventory.carried.map(i => i.itemId),
        ...entity.inventory.equipped.map(i => i.itemId),
      ]);
      if (cancelled) return;
      const contentDB = getMergedContentDB(entity.rulesetId);
      setIssues(validateEntity(entity, contentDB, homebrewSubclasses));
    })();
    return () => { cancelled = true; };
  }, [entity, getMergedContentDB, homebrewSubclasses]);

  // Ally auras: when this character's aura state changes (a checklist tick,
  // a planted-standard flag, dropping to 0 HP, gaining/losing an aura
  // feature), re-sync every aura across the characters on this device. The
  // signature keeps this from firing on unrelated edits; the sync itself only
  // writes characters whose receivedGrants actually changed.
  const auraSignature = entity
    ? JSON.stringify([
        entity.auraMembers ?? null,
        entity.targetModes ?? null,
        entity.features.filter(f => f.modeGroup?.scope === 'target').map(f => f.id),
        entity.conditionMonitor.flags,
        entity.resources.hp.current === 0,
        entity.conditions.map(c => c.id),
        entity.features.filter(f => f.allyGrants?.length).map(f => f.id),
        entity.inventory.equipped.map(i => [i.id, i.attuned]),
        entity.receivedGrants?.some(g => g.sourceEntityId === entity.id) ?? false,
      ])
    : '';
  useEffect(() => {
    if (!entity) return;
    syncAllyGrantsInStore();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auraSignature]);

  // Track "last opened" explicitly — the Home screen's old heuristic
  // (last entry in the in-memory characters array) reflected creation
  // order, not viewing order, and drifted from reality within a session
  // since local edits don't reorder that array. No-ops on web.
  useEffect(() => {
    if (id) void useLastCharacterStore.getState().markOpened(id).catch(() => {});
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
  const freeEditAllowed = freeEditModel?.hasControls === true && !freeEditModel.locked;
  useEffect(()=>{ if(!freeEditAllowed)setFreeEditOpen(false); },[freeEditAllowed]);

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

  // Rules-engine blocker RE-AUDIT closure (1D/1E/1F): the ONE explicit
  // merged content snapshot every ordinary player mutation recomputes
  // against — resolved once here at the application mutation boundary
  // (mutate) rather than re-derived per handler, so an unrelated HP/
  // resource/action mutation can never silently fall back to official-only
  // content for a homebrew character.
  const cardContent = useMemo(() => {
    if (!entity) return {};
    const db = getMergedContentDB(entity.rulesetId);
    return { classDefs: db.classes, homebrewSpells: db.spells, races: db.races, items: db.items };
  }, [entity?.rulesetId, getMergedContentDB]);

  const mutate = useCallback((updater: (e: Entity) => Entity, label?: string, category?: TimelineCategory) => {
    if (!id) return;
    updateCharacter(id, e => {
      const updated = updater(e);
      return recomputeDerived(updated, rules, cardContent);
    }, label, category);
  }, [id, updateCharacter, rules, cardContent]);

  // ── Handlers (all pure engine calls → mutate) ─────────────────────────────

  const handleDamage = useCallback((amount: number, damageType?: string, isNonmagicalAttack?: boolean) => {
    // While Wild Shaped, damage hits the BEAST's hp pool, not the player's
    // real HP underneath first. See combat.ts's applyWildShapeDamage: the
    // beast-pool absorption step still has no resistance concept and
    // ignores damageType, but any OVERFLOW that carries into real HP once
    // the form reverts (rules-engine blocker fix) DOES resolve the
    // player's own resistance/vulnerability — so damageType is threaded
    // through either way, applyWildShapeDamage itself decides when it's
    // actually consulted. isNonmagicalAttack (rules-engine blocker RE-AUDIT
    // closure 3B) is the same table-first, per-hit fact the DM's Wild Shape
    // damage controls already expose, now threaded from the player's own
    // HpModal (TabCharacter.tsx) — never stored persistently on the entity.
    mutate(e => e.wildShapeState?.active
      ? applyWildShapeDamage(e, amount, rules, damageType, isNonmagicalAttack)
      : applyDamage(e, amount, rules, damageType), `Took ${amount}${damageType ? ` ${damageType}` : ''} damage`, 'combat');
  }, [mutate, rules]);

  const handleHeal = useCallback((amount: number) => {
    // Per the book rule, healing has no effect on a Wild Shape beast form's
    // hit points — no-op while transformed, rather than incorrectly healing
    // the player's real HP underneath (which isn't the pool being damaged).
    mutate(e => e.wildShapeState?.active ? e : applyHealing(e, amount, rules), `Healed ${amount}`, 'combat');
  }, [mutate, rules]);

  const handleAddCondition = useCallback((condId: string, duration: DurationTracker | null) => {
    // Merged (not official-only CONDITIONS_BY_ID) so a homebrew condition's
    // mechanical features attach the same way an official one's do (e.g.
    // Grappled sets speed to 0 in the pipeline) — audit findings CONTENT-8
    // / KNOWN_CONDITIONS-1.
    const condContent = getMergedContentDB().conditions.find(c => c.id === condId);
    mutate(e => applyCondition(e, condId, 'manual', rules, condContent?.features, duration), `Added condition: ${condContent?.name ?? condId}`, 'combat');
  }, [mutate, rules, getMergedContentDB]);

  const handleRemoveCondition = useCallback((condId: string) => {
    mutate(e => removeCondition(e, condId, rules), `Removed condition: ${getMergedContentDB().conditions.find(c => c.id === condId)?.name ?? condId}`, 'combat');
  }, [mutate, rules, getMergedContentDB]);

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
    }), `${delta > 0 ? 'Restored' : 'Spent'} ${resourceName}`, 'combat');
  }, [mutate, entity]);

  // Re-audit items 1/2 (A12): delegates to the one shared spendSpellSlot/
  // restoreSpellSlot resolver (src/engine/spellPayment.ts) instead of
  // hand-rolling the same used/total clamp a 4th time — that function
  // already enforces 0 <= used <= total unconditionally and no-ops rather
  // than ever letting a spend become a restoration or vice versa.
  const handleSpendSlot = useCallback((tier: string, kind: SpellPaymentOption['kind'] = 'normal') => {
    mutate(e => {
      if (!e.spellcasting) return e;
      return commitSpellPayment(e, { kind, tier: tier as import('../../src/engine/spellPayment').SlotTier });
    }, `Spent level ${tier} spell slot`, 'spells');
  }, [mutate]);

  const handleRestoreSlot = useCallback((tier: string, kind: SpellPaymentOption['kind'] = 'normal') => {
    mutate(e => {
      if (!e.spellcasting) return e;
      const slots = restoreSpellSlot(e.spellcasting, { kind, tier: tier as import('../../src/engine/spellPayment').SlotTier });
      if (slots === e.spellcasting) return e;
      return { ...e, spellcasting: slots };
    }, `Restored level ${tier} spell slot`, 'spells');
  }, [mutate]);

  // Manual End Concentration — the ONE handler both the Character and Spells
  // tabs call (same single-entry-point rule as handleEndTurn), so the
  // timeline label/category/undo/sync are identical from either tab. Also
  // removes the spell's linked effects (see endConcentration).
  const handleEndConcentration = useCallback((spellName: string) => {
    mutate(e => endConcentration(e, rules), `Ended concentration on ${spellName}`, 'spells');
  }, [mutate, rules]);

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

  // `instanceId` (item-identity closure) — the EXACT owned copy the player
  // tapped, since two carried/equipped rows can share `itemId`. TabInventory
  // already iterates real ItemInstance objects, so it always has one to
  // pass; omitted only by any not-yet-updated caller, which falls back to
  // the first `itemId` match (equipItem/unequipItem's own back-compat).
  const handleEquip = useCallback(async (itemId: string, instanceId?: string) => {
    if (!entity) return;
    await itemRepo.ensureLoaded([itemId]);
    const def = itemRepo.getItemSync(itemId) ?? homebrewItems.find(i => i.id === itemId);
    const { before, after } = simulate(entity, e => equipItem(e, itemId, def, rules, instanceId), rules);
    setEquipPreview({ kind: 'equip', itemName: def?.name ?? itemId, before, after });
  }, [entity, homebrewItems, rules]);

  const handleUnequip = useCallback(async (itemId: string, instanceId?: string) => {
    if (!entity) return;
    await itemRepo.ensureLoaded([itemId]); // symmetry — resolves the name for display
    const def = itemRepo.getItemSync(itemId) ?? homebrewItems.find(i => i.id === itemId);
    const { before, after } = simulate(entity, e => unequipItem(e, itemId, rules, instanceId), rules);
    setEquipPreview({ kind: 'unequip', itemName: def?.name ?? itemId, before, after });
  }, [entity, homebrewItems, rules]);

  const confirmEquipPreview = useCallback(() => {
    if (!equipPreview) return;
    mutate(() => equipPreview.after, `${equipPreview.kind === 'equip' ? 'Equipped' : 'Unequipped'} ${equipPreview.itemName}`, 'inventory');
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
  const handleToggleAttune = useCallback((itemId: string, instanceId?: string) => {
    mutate(e => toggleAttunement(e, itemId, instanceId), `Toggled attunement: ${itemName(itemId)}`, 'inventory');
  }, [mutate, itemName]);

  // Item 13 (loadouts) — save/apply/delete a named (equipped items,
  // prepared spells) snapshot. Apply resolves every item definition the
  // loadout needs to newly EQUIP up front (same itemRepo.ensureLoaded +
  // homebrew-fallback pattern handleEquip already uses), then applies the
  // whole swap as one mutation with a plain confirm — a full
  // simulate()-backed preview (like single-item equip/unequip gets) would
  // need a new prepared-spell-aware row builder on top of
  // buildEquipmentSummaryRows; skipped for this slice in favor of a clear
  // Alert summary, since the player is applying a loadout they themselves
  // named and saved, not reacting to a surprising external change.
  const handleSaveLoadout = useCallback((name: string) => {
    if (!entity) return;
    mutate(e => ({ ...e, loadouts: [...(e.loadouts ?? []), captureLoadout(e, name)] }), `Saved loadout: ${name}`, 'inventory');
  }, [entity, mutate]);

  const handleApplyLoadout = useCallback(async (loadoutId: string) => {
    if (!entity) return;
    const loadout = entity.loadouts?.find(l => l.id === loadoutId);
    if (!loadout) return;
    await itemRepo.ensureLoaded(loadout.equippedItemIds);
    const itemDefs: Record<string, ReturnType<typeof itemRepo.getItemSync>> = {};
    for (const id of loadout.equippedItemIds) {
      itemDefs[id] = itemRepo.getItemSync(id) ?? homebrewItems.find(i => i.id === id);
    }
    const willEquip = loadout.equippedItemIds.filter(id => !entity.inventory.equipped.some(i => i.itemId === id));
    const willUnequip = entity.inventory.equipped.map(i => i.itemId).filter(id => !loadout.equippedItemIds.includes(id));
    const summary = [
      willEquip.length   ? `Equip: ${willEquip.map(itemName).join(', ')}` : null,
      willUnequip.length ? `Unequip: ${willUnequip.map(itemName).join(', ')}` : null,
      loadout.preparedSpellIds.length ? `Prepare ${loadout.preparedSpellIds.length} spell(s)` : null,
    ].filter((s): s is string => !!s).join('\n');
    Alert.alert(`Apply "${loadout.name}"?`, summary || 'No changes.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Apply', onPress: () => {
        mutate(e => applyLoadout(e, loadout, itemDefs, rules), `Applied loadout: ${loadout.name}`, 'inventory');
      } },
    ]);
  }, [entity, homebrewItems, itemName, mutate, rules]);

  const handleDeleteLoadout = useCallback((loadoutId: string) => {
    const loadout = entity?.loadouts?.find(l => l.id === loadoutId);
    Alert.alert('Delete Loadout', `Delete "${loadout?.name ?? 'this loadout'}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => {
        mutate(e => deleteLoadout(e, loadoutId), `Deleted loadout: ${loadout?.name ?? loadoutId}`, 'inventory');
      } },
    ]);
  }, [entity, mutate]);

  const handleAddItem = useCallback(async (itemId: string) => {
    await itemRepo.ensureLoaded([itemId]);
    const def = itemRepo.getItemSync(itemId) ?? homebrewItems.find(i => i.id === itemId);
    mutate(e => {
      // Item-identity closure: stack onto an existing carried instance ONLY
      // for a genuinely fungible item (arrows, potions, torches, etc.) —
      // "+ Add Item" on something already in the bag should read as "add
      // one more", matching the ×N badge ItemRow already renders. A
      // STATEFUL item (attunable, weapon/armor/shield, or feature-granting
      // — see isStatefulItem's own doc comment) always gets its OWN new
      // instance/id instead: selecting the same magic-item definition twice
      // must be able to end with two independently-tracked owned copies,
      // never silently merged into one shared quantity row.
      const stateful = isStatefulItem(def);
      const existing = !stateful ? e.inventory.carried.find(i => i.itemId === itemId) : undefined;
      const carried = existing
        ? e.inventory.carried.map(i => i === existing ? { ...i, quantity: i.quantity + 1 } : i)
        : [...e.inventory.carried, { id: generateItemInstanceId(), itemId, quantity: 1, attuned: false, features: [] }];
      return { ...e, inventory: { ...e.inventory, carried } };
    }, `Added item: ${itemName(itemId)}`, 'inventory');
  }, [mutate, itemName, homebrewItems]);

  // `instanceId` (item-identity closure) — removes that EXACT owned copy.
  // Falls back to removing the first `itemId` match only (never every
  // matching row) when omitted, so a stale/legacy caller can't silently
  // wipe every copy of a shared definition (the exact INV-1-class bug this
  // closure exists to prevent).
  const handleRemoveItem = useCallback((itemId: string, instanceId?: string) => {
    mutate(e => {
      function removeOneMatch(list: ItemInstance[]): ItemInstance[] {
        const index = instanceId
          ? list.findIndex(i => i.id === instanceId)
          : list.findIndex(i => i.itemId === itemId);
        if (index < 0) return list;
        const next = [...list]; next.splice(index, 1); return next;
      }
      // An instance lives in exactly one of equipped/carried — removing
      // from both is safe (whichever doesn't contain it is a no-op), and
      // avoids the caller needing to know which side it's currently on.
      return {
        ...e,
        inventory: {
          ...e.inventory,
          equipped: removeOneMatch(e.inventory.equipped),
          carried:  removeOneMatch(e.inventory.carried),
        },
      };
    }, `Removed item: ${itemName(itemId)}`, 'inventory');
  }, [mutate, itemName]);

  // +/- stepper on a carried stack's quantity. Dropping to 0 removes it
  // outright — same "gone" result as tapping the ✕ button, just reachable
  // from the stepper too so the player doesn't need both controls.
  // `instanceId` — targets that exact carried row (see handleRemoveItem's
  // own doc comment for why falling back to itemId only ever touches the
  // first match, never every row sharing a definition).
  const handleUpdateQuantity = useCallback((itemId: string, delta: number, instanceId?: string) => {
    mutate(e => {
      const inst = instanceId
        ? e.inventory.carried.find(i => i.id === instanceId)
        : e.inventory.carried.find(i => i.itemId === itemId);
      if (!inst) return e;
      const nextQty = inst.quantity + delta;
      const carried = nextQty <= 0
        ? e.inventory.carried.filter(i => i !== inst)
        : e.inventory.carried.map(i => i === inst ? { ...i, quantity: nextQty } : i);
      return { ...e, inventory: { ...e.inventory, carried } };
    }, `${delta > 0 ? '+' : ''}${delta} ${itemName(itemId)}`, 'inventory');
  }, [mutate, itemName]);

  // Typed exact quantity (e.g. "you just picked up 20 arrows") — same
  // 0-removes-the-stack behavior as the +/- stepper above.
  const handleSetQuantity = useCallback((itemId: string, quantity: number, instanceId?: string) => {
    mutate(e => {
      const inst = instanceId
        ? e.inventory.carried.find(i => i.id === instanceId)
        : e.inventory.carried.find(i => i.itemId === itemId);
      if (!inst) return e;
      const carried = quantity <= 0
        ? e.inventory.carried.filter(i => i !== inst)
        : e.inventory.carried.map(i => i === inst ? { ...i, quantity } : i);
      return { ...e, inventory: { ...e.inventory, carried } };
    }, `Set ${itemName(itemId)} quantity to ${quantity}`, 'inventory');
  }, [mutate, itemName]);

  // Item-identity closure (pass 2, finding B): targets the EXACT selected
  // ItemInstance by `instanceId` — the picker (InfuseItemModal,
  // TabInventory.tsx) now selects a real owned instance, not merely a
  // definition, so two eligible rows sharing `itemId` are independently
  // targetable. Falls back to the first `itemId` match only when
  // `instanceId` is genuinely absent (defensive — shouldn't happen once an
  // instance has gone through boot/import hydration).
  const handleApplyInfusion = useCallback((itemId: string, infusionId: string, damageType: string | undefined, instanceId?: string) => {
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

      return applyItemInfusion(e, itemId, infusionId, feature ?? null, instanceId);
    }, `Infused ${itemName(itemId)}: ${getInfusion(infusionId)?.name ?? infusionId}`, 'inventory');
  }, [mutate, itemName]);

  const handleRemoveInfusion = useCallback((itemId: string, instanceId?: string) => {
    mutate(e => removeItemInfusion(e, itemId, instanceId), `Removed infusion from ${itemName(itemId)}`, 'inventory');
  }, [mutate, itemName]);

  const handleUpdateCurrency = useCallback((currency: import('../../src/engine/types').Currency) => {
    mutate(e => ({ ...e, inventory: { ...e.inventory, currency } }), 'Updated currency', 'inventory');
  }, [mutate]);

  const handleSaveNotes = useCallback((notes: string) => {
    mutate(e => ({ ...e, notes }), 'Edited notes', 'other');
  }, [mutate]);

  // Its own field, own handler — see Entity.explorationNotes's doc comment
  // (audit finding NOTES-CORRUPT-1): the Exploration tab used to share
  // entity.notes with the Notes tab above, corrupting each other's data.
  const handleSaveExplorationNotes = useCallback((notes: string) => {
    mutate(e => ({ ...e, explorationNotes: notes }), 'Edited exploration notes', 'other');
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
  // `hitDiceAllocation` (rules-completeness batch, long-rest recovery) —
  // the player's own mixed-pool choice from RestPreviewModal, threaded
  // straight through to the SAME buildRestMutation the preview already
  // simulated against, so what Confirm applies is exactly what was shown.
  const handleRest = useCallback((kind: 'short' | 'long', hitDiceAllocation?: import('../../src/engine/rest').HitDiceRecoveryAllocation) => {
    mutate(buildRestMutation(kind, rules, hitDiceAllocation), kind === 'short' ? 'Short Rest' : 'Long Rest', 'rest');
  }, [mutate, rules]);

  const [restPreview, setRestPreview] = useState<'short' | 'long' | null>(null);

  // EDIT-PERF-1: each Tab component below is wrapped in React.memo, but that
  // only helps if its props are actually stable — these onEntityUpdate
  // closures used to be created inline in JSX (`updated => mutate(...)`), a
  // fresh function reference on every render of this screen, which defeated
  // memoization and forced the ENTIRE active tab to re-render on any
  // unrelated state change here (e.g. opening the Free-Edit modal, which
  // doesn't touch entity/rules at all). Hoisting them into useCallback,
  // keyed only on the already-stable `mutate`, makes them real stable
  // references so React.memo can actually skip re-rendering the tab.
  const onCombatEntityUpdate      = useCallback((updated: Entity) => mutate(() => updated, 'Character progression', 'combat'), [mutate]);
  const onExplorationEntityUpdate = useCallback((updated: Entity) => mutate(() => updated, 'Exploration action', 'other'), [mutate]);
  const onActionsEntityUpdate     = useCallback((updated: Entity) => mutate(() => updated, 'Used action card', 'combat'), [mutate]);
  const onSpellsEntityUpdate      = useCallback((updated: Entity, label?: string) => mutate(() => updated, label ?? 'Spellbook change', 'spells'), [mutate]);
  const onAbilitiesEntityUpdate   = useCallback((updated: Entity) => mutate(() => updated, 'Ability override', 'other'), [mutate]);
  const onFeaturesEntityUpdate    = useCallback((updated: Entity) => mutate(() => updated, 'Edited features', 'features'), [mutate]);
  // Closure item 16: the ONE authoritative End Turn entry point — Character/
  // Actions/Spells tabs all call this same handler now instead of each
  // computing playerEndTurn() locally and routing the result through their
  // own differently-labeled/categorized generic onEntityUpdate (which used
  // to produce 3 different timeline labels — 'Character progression',
  // 'Used action card', 'End Turn' — and 2 different categories for the
  // exact same mutation). One call site means one label/category/sync/undo
  // behavior, guaranteed identical regardless of which tab it's pressed from.
  const handleEndTurn = useCallback(() => mutate(e => playerEndTurn(e, rules), 'End Turn', 'combat'), [mutate, rules]);

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
          <Text style={styles.charName} numberOfLines={1} ellipsizeMode="tail">{identity.name || 'Unnamed'}</Text>
          <SyncStatusDot />
          <Pressable accessibilityRole="button" testID="character-undo" accessibilityLabel="Undo" style={styles.headerIconBtn} disabled={undoStack[0]?.entityId !== id} onPress={undo}><Text style={[styles.headerIcon,undoStack[0]?.entityId!==id&&styles.undoRedoTxtDisabled]}>↶</Text></Pressable>
          <Pressable accessibilityRole="button" testID="character-redo" accessibilityLabel="Redo" style={styles.headerIconBtn} disabled={redoStack[0]?.entityId !== id} onPress={redo}><Text style={[styles.headerIcon,redoStack[0]?.entityId!==id&&styles.undoRedoTxtDisabled]}>↷</Text></Pressable>
          <Pressable accessibilityRole="button" testID="character-more" accessibilityLabel="More character actions" style={styles.headerIconBtn} onPress={()=>setHeaderMenuOpen(true)}><Text style={styles.headerIcon}>⋮</Text></Pressable>
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

      <Modal visible={headerMenuOpen} transparent animationType="fade" onRequestClose={()=>setHeaderMenuOpen(false)}><Pressable style={styles.menuBackdrop} onPress={()=>setHeaderMenuOpen(false)}><View style={styles.headerMenu}>
        <MenuAction icon="🕘" label="History" onPress={()=>{setHeaderMenuOpen(false);setHistoryOpen(true)}} />
        <MenuAction icon="🌐" label="Rules" onPress={()=>{setHeaderMenuOpen(false);setRulesetChangeOpen(true)}} />
        <MenuAction icon={freeEditAllowed?'✎':'🔒'} label={freeEditAllowed?'Free Edit':'Free Edit locked'} disabled={!freeEditAllowed} onPress={()=>{setHeaderMenuOpen(false);setFreeEditOpen(true)}} />
        <MenuAction icon="📤" label="Export Character" disabled={exporting} onPress={()=>{setHeaderMenuOpen(false);setExportSheetOpen(true)}} />
        {issues.length>0&&<MenuAction icon={issues.some(i=>i.severity==='error')?'⛔':'⚠️'} label={`Diagnostics (${issues.length})`} onPress={()=>{setHeaderMenuOpen(false);setIssuesOpen(true)}} />}
      </View></Pressable></Modal>

      {/* Live-play turn banner — only while the DM has an active encounter
          running and this device is a connected player (turn.active is
          false whenever offline/no combat/not a player, so this renders
          nothing in every other case). Player devices previously had zero
          visibility into whose turn it was during DM-run combat. */}
      {turn.active && (
        <View style={[styles.turnBanner, turn.currentEntityId === entity?.id && styles.turnBannerMine]}>
          <Text style={styles.turnBannerTxt}>
            {turn.currentEntityId === entity?.id
              ? '⚔️ YOUR TURN'
              : `Round ${turn.round} — ${turn.currentName ?? '…'}'s turn`}
          </Text>
        </View>
      )}

      {/* Surfaces a failed local save instead of only logging it — a write
          failure used to leave the UI looking correct while the disk
          silently kept the pre-mutation state, discovered only after a
          later restart reverted the change with no explanation (audit
          finding PERSIST-5). Clears itself on the next successful save. */}
      {lastPersistError && (
        <View style={styles.persistErrorBanner}>
          <Text style={styles.persistErrorTxt}>⚠️ {lastPersistError}</Text>
        </View>
      )}

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

      {/* Tab Content — wrapped in its own ErrorBoundary (architecture review
          C8, defense in depth): a structurally malformed character (e.g.
          imported from a corrupted/hand-edited pack) can throw while
          rendering derived data here. Scoped BELOW the header/tab bar above
          (which stay outside, so "← Back" always works even if every tab
          crashes) and keyed on entity.id + activeTab so navigating to a
          different character or switching tabs always gets a fresh
          boundary — a crash on one tab doesn't leave every other tab (or
          every other character) stuck showing the same stale fallback. */}
      <ErrorBoundary key={`${entity.id}_${activeTab}`}>
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
                onEndConcentration={handleEndConcentration}
                onEntityUpdate={onCombatEntityUpdate}
                onEndTurn={handleEndTurn}
              />
            ) : (
              <TabExploration
                entity={entity}
                rules={rules}
                onEntityUpdate={onExplorationEntityUpdate}
                onDamage={handleDamage}
                onHeal={handleHeal}
                onAddCondition={handleAddCondition}
                onRemoveCondition={handleRemoveCondition}
                onSaveExplorationNotes={handleSaveExplorationNotes}
              />
            )}
          </View>
        )}
        {activeTab === 'actions' && (
          <TabActions
            entity={entity}
            rules={rules}
            onEntityUpdate={onActionsEntityUpdate}
            onEndTurn={handleEndTurn}
          />
        )}
        {activeTab === 'spells' && (
          <TabSpells
            entity={entity}
            rules={rules}
            onEntityUpdate={onSpellsEntityUpdate}
            onEndTurn={handleEndTurn}
            onRestoreSlot={handleRestoreSlot}
            onEndConcentration={handleEndConcentration}
          />
        )}
        {activeTab === 'abilities' && (
          <TabAbilities
            entity={entity}
            rules={rules}
            isDm={isDm}
            campaignId={campaignId}
            deviceId={deviceId}
            onEntityUpdate={onAbilitiesEntityUpdate}
          />
        )}
        {activeTab === 'features' && (
          <TabFeatures
            entity={entity}
            rules={rules}
            onEntityUpdate={onFeaturesEntityUpdate}
          />
        )}
        {activeTab === 'inventory' && (
          <TabInventory
            entity={entity}
            rules={rules}
            onEquip={(...args) => { void handleEquip(...args); }}
            onUnequip={(...args) => { void handleUnequip(...args); }}
            onAddItem={(...args) => { void handleAddItem(...args); }}
            onRemoveItem={handleRemoveItem}
            onUpdateQuantity={handleUpdateQuantity}
            onSetQuantity={handleSetQuantity}
            onUpdateCurrency={handleUpdateCurrency}
            onApplyInfusion={handleApplyInfusion}
            onRemoveInfusion={handleRemoveInfusion}
            onToggleAttune={handleToggleAttune}
            onSaveLoadout={handleSaveLoadout}
            onApplyLoadout={(...args) => { void handleApplyLoadout(...args); }}
            onDeleteLoadout={handleDeleteLoadout}
          />
        )}
        {activeTab === 'notes' && (
          <TabNotes notes={entity.notes} onSave={handleSaveNotes} />
        )}
      </View>
      </ErrorBoundary>

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

      {/* FREEEDIT-PERF-1: all 6 modals below used to be unconditionally
          mounted with only `visible` gating RN Modal's native display —
          the component body (state, effects, any data fetch/derivation)
          still ran on every sheet render regardless of whether the modal
          was open, and each one also added to the render cost paid by
          every OTHER open/close of any of them (all live in this same
          parent, so any local state change here re-renders every sibling).
          Gating the element itself, same pattern already used for
          MonsterPreview/AddItemModal, means each only does its own work
          while actually open. */}

      {/* Free-edit modal (solo/prep only) */}
      {freeEditOpen && (
        <FreeEditModal
          visible={freeEditOpen}
          entity={entity}
          rules={rules}
          onApply={updated => mutate(() => updated, 'Free edit', 'other')}
          onClose={() => setFreeEditOpen(false)}
        />
      )}

      {/* LIVE-RULESET-1: commits through the SAME mutation choke point as
          every other character change — persistence/undo/timeline/sync all
          come for free, nothing bespoke. `updated` (preview.after) is
          applied verbatim, matching every other preview-then-commit modal
          in this app (never re-derive the change on confirm). */}
      {rulesetChangeOpen && (
        <RulesetChangeModal
          visible={rulesetChangeOpen}
          entity={entity}
          rules={rules}
          onConfirm={(updated, label) => {
            mutate(() => updated, label, 'ruleset');
            setRulesetChangeOpen(false);
          }}
          onCancel={() => setRulesetChangeOpen(false)}
        />
      )}

      {historyOpen && (
        <CharacterHistoryModal
          visible={historyOpen}
          entityId={id}
          onClose={() => setHistoryOpen(false)}
          sessionLog={activeCampaignSessionLog}
        />
      )}

      {issuesOpen && (
        <IssuesModal
          visible={issuesOpen}
          issues={issues}
          onClose={() => setIssuesOpen(false)}
        />
      )}

      {restPreview !== null && (
        <RestPreviewModal
          visible={restPreview !== null}
          kind={restPreview ?? 'short'}
          entity={entity}
          rules={rules}
          onConfirm={(hitDiceAllocation) => { handleRest(restPreview!, hitDiceAllocation); setRestPreview(null); }}
          onCancel={() => setRestPreview(null)}
        />
      )}

      {equipPreview !== null && (
        <EquipmentPreviewModal
          visible={equipPreview !== null}
          kind={equipPreview?.kind ?? 'equip'}
          itemName={equipPreview?.itemName ?? ''}
          before={equipPreview?.before ?? null}
          after={equipPreview?.after ?? null}
          onConfirm={confirmEquipPreview}
          onCancel={() => setEquipPreview(null)}
        />
      )}

      {exportSheetOpen && (
        <ExportFormatSheet
          visible={exportSheetOpen}
          kind="character"
          title={`Export "${entity.identity.name || 'Character'}"`}
          onSelect={(...args) => { void handleExportFormat(...args); }}
          onClose={() => setExportSheetOpen(false)}
        />
      )}

    </View>
  );
}

function MenuAction({icon,label,onPress,disabled=false}:{icon:string;label:string;onPress:()=>void;disabled?:boolean}){return <Pressable testID={`character-menu-${label.toLowerCase().replace(/[^a-z]+/g, '-')}`} accessibilityRole="menuitem" accessibilityLabel={label} disabled={disabled} style={[styles.menuItem,disabled&&styles.menuItemDisabled]} onPress={onPress}><Text style={styles.menuIcon}>{icon}</Text><Text style={styles.menuLabel}>{label}</Text></Pressable>}

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
  headerIconBtn:{width:40,height:40,alignItems:'center',justifyContent:'center',borderRadius:Radius.full},
  headerIcon:{fontSize:20,color:Colors.gold,fontWeight:FontWeight.bold},
  menuBackdrop:{flex:1,backgroundColor:'#00000088',alignItems:'flex-end',paddingTop:56,paddingRight:Spacing.md},
  headerMenu:{width:220,backgroundColor:Colors.surfaceHigh,borderRadius:Radius.md,borderWidth:1,borderColor:Colors.border,padding:Spacing.xs},
  menuItem:{minHeight:44,flexDirection:'row',alignItems:'center',gap:Spacing.md,paddingHorizontal:Spacing.md,borderRadius:Radius.sm},
  menuItemDisabled:{opacity:0.45},menuIcon:{fontSize:18,width:24,textAlign:'center'},menuLabel:{fontSize:FontSize.sm,color:Colors.textPrimary,fontWeight:FontWeight.bold},
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

  turnBanner: {
    paddingVertical: 6, paddingHorizontal: Spacing.md,
    backgroundColor: Colors.surfaceHigh,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
    alignItems: 'center',
  },
  turnBannerMine: { backgroundColor: Colors.gold + '33', borderBottomColor: Colors.gold },
  turnBannerTxt:  { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.textPrimary },

  persistErrorBanner: {
    paddingVertical: 6, paddingHorizontal: Spacing.md,
    backgroundColor: Colors.red + '22',
    borderBottomWidth: 1, borderBottomColor: Colors.red + '66',
  },
  persistErrorTxt: { fontSize: FontSize.xs, color: Colors.red },

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
