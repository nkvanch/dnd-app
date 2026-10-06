// src/engine/demoCharacter.ts
// Builds the onboarding "sample character" — a level-3 Human Fighter, entirely
// through real engine calls (makeEmptyEntity, applyGrant, levelUp,
// resolveChoice, recomputeDerived), the SAME functions the actual creation
// screens use (see app/creation/race-detail.tsx and class-detail.tsx for the
// patterns this mirrors). No hand-written JSON entity — this stays valid
// automatically as the engine evolves, per docs/ROADMAP_1.0.md Phase 3.3.
//
// Human + Fighter + Soldier background were chosen deliberately: all three
// are confirmed SRD-safe (see the Phase 1 legal audit), so the demo character
// is legally clean in a public build with zero extra filtering needed.
//
// Choices the engine queues that need real player judgment (which subclass,
// which fighting style, spell picks, etc.) are deliberately left UNRESOLVED
// rather than auto-decided — a new player exploring the Features tab and
// resolving their first pending choice is a reasonable, honest bit of
// onboarding in itself, not a gap to paper over.
import { Entity, CampaignRules } from './types';
import { makeEmptyEntity } from '../store/characterStore';
import { applyGrant, levelUp, resolveChoice } from './leveling';
import { recomputeDerived } from './pipeline';
import { getOfficialContentProvider } from '../content/officialSource';

const DEMO_CHARACTER_ID_PREFIX = 'demo-';

export function isDemoCharacter(entity: Entity): boolean {
  return entity.id.startsWith(DEMO_CHARACTER_ID_PREFIX);
}

/**
 * Builds a level-3 Human Fighter (Soldier background) via the real engine
 * pipeline. Auto-resolves only 'skill' and 'equipment' choices (picking the
 * first available option from each pool, a sensible default) so the demo
 * character has real starting gear and trained skills rather than showing
 * up empty-handed. Leaves subclass/fighting-style/other judgment-call
 * choices pending, same as any real level-3 fighter who hasn't picked yet.
 */
export function buildDemoCharacter(rules: CampaignRules): Entity {
  // The sample character is built from the installed SRD 5.1 pack (a Human Soldier Fighter), not from built-in content.
  const provider = getOfficialContentProvider();
  const raceHuman = provider?.getRace('human');
  const bgSoldier = provider?.getBackground('soldier');
  const fighterProgression = provider?.getClass('fighter')?.rawProgression;
  if (!raceHuman || !bgSoldier || !fighterProgression) throw new Error('The sample character needs the SRD 5.1 content pack to be installed.');
  const id = `${DEMO_CHARACTER_ID_PREFIX}${Date.now().toString(36)}`;
  let entity = makeEmptyEntity(id, 'character');

  // ── Identity + ability scores (standard array, a reasonable Fighter spread) ──
  entity = {
    ...entity,
    identity: {
      ...entity.identity,
      name:         'Aria Stonewall',
      raceId:       raceHuman.id,
      subRaceId:    null,
      backgroundId: bgSoldier.id,
      alignment:    'Lawful Neutral',
      xp:           0,
    },
    stats: { str: 15, dex: 14, con: 14, int: 10, wis: 12, cha: 8 },
  };

  // ── Race (mirrors app/creation/race-detail.tsx's selectRace exactly) ──
  for (const feature of raceHuman.features) {
    entity = applyGrant(entity, { kind: 'feature', value: { ...feature, isActive: true } }, 0);
  }

  // ── Background: features via applyGrant, skills set directly trained=true
  //    (mirrors the BG_SKILL_MAP pattern documented in app/creation/
  //    class-detail.tsx's clearClassData comment) ──
  for (const feature of bgSoldier.features) {
    entity = applyGrant(entity, { kind: 'feature', value: { ...feature, isActive: true } }, 0);
  }
  const soldierSkills = ['athletics', 'intimidation'] as const;
  entity = {
    ...entity,
    skills: {
      skills: Object.fromEntries(
        Object.entries(entity.skills.skills).map(([name, s]) => [
          name,
          soldierSkills.includes(name as any) ? { ...s, trained: true } : s,
        ]),
      ) as typeof entity.skills.skills,
    },
  };

  // ── Class: saving throw proficiencies set directly (mirrors class-detail.tsx),
  //    then levelUp() drives levels 1-3 in one real engine call — HP, Fighting
  //    Style/Second Wind (lv1), Action Surge (lv2), Martial Archetype (lv3),
  //    all from fighter.ts's authored progression, nothing hand-written here.
  entity = {
    ...entity,
    identity:      { ...entity.identity, classId: 'fighter' },
    proficiencies: { ...entity.proficiencies, savingThrows: ['str', 'con'] },
  };
  entity = levelUp(entity, 3, fighterProgression, rules);

  // ── Auto-resolve only skill/equipment choices with a real array pool —
  //    picks the first `count` options, a sensible default. Everything else
  //    (subclass, fighting style, and anything without a concrete pool)
  //    stays a genuine pending choice for the player to explore/resolve.
  let unresolved = entity.choices.filter(c => !c.resolved);
  for (const choice of unresolved) {
    const def = choice.definition;
    if ((def.kind !== 'skill' && def.kind !== 'equipment') || !Array.isArray(def.pool)) continue;
    const picks = def.pool.slice(0, def.count).map(o => o.id);
    if (picks.length !== def.count) continue;   // pool too small — leave pending rather than guess
    try {
      entity = resolveChoice(entity, choice.id, picks, rules);
    } catch {
      // Leave pending if resolution fails for any reason — never silently corrupt state.
    }
  }

  return recomputeDerived(entity, rules);
}
