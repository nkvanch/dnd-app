// app/creation/spells.tsx
// Step 8: Spell selection for spellcasting classes.
// Always renders — never auto-navigates during render.
// Sets spellsVisited flag on Continue so hub knows this step was reached.
//
// Two selection modes:
//   1. ChoiceDefinition-based (kind: 'spell') — if a class ever defines them.
//   2. Content-based — pull cantrips/level-1 spells straight from the content DB
//      and write the picks into entity.spellcasting.cantrips / .known.
import { useState, useEffect } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { useCharacterStore } from '../../src/store/characterStore';
import { resolveChoice } from '../../src/engine/leveling';
import { ChoiceOption, Entity, Spell } from '../../src/engine/types';
import { globalContentDB } from '../../src/content/classes/library';
import { ALL_VAULT_SPELLS } from '../../src/content/spells/generated';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../../src/theme';

// Starting spells known at level 1, by class. Prepared casters (Cleric/Druid)
// prepare leveled spells from the character sheet, so they only choose cantrips here.
const SPELLS_AT_L1: Record<string, { cantrips: number; spells: number }> = {
  wizard:   { cantrips: 3, spells: 6 },
  sorcerer: { cantrips: 4, spells: 2 },
  bard:     { cantrips: 2, spells: 4 },
  warlock:  { cantrips: 2, spells: 2 },
  cleric:   { cantrips: 3, spells: 0 },
  druid:    { cantrips: 2, spells: 0 },
  ranger:   { cantrips: 0, spells: 0 },
  paladin:  { cantrips: 0, spells: 0 },
};

/** Marks spellsVisited in notes JSON. */
function markVisited(entity: Entity): Entity {
  let n: Record<string, unknown> = {};
  try { n = JSON.parse(entity.notes || '{}'); } catch { /* ignore */ }
  return { ...entity, notes: JSON.stringify({ ...n, spellsVisited: true }) };
}

// ── Spell row (select + expandable description) ───────────────────────────────

function SpellRow({
  spell, selected, disabled, onToggle,
}: {
  spell: Spell; selected: boolean; disabled: boolean; onToggle: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <View style={[styles.spellCard, selected && styles.spellCardSelected, disabled && styles.spellCardDisabled]}>
      <View style={styles.spellRowTop}>
        <Pressable style={styles.spellSelect} onPress={onToggle} disabled={disabled}>
          <View style={[styles.checkbox, selected && styles.checkboxSelected]}>
            {selected && <Text style={styles.checkmark}>✓</Text>}
          </View>
          <View style={styles.spellCardLeft}>
            <Text style={styles.spellName}>{spell.name}</Text>
            <Text style={styles.spellMeta}>
              {spell.level === 0 ? 'Cantrip' : `Level ${spell.level}`}  ·  {spell.school}  ·  {spell.castingTime}
              {spell.concentration ? '  ·  Concentration' : ''}
            </Text>
          </View>
        </Pressable>
        <Pressable style={styles.infoBtn} onPress={() => setOpen(o => !o)} hitSlop={8}>
          <Text style={styles.infoBtnTxt}>{open ? '▲' : 'ⓘ'}</Text>
        </Pressable>
      </View>
      {open && (
        <Text style={styles.spellDesc}>{spell.description}</Text>
      )}
    </View>
  );
}

export default function SpellsScreen() {
  const router   = useRouter();
  const draft    = useCharacterStore(s => s.draft);
  const setDraft = useCharacterStore(s => s.setDraft);
  const rules    = useCharacterStore(s => s.rules);

  // ── ALL hooks first — before any conditional return ──
  // Redirect to name if no draft — must be in useEffect, not render
  useEffect(() => {
    if (!draft) router.replace('/creation/name');
  }, [draft?.id]);

  const spellChoices = draft
    ? draft.choices.filter(c => !c.resolved && c.definition.kind === 'spell')
    : [];

  // ChoiceDefinition-based selections (legacy path)
  const [selections, setSelections] = useState<Record<string, string[]>>(
    Object.fromEntries(spellChoices.map(c => [c.id, []]))
  );

  // Content-based selections
  const [pickedCantrips, setPickedCantrips] = useState<string[]>(draft?.spellcasting?.cantrips ?? []);
  const [pickedSpells,   setPickedSpells]   = useState<string[]>(draft?.spellcasting?.known ?? []);
  const [search,         setSearch]         = useState('');

  if (!draft) return null;

  const classId       = draft.identity.classId;
  const isSpellcaster = !!draft.spellcasting || spellChoices.length > 0;
  const allSpells = (() => {
    // Prefer vault spells (487 class-tagged) when they exist; fall back to
    // the hand-authored corpus for any spell not in the vault (by id).
    const vaultIds  = new Set(ALL_VAULT_SPELLS.map(s => s.id));
    const fallbacks = globalContentDB.spells.filter(s => !vaultIds.has(s.id));
    return [...ALL_VAULT_SPELLS, ...fallbacks];
  })();

  // Filter by class — only show spells tagged for this class.
  // If a spell has no `classes` tag at all (legacy), include it so nothing disappears.
  const classSpells = allSpells.filter(s => !s.classes || s.classes.length === 0 || s.classes.includes(classId));

  // ── 1. Non-spellcaster ──────────────────────────────────────────────────────
  if (!isSpellcaster) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Text style={styles.heading}>Spells</Text>
        <Text style={styles.sub}>This class does not use spells.</Text>
        <Pressable style={styles.nextBtn} onPress={() => {
          setDraft(markVisited(draft));
          router.push('/creation/hub');
        }}>
          <Text style={styles.nextBtnText}>Continue →</Text>
        </Pressable>
      </ScrollView>
    );
  }

  // ── 2. ChoiceDefinition-based selection (if a class defines spell choices) ───
  if (spellChoices.length > 0) {
    const toggleChoice = (choiceId: string, optionId: string, max: number) => {
      setSelections(prev => {
        const current = prev[choiceId] ?? [];
        if (current.includes(optionId)) return { ...prev, [choiceId]: current.filter(id => id !== optionId) };
        if (current.length >= max) return prev;
        return { ...prev, [choiceId]: [...current, optionId] };
      });
    };
    const handleConfirmChoices = () => {
      let updated = draft!;
      for (const choice of spellChoices) {
        const chosen = selections[choice.id] ?? [];
        if (chosen.length === choice.definition.count) {
          updated = resolveChoice(updated, choice.id, chosen, rules);
        }
      }
      updated = markVisited(updated);
      setDraft(updated);
      router.push('/creation/hub');
    };
    const canConfirm = spellChoices.every(c => (selections[c.id]?.length ?? 0) === c.definition.count);

    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Text style={styles.heading}>Spells</Text>
        {spellChoices.map(choice => {
          const pool   = Array.isArray(choice.definition.pool) ? choice.definition.pool as ChoiceOption[] : [];
          const chosen = selections[choice.id] ?? [];
          return (
            <View key={choice.id} style={styles.choiceBlock}>
              <Text style={styles.choicePrompt}>{choice.definition.prompt}</Text>
              <Text style={styles.choiceCount}>{chosen.length} / {choice.definition.count} selected</Text>
              {pool.map(opt => {
                const spell = allSpells.find(s => s.id === opt.value);
                if (!spell) return null;
                const selected = chosen.includes(opt.id);
                const disabled = !selected && chosen.length >= choice.definition.count;
                return (
                  <SpellRow
                    key={opt.id}
                    spell={spell}
                    selected={selected}
                    disabled={disabled}
                    onToggle={() => toggleChoice(choice.id, opt.id, choice.definition.count)}
                  />
                );
              })}
            </View>
          );
        })}
        <Pressable
          style={[styles.nextBtn, !canConfirm && styles.nextBtnDisabled]}
          onPress={handleConfirmChoices}
          disabled={!canConfirm}
        >
          <Text style={styles.nextBtnText}>Confirm Spells →</Text>
        </Pressable>
      </ScrollView>
    );
  }

  // ── 3. Content-based selection ──────────────────────────────────────────────
  const targets        = SPELLS_AT_L1[classId] ?? { cantrips: 0, spells: 0 };
  const q              = search.trim().toLowerCase();
  const matchesSearch  = (s: Spell) => q === '' || s.name.toLowerCase().includes(q) || s.school.toLowerCase().includes(q);
  const cantripPool    = classSpells.filter(s => s.level === 0 && matchesSearch(s));
  const spellPool      = classSpells.filter(s => s.level === 1 && matchesSearch(s));

  const toggleCantrip = (id: string) => {
    setPickedCantrips(prev => {
      if (prev.includes(id)) return prev.filter(x => x !== id);
      if (prev.length >= targets.cantrips) return prev;
      return [...prev, id];
    });
  };
  const toggleSpell = (id: string) => {
    setPickedSpells(prev => {
      if (prev.includes(id)) return prev.filter(x => x !== id);
      if (prev.length >= targets.spells) return prev;
      return [...prev, id];
    });
  };

  const cantripsDone = pickedCantrips.length === targets.cantrips;
  const spellsDone   = pickedSpells.length === targets.spells;
  const canConfirm   = cantripsDone && spellsDone;

  const handleConfirm = () => {
    let updated: Entity = draft!;
    if (updated.spellcasting) {
      updated = {
        ...updated,
        spellcasting: {
          ...updated.spellcasting,
          cantrips: pickedCantrips,
          known:    pickedSpells,
          // Known casters cast straight from `known`; mirror into prepared so the
          // sheet shows them as castable for prepared-style classes too.
          prepared: pickedSpells,
        },
      };
    }
    updated = markVisited(updated);
    setDraft(updated);
    router.push('/creation/hub');
  };

  const nothingToPick = targets.cantrips === 0 && targets.spells === 0;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.heading}>Spells</Text>

      {nothingToPick ? (
        <Text style={styles.sub}>
          Your spells are prepared from the full class list on the character sheet.
        </Text>
      ) : (
        <>
          <Text style={styles.sub}>Choose your starting cantrips and spells.</Text>

          <TextInput
            style={styles.search}
            value={search}
            onChangeText={setSearch}
            placeholder="Search spells…"
            placeholderTextColor={Colors.textDim}
          />

          {targets.cantrips > 0 && (
            <View style={styles.choiceBlock}>
              <Text style={styles.choicePrompt}>Cantrips</Text>
              <Text style={[styles.choiceCount, cantripsDone && styles.choiceCountDone]}>
                {pickedCantrips.length} of {targets.cantrips} selected
              </Text>
              {cantripPool.map(s => (
                <SpellRow
                  key={s.id}
                  spell={s}
                  selected={pickedCantrips.includes(s.id)}
                  disabled={!pickedCantrips.includes(s.id) && pickedCantrips.length >= targets.cantrips}
                  onToggle={() => toggleCantrip(s.id)}
                />
              ))}
              {cantripPool.length === 0 && <Text style={styles.emptyNote}>No matching cantrips.</Text>}
            </View>
          )}

          {targets.spells > 0 && (
            <View style={styles.choiceBlock}>
              <Text style={styles.choicePrompt}>1st-Level Spells</Text>
              <Text style={[styles.choiceCount, spellsDone && styles.choiceCountDone]}>
                {pickedSpells.length} of {targets.spells} selected
              </Text>
              {spellPool.map(s => (
                <SpellRow
                  key={s.id}
                  spell={s}
                  selected={pickedSpells.includes(s.id)}
                  disabled={!pickedSpells.includes(s.id) && pickedSpells.length >= targets.spells}
                  onToggle={() => toggleSpell(s.id)}
                />
              ))}
              {spellPool.length === 0 && <Text style={styles.emptyNote}>No matching spells.</Text>}
            </View>
          )}
        </>
      )}

      <Pressable
        style={[styles.nextBtn, !nothingToPick && !canConfirm && styles.nextBtnDisabled]}
        onPress={handleConfirm}
        disabled={!nothingToPick && !canConfirm}
      >
        <Text style={styles.nextBtnText}>{nothingToPick ? 'Continue →' : 'Confirm Spells →'}</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  content:   { padding: Spacing.lg, paddingBottom: Spacing.xxl },
  heading:   { fontSize: FontSize.xxl, fontWeight: FontWeight.black, color: Colors.gold, marginBottom: Spacing.xs },
  sub:       { fontSize: FontSize.md, color: Colors.textSecondary, marginBottom: Spacing.lg },
  search: {
    backgroundColor: Colors.surface, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border,
    padding: Spacing.sm, color: Colors.textPrimary, marginBottom: Spacing.lg,
  },
  choiceBlock:  { marginBottom: Spacing.xl },
  choicePrompt: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.textPrimary, marginBottom: Spacing.xs },
  choiceCount:  { fontSize: FontSize.sm, color: Colors.textSecondary, marginBottom: Spacing.md },
  choiceCountDone: { color: Colors.green, fontWeight: FontWeight.bold },
  spellCard: {
    padding: Spacing.md, borderRadius: Radius.md,
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    marginBottom: Spacing.sm,
  },
  spellCardSelected: { borderColor: Colors.blue, backgroundColor: Colors.blueDim },
  spellCardDisabled: { opacity: 0.4 },
  spellRowTop:  { flexDirection: 'row', alignItems: 'center' },
  spellSelect:  { flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  checkbox: {
    width: 22, height: 22, borderRadius: 4,
    borderWidth: 2, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  checkboxSelected: { backgroundColor: Colors.blue, borderColor: Colors.blue },
  checkmark:        { fontSize: 12, color: Colors.white, fontWeight: FontWeight.bold },
  spellCardLeft:    { flex: 1 },
  spellName:        { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  spellMeta:        { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },
  infoBtn:          { paddingHorizontal: Spacing.sm, paddingVertical: 2 },
  infoBtnTxt:       { fontSize: FontSize.md, color: Colors.blue },
  spellDesc:        { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: Spacing.sm, lineHeight: 20 },
  emptyNote:        { color: Colors.textDim, fontSize: FontSize.sm, fontStyle: 'italic' },
  nextBtn: {
    backgroundColor: Colors.gold, borderRadius: Radius.md,
    paddingVertical: Spacing.md, alignItems: 'center', marginTop: Spacing.lg,
  },
  nextBtnDisabled: { backgroundColor: Colors.goldDim },
  nextBtnText: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.bg },
});
