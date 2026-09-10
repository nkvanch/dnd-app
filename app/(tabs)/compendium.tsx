// app/(tabs)/compendium.tsx
// Item 19 (compendium improvements). Research this session confirmed there
// was no dedicated cross-type content-browsing screen anywhere in the app —
// browsing only ever happened embedded inside creation-flow pickers (scoped
// to one draft character) or the DM's monster-only library
// (app/dm/monsters.tsx) — and conditions specifically had NO browse UI at
// all (docs/NEW architecture/CURRENT_AND_PLANNED.md's own gap list said so
// explicitly). Rather than attempt a shallow pass across all 7 content
// types (spells/items/monsters/feats/races/classes/conditions — each with
// its own async loading story: spellRepo/itemRepo are SQLite-backed,
// getMergedContentDB is synchronous, monsters already has a working browse
// screen), this ships ONE real, complete vertical slice — Conditions, the
// content type with the biggest actual gap — with real search, real
// provenance badges (porting the Homebrew tab's exact Official/Homebrew
// pattern), and a genuinely new mechanism: per-device content favorites,
// which didn't exist for ANY content type before this (favoriteActionIds
// is per-CHARACTER, for action cards on that character's own sheet — a
// different concept). The screen and its data shape are intentionally
// generic (`type: 'condition'`) so adding spells/items/monsters/feats here
// later is a matter of adding sections, not restructuring — a disclosed,
// separate follow-up, not attempted here. "Character-aware info" and
// "related-content navigation" (the spec's other two named sub-asks) are
// also not attempted — both are real, larger features needing their own
// design pass, not a natural extension of this slice.
import { useState, useEffect, useMemo } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, TextInput } from 'react-native';
import { useHomebrewStore } from '../../src/store/homebrewStore';
import { getMeta, setMeta } from '../../src/db/appMetaRepo';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../../src/theme';

const FAVORITES_KEY = 'compendium_favorite_condition_ids';

export default function CompendiumScreen() {
  const getMergedContentDB = useHomebrewStore(s => s.getMergedContentDB);
  const homebrewConditions = useHomebrewStore(s => s.conditions);

  const [search, setSearch] = useState('');
  const [favorites, setFavorites] = useState<string[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Loaded once — mirrors VersionHistoryModal/CharacterHistoryModal's own
  // "fetch on mount, hold in local state" convention for data that isn't
  // kept in any store at rest.
  useEffect(() => {
    getMeta(FAVORITES_KEY).then(raw => {
      if (!raw) return;
      try { setFavorites(JSON.parse(raw)); } catch { /* corrupted/old value — start fresh */ }
    }).catch(e => console.error('[compendium] loading favorites failed:', e));
  }, []);

  function toggleFavorite(id: string) {
    const next = favorites.includes(id) ? favorites.filter(f => f !== id) : [...favorites, id];
    setFavorites(next);
    setMeta(FAVORITES_KEY, JSON.stringify(next)).catch(e => console.error('[compendium] saving favorites failed:', e));
  }

  // homebrewWinsById precedence, same as everywhere else in the app —
  // isOfficial is derived by checking whether the WINNING entry actually
  // came from the homebrew store, exactly mirroring the Homebrew tab's own
  // Library row logic (app/(tabs)/homebrew.tsx) rather than reinventing it.
  const allConditions = getMergedContentDB().conditions;
  const homebrewIds = useMemo(() => new Set(homebrewConditions.map(c => c.id)), [homebrewConditions]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const rows = allConditions.filter(c => !q || c.name.toLowerCase().includes(q) || c.description.toLowerCase().includes(q));
    // Favorited rows float to the top, alphabetical within each group —
    // the whole point of favoriting something in a browse list.
    return [...rows].sort((a, b) => {
      const favA = favorites.includes(a.id), favB = favorites.includes(b.id);
      if (favA !== favB) return favA ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
  }, [allConditions, search, favorites]);

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.title}>Compendium</Text>
        <Text style={styles.subtitle}>Conditions</Text>
      </View>

      <View style={styles.searchWrap}>
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Search conditions…"
          placeholderTextColor={Colors.textDim}
        />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        {filtered.length === 0 ? (
          <Text style={styles.emptyTxt}>No conditions match your search.</Text>
        ) : (
          filtered.map(c => {
            const isOfficial = !homebrewIds.has(c.id);
            const isFavorite = favorites.includes(c.id);
            const expanded = expandedId === c.id;
            return (
              <Pressable key={c.id} style={styles.row} onPress={() => setExpandedId(expanded ? null : c.id)}>
                <View style={styles.rowHeader}>
                  <Text style={styles.rowName}>{c.name}</Text>
                  <View style={styles.rowBadges}>
                    <View style={[styles.provBadge, isOfficial ? styles.provBadgeOfficial : styles.provBadgeHomebrew]}>
                      <Text style={styles.provBadgeTxt}>{isOfficial ? 'Official' : 'Homebrew'}</Text>
                    </View>
                    <Pressable hitSlop={8} onPress={() => toggleFavorite(c.id)}>
                      <Text style={styles.starTxt}>{isFavorite ? '⭐' : '☆'}</Text>
                    </Pressable>
                  </View>
                </View>
                {expanded && (
                  <View style={styles.rowDetail}>
                    <Text style={styles.rowDesc}>{c.description || 'No description.'}</Text>
                    {c.features.length > 0 && (
                      <View style={styles.featureList}>
                        {c.features.map(f => (
                          <Text key={f.id} style={styles.featureTxt}>• {f.name}</Text>
                        ))}
                      </View>
                    )}
                  </View>
                )}
              </Pressable>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bg },
  header: {
    paddingTop: Spacing.xl + 8, paddingBottom: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  title:    { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.gold },
  subtitle: { fontSize: FontSize.xs, color: Colors.textDim, letterSpacing: 2, marginTop: 2 },

  searchWrap: { padding: Spacing.md, paddingBottom: Spacing.sm },
  searchInput: {
    backgroundColor: Colors.surface, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: Spacing.sm, paddingVertical: 8, color: Colors.textPrimary,
  },

  scroll:  { flex: 1 },
  content: { paddingHorizontal: Spacing.md, paddingBottom: Spacing.xxl, gap: Spacing.xs },
  emptyTxt: { color: Colors.textDim, fontSize: FontSize.sm, fontStyle: 'italic', textAlign: 'center', padding: Spacing.lg },

  row: {
    backgroundColor: Colors.surface, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border, padding: Spacing.sm,
  },
  rowHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rowName:   { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.textPrimary, textTransform: 'capitalize' },
  rowBadges: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  provBadge: { borderRadius: Radius.sm, borderWidth: 1, paddingHorizontal: 6, paddingVertical: 2 },
  provBadgeOfficial: { backgroundColor: Colors.surfaceHigh, borderColor: Colors.border },
  provBadgeHomebrew: { backgroundColor: Colors.gold + '22', borderColor: Colors.gold + '66' },
  provBadgeTxt: { fontSize: FontSize.xs, color: Colors.textSecondary, fontWeight: FontWeight.bold },
  starTxt: { fontSize: FontSize.lg },

  rowDetail: { marginTop: Spacing.xs, paddingTop: Spacing.xs, borderTopWidth: 1, borderTopColor: Colors.border, gap: 4 },
  rowDesc:   { fontSize: FontSize.sm, color: Colors.textSecondary },
  featureList: { gap: 2, marginTop: 2 },
  featureTxt:  { fontSize: FontSize.xs, color: Colors.textDim },
});
