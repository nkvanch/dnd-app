// app/creation/race.tsx
// Race list — tap row to navigate to detail, long-press chevron to expand description.
import { View, Text, FlatList, Pressable, StyleSheet, TextInput } from 'react-native';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { globalContentDB } from '../../src/content/classes/library';
import { useHomebrewStore } from '../../src/store/homebrewStore';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../../src/theme';

const RACE_DESCRIPTIONS: Record<string, string> = {
  human:      'Humans are the most adaptable and ambitious people among the common races. +1 to all ability scores, one extra language, one extra skill.',
  elf:        'Elves are a magical people of otherworldly grace. DEX +2, INT +1. Darkvision 60 ft. Advantage on saves vs charm, immune to magical sleep.',
  dwarf:      'Bold and hardy, dwarves are known for skilled warriors and smiths. CON +2. Darkvision 60 ft. Resistance to poison. Speed 25 ft, not reduced by heavy armor.',
  halfling:   "The comforts of home are the goals of most halflings' lives. DEX +2. Lucky — reroll 1s. Brave — advantage vs fear. Speed 25 ft.",
  dragonborn: 'Born of dragons, dragonborn walk proudly through a world. STR +2, CHA +1. Breath weapon based on draconic ancestry. Resistance to that damage type.',
  gnome:      "A gnome's energy and enthusiasm for living shines through. INT +2. Darkvision 60 ft. Advantage on INT/WIS/CHA saves vs magic. Speed 25 ft.",
  half_elf:   'Half-elves combine the best of both human and elf heritage. CHA +2, +1 to two other stats. Darkvision 60 ft. Two extra skill proficiencies.',
  half_orc:   "Half-orcs' orcish blood gives them a resilient nature. STR +2, CON +1. Darkvision 60 ft. Relentless Endurance. Savage Attacks on crits.",
  tiefling:   'Tieflings are derived from humans who made a deal with devils. INT +1, CHA +2. Darkvision 60 ft. Resistance to fire. Hellish Rebuke and Darkness spells.',
};

export default function RaceScreen() {
  const router  = useRouter();
  const [search,   setSearch]   = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const homebrewRaces = useHomebrewStore(s => s.races);

  const races = globalContentDB.races.filter(r =>
    r.name.toLowerCase().includes(search.toLowerCase())
  );
  const filteredHomebrewRaces = homebrewRaces.filter(r =>
    r.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <View style={styles.container}>

      <Text style={styles.heading}>Select Race</Text>
      <View style={styles.divider} />

      <TextInput
        style={styles.search}
        placeholder="Search"
        placeholderTextColor={Colors.textDim}
        value={search}
        onChangeText={setSearch}
      />

      <FlatList
        data={races}
        keyExtractor={r => r.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => {
          const isOpen = expanded === item.id;
          const desc   = RACE_DESCRIPTIONS[item.id];
          return (
            <View style={styles.itemWrap}>
              {/* Primary tap → navigate to detail. Chevron tap → expand description. */}
              <Pressable
                style={styles.row}
                onPress={() => router.push(`/creation/race-detail?id=${item.id}`)}
              >
                <Text style={styles.rowName}>{item.name}</Text>
                <Pressable
                  hitSlop={12}
                  onPress={e => { e.stopPropagation(); setExpanded(isOpen ? null : item.id); }}
                >
                  <Text style={styles.rowCaret}>{isOpen ? '▲' : '▼'}</Text>
                </Pressable>
                <Text style={styles.rowArrow}>›</Text>
              </Pressable>

              {/* Inline dropdown description */}
              {isOpen && (
                <View style={styles.dropdown}>
                  {desc && <Text style={styles.dropdownDesc}>{desc}</Text>}
                  <Text style={styles.dropdownFeatures}>
                    Features: {item.features.map(f => f.name).join(', ') || 'None'}
                  </Text>
                </View>
              )}
            </View>
          );
        }}
        ListFooterComponent={
          <View style={styles.homebrewSection}>
            <View style={styles.homebrewHeader}>
              <Text style={styles.homebrewHeading}>HOMEBREW RACES</Text>
              <Pressable
                style={styles.createNewBtn}
                onPress={() => router.push('/homebrew/race-builder')}
              >
                <Text style={styles.createNewTxt}>+ Create new</Text>
              </Pressable>
            </View>
            {filteredHomebrewRaces.length === 0 ? (
              <Text style={styles.homebrewEmptyText}>No homebrew races yet.</Text>
            ) : (
              filteredHomebrewRaces.map(item => {
                const isOpen = expanded === item.id;
                return (
                  <View key={item.id} style={styles.itemWrap}>
                    <Pressable
                      style={styles.row}
                      onPress={() => router.push(`/creation/race-detail?id=${item.id}`)}
                    >
                      <Text style={styles.rowName}>{item.name}</Text>
                      <View style={styles.homebrewTag}>
                        <Text style={styles.homebrewTagTxt}>Homebrew</Text>
                      </View>
                      <Pressable
                        hitSlop={12}
                        onPress={e => { e.stopPropagation(); setExpanded(isOpen ? null : item.id); }}
                      >
                        <Text style={styles.rowCaret}>{isOpen ? '▲' : '▼'}</Text>
                      </Pressable>
                      <Text style={styles.rowArrow}>›</Text>
                    </Pressable>
                    {isOpen && (
                      <View style={styles.dropdown}>
                        <Text style={styles.dropdownFeatures}>
                          Features: {item.features.map(f => f.name).join(', ') || 'None'}
                        </Text>
                      </View>
                    )}
                  </View>
                );
              })
            )}
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  backBtn:   { paddingHorizontal: Spacing.lg, paddingTop: Spacing.md },
  backBtnText: { fontSize: FontSize.md, color: Colors.gold, fontWeight: FontWeight.bold },
  heading: {
    fontSize: FontSize.xl, fontWeight: FontWeight.black,
    color: Colors.textPrimary, textAlign: 'center',
    paddingTop: Spacing.sm, paddingHorizontal: Spacing.lg,
  },
  divider: { height: 1, backgroundColor: Colors.border, marginVertical: Spacing.md },
  search: {
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    fontSize: FontSize.md, color: Colors.textPrimary,
    marginHorizontal: Spacing.lg, marginBottom: Spacing.sm,
  },
  list: { paddingHorizontal: Spacing.lg },

  itemWrap: { borderBottomWidth: 1, borderBottomColor: Colors.border },
  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: Spacing.md, gap: Spacing.sm,
  },
  rowName:  { fontSize: FontSize.md, color: Colors.textPrimary, flex: 1 },
  rowCaret: { fontSize: FontSize.sm, color: Colors.textDim, paddingHorizontal: 4 },
  rowArrow: { fontSize: FontSize.xl, color: Colors.textDim },

  dropdown: {
    backgroundColor: Colors.surfaceHigh, borderRadius: Radius.md,
    padding: Spacing.md, marginBottom: Spacing.sm,
  },
  dropdownDesc:     { fontSize: FontSize.sm, color: Colors.textSecondary, marginBottom: Spacing.xs, lineHeight: 20 },
  dropdownFeatures: { fontSize: FontSize.sm, color: Colors.textDim },

  homebrewSection: {
    marginTop: Spacing.lg,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  homebrewHeader: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: Spacing.sm,
  },
  homebrewHeading: {
    fontSize: FontSize.xs, fontWeight: FontWeight.bold, color: Colors.textDim,
    letterSpacing: 2,
  },
  createNewBtn: {
    backgroundColor: Colors.gold + '22', borderRadius: Radius.full,
    borderWidth: 1, borderColor: Colors.gold + '66',
    paddingHorizontal: Spacing.sm, paddingVertical: 2,
  },
  createNewTxt: { fontSize: FontSize.xs, color: Colors.gold, fontWeight: FontWeight.bold },
  homebrewEmptyText: { fontSize: FontSize.sm, color: Colors.textDim, fontStyle: 'italic', paddingVertical: Spacing.sm },
  homebrewTag: {
    backgroundColor: Colors.gold + '22', borderRadius: Radius.full,
    borderWidth: 1, borderColor: Colors.gold + '66',
    paddingHorizontal: Spacing.sm, paddingVertical: 2,
  },
  homebrewTagTxt: { fontSize: FontSize.xs, color: Colors.gold, fontWeight: FontWeight.bold },
});
