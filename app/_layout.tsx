// app/_layout.tsx
// Root layout — initializes SQLite DB + loads characters + hydrates session
// on startup, then renders the navigation stack.
import { useEffect, useState } from 'react';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useKeepAwake } from 'expo-keep-awake';
import { View, Text, StyleSheet, ActivityIndicator, AppState } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Colors } from '../src/theme';
import { ErrorBoundary } from '../src/components/ErrorBoundary';
import { initDb } from '../src/db/db';
import { initContentDb } from '../src/db/contentDb';
import { spellRepo } from '../src/content/spellRepo';
import { itemRepo } from '../src/content/itemRepo';
import { getMeta } from '../src/db/appMetaRepo';
import { useCharacterStore } from '../src/store/characterStore';
import { useSessionStore }   from '../src/store/sessionStore';
import { useCampaignStore }  from '../src/store/campaignStore';
import { useEncounterStore } from '../src/store/encounterStore';
import { useHomebrewStore }  from '../src/store/homebrewStore';
import { syncManager }       from '../src/sync/syncManager';
import { useSyncStore }      from '../src/store/syncStore';
import { useCombatTurnStore } from '../src/store/combatTurnStore';
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
  // Keeps the screen from auto-locking while Grimoire is open — same
  // "stays on at the table" behavior as a video/game app, requested since
  // a character sheet needs to stay visible during a session without
  // constantly re-waking the device. Released automatically when the app
  // backgrounds/unmounts; no manual deactivate call needed.
  useKeepAwake();

  const [dbReady, setDbReady] = useState(false);
  const router = useRouter();

  const loadCharacters = useCharacterStore(s => s.loadCharacters);
  const initSession    = useSessionStore(s => s.initSession);
  const loadHomebrew   = useHomebrewStore(s => s.loadHomebrew);

  useEffect(() => {
    // Each step below is isolated in its own try/catch and degrades
    // gracefully on failure instead of aborting every step after it — the
    // same pattern homebrewStore.loadHomebrew() already uses internally.
    // A hiccup in, say, the content DB must not cost the player their whole
    // character list: a character should still open (possibly with missing
    // spell/item data) rather than the app showing "no characters" because
    // an unrelated step upstream threw.
    async function boot() {
      try {
        // 1. Open / migrate the character database (idempotent). Nothing
        //    downstream can do much without this, but a throw here still
        //    shouldn't prevent the content DB / homebrew / sync steps from
        //    at least attempting to run.
        try {
          await initDb();
        } catch (e) {
          console.error('[_layout] initDb failed — character storage unavailable this session:', e);
        }

        // 2. Open the static-content DB (spells + items, seeded from a
        //    bundled asset on first launch — see src/db/contentDb.ts) and
        //    build the Tier-1 indexes. Normally finishes before
        //    loadCharacters(), which warms Tier-2 for every loaded
        //    character's known spells and equipped/carried items — but a
        //    failure here degrades to an empty spell/item index (spellRepo/
        //    itemRepo.native.ts already catch their own SQLite/JSON errors)
        //    rather than blocking characters from loading at all.
        try {
          await initContentDb();
          await Promise.all([spellRepo.init(), itemRepo.init()]);
        } catch (e) {
          console.error('[_layout] Content DB (spells/items) init failed — spells/items unavailable this session:', e);
        }

        // 3. Hydrate homebrew. loadHomebrew() already catches its own
        //    errors internally and never rethrows (see homebrewStore.ts),
        //    so no try/catch is needed here — it's called directly so
        //    loadCharacters() below still waits for it to resolve (or
        //    degrade) first, same ordering rationale as before: it
        //    synchronously re-hydrates every equipped/carried item's
        //    features, which falls back to homebrewStore for any item
        //    itemRepo (official-only) doesn't have.
        await loadHomebrew();

        // 4. Load characters + session. Runs regardless of whether steps
        //    1-3 fully succeeded — a character can still open in a
        //    degraded state (missing spell/item data) per the app's own
        //    "a character always opens" invariant; it must not be starved
        //    entirely by an unrelated upstream failure.
        try {
          await Promise.all([
            loadCharacters(),
            initSession(),
          ]);
        } catch (e) {
          console.error('[_layout] loadCharacters/initSession failed:', e);
        }

        // 5. Restore combat state if a combat was active before the app was killed
        loadCombatState().then(state => {
          if (state?.active) {
            useCombatStore.setState({ combat: state });
          }
        }).catch(() => { /* non-critical */ });

        // 6. Wire up the sync manager — must run after stores are hydrated
        try {
          const { applyIncomingEntity, applyIncomingPatch } = useCharacterStore.getState();
          const { setStatus }           = useSyncStore.getState();
          const { setTurn }             = useCombatTurnStore.getState();

          syncManager.initialise({
            onStatusChange: (status) => {
              setStatus(status);
            },
            onEntityReceived: (entity) => {
              applyIncomingEntity(entity);
            },
            onEntityPatchReceived: (entityId, patch) => {
              applyIncomingPatch(entityId, patch);
            },
            onCombatTurnReceived: (turn) => {
              setTurn(turn);
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
          console.error('[_layout] Sync manager init failed:', e);
        }

        // 7. Restore campaign state and re-establish sync if a campaign was
        //    active before the app was last closed. loadCampaigns sets isDm and
        //    activeCampaign from the persisted session; resumeSync then re-hosts
        //    (DM) or reconnects (player). Both are safe no-ops when offline.
        try {
          await useCampaignStore.getState().loadCampaigns();
          await useCampaignStore.getState().resumeSync();
        } catch (e) {
          console.error('[_layout] Campaign restore failed:', e);
        }

        // 8. Prepared-encounter library (DM planning data) — independent of
        //    campaign/sync restore above, so a failure here can't block them
        //    (same isolated-per-step pattern the rest of this sequence uses).
        try {
          await useEncounterStore.getState().loadEncounters();
        } catch (e) {
          console.error('[_layout] Encounter library load failed:', e);
        }
      } catch (e) {
        // Defense in depth — every step above already catches its own
        // errors, so this only fires on something genuinely unforeseen.
        console.error('[_layout] Boot sequence failed:', e);
      } finally {
        setDbReady(true);
      }
    }
    boot();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // First-launch onboarding redirect — fires once, right after boot finishes.
  // See app/onboarding.tsx and docs/ROADMAP_1.0.md Phase 3.3.
  useEffect(() => {
    if (!dbReady) return;
    getMeta('onboarding_complete').then(v => {
      if (v !== 'true') router.replace('/onboarding' as any);
    }).catch(() => { /* if the check fails, just skip onboarding rather than block startup */ });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dbReady]);

  // Item 16 (LAN/session UX) — resumeSync() only ever ran once, at cold
  // boot. A device that sleeps/loses WiFi mid-session (phone locks, walks
  // out of range) never re-triggers it: JS timers are typically suspended
  // during sleep, so the client's own backoff retries may have already
  // silently exhausted themselves in the background by the time the app is
  // reopened, leaving the player stuck until they notice and manually find
  // the buried "Enter a new room code" flow. Re-attempting on every
  // foreground transition (only when not already connected — this is not a
  // periodic poll, just a resume hook) closes that gap for free: startAsClient
  // (and startAsServer) already tear down any stale connection first, so this
  // is always safe to call, never doubles up a working connection.
  useEffect(() => {
    if (!dbReady) return;
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      if (useSyncStore.getState().status.connected) return;
      if (!useCampaignStore.getState().activeCampaign) return;
      useCampaignStore.getState().resumeSync().catch(e => console.error('[_layout] Foreground resumeSync failed:', e));
    });
    return () => sub.remove();
  }, [dbReady]);

  if (!dbReady) return <BootScreen />;

  return (
    <SafeAreaProvider>
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
        <Stack.Screen name="homebrew/background-builder" options={{ headerShown: false }} />
        <Stack.Screen name="homebrew/feature-editor"     options={{ headerShown: false }} />
        <Stack.Screen name="homebrew/item-builder"       options={{ headerShown: false }} />
        <Stack.Screen name="homebrew/rare-items"         options={{ headerShown: false }} />
        <Stack.Screen name="homebrew/subrace-builder"    options={{ headerShown: false }} />
        <Stack.Screen name="homebrew/subclass-builder"   options={{ headerShown: false }} />
        <Stack.Screen name="settings"                      options={{ headerShown: false }} />
        <Stack.Screen name="about"                         options={{ headerShown: false }} />
        <Stack.Screen name="backup"                        options={{ headerShown: false }} />
        <Stack.Screen name="onboarding"                    options={{ headerShown: false }} />
      </Stack>
    </View>
    </ErrorBoundary>
    </SafeAreaProvider>
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
