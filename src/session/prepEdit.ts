// ============================================================================
// FILE: src/session/prepEdit.ts
// Pure edit helpers for DM preparation (used by app/live/prepare.tsx and tested
// in isolation). Each takes a CampaignPrep and returns the updated one; the
// caller persists it through PrepService.edit, which advances the CampaignRevision.
// ============================================================================
import {
  CampaignPrep, NoteCategory, PrepChangeTemplate, PrepCombatant, PrepEffect, PrepEncounter, PrepNote, SessionPlan,
} from './prep';
import { CharacterChange, EffectComponent, EffectDuration, EffectVisibility } from './types';

export function parseCombatants(text: string, idPrefix: string): PrepCombatant[] {
  return text.split(/[,\n]/).map(s => s.trim()).filter(Boolean).map((name, i) => {
    const hidden = name.startsWith('?');
    return { id: `${idPrefix}-c${i + 1}`, name: hidden ? name.slice(1).trim() : name, hpState: 'healthy' as const, dmNotes: '', ...(hidden ? { hidden: true } : {}) };
  }).filter(c => c.name.length > 0);
}

export function addEncounter(prep: CampaignPrep, input: { id: string; name: string; combatantsText: string; dmNotes: string }): CampaignPrep {
  const enc: PrepEncounter = {
    id: input.id, name: input.name.trim(), dmNotes: input.dmNotes,
    combatants: parseCombatants(input.combatantsText, input.id),
  };
  return { ...prep, encounters: [...prep.encounters, enc] };
}

/** Shape of an Encounter Planner record we read from (kept structural so this file has no store imports). */
export type PlannerEncounter = {
  id: string; name: string; description?: string;
  combatants: { id: string; monsterId: string; displayName?: string; quantity: number; hidden?: boolean; notes?: string }[];
};

/** Imports an Encounter Planner record as a prep encounter (link kept; quantity expanded; DM notes stay private). */
export function importPlannerEncounter(
  prep: CampaignPrep, planned: PlannerEncounter, newId: string, nameOf: (monsterId: string) => string,
): CampaignPrep {
  const combatants: PrepCombatant[] = [];
  for (const c of planned.combatants) {
    const base = c.displayName || nameOf(c.monsterId);
    const qty = Math.max(1, c.quantity);
    for (let i = 0; i < qty; i++) {
      combatants.push({
        id: `${newId}-${c.id}-${i + 1}`, name: qty > 1 ? `${base} ${i + 1}` : base, hpState: 'healthy',
        dmNotes: c.notes ?? '', ...(c.hidden ? { hidden: true } : {}),
      });
    }
  }
  const enc: PrepEncounter = { id: newId, name: planned.name, dmNotes: planned.description ?? '', combatants, sourceEncounterId: planned.id };
  return { ...prep, encounters: [...prep.encounters, enc] };
}

export function addEffect(prep: CampaignPrep, input: {
  id: string; name: string; description: string; source: string; notes: string; hiddenDurationReason: string;
  visibility: EffectVisibility; components: EffectComponent[]; duration: EffectDuration;
}): CampaignPrep {
  const fx: PrepEffect = { ...input, name: input.name.trim() };
  return { ...prep, effects: [...prep.effects, fx] };
}

export function addTemplate(prep: CampaignPrep, input: { id: string; label: string; changes: CharacterChange[] }): CampaignPrep {
  const t: PrepChangeTemplate = { id: input.id, label: input.label.trim(), changes: input.changes };
  return { ...prep, templates: [...prep.templates, t] };
}

export function addNote(prep: CampaignPrep, input: { id: string; text: string; category?: NoteCategory; subject?: string }): CampaignPrep {
  const n: PrepNote = {
    id: input.id, text: input.text.trim(), dmOnly: true, category: input.category ?? 'session',
    ...(input.subject?.trim() ? { subject: input.subject.trim() } : {}),
  };
  return { ...prep, notes: [...prep.notes, n] };
}

export function addPlan(prep: CampaignPrep, input: { id: string; name: string }): CampaignPrep {
  const p: SessionPlan = { id: input.id, name: input.name.trim(), encounterIds: [], effectIds: [], templateIds: [], notes: '' };
  return { ...prep, plans: [...prep.plans, p] };
}

type PlanList = 'encounterIds' | 'effectIds' | 'templateIds';

export function togglePlanItem(prep: CampaignPrep, planId: string, list: PlanList, itemId: string): CampaignPrep {
  return {
    ...prep,
    plans: prep.plans.map(p => {
      if (p.id !== planId) return p;
      const cur = p[list];
      return { ...p, [list]: cur.includes(itemId) ? cur.filter(x => x !== itemId) : [...cur, itemId] };
    }),
  };
}

export type PrepKind = 'encounters' | 'effects' | 'templates' | 'notes' | 'plans';

/** Removes an item and cleans plan references to it. */
export function removeItem(prep: CampaignPrep, kind: PrepKind, id: string): CampaignPrep {
  const next = { ...prep, [kind]: (prep[kind] as { id: string }[]).filter(x => x.id !== id) } as CampaignPrep;
  return {
    ...next,
    plans: next.plans.map(p => ({
      ...p,
      encounterIds: p.encounterIds.filter(x => x !== id),
      effectIds: p.effectIds.filter(x => x !== id),
      templateIds: p.templateIds.filter(x => x !== id),
    })),
  };
}

export function parseSignedInt(text: string): number | null {
  const t = text.trim();
  if (!/^[+-]?\d{1,4}$/.test(t)) return null;
  return parseInt(t, 10);
}

export function describeEffectComponent(c: EffectComponent): string {
  const label: Record<EffectComponent['stat'], string> = {
    ac: 'AC', speed: 'Speed', initiative: 'Initiative', save: 'Saves', spell_attack: 'Spell attack', spell_dc: 'Spell save DC',
  };
  return `${label[c.stat]} ${c.value >= 0 ? '+' : ''}${c.value}`;
}

export function describeDuration(d: EffectDuration): string {
  return d.unit === 'manual' ? 'Manual' : `${d.remaining}/${d.total} rounds`;
}

const NOTE_CATEGORY_LABEL: Record<NoteCategory, string> = {
  session: 'Session', encounter: 'Encounter', player: 'Player', monster: 'Monster/NPC', reminder: 'Reminder',
};

export function describeNoteCategory(category?: NoteCategory): string {
  return NOTE_CATEGORY_LABEL[category ?? 'session'];
}
