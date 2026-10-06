// ============================================================================
// FILE: src/content/provider/staticProvider.ts
// The hardcoded catalog behind the ContentProvider interface. It imports the static libraries, so the app can keep
// using it unchanged while packs take over, and tests can check that a pack provider returns what it does.
// ============================================================================
import { ALL_BEAST_FORMS } from '../beastforms';
import { ALL_INFUSIONS } from '../infusions';
import { COMPANION_TEMPLATES_BY_GRANT_FEATURE } from '../companions';
import { ALL_CONDITIONS } from '../conditions/index';
import { CONDITIONS_2024 } from '../conditions/conditions2024';
import { conditionForRuleset } from '../conditions/resolve';
import type { Background, CharClass, Feat, Item, Race, RulesetId, Spell } from '../../engine/types';
import { matchesRuleset } from '../../engine/types';
import type { ContentProvider, ProviderSubclass } from './contentProvider';
import { ALL_CHAR_CLASSES_CATALOG } from '../classes/index';
import { FULL_SUBCLASS_LIBRARY } from '../subclasses/index';
import { FULL_RACE_LIBRARY } from '../races/index';
import { FULL_BACKGROUND_LIBRARY } from '../backgrounds/index';
import { FULL_FEAT_LIBRARY } from '../feats/index';
import { FULL_SPELL_LIBRARY } from '../spells/index';
import { SUBCLASSES_2024 } from '../classes2024/index';
import { FULL_ITEM_LIBRARY } from '../items/index';
import { resolveSpellVersion } from '../spells/spellVersions';

/** The hardcoded catalog's rules tables, by the same keys a pack's `rules` bag uses (used by tests and as the build input of the packs). */
const STATIC_RULE_RECORDS: Record<string, readonly unknown[]> = {
  beastForms: ALL_BEAST_FORMS,
  infusions: ALL_INFUSIONS,
  companions: Object.entries(COMPANION_TEMPLATES_BY_GRANT_FEATURE).map(([grantFeatureId, template]) => ({ id: grantFeatureId, template })),
};

export function staticContentProvider(rulesetId?: RulesetId): ContentProvider {
  const of = <T extends { rulesetId?: RulesetId }>(list: readonly T[]): T[] => list.filter(r => matchesRuleset(r.rulesetId, rulesetId));
  const classes = of(ALL_CHAR_CLASSES_CATALOG as CharClass[]);
  const subclasses = of([...(FULL_SUBCLASS_LIBRARY as unknown as ProviderSubclass[]).filter(s => !!s.id), ...(SUBCLASSES_2024 as ProviderSubclass[])]);
  const races = of(FULL_RACE_LIBRARY as Race[]);
  const backgrounds = of(FULL_BACKGROUND_LIBRARY as Background[]);
  const feats = of(FULL_FEAT_LIBRARY as Feat[]);
  const spells = of(FULL_SPELL_LIBRARY as Spell[]);
  const items = FULL_ITEM_LIBRARY as Item[];
  const conditionRecords = of([...ALL_CONDITIONS, ...CONDITIONS_2024]);
  const first = <T extends { id: string }>(list: readonly T[], id: string) => list.find(x => x.id === id);
  return {
    source: 'static', rulesetId,
    classes: () => classes, getClass: id => first(classes, id),
    subclasses: () => subclasses, subclassesOf: classId => subclasses.filter(s => s.classId === classId),
    getSubclass: id => subclasses.find(s => s.id === id),
    races: () => races, getRace: id => first(races, id),
    backgrounds: () => backgrounds, getBackground: id => first(backgrounds, id),
    feats: () => feats, getFeat: id => first(feats, id),
    // The hardcoded library keeps one record per spell id (the 2014 text) and resolves the SRD 5.2.1 version on demand.
    spells: target => spells.filter(s => matchesRuleset(s.rulesetId, target ?? rulesetId)).map(s => resolveSpellVersion(s, target ?? rulesetId)),
    getSpell: (id, target) => resolveSpellVersion(first(spells, id), target ?? rulesetId),
    spellIndexSpells: () => FULL_SPELL_LIBRARY as Spell[],
    items: () => items, getItem: id => first(items, id),
    conditionRecords: () => conditionRecords,
    ruleRecords: key => (STATIC_RULE_RECORDS[key] ?? []),
    getCondition: (id, target) => conditionForRuleset(conditionRecords, id, target ?? rulesetId),
  };
}
