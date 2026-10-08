// ============================================================================
// FILE: src/content/provider/createCharacter.ts
// Builds a character from a ContentProvider alone: the class, species, background, Origin feat, subclass and spells
// all come from the provider (an installed pack or the static catalog), none from a static import. It performs the
// same steps the creation screens do (race features and picks, background and its Origin feat, class and levels,
// subclass, spell picks), through the same engine functions, so a character made here is the character the screens
// would make. The screens still read the static catalog; moving them onto a provider is the next step.
// ============================================================================
import { makeEmptyEntity } from '../../store/characterStore';
import {
  applyGrant, acquireClass, levelUpClass, queueChoice, swapBackground, applySubclassToEntity, applySpellChoiceToEntity,
} from '../../engine/leveling';
import { recomputeDerived } from '../../engine/pipeline';
import { getProgressionForClass } from '../classes/progressions';
import { mergeSubclassIntoProgression } from '../classes/progressions';
import { candidateSpellsForChoice } from '../spellChoiceFilter';
import type { AbilityScores, CampaignRules, Entity } from '../../engine/types';
import type { ContentProvider } from './contentProvider';

export type CharacterSpec = {
  id: string;
  name: string;
  classId: string;
  raceId: string;
  backgroundId: string;
  stats: AbilityScores;
  /** Target level (default 1). */
  level?: number;
  /** The subclass to take once the class offers one. */
  subclassId?: string;
};

export class MissingContentError extends Error {
  constructor(kind: string, id: string, source: string) { super(`${kind} "${id}" is not in the installed content (${source}).`); this.name = 'MissingContentError'; }
}

const need = <T,>(found: T | undefined, kind: string, id: string, p: ContentProvider): T => {
  if (!found) throw new MissingContentError(kind, id, p.source);
  return found;
};

/** The content the engine's recompute needs, taken from the provider so no static catalog is consulted for it. */
export const recomputeContentOf = (p: ContentProvider) =>
  ({ classDefs: p.classes(), homebrewSpells: [...p.spells()], races: [...p.races()] });

export function createCharacter(provider: ContentProvider, spec: CharacterSpec, rules: CampaignRules): Entity {
  const cls = need(provider.getClass(spec.classId), 'Class', spec.classId, provider);
  const race = need(provider.getRace(spec.raceId), 'Species', spec.raceId, provider);
  const background = need(provider.getBackground(spec.backgroundId), 'Background', spec.backgroundId, provider);
  const originFeat = background.originFeat ? need(provider.getFeat(background.originFeat), 'Origin feat', background.originFeat, provider) : undefined;

  let entity = makeEmptyEntity(spec.id, 'character');
  entity = {
    ...entity, rulesetId: provider.rulesetId,
    identity: { ...entity.identity, name: spec.name, raceId: race.id as never, subRaceId: null, backgroundId: background.id as never, classId: '', level: 0 },
    stats: { ...spec.stats },
    resources: { ...entity.resources, hp: { current: 10, maximum: 10, temp: 0 } },
  };

  // Species: its features, resource pools and queued picks (the screens' selectRace, without subrace or ancestry).
  for (const feature of race.features) entity = applyGrant(entity, { kind: 'feature', value: { ...feature, isActive: true } }, feature.level ?? 0);
  for (const resource of race.resources ?? []) entity = applyGrant(entity, { kind: 'resource', value: resource }, 0, undefined, { kind: 'race', id: race.id });
  for (const choice of race.pendingChoices ?? []) entity = queueChoice(entity, choice, 0);

  // Background: its features, picks and Origin feat (the feat comes from the provider, not the engine).
  entity = swapBackground(entity, background, rules, undefined, undefined, originFeat);

  // Class and levels. A subclass chosen at its level is merged into the progression the way the screens do.
  const definitions = provider.classes();
  entity = { ...entity, identity: { ...entity.identity, classId: cls.id } };
  entity = acquireClass(entity, cls, rules, definitions);
  const subclass = spec.subclassId ? need(provider.getSubclass(spec.subclassId), 'Subclass', spec.subclassId, provider) : undefined;
  let progression = cls.rawProgression ?? getProgressionForClass(cls);
  // The subclass choice is queued when the class reaches it; bind it then, and the rest of the levels use the merged progression.
  const bindSubclass = () => {
    const pick = subclass && entity.choices.find(c => !c.resolved && c.definition.kind === 'subclass');
    if (subclass && pick) {
      entity = applySubclassToEntity(entity, pick.id, subclass.id as never, subclass, rules);
      progression = mergeSubclassIntoProgression(progression, subclass);
    }
  };
  bindSubclass();
  for (let level = 2; level <= (spec.level ?? 1); level++) {
    entity = levelUpClass(entity, cls.id, progression, rules, cls, definitions);
    bindSubclass();
  }
  return recomputeDerived(entity, rules, recomputeContentOf(provider));
}

/** The spells a pending spell choice may offer, from the provider's spells and the choice's own filter. */
export function spellCandidates(provider: ContentProvider, entity: Entity, choiceId: string) {
  const choice = entity.choices.find(c => c.id === choiceId);
  if (!choice) return [];
  const slots = entity.spellcasting?.slots ?? {};
  const maxCastableLevel = Math.max(0, ...Object.entries(slots).filter(([, s]) => (s as { total: number }).total > 0).map(([lvl]) => Number(lvl)));
  return candidateSpellsForChoice([...provider.spells()], choice.definition,
    { ownClassId: choice.definition.forClassId ?? entity.identity.classId, maxCastableLevel: maxCastableLevel || 1 });
}

/** Resolves a spell choice with spells that must be among the provider's candidates for it. */
export function pickSpells(provider: ContentProvider, entity: Entity, choiceId: string, spellIds: string[], rules: CampaignRules): Entity {
  const allowed = new Set(spellCandidates(provider, entity, choiceId).map(s => s.id));
  for (const id of spellIds) if (!allowed.has(id)) throw new MissingContentError('Spell choice option', id, provider.source);
  const out = applySpellChoiceToEntity(entity, choiceId, spellIds, id => provider.getSpell(id)?.level, rules);
  return recomputeDerived(out, rules, recomputeContentOf(provider));
}
