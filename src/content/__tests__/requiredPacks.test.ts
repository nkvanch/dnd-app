import { requiredPacksFor, mergeRequiredPacks, packShortfalls, requiredPacksForRuleset, withRequiredPacks, describeShortfall, contentRefsOf } from '../requiredPacks';
import { buildSrd51Pack, buildSrd521Pack, serializePack } from '../packs/srdPacks';
import { buildNonSrd51Pack } from '../packs/nonSrdPacks';
import { PackStore, installOfficialPack, installedOfficialPacks, resetOfficialPackService } from '../officialPackService';
import { clearOfficialPacks } from '../officialPacks';
import { makeEmptyEntity } from '../../store/characterStore';
import { Entity, RulesetId } from '../../engine/types';

const store: PackStore = { save: async () => {}, load: async () => [], remove: async () => {} };
const json = (p: unknown) => JSON.parse(serializePack(p as never));
beforeEach(() => { resetOfficialPackService(); clearOfficialPacks(); });
afterAll(() => { resetOfficialPackService(); clearOfficialPacks(); });
async function installAll() { for (const p of [buildSrd51Pack(), buildNonSrd51Pack(), buildSrd521Pack()]) expect(await installOfficialPack(json(p), store)).toEqual({ ok: true }); }

function character(over: Partial<Entity['identity']> & { ruleset?: string; spells?: string[]; items?: string[] }): Entity {
  const e = makeEmptyEntity('c');
  return {
    ...e, kind: 'character', rulesetId: over.ruleset as RulesetId | undefined,
    identity: { ...e.identity, classId: 'fighter', level: 3, raceId: 'human', backgroundId: 'acolyte', ...over } as Entity['identity'],
    spellcasting: over.spells ? { ...(e.spellcasting as object), ability: 'int', cantrips: [], known: over.spells, prepared: [], slots: {}, concentrating: null } as never : e.spellcasting,
    inventory: { ...e.inventory, carried: (over.items ?? []).map((itemId, n) => ({ id: `i${n}`, itemId, quantity: 1, attuned: false, features: [] })) },
  };
}

describe('required packs', () => {
  it('a 5e character needs the SRD 5.1 pack; its non-SRD content adds the non-SRD pack; a 5.5e one the SRD 5.2.1 pack', async () => {
    await installAll();
    const packs = installedOfficialPacks();
    expect(requiredPacksFor(character({ classId: 'fighter', raceId: 'human', backgroundId: 'acolyte' }), packs)).toEqual([{ id: 'grimoire.srd.5.1', minVersion: '1.0.0' }]);
    expect(requiredPacksFor(character({ classId: 'artificer', raceId: 'tabaxi', backgroundId: 'zzz' }), packs).map(r => r.id)).toEqual(['grimoire.nonsrd.5.1']);
    const c2024 = character({ ruleset: 'dnd5e-2024', classId: 'fighter_2024', raceId: 'elf_2024', backgroundId: 'soldier_2024', spells: ['magic_missile'], items: ['longsword', 'bag_of_holding_2024'] });
    expect(requiredPacksFor(c2024, packs).map(r => r.id)).toEqual(['grimoire.srd.5.1', 'grimoire.srd.5.2.1']);
  });

  it('the same id in two packs is attributed to the pack of the character\'s own ruleset', async () => {
    await installAll();
    const packs = installedOfficialPacks();
    const refs = contentRefsOf(character({ ruleset: 'dnd5e-2024', spells: ['magic_missile'] }));
    expect(refs.spells).toContain('magic_missile');
    const only2024 = requiredPacksFor(character({ ruleset: 'dnd5e-2024', classId: 'zzz', raceId: 'zzz', backgroundId: 'zzz', spells: ['magic_missile'] }), packs);
    expect(only2024.map(r => r.id)).toEqual(['grimoire.srd.5.2.1']);
    const only2014 = requiredPacksFor(character({ classId: 'zzz', raceId: 'zzz', backgroundId: 'zzz', spells: ['magic_missile'] }), packs);
    expect(only2014.map(r => r.id)).toEqual(['grimoire.srd.5.1']);
  });

  it('what a character records only grows: removing a pack never forgets it, and a newer minimum version wins', () => {
    expect(mergeRequiredPacks([{ id: 'a', minVersion: '1.0.0' }], [{ id: 'b', minVersion: '1.0.0' }])).toEqual([{ id: 'a', minVersion: '1.0.0' }, { id: 'b', minVersion: '1.0.0' }]);
    expect(mergeRequiredPacks([{ id: 'a', minVersion: '1.0.0' }], [{ id: 'a', minVersion: '1.2.0' }])).toEqual([{ id: 'a', minVersion: '1.2.0' }]);
    expect(mergeRequiredPacks([{ id: 'a', minVersion: '1.2.0' }], [{ id: 'a', minVersion: '1.0.0' }])).toEqual([{ id: 'a', minVersion: '1.2.0' }]);
    const e = { ...character({}), requiredPacks: [{ id: 'grimoire.srd.5.2.1', minVersion: '1.0.0' }] };
    expect(withRequiredPacks(e, [])).toBe(e);   // no packs installed: nothing subtracted, nothing added
  });

  it('withRequiredPacks stamps once and then leaves the entity alone', async () => {
    await installAll();
    const packs = installedOfficialPacks();
    const stamped = withRequiredPacks(character({}), packs);
    expect(stamped.requiredPacks).toEqual([{ id: 'grimoire.srd.5.1', minVersion: '1.0.0' }]);
    expect(withRequiredPacks(stamped, packs)).toBe(stamped);
  });

  it('shortfalls: a pack that is missing, and one that is too old', async () => {
    await installAll();
    const packs = installedOfficialPacks();
    expect(packShortfalls([{ id: 'grimoire.srd.5.1', minVersion: '1.0.0' }], packs)).toEqual([]);
    expect(packShortfalls([{ id: 'grimoire.nope', minVersion: '1.0.0' }], packs)).toEqual([{ id: 'grimoire.nope', minVersion: '1.0.0', problem: 'missing' }]);
    const old = packShortfalls([{ id: 'grimoire.srd.5.1', minVersion: '2.0.0' }], packs);
    expect(old).toEqual([{ id: 'grimoire.srd.5.1', minVersion: '2.0.0', installedVersion: '1.0.0', problem: 'too_old' }]);
    expect(describeShortfall(old[0])).toMatch(/older than the 2\.0\.0/);
    expect(describeShortfall({ id: 'x', minVersion: '1.0.0', problem: 'missing' })).toBe('x 1.0.0+ is not installed');
    expect(packShortfalls(undefined, packs)).toEqual([]);
  });

  it('a campaign of a ruleset needs that edition\'s SRD pack and what it depends on, not the private packs', async () => {
    await installAll();
    const packs = installedOfficialPacks();
    expect(requiredPacksForRuleset('dnd5e-2024', packs).map(r => r.id)).toEqual(['grimoire.srd.5.1', 'grimoire.srd.5.2.1']);
    expect(requiredPacksForRuleset('dnd5e-2014', packs).map(r => r.id)).toEqual(['grimoire.srd.5.1']);
    expect(requiredPacksForRuleset(undefined, packs)).toEqual([]);
    expect(requiredPacksForRuleset('dnd5e-2024', [])).toEqual([]);
  });
});
