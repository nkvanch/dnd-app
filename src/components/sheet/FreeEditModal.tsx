// src/components/sheet/FreeEditModal.tsx
// Free-Edit mode — character-owned editing and overrides, available when permissions allow. The
// character. Character overrides are canonical entity state and apply before
// campaign/DM overrides. Other explicit base/resource editors remain direct.

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

function NumRow({
  label, value, onChange, hint,
}: {
  label: string; value: number; onChange: (n: number) => void; hint?: string;
}) {
  return (
    <View style={styles.row}>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowLabel}>{label}</Text>
        {hint && <Text style={styles.rowHint}>{hint}</Text>}
      </View>
      <View style={styles.stepper}>
        <Pressable style={styles.stepBtn} onPress={() => onChange(value - 1)}>
          <Text style={styles.stepTxt}>−</Text>
        </Pressable>
        <TextInput
          style={styles.numInput}
          defaultValue={String(value)}
          key={String(value)}
          keyboardType="numeric"
          multiline={false}
          onEndEditing={e => {
            const n = parseInt(e.nativeEvent.text, 10);
            if (!isNaN(n)) onChange(n);
          }}
          onBlur={e => {
            // react-native-web doesn't fire onEndEditing on blur (only native
            // does) — onBlur is the one that actually reaches us there, so
            // both are wired to commit. onBlur's nativeEvent carries no text,
            // so read the live DOM value directly.
            const raw = (e.target as unknown as { value?: string })?.value;
            const n = raw !== undefined ? parseInt(raw, 10) : NaN;
            if (!isNaN(n)) onChange(n);
          }}
        />
        <Pressable style={styles.stepBtn} onPress={() => onChange(value + 1)}>
          <Text style={styles.stepTxt}>+</Text>
        </Pressable>
      </View>
    </View>
  );
}

export function FreeEditModal({ visible, entity, rules, onApply, onClose }: Props) {
  // ── Base-data editors (direct entity mutation) ──────────────────────────────

  function setBaseAbility(ab:Ability,n:number){const next={...entity,stats:{...entity.stats,[ab]:Math.max(1,Math.min(30,n))}};onApply(ab==='con'?reconcileConHp(entity,next):next);}

  // Both setters clear `pools` (rather than spreading it through) — a
  // manual override collapses a mixed multiclass hit-dice pool back to one
  // simple die/total/remaining triple, which is the whole point of this
  // screen. Leaving a stale `pools` array around would make `total`/
  // `remaining` (its sum) disagree with what the player just typed here.
  function setHitDieSize(size: number) {
    onApply({
      ...entity,
      resources: { ...entity.resources, hitDice: { ...entity.resources.hitDice, die: size, pools: undefined } },
    });
  }

  function setHitDiceCount(count: number) {
    const total = Math.max(0, count);
    onApply({
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
  }

  function setBaseAc(n: number) {
    // resources.ac: 0 = no armor (pipeline falls back to 10 + DEX). A manual
    // value here forces a fixed base AC.
    onApply({ ...entity, resources: { ...entity.resources, ac: Math.max(0, n) } });
  }

  function setSlotTotal(tier: string, total: number) {
    if (!entity.spellcasting) return;
    const t = tier as keyof typeof entity.spellcasting.slots;
    const cur = entity.spellcasting.slots[t] ?? { total: 0, used: 0 };
    const newTotal = Math.max(0, total);
    onApply({
      ...entity,
      spellcasting: {
        ...entity.spellcasting,
        slots: {
          ...entity.spellcasting.slots,
          [t]: { total: newTotal, used: Math.min(cur.used, newTotal) },
        },
      },
    });
  }

  // ── Character override layer ─────────────────────────────────────────────
  function overrideDerived(stat: string, value: number) { onApply(applyCharacterOverride(entity,{stat,value},rules)); }
  function clearDerived(stat: string) {
    const active=activeCharacterOverrides(entity).filter(o=>o.stat===stat); let e=entity;
    for(const o of active)e=removeCharacterOverride(e,o.id,rules); onApply(e);
  }

  const freeEditOverrides = activeCharacterOverrides(entity);
  const calculatedEntity=recomputeDerived({...entity,characterOverrides:[],dmOverrides:[]},rules);
  const characterEntity=recomputeDerived({...entity,dmOverrides:[]},rules);
  const calculatedScores=effectiveAbilityScores(calculatedEntity),effectiveScores=effectiveAbilityScores(entity);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={e => e.stopPropagation()}>
          <View style={styles.header}>
            <Text style={styles.title}>🔓 Free Edit</Text>
            <Text style={styles.subtitle}>Character editing & manual overrides</Text>
          </View>

          <ScrollView style={styles.scrollArea} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

            {/* Ability Scores */}
            <Text style={styles.section}>CHARACTER VALUES — BASE</Text>
            {ABILITIES.map(ab=><NumRow key={ab+'-base'} label={ab.toUpperCase()+' base'} value={entity.stats[ab]} onChange={n=>setBaseAbility(ab,n)} hint="Changes underlying character data" />)}
            <Text style={styles.section}>MANUAL OVERRIDES — ABILITIES</Text>
            {ABILITIES.map(ab=><DerivedRow key={ab+'-override'} label={ab.toUpperCase()} calculated={calculatedScores[ab]} characterValue={characterEntity.stats[ab]} current={effectiveScores[ab]} stat={ab} onSet={overrideDerived} onClear={clearDerived} overridden={freeEditOverrides.some(o=>o.stat===ab)} dmValue={(entity.dmOverrides??[]).filter(o=>o.active&&o.stat===ab).at(-1)?.value} />)}

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
              label="Hit dice count"
              value={entity.resources.hitDice.total}
              onChange={setHitDiceCount}
              hint={`${entity.resources.hitDice.remaining} remaining`}
            />

            {/* Movement & Defense */}
            <Text style={styles.section}>MOVEMENT & DEFENSE</Text>
            <NumRow label="Base speed (ft)" value={entity.resources.speed} onChange={n=>onApply({...entity,resources:{...entity.resources,speed:Math.max(0,n)}})} hint="Changes underlying character data" />
            <DerivedRow label="Speed override" calculated={calculatedEntity.derived.speed} characterValue={characterEntity.derived.speed} current={entity.derived.speed} stat="speed" onSet={overrideDerived} onClear={clearDerived} overridden={freeEditOverrides.some(o=>o.stat==='speed')} />
            <NumRow
              label="Base AC"
              value={entity.resources.ac}
              onChange={setBaseAc}
              hint={entity.resources.ac === 0 ? 'currently 0 = auto (10 + DEX / armor)' : 'fixed base AC'}
            />

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

            {/* Spell Slots */}
            {entity.spellcasting && (
              <>
                <Text style={styles.section}>SPELL SLOTS (per tier)</Text>
                {SLOT_TIERS.map(t => {
                  const slot = entity.spellcasting!.slots[t];
                  return (
                    <NumRow
                      key={t}
                      label={`Tier ${t}`}
                      value={slot?.total ?? 0}
                      onChange={n => setSlotTotal(t, n)}
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
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function DerivedRow({
  label, calculated, characterValue, dmValue, current, stat, onSet, onClear, overridden,
}: {
  label: string; calculated: number; characterValue: number; dmValue?:number; current: number; stat: string;
  onSet: (stat: string, v: number) => void;
  onClear: (stat: string) => void;
  overridden: boolean;
}) {
  return (
    <View style={styles.row}>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={styles.rowHint}>Calculated {calculated} · Character {overridden?characterValue:'None'} · DM {dmValue??'None'} · Effective {current}</Text>
      </View>
      <View style={styles.stepper}>
        <TextInput
          style={styles.numInput}
          defaultValue={String(current)}
          key={String(current)}
          keyboardType="numeric"
          multiline={false}
          onEndEditing={e => {
            const n = parseInt(e.nativeEvent.text, 10);
            if (!isNaN(n)) onSet(stat, n);
          }}
          onBlur={e => {
            // See NumRow above — onEndEditing doesn't fire on react-native-web.
            const raw = (e.target as unknown as { value?: string })?.value;
            const n = raw !== undefined ? parseInt(raw, 10) : NaN;
            if (!isNaN(n)) onSet(stat, n);
          }}
        />
        {overridden && (
          <Pressable style={styles.clearBtn} onPress={() => onClear(stat)}>
            <Text style={styles.clearBtnTxt}>↺</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

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

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: '#000000cc', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: Colors.surfaceHigh,
    borderTopLeftRadius: Radius.lg, borderTopRightRadius: Radius.lg,
    padding: Spacing.md, gap: Spacing.sm, paddingBottom: Spacing.xl, height: SHEET_MAX_HEIGHT, maxHeight: SHEET_MAX_HEIGHT,
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
