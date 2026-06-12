// app/creation/class.tsx
// Class list — tap row to navigate to detail, chevron to expand description.
import { View, Text, FlatList, Pressable, StyleSheet, TextInput } from 'react-native';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { globalContentDB } from '../../src/content/classes/library';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../../src/theme';

const CASTER_TYPE: Record<string, string> = {
  barbarian: 'Martial',
  bard:      'Full Caster',
  cleric:    'Full Caster',
  druid:     'Full Caster',
  fighter:   'Martial',
  monk:      'Martial',
  paladin:   'Half Caster',
  ranger:    'Half Caster',
  rogue:     'Martial',
  sorcerer:  'Full Caster',
  warlock:   'Half Caster',
  wizard:    'Full Caster',
};

const CLASS_DESCRIPTIONS: Record<string, string> = {
  barbarian: 'A fierce warrior who can enter a battle rage to deal devastating damage and shrug off attacks. STR-based martial combatant. Hit Die: d12.',
  bard:      'An inspiring spellcaster who weaves magic through music and words. Skills, buffs, and versatile spells. Hit Die: d8.',
  cleric:    'A priestly champion who wields divine magic. Powerful healer with heavy-armor proficiency and a deity-based subclass. Hit Die: d8.',
  druid:     'A nature priest who can Wild Shape into beasts and wield nature-themed spells. Highly versatile. Hit Die: d8.',
  fighter:   'A master of martial combat skilled with all weapons and armor. Action Surge and multiple attacks make fighters powerful damage dealers. Hit Die: d10.',
  monk:      'A martial artist who channels ki energy for speed, stunning strikes, and wall-running. Unarmored agility. Hit Die: d8.',
  paladin:   'A holy warrior bound to a sacred oath. Divine Smite delivers burst damage; lay on hands provides healing. Hit Die: d10.',
  ranger:    'A wilderness warrior with a favored enemy and natural explorer features. Mix of martial prowess and spellcasting. Hit Die: d10.',
  rogue:     'A stealthy trickster who deals Sneak Attack damage and excels at skills. Cunning Action grants bonus-action mobility. Hit Die: d8.',
  sorcerer:  'An innate spellcaster powered by bloodline magic. Metamagic lets you shape spells in unique ways. Fewer spell slots than wizard. Hit Die: d6.',
  warlock:   'A pact-magic spellcaster empowered by a patron. Short-rest spell slot recharge, Eldritch Invocations, and flexible Pact Boon. Hit Die: d8.',
  wizard:    'A scholarly spellcaster with the broadest spell list in the game. Arcane Recovery and spellbook give unmatched flexibility. Hit Die: d6.',
};

export default function ClassScreen() {
  const router  = useRouter();
  const [search,   setSearch]   = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);

  const classes = globalContentDB.classes.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <View style={styles.container}>

      <Text style={styles.heading}>Select Class</Text>
      <View style={styles.divider} />

      <TextInput
        style={styles.search}
        placeholder="Search"
        placeholderTextColor={Colors.textDim}
        value={search}
        onChangeText={setSearch}
      />

      <FlatList
        data={classes}
        keyExtractor={c => c.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => {
          const isOpen    = expanded === item.id;
          const desc      = CLASS_DESCRIPTIONS[item.id];
          const casterType = CASTER_TYPE[item.id] ?? 'Martial';
          return (
            <View style={styles.itemWrap}>
              {/* Primary tap → navigate to detail. Chevron tap → expand description. */}
              <Pressable
                style={styles.row}
                onPress={() => router.push(`/creation/class-detail?id=${item.id}`)}
              >
                <View style={styles.rowInfo}>
                  <Text style={styles.rowName}>{item.name}</Text>
                  <Text style={styles.rowSub}>{casterType} · d{item.hitDie}</Text>
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
                  {desc && <Text style={styles.dropdownDesc}>{desc}</Text>}
                </View>
              )}
            </View>
          );
        }}
        ListFooterComponent={
          <Pressable style={styles.homebrewRow} onPress={() => {}}>
            <Text style={styles.homebrewText}>Homebrew Classes</Text>
            <Text style={styles.rowArrow}>›</Text>
          </Pressable>
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
  rowInfo:  { flex: 1 },
  rowName:  { fontSize: FontSize.md, color: Colors.textPrimary },
  rowSub:   { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 2 },
  rowCaret: { fontSize: FontSize.sm, color: Colors.textDim, paddingHorizontal: 4 },
  rowArrow: { fontSize: FontSize.xl, color: Colors.textDim },

  dropdown: {
    backgroundColor: Colors.surfaceHigh, borderRadius: Radius.md,
    padding: Spacing.md, marginBottom: Spacing.sm,
  },
  dropdownDesc: { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 20 },

  homebrewRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: Spacing.md, marginTop: Spacing.sm,
  },
  homebrewText: { fontSize: FontSize.md, color: Colors.gold, fontWeight: FontWeight.bold },
});
