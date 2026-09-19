// app/dm/encounter.tsx
// Initiative tracker + combat encounter manager (DM only).
import { useState, useCallback, useMemo } from 'react';
import {
  View, Text, ScrollView, Pressable, StyleSheet,
  TextInput, Modal,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Alert } from '../../src/utils/alert';
import { useCombatStore }    from '../../src/store/combatStore';
import { useCampaignStore }  from '../../src/store/campaignStore';
import { useCharacterStore } from '../../src/store/characterStore';
import { useSessionStore }   from '../../src/store/sessionStore';
import { useEncounterStore } from '../../src/store/encounterStore';
import { useHomebrewStore }  from '../../src/store/homebrewStore';
import { applyDamage, applyHealing, applyWildShapeDamage } from '../../src/engine/combat';
import { applyCondition, removeCondition } from '../../src/engine/conditions';
import { generateActionCard } from '../../src/engine/actionCards';
import { applyActionCardUse } from '../../src/engine/actionUse';
import { ActivationOptionModal } from '../../src/components/sheet/TabActions';
import { useSpellPayment } from '../../src/components/sheet/SpellPaymentChooser';
import { expireOverrides } from '../../src/engine/dmOverride';
import { COMMON_DAMAGE_TYPES } from '../../src/content/traitCompiler';
import { useSafeGoBack } from '../../src/hooks/useSafeGoBack';
import { recomputeDerived } from '../../src/engine/pipeline';
import { Entity, CampaignRules, ActionCard, ActivationOption } from '../../src/engine/types';
import { deepDiff, deepMerge } from '../../src/sync/diff';
import { InitiativeEntry } from '../../src/engine/combat';
import { DEFAULT_RULES } from '../../src/store/characterStore';
import { ConcentrationModal } from '../../src/components/sheet/ConcentrationModal';
import { DmRulingModal } from '../../src/components/sheet/DmRulingModal';
import { instantiatePreparedEncounter, instantiateWave, startingCombatantCount } from '../../src/engine/preparedEncounter';
import { mergeMonsterIndex } from '../../src/content/contentResolution';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../../src/theme';

// Reads back the groupName a PreparedEncounter combatant was tagged with at
// spawn time (preparedEncounter.ts's withPrepMetadata writes it into the
// notes JSON blob alongside spawnMonster's own cr/size/type metadata) — the
// first runtime consumer of that field, used here to offer "select this
// group" as a multi-target shortcut. Best-effort: any entity without prep
// metadata (manually-added party members, monsters spawned outside a
// PreparedEncounter) simply has no group and isn't offered.
function entityGroupName(entity: Entity): string | undefined {
  try {
    const parsed = JSON.parse(entity.notes || '{}') as Record<string, unknown>;
    return typeof parsed.groupName === 'string' ? parsed.groupName : undefined;
  } catch { return undefined; }
}

// Same withPrepMetadata blob as entityGroupName above, reading its two
// sibling keys that previously had no reader anywhere — a DM's "Hidden"
// flag and per-combatant tactics note were persisted at prep time but had
// zero effect the moment combat started (audit finding HIDDEN-META-1).
function entityDmHidden(entity: Entity): boolean {
  try {
    const parsed = JSON.parse(entity.notes || '{}') as Record<string, unknown>;
    return parsed.dmHidden === true;
  } catch { return false; }
}
function entityCombatantNotes(entity: Entity): string | undefined {
  try {
    const parsed = JSON.parse(entity.notes || '{}') as Record<string, unknown>;
    return typeof parsed.combatantNotes === 'string' ? parsed.combatantNotes : undefined;
  } catch { return undefined; }
}


// ── Inline Quick Panel ────────────────────────────────────────────────────────

interface QuickPanelProps {
  entity:    Entity;
  rules:     CampaignRules;
  onUpdate:  (updated: Entity, label?: string) => void;
  onRuling:  () => void;
  onClose:   () => void;
}

function QuickPanel({ entity, rules, onUpdate, onRuling, onClose }: QuickPanelProps) {
  const [mode,     setMode]     = useState<'damage'|'heal'|'condition'|null>(null);
  const [valueStr, setValueStr] = useState('');
  const [damageType, setDamageType] = useState('');
  const [condSearch, setCondSearch] = useState('');
  const [concOpen,   setConcOpen]   = useState(false);
  const [concEntity, setConcEntity] = useState<Entity | null>(null);
  const [concDamage, setConcDamage] = useState(0);
  // Sourced from the merged content DB (not the hardcoded, official-only
  // KNOWN_CONDITIONS array this used to be) so homebrew conditions are
  // both pickable AND get their mechanical features attached on apply —
  // audit findings KNOWN_CONDITIONS-1 and CONTENT-8, which are the same
  // underlying gap seen from two angles and fixed together here.
  const getMergedContentDB = useHomebrewStore(s => s.getMergedContentDB);
  const allConditions = getMergedContentDB().conditions;

  const amount = parseInt(valueStr, 10);
  const validNum = !isNaN(amount) && amount > 0;

  // While Wild Shaped, damage/heal/kill must hit the BEAST's hp pool, not the
  // player's real HP underneath — same rule and same branch app/sheet/[id].tsx's
  // handleDamage/handleHeal already apply for the player's own controls.
  // These DM-facing controls previously always hit real HP unconditionally.
  // Wild Shape/companion damage deliberately skips the concentration check
  // below — neither concentrates.
  function submitDamage() {
    if (!validNum) return;
    const dt = damageType.trim() || undefined;
    const label = `${entity.identity.name}: took ${amount}${dt ? ` ${dt}` : ''} damage`;
    if (entity.wildShapeState?.active) {
      onUpdate(applyWildShapeDamage(entity, amount, rules), label);
    } else {
      const updated = applyDamage(entity, amount, rules, dt);
      onUpdate(updated, label);
      if (updated.spellcasting?.concentrating) {
        setConcEntity(updated);
        setConcDamage(amount);
        setConcOpen(true);
      }
    }
    setMode(null); setValueStr(''); setDamageType('');
  }

  function submitHeal() {
    if (!validNum) return;
    if (entity.wildShapeState?.active) { setMode(null); setValueStr(''); return; }
    onUpdate(applyHealing(entity, amount, rules), `${entity.identity.name}: healed ${amount}`);
    setMode(null); setValueStr('');
  }

  function submitKill() {
    Alert.alert('Kill', `Set ${entity.identity.name}'s HP to 0?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Kill', style: 'destructive', onPress: () => {
        const label = `${entity.identity.name}: set HP to 0 (Kill)`;
        if (entity.wildShapeState?.active) {
          onUpdate(applyWildShapeDamage(entity, entity.wildShapeState.beastHpMax, rules), label);
          return;
        }
        const updated = { ...entity, resources: { ...entity.resources, hp: { ...entity.resources.hp, current: 0 } } };
        onUpdate(recomputeDerived(updated, rules), label);
      }},
    ]);
  }

  // ENCOUNTER-PERF-2: was recomputed on every render/keystroke — same
  // pattern already fixed in TabCharacter.tsx (TABCHAR-PERF-1).
  const filteredConds = useMemo(() => allConditions
    .map(c => c.id)
    .filter(c => c.includes(condSearch.toLowerCase()) && !entity.conditions.some(ac => ac.id === c)),
    [allConditions, condSearch, entity.conditions]);

  // Legendary Actions — only shown when the entity actually has the pool
  // (a monster template with resources: [{resourceId:'legendary_actions',...}]).
  // Reuses the same ActionCard/applyActionCardUse machinery every player
  // action card already goes through — a legendary-action Feature is just a
  // Feature whose activation.resourceCost.resourceId is 'legendary_actions',
  // same generic ResourceCost mechanism spell slots already use. No preview
  // gate: matches this app's existing "direct, no-confirm" convention for
  // every other QuickPanel action (damage/heal/kill/condition).
  const { requestPayment, paymentChooser } = useSpellPayment(entity);
  const [pendingActivation, setPendingActivation] = useState<ActionCard | null>(null);
  function handleUseLegendaryCard(card: ActionCard, option?: ActivationOption) {
    if (!option && card.activation.options?.length) { setPendingActivation(card); return; }
    requestPayment(card, option, payment => {
      const updated = applyActionCardUse(entity, card, rules, option, payment);
      if (updated !== entity) onUpdate(updated, entity.identity.name + ': used ' + card.name);
    });
  }
  const legendaryPool = entity.resources.custom.find(r => r.id === 'legendary_actions');
  const legendaryCards = legendaryPool
    ? entity.features
        .filter(f => f.activation?.resourceCost?.resourceId === 'legendary_actions')
        .map(f => generateActionCard(f, entity))
        .filter((c): c is NonNullable<typeof c> => c !== null)
    : [];

  return (
    <View style={styles.quickPanel}>
      {paymentChooser}
      <ActivationOptionModal entity={entity} card={pendingActivation}
        onClose={() => setPendingActivation(null)}
        onChoose={option => {
          const card = pendingActivation;
          setPendingActivation(null);
          if (card) handleUseLegendaryCard(card, option);
        }} />
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
      <Pressable style={styles.rulingBtn} onPress={onRuling}>
        <Text style={styles.rulingBtnTxt}>📜 Add Ruling…</Text>
      </Pressable>

      {/* Legendary Actions */}
      {legendaryPool && (
        <View style={styles.legendaryWrap}>
          <Text style={styles.legendaryHeader}>
            🐉 Legendary Actions — {legendaryPool.current}/{legendaryPool.maximum}
          </Text>
          {legendaryCards.map(card => (
            <Pressable
              key={card.featureId}
              style={[styles.legendaryRow, !card.available && styles.btnDisabled]}
              disabled={!card.available}
              onPress={() => handleUseLegendaryCard(card)}
            >
              <Text style={styles.legendaryName}>{card.name}</Text>
              <Text style={styles.legendaryDesc}>{card.layer2}{card.layer3 ? ` · ${card.layer3}` : ''}</Text>
              {!card.available && card.unavailableReason && (
                <Text style={styles.legendaryReason}>{card.unavailableReason}</Text>
              )}
            </Pressable>
          ))}
        </View>
      )}

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

      {mode === 'damage' && (
        <View style={styles.dmgTypeWrap}>
          {COMMON_DAMAGE_TYPES.map(t => (
            <Pressable key={t} style={[styles.dmgTypeChip, damageType === t && styles.dmgTypeChipActive]}
              onPress={() => setDamageType(damageType === t ? '' : t)}>
              <Text style={[styles.dmgTypeChipTxt, damageType === t && styles.dmgTypeChipTxtActive]}>{t}</Text>
            </Pressable>
          ))}
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
              onUpdate(removeCondition(entity, c.id, rules), `${entity.identity.name}: removed condition: ${c.id}`);
            }}>
              <Text style={styles.condItemTxt}>{c.id} (tap to remove)</Text>
            </Pressable>
          ))}
          {/* Add new condition */}
          {filteredConds.map(c => (
            <Pressable key={c} style={[styles.condRowItem, styles.condRowAdd]} onPress={() => {
              const features = allConditions.find(cond => cond.id === c)?.features;
              onUpdate(applyCondition(entity, c, 'dm', rules, features), `${entity.identity.name}: added condition: ${c}`);
              setCondSearch('');
            }}>
              <Text style={styles.condItemTxt}>+ {c}</Text>
            </Pressable>
          ))}
        </View>
      )}

      {concEntity && (
        <ConcentrationModal
          visible={concOpen}
          damageTaken={concDamage}
          entity={concEntity}
          rules={rules}
          onResolve={updated => { onUpdate(updated, `${entity.identity.name}: concentration check`); setConcOpen(false); }}
          onClose={() => setConcOpen(false)}
        />
      )}
    </View>
  );
}

// ── Multi-Target Panel ────────────────────────────────────────────────────────
// DM multi-target tools: apply the same damage/heal/condition action to every
// currently-selected combatant in one operation, instead of repeating the
// single-target QuickPanel flow once per entity. Reuses the exact same
// engine mutators (applyDamage/applyHealing/applyCondition/removeCondition)
// QuickPanel already uses — this is a UI/looping addition, not a new engine
// mechanism. Disclosed limitation: unlike QuickPanel's single-target damage,
// bulk damage does NOT open a concentration-check modal per affected caster
// (a correct multi-modal queue is real, separate UI work) — a DM bulk-
// damaging a group that includes a concentrating spellcaster should resolve
// that check manually afterward, or damage that entity individually via
// QuickPanel instead.

interface MultiTargetPanelProps {
  entities: Entity[];
  onDamage: (amount: number, damageType?: string) => void;
  onHeal:   (amount: number) => void;
  onKill:   () => void;
  onAddCondition:    (conditionId: string) => void;
  onRemoveCondition: (conditionId: string) => void;
  onRuling: () => void;
  onClose:  () => void;
}

function MultiTargetPanel({ entities, onDamage, onHeal, onKill, onAddCondition, onRemoveCondition, onRuling, onClose }: MultiTargetPanelProps) {
  const [mode,        setMode]        = useState<'damage'|'heal'|'condition'|null>(null);
  const [valueStr,    setValueStr]    = useState('');
  const [damageType,  setDamageType]  = useState('');
  const [condSearch,  setCondSearch]  = useState('');
  // Bulk damage skips the per-entity concentration-check modal QuickPanel's
  // single-target damage has (a real, disclosed limitation — building a
  // sequential per-caster modal queue is separate, larger UI work) — but
  // the DM was previously given no signal at all that a check was skipped.
  // Names any concentrating caster in the selection right before the
  // damage is applied, so the DM knows to resolve it manually (audit
  // finding DM-3).
  const [concWarning, setConcWarning] = useState<string[] | null>(null);

  const amount = parseInt(valueStr, 10);
  const validNum = !isNaN(amount) && amount > 0;

  function submitDamage() {
    if (!validNum) return;
    const concentrating = entities.filter(e => e.spellcasting?.concentrating).map(e => e.identity.name);
    setConcWarning(concentrating.length > 0 ? concentrating : null);
    onDamage(amount, damageType.trim() || undefined);
    setMode(null); setValueStr(''); setDamageType('');
  }
  function submitHeal() {
    if (!validNum) return;
    onHeal(amount);
    setMode(null); setValueStr('');
  }
  function submitKill() {
    Alert.alert('Kill', `Set all ${entities.length} selected combatants' HP to 0?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Kill', style: 'destructive', onPress: onKill },
    ]);
  }

  // Conditions already on every selected entity — removable in one tap.
  // Conditions on only SOME of the selection aren't offered for removal
  // here (ambiguous which subset "remove" should target); use QuickPanel
  // per-entity for that case.
  const sharedActive = entities.length > 0
    ? entities[0].conditions.filter(c => entities.every(e => e.conditions.some(ac => ac.id === c.id))).map(c => c.id)
    : [];
  // Sourced from the merged content DB, matching QuickPanel — see its own
  // comment (audit findings KNOWN_CONDITIONS-1 / CONTENT-8).
  const getMergedContentDB = useHomebrewStore(s => s.getMergedContentDB);
  const mergedContentDB = getMergedContentDB();
  // Memoized — same pattern as QuickPanel's filteredConds (ENCOUNTER-PERF-2).
  const filteredConds = useMemo(() => mergedContentDB.conditions
    .map(c => c.id)
    .filter(c => c.includes(condSearch.toLowerCase())),
    [mergedContentDB, condSearch]);

  return (
    <View style={[styles.quickPanel, styles.multiPanel]}>
      <View style={styles.quickHeader}>
        <Text style={styles.quickName}>{entities.length} selected</Text>
        <Pressable onPress={onClose}><Text style={styles.closeTxt}>✕</Text></Pressable>
      </View>
      <Text style={styles.multiNames} numberOfLines={2}>
        {entities.map(e => e.identity.name).join(', ')}
      </Text>

      {concWarning && (
        <Text style={styles.concWarningTxt}>
          🧠 Bulk damage doesn't auto-check concentration — resolve manually for: {concWarning.join(', ')}
        </Text>
      )}

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
      <Pressable style={styles.rulingBtn} onPress={onRuling}>
        <Text style={styles.rulingBtnTxt}>📜 Add Ruling to all {entities.length}…</Text>
      </Pressable>

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

      {mode === 'damage' && (
        <View style={styles.dmgTypeWrap}>
          {COMMON_DAMAGE_TYPES.map(t => (
            <Pressable key={t} style={[styles.dmgTypeChip, damageType === t && styles.dmgTypeChipActive]}
              onPress={() => setDamageType(damageType === t ? '' : t)}>
              <Text style={[styles.dmgTypeChipTxt, damageType === t && styles.dmgTypeChipTxtActive]}>{t}</Text>
            </Pressable>
          ))}
        </View>
      )}

      {mode === 'condition' && (
        <View style={styles.condPicker}>
          <TextInput
            style={styles.condSearch}
            value={condSearch}
            onChangeText={setCondSearch}
            placeholder="Search conditions…"
            placeholderTextColor={Colors.textDim}
          />
          {sharedActive.map(c => (
            <Pressable key={c} style={styles.condRowItem} onPress={() => onRemoveCondition(c)}>
              <Text style={styles.condItemTxt}>{c} — on all selected (tap to remove from all)</Text>
            </Pressable>
          ))}
          {filteredConds.map(c => (
            <Pressable key={c} style={[styles.condRowItem, styles.condRowAdd]} onPress={() => {
              onAddCondition(c);
              setCondSearch('');
            }}>
              <Text style={styles.condItemTxt}>+ {c} (to all selected)</Text>
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
  isSelected?: boolean;
  onPress:    () => void;
  /** Manual reorder — wires combatStore's own pre-existing setOrder action,
   *  which had zero UI consumer anywhere (audit finding S9-03) despite
   *  being fully implemented and documented as "DM drag-to-reorder".
   *  Simple up/down swap rather than a drag gesture — smaller, safer
   *  addition that still closes the actual gap (no way to manually
   *  reorder initiative at all). undefined at a list boundary (nothing to
   *  swap with) hides that direction's button instead of disabling it. */
  onMoveUp?:   () => void;
  onMoveDown?: () => void;
}

function CombatantRow({ entry, entity, isCurrent, isSelected, onPress, onMoveUp, onMoveDown }: CombatantRowProps) {
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
      style={[styles.combatantRow, isCurrent && styles.combatantRowActive, isSelected && styles.combatantRowSelected]}
      onPress={onPress}
    >
      <View style={styles.initBox}>
        <Text style={styles.initNum}>{entry.initiative}</Text>
      </View>

      <View style={styles.combatantInfo}>
        <Text style={styles.combatantName}>
          {isSelected ? '☑ ' : ''}{entity && entityDmHidden(entity) ? '🔒 ' : ''}{entry.name}
        </Text>
        {entity && entityCombatantNotes(entity) && (
          <Text style={styles.combatantNotesTxt} numberOfLines={1}>📝 {entityCombatantNotes(entity)}</Text>
        )}
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

      {(onMoveUp || onMoveDown) && (
        <View style={styles.reorderBtns}>
          <Pressable hitSlop={8} disabled={!onMoveUp} onPress={onMoveUp} style={!onMoveUp && styles.reorderBtnHidden}>
            <Text style={styles.reorderBtnTxt}>▲</Text>
          </Pressable>
          <Pressable hitSlop={8} disabled={!onMoveDown} onPress={onMoveDown} style={!onMoveDown && styles.reorderBtnHidden}>
            <Text style={styles.reorderBtnTxt}>▼</Text>
          </Pressable>
        </View>
      )}

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
  const { preparedId }  = useLocalSearchParams<{ preparedId?: string }>();
  const isDm            = useCampaignStore(s => s.isDm);
  const characters      = useCharacterStore(s => s.characters);
  const updateCharacter = useCharacterStore(s => s.updateCharacter);
  const session         = useSessionStore(s => s.session);
  const rules           = useCharacterStore(s => s.rules) ?? DEFAULT_RULES;
  const preparedEncounters = useEncounterStore(s => s.encounters);
  const saveEncounterDraft = useEncounterStore(s => s.saveEncounterDraft);
  const homebrewMonsters   = useHomebrewStore(s => s.monsters);
  // ENCOUNTER-PERF-1: was called fresh inside a .map() over prep-preview
  // combatants (once per row) — for an N-combatant prepared encounter, that
  // rebuilt the full official+homebrew monster index N times per render.
  // Memoized once per homebrewMonsters change instead.
  const allMonsterTemplates = useMemo(() => mergeMonsterIndex(homebrewMonsters), [homebrewMonsters]);
  const getMergedContentDB = useHomebrewStore(s => s.getMergedContentDB);

  const { combat, entities, startCombat, advanceTurn, endCombat, updateEntity, setInitiative, setOrder, addEntities, removeFromEncounter, lastPersistError } =
    useCombatStore();

  const [selectedId, setSelectedId]  = useState<string | null>(null);
  const [setupMode,  setSetupMode]   = useState(!combat.active);

  // Multi-target selection — separate from selectedId's single-select flow,
  // active only while multiMode is on. Toggling multiMode off clears the
  // set so re-entering starts fresh rather than reopening a stale panel.
  const [multiMode,   setMultiMode]   = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  function toggleSelected(id: string) {
    setSelectedIds(ids => ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id]);
  }

  // DM temporary rulings — set to the resolved target list (one entity, the
  // current multi-selection, or every combatant) to open DmRulingModal;
  // null when closed.
  const [rulingTargets, setRulingTargets] = useState<Entity[] | null>(null);
  function applyRuling(updates: { before: Entity; after: Entity }[]) {
    for (const u of updates) {
      applyEntityUpdate(u.before, u.after, `${u.after.identity.name}: DM ruling applied`);
    }
    setRulingTargets(null);
  }

  // The PreparedEncounter this run either came from (via ?preparedId=, still
  // in setupMode/preview) or was instantiated from (combat.active, carries
  // its own sourcePreparedEncounterId — see CombatState's own doc comment).
  const previewSource = preparedId ? preparedEncounters.find(e => e.id === preparedId) ?? null : null;
  const activeSource   = combat.sourcePreparedEncounterId
    ? preparedEncounters.find(e => e.id === combat.sourcePreparedEncounterId) ?? null
    : null;

  // Audit finding: setupMode is only evaluated once, at mount, from the
  // GLOBAL combat.active flag — it has no idea whether ?preparedId= refers
  // to the encounter actually running. Navigating here for a DIFFERENT
  // prepared encounter while one is already active (without ending it first)
  // used to silently render that OTHER encounter's live combat view under
  // the new preparedId, with no indication anything was wrong. There's only
  // ever one CombatState globally (no concurrent-encounters architecture
  // exists, and building one is out of scope for this fix) — so the correct
  // behavior is a clear warning, not a silent wrong-encounter render.
  // Derived every render (not stateful) so it self-corrects regardless of
  // whether navigating here for a new preparedId actually remounts this
  // screen or just updates its route params.
  const encounterConflict = combat.active && !!preparedId && combat.sourcePreparedEncounterId !== preparedId;

  // Selected entity for the quick panel
  const selectedEntity = entities.find(e => e.id === selectedId);

  // Core apply-one-update logic, extracted so both the single-select
  // QuickPanel path and the multi-target path (which has its own `before`
  // per entity, not the single globally-selected one) share it.
  function applyEntityUpdate(before: Entity | undefined, updated: Entity, label?: string) {
    // If it's a player character, persist to characterStore too — the REAL
    // synced source of truth, not just this DM device's own combatStore
    // copy of it.
    if (updated.kind === 'character') {
      // Bug fix (architecture review U1/U2): this used to call
      // updateCharacter(id, () => updated, label) — the updater ignores the
      // fresh state updateCharacter hands it and always returns the
      // pre-baked `updated`, which was computed from combatStore's
      // possibly-stale copy. If a player made an independent change on
      // their own device (synced into characterStore) between the DM's
      // last combatStore snapshot and this action, that change was
      // silently reverted. Diff what the action actually changed
      // (`before` → `updated`) and merge just that patch onto whatever
      // characterStore's real current state is — the same deepDiff/
      // deepMerge machinery this app already uses for exactly this "apply
      // what changed, not a wholesale snapshot" problem in sync's own
      // applyIncomingPatch.
      // Item 17 (timeline improvements) — bug fix: this never passed a
      // category, so every action fired from this screen (damage/heal/
      // kill/condition/ruling/legendary-action use/wave deploy) landed
      // under "Other" instead of "Combat," the one category that's
      // actually always correct here (this function only ever runs from
      // the DM's live encounter/initiative tracker).
      if (before) {
        const patch = deepDiff(before, updated);
        if (patch !== undefined) {
          updateCharacter(updated.id, c => deepMerge(c, patch), label, 'combat');
        }
      } else {
        // No prior snapshot to diff against — fall back to a wholesale replace.
        updateCharacter(updated.id, () => updated, label, 'combat');
      }
      // Bug fix (audit finding SYNC-COMBAT-1, sub-paths a/b): combatStore's
      // own copy of this entity used to be overwritten with `updated` —
      // the RESULT of this action computed from combatStore's possibly-
      // stale `before` snapshot. That silently reverted combatStore's live
      // tracker away from whatever characterStore actually held for any
      // OTHER field the stale snapshot didn't have (e.g. a player equipped
      // an item on their own device between DM actions) — wrong AC/HP math
      // on this screen for the rest of the encounter, even though
      // characterStore/sync themselves stayed correct. Read characterStore
      // back out AFTER the merge above and use ITS state to refresh
      // combatStore, instead of the stale-baseline-derived `updated`.
      const merged = useCharacterStore.getState().characters.find(c => c.id === updated.id);
      updateEntity(updated.id, () => merged ?? updated);
    } else {
      updateEntity(updated.id, () => updated);
    }
  }

  function handleEntityUpdate(updated: Entity, label?: string) {
    // `before` is the combatStore snapshot QuickPanel's own action handlers
    // (submitDamage/submitHeal/etc.) actually computed `updated` FROM — it's
    // the `entity` prop QuickPanel was rendered with this same render pass,
    // closed over here via `selectedEntity`.
    applyEntityUpdate(selectedEntity, updated, label);
  }

  // Applies the same mutator to every currently multi-selected entity —
  // the "DM multi-target tools" entry point. Each entity's own `before` is
  // read fresh from combatStore.entities per-iteration (not the single
  // selectedEntity), so the character-patch diff above stays correct per
  // entity. Wild Shape branching is handled inline by the caller (same
  // per-entity check QuickPanel's own submitDamage/submitHeal already do)
  // since a mixed selection can include both transformed and normal entities.
  function handleBulkUpdate(mutate: (e: Entity) => Entity, labelFor: (e: Entity) => string) {
    for (const id of selectedIds) {
      const before = entities.find(e => e.id === id);
      if (!before) continue;
      applyEntityUpdate(before, mutate(before), labelFor(before));
    }
  }

  function bulkDamage(amount: number, damageType?: string) {
    const dt = damageType?.trim() || undefined;
    handleBulkUpdate(
      e => e.wildShapeState?.active ? applyWildShapeDamage(e, amount, rules) : applyDamage(e, amount, rules, dt),
      e => `${e.identity.name}: took ${amount}${dt ? ` ${dt}` : ''} damage`,
    );
  }
  function bulkHeal(amount: number) {
    handleBulkUpdate(
      e => e.wildShapeState?.active ? e : applyHealing(e, amount, rules),
      e => `${e.identity.name}: healed ${amount}`,
    );
  }
  function bulkKill() {
    handleBulkUpdate(
      e => e.wildShapeState?.active
        ? applyWildShapeDamage(e, e.wildShapeState.beastHpMax, rules)
        : recomputeDerived({ ...e, resources: { ...e.resources, hp: { ...e.resources.hp, current: 0 } } }, rules),
      e => `${e.identity.name}: set HP to 0 (Kill)`,
    );
  }
  function bulkAddCondition(conditionId: string) {
    const features = getMergedContentDB().conditions.find(c => c.id === conditionId)?.features;
    handleBulkUpdate(
      e => applyCondition(e, conditionId, 'dm', rules, features),
      e => `${e.identity.name}: added condition: ${conditionId}`,
    );
  }
  function bulkRemoveCondition(conditionId: string) {
    handleBulkUpdate(
      e => removeCondition(e, conditionId, rules),
      e => `${e.identity.name}: removed condition: ${conditionId}`,
    );
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

  // Instantiate a PreparedEncounter into fresh runtime entities and start
  // combat — starting the same template twice always produces independent
  // entities (instantiatePreparedEncounter never touches the template), and
  // starting never mutates `previewSource` itself. Any party members already
  // added manually in setup mode (rare when arriving via a prepared
  // encounter, but not disallowed) come along too.
  function handleStartFromPrepared() {
    if (!previewSource) return;
    const spawned = instantiatePreparedEncounter(previewSource, rules, homebrewMonsters);
    if (spawned.length === 0 && entities.length === 0) {
      Alert.alert('No combatants', 'This encounter has no combatants present at the start (check waves — they deploy later).');
      return;
    }
    const encounterId = `enc_${Date.now()}`;
    startCombat([...entities, ...spawned], encounterId, previewSource.id);
    void saveEncounterDraft({ ...previewSource, lastStartedAt: Date.now(), status: previewSource.status === 'draft' ? 'ready' : previewSource.status });
    setSetupMode(false);
  }

  function handleDeployWave(waveId: string) {
    if (!activeSource) return;
    const wave = activeSource.waves.find(w => w.id === waveId);
    const spawned = instantiateWave(activeSource, waveId, rules, homebrewMonsters);
    if (spawned.length === 0) {
      Alert.alert('Nothing to deploy', 'No combatants are assigned to this wave.');
      return;
    }
    addEntities(spawned);
    Alert.alert('Reinforcements deployed', `${wave?.name ?? 'Wave'}: ${spawned.length} combatant${spawned.length !== 1 ? 's' : ''} added to initiative.`);
  }

  function addPartyMember(c: Entity) {
    updateEntity(c.id, () => c); // Add to combat entities
    useCombatStore.setState(s => ({
      entities: s.entities.some(e => e.id === c.id) ? s.entities : [...s.entities, c],
    }));
  }

  function handleEndEncounter() {
    Alert.alert('End Encounter', 'End this encounter?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'End Encounter',
        onPress: () => {
          // Expire end_of_encounter DM overrides on all entities. Routed
          // through applyEntityUpdate (the same diff+merge path every other
          // mutation on this screen already uses) rather than calling
          // updateCharacter directly — a direct call here used to pass an
          // updater that ignored the fresh characterStore state it was
          // handed and always returned this combatStore-derived `updated`
          // wholesale, silently discarding any independent edit (e.g. a
          // player equipping an item on their own device) that landed in
          // characterStore after this combatStore snapshot was taken
          // (audit finding PERSIST-3).
          entities.forEach(e => {
            if (e.kind === 'character') {
              const updated = expireOverrides(e, 'end_of_encounter', rules);
              applyEntityUpdate(e, updated, 'End of encounter (override expiry)');
            }
          });
          // Mark the PreparedEncounter completed if this run came from one —
          // the template's own combatant list is left exactly as authored;
          // live HP/conditions are never copied back into it (see
          // PreparedEncounter's own doc comment).
          if (activeSource) {
            void saveEncounterDraft({ ...activeSource, status: 'completed', completedAt: Date.now() });
          }
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

  if (encounterConflict) {
    return (
      <View style={styles.screen}>
        <View style={styles.header}>
          <Pressable style={styles.backBtn} onPress={safeGoBack}>
            <Text style={styles.backTxt}>← Back</Text>
          </Pressable>
          <Text style={styles.title}>Encounter Already Active</Text>
        </View>
        <View style={styles.center}>
          <Text style={styles.errorTxt}>
            {activeSource ? `"${activeSource.name}"` : 'Another encounter'} is already running — end it before starting {previewSource ? `"${previewSource.name}"` : 'a new one'}.
          </Text>
          <Pressable style={styles.startBtn} onPress={() => router.replace('/dm/encounter')}>
            <Text style={styles.startBtnTxt}>Go to active encounter</Text>
          </Pressable>
        </View>
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
          {previewSource && (
            <View style={styles.prepPreview}>
              <Text style={styles.prepPreviewTitle}>📋 {previewSource.name}</Text>
              {!!previewSource.description && <Text style={styles.prepPreviewDesc}>{previewSource.description}</Text>}
              <Text style={styles.prepPreviewMeta}>
                {startingCombatantCount(previewSource)} combatant{startingCombatantCount(previewSource) !== 1 ? 's' : ''} present from the start
                {previewSource.waves.length > 0 ? ` · ${previewSource.waves.length} wave${previewSource.waves.length !== 1 ? 's' : ''} held in reserve` : ''}
              </Text>
              {previewSource.combatants.filter(c => !c.waveId).map(c => (
                <Text key={c.id} style={styles.prepPreviewRow}>
                  • {c.displayName?.trim() || allMonsterTemplates.find(t => t.id === c.monsterId)?.name || c.monsterId}
                  {c.quantity > 1 ? ` ×${c.quantity}` : ''}
                </Text>
              ))}
              <Pressable style={styles.prepStartBtn} onPress={handleStartFromPrepared}>
                <Text style={styles.prepStartBtnTxt}>▶ Start This Encounter</Text>
              </Pressable>
            </View>
          )}

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

          {/* app/dm/monsters.tsx exists and is fully wired to spawn straight
              into combatStore + navigate back here — it just had no link
              pointing to it anywhere in the app until now. */}
          <Pressable style={styles.addMonsterBtn} onPress={() => router.push('/dm/monsters' as any)}>
            <Text style={styles.addMonsterBtnTxt}>🐉 Add Monster</Text>
          </Pressable>

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

      {/* Surfaces a failed combat-state save instead of only logging it
          (audit finding PERSIST-5) — clears itself on the next successful
          save. */}
      {lastPersistError && (
        <View style={styles.persistErrorBanner}>
          <Text style={styles.persistErrorTxt}>⚠️ {lastPersistError}</Text>
        </View>
      )}

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        {/* Reinforcements — only meaningful when this run came from a
            PreparedEncounter with waves defined. Deployment is manual-only
            (a Deploy button), matching the "at minimum, manual deployment
            must work" scope — a 'round'/'descriptive' triggerKind is shown
            as a reminder, never auto-fired. */}
        {activeSource && activeSource.waves.length > 0 && (
          <View style={styles.waveSection}>
            <Text style={styles.sectionLabel}>REINFORCEMENTS</Text>
            {activeSource.waves.map(w => {
              const pendingCount = activeSource.combatants
                .filter(c => c.waveId === w.id)
                .reduce((sum, c) => sum + Math.max(1, c.quantity), 0);
              return (
                <View key={w.id} style={styles.waveRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.waveName}>{w.name}</Text>
                    <Text style={styles.waveMeta}>
                      {w.triggerKind === 'round' && w.triggerRound ? `Reminder: round ${w.triggerRound}` : null}
                      {w.triggerKind === 'descriptive' && w.triggerNote ? w.triggerNote : null}
                      {w.triggerKind === 'manual' ? `${pendingCount} combatant${pendingCount !== 1 ? 's' : ''} ready` : null}
                    </Text>
                  </View>
                  <Pressable style={styles.waveDeployBtn} onPress={() => handleDeployWave(w.id)}>
                    <Text style={styles.waveDeployTxt}>Deploy</Text>
                  </Pressable>
                </View>
              );
            })}
          </View>
        )}

        {/* Multi-target toggle + ruling-for-everyone */}
        <View style={styles.multiToggleRow}>
          <Pressable
            style={[styles.multiToggleBtn, multiMode && styles.multiToggleBtnActive]}
            onPress={() => {
              setMultiMode(m => !m);
              setSelectedIds([]);
              setSelectedId(null);
            }}
          >
            <Text style={styles.multiToggleTxt}>{multiMode ? '✓ Multi-select on' : '☐ Multi-select'}</Text>
          </Pressable>
          {entities.length > 0 && (
            <Pressable style={styles.multiToggleBtn} onPress={() => setRulingTargets(entities)}>
              <Text style={styles.multiToggleTxt}>🌍 Ruling for Everyone</Text>
            </Pressable>
          )}
        </View>

        {/* Group quick-select — first runtime consumer of PreparedEncounter's
            groupName metadata (see entityGroupName above). Only shown while
            multi-select is on and at least one live combatant carries a
            group tag. */}
        {multiMode && (() => {
          const groupNames = Array.from(new Set(
            combat.order
              .map(e => entities.find(x => x.id === e.entityId))
              .filter((e): e is Entity => !!e)
              .map(entityGroupName)
              .filter((g): g is string => !!g)
          ));
          if (groupNames.length === 0) return null;
          return (
            <View style={styles.groupChipRow}>
              {groupNames.map(g => (
                <Pressable
                  key={g}
                  style={styles.groupChip}
                  onPress={() => setSelectedIds(
                    combat.order
                      .map(e => entities.find(x => x.id === e.entityId))
                      .filter((e): e is Entity => !!e && entityGroupName(e) === g)
                      .map(e => e.id)
                  )}
                >
                  <Text style={styles.groupChipTxt}>Select group: {g}</Text>
                </Pressable>
              ))}
            </View>
          );
        })()}

        {/* Initiative order */}
        {combat.order.map((entry, idx) => {
          const ent = entities.find(e => e.id === entry.entityId);
          function swap(a: number, b: number) {
            const next = [...combat.order];
            [next[a], next[b]] = [next[b], next[a]];
            setOrder(next);
          }
          return (
            <CombatantRow
              key={entry.entityId}
              entry={entry}
              entity={ent}
              isCurrent={idx === combat.turnIndex}
              isSelected={multiMode && selectedIds.includes(entry.entityId)}
              onPress={() => multiMode
                ? toggleSelected(entry.entityId)
                : setSelectedId(selectedId === entry.entityId ? null : entry.entityId)
              }
              onMoveUp={idx > 0 ? () => swap(idx, idx - 1) : undefined}
              onMoveDown={idx < combat.order.length - 1 ? () => swap(idx, idx + 1) : undefined}
            />
          );
        })}

        {/* Quick panel for a single selected combatant (non-multi mode) */}
        {!multiMode && selectedEntity && (
          <QuickPanel
            entity={selectedEntity}
            rules={rules}
            onUpdate={handleEntityUpdate}
            onRuling={() => setRulingTargets([selectedEntity])}
            onClose={() => setSelectedId(null)}
          />
        )}

        {/* Multi-target panel */}
        {multiMode && selectedIds.length > 0 && (
          <MultiTargetPanel
            entities={selectedIds.map(id => entities.find(e => e.id === id)).filter((e): e is Entity => !!e)}
            onDamage={bulkDamage}
            onHeal={bulkHeal}
            onKill={bulkKill}
            onAddCondition={bulkAddCondition}
            onRemoveCondition={bulkRemoveCondition}
            onRuling={() => setRulingTargets(selectedIds.map(id => entities.find(e => e.id === id)).filter((e): e is Entity => !!e))}
            onClose={() => setSelectedIds([])}
          />
        )}

        {/* DM temporary ruling — targets resolved by whichever entry point
            opened it. Gated (was unconditionally mounted) — same
            lazy-mount pattern as ConcentrationModal just above and
            [id].tsx's preview modals. */}
        {rulingTargets !== null && (
          <DmRulingModal
            visible={rulingTargets !== null}
            entities={rulingTargets ?? []}
            rules={rules}
            onApply={applyRuling}
            onCancel={() => setRulingTargets(null)}
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

  persistErrorBanner: {
    paddingVertical: 6, paddingHorizontal: Spacing.md,
    backgroundColor: Colors.red + '22',
    borderBottomWidth: 1, borderBottomColor: Colors.red + '66',
  },
  persistErrorTxt: { fontSize: FontSize.xs, color: Colors.red },

  scroll:       { flex: 1 },
  content:      { padding: Spacing.sm, gap: Spacing.sm, paddingBottom: Spacing.xxl },
  sectionLabel: { fontSize: FontSize.xs, color: Colors.textSecondary, letterSpacing: 2, fontWeight: FontWeight.bold, padding: Spacing.sm },

  combatantRow: {
    backgroundColor: Colors.surface, borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.border,
    padding: Spacing.sm, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
  },
  combatantRowActive: { borderColor: Colors.gold, backgroundColor: Colors.gold + '11' },
  combatantRowSelected: { borderColor: Colors.blue, backgroundColor: Colors.blue + '11' },
  initBox: {
    width: 44, height: 44, borderRadius: Radius.md,
    backgroundColor: Colors.surfaceHigh, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.border,
  },
  initNum:        { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.gold },
  combatantInfo:  { flex: 1, gap: 4 },
  combatantName:  { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  combatantNotesTxt: { fontSize: FontSize.xs, color: Colors.textDim, fontStyle: 'italic' },
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
  reorderBtns:    { alignItems: 'center', gap: 2, marginRight: 4 },
  reorderBtnTxt:  { color: Colors.textSecondary, fontSize: FontSize.sm },
  reorderBtnHidden: { opacity: 0 },

  // Multi-target tools
  multiToggleRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs, marginBottom: Spacing.xs },
  multiToggleBtn: {
    alignSelf: 'flex-start', borderRadius: Radius.full,
    borderWidth: 1, borderColor: Colors.border,
    paddingVertical: 4, paddingHorizontal: Spacing.sm,
  },
  multiToggleBtnActive: { borderColor: Colors.blue, backgroundColor: Colors.blue + '22' },
  multiToggleTxt: { fontSize: FontSize.xs, color: Colors.textPrimary },
  groupChipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs, marginBottom: Spacing.xs },
  groupChip: {
    borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.blue + '66',
    backgroundColor: Colors.blue + '11', paddingVertical: 4, paddingHorizontal: Spacing.sm,
  },
  groupChipTxt: { fontSize: FontSize.xs, color: Colors.textPrimary },
  multiPanel:  { borderColor: Colors.blue + '44' },
  multiNames:  { fontSize: FontSize.xs, color: Colors.textDim },
  concWarningTxt: { fontSize: FontSize.xs, color: Colors.gold, marginTop: 4 },

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
  rulingBtn: {
    borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.gold + '66',
    backgroundColor: Colors.gold + '11', padding: Spacing.xs, alignItems: 'center',
  },
  rulingBtnTxt: { fontSize: FontSize.xs, color: Colors.gold, fontWeight: FontWeight.bold },

  inputRow:      { flexDirection: 'row', gap: Spacing.sm, alignItems: 'center' },
  dmgTypeWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: Spacing.xs },
  dmgTypeChip: {
    backgroundColor: Colors.surface, borderRadius: Radius.sm,
    paddingHorizontal: Spacing.sm, paddingVertical: 3, borderWidth: 1, borderColor: Colors.border,
  },
  dmgTypeChipActive: { borderColor: Colors.gold, backgroundColor: Colors.gold + '22' },
  dmgTypeChipTxt:    { fontSize: 11, color: Colors.textSecondary },
  dmgTypeChipTxtActive: { color: Colors.gold, fontWeight: FontWeight.bold },
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

  legendaryWrap:   { gap: Spacing.xs, borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: Spacing.xs },
  legendaryHeader: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, color: Colors.gold },
  legendaryRow: {
    backgroundColor: Colors.surface, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border, padding: Spacing.xs,
  },
  legendaryName:   { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  legendaryDesc:   { fontSize: FontSize.xs, color: Colors.textDim },
  legendaryReason: { fontSize: FontSize.xs, color: Colors.red },

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
  addMonsterBtn: {
    backgroundColor: Colors.surfaceHigh, borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.border,
    padding: Spacing.md, alignItems: 'center', marginTop: Spacing.lg,
  },
  addMonsterBtnTxt: { color: Colors.textPrimary, fontWeight: FontWeight.bold, fontSize: FontSize.md },
  startBtn: {
    backgroundColor: Colors.red, borderRadius: Radius.lg,
    padding: Spacing.md, alignItems: 'center', marginTop: Spacing.md,
  },
  startBtnTxt: { color: Colors.white, fontWeight: FontWeight.bold, fontSize: FontSize.lg },

  prepPreview: {
    backgroundColor: Colors.surfaceHigh, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.gold,
    padding: Spacing.md, marginBottom: Spacing.md, gap: 4,
  },
  prepPreviewTitle: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.gold },
  prepPreviewDesc:  { fontSize: FontSize.sm, color: Colors.textSecondary },
  prepPreviewMeta:  { fontSize: FontSize.xs, color: Colors.textDim, marginTop: 4 },
  prepPreviewRow:   { fontSize: FontSize.sm, color: Colors.textPrimary },
  prepStartBtn: { backgroundColor: Colors.gold, borderRadius: Radius.md, padding: Spacing.sm, alignItems: 'center', marginTop: Spacing.sm },
  prepStartBtnTxt: { color: Colors.bg, fontWeight: FontWeight.bold },
  waveSection: {
    backgroundColor: Colors.surfaceHigh, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border,
    padding: Spacing.sm, marginBottom: Spacing.md,
  },
  waveRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.xs, gap: Spacing.sm },
  waveName: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  waveMeta: { fontSize: FontSize.xs, color: Colors.textDim },
  waveDeployBtn: { backgroundColor: Colors.gold, borderRadius: Radius.md, paddingHorizontal: Spacing.sm, paddingVertical: 6 },
  waveDeployTxt: { color: Colors.bg, fontWeight: FontWeight.bold, fontSize: FontSize.xs },

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
