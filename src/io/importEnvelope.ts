export type GrimoireImportKind = 'character' | 'homebrew-package' | 'unknown';

export function identifyGrimoireImport(value: unknown): GrimoireImportKind {
  if (!value || typeof value !== 'object') return 'unknown';
  const data = value as Record<string, unknown>;
  if (data.format === 'grimoire-character') return 'character';
  if (data.packType === 'content-pack' || (typeof data.formatVersion === 'number' && data.homebrew && typeof data.homebrew === 'object')) return 'homebrew-package';
  return 'unknown';
}

export const WRONG_CHARACTER_IMPORTER_MESSAGE =
  'This is a Homebrew package. Import it from Homebrew → Import Homebrew.';
export const WRONG_HOMEBREW_IMPORTER_MESSAGE =
  'This is a Grimoire Character file, not a Homebrew package. Import it from Characters → Import Character.';
