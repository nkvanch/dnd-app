import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { CustomRuleProfile, Entity } from '../engine/types';
import { migrateEntity } from '../engine/multiclass';
import { validateEntityShape } from '../engine/homebrewValidator';
import { persistedCharacterExists } from '../db/entityRepo';
import { identifyGrimoireImport, WRONG_CHARACTER_IMPORTER_MESSAGE } from './importEnvelope';

export type PortableCharacter = { format: 'grimoire-character'; version: 1; exportedAt: number; entity: Entity; customRuleProfile?: CustomRuleProfile };
export type ParsedPortableCharacter = { entity: Entity; importedAsCopy: boolean; profileToImport?: CustomRuleProfile };

export function serializePortableCharacter(entity: Entity, customRuleProfile?: CustomRuleProfile): string {
  return JSON.stringify({ format: 'grimoire-character', version: 1, exportedAt: Date.now(), entity, ...(customRuleProfile ? { customRuleProfile } : {}) } satisfies PortableCharacter, null, 2);
}

export function parsePortableCharacter(text: string, existingIds: ReadonlySet<string> = new Set(), localProfiles: readonly CustomRuleProfile[] = []): ParsedPortableCharacter {
  let raw: unknown;
  try { raw = JSON.parse(text); } catch { throw new Error('This file is not valid JSON.'); }
  if (!raw || typeof raw !== 'object') throw new Error('Invalid Grimoire Character file.');
  if (identifyGrimoireImport(raw) === 'homebrew-package') throw new Error(WRONG_CHARACTER_IMPORTER_MESSAGE);
  const envelope = raw as Partial<PortableCharacter>;
  if (envelope.format !== 'grimoire-character' || envelope.version !== 1 || !envelope.entity) throw new Error('Unsupported Grimoire Character format or version.');
  const migrated = migrateEntity(envelope.entity);
  const validation = validateEntityShape(migrated);
  if (!validation.valid) throw new Error('Character validation failed: ' + validation.errors.join('; '));
  const entity = migrated; let profileToImport: CustomRuleProfile | undefined;
  if (entity.customRuleProfileId) {
    const local = localProfiles.find(profile => profile.id === entity.customRuleProfileId);
    const embedded = envelope.customRuleProfile?.id === entity.customRuleProfileId ? envelope.customRuleProfile : undefined;
    if (!local && embedded) profileToImport = embedded;
    else if (!local && !embedded) throw new Error('This character references a custom rule profile that is not embedded in the file.');
    else if (local && embedded && (local.baseRulesetId !== embedded.baseRulesetId || JSON.stringify(local.rules) !== JSON.stringify(embedded.rules))) profileToImport = embedded;
  }
  if (!existingIds.has(entity.id)) return { entity, importedAsCopy: false, profileToImport };
  const suffix = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  return { entity: { ...entity, id: entity.id + '-copy-' + suffix, identity: { ...entity.identity, name: (entity.identity.name || 'Unnamed') + ' (Imported Copy)' } }, importedAsCopy: true, profileToImport };
}

export async function resolvePortableCharacterImport(
  text: string,
  localProfiles: readonly CustomRuleProfile[] = [],
  characterExists: (id: string) => Promise<boolean> = persistedCharacterExists,
): Promise<ParsedPortableCharacter> {
  // Parse and validate before consulting persistence. Profile ids are handled
  // independently and can never become character-id collisions.
  const parsed = parsePortableCharacter(text, new Set(), localProfiles);
  if (!(await characterExists(parsed.entity.id))) return parsed;
  return parsePortableCharacter(text, new Set([parsed.entity.id]), localProfiles);
}

export async function pickPortableCharacter(localProfiles: readonly CustomRuleProfile[] = []): Promise<ParsedPortableCharacter | null> {
  const result = await DocumentPicker.getDocumentAsync({ type: 'application/json', copyToCacheDirectory: true });
  if (result.canceled) return null;
  const text = await FileSystem.readAsStringAsync(result.assets[0].uri, { encoding: FileSystem.EncodingType.UTF8 });
  return resolvePortableCharacterImport(text, localProfiles);
}
