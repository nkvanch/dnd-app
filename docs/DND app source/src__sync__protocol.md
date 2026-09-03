---
tags: [grimoire, sync]
type: "Sync"
source: "src/sync/protocol.ts"
---

# protocol

> **Sync**  ·  `src/sync/protocol.ts`

## Types

### `ConnectedPlayer`

── Connected player roster entry ──────────────────────────────────────────────

 A player currently connected to the DM's session.

### `SyncMessage`

── Message union type ────────────────────────────────────────────────────────

## Functions

### `encodeMessage(msg: SyncMessage): string`

── Framing helpers ───────────────────────────────────────────────────────────

 Serialise a message to a newline-terminated JSON string ready for TCP send.

### `parseBuffer(buffer: string):`

Parse a raw TCP data buffer into complete messages.
Returns:
  messages  — zero or more fully-received messages (in order)
  remainder — any trailing bytes that did not form a complete line yet;
              the caller must prepend this to the next received chunk.

---

## Imports

- [[src__engine__types|types]]  ·  `src/engine/types.ts`

## Used by

- [[src__sync__client|client]]  ·  `src/sync/client.ts`
- [[src__sync__server|server]]  ·  `src/sync/server.ts`
- [[src__sync__syncManager|syncManager]]  ·  `src/sync/syncManager.ts`
