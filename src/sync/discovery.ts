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
 * Room-code alphabet: 32 characters, deliberately excluding the pairs people
 * misread across a table — no 0/O, no 1/I/L. Encoding a 32-bit IPv4 address
 * needs 7 of these (32^7 covers the full 32-bit range with room to spare).
 */
export const ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/**
 * Encodes an IPv4 address as a 7-character room code in `ROOM_CODE_ALPHABET`.
 *
 * Example: '192.168.1.42' → 'K7M4XQP'
 */
export function encodeRoomCode(ip: string): string {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some(p => isNaN(p) || p < 0 || p > 255)) {
    throw new Error(`Invalid IP address: "${ip}"`);
  }
  // Build a 32-bit unsigned integer from the four octets, then base-32 it by hand
  // (the alphabet isn't the standard digit set, so Number.toString(36) etc. don't apply).
  let n = ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
  let out = '';
  for (let i = 0; i < 7; i++) {
    out = ROOM_CODE_ALPHABET[n % 32] + out;
    n = Math.floor(n / 32);
  }
  return out;
}

/**
 * Decodes a 7-character room code back to an IPv4 address and a port.
 * The code only ever encodes the IP (see `encodeRoomCode`); the port is
 * supplied by the caller since the same code shape is shared by the legacy
 * campaign sync (port 7742) and the newer session layer (port 7743) — pass
 * `SESSION_PORT` explicitly when decoding for the live-session join flow.
 * Throws if the code format is invalid.
 *
 * Example: decodeRoomCode('K7M4XQP') → { ip: '192.168.1.42', port: 7742 }
 */
export function decodeRoomCode(code: string, port: number = SYNC_PORT): { ip: string; port: number } {
  const clean = code.trim().toUpperCase();
  if (clean.length !== 7 || [...clean].some(c => !ROOM_CODE_ALPHABET.includes(c))) {
    throw new Error(
      `Invalid room code: "${code}". Must be exactly 7 characters from ${ROOM_CODE_ALPHABET} (no 0/O, 1/I/L).`
    );
  }
  let n = 0;
  for (const ch of clean) n = n * 32 + ROOM_CODE_ALPHABET.indexOf(ch);
  n = n >>> 0;
  const ip = [
    (n >>> 24) & 0xff,
    (n >>> 16) & 0xff,
    (n >>>  8) & 0xff,
     n         & 0xff,
  ].join('.');
  return { ip, port };
}
