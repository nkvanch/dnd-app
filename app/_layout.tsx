// app/_layout.tsx
// Root layout — initializes SQLite DB + loads characters + hydrates session
// on startup, then renders the navigation stack.
import { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { Colors } from '../src/theme';
import { ErrorBoundary } from '../src/components/ErrorBoundary';
import { initDb } from '../src/db/db';
import { useCharacterStore } from '../src/store/characterStore';
import { useSessionStore }   from '../src/store/sessionStore';
import { useHomebrewStore }  from '../src/store/homebrewStore';
import { syncManager }       from '../src/sync/syncManager';
import { useSyncStore }      from '../src/store/syncStore';
import { useCombatStore }    from '../src/store/combatStore';
import { loadCombatState }   from '../src/db/combatRepo';

function BootScreen() {
  return (
    <View style={styles.boot}>
      <ActivityIndicator size="large" color={Colors.gold} />
      <Text style={styles.bootTxt}>Loading…</Text>
    </View>
  );
}

export default function RootLayout() {
  const [dbReady, setDbReady] = useState(false);

  const loadCharacters = useCharacterStore(s => s.loadCharacters);
  const initSession    = useSessionStore(s => s.initSession);
  const loadHomebrew   = useHomebrewStore(s => s.loadHomebrew);

  useEffect(() => {
    async function boot() {
      try {
        // 1. Open / migrate the database (idempotent)
        await initDb();
        // 2. Hydrate stores from SQLite — run in parallel
        //    loadHomebrew merges built-in homebrew (Abyss Knight, Skeleton)
        //    directly from BUILTIN_HOMEBREW — no separate seeding step needed.
        await Promise.all([
          loadCharacters(),
          initSession(),
          loadHomebrew(),
        ]);
        // 3. One-time migration: patch characters created before engine fixes.
        //    (a) Abyss Knight: ensure light/medium/heavy/shield + simple/martial profs
        //        (the progression has a proficiency grant at level 1 but the existing
        //        character may have been created before it was added).
        //    (b) Skeleton's Doomed Touch grants chill touch — add it to knownSpellIds
        //        for any character with the Skeleton race OR the feature in their list.
        //        Also handles the slot count fix for Abyss Knight at level 2 (old
        //        table gave 1 slot; correct is 2).
        //    All checks are idempotent so they never corrupt already-fixed saves.
        const { characters, updateCharacter } = useCharacterStore.getState();
        for (const char of characters) {
          // (a) Abyss Knight proficiencies
          if (char.identity.classId === 'abyss_knight') {
            const hasAllArmor = ['light','medium','heavy','shield'].every(
              p => char.proficiencies.armor.includes(p)
            );
            const hasAllWeapons = ['simple','martial'].every(
              p => char.proficiencies.weapons.includes(p)
            );
            if (!hasAllArmor || !hasAllWeapons) {
              updateCharacter(char.id, e => ({
                ...e,
                proficiencies: {
                  ...e.proficiencies,
                  armor:   [...new Set([...e.proficiencies.armor,   'light','medium','heavy','shield'])],
                  weapons: [...new Set([...e.proficiencies.weapons, 'simple','martial'])],
                },
              }));
            }
          }

          // (a-2) Abyss Knight level-2 slot count (1 → 2)
          if (
            char.identity.classId === 'abyss_knight' &&
            char.identity.level   === 2 &&
            char.spellcasting     !== null &&
            (char.spellcasting?.slots['1']?.total ?? 0) < 2
          ) {
            updateCharacter(char.id, e => ({
              ...e,
              spellcasting: {
                ...e.spellcasting!,
                slots: {
                  ...e.spellcasting!.slots,
                  '1': { total: 2, used: e.spellcasting!.slots['1']?.used ?? 0 },
                },
              },
            }));
          }

          // (b) Chill touch for Skeleton race characters
          const isSkeleton =
            char.identity.raceId    === 'skeleton' ||
            char.identity.subRaceId === 'skeleton_giant' ||
            char.features.some(f => f.id === 'skeleton_doomed_touch');

          if (isSkeleton && char.spellcasting) {   // truthy — catches both null and undefined
            const knownCantrips = char.spellcasting.cantrips ?? [];
            const missing = ['chill_touch', 'magic_stone']
              .filter(id => !knownCantrips.includes(id));
            if (missing.length > 0) {
              updateCharacter(char.id, e => ({
                ...e,
                spellcasting: e.spellcasting ? {
                  ...e.spellcasting,
                  cantrips: [...new Set([...e.spellcasting.cantrips, ...missing])],
                } : e.spellcasting,
              }));
            }
          }

          // (c) Abyss Knight DM-granted abilities:
          //     • Poison healing half damage (passive feature)
          //     • Abyssal Claim construct cantrip
          if (char.identity.classId === 'abyss_knight') {
            const hasHealPoison  = char.features.some(f => f.id === 'dm_poison_heal');
            const hasAbyssalClaim = (char.spellcasting?.cantrips ?? []).includes('abyssal_claim');

            if (!hasHealPoison) {
              updateCharacter(char.id, e => ({
                ...e,
                features: [...e.features, {
                  id: 'dm_poison_heal',
                  name: 'Poisonous Adaptation (DM Gift)',
                  description:
                    'Your abyssal corruption has made you partially immune to poisons. ' +
                    'When you take poison damage, you heal hit points equal to half the ' +
                    'poison damage dealt (rounded down, minimum 1). ' +
                    'Apply this manually: after taking poison damage, use the Heal control ' +
                    'to add half the damage amount back to your HP.',
                  source: { kind: 'class', refId: 'abyss_knight' },
                  level: char.identity.level,
                  effects: [],
                  actions: [], choices: [], passive: true, isActive: true,
                }],
              }));
            }

            if (!hasAbyssalClaim && char.spellcasting) {
              updateCharacter(char.id, e => ({
                ...e,
                spellcasting: e.spellcasting ? {
                  ...e.spellcasting,
                  cantrips: [...new Set([...e.spellcasting.cantrips, 'abyssal_claim'])],
                } : e.spellcasting,
              }));
            }
          }
        }
        loadCombatState().then(state => {
          if (state?.active) {
            useCombatStore.setState({ combat: state });
          }
        }).catch(() => { /* non-critical */ });

        // 4. Wire up the sync manager — must run after stores are hydrated
        const { applyIncomingEntity } = useCharacterStore.getState();
        const { setStatus }           = useSyncStore.getState();

        syncManager.initialise({
          onStatusChange: (status) => {
            setStatus(status);
          },
          onEntityReceived: (entity) => {
            applyIncomingEntity(entity);
          },
          onSyncEvent: (event) => {
            // DM responds to entity_full_sync requests from players
            if (event.changeType === 'entity_full_sync' && event.payload === null) {
              const entity = useCharacterStore.getState().characters
                .find(c => c.id === event.entityId);
              if (entity) syncManager.broadcastEntity(entity);
            }
          },
        });
      } catch (e) {
        console.error('[_layout] Boot sequence failed:', e);
      } finally {
        setDbReady(true);
      }
    }
    boot();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!dbReady) return <BootScreen />;

  return (
    <ErrorBoundary>
    <View style={styles.root}>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle:      { backgroundColor: Colors.surfaceHigh },
          headerTintColor:  Colors.gold,
          headerTitleStyle: { color: Colors.textPrimary, fontWeight: '700' },
          contentStyle:     { backgroundColor: Colors.bg },
          animation:        'slide_from_right',
        }}
      >
        <Stack.Screen name="(tabs)"              options={{ headerShown: false }} />
        <Stack.Screen name="creation"            options={{ headerShown: false }} />
        <Stack.Screen name="sheet/[id]"          options={{ headerShown: false }} />
        <Stack.Screen name="dm/dashboard"        options={{ headerShown: false }} />
        <Stack.Screen name="dm/encounter"        options={{ headerShown: false }} />
        <Stack.Screen name="dm/monsters"                  options={{ headerShown: false }} />
        <Stack.Screen name="dm/character/[id]"           options={{ headerShown: false }} />
        <Stack.Screen name="homebrew/import-review"      options={{ headerShown: false }} />
        <Stack.Screen name="homebrew/spell-builder"      options={{ headerShown: false }} />
        <Stack.Screen name="homebrew/class-builder"      options={{ headerShown: false }} />
        <Stack.Screen name="homebrew/race-builder"       options={{ headerShown: false }} />
        <Stack.Screen name="homebrew/feature-editor"     options={{ headerShown: false }} />
        <Stack.Screen name="settings"                      options={{ headerShown: false }} />
      </Stack>
    </View>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },
  boot: {
    flex: 1, backgroundColor: Colors.bg,
    alignItems: 'center', justifyContent: 'center', gap: 12,
  },
  bootTxt: { color: Colors.textSecondary, fontSize: 14 },
});
