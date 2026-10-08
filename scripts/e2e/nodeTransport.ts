// Node TCP transports for the Android E2E harness. They speak the SAME session protocol and
// framing as the app's LAN transport (src/session/socketConnection.ts is shared), so a Node
// Host/DM/Player peer is a genuine remote peer of the phone, not a mock.
import net from 'node:net';
import { ClientTransport, Connection, ServerTransport } from '../../src/session/transport';
import { SocketConnection, SocketLike } from '../../src/session/socketConnection';

export class NodeServerTransport implements ServerTransport {
  private server: net.Server | null = null;
  private sockets = new Set<net.Socket>();
  constructor(private readonly port: number, private readonly host = '0.0.0.0') {}

  listen(onConnection: (conn: Connection) => void): Promise<void> {
    return new Promise((resolve, reject) => {
      const server = net.createServer(socket => {
        this.sockets.add(socket);
        socket.on('close', () => this.sockets.delete(socket));
        socket.setNoDelay(true);
        onConnection(new SocketConnection(socket as unknown as SocketLike));
      });
      server.once('error', reject);
      server.listen(this.port, this.host, () => resolve());
      this.server = server;
    });
  }

  close(): void {
    for (const s of this.sockets) s.destroy();
    this.sockets.clear();
    this.server?.close();
    this.server = null;
  }
}

export class NodeClientTransport implements ClientTransport {
  /** Every raw frame this client ever received (for secret-leak assertions on the real wire). */
  readonly received: string[] = [];
  constructor(private readonly host: string, private readonly port: number) {}

  connect(): Promise<Connection> {
    return new Promise((resolve, reject) => {
      const socket = net.connect({ host: this.host, port: this.port });
      socket.setNoDelay(true);
      socket.once('connect', () => {
        const conn = new SocketConnection(socket as unknown as SocketLike);
        const onFrame = conn.onFrame.bind(conn);
        conn.onFrame = (cb: (f: string) => void) => onFrame((f: string) => { this.received.push(f); cb(f); });
        resolve(conn);
      });
      socket.once('error', reject);
    });
  }
}

/**
 * A TCP proxy with a kill switch, used to inject real network failures between the phone and a
 * Host: sever() drops every live connection; block(true) refuses new ones until unblocked.
 */
export class FaultProxy {
  private server: net.Server | null = null;
  private pairs = new Set<[net.Socket, net.Socket]>();
  blocked = false;
  connectionsSeen = 0;
  /** Raw bytes the phone sent through the proxy (protocol log for failure evidence). */
  readonly fromPhone: string[] = [];
  readonly toPhone: string[] = [];

  constructor(private readonly listenPort: number, private readonly targetHost: string, private readonly targetPort: number) {}

  start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server = net.createServer(client => {
        this.connectionsSeen += 1;
        if (this.blocked) { client.destroy(); return; }
        const upstream = net.connect({ host: this.targetHost, port: this.targetPort });
        const pair: [net.Socket, net.Socket] = [client, upstream];
        this.pairs.add(pair);
        const drop = () => { client.destroy(); upstream.destroy(); this.pairs.delete(pair); };
        client.on('error', drop); upstream.on('error', drop);
        client.on('close', drop); upstream.on('close', drop);
        client.on('data', d => this.fromPhone.push(d.toString()));
        upstream.on('data', d => this.toPhone.push(d.toString()));
        client.pipe(upstream); upstream.pipe(client);
      });
      this.server.once('error', reject);
      this.server.listen(this.listenPort, '0.0.0.0', () => resolve());
    });
  }

  sever(): void {
    for (const [a, b] of [...this.pairs]) { a.destroy(); b.destroy(); }
    this.pairs.clear();
  }

  block(on: boolean): void {
    this.blocked = on;
    if (on) this.sever();
  }

  get liveConnections(): number { return this.pairs.size; }

  stop(): void {
    this.sever();
    this.server?.close();
    this.server = null;
  }
}
