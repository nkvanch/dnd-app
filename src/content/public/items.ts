import snapshot from './publicContent.json';
import type { Item } from '../../engine/types';
import { ContentRegistry } from '../ContentRegistry';
export const ALL_ITEMS = snapshot.items as Item[];
export const FULL_ITEM_LIBRARY = ALL_ITEMS;
export const itemRegistry = new ContentRegistry<Item>(() => ALL_ITEMS);
