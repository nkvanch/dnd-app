// ============================================================================
// FILE: app/(tabs)/campaigns.tsx
// Campaigns tab — create, join, and manage campaigns with real-time sync.
//
// State machine:
//   NO CAMPAIGN  → [Create Campaign] or [Join Campaign]
//   DM ACTIVE    → connection block + campaign overview (notes/quests/log/party)
//   PLAYER ACTIVE → read-only campaign overview + sync status
// ============================================================================
import { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, Pressable, StyleSheet,
  Modal, TextInput, ActivityIndicator, Platform, KeyboardAvoidingView,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { CameraView, useCameraPermissions, BarcodeScanningResult } from 'expo-camera';
import QRCode from 'react-native-qrcode-svg';

import { Alert } from '../../src/utils/alert';
import { useCampaignStore }  from '../../src/store/campaignStore';
import { useSessionStore }   from '../../src/store/sessionStore';
import { useCharacterStore } from '../../src/store/characterStore';
import { useSyncStore }      from '../../src/store/syncStore';
import { syncManager }       from '../../src/sync/syncManager';
import { decodeRoomCode }    from '../../src/sync/discovery';
import { SyncStatusDot }     from '../../src/components/SyncStatusDot';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../../src/theme';
import { Quest, SessionLogEntry, Campaign } from '../../src/engine/types';
import { InstalledPack, loadInstalledPacks } from '../../src/db/packRegistryRepo';

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

// ── QR Scanner Modal ──────────────────────────────────────────────────────────

function QrScannerModal({
  visible, onScan, onClose,
}: { visible: boolean; onScan: (code: string) => void; onClose: () => void }) {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);

  useEffect(() => {
    if (visible && !permission?.granted) requestPermission();
    if (!visible) setScanned(false);
  }, [visible, permission?.granted, requestPermission]);

  function handleBarcode(result: BarcodeScanningResult) {
    if (scanned) return;
    const raw = result.data?.trim().toUpperCase() ?? '';
    if (/^[0-9A-Z]{7}$/.test(raw)) { setScanned(true); onScan(raw); }
  }

  if (!visible) return null;
  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View style={scanStyles.container}>
        {!permission?.granted ? (
          <View style={scanStyles.center}>
            <Text style={scanStyles.permTxt}>Camera permission required to scan QR codes.</Text>
            <Pressable style={scanStyles.permBtn} onPress={requestPermission}>
              <Text style={scanStyles.permBtnTxt}>Grant Permission</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <CameraView style={scanStyles.camera} facing="back"
              barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
              onBarcodeScanned={handleBarcode} />
            <View style={scanStyles.overlay}>
              <View style={scanStyles.frame} />
              <Text style={scanStyles.hint}>Point at the DM's QR code</Text>
            </View>
          </>
        )}
        <Pressable style={scanStyles.closeBtn} onPress={onClose}>
          <Text style={scanStyles.closeTxt}>✕ Cancel</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const scanStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  camera:    { flex: 1 },
  center:    { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 16 },
  permTxt:   { color: '#fff', textAlign: 'center', fontSize: 16 },
  permBtn:   { backgroundColor: Colors.gold, borderRadius: Radius.md, paddingHorizontal: 24, paddingVertical: 12 },
  permBtnTxt:{ color: Colors.bg, fontWeight: FontWeight.bold, fontSize: 16 },
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  frame:   { width: 220, height: 220, borderWidth: 3, borderColor: Colors.gold, borderRadius: Radius.lg },
  hint:    { color: '#fff', marginTop: 20, fontSize: 14, textAlign: 'center' },
  closeBtn:{ position: 'absolute', top: 52, right: 20, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 20, padding: 12 },
  closeTxt:{ color: '#fff', fontWeight: FontWeight.bold, fontSize: 16 },
});

// ── Create/Join Campaign Modals ───────────────────────────────────────────────

function CreateModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const [name,    setName]    = useState('');
  const [loading, setLoading] = useState(false);
  const createCampaign = useCampaignStore(s => s.createCampaign);
  const session        = useSessionStore(s => s.session);

  async function handleCreate() {
    const trimmed = name.trim();
    if (!trimmed || !session) return;
    setLoading(true);
    try {
      // createCampaign now starts the LAN server itself and stores the real
      // room code, so we must NOT also call startAsServer here (that would bind
      // the port twice and overwrite the code).
      await createCampaign(trimmed);
      setName(''); onClose();
    } catch (e) { showError('Error', String(e)); }
    finally { setLoading(false); }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <Pressable style={styles.backdropTapArea} onPress={onClose} />
        <Pressable style={styles.modalSheet} onPress={e => e.stopPropagation()}>
          <Text style={styles.modalTitle}>New Campaign</Text>
          <TextInput style={styles.input} value={name} onChangeText={setName}
            placeholder="Campaign name…" placeholderTextColor={Colors.textDim} autoFocus />
          <Pressable style={[styles.primaryBtn, (!name.trim() || loading) && styles.btnDisabled]}
            onPress={handleCreate} disabled={!name.trim() || loading}>
            {loading ? <ActivityIndicator color={Colors.bg} /> : <Text style={styles.primaryBtnTxt}>Create Campaign</Text>}
          </Pressable>
          <Pressable style={styles.cancelBtn} onPress={onClose}>
            <Text style={styles.cancelTxt}>Cancel</Text>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function JoinModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const [code,       setCode]       = useState('');
  const [loading,    setLoading]    = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const joinCampaign = useCampaignStore(s => s.joinCampaign);
  const session      = useSessionStore(s => s.session);

  async function handleJoin(rawCode?: string) {
    const trimmed = (rawCode ?? code).trim().toUpperCase();
    if (trimmed.length !== 7 || !session) return;
    // JOIN-CONFIRM-1: joinCampaign() calls syncManager.startAsClient(),
    // which itself calls stopAll() first — if this device is currently
    // hosting a campaign with players connected, they're silently dropped
    // mid-session with zero warning. Owning a DM campaign must not BLOCK
    // joining another (per the app's own campaign-role rules — role is
    // per-campaign, not per-device), but the DM should at least be told
    // what's about to happen before it does.
    const status = useSyncStore.getState().status;
    if (status.role === 'dm' && status.clientCount > 0) {
      const proceed = await new Promise<boolean>(resolve => {
        Alert.alert(
          'Leave current campaign?',
          `You're hosting a campaign with ${status.clientCount} player${status.clientCount === 1 ? '' : 's'} connected. Joining a different campaign will disconnect them.`,
          [
            { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
            { text: 'Join Anyway', style: 'destructive', onPress: () => resolve(true) },
          ],
        );
      });
      if (!proceed) return;
    }
    setLoading(true); setScannerOpen(false);
    try {
      // joinCampaign now opens the LAN client connection itself, so we must NOT
      // also call startAsClient here (that would open a second connection).
      await joinCampaign(trimmed);
      setCode(''); onClose();
    } catch (e) { showError('Connection failed', String(e)); }
    finally { setLoading(false); }
  }

  return (
    <>
      <QrScannerModal visible={scannerOpen}
        onScan={c => { setCode(c); setScannerOpen(false); handleJoin(c); }}
        onClose={() => setScannerOpen(false)} />
      <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
        <KeyboardAvoidingView
          style={styles.backdrop}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <Pressable style={styles.backdropTapArea} onPress={onClose} />
          <Pressable style={styles.modalSheet} onPress={e => e.stopPropagation()}>
            <Text style={styles.modalTitle}>Join Campaign</Text>
            <Text style={styles.modalSub}>Enter the 7-character room code or scan the DM's QR.</Text>
            <TextInput style={[styles.input, styles.codeInput]} value={code}
              onChangeText={t => setCode(t.toUpperCase().slice(0, 7))}
              placeholder="XXXXXXX" placeholderTextColor={Colors.textDim}
              autoCapitalize="characters" maxLength={7} autoFocus />
            {Platform.OS !== 'web' && (
              <Pressable style={[styles.primaryBtn, styles.secondaryBtn]} onPress={() => setScannerOpen(true)} disabled={loading}>
                <Text style={[styles.primaryBtnTxt, { color: Colors.textPrimary }]}>📷  Scan QR Code</Text>
              </Pressable>
            )}
            <Pressable style={[styles.primaryBtn, (code.length !== 7 || loading) && styles.btnDisabled]}
              onPress={() => handleJoin()} disabled={code.length !== 7 || loading}>
              {loading ? <ActivityIndicator color={Colors.bg} /> : <Text style={styles.primaryBtnTxt}>Join</Text>}
            </Pressable>
            <Pressable style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelTxt}>Cancel</Text>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

// ── Campaign Overview Sections ────────────────────────────────────────────────
// Used by both DM and Player views; editable=true only for the DM.

// ── Notes Section ─────────────────────────────────────────────────────────────

function NotesSection({ notes, editable, onChange }: {
  notes: string; editable: boolean; onChange: (n: string) => void;
}) {
  const [local, setLocal] = useState(notes);
  useEffect(() => setLocal(notes), [notes]);

  return (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>CAMPAIGN NOTES</Text>
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
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
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
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
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
                Lv {c.identity.level} · {c.identity.classId || '—'}
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
  const leaveCampaign  = useCampaignStore(s => s.leaveCampaign);
  const updateCampaign = useCampaignStore(s => s.updateCampaign);
  const syncStatus     = useSyncStore(s => s.status);

  if (!activeCampaign) return null;

  const roomCode   = syncStatus.roomCode ?? activeCampaign.joinCode;
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
    Alert.alert('Stop Hosting', 'Players currently connected will be disconnected. You can resume this campaign later. Continue?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Stop Hosting', style: 'destructive', onPress: () => { void leaveCampaign(); } },
    ]);
  }

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>

      {/* Connection block */}
      <View style={styles.campaignCard}>
        <View style={styles.campaignHeaderRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.campaignName}>{activeCampaign.name}</Text>
            <View style={styles.syncRow}>
              <SyncStatusDot />
              <Text style={styles.campaignMeta}>
                {syncStatus.connected
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
                No local network is available. You can still use this campaign on this
                device, but other players cannot join. Enable Wi-Fi or a mobile hotspot
                for live multiplayer.
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
      </View>

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

      <Pressable style={styles.leaveBtn} onPress={confirmEnd}>
        <Text style={styles.leaveBtnTxt}>⏸ Stop Hosting</Text>
      </Pressable>

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
              <Text style={styles.partySub}>Lv {myChar.identity.level} · {myChar.identity.classId || '—'}</Text>
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
      <NotesSection
        notes={activeCampaign.notes}
        editable={false}
        onChange={() => {}}
      />
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
                    <Text style={styles.partySub}>Lv {c.identity.level} · {c.identity.classId || '—'}</Text>
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

// ── Saved Campaigns List ──────────────────────────────────────────────────────
// A DM can own/keep several campaigns but only hosts one at a time — this is
// how they get back to a campaign they left without deleting it (see
// campaignStore's switchToCampaign/leaveCampaign — leaving used to
// permanently delete a DM's campaign, so this list previously had nothing to
// show). Also lists campaigns this device has joined as a player, for the
// same "get back in" purpose.

function SavedCampaignsList() {
  const campaigns        = useCampaignStore(s => s.campaigns);
  const switchToCampaign = useCampaignStore(s => s.switchToCampaign);
  const deleteCampaign   = useCampaignStore(s => s.deleteCampaignPermanently);
  const session           = useSessionStore(s => s.session);
  const [switchingId, setSwitchingId] = useState<string | null>(null);

  if (campaigns.length === 0) return null;

  async function handleResume(id: string) {
    if (switchingId) return;
    setSwitchingId(id);
    try {
      await switchToCampaign(id);
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
    <View style={[styles.howItWorks, { alignSelf: 'stretch' }]}>
      <Text style={styles.howTitle}>YOUR CAMPAIGNS</Text>
      {campaigns.map(c => {
        const isDm = session?.deviceId === c.dmDeviceId;
        return (
          <View key={c.id} style={styles.savedRow}>
            <Pressable
              style={{ flex: 1 }}
              onPress={() => { void handleResume(c.id); }}
              disabled={switchingId !== null}
            >
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
      })}
    </View>
  );
}

// ── No Campaign View ──────────────────────────────────────────────────────────

function NoCampaignView({
  nickname, onNicknameChange, onCreate, onJoin,
}: {
  nickname: string; onNicknameChange: (n: string) => void;
  onCreate: () => void; onJoin: () => void;
}) {
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
              <Text style={styles.primaryBtnTxt}>👑 Create Campaign (DM)</Text>
            </Pressable>
            <Pressable style={[styles.primaryBtn, styles.secondaryBtn]} onPress={onJoin}>
              <Text style={[styles.primaryBtnTxt, { color: Colors.textPrimary }]}>
                🗡 Join Campaign (Player)
              </Text>
            </Pressable>
          </View>

          <SavedCampaignsList />
        </>
      )}

      <View style={styles.howItWorks}>
        <Text style={styles.howTitle}>How it works</Text>
        <Text style={styles.howItem}>• DM creates a campaign — gets a room code + QR</Text>
        <Text style={styles.howItem}>• Players type the code or scan the QR on the same WiFi</Text>
        <Text style={styles.howItem}>• HP, conditions, and overrides sync in real time</Text>
        <Text style={styles.howItem}>• Everything persists offline — no internet required</Text>
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

  const [createOpen, setCreateOpen] = useState(false);
  const [joinOpen,   setJoinOpen]   = useState(false);
  const [nickname,   setLocalNick]  = useState(session?.nickname ?? '');

  const actionHandled = useRef(false);
  useEffect(() => {
    if (action === 'join' && !actionHandled.current) {
      actionHandled.current = true;
      setJoinOpen(true);
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
          onJoin={() => setJoinOpen(true)}
        />
      )}

      <CreateModal visible={createOpen} onClose={() => setCreateOpen(false)} />
      <JoinModal   visible={joinOpen}   onClose={() => setJoinOpen(false)} />
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
  codeInput:     { textAlign: 'center', fontSize: FontSize.xl, letterSpacing: 8, fontWeight: FontWeight.bold },
  primaryBtn:    { backgroundColor: Colors.gold, borderRadius: Radius.md, padding: Spacing.md, alignItems: 'center' },
  secondaryBtn:  { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  btnDisabled:   { opacity: 0.4 },
  primaryBtnTxt: { color: Colors.bg, fontWeight: FontWeight.bold, fontSize: FontSize.md },
  cancelBtn:     { alignItems: 'center', padding: Spacing.sm, flex: 1 },
  cancelTxt:     { color: Colors.textSecondary, fontSize: FontSize.md },
});
