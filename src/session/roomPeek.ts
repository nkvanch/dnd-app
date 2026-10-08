// ============================================================================
// FILE: src/session/roomPeek.ts
// One-shot "peek" a room before joining it — connect, ask, get an answer,
// disconnect. Deliberately NOT built on SessionPeer: a peek has no identity,
// no persisted state, no retry/backoff, and must never register a
// participant on the Host — see ClientMessage's 'peek' variant and
// host.ts's onPeek for the server side.
// ============================================================================
import { ClientTransport, Connection, decodeFrame, encodeFrame } from './transport';
import { ClientMessage, PeekResult, ServerMessage } from './types';

export function peekRoom(transport: ClientTransport, timeoutMs = 6000): Promise<PeekResult> {
  return new Promise((resolve, reject) => {
    let settled = false;
    let conn: Connection | null = null;

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      conn?.close();
      reject(new Error('Timed out waiting for the room to respond.'));
    }, timeoutMs);

    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      conn?.close();
      fn();
    };

    transport.connect().then(c => {
      conn = c;
      c.onFrame(frame => {
        const msg = decodeFrame<ServerMessage>(frame);
        if (!msg) return;
        if (msg.type === 'peek_result') {
          const { type, ...result } = msg;
          finish(() => resolve(result));
        } else if (msg.type === 'error') {
          finish(() => reject(new Error(msg.message)));
        }
      });
      c.onClose(() => finish(() => reject(new Error('Connection closed before the room responded.'))));
      const peek: ClientMessage = { type: 'peek' };
      c.send(encodeFrame(peek));
    }).catch(e => finish(() => reject(e instanceof Error ? e : new Error(String(e)))));
  });
}
