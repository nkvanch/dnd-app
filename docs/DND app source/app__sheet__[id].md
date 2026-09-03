---
tags: [grimoire, screen-sheet]
type: "Screen · Sheet"
source: "app/sheet/[id].tsx"
---

# [id]

> **Screen · Sheet**  ·  `app/sheet/[id].tsx`

Root of the character sheet. Loads the entity by id, subscribes to Zustand for
live updates, and renders a tab bar (Character / Abilities / Inventory / Spells).

Tab 1 has a [⚔️ Combat | 🧭 Exploration] segmented toggle at the top that swaps
TabCharacter ↔ TabExploration. The rest bar at the bottom shows configured rest
lengths and triggers takeRest() from rest.ts.

---

## Functions

### `CharacterSheetScreen()`

---

## Imports

- [[src__components__GlobalDiceRoller|GlobalDiceRoller]]  ·  `src/components/GlobalDiceRoller.tsx`
- [[src__components__SafeBottomView|SafeBottomView]]  ·  `src/components/SafeBottomView.tsx`
- [[src__components__sheet__FreeEditModal|FreeEditModal]]  ·  `src/components/sheet/FreeEditModal.tsx`
- [[src__components__sheet__TabAbilities|TabAbilities]]  ·  `src/components/sheet/TabAbilities.tsx`
- [[src__components__sheet__TabActions|TabActions]]  ·  `src/components/sheet/TabActions.tsx`
- [[src__components__sheet__TabCharacter|TabCharacter]]  ·  `src/components/sheet/TabCharacter.tsx`
- [[src__components__sheet__TabExploration|TabExploration]]  ·  `src/components/sheet/TabExploration.tsx`
- [[src__components__sheet__TabFeatures|TabFeatures]]  ·  `src/components/sheet/TabFeatures.tsx`
- [[src__components__sheet__TabInventory|TabInventory]]  ·  `src/components/sheet/TabInventory.tsx`
- [[src__components__sheet__TabNotes|TabNotes]]  ·  `src/components/sheet/TabNotes.tsx`
- [[src__components__sheet__TabSpells|TabSpells]]  ·  `src/components/sheet/TabSpells.tsx`
- [[src__components__SyncStatusDot|SyncStatusDot]]  ·  `src/components/SyncStatusDot.tsx`
- [[src__content__conditions__index|conditions]]  ·  `src/content/conditions/index.ts`
- [[src__content__items__index|items]]  ·  `src/content/items/index.ts`
- [[src__engine__combat|combat]]  ·  `src/engine/combat.ts`
- [[src__engine__conditions|conditions]]  ·  `src/engine/conditions.ts`
- [[src__engine__dmOverride|dmOverride]]  ·  `src/engine/dmOverride.ts`
- [[src__engine__houseRules|houseRules]]  ·  `src/engine/houseRules.ts`
- [[src__engine__pipeline|pipeline]]  ·  `src/engine/pipeline.ts`
- [[src__engine__rest|rest]]  ·  `src/engine/rest.ts`
- [[src__engine__types|types]]  ·  `src/engine/types.ts`
- [[src__store__campaignStore|campaignStore]]  ·  `src/store/campaignStore.ts`
- [[src__store__characterStore|characterStore]]  ·  `src/store/characterStore.ts`
- [[src__store__sessionStore|sessionStore]]  ·  `src/store/sessionStore.ts`
- [[src__theme|theme]]  ·  `src/theme.ts`
