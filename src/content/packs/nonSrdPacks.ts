// ============================================================================
// FILE: src/content/packs/nonSrdPacks.ts
// The PRIVATE content packs: the official content the app carries that is not in a System Reference Document.
//   grimoire.nonsrd.5.1    the 5e (2014) content outside SRD 5.1: Artificer and every official subclass, species, background,
//                          feat and spell beyond the SRD, plus the items the 5.1 pack cannot carry (items the catalog marks
//                          SRD whose text is not yet verified against the SRD, and the non-SRD ones)
//   grimoire.nonsrd.5.2.1  the 5.5e (2024) content outside SRD 5.2.1: nothing exists today, so no pack is built
// These are NOT licensed for redistribution and are never bundled with the app or put in a public repository: the build writes
// them to release/packs/ only (never assets/packs/). A person installs them from a file, like any content pack, for their own
// use. They depend on the SRD packs and carry nothing the SRD packs already carry. Nothing private to the author (Blood Hunter,
// Abyss Knight, Emperor Warlock, the stress-test pack, user homebrew) is in them: those are homebrew, not official content.
// Build-time module; the app never imports it.
// ============================================================================
import type { CharClass, Item, Spell } from '../../engine/types';
import { ALL_CHAR_CLASSES_CATALOG, ALL_CLASS_PROGRESSIONS } from '../classes/index';
import { FULL_SUBCLASS_LIBRARY } from '../subclasses/index';
import { FULL_RACE_LIBRARY } from '../races/index';
import { FULL_BACKGROUND_LIBRARY } from '../backgrounds/index';
import { FULL_FEAT_LIBRARY } from '../feats/index';
import { FULL_SPELL_LIBRARY } from '../spells/index';
import { FULL_ITEM_LIBRARY } from '../items/index';
import type { RecordProvenance, PackDependency } from '../../engine/contentPackManifest';
import {
  SRD_5_1_PACK_ID, SrdPack, AnyRecord, PackContent, assemble, plain, stamp, subclassId, buildSrd51Pack, buildSrd521Pack,
} from './srdPacks';

export const NON_SRD_5_1_PACK_ID = 'grimoire.nonsrd.5.1';
export const NON_SRD_5_2_1_PACK_ID = 'grimoire.nonsrd.5.2.1';

const LICENSE_PRIVATE = 'Proprietary. For personal use on your own devices; not licensed for redistribution.';
const ATTRIBUTION = 'Dungeons & Dragons and the content of its official books are the property of Wizards of the Coast LLC. This pack is not part of any System Reference Document, is not licensed for redistribution, and is not endorsed by or affiliated with Wizards of the Coast.';
const R2024 = 'dnd5e-2024';

/** Classes and subclasses that are the author's homebrew, not official content (they live in the libraries for their progressions). */
const HOMEBREW_CLASS_IDS = new Set(['blood_hunter', 'abyss_knight', 'emperor_warlock']);

const official = (sourceLocation: string): RecordProvenance =>
  ({ kind: 'grimoire', sourceId: 'official-non-srd', sourceLocation });

const is2024 = (x: { rulesetId?: unknown }) => x.rulesetId === R2024;

/** A copy of a record without the parentheticals the catalog adds for the author's own classes ("5 feet (30 feet for Abyss Knight)"). */
const PRIVATE_NOTE = /\s*\([^()"]*(?:Abyss Knight|Blood Hunter|Emperor Warlock)[^()"]*\)/g;
/** ...and the paragraph a spell description gets for them ("Abyss Knight modification: ..."), up to the next blank line. */
const PRIVATE_PARAGRAPH = /(?:\\n){1,2}(?:Abyss Knight|Blood Hunter|Emperor Warlock)[^"]*?(?=\\n\\n|")/g;
const scrub = <T,>(x: T): T => JSON.parse(JSON.stringify(x).replace(PRIVATE_PARAGRAPH, '').replace(PRIVATE_NOTE, '')) as T;
/** Sources that are the author's homebrew rather than a published book. */
const HOMEBREW_SOURCE = /Blood Hunter/i;

export function buildNonSrd51Pack(): SrdPack {
  const srd51 = buildSrd51Pack();
  const srd521 = buildSrd521Pack();
  const idsOf = (pack: SrdPack, key: keyof PackContent) => new Set(((pack.homebrew as unknown as Record<string, AnyRecord[]>)[key] ?? []).map(r => r.id));
  const taken = (key: keyof PackContent) => new Set([...idsOf(srd51, key), ...idsOf(srd521, key)]);

  const prov = official('Official non-SRD content');
  const progressionOf = (c: CharClass) => c.rawProgression ? {} : (ALL_CLASS_PROGRESSIONS.find(p => p.classId === c.id) ? { rawProgression: ALL_CLASS_PROGRESSIONS.find(p => p.classId === c.id) } : {});
  const classes = (ALL_CHAR_CLASSES_CATALOG as CharClass[])
    .filter(c => c.srd !== true && !is2024(c) && !HOMEBREW_CLASS_IDS.has(c.id))
    .map(c => stamp(scrub(plain({ ...c, ...progressionOf(c) })), prov) as AnyRecord);
  // Class tags a spell may carry: the SRD classes and this pack's own (private homebrew classes are never named).
  const classTags = new Set([...idsOf(srd51, 'classes'), ...classes.map(c => c.id)]);

  const subclasses = FULL_SUBCLASS_LIBRARY
    .filter(s => s.srd !== true && !is2024(s as { rulesetId?: unknown }) && !HOMEBREW_CLASS_IDS.has(s.classId) && !String(s.classId).endsWith('_2024'))
    .map(s => stamp(scrub(plain({ ...s, id: subclassId(s as never) })), prov) as AnyRecord);
  const nonSrd = <T extends { id: string; srd?: boolean; rulesetId?: unknown }>(list: readonly T[]) =>
    list.filter(x => x.srd !== true && !is2024(x));
  const verified = idsOf(srd51, 'items');
  const inSrd521 = idsOf(srd521, 'items');
  const items = (FULL_ITEM_LIBRARY as Item[])
    .filter(i => !verified.has(i.id) && !inSrd521.has(i.id) && !is2024(i as { rulesetId?: unknown }))
    .map(i => stamp(scrub(plain(i)), official(i.srd === true ? 'Marked SRD in the catalog but not verified against the SRD text' : 'Official non-SRD item')) as AnyRecord);

  const spellsTaken = taken('spells');
  const content: PackContent = {
    classes, subclasses,
    races: nonSrd(FULL_RACE_LIBRARY).map(r => stamp(scrub(plain(r)), prov) as AnyRecord),
    backgrounds: nonSrd(FULL_BACKGROUND_LIBRARY).map(b => stamp(scrub(plain(b)), prov) as AnyRecord),
    feats: nonSrd(FULL_FEAT_LIBRARY).filter(f => !HOMEBREW_SOURCE.test(f.source ?? '')).map(f => stamp(scrub(plain(f)), prov) as AnyRecord),
    spells: nonSrd(FULL_SPELL_LIBRARY as Spell[]).filter(s => !spellsTaken.has(s.id))
      .map(s => stamp(scrub(plain({ ...s, classes: (s.classes ?? []).filter(c => classTags.has(c)) })), prov) as AnyRecord),
    items, monsters: [], conditions: [],
  };
  const deps: PackDependency[] = [{ id: SRD_5_1_PACK_ID, minVersion: '1.0.0', reason: 'The SRD 5.1 classes, rules and equipment this content builds on.' }];
  return assemble({
    id: NON_SRD_5_1_PACK_ID, name: 'Grimoire 5e non-SRD (private)', version: '1.0.0', ruleset: 'dnd5e-2014', sourceFamily: 'NON_SRD_5E',
    license: LICENSE_PRIVATE, attribution: ATTRIBUTION, dependencies: deps,
    description: 'Official 5e content outside the SRD: Artificer, subclasses, species, backgrounds, feats, spells and items. For personal use; do not redistribute.',
  }, content, undefined, ['dnd5e-2014']);
}

/**
 * The 5.5e content outside SRD 5.2.1. Every 2024 class, subclass, species, background, feat and spell in the app is part of
 * SRD 5.2.1 and in that pack, so there is nothing to put here and no pack is built (undefined).
 */
export function buildNonSrd521Pack(): SrdPack | undefined {
  const outsideSrd = (ALL_CHAR_CLASSES_CATALOG as CharClass[]).filter(c => is2024(c) && !c.id.endsWith('_2024'));
  if (outsideSrd.length === 0) return undefined;
  throw new Error('There is 5.5e content outside SRD 5.2.1 now; write buildNonSrd521Pack for it.');
}
