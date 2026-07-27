---
tags: [grimoire, screen-creation]
type: "Screen · Creation"
source: "app/creation/hub.tsx"
---

# hub

> **Screen · Creation**  ·  `app/creation/hub.tsx`

Creation flow overview. Lists all creation steps (Race / Class / Scores /
Background / Skills / Equipment / Spells) with ✓ / pending status. A step's done
function inspects the draft entity to determine completion. Shows a Review button
once all required steps are done.

---

## Functions

### `HubScreen()`

---

## Imports

- [[src__engine__houseRules|houseRules]]  ·  `src/engine/houseRules.ts`
- [[src__engine__types|types]]  ·  `src/engine/types.ts`
- [[src__store__characterStore|characterStore]]  ·  `src/store/characterStore.ts`
- [[src__theme|theme]]  ·  `src/theme.ts`
