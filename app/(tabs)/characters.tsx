// app/(tabs)/characters.tsx
// Character list — all saved characters. Tap to open sheet. Long press to delete.
import { useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useCharacterStore } from '../../src/store/characterStore';
import { Entity } from '../../src/engine/types';
import { LoadingScreen } from '../../src/components/LoadingScreen';
import { EmptyState }    from '../../src/components/EmptyState';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../../src/theme';

function CharacterCard({
  character, onPress, onLongPress,
}: {
  character: Entity; onPress: () => void; onLongPress: () => void;
}) {
  const { identity, resources, derived } = character;
  const hpPercent = resources.hp.maximum > 0
    ? resources.hp.current / resources.hp.maximum
    : 1;
  const hpColor = hpPercent > 0.5 ? Colors.green : hpPercent > 0.25 ? Colors.gold : Colors.red;

  return (
    <Pressable style={styles.card} onPress={onPress} onLongPress={onLongPress}>
      <View style={styles.cardMain}>
        <Text style={styles.cardName}>{identity.name || 'Unnamed'}</Text>
        <Text style={styles.cardSub}>
          Level {identity.level}  ·  {identity.classId || '—'}  ·  {identity.raceId || '—'}
        </Text>

        <View style={styles.hpRow}>
          <View style={styles.hpBarOuter}>
            <View style={[styles.hpBarFill, {
              width: `${Math.round(Math.max(0, Math.min(1, hpPercent)) * 100)}%` as any,
              backgroundColor: hpColor,
            }]} />
          </View>
          <Text style={styles.hpText}>{resources.hp.current}/{resources.hp.maximum} HP</Text>
        </View>
      </View>

      <View style={styles.cardBadges}>
        <View style={styles.badge}>
          <Text style={styles.badgeLabel}>AC</Text>
          <Text style={styles.badgeValue}>{derived.ac}</Text>
        </View>
        <View style={styles.badge}>
          <Text style={styles.badgeLabel}>Spd</Text>
          <Text style={styles.badgeValue}>{derived.speed}</Text>
        </View>
      </View>
    </Pressable>
  );
}

export default function CharactersScreen() {
  const router          = useRouter();
  const characters      = useCharacterStore(s => s.characters);
  const deleteCharacter = useCharacterStore(s => s.deleteCharacter);
  const isLoading       = useCharacterStore(s => s.isLoading);

  const openSheet = useCallback((id: string) => {
    router.push(`/sheet/${id}` as any);
  }, [router]);

  const startCreation = useCallback(() => {
    router.push('/creation/name');
  }, [router]);

  const handleLongPress = useCallback((character: Entity) => {
    Alert.alert(
      `Delete "${character.identity.name || 'Unnamed'}"?`,
      'This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => deleteCharacter(character.id),
        },
      ]
    );
  }, [deleteCharacter]);

  if (isLoading) return <LoadingScreen message="Loading characters…" />;

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.title}>Characters</Text>
        <View style={styles.headerActions}>
          <Pressable style={styles.settingsBtn} onPress={() => router.push('/settings' as any)}>
            <Text style={styles.settingsBtnText}>⚙️</Text>
          </Pressable>
          <Pressable style={styles.newBtn} onPress={startCreation}>
            <Text style={styles.newBtnText}>+ New</Text>
          </Pressable>
        </View>
      </View>

      {characters.length === 0 ? (
        <EmptyState
          icon="👤"
          title="No characters yet"
          subtitle='Tap "+ New" to begin your adventure'
          actionLabel="+ Create Character"
          onAction={startCreation}
        />
      ) : (
        <FlatList
          data={characters}
          keyExtractor={c => c.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <CharacterCard
              character={item}
              onPress={() => openSheet(item.id)}
              onLongPress={() => handleLongPress(item)}
            />
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bg },

  header: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    paddingHorizontal: Spacing.md,
    paddingTop:        Spacing.xl + 8,
    paddingBottom:     Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  title:      { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.gold },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  settingsBtn:     { padding: Spacing.sm },
  settingsBtnText: { fontSize: 20 },
  newBtn: {
    backgroundColor: Colors.gold,
    paddingHorizontal: Spacing.md,
    paddingVertical:   Spacing.sm,
    borderRadius:      Radius.md,
  },
  newBtnText: { color: Colors.bg, fontWeight: FontWeight.bold, fontSize: FontSize.md },

  list: { padding: Spacing.md, gap: Spacing.sm },

  card: {
    backgroundColor: Colors.surface,
    borderRadius:    Radius.lg,
    borderWidth:     1,
    borderColor:     Colors.border,
    padding:         Spacing.md,
    flexDirection:   'row',
    alignItems:      'center',
    gap:             Spacing.md,
  },
  cardMain: { flex: 1, gap: 4 },
  cardName: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  cardSub:  { fontSize: FontSize.sm, color: Colors.textSecondary },

  hpRow:    { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginTop: 4 },
  hpBarOuter: {
    flex: 1, height: 4, backgroundColor: Colors.border,
    borderRadius: Radius.full, overflow: 'hidden',
  },
  hpBarFill: { height: '100%', borderRadius: Radius.full },
  hpText:    { fontSize: FontSize.xs, color: Colors.textSecondary },

  cardBadges: { gap: Spacing.xs },
  badge: {
    backgroundColor: Colors.surfaceHigh,
    borderRadius:    Radius.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical:   2,
    alignItems:      'center',
    minWidth:        44,
  },
  badgeLabel: { fontSize: FontSize.xs, color: Colors.textSecondary },
  badgeValue: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.textPrimary },

  empty: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    gap: Spacing.sm, padding: Spacing.xl,
  },
  emptyIcon:  { fontSize: 64 },
  emptyTitle: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  emptySub:   { fontSize: FontSize.md, color: Colors.textSecondary, textAlign: 'center' },
  emptyBtn: {
    marginTop:       Spacing.md,
    backgroundColor: Colors.gold,
    borderRadius:    Radius.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical:   Spacing.md,
  },
  emptyBtnText: { color: Colors.bg, fontWeight: FontWeight.bold, fontSize: FontSize.md },
});
