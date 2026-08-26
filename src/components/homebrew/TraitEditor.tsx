// src/components/homebrew/TraitEditor.tsx
// Shared "trait/feature effect" authoring UI — originally built inside
// app/homebrew/race-builder.tsx for racial traits, extracted so class-builder,
// subrace-builder, and subclass-builder can all author real mechanical effects
// (ability score bonus, skill/tool proficiency, advantage/disadvantage, sense,
// movement, limited-use resource ability) instead of flavor-text-only fields.
// The actual compilation logic (buildTraitFeature, buildSubrace, etc.) lives
// in src/content/traitCompiler.ts — a plain-TS module with zero React/RN
// imports, so src/content/classes/progressions.ts (the class progression
// compiler) can use it without pulling UI code into the content layer. This
// file re-exports that logic alongside the React components that edit it.
import { useState } from 'react';
import {
  View, Text, ScrollView, Pressable, StyleSheet, TextInput, Modal,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { DraftTrait, TraitEffectKind, Ability } from '../../engine/types';
import {
  ABILITIES, SENSE_TYPES, MOVE_TYPES, SKILLS, ACTION_TYPES, RECHARGE_TYPES,
  toId, newDraftTrait, buildTraitFeature, newDraftSubrace, buildSubrace,
} from '../../content/traitCompiler';
import type { MoveType, DraftSubrace } from '../../content/traitCompiler';
import { SafeBottomView } from '../SafeBottomView';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../../theme';

export {
  ABILITIES, SENSE_TYPES, MOVE_TYPES, SKILLS, ACTION_TYPES, RECHARGE_TYPES,
  toId, newDraftTrait, buildTraitFeature, newDraftSubrace, buildSubrace,
};
export type { MoveType, DraftSubrace };

// ── Reusable: ability score grid ──────────────────────────────────────────────

export function AbilityScoreGrid({ values, onChange }: {
  values: Record<Ability, string>;
  onChange: (a: Ability, v: string) => void;
}) {
  return (
    <View style={styles.abiGrid}>
      {ABILITIES.map(a => (
        <View key={a} style={styles.abiBox}>
          <Text style={styles.abiLabel}>{a.toUpperCase()}</Text>
          <TextInput
            style={styles.abiInput}
            value={values[a]}
            onChangeText={v => onChange(a, v)}
            keyboardType="numbers-and-punctuation"
            placeholder="0"
            placeholderTextColor={Colors.textDim}
            textAlign="center"
          />
        </View>
      ))}
    </View>
  );
}

// ── Trait editor modal — the "droppable window" ───────────────────────────────

export function TraitEditorModal({ trait, visible, onChange, onDone, onDelete }: {
  trait: DraftTrait | null;
  visible: boolean;
  onChange: (t: DraftTrait) => void;
  onDone: () => void;
  onDelete: () => void;
}) {
  if (!trait) return null;
  const set = (patch: Partial<DraftTrait>) => onChange({ ...trait, ...patch });

  const EFFECT_KINDS: { key: TraitEffectKind; label: string }[] = [
    { key: 'none', label: 'Flavor only' },
    { key: 'ability_score', label: 'Ability score bonus' },
    { key: 'skill_proficiency', label: 'Skill proficiency' },
    { key: 'tool_proficiency', label: 'Tool/kit proficiency' },
    { key: 'advantage_disadvantage', label: 'Advantage/Disadvantage' },
    { key: 'sense', label: 'Grants a sense' },
    { key: 'movement', label: 'Grants movement' },
    { key: 'resource_ability', label: 'Limited-use ability' },
  ];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onDone}>
      <Pressable style={styles.backdrop} onPress={onDone}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ width: '100%' }}>
        <Pressable style={styles.traitModalSheet} onPress={e => e.stopPropagation()}>
          <ScrollView keyboardShouldPersistTaps="handled">
            <Text style={styles.traitModalTitle}>{trait.name}</Text>

            <Text style={styles.fieldLabel}>Description (optional)</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={trait.description}
              onChangeText={v => set({ description: v })}
              placeholder="What this trait does, in your own words…"
              placeholderTextColor={Colors.textDim}
              multiline textAlignVertical="top"
            />

            <Text style={styles.fieldLabel}>Mechanical effect</Text>
            <View style={styles.chipWrap}>
              {EFFECT_KINDS.map(k => (
                <Pressable
                  key={k.key}
                  style={[styles.chip, trait.effectKind === k.key && styles.chipActive]}
                  onPress={() => set({ effectKind: k.key })}
                >
                  <Text style={[styles.chipTxt, trait.effectKind === k.key && styles.chipTxtActive]}>{k.label}</Text>
                </Pressable>
              ))}
            </View>

            {trait.effectKind === 'ability_score' && (
              <View style={styles.effectPanel}>
                <View style={styles.chipWrap}>
                  {ABILITIES.map(a => (
                    <Pressable key={a} style={[styles.chip, trait.abilityTarget === a && styles.chipActive]}
                      onPress={() => set({ abilityTarget: a })}>
                      <Text style={[styles.chipTxt, trait.abilityTarget === a && styles.chipTxtActive]}>{a.toUpperCase()}</Text>
                    </Pressable>
                  ))}
                </View>
                <View style={styles.rowInline}>
                  <Text style={styles.inlineLabel}>Bonus:</Text>
                  <TextInput style={[styles.input, styles.smallInput]} value={trait.abilityAmount}
                    onChangeText={v => set({ abilityAmount: v })} keyboardType="numbers-and-punctuation" />
                </View>
              </View>
            )}

            {trait.effectKind === 'skill_proficiency' && (
              <View style={styles.effectPanel}>
                <View style={styles.chipWrap}>
                  {SKILLS.map(s => (
                    <Pressable key={s.id} style={[styles.chip, trait.skillTarget === s.id && styles.chipActive]}
                      onPress={() => set({ skillTarget: s.id })}>
                      <Text style={[styles.chipTxt, trait.skillTarget === s.id && styles.chipTxtActive]}>{s.label}</Text>
                    </Pressable>
                  ))}
                </View>
                <Pressable style={styles.toggleRow} onPress={() => set({ skillExpertise: !trait.skillExpertise })}>
                  <View style={[styles.checkbox, trait.skillExpertise && styles.checkboxChecked]} />
                  <Text style={styles.toggleTxt}>Double proficiency (expertise) instead of normal</Text>
                </Pressable>
                <Text style={styles.effectNote}>
                  Grants proficiency (or expertise) in this skill generally -- the engine can't
                  enforce a narrower condition like "only for checks about dragons," so a
                  trait like that is proficiency in the skill plus a flavor note in the
                  description explaining the narrative reason.
                </Text>
              </View>
            )}

            {trait.effectKind === 'tool_proficiency' && (
              <View style={styles.effectPanel}>
                <Text style={styles.inlineLabel}>Tool or kit name</Text>
                <TextInput style={styles.input} value={trait.toolName}
                  onChangeText={v => set({ toolName: v })}
                  placeholder="e.g. Thieves' Tools, Alchemist's Supplies"
                  placeholderTextColor={Colors.textDim} />
              </View>
            )}

            {trait.effectKind === 'advantage_disadvantage' && (
              <View style={styles.effectPanel}>
                <View style={styles.chipWrap}>
                  <Pressable style={[styles.chip, trait.advDirection === 'advantage' && styles.chipActive]}
                    onPress={() => set({ advDirection: 'advantage' })}>
                    <Text style={[styles.chipTxt, trait.advDirection === 'advantage' && styles.chipTxtActive]}>Advantage</Text>
                  </Pressable>
                  <Pressable style={[styles.chip, trait.advDirection === 'disadvantage' && styles.chipActive]}
                    onPress={() => set({ advDirection: 'disadvantage' })}>
                    <Text style={[styles.chipTxt, trait.advDirection === 'disadvantage' && styles.chipTxtActive]}>Disadvantage</Text>
                  </Pressable>
                </View>
                <Text style={styles.inlineLabel}>Applies to</Text>
                <TextInput style={styles.input} value={trait.advTarget}
                  onChangeText={v => set({ advTarget: v })}
                  placeholder="e.g. Wisdom saving throws against being frightened"
                  placeholderTextColor={Colors.textDim} />
                <Text style={styles.effectNote}>
                  Shown to the player as a reminder wherever the character's saves/checks
                  appear — like every other roll in this app, dice aren't auto-rolled, so
                  this doesn't change the roll button itself, just makes sure you don't
                  forget to roll 2d20 and take the {trait.advDirection === 'advantage' ? 'higher' : 'lower'}.
                </Text>
              </View>
            )}

            {trait.effectKind === 'sense' && (
              <View style={styles.effectPanel}>
                <View style={styles.chipWrap}>
                  {SENSE_TYPES.map(s => (
                    <Pressable key={s.key} style={[styles.chip, trait.senseType === s.key && styles.chipActive]}
                      onPress={() => set({ senseType: s.key })}>
                      <Text style={[styles.chipTxt, trait.senseType === s.key && styles.chipTxtActive]}>{s.label}</Text>
                    </Pressable>
                  ))}
                </View>
                <View style={styles.rowInline}>
                  <Text style={styles.inlineLabel}>Range (ft):</Text>
                  <TextInput style={[styles.input, styles.smallInput]} value={trait.senseRange}
                    onChangeText={v => set({ senseRange: v })} keyboardType="number-pad" />
                </View>
              </View>
            )}

            {trait.effectKind === 'movement' && (
              <View style={styles.effectPanel}>
                <View style={styles.chipWrap}>
                  {MOVE_TYPES.map(m => (
                    <Pressable key={m.key} style={[styles.chip, trait.moveType === m.key && styles.chipActive]}
                      onPress={() => set({ moveType: m.key })}>
                      <Text style={[styles.chipTxt, trait.moveType === m.key && styles.chipTxtActive]}>{m.label}</Text>
                    </Pressable>
                  ))}
                </View>
                <View style={styles.rowInline}>
                  <Text style={styles.inlineLabel}>Speed (ft):</Text>
                  <TextInput style={[styles.input, styles.smallInput]} value={trait.moveRange}
                    onChangeText={v => set({ moveRange: v })} keyboardType="number-pad" />
                </View>
              </View>
            )}

            {trait.effectKind === 'resource_ability' && (
              <View style={styles.effectPanel}>
                <Text style={styles.inlineLabel}>Action type</Text>
                <View style={styles.chipWrap}>
                  {ACTION_TYPES.map(a => (
                    <Pressable key={a.key} style={[styles.chip, trait.actionType === a.key && styles.chipActive]}
                      onPress={() => set({ actionType: a.key })}>
                      <Text style={[styles.chipTxt, trait.actionType === a.key && styles.chipTxtActive]}>{a.label}</Text>
                    </Pressable>
                  ))}
                </View>
                <Text style={styles.inlineLabel}>Recharges on</Text>
                <View style={styles.chipWrap}>
                  {RECHARGE_TYPES.map(r => (
                    <Pressable key={r.key} style={[styles.chip, trait.recharge === r.key && styles.chipActive]}
                      onPress={() => set({ recharge: r.key })}>
                      <Text style={[styles.chipTxt, trait.recharge === r.key && styles.chipTxtActive]}>{r.label}</Text>
                    </Pressable>
                  ))}
                </View>
                <View style={styles.rowInline}>
                  <Text style={styles.inlineLabel}>Uses per recharge:</Text>
                  <TextInput style={[styles.input, styles.smallInput]} value={trait.uses}
                    onChangeText={v => set({ uses: v })} keyboardType="number-pad" />
                </View>
                <View style={styles.rowInline}>
                  <Text style={styles.inlineLabel}>Heals (dice, optional):</Text>
                  <TextInput style={[styles.input, styles.smallInput]} value={trait.healDice}
                    onChangeText={v => set({ healDice: v })} placeholder="e.g. 1d8" placeholderTextColor={Colors.textDim} />
                </View>
                <Text style={styles.effectNote}>
                  Uses a dedicated limited-use pool (like Chi Pulse's "1/rest") rather
                  than literally spending a hit die -- the engine doesn't have a generic
                  way for a racial trait to tie into the hit-dice pool specifically, so
                  this is a disclosed simplification, not a hidden one.
                </Text>
              </View>
            )}

            <SafeBottomView>
              <View style={styles.traitModalBtnRow}>
                <Pressable style={styles.traitDeleteBtn} onPress={onDelete}>
                  <Text style={styles.traitDeleteTxt}>Delete Trait</Text>
                </Pressable>
                <Pressable style={styles.traitDoneBtn} onPress={onDone}>
                  <Text style={styles.traitDoneTxt}>Done</Text>
                </Pressable>
              </View>
            </SafeBottomView>
          </ScrollView>
        </Pressable>
        </KeyboardAvoidingView>
      </Pressable>
    </Modal>
  );
}

// ── Trait list + add-by-name flow ─────────────────────────────────────────────

export function TraitListEditor({ traits, onChange }: {
  traits: DraftTrait[];
  onChange: (traits: DraftTrait[]) => void;
}) {
  const [newName, setNewName] = useState('');
  const [openTraitId, setOpenTraitId] = useState<string | null>(null);

  function addTrait() {
    const name = newName.trim();
    if (!name) return;
    const t = newDraftTrait(name);
    onChange([...traits, t]);
    setNewName('');
    setOpenTraitId(t.localId); // auto-open the editor — "description page should pop out"
  }

  function updateTrait(t: DraftTrait) {
    onChange(traits.map(x => x.localId === t.localId ? t : x));
  }
  function deleteTrait(localId: string) {
    onChange(traits.filter(x => x.localId !== localId));
    setOpenTraitId(null);
  }

  const openTrait = traits.find(t => t.localId === openTraitId) ?? null;

  return (
    <View style={{ gap: Spacing.xs }}>
      {traits.map(t => (
        <Pressable key={t.localId} style={styles.traitCard} onPress={() => setOpenTraitId(t.localId)}>
          <View style={{ flex: 1 }}>
            <Text style={styles.traitCardName}>{t.name}</Text>
            <Text style={styles.traitCardMeta}>
              {t.effectKind === 'none' ? 'Flavor only' :
               t.effectKind === 'ability_score' ? `+${t.abilityAmount || 0} ${t.abilityTarget.toUpperCase()}` :
               t.effectKind === 'skill_proficiency' ? `${t.skillExpertise ? 'Expertise' : 'Proficiency'}: ${t.skillTarget}` :
               t.effectKind === 'tool_proficiency' ? `Proficiency: ${t.toolName || '(unnamed tool)'}` :
               t.effectKind === 'advantage_disadvantage' ? `${t.advDirection === 'advantage' ? 'Advantage' : 'Disadvantage'}: ${t.advTarget || '(unspecified)'}` :
               t.effectKind === 'sense' ? `${t.senseType} ${t.senseRange}ft` :
               t.effectKind === 'movement' ? `${t.moveType} ${t.moveRange}ft` :
               `${t.uses}/${t.recharge === 'short_rest' ? 'short rest' : 'long rest'}`}
            </Text>
          </View>
          <Text style={styles.traitCardCaret}>{'>'}</Text>
        </Pressable>
      ))}
      <View style={styles.senseInputRow}>
        <TextInput
          style={[styles.input, { flex: 1 }]}
          value={newName}
          onChangeText={setNewName}
          placeholder="Trait name (e.g. Steady Gait)"
          placeholderTextColor={Colors.textDim}
          onSubmitEditing={addTrait}
        />
        <Pressable style={styles.senseAddBtn} onPress={addTrait}>
          <Text style={styles.senseAddTxt}>Add</Text>
        </Pressable>
      </View>

      <TraitEditorModal
        trait={openTrait}
        visible={!!openTrait}
        onChange={updateTrait}
        onDone={() => setOpenTraitId(null)}
        onDelete={() => openTrait && deleteTrait(openTrait.localId)}
      />
    </View>
  );
}

export const styles = StyleSheet.create({
  fieldLabel: { fontSize: FontSize.xs, color: Colors.textSecondary, letterSpacing: 1, fontWeight: FontWeight.bold },
  input: { backgroundColor: Colors.surface, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, padding: Spacing.sm, color: Colors.textPrimary, fontSize: FontSize.md },
  smallInput: { width: 80 },
  textArea: { minHeight: 100 },
  abiGrid: { flexDirection: 'row', gap: Spacing.xs },
  abiBox:  { flex: 1, alignItems: 'center', gap: 4 },
  abiLabel:{ fontSize: FontSize.xs, color: Colors.textSecondary },
  abiInput:{ backgroundColor: Colors.surface, borderRadius: Radius.sm, borderWidth: 1, borderColor: Colors.border, padding: Spacing.xs, color: Colors.textPrimary, width: '100%', textAlign: 'center' },
  chip:      { backgroundColor: Colors.surfaceHigh, borderRadius: Radius.sm, paddingHorizontal: Spacing.sm, paddingVertical: 4, borderWidth: 1, borderColor: Colors.border },
  chipActive:{ borderColor: Colors.gold, backgroundColor: Colors.gold + '22' },
  chipTxt:   { fontSize: FontSize.xs, color: Colors.textSecondary },
  chipTxtActive: { color: Colors.gold, fontWeight: FontWeight.bold },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  senseInputRow: { flexDirection: 'row', gap: Spacing.xs, alignItems: 'center' },
  senseAddBtn: { backgroundColor: Colors.gold, borderRadius: Radius.md, paddingHorizontal: Spacing.md, justifyContent: 'center' },
  senseAddTxt: { color: Colors.bg, fontWeight: FontWeight.bold, fontSize: FontSize.sm },

  traitCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.surface, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border,
    padding: Spacing.sm,
  },
  traitCardName: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  traitCardMeta: { fontSize: FontSize.xs, color: Colors.textDim, marginTop: 2 },
  traitCardCaret: { fontSize: FontSize.lg, color: Colors.textDim },

  backdrop: { flex: 1, backgroundColor: '#000000bb', justifyContent: 'flex-end' },
  traitModalSheet: {
    backgroundColor: Colors.surfaceHigh,
    borderTopLeftRadius: Radius.lg, borderTopRightRadius: Radius.lg,
    padding: Spacing.lg, maxHeight: '85%',
  },
  traitModalTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.gold, marginBottom: Spacing.md, textAlign: 'center' },
  effectPanel: {
    backgroundColor: Colors.surface, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border,
    padding: Spacing.sm, gap: Spacing.sm, marginTop: Spacing.xs,
  },
  effectNote: { fontSize: FontSize.xs, color: Colors.textDim, lineHeight: 16, fontStyle: 'italic' },
  rowInline: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  inlineLabel: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: FontWeight.bold },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  checkbox: { width: 18, height: 18, borderRadius: 4, borderWidth: 2, borderColor: Colors.border },
  checkboxChecked: { backgroundColor: Colors.gold, borderColor: Colors.gold },
  toggleTxt: { fontSize: FontSize.sm, color: Colors.textSecondary, flex: 1 },

  traitModalBtnRow: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.lg },
  traitDeleteBtn: { flex: 1, backgroundColor: Colors.red + '22', borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.red + '66', padding: Spacing.sm, alignItems: 'center' },
  traitDeleteTxt: { color: Colors.red, fontWeight: FontWeight.bold, fontSize: FontSize.sm },
  traitDoneBtn: { flex: 2, backgroundColor: Colors.gold, borderRadius: Radius.md, padding: Spacing.sm, alignItems: 'center' },
  traitDoneTxt: { color: Colors.bg, fontWeight: FontWeight.bold, fontSize: FontSize.sm },
});
