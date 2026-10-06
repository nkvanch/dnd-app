import type { ContentTypeId } from './contentQuery';
import { getOfficialContentProvider } from './officialSource';

export type ContentExposureContext = { srdOnly: boolean };
export type ExposableContent = { srd?: boolean; isHomebrew?: boolean; type?: ContentTypeId };

// The build mode is fixed for the app's lifetime (decided when this module loads); only the official source can change.
const SRD_ONLY_BUILD = process.env.EXPO_PUBLIC_SRD_ONLY === 'true';

export function currentContentExposure(): ContentExposureContext {
  // Live, not a snapshot: screens keep this in a module-level constant, and the official source can change while the app
  // runs (installing a pack). Content installed from a pack is distributed under the pack's own provenance, so the
  // SRD 5.1 flag filter does not apply to it (it would hide every 2024 record, which carries source-family provenance
  // instead of that flag).
  return { get srdOnly() { return SRD_ONLY_BUILD && getOfficialContentProvider() === null; } };
}

/** Central ordinary-browser exposure decision. Bundled data remains stored.
 * Homebrew keeps its separate visibility semantics. Conditions have no SRD
 * field in the canonical model and are part of the supported rules vocabulary. */
export function isContentExposed(content: ExposableContent, context: ContentExposureContext): boolean {
  if (content.isHomebrew || !context.srdOnly) return true;
  if (content.type === 'condition') return true;
  return content.srd === true;
}

/** Filter exposure first so subsequent search and facets cannot restore a
 * hidden definition. Useful to every browsing surface and directly testable. */
export function selectExposedContent<T extends ExposableContent>(
  content: readonly T[],
  context: ContentExposureContext,
  search: (entry: T) => boolean = () => true,
  filter: (entry: T) => boolean = () => true,
): T[] {
  return content.filter(entry => isContentExposed(entry, context)).filter(search).filter(filter);
}

/** The one exposure rule for a race's nested subraces. A public base race stays
 * visible even when some of its subraces are not SRD; only `srd === true`
 * subraces survive in SRD-only mode (unknown/false → hidden). Full builds keep
 * everything, and homebrew subraces (per `isHomebrew`) keep their own
 * visibility. Resolving a saved character's subrace by id is deliberately NOT
 * routed through this: hiding is a browsing decision, not a data deletion. */
export function exposedSubraces<T extends { srd?: boolean }>(
  subraces: readonly T[] | undefined,
  context: ContentExposureContext,
  isHomebrew: (subrace: T) => boolean = () => false,
): T[] {
  return (subraces ?? []).filter(sr => isContentExposed({ srd: sr.srd, isHomebrew: isHomebrew(sr), type: 'subrace' }, context));
}
