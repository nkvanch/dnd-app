// src/engine/__tests__/featPrereq.test.ts
// First test coverage for this file. Locks in a real fix: the race-prereq
// token match used to be bidirectional substring containment
// (`r.includes(tok) || tok.includes(r)`), so a plain Elf satisfied a
// "Half-Elf, Half-Orc, or Human" prerequisite because "half-elf".includes
// ("elf") — a deterministic string fact, not a runtime edge case
// (architecture review E4).
import { evaluatePrerequisite } from '../featPrereq';
import { makeEmptyEntity } from '../../store/characterStore';
import { Entity } from '../types';

function withRace(raceId: string, subRaceId: string | null = null): Entity {
  const e = makeEmptyEntity('e1');
  return { ...e, identity: { ...e.identity, raceId, subRaceId } };
}

describe('evaluatePrerequisite — race gate (audit finding E4)', () => {
  it('a plain Elf does NOT satisfy a Half-Elf/Half-Orc/Human prerequisite', () => {
    const result = evaluatePrerequisite(withRace('elf'), 'Half-Elf, Half-Orc, or Human');
    expect(result.met).toBe(false);
  });

  it('a Half-Elf DOES satisfy the same prerequisite', () => {
    const result = evaluatePrerequisite(withRace('half_elf'), 'Half-Elf, Half-Orc, or Human');
    expect(result.met).toBe(true);
  });

  it('a plain Elf still satisfies a plain "Elf" prerequisite (exact match, not a regression)', () => {
    const result = evaluatePrerequisite(withRace('elf'), 'Elf');
    expect(result.met).toBe(true);
  });

  it('a Wood Elf subrace satisfies a "Wood Elf" prerequisite via the subrace id', () => {
    const result = evaluatePrerequisite(withRace('elf', 'wood_elf'), 'Wood Elf');
    expect(result.met).toBe(true);
  });

  it('a Dwarf does not satisfy a "Half-Orc" prerequisite (no accidental substring match either direction)', () => {
    const result = evaluatePrerequisite(withRace('dwarf'), 'Half-Orc');
    expect(result.met).toBe(false);
  });
});
