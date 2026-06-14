// app/sheet/TabCharacter.tsx
// Tab 1 — Combat dashboard. Players live here.
// Includes: HP, stat row, conditions/exhaustion, resources, spell slots,
//           death saves (when HP=0), concentration check, level-up button.
import { useState, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, Pressable, StyleSheet,
  Modal, TextInput,
} from 'react-native';
import { Entity, CampaignRules } from '../../engine/types';
import { useCharacterStore } from '../../store/characterStore';
import { hasActiveOverride } from '../../engine/dmOverride';
import { dropConcentration } from '../../engine/combat';
import { recomputeDerived, modifier, collectAllEffects, applyStatModifiers } from '../../engine/pipeline';
import { levelUp } from '../../engine/leveling';
import { spendHitDie, discardHitDie } from '../../engine/rest';
import { rollD20, rollExpression } from '../../engine/dice';
import { ALL_PROGRESSIONS } from '../../content/classes/index';
import { globalContentDB } from '../../content/classes/library';
import { AsiFeatPicker } from '../AsiFeatPicker';
import { AuditModal } from './AuditModal';
import { HpModal } from './HpModal';
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

// Death saves are session-local state — not persisted to entity.notes.
// They reset when HP drops to 0 (start of dying) or rises above 0 (revived/stabilised).

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  entity:       Entity;
  rules:        CampaignRules;
  isDm:         boolean;
  campaignId:   string;
  deviceId:     string;
  onDamage:     (amount: number) => void;
  onHeal:       (amount: number) => void;
  onAddCondition:    (id: string) => void;
  onRemoveCondition: (id: string) => void;
  onResourceChange:  (resourceId: string, delta: number) => void;
  onSpendSlot:       (tier: string) => void;
  onRestoreSlot:     (tier: string) => void;
  onEntityUpdate:    (updated: Entity) => void;
}

const KNOWN_CONDITIONS = [
  'blinded','charmed','deafened','exhaustion','frightened',
  'grappled','incapacitated','invisible','paralyzed','petrified',
  'poisoned','prone','restrained','stunned','unconscious',
];

// ── Concentration Check Modal ─────────────────────────────────────────────────

function ConcentrationModal({
  visible, dc, conMod, entity, rules,
  onResolve, onClose,
}: {
  visible: boolean;
  dc: number;
  conMod: number;
  entity: Entity;
  rules: CampaignRules;
  onResolve: (updated: Entity) => void;
  onClose: () => void;
}) {
  const [roll, setRoll] = useState<number | null>(null);
  const spellName = entity.spellcasting?.concentrating ?? 'spell';

  function handleRoll() {
    const result = rollD20(conMod).total;
    setRoll(result);
    if (result < dc) {
      // Fail — drop concentration
      const updated = recomputeDerived(dropConcentration(entity), rules);
      onResolve(updated);
    } else {
      onResolve(entity);
    }
  }

  const passed = roll !== null ? roll >= dc : null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.concSheet} onPress={e => e.stopPropagation()}>
          <Text style={styles.concTitle}>🧠 Concentration Check</Text>
          <Text style={styles.concSpell}>Concentrating on: {spellName}</Text>
          <Text style={styles.concDc}>DC {dc} Constitution save</Text>

          {roll === null ? (
            <Pressable style={styles.rollBtn} onPress={handleRoll}>
              <Text style={styles.rollBtnTxt}>🎲 Roll CON Save (+{conMod})</Text>
            </Pressable>
          ) : (
            <View style={[styles.concResult, passed ? styles.concPass : styles.concFail]}>
              <Text style={styles.concResultNum}>{roll}</Text>
              <Text style={styles.concResultLabel}>
                {passed ? '✅ Pass — Concentration kept' : '❌ Fail — Concentration dropped'}
              </Text>
            </View>
          )}

          <Pressable style={styles.closeBtnSm} onPress={onClose}>
            <Text style={styles.closeBtnSmTxt}>Done</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

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

  function revive() {
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
    if (next >= 3) { revive(); showResult('Stable — 1 HP'); }
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
      revive();
    } else if (result === 1) {
      const next = Math.min(3, saves.failures + 2);
      onSavesChange({ ...saves, failures: next });
      showResult(next >= 3 ? '1 — Dead' : `1 — Two failures! (${next}/3)`);
    } else if (result >= 10) {
      const next = Math.min(3, saves.successes + 1);
      if (next >= 3) { revive(); showResult('Stable — 1 HP'); }
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
  const classId     = entity.identity.classId;
  const progression = ALL_PROGRESSIONS[classId];
  const maxLevel    = rules.maxLevel ?? 20;

  if (!progression) return null;
  if (entity.identity.level >= maxLevel) return null;

  const nextLevel = entity.identity.level + 1;

  function doLevelUp() {
    const updated = levelUp(entity, nextLevel, progression!, rules);
    onEntityUpdate(updated);
    onLeveled(updated);
  }

  return (
    <Pressable style={styles.levelUpBtn} onPress={doLevelUp}>
      <Text style={styles.levelUpBtnTxt}>⬆ Level Up (→ {nextLevel})</Text>
    </Pressable>
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
        <Pressable style={styles.concSheet} onPress={e => e.stopPropagation()}>
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

// ── Weapon attack helper ──────────────────────────────────────────────────────

type WeaponInfo = {
  itemId: string;
  name: string;
  attackBonus: number;
  damage: string;
  isRanged: boolean;
};

/** Builds attack/damage info for each equipped weapon. */
function getEquippedWeapons(entity: Entity, profBonus: number): WeaponInfo[] {
  const effectiveStats = applyStatModifiers(entity.stats, collectAllEffects(entity));
  const strMod = modifier(effectiveStats.str);
  const dexMod = modifier(effectiveStats.dex);
  const result: WeaponInfo[] = [];

  for (const inst of entity.inventory.equipped) {
    const def = globalContentDB.items.find(i => i.id === inst.itemId);
    if (!def) continue;
    // A weapon is any item whose feature carries a 'damage' ability effect.
    let dice: string | null = null;
    let dmgType = '';
    for (const f of def.features) {
      for (const ae of (f.abilityEffects ?? [])) {
        if (ae.type === 'damage') { dice = ae.dice; dmgType = ae.damageType; break; }
      }
      if (dice) break;
    }
    if (!dice) continue;

    const props      = def.properties.map(p => p.toLowerCase());
    const isFinesse  = props.some(p => p.includes('finesse'));
    const isRanged   = props.some(p => p.includes('ammunition'));
    const abMod      = (isFinesse || isRanged) ? Math.max(strMod, dexMod) : strMod;
    const attackBonus = profBonus + abMod;
    const modStr     = abMod >= 0 ? `+${abMod}` : `${abMod}`;

    result.push({
      itemId: inst.itemId,
      name: def.name,
      attackBonus,
      damage: `${dice}${abMod !== 0 ? modStr : ''} ${dmgType}`.trim(),
      isRanged,
    });
  }
  return result;
}

// ── Main component ────────────────────────────────────────────────────────────

export function TabCharacter({
  entity, rules, isDm, campaignId, deviceId,
  onDamage, onHeal, onAddCondition, onRemoveCondition,
  onResourceChange, onSpendSlot, onRestoreSlot, onEntityUpdate,
}: Props) {
  const [hpOpen,     setHpOpen]     = useState(false);
  const [auditStat,  setAuditStat]  = useState<string | null>(null);
  const [auditLabel, setAuditLabel] = useState('');
  const [condModal,  setCondModal]  = useState(false);
  const [condSearch, setCondSearch] = useState('');
  const [concOpen,   setConcOpen]   = useState(false);
  const [concDc,     setConcDc]     = useState(10);
  const [manualHpOpen, setManualHpOpen] = useState(false);
  const [maxHpOpen,    setMaxHpOpen]    = useState(false);
  const [tempHpOpen,   setTempHpOpen]   = useState(false);
  const [deathSaves, setDeathSaves] = useState({ successes: 0, failures: 0 });
  const [levelUpAsiOpen, setLevelUpAsiOpen] = useState(false);
  // Inline hit-die result — shown for 3s then cleared, no Alert needed
  const [hitDieResult, setHitDieResult] = useState<string | null>(null);
  const hitDieTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function showHitDieResult(msg: string) {
    setHitDieResult(msg);
    if (hitDieTimer.current) clearTimeout(hitDieTimer.current);
    hitDieTimer.current = setTimeout(() => setHitDieResult(null), 3000);
  }

  const { identity, resources, derived, conditions, spellcasting } = entity;

  // Equipped weapon attack/damage cards
  const weapons = getEquippedWeapons(entity, derived.proficiencyBonus);

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
  const handleDamage = useCallback((amount: number) => {
    onDamage(amount);
    const { characters } = useCharacterStore.getState();
    const fresh = characters.find(c => c.id === entity.id);
    if (fresh?.spellcasting?.concentrating) {
      const dc = Math.max(10, Math.floor(amount / 2));
      setConcDc(dc);
      setConcOpen(true);
    }
  }, [onDamage, entity.id]);

  const hpPct = resources.hp.maximum > 0
    ? Math.max(0, Math.min(1, resources.hp.current / resources.hp.maximum))
    : 0;
  const hpColor = hpPct > 0.5 ? Colors.green : hpPct > 0.25 ? Colors.gold : Colors.red;
  const isDying = resources.hp.current === 0 && resources.hp.maximum > 0;

  const exhaustion = entity.conditionMonitor.exhaustion;
  const conMod     = modifier(entity.stats.con);

  const filteredConds = KNOWN_CONDITIONS.filter(c =>
    c.includes(condSearch.toLowerCase()) &&
    !conditions.some(ac => ac.id === c)
  );

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
          saves={deathSaves}
          onSavesChange={setDeathSaves}
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

      {/* Level Up */}
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

      {/* Hit Dice */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>HIT DICE</Text>
          <Text style={styles.hitDiceCount}>
            {resources.hitDice.remaining}/{resources.hitDice.total}  ·  d{resources.hitDice.die}
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

        {conditions.length === 0 && exhaustion === 0 ? (
          <Text style={styles.emptyNote}>No active conditions</Text>
        ) : (
          <View style={styles.condRow}>
            {conditions.map(c => (
              <View key={c.id} style={styles.condChip}>
                <Text style={styles.condChipTxt}>{c.id}</Text>
                <Pressable onPress={() => onRemoveCondition(c.id)} hitSlop={8}>
                  <Text style={styles.condX}>✕</Text>
                </Pressable>
              </View>
            ))}
          </View>
        )}

        {/* Mechanical effect reminders for active conditions */}
        {conditions.filter(c => CONDITION_WARNINGS[c.id]).map(c => (
          <Text key={`warn-${c.id}`} style={styles.condWarning}>
            ⚠ <Text style={styles.condWarningName}>{c.id}:</Text> {CONDITION_WARNINGS[c.id]}
          </Text>
        ))}
      </View>

      {/* Concentration indicator */}
      {spellcasting?.concentrating && (
        <View style={styles.concIndicator}>
          <Text style={styles.concIndicatorTxt}>
            🧠 Concentrating on: {spellcasting.concentrating}
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
            {SLOT_TIERS.map(tier => {
              const slot = spellcasting.slots[tier];
              if (!slot || slot.total === 0) return null;
              return (
                <View key={tier} style={styles.slotBlock}>
                  <Text style={styles.slotTier}>Lv {tier}</Text>
                  <View style={styles.slotPips}>
                    {Array.from({ length: slot.total }).map((_, i) => (
                      <Pressable
                        key={i}
                        style={[styles.pip2, i < slot.used && styles.pip2Used]}
                        onPress={() => i < slot.used ? onRestoreSlot(tier) : onSpendSlot(tier)}
                      />
                    ))}
                  </View>
                  <Text style={styles.slotCount}>{slot.total - slot.used}/{slot.total}</Text>
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
        dc={concDc}
        conMod={conMod}
        entity={useCharacterStore.getState().characters.find(c => c.id === entity.id) ?? entity}
        rules={rules}
        onResolve={updated => { onEntityUpdate(updated); setConcOpen(false); }}
        onClose={() => setConcOpen(false)}
      />

      {/* Condition Picker Modal */}
      <Modal visible={condModal} transparent animationType="slide" onRequestClose={() => setCondModal(false)}>
        <Pressable style={styles.backdrop} onPress={() => setCondModal(false)}>
          <Pressable style={styles.condPickerSheet} onPress={e => e.stopPropagation()}>
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
                <Pressable key={c} style={styles.condPickerItem} onPress={() => {
                  onAddCondition(c);
                  setCondModal(false);
                  setCondSearch('');
                }}>
                  <Text style={styles.condPickerItemTxt}>{c}</Text>
                </Pressable>
              ))}
              {filteredConds.length === 0 && (
                <Text style={styles.emptyNote}>No conditions found</Text>
              )}
            </ScrollView>
            <Pressable style={styles.cancelBtn} onPress={() => setCondModal(false)}>
              <Text style={styles.cancelTxt}>Cancel</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

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
              />
            );
          })()}
        </View>
      </Modal>

    </ScrollView>
  );
}

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

  section: {
    backgroundColor: Colors.surface, borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.border,
    padding: Spacing.md, gap: Spacing.sm,
  },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
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

  // Concentration modal
  backdrop:   { flex: 1, backgroundColor: '#000000bb', justifyContent: 'center', padding: Spacing.lg },
  concSheet: {
    backgroundColor: Colors.surfaceHigh, borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.blue + '44',
    padding: Spacing.lg, gap: Spacing.sm,
  },
  concTitle:        { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.blue, textAlign: 'center' },
  concSpell:        { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center' },
  concDc:           { fontSize: FontSize.md, color: Colors.textPrimary, textAlign: 'center', fontWeight: FontWeight.bold },
  rollBtn:          { backgroundColor: Colors.blue, borderRadius: Radius.md, padding: Spacing.md, alignItems: 'center' },
  rollBtnTxt:       { color: Colors.white, fontWeight: FontWeight.bold, fontSize: FontSize.md },
  concResult:       { borderRadius: Radius.md, padding: Spacing.md, alignItems: 'center', gap: Spacing.xs },
  concPass:         { backgroundColor: Colors.green + '22', borderWidth: 1, borderColor: Colors.green + '66' },
  concFail:         { backgroundColor: Colors.red   + '22', borderWidth: 1, borderColor: Colors.red   + '66' },
  concResultNum:    { fontSize: 40, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  concResultLabel:  { fontSize: FontSize.md, color: Colors.textPrimary, textAlign: 'center' },
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
