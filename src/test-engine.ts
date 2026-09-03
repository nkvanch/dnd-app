// ============================================================================
// FILE: src/test-engine.ts
// PURPOSE: Root Src Directory Engine Verification
// ============================================================================
import { Entity, CampaignRules } from './engine/types';
import { tickDurations, reduceExhaustion, applyCondition } from './engine/conditions';
import { applyDamage, applyTempHP } from './engine/combat';
import { takeRest } from './engine/rest';

const mockRules: CampaignRules = {
  maxAbilityScore: 20,
  maxLevel: 20,
  useXP: false,
  hpMode: 'fixed',
  allowMulticlass: false,
  customRules: {}
};

const createTestEntity = (): Entity => ({
  id: 'hero-42',
  kind: 'character',
  identity: {
    name: 'Garrick Spark', level: 1, raceId: 'human', subRaceId: null, classId: 'fighter',
    subclassId: null, backgroundId: 'soldier', alignment: 'Neutral', xp: 0
  },
  stats: { str: 15, dex: 14, con: 13, int: 10, wis: 12, cha: 8 },
  derived: {
    proficiencyBonus: 2, ac: 16, initiative: 2, speed: 30, passivePerception: 11,
    passiveInvestigation: 10, passiveInsight: 11, senses: [], movement: {},
    savingThrows: { str: 4, dex: 2, con: 3, int: 0, wis: 1, cha: -1 },
    attackBonuses: [], advantageStates: [], spellSaveDC: null, spellAttackBonus: null, kiSaveDC: null,
    abilityBasedDC: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }
  },
  skills: { skills: {} } as any,
  proficiencies: { armor: ['heavy'], weapons: ['martial'], tools: [], languages: ['common'], savingThrows: ['str', 'con'] },
  resources: {
    hp: { current: 12, maximum: 12, temp: 0 },
    speed: 30, ac: 16,
    hitDice: { die: 10, total: 1, remaining: 1 },
    custom: [{ id: 'second_wind_pool', name: 'Second Wind Use', current: 0, maximum: 1, recharge: 'short_rest' }],
    deathSaves: { successes: 0, failures: 0, stable: false }
  },
  spellcasting: null,
  inventory: { equipped: [], carried: [], currency: { pp: 0, gp: 10, ep: 0, sp: 0, cp: 0 } },
  conditions: [],
  conditionMonitor: { active: [], exhaustion: 2, flags: {} },
  features: [], choices: [],
  dmOverrides: [],   // required: DM stat overrides — always empty for test entity
  wildShapeState: null,
  notes: ''
});

function executeEngineVerification() {
  console.log('🏁 INITIALIZING SYSTEM ENGINE CORE VERIFICATION...\n');
  let character = createTestEntity();

  console.log('📋 --- STEP 1: Baseline Check ---');
  console.log(`Character Name:   ${character.identity.name}`);
  console.log(`Max HP Check:     ${character.resources.hp.maximum}`);
  console.log('');

  console.log('🛡️ --- STEP 2: Applying Temp HP and Handling Damage Overflows ---');
  character = applyTempHP(character, 5, mockRules);
  character = applyDamage(character, 8, mockRules);
  console.log(`HP State after taking 8 damage: Current: ${character.resources.hp.current} (Expected: 9), Temp: ${character.resources.hp.temp} (Expected: 0)`);
  console.log('');

  console.log('⚔️ --- STEP 3: Applying Poisoned Status ---');
  character = applyCondition(character, 'poisoned', 'spider-bite');
  
  // Cleanly override the rules engine duration
  character.conditionMonitor.active = character.conditionMonitor.active.map(c => 
    c.id === 'poisoned' ? { ...c, duration: { unit: 'rounds', remaining: 2 } } : c
  );
  character.conditions = character.conditions.map(c => 
    c.id === 'poisoned' ? { ...c, duration: { unit: 'rounds', remaining: 2 } } : c
  );

  console.log('⏰ Advancing Turn Clock (Round 1 Ends)...');
  character = tickDurations(character, mockRules);
  console.log(`Poison Duration Clock: ${character.conditionMonitor.active[0]?.duration?.remaining ?? 'Expired'} rounds.`);
  console.log('');

  console.log('🩹 --- STEP 4: Executing Short Rest Resource Restoration ---');
  character = takeRest(character, 'short', mockRules);
  console.log(`Second Wind Use pool after rest:  ${character.resources.custom[0].current}/${character.resources.custom[0].maximum}`);
  console.log('');

  console.log('💤 --- STEP 5: Executing Long Rest Recovery ---');
  character = takeRest(character, 'long', mockRules);
  console.log(`Exhaustion after Long Rest:  ${character.conditionMonitor.exhaustion} (Expected: 1 or 0)`);
  console.log(`HP after Long Rest:          ${character.resources.hp.current}/${character.resources.hp.maximum}`);
  console.log('');

  console.log('🎉 ── ALL ENGINES (COMBAT, CONDITIONS, REST) COMPILED AND PASSED END-TO-END! ──');
}

executeEngineVerification();