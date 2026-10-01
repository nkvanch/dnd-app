// Room-info query ("peek") used by the Join Session confirmation screen — connects, asks, gets
// an answer, disconnects, WITHOUT ever registering a participant on the Host. See types.ts's
// 'peek'/'peek_result', host.ts's onPeek, and roomPeek.ts.
import { newRig, addDm, addPlayer, seedPrep } from '../testing/harness';
import { peekRoom } from '../roomPeek';
import { ClientTransport } from '../transport';

describe('peekRoom', () => {
  it('answers with Host identity, no campaign, zero other participants, and auto-first = no approval needed', async () => {
    const rig = await newRig({ dmPolicy: 'auto-first' });
    const result = await Promise.all([peekRoom(rig.net.client('peeker')), rig.settle()]).then(([r]) => r);
    expect(result).toEqual({
      sessionId: 'sess1', hostNickname: 'Host', roomName: null, campaign: null,
      participantCount: 1, maxParticipants: null, dmApprovalRequired: false, ended: false,
    });
  });

  it('reflects a linked campaign, every connected participant, and manual policy = approval required', async () => {
    const rig = await newRig({ dmPolicy: 'manual' });
    const dm = await addDm(rig);
    rig.hostPeer.assignCapabilities('dm1', ['dm']);
    await rig.settle();
    await seedPrep(dm);
    await dm.peer.selectCampaign('camp-auto');
    await addPlayer(rig, 'alice');
    await rig.settle();

    const result = await Promise.all([peekRoom(rig.net.client('peeker')), rig.settle()]).then(([r]) => r);
    expect(result.campaign?.name).toBe('Automation Campaign');
    expect(result.participantCount).toBe(3);          // host + dm + alice
    expect(result.dmApprovalRequired).toBe(true);
  });

  it('never registers a participant on the Host — the Host\'s roster is unchanged by a peek', async () => {
    const rig = await newRig();
    const before = Object.keys(rig.host.debugState().participants).sort();
    await Promise.all([peekRoom(rig.net.client('peeker')), rig.settle()]);
    const after = Object.keys(rig.host.debugState().participants).sort();
    expect(after).toEqual(before);
  });

  it('a Player cannot forge a privileged reply by peeking — peek_result carries no capability/token', async () => {
    const rig = await newRig();
    const result = await Promise.all([peekRoom(rig.net.client('peeker')), rig.settle()]).then(([r]) => r);
    expect(result).not.toHaveProperty('token');
    expect(result).not.toHaveProperty('capabilities');
  });

  it('reports ended: true once the Host has ended the session', async () => {
    const rig = await newRig();
    rig.hostPeer.endSession();
    await rig.settle();
    const result = await Promise.all([peekRoom(rig.net.client('peeker')), rig.settle()]).then(([r]) => r);
    expect(result.ended).toBe(true);
  });

  it('rejects when the transport itself fails to connect (e.g. room no longer reachable)', async () => {
    const failing: ClientTransport = { connect: () => Promise.reject(new Error('connection refused')) };
    await expect(peekRoom(failing)).rejects.toThrow('connection refused');
  });

  it('rejects if the connection is severed before the room\'s reply arrives', async () => {
    const rig = await newRig();
    // Drop the reply in flight, then sever the link entirely — exercises the real async
    // onClose path (unlike closing synchronously inside connect(), before peekRoom has even
    // registered its onClose handler, which isn't a real-world ordering).
    rig.net.dropNext('peeker', 's2c', f => (JSON.parse(f) as { type: string }).type === 'peek_result');
    const pending = peekRoom(rig.net.client('peeker'));
    await rig.settle();
    rig.net.disconnect('peeker');
    await expect(pending).rejects.toThrow('Connection closed before the room responded.');
  });
});
