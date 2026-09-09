// ============================================================================
// FILE: src/sync/discovery.ts
// Room-code encode/decode and local IP discovery.
//
// Room code: 7 uppercase alphanumeric chars (base-36) encoding the device's
// 32-bit IPv4 address. Decode reverses to IP + fixed port 7742.
//
// Why 7 and not 6: 6 base-36 digits can only hold values up to 36^6-1 =
// 2,176,782,335. A full 32-bit IPv4 address goes up to 4,294,967,295 — and
// critically, ANY 192.168.x.x address (the most common home router default)
// already exceeds the 6-digit ceiling on its first octet alone. 7 digits
// (36^7 = 78,364,164,096) comfortably covers the entire 32-bit range.
//
// IP lookup uses expo-network's getIpAddressAsync(), which reads the device's
// network interface directly (no WifiManager call) and does NOT require the
// location permission that react-native-network-info needed on Android 10+.
// ============================================================================
import * as Network from 'expo-network';
import { Platform } from 'react-native';
import type { EventSubscription } from 'expo-modules-core';

export const SYNC_PORT = 7742;

/**
 * Returns the device's local IPv4 address on the current network.
 * Returns null if the platform is web or no address is available (e.g. no
 * active network connection).
 */
export async function getLocalIp(): Promise<string | null> {
  if (Platform.OS === 'web') return null;

  try {
    const ip = await Network.getIpAddressAsync();
    if (!ip || ip === '0.0.0.0') {
      console.warn('[discovery] getIpAddressAsync() returned empty/0.0.0.0 — no active network connection.');
      return null;
    }
    return ip;
  } catch (e) {
    console.warn('[discovery] getIpAddressAsync() threw:', e);
    return null;
  }
}

/**
 * Fires `onChange` whenever the device's network connectivity state changes
 * (WiFi/hotspot/cellular connects, disconnects, or switches) — a cheap
 * event-driven trigger, not a truth source itself. The caller re-checks
 * getLocalIp() in response, since `isConnected`/`isInternetReachable` on the
 * event can be true on a network with no usable LAN (e.g. cellular data) —
 * getLocalIp() already correctly rejects that case (0.0.0.0/empty).
 *
 * Used to pick up a WiFi/hotspot connection appearing or disappearing WHILE
 * a campaign is already being hosted, so the room code can regenerate (or
 * clear) without tearing down and restarting the TCP server itself — see
 * syncManager.ts's startNetworkWatch().
 *
 * No-op subscription on web (matches getLocalIp's own web short-circuit).
 * Also falls back to a no-op subscription if the underlying native call
 * throws or doesn't return a real subscription object (e.g. an
 * unlinked/auto-mocked native module) — this is a convenience watcher on
 * top of getLocalIp(), never something hosting itself should depend on to
 * function; degrading to "no live updates" is always safe.
 */
export function watchNetworkChanges(onChange: () => void): EventSubscription {
  const noop: EventSubscription = { remove: () => { /* nothing was subscribed */ } };
  if (Platform.OS === 'web') return noop;

  try {
    const sub = Network.addNetworkStateListener(() => onChange());
    return sub && typeof sub.remove === 'function' ? sub : noop;
  } catch (e) {
    console.warn('[discovery] addNetworkStateListener() threw:', e);
    return noop;
  }
}

/**
 * Encodes an IPv4 address as a 7-character uppercase alphanumeric room code.
 * The 4 octets are treated as a 32-bit unsigned integer, encoded in base-36.
 *
 * Example: '192.168.1.42' → 'BW1G039'
 */
export function encodeRoomCode(ip: string): string {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some(p => isNaN(p) || p < 0 || p > 255)) {
    throw new Error(`Invalid IP address: "${ip}"`);
  }
  // Build a 32-bit unsigned integer from the four octets
  const n = ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
  return n.toString(36).toUpperCase().padStart(7, '0');
}

/**
 * Decodes a 7-character room code back to an IPv4 address and the sync port.
 * Throws if the code format is invalid.
 *
 * Example: 'BW1G039' → { ip: '192.168.1.42', port: 7742 }
 */
export function decodeRoomCode(code: string): { ip: string; port: number } {
  const clean = code.trim().toUpperCase();
  if (!/^[0-9A-Z]{7}$/.test(clean)) {
    throw new Error(
      `Invalid room code: "${code}". Must be exactly 7 alphanumeric characters.`
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
