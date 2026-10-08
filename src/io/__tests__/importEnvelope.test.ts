import { identifyGrimoireImport, WRONG_CHARACTER_IMPORTER_MESSAGE, WRONG_HOMEBREW_IMPORTER_MESSAGE } from '../importEnvelope';
import { parsePortableCharacter } from '../characterPortable';

describe('import envelope routing', () => {
  const character = { format: 'grimoire-character', version: 1, entity: {} };
  const homebrew = { formatVersion: 1, packType: 'content-pack', homebrew: {} };
  it('recognizes character and homebrew package envelopes independently', () => {
    expect(identifyGrimoireImport(character)).toBe('character');
    expect(identifyGrimoireImport(homebrew)).toBe('homebrew-package');
    expect(identifyGrimoireImport({ hello: 'world' })).toBe('unknown');
  });
  it('gives route guidance when a package reaches Character Import', () => {
    expect(() => parsePortableCharacter(JSON.stringify(homebrew))).toThrow(WRONG_CHARACTER_IMPORTER_MESSAGE);
  });
  it('provides explicit Character-to-Homebrew guidance text', () => {
    expect(WRONG_HOMEBREW_IMPORTER_MESSAGE).toContain('Characters → Import Character');
  });
});
