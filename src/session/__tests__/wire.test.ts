import { SocketConnection, SocketLike } from '../socketConnection';
import { splitFrames, encodeFrame, decodeFrame } from '../transport';
import { parseAddress } from '../lanTransport';

class FakeSocket implements SocketLike {
  written: string[] = [];
  private handlers: Record<string, ((a?: never) => void)[]> = {};
  write(d: string) { this.written.push(d); return true; }
  destroy() { this.emit('close'); return undefined; }
  on(event: 'data', cb: (chunk: { toString(): string } | string) => void): this;
  on(event: 'close', cb: () => void): this;
  on(event: 'error', cb: (err: Error) => void): this;
  on(event: string, cb: (...args: never[]) => void): this { (this.handlers[event] ??= []).push(cb as (a?: never) => void); return this; }
  emit(event: string, arg?: unknown) { (this.handlers[event] ?? []).forEach(h => h(arg as never)); }
}

describe('newline framing over a byte stream', () => {
  it('reassembles frames split across arbitrary TCP chunks', () => {
    const sock = new FakeSocket();
    const conn = new SocketConnection(sock);
    const got: string[] = [];
    conn.onFrame(f => got.push(f));
    const a = encodeFrame({ type: 'event', revision: 1, note: 'héllo ✦' });
    const b = encodeFrame({ type: 'result', n: 2 });
    const stream = `${a}\n${b}\n`;
    for (let i = 0; i < stream.length; i += 7) sock.emit('data', stream.slice(i, i + 7));
    expect(got).toEqual([a, b]);
    expect(decodeFrame<{ note: string }>(got[0])!.note).toBe('héllo ✦');
  });

  it('several frames in one chunk, and a trailing partial frame is kept for the next chunk', () => {
    const { frames, remainder } = splitFrames('{"a":1}\n{"b":2}\n{"c"');
    expect(frames).toEqual(['{"a":1}', '{"b":2}']);
    expect(remainder).toBe('{"c"');
  });

  it('send appends a newline; close fires exactly once and stops further sends', () => {
    const sock = new FakeSocket();
    const conn = new SocketConnection(sock);
    let closes = 0;
    conn.onClose(() => { closes += 1; });
    conn.send('{"x":1}');
    expect(sock.written).toEqual(['{"x":1}\n']);
    sock.emit('close');
    conn.close();
    expect(closes).toBe(1);
    conn.send('{"y":2}');
    expect(sock.written).toHaveLength(1);
  });

  it('decodeFrame returns null for garbage instead of throwing', () => {
    expect(decodeFrame('not json{')).toBeNull();
  });
});

describe('join address parsing', () => {
  it('accepts ip and ip:port, rejects everything else', () => {
    expect(parseAddress('192.168.1.20')).toEqual({ host: '192.168.1.20', port: 7743 });
    expect(parseAddress(' 10.0.0.5:9000 ')).toEqual({ host: '10.0.0.5', port: 9000 });
    expect(parseAddress('127.0.0.1:7743')).toEqual({ host: '127.0.0.1', port: 7743 });
    for (const bad of ['', 'hello', '300.1.1', '1.2.3.4:0', '1.2.3.4:99999', '1.2.3.4:abc', 'a.b.c.d']) expect(parseAddress(bad)).toBeNull();
  });
});
