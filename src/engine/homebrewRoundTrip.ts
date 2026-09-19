/** Merge editor-owned output over persisted content while retaining unsupported fields. */
export function mergeHomebrewDefinition<T extends Record<string, unknown>>(
  original: T | null | undefined,
  edited: T,
): T {
  if (!original) return edited;
  const originalDraft = original.homebrewDraft;
  const editedDraft = edited.homebrewDraft;
  return {
    ...original,
    ...edited,
    ...(originalDraft && typeof originalDraft === 'object' && !Array.isArray(originalDraft)
      && editedDraft && typeof editedDraft === 'object' && !Array.isArray(editedDraft)
      ? { homebrewDraft: { ...originalDraft, ...editedDraft } }
      : {}),
  } as T;
}

/** Preserve exact structured progression when the editor surface did not change it. */
export function mergeSubclassDefinition<T extends Record<string, unknown> & { entries: unknown[] }>(
  original: T | null | undefined,
  edited: T,
  progressionChanged: boolean,
): T {
  const merged = mergeHomebrewDefinition(original, edited);
  return original && !progressionChanged ? { ...merged, entries: original.entries } : merged;
}
