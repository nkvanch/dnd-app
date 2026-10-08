// ============================================================================
// FILE: src/content/monsters/types.ts
// Monster template — a static content record, NOT a live Entity.
// Templates are instantiated into full Entity objects via monsterFactory.ts.
// ============================================================================
import { AbilityScores, Ability, SkillName, Feature, ResourceGrant, RulesetId } from '../../engine/types';

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
  /**
   * Limited-use abilities (e.g. Legendary Resistance, a rechargeable self-
   * heal) authored via the homebrew builder's "Limited-use ability" trait
   * kind. Official templates have none — folded into the spawned Entity's
   * resources by monsterFactory.ts, same applyGrant() path races/classes use.
   */
  resources?: ResourceGrant[];
  /**
   * SRD 5.1 legal status. Monster STAT BLOCKS (numbers/abilities, as opposed
   * to unique named characters/villains) are explicitly covered by the SRD
   * CC-BY license. This file (srd.ts) is already scoped to generic, classic
   * creatures with no Product Identity naming — all confidently true. Same
   * semantics as Spell.srd. See docs/ROADMAP_1.0.md Phase 1 Step 1.4.
   */
  srd?: boolean;
  /** Which ruleset this monster belongs to. Undefined = available under every ruleset. See the ContentHeader comment near the top of src/engine/types.ts. */
  rulesetId?: RulesetId;
};
