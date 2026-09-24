// ============================================================================
// FILE: src/engine/monsterFactory.ts
// Instantiates a MonsterTemplate into a full live Entity.
//
// Uses makeEmptyEntity() as the base — the ONLY valid entity constructor.
// Then overlays template data via spreads. Calls recomputeDerived() last.
// ============================================================================
import { Entity, CampaignRules, SkillName, PreparedCombatantHpMode, ResourceGrant } from './types';
import { MonsterTemplate } from '../content/monsters/types';
import { makeEmptyEntity }  from '../store/characterStore';
import { recomputeDerived, modifier } from './pipeline';
import { rollExpression }   from './dice';
import { DEFAULT_RULES }    from '../store/characterStore';
import { applyGrant }       from './leveling';
import { resolveFeatureRechargeTag } from './combat';

function uid(): string {
  return `m_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;
}

/** "Max possible" from a dice expression — every die at its highest face
 *  plus the flat modifier implied by (average - average of dice alone).
 *  Same shape preparedEncounter.ts's own maxPossibleHp uses; kept as a
 *  separate, small duplicate rather than a cross-file refactor of that
 *  already-tested code, to avoid any risk of changing prepared-encounter
 *  behavior while fixing the actually-missing case (spawnMonster's own
 *  direct callers, e.g. the DM "Add Monster" screen, had no HP-method
 *  choice at all). Falls back to the printed average if the expression
 *  doesn't parse. */
function maxPossibleHp(dice: string, average: number): number {
  const m = dice.trim().match(/^(\d+)d(\d+)([+-]\d+)?$/i);
  if (!m) return average;
  const count = parseInt(m[1], 10);
  const sides = parseInt(m[2], 10);
  const flat  = m[3] ? parseInt(m[3], 10) : 0;
  return count * sides + flat;
}

/**
 * Closure 2C: strict validation for a manually/table-entered HP string —
 * a complete positive integer, nothing else. Used by the UI to reject bad
 * input BEFORE it ever reaches resolveMonsterHp/spawnMonster, rather than
 * relying on resolveMonsterHp's own defensive `manualHp && manualHp > 0`
 * fallback (which exists only as a safety net for a caller that skips
 * validation entirely, and silently substitutes the printed average with
 * no way for the DM to know their entry was rejected). Rejects: empty
 * string, "0", negative numbers, decimals, and a partial parse like
 * "12abc" (JS's own parseInt would silently accept the "12" and drop the
 * junk — this requires the ENTIRE trimmed string to be digits).
 */
export function isValidManualHp(input: string): boolean {
  return /^[1-9][0-9]*$/.test(input.trim());
}

/**
 * Table-first monster HP: resolves a template's HP total for one of four
 * explicit methods, never silently rerolling. 'manual' and 'average' are
 * deterministic — the same value every time a monster is (re)spawned from
 * the same template/manualHp pair. 'roll' is the one method that genuinely
 * rolls, and only because the caller explicitly asked for it at this exact
 * spawn — never implied by a campaign's global rules.hpMode. The
 * `manualHp && manualHp > 0` fallback below is a defensive safety net,
 * not the primary validation path — real UI entry points call
 * isValidManualHp first and refuse to spawn/save at all on a bad string
 * (see app/dm/monsters.tsx's manualHpValid).
 */
export function resolveMonsterHp(
  template:  MonsterTemplate,
  mode:      PreparedCombatantHpMode,
  manualHp?: number,
): number {
  let hp: number;
  switch (mode) {
    case 'max':    hp = maxPossibleHp(template.hp.dice, template.hp.average); break;
    case 'manual': hp = manualHp && manualHp > 0 ? manualHp : template.hp.average; break;
    case 'roll':
      try { hp = rollExpression(template.hp.dice).total; } catch { hp = template.hp.average; }
      break;
    case 'average':
    default:       hp = template.hp.average;
  }
  return Math.max(1, hp);
}

/**
 * Spawns a live Entity from a MonsterTemplate.
 *
 * HP method: `hpOverride`, when passed, wins outright — used by callers
 * (e.g. the DM "Add Monster" screen) that let the DM choose Average/Manual/
 * Roll for this one monster, independent of the campaign's global
 * rules.hpMode. Without it, HP falls back to the pre-existing campaign-rules
 * behavior (fixed/max → average, anything else → rolled) — unchanged, so
 * every existing caller (including PreparedEncounter's own per-combatant
 * hpMode, applied as its own explicit override after this returns) is
 * unaffected.
 *
 * All template features are applied as active FeatureInstances.
 */
export function spawnMonster(
  template: MonsterTemplate,
  rules:    CampaignRules = DEFAULT_RULES,
  hpOverride?: { mode: PreparedCombatantHpMode; manualHp?: number },
): Entity {
  // Start from the canonical empty entity
  const base = makeEmptyEntity(uid(), 'monster');

  // ── HP calculation ──────────────────────────────────────────────────────────
  const hpTotal = hpOverride
    ? resolveMonsterHp(template, hpOverride.mode, hpOverride.manualHp)
    : rules.hpMode === 'fixed' || rules.hpMode === 'max'
    ? template.hp.average
    : (() => {
        try { return rollExpression(template.hp.dice).total; }
        catch { return template.hp.average; }
      })();

  // ── Feature instances ───────────────────────────────────────────────────────
  // Closure 2C/3A: a Recharge N[-6] feature with NO resourceCost of its own
  // gets one synthesized here, wired to a matching CustomResource — this
  // makes "using it" and "recharging it" flow through the exact same
  // generic resource-spend/availability machinery every other resource-
  // gated feature (spell slots, Legendary Actions) already uses, rather
  // than inventing a parallel mechanism. A feature that already has its own
  // resourceCost (or no recognizable Recharge clause, in EITHER its name
  // suffix — e.g. Ghost's "Possession (Recharge 6)" — or a leading
  // description clause — e.g. Chimera's Fire Breath) is left untouched.
  // See resolveFeatureRechargeTag's own doc comment for the priority order
  // and anchored-parsing rules; it alone decides the tag, so exactly one
  // resource is ever synthesized even if a feature somehow carried both.
  const synthesizedRechargeResources: ResourceGrant[] = [];
  const featureInstances = template.features.map(f => {
    if (f.activation && f.activation.resourceCost === null) {
      const tag = resolveFeatureRechargeTag(f.name, f.description);
      if (tag) {
        const resourceId = `${f.id}_recharge`;
        // Strip a canonical "(Recharge N[-6])" suffix out of the display
        // name used for the synthesized resource itself, so a name-sourced
        // tag (Ghost's Possession) doesn't produce a redundant
        // "Possession (Recharge 6) (Recharge)" label — cosmetic only, this
        // resource's own `name` isn't the primary UI label (the feature's
        // own name is), but it's still real data worth keeping clean.
        const cleanName = f.name.replace(/\s*\(recharge\s+\d(?:\s*[-–]\s*6)?\)\s*$/i, '').trim() || f.name;
        synthesizedRechargeResources.push({ resourceId, name: `${cleanName} (Recharge)`, maximum: 1, recharge: tag });
        return { ...f, isActive: true, activation: { ...f.activation, resourceCost: { resourceId, quantity: 1 } } };
      }
    }
    return { ...f, isActive: true };
  });

  // ── Skill block: apply flat bonuses from template ───────────────────────────
  // Bug fix: a monster stat block's printed skill bonus (e.g. "Stealth +6")
  // is already the FULL total — ability modifier and proficiency both baked
  // in. Setting both trained:true (which makes resolveSkill separately add
  // proficiency again) AND bonus:<printed value> double-counted proficiency
  // into every monster with an authored skill. Store trained:false and back
  // out the ability-mod portion, so resolveSkill's baseMod + 0 + bonus
  // reproduces the printed total exactly regardless of which ability the
  // skill uses.
  const skillsBlock = { ...base.skills };
  for (const [name, bonus] of Object.entries(template.skills)) {
    const key = name as SkillName;
    const entry = skillsBlock.skills[key];
    if (entry && typeof bonus === 'number') {
      const baseMod = modifier(template.stats[entry.ability]);
      skillsBlock.skills = {
        ...skillsBlock.skills,
        [key]: { ...entry, trained: false, bonus: bonus - baseMod },
      };
    }
  }

  // ── Assemble entity ─────────────────────────────────────────────────────────
  const assembled: Entity = {
    ...base,
    identity: {
      ...base.identity,
      name:    template.name,
      level:   Math.max(1, Math.ceil(template.cr)) || 1,
      classId: template.type,
      raceId:  template.type,
    },
    stats: { ...template.stats },
    skills: skillsBlock,
    proficiencies: {
      ...base.proficiencies,
      savingThrows: template.savingThrows,
    },
    resources: {
      ...base.resources,
      hp: {
        current: hpTotal,
        maximum: hpTotal,
        temp:    0,
      },
      speed:   template.speed,
      ac:      template.ac.value,
      hitDice: {
        die:       8,
        total:     Math.max(1, Math.ceil(template.cr)),
        remaining: Math.max(1, Math.ceil(template.cr)),
      },
    },
    features: featureInstances,
    notes: JSON.stringify({
      cr:        template.cr,
      size:      template.size,
      type:      template.type,
      alignment: template.alignment,
      senses:    template.senses,
      languages: template.languages,
      acSource:  template.ac.source,
    }),
  };

  let withResources = assembled;
  for (const r of [...(template.resources ?? []), ...synthesizedRechargeResources]) {
    withResources = applyGrant(withResources, { kind: 'resource', value: r }, assembled.identity.level);
  }

  return recomputeDerived(withResources, rules);
}
