---
tags: [grimoire, screen-creation]
type: "Screen · Creation"
source: "app/creation/skills.tsx"
---

# skills

> **Screen · Creation**  ·  `app/creation/skills.tsx`

Skill proficiency selection for class skill choices. Handles background overlap
in two modes set by the skillOverlapMode house rule:

  replacement — opens extra untrained skills so you always reach the full count.
  warn        — stays on the class list; shows an inline confirmation box when
                you'll lose picks (no Alert.alert — shown on-screen instead).

Has a ← Back button and a Case 2 (re-entering after resolved) path with a
Change Skills option.

---

## Functions

### `SkillsScreen()`

---

## Imports

- [[src__engine__houseRules|houseRules]]  ·  `src/engine/houseRules.ts`
- [[src__engine__leveling|leveling]]  ·  `src/engine/leveling.ts`
- [[src__engine__types|types]]  ·  `src/engine/types.ts`
- [[src__store__characterStore|characterStore]]  ·  `src/store/characterStore.ts`
- [[src__theme|theme]]  ·  `src/theme.ts`
