---
tags: [grimoire, sync]
type: "Sync"
source: "src/sync/discovery.ts"
---

# discovery

> **Sync**  ·  `src/sync/discovery.ts`

## Functions

### `decodeRoomCode(code: string):`

Decodes a 6-character room code back to an IPv4 address and the sync port.
Throws if the code format is invalid.
Example: 'G5K2M1' → { ip: '192.168.1.42', port: 7742 }

### `encodeRoomCode(ip: string): string`

Encodes an IPv4 address as a 6-character uppercase alphanumeric room code.
The 4 octets are treated as a 32-bit unsigned integer, encoded in base-36.
Example: '192.168.1.42' → 'G5K2M1'

### `getLocalIp(): Promise<string | null>`

Returns the device's local IPv4 address on the current WiFi network.
Returns null if not on WiFi or if the platform is web.

## Constants

### `SYNC_PORT`

---

## Used by

- [[app__tabs__campaigns|campaigns]]  ·  `app/(tabs)/campaigns.tsx`
- [[src__sync__server|server]]  ·  `src/sync/server.ts`
- [[src__sync__syncManager|syncManager]]  ·  `src/sync/syncManager.ts`
