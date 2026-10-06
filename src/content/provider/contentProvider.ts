// ============================================================================
// FILE: src/content/provider/contentProvider.ts
// The content-provider seam (docs/SRD_PACKS.md, step 4). Character creation asks a ContentProvider for the classes,
// species, backgrounds, feats and spells it works with instead of importing the hardcoded catalog. Two providers:
//   - packContentProvider (this file): reads installed `.grimoire-pack` envelopes (the SRD packs, or any pack with the
//     same shape), verifies their manifests and dependencies, and merges them by id. No static content is imported.
//   - staticContentProvider (staticProvider.ts): the hardcoded catalog behind the same interface, so the two can be
//     compared and so nothing existing has to change yet.
// Pure data in, pure data out: the provider never mutates a pack and never reaches into the stores.
// ============================================================================
import { conditionForRuleset } from '../conditions/resolve';
import { is2024ItemId, baseItemId, editionItemId } from '../itemEditions';
import type { GrimoirePack } from '../../engine/backup';
import { validateGrimoirePack } from '../../engine/backup';
import { ContentPackManifest, compareVersions, validateManifest } from '../../engine/contentPackManifest';
import type { Background, CharClass, ClassProgression, Condition, Feat, Item, Race, RulesetId, Spell } from '../../engine/types';
import { matchesRuleset } from '../../engine/types';

/** A subclass as packs carry it: the class's progression shape plus its own id and name. */
export type ProviderSubclass = ClassProgression & { id: string; name: string; rulesetId?: RulesetId };

export interface ContentProvider {
  /** Where the content came from, for diagnostics and tests: "pack:grimoire.srd.5.2.1@1.0.0" or "static". */
  readonly source: string;
  /** The ruleset the provider is scoped to, or undefined when it serves every installed ruleset. */
  readonly rulesetId?: RulesetId;
  classes(): readonly CharClass[];
  getClass(id: string): CharClass | undefined;
  subclasses(): readonly ProviderSubclass[];
  subclassesOf(classId: string): readonly ProviderSubclass[];
  getSubclass(id: string): ProviderSubclass | undefined;
  /** Species (the 2024 name for races). */
  races(): readonly Race[];
  getRace(id: string): Race | undefined;
  backgrounds(): readonly Background[];
  getBackground(id: string): Background | undefined;
  feats(): readonly Feat[];
  getFeat(id: string): Feat | undefined;
  /**
   * One spell record per id, resolved for a ruleset (the provider's own when none is given): a record written for that
   * ruleset (the SRD 5.2.1 version of a spell) wins over the shared one, and a record written for another ruleset is left out.
   */
  spells(rulesetId?: RulesetId): readonly Spell[];
  getSpell(id: string, rulesetId?: RulesetId): Spell | undefined;
  /** One record per spell id for browsing and class lists: the shared record carrying the class tags of every version. */
  spellIndexSpells(): readonly Spell[];
  items(): readonly Item[];
  getItem(id: string): Item | undefined;
  /** Every condition record, every edition's (5e and 5.5e share ids and differ by `rulesetId`). */
  conditionRecords(): readonly Condition[];
  /** The condition of an id for a ruleset (the provider's own when none is given). See conditions/resolve.ts. */
  getCondition(id: string, rulesetId?: RulesetId): Condition | undefined;
}

/** A pack is not usable: invalid, a dependency is missing or too old, or two packs are for different rulesets. */
export class PackProviderError extends Error {
  constructor(message: string) { super(message); this.name = 'PackProviderError'; }
}

export type InstalledPack = GrimoirePack & { manifest: ContentPackManifest };

/** The id a subclass is looked up by (its own id, which the 2024 subclasses carry). */
const subclassKey = (s: ProviderSubclass): string => s.id;

/** Orders packs so each comes after what it depends on, and refuses a missing or too-old dependency. */
export function orderPacks(packs: readonly InstalledPack[]): InstalledPack[] {
  const byId = new Map<string, InstalledPack>();
  for (const p of packs) {
    const problem = validateGrimoirePack(p) ?? validateManifest(p.manifest)[0] ?? null;
    if (problem) throw new PackProviderError(`${p.manifest?.id ?? 'A pack'} cannot be used: ${problem}`);
    if (byId.has(p.manifest.id)) throw new PackProviderError(`${p.manifest.id} is installed twice.`);
    byId.set(p.manifest.id, p);
  }
  const ordered: InstalledPack[] = [];
  const visiting = new Set<string>();
  const visit = (p: InstalledPack): void => {
    if (ordered.includes(p)) return;
    if (visiting.has(p.manifest.id)) throw new PackProviderError(`${p.manifest.id} depends on itself.`);
    visiting.add(p.manifest.id);
    for (const dep of p.manifest.dependencies ?? []) {
      const found = byId.get(dep.id);
      if (!found) throw new PackProviderError(`${p.manifest.id} needs ${dep.id}, which is not installed.`);
      if (dep.minVersion && compareVersions(found.manifest.version, dep.minVersion) < 0) {
        throw new PackProviderError(`${p.manifest.id} needs ${dep.id} ${dep.minVersion} or newer; ${found.manifest.version} is installed.`);
      }
      visit(found);
    }
    visiting.delete(p.manifest.id);
    ordered.push(p);
  };
  for (const p of packs) visit(p);
  return ordered;
}

function mergeById<T extends { id: string }>(lists: readonly (readonly T[])[]): T[] {
  const out = new Map<string, T>();
  for (const list of lists) for (const r of list) out.set(r.id, r);
  return [...out.values()];
}

/** A provider over installed packs, for one ruleset (or, with none given, for every ruleset the packs are written for). A later pack replaces an earlier record with the same id. */
export function packContentProvider(packs: readonly InstalledPack[], rulesetId?: RulesetId): ContentProvider {
  const ordered = orderPacks(packs);
  // A record with no ruleset of its own is written for the ruleset its pack is for (the 5.1 pack's untagged classes are
  // 2014 content, not content that belongs to every ruleset).
  const pick = <T extends { id: string; rulesetId?: RulesetId }>(key: keyof NonNullable<GrimoirePack['homebrew']>): T[] =>
    mergeById(ordered.map(p => ((p.homebrew?.[key] ?? []) as unknown as T[])
      .filter(r => matchesRuleset(r.rulesetId ?? (p.manifest.ruleset as RulesetId), rulesetId))));

  const classes = pick<CharClass>('classes');
  const subclasses = pick<ProviderSubclass>('subclasses');
  const races = pick<Race>('races');
  const backgrounds = pick<Background>('backgrounds');
  const feats = pick<Feat>('feats');
  const index = <T extends { id: string }>(list: readonly T[], key: (x: T) => string = x => x.id) => new Map(list.map(x => [key(x), x]));
  const classById = index(classes), subclassById = index(subclasses, subclassKey), raceById = index(races),
    backgroundById = index(backgrounds), featById = index(feats);

  // Spells keep every version: the 5.1 pack's shared record and the 5.2.1 pack's 2024 record share an id, so they are
  // grouped by id and resolved per ruleset instead of the later one replacing the earlier.
  const spellVersions = new Map<string, Spell[]>();
  for (const p of ordered) for (const s of ((p.homebrew?.spells ?? []) as unknown as Spell[])) {
    spellVersions.set(s.id, [...(spellVersions.get(s.id) ?? []), s]);
  }
  const last = <T,>(list: T[]): T | undefined => list[list.length - 1];
  const resolveSpell = (versions: Spell[], target?: RulesetId): Spell | undefined => {
    const shared = last(versions.filter(v => !v.rulesetId));
    if (!target) return shared ?? last(versions);
    return last(versions.filter(v => v.rulesetId === target)) ?? shared;
  };
  const spellsFor = (target?: RulesetId): Spell[] =>
    [...spellVersions.values()].map(v => resolveSpell(v, target)).filter((s): s is Spell => !!s);
  const spellIndex: Spell[] = [...spellVersions.values()].map(versions => {
    const base = resolveSpell(versions) as Spell;
    const classes = [...new Set(versions.flatMap(v => v.classes ?? []))];
    return classes.length > 0 ? { ...base, classes } : base;
  });
  // Items are shared across rulesets (a Longsword is a Longsword): every installed pack's, merged by id.
  const items = mergeById(ordered.map(p => ((p.homebrew?.items ?? []) as unknown as Item[])));
  const itemById = index(items);
  // Conditions keep every edition's record (same ids, told apart by ruleset); a record with no ruleset of its own belongs to no one edition.
  const conditionRecords = ordered.flatMap(p => ((p.homebrew?.conditions ?? []) as unknown as Condition[]).filter(c => matchesRuleset(c.rulesetId, rulesetId)));

  return {
    source: ordered.map(p => `pack:${p.manifest.id}@${p.manifest.version}`).join('+'),
    rulesetId,
    classes: () => classes, getClass: id => classById.get(id),
    subclasses: () => subclasses,
    subclassesOf: classId => subclasses.filter(s => s.classId === classId),
    getSubclass: id => subclassById.get(id),
    races: () => races, getRace: id => raceById.get(id),
    backgrounds: () => backgrounds, getBackground: id => backgroundById.get(id),
    feats: () => feats, getFeat: id => featById.get(id),
    spells: target => spellsFor(target ?? rulesetId),
    getSpell: (id, target) => resolveSpell(spellVersions.get(id) ?? [], target ?? rulesetId),
    spellIndexSpells: () => spellIndex,
    items: () => items,
    conditionRecords: () => conditionRecords,
    getCondition: (id, target) => conditionForRuleset(conditionRecords, id, target ?? rulesetId),
    // An id the packs do not have falls back to its other edition (a 5e `longsword` reference on a 5.5e character, or the reverse).
    getItem: id => itemById.get(id) ?? itemById.get(is2024ItemId(id) ? baseItemId(id) : editionItemId(id)),
  };
}
