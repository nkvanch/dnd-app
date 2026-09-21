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
  Entity, ContentDB, Race, Subrace, CharClass, HomebrewSubclass, Spell, Background, Feature, Item, Feat, Condition,
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
import { serializePortableCharacter } from './characterPortable';
import { useCustomRuleProfileStore } from '../store/customRuleProfileStore';

export type ExportFormat = 'pdf' | 'txt' | 'md' | 'pack' | 'character-json';

/**
 * 'save' writes straight to a location the user picks, no OS share sheet.
 * 'share' opens the share sheet as before. Android has a real distinct
 * mechanism for 'save' (Storage Access Framework); iOS/web have no SAF
 * equivalent, so 'save' there falls back to the share sheet too — which
 * already surfaces a native "Save to Files"/download target on those
 * platforms, making the two actions converge rather than diverge.
 */
export type ExportAction = 'save' | 'share';

/**
 * Races a promise against a timeout so a hang anywhere downstream (a native
 * module call, a stuck SQLite query) surfaces as a clear error instead of
 * leaving the caller's loading spinner stuck indefinitely — this is what
 * was happening with PDF export: nothing ever rejected, so the UI's
 * try/finally never reached its finally block. Doesn't cancel the
 * underlying work (JS has no way to abort an in-flight native call here),
 * it just stops making the user wait on a promise that may never settle.
 */
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} took too long (over ${Math.round(ms / 1000)}s) and was abandoned. Try again — if it keeps happening, the app may need a restart.`)), ms)
    ),
  ]);
}

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

async function shareUri(uri: string, mimeType: string, dialogTitle: string): Promise<void> {
  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) {
    throw new Error('Sharing isn’t available on this device. The file was written but couldn’t be shared.');
  }
  await withTimeout(Sharing.shareAsync(uri, { mimeType, dialogTitle }), 60000, 'Opening the share sheet');
}

/**
 * Lets the user pick a real folder (e.g. Downloads) and writes straight into
 * it via Storage Access Framework — Android only, no OS share sheet. The
 * directory picker itself is a user-driven wait, hence the generous timeout.
 */
export async function saveTextViaSAF(content: string, filename: string, mimeType: string, encoding: FileSystem.EncodingType): Promise<void> {
  const perm = await withTimeout(FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync(), 120000, 'Waiting for a folder to be chosen');
  if (!perm.granted) {
    throw new Error('No folder was selected, so nothing was saved.');
  }
  const fileUri = await FileSystem.StorageAccessFramework.createFileAsync(perm.directoryUri, filename, mimeType);
  await withTimeout(FileSystem.writeAsStringAsync(fileUri, content, { encoding }), 30000, 'Saving the file');
}

export async function shareText(content: string, filename: string, format: 'txt' | 'md' | 'json', action: ExportAction = 'share'): Promise<void> {
  const mimeType = format === 'md' ? 'text/markdown' : format === 'json' ? 'application/json' : 'text/plain';
  if (action === 'save' && Platform.OS === 'android') {
    await saveTextViaSAF(content, filename, mimeType, FileSystem.EncodingType.UTF8);
    return;
  }
  const uri = FileSystem.cacheDirectory + filename;
  await FileSystem.writeAsStringAsync(uri, content, { encoding: FileSystem.EncodingType.UTF8 });
  await shareUri(uri, mimeType, filename);
}

export async function sharePdfHtml(html: string, dialogTitle: string, action: ExportAction = 'share'): Promise<void> {
  const filename = `${sanitize(dialogTitle)}.pdf`;
  const wantsSaf = action === 'save' && Platform.OS === 'android';
  const result = await withTimeout(Print.printToFileAsync({ html, base64: wantsSaf }), 30000, 'Generating the PDF');

  if (wantsSaf && result.base64) {
    await saveTextViaSAF(result.base64, filename, 'application/pdf', FileSystem.EncodingType.Base64);
    return;
  }
  // expo-print writes its output to its own temp/cache location, which isn't
  // necessarily covered by the app's FileProvider <paths> config — copying
  // into FileSystem.cacheDirectory first (same place shareText already
  // writes to) is what makes Sharing.shareAsync able to actually read it.
  const shareableUri = FileSystem.cacheDirectory + filename;
  await FileSystem.copyAsync({ from: result.uri, to: shareableUri });
  await shareUri(shareableUri, 'application/pdf', dialogTitle);
}

async function shareByFormat(
  format: Exclude<ExportFormat, 'pack' | 'character-json'>,
  buildMarkdown: () => string,
  buildHtml: () => string,
  baseName: string,
  action: ExportAction,
): Promise<void> {
  if (format === 'pdf') {
    await sharePdfHtml(buildHtml(), baseName, action);
    return;
  }
  const md = buildMarkdown();
  const content = format === 'txt' ? stripMarkdown(md) : md;
  await shareText(content, `${baseName}.${format}`, format, action);
}

// ── Character ─────────────────────────────────────────────────────────────────

export async function exportCharacter(entity: Entity, format: ExportFormat, action: ExportAction = 'share'): Promise<void> {
  if (format === 'pack') return;
  if (format === 'character-json') { const profile = useCustomRuleProfileStore.getState().profiles.find(candidate => candidate.id === entity.customRuleProfileId); await shareText(serializePortableCharacter(entity, profile), sanitize((entity.identity.name || 'character') + '-character') + '.grimoire-character.json', 'json', action); return; }
  const db = useHomebrewStore.getState().getMergedContentDB();

  const spellIds = [
    ...(entity.spellcasting?.cantrips ?? []),
    ...(entity.spellcasting?.known ?? entity.spellcasting?.prepared ?? []),
  ];
  const itemIds = [...entity.inventory.equipped, ...entity.inventory.carried].map(i => i.itemId);
  await withTimeout(ensureNamesLoaded(spellIds, itemIds), 20000, 'Loading spell and item names');

  const resolveName: ResolveName = (kind, id) => resolveContentName(db, kind, id);

  await shareByFormat(
    format,
    () => buildCharacterMarkdown(entity, resolveName),
    () => buildCharacterSheetHtml(entity, resolveName),
    sanitize(`${entity.identity.name || 'character'}-character`),
    action,
  );
}

// ── Homebrew ──────────────────────────────────────────────────────────────────

export async function exportHomebrewItem(type: ContentCacheType, item: HomebrewContent, format: ExportFormat, action: ExportAction = 'share'): Promise<void> {
  if (format === 'character-json') throw new Error('Portable Character JSON is available only for characters.');
  // The portable one-entry export is "Export Homebrew": a reviewed single-entry package (its required
  // content included), built by HomebrewExportModal / engine/packageBuilder.ts — not by this readable-copy path.
  if (format === 'pack') throw new Error('Use Export Homebrew for a portable file. This path produces readable copies only.');
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
        action,
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
        action,
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
        action,
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
        action,
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
        action,
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
        action,
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
        action,
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
        action,
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
        action,
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
        action,
      );
      return;
    }
    case 'condition': {
      // Missing case — the (since removed) single-item pack path once handled
      // 'condition'; this switch, covering txt/md/pdf, silently
      // fell through with no matching case and no error (audit finding
      // EXPORT-1). Same buildFeatureListMarkdown/Html pattern background/
      // item already use — a condition's own description as the subtitle.
      const cond = item as Condition;
      await shareByFormat(
        format,
        () => buildFeatureListMarkdown(cond.name, cond.description || null, cond.features),
        () => buildFeatureListHtml(cond.name, cond.description ?? '', cond.features),
        sanitize(`${cond.name}-condition`),
        action,
      );
      return;
    }
  }
}
