// ============================================================================
// FILE: src/content/requiredPacks.ts
// Which content packs a character or a campaign needs. A character stores the ids and versions of the packs its class, subclass,
// species, background, feats, spells and items come from (`Entity.requiredPacks`), so an export, a backup or a character opened on
// another device can say "this needs SRD 5.2.1" instead of silently losing content, and removing a pack never forgets what the
// character was built from (the stored list only grows: what is installed now is merged into it, never subtracted from it).
// A campaign names the packs its ruleset needs (`Campaign.requiredPacks`) and a player joining is told what they lack.
// Pure functions over the installed packs; the content a pack carries is read from the pack itself.
// ============================================================================
import type { Entity, RulesetId } from '../engine/types';
import type { RequiredPack } from '../engine/contentPackManifest';
import { compareVersions } from '../engine/contentPackManifest';
import type { InstalledPack } from './provider/contentProvider';
import { getClassLevels } from '../engine/multiclass';

type Ids = Record<string, Set<string>>;

const packIds = (p: InstalledPack): Ids => {
  const h = (p.homebrew ?? {}) as unknown as Record<string, { id: string }[]>;
  const out: Ids = {};
  for (const key of ['classes', 'subclasses', 'races', 'backgrounds', 'feats', 'spells', 'items']) out[key] = new Set((h[key] ?? []).map(r => r.id));
  return out;
};

/** The content ids a character references, by pack category. */
export function contentRefsOf(entity: Entity): Record<string, string[]> {
  const classes = getClassLevels(entity);
  const items = [...(entity.inventory?.equipped ?? []), ...(entity.inventory?.carried ?? [])].map(i => i.itemId);
  return {
    classes: classes.map(c => String(c.classId)),
    subclasses: classes.map(c => (c.subclassId ? String(c.subclassId) : '')).filter(Boolean),
    races: [entity.identity.raceId, entity.identity.subRaceId ?? ''].filter(Boolean),
    backgrounds: entity.identity.backgroundId ? [entity.identity.backgroundId] : [],
    feats: entity.features.filter(f => f.source.kind === 'feat').map(f => f.source.refId),
    spells: [...(entity.spellcasting?.cantrips ?? []), ...(entity.spellcasting?.known ?? []), ...(entity.spellcasting?.prepared ?? [])],
    items,
  };
}

/** Adds the entries of `more` to `base`, keeping the higher minimum version of a pack named in both. */
export function mergeRequiredPacks(base: readonly RequiredPack[] | undefined, more: readonly RequiredPack[]): RequiredPack[] {
  const byId = new Map<string, RequiredPack>();
  for (const r of [...(base ?? []), ...more]) {
    const have = byId.get(r.id);
    if (!have) byId.set(r.id, { ...r });
    else if (r.minVersion && (!have.minVersion || compareVersions(r.minVersion, have.minVersion) > 0)) have.minVersion = r.minVersion;
  }
  return [...byId.values()].sort((a, b) => a.id.localeCompare(b.id));
}

/**
 * The installed packs a character's content comes from, with the installed version as the minimum. Where several packs carry the
 * same id (a Longsword in two packs) the one written for the character's own ruleset is the one it needs.
 */
export function requiredPacksFor(entity: Pick<Entity, 'identity' | 'features' | 'spellcasting' | 'inventory' | 'rulesetId'> & Entity, packs: readonly InstalledPack[]): RequiredPack[] {
  if (packs.length === 0) return [];
  const own = (entity.rulesetId as string | undefined) ?? 'dnd5e-2014';
  const ids = packs.map(p => ({ pack: p, ids: packIds(p) }));
  const needed = new Set<InstalledPack>();
  for (const [category, refs] of Object.entries(contentRefsOf(entity))) {
    for (const ref of new Set(refs)) {
      const carrying = ids.filter(x => x.ids[category]?.has(ref));
      if (carrying.length === 0) continue;
      const preferred = carrying.find(x => x.pack.manifest.ruleset === own) ?? carrying[0];
      needed.add(preferred.pack);
    }
  }
  return [...needed].map(p => ({ id: p.manifest.id, minVersion: p.manifest.version })).sort((a, b) => a.id.localeCompare(b.id));
}

/** A character with what it needs recorded (what it already recorded, plus what the installed packs say it uses). */
export function withRequiredPacks<T extends Entity>(entity: T, packs: readonly InstalledPack[]): T {
  const merged = mergeRequiredPacks(entity.requiredPacks, requiredPacksFor(entity, packs));
  if (merged.length === 0) return entity;
  const same = JSON.stringify(merged) === JSON.stringify(entity.requiredPacks ?? []);
  return same ? entity : { ...entity, requiredPacks: merged };
}

export type PackShortfall = { id: string; minVersion?: string; installedVersion?: string; problem: 'missing' | 'too_old' };

/** What is required but not installed (or installed too old). */
export function packShortfalls(required: readonly RequiredPack[] | undefined, packs: readonly InstalledPack[]): PackShortfall[] {
  const installed = new Map(packs.map(p => [p.manifest.id, p.manifest.version]));
  const out: PackShortfall[] = [];
  for (const r of required ?? []) {
    const v = installed.get(r.id);
    if (v === undefined) out.push({ id: r.id, ...(r.minVersion ? { minVersion: r.minVersion } : {}), problem: 'missing' });
    else if (r.minVersion && compareVersions(v, r.minVersion) < 0) out.push({ id: r.id, minVersion: r.minVersion, installedVersion: v, problem: 'too_old' });
  }
  return out;
}

/** The packs a campaign of this ruleset needs from the installed ones: the edition's SRD pack and what it depends on. */
export function requiredPacksForRuleset(ruleset: RulesetId | string | undefined, packs: readonly InstalledPack[]): RequiredPack[] {
  if (!ruleset) return [];
  const byId = new Map(packs.map(p => [p.manifest.id, p]));
  const out = new Map<string, RequiredPack>();
  const add = (p: InstalledPack) => {
    if (out.has(p.manifest.id)) return;
    out.set(p.manifest.id, { id: p.manifest.id, minVersion: p.manifest.version });
    for (const d of p.manifest.dependencies) { const dep = byId.get(d.id); if (dep) add(dep); }
  };
  for (const p of packs) if (p.manifest.ruleset === ruleset && p.manifest.officialFirstPartyPack && p.manifest.license === 'CC-BY-4.0') add(p);
  return [...out.values()].sort((a, b) => a.id.localeCompare(b.id));
}

/** A readable line for a shortfall. */
export function describeShortfall(s: PackShortfall): string {
  return s.problem === 'missing' ? `${s.id}${s.minVersion ? ` ${s.minVersion}+` : ''} is not installed` : `${s.id} ${s.installedVersion} is older than the ${s.minVersion} this needs`;
}
