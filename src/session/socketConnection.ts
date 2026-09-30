// ============================================================================
// FILE: src/session/socketConnection.ts
// Adapts any newline-framed byte stream socket (react-native-tcp-socket on the
// phone, node:net in the Android E2E peers) to the session Connection interface.
// ============================================================================
import { Connection, splitFrames } from './transport';

export interface SocketLike {
  write(data: string): unknown;
  destroy(): unknown;
  on(event: 'data', cb: (chunk: { toString(): string } | string) => void): unknown;
  on(event: 'close', cb: () => void): unknown;
  on(event: 'error', cb: (err: Error) => void): unknown;
}

let connSeq = 0;

export class SocketConnection implements Connection {
  readonly id = `sock${++connSeq}`;
  private buffer = '';
  private frameCb: ((f: string) => void) | null = null;
  private closeCb: (() => void) | null = null;
  private closed = false;

  constructor(private readonly socket: SocketLike) {
    socket.on('data', (chunk) => {
      this.buffer += typeof chunk === 'string' ? chunk : chunk.toString();
      const { frames, remainder } = splitFrames(this.buffer);
      this.buffer = remainder;
      for (const f of frames) this.frameCb?.(f);
    });
    socket.on('close', () => this.fireClose());
    socket.on('error', () => { /* 'close' always follows */ });
  }

  send(frame: string): void {
    if (this.closed) return;
    try { this.socket.write(frame + '\n'); } catch { /* connection is going away */ }
  }
  onFrame(cb: (frame: string) => void): void { this.frameCb = cb; }
  onClose(cb: () => void): void { this.closeCb = cb; }
  close(): void {
    if (this.closed) return;
    try { this.socket.destroy(); } catch { /* already gone */ }
    this.fireClose();
  }
  private fireClose(): void {
    if (this.closed) return;
    this.closed = true;
    this.closeCb?.();
  }
}
