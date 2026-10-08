// ============================================================================
// FILE: src/content/classes2024/spellLists2024.ts
// The class spell lists of the System Reference Document 5.2.1 (2024 rules), generated from the
// "(Classes)" line of each spell description. SRD 5.2.1 is Creative Commons Attribution 4.0.
// Ids are this app's spell-library ids: the 2024 names that differ from the library's (Fire Bolt is
// `firebolt`, Acid Arrow is `melfs_acid_arrow`, Tiny Hut is `leomunds_tiny_hut`, ...) are mapped. The
// library's spell TEXT is the 2014 text for spells the 2024 rules reworked; only the six spells new in
// 2024 (spells2024.ts) carry 2024 text. A spell id absent from a build's library (the public SRD-only
// build) simply does not resolve.
// ============================================================================
export type SpellListClass = 'bard' | 'cleric' | 'druid' | 'paladin' | 'ranger' | 'sorcerer' | 'warlock' | 'wizard';

/** Spell ids on each class's 2024 list, by spell level (0 = cantrips). */
export const SPELL_LIST_2024: Record<SpellListClass, Record<number, string[]>> = {
  bard: {
    0: ['dancing_lights', 'light', 'mage_hand', 'mending', 'message', 'minor_illusion', 'prestidigitation', 'starry_wisp', 'true_strike', 'vicious_mockery'],
    1: ['animal_friendship', 'bane', 'charm_person', 'color_spray', 'command', 'comprehend_languages', 'cure_wounds', 'detect_magic', 'disguise_self', 'dissonant_whispers', 'faerie_fire', 'feather_fall', 'healing_word', 'heroism', 'hideous_laughter', 'identify', 'illusory_script', 'longstrider', 'silent_image', 'sleep_spell', 'speak_with_animals', 'thunderwave', 'unseen_servant'],
    2: ['aid', 'animal_messenger', 'blindness_deafness', 'calm_emotions', 'detect_thoughts', 'enhance_ability', 'enlarge_reduce', 'enthrall', 'heat_metal', 'hold_person', 'invisibility', 'knock', 'lesser_restoration', 'locate_animals_or_plants', 'locate_object', 'magic_mouth', 'mirror_image', 'phantasmal_force', 'see_invisibility', 'shatter', 'silence', 'suggestion', 'zone_of_truth'],
    3: ['bestow_curse', 'clairvoyance', 'dispel_magic', 'fear', 'glyph_of_warding', 'hypnotic_pattern', 'leomunds_tiny_hut', 'major_image', 'mass_healing_word', 'nondetection', 'plant_growth', 'sending', 'slow', 'speak_with_dead', 'speak_with_plants', 'stinking_cloud', 'tongues'],
    4: ['charm_monster', 'compulsion', 'confusion', 'dimension_door', 'freedom_of_movement', 'greater_invisibility', 'hallucinatory_terrain', 'locate_creature', 'phantasmal_killer', 'polymorph'],
    5: ['animate_objects', 'awaken', 'dominate_person', 'dream', 'geas', 'greater_restoration', 'hold_monster', 'legend_lore', 'mass_cure_wounds', 'mislead', 'modify_memory', 'planar_binding', 'raise_dead', 'rarys_telepathic_bond', 'scrying', 'seeming', 'teleportation_circle'],
    6: ['eyebite', 'find_the_path', 'guards_and_wards', 'heroes_feast', 'mass_suggestion', 'ottos_irresistible_dance', 'programmed_illusion', 'true_seeing'],
    7: ['etherealness', 'forcecage', 'mirage_arcane', 'mordenkainens_magnificent_mansion', 'mordenkainens_sword', 'prismatic_spray', 'project_image', 'regenerate', 'resurrection', 'symbol', 'teleport'],
    8: ['antipathy_sympathy', 'dominate_monster', 'feeblemind', 'glibness', 'mind_blank', 'power_word_stun'],
    9: ['foresight', 'power_word_heal', 'power_word_kill', 'prismatic_wall', 'true_polymorph'],
  },
  cleric: {
    0: ['guidance', 'light', 'mending', 'resistance', 'sacred_flame', 'spare_the_dying', 'thaumaturgy'],
    1: ['bane', 'bless', 'command', 'create_or_destroy_water', 'cure_wounds', 'detect_evil_and_good', 'detect_magic', 'detect_poison_and_disease', 'guiding_bolt', 'healing_word', 'inflict_wounds', 'protection_from_evil_and_good', 'purify_food_and_drink', 'sanctuary', 'shield_of_faith'],
    2: ['aid', 'augury', 'blindness_deafness', 'calm_emotions', 'continual_flame', 'enhance_ability', 'find_traps', 'gentle_repose', 'hold_person', 'lesser_restoration', 'locate_object', 'prayer_of_healing', 'protection_from_poison', 'silence', 'spiritual_weapon', 'warding_bond', 'zone_of_truth'],
    3: ['animate_dead', 'beacon_of_hope', 'bestow_curse', 'clairvoyance', 'create_food_and_water', 'daylight', 'dispel_magic', 'glyph_of_warding', 'magic_circle', 'mass_healing_word', 'meld_into_stone', 'protection_from_energy', 'remove_curse', 'revivify', 'sending', 'speak_with_dead', 'spirit_guardians', 'tongues', 'water_walk'],
    4: ['aura_of_life', 'banishment', 'control_water', 'death_ward', 'divination', 'freedom_of_movement', 'guardian_of_faith', 'locate_creature', 'stone_shape'],
    5: ['commune', 'contagion', 'dispel_evil_and_good', 'flame_strike', 'geas', 'greater_restoration', 'hallow', 'insect_plague', 'legend_lore', 'mass_cure_wounds', 'planar_binding', 'raise_dead', 'scrying'],
    6: ['blade_barrier', 'create_undead', 'find_the_path', 'forbiddance', 'harm', 'heal', 'heroes_feast', 'planar_ally', 'sunbeam', 'true_seeing', 'word_of_recall'],
    7: ['conjure_celestial', 'divine_word', 'etherealness', 'fire_storm', 'plane_shift', 'regenerate', 'resurrection', 'symbol'],
    8: ['antimagic_field', 'control_weather', 'earthquake', 'holy_aura', 'sunburst'],
    9: ['astral_projection', 'gate', 'mass_heal', 'power_word_heal', 'true_resurrection'],
  },
  druid: {
    0: ['druidcraft', 'elementalism', 'guidance', 'mending', 'message', 'poison_spray', 'produce_flame', 'resistance', 'shillelagh', 'spare_the_dying', 'starry_wisp'],
    1: ['animal_friendship', 'charm_person', 'create_or_destroy_water', 'cure_wounds', 'detect_magic', 'detect_poison_and_disease', 'entangle', 'faerie_fire', 'fog_cloud', 'goodberry', 'healing_word', 'ice_knife', 'jump', 'longstrider', 'protection_from_evil_and_good', 'purify_food_and_drink', 'speak_with_animals', 'thunderwave'],
    2: ['aid', 'animal_messenger', 'augury', 'barkskin', 'continual_flame', 'darkvision', 'enhance_ability', 'enlarge_reduce', 'find_traps', 'flame_blade', 'flaming_sphere', 'gust_of_wind', 'heat_metal', 'hold_person', 'lesser_restoration', 'locate_animals_or_plants', 'locate_object', 'moonbeam', 'pass_without_trace', 'protection_from_poison', 'spike_growth'],
    3: ['call_lightning', 'conjure_animals', 'daylight', 'dispel_magic', 'meld_into_stone', 'plant_growth', 'protection_from_energy', 'revivify', 'sleet_storm', 'speak_with_plants', 'water_breathing', 'water_walk', 'wind_wall'],
    4: ['blight', 'charm_monster', 'confusion', 'conjure_minor_elementals', 'conjure_woodland_beings', 'control_water', 'divination', 'dominate_beast', 'fire_shield', 'freedom_of_movement', 'giant_insect', 'hallucinatory_terrain', 'ice_storm', 'locate_creature', 'polymorph', 'stone_shape', 'stoneskin', 'wall_of_fire'],
    5: ['antilife_shell', 'awaken', 'commune_with_nature', 'cone_of_cold', 'conjure_elemental', 'contagion', 'geas', 'greater_restoration', 'insect_plague', 'mass_cure_wounds', 'planar_binding', 'reincarnate', 'scrying', 'tree_stride', 'wall_of_stone'],
    6: ['conjure_fey', 'find_the_path', 'flesh_to_stone', 'heal', 'heroes_feast', 'move_earth', 'sunbeam', 'transport_via_plants', 'wall_of_thorns', 'wind_walk'],
    7: ['fire_storm', 'mirage_arcane', 'plane_shift', 'regenerate', 'reverse_gravity', 'symbol'],
    8: ['animal_shapes', 'antipathy_sympathy', 'control_weather', 'earthquake', 'feeblemind', 'incendiary_cloud', 'sunburst', 'tsunami'],
    9: ['foresight', 'shapechange', 'storm_of_vengeance', 'true_resurrection'],
  },
  paladin: {
    1: ['bless', 'command', 'cure_wounds', 'detect_evil_and_good', 'detect_magic', 'detect_poison_and_disease', 'divine_favor', 'divine_smite', 'heroism', 'protection_from_evil_and_good', 'purify_food_and_drink', 'searing_smite', 'shield_of_faith'],
    2: ['aid', 'find_steed', 'gentle_repose', 'lesser_restoration', 'locate_object', 'magic_weapon', 'prayer_of_healing', 'protection_from_poison', 'shining_smite', 'warding_bond', 'zone_of_truth'],
    3: ['create_food_and_water', 'daylight', 'dispel_magic', 'magic_circle', 'remove_curse', 'revivify'],
    4: ['aura_of_life', 'banishment', 'death_ward', 'locate_creature'],
    5: ['dispel_evil_and_good', 'geas', 'greater_restoration', 'raise_dead'],
  },
  ranger: {
    1: ['alarm', 'animal_friendship', 'cure_wounds', 'detect_magic', 'detect_poison_and_disease', 'ensnaring_strike', 'entangle', 'fog_cloud', 'goodberry', 'hunters_mark', 'jump', 'longstrider', 'speak_with_animals'],
    2: ['aid', 'animal_messenger', 'barkskin', 'darkvision', 'enhance_ability', 'find_traps', 'gust_of_wind', 'lesser_restoration', 'locate_animals_or_plants', 'locate_object', 'magic_weapon', 'pass_without_trace', 'protection_from_poison', 'silence', 'spike_growth'],
    3: ['conjure_animals', 'daylight', 'dispel_magic', 'meld_into_stone', 'nondetection', 'plant_growth', 'protection_from_energy', 'revivify', 'speak_with_plants', 'water_breathing', 'water_walk', 'wind_wall'],
    4: ['conjure_woodland_beings', 'dominate_beast', 'freedom_of_movement', 'locate_creature', 'stoneskin'],
    5: ['commune_with_nature', 'greater_restoration', 'tree_stride'],
  },
  sorcerer: {
    0: ['acid_splash', 'chill_touch', 'dancing_lights', 'elementalism', 'firebolt', 'light', 'mage_hand', 'mending', 'message', 'minor_illusion', 'poison_spray', 'prestidigitation', 'ray_of_frost', 'shocking_grasp', 'sorcerous_burst', 'true_strike'],
    1: ['burning_hands', 'charm_person', 'chromatic_orb', 'color_spray', 'comprehend_languages', 'detect_magic', 'disguise_self', 'expeditious_retreat', 'false_life', 'feather_fall', 'fog_cloud', 'grease', 'ice_knife', 'jump', 'mage_armor', 'magic_missile', 'ray_of_sickness', 'shield', 'silent_image', 'sleep_spell', 'thunderwave'],
    2: ['alter_self', 'blindness_deafness', 'blur', 'darkness', 'darkvision', 'detect_thoughts', 'dragons_breath', 'enhance_ability', 'enlarge_reduce', 'flame_blade', 'flaming_sphere', 'gust_of_wind', 'hold_person', 'invisibility', 'knock', 'levitate', 'magic_weapon', 'mind_spike', 'mirror_image', 'misty_step', 'phantasmal_force', 'scorching_ray', 'see_invisibility', 'shatter', 'spider_climb', 'suggestion', 'web'],
    3: ['blink', 'clairvoyance', 'counterspell', 'daylight', 'dispel_magic', 'fear', 'fireball', 'fly', 'gaseous_form', 'haste', 'hypnotic_pattern', 'lightning_bolt', 'major_image', 'protection_from_energy', 'sleet_storm', 'slow', 'stinking_cloud', 'tongues', 'vampiric_touch', 'water_breathing', 'water_walk'],
    4: ['banishment', 'blight', 'charm_monster', 'confusion', 'dimension_door', 'dominate_beast', 'fire_shield', 'greater_invisibility', 'ice_storm', 'polymorph', 'stoneskin', 'vitriolic_sphere', 'wall_of_fire'],
    5: ['animate_objects', 'bigbys_hand', 'cloudkill', 'cone_of_cold', 'creation', 'dominate_person', 'hold_monster', 'insect_plague', 'seeming', 'telekinesis', 'teleportation_circle', 'wall_of_stone'],
    6: ['chain_lightning', 'circle_of_death', 'disintegrate', 'eyebite', 'flesh_to_stone', 'globe_of_invulnerability', 'mass_suggestion', 'move_earth', 'otilukes_freezing_sphere', 'sunbeam', 'true_seeing'],
    7: ['delayed_blast_fireball', 'etherealness', 'finger_of_death', 'fire_storm', 'plane_shift', 'prismatic_spray', 'reverse_gravity', 'teleport'],
    8: ['demiplane', 'dominate_monster', 'earthquake', 'incendiary_cloud', 'power_word_stun', 'sunburst'],
    9: ['gate', 'meteor_swarm', 'power_word_kill', 'time_stop', 'wish'],
  },
  warlock: {
    0: ['chill_touch', 'eldritch_blast', 'mage_hand', 'minor_illusion', 'poison_spray', 'prestidigitation', 'true_strike'],
    1: ['bane', 'charm_person', 'comprehend_languages', 'detect_magic', 'expeditious_retreat', 'hellish_rebuke', 'hex', 'hideous_laughter', 'illusory_script', 'protection_from_evil_and_good', 'speak_with_animals', 'unseen_servant'],
    2: ['darkness', 'enthrall', 'hold_person', 'invisibility', 'mind_spike', 'mirror_image', 'misty_step', 'ray_of_enfeeblement', 'spider_climb', 'suggestion'],
    3: ['counterspell', 'dispel_magic', 'fear', 'fly', 'gaseous_form', 'hypnotic_pattern', 'magic_circle', 'major_image', 'remove_curse', 'tongues', 'vampiric_touch'],
    4: ['banishment', 'blight', 'charm_monster', 'dimension_door', 'hallucinatory_terrain'],
    5: ['contact_other_plane', 'dream', 'hold_monster', 'mislead', 'planar_binding', 'scrying', 'teleportation_circle'],
    6: ['circle_of_death', 'create_undead', 'eyebite', 'true_seeing'],
    7: ['etherealness', 'finger_of_death', 'forcecage', 'plane_shift'],
    8: ['demiplane', 'dominate_monster', 'feeblemind', 'glibness', 'power_word_stun'],
    9: ['astral_projection', 'foresight', 'gate', 'imprisonment', 'power_word_kill', 'true_polymorph', 'weird'],
  },
  wizard: {
    0: ['acid_splash', 'chill_touch', 'dancing_lights', 'elementalism', 'firebolt', 'light', 'mage_hand', 'mending', 'message', 'minor_illusion', 'poison_spray', 'prestidigitation', 'ray_of_frost', 'shocking_grasp', 'true_strike'],
    1: ['alarm', 'burning_hands', 'charm_person', 'chromatic_orb', 'color_spray', 'comprehend_languages', 'detect_magic', 'disguise_self', 'expeditious_retreat', 'false_life', 'feather_fall', 'find_familiar', 'fog_cloud', 'grease', 'hideous_laughter', 'ice_knife', 'identify', 'illusory_script', 'jump', 'longstrider', 'mage_armor', 'magic_missile', 'protection_from_evil_and_good', 'ray_of_sickness', 'shield', 'silent_image', 'sleep_spell', 'tensers_floating_disk', 'thunderwave', 'unseen_servant'],
    2: ['alter_self', 'arcane_lock', 'augury', 'blindness_deafness', 'blur', 'continual_flame', 'darkness', 'darkvision', 'detect_thoughts', 'dragons_breath', 'enhance_ability', 'enlarge_reduce', 'flaming_sphere', 'gentle_repose', 'gust_of_wind', 'hold_person', 'invisibility', 'knock', 'levitate', 'locate_object', 'magic_mouth', 'magic_weapon', 'melfs_acid_arrow', 'mind_spike', 'mirror_image', 'misty_step', 'nystuls_magic_aura', 'phantasmal_force', 'ray_of_enfeeblement', 'rope_trick', 'scorching_ray', 'see_invisibility', 'shatter', 'spider_climb', 'suggestion', 'web'],
    3: ['animate_dead', 'bestow_curse', 'blink', 'clairvoyance', 'counterspell', 'dispel_magic', 'fear', 'fireball', 'fly', 'gaseous_form', 'glyph_of_warding', 'haste', 'hypnotic_pattern', 'leomunds_tiny_hut', 'lightning_bolt', 'magic_circle', 'major_image', 'nondetection', 'phantom_steed', 'protection_from_energy', 'remove_curse', 'sending', 'sleet_storm', 'slow', 'speak_with_dead', 'stinking_cloud', 'tongues', 'vampiric_touch', 'water_breathing'],
    4: ['arcane_eye', 'banishment', 'black_tentacles', 'blight', 'charm_monster', 'confusion', 'conjure_minor_elementals', 'control_water', 'dimension_door', 'divination', 'fabricate', 'fire_shield', 'greater_invisibility', 'hallucinatory_terrain', 'ice_storm', 'leomunds_secret_chest', 'locate_creature', 'mordenkainens_faithful_hound', 'mordenkainens_private_sanctum', 'otilukes_resilient_sphere', 'phantasmal_killer', 'polymorph', 'stone_shape', 'stoneskin', 'vitriolic_sphere', 'wall_of_fire'],
    5: ['animate_objects', 'bigbys_hand', 'cloudkill', 'cone_of_cold', 'conjure_elemental', 'contact_other_plane', 'creation', 'dominate_person', 'dream', 'geas', 'hold_monster', 'legend_lore', 'mislead', 'modify_memory', 'passwall', 'planar_binding', 'rarys_telepathic_bond', 'scrying', 'seeming', 'summon_dragon', 'telekinesis', 'teleportation_circle', 'wall_of_force', 'wall_of_stone'],
    6: ['chain_lightning', 'circle_of_death', 'contingency', 'create_undead', 'disintegrate', 'drawmijs_instant_summons', 'eyebite', 'flesh_to_stone', 'globe_of_invulnerability', 'guards_and_wards', 'magic_jar', 'mass_suggestion', 'move_earth', 'otilukes_freezing_sphere', 'ottos_irresistible_dance', 'programmed_illusion', 'sunbeam', 'true_seeing', 'wall_of_ice'],
    7: ['delayed_blast_fireball', 'etherealness', 'finger_of_death', 'forcecage', 'mirage_arcane', 'mordenkainens_magnificent_mansion', 'mordenkainens_sword', 'plane_shift', 'prismatic_spray', 'project_image', 'reverse_gravity', 'sequester', 'simulacrum', 'symbol', 'teleport'],
    8: ['antimagic_field', 'antipathy_sympathy', 'clone', 'control_weather', 'demiplane', 'dominate_monster', 'feeblemind', 'incendiary_cloud', 'maze', 'mind_blank', 'power_word_stun', 'sunburst'],
    9: ['astral_projection', 'foresight', 'gate', 'imprisonment', 'meteor_swarm', 'power_word_kill', 'prismatic_wall', 'shapechange', 'time_stop', 'true_polymorph', 'weird', 'wish'],
  },
};

/** Every spell id on any 2024 class list. */
export const ALL_2024_LIST_SPELL_IDS: string[] = [...new Set(Object.values(SPELL_LIST_2024).flatMap(l => Object.values(l).flat()))];
