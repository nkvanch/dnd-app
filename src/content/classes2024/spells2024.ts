// ============================================================================
// FILE: src/content/classes2024/spells2024.ts
// The spells that exist only in the 2024 rules (System Reference Document 5.2.1, Creative Commons
// Attribution 4.0): Divine Smite (now a spell), Elementalism, Shining Smite, Sorcerous Burst, Starry
// Wisp and Summon Dragon. Tagged rulesetId 'dnd5e-2024'; `srd` stays false because that flag means
// SRD 5.1. Class tags use the 2024 class ids so they appear only on the 2024 classes' lists.
// Summon Dragon's Draconic Spirit stat block is summarized, not reproduced in full.
// ============================================================================
import { Spell, RulesetId } from '../../engine/types';

const R = 'dnd5e-2024' as RulesetId;
const base = { srd: false, rulesetId: R, ritual: false } as const;

export const NEW_SPELLS_2024: Spell[] = [
  {
    ...base, id: 'divine_smite', name: 'Divine Smite', level: 1, school: 'Evocation',
    castingTime: 'Bonus Action, which you take immediately after hitting a target with a Melee weapon or an Unarmed Strike',
    range: 'Self', components: ['V'], duration: 'Instantaneous', concentration: false,
    description: 'The target takes an extra 2d8 Radiant damage from the attack. The damage increases by 1d8 if the target is a Fiend or an Undead.',
    upcast: 'The damage increases by 1d8 for each spell slot level above 1.', classes: ['paladin_2024'], spellType: ['damage'],
  },
  {
    ...base, id: 'shining_smite', name: 'Shining Smite', level: 2, school: 'Transmutation',
    castingTime: 'Bonus Action, which you take immediately after hitting a creature with a Melee weapon or an Unarmed Strike',
    range: 'Self', components: ['V'], duration: 'Concentration, up to 1 minute', concentration: true,
    description: 'The target hit by the strike takes an extra 2d6 Radiant damage from the attack. Until the spell ends, the target sheds Bright Light in a 5-foot radius, attack rolls against it have Advantage, and it can\'t benefit from the Invisible condition.',
    upcast: 'The damage increases by 1d6 for each spell slot level above 2.', classes: ['paladin_2024'], spellType: ['damage'],
  },
  {
    ...base, id: 'elementalism', name: 'Elementalism', level: 0, school: 'Transmutation',
    castingTime: 'Action', range: '30 feet', components: ['V', 'S'], duration: 'Instantaneous', concentration: false,
    description:
      'You exert control over the elements, creating one of the following effects within range. Beckon Air: a breeze strong enough to ripple cloth, stir dust, rustle leaves, and close open doors and shutters, all in a 5-foot Cube. Beckon Earth: a thin shroud of dust or sand covers surfaces in a 5-foot-square area, or a single word appears in your handwriting in a patch of dirt or sand. Beckon Fire: a thin cloud of harmless embers and colored, scented smoke in a 5-foot Cube; the embers can light candles, torches, or lamps in that area, and the scent lingers for 1 minute. Beckon Water: a spray of cool mist that lightly dampens creatures and objects in a 5-foot Cube, or 1 cup of clean water in an open container or on a surface that evaporates in 1 minute. Sculpt Element: dirt, sand, fire, smoke, mist, or water that fits in a 1-foot Cube assumes a crude shape (such as that of a creature) for 1 hour.',
    upcast: null, classes: ['druid_2024', 'sorcerer_2024', 'wizard_2024'], spellType: ['utility'],
  },
  {
    ...base, id: 'sorcerous_burst', name: 'Sorcerous Burst', level: 0, school: 'Evocation',
    castingTime: 'Action', range: '120 feet', components: ['V', 'S'], duration: 'Instantaneous', concentration: false,
    description:
      'You cast sorcerous energy at one creature or object within range. Make a ranged spell attack against the target. On a hit, the target takes 1d8 damage of a type you choose: Acid, Cold, Fire, Lightning, Poison, Psychic, or Thunder. If you roll an 8 on a d8 for this spell, you can roll another d8 and add it to the damage; the maximum number of these extra d8s equals your spellcasting ability modifier. The damage increases by 1d8 when you reach levels 5 (2d8), 11 (3d8), and 17 (4d8).',
    upcast: null, classes: ['sorcerer_2024'], spellType: ['damage'],
  },
  {
    ...base, id: 'starry_wisp', name: 'Starry Wisp', level: 0, school: 'Evocation',
    castingTime: 'Action', range: '60 feet', components: ['V', 'S'], duration: 'Instantaneous', concentration: false,
    description:
      'You launch a mote of light at one creature or object within range. Make a ranged spell attack against the target. On a hit, the target takes 1d8 Radiant damage, and until the end of your next turn it emits Dim Light in a 10-foot radius and can\'t benefit from the Invisible condition. The damage increases by 1d8 when you reach levels 5 (2d8), 11 (3d8), and 17 (4d8).',
    upcast: null, classes: ['bard_2024', 'druid_2024'], spellType: ['damage'],
  },
  {
    ...base, id: 'summon_dragon', name: 'Summon Dragon', level: 5, school: 'Conjuration',
    castingTime: 'Action', range: '60 feet', components: ['V', 'S', 'M (an object with the image of a dragon engraved on it worth 500+ GP)'], duration: 'Concentration, up to 1 hour', concentration: true,
    description:
      'You call forth a Dragon spirit. It manifests in an unoccupied space you can see within range and uses the Draconic Spirit stat block (Large Dragon, AC 14 + the spell\'s level, HP 50 + 10 for each spell level above 5, Speed 30 ft., Fly 60 ft., Swim 30 ft.; the full stat block is in the SRD). The creature disappears when it drops to 0 Hit Points or when the spell ends. It is an ally to you and your allies, shares your Initiative count but takes its turn immediately after yours, and obeys your verbal commands (if you give none, it takes the Dodge action and moves to avoid danger).',
    upcast: 'Use the spell slot\'s level for the spell\'s level in the stat block.', classes: ['wizard_2024'], spellType: ['summoning'],
  },
];
