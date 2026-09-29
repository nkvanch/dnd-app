import { spellIdsOnEntity } from '../spellRepo.types';

describe('spellIdsOnEntity', () => {
  it('includes spell/cantrip ACCESS entitlements that have not been re-derived into the lists yet', () => {
    // What creation\'s "+ Add Additional Spell" leaves on a draft: an added
    // cantrip exists only as an entitlement until the next recompute. If it is
    // not returned here it is never loaded and ends up with no action card.
    const ids = spellIdsOnEntity({
      spellcasting: { cantrips: ['fire_bolt'], known: [], prepared: ['shield'] },
      entitlements: [
        { kind: 'cantrip_access', key: 'light' },
        { kind: 'spell_access', key: 'cure_wounds' },
        { kind: 'skill_proficiency', key: 'arcana' },
      ],
    });
    expect(ids.sort()).toEqual(['cure_wounds', 'fire_bolt', 'light', 'shield'].sort());
  });

  it('does not return duplicates and ignores non-spell entitlements', () => {
    const ids = spellIdsOnEntity({
      spellcasting: { cantrips: [], known: ['shield'], prepared: ['shield'] },
      entitlements: [{ kind: 'spell_access', key: 'shield' }, { kind: 'language', key: 'elvish' }],
    });
    expect(ids).toEqual(['shield']);
  });
});
