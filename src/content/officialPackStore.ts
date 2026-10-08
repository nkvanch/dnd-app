// ============================================================================
// FILE: src/content/officialPackStore.ts
// The app's real pack storage (the official_packs SQLite table), in the shape the pack service takes.
// ============================================================================
import type { PackStore } from './officialPackService';
import { saveOfficialPack, loadOfficialPacks, deleteOfficialPack } from '../db/officialPackRepo';

export const sqlitePackStore: PackStore = {
  save: saveOfficialPack,
  load: async () => (await loadOfficialPacks()).map(p => ({ id: p.id, version: p.version, pack: p.pack })),
  remove: deleteOfficialPack,
};
