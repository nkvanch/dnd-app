// ============================================================================
// FILE: src/content/items/magicItems2024.ts
// The "Magic Items A-Z" chapter of the System Reference Document 5.2.1 (2024 rules / 5.5e), Creative Commons Attribution 4.0,
// as items with their full rules text (rows are generated into magicItems2024Data.ts). They are records of the SRD 5.2.1
// pack, not of the static catalog (whose one-line 5e summaries stay as they are), and where an id is also in the 5.1 pack the
// later 5.2.1 record replaces it (items are shared across rulesets). The text is the rules text; nothing here adds a
// computed effect, so a bonus on a magic item is applied by hand unless the catalog item with that id models it.
// ============================================================================
import type { Item, Feature } from '../../engine/types';
import { MAGIC_ROWS, MagicRow } from './magicItems2024Data';

function build(r: MagicRow): Item {
  return {
    id: r.id, name: r.name, weight: 0, cost: '—',
    properties: ['magic item', ...(r.rarity !== 'varies' ? [r.rarity] : []), ...(r.attunement ? ['requires attunement'] : []), r.category.toLowerCase()],
    features: [{
      id: `${r.id}_desc`, name: r.name, description: `${r.typeLine}. ${r.text}`,
      source: { kind: 'item', refId: r.id }, level: null, effects: [], actions: [], choices: [], passive: true,
    } as Feature],
  };
}

/** Every SRD 5.2.1 magic item entry. */
export const MAGIC_ITEMS_2024: Item[] = MAGIC_ROWS.map(build);
export const MAGIC_ITEMS_2024_BY_ID: Map<string, Item> = new Map(MAGIC_ITEMS_2024.map(i => [i.id, i]));

/** A catalog item that only has a one-line summary (no effect, activation, ability effect or resource), so the SRD entry can replace it outright. */
export function isPlaceholderItem(i: Item): boolean {
  return (i.resources?.length ?? 0) === 0 && i.features.every(f =>
    (f.effects?.length ?? 0) === 0 && !f.activation && !(f as { abilityEffects?: unknown[] }).abilityEffects?.length && (f.actions?.length ?? 0) === 0 && (f.choices?.length ?? 0) === 0);
}

/**
 * The record the SRD 5.2.1 pack carries for a magic item: the SRD entry, except that a catalog item which already models a
 * mechanic (Cloak of Protection's +1, a charged wand) keeps its features, with the SRD's rarity, attunement and rules text
 * in place of its summary. Without this, installing the pack would drop a bonus the app applies today.
 */
export function magicItemRecord(entry: Item, catalog: Item | undefined): Item {
  if (!catalog || isPlaceholderItem(catalog)) return entry;
  return {
    ...catalog, properties: entry.properties,
    features: catalog.features.map(f => f.id === `${catalog.id}_desc` ? { ...f, description: entry.features[0].description } : f),
  };
}
