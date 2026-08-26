// app/creation/hub.tsx
// Creation hub with "Next →" sequential button and fixed scores completion check.
import { useEffect } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useCharacterStore } from '../../src/store/characterStore';
import { getHouseRule } from '../../src/engine/houseRules';
import { Entity } from '../../src/engine/types';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../../src/theme';

type Section = {
  key:   string;
  label: string;
  route: string;
  done:  (d: Entity) => boolean;
};

const ORDERED_SECTIONS: Section[] = [
  { key: 'race',       label: 'Race',          route: '/creation/race',       done: d => !!d.identity.raceId },
  { key: 'class',      label: 'Class',         route: '/creation/class',      done: d => !!d.identity.classId },
  { key: 'scores',     label: 'Ability Scores', route: '/creation/scores',
    done: d => {
      try {
        const notes = JSON.parse(d.notes || '{}');
        return !!notes.scoresConfirmed;
      } catch { return false; }
    },
  },
  { key: 'background', label: 'Background',    route: '/creation/background', done: d => !!d.identity.backgroundId },
  { key: 'skills',     label: 'Skills',        route: '/creation/skills',
    done: d => {
      const pending = d.choices.filter(c => c.definition.kind === 'skill' && !c.resolved);
      return pending.length === 0;
    },
  },
  { key: 'feats',      label: 'Feats (optional)', route: '/creation/feats',
    done: d => {
      try { return !!JSON.parse(d.notes || '{}').featsVisited; }
      catch { return false; }
    },
  },
  { key: 'equipment',  label: 'Equipment',     route: '/creation/equipment',
    done: d => {
      try { return !!JSON.parse(d.notes || '{}').equipmentVisited; }
      catch { return false; }
    },
  },
  { key: 'spells',     label: 'Spells',        route: '/creation/spells',
    done: d => {
      try { return !!JSON.parse(d.notes || '{}').spellsVisited; }
      catch { return false; }
    },
  },
];

const PRIMARY_KEYS = ['race', 'class', 'scores'];

const ASI_SECTION: Section = {
  key:   'asi',
  label: 'Ability Improvements',
  route: '/creation/level-up',
  done:  d => d.choices.filter(c => c.definition.kind === 'asi' && !c.resolved).length === 0,
};

const SPELLCASTING_ABILITY_SECTION: Section = {
  key:   'spellcasting_ability',
  label: 'Spellcasting Ability',
  route: '/creation/spellcasting-ability',
  done:  d => d.choices.filter(c => c.definition.kind === 'spellcasting_ability' && !c.resolved).length === 0,
};

export default function HubScreen() {
  const router = useRouter();
  const draft  = useCharacterStore(s => s.draft);
  const rules  = useCharacterStore(s => s.rules);

  useEffect(() => {
    if (!draft) router.replace('/creation/name');
  }, [draft]);

  if (!draft) return null;

  // The optional Feats step only appears when the table allows a 1st-level feat.
  const featsAllowed = getHouseRule(rules, 'featAtCreation');
  const baseSections = featsAllowed
    ? ORDERED_SECTIONS
    : ORDERED_SECTIONS.filter(s => s.key !== 'feats');

  // Conditionally include ASI section only when there are pending ASI choices
  const asiChoices = draft.choices.filter(c => c.definition.kind === 'asi');
  let sections = asiChoices.length > 0
    ? [...baseSections, ASI_SECTION]
    : baseSections;

  // Same pattern for the rare-case spellcasting-ability choice (homebrew
  // classes with 2+ spellcastingAbilityOptions) — was previously never
  // tracked or routed to at all, so this pending choice just sat unresolved
  // forever with no way for the player to reach it.
  const spellAbilityChoices = draft.choices.filter(c => c.definition.kind === 'spellcasting_ability');
  if (spellAbilityChoices.length > 0) {
    sections = [...sections, SPELLCASTING_ABILITY_SECTION];
  }

  const allDone = sections.every(s => s.done(draft));

  // Find the first incomplete section for the "Next →" button
  const nextSection = sections.find(s => !s.done(draft));

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>

      <Text style={styles.heading}>Character Creation</Text>
      <View style={styles.divider} />

      {/* Primary quick-access buttons */}
      <Text style={styles.sectionLabel}>Choose where to begin:</Text>
      <View style={styles.primaryRow}>
        {PRIMARY_KEYS.map(key => {
          const sec  = ORDERED_SECTIONS.find(s => s.key === key)!;
          const done = sec.done(draft);
          return (
            <Pressable
              key={key}
              style={[styles.primaryBtn, done && styles.primaryBtnDone]}
              onPress={() => router.push(sec.route as any)}
            >
              <Text style={[styles.primaryBtnText, done && styles.primaryBtnTextDone]}>
                {sec.label}
              </Text>
              {done && <Text style={styles.doneCheck}>✓</Text>}
            </Pressable>
          );
        })}
      </View>

      <View style={styles.divider} />

      {/* Progress tracker — all sections */}
      <Text style={styles.sectionLabel}>Current Progress</Text>
      <View style={styles.progressList}>
        {sections.map(sec => {
          const done = sec.done(draft);
          return (
            <Pressable key={sec.key} style={styles.progressRow} onPress={() => router.push(sec.route as any)}>
              <Text style={styles.progressLabel}>{sec.label}</Text>
              <Text style={[styles.progressStatus, done ? styles.statusDone : styles.statusPending]}>
                {done ? '✓' : '✗'}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.divider} />

      {/* Next sequential button */}
      {nextSection && !allDone && (
        <Pressable style={styles.nextBtn} onPress={() => router.push(nextSection.route as any)}>
          <Text style={styles.nextBtnText}>Next: {nextSection.label} →</Text>
        </Pressable>
      )}

      {/* Review — only when everything done */}
      {allDone && (
        <Pressable style={styles.reviewBtn} onPress={() => router.push('/creation/review')}>
          <Text style={styles.reviewBtnText}>Review Character →</Text>
        </Pressable>
      )}

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  content:   { padding: Spacing.lg, paddingBottom: Spacing.xxl },
  heading: { fontSize: FontSize.xxl, fontWeight: FontWeight.black, color: Colors.textPrimary, textAlign: 'center', marginBottom: Spacing.md },
  divider: { height: 1, backgroundColor: Colors.border, marginVertical: Spacing.lg },
  sectionLabel: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.textSecondary, marginBottom: Spacing.md, textTransform: 'uppercase', letterSpacing: 1 },

  primaryRow: { gap: Spacing.sm },
  primaryBtn: {
    backgroundColor: Colors.surface, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border,
    paddingVertical: Spacing.md, paddingHorizontal: Spacing.lg,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  primaryBtnDone:     { borderColor: Colors.green },
  primaryBtnText:     { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  primaryBtnTextDone: { color: Colors.green },
  doneCheck:          { fontSize: FontSize.lg, color: Colors.green },

  progressList: { backgroundColor: Colors.surface, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden' },
  progressRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: Spacing.md, paddingHorizontal: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.border },
  progressLabel:  { fontSize: FontSize.md, color: Colors.textPrimary },
  progressStatus: { fontSize: FontSize.md, fontWeight: FontWeight.bold },
  statusDone:    { color: Colors.green },
  statusPending: { color: Colors.red },

  nextBtn: {
    backgroundColor: Colors.surfaceHigh, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.gold,
    paddingVertical: Spacing.md, alignItems: 'center', marginBottom: Spacing.sm,
  },
  nextBtnText: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.gold },

  reviewBtn: { backgroundColor: Colors.gold, borderRadius: Radius.md, paddingVertical: Spacing.md, alignItems: 'center' },
  reviewBtnText: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.bg },
});
