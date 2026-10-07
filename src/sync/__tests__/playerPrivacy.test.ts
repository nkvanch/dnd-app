// What the DM's server transmits to a player. The DM's private campaign notes must never reach a player's socket: not in the full
// snapshot a player gets on joining or reconnecting, not in the broadcast when the DM edits the campaign, and not in a later patch.
jest.mock('react-native-tcp-socket', () => ({ __esModule: true, default: { createServer: jest.fn() } }));
import { SyncServer } from '../server';
import { redactForPlayers, parseBuffer, SyncMessage } from '../protocol';
import { Campaign } from '../../engine/types';
import { DEFAULT_RULES } from '../../store/characterStore';

const campaign: Campaign = {
  id: 'c1', name: 'The Long Night', dmDeviceId: 'dm', joinCode: 'ABC1234', rules: { ...DEFAULT_RULES }, playerIds: [], characterIds: [],
  notes: 'SECRET: the innkeeper is the lich', createdAt: 0,
  quests: [{ id: 'q1', name: 'Find the key', description: 'It is in the cellar', status: 'active' }],
  sessionLog: [{ id: 's1', summary: 'The party met at the inn', date: 1 }],
};

function serverWithPlayers(): { server: SyncServer; wire: Record<string, string[]> } {
  const server = new SyncServer('c1', 'session', {} as never);
  const wire: Record<string, string[]> = { alice: [], bob: [] };
  const clients = (server as unknown as { clients: Map<string, unknown> }).clients;
  for (const id of Object.keys(wire)) clients.set(id, { socket: { write: (s: string) => { wire[id].push(s); }, destroy: () => {} } });
  return { server, wire };
}
const received = (lines: string[]): SyncMessage[] => parseBuffer(lines.join('')).messages;
const everything = (lines: string[]) => lines.join('');

describe('the DM campaign notes stay on the DM device', () => {
  it('a full campaign snapshot to every player has the shared parts and no notes', () => {
    const { server, wire } = serverWithPlayers();
    server.broadcastCampaign(campaign);
    for (const id of Object.keys(wire)) {
      const [msg] = received(wire[id]);
      expect(msg.type).toBe('campaign_snapshot');
      const c = (msg as { campaign: Campaign }).campaign;
      expect(c.notes).toBe('');
      expect(c.name).toBe('The Long Night');
      expect(c.quests).toHaveLength(1);
      expect(c.sessionLog).toHaveLength(1);
      expect(everything(wire[id])).not.toContain('lich');
    }
  });

  it('the snapshot sent to one player who joins or reconnects has no notes either', () => {
    const { server, wire } = serverWithPlayers();
    server.sendTo('alice', { type: 'campaign_snapshot', campaign });
    expect(everything(wire.alice)).not.toContain('lich');
    expect(everything(wire.bob)).toBe('');
  });

  it('a patch that edits the notes is dropped, and a patch that edits something shared is kept', () => {
    const { server, wire } = serverWithPlayers();
    server.broadcastCampaignPatch('c1', { notes: 'SECRET: the key is a lie' });
    server.broadcastCampaignPatch('c1', { name: 'The Longer Night', notes: 'SECRET again' });
    const msgs = received(wire.alice) as { type: string; patch: Record<string, unknown> }[];
    expect(everything(wire.alice)).not.toContain('SECRET');
    expect(msgs[0].patch).toEqual({});
    expect(msgs[1].patch).toEqual({ name: 'The Longer Night' });
  });

  it('redactForPlayers leaves every other message untouched', () => {
    const turn: SyncMessage = { type: 'combat_turn_state', active: true, round: 2, currentEntityId: 'e1', currentName: 'Goblin' };
    expect(redactForPlayers(turn)).toBe(turn);
    expect(redactForPlayers({ type: 'ping' })).toEqual({ type: 'ping' });
  });
});
