// ============================================================================
// FILE: src/content/provider/staticProvider.ts
// The hardcoded catalog behind the ContentProvider interface. It imports the static libraries, so the app can keep
// using it unchanged while packs take over, and tests can check that a pack provider returns what it does.
// ============================================================================
import type { Background, CharClass, Feat, Race, RulesetId, Spell } from '../../engine/types';
import { matchesRuleset } from '../../engine/types';
import type { ContentProvider, ProviderSubclass } from './contentProvider';
import { ALL_CHAR_CLASSES_CATALOG } from '../classes/index';
import { FULL_SUBCLASS_LIBRARY } from '../subclasses/index';
import { FULL_RACE_LIBRARY } from '../races/index';
import { FULL_BACKGROUND_LIBRARY } from '../backgrounds/index';
import { FULL_FEAT_LIBRARY } from '../feats/index';
import { FULL_SPELL_LIBRARY } from '../spells/index';
import { SUBCLASSES_2024 } from '../classes2024/index';

export function staticContentProvider(rulesetId: RulesetId): ContentProvider {
  const of = <T extends { rulesetId?: RulesetId }>(list: readonly T[]): T[] => list.filter(r => matchesRuleset(r.rulesetId, rulesetId));
  const classes = of(ALL_CHAR_CLASSES_CATALOG as CharClass[]);
  const subclasses = of([...(FULL_SUBCLASS_LIBRARY as unknown as ProviderSubclass[]).filter(s => !!s.id), ...(SUBCLASSES_2024 as ProviderSubclass[])]);
  const races = of(FULL_RACE_LIBRARY as Race[]);
  const backgrounds = of(FULL_BACKGROUND_LIBRARY as Background[]);
  const feats = of(FULL_FEAT_LIBRARY as Feat[]);
  const spells = of(FULL_SPELL_LIBRARY as Spell[]);
  const first = <T extends { id: string }>(list: readonly T[], id: string) => list.find(x => x.id === id);
  return {
    source: 'static', rulesetId,
    classes: () => classes, getClass: id => first(classes, id),
    subclasses: () => subclasses, subclassesOf: classId => subclasses.filter(s => s.classId === classId),
    getSubclass: id => subclasses.find(s => s.id === id),
    races: () => races, getRace: id => first(races, id),
    backgrounds: () => backgrounds, getBackground: id => first(backgrounds, id),
    feats: () => feats, getFeat: id => first(feats, id),
    spells: () => spells, getSpell: id => first(spells, id),
  };
}
