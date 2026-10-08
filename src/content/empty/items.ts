import type { Item } from '../../engine/types';
import { ContentRegistry } from '../ContentRegistry';
export const ALL_ITEMS: Item[] = [];
export const FULL_ITEM_LIBRARY: Item[] = [];
export const CATALOG_ITEM_IDS_5E: Set<string> = new Set();
export const itemRegistry = new ContentRegistry<Item>(() => ALL_ITEMS);
