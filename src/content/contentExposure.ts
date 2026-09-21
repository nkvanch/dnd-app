import type { ContentTypeId } from './contentQuery';

export type ContentExposureContext = { srdOnly: boolean };
export type ExposableContent = { srd?: boolean; isHomebrew?: boolean; type?: ContentTypeId };

export function currentContentExposure(): ContentExposureContext {
  return { srdOnly: process.env.EXPO_PUBLIC_SRD_ONLY === 'true' };
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
