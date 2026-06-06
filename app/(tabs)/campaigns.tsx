// ============================================================================
// FILE: app/(tabs)/campaigns.tsx
// Campaigns tab — create, join, and manage campaigns with real-time sync.
//
// State machine:
//   NO CAMPAIGN  → [Create Campaign] or [Join Campaign]
//   DM ACTIVE    → room code + QR code, connected-player count, sync dot
//   PLAYER ACTIVE → campaign name, DM name, sync dot
// ============================================================================
import { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, Pressable, StyleSheet,
  Modal, TextInput, Alert, ActivityIndicator, Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { CameraView, useCameraPermissions, BarcodeScanningResult } from 'expo-camera';
import QRCode from 'react-native-qrcode-svg';

import { useCampaignStore } from '../../src/store/campaignStore';
import { useSessionStore }  from '../../src/store/sessionStore';
import { useCharacterStore } from '../../src/store/characterStore';
import { useSyncStore }     from '../../src/store/syncStore';
import { syncManager }      from '../../src/sync/syncManager';
import { SyncStatusDot }   from '../../src/components/SyncStatusDot';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../../src/theme';

// ── QR Scanner Modal ──────────────────────────────────────────────────────────

function QrScannerModal({
  visible,
  onScan,
  onClose,
}: {
  visible:  boolean;
  onScan:   (code: string) => void;
  onClose:  () => void;
}) {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);

  useEffect(() => {
    if (visible && !permission?.granted) {
      requestPermission();
    }
    if (!visible) setScanned(false);
  }, [visible, permission?.granted, requestPermission]);

  function handleBarcode(result: BarcodeScanningResult) {
    if (scanned) return;
    const raw = result.data?.trim().toUpperCase() ?? '';
    if (/^[0-9A-Z]{6}$/.test(raw)) {
      setScanned(true);
      onScan(raw);
    }
  }

  if (!visible) return null;

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View style={scanStyles.container}>
        {!permission?.granted ? (
          <View style={scanStyles.center}>
            <Text style={scanStyles.permTxt}>Camera permission is required to scan QR codes.</Text>
            <Pressable style={scanStyles.permBtn} onPress={requestPermission}>
              <Text style={scanStyles.permBtnTxt}>Grant Permission</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <CameraView
              style={scanStyles.camera}
              facing="back"
              barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
              onBarcodeScanned={handleBarcode}
            />
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
  overlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center', justifyContent: 'center',
  },
  frame: {
    width: 220, height: 220, borderWidth: 3, borderColor: Colors.gold,
    borderRadius: Radius.lg,
  },
  hint:     { color: '#fff', marginTop: 20, fontSize: 14, textAlign: 'center' },
  closeBtn: { position: 'absolute', top: 52, right: 20, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 20, padding: 12 },
  closeTxt: { color: '#fff', fontWeight: FontWeight.bold, fontSize: 16 },
});

// ── Create Campaign Modal ─────────────────────────────────────────────────────

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
      const campaign = await createCampaign(trimmed);
      // Start the TCP server and get the real room code from the local IP
      const roomCode = await syncManager.startAsServer(
        campaign.id,
        campaign.id,          // use campaignId as sessionId for simplicity
        session.deviceId,
        session.nickname || 'DM',
      );
      // Update the campaign's joinCode so it displays the real room code
      await useCampaignStore.getState().updateCampaign(campaign.id, c => ({
        ...c, joinCode: roomCode,
      }));
      setName('');
      onClose();
    } catch (e) {
      Alert.alert('Error', String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.modalSheet} onPress={e => e.stopPropagation()}>
          <Text style={styles.modalTitle}>New Campaign</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="Campaign name…"
            placeholderTextColor={Colors.textDim}
            autoFocus
          />
          <Pressable
            style={[styles.primaryBtn, (!name.trim() || loading) && styles.btnDisabled]}
            onPress={handleCreate}
            disabled={!name.trim() || loading}
          >
            {loading
              ? <ActivityIndicator color={Colors.bg} />
              : <Text style={styles.primaryBtnTxt}>Create Campaign</Text>
            }
          </Pressable>
          <Pressable style={styles.cancelBtn} onPress={onClose}>
            <Text style={styles.cancelTxt}>Cancel</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ── Join Campaign Modal ───────────────────────────────────────────────────────

function JoinModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const [code,       setCode]       = useState('');
  const [loading,    setLoading]    = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const joinCampaign = useCampaignStore(s => s.joinCampaign);
  const session      = useSessionStore(s => s.session);

  async function handleJoin(rawCode?: string) {
    const trimmed = (rawCode ?? code).trim().toUpperCase();
    if (trimmed.length !== 6 || !session) return;
    setLoading(true);
    setScannerOpen(false);
    try {
      // Connect to the DM's server first — this will set campaignId on 'welcome'
      await syncManager.startAsClient(
        trimmed,
        session.deviceId,
        session.nickname || 'Player',
      );
      // Also store a local stub campaign for offline access
      await joinCampaign(trimmed);
      setCode('');
      onClose();
    } catch (e) {
      Alert.alert('Connection failed', String(e));
    } finally {
      setLoading(false);
    }
  }

  function handleScan(scannedCode: string) {
    setCode(scannedCode);
    setScannerOpen(false);
    handleJoin(scannedCode);
  }

  return (
    <>
      <QrScannerModal
        visible={scannerOpen}
        onScan={handleScan}
        onClose={() => setScannerOpen(false)}
      />
      <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
        <Pressable style={styles.backdrop} onPress={onClose}>
          <Pressable style={styles.modalSheet} onPress={e => e.stopPropagation()}>
            <Text style={styles.modalTitle}>Join Campaign</Text>
            <Text style={styles.modalSub}>
              Type the 6-character code shown on the DM's screen, or scan the QR code.
            </Text>

            <TextInput
              style={[styles.input, styles.codeInput]}
              value={code}
              onChangeText={t => setCode(t.toUpperCase().slice(0, 6))}
              placeholder="XXXXXX"
              placeholderTextColor={Colors.textDim}
              autoCapitalize="characters"
              maxLength={6}
              autoFocus
            />

            {/* Only show QR scan button on native (not web) */}
            {Platform.OS !== 'web' && (
              <Pressable
                style={[styles.primaryBtn, styles.secondaryBtn]}
                onPress={() => setScannerOpen(true)}
                disabled={loading}
              >
                <Text style={[styles.primaryBtnTxt, { color: Colors.textPrimary }]}>
                  📷  Scan QR Code
                </Text>
              </Pressable>
            )}

            <Pressable
              style={[styles.primaryBtn, (code.length !== 6 || loading) && styles.btnDisabled]}
              onPress={() => handleJoin()}
              disabled={code.length !== 6 || loading}
            >
              {loading
                ? <ActivityIndicator color={Colors.bg} />
                : <Text style={styles.primaryBtnTxt}>Join</Text>
              }
            </Pressable>
            <Pressable style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelTxt}>Cancel</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

// ── Active Campaign View (DM) ─────────────────────────────────────────────────

function DmActiveView() {
  const router         = useRouter();
  const activeCampaign = useCampaignStore(s => s.activeCampaign);
  const leaveCampaign  = useCampaignStore(s => s.leaveCampaign);
  const syncStatus     = useSyncStore(s => s.status);
  const characters     = useCharacterStore(s => s.characters);

  if (!activeCampaign) return null;

  const roomCode   = syncStatus.roomCode ?? activeCampaign.joinCode;
  const partyChars = characters.filter(c => activeCampaign.characterIds.includes(c.id));

  function confirmEnd() {
    Alert.alert('End Campaign', 'This will end the campaign for all players. Continue?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'End Campaign', style: 'destructive', onPress: async () => {
          syncManager.stopAll();
          await leaveCampaign();
        }
      },
    ]);
  }

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>

      {/* Campaign header */}
      <View style={styles.campaignCard}>
        <View style={styles.campaignHeaderRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.campaignName}>{activeCampaign.name}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
              <SyncStatusDot />
              <Text style={styles.campaignMeta}>
                {syncStatus.connected
                  ? `${syncStatus.clientCount} player${syncStatus.clientCount !== 1 ? 's' : ''} connected`
                  : 'Starting server…'
                }
              </Text>
            </View>
          </View>
        </View>

        {/* Room code */}
        <View style={styles.codeSection}>
          <Text style={styles.codeLabel}>ROOM CODE</Text>
          <Text style={styles.codeValue}>{roomCode}</Text>
          <Text style={styles.codeHint}>Players enter this code or scan the QR below</Text>
        </View>

        {/* QR code — only rendered on native; RN web doesn't have SVG */}
        {Platform.OS !== 'web' && roomCode ? (
          <View style={styles.qrContainer}>
            <QRCode
              value={roomCode}
              size={180}
              color={Colors.textPrimary}
              backgroundColor={Colors.surface}
            />
          </View>
        ) : null}

        <Pressable
          style={styles.dmBtn}
          onPress={() => router.push('/dm/dashboard' as any)}
        >
          <Text style={styles.dmBtnTxt}>🎲 Open DM Dashboard</Text>
        </Pressable>
      </View>

      {/* Party */}
      {partyChars.length > 0 && (
        <>
          <Text style={styles.sectionLabel}>PARTY</Text>
          {partyChars.map(c => {
            const hpPct   = c.resources.hp.maximum > 0
              ? c.resources.hp.current / c.resources.hp.maximum : 0;
            const hpColor = hpPct > 0.5 ? Colors.green : hpPct > 0.25 ? Colors.gold : Colors.red;
            return (
              <View key={c.id} style={styles.partyCard}>
                <View>
                  <Text style={styles.partyName}>{c.identity.name}</Text>
                  <Text style={styles.partySub}>
                    Lv {c.identity.level} · {c.identity.classId}
                  </Text>
                </View>
                <View style={styles.partyRight}>
                  <View style={styles.hpBarOuter}>
                    <View style={[styles.hpBarFill, {
                      width: `${Math.round(Math.max(0, Math.min(1, hpPct)) * 100)}%` as any,
                      backgroundColor: hpColor,
                    }]} />
                  </View>
                  <Text style={styles.hpTxt}>{c.resources.hp.current}/{c.resources.hp.maximum}</Text>
                </View>
              </View>
            );
          })}
        </>
      )}

      <Pressable style={styles.leaveBtn} onPress={confirmEnd}>
        <Text style={styles.leaveBtnTxt}>🗑 End Campaign</Text>
      </Pressable>
    </ScrollView>
  );
}

// ── Active Campaign View (Player) ─────────────────────────────────────────────

function PlayerActiveView() {
  const activeCampaign = useCampaignStore(s => s.activeCampaign);
  const leaveCampaign  = useCampaignStore(s => s.leaveCampaign);
  const syncStatus     = useSyncStore(s => s.status);

  if (!activeCampaign) return null;

  function confirmLeave() {
    Alert.alert('Leave Campaign', 'You will leave this campaign. Continue?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Leave', style: 'destructive', onPress: async () => {
          syncManager.stopAll();
          await leaveCampaign();
        }
      },
    ]);
  }

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <View style={styles.campaignCard}>
        <Text style={styles.campaignName}>{activeCampaign.name}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6 }}>
          <SyncStatusDot />
          <Text style={styles.campaignMeta}>
            {syncStatus.connected ? 'Connected to DM' : 'Reconnecting…'}
          </Text>
        </View>
      </View>

      <Pressable style={styles.leaveBtn} onPress={confirmLeave}>
        <Text style={styles.leaveBtnTxt}>🚪 Leave Campaign</Text>
      </Pressable>
    </ScrollView>
  );
}

// ── No Campaign View ──────────────────────────────────────────────────────────

function NoCampaignView({
  nickname, onNicknameChange, onCreate, onJoin,
}: {
  nickname:         string;
  onNicknameChange: (n: string) => void;
  onCreate:         () => void;
  onJoin:           () => void;
}) {
  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.contentCenter}>
      <Text style={styles.emptyIcon}>🗺️</Text>
      <Text style={styles.emptyHeading}>No Active Campaign</Text>

      {/* Nickname input */}
      <View style={[styles.nicknameRow, { alignSelf: 'stretch' }]}>
        <Text style={styles.nickLabel}>YOUR NAME</Text>
        <TextInput
          style={styles.nickInput}
          value={nickname}
          onChangeText={onNicknameChange}
          placeholder="Enter your name…"
          placeholderTextColor={Colors.textDim}
        />
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

  // Open join modal when navigated here with action=join (from home screen quick action)
  const actionHandled = useRef(false);
  useEffect(() => {
    if (action === 'join' && !actionHandled.current) {
      actionHandled.current = true;
      setJoinOpen(true);
    }
  }, [action]);

  useEffect(() => { loadCampaigns(); }, []);  // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (session?.nickname !== undefined) setLocalNick(session.nickname);
  }, [session?.nickname]);

  const handleNicknameChange = useCallback((n: string) => {
    setLocalNick(n);
    setNickname(n);   // persist to SecureStore via sessionStore
  }, [setNickname]);

  if (activeCampaign) {
    return (
      <View style={styles.screen}>
        <View style={styles.header}>
          <Text style={styles.title}>Campaigns</Text>
        </View>
        {isDm ? <DmActiveView /> : <PlayerActiveView />}
        <CreateModal visible={createOpen} onClose={() => setCreateOpen(false)} />
        <JoinModal   visible={joinOpen}   onClose={() => setJoinOpen(false)} />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.title}>Campaigns</Text>
      </View>
      <NoCampaignView
        nickname={nickname}
        onNicknameChange={handleNicknameChange}
        onCreate={() => setCreateOpen(true)}
        onJoin={() => setJoinOpen(true)}
      />
      <CreateModal visible={createOpen} onClose={() => setCreateOpen(false)} />
      <JoinModal   visible={joinOpen}   onClose={() => setJoinOpen(false)} />
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bg },
  header: {
    paddingTop:        Spacing.xl + 8,
    paddingBottom:     Spacing.md,
    paddingHorizontal: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  title: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.gold },

  scroll:        { flex: 1 },
  content:       { padding: Spacing.md, gap: Spacing.md, paddingBottom: Spacing.xxl },
  contentCenter: {
    flexGrow: 1, alignItems: 'center', justifyContent: 'center',
    padding: Spacing.xl, gap: Spacing.md,
  },

  sectionLabel: {
    fontSize: FontSize.xs, color: Colors.textSecondary,
    letterSpacing: 2, fontWeight: FontWeight.bold,
  },

  campaignCard: {
    backgroundColor: Colors.surface, borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.gold + '44',
    padding: Spacing.md, gap: Spacing.md,
  },
  campaignHeaderRow: { flexDirection: 'row', alignItems: 'flex-start' },
  campaignName:      { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  campaignMeta:      { fontSize: FontSize.sm, color: Colors.textSecondary },

  codeSection:  { alignItems: 'center', gap: Spacing.xs },
  codeLabel:    { fontSize: FontSize.xs, color: Colors.textDim, letterSpacing: 2 },
  codeValue:    { fontSize: 36, fontWeight: FontWeight.bold, color: Colors.gold, letterSpacing: 8 },
  codeHint:     { fontSize: FontSize.xs, color: Colors.textDim, textAlign: 'center' },

  qrContainer: { alignItems: 'center', padding: Spacing.md, backgroundColor: Colors.surface, borderRadius: Radius.lg },

  dmBtn:    { backgroundColor: Colors.gold, borderRadius: Radius.md, padding: Spacing.md, alignItems: 'center' },
  dmBtnTxt: { color: Colors.bg, fontWeight: FontWeight.bold, fontSize: FontSize.md },

  partyCard: {
    backgroundColor: Colors.surface, borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.border,
    padding: Spacing.md, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'space-between',
  },
  partyName:  { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  partySub:   { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },
  partyRight: { alignItems: 'flex-end', gap: 4 },
  hpBarOuter: { width: 80, height: 4, backgroundColor: Colors.border, borderRadius: Radius.full, overflow: 'hidden' },
  hpBarFill:  { height: '100%', borderRadius: Radius.full },
  hpTxt:      { fontSize: FontSize.xs, color: Colors.textSecondary },

  leaveBtn: {
    marginTop: Spacing.sm, borderRadius: Radius.md,
    padding: Spacing.md, alignItems: 'center',
    borderWidth: 1, borderColor: Colors.red + '66',
    backgroundColor: Colors.red + '11',
  },
  leaveBtnTxt: { color: Colors.red, fontWeight: FontWeight.bold, fontSize: FontSize.md },

  // No-campaign view
  emptyIcon:    { fontSize: 64 },
  emptyHeading: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.textPrimary, textAlign: 'center' },

  nicknameRow: { gap: 6 },
  nickLabel:   { fontSize: FontSize.xs, color: Colors.textSecondary, letterSpacing: 2, fontWeight: FontWeight.bold },
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

  // Modals
  backdrop: { flex: 1, backgroundColor: '#000000bb', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: Colors.surfaceHigh,
    borderTopLeftRadius: Radius.lg, borderTopRightRadius: Radius.lg,
    padding: Spacing.lg, gap: Spacing.md,
  },
  modalTitle: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.textPrimary, textAlign: 'center' },
  modalSub:   { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center' },
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
  cancelBtn:     { alignItems: 'center', padding: Spacing.sm },
  cancelTxt:     { color: Colors.textSecondary, fontSize: FontSize.md },
});
