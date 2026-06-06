// ============================================================================
// FILE: src/sync/discovery.ts
// Room-code encode/decode and local IP discovery.
//
// Room code: 6 uppercase alphanumeric chars (base-36) encoding the device's
// 32-bit IPv4 address. Decode reverses to IP + fixed port 7742.
// ============================================================================
import { NetworkInfo } from 'react-native-network-info';
import { Platform } from 'react-native';

export const SYNC_PORT = 7742;

/**
 * Returns the device's local IPv4 address on the current WiFi network.
 * Returns null if not on WiFi or if the platform is web.
 */
export async function getLocalIp(): Promise<string | null> {
  if (Platform.OS === 'web') return null;
  try {
    const ip = await NetworkInfo.getIPV4Address();
    return ip ?? null;
  } catch {
    return null;
  }
}

/**
 * Encodes an IPv4 address as a 6-character uppercase alphanumeric room code.
 * The 4 octets are treated as a 32-bit unsigned integer, encoded in base-36.
 *
 * Example: '192.168.1.42' → 'G5K2M1'
 */
export function encodeRoomCode(ip: string): string {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some(p => isNaN(p) || p < 0 || p > 255)) {
    throw new Error(`Invalid IP address: "${ip}"`);
  }
  // Build a 32-bit unsigned integer from the four octets
  const n = ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
  return n.toString(36).toUpperCase().padStart(6, '0');
}

/**
 * Decodes a 6-character room code back to an IPv4 address and the sync port.
 * Throws if the code format is invalid.
 *
 * Example: 'G5K2M1' → { ip: '192.168.1.42', port: 7742 }
 */
export function decodeRoomCode(code: string): { ip: string; port: number } {
  const clean = code.trim().toUpperCase();
  if (!/^[0-9A-Z]{6}$/.test(clean)) {
    throw new Error(
      `Invalid room code: "${code}". Must be exactly 6 alphanumeric characters.`
    );
  }
  const n  = parseInt(clean, 36);
  const ip = [
    (n >>> 24) & 0xff,
    (n >>> 16) & 0xff,
    (n >>>  8) & 0xff,
     n         & 0xff,
  ].join('.');
  return { ip, port: SYNC_PORT };
}
