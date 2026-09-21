// src/content/compendiumBrowse.ts
// COMPENDIUM-2: pure normalization/summary logic for the multi-type
// Compendium — kept separate from app/(tabs)/compendium.tsx (React/hooks)
// so it's directly unit-testable and so the "reuse the shared content-
// query/filter infrastructure, don't build a parallel browsing system"
// rule has one real place backing it. Every BrowsableEntry this module
// produces wraps a raw object already sourced from the SAME data paths
// every other screen uses (getMergedContentDB(), spellRepo/itemRepo
// indices, mergeMonsterIndex(), subclassEntriesForClassMerged()) — this
// file only normalizes shape and derives a one-line row summary, it never
// re-fetches or re-derives content itself.
import { Race, Subrace, CharClass, Background, Feat, Condition } from '../engine/types';
import type { SpellIndexEntry } from './spellRepo.types';
import type { ItemIndexEntry } from './itemRepo.types';
import type { MonsterTemplate } from './monsters/types';
import type { SubclassEntry } from './subclasses/subclassBrowse';
import { BrowsableEntry, ContentTypeId } from './contentQuery';
import { Colors } from '../theme';
import { CASTER_TYPE } from './classes/classBrowse';
import { itemCategory, ITEM_CATEGORY_LABELS } from './items/itemBrowse';
import { crLabel } from './monsters/monsterBrowse';
import { primaryPrereqCategory } from './feats/featBrowse';
import { actionType } from './spellFilterUtils';
import { raceSourceLabel } from './races/raceBrowse';
import { subraceSourceLabel } from './races/subraceBrowse';
import { classSourceLabel } from './classes/classBrowse';
import { subclassSourceLabel } from './subclasses/subclassBrowse';
import { backgroundSourceLabel } from './backgrounds/backgroundBrowse';
import { featSourceLabel } from './feats/featBrowse';
import { spellSourceLabel } from './spells/spellBrowse';
import { itemSourceLabel } from './items/itemBrowse';
import { monsterSourceLabel } from './monsters/monsterBrowse';
import { conditionSourceLabel } from './conditions/conditionBrowse';

/** A subrace paired with its parent race — Subrace itself carries only
 *  `parentId`; the Compendium's global (no-selected-race-context) browsing
 *  needs the parent's NAME too, both for the row summary and for the
 *  Parent Race filter the spec explicitly allows here (and only here —
 *  contextual creation pickers already fix the parent, so they omit it). */
export type SubraceWithParent = Subrace & { parentRaceId: string; parentRaceName: string; rulesetId?: Race['rulesetId']; srd?: boolean };

export function flattenSubraces(races: Race[]): SubraceWithParent[] {
  return races.flatMap(r => (r.subraces ?? []).map(sr => ({ ...sr, parentRaceId: r.id, parentRaceName: r.name, rulesetId: r.rulesetId, srd: r.srd })));
}

export type ContentTypeVisual = { accent: string; icon: string };
export const CONTENT_TYPE_VISUALS: Record<ContentTypeId, ContentTypeVisual> = {
  race: { accent: Colors.green, icon: '◈' }, subrace: { accent: Colors.green, icon: '◇' },
  class: { accent: Colors.gold, icon: '◆' }, subclass: { accent: Colors.goldDim, icon: '◇' },
  background: { accent: Colors.textSecondary, icon: '▣' }, feat: { accent: Colors.red, icon: '✦' },
  spell: { accent: Colors.blue, icon: '✧' }, item: { accent: Colors.gold, icon: '▰' },
  monster: { accent: Colors.red, icon: '▲' }, condition: { accent: Colors.purple, icon: '●' },
};

const SIZE_LABEL: Record<string, string> = {
  tiny: 'Tiny', small: 'Small', medium: 'Medium', large: 'Large', huge: 'Huge', gargantuan: 'Gargantuan',
};

export function raceToBrowsable(r: Race, isHomebrew: boolean): BrowsableEntry<Race> {
  return { id: r.id, name: r.name, type: 'race', rulesetId: r.rulesetId, srd: r.srd, isHomebrew, raw: r };
}
export function subraceToBrowsable(sr: SubraceWithParent, isHomebrew: boolean): BrowsableEntry<SubraceWithParent> {
  return { id: sr.id, name: sr.name, type: 'subrace', rulesetId: sr.rulesetId, srd: sr.srd, isHomebrew, raw: sr };
}
export function classToBrowsable(c: CharClass, isHomebrew: boolean): BrowsableEntry<CharClass> {
  return { id: c.id, name: c.name, type: 'class', rulesetId: c.rulesetId, srd: c.srd, isHomebrew, raw: c };
}
/** A subclass entry paired with its parent class's display name — same
 *  "global browsing has no fixed parent context" rationale as
 *  SubraceWithParent above. */
export type SubclassEntryWithParent = SubclassEntry & { parentClassName: string };

export function attachParentClassNames(entries: SubclassEntry[], classes: CharClass[]): SubclassEntryWithParent[] {
  const nameById = new Map(classes.map(c => [c.id, c.name]));
  return entries.map(e => ({ ...e, parentClassName: nameById.get(e.classId) ?? e.classId }));
}

export function subclassToBrowsable(s: SubclassEntryWithParent, isHomebrew: boolean): BrowsableEntry<SubclassEntryWithParent> {
  return { id: s.id, name: s.name, type: 'subclass', rulesetId: s.progression.rulesetId, srd: s.progression.srd, isHomebrew, raw: s };
}
export function backgroundToBrowsable(b: Background, isHomebrew: boolean): BrowsableEntry<Background> {
  return { id: b.id, name: b.name, type: 'background', rulesetId: b.rulesetId, srd: b.srd, isHomebrew, raw: b };
}
export function featToBrowsable(f: Feat, isHomebrew: boolean): BrowsableEntry<Feat> {
  return { id: f.id, name: f.name, type: 'feat', rulesetId: f.rulesetId, srd: f.srd, isHomebrew, raw: f };
}
export function spellToBrowsable(s: SpellIndexEntry, isHomebrew: boolean): BrowsableEntry<SpellIndexEntry> {
  return { id: s.id, name: s.name, type: 'spell', rulesetId: s.rulesetId, srd: s.srd, isHomebrew, raw: s };
}
export function itemToBrowsable(i: ItemIndexEntry, isHomebrew: boolean): BrowsableEntry<ItemIndexEntry> {
  return { id: i.id, name: i.name, type: 'item', rulesetId: i.rulesetId, srd: i.srd, isHomebrew, raw: i };
}
export function monsterToBrowsable(m: MonsterTemplate, isHomebrew: boolean): BrowsableEntry<MonsterTemplate> {
  return { id: m.id, name: m.name, type: 'monster', rulesetId: m.rulesetId, srd: m.srd, isHomebrew, raw: m };
}
export function conditionToBrowsable(c: Condition, isHomebrew: boolean): BrowsableEntry<Condition> {
  return { id: c.id, name: c.name, type: 'condition', rulesetId: c.rulesetId, isHomebrew, raw: c };
}

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

/** One-line row summary — real, available fields only. Never the full
 *  mechanical description (that's what the detail screen is for). */
export function summaryLine(entry: BrowsableEntry): string {
  switch (entry.type) {
    case 'race': {
      const r = entry.raw as Race;
      return [SIZE_LABEL[r.size?.toLowerCase?.() ?? ''] ?? r.size, entry.rulesetId ?? raceSourceLabel(r, entry.isHomebrew)]
        .filter(Boolean).join(' · ');
    }
    case 'subrace': {
      const sr = entry.raw as SubraceWithParent;
      return [sr.parentRaceName, subraceSourceLabel(sr, entry.isHomebrew)].filter(Boolean).join(' · ');
    }
    case 'class': {
      const c = entry.raw as CharClass;
      return [`d${c.hitDie}`, CASTER_TYPE[c.id], c.spellcastingAbility?.toUpperCase()].filter(Boolean).join(' · ');
    }
    case 'subclass': {
      const s = entry.raw as SubclassEntryWithParent;
      return `${s.parentClassName} · Level ${s.unlockLevel}`;
    }
    case 'background': {
      const b = entry.raw as Background;
      return [entry.rulesetId, backgroundSourceLabel(b, entry.isHomebrew)].filter(Boolean).join(' · ') || 'Background';
    }
    case 'feat': {
      const f = entry.raw as Feat;
      const cat = primaryPrereqCategory(f.prerequisite);
      return cat === 'None' ? 'No prerequisite' : cat;
    }
    case 'spell': {
      const s = entry.raw as SpellIndexEntry;
      const levelLabel = s.level === 0 ? 'Cantrip' : `${ordinal(s.level)}-level`;
      return [`${levelLabel} ${s.school}`, actionType(s)].filter(Boolean).join(' · ');
    }
    case 'item': {
      const i = entry.raw as ItemIndexEntry;
      return [ITEM_CATEGORY_LABELS[itemCategory(i)], i.cost && i.cost !== '—' ? i.cost : null].filter(Boolean).join(' · ');
    }
    case 'monster': {
      const m = entry.raw as MonsterTemplate;
      return `CR ${crLabel(m.cr)} · ${SIZE_LABEL[m.size] ?? m.size} ${m.type}`;
    }
    case 'condition': {
      const c = entry.raw as Condition;
      return ['Condition', entry.rulesetId ?? conditionSourceLabel(c, entry.isHomebrew)].filter(Boolean).join(' · ');
    }
  }
}

/** Source label for ANY BrowsableEntry, regardless of type — dispatches to
 *  each type's own dedicated *SourceLabel() function rather than
 *  re-deriving provenance generically, so this stays byte-identical to
 *  whatever that type's own screens already show for "Source". */
export function entrySourceLabel(entry: BrowsableEntry): string | undefined {
  switch (entry.type) {
    case 'race':       return raceSourceLabel(entry.raw as Race, entry.isHomebrew);
    case 'subrace':     return subraceSourceLabel(entry.raw as Subrace, entry.isHomebrew);
    case 'class':       return classSourceLabel(entry.raw as CharClass, entry.isHomebrew);
    case 'subclass':    return subclassSourceLabel(entry.raw as SubclassEntry, entry.isHomebrew);
    case 'background':  return backgroundSourceLabel(entry.raw as Background, entry.isHomebrew);
    case 'feat':        return featSourceLabel(entry.raw as Feat, entry.isHomebrew);
    case 'spell':       return spellSourceLabel(entry.raw as SpellIndexEntry, entry.isHomebrew);
    case 'item':        return itemSourceLabel(entry.raw as ItemIndexEntry, entry.isHomebrew);
    case 'monster':     return monsterSourceLabel(entry.raw as MonsterTemplate, entry.isHomebrew);
    case 'condition':   return conditionSourceLabel(entry.raw as Condition, entry.isHomebrew);
  }
}
