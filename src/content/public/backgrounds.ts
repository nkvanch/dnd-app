import snapshot from './publicContent.json';
import type { Background } from '../../engine/types';
export const ALL_BACKGROUNDS = snapshot.backgrounds as Background[];
export const FULL_BACKGROUND_LIBRARY = ALL_BACKGROUNDS;
const originals = snapshot.originalBackgrounds as Background[];
export const bgSoldier = originals.find(value => value.id === 'soldier')!;
