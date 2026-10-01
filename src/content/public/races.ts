import snapshot from './publicContent.json';
import type { Race } from '../../engine/types';
export const ALL_RACES = snapshot.races as Race[];
export const FULL_RACE_LIBRARY = ALL_RACES;
const originals = snapshot.originalRaces as Race[];
export const raceHuman = originals.find(value => value.id === 'human')!;
export const raceSkeleton = originals.find(value => value.id === 'skeleton')!;
