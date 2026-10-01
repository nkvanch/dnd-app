import snapshot from './publicContent.json';
import type { Feat } from '../../engine/types';
export const ALL_FEATS = snapshot.feats as Feat[];
export const FULL_FEAT_LIBRARY = ALL_FEATS;
export const FEATS_BY_ID: Record<string, Feat> = Object.fromEntries(ALL_FEATS.map(value => [value.id, value]));
