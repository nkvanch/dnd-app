// ============================================================================
// FILE: app/(tabs)/campaigns.tsx
// Campaigns tab — create, join, and manage campaigns with real-time sync.
//
// State machine:
//   NO CAMPAIGN  → [Create Campaign] or [Join Campaign]
//   DM ACTIVE    → connection block + campaign overview (notes/quests/log/party)
//   PLAYER ACTIVE → read-only campaign overview + sync status
// ============================================================================
import { identityLabelsFor } from '../../src/store/identityLabelsFor';
import { CampaignPacksNote } from '../../src/components/CampaignPacksNote';
import { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, Pressable, StyleSheet,
  Modal, TextInput, ActivityIndicator, Platform, KeyboardAvoidingView,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import QRCode from 'react-native-qrcode-svg';

import { Alert } from '../../src/utils/alert';
import { useCampaignStore }  from '../../src/store/campaignStore';
import { useSessionStore }   from '../../src/store/sessionStore';
import { useCharacterStore, DEFAULT_RULES } from '../../src/store/characterStore';
import { useCustomRuleProfileStore } from '../../src/store/customRuleProfileStore';
import { useSyncStore }      from '../../src/store/syncStore';
import { syncManager }       from '../../src/sync/syncManager';
import { decodeRoomCode }    from '../../src/sync/discovery';
import { profilesForRuleset, sanitizeProfileRules } from '../../src/engine/customRuleProfiles';
import { SyncStatusDot }     from '../../src/components/SyncStatusDot';
import { GameRulesetPicker } from '../../src/components/homebrew/GameRulesetPicker';
import { gameIdForRuleset } from '../../src/content/rulesets';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../../src/theme';
import { Quest, SessionLogEntry, Campaign, CampaignRules, RulesetId } from '../../src/engine/types';
import { InstalledPack, loadInstalledPacks } from '../../src/db/packRegistryRepo';
import { HostModal, JoinModal as LiveJoinModal } from '../../src/components/live/LiveSessionStart';

// ── Helpers ───────────────────────────────────────────────────────────────────

function genId(): string {
  return Math.random().toString(36).slice(2, 10);
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

/**
 * Shows an error message reliably on every platform. Alert.alert's simple
 * (title, message) form is unreliable on web depending on the React Native
 * Web version — it can render nothing at all, which looks exactly like the
 * triggering button silently did nothing. window.alert always works on web.
 */
function showError(title: string, message: string) {
  if (Platform.OS === 'web') {
    // eslint-disable-next-line no-alert
    window.alert(`${title}\n\n${message}`);
  } else {
    Alert.alert(title, message);
  }
}

// ── Create/Join Campaign Modals ───────────────────────────────────────────────
// Restored: these drive the persistent, DM-owned legacy campaign (rules sync, the DM
// dashboard/encounter tracker under app/dm/*) — a different, independent concern from the
// Live Session card below, which is the temporary Host/DM/Player network room. A campaign is
// not owned by a Host; keeping these two entry points separate (instead of merging Create
// Campaign into Host Session) is what keeps that distinction real instead of just documented.

// ── Wizard primitives ─────────────────────────────────────────────────────────

function WizChip({ label, active, onPress, testID }: { label: string; active: boolean; onPress: () => void; testID?: string }) {
  return (
    <Pressable style={[styles.wizChip, active && styles.wizChipActive]} onPress={onPress} testID={testID}>
      <Text style={[styles.wizChipTxt, active && styles.wizChipTxtActive]}>{label}</Text>
    </Pressable>
  );
}

function WizToggle({ label, hint, value, onChange, testID }: { label: string; hint?: string; value: boolean; onChange: (v: boolean) => void; testID?: string }) {
  return (
    <Pressable style={styles.wizToggleRow} onPress={() => onChange(!value)} testID={testID}>
      <View style={{ flex: 1 }}>
        <Text style={styles.wizToggleLabel}>{label}</Text>
        {hint && <Text style={styles.wizToggleHint}>{hint}</Text>}
      </View>
      <View style={[styles.wizSwitch, value && styles.wizSwitchOn]}>
        <View style={[styles.wizSwitchKnob, value && styles.wizSwitchKnobOn]} />
      </View>
    </Pressable>
  );
}

// ── Create Campaign wizard (CREATE_CAMPAIGN_FLOW_SPEC.md) ────────────────────
// 5 steps: Basics -> Rules -> Permissions -> Content -> Review. Per the spec's own "important
// rules": never creates a Host session or room code here (createCampaign makes the persistent
// campaign object only; a live session is a separate later step, DmActiveView's "Host Session" button), and the chosen rule profile is COPIED into
// the campaign's own `rules`, not referenced — editing the original profile later never
// silently rewrites an existing campaign (createCampaign already enforces this; the wizard just
// decides what to copy in).
const WIZ_STEPS = ['Basics', 'Rules', 'Permissions', 'Content', 'Review'] as const;
type WizStep = typeof WIZ_STEPS[number];

function CreateModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const createCampaign = useCampaignStore(s => s.createCampaign);
  const session        = useSessionStore(s => s.session);
  const profiles        = useCustomRuleProfileStore(s => s.profiles);
  const loadProfiles    = useCustomRuleProfileStore(s => s.load);

  const [step, setStep] = useState<WizStep>('Basics');
  const [loading, setLoading] = useState(false);

  // Step 1 — Basics
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [rulesetId, setRulesetId] = useState<RulesetId | undefined>(undefined);

  // Step 2 — Rules
  const [profileId, setProfileId] = useState<string | null>(null);   // null = Defaults
  const [maxLevel, setMaxLevel] = useState<number | null>(DEFAULT_RULES.maxLevel);
  const [allowMulticlass, setAllowMulticlass] = useState(DEFAULT_RULES.allowMulticlass);

  // Step 3 — Permissions. ruleSuggestionsEnabled and permanentRewardsAutomatic are real values
  // stored on the campaign, but disclosed here rather than silently: nothing on the DM/live
  // side reads either yet (Rule Suggestions and Rewards are both still-unbuilt DM cockpit
  // subsystems) — Player Free Edit (customRules.lockPlayerFreeEdit) is the one of the three with
  // a real, already-wired consumer (houseRules.ts's canPlayerFreeEdit()).
  const [ruleSuggestions,   setRuleSuggestions]   = useState(true);
  const [rewardsAutomatic,  setRewardsAutomatic]  = useState(false);
  const [playerFreeEdit,    setPlayerFreeEdit]    = useState(true);

  // Step 4 — Content
  const [installedPacks, setInstalledPacks] = useState<InstalledPack[]>([]);
  const [bannedPackIds, setBannedPackIds] = useState<string[]>([]);
  const [homebrewNeedsApproval, setHomebrewNeedsApproval] = useState(false);

  useEffect(() => { if (visible) { void loadProfiles(); void loadInstalledPacks().then(setInstalledPacks); } }, [visible, loadProfiles]);
  useEffect(() => {
    if (!visible) {
      setStep('Basics'); setName(''); setDescription(''); setRulesetId(undefined);
      setProfileId(null); setMaxLevel(DEFAULT_RULES.maxLevel); setAllowMulticlass(DEFAULT_RULES.allowMulticlass);
      setRuleSuggestions(true); setRewardsAutomatic(false); setPlayerFreeEdit(true);
      setBannedPackIds([]); setHomebrewNeedsApproval(false);
    }
  }, [visible]);

  const compatibleProfiles = profilesForRuleset(profiles, rulesetId);
  // Picking a profile pre-fills the quick toggles from it; the DM can still adjust them after —
  // this effect only fires on profile CHANGE, never overwriting a toggle the DM already touched
  // for the currently-selected profile.
  useEffect(() => {
    const profile = profileId ? profiles.find(p => p.id === profileId) : null;
    const resolved = profile ? sanitizeProfileRules(profile.rules) : {};
    setMaxLevel(resolved.maxLevel !== undefined ? resolved.maxLevel : DEFAULT_RULES.maxLevel);
    setAllowMulticlass(resolved.allowMulticlass ?? DEFAULT_RULES.allowMulticlass);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileId]);

  function buildRules(): CampaignRules {
    const profile = profileId ? profiles.find(p => p.id === profileId) : null;
    const resolved = profile ? sanitizeProfileRules(profile.rules) : {};
    return {
      ...DEFAULT_RULES, ...resolved,
      maxLevel, allowMulticlass,
      customRules: {
        ...DEFAULT_RULES.customRules, ...(resolved.customRules ?? {}),
        lockPlayerFreeEdit: !playerFreeEdit,
        ruleSuggestionsEnabled: ruleSuggestions,
        permanentRewardsAutomatic: rewardsAutomatic,
        homebrewNeedsApproval,
      },
    };
  }

  async function handleCreate() {
    const trimmed = name.trim();
    if (!trimmed || !session) return;
    setLoading(true);
    try {
      // createCampaign is offline state only: it opens no server and allocates no room code (Host Session does that later).
      await createCampaign({
        name: trimmed, description, rulesetId, rules: buildRules(),
        bannedPackIds,
      });
      onClose();
    } catch (e) { showError('Error', String(e)); }
    finally { setLoading(false); }
  }

  const stepIndex = WIZ_STEPS.indexOf(step);
  const canNext = step !== 'Basics' || !!name.trim();
  function goNext() { if (canNext) setStep(WIZ_STEPS[Math.min(stepIndex + 1, WIZ_STEPS.length - 1)]); }
  function goBack() { setStep(WIZ_STEPS[Math.max(stepIndex - 1, 0)]); }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable style={styles.backdropTapArea} onPress={onClose} accessible={false} />
        <View style={[styles.modalSheet, styles.wizSheet]}>
          <Text style={styles.wizStepLabel}>Step {stepIndex + 1} of {WIZ_STEPS.length}</Text>
          <Text style={styles.modalTitle}>{step === 'Basics' ? 'New Campaign' : step}</Text>

          <ScrollView style={styles.wizScroll} keyboardShouldPersistTaps="handled">
            {step === 'Basics' && (
              <View style={{ gap: Spacing.sm }}>
                <TextInput style={styles.input} value={name} onChangeText={setName}
                  placeholder="Campaign name…" placeholderTextColor={Colors.textDim} autoFocus testID="wiz-name" />
                <TextInput style={[styles.input, styles.notesInput]} value={description} onChangeText={setDescription}
                  placeholder="Description (optional)…" placeholderTextColor={Colors.textDim} multiline textAlignVertical="top" testID="wiz-description" />
                <Text style={styles.wizFieldLabel}>Ruleset (optional)</Text>
                <GameRulesetPicker value={rulesetId} onChange={setRulesetId} defaultGameId={gameIdForRuleset(rulesetId)} />
              </View>
            )}

            {step === 'Rules' && (
              <View style={{ gap: Spacing.sm }}>
                <Text style={styles.wizFieldLabel}>Rule profile</Text>
                <View style={styles.wizChipRow}>
                  <WizChip label="Defaults" active={profileId === null} onPress={() => setProfileId(null)} testID="wiz-profile-default" />
                  {compatibleProfiles.map(p => (
                    <WizChip key={p.id} label={p.name} active={profileId === p.id} onPress={() => setProfileId(p.id)} testID={`wiz-profile-${p.name}`} />
                  ))}
                </View>
                {compatibleProfiles.length === 0 && <Text style={styles.wizHint}>No saved rule profiles for this ruleset yet — build one under Homebrew → Custom Rule Profile.</Text>}

                <Text style={styles.wizFieldLabel}>Max level</Text>
                <View style={styles.wizChipRow}>
                  {[null, 5, 10, 15, 20].map(lvl => (
                    <WizChip key={String(lvl)} label={lvl === null ? 'Uncapped' : `Lv ${lvl}`} active={maxLevel === lvl} onPress={() => setMaxLevel(lvl)} testID={`wiz-maxlevel-${lvl ?? 'uncapped'}`} />
                  ))}
                </View>
                <WizToggle label="Allow multiclassing" value={allowMulticlass} onChange={setAllowMulticlass} testID="wiz-multiclass" />
              </View>
            )}

            {step === 'Permissions' && (
              <View style={{ gap: Spacing.sm }}>
                <WizToggle label="Player rule suggestions" hint="Players can propose house-rule changes for you to review." value={ruleSuggestions} onChange={setRuleSuggestions} testID="wiz-rule-suggestions" />
                <WizToggle label="Player Free Edit" hint="Players can freely edit their own sheet without DM approval." value={playerFreeEdit} onChange={setPlayerFreeEdit} testID="wiz-free-edit" />
                <Text style={styles.wizFieldLabel}>Permanent DM rewards</Text>
                <View style={styles.wizChipRow}>
                  <WizChip label="Needs approval" active={!rewardsAutomatic} onPress={() => setRewardsAutomatic(false)} testID="wiz-rewards-approval" />
                  <WizChip label="Automatic" active={rewardsAutomatic} onPress={() => setRewardsAutomatic(true)} testID="wiz-rewards-automatic" />
                </View>
              </View>
            )}

            {step === 'Content' && (
              <View style={{ gap: Spacing.sm }}>
                <WizToggle label="Homebrew needs DM approval" hint="Off: a player's homebrew content is allowed automatically." value={homebrewNeedsApproval} onChange={setHomebrewNeedsApproval} testID="wiz-homebrew-approval" />
                {installedPacks.length > 0 && (
                  <>
                    <Text style={styles.wizFieldLabel}>Allowed homebrew packs</Text>
                    {installedPacks.map(pack => {
                      const banned = bannedPackIds.includes(pack.id);
                      return (
                        <Pressable key={pack.id} style={styles.packRow}
                          onPress={() => setBannedPackIds(ids => banned ? ids.filter(id => id !== pack.id) : [...ids, pack.id])}>
                          <View style={{ flex: 1 }}><Text style={styles.packName}>{pack.name}</Text></View>
                          <View style={[styles.packToggle, banned && styles.packToggleBanned]}>
                            <Text style={[styles.packToggleTxt, banned && styles.packToggleTxtBanned]}>{banned ? 'Banned' : 'Allowed'}</Text>
                          </View>
                        </Pressable>
                      );
                    })}
                  </>
                )}
                {installedPacks.length === 0 && <Text style={styles.wizHint}>No homebrew packs installed on this device yet.</Text>}
              </View>
            )}

            {step === 'Review' && (
              <View style={{ gap: Spacing.sm }}>
                <Text style={styles.wizReviewLine}><Text style={styles.wizReviewLabel}>Name: </Text>{name.trim() || '(not set)'}</Text>
                {!!description.trim() && <Text style={styles.wizReviewLine}><Text style={styles.wizReviewLabel}>Description: </Text>{description.trim()}</Text>}
                <Text style={styles.wizReviewLine}><Text style={styles.wizReviewLabel}>Ruleset: </Text>{rulesetId ?? 'Any'}</Text>
                <Text style={styles.wizReviewLine}><Text style={styles.wizReviewLabel}>Rule profile: </Text>{profileId ? (profiles.find(p => p.id === profileId)?.name ?? 'Custom') : 'Defaults'}</Text>
                <Text style={styles.wizReviewLine}><Text style={styles.wizReviewLabel}>Max level: </Text>{maxLevel ?? 'Uncapped'} · <Text style={styles.wizReviewLabel}>Multiclass: </Text>{allowMulticlass ? 'Allowed' : 'Off'}</Text>
                <Text style={styles.wizReviewLine}><Text style={styles.wizReviewLabel}>Rule suggestions: </Text>{ruleSuggestions ? 'On' : 'Off'} · <Text style={styles.wizReviewLabel}>Free Edit: </Text>{playerFreeEdit ? 'On' : 'Off'}</Text>
                <Text style={styles.wizReviewLine}><Text style={styles.wizReviewLabel}>Permanent rewards: </Text>{rewardsAutomatic ? 'Automatic' : 'Needs approval'}</Text>
                <Text style={styles.wizReviewLine}><Text style={styles.wizReviewLabel}>Homebrew: </Text>{homebrewNeedsApproval ? 'Needs approval' : 'Automatically allowed'}{bannedPackIds.length > 0 ? ` · ${bannedPackIds.length} pack(s) banned` : ''}</Text>
              </View>
            )}
          </ScrollView>

          <View style={styles.wizFooter}>
            {step !== 'Basics' && (
              <Pressable style={styles.cancelBtn} onPress={goBack} testID="wiz-back">
                <Text style={styles.cancelTxt}>Back</Text>
              </Pressable>
            )}
            {step !== 'Review' ? (
              <Pressable style={[styles.primaryBtn, { flex: 2 }, !canNext && styles.btnDisabled]} onPress={goNext} disabled={!canNext} testID="wiz-next">
                <Text style={styles.primaryBtnTxt}>Next</Text>
              </Pressable>
            ) : (
              <Pressable style={[styles.primaryBtn, { flex: 2 }, (!name.trim() || loading) && styles.btnDisabled]}
                onPress={handleCreate} disabled={!name.trim() || loading} testID="wiz-create">
                {loading ? <ActivityIndicator color={Colors.bg} /> : <Text style={styles.primaryBtnTxt}>Create Campaign</Text>}
              </Pressable>
            )}
          </View>
          <Pressable style={styles.cancelBtn} onPress={onClose}>
            <Text style={styles.cancelTxt}>Cancel</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// Joining is now exclusively through Live Session (see LiveJoinModal, wired below) — a Player
// no longer attaches directly to a DM's persistent campaignStore campaign by room code. They
// join the temporary live room, and get that campaign's content once the DM attaches it there
// (CAMPAIGN_DM_AUTHORITY_RULES.md / JOIN_SESSION_FLOW_SPEC.md). The old per-campaign join modal
// that lived here is gone; CreateModal above is unaffected since campaign creation/management is
// still local-first and independent of any live room.

// ── Campaign Overview Sections ────────────────────────────────────────────────
// Used by both DM and Player views; editable=true only for the DM.

// ── Notes Section ─────────────────────────────────────────────────────────────

function NotesSection({ notes, editable, onChange }: {
  notes: string; editable: boolean; onChange: (n: string) => void;
}) {
  // The DM's notes never leave the DM's device (sync/protocol.ts redactForPlayers), so the section says so.
  const [local, setLocal] = useState(notes);
  useEffect(() => setLocal(notes), [notes]);

  return (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>DM NOTES (PRIVATE, NOT SENT TO PLAYERS)</Text>
      {editable ? (
        <TextInput
          style={[styles.input, styles.notesInput]}
          value={local}
          onChangeText={setLocal}
          onBlur={() => onChange(local)}
          placeholder="Add notes, world details, reminders…"
          placeholderTextColor={Colors.textDim}
          multiline
          textAlignVertical="top"
        />
      ) : local ? (
        <Text style={styles.notesReadOnly}>{local}</Text>
      ) : (
        <Text style={styles.emptyNote}>No campaign notes yet.</Text>
      )}
    </View>
  );
}

// ── Quest Status Chip ─────────────────────────────────────────────────────────

const QUEST_STATUS_COLORS: Record<Quest['status'], string> = {
  active:    Colors.green,
  completed: Colors.gold,
  failed:    Colors.red,
};
const QUEST_STATUS_LABELS: Record<Quest['status'], string> = {
  active: 'Active', completed: 'Done', failed: 'Failed',
};

function QuestChip({ status }: { status: Quest['status'] }) {
  const color = QUEST_STATUS_COLORS[status];
  return (
    <View style={[styles.questChip, { borderColor: color + '66', backgroundColor: color + '22' }]}>
      <Text style={[styles.questChipTxt, { color }]}>{QUEST_STATUS_LABELS[status]}</Text>
    </View>
  );
}

// ── Quests Section ────────────────────────────────────────────────────────────

function QuestsSection({ quests, editable, onUpdate }: {
  quests: Quest[];
  editable: boolean;
  onUpdate: (quests: Quest[]) => void;
}) {
  const [addModal, setAddModal] = useState(false);
  const [addName,  setAddName]  = useState('');
  const [addDesc,  setAddDesc]  = useState('');

  function addQuest() {
    if (!addName.trim()) return;
    const newQuest: Quest = {
      id: genId(), name: addName.trim(),
      description: addDesc.trim(), status: 'active',
    };
    onUpdate([...quests, newQuest]);
    setAddName(''); setAddDesc(''); setAddModal(false);
  }

  function cycleStatus(id: string) {
    const cycle: Record<Quest['status'], Quest['status']> = {
      active: 'completed', completed: 'failed', failed: 'active',
    };
    onUpdate(quests.map(q => q.id === id ? { ...q, status: cycle[q.status] } : q));
  }

  function deleteQuest(id: string) {
    Alert.alert('Remove Quest?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => onUpdate(quests.filter(q => q.id !== id)) },
    ]);
  }

  return (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>QUESTS</Text>

      {quests.length === 0 ? (
        <Text style={styles.emptyNote}>{editable ? 'No quests yet. Add one below.' : 'No quests yet.'}</Text>
      ) : (
        quests.map(q => (
          <View key={q.id} style={styles.questRow}>
            <QuestChip status={q.status} />
            <View style={styles.questBody}>
              <Text style={styles.questName}>{q.name}</Text>
              {q.description ? <Text style={styles.questDesc} numberOfLines={2}>{q.description}</Text> : null}
            </View>
            {editable && (
              <View style={styles.questActions}>
                <Pressable style={styles.questActionBtn} onPress={() => cycleStatus(q.id)} hitSlop={8}>
                  <Text style={styles.questActionTxt}>↻</Text>
                </Pressable>
                <Pressable style={styles.questActionBtn} onPress={() => deleteQuest(q.id)} hitSlop={8}>
                  <Text style={[styles.questActionTxt, { color: Colors.red }]}>✕</Text>
                </Pressable>
              </View>
            )}
          </View>
        ))
      )}

      {editable && (
        <Pressable style={styles.addBtn} onPress={() => setAddModal(true)}>
          <Text style={styles.addBtnTxt}>+ Add Quest</Text>
        </Pressable>
      )}

      <Modal visible={addModal} transparent animationType="slide" onRequestClose={() => setAddModal(false)}>
        <KeyboardAvoidingView
          style={styles.backdrop}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <Pressable style={styles.backdropTapArea} onPress={() => setAddModal(false)} />
          <Pressable style={styles.modalSheet} onPress={e => e.stopPropagation()}>
            <Text style={styles.modalTitle}>New Quest</Text>
            <TextInput style={styles.input} value={addName} onChangeText={setAddName}
              placeholder="Quest name…" placeholderTextColor={Colors.textDim} autoFocus />
            <TextInput style={[styles.input, styles.notesInput]} value={addDesc} onChangeText={setAddDesc}
              placeholder="Description (optional)…" placeholderTextColor={Colors.textDim}
              multiline textAlignVertical="top" />
            <View style={styles.modalBtns}>
              <Pressable style={styles.cancelBtn} onPress={() => setAddModal(false)}>
                <Text style={styles.cancelTxt}>Cancel</Text>
              </Pressable>
              <Pressable style={[styles.primaryBtn, { flex: 2 }, !addName.trim() && styles.btnDisabled]}
                onPress={addQuest} disabled={!addName.trim()}>
                <Text style={styles.primaryBtnTxt}>Add Quest</Text>
              </Pressable>
            </View>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

// ── Session Log Section ───────────────────────────────────────────────────────

function SessionLogSection({ log, editable, onUpdate }: {
  log: SessionLogEntry[];
  editable: boolean;
  onUpdate: (log: SessionLogEntry[]) => void;
}) {
  const [addModal,  setAddModal]  = useState(false);
  const [addText,   setAddText]   = useState('');
  const [collapsed, setCollapsed] = useState(true);   // show only 3 entries initially

  function addEntry() {
    if (!addText.trim()) return;
    const entry: SessionLogEntry = { id: genId(), summary: addText.trim(), date: Date.now() };
    onUpdate([entry, ...log]);   // newest first
    setAddText(''); setAddModal(false); setCollapsed(false);
  }

  function deleteEntry(id: string) {
    onUpdate(log.filter(e => e.id !== id));
  }

  const visible = collapsed ? log.slice(0, 3) : log;

  return (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>SESSION LOG</Text>

      {log.length === 0 ? (
        <Text style={styles.emptyNote}>
          {editable ? 'No sessions logged yet. Add a summary after each session.' : 'No sessions logged yet.'}
        </Text>
      ) : (
        <>
          {visible.map(entry => (
            <View key={entry.id} style={styles.logEntry}>
              <View style={styles.logEntryHeader}>
                <Text style={styles.logDate}>{formatDate(entry.date)}</Text>
                {editable && (
                  <Pressable onPress={() => deleteEntry(entry.id)} hitSlop={8}>
                    <Text style={styles.logDeleteTxt}>✕</Text>
                  </Pressable>
                )}
              </View>
              <Text style={styles.logSummary}>{entry.summary}</Text>
            </View>
          ))}
          {log.length > 3 && (
            <Pressable onPress={() => setCollapsed(v => !v)}>
              <Text style={styles.showMoreTxt}>
                {collapsed ? `Show ${log.length - 3} more…` : 'Show less'}
              </Text>
            </Pressable>
          )}
        </>
      )}

      {editable && (
        <Pressable style={styles.addBtn} onPress={() => setAddModal(true)}>
          <Text style={styles.addBtnTxt}>+ Add Session Note</Text>
        </Pressable>
      )}

      <Modal visible={addModal} transparent animationType="slide" onRequestClose={() => setAddModal(false)}>
        <KeyboardAvoidingView
          style={styles.backdrop}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <Pressable style={styles.backdropTapArea} onPress={() => setAddModal(false)} />
          <Pressable style={styles.modalSheet} onPress={e => e.stopPropagation()}>
            <Text style={styles.modalTitle}>Session Note</Text>
            <Text style={styles.modalSub}>{formatDate(Date.now())}</Text>
            <TextInput style={[styles.input, styles.notesInput]} value={addText}
              onChangeText={setAddText}
              placeholder="What happened this session? Key events, decisions, loot…"
              placeholderTextColor={Colors.textDim} multiline textAlignVertical="top" autoFocus />
            <View style={styles.modalBtns}>
              <Pressable style={styles.cancelBtn} onPress={() => setAddModal(false)}>
                <Text style={styles.cancelTxt}>Cancel</Text>
              </Pressable>
              <Pressable style={[styles.primaryBtn, { flex: 2 }, !addText.trim() && styles.btnDisabled]}
                onPress={addEntry} disabled={!addText.trim()}>
                <Text style={styles.primaryBtnTxt}>Save Entry</Text>
              </Pressable>
            </View>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

// ── Campaign Content Section (item 15 — campaign content manifest) ─────────────
// DM-only: ban specific installed homebrew packs from this campaign. Native-
// only (SQLite-backed loadInstalledPacks, same as homebrew.tsx's
// InstalledPacksPanel it mirrors) — renders nothing on web or when no packs
// are installed, rather than showing a permanently-empty section.

function CampaignContentSection({ bannedPackIds, onUpdate }: {
  bannedPackIds: string[];
  onUpdate: (ids: string[]) => void;
}) {
  const [packs, setPacks] = useState<InstalledPack[]>([]);

  useEffect(() => {
    loadInstalledPacks().then(setPacks).catch(e => console.error('[campaigns] loadInstalledPacks failed:', e));
  }, []);

  if (packs.length === 0) return null;

  function toggle(packId: string) {
    onUpdate(bannedPackIds.includes(packId) ? bannedPackIds.filter(id => id !== packId) : [...bannedPackIds, packId]);
  }

  return (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>CAMPAIGN CONTENT</Text>
      <Text style={styles.emptyNote}>
        Ban an installed homebrew pack from this campaign — banned content won't appear when players build or level up a character here.
      </Text>
      {packs.map(pack => {
        const banned = bannedPackIds.includes(pack.id);
        return (
          <Pressable key={pack.id} style={styles.packRow} onPress={() => toggle(pack.id)}>
            <View style={{ flex: 1 }}>
              <Text style={styles.packName}>{pack.name}</Text>
              <Text style={styles.packMeta}>{pack.itemRefs.length} item{pack.itemRefs.length !== 1 ? 's' : ''}</Text>
            </View>
            <View style={[styles.packToggle, banned && styles.packToggleBanned]}>
              <Text style={[styles.packToggleTxt, banned && styles.packToggleTxtBanned]}>
                {banned ? 'Banned' : 'Allowed'}
              </Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

// ── Party Section ─────────────────────────────────────────────────────────────

function PartySection({ characterIds }: { characterIds: string[] }) {
  const characters = useCharacterStore(s => s.characters);
  const partyChars = characters.filter(c => characterIds.includes(c.id));
  if (partyChars.length === 0) return null;

  return (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>PARTY</Text>
      {partyChars.map(c => {
        const hpPct   = c.resources.hp.maximum > 0
          ? c.resources.hp.current / c.resources.hp.maximum : 0;
        const hpColor = hpPct > 0.5 ? Colors.green : hpPct > 0.25 ? Colors.gold : Colors.red;
        return (
          <View key={c.id} style={styles.partyCard}>
            <View style={styles.partyInfo}>
              <Text style={styles.partyName}>{c.identity.name || 'Unnamed'}</Text>
              <Text style={styles.partySub}>
                Lv {c.identity.level} · {identityLabelsFor(c).class || '—'}
              </Text>
            </View>
            <View style={styles.partyRight}>
              <Text style={[styles.hpTxt, { color: hpColor }]}>
                {c.resources.hp.current}/{c.resources.hp.maximum} HP
              </Text>
              <View style={styles.hpBarOuter}>
                <View style={[styles.hpBarFill, {
                  width: `${Math.round(Math.max(0, Math.min(1, hpPct)) * 100)}%` as any,
                  backgroundColor: hpColor,
                }]} />
              </View>
            </View>
          </View>
        );
      })}
    </View>
  );
}

// ── DM Active View ────────────────────────────────────────────────────────────

function DmActiveView() {
  const router         = useRouter();
  const activeCampaign = useCampaignStore(s => s.activeCampaign);
  const updateCampaign = useCampaignStore(s => s.updateCampaign);
  const liveSession      = useCampaignStore(s => s.liveSession);
  const startLiveSession = useCampaignStore(s => s.startLiveSession);
  const endLiveSession   = useCampaignStore(s => s.endLiveSession);
  const leaveCampaign    = useCampaignStore(s => s.leaveCampaign);
  const syncStatus     = useSyncStore(s => s.status);
  const liveNickname   = useSessionStore(s => s.session?.nickname ?? '');
  const [hostOpen, setHostOpen] = useState(false);
  const [starting, setStarting] = useState(false);

  if (!activeCampaign) return null;

  // A room code exists only during a live session; an offline campaign has none.
  const roomCode   = liveSession ? (syncStatus.roomCode ?? activeCampaign.joinCode) : '';
  const quests     = activeCampaign.quests ?? [];
  const log        = activeCampaign.sessionLog ?? [];
  const campaignId = activeCampaign.id;   // captured after null guard for closure safety

  function save(patch: Partial<typeof activeCampaign>) {
    updateCampaign(campaignId, c => ({ ...c, ...patch }));
  }

  function confirmEnd() {
    // Bug fix: this used to permanently delete the campaign (leaveCampaign's
    // old DM behavior) — now it just stops hosting and disconnects any
    // connected players, same as a network outage. The campaign itself is
    // untouched and can be resumed later from the campaign list (a DM can
    // own more than one campaign now — see campaignStore.switchToCampaign).
    Alert.alert('End Live Session', 'Players currently connected will be disconnected. The campaign stays as it is and you can host another session any time.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'End Live Session', style: 'destructive', onPress: () => { void endLiveSession(); } },
    ]);
  }

  // Leaves this campaign without deleting it: a live session (if any) is announced and stopped, and the Campaigns page returns to
  // Create / Open Existing / Join, so a DM can start or open another campaign. The campaign stays saved and can be reopened.
  function confirmClose() {
    Alert.alert(
      'Close Campaign',
      liveSession
        ? 'Players currently connected will be disconnected. "' + activeCampaign!.name + '" stays saved; you can reopen it or start another campaign.'
        : '"' + activeCampaign!.name + '" stays saved; you can reopen it or start another campaign.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Close Campaign', onPress: () => { void leaveCampaign(); } },
      ],
    );
  }

  async function beginLiveSession() {
    setStarting(true);
    try { await startLiveSession(); }
    catch (e) { Alert.alert('Could not start the session', e instanceof Error ? e.message : 'Try again.'); }
    finally { setStarting(false); }
  }

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <CampaignPacksNote campaign={activeCampaign} />

      {/* Connection block */}
      <View style={styles.campaignCard}>
        <View style={styles.campaignHeaderRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.campaignName}>{activeCampaign.name}</Text>
            <View style={styles.syncRow}>
              <SyncStatusDot />
              <Text style={styles.campaignMeta}>
                {!liveSession
                  ? 'Offline campaign, no live session'
                  : syncStatus.connected
                    ? `${syncStatus.clientCount} player${syncStatus.clientCount !== 1 ? 's' : ''} connected`
                    : 'Starting server…'}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.codeSection}>
          {roomCode ? (
            <>
              <Text style={styles.codeLabel}>ROOM CODE</Text>
              <Text style={styles.codeValue}>{roomCode}</Text>
              <Text style={styles.codeHint}>Players enter this code or scan the QR below</Text>
              {(() => {
                try {
                  const { ip } = decodeRoomCode(roomCode);
                  return (
                    <Text style={styles.codeDiag}>
                      Hosting on {ip}:7742 — this must match this phone's WiFi IP, and
                      players must be on the same network.
                    </Text>
                  );
                } catch { return null; }
              })()}
            </>
          ) : (
            // Non-blocking recommendation, not an error — the campaign is
            // fully open and this device is fully the host (CampaignHost is
            // a session/role concept, independent of
            // NetworkHostAvailability). Only joining is unavailable right
            // now; this updates on its own the moment a usable network
            // appears (syncManager's network watch), with no action needed
            // here and nothing to dismiss.
            <View style={styles.noNetworkNotice}>
              <Text style={styles.noNetworkTxt}>
                {liveSession
                  ? 'No local network is available. The session is started, but other players cannot join until a network appears. Enable Wi-Fi or a mobile hotspot.'
                  : 'This campaign works offline: the DM dashboard, rules and encounters need no network. Start a live session when you want players to join.'}
              </Text>
            </View>
          )}
        </View>

        {Platform.OS !== 'web' && roomCode ? (
          <View style={styles.qrContainer}>
            <QRCode value={roomCode} size={160}
              color={Colors.textPrimary} backgroundColor={Colors.surface} />
          </View>
        ) : null}

        <Pressable style={styles.dmBtn} onPress={() => router.push('/dm/dashboard' as any)}>
          <Text style={styles.dmBtnTxt}>🎲 Open DM Dashboard</Text>
        </Pressable>
        {liveSession ? (
          <Pressable style={[styles.dmBtn, styles.dmBtnSecondary]} onPress={confirmEnd} testID="campaign-end-live-session">
            <Text style={[styles.dmBtnTxt, { color: Colors.red }]}>⏹ End Live Session</Text>
          </Pressable>
        ) : (
          <Pressable style={[styles.dmBtn, styles.dmBtnSecondary, starting && { opacity: 0.6 }]} disabled={starting} onPress={() => { void beginLiveSession(); }} testID="campaign-host-session">
            <Text style={[styles.dmBtnTxt, { color: Colors.textPrimary }]}>{starting ? 'Starting…' : '📡 Host Session'}</Text>
          </Pressable>
        )}
        <Pressable style={[styles.dmBtn, styles.dmBtnSecondary]} onPress={() => setHostOpen(true)} testID="campaign-host-live-session">
          <Text style={[styles.dmBtnTxt, { color: Colors.textPrimary }]}>🛰 Host Live Table (advanced)</Text>
        </Pressable>
        <Pressable style={[styles.dmBtn, styles.dmBtnSecondary]} onPress={confirmClose} testID="campaign-close">
          <Text style={[styles.dmBtnTxt, { color: Colors.textPrimary }]}>↩ Close Campaign / Switch</Text>
        </Pressable>
      </View>

      {/*
        Per HOST_SESSION_FLOW_SPEC.md: "Create Campaign = persistent DM workspace. Host Session =
        temporary live room." This campaign's own room code above is the legacy system; a Live
        Session is the separate, newer Host/DM/Player layer (room code on a different port). This
        is where that temporary room is started from inside an already-open campaign, pre-set to
        Host + DM since a campaign is already in hand. Attaching THIS campaign's content to the
        room is then done from the DM screen's own link-campaign action once hosting starts.
      */}
      <HostModal visible={hostOpen} onClose={() => setHostOpen(false)} nickname={liveNickname} initialRole="host+dm" />

      {/* Overview sections */}
      <NotesSection
        notes={activeCampaign.notes}
        editable
        onChange={notes => save({ notes })}
      />
      <QuestsSection
        quests={quests}
        editable
        onUpdate={q => save({ quests: q })}
      />
      <SessionLogSection
        log={log}
        editable
        onUpdate={l => save({ sessionLog: l })}
      />
      <CampaignContentSection
        bannedPackIds={activeCampaign.bannedPackIds ?? []}
        onUpdate={ids => save({ bannedPackIds: ids })}
      />
      <PartySection characterIds={activeCampaign.characterIds} />

      {/* Only while a live session runs: an offline campaign is not hosting, so it offers no Stop Hosting. */}
      {liveSession ? (
        <Pressable style={styles.leaveBtn} onPress={confirmEnd} testID="campaign-stop-hosting">
          <Text style={styles.leaveBtnTxt}>⏸ Stop Hosting</Text>
        </Pressable>
      ) : null}

    </ScrollView>
  );
}

// ── Player Active View ────────────────────────────────────────────────────────

function PlayerActiveView() {
  const activeCampaign = useCampaignStore(s => s.activeCampaign);
  const leaveCampaign  = useCampaignStore(s => s.leaveCampaign);
  const assignCharacter = useCampaignStore(s => s.assignCharacterToCampaign);
  const reconnectWithCode = useCampaignStore(s => s.reconnectWithCode);
  const syncStatus     = useSyncStore(s => s.status);
  const characters     = useCharacterStore(s => s.characters);
  const [claimOpen, setClaimOpen] = useState(false);
  const [reconnectOpen, setReconnectOpen] = useState(false);
  const [reconnectCode, setReconnectCode] = useState('');
  const [retrying, setRetrying] = useState(false);

  if (!activeCampaign) return null;

  const quests = activeCampaign.quests ?? [];
  const log    = activeCampaign.sessionLog ?? [];
  const myChar = characters.find(c => activeCampaign.characterIds.includes(c.id)) ?? null;
  const campaignId = activeCampaign.id;
  const joinCode    = activeCampaign.joinCode;

  async function claim(characterId: string) {
    // assignCharacterToCampaign already pushes the entity to the DM and announces
    // the claimed character over sync, so we don't repeat those calls here.
    await assignCharacter(characterId, campaignId);
    setClaimOpen(false);
  }

  // Item 16 (LAN/session UX) — one tap, no retyping: the stored room code
  // is almost always still correct (the connection dropped, not the DM's
  // room), so reconnectWithCode(activeCampaign.joinCode) alone recovers
  // the common case. The "Enter a new room code" flow below stays for the
  // real edge case — the DM's IP actually changed (different network).
  async function handleRetrySavedCode() {
    setRetrying(true);
    try {
      await reconnectWithCode(joinCode);
    } catch (e) {
      showError('Reconnect failed', String(e));
    } finally {
      setRetrying(false);
    }
  }

  function confirmLeave() {
    Alert.alert('Leave Campaign', 'You will leave this campaign. Continue?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Leave', style: 'destructive', onPress: async () => {
          syncManager.claimCharacter(null);
          syncManager.stopAll();
          await leaveCampaign();
        }
      },
    ]);
  }

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <CampaignPacksNote campaign={activeCampaign} />

      {/* Status block */}
      <View style={styles.campaignCard}>
        <Text style={styles.campaignName}>{activeCampaign.name}</Text>
        <View style={styles.syncRow}>
          <SyncStatusDot />
          <Text style={styles.campaignMeta}>
            {syncStatus.connected
              ? 'Connected to DM'
              // lastError is only set once the client's own retry budget is
              // exhausted (~3.5 minutes of backoff) — until then this stays
              // "Reconnecting…" so the two states read differently instead
              // of showing the same passive text for the whole window.
              : syncStatus.lastError ? 'Connection lost' : 'Reconnecting…'}
          </Text>
        </View>
        {!syncStatus.connected && syncStatus.lastError && (
          <Text style={styles.syncErrorTxt}>{syncStatus.lastError}</Text>
        )}
        {!syncStatus.connected && !reconnectOpen && (
          <Pressable style={[styles.retryBtn, retrying && styles.retryBtnDisabled]} onPress={handleRetrySavedCode} disabled={retrying}>
            <Text style={styles.retryBtnTxt}>{retrying ? 'Retrying…' : '🔄 Retry Connection'}</Text>
          </Pressable>
        )}
        {!syncStatus.connected && (
          reconnectOpen ? (
            <View style={styles.reconnectBox}>
              <Text style={styles.reconnectHint}>
                Ask your DM for the current room code and enter it:
              </Text>
              <TextInput
                style={styles.reconnectInput}
                value={reconnectCode}
                onChangeText={t => setReconnectCode(t.toUpperCase())}
                placeholder="7-char code"
                placeholderTextColor={Colors.textDim}
                autoCapitalize="characters"
                maxLength={7}
              />
              <View style={styles.reconnectRow}>
                <Pressable
                  style={[styles.reconnectBtn, reconnectCode.trim().length !== 7 && styles.reconnectBtnDisabled]}
                  disabled={reconnectCode.trim().length !== 7}
                  onPress={async () => {
                    try {
                      await reconnectWithCode(reconnectCode);
                      setReconnectOpen(false);
                      setReconnectCode('');
                    } catch (e) {
                      showError('Reconnect failed', String(e));
                    }
                  }}
                >
                  <Text style={styles.reconnectBtnTxt}>Reconnect</Text>
                </Pressable>
                <Pressable style={styles.reconnectCancel} onPress={() => { setReconnectOpen(false); setReconnectCode(''); }}>
                  <Text style={styles.reconnectCancelTxt}>Cancel</Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <Pressable style={styles.reEnterLink} onPress={() => setReconnectOpen(true)}>
              <Text style={styles.reEnterTxt}>DM's room code changed? Enter a new one →</Text>
            </Pressable>
          )
        )}
      </View>

      {/* Your character */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>YOUR CHARACTER</Text>
        {myChar ? (
          <View style={styles.partyCard}>
            <View style={styles.partyInfo}>
              <Text style={styles.partyName}>{myChar.identity.name || 'Unnamed'}</Text>
              <Text style={styles.partySub}>Lv {myChar.identity.level} · {identityLabelsFor(myChar).class || '—'}</Text>
            </View>
            <Pressable onPress={() => setClaimOpen(true)}>
              <Text style={styles.changeLink}>Change</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable style={styles.addBtn} onPress={() => setClaimOpen(true)}>
            <Text style={styles.addBtnTxt}>+ Choose your character</Text>
          </Pressable>
        )}
      </View>

      {/* Overview sections — read-only */}
      {/* the DM's notes are private: players are not sent them */}
      {quests.length > 0 && (
        <QuestsSection
          quests={quests}
          editable={false}
          onUpdate={() => {}}
        />
      )}
      {log.length > 0 && (
        <SessionLogSection
          log={log}
          editable={false}
          onUpdate={() => {}}
        />
      )}
      <PartySection characterIds={activeCampaign.characterIds} />

      <Pressable style={styles.leaveBtn} onPress={confirmLeave}>
        <Text style={styles.leaveBtnTxt}>🚪 Leave Campaign</Text>
      </Pressable>

      {/* Character picker modal */}
      <Modal visible={claimOpen} transparent animationType="slide" onRequestClose={() => setClaimOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setClaimOpen(false)}>
          <Pressable style={styles.modalSheet} onPress={e => e.stopPropagation()}>
            <Text style={styles.modalTitle}>Choose Your Character</Text>
            {characters.length === 0 ? (
              <Text style={styles.emptyNote}>You have no characters yet. Create one first.</Text>
            ) : (
              characters.map(c => (
                <Pressable key={c.id} style={styles.pickRow} onPress={() => claim(c.id)}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.partyName}>{c.identity.name || 'Unnamed'}</Text>
                    <Text style={styles.partySub}>Lv {c.identity.level} · {identityLabelsFor(c).class || '—'}</Text>
                  </View>
                  {myChar?.id === c.id && <Text style={styles.changeLink}>✓</Text>}
                </Pressable>
              ))
            )}
            <Pressable style={styles.cancelBtn} onPress={() => setClaimOpen(false)}>
              <Text style={styles.cancelTxt}>Cancel</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

    </ScrollView>
  );
}

// ── Open Existing Campaign ────────────────────────────────────────────────────
// Per CAMPAIGN_PAGE_MODEL_SPEC.md: "Continue one of your existing campaigns" — a DM can own/keep
// several but only hosts one at a time, and this is also how a device gets back to a campaign it
// was playing in as a Player (campaignStore's switchToCampaign/leaveCampaign — leaving used to
// permanently delete a DM's campaign, so this had nothing to show before that was fixed).

function OpenCampaignModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const campaigns         = useCampaignStore(s => s.campaigns);
  const switchToCampaign  = useCampaignStore(s => s.switchToCampaign);
  const deleteCampaign    = useCampaignStore(s => s.deleteCampaignPermanently);
  const session           = useSessionStore(s => s.session);
  const [switchingId, setSwitchingId] = useState<string | null>(null);

  async function handleResume(id: string) {
    if (switchingId) return;
    setSwitchingId(id);
    try {
      await switchToCampaign(id);
      onClose();
    } catch (e: any) {
      Alert.alert('Couldn’t open campaign', e?.message ?? String(e));
    } finally {
      setSwitchingId(null);
    }
  }

  function confirmDelete(c: Campaign) {
    Alert.alert('Delete Campaign', `Permanently delete "${c.name}"? This can’t be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => { void deleteCampaign(c.id); } },
    ]);
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.backdrop} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={styles.backdropTapArea} onPress={onClose} />
        <Pressable style={styles.modalSheet} onPress={e => e.stopPropagation()}>
          <Text style={styles.modalTitle}>Open Existing Campaign</Text>
          {campaigns.length === 0 ? (
            <Text style={styles.emptyNote}>No saved campaigns yet — create one first.</Text>
          ) : (
            campaigns.map(c => {
              const isDm = session?.deviceId === c.dmDeviceId;
              return (
                <View key={c.id} style={styles.savedRow}>
                  <Pressable style={{ flex: 1 }} onPress={() => { void handleResume(c.id); }} disabled={switchingId !== null}>
                    <Text style={styles.savedRowName}>{c.name}</Text>
                    <Text style={styles.savedRowMeta}>{isDm ? '👑 You DM this' : '🗡 You play in this'}</Text>
                  </Pressable>
                  {switchingId === c.id ? (
                    <ActivityIndicator color={Colors.gold} />
                  ) : (
                    <Pressable style={styles.savedRowDelete} onPress={() => confirmDelete(c)} hitSlop={8}>
                      <Text style={styles.savedRowDeleteTxt}>🗑</Text>
                    </Pressable>
                  )}
                </View>
              );
            })
          )}
          <Pressable style={styles.cancelBtn} onPress={onClose}>
            <Text style={styles.cancelTxt}>Cancel</Text>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ── No Campaign View ──────────────────────────────────────────────────────────

function NoCampaignView({
  nickname, onNicknameChange, onCreate, onOpenExisting, onJoinLive,
}: {
  nickname: string; onNicknameChange: (n: string) => void;
  onCreate: () => void; onOpenExisting: () => void; onJoinLive: () => void;
}) {
  const router = useRouter();
  // Campaign hosting/joining uses a raw TCP socket over the local WiFi network.
  // Browsers have no API for raw TCP sockets (only HTTP/WebSocket to a server
  // you don't control), so this is not something we can fix in JS — it's a
  // real platform limitation, not a bug. Show that honestly instead of
  // offering buttons that fail every time on web.
  const webUnsupported = Platform.OS === 'web';

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.contentCenter}>
      <Text style={styles.emptyIcon}>🗺️</Text>
      <Text style={styles.emptyHeading}>No Active Campaign</Text>

      {webUnsupported ? (
        <View style={styles.webNote}>
          <Text style={styles.webNoteTitle}>Campaigns need the mobile app</Text>
          <Text style={styles.webNoteBody}>
            Hosting or joining a campaign uses a direct WiFi connection between
            phones at the table, which browsers can't do. Open Grimoire on your
            phone (same WiFi as the rest of the table) to create or join a campaign.
          </Text>
        </View>
      ) : (
        <>
          <View style={[styles.nicknameRow, { alignSelf: 'stretch' }]}>
            <Text style={styles.nickLabel}>YOUR NAME</Text>
            <TextInput style={styles.nickInput} value={nickname}
              onChangeText={onNicknameChange}
              placeholder="Enter your name…" placeholderTextColor={Colors.textDim} />
          </View>

          <View style={styles.actionGroup}>
            <Pressable style={styles.primaryBtn} onPress={onCreate}>
              <Text style={styles.primaryBtnTxt}>👑 Create Campaign</Text>
            </Pressable>
            <Pressable style={[styles.primaryBtn, styles.secondaryBtn]} onPress={onOpenExisting} testID="campaign-open-existing">
              <Text style={[styles.primaryBtnTxt, { color: Colors.textPrimary }]}>
                Open Existing Campaign
              </Text>
            </Pressable>
            <Pressable style={[styles.primaryBtn, styles.secondaryBtn]} onPress={onJoinLive} testID="live-join-campaign">
              <Text style={[styles.primaryBtnTxt, { color: Colors.textPrimary }]}>
                🗡 Join Live Session
              </Text>
            </Pressable>
          </View>

          {/*
            Host-only (no campaign attached) is deliberately not one of the three primary
            actions above — per CAMPAIGN_PAGE_MODEL_SPEC.md, Host belongs either inside an
            existing campaign (Host + DM, see DmActiveView) or, for a Host with no campaign at
            all, its own Live Session screen rather than campaign creation.
          */}
          <Pressable style={styles.liveHostLink} onPress={() => router.push('/live' as any)} testID="live-open-standalone">
            <Text style={styles.liveHostLinkTxt}>Hosting without a campaign? Open Live Session →</Text>
          </Pressable>
        </>
      )}

      <View style={styles.howItWorks}>
        <Text style={styles.howTitle}>How it works</Text>
        <Text style={styles.howItem}>• Create or open a campaign to prepare and manage it offline</Text>
        <Text style={styles.howItem}>• Start a Live Session only when you want to play over LAN</Text>
        <Text style={styles.howItem}>• Players or DMs join with a 7-character room code or QR</Text>
        <Text style={styles.howItem}>• HP, effects, conditions, and approved live changes sync during the session</Text>
        <Text style={styles.howItem}>• Campaigns and characters persist offline — no internet required</Text>
      </View>
    </ScrollView>
  );
}

// ── Campaigns Screen ──────────────────────────────────────────────────────────

export default function CampaignsScreen() {
  const activeCampaign = useCampaignStore(s => s.activeCampaign);
  const isDm           = useCampaignStore(s => s.isDm);
  const loadCampaigns  = useCampaignStore(s => s.loadCampaigns);
  const session        = useSessionStore(s => s.session);
  const setNickname    = useSessionStore(s => s.setNickname);
  const { action }     = useLocalSearchParams<{ action?: string }>();

  const [createOpen,       setCreateOpen]       = useState(false);
  const [openExistingOpen, setOpenExistingOpen] = useState(false);
  const [joinLiveOpen,     setJoinLiveOpen]     = useState(false);
  const [nickname,         setLocalNick]        = useState(session?.nickname ?? '');

  const actionHandled = useRef(false);
  useEffect(() => {
    if (action === 'join' && !actionHandled.current) {
      actionHandled.current = true;
      setJoinLiveOpen(true);
    }
  }, [action]);

  useEffect(() => { loadCampaigns(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (session?.nickname !== undefined) setLocalNick(session.nickname);
  }, [session?.nickname]);

  const handleNicknameChange = useCallback((n: string) => {
    setLocalNick(n);
    setNickname(n);
  }, [setNickname]);

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.title}>Campaigns</Text>
      </View>

      {activeCampaign ? (
        isDm ? <DmActiveView /> : <PlayerActiveView />
      ) : (
        <NoCampaignView
          nickname={nickname}
          onNicknameChange={handleNicknameChange}
          onCreate={() => setCreateOpen(true)}
          onOpenExisting={() => setOpenExistingOpen(true)}
          onJoinLive={() => setJoinLiveOpen(true)}
        />
      )}

      <CreateModal visible={createOpen} onClose={() => setCreateOpen(false)} />
      <OpenCampaignModal visible={openExistingOpen} onClose={() => setOpenExistingOpen(false)} />
      <LiveJoinModal visible={joinLiveOpen} onClose={() => setJoinLiveOpen(false)} nickname={nickname} />
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
  title: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.gold },


  scroll:        { flex: 1 },
  content:       { padding: Spacing.md, gap: Spacing.md, paddingBottom: Spacing.xxl },
  contentCenter: {
    flexGrow: 1, alignItems: 'center', justifyContent: 'center',
    padding: Spacing.xl, gap: Spacing.md,
  },

  // Section
  section: {
    backgroundColor: Colors.surface, borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.border,
    padding: Spacing.md, gap: Spacing.sm,
  },
  sectionLabel: {
    fontSize: FontSize.xs, color: Colors.textSecondary,
    letterSpacing: 2, fontWeight: FontWeight.bold,
  },
  emptyNote: { color: Colors.textDim, fontSize: FontSize.sm, fontStyle: 'italic' },

  packRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    paddingVertical: Spacing.xs, borderTopWidth: 1, borderTopColor: Colors.border,
  },
  packName: { fontSize: FontSize.sm, color: Colors.textPrimary, fontWeight: FontWeight.bold },
  packMeta: { fontSize: FontSize.xs, color: Colors.textDim },
  packToggle: {
    borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.green + '66',
    backgroundColor: Colors.green + '22', paddingHorizontal: Spacing.sm, paddingVertical: 4,
  },
  packToggleBanned:    { borderColor: Colors.red + '66', backgroundColor: Colors.red + '22' },
  packToggleTxt:        { fontSize: FontSize.xs, color: Colors.green, fontWeight: FontWeight.bold },
  packToggleTxtBanned:  { color: Colors.red },

  // Notes
  notesInput:   { minHeight: 90 },
  notesReadOnly:{ fontSize: FontSize.md, color: Colors.textPrimary, lineHeight: 22 },

  // Quests
  questRow: {
    flexDirection: 'row', alignItems: 'flex-start',
    gap: Spacing.sm, paddingVertical: Spacing.xs,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  questChip: {
    borderRadius: Radius.full, borderWidth: 1,
    paddingHorizontal: Spacing.sm, paddingVertical: 2, marginTop: 2,
  },
  questChipTxt:  { fontSize: FontSize.xs, fontWeight: FontWeight.bold },
  questBody:     { flex: 1 },
  questName:     { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  questDesc:     { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2, lineHeight: 16 },
  questActions:  { flexDirection: 'row', gap: Spacing.xs, marginTop: 2 },
  questActionBtn:{ padding: 4 },
  questActionTxt:{ fontSize: FontSize.md, color: Colors.textDim, fontWeight: FontWeight.bold },

  // Session log
  logEntry: {
    backgroundColor: Colors.surfaceHigh, borderRadius: Radius.md,
    padding: Spacing.sm, gap: Spacing.xs,
  },
  logEntryHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  logDate:       { fontSize: FontSize.xs, color: Colors.gold, fontWeight: FontWeight.bold },
  logDeleteTxt:  { fontSize: FontSize.sm, color: Colors.textDim },
  logSummary:    { fontSize: FontSize.sm, color: Colors.textPrimary, lineHeight: 20 },
  showMoreTxt:   { fontSize: FontSize.xs, color: Colors.gold, marginTop: Spacing.xs },

  // Add buttons (shared)
  addBtn: {
    borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.gold + '66',
    padding: Spacing.sm, alignItems: 'center',
  },
  addBtnTxt: { color: Colors.gold, fontWeight: FontWeight.bold, fontSize: FontSize.sm },

  // Party
  partyCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  partyInfo:  { flex: 1 },
  partyName:  { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  partySub:   { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },
  partyRight: { alignItems: 'flex-end', gap: 4 },
  changeLink: { color: Colors.gold, fontWeight: FontWeight.bold, fontSize: FontSize.sm },
  pickRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  hpTxt:      { fontSize: FontSize.xs, fontWeight: FontWeight.bold },
  hpBarOuter: { width: 80, height: 4, backgroundColor: Colors.border, borderRadius: Radius.full, overflow: 'hidden' },
  hpBarFill:  { height: '100%', borderRadius: Radius.full },

  // Campaign header card (DM view)
  campaignCard: {
    backgroundColor: Colors.surface, borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.gold + '44',
    padding: Spacing.md, gap: Spacing.md,
  },
  campaignHeaderRow: { flexDirection: 'row', alignItems: 'flex-start' },
  campaignName:      { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  syncRow:           { flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 6 },
  campaignMeta:      { fontSize: FontSize.sm, color: Colors.textSecondary },
  syncErrorTxt:      { fontSize: FontSize.xs, color: Colors.red, lineHeight: 17, marginTop: 4 },
  retryBtn: {
    marginTop: Spacing.sm, alignSelf: 'flex-start',
    backgroundColor: Colors.gold + '22', borderRadius: Radius.full,
    borderWidth: 1, borderColor: Colors.gold + '66',
    paddingHorizontal: Spacing.md, paddingVertical: 6,
  },
  retryBtnDisabled: { opacity: 0.5 },
  retryBtnTxt:      { fontSize: FontSize.sm, color: Colors.gold, fontWeight: FontWeight.bold },
  reEnterLink:       { marginTop: Spacing.sm, alignSelf: 'flex-start' },
  reEnterTxt:        { fontSize: FontSize.sm, color: Colors.gold, fontWeight: FontWeight.bold },
  reconnectBox:      { marginTop: Spacing.sm, gap: Spacing.xs },
  reconnectHint:     { fontSize: FontSize.xs, color: Colors.textSecondary },
  reconnectInput: {
    backgroundColor: Colors.surface, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    fontSize: FontSize.lg, color: Colors.textPrimary, letterSpacing: 4,
    textAlign: 'center', fontWeight: FontWeight.bold,
  },
  reconnectRow:      { flexDirection: 'row', gap: Spacing.sm, alignItems: 'center' },
  reconnectBtn: {
    flex: 1, backgroundColor: Colors.gold, borderRadius: Radius.md,
    paddingVertical: Spacing.sm, alignItems: 'center',
  },
  reconnectBtnDisabled: { backgroundColor: Colors.goldDim },
  reconnectBtnTxt:   { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.bg },
  reconnectCancel:   { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm },
  reconnectCancelTxt:{ fontSize: FontSize.sm, color: Colors.textSecondary },
  codeSection:       { alignItems: 'center', gap: Spacing.xs },
  codeLabel:         { fontSize: FontSize.xs, color: Colors.textDim, letterSpacing: 2 },
  codeValue:         { fontSize: 36, fontWeight: FontWeight.bold, color: Colors.gold, letterSpacing: 8 },
  codeHint:          { fontSize: FontSize.xs, color: Colors.textDim, textAlign: 'center' },
  codeDiag:          { fontSize: FontSize.xs, color: Colors.textSecondary, textAlign: 'center', marginTop: 4, lineHeight: 16 },
  noNetworkNotice:   { backgroundColor: Colors.bg, borderRadius: Radius.md, padding: Spacing.md, borderWidth: 1, borderColor: Colors.border },
  noNetworkTxt:      { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center', lineHeight: 19 },
  qrContainer:       { alignItems: 'center', padding: Spacing.md, backgroundColor: Colors.surface, borderRadius: Radius.lg },
  dmBtn:             { backgroundColor: Colors.gold, borderRadius: Radius.md, padding: Spacing.md, alignItems: 'center' },
  dmBtnSecondary:    { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  dmBtnTxt:          { color: Colors.bg, fontWeight: FontWeight.bold, fontSize: FontSize.md },

  // Leave/end button
  leaveBtn: {
    borderRadius: Radius.md, padding: Spacing.md, alignItems: 'center',
    borderWidth: 1, borderColor: Colors.red + '66', backgroundColor: Colors.red + '11',
  },
  leaveBtnTxt: { color: Colors.red, fontWeight: FontWeight.bold, fontSize: FontSize.md },

  // No campaign view
  emptyIcon:    { fontSize: 64 },
  emptyHeading: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.textPrimary, textAlign: 'center' },
  nicknameRow:  { gap: 6 },
  nickLabel:    { fontSize: FontSize.xs, color: Colors.textSecondary, letterSpacing: 2, fontWeight: FontWeight.bold },
  nickInput: {
    backgroundColor: Colors.surface, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border,
    padding: Spacing.sm, fontSize: FontSize.md, color: Colors.textPrimary,
  },
  actionGroup: { gap: Spacing.sm, alignSelf: 'stretch' },
  liveHostLink: { alignSelf: 'center', paddingVertical: Spacing.sm, marginTop: Spacing.xs },
  liveHostLinkTxt: { fontSize: FontSize.sm, color: Colors.textDim, fontWeight: FontWeight.bold },
  howItWorks: {
    backgroundColor: Colors.surface, borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.border,
    padding: Spacing.md, gap: Spacing.xs, alignSelf: 'stretch', marginTop: Spacing.sm,
  },
  howTitle: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.gold, marginBottom: 4 },
  howItem:  { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 20 },
  savedRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: Spacing.sm, borderTopWidth: 1, borderTopColor: Colors.border,
  },
  savedRowName:      { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  savedRowMeta:       { fontSize: FontSize.xs, color: Colors.textDim, marginTop: 2 },
  savedRowDelete:     { padding: Spacing.xs },
  savedRowDeleteTxt:  { fontSize: FontSize.md },

  webNote: {
    backgroundColor: Colors.surface, borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.gold + '44',
    padding: Spacing.md, gap: Spacing.xs, alignSelf: 'stretch',
  },
  webNoteTitle: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.gold },
  webNoteBody:  { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 20 },

  // Modals
  backdrop: { flex: 1, backgroundColor: '#000000bb', justifyContent: 'flex-end' },
  backdropTapArea: { flex: 1 },
  modalSheet: {
    backgroundColor: Colors.surfaceHigh,
    borderTopLeftRadius: Radius.lg, borderTopRightRadius: Radius.lg,
    padding: Spacing.lg, gap: Spacing.md, paddingBottom: Spacing.xxl,
  },
  modalTitle:    { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.textPrimary, textAlign: 'center' },
  modalSub:      { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center' },
  modalBtns:     { flexDirection: 'row', gap: Spacing.sm, alignItems: 'center' },
  input: {
    backgroundColor: Colors.surface, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border,
    padding: Spacing.md, fontSize: FontSize.md, color: Colors.textPrimary,
  },
  primaryBtn:    { backgroundColor: Colors.gold, borderRadius: Radius.md, padding: Spacing.md, alignItems: 'center' },
  secondaryBtn:  { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  codeInput:     { textAlign: 'center', fontSize: FontSize.xl, letterSpacing: 8, fontWeight: FontWeight.bold },
  btnDisabled:   { opacity: 0.4 },
  primaryBtnTxt: { color: Colors.bg, fontWeight: FontWeight.bold, fontSize: FontSize.md },
  cancelBtn:     { alignItems: 'center', padding: Spacing.sm, flex: 1 },
  cancelTxt:     { color: Colors.textSecondary, fontSize: FontSize.md },

  // Create Campaign wizard
  wizSheet:      { maxHeight: '88%' },
  wizStepLabel:  { fontSize: FontSize.xs, color: Colors.textDim, textAlign: 'center', letterSpacing: 1, fontWeight: FontWeight.bold },
  wizScroll:     { flexGrow: 0, marginTop: Spacing.sm },
  wizFieldLabel: { fontSize: FontSize.xs, color: Colors.textSecondary, letterSpacing: 1, fontWeight: FontWeight.bold, marginTop: Spacing.xs },
  wizHint:       { fontSize: FontSize.xs, color: Colors.textDim, fontStyle: 'italic' },
  wizChipRow:    { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  wizChip: {
    backgroundColor: Colors.surface, borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: Spacing.sm, paddingVertical: 8,
  },
  wizChipActive:    { backgroundColor: Colors.gold + '22', borderColor: Colors.gold },
  wizChipTxt:       { fontSize: FontSize.sm, color: Colors.textSecondary },
  wizChipTxtActive: { color: Colors.gold, fontWeight: FontWeight.bold },
  wizToggleRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  wizToggleLabel: { fontSize: FontSize.md, color: Colors.textPrimary, fontWeight: FontWeight.bold },
  wizToggleHint:  { fontSize: FontSize.xs, color: Colors.textDim, marginTop: 2 },
  wizSwitch: {
    width: 44, height: 26, borderRadius: Radius.full, backgroundColor: Colors.surface,
    borderWidth: 1, borderColor: Colors.border, padding: 2, justifyContent: 'center',
  },
  wizSwitchOn:      { backgroundColor: Colors.gold + '44', borderColor: Colors.gold },
  wizSwitchKnob:    { width: 20, height: 20, borderRadius: Radius.full, backgroundColor: Colors.textDim },
  wizSwitchKnobOn:  { backgroundColor: Colors.gold, alignSelf: 'flex-end' },
  wizReviewLine:    { fontSize: FontSize.sm, color: Colors.textPrimary, lineHeight: 20 },
  wizReviewLabel:   { color: Colors.textSecondary, fontWeight: FontWeight.bold },
  wizFooter:        { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm },
});
