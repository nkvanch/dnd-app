---
tags: [grimoire, component]
type: "Component"
source: "src/components/AsiFeatPicker.tsx"
---

# AsiFeatPicker

> **Component**  ·  `src/components/AsiFeatPicker.tsx`

The level-up picker for ASI levels. Lets the player choose between:
  +2 to one ability, +1 to two abilities, or a feat.

Enforces the asiMode house rule:
  asi_or_feat (book) — both tabs shown.
  asi_only / feat_only — the other tab hidden.
  both — player picks an ASI first, then is required to also pick a feat.

The "both" flow stashes the ASI-applied entity in bothEntity state, switches
to the feat tab, then applies the feat on top before calling onResolved.

---

## Functions

### `AsiFeatPicker(`

Level-up choice picker. Renders +2, +1+1, and/or Feat tabs based on asiMode rule. "both" mode: apply ASI → stash in bothEntity state → switch to feat tab → apply feat on top of bothEntity → onResolved(combined). featOnly prop (for ad-hoc feats from the sheet) always forces the feat tab.

---

## Imports

- [[src__content__feats__index|feats]]  ·  `src/content/feats/index.ts`
- [[src__engine__featPrereq|featPrereq]]  ·  `src/engine/featPrereq.ts`
- [[src__engine__houseRules|houseRules]]  ·  `src/engine/houseRules.ts`
- [[src__engine__leveling|leveling]]  ·  `src/engine/leveling.ts`
- [[src__engine__pipeline|pipeline]]  ·  `src/engine/pipeline.ts`
- [[src__engine__types|types]]  ·  `src/engine/types.ts`
- [[src__store__homebrewStore|homebrewStore]]  ·  `src/store/homebrewStore.ts`
- [[src__theme|theme]]  ·  `src/theme.ts`

## Used by

- [[app__creation__feats|feats]]  ·  `app/creation/feats.tsx`
- [[app__creation__level-up|level-up]]  ·  `app/creation/level-up.tsx`
- [[src__components__sheet__TabCharacter|TabCharacter]]  ·  `src/components/sheet/TabCharacter.tsx`
- [[src__components__sheet__TabExploration|TabExploration]]  ·  `src/components/sheet/TabExploration.tsx`
- [[src__components__sheet__TabFeatures|TabFeatures]]  ·  `src/components/sheet/TabFeatures.tsx`
