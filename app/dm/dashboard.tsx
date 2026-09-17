// app/dm/dashboard.tsx
// DM party overview dashboard. Only accessible when isDm === true.
import { useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, TextInput, Modal } from 'react-native';
import { useRouter } from 'expo-router';
import { useCampaignStore } from '../../src/store/campaignStore';
import { Alert } from '../../src/utils/alert';
import { useCharacterStore } from '../../src/store/characterStore';
import { useCombatStore }    from '../../src/store/combatStore';
import { Entity } from '../../src/engine/types';
import { dmFullStatVisibility } from '../../src/engine/houseRules';
import { activeSession, startSession, endSession } from '../../src/engine/session';
import { useSafeGoBack } from '../../src/hooks/useSafeGoBack';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../../src/theme';
import { SyncStatusDot } from '../../src/components/SyncStatusDot';
import { useSyncStore }  from '../../src/store/syncStore';

// ── Party Character Card ──────────────────────────────────────────────────────

function PartyCard({ entity, showFull, onPress, onPlay }: { entity: Entity; showFull: boolean; onPress: () => void; onPlay: () => void }) {
  const { identity, resources, derived, conditions, spellcasting, features, wildShapeState, conditionMonitor } = entity;

  // While Wild Shaped, the HP bar shown to the DM should reflect the BEAST's
  // pool (what's actually at risk right now), not the player's real HP
  // underneath — same "beast HP is the live pool" rule QuickPanel/handleDamage
  // already apply everywhere else damage is dealt to a transformed character.
  const hpCurrent = wildShapeState?.active ? wildShapeState.beastHp    : resources.hp.current;
  const hpMax     = wildShapeState?.active ? wildShapeState.beastHpMax : resources.hp.maximum;
  const hpPct   = hpMax > 0 ? hpCurrent / hpMax : 0;
  const hpColor = hpPct > 0.5 ? Colors.green : hpPct > 0.25 ? Colors.gold : Colors.red;

  const concentrating = spellcasting?.concentrating ?? null;
  const keyResources  = resources.custom.slice(0, 3); // show first 3 resources as pips
  const spellTiers = spellcasting
    ? (Object.keys(spellcasting.slots) as (keyof typeof spellcasting.slots)[])
        .filter(t => spellcasting.slots[t].total > 0)
        .map(t => ({ tier: t, ...spellcasting.slots[t] }))
    : [];
  const pactSlot = spellcasting?.pactSlots
    ? Object.values(spellcasting.pactSlots).find(s => s.total > 0)
    : undefined;

  // Death state — deathSaves is real persisted/synced data now, so the DM
  // dashboard can show it at a glance without needing to open the character.
  const isDead   = resources.deathSaves.failures >= 3;
  const isStable = resources.hp.current === 0 && resources.deathSaves.stable;
  const isDying  = resources.hp.current === 0 && !isStable && !isDead;

  return (
    <Pressable style={[styles.partyCard, isDead && styles.partyCardDead]} onPress={onPress}>
      {/* Name row */}
      <View style={styles.cardTop}>
        <View>
          <Text style={styles.cardName}>{identity.name || 'Unnamed'}</Text>
          <Text style={styles.cardSub}>
            Lv {identity.level} {identity.classId} · {identity.raceId}
          </Text>
        </View>
        <View style={styles.cardBadges}>
          {isDead && (
            <View style={[styles.badge, styles.deathBadge]}>
              <Text style={styles.deathBadgeTxt}>💀 DEAD</Text>
            </View>
          )}
          {isDying && (
            <View style={[styles.badge, styles.dyingBadge]}>
              <Text style={styles.dyingBadgeTxt}>
                ⚠ DYING {resources.deathSaves.successes}✓/{resources.deathSaves.failures}✗
              </Text>
            </View>
          )}
          {isStable && (
            <View style={[styles.badge, styles.stableBadge]}>
              <Text style={styles.stableBadgeTxt}>♥ STABLE</Text>
            </View>
          )}
          {/* AC, movement, and passive stats — what a DM could reasonably
              observe at a glance. Shown regardless of the visibility rule. */}
          <View style={styles.badge}>
            <Text style={styles.badgeLbl}>AC</Text>
            <Text style={styles.badgeVal}>{derived.ac}</Text>
          </View>
          <View style={styles.badge}>
            <Text style={styles.badgeLbl}>SPD</Text>
            <Text style={styles.badgeVal}>{resources.speed}</Text>
          </View>
          <View style={styles.badge}>
            <Text style={styles.badgeLbl}>PP</Text>
            <Text style={styles.badgeVal}>{derived.passivePerception}</Text>
          </View>
          {derived.passiveInvestigation !== undefined && (
            <View style={styles.badge}>
              <Text style={styles.badgeLbl}>PI</Text>
              <Text style={styles.badgeVal}>{derived.passiveInvestigation}</Text>
            </View>
          )}
          {wildShapeState?.active && (
            <View style={[styles.badge, styles.wildShapeBadge]}>
              <Text style={styles.wildShapeBadgeTxt}>🐾 {wildShapeState.formId}</Text>
            </View>
          )}
        </View>
      </View>

      {/* HP bar — always visible, same reasoning as AC/movement/passives above.
          Shows the beast's HP pool while Wild Shaped, real HP otherwise. */}
      <View style={styles.hpRow}>
        <View style={styles.hpBarOuter}>
          <View style={[styles.hpBarFill, {
            width: `${Math.round(Math.max(0, Math.min(1, hpPct)) * 100)}%` as any,
            backgroundColor: hpColor,
          }]} />
        </View>
        <Text style={styles.hpTxt}>{hpCurrent}/{hpMax}</Text>
      </View>

      {/* Everything below is more than a DM could observe at a glance —
          gated behind the dmFullStatVisibility house rule (book default: off). */}
      {showFull && (
        <>
          {/* Conditions + Concentration + Exhaustion */}
          <View style={styles.condRow}>
            {conditionMonitor.exhaustion > 0 && (
              <View style={[styles.condPill, styles.exhaustionPill]}>
                <Text style={styles.condTxt}>😩 Exhaustion {conditionMonitor.exhaustion}</Text>
              </View>
            )}
            {conditions.map(c => (
              <View key={c.id} style={styles.condPill}>
                <Text style={styles.condTxt}>{c.id}</Text>
              </View>
            ))}
            {concentrating && (
              <View style={[styles.condPill, styles.concPill]}>
                <Text style={styles.condTxt}>⟳ {concentrating}</Text>
              </View>
            )}
            {conditions.length === 0 && !concentrating && conditionMonitor.exhaustion === 0 && (
              <Text style={styles.noCondTxt}>No conditions</Text>
            )}
          </View>

          {/* Spell slots — compact per-tier pips, same visual language as the
              resource pips below. Only tiers the entity actually has (total
              > 0) are shown; pact slots (Warlock etc.) get their own row
              since they recover independently on a short rest. */}
          {spellTiers.length > 0 && (
            <View style={styles.resourcePips}>
              {spellTiers.map(s => (
                <View key={s.tier} style={styles.pipGroup}>
                  <Text style={styles.pipLabel}>L{s.tier}</Text>
                  <View style={styles.pips}>
                    {/* Same fill convention as the resource pips below: filled
                        = still available (i < remaining), empty = spent. */}
                    {Array.from({ length: s.total }).map((_, i) => (
                      <View key={i} style={[styles.pip, i >= s.total - s.used && styles.pipEmpty]} />
                    ))}
                  </View>
                </View>
              ))}
              {pactSlot && (
                <View style={styles.pipGroup}>
                  <Text style={styles.pipLabel}>Pact</Text>
                  <View style={styles.pips}>
                    {Array.from({ length: pactSlot.total }).map((_, i) => (
                      <View key={i} style={[styles.pip, i >= pactSlot.total - pactSlot.used && styles.pipEmpty]} />
                    ))}
                  </View>
                </View>
              )}
            </View>
          )}

          {/* Resource pips */}
          {keyResources.length > 0 && (
            <View style={styles.resourcePips}>
              {keyResources.map(r => (
                <View key={r.id} style={styles.pipGroup}>
                  <Text style={styles.pipLabel}>{r.name}</Text>
                  <View style={styles.pips}>
                    {Array.from({ length: r.maximum }).map((_, i) => (
                      <View key={i} style={[styles.pip, i >= r.current && styles.pipEmpty]} />
                    ))}
                  </View>
                </View>
              ))}
            </View>
          )}
        </>
      )}

      {/* DM-CLAIM-PC-1: a DM can already open any party character's real
          player sheet (app/sheet/[id].tsx) directly — it has no isDm gate,
          and isDm itself is derived from the active campaign, never from
          which screen is open, so tapping this never affects DM status or
          tools. What was actually missing was any DISCOVERABLE way to do
          it — tapping the card itself always opened the DM-tools view
          (app/dm/character/[id].tsx). This is a separate, explicit
          affordance for "optionally control this PC," matching the
          required "keep DM role and character control as separate
          concepts" (never make the DM count as a normal player). */}
      <Pressable style={styles.playBtn} onPress={onPlay}>
        <Text style={styles.playBtnTxt}>▶ Play as {identity.name || 'this character'}</Text>
      </Pressable>
    </Pressable>
  );
}

// ── DM Dashboard ──────────────────────────────────────────────────────────────

export default function DmDashboard() {
  const router         = useRouter();
  const safeGoBack     = useSafeGoBack('/(tabs)');
  const isDm           = useCampaignStore(s => s.isDm);
  const activeCampaign = useCampaignStore(s => s.activeCampaign);
  const updateCampaign = useCampaignStore(s => s.updateCampaign);
  const characters     = useCharacterStore(s => s.characters);
  const rules          = useCharacterStore(s => s.rules);
  const startCombat    = useCombatStore(s => s.startCombat);
  const syncStatus     = useSyncStore(s => s.status);
  const showFull       = dmFullStatVisibility(rules);
  const [endSessionOpen, setEndSessionOpen] = useState(false);
  const [endSummary, setEndSummary] = useState('');

  const session = activeCampaign ? activeSession(activeCampaign) : null;

  function handleStartSession() {
    if (!activeCampaign) return;
    updateCampaign(activeCampaign.id, c => startSession(c));
  }
  function handleEndSession() {
    if (!activeCampaign) return;
    updateCampaign(activeCampaign.id, c => endSession(c, endSummary));
    setEndSummary('');
    setEndSessionOpen(false);
  }

  // Guard: only DMs see this screen
  if (!isDm) {
    return (
      <View style={styles.screen}>
        <Pressable style={styles.backBtn} onPress={safeGoBack}>
          <Text style={styles.backTxt}>← Back</Text>
        </Pressable>
        <View style={styles.center}>
          <Text style={styles.errorTxt}>DM access only.</Text>
        </View>
      </View>
    );
  }

  const partyChars = activeCampaign
    ? characters.filter(c => activeCampaign.characterIds.includes(c.id))
    : characters; // fallback: show all characters

  function handleStartEncounter() {
    if (partyChars.length === 0) {
      Alert.alert('No characters', 'Add characters to the campaign first.');
      return;
    }
    router.push('/dm/encounter' as any);
  }

  return (
    <View style={styles.screen}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={safeGoBack}>
          <Text style={styles.backTxt}>← Back</Text>
        </Pressable>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <SyncStatusDot />
          <Text style={styles.title}>DM Dashboard</Text>
          {syncStatus.role === 'dm' && (
            <Text style={{ fontSize: 11, color: '#4ade80', marginLeft: 8 }}>
              {syncStatus.clientCount} connected
            </Text>
          )}
        </View>
        {activeCampaign && (
          <Text style={styles.campaignName}>{activeCampaign.name}</Text>
        )}
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        {/* Room code banner — what players type/scan to join. Hosting itself
            (CampaignHost) never depends on this — only whether a room code
            is currently dialable does (NetworkHostAvailability). A missing
            code is a non-blocking recommendation, not an error: this DM
            screen and every local host/DM tool stay fully usable either
            way. */}
        {syncStatus.role === 'dm' && (
          <View style={styles.roomCard}>
            <Text style={styles.roomLabel}>ROOM CODE</Text>
            {syncStatus.roomCode ? (
              <Text style={styles.roomCode}>{syncStatus.roomCode}</Text>
            ) : (
              <Text style={styles.roomCodeDim}>No local network — not joinable yet</Text>
            )}
            <Text style={styles.roomHint}>
              {syncStatus.roomCode
                ? 'Players join with this code on the same WiFi network.'
                : 'Enable Wi-Fi or a mobile hotspot to let other players join. Everything here still works on this device.'}
            </Text>
          </View>
        )}
        {/* Session lifecycle (item 14) — start/end a real-world play
            session, distinct from the sync connection (a DM can be hosting
            with no session "in progress" yet, e.g. while players are still
            joining). Builds on the existing Campaigns-tab session log
            rather than a separate concept — see engine/session.ts. */}
        {activeCampaign && (
          <View style={styles.sessionCard}>
            {session ? (
              <>
                <Text style={styles.sessionActiveTxt}>🟢 Session in progress</Text>
                <Text style={styles.sessionSub}>
                  Started {new Date(session.startedAt!).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  {session.attendedCharacterIds ? ` · ${session.attendedCharacterIds.length} in party` : ''}
                </Text>
                <Pressable style={styles.sessionEndBtn} onPress={() => setEndSessionOpen(true)}>
                  <Text style={styles.sessionEndBtnTxt}>⏹ End Session</Text>
                </Pressable>
              </>
            ) : (
              <Pressable style={styles.sessionStartBtn} onPress={handleStartSession}>
                <Text style={styles.sessionStartBtnTxt}>▶ Start Session</Text>
              </Pressable>
            )}
          </View>
        )}

        <Modal visible={endSessionOpen} transparent animationType="fade" onRequestClose={() => setEndSessionOpen(false)}>
          <View style={styles.sessionModalBackdrop}>
            <View style={styles.sessionModalSheet}>
              <Text style={styles.sessionModalTitle}>End Session</Text>
              <TextInput
                style={styles.sessionModalInput}
                value={endSummary}
                onChangeText={setEndSummary}
                placeholder="What happened this session? (optional)"
                placeholderTextColor={Colors.textDim}
                multiline
                textAlignVertical="top"
                autoFocus
              />
              <View style={styles.sessionModalBtns}>
                <Pressable style={styles.sessionModalCancel} onPress={() => setEndSessionOpen(false)}>
                  <Text style={styles.sessionModalCancelTxt}>Cancel</Text>
                </Pressable>
                <Pressable style={styles.sessionModalConfirm} onPress={handleEndSession}>
                  <Text style={styles.sessionModalConfirmTxt}>End Session</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>

        {/* Connected players roster (live sync) */}
        {syncStatus.role === 'dm' && (
          <>
            <Text style={styles.sectionLabel}>CONNECTED PLAYERS ({syncStatus.roster.length})</Text>
            {syncStatus.roster.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyTxt}>
                  No players connected yet.{'\n'}
                  Share your room code from the Campaigns tab.
                </Text>
              </View>
            ) : (
              syncStatus.roster.map(p => {
                const claimed = p.characterId
                  ? characters.find(c => c.id === p.characterId) ?? null
                  : null;
                return (
                  <Pressable
                    key={p.deviceId}
                    style={styles.rosterRow}
                    onPress={() => claimed && router.push(`/dm/character/${claimed.id}` as any)}
                    disabled={!claimed}
                  >
                    <View style={styles.rosterDot} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.rosterName}>{p.nickname}</Text>
                      <Text style={styles.rosterSub}>
                        {claimed
                          ? `Playing ${claimed.identity.name || 'Unnamed'} · Lv ${claimed.identity.level}`
                          : p.characterId
                            ? 'Character not synced yet…'
                            : 'No character selected'}
                      </Text>
                    </View>
                    {claimed && <Text style={styles.rosterArrow}>›</Text>}
                  </Pressable>
                );
              })
            )}
          </>
        )}

        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={styles.sectionLabel}>PARTY ({partyChars.length})</Text>
          {!showFull && (
            <Text style={styles.restrictedNote}>Passive view — see Campaign Settings</Text>
          )}
        </View>

        {partyChars.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTxt}>
              No characters in this campaign.{'\n'}
              Have players create characters and join the campaign.
            </Text>
          </View>
        ) : (
          partyChars.map(c => (
            <PartyCard
              key={c.id}
              entity={c}
              showFull={showFull}
              onPress={() => router.push(`/dm/character/${c.id}` as any)}
              onPlay={() => router.push(`/sheet/${c.id}` as any)}
            />
          ))
        )}

        <Pressable style={styles.encounterBtn} onPress={handleStartEncounter}>
          <Text style={styles.encounterBtnTxt}>⚔️ Start Encounter</Text>
        </Pressable>
        <Pressable style={[styles.encounterBtn, styles.libraryBtn]} onPress={() => router.push('/dm/encounters' as any)}>
          <Text style={styles.encounterBtnTxt}>📋 Encounter Library</Text>
        </Pressable>
        <Pressable style={[styles.encounterBtn, styles.libraryBtn]} onPress={() => router.push('/dm/monsters' as any)}>
          <Text style={styles.encounterBtnTxt}>🐉 Monster Library</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  errorTxt: { color: Colors.red, fontSize: FontSize.lg },

  header: {
    backgroundColor: Colors.surfaceHigh,
    paddingTop: Spacing.xl + 8, paddingBottom: Spacing.md,
    paddingHorizontal: Spacing.md,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  backBtn:      { alignSelf: 'flex-start', marginBottom: 4 },
  backTxt:      { color: Colors.gold, fontSize: FontSize.md, fontWeight: FontWeight.bold },
  title:        { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  campaignName: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 2 },

  scroll:       { flex: 1 },
  content:      { padding: Spacing.md, gap: Spacing.md, paddingBottom: Spacing.xxl },
  sectionLabel: { fontSize: FontSize.xs, color: Colors.textSecondary, letterSpacing: 2, fontWeight: FontWeight.bold },
  restrictedNote: { fontSize: FontSize.xs, color: Colors.textDim, fontStyle: 'italic' },

  roomCard: {
    backgroundColor: Colors.gold + '14', borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.gold + '55',
    padding: Spacing.md, alignItems: 'center', gap: 2,
  },
  roomLabel: { fontSize: FontSize.xs, color: Colors.gold, letterSpacing: 2, fontWeight: FontWeight.bold },
  roomCode: { fontSize: 34, fontWeight: FontWeight.black, color: Colors.gold, letterSpacing: 6 },
  roomCodeDim: { fontSize: FontSize.lg, color: Colors.textDim, fontWeight: FontWeight.bold },
  roomHint: { fontSize: FontSize.xs, color: Colors.textSecondary, textAlign: 'center', marginTop: 2 },

  sessionCard: {
    backgroundColor: Colors.surfaceHigh, borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.border,
    padding: Spacing.md, alignItems: 'center', gap: 4,
  },
  sessionActiveTxt: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.green },
  sessionSub:        { fontSize: FontSize.xs, color: Colors.textDim },
  sessionStartBtn: {
    backgroundColor: Colors.green + '22', borderRadius: Radius.full,
    borderWidth: 1, borderColor: Colors.green + '66',
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm,
  },
  sessionStartBtnTxt: { fontSize: FontSize.md, color: Colors.green, fontWeight: FontWeight.bold },
  sessionEndBtn: {
    backgroundColor: Colors.red + '22', borderRadius: Radius.full,
    borderWidth: 1, borderColor: Colors.red + '66',
    paddingHorizontal: Spacing.md, paddingVertical: 6, marginTop: 4,
  },
  sessionEndBtnTxt: { fontSize: FontSize.sm, color: Colors.red, fontWeight: FontWeight.bold },

  sessionModalBackdrop: { flex: 1, backgroundColor: '#000000cc', justifyContent: 'center', padding: Spacing.md },
  sessionModalSheet: {
    backgroundColor: Colors.surfaceHigh, borderRadius: Radius.lg,
    padding: Spacing.md, gap: Spacing.sm,
  },
  sessionModalTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.gold, textAlign: 'center' },
  sessionModalInput: {
    backgroundColor: Colors.surface, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border,
    padding: Spacing.sm, color: Colors.textPrimary, minHeight: 90,
  },
  sessionModalBtns: { flexDirection: 'row', gap: Spacing.sm },
  sessionModalCancel: {
    flex: 1, backgroundColor: Colors.surface, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border, padding: Spacing.md, alignItems: 'center',
  },
  sessionModalCancelTxt: { color: Colors.textSecondary, fontWeight: FontWeight.bold },
  sessionModalConfirm: { flex: 1, backgroundColor: Colors.gold, borderRadius: Radius.md, padding: Spacing.md, alignItems: 'center' },
  sessionModalConfirmTxt: { color: Colors.bg, fontWeight: FontWeight.bold },

  rosterRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    backgroundColor: Colors.surface, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border,
    padding: Spacing.sm,
  },
  rosterDot:   { width: 8, height: 8, borderRadius: Radius.full, backgroundColor: Colors.green },
  rosterName:  { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  rosterSub:   { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 1 },
  rosterArrow: { fontSize: FontSize.lg, color: Colors.textDim },

  partyCard: {
    backgroundColor: Colors.surface, borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.border,
    padding: Spacing.md, gap: Spacing.sm,
  },
  partyCardDead: {
    borderColor: Colors.red + '88',
    backgroundColor: Colors.red + '0c',
  },
  cardTop:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  cardName:  { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  cardSub:   { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },
  cardBadges:{ flexDirection: 'row', gap: Spacing.xs, flexWrap: 'wrap', justifyContent: 'flex-end' },
  badge: {
    backgroundColor: Colors.surfaceHigh, borderRadius: Radius.sm,
    paddingHorizontal: Spacing.sm, paddingVertical: 2, alignItems: 'center',
  },
  badgeLbl: { fontSize: FontSize.xs, color: Colors.textDim },
  badgeVal: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  deathBadge:    { backgroundColor: Colors.red + '33', borderWidth: 1, borderColor: Colors.red },
  deathBadgeTxt: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, color: Colors.red },
  dyingBadge:    { backgroundColor: Colors.red + '22', borderWidth: 1, borderColor: Colors.red + '77' },
  dyingBadgeTxt: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, color: Colors.red },
  stableBadge:    { backgroundColor: Colors.green + '22', borderWidth: 1, borderColor: Colors.green + '77' },
  stableBadgeTxt: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, color: Colors.green },
  wildShapeBadge:    { backgroundColor: Colors.green + '22', borderWidth: 1, borderColor: Colors.green + '77' },
  wildShapeBadgeTxt: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, color: Colors.green, textTransform: 'capitalize' },

  hpRow:     { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  hpBarOuter:{ flex: 1, height: 6, backgroundColor: Colors.border, borderRadius: Radius.full, overflow: 'hidden' },
  hpBarFill: { height: '100%', borderRadius: Radius.full },
  hpTxt:     { fontSize: FontSize.sm, color: Colors.textSecondary, width: 70, textAlign: 'right' },

  playBtn: {
    marginTop: Spacing.sm, alignSelf: 'flex-start',
    backgroundColor: Colors.gold + '22', borderRadius: Radius.full,
    borderWidth: 1, borderColor: Colors.gold + '66',
    paddingHorizontal: Spacing.sm, paddingVertical: 4,
  },
  playBtnTxt: { fontSize: FontSize.xs, color: Colors.gold, fontWeight: FontWeight.bold },

  condRow:    { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  condPill: {
    backgroundColor: Colors.purple + '33', borderRadius: Radius.full,
    paddingHorizontal: Spacing.sm, paddingVertical: 2,
    borderWidth: 1, borderColor: Colors.purple + '66',
  },
  concPill:   { backgroundColor: Colors.blue + '33', borderColor: Colors.blue + '66' },
  exhaustionPill: { backgroundColor: Colors.gold + '22', borderColor: Colors.gold + '66' },
  condTxt:    { fontSize: FontSize.xs, color: Colors.textPrimary, textTransform: 'capitalize' },
  noCondTxt:  { fontSize: FontSize.xs, color: Colors.textDim, fontStyle: 'italic' },

  resourcePips:{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md },
  pipGroup:    { gap: 2 },
  pipLabel:    { fontSize: FontSize.xs, color: Colors.textDim },
  pips:        { flexDirection: 'row', gap: 3 },
  pip:         { width: 8, height: 8, borderRadius: Radius.full, backgroundColor: Colors.gold },
  pipEmpty:    { backgroundColor: Colors.border },

  emptyCard: {
    backgroundColor: Colors.surface, borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.border, padding: Spacing.lg,
    alignItems: 'center',
  },
  emptyTxt: { color: Colors.textSecondary, textAlign: 'center', lineHeight: 22 },

  encounterBtn: {
    backgroundColor: Colors.red, borderRadius: Radius.lg,
    padding: Spacing.md, alignItems: 'center',
    marginTop: Spacing.md,
  },
  encounterBtnTxt: { color: Colors.white, fontWeight: FontWeight.bold, fontSize: FontSize.lg },
  libraryBtn: { backgroundColor: Colors.surfaceHigh, borderWidth: 1, borderColor: Colors.gold },
});
