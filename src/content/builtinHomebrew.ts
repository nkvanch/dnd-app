// ============================================================================
// FILE: src/content/builtinHomebrew.ts
// "Built-in homebrew" — content authored in code but seeded into the homebrew
// store (SQLite) on first launch so it behaves exactly like user-created
// homebrew: it appears under the Homebrew sections, is editable, and is
// deletable. Once seeded, the user owns these rows; deleting one keeps it gone.
//
// These are seeded ONCE (guarded by an app_meta flag). They are intentionally
// NOT part of the official ALL_RACES / ALL_CLASS_PROGRESSIONS arrays — they
// live only as homebrew.
//
// Abyss Knight is too complex for the simplified class-builder fields (baked
// subclass features, known-spell grants, a custom slot table, per-level
// effect-bearing features), so it carries its full progression in
// `rawProgression`. getProgressionForClass honours that verbatim.
// ============================================================================
import { CharClass, Race } from '../engine/types';
import { abyssKnightProgression } from './classes/abyssKnight';
import { bloodHunterProgression } from './classes/bloodHunter';
import { raceSkeleton } from './races/index';

/**
 * Abyss Knight as a homebrew CharClass. The simplified fields (savingThrows,
 * spellcasting*, etc.) are deliberately omitted — rawProgression carries the
 * real, full 1–20 progression including the Oozing Knight subclass, the
 * level-2 known spells, and the custom slot table (resolved by classId in
 * spellSlotTables.ts, which is independent of official-content registration).
 */
const abyssKnightClass: CharClass = {
  id:      'abyss_knight',
  name:    'Abyss Knight',
  hitDie:  10,
  features: [],
  description:
    'A warrior bound to a demonic patron, drawing on abyssal energy to infuse ' +
    'their strikes and channel dark magic. Half-caster (Charisma) whose pact-' +
    'style spell slots all share the same level.',
  // Saving throw proficiencies are read by class-detail.tsx's doSelect() from
  // cls.savingThrows for homebrew classes (official classes use CLASS_DETAIL).
  // Abyss Knight is STR/CON per its source.
  savingThrows: ['str', 'con'],
  rawProgression: abyssKnightProgression,
};

/**
 * Blood Hunter as a homebrew CharClass — a third-party class (Matthew
 * Mercer / Critical Role) never published by WotC, same treatment as Abyss
 * Knight above. Base class only for now; the four Blood Hunter Orders are a
 * separate, later authoring batch (Blood Hunter Order is already wired as a
 * `kind: 'subclass'` choice at level 3, same mechanism every official class
 * uses, so orders slot in the same way once authored).
 */
const bloodHunterClass: CharClass = {
  id:      'blood_hunter',
  name:    'Blood Hunter',
  hitDie:  10,
  features: [],
  description:
    'A grim warrior who sacrifices their own vitality to hunter monsters, ' +
    'channeling hemocraft blood magic into weapon strikes and curses. ' +
    'Martial half-caster-adjacent — no spellcasting of its own, but uses a ' +
    'scaling hemocraft die (like Sneak Attack or Martial Arts) to fuel its ' +
    'features.',
  savingThrows: ['dex', 'int'],
  rawProgression: bloodHunterProgression,
};

/** All built-in homebrew, grouped by content type for seeding. */
export const BUILTIN_HOMEBREW = {
  classes: [abyssKnightClass, bloodHunterClass] as CharClass[],
  races:   [raceSkeleton]     as Race[],
};

/** Stable list of [type, item] pairs for the seeding loop. */
export const BUILTIN_HOMEBREW_SEED: Array<
  | { type: 'class'; item: CharClass }
  | { type: 'race';  item: Race }
> = [
  ...BUILTIN_HOMEBREW.classes.map(item => ({ type: 'class' as const, item })),
  ...BUILTIN_HOMEBREW.races.map(item => ({ type: 'race' as const, item })),
];
