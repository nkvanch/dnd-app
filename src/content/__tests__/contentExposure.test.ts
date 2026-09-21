import { isContentExposed, selectExposedContent } from '../contentExposure';
import { CONTENT_TYPE_VISUALS } from '../compendiumBrowse';

const restricted = { id: 'restricted', name: 'Mace of Disruption', srd: false, type: 'item' as const };
const srd = { id: 'srd', name: 'Club', srd: true, type: 'item' as const };

describe('central content exposure', () => {
  const locked = { srdOnly: true };
  it('excludes non-SRD items and spells', () => {
    expect(isContentExposed(restricted, locked)).toBe(false);
    expect(isContentExposed({ srd: false, type: 'spell' }, locked)).toBe(false);
  });
  it('excludes Artificer where represented as non-SRD', () => {
    expect(isContentExposed({ srd: false, type: 'class' }, locked)).toBe(false);
  });
  it('filters before exact search and before facets', () => {
    expect(selectExposedContent([restricted, srd], locked, e => e.name === 'Mace of Disruption')).toEqual([]);
    expect(selectExposedContent([restricted, srd], locked, () => true, e => e.id === 'restricted')).toEqual([]);
  });
  it('exposes broader bundled content when unrestricted', () => {
    expect(isContentExposed(restricted, { srdOnly: false })).toBe(true);
  });
  it('preserves existing homebrew visibility in SRD-only mode', () => {
    expect(isContentExposed({ srd: false, isHomebrew: true, type: 'item' }, locked)).toBe(true);
  });
  it('allows canonical conditions whose model has no SRD flag', () => {
    expect(isContentExposed({ type: 'condition' }, locked)).toBe(true);
  });
});

describe('Compendium content type visuals', () => {
  it('assigns a static accent and icon to every browsable type', () => {
    expect(Object.keys(CONTENT_TYPE_VISUALS)).toHaveLength(10);
    for (const visual of Object.values(CONTENT_TYPE_VISUALS)) {
      expect(visual.accent).toMatch(/^#[0-9a-f]{6}$/i);
      expect(visual.icon).toBeTruthy();
    }
    expect(CONTENT_TYPE_VISUALS.spell.accent).not.toBe(CONTENT_TYPE_VISUALS.monster.accent);
  });
});
