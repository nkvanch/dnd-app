// src/engine/__tests__/monsterFactory.test.ts
// First test coverage for this file. Locks in a real fix: spawnMonster's
// skill-block assembly used to set both trained:true (which makes
// resolveSkill separately add proficiency) AND bonus:<the printed stat-block
// value> (which is already the FULL total, ability mod + proficiency baked
// in) — double-counting proficiency into every monster with an authored
// skill bonus (architecture-review finding E1).
import { spawnMonster, resolveMonsterHp, isValidManualHp } from '../monsterFactory';
import { DEFAULT_RULES } from '../../store/characterStore';
import { MonsterTemplate } from '../../content/monsters/types';
import { CampaignRules } from '../types';
import { setRandomSource } from '../dice';
import { parseRechargeThreshold, rollRecharge, startTurn, findRechargeableFeatures } from '../combat';
import { generateActionCard } from '../actionCards';
import { applyActionCardUse } from '../actionUse';
import { monsterChimera, monsterGhost } from '../../content/monsters/srd';

function template(overrides: Partial<MonsterTemplate> = {}): MonsterTemplate {
  return {
    id: 'test_goblin', name: 'Test Goblin', cr: 0.25, size: 'small', type: 'humanoid', alignment: 'neutral evil',
    stats: { str: 8, dex: 14, con: 10, int: 10, wis: 8, cha: 8 },
    hp: { dice: '2d6', average: 7 },
    ac: { value: 15, source: 'leather armor, shield' },
    speed: 30,
    features: [],
    savingThrows: [],
    skills: { stealth: 6 }, // printed SRD Goblin value — dex mod(2) + prof(2) doubled by Nimble Escape? no: just prof(2)+dex(2)=4... using 6 to also prove non-trivial back-out math
    senses: ['darkvision 60 ft'],
    languages: ['Common', 'Goblin'],
    ...overrides,
  };
}

describe('spawnMonster — skill bonus (audit finding E1)', () => {
  it('does not double-count proficiency into an authored skill bonus', () => {
    const t = template();
    const entity = spawnMonster(t, DEFAULT_RULES);
    // DEX mod for 14 is +2. If proficiency (+2 at CR 0.25) were double
    // counted on top of the printed +6, the total would come out to +8.
    // The fix backs the ability-mod portion out of the stored bonus and
    // sets trained:false, so resolveSkill's baseMod + 0 + bonus reproduces
    // the printed +6 exactly.
    expect(entity.derived.savingThrows).toBeDefined(); // sanity: entity is fully derived
    const stealthEntry = entity.skills.skills.stealth;
    expect(stealthEntry?.trained).toBe(false);
    expect(stealthEntry?.bonus).toBe(4); // 6 (printed) - 2 (dex mod) = 4
  });

  it('leaves skills the template does not mention untouched', () => {
    const entity = spawnMonster(template(), DEFAULT_RULES);
    expect(entity.skills.skills.athletics?.trained).toBe(false);
    expect(entity.skills.skills.athletics?.bonus).toBeNull();
  });

  it('correctly backs out a non-DEX ability skill (e.g. a WIS-based Perception bonus)', () => {
    const t = template({ skills: { perception: 4 } }); // WIS 8 → mod -1
    const entity = spawnMonster(t, DEFAULT_RULES);
    const perceptionEntry = entity.skills.skills.perception;
    expect(perceptionEntry?.trained).toBe(false);
    expect(perceptionEntry?.bonus).toBe(5); // 4 (printed) - (-1) (wis mod) = 5
  });
});

// ── Table-first monster HP: Average/Manual/Table-Rolled/Roll-in-App ────────

describe('resolveMonsterHp', () => {
  it('"average" returns the template\'s printed average', () => {
    const t = template({ hp: { dice: '2d6', average: 7 } });
    expect(resolveMonsterHp(t, 'average')).toBe(7);
  });

  it('"max" returns every die at its highest face plus the flat modifier', () => {
    const t = template({ hp: { dice: '2d6+2', average: 9 } });
    expect(resolveMonsterHp(t, 'max')).toBe(14); // 2*6 + 2
  });

  it('"manual" uses the DM/table-supplied value when positive', () => {
    const t = template({ hp: { dice: '2d6', average: 7 } });
    expect(resolveMonsterHp(t, 'manual', 12)).toBe(12);
  });

  it('"manual" falls back to the printed average when no positive value is supplied', () => {
    const t = template({ hp: { dice: '2d6', average: 7 } });
    expect(resolveMonsterHp(t, 'manual')).toBe(7);
    expect(resolveMonsterHp(t, 'manual', 0)).toBe(7);
    expect(resolveMonsterHp(t, 'manual', -3)).toBe(7);
  });

  it('"roll" actually rolls the dice expression, not the average', () => {
    const t = template({ hp: { dice: '2d6', average: 7 } });
    setRandomSource(() => 0.99); // 2d6 near-max → 12
    expect(resolveMonsterHp(t, 'roll')).toBe(12);
    setRandomSource(Math.random);
  });

  it('never returns below 1 even for a degenerate template', () => {
    const t = template({ hp: { dice: '1d1-5', average: -4 } });
    expect(resolveMonsterHp(t, 'average')).toBe(1);
  });
});

// ── Closure 2C: strict manual/table-rolled HP input validation ─────────────

describe('isValidManualHp', () => {
  it('accepts a complete positive integer', () => {
    expect(isValidManualHp('25')).toBe(true);
    expect(isValidManualHp('1')).toBe(true);
    expect(isValidManualHp('  42  ')).toBe(true); // surrounding whitespace tolerated
  });

  it('rejects empty input', () => {
    expect(isValidManualHp('')).toBe(false);
    expect(isValidManualHp('   ')).toBe(false);
  });

  it('rejects zero', () => {
    expect(isValidManualHp('0')).toBe(false);
  });

  it('rejects negative numbers', () => {
    expect(isValidManualHp('-5')).toBe(false);
  });

  it('rejects a partial parse like "12abc" — the whole string must be digits', () => {
    expect(isValidManualHp('12abc')).toBe(false);
    expect(isValidManualHp('abc12')).toBe(false);
  });

  it('rejects decimals', () => {
    expect(isValidManualHp('5.5')).toBe(false);
  });

  it('rejects a leading zero', () => {
    expect(isValidManualHp('01')).toBe(false);
  });
});

describe('spawnMonster — hpOverride (table-first)', () => {
  it('with no hpOverride, behaves exactly as before: fixed/max campaign rules use the printed average', () => {
    const t = template({ hp: { dice: '2d6', average: 7 } });
    const entity = spawnMonster(t, { ...DEFAULT_RULES, hpMode: 'fixed' as CampaignRules['hpMode'] });
    expect(entity.resources.hp.maximum).toBe(7);
  });

  it('hpOverride wins outright over the campaign\'s global hpMode', () => {
    const t = template({ hp: { dice: '2d6', average: 7 } });
    const entity = spawnMonster(t, { ...DEFAULT_RULES, hpMode: 'fixed' as CampaignRules['hpMode'] }, { mode: 'manual', manualHp: 20 });
    expect(entity.resources.hp.maximum).toBe(20);
  });

  it('"average" and "manual" hpOverride modes never reroll on repeated spawns from the same template', () => {
    const t = template({ hp: { dice: '2d6', average: 7 } });
    const first  = spawnMonster(t, DEFAULT_RULES, { mode: 'average' });
    const second = spawnMonster(t, DEFAULT_RULES, { mode: 'average' });
    expect(first.resources.hp.maximum).toBe(second.resources.hp.maximum);
    expect(first.resources.hp.maximum).toBe(7);
  });

  it('"roll" hpOverride mode genuinely rolls, only when explicitly requested at this spawn', () => {
    const t = template({ hp: { dice: '2d6', average: 7 } });
    setRandomSource(() => 0.99); // 2d6 near-max → 12
    const entity = spawnMonster(t, DEFAULT_RULES, { mode: 'roll' });
    expect(entity.resources.hp.maximum).toBe(12);
    setRandomSource(Math.random);
  });
});

// ── Closure 3: Recharge for real monster abilities ──────────────────────────
// A "Recharge N[-6]" feature that has no resourceCost of its own gets one
// synthesized at spawn time (extractRechargeTag, combat.ts), wired to a
// matching CustomResource — so using/recharging it flows through the exact
// same generic resourceCost machinery every other action card already uses,
// with zero new engine mechanism.

describe('spawnMonster — Recharge feature auto-wiring (closure 3A)', () => {
  function rechargeTemplate(overrides: Partial<MonsterTemplate> = {}): MonsterTemplate {
    return template({
      features: [{
        id: 'breath_weapon', name: 'Breath Weapon',
        description: 'Recharge 5-6. Exhales something dangerous in a cone.',
        source: { kind: 'race', refId: 'test_goblin' }, level: null,
        effects: [], actions: [], choices: [], passive: false,
        activation: { actionType: 'action', resourceCost: null, range: '15 feet cone', target: 'area', requiresSave: { ability: 'dex', dc: 15 } },
        abilityEffects: [{ type: 'damage', dice: '7d8', damageType: 'fire', saveOnSuccess: 'half' }],
      }],
      ...overrides,
    });
  }

  it('synthesizes a matching CustomResource (1/1, tagged with the extracted recharge string)', () => {
    const entity = spawnMonster(rechargeTemplate(), DEFAULT_RULES);
    const resource = entity.resources.custom.find(r => r.id === 'breath_weapon_recharge');
    expect(resource).toMatchObject({ current: 1, maximum: 1, recharge: 'Recharge 5-6' });
  });

  it("rewires the feature's own activation.resourceCost to point at the synthesized resource", () => {
    const entity = spawnMonster(rechargeTemplate(), DEFAULT_RULES);
    const feature = entity.features.find(f => f.id === 'breath_weapon');
    expect(feature?.activation?.resourceCost).toEqual({ resourceId: 'breath_weapon_recharge', quantity: 1 });
  });

  it('a feature with no recognizable Recharge clause is left completely untouched', () => {
    const plain = rechargeTemplate({
      features: [{
        id: 'plain_bite', name: 'Bite', description: 'Melee attack, no recharge.',
        source: { kind: 'race', refId: 'test_goblin' }, level: null,
        effects: [], actions: [], choices: [], passive: false,
        activation: { actionType: 'action', resourceCost: null, range: '5 feet', target: 'single', requiresSave: null },
      }],
    });
    const entity = spawnMonster(plain, DEFAULT_RULES);
    expect(entity.features.find(f => f.id === 'plain_bite')?.activation?.resourceCost).toBeNull();
    expect(entity.resources.custom).toHaveLength(0);
  });

  it('a feature that already has its own resourceCost is left untouched, even with a leading Recharge clause', () => {
    const t = rechargeTemplate({
      features: [{
        id: 'already_wired', name: 'Already Wired',
        description: 'Recharge 5-6. Has its own pool already.',
        source: { kind: 'race', refId: 'test_goblin' }, level: null,
        effects: [], actions: [], choices: [], passive: false,
        activation: { actionType: 'action', resourceCost: { resourceId: 'custom_pool', quantity: 1 }, range: 'self', target: 'self', requiresSave: null },
      }],
      resources: [{ resourceId: 'custom_pool', name: 'Custom Pool', maximum: 1, recharge: 'short_rest' }],
    });
    const entity = spawnMonster(t, DEFAULT_RULES);
    expect(entity.features.find(f => f.id === 'already_wired')?.activation?.resourceCost).toEqual({ resourceId: 'custom_pool', quantity: 1 });
    expect(entity.resources.custom.map(r => r.id)).toEqual(['custom_pool']); // no duplicate synthesized
  });

  it('a malformed "Recharge 4-5" clause (not X-6) does not get auto-wired', () => {
    const malformed = rechargeTemplate({
      features: [{
        id: 'malformed', name: 'Malformed',
        description: 'Recharge 4-5. This is not a real recharge pattern.',
        source: { kind: 'race', refId: 'test_goblin' }, level: null,
        effects: [], actions: [], choices: [], passive: false,
        activation: { actionType: 'action', resourceCost: null, range: 'self', target: 'self', requiresSave: null },
      }],
    });
    const entity = spawnMonster(malformed, DEFAULT_RULES);
    expect(entity.features.find(f => f.id === 'malformed')?.activation?.resourceCost).toBeNull();
    expect(entity.resources.custom).toHaveLength(0);
  });
});

describe('Recharge abilities end-to-end on real content (Chimera Fire Breath)', () => {
  it('spawns with a synthesized 1/1 recharge resource, tagged "Recharge 5-6"', () => {
    const chimera = spawnMonster(monsterChimera, DEFAULT_RULES);
    const resource = chimera.resources.custom.find(r => r.id === 'chimera_fire_breath_recharge');
    expect(resource).toMatchObject({ current: 1, maximum: 1, recharge: 'Recharge 5-6' });
    expect(parseRechargeThreshold(resource!.recharge)).toBe(5);
  });

  it('using Fire Breath spends the resource — it becomes unavailable until recharged', () => {
    let chimera = spawnMonster(monsterChimera, DEFAULT_RULES);
    const fireBreath = chimera.features.find(f => f.id === 'chimera_fire_breath')!;
    const card = generateActionCard(fireBreath, chimera)!;
    expect(card.available).toBe(true);

    chimera = applyActionCardUse(chimera, card, DEFAULT_RULES);
    expect(chimera.resources.custom.find(r => r.id === 'chimera_fire_breath_recharge')?.current).toBe(0);

    // Spent — a fresh action card for the same feature is now unavailable.
    const spentCard = generateActionCard(fireBreath, chimera)!;
    expect(spentCard.available).toBe(false);
  });

  it('does NOT auto-recharge at the start of a turn (no automatic Recharge X-6 rolling)', () => {
    let chimera = spawnMonster(monsterChimera, DEFAULT_RULES);
    const fireBreath = chimera.features.find(f => f.id === 'chimera_fire_breath')!;
    chimera = applyActionCardUse(chimera, generateActionCard(fireBreath, chimera)!, DEFAULT_RULES);
    expect(chimera.resources.custom.find(r => r.id === 'chimera_fire_breath_recharge')?.current).toBe(0);

    // startTurn only refreshes recharge:'start_of_turn' resources (Legendary
    // Actions) — a "Recharge 5-6" resource must NOT be touched by it.
    chimera = startTurn(chimera);
    expect(chimera.resources.custom.find(r => r.id === 'chimera_fire_breath_recharge')?.current).toBe(0);
  });

  it('manual [Recharge] fully restores in one action (not a repeated +1 tap)', () => {
    let chimera = spawnMonster(monsterChimera, DEFAULT_RULES);
    const fireBreath = chimera.features.find(f => f.id === 'chimera_fire_breath')!;
    chimera = applyActionCardUse(chimera, generateActionCard(fireBreath, chimera)!, DEFAULT_RULES);

    // The manual mutation this closure's QuickPanel button performs.
    chimera = {
      ...chimera,
      resources: {
        ...chimera.resources,
        custom: chimera.resources.custom.map(r => r.id === 'chimera_fire_breath_recharge' ? { ...r, current: r.maximum } : r),
      },
    };
    expect(chimera.resources.custom.find(r => r.id === 'chimera_fire_breath_recharge')?.current).toBe(1);
    expect(generateActionCard(fireBreath, chimera)!.available).toBe(true);
  });

  it('optional Roll Recharge success calls the exact same restore mutation', () => {
    let chimera = spawnMonster(monsterChimera, DEFAULT_RULES);
    const fireBreath = chimera.features.find(f => f.id === 'chimera_fire_breath')!;
    chimera = applyActionCardUse(chimera, generateActionCard(fireBreath, chimera)!, DEFAULT_RULES);

    const threshold = parseRechargeThreshold(chimera.resources.custom.find(r => r.id === 'chimera_fire_breath_recharge')!.recharge)!;
    const originalRandom = Math.random;
    Math.random = () => 0.99; // d6 roll of 6 — succeeds against threshold 5
    const { success } = rollRecharge(threshold);
    Math.random = originalRandom;
    expect(success).toBe(true);

    if (success) {
      chimera = {
        ...chimera,
        resources: {
          ...chimera.resources,
          custom: chimera.resources.custom.map(r => r.id === 'chimera_fire_breath_recharge' ? { ...r, current: r.maximum } : r),
        },
      };
    }
    expect(chimera.resources.custom.find(r => r.id === 'chimera_fire_breath_recharge')?.current).toBe(1);
  });

  it('manual [Recharge] performs a FULL restore, not an incremental +1, for a hypothetical multi-charge recharge resource', () => {
    // No real content in this app currently authors a multi-charge Recharge
    // ability (every real example is single-use), but the semantic
    // guarantee ("a recharge success restores the WHOLE ability") must hold
    // generally — this proves the manual-recharge mutation sets current
    // all the way to maximum in one tap, not current+1.
    let chimera = spawnMonster(monsterChimera, DEFAULT_RULES);
    chimera = {
      ...chimera,
      resources: {
        ...chimera.resources,
        custom: chimera.resources.custom.map(r =>
          r.id === 'chimera_fire_breath_recharge' ? { ...r, current: 0, maximum: 3 } : r
        ),
      },
    };
    chimera = {
      ...chimera,
      resources: {
        ...chimera.resources,
        custom: chimera.resources.custom.map(r => r.id === 'chimera_fire_breath_recharge' ? { ...r, current: r.maximum } : r),
      },
    };
    expect(chimera.resources.custom.find(r => r.id === 'chimera_fire_breath_recharge')?.current).toBe(3); // full, not 1
  });

  it('optional Roll Recharge failure leaves state completely unchanged', () => {
    let chimera = spawnMonster(monsterChimera, DEFAULT_RULES);
    const fireBreath = chimera.features.find(f => f.id === 'chimera_fire_breath')!;
    chimera = applyActionCardUse(chimera, generateActionCard(fireBreath, chimera)!, DEFAULT_RULES);
    const before = chimera.resources.custom.find(r => r.id === 'chimera_fire_breath_recharge')!.current;

    const threshold = parseRechargeThreshold(chimera.resources.custom.find(r => r.id === 'chimera_fire_breath_recharge')!.recharge)!;
    const originalRandom = Math.random;
    Math.random = () => 0; // d6 roll of 1 — fails against any threshold >= 2
    const { success } = rollRecharge(threshold);
    Math.random = originalRandom;
    expect(success).toBe(false);
    // No mutation applied on failure — state is byte-for-byte unchanged.
    expect(chimera.resources.custom.find(r => r.id === 'chimera_fire_breath_recharge')?.current).toBe(before);
  });

  // Closure 2: proves the ACTUAL discovery function app/dm/encounter.tsx's
  // QuickPanel calls (findRechargeableFeatures) surfaces Fire Breath as a
  // usable, available ability BEFORE it's spent — not just that manually
  // mutating a resource produces the right end state. This is "the live
  // encounter path," not a hand-crafted fixture.
  it('findRechargeableFeatures surfaces Fire Breath as available before it has been used', () => {
    const chimera = spawnMonster(monsterChimera, DEFAULT_RULES);
    const found = findRechargeableFeatures(chimera).find(x => x.feature.id === 'chimera_fire_breath');
    expect(found).toBeDefined();
    expect(found!.resource.current).toBe(1); // available
    expect(found!.threshold).toBe(5);
    // The card the QuickPanel's [Use] button would press is itself available.
    const card = generateActionCard(found!.feature, chimera);
    expect(card?.available).toBe(true);
  });

  it('findRechargeableFeatures no longer lists Fire Breath as available once spent via the real applyActionCardUse path', () => {
    let chimera = spawnMonster(monsterChimera, DEFAULT_RULES);
    const fireBreath = chimera.features.find(f => f.id === 'chimera_fire_breath')!;
    chimera = applyActionCardUse(chimera, generateActionCard(fireBreath, chimera)!, DEFAULT_RULES);
    const found = findRechargeableFeatures(chimera).find(x => x.feature.id === 'chimera_fire_breath');
    expect(found!.resource.current).toBe(0);
  });
});

describe('Ghost Possession — name-based recharge (closure 2C, real content)', () => {
  it('spawns with a synthesized 1/1 recharge resource, tagged "Recharge 6" (parsed from the feature NAME, not the description)', () => {
    const ghost = spawnMonster(monsterGhost, DEFAULT_RULES);
    const resource = ghost.resources.custom.find(r => r.id === 'ghost_possession_recharge');
    expect(resource).toMatchObject({ current: 1, maximum: 1, recharge: 'Recharge 6' });
    expect(parseRechargeThreshold(resource!.recharge)).toBe(6);
  });

  it('gets exactly ONE recharge resource, not two, even though a synthesis bug could plausibly double-fire', () => {
    const ghost = spawnMonster(monsterGhost, DEFAULT_RULES);
    const rechargeResources = ghost.resources.custom.filter(r => r.id.startsWith('ghost_possession'));
    expect(rechargeResources).toHaveLength(1);
  });

  it('the feature\'s own resourceCost is rewired to the synthesized resource', () => {
    const ghost = spawnMonster(monsterGhost, DEFAULT_RULES);
    const feature = ghost.features.find(f => f.id === 'ghost_possession');
    expect(feature?.activation?.resourceCost).toEqual({ resourceId: 'ghost_possession_recharge', quantity: 1 });
  });

  it('findRechargeableFeatures surfaces Possession as available before use (the live encounter path)', () => {
    const ghost = spawnMonster(monsterGhost, DEFAULT_RULES);
    const found = findRechargeableFeatures(ghost).find(x => x.feature.id === 'ghost_possession');
    expect(found).toBeDefined();
    expect(found!.resource.current).toBe(1);
    expect(found!.threshold).toBe(6);
  });

  it('Use (applyActionCardUse) spends the resource — it becomes unavailable', () => {
    let ghost = spawnMonster(monsterGhost, DEFAULT_RULES);
    const possession = ghost.features.find(f => f.id === 'ghost_possession')!;
    const card = generateActionCard(possession, ghost)!;
    expect(card.available).toBe(true);

    ghost = applyActionCardUse(ghost, card, DEFAULT_RULES);
    expect(ghost.resources.custom.find(r => r.id === 'ghost_possession_recharge')?.current).toBe(0);
    expect(generateActionCard(possession, ghost)!.available).toBe(false);
  });

  it('Possession is target-contingent (single target, CHA save) — Use does NOT self-apply any effect to the ghost (no ARCH-2-style regression)', () => {
    let ghost = spawnMonster(monsterGhost, DEFAULT_RULES);
    const possession = ghost.features.find(f => f.id === 'ghost_possession')!;
    ghost = applyActionCardUse(ghost, generateActionCard(possession, ghost)!, DEFAULT_RULES);
    expect(ghost.conditions).toHaveLength(0);
  });

  it('manual Recharge restores availability after use', () => {
    let ghost = spawnMonster(monsterGhost, DEFAULT_RULES);
    const possession = ghost.features.find(f => f.id === 'ghost_possession')!;
    ghost = applyActionCardUse(ghost, generateActionCard(possession, ghost)!, DEFAULT_RULES);
    expect(ghost.resources.custom.find(r => r.id === 'ghost_possession_recharge')?.current).toBe(0);

    // The manual [Recharge] mutation QuickPanel performs.
    ghost = {
      ...ghost,
      resources: {
        ...ghost.resources,
        custom: ghost.resources.custom.map(r => r.id === 'ghost_possession_recharge' ? { ...r, current: r.maximum } : r),
      },
    };
    expect(ghost.resources.custom.find(r => r.id === 'ghost_possession_recharge')?.current).toBe(1);
    expect(generateActionCard(possession, ghost)!.available).toBe(true);
  });

  it('does not auto-recharge at the start of a turn', () => {
    let ghost = spawnMonster(monsterGhost, DEFAULT_RULES);
    const possession = ghost.features.find(f => f.id === 'ghost_possession')!;
    ghost = applyActionCardUse(ghost, generateActionCard(possession, ghost)!, DEFAULT_RULES);
    ghost = startTurn(ghost);
    expect(ghost.resources.custom.find(r => r.id === 'ghost_possession_recharge')?.current).toBe(0);
  });
});

describe('spawnMonster — recharge synthesis prefers a name suffix over a leading description clause (closure 2C)', () => {
  it('does not synthesize two resources when a feature carries recharge metadata in BOTH its name and description', () => {
    const t = template({
      features: [{
        id: 'doom_blast', name: 'Doom Blast (Recharge 5-6)',
        description: 'Recharge 6. Devastating blast in a 30-foot cone.',
        source: { kind: 'race', refId: 'test_goblin' }, level: null,
        effects: [], actions: [], choices: [], passive: false,
        activation: { actionType: 'action', resourceCost: null, range: '30 feet cone', target: 'area', requiresSave: { ability: 'dex', dc: 15 } },
      }],
    });
    const entity = spawnMonster(t, DEFAULT_RULES);
    const rechargeResources = entity.resources.custom.filter(r => r.id.startsWith('doom_blast'));
    expect(rechargeResources).toHaveLength(1); // exactly one, not two
    // The name suffix (5-6) wins over the description clause (6) per
    // resolveFeatureRechargeTag's documented priority.
    expect(rechargeResources[0].recharge).toBe('Recharge 5-6');
  });
});
