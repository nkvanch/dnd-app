// src/io/characterSheetPdf.ts
// Exports a character to a printable PDF laid out like the classic baseline
// 5e character sheet (ability scores, saves, skills, combat stats, attacks,
// equipment, spellcasting, features) — for actual paper use at a table.
//
// Approach: render an HTML string styled to print at US Letter size, then use
// expo-print to rasterize it to a real PDF file, then expo-sharing to hand it
// off (save/print/share) — same "generate then share" pattern as backupIO.ts's
// .grimoire-pack export. Needs ONE new package: `npx expo install expo-print`
// (expo-sharing is already installed from the backup/restore feature).
//
// Written without direct access to the live codebase (main PC was briefly
// down) — self-contained module with no imports from other app files EXCEPT
// the Entity type shape. Data-lookup helpers (spell/item names from ids) are
// left as clearly-marked TODOs to wire once the actual content-DB imports are
// confirmed — see resolveName's doc comment.
//
// One exception since: applyStatModifiers/collectAllEffects (pipeline.ts).
// entity.stats is always the character's BASE ability scores — racial/item/
// feat bonuses exist only as stat_modifier effects, computed on the fly by
// the pipeline and never written back into .stats (same reason TabInventory
// computes its own effectiveStr rather than reading entity.stats.str
// directly). Ability scores, saves, and skills below all need the EFFECTIVE
// values or the PDF prints pre-racial-bonus numbers.

import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Entity } from '../engine/types';
import { applyStatModifiers, collectAllEffects } from '../engine/pipeline';

// ── Small formatting helpers ────────────────────────────────────────────────

function mod(score: number): string {
  const m = Math.floor((score - 10) / 2);
  return m >= 0 ? `+${m}` : `${m}`;
}

function esc(s: string | null | undefined): string {
  if (!s) return '';
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

const ABILITY_LABELS: Record<string, string> = {
  str: 'Strength', dex: 'Dexterity', con: 'Constitution',
  int: 'Intelligence', wis: 'Wisdom', cha: 'Charisma',
};

const ABILITY_ORDER = ['str', 'dex', 'con', 'int', 'wis', 'cha'] as const;

// Standard 5e skill → governing ability map (fixed by the rules, not per-character).
const SKILL_ABILITY: Record<string, string> = {
  acrobatics: 'dex', animal_handling: 'wis', arcana: 'int', athletics: 'str',
  deception: 'cha', history: 'int', insight: 'wis', intimidation: 'cha',
  investigation: 'int', medicine: 'wis', nature: 'int', perception: 'wis',
  performance: 'cha', persuasion: 'cha', religion: 'int', sleight_of_hand: 'dex',
  stealth: 'dex', survival: 'wis',
};
function skillLabel(id: string): string {
  return id.split('_').map(w => w[0].toUpperCase() + w.slice(1)).join(' ');
}

// ── HTML template ────────────────────────────────────────────────────────────

/**
 * Builds the printable HTML for a character sheet.
 *
 * `resolveName(kind, id)` is a caller-supplied lookup so this module doesn't
 * need to import the content DB directly. Wire it to whatever combined
 * official+homebrew lookup the app uses elsewhere, e.g.:
 *
 *   resolveName: (kind, id) => {
 *     if (kind === 'spell') return [...ALL_SPELLS, ...homebrew.spells].find(s => s.id === id)?.name ?? id;
 *     if (kind === 'item')  return [...ALL_ITEMS,  ...homebrew.items ].find(i => i.id === id)?.name ?? id;
 *     if (kind === 'race')  return ALL_RACES.find(r => r.id === id)?.name ?? id;
 *     if (kind === 'class') return id;  // classId is already human-readable-ish; swap in a real lookup if you have one
 *     return id;
 *   }
 */
export function buildCharacterSheetHtml(
  entity: Entity,
  resolveName: (kind: 'spell' | 'item' | 'race' | 'class' | 'background', id: string) => string,
): string {
  const { identity, derived, resources, skills, proficiencies, inventory, spellcasting, features } = entity;
  const stats = applyStatModifiers(entity.stats, collectAllEffects(entity));

  const raceName       = resolveName('race', identity.raceId ?? '');
  const className      = resolveName('class', identity.classId ?? '');
  const backgroundName = identity.backgroundId ? resolveName('background', identity.backgroundId) : '';

  const savingThrowIds = new Set(proficiencies?.savingThrows ?? []);

  const abilityBlocks = ABILITY_ORDER.map(ab => `
    <div class="ability-box">
      <div class="ability-label">${ABILITY_LABELS[ab]}</div>
      <div class="ability-score">${stats[ab as keyof typeof stats]}</div>
      <div class="ability-mod">${mod(stats[ab as keyof typeof stats])}</div>
    </div>`).join('');

  const saveRows = ABILITY_ORDER.map(ab => {
    const trained = savingThrowIds.has(ab);
    const bonus = Math.floor((stats[ab as keyof typeof stats] - 10) / 2) + (trained ? (derived.proficiencyBonus ?? 2) : 0);
    return `<div class="line-row"><span class="dot ${trained ? 'filled' : ''}"></span><span class="line-val">${bonus >= 0 ? '+' : ''}${bonus}</span><span class="line-label">${ABILITY_LABELS[ab]}</span></div>`;
  }).join('');

  const skillRows = Object.entries(skills?.skills ?? {}).map(([id, s]) => {
    const ability = SKILL_ABILITY[id] ?? 'dex';
    const trained = (s as any).trained;
    const expertise = (s as any).expertise;
    const profBonus = derived.proficiencyBonus ?? 2;
    const bonus = Math.floor((stats[ability as keyof typeof stats] - 10) / 2)
      + (trained ? profBonus * (expertise ? 2 : 1) : 0);
    return `<div class="line-row"><span class="dot ${trained ? 'filled' : ''} ${expertise ? 'double' : ''}"></span><span class="line-val">${bonus >= 0 ? '+' : ''}${bonus}</span><span class="line-label">${skillLabel(id)} <span class="dim">(${ability.toUpperCase()})</span></span></div>`;
  }).join('');

  const equipmentRows = [...(inventory?.equipped ?? []), ...(inventory?.carried ?? [])]
    .map(inst => `<div class="equip-row">${esc(resolveName('item', inst.itemId))}${inst.quantity > 1 ? ` ×${inst.quantity}` : ''}</div>`)
    .join('') || '<div class="dim">\u2014</div>';

  const currency = inventory?.currency;
  const currencyLine = currency
    ? `${currency.pp}pp ${currency.gp}gp ${currency.ep}ep ${currency.sp}sp ${currency.cp}cp`
    : '';

  const featureRows = (features ?? [])
    .filter(f => f.passive || !f.activation)   // print the passive/reference ones; active ones with mechanics clutter a paper sheet less usefully
    .map(f => `<div class="feature"><span class="feature-name">${esc(f.name)}.</span> ${esc(f.description)}</div>`)
    .join('') || '<div class="dim">\u2014</div>';

  const spellSection = spellcasting ? `
    <div class="section">
      <div class="section-title">Spellcasting</div>
      <div class="spell-list">
        ${(spellcasting.cantrips ?? []).map((id: string) => `<div class="spell-row">${esc(resolveName('spell', id))} <span class="dim">(cantrip)</span></div>`).join('')}
        ${(spellcasting.known ?? spellcasting.prepared ?? []).map((id: string) => `<div class="spell-row">${esc(resolveName('spell', id))}</div>`).join('')}
      </div>
    </div>` : '';

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<style>
  @page { size: letter; margin: 0.4in; }
  * { box-sizing: border-box; }
  body { font-family: 'Georgia', serif; color: #1a1a1a; font-size: 10px; }
  .header { display: flex; justify-content: space-between; align-items: baseline; border-bottom: 2px solid #1a1a1a; padding-bottom: 6px; margin-bottom: 10px; }
  .char-name { font-size: 22px; font-weight: bold; }
  .char-meta { font-size: 11px; color: #444; }
  .grid { display: flex; gap: 10px; }
  .col { flex: 1; }
  .col-wide { flex: 1.4; }
  .box { border: 1.5px solid #1a1a1a; border-radius: 4px; padding: 6px; margin-bottom: 8px; }
  .section-title { font-weight: bold; font-size: 9px; text-transform: uppercase; letter-spacing: 1px; border-bottom: 1px solid #999; margin-bottom: 4px; padding-bottom: 2px; }
  .ability-box { border: 1.5px solid #1a1a1a; border-radius: 6px; text-align: center; padding: 4px; margin-bottom: 6px; }
  .ability-label { font-size: 8px; text-transform: uppercase; letter-spacing: 0.5px; }
  .ability-score { font-size: 18px; font-weight: bold; }
  .ability-mod { font-size: 10px; color: #444; }
  .combat-row { display: flex; gap: 6px; margin-bottom: 8px; }
  .combat-box { flex: 1; border: 1.5px solid #1a1a1a; border-radius: 6px; text-align: center; padding: 6px 2px; }
  .combat-val { font-size: 16px; font-weight: bold; }
  .combat-label { font-size: 7px; text-transform: uppercase; }
  .line-row { display: flex; align-items: center; gap: 5px; font-size: 9.5px; margin-bottom: 2px; }
  .dot { width: 8px; height: 8px; border: 1.2px solid #1a1a1a; border-radius: 50%; display: inline-block; flex-shrink: 0; }
  .dot.filled { background: #1a1a1a; }
  .dot.double { box-shadow: 0 0 0 2px white, 0 0 0 3px #1a1a1a; }
  .line-val { width: 22px; font-weight: bold; }
  .line-label { flex: 1; }
  .dim { color: #888; }
  .feature { font-size: 9px; margin-bottom: 4px; line-height: 1.35; }
  .feature-name { font-weight: bold; font-style: italic; }
  .equip-row, .spell-row { font-size: 9px; padding: 1px 0; border-bottom: 1px dotted #ccc; }
  .footer-note { margin-top: 12px; font-size: 8px; color: #999; text-align: center; }
</style></head>
<body>

  <div class="header">
    <div>
      <div class="char-name">${esc(identity.name || 'Unnamed')}</div>
      <div class="char-meta">Level ${identity.level} ${esc(raceName)} ${esc(className)} \u2014 ${esc(backgroundName)}${identity.alignment ? ` \u2014 ${esc(identity.alignment)}` : ''}</div>
    </div>
    <div class="char-meta">XP: ${identity.xp ?? 0}</div>
  </div>

  <div class="grid">

    <div class="col">
      ${abilityBlocks}
    </div>

    <div class="col">
      <div class="box">
        <div class="section-title">Saving Throws</div>
        ${saveRows}
      </div>
      <div class="box">
        <div class="section-title">Skills</div>
        ${skillRows}
      </div>
    </div>

    <div class="col-wide">
      <div class="combat-row">
        <div class="combat-box"><div class="combat-val">${derived.ac}</div><div class="combat-label">Armor Class</div></div>
        <div class="combat-box"><div class="combat-val">${resources.speed}</div><div class="combat-label">Speed</div></div>
        <div class="combat-box"><div class="combat-val">${derived.proficiencyBonus >= 0 ? '+' : ''}${derived.proficiencyBonus}</div><div class="combat-label">Prof. Bonus</div></div>
      </div>
      <div class="combat-row">
        <div class="combat-box"><div class="combat-val">${resources.hp.current}/${resources.hp.maximum}</div><div class="combat-label">Hit Points</div></div>
        <div class="combat-box"><div class="combat-val">${resources.hp.temp || 0}</div><div class="combat-label">Temp HP</div></div>
        <div class="combat-box"><div class="combat-val">${resources.hitDice.remaining}/${resources.hitDice.total}d${resources.hitDice.die}</div><div class="combat-label">Hit Dice</div></div>
      </div>
      <div class="box">
        <div class="section-title">Equipment</div>
        ${equipmentRows}
        ${currencyLine ? `<div class="equip-row" style="margin-top:4px;border-top:1px solid #999;padding-top:4px;">${esc(currencyLine)}</div>` : ''}
      </div>
    </div>

  </div>

  <div class="box">
    <div class="section-title">Features &amp; Traits</div>
    ${featureRows}
  </div>

  ${spellSection}

  <div class="footer-note">Generated by Grimoire \u2014 for personal table use.</div>

</body></html>`;
}

/**
 * Renders the character sheet to a real PDF file and opens the OS share
 * sheet, same "generate then share" pattern as backupIO.ts's .grimoire-pack
 * export. Requires `expo-print` (not yet installed \u2014 run
 * `npx expo install expo-print` once).
 */
export async function exportCharacterSheetPdf(
  entity: Entity,
  resolveName: (kind: 'spell' | 'item' | 'race' | 'class' | 'background', id: string) => string,
): Promise<void> {
  const html = buildCharacterSheetHtml(entity, resolveName);
  const { uri } = await Print.printToFileAsync({ html, base64: false });

  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) {
    throw new Error('Sharing isn\u2019t available on this device. The PDF was created but couldn\u2019t be shared.');
  }
  await Sharing.shareAsync(uri, {
    mimeType:    'application/pdf',
    dialogTitle: `${entity.identity.name || 'Character'} \u2014 Character Sheet`,
  });
}
