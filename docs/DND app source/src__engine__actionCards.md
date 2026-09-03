---
tags: [grimoire, engine]
type: "Engine"
source: "src/engine/actionCards.ts"
---

# actionCards

> **Engine**  ·  `src/engine/actionCards.ts`

Builds the ActionCard display objects shown on the Combat tab. Each card
represents an ability the player can use: its name, activation cost, range,
damage expression, save requirement, and tags.

Reads Feature.activation and Feature.abilityEffects — passive features (no
activation) are filtered out. Spells are resolved from ALL_SPELLS for their
full descriptor.

---

## Types

### `CardGenOptions`

Doubles the dice COUNT in a dice expression, per the DMG large-creature rule
("twice the weapon's damage dice"). "1d8" -> "2d8", "2d6" -> "4d6",
"1d10+2" -> "2d10+2". Flat bonuses and non-dice text are left untouched.
 
function doubleDice(dice: string): string {
  return dice.replace(/(\d+)d(\d+)/g, (_, count, sides) => `${parseInt(count, 10) * 2}d${sides}`);
}

 Options that tune card generation from active campaign rules.

## Functions

### `buildLayer1(feature: Feature, cardType: ActionCardType): string`

── Layer builders ────────────────────────────────────────────────────────────
Layer 1: source type and card type.
Examples: "Lv 3 Spell • Damage", "Class Feature • Buff", "Bonus Action • Healing"

### `buildLayer1ForSpell(spell: Spell, cardType: ActionCardType): string`

### `buildLayer2(feature: Feature, entity?: Entity, opts: CardGenOptions`

Layer 2: key mechanical summary.
Examples: "8d6 Fire • 20 ft radius", "+2 damage, B/P/S resistance"

### `buildLayer2ForSpell(spell: Spell): string`

### `buildLayer3(feature: Feature): string | null`

Layer 3: save / concentration / duration notes.
Examples: "Dex Save (half)", "Concentration • 1 min", null

### `buildLayer3ForSpell(spell: Spell): string | null`

### `classifyFeature(feature: Feature): ActionCardType`

── Weapon attack / damage computation ────────────────────────────────────────

 Proficiency bonus from character level (PHB scaling). 
function profBonusFor(entity: Entity): number {
  return Math.ceil(1 + entity.identity.level / 4);
}
Parses a magic bonus (+1/+2/+3) from an item's properties or feature name.
e.g. "+1 to attack and damage rolls" → 1; "+1 Life-Drinking Greatsword" → 1.
 
function parseMagicBonus(feature: Feature): number {
  const hay = [feature.name, ...(feature.description ? [feature.description] : [])].join(' ');
  const m = hay.match(/\+(\d)\b/);
  return m ? parseInt(m[1], 10) : 0;
}
Determines which ability modifier a weapon uses. Finesse weapons use the
higher of STR/DEX; ranged weapons use DEX; everything else uses STR.
Reads item properties via the feature's source item id.
 
function weaponAbilityMod(feature: Feature, entity: Entity): { mod: number; ability: 'str' | 'dex' } {
  const itemId = feature.source?.kind === 'item' ? feature.source.refId : null;
  const item   = itemId ? globalContentDB.items.find(i => i.id === itemId) : null;
  const props  = (item?.properties ?? []).map(p => p.toLowerCase()).join(' ');

  const strMod = modifier(entity.stats.str);
  const dexMod = modifier(entity.stats.dex);

  const isFinesse = props.includes('finesse');
  const isRanged  = props.includes('ammunition') || props.includes('thrown') && props.includes('range');

  if (isFinesse) {
    return dexMod >= strMod ? { mod: dexMod, ability: 'dex' } : { mod: strMod, ability: 'str' };
  }
  if (isRanged) return { mod: dexMod, ability: 'dex' };
  return { mod: strMod, ability: 'str' };
}
Computes a weapon's to-hit bonus and flat damage bonus.
to-hit = ability mod + proficiency (always proficient for now) + magic bonus
damage = ability mod + magic bonus
 
function computeWeaponAttack(feature: Feature, entity: Entity): { toHit: number; dmgBonus: number; ability: string } | null {
  Only item-sourced features with a damage ability effect are weapons
  if (feature.source?.kind !== 'item') return null;
  const hasDamage = (feature.abilityEffects ?? []).some(e => e.type === 'damage');
  if (!hasDamage) return null;

  const { mod, ability } = weaponAbilityMod(feature, entity);
  const magic = parseMagicBonus(feature);
  const prof  = profBonusFor(entity);

  return {
    toHit:    mod + prof + magic,
    dmgBonus: mod + magic,
    ability:  ability.toUpperCase(),
  };
}

function fmtBonus(n: number): string {
  return n >= 0 ? `+${n}` : `${n}`;
}

── Classification ────────────────────────────────────────────────────────────
Determines the card type from a feature's abilityEffects and tags.
Priority: explicit tags → effect-type inference → default 'utility'.

### `generateActionCard(`

── Card generators ───────────────────────────────────────────────────────────
Generates an ActionCard for a single feature.
Returns null for passive features (no activation).

### `generateAllActionCards(entity: Entity, rules?: CampaignRules): ActionCard[]`

Generates all Action Cards for an entity.
Runs over every active feature and all known/prepared spells.
Filters nulls. Each card knows which tabs it belongs to.

### `generateSpellCard(`

Generates an ActionCard for a known/prepared spell.
The spell is looked up from globalContentDB by ID.

### `isFeatureAvailable(`

── Availability ──────────────────────────────────────────────────────────────
Returns whether a feature can currently be used.
Checks resource pools and spell slot availability.

---

## Imports

- [[src__content__classes__library|library]]  ·  `src/content/classes/library.ts`
- [[src__engine__houseRules|houseRules]]  ·  `src/engine/houseRules.ts`
- [[src__engine__pipeline|pipeline]]  ·  `src/engine/pipeline.ts`
- [[src__engine__types|types]]  ·  `src/engine/types.ts`

## Used by

- [[src__components__sheet__TabActions|TabActions]]  ·  `src/components/sheet/TabActions.tsx`
- [[src__components__sheet__TabFeatures|TabFeatures]]  ·  `src/components/sheet/TabFeatures.tsx`
- [[src__components__sheet__TabSpells|TabSpells]]  ·  `src/components/sheet/TabSpells.tsx`
