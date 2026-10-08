// src/engine/houseRules.ts
// Typed accessors over CampaignRules.customRules.
// Three rule shapes: boolean (Book/Homebrew), choice, number.
// Mechanically-enforced rules are read by engine code.
// reminderOnly rules are shown as table notes but NOT auto-enforced.
import { CampaignRules } from './types';

export type HouseRuleKind = 'boolean' | 'choice' | 'number';
export type HouseRuleOption = { value: string; label: string };

export type HouseRuleDef = {
  key:           string;
  label:         string;
  description:   string;
  kind:          HouseRuleKind;
  section:       string;
  bookDefault?:  boolean;
  bookLabel?:    string;
  homebrewLabel?: string;
  options?:      HouseRuleOption[];
  choiceDefault?: string;
  numberDefault?: number;
  min?:          number;
  max?:          number;
  reminderOnly?: boolean;
};

export const HOUSE_RULES: HouseRuleDef[] = [

  // ── Character Build ──────────────────────────────────────────────────────
  {
    key: 'skillOverlapMode', label: 'Background skill overlap', kind: 'choice',
    section: 'Character Build',
    description:
      '"Replacement" opens extra skills so you never lose a pick when your ' +
      'background overlaps your class list. "Warn" keeps you on the class list ' +
      'and shows a confirmation before accepting fewer skills.',
    options: [
      { value: 'replacement', label: 'Replacement — never lose a pick' },
      { value: 'warn',        label: 'Warn — stay on class list' },
    ],
    choiceDefault: 'replacement',
  },
  {
    key: 'asiMode', label: 'At ASI levels, grant', kind: 'choice',
    section: 'Character Build',
    description:
      'What an ASI level offers the player. Book = choose between an ASI or a feat. ' +
      '"Both" gives an ability increase AND a feat (high-power house rule).',
    options: [
      { value: 'asi_or_feat', label: 'ASI or Feat (book)' },
      { value: 'asi_only',    label: 'ASI only' },
      { value: 'feat_only',   label: 'Feat only' },
      { value: 'both',        label: 'ASI + Feat (both)' },
    ],
    choiceDefault: 'asi_or_feat',
  },
  {
    key: 'bonusFeatEveryLevel', label: 'Bonus feat every level', kind: 'boolean',
    section: 'Character Build',
    description: 'Grant an extra feat choice at every level-up. For high-powered campaigns.',
    bookDefault: false,
    bookLabel: 'ASI levels only', homebrewLabel: 'Every level',
  },
  {
    key: 'featAtCreation', label: 'Feat at 1st level', kind: 'boolean',
    section: 'Character Build',
    description: 'Allow a character to take a feat at 1st level (variant human / custom origin rule).',
    bookDefault: false,
    bookLabel: 'No feat at 1st', homebrewLabel: 'Yes — feat at 1st',
  },
  {
    key: 'pointBuyPoints', label: 'Point-buy budget', kind: 'number',
    section: 'Character Build',
    description: 'Total points available in point-buy. Book = 27.',
    numberDefault: 27, min: 10, max: 60,
  },
  {
    key: 'pointBuyMax', label: 'Point-buy max score', kind: 'number',
    section: 'Character Build',
    description: 'Highest score purchasable before racial bonuses. Book = 15.',
    numberDefault: 15, min: 13, max: 18,
  },
  {
    key: 'pointBuyMin', label: 'Point-buy min score', kind: 'number',
    section: 'Character Build',
    description: 'Lowest score allowed in point-buy. Book = 8.',
    numberDefault: 8, min: 3, max: 10,
  },

  // ── Combat ───────────────────────────────────────────────────────────────
  {
    key: 'flankingMode', label: 'Flanking', kind: 'choice',
    section: 'Combat',
    description: 'How flanking with an ally affects attacks. Book = no bonus.',
    options: [
      { value: 'off',       label: 'No bonus (book)' },
      { value: 'advantage', label: 'Advantage (DMG variant)' },
      { value: 'plus_two',  label: '+2 bonus (mild house rule)' },
    ],
    choiceDefault: 'off',
  },
  {
    key: 'hpMinHalfDie', label: 'HP minimum half-die on level-up', kind: 'boolean',
    section: 'Combat',
    description:
      'When rolling HP on level-up, any roll below half the die is bumped up to ' +
      'half rounded up (e.g. d10: a 1–4 becomes 5). Only affects rolled HP mode.',
    bookDefault: false,
    bookLabel: 'Roll freely', homebrewLabel: 'Min half-die',
  },
  {
    key: 'largeCreatureWeaponDice', label: 'Large creatures: double weapon dice', kind: 'boolean',
    section: 'Combat',
    description: 'Large or bigger creatures wielding appropriate weapons roll twice the damage dice (DMG).',
    bookDefault: false,
    bookLabel: 'Standard dice', homebrewLabel: 'Double dice',
  },
  {
    key: 'critMaxPlusRoll', label: 'Critical hits: Max + Roll', kind: 'boolean',
    section: 'Combat',
    description:
      'Reminder only — the app does not roll attacks. On a crit, deal the dice\'s ' +
      'maximum automatically, then roll a normal damage roll on top ' +
      '(e.g. 2d8+4 crit → 16 + 2d8 + 4). Off = book: roll double the dice.',
    bookDefault: false,
    bookLabel: 'Double dice (book)', homebrewLabel: 'Max + roll',
    reminderOnly: true,
  },

  // ── Resting ──────────────────────────────────────────────────────────────
  {
    key: 'shortRestMinutes', label: 'Short rest length', kind: 'choice',
    section: 'Resting',
    description: 'How long a short rest takes in fiction. Book = 1 hour.',
    options: [
      { value: '1',  label: '1 minute' },
      { value: '10', label: '10 minutes' },
      { value: '60', label: '1 hour (book)' },
    ],
    choiceDefault: '60',
  },
  {
    key: 'longRestHours', label: 'Long rest length', kind: 'choice',
    section: 'Resting',
    description: 'How long a long rest takes in fiction. Book = 8 hours.',
    options: [
      { value: '8',  label: '8 hours (book)' },
      { value: '24', label: '24 hours (gritty realism)' },
    ],
    choiceDefault: '8',
  },
  {
    key: 'fullHitDiceOnLongRest', label: 'Long rest restores all Hit Dice', kind: 'boolean',
    section: 'Resting',
    description: 'A long rest restores every spent Hit Die instead of only half your level.',
    bookDefault: false,
    bookLabel: 'Half level (book)', homebrewLabel: 'All Hit Dice',
  },

  // ── Death & Recovery ─────────────────────────────────────────────────────
  {
    key: 'deathSavesPersist', label: 'Death save failures persist', kind: 'boolean',
    section: 'Death & Recovery',
    description:
      'Book: death saves reset fully (0 successes, 0 failures) every time you drop ' +
      'to 0 HP, even if you\'ve stabilized and been dropped again since. When enabled, ' +
      'accumulated failures instead carry over between dying episodes until your next ' +
      'long rest, making repeated near-death more dangerous.',
    bookDefault: false,
    bookLabel: 'Clear on stabilise (book)', homebrewLabel: 'Persist to long rest',
  },

  // ── DM Visibility ───────────────────────────────────────────────
  {
    key: 'dmFullStatVisibility', label: 'DM sees full character stats', kind: 'boolean',
    section: 'DM Visibility',
    description:
      'Book: the DM dashboard shows only what a DM could reasonably observe at ' +
      'a glance — passive stats (Perception/Investigation), HP, movement speed, ' +
      'and AC. Enabling this reveals full stat blocks (all six abilities, ' +
      'skills, saving throws, inventory) on the dashboard AND enables DM ' +
      'Override there — overriding a stat the DM can\'t normally see doesn\'t ' +
      'make sense, so the two are gated together.',
    bookDefault: false,
    bookLabel: 'Passive stats only (book)', homebrewLabel: 'Full visibility + override',
  },

  // ── Monster Info ─────────────────────────────────────────────────────────
  {
    key: 'monsterHpDisplay', label: 'Show monster HP to players', kind: 'choice',
    section: 'Monster Info',
    description: 'How much HP information players see on monster cards. Book = DM only.',
    options: [
      { value: 'off',      label: 'Off — DM only (book)' },
      { value: 'bloodied', label: 'Bloodied only' },
      { value: 'percent',  label: 'Percentage' },
      { value: 'exact',    label: 'Exact HP' },
    ],
    choiceDefault: 'off',
  },
  {
    key: 'bloodiedThreshold', label: 'Bloodied threshold', kind: 'choice',
    section: 'Monster Info',
    description: 'The HP fraction at which a creature shows as "bloodied".',
    options: [
      { value: '0.5',  label: '50% — half health' },
      { value: '0.33', label: '33% — one third' },
      { value: '0.25', label: '25% — one quarter' },
    ],
    choiceDefault: '0.5',
  },
  {
    key: 'revealMonsterAc', label: 'Reveal monster AC', kind: 'choice',
    section: 'Monster Info',
    description: 'When players can see a monster\'s AC value.',
    options: [
      { value: 'never',     label: 'Never (book)' },
      { value: 'after_hit', label: 'After first hit' },
      { value: 'always',    label: 'Always' },
    ],
    choiceDefault: 'never',
  },

  // ── Homebrew ─────────────────────────────────────────────────────────────
  {
    key: 'allowHomebrew', label: 'Allow homebrew content', kind: 'choice',
    section: 'Homebrew',
    description: 'Controls where homebrew races, classes, items, and spells can be used.',
    options: [
      { value: 'off',      label: 'Off — official content only' },
      { value: 'campaign', label: 'Campaign only' },
      { value: 'global',   label: 'Global — all campaigns' },
    ],
    choiceDefault: 'campaign',
  },
  {
    key: 'homebrewNeedsApproval', label: 'Homebrew requires DM approval', kind: 'boolean',
    section: 'Homebrew',
    description: 'Player-created content cannot be used until the DM approves it.',
    bookDefault: false,
    bookLabel: 'Freely usable', homebrewLabel: 'DM approval required',
  },
  {
    key: 'lockPlayerFreeEdit', label: 'Lock player free-edit', kind: 'boolean',
    section: 'Homebrew',
    description: 'Prevents players from free-editing base stats, HP, or other values.',
    bookDefault: false,
    bookLabel: 'Players can free-edit', homebrewLabel: 'DM-locked',
  },

  // ── Table Reminders ───────────────────────────────────────────────────────
  {
    key: 'reminderPotionsBonusAction', label: 'Potions as a bonus action', kind: 'boolean',
    section: 'Table Reminders',
    description: 'Reminder only — the app doesn\'t track action economy. Drinking a potion costs a bonus action.',
    bookDefault: false,
    bookLabel: 'Action (book)', homebrewLabel: 'Bonus action',
    reminderOnly: true,
  },
  {
    key: 'reminderBonusActionSpellFree', label: 'No bonus-action spell restriction', kind: 'boolean',
    section: 'Table Reminders',
    description: 'Reminder only — removes the rule limiting you to a cantrip when casting a bonus-action spell.',
    bookDefault: false,
    bookLabel: 'Restricted (book)', homebrewLabel: 'Restriction removed',
    reminderOnly: true,
  },
  {
    key: 'reminderUnlimitedRituals', label: 'Unlimited ritual casting', kind: 'boolean',
    section: 'Table Reminders',
    description: 'Reminder only — any spell with the ritual tag can be cast as a ritual.',
    bookDefault: false,
    bookLabel: 'Standard (book)', homebrewLabel: 'Unlimited rituals',
    reminderOnly: true,
  },
  {
    key: 'reminderOaForcedMovement', label: 'OAs on forced movement', kind: 'boolean',
    section: 'Table Reminders',
    description: 'Reminder only — forced movement can provoke opportunity attacks.',
    bookDefault: false,
    bookLabel: 'No OA (book)', homebrewLabel: 'OA on forced move',
    reminderOnly: true,
  },
];

// ── Accessors ────────────────────────────────────────────────────────────────

function defFor(key: string): HouseRuleDef | undefined {
  return HOUSE_RULES.find(r => r.key === key);
}

export function getHouseRule(rules: CampaignRules, key: string): boolean {
  const def = defFor(key);
  const fallback = def?.bookDefault ?? false;
  const raw = rules.customRules?.[key];
  return typeof raw === 'boolean' ? raw : fallback;
}

export function getHouseChoice(rules: CampaignRules, key: string): string {
  const def = defFor(key);
  const fallback = def?.choiceDefault ?? '';
  const raw = rules.customRules?.[key];
  return typeof raw === 'string' ? raw : fallback;
}

export function getHouseNumber(rules: CampaignRules, key: string): number {
  const def = defFor(key);
  const fallback = def?.numberDefault ?? 0;
  const raw = rules.customRules?.[key];
  return typeof raw === 'number' ? raw : fallback;
}

export function setHouseRuleValue(
  rules: CampaignRules,
  key: string,
  value: boolean | string | number,
): Record<string, unknown> {
  return { ...(rules.customRules ?? {}), [key]: value };
}

export function setHouseRule(rules: CampaignRules, key: string, value: boolean): Record<string, unknown> {
  return setHouseRuleValue(rules, key, value);
}

// ── Convenience predicates ───────────────────────────────────────────────────

export function usesLargeCreatureWeaponDice(rules: CampaignRules): boolean {
  return getHouseRule(rules, 'largeCreatureWeaponDice');
}
export function playerFreeEditLocked(rules: CampaignRules): boolean {
  return getHouseRule(rules, 'lockPlayerFreeEdit');
}
/** Positive UI semantic avoids repeating/inverting the lock flag at call sites. */
export function canPlayerFreeEdit(rules: CampaignRules): boolean {
  return !playerFreeEditLocked(rules);
}
export function longRestRestoresAllHitDice(rules: CampaignRules): boolean {
  return getHouseRule(rules, 'fullHitDiceOnLongRest');
}
export function skillOverlapMode(rules: CampaignRules): 'replacement' | 'warn' {
  return getHouseChoice(rules, 'skillOverlapMode') === 'warn' ? 'warn' : 'replacement';
}
export function asiMode(rules: CampaignRules): 'asi_or_feat' | 'asi_only' | 'feat_only' | 'both' {
  const v = getHouseChoice(rules, 'asiMode');
  return (v === 'asi_only' || v === 'feat_only' || v === 'both') ? v : 'asi_or_feat';
}
export function bonusFeatEveryLevel(rules: CampaignRules): boolean {
  return getHouseRule(rules, 'bonusFeatEveryLevel');
}
export function critMode(rules: CampaignRules): 'double_dice' | 'max_plus_roll' {
  return getHouseRule(rules, 'critMaxPlusRoll') ? 'max_plus_roll' : 'double_dice';
}
export function hpMinHalfDie(rules: CampaignRules): boolean {
  return getHouseRule(rules, 'hpMinHalfDie');
}
export function shortRestMinutes(rules: CampaignRules): number {
  return parseInt(getHouseChoice(rules, 'shortRestMinutes'), 10) || 60;
}
export function longRestHours(rules: CampaignRules): number {
  return parseInt(getHouseChoice(rules, 'longRestHours'), 10) || 8;
}
export function deathSavesPersist(rules: CampaignRules): boolean {
  return getHouseRule(rules, 'deathSavesPersist');
}
export function pointBuyConfig(rules: CampaignRules): { points: number; max: number; min: number } {
  return {
    points: getHouseNumber(rules, 'pointBuyPoints') || 27,
    max:    getHouseNumber(rules, 'pointBuyMax') || 15,
    min:    getHouseNumber(rules, 'pointBuyMin') || 8,
  };
}
export function monsterHpDisplay(rules: CampaignRules): 'off' | 'bloodied' | 'percent' | 'exact' {
  const v = getHouseChoice(rules, 'monsterHpDisplay');
  return (v === 'bloodied' || v === 'percent' || v === 'exact') ? v : 'off';
}
export function bloodiedThreshold(rules: CampaignRules): number {
  return parseFloat(getHouseChoice(rules, 'bloodiedThreshold')) || 0.5;
}
export function revealMonsterAc(rules: CampaignRules): 'never' | 'after_hit' | 'always' {
  const v = getHouseChoice(rules, 'revealMonsterAc');
  return (v === 'after_hit' || v === 'always') ? v : 'never';
}
export function dmFullStatVisibility(rules: CampaignRules): boolean {
  return getHouseRule(rules, 'dmFullStatVisibility');
}
export function activeReminders(rules: CampaignRules): string[] {
  return HOUSE_RULES
    .filter(r => r.reminderOnly && getHouseRule(rules, r.key))
    .map(r => r.label);
}
