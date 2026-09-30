// src/engine/packageImportFlow.ts
// Pure state model for the Import Homebrew screen's "is this a new import or an
// update of an installed pack?" question, kept out of the screen so it is
// directly testable.
//
// The screen used to overload one value: `updateChoice === 'update'` meant BOTH
// "the player chose to update the pack that is already installed" AND "there is
// nothing installed to update, so no choice is needed". That made every first
// import read `Updating installed pack ""` with an "Update" button. 'new' is now
// its own state.
export type ImportMode =
  /** A same-id pack IS installed; waiting for the player to pick update vs copy. */
  | null
  /** No installed pack matches: an ordinary first-time import. */
  | 'new'
  /** The player chose to update the installed pack. */
  | 'update'
  /** The player chose to install alongside the installed pack under a fresh id. */
  | 'copy';

/** The mode a freshly picked package starts in. */
export function initialImportMode(match: { id: string } | null): ImportMode {
  return match ? null : 'new';
}

/** True only when the import really replaces an installed pack the player chose to update. */
export function isUpdatingInstalledPack(mode: ImportMode, target: { name: string } | null): boolean {
  return mode === 'update' && target !== null;
}

/** The "Updating installed pack …" line, or null when this is not an update. */
export function updatingBannerText(mode: ImportMode, target: { name: string } | null): string | null {
  return isUpdatingInstalledPack(mode, target) ? `Updating installed pack "${target!.name}"` : null;
}

/** Wording of the confirm button. */
export function importConfirmLabel(mode: ImportMode, target: { name: string } | null, totalItems: number): string {
  if (isUpdatingInstalledPack(mode, target)) return 'Update';
  return totalItems > 1 ? 'Import All' : 'Import';
}
