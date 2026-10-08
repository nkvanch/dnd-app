// app/live/host.tsx
// HOST screen: session lifecycle, connection state, participants and role assignment.
// A Host-only device sees ONLY this. It gets no encounters, effects, requests or DM
// material (see projectState's 'host' level), and no button here grants DM tools to itself.
import { useRouter } from 'expo-router';
import { useSessionRuntime, getSessionRuntime } from '../../src/session/runtime';
import { LiveScreen, Section, Card, Btn, Row, Badge, Muted, Body, NotCapable } from '../../src/components/live/LiveUi';
import { capabilityLabel } from '../../src/session/routing';
import { Alert } from '../../src/utils/alert';

export default function HostScreen() {
  const router = useRouter();
  const rt = useSessionRuntime();
  const peer = getSessionRuntime().currentPeer;

  if (!rt.capabilities.includes('host') || !peer) {
    return <LiveScreen title="Host"><NotCapable needs="the Host" /></LiveScreen>;
  }

  const participants = Object.values(rt.view?.participants ?? {});

  return (
    <LiveScreen title="Host" subtitle={`Session revision ${rt.view?.revision ?? 0}`}>
      <Card testID="host-status">
        <Row wrap>
          <Badge label={rt.status} tone={rt.status === 'connected' ? 'good' : 'warn'} />
          {rt.view?.ended && <Badge label="ended" tone="bad" />}
        </Row>
        {rt.address
          ? <Body bold>Players join at {rt.address}</Body>
          : <Muted>No local network right now. Enable Wi-Fi or a hotspot so others can join.</Muted>}
        {!!rt.view?.campaign && <Muted>Campaign linked by the DM: {rt.view.campaign.name}</Muted>}
        <Muted>This device: {capabilityLabel(rt.capabilities)}</Muted>
      </Card>

      <Section title={`Participants (${participants.length})`}
        hint="You manage who is connected and which roles they hold. Hosting alone does not give access to DM preparation or secrets.">
        {participants.map(p => {
          const isMe = p.id === rt.participantId;
          return (
            <Card key={p.id} testID={`host-participant-${p.nickname}`}>
              <Row wrap>
                <Body bold>{p.nickname}{isMe ? ' (you)' : ''}</Body>
                <Badge label={p.connected ? 'online' : 'offline'} tone={p.connected ? 'good' : 'bad'} />
                {p.capabilities.map(c => <Badge key={c} label={c} />)}
                {p.requestedDm && <Badge label="wants DM" tone="warn" />}
              </Row>
              {!isMe && (
                <Row wrap>
                  {p.requestedDm && !p.capabilities.includes('dm') && (
                    <Btn small label={`Approve ${p.nickname} as DM`} testID={`host-approve-dm-${p.nickname}`}
                      onPress={() => peer.assignCapabilities(p.id, [...p.capabilities.filter(c => c !== 'host'), 'dm'])} />
                  )}
                  {p.capabilities.includes('dm') && (
                    <Btn small kind="ghost" label="Remove DM" testID={`host-remove-dm-${p.nickname}`}
                      onPress={() => peer.assignCapabilities(p.id, p.capabilities.filter(c => c === 'player'))} />
                  )}
                  {!p.capabilities.includes('player') && (
                    <Btn small kind="ghost" label="Make player" testID={`host-make-player-${p.nickname}`}
                      onPress={() => peer.assignCapabilities(p.id, [...p.capabilities.filter(c => c !== 'host'), 'player'])} />
                  )}
                </Row>
              )}
            </Card>
          );
        })}
      </Section>

      <Section title="Session">
        <Btn label="Stop hosting (keep session for later)" kind="ghost" testID="host-stop"
          onPress={() => { void getSessionRuntime().leave().then(() => router.replace('/live')); }} />
        <Btn label="End session for everyone" kind="danger" testID="host-end"
          onPress={() => Alert.alert('End session?', 'Everyone is told the session is over. Campaign preparation stays with each DM.', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'End session', style: 'destructive', onPress: () => { void getSessionRuntime().endHostedSession().then(() => router.replace('/live')); } },
          ])} />
      </Section>
    </LiveScreen>
  );
}
