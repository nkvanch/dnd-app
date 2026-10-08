// ============================================================================
// FILE: src/content/firstRunPacks.ts
// With the built-in catalog gone the app has no content until packs are installed, so the first time it runs with none installed
// it installs the SRD packs that ship with it (signed, checked like any install). It happens once per device: afterwards a player who
// removes the packs gets what they asked for, and the Packages screen can install them again.
// ============================================================================
import { BUNDLED_PACKS, installBundledPacks } from './bundledPacks';
import { installedOfficialPacks, PackStore } from './officialPackService';

export const AUTO_INSTALL_KEY = 'bundled_packs_auto_installed_v1';

export type MetaStore = { get(key: string): Promise<string | null>; set(key: string, value: string): Promise<void> };

/** Installs every bundled pack once when nothing is installed. Returns whether it did. Never throws: a failure leaves the app as it was and tries again next launch. */
export async function ensureBundledPacks(store: PackStore, meta: MetaStore): Promise<boolean> {
  try {
    if (installedOfficialPacks().length > 0) { await meta.set(AUTO_INSTALL_KEY, '1'); return false; }
    if ((await meta.get(AUTO_INSTALL_KEY)) === '1') return false;
    const result = await installBundledPacks(BUNDLED_PACKS.map(p => p.id), store);
    if (!result.ok) { console.error('[firstRunPacks] could not install the bundled packs:', result.problems.join(' ')); return false; }
    await meta.set(AUTO_INSTALL_KEY, '1');
    return true;
  } catch (e) {
    console.error('[firstRunPacks] failed:', e);
    return false;
  }
}
