// ============================================================================
// FILE: src/engine/prerequisites.ts
// A reusable "does this character qualify" check. Anything that offers options (a feature pool, an invocation
// list, a feat, a homebrew choice) can attach `requires: Prerequisite[]`; this file answers whether they are met
// and, when not, says why in the rule's own words. Nothing here is Warlock-specific.
//
// Spells carry no structured damage or attack data in the library, so the cantrip traits are read off the spell
// text the same way a player would: "damage" appears in it, "ranged/melee spell attack" appears in it, and the
// range string starts with a number of feet. That is a disclosed heuristic, kept in one place (spellTraits).
// ============================================================================
import { Entity, Prerequisite, ChoiceState } from './types';
import { getClassLevels } from './multiclass';

export type SpellTraits = { damage: boolean; attackRoll: boolean; rangeFeet: number };

type SpellLike = { id: string; level: number; range?: string; description?: string };

/** The traits the cantrip prerequisites ask about, read from a spell's range and text. */
export function spellTraits(spell: Pick<SpellLike, 'range' | 'description'>): SpellTraits {
  const text = spell.description ?? '';
  const feet = /^\s*(\d+)\s*(?:feet|foot|ft)/i.exec(spell.range ?? '');
  return {
    damage: /\bdamage\b/i.test(text),
    attackRoll: /\b(?:ranged|melee) spell attack\b/i.test(text),
    rangeFeet: feet ? Number(feet[1]) : 0,
  };
}

export type PrerequisiteContext = {
  /** Options picked in the same sitting that are not on the character yet (a picker's current selection). */
  alsoHeld?: string[];
  /** Which class's level a `level` prerequisite without a classId measures. Defaults to the character's main class, else total level. */
  classId?: string | null;
  /** Looks a spell up by id; defaults to the content library. Injected so the engine stays testable without it. */
  spellLookup?: (id: string) => SpellLike | undefined;
};

export type PrerequisiteResult = { met: boolean; unmet: string[] };

/** Every option id the character holds through resolved choices (their `selections`). */
export function heldOptionIds(entity: Entity): Set<string> {
  const held = new Set<string>();
  for (const c of entity.choices as ChoiceState[]) if (c.resolved) for (const id of c.selections) held.add(String(id));
  return held;
}

function defaultSpellLookup(id: string): SpellLike | undefined {
  // Loaded on demand: the content library is large and the engine should not pull it in just to be imported.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const lib = require('../content/spells/index').FULL_SPELL_LIBRARY as SpellLike[];
  return lib.find(s => s.id === id);
}

function levelFor(entity: Entity, classId: string | null | undefined): number {
  const classes = getClassLevels(entity);
  if (classId) return classes.find(c => String(c.classId) === classId)?.level ?? 0;
  return entity.identity.level;
}

export function checkPrerequisites(entity: Entity, requires: Prerequisite[] | undefined, ctx: PrerequisiteContext = {}): PrerequisiteResult {
  if (!requires || requires.length === 0) return { met: true, unmet: [] };
  const held = heldOptionIds(entity);
  for (const id of ctx.alsoHeld ?? []) held.add(id);
  const lookup = ctx.spellLookup ?? defaultSpellLookup;
  const unmet: string[] = [];

  for (const r of requires) {
    switch (r.kind) {
      case 'level': {
        const classId = r.classId ?? ctx.classId ?? null;
        if (levelFor(entity, classId) < r.min) unmet.push(`Level ${r.min}+`);
        break;
      }
      case 'has_option':
        if (!held.has(r.optionId)) unmet.push(r.label);
        break;
      case 'has_feature':
        if (!entity.features.some(f => f.id === r.featureId)) unmet.push(r.label);
        break;
      case 'spell': {
        const sc = entity.spellcasting;
        if (!sc || !(sc.cantrips.includes(r.spellId) || sc.known.includes(r.spellId) || sc.prepared.includes(r.spellId))) unmet.push(r.label);
        break;
      }
      case 'cantrip': {
        const cantrips = entity.spellcasting?.cantrips ?? [];
        const ok = cantrips.some(id => {
          const sp = lookup(id);
          if (!sp) return false;
          const t = spellTraits(sp);
          return r.traits.every(trait =>
            trait === 'damage' ? t.damage : trait === 'attack_roll' ? t.attackRoll : t.rangeFeet >= 10);
        });
        if (!ok) unmet.push(r.label);
        break;
      }
      case 'excludes':
        if (r.optionIds.some(id => held.has(id))) unmet.push(r.label);
        break;
    }
  }
  return { met: unmet.length === 0, unmet };
}

/** Held options (other than `optionId`) that list `optionId` as a requirement, so it cannot be swapped out from under them. */
export function dependentsOf(optionId: string, held: string[], optionsById: Record<string, { requires?: Prerequisite[] }>): string[] {
  return held.filter(id => id !== optionId && (optionsById[id]?.requires ?? []).some(r => r.kind === 'has_option' && r.optionId === optionId));
}
