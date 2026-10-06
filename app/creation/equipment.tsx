// app/creation/equipment.tsx
// Step 7: Starting equipment choices.
// Always renders (never auto-skips during render).
// Sets equipmentVisited flag in notes on Continue so hub knows this step was reached.
//
// STARTING-EQUIPMENT-1: supports both legacy equipment choices (no
// `equipmentStyle` — an unstructured pool of fixed-item options, resolved
// via the original `resolveChoice`) and the three new styles
// (`exact_options` / `bundle_options` / `filtered_item`, resolved via
// `resolveEquipmentChoice`) side by side. Every choice — legacy or new —
// resolves IMMEDIATELY once fully selected (no longer batched behind one
// shared "Continue" gate), so each group's own progress is independently
// visible and the picker never bounces back to a hub/list between items of
// the same multi-item choice.
import { itemsForRuleset } from '../../src/content/itemEditions';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, TextInput, Modal } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { useCharacterStore } from '../../src/store/characterStore';
import { useHomebrewStore } from '../../src/store/homebrewStore';
import { usePendingSelectionStore } from '../../src/store/pendingSelectionStore';
import { useRequiredItemContextStore } from '../../src/store/requiredItemContextStore';
import { resolveChoice, resolveEquipmentChoice, EquipmentChoiceResolution } from '../../src/engine/leveling';
import { ChoiceOption, ChoiceState, Entity, ItemFilterConstraint } from '../../src/engine/types';
import { mergeItemIndex } from '../../src/content/contentResolution';
import { buildSimpleCustomItem } from '../../src/content/items/itemBrowse';
import { describeConstraint, reopenEquipmentChoice, skipEquipmentChoice, skipRemainingEquipment, addAdditionalEquipment, additionalEquipment, removeAdditionalEquipment } from '../../src/content/items/equipmentDisplay';
import { ItemPickerModal } from '../../src/components/ItemPickerModal';
import { Alert } from '../../src/utils/alert';
import { Colors, Spacing, Radius, FontSize, FontWeight, scrollBottomPadding } from '../../src/theme';
import { SafeBottomView } from '../../src/components/SafeBottomView';

/** Marks equipmentVisited in notes JSON. */
function markVisited(entity: Entity): Entity {
  let n: Record<string, unknown> = {};
  try { n = JSON.parse(entity.notes || '{}'); } catch { /* ignore */ }
  return { ...entity, notes: JSON.stringify({ ...n, equipmentVisited: true }) };
}

export default function EquipmentScreen() {
  const router   = useRouter();
  const insets   = useSafeAreaInsets();
  const draft    = useCharacterStore(s => s.draft);
  const setDraft = useCharacterStore(s => s.setDraft);
  const rules    = useCharacterStore(s => s.rules);

  const homebrewItems    = useHomebrewStore(s => s.items);
  const saveHomebrewItem = useHomebrewStore(s => s.saveItem);

  const draftRuleset = useCharacterStore(s => s.draft?.rulesetId);
  const allItems = useMemo(() => itemsForRuleset(mergeItemIndex(homebrewItems), draftRuleset), [homebrewItems, draftRuleset]);
  const itemById = useMemo(() => new Map(allItems.map(i => [i.id, i])), [allItems]);
  function itemLookup(id: string) { return itemById.get(id); }
  function itemName(id: string) { return itemById.get(id)?.name ?? id; }

  // Redirect to name if no draft — must be in useEffect, not render
  useEffect(() => {
    if (!draft) router.replace('/creation/name');
  }, [draft]);

  // CREATION-REVISIT-1: was filtered to only !resolved, so once equipment
  // was chosen this screen just showed "No equipment choices for this
  // class" forever — the choice itself was fine, but there was no way to
  // revisit and change it. Same root cause as the subclass-selection bug
  // (SUBCLASS-CHANGE-1) and already fixed once for skills.tsx
  // (startEditingSkills) — mirrors that exact pattern here.
  const allEquipChoices = draft ? draft.choices.filter(c => c.definition.kind === 'equipment') : [];
  const equipChoices     = allEquipChoices.filter(c => !c.resolved);
  const resolvedChoices  = allEquipChoices.filter(c =>  c.resolved);

  // Legacy (no equipmentStyle) in-progress multi-select state, by choice id.
  const [legacySelections, setLegacySelections] = useState<Record<string, string[]>>({});

  // Active required-item picker: either a top-level filtered_item choice,
  // or a nested itemFilter attached to a chosen exact/bundle option.
  // `selected` is the picker's own in-progress multi-select — owned HERE
  // (not inside ItemPickerModal) specifically so it survives a "Create New
  // Homebrew Item" trip into the builder and back (see
  // requiredItemContextStore.ts's header comment for why local component
  // state alone can't be relied on for that round trip in this app).
  const [activePicker, setActivePicker] = useState<{
    choiceId: string; title: string; constraint: ItemFilterConstraint; quantity: number; optionId?: string; selected: string[];
  } | null>(null);
  // STARTING-EQUIPMENT-2: sticky until dismissed or a new pick is started —
  // "the item you just created doesn't satisfy this choice's requirement."
  const [ineligibleNotice, setIneligibleNotice] = useState<{ itemName: string; reason: string } | null>(null);

  // "+ Add Additional Item" flow — manual items never touch draft.choices,
  // so they can never satisfy or reduce a required-equipment counter.
  // LAZY-MOUNT-1: a single discriminated state instead of 3 independent
  // always-mounted Modal/ItemPickerModal children toggled by `visible` —
  // only the chosen destination is ever actually mounted, so the "+ Add
  // Additional Item" menu itself never pays for the item-library browser's
  // (or the homebrew browser's) own filtered-catalog useMemo, which reruns
  // on every homebrewItems/filter change regardless of visibility while
  // mounted (see ItemPickerModal.tsx's `filtered` useMemo).
  type AddItemFlow = 'closed' | 'menu' | 'library' | 'homebrew' | 'simple';
  const [addFlow, setAddFlow] = useState<AddItemFlow>('closed');
  const [scName, setScName] = useState('');
  const [scProps, setScProps] = useState('');
  const [scDesc, setScDesc] = useState('');
  const [editingContext, setEditingContext] = useState<{ choiceId: string; label: string; current: string } | null>(null);
  const [additionalFeedback, setAdditionalFeedback] = useState<string | null>(null);

  // ADDITIONAL-ITEM-1: auto-add a homebrew item saved via "Create New
  // Homebrew Item" while this screen was backgrounded. A plain effect (not
  // useFocusEffect) is safe here — this consume path only sets local draft
  // state, it never itself navigates away, so there's no competing-
  // navigation race to lose (same reasoning already established for
  // spells.tsx/AsiFeatPicker.tsx's own consume effects).
  const pendingAdditionalItem = usePendingSelectionStore(s => s.pending.equipment_additional_item);
  useEffect(() => {
    if (!pendingAdditionalItem || !draft) return;
    const id = usePendingSelectionStore.getState().consumePending('equipment_additional_item');
    if (id) addManualItem(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingAdditionalItem]);

  // STARTING-EQUIPMENT-2: reconstructs a constrained required picker after
  // a "Create New Homebrew Item" trip into the builder and back. Uses
  // useFocusEffect (not a plain useEffect) for the same reason race.tsx/
  // subclass.tsx already need it — resolving a completed choice can itself
  // update draft state while this screen is still backgrounded behind the
  // builder, racing the builder's own goBack(). Deliberately self-
  // contained: every value it needs is read FRESH via .getState() inside
  // the callback (never closed over from render), with an empty
  // dependency array, so it never runs with stale draft/homebrew state —
  // the render-scoped `entity`/`itemLookup`/`itemName` above are NOT safe
  // to close over here for the same reason.
  useFocusEffect(
    useCallback(() => {
      const ctx = useRequiredItemContextStore.getState().consumeContext();
      if (!ctx) return;
      const currentDraft = useCharacterStore.getState().draft;
      if (!currentDraft) return;
      const currentRules = useCharacterStore.getState().rules;
      const result = useRequiredItemContextStore.getState().consumeResult();
      const freshIndex = mergeItemIndex(useHomebrewStore.getState().items);
      const freshLookup = (id: string) => freshIndex.find(i => i.id === id);
      const freshName = (id: string) => freshLookup(id)?.name ?? id;

      let selected = ctx.alreadySelectedItemIds;
      let notice: { itemName: string; reason: string } | null = null;
      if (result && result.requiredChoiceId === ctx.requiredChoiceId) {
        if (result.kind === 'eligible') {
          selected = [...selected, result.itemId];
        } else {
          notice = { itemName: freshName(result.itemId), reason: result.reason };
        }
      }

      const choice = currentDraft.choices.find(c => c.id === ctx.requiredChoiceId);
      if (choice && selected.length === ctx.quantity) {
        try {
          const resolution: EquipmentChoiceResolution = choice.definition.equipmentStyle === 'filtered_item'
            ? { style: 'filtered_item', itemIds: selected }
            : { style: choice.definition.equipmentStyle as 'exact_options' | 'bundle_options', optionId: ctx.optionId!, filteredItemIds: selected };
          useCharacterStore.getState().setDraft(resolveEquipmentChoice(currentDraft, ctx.requiredChoiceId, resolution, freshLookup, currentRules));
        } catch (e) {
          Alert.alert('Cannot resolve choice', e instanceof Error ? e.message : 'Invalid selection.');
        }
      } else if (choice) {
        setActivePicker({ choiceId: ctx.requiredChoiceId, title: ctx.title, constraint: ctx.constraint, quantity: ctx.quantity, optionId: ctx.optionId, selected });
      }
      setIneligibleNotice(notice);
    }, [])
  );

  if (!draft) return null;
  const entity = draft;

  function addManualItem(itemId: string) {
    // Item-identity closure: ItemIndexEntry carries the authoritative compact
    // hasFeatures signal, so this is correct on native before its lazy Tier-2
    // definition cache has been warmed. Homebrew entries are likewise indexed
    // through the same toItemIndexEntry path.
    const result = addAdditionalEquipment(entity, itemId, itemLookup(itemId));
    setDraft(result.entity);
    setAdditionalFeedback(result.added ? `Added ${itemName(itemId)}` : `${itemName(itemId)} is already added`);
    setAddFlow('closed');
  }

  function removeManualItem(sourceId: string) {
    setDraft(removeAdditionalEquipment(entity, sourceId));
    setAdditionalFeedback(null);
  }

  function resolveLegacy(choiceId: string, selections: string[]) {
    setDraft(resolveChoice(entity, choiceId, selections, rules));
  }

  function resolveNew(choiceId: string, resolution: EquipmentChoiceResolution) {
    try {
      setDraft(resolveEquipmentChoice(entity, choiceId, resolution, itemLookup, rules));
    } catch (e) {
      Alert.alert('Cannot resolve choice', e instanceof Error ? e.message : 'Invalid selection.');
    }
  }

  function chooseLegacyOption(choice: ChoiceState, optionId: string) {
    const max = choice.definition.count;
    if (max <= 1) {
      resolveLegacy(choice.id, [optionId]);
      return;
    }
    setLegacySelections(prev => {
      const current = prev[choice.id] ?? [];
      let next: string[];
      if (current.includes(optionId)) next = current.filter(id => id !== optionId);
      else if (current.length >= max) next = [optionId];
      else next = [...current, optionId];
      if (next.length === max) {
        resolveLegacy(choice.id, next);
        const rest = { ...prev };
        delete rest[choice.id];
        return rest;
      }
      return { ...prev, [choice.id]: next };
    });
  }

  function chooseNewOption(choice: ChoiceState, opt: ChoiceOption) {
    if (opt.itemFilter) {
      setIneligibleNotice(null);
      setActivePicker({
        choiceId: choice.id,
        title: opt.label,
        constraint: opt.itemFilter.constraint,
        quantity: opt.itemFilter.quantity,
        optionId: opt.id,
        selected: [],
      });
      return;
    }
    resolveNew(choice.id, { style: choice.definition.equipmentStyle as 'exact_options' | 'bundle_options', optionId: opt.id });
  }

  function openFilteredItemPicker(choice: ChoiceState) {
    setIneligibleNotice(null);
    setActivePicker({
      choiceId: choice.id,
      title: choice.definition.prompt,
      constraint: choice.definition.itemFilter ?? {},
      quantity: choice.definition.count,
      selected: [],
    });
  }

  function handlePickerConfirm(itemIds: string[]) {
    if (!activePicker) return;
    const choice = allEquipChoices.find(c => c.id === activePicker.choiceId);
    setActivePicker(null);
    if (!choice) return;
    if (choice.definition.equipmentStyle === 'filtered_item') {
      resolveNew(choice.id, { style: 'filtered_item', itemIds });
    } else {
      resolveNew(choice.id, {
        style: choice.definition.equipmentStyle as 'exact_options' | 'bundle_options',
        optionId: activePicker.optionId!,
        filteredItemIds: itemIds,
      });
    }
  }

  function editEquipmentChoice(choiceId: string) {
    const choice = entity.choices.find(candidate => candidate.id === choiceId);
    if (choice) setEditingContext({ choiceId, label: choice.definition.equipmentGroup ?? choice.definition.prompt ?? 'Equipment', current: describeResolvedChoice(choice) || 'No item' });
    setDraft(reopenEquipmentChoice(entity, choiceId));
    setLegacySelections(prev => { const next = { ...prev }; delete next[choiceId]; return next; });
  }

  function removeEquipmentChoice(choiceId: string) {
    setDraft(skipEquipmentChoice(entity, choiceId));
  }

  function describeResolvedChoice(choice: ChoiceState): string {
    const style = choice.definition.equipmentStyle;
    const pool: ChoiceOption[] = Array.isArray(choice.definition.pool) ? choice.definition.pool : [];
    if (!style) {
      return choice.selections.map(selId => pool.find(o => o.id === selId)?.label ?? selId).join(', ');
    }
    if (style === 'filtered_item') {
      return choice.selections.map(itemName).join(', ');
    }
    const [optionId, ...filteredItemIds] = choice.selections;
    const opt  = pool.find(o => o.id === optionId);
    const base = opt?.label ?? optionId;
    return filteredItemIds.length === 0 ? base : `${base} — ${filteredItemIds.map(itemName).join(', ')}`;
  }

  async function handleCreateSimpleCustom() {
    const name = scName.trim();
    if (!name) return;
    const custom = buildSimpleCustomItem(name, scProps, scDesc);
    await saveHomebrewItem('item', custom);
    addManualItem(custom.id);
    setScName(''); setScProps(''); setScDesc(''); setAddFlow('closed');
  }

  function handleConfirm() {
    setDraft(markVisited(skipRemainingEquipment(entity)));
    router.push('/creation/spells');
  }

  // Group choices for the progress panel — purely presentational.
  const groupOrder: string[] = [];
  const groups = new Map<string, ChoiceState[]>();
  for (const c of allEquipChoices) {
    const g = c.definition.equipmentGroup ?? 'Equipment';
    if (!groups.has(g)) { groups.set(g, []); groupOrder.push(g); }
    groups.get(g)!.push(c);
  }
  const totalRequired     = allEquipChoices.length;
  const completedRequired = resolvedChoices.length;
  const canProceed = true;

  return (
    <>
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
    >
      <Text style={styles.heading}>Starting Equipment</Text>

      {totalRequired > 0 && (
        <View style={styles.progressPanel}>
          <Text style={styles.progressHeading}>
            Starting Equipment — {completedRequired} of {totalRequired} required choice{totalRequired === 1 ? '' : 's'} complete
          </Text>
          <View style={styles.groupRow}>
            {groupOrder.map(g => {
              const items = groups.get(g)!;
              const done = items.filter(c => c.resolved).length;
              return <Text key={g} style={styles.groupChip}>{g} {done}/{items.length}</Text>;
            })}
          </View>
        </View>
      )}

      {totalRequired === 0 && (
        <Text style={styles.sub}>No equipment choices for this class.</Text>
      )}

      {ineligibleNotice && (
        <View style={styles.ineligibleBanner}>
          <Text style={styles.ineligibleBannerTxt}>
            "{ineligibleNotice.itemName}" was saved, but it does not satisfy: {ineligibleNotice.reason}
          </Text>
          <Pressable onPress={() => setIneligibleNotice(null)} hitSlop={8}>
            <Text style={styles.ineligibleBannerDismiss}>✕</Text>
          </Pressable>
        </View>
      )}

      {resolvedChoices.length > 0 && (
        <View style={styles.resolvedBlock}>
          <Text style={styles.sub}>Equipment chosen:</Text>
{resolvedChoices.map(choice => (
            <View key={choice.id} testID={`equipment-choice-${choice.id}`} style={styles.resolvedChoiceRow}>
              <Text style={styles.ownedItem}>✓ {describeResolvedChoice(choice) || 'No item'}</Text>
              <View style={styles.resolvedActions}>
                <Pressable testID={`equipment-change-${choice.id}`} accessibilityLabel="Change equipment choice" style={styles.changeBtn} onPress={() => editEquipmentChoice(choice.id)}><Text style={styles.changeBtnTxt}>Change</Text></Pressable>
                <Pressable testID={`equipment-remove-${choice.id}`} accessibilityLabel="Remove equipment choice" style={styles.removeBtn} onPress={() => removeEquipmentChoice(choice.id)}><Text style={styles.removeBtnTxt}>Remove</Text></Pressable>
              </View>
            </View>
          ))}
        </View>
      )}

      {editingContext && equipChoices.some(choice => choice.id === editingContext.choiceId) && (
        <View style={styles.changeContext}>
          <Text style={styles.changeContextTitle}>Change {editingContext.label}</Text>
          <Text style={styles.changeContextCurrent}>Current: {editingContext.current}</Text>
          <Text style={styles.changeContextHint}>Your replacement changes only this equipment choice.</Text>
        </View>
      )}

      {equipChoices.map(choice => {
        const style = choice.definition.equipmentStyle;
        const pool: ChoiceOption[] = Array.isArray(choice.definition.pool) ? choice.definition.pool : [];

        if (style === 'filtered_item') {
          const constraint = choice.definition.itemFilter ?? {};
          return (
            <View key={choice.id} style={styles.choiceBlock}>
              <Text style={styles.choicePrompt}>{choice.definition.prompt}</Text>
              <Pressable style={styles.filteredBtn} onPress={() => openFilteredItemPicker(choice)}>
                <Text style={styles.filteredBtnTxt}>Choose {choice.definition.count} {describeConstraint(constraint)} →</Text>
              </Pressable>
              <Pressable style={styles.skipChoiceBtn} onPress={() => removeEquipmentChoice(choice.id)}><Text style={styles.skipChoiceTxt}>No item / Skip this choice</Text></Pressable>
            </View>
          );
        }

        const chosen = legacySelections[choice.id] ?? [];
        const max = choice.definition.count;
        return (
          <View key={choice.id} style={styles.choiceBlock}>
            <Text style={styles.choicePrompt}>{choice.definition.prompt}</Text>
            {max > 1 && (
              <Text style={styles.multiHint}>Selected {chosen.length}/{max}, Remaining {max - chosen.length}</Text>
            )}
            <Pressable style={styles.skipChoiceBtn} onPress={() => removeEquipmentChoice(choice.id)}><Text style={styles.skipChoiceTxt}>No item / Skip this choice</Text></Pressable>
            {pool.map(opt => {
              const isSelected = chosen.includes(opt.id);
              return (
                <Pressable
                  key={opt.id}
                  style={[styles.option, isSelected && styles.optionSelected]}
                  onPress={() => style ? chooseNewOption(choice, opt) : chooseLegacyOption(choice, opt.id)}
                >
                  <View style={[styles.radio, isSelected && styles.radioSelected]} />
                  <Text style={[styles.optionText, isSelected && styles.optionTextSelected]}>
                    {opt.label}
                    {opt.itemFilter ? ` (choose ${opt.itemFilter.quantity} ${describeConstraint(opt.itemFilter.constraint)})` : ''}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        );
      })}

      <View style={styles.additionalSection}>
        <Text style={styles.sectionHeading}>Additional Equipment</Text>
        {additionalFeedback && <Text style={styles.addedFeedback}>✓ {additionalFeedback}</Text>}
        {additionalEquipment(entity).map(item => (
          <View key={item.acquisitionSourceId} style={styles.additionalItemRow}>
            <Text style={styles.ownedItem}>• {itemName(item.itemId)}</Text>
            <Pressable style={styles.choiceActionBtn} onPress={() => removeManualItem(item.acquisitionSourceId!)}><Text style={styles.removeBtnTxt}>Remove</Text></Pressable>
          </View>
        ))}
        <Pressable testID="equipment-additional-item" accessibilityLabel="Add Additional Item" style={styles.addItemBtn} onPress={() => setAddFlow('menu')}>
          <Text style={styles.addItemBtnTxt}>+ Add Additional Item</Text>
        </Pressable>
      </View>

      {equipChoices.length > 0 && <Pressable testID="equipment-skip-remaining" accessibilityLabel="Skip remaining equipment" style={styles.skipRemainingBtn} onPress={() => setDraft(skipRemainingEquipment(entity))}><Text style={styles.skipChoiceTxt}>Skip remaining equipment</Text></Pressable>}
    </ScrollView>
    <SafeBottomView>
      <View style={styles.footer}>
        <Pressable
          style={[styles.nextBtn, !canProceed && styles.nextBtnDisabled]}
          onPress={handleConfirm}
          disabled={!canProceed}
        >
          <Text style={styles.nextBtnText}>Next: Spells →</Text>
        </Pressable>
      </View>
    </SafeBottomView>

      {activePicker && (
        <ItemPickerModal
          visible
          title={activePicker.title}
          mode="required"
          constraint={activePicker.constraint}
          quantity={activePicker.quantity}
          selected={activePicker.selected}
          onSelectedChange={next => setActivePicker(p => p ? { ...p, selected: next } : p)}
          browseStateKey={`equipment_required:${activePicker.choiceId}`}
          onConfirmRequired={handlePickerConfirm}
          onClose={() => setActivePicker(null)}
        />
      )}

      {(addFlow === 'library' || addFlow === 'homebrew') && (
        <ItemPickerModal
          visible
          title={addFlow === 'homebrew' ? 'Browse Homebrew' : 'Browse Item Library'}
          mode="additional"
          initialOfficialFilter={addFlow === 'homebrew' ? 'homebrew' : 'official'}
          onAddAdditional={addManualItem}
          onClose={() => setAddFlow('closed')}
        />
      )}

      {addFlow === 'menu' && (
        <Modal visible transparent animationType="fade" onRequestClose={() => setAddFlow('closed')}>
          <Pressable style={styles.backdrop} onPress={() => setAddFlow('closed')}>
            <Pressable style={[styles.menuSheet, { paddingBottom: scrollBottomPadding(insets.bottom, Spacing.md) }]} onPress={e => e.stopPropagation()}>
              <Text style={styles.menuTitle}>Add Additional Item</Text>
              <Pressable style={styles.menuBtn} onPress={() => setAddFlow('library')}>
                <Text style={styles.menuBtnTxt}>Browse Item Library</Text>
              </Pressable>
              <Pressable style={styles.menuBtn} onPress={() => setAddFlow('homebrew')}>
                <Text style={styles.menuBtnTxt}>Browse Homebrew</Text>
              </Pressable>
              <Pressable style={styles.menuBtn} onPress={() => { setAddFlow('closed'); router.push('/homebrew/item-builder'); }}>
                <Text style={styles.menuBtnTxt}>Create New Homebrew Item</Text>
              </Pressable>
              <Pressable style={styles.menuBtn} onPress={() => setAddFlow('simple')}>
                <Text style={styles.menuBtnTxt}>Create Simple Custom Item</Text>
              </Pressable>
              <Pressable style={styles.menuCancel} onPress={() => setAddFlow('closed')}>
                <Text style={styles.menuCancelTxt}>Cancel</Text>
              </Pressable>
            </Pressable>
          </Pressable>
        </Modal>
      )}

      {addFlow === 'simple' && (
        <Modal visible transparent animationType="fade" onRequestClose={() => setAddFlow('closed')}>
          <Pressable style={styles.backdrop} onPress={() => setAddFlow('closed')}>
            <Pressable style={[styles.menuSheet, { paddingBottom: scrollBottomPadding(insets.bottom, Spacing.md) }]} onPress={e => e.stopPropagation()}>
              <Text style={styles.menuTitle}>Create Simple Custom Item</Text>
              <TextInput style={styles.input} value={scName} onChangeText={setScName} placeholder="Item name" placeholderTextColor={Colors.textDim} />
              <TextInput style={styles.input} value={scProps} onChangeText={setScProps} placeholder="Properties (comma-separated, optional)" placeholderTextColor={Colors.textDim} />
              <TextInput style={[styles.input, styles.inputMulti]} value={scDesc} onChangeText={setScDesc} placeholder="Description (optional)" placeholderTextColor={Colors.textDim} multiline />
              <Pressable style={[styles.nextBtn, !scName.trim() && styles.nextBtnDisabled]} disabled={!scName.trim()} onPress={() => { void handleCreateSimpleCustom(); }}>
                <Text style={styles.nextBtnText}>Create & Add</Text>
              </Pressable>
              <Pressable style={styles.menuCancel} onPress={() => setAddFlow('closed')}>
                <Text style={styles.menuCancelTxt}>Cancel</Text>
              </Pressable>
            </Pressable>
          </Pressable>
        </Modal>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  content:   { padding: Spacing.lg },
  footer:    { paddingHorizontal: Spacing.lg, paddingTop: Spacing.sm },
  heading:   { fontSize: FontSize.xxl, fontWeight: FontWeight.black, color: Colors.gold, marginBottom: Spacing.xs },
  sub:       { fontSize: FontSize.md, color: Colors.textSecondary, marginBottom: Spacing.md },
  progressPanel: {
    backgroundColor: Colors.surface, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border,
    padding: Spacing.md, marginBottom: Spacing.lg,
  },
  progressHeading: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.textPrimary, marginBottom: Spacing.sm },
  groupRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  groupChip: {
    fontSize: FontSize.xs, color: Colors.textSecondary, backgroundColor: Colors.surfaceHigh,
    borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: Spacing.sm, paddingVertical: 3,
  },
  ineligibleBanner: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    backgroundColor: Colors.red + '18', borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.red + '66',
    padding: Spacing.md, marginBottom: Spacing.lg,
  },
  ineligibleBannerTxt: { flex: 1, fontSize: FontSize.sm, color: Colors.textPrimary },
  ineligibleBannerDismiss: { fontSize: FontSize.md, color: Colors.textSecondary, fontWeight: FontWeight.bold },
  resolvedBlock: { marginBottom: Spacing.lg },
  choiceBlock:  { marginBottom: Spacing.xl },
  choicePrompt: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.textPrimary, marginBottom: Spacing.md },
  multiHint: { fontSize: FontSize.sm, color: Colors.gold, fontWeight: FontWeight.bold, marginBottom: Spacing.sm },
  option: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    padding: Spacing.md, borderRadius: Radius.md,
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    marginBottom: Spacing.sm,
  },
  optionSelected:     { borderColor: Colors.gold },
  radio:              { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: Colors.border },
  radioSelected:      { borderColor: Colors.gold, backgroundColor: Colors.gold },
  optionText:         { fontSize: FontSize.md, color: Colors.textPrimary, flex: 1 },
  optionTextSelected: { color: Colors.gold, fontWeight: FontWeight.bold },
  filteredBtn: {
    backgroundColor: Colors.surface, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.gold,
    padding: Spacing.md, alignItems: 'center',
  },
  filteredBtnTxt: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.gold },
  additionalSection: {
    marginTop: Spacing.md, marginBottom: Spacing.lg, paddingTop: Spacing.lg,
    borderTopWidth: 1, borderTopColor: Colors.border,
  },
  sectionHeading: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.textPrimary, marginBottom: Spacing.sm },
  addItemBtn: {
    borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border,
    paddingVertical: Spacing.sm, alignItems: 'center', marginTop: Spacing.sm,
  },
  changeContext: { backgroundColor: Colors.surface, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.gold, padding: Spacing.md, marginBottom: Spacing.md },
  changeContextTitle: { color: Colors.gold, fontSize: FontSize.lg, fontWeight: FontWeight.bold },
  changeContextCurrent: { color: Colors.textPrimary, fontSize: FontSize.md, marginTop: Spacing.xs },
  changeContextHint: { color: Colors.textDim, fontSize: FontSize.sm, marginTop: Spacing.xs },
  additionalItemRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.sm, marginBottom: Spacing.xs },
  addedFeedback: { color: Colors.green, fontWeight: FontWeight.bold, marginBottom: Spacing.sm },
  addItemBtnTxt: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  nextBtn: {
    backgroundColor: Colors.gold, borderRadius: Radius.md,
    paddingVertical: Spacing.md, alignItems: 'center', marginTop: Spacing.lg,
  },
  nextBtnDisabled: { backgroundColor: Colors.goldDim },
  nextBtnText: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.bg },
  ownedItem: { fontSize: FontSize.md, color: Colors.textPrimary, marginBottom: Spacing.xs },
  resolvedChoiceRow: { gap: Spacing.xs, marginBottom: Spacing.sm },
  resolvedActions: { flexDirection: 'row', alignItems: 'stretch', gap: Spacing.sm },
  choiceActionBtn: { minWidth: 96, minHeight: 44, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center' },
  removeBtn: { minWidth: 96, minHeight: 44, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.red, alignItems: 'center', justifyContent: 'center' },
  removeBtnTxt: { color: Colors.red, fontWeight: FontWeight.bold },
  skipChoiceBtn: { padding: Spacing.sm, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, marginBottom: Spacing.xs },
  skipRemainingBtn: { padding: Spacing.md, alignItems: 'center' },
  skipChoiceTxt: { color: Colors.textSecondary, fontWeight: FontWeight.bold },
  changeBtn: { minWidth: 96, minHeight: 44, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.gold, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, alignItems: 'center', justifyContent: 'center' },
  changeBtnTxt: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.gold },
  backdrop: { flex: 1, backgroundColor: '#000000cc', justifyContent: 'flex-end' },
  menuSheet: {
    backgroundColor: Colors.surfaceHigh, borderTopLeftRadius: Radius.lg, borderTopRightRadius: Radius.lg,
    padding: Spacing.lg, gap: Spacing.sm,
  },
  menuTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary, marginBottom: Spacing.sm },
  menuBtn: {
    backgroundColor: Colors.surface, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border,
    padding: Spacing.md, alignItems: 'center',
  },
  menuBtnTxt: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  menuCancel: { alignItems: 'center', padding: Spacing.sm, marginTop: Spacing.xs },
  menuCancelTxt: { fontSize: FontSize.md, color: Colors.textSecondary },
  input: {
    backgroundColor: Colors.surface, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border,
    padding: Spacing.sm, color: Colors.textPrimary, fontSize: FontSize.md,
  },
  inputMulti: { minHeight: 60, textAlignVertical: 'top' },
});
