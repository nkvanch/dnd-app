import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSpellPayment } from './SpellPaymentChooser';
// app/sheet/TabCharacter.tsx
// Tab 1 — Combat dashboard. Players live here.
// Includes: HP, stat row, conditions/exhaustion, resources, spell slots,
//           death saves (when HP=0), concentration check, level-up button.
import { useState, useCallback, useRef, useMemo, memo } from 'react';
import {
  View, Text, ScrollView, Pressable, StyleSheet,
  Modal, TextInput,
} from 'react-native';
import { Entity, CampaignRules, CharClass, ActionCard, asClassId, DurationTracker, ActivationOption, matchesRuleset } from '../../engine/types';
import { useCharacterStore } from '../../store/characterStore';
import { hasActiveOverride } from '../../engine/dmOverride';
import { toggleActionEconomy } from '../../engine/combat';
import { recomputeDerived } from '../../engine/pipeline';
import { levelUp, levelUpClass } from '../../engine/leveling';
import { simulate } from '../../engine/simulate';
import { getClassLevels } from '../../engine/multiclass';
import { spendHitDie, discardHitDie } from '../../engine/rest';
import { rollExpression, doubleDiceCount } from '../../engine/dice';
import { useDiceLogStore } from '../../store/diceLogStore';
import { ALL_PROGRESSIONS } from '../../content/classes/index';
import { getProgressionForClass, mergeSubclassIntoProgression } from '../../content/classes/progressions';
import { getSubclassEntryMerged } from '../../content/subclasses/subclassBrowse';
import { spellRepo } from '../../content/spellRepo';
import { spellIdsOnEntity } from '../../content/spellRepo.types';
import { useHomebrewStore } from '../../store/homebrewStore';
import { AsiFeatPicker } from '../AsiFeatPicker';
import { AuditModal } from './AuditModal';
import { HpModal } from './HpModal';
import { ConcentrationModal } from './ConcentrationModal';
import { CompanionSection } from './CompanionSection';
import { ActionCardRow, UseModal, applyActionCardUse, toggleFavoriteTag, isFavoriteCard, ActivationOptionModal } from './TabActions';
import { LevelUpPreviewModal } from './LevelUpPreviewModal';
import { ProgressionPlannerModal } from './ProgressionPlannerModal';
import { MulticlassProgressionPlannerModal } from './MulticlassProgressionPlannerModal';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../../theme';

// Class progressions are looked up from the content library — no hardcoded names.
// ALL_PROGRESSIONS is a Record<classId, ClassProgression> covering all 12 classes.

// ── Exhaustion level descriptions ─────────────────────────────────────────────

const EXHAUSTION_EFFECTS: Record<number, string> = {
  1: 'Disadvantage on ability checks',
  2: 'Speed halved',
  3: 'Disadvantage on attacks and saving throws',
  4: 'Hit point maximum halved',
  5: 'Speed reduced to 0',
  6: 'Death',
};

// Display-only mechanical reminders. The engine already applies the real effects
// via the Effect system; these just surface what each condition does.
const CONDITION_WARNINGS: Record<string, string> = {
  poisoned:   'Disadvantage on attacks and ability checks',
  blinded:    'Attacks against you have advantage; you have disadvantage on attacks',
  prone:      'Disadvantage on attacks; melee attacks against you have advantage',
  paralyzed:  'Speed 0; auto-fail STR/DEX saves; attacks against you have advantage',
  frightened: 'Disadvantage on checks and attacks while source is visible',
  stunned:    'Speed 0; auto-fail STR/DEX saves; attacks against you have advantage',
  restrained: 'Speed 0; disadvantage on attacks; attacks against you have advantage',
  grappled:   'Speed 0',
  incapacitated: 'Cannot take actions or reactions',
  petrified:  'Incapacitated; resistance to all damage; attacks against you have advantage',
  unconscious:'Incapacitated, prone; auto-fail STR/DEX saves; attacks have advantage',
};

// Death saves live in entity.resources.deathSaves — persisted and synced,
// same as HP. combat.ts resets them automatically when HP drops to 0 for the
// first time or rises above 0 (healed/revived); this component only handles
// recording each save result and the stabilize/nat-20 special cases.

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  entity:       Entity;
  rules:        CampaignRules;
  isDm:         boolean;
  campaignId:   string;
  deviceId:     string;
  onDamage:     (amount: number, damageType?: string) => void;
  onHeal:       (amount: number) => void;
  onAddCondition:    (id: string, duration: DurationTracker | null) => void;
  onRemoveCondition: (id: string) => void;
  onResourceChange:  (resourceId: string, delta: number) => void;
  onSpendSlot:       (tier: string, kind?: 'normal' | 'pact') => void;
  onRestoreSlot:     (tier: string, kind?: 'normal' | 'pact') => void;
  onEntityUpdate:    (updated: Entity) => void;
  /** Closure item 16 — the one authoritative End Turn entry point, shared
   *  verbatim with the Actions and Spells tabs (see app/sheet/[id].tsx's
   *  handleEndTurn). */
  onEndTurn:         () => void;
}


// Display labels for the four structured sense types.
const SENSE_LABELS: Record<string, string> = {
  darkvision:  'Darkvision',
  blindsight:  'Blindsight',
  tremorsense: 'Tremorsense',
  truesight:   'Truesight',
};

type MoveType = 'fly' | 'swim' | 'climb' | 'burrow';
const MOVE_TYPE_LABELS: Record<MoveType, string> = { fly: 'Fly', swim: 'Swim', climb: 'Climb', burrow: 'Burrow' };
const MOVE_TYPE_OPTIONS: MoveType[] = ['climb', 'swim', 'fly', 'burrow'];
const MANUAL_MOVEMENT_FEATURE_ID = 'manual_movement';

// ── Death Saves Section ───────────────────────────────────────────────────────

function DeathSavesSection({
  entity, rules, saves, onSavesChange, onEntityUpdate,
}: {
  entity: Entity;
  rules: CampaignRules;
  saves: { successes: number; failures: number };
  onSavesChange: (s: { successes: number; failures: number }) => void;
  onEntityUpdate: (u: Entity) => void;
}) {
  const isDead   = saves.failures  >= 3;
  const isStable = saves.successes >= 3;
  const [lastRoll, setLastRoll] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function showResult(msg: string) {
    setLastRoll(msg);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setLastRoll(null), 3000);
  }

  function stabilize() {
    // 3 successes = STABLE at 0 HP (book rule) — NOT healed. The creature
    // stops making death saves and stays at 0 HP, unconscious, until healed
    // by any means. Only a natural 20 heals to 1 HP (see reviveNat20 below).
    onSavesChange({ ...saves, successes: 3 });
  }

  function reviveNat20() {
    // Natural 20 on a death save: regain 1 HP immediately (book rule) and
    // clear both counters, since the creature is no longer dying.
    const updated: Entity = {
      ...entity,
      resources: { ...entity.resources, hp: { ...entity.resources.hp, current: 1 } },
    };
    onEntityUpdate(recomputeDerived(updated, rules));
    onSavesChange({ successes: 0, failures: 0 });
  }

  function addSuccess() {
    if (isDead || isStable) return;
    const next = Math.min(3, saves.successes + 1);
    if (next >= 3) { stabilize(); showResult('Stable at 0 HP'); }
    else { onSavesChange({ ...saves, successes: next }); showResult(`Success (${next}/3)`); }
  }

  function addFailure() {
    if (isDead || isStable) return;
    const next = Math.min(3, saves.failures + 1);
    onSavesChange({ ...saves, failures: next });
    showResult(next >= 3 ? 'Dead' : `Failure (${next}/3)`);
  }

  function handleRoll() {
    if (isDead || isStable) return;
    const result = rollExpression('1d20').total;
    if (result === 20) {
      showResult('Natural 20 — revived!');
      reviveNat20();
    } else if (result === 1) {
      const next = Math.min(3, saves.failures + 2);
      onSavesChange({ ...saves, failures: next });
      showResult(next >= 3 ? '1 — Dead' : `1 — Two failures! (${next}/3)`);
    } else if (result >= 10) {
      const next = Math.min(3, saves.successes + 1);
      if (next >= 3) { stabilize(); showResult(`${result} — Stable at 0 HP`); }
      else { onSavesChange({ ...saves, successes: next }); showResult(`${result} — Success (${next}/3)`); }
    } else {
      const next = Math.min(3, saves.failures + 1);
      onSavesChange({ ...saves, failures: next });
      showResult(next >= 3 ? `${result} — Dead` : `${result} — Failure (${next}/3)`);
    }
  }

  const resultColor = !lastRoll ? Colors.textDim
    : (lastRoll.includes('Success') || lastRoll.includes('Stable')) ? Colors.green
    : lastRoll.includes('20') ? Colors.gold
    : Colors.red;
  return (
    <View style={styles.deathSection}>
      <Text style={styles.sectionTitle}>DEATH SAVING THROWS</Text>
      {isDead   && <Text style={styles.deathMsg}>💀 This character has died.</Text>}
      {isStable && <Text style={styles.stableMsg}>✅ Stable — 1 HP</Text>}
      {!isDead && !isStable && (
        <>
          <View style={styles.pipRows}>
            <View style={styles.pipRow}>
              <Text style={styles.pipLabel}>Successes</Text>
              <View style={styles.pips}>
                {[0,1,2].map(i => (
                  <View key={i} style={[styles.pip, i < saves.successes && styles.pipSuccess]} />
                ))}
              </View>
            </View>
            <View style={styles.pipRow}>
              <Text style={styles.pipLabel}>Failures</Text>
              <View style={styles.pips}>
                {[0,1,2].map(i => (
                  <View key={i} style={[styles.pip, i < saves.failures && styles.pipFailure]} />
                ))}
              </View>
            </View>
          </View>
          {/* Failure | Roll | Success */}
          <View style={styles.deathBtnRow}>
            <Pressable style={[styles.deathBtn, styles.deathBtnFail]} onPress={addFailure}>
              <Text style={styles.deathBtnFailTxt}>✖ Failure</Text>
            </Pressable>
            <Pressable style={[styles.deathBtn, styles.deathBtnRoll]} onPress={handleRoll}>
              <Text style={styles.deathBtnRollTxt}>🎲 Roll</Text>
            </Pressable>
            <Pressable style={[styles.deathBtn, styles.deathBtnPass]} onPress={addSuccess}>
              <Text style={styles.deathBtnPassTxt}>✔ Success</Text>
            </Pressable>
          </View>
          {lastRoll && (
            <Text style={[styles.dieResultTxt, { color: resultColor }]}>{lastRoll}</Text>
          )}
        </>
      )}
      {(saves.successes > 0 || saves.failures > 0 || isDead || isStable) && (
        <Pressable style={styles.deathResetBtn} onPress={() => onSavesChange({ successes: 0, failures: 0 })}>
          <Text style={styles.deathResetTxt}>↺ Reset Death Saves</Text>
        </Pressable>
      )}
    </View>
  );
}

// ── Level Up Button ───────────────────────────────────────────────────────────

function LevelUpSection({
  entity, rules, onEntityUpdate, onLeveled,
}: {
  entity: Entity; rules: CampaignRules; onEntityUpdate: (u: Entity) => void; onLeveled: (u: Entity) => void;
}) {
  const homebrewSubclasses = useHomebrewStore(s => s.subclasses);
  const getMergedContentDB = useHomebrewStore(s => s.getMergedContentDB);
  const [addClassOpen, setAddClassOpen] = useState(false);
  // Set once levelUp()/levelUpClass() has been simulated but not yet
  // resolved — drives LevelUpPreviewModal. confirmPendingLevelUp() below
  // applies `after` verbatim; it must NEVER re-invoke levelUp()/
  // levelUpClass(), since CampaignRules.hpMode can be 'rolled'
  // (Math.random() inside applyHP) — a second call would apply a
  // DIFFERENT roll than the one just previewed.
  const [pendingLevelUp, setPendingLevelUp] = useState<{
    title: string; before: Entity; after: Entity;
  } | null>(null);
  const [plannerOpen, setPlannerOpen] = useState(false);

  function confirmPendingLevelUp() {
    if (!pendingLevelUp) return;
    onEntityUpdate(pendingLevelUp.after);
    onLeveled(pendingLevelUp.after);
    setPendingLevelUp(null);
  }

  // getMergedContentDB() so a homebrew class sharing an official id
  // correctly wins — feeds resolveProgression below, which governs actual
  // level-up mechanics (audit finding CONTENT-1/2/3/4 — this previously
  // spread official first, so .find() always returned the official entry).
  const allClasses = getMergedContentDB().classes as CharClass[];
  const maxLevel    = rules.maxLevel ?? 20;

  function classLabel(id: string) {
    return allClasses.find(c => c.id === id)?.name ?? id;
  }

  function resolveProgression(classId: string, subclassId: string | null) {
    const cls = allClasses.find(c => c.id === classId);
    let progression = cls ? getProgressionForClass(cls) : (ALL_PROGRESSIONS[classId] ?? null);
    // Once a subclass has been chosen (see SubclassPicker/applySubclassToEntity),
    // future level-ups must apply ITS entries too, not just the base class's.
    if (progression && subclassId) {
      const subEntry = getSubclassEntryMerged(classId, subclassId, homebrewSubclasses);
      if (subEntry) progression = mergeSubclassIntoProgression(progression, subEntry.progression);
    }
    return progression;
  }

  if (entity.identity.level >= maxLevel) return null;

  // ── Multiclassing off: exactly today's single-class behavior, unchanged. ──
  if (!rules.allowMulticlass) {
    const classId = entity.identity.classId;
    const progression = resolveProgression(classId, entity.identity.subclassId);
    if (!progression) return null;
    const nextLevel = entity.identity.level + 1;

    async function doLevelUp() {
      const { before, after } = simulate(entity, e => levelUp(e, nextLevel, progression!, rules, allClasses), rules);
      // levelUp() can grant fixed cantrips/spells for this level — warm Tier 2
      // for anything new before the entity reaches the engine pipeline.
      await spellRepo.ensureLoaded(spellIdsOnEntity(after));
      setPendingLevelUp({ title: `Level Up (→ ${nextLevel})`, before, after });
    }

    return (
      <>
        <Pressable style={styles.levelUpBtn} onPress={() => { void doLevelUp(); }}>
          <Text style={styles.levelUpBtnTxt}>⬆ Level Up (→ {nextLevel})</Text>
        </Pressable>
        {entity.identity.level < maxLevel && (
          <Pressable style={styles.plannerBtn} onPress={() => setPlannerOpen(true)}>
            <Text style={styles.plannerBtnTxt}>🔭 Progression Planner</Text>
          </Pressable>
        )}
        <LevelUpPreviewModal
          visible={pendingLevelUp !== null}
          title={pendingLevelUp?.title ?? ''}
          before={pendingLevelUp?.before ?? null}
          after={pendingLevelUp?.after ?? null}
          onConfirm={confirmPendingLevelUp}
          onCancel={() => setPendingLevelUp(null)}
        />
        <ProgressionPlannerModal
          classDefinitions={allClasses}
          visible={plannerOpen}
          entity={entity}
          rules={rules}
          progression={progression}
          onClose={() => setPlannerOpen(false)}
        />
      </>
    );
  }

  // ── Multiclassing on: one "level up" button per class already taken, plus
  //    "+ Add a Class" to take a brand-new one. ──
  const classes = getClassLevels(entity);
  const takenIds = new Set(classes.map(c => c.classId));
  // LIVE-RULESET-2 (item 7): the "+ Add a Class" contextual picker is
  // filtered by the character's own entity.rulesetId — a genuinely NEW
  // pick, unlike allClasses itself (kept unfiltered above, since it's also
  // used to resolve/label classes the character ALREADY has, which must
  // keep working regardless of the character's current ruleset).
  const availableToAdd = allClasses.filter(c => !takenIds.has(asClassId(c.id)) && matchesRuleset(c.rulesetId, entity.rulesetId));

  async function doLevelUpClass(targetClassId: string, targetClass?: CharClass) {
    const existing = classes.find(c => c.classId === targetClassId);
    const progression = resolveProgression(targetClassId, existing?.subclassId ?? null);
    if (!progression) return;
    const { before, after } = simulate(entity, e => levelUpClass(e, targetClassId, progression!, rules, targetClass, allClasses), rules);
    await spellRepo.ensureLoaded(spellIdsOnEntity(after));
    const title = existing
      ? `Level Up ${classLabel(targetClassId)} (→ ${existing.level + 1})`
      : `Add ${targetClass?.name ?? classLabel(targetClassId)} (level 1)`;
    setPendingLevelUp({ title, before, after });
    setAddClassOpen(false); // close the "Add a Class" list modal now — preview takes over
  }

  return (
    <View style={styles.levelUpMcWrap}>
      {classes.map(c => (
        <Pressable
          key={c.classId}
          style={styles.levelUpBtn}
          onPress={() => { void doLevelUpClass(c.classId); }}
        >
          <Text style={styles.levelUpBtnTxt}>⬆ Level Up {classLabel(c.classId)} (→ {c.level + 1})</Text>
        </Pressable>
      ))}

      <Pressable style={styles.addClassBtn} onPress={() => setAddClassOpen(true)}>
        <Text style={styles.addClassBtnTxt}>+ Add a Class</Text>
      </Pressable>

      {entity.identity.level < maxLevel && (
        <Pressable style={styles.plannerBtn} onPress={() => setPlannerOpen(true)}>
          <Text style={styles.plannerBtnTxt}>🔭 Progression Planner</Text>
        </Pressable>
      )}

      <Modal visible={addClassOpen} animationType="slide" onRequestClose={() => setAddClassOpen(false)}>
        <View style={styles.addClassModalRoot}>
          <View style={styles.addClassHeaderRow}>
            <Text style={styles.addClassHeading}>Add a Class</Text>
            <Pressable onPress={() => setAddClassOpen(false)} hitSlop={8}>
              <Text style={styles.addClassClose}>✕</Text>
            </Pressable>
          </View>
          <Text style={styles.addClassSub}>
            Adding a class grants the PHB's reduced multiclass proficiencies
            instead of a fresh class's full starting kit — this isn't a
            hard requirement check, so double-check your ability scores
            meet the prerequisite for both your current class(es) and the
            one you're adding.
          </Text>
          <ScrollView contentContainerStyle={styles.addClassList}>
            {availableToAdd.length === 0 ? (
              <Text style={styles.addClassEmpty}>No other classes available to add.</Text>
            ) : availableToAdd.map(c => (
              <Pressable
                key={c.id}
                style={styles.addClassRow}
                onPress={() => { void doLevelUpClass(c.id, c); }}
              >
                <Text style={styles.addClassRowTxt}>{c.name}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      </Modal>

      <LevelUpPreviewModal
        visible={pendingLevelUp !== null}
        title={pendingLevelUp?.title ?? ''}
        before={pendingLevelUp?.before ?? null}
        after={pendingLevelUp?.after ?? null}
        onConfirm={confirmPendingLevelUp}
        onCancel={() => setPendingLevelUp(null)}
      />
      <MulticlassProgressionPlannerModal
        classDefinitions={allClasses}
        visible={plannerOpen}
        entity={entity}
        rules={rules}
        availableToAdd={availableToAdd}
        resolveProgression={resolveProgression}
        classLabel={classLabel}
        onClose={() => setPlannerOpen(false)}
      />
    </View>
  );
}

// ── Number Prompt Modal (manual HP set / add temp HP) ─────────────────────────

function NumberPromptModal({
  visible, title, label, confirmLabel, onConfirm, onClose,
}: {
  visible: boolean;
  title: string;
  label: string;
  confirmLabel: string;
  onConfirm: (n: number) => void;
  onClose: () => void;
}) {
  const [text, setText] = useState('');
  const insets = useSafeAreaInsets();
  const n = parseInt(text, 10);
  const valid = !isNaN(n) && n >= 0;

  function submit() {
    if (!valid) return;
    onConfirm(n);
    setText('');
    onClose();
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={[styles.concSheet, { paddingBottom: Math.max(insets.bottom, Spacing.md) }]} onPress={e => e.stopPropagation()}>
          <Text style={styles.concTitle}>{title}</Text>
          <Text style={styles.concSpell}>{label}</Text>
          <TextInput
            style={styles.numInput}
            value={text}
            onChangeText={setText}
            keyboardType="number-pad"
            placeholder="0"
            placeholderTextColor={Colors.textDim}
            autoFocus
          />
          <Pressable style={[styles.rollBtn, !valid && { opacity: 0.4 }]} onPress={submit} disabled={!valid}>
            <Text style={styles.rollBtnTxt}>{confirmLabel}</Text>
          </Pressable>
          <Pressable style={styles.closeBtnSm} onPress={onClose}>
            <Text style={styles.closeBtnSmTxt}>Cancel</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ── Ad-hoc feat choice ────────────────────────────────────────────────────────

/**
 * Synthesizes a one-off ASI/feat ChoiceState so a player can take a feat
 * directly from the sheet (outside the normal level-up flow). The picker in
 * featOnly mode resolves a feat against this choice; applyFeatToEntity records
 * it as a resolved choice on the entity.
 */
function makeAdHocFeatChoice(): import('../../engine/types').ChoiceState {
  const id = `adhoc_feat_${Date.now().toString(36)}`;
  return {
    id,
    grantedAt: 0,
    resolved: false,
    selections: [],
    definition: {
      id,
      prompt: 'Take a feat',
      kind: 'asi',
      count: 1,
      pool: 'all',
      grants: [],
      required: false,
      resolved: false,
    },
  };
}

// ── Senses editor modal ───────────────────────────────────────────────────────

const MANUAL_SENSES_FEATURE_ID = 'manual_senses';
const SENSE_TYPE_OPTIONS: import('../../engine/types').SenseType[] =
  ['darkvision', 'blindsight', 'tremorsense', 'truesight'];

/**
 * Reads the player-managed senses from the dedicated manual-senses feature
 * (source.kind 'campaign', id 'manual_senses'). These are the senses the player
 * can add/remove here; senses granted by race/feat/item features are aggregated
 * separately by the pipeline and shown read-only.
 */
function readManualSenses(entity: Entity): import('../../engine/types').Sense[] {
  const f = entity.features.find(ft => ft.id === MANUAL_SENSES_FEATURE_ID);
  if (!f) return [];
  return (f.effects ?? [])
    .filter(e => e.type === 'grant_sense' && e.senseType)
    .map(e => ({ type: e.senseType!, range: e.senseRange ?? 0, note: e.senseNote }));
}

/** Writes the manual senses back onto the manual-senses feature (replacing it). */
function writeManualSenses(
  entity: Entity,
  senses: import('../../engine/types').Sense[],
  rules: CampaignRules,
): Entity {
  const effects = senses.map(s => ({
    type: 'grant_sense' as const,
    target: 'senses',
    operation: 'add' as const,
    value: null,
    condition: null,
    senseType: s.type,
    senseRange: s.range,
    senseNote: s.note,
  }));
  const others = entity.features.filter(ft => ft.id !== MANUAL_SENSES_FEATURE_ID);
  const updatedFeatures = effects.length === 0
    ? others
    : [...others, {
        id: MANUAL_SENSES_FEATURE_ID,
        name: 'Senses',
        description: 'Player-set senses.',
        source: { kind: 'campaign' as const, refId: MANUAL_SENSES_FEATURE_ID },
        level: null,
        effects,
        actions: [],
        choices: [],
        passive: true,
        isActive: true,
      }];
  return recomputeDerived({ ...entity, features: updatedFeatures }, rules);
}

// ── Movement editor modal ─────────────────────────────────────────────────────
// Same pattern as manual senses above — a mid-session grant (gained a
// climbing speed from an in-game event) that isn't coming from a
// race/feat/item the content pipeline already knows about.
type ManualMove = { type: MoveType; range: number };
function readManualMovement(entity: Entity): ManualMove[] {
  const f = entity.features.find(ft => ft.id === MANUAL_MOVEMENT_FEATURE_ID);
  if (!f) return [];
  return (f.effects ?? [])
    .filter(e => e.type === 'grant_movement' && e.movementType)
    .map(e => ({ type: e.movementType as MoveType, range: e.movementRange ?? 0 }));
}
function writeManualMovement(entity: Entity, moves: ManualMove[], rules: CampaignRules): Entity {
  const effects = moves.map(m => ({
    type: 'grant_movement' as const, target: 'movement', operation: 'add' as const,
    value: null, condition: null,
    movementType: m.type, movementRange: m.range,
  }));
  const others = entity.features.filter(ft => ft.id !== MANUAL_MOVEMENT_FEATURE_ID);
  const updatedFeatures = effects.length === 0 ? others : [...others, {
    id: MANUAL_MOVEMENT_FEATURE_ID, name: 'Movement', description: 'Player-set movement speeds.',
    source: { kind: 'campaign' as const, refId: MANUAL_MOVEMENT_FEATURE_ID },
    level: null, effects, actions: [], choices: [], passive: true, isActive: true,
  }];
  return recomputeDerived({ ...entity, features: updatedFeatures }, rules);
}

function SensesModal({
  visible, entity, rules, onUpdate, onClose,
}: {
  visible: boolean;
  entity: Entity;
  rules: CampaignRules;
  onUpdate: (u: Entity) => void;
  onClose: () => void;
}) {
  const manual = readManualSenses(entity);
  const [type, setType] = useState<import('../../engine/types').SenseType>('darkvision');
  const [range, setRange] = useState('60');
  const [note, setNote] = useState('');

  function addSense() {
    const r = parseInt(range, 10);
    if (isNaN(r) || r <= 0) return;
    // Replace any existing manual sense of the same type.
    const next = [
      ...manual.filter(s => s.type !== type),
      { type, range: r, note: note.trim() || undefined },
    ];
    onUpdate(writeManualSenses(entity, next, rules));
    setNote('');
  }

  function removeSense(t: string) {
    onUpdate(writeManualSenses(entity, manual.filter(s => s.type !== t), rules));
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.condPickerSheet} onPress={e => e.stopPropagation()}>
          <Text style={styles.condPickerTitle}>Senses</Text>

          {/* Current manual senses */}
          {manual.length > 0 && (
            <View style={styles.senseChips}>
              {manual.map(s => (
                <View key={s.type} style={styles.senseChip}>
                  <Text style={styles.senseChipTxt}>
                    {SENSE_LABELS[s.type]} {s.range}ft{s.note ? ` · ${s.note}` : ''}
                  </Text>
                  <Pressable onPress={() => removeSense(s.type)} hitSlop={8}>
                    <Text style={styles.condX}>✕</Text>
                  </Pressable>
                </View>
              ))}
            </View>
          )}

          {/* Type selector */}
          <View style={styles.senseTypeRow}>
            {SENSE_TYPE_OPTIONS.map(t => (
              <Pressable
                key={t}
                style={[styles.senseTypeChip, type === t && styles.senseTypeChipActive]}
                onPress={() => setType(t)}
              >
                <Text style={[styles.senseTypeTxt, type === t && styles.senseTypeTxtActive]}>
                  {SENSE_LABELS[t]}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Range + note */}
          <View style={styles.senseInputRow}>
            <TextInput
              style={[styles.condSearch, { flex: 1 }]}
              value={range}
              onChangeText={setRange}
              keyboardType="number-pad"
              placeholder="Range (ft)"
              placeholderTextColor={Colors.textDim}
            />
            <TextInput
              style={[styles.condSearch, { flex: 2 }]}
              value={note}
              onChangeText={setNote}
              placeholder="Note (e.g. in color, heat)"
              placeholderTextColor={Colors.textDim}
            />
          </View>

          <Pressable style={styles.rollBtn} onPress={addSense}>
            <Text style={styles.rollBtnTxt}>Add / Update Sense</Text>
          </Pressable>
          <Pressable style={styles.cancelBtn} onPress={onClose}>
            <Text style={styles.cancelTxt}>Done</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function MovementModal({
  visible, entity, rules, onUpdate, onClose,
}: {
  visible: boolean;
  entity: Entity;
  rules: CampaignRules;
  onUpdate: (u: Entity) => void;
  onClose: () => void;
}) {
  const manual = readManualMovement(entity);
  const [type, setType] = useState<MoveType>('climb');
  const [range, setRange] = useState('30');

  function addMove() {
    const r = parseInt(range, 10);
    if (isNaN(r) || r <= 0) return;
    onUpdate(writeManualMovement(entity, [...manual.filter(m => m.type !== type), { type, range: r }], rules));
  }
  function removeMove(t: MoveType) {
    onUpdate(writeManualMovement(entity, manual.filter(m => m.type !== t), rules));
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.condPickerSheet} onPress={e => e.stopPropagation()}>
          <Text style={styles.condPickerTitle}>Movement</Text>
          <Text style={styles.emptyNote}>
            Walking speed comes from your race/class — this is for extra movement
            types (climbing, swimming, flying, burrowing) gained mid-campaign.
          </Text>

          {manual.length > 0 && (
            <View style={styles.senseChips}>
              {manual.map(m => (
                <View key={m.type} style={styles.senseChip}>
                  <Text style={styles.senseChipTxt}>{MOVE_TYPE_LABELS[m.type]} {m.range}ft</Text>
                  <Pressable onPress={() => removeMove(m.type)} hitSlop={8}>
                    <Text style={styles.condX}>✕</Text>
                  </Pressable>
                </View>
              ))}
            </View>
          )}

          <View style={styles.senseTypeRow}>
            {MOVE_TYPE_OPTIONS.map(t => (
              <Pressable
                key={t}
                style={[styles.senseTypeChip, type === t && styles.senseTypeChipActive]}
                onPress={() => setType(t)}
              >
                <Text style={[styles.senseTypeTxt, type === t && styles.senseTypeTxtActive]}>
                  {MOVE_TYPE_LABELS[t]}
                </Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.senseInputRow}>
            <TextInput
              style={[styles.condSearch, { flex: 1 }]}
              value={range}
              onChangeText={setRange}
              keyboardType="number-pad"
              placeholder="Speed (ft)"
              placeholderTextColor={Colors.textDim}
            />
          </View>

          <Pressable style={styles.rollBtn} onPress={addMove}>
            <Text style={styles.rollBtnTxt}>Add / Update Speed</Text>
          </Pressable>
          <Pressable style={styles.cancelBtn} onPress={onClose}>
            <Text style={styles.cancelTxt}>Done</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

function TabCharacterInner({
  entity, rules, isDm, campaignId, deviceId,
  onDamage, onHeal, onAddCondition, onRemoveCondition,
  onResourceChange, onSpendSlot, onRestoreSlot, onEntityUpdate, onEndTurn,
}: Props) {
  // Sourced from the merged content DB (not a hardcoded, official-only id
  // list) so homebrew conditions are actually pickable here — audit
  // finding KNOWN_CONDITIONS-1.
  const getMergedContentDB = useHomebrewStore(s => s.getMergedContentDB);
  const [hpOpen,     setHpOpen]     = useState(false);
  const [auditStat,  setAuditStat]  = useState<string | null>(null);
  const [auditLabel, setAuditLabel] = useState('');
  const [condModal,  setCondModal]  = useState(false);
  const [condSearch, setCondSearch] = useState('');
  // Set once a condition name is tapped, before its duration is chosen —
  // drives the "how long?" sub-step shown in the same modal (or the
  // separate NumberPromptModal for the "N Rounds" case).
  const [pendingConditionId, setPendingConditionId] = useState<string | null>(null);
  const [roundsPromptOpen,   setRoundsPromptOpen]   = useState(false);

  function closeConditionFlow() {
    setCondModal(false);
    setCondSearch('');
    setPendingConditionId(null);
    setRoundsPromptOpen(false);
  }
  const [concOpen,   setConcOpen]   = useState(false);
  const [concDamage, setConcDamage] = useState(0);
  const [manualHpOpen, setManualHpOpen] = useState(false);
  const [maxHpOpen,    setMaxHpOpen]    = useState(false);
  const [tempHpOpen,   setTempHpOpen]   = useState(false);
  const [activeFavCard, setActiveFavCard] = useState<ActionCard | null>(null);
  const [pendingFavOptionCard, setPendingFavOptionCard] = useState<ActionCard | null>(null);
  const [levelUpAsiOpen, setLevelUpAsiOpen] = useState(false);
  const [sensesOpen, setSensesOpen] = useState(false);
  const [movementOpen, setMovementOpen] = useState(false);
  const [addFeatOpen, setAddFeatOpen] = useState(false);
  // Inline hit-die result — shown for 3s then cleared, no Alert needed
  const [hitDieResult, setHitDieResult] = useState<string | null>(null);
  const hitDieTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function showHitDieResult(msg: string) {
    setHitDieResult(msg);
    if (hitDieTimer.current) clearTimeout(hitDieTimer.current);
    hitDieTimer.current = setTimeout(() => setHitDieResult(null), 3000);
  }

  const { identity, resources, derived, conditions, spellcasting } = entity;

  // Favorited Actions-tab cards, surfaced here too — starred via the same
  // ☆/★ toggle on the Actions tab (Entity.favoriteActionIds — see
  // isFavoriteCard's doc comment in TabActions.tsx for why this isn't just
  // a Feature.favoriteTag lookup: spell-based and synthetic cards like
  // Unarmed Strike have no backing Feature to store a flag on).
  const { requestPayment, paymentChooser } = useSpellPayment(entity);
  const favoriteCards = (entity.actionCards ?? []).filter(c => isFavoriteCard(entity, c.featureId));
  function handleUseFavorite(card: ActionCard) {
    // A-57 (item 10): a favorited card with discrete use-time options
    // (e.g. Divine Smite's spell-slot tier) must resolve the picker BEFORE
    // spending anything, same as TabActions' own handleUse — this call
    // site used to always pass chosenOption undefined, silently falling
    // back to the card's default cost/tier instead of asking.
    if (card.activation.options && card.activation.options.length > 0) {
      setPendingFavOptionCard(card);
      return;
    }
    // Same fix as TabActions' handleUse — always run applyActionCardUse
    // (it no-ops correctly with nothing to spend) so a cost-less
    // concentration cantrip favorited here also tracks concentration.
    requestPayment(card, undefined, payment => {
      const updated = applyActionCardUse(entity, card, rules, undefined, payment);
      if (updated === entity) return;
      onEntityUpdate(updated);
      setActiveFavCard(card);
    });
  }
  function handleChooseFavoriteOption(option: ActivationOption) {
    const card = pendingFavOptionCard;
    setPendingFavOptionCard(null);
    if (!card) return;
    requestPayment(card, option, payment => {
      const updated = applyActionCardUse(entity, card, rules, option, payment);
      if (updated === entity) return;
      onEntityUpdate(updated);
      setActiveFavCard(card);
    });
  }
  function rollForFavorite(crit: boolean): import('../../engine/types').DiceRoll | null {
    if (!activeFavCard) return null;
    const expr = activeFavCard.layer2.match(/(\d+d\d+(?:[+-]\d+)?)/)?.[1];
    if (!expr) return null;
    const finalExpr = crit ? doubleDiceCount(expr) : expr;
    try { return useDiceLogStore.getState().rollAndLog(finalExpr, activeFavCard.name); }
    catch { return null; }
  }

  // Equipped weapon attack/damage cards
  const weapons = derived.attackBonuses.map(ab => {
    const modStr = ab.damageBonus >= 0 ? `+${ab.damageBonus}` : `${ab.damageBonus}`;
    return {
      itemId:      ab.id,
      name:        ab.name,
      attackBonus: ab.bonus,
      damage:      `${ab.damageDice}${ab.damageBonus !== 0 ? modStr : ''} ${ab.damageType}`.trim(),
      isRanged:    ab.type === 'ranged',
    };
  });

  // ── HP / Hit Dice handlers ──────────────────────────────────────────────────
  function handleSetHp(value: number) {
    const clamped = Math.max(0, Math.min(resources.hp.maximum, value));
    onEntityUpdate(recomputeDerived(
      { ...entity, resources: { ...entity.resources, hp: { ...entity.resources.hp, current: clamped } } },
      rules,
    ));
  }
  function handleSetMaxHp(value: number) {
    // Manual max-HP override. recomputeDerived never touches resources.hp, so this
    // persists. Clamp current HP down if the new max is lower.
    const newMax     = Math.max(1, value);
    const newCurrent = Math.min(entity.resources.hp.current, newMax);
    onEntityUpdate(recomputeDerived(
      { ...entity, resources: { ...entity.resources, hp: { ...entity.resources.hp, maximum: newMax, current: newCurrent } } },
      rules,
    ));
  }
  function handleAddTempHp(value: number) {
    // Temp HP doesn't stack — keep whichever pool is larger.
    const newTemp = Math.max(entity.resources.hp.temp, value);
    onEntityUpdate(recomputeDerived(
      { ...entity, resources: { ...entity.resources, hp: { ...entity.resources.hp, temp: newTemp } } },
      rules,
    ));
  }
  function handleClearTempHp() {
    onEntityUpdate(recomputeDerived(
      { ...entity, resources: { ...entity.resources, hp: { ...entity.resources.hp, temp: 0 } } },
      rules,
    ));
  }
  // Death saves used to be session-local React state that never persisted or
  // synced (see git history) — now writes into entity.resources.deathSaves,
  // same mutate-then-recompute pattern as every other HP change, so it
  // survives app restarts and syncs to other devices via the normal entity
  // broadcast path.
  function handleDeathSavesChange(next: { successes: number; failures: number }) {
    onEntityUpdate(recomputeDerived(
      {
        ...entity,
        resources: {
          ...entity.resources,
          deathSaves: { successes: next.successes, failures: next.failures, stable: next.successes >= 3 },
        },
      },
      rules,
    ));
  }
  function handleRollHitDie() {
    if (resources.hitDice.remaining <= 0) return;
    const before  = resources.hp.current;
    const updated = spendHitDie(entity, rules);
    onEntityUpdate(updated);
    const healed = updated.resources.hp.current - before;
    showHitDieResult(`+${healed} HP restored`);
  }
  function handleDiscardHitDie() {
    if (resources.hitDice.remaining <= 0) return;
    onEntityUpdate(discardHitDie(entity, rules));
    showHitDieResult('Hit die spent — roll your die and heal');
  }

  function openAudit(stat: string, label: string) {
    setAuditStat(stat);
    setAuditLabel(label);
  }

  // Damage handler — triggers concentration check modal if needed.
  // Reads fresh entity state AFTER onDamage (Zustand is synchronous)
  // so the modal gets the correct entity, not the stale prop.
  const handleDamage = useCallback((amount: number, damageType?: string) => {
    onDamage(amount, damageType);
    const { characters } = useCharacterStore.getState();
    const fresh = characters.find(c => c.id === entity.id);
    if (fresh?.spellcasting?.concentrating) {
      setConcDamage(amount);
      setConcOpen(true);
    }
  }, [onDamage, entity.id]);

  const hpPct = resources.hp.maximum > 0
    ? Math.max(0, Math.min(1, resources.hp.current / resources.hp.maximum))
    : 0;
  const hpColor = hpPct > 0.5 ? Colors.green : hpPct > 0.25 ? Colors.gold : Colors.red;
  const isDying = resources.hp.current === 0 && resources.hp.maximum > 0;

  const exhaustion = entity.conditionMonitor.exhaustion;

  // TABCHAR-PERF-1: was recomputed (map+filter over the merged condition
  // list) on every render, including every keystroke in condSearch and
  // every render triggered by something unrelated to conditions at all
  // (this is the default/most-rendered character-sheet tab). getMergedContentDB()
  // itself is called once per render (cheap — cached at the store level as
  // of CONTENT-REGISTRY-PERF-1, returns the same reference when nothing in
  // the content store changed), and used as a stable useMemo dependency.
  const mergedContentDB = getMergedContentDB();
  const filteredConds = useMemo(() => mergedContentDB.conditions
    .map(c => c.id)
    .filter(c =>
      c.includes(condSearch.toLowerCase()) &&
      !conditions.some(ac => ac.id === c)
    ), [mergedContentDB, condSearch, conditions]);

  const SLOT_TIERS = ['1','2','3','4','5','6','7','8','9'] as const;

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>

      {/* HP Block */}
      <Pressable style={styles.hpBlock} onPress={() => setHpOpen(true)}>
        <Text style={styles.hpLabel}>HIT POINTS</Text>
        <View style={styles.hpNumbers}>
          <Text style={[styles.hpCurrent, { color: isDying ? Colors.red : hpColor }]}>
            {resources.hp.current}
          </Text>
          <Text style={styles.hpSep}>/</Text>
          <Text style={styles.hpMax}>{resources.hp.maximum}</Text>
          {resources.hp.temp > 0 && (
            <Text style={styles.hpTemp}>  +{resources.hp.temp} tmp</Text>
          )}
        </View>
        <View style={styles.hpBarOuter}>
          <View style={[styles.hpBarFill, { width: `${Math.round(hpPct * 100)}%` as any, backgroundColor: hpColor }]} />
        </View>
        {isDying
          ? <Text style={styles.dyingTxt}>💀 Dying — Roll Death Saves below</Text>
          : <Text style={styles.hpTapHint}>Tap to damage / heal</Text>
        }
      </Pressable>

      {/* HP utility row: manual set + temporary HP */}
      {!isDying && (
        <View style={styles.hpUtilRow}>
          <View style={styles.hpUtilBtns}>
            <Pressable style={styles.hpUtilBtn} onPress={() => setManualHpOpen(true)}>
              <Text style={styles.hpUtilTxt}>✎ Set HP</Text>
            </Pressable>
            <Pressable style={styles.hpUtilBtn} onPress={() => setMaxHpOpen(true)}>
              <Text style={styles.hpUtilTxt}>✎ Set Max</Text>
            </Pressable>
          </View>
          <View style={styles.tempHpControls}>
            <Text style={styles.tempHpLabel}>Temp HP: {resources.hp.temp}</Text>
            <Pressable style={styles.resBtn} onPress={handleClearTempHp} disabled={resources.hp.temp <= 0}>
              <Text style={[styles.resBtnTxt, resources.hp.temp <= 0 && styles.disabled]}>−</Text>
            </Pressable>
            <Pressable style={styles.resBtn} onPress={() => setTempHpOpen(true)}>
              <Text style={styles.resBtnTxt}>+</Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* Death Saves (only when HP = 0) */}
      {isDying && (
        <DeathSavesSection
          entity={entity}
          rules={rules}
          saves={resources.deathSaves}
          onSavesChange={handleDeathSavesChange}
          onEntityUpdate={onEntityUpdate}
        />
      )}

      {/* Stat Row */}
      <View style={styles.statRow}>
        {[
          { label: 'AC',    value: derived.ac,               stat: 'ac' },
          { label: 'Speed', value: `${derived.speed}ft`,     stat: 'speed' },
          { label: 'Init',  value: derived.initiative >= 0 ? `+${derived.initiative}` : String(derived.initiative), stat: 'initiative' },
          { label: 'Perc',  value: derived.passivePerception, stat: 'passivePerception' },
        ].map(({ label, value, stat }) => {
          const hasOv = hasActiveOverride(entity, stat);
          return (
            <Pressable key={stat} style={[styles.statBox, hasOv && styles.statBoxOverride]} onPress={() => openAudit(stat, label)}>
              <View style={styles.statValueRow}>
                <Text style={styles.statValue}>{value}</Text>
                {hasOv && <Text style={styles.overrideStar}>✱</Text>}
              </View>
              <Text style={styles.statLabel}>{label}</Text>
            </Pressable>
          );
        })}
      </View>

      {/* Favorites — starred on the Actions tab, quick-access here so a
          go-to ability doesn't need a tab switch mid-combat. */}
      {favoriteCards.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>FAVORITES</Text>
          {favoriteCards.map(c => (
            <ActionCardRow
              key={c.featureId}
              card={c}
              onUse={handleUseFavorite}
              isFavorite
              onToggleFavorite={c => onEntityUpdate(toggleFavoriteTag(entity, c.featureId))}
            />
          ))}
        </View>
      )}

      {/* Level Up + Add Feat */}
      <View style={styles.levelUpRow}>
        <View style={{ flex: 1 }}>
          <LevelUpSection
            entity={entity}
            rules={rules}
            onEntityUpdate={onEntityUpdate}
            onLeveled={(updated) => {
              const hasAsi = updated.choices.some(c => c.definition.kind === 'asi' && !c.resolved);
              if (hasAsi) setLevelUpAsiOpen(true);
              // Other pending choices (subclass, spells) surface in the Features tab automatically
            }}
          />
        </View>
        <Pressable style={styles.addFeatBtn} onPress={() => setAddFeatOpen(true)}>
          <Text style={styles.addFeatTxt}>+ Feat</Text>
        </Pressable>
      </View>

      {/* Companion (Steel Defender, Eldritch Cannon, etc.) — self-contained,
          renders nothing if this entity has no companion-granting feature. */}
      <CompanionSection owner={entity} rules={rules} />

      {/* Weapon Attacks */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>ATTACKS</Text>
        {weapons.length === 0 ? (
          <Text style={styles.emptyNote}>No weapons equipped</Text>
        ) : (
          weapons.map(w => (
            <View key={w.itemId} style={styles.weaponRow}>
              <View style={styles.weaponInfo}>
                <Text style={styles.weaponName}>{w.name}</Text>
                <Text style={styles.weaponDamage}>{w.damage}</Text>
              </View>
              <View style={styles.weaponRight}>
                <Text style={styles.weaponBonus}>
                  {w.attackBonus >= 0 ? `+${w.attackBonus}` : String(w.attackBonus)}
                </Text>
                <View style={[styles.weaponBadge, w.isRanged && styles.weaponBadgeRanged]}>
                  <Text style={styles.weaponBadgeTxt}>{w.isRanged ? 'Ranged' : 'Melee'}</Text>
                </View>
              </View>
            </View>
          ))
        )}
      </View>

      {/* Movement types — fly/swim/climb/burrow, visible in combat too since
          "can I climb this wall to escape" is a combat-turn decision. Walking
          speed alone stays in the AC/Speed/Init/Perc stat row above. */}
      {(() => {
        const mv = derived.movement;
        const extraMoves = (['fly', 'swim', 'climb', 'burrow'] as const)
          .filter(t => (mv[t] ?? 0) > 0)
          .map(t => ({ type: t, value: mv[t]! }));
        return (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>MOVEMENT</Text>
              <Pressable style={styles.sectionActionBtn} onPress={() => setMovementOpen(true)}>
                <Text style={styles.sectionActionTxt}>✎ Edit</Text>
              </Pressable>
            </View>
            {extraMoves.length === 0 ? (
              <Text style={styles.emptyNote}>Walking speed only</Text>
            ) : (
              <View style={styles.senseChips}>
                {extraMoves.map(m => (
                  <View key={m.type} style={styles.senseChip}>
                    <Text style={styles.senseChipTxt}>{MOVE_TYPE_LABELS[m.type]} {m.value}ft</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        );
      })()}

      {/* Senses — visible in combat too (not just Exploration), since knowing
          your darkvision/blindsight range matters mid-fight (fighting in
          darkness, tracking an invisible enemy, etc.). */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>SENSES</Text>
          <Pressable style={styles.sectionActionBtn} onPress={() => setSensesOpen(true)}>
            <Text style={styles.sectionActionTxt}>✎ Edit</Text>
          </Pressable>
        </View>
        {derived.senses.length === 0 ? (
          <Text style={styles.emptyNote}>Normal vision only</Text>
        ) : (
          <View style={styles.senseChips}>
            {derived.senses.map(s => (
              <View key={s.type} style={styles.senseChip}>
                <Text style={styles.senseChipTxt}>
                  {SENSE_LABELS[s.type]} {s.range}ft{s.note ? ` · ${s.note}` : ''}
                </Text>
              </View>
            ))}
          </View>
        )}
      </View>

      {/* Hit Dice */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>HIT DICE</Text>
          <Text style={styles.hitDiceCount}>
            {resources.hitDice.remaining}/{resources.hitDice.total}  ·  {
              // A mixed multiclass pool (see HitDiceBlock's doc comment)
              // can't be summarized by the single `die` field alone —
              // show each size's own remaining/total instead.
              resources.hitDice.pools
                ? resources.hitDice.pools.map(p => `${p.remaining}d${p.die}`).join(' + ')
                : `d${resources.hitDice.die}`
            }
          </Text>
        </View>
        <View style={styles.hitDieRow}>
          <Pressable
            style={[styles.hitDieBtn, styles.hitDieRoll, resources.hitDice.remaining <= 0 && styles.useHitDieBtnDisabled]}
            onPress={handleRollHitDie}
            disabled={resources.hitDice.remaining <= 0}
          >
            <Text style={styles.useHitDieTxt}>🎲 Roll Hit Die</Text>
          </Pressable>
          <Pressable
            style={[styles.hitDieBtn, styles.hitDieUse, resources.hitDice.remaining <= 0 && styles.useHitDieBtnDisabled]}
            onPress={handleDiscardHitDie}
            disabled={resources.hitDice.remaining <= 0}
          >
            <Text style={styles.hitDieUseTxt}>Use Hit Die</Text>
          </Pressable>
        </View>
        <Text style={styles.hitDieHint}>Roll: app rolls the die + heals you.  Use: spend one and roll your own.</Text>
        {hitDieResult && (
          <Text style={styles.dieResultTxt}>{hitDieResult}</Text>
        )}
      </View>

      {/* Conditions + Exhaustion */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>CONDITIONS</Text>
          <Pressable style={styles.addBtn} onPress={() => setCondModal(true)}>
            <Text style={styles.addBtnTxt}>+ Add</Text>
          </Pressable>
        </View>

        {/* Exhaustion badge + description */}
        {exhaustion > 0 && (
          <View style={styles.exhaustionBlock}>
            <View style={styles.condChip}>
              <Text style={styles.condChipTxt}>Exhaustion {exhaustion}</Text>
            </View>
            <Text style={styles.exhaustionDesc}>{EXHAUSTION_EFFECTS[exhaustion]}</Text>
          </View>
        )}

        {/* Stabilized — shown when at 0 HP with 3 death save successes */}
        {entity.resources.hp.current <= 0 && resources.deathSaves.successes >= 3 && (
          <View style={styles.stabilizedChip}>
            <Text style={styles.stabilizedTxt}>♥ STABILIZED</Text>
          </View>
        )}

        {conditions.length === 0 && exhaustion === 0 ? (
          <Text style={styles.emptyNote}>No active conditions</Text>
        ) : (
          <View style={styles.condRow}>
            {conditions.map(c => (
              <View key={c.id} style={styles.condChip}>
                <Text style={styles.condChipTxt}>
                  {c.id}
                  {c.duration?.unit === 'rounds' && ` · ${c.duration.remaining}r`}
                  {c.duration?.unit === 'until_rest' && ' · until rest'}
                </Text>
                <Pressable onPress={() => onRemoveCondition(c.id)} hitSlop={8}>
                  <Text style={styles.condX}>✕</Text>
                </Pressable>
              </View>
            ))}
          </View>
        )}

        {/* A-25: action/bonus-action/reaction pips — tap to correct manually
            (real play has actions the app never models as a card: Dash/
            Dodge/Help/Search, a reaction spent narratively). Auto-set when
            an actual action-type card gets used, via applyActionCardUse. */}
        <View style={styles.turnEconomyRow}>
          {(['action', 'bonus_action', 'reaction'] as const).map(slot => {
            const used = slot === 'action' ? entity.turnState?.actionUsed
              : slot === 'bonus_action' ? entity.turnState?.bonusActionUsed
              : entity.turnState?.reactionUsed;
            const label = slot === 'action' ? 'Action' : slot === 'bonus_action' ? 'Bonus' : 'Reaction';
            return (
              <Pressable
                key={slot}
                style={[styles.turnPip, used && styles.turnPipUsed]}
                onPress={() => onEntityUpdate(toggleActionEconomy(entity, slot))}
              >
                <Text style={[styles.turnPipTxt, used && styles.turnPipTxtUsed]}>{label}</Text>
              </Pressable>
            );
          })}
        </View>

        {/* Closure item 16: calls the ONE shared onEndTurn handler
            (app/sheet/[id].tsx's handleEndTurn) rather than computing
            playerEndTurn() locally and routing it through THIS tab's own
            onEntityUpdate (which used a different label/category than the
            other two tabs) — guarantees identical timeline/sync/undo
            behavior regardless of which tab End Turn is pressed from.
            Always visible (action-economy reset is relevant every turn
            regardless). No preview gate: advancing a turn is expected/
            mundane, not a surprising commit. */}
        <Pressable
          style={styles.endTurnBtn}
          onPress={onEndTurn}
        >
          <Text style={styles.endTurnBtnTxt}>⏭ End Turn</Text>
        </Pressable>

        {/* Mechanical effect reminders for active conditions */}
        {conditions.filter(c => CONDITION_WARNINGS[c.id]).map(c => (
          <Text key={`warn-${c.id}`} style={styles.condWarning}>
            ⚠ <Text style={styles.condWarningName}>{c.id}:</Text> {CONDITION_WARNINGS[c.id]}
          </Text>
        ))}

        {/* Advantage/Disadvantage grants from race/class traits, items, etc.
            Reminder only, same as condition warnings above — the app has no
            attack-roll automation anywhere, so this doesn't change how any
            roll button behaves, it just makes sure these aren't forgotten. */}
        {(derived.advantageStates?.length ?? 0) > 0 && (
          <View style={styles.advList}>
            {derived.advantageStates.map((a, i) => (
              <Text key={i} style={[styles.condWarning, a.state === 'advantage' ? styles.advTxt : styles.disadvTxt]}>
                {a.state === 'advantage' ? '↑ Advantage: ' : '↓ Disadvantage: '}{a.target}
              </Text>
            ))}
          </View>
        )}
      </View>

      {/* Concentration indicator */}
      {spellcasting?.concentrating && (
        <View style={styles.concIndicator}>
          <Text style={styles.concIndicatorTxt}>
            🧠 Concentrating on: {spellRepo.getSpellSync(spellcasting.concentrating)?.name ?? spellcasting.concentrating}
            {spellcasting.concentratingDuration?.unit === 'rounds' && ` · ${spellcasting.concentratingDuration.remaining}r`}
          </Text>
        </View>
      )}

      {/* Resources */}
      {resources.custom.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>RESOURCES</Text>
          {resources.custom.map(r => (
            <View key={r.id} style={styles.resourceRow}>
              <View style={styles.resourceInfo}>
                <Text style={styles.resourceName}>{r.name}</Text>
                <Text style={styles.resourceRecharge}>{r.recharge.replace('_', ' ')}</Text>
              </View>
              <View style={styles.resourceControls}>
                <Pressable style={styles.resBtn} onPress={() => onResourceChange(r.id, -1)} disabled={r.current <= 0}>
                  <Text style={[styles.resBtnTxt, r.current <= 0 && styles.disabled]}>−</Text>
                </Pressable>
                <Text style={styles.resourceCount}>
                  {r.current}<Text style={styles.resourceMax}>/{r.maximum}</Text>
                </Text>
                <Pressable style={styles.resBtn} onPress={() => onResourceChange(r.id, 1)} disabled={r.current >= r.maximum}>
                  <Text style={[styles.resBtnTxt, r.current >= r.maximum && styles.disabled]}>+</Text>
                </Pressable>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Spell Slots */}
      {spellcasting && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>SPELL SLOTS</Text>
          <View style={styles.slotGrid}>
            {(['normal', 'pact'] as const).flatMap(kind => SLOT_TIERS.map(tier => ({ kind, tier }))).map(({ kind, tier }) => {
              const slot = (kind === 'pact' ? spellcasting.pactSlots : spellcasting.slots)?.[tier];
              if (!slot || slot.total === 0) return null;
              return (
                <View key={kind + tier} style={styles.slotBlock}>
                  <Text style={styles.slotTier}>{kind === 'pact' ? 'Pact · ' : ''}Lv {tier}</Text>
                  {/* Re-audit closure item 1: pips are spend-ONLY now — tapping
                      any pip always spends one slot (a no-op once fully
                      exhausted, since spendSpellSlot's own invariant refuses
                      to spend past total). Restoration is a deliberate,
                      separate action via the explicit "+" button below (same
                      pattern the RESOURCES section above already uses for
                      its own −/+ controls) — never triggered by an ordinary
                      pip tap, so casually tapping an exhausted slot row can
                      no longer silently heal a slot back. */}
                  <View style={styles.slotPips}>
                    {Array.from({ length: slot.total }).map((_, i) => (
                      <Pressable
                        key={i}
                        hitSlop={10}
                        style={[styles.pip2, i < slot.used && styles.pip2Used]}
                        onPress={() => onSpendSlot(tier, kind)}
                      />
                    ))}
                  </View>
                  <View style={styles.slotCountRow}>
                    <Pressable
                      hitSlop={8}
                      style={styles.slotRestoreBtn}
                      disabled={slot.used === 0}
                      onPress={() => onRestoreSlot(tier, kind)}
                      accessibilityLabel={`Restore a level ${tier} slot`}
                    >
                      <Text style={[styles.slotRestoreBtnTxt, slot.used === 0 && styles.disabled]}>+</Text>
                    </Pressable>
                    <Text style={styles.slotCount}>{slot.total - slot.used}/{slot.total}</Text>
                  </View>
                </View>
              );
            })}
          </View>
        </View>
      )}

      {/* Modals */}
      <AuditModal
        entity={entity}
        stat={auditStat}
        label={auditLabel}
        rules={rules}
        isDm={isDm}
        campaignId={campaignId}
        deviceId={deviceId}
        onUpdate={onEntityUpdate}
        onClose={() => setAuditStat(null)}
      />

      <HpModal
        visible={hpOpen}
        currentHp={resources.hp.current}
        maxHp={resources.hp.maximum}
        onDamage={handleDamage}
        onHeal={onHeal}
        onClose={() => setHpOpen(false)}
      />

      <NumberPromptModal
        visible={manualHpOpen}
        title="Set HP"
        label={`Set current HP to (max ${resources.hp.maximum}):`}
        confirmLabel="Set HP"
        onConfirm={handleSetHp}
        onClose={() => setManualHpOpen(false)}
      />

      <NumberPromptModal
        visible={maxHpOpen}
        title="Set Max HP"
        label="Set maximum HP to (overrides the calculated value):"
        confirmLabel="Set Max HP"
        onConfirm={handleSetMaxHp}
        onClose={() => setMaxHpOpen(false)}
      />

      <NumberPromptModal
        visible={tempHpOpen}
        title="Add Temporary HP"
        label="Temp HP only replaces if higher than current."
        confirmLabel="Add Temp HP"
        onConfirm={handleAddTempHp}
        onClose={() => setTempHpOpen(false)}
      />

      <ConcentrationModal
        visible={concOpen}
        damageTaken={concDamage}
        entity={useCharacterStore.getState().characters.find(c => c.id === entity.id) ?? entity}
        rules={rules}
        onResolve={updated => { onEntityUpdate(updated); setConcOpen(false); }}
        onClose={() => setConcOpen(false)}
      />

      {/* Condition Picker Modal */}
      <Modal visible={condModal} transparent animationType="slide" onRequestClose={closeConditionFlow}>
        <Pressable style={styles.backdrop} onPress={closeConditionFlow}>
          <Pressable style={styles.condPickerSheet} onPress={e => e.stopPropagation()}>
            {pendingConditionId === null ? (
              <>
                <Text style={styles.condPickerTitle}>Add Condition</Text>
                <TextInput
                  style={styles.condSearch}
                  value={condSearch}
                  onChangeText={setCondSearch}
                  placeholder="Search conditions…"
                  placeholderTextColor={Colors.textDim}
                />
                <ScrollView>
                  {filteredConds.map(c => (
                    <Pressable key={c} style={styles.condPickerItem} onPress={() => setPendingConditionId(c)}>
                      <Text style={styles.condPickerItemTxt}>{c}</Text>
                    </Pressable>
                  ))}
                  {filteredConds.length === 0 && (
                    <Text style={styles.emptyNote}>No conditions found</Text>
                  )}
                </ScrollView>
                <Pressable style={styles.cancelBtn} onPress={closeConditionFlow}>
                  <Text style={styles.cancelTxt}>Cancel</Text>
                </Pressable>
              </>
            ) : (
              <>
                <Text style={styles.condPickerTitle}>How long — {pendingConditionId}?</Text>
                <Pressable
                  style={styles.condPickerItem}
                  onPress={() => { onAddCondition(pendingConditionId, null); closeConditionFlow(); }}
                >
                  <Text style={styles.condPickerItemTxt}>Permanent</Text>
                </Pressable>
                <Pressable
                  style={styles.condPickerItem}
                  onPress={() => { onAddCondition(pendingConditionId, { unit: 'until_rest', remaining: 0 }); closeConditionFlow(); }}
                >
                  <Text style={styles.condPickerItemTxt}>Until Next Rest</Text>
                </Pressable>
                <Pressable
                  style={styles.condPickerItem}
                  onPress={() => { setCondModal(false); setRoundsPromptOpen(true); }}
                >
                  <Text style={styles.condPickerItemTxt}>N Rounds…</Text>
                </Pressable>
                <Pressable style={styles.cancelBtn} onPress={() => setPendingConditionId(null)}>
                  <Text style={styles.cancelTxt}>Back</Text>
                </Pressable>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      <NumberPromptModal
        visible={roundsPromptOpen}
        title={`${pendingConditionId} — Rounds`}
        label="How many rounds until it expires?"
        confirmLabel="Add Condition"
        onConfirm={n => { onAddCondition(pendingConditionId!, { unit: 'rounds', remaining: Math.max(1, n) }); closeConditionFlow(); }}
        onClose={closeConditionFlow}
      />

      {/* Level-up ASI / Feat picker */}
      <Modal visible={levelUpAsiOpen} animationType="slide" onRequestClose={() => setLevelUpAsiOpen(false)}>
        <View style={styles.lvModalRoot}>
          {(() => {
            const pending = entity.choices.filter(c => c.definition.kind === 'asi' && !c.resolved);
            if (pending.length === 0) {
              return (
                <View style={styles.lvDone}>
                  <Text style={styles.lvDoneTxt}>All set — no improvements to resolve.</Text>
                  <Pressable style={styles.lvDoneBtn} onPress={() => setLevelUpAsiOpen(false)}>
                    <Text style={styles.lvDoneBtnTxt}>Done</Text>
                  </Pressable>
                </View>
              );
            }
            return (
              <AsiFeatPicker
                entity={entity}
                choice={pending[0]}
                rules={rules}
                onClose={() => setLevelUpAsiOpen(false)}
                onResolved={(updated) => {
                  onEntityUpdate(updated);
                  const more = updated.choices.some(c => c.definition.kind === 'asi' && !c.resolved);
                  if (!more) setLevelUpAsiOpen(false);
                }}
                browseStateKey="feat:levelup"
              />
            );
          })()}
        </View>
      </Modal>

      {/* Senses editor */}
      <SensesModal
        visible={sensesOpen}
        entity={entity}
        rules={rules}
        onClose={() => setSensesOpen(false)}
        onUpdate={(u) => { onEntityUpdate(u); }}
      />

      {/* Movement editor */}
      <MovementModal
        visible={movementOpen}
        entity={entity}
        rules={rules}
        onClose={() => setMovementOpen(false)}
        onUpdate={(u) => { onEntityUpdate(u); }}
      />

      {paymentChooser}
      <UseModal
        card={activeFavCard}
        onRoll={rollForFavorite}
        onClose={() => setActiveFavCard(null)}
      />

      <ActivationOptionModal
        entity={entity}
        card={pendingFavOptionCard}
        onChoose={handleChooseFavoriteOption}
        onClose={() => setPendingFavOptionCard(null)}
      />

      {/* Add a feat ad-hoc from the sheet */}
      <Modal visible={addFeatOpen} animationType="slide" onRequestClose={() => setAddFeatOpen(false)}>
        <View style={styles.lvModalRoot}>
          <AsiFeatPicker
            entity={entity}
            choice={makeAdHocFeatChoice()}
            rules={rules}
            featOnly
            onClose={() => setAddFeatOpen(false)}
            onResolved={(updated) => {
              onEntityUpdate(updated);
              setAddFeatOpen(false);
            }}
            browseStateKey="feat:live"
          />
        </View>
      </Modal>

    </ScrollView>
  );
}

// EDIT-PERF-1: memoized so opening an unrelated sheet-level modal (Free
// Edit, Ruleset Change, History, ...) doesn't force this tab to re-render —
// only actually matters combined with the caller passing stable prop
// references (see app/sheet/[id].tsx's onCombatEntityUpdate etc.).
export const TabCharacter = memo(TabCharacterInner);

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  scroll:   { flex: 1 },
  content:  { padding: Spacing.md, gap: Spacing.md, paddingBottom: Spacing.xxl },

  hpBlock: {
    backgroundColor: Colors.surface, borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.border,
    padding: Spacing.md, alignItems: 'center', gap: Spacing.sm,
  },
  hpLabel:   { fontSize: FontSize.xs, color: Colors.textSecondary, letterSpacing: 2, fontWeight: FontWeight.bold },
  hpNumbers: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
  hpCurrent: { fontSize: 56, fontWeight: FontWeight.bold },
  hpSep:     { fontSize: FontSize.xl, color: Colors.textDim },
  hpMax:     { fontSize: FontSize.xl, color: Colors.textSecondary },
  hpTemp:    { fontSize: FontSize.sm, color: Colors.blue, alignSelf: 'flex-end' },
  hpBarOuter:{ width: '100%', height: 6, backgroundColor: Colors.border, borderRadius: Radius.full, overflow: 'hidden' },
  hpBarFill: { height: '100%', borderRadius: Radius.full },
  hpTapHint: { fontSize: FontSize.xs, color: Colors.textDim },
  dyingTxt:  { fontSize: FontSize.sm, color: Colors.red, fontWeight: FontWeight.bold },

  // HP utility row
  hpUtilRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: Colors.surface, borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.border, padding: Spacing.sm,
  },
  hpUtilBtn:      { paddingVertical: 4, paddingHorizontal: Spacing.sm },
  hpUtilBtns:     { flexDirection: 'row', gap: Spacing.xs },
  hpUtilTxt:      { fontSize: FontSize.sm, color: Colors.gold, fontWeight: FontWeight.bold },
  tempHpControls: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  tempHpLabel:    { fontSize: FontSize.sm, color: Colors.blue, fontWeight: FontWeight.bold },

  // Hit dice
  hitDiceCount: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: FontWeight.bold },
  useHitDieBtn: {
    backgroundColor: Colors.green + '22', borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.green + '66',
    padding: Spacing.sm, alignItems: 'center',
  },
  useHitDieBtnDisabled: { opacity: 0.4 },
  useHitDieTxt: { color: Colors.green, fontWeight: FontWeight.bold, fontSize: FontSize.md },

  // Weapon attacks
  weaponRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  weaponInfo:   { flex: 1 },
  weaponName:   { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  weaponDamage: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 2 },
  weaponRight:  { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  weaponBonus:  { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.gold },
  weaponBadge: {
    backgroundColor: Colors.red + '22', borderRadius: Radius.sm,
    paddingHorizontal: Spacing.sm, paddingVertical: 2,
  },
  weaponBadgeRanged: { backgroundColor: Colors.blue + '22' },
  weaponBadgeTxt:    { fontSize: FontSize.xs, color: Colors.textSecondary, fontWeight: FontWeight.bold },

  // Condition warnings
  condWarning:     { fontSize: FontSize.xs, color: Colors.gold, marginTop: 4, lineHeight: 16 },
  condWarningName: { fontWeight: FontWeight.bold, textTransform: 'capitalize' },
  advList: { marginTop: 4, gap: 2 },
  advTxt:    { color: Colors.green },
  disadvTxt: { color: Colors.red },

  // Number prompt modal input
  numInput: {
    backgroundColor: Colors.surface, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border,
    padding: Spacing.md, fontSize: FontSize.xl, color: Colors.textPrimary,
    textAlign: 'center', fontWeight: FontWeight.bold,
  },

  // Death saves
  deathSection: {
    backgroundColor: Colors.red + '11', borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.red + '44',
    padding: Spacing.md, gap: Spacing.sm,
  },
  deathMsg:   { color: Colors.red, fontWeight: FontWeight.bold, fontSize: FontSize.md },
  stableMsg:  { color: Colors.green, fontWeight: FontWeight.bold, fontSize: FontSize.md },
  stabilizedChip: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.green + '22',
    borderRadius: Radius.full,
    borderWidth: 1.5, borderColor: Colors.green,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs,
    alignSelf: 'flex-start',
    marginBottom: Spacing.xs,
  },
  stabilizedTxt: { color: Colors.green, fontWeight: FontWeight.bold, fontSize: FontSize.sm, letterSpacing: 1 },
  pipRows:    { gap: Spacing.sm },
  pipRow:     { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  pipLabel:   { fontSize: FontSize.sm, color: Colors.textSecondary, width: 80 },
  pips:       { flexDirection: 'row', gap: Spacing.sm },
  pip: {
    width: 20, height: 20, borderRadius: Radius.full,
    borderWidth: 2, borderColor: Colors.border, backgroundColor: 'transparent',
  },
  pipSuccess: { backgroundColor: Colors.green, borderColor: Colors.green },
  pipFailure: { backgroundColor: Colors.red,   borderColor: Colors.red },
  deathRollBtn: {
    backgroundColor: Colors.red, borderRadius: Radius.md,
    padding: Spacing.sm, alignItems: 'center',
  },
  deathRollBtnTxt: { color: Colors.white, fontWeight: FontWeight.bold, fontSize: FontSize.md },
  deathResetBtn: {
    backgroundColor: Colors.surfaceHigh, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border,
    padding: Spacing.sm, alignItems: 'center', marginTop: Spacing.xs,
  },
  deathResetTxt: { color: Colors.textSecondary, fontWeight: FontWeight.bold, fontSize: FontSize.sm },
  // Death save manual buttons
  deathBtnRow: { flexDirection: 'row', gap: Spacing.xs },
  deathBtn: {
    flex: 1, borderRadius: Radius.md, borderWidth: 1,
    paddingVertical: Spacing.sm, alignItems: 'center',
  },
  deathBtnFail: { backgroundColor: Colors.red + '22', borderColor: Colors.red + '66' },
  deathBtnFailTxt: { color: Colors.red, fontWeight: FontWeight.bold, fontSize: FontSize.sm },
  deathBtnRoll: { backgroundColor: Colors.surfaceHigh, borderColor: Colors.border },
  deathBtnRollTxt: { color: Colors.textPrimary, fontWeight: FontWeight.bold, fontSize: FontSize.sm },
  deathBtnPass: { backgroundColor: Colors.green + '22', borderColor: Colors.green + '66' },
  deathBtnPassTxt: { color: Colors.green, fontWeight: FontWeight.bold, fontSize: FontSize.sm },

  statRow: { flexDirection: 'row', gap: Spacing.sm },
  statBox: {
    flex: 1, backgroundColor: Colors.surface,
    borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border,
    padding: Spacing.sm, alignItems: 'center', gap: 2,
  },
  statBoxOverride: { borderColor: Colors.gold + '66' },

  // Exploration panel
  passiveRow:   { flexDirection: 'row', gap: Spacing.sm },
  passiveBox: {
    flex: 1, backgroundColor: Colors.surfaceHigh,
    borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border,
    padding: Spacing.sm, alignItems: 'center', gap: 2,
  },
  passiveValue: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  passiveLabel: { fontSize: 9, color: Colors.textSecondary, letterSpacing: 0.5, textAlign: 'center' },
  sensesWrap:   { gap: Spacing.xs, marginTop: Spacing.xs },
  sensesHeading:{ fontSize: FontSize.xs, color: Colors.textDim, letterSpacing: 1, fontWeight: FontWeight.bold },
  senseChips:   { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  senseChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.blue + '22', borderRadius: Radius.full,
    borderWidth: 1, borderColor: Colors.blue + '55',
    paddingHorizontal: Spacing.sm, paddingVertical: 4,
  },
  senseChipTxt: { fontSize: FontSize.xs, color: Colors.textPrimary, fontWeight: FontWeight.bold },
  senseTypeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  senseTypeChip: {
    backgroundColor: Colors.surface, borderRadius: Radius.full,
    borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: Spacing.sm, paddingVertical: 4,
  },
  senseTypeChipActive: { backgroundColor: Colors.gold + '22', borderColor: Colors.gold },
  senseTypeTxt: { fontSize: FontSize.xs, color: Colors.textSecondary, fontWeight: FontWeight.bold },
  senseTypeTxtActive: { color: Colors.gold },
  senseInputRow: { flexDirection: 'row', gap: Spacing.sm },

  // Level-up + add-feat row
  levelUpRow:  { flexDirection: 'row', gap: Spacing.sm, alignItems: 'stretch' },
  addFeatBtn: {
    backgroundColor: Colors.surfaceHigh, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.gold + '66',
    paddingHorizontal: Spacing.md, justifyContent: 'center', alignItems: 'center',
  },
  addFeatTxt: { color: Colors.gold, fontWeight: FontWeight.bold, fontSize: FontSize.md },
  statValueRow:    { flexDirection: 'row', alignItems: 'center', gap: 2 },
  statValue:       { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  overrideStar:    { fontSize: FontSize.xs, color: Colors.gold, alignSelf: 'flex-start', marginTop: 2 },
  statLabel:       { fontSize: FontSize.xs, color: Colors.textSecondary, letterSpacing: 1 },

  // Level up
  levelUpBtn: {
    backgroundColor: Colors.gold + '22', borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.gold + '66',
    padding: Spacing.sm, alignItems: 'center',
  },
  levelUpBtnTxt: { color: Colors.gold, fontWeight: FontWeight.bold, fontSize: FontSize.md },
  plannerBtn: {
    backgroundColor: Colors.surface, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border,
    padding: Spacing.sm, alignItems: 'center', marginTop: Spacing.xs,
  },
  plannerBtnTxt: { color: Colors.textSecondary, fontWeight: FontWeight.bold, fontSize: FontSize.sm },
  levelUpMcWrap: { gap: Spacing.xs },
  addClassBtn: {
    backgroundColor: Colors.surfaceHigh, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border, borderStyle: 'dashed',
    padding: Spacing.sm, alignItems: 'center',
  },
  addClassBtnTxt: { color: Colors.textSecondary, fontWeight: FontWeight.bold, fontSize: FontSize.md },
  addClassModalRoot: { flex: 1, backgroundColor: Colors.bg, padding: Spacing.lg },
  addClassHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  addClassHeading: { fontSize: FontSize.xxl, fontWeight: FontWeight.black, color: Colors.gold },
  addClassClose: { fontSize: FontSize.xl, color: Colors.textSecondary },
  addClassSub: { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 20, marginTop: Spacing.sm, marginBottom: Spacing.lg },
  addClassList: { gap: Spacing.sm, paddingBottom: Spacing.xxl },
  addClassEmpty: { fontSize: FontSize.sm, color: Colors.textDim, fontStyle: 'italic', textAlign: 'center', padding: Spacing.lg },
  addClassRow: {
    backgroundColor: Colors.surface, borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.border, padding: Spacing.md,
  },
  addClassRowTxt: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.textPrimary },

  section: {
    backgroundColor: Colors.surface, borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.border,
    padding: Spacing.md, gap: Spacing.sm,
  },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionActionBtn: {
    backgroundColor: Colors.gold + '22', borderRadius: Radius.full,
    borderWidth: 1, borderColor: Colors.gold + '66',
    paddingHorizontal: Spacing.sm, paddingVertical: 2,
  },
  sectionActionTxt: { fontSize: FontSize.xs, color: Colors.gold, fontWeight: FontWeight.bold },
  sectionTitle:  { fontSize: FontSize.xs, color: Colors.textSecondary, letterSpacing: 2, fontWeight: FontWeight.bold },
  addBtn: {
    backgroundColor: Colors.surfaceHigh, borderRadius: Radius.sm,
    paddingHorizontal: Spacing.sm, paddingVertical: 2,
    borderWidth: 1, borderColor: Colors.border,
  },
  addBtnTxt: { color: Colors.gold, fontSize: FontSize.xs, fontWeight: FontWeight.bold },

  exhaustionBlock: { gap: 4 },
  exhaustionDesc:  { fontSize: FontSize.xs, color: Colors.textDim, fontStyle: 'italic', paddingLeft: Spacing.sm },

  condRow:     { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  condChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Colors.purple + '33', borderRadius: Radius.full,
    paddingHorizontal: Spacing.sm, paddingVertical: 4,
    borderWidth: 1, borderColor: Colors.purple + '66',
  },
  condChipTxt: { color: Colors.textPrimary, fontSize: FontSize.sm, textTransform: 'capitalize' },
  condX:       { color: Colors.textDim, fontSize: FontSize.sm },
  emptyNote:   { color: Colors.textDim, fontSize: FontSize.sm, fontStyle: 'italic' },

  endTurnBtn: {
    alignSelf: 'flex-start', marginTop: Spacing.xs,
    backgroundColor: Colors.surface, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: Spacing.sm, paddingVertical: 6,
  },
  endTurnBtnTxt: { color: Colors.textSecondary, fontSize: FontSize.sm, fontWeight: FontWeight.bold },

  turnEconomyRow: { flexDirection: 'row', gap: Spacing.xs, marginTop: Spacing.xs },
  turnPip: {
    backgroundColor: Colors.green + '22', borderRadius: Radius.full,
    borderWidth: 1, borderColor: Colors.green + '66',
    paddingHorizontal: Spacing.sm, paddingVertical: 4,
  },
  turnPipUsed: { backgroundColor: Colors.surfaceHigh, borderColor: Colors.border },
  turnPipTxt: { fontSize: FontSize.xs, color: Colors.green, fontWeight: FontWeight.bold },
  turnPipTxtUsed: { color: Colors.textDim },

  concIndicator: {
    backgroundColor: Colors.blue + '22', borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.blue + '44',
    padding: Spacing.sm,
  },
  concIndicatorTxt: { color: Colors.blue, fontSize: FontSize.sm, fontWeight: FontWeight.bold },

  resourceRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  resourceInfo:     { flex: 1 },
  resourceName:     { fontSize: FontSize.md, color: Colors.textPrimary, fontWeight: FontWeight.bold },
  resourceRecharge: { fontSize: FontSize.xs, color: Colors.textDim },
  resourceControls: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  resBtn: {
    width: 32, height: 32, borderRadius: Radius.full,
    backgroundColor: Colors.surfaceHigh, borderWidth: 1, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  resBtnTxt:     { fontSize: FontSize.lg, color: Colors.textPrimary, lineHeight: 20 },
  resourceCount: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary, minWidth: 40, textAlign: 'center' },
  resourceMax:   { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: FontWeight.normal },
  disabled:      { opacity: 0.3 },

  slotGrid:  { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  slotBlock: { alignItems: 'center', gap: 4, minWidth: 50 },
  slotTier:  { fontSize: FontSize.xs, color: Colors.textSecondary, letterSpacing: 1 },
  slotPips:  { flexDirection: 'row', flexWrap: 'wrap', gap: 3 },
  pip2: {
    width: 10, height: 10, borderRadius: Radius.full,
    backgroundColor: Colors.blue,
  },
  pip2Used: { backgroundColor: Colors.border },
  slotCount: { fontSize: FontSize.xs, color: Colors.textDim },
  slotCountRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  slotRestoreBtn: {
    width: 16, height: 16, borderRadius: Radius.full,
    backgroundColor: Colors.surfaceHigh, borderWidth: 1, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  slotRestoreBtnTxt: { fontSize: FontSize.xs, color: Colors.textSecondary, fontWeight: FontWeight.bold, lineHeight: FontSize.xs },

  // Concentration modal
  backdrop:   { flex: 1, backgroundColor: '#000000bb', justifyContent: 'center', padding: Spacing.lg },
  concSheet: {
    backgroundColor: Colors.surfaceHigh, borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.blue + '44',
    padding: Spacing.lg, gap: Spacing.sm,
  },
  concTitle:        { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.blue, textAlign: 'center' },
  concSpell:        { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center' },
  rollBtn:          { backgroundColor: Colors.blue, borderRadius: Radius.md, padding: Spacing.md, alignItems: 'center' },
  rollBtnTxt:       { color: Colors.white, fontWeight: FontWeight.bold, fontSize: FontSize.md },
  closeBtnSm:       { backgroundColor: Colors.surface, borderRadius: Radius.md, padding: Spacing.sm, alignItems: 'center' },
  closeBtnSmTxt:    { color: Colors.textSecondary, fontSize: FontSize.md },

  // Condition picker
  condPickerSheet: {
    backgroundColor: Colors.surfaceHigh,
    borderTopLeftRadius: Radius.lg, borderTopRightRadius: Radius.lg,
    padding: Spacing.lg, gap: Spacing.md, maxHeight: '60%',
  },
  condPickerTitle:   { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary, textAlign: 'center' },
  condSearch: {
    backgroundColor: Colors.surface, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border,
    padding: Spacing.sm, color: Colors.textPrimary,
  },
  condPickerItem: {
    paddingVertical: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  condPickerItemTxt: { fontSize: FontSize.md, color: Colors.textPrimary, textTransform: 'capitalize' },
  cancelBtn:         { alignItems: 'center', padding: Spacing.sm },
  cancelTxt:         { color: Colors.textSecondary, fontSize: FontSize.md },

  // Hit dice buttons
  hitDieRow:    { flexDirection: 'row', gap: Spacing.sm },
  hitDieBtn:    { flex: 1, borderRadius: Radius.md, borderWidth: 1, padding: Spacing.sm, alignItems: 'center' },
  hitDieRoll:   { backgroundColor: Colors.green + '22', borderColor: Colors.green + '66' },
  hitDieUse:    { backgroundColor: Colors.surfaceHigh, borderColor: Colors.border },
  hitDieUseTxt: { color: Colors.textSecondary, fontWeight: FontWeight.bold, fontSize: FontSize.md },
  hitDieHint:   { fontSize: FontSize.xs, color: Colors.textDim, fontStyle: 'italic', marginTop: 4 },
  // Inline result text (hit die + death saves)
  dieResultTxt: {
    fontSize:   FontSize.sm,
    fontWeight: FontWeight.bold,
    color:      Colors.green,
    textAlign:  'center',
    paddingTop: 4,
  },
  // Level-up inline confirm row
  levelUpConfirmRow: {
    flexDirection:  'row',
    alignItems:     'center',
    gap:            Spacing.sm,
    backgroundColor: Colors.gold + '11',
    borderRadius:   Radius.md,
    borderWidth:    1,
    borderColor:    Colors.gold + '66',
    padding:        Spacing.sm,
  },
  levelUpConfirmTxt:    { flex: 1, color: Colors.gold, fontWeight: FontWeight.bold, fontSize: FontSize.sm },
  levelUpConfirmYes: {
    backgroundColor: Colors.gold, borderRadius: Radius.sm,
    paddingHorizontal: Spacing.sm, paddingVertical: 4,
  },
  levelUpConfirmYesTxt:  { color: Colors.bg, fontWeight: FontWeight.bold, fontSize: FontSize.sm },
  levelUpConfirmNo: {
    backgroundColor: Colors.surfaceHigh, borderRadius: Radius.sm,
    paddingHorizontal: Spacing.sm, paddingVertical: 4,
    borderWidth: 1, borderColor: Colors.border,
  },
  levelUpConfirmNoTxt:   { color: Colors.textSecondary, fontWeight: FontWeight.bold, fontSize: FontSize.sm },

  // Level-up modal
  lvModalRoot:  { flex: 1, backgroundColor: Colors.bg, paddingTop: Spacing.xl + 8 },
  lvDone:       { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.lg, padding: Spacing.lg },
  lvDoneTxt:    { fontSize: FontSize.lg, color: Colors.textPrimary, textAlign: 'center' },
  lvDoneBtn:    { backgroundColor: Colors.gold, borderRadius: Radius.md, paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md },
  lvDoneBtnTxt: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.bg },
});
