// ============================================================================
// FILE: src/content/officialPackService.ts
// Install, remove and restore first-party content packs (the SRD packs) the way a homebrew package is imported: the
// player picks a `.grimoire-pack` file, sees what it is, and confirms. A pack is only installed if it is a valid pack,
// its content hash matches its manifest, its content passes the same validation as any imported pack, and the packs
// installed together still resolve (dependencies present and new enough). Install and removal are all or nothing; the
// official catalog is never left half changed. Storage is injected (the SQLite table in the app, memory in tests).
//
// Authenticity is not checked: the content hash proves the file is intact, not who made it. Importing a pack is the
// player's own decision, as importing homebrew is.
// ============================================================================
import { validateGrimoirePack, validatePackContents } from '../engine/backup';
import { compareVersions, packHashInput, validateManifest, ContentPackManifest } from '../engine/contentPackManifest';
import { sha256Hex } from '../engine/sha256';
import { packContentProvider, PackProviderError, type InstalledPack } from './provider/contentProvider';
import { activateOfficialPacks, clearOfficialPacks } from './officialPacks';

export type PackStore = {
  save(id: string, version: string, pack: unknown): Promise<void>;
  load(): Promise<{ id: string; version: string; pack: unknown }[]>;
  remove(id: string): Promise<void>;
};

let installed: InstalledPack[] = [];
let listeners: (() => void)[] = [];

export const installedOfficialPacks = (): readonly InstalledPack[] => installed;
/** Calls back whenever the installed packs change (install, update, remove, boot). Returns the unsubscribe. */
export function onOfficialPacksChanged(fn: () => void): () => void {
  listeners = [...listeners, fn];
  return () => { listeners = listeners.filter(l => l !== fn); };
}
const changed = () => listeners.forEach(l => l());

/** Whether a parsed file is a first-party content pack (as opposed to a homebrew package or a backup). */
export function isOfficialPackFile(data: unknown): data is InstalledPack {
  const m = (data as { manifest?: Partial<ContentPackManifest> } | null)?.manifest;
  return !!m && typeof m === 'object' && m.officialFirstPartyPack === true;
}

export type OfficialPackPreview =
  | {
      ok: true;
      pack: InstalledPack;
      manifest: ContentPackManifest;
      /** 'install': new. 'update': another version of this pack is installed. 'same': this exact version is installed. */
      action: 'install' | 'update' | 'same';
      previousVersion?: string;
      /** Plain-language consequences to show before the player confirms. */
      notes: string[];
    }
  | { ok: false; problems: string[] };

const LABEL = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** Everything that must hold before a pack is installed. Pure: reads the file and the installed list only. */
export function previewOfficialPack(data: unknown, current: readonly InstalledPack[] = installed): OfficialPackPreview {
  const envelope = validateGrimoirePack(data);
  if (envelope) return { ok: false, problems: [envelope] };
  if (!isOfficialPackFile(data)) return { ok: false, problems: ['This is not a first-party content pack.'] };
  const pack = data;
  const manifestProblems = validateManifest(pack.manifest);
  if (manifestProblems.length > 0) return { ok: false, problems: manifestProblems };
  if (sha256Hex(packHashInput(pack as { homebrew?: unknown; rules?: unknown })) !== pack.manifest.contentHash) {
    return { ok: false, problems: ['The pack’s content does not match its content hash, so it was changed or damaged. It was not installed.'] };
  }
  const contentProblems = validatePackContents(pack);
  if (contentProblems.length > 0) {
    return { ok: false, problems: [`The pack’s content is not valid (${contentProblems.length} problem${contentProblems.length === 1 ? '' : 's'}):`, ...contentProblems.slice(0, 4)] };
  }
  const others = current.filter(p => p.manifest.id !== pack.manifest.id);
  const resolved = activateCheck([...others, pack]);
  if (resolved.length > 0) return { ok: false, problems: resolved };

  const existing = current.find(p => p.manifest.id === pack.manifest.id);
  const action = !existing ? 'install' : compareVersions(existing.manifest.version, pack.manifest.version) === 0 ? 'same' : 'update';
  const counts = pack.manifest.counts;
  const notes = [
    `${pack.manifest.name} ${pack.manifest.version} (${pack.manifest.ruleset}): ${Object.entries(counts).map(([k, v]) => LABEL(v, k.replace(/s$/, ''), k)).join(', ')}.`,
    'Installing makes the pack the app’s official content: races, classes, backgrounds, feats, subclasses, spells and items come from installed packs instead of the built-in catalog. Anything the packs do not contain (for example a non-SRD class) is hidden until you remove them. Your homebrew and your characters are not changed.',
  ];
  if (action === 'update') notes.push(`This replaces version ${existing!.manifest.version}.`);
  if (pack.manifest.dependencies.length > 0) notes.push(`Needs: ${pack.manifest.dependencies.map(d => `${d.id}${d.minVersion ? ' ' + d.minVersion + '+' : ''}`).join(', ')} (installed).`);
  return { ok: true, pack, manifest: pack.manifest, action, previousVersion: existing?.manifest.version, notes };
}

/** Problems that stop this set of packs resolving (a missing or too-old dependency, a cycle), without activating anything. */
function activateCheck(packs: readonly InstalledPack[]): string[] {
  // The provider orders and checks the set; building one has no side effects.
  try { packContentProvider(packs); return []; }
  catch (e) { if (e instanceof PackProviderError) return [e.message]; throw e; }
}

export type ServiceResult = { ok: true } | { ok: false; problems: string[] };

export async function installOfficialPack(data: unknown, store: PackStore): Promise<ServiceResult> {
  const preview = previewOfficialPack(data);
  if (!preview.ok) return preview;
  const others = installed.filter(p => p.manifest.id !== preview.manifest.id);
  const result = activateOfficialPacks([...others, preview.pack]);
  if (!result.ok) return { ok: false, problems: result.problems };
  try {
    await store.save(preview.manifest.id, preview.manifest.version, preview.pack);
  } catch (e) {
    // The pack is active but could not be kept: put the catalog back as it was and say so.
    if (installed.length > 0) activateOfficialPacks(installed); else clearOfficialPacks();
    return { ok: false, problems: [`The pack could not be saved: ${e instanceof Error ? e.message : String(e)}`] };
  }
  installed = [...others, preview.pack];
  changed();
  return { ok: true };
}

/** Removes a pack. Refused if another installed pack needs it. Removing the last pack restores the built-in catalog. */
export async function removeOfficialPack(id: string, store: PackStore): Promise<ServiceResult> {
  const target = installed.find(p => p.manifest.id === id);
  if (!target) return { ok: false, problems: ['That pack is not installed.'] };
  const dependents = installed.filter(p => p.manifest.id !== id && p.manifest.dependencies.some(d => d.id === id));
  if (dependents.length > 0) {
    return { ok: false, problems: [`${dependents.map(d => d.manifest.name).join(', ')} needs ${target.manifest.name}. Remove ${dependents.length === 1 ? 'it' : 'them'} first.`] };
  }
  const rest = installed.filter(p => p.manifest.id !== id);
  if (rest.length === 0) clearOfficialPacks();
  else {
    const result = activateOfficialPacks(rest);
    if (!result.ok) return { ok: false, problems: result.problems };
  }
  await store.remove(id);
  installed = rest;
  changed();
  return { ok: true };
}

/**
 * At app start: reads the stored packs and makes them the official catalog. Never throws and never blocks the app: if
 * the stored packs do not resolve, the built-in catalog stays and the problem is logged.
 */
export async function bootOfficialPacks(store: PackStore): Promise<ServiceResult> {
  try {
    const stored = await store.load();
    if (stored.length === 0) { installed = []; changed(); return { ok: true }; }
    const packs = stored.map(s => s.pack as InstalledPack);
    const result = activateOfficialPacks(packs);
    if (!result.ok) { console.error('[officialPacks] Stored packs were not used:', result.problems); return { ok: false, problems: result.problems }; }
    installed = packs;
    changed();
    return { ok: true };
  } catch (e) {
    console.error('[officialPacks] Could not restore installed packs:', e);
    return { ok: false, problems: [e instanceof Error ? e.message : String(e)] };
  }
}

/** Test seam: forget the in-memory list (the official source is cleared separately). */
export function resetOfficialPackService(): void { installed = []; listeners = []; }
