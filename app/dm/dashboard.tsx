// app/dm/dashboard.tsx
// DM party overview dashboard. Only accessible when isDm === true.
import { useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useCampaignStore } from '../../src/store/campaignStore';
import { Alert } from '../../src/utils/alert';
import { useCharacterStore } from '../../src/store/characterStore';
import { useCombatStore }    from '../../src/store/combatStore';
import { Entity } from '../../src/engine/types';
import { dmFullStatVisibility } from '../../src/engine/houseRules';
import { useSafeGoBack } from '../../src/hooks/useSafeGoBack';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../../src/theme';
import { SyncStatusDot } from '../../src/components/SyncStatusDot';
import { useSyncStore }  from '../../src/store/syncStore';

// ── Party Character Card ──────────────────────────────────────────────────────

function PartyCard({ entity, showFull, onPress }: { entity: Entity; showFull: boolean; onPress: () => void }) {
  const { identity, resources, derived, conditions, spellcasting, features } = entity;
  const hpPct   = resources.hp.maximum > 0 ? resources.hp.current / resources.hp.maximum : 0;
  const hpColor = hpPct > 0.5 ? Colors.green : hpPct > 0.25 ? Colors.gold : Colors.red;

  const concentrating = spellcasting?.concentrating ?? null;
  const keyResources  = resources.custom.slice(0, 3); // show first 3 resources as pips

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
        </View>
      </View>

      {/* HP bar — always visible, same reasoning as AC/movement/passives above */}
      <View style={styles.hpRow}>
        <View style={styles.hpBarOuter}>
          <View style={[styles.hpBarFill, {
            width: `${Math.round(Math.max(0, Math.min(1, hpPct)) * 100)}%` as any,
            backgroundColor: hpColor,
          }]} />
        </View>
        <Text style={styles.hpTxt}>{resources.hp.current}/{resources.hp.maximum}</Text>
      </View>

      {/* Everything below is more than a DM could observe at a glance —
          gated behind the dmFullStatVisibility house rule (book default: off). */}
      {showFull && (
        <>
          {/* Conditions + Concentration */}
          <View style={styles.condRow}>
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
            {conditions.length === 0 && !concentrating && (
              <Text style={styles.noCondTxt}>No conditions</Text>
            )}
          </View>

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
    </Pressable>
  );
}

// ── DM Dashboard ──────────────────────────────────────────────────────────────

export default function DmDashboard() {
  const router         = useRouter();
  const safeGoBack     = useSafeGoBack('/(tabs)');
  const isDm           = useCampaignStore(s => s.isDm);
  const activeCampaign = useCampaignStore(s => s.activeCampaign);
  const characters     = useCharacterStore(s => s.characters);
  const rules          = useCharacterStore(s => s.rules);
  const startCombat    = useCombatStore(s => s.startCombat);
  const syncStatus     = useSyncStore(s => s.status);
  const showFull       = dmFullStatVisibility(rules);

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
        {/* Room code banner — what players type/scan to join. */}
        {syncStatus.role === 'dm' && (
          <View style={styles.roomCard}>
            <Text style={styles.roomLabel}>ROOM CODE</Text>
            {syncStatus.roomCode ? (
              <Text style={styles.roomCode}>{syncStatus.roomCode}</Text>
            ) : (
              <Text style={styles.roomCodeDim}>Not hosting — check WiFi</Text>
            )}
            <Text style={styles.roomHint}>
              Players join with this code on the same WiFi network.
              {syncStatus.connected ? '' : ' (Server not running.)'}
            </Text>
          </View>
        )}
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
            />
          ))
        )}

        <Pressable style={styles.encounterBtn} onPress={handleStartEncounter}>
          <Text style={styles.encounterBtnTxt}>⚔️ Start Encounter</Text>
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

  hpRow:     { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  hpBarOuter:{ flex: 1, height: 6, backgroundColor: Colors.border, borderRadius: Radius.full, overflow: 'hidden' },
  hpBarFill: { height: '100%', borderRadius: Radius.full },
  hpTxt:     { fontSize: FontSize.sm, color: Colors.textSecondary, width: 70, textAlign: 'right' },

  condRow:    { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  condPill: {
    backgroundColor: Colors.purple + '33', borderRadius: Radius.full,
    paddingHorizontal: Spacing.sm, paddingVertical: 2,
    borderWidth: 1, borderColor: Colors.purple + '66',
  },
  concPill:   { backgroundColor: Colors.blue + '33', borderColor: Colors.blue + '66' },
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
});
