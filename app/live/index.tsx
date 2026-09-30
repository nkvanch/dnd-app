// app/live/index.tsx
// Live Session hub. Chooses what this device does in a session; afterwards routes by capability.
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import { useSessionRuntime, getSessionRuntime } from '../../src/session/runtime';
import { useCharacterStore } from '../../src/store/characterStore';
import { EntityAdapter } from '../../src/session/entityAdapter';
import { parseAddress } from '../../src/session/lanTransport';
import { destinationsFor, primaryDestination, DESTINATION_PATH, DESTINATION_LABEL, capabilityLabel } from '../../src/session/routing';
import { Capability } from '../../src/session/types';
import { LiveScreen, Section, Card, Btn, Chip, Field, Row, Badge, Muted, Body } from '../../src/components/live/LiveUi';
import { Alert } from '../../src/utils/alert';
import { E2E_ENABLED } from '../../src/session/e2e';

type HostRole = 'host' | 'host+dm' | 'host+player';

export default function LiveHub() {
  const router = useRouter();
  const rt = useSessionRuntime();
  const characters = useCharacterStore(s => s.characters).filter(c => c.kind === 'character');
  const [nickname, setNickname] = useState(rt.nickname);
  const [hostRole, setHostRole] = useState<HostRole>('host');
  const [autoDm, setAutoDm] = useState(false);
  const [address, setAddress] = useState('');
  const [wantPlayer, setWantPlayer] = useState(true);
  const [wantDm, setWantDm] = useState(false);
  const [characterId, setCharacterId] = useState<string | null>(null);
  const [resumable, setResumable] = useState(false);
  const wasIdle = useRef(rt.mode === 'idle');

  useEffect(() => {
    void getSessionRuntime().hasResumableHostSession().then(setResumable).catch(() => setResumable(false));
  }, [rt.mode]);

  // Open the single relevant screen automatically the first time a role arrives.
  useEffect(() => {
    if (rt.mode === 'idle') { wasIdle.current = true; return; }
    if (wasIdle.current && rt.status === 'connected') {
      const dest = primaryDestination(rt.capabilities);
      if (dest) { wasIdle.current = false; router.push(DESTINATION_PATH[dest]); }
    }
  }, [rt.mode, rt.status, rt.capabilities, router]);

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
      await getSessionRuntime().startHosting({
        nickname: nickname.trim() || 'Host', extraCaps: extra, dmPolicy: autoDm ? 'auto-first' : 'manual', resume,
        ...(adapter && characterId ? { character: adapter, characterId } : {}),
      });
    } catch (e) {
      Alert.alert('Could not start the session', (e as Error).message);
    }
  }

  async function join() {
    const addr = parseAddress(address);
    if (!addr) { Alert.alert('Address needed', 'Enter the Host address, for example 192.168.1.20 (or 192.168.1.20:7743).'); return; }
    const wants: Capability[] = [...(wantPlayer ? ['player' as Capability] : []), ...(wantDm ? ['dm' as Capability] : [])];
    if (wants.length === 0) { Alert.alert('Pick a role', 'Join as Player, DM, or both.'); return; }
    if (wantPlayer && !characterId) { Alert.alert('Pick a character', 'Joining as a Player needs a character.'); return; }
    const adapter = wantPlayer ? await adapterFor(characterId) : undefined;   // see note in startHosting
    await getSessionRuntime().join({
      host: addr.host, port: addr.port, nickname: nickname.trim() || 'Player', wants,
      ...(adapter && characterId ? { character: adapter, characterId } : {}),
    });
  }

  if (rt.mode !== 'idle') {
    const dests = destinationsFor(rt.capabilities);
    return (
      <LiveScreen title="Live Session" subtitle={capabilityLabel(rt.capabilities)} backTo="/(tabs)/campaigns">
        <Card testID="live-status">
          <Row wrap>
            {rt.capabilities.map(c => <Badge key={c} label={c} tone="good" />)}
            <Badge label={rt.status} tone={rt.status === 'connected' ? 'good' : 'warn'} />
          </Row>
          {rt.mode === 'hosting' && !!rt.address && <Body bold>Others join at {rt.address}</Body>}
          {rt.mode === 'hosting' && !rt.address && <Muted>No local network right now. You can prepare, but others cannot join yet.</Muted>}
          {rt.mode === 'joined' && !!rt.address && <Muted>Connected to {rt.address}</Muted>}
          {!!rt.error && <Muted>{rt.error}</Muted>}
          <Muted>Session revision {rt.view?.revision ?? 0}</Muted>
        </Card>
        {dests.length === 0 && (
          <Card tone="warn"><Body bold>Waiting for the Host to assign you a role.</Body>
            <Muted>You asked for DM. The Host approves DM access from their Host screen.</Muted></Card>
        )}
        <Section title="Open">
          {dests.map(d => (
            <Btn key={d} label={`${DESTINATION_LABEL[d]} screen`} onPress={() => router.push(DESTINATION_PATH[d])} testID={`live-open-${d}`} />
          ))}
          <Btn label="DM preparation (offline)" kind="ghost" onPress={() => router.push('/live/prepare')} testID="live-open-prepare" />
        </Section>
        {rt.status === 'disconnected' && rt.mode === 'joined' && (
          <Btn label="Reconnect" kind="ghost" onPress={() => { void getSessionRuntime().reconnect(); }} testID="live-reconnect" />
        )}
        <Btn label="Leave session" kind="danger" onPress={() => { void getSessionRuntime().leave(); }} testID="live-leave" />
      </LiveScreen>
    );
  }

  return (
    <LiveScreen title="Live Session" subtitle="Host, DM and Player are separate roles" backTo="/(tabs)/campaigns">
      <Section title="Prepare a campaign" hint="DM preparation is saved on this device and works with no Host and no network.">
        <Btn label="DM preparation (offline)" onPress={() => router.push('/live/prepare')} testID="live-open-prepare" />
      </Section>

      {E2E_ENABLED && <Btn label="E2E fixtures (test build)" kind="ghost" onPress={() => router.push('/live/e2e')} testID="live-open-e2e" />}

      <Section title="Your name">
        <Field label="Display name" value={nickname} onChangeText={setNickname} placeholder="Name shown to the table" testID="live-nickname" />
      </Section>

      <Section title="Host a session" hint="The Host runs the connection. Hosting does NOT make you the DM unless you choose Host + DM.">
        <Row wrap>
          <Chip label="Host only" active={hostRole === 'host'} onPress={() => setHostRole('host')} testID="live-role-host" />
          <Chip label="Host + DM" active={hostRole === 'host+dm'} onPress={() => setHostRole('host+dm')} testID="live-role-hostdm" />
          <Chip label="Host + Player" active={hostRole === 'host+player'} onPress={() => setHostRole('host+player')} testID="live-role-hostplayer" />
        </Row>
        <Row wrap>
          <Chip label="Approve DMs manually" active={!autoDm} onPress={() => setAutoDm(false)} testID="live-policy-manual" />
          <Chip label="First DM joins automatically" active={autoDm} onPress={() => setAutoDm(true)} testID="live-policy-auto" />
        </Row>
        {hostRole === 'host+player' && <CharacterPicker characters={characters} value={characterId} onChange={setCharacterId} />}
        <Btn label="Start hosting" onPress={() => { void startHosting(false); }} disabled={rt.busy} testID="live-start-hosting" />
        {resumable && <Btn label="Resume previous hosted session" kind="ghost" onPress={() => { void startHosting(true); }} testID="live-resume-hosting" />}
      </Section>

      <Section title="Join a session">
        <Field label="Host address" value={address} onChangeText={setAddress} placeholder="192.168.1.20" autoCapitalize="none" keyboardType="numbers-and-punctuation" testID="live-address" />
        <Row wrap>
          <Chip label="Player" active={wantPlayer} onPress={() => setWantPlayer(!wantPlayer)} testID="live-want-player" />
          <Chip label="DM" active={wantDm} onPress={() => setWantDm(!wantDm)} testID="live-want-dm" />
        </Row>
        {wantPlayer && <CharacterPicker characters={characters} value={characterId} onChange={setCharacterId} />}
        <Btn label="Join session" onPress={() => { void join(); }} disabled={rt.busy} testID="live-join" />
        {!!rt.error && <Muted>{rt.error}</Muted>}
      </Section>
    </LiveScreen>
  );
}

function CharacterPicker({ characters, value, onChange }: {
  characters: { id: string; identity: { name: string; level: number } }[]; value: string | null; onChange: (id: string) => void;
}) {
  if (characters.length === 0) return <Muted>Create a character first (Characters tab).</Muted>;
  return (
    <Section title="Character">
      <Row wrap>
        {characters.map(c => (
          <Chip key={c.id} label={`${c.identity.name || 'Unnamed'} (Lv ${c.identity.level})`} active={value === c.id} onPress={() => onChange(c.id)} testID={`live-char-${c.id}`} />
        ))}
      </Row>
    </Section>
  );
}
