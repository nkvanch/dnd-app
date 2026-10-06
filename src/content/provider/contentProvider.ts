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
import type { GrimoirePack } from '../../engine/backup';
import { validateGrimoirePack } from '../../engine/backup';
import { ContentPackManifest, compareVersions, validateManifest } from '../../engine/contentPackManifest';
import type { Background, CharClass, ClassProgression, Feat, Race, RulesetId, Spell } from '../../engine/types';
import { matchesRuleset } from '../../engine/types';

/** A subclass as packs carry it: the class's progression shape plus its own id and name. */
export type ProviderSubclass = ClassProgression & { id: string; name: string; rulesetId?: RulesetId };

export interface ContentProvider {
  /** Where the content came from, for diagnostics and tests: "pack:grimoire.srd.5.2.1@1.0.0" or "static". */
  readonly source: string;
  readonly rulesetId: RulesetId;
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
  spells(): readonly Spell[];
  getSpell(id: string): Spell | undefined;
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

/** A provider over installed packs, for one ruleset. A later pack replaces an earlier record with the same id. */
export function packContentProvider(packs: readonly InstalledPack[], rulesetId: RulesetId): ContentProvider {
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
  const spells = pick<Spell>('spells');
  const index = <T extends { id: string }>(list: readonly T[], key: (x: T) => string = x => x.id) => new Map(list.map(x => [key(x), x]));
  const classById = index(classes), subclassById = index(subclasses, subclassKey), raceById = index(races),
    backgroundById = index(backgrounds), featById = index(feats), spellById = index(spells);

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
    spells: () => spells, getSpell: id => spellById.get(id),
  };
}
