// ============================================================================
// FILE: src/engine/monsterFactory.ts
// Instantiates a MonsterTemplate into a full live Entity.
//
// Uses makeEmptyEntity() as the base — the ONLY valid entity constructor.
// Then overlays template data via spreads. Calls recomputeDerived() last.
// ============================================================================
import { Entity, CampaignRules, SkillName } from './types';
import { MonsterTemplate } from '../content/monsters/types';
import { makeEmptyEntity }  from '../store/characterStore';
import { recomputeDerived } from './pipeline';
import { rollExpression }   from './dice';
import { DEFAULT_RULES }    from '../store/characterStore';

function uid(): string {
  return `m_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;
}

/**
 * Spawns a live Entity from a MonsterTemplate.
 * HP is rolled using the template's dice expression (or averaged in 'fixed' mode).
 * All template features are applied as active FeatureInstances.
 */
export function spawnMonster(
  template: MonsterTemplate,
  rules:    CampaignRules = DEFAULT_RULES,
): Entity {
  // Start from the canonical empty entity
  const base = makeEmptyEntity(uid(), 'monster');

  // ── HP calculation ──────────────────────────────────────────────────────────
  const hpTotal = rules.hpMode === 'fixed' || rules.hpMode === 'max'
    ? template.hp.average
    : (() => {
        try { return rollExpression(template.hp.dice).total; }
        catch { return template.hp.average; }
      })();

  // ── Feature instances ───────────────────────────────────────────────────────
  const featureInstances = template.features.map(f => ({
    ...f,
    isActive: true,
  }));

  // ── Skill block: apply flat bonuses from template ───────────────────────────
  const skillsBlock = { ...base.skills };
  for (const [name, bonus] of Object.entries(template.skills)) {
    const key = name as SkillName;
    if (skillsBlock.skills[key]) {
      skillsBlock.skills = {
        ...skillsBlock.skills,
        [key]: { ...skillsBlock.skills[key], trained: true, bonus: bonus ?? null },
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

  return recomputeDerived(assembled, rules);
}
