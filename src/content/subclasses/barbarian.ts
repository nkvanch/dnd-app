// ============================================================================
// FILE: src/content/subclasses/barbarian.ts
// Barbarian subclasses: Berserker, Totem Warrior, Beast, Wild Magic,
// Ancestral Guardian, Battlerager, Giant, Storm Herald, Zealot, plus three
// earlier Unearthed Arcana drafts that are mechanically distinct from their
// same-named official counterparts already above: Path of the Beast (UA),
// Path of the Giant (UA), and Path of the Wild Soul (UA — the UA working
// title for what became the official Path of Wild Magic; different table,
// different capstone features).
// ============================================================================
import { ChoiceOption, ClassProgression, Feature } from '../../engine/types';

export type SubclassProgression = ClassProgression & { name: string };

// ── Berserker ─────────────────────────────────────────────────────────────────

export const berserkerProgression: SubclassProgression = {
  classId: 'barbarian',
  name: 'Path of the Berserker',
  srd: true,
  entries: [
    {
      level: 3, hpDie: 12, choices: [],
      grants: [
        { kind: 'feature', value: { id: 'frenzy', name: 'Frenzy', description: 'When you rage, you can go into a frenzy. For the duration, take one additional melee weapon attack as a bonus action each turn. When the rage ends, suffer one level of exhaustion.', source: { kind: 'subclass', refId: 'berserker' }, level: 3, effects: [], actions: [], choices: [], passive: false } },
      ],
    },
    {
      level: 6, hpDie: 12, choices: [],
      grants: [
        { kind: 'feature', value: { id: 'mindless_rage', name: 'Mindless Rage', description: 'You can\'t be charmed or frightened while raging. If you are charmed or frightened when you enter your rage, the effect is suspended for the duration of the rage.', source: { kind: 'subclass', refId: 'berserker' }, level: 6, effects: [{ type: 'condition_immunity', target: 'charmed', operation: 'immunity', value: null, condition: 'rage_active' }, { type: 'condition_immunity', target: 'frightened', operation: 'immunity', value: null, condition: 'rage_active' }], actions: [], choices: [], passive: true } },
      ],
    },
    {
      level: 10, hpDie: 12, choices: [],
      grants: [
        { kind: 'feature', value: { id: 'intimidating_presence', name: 'Intimidating Presence', description: 'Use an action to frighten a creature within 30 feet (WIS save, DC 8 + STR mod + prof). If the creature fails, it is frightened until the end of your next turn.', source: { kind: 'subclass', refId: 'berserker' }, level: 10, effects: [], actions: [], choices: [], passive: false } },
      ],
    },
    {
      level: 14, hpDie: 12, choices: [],
      grants: [
        { kind: 'feature', value: { id: 'retaliation', name: 'Retaliation', description: 'When you take damage from a creature within 5 feet, use your reaction to make one melee weapon attack against it.', source: { kind: 'subclass', refId: 'berserker' }, level: 14, effects: [], actions: [], choices: [], passive: false } },
      ],
    },
  ],
};

// ── Totem Warrior ─────────────────────────────────────────────────────────────

export const totemWarriorProgression: SubclassProgression = {
  classId: 'barbarian',
  name: 'Path of the Totem Warrior',
  // CONFIRMED correct via direct verification against the actual SRD 5.1
  // text (5thsrd.org) on 2026-08-04: the Barbarian page's table of contents
  // and full content show only "Path of the Berserker" actually detailed —
  // Totem Warrior is named in the class's intro sentence ("choose X or Y,
  // both detailed at the end") but that phrasing is boilerplate copied
  // verbatim from the full PHB and does NOT reliably indicate what the SRD
  // excerpt actually includes. Confirmed non-SRD.
  srd: false,
  entries: [
    {
      level: 3, hpDie: 12, choices: [],
      grants: [
        { kind: 'feature', value: { id: 'spirit_seeker', name: 'Spirit Seeker', description: 'Gain the ability to cast Beast Sense and Speak with Animals as rituals.', source: { kind: 'subclass', refId: 'totem_warrior' }, level: 3, effects: [], actions: [], choices: [], passive: true } },
        { kind: 'feature', value: { id: 'totem_spirit', name: 'Totem Spirit', description: 'Choose a totem spirit (Bear, Eagle, or Wolf). Bear: resistance to all damage except psychic while raging. Eagle: not subject to opportunity attacks while raging (dash as bonus action). Wolf: allies have advantage on melee attacks against enemies adjacent to you while raging.', source: { kind: 'subclass', refId: 'totem_warrior' }, level: 3, effects: [], actions: [], choices: [], passive: true } },
      ],
    },
    {
      level: 6, hpDie: 12, choices: [],
      grants: [
        { kind: 'feature', value: { id: 'aspect_of_the_beast', name: 'Aspect of the Beast', description: 'Choose an aspect of your totem animal. Bear: double your carrying capacity and advantage on STR checks for pushing/pulling/lifting/breaking. Eagle: see up to 1 mile with no difficulty, dim light counts as bright light. Wolf: track creatures at a fast pace, stealth at normal pace.', source: { kind: 'subclass', refId: 'totem_warrior' }, level: 6, effects: [], actions: [], choices: [], passive: true } },
      ],
    },
    {
      level: 10, hpDie: 12, choices: [],
      grants: [
        { kind: 'feature', value: { id: 'spirit_walker', name: 'Spirit Walker', description: 'Cast Commune with Nature as a ritual, calling on your totem spirit for guidance.', source: { kind: 'subclass', refId: 'totem_warrior' }, level: 10, effects: [], actions: [], choices: [], passive: false } },
      ],
    },
    {
      level: 14, hpDie: 12, choices: [],
      grants: [
        { kind: 'feature', value: { id: 'totemic_attunement', name: 'Totemic Attunement', description: 'Choose a totem animal. Bear: enemies within 5 feet have disadvantage on attacks against your allies while you rage. Eagle: bonus action to fly up to your speed if airborne. Wolf: knock a Large or smaller creature prone when you hit it with a melee attack while raging.', source: { kind: 'subclass', refId: 'totem_warrior' }, level: 14, effects: [], actions: [], choices: [], passive: true } },
      ],
    },
  ],
};

// ── Path of the Beast ─────────────────────────────────────────────────────────

export const pathOfTheBeastProgression: SubclassProgression = {
  classId: 'barbarian',
  name: 'Path of the Beast',
  srd: false,
  entries: [
    {
      level: 3, hpDie: 12, choices: [],
      grants: [
        { kind: 'feature', value: { id: 'form_of_the_beast', name: 'Form of the Beast', description: 'When you rage, you can manifest a natural weapon — a bite (1d8 piercing, and once per turn heals you for your proficiency bonus if you\'re below half HP when it hits), claws (1d6 slashing, once per turn make an extra claw attack as part of the Attack action), or a reach tail (1d8 piercing, and as a reaction against an attacker within 10 feet, roll a d8 and add it to your AC against that attack). You choose the form each time you rage; it counts as a simple melee weapon using STR.', source: { kind: 'subclass', refId: 'path_of_the_beast' }, level: 3, effects: [], actions: [], choices: [], passive: false } },
      ],
    },
    {
      level: 6, hpDie: 12, choices: [],
      grants: [
        { kind: 'feature', value: { id: 'bestial_soul', name: 'Bestial Soul', description: 'Your natural weapons count as magical for overcoming resistance and immunity to nonmagical attacks. When you finish a short or long rest, choose one until your next rest: a swimming speed equal to your walking speed (and you can breathe underwater), a climbing speed equal to your walking speed (including upside-down and on sheer surfaces), or the ability to extend a jump by the result of a STR (Athletics) check once per turn.', source: { kind: 'subclass', refId: 'path_of_the_beast' }, level: 6, effects: [], actions: [], choices: [], passive: true } },
      ],
    },
    {
      level: 10, hpDie: 12, choices: [],
      grants: [
        { kind: 'feature', value: { id: 'infectious_fury', name: 'Infectious Fury', description: 'When you hit with a natural weapon while raging, the target makes a WIS save (DC 8 + CON mod + proficiency bonus) or, your choice, is forced to attack another creature you designate with its reaction, or takes 2d12 psychic damage. Usable a number of times equal to your proficiency bonus per long rest.', source: { kind: 'subclass', refId: 'path_of_the_beast' }, level: 10, effects: [], actions: [], choices: [], passive: false,
          activation: { actionType: 'free', resourceCost: null, range: '5 feet', target: 'single', requiresSave: { ability: 'wis', dc: 'spell_save_dc' } },
          abilityEffects: [{ type: 'damage', dice: '2d12', damageType: 'psychic' }],
        } },
      ],
    },
    {
      level: 14, hpDie: 12, choices: [],
      grants: [
        { kind: 'feature', value: { id: 'call_the_hunt', name: 'Call the Hunt', description: 'When you enter your rage, choose willing creatures within 30 feet equal to your CON modifier (min 1) to join your hunt; you gain 5 temporary HP per creature that accepts. Until your rage ends, each of them can once per turn add a rolled d6 to damage dealt on a hit. Usable a number of times equal to your proficiency bonus per long rest.', source: { kind: 'subclass', refId: 'path_of_the_beast' }, level: 14, effects: [], actions: [], choices: [], passive: false } },
      ],
    },
  ],
};

// ── Path of Wild Magic ────────────────────────────────────────────────────────

export const pathOfWildMagicProgression: SubclassProgression = {
  classId: 'barbarian',
  name: 'Path of Wild Magic',
  srd: false,
  entries: [
    {
      level: 3, hpDie: 12, choices: [],
      grants: [
        { kind: 'feature', value: { id: 'magic_awareness', name: 'Magic Awareness', description: 'As an action, sense the location and school of any spell or magic item within 60 feet not behind total cover, until the end of your next turn. Usable a number of times equal to your proficiency bonus per long rest.', source: { kind: 'subclass', refId: 'path_of_wild_magic' }, level: 3, effects: [], actions: [], choices: [], passive: false,
          activation: { actionType: 'action', resourceCost: null, range: '60 feet', target: 'self', requiresSave: null },
          abilityEffects: [],
        } },
        { kind: 'feature', value: { id: 'wild_surge', name: 'Wild Surge', description: 'Whenever you enter your rage, roll on the Wild Magic table (d8) to produce a random magical effect — damage, teleportation, a summoned exploding spirit, an elemental weapon infusion, retributive damage against attackers, a protective AC bonus, difficult terrain, or a blinding bolt of light. Saves against these effects use DC 8 + proficiency bonus + CON modifier. Resolve the rolled effect manually — the table\'s 8 distinct outcomes aren\'t individually wired into the engine.', source: { kind: 'subclass', refId: 'path_of_wild_magic' }, level: 3, effects: [], actions: [], choices: [], passive: false } },
      ],
    },
    {
      level: 6, hpDie: 12, choices: [],
      grants: [
        { kind: 'feature', value: { id: 'bolstering_magic', name: 'Bolstering Magic', description: 'As an action, touch a creature (possibly yourself) to grant one of: for 10 minutes, add a rolled d3 to attack rolls and ability checks; or roll a d3 and restore an expended spell slot of that level or lower (once per creature per long rest). Usable a number of times equal to your proficiency bonus per long rest.', source: { kind: 'subclass', refId: 'path_of_wild_magic' }, level: 6, effects: [], actions: [], choices: [], passive: false,
          activation: { actionType: 'action', resourceCost: null, range: 'touch', target: 'single', requiresSave: null },
          abilityEffects: [],
        } },
      ],
    },
    {
      level: 10, hpDie: 12, choices: [],
      grants: [
        { kind: 'feature', value: { id: 'unstable_backlash', name: 'Unstable Backlash', description: 'Immediately after you take damage or fail a save while raging, use your reaction to roll on the Wild Magic table and replace your current effect with the new roll.', source: { kind: 'subclass', refId: 'path_of_wild_magic' }, level: 10, effects: [], actions: [], choices: [], passive: false,
          activation: { actionType: 'reaction', resourceCost: null, range: 'self', target: 'self', requiresSave: null },
          abilityEffects: [],
        } },
      ],
    },
    {
      level: 14, hpDie: 12, choices: [],
      grants: [
        { kind: 'feature', value: { id: 'controlled_surge', name: 'Controlled Surge', description: 'Whenever you roll on the Wild Magic table, roll twice and choose which effect to use (or, on a matching pair, choose any effect on the table).', source: { kind: 'subclass', refId: 'path_of_wild_magic' }, level: 14, effects: [], actions: [], choices: [], passive: true } },
      ],
    },
  ],
};

// ── Path of the Ancestral Guardian ────────────────────────────────────────────

export const pathOfTheAncestralGuardianProgression: SubclassProgression = {
  classId: 'barbarian',
  name: 'Path of the Ancestral Guardian',
  srd: false,
  entries: [
    {
      level: 3, hpDie: 12, choices: [],
      grants: [
        { kind: 'feature', value: { id: 'ancestral_protectors', name: 'Ancestral Protectors', description: 'While raging, the first creature you hit each turn is marked by spectral warriors until the start of your next turn: it has disadvantage on attacks against anyone but you, and creatures it hits (other than you) gain resistance to that damage. Ends early if your rage ends.', source: { kind: 'subclass', refId: 'ancestral_guardian' }, level: 3, effects: [], actions: [], choices: [], passive: false } },
      ],
    },
    {
      level: 6, hpDie: 12, choices: [],
      grants: [
        { kind: 'feature', value: { id: 'spirit_shield', name: 'Spirit Shield', description: 'While raging, use your reaction when a creature you can see within 30 feet takes damage to reduce that damage by 2d6 (3d6 at level 10, 4d6 at level 14).', source: { kind: 'subclass', refId: 'ancestral_guardian' }, level: 6, effects: [], actions: [], choices: [], passive: false,
          activation: { actionType: 'reaction', resourceCost: null, range: '30 feet', target: 'single', requiresSave: null },
          abilityEffects: [],
        } },
      ],
    },
    {
      level: 10, hpDie: 12, choices: [],
      grants: [
        { kind: 'feature', value: { id: 'consult_the_spirits', name: 'Consult the Spirits', description: 'Cast Augury or Clairvoyance (WIS-based, no slot or components needed — Clairvoyance instead summons an ancestral spirit to the chosen location) once per short or long rest.', source: { kind: 'subclass', refId: 'ancestral_guardian' }, level: 10, effects: [], actions: [], choices: [], passive: false } },
      ],
    },
    {
      level: 14, hpDie: 12, choices: [],
      grants: [
        { kind: 'feature', value: { id: 'vengeful_ancestors', name: 'Vengeful Ancestors', description: 'When your Spirit Shield reduces an attack\'s damage, the attacker takes force damage equal to the amount prevented.', source: { kind: 'subclass', refId: 'ancestral_guardian' }, level: 14, effects: [], actions: [], choices: [], passive: true } },
      ],
    },
  ],
};

// ── Path of the Battlerager ───────────────────────────────────────────────────

export const pathOfTheBattleragerProgression: SubclassProgression = {
  classId: 'barbarian',
  name: 'Path of the Battlerager',
  srd: false,
  entries: [
    {
      level: 3, hpDie: 12, choices: [],
      grants: [
        { kind: 'feature', value: { id: 'battlerager_armor', name: 'Battlerager Armor', description: 'Restricted to dwarves (a DM may lift this). While wearing spiked armor and raging, use a bonus action to make a melee attack with your armor spikes (1d4 piercing, STR-based) against a target within 5 feet. A successful grapple against a target also deals 3 piercing damage from the spikes.', source: { kind: 'subclass', refId: 'battlerager' }, level: 3, effects: [], actions: [], choices: [], passive: false,
          activation: { actionType: 'bonus_action', resourceCost: null, range: '5 feet', target: 'single', requiresSave: null },
          abilityEffects: [{ type: 'damage', dice: '1d4', damageType: 'piercing' }],
        } },
      ],
    },
    {
      level: 6, hpDie: 12, choices: [],
      grants: [
        { kind: 'feature', value: { id: 'reckless_abandon', name: 'Reckless Abandon', description: 'When you use Reckless Attack while raging, also gain temporary HP equal to your CON modifier (min 1); they vanish when your rage ends.', source: { kind: 'subclass', refId: 'battlerager' }, level: 6, effects: [], actions: [], choices: [], passive: true } },
      ],
    },
    {
      level: 10, hpDie: 12, choices: [],
      grants: [
        { kind: 'feature', value: { id: 'battlerager_charge', name: 'Battlerager Charge', description: 'While raging, you can take the Dash action as a bonus action.', source: { kind: 'subclass', refId: 'battlerager' }, level: 10, effects: [], actions: [], choices: [], passive: true } },
      ],
    },
    {
      level: 14, hpDie: 12, choices: [],
      grants: [
        { kind: 'feature', value: { id: 'spiked_retribution', name: 'Spiked Retribution', description: 'While raging, not incapacitated, and wearing spiked armor, a creature within 5 feet that hits you with a melee attack takes 3 piercing damage.', source: { kind: 'subclass', refId: 'battlerager' }, level: 14, effects: [], actions: [], choices: [], passive: true } },
      ],
    },
  ],
};

// ── Path of the Giant ─────────────────────────────────────────────────────────

export const pathOfTheGiantProgression: SubclassProgression = {
  classId: 'barbarian',
  name: 'Path of the Giant',
  srd: false,
  entries: [
    {
      level: 3, hpDie: 12, choices: [],
      grants: [
        { kind: 'feature', value: { id: 'giant_ancestry', name: 'Giant Ancestry', description: 'Learn Giant (or another language, if you already know Giant) and one cantrip of your choice from druidcraft or thaumaturgy, using WIS as your spellcasting ability for it.', source: { kind: 'subclass', refId: 'path_of_the_giant' }, level: 3, effects: [], actions: [], choices: [], passive: true } },
        { kind: 'feature', value: { id: 'giants_havoc', name: "Giant's Havoc", description: 'While raging: a thrown Strength weapon attack adds your rage damage bonus, and your reach increases by 5 feet as you grow to Large size (if you were smaller than Large and there\'s room).', source: { kind: 'subclass', refId: 'path_of_the_giant' }, level: 3, effects: [], actions: [], choices: [], passive: false } },
      ],
    },
    {
      level: 6, hpDie: 12, choices: [],
      grants: [
        { kind: 'feature', value: { id: 'elemental_cleaver', name: 'Elemental Cleaver', description: 'When you rage, infuse one held weapon with acid, cold, fire, thunder, or lightning damage — while raging and wielding it, it deals a bonus 1d6 of that type, changes its damage type to match, and gains the thrown property (range 20/60, returning to your hand after a throw). Suppressed if wielded by someone else. As a bonus action while raging, you can change the infused type.', source: { kind: 'subclass', refId: 'path_of_the_giant' }, level: 6, effects: [], actions: [], choices: [], passive: false } },
      ],
    },
    {
      level: 10, hpDie: 12, choices: [],
      grants: [
        { kind: 'feature', value: { id: 'mighty_impel', name: 'Mighty Impel', description: 'As a bonus action while raging, move a Medium or smaller creature within your reach to an unoccupied space within 30 feet; an unwilling target makes a STR save (DC 8 + proficiency bonus + STR modifier) to resist. A thrown creature that lands without support falls, taking fall damage and landing prone.', source: { kind: 'subclass', refId: 'path_of_the_giant' }, level: 10, effects: [], actions: [], choices: [], passive: false,
          activation: { actionType: 'bonus_action', resourceCost: null, range: '30 feet', target: 'single', requiresSave: { ability: 'str', dc: 'spell_save_dc' } },
          abilityEffects: [],
        } },
      ],
    },
    {
      level: 14, hpDie: 12, choices: [],
      grants: [
        { kind: 'feature', value: { id: 'demiurgic_colossus', name: 'Demiurgic Colossus', description: 'While raging, your reach increases by 10 feet, you can grow to Large or Huge, Mighty Impel can move Large or smaller creatures, and Elemental Cleaver\'s bonus damage increases to 2d6.', source: { kind: 'subclass', refId: 'path_of_the_giant' }, level: 14, effects: [], actions: [], choices: [], passive: true } },
      ],
    },
  ],
};

// ── Path of the Storm Herald ──────────────────────────────────────────────────

export const pathOfTheStormHeraldProgression: SubclassProgression = {
  classId: 'barbarian',
  name: 'Path of the Storm Herald',
  srd: false,
  entries: [
    {
      level: 3, hpDie: 12, choices: [],
      grants: [
        { kind: 'feature', value: { id: 'storm_aura', name: 'Storm Aura', description: 'While raging, you radiate a 10-foot magical aura (blocked by total cover) themed to desert, sea, or tundra (re-chosen freely on level-up in this class). It triggers when you enter your rage and again as a bonus action each turn: Desert deals scaling fire damage (2 at level 3, up to 6 at 20) to all other creatures in the aura; Sea forces a DEX save on one target for scaling lightning damage (half on success); Tundra grants scaling temporary HP to chosen creatures in the aura. Save DC is 8 + proficiency bonus + CON modifier.', source: { kind: 'subclass', refId: 'storm_herald' }, level: 3, effects: [], actions: [], choices: [], passive: false } },
      ],
    },
    {
      level: 6, hpDie: 12, choices: [],
      grants: [
        { kind: 'feature', value: { id: 'storm_soul', name: 'Storm Soul', description: 'Passive benefit matching your aura\'s environment, even outside rage: Desert grants fire resistance, immunity to extreme heat, and the ability to ignite flammable objects by touch; Sea grants lightning resistance, a 30-foot swim speed, and waterbreathing; Tundra grants cold resistance, immunity to extreme cold, and the ability to freeze a 5-foot cube of water by touch.', source: { kind: 'subclass', refId: 'storm_herald' }, level: 6, effects: [], actions: [], choices: [], passive: true } },
      ],
    },
    {
      level: 10, hpDie: 12, choices: [],
      grants: [
        { kind: 'feature', value: { id: 'shielding_storm', name: 'Shielding Storm', description: 'Creatures you choose share your Storm Soul damage resistance while they stand inside your Storm Aura.', source: { kind: 'subclass', refId: 'storm_herald' }, level: 10, effects: [], actions: [], choices: [], passive: true } },
      ],
    },
    {
      level: 14, hpDie: 12, choices: [],
      grants: [
        { kind: 'feature', value: { id: 'raging_storm', name: 'Raging Storm', description: 'Your aura lashes out based on its environment: Desert lets you force a DEX save on an attacker for fire damage equal to half your barbarian level (reaction); Sea lets you force a STR save on a creature you hit to knock it prone (reaction); Tundra lets you reduce a chosen creature\'s speed to 0 until your next turn (STR save) whenever your aura effect activates.', source: { kind: 'subclass', refId: 'storm_herald' }, level: 14, effects: [], actions: [], choices: [], passive: false } },
      ],
    },
  ],
};

// ── Path of the Zealot ────────────────────────────────────────────────────────

export const pathOfTheZealotProgression: SubclassProgression = {
  classId: 'barbarian',
  name: 'Path of the Zealot',
  srd: false,
  entries: [
    {
      level: 3, hpDie: 12, choices: [],
      grants: [
        { kind: 'feature', value: { id: 'divine_fury', name: 'Divine Fury', description: 'While raging, the first creature you hit with a weapon attack each turn takes extra necrotic or radiant damage (your choice at 3rd level) equal to 1d6 + half your barbarian level.', source: { kind: 'subclass', refId: 'zealot' }, level: 3, effects: [], actions: [], choices: [], passive: false,
          activation: { actionType: 'free', resourceCost: null, range: '5 feet', target: 'single', requiresSave: null },
          abilityEffects: [{ type: 'damage', dice: '1d6', damageType: 'radiant' }],
        } },
        { kind: 'feature', value: { id: 'warrior_of_the_gods', name: 'Warrior of the Gods', description: 'A spell that only restores you to life (not undeath), such as Raise Dead, doesn\'t require material components when cast on you.', source: { kind: 'subclass', refId: 'zealot' }, level: 3, effects: [], actions: [], choices: [], passive: true } },
      ],
    },
    {
      level: 6, hpDie: 12, choices: [],
      grants: [
        { kind: 'feature', value: { id: 'fanatical_focus', name: 'Fanatical Focus', description: 'If you fail a saving throw while raging, you can reroll it and must use the new result. Usable once per rage.', source: { kind: 'subclass', refId: 'zealot' }, level: 6, effects: [], actions: [], choices: [], passive: false } },
      ],
    },
    {
      level: 10, hpDie: 12, choices: [],
      grants: [
        { kind: 'feature', value: { id: 'zealous_presence', name: 'Zealous Presence', description: 'As a bonus action, grant up to ten creatures of your choice within 60 feet who can hear you advantage on attack rolls and saving throws until the start of your next turn. Usable once per long rest.', source: { kind: 'subclass', refId: 'zealot' }, level: 10, effects: [], actions: [], choices: [], passive: false,
          activation: { actionType: 'bonus_action', resourceCost: null, range: '60 feet', target: 'multiple', requiresSave: null },
          abilityEffects: [],
        } },
      ],
    },
    {
      level: 14, hpDie: 12, choices: [],
      grants: [
        { kind: 'feature', value: { id: 'rage_beyond_death', name: 'Rage Beyond Death', description: 'While raging, dropping to 0 HP doesn\'t knock you unconscious (you still make death saves and suffer normal effects of damage at 0 HP). If you would die from failed death saves, you don\'t die until your rage ends — and only then if you\'re still at 0 HP.', source: { kind: 'subclass', refId: 'zealot' }, level: 14, effects: [], actions: [], choices: [], passive: true } },
      ],
    },
  ],
};

// ── Path of the Beast (UA) ───────────────────────────────────────────────────
export const pathOfTheBeastUaProgression: SubclassProgression = {
  classId: 'barbarian', name: 'Path of the Beast (UA)', srd: false,
  entries: [
    { level: 3, hpDie: 12, choices: [],
      grants: [
        { kind: 'feature', value: { id: 'form_of_the_beast_bite_ua', name: 'Form of the Beast: Bite', description: 'While raging, your bite (a natural weapon you can choose each time you rage) deals 1d8 piercing damage; once per turn on a hit, regain HP equal to your Constitution modifier (minimum 1).', source: { kind: 'subclass', refId: 'path_of_the_beast_ua' }, level: 3, effects: [], actions: [], choices: [], passive: false,
          activation: { actionType: 'action', resourceCost: null, range: '5 feet', target: 'single', requiresSave: null },
          abilityEffects: [{ type: 'damage', dice: '1d8', damageType: 'piercing' }] } },
        { kind: 'feature', value: { id: 'form_of_the_beast_claws_ua', name: 'Form of the Beast: Claws', description: 'While raging, your claws (a natural weapon you can choose each time you rage) deal 1d6 slashing damage; when you take the Attack action and attack with them, make one additional claw attack as part of the same action.', source: { kind: 'subclass', refId: 'path_of_the_beast_ua' }, level: 3, effects: [], actions: [], choices: [], passive: false,
          activation: { actionType: 'action', resourceCost: null, range: '5 feet', target: 'single', requiresSave: null },
          abilityEffects: [{ type: 'damage', dice: '1d6', damageType: 'slashing' }] } },
        { kind: 'feature', value: { id: 'form_of_the_beast_tail_ua', name: 'Form of the Beast: Tail', description: 'While raging, your tail (a natural weapon you can choose each time you rage) deals 1d12 piercing damage and has the reach property.', source: { kind: 'subclass', refId: 'path_of_the_beast_ua' }, level: 3, effects: [], actions: [], choices: [], passive: false,
          activation: { actionType: 'action', resourceCost: null, range: '10 feet', target: 'single', requiresSave: null },
          abilityEffects: [{ type: 'damage', dice: '1d12', damageType: 'piercing' }] } },
      ] },
    { level: 6, hpDie: 12, choices: [],
      grants: [
        { kind: 'feature', value: { id: 'bestial_soul_note_ua', name: 'Bestial Soul', description: 'Your Form of the Beast natural weapons count as magical for overcoming resistance and immunity to nonmagical attacks. At the end of a short or long rest, choose one adaptation below (lasting until your next short or long rest).', source: { kind: 'subclass', refId: 'path_of_the_beast_ua' }, level: 6, effects: [], actions: [], choices: [], passive: true } },
        { kind: 'feature', value: { id: 'bestial_soul_swim_ua', name: 'Bestial Soul: Aquatic Adaptation', description: 'Gain a swimming speed equal to your walking speed and the ability to breathe underwater, until your next short or long rest.', source: { kind: 'subclass', refId: 'path_of_the_beast_ua' }, level: 6, effects: [
          { type: 'grant_movement', target: 'movement', operation: 'add', value: null, condition: null, movementType: 'swim', movementRange: 30 },
        ], actions: [], choices: [], passive: true } },
        { kind: 'feature', value: { id: 'bestial_soul_climb_ua', name: 'Bestial Soul: Climbing Adaptation', description: 'Gain a climbing speed equal to your walking speed and the ability to climb difficult surfaces (including upside down on ceilings) without an ability check, until your next short or long rest.', source: { kind: 'subclass', refId: 'path_of_the_beast_ua' }, level: 6, effects: [
          { type: 'grant_movement', target: 'movement', operation: 'add', value: null, condition: null, movementType: 'climb', movementRange: 30 },
        ], actions: [], choices: [], passive: true } },
        { kind: 'feature', value: { id: 'bestial_soul_jump_ua', name: 'Bestial Soul: Leaping Adaptation', description: 'Once per turn when you jump, make a Strength (Athletics) check and extend the jump\'s distance by a number of feet equal to the check total, until your next short or long rest.', source: { kind: 'subclass', refId: 'path_of_the_beast_ua' }, level: 6, effects: [], actions: [], choices: [], passive: true } },
      ] },
    { level: 10, hpDie: 12, choices: [],
      grants: [
        { kind: 'resource', value: { resourceId: 'infectious_fury_pool', name: 'Infectious Fury (scales with Constitution modifier)', maximum: 1, recharge: 'long_rest' } },
        { kind: 'feature', value: { id: 'infectious_fury', name: 'Infectious Fury', description: 'While raging, when you hit with a natural weapon, curse the target with a Wisdom save (DC 8 + Constitution modifier + proficiency bonus — no formula slot exists for this non-spellcaster DC) or suffer one of your choice: attack a creature of your choice with its reaction, or take 2d12 psychic damage. Usable a number of times equal to your Constitution modifier (minimum once) per long rest — tracked here as a single-use pool; increase its maximum to match.', source: { kind: 'subclass', refId: 'path_of_the_beast_ua' }, level: 10, effects: [], actions: [], choices: [], passive: false,
          activation: { actionType: 'free', resourceCost: { resourceId: 'infectious_fury_pool', quantity: 1 }, range: '5 feet', target: 'single', requiresSave: null },
          abilityEffects: [{ type: 'damage', dice: '2d12', damageType: 'psychic' }] } },
      ] },
    { level: 14, hpDie: 12, choices: [],
      grants: [
        { kind: 'resource', value: { resourceId: 'call_the_hunt_pool', name: 'Call the Hunt (scales with Constitution modifier)', maximum: 1, recharge: 'long_rest' } },
        { kind: 'feature', value: { id: 'call_the_hunt', name: 'Call the Hunt', description: 'When you enter your rage, choose willing creatures within 30 feet up to your Constitution modifier (minimum one): until your rage ends they gain Reckless Attack and you have advantage on saves against being frightened, and you gain 5 temporary hit points per creature that accepts. Usable a number of times equal to your Constitution modifier (minimum once) per long rest — tracked here as a single-use pool; increase its maximum to match.', source: { kind: 'subclass', refId: 'path_of_the_beast_ua' }, level: 14, effects: [], actions: [], choices: [], passive: false,
          activation: { actionType: 'free', resourceCost: { resourceId: 'call_the_hunt_pool', quantity: 1 }, range: '30 feet', target: 'multiple', requiresSave: null },
          abilityEffects: [] } },
      ] },
  ],
};

// ── Path of the Giant (UA) ───────────────────────────────────────────────────
const GIANT_CANTRIP_POOL_UA: ChoiceOption[] = [
  { id: 'druidcraft', label: 'Druidcraft', value: { id: 'giant_power_druidcraft_ua', name: 'Giant Power: Druidcraft', description: 'Learn the Druidcraft cantrip (Wisdom-based).', source: { kind: 'subclass', refId: 'path_of_the_giant_ua' }, level: null, effects: [{ type: 'grant_spell', target: 'cantrip', operation: 'add', value: null, condition: null, cantripIds: ['druidcraft'] }], actions: [], choices: [], passive: true } as Feature },
  { id: 'thaumaturgy', label: 'Thaumaturgy', value: { id: 'giant_power_thaumaturgy_ua', name: 'Giant Power: Thaumaturgy', description: 'Learn the Thaumaturgy cantrip (Wisdom-based).', source: { kind: 'subclass', refId: 'path_of_the_giant_ua' }, level: null, effects: [{ type: 'grant_spell', target: 'cantrip', operation: 'add', value: null, condition: null, cantripIds: ['thaumaturgy'] }], actions: [], choices: [], passive: true } as Feature },
];
export const pathOfTheGiantUaProgression: SubclassProgression = {
  classId: 'barbarian', name: 'Path of the Giant (UA)', srd: false,
  entries: [
    { level: 3, hpDie: 12,
      choices: [{ id: 'giant_power_cantrip_ua', prompt: 'Choose Druidcraft or Thaumaturgy.', kind: 'feature_pool', count: 1, pool: GIANT_CANTRIP_POOL_UA, grants: [], required: true, resolved: false }],
      grants: [
        { kind: 'feature', value: { id: 'giant_power_ua', name: 'Giant Power', description: 'Learn to speak, read, and write Giant (or another language if you already know it).', source: { kind: 'subclass', refId: 'path_of_the_giant_ua' }, level: 3, effects: [], actions: [], choices: [], passive: true } },
        { kind: 'feature', value: { id: 'giants_havoc_ua', name: "Giant's Havoc", description: 'While raging: add your rage damage bonus to successful Strength-based thrown weapon attacks; your reach increases by 5 feet and, if smaller than Large, you become Large (with your gear) if there\'s room.', source: { kind: 'subclass', refId: 'path_of_the_giant_ua' }, level: 3, effects: [], actions: [], choices: [], passive: true } },
      ] },
    { level: 6, hpDie: 12, choices: [],
      grants: [
        { kind: 'feature', value: { id: 'elemental_cleaver_ua', name: 'Elemental Cleaver', description: 'When you enter your rage, infuse a held weapon with acid, cold, fire, lightning, or thunder damage (your choice); while raging and wielding it, its damage type changes to that type, it deals an extra die of that damage on a hit, and it gains the thrown property (20/60 ft., returning to your hand after a throw). Suppressed if wielded by someone else.', source: { kind: 'subclass', refId: 'path_of_the_giant_ua' }, level: 6, effects: [], actions: [], choices: [], passive: false,
          activation: { actionType: 'bonus_action', resourceCost: null, range: 'self', target: 'self', requiresSave: null },
          abilityEffects: [{ type: 'damage', dice: '1d6', damageType: 'acid' }] } },
        { kind: 'feature', value: { id: 'elemental_cleaver_retype_ua', name: 'Elemental Cleaver: Change Type', description: 'While raging and holding your infused weapon, use a bonus action to change its damage type to a different one of the five options.', source: { kind: 'subclass', refId: 'path_of_the_giant_ua' }, level: 6, effects: [], actions: [], choices: [], passive: false,
          activation: { actionType: 'bonus_action', resourceCost: null, range: 'self', target: 'self', requiresSave: null },
          abilityEffects: [] } },
      ] },
    { level: 10, hpDie: 12, choices: [], grants: [{ kind: 'feature', value: { id: 'mighty_impel_ua', name: 'Mighty Impel', description: 'As a bonus action while raging, move a Medium or smaller creature within your reach to an unoccupied space within 30 feet; an unwilling creature resists with a Strength save (DC 8 + proficiency bonus + Strength modifier — no formula slot exists for this non-spellcaster DC). A creature that ends the movement unsupported falls, taking fall damage and landing prone.', source: { kind: 'subclass', refId: 'path_of_the_giant_ua' }, level: 10, effects: [], actions: [], choices: [], passive: false,
      activation: { actionType: 'bonus_action', resourceCost: null, range: '30 feet', target: 'single', requiresSave: null },
      abilityEffects: [] } }] },
    { level: 14, hpDie: 12, choices: [], grants: [{ kind: 'feature', value: { id: 'demiurgic_collussus_ua', name: 'Demiurgic Collussus', description: 'While raging, your reach increases by 10 feet (instead of 5), you can grow to Huge size, and Mighty Impel can move Large or smaller creatures. Elemental Cleaver\'s extra damage increases to 2 dice.', source: { kind: 'subclass', refId: 'path_of_the_giant_ua' }, level: 14, effects: [], actions: [], choices: [], passive: true } }] },
  ],
};

// ── Path of the Wild Soul (UA) ───────────────────────────────────────────────
// UA working title for the mechanic that shipped as the official Path of
// Wild Magic above (compare "Magic Awareness"/"Bolstering Magic"/"Unstable
// Backlash"/"Controlled Surge" there against this file's different feature
// names and Wild Surge table) — different enough to keep as its own entry,
// matching the Armorer/Armorer (UA) precedent.
export const pathOfTheWildSoulUaProgression: SubclassProgression = {
  classId: 'barbarian', name: 'Path of the Wild Soul (UA)', srd: false,
  entries: [
    { level: 3, hpDie: 12, choices: [],
      grants: [
        { kind: 'resource', value: { resourceId: 'detect_magic_wild_soul_pool', name: 'Detect Magic (scales with Constitution modifier)', maximum: 1, recharge: 'long_rest' } },
        { kind: 'feature', value: { id: 'wild_soul_detect_magic_ua', name: 'Wild Soul', description: 'Cast Detect Magic without a slot or components (Constitution-based); you glow with a color matching the school you detect. Usable a number of times equal to your Constitution modifier (minimum once) per long rest — tracked here as a single-use pool; increase its maximum to match.', source: { kind: 'subclass', refId: 'path_of_the_wild_soul_ua' }, level: 3, effects: [], actions: [], choices: [], passive: false,
          activation: { actionType: 'action', resourceCost: { resourceId: 'detect_magic_wild_soul_pool', quantity: 1 }, range: 'self', target: 'self', requiresSave: null },
          abilityEffects: [{ type: 'cast_spell', spellId: 'detect_magic' }] } },
        { kind: 'feature', value: { id: 'wild_surge_ua', name: 'Wild Surge', description: 'Whenever you enter your rage, roll on this Wild Surge table (d8) for a random magical effect — necrotic burst with temp HP, self-teleport, exploding spirits, an AC bonus with retributive force damage, difficult terrain, a mind-reading disadvantage rider, a psychic-damage weapon infusion, or a blinding radiant line. Saves against these effects use DC 8 + proficiency bonus + Constitution modifier (no formula slot exists for this non-spellcaster DC). Resolve the rolled effect manually — the table\'s 8 distinct outcomes aren\'t individually wired into the engine.', source: { kind: 'subclass', refId: 'path_of_the_wild_soul_ua' }, level: 3, effects: [], actions: [], choices: [], passive: false } },
      ] },
    { level: 6, hpDie: 12, choices: [], grants: [{ kind: 'feature', value: { id: 'magic_reserves_ua', name: 'Magic Reserves', description: 'As an action, touch a creature and roll a d4 (d6 at level 14): it recovers an expended spell slot of that level or lower, or (if it can\'t) gains temporary hit points equal to 5 times the roll. You take force damage equal to 5 times the roll.', source: { kind: 'subclass', refId: 'path_of_the_wild_soul_ua' }, level: 6, effects: [], actions: [], choices: [], passive: false,
      activation: { actionType: 'action', resourceCost: null, range: 'touch', target: 'single', requiresSave: null },
      abilityEffects: [] } }] },
    { level: 10, hpDie: 12, choices: [], grants: [{ kind: 'feature', value: { id: 'arcane_rebuke_ua', name: 'Arcane Rebuke', description: 'While raging, when a creature forces you to make a saving throw, use your reaction to deal 3d6 force damage to it.', source: { kind: 'subclass', refId: 'path_of_the_wild_soul_ua' }, level: 10, effects: [], actions: [], choices: [], passive: false,
      activation: { actionType: 'reaction', resourceCost: null, range: '60 feet', target: 'single', requiresSave: null },
      abilityEffects: [{ type: 'damage', dice: '3d6', damageType: 'force' }] } }] },
    { level: 14, hpDie: 12, choices: [], grants: [{ kind: 'feature', value: { id: 'chaotic_fury_ua', name: 'Chaotic Fury', description: 'As a bonus action, reroll on the Wild Surge table, replacing your current effect with the new one.', source: { kind: 'subclass', refId: 'path_of_the_wild_soul_ua' }, level: 14, effects: [], actions: [], choices: [], passive: false,
      activation: { actionType: 'bonus_action', resourceCost: null, range: 'self', target: 'self', requiresSave: null },
      abilityEffects: [] } }] },
  ],
};

export const BARBARIAN_SUBCLASSES: SubclassProgression[] = [
  berserkerProgression,
  totemWarriorProgression,
  pathOfTheBeastProgression,
  pathOfWildMagicProgression,
  pathOfTheAncestralGuardianProgression,
  pathOfTheBattleragerProgression,
  pathOfTheGiantProgression,
  pathOfTheStormHeraldProgression,
  pathOfTheZealotProgression,
  pathOfTheBeastUaProgression,
  pathOfTheGiantUaProgression,
  pathOfTheWildSoulUaProgression,
];
