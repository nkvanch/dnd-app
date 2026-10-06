// app/rules-reference.tsx
// Rules Reference: the SRD 5.2.1 glossary, gameplay toolbox and equipment rules from the installed content pack. Search, three
// sections, tap an entry to read it. Reference text only. Without the pack installed there is nothing to show, so the screen says so.
import { useMemo, useState } from 'react';
import { View, Text, Pressable, TextInput, FlatList, StyleSheet } from 'react-native';
import { useSafeGoBack } from '../src/hooks/useSafeGoBack';
import { useOfficialContentVersion } from '../src/hooks/useOfficialContentVersion';
import { installedRulesReferences, searchReference, REFERENCE_SECTIONS, ReferenceSection, RuleEntry } from '../src/content/rules/rulesReference';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../src/theme';

export default function RulesReferenceScreen() {
  const goBack = useSafeGoBack('/(tabs)/compendium');
  useOfficialContentVersion();   // re-render when a pack is installed or removed
  const references = installedRulesReferences();
  const [section, setSection] = useState<ReferenceSection>('glossary');
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState<string | null>(null);

  const entries = useMemo<RuleEntry[]>(
    () => searchReference(references.flatMap(r => r.reference[section]), query),
    [references, section, query],
  );

  return (
    <View style={styles.screen}>
      <View style={styles.headerRow}>
        <Pressable onPress={goBack} accessibilityLabel="Back"><Text style={styles.back}>← Back</Text></Pressable>
        <Text style={styles.title}>Rules Reference</Text>
        <View style={{ width: 60 }} />
      </View>

      {references.length === 0 ? (
        <View style={styles.empty} testID="rules-reference-empty">
          <Text style={styles.emptyTitle}>No rules reference installed</Text>
          <Text style={styles.emptyBody}>The SRD 5.2.1 content pack carries the 2024 rules glossary, gameplay toolbox and equipment rules. Install it from Compendium → Packages.</Text>
        </View>
      ) : (
        <>
          <View style={styles.tabs}>
            {REFERENCE_SECTIONS.map(s => (
              <Pressable key={s.key} style={[styles.tab, section === s.key && styles.tabOn]} onPress={() => { setSection(s.key); setOpen(null); }}
                accessibilityState={{ selected: section === s.key }} testID={`rules-tab-${s.key}`}>
                <Text style={[styles.tabTxt, section === s.key && styles.tabTxtOn]}>{s.label}</Text>
              </Pressable>
            ))}
          </View>
          <TextInput style={styles.search} value={query} onChangeText={setQuery} placeholder="Search rules…" placeholderTextColor={Colors.textDim}
            autoCorrect={false} autoCapitalize="none" testID="rules-search" />
          <Text style={styles.count}>{entries.length} {entries.length === 1 ? 'entry' : 'entries'} · {references.map(r => r.packName).join(', ')}</Text>
          <FlatList
            data={entries}
            keyExtractor={e => e.id}
            contentContainerStyle={{ paddingBottom: Spacing.xl }}
            ListEmptyComponent={<Text style={styles.emptyBody}>Nothing matches “{query}”.</Text>}
            renderItem={({ item }) => {
              const expanded = open === item.id;
              return (
                <Pressable style={styles.card} onPress={() => setOpen(expanded ? null : item.id)} accessibilityState={{ expanded }} testID={`rule-${item.id}`}>
                  <View style={styles.cardHead}>
                    <Text style={styles.cardName}>{item.name}</Text>
                    {item.tag ? <Text style={styles.tag}>{item.tag}</Text> : null}
                  </View>
                  <Text style={styles.cardText} numberOfLines={expanded ? undefined : 2}>{item.text}</Text>
                </Pressable>
              );
            }}
          />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bg, padding: Spacing.md, paddingTop: Spacing.xl + 8 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.sm },
  back: { color: Colors.gold, fontSize: FontSize.md, width: 60 },
  title: { color: Colors.gold, fontSize: FontSize.xl, fontWeight: FontWeight.black },
  tabs: { flexDirection: 'row', gap: Spacing.xs, marginBottom: Spacing.sm },
  tab: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface },
  tabOn: { borderColor: Colors.gold, backgroundColor: Colors.gold + '22' },
  tabTxt: { color: Colors.textSecondary, fontWeight: FontWeight.bold },
  tabTxtOn: { color: Colors.gold },
  search: { backgroundColor: Colors.surface, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, color: Colors.textPrimary, padding: Spacing.sm, marginBottom: Spacing.xs },
  count: { color: Colors.textDim, fontSize: FontSize.xs, marginBottom: Spacing.xs },
  card: { backgroundColor: Colors.surface, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, padding: Spacing.sm, marginBottom: Spacing.xs, gap: 4 },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  cardName: { color: Colors.textPrimary, fontSize: FontSize.md, fontWeight: FontWeight.bold, flexShrink: 1 },
  tag: { color: Colors.gold, fontSize: FontSize.xs, borderWidth: 1, borderColor: Colors.gold + '88', borderRadius: Radius.sm, paddingHorizontal: 6, paddingVertical: 1 },
  cardText: { color: Colors.textSecondary, fontSize: FontSize.sm },
  empty: { padding: Spacing.lg, gap: Spacing.sm },
  emptyTitle: { color: Colors.gold, fontSize: FontSize.lg, fontWeight: FontWeight.bold },
  emptyBody: { color: Colors.textSecondary, fontSize: FontSize.sm },
});
