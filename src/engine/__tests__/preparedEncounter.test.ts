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
  hasInvalidManualHp, invalidManualHpCombatants, combatantsWithInvalidManualHp,
} from '../preparedEncounter';
import { resolveMonsterById } from '../../content/contentResolution';
import { DEFAULT_RULES } from '../../store/characterStore';
import { setRandomSource } from '../dice';
import { MonsterTemplate } from '../../content/monsters/types';
import * as fs from 'fs';
import * as path from 'path';
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

  // ── Closure 2A/2B: HP resolved exactly once, no hidden/double roll ────────
  // spawnPreparedCombatant used to call spawnMonster(template, rules) with
  // NO hp override — under campaign rules.hpMode:'rolled', spawnMonster ran
  // its OWN real dice roll internally, and this file's own applyHpMode then
  // silently overwrote that result with a second, separately computed
  // value. The first roll was real (it consumed RNG) but invisible. These
  // tests assert on the actual RNG call COUNT, not just the final HP value,
  // since a hidden extra roll can produce the same final number by
  // coincidence and a value-only assertion wouldn't catch it.
  describe('closure 2: HP resolved exactly once (no hidden roll under a "rolled" campaign)', () => {
    afterEach(() => setRandomSource(Math.random));

    it('average never touches the RNG, even when the campaign hpMode is "rolled"', () => {
      let calls = 0;
      setRandomSource(() => { calls++; return 0.5; });
      const combatant = { ...newPreparedCombatant('test_goblin'), hpMode: 'average' as const };
      const prepared = makeEncounter({ combatants: [combatant] });
      const [entity] = instantiatePreparedEncounter(prepared, { ...DEFAULT_RULES, hpMode: 'rolled' }, [GOBLIN]);
      expect(calls).toBe(0);
      expect(entity.resources.hp.maximum).toBe(7);
    });

    it('manual never touches the RNG, even when the campaign hpMode is "rolled", and preserves the exact entered value', () => {
      let calls = 0;
      setRandomSource(() => { calls++; return 0.99; }); // would roll near-max if it were (wrongly) consulted
      const combatant = { ...newPreparedCombatant('test_goblin'), hpMode: 'manual' as const, manualHp: 33 };
      const prepared = makeEncounter({ combatants: [combatant] });
      const [entity] = instantiatePreparedEncounter(prepared, { ...DEFAULT_RULES, hpMode: 'rolled' }, [GOBLIN]);
      expect(calls).toBe(0);
      expect(entity.resources.hp.maximum).toBe(33); // not the near-max value a hidden roll would have produced
    });

    it('roll consults the RNG exactly once per die in the expression (2d6 → 2 calls), never twice for one spawn', () => {
      let calls = 0;
      setRandomSource(() => { calls++; return 0; });
      const combatant = { ...newPreparedCombatant('test_goblin'), hpMode: 'roll' as const };
      const prepared = makeEncounter({ combatants: [combatant] });
      instantiatePreparedEncounter(prepared, { ...DEFAULT_RULES, hpMode: 'rolled' }, [GOBLIN]);
      expect(calls).toBe(2); // exactly 2 (one per d6) — 4 would mean a hidden duplicate roll
    });

    it("a prepared combatant's chosen hpMode wins outright over the campaign's global hpMode either way (fixed campaign, manual combatant)", () => {
      const combatant = { ...newPreparedCombatant('test_goblin'), hpMode: 'manual' as const, manualHp: 50 };
      const prepared = makeEncounter({ combatants: [combatant] });
      const [entity] = instantiatePreparedEncounter(prepared, { ...DEFAULT_RULES, hpMode: 'fixed' }, [GOBLIN]);
      expect(entity.resources.hp.maximum).toBe(50);
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

// ── Closure 3: Prepared Encounter Builder manual HP validation ─────────────
// Gates app/dm/encounter-builder.tsx's Save and "Review & Start Encounter"
// actions — reuses isValidManualHp (monsterFactory.ts) exactly as
// app/dm/monsters.tsx's direct "Add Monster" screen already does, so both
// user-facing paths agree on one definition of "valid."

describe('hasInvalidManualHp', () => {
  function manualCombatant(manualHp?: number): ReturnType<typeof newPreparedCombatant> {
    return { ...newPreparedCombatant('test_goblin'), hpMode: 'manual', manualHp };
  }

  it('rejects an unset manualHp (empty — never finished typing)', () => {
    const prepared = makeEncounter({ combatants: [manualCombatant(undefined)] });
    expect(hasInvalidManualHp(prepared)).toBe(true);
  });

  it('rejects 0', () => {
    const prepared = makeEncounter({ combatants: [manualCombatant(0)] });
    expect(hasInvalidManualHp(prepared)).toBe(true);
  });

  it('rejects a negative value', () => {
    const prepared = makeEncounter({ combatants: [manualCombatant(-5)] });
    expect(hasInvalidManualHp(prepared)).toBe(true);
  });

  it('accepts a valid positive integer', () => {
    const prepared = makeEncounter({ combatants: [manualCombatant(42)] });
    expect(hasInvalidManualHp(prepared)).toBe(false);
  });

  it('rejects a decimal value (defense in depth — reuses isValidManualHp, same as app/dm/monsters.tsx)', () => {
    const prepared = makeEncounter({ combatants: [manualCombatant(5.5)] });
    expect(hasInvalidManualHp(prepared)).toBe(true);
  });

  it('ignores combatants whose hpMode is NOT manual, regardless of manualHp', () => {
    const prepared = makeEncounter({ combatants: [{ ...newPreparedCombatant('test_goblin'), hpMode: 'average', manualHp: undefined }] });
    expect(hasInvalidManualHp(prepared)).toBe(false);
  });

  it('is true if ANY combatant among several has an invalid manual HP, even if others are fine', () => {
    const prepared = makeEncounter({
      combatants: [manualCombatant(10), manualCombatant(undefined), { ...newPreparedCombatant('test_goblin'), hpMode: 'average' }],
    });
    expect(hasInvalidManualHp(prepared)).toBe(true);
  });

  it('is false for an encounter with no manual-HP combatants at all', () => {
    const prepared = makeEncounter({ combatants: [{ ...newPreparedCombatant('test_goblin'), hpMode: 'average' }, { ...newPreparedCombatant('test_goblin'), hpMode: 'roll' }] });
    expect(hasInvalidManualHp(prepared)).toBe(false);
  });
});

describe('invalidManualHpCombatants', () => {
  it('returns the actual offending combatant(s), not just a boolean, for a user-facing message', () => {
    const bad  = { ...newPreparedCombatant('test_goblin'), hpMode: 'manual' as const, manualHp: undefined, displayName: 'Boss Goblin' };
    const good = { ...newPreparedCombatant('test_goblin'), hpMode: 'manual' as const, manualHp: 50 };
    const prepared = makeEncounter({ combatants: [bad, good] });
    const invalid = invalidManualHpCombatants(prepared);
    expect(invalid).toHaveLength(1);
    expect(invalid[0].displayName).toBe('Boss Goblin');
  });

  it('returns an empty array when nothing is invalid', () => {
    const prepared = makeEncounter({ combatants: [{ ...newPreparedCombatant('test_goblin'), hpMode: 'manual', manualHp: 10 }] });
    expect(invalidManualHpCombatants(prepared)).toHaveLength(0);
  });
});

// ── Final runtime Start boundary (the fresh re-audit's closure 1) ──────────
// handleStartFromPrepared (app/dm/encounter.tsx) is the ONE place every
// route that can start a prepared encounter converges on — the Encounter
// Library's "▶ Start" action and Builder's "Review & Start" button both
// just navigate to this screen (?preparedId=...), and it's this screen's
// own gate, not either caller, that decides whether instantiation may
// proceed. That route file can't be imported into a Jest test directly (it
// calls expo-router's useRouter at module scope — see
// app/creation/__tests__/hubProgress.test.ts's own doc comment for the
// same, already-diagnosed constraint), so these tests prove the actual
// domain-level guarantee the guard depends on: hasInvalidManualHp
// correctly identifies every scenario the guard must block, and a
// PreparedEncounter that PASSES it produces the exact expected spawn with
// no RNG — i.e. exactly what the guard is FOR. A source-text regression
// lock separately proves the guard call is actually wired into the one
// real call site, so a future edit can't silently drop it.
describe('final runtime Start boundary (closure 1)', () => {
  afterEach(() => setRandomSource(Math.random));

  it('hpMode=manual, manualHp=undefined: hasInvalidManualHp is true — must not start', () => {
    const prepared = makeEncounter({ combatants: [{ ...newPreparedCombatant('test_goblin'), hpMode: 'manual', manualHp: undefined }] });
    expect(hasInvalidManualHp(prepared)).toBe(true);
  });

  it('manualHp=0: hasInvalidManualHp is true — must not start', () => {
    const prepared = makeEncounter({ combatants: [{ ...newPreparedCombatant('test_goblin'), hpMode: 'manual', manualHp: 0 }] });
    expect(hasInvalidManualHp(prepared)).toBe(true);
  });

  it('a legacy/pre-existing saved encounter with invalid manual HP is caught by the SAME guard, regardless of how old the record is (no special-casing by age/origin)', () => {
    // Simulates a PreparedEncounter saved before Builder-level validation
    // (Closure 3) existed — nothing marks it as "legacy," it's just an
    // ordinary record with an invalid combatant, which is exactly the
    // point: the guard doesn't need to know where the record came from.
    const legacy = makeEncounter({
      combatants: [{ ...newPreparedCombatant('test_goblin'), hpMode: 'manual', manualHp: undefined }],
      updatedAt: Date.now() - 1000 * 60 * 60 * 24 * 365, // a year old
    });
    expect(hasInvalidManualHp(legacy)).toBe(true);
  });

  it('valid manualHp=27 passes the guard and, once instantiated, produces a spawned monster with HP exactly 27 and consumes no RNG', () => {
    let rngCalls = 0;
    setRandomSource(() => { rngCalls++; return 0.99; }); // would roll near-max if the RNG were (wrongly) consulted
    const combatant = { ...newPreparedCombatant('test_goblin'), hpMode: 'manual' as const, manualHp: 27 };
    const prepared = makeEncounter({ combatants: [combatant] });

    expect(hasInvalidManualHp(prepared)).toBe(false); // the guard lets it through

    const [entity] = instantiatePreparedEncounter(prepared, DEFAULT_RULES, [GOBLIN]); // exactly what handleStartFromPrepared calls next
    expect(entity.resources.hp.maximum).toBe(27);
    expect(rngCalls).toBe(0);
  });

  it('regression lock: handleStartFromPrepared checks hasInvalidManualHp before calling instantiatePreparedEncounter', () => {
    const root = path.resolve(__dirname, '../../..');
    const source = fs.readFileSync(path.join(root, 'app/dm/encounter.tsx'), 'utf8');
    const fnStart = source.indexOf('function handleStartFromPrepared');
    expect(fnStart).toBeGreaterThan(-1);
    const fnBody = source.slice(fnStart, source.indexOf('\n  function ', fnStart + 1));
    const guardIdx = fnBody.indexOf('hasInvalidManualHp(previewSource)');
    const spawnIdx = fnBody.indexOf('instantiatePreparedEncounter(previewSource');
    expect(guardIdx).toBeGreaterThan(-1);
    expect(spawnIdx).toBeGreaterThan(-1);
    expect(guardIdx).toBeLessThan(spawnIdx); // the guard is checked BEFORE instantiation, not after
  });

  it('regression lock: the Encounter Library route never calls instantiatePreparedEncounter itself — it only navigates to the guarded screen', () => {
    const root = path.resolve(__dirname, '../../..');
    const source = fs.readFileSync(path.join(root, 'app/dm/encounters.tsx'), 'utf8');
    expect(source.includes('instantiatePreparedEncounter')).toBe(false);
    // It navigates to the same guarded screen every other start path uses.
    expect(source.includes("pathname: '/dm/encounter'")).toBe(true);
  });
});

// ── Wave-deploy runtime boundary (handleDeployWave, app/dm/encounter.tsx) ──
// The Start-boundary guard above (handleStartFromPrepared) only protects
// combatants present from the start — a wave deployed later, mid-combat,
// went through instantiateWave -> instantiatePreparedEncounter completely
// unguarded, so a legacy/invalid wave combatant could still silently spawn
// at the printed average. combatantsWithInvalidManualHp (the array-based
// primitive invalidManualHpCombatants/hasInvalidManualHp already delegate
// to) is scoped to just the target wave's own combatants — never the
// whole encounter — and is the SAME validation rule reused, not a second
// implementation. handleDeployWave itself can't be imported into Jest
// (expo-router's useRouter at module scope), so `deployWave` below models
// its exact control flow (filter to the wave -> validate -> only then
// instantiateWave) against the REAL preparedEncounter.ts functions —
// a behavioral test of the actual domain boundary, not a source-text-only
// check (that's the separate regression lock at the very end).
describe('wave-deploy runtime boundary (handleDeployWave guard)', () => {
  afterEach(() => setRandomSource(Math.random));

  /** Mirrors handleDeployWave's own control flow exactly: scope to the
   *  wave, validate, only then instantiate. */
  function deployWave(prepared: PreparedEncounter, waveId: string) {
    const waveCombatants = prepared.combatants.filter(c => c.waveId === waveId);
    const invalid = combatantsWithInvalidManualHp(waveCombatants);
    if (invalid.length > 0) return { deployed: false as const, invalid };
    return { deployed: true as const, spawned: instantiateWave(prepared, waveId, DEFAULT_RULES, [GOBLIN]) };
  }

  it('A: manualHp undefined — deployment blocked, instantiateWave never reached, no RNG consumed', () => {
    let rngCalls = 0;
    setRandomSource(() => { rngCalls++; return 0.5; });
    const wave = newEncounterWave('Reinforcements');
    const bad = { ...newPreparedCombatant('test_goblin'), hpMode: 'manual' as const, manualHp: undefined, waveId: wave.id };
    const prepared = makeEncounter({ waves: [wave], combatants: [bad] });

    const result = deployWave(prepared, wave.id);
    expect(result.deployed).toBe(false);
    expect(rngCalls).toBe(0); // instantiateWave (and any HP roll inside it) never ran
  });

  it('B: manualHp = 0 — blocked identically', () => {
    const wave = newEncounterWave('Reinforcements');
    const bad = { ...newPreparedCombatant('test_goblin'), hpMode: 'manual' as const, manualHp: 0, waveId: wave.id };
    const prepared = makeEncounter({ waves: [wave], combatants: [bad] });
    expect(deployWave(prepared, wave.id).deployed).toBe(false);
  });

  it('C: a legacy/pre-existing persisted wave with missing manual HP is blocked identically, with no migration or silent conversion', () => {
    const wave = newEncounterWave('Reinforcements');
    const legacyCombatant = { ...newPreparedCombatant('test_goblin'), hpMode: 'manual' as const, manualHp: undefined, waveId: wave.id };
    const legacy = makeEncounter({
      waves: [wave], combatants: [legacyCombatant],
      updatedAt: Date.now() - 1000 * 60 * 60 * 24 * 365, // a year old — nothing special-cases its age
    });
    const before = JSON.stringify(legacy);
    const result = deployWave(legacy, wave.id);
    expect(result.deployed).toBe(false);
    expect(JSON.stringify(legacy)).toBe(before); // untouched — no auto-fix, no conversion to average
  });

  it('D: valid manualHp = 27 — deploys, spawned HP exactly 27, no RNG consumed', () => {
    let rngCalls = 0;
    setRandomSource(() => { rngCalls++; return 0.99; }); // would roll near-max if the RNG were (wrongly) consulted
    const wave = newEncounterWave('Reinforcements');
    const good = { ...newPreparedCombatant('test_goblin'), hpMode: 'manual' as const, manualHp: 27, waveId: wave.id };
    const prepared = makeEncounter({ waves: [wave], combatants: [good] });

    const result = deployWave(prepared, wave.id);
    expect(result.deployed).toBe(true);
    if (result.deployed) {
      expect(result.spawned).toHaveLength(1);
      expect(result.spawned[0].resources.hp.maximum).toBe(27);
    }
    expect(rngCalls).toBe(0);
  });

  it('E: a mixed wave (one valid + one invalid combatant) is blocked entirely — no partial deployment', () => {
    const wave = newEncounterWave('Reinforcements');
    const good = { ...newPreparedCombatant('test_goblin'), hpMode: 'manual' as const, manualHp: 27, waveId: wave.id };
    const bad  = { ...newPreparedCombatant('test_goblin'), hpMode: 'manual' as const, manualHp: undefined, waveId: wave.id };
    const prepared = makeEncounter({ waves: [wave], combatants: [good, bad] });

    const result = deployWave(prepared, wave.id);
    expect(result.deployed).toBe(false); // the whole wave is blocked, not just the bad half
    if (!result.deployed) expect(result.invalid).toHaveLength(1);
  });

  it('F: Average/Max/Roll modes in the same wave are never incorrectly rejected', () => {
    const wave = newEncounterWave('Reinforcements');
    const combatants = [
      { ...newPreparedCombatant('test_goblin'), hpMode: 'average' as const, waveId: wave.id },
      { ...newPreparedCombatant('test_goblin'), hpMode: 'max' as const, waveId: wave.id },
      { ...newPreparedCombatant('test_goblin'), hpMode: 'roll' as const, waveId: wave.id },
    ];
    const prepared = makeEncounter({ waves: [wave], combatants });
    const result = deployWave(prepared, wave.id);
    expect(result.deployed).toBe(true);
    if (result.deployed) expect(result.spawned).toHaveLength(3);
  });

  it('a combatant belonging to a DIFFERENT wave (or present from the start) never blocks this wave\'s deployment', () => {
    const waveA = newEncounterWave('Wave A');
    const waveB = newEncounterWave('Wave B');
    const invalidElsewhere = { ...newPreparedCombatant('test_goblin'), hpMode: 'manual' as const, manualHp: undefined, waveId: waveB.id };
    const upfrontInvalid    = { ...newPreparedCombatant('test_goblin'), hpMode: 'manual' as const, manualHp: undefined }; // no waveId — present from the start
    const goodInA = { ...newPreparedCombatant('test_goblin'), hpMode: 'manual' as const, manualHp: 27, waveId: waveA.id };
    const prepared = makeEncounter({ waves: [waveA, waveB], combatants: [invalidElsewhere, upfrontInvalid, goodInA] });

    const result = deployWave(prepared, waveA.id);
    expect(result.deployed).toBe(true); // scoped correctly — unrelated invalid combatants don't block it
  });

  it('regression lock: handleDeployWave scopes validation to the wave and checks it before instantiateWave', () => {
    const root = path.resolve(__dirname, '../../..');
    const source = fs.readFileSync(path.join(root, 'app/dm/encounter.tsx'), 'utf8');
    const fnStart = source.indexOf('function handleDeployWave');
    expect(fnStart).toBeGreaterThan(-1);
    const fnBody = source.slice(fnStart, source.indexOf('\n  function ', fnStart + 1));
    const guardIdx = fnBody.indexOf('combatantsWithInvalidManualHp(waveCombatants)');
    const spawnIdx = fnBody.indexOf('instantiateWave(activeSource');
    expect(guardIdx).toBeGreaterThan(-1);
    expect(spawnIdx).toBeGreaterThan(-1);
    expect(guardIdx).toBeLessThan(spawnIdx); // validated BEFORE instantiation, not after
  });
});
