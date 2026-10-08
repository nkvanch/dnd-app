// src/engine/dmCharacterDamage.ts
// Rules-engine blocker RE-AUDIT closure (single-issue, DM nonmagical-attack
// forwarding): the DM character sheet's damage forwarding logic — while Wild
// Shaped, damage hits the BEAST's hp pool, not the player's real HP
// underneath, same rule app/sheet/[id].tsx's own handleDamage applies —
// lives here as a plain module rather than inline in app/dm/character/
// [id].tsx so it's unit-testable without a full RN component harness.
// Importing a route file directly from Jest fails: expo-router's
// standard-navigation submodule isn't transformed (see
// app/creation/__tests__/hubProgress.test.ts's own doc comment for the same
// issue with skills.tsx/spells.tsx/hub.tsx). Not used by app/sheet/[id].tsx
// or app/dm/encounter.tsx — those paths are unchanged, per this closure's
// own scope (Codex already verified them).
import { Entity, CampaignRules } from './types';
import { applyDamage, applyWildShapeDamage } from './combat';

export function dmDamageMutation(
  entity: Entity, rules: CampaignRules, amount: number, damageType?: string, isNonmagicalAttack?: boolean,
): Entity {
  return entity.wildShapeState?.active
    ? applyWildShapeDamage(entity, amount, rules, damageType, isNonmagicalAttack)
    : applyDamage(entity, amount, rules, damageType);
}
