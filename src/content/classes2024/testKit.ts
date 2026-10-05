import { makeEmptyEntity, DEFAULT_RULES } from '../../store/characterStore';
import { levelUp, applySubclassToEntity } from '../../engine/leveling';
import { mergeSubclassIntoProgression } from '../classes/progressions';
import { Entity, CharClass } from '../../engine/types';
import { CLASSES_2024, SUBCLASSES_2024 } from './index';

export const cls = (key: string): CharClass => CLASSES_2024.find(c => c.id === `${key}_2024`)!;
export const sub = (key: string) => SUBCLASSES_2024.find(s => s.classId === `${key}_2024`)!;

export function newChar(key: string, stats: Partial<Entity['stats']> = {}): Entity {
  const c = cls(key);
  let e = makeEmptyEntity(`t_${key}`);
  e = { ...e, identity: { ...e.identity, classId: c.id, level: 0 }, rulesetId: 'dnd5e-2024' as never,
    stats: { str: 10, dex: 14, con: 14, int: 10, wis: 14, cha: 14, ...stats },
    resources: { ...e.resources, hp: { current: 10, maximum: 10, temp: 0 } } };
  return levelUp(e, 1, c.rawProgression!, DEFAULT_RULES, CLASSES_2024);
}

/** Levels up the way the app does once a subclass is chosen: the subclass progression is merged in. */
export function toLevel(e: Entity, key: string, n: number): Entity {
  const c = cls(key);
  const subId = e.identity.subclassId;
  const prog = subId ? mergeSubclassIntoProgression(c.rawProgression!, sub(key)) : c.rawProgression!;
  return levelUp(e, n, prog, DEFAULT_RULES, CLASSES_2024);
}

export function bindSubclass(e: Entity, key: string): Entity {
  const choice = e.choices.find(c => c.definition.kind === 'subclass')!;
  return applySubclassToEntity(e, choice.id, sub(key).id, sub(key), DEFAULT_RULES);
}
