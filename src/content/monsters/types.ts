// ============================================================================
// FILE: src/content/monsters/types.ts
// Monster template — a static content record, NOT a live Entity.
// Templates are instantiated into full Entity objects via monsterFactory.ts.
// ============================================================================
import { AbilityScores, Ability, SkillName, Feature } from '../../engine/types';

/**
 * A static monster template stored in the content database.
 * Instantiate with spawnMonster() from src/engine/monsterFactory.ts.
 */
export type MonsterTemplate = {
  id:          string;
  name:        string;
  cr:          number;          // Challenge Rating (0.125, 0.25, 0.5, 1, 2 … 30)
  size:        'tiny' | 'small' | 'medium' | 'large' | 'huge' | 'gargantuan';
  type:        string;          // "humanoid", "undead", "beast", etc.
  alignment:   string;
  stats:       AbilityScores;
  hp: {
    dice:    string;           // e.g. "2d6+2" — rolled or averaged at spawn
    average: number;           // pre-computed average for display
  };
  ac: {
    value:  number;
    source: string;            // "natural armor", "chain mail", etc.
  };
  speed:        number;        // base walking speed in feet
  features:     Feature[];     // all traits, actions, reactions as Features
  savingThrows: Ability[];     // abilities with proficiency in saving throws
  skills:       Partial<Record<SkillName, number>>; // flat bonuses
  senses:       string[];      // ["darkvision 60 ft", "passive Perception 9"]
  languages:    string[];
  legendaryActions?: number;   // number of legendary actions per round
  lairActions?:  Feature[];    // lair action features
};
