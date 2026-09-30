// ============================================================================
// FILE: src/session/transport.ts
// The transport boundary. Everything above this line (host core, peers) speaks
// JSON strings through these interfaces, so the SAME production code runs over
// LAN TCP, Node sockets (Android E2E harness) and the in-memory test network.
// ============================================================================

export interface Connection {
  readonly id: string;
  send(frame: string): void;
  onFrame(cb: (frame: string) => void): void;
  onClose(cb: () => void): void;
  close(): void;
}

export interface ServerTransport {
  /** Starts accepting connections. */
  listen(onConnection: (conn: Connection) => void): Promise<void>;
  close(): void;
}

export interface ClientTransport {
  connect(): Promise<Connection>;
}

// ── Framing (same newline-delimited JSON as src/sync/protocol.ts) ────────────

export function encodeFrame(msg: unknown): string {
  return JSON.stringify(msg);
}

export function decodeFrame<T>(frame: string): T | null {
  try {
    return JSON.parse(frame) as T;
  } catch {
    return null;
  }
}

/** Splits a TCP byte stream on newlines into complete frames plus a remainder. */
export function splitFrames(buffer: string): { frames: string[]; remainder: string } {
  const parts = buffer.split('\n');
  const remainder = parts.pop() ?? '';
  return { frames: parts.map(p => p.trim()).filter(Boolean), remainder };
}
