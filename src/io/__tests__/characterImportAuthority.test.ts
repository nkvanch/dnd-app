import { makeEmptyEntity } from '../../store/characterStore';
import { makeCustomRuleProfile } from '../../engine/customRuleProfiles';
import { asRulesetId } from '../../engine/types';
import { resolvePortableCharacterImport, serializePortableCharacter } from '../characterPortable';

describe('authoritative portable character conflict resolution', () => {
  const alice = { ...makeEmptyEntity('char-alice'), identity: { ...makeEmptyEntity('char-alice').identity, name: 'Alice' } };
  const text = serializePortableCharacter(alice);

  it('imports into an empty persisted library without making a copy', async () => {
    const exists = jest.fn().mockResolvedValue(false);
    const parsed = await resolvePortableCharacterImport(text, [], exists);
    expect(exists).toHaveBeenCalledWith('char-alice');
    expect(parsed).toMatchObject({ importedAsCopy: false, entity: { id: 'char-alice' } });
  });

  it('copies only a real persisted same-id collision and supports reimport', async () => {
    const first = await resolvePortableCharacterImport(text, [], jest.fn().mockResolvedValue(false));
    const second = await resolvePortableCharacterImport(text, [], jest.fn().mockImplementation(id => Promise.resolve(id === first.entity.id)));
    expect(second.importedAsCopy).toBe(true);
    expect(second.entity.id).not.toBe(first.entity.id);
    expect(second.entity.identity.name).toBe('Alice (Imported Copy)');
  });

  it('allows the original id after the persisted character is deleted', async () => {
    let persisted = true;
    persisted = false;
    const parsed = await resolvePortableCharacterImport(text, [], jest.fn().mockResolvedValue(persisted));
    expect(parsed.importedAsCopy).toBe(false);
    expect(parsed.entity.id).toBe('char-alice');
  });

  it('keeps profile collision handling independent from character collision', async () => {
    const embedded = makeCustomRuleProfile({ id: 'profile-a', name: 'Embedded', baseRulesetId: asRulesetId('dnd5e-2014'), rules: { hpMode: 'max' } });
    const local = { ...embedded, rules: { customRules: { lockPlayerFreeEdit: true } } };
    const withProfile = { ...alice, customRuleProfileId: embedded.id, rulesetId: embedded.baseRulesetId };
    const parsed = await resolvePortableCharacterImport(serializePortableCharacter(withProfile, embedded), [local], jest.fn().mockResolvedValue(false));
    expect(parsed.importedAsCopy).toBe(false);
    expect(parsed.profileToImport).toEqual(embedded);
  });

  it('rejects malformed input before querying or persisting anything', async () => {
    const exists = jest.fn();
    await expect(resolvePortableCharacterImport('{bad', [], exists)).rejects.toThrow('not valid JSON');
    expect(exists).not.toHaveBeenCalled();
  });
});

