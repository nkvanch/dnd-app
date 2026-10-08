// Character creation from installed pack content only (docs/SRD_PACKS.md step 4). The packs are built in memory and
// round-tripped through JSON, so what the provider reads is exactly what a `.grimoire-pack` file holds.
import { buildSrd51Pack, buildSrd521Pack } from '../../packs/srdPacks';
import { packContentProvider, orderPacks, PackProviderError, InstalledPack } from '../contentProvider';
import { staticContentProvider } from '../staticProvider';
import { createCharacter, pickSpells, spellCandidates, MissingContentError } from '../createCharacter';
import { DEFAULT_RULES } from '../../../store/characterStore';
import type { RulesetId } from '../../../engine/types';

const R2024 = 'dnd5e-2024' as RulesetId;
const file = <T,>(x: T): T => JSON.parse(JSON.stringify(x));
const packs = (): InstalledPack[] => [file(buildSrd521Pack()), file(buildSrd51Pack())] as InstalledPack[];
const STATS = { str: 15, dex: 14, con: 14, int: 10, wis: 12, cha: 8 };
const spec = (o: Record<string, unknown> = {}) => ({ id: 'c1', name: 'Test', classId: 'fighter_2024', raceId: 'dwarf_2024', backgroundId: 'soldier_2024', stats: STATS, ...o });

describe('pack content provider', () => {
  it('serves the 2024 classes, species, backgrounds, feats and spells of the installed packs, not the 2014 ones', () => {
    const p = packContentProvider(packs(), R2024);
    expect(p.source).toBe('pack:grimoire.srd.5.1@1.0.0+pack:grimoire.srd.5.2.1@1.0.0');
    expect(p.classes()).toHaveLength(12);
    expect(p.classes().every(c => c.rulesetId === R2024)).toBe(true);
    expect(p.races()).toHaveLength(9);
    expect(p.backgrounds()).toHaveLength(4);
    expect(p.feats().length).toBeGreaterThanOrEqual(6);
    expect(p.spells().length).toBeGreaterThanOrEqual(339);
    expect(p.getClass('fighter_2024')?.name).toBe('Fighter');
    expect(p.getClass('fighter')).toBeUndefined();            // the 2014 Fighter belongs to the 5.1 pack's ruleset
    expect(p.subclassesOf('wizard_2024').map(s => s.name)).toEqual(['Evoker']);
  });

  it('refuses a pack whose dependency is missing or too old', () => {
    const only521 = [packs()[0]];
    expect(() => packContentProvider(only521, R2024)).toThrow(PackProviderError);
    expect(() => packContentProvider(only521, R2024)).toThrow(/needs grimoire.srd.5.1/);
    const old = packs();
    old[1].manifest.version = '0.9.0';
    expect(() => orderPacks(old)).toThrow(/1.0.0 or newer/);
  });

  it('refuses an invalid pack and a pack installed twice', () => {
    const bad = packs();
    (bad[0] as unknown as { formatVersion: unknown }).formatVersion = 'x';
    expect(() => packContentProvider(bad, R2024)).toThrow(PackProviderError);
    expect(() => orderPacks([packs()[1], packs()[1]])).toThrow(/installed twice/);
  });

  it('a later pack replaces an earlier record with the same id', () => {
    const [srd, base] = packs();
    const over = file(srd);
    over.manifest = { ...over.manifest, id: 'user.override', dependencies: [{ id: 'grimoire.srd.5.2.1' }] };
    over.homebrew!.classes = [{ ...over.homebrew!.classes![0], name: 'Overridden' }];
    over.homebrew = { classes: over.homebrew!.classes } as never;
    const p = packContentProvider([over, srd, base], R2024);
    expect(p.getClass(srd.homebrew!.classes![0].id)?.name).toBe('Overridden');
    expect(p.classes()).toHaveLength(12);
  });
});

describe('creating a 2024 character from pack content only', () => {
  const provider = () => packContentProvider(packs(), R2024);

  it('a level 1 Fighter has the class, species and background content of the pack, and the background Origin feat', () => {
    const e = createCharacter(provider(), spec(), DEFAULT_RULES);
    expect(e.rulesetId).toBe(R2024);
    expect(e.identity.level).toBe(1);
    expect(e.features.some(f => f.source.kind === 'class' && f.name === 'Second Wind')).toBe(true);
    expect(e.features.some(f => f.source.kind === 'race')).toBe(true);
    expect(e.features.some(f => f.source.kind === 'background')).toBe(true);
    expect(e.features.some(f => /Origin Feat/.test(f.name))).toBe(true);       // Soldier -> Savage Attacker, taken from the pack's feats
    expect(e.resources.hp.maximum).toBeGreaterThan(10);
  });

  it('what it reads is the pack: changing a record in the pack changes the character', () => {
    const [srd, base] = packs();
    const sentinel = 'SENTINEL-FROM-THE-PACK';
    const soldier = srd.homebrew!.backgrounds!.find(b => b.id === 'soldier_2024')!;
    const feat = srd.homebrew!.feats!.find(f => f.id === soldier.originFeat)!;
    feat.feature.description = sentinel;
    const fighter = srd.homebrew!.classes!.find(c => c.id === 'fighter_2024')!;
    fighter.rawProgression!.entries.find(e => e.level === 1)!.grants.forEach(g => { if (g.kind === 'feature' && (g.value as { name: string }).name === 'Second Wind') (g.value as { name: string }).name = 'Pack Wind'; });
    const e = createCharacter(packContentProvider([srd, base], R2024), spec(), DEFAULT_RULES);
    expect(e.features.some(f => f.description === sentinel)).toBe(true);
    expect(e.features.some(f => f.name === 'Pack Wind')).toBe(true);
    expect(e.features.some(f => f.name === 'Second Wind')).toBe(false);
  });

  it('species and spells also come from the pack: a record changed or removed there changes the result', () => {
    const [srd, base] = packs();
    const dwarf = srd.homebrew!.races!.find(r => r.id === 'dwarf_2024')!;
    dwarf.features[0].name = 'Pack Dwarf Trait';
    srd.homebrew!.spells = srd.homebrew!.spells!.filter(s => s.id !== 'firebolt');
    const p = packContentProvider([srd, base], R2024);
    expect(createCharacter(p, spec(), DEFAULT_RULES).features.some(f => f.name === 'Pack Dwarf Trait')).toBe(true);
    const e = createCharacter(p, spec({ classId: 'wizard_2024', raceId: 'human_2024', backgroundId: 'sage_2024' }), DEFAULT_RULES);
    const cantrips = e.choices.find(c => !c.resolved && c.definition.kind === 'spell' && c.definition.id.includes('cantrip'))!;
    expect(spellCandidates(p, e, cantrips.id).some(s => s.id === 'firebolt')).toBe(false);
    expect(spellCandidates(staticContentProvider(R2024), e, cantrips.id).some(s => s.id === 'firebolt')).toBe(true);
    expect(() => pickSpells(p, e, cantrips.id, ['firebolt'], DEFAULT_RULES)).toThrow(MissingContentError);
  });

  it('fails clearly when the pack lacks what the character needs', () => {
    const [srd, base] = packs();
    srd.homebrew!.classes = srd.homebrew!.classes!.filter(c => c.id !== 'fighter_2024');
    expect(() => createCharacter(packContentProvider([srd, base], R2024), spec(), DEFAULT_RULES)).toThrow(MissingContentError);
    expect(() => createCharacter(provider(), spec({ raceId: 'nope' }), DEFAULT_RULES)).toThrow(/Species "nope"/);
    expect(() => createCharacter(provider(), spec({ backgroundId: 'nope' }), DEFAULT_RULES)).toThrow(/Background "nope"/);
  });

  it('a level 3 Wizard with Evoker, and spells picked from the pack, matches the static catalog', () => {
    const fromPack = provider();
    const fromStatic = staticContentProvider(R2024);
    const build = (p: typeof fromPack) => {
      let e = createCharacter(p, spec({ classId: 'wizard_2024', raceId: 'human_2024', backgroundId: 'sage_2024', level: 3, subclassId: 'evoker_2024' }), DEFAULT_RULES);
      const cantrips = e.choices.find(c => !c.resolved && c.definition.kind === 'spell' && c.definition.id.includes('cantrip'))!;
      const picks = spellCandidates(p, e, cantrips.id).map(s => s.id).sort().slice(0, cantrips.definition.count);
      e = pickSpells(p, e, cantrips.id, picks, DEFAULT_RULES);
      return { e, picks };
    };
    const a = build(fromPack), b = build(fromStatic);
    expect(a.picks.length).toBeGreaterThan(0);
    expect(a.e.spellcasting!.cantrips.sort()).toEqual(a.picks);
    expect(a.e.identity.subclassId).toBeTruthy();
    // The pack character is the static character, feature for feature.
    expect(a.e.features.map(f => f.id).sort()).toEqual(b.e.features.map(f => f.id).sort());
    expect(a.e.resources.hp).toEqual(b.e.resources.hp);
    expect(a.e.derived).toEqual(b.e.derived);
    expect(a.e.spellcasting!.slots).toEqual(b.e.spellcasting!.slots);
  });

  it('a spell the choice would not offer is refused', () => {
    const p = provider();
    const e = createCharacter(p, spec({ classId: 'wizard_2024', raceId: 'human_2024', backgroundId: 'sage_2024' }), DEFAULT_RULES);
    const cantrips = e.choices.find(c => !c.resolved && c.definition.kind === 'spell' && c.definition.id.includes('cantrip'))!;
    expect(() => pickSpells(p, e, cantrips.id, ['sacred_flame'], DEFAULT_RULES)).toThrow(MissingContentError);
  });
});
