// src/content/monsters/__tests__/legendaryActions.test.ts
// End-to-end proof for the legendary-actions mechanism (engine work item 4):
// a monster's legendary-action Features are modeled as ordinary Features
// gated by the existing generic ResourceCost machinery (resourceId
// 'legendary_actions', the same mechanism spell slots already use) rather
// than any new Feature field — no engine change needed beyond
// combat.ts's startTurn refreshing a CustomResource tagged
// recharge:'start_of_turn'. The Lich is the first real content this is
// proven against; this test exercises the full real pipeline (spawn ->
// generateActionCard -> applyActionCardUse -> startTurn) rather than a
// synthetic fixture, since the whole point is proving the REAL content
// wiring works, not just the generic mechanism (already covered in
// combat.test.ts's own startTurn tests).
import { spawnMonster } from '../../../engine/monsterFactory';
import { monsterLich } from '../srd';
import { generateActionCard } from '../../../engine/actionCards';
import { applyActionCardUse } from '../../../components/sheet/TabActions';
import { startTurn } from '../../../engine/combat';
import { DEFAULT_RULES } from '../../../store/characterStore';

describe('Lich legendary actions — real content, real pipeline', () => {
  it('spawns with a full legendary_actions resource pool', () => {
    const lich = spawnMonster(monsterLich, DEFAULT_RULES);
    const pool = lich.resources.custom.find(r => r.id === 'legendary_actions');
    expect(pool).toMatchObject({ id: 'legendary_actions', name: 'Legendary Actions', current: 3, maximum: 3, recharge: 'start_of_turn' });
  });

  it('generates a usable action card for each legendary-action feature, gated correctly by remaining pool', () => {
    const lich = spawnMonster(monsterLich, DEFAULT_RULES);
    const cantrip = lich.features.find(f => f.id === 'lich_legendary_cantrip')!;
    const disrupt = lich.features.find(f => f.id === 'lich_legendary_disrupt_life')!;

    const cantripCard = generateActionCard(cantrip, lich)!;
    const disruptCard = generateActionCard(disrupt, lich)!;
    expect(cantripCard.available).toBe(true); // costs 1, pool has 3
    expect(disruptCard.available).toBe(true); // costs 3, pool has exactly 3
  });

  it('spending a legendary action reduces the pool, and a too-expensive option becomes unavailable', () => {
    let lich = spawnMonster(monsterLich, DEFAULT_RULES);
    const disrupt = lich.features.find(f => f.id === 'lich_legendary_disrupt_life')!;
    const cantrip = lich.features.find(f => f.id === 'lich_legendary_cantrip')!;

    // Spend the cantrip (1 action) twice, leaving 1 of 3.
    lich = applyActionCardUse(lich, generateActionCard(cantrip, lich)!, DEFAULT_RULES);
    lich = applyActionCardUse(lich, generateActionCard(cantrip, lich)!, DEFAULT_RULES);
    expect(lich.resources.custom.find(r => r.id === 'legendary_actions')?.current).toBe(1);

    // Disrupt Life costs 3 — no longer affordable with only 1 remaining.
    const disruptCard = generateActionCard(disrupt, lich)!;
    expect(disruptCard.available).toBe(false);

    // applyActionCardUse itself refuses (no-op) an unaffordable spend, same
    // as every other resource-gated card in the app.
    const attempted = applyActionCardUse(lich, disruptCard, DEFAULT_RULES);
    expect(attempted).toBe(lich);
  });

  it('spending a legendary action does NOT consume the normal action-economy slot (actionType: free)', () => {
    let lich = startTurn(spawnMonster(monsterLich, DEFAULT_RULES));
    const cantrip = lich.features.find(f => f.id === 'lich_legendary_cantrip')!;
    lich = applyActionCardUse(lich, generateActionCard(cantrip, lich)!, DEFAULT_RULES);
    expect(lich.turnState).toEqual({ actionUsed: false, bonusActionUsed: false, reactionUsed: false });
  });

  it('a mechanical legendary action (Frightening Gaze) spends its resource cost; damage/condition stay disclosed-only, matching every other monster attack feature in this content file (applyAbilityEffects deliberately never auto-applies damage/apply_condition — see its own doc comment)', () => {
    let lich = spawnMonster(monsterLich, DEFAULT_RULES);
    const frighten = lich.features.find(f => f.id === 'lich_legendary_frightening_gaze')!;
    lich = applyActionCardUse(lich, generateActionCard(frighten, lich)!, DEFAULT_RULES);
    expect(lich.resources.custom.find(r => r.id === 'legendary_actions')?.current).toBe(1); // costs 2 of 3
    expect(lich.conditions).toHaveLength(0); // condition is disclosed via the card text, never auto-applied
  });

  it("startTurn refreshes the pool back to full at the start of the lich's own turn", () => {
    let lich = spawnMonster(monsterLich, DEFAULT_RULES);
    const cantrip = lich.features.find(f => f.id === 'lich_legendary_cantrip')!;
    lich = applyActionCardUse(lich, generateActionCard(cantrip, lich)!, DEFAULT_RULES);
    expect(lich.resources.custom.find(r => r.id === 'legendary_actions')?.current).toBe(2);
    lich = startTurn(lich);
    expect(lich.resources.custom.find(r => r.id === 'legendary_actions')?.current).toBe(3);
  });
});
