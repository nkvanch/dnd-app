// ============================================================================
// FILE: src/components/live/LiveSessionStart.tsx
// The "not yet in a session" Live Session entry: a name field plus three
// buttons — Plan Campaign (DM prep, offline), Host Campaign, Join Campaign
// (by LAN address, 7-character room code, or QR scan) — matching the same
// name-field-then-pill-buttons-into-a-modal pattern the Campaigns page
// already uses for Create/Join Campaign. Extracted so the exact same entry
// renders inline on the Campaigns page as well as on the standalone /live
// route — same testIDs either way, so existing automation flows are
// unaffected by where it's mounted.
// ============================================================================
import { useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, Modal, KeyboardAvoidingView, ActivityIndicator, StyleSheet, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useSessionRuntime, getSessionRuntime } from '../../session/runtime';
import { useCharacterStore } from '../../store/characterStore';
import { EntityAdapter } from '../../session/entityAdapter';
import { parseAddress, SESSION_PORT } from '../../session/lanTransport';
import { decodeRoomCode } from '../../sync/discovery';
import { Capability, PeekResult } from '../../session/types';
import { StoredIdentity } from '../../session/peer';
import { checkCampaignCompatibility, CompatibilityIssue } from '../../engine/campaignCompatibility';
import { loadInstalledPacks, InstalledPack } from '../../db/packRegistryRepo';
import { Chip, Field, Row, Muted, Card, Badge, Body } from './LiveUi';
import { Alert } from '../../utils/alert';
import { E2E_ENABLED } from '../../session/e2e';
import { QrScannerModal } from '../QrScannerModal';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../../theme';

type HostRole = 'host' | 'host+dm' | 'host+player';

/**
 * The permanent "Live Session" card for the Campaigns page (idle state — no session yet).
 * Host/Join Session open the role-and-connection modals; "Advanced" is a quiet escape hatch to
 * a direct IP connect, so a raw address is available without making it the normal path. The
 * campaign itself is untouched by any of this — see the modals' own doc comments.
 */
export function LiveSessionCard({ onOpenE2e }: { onOpenE2e?: () => void }) {
  const router = useRouter();
  const rt = useSessionRuntime();
  const [nickname, setNickname] = useState(rt.nickname);
  const [hostOpen, setHostOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [ip, setIp] = useState('');

  async function connectByIp() {
    const target = parseAddress(ip);
    if (!target) { Alert.alert('Address needed', 'Enter the Host address, e.g. 192.168.1.20 (or 192.168.1.20:7743).'); return; }
    await getSessionRuntime().join({ host: target.host, port: target.port, nickname: nickname.trim() || 'Player', wants: ['player'] });
  }

  return (
    <View style={m.card}>
      <Text style={m.cardTitle}>Live Session</Text>
      <Muted>Run this campaign in a local multiplayer session. Your campaign stays available offline and isn't owned by the Host.</Muted>

      <Field label="Your name" value={nickname} onChangeText={setNickname} placeholder="Name shown to the table" testID="live-nickname" />

      <Pressable style={m.pill} onPress={() => setHostOpen(true)} testID="live-host-campaign">
        <Text style={m.pillLabel}>Host Session</Text>
      </Pressable>
      <Pressable style={[m.pill, m.pillAlt]} onPress={() => setJoinOpen(true)} testID="live-join-campaign">
        <Text style={[m.pillLabel, m.pillAltLabel]}>Join Session</Text>
      </Pressable>

      <Pressable style={m.advancedToggle} onPress={() => setAdvancedOpen(o => !o)} testID="live-advanced-toggle">
        <Text style={m.advancedToggleTxt}>Advanced {advancedOpen ? '▴' : '▾'}</Text>
      </Pressable>
      {advancedOpen && (
        <View style={m.advancedBody}>
          <Field label="Connect by IP" value={ip} onChangeText={setIp} placeholder="192.168.1.20" autoCapitalize="none" testID="live-advanced-ip" />
          <Pressable style={m.ghostBtn} onPress={() => { void connectByIp(); }} testID="live-advanced-connect">
            <Text style={m.ghostBtnTxt}>Connect</Text>
          </Pressable>
        </View>
      )}

      {E2E_ENABLED && (
        <Pressable style={m.pillGhost} onPress={() => (onOpenE2e ? onOpenE2e() : router.push('/live/e2e'))} testID="live-open-e2e">
          <Text style={m.pillGhostLabel}>E2E fixtures (test build)</Text>
        </Pressable>
      )}
      {!!rt.error && <Muted>{rt.error}</Muted>}

      <HostModal visible={hostOpen} onClose={() => setHostOpen(false)} nickname={nickname} />
      <JoinModal visible={joinOpen} onClose={() => setJoinOpen(false)} nickname={nickname} />
    </View>
  );
}

// ── Host Campaign modal ──────────────────────────────────────────────────────

export function HostModal({ visible, onClose, nickname, initialRole }: { visible: boolean; onClose: () => void; nickname: string; initialRole?: HostRole }) {
  const rt = useSessionRuntime();
  const characters = useCharacterStore(s => s.characters).filter(c => c.kind === 'character');
  const [hostRole, setHostRole] = useState<HostRole>(initialRole ?? 'host');
  const [autoDm, setAutoDm] = useState(false);
  const [characterId, setCharacterId] = useState<string | null>(null);
  const [resumable, setResumable] = useState(false);
  const [roomName, setRoomName] = useState('');
  const [maxParticipants, setMaxParticipants] = useState('');

  useEffect(() => {
    if (!visible) return;
    setHostRole(initialRole ?? 'host');
    void getSessionRuntime().hasResumableHostSession().then(setResumable).catch(() => setResumable(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  async function adapterFor(id: string | null): Promise<EntityAdapter | undefined> {
    if (!id) return undefined;
    const a = new EntityAdapter(id, getSessionRuntime().kv);
    await a.load();
    return a;
  }

  async function startHosting(resume: boolean) {
    const extra: Capability[] = hostRole === 'host+dm' ? ['dm'] : hostRole === 'host+player' ? ['player'] : [];
    if (hostRole === 'host+player' && !characterId) { Alert.alert('Pick a character', 'Host + Player needs a character to play.'); return; }
    try {
      // Resolve the adapter BEFORE building the options object: an `await` inside an object spread was
      // observed (on device, Hermes + Babel async transform) to silently drop the spread's properties.
      const adapter = hostRole === 'host+player' ? await adapterFor(characterId) : undefined;
      const maxN = maxParticipants.trim() ? Number(maxParticipants.trim()) : null;
      await getSessionRuntime().startHosting({
        nickname: nickname.trim() || 'Host', extraCaps: extra, dmPolicy: autoDm ? 'auto-first' : 'manual', resume,
        roomName: roomName.trim() || null,
        maxParticipants: maxN !== null && Number.isFinite(maxN) && maxN > 0 ? Math.floor(maxN) : null,
        ...(adapter && characterId ? { character: adapter, characterId } : {}),
      });
      onClose();
    } catch (e) {
      Alert.alert('Could not start the session', (e as Error).message);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={m.backdrop} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={m.backdropTapArea} onPress={onClose} />
        <Pressable style={m.sheet} onPress={e => e.stopPropagation()}>
          <Text style={m.title}>Host Campaign</Text>
          <Muted>The Host runs the connection. Hosting does NOT make you the DM unless you choose Host + DM.</Muted>
          <Row wrap>
            <Chip label="Host only" active={hostRole === 'host'} onPress={() => setHostRole('host')} testID="live-role-host" />
            <Chip label="Host + DM" active={hostRole === 'host+dm'} onPress={() => setHostRole('host+dm')} testID="live-role-hostdm" />
            <Chip label="Host + Player" active={hostRole === 'host+player'} onPress={() => setHostRole('host+player')} testID="live-role-hostplayer" />
          </Row>
          <Row wrap>
            <Chip label="Approve DMs manually" active={!autoDm} onPress={() => setAutoDm(false)} testID="live-policy-manual" />
            <Chip label="First DM joins automatically" active={autoDm} onPress={() => setAutoDm(true)} testID="live-policy-auto" />
          </Row>
          <Field label="Room name (optional)" value={roomName} onChangeText={setRoomName} placeholder="Tuesday Table" testID="live-room-name" />
          <Field label="Max participants (optional)" value={maxParticipants} onChangeText={setMaxParticipants}
            placeholder="Uncapped" keyboardType="number-pad" testID="live-max-participants" />
          {hostRole === 'host+player' && <CharacterPicker characters={characters} value={characterId} onChange={setCharacterId} />}
          <Pressable style={[m.primaryBtn, rt.busy && m.btnDisabled]} onPress={() => { void startHosting(false); }} disabled={rt.busy} testID="live-start-hosting">
            {rt.busy ? <ActivityIndicator color={Colors.bg} /> : <Text style={m.primaryBtnTxt}>Start hosting</Text>}
          </Pressable>
          {resumable && (
            <Pressable style={m.ghostBtn} onPress={() => { void startHosting(true); }} testID="live-resume-hosting">
              <Text style={m.ghostBtnTxt}>Resume previous hosted session</Text>
            </Pressable>
          )}
          <Pressable style={m.cancelBtn} onPress={onClose}>
            <Text style={m.cancelTxt}>Cancel</Text>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ── Join Campaign modal ──────────────────────────────────────────────────────

// Join hierarchy per CAMPAIGN_DM_AUTHORITY_RULES.md §33: room code is the normal path (primary
// field + QR scan); a direct IP is a deliberately secondary "Advanced" escape hatch, not an
// equally-weighted alternative — so it gets its own disclosed field, not a dual-purpose one.
//
// Three steps, per JOIN_SESSION_FLOW_SPEC.md: 'find' (resolve a target and peek the room, without
// joining it) -> 'confirm' (what peekRoom() answered — Host identity, attached campaign,
// participant count, whether approval is required — before the user commits to anything) ->
// 'role' (Player/DM + character, same mechanics as before this screen existed). Peeking never
// registers a participant on the Host (see session/roomPeek.ts) — backing out of 'confirm' costs
// the room nothing.
type JoinStep = 'find' | 'confirm' | 'role';

export function JoinModal({ visible, onClose, nickname }: { visible: boolean; onClose: () => void; nickname: string }) {
  const rt = useSessionRuntime();
  const characters = useCharacterStore(s => s.characters).filter(c => c.kind === 'character');
  const [code, setCode] = useState('');
  const [ip, setIp] = useState('');
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [wantPlayer, setWantPlayer] = useState(true);
  const [wantDm, setWantDm] = useState(false);
  const [characterId, setCharacterId] = useState<string | null>(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [step, setStep] = useState<JoinStep>('find');
  const [peeking, setPeeking] = useState(false);
  const [peekError, setPeekError] = useState<string | null>(null);
  const [peek, setPeek] = useState<PeekResult | null>(null);
  const [target, setTarget] = useState<{ host: string; port: number } | null>(null);
  const [installedPacks, setInstalledPacks] = useState<InstalledPack[]>([]);
  const [storedIdentity, setStoredIdentity] = useState<StoredIdentity | null>(null);
  const [reconnecting, setReconnecting] = useState(false);

  useEffect(() => {
    if (visible) return;
    setStep('find'); setPeek(null); setPeekError(null); setTarget(null); setStoredIdentity(null);
    setCode(''); setIp(''); setAdvancedOpen(false); setCharacterId(null);
  }, [visible]);

  // Loaded once the role step can actually use it (compatibility checking below) — no-op on web
  // or when nothing is installed, same as every other installed-pack consumer in this app.
  useEffect(() => {
    if (step !== 'role') return;
    void loadInstalledPacks().then(setInstalledPacks);
  }, [step]);

  // JOIN_SESSION_FLOW_SPEC.md: "show whether that character is compatible... before joining
  // rather than silently rewriting anything." Never blocks — see checkCampaignCompatibility's
  // own doc comment for why this is advisory, not a gate.
  const compatIssues: CompatibilityIssue[] = useMemo(() => {
    if (!wantPlayer || !characterId || !peek?.campaign) return [];
    const entity = characters.find(c => c.id === characterId);
    if (!entity) return [];
    return checkCampaignCompatibility(entity, peek.campaign, installedPacks);
  }, [wantPlayer, characterId, peek, characters, installedPacks]);

  async function adapterFor(id: string | null): Promise<EntityAdapter | undefined> {
    if (!id) return undefined;
    const a = new EntityAdapter(id, getSessionRuntime().kv);
    await a.load();
    return a;
  }

  async function findRoom(candidate: { host: string; port: number } | null) {
    if (!candidate) { Alert.alert('Address needed', 'Enter the room code, scan the QR, or use Advanced to connect by IP.'); return; }
    setPeeking(true); setPeekError(null);
    try {
      const result = await getSessionRuntime().peekRoom(candidate.host, candidate.port);
      if (result.ended) { Alert.alert('Session ended', 'This room has already ended.'); return; }
      // The room code only says which room; a stored identity (if any) says who this device
      // already is there — a purely local lookup, no network round trip of its own.
      const identity = await getSessionRuntime().findStoredIdentity(candidate.host, candidate.port);
      setPeek(result); setTarget(candidate); setStoredIdentity(identity); setStep('confirm');
    } catch (e) {
      setPeekError((e as Error).message);
    } finally {
      setPeeking(false);
    }
  }

  async function reconnectAsStored() {
    if (!target || !storedIdentity) return;
    setReconnecting(true);
    try {
      const adapter = storedIdentity.characterId ? await adapterFor(storedIdentity.characterId) : undefined;
      await getSessionRuntime().join({
        host: target.host, port: target.port, nickname: storedIdentity.nickname, wants: storedIdentity.capabilities,
        ...(adapter && storedIdentity.characterId ? { character: adapter, characterId: storedIdentity.characterId } : {}),
      });
      onClose();
    } catch (e) {
      Alert.alert('Could not reconnect', (e as Error).message);
    } finally {
      setReconnecting(false);
    }
  }

  async function join() {
    if (!target) return;
    const wants: Capability[] = [...(wantPlayer ? ['player' as Capability] : []), ...(wantDm ? ['dm' as Capability] : [])];
    if (wants.length === 0) { Alert.alert('Pick a role', 'Join as Player, DM, or both.'); return; }
    if (wantPlayer && !characterId) { Alert.alert('Pick a character', 'Joining as a Player needs a character.'); return; }
    const adapter = wantPlayer ? await adapterFor(characterId) : undefined;   // see note in HostModal
    await getSessionRuntime().join({
      host: target.host, port: target.port, nickname: nickname.trim() || 'Player', wants,
      ...(adapter && characterId ? { character: adapter, characterId } : {}),
    });
    onClose();
  }

  function targetFromCode(raw: string): { host: string; port: number } | null {
    try { const { ip: host, port } = decodeRoomCode(raw, SESSION_PORT); return { host, port }; } catch { return null; }
  }

  return (
    <>
      <QrScannerModal visible={scannerOpen}
        hint="Point at the Host's room-code QR"
        onScan={scanned => { setScannerOpen(false); setCode(scanned); void findRoom(targetFromCode(scanned)); }}
        onClose={() => setScannerOpen(false)} />
      <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
        <KeyboardAvoidingView style={m.backdrop} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <Pressable style={m.backdropTapArea} onPress={onClose} />
          <Pressable style={m.sheet} onPress={e => e.stopPropagation()}>

            {step === 'find' && (
              <>
                <Text style={m.title}>Join Session</Text>
                <Muted>Enter the Host's 7-character room code, or scan the QR they're showing.</Muted>
                <Field label="Room code" value={code} onChangeText={t => setCode(t.toUpperCase().slice(0, 7))}
                  placeholder="K7M4XQP" autoCapitalize="characters" maxLength={7} testID="live-address" />
                {Platform.OS !== 'web' && (
                  <Pressable style={m.ghostBtn} onPress={() => setScannerOpen(true)} testID="live-scan-qr">
                    <Text style={m.ghostBtnTxt}>📷  Scan QR Code</Text>
                  </Pressable>
                )}
                {!!peekError && <Muted>{peekError}</Muted>}
                <Pressable style={[m.primaryBtn, peeking && m.btnDisabled]} onPress={() => { void findRoom(targetFromCode(code)); }} disabled={peeking} testID="live-find-room">
                  {peeking ? <ActivityIndicator color={Colors.bg} /> : <Text style={m.primaryBtnTxt}>Find room</Text>}
                </Pressable>

                <Pressable style={m.advancedToggle} onPress={() => setAdvancedOpen(o => !o)} testID="live-join-advanced-toggle">
                  <Text style={m.advancedToggleTxt}>Advanced {advancedOpen ? '▴' : '▾'}</Text>
                </Pressable>
                {advancedOpen && (
                  <View style={m.advancedBody}>
                    <Field label="Connect by IP" value={ip} onChangeText={setIp} placeholder="192.168.1.20" autoCapitalize="none" testID="live-join-ip" />
                    <Pressable style={[m.ghostBtn, peeking && m.btnDisabled]} onPress={() => { void findRoom(parseAddress(ip)); }} disabled={peeking} testID="live-join-ip-connect">
                      <Text style={m.ghostBtnTxt}>Connect</Text>
                    </Pressable>
                  </View>
                )}

                <Pressable style={m.cancelBtn} onPress={onClose}>
                  <Text style={m.cancelTxt}>Cancel</Text>
                </Pressable>
              </>
            )}

            {step === 'confirm' && peek && (
              <>
                <Text style={m.title}>{peek.roomName ?? 'Room Found'}</Text>
                <Card testID="live-join-confirm">
                  <Row wrap>
                    <Body bold>{peek.hostNickname ?? 'Unknown Host'}</Body>
                    <Badge label={peek.dmApprovalRequired ? 'DM approval required' : 'DM joins freely'} tone={peek.dmApprovalRequired ? 'warn' : 'good'} />
                    {peek.maxParticipants !== null && peek.participantCount >= peek.maxParticipants && (
                      <Badge label="Room full" tone="bad" />
                    )}
                  </Row>
                  <Muted>{peek.campaign ? `Campaign attached: ${peek.campaign.name}` : 'No campaign attached yet'}</Muted>
                  <Muted>
                    {peek.participantCount}{peek.maxParticipants !== null ? ` / ${peek.maxParticipants}` : ''} participant{peek.participantCount === 1 ? '' : 's'} connected
                  </Muted>
                </Card>

                {storedIdentity && (
                  <Card testID="live-join-reconnect">
                    <Body bold>Previous participant found</Body>
                    {storedIdentity.characterId && (
                      <Muted>Character: {characters.find(c => c.id === storedIdentity.characterId)?.identity.name ?? 'Unknown character'}</Muted>
                    )}
                    <Muted>Role: {roleLabel(storedIdentity.capabilities)}</Muted>
                    <Pressable style={[m.primaryBtn, reconnecting && m.btnDisabled]} onPress={() => { void reconnectAsStored(); }} disabled={reconnecting} testID="live-join-reconnect-confirm">
                      {reconnecting ? <ActivityIndicator color={Colors.bg} /> : <Text style={m.primaryBtnTxt}>Reconnect as {storedIdentity.nickname}</Text>}
                    </Pressable>
                  </Card>
                )}

                <Pressable style={storedIdentity ? m.ghostBtn : m.primaryBtn} onPress={() => setStep('role')} testID="live-join-confirm-continue">
                  <Text style={storedIdentity ? m.ghostBtnTxt : m.primaryBtnTxt}>{storedIdentity ? 'Join as someone else' : 'Continue'}</Text>
                </Pressable>
                <Pressable style={m.ghostBtn} onPress={() => setStep('find')} testID="live-join-confirm-back">
                  <Text style={m.ghostBtnTxt}>Back</Text>
                </Pressable>
                <Pressable style={m.cancelBtn} onPress={onClose}>
                  <Text style={m.cancelTxt}>Cancel</Text>
                </Pressable>
              </>
            )}

            {step === 'role' && (
              <>
                <Text style={m.title}>Join as…</Text>
                <Muted>There's no Host role here — Host is only ever created locally when starting a room.</Muted>
                <Row wrap>
                  <Chip label="Player" active={wantPlayer} onPress={() => setWantPlayer(!wantPlayer)} testID="live-want-player" />
                  <Chip label="DM" active={wantDm} onPress={() => setWantDm(!wantDm)} testID="live-want-dm" />
                </Row>
                {wantPlayer && <CharacterPicker characters={characters} value={characterId} onChange={setCharacterId} />}
                {compatIssues.length > 0 && (
                  <Card tone="warn" testID="live-join-compat-issues">
                    <Body bold>This character doesn't fully match the campaign's rules</Body>
                    {compatIssues.map((issue, i) => <Muted key={i}>• {issue.message}</Muted>)}
                    <Muted>You can still join — the DM can review this once you're in.</Muted>
                  </Card>
                )}
                <Pressable style={[m.primaryBtn, rt.busy && m.btnDisabled]} onPress={() => { void join(); }} disabled={rt.busy} testID="live-join">
                  {rt.busy ? <ActivityIndicator color={Colors.bg} /> : <Text style={m.primaryBtnTxt}>{compatIssues.length > 0 ? 'Join anyway' : 'Join session'}</Text>}
                </Pressable>
                <Pressable style={m.ghostBtn} onPress={() => setStep('confirm')}>
                  <Text style={m.ghostBtnTxt}>Back</Text>
                </Pressable>
                <Pressable style={m.cancelBtn} onPress={onClose}>
                  <Text style={m.cancelTxt}>Cancel</Text>
                </Pressable>
              </>
            )}

          </Pressable>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

function roleLabel(capabilities: Capability[]): string {
  const player = capabilities.includes('player');
  const dm = capabilities.includes('dm');
  if (player && dm) return 'Player + DM';
  if (dm) return 'DM';
  if (player) return 'Player';
  return 'Observer';
}

function CharacterPicker({ characters, value, onChange }: {
  characters: { id: string; identity: { name: string; level: number } }[]; value: string | null; onChange: (id: string) => void;
}) {
  if (characters.length === 0) return <Muted>Create a character first (Characters tab).</Muted>;
  return (
    <Row wrap>
      {characters.map(c => (
        <Chip key={c.id} label={`${c.identity.name || 'Unnamed'} (Lv ${c.identity.level})`} active={value === c.id} onPress={() => onChange(c.id)} testID={`live-char-${c.id}`} />
      ))}
    </Row>
  );
}

const m = StyleSheet.create({
  wrap: { gap: Spacing.sm },

  // Deliberately no border/background here — a boxed card reads as a separate floating widget
  // sitting on top of the page. This section should look like part of the Campaigns page itself,
  // the same way "No Active Campaign" below it is plain content, not a card.
  card: {
    paddingHorizontal: Spacing.md, paddingTop: Spacing.md, gap: Spacing.sm,
  },
  cardTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.gold },
  advancedToggle: { paddingVertical: Spacing.xs },
  advancedToggleTxt: { color: Colors.textDim, fontSize: FontSize.sm, fontWeight: FontWeight.bold },
  advancedBody: { gap: Spacing.sm },

  pill: { backgroundColor: Colors.gold, borderRadius: Radius.md, paddingVertical: 14, alignItems: 'center' },
  pillLabel: { color: Colors.bg, fontWeight: FontWeight.bold, fontSize: FontSize.md },
  pillAlt: { backgroundColor: Colors.surfaceHigh, borderWidth: 1, borderColor: Colors.border },
  pillAltLabel: { color: Colors.textPrimary },
  pillGhost: { alignItems: 'center', paddingVertical: Spacing.xs },
  pillGhostLabel: { color: Colors.textDim, fontSize: FontSize.xs, fontWeight: FontWeight.bold },

  backdrop: { flex: 1, backgroundColor: '#000000bb', justifyContent: 'flex-end' },
  backdropTapArea: StyleSheet.absoluteFill,
  sheet: {
    backgroundColor: Colors.surfaceHigh, borderTopLeftRadius: Radius.lg, borderTopRightRadius: Radius.lg,
    padding: Spacing.lg, gap: Spacing.sm, maxHeight: '85%',
  },
  // One gold primary action per modal, same as Create/Join Campaign — everything else (title,
  // secondary actions) stays neutral so gold reads as "the button to press," not decoration.
  title: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.textPrimary, textAlign: 'center' },
  primaryBtn: { backgroundColor: Colors.gold, borderRadius: Radius.md, paddingVertical: 14, alignItems: 'center', marginTop: Spacing.xs },
  primaryBtnTxt: { color: Colors.bg, fontWeight: FontWeight.bold, fontSize: FontSize.md },
  btnDisabled: { opacity: 0.5 },
  ghostBtn: { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, paddingVertical: 10, alignItems: 'center' },
  ghostBtnTxt: { color: Colors.textPrimary, fontWeight: FontWeight.bold, fontSize: FontSize.sm },
  cancelBtn: { alignItems: 'center', paddingVertical: Spacing.sm, marginBottom: 10 },
  cancelTxt: { color: Colors.textDim, fontSize: FontSize.sm },
});
