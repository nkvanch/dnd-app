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
import { useHomebrewStore } from '../../src/store/homebrewStore';
import { applySpellChoiceToEntity } from '../../src/engine/leveling';
import { Entity, Spell } from '../../src/engine/types';
import { spellRepo } from '../../src/content/spellRepo';
import type { SpellIndexEntry } from '../../src/content/spellRepo.types';
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
  spell, selected, disabled, isHomebrew, onToggle,
}: {
  spell: SpellIndexEntry; selected: boolean; disabled: boolean; isHomebrew?: boolean; onToggle: () => void;
}) {
  const [open, setOpen] = useState(false);
  // Tier 1 doesn't carry description — homebrew spells are already full
  // Spell objects at runtime (structurally satisfy SpellIndexEntry), so
  // their description is read straight off; official spells are fetched
  // on demand the moment the row is expanded.
  const [description, setDescription] = useState<string | null>(
    isHomebrew ? (spell as unknown as Spell).description : null
  );
  useEffect(() => {
    if (!open || description !== null || isHomebrew) return;
    let cancelled = false;
    spellRepo.ensureLoaded([spell.id]).then(() => {
      if (!cancelled) setDescription(spellRepo.getSpellSync(spell.id)?.description ?? '');
    });
    return () => { cancelled = true; };
  }, [open, spell.id, description, isHomebrew]);

  return (
    <View style={[styles.spellCard, selected && styles.spellCardSelected, disabled && styles.spellCardDisabled]}>
      <View style={styles.spellRowTop}>
        <Pressable style={styles.spellSelect} onPress={onToggle} disabled={disabled}>
          <View style={[styles.checkbox, selected && styles.checkboxSelected]}>
            {selected && <Text style={styles.checkmark}>✓</Text>}
          </View>
          <View style={styles.spellCardLeft}>
            <View style={styles.spellNameRow}>
              <Text style={styles.spellName}>{spell.name}</Text>
              {isHomebrew && (
                <View style={styles.homebrewTag}>
                  <Text style={styles.homebrewTagTxt}>Homebrew</Text>
                </View>
              )}
            </View>
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
        <Text style={styles.spellDesc}>{description ?? 'Loading…'}</Text>
      )}
    </View>
  );
}

export default function SpellsScreen() {
  const router   = useRouter();
  const draft    = useCharacterStore(s => s.draft);
  const setDraft = useCharacterStore(s => s.setDraft);
  const rules    = useCharacterStore(s => s.rules);
  const homebrewSpells = useHomebrewStore(s => s.spells);

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
  const [schoolFilter,   setSchoolFilter]   = useState<string | null>(null);
  const [spellSort,      setSpellSort]      = useState<'name' | 'school'>('name');
  const [cantripsOpen,   setCantripsOpen]   = useState(true);
  const [spellsOpen,     setSpellsOpen]     = useState(true);
  // Off by default — the normal pool is restricted to this class's own spell
  // list. Toggling this widens the pool to every class's spells, for the
  // "pick an extra spell from another class" case (a feat, a homebrew rule,
  // etc.) rather than silently letting every class pick from everything.
  const [otherClasses,   setOtherClasses]   = useState(false);

  if (!draft) return null;

  const classId       = draft.identity.classId;
  const isSpellcaster = !!draft.spellcasting || spellChoices.length > 0;
  const allSpells: SpellIndexEntry[] = (() => {
    // Homebrew spells are merged in last and override official spells of the
    // same id, so a homebrew edit of an existing spell takes precedence.
    const homebrewIds = new Set(homebrewSpells.map(s => s.id));
    const official     = spellRepo.getIndex().filter(s => !homebrewIds.has(s.id));
    return [...official, ...homebrewSpells];
  })();
  const homebrewSpellIds = new Set(homebrewSpells.map(s => s.id));

  // Filter by class — only show spells tagged for this class.
  // If a spell has no `classes` tag at all (legacy), include it so nothing disappears.
  // The "add extra from another class" toggle bypasses this restriction entirely.
  const classSpells = otherClasses
    ? allSpells
    : allSpells.filter(s => !s.classes || s.classes.length === 0 || s.classes.includes(classId));

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
  // Every real spellChoice() in class content uses the 'all' pool sentinel
  // (see src/content/classes/index.ts) — it means "any spell from this
  // class's list", not a literal array, so the pool is built dynamically
  // here exactly like SpellChoicePicker.tsx does for the level-up case
  // (same class/cantrip-vs-leveled filtering). resolveChoice() can't apply
  // these either — it silently skips any choice whose pool isn't a literal
  // array — so confirming uses applySpellChoiceToEntity() instead, same as
  // SpellChoicePicker.
  if (spellChoices.length > 0) {
    const isCantripChoice = (id: string) => id.includes('cantrip');
    const maxCastableLevel = (() => {
      const sc = draft.spellcasting;
      if (!sc) return 0;
      const tiers = ['9', '8', '7', '6', '5', '4', '3', '2', '1'] as const;
      for (const t of tiers) { if ((sc.slots[t]?.total ?? 0) > 0) return Number(t); }
      return 0;
    })();
    const alreadyKnown = new Set([
      ...(draft.spellcasting?.cantrips ?? []),
      ...(draft.spellcasting?.known ?? []),
    ]);
    const poolForChoice = (choice: typeof spellChoices[number]): SpellIndexEntry[] => {
      const cantrip = isCantripChoice(choice.id);
      return classSpells
        .filter(s => !alreadyKnown.has(s.id))
        .filter(s => cantrip ? s.level === 0 : (s.level >= 1 && s.level <= maxCastableLevel))
        .sort((a, b) => a.level - b.level || a.name.localeCompare(b.name));
    };
    const toggleChoice = (choiceId: string, spellId: string, max: number) => {
      setSelections(prev => {
        const current = prev[choiceId] ?? [];
        if (current.includes(spellId)) return { ...prev, [choiceId]: current.filter(id => id !== spellId) };
        if (current.length >= max) return prev;
        return { ...prev, [choiceId]: [...current, spellId] };
      });
    };
    const handleConfirmChoices = async () => {
      const allChosen = Object.values(selections).flat();
      await spellRepo.ensureLoaded(allChosen);
      let updated = draft!;
      for (const choice of spellChoices) {
        const chosen = selections[choice.id] ?? [];
        if (chosen.length === choice.definition.count) {
          updated = applySpellChoiceToEntity(updated, choice.id, chosen, id => allSpells.find(s => s.id === id)?.level, rules);
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
          const pool   = poolForChoice(choice);
          const chosen = selections[choice.id] ?? [];
          return (
            <View key={choice.id} style={styles.choiceBlock}>
              <Text style={styles.choicePrompt}>{choice.definition.prompt}</Text>
              <Text style={styles.choiceCount}>{chosen.length} / {choice.definition.count} selected</Text>
              {pool.length === 0
                ? <Text style={styles.emptyNote}>No available spells for this choice.</Text>
                : pool.map(spell => {
                  const selected = chosen.includes(spell.id);
                  const disabled = !selected && chosen.length >= choice.definition.count;
                  return (
                    <SpellRow
                      key={spell.id}
                      spell={spell}
                      selected={selected}
                      disabled={disabled}
                      isHomebrew={homebrewSpellIds.has(spell.id)}
                      onToggle={() => toggleChoice(choice.id, spell.id, choice.definition.count)}
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
  const matchesSearch  = (s: SpellIndexEntry) => q === '' || s.name.toLowerCase().includes(q) || s.school.toLowerCase().includes(q);
  const matchesSchool  = (s: SpellIndexEntry) => !schoolFilter || s.school === schoolFilter;
  const sortSpells = (list: SpellIndexEntry[]) => [...list].sort((a, b) =>
    spellSort === 'school'
      ? (a.school.localeCompare(b.school) || a.name.localeCompare(b.name))
      : a.name.localeCompare(b.name)
  );
  const cantripPool    = sortSpells(classSpells.filter(s => s.level === 0 && matchesSearch(s) && matchesSchool(s)));
  const spellPool      = sortSpells(classSpells.filter(s => s.level === 1 && matchesSearch(s) && matchesSchool(s)));

  // Distinct schools present in this class's cantrip+level-1 pool, for the chips.
  const availableSchools = Array.from(new Set(
    classSpells.filter(s => s.level <= 1).map(s => s.school)
  )).sort();

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

  const handleConfirm = async () => {
    await spellRepo.ensureLoaded([...pickedCantrips, ...pickedSpells]);
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

          {/* School filter chips */}
          {availableSchools.length > 1 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.chipRow}
              contentContainerStyle={styles.chipRowContent}
            >
              <Pressable
                style={[styles.chip, !schoolFilter && styles.chipActive]}
                onPress={() => setSchoolFilter(null)}
              >
                <Text style={[styles.chipTxt, !schoolFilter && styles.chipTxtActive]}>All</Text>
              </Pressable>
              {availableSchools.map(school => (
                <Pressable
                  key={school}
                  style={[styles.chip, schoolFilter === school && styles.chipActive]}
                  onPress={() => setSchoolFilter(s => s === school ? null : school)}
                >
                  <Text style={[styles.chipTxt, schoolFilter === school && styles.chipTxtActive]}>
                    {school}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          )}

          {/* Sort selector */}
          <View style={styles.sortRow}>
            <Text style={styles.sortLabel}>Sort:</Text>
            <Pressable
              style={[styles.sortBtn, spellSort === 'name' && styles.sortBtnActive]}
              onPress={() => setSpellSort('name')}
            >
              <Text style={[styles.sortTxt, spellSort === 'name' && styles.sortTxtActive]}>A–Z</Text>
            </Pressable>
            <Pressable
              style={[styles.sortBtn, spellSort === 'school' && styles.sortBtnActive]}
              onPress={() => setSpellSort('school')}
            >
              <Text style={[styles.sortTxt, spellSort === 'school' && styles.sortTxtActive]}>School</Text>
            </Pressable>
          </View>

          <View style={styles.spellActionRow}>
            <Pressable
              style={styles.createSpellBtn}
              onPress={() => router.push('/homebrew/spell-builder')}
            >
              <Text style={styles.createSpellTxt}>+ Create new homebrew spell</Text>
            </Pressable>
            <Pressable
              style={[styles.createSpellBtn, otherClasses && styles.createSpellBtnActive]}
              onPress={() => setOtherClasses(v => !v)}
            >
              <Text style={[styles.createSpellTxt, otherClasses && styles.createSpellTxtActive]}>
                {otherClasses ? '✓ Showing every class’s spells' : '+ Add extra from another class'}
              </Text>
            </Pressable>
          </View>

          {targets.cantrips > 0 && (
            <View style={styles.choiceBlock}>
              <Pressable style={styles.levelHeaderRow} onPress={() => setCantripsOpen(o => !o)}>
                <Text style={styles.levelHeader}>CANTRIPS</Text>
                <View style={styles.levelHeaderLine} />
                <Text style={[styles.levelHeaderCount, cantripsDone && styles.choiceCountDone]}>
                  {pickedCantrips.length}/{targets.cantrips}
                </Text>
                <Text style={styles.levelHeaderChevron}>{cantripsOpen ? '▲' : '▼'}</Text>
              </Pressable>
              {cantripsOpen && (cantripPool.length === 0
                ? <Text style={styles.emptyNote}>No matching cantrips.</Text>
                : cantripPool.map(s => (
                  <SpellRow
                    key={s.id}
                    spell={s}
                    selected={pickedCantrips.includes(s.id)}
                    disabled={!pickedCantrips.includes(s.id) && pickedCantrips.length >= targets.cantrips}
                    isHomebrew={homebrewSpellIds.has(s.id)}
                    onToggle={() => toggleCantrip(s.id)}
                  />
                )))}
            </View>
          )}

          {targets.spells > 0 && (
            <View style={styles.choiceBlock}>
              <Pressable style={styles.levelHeaderRow} onPress={() => setSpellsOpen(o => !o)}>
                <Text style={styles.levelHeader}>1ST-LEVEL SPELLS</Text>
                <View style={styles.levelHeaderLine} />
                <Text style={[styles.levelHeaderCount, spellsDone && styles.choiceCountDone]}>
                  {pickedSpells.length}/{targets.spells}
                </Text>
                <Text style={styles.levelHeaderChevron}>{spellsOpen ? '▲' : '▼'}</Text>
              </Pressable>
              {spellsOpen && (spellPool.length === 0
                ? <Text style={styles.emptyNote}>No matching spells.</Text>
                : spellPool.map(s => (
                  <SpellRow
                    key={s.id}
                    spell={s}
                    selected={pickedSpells.includes(s.id)}
                    disabled={!pickedSpells.includes(s.id) && pickedSpells.length >= targets.spells}
                    isHomebrew={homebrewSpellIds.has(s.id)}
                    onToggle={() => toggleSpell(s.id)}
                  />
                )))}
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
  chipRow: { flexGrow: 0, marginBottom: Spacing.lg, marginTop: -Spacing.sm },
  chipRowContent: { gap: Spacing.xs, paddingVertical: 2 },
  chip: {
    backgroundColor: Colors.surface, borderRadius: Radius.full,
    borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: Spacing.sm, paddingVertical: 4,
  },
  chipActive: { backgroundColor: Colors.gold + '22', borderColor: Colors.gold },
  chipTxt:       { fontSize: FontSize.xs, color: Colors.textSecondary },
  chipTxtActive: { color: Colors.gold, fontWeight: FontWeight.bold },
  sortRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, marginBottom: Spacing.md },
  sortLabel: { fontSize: FontSize.xs, color: Colors.textDim, marginRight: 2 },
  sortBtn: {
    backgroundColor: Colors.surface, borderRadius: Radius.sm,
    borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: Spacing.sm, paddingVertical: 3,
  },
  sortBtnActive: { backgroundColor: Colors.blue + '22', borderColor: Colors.blue },
  sortTxt:       { fontSize: FontSize.xs, color: Colors.textSecondary },
  sortTxtActive: { color: Colors.blue, fontWeight: FontWeight.bold },
  choiceBlock:  { marginBottom: Spacing.xl },
  levelHeaderRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    marginBottom: Spacing.md, marginTop: Spacing.sm,
  },
  levelHeader: {
    fontSize: FontSize.xl, fontWeight: FontWeight.black,
    color: Colors.gold, letterSpacing: 2,
  },
  levelHeaderLine: {
    flex: 1, height: 2, backgroundColor: Colors.gold + '44', borderRadius: 1,
  },
  levelHeaderCount: {
    fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.textSecondary,
  },
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
  spellNameRow:     { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  spellName:        { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  homebrewTag: {
    backgroundColor: Colors.gold + '22', borderRadius: Radius.full,
    borderWidth: 1, borderColor: Colors.gold + '66',
    paddingHorizontal: Spacing.sm, paddingVertical: 1,
  },
  homebrewTagTxt: { fontSize: FontSize.xs, color: Colors.gold, fontWeight: FontWeight.bold },
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
  spellActionRow: {
    flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end',
    gap: Spacing.xs, marginBottom: Spacing.md,
  },
  createSpellBtn: {
    backgroundColor: Colors.gold + '22', borderRadius: Radius.full,
    borderWidth: 1, borderColor: Colors.gold + '66',
    paddingHorizontal: Spacing.sm, paddingVertical: 3,
  },
  createSpellBtnActive: { backgroundColor: Colors.gold, borderColor: Colors.gold },
  createSpellTxt: { fontSize: FontSize.xs, color: Colors.gold, fontWeight: FontWeight.bold },
  createSpellTxtActive: { color: Colors.bg },
  levelHeaderChevron: { fontSize: FontSize.sm, color: Colors.textDim },
});
