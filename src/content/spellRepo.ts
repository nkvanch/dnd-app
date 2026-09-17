// ============================================================================
// FILE: src/content/spellRepo.ts
// Default implementation — thin synchronous wrapper around the existing
// static spell arrays (src/content/spells/index.ts). Metro's platform-
// extension resolution picks spellRepo.native.ts instead of this file on
// iOS/Android builds (see that file for the real SQLite-backed
// implementation); this file is what `expo start --web` actually bundles,
// so web behavior — including full data always resident, no lazy loading —
// is unchanged from before this migration.
// ============================================================================
import { Spell } from '../engine/types';
import { ALL_SPELLS } from './spells/index';
import type { SpellIndexEntry, SpellRepo } from './spellRepo.types';

const spellById = new Map<string, Spell>(ALL_SPELLS.map(s => [s.id, s]));

const index: SpellIndexEntry[] = ALL_SPELLS.map(s => ({
  id:            s.id,
  name:          s.name,
  level:         s.level,
  school:        s.school,
  castingTime:   s.castingTime,
  ritual:        s.ritual,
  concentration: s.concentration,
  classes:       s.classes,
  srd:           s.srd,
  rulesetId:     s.rulesetId,
  components:    s.components,
}));

export const spellRepo: SpellRepo = {
  async init() { /* no-op — the static arrays are already in memory */ },
  getIndex() { return index; },
  async ensureLoaded() { /* no-op — everything is already resident */ },
  getSpellSync(id) { return spellById.get(id); },
};
