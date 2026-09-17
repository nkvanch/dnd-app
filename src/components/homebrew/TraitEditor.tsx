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
import { useState, useMemo } from 'react';
import {
  View, Text, ScrollView, Pressable, StyleSheet, TextInput, Modal,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { DraftTrait, TraitEffectKind, Ability } from '../../engine/types';
import {
  ABILITIES, SENSE_TYPES, MOVE_TYPES, SKILLS, ACTION_TYPES, RECHARGE_TYPES,
  COMMON_TOOLS, COMMON_DAMAGE_TYPES, SPEED_ZEROING_CONDITIONS,
  toId, disambiguateId, newDraftTrait, buildTraitFeature, newDraftSubrace, buildSubrace,
} from '../../content/traitCompiler';
import type { MoveType, DraftSubrace } from '../../content/traitCompiler';
// The one trait-editor field needing live content-DB/store access — every
// other panel here is pure form state. Only ever reads id/name/level/
// castingTime, so the lightweight Tier-1 index is sufficient — no need to
// fetch full spell records just to search/reference a spell by name.
import { mergeSpellIndex } from '../../content/contentResolution';
import { useHomebrewStore } from '../../store/homebrewStore';
import { SafeBottomView } from '../SafeBottomView';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../../theme';

export {
  ABILITIES, SENSE_TYPES, MOVE_TYPES, SKILLS, ACTION_TYPES, RECHARGE_TYPES,
  COMMON_TOOLS, COMMON_DAMAGE_TYPES, SPEED_ZEROING_CONDITIONS,
  toId, disambiguateId, newDraftTrait, buildTraitFeature, newDraftSubrace, buildSubrace,
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

export function TraitEditorModal({ trait, visible, onChange, onDone, onDelete, excludeKinds }: {
  trait: DraftTrait | null;
  visible: boolean;
  onChange: (t: DraftTrait) => void;
  onDone: () => void;
  onDelete: () => void;
  /**
   * Hides effect kinds the caller's content type has no path for. E.g. a
   * Feat only ever applies ONE Feature (no resource/extra-feature carrying
   * path — see leveling.ts's applyFeatToEntity), so 'resource_ability' and
   * 'spell_grant' (which buildTraitFeature can return a resource/extra
   * Features for) would silently drop that part of the effect if offered.
   */
  excludeKinds?: TraitEffectKind[];
}) {
  // Hooks must run unconditionally every render (this component instance
  // stays mounted while `trait` toggles null <-> non-null as the caller
  // opens/closes different traits) — so these live above the early return.
  const homebrewSpells = useHomebrewStore(s => s.spells);
  const [cantripSearch, setCantripSearch] = useState('');
  const [leveledSearch, setLeveledSearch] = useState('');
  const allSpells = useMemo(() => mergeSpellIndex(homebrewSpells), [homebrewSpells]);

  if (!trait) return null;
  const set = (patch: Partial<DraftTrait>) => onChange({ ...trait, ...patch });
  function updateGrant(localId: string, patch: Partial<DraftTrait['spellGrants'][number]>) {
    set({ spellGrants: trait!.spellGrants.map(x => x.localId === localId ? { ...x, ...patch } : x) });
  }

  const excluded = new Set(excludeKinds ?? []);
  const ALL_EFFECT_KIND_GROUPS: { group: string; kinds: { key: TraitEffectKind; label: string }[] }[] = [
    { group: 'Stats & Combat', kinds: [
      { key: 'ability_score', label: 'Ability score bonus' },
      { key: 'unarmored_defense', label: 'Unarmored Defense (AC formula)' },
      { key: 'ac_bonus', label: 'AC bonus (+N, stacks)' },
    ] },
    { group: 'Proficiencies', kinds: [
      { key: 'skill_proficiency', label: 'Skill proficiency' },
      { key: 'tool_proficiency', label: 'Tool/kit proficiency' },
    ] },
    { group: 'Senses & Movement', kinds: [
      { key: 'sense', label: 'Grants a sense' },
      { key: 'movement', label: 'Grants movement' },
      { key: 'movement_condition', label: 'Movement conditions' },
    ] },
    { group: 'Damage Response', kinds: [
      { key: 'damage_resistance', label: 'Resistance' },
      { key: 'damage_immunity', label: 'Immunity' },
      { key: 'damage_vulnerability', label: 'Vulnerability' },
    ] },
    { group: 'Advantage/Reminders', kinds: [
      { key: 'advantage_disadvantage', label: 'Advantage/Disadvantage' },
    ] },
    { group: 'Spellcasting', kinds: [
      { key: 'spell_grant', label: 'Grants spells' },
    ] },
    { group: 'Limited-Use Ability', kinds: [
      { key: 'resource_ability', label: 'Limited-use ability' },
    ] },
    { group: 'Flavor Only', kinds: [
      { key: 'none', label: 'Flavor only' },
    ] },
  ];
  const EFFECT_KIND_GROUPS = ALL_EFFECT_KIND_GROUPS
    .map(g => ({ ...g, kinds: g.kinds.filter(k => !excluded.has(k.key)) }))
    .filter(g => g.kinds.length > 0);

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
            {EFFECT_KIND_GROUPS.map(g => (
              <View key={g.group} style={styles.effectGroupBlock}>
                <Text style={styles.effectGroupLabel}>{g.group}</Text>
                <View style={styles.chipWrap}>
                  {g.kinds.map(k => (
                    <Pressable
                      key={k.key}
                      style={[styles.chip, trait.effectKind === k.key && styles.chipActive]}
                      onPress={() => set({ effectKind: k.key })}
                    >
                      <Text style={[styles.chipTxt, trait.effectKind === k.key && styles.chipTxtActive]}>{k.label}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            ))}

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

            {trait.effectKind === 'unarmored_defense' && (
              <View style={styles.effectPanel}>
                <View style={styles.rowInline}>
                  <Text style={styles.inlineLabel}>Base AC:</Text>
                  <TextInput style={[styles.input, styles.smallInput]} value={trait.unarmoredBase}
                    onChangeText={v => set({ unarmoredBase: v })} keyboardType="number-pad" />
                </View>
                <Text style={styles.inlineLabel}>Add these ability modifiers</Text>
                <View style={styles.chipWrap}>
                  {ABILITIES.map(a => {
                    const active = trait.unarmoredAbilities.includes(a);
                    return (
                      <Pressable key={a} style={[styles.chip, active && styles.chipActive]}
                        onPress={() => set({
                          unarmoredAbilities: active
                            ? trait.unarmoredAbilities.filter(x => x !== a)
                            : [...trait.unarmoredAbilities, a],
                        })}>
                        <Text style={[styles.chipTxt, active && styles.chipTxtActive]}>{a.toUpperCase()}</Text>
                      </Pressable>
                    );
                  })}
                </View>
                {trait.unarmoredAbilities.map(a => (
                  <View key={a} style={styles.rowInline}>
                    <Text style={styles.inlineLabel}>{a.toUpperCase()} cap:</Text>
                    <TextInput style={[styles.input, styles.smallInput]}
                      value={trait.unarmoredCaps[a] ?? ''}
                      onChangeText={v => set({ unarmoredCaps: { ...trait.unarmoredCaps, [a]: v } })}
                      keyboardType="number-pad" placeholder="uncapped" placeholderTextColor={Colors.textDim} />
                  </View>
                ))}
                <Text style={styles.effectNote}>
                  AC = base + the selected modifiers, each capped if you set one (blank means
                  uncapped) -- e.g. Barbarian's Unarmored Defense is 10 + DEX + CON, both uncapped.
                </Text>
              </View>
            )}

            {trait.effectKind === 'ac_bonus' && (
              <View style={styles.effectPanel}>
                <View style={styles.rowInline}>
                  <Text style={styles.inlineLabel}>AC bonus:</Text>
                  <TextInput style={[styles.input, styles.smallInput]} value={trait.acBonusAmount}
                    onChangeText={v => set({ acBonusAmount: v })} keyboardType="numbers-and-punctuation" />
                </View>
                <Text style={styles.effectNote}>
                  Adds straight to AC on top of whatever's already providing the base -- armor,
                  Unarmored Defense, or the default 10 + DEX. Use a negative number for a
                  penalty. For a trait that REPLACES the whole AC formula instead (like Monk's
                  Unarmored Defense itself), use "Unarmored Defense (AC formula)" above.
                </Text>
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
                  placeholder="Search or type your own — e.g. Thieves' Tools"
                  placeholderTextColor={Colors.textDim} />
                {(() => {
                  const q = trait.toolName.trim().toLowerCase();
                  const matches = q.length >= 2
                    ? COMMON_TOOLS.filter(n => n.toLowerCase().includes(q) && n !== trait.toolName).slice(0, 12)
                    : [];
                  if (matches.length === 0) return null;
                  return (
                    <View style={styles.searchResults}>
                      {matches.map(name => (
                        <Pressable key={name} style={styles.searchResultRow} onPress={() => set({ toolName: name })}>
                          <Text style={styles.searchResultTxt}>{name}</Text>
                          <Text style={styles.searchResultAdd}>Use</Text>
                        </Pressable>
                      ))}
                    </View>
                  );
                })()}
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

            {trait.effectKind === 'movement_condition' && (
              <View style={styles.effectPanel}>
                <Text style={styles.inlineLabel}>Immune to being slowed by</Text>
                <View style={styles.chipWrap}>
                  {SPEED_ZEROING_CONDITIONS.map(c => {
                    const active = trait.moveCondTargets.includes(c.key);
                    return (
                      <Pressable key={c.key} style={[styles.chip, active && styles.chipActive]}
                        onPress={() => set({
                          moveCondTargets: active
                            ? trait.moveCondTargets.filter(x => x !== c.key)
                            : [...trait.moveCondTargets, c.key],
                        })}>
                        <Text style={[styles.chipTxt, active && styles.chipTxtActive]}>{c.label}</Text>
                      </Pressable>
                    );
                  })}
                </View>
                <Text style={styles.inlineLabel}>Flavor note (not mechanically enforced)</Text>
                <TextInput style={[styles.input, styles.textArea]} value={trait.moveCondFlavor}
                  onChangeText={v => set({ moveCondFlavor: v })}
                  placeholder="e.g. ignores difficult terrain"
                  placeholderTextColor={Colors.textDim} multiline textAlignVertical="top" />
                <Text style={styles.effectNote}>
                  The chips above are real and enforced (your speed won't drop to 0 from those
                  conditions). Difficult terrain and similar movement rules aren't tracked
                  anywhere in the engine, so a note about them here is reminder-only, same
                  honest tradeoff as "Flavor only" traits elsewhere in this app.
                </Text>
              </View>
            )}

            {(trait.effectKind === 'damage_resistance' || trait.effectKind === 'damage_immunity' || trait.effectKind === 'damage_vulnerability') && (
              <View style={styles.effectPanel}>
                <Text style={styles.inlineLabel}>Damage type</Text>
                <TextInput style={styles.input} value={trait.damageType}
                  onChangeText={v => set({ damageType: v })}
                  placeholder="Search or type your own — e.g. fire"
                  placeholderTextColor={Colors.textDim} />
                {(() => {
                  const q = trait.damageType.trim().toLowerCase();
                  const matches = q.length >= 1
                    ? COMMON_DAMAGE_TYPES.filter(n => n.includes(q) && n !== trait.damageType).slice(0, 13)
                    : COMMON_DAMAGE_TYPES.filter(n => n !== trait.damageType);
                  return (
                    <View style={styles.chipWrap}>
                      {matches.map(name => (
                        <Pressable key={name} style={styles.chip} onPress={() => set({ damageType: name })}>
                          <Text style={styles.chipTxt}>{name}</Text>
                        </Pressable>
                      ))}
                    </View>
                  );
                })()}
              </View>
            )}

            {trait.effectKind === 'spell_grant' && (
              <View style={styles.effectPanel}>
                <Text style={styles.inlineLabel}>At-will cantrip (optional)</Text>
                {trait.spellGrantCantripId ? (
                  <Pressable style={styles.selectedSpellRow} onPress={() => set({ spellGrantCantripId: '' })}>
                    <Text style={styles.selectedSpellTxt}>
                      {allSpells.find(s => s.id === trait.spellGrantCantripId)?.name ?? trait.spellGrantCantripId}
                    </Text>
                    <Text style={styles.selectedSpellChange}>Clear</Text>
                  </Pressable>
                ) : (
                  <>
                    <TextInput style={styles.input} value={cantripSearch} onChangeText={setCantripSearch}
                      placeholder="Search cantrips…" placeholderTextColor={Colors.textDim} />
                    {cantripSearch.trim().length >= 2 && (
                      <View style={styles.searchResults}>
                        {allSpells
                          .filter(s => s.level === 0 && s.name.toLowerCase().includes(cantripSearch.trim().toLowerCase()))
                          .slice(0, 8).map(s => (
                            <Pressable key={s.id} style={styles.searchResultRow}
                              onPress={() => { set({ spellGrantCantripId: s.id }); setCantripSearch(''); }}>
                              <Text style={styles.searchResultTxt}>{s.name}</Text>
                              <Text style={styles.searchResultAdd}>Use</Text>
                            </Pressable>
                          ))}
                      </View>
                    )}
                  </>
                )}
                {!!trait.spellGrantCantripId && (
                  <>
                    <Text style={styles.inlineLabel}>Casting ability</Text>
                    <View style={styles.chipWrap}>
                      {ABILITIES.map(a => (
                        <Pressable key={a} style={[styles.chip, trait.spellGrantAbility === a && styles.chipActive]}
                          onPress={() => set({ spellGrantAbility: a })}>
                          <Text style={[styles.chipTxt, trait.spellGrantAbility === a && styles.chipTxtActive]}>{a.toUpperCase()}</Text>
                        </Pressable>
                      ))}
                    </View>
                  </>
                )}

                <Text style={[styles.inlineLabel, { marginTop: Spacing.sm }]}>Leveled spell grants</Text>
                {trait.spellGrants.map(g => (
                  <View key={g.localId} style={styles.spellGrantCard}>
                    <View style={styles.rowInline}>
                      <Text style={styles.spellGrantName}>{g.spellName}</Text>
                      <Pressable
                        onPress={() => set({ spellGrants: trait.spellGrants.filter(x => x.localId !== g.localId) })}
                        hitSlop={8}
                      >
                        <Text style={styles.traitDeleteTxt}>✕</Text>
                      </Pressable>
                    </View>
                    <View style={styles.rowInline}>
                      <Text style={styles.inlineLabel}>Unlocks at level:</Text>
                      <TextInput style={[styles.input, styles.smallInput]} value={g.unlockLevel}
                        onChangeText={v => updateGrant(g.localId, { unlockLevel: v })} keyboardType="number-pad" />
                    </View>
                    <View style={styles.chipWrap}>
                      <Pressable style={[styles.chip, g.mode === 'resource' && styles.chipActive]}
                        onPress={() => updateGrant(g.localId, { mode: 'resource' })}>
                        <Text style={[styles.chipTxt, g.mode === 'resource' && styles.chipTxtActive]}>Resource pool</Text>
                      </Pressable>
                      <Pressable style={[styles.chip, g.mode === 'slot' && styles.chipActive]}
                        onPress={() => updateGrant(g.localId, { mode: 'slot' })}>
                        <Text style={[styles.chipTxt, g.mode === 'slot' && styles.chipTxtActive]}>Spell slot</Text>
                      </Pressable>
                    </View>
                    {g.mode === 'resource' ? (
                      <>
                        <View style={styles.chipWrap}>
                          {RECHARGE_TYPES.map(r => (
                            <Pressable key={r.key} style={[styles.chip, g.recharge === r.key && styles.chipActive]}
                              onPress={() => updateGrant(g.localId, { recharge: r.key })}>
                              <Text style={[styles.chipTxt, g.recharge === r.key && styles.chipTxtActive]}>{r.label}</Text>
                            </Pressable>
                          ))}
                        </View>
                        {g.recharge === 'other' && (
                          <TextInput style={styles.input} value={g.rechargeOther}
                            onChangeText={v => updateGrant(g.localId, { rechargeOther: v })}
                            placeholder="e.g. Dawn" placeholderTextColor={Colors.textDim} />
                        )}
                        <View style={styles.rowInline}>
                          <Text style={styles.inlineLabel}>Uses:</Text>
                          <TextInput style={[styles.input, styles.smallInput]} value={g.uses}
                            onChangeText={v => updateGrant(g.localId, { uses: v })} keyboardType="number-pad" />
                        </View>
                      </>
                    ) : (
                      <View style={styles.rowInline}>
                        <Text style={styles.inlineLabel}>Minimum slot level:</Text>
                        <TextInput style={[styles.input, styles.smallInput]} value={g.minSlotLevel}
                          onChangeText={v => updateGrant(g.localId, { minSlotLevel: v })} keyboardType="number-pad" />
                      </View>
                    )}
                  </View>
                ))}

                <TextInput style={styles.input} value={leveledSearch} onChangeText={setLeveledSearch}
                  placeholder="Search a spell to add…" placeholderTextColor={Colors.textDim} />
                {leveledSearch.trim().length >= 2 && (
                  <View style={styles.searchResults}>
                    {allSpells
                      .filter(s => s.level > 0 && s.name.toLowerCase().includes(leveledSearch.trim().toLowerCase()))
                      .slice(0, 8).map(s => (
                        <Pressable key={s.id} style={styles.searchResultRow}
                          onPress={() => {
                            const ct = s.castingTime.toLowerCase();
                            const actionType: 'action' | 'bonus_action' | 'reaction' =
                              ct.includes('bonus') ? 'bonus_action' : ct.includes('reaction') ? 'reaction' : 'action';
                            set({
                              spellGrants: [...trait.spellGrants, {
                                localId: `sg_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
                                spellId: s.id, spellName: s.name, actionType,
                                unlockLevel: '3', mode: 'resource', recharge: 'long_rest', rechargeOther: '',
                                uses: '1', minSlotLevel: String(s.level),
                              }],
                            });
                            setLeveledSearch('');
                          }}
                        >
                          <Text style={styles.searchResultTxt}>{s.name} (Lv {s.level})</Text>
                          <Text style={styles.searchResultAdd}>Add</Text>
                        </Pressable>
                      ))}
                  </View>
                )}
                <Text style={styles.effectNote}>
                  Resource pool: spends a dedicated limited-use charge, like a racial "1/long
                  rest" spell. Spell slot: spends one of the character's own spell slots at or
                  above the minimum level -- only meaningful if they end up with real
                  spellcasting from their class.
                </Text>
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
                {trait.actionType === 'other' && (
                  <TextInput style={styles.input} value={trait.actionTypeOther}
                    onChangeText={v => set({ actionTypeOther: v })}
                    placeholder="e.g. Reflexive, Special" placeholderTextColor={Colors.textDim} />
                )}
                <Text style={styles.inlineLabel}>Recharges on</Text>
                <View style={styles.chipWrap}>
                  {RECHARGE_TYPES.map(r => (
                    <Pressable key={r.key} style={[styles.chip, trait.recharge === r.key && styles.chipActive]}
                      onPress={() => set({ recharge: r.key })}>
                      <Text style={[styles.chipTxt, trait.recharge === r.key && styles.chipTxtActive]}>{r.label}</Text>
                    </Pressable>
                  ))}
                </View>
                {trait.recharge === 'other' && (
                  <TextInput style={styles.input} value={trait.rechargeOther}
                    onChangeText={v => set({ rechargeOther: v })}
                    placeholder="e.g. Dawn, 1/day" placeholderTextColor={Colors.textDim} />
                )}
                <View style={styles.rowInline}>
                  <Text style={styles.inlineLabel}>Uses per recharge:</Text>
                  <TextInput style={[styles.input, styles.smallInput]} value={trait.uses}
                    onChangeText={v => set({ uses: v })} keyboardType="number-pad" />
                </View>
                <View style={styles.rowInline}>
                  <Text style={styles.inlineLabel}>Dice (optional):</Text>
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

            {trait.effectKind !== 'resource_ability' && trait.effectKind !== 'spell_grant' && (
              <View style={styles.effectPanel}>
                <Pressable style={styles.toggleRow} onPress={() => set({ limitedUse: !trait.limitedUse })}>
                  <View style={[styles.checkbox, trait.limitedUse && styles.checkboxChecked]} />
                  <Text style={styles.toggleTxt}>Limited use -- tracked with a counter, not always-on</Text>
                </Pressable>
                {trait.limitedUse && (
                  <>
                    <Text style={styles.inlineLabel}>Action type</Text>
                    <View style={styles.chipWrap}>
                      {ACTION_TYPES.map(a => (
                        <Pressable key={a.key} style={[styles.chip, trait.actionType === a.key && styles.chipActive]}
                          onPress={() => set({ actionType: a.key })}>
                          <Text style={[styles.chipTxt, trait.actionType === a.key && styles.chipTxtActive]}>{a.label}</Text>
                        </Pressable>
                      ))}
                    </View>
                    {trait.actionType === 'other' && (
                      <TextInput style={styles.input} value={trait.actionTypeOther}
                        onChangeText={v => set({ actionTypeOther: v })}
                        placeholder="e.g. Reflexive, Special" placeholderTextColor={Colors.textDim} />
                    )}
                    <Text style={styles.inlineLabel}>Recharges on</Text>
                    <View style={styles.chipWrap}>
                      {RECHARGE_TYPES.map(r => (
                        <Pressable key={r.key} style={[styles.chip, trait.recharge === r.key && styles.chipActive]}
                          onPress={() => set({ recharge: r.key })}>
                          <Text style={[styles.chipTxt, trait.recharge === r.key && styles.chipTxtActive]}>{r.label}</Text>
                        </Pressable>
                      ))}
                    </View>
                    {trait.recharge === 'other' && (
                      <TextInput style={styles.input} value={trait.rechargeOther}
                        onChangeText={v => set({ rechargeOther: v })}
                        placeholder="e.g. Dawn, 1/day" placeholderTextColor={Colors.textDim} />
                    )}
                    <View style={styles.rowInline}>
                      <Text style={styles.inlineLabel}>Uses per recharge:</Text>
                      <TextInput style={[styles.input, styles.smallInput]} value={trait.uses}
                        onChangeText={v => set({ uses: v })} keyboardType="number-pad" />
                    </View>
                    <Text style={styles.effectNote}>
                      Adds a dedicated limited-use pool on top of whichever effect is picked
                      above -- e.g. Resistance + 3/short rest makes it a triggered "use it up
                      to 3 times" ability instead of always-on.
                    </Text>
                  </>
                )}
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

export function TraitListEditor({ traits, onChange, excludeKinds }: {
  traits: DraftTrait[];
  onChange: (traits: DraftTrait[]) => void;
  /** Forwarded to the per-trait TraitEditorModal — see its own doc comment. */
  excludeKinds?: TraitEffectKind[];
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
              {(t.effectKind === 'none' ? 'Flavor only' :
               t.effectKind === 'ability_score' ? `+${t.abilityAmount || 0} ${t.abilityTarget.toUpperCase()}` :
               t.effectKind === 'unarmored_defense' ? `AC = ${t.unarmoredBase} + ${t.unarmoredAbilities.map(a => a.toUpperCase()).join('+') || '—'}` :
               t.effectKind === 'ac_bonus' ? `AC ${parseInt(t.acBonusAmount, 10) >= 0 ? '+' : ''}${t.acBonusAmount || 0}` :
               t.effectKind === 'skill_proficiency' ? `${t.skillExpertise ? 'Expertise' : 'Proficiency'}: ${t.skillTarget}` :
               t.effectKind === 'tool_proficiency' ? `Proficiency: ${t.toolName || '(unnamed tool)'}` :
               t.effectKind === 'advantage_disadvantage' ? `${t.advDirection === 'advantage' ? 'Advantage' : 'Disadvantage'}: ${t.advTarget || '(unspecified)'}` :
               t.effectKind === 'sense' ? `${t.senseType} ${t.senseRange}ft` :
               t.effectKind === 'movement' ? `${t.moveType} ${t.moveRange}ft` :
               t.effectKind === 'movement_condition' ? `Immune to slow from ${t.moveCondTargets.length} condition${t.moveCondTargets.length !== 1 ? 's' : ''}` :
               t.effectKind === 'damage_resistance' ? `Resist ${t.damageType || '(unspecified)'}` :
               t.effectKind === 'damage_immunity' ? `Immune to ${t.damageType || '(unspecified)'}` :
               t.effectKind === 'damage_vulnerability' ? `Vulnerable to ${t.damageType || '(unspecified)'}` :
               t.effectKind === 'spell_grant' ? `${t.spellGrantCantripId ? '1 cantrip' : '0 cantrips'} + ${t.spellGrants.length} leveled spell${t.spellGrants.length !== 1 ? 's' : ''}` :
               `${t.uses}/${t.recharge === 'other' ? (t.rechargeOther || 'other') : t.recharge === 'short_rest' ? 'short rest' : 'long rest'}`)
               + (t.limitedUse && t.effectKind !== 'resource_ability' && t.effectKind !== 'spell_grant'
                   ? ` · ${t.uses}/${t.recharge === 'other' ? (t.rechargeOther || 'other') : t.recharge === 'short_rest' ? 'short rest' : 'long rest'}`
                   : '')}
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
        excludeKinds={excludeKinds}
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
  effectGroupBlock: { marginTop: Spacing.xs, gap: 4 },
  effectGroupLabel: { fontSize: 10, color: Colors.textDim, letterSpacing: 1, fontWeight: FontWeight.bold, textTransform: 'uppercase' },
  searchResults: {
    backgroundColor: Colors.surfaceHigh, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border, marginTop: 4, overflow: 'hidden',
  },
  searchResultRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  searchResultTxt: { color: Colors.textPrimary, fontSize: FontSize.sm, flex: 1 },
  searchResultAdd: { color: Colors.gold, fontSize: FontSize.xs, fontWeight: FontWeight.bold },
  selectedSpellRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: Colors.gold + '11', borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.gold + '66',
    padding: Spacing.sm,
  },
  selectedSpellTxt: { color: Colors.textPrimary, fontSize: FontSize.md, fontWeight: FontWeight.bold },
  selectedSpellChange: { color: Colors.gold, fontSize: FontSize.xs, fontWeight: FontWeight.bold },
  spellGrantCard: {
    backgroundColor: Colors.surfaceHigh, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border,
    padding: Spacing.sm, gap: 6,
  },
  spellGrantName: { flex: 1, color: Colors.textPrimary, fontSize: FontSize.sm, fontWeight: FontWeight.bold },
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
