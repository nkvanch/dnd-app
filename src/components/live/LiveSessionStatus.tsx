// ============================================================================
// FILE: src/components/live/LiveSessionStatus.tsx
// The "already in a session" status view: capabilities, connection state,
// the room code/QR while hosting, and buttons to open the Host/DM/Player
// screens. Extracted from app/live/index.tsx so it renders identically
// whether reached via the standalone /live route or inline on the
// Campaigns page — same testIDs either way.
// ============================================================================
import { useRouter } from 'expo-router';
import { useSessionRuntime, getSessionRuntime } from '../../session/runtime';
import { destinationsFor, DESTINATION_PATH, DESTINATION_LABEL } from '../../session/routing';
import { Section, Card, Btn, Row, Badge, Muted, Body } from './LiveUi';
import { RoomCodeCard } from './RoomCodeCard';

export function LiveSessionStatus({ onOpenPrepare }: { onOpenPrepare?: () => void }) {
  const router = useRouter();
  const rt = useSessionRuntime();
  const dests = destinationsFor(rt.capabilities);

  return (
    <>
      <Card testID="live-status">
        <Row wrap>
          {rt.capabilities.map(c => <Badge key={c} label={c} tone="good" />)}
          <Badge label={rt.status} tone={rt.status === 'connected' ? 'good' : 'warn'} />
        </Row>
        {rt.mode === 'hosting' && !!rt.roomCode && <RoomCodeCard code={rt.roomCode} />}
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
        <Btn label="DM preparation (offline)" kind="ghost" onPress={() => (onOpenPrepare ? onOpenPrepare() : router.push('/live/prepare'))} testID="live-open-prepare" />
      </Section>
      {rt.status === 'disconnected' && rt.mode === 'joined' && (
        <Btn label="Reconnect" kind="ghost" onPress={() => { void getSessionRuntime().reconnect(); }} testID="live-reconnect" />
      )}
      <Btn label="Leave session" kind="danger" onPress={() => { void getSessionRuntime().leave(); }} testID="live-leave" />
    </>
  );
}
