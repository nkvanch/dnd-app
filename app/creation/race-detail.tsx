// app/creation/race-detail.tsx
// Race detail with back button. Strips old race features before applying new ones.
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { useEffect, useState } from 'react';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useCharacterStore } from '../../src/store/characterStore';
import { globalContentDB } from '../../src/content/classes/library';
import { applyGrant } from '../../src/engine/leveling';
import { recomputeDerived } from '../../src/engine/pipeline';
import { Entity } from '../../src/engine/types';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../../src/theme';

const RACE_DETAIL: Record<string, {
  description: string; size: string; speed: number; languages: string[];
}> = {
  human: {
    description: 'Humans are the most adaptable and ambitious people among the common races. Whatever drives them, humans are the innovators, the achievers, and the pioneers of the worlds.',
    size: 'Medium', speed: 30,
    languages: ['Common', 'One extra language of your choice'],
  },
  elf: {
    description: 'Elves are a magical people of otherworldly grace, living in places of ethereal beauty — in the midst of ancient forests or in silvery spires glittering with faerie light.',
    size: 'Medium', speed: 30,
    languages: ['Common', 'Elvish'],
  },
  dwarf: {
    description: 'Bold and hardy, dwarves are known as skilled warriors, miners, and workers of stone and metal. They live in mountain kingdoms rich with ancient grandeur.',
    size: 'Medium', speed: 25,
    languages: ['Common', 'Dwarvish'],
  },
  halfling: {
    description: "The comforts of home are the goals of most halflings' lives — a place to settle in peace and quiet, far from marauding monsters and clashing armies.",
    size: 'Small', speed: 25,
    languages: ['Common', 'Halfling'],
  },
  dragonborn: {
    description: 'Born of dragons, as their name proclaims, the dragonborn walk proudly through a world that greets them with fearful incomprehension.',
    size: 'Medium', speed: 30,
    languages: ['Common', 'Draconic'],
  },
  gnome: {
    description: "A gnome's energy and enthusiasm for living shines through every inch of his or her tiny body. Gnomes average slightly over 3 feet tall and weigh 40 to 45 pounds.",
    size: 'Small', speed: 25,
    languages: ['Common', 'Gnomish'],
  },
  half_elf: {
    description: 'Walking in two worlds but truly belonging to neither, half-elves combine what some say are the best qualities of their elf and human parents.',
    size: 'Medium', speed: 30,
    languages: ['Common', 'Elvish', 'One extra language of your choice'],
  },
  half_orc: {
    description: "Half-orcs' orcish blood gives them a resilient nature and fierce physical power. They make excellent warriors and have a hardy constitution.",
    size: 'Medium', speed: 30,
    languages: ['Common', 'Orc'],
  },
  tiefling: {
    description: 'Tieflings are derived from human bloodlines, and in the broadest possible sense, they still look human. However, their infernal heritage has left a visible mark upon them.',
    size: 'Medium', speed: 30,
    languages: ['Common', 'Infernal'],
  },
};

/**
 * Strips everything granted by the previously-selected race (or subrace) so that
 * changing race in the wizard does not accumulate stale features/choices.
 */
function clearRaceFeatures(entity: Entity): Entity {
  // Choice ids that originated from the current race's features (if any).
  const raceChoiceIds = new Set(
    entity.features
      .filter(f => f.source.kind === 'race')
      .flatMap(f => f.choices.map(c => c.id)),
  );
  return {
    ...entity,
    features: entity.features.filter(f => f.source.kind !== 'race'),
    choices:  entity.choices.filter(c => !raceChoiceIds.has(c.definition.id)),
  };
}

export default function RaceDetailScreen() {
  const router   = useRouter();
  const { id }   = useLocalSearchParams<{ id: string }>();
  const draft    = useCharacterStore(s => s.draft);
  const setDraft = useCharacterStore(s => s.setDraft);
  const rules    = useCharacterStore(s => s.rules);

  const race   = globalContentDB.races.find(r => r.id === id);
  const detail = id ? RACE_DETAIL[id] : null;

  // Subrace selection — mandatory when the race defines subraces.
  const [subRaceId, setSubRaceId] = useState<string | null>(null);
  const subraces    = race?.subraces ?? [];
  const hasSubraces = subraces.length > 0;
  const canSelect   = !hasSubraces || subRaceId !== null;

  useEffect(() => {
    if (!race || !draft) router.back();
  }, []);

  if (!race || !draft) return null;

  function selectRace() {
    // Strip old race features first so re-selection or changing race doesn't stack.
    // Subrace features also carry source.kind === 'race', so they are cleared too.
    let updated = clearRaceFeatures(draft!);
    const chosenSubrace = hasSubraces ? subraces.find(s => s.id === subRaceId) ?? null : null;
    updated = {
      ...updated,
      identity: {
        ...updated.identity,
        raceId:    race!.id,
        subRaceId: chosenSubrace ? chosenSubrace.id : null,
      },
    };
    // Apply base race features...
    for (const feature of race!.features) {
      updated = applyGrant(updated, { kind: 'feature', value: { ...feature, isActive: true } }, 0);
    }
    // ...then the chosen subrace's features (e.g. Hill Dwarf WIS +1, Mountain Dwarf STR +2).
    if (chosenSubrace) {
      for (const feature of chosenSubrace.features) {
        updated = applyGrant(updated, { kind: 'feature', value: { ...feature, isActive: true } }, 0);
      }
    }
    updated = recomputeDerived(updated, rules);
    setDraft(updated);
    router.push('/creation/hub');
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>

      <Text style={styles.heading}>{race.name}</Text>
      <View style={styles.divider} />

      {detail && (
        <>
          <Text style={styles.description}>{detail.description}</Text>
          <View style={styles.divider} />
          <InfoRow label="Size"  value={detail.size} />
          <InfoRow label="Speed" value={`${detail.speed} feet`} />
          <View style={styles.divider} />
          <Text style={styles.sectionTitle}>Languages</Text>
          {detail.languages.map((l, i) => <Text key={i} style={styles.bullet}>• {l}</Text>)}
        </>
      )}

      {race.features.length > 0 && (
        <>
          <View style={styles.divider} />
          <Text style={styles.sectionTitle}>Features</Text>
          {race.features.map(f => (
            <View key={f.id} style={styles.featureRow}>
              <Text style={styles.bullet}>• {f.name}</Text>
              {f.description ? <Text style={styles.featureDesc}>{f.description}</Text> : null}
            </View>
          ))}
        </>
      )}

      {/* Subrace picker — mandatory when the race has subraces */}
      {hasSubraces && (
        <>
          <View style={styles.divider} />
          <Text style={styles.sectionTitle}>Choose a Subrace</Text>
          {subraces.map(sr => {
            const isSel = subRaceId === sr.id;
            const bonusText = summarizeBonuses(sr);
            const keyFeatures = sr.features
              .filter(f => !f.name.startsWith('Ability Score'))
              .map(f => f.name);
            return (
              <Pressable
                key={sr.id}
                style={[styles.subraceCard, isSel && styles.subraceCardSelected]}
                onPress={() => setSubRaceId(isSel ? null : sr.id)}
              >
                <View style={styles.subraceHeader}>
                  <View style={[styles.radio, isSel && styles.radioSelected]} />
                  <Text style={[styles.subraceName, isSel && styles.subraceNameSelected]}>{sr.name}</Text>
                </View>
                {bonusText ? <Text style={styles.subraceBonus}>{bonusText}</Text> : null}
                {keyFeatures.length > 0 && (
                  <Text style={styles.subraceFeatures}>{keyFeatures.join(' · ')}</Text>
                )}
              </Pressable>
            );
          })}
        </>
      )}

      <View style={styles.divider} />
      <Pressable
        style={[styles.selectBtn, !canSelect && styles.selectBtnDisabled]}
        onPress={selectRace}
        disabled={!canSelect}
      >
        <Text style={styles.selectBtnText}>
          {hasSubraces && !subRaceId ? 'Choose a subrace to continue' : 'Select Race'}
        </Text>
      </Pressable>
    </ScrollView>
  );
}

const ABILITY_NAMES: Record<string, string> = {
  str: 'STR', dex: 'DEX', con: 'CON', int: 'INT', wis: 'WIS', cha: 'CHA',
};

/** Builds a short "+1 WIS, speed 35" summary from a subrace's stat effects. */
function summarizeBonuses(sr: { features: { effects: { type: string; target: string; operation: string; value: unknown }[] }[] }): string {
  const parts: string[] = [];
  for (const f of sr.features) {
    for (const e of f.effects) {
      if (e.type !== 'stat_modifier' || typeof e.value !== 'number') continue;
      if (e.target === 'speed') {
        parts.push(e.operation === 'set' ? `Speed ${e.value}` : `Speed +${e.value}`);
      } else if (ABILITY_NAMES[e.target]) {
        parts.push(`+${e.value} ${ABILITY_NAMES[e.target]}`);
      }
    }
  }
  return parts.join(', ');
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  content:   { padding: Spacing.lg, paddingBottom: Spacing.xxl },
  backBtn:   { marginBottom: Spacing.md },
  backBtnText: { fontSize: FontSize.md, color: Colors.gold, fontWeight: FontWeight.bold },
  heading: { fontSize: FontSize.xxl, fontWeight: FontWeight.black, color: Colors.textPrimary, textAlign: 'center', marginBottom: Spacing.md },
  divider: { height: 1, backgroundColor: Colors.border, marginVertical: Spacing.lg },
  description: { fontSize: FontSize.md, color: Colors.textSecondary, lineHeight: 22 },
  sectionTitle: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 1, marginBottom: Spacing.sm },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: Spacing.xs, borderBottomWidth: 1, borderBottomColor: Colors.border },
  infoLabel: { fontSize: FontSize.md, color: Colors.textSecondary },
  infoValue: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  bullet:      { fontSize: FontSize.md, color: Colors.textPrimary, marginBottom: Spacing.xs },
  featureRow:  { marginBottom: Spacing.sm },
  featureDesc: { fontSize: FontSize.sm, color: Colors.textSecondary, paddingLeft: Spacing.md, marginTop: 2 },
  selectBtn: { backgroundColor: Colors.gold, borderRadius: Radius.md, paddingVertical: Spacing.md, alignItems: 'center' },
  selectBtnDisabled: { backgroundColor: Colors.goldDim },
  selectBtnText: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.bg },

  subraceCard: {
    backgroundColor: Colors.surface, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border,
    padding: Spacing.md, marginBottom: Spacing.sm,
  },
  subraceCardSelected: { borderColor: Colors.gold },
  subraceHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: Colors.border },
  radioSelected: { borderColor: Colors.gold, backgroundColor: Colors.gold },
  subraceName: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  subraceNameSelected: { color: Colors.gold },
  subraceBonus: { fontSize: FontSize.sm, color: Colors.green, marginTop: Spacing.xs, marginLeft: 28 },
  subraceFeatures: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2, marginLeft: 28 },
});
