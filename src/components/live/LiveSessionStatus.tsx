// ============================================================================
// FILE: src/components/live/LiveSessionStatus.tsx
// The "already in a session" status view, rendered as a card inside the
// Campaigns page's permanent Live Session section (and, wrapped in its own
// screen chrome, on the standalone /live route). Shows role-specific detail
// — Hosting / Connected as DM / Connected as Player — using data the client
// already has in `rt.view` (participants, campaign, encounters), not new
// plumbing. Ending as the Host ends the session for the whole table
// (`endHostedSession`); DM/Player-only disconnecting only leaves (`leave`).
// ============================================================================
import { View, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { useSessionRuntime, getSessionRuntime } from '../../session/runtime';
import { destinationsFor, DESTINATION_PATH, DESTINATION_LABEL } from '../../session/routing';
import { PublicParticipant } from '../../session/types';
import { encodeRoomCode } from '../../sync/discovery';
import { Section, Card, Btn, Row, Badge, Muted, Body } from './LiveUi';
import { RoomCodeCard } from './RoomCodeCard';
import { Colors, FontSize, FontWeight } from '../../theme';

function rolesOf(p: PublicParticipant): string {
  if (p.capabilities.length === 0) return p.requestedDm ? 'waiting for DM approval' : 'waiting for a role';
  return p.capabilities.join(' + ');
}

/**
 * A joined (non-Host) client doesn't generate a room code — only the Host's own device knows its
 * IP well enough to encode one directly. But `join()` stores `address` as the same "host:port"
 * shape the Host's own address uses (see runtime.ts), so the equivalent code can always be
 * recomputed from it: code and IP are a two-way mapping (`src/sync/discovery.ts`), not separate
 * identities. Per CAMPAIGN_DM_AUTHORITY_RULES.md §32, every connected state should show a room
 * code, not just the Host's.
 */
function codeFromAddress(address: string | null): string | null {
  if (!address) return null;
  const host = address.split(':')[0];
  try { return encodeRoomCode(host); } catch { return null; }
}

export function LiveSessionStatus({ onOpenPrepare }: { onOpenPrepare?: () => void }) {
  const router = useRouter();
  const rt = useSessionRuntime();
  const dests = destinationsFor(rt.capabilities);
  const isHost = rt.capabilities.includes('host');
  const isDm = rt.capabilities.includes('dm');
  const isPlayerOnly = rt.capabilities.includes('player') && !isHost && !isDm;
  const participants = Object.values(rt.view?.participants ?? {});
  const host = participants.find(p => p.capabilities.includes('host'));
  const activeEncounter = Object.values(rt.view?.encounters ?? {}).find(e => e.active);
  const myCharacter = rt.participantId ? rt.view?.characters[rt.participantId]?.summary.name : undefined;
  const joinedCode = !isHost ? codeFromAddress(rt.address) : null;

  async function endOrLeave(): Promise<void> {
    if (isHost) await getSessionRuntime().endHostedSession();
    else await getSessionRuntime().leave();
  }

  return (
    <>
      <Card testID="live-status">
        <Row wrap>
          {rt.capabilities.map(c => <Badge key={c} label={c} tone="good" />)}
          <Badge label={rt.status} tone={rt.status === 'connected' ? 'good' : 'warn'} />
        </Row>

        {isHost && (
          <Body bold>{isDm || isPlayerOnly ? 'Hosting' : 'Live Session — Hosting'}</Body>
        )}
        {!!rt.roomCode && <RoomCodeCard code={rt.roomCode} />}
        {isHost && !rt.roomCode && !!rt.address && <Body bold>Others join at {rt.address}</Body>}
        {isHost && !rt.address && <Muted>No local network right now. You can prepare, but others cannot join yet.</Muted>}

        {!!joinedCode && <Text style={{ color: Colors.gold, fontSize: FontSize.lg, fontWeight: FontWeight.bold, letterSpacing: 4 }}>Room: {joinedCode}</Text>}
        {!isHost && !!rt.address && <Muted>Connected to {rt.address}</Muted>}
        {!isHost && host && <Muted>Host: {host.nickname}{host.connected ? '' : ' (disconnected)'}</Muted>}

        {participants.length > 0 && (
          <Muted>
            {participants.length} participant{participants.length === 1 ? '' : 's'} — {participants.map(p => `${p.nickname} (${rolesOf(p)})`).join(', ')}
          </Muted>
        )}
        {isDm && !!rt.view?.campaign && <Muted>Campaign attached: {rt.view.campaign.name}</Muted>}
        {(isDm || isHost) && activeEncounter && <Muted>Active encounter: {activeEncounter.name}</Muted>}
        {isPlayerOnly && !!myCharacter && <Muted>Playing: {myCharacter}</Muted>}

        {!!rt.error && <Muted>{rt.error}</Muted>}
        <Muted>Session revision {rt.view?.revision ?? 0}</Muted>
      </Card>

      {dests.length === 0 && (
        <Card tone="warn"><Body bold>Waiting for the Host to assign you a role.</Body>
          <Muted>You asked for DM. The Host approves DM access from their Host screen.</Muted></Card>
      )}

      <Section title="Open">
        {dests.map(d => (
          <Btn key={d} label={`Open ${DESTINATION_LABEL[d]} View`} onPress={() => router.push(DESTINATION_PATH[d])} testID={`live-open-${d}`} />
        ))}
        <Btn label="DM preparation (offline)" kind="ghost" onPress={() => (onOpenPrepare ? onOpenPrepare() : router.push('/live/prepare'))} testID="live-open-prepare" />
      </Section>

      {rt.status === 'disconnected' && rt.mode === 'joined' && (
        <Btn label="Reconnect" kind="ghost" onPress={() => { void getSessionRuntime().reconnect(); }} testID="live-reconnect" />
      )}
      <View style={{ marginTop: 5 }}>
        <Btn label={isHost ? 'End session' : 'Leave session'} kind="danger" onPress={() => { void endOrLeave(); }} testID="live-leave" />
      </View>
    </>
  );
}
