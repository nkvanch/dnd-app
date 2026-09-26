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

// ============================================================================
// Item-identity closure (pass 2, finding A3/H1): a legacy portable export
// predating ItemInstance.id must not enter runtime identity-less. Verifies
// the REAL parsePortableCharacter/resolvePortableCharacterImport path
// hydrates missing instance ids BEFORE returning — not merely on the next
// app boot's loadCharacters().
// ============================================================================
describe('item-identity closure — portable import hydrates legacy ItemInstance ids', () => {
  function legacyCharacterWithDuplicateSwords() {
    const base = makeEmptyEntity('char-legacy-swords');
    return {
      ...base,
      inventory: {
        ...base.inventory,
        // Two duplicate stateful items, NEITHER with an id — exactly the
        // shape a character exported before ItemInstance.id existed.
        equipped: [
          { itemId: 'longsword_1', quantity: 1, attuned: true,  features: [] },
        ],
        carried: [
          { itemId: 'longsword_1', quantity: 1, attuned: false, features: [] },
        ],
      },
    };
  }

  it('two identity-less duplicate stateful items both get distinct, stable ids immediately on import', async () => {
    const text = serializePortableCharacter(legacyCharacterWithDuplicateSwords() as any);
    const parsed = await resolvePortableCharacterImport(text, [], jest.fn().mockResolvedValue(false));
    const equippedSword = parsed.entity.inventory.equipped[0];
    const carriedSword  = parsed.entity.inventory.carried[0];
    expect(equippedSword.id).toBeTruthy();
    expect(carriedSword.id).toBeTruthy();
    expect(equippedSword.id).not.toBe(carriedSword.id);
    // Original mutable state preserved exactly — hydration only ADDS the id.
    expect(equippedSword.attuned).toBe(true);
    expect(carriedSword.attuned).toBe(false);
  });

  it('a supplied MODERN id is preserved verbatim, never regenerated', async () => {
    const base = makeEmptyEntity('char-modern-item');
    const entity = {
      ...base,
      inventory: { ...base.inventory, carried: [{ id: 'my-stable-id', itemId: 'dagger', quantity: 1, attuned: false, features: [] }] },
    };
    const text = serializePortableCharacter(entity as any);
    const parsed = await resolvePortableCharacterImport(text, [], jest.fn().mockResolvedValue(false));
    expect(parsed.entity.inventory.carried[0].id).toBe('my-stable-id');
  });
});

