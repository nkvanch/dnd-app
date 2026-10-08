// ============================================================================
// FILE: src/content/packRepos.ts
// Lets the spell and item repos serve installed packs. Both repos (the in-memory web ones and the SQLite-backed native
// ones) are wrapped with these: while no pack is the official source they pass straight through to the repo they wrap;
// once one is (officialSource.ts), the index and the full records come from the provider instead, and the repo's own
// store is not consulted. Everything that reads spells and items through the repos (entitlements, action cards, the
// pickers, the pipeline) therefore follows the packs with no change of its own.
// ============================================================================
import type { Item, Spell } from '../engine/types';
import { getOfficialContentProvider, officialContentVersion } from './officialSource';
import type { SpellIndexEntry, SpellRepo } from './spellRepo.types';
import { toItemIndexEntry } from './itemRepo.types';
import type { ItemIndexEntry, ItemRepo } from './itemRepo.types';

/**
 * Homebrew classes (the built-in Emperor Warlock) draw on spell lists they do not own, so the spells on those lists carry
 * the homebrew class's id as an extra tag. Packs never name homebrew classes, so the tags are added here, at read time,
 * by whatever registers them (the homebrew class's own module), instead of being baked into pack content.
 */
type SpellTagOverlay = (spell: Spell) => readonly string[];
let tagOverlays: SpellTagOverlay[] = [];
export function registerSpellTagOverlay(overlay: SpellTagOverlay): void { tagOverlays = [...tagOverlays, overlay]; }
const withOverlayTags = (s: Spell): Spell => {
  if (tagOverlays.length === 0 || !s.classes || s.classes.length === 0) return s;   // an untagged spell is already offered to every class
  const extra = tagOverlays.flatMap(o => o(s)).filter(t => !s.classes!.includes(t));
  return extra.length > 0 ? { ...s, classes: [...s.classes, ...extra] } : s;
};

const toSpellIndexEntry = (s: Spell): SpellIndexEntry => ({
  id: s.id, name: s.name, level: s.level, school: s.school, castingTime: s.castingTime, ritual: s.ritual,
  concentration: s.concentration, classes: s.classes, srd: s.srd, rulesetId: s.rulesetId, components: s.components,
});

const overlayCache = new WeakMap<Spell, Spell>();
function withOverlayTagsCached(s: Spell | undefined): Spell | undefined {
  if (!s) return s;
  const hit = overlayCache.get(s);
  if (hit) return hit;
  const out = withOverlayTags(s);
  overlayCache.set(s, out);
  return out;
}

export function withOfficialSpells(base: SpellRepo): SpellRepo {
  let builtFor = -1;
  let built: SpellIndexEntry[] = [];
  return {
    init: () => base.init(),
    getIndex() {
      const provider = getOfficialContentProvider();
      if (!provider) return base.getIndex();
      if (builtFor !== officialContentVersion()) {
        built = provider.spellIndexSpells().map(withOverlayTags).map(toSpellIndexEntry);
        builtFor = officialContentVersion();
      }
      return built;
    },
    ensureLoaded: ids => getOfficialContentProvider() ? Promise.resolve() : base.ensureLoaded(ids),
    getSpellSync(id, rulesetId) {
      const provider = getOfficialContentProvider();
      return provider ? withOverlayTagsCached(provider.getSpell(id, rulesetId ?? undefined)) : base.getSpellSync(id, rulesetId);
    },
  };
}

export function withOfficialItems(base: ItemRepo): ItemRepo {
  let builtFor = -1;
  let built: ItemIndexEntry[] = [];
  return {
    init: () => base.init(),
    getIndex() {
      const provider = getOfficialContentProvider();
      if (!provider) return base.getIndex();
      if (builtFor !== officialContentVersion()) {
        built = provider.items().map((i: Item) => toItemIndexEntry(i));
        builtFor = officialContentVersion();
      }
      return built;
    },
    ensureLoaded: ids => getOfficialContentProvider() ? Promise.resolve() : base.ensureLoaded(ids),
    getItemSync(id) {
      const provider = getOfficialContentProvider();
      return provider ? provider.getItem(id) : base.getItemSync(id);
    },
  };
}
