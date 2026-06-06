// app/(tabs)/homebrew.tsx
// Homebrew tab — Import, Create, Library sections.
import { useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, TextInput, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useHomebrewStore } from '../../src/store/homebrewStore';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../../src/theme';

// ── Import Panel ──────────────────────────────────────────────────────────────

function ImportPanel() {
  const router = useRouter();
  const [url,  setUrl]  = useState('');
  const [text, setText] = useState('');
  const [tab,  setTab]  = useState<'url' | 'text'>('url');

  return (
    <View style={styles.panel}>
      <Text style={styles.panelTitle}>📥 Import</Text>
      <Text style={styles.panelSub}>
        Paste a D&D Wiki URL or raw text — Claude will parse it into a structured content item.
      </Text>

      <View style={styles.segmented}>
        {(['url', 'text'] as const).map(t => (
          <Pressable
            key={t}
            style={[styles.segBtn, tab === t && styles.segBtnActive]}
            onPress={() => setTab(t)}
          >
            <Text style={[styles.segTxt, tab === t && styles.segTxtActive]}>
              {t === 'url' ? '🔗 From URL' : '📋 From Text'}
            </Text>
          </Pressable>
        ))}
      </View>

      {tab === 'url' ? (
        <TextInput
          style={styles.input}
          value={url}
          onChangeText={setUrl}
          placeholder="https://www.dandwiki.com/wiki/..."
          placeholderTextColor={Colors.textDim}
          autoCapitalize="none"
          keyboardType="url"
        />
      ) : (
        <TextInput
          style={[styles.input, styles.textArea]}
          value={text}
          onChangeText={setText}
          placeholder="Paste D&D content here — race, class, spell, or feature…"
          placeholderTextColor={Colors.textDim}
          multiline
          textAlignVertical="top"
        />
      )}

      <Pressable
        style={[
          styles.importBtn,
          (tab === 'url' ? !url.trim() : !text.trim()) && styles.btnDisabled,
        ]}
        onPress={() => {
          const payload = tab === 'url' ? url.trim() : text.trim();
          if (!payload) return;
          router.push({
            pathname: '/homebrew/import-review',
            params: { mode: tab, payload },
          } as any);
        }}
        disabled={tab === 'url' ? !url.trim() : !text.trim()}
      >
        <Text style={styles.importBtnTxt}>Parse with Claude →</Text>
      </Pressable>
    </View>
  );
}

// ── Create Panel ──────────────────────────────────────────────────────────────

function CreatePanel() {
  const router = useRouter();
  const ITEMS = [
    { label: '⚔️  New Race',        route: '/homebrew/race-builder'  },
    { label: '🎓  New Class',        route: '/homebrew/class-builder' },
    { label: '✨  New Spell',        route: '/homebrew/spell-builder' },
    { label: '📖  New Feature',      route: '/homebrew/feature-editor' },
    { label: '🧙  New Background',   route: '/homebrew/race-builder'  },
  ];

  return (
    <View style={styles.panel}>
      <Text style={styles.panelTitle}>🛠 Create</Text>
      <Text style={styles.panelSub}>Build custom content from scratch using the guided editors.</Text>
      <View style={styles.createGrid}>
        {ITEMS.map(item => (
          <Pressable
            key={item.route + item.label}
            style={styles.createBtn}
            onPress={() => router.push(item.route as any)}
          >
            <Text style={styles.createBtnTxt}>{item.label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

// ── Library Panel ─────────────────────────────────────────────────────────────

function LibraryPanel() {
  const { races, classes, spells, backgrounds, features, deleteItem } = useHomebrewStore();
  const router = useRouter();

  const all = [
    ...races.map(r       => ({ type: 'race'       as const, item: r })),
    ...classes.map(c     => ({ type: 'class'      as const, item: c })),
    ...spells.map(s      => ({ type: 'spell'      as const, item: s })),
    ...backgrounds.map(b => ({ type: 'background' as const, item: b })),
    ...features.map(f    => ({ type: 'feature'    as const, item: f })),
  ];

  if (all.length === 0) {
    return (
      <View style={styles.panel}>
        <Text style={styles.panelTitle}>📚 Library</Text>
        <Text style={styles.emptyTxt}>No homebrew content saved yet. Import or create something above.</Text>
      </View>
    );
  }

  return (
    <View style={styles.panel}>
      <Text style={styles.panelTitle}>📚 Library ({all.length})</Text>
      {all.map(({ type, item }) => (
        <View key={`${type}:${item.id}`} style={styles.libraryRow}>
          <View style={styles.libraryInfo}>
            <Text style={styles.libraryName}>{item.name}</Text>
            <View style={[styles.typeBadge, styles[`typeBadge_${type}`] ?? {}]}>
              <Text style={styles.typeBadgeTxt}>{type}</Text>
            </View>
          </View>
          <View style={styles.libraryActions}>
            <Pressable
              style={styles.libBtn}
              onPress={() => {
                Alert.alert('Delete', `Delete "${item.name}"?`, [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Delete', style: 'destructive', onPress: () => deleteItem(type, item.id) },
                ]);
              }}
            >
              <Text style={styles.libBtnTxt}>🗑</Text>
            </Pressable>
          </View>
        </View>
      ))}
    </View>
  );
}

// ── Homebrew Screen ───────────────────────────────────────────────────────────

export default function HomebrewScreen() {
  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.title}>Homebrew</Text>
      </View>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <ImportPanel />
        <CreatePanel />
        <LibraryPanel />
      </ScrollView>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bg },
  header: {
    paddingTop: Spacing.xl + 8, paddingBottom: Spacing.md,
    paddingHorizontal: Spacing.md,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  title:  { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.gold },
  scroll: { flex: 1 },
  content:{ padding: Spacing.md, gap: Spacing.md, paddingBottom: Spacing.xxl },

  panel: {
    backgroundColor: Colors.surface, borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.border,
    padding: Spacing.md, gap: Spacing.sm,
  },
  panelTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  panelSub:   { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 20 },

  segmented:  { flexDirection: 'row', gap: Spacing.xs },
  segBtn: {
    flex: 1, backgroundColor: Colors.surfaceHigh, borderRadius: Radius.md,
    padding: Spacing.sm, alignItems: 'center',
    borderWidth: 1, borderColor: Colors.border,
  },
  segBtnActive: { borderColor: Colors.gold, backgroundColor: Colors.gold + '22' },
  segTxt:       { fontSize: FontSize.sm, color: Colors.textSecondary },
  segTxtActive: { color: Colors.gold, fontWeight: FontWeight.bold },

  input: {
    backgroundColor: Colors.surfaceHigh, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border,
    padding: Spacing.sm, color: Colors.textPrimary, fontSize: FontSize.sm,
  },
  textArea: { minHeight: 100, textAlignVertical: 'top' },

  importBtn: {
    backgroundColor: Colors.gold, borderRadius: Radius.md,
    padding: Spacing.md, alignItems: 'center',
  },
  btnDisabled:   { opacity: 0.4 },
  importBtnTxt:  { color: Colors.bg, fontWeight: FontWeight.bold, fontSize: FontSize.md },

  createGrid: { gap: Spacing.xs },
  createBtn: {
    backgroundColor: Colors.surfaceHigh, borderRadius: Radius.md,
    padding: Spacing.md, borderWidth: 1, borderColor: Colors.border,
  },
  createBtnTxt: { fontSize: FontSize.md, color: Colors.textPrimary },

  libraryRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    paddingVertical: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  libraryInfo:    { flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  libraryName:    { fontSize: FontSize.md, color: Colors.textPrimary, fontWeight: FontWeight.bold, flex: 1 },
  typeBadge:      { backgroundColor: Colors.surfaceHigh, borderRadius: Radius.sm, paddingHorizontal: 6, paddingVertical: 2 },
  typeBadgeTxt:   { fontSize: FontSize.xs, color: Colors.textDim },
  typeBadge_race:       { backgroundColor: Colors.green  + '22' },
  typeBadge_class:      { backgroundColor: Colors.gold   + '22' },
  typeBadge_spell:      { backgroundColor: Colors.blue   + '22' },
  typeBadge_background: { backgroundColor: Colors.purple + '22' },
  typeBadge_feature:    { backgroundColor: Colors.surfaceHigh },
  libraryActions: { flexDirection: 'row', gap: Spacing.xs },
  libBtn: {
    backgroundColor: Colors.surfaceHigh, borderRadius: Radius.sm,
    padding: Spacing.xs, borderWidth: 1, borderColor: Colors.border,
  },
  libBtnTxt:  { fontSize: FontSize.md },
  emptyTxt:   { color: Colors.textDim, fontStyle: 'italic', fontSize: FontSize.sm },
});
