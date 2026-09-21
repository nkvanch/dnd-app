// app/(tabs)/index.tsx
// Home dashboard: last character, active campaign section, quick actions, dice roller.
import { useState, useCallback, useEffect } from 'react';
import {
  View, Text, ScrollView, Pressable, StyleSheet,
  Modal, TextInput, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useCharacterStore } from '../../src/store/characterStore';
import { useCampaignStore }  from '../../src/store/campaignStore';
import { useSyncStore }      from '../../src/store/syncStore';
import { useLastCharacterStore } from '../../src/store/lastCharacterStore';
import { rollExpression } from '../../src/engine/dice';
import { DiceRoll, Entity } from '../../src/engine/types';
import { ManualRollInput } from '../../src/components/ManualRollInput';
import { Alert } from '../../src/utils/alert';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../../src/theme';

// ── Dice Roller Modal ─────────────────────────────────────────────────────────

function DiceRollerModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const [expr,   setExpr]   = useState('1d20');
  const [label,  setLabel]  = useState('');
  const [result, setResult] = useState<DiceRoll | null>(null);
  const [error,  setError]  = useState('');

  function roll() {
    try {
      setError('');
      const r = rollExpression(expr.trim() || '1d20', label.trim() || undefined);
      setResult(r);
    } catch (e) {
      setError('Invalid expression. Try: 1d20, 2d6+3, 4d6kh3');
    }
  }

  const QUICK = ['1d4','1d6','1d8','1d10','1d12','1d20','2d6','4d6kh3'];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.modalOverlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable style={styles.modalBackdrop} onPress={onClose} />
        <View style={styles.modalSheet}>
          <Text style={styles.modalTitle}>Dice Roller</Text>

          <View style={styles.quickRow}>
            {QUICK.map(q => (
              <Pressable key={q} style={styles.quickBtn} onPress={() => { setExpr(q); setResult(null); }}>
                <Text style={styles.quickBtnText}>{q}</Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.inputRow}>
            <TextInput
              style={styles.exprInput}
              value={expr}
              onChangeText={t => { setExpr(t); setResult(null); setError(''); }}
              placeholder="e.g. 2d6+3"
              placeholderTextColor={Colors.textDim}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TextInput
              style={styles.labelInput}
              value={label}
              onChangeText={setLabel}
              placeholder="Label (optional)"
              placeholderTextColor={Colors.textDim}
            />
          </View>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <Pressable style={styles.rollBtn} onPress={roll}>
            <Text style={styles.rollBtnText}>Roll</Text>
          </Pressable>

          <ManualRollInput
            expression={expr.trim() || '1d20'}
            label={label.trim() || undefined}
            onSubmit={setResult}
          />

          {result && (
            <View style={styles.resultBox}>
              {result.label ? <Text style={styles.resultLabel}>{result.label}</Text> : null}
              <Text style={styles.resultTotal}>{result.total}</Text>
              <Text style={styles.resultBreakdown}>
                [{result.rolls.join(', ')}]{result.modifier !== 0 ? ` + ${result.modifier}` : ''}
              </Text>
              <Text style={styles.resultExpr}>{result.expression}</Text>
            </View>
          )}

          <Pressable style={styles.closeBtn} onPress={onClose}>
            <Text style={styles.closeBtnText}>Close</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ── Active Campaign Card ─────────────────────────────────────────────────────
// Three states driven by campaign + sync status:
//   between-sessions: name, quest count, last session note, party size
//   live:             name + sync dot, player count, DM shortcut

function ActiveCampaignCard({ onOpen }: { onOpen: () => void }) {
  const router         = useRouter();
  const activeCampaign = useCampaignStore(s => s.activeCampaign);
  const isDm           = useCampaignStore(s => s.isDm);
  const syncStatus     = useSyncStore(s => s.status);
  const characters     = useCharacterStore(s => s.characters);

  if (!activeCampaign) return null;

  const isLive        = syncStatus.connected;
  const activeQuests  = (activeCampaign.quests ?? []).filter(q => q.status === 'active');
  const lastEntry     = activeCampaign.sessionLog?.[0] ?? null;
  const partyCount    = activeCampaign.characterIds.length;

  if (isLive) {
    // ── Live state ───────────────────────────────────────────────────────────
    return (
      <Pressable style={[styles.campaignCard, styles.campaignCardLive]} onPress={onOpen}>
        <View style={styles.campaignCardTop}>
          <View style={{ flex: 1 }}>
            <View style={styles.campaignLiveBadge}>
              <View style={styles.liveDot} />
              <Text style={styles.liveTxt}>LIVE</Text>
            </View>
            <Text style={styles.campaignCardName}>{activeCampaign.name}</Text>
            <Text style={styles.campaignCardMeta}>
              {isDm
                ? `${syncStatus.clientCount} player${syncStatus.clientCount !== 1 ? 's' : ''} connected`
                : 'Connected to DM'}
            </Text>
          </View>
        </View>

        <View style={styles.campaignCardActions}>
          {isDm && (
            <Pressable
              style={styles.campaignActionBtn}
              onPress={() => router.push('/dm/dashboard' as any)}
            >
              <Text style={styles.campaignActionTxt}>🎲 DM Dashboard</Text>
            </Pressable>
          )}
          <Pressable style={[styles.campaignActionBtn, styles.campaignActionBtnSecondary]} onPress={onOpen}>
            <Text style={styles.campaignActionTxtSecondary}>Open Campaign →</Text>
          </Pressable>
        </View>
      </Pressable>
    );
  }

  // ── Between-sessions state ─────────────────────────────────────────────────
  return (
    <Pressable style={styles.campaignCard} onPress={onOpen}>
      <Text style={styles.campaignCardName}>{activeCampaign.name}</Text>

      <View style={styles.campaignMetaRow}>
        {activeQuests.length > 0 && (
          <View style={styles.campaignPill}>
            <Text style={styles.campaignPillTxt}>
              {activeQuests.length} quest{activeQuests.length !== 1 ? 's' : ''} active
            </Text>
          </View>
        )}
        {partyCount > 0 && (
          <View style={styles.campaignPill}>
            <Text style={styles.campaignPillTxt}>
              {partyCount} character{partyCount !== 1 ? 's' : ''}
            </Text>
          </View>
        )}
      </View>

      {lastEntry && (
        <View style={styles.lastSessionBlock}>
          <Text style={styles.lastSessionLabel}>Last session</Text>
          <Text style={styles.lastSessionText} numberOfLines={2}>
            {lastEntry.summary}
          </Text>
        </View>
      )}

      <Text style={styles.campaignOpenHint}>Tap to open campaign →</Text>
    </Pressable>
  );
}

// ── Last Character Card ───────────────────────────────────────────────────────

function LastCharacterCard({ character, onPress }: { character: Entity; onPress: () => void }) {
  const { identity, resources, derived } = character;
  const hpPercent = resources.hp.maximum > 0
    ? resources.hp.current / resources.hp.maximum
    : 1;
  const hpColor = hpPercent > 0.5 ? Colors.green : hpPercent > 0.25 ? Colors.gold : Colors.red;

  return (
    <Pressable testID="home-last-character" accessibilityLabel="Continue last character" style={styles.lastCharCard} onPress={onPress}>
      <View style={styles.lastCharHeader}>
        <View>
          <Text style={styles.lastCharName}>{identity.name || 'Unnamed'}</Text>
          <Text style={styles.lastCharSub}>
            Level {identity.level}  ·  {identity.classId || '—'}  ·  {identity.raceId || '—'}
          </Text>
        </View>
        <View style={styles.lastCharStats}>
          <View style={styles.statPill}>
            <Text style={styles.statPillLabel}>AC</Text>
            <Text style={styles.statPillValue}>{derived.ac}</Text>
          </View>
          <View style={styles.statPill}>
            <Text style={styles.statPillLabel}>Spd</Text>
            <Text style={styles.statPillValue}>{derived.speed}</Text>
          </View>
        </View>
      </View>

      <View style={styles.hpRow}>
        <View style={styles.hpBarOuter}>
          <View style={[styles.hpBarFill, {
            width: `${Math.round(Math.max(0, Math.min(1, hpPercent)) * 100)}%` as any,
            backgroundColor: hpColor,
          }]} />
        </View>
        <Text style={styles.hpText}>
          {resources.hp.current} / {resources.hp.maximum} HP
        </Text>
      </View>

      <Text style={styles.openHint}>Tap to open sheet →</Text>
    </Pressable>
  );
}

// ── Home Screen ───────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const router     = useRouter();
  const characters = useCharacterStore(s => s.characters);
  const activeCampaign = useCampaignStore(s => s.activeCampaign);
  const loadCampaigns  = useCampaignStore(s => s.loadCampaigns);
  const [diceOpen, setDiceOpen] = useState(false);
  const lastOpenedId = useLastCharacterStore(s => s.lastCharacterId);
  const loadLastCharacter = useLastCharacterStore(s => s.load);

  useEffect(() => { void loadCampaigns(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { void loadLastCharacter(); }, [loadLastCharacter]);

  // Prefer the character the player actually last opened a sheet for; fall
  // back to the most recently updated one (characters[0] — loadAllEntities
  // orders by updatedAt DESC) if nothing's been opened yet this install, or
  // if the tracked id got deleted.
  const lastChar = characters.find(c => c.id === lastOpenedId) ?? characters[0] ?? null;

  const openSheet = useCallback((id: string) => {
    router.push(`/sheet/${id}` as any);
  }, [router]);

  // Re-audit A09 (item 11) — see the identical comment/logic in
  // characters.tsx's own startCreation for the reasoning; duplicated
  // rather than extracted, matching this codebase's established style for
  // small, stable, two-call-site UI patterns.
  const startCreation = useCallback(() => {
    const draft = useCharacterStore.getState().draft;
    if (draft) {
      Alert.alert(
        'Resume character creation?',
        `You have an unfinished character${draft.identity.name ? ` ("${draft.identity.name}")` : ''}. Continue where you left off, or start a new one?`,
        [
          { text: 'Resume', onPress: () => router.push('/creation/hub') },
          {
            text: 'Start New', style: 'destructive',
            onPress: () => { useCharacterStore.getState().clearDraft(); router.push('/creation/name'); },
          },
        ]
      );
      return;
    }
    router.push('/creation/name');
  }, [router]);

  return (
    <View style={styles.screen} testID="home-screen">
      <View style={styles.topBar}>
        <Text style={styles.appTitle}>Grimoire</Text>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>

        {/* Continue Last Character */}
        <Text style={styles.sectionLabel}>Continue Last Character</Text>
        {lastChar ? (
          <LastCharacterCard character={lastChar} onPress={() => openSheet(lastChar.id)} />
        ) : (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyCardText}>No characters yet. Create one to get started.</Text>
          </View>
        )}

        {/* Active Campaign */}
        <Text style={styles.sectionLabel}>Active Campaign</Text>
        {activeCampaign ? (
          <ActiveCampaignCard
            onOpen={() => router.push('/(tabs)/campaigns' as any)}
          />
        ) : (
          <View style={styles.stubCard}>
            <Text style={styles.stubIcon}>🗺️</Text>
            <Text style={styles.stubText}>No active campaign</Text>
            <Text style={styles.stubSub}>Join a campaign from the Campaigns tab</Text>
          </View>
        )}

        {/* Quick Actions */}
        <Text style={styles.sectionLabel}>Quick Actions</Text>
        <View style={styles.quickActions}>
          <Pressable testID="home-create-character" accessibilityLabel="Create Character" style={styles.actionBtn} onPress={startCreation}>
            <Text style={styles.actionBtnIcon}>✨</Text>
            <Text style={styles.actionBtnText}>Create Character</Text>
          </Pressable>

          {activeCampaign ? (
            <Pressable
              style={[styles.actionBtn, styles.actionBtnSecondary]}
              onPress={() => router.push('/(tabs)/campaigns' as any)}
            >
              <Text style={styles.actionBtnIcon}>🗺️</Text>
              <Text style={styles.actionBtnText}>Open Campaign</Text>
            </Pressable>
          ) : (
            <Pressable
              style={[styles.actionBtn, styles.actionBtnSecondary]}
              onPress={() => router.push({ pathname: '/(tabs)/campaigns', params: { action: 'join' } } as any)}
            >
              <Text style={styles.actionBtnIcon}>🤝</Text>
              <Text style={styles.actionBtnText}>Join Campaign</Text>
            </Pressable>
          )}

          <Pressable testID="home-dice-roller" accessibilityLabel="Dice Roller" style={[styles.actionBtn, styles.actionBtnSecondary]} onPress={() => setDiceOpen(true)}>
            <Text style={styles.actionBtnIcon}>🎲</Text>
            <Text style={styles.actionBtnText}>Roll Dice</Text>
          </Pressable>
        </View>

      </ScrollView>

      <DiceRollerModal visible={diceOpen} onClose={() => setDiceOpen(false)} />
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen:  { flex: 1, backgroundColor: Colors.bg },
  topBar:  {
    paddingTop:        Spacing.xl + 8,
    paddingBottom:     Spacing.md,
    paddingHorizontal: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  appTitle: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.gold },

  scroll:   { flex: 1 },
  content:  { padding: Spacing.md, gap: Spacing.md, paddingBottom: Spacing.xl },

  sectionLabel: {
    fontSize:   FontSize.sm,
    fontWeight: FontWeight.bold,
    color:      Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: -4,
  },

  // Last character card
  lastCharCard: {
    backgroundColor: Colors.surface,
    borderRadius:    Radius.lg,
    borderWidth:     1,
    borderColor:     Colors.gold + '44',
    padding:         Spacing.md,
    gap:             Spacing.sm,
  },
  lastCharHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  lastCharName:   { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  lastCharSub:    { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 2 },
  lastCharStats:  { flexDirection: 'row', gap: Spacing.sm },
  statPill: {
    backgroundColor: Colors.surfaceHigh,
    borderRadius:    Radius.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical:   2,
    alignItems:      'center',
  },
  statPillLabel: { fontSize: FontSize.xs, color: Colors.textSecondary },
  statPillValue: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.textPrimary },

  hpRow:     { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  hpBarOuter: {
    flex: 1, height: 6, backgroundColor: Colors.border,
    borderRadius: Radius.full, overflow: 'hidden',
  },
  hpBarFill: { height: '100%', borderRadius: Radius.full },
  hpText:    { fontSize: FontSize.sm, color: Colors.textSecondary, width: 90, textAlign: 'right' },
  openHint:  { fontSize: FontSize.xs, color: Colors.textDim, textAlign: 'right' },

  // Stubs
  emptyCard: {
    backgroundColor: Colors.surface,
    borderRadius:    Radius.lg,
    borderWidth:     1,
    borderColor:     Colors.border,
    padding:         Spacing.md,
  },
  emptyCardText: { color: Colors.textSecondary, fontSize: FontSize.md },

  stubCard: {
    backgroundColor: Colors.surface,
    borderRadius:    Radius.lg,
    borderWidth:     1,
    borderColor:     Colors.border,
    padding:         Spacing.lg,
    alignItems:      'center',
    gap:             Spacing.xs,
  },
  stubIcon: { fontSize: 32 },
  stubText: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.textSecondary },
  stubSub:  { fontSize: FontSize.sm, color: Colors.textDim },

  // Active campaign card
  campaignCard: {
    backgroundColor: Colors.surface,
    borderRadius:    Radius.lg,
    borderWidth:     1,
    borderColor:     Colors.gold + '44',
    padding:         Spacing.md,
    gap:             Spacing.sm,
  },
  campaignCardLive: {
    borderColor: Colors.green + '66',
    backgroundColor: Colors.green + '08',
  },
  campaignCardTop:  { flexDirection: 'row', alignItems: 'flex-start' },
  campaignCardName: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  campaignCardMeta: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 2 },
  campaignOpenHint: { fontSize: FontSize.xs, color: Colors.textDim, textAlign: 'right' },

  // Live badge
  campaignLiveBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 4 },
  liveDot: {
    width: 8, height: 8, borderRadius: Radius.full,
    backgroundColor: Colors.green,
  },
  liveTxt: { fontSize: FontSize.xs, color: Colors.green, fontWeight: FontWeight.bold, letterSpacing: 1 },

  // Between-sessions meta pills
  campaignMetaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  campaignPill: {
    backgroundColor: Colors.surfaceHigh,
    borderRadius:    Radius.full,
    borderWidth:     1,
    borderColor:     Colors.border,
    paddingHorizontal: Spacing.sm,
    paddingVertical:   2,
  },
  campaignPillTxt: { fontSize: FontSize.xs, color: Colors.textSecondary, fontWeight: FontWeight.bold },

  // Last session snippet
  lastSessionBlock: {
    backgroundColor: Colors.surfaceHigh,
    borderRadius:    Radius.md,
    borderLeftWidth: 2,
    borderLeftColor: Colors.gold + '66',
    padding:         Spacing.sm,
    gap:             2,
  },
  lastSessionLabel: { fontSize: FontSize.xs, color: Colors.gold, fontWeight: FontWeight.bold, letterSpacing: 1 },
  lastSessionText:  { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 18 },

  // Campaign action buttons
  campaignCardActions: { flexDirection: 'row', gap: Spacing.sm },
  campaignActionBtn: {
    flex: 1, backgroundColor: Colors.green,
    borderRadius: Radius.md, padding: Spacing.sm,
    alignItems: 'center',
  },
  campaignActionBtnSecondary: {
    backgroundColor: Colors.surfaceHigh,
    borderWidth: 1, borderColor: Colors.border,
  },
  campaignActionTxt:          { color: Colors.bg, fontWeight: FontWeight.bold, fontSize: FontSize.sm },
  campaignActionTxtSecondary: { color: Colors.textPrimary, fontWeight: FontWeight.bold, fontSize: FontSize.sm },

  // Quick actions
  quickActions: { gap: Spacing.sm },
  actionBtn: {
    backgroundColor: Colors.gold,
    borderRadius:    Radius.md,
    padding:         Spacing.md,
    flexDirection:   'row',
    alignItems:      'center',
    gap:             Spacing.sm,
  },
  actionBtnSecondary: {
    backgroundColor: Colors.surface,
    borderWidth:     1,
    borderColor:     Colors.border,
  },
  actionBtnIcon: { fontSize: 20 },
  actionBtnText: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.textPrimary },

  // Dice roller modal
  modalOverlay: { flex: 1, justifyContent: 'flex-end' },
  modalBackdrop: { ...StyleSheet.absoluteFill, backgroundColor: '#000000aa' },
  modalSheet: {
    backgroundColor: Colors.surfaceHigh,
    borderTopLeftRadius:  Radius.lg,
    borderTopRightRadius: Radius.lg,
    padding: Spacing.lg,
    gap:     Spacing.md,
  },
  modalTitle: {
    fontSize:   FontSize.xl,
    fontWeight: FontWeight.bold,
    color:      Colors.textPrimary,
    textAlign:  'center',
  },
  quickRow:    { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  quickBtn: {
    backgroundColor: Colors.surface,
    borderRadius:    Radius.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical:   Spacing.xs,
    borderWidth:     1,
    borderColor:     Colors.border,
  },
  quickBtnText: { color: Colors.textPrimary, fontSize: FontSize.sm, fontWeight: FontWeight.bold },

  inputRow:   { gap: Spacing.sm },
  exprInput: {
    backgroundColor: Colors.surface,
    borderRadius:    Radius.md,
    borderWidth:     1,
    borderColor:     Colors.border,
    padding:         Spacing.md,
    fontSize:        FontSize.lg,
    color:           Colors.textPrimary,
    textAlign:       'center',
    fontWeight:      FontWeight.bold,
  },
  labelInput: {
    backgroundColor: Colors.surface,
    borderRadius:    Radius.md,
    borderWidth:     1,
    borderColor:     Colors.border,
    padding:         Spacing.sm,
    fontSize:        FontSize.sm,
    color:           Colors.textPrimary,
  },

  errorText: { color: Colors.red, fontSize: FontSize.sm, textAlign: 'center' },

  rollBtn: {
    backgroundColor: Colors.gold,
    borderRadius:    Radius.md,
    padding:         Spacing.md,
    alignItems:      'center',
  },
  rollBtnText: { color: Colors.bg, fontSize: FontSize.lg, fontWeight: FontWeight.bold },

  resultBox: {
    backgroundColor: Colors.surface,
    borderRadius:    Radius.lg,
    padding:         Spacing.md,
    alignItems:      'center',
    gap:             Spacing.xs,
    borderWidth:     1,
    borderColor:     Colors.gold + '66',
  },
  resultLabel:     { fontSize: FontSize.sm, color: Colors.textSecondary },
  resultTotal:     { fontSize: 56, fontWeight: FontWeight.bold, color: Colors.gold },
  resultBreakdown: { fontSize: FontSize.md, color: Colors.textSecondary },
  resultExpr:      { fontSize: FontSize.xs, color: Colors.textDim },

  closeBtn: { padding: Spacing.sm, alignItems: 'center' },
  closeBtnText: { color: Colors.textSecondary, fontSize: FontSize.md },
});
