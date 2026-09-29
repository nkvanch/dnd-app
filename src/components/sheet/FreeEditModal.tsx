// src/components/sheet/FreeEditModal.tsx
// Free-Edit mode — character-owned editing and overrides, available when permissions allow. The
// character. Character overrides are canonical entity state and apply before
// campaign/DM overrides. Other explicit base/resource editors remain direct.

import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Modal, View, Text, Pressable, TextInput, StyleSheet, ScrollView, Dimensions,
} from 'react-native';
import { Entity, CampaignRules, Ability } from '../../engine/types';
import { activeCharacterOverrides, applyCharacterOverride, removeCharacterOverride } from '../../engine/characterOverride';
import { effectiveAbilityScores, recomputeDerived } from '../../engine/pipeline';
import { reconcileConHp } from '../../engine/leveling';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../../theme';

interface Props {
  visible: boolean;
  entity:  Entity;
  rules:   CampaignRules;
  onApply: (updated: Entity) => void;
  onClose: () => void;
}

const ABILITIES: Ability[] = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
const HIT_DICE   = [6, 8, 10, 12];
const SLOT_TIERS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'] as const;
const SECTION_STAGES = 5;
const STAGE_DELAY_MS = 40;

// PERF-2 (measured, see the render benchmark this replaced): one stepper tap
// used to cost ~27ms of pure JS render on a desktop CPU (the engine math
// itself is ~0.1ms) and destroyed + recreated 2-3 native text inputs. Causes:
//   1. `key={String(value)}` on the input remounted a native EditText on
//      every value change (Android view creation is expensive).
//   2. Nothing was memoized and every handler was a fresh inline closure, so
//      all ~34 rows re-rendered on every tap.
//   3. Native fires BOTH onEndEditing and onBlur for one typed edit, and both
//      committed, so every typed edit ran the whole apply pipeline twice.
// CommitInput keeps its own text state (no remount, no key), commits on
// blur/submit, and skips a commit that equals what was just sent.
const CommitInput = memo(function CommitInput({
  value, onCommit,
}: { value: number; onCommit: (n: number) => void }) {
  const [text, setText] = useState(String(value));
  const [seenValue, setSeenValue] = useState(value);
  const textRef = useRef(text);
  const valueRef = useRef(value);
  const lastSent = useRef<number | null>(null);
  valueRef.current = value;

  // Re-sync the text when the real value changes. Done during render (React's
  // "derive state from props" pattern) rather than in an effect, so it lands
  // in the same commit instead of triggering a second one per tap.
  if (seenValue !== value) {
    setSeenValue(value);
    setText(String(value));
    textRef.current = String(value);
    lastSent.current = null;
  }

  function change(t: string) { textRef.current = t; setText(t); }

  function commit() {
    const n = parseInt(textRef.current, 10);
    if (isNaN(n) || n === valueRef.current || n === lastSent.current) {
      // Nothing to apply (bad text, unchanged, or the twin blur/endEditing
      // event for an edit that was already sent) — just normalise the display.
      textRef.current = String(valueRef.current);
      setText(textRef.current);
      return;
    }
    lastSent.current = n;
    onCommit(n);
    // If the parent clamps (e.g. ability max 30) the prop may not change, so
    // the effect above wouldn't run — fall back to showing the real value.
    setText(String(valueRef.current));
  }

  return (
    <TextInput
      style={styles.numInput}
      value={text}
      onChangeText={change}
      keyboardType="numeric"
      multiline={false}
      selectTextOnFocus
      onEndEditing={commit}
      onBlur={commit}
    />
  );
});

const NumRow = memo(function NumRow({
  id, label, value, onChange, hint,
}: {
  id: string; label: string; value: number; onChange: (id: string, n: number) => void; hint?: string;
}) {
  const commit = useCallback((n: number) => onChange(id, n), [onChange, id]);
  return (
    <View style={styles.row}>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowLabel}>{label}</Text>
        {hint && <Text style={styles.rowHint}>{hint}</Text>}
      </View>
      <View style={styles.stepper}>
        <Pressable style={styles.stepBtn} onPress={() => onChange(id, value - 1)}>
          <Text style={styles.stepTxt}>−</Text>
        </Pressable>
        <CommitInput value={value} onCommit={commit} />
        <Pressable style={styles.stepBtn} onPress={() => onChange(id, value + 1)}>
          <Text style={styles.stepTxt}>+</Text>
        </Pressable>
      </View>
    </View>
  );
});

export function FreeEditModal({ visible, entity, rules, onApply, onClose }: Props) {
  // Handlers below are deliberately STABLE (useCallback with no deps, reading
  // the latest props through refs) so the memoized rows' props don't change
  // identity every render — otherwise React.memo on the rows does nothing.
  const entityRef = useRef(entity);
  const rulesRef = useRef(rules);
  const onApplyRef = useRef(onApply);
  entityRef.current = entity;
  rulesRef.current = rules;
  onApplyRef.current = onApply;

  // PERF-3: opening used to mount everything in one go — ~295 native views
  // including 34 text inputs (measured) — which blocked the JS/UI threads for
  // a long moment before the sheet showed anything. Now the sheet frame
  // (title + Done) mounts immediately and the sections fill in over a few
  // short ticks, so it opens instantly and stays responsive while loading.
  const [stage, setStage] = useState(0);
  useEffect(() => {
    if (stage >= SECTION_STAGES) return;
    const t = setTimeout(() => setStage(s => s + 1), STAGE_DELAY_MS);
    return () => clearTimeout(t);
  }, [stage]);

  // ── Base-data editors (direct entity mutation) ──────────────────────────────

  const setBaseAbility = useCallback((ab: Ability, n: number) => {
    const entity = entityRef.current;
    const next = { ...entity, stats: { ...entity.stats, [ab]: Math.max(1, Math.min(30, n)) } };
    onApplyRef.current(ab === 'con' ? reconcileConHp(entity, next) : next);
  }, []);

  // Both setters clear `pools` (rather than spreading it through) — a
  // manual override collapses a mixed multiclass hit-dice pool back to one
  // simple die/total/remaining triple, which is the whole point of this
  // screen. Leaving a stale `pools` array around would make `total`/
  // `remaining` (its sum) disagree with what the player just typed here.
  const setHitDieSize = useCallback((size: number) => {
    const entity = entityRef.current;
    onApplyRef.current({
      ...entity,
      resources: { ...entity.resources, hitDice: { ...entity.resources.hitDice, die: size, pools: undefined } },
    });
  }, []);

  const setHitDiceCount = useCallback((count: number) => {
    const entity = entityRef.current;
    const total = Math.max(0, count);
    onApplyRef.current({
      ...entity,
      resources: {
        ...entity.resources,
        hitDice: {
          ...entity.resources.hitDice,
          total,
          remaining: Math.min(entity.resources.hitDice.remaining, total),
          pools: undefined,
        },
      },
    });
  }, []);

  const setBaseAc = useCallback((n: number) => {
    // resources.ac: 0 = no armor (pipeline falls back to 10 + DEX). A manual
    // value here forces a fixed base AC.
    const entity = entityRef.current;
    onApplyRef.current({ ...entity, resources: { ...entity.resources, ac: Math.max(0, n) } });
  }, []);

  const setBaseSpeed = useCallback((n: number) => {
    const entity = entityRef.current;
    onApplyRef.current({ ...entity, resources: { ...entity.resources, speed: Math.max(0, n) } });
  }, []);

  const setSlotTotal = useCallback((tier: string, total: number) => {
    const entity = entityRef.current;
    if (!entity.spellcasting) return;
    const t = tier as keyof typeof entity.spellcasting.slots;
    const cur = entity.spellcasting.slots[t] ?? { total: 0, used: 0 };
    const newTotal = Math.max(0, total);
    onApplyRef.current({
      ...entity,
      spellcasting: {
        ...entity.spellcasting,
        slots: {
          ...entity.spellcasting.slots,
          [t]: { total: newTotal, used: Math.min(cur.used, newTotal) },
        },
      },
    });
  }, []);

  // One stable dispatcher for every NumRow — rows identify themselves by id.
  const handleNum = useCallback((id: string, n: number) => {
    if (id.startsWith('base:')) setBaseAbility(id.slice(5) as Ability, n);
    else if (id.startsWith('slot:')) setSlotTotal(id.slice(5), n);
    else if (id === 'hd_count') setHitDiceCount(n);
    else if (id === 'speed') setBaseSpeed(n);
    else if (id === 'ac') setBaseAc(n);
  }, [setBaseAbility, setSlotTotal, setHitDiceCount, setBaseSpeed, setBaseAc]);

  // ── Character override layer ─────────────────────────────────────────────
  const overrideDerived = useCallback((stat: string, value: number) => {
    onApplyRef.current(applyCharacterOverride(entityRef.current, { stat, value }, rulesRef.current));
  }, []);
  const clearDerived = useCallback((stat: string) => {
    const entity = entityRef.current;
    const active = activeCharacterOverrides(entity).filter(o => o.stat === stat);
    let e = entity;
    for (const o of active) e = removeCharacterOverride(e, o.id, rulesRef.current);
    onApplyRef.current(e);
  }, []);

  // PERF-1: recomputeDerived runs the full effects/stats pipeline — not
  // cheap, and every single row's onApply (every stepper tap, every field
  // commit) both changes `entity` (so memoizing on [entity, rules] alone
  // can't skip these — the whole point is displaying the freshly-changed
  // entity) AND goes through the sheet's own mutate(), which already runs
  // recomputeDerived once. Unconditionally recomputing BOTH
  // calculatedEntity and characterEntity here made every Free Edit action
  // pay for 3 full pipeline passes total, vs. 1 for every other sheet
  // mutation (HP, conditions, etc.) — the actual reason this screen alone
  // felt laggy. characterOverrides are a rarely-used manual-override layer
  // (most edits here are base-stat/resource changes with none active) —
  // when there are none, calculatedEntity (strips both override layers) and
  // characterEntity (strips only dmOverrides) resolve the exact same input,
  // so calculatedEntity can just reuse characterEntity's already-computed
  // result instead of paying for a second identical pipeline pass.
  const freeEditOverrides = activeCharacterOverrides(entity);
  const hasActiveCharacterOverrides = freeEditOverrides.length > 0;
  // Same reasoning one level up: `entity` itself is always already the
  // live, fully-recomputed character (every mutation — including this
  // modal's own onApply calls — routes through the sheet's mutate(), which
  // runs recomputeDerived before this component ever re-renders with the
  // new entity). DM overrides are equally rare here (this modal is
  // solo/prep-only, per this file's own header comment — no DM session in
  // play), so when none are active, stripping dmOverrides is a no-op and
  // `entity` IS characterEntity already — no need to recompute it at all.
  const hasActiveDmOverrides = (entity.dmOverrides ?? []).some(o => o.active);
  const characterEntity = useMemo(
    () => hasActiveDmOverrides ? recomputeDerived({ ...entity, dmOverrides: [] }, rules) : entity,
    [entity, rules, hasActiveDmOverrides],
  );
  const calculatedEntity = useMemo(
    () => hasActiveCharacterOverrides
      ? recomputeDerived({ ...entity, characterOverrides: [], dmOverrides: [] }, rules)
      : characterEntity,
    [entity, rules, hasActiveCharacterOverrides, characterEntity],
  );
  const calculatedScores=effectiveAbilityScores(calculatedEntity),effectiveScores=effectiveAbilityScores(entity);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      {/* SCROLL-TOUCH-1: sheet is a plain View, backdrop a sibling — a Pressable
          ancestor claims touches on non-touchable rows and blocks list drags. */}
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessible={false} />
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>🔓 Free Edit</Text>
            <Text style={styles.subtitle}>Character editing & manual overrides</Text>
          </View>

          <ScrollView style={styles.scrollArea} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

            {/* Ability Scores */}
            {stage >= 1 && (<>
            <Text style={styles.section}>CHARACTER VALUES — BASE</Text>
            {ABILITIES.map(ab=><NumRow key={ab+'-base'} id={'base:'+ab} label={ab.toUpperCase()+' base'} value={entity.stats[ab]} onChange={handleNum} hint="Changes underlying character data" />)}
            </>)}
            {stage >= 2 && (<>
            <Text style={styles.section}>MANUAL OVERRIDES — ABILITIES</Text>
            {ABILITIES.map(ab=><DerivedRow key={ab+'-override'} label={ab.toUpperCase()} calculated={calculatedScores[ab]} characterValue={characterEntity.stats[ab]} current={effectiveScores[ab]} stat={ab} onSet={overrideDerived} onClear={clearDerived} overridden={freeEditOverrides.some(o=>o.stat===ab)} dmValue={(entity.dmOverrides??[]).filter(o=>o.active&&o.stat===ab).at(-1)?.value} />)}
            </>)}

            {stage >= 3 && (<>
            {/* Hit Dice */}
            <Text style={styles.section}>HIT DICE</Text>
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Die size</Text>
              <View style={styles.segmented}>
                {HIT_DICE.map(d => (
                  <Pressable
                    key={d}
                    style={[styles.segBtn, entity.resources.hitDice.die === d && styles.segBtnActive]}
                    onPress={() => setHitDieSize(d)}
                  >
                    <Text style={[styles.segTxt, entity.resources.hitDice.die === d && styles.segTxtActive]}>
                      d{d}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
            <NumRow
              id="hd_count"
              label="Hit dice count"
              value={entity.resources.hitDice.total}
              onChange={handleNum}
              hint={`${entity.resources.hitDice.remaining} remaining`}
            />

            {/* Movement & Defense */}
            <Text style={styles.section}>MOVEMENT & DEFENSE</Text>
            <NumRow id="speed" label="Base speed (ft)" value={entity.resources.speed} onChange={handleNum} hint="Changes underlying character data" />
            <DerivedRow label="Speed override" calculated={calculatedEntity.derived.speed} characterValue={characterEntity.derived.speed} current={entity.derived.speed} stat="speed" onSet={overrideDerived} onClear={clearDerived} overridden={freeEditOverrides.some(o=>o.stat==='speed')} />
            <NumRow
              id="ac"
              label="Base AC"
              value={entity.resources.ac}
              onChange={handleNum}
              hint={entity.resources.ac === 0 ? 'currently 0 = auto (10 + DEX / armor)' : 'fixed base AC'}
            />
            </>)}

            {stage >= 4 && (<>
            {/* Derived display overrides */}
            <Text style={styles.section}>DERIVED (DISPLAY)</Text>
            <DerivedRow
              label="Initiative"
              calculated={calculatedEntity.derived.initiative}
              characterValue={characterEntity.derived.initiative}
              dmValue={(entity.dmOverrides??[]).filter(o=>o.active&&o.stat==='initiative').at(-1)?.value}
              current={entity.derived.initiative}
              stat="initiative"
              onSet={overrideDerived}
              onClear={clearDerived}
              overridden={freeEditOverrides.some(o => o.stat === 'initiative')}
            />
            <DerivedRow
              label="Passive Perception"
              calculated={calculatedEntity.derived.passivePerception}
              characterValue={characterEntity.derived.passivePerception}
              dmValue={(entity.dmOverrides??[]).filter(o=>o.active&&o.stat==='passivePerception').at(-1)?.value}
              current={entity.derived.passivePerception}
              stat="passivePerception"
              onSet={overrideDerived}
              onClear={clearDerived}
              overridden={freeEditOverrides.some(o => o.stat === 'passivePerception')}
            />
            <DerivedRow
              label="AC (final)"
              calculated={calculatedEntity.derived.ac}
              characterValue={characterEntity.derived.ac}
              dmValue={(entity.dmOverrides??[]).filter(o=>o.active&&o.stat==='ac').at(-1)?.value}
              current={entity.derived.ac}
              stat="ac"
              onSet={overrideDerived}
              onClear={clearDerived}
              overridden={freeEditOverrides.some(o => o.stat === 'ac')}
            />


            <Text style={styles.section}>SAVING THROW OVERRIDES</Text>
            {ABILITIES.map(ab=>{const stat='savingThrows.'+ab;return <DerivedRow key={stat} label={ab.toUpperCase()+' save'} calculated={calculatedEntity.derived.savingThrows[ab]} characterValue={characterEntity.derived.savingThrows[ab]} dmValue={(entity.dmOverrides??[]).filter(o=>o.active&&o.stat===stat).at(-1)?.value} current={entity.derived.savingThrows[ab]} stat={stat} onSet={overrideDerived} onClear={clearDerived} overridden={freeEditOverrides.some(o=>o.stat===stat)} />})}
            </>)}

            {/* Spell Slots */}
            {stage >= 5 && entity.spellcasting && (
              <>
                <Text style={styles.section}>SPELL SLOTS (per tier)</Text>
                {SLOT_TIERS.map(t => {
                  const slot = entity.spellcasting!.slots[t];
                  return (
                    <NumRow
                      key={t}
                      id={'slot:' + t}
                      label={`Tier ${t}`}
                      value={slot?.total ?? 0}
                      onChange={handleNum}
                      hint={slot && slot.used > 0 ? `${slot.used} used` : undefined}
                    />
                  );
                })}
              </>
            )}

            {/* Active free-edit overrides summary */}
            {freeEditOverrides.length > 0 && (
              <View style={styles.activeBox}>
                <Text style={styles.activeTitle}>ACTIVE CHARACTER OVERRIDES</Text>
                {freeEditOverrides.map(o => (
                  <View key={o.id} style={styles.activeRow}>
                    <Text style={styles.activeTxt}>{o.stat} = {o.value}</Text>
                    <Pressable onPress={() => clearDerived(o.stat)}>
                      <Text style={styles.clearTxt}>Clear</Text>
                    </Pressable>
                  </View>
                ))}
              </View>
            )}

          </ScrollView>

          <Pressable style={styles.doneBtn} onPress={onClose}>
            <Text style={styles.doneTxt}>Done</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const DerivedRow = memo(function DerivedRow({
  label, calculated, characterValue, dmValue, current, stat, onSet, onClear, overridden,
}: {
  label: string; calculated: number; characterValue: number; dmValue?:number; current: number; stat: string;
  onSet: (stat: string, v: number) => void;
  onClear: (stat: string) => void;
  overridden: boolean;
}) {
  const commit = useCallback((n: number) => onSet(stat, n), [onSet, stat]);
  return (
    <View style={styles.row}>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={styles.rowHint}>Calculated {calculated} · Character {overridden?characterValue:'None'} · DM {dmValue??'None'} · Effective {current}</Text>
      </View>
      <View style={styles.stepper}>
        <CommitInput value={current} onCommit={commit} />
        {overridden && (
          <Pressable style={styles.clearBtn} onPress={() => onClear(stat)}>
            <Text style={styles.clearBtnTxt}>↺</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
});

// FREE-EDIT-SCROLL-1: the sheet used to bound itself with a CSS percentage
// (`maxHeight: '92%'`) and let scrollArea "fill the rest" via `flexShrink: 1`
// alone. `flexShrink: 1` keeps `flexBasis: auto` — the ScrollView's initial
// size comes from its OWN content, and only shrinks to fit in a later pass —
// which on react-native-web left the ScrollView with no real measured
// scrollable height until some other layout event (e.g. focusing a
// TextInput) forced a relayout that resolved it correctly. Swapping to a
// pixel `maxHeight` computed from the window (resolves in one layout pass,
// no dependency on an ancestor's own percentage-of-percentage resolution)
// plus `flex: 1` on the ScrollView (flexBasis: 0 — sized purely from
// available space, not from content first) makes both computable
// immediately on open, so the very first swipe scrolls.
const SHEET_MAX_HEIGHT = Dimensions.get('window').height * 0.92;

// The Done button is the last child of the sheet, so extra bottom padding
// lifts it. 8dp (≈22 physical px on a 450dpi phone) — one constant to tweak.
const DONE_BUTTON_LIFT = 8;

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: '#000000cc', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: Colors.surfaceHigh,
    borderTopLeftRadius: Radius.lg, borderTopRightRadius: Radius.lg,
    padding: Spacing.md, gap: Spacing.sm, paddingBottom: Spacing.xl + DONE_BUTTON_LIFT, height: SHEET_MAX_HEIGHT, maxHeight: SHEET_MAX_HEIGHT,
  },
  header: { alignItems: 'center', gap: 2 },
  title:    { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.gold },
  subtitle: { fontSize: FontSize.xs, color: Colors.textDim },

  scrollArea: { flex: 1, minHeight: 1 },
  scrollContent:{paddingBottom:Spacing.md},

  section: {
    fontSize: FontSize.xs, color: Colors.textSecondary, letterSpacing: 2,
    fontWeight: FontWeight.bold, marginTop: Spacing.md, marginBottom: Spacing.xs,
  },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  rowLabel: { fontSize: FontSize.md, color: Colors.textPrimary, fontWeight: FontWeight.bold },
  rowHint:  { fontSize: FontSize.xs, color: Colors.textDim, marginTop: 1 },

  stepper: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  stepBtn: {
    width: 32, height: 32, borderRadius: Radius.md,
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  stepTxt: { fontSize: FontSize.lg, color: Colors.gold, fontWeight: FontWeight.bold },
  numInput: {
    width: 56, height: 36, borderRadius: Radius.md,
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    color: Colors.textPrimary, fontSize: FontSize.md, textAlign: 'center',
    // Android: TextInput adds default vertical padding + font padding which
    // pushes the text up and makes the fixed-height box internally scrollable.
    paddingVertical: 0,
    paddingHorizontal: 0,
    textAlignVertical: 'center',
    includeFontPadding: false,
  },

  segmented: { flexDirection: 'row', gap: 4 },
  segBtn: {
    paddingHorizontal: Spacing.sm, paddingVertical: 6, borderRadius: Radius.md,
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
  },
  segBtnActive: { backgroundColor: Colors.gold + '33', borderColor: Colors.gold },
  segTxt:       { fontSize: FontSize.sm, color: Colors.textSecondary },
  segTxtActive: { color: Colors.gold, fontWeight: FontWeight.bold },

  clearBtn: {
    width: 32, height: 32, borderRadius: Radius.md,
    backgroundColor: Colors.red + '22', borderWidth: 1, borderColor: Colors.red + '44',
    alignItems: 'center', justifyContent: 'center',
  },
  clearBtnTxt: { color: Colors.red, fontSize: FontSize.md },

  activeBox: {
    backgroundColor: Colors.surface, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border, padding: Spacing.sm,
    gap: Spacing.xs, marginTop: Spacing.md,
  },
  activeTitle: { fontSize: FontSize.xs, color: Colors.textDim, letterSpacing: 2 },
  activeRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  activeTxt:   { fontSize: FontSize.sm, color: Colors.textPrimary },
  clearTxt:    { fontSize: FontSize.xs, color: Colors.red, fontWeight: FontWeight.bold },

  doneBtn: {
    backgroundColor: Colors.gold, borderRadius: Radius.md,
    padding: Spacing.md, alignItems: 'center', marginTop: Spacing.sm,
  },
  doneTxt: { color: Colors.bg, fontWeight: FontWeight.bold, fontSize: FontSize.md },
});
