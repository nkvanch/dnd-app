// app/dm/encounter.tsx
// Initiative tracker + combat encounter manager (DM only).
import { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, Pressable, StyleSheet,
  TextInput, Modal, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useCombatStore }    from '../../src/store/combatStore';
import { useCampaignStore }  from '../../src/store/campaignStore';
import { useCharacterStore } from '../../src/store/characterStore';
import { useSessionStore }   from '../../src/store/sessionStore';
import { applyDamage, applyHealing } from '../../src/engine/combat';
import { applyCondition, removeCondition } from '../../src/engine/conditions';
import { expireOverrides } from '../../src/engine/dmOverride';
import { useSafeGoBack } from '../../src/hooks/useSafeGoBack';
import { recomputeDerived } from '../../src/engine/pipeline';
import { Entity, CampaignRules } from '../../src/engine/types';
import { InitiativeEntry } from '../../src/engine/combat';
import { DEFAULT_RULES } from '../../src/store/characterStore';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../../src/theme';

const KNOWN_CONDITIONS = [
  'blinded','charmed','deafened','exhaustion','frightened',
  'grappled','incapacitated','invisible','paralyzed','petrified',
  'poisoned','prone','restrained','stunned','unconscious',
];

// ── Inline Quick Panel ────────────────────────────────────────────────────────

interface QuickPanelProps {
  entity:    Entity;
  rules:     CampaignRules;
  onUpdate:  (updated: Entity) => void;
  onClose:   () => void;
}

function QuickPanel({ entity, rules, onUpdate, onClose }: QuickPanelProps) {
  const [mode,     setMode]     = useState<'damage'|'heal'|'condition'|null>(null);
  const [valueStr, setValueStr] = useState('');
  const [condSearch, setCondSearch] = useState('');

  const amount = parseInt(valueStr, 10);
  const validNum = !isNaN(amount) && amount > 0;

  function submitDamage() {
    if (!validNum) return;
    onUpdate(applyDamage(entity, amount, rules));
    setMode(null); setValueStr('');
  }

  function submitHeal() {
    if (!validNum) return;
    onUpdate(applyHealing(entity, amount, rules));
    setMode(null); setValueStr('');
  }

  function submitKill() {
    Alert.alert('Kill', `Set ${entity.identity.name}'s HP to 0?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Kill', style: 'destructive', onPress: () => {
        const updated = { ...entity, resources: { ...entity.resources, hp: { ...entity.resources.hp, current: 0 } } };
        onUpdate(recomputeDerived(updated, rules));
      }},
    ]);
  }

  const filteredConds = KNOWN_CONDITIONS.filter(c =>
    c.includes(condSearch.toLowerCase()) && !entity.conditions.some(ac => ac.id === c)
  );

  return (
    <View style={styles.quickPanel}>
      <View style={styles.quickHeader}>
        <Text style={styles.quickName}>{entity.identity.name}</Text>
        <Text style={styles.quickHp}>
          {entity.resources.hp.current}/{entity.resources.hp.maximum} HP
        </Text>
        <Pressable onPress={onClose}><Text style={styles.closeTxt}>✕</Text></Pressable>
      </View>

      {/* Action buttons */}
      <View style={styles.quickBtns}>
        <Pressable style={[styles.qBtn, styles.qBtnRed]} onPress={() => setMode('damage')}>
          <Text style={styles.qBtnTxt}>⚔️ Damage</Text>
        </Pressable>
        <Pressable style={[styles.qBtn, styles.qBtnGreen]} onPress={() => setMode('heal')}>
          <Text style={styles.qBtnTxt}>💚 Heal</Text>
        </Pressable>
        <Pressable style={[styles.qBtn, styles.qBtnPurple]} onPress={() => setMode('condition')}>
          <Text style={styles.qBtnTxt}>🔮 Cond</Text>
        </Pressable>
        <Pressable style={[styles.qBtn, styles.qBtnDark]} onPress={submitKill}>
          <Text style={styles.qBtnTxt}>💀 Kill</Text>
        </Pressable>
      </View>

      {/* Number input for damage/heal */}
      {(mode === 'damage' || mode === 'heal') && (
        <View style={styles.inputRow}>
          <TextInput
            style={styles.numInput}
            value={valueStr}
            onChangeText={setValueStr}
            keyboardType="number-pad"
            placeholder="Amount"
            placeholderTextColor={Colors.textDim}
            autoFocus
          />
          <Pressable
            style={[styles.submitBtn, !validNum && styles.btnDisabled]}
            onPress={mode === 'damage' ? submitDamage : submitHeal}
            disabled={!validNum}
          >
            <Text style={styles.submitBtnTxt}>{mode === 'damage' ? 'Apply Damage' : 'Apply Heal'}</Text>
          </Pressable>
        </View>
      )}

      {/* Condition picker */}
      {mode === 'condition' && (
        <View style={styles.condPicker}>
          <TextInput
            style={styles.condSearch}
            value={condSearch}
            onChangeText={setCondSearch}
            placeholder="Search conditions…"
            placeholderTextColor={Colors.textDim}
          />
          {/* Active conditions with remove */}
          {entity.conditions.map(c => (
            <Pressable key={c.id} style={styles.condRowItem} onPress={() => {
              onUpdate(removeCondition(entity, c.id, rules));
            }}>
              <Text style={styles.condItemTxt}>{c.id} (tap to remove)</Text>
            </Pressable>
          ))}
          {/* Add new condition */}
          {filteredConds.map(c => (
            <Pressable key={c} style={[styles.condRowItem, styles.condRowAdd]} onPress={() => {
              onUpdate(applyCondition(entity, c, 'dm', rules));
              setCondSearch('');
            }}>
              <Text style={styles.condItemTxt}>+ {c}</Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

// ── Combatant Row ─────────────────────────────────────────────────────────────

interface CombatantRowProps {
  entry:      InitiativeEntry;
  entity:     Entity | undefined;
  isCurrent:  boolean;
  onPress:    () => void;
}

function CombatantRow({ entry, entity, isCurrent, onPress }: CombatantRowProps) {
  const hp     = entity?.resources.hp;
  const hpPct  = hp && hp.maximum > 0 ? hp.current / hp.maximum : 0;

  // Player-facing visibility: Bloodied / Healthy / Dead only
  const isMonster = entity?.kind === 'monster';
  const isDead    = hp ? hp.current <= 0 : false;
  const isBloodied = hp ? hp.current < hp.maximum / 2 : false;

  const statusLabel = isDead ? '💀 Dead'
    : isBloodied ? '🩸 Bloodied'
    : '✅ Healthy';

  const hpColor = hpPct > 0.5 ? Colors.green : hpPct > 0.25 ? Colors.gold : Colors.red;

  return (
    <Pressable
      style={[styles.combatantRow, isCurrent && styles.combatantRowActive]}
      onPress={onPress}
    >
      <View style={styles.initBox}>
        <Text style={styles.initNum}>{entry.initiative}</Text>
      </View>

      <View style={styles.combatantInfo}>
        <Text style={styles.combatantName}>{entry.name}</Text>
        {entity && (
          <View style={styles.combatantStatus}>
            {/* DM sees full HP; players see status label only */}
            {!isMonster && hp && (
              <View style={styles.hpBarOuter}>
                <View style={[styles.hpBarFill, {
                  width: `${Math.round(Math.max(0,Math.min(1,hpPct))*100)}%` as any,
                  backgroundColor: hpColor,
                }]} />
              </View>
            )}
            <Text style={styles.statusLbl}>{statusLabel}</Text>
            {/* Conditions */}
            {entity.conditions.slice(0,3).map(c => (
              <View key={c.id} style={styles.condChip}>
                <Text style={styles.condChipTxt}>{c.id.slice(0,6)}</Text>
              </View>
            ))}
          </View>
        )}
      </View>

      {isCurrent && (
        <View style={styles.currentIndicator}>
          <Text style={styles.currentIndicatorTxt}>▶</Text>
        </View>
      )}
    </Pressable>
  );
}

// ── Encounter Screen ──────────────────────────────────────────────────────────

export default function EncounterScreen() {
  const router          = useRouter();
  const safeGoBack      = useSafeGoBack('/(tabs)');
  const isDm            = useCampaignStore(s => s.isDm);
  const characters      = useCharacterStore(s => s.characters);
  const updateCharacter = useCharacterStore(s => s.updateCharacter);
  const session         = useSessionStore(s => s.session);
  const rules           = useCharacterStore(s => s.rules) ?? DEFAULT_RULES;

  const { combat, entities, startCombat, advanceTurn, endCombat, updateEntity, setInitiative } =
    useCombatStore();

  const [selectedId, setSelectedId]  = useState<string | null>(null);
  const [setupMode,  setSetupMode]   = useState(!combat.active);

  // Selected entity for the quick panel
  const selectedEntity = entities.find(e => e.id === selectedId);

  function handleEntityUpdate(updated: Entity) {
    updateEntity(updated.id, () => updated);
    // If it's a player character, persist to store too
    if (updated.kind === 'character') {
      updateCharacter(updated.id, () => updated);
    }
  }

  // ── Setup mode: add party characters ─────────────────────────────────────

  function handleStartCombat() {
    if (entities.length === 0) {
      Alert.alert('No combatants', 'Add at least one entity before starting.');
      return;
    }
    const encounterId = `enc_${Date.now()}`;
    startCombat(entities, encounterId);
    setSetupMode(false);
  }

  function addPartyMember(c: Entity) {
    updateEntity(c.id, () => c); // Add to combat entities
    useCombatStore.setState(s => ({
      entities: s.entities.some(e => e.id === c.id) ? s.entities : [...s.entities, c],
    }));
  }

  function removeFromEncounter(id: string) {
    useCombatStore.setState(s => ({
      entities: s.entities.filter(e => e.id !== id),
    }));
  }

  function handleEndEncounter() {
    Alert.alert('End Encounter', 'End this encounter?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'End Encounter',
        onPress: () => {
          // Expire end_of_encounter DM overrides on all entities
          entities.forEach(e => {
            if (e.kind === 'character') {
              const updated = expireOverrides(e, 'end_of_encounter', rules);
              updateCharacter(e.id, () => updated);
            }
          });
          endCombat();
          safeGoBack();
        },
      },
    ]);
  }

  if (!isDm) {
    return (
      <View style={styles.screen}>
        <View style={styles.center}><Text style={styles.errorTxt}>DM access only.</Text></View>
      </View>
    );
  }

  // ── Setup view ─────────────────────────────────────────────────────────────

  if (setupMode) {
    return (
      <View style={styles.screen}>
        <View style={styles.header}>
          <Pressable style={styles.backBtn} onPress={safeGoBack}>
            <Text style={styles.backTxt}>← Back</Text>
          </Pressable>
          <Text style={styles.title}>Set Up Encounter</Text>
        </View>

        <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
          <Text style={styles.sectionLabel}>ADD COMBATANTS</Text>
          {characters.map(c => {
            const inCombat = entities.some(e => e.id === c.id);
            return (
              <View key={c.id} style={styles.setupRow}>
                <Text style={styles.setupName}>
                  {c.identity.name} — Lv {c.identity.level} {c.identity.classId}
                </Text>
                <Pressable
                  style={[styles.addBtn, inCombat && styles.addBtnAdded]}
                  onPress={() => inCombat ? removeFromEncounter(c.id) : addPartyMember(c)}
                >
                  <Text style={styles.addBtnTxt}>{inCombat ? 'Remove' : '+ Add'}</Text>
                </Pressable>
              </View>
            );
          })}

          <Pressable style={styles.startBtn} onPress={handleStartCombat}>
            <Text style={styles.startBtnTxt}>⚔️ Start Combat ({entities.length} combatants)</Text>
          </Pressable>
        </ScrollView>
      </View>
    );
  }

  // ── Active combat view ─────────────────────────────────────────────────────

  const currentEntry = combat.order[combat.turnIndex];

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={safeGoBack}>
          <Text style={styles.backTxt}>← Back</Text>
        </Pressable>
        <View>
          <Text style={styles.title}>Round {combat.round}</Text>
          <Text style={styles.turnLabel}>
            Turn: {currentEntry?.name ?? '—'}
          </Text>
        </View>
        <Pressable style={styles.endBtn} onPress={handleEndEncounter}>
          <Text style={styles.endBtnTxt}>End</Text>
        </Pressable>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        {/* Initiative order */}
        {combat.order.map((entry, idx) => {
          const ent = entities.find(e => e.id === entry.entityId);
          return (
            <CombatantRow
              key={entry.entityId}
              entry={entry}
              entity={ent}
              isCurrent={idx === combat.turnIndex}
              onPress={() => setSelectedId(
                selectedId === entry.entityId ? null : entry.entityId
              )}
            />
          );
        })}

        {/* Quick panel for selected combatant */}
        {selectedEntity && (
          <QuickPanel
            entity={selectedEntity}
            rules={rules}
            onUpdate={handleEntityUpdate}
            onClose={() => setSelectedId(null)}
          />
        )}
      </ScrollView>

      {/* End Turn bar */}
      <View style={styles.turnBar}>
        <Pressable style={styles.endTurnBtn} onPress={() => advanceTurn(rules)}>
          <Text style={styles.endTurnTxt}>End Turn →</Text>
        </Pressable>
      </View>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  errorTxt: { color: Colors.red, fontSize: FontSize.lg },

  header: {
    backgroundColor: Colors.surfaceHigh,
    paddingTop: Spacing.xl + 8, paddingBottom: Spacing.md,
    paddingHorizontal: Spacing.md,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  backBtn:   { paddingRight: Spacing.sm },
  backTxt:   { color: Colors.gold, fontSize: FontSize.md, fontWeight: FontWeight.bold },
  title:     { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  turnLabel: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 2 },
  endBtn: {
    backgroundColor: Colors.red + '33', borderRadius: Radius.md,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    borderWidth: 1, borderColor: Colors.red + '66',
  },
  endBtnTxt: { color: Colors.red, fontWeight: FontWeight.bold, fontSize: FontSize.sm },

  scroll:       { flex: 1 },
  content:      { padding: Spacing.sm, gap: Spacing.sm, paddingBottom: Spacing.xxl },
  sectionLabel: { fontSize: FontSize.xs, color: Colors.textSecondary, letterSpacing: 2, fontWeight: FontWeight.bold, padding: Spacing.sm },

  combatantRow: {
    backgroundColor: Colors.surface, borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.border,
    padding: Spacing.sm, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
  },
  combatantRowActive: { borderColor: Colors.gold, backgroundColor: Colors.gold + '11' },
  initBox: {
    width: 44, height: 44, borderRadius: Radius.md,
    backgroundColor: Colors.surfaceHigh, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.border,
  },
  initNum:        { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.gold },
  combatantInfo:  { flex: 1, gap: 4 },
  combatantName:  { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  combatantStatus:{ flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, flexWrap: 'wrap' },
  hpBarOuter: { width: 60, height: 4, backgroundColor: Colors.border, borderRadius: Radius.full, overflow: 'hidden' },
  hpBarFill:  { height: '100%', borderRadius: Radius.full },
  statusLbl:  { fontSize: FontSize.xs, color: Colors.textSecondary },
  condChip: {
    backgroundColor: Colors.purple + '33', borderRadius: Radius.full,
    paddingHorizontal: 4, paddingVertical: 1,
  },
  condChipTxt: { fontSize: 10, color: Colors.textPrimary },
  currentIndicator:    { width: 20, alignItems: 'center' },
  currentIndicatorTxt: { color: Colors.gold, fontSize: FontSize.md },

  // Quick panel
  quickPanel: {
    backgroundColor: Colors.surfaceHigh, borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.gold + '44',
    padding: Spacing.md, gap: Spacing.sm,
  },
  quickHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  quickName:   { flex: 1, fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  quickHp:     { fontSize: FontSize.sm, color: Colors.textSecondary },
  closeTxt:    { fontSize: FontSize.md, color: Colors.textDim, padding: 4 },
  quickBtns:   { flexDirection: 'row', gap: Spacing.xs },
  qBtn: { flex: 1, borderRadius: Radius.md, padding: Spacing.xs, alignItems: 'center', borderWidth: 1 },
  qBtnRed:    { backgroundColor: Colors.red + '22',    borderColor: Colors.red + '66' },
  qBtnGreen:  { backgroundColor: Colors.green + '22',  borderColor: Colors.green + '66' },
  qBtnPurple: { backgroundColor: Colors.purple + '22', borderColor: Colors.purple + '66' },
  qBtnDark:   { backgroundColor: Colors.surfaceHigh,   borderColor: Colors.border },
  qBtnTxt:    { fontSize: FontSize.xs, color: Colors.textPrimary, fontWeight: FontWeight.bold },

  inputRow:      { flexDirection: 'row', gap: Spacing.sm, alignItems: 'center' },
  numInput: {
    flex: 1, backgroundColor: Colors.surface, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border,
    padding: Spacing.sm, color: Colors.textPrimary, fontSize: FontSize.lg, textAlign: 'center',
  },
  submitBtn:     { backgroundColor: Colors.gold, borderRadius: Radius.md, padding: Spacing.sm },
  btnDisabled:   { opacity: 0.4 },
  submitBtnTxt:  { color: Colors.bg, fontWeight: FontWeight.bold, fontSize: FontSize.sm },

  condPicker:   { gap: Spacing.xs },
  condSearch: {
    backgroundColor: Colors.surface, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border,
    padding: Spacing.sm, color: Colors.textPrimary,
  },
  condRowItem: {
    paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  condRowAdd:  { opacity: 0.8 },
  condItemTxt: { fontSize: FontSize.sm, color: Colors.textPrimary, textTransform: 'capitalize' },

  // Setup mode
  setupRow: {
    backgroundColor: Colors.surface, borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.border,
    padding: Spacing.sm, flexDirection: 'row', alignItems: 'center',
  },
  setupName: { flex: 1, fontSize: FontSize.md, color: Colors.textPrimary },
  addBtn: {
    backgroundColor: Colors.gold, borderRadius: Radius.md,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs,
  },
  addBtnAdded: { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  addBtnTxt:   { color: Colors.bg, fontWeight: FontWeight.bold, fontSize: FontSize.sm },
  startBtn: {
    backgroundColor: Colors.red, borderRadius: Radius.lg,
    padding: Spacing.md, alignItems: 'center', marginTop: Spacing.md,
  },
  startBtnTxt: { color: Colors.white, fontWeight: FontWeight.bold, fontSize: FontSize.lg },

  turnBar: {
    backgroundColor: Colors.surfaceHigh, borderTopWidth: 1, borderTopColor: Colors.border,
    padding: Spacing.sm,
  },
  endTurnBtn: {
    backgroundColor: Colors.gold, borderRadius: Radius.md,
    padding: Spacing.md, alignItems: 'center',
  },
  endTurnTxt: { color: Colors.bg, fontWeight: FontWeight.bold, fontSize: FontSize.lg },
});
