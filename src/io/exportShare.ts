// src/io/exportShare.ts
// Format → file → OS share sheet entry points, shared by the character sheet
// header and the homebrew Library screen. Mirrors backupIO.ts's exact
// file-system/sharing pattern (same expo-file-system/legacy subpath — SDK 56's
// default expo-file-system API is a different class-based shape that doesn't
// have writeAsStringAsync).
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as Print from 'expo-print';
import { Platform } from 'react-native';
import {
  Entity, ContentDB, Race, Subrace, CharClass, HomebrewSubclass, Spell, Background, Feature, Item, Feat,
} from '../engine/types';
import { MonsterTemplate } from '../content/monsters/types';
import { ContentCacheType, HomebrewContent } from '../db/contentCacheRepo';
import { spellRepo } from '../content/spellRepo';
import { itemRepo } from '../content/itemRepo';
import { useHomebrewStore } from '../store/homebrewStore';
import {
  buildCharacterMarkdown, buildClassMarkdown, buildFeatureListMarkdown,
  buildHomebrewSubclassMarkdown, buildSpellMarkdown, buildStandaloneFeatureMarkdown,
  stripMarkdown, ResolveName,
} from './exportText';
import {
  buildClassHtml, buildFeatureListHtml, buildHomebrewSubclassHtml,
  buildSpellHtml, buildStandaloneFeatureHtml,
} from './exportHtml';
import { buildCharacterSheetHtml } from './characterSheetPdf';
import { GrimoirePackHomebrew } from '../engine/backup';
import { exportContentPack } from './backupIO';

export type ExportFormat = 'pdf' | 'txt' | 'md' | 'pack';

function sanitize(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'export';
}

/**
 * The one correct merged official+homebrew name lookup. `db.spells`/`db.items`
 * on getMergedContentDB()'s ContentDB are homebrew-only (official spell/item
 * content lives in spellRepo/itemRepo instead, moved out of globalContentDB —
 * see homebrewStore.ts) — check the repo first, homebrew store second.
 * Race/class/background are genuinely merged on ContentDB.
 */
function resolveContentName(db: ContentDB, kind: 'spell' | 'item' | 'race' | 'class' | 'background', id: string): string {
  if (!id) return '';
  switch (kind) {
    case 'race':       return db.races.find(r => r.id === id)?.name ?? id;
    case 'class':       return db.classes.find(c => c.id === id)?.name ?? id;
    case 'background': return db.backgrounds.find(b => b.id === id)?.name ?? id;
    case 'spell':
      return spellRepo.getSpellSync(id)?.name
        ?? db.spells.find(s => s.id === id)?.name
        ?? id;
    case 'item':
      return itemRepo.getItemSync(id)?.name
        ?? db.items.find(it => it.id === id)?.name
        ?? id;
    default: return id;
  }
}

/**
 * Warms the spell/item Tier-2 cache for a batch of ids before resolveContentName
 * is called synchronously — required on native (no-op on web, see spellRepo.ts/
 * itemRepo.ts's own doc comments).
 */
async function ensureNamesLoaded(spellIds: string[], itemIds: string[]): Promise<void> {
  await Promise.all([
    spellRepo.ensureLoaded(spellIds),
    itemRepo.ensureLoaded(itemIds),
  ]);
}

/** True on any platform expo-print actually implements — not web. */
export const PDF_EXPORT_AVAILABLE = Platform.OS !== 'web';

export async function shareText(content: string, filename: string, format: 'txt' | 'md'): Promise<void> {
  const uri = FileSystem.cacheDirectory + filename;
  await FileSystem.writeAsStringAsync(uri, content, { encoding: FileSystem.EncodingType.UTF8 });

  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) {
    throw new Error('Sharing isn’t available on this device. The file was written but couldn’t be shared.');
  }
  await Sharing.shareAsync(uri, {
    mimeType:    format === 'md' ? 'text/markdown' : 'text/plain',
    dialogTitle: filename,
  });
}

export async function sharePdfHtml(html: string, dialogTitle: string): Promise<void> {
  const { uri } = await Print.printToFileAsync({ html, base64: false });

  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) {
    throw new Error('Sharing isn’t available on this device. The PDF was created but couldn’t be shared.');
  }
  await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle });
}

async function shareByFormat(
  format: Exclude<ExportFormat, 'pack'>,
  buildMarkdown: () => string,
  buildHtml: () => string,
  baseName: string,
): Promise<void> {
  if (format === 'pdf') {
    await sharePdfHtml(buildHtml(), baseName);
    return;
  }
  const md = buildMarkdown();
  const content = format === 'txt' ? stripMarkdown(md) : md;
  await shareText(content, `${baseName}.${format}`, format);
}

// ── Character ─────────────────────────────────────────────────────────────────

export async function exportCharacter(entity: Entity, format: ExportFormat): Promise<void> {
  if (format === 'pack') return; // character sheet never offers this format — see ExportFormatSheet's showPackOption
  const db = useHomebrewStore.getState().getMergedContentDB();

  const spellIds = [
    ...(entity.spellcasting?.cantrips ?? []),
    ...(entity.spellcasting?.known ?? entity.spellcasting?.prepared ?? []),
  ];
  const itemIds = [...entity.inventory.equipped, ...entity.inventory.carried].map(i => i.itemId);
  await ensureNamesLoaded(spellIds, itemIds);

  const resolveName: ResolveName = (kind, id) => resolveContentName(db, kind, id);

  await shareByFormat(
    format,
    () => buildCharacterMarkdown(entity, resolveName),
    () => buildCharacterSheetHtml(entity, resolveName),
    sanitize(`${entity.identity.name || 'character'}-character`),
  );
}

// ── Homebrew ──────────────────────────────────────────────────────────────────

/** Wraps a single item into the GrimoirePackHomebrew field matching its type. */
function wrapAsHomebrewPack(type: ContentCacheType, item: HomebrewContent): GrimoirePackHomebrew {
  switch (type) {
    case 'race':       return { races: [item as Race] };
    case 'subrace':    return { subraces: [item as Subrace] };
    case 'class':      return { classes: [item as CharClass] };
    case 'subclass':   return { subclasses: [item as HomebrewSubclass] };
    case 'spell':      return { spells: [item as Spell] };
    case 'background': return { backgrounds: [item as Background] };
    case 'feature':    return { features: [item as Feature] };
    case 'item':       return { items: [item as Item] };
    case 'feat':       return { feats: [item as Feat] };
    case 'monster':    return { monsters: [item as MonsterTemplate] };
  }
}

export async function exportHomebrewItem(type: ContentCacheType, item: HomebrewContent, format: ExportFormat): Promise<void> {
  if (format === 'pack') {
    await exportContentPack(wrapAsHomebrewPack(type, item), null, sanitize(`${item.name}-${type}`));
    return;
  }
  switch (type) {
    case 'race': {
      const race = item as Race;
      const subtitle = [
        race.size ? `Size: ${race.size}` : null,
        race.age ? `Age: ${race.age}` : null,
        race.languages?.length ? `Languages: ${race.languages.join(', ')}` : null,
      ].filter(Boolean).join(' · ') || null;
      await shareByFormat(
        format,
        () => buildFeatureListMarkdown(race.name, subtitle, race.features),
        () => buildFeatureListHtml(race.name, subtitle ?? '', race.features),
        sanitize(`${race.name}-race`),
      );
      return;
    }
    case 'subrace': {
      const sr = item as Subrace;
      await shareByFormat(
        format,
        () => buildFeatureListMarkdown(sr.name, null, sr.features),
        () => buildFeatureListHtml(sr.name, '', sr.features),
        sanitize(`${sr.name}-subrace`),
      );
      return;
    }
    case 'class': {
      const cls = item as CharClass;
      await shareByFormat(
        format,
        () => buildClassMarkdown(cls),
        () => buildClassHtml(cls),
        sanitize(`${cls.name}-class`),
      );
      return;
    }
    case 'subclass': {
      const sub = item as HomebrewSubclass;
      await shareByFormat(
        format,
        () => buildHomebrewSubclassMarkdown(sub),
        () => buildHomebrewSubclassHtml(sub),
        sanitize(`${sub.name}-subclass`),
      );
      return;
    }
    case 'spell': {
      const spell = item as Spell;
      await shareByFormat(
        format,
        () => buildSpellMarkdown(spell),
        () => buildSpellHtml(spell),
        sanitize(`${spell.name}-spell`),
      );
      return;
    }
    case 'background': {
      const bg = item as Background;
      await shareByFormat(
        format,
        () => buildFeatureListMarkdown(bg.name, null, bg.features),
        () => buildFeatureListHtml(bg.name, '', bg.features),
        sanitize(`${bg.name}-background`),
      );
      return;
    }
    case 'feature': {
      const feat = item as Feature;
      await shareByFormat(
        format,
        () => buildStandaloneFeatureMarkdown(feat),
        () => buildStandaloneFeatureHtml(feat),
        sanitize(`${feat.name}-feature`),
      );
      return;
    }
    case 'item': {
      const it = item as Item;
      const subtitle = `Weight: ${it.weight} lb · Cost: ${it.cost}${it.properties.length ? ` · ${it.properties.join(', ')}` : ''}`;
      await shareByFormat(
        format,
        () => buildFeatureListMarkdown(it.name, subtitle, it.features),
        () => buildFeatureListHtml(it.name, subtitle, it.features),
        sanitize(`${it.name}-item`),
      );
      return;
    }
    case 'feat': {
      const feat = item as Feat;
      const meta = [feat.prerequisite ? `Prerequisite: ${feat.prerequisite}` : null, feat.source].filter(Boolean).join(' · ');
      const feature = { ...feat.feature, description: meta ? `*${meta}*\n\n${feat.description}` : feat.description };
      await shareByFormat(
        format,
        () => buildStandaloneFeatureMarkdown(feature),
        () => buildStandaloneFeatureHtml(feature),
        sanitize(`${feat.name}-feat`),
      );
      return;
    }
    case 'monster': {
      const m = item as MonsterTemplate;
      const subtitle = `${m.size} ${m.type}, ${m.alignment} · CR ${m.cr} · AC ${m.ac.value} · HP ${m.hp.average}`;
      await shareByFormat(
        format,
        () => buildFeatureListMarkdown(m.name, subtitle, m.features),
        () => buildFeatureListHtml(m.name, subtitle, m.features),
        sanitize(`${m.name}-monster`),
      );
      return;
    }
  }
}
