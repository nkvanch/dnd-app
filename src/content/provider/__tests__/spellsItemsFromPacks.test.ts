// Spells and items read through the repos (spellRepo, itemRepo): entitlements, action cards, the pickers and the
// prerequisite checks. With packs installed as the official source those repos answer from the packs, never from the
// hardcoded libraries. No repo is mocked here: the native repos Jest resolves hold nothing, so every answer below can
// only have come from the packs.
import { buildSrd51Pack, buildSrd521Pack, serializePack } from '../../packs/srdPacks';
import { packContentProvider, InstalledPack } from '../contentProvider';
import { staticContentProvider } from '../staticProvider';
import { setOfficialContentProvider } from '../../officialSource';
import { spellRepo } from '../../spellRepo';
import { itemRepo } from '../../itemRepo';
import { mergeSpellIndex, resolveSpellById } from '../../contentResolution';
import { generateSpellCard } from '../../../engine/actionCards';
import { checkPrerequisites } from '../../../engine/prerequisites';
import { newChar, toLevel } from '../../classes2024/testKit';
import { parseStartingItem } from '../../../engine/leveling';
import { WEAPON_MASTERY_TABLE } from '../../weaponMastery';
import { CLASSES_2024 } from '../../classes2024';
import { BACKGROUNDS_2024 } from '../../backgrounds/backgrounds2024';
import { RulesetId } from '../../../engine/types';

const R2024 = 'dnd5e-2024' as RulesetId;
const R2014 = 'dnd5e-2014' as RulesetId;
const packs: InstalledPack[] = [buildSrd51Pack(), buildSrd521Pack()].map(p => JSON.parse(serializePack(p)));

beforeEach(() => setOfficialContentProvider(packContentProvider(packs)));
afterEach(() => setOfficialContentProvider(null));

describe('spells from installed packs', () => {
  it('the index has one entry per spell id, with the class tags of every version', () => {
    const index = spellRepo.getIndex();
    const ids = index.map(s => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.length).toBeGreaterThanOrEqual(339);
    const fireball = index.find(s => s.id === 'fireball')!;
    expect(fireball.classes).toEqual(expect.arrayContaining(['wizard', 'sorcerer', 'wizard_2024', 'sorcerer_2024']));
    expect(index.some(s => s.id === 'divine_smite')).toBe(true);                 // new in 2024, only in the 5.2.1 pack
  });

  it('a spell resolves to the version for the ruleset: 5.2.1 text for 2024, the 5.1 record otherwise', () => {
    expect(spellRepo.getSpellSync('acid_splash', R2024)!.school).toBe('Evocation');
    expect(spellRepo.getSpellSync('acid_splash', R2014)!.school).toBe('Conjuration');
    expect(spellRepo.getSpellSync('acid_splash')!.school).toBe('Conjuration');
    expect(resolveSpellById('acid_splash', [], R2024)!.school).toBe('Evocation');
    expect(spellRepo.getSpellSync('divine_smite', R2024)).toBeDefined();
    expect(spellRepo.getSpellSync('divine_smite', R2014)).toBeUndefined();       // a 2024-only spell is not on a 2014 character
  });

  it('the pickers see 2024 class lists, and ensureLoaded has nothing to load', async () => {
    await expect(spellRepo.ensureLoaded(['fireball'])).resolves.toBeUndefined();
    const forWizard = mergeSpellIndex([], R2024).filter(s => (s.classes ?? []).includes('wizard_2024'));
    expect(forWizard.length).toBeGreaterThan(100);
    expect(forWizard.some(s => s.id === 'sleep_spell')).toBe(true);
  });

  it('a spell card is built from the pack version', () => {
    let e = newChar('wizard');
    e = { ...e, spellcasting: { ...e.spellcasting!, cantrips: ['acid_splash'] } };
    expect(generateSpellCard('acid_splash', e)!.layer1).toMatch(/Evocation/);
    expect(generateSpellCard('acid_splash', { ...e, rulesetId: R2014 })!.layer1).toMatch(/Conjuration/);
  });

  it('prerequisites that read cantrip text work from the packs (Agonizing Blast needs a damaging cantrip)', () => {
    let e = toLevel(newChar('warlock'), 'warlock', 2);
    const need = [{ kind: 'cantrip' as const, traits: ['damage' as const], label: 'a damaging cantrip' }];
    e = { ...e, spellcasting: { ...e.spellcasting!, cantrips: ['mage_hand'] } };
    expect(checkPrerequisites(e, need).met).toBe(false);
    e = { ...e, spellcasting: { ...e.spellcasting!, cantrips: ['mage_hand', 'eldritch_blast'] } };
    expect(checkPrerequisites(e, need).met).toBe(true);
  });

  it('every always-prepared and granted spell of the 2024 classes exists in the packs', () => {
    const missing: string[] = [];
    const check = (owner: string, id: string) => { if (!spellRepo.getSpellSync(id, R2024)) missing.push(`${owner}:${id}`); };
    for (const c of CLASSES_2024) for (const entry of c.rawProgression!.entries) for (const g of entry.grants) {
      if (g.kind === 'known_spells') (g.value as { spellIds: string[] }).spellIds.forEach(id => check(c.id, id));
    }
    expect(missing).toEqual([]);
  });

  it('the static provider answers the same way for the spells it shares with the packs', () => {
    const fromStatic = staticContentProvider(R2024);
    const fromPacks = packContentProvider(packs, R2024);
    for (const id of ['acid_splash', 'fireball', 'hold_person', 'alarm']) {
      const a = fromStatic.getSpell(id)!, b = fromPacks.getSpell(id)!;
      expect([id, a.school, a.castingTime, a.description]).toEqual([id, b.school, b.castingTime, b.description]);
    }
  });
});

describe('items from installed packs', () => {
  it('the index and records come from the packs', () => {
    expect(itemRepo.getIndex().length).toBeGreaterThanOrEqual(100);
    expect(itemRepo.getItemSync('longsword')).toBeDefined();
    expect(itemRepo.getItemSync('quiver')?.name).toBe('Quiver');                // gear only the 5.2.1 pack carries
    expect(itemRepo.getItemSync('blade_of_the_vampire_queen')).toBeUndefined(); // nothing outside the packs
  });

  it('every item a 2024 class or background starts with resolves from the packs', () => {
    const missing: string[] = [];
    const want = (owner: string, entry: string) => { const id = parseStartingItem(entry).itemId; if (!itemRepo.getItemSync(id)) missing.push(`${owner}:${id}`); };
    for (const c of CLASSES_2024) for (const ch of c.rawProgression!.entries[0].choices.filter(x => x.kind === 'equipment'))
      for (const o of ch.pool as { value: string[] }[]) o.value.forEach(e => want(c.id, e));
    for (const b of BACKGROUNDS_2024) for (const ch of (b.pendingChoices ?? []).filter(x => x.kind === 'equipment'))
      for (const o of ch.pool as { value: string[] }[]) o.value.forEach(e => want(b.id, e));
    expect(missing).toEqual([]);
  });

  it('every weapon with a mastery property resolves (the two optional firearms are not in the packs)', () => {
    const missing = WEAPON_MASTERY_TABLE.filter(w => !itemRepo.getItemSync(w.id)).map(w => w.id);
    expect(missing.sort()).toEqual(['musket', 'pistol']);
  });
});
