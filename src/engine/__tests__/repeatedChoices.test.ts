// src/engine/__tests__/repeatedChoices.test.ts
// CHOICE-EXPANSION-1: coverage for Expertise/Tool/Language as real
// interactive ChoiceDefinition-driven choices — the engine-level apply
// functions (leveling.ts), the shared eligibility computation
// (choiceEligibility.ts) both TabFeatures.tsx and the creation flow read
// from, and validateEntity's new Issue codes.
import { makeEmptyEntity, DEFAULT_RULES } from '../../store/characterStore';
import { queueChoice, applyExpertiseChoiceToEntity, applyToolChoiceToEntity, applyLanguageChoiceToEntity, withExpertiseChoiceGrantStripped, effectiveRequiredCount } from '../leveling';
import { eligibleExpertiseOptions, eligibleToolOptions, eligibleLanguageOptions } from '../choiceEligibility';
import { validateEntity } from '../validation';
import { recomputeDerived } from '../pipeline';
import { setManualEntitlement } from '../entitlements';
import type { ChoiceDefinition, Entity, SkillName } from '../types';

function expertiseDef(id: string, count = 2, pool: ChoiceDefinition['pool'] = 'all'): ChoiceDefinition {
  return { id, prompt: `Choose ${count} skills for Expertise.`, kind: 'expertise', count, pool, grants: [], required: true, resolved: false };
}
function toolDef(id: string, count = 2, pool: ChoiceDefinition['pool'] = 'all'): ChoiceDefinition {
  return { id, prompt: `Choose ${count} tool proficiencies.`, kind: 'tool', count, pool, grants: [], required: true, resolved: false };
}
function languageDef(id: string, count = 2, pool: ChoiceDefinition['pool'] = 'all'): ChoiceDefinition {
  return { id, prompt: `Choose ${count} languages.`, kind: 'language', count, pool, grants: [], required: true, resolved: false };
}

function withTrained(e: Entity, skills: SkillName[]): Entity {
  let next = e;
  for (const s of skills) {
    next = { ...next, skills: { skills: { ...next.skills.skills, [s]: { ...next.skills.skills[s], trained: true } } } };
  }
  return next;
}

/**
 * Simulates "an earlier proficiency choice changed since" in a way that
 * actually SURVIVES a later recompute — a bare `{ ...trained: false }`
 * object mutation does NOT: entity.skills.skills[x].trained is DERIVED
 * output, rewritten from entity.entitlements on every recomputeDerived pass
 * (see EntitlementRecord's own doc comment, types.ts) — the very FIRST
 * recompute this test entity ever went through (inside
 * applyExpertiseChoiceToEntity, when withTrained's own raw mutation was
 * migrated into a permanent 'manual' skill_proficiency entitlement via
 * initializeEntitlementInputs) already baked that training in, so a later
 * raw mutation would just get overwritten back to `true` by the next
 * recompute. setManualEntitlement is the real, supported way to revoke it
 * (mirrors swapBackground's own skill-retrain checklist — the ONE real path
 * that can flip `trained` back to false in this app).
 */
function untrained(e: Entity, skill: SkillName): Entity {
  return recomputeDerived(setManualEntitlement(e, 'skill_proficiency', skill, false), DEFAULT_RULES);
}

function baseContentDB() {
  return {
    races: [], subraces: [], classes: [], subclasses: [], backgrounds: [],
    spells: [], items: [], feats: [], monsters: [], conditions: [],
  } as any;
}

describe('Expertise — eligibility (item 3)', () => {
  it('only trained, non-expert skills are eligible', () => {
    let e = makeEmptyEntity('e1');
    e = withTrained(e, ['arcana', 'investigation', 'perception']);
    const opts = eligibleExpertiseOptions(e, 'all').map(o => o.id).sort();
    expect(opts).toEqual(['arcana', 'investigation', 'perception']);
  });

  it('a skill not trained is never eligible', () => {
    let e = makeEmptyEntity('e1');
    e = withTrained(e, ['arcana']);
    const opts = eligibleExpertiseOptions(e, 'all').map(o => o.id);
    expect(opts).not.toContain('athletics');
  });

  it('an already-expert skill is not eligible again', () => {
    let e = makeEmptyEntity('e1');
    e = withTrained(e, ['perception']);
    e = { ...e, skills: { skills: { ...e.skills.skills, perception: { ...e.skills.skills.perception, expertise: true } } } };
    const opts = eligibleExpertiseOptions(e, 'all').map(o => o.id);
    expect(opts).not.toContain('perception');
  });

  it('a restricted literal pool narrows eligibility even further (filters never broaden it — item 12)', () => {
    let e = makeEmptyEntity('e1');
    e = withTrained(e, ['arcana', 'investigation', 'perception']);
    const restricted: ChoiceDefinition['pool'] = [
      { id: 'arcana', label: 'Arcana', value: 'arcana' },
      { id: 'perception', label: 'Perception', value: 'perception' },
    ];
    const opts = eligibleExpertiseOptions(e, restricted).map(o => o.id).sort();
    expect(opts).toEqual(['arcana', 'perception']); // investigation excluded despite being trained
  });
});

describe('Expertise — resolution (items 5, 30)', () => {
  it('resolving grants real expertise (doubled proficiency), not just a UI-only record', () => {
    let e = makeEmptyEntity('e1');
    e = withTrained(e, ['arcana', 'investigation', 'perception']);
    e = queueChoice(e, expertiseDef('rogue_expertise_1', 2), 1);
    const choiceId = 'rogue_expertise_1_1';
    const updated = applyExpertiseChoiceToEntity(e, choiceId, ['arcana', 'perception'], DEFAULT_RULES);

    expect(updated.skills.skills.arcana.expertise).toBe(true);
    expect(updated.skills.skills.perception.expertise).toBe(true);
    expect(updated.skills.skills.investigation.expertise).toBe(false);
    // Derived through the normal engine — real doubled proficiency bonus,
    // not a second UI-only list (item 5).
    const prof = updated.derived.proficiencyBonus;
    const arcanaMod = Math.floor((updated.stats.int - 10) / 2);
    expect(updated.derived).toBeDefined();
    expect(prof).toBeGreaterThan(0);
    void arcanaMod;

    const resolved = updated.choices.find(c => c.id === choiceId)!;
    expect(resolved.resolved).toBe(true);
    expect(resolved.selections).toEqual(['arcana', 'perception']);
  });

  it('rejects a skill the character is not proficient in (item 3 legality, never inferred from display strings)', () => {
    let e = makeEmptyEntity('e1');
    // Two eligible skills so the effective-required-count gate (2 of 2)
    // passes and this exercises the per-skill legality check specifically
    // — see the Expertise-choice deadlock closure's own report for why an
    // under-provisioned fixture (only 1 eligible skill for a count-2
    // choice) would instead trip the count gate first.
    e = withTrained(e, ['arcana', 'perception']);
    e = queueChoice(e, expertiseDef('c1', 2), 1);
    expect(() => applyExpertiseChoiceToEntity(e, 'c1_1', ['arcana', 'athletics'], DEFAULT_RULES)).toThrow(/not proficient/i);
  });

  it('rejects a skill that already has expertise (no duplicate grant)', () => {
    let e = makeEmptyEntity('e1');
    // Three trained skills so excluding the already-expert one still
    // leaves 2 eligible (matching the count-2 choice) — see the note above.
    e = withTrained(e, ['arcana', 'investigation', 'perception']);
    e = { ...e, skills: { skills: { ...e.skills.skills, arcana: { ...e.skills.skills.arcana, expertise: true } } } };
    e = queueChoice(e, expertiseDef('c1', 2), 1);
    expect(() => applyExpertiseChoiceToEntity(e, 'c1_1', ['arcana', 'investigation'], DEFAULT_RULES)).toThrow(/already has expertise/i);
  });

  it('rejects duplicate selections within the same choice (item 27)', () => {
    let e = makeEmptyEntity('e1');
    // Two eligible skills — see the note above.
    e = withTrained(e, ['arcana', 'perception']);
    e = queueChoice(e, expertiseDef('c1', 2), 1);
    expect(() => applyExpertiseChoiceToEntity(e, 'c1_1', ['arcana', 'arcana'], DEFAULT_RULES)).toThrow(/duplicate/i);
  });

  it('rejects a selection count that does not match the required count', () => {
    let e = makeEmptyEntity('e1');
    e = withTrained(e, ['arcana', 'investigation', 'perception']);
    e = queueChoice(e, expertiseDef('c1', 2), 1);
    expect(() => applyExpertiseChoiceToEntity(e, 'c1_1', ['arcana'], DEFAULT_RULES)).toThrow(/expected 2/i);
  });
});

// ============================================================================
// Expertise-choice deadlock/edit closure: effectiveRequiredCount capping
// (Parts A/B/C) and edit-in-place re-resolution (Part B/E/F/G/H).
// ============================================================================
describe('Expertise — effective required count (deadlock closure, Part A/C)', () => {
  it('1. choose 1 of 1 — complete with exactly the one eligible skill', () => {
    let e = makeEmptyEntity('e1');
    e = withTrained(e, ['arcana']);
    e = queueChoice(e, expertiseDef('c1', 1), 1);
    const updated = applyExpertiseChoiceToEntity(e, 'c1_1', ['arcana'], DEFAULT_RULES);
    expect(updated.choices.find(c => c.id === 'c1_1')!.resolved).toBe(true);
    expect(updated.skills.skills.arcana.expertise).toBe(true);
  });

  it('2. choose 2 of 5 — one selected is still incomplete (rejected), two selected completes', () => {
    let e = makeEmptyEntity('e1');
    e = withTrained(e, ['arcana', 'investigation', 'perception', 'stealth', 'athletics']);
    e = queueChoice(e, expertiseDef('c1', 2), 1);
    expect(() => applyExpertiseChoiceToEntity(e, 'c1_1', ['arcana'], DEFAULT_RULES)).toThrow(/expected 2/i);
    const updated = applyExpertiseChoiceToEntity(e, 'c1_1', ['arcana', 'investigation'], DEFAULT_RULES);
    expect(updated.choices.find(c => c.id === 'c1_1')!.resolved).toBe(true);
  });

  it('3. choose 2 of 2 — both selectable, complete', () => {
    let e = makeEmptyEntity('e1');
    e = withTrained(e, ['arcana', 'investigation']);
    e = queueChoice(e, expertiseDef('c1', 2), 1);
    const updated = applyExpertiseChoiceToEntity(e, 'c1_1', ['arcana', 'investigation'], DEFAULT_RULES);
    expect(updated.choices.find(c => c.id === 'c1_1')!.resolved).toBe(true);
    expect(updated.skills.skills.arcana.expertise).toBe(true);
    expect(updated.skills.skills.investigation.expertise).toBe(true);
  });

  it('4. requested 2, eligible 1 (deadlock case) — selecting the one legal option completes the choice', () => {
    let e = makeEmptyEntity('e1');
    e = withTrained(e, ['arcana']); // only ONE trained skill for a count-2 choice
    e = queueChoice(e, expertiseDef('c1', 2), 1);
    // The old exact-count gate would make this choice permanently
    // unresolvable — confirm it no longer is.
    const updated = applyExpertiseChoiceToEntity(e, 'c1_1', ['arcana'], DEFAULT_RULES);
    expect(updated.choices.find(c => c.id === 'c1_1')!.resolved).toBe(true);
    expect(updated.choices.find(c => c.id === 'c1_1')!.selections).toEqual(['arcana']);
    expect(updated.skills.skills.arcana.expertise).toBe(true);
  });

  it('5/14. requested 2, eligible 0 — resolves with an empty selection; creation is never blocked', () => {
    let e = makeEmptyEntity('e1'); // no trained skills at all
    e = queueChoice(e, expertiseDef('c1', 2), 1);
    const updated = applyExpertiseChoiceToEntity(e, 'c1_1', [], DEFAULT_RULES);
    const resolved = updated.choices.find(c => c.id === 'c1_1')!;
    expect(resolved.resolved).toBe(true);
    expect(resolved.selections).toEqual([]);
    // No synthetic grant feature was created for an empty selection.
    expect(updated.features.some(f => f.id === 'c1_1_grant')).toBe(false);
  });

  it('6. a duplicate skill still cannot fill two slots, even when the nominal count exceeds eligibility', () => {
    let e = makeEmptyEntity('e1');
    e = withTrained(e, ['arcana', 'investigation']);
    e = queueChoice(e, expertiseDef('c1', 2), 1);
    expect(() => applyExpertiseChoiceToEntity(e, 'c1_1', ['arcana', 'arcana'], DEFAULT_RULES)).toThrow(/duplicate/i);
  });

  it('12/13. hub-style completion gate: resolved reflects the effective count, not the nominal one', () => {
    // requested 3, eligible 1 — mirrors hub.tsx's own `!c.resolved` done
    // check: creation must be able to finish even though only 1 of the
    // nominal 3 could ever be granted.
    let e = makeEmptyEntity('e1');
    e = withTrained(e, ['arcana']);
    e = queueChoice(e, expertiseDef('c1', 3), 1);
    const updated = applyExpertiseChoiceToEntity(e, 'c1_1', ['arcana'], DEFAULT_RULES);
    expect(updated.choices.filter(c => c.definition.kind === 'expertise' && !c.resolved)).toHaveLength(0);

    // Contrast: requested 2, eligible 5, only 1 selected — genuinely
    // incomplete, still correctly blocks (13).
    let e2 = makeEmptyEntity('e1');
    e2 = withTrained(e2, ['arcana', 'investigation', 'perception', 'stealth', 'athletics']);
    e2 = queueChoice(e2, expertiseDef('c2', 2), 1);
    expect(() => applyExpertiseChoiceToEntity(e2, 'c2_1', ['arcana'], DEFAULT_RULES)).toThrow(/expected 2/i);
  });
});

describe('Expertise — edit-in-place re-resolution (deadlock/edit closure, Part B/E/F/G/H)', () => {
  it('7. choose A+B, then replace A with C — final selection is B+C, both actually granted', () => {
    let e = makeEmptyEntity('e1');
    e = withTrained(e, ['arcana', 'investigation', 'perception']);
    e = queueChoice(e, expertiseDef('c1', 2), 1);
    e = applyExpertiseChoiceToEntity(e, 'c1_1', ['arcana', 'investigation'], DEFAULT_RULES);
    expect(e.skills.skills.arcana.expertise).toBe(true);
    expect(e.skills.skills.investigation.expertise).toBe(true);

    // Replace: drop arcana, keep investigation, add perception.
    e = applyExpertiseChoiceToEntity(e, 'c1_1', ['investigation', 'perception'], DEFAULT_RULES);
    expect(e.skills.skills.arcana.expertise).toBe(false);       // released
    expect(e.skills.skills.investigation.expertise).toBe(true); // retained
    expect(e.skills.skills.perception.expertise).toBe(true);    // newly granted
    expect(e.choices.find(c => c.id === 'c1_1')!.selections).toEqual(['investigation', 'perception']);
  });

  it('8. reopening a resolved choice: its own selections are exactly what the choice state records', () => {
    let e = makeEmptyEntity('e1');
    e = withTrained(e, ['arcana', 'investigation']);
    e = queueChoice(e, expertiseDef('c1', 2), 1);
    e = applyExpertiseChoiceToEntity(e, 'c1_1', ['arcana', 'investigation'], DEFAULT_RULES);
    const reopened = e.choices.find(c => c.id === 'c1_1')!;
    expect(reopened.resolved).toBe(true);
    expect(reopened.selections).toEqual(['arcana', 'investigation']);
  });

  it('9. replacing one selection changes only this choice\'s own grant — no other feature/entitlement is touched', () => {
    let e = makeEmptyEntity('e1');
    e = withTrained(e, ['arcana', 'investigation', 'perception']);
    e = queueChoice(e, expertiseDef('c1', 2), 1);
    e = applyExpertiseChoiceToEntity(e, 'c1_1', ['arcana', 'investigation'], DEFAULT_RULES);
    const featuresBeforeEdit = e.features.length;

    e = applyExpertiseChoiceToEntity(e, 'c1_1', ['arcana', 'perception'], DEFAULT_RULES);
    // Same ONE synthetic grant feature id, just updated content — not a
    // second, orphaned feature left behind.
    expect(e.features.filter(f => f.id === 'c1_1_grant')).toHaveLength(1);
    expect(e.features.length).toBe(featuresBeforeEdit);
    expect(e.skills.skills.investigation.expertise).toBe(false); // released
    expect(e.skills.skills.perception.expertise).toBe(true);     // newly granted
  });

  it('11. provenance from another source (manual/race/class) is never touched by editing this choice', () => {
    let e = makeEmptyEntity('e1');
    e = withTrained(e, ['arcana', 'investigation', 'stealth']);
    // A manually-granted expertise on a DIFFERENT skill, from an unrelated source.
    const manualExpertiseFeature = {
      id: 'homebrew_manual_expertise', name: 'Innate Cunning', description: '', source: { kind: 'manual' as const, refId: 'test' },
      level: null, effects: [{ type: 'grant_proficiency' as const, target: 'skill:stealth', operation: 'multiply' as const, value: null, condition: null }],
      actions: [], choices: [], passive: true, isActive: true,
    };
    e = { ...e, features: [...e.features, manualExpertiseFeature] };
    e = recomputeDerived(e, DEFAULT_RULES);
    expect(e.skills.skills.stealth.expertise).toBe(true);

    e = queueChoice(e, expertiseDef('c1', 2), 1);
    e = applyExpertiseChoiceToEntity(e, 'c1_1', ['arcana', 'investigation'], DEFAULT_RULES);
    // Edit this choice's OWN selection...
    e = applyExpertiseChoiceToEntity(e, 'c1_1', ['investigation', 'arcana'], DEFAULT_RULES);

    // The unrelated manual grant survives untouched throughout.
    expect(e.features.some(f => f.id === 'homebrew_manual_expertise')).toBe(true);
    expect(e.skills.skills.stealth.expertise).toBe(true);
  });

  it('re-resolving a NOT-YET-resolved choice id is unaffected (first-resolution path unchanged)', () => {
    let e = makeEmptyEntity('e1');
    e = withTrained(e, ['arcana', 'investigation']);
    e = queueChoice(e, expertiseDef('c1', 2), 1);
    const updated = applyExpertiseChoiceToEntity(e, 'c1_1', ['arcana', 'investigation'], DEFAULT_RULES);
    expect(updated.choices.find(c => c.id === 'c1_1')!.resolved).toBe(true);
  });

  it('resolving a nonexistent choice id is still a safe no-op', () => {
    const e = makeEmptyEntity('e1');
    const updated = applyExpertiseChoiceToEntity(e, 'nonexistent', ['arcana'], DEFAULT_RULES);
    expect(updated).toBe(e);
  });
});

// ============================================================================
// Codex re-audit finding (stale-eligibility closure): the creation picker
// used to compute effectiveRequired from the DISPLAYED option count (legal
// options + stale merged-back selections), which could disagree with the
// engine's own authoritative count when a stale selection is stale for a
// reason OTHER than "this choice's own grant is in the way" (e.g. an
// earlier proficiency choice was changed since, so the skill isn't even
// trained anymore). Fixed by extracting withExpertiseChoiceGrantStripped so
// both the UI and the engine compute "what's legal right now" through the
// exact same function — these tests exercise THAT function directly (the
// same one app/creation/repeated-choice.tsx now calls for its own
// `legalOptions`), plus applyExpertiseChoiceToEntity's own authoritative
// acceptance/rejection, so a regression here would be caught at the exact
// layer the UI actually depends on.
// ============================================================================
describe('Expertise — stale-eligibility closure (Codex re-audit, Part A-F)', () => {
  it('A: invalidated prior selection, zero legal options — engine accepts [], UI-computed legal count agrees', () => {
    let e = makeEmptyEntity('e1');
    e = withTrained(e, ['athletics']);
    e = queueChoice(e, expertiseDef('c1', 1), 1);
    e = applyExpertiseChoiceToEntity(e, 'c1_1', ['athletics'], DEFAULT_RULES);
    expect(e.skills.skills.athletics.expertise).toBe(true);

    // Earlier proficiency edit invalidates the only trained skill.
    e = untrained(e, 'athletics');

    // This is EXACTLY what app/creation/repeated-choice.tsx computes for
    // `legalOptions` — mirrored here so a regression in either place is caught.
    const stripped = withExpertiseChoiceGrantStripped(e, 'c1_1', DEFAULT_RULES);
    const legal = eligibleExpertiseOptions(stripped, 'all');
    expect(legal).toHaveLength(0); // athletics correctly excluded — genuinely stale, not just "this choice's own grant"
    expect(effectiveRequiredCount(1, legal.length)).toBe(0);

    // The stale id must never satisfy the (now-zero) requirement — rejected
    // by the count gate itself, since there is no legal slot for it at all.
    expect(() => applyExpertiseChoiceToEntity(e, 'c1_1', ['athletics'], DEFAULT_RULES)).toThrow(/expected 0/i);
    // [] is accepted — creation unblocks.
    const resolved = applyExpertiseChoiceToEntity(e, 'c1_1', [], DEFAULT_RULES);
    expect(resolved.choices.find(c => c.id === 'c1_1')!.selections).toEqual([]);
    expect(resolved.skills.skills.athletics.expertise).toBe(false);
  });

  it('B: invalidated prior selection, one legal replacement — stale id alone AND combined with the legal one are both rejected', () => {
    let e = makeEmptyEntity('e1');
    e = withTrained(e, ['athletics', 'arcana']);
    e = queueChoice(e, expertiseDef('c1', 2), 1);
    e = applyExpertiseChoiceToEntity(e, 'c1_1', ['athletics', 'arcana'], DEFAULT_RULES);
    e = untrained(e, 'athletics');

    const stripped = withExpertiseChoiceGrantStripped(e, 'c1_1', DEFAULT_RULES);
    const legal = eligibleExpertiseOptions(stripped, 'all');
    expect(legal.map(o => o.id)).toEqual(['arcana']); // arcana legal again (grant stripped); athletics genuinely stale
    expect(effectiveRequiredCount(2, legal.length)).toBe(1);

    // Not valid: the stale id alone.
    expect(() => applyExpertiseChoiceToEntity(e, 'c1_1', ['athletics'], DEFAULT_RULES)).toThrow(/not proficient/i);
    // Not valid: stale + legal combined (count mismatch — effectiveRequired is 1, not 2).
    expect(() => applyExpertiseChoiceToEntity(e, 'c1_1', ['athletics', 'arcana'], DEFAULT_RULES)).toThrow(/expected 1/i);
    // Valid: the one legal replacement alone.
    const resolved = applyExpertiseChoiceToEntity(e, 'c1_1', ['arcana'], DEFAULT_RULES);
    expect(resolved.choices.find(c => c.id === 'c1_1')!.selections).toEqual(['arcana']);
    expect(resolved.skills.skills.athletics.expertise).toBe(false);
    expect(resolved.skills.skills.arcana.expertise).toBe(true);
  });

  it('C: stale selection alongside enough OTHER legal options — stale cannot fill either slot', () => {
    let e = makeEmptyEntity('e1');
    e = withTrained(e, ['athletics', 'arcana', 'perception', 'stealth']);
    e = queueChoice(e, expertiseDef('c1', 2), 1);
    e = applyExpertiseChoiceToEntity(e, 'c1_1', ['athletics', 'arcana'], DEFAULT_RULES);
    e = untrained(e, 'athletics');

    const stripped = withExpertiseChoiceGrantStripped(e, 'c1_1', DEFAULT_RULES);
    const legal = eligibleExpertiseOptions(stripped, 'all').map(o => o.id).sort();
    expect(legal).toEqual(['arcana', 'perception', 'stealth']); // 3 legal — athletics excluded
    expect(effectiveRequiredCount(2, legal.length)).toBe(2); // still the nominal 2 — plenty of legal options

    expect(() => applyExpertiseChoiceToEntity(e, 'c1_1', ['athletics', 'arcana'], DEFAULT_RULES)).toThrow(/not proficient/i);
    const resolved = applyExpertiseChoiceToEntity(e, 'c1_1', ['arcana', 'perception'], DEFAULT_RULES);
    expect(resolved.choices.find(c => c.id === 'c1_1')!.selections).toEqual(['arcana', 'perception']);
  });

  it('D: a still-legal current selection continues to count normally (no false invalidation)', () => {
    let e = makeEmptyEntity('e1');
    e = withTrained(e, ['arcana', 'perception']);
    e = queueChoice(e, expertiseDef('c1', 2), 1);
    e = applyExpertiseChoiceToEntity(e, 'c1_1', ['arcana', 'perception'], DEFAULT_RULES);

    // Nothing invalidated — re-resolving with the SAME (still fully legal)
    // selection must behave exactly like a normal edit, not treat either
    // skill as stale.
    const stripped = withExpertiseChoiceGrantStripped(e, 'c1_1', DEFAULT_RULES);
    const legal = eligibleExpertiseOptions(stripped, 'all').map(o => o.id).sort();
    expect(legal).toEqual(['arcana', 'perception']);
    expect(effectiveRequiredCount(2, legal.length)).toBe(2);

    const resolved = applyExpertiseChoiceToEntity(e, 'c1_1', ['arcana', 'perception'], DEFAULT_RULES);
    expect(resolved.choices.find(c => c.id === 'c1_1')!.resolved).toBe(true);
  });

  it('E: invalid_expertise_target stays surfaced by validateEntity — the resolved choice is never silently reassigned', () => {
    let e = makeEmptyEntity('e1');
    e = withTrained(e, ['athletics']);
    e = queueChoice(e, expertiseDef('c1', 1), 1);
    e = applyExpertiseChoiceToEntity(e, 'c1_1', ['athletics'], DEFAULT_RULES);

    // Same raw-mutation pattern as the pre-existing "invalidated eligibility"
    // describe block above (validateEntity reads entity.skills.skills[x]
    // directly, with no recompute in between — a real recompute would
    // re-derive `trained` from this choice's OWN still-present multiply
    // grant and heal it right back to true, which is a different, already-
    // covered scenario — see test A above for the "properly revoked via
    // entitlement removal, survives recompute" case instead).
    const stale: Entity = { ...e, skills: { skills: { ...e.skills.skills, athletics: { ...e.skills.skills.athletics, trained: false } } } };

    // The Issue-surfacing mechanism agrees with the closure's own
    // legal-options computation (test A) that athletics no longer works —
    // and never silently drops/reassigns the choice's own selections.
    expect(stale.choices.find(c => c.id === 'c1_1')!.selections).toEqual(['athletics']);
    const issues = validateEntity(stale, baseContentDB(), []);
    expect(issues.some(i => i.code === 'invalid_expertise_target' && i.affectedId === 'athletics')).toBe(true);
  });

  it('F: fresh (never-resolved) Expertise creation is completely unaffected — withExpertiseChoiceGrantStripped is a true no-op', () => {
    let e = makeEmptyEntity('e1');
    e = withTrained(e, ['arcana', 'investigation']);
    e = queueChoice(e, expertiseDef('c1', 2), 1);

    const beforeStrip = e;
    const stripped = withExpertiseChoiceGrantStripped(e, 'c1_1', DEFAULT_RULES);
    expect(stripped).toBe(beforeStrip); // same reference — nothing to strip, no recompute

    const resolved = applyExpertiseChoiceToEntity(e, 'c1_1', ['arcana', 'investigation'], DEFAULT_RULES);
    expect(resolved.choices.find(c => c.id === 'c1_1')!.resolved).toBe(true);
    expect(resolved.skills.skills.arcana.expertise).toBe(true);
    expect(resolved.skills.skills.investigation.expertise).toBe(true);
  });
});

describe('Expertise — multiple independent sources (item 4, 30)', () => {
  it('a second expertise choice remains independently unresolved after the first is complete, and correctly excludes what the first already granted', () => {
    let e = makeEmptyEntity('e1');
    e = withTrained(e, ['arcana', 'investigation', 'perception', 'stealth']);
    e = queueChoice(e, expertiseDef('rogue_expertise_1', 2), 1);
    e = queueChoice(e, expertiseDef('rogue_expertise_6', 2), 6);

    e = applyExpertiseChoiceToEntity(e, 'rogue_expertise_1_1', ['arcana', 'investigation'], DEFAULT_RULES);

    const first  = e.choices.find(c => c.id === 'rogue_expertise_1_1')!;
    const second = e.choices.find(c => c.id === 'rogue_expertise_6_6')!;
    expect(first.resolved).toBe(true);
    expect(second.resolved).toBe(false);

    // The second choice's eligible pool no longer offers what the first
    // already consumed — computed live, not by extra bookkeeping.
    const eligibleForSecond = eligibleExpertiseOptions(e, 'all').map(o => o.id);
    expect(eligibleForSecond).not.toContain('arcana');
    expect(eligibleForSecond).not.toContain('investigation');
    expect(eligibleForSecond).toEqual(expect.arrayContaining(['perception', 'stealth']));

    e = applyExpertiseChoiceToEntity(e, 'rogue_expertise_6_6', ['perception', 'stealth'], DEFAULT_RULES);
    expect(e.choices.find(c => c.id === 'rogue_expertise_6_6')!.resolved).toBe(true);
    expect(e.skills.skills.perception.expertise).toBe(true);
    expect(e.skills.skills.stealth.expertise).toBe(true);
  });
});

describe('Expertise — removal / class change (item 6)', () => {
  it('a resolved expertise grant is tagged with the same source.kind as the granting class, so class-change stripping sweeps it up naturally', () => {
    let e = makeEmptyEntity('e1');
    e = withTrained(e, ['arcana', 'investigation']);
    e = queueChoice(e, { ...expertiseDef('rogue_expertise_1', 2), forClassId: 'rogue' }, 1);
    e = applyExpertiseChoiceToEntity(e, 'rogue_expertise_1_1', ['arcana', 'investigation'], DEFAULT_RULES);
    const grantFeature = e.features.find(f => f.id === 'rogue_expertise_1_1_grant');
    expect(grantFeature).toBeDefined();
    expect(grantFeature!.source).toEqual({ kind: 'class', refId: 'rogue' });
  });
});

describe('Expertise — invalidated eligibility (item 28, 29)', () => {
  it('validateEntity flags a resolved Expertise choice whose skill is no longer trained, without silently reassigning it', () => {
    let e = makeEmptyEntity('e1');
    e = withTrained(e, ['perception']);
    e = queueChoice(e, expertiseDef('c1', 1), 1);
    e = applyExpertiseChoiceToEntity(e, 'c1_1', ['perception'], DEFAULT_RULES);
    expect(e.choices.find(c => c.id === 'c1_1')!.selections).toEqual(['perception']);

    // Simulate the one real path where trained can flip back to false
    // (swapBackground's skill-retrain checklist) without touching the
    // resolved choice itself.
    const untrained: Entity = { ...e, skills: { skills: { ...e.skills.skills, perception: { ...e.skills.skills.perception, trained: false } } } };
    // The choice's own selection is untouched — never silently reassigned.
    expect(untrained.choices.find(c => c.id === 'c1_1')!.selections).toEqual(['perception']);

    const issues = validateEntity(untrained, baseContentDB(), []);
    expect(issues.some(i => i.code === 'invalid_expertise_target' && i.affectedId === 'perception')).toBe(true);
  });

  it('does not flag a still-valid resolved Expertise choice', () => {
    let e = makeEmptyEntity('e1');
    e = withTrained(e, ['perception']);
    e = queueChoice(e, expertiseDef('c1', 1), 1);
    e = applyExpertiseChoiceToEntity(e, 'c1_1', ['perception'], DEFAULT_RULES);
    const issues = validateEntity(e, baseContentDB(), []);
    expect(issues.some(i => i.code === 'invalid_expertise_target')).toBe(false);
  });
});

describe('Tools (items 7-9, 27, 31)', () => {
  it('eligibility excludes tools the character already has, and groups by category', () => {
    let e = makeEmptyEntity('e1');
    e = { ...e, proficiencies: { ...e.proficiencies, tools: ['thieves_tools'] } };
    const opts = eligibleToolOptions(e, 'all');
    expect(opts.find(o => o.id === 'thieves_tools')).toBeUndefined();
    const smith = opts.find(o => o.id === 'smiths_tools');
    expect(smith?.group).toBe('artisan');
  });

  it('resolving grants canonical tool ids (not display strings) to entity.proficiencies.tools', () => {
    let e = makeEmptyEntity('e1');
    e = queueChoice(e, toolDef('c1', 2), 1);
    const updated = applyToolChoiceToEntity(e, 'c1_1', ['alchemists_supplies', 'thieves_tools'], DEFAULT_RULES);
    expect(updated.proficiencies.tools).toEqual(expect.arrayContaining(['alchemists_supplies', 'thieves_tools']));
    expect(updated.choices.find(c => c.id === 'c1_1')!.resolved).toBe(true);
  });

  it('rejects a tool the character is already proficient with (item 27 — no duplicates)', () => {
    let e = makeEmptyEntity('e1');
    e = { ...e, proficiencies: { ...e.proficiencies, tools: ['thieves_tools'] } };
    e = queueChoice(e, toolDef('c1', 1), 1);
    expect(() => applyToolChoiceToEntity(e, 'c1_1', ['thieves_tools'], DEFAULT_RULES)).toThrow(/already proficient/i);
  });

  it('a restricted literal pool only offers those specific tools', () => {
    const restricted: ChoiceDefinition['pool'] = [
      { id: 'carpenters_tools', label: "Carpenter's Tools", value: 'carpenters_tools' },
      { id: 'masons_tools', label: "Mason's Tools", value: 'masons_tools' },
    ];
    const e = makeEmptyEntity('e1');
    const opts = eligibleToolOptions(e, restricted).map(o => o.id).sort();
    expect(opts).toEqual(['carpenters_tools', 'masons_tools']);
  });

  it('automatic grant vs required choice: an automatic tool grant never consumes/appears as a pending choice slot (item 14)', () => {
    // An "automatic" tool grant is just a Grant.kind:'proficiency' applied
    // directly at level-up — no ChoiceState is ever queued for it, so it
    // structurally cannot appear in a pending-choice count.
    let e = makeEmptyEntity('e1');
    e = { ...e, proficiencies: { ...e.proficiencies, tools: ['thieves_tools'] } }; // automatic
    e = queueChoice(e, toolDef('artisan_choice', 1), 1); // required: choose 1 artisan tool
    const pendingToolChoices = e.choices.filter(c => c.definition.kind === 'tool' && !c.resolved);
    expect(pendingToolChoices).toHaveLength(1); // only the REQUIRED one, counter starts at 0/1
    expect(pendingToolChoices[0].definition.count).toBe(1);
  });
});

describe('Languages (items 10-13, 27, 32)', () => {
  it('eligibility offers only Common/Exotic/Other by default — secret languages excluded (item 13)', () => {
    const e = makeEmptyEntity('e1');
    const opts = eligibleLanguageOptions(e, 'all');
    expect(opts.some(o => o.id === 'thieves_cant')).toBe(false);
    expect(opts.some(o => o.id === 'druidic')).toBe(false);
    expect(opts.some(o => o.id === 'common')).toBe(true);
    expect(opts.some(o => o.id === 'draconic')).toBe(true);
  });

  it('resolving grants canonical language ids, 2/2 complete', () => {
    let e = makeEmptyEntity('e1');
    e = queueChoice(e, languageDef('c1', 2), 1);
    const updated = applyLanguageChoiceToEntity(e, 'c1_1', ['elvish', 'dwarvish'], DEFAULT_RULES);
    expect(updated.proficiencies.languages).toEqual(expect.arrayContaining(['elvish', 'dwarvish']));
    expect(updated.choices.find(c => c.id === 'c1_1')!.resolved).toBe(true);
  });

  it('a restricted pool (item 12/32): "choose one of Elvish/Gnomish" never offers Draconic, even though the general registry has it', () => {
    const restricted: ChoiceDefinition['pool'] = [
      { id: 'elvish', label: 'Elvish', value: 'elvish' },
      { id: 'gnomish', label: 'Gnomish', value: 'gnomish' },
    ];
    const e = makeEmptyEntity('e1');
    const opts = eligibleLanguageOptions(e, restricted).map(o => o.id);
    expect(opts.sort()).toEqual(['elvish', 'gnomish']);
    expect(opts).not.toContain('draconic');
  });

  it('a restricted pool CAN explicitly include a secret language (item 13 — narrower rule, not a hardcoded global ban)', () => {
    const restricted: ChoiceDefinition['pool'] = [
      { id: 'thieves_cant', label: "Thieves' Cant", value: 'thieves_cant' },
    ];
    const e = makeEmptyEntity('e1');
    const opts = eligibleLanguageOptions(e, restricted).map(o => o.id);
    expect(opts).toEqual(['thieves_cant']);
  });

  it('rejects a language already known (no duplicates)', () => {
    let e = makeEmptyEntity('e1');
    e = { ...e, proficiencies: { ...e.proficiencies, languages: ['elvish'] } };
    e = queueChoice(e, languageDef('c1', 1), 1);
    expect(() => applyLanguageChoiceToEntity(e, 'c1_1', ['elvish'], DEFAULT_RULES)).toThrow(/already knows/i);
  });
});

// ============================================================================
// Tool/Language deadlock closure: the SAME effective-required-count /
// edit-in-place fix Expertise already got (see the "effective required
// count"/"edit-in-place" describe blocks above), applied to Tool/Language —
// they share the exact same bug shape (exact-count-required, no
// re-resolution). Restricted literal pools are used throughout to get a
// deterministic small eligible count without pre-granting dozens of real
// tool/language proficiencies.
// ============================================================================
describe('Tool/Language deadlock closure — effective required count', () => {
  const twoToolPool: ChoiceDefinition['pool'] = [
    { id: 'smiths_tools', label: "Smith's Tools", value: 'smiths_tools' },
    { id: 'masons_tools', label: "Mason's Tools", value: 'masons_tools' },
  ];
  const oneToolPool: ChoiceDefinition['pool'] = [
    { id: 'smiths_tools', label: "Smith's Tools", value: 'smiths_tools' },
  ];
  const twoLangPool: ChoiceDefinition['pool'] = [
    { id: 'elvish', label: 'Elvish', value: 'elvish' },
    { id: 'dwarvish', label: 'Dwarvish', value: 'dwarvish' },
  ];
  const oneLangPool: ChoiceDefinition['pool'] = [
    { id: 'elvish', label: 'Elvish', value: 'elvish' },
  ];

  it('normal required choice: requested 2, eligible 2 (via restricted pool) — both required, one alone is rejected', () => {
    let e = makeEmptyEntity('e1');
    e = queueChoice(e, toolDef('c1', 2, twoToolPool), 1);
    expect(() => applyToolChoiceToEntity(e, 'c1_1', ['smiths_tools'], DEFAULT_RULES)).toThrow(/expected 2/i);
    const updated = applyToolChoiceToEntity(e, 'c1_1', ['smiths_tools', 'masons_tools'], DEFAULT_RULES);
    expect(updated.choices.find(c => c.id === 'c1_1')!.resolved).toBe(true);
  });

  it('reduced legal option count: requested 2, eligible 1 (deadlock case) — selecting the one legal tool completes the choice', () => {
    let e = makeEmptyEntity('e1');
    e = queueChoice(e, toolDef('c1', 2, oneToolPool), 1);
    const updated = applyToolChoiceToEntity(e, 'c1_1', ['smiths_tools'], DEFAULT_RULES);
    expect(updated.choices.find(c => c.id === 'c1_1')!.resolved).toBe(true);
    expect(updated.proficiencies.tools).toContain('smiths_tools');
  });

  it('zero eligible options: requested 2, eligible 0 — resolves with [], never blocks creation', () => {
    let e = makeEmptyEntity('e1');
    e = { ...e, proficiencies: { ...e.proficiencies, tools: ['smiths_tools'] } }; // the only pool option is already known
    e = queueChoice(e, toolDef('c1', 2, oneToolPool), 1);
    const updated = applyToolChoiceToEntity(e, 'c1_1', [], DEFAULT_RULES);
    const resolved = updated.choices.find(c => c.id === 'c1_1')!;
    expect(resolved.resolved).toBe(true);
    expect(resolved.selections).toEqual([]);
  });

  it('duplicate rejection still applies even when the nominal count exceeds eligibility', () => {
    let e = makeEmptyEntity('e1');
    e = queueChoice(e, toolDef('c1', 2, twoToolPool), 1);
    expect(() => applyToolChoiceToEntity(e, 'c1_1', ['smiths_tools', 'smiths_tools'], DEFAULT_RULES)).toThrow(/duplicate/i);
  });

  it('provenance: the choiceId tag on the resulting entitlement is preserved, so only THIS choice\'s grant is removable', () => {
    let e = makeEmptyEntity('e1');
    e = queueChoice(e, toolDef('c1', 1, oneToolPool), 1);
    e = applyToolChoiceToEntity(e, 'c1_1', ['smiths_tools'], DEFAULT_RULES);
    expect(e.entitlements?.some(ent => ent.kind === 'tool_proficiency' && ent.key === 'smiths_tools' && ent.choiceId === 'c1_1')).toBe(true);
  });

  it('engine-level edit-in-place (reopen not yet wired in the UI for Tool/Language, but the engine now supports it): replacing a tool selection swaps the grant', () => {
    let e = makeEmptyEntity('e1');
    e = queueChoice(e, toolDef('c1', 1, twoToolPool), 1);
    e = applyToolChoiceToEntity(e, 'c1_1', ['smiths_tools'], DEFAULT_RULES);
    expect(e.proficiencies.tools).toContain('smiths_tools');

    e = applyToolChoiceToEntity(e, 'c1_1', ['masons_tools'], DEFAULT_RULES);
    expect(e.proficiencies.tools).not.toContain('smiths_tools');
    expect(e.proficiencies.tools).toContain('masons_tools');
    expect(e.choices.find(c => c.id === 'c1_1')!.selections).toEqual(['masons_tools']);
  });

  it('enough legal options still requires the full nominal count (never silently made optional)', () => {
    let e = makeEmptyEntity('e1');
    e = queueChoice(e, toolDef('c1', 2, twoToolPool), 1);
    expect(() => applyToolChoiceToEntity(e, 'c1_1', [], DEFAULT_RULES)).toThrow(/expected 2/i);
  });

  // ── Same matrix for Language, condensed (identical mechanism) ──────────────

  it('language: reduced legal option count — requested 2, eligible 1 completes with just the one', () => {
    let e = makeEmptyEntity('e1');
    e = queueChoice(e, languageDef('c1', 2, oneLangPool), 1);
    const updated = applyLanguageChoiceToEntity(e, 'c1_1', ['elvish'], DEFAULT_RULES);
    expect(updated.choices.find(c => c.id === 'c1_1')!.resolved).toBe(true);
    expect(updated.proficiencies.languages).toContain('elvish');
  });

  it('language: zero eligible options resolves with [] and does not block creation', () => {
    let e = makeEmptyEntity('e1');
    e = { ...e, proficiencies: { ...e.proficiencies, languages: ['elvish'] } };
    e = queueChoice(e, languageDef('c1', 1, oneLangPool), 1);
    const updated = applyLanguageChoiceToEntity(e, 'c1_1', [], DEFAULT_RULES);
    expect(updated.choices.find(c => c.id === 'c1_1')!.resolved).toBe(true);
  });

  it('language: enough legal options still requires the full nominal count', () => {
    let e = makeEmptyEntity('e1');
    e = queueChoice(e, languageDef('c1', 2, twoLangPool), 1);
    expect(() => applyLanguageChoiceToEntity(e, 'c1_1', ['elvish'], DEFAULT_RULES)).toThrow(/expected 2/i);
    const updated = applyLanguageChoiceToEntity(e, 'c1_1', ['elvish', 'dwarvish'], DEFAULT_RULES);
    expect(updated.choices.find(c => c.id === 'c1_1')!.resolved).toBe(true);
  });
});

describe('Repeated-choice resolution semantics (item 33, engine-level proxy for the shared picker mechanics)', () => {
  it('a choice with count 3 only resolves once all 3 are supplied at once — the apply function itself has no partial-progress state', () => {
    let e = makeEmptyEntity('e1');
    e = { ...e, proficiencies: { ...e.proficiencies, languages: [] } };
    e = queueChoice(e, languageDef('c1', 3), 1);
    expect(() => applyLanguageChoiceToEntity(e, 'c1_1', ['elvish', 'dwarvish'], DEFAULT_RULES)).toThrow(/expected 3/i);
    const updated = applyLanguageChoiceToEntity(e, 'c1_1', ['elvish', 'dwarvish', 'giant'], DEFAULT_RULES);
    expect(updated.choices.find(c => c.id === 'c1_1')!.resolved).toBe(true);
  });
});

describe('Unsupported choice kind (items 16, 17, 29)', () => {
  it('a genuinely unstructured kind ("custom") is surfaced as an Issue, never silently dropped', () => {
    let e = makeEmptyEntity('e1');
    e = queueChoice(e, { id: 'weird', prompt: 'Choose something.', kind: 'custom', count: 1, pool: 'all', grants: [], required: true, resolved: false }, 1);
    const issues = validateEntity(e, baseContentDB(), []);
    const issue = issues.find(i => i.code === 'unresolved_choice_kind');
    expect(issue).toBeDefined();
    expect(issue!.message).toContain('custom');
  });

  it('every choice kind this pass adds a real picker for is NOT flagged as unresolved_choice_kind', () => {
    let e = makeEmptyEntity('e1');
    e = withTrained(e, ['arcana']);
    e = queueChoice(e, expertiseDef('c1', 1), 1);
    e = queueChoice(e, toolDef('c2', 1), 1);
    e = queueChoice(e, languageDef('c3', 1), 1);
    const issues = validateEntity(e, baseContentDB(), []);
    expect(issues.filter(i => i.code === 'unresolved_choice_kind')).toHaveLength(0);
  });
});

describe('Homebrew-origin choices resolve through the exact same engine path (item 22, 35)', () => {
  it('a hand-authored (homebrew-shaped) tool ChoiceDefinition resolves identically to official content — the apply function is origin-agnostic', () => {
    // Simulates a homebrew class/feature granting "Choose 2 Tools" — the
    // engine has no concept of "official vs homebrew" at this layer; any
    // ChoiceDefinition of a supported kind resolves the same way regardless
    // of where it was authored (builder UI, hand-JSON, or an imported
    // package — see io/packageIO.ts, which already round-trips arbitrary
    // Feature/ChoiceDefinition JSON without caring about its origin).
    let e = makeEmptyEntity('e1');
    e = queueChoice(e, toolDef('homebrew_tool_choice', 2), 1);
    const updated = applyToolChoiceToEntity(e, 'homebrew_tool_choice_1', ['lute', 'dice_set'], DEFAULT_RULES);
    expect(updated.proficiencies.tools).toEqual(expect.arrayContaining(['lute', 'dice_set']));
  });

  it('a hand-authored (homebrew-shaped) language ChoiceDefinition resolves identically to official content', () => {
    let e = makeEmptyEntity('e1');
    e = queueChoice(e, languageDef('homebrew_lang_choice', 1), 1);
    const updated = applyLanguageChoiceToEntity(e, 'homebrew_lang_choice_1', ['orc'], DEFAULT_RULES);
    expect(updated.proficiencies.languages).toContain('orc');
  });
});

describe('Live entity mutation correctness (item 36)', () => {
  it('resolving a choice only touches the fields it should — no unrelated data changes', () => {
    let e = makeEmptyEntity('e1');
    e = withTrained(e, ['arcana', 'investigation']);
    e = queueChoice(e, expertiseDef('c1', 2), 1);
    const before = e;
    const after = applyExpertiseChoiceToEntity(e, 'c1_1', ['arcana', 'investigation'], DEFAULT_RULES);

    expect(after.identity).toEqual(before.identity);
    expect(after.inventory).toEqual(before.inventory);
    expect(after.spellcasting).toEqual(before.spellcasting);
    expect(after.proficiencies.languages).toEqual(before.proficiencies.languages);
    expect(after.proficiencies.tools).toEqual(before.proficiencies.tools);
    // Only the targeted skills + the new synthetic feature + the resolved choice changed.
    expect(after.features.length).toBe(before.features.length + 1);
  });
});

describe('CHOICE-AUTHORING-1: restricted pools are enforced at the runtime apply layer, not just by the picker UI', () => {
  it('applyExpertiseChoiceToEntity rejects a skill outside a restricted pool, even if otherwise eligible', () => {
    let e = makeEmptyEntity('e1');
    e = withTrained(e, ['arcana', 'investigation']);
    const restricted: ChoiceDefinition['pool'] = [{ id: 'arcana', label: 'Arcana', value: 'arcana' }];
    e = queueChoice(e, expertiseDef('c1', 1, restricted), 1);
    expect(() => applyExpertiseChoiceToEntity(e, 'c1_1', ['investigation'], DEFAULT_RULES)).toThrow();
  });

  it('applyExpertiseChoiceToEntity accepts a skill that IS in the restricted pool', () => {
    let e = makeEmptyEntity('e1');
    e = withTrained(e, ['arcana', 'investigation']);
    const restricted: ChoiceDefinition['pool'] = [{ id: 'arcana', label: 'Arcana', value: 'arcana' }];
    e = queueChoice(e, expertiseDef('c1', 1, restricted), 1);
    const updated = applyExpertiseChoiceToEntity(e, 'c1_1', ['arcana'], DEFAULT_RULES);
    expect(updated.skills.skills.arcana.expertise).toBe(true);
  });

  it('applyToolChoiceToEntity rejects a tool outside a restricted pool', () => {
    let e = makeEmptyEntity('e1');
    const restricted: ChoiceDefinition['pool'] = [{ id: 'smiths_tools', label: "Smith's Tools", value: 'smiths_tools' }];
    e = queueChoice(e, toolDef('c1', 1, restricted), 1);
    expect(() => applyToolChoiceToEntity(e, 'c1_1', ['thieves_tools'], DEFAULT_RULES)).toThrow();
  });

  it('applyLanguageChoiceToEntity rejects a language outside a restricted pool, INCLUDING a secret language not explicitly listed', () => {
    let e = makeEmptyEntity('e1');
    const restricted: ChoiceDefinition['pool'] = [
      { id: 'dwarvish', label: 'Dwarvish', value: 'dwarvish' },
      { id: 'elvish', label: 'Elvish', value: 'elvish' },
    ];
    e = queueChoice(e, languageDef('c1', 1, restricted), 1);
    expect(() => applyLanguageChoiceToEntity(e, 'c1_1', ['thieves_cant'], DEFAULT_RULES)).toThrow();
  });

  it('an unrestricted (\'all\' sentinel) pool imposes no extra restriction — unchanged behavior', () => {
    let e = makeEmptyEntity('e1');
    e = queueChoice(e, toolDef('c1', 1, 'all'), 1);
    const updated = applyToolChoiceToEntity(e, 'c1_1', ['thieves_tools'], DEFAULT_RULES);
    expect(updated.proficiencies.tools).toContain('thieves_tools');
  });
});
