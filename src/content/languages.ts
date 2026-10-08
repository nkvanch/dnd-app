// src/content/languages.ts
// CHOICE-EXPANSION-1: same rationale as tools.ts — the narrowest normalized
// metadata layer needed to make Language a real interactive choice. Canonical
// ids (not display strings) are the identity; `entity.proficiencies.languages`
// stores these ids. `secret` languages (Thieves' Cant, Druidic) are included
// in the registry for completeness/lookup, but are NOT offered by the
// general-purpose language picker's default pool — see
// `SELECTABLE_LANGUAGE_CATEGORIES` below (item 13: "Do not assume all
// languages are globally available"). A choice whose own literal `pool`
// explicitly lists a secret language (e.g. a class feature that really does
// grant a choice including Thieves' Cant) still works, since the picker's
// eligible set is the intersection of the registry and the choice's own
// pool, not the registry's default-selectable subset alone.
export type LanguageCategory = 'common' | 'exotic' | 'secret' | 'other';

export type LanguageDefinition = {
  id:       string;
  name:     string;
  category: LanguageCategory;
  script?:  string;
};

export const ALL_LANGUAGES: LanguageDefinition[] = [
  // Common (Standard)
  { id: 'common',     name: 'Common',     category: 'common', script: 'Common' },
  { id: 'dwarvish',   name: 'Dwarvish',   category: 'common', script: 'Dwarvish' },
  { id: 'elvish',     name: 'Elvish',     category: 'common', script: 'Elvish' },
  { id: 'giant',      name: 'Giant',      category: 'common', script: 'Dwarvish' },
  { id: 'gnomish',    name: 'Gnomish',    category: 'common', script: 'Dwarvish' },
  { id: 'goblin',     name: 'Goblin',     category: 'common', script: 'Dwarvish' },
  { id: 'halfling',   name: 'Halfling',   category: 'common', script: 'Common' },
  { id: 'orc',        name: 'Orc',        category: 'common', script: 'Dwarvish' },

  // Exotic
  { id: 'abyssal',    name: 'Abyssal',    category: 'exotic', script: 'Infernal' },
  { id: 'celestial',  name: 'Celestial',  category: 'exotic', script: 'Celestial' },
  { id: 'draconic',   name: 'Draconic',   category: 'exotic', script: 'Draconic' },
  { id: 'deep_speech', name: 'Deep Speech', category: 'exotic' },
  { id: 'infernal',   name: 'Infernal',   category: 'exotic', script: 'Infernal' },
  { id: 'primordial',  name: 'Primordial', category: 'exotic', script: 'Dwarvish' },
  { id: 'sylvan',      name: 'Sylvan',     category: 'exotic', script: 'Elvish' },
  { id: 'undercommon', name: 'Undercommon', category: 'exotic', script: 'Elvish' },

  // Secret — not globally available; see SELECTABLE_LANGUAGE_CATEGORIES.
  { id: 'thieves_cant', name: "Thieves' Cant", category: 'secret' },
  { id: 'druidic',       name: 'Druidic',        category: 'secret' },
];

export function getLanguageById(id: string): LanguageDefinition | undefined {
  return ALL_LANGUAGES.find(l => l.id === id);
}

export const LANGUAGE_CATEGORY_LABELS: Record<LanguageCategory, string> = {
  common: 'Common',
  exotic: 'Exotic',
  secret: 'Secret',
  other:  'Other',
};

export const LANGUAGE_CATEGORY_ORDER: LanguageCategory[] = ['common', 'exotic', 'secret', 'other'];

/** Categories a generic "choose N languages" picker offers by default when
 *  the choice's own pool is the 'all' sentinel — secret languages are only
 *  selectable when a choice's literal pool explicitly includes them. */
export const SELECTABLE_LANGUAGE_CATEGORIES: LanguageCategory[] = ['common', 'exotic', 'other'];
