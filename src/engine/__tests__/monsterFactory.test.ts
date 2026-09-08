// src/engine/__tests__/monsterFactory.test.ts
// First test coverage for this file. Locks in a real fix: spawnMonster's
// skill-block assembly used to set both trained:true (which makes
// resolveSkill separately add proficiency) AND bonus:<the printed stat-block
// value> (which is already the FULL total, ability mod + proficiency baked
// in) — double-counting proficiency into every monster with an authored
// skill bonus (architecture-review finding E1).
import { spawnMonster } from '../monsterFactory';
import { DEFAULT_RULES } from '../../store/characterStore';
import { MonsterTemplate } from '../../content/monsters/types';

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
