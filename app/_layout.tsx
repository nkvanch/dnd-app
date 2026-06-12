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
        await Promise.all([
          loadCharacters(),
          initSession(),
          loadHomebrew(),
        ]);
        // 3. Restore combat state if a combat was active before the app was killed
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
