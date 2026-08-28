// src/components/SpellChoicePicker.tsx
// Resolves a 'spell' pending choice — a known-spell caster (Sorcerer, Bard,
// Warlock, Ranger) gaining new spells/cantrips known at level-up, or a
// Wizard adding to their spellbook. Mirrors InfusionPicker.tsx's shape:
// presentational, applies through applySpellChoiceToEntity (bypasses
// resolveChoice — the pool is the 'all' sentinel, same reason ASI/subclass/
// infusion do). Whether this is a cantrip choice or a leveled-spell choice
// is read off choice.definition.id (see the classes/index.ts choices this
// resolves — every id contains 'cantrip' or it doesn't), rather than a new
// ChoiceDefinition field, so the engine/type layer didn't need to grow.
import { useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, TextInput } from 'react-native';
import { applySpellChoiceToEntity } from '../engine/leveling';
import { spellRepo } from '../content/spellRepo';
import type { SpellIndexEntry } from '../content/spellRepo.types';
import { useHomebrewStore } from '../store/homebrewStore';
import { Entity, ChoiceState, CampaignRules } from '../engine/types';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../theme';

export function SpellChoicePicker({
  entity,
  choice,
  rules,
  onResolved,
  onClose,
}: {
  entity:     Entity;
  choice:     ChoiceState;
  rules:      CampaignRules;
  onResolved: (updated: Entity) => void;
  onClose?:   () => void;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const [search,   setSearch]   = useState('');
  const homebrewSpells = useHomebrewStore(s => s.spells);

  const isCantripChoice = choice.definition.id.includes('cantrip');
  const classId = entity.identity.classId;
  const spellcasting = entity.spellcasting;

  // Highest spell slot tier this entity currently has any slots in — caps
  // which leveled spells are choosable (a caster can't learn a spell above
  // what they can currently cast). Cantrips have no such cap.
  const maxCastableLevel = useMemo(() => {
    if (!spellcasting) return 0;
    const tiers = ['9','8','7','6','5','4','3','2','1'] as const;
    for (const t of tiers) {
      if ((spellcasting.slots[t]?.total ?? 0) > 0) return Number(t);
    }
    return 0;
  }, [spellcasting]);

  const allSpells: SpellIndexEntry[] = useMemo(() => {
    const homebrewIds = new Set(homebrewSpells.map(s => s.id));
    const official = spellRepo.getIndex().filter(s => !homebrewIds.has(s.id));
    return [...official, ...homebrewSpells];
  }, [homebrewSpells]);

  const known = new Set([...(spellcasting?.cantrips ?? []), ...(spellcasting?.known ?? [])]);
  const q = search.trim().toLowerCase();

  const options = useMemo(() => {
    return allSpells.filter(s => {
      if (known.has(s.id)) return false;
      if (!s.classes || s.classes.length === 0 || s.classes.includes(classId)) {
        // class-restricted (or legacy-untagged, included per the same
        // fallback creation's spell picker uses) — keep checking
      } else {
        return false;
      }
      if (isCantripChoice) {
        if (s.level !== 0) return false;
      } else {
        if (s.level === 0 || s.level > maxCastableLevel) return false;
      }
      if (q && !s.name.toLowerCase().includes(q) && !s.school.toLowerCase().includes(q)) return false;
      return true;
    }).sort((a, b) => a.level - b.level || a.name.localeCompare(b.name));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allSpells, classId, isCantripChoice, maxCastableLevel, q]);

  function toggle(id: string) {
    setSelected(prev => {
      if (prev.includes(id)) return prev.filter(x => x !== id);
      if (prev.length >= choice.definition.count) return prev;
      return [...prev, id];
    });
  }

  function commit() {
    if (selected.length !== choice.definition.count) return;
    const getLevel = (id: string) => allSpells.find(s => s.id === id)?.level;
    onResolved(applySpellChoiceToEntity(entity, choice.id, selected, getLevel, rules));
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.headerRow}>
        <Text style={styles.heading}>{isCantripChoice ? 'Choose Cantrips' : 'Choose Spells'}</Text>
        {onClose && (
          <Pressable onPress={onClose} hitSlop={8}>
            <Text style={styles.close}>✕</Text>
          </Pressable>
        )}
      </View>
      <Text style={styles.sub}>{choice.definition.prompt}</Text>
      <Text style={styles.count}>Selected {selected.length}/{choice.definition.count}</Text>

      <TextInput
        style={styles.search}
        placeholder="Search"
        placeholderTextColor={Colors.textDim}
        value={search}
        onChangeText={setSearch}
      />

      <View style={styles.list}>
        {options.map(s => {
          const isSel = selected.includes(s.id);
          const disabled = !isSel && selected.length >= choice.definition.count;
          return (
            <Pressable
              key={s.id}
              style={[styles.row, isSel && styles.rowSelected, disabled && styles.rowDisabled]}
              disabled={disabled}
              onPress={() => toggle(s.id)}
            >
              <View style={styles.rowHeader}>
                <Text style={styles.rowName}>{s.name}{isSel ? ' ✓' : ''}</Text>
                <Text style={styles.rowLevel}>{s.level === 0 ? 'Cantrip' : `Lv ${s.level}`}</Text>
              </View>
              <Text style={styles.rowMeta}>{s.school}{s.concentration ? ' · Concentration' : ''}{s.ritual ? ' · Ritual' : ''}</Text>
            </Pressable>
          );
        })}
        {options.length === 0 && (
          <Text style={styles.empty}>
            No {isCantripChoice ? 'new cantrips' : 'new spells'} available to choose right now.
          </Text>
        )}
      </View>

      <Pressable
        style={[styles.applyBtn, selected.length !== choice.definition.count && styles.applyBtnDisabled]}
        disabled={selected.length !== choice.definition.count}
        onPress={commit}
      >
        <Text style={styles.applyTxt}>Learn {selected.length} {isCantripChoice ? 'Cantrip' : 'Spell'}{selected.length !== 1 ? 's' : ''} →</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  content:   { padding: Spacing.lg, paddingBottom: Spacing.xxl },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  heading:   { flex: 1, flexShrink: 1, fontSize: FontSize.xxl, fontWeight: FontWeight.black, color: Colors.gold, marginBottom: Spacing.xs },
  close:     { fontSize: FontSize.xl, color: Colors.textSecondary, paddingLeft: Spacing.md },
  sub:       { fontSize: FontSize.md, color: Colors.textSecondary },
  count:     { fontSize: FontSize.sm, color: Colors.gold, fontWeight: FontWeight.bold, marginBottom: Spacing.md },
  search: {
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    fontSize: FontSize.md, color: Colors.textPrimary, marginBottom: Spacing.md,
  },
  empty:     { fontSize: FontSize.sm, color: Colors.textDim, fontStyle: 'italic', textAlign: 'center', padding: Spacing.lg },

  list: { gap: Spacing.sm, marginBottom: Spacing.lg },
  row: {
    backgroundColor: Colors.surface, borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.border, padding: Spacing.md,
  },
  rowSelected: { borderColor: Colors.gold, backgroundColor: Colors.gold + '22' },
  rowDisabled: { opacity: 0.4 },
  rowHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rowName: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  rowLevel: { fontSize: FontSize.xs, color: Colors.textDim, fontWeight: FontWeight.bold },
  rowMeta: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 2 },

  applyBtn: { backgroundColor: Colors.gold, borderRadius: Radius.md, paddingVertical: Spacing.md, alignItems: 'center' },
  applyBtnDisabled: { backgroundColor: Colors.goldDim },
  applyTxt: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.bg },
});
