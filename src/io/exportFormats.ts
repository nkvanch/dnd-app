// src/io/exportFormats.ts
// The export options offered for each KIND of thing being exported. Pure data
// (no React), so the labels are unit-testable. Three distinct concepts:
//   Export Character  one character, its own portable file
//   Export Homebrew   one Homebrew entry plus what it requires (a .grimoire-pack)
//   Export Package    several chosen entries (Package Builder; not a per-entry option)
import type { ExportFormat } from './exportShare';

export type ExportFormatOption = { id: ExportFormat; label: string; hint: string };

// The three human-readable copies are the same for both kinds of export.
const READABLE: ExportFormatOption[] = [
  { id: 'pdf', label: '📄  PDF',      hint: 'Readable copy, printable and shareable (not importable)' },
  { id: 'md',  label: '📝  Markdown', hint: 'Readable copy for Discord, notes apps, wikis (not importable)' },
  { id: 'txt', label: '📃  Plain Text', hint: 'Readable copy, no formatting (not importable)' },
];

/** Each export kind has exactly ONE portable, re-importable option, labelled for what it is. */
const PORTABLE: Record<ExportKind, ExportFormatOption> = {
  character: { id: 'character-json', label: '⇄  Export Character', hint: 'One character, for another Grimoire install (Characters → Import Character)' },
  homebrew:  { id: 'pack',           label: '📦  Export Homebrew', hint: 'This one entry plus what it needs (Homebrew → Import Homebrew)' },
};

/** What is being exported. A Homebrew entry is never offered the Character format, and vice versa. */
export type ExportKind = 'character' | 'homebrew';

export function exportFormatsFor(kind: ExportKind): ExportFormatOption[] {
  return [PORTABLE[kind], ...READABLE];
}

