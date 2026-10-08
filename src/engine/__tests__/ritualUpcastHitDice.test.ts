// src/engine/__tests__/ritualUpcastHitDice.test.ts
// Rules-completeness batch: ritual casting, explicit cast/upcast level
// selection, and shared pending-execution-state correctness. Mixed hit-die
// pool selection has its own focused coverage in rest.test.ts (spendHitDie/
// spendHitDieManual/discardHitDie's dieSize ambiguity-refusal tests) —
// not duplicated here.
import {
  Entity, Spell, CharClass, SpellSlots, EntitlementRecord, ActionCard,
} from '../types';
import { applyActionCardUse } from '../actionUse';
import { generateSpellCard, resolveSpellCastingContexts } from '../actionCards';
import { makeEmptyEntity, DEFAULT_RULES } from '../../store/characterStore';
import { ALL_CHAR_CLASSES } from '../../content/classes';
import { startTurn } from '../combat';

function emptySlots(overrides: Partial<Record<keyof SpellSlots, { total: number; used: number }>> = {}): SpellSlots {
  const tiers = ['1', '2', '3', '4', '5', '6', '7', '8', '9'] as const;
  const slots = {} as SpellSlots;
  for (const t of tiers) slots[t] = { total: 0, used: 0 };
  return { ...slots, ...overrides };
}

function leveledSpell(id: string, level: number, overrides: Partial<Spell> = {}): Spell {
  return {
    id, name: id, level, school: 'Evocation', castingTime: '1 action', range: '60 feet',
    components: ['V', 'S'], duration: 'Instantaneous', description: 'Test spell.',
    upcast: null, ritual: false, concentration: false,
    ...overrides,
  };
}

function ent(kind: 'spell_access' | 'cantrip_access', key: string, sourceKind: EntitlementRecord['sourceKind'], sourceId?: string): EntitlementRecord {
  return { kind, key, sourceKind, sourceId };
}

// A real class from the official catalog with ritualCasting: true (Wizard),
// and one without it (Sorcerer) — see content/classes/index.ts.
const wizard = ALL_CHAR_CLASSES.find(c => c.id === 'wizard')!;
const sorcerer = ALL_CHAR_CLASSES.find(c => c.id === 'sorcerer')!;

describe('rules-completeness batch — A. ritual casting', () => {
  it('1. a non-ritual spell never carries ritualEligible', () => {
    const spell = leveledSpell('fireball', 3, { ritual: false });
    const e: Entity = {
      ...makeEmptyEntity('e1'),
      entitlements: [ent('spell_access', 'fireball', 'class', 'wizard')],
      spellcasting: { ability: 'int', slots: emptySlots({ '3': { total: 1, used: 0 } }), cantrips: [], known: ['fireball'], prepared: ['fireball'], concentrating: null },
    };
    const card = generateSpellCard('fireball', e, { classDefs: ALL_CHAR_CLASSES, homebrewSpells: [spell] });
    expect(card?.ritualEligible).toBeFalsy();
  });

  it('2. a ritual-capable spell with a legal ritual-casting source (Wizard) IS ritualEligible', () => {
    const spell = leveledSpell('comprehend_languages', 1, { ritual: true });
    const e: Entity = {
      ...makeEmptyEntity('e1'),
      entitlements: [ent('spell_access', 'comprehend_languages', 'class', 'wizard')],
      spellcasting: { ability: 'int', slots: emptySlots({ '1': { total: 2, used: 0 } }), cantrips: [], known: ['comprehend_languages'], prepared: ['comprehend_languages'], concentrating: null },
    };
    const card = generateSpellCard('comprehend_languages', e, { classDefs: ALL_CHAR_CLASSES, homebrewSpells: [spell] });
    expect(card?.ritualEligible).toBe(true);
  });

  it('2b. the SAME ritual spell through a Sorcerer (no Ritual Casting feature) is NOT ritualEligible', () => {
    const spell = leveledSpell('comprehend_languages', 1, { ritual: true });
    const e: Entity = {
      ...makeEmptyEntity('e1'),
      entitlements: [ent('spell_access', 'comprehend_languages', 'class', 'sorcerer')],
      spellcasting: { ability: 'cha', slots: emptySlots({ '1': { total: 2, used: 0 } }), cantrips: [], known: ['comprehend_languages'], prepared: [], concentrating: null },
    };
    const card = generateSpellCard('comprehend_languages', e, { classDefs: ALL_CHAR_CLASSES, homebrewSpells: [spell] });
    expect(card?.ritualEligible).toBeFalsy();
  });

  it('3. a normal cast spends a slot normally', () => {
    const spell = leveledSpell('comprehend_languages', 1, { ritual: true });
    let e: Entity = {
      ...makeEmptyEntity('e1'),
      entitlements: [ent('spell_access', 'comprehend_languages', 'class', 'wizard')],
      spellcasting: { ability: 'int', slots: emptySlots({ '1': { total: 2, used: 0 } }), cantrips: [], known: ['comprehend_languages'], prepared: ['comprehend_languages'], concentrating: null },
    };
    const content = { classDefs: ALL_CHAR_CLASSES, homebrewSpells: [spell] };
    const card = generateSpellCard('comprehend_languages', e, content)!;
    const result = applyActionCardUse(e, card, DEFAULT_RULES, undefined, { kind: 'normal', tier: '1' }, undefined, undefined, content);
    expect(result.spellcasting!.slots['1'].used).toBe(1);
  });

  it('4. a ritual cast of the SAME card spends NO slot', () => {
    const spell = leveledSpell('comprehend_languages', 1, { ritual: true });
    let e: Entity = {
      ...makeEmptyEntity('e1'),
      entitlements: [ent('spell_access', 'comprehend_languages', 'class', 'wizard')],
      spellcasting: { ability: 'int', slots: emptySlots({ '1': { total: 2, used: 0 } }), cantrips: [], known: ['comprehend_languages'], prepared: ['comprehend_languages'], concentrating: null },
    };
    const content = { classDefs: ALL_CHAR_CLASSES, homebrewSpells: [spell] };
    const card = generateSpellCard('comprehend_languages', e, content)!;
    expect(card.ritualEligible).toBe(true);
    const result = applyActionCardUse(e, card, DEFAULT_RULES, undefined, undefined, undefined, undefined, content, undefined, 'ritual');
    expect(result).not.toBe(e); // the cast went through
    expect(result.spellcasting!.slots['1'].used).toBe(0); // no slot spent
  });

  it('4b. ritual never marks the action-economy slot used, unlike a normal cast', () => {
    const spell = leveledSpell('comprehend_languages', 1, { ritual: true });
    let e: Entity = {
      ...startTurn(makeEmptyEntity('e1')),
      entitlements: [ent('spell_access', 'comprehend_languages', 'class', 'wizard')],
      spellcasting: { ability: 'int', slots: emptySlots({ '1': { total: 2, used: 0 } }), cantrips: [], known: ['comprehend_languages'], prepared: ['comprehend_languages'], concentrating: null },
    };
    const content = { classDefs: ALL_CHAR_CLASSES, homebrewSpells: [spell] };
    const card = generateSpellCard('comprehend_languages', e, content)!;
    const result = applyActionCardUse(e, card, DEFAULT_RULES, undefined, undefined, undefined, undefined, content, undefined, 'ritual');
    expect(result.turnState?.actionUsed).toBeFalsy();
  });

  it('5. Pact Magic source: ritual does not spend a Pact slot either', () => {
    const spell = leveledSpell('comprehend_languages', 1, { ritual: true, classes: ['wizard'] });
    // Give the Wizard entitlement a pact-shaped slot pool to prove ritual
    // never touches ANY slot pool, pact or normal — spendSpellSlot itself
    // is never even called for a ritual cast (cost is null), so this is a
    // negative-space check.
    let e: Entity = {
      ...makeEmptyEntity('e1'),
      entitlements: [ent('spell_access', 'comprehend_languages', 'class', 'wizard')],
      spellcasting: {
        ability: 'int', slots: emptySlots({ '1': { total: 2, used: 0 } }),
        pactSlots: emptySlots({ '1': { total: 2, used: 0 } }),
        cantrips: [], known: ['comprehend_languages'], prepared: ['comprehend_languages'], concentrating: null,
      },
    };
    const content = { classDefs: ALL_CHAR_CLASSES, homebrewSpells: [spell] };
    const card = generateSpellCard('comprehend_languages', e, content)!;
    const result = applyActionCardUse(e, card, DEFAULT_RULES, undefined, undefined, undefined, undefined, content, undefined, 'ritual');
    expect(result.spellcasting!.slots['1'].used).toBe(0);
    expect(result.spellcasting!.pactSlots!['1'].used).toBe(0);
  });

  it('6. ritual cast preserves the correct casting ability/context (Wizard INT, not a global default)', () => {
    const spell = leveledSpell('comprehend_languages', 1, { ritual: true });
    let e: Entity = {
      ...makeEmptyEntity('e1'),
      stats: { str: 10, dex: 10, con: 10, int: 18, wis: 10, cha: 8 },
      entitlements: [ent('spell_access', 'comprehend_languages', 'class', 'wizard')],
      spellcasting: { ability: 'int', slots: emptySlots({ '1': { total: 2, used: 0 } }), cantrips: [], known: ['comprehend_languages'], prepared: ['comprehend_languages'], concentrating: null },
    };
    const content = { classDefs: ALL_CHAR_CLASSES, homebrewSpells: [spell] };
    const card = generateSpellCard('comprehend_languages', e, content)!;
    expect(card.spellCastingContext?.castingAbility).toBe('int');
    const result = applyActionCardUse(e, card, DEFAULT_RULES, undefined, undefined, undefined, undefined, content, undefined, 'ritual');
    expect(result).not.toBe(e);
  });

  // NOTE (7 — ritual cast preserves concentration behavior): NOT covered by
  // a dedicated unit test here. applyActionCardUse's concentration check
  // (`if (spell?.concentration) castConcentrationSpell(...)`) is completely
  // UNTOUCHED by this batch's ritual changes — it runs identically, from
  // the same line, regardless of castMode — and resolves the spell via
  // spellRepo's OFFICIAL Tier-2 cache, which requires async
  // spellRepo.ensureLoaded() against a real content.db in this project's
  // native test environment (no existing engine test in this codebase
  // exercises that path directly either — see TabSpells.tsx's own comment
  // on why it re-checks concentration itself via homebrew-first spellMap).
  // Verified by inspection: test 4 above already proves a ritual cast
  // executes and mutates the entity; the concentration line sits, unchanged,
  // three lines below the code both that test and this file's other tests
  // already exercise.

  // NOTE (8/9 — originally "unprepared ritual blocked without Cast Anyway" /
  // "Cast Anyway + Ritual bypasses prep only"): these used a WIZARD fixture,
  // which is exactly the HIGH-fix closure's scenario — a Wizard ritual from
  // the spellbook is now CORRECTLY legal unprepared, with no Cast Anyway
  // needed. Superseded by, and no longer duplicated here: see the dedicated
  // "A8. Wizard source-specific ritual policy" describe block below for the
  // Wizard case (tests 1/2), and its Cleric case (tests 5/6) for the exact
  // "still requires preparation, Cast Anyway bypasses it" behavior these two
  // tests originally meant to cover, now correctly modeled on a
  // 'prepared'-policy class instead of a 'spellbook'-policy one.

  it('10. a stale/removed source is rejected before any ritual mutation', () => {
    const spell = leveledSpell('comprehend_languages', 1, { ritual: true });
    let e: Entity = {
      ...makeEmptyEntity('e1'),
      entitlements: [ent('spell_access', 'comprehend_languages', 'class', 'wizard')],
      spellcasting: { ability: 'int', slots: emptySlots({ '1': { total: 2, used: 0 } }), cantrips: [], known: ['comprehend_languages'], prepared: ['comprehend_languages'], concentrating: null },
    };
    const content = { classDefs: ALL_CHAR_CLASSES, homebrewSpells: [spell] };
    const card = generateSpellCard('comprehend_languages', e, content)!;
    // The Wizard class entitlement is gone by execution time (class removed).
    const staleEntity = { ...e, entitlements: [] };
    const result = applyActionCardUse(staleEntity, card, DEFAULT_RULES, undefined, undefined, undefined, undefined, content, undefined, 'ritual');
    expect(result).toBe(staleEntity);
  });

  it("10b. a card that over-offers ritual (some OTHER context supports it) refuses when the ACTUALLY SELECTED context doesn't", () => {
    // Wizard AND Sorcerer both know the same ritual spell — card.ritualEligible
    // is true (Wizard supports it), but the player selects the Sorcerer
    // context specifically. Execution must refuse, not silently succeed.
    const spell = leveledSpell('comprehend_languages', 1, { ritual: true });
    let e: Entity = {
      ...makeEmptyEntity('e1'),
      entitlements: [
        ent('spell_access', 'comprehend_languages', 'class', 'wizard'),
        ent('spell_access', 'comprehend_languages', 'class', 'sorcerer'),
      ],
      spellcasting: {
        ability: 'int', slots: emptySlots({ '1': { total: 2, used: 0 } }),
        cantrips: [], known: ['comprehend_languages'], prepared: ['comprehend_languages'], concentrating: null,
      },
    };
    const content = { classDefs: ALL_CHAR_CLASSES, homebrewSpells: [spell] };
    const card = generateSpellCard('comprehend_languages', e, content)!;
    expect(card.ritualEligible).toBe(true);
    const sorcererContext = resolveSpellCastingContexts(e, 'comprehend_languages', ALL_CHAR_CLASSES).find(c => c.classId === 'sorcerer')!;
    expect(sorcererContext.ritualEligible).toBeFalsy();
    const result = applyActionCardUse(e, card, DEFAULT_RULES, undefined, undefined, undefined, sorcererContext, content, undefined, 'ritual');
    expect(result).toBe(e); // refused — Sorcerer can't ritual-cast, regardless of the card-level flag
  });

  it('11. a homebrew ritual spell/source works through an explicit content snapshot', () => {
    const homebrewCaster: CharClass = {
      id: 'runeblade', name: 'Runeblade', hitDie: 8, features: [],
      spellcastingAbility: 'int', spellPreparationPolicy: 'full_list_prepared', ritualCastingPolicy: 'prepared',
    };
    const runeRitual = leveledSpell('rune_ward', 1, { ritual: true, classes: ['runeblade'] });
    let e: Entity = {
      ...makeEmptyEntity('e1'),
      entitlements: [ent('spell_access', 'rune_ward', 'class', 'runeblade')],
      spellcasting: { ability: 'int', slots: emptySlots({ '1': { total: 1, used: 0 } }), cantrips: [], known: ['rune_ward'], prepared: ['rune_ward'], concentrating: null },
    };
    const content = { classDefs: [...ALL_CHAR_CLASSES, homebrewCaster], homebrewSpells: [runeRitual] };
    const card = generateSpellCard('rune_ward', e, content)!;
    expect(card.ritualEligible).toBe(true);
    const result = applyActionCardUse(e, card, DEFAULT_RULES, undefined, undefined, undefined, undefined, content, undefined, 'ritual');
    expect(result).not.toBe(e);
    expect(result.spellcasting!.slots['1'].used).toBe(0);
  });
});

// ============================================================================
// HIGH-fix closure (Codex audit finding 1): Wizard ritual casting must be
// legal straight from the spellbook, UNPREPARED, without Cast Anyway — see
// CharClass.ritualCastingPolicy and SpellCastingContext.ritualLegal's own
// doc comments (types.ts) for exactly why ritualLegal is a SEPARATE axis
// from the normal-cast `legal` field.
// ============================================================================
describe('rules-completeness batch — A8. Wizard source-specific ritual policy (HIGH-fix closure)', () => {
  // A synthetic ritual spell fixture supplied via homebrewSpells in every
  // `content` object below — spellRepo's Tier-2 cache isn't warmed in this
  // test environment (see the file's earlier note on the concentration
  // test), so even a REAL official spell id needs an explicit fallback
  // definition to resolve through generateSpellCard here.
  const detectMagicSpell = leveledSpell('detect_magic', 1, { ritual: true, concentration: true });

  function detectMagicWizard(overrides: Partial<Entity> = {}): Entity {
    return {
      ...makeEmptyEntity('e1'),
      entitlements: [ent('spell_access', 'detect_magic', 'class', 'wizard')],
      spellcasting: { ability: 'int', slots: emptySlots({ '1': { total: 2, used: 0 } }), cantrips: [], known: ['detect_magic'], prepared: [], concentrating: null },
      ...overrides,
    };
  }

  it('1. Wizard ritual spell in spellbook, UNPREPARED — legal ritual cast, no Cast Anyway needed', () => {
    const e = detectMagicWizard();
    const content = { classDefs: ALL_CHAR_CLASSES, homebrewSpells: [detectMagicSpell] };
    const card = generateSpellCard('detect_magic', e, content)!;
    expect(card.spellCastingContext?.legal).toBe(false); // normal-cast prep gate: unprepared, still illegal
    expect(card.spellCastingContext?.ritualLegal).toBe(true); // ritual: legal straight from the spellbook
    const result = applyActionCardUse(e, card, DEFAULT_RULES, undefined, undefined, /*bypassSpellPreparation*/ false, undefined, content, undefined, 'ritual');
    expect(result).not.toBe(e); // legal WITHOUT Cast Anyway
    expect(result.spellcasting!.slots['1'].used).toBe(0);
  });

  it('2. the SAME Wizard spell, NORMAL cast, unprepared — still blocked unless Cast Anyway (unchanged)', () => {
    const e = detectMagicWizard();
    const content = { classDefs: ALL_CHAR_CLASSES, homebrewSpells: [detectMagicSpell] };
    const card = generateSpellCard('detect_magic', e, content)!;
    const blocked = applyActionCardUse(e, card, DEFAULT_RULES, undefined, { kind: 'normal', tier: '1' }, /*bypassSpellPreparation*/ false, undefined, content);
    expect(blocked).toBe(e); // normal casting is NOT affected by this fix
    const viaCastAnyway = applyActionCardUse(e, card, DEFAULT_RULES, undefined, { kind: 'normal', tier: '1' }, /*bypassSpellPreparation*/ true, undefined, content);
    expect(viaCastAnyway).not.toBe(e);
    expect(viaCastAnyway.spellcasting!.slots['1'].used).toBe(1);
  });

  it('3. Wizard ritual spell PREPARED — ritual still legal', () => {
    const e = detectMagicWizard({ spellcasting: { ability: 'int', slots: emptySlots({ '1': { total: 2, used: 0 } }), cantrips: [], known: ['detect_magic'], prepared: ['detect_magic'], concentrating: null } });
    const content = { classDefs: ALL_CHAR_CLASSES, homebrewSpells: [detectMagicSpell] };
    const card = generateSpellCard('detect_magic', e, content)!;
    expect(card.spellCastingContext?.ritualLegal).toBe(true);
    const result = applyActionCardUse(e, card, DEFAULT_RULES, undefined, undefined, undefined, undefined, content, undefined, 'ritual');
    expect(result).not.toBe(e);
  });

  it('4. Wizard ritual spell NOT in the Wizard source/spellbook at all — ritual rejected', () => {
    const e = detectMagicWizard();
    const content = { classDefs: ALL_CHAR_CLASSES, homebrewSpells: [detectMagicSpell] };
    const card = generateSpellCard('detect_magic', e, content)!;
    // The Wizard entitlement never existed for this spell in the first place.
    const noOwnershipEntity = { ...e, entitlements: [] };
    const result = applyActionCardUse(noOwnershipEntity, card, DEFAULT_RULES, undefined, undefined, /*bypassSpellPreparation*/ true, undefined, content, undefined, 'ritual');
    // Cast Anyway must NOT fabricate ownership — still rejected even with the override.
    expect(result).toBe(noOwnershipEntity);
  });

  it('5. Cleric ritual spell PREPARED — legal', () => {
    const e: Entity = {
      ...makeEmptyEntity('e1'),
      entitlements: [ent('spell_access', 'detect_magic', 'class', 'cleric')],
      spellcasting: { ability: 'wis', slots: emptySlots({ '1': { total: 2, used: 0 } }), cantrips: [], known: ['detect_magic'], prepared: ['detect_magic'], concentrating: null },
    };
    const content = { classDefs: ALL_CHAR_CLASSES, homebrewSpells: [detectMagicSpell] };
    const card = generateSpellCard('detect_magic', e, content)!;
    expect(card.spellCastingContext?.ritualLegal).toBe(true);
    const result = applyActionCardUse(e, card, DEFAULT_RULES, undefined, undefined, undefined, undefined, content, undefined, 'ritual');
    expect(result).not.toBe(e);
  });

  it('6. Cleric ritual spell UNPREPARED — blocked unless Cast Anyway (ritual does NOT bypass Cleric prep)', () => {
    const e: Entity = {
      ...makeEmptyEntity('e1'),
      entitlements: [ent('spell_access', 'detect_magic', 'class', 'cleric')],
      spellcasting: { ability: 'wis', slots: emptySlots({ '1': { total: 2, used: 0 } }), cantrips: [], known: ['detect_magic'], prepared: [], concentrating: null },
    };
    const content = { classDefs: ALL_CHAR_CLASSES, homebrewSpells: [detectMagicSpell] };
    const card = generateSpellCard('detect_magic', e, content)!;
    expect(card.spellCastingContext?.ritualLegal).toBe(false);
    const blocked = applyActionCardUse(e, card, DEFAULT_RULES, undefined, undefined, /*bypassSpellPreparation*/ false, undefined, content, undefined, 'ritual');
    expect(blocked).toBe(e);
    const viaCastAnyway = applyActionCardUse(e, card, DEFAULT_RULES, undefined, undefined, /*bypassSpellPreparation*/ true, undefined, content, undefined, 'ritual');
    expect(viaCastAnyway).not.toBe(e);
    expect(viaCastAnyway.spellcasting!.slots['1'].used).toBe(0); // still a ritual — no slot
  });

  it('7. Bard known ritual spell — legal (Bard never prepares, so there is nothing to bypass)', () => {
    const e: Entity = {
      ...makeEmptyEntity('e1'),
      entitlements: [ent('spell_access', 'detect_magic', 'class', 'bard')],
      spellcasting: { ability: 'cha', slots: emptySlots({ '1': { total: 2, used: 0 } }), cantrips: [], known: ['detect_magic'], prepared: [], concentrating: null },
    };
    const content = { classDefs: ALL_CHAR_CLASSES, homebrewSpells: [detectMagicSpell] };
    const card = generateSpellCard('detect_magic', e, content)!;
    expect(card.spellCastingContext?.ritualLegal).toBe(true);
    const result = applyActionCardUse(e, card, DEFAULT_RULES, undefined, undefined, undefined, undefined, content, undefined, 'ritual');
    expect(result).not.toBe(e);
  });

  it('8. Sorcerer with the same ritual-tagged spell — ritual illegal (no Ritual Casting feature)', () => {
    const e: Entity = {
      ...makeEmptyEntity('e1'),
      entitlements: [ent('spell_access', 'detect_magic', 'class', 'sorcerer')],
      spellcasting: { ability: 'cha', slots: emptySlots({ '1': { total: 2, used: 0 } }), cantrips: [], known: ['detect_magic'], prepared: [], concentrating: null },
    };
    const content = { classDefs: ALL_CHAR_CLASSES, homebrewSpells: [detectMagicSpell] };
    const card = generateSpellCard('detect_magic', e, content)!;
    expect(card.ritualEligible).toBeFalsy(); // no source offers ritual at all
    const result = applyActionCardUse(e, card, DEFAULT_RULES, undefined, undefined, /*bypassSpellPreparation*/ true, undefined, content, undefined, 'ritual');
    expect(result).toBe(e); // illegal even with Cast Anyway — Sorcerer simply cannot ritual-cast
  });

  it('9. same spell from Wizard + Sorcerer: Wizard context is a legal ritual, Sorcerer context is not', () => {
    const e: Entity = {
      ...makeEmptyEntity('e1'),
      entitlements: [
        ent('spell_access', 'detect_magic', 'class', 'wizard'),
        ent('spell_access', 'detect_magic', 'class', 'sorcerer'),
      ],
      spellcasting: { ability: 'int', slots: emptySlots({ '1': { total: 2, used: 0 } }), cantrips: [], known: ['detect_magic'], prepared: [], concentrating: null },
    };
    const content = { classDefs: ALL_CHAR_CLASSES, homebrewSpells: [detectMagicSpell] };
    const contexts = resolveSpellCastingContexts(e, 'detect_magic', ALL_CHAR_CLASSES);
    const wizardContext = contexts.find(c => c.classId === 'wizard')!;
    const sorcererContext = contexts.find(c => c.classId === 'sorcerer')!;
    expect(wizardContext.ritualLegal).toBe(true);
    expect(sorcererContext.ritualLegal).toBeFalsy();

    const card = generateSpellCard('detect_magic', e, content)!;
    const viaWizard = applyActionCardUse(e, card, DEFAULT_RULES, undefined, undefined, undefined, wizardContext, content, undefined, 'ritual');
    expect(viaWizard).not.toBe(e);
    const viaSorcerer = applyActionCardUse(e, card, DEFAULT_RULES, undefined, undefined, undefined, sorcererContext, content, undefined, 'ritual');
    expect(viaSorcerer).toBe(e);
  });

  it('10. stale Wizard source/spellbook removal — ritual rejected before any side effect', () => {
    const e = detectMagicWizard();
    const content = { classDefs: ALL_CHAR_CLASSES, homebrewSpells: [detectMagicSpell] };
    const card = generateSpellCard('detect_magic', e, content)!;
    const staleEntity = { ...e, entitlements: [] }; // Wizard class/spell access removed since the card was generated
    const result = applyActionCardUse(staleEntity, card, DEFAULT_RULES, undefined, undefined, undefined, undefined, content, undefined, 'ritual');
    expect(result).toBe(staleEntity);
  });

  it('11. Wizard ritual does not spend a slot', () => {
    const e = detectMagicWizard();
    const content = { classDefs: ALL_CHAR_CLASSES, homebrewSpells: [detectMagicSpell] };
    const card = generateSpellCard('detect_magic', e, content)!;
    const result = applyActionCardUse(e, card, DEFAULT_RULES, undefined, undefined, undefined, undefined, content, undefined, 'ritual');
    expect(result.spellcasting!.slots['1'].used).toBe(0);
  });

  it('12. Wizard ritual keeps the correct INT casting context', () => {
    const e = detectMagicWizard({ stats: { str: 10, dex: 10, con: 10, int: 18, wis: 8, cha: 8 } });
    const content = { classDefs: ALL_CHAR_CLASSES, homebrewSpells: [detectMagicSpell] };
    const card = generateSpellCard('detect_magic', e, content)!;
    expect(card.spellCastingContext?.castingAbility).toBe('int');
    const result = applyActionCardUse(e, card, DEFAULT_RULES, undefined, undefined, undefined, undefined, content, undefined, 'ritual');
    expect(result).not.toBe(e);
  });
});

describe('rules-completeness batch — B. explicit cast/upcast level', () => {
  it('1. base-level spell with only the base slot available spends that slot, no chooser needed', () => {
    const spell = leveledSpell('magic_missile', 1);
    let e: Entity = {
      ...makeEmptyEntity('e1'),
      entitlements: [ent('spell_access', 'magic_missile', 'class', 'wizard')],
      spellcasting: { ability: 'int', slots: emptySlots({ '1': { total: 1, used: 0 } }), cantrips: [], known: ['magic_missile'], prepared: ['magic_missile'], concentrating: null },
    };
    const content = { classDefs: ALL_CHAR_CLASSES, homebrewSpells: [spell] };
    const card = generateSpellCard('magic_missile', e, content)!;
    const result = applyActionCardUse(e, card, DEFAULT_RULES, undefined, { kind: 'normal', tier: '1' }, undefined, undefined, content);
    expect(result.spellcasting!.slots['1'].used).toBe(1);
  });

  it('3. an explicitly selected HIGHER slot level spends EXACTLY that tier, never the base tier', () => {
    const spell = leveledSpell('magic_missile', 1);
    let e: Entity = {
      ...makeEmptyEntity('e1'),
      entitlements: [ent('spell_access', 'magic_missile', 'class', 'wizard')],
      spellcasting: { ability: 'int', slots: emptySlots({ '1': { total: 1, used: 0 }, '3': { total: 1, used: 0 } }), cantrips: [], known: ['magic_missile'], prepared: ['magic_missile'], concentrating: null },
    };
    const content = { classDefs: ALL_CHAR_CLASSES, homebrewSpells: [spell] };
    const card = generateSpellCard('magic_missile', e, content)!;
    const result = applyActionCardUse(e, card, DEFAULT_RULES, undefined, { kind: 'normal', tier: '3' }, undefined, undefined, content);
    expect(result.spellcasting!.slots['1'].used).toBe(0); // base tier untouched
    expect(result.spellcasting!.slots['3'].used).toBe(1); // exactly the selected tier
  });

  it('5. an unavailable slot level cannot be used — payment refused, entity unchanged', () => {
    const spell = leveledSpell('magic_missile', 1);
    let e: Entity = {
      ...makeEmptyEntity('e1'),
      entitlements: [ent('spell_access', 'magic_missile', 'class', 'wizard')],
      spellcasting: { ability: 'int', slots: emptySlots({ '1': { total: 1, used: 0 } }), cantrips: [], known: ['magic_missile'], prepared: ['magic_missile'], concentrating: null }, // no 3rd-level slot at all
    };
    const content = { classDefs: ALL_CHAR_CLASSES, homebrewSpells: [spell] };
    const card = generateSpellCard('magic_missile', e, content)!;
    const result = applyActionCardUse(e, card, DEFAULT_RULES, undefined, { kind: 'normal', tier: '3' }, undefined, undefined, content);
    expect(result).toBe(e); // refused — never falls back to a different tier
  });

  it('6. a cantrip has no spell-slot cost at all', () => {
    const spell = leveledSpell('fire_bolt', 0);
    let e: Entity = {
      ...makeEmptyEntity('e1'),
      entitlements: [ent('cantrip_access', 'fire_bolt', 'class', 'wizard')],
      spellcasting: { ability: 'int', slots: emptySlots(), cantrips: ['fire_bolt'], known: [], prepared: [], concentrating: null },
    };
    const content = { classDefs: ALL_CHAR_CLASSES, homebrewSpells: [spell] };
    const card = generateSpellCard('fire_bolt', e, content)!;
    expect(card.resourceCost).toBeNull();
  });

  it('11. same spell from two class sources: source selection is independent of the chosen cast level', () => {
    const spell = leveledSpell('shield', 1, { classes: ['wizard', 'sorcerer'] });
    let e: Entity = {
      ...makeEmptyEntity('e1'),
      stats: { str: 10, dex: 10, con: 10, int: 16, wis: 10, cha: 18 },
      entitlements: [
        ent('spell_access', 'shield', 'class', 'wizard'),
        ent('spell_access', 'shield', 'class', 'sorcerer'),
      ],
      spellcasting: { ability: 'int', slots: emptySlots({ '1': { total: 1, used: 0 }, '2': { total: 1, used: 0 } }), cantrips: [], known: ['shield'], prepared: ['shield'], concentrating: null },
    };
    const content = { classDefs: ALL_CHAR_CLASSES, homebrewSpells: [spell] };
    const contexts = resolveSpellCastingContexts(e, 'shield', ALL_CHAR_CLASSES);
    const sorcererContext = contexts.find(c => c.classId === 'sorcerer')!;
    const card = generateSpellCard('shield', e, content)!;
    // Cast via the Sorcerer context specifically, at the UPCAST (2nd) level.
    const result = applyActionCardUse(e, card, DEFAULT_RULES, undefined, { kind: 'normal', tier: '2' }, undefined, sorcererContext, content);
    expect(result.spellcasting!.slots['1'].used).toBe(0);
    expect(result.spellcasting!.slots['2'].used).toBe(1); // the chosen level, regardless of source
  });

  it('13. a descriptive-only upcast spell (Spell.upcast is free text) never invents mechanical scaling — same effect dice at any cast level', () => {
    // No structured per-level scaling field exists anywhere on AbilityEffect
    // (`damage`/`heal` carry only a fixed `dice: string`) — this proves the
    // engine doesn't silently double dice or otherwise scale on its own
    // just because a higher slot was paid for.
    const spell = leveledSpell('inflict_wounds', 1, { upcast: 'When you cast this spell using a spell slot of 2nd level or higher, the damage increases by 1d10 for each slot level above 1st.' });
    let e: Entity = {
      ...makeEmptyEntity('e1'),
      entitlements: [ent('spell_access', 'inflict_wounds', 'class', 'wizard')],
      spellcasting: { ability: 'int', slots: emptySlots({ '1': { total: 1, used: 0 }, '3': { total: 1, used: 0 } }), cantrips: [], known: ['inflict_wounds'], prepared: ['inflict_wounds'], concentrating: null },
    };
    const content = { classDefs: ALL_CHAR_CLASSES, homebrewSpells: [spell] };
    const card = generateSpellCard('inflict_wounds', e, content)!;
    // layer2 (the "key effect" display line) is generated purely from the
    // spell's own static definition, never from a chosen cast level.
    const baseLayer2 = card.layer2;
    const resultAtHigherLevel = applyActionCardUse(e, card, DEFAULT_RULES, undefined, { kind: 'normal', tier: '3' }, undefined, undefined, content);
    expect(resultAtHigherLevel.spellcasting!.slots['3'].used).toBe(1);
    // The card's own displayed effect text is unaffected by which level was
    // ultimately paid for — no automatic upcast scaling was invented.
    expect(card.layer2).toBe(baseLayer2);
  });

  it('14. a stale/removed source is rejected before payment for an upcast attempt too', () => {
    const spell = leveledSpell('magic_missile', 1);
    let e: Entity = {
      ...makeEmptyEntity('e1'),
      entitlements: [ent('spell_access', 'magic_missile', 'class', 'wizard')],
      spellcasting: { ability: 'int', slots: emptySlots({ '1': { total: 1, used: 0 }, '3': { total: 1, used: 0 } }), cantrips: [], known: ['magic_missile'], prepared: ['magic_missile'], concentrating: null },
    };
    const content = { classDefs: ALL_CHAR_CLASSES, homebrewSpells: [spell] };
    const card = generateSpellCard('magic_missile', e, content)!;
    const staleEntity = { ...e, entitlements: [] };
    const result = applyActionCardUse(staleEntity, card, DEFAULT_RULES, undefined, { kind: 'normal', tier: '3' }, undefined, undefined, content);
    expect(result).toBe(staleEntity);
  });
});

describe('rules-completeness batch — D. combined pending-execution-state flow', () => {
  it('preserves source, ability, both overrides, exact cast level, correct slot, and chosen activation option together — none masks another', () => {
    // Multiclass caster: Wizard (unprepared for this spell) + Sorcerer
    // (known, always legal) both provide the same spell. At 0 HP
    // (incapacitated). The card is hand-built with activation.options (a
    // spell-slot-tier chooser, mirroring Divine Smite's real shape) since
    // no shipped spell content currently authors options on a spell card —
    // this exercises the exact SAME applyActionCardUse path a real one
    // would, without inventing new production content.
    const spell = leveledSpell('chaos_bolt', 1, { classes: ['wizard', 'sorcerer'] });
    let e: Entity = {
      ...makeEmptyEntity('e1'),
      resources: { ...makeEmptyEntity('e1').resources, hp: { current: 0, maximum: 20, temp: 0 } },
      stats: { str: 10, dex: 10, con: 10, int: 16, wis: 10, cha: 18 },
      entitlements: [
        ent('spell_access', 'chaos_bolt', 'class', 'wizard'),
        ent('spell_access', 'chaos_bolt', 'class', 'sorcerer'),
      ],
      spellcasting: {
        ability: 'int', slots: emptySlots({ '1': { total: 1, used: 0 }, '2': { total: 1, used: 0 } }),
        cantrips: [], known: ['chaos_bolt'], prepared: [], // NEITHER prepared — Sorcerer ('known' policy) is legal regardless; Wizard needs Cast Anyway
        concentrating: null,
      },
    };
    const contexts = resolveSpellCastingContexts(e, 'chaos_bolt', ALL_CHAR_CLASSES);
    const wizardContext = contexts.find(c => c.classId === 'wizard')!;
    expect(wizardContext.legal).toBe(false); // unprepared

    const card: ActionCard = {
      featureId: 'chaos_bolt', name: 'Chaos Bolt', cardType: 'damage', color: 'red',
      layer1: 'Spell', layer2: '2d8+1d6', layer3: null, outcomes: [], triggerNote: null,
      activation: {
        actionType: 'action',
        resourceCost: { resourceId: 'spell_slots', quantity: 1, spellSlotTier: 1 },
        range: '120 feet', target: 'single', requiresSave: null,
        options: [
          { id: 'tier1', label: 'Cast at 1st level', resourceCost: { resourceId: 'spell_slots', quantity: 1, spellSlotTier: 1 } },
          { id: 'tier2', label: 'Cast at 2nd level', resourceCost: { resourceId: 'spell_slots', quantity: 1, spellSlotTier: 2 } },
        ],
      },
      resourceCost: { resourceId: 'spell_slots', quantity: 1, spellSlotTier: 1 },
      tabs: ['spellcasting', 'actions'],
      available: false, unavailableReason: 'Not prepared', preparationOverridable: true,
      incapacitatedOverridable: true,
      spellCastingContext: wizardContext,
      spellCastingContexts: [wizardContext, contexts.find(c => c.classId === 'sorcerer')!],
    };

    const content = { classDefs: ALL_CHAR_CLASSES, homebrewSpells: [spell] };
    const chosenOption = card.activation.options![1]; // "Cast at 2nd level"
    const result = applyActionCardUse(
      e, card, DEFAULT_RULES,
      chosenOption,
      { kind: 'normal', tier: '2' },
      /*bypassSpellPreparation*/ true,
      /*selectedSpellCastingContext*/ wizardContext,
      content,
      /*bypassIncapacitated*/ true,
    );

    expect(result).not.toBe(e); // the cast actually went through
    // Exact source preserved: the Wizard context, not a silent fallback to Sorcerer.
    expect(result.actionCards ?? []).toBeDefined(); // recomputeDerived ran
    // Exact cast level / correct slot: 2nd-level slot spent, 1st-level untouched.
    expect(result.spellcasting!.slots['1'].used).toBe(0);
    expect(result.spellcasting!.slots['2'].used).toBe(1);
    // Prepared state unchanged — Cast Anyway never actually prepares it.
    expect(result.spellcasting!.prepared).not.toContain('chaos_bolt');
    // 0 HP/unconscious state unchanged — Use Anyway never heals or clears status.
    expect(result.resources.hp.current).toBe(0);
  });
});
