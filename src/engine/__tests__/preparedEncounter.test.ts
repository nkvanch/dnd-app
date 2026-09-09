// src/engine/__tests__/preparedEncounter.test.ts
// First test coverage for preparedEncounter.ts — the DM-prep pipeline that
// turns a PreparedEncounter template into live Entity instances. Focuses on
// the properties that matter for a planning template: instantiating twice
// must produce independent entities, quantity expansion, each hpMode's
// actual HP result, wave filtering (the "present from the start" vs
// "deployed on demand" split), and starting-condition application.
import {
  newPreparedEncounter, newPreparedCombatant, newEncounterWave,
  instantiatePreparedEncounter, instantiateWave, startingCombatantCount,
} from '../preparedEncounter';
import { resolveMonsterById } from '../../content/contentResolution';
import { DEFAULT_RULES } from '../../store/characterStore';
import { setRandomSource } from '../dice';
import { MonsterTemplate } from '../../content/monsters/types';
import { PreparedEncounter } from '../types';

const GOBLIN: MonsterTemplate = {
  id: 'test_goblin', name: 'Test Goblin', cr: 0.25, size: 'small', type: 'humanoid',
  alignment: 'neutral evil',
  stats: { str: 8, dex: 14, con: 10, int: 10, wis: 8, cha: 8 },
  hp: { dice: '2d6', average: 7 },
  ac: { value: 15, source: 'leather armor, shield' },
  speed: 30,
  features: [],
  savingThrows: [],
  skills: {},
  senses: ['darkvision 60 ft'],
  languages: ['Common', 'Goblin'],
};

// Sanity check the fixture actually resolves the way the real content
// registry does, since instantiatePreparedEncounter goes through
// resolveMonsterById(id, homebrewMonsters) rather than taking a template directly.
describe('preparedEncounter fixture sanity', () => {
  it('resolves the test goblin via resolveMonsterById when passed as homebrew', () => {
    expect(resolveMonsterById('test_goblin', [GOBLIN])?.name).toBe('Test Goblin');
  });
});

function makeEncounter(overrides: Partial<PreparedEncounter> = {}): PreparedEncounter {
  return { ...newPreparedEncounter('Test Fight'), ...overrides };
}

describe('instantiatePreparedEncounter', () => {
  afterEach(() => setRandomSource(Math.random));

  it('expands quantity into independent entities with distinct ids and suffixed names', () => {
    const combatant = { ...newPreparedCombatant('test_goblin'), quantity: 3 };
    const prepared = makeEncounter({ combatants: [combatant] });
    const entities = instantiatePreparedEncounter(prepared, DEFAULT_RULES, [GOBLIN]);

    expect(entities).toHaveLength(3);
    const ids = new Set(entities.map(e => e.id));
    expect(ids.size).toBe(3); // all distinct
    expect(entities.map(e => e.identity.name)).toEqual(['Test Goblin 1', 'Test Goblin 2', 'Test Goblin 3']);
  });

  it('does not suffix the name when quantity is 1', () => {
    const prepared = makeEncounter({ combatants: [newPreparedCombatant('test_goblin')] });
    const entities = instantiatePreparedEncounter(prepared, DEFAULT_RULES, [GOBLIN]);
    expect(entities[0].identity.name).toBe('Test Goblin');
  });

  it('two separate calls against the same template produce fully independent entities (no shared mutable state)', () => {
    const prepared = makeEncounter({ combatants: [newPreparedCombatant('test_goblin')] });
    const first  = instantiatePreparedEncounter(prepared, DEFAULT_RULES, [GOBLIN]);
    const second = instantiatePreparedEncounter(prepared, DEFAULT_RULES, [GOBLIN]);
    expect(first[0].id).not.toBe(second[0].id);
    first[0].resources.hp.current = -999; // mutate one copy directly
    expect(second[0].resources.hp.current).not.toBe(-999);
  });

  it('skips a combatant whose monsterId cannot be resolved, instead of crashing', () => {
    const prepared = makeEncounter({ combatants: [newPreparedCombatant('does_not_exist')] });
    expect(() => instantiatePreparedEncounter(prepared, DEFAULT_RULES, [GOBLIN])).not.toThrow();
    expect(instantiatePreparedEncounter(prepared, DEFAULT_RULES, [GOBLIN])).toHaveLength(0);
  });

  describe('hpMode', () => {
    it('average uses the template printed average', () => {
      const combatant = { ...newPreparedCombatant('test_goblin'), hpMode: 'average' as const };
      const prepared = makeEncounter({ combatants: [combatant] });
      const [entity] = instantiatePreparedEncounter(prepared, DEFAULT_RULES, [GOBLIN]);
      expect(entity.resources.hp.maximum).toBe(7);
    });

    it('max uses every die at its highest face plus the flat modifier', () => {
      const combatant = { ...newPreparedCombatant('test_goblin'), hpMode: 'max' as const };
      const prepared = makeEncounter({ combatants: [combatant] });
      const [entity] = instantiatePreparedEncounter(prepared, DEFAULT_RULES, [GOBLIN]);
      expect(entity.resources.hp.maximum).toBe(12); // 2d6 max = 2*6
    });

    it('manual uses the combatant-specified HP', () => {
      const combatant = { ...newPreparedCombatant('test_goblin'), hpMode: 'manual' as const, manualHp: 25 };
      const prepared = makeEncounter({ combatants: [combatant] });
      const [entity] = instantiatePreparedEncounter(prepared, DEFAULT_RULES, [GOBLIN]);
      expect(entity.resources.hp.maximum).toBe(25);
    });

    it('manual falls back to the template average when manualHp is unset or non-positive', () => {
      const combatant = { ...newPreparedCombatant('test_goblin'), hpMode: 'manual' as const, manualHp: 0 };
      const prepared = makeEncounter({ combatants: [combatant] });
      const [entity] = instantiatePreparedEncounter(prepared, DEFAULT_RULES, [GOBLIN]);
      expect(entity.resources.hp.maximum).toBe(7);
    });

    it('roll uses rollExpression against the template dice, independent of the campaign hpMode', () => {
      setRandomSource(() => 0); // every die rolls a 1
      const combatant = { ...newPreparedCombatant('test_goblin'), hpMode: 'roll' as const };
      const prepared = makeEncounter({ combatants: [combatant] });
      const [entity] = instantiatePreparedEncounter(prepared, { ...DEFAULT_RULES, hpMode: 'max' }, [GOBLIN]);
      expect(entity.resources.hp.maximum).toBe(2); // 2d6 -> 1+1
    });

    it('HP is always clamped to at least 1', () => {
      const lowRoll: MonsterTemplate = { ...GOBLIN, hp: { dice: '1d1-10', average: 0 } };
      const combatant = { ...newPreparedCombatant('test_goblin'), hpMode: 'average' as const };
      const prepared = makeEncounter({ combatants: [combatant] });
      const [entity] = instantiatePreparedEncounter(prepared, DEFAULT_RULES, [lowRoll]);
      expect(entity.resources.hp.maximum).toBeGreaterThanOrEqual(1);
    });
  });

  describe('wave filtering', () => {
    it('with no deployWaveIds arg, includes only combatants with no waveId', () => {
      const wave = newEncounterWave('Reinforcements');
      const upfront = newPreparedCombatant('test_goblin');
      const waved   = { ...newPreparedCombatant('test_goblin'), waveId: wave.id };
      const prepared = makeEncounter({ waves: [wave], combatants: [upfront, waved] });

      const entities = instantiatePreparedEncounter(prepared, DEFAULT_RULES, [GOBLIN]);
      expect(entities).toHaveLength(1);
    });

    it("'all' includes every combatant regardless of wave assignment", () => {
      const wave = newEncounterWave('Reinforcements');
      const upfront = newPreparedCombatant('test_goblin');
      const waved   = { ...newPreparedCombatant('test_goblin'), waveId: wave.id };
      const prepared = makeEncounter({ waves: [wave], combatants: [upfront, waved] });

      const entities = instantiatePreparedEncounter(prepared, DEFAULT_RULES, [GOBLIN], 'all');
      expect(entities).toHaveLength(2);
    });

    it('instantiateWave includes only that wave, excluding upfront and other-wave combatants', () => {
      const waveA = newEncounterWave('Wave A');
      const waveB = newEncounterWave('Wave B');
      const upfront = newPreparedCombatant('test_goblin');
      const inA = { ...newPreparedCombatant('test_goblin'), waveId: waveA.id };
      const inB = { ...newPreparedCombatant('test_goblin'), waveId: waveB.id };
      const prepared = makeEncounter({ waves: [waveA, waveB], combatants: [upfront, inA, inB] });

      const entities = instantiateWave(prepared, waveA.id, DEFAULT_RULES, [GOBLIN]);
      expect(entities).toHaveLength(1);
    });
  });

  it('applies starting conditions to the spawned entity', () => {
    const combatant = { ...newPreparedCombatant('test_goblin'), startingConditionIds: ['prone'] };
    const prepared = makeEncounter({ combatants: [combatant] });
    const [entity] = instantiatePreparedEncounter(prepared, DEFAULT_RULES, [GOBLIN]);
    expect(entity.conditionMonitor.active.some(c => c.id === 'prone')).toBe(true);
  });
});

describe('startingCombatantCount', () => {
  it('counts only non-waved combatants, expanded by quantity', () => {
    const wave = newEncounterWave('Later');
    const prepared = makeEncounter({
      waves: [wave],
      combatants: [
        { ...newPreparedCombatant('test_goblin'), quantity: 3 },
        { ...newPreparedCombatant('test_goblin'), quantity: 5, waveId: wave.id },
      ],
    });
    expect(startingCombatantCount(prepared)).toBe(3);
  });
});
