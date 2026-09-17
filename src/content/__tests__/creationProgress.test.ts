// src/content/__tests__/creationProgress.test.ts
import { makeEmptyEntity } from '../../store/characterStore';
import {
  readCreationPicks, writeCreationPicks, spellProgressFor, SPELLS_AT_L1, groupPendingSpellChoices,
} from '../creationProgress';
import type { ChoiceDefinition, ChoiceState } from '../../engine/types';

describe('readCreationPicks / writeCreationPicks round trip', () => {
  it('defaults to empty picks when notes has no creationSpellPicks', () => {
    const e = makeEmptyEntity('e1');
    expect(readCreationPicks(e)).toEqual({ cantrips: [], spells: [] });
  });

  it('round-trips exactly what was written, without touching anything else in notes', () => {
    let e = makeEmptyEntity('e1');
    e = { ...e, notes: JSON.stringify({ someOtherField: 'kept' }) };
    e = writeCreationPicks(e, { cantrips: ['fire_bolt'], spells: ['burning_hands'] });
    expect(readCreationPicks(e)).toEqual({ cantrips: ['fire_bolt'], spells: ['burning_hands'] });
    expect(JSON.parse(e.notes).someOtherField).toBe('kept');
  });
});

// ADDITIONAL-SPELL-2 (regression): "+ Add Additional Spell" writes directly
// into entity.spellcasting.cantrips/.known and deliberately never calls
// writeCreationPicks (see spells.tsx's own handleAddAdditionalSpell and its
// two useFocusEffect consumers) — mirroring the same Required/Manual
// separation already proven for equipment in equipmentChoice.test.ts's
// "item 11" regression test. spellProgressFor is the one authoritative
// entitlement-counter function (reused by both spells.tsx's own section
// headers and the creation hub's progress subtitle), and it derives `done`
// exclusively from readCreationPicks(entity) — it never reads
// entity.spellcasting at all, so a manually-added spell sitting in
// spellcasting.cantrips/.known cannot inflate it, structurally, not just by
// convention.
describe('spellProgressFor — manual/additional spell additions never inflate required entitlement (regression)', () => {
  function setup(classId: string): ReturnType<typeof makeEmptyEntity> {
    let e = makeEmptyEntity('e1');
    e = { ...e, identity: { ...e.identity, classId } };
    return e;
  }

  it('reports 0/targets before any picks, for a class with both cantrip and spell targets (sorcerer: 4/2)', () => {
    const e = setup('sorcerer');
    expect(spellProgressFor(e)).toEqual({
      cantrips: { done: 0, total: SPELLS_AT_L1.sorcerer.cantrips },
      spells:   { done: 0, total: SPELLS_AT_L1.sorcerer.spells },
    });
  });

  it('reflects only what was recorded via writeCreationPicks, matching the required-picker path', () => {
    let e = setup('sorcerer');
    e = writeCreationPicks(e, { cantrips: ['acid_splash', 'blade_ward', 'chill_touch'], spells: ['burning_hands'] });
    expect(spellProgressFor(e)).toEqual({
      cantrips: { done: 3, total: 4 },
      spells:   { done: 1, total: 2 },
    });
  });

  it('a manually-added spell sitting in spellcasting.cantrips/.known — never written via writeCreationPicks — does not change the counters', () => {
    let e = setup('sorcerer');
    e = writeCreationPicks(e, { cantrips: ['acid_splash', 'blade_ward', 'chill_touch'], spells: ['burning_hands'] });
    const before = spellProgressFor(e);

    // Mirrors handleAddAdditionalSpell's own mutation shape exactly — a
    // direct write into spellcasting.cantrips/.known, never
    // writeCreationPicks. "guidance" (Cleric/Druid, not Sorcerer) stands in
    // for a genuinely out-of-class manual pick.
    const withManual = {
      ...e,
      spellcasting: {
        ability: 'cha' as const,
        slots: { '1':{total:0,used:0},'2':{total:0,used:0},'3':{total:0,used:0},'4':{total:0,used:0},'5':{total:0,used:0},'6':{total:0,used:0},'7':{total:0,used:0},'8':{total:0,used:0},'9':{total:0,used:0} },
        cantrips: ['guidance'], known: ['identify'], prepared: ['identify'], concentrating: null,
      },
    };

    const after = spellProgressFor(withManual);
    expect(after).toEqual(before);
    expect(after).toEqual({ cantrips: { done: 3, total: 4 }, spells: { done: 1, total: 2 } });
  });

  it('returns null for both when the class has no cantrip/spell targets at this level (e.g. paladin)', () => {
    const e = setup('paladin');
    expect(spellProgressFor(e)).toEqual({ cantrips: null, spells: null });
  });
});

// SPELL-ACCUMULATION-1/2 (regression): a known-spell caster queues ONE small
// kind:'spell' ChoiceDefinition PER LEVEL (wizard_spellbook_1, _2, _3, ...).
// spellProgressFor must aggregate ALL of them into one cumulative done/total
// pair — this is the exact model that prevents "Level 1: Choose spells /
// Level 2: Choose another spell / Level 3: ..." from appearing as separate
// sections, in both the creation flow (spells.tsx) and the live-play sheet
// (TabFeatures.tsx, via groupPendingSpellChoices below).
describe('spellProgressFor — cumulative entitlement across multiple per-level spell choices (ChoiceDefinition-based path)', () => {
  function spellDef(id: string, count: number): ChoiceDefinition {
    return { id, prompt: `Choose ${count}.`, kind: 'spell', count, pool: 'all', grants: [], required: true, resolved: false };
  }
  function choiceState(id: string, count: number, grantedAt: number, resolved: boolean, selections: string[] = []): ChoiceState {
    return { id, definition: spellDef(id, count), grantedAt, resolved, selections };
  }

  it('sums count across every unresolved per-level cantrip choice into one total, not one row each', () => {
    let e = makeEmptyEntity('e1');
    e = {
      ...e,
      choices: [
        choiceState('wizard_cantrips_1', 3, 1, false),
        choiceState('wizard_cantrips_4', 1, 4, false),
      ],
    };
    expect(spellProgressFor(e).cantrips).toEqual({ done: 0, total: 4 });
  });

  it('sums both resolved (done) and unresolved (still owed) known-spell choices across several levels', () => {
    let e = makeEmptyEntity('e1');
    e = {
      ...e,
      choices: [
        choiceState('wizard_spellbook_1', 6, 1, true, ['a', 'b', 'c', 'd', 'e', 'f']),
        choiceState('wizard_spellbook_2', 2, 2, true, ['g', 'h']),
        choiceState('wizard_spellbook_3', 2, 3, false), // still pending
      ],
    };
    // 8 already selected across two resolved per-level choices, 10 total
    // entitlement across all three levels combined — one cumulative pair,
    // never three separate "Level N: choose spells" numbers.
    expect(spellProgressFor(e).spells).toEqual({ done: 8, total: 10 });
  });

  it('keeps the cantrip and known-spell groups independent', () => {
    let e = makeEmptyEntity('e1');
    e = {
      ...e,
      choices: [
        choiceState('warlock_cantrips_1', 2, 1, true, ['x', 'y']),
        choiceState('warlock_spells_1', 2, 1, false),
        choiceState('warlock_spells_2', 1, 2, false),
      ],
    };
    const progress = spellProgressFor(e);
    expect(progress.cantrips).toEqual({ done: 2, total: 2 });
    expect(progress.spells).toEqual({ done: 0, total: 3 });
  });
});

describe('groupPendingSpellChoices — TabFeatures.tsx PENDING CHOICES row collapsing (SPELL-ACCUMULATION-2)', () => {
  function spellDef(id: string, count: number): ChoiceDefinition {
    return { id, prompt: `Choose ${count}.`, kind: 'spell', count, pool: 'all', grants: [], required: true, resolved: false };
  }
  function asiDef(): ChoiceDefinition {
    return { id: 'bonus_asi', prompt: 'ASI', kind: 'asi', count: 1, pool: 'all', grants: [], required: true, resolved: false };
  }
  function choiceState(def: ChoiceDefinition, grantedAt: number): ChoiceState {
    return { id: def.id, definition: def, grantedAt, resolved: false, selections: [] };
  }

  it('splits multiple per-level cantrip/known-spell choices into exactly two groups', () => {
    const pending = [
      choiceState(spellDef('wizard_cantrips_1', 3), 1),
      choiceState(spellDef('wizard_spellbook_1', 6), 1),
      choiceState(spellDef('wizard_spellbook_2', 2), 2),
      choiceState(spellDef('wizard_spellbook_3', 2), 3),
    ];
    const { cantripPending, knownSpellPending } = groupPendingSpellChoices(pending);
    expect(cantripPending.map(c => c.id)).toEqual(['wizard_cantrips_1']);
    expect(knownSpellPending.map(c => c.id)).toEqual(['wizard_spellbook_1', 'wizard_spellbook_2', 'wizard_spellbook_3']);
  });

  it('ignores non-spell pending choices entirely (they render through their own row, untouched)', () => {
    const pending = [choiceState(asiDef(), 4), choiceState(spellDef('sorcerer_cantrips_1', 4), 1)];
    const { cantripPending, knownSpellPending } = groupPendingSpellChoices(pending);
    expect(cantripPending.map(c => c.id)).toEqual(['sorcerer_cantrips_1']);
    expect(knownSpellPending).toEqual([]);
  });

  it('returns empty groups when nothing spell-related is pending', () => {
    const pending = [choiceState(asiDef(), 4)];
    expect(groupPendingSpellChoices(pending)).toEqual({ cantripPending: [], knownSpellPending: [] });
  });
});
