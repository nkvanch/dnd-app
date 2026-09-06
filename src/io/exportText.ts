// src/io/exportText.ts
// Human-readable markdown builders for characters and homebrew content, plus
// a plain-text derivative. Pure data-in/string-out — no RN or native imports
// (expo-print/expo-sharing/expo-file-system live in exportShare.ts instead),
// so this module stays trivially testable and import-cycle-safe.
import {
  Entity, CharClass, HomebrewSubclass, Spell,
  Feature, ClassProgression, Grant, Ability,
} from '../engine/types';
import { applyStatModifiers, collectAllEffects } from '../engine/pipeline';

/** Caller-supplied name resolver — same shape as characterSheetPdf.ts's resolveName. */
export type ResolveName = (kind: 'spell' | 'item' | 'race' | 'class' | 'background', id: string) => string;

// ── Shared formatting helpers ────────────────────────────────────────────────

function mod(score: number): string {
  const m = Math.floor((score - 10) / 2);
  return m >= 0 ? `+${m}` : `${m}`;
}

const ABILITY_LABELS: Record<Ability, string> = {
  str: 'Strength', dex: 'Dexterity', con: 'Constitution',
  int: 'Intelligence', wis: 'Wisdom', cha: 'Charisma',
};
const ABILITY_ORDER: Ability[] = ['str', 'dex', 'con', 'int', 'wis', 'cha'];

const SKILL_ABILITY: Record<string, Ability> = {
  acrobatics: 'dex', animal_handling: 'wis', arcana: 'int', athletics: 'str',
  deception: 'cha', history: 'int', insight: 'wis', intimidation: 'cha',
  investigation: 'int', medicine: 'wis', nature: 'int', perception: 'wis',
  performance: 'cha', persuasion: 'cha', religion: 'int', sleight_of_hand: 'dex',
  stealth: 'dex', survival: 'wis',
};
function skillLabel(id: string): string {
  return id.split('_').map(w => w[0].toUpperCase() + w.slice(1)).join(' ');
}

// ── Feature rendering ─────────────────────────────────────────────────────────

function featureMarkdown(f: Feature): string {
  const lines = [`### ${f.name}`, '', f.description || '_(no description)_'];
  if (f.activation) {
    const cost = f.activation.resourceCost
      ? ` · costs ${f.activation.resourceCost.quantity} ${f.activation.resourceCost.resourceId}`
      : '';
    lines.push('', `*${f.activation.actionType}${cost}*`);
  }
  return lines.join('\n');
}

/** A standalone homebrew Feature (the generic feature-editor builder's output). */
export function buildStandaloneFeatureMarkdown(f: Feature): string {
  return featureMarkdown(f).replace(/^### /, '# ');
}

/** Generic "name + flat Feature[]" renderer — Race, Subrace, Background, Item. */
export function buildFeatureListMarkdown(title: string, subtitle: string | null, features: Feature[]): string {
  const parts = [`# ${title}`];
  if (subtitle) parts.push('', subtitle);
  parts.push('', '---', '');
  parts.push(features.length
    ? features.map(featureMarkdown).join('\n\n')
    : '_No features._');
  return parts.join('\n');
}

// ── Class / subclass progression rendering ────────────────────────────────────

/** Walks entries[].grants[], grouping embedded Feature grants under a per-level heading. */
export function buildProgressionMarkdown(title: string, progression: ClassProgression): string {
  const parts = [`# ${title}`, ''];
  const sorted = [...progression.entries].sort((a, b) => a.level - b.level);
  for (const entry of sorted) {
    const featureGrants = entry.grants.filter((g: Grant) => g.kind === 'feature');
    if (featureGrants.length === 0) continue;
    parts.push(`## Level ${entry.level}`, '');
    for (const g of featureGrants) {
      parts.push(featureMarkdown(g.value as Feature), '');
    }
  }
  return parts.join('\n');
}

/**
 * CharClass has two shapes: `rawProgression` (a real ClassProgression, walked
 * via buildProgressionMarkdown) or the simplified builder fields — `.features`
 * (level 1) plus `.levelFeatures` (DraftTrait & {level}, level 2+, already
 * carrying its own name/description so it renders identically to a Feature
 * without needing to go through the Grant-extraction path at all).
 */
export function buildClassMarkdown(cls: CharClass): string {
  if (cls.rawProgression) return buildProgressionMarkdown(cls.name, cls.rawProgression);

  const parts = [`# ${cls.name}`, '', `Hit Die: d${cls.hitDie}`];
  if (cls.description) parts.push('', cls.description);
  parts.push('', '## Level 1', '');
  parts.push(cls.features.length
    ? cls.features.map(featureMarkdown).join('\n\n')
    : '_No level 1 features._');

  const byLevel = new Map<number, typeof cls.levelFeatures>();
  for (const lf of cls.levelFeatures ?? []) {
    if (!byLevel.has(lf.level)) byLevel.set(lf.level, []);
    byLevel.get(lf.level)!.push(lf);
  }
  for (const level of [...byLevel.keys()].sort((a, b) => a - b)) {
    parts.push('', `## Level ${level}`, '');
    parts.push(byLevel.get(level)!.map(lf => `### ${lf.name}\n\n${lf.description || '_(no description)_'}`).join('\n\n'));
  }
  return parts.join('\n');
}

export function buildHomebrewSubclassMarkdown(sub: HomebrewSubclass): string {
  return buildProgressionMarkdown(sub.name, sub);
}

// ── Spell rendering ──────────────────────────────────────────────────────────

export function buildSpellMarkdown(spell: Spell): string {
  const levelLabel = spell.level === 0 ? 'Cantrip' : `Level ${spell.level}`;
  return [
    `# ${spell.name}`,
    '',
    `*${levelLabel} ${spell.school}${spell.ritual ? ' (ritual)' : ''}*`,
    '',
    `**Casting Time:** ${spell.castingTime}`,
    `**Range:** ${spell.range}`,
    `**Components:** ${spell.components.join(', ')}`,
    `**Duration:** ${spell.duration}${spell.concentration ? ' (concentration)' : ''}`,
    '',
    '---',
    '',
    spell.description,
    ...(spell.upcast ? ['', `**At Higher Levels.** ${spell.upcast}`] : []),
  ].join('\n');
}

// ── Character rendering ───────────────────────────────────────────────────────

export function buildCharacterMarkdown(entity: Entity, resolveName: ResolveName): string {
  const { identity, derived, resources, skills, proficiencies, inventory, spellcasting, features } = entity;
  // entity.stats is always the character's BASE ability scores — racial/
  // item/feat bonuses exist only as stat_modifier effects, computed on the
  // fly by the pipeline and never written back into .stats. Mirrors the
  // fix already established in the sibling characterSheetPdf.ts (see its
  // own header comment) — without this, ability scores/saves/skills below
  // would silently print pre-bonus numbers for any character with an
  // effective stat bonus.
  const stats = applyStatModifiers(entity.stats, collectAllEffects(entity));

  const raceName       = resolveName('race', identity.raceId ?? '');
  const className      = resolveName('class', identity.classId ?? '');
  const backgroundName = identity.backgroundId ? resolveName('background', identity.backgroundId) : '';

  const savingThrowIds = new Set(proficiencies?.savingThrows ?? []);
  const profBonus = derived.proficiencyBonus ?? 2;

  const parts: string[] = [
    `# ${identity.name || 'Unnamed'}`,
    '',
    `*Level ${identity.level} ${raceName} ${className} — ${backgroundName}${identity.alignment ? ` — ${identity.alignment}` : ''}*`,
    '',
    `**AC** ${derived.ac}  ·  **HP** ${resources.hp.current}/${resources.hp.maximum}  ·  **Speed** ${resources.speed} ft  ·  **Prof. Bonus** ${profBonus >= 0 ? '+' : ''}${profBonus}`,
    '',
    '## Ability Scores',
    '',
    '| Ability | Score | Mod |',
    '|---|---|---|',
    ...ABILITY_ORDER.map(ab => `| ${ABILITY_LABELS[ab]} | ${stats[ab]} | ${mod(stats[ab])} |`),
    '',
    '## Saving Throws',
    '',
    ...ABILITY_ORDER.map(ab => {
      const trained = savingThrowIds.has(ab);
      const bonus = Math.floor((stats[ab] - 10) / 2) + (trained ? profBonus : 0);
      return `- ${trained ? '●' : '○'} **${ABILITY_LABELS[ab]}** ${bonus >= 0 ? '+' : ''}${bonus}`;
    }),
    '',
    '## Skills',
    '',
    ...Object.entries(skills?.skills ?? {}).map(([id, s]) => {
      const ability = SKILL_ABILITY[id] ?? 'dex';
      const trained = (s as any).trained;
      const expertise = (s as any).expertise;
      const bonus = Math.floor((stats[ability] - 10) / 2) + (trained ? profBonus * (expertise ? 2 : 1) : 0);
      const marker = expertise ? '◉' : trained ? '●' : '○';
      return `- ${marker} **${skillLabel(id)}** (${ability.toUpperCase()}) ${bonus >= 0 ? '+' : ''}${bonus}`;
    }),
    '',
    '## Equipment',
    '',
  ];

  const equipmentLines = [...(inventory?.equipped ?? []), ...(inventory?.carried ?? [])]
    .map(inst => `- ${resolveName('item', inst.itemId)}${inst.quantity > 1 ? ` ×${inst.quantity}` : ''}`);
  parts.push(...(equipmentLines.length ? equipmentLines : ['_None._']));

  const currency = inventory?.currency;
  if (currency) {
    parts.push('', `**Currency:** ${currency.pp}pp ${currency.gp}gp ${currency.ep}ep ${currency.sp}sp ${currency.cp}cp`);
  }

  parts.push('', '## Features & Traits', '');
  const featureLines = (features ?? [])
    .filter(f => f.passive || !f.activation)
    .map(f => `- **${f.name}.** ${f.description}`);
  parts.push(...(featureLines.length ? featureLines : ['_None._']));

  if (spellcasting) {
    parts.push('', '## Spellcasting', '');
    const cantrips = (spellcasting.cantrips ?? []).map((id: string) => `- ${resolveName('spell', id)} *(cantrip)*`);
    const known    = (spellcasting.known ?? spellcasting.prepared ?? []).map((id: string) => `- ${resolveName('spell', id)}`);
    parts.push(...cantrips, ...known);
  }

  return parts.join('\n');
}

// ── TXT derivative ────────────────────────────────────────────────────────────

/**
 * Strips markdown syntax down to a plain-text read — one markdown builder per
 * shape, TXT is a derived view rather than a second hand-written renderer per
 * content type. Headings become underlined-by-blank-line text, bold/italic
 * markers drop, table pipes become simple spacing, links collapse to their
 * label.
 */
export function stripMarkdown(md: string): string {
  return md
    .replace(/^#{1,6}\s+(.*)$/gm, (_, text) => text.toUpperCase())
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/^-{3,}$/gm, '')
    .replace(/^\|.*\|$/gm, line => line.replace(/\|/g, ' ').trim())
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/^[-●○◉]\s+/gm, '- ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
