// ============================================================================
// FILE: src/session/loopbackTransport.ts
// In-process transport joining a device's OWN participant to its own Host core.
// Production code (the Host phone talking to itself); frames still cross as
// JSON strings, delivered asynchronously like a real socket.
// ============================================================================
import { ClientTransport, Connection, ServerTransport } from './transport';

class LoopConn implements Connection {
  peer: LoopConn | null = null;
  private frameCb: ((f: string) => void) | null = null;
  private closeCb: (() => void) | null = null;
  closed = false;
  constructor(readonly id: string) {}
  send(frame: string): void {
    if (this.closed) return;
    const to = this.peer;
    if (to) void Promise.resolve().then(() => { if (!to.closed) to.frameCb?.(frame); });
  }
  onFrame(cb: (f: string) => void): void { this.frameCb = cb; }
  onClose(cb: () => void): void { this.closeCb = cb; }
  close(): void {
    if (this.closed) return;
    this.closed = true;
    const other = this.peer;
    this.closeCb?.();
    void Promise.resolve().then(() => {
      if (other && !other.closed) { other.closed = true; other.closeCb?.(); }
    });
  }
}

export class LoopbackNetwork {
  private acceptor: ((c: Connection) => void) | null = null;
  private n = 0;

  server(): ServerTransport {
    return {
      listen: (onConnection) => { this.acceptor = onConnection; return Promise.resolve(); },
      close: () => { this.acceptor = null; },
    };
  }

  client(): ClientTransport {
    return {
      connect: () => {
        if (!this.acceptor) return Promise.reject(new Error('host not running'));
        const id = ++this.n;
        const c = new LoopConn(`loop-c${id}`);
        const s = new LoopConn(`loop-s${id}`);
        c.peer = s; s.peer = c;
        this.acceptor(s);
        return Promise.resolve(c);
      },
    };
  }
}
