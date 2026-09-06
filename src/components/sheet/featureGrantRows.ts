// src/components/sheet/featureGrantRows.ts
// Shared before/after row-builder for a single feature grant OR removal —
// used by RemoveFeatureModal (live-editing Phase 1) and AddCustomFeatureModal
// (Phase 3). Extends FeatPreviewModal.tsx's buildFeatSummaryRows pattern
// (same ability/derived-stat diffing) with a resource-added/removed diff — a
// feat's ability-score bonus never grants its own resource, but a manually
// added/removed feature can (see traitCompiler.ts's buildTraitFeature,
// limited-use trait branch) — and makes the skill/save diff symmetric
// (gained OR lost), since losing a proficiency is a real, expected direction
// for removal, unlike feat-taking.
import { Entity, Ability, SkillName, DerivedStats, DERIVED_NUMERIC_KEYS } from '../../engine/types';
import { applyStatModifiers, collectAllEffects } from '../../engine/pipeline';
import { DERIVED_LABELS } from './derivedStatLabels';
import { SKILL_LABELS } from './skillLabels';

const ABILITIES: Ability[] = ['str', 'dex', 'con', 'int', 'wis', 'cha'];

export type Row = { label: string; note?: string };

export function buildFeatureGrantRows(before: Entity, after: Entity): Row[] {
  const rows: Row[] = [];

  const beforeEff = applyStatModifiers(before.stats, collectAllEffects(before));
  const afterEff  = applyStatModifiers(after.stats,  collectAllEffects(after));
  for (const ab of ABILITIES) {
    if (beforeEff[ab] !== afterEff[ab]) {
      rows.push({ label: `${ab.toUpperCase()}: ${beforeEff[ab]} → ${afterEff[ab]}` });
    }
  }

  for (const key of DERIVED_NUMERIC_KEYS) {
    const k = key as keyof DerivedStats;
    const label = DERIVED_LABELS[k];
    if (!label) continue;
    const b = before.derived[k];
    const a = after.derived[k];
    if (b !== a) rows.push({ label: `${label}: ${b ?? '—'} → ${a ?? '—'}` });
  }

  for (const skill of Object.keys(after.skills.skills) as SkillName[]) {
    const b = before.skills.skills[skill];
    const a = after.skills.skills[skill];
    if (b.trained !== a.trained) {
      rows.push({ label: `${SKILL_LABELS[skill]}: ${a.trained ? 'proficient' : 'no longer proficient'}` });
    } else if (b.expertise !== a.expertise) {
      rows.push({ label: `${SKILL_LABELS[skill]}: ${a.expertise ? 'expertise' : 'no longer expertise'}` });
    }
  }

  for (const ab of ABILITIES) {
    const b = before.proficiencies.savingThrows.includes(ab);
    const a = after.proficiencies.savingThrows.includes(ab);
    if (b !== a) {
      rows.push({ label: `${ab.toUpperCase()} saving throws: ${a ? 'proficient' : 'no longer proficient'}` });
    }
  }

  if (before.resources.hp.maximum !== after.resources.hp.maximum) {
    rows.push({ label: `Max HP: ${before.resources.hp.maximum} → ${after.resources.hp.maximum}` });
  }

  const beforeRes = new Map(before.resources.custom.map(r => [r.id, r]));
  const afterRes  = new Map(after.resources.custom.map(r => [r.id, r]));
  for (const [id, r] of afterRes) {
    if (!beforeRes.has(id)) rows.push({ label: `New resource: ${r.name} (${r.maximum})` });
  }
  for (const [id, r] of beforeRes) {
    if (!afterRes.has(id)) rows.push({ label: `Resource removed: ${r.name}` });
  }

  return rows;
}
