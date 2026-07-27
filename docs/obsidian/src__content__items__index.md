---
tags: [grimoire, content]
type: "Content"
source: "src/content/items/index.ts"
---

# items

> **Content**  ·  `src/content/items/index.ts`

## Constants

### `ALL_ITEMS: Item[]`

### `itemArcaneOrb: Item`

### `itemArrows20: Item`

### `itemBackpack: Item`

── Adventuring Gear ──────────────────────────────────────────────────────────

### `itemBattleaxe: Item`

### `itemBlowgun: Item`

### `itemBolts20: Item`

### `itemBreastplate: Item`

### `itemBurglarsPack: Item`

### `itemCastOffBreastplate: Item`

### `itemChainMail: Item`

### `itemChainShirt: Item`

── Medium Armor ──────────────────────────────────────────────────────────────
Medium armor: base + DEX (max +2). The pipeline takes formulaAbilities mods
uncapped; for medium armor correctness the DEX cap would need pipeline support.
For now we express as base_ac_formula with DEX so equipping any medium armor
at least shows the correct base and adds DEX. Cap enforcement is a TODO.

### `itemClub: Item`

### `itemComponentPouch: Item`

### `itemDagger: Item`

── Simple Melee Weapons ──────────────────────────────────────────────────────

### `itemDart: Item`

── Simple Ranged Weapons ─────────────────────────────────────────────────────

### `itemDiplomatsPack: Item`

### `itemDruidicFocus: Item`

### `itemDungeoneersPack: Item`

### `itemEntertainersPack: Item`

### `itemExplorersPack: Item`

── Equipment Packs ───────────────────────────────────────────────────────────

### `itemFlail: Item`

── Martial Melee Weapons ─────────────────────────────────────────────────────

### `itemGlaive: Item`

### `itemGreataxe: Item`

### `itemGreatclub: Item`

### `itemGreatsword: Item`

### `itemGreatswordLifeDrinking: Item`

### `itemHalberd: Item`

### `itemHalfPlate: Item`

### `itemHandaxe: Item`

### `itemHandCrossbow: Item`

### `itemHealersKit: Item`

### `itemHeavyCrossbow: Item`

### `itemHolySymbol: Item`

### `itemJavelin: Item`

### `itemLance: Item`

### `itemLeatherArmor: Item`

── Light Armor ───────────────────────────────────────────────────────────────

### `itemLightCrossbow: Item`

### `itemLightHammer: Item`

### `itemLongbow: Item`

── Martial Ranged Weapons ────────────────────────────────────────────────────

### `itemLongsword: Item`

### `itemLute: Item`

### `itemMace: Item`

### `itemMaul: Item`

### `itemMorningstar: Item`

### `itemNet: Item`

### `itemPike: Item`

### `itemPlateMail: Item`

### `itemPriestsPack: Item`

### `itemQuarterstaff: Item`

### `itemRapier: Item`

### `itemRations1day: Item`

### `itemRingMail: Item`

── Heavy Armor ───────────────────────────────────────────────────────────────

### `itemRope50ft: Item`

### `itemRopeOfMending: Item`

### `itemScaleMail: Item`

### `itemScholarsPack: Item`

### `itemScimitar: Item`

### `itemShieldItem: Item`

── Shield ────────────────────────────────────────────────────────────────────

### `itemShortbow: Item`

### `itemShortSword: Item`

### `itemSickle: Item`

### `itemSling: Item`

### `itemSpear: Item`

### `itemSpellbook: Item`

### `itemSplint: Item`

### `itemStuddedLeather: Item`

### `itemThievesTools: Item`

### `itemTorch: Item`

### `itemTrident: Item`

### `itemWarhammer: Item`

### `itemWarPick: Item`

### `itemWhip: Item`

---

## Imports

- [[src__content__items__importedItems|importedItems]]  ·  `src/content/items/importedItems.ts`
- [[src__engine__types|types]]  ·  `src/engine/types.ts`

## Used by

- [[app__sheet__[id]|[id]]]  ·  `app/sheet/[id].tsx`
- [[src__components__sheet__TabExploration|TabExploration]]  ·  `src/components/sheet/TabExploration.tsx`
- [[src__content__classes__library|library]]  ·  `src/content/classes/library.ts`
- [[src__store__characterStore|characterStore]]  ·  `src/store/characterStore.ts`
