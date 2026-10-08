import snapshot from './publicContent.json';
import type { MonsterTemplate } from '../monsters/types';
export const ALL_MONSTER_TEMPLATES = snapshot.monsters as MonsterTemplate[];
export const FULL_MONSTER_LIBRARY = ALL_MONSTER_TEMPLATES;
