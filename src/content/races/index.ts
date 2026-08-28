// ============================================================================
// FILE: src/content/races/index.ts
// All PHB races expressed as Feature/Effect arrays.
// ============================================================================
import { Race, Subrace, AncestryOption, RACE_CHOICE_PREFIX, ChoiceOption, Feature, Ability } from '../../engine/types';

/**
 * Builds one Mordenkainen's Tome of Foes Tiefling bloodline subrace — each
 * replaces both the PHB "Bloodline of Asmodeus" ASI and Infernal Legacy
 * (see raceTiefling.subracesOptional/subraces' doc comment) with its own
 * +1-to-one-ability ASI and a real 1st-level cantrip. The 3rd/5th-level
 * bonus spell is flavor-only text on the same Feature — none of these are
 * cantrips, and this app has no mechanism for a limited-use LEVELED spell
 * without a slot (same gap as the various Eberron dragonmarks).
 */
function tieflingBloodline(
  id: string, name: string, asiAbility: Ability, cantripId: string,
  legacyName: string, bonusSpellsNote: string,
): Subrace {
  return {
    id, name, parentId: 'tiefling', srd: false,
    replacesBaseFeatureIds: ['tiefling_asi', 'tiefling_infernal_legacy'],
    features: [
      {
        id: `${id}_asi`, name: 'Ability Score Increase',
        description: `Your ${asiAbility.toUpperCase()} score increases by 1.`,
        source: { kind: 'race', refId: id }, level: null, actions: [], choices: [], passive: true,
        effects: [{ type: 'stat_modifier', target: asiAbility, operation: 'add', value: 1, condition: null }],
      },
      {
        id: `${id}_legacy`, name: legacyName,
        description: `You know the ${cantripId.replace(/_/g, ' ')} cantrip. Charisma is your spellcasting ability for it. At 3rd level you can cast ${bonusSpellsNote} — this app doesn't yet support level-gated racial features, so only the 1st-level cantrip is granted for real.`,
        source: { kind: 'race', refId: id }, level: null, actions: [], choices: [], passive: true,
        effects: [
          { type: 'grant_spell', target: 'spell', operation: 'add', value: null, condition: null, cantripIds: [cantripId], spellcastingAbility: 'cha' },
        ],
      },
    ],
  };
}

/** "Elf Weapon Training" — proficiency with longsword/shortsword/shortbow/
 * longbow, granted by most non-Drow elf subraces (High Elf, Wood Elf, and
 * several sourcebook variants below all share this exact trait verbatim). */
function elfWeaponTraining(refId: string): Feature {
  return {
    id: `${refId}_weapon_training`, name: 'Elf Weapon Training',
    description: 'You have proficiency with the longsword, shortsword, shortbow, and longbow.',
    source: { kind: 'race', refId }, level: null, actions: [], choices: [], passive: true,
    effects: [
      { type: 'grant_proficiency', target: 'weapon:longsword', operation: 'add', value: null, condition: null },
      { type: 'grant_proficiency', target: 'weapon:shortsword', operation: 'add', value: null, condition: null },
      { type: 'grant_proficiency', target: 'weapon:shortbow', operation: 'add', value: null, condition: null },
      { type: 'grant_proficiency', target: 'weapon:longbow', operation: 'add', value: null, condition: null },
    ],
  };
}

const ALL_SKILL_OPTIONS: ChoiceOption[] = [
  'athletics', 'acrobatics', 'sleight_of_hand', 'stealth', 'arcana', 'history',
  'investigation', 'nature', 'religion', 'animal_handling', 'insight', 'medicine',
  'perception', 'survival', 'deception', 'intimidation', 'performance', 'persuasion',
].map(s => ({ id: s, label: s, value: s }));

export const raceHuman: Race = {
  id: 'human',
  name: 'Human',
  srd: true,
  features: [
    {
      id: 'human_asi',
      name: 'Ability Score Increase',
      description: 'Your ability scores each increase by 1.',
      source: { kind: 'race', refId: 'human' },
      level: null, actions: [], choices: [], passive: true,
      effects: [
        { type: 'stat_modifier', target: 'str', operation: 'add', value: 1, condition: null },
        { type: 'stat_modifier', target: 'dex', operation: 'add', value: 1, condition: null },
        { type: 'stat_modifier', target: 'con', operation: 'add', value: 1, condition: null },
        { type: 'stat_modifier', target: 'int', operation: 'add', value: 1, condition: null },
        { type: 'stat_modifier', target: 'wis', operation: 'add', value: 1, condition: null },
        { type: 'stat_modifier', target: 'cha', operation: 'add', value: 1, condition: null },
      ],
    },
    {
      id: 'human_extra_language',
      name: 'Languages',
      description: 'You can speak, read, and write Common and one extra language of your choice.',
      source: { kind: 'race', refId: 'human' },
      level: null, effects: [], actions: [], choices: [], passive: true,
    },
  ],
  // PHB optional Variant Human rule — an alternate, not mandatory, so plain
  // Human stays fully selectable (subracesOptional).
  subracesOptional: true,
  subraces: [
    {
      id: 'variant_human', name: 'Variant Human', parentId: 'human', srd: true,
      replacesBaseFeatureIds: ['human_asi'],
      flexibleAsi: {
        prompt: 'Two different ability scores of your choice each increase by 1.',
        mode: { kind: 'two_distinct_plus_one' },
      },
      pendingChoices: [
        {
          id: `${RACE_CHOICE_PREFIX}variant_human_skill`,
          prompt: 'Choose one skill to gain proficiency in.',
          kind: 'skill', count: 1, pool: ALL_SKILL_OPTIONS,
          grants: [], required: true, resolved: false,
        },
      ],
      features: [
        {
          id: 'variant_human_feat_note', name: 'Feat',
          description: 'You gain one feat of your choice. Take it on the Feats screen during creation (enable the "Feat at 1st level" campaign rule if it isn\'t already, so that screen is reachable).',
          source: { kind: 'race', refId: 'variant_human' },
          level: null, effects: [], actions: [], choices: [], passive: true,
        },
      ],
    },
  ],
};

export const raceElf: Race = {
  id: 'elf',
  name: 'Elf',
  srd: true,
  features: [
    {
      id: 'elf_asi',
      name: 'Ability Score Increase',
      description: 'Your Dexterity score increases by 2 and your Intelligence score increases by 1.',
      source: { kind: 'race', refId: 'elf' },
      level: null, actions: [], choices: [], passive: true,
      effects: [
        { type: 'stat_modifier', target: 'dex', operation: 'add', value: 2, condition: null },
        { type: 'stat_modifier', target: 'int', operation: 'add', value: 1, condition: null },
      ],
    },
    {
      id: 'elf_darkvision',
      name: 'Darkvision',
      description: 'You can see in dim light within 60 feet as if it were bright light, and in darkness as if it were dim light.',
      source: { kind: 'race', refId: 'elf' },
      level: null, effects: [{ type: 'grant_sense', target: 'sense', operation: 'add', value: null, condition: null, senseType: 'darkvision', senseRange: 60 }], actions: [], choices: [], passive: true,
    },
    {
      id: 'elf_fey_ancestry',
      name: 'Fey Ancestry',
      description: 'You have advantage on saving throws against being charmed, and magic can\'t put you to sleep.',
      source: { kind: 'race', refId: 'elf' },
      level: null, actions: [], choices: [], passive: true,
      effects: [
        { type: 'grant_immunity', target: 'sleep_magic', operation: 'immunity', value: null, condition: null },
      ],
    },
    {
      id: 'elf_keen_senses',
      name: 'Keen Senses',
      description: 'You have proficiency in the Perception skill.',
      source: { kind: 'race', refId: 'elf' },
      level: null, actions: [], choices: [], passive: true,
      effects: [
        { type: 'grant_proficiency', target: 'skill:perception', operation: 'add', value: null, condition: null },
      ],
    },
    {
      id: 'elf_trance',
      name: 'Trance',
      description: 'Elves don\'t need to sleep. Instead, they meditate deeply for 4 hours a day.',
      source: { kind: 'race', refId: 'elf' },
      level: null, effects: [], actions: [], choices: [], passive: true,
    },
  ],
  subraces: [
    {
      id: 'high_elf', name: 'High Elf', parentId: 'elf', srd: true,
      features: [
        {
          id: 'high_elf_asi',
          name: 'Ability Score Increase',
          description: 'Your Intelligence score increases by 1.',
          source: { kind: 'race', refId: 'high_elf' },
          level: null, actions: [], choices: [], passive: true,
          effects: [{ type: 'stat_modifier', target: 'int', operation: 'add', value: 1, condition: null }],
        },
        {
          id: 'high_elf_cantrip',
          name: 'Cantrip',
          description: 'You know one cantrip of your choice from the wizard spell list. Intelligence is your spellcasting ability for it.',
          source: { kind: 'race', refId: 'high_elf' },
          level: null, effects: [], actions: [], choices: [], passive: true,
        },
        elfWeaponTraining('high_elf'),
        {
          id: 'high_elf_extra_language', name: 'Extra Language',
          description: 'You can read, speak, and write one additional language of your choice.',
          source: { kind: 'race', refId: 'high_elf' }, level: null, effects: [], actions: [], choices: [], passive: true,
        },
      ],
    },
    {
      id: 'wood_elf', name: 'Wood Elf', parentId: 'elf', srd: true,
      features: [
        {
          id: 'wood_elf_asi',
          name: 'Ability Score Increase',
          description: 'Your Wisdom score increases by 1.',
          source: { kind: 'race', refId: 'wood_elf' },
          level: null, actions: [], choices: [], passive: true,
          effects: [{ type: 'stat_modifier', target: 'wis', operation: 'add', value: 1, condition: null }],
        },
        {
          id: 'wood_elf_speed',
          name: 'Fleet of Foot',
          description: 'Your base walking speed increases to 35 feet.',
          source: { kind: 'race', refId: 'wood_elf' },
          level: null, actions: [], choices: [], passive: true,
          effects: [{ type: 'stat_modifier', target: 'speed', operation: 'set', value: 35, condition: null }],
        },
        {
          id: 'mask_of_the_wild',
          name: 'Mask of the Wild',
          description: 'You can attempt to hide even when you are only lightly obscured by foliage, heavy rain, falling snow, mist, and other natural phenomena.',
          source: { kind: 'race', refId: 'wood_elf' },
          level: null, effects: [], actions: [], choices: [], passive: true,
        },
        elfWeaponTraining('wood_elf'),
      ],
    },
    {
      id: 'drow', name: 'Dark Elf (Drow)', parentId: 'elf', srd: true,
      features: [
        {
          id: 'drow_asi',
          name: 'Ability Score Increase',
          description: 'Your Charisma score increases by 1.',
          source: { kind: 'race', refId: 'drow' },
          level: null, actions: [], choices: [], passive: true,
          effects: [{ type: 'stat_modifier', target: 'cha', operation: 'add', value: 1, condition: null }],
        },
        {
          id: 'drow_superior_darkvision',
          name: 'Superior Darkvision',
          description: 'Your darkvision has a range of 120 feet, instead of 60.',
          source: { kind: 'race', refId: 'drow' },
          level: null, actions: [], choices: [], passive: true,
          // Aggregated with base Elf's 60-ft darkvision by keeping the
          // longest range per sense type (see pipeline.ts's senses dedup) —
          // this 120ft entry naturally wins without needing to remove or
          // override the base race's grant_sense effect.
          effects: [{ type: 'grant_sense', target: 'sense', operation: 'add', value: null, condition: null, senseType: 'darkvision', senseRange: 120 }],
        },
        {
          id: 'sunlight_sensitivity',
          name: 'Sunlight Sensitivity',
          description: 'You have disadvantage on attack rolls and Perception checks that rely on sight when you, the target, or whatever you are trying to perceive is in direct sunlight.',
          source: { kind: 'race', refId: 'drow' },
          level: null, effects: [], actions: [], choices: [], passive: true,
        },
        {
          id: 'drow_magic',
          name: 'Drow Magic',
          description: 'You know the Dancing Lights cantrip. Charisma is your spellcasting ability for it. At 3rd level you can cast Faerie Fire once with this trait, and at 5th level Darkness once, each recharging on a long rest — this app doesn\'t yet support level-gated racial features, so only the 1st-level cantrip is granted for real; the two spells are reference-only.',
          source: { kind: 'race', refId: 'drow' },
          level: null, actions: [], choices: [], passive: true,
          effects: [
            { type: 'grant_spell', target: 'spell', operation: 'add', value: null, condition: null, cantripIds: ['dancing_lights'], spellcastingAbility: 'cha' },
          ],
        },
        {
          id: 'drow_weapon_training',
          name: 'Drow Weapon Training',
          description: 'You have proficiency with rapiers, shortswords, and hand crossbows.',
          source: { kind: 'race', refId: 'drow' },
          level: null, actions: [], choices: [], passive: true,
          effects: [
            { type: 'grant_proficiency', target: 'weapon:rapier', operation: 'add', value: null, condition: null },
            { type: 'grant_proficiency', target: 'weapon:shortsword', operation: 'add', value: null, condition: null },
            { type: 'grant_proficiency', target: 'weapon:hand_crossbow', operation: 'add', value: null, condition: null },
          ],
        },
      ],
    },
    // Explorer's Guide to Wildemount
    {
      id: 'pallid_elf', name: 'Pallid Elf', parentId: 'elf', srd: false,
      features: [
        {
          id: 'pallid_elf_asi', name: 'Ability Score Increase',
          description: 'Your Wisdom score increases by 1.',
          source: { kind: 'race', refId: 'pallid_elf' }, level: null, actions: [], choices: [], passive: true,
          effects: [{ type: 'stat_modifier', target: 'wis', operation: 'add', value: 1, condition: null }],
        },
        {
          id: 'incisive_sense', name: 'Incisive Sense',
          description: 'You have advantage on Investigation and Insight checks. (This app has no mechanism for advantage on a specific pair of skill checks — only a small hardcoded set of advantage targets, e.g. attack rolls — so this isn\'t applied mechanically.)',
          source: { kind: 'race', refId: 'pallid_elf' }, level: null, effects: [], actions: [], choices: [], passive: true,
        },
        {
          id: 'blessing_of_the_moonweaver', name: 'Blessing of the Moonweaver',
          description: 'You know the Light cantrip. Wisdom is your spellcasting ability for it. At 3rd level you can cast Sleep once, and at 5th level Invisibility (self only) once, each recharging on a long rest — this app doesn\'t yet support level-gated racial features, so only the 1st-level cantrip is granted for real.',
          source: { kind: 'race', refId: 'pallid_elf' }, level: null, actions: [], choices: [], passive: true,
          effects: [
            { type: 'grant_spell', target: 'spell', operation: 'add', value: null, condition: null, cantripIds: ['light'], spellcastingAbility: 'wis' },
          ],
        },
      ],
    },
    // Eberron: Rising from the Last War — dragonmark. "Spells of the Mark"
    // (adds spells to a spellcasting class's spell list) has no mechanism —
    // same disclosed gap as Gnome's Mark of Scribing.
    {
      id: 'mark_of_shadow', name: 'Mark of Shadow', parentId: 'elf', srd: false,
      features: [
        {
          id: 'mark_of_shadow_asi', name: 'Ability Score Increase',
          description: 'Your Charisma score increases by 1.',
          source: { kind: 'race', refId: 'mark_of_shadow' }, level: null, actions: [], choices: [], passive: true,
          effects: [{ type: 'stat_modifier', target: 'cha', operation: 'add', value: 1, condition: null }],
        },
        {
          id: 'cunning_intuition', name: 'Cunning Intuition',
          description: 'Whenever you roll a Dexterity (Stealth) or Charisma (Performance) check, roll a d4 and add it to the total. (No mechanism for a random per-check bonus — not applied mechanically.)',
          source: { kind: 'race', refId: 'mark_of_shadow' }, level: null, effects: [], actions: [], choices: [], passive: true,
        },
        {
          id: 'shape_shadows', name: 'Shape Shadows',
          description: 'You know the Minor Illusion cantrip. Charisma is your spellcasting ability for it. At 3rd level you can cast Invisibility once, recharging on a long rest — this app doesn\'t yet support level-gated racial features, so only the 1st-level cantrip is granted for real.',
          source: { kind: 'race', refId: 'mark_of_shadow' }, level: null, actions: [], choices: [], passive: true,
          effects: [
            { type: 'grant_spell', target: 'spell', operation: 'add', value: null, condition: null, cantripIds: ['minor_illusion'], spellcastingAbility: 'cha' },
          ],
        },
        {
          id: 'spells_of_the_mark', name: 'Spells of the Mark',
          description: 'If you have the Spellcasting or Pact Magic class feature, Disguise Self, Silent Image, Darkness, Pass without Trace, Clairvoyance, Major Image, Greater Invisibility, Hallucinatory Terrain, and Mislead are added to your class\'s spell list. (No mechanism to add spells to a class spell list — not applied mechanically, tracked for reference.)',
          source: { kind: 'race', refId: 'mark_of_shadow' }, level: null, effects: [], actions: [], choices: [], passive: true,
        },
      ],
    },
    // Spelljammer: Adventures in Space (Astral Adventurer's Guide) — official.
    {
      id: 'astral_elf', name: 'Astral Elf', parentId: 'elf', srd: false,
      replacesBaseFeatureIds: ['elf_asi', 'elf_darkvision', 'elf_fey_ancestry', 'elf_keen_senses', 'elf_trance'],
      flexibleAsi: {
        prompt: 'Increase one ability score by 2 and a different one by 1, or increase three different ability scores by 1.',
        mode: { kind: 'two_one_or_three_one' },
      },
      // Astral Fire: RAW lets you independently choose a cantrip (Dancing
      // Lights/Light/Sacred Flame) AND which of INT/WIS/CHA governs it —
      // simplified to 3 paired options (the ancestryChoice mechanism grants
      // one Feature per pick, not two independent nested choices), disclosed
      // in each option's blurb.
      ancestryChoice: {
        prompt: 'Choose your Astral Fire cantrip (paired with a spellcasting ability, per RAW you may pick any of the three abilities independently — simplified here to one fixed pairing per option).',
        options: [
          {
            id: 'dancing_lights', name: 'Dancing Lights (Intelligence)', blurb: 'Know Dancing Lights, cast with Intelligence.',
            feature: {
              id: 'astral_fire_dancing_lights', name: 'Astral Fire', description: 'You know the Dancing Lights cantrip. Intelligence is your spellcasting ability for it.',
              source: { kind: 'race', refId: 'astral_elf' }, level: null, actions: [], choices: [], passive: true,
              effects: [{ type: 'grant_spell', target: 'spell', operation: 'add', value: null, condition: null, cantripIds: ['dancing_lights'], spellcastingAbility: 'int' }],
            },
          },
          {
            id: 'light', name: 'Light (Wisdom)', blurb: 'Know Light, cast with Wisdom.',
            feature: {
              id: 'astral_fire_light', name: 'Astral Fire', description: 'You know the Light cantrip. Wisdom is your spellcasting ability for it.',
              source: { kind: 'race', refId: 'astral_elf' }, level: null, actions: [], choices: [], passive: true,
              effects: [{ type: 'grant_spell', target: 'spell', operation: 'add', value: null, condition: null, cantripIds: ['light'], spellcastingAbility: 'wis' }],
            },
          },
          {
            id: 'sacred_flame', name: 'Sacred Flame (Charisma)', blurb: 'Know Sacred Flame, cast with Charisma.',
            feature: {
              id: 'astral_fire_sacred_flame', name: 'Astral Fire', description: 'You know the Sacred Flame cantrip. Charisma is your spellcasting ability for it.',
              source: { kind: 'race', refId: 'astral_elf' }, level: null, actions: [], choices: [], passive: true,
              effects: [{ type: 'grant_spell', target: 'spell', operation: 'add', value: null, condition: null, cantripIds: ['sacred_flame'], spellcastingAbility: 'cha' }],
            },
          },
        ],
      },
      resources: [
        { resourceId: 'starlight_step_pool', name: 'Starlight Step', maximum: 2, recharge: 'long_rest' },
      ],
      features: [
        {
          id: 'astral_elf_darkvision', name: 'Darkvision',
          description: 'You can see in dim light within 60 feet as if it were bright light, and in darkness as if it were dim light.',
          source: { kind: 'race', refId: 'astral_elf' }, level: null, actions: [], choices: [], passive: true,
          effects: [{ type: 'grant_sense', target: 'sense', operation: 'add', value: null, condition: null, senseType: 'darkvision', senseRange: 60 }],
        },
        {
          id: 'astral_elf_fey_ancestry', name: 'Fey Ancestry',
          description: 'You have advantage on saving throws you make to avoid or end the charmed condition on yourself.',
          source: { kind: 'race', refId: 'astral_elf' }, level: null, effects: [], actions: [], choices: [], passive: true,
        },
        {
          id: 'astral_elf_keen_senses', name: 'Keen Senses',
          description: 'You have proficiency in the Perception skill.',
          source: { kind: 'race', refId: 'astral_elf' }, level: null, actions: [], choices: [], passive: true,
          effects: [{ type: 'grant_proficiency', target: 'skill:perception', operation: 'add', value: null, condition: null }],
        },
        {
          id: 'starlight_step', name: 'Starlight Step',
          description: 'As a bonus action, you can magically teleport up to 30 feet to an unoccupied space you can see. You can use this a number of times equal to your proficiency bonus (this app tracks a fixed pool of 2, the 1st-level value); all uses return on a long rest. (This app has no teleport/repositioning mechanic — the resource is tracked, but using it has no automated effect.)',
          source: { kind: 'race', refId: 'astral_elf' }, level: null, actions: [], choices: [], passive: false,
          effects: [],
          activation: { actionType: 'bonus_action', resourceCost: { resourceId: 'starlight_step_pool', quantity: 1 }, range: '30 feet', target: 'self', requiresSave: null },
        },
        {
          id: 'astral_trance', name: 'Astral Trance',
          description: 'You don\'t need to sleep, and magic can\'t put you to sleep. You can finish a long rest in 4 hours of trancelike meditation, gaining one skill proficiency and one weapon or tool proficiency of your choice until your next long rest. (No mechanism for temporary/expiring proficiencies — not applied mechanically.)',
          source: { kind: 'race', refId: 'astral_elf' }, level: null, effects: [], actions: [], choices: [], passive: true,
        },
      ],
    },
    // Plane Shift: Kaladesh (Magic: the Gathering crossover)
    {
      id: 'bishtahar_tirahar_elf', name: 'Bishtahar/Tirahar Elf', parentId: 'elf', srd: false,
      features: [
        {
          id: 'bishtahar_asi', name: 'Ability Score Increase',
          description: 'Your Wisdom score increases by 1.',
          source: { kind: 'race', refId: 'bishtahar_tirahar_elf' }, level: null, actions: [], choices: [], passive: true,
          effects: [{ type: 'stat_modifier', target: 'wis', operation: 'add', value: 1, condition: null }],
        },
        elfWeaponTraining('bishtahar_tirahar_elf'),
        {
          id: 'bishtahar_fleet_of_foot', name: 'Fleet of Foot',
          description: 'Your base walking speed increases to 35 feet.',
          source: { kind: 'race', refId: 'bishtahar_tirahar_elf' }, level: null, actions: [], choices: [], passive: true,
          effects: [{ type: 'stat_modifier', target: 'speed', operation: 'set', value: 35, condition: null }],
        },
        {
          id: 'bishtahar_mask_of_the_wild', name: 'Mask of the Wild',
          description: 'You can attempt to hide even when you are only lightly obscured by foliage, heavy rain, falling snow, mist, and other natural phenomena.',
          source: { kind: 'race', refId: 'bishtahar_tirahar_elf' }, level: null, effects: [], actions: [], choices: [], passive: true,
        },
      ],
    },
    {
      id: 'vahadar_elf', name: 'Vahadar Elf', parentId: 'elf', srd: false,
      features: [
        {
          id: 'vahadar_asi', name: 'Ability Score Increase',
          description: 'Your Wisdom score increases by 1.',
          source: { kind: 'race', refId: 'vahadar_elf' }, level: null, actions: [], choices: [], passive: true,
          effects: [{ type: 'stat_modifier', target: 'wis', operation: 'add', value: 1, condition: null }],
        },
        elfWeaponTraining('vahadar_elf'),
        {
          id: 'vahadar_cantrip', name: 'Cantrip',
          description: 'You know one cantrip of your choice from the druid spell list. Wisdom is your spellcasting ability for it.',
          source: { kind: 'race', refId: 'vahadar_elf' }, level: null, effects: [], actions: [], choices: [], passive: true,
        },
        {
          id: 'vahadar_extra_language', name: 'Extra Language',
          description: 'You can speak, read, and write one extra language of your choice.',
          source: { kind: 'race', refId: 'vahadar_elf' }, level: null, effects: [], actions: [], choices: [], passive: true,
        },
      ],
    },
    // Plane Shift: Zendikar (Magic: the Gathering crossover)
    {
      id: 'tajuru', name: 'Tajuru', parentId: 'elf', srd: false,
      pendingChoices: [
        {
          id: `${RACE_CHOICE_PREFIX}tajuru_skills`,
          prompt: 'Choose two skills to gain proficiency in. (RAW also allows tools instead of skills — this app\'s race-selection choice queue only supports skill choices, so narrowed to skills only.)',
          kind: 'skill', count: 2, pool: ALL_SKILL_OPTIONS,
          grants: [], required: true, resolved: false,
        },
      ],
      features: [
        {
          id: 'tajuru_asi', name: 'Ability Score Increase',
          description: 'Your Charisma score increases by 1.',
          source: { kind: 'race', refId: 'tajuru' }, level: null, actions: [], choices: [], passive: true,
          effects: [{ type: 'stat_modifier', target: 'cha', operation: 'add', value: 1, condition: null }],
        },
      ],
    },
    {
      id: 'juraga', name: 'Juraga', parentId: 'elf', srd: false,
      features: [
        {
          id: 'juraga_asi', name: 'Ability Score Increase',
          description: 'Your Dexterity score increases by 1.',
          source: { kind: 'race', refId: 'juraga' }, level: null, actions: [], choices: [], passive: true,
          effects: [{ type: 'stat_modifier', target: 'dex', operation: 'add', value: 1, condition: null }],
        },
        elfWeaponTraining('juraga'),
        {
          id: 'juraga_fleet_of_foot', name: 'Fleet of Foot',
          description: 'Your base walking speed increases to 35 feet.',
          source: { kind: 'race', refId: 'juraga' }, level: null, actions: [], choices: [], passive: true,
          effects: [{ type: 'stat_modifier', target: 'speed', operation: 'set', value: 35, condition: null }],
        },
        {
          id: 'juraga_mask_of_the_wild', name: 'Mask of the Wild',
          description: 'You can attempt to hide even when you are only lightly obscured by foliage, heavy rain, falling snow, mist, and other natural phenomena.',
          source: { kind: 'race', refId: 'juraga' }, level: null, effects: [], actions: [], choices: [], passive: true,
        },
      ],
    },
    {
      id: 'mul_daya', name: 'Mul Daya', parentId: 'elf', srd: false,
      features: [
        {
          id: 'mul_daya_asi', name: 'Ability Score Increase',
          description: 'Your Strength score increases by 1.',
          source: { kind: 'race', refId: 'mul_daya' }, level: null, actions: [], choices: [], passive: true,
          effects: [{ type: 'stat_modifier', target: 'str', operation: 'add', value: 1, condition: null }],
        },
        {
          id: 'mul_daya_superior_darkvision', name: 'Superior Darkvision',
          description: 'Your darkvision has a radius of 120 feet.',
          source: { kind: 'race', refId: 'mul_daya' }, level: null, actions: [], choices: [], passive: true,
          effects: [{ type: 'grant_sense', target: 'sense', operation: 'add', value: null, condition: null, senseType: 'darkvision', senseRange: 120 }],
        },
        {
          id: 'mul_daya_sunlight_sensitivity', name: 'Sunlight Sensitivity',
          description: 'You have disadvantage on attack rolls and Wisdom (Perception) checks that rely on sight when you, the target, or whatever you are trying to perceive is in direct sunlight.',
          source: { kind: 'race', refId: 'mul_daya' }, level: null, effects: [], actions: [], choices: [], passive: true,
        },
        {
          id: 'mul_daya_magic', name: 'Mul Daya Magic',
          description: 'You know the Chill Touch cantrip. Wisdom is your spellcasting ability for it. At 3rd level you can cast Hex once, and at 5th level Darkness once, each recharging on a long rest — this app doesn\'t yet support level-gated racial features, so only the 1st-level cantrip is granted for real.',
          source: { kind: 'race', refId: 'mul_daya' }, level: null, actions: [], choices: [], passive: true,
          effects: [
            { type: 'grant_spell', target: 'spell', operation: 'add', value: null, condition: null, cantripIds: ['chill_touch'], spellcastingAbility: 'wis' },
          ],
        },
        elfWeaponTraining('mul_daya'),
      ],
    },
    // Unearthed Arcana 46 — Elf Subraces
    {
      id: 'avariel_elf', name: 'Avariel Elf', parentId: 'elf', srd: false,
      features: [
        {
          id: 'avariel_flight', name: 'Flight',
          description: 'You have a flying speed of 30 feet. (RAW: only while not wearing medium or heavy armor — this app has no mechanism to condition a movement speed on equipped armor weight, so the speed is granted unconditionally; disclosed, not silently wrong.)',
          source: { kind: 'race', refId: 'avariel_elf' }, level: null, actions: [], choices: [], passive: true,
          effects: [{ type: 'grant_movement', target: 'movement', operation: 'add', value: null, condition: null, movementType: 'fly', movementRange: 30 }],
        },
      ],
    },
    {
      id: 'grugach_elf', name: 'Grugach Elf', parentId: 'elf', srd: false,
      features: [
        {
          id: 'grugach_asi', name: 'Ability Score Increase',
          description: 'Your Strength score increases by 1.',
          source: { kind: 'race', refId: 'grugach_elf' }, level: null, actions: [], choices: [], passive: true,
          effects: [{ type: 'stat_modifier', target: 'str', operation: 'add', value: 1, condition: null }],
        },
        {
          id: 'grugach_weapon_training', name: 'Grugach Weapon Training',
          description: 'You have proficiency with the spear, shortbow, longbow, and net.',
          source: { kind: 'race', refId: 'grugach_elf' }, level: null, actions: [], choices: [], passive: true,
          effects: [
            { type: 'grant_proficiency', target: 'weapon:spear', operation: 'add', value: null, condition: null },
            { type: 'grant_proficiency', target: 'weapon:shortbow', operation: 'add', value: null, condition: null },
            { type: 'grant_proficiency', target: 'weapon:longbow', operation: 'add', value: null, condition: null },
            { type: 'grant_proficiency', target: 'weapon:net', operation: 'add', value: null, condition: null },
          ],
        },
        {
          id: 'grugach_cantrip', name: 'Cantrip',
          description: 'You know one cantrip of your choice from the druid spell list. Wisdom is your spellcasting ability for it.',
          source: { kind: 'race', refId: 'grugach_elf' }, level: null, effects: [], actions: [], choices: [], passive: true,
        },
        {
          id: 'grugach_languages', name: 'Languages',
          description: 'Unlike other elves, you don\'t speak, read, or write Common. You instead speak, read, and write Sylvan.',
          source: { kind: 'race', refId: 'grugach_elf' }, level: null, effects: [], actions: [], choices: [], passive: true,
        },
      ],
    },
    // Reconciled from the "Partially Official races" vault folder as Elf
    // subraces (both use the classic Mordenkainen's Tome of Foes stat
    // blocks — simpler, fixed ASI, no new mechanism needed — rather than
    // the alternate flexible-ASI drafts also present in those notes).
    {
      id: 'sea_elf', name: 'Sea Elf', parentId: 'elf', srd: false, replacesBaseFeatureIds: ['elf_asi'],
      features: [
        {
          id: 'sea_elf_asi', name: 'Ability Score Increase',
          description: 'Your Dexterity score increases by 2, and your Constitution score increases by 1.',
          source: { kind: 'race', refId: 'sea_elf' }, level: null, actions: [], choices: [], passive: true,
          effects: [
            { type: 'stat_modifier', target: 'dex', operation: 'add', value: 2, condition: null },
            { type: 'stat_modifier', target: 'con', operation: 'add', value: 1, condition: null },
          ],
        },
        {
          id: 'sea_elf_training', name: 'Sea Elf Training',
          description: 'You have proficiency with the spear, trident, light crossbow, and net.',
          source: { kind: 'race', refId: 'sea_elf' }, level: null, actions: [], choices: [], passive: true,
          effects: [
            { type: 'grant_proficiency', target: 'weapon:spear', operation: 'add', value: null, condition: null },
            { type: 'grant_proficiency', target: 'weapon:trident', operation: 'add', value: null, condition: null },
            { type: 'grant_proficiency', target: 'weapon:light_crossbow', operation: 'add', value: null, condition: null },
            { type: 'grant_proficiency', target: 'weapon:net', operation: 'add', value: null, condition: null },
          ],
        },
        {
          id: 'child_of_the_sea', name: 'Child of the Sea',
          description: 'You have a swimming speed of 30 feet, and you can breathe air and water. (The swim speed is real; "can breathe water" has no dedicated mechanism and is tracked for reference only.)',
          source: { kind: 'race', refId: 'sea_elf' }, level: null, actions: [], choices: [], passive: true,
          effects: [{ type: 'grant_movement', target: 'movement', operation: 'add', value: null, condition: null, movementType: 'swim', movementRange: 30 }],
        },
        {
          id: 'friend_of_the_sea', name: 'Friend of the Sea',
          description: 'Using gestures and sounds, you can communicate simple ideas with any beast that has an innate swimming speed.',
          source: { kind: 'race', refId: 'sea_elf' }, level: null, effects: [], actions: [], choices: [], passive: true,
        },
      ],
    },
    {
      id: 'eladrin', name: 'Eladrin', parentId: 'elf', srd: false, replacesBaseFeatureIds: ['elf_asi'],
      // Season is a same-screen "pick 1 of 4, get a Feature" choice — the
      // same shape ancestryChoice already models, reused here even though
      // it's flavor (not a lineage) since the resulting Fey Step bonus
      // effect can't be mechanically modeled anyway (no teleport-trigger
      // system, and it's gated to 3rd level — see the note on each option).
      ancestryChoice: {
        prompt: 'Choose your season — Autumn, Winter, Spring, or Summer. Determines a bonus effect on Fey Step at 3rd level (reference only, see below).',
        options: (['Autumn', 'Winter', 'Spring', 'Summer'] as const).map(season => ({
          id: season.toLowerCase(), name: season,
          blurb: `${season} eladrin — Fey Step gains a ${season.toLowerCase()}-themed bonus at 3rd level (reference only).`,
          feature: {
            id: `eladrin_season_${season.toLowerCase()}`, name: `Season: ${season}`,
            description: `At 3rd level, your Fey Step gains a ${season} effect (DC = 8 + proficiency bonus + Charisma modifier) — this app doesn't yet support level-gated racial features, so this is tracked for reference only.`,
            source: { kind: 'race', refId: 'eladrin' }, level: null, effects: [], actions: [], choices: [], passive: true,
          },
        })),
      },
      features: [
        {
          id: 'eladrin_asi', name: 'Ability Score Increase',
          description: 'Your Dexterity score increases by 2, and your Charisma score increases by 1.',
          source: { kind: 'race', refId: 'eladrin' }, level: null, actions: [], choices: [], passive: true,
          effects: [
            { type: 'stat_modifier', target: 'dex', operation: 'add', value: 2, condition: null },
            { type: 'stat_modifier', target: 'cha', operation: 'add', value: 1, condition: null },
          ],
        },
        {
          id: 'fey_step', name: 'Fey Step',
          description: 'As a bonus action, you can magically teleport up to 30 feet to an unoccupied space you can see. Once per short or long rest. (No teleport/repositioning mechanic — the resource is tracked, but using it has no automated effect.)',
          source: { kind: 'race', refId: 'eladrin' }, level: null, actions: [], choices: [], passive: false,
          effects: [],
          activation: { actionType: 'bonus_action', resourceCost: { resourceId: 'fey_step_pool', quantity: 1 }, range: '30 feet', target: 'self', requiresSave: null },
        },
      ],
      resources: [
        { resourceId: 'fey_step_pool', name: 'Fey Step', maximum: 1, recharge: 'short_rest' },
      ],
    },
  ],
};

export const raceDwarf: Race = {
  id: 'dwarf',
  name: 'Dwarf',
  srd: true,
  features: [
    {
      id: 'dwarf_asi',
      name: 'Ability Score Increase',
      description: 'Your Constitution score increases by 2.',
      source: { kind: 'race', refId: 'dwarf' },
      level: null, actions: [], choices: [], passive: true,
      effects: [
        { type: 'stat_modifier', target: 'con', operation: 'add', value: 2, condition: null },
      ],
    },
    {
      id: 'dwarf_speed',
      name: 'Speed',
      description: 'Your base walking speed is 25 feet. Your speed is not reduced by wearing heavy armor.',
      source: { kind: 'race', refId: 'dwarf' },
      level: null, actions: [], choices: [], passive: true,
      effects: [
        { type: 'stat_modifier', target: 'speed', operation: 'set', value: 25, condition: null },
      ],
    },
    {
      id: 'dwarf_darkvision',
      name: 'Darkvision',
      description: 'You can see in dim light within 60 feet as if it were bright light, and in darkness as if it were dim light.',
      source: { kind: 'race', refId: 'dwarf' },
      level: null, effects: [{ type: 'grant_sense', target: 'sense', operation: 'add', value: null, condition: null, senseType: 'darkvision', senseRange: 60 }], actions: [], choices: [], passive: true,
    },
    {
      id: 'dwarf_resilience',
      name: 'Dwarven Resilience',
      description: 'You have advantage on saving throws against poison, and you have resistance against poison damage.',
      source: { kind: 'race', refId: 'dwarf' },
      level: null, actions: [], choices: [], passive: true,
      effects: [
        { type: 'grant_resistance', target: 'poison', operation: 'resistance', value: null, condition: null },
      ],
    },
    {
      id: 'dwarf_stonecunning',
      name: 'Stonecunning',
      description: 'Whenever you make a History check related to the origin of stonework, you are considered proficient in the History skill and add double your proficiency bonus.',
      source: { kind: 'race', refId: 'dwarf' },
      level: null, effects: [], actions: [], choices: [], passive: true,
    },
    {
      id: 'dwarf_tool_proficiency',
      name: 'Tool Proficiency',
      description: 'You gain proficiency with the artisan\'s tools of your choice: smith\'s tools, brewer\'s supplies, or mason\'s tools. (No tool-choice-of-N resolution screen exists yet — same gap as feat choices — so this isn\'t applied mechanically.)',
      source: { kind: 'race', refId: 'dwarf' },
      level: null, effects: [], actions: [], choices: [], passive: true,
    },
    {
      id: 'dwarf_combat_training',
      name: 'Dwarven Combat Training',
      description: 'You have proficiency with the battleaxe, handaxe, light hammer, and warhammer.',
      source: { kind: 'race', refId: 'dwarf' },
      level: null, actions: [], choices: [], passive: true,
      effects: [
        { type: 'grant_proficiency', target: 'weapon:battleaxe', operation: 'add', value: null, condition: null },
        { type: 'grant_proficiency', target: 'weapon:handaxe', operation: 'add', value: null, condition: null },
        { type: 'grant_proficiency', target: 'weapon:light_hammer', operation: 'add', value: null, condition: null },
        { type: 'grant_proficiency', target: 'weapon:warhammer', operation: 'add', value: null, condition: null },
      ],
    },
  ],
  subraces: [
    {
      id: 'hill_dwarf', name: 'Hill Dwarf', parentId: 'dwarf', srd: true,
      features: [
        {
          id: 'hill_dwarf_asi',
          name: 'Ability Score Increase',
          description: 'Your Wisdom score increases by 1.',
          source: { kind: 'race', refId: 'hill_dwarf' },
          level: null, actions: [], choices: [], passive: true,
          effects: [{ type: 'stat_modifier', target: 'wis', operation: 'add', value: 1, condition: null }],
        },
        {
          id: 'dwarven_toughness',
          name: 'Dwarven Toughness',
          description: 'Your hit point maximum increases by 1, and it increases by 1 every time you gain a level.',
          source: { kind: 'race', refId: 'hill_dwarf' },
          level: null, effects: [], actions: [], choices: [], passive: true,
        },
      ],
    },
    {
      id: 'mountain_dwarf', name: 'Mountain Dwarf', parentId: 'dwarf', srd: true,
      features: [
        {
          id: 'mountain_dwarf_asi',
          name: 'Ability Score Increase',
          description: 'Your Strength score increases by 2.',
          source: { kind: 'race', refId: 'mountain_dwarf' },
          level: null, actions: [], choices: [], passive: true,
          effects: [{ type: 'stat_modifier', target: 'str', operation: 'add', value: 2, condition: null }],
        },
        {
          id: 'dwarven_armor_training',
          name: 'Dwarven Armor Training',
          description: 'You have proficiency with light and medium armor.',
          source: { kind: 'race', refId: 'mountain_dwarf' },
          level: null, actions: [], choices: [], passive: true,
          effects: [
            { type: 'grant_proficiency', target: 'armor:light', operation: 'add', value: null, condition: null },
            { type: 'grant_proficiency', target: 'armor:medium', operation: 'add', value: null, condition: null },
          ],
        },
      ],
    },
    // Eberron: Rising from the Last War — dragonmark. Neither of Wards and
    // Seals' innate spells (Alarm, Mage Armor) is a cantrip — this app's
    // only working "cast a spell without a slot" mechanism is grant_spell's
    // cantripIds, so there's nothing here to grant for real (unlike Mark of
    // Shadow's Minor Illusion or Mark of Scribing's Message elsewhere) —
    // fully flavor-only, disclosed.
    {
      id: 'mark_of_warding', name: 'Mark of Warding', parentId: 'dwarf', srd: false,
      features: [
        {
          id: 'mark_of_warding_asi', name: 'Ability Score Increase',
          description: 'Your Intelligence score increases by 1.',
          source: { kind: 'race', refId: 'mark_of_warding' }, level: null, actions: [], choices: [], passive: true,
          effects: [{ type: 'stat_modifier', target: 'int', operation: 'add', value: 1, condition: null }],
        },
        {
          id: 'warders_intuition', name: "Warder's Intuition",
          description: 'Whenever you roll an Intelligence (Investigation) check or an ability check with thieves\' tools, roll a d4 and add it to the total. (No mechanism for a random per-check bonus — not applied mechanically.)',
          source: { kind: 'race', refId: 'mark_of_warding' }, level: null, effects: [], actions: [], choices: [], passive: true,
        },
        {
          id: 'wards_and_seals', name: 'Wards and Seals',
          description: 'You can cast Alarm and Mage Armor with this trait, without material components. At 3rd level you can also cast Arcane Lock. Once you cast either spell with this trait, you can\'t cast it again until you finish a long rest. Intelligence is your spellcasting ability for these spells. (Neither spell is a cantrip — this app has no mechanism to grant a limited-use LEVELED spell without a slot, so none of this is applied mechanically.)',
          source: { kind: 'race', refId: 'mark_of_warding' }, level: null, effects: [], actions: [], choices: [], passive: true,
        },
        {
          id: 'mark_of_warding_spells', name: 'Spells of the Mark',
          description: 'If you have the Spellcasting or Pact Magic class feature, Alarm, Armor of Agathys, Arcane Lock, Knock, Glyph of Warding, Magic Circle, Leomund\'s Secret Chest, Mordenkainen\'s Faithful Hound, and Antilife Shell are added to your class\'s spell list. (No mechanism to add spells to a class spell list — not applied mechanically, tracked for reference.)',
          source: { kind: 'race', refId: 'mark_of_warding' }, level: null, effects: [], actions: [], choices: [], passive: true,
        },
      ],
    },
    // Plane Shift: Kaladesh (MTG crossover) — presented as a complete
    // alternate Dwarf writeup (its own 2-stat ASI, all of Hill Dwarf's
    // traits plus expanded tool proficiency), not a small additive split.
    {
      id: 'kaladesh_dwarf', name: 'Kaladesh Dwarf', parentId: 'dwarf', srd: false,
      replacesBaseFeatureIds: ['dwarf_asi'],
      features: [
        {
          id: 'kaladesh_dwarf_asi', name: 'Ability Score Increase',
          description: 'Your Constitution score increases by 2, and your Wisdom score increases by 1.',
          source: { kind: 'race', refId: 'kaladesh_dwarf' }, level: null, actions: [], choices: [], passive: true,
          effects: [
            { type: 'stat_modifier', target: 'con', operation: 'add', value: 2, condition: null },
            { type: 'stat_modifier', target: 'wis', operation: 'add', value: 1, condition: null },
          ],
        },
        {
          id: 'kaladesh_dwarven_toughness', name: 'Dwarven Toughness',
          description: 'Your hit point maximum increases by 1, and it increases by 1 every time you gain a level. (No mechanism for a per-level-scaling HP bonus outside the normal HP-gain formula — not applied mechanically, same gap as Hill Dwarf\'s identical trait.)',
          source: { kind: 'race', refId: 'kaladesh_dwarf' }, level: null, effects: [], actions: [], choices: [], passive: true,
        },
        {
          id: 'artisans_expertise', name: "Artisan's Expertise",
          description: 'You gain proficiency with two kinds of artisan\'s tools of your choice, and your proficiency bonus is doubled for checks using either. Whenever you make an Intelligence (History) check about an architectural construction, you\'re considered proficient and add double your proficiency bonus. (Tool CHOICE and the expertise doubling have no mechanism yet — same gap as Dwarf\'s base Tool Proficiency and Stonecunning — not applied mechanically.)',
          source: { kind: 'race', refId: 'kaladesh_dwarf' }, level: null, effects: [], actions: [], choices: [], passive: true,
        },
      ],
    },
  ],
};

export const raceHalfling: Race = {
  id: 'halfling',
  name: 'Halfling',
  srd: true,
  features: [
    {
      id: 'halfling_asi',
      name: 'Ability Score Increase',
      description: 'Your Dexterity score increases by 2.',
      source: { kind: 'race', refId: 'halfling' },
      level: null, actions: [], choices: [], passive: true,
      effects: [
        { type: 'stat_modifier', target: 'dex', operation: 'add', value: 2, condition: null },
      ],
    },
    {
      id: 'halfling_speed',
      name: 'Speed',
      description: 'Your base walking speed is 25 feet.',
      source: { kind: 'race', refId: 'halfling' },
      level: null, actions: [], choices: [], passive: true,
      effects: [
        { type: 'stat_modifier', target: 'speed', operation: 'set', value: 25, condition: null },
      ],
    },
    {
      id: 'halfling_lucky',
      name: 'Lucky',
      description: 'When you roll a 1 on the d20 for an attack roll, ability check, or saving throw, you can reroll the die and must use the new roll.',
      source: { kind: 'race', refId: 'halfling' },
      level: null, effects: [], actions: [], choices: [], passive: true,
    },
    {
      id: 'halfling_brave',
      name: 'Brave',
      description: 'You have advantage on saving throws against being frightened.',
      source: { kind: 'race', refId: 'halfling' },
      level: null, effects: [], actions: [], choices: [], passive: true,
    },
    {
      id: 'halfling_nimbleness',
      name: 'Halfling Nimbleness',
      description: 'You can move through the space of any creature that is of a size larger than yours.',
      source: { kind: 'race', refId: 'halfling' },
      level: null, effects: [], actions: [], choices: [], passive: true,
    },
  ],
  subraces: [
    {
      id: 'lightfoot_halfling', name: 'Lightfoot Halfling', parentId: 'halfling', srd: true,
      features: [
        {
          id: 'lightfoot_asi',
          name: 'Ability Score Increase',
          description: 'Your Charisma score increases by 1.',
          source: { kind: 'race', refId: 'lightfoot_halfling' },
          level: null, actions: [], choices: [], passive: true,
          effects: [{ type: 'stat_modifier', target: 'cha', operation: 'add', value: 1, condition: null }],
        },
        {
          id: 'naturally_stealthy',
          name: 'Naturally Stealthy',
          description: 'You can attempt to hide even when you are obscured only by a creature that is at least one size larger than you.',
          source: { kind: 'race', refId: 'lightfoot_halfling' },
          level: null, effects: [], actions: [], choices: [], passive: true,
        },
      ],
    },
    {
      id: 'stout_halfling', name: 'Stout Halfling', parentId: 'halfling', srd: true,
      features: [
        {
          id: 'stout_asi',
          name: 'Ability Score Increase',
          description: 'Your Constitution score increases by 1.',
          source: { kind: 'race', refId: 'stout_halfling' },
          level: null, actions: [], choices: [], passive: true,
          effects: [{ type: 'stat_modifier', target: 'con', operation: 'add', value: 1, condition: null }],
        },
        {
          id: 'stout_resilience',
          name: 'Stout Resilience',
          description: 'You have advantage on saving throws against poison, and you have resistance against poison damage.',
          source: { kind: 'race', refId: 'stout_halfling' },
          level: null, actions: [], choices: [], passive: true,
          effects: [{ type: 'grant_resistance', target: 'poison', operation: 'resistance', value: null, condition: null }],
        },
      ],
    },
    // Sword Coast Adventurer's Guide
    {
      id: 'ghostwise_halfling', name: 'Ghostwise Halfling', parentId: 'halfling', srd: false,
      features: [
        {
          id: 'ghostwise_asi', name: 'Ability Score Increase',
          description: 'Your Wisdom score increases by 1.',
          source: { kind: 'race', refId: 'ghostwise_halfling' }, level: null, actions: [], choices: [], passive: true,
          effects: [{ type: 'stat_modifier', target: 'wis', operation: 'add', value: 1, condition: null }],
        },
        {
          id: 'silent_speech', name: 'Silent Speech',
          description: 'You can speak telepathically to any creature within 30 feet of you (it must share a language with you to understand). One creature at a time. (No telepathy mechanic exists — not applied mechanically.)',
          source: { kind: 'race', refId: 'ghostwise_halfling' }, level: null, effects: [], actions: [], choices: [], passive: true,
        },
      ],
    },
    // Explorer's Guide to Wildemount
    {
      id: 'lotusden_halfling', name: 'Lotusden Halfling', parentId: 'halfling', srd: false,
      features: [
        {
          id: 'lotusden_asi', name: 'Ability Score Increase',
          description: 'Your Wisdom score increases by 1.',
          source: { kind: 'race', refId: 'lotusden_halfling' }, level: null, actions: [], choices: [], passive: true,
          effects: [{ type: 'stat_modifier', target: 'wis', operation: 'add', value: 1, condition: null }],
        },
        {
          id: 'children_of_the_woods', name: 'Children of the Woods',
          description: 'You know the Druidcraft cantrip. Wisdom is your spellcasting ability for it. At 3rd level you can cast Entangle once, and at 5th level Spike Growth once, each recharging on a long rest — this app doesn\'t yet support level-gated racial features, so only the 1st-level cantrip is granted for real.',
          source: { kind: 'race', refId: 'lotusden_halfling' }, level: null, actions: [], choices: [], passive: true,
          effects: [
            { type: 'grant_spell', target: 'spell', operation: 'add', value: null, condition: null, cantripIds: ['druidcraft'], spellcastingAbility: 'wis' },
          ],
        },
        {
          id: 'timberwalk', name: 'Timberwalk',
          description: 'Ability checks made to track you have disadvantage, and you can move through non-magical difficult terrain made of plants/overgrowth without extra cost. (No mechanism for conditional disadvantage on OTHER creatures\' checks, or for terrain-specific movement cost reduction — not applied mechanically.)',
          source: { kind: 'race', refId: 'lotusden_halfling' }, level: null, effects: [], actions: [], choices: [], passive: true,
        },
      ],
    },
    // Eberron: Rising from the Last War — dragonmarks
    {
      id: 'mark_of_hospitality', name: 'Mark of Hospitality', parentId: 'halfling', srd: false,
      features: [
        {
          id: 'mark_of_hospitality_asi', name: 'Ability Score Increase',
          description: 'Your Charisma score increases by 1.',
          source: { kind: 'race', refId: 'mark_of_hospitality' }, level: null, actions: [], choices: [], passive: true,
          effects: [{ type: 'stat_modifier', target: 'cha', operation: 'add', value: 1, condition: null }],
        },
        {
          id: 'ever_hospitable', name: 'Ever Hospitable',
          description: 'Whenever you roll a Charisma (Persuasion) check or an ability check with brewer\'s tools or cook\'s utensils, roll a d4 and add it to the total. (No mechanism for a random per-check bonus — not applied mechanically.)',
          source: { kind: 'race', refId: 'mark_of_hospitality' }, level: null, effects: [], actions: [], choices: [], passive: true,
        },
        {
          id: 'innkeepers_magic', name: "Innkeeper's Magic",
          description: 'You know the Prestidigitation cantrip. Charisma is your spellcasting ability for it. You can also cast Purify Food and Drink and Unseen Servant with this trait, each once per long rest — this app doesn\'t yet support a limited-use LEVELED spell without a slot, so only the 1st-level cantrip is granted for real.',
          source: { kind: 'race', refId: 'mark_of_hospitality' }, level: null, actions: [], choices: [], passive: true,
          effects: [
            { type: 'grant_spell', target: 'spell', operation: 'add', value: null, condition: null, cantripIds: ['prestidigitation'], spellcastingAbility: 'cha' },
          ],
        },
        {
          id: 'mark_of_hospitality_spells', name: 'Spells of the Mark',
          description: 'If you have the Spellcasting or Pact Magic class feature, Goodberry, Sleep, Aid, Calm Emotions, Create Food and Water, Leomund\'s Tiny Hut, Aura of Purity, Mordenkainen\'s Private Sanctum, and Hallow are added to your class\'s spell list. (No mechanism to add spells to a class spell list — not applied mechanically, tracked for reference.)',
          source: { kind: 'race', refId: 'mark_of_hospitality' }, level: null, effects: [], actions: [], choices: [], passive: true,
        },
      ],
    },
    {
      id: 'mark_of_healing', name: 'Mark of Healing', parentId: 'halfling', srd: false,
      features: [
        {
          id: 'mark_of_healing_asi', name: 'Ability Score Increase',
          description: 'Your Wisdom score increases by 1.',
          source: { kind: 'race', refId: 'mark_of_healing' }, level: null, actions: [], choices: [], passive: true,
          effects: [{ type: 'stat_modifier', target: 'wis', operation: 'add', value: 1, condition: null }],
        },
        {
          id: 'medical_intuition', name: 'Medical Intuition',
          description: 'Whenever you roll a Wisdom (Medicine) check or an ability check with an herbalism kit, roll a d4 and add it to the total. (No mechanism for a random per-check bonus — not applied mechanically.)',
          source: { kind: 'race', refId: 'mark_of_healing' }, level: null, effects: [], actions: [], choices: [], passive: true,
        },
        {
          id: 'healing_touch', name: 'Healing Touch',
          description: 'You can cast Cure Wounds with this trait, once per long rest. At 3rd level you can also cast Lesser Restoration. Wisdom is your spellcasting ability for these spells. (Neither is a cantrip — this app has no mechanism to grant a limited-use LEVELED spell without a slot, so none of this is applied mechanically.)',
          source: { kind: 'race', refId: 'mark_of_healing' }, level: null, effects: [], actions: [], choices: [], passive: true,
        },
        {
          id: 'mark_of_healing_spells', name: 'Spells of the Mark',
          description: 'If you have the Spellcasting or Pact Magic class feature, Cure Wounds, Healing Word, Lesser Restoration, Prayer of Healing, Aura of Vitality, Mass Healing Word, Aura of Purity, Aura of Life, and Greater Restoration are added to your class\'s spell list. (No mechanism to add spells to a class spell list — not applied mechanically, tracked for reference.)',
          source: { kind: 'race', refId: 'mark_of_healing' }, level: null, effects: [], actions: [], choices: [], passive: true,
        },
      ],
    },
  ],
};

/**
 * Builds one PHB Draconic Ancestry option — a dragon color's Feature,
 * combining the passive Damage Resistance effect with the active Breath
 * Weapon ability in one Feature (same "passive + active on one Feature"
 * shape Rage already uses). Breath weapon damage is the flat level-1 value
 * (2d6) — this app has no mechanism yet for a single ability's dice to
 * scale with character level (true of cantrip scaling too, not unique to
 * this trait), so the 6th/11th/16th-level increases (3d6/4d6/5d6) are
 * disclosed in the description as reference-only, not mechanically applied.
 * The save DC (8 + proficiency bonus + CON modifier) has no formula slot in
 * requiresSave for a non-spellcaster DC — same convention Blood Hunter's
 * Hemocraft save DC already uses — so requiresSave is null and the DC is
 * spelled out in the description instead.
 */
function draconicAncestryOption(
  id: string, name: string, damageType: string,
  shape: '5 by 30 ft. line' | '15 ft. cone', saveAbility: 'DEX' | 'CON',
): AncestryOption {
  return {
    id, name, blurb: `${damageType[0].toUpperCase()}${damageType.slice(1)} damage, ${shape} breath weapon, ${saveAbility} save.`,
    feature: {
      id: `dragonborn_breath_${id}`,
      name: 'Breath Weapon',
      description: `You can use your action to exhale ${damageType} energy in a ${shape} (${saveAbility} save, DC = 8 + proficiency bonus + Constitution modifier). Each creature in the area takes 2d6 ${damageType} damage on a failed save, half as much on a success — this increases to 3d6 at 6th level, 4d6 at 11th, and 5d6 at 16th. You also have resistance to ${damageType} damage. Once used, the breath weapon can't be used again until you finish a short or long rest.`,
      source: { kind: 'race', refId: 'dragonborn' },
      level: null, actions: [], choices: [], passive: false,
      effects: [
        { type: 'grant_resistance', target: damageType, operation: 'resistance', value: null, condition: null },
      ],
      activation: {
        actionType: 'action',
        resourceCost: { resourceId: 'dragonborn_breath_pool', quantity: 1 },
        range: shape,
        target: 'area',
        requiresSave: null,
      },
      abilityEffects: [
        { type: 'damage', dice: '2d6', damageType, saveOnSuccess: 'half' },
      ],
    },
  };
}

/**
 * Builds one Fizban's Treasury of Dragons ancestry option (Chromatic/
 * Metallic/Gem Dragonborn each choose from their own 5-color list — a
 * SUBRACE-level ancestryChoice that overrides the base 10-color PHB one,
 * not a variant of it). Mechanically simplified in the same two disclosed
 * ways as the PHB version above: flat level-1 damage die (1d10, not the
 * RAW 2d10/3d10/4d10 scaling at 5th/11th/17th) and a fixed resourceCost
 * (2 uses, this app's level-1-baseline convention) rather than RAW's
 * "uses = proficiency bonus" formula, since ResourceGrant.maximum has no
 * formula slot. Both disclosed in the description text. Each subrace's
 * unique 5th-level bonus trait (Chromatic Warding / Metallic Breath Weapon
 * / Gem Flight) is authored separately as a flavor-only Feature — this app
 * has no mechanism to gate a RACIAL feature's activation to a later
 * character level (only class progressions support per-level grants), so
 * granting it for real here would incorrectly make it active from level 1.
 */
function fizbanAncestryOption(id: string, name: string, damageType: string, poolId: string): AncestryOption {
  return {
    id, name, blurb: `${damageType[0].toUpperCase()}${damageType.slice(1)} damage, 15 ft. cone breath weapon, DEX save.`,
    feature: {
      id: `${poolId}_${id}`,
      name: 'Breath Weapon',
      description: `When you take the Attack action, you can replace one of your attacks with an exhalation of ${damageType} energy in a 15-foot cone (DEX save, DC = 8 + proficiency bonus + Constitution modifier). Each creature in the area takes 1d10 ${damageType} damage on a failed save, half as much on a success — this increases to 2d10 at 5th level, 3d10 at 11th, and 4d10 at 17th. You also have resistance to ${damageType} damage. You can use this a number of times equal to your proficiency bonus (this app tracks a fixed pool of 2, the 1st-level value); all uses return on a long rest.`,
      source: { kind: 'race', refId: 'dragonborn' },
      level: null, actions: [], choices: [], passive: false,
      effects: [
        { type: 'grant_resistance', target: damageType, operation: 'resistance', value: null, condition: null },
      ],
      activation: {
        actionType: 'action',
        resourceCost: { resourceId: poolId, quantity: 1 },
        range: '15 ft. cone',
        target: 'area',
        requiresSave: null,
      },
      abilityEffects: [
        { type: 'damage', dice: '1d10', damageType, saveOnSuccess: 'half' },
      ],
    },
  };
}

/** Flavor-only Feature for a 5th-level Fizban's Dragonborn bonus trait — see fizbanAncestryOption's doc comment for why this isn't a real mechanical grant. */
function fizbanFifthLevelNote(id: string, name: string, description: string): Feature {
  return {
    id, name,
    description: `${description} (Unlocks at 5th level — this app doesn't yet support level-gated racial features, so this is tracked for reference only and isn't automatically active.)`,
    source: { kind: 'race', refId: 'dragonborn' },
    level: null, effects: [], actions: [], choices: [], passive: true,
  };
}

export const raceDragonborn: Race = {
  id: 'dragonborn',
  name: 'Dragonborn',
  srd: true,
  // PHB Dragonborn is already a complete race — Draconblood/Ravenite below
  // are optional Wildemount variants, not a mandatory split (unlike Elf/
  // Dwarf/Halfling/Gnome, where every subrace is itself required).
  subracesOptional: true,
  resources: [
    { resourceId: 'dragonborn_breath_pool', name: 'Breath Weapon', maximum: 1, recharge: 'short_rest' },
  ],
  ancestryChoice: {
    prompt: 'Choose a type of dragon. This determines the damage type and shape of your Breath Weapon, and the type of damage you resist.',
    options: [
      draconicAncestryOption('black', 'Black', 'acid', '5 by 30 ft. line', 'DEX'),
      draconicAncestryOption('blue', 'Blue', 'lightning', '5 by 30 ft. line', 'DEX'),
      draconicAncestryOption('brass', 'Brass', 'fire', '5 by 30 ft. line', 'DEX'),
      draconicAncestryOption('bronze', 'Bronze', 'lightning', '5 by 30 ft. line', 'DEX'),
      draconicAncestryOption('copper', 'Copper', 'acid', '5 by 30 ft. line', 'DEX'),
      draconicAncestryOption('gold', 'Gold', 'fire', '15 ft. cone', 'DEX'),
      draconicAncestryOption('green', 'Green', 'poison', '15 ft. cone', 'CON'),
      draconicAncestryOption('red', 'Red', 'fire', '15 ft. cone', 'DEX'),
      draconicAncestryOption('silver', 'Silver', 'cold', '15 ft. cone', 'CON'),
      draconicAncestryOption('white', 'White', 'cold', '15 ft. cone', 'CON'),
    ],
  },
  features: [
    {
      id: 'dragonborn_asi',
      name: 'Ability Score Increase',
      description: 'Your Strength score increases by 2 and your Charisma score increases by 1.',
      source: { kind: 'race', refId: 'dragonborn' },
      level: null, actions: [], choices: [], passive: true,
      effects: [
        { type: 'stat_modifier', target: 'str', operation: 'add', value: 2, condition: null },
        { type: 'stat_modifier', target: 'cha', operation: 'add', value: 1, condition: null },
      ],
    },
  ],
  // Explorer's Guide to Wildemount subraces — each replaces PHB Dragonborn's
  // Ability Score Increase (and, per the book, "Damage Resistance", which in
  // this app's model lives inside the ancestryChoice Feature rather than a
  // separate base-race Feature; the ancestryChoice's resistance/breath
  // weapon are unaffected and still chosen normally alongside either
  // subrace).
  subraces: [
    {
      id: 'draconblood', name: 'Draconblood', parentId: 'dragonborn', srd: false, replacesBaseFeatureIds: ['dragonborn_asi'],
      features: [
        {
          id: 'draconblood_asi', name: 'Ability Score Increase',
          description: 'Your Intelligence score increases by 2, and your Charisma score increases by 1.',
          source: { kind: 'race', refId: 'draconblood' }, level: null, actions: [], choices: [], passive: true,
          effects: [
            { type: 'stat_modifier', target: 'int', operation: 'add', value: 2, condition: null },
            { type: 'stat_modifier', target: 'cha', operation: 'add', value: 1, condition: null },
          ],
        },
        {
          id: 'draconblood_darkvision', name: 'Darkvision',
          description: 'You can see in dim light within 60 feet as if it were bright light, and in darkness as if it were dim light.',
          source: { kind: 'race', refId: 'draconblood' }, level: null, effects: [{ type: 'grant_sense', target: 'sense', operation: 'add', value: null, condition: null, senseType: 'darkvision', senseRange: 60 }], actions: [], choices: [], passive: true,
        },
        {
          id: 'draconblood_forceful_presence', name: 'Forceful Presence',
          description: 'Once per long rest, you can make an Intimidation or Persuasion check with advantage.',
          source: { kind: 'race', refId: 'draconblood' }, level: null, effects: [], actions: [], choices: [], passive: true,
        },
      ],
    },
    {
      id: 'ravenite', name: 'Ravenite', parentId: 'dragonborn', srd: false, replacesBaseFeatureIds: ['dragonborn_asi'],
      features: [
        {
          id: 'ravenite_asi', name: 'Ability Score Increase',
          description: 'Your Strength score increases by 2, and your Constitution score increases by 1.',
          source: { kind: 'race', refId: 'ravenite' }, level: null, actions: [], choices: [], passive: true,
          effects: [
            { type: 'stat_modifier', target: 'str', operation: 'add', value: 2, condition: null },
            { type: 'stat_modifier', target: 'con', operation: 'add', value: 1, condition: null },
          ],
        },
        {
          id: 'ravenite_darkvision', name: 'Darkvision',
          description: 'You can see in dim light within 60 feet as if it were bright light, and in darkness as if it were dim light.',
          source: { kind: 'race', refId: 'ravenite' }, level: null, effects: [{ type: 'grant_sense', target: 'sense', operation: 'add', value: null, condition: null, senseType: 'darkvision', senseRange: 60 }], actions: [], choices: [], passive: true,
        },
        {
          id: 'ravenite_vengeful_assault', name: 'Vengeful Assault',
          description: 'Once per short or long rest, when you take damage from a creature within range of a weapon you\'re wielding, you can use your reaction to attack that creature.',
          source: { kind: 'race', refId: 'ravenite' }, level: null, effects: [], actions: [], choices: [], passive: true,
        },
      ],
    },
    // Fizban's Treasury of Dragons — the modern, definitive Dragonborn
    // writeup for these three color families. Each has its own 5-color
    // ancestryChoice (overriding the base 10-color one — see
    // Subrace.ancestryChoice), its own flexible ASI, and replaces the base
    // ASI entirely.
    {
      id: 'chromatic_dragonborn', name: 'Chromatic Dragonborn', parentId: 'dragonborn', srd: false,
      replacesBaseFeatureIds: ['dragonborn_asi'],
      flexibleAsi: {
        prompt: 'Increase one ability score by 2 and a different one by 1, or increase three different ability scores by 1.',
        mode: { kind: 'two_one_or_three_one' },
      },
      ancestryChoice: {
        prompt: 'Choose a chromatic dragon. This determines your Breath Weapon\'s damage type and shape, and the type of damage you resist.',
        options: [
          fizbanAncestryOption('black', 'Black', 'acid', 'chromatic_breath_pool'),
          fizbanAncestryOption('blue', 'Blue', 'lightning', 'chromatic_breath_pool'),
          fizbanAncestryOption('green', 'Green', 'poison', 'chromatic_breath_pool'),
          fizbanAncestryOption('red', 'Red', 'fire', 'chromatic_breath_pool'),
          fizbanAncestryOption('white', 'White', 'cold', 'chromatic_breath_pool'),
        ],
      },
      resources: [
        { resourceId: 'chromatic_breath_pool', name: 'Breath Weapon', maximum: 2, recharge: 'long_rest' },
      ],
      features: [
        fizbanFifthLevelNote(
          'chromatic_warding', 'Chromatic Warding',
          'As an action, you can channel your draconic energy to become immune to the damage type of your Chromatic Ancestry for 1 minute. Once per long rest.',
        ),
      ],
    },
    {
      id: 'metallic_dragonborn', name: 'Metallic Dragonborn', parentId: 'dragonborn', srd: false,
      replacesBaseFeatureIds: ['dragonborn_asi'],
      flexibleAsi: {
        prompt: 'Increase one ability score by 2 and a different one by 1, or increase three different ability scores by 1.',
        mode: { kind: 'two_one_or_three_one' },
      },
      ancestryChoice: {
        prompt: 'Choose a metallic dragon. This determines your Breath Weapon\'s damage type and shape, and the type of damage you resist.',
        options: [
          fizbanAncestryOption('brass', 'Brass', 'fire', 'metallic_breath_pool'),
          fizbanAncestryOption('bronze', 'Bronze', 'lightning', 'metallic_breath_pool'),
          fizbanAncestryOption('copper', 'Copper', 'acid', 'metallic_breath_pool'),
          fizbanAncestryOption('gold', 'Gold', 'fire', 'metallic_breath_pool'),
          fizbanAncestryOption('silver', 'Silver', 'cold', 'metallic_breath_pool'),
        ],
      },
      resources: [
        { resourceId: 'metallic_breath_pool', name: 'Breath Weapon', maximum: 2, recharge: 'long_rest' },
      ],
      features: [
        fizbanFifthLevelNote(
          'metallic_breath_weapon', 'Metallic Breath Weapon',
          'You gain a second breath weapon: a 15-foot cone (DC = 8 + proficiency bonus + Constitution modifier) that either incapacitates creatures until the start of your next turn (CON save) or pushes them 20 feet away and knocks them prone (STR save), your choice each use. Once per long rest.',
        ),
      ],
    },
    {
      id: 'gem_dragonborn', name: 'Gem Dragonborn', parentId: 'dragonborn', srd: false,
      replacesBaseFeatureIds: ['dragonborn_asi'],
      flexibleAsi: {
        prompt: 'Increase one ability score by 2 and a different one by 1, or increase three different ability scores by 1.',
        mode: { kind: 'two_one_or_three_one' },
      },
      ancestryChoice: {
        prompt: 'Choose a gem dragon. This determines your Breath Weapon\'s damage type and shape, and the type of damage you resist.',
        options: [
          fizbanAncestryOption('amethyst', 'Amethyst', 'force', 'gem_breath_pool'),
          fizbanAncestryOption('crystal', 'Crystal', 'radiant', 'gem_breath_pool'),
          fizbanAncestryOption('emerald', 'Emerald', 'psychic', 'gem_breath_pool'),
          fizbanAncestryOption('sapphire', 'Sapphire', 'thunder', 'gem_breath_pool'),
          fizbanAncestryOption('topaz', 'Topaz', 'necrotic', 'gem_breath_pool'),
        ],
      },
      resources: [
        { resourceId: 'gem_breath_pool', name: 'Breath Weapon', maximum: 2, recharge: 'long_rest' },
      ],
      features: [
        {
          id: 'psionic_mind', name: 'Psionic Mind',
          description: 'You can telepathically speak to any creature you can see within 30 feet of you. You don\'t need to share a language with the creature, but it must be able to understand at least one language.',
          source: { kind: 'race', refId: 'gem_dragonborn' },
          level: null, effects: [], actions: [], choices: [], passive: true,
        },
        fizbanFifthLevelNote(
          'gem_flight', 'Gem Flight',
          'As a bonus action, you can manifest spectral gem-colored wings for 1 minute, gaining a flying speed equal to your walking speed and the ability to hover. Once per long rest.',
        ),
      ],
    },
  ],
};

export const raceGnome: Race = {
  id: 'gnome',
  name: 'Gnome',
  srd: true,
  features: [
    {
      id: 'gnome_asi',
      name: 'Ability Score Increase',
      description: 'Your Intelligence score increases by 2.',
      source: { kind: 'race', refId: 'gnome' },
      level: null, actions: [], choices: [], passive: true,
      effects: [
        { type: 'stat_modifier', target: 'int', operation: 'add', value: 2, condition: null },
      ],
    },
    {
      id: 'gnome_speed',
      name: 'Speed',
      description: 'Your base walking speed is 25 feet.',
      source: { kind: 'race', refId: 'gnome' },
      level: null, actions: [], choices: [], passive: true,
      effects: [
        { type: 'stat_modifier', target: 'speed', operation: 'set', value: 25, condition: null },
      ],
    },
    {
      id: 'gnome_darkvision',
      name: 'Darkvision',
      description: 'You can see in dim light within 60 feet as if it were bright light, and in darkness as if it were dim light.',
      source: { kind: 'race', refId: 'gnome' },
      level: null, effects: [{ type: 'grant_sense', target: 'sense', operation: 'add', value: null, condition: null, senseType: 'darkvision', senseRange: 60 }], actions: [], choices: [], passive: true,
    },
    {
      id: 'gnome_cunning',
      name: 'Gnome Cunning',
      description: 'You have advantage on all Intelligence, Wisdom, and Charisma saving throws against magic.',
      source: { kind: 'race', refId: 'gnome' },
      level: null, effects: [], actions: [], choices: [], passive: true,
    },
  ],
  subraces: [
    {
      id: 'forest_gnome', name: 'Forest Gnome', parentId: 'gnome', srd: true,
      features: [
        {
          id: 'forest_gnome_asi', name: 'Ability Score Increase',
          description: 'Your Dexterity score increases by 1.',
          source: { kind: 'race', refId: 'forest_gnome' }, level: null, actions: [], choices: [], passive: true,
          effects: [{ type: 'stat_modifier', target: 'dex', operation: 'add', value: 1, condition: null }],
        },
        {
          id: 'natural_illusionist', name: 'Natural Illusionist',
          description: 'You know the Minor Illusion cantrip. Intelligence is your spellcasting ability for it.',
          source: { kind: 'race', refId: 'forest_gnome' }, level: null, actions: [], choices: [], passive: true,
          effects: [
            { type: 'grant_spell', target: 'spell', operation: 'add', value: null, condition: null, cantripIds: ['minor_illusion'], spellcastingAbility: 'int' },
          ],
        },
        {
          id: 'speak_with_small_beasts', name: 'Speak with Small Beasts',
          description: 'Through sound and gestures, you can communicate simple ideas with Small or smaller beasts.',
          source: { kind: 'race', refId: 'forest_gnome' }, level: null, effects: [], actions: [], choices: [], passive: true,
        },
      ],
    },
    {
      id: 'rock_gnome', name: 'Rock Gnome', parentId: 'gnome', srd: true,
      features: [
        {
          id: 'rock_gnome_asi', name: 'Ability Score Increase',
          description: 'Your Constitution score increases by 1.',
          source: { kind: 'race', refId: 'rock_gnome' }, level: null, actions: [], choices: [], passive: true,
          effects: [{ type: 'stat_modifier', target: 'con', operation: 'add', value: 1, condition: null }],
        },
        {
          id: 'artificers_lore', name: "Artificer's Lore",
          description: 'Whenever you make an Intelligence (History) check related to magical, alchemical, or technological items, you can add twice your proficiency bonus, instead of any other proficiency bonus you normally apply.',
          source: { kind: 'race', refId: 'rock_gnome' }, level: null, effects: [], actions: [], choices: [], passive: true,
        },
        {
          id: 'gnome_tinker', name: 'Tinker',
          description: "You have proficiency with tinker's tools. Using them, you can spend 1 hour and 10 gp of materials to construct a Tiny clockwork device (AC 5, 1 hp) — a clockwork toy, a fire starter, or a music box — that stops functioning after 24 hours unless you spend 1 hour maintaining it, or when you dismantle it to reclaim the materials. You can have up to three devices active at once.",
          source: { kind: 'race', refId: 'rock_gnome' }, level: null, actions: [], choices: [], passive: true,
          effects: [
            { type: 'grant_proficiency', target: 'tool:tinkers_tools', operation: 'add', value: null, condition: null },
          ],
        },
      ],
    },
  ],
};

export const raceHalfElf: Race = {
  id: 'half_elf',
  name: 'Half-Elf',
  srd: true,
  flexibleAsi: {
    prompt: 'Two other ability scores of your choice each increase by 1.',
    mode: { kind: 'two_distinct_plus_one', exclude: ['cha'] },
  },
  // Half-Elf Versatility was previously hardcoded as "2 skills of your
  // choice" only — RAW is actually a choice among 7 different traits,
  // reflecting which elf lineage (or none) the half-elf favors. Reuses the
  // ancestryChoice mechanism (a "pick 1 of N, get a Feature or queued
  // choice" shape, not just for literal ancestries — see Eladrin's season).
  ancestryChoice: {
    prompt: 'Choose your Half-Elf Versatility trait.',
    options: [
      {
        id: 'skill_versatility', name: 'Skill Versatility', blurb: 'Proficiency in two skills of your choice.',
        pendingChoice: {
          id: `${RACE_CHOICE_PREFIX}half_elf_skills`,
          prompt: 'Choose two skills to gain proficiency in.',
          kind: 'skill', count: 2, pool: ALL_SKILL_OPTIONS,
          grants: [], required: true, resolved: false,
        },
      },
      { id: 'elf_weapon_training_heritage', name: 'Elf Weapon Training (High/Wood Elf Heritage)', blurb: 'Proficiency with longsword, shortsword, shortbow, longbow.', feature: elfWeaponTraining('half_elf') },
      {
        id: 'cantrip_heritage', name: 'Cantrip (High Elf Heritage)', blurb: 'One cantrip of your choice from the wizard spell list.',
        feature: {
          id: 'half_elf_cantrip_heritage', name: 'Cantrip',
          description: 'You know one cantrip of your choice from the wizard spell list. Intelligence is your spellcasting ability for it.',
          source: { kind: 'race', refId: 'half_elf' }, level: null, effects: [], actions: [], choices: [], passive: true,
        },
      },
      {
        id: 'fleet_of_foot_heritage', name: 'Fleet of Foot (Wood Elf Heritage)', blurb: 'Base walking speed increases to 35 feet.',
        feature: {
          id: 'half_elf_fleet_of_foot', name: 'Fleet of Foot',
          description: 'Your base walking speed increases to 35 feet.',
          source: { kind: 'race', refId: 'half_elf' }, level: null, actions: [], choices: [], passive: true,
          effects: [{ type: 'stat_modifier', target: 'speed', operation: 'set', value: 35, condition: null }],
        },
      },
      {
        id: 'mask_of_the_wild_heritage', name: 'Mask of the Wild (Wood Elf Heritage)', blurb: 'Hide even when only lightly obscured by natural phenomena.',
        feature: {
          id: 'half_elf_mask_of_the_wild', name: 'Mask of the Wild',
          description: 'You can attempt to hide even when you are only lightly obscured by foliage, heavy rain, falling snow, mist, and other natural phenomena.',
          source: { kind: 'race', refId: 'half_elf' }, level: null, effects: [], actions: [], choices: [], passive: true,
        },
      },
      {
        id: 'drow_magic_heritage', name: 'Drow Magic (Dark Elf Heritage)', blurb: 'Know Dancing Lights; 3rd/5th level bonus spells are reference-only.',
        feature: {
          id: 'half_elf_drow_magic', name: 'Drow Magic',
          description: 'You know the Dancing Lights cantrip. Charisma is your spellcasting ability for it. At 3rd level you can cast Faerie Fire once, and at 5th level Darkness once, each recharging on a long rest — this app doesn\'t yet support level-gated racial features, so only the cantrip is granted for real.',
          source: { kind: 'race', refId: 'half_elf' }, level: null, actions: [], choices: [], passive: true,
          effects: [{ type: 'grant_spell', target: 'spell', operation: 'add', value: null, condition: null, cantripIds: ['dancing_lights'], spellcastingAbility: 'cha' }],
        },
      },
      {
        id: 'swim_speed_heritage', name: 'Swim Speed (Aquatic Elf Heritage)', blurb: 'Real 30ft swimming speed.',
        feature: {
          id: 'half_elf_swim_speed', name: 'Swim Speed',
          description: 'You have a swimming speed of 30 feet.',
          source: { kind: 'race', refId: 'half_elf' }, level: null, actions: [], choices: [], passive: true,
          effects: [{ type: 'grant_movement', target: 'movement', operation: 'add', value: null, condition: null, movementType: 'swim', movementRange: 30 }],
        },
      },
    ],
  },
  features: [
    {
      id: 'half_elf_asi',
      name: 'Ability Score Increase',
      description: 'Your Charisma score increases by 2, and two other ability scores of your choice each increase by 1.',
      source: { kind: 'race', refId: 'half_elf' },
      level: null, actions: [], choices: [], passive: true,
      effects: [
        { type: 'stat_modifier', target: 'cha', operation: 'add', value: 2, condition: null },
      ],
    },
    {
      id: 'half_elf_darkvision',
      name: 'Darkvision',
      description: 'You can see in dim light within 60 feet as if it were bright light, and in darkness as if it were dim light.',
      source: { kind: 'race', refId: 'half_elf' },
      level: null, effects: [{ type: 'grant_sense', target: 'sense', operation: 'add', value: null, condition: null, senseType: 'darkvision', senseRange: 60 }], actions: [], choices: [], passive: true,
    },
    {
      id: 'half_elf_fey_ancestry',
      name: 'Fey Ancestry',
      description: 'You have advantage on saving throws against being charmed, and magic can\'t put you to sleep.',
      source: { kind: 'race', refId: 'half_elf' },
      level: null, effects: [], actions: [], choices: [], passive: true,
    },
  ],
  // Eberron: Rising from the Last War — dragonmarks. Both replace the base
  // ASI AND Half-Elf Versatility (the empty ancestryChoice below suppresses
  // the base race's Versatility picker, since these have fixed traits
  // instead — see Subrace.ancestryChoice's override semantics).
  subracesOptional: true,
  subraces: [
    {
      id: 'mark_of_detection', name: 'Mark of Detection', parentId: 'half_elf', srd: false,
      replacesBaseFeatureIds: ['half_elf_asi'],
      ancestryChoice: { prompt: '', options: [] },
      features: [
        {
          id: 'mark_of_detection_asi', name: 'Ability Score Increase',
          description: 'Your Wisdom score increases by 2, and one other ability score of your choice increases by 1. (The +1-to-one-other-ability choice has no mechanism yet for this exact "+2 fixed, +1 player choice" shape — only the fixed WIS+2 is applied mechanically.)',
          source: { kind: 'race', refId: 'mark_of_detection' }, level: null, actions: [], choices: [], passive: true,
          effects: [{ type: 'stat_modifier', target: 'wis', operation: 'add', value: 2, condition: null }],
        },
        {
          id: 'deductive_intuition', name: 'Deductive Intuition',
          description: 'Whenever you roll an Intelligence (Investigation) or Wisdom (Insight) check, roll a d4 and add it to the total. (No mechanism for a random per-check bonus — not applied mechanically.)',
          source: { kind: 'race', refId: 'mark_of_detection' }, level: null, effects: [], actions: [], choices: [], passive: true,
        },
        {
          id: 'magical_detection', name: 'Magical Detection',
          description: 'You can cast Detect Magic and Detect Poison and Disease with this trait, without material components. At 3rd level you can also cast See Invisibility. Once you cast either spell with this trait, you can\'t cast it again until you finish a long rest. Intelligence is your spellcasting ability for these spells. (Neither spell is a cantrip — this app has no mechanism to grant a limited-use LEVELED spell without a slot, so none of this is applied mechanically.)',
          source: { kind: 'race', refId: 'mark_of_detection' }, level: null, effects: [], actions: [], choices: [], passive: true,
        },
        {
          id: 'mark_of_detection_spells', name: 'Spells of the Mark',
          description: 'If you have the Spellcasting or Pact Magic class feature, Detect Magic, Detect Poison and Disease, Detect Thoughts, Find Traps, Clairvoyance, Nondetection, Arcane Eye, Divination, and Legend Lore are added to your class\'s spell list. (No mechanism to add spells to a class spell list — not applied mechanically, tracked for reference.)',
          source: { kind: 'race', refId: 'mark_of_detection' }, level: null, effects: [], actions: [], choices: [], passive: true,
        },
      ],
    },
    {
      id: 'mark_of_storm', name: 'Mark of Storm', parentId: 'half_elf', srd: false,
      replacesBaseFeatureIds: ['half_elf_asi'],
      ancestryChoice: { prompt: '', options: [] },
      features: [
        {
          id: 'mark_of_storm_asi', name: 'Ability Score Increase',
          description: 'Your Charisma score increases by 2, and your Dexterity score increases by 1.',
          source: { kind: 'race', refId: 'mark_of_storm' }, level: null, actions: [], choices: [], passive: true,
          effects: [
            { type: 'stat_modifier', target: 'cha', operation: 'add', value: 2, condition: null },
            { type: 'stat_modifier', target: 'dex', operation: 'add', value: 1, condition: null },
          ],
        },
        {
          id: 'windwrights_intuition', name: "Windwright's Intuition",
          description: 'Whenever you roll a Dexterity (Acrobatics) check or an ability check with navigator\'s tools, roll a d4 and add it to the total. (No mechanism for a random per-check bonus — not applied mechanically.)',
          source: { kind: 'race', refId: 'mark_of_storm' }, level: null, effects: [], actions: [], choices: [], passive: true,
        },
        {
          id: 'storms_boon', name: "Storm's Boon",
          description: 'You have resistance to lightning damage.',
          source: { kind: 'race', refId: 'mark_of_storm' }, level: null, actions: [], choices: [], passive: true,
          effects: [{ type: 'grant_resistance', target: 'lightning', operation: 'resistance', value: null, condition: null }],
        },
        {
          id: 'headwinds', name: 'Headwinds',
          description: 'You know the Gust cantrip. Charisma is your spellcasting ability for it. At 3rd level you can also cast Gust of Wind once, recharging on a long rest — this app doesn\'t yet support level-gated racial features, so only the cantrip is granted for real.',
          source: { kind: 'race', refId: 'mark_of_storm' }, level: null, actions: [], choices: [], passive: true,
          effects: [{ type: 'grant_spell', target: 'spell', operation: 'add', value: null, condition: null, cantripIds: ['gust'], spellcastingAbility: 'cha' }],
        },
        {
          id: 'mark_of_storm_spells', name: 'Spells of the Mark',
          description: 'If you have the Spellcasting or Pact Magic class feature, Feather Fall, Fog Cloud, Gust of Wind, Levitate, Sleet Storm, Wind Wall, Conjure Minor Elementals, Control Water, and Conjure Elemental are added to your class\'s spell list. (No mechanism to add spells to a class spell list — not applied mechanically, tracked for reference.)',
          source: { kind: 'race', refId: 'mark_of_storm' }, level: null, effects: [], actions: [], choices: [], passive: true,
        },
      ],
    },
  ],
};

export const raceHalfOrc: Race = {
  id: 'half_orc',
  name: 'Half-Orc',
  srd: true,
  features: [
    {
      id: 'half_orc_asi',
      name: 'Ability Score Increase',
      description: 'Your Strength score increases by 2 and your Constitution score increases by 1.',
      source: { kind: 'race', refId: 'half_orc' },
      level: null, actions: [], choices: [], passive: true,
      effects: [
        { type: 'stat_modifier', target: 'str', operation: 'add', value: 2, condition: null },
        { type: 'stat_modifier', target: 'con', operation: 'add', value: 1, condition: null },
      ],
    },
    {
      id: 'half_orc_darkvision',
      name: 'Darkvision',
      description: 'You can see in dim light within 60 feet as if it were bright light, and in darkness as if it were dim light.',
      source: { kind: 'race', refId: 'half_orc' },
      level: null, effects: [{ type: 'grant_sense', target: 'sense', operation: 'add', value: null, condition: null, senseType: 'darkvision', senseRange: 60 }], actions: [], choices: [], passive: true,
    },
    {
      id: 'half_orc_menacing',
      name: 'Menacing',
      description: 'You gain proficiency in the Intimidation skill.',
      source: { kind: 'race', refId: 'half_orc' },
      level: null, actions: [], choices: [], passive: true,
      effects: [
        { type: 'grant_proficiency', target: 'skill:intimidation', operation: 'add', value: null, condition: null },
      ],
    },
    {
      id: 'half_orc_relentless_endurance',
      name: 'Relentless Endurance',
      description: 'When you are reduced to 0 hit points but not killed outright, you can drop to 1 hit point instead. Once you use this trait, you can\'t use it again until you finish a long rest.',
      source: { kind: 'race', refId: 'half_orc' },
      level: null, effects: [], actions: [], choices: [], passive: false,
    },
    {
      id: 'half_orc_savage_attacks',
      name: 'Savage Attacks',
      description: 'When you score a critical hit with a melee weapon attack, you can roll one of the weapon\'s damage dice one additional time and add it to the extra damage of the critical hit.',
      source: { kind: 'race', refId: 'half_orc' },
      level: null, effects: [], actions: [], choices: [], passive: true,
    },
  ],
  // Eberron: Rising from the Last War — dragonmark. Replaces every base
  // trait except Age/Alignment/Size/Speed per the source text (Darkvision
  // is re-listed there too, at the same 60ft value — redeclared here for
  // completeness even though the practical effect is identical).
  subracesOptional: true,
  subraces: [
    {
      id: 'mark_of_finding', name: 'Mark of Finding', parentId: 'half_orc', srd: false,
      replacesBaseFeatureIds: [
        'half_orc_asi', 'half_orc_darkvision', 'half_orc_menacing',
        'half_orc_relentless_endurance', 'half_orc_savage_attacks',
      ],
      features: [
        {
          id: 'mark_of_finding_asi', name: 'Ability Score Increase',
          description: 'Your Wisdom score increases by 2, and your Constitution score increases by 1.',
          source: { kind: 'race', refId: 'mark_of_finding' }, level: null, actions: [], choices: [], passive: true,
          effects: [
            { type: 'stat_modifier', target: 'wis', operation: 'add', value: 2, condition: null },
            { type: 'stat_modifier', target: 'con', operation: 'add', value: 1, condition: null },
          ],
        },
        {
          id: 'mark_of_finding_darkvision', name: 'Darkvision',
          description: 'You can see in dim light within 60 feet as if it were bright light, and in darkness as if it were dim light.',
          source: { kind: 'race', refId: 'mark_of_finding' }, level: null, actions: [], choices: [], passive: true,
          effects: [{ type: 'grant_sense', target: 'sense', operation: 'add', value: null, condition: null, senseType: 'darkvision', senseRange: 60 }],
        },
        {
          id: 'hunters_intuition', name: "Hunter's Intuition",
          description: 'Whenever you roll a Wisdom (Perception) or Wisdom (Survival) check, roll a d4 and add it to the total. (No mechanism for a random per-check bonus — not applied mechanically.)',
          source: { kind: 'race', refId: 'mark_of_finding' }, level: null, effects: [], actions: [], choices: [], passive: true,
        },
        {
          id: 'finders_magic', name: "Finder's Magic",
          description: 'You can cast Hunter\'s Mark with this trait, once per long rest. At 3rd level you can also cast Locate Object. Wisdom is your spellcasting ability for these spells. (Neither is a cantrip — this app has no mechanism to grant a limited-use LEVELED spell without a slot, so none of this is applied mechanically.)',
          source: { kind: 'race', refId: 'mark_of_finding' }, level: null, effects: [], actions: [], choices: [], passive: true,
        },
        {
          id: 'mark_of_finding_spells', name: 'Spells of the Mark',
          description: 'If you have the Spellcasting or Pact Magic class feature, Faerie Fire, Longstrider, Locate Animals or Plants, Locate Object, Clairvoyance, Speak with Plants, Divination, Locate Creature, and Commune with Nature are added to your class\'s spell list. (No mechanism to add spells to a class spell list — not applied mechanically, tracked for reference.)',
          source: { kind: 'race', refId: 'mark_of_finding' }, level: null, effects: [], actions: [], choices: [], passive: true,
        },
      ],
    },
  ],
};

export const raceTiefling: Race = {
  id: 'tiefling',
  name: 'Tiefling',
  srd: true,
  features: [
    {
      id: 'tiefling_asi',
      name: 'Ability Score Increase',
      description: 'Your Intelligence score increases by 1 and your Charisma score increases by 2.',
      source: { kind: 'race', refId: 'tiefling' },
      level: null, actions: [], choices: [], passive: true,
      effects: [
        { type: 'stat_modifier', target: 'int', operation: 'add', value: 1, condition: null },
        { type: 'stat_modifier', target: 'cha', operation: 'add', value: 2, condition: null },
      ],
    },
    {
      id: 'tiefling_darkvision',
      name: 'Darkvision',
      description: 'You can see in dim light within 60 feet as if it were bright light, and in darkness as if it were dim light.',
      source: { kind: 'race', refId: 'tiefling' },
      level: null, effects: [{ type: 'grant_sense', target: 'sense', operation: 'add', value: null, condition: null, senseType: 'darkvision', senseRange: 60 }], actions: [], choices: [], passive: true,
    },
    {
      id: 'tiefling_hellish_resistance',
      name: 'Hellish Resistance',
      description: 'You have resistance to fire damage.',
      source: { kind: 'race', refId: 'tiefling' },
      level: null, actions: [], choices: [], passive: true,
      effects: [
        { type: 'grant_resistance', target: 'fire', operation: 'resistance', value: null, condition: null },
      ],
    },
    {
      id: 'tiefling_infernal_legacy',
      name: 'Infernal Legacy',
      description: 'You know the Thaumaturgy cantrip. Charisma is your spellcasting ability for it. At 3rd level, you can cast Hellish Rebuke once as a 2nd-level spell, and at 5th level Darkness once, each recharging on a long rest — this app doesn\'t yet support level-gated racial features, so only the 1st-level cantrip is granted for real.',
      source: { kind: 'race', refId: 'tiefling' },
      level: null, actions: [], choices: [], passive: true,
      effects: [
        { type: 'grant_spell', target: 'spell', operation: 'add', value: null, condition: null, cantripIds: ['thaumaturgy'], spellcastingAbility: 'cha' },
      ],
    },
  ],
  // This is the PHB default "Bloodline of Asmodeus" — the 7 MTOF bloodlines
  // below are optional alternatives, each replacing both the base ASI and
  // Infernal Legacy (not selecting one of these subraces just keeps the
  // Asmodeus baseline above, same subracesOptional pattern as Dragonborn).
  subracesOptional: true,
  subraces: [
    tieflingBloodline('bloodline_of_baalzebul', 'Bloodline of Baalzebul', 'int', 'thaumaturgy', 'Legacy of Maladomini', 'Ray of Sickness (3rd level, as a 2nd-level spell), Crown of Madness (5th level)'),
    tieflingBloodline('bloodline_of_dispater', 'Bloodline of Dispater', 'dex', 'thaumaturgy', 'Legacy of Dis', 'Disguise Self (3rd level, as a 2nd-level spell), Detect Thoughts (5th level)'),
    tieflingBloodline('bloodline_of_fierna', 'Bloodline of Fierna', 'wis', 'friends', 'Legacy of Phlegethos', 'Charm Person (3rd level, as a 2nd-level spell), Suggestion (5th level)'),
    tieflingBloodline('bloodline_of_glasya', 'Bloodline of Glasya', 'dex', 'minor_illusion', 'Legacy of Malbolge', 'Disguise Self (3rd level, as a 2nd-level spell), Invisibility (5th level, as a 2nd-level spell)'),
    tieflingBloodline('bloodline_of_levistus', 'Bloodline of Levistus', 'con', 'ray_of_frost', 'Legacy of Stygia', 'Armor of Agathys (3rd level, as a 2nd-level spell), Darkness (5th level)'),
    tieflingBloodline('bloodline_of_mammon', 'Bloodline of Mammon', 'int', 'mage_hand', 'Legacy of Minauros', "Tenser's Floating Disk (3rd level, as a 2nd-level spell), Arcane Lock (5th level)"),
    tieflingBloodline('bloodline_of_mephistopheles', 'Bloodline of Mephistopheles', 'int', 'mage_hand', 'Legacy of Cania', 'Burning Hands (3rd level, as a 2nd-level spell), Flame Blade (5th level, as a 3rd-level spell)'),
    tieflingBloodline('bloodline_of_zariel', 'Bloodline of Zariel', 'str', 'thaumaturgy', 'Legacy of Avernus', 'Searing Smite (3rd level, as a 2nd-level spell), Branding Smite (5th level, as a 3rd-level spell)'),
    // Sword Coast Adventurer's Guide — Feral (fixed) + one of the three
    // mutually-exclusive Infernal Legacy replacements, modeled as an
    // ancestryChoice since the source presents them as alternate picks.
    // (RAW technically lets a DM permit these as independent toggles rather
    // than a forced pick — simplified to "pick exactly one" here, disclosed.)
    {
      id: 'variant_tiefling', name: 'Variant Tiefling (Feral)', parentId: 'tiefling', srd: false,
      replacesBaseFeatureIds: ['tiefling_asi', 'tiefling_infernal_legacy'],
      ancestryChoice: {
        prompt: 'Choose your Infernal Legacy replacement — Devil\'s Tongue, Hellfire, or Winged.',
        options: [
          {
            id: 'devils_tongue', name: "Devil's Tongue", blurb: 'Know Vicious Mockery; 3rd/5th level bonus spells are reference-only.',
            feature: {
              id: 'devils_tongue_feature', name: "Devil's Tongue",
              description: 'You know the Vicious Mockery cantrip. Charisma is your spellcasting ability for it. At 3rd level you can cast Charm Person once as a 2nd-level spell, and at 5th level Enthrall once, each recharging on a long rest — this app doesn\'t yet support level-gated racial features, so only the cantrip is granted for real.',
              source: { kind: 'race', refId: 'variant_tiefling' }, level: null, actions: [], choices: [], passive: true,
              effects: [{ type: 'grant_spell', target: 'spell', operation: 'add', value: null, condition: null, cantripIds: ['vicious_mockery'], spellcastingAbility: 'cha' }],
            },
          },
          {
            id: 'hellfire', name: 'Hellfire', blurb: 'A 3rd-level bonus spell only — nothing to grant at 1st level.',
            feature: {
              id: 'hellfire_feature', name: 'Hellfire',
              description: 'At 3rd level, you can cast Burning Hands once as a 2nd-level spell, recharging on a long rest — this app doesn\'t yet support level-gated racial features, so this has no 1st-level effect and isn\'t applied mechanically yet.',
              source: { kind: 'race', refId: 'variant_tiefling' }, level: null, effects: [], actions: [], choices: [], passive: true,
            },
          },
          {
            id: 'winged', name: 'Winged', blurb: 'Real 30ft fly speed (while not wearing heavy armor — unconditional here, see note).',
            feature: {
              id: 'winged_feature', name: 'Winged',
              description: 'You have bat-like wings and a flying speed of 30 feet. (RAW: only while not wearing heavy armor — this app has no mechanism to condition a movement speed on equipped armor weight, so it\'s granted unconditionally, disclosed not silent.)',
              source: { kind: 'race', refId: 'variant_tiefling' }, level: null, actions: [], choices: [], passive: true,
              effects: [{ type: 'grant_movement', target: 'movement', operation: 'add', value: null, condition: null, movementType: 'fly', movementRange: 30 }],
            },
          },
        ],
      },
      features: [
        {
          id: 'feral_asi', name: 'Feral',
          description: 'Your Intelligence score increases by 1, and your Dexterity score increases by 2.',
          source: { kind: 'race', refId: 'variant_tiefling' }, level: null, actions: [], choices: [], passive: true,
          effects: [
            { type: 'stat_modifier', target: 'int', operation: 'add', value: 1, condition: null },
            { type: 'stat_modifier', target: 'dex', operation: 'add', value: 2, condition: null },
          ],
        },
      ],
    },
    // Unearthed Arcana 11 — additive (no replacesBaseFeatureIds; keeps the
    // Asmodeus baseline, adds CON+1 on top, matching the source's "these
    // tieflings have the following ADDITIONAL features" framing).
    {
      id: 'abyssal_tiefling', name: 'Abyssal Tiefling', parentId: 'tiefling', srd: false,
      features: [
        {
          id: 'abyssal_asi', name: 'Ability Score Increase',
          description: 'Your Constitution score increases by 1.',
          source: { kind: 'race', refId: 'abyssal_tiefling' }, level: null, actions: [], choices: [], passive: true,
          effects: [{ type: 'stat_modifier', target: 'con', operation: 'add', value: 1, condition: null }],
        },
        {
          id: 'abyssal_arcana', name: 'Abyssal Arcana',
          description: 'Each long rest, you randomly gain a cantrip (and, at 3rd/5th level, a leveled spell) rerolled from a fixed table. (No mechanism for a randomly-rotating, rerolled-per-long-rest spell list — not applied mechanically.)',
          source: { kind: 'race', refId: 'abyssal_tiefling' }, level: null, effects: [], actions: [], choices: [], passive: true,
        },
        {
          id: 'abyssal_fortitude', name: 'Abyssal Fortitude',
          description: 'Your hit point maximum increases by half your level (minimum 1). (No mechanism for a per-level-scaling HP bonus outside the normal HP-gain formula — not applied mechanically, same gap as Dwarven Toughness.)',
          source: { kind: 'race', refId: 'abyssal_tiefling' }, level: null, effects: [], actions: [], choices: [], passive: true,
        },
      ],
    },
  ],
};

// NOT SRD — original homebrew race (references 'Notongue' invented language,
// Abyss Knight-adjacent lore). Not WotC content, so no legal risk, but
// doesn't belong presented as "official" content — same content-honesty
// treatment as the Abyssal Claim spell (see cantrips.ts). Should eventually
// move to an example-homebrew content pack (ROADMAP_1.0.md Step 1.3).
export const raceSkeleton: Race = {
  id: 'skeleton',
  name: 'Skeleton',
  srd: false,
  features: [
    {
      id: 'skeleton_undead_nature',
      name: 'Undead Nature',
      description: "You are the reanimated, fleshless bones of a once-living creature, held together by necromantic magic. You don't need to eat, drink, breathe, or sleep, though you can still do any of these if you wish. You are considered an undead creature for the purposes of effects that interact with that type, such as Turn Undead and many healing spells.",
      source: { kind: 'race', refId: 'skeleton' },
      level: null, effects: [], actions: [], choices: [], passive: true,
    },
    {
      id: 'skeleton_disease_poison_immunity',
      name: 'Disease and Poison Immunity',
      description: 'You are immune to disease and to the poisoned condition, and you have resistance to poison damage.',
      source: { kind: 'race', refId: 'skeleton' },
      level: null, actions: [], choices: [], passive: true,
      effects: [
        { type: 'condition_immunity', target: 'poisoned', operation: 'immunity', value: null, condition: null },
        { type: 'grant_resistance', target: 'poison', operation: 'resistance', value: null, condition: null },
      ],
    },
    {
      id: 'skeleton_doomed_touch',
      name: 'Doomed Touch',
      description: 'You know the chill touch cantrip and can cast it at will, without expending a spell slot. Constitution is your spellcasting ability for it.',
      source: { kind: 'race', refId: 'skeleton' },
      level: null,
      effects: [
        // Grants chill touch as a known cantrip. Initialises spellcasting
        // (CON) if the character has no spellcasting class yet. If they do
        // (e.g. Abyss Knight), chill_touch is added to their existing list.
        {
          type: 'grant_spell',
          cantripIds: ['chill_touch'],
          spellcastingAbility: 'con',
          target: '', operation: 'add', value: null, condition: null,
        } as import('../../engine/types').Effect,
      ],
      actions: [], choices: [], passive: true,
    },
    {
      id: 'skeleton_darkvision',
      name: 'Darkvision',
      description: "Necromancy restored your sight after death. You can see in dim light within 60 feet of you as if it were bright light, and in darkness as if it were dim light. You can't discern color in darkness, only shades of grey.",
      source: { kind: 'race', refId: 'skeleton' },
      level: null, effects: [{ type: 'grant_sense', target: 'sense', operation: 'add', value: null, condition: null, senseType: 'darkvision', senseRange: 60 }], actions: [], choices: [], passive: true,
    },
    {
      id: 'skeleton_might_of_death',
      name: 'Might of Death',
      description: 'You have resistance to necrotic damage.',
      source: { kind: 'race', refId: 'skeleton' },
      level: null, actions: [], choices: [], passive: true,
      effects: [
        { type: 'grant_resistance', target: 'necrotic', operation: 'resistance', value: null, condition: null },
      ],
    },
    {
      id: 'skeleton_languages',
      name: 'Languages',
      description: 'You can speak, read, and write Common and Notongue — the creaking, cracking language of the undead, understood by almost all undead creatures.',
      source: { kind: 'race', refId: 'skeleton' },
      level: null, effects: [], actions: [], choices: [], passive: true,
    },
    {
      id: 'skeleton_restoring_limbs',
      name: 'Restoring Limbs',
      description: 'If one of your limbs is severed or destroyed, you can restore it by finding a suitable replacement limb and spending your action to attach it.',
      source: { kind: 'race', refId: 'skeleton' },
      level: null, effects: [], actions: [], choices: [], passive: true,
    },
  ],
  subraces: [
    {
      id: 'skeleton_giant', name: 'Giant', parentId: 'skeleton', srd: false,
      features: [
        {
          id: 'skeleton_giant_remains',
          name: 'Giant Remains',
          description: 'In life you were a giant, or several lesser skeletons were fused by foul alchemy into a single hulking form. Your size is Large. The considerable strength of your former body carries over and is already reflected in your recorded ability scores. Skeletons of this lineage are simple and straightforward by nature, and often become proud warriors.',
          source: { kind: 'race', refId: 'skeleton_giant' },
          level: null, effects: [], actions: [], choices: [], passive: true,
        },
      ],
    },
  ],
};

/**
 * Every playable race, unfiltered. Prefer ALL_RACES below in app code.
 * (raceSkeleton is intentionally not included here — see its own comment.)
 */
export const FULL_RACE_LIBRARY: Race[] = [
  raceHuman,
  raceElf,
  raceDwarf,
  raceHalfling,
  raceDragonborn,
  raceGnome,
  raceHalfElf,
  raceHalfOrc,
  raceTiefling,
];

const SRD_ONLY = process.env.EXPO_PUBLIC_SRD_ONLY === 'true';

/**
 * The race list the app should use — filtered to srd === true only on the
 * EAS `production` build profile (see eas.json). Personal/dev/preview
 * builds see every race unfiltered, same build-target-aware pattern as
 * spells (Step 1.3) and subclasses. See docs/ROADMAP_1.0.md Phase 1.
 */
export const ALL_RACES: Race[] = SRD_ONLY
  ? FULL_RACE_LIBRARY.filter(r => r.srd === true)
  : FULL_RACE_LIBRARY;
