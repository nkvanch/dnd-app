// ============================================================================
// FILE: src/content/itemForCharacter.ts
// Which item id a character is given when a class, background or choice names an item. The rules name items by their 5e id
// (`backpack`, `thieves_tools`); a 5.5e character with the SRD 5.2.1 pack installed gets that item's 5.5e record when the pack
// has one (`backpack_2024`), and the shared record otherwise. With no pack installed (the built-in catalog) the id is unchanged.
// ============================================================================
import type { RulesetId } from '../engine/types';
import { getOfficialContentProvider } from './officialSource';
import { baseItemId, editionItemId } from './itemEditions';

export function itemIdForCharacter(itemId: string, ruleset: RulesetId | string | undefined): string {
  if (ruleset !== 'dnd5e-2024') return itemId;
  const alt = editionItemId(baseItemId(itemId));
  return getOfficialContentProvider()?.getItem(alt)?.id === alt ? alt : itemId;
}
