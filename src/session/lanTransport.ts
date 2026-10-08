// ============================================================================
// FILE: src/session/lanTransport.ts
// Production LAN transport for the session layer, on react-native-tcp-socket
// (same native module as the legacy campaign sync). Separate port from the
// legacy server so a device can keep using either.
// ============================================================================
import TcpSocket from 'react-native-tcp-socket';
import { NativeModules } from 'react-native';
import type Socket from 'react-native-tcp-socket/lib/types/Socket';
import type Server from 'react-native-tcp-socket/lib/types/Server';
import { ClientTransport, Connection, ServerTransport } from './transport';
import { SocketConnection } from './socketConnection';

/** Legacy campaign sync uses 7742. */
export const SESSION_PORT = 7743;

function nativeReady(): boolean {
  return !!NativeModules.TcpSockets;
}

const NO_NATIVE = 'The networking module isn’t available in this build.';

export class LanServerTransport implements ServerTransport {
  private server: Server | null = null;
  constructor(private readonly port: number = SESSION_PORT) {}

  listen(onConnection: (conn: Connection) => void): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!nativeReady()) { reject(new Error(NO_NATIVE)); return; }
      const server = TcpSocket.createServer((socket: Socket) => {
        onConnection(new SocketConnection(socket));
      });
      if (!server) { reject(new Error('Could not start the session server (network module not ready).')); return; }
      this.server = server;
      server.on('error', (err: Error) => reject(err));
      server.listen({ port: this.port, host: '0.0.0.0' }, () => resolve());
    });
  }

  close(): void {
    try { this.server?.close(); } catch { /* ignore */ }
    this.server = null;
  }
}

export class LanClientTransport implements ClientTransport {
  constructor(private readonly host: string, private readonly port: number = SESSION_PORT) {}

  connect(): Promise<Connection> {
    return new Promise((resolve, reject) => {
      if (!nativeReady()) { reject(new Error(NO_NATIVE)); return; }
      let settled = false;
      const socket = TcpSocket.createConnection({ host: this.host, port: this.port }, () => {
        settled = true;
        resolve(new SocketConnection(socket));
      });
      if (!socket) { reject(new Error('Network module not ready yet.')); return; }
      socket.on('error', (err: Error) => {
        if (!settled) { settled = true; reject(err); }
      });
    });
  }
}

/** Accepts "192.168.1.20" or "192.168.1.20:7743". */
export function parseAddress(text: string, defaultPort: number = SESSION_PORT): { host: string; port: number } | null {
  const m = /^\s*([0-9]{1,3}(?:\.[0-9]{1,3}){3})(?::([0-9]{2,5}))?\s*$/.exec(text);
  if (!m) return null;
  const port = m[2] ? Number(m[2]) : defaultPort;
  if (port < 1 || port > 65535) return null;
  return { host: m[1], port };
}
