// Review shows names, not stored ids, and includes the chosen subclass (stress-test finding: "human", "bard", no subclass).
import { resolveIdentityLabels, prettyId } from '../identityLabels';
import { globalContentDB } from '../classes/library';
import { makeEmptyEntity } from '../../store/characterStore';
import { buildUnderstudyPack } from '../../../demo/sample-packs/samplePacks';
import type { Entity, HomebrewSubclass } from '../../engine/types';

const understudy = buildUnderstudyPack().homebrew!.subclasses as HomebrewSubclass[];
const db = { races: globalContentDB.races, classes: globalContentDB.classes, backgrounds: globalContentDB.backgrounds };
const withIdentity = (patch: Partial<Entity['identity']>): Entity => {
  const e = makeEmptyEntity('t');
  return { ...e, identity: { ...e.identity, ...patch } };
};

describe('resolveIdentityLabels', () => {
  it('shows display names, not ids: Human / Bard / Acolyte', () => {
    const l = resolveIdentityLabels(withIdentity({ raceId: 'human', classId: 'bard', backgroundId: 'acolyte' }), db);
    expect(l).toMatchObject({ race: 'Human', class: 'Bard', background: 'Acolyte', subrace: null, subclass: null });
  });

  it('includes a chosen OFFICIAL subclass', () => {
    const l = resolveIdentityLabels(withIdentity({ raceId: 'human', classId: 'bard', subclassId: 'lore', backgroundId: 'acolyte' }), db);
    expect(l.subclass).toBe('College of Lore');
  });

  it('includes a chosen HOMEBREW subclass (The Understudy (Demo))', () => {
    const l = resolveIdentityLabels(withIdentity({ raceId: 'human', classId: 'bard', subclassId: understudy[0].id, backgroundId: 'acolyte' }), db, understudy);
    expect(l.subclass).toBe('The Understudy (Demo)');
  });

  it('shows the subrace name', () => {
    const l = resolveIdentityLabels(withIdentity({ raceId: 'elf', subRaceId: 'high_elf', classId: 'wizard' }), db);
    expect(l.race).toBe('Elf');
    expect(l.subrace).toBe('High Elf');
  });

  it('multiclass reads "Fighter 3 / Wizard 2" and lists each subclass', () => {
    const e = withIdentity({
      raceId: 'human', classId: 'fighter', level: 5,
      classes: [
        { classId: 'fighter' as never, subclassId: null, level: 3 },
        { classId: 'wizard' as never, subclassId: 'evocation' as never, level: 2 },
      ],
    });
    const l = resolveIdentityLabels(e, db);
    expect(l.class).toBe('Fighter 3 / Wizard 2');
  });

  it('never blank: an unknown id falls back to a readable form (a removed homebrew race, say)', () => {
    const l = resolveIdentityLabels(withIdentity({ raceId: 'zz_gone_race', classId: 'zz_gone_class', subclassId: 'zz_gone_sub', backgroundId: 'zz_gone_bg' }), db);
    expect(l).toMatchObject({ race: 'Zz Gone Race', class: 'Zz Gone Class', subclass: 'Zz Gone Sub', background: 'Zz Gone Bg' });
  });

  it('does not change the stored ids', () => {
    const e = withIdentity({ raceId: 'human', classId: 'bard' });
    resolveIdentityLabels(e, db);
    expect(e.identity.raceId).toBe('human');
    expect(e.identity.classId).toBe('bard');
  });

  it('prettyId', () => {
    expect(prettyId('hill_dwarf')).toBe('Hill Dwarf');
  });
});
