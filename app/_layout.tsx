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
import { useCustomRuleProfileStore } from '../src/store/customRuleProfileStore';
import { loadCombatState, clearCombatState } from '../src/db/combatRepo';
import { loadDraftState } from '../src/db/draftRepo';

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

        // 5. Restore combat state if a combat was active before the app was killed.
        // An active combat restored with no entities (either an old,
        // pre-migration save that never persisted entities at all, or a
        // genuinely interrupted encounter — see combatRepo.ts's migration
        // note) can't be resumed: the DM's screen would show ghost
        // initiative rows with no HP/condition data and no way to act on
        // them. Clear it instead of restoring a broken-looking "active"
        // screen (audit finding PERSIST-2).
        loadCombatState().then(state => {
          if (state?.combat.active && state.entities.length > 0) {
            useCombatStore.setState({ combat: state.combat, entities: state.entities });
          } else if (state?.combat.active) {
            clearCombatState().catch(() => { /* non-critical */ });
          }
        }).catch(() => { /* non-critical */ });

        // 5b. Restore an in-progress character creation draft, if one was
        // left mid-flow when the app was last killed (re-audit A09, item
        // 11). Populating useCharacterStore's `draft` field directly here
        // means every creation screen (hub.tsx etc.) sees it as if the
        // player had simply navigated back into an already-started build —
        // no special "restore" UI needed there. Non-critical: a failure to
        // load just means creation starts fresh, same as today.
        loadDraftState().then(draft => {
          if (draft) useCharacterStore.setState({ draft });
        }).catch(() => { /* non-critical */ });

        // 5b. Named custom rule profiles are independent local configuration.
        try { await useCustomRuleProfileStore.getState().load(); }
        catch (e) { console.error('[_layout] Custom rule profiles failed to load:', e); }

        // 6. Wire up the sync manager — must run after stores are hydrated
        try {
          const { applyIncomingEntity, applyIncomingPatch } = useCharacterStore.getState();
          const { applyIncomingCampaign, applyIncomingCampaignPatch } = useCampaignStore.getState();
          const { setStatus }           = useSyncStore.getState();
          const { setTurn }             = useCombatTurnStore.getState();

          syncManager.initialise({
            onStatusChange: (status) => {
              setStatus(status);
            },
            onEntityReceived: (entity) => {
              void applyIncomingEntity(entity);
            },
            onEntityPatchReceived: (entityId, patch) => {
              void applyIncomingPatch(entityId, patch);
            },
            onCampaignReceived: (campaign) => {
              void applyIncomingCampaign(campaign);
            },
            onCampaignPatchReceived: (campaignId, patch) => {
              void applyIncomingCampaignPatch(campaignId, patch);
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

        // 6b. Keep characterStore.rules synchronized with the active
        // campaign's own rules — every engine call in the app reads
        // characterStore.rules, but Campaign.rules used to be written once
        // and never read by anything (audit finding CAMPAIGN-RULES-1), so
        // two devices in the same campaign could silently run under
        // different house rules. Subscribed here (not scattered across
        // every campaignStore call site that can set activeCampaign) so
        // it's one choke point regardless of HOW activeCampaign changed —
        // join, switch, snapshot/patch sync, or boot restore. Leaving a
        // campaign (activeCampaign becomes null) intentionally leaves
        // characterStore.rules as-is — solo play keeps whatever the device's
        // own default already was, same as before this existed.
        useCampaignStore.subscribe((state, prevState) => {
          if (state.activeCampaign && state.activeCampaign.rules !== prevState.activeCampaign?.rules) {
            useCharacterStore.getState().setRules(state.activeCampaign.rules);
          }
        });

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
    void boot();
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
        {/* Every app/dm/* screen (including ones with no explicit entry
            here before, like encounter-builder/encounters — expo-router
            auto-discovers them regardless) is now gated by
            app/dm/_layout.tsx's own isDm check, which also sets
            headerShown:false for the whole group — see its own header
            comment (audit finding ROUTE-GUARD-1). */}
        <Stack.Screen name="dm"                  options={{ headerShown: false }} />
        <Stack.Screen name="homebrew/import-review"      options={{ headerShown: false }} />
        <Stack.Screen name="homebrew/package-builder"    options={{ headerShown: false }} />
        <Stack.Screen name="homebrew/spell-builder"      options={{ headerShown: false }} />
        <Stack.Screen name="homebrew/class-builder"      options={{ headerShown: false }} />
        <Stack.Screen name="homebrew/race-builder"       options={{ headerShown: false }} />
        <Stack.Screen name="homebrew/background-builder" options={{ headerShown: false }} />
        <Stack.Screen name="homebrew/feature-editor"     options={{ headerShown: false }} />
        <Stack.Screen name="homebrew/item-builder"       options={{ headerShown: false }} />
        <Stack.Screen name="homebrew/rare-items"         options={{ headerShown: false }} />
        <Stack.Screen name="homebrew/subrace-builder"    options={{ headerShown: false }} />
        <Stack.Screen name="homebrew/subclass-builder"   options={{ headerShown: false }} />
        {/* DUPLICATE-HEADER-1: these 4 were missing from this list, so
            expo-router fell back to its own default native header (filename-
            derived title, styled via screenOptions above) stacked ON TOP OF
            each screen's own in-JSX header — the "duplicate header" bug. */}
        <Stack.Screen name="homebrew/feat-builder"       options={{ headerShown: false }} />
        <Stack.Screen name="homebrew/monster-builder"    options={{ headerShown: false }} />
        <Stack.Screen name="homebrew/condition-builder"  options={{ headerShown: false }} />
        <Stack.Screen name="homebrew/import-package"     options={{ headerShown: false }} />
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
