// ============================================================================
// FILE: src/content/packs/srdPacks.ts
// Builds the two first-party SRD content packs from the content the app currently carries:
//   grimoire.srd.5.1    System Reference Document 5.1   (ruleset dnd5e-2014), Creative Commons Attribution 4.0
//   grimoire.srd.5.2.1  System Reference Document 5.2.1 (ruleset dnd5e-2024), Creative Commons Attribution 4.0
// Each pack is one `.grimoire-pack` envelope (engine/backup.ts GrimoirePack) with a manifest, every record it
// holds, and per-record provenance. Only content verified as SRD goes in: the 5.1 pack takes records the library
// marks `srd: true` (items through the public-provenance gate), the 5.2.1 pack takes the 2024 classes, species,
// backgrounds, Origin feats, spells (with the SRD 5.2.1 text applied) and starting gear. Nothing private
// (Blood Hunter, Abyss Knight, Emperor Warlock, the stress-test pack, user homebrew) can enter either pack.
//
// This is a build-time module: the app never imports it. It exists so the pack files can be generated, verified
// and, in a later step, installed in place of the hardcoded catalog.
// ============================================================================
import { createHash } from 'crypto';
import type { GrimoirePack } from '../../engine/backup';
import { GRIMOIRE_PACK_FORMAT_VERSION } from '../../engine/backup';
import {
  CONTENT_PACK_MANIFEST_VERSION, ContentPackManifest, RecordProvenance, PackDependency, canonicalJson,
} from '../../engine/contentPackManifest';
import type { CharClass, Item, Spell } from '../../engine/types';
import { ALL_CHAR_CLASSES_CATALOG } from '../classes/index';
import { ALL_CLASS_PROGRESSIONS } from '../classes/index';
import { FULL_SUBCLASS_LIBRARY } from '../subclasses/index';
import { FULL_RACE_LIBRARY, raceHuman2024 } from '../races/index';
import { FULL_BACKGROUND_LIBRARY } from '../backgrounds/index';
import { FULL_FEAT_LIBRARY } from '../feats/index';
import { FULL_SPELL_LIBRARY } from '../spells/index';
import { FULL_MONSTER_LIBRARY } from '../monsters/srd';
import { GENERATED_SRD_ITEMS } from '../items/generatedSrdItems';
import { hasVerifiedPublicItemProvenance } from '../items/srdProvenance';
import { ALL_CONDITIONS } from '../conditions/index';
import { CLASSES_2024, SUBCLASSES_2024 } from '../classes2024/index';
import { NEW_SPELLS_2024 } from '../classes2024/spells2024';
import { SPELL_LIST_2024 } from '../classes2024/spellLists2024';
import { RACES_2024 } from '../races/races2024';
import { ORIGIN_FEATS_2024 } from '../feats/origin2024';
import { MORE_FEATS_2024 } from '../feats/feats2024';
import { BACKGROUNDS_2024 } from '../backgrounds/backgrounds2024';
import { SPELL_VERSIONS_2024 } from '../spells/spellVersions2024';
import { GEAR_2024 } from '../items/gear2024';
import { EQUIPMENT_2024, EQUIPMENT_2024_IDS } from '../items/equipment2024';
import { MAGIC_ITEMS_2024, magicItemRecord } from '../items/magicItems2024';
import { GLOSSARY_2024, TOOLBOX_2024, EQUIPMENT_RULES_2024 } from '../rules/rulesReference2024Data';
import { FULL_ITEM_LIBRARY } from '../items/index';
import { parseStartingItem } from '../../engine/startingItems';
import { WEAPON_MASTERY_TABLE, MASTERY_RULES } from '../weaponMastery';

export const SRD_5_1_PACK_ID = 'grimoire.srd.5.1';
export const SRD_5_2_1_PACK_ID = 'grimoire.srd.5.2.1';

const LICENSE = 'CC-BY-4.0';
const ATTRIBUTION_5_1 =
  'This work includes material taken from the System Reference Document 5.1 ("SRD 5.1") by Wizards of the Coast LLC and available at https://dnd.wizards.com/resources/systems-reference-document. The SRD 5.1 is licensed under the Creative Commons Attribution 4.0 International License, available at https://creativecommons.org/licenses/by/4.0/legalcode.';
const ATTRIBUTION_5_2_1 =
  'This work includes material taken from the System Reference Document 5.2.1 ("SRD 5.2.1") by Wizards of the Coast LLC and available at https://www.dndbeyond.com/srd. The SRD 5.2.1 is licensed under the Creative Commons Attribution 4.0 International License, available at https://creativecommons.org/licenses/by/4.0/legalcode.';

export type AnyRecord = Record<string, unknown> & { id: string };

/** A subclass record's id: its own `id` (the 2024 ones), else the id its features carry as their source (what a character's subclassId is), else its name. */
export function subclassId(s: { classId: string; name: string; entries: { grants: { kind: string; value: unknown }[] }[] } & { id?: string }): string {
  if (s.id) return s.id;
  for (const e of s.entries) for (const g of e.grants) {
    const f = g.kind === 'feature' ? (g.value as { source?: { kind?: string; refId?: string } }) : undefined;
    if (f?.source?.kind === 'subclass' && f.source.refId) return f.source.refId;
  }
  return `${s.classId}.${s.name.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`;
}

/** Plain JSON copy: what a pack file holds (drops undefined, proves the record carries no functions). */
export const plain = <T,>(x: T): T => JSON.parse(JSON.stringify(x)) as T;

export const stamp = <T extends object>(record: T, provenance: RecordProvenance): T & { provenance: RecordProvenance } =>
  ({ ...record, provenance });

const srdProvenance = (family: '5.1' | '5.2.1', extra: Partial<RecordProvenance> = {}): RecordProvenance =>
  ({ kind: 'srd', family, sourceId: `srd-${family}`, ...extra });

export { canonicalJson };

export const sha256 = (text: string): string => createHash('sha256').update(text).digest('hex');

export type SrdPack = GrimoirePack & { manifest: ContentPackManifest; rules?: Record<string, unknown> };

export type PackContent = {
  classes: AnyRecord[]; subclasses: AnyRecord[]; races: AnyRecord[]; backgrounds: AnyRecord[]; feats: AnyRecord[];
  spells: AnyRecord[]; items: AnyRecord[]; monsters: AnyRecord[]; conditions: AnyRecord[];
};

export function assemble(
  base: Pick<ContentPackManifest, 'id' | 'name' | 'version' | 'ruleset' | 'sourceFamily' | 'attribution' | 'dependencies'> & { description: string; license?: string },
  content: PackContent,
  rules: Record<string, unknown> | undefined,
  compatibleRulesets: string[],
): SrdPack {
  const homebrew = {
    classes: content.classes, subclasses: content.subclasses, races: content.races, subraces: [], backgrounds: content.backgrounds,
    feats: content.feats, spells: content.spells, items: content.items, monsters: content.monsters, conditions: content.conditions,
    features: [], spellLists: [],
  };
  const counts: Record<string, number> = {};
  for (const [k, v] of Object.entries(homebrew)) if ((v as unknown[]).length > 0) counts[k] = (v as unknown[]).length;
  const contentHash = sha256(canonicalJson({ homebrew, rules: rules ?? null }));
  const manifest: ContentPackManifest = {
    manifestVersion: CONTENT_PACK_MANIFEST_VERSION, id: base.id, name: base.name, version: base.version, ruleset: base.ruleset,
    sourceFamily: base.sourceFamily, license: base.license ?? LICENSE, attribution: base.attribution, contentHash,
    dependencies: base.dependencies, replaces: [], author: 'Grimoire', officialFirstPartyPack: true, counts,
  };
  const TYPE_OF: Record<string, string> = {
    classes: 'class', subclasses: 'subclass', races: 'race', backgrounds: 'background', feats: 'feat',
    spells: 'spell', items: 'item', monsters: 'monster', conditions: 'condition',
  };
  const contents = (Object.entries(homebrew) as [string, AnyRecord[]][]).flatMap(([category, records]) =>
    TYPE_OF[category] ? records.map(r => ({ type: TYPE_OF[category] as never, id: r.id, name: String((r as { name?: unknown }).name ?? r.id), included: 'selected' as const })) : []);
  return {
    formatVersion: GRIMOIRE_PACK_FORMAT_VERSION, packType: 'content-pack', createdAt: 0, appVersion: 'build', deviceId: null, characters: [],
    homebrew: homebrew as never,
    schemaVersion: 1, packageId: base.id, name: base.name, packageVersion: base.version, author: 'Grimoire', description: base.description,
    compatibleRulesets: compatibleRulesets as never, contents, manifest, ...(rules ? { rules } : {}),
  };
}

// ── SRD 5.1 ──────────────────────────────────────────────────────────────────

export function buildSrd51Pack(): SrdPack {
  const prov = srdProvenance('5.1');
  const progressionFor = (classId: string) => ALL_CLASS_PROGRESSIONS.find(p => p.classId === classId);
  const classes = (ALL_CHAR_CLASSES_CATALOG as CharClass[])
    .filter(c => c.srd === true && !CLASSES_2024.some(c24 => c24.id === c.id))
    .map(c => stamp(plain({ ...c, ...(c.rawProgression ? {} : (progressionFor(c.id) ? { rawProgression: progressionFor(c.id) } : {})) }), prov) as AnyRecord);
  const srdClassIds = new Set(classes.map(c => c.id));
  const content: PackContent = {
    classes,
    subclasses: FULL_SUBCLASS_LIBRARY.filter(s => s.srd === true && !SUBCLASSES_2024.some(s24 => s24.id === (s as { id?: string }).id)).map(s => stamp(plain({ ...s, id: subclassId(s as never) }), prov) as AnyRecord),
    races: FULL_RACE_LIBRARY.filter(r => r.srd === true && r.rulesetId !== ('dnd5e-2024' as never)).map(r => stamp(plain(r), prov) as AnyRecord),
    backgrounds: FULL_BACKGROUND_LIBRARY.filter(b => b.srd === true && b.rulesetId !== ('dnd5e-2024' as never)).map(b => stamp(plain(b), prov) as AnyRecord),
    feats: FULL_FEAT_LIBRARY.filter(f => f.srd === true && f.rulesetId !== ('dnd5e-2024' as never)).map(f => stamp(plain(f), prov) as AnyRecord),
    // Class tags are limited to the classes this pack carries: the library also tags spells for classes outside the SRD
    // (Artificer and private ones), and a pack must not name them.
    spells: (FULL_SPELL_LIBRARY as Spell[]).filter(s => s.srd === true && s.rulesetId !== ('dnd5e-2024' as never))
      .map(s => stamp(plain({ ...s, classes: (s.classes ?? []).filter(c => srdClassIds.has(c)) }), prov) as AnyRecord),
    items: GENERATED_SRD_ITEMS.filter(i => hasVerifiedPublicItemProvenance(i.id)).map(i => stamp(plain(i), prov) as AnyRecord),
    monsters: FULL_MONSTER_LIBRARY.filter(m => m.srd === true).map(m => stamp(plain(m), prov) as AnyRecord),
    conditions: ALL_CONDITIONS.map(c => stamp(plain(c), prov) as AnyRecord),
  };
  return assemble({
    id: SRD_5_1_PACK_ID, name: 'Grimoire SRD 5.1', version: '1.0.0', ruleset: 'dnd5e-2014', sourceFamily: 'SRD_5_1',
    attribution: ATTRIBUTION_5_1, dependencies: [], description: 'The System Reference Document 5.1 content of Grimoire: D&D 5e compatible.',
  }, content, undefined, ['dnd5e-2014']);
}

/**
 * The equipment the 5.2.1 pack needs to stand on its own: the gear its starting packages name and the weapons its Weapon
 * Mastery table lists, taken from the item library. The 5.1 pack's items are limited to what passed the public-provenance
 * gate (95 items, which leaves out Leather Armor, the adventuring packs, Holy Symbol and the crossbows), so anything the
 * 2024 classes and backgrounds hand out that is missing there is added here, from entries the library marks as SRD.
 * The build fails if a named item is not in the library or is not marked SRD, so nothing outside the SRD can slip in.
 */
function equipment521(): AnyRecord[] {
  const have = new Set(GENERATED_SRD_ITEMS.filter(i => hasVerifiedPublicItemProvenance(i.id)).map(i => i.id));
  // Every SRD 5.2.1 magic item is a record of this pack; where the 5.1 pack has the same id, this pack's record (the later one) wins.
  const gear = new Set([...GEAR_2024, ...EQUIPMENT_2024].map(i => i.id));
  const wanted = new Set<string>();
  const addEntries = (entries: unknown[]) => { for (const e of entries) wanted.add(parseStartingItem(String(e)).itemId); };
  const choicesOf = (choices: { kind: string; pool?: unknown }[]) => choices.filter(c => c.kind === 'equipment')
    .forEach(c => (Array.isArray(c.pool) ? c.pool : []).forEach((o: { value?: unknown }) => Array.isArray(o.value) && addEntries(o.value)));
  for (const c of CLASSES_2024) for (const e of c.rawProgression!.entries) choicesOf(e.choices as never);
  for (const b of BACKGROUNDS_2024) choicesOf((b.pendingChoices ?? []) as never);
  for (const w of WEAPON_MASTERY_TABLE) wanted.add(w.id);
  for (const id of EQUIPMENT_2024_IDS) wanted.add(id);
  const library = new Map((FULL_ITEM_LIBRARY as Item[]).map(i => [i.id, i]));
  const extra: Item[] = [];
  for (const id of [...wanted].sort()) {
    if (have.has(id) || gear.has(id)) continue;
    const item = library.get(id);
    if (!item) { throw new Error(`The 5.2.1 pack needs the item "${id}", which is not in the item library.`); }
    if (item.srd !== true) throw new Error(`The 5.2.1 pack needs the item "${id}", which is not marked SRD.`);
    extra.push(item);
  }
  return [...GEAR_2024, ...EQUIPMENT_2024, ...MAGIC_ITEMS_2024.map(m => magicItemRecord(m, library.get(m.id))), ...extra].map(i => stamp(plain(i), srdProvenance('5.2.1', { sourceLocation: 'Equipment' })) as AnyRecord);
}

// ── SRD 5.2.1 ────────────────────────────────────────────────────────────────

export function buildSrd521Pack(): SrdPack {
  const prov = srdProvenance('5.2.1');
  const derived = srdProvenance('5.2.1', { derivedBy: 'grimoire-normalization', sourceLocation: 'Spells' });
  const ruleset = 'dnd5e-2024';
  // Every spell the SRD 5.2.1 describes: the library record with the 5.2.1 text applied (the library keeps the 2014
  // wording under the same id), plus the spells new in 2024. The class tags are the 2024 lists.
  const lib = new Map((FULL_SPELL_LIBRARY as Spell[]).map(s => [s.id, s]));
  const spells: AnyRecord[] = Object.entries(SPELL_VERSIONS_2024).map(([id, version]) => {
    const base = lib.get(id)!;
    return stamp(plain({ ...base, ...version, rulesetId: ruleset, classes: (base.classes ?? []).filter(c => c.endsWith('_2024')) }), derived) as AnyRecord;
  });
  for (const s of NEW_SPELLS_2024) spells.push(stamp(plain(s), prov) as AnyRecord);

  const content: PackContent = {
    classes: CLASSES_2024.map(c => stamp(plain(c), prov) as AnyRecord),
    subclasses: SUBCLASSES_2024.map(s => stamp(plain(s), prov) as unknown as AnyRecord),
    races: [raceHuman2024, ...RACES_2024].map(r => stamp(plain(r), prov) as AnyRecord),
    backgrounds: BACKGROUNDS_2024.map(b => stamp(plain(b), prov) as AnyRecord),
    feats: [...ORIGIN_FEATS_2024, ...MORE_FEATS_2024].map(f => stamp(plain(f), prov) as AnyRecord),
    spells,
    items: equipment521(),
    monsters: [],
    conditions: [],
  };
  const rules = {
    weaponMastery: {
      provenance: srdProvenance('5.2.1', { sourceLocation: 'Weapon Mastery', derivedBy: 'grimoire-normalization' }),
      properties: MASTERY_RULES, weapons: WEAPON_MASTERY_TABLE,
    },
    spellLists: { provenance: derived, byClass: SPELL_LIST_2024 },
    reference: { provenance: srdProvenance('5.2.1', { sourceLocation: 'Rules Glossary, Gameplay Toolbox, Equipment' }), glossary: GLOSSARY_2024, toolbox: TOOLBOX_2024, equipment: EQUIPMENT_RULES_2024 },
  };
  const deps: PackDependency[] = [{ id: SRD_5_1_PACK_ID, minVersion: '1.0.0', reason: 'Weapons, armor and equipment packs the 2024 classes and backgrounds start with; monsters and conditions.' }];
  return assemble({
    id: SRD_5_2_1_PACK_ID, name: 'Grimoire SRD 5.2.1', version: '1.0.0', ruleset, sourceFamily: 'SRD_5_2_1',
    attribution: ATTRIBUTION_5_2_1, dependencies: deps, description: 'The System Reference Document 5.2.1 content of Grimoire: 2024 / 5.5e compatible.',
  }, content, rules, [ruleset]);
}

/** The bytes a pack file holds. */
export const serializePack = (pack: SrdPack): string => JSON.stringify(pack);
