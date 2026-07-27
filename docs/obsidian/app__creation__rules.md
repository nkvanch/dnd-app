---
tags: [grimoire, screen-creation]
type: "Screen · Creation"
source: "app/creation/rules.tsx"
---

# rules

> **Screen · Creation**  ·  `app/creation/rules.tsx`

Campaign Settings screen. Renders all rules from the HOUSE_RULES registry using
three control types: boolean (descriptive Book / Homebrew labels), choice (option
chips), and number (stepper). Changes write to CampaignRules.customRules.

Accessible from Character Basics before creation starts and also revisitable
from the hub. Not a mandatory step in the creation flow.

---

## Functions

### `CreationRulesScreen()`

---

## Imports

- [[src__engine__houseRules|houseRules]]  ·  `src/engine/houseRules.ts`
- [[src__engine__types|types]]  ·  `src/engine/types.ts`
- [[src__store__characterStore|characterStore]]  ·  `src/store/characterStore.ts`
- [[src__theme|theme]]  ·  `src/theme.ts`
