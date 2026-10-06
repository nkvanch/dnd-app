// ============================================================================
// FILE: src/content/officialPacks.ts
// Installs content packs as the app's official catalog. `activateOfficialPacks` validates the packs (envelope, manifest,
// dependencies, versions) and, only if all of them are usable, makes them the official source (officialSource.ts), so
// the creation screens and every other reader of the official catalog serve pack content. If anything is wrong it
// changes nothing and returns the problems, so a bad pack can never leave the app with half a catalog.
// Where the pack files come from (bundled, downloaded, imported) is the install step of docs/SRD_PACKS.md, not this file.
// ============================================================================
import { packContentProvider, InstalledPack, PackProviderError } from './provider/contentProvider';
import { getOfficialContentProvider, setOfficialContentProvider } from './officialSource';

export type OfficialPacksResult =
  | { ok: true; source: string; packs: { id: string; version: string }[] }
  | { ok: false; problems: string[] };

export function activateOfficialPacks(packs: readonly unknown[]): OfficialPacksResult {
  const problems: string[] = [];
  const usable: InstalledPack[] = [];
  packs.forEach((p, i) => {
    const pack = p as Partial<InstalledPack> | null;
    if (!pack || typeof pack !== 'object' || !pack.manifest) problems.push(`Pack ${i + 1} has no manifest, so it is not an installable content pack.`);
    else usable.push(pack as InstalledPack);
  });
  if (problems.length > 0) return { ok: false, problems };
  try {
    const provider = packContentProvider(usable);
    setOfficialContentProvider(provider);
    return { ok: true, source: provider.source, packs: usable.map(p => ({ id: p.manifest.id, version: p.manifest.version })) };
  } catch (error) {
    if (error instanceof PackProviderError) return { ok: false, problems: [error.message] };
    throw error;
  }
}

/** Back to the hardcoded catalog. */
export function clearOfficialPacks(): void {
  setOfficialContentProvider(null);
}

export const officialPacksInstalled = (): boolean => getOfficialContentProvider() !== null;
