// src/content/provenance.ts
// PROVENANCE-1: a single, coherent representation answering the 4 distinct
// questions Source/Pack/Official-Homebrew filtering actually needs:
//   - What ruleset is this for?        → rulesetId (already a real field
//                                         on most content types)
//   - Where did this definition come   → sourceLabel (a sourcebook name for
//     from?                              official content; "Local Homebrew"
//                                         or an installed pack's name for
//                                         homebrew)
//   - Which installed pack owns it?    → packId/packLabel (only set for
//                                         imported homebrew)
//   - Is it official or homebrew?      → originKind
//
// Deliberately a DERIVED, computed-at-query-time shape, not 4 new stored
// fields duplicated onto every content definition (~1000+ hand-authored
// content literals across src/content/**). Every input it reads is already
// authoritative: rulesetId (existing per-type field), srd (existing
// per-type field), Feat.source (the one content type with a real per-item
// sourcebook field already), homebrew-store membership (the established
// Official/Homebrew derivation used everywhere else in this app), and the
// pack-ownership index (src/db/packRegistryRepo.ts's
// buildPackOwnershipIndex(), itself derived from InstalledPack.itemRefs —
// the one authoritative pack registry). No new field means no new place
// for the truth to drift from its source.
import { RulesetId, ContentHeader } from '../engine/types';

export type ContentOriginKind = 'official' | 'local_homebrew' | 'imported_homebrew';

export type ContentProvenance = {
  rulesetId?:   RulesetId;
  sourceLabel?: string;
  packId?:      string;
  packLabel?:   string;
  originKind:   ContentOriginKind;
};

export function getContentProvenance(
  content: Partial<ContentHeader> & { source?: string },
  opts: {
    isHomebrew: boolean;
    /** `${ContentCacheType}:${id}` -> pack, from buildPackOwnershipIndex(). Omit/undefined when not applicable (e.g. official content, or a content type packs don't track). */
    packOwnership?: Map<string, { packId: string; packName: string }>;
    /** This content item's own `${ContentCacheType}:${id}` key, for the packOwnership lookup above. */
    ownershipKey?: string;
  },
): ContentProvenance {
  const pack = opts.isHomebrew && opts.ownershipKey ? opts.packOwnership?.get(opts.ownershipKey) : undefined;

  const originKind: ContentOriginKind = !opts.isHomebrew
    ? 'official'
    : pack ? 'imported_homebrew' : 'local_homebrew';

  // Feat.source is the one content type with a REAL per-item sourcebook
  // field already (distinct from Official/Homebrew — see its own doc
  // comment in engine/types.ts) — prefer it when present, for either
  // official or homebrew content (a homebrew feat's author-set `source`
  // string, e.g. a custom sourcebook name, is just as real as an official
  // one's PHB/XGE/etc constant).
  let sourceLabel: string | undefined = content.source;
  if (!sourceLabel) {
    if (originKind === 'official') {
      // No per-item sourcebook field exists for any other content type —
      // the SRD flag is the one deterministic thing we can derive: SRD
      // content is confirmed to be from SRD 5.1; anything else's specific
      // sourcebook (Xanathar's, Tasha's, ...) isn't tracked per-item
      // anywhere in this engine, so sourceLabel stays undefined rather
      // than guessing which non-SRD book it came from.
      sourceLabel = content.srd === true ? 'SRD 5.1' : undefined;
    } else if (originKind === 'imported_homebrew') {
      sourceLabel = pack!.packName;
    } else {
      sourceLabel = 'Local Homebrew';
    }
  }

  return {
    rulesetId: content.rulesetId,
    sourceLabel,
    packId:    pack?.packId,
    packLabel: pack?.packName,
    originKind,
  };
}
