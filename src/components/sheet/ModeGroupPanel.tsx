// src/components/sheet/ModeGroupPanel.tsx
// The Features-tab control for a class's Mode Group (engine/modes.ts) — Emperor Warlock's Legacy
// Binding is the first user. Shows the active option and a [Change] button; the change dialog asks
// for the result of the player's OWN die roll(s) (the app never rolls for content selection), lets
// the player spend the group's reroll, offers free choice once the class unlocks it, and shows what
// will go away before confirming. No calendar: pressing the button IS the new period.
import { useMemo, useState } from 'react';
import { View, Text, Pressable, TextInput, ScrollView, Modal, StyleSheet } from 'react-native';
import { Entity, CampaignRules, ModeGroup } from '../../engine/types';
import {
  modeGroupsForEntity, activeModeOption, modeClassLevel, modeDiceCount, optionForRoll, modeAllowsFreeChoice,
  modeRerollAvailable, spendModeReroll, switchModeOption, previewModeSwitch,
} from '../../engine/modes';
import { useHomebrewStore } from '../../store/homebrewStore';
import { getSubclassEntryMerged } from '../../content/subclasses/subclassBrowse';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../../theme';

interface Props {
  entity: Entity;
  rules: CampaignRules;
  onEntityUpdate: (updated: Entity) => void;
}

export function ModeGroupPanel({ entity, rules, onEntityUpdate }: Props) {
  const getDB = useHomebrewStore(s => s.getMergedContentDB);
  const homebrewSubclasses = useHomebrewStore(s => s.subclasses);
  const groups = useMemo(() => modeGroupsForEntity(entity, getDB().classes), [entity.identity.classId, entity.identity.classes, getDB]);
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  if (groups.length === 0) return null;

  return (
    <>
      {groups.map(group => (
        <GroupCard key={group.id} group={group} entity={entity} homebrewSubclasses={homebrewSubclasses} onChange={() => setOpenGroup(group.id)} />
      ))}
      {groups.filter(g => g.id === openGroup).map(group => (
        <ChangeDialog
          key={group.id} group={group} entity={entity} rules={rules} homebrewSubclasses={homebrewSubclasses}
          onEntityUpdate={onEntityUpdate} onClose={() => setOpenGroup(null)}
        />
      ))}
    </>
  );
}

function optionName(group: ModeGroup, optionId: string | null, subclasses: ReturnType<typeof useHomebrewStore.getState>['subclasses']): string {
  if (!optionId) return 'None yet';
  return getSubclassEntryMerged(group.classId, optionId, subclasses)?.name ?? optionId;
}

function GroupCard({ group, entity, homebrewSubclasses, onChange }: {
  group: ModeGroup; entity: Entity; homebrewSubclasses: ReturnType<typeof useHomebrewStore.getState>['subclasses']; onChange: () => void;
}) {
  const active = activeModeOption(entity, group);
  return (
    <View style={styles.card}>
      <View style={{ flex: 1 }}>
        <Text style={styles.kicker}>{group.name.toUpperCase()}</Text>
        <Text style={styles.title}>{group.optionLabel}: {optionName(group, active, homebrewSubclasses)}</Text>
        <Text style={styles.sub}>Class level {modeClassLevel(entity, group)} · a new {group.periodLabel} replaces it</Text>
      </View>
      <Pressable style={styles.changeBtn} onPress={onChange} accessibilityLabel={`Change ${group.optionLabel}`}>
        <Text style={styles.changeBtnTxt}>Change</Text>
      </Pressable>
    </View>
  );
}

function ChangeDialog({ group, entity, rules, homebrewSubclasses, onEntityUpdate, onClose }: {
  group: ModeGroup; entity: Entity; rules: CampaignRules;
  homebrewSubclasses: ReturnType<typeof useHomebrewStore.getState>['subclasses'];
  onEntityUpdate: (updated: Entity) => void; onClose: () => void;
}) {
  const level = modeClassLevel(entity, group);
  const dice = modeDiceCount(group, level);
  const free = modeAllowsFreeChoice(group, level);
  const [rolls, setRolls] = useState<string[]>(Array.from({ length: dice }, () => ''));
  const [picked, setPicked] = useState<string | null>(null);     // the option the player settles on
  const active = activeModeOption(entity, group);

  const parsed = rolls.map(r => parseInt(r, 10));
  const outcomes = parsed.map(v => (Number.isFinite(v) ? optionForRoll(group, v) : null));
  const chosen = free ? picked : dice > 1 ? picked : outcomes[0];
  const valid = !!chosen && group.optionIds.includes(chosen);

  const progression = chosen ? getSubclassEntryMerged(group.classId, chosen, homebrewSubclasses)?.progression : undefined;
  const preview = chosen && progression ? previewModeSwitch(entity, group, chosen, progression) : null;

  function confirm() {
    if (!chosen || !progression) return;
    onEntityUpdate(switchModeOption(entity, group, chosen, progression, rules));
    onClose();
  }
  function reroll() {
    onEntityUpdate(spendModeReroll(entity, group));
    setRolls(Array.from({ length: dice }, () => ''));
    setPicked(null);
  }

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.sheet}>
          <Text style={styles.sheetTitle}>A new {group.periodLabel} begins</Text>
          <Text style={styles.sheetNote}>
            {free
              ? `Choose any ${group.optionLabel.toLowerCase()}.`
              : `Roll ${dice === 1 ? 'a d' : `${dice} d`}${group.selector.die} yourself and enter ${dice === 1 ? 'the result' : 'the results'}.${dice > 1 ? ' Then pick which one answers.' : ''}`}
          </Text>
          <ScrollView style={{ maxHeight: 360 }} contentContainerStyle={{ gap: Spacing.sm }} keyboardShouldPersistTaps="handled">
            {free ? (
              group.optionIds.map(id => (
                <Pressable key={id} style={[styles.row, picked === id && styles.rowOn]} onPress={() => setPicked(id)}>
                  <Text style={styles.rowTxt}>{optionName(group, id, homebrewSubclasses)}{id === active ? '  (current)' : ''}</Text>
                </Pressable>
              ))
            ) : (
              rolls.map((value, i) => (
                <View key={i} style={styles.rollRow}>
                  <TextInput
                    style={styles.input} value={value} keyboardType="number-pad" placeholder={`d${group.selector.die}`}
                    placeholderTextColor={Colors.textDim} maxLength={2}
                    onChangeText={t => setRolls(r => r.map((x, j) => j === i ? t.replace(/[^0-9]/g, '') : x))}
                  />
                  <Pressable
                    disabled={dice === 1 || !outcomes[i]} style={[styles.row, { flex: 1 }, dice > 1 && picked === outcomes[i] && styles.rowOn]}
                    onPress={() => outcomes[i] && setPicked(outcomes[i])}
                  >
                    <Text style={styles.rowTxt}>{outcomes[i] ? optionName(group, outcomes[i], homebrewSubclasses) : value ? 'Not on the table' : '—'}</Text>
                  </Pressable>
                </View>
              ))
            )}
            {!free && modeRerollAvailable(entity, group) && (
              <Pressable style={styles.rerollBtn} onPress={reroll}>
                <Text style={styles.rerollTxt}>Use the reroll (spends it) and roll again</Text>
              </Pressable>
            )}
            {preview && (
              <View style={styles.preview}>
                {chosen === active
                  ? <Text style={styles.previewTxt}>The same {group.optionLabel.toLowerCase()} answers again: nothing changes except your per-{group.periodLabel} abilities refresh.</Text>
                  : <>
                      {preview.leaving.length > 0 && <Text style={styles.previewTxt}>Becomes inactive: {preview.leaving.join(', ')}.</Text>}
                      {preview.arriving.length > 0 && <Text style={styles.previewTxt}>Arrives: {preview.arriving.join(', ')}.</Text>}
                      {preview.preservedResources.length > 0 && <Text style={styles.previewTxt}>Spent uses are remembered for: {preview.preservedResources.join(', ')}.</Text>}
                    </>}
              </View>
            )}
          </ScrollView>
          <View style={styles.actions}>
            <Pressable style={styles.cancelBtn} onPress={onClose}><Text style={styles.cancelTxt}>Cancel</Text></Pressable>
            <Pressable style={[styles.confirmBtn, !valid && { opacity: 0.4 }]} disabled={!valid} onPress={confirm}>
              <Text style={styles.confirmTxt}>Bind {valid && chosen ? optionName(group, chosen, homebrewSubclasses) : ''}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, backgroundColor: Colors.surface, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.gold, padding: Spacing.sm, marginBottom: Spacing.sm },
  kicker: { fontSize: FontSize.xs, color: Colors.gold, fontWeight: FontWeight.bold, letterSpacing: 0.5 },
  title: { fontSize: FontSize.md, color: Colors.textPrimary, fontWeight: FontWeight.bold },
  sub: { fontSize: FontSize.xs, color: Colors.textDim },
  changeBtn: { backgroundColor: Colors.gold, borderRadius: Radius.sm, paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs },
  changeBtnTxt: { color: Colors.bg, fontWeight: FontWeight.bold, fontSize: FontSize.sm },

  backdrop: { flex: 1, backgroundColor: '#000000cc', justifyContent: 'center', padding: Spacing.md },
  sheet: { backgroundColor: Colors.surfaceHigh, borderRadius: Radius.lg, padding: Spacing.md, gap: Spacing.sm },
  sheetTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.gold, textAlign: 'center' },
  sheetNote: { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center' },
  rollRow: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'center' },
  input: { width: 64, backgroundColor: Colors.surface, borderRadius: Radius.sm, borderWidth: 1, borderColor: Colors.border, padding: Spacing.sm, color: Colors.textPrimary, textAlign: 'center', fontSize: FontSize.md },
  row: { backgroundColor: Colors.surface, borderRadius: Radius.sm, borderWidth: 1, borderColor: Colors.border, padding: Spacing.sm },
  rowOn: { borderColor: Colors.gold },
  rowTxt: { color: Colors.textPrimary, fontSize: FontSize.md },
  rerollBtn: { alignItems: 'center', padding: Spacing.sm, borderRadius: Radius.sm, borderWidth: 1, borderColor: Colors.border },
  rerollTxt: { color: Colors.textSecondary, fontSize: FontSize.sm },
  preview: { backgroundColor: Colors.surface, borderRadius: Radius.sm, padding: Spacing.sm, gap: 4 },
  previewTxt: { color: Colors.textSecondary, fontSize: FontSize.xs },
  actions: { flexDirection: 'row', gap: Spacing.sm },
  cancelBtn: { flex: 1, backgroundColor: Colors.surface, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, padding: Spacing.md, alignItems: 'center' },
  cancelTxt: { color: Colors.textSecondary, fontWeight: FontWeight.bold, fontSize: FontSize.md },
  confirmBtn: { flex: 1, backgroundColor: Colors.gold, borderRadius: Radius.md, padding: Spacing.md, alignItems: 'center' },
  confirmTxt: { color: Colors.bg, fontWeight: FontWeight.bold, fontSize: FontSize.md },
});
