// ============================================================================
// FILE: src/session/memoryTransport.ts
// TEST-ONLY deterministic in-memory network with explicit fault injection.
// No timers, no randomness: frames move only when the test pumps the network.
// Every message crosses as a JSON string, exactly like the LAN transport.
// ============================================================================
import { ClientTransport, Connection, ServerTransport } from './transport';

type Dir = 'c2s' | 's2c';

type Rule = {
  label:  string;
  dir:    Dir;
  match:  (frame: string) => boolean;
  action: 'drop' | 'duplicate' | 'delay';
  remaining: number;
};

class MemConn implements Connection {
  private frameCb: ((f: string) => void) | null = null;
  private closeCb: (() => void) | null = null;
  closed = false;
  peer: MemConn | null = null;
  constructor(
    readonly id: string,
    readonly label: string,
    readonly side: 'client' | 'server',
    private readonly net: InMemoryNetwork,
  ) {}
  send(frame: string): void {
    if (this.closed) return;
    this.net.enqueue(this, frame);
  }
  onFrame(cb: (frame: string) => void): void { this.frameCb = cb; }
  onClose(cb: () => void): void { this.closeCb = cb; }
  /** Graceful close: frames already sent by this side are still delivered before the peer sees the close. */
  close(): void { this.net.closeGraceful(this); }
  deliver(frame: string): void {
    if (!this.closed) this.frameCb?.(frame);
  }
  fireClose(): void {
    if (this.closed) return;
    this.closed = true;
    this.closeCb?.();
  }
  notifyClosed(): void { this.closeCb?.(); }
}

type Queued = { to: MemConn; frame: string | null };   // null = graceful close marker

export class InMemoryNetwork {
  private queue: Queued[] = [];
  private delayed: Queued[] = [];
  private rules: Rule[] = [];
  private acceptor: ((c: Connection) => void) | null = null;
  private counter = 0;
  private conns = new Map<string, MemConn>();       // label -> current client conn
  /** Every frame delivered, kept for leakage inspection in tests. */
  readonly log: { label: string; dir: Dir; frame: string }[] = [];
  serverListening = true;

  // ── Server / client factories ──────────────────────────────────────────────

  server(): ServerTransport {
    return {
      listen: (onConnection) => {
        this.acceptor = onConnection;
        this.serverListening = true;
        return Promise.resolve();
      },
      close: () => {
        this.serverListening = false;
        this.acceptor = null;
        for (const c of [...this.conns.values()]) this.closePair(c);
      },
    };
  }

  client(label: string): ClientTransport {
    return {
      connect: () => {
        if (!this.serverListening || !this.acceptor) return Promise.reject(new Error('connection refused'));
        const n = ++this.counter;
        const c = new MemConn(`c${n}`, label, 'client', this);
        const s = new MemConn(`s${n}`, label, 'server', this);
        c.peer = s; s.peer = c;
        this.conns.set(label, c);
        this.acceptor(s);
        return Promise.resolve(c);
      },
    };
  }

  // ── Delivery ───────────────────────────────────────────────────────────────

  enqueue(from: MemConn, frame: string): void {
    const to = from.peer;
    if (!to) return;
    const dir: Dir = from.side === 'client' ? 'c2s' : 's2c';
    const rule = this.rules.find(r => r.remaining > 0 && r.label === from.label && r.dir === dir && r.match(frame));
    if (rule) {
      rule.remaining -= 1;
      if (rule.action === 'drop') return;
      if (rule.action === 'delay') { this.delayed.push({ to, frame }); return; }
      this.queue.push({ to, frame }, { to, frame });
      return;
    }
    this.queue.push({ to, frame });
  }

  /** Delivers one queued frame. Returns false when nothing is queued. */
  step(): boolean {
    const q = this.queue.shift();
    if (!q) return false;
    if (q.frame === null) {
      q.to.peer?.fireClose();
      q.to.fireClose();
      return true;
    }
    if (!q.to.closed) {
      this.log.push({ label: q.to.label, dir: q.to.side === 'client' ? 's2c' : 'c2s', frame: q.frame });
      q.to.deliver(q.frame);
    }
    return true;
  }

  /** Delivers everything, including messages produced while delivering. */
  async settle(maxSteps = 10_000): Promise<void> {
    for (let i = 0; i < maxSteps; i++) {
      await Promise.resolve();
      if (!this.step()) {
        await Promise.resolve();
        if (this.queue.length === 0) return;
      }
    }
    throw new Error('InMemoryNetwork.settle: exceeded maxSteps (message storm?)');
  }

  get pending(): number { return this.queue.length; }

  // ── Fault injection (deterministic) ────────────────────────────────────────

  /** Drops the next `n` frames matching `match` in the given direction. */
  dropNext(label: string, dir: Dir, match: (frame: string) => boolean = () => true, n = 1): void {
    this.rules.push({ label, dir, match, action: 'drop', remaining: n });
  }
  duplicateNext(label: string, dir: Dir, match: (frame: string) => boolean = () => true, n = 1): void {
    this.rules.push({ label, dir, match, action: 'duplicate', remaining: n });
  }
  /** Holds matching frames back until releaseDelayed() (this is how out-of-order is produced). */
  delayNext(label: string, dir: Dir, match: (frame: string) => boolean = () => true, n = 1): void {
    this.rules.push({ label, dir, match, action: 'delay', remaining: n });
  }
  releaseDelayed(): void {
    this.queue.push(...this.delayed);
    this.delayed = [];
  }

  /** Abruptly severs a participant's link (both ends see a close). */
  disconnect(label: string): void {
    const c = this.conns.get(label);
    if (c) this.closePair(c);
  }

  closeGraceful(c: MemConn): void {
    if (c.closed) return;
    const other = c.peer;
    c.closed = true;                 // this side can send no more
    if (other && !other.closed) this.queue.push({ to: other, frame: null });
    for (const [label, cc] of this.conns) if (cc === c || cc === other) this.conns.delete(label);
    // Tell the local owner immediately (its socket is gone), after marking closed.
    c.notifyClosed();
  }

  closePair(c: MemConn): void {
    const other = c.peer;
    // Drop frames still in flight to either end: a dead link delivers nothing.
    this.queue = this.queue.filter(q => q.to !== c && q.to !== other);
    this.delayed = this.delayed.filter(q => q.to !== c && q.to !== other);
    c.fireClose();
    other?.fireClose();
    for (const [label, cc] of this.conns) if (cc === c || cc === other) this.conns.delete(label);
  }

  /** Re-injects an arbitrary raw frame as if `label`'s current client connection sent it (replay attacks / stale duplicates). */
  inject(label: string, frame: string): void {
    const c = this.conns.get(label);
    if (c) this.enqueue(c, frame);
  }

  isConnected(label: string): boolean {
    const c = this.conns.get(label);
    return !!c && !c.closed;
  }

  /** All frames ever delivered to `label` as raw text (for secret-leak assertions). */
  receivedBy(label: string): string[] {
    return this.log.filter(l => l.label === label && l.dir === 's2c').map(l => l.frame);
  }
}
