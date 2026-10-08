// ============================================================================
// FILE: src/content/rules/rulesReference.ts
// The Rules Reference: the SRD 5.2.1 glossary, gameplay toolbox and equipment rules, carried in the `rules.reference` bag of the
// SRD 5.2.1 content pack and read back from whichever installed official packs have one. Reference text only (nothing here is
// computed), so it needs no engine support and no ruleset check beyond the pack being installed.
// ============================================================================
import { installedOfficialPacks } from '../officialPackService';
import { GLOSSARY_2024, TOOLBOX_2024, EQUIPMENT_RULES_2024, RuleEntry } from './rulesReference2024Data';

export type { RuleEntry };
export type RulesReference = { glossary: RuleEntry[]; toolbox: RuleEntry[]; equipment: RuleEntry[] };

export const RULES_REFERENCE_2024: RulesReference = { glossary: GLOSSARY_2024, toolbox: TOOLBOX_2024, equipment: EQUIPMENT_RULES_2024 };

export const REFERENCE_SECTIONS = [
  { key: 'glossary', label: 'Glossary' },
  { key: 'toolbox', label: 'Toolbox' },
  { key: 'equipment', label: 'Equipment' },
] as const;
export type ReferenceSection = typeof REFERENCE_SECTIONS[number]['key'];

/** The reference each installed pack carries, with the pack's name. Empty when no installed pack has one. */
export function installedRulesReferences(): { packId: string; packName: string; reference: RulesReference }[] {
  return installedOfficialPacks().flatMap(p => {
    const ref = (p as { rules?: { reference?: Partial<RulesReference> } }).rules?.reference;
    if (!ref || !Array.isArray(ref.glossary)) return [];
    return [{ packId: p.manifest.id, packName: p.manifest.name, reference: { glossary: ref.glossary ?? [], toolbox: ref.toolbox ?? [], equipment: ref.equipment ?? [] } }];
  });
}

/** Entries whose name or text contains every word of the query (case-insensitive); all entries for an empty query. */
export function searchReference(entries: readonly RuleEntry[], query: string): RuleEntry[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [...entries];
  const hay = (e: RuleEntry) => `${e.name} ${e.tag} ${e.text}`.toLowerCase();
  return entries
    .filter(e => words.every(w => hay(e).includes(w)))
    .sort((a, b) => Number(b.name.toLowerCase().includes(words[0])) - Number(a.name.toLowerCase().includes(words[0])));
}
