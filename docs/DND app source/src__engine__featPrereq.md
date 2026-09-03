---
tags: [grimoire, engine]
type: "Engine"
source: "src/engine/featPrereq.ts"
---

# featPrereq

> **Engine**  ·  `src/engine/featPrereq.ts`

Evaluates whether an entity meets a feat's prerequisite string (e.g. "STR 13",
"Proficiency with martial weapons", "Spellcasting"). Used by AsiFeatPicker to
grey out unavailable feats and show the unmet requirement.

---

## Types

### `PrereqResult`

## Functions

### `evaluatePrerequisite(entity: Entity, prereq: string | null): PrereqResult`

Human-readable explanation, e.g. "Requires Strength 13 (you have 11)." 
  reason:           string;
   True when the requirement couldn't be auto-verified and is shown as advisory. 
  needsManualCheck: boolean;
};

const ABILITY_WORDS: Record<string, Ability> = {
  strength: 'str', dexterity: 'dex', constitution: 'con',
  intelligence: 'int', wisdom: 'wis', charisma: 'cha',
};

const ABILITY_LABEL: Record<Ability, string> = {
  str: 'Strength', dex: 'Dexterity', con: 'Constitution',
  int: 'Intelligence', wis: 'Wisdom', cha: 'Charisma',
};

 Effective ability scores (base + race/feat effects), matching the sheet. 
function effectiveScores(entity: Entity) {
  return applyStatModifiers(entity.stats, collectAllEffects(entity));
}

 Does the entity have any spellcasting capability? 
function canCastSpells(entity: Entity): boolean {
  if (entity.spellcasting) return true;
  Some casters gain it via a feature even before the block initialises.
  return entity.features.some(f =>
    /spellcasting|pact magic/i.test(f.name) ||
    f.effects?.some(e => e.type === 'grant_spell'),
  );
}

function hasArmorProf(entity: Entity, weight: 'light' | 'medium' | 'heavy'): boolean {
  return entity.proficiencies.armor.some(a => a.toLowerCase().includes(weight));
}

function hasMartialWeaponProf(entity: Entity): boolean {
  return entity.proficiencies.weapons.some(w => w.toLowerCase().includes('martial'));
}

 Normalises a race/subrace id like "wood_elf" -> "wood elf" for matching. 
function raceWords(entity: Entity): string[] {
  return [entity.identity.raceId, entity.identity.subRaceId ?? '']
    .filter(Boolean)
    .map(s => s.replace(/_/g, ' ').toLowerCase());
}
Evaluates a single prerequisite string. Returns met:true with an empty reason
when there is no prerequisite (null/empty).

---

## Imports

- [[src__engine__pipeline|pipeline]]  ·  `src/engine/pipeline.ts`
- [[src__engine__types|types]]  ·  `src/engine/types.ts`

## Used by

- [[src__components__AsiFeatPicker|AsiFeatPicker]]  ·  `src/components/AsiFeatPicker.tsx`
