// ============================================================================
// FILE: src/content/packDownload.ts
// Downloading content packs from a link. Pure logic with the network injected (so it is testable and has no React Native
// import): the address is checked, the response is size-limited and, when a catalog gave a SHA-256, hashed before anything
// reads it. What comes back is only ever a file's text; it is then validated, hash-checked, signature-checked and confirmed by
// the player exactly like a pack picked from the device (officialPackService.previewOfficialPack). Nothing is installed here.
//
// A catalog is a small JSON file a publisher hosts next to the packs, listing what is available:
//   { "format": "grimoire-pack-catalog", "version": 1, "packs": [ { "id", "name", "version", "ruleset", "url", "sha256", "size" } ] }
// scripts/make-pack-catalog.ts writes one for the public packs.
// ============================================================================
import { sha256Hex } from '../engine/sha256';
import { compareVersions } from '../engine/contentPackManifest';

export const MAX_PACK_DOWNLOAD_BYTES = 40 * 1024 * 1024;

export type CatalogEntry = { id: string; name: string; version: string; ruleset: string; url: string; sha256: string; size: number; description?: string };
export type PackCatalog = { format: 'grimoire-pack-catalog'; version: 1; packs: CatalogEntry[] };

export type FetchLike = (url: string) => Promise<{ ok: boolean; status: number; headers?: { get(name: string): string | null }; text(): Promise<string> }>;

const LOCAL_HTTP = /^http:\/\/(localhost|127\.0\.0\.1|10\.0\.2\.2)(:\d+)?(\/|$)/i;

/** Whether a pack may be fetched from this address: https, or plain http only to this device or the Android emulator's host. Null when fine, else why not. */
export function checkPackUrl(url: string): string | null {
  const u = url.trim();
  if (!u) return 'Enter a link to a pack file.';
  if (/^https:\/\/[^\s/]+/i.test(u)) return null;
  if (LOCAL_HTTP.test(u)) return null;
  if (/^http:\/\//i.test(u)) return 'Packs are only downloaded over https, so nobody on the way can change them.';
  return 'That is not a web address (it should start with https://).';
}

export class PackDownloadError extends Error {
  constructor(message: string) { super(message); this.name = 'PackDownloadError'; }
}

/** Downloads a pack (or catalog) file as text, refusing a bad address, a failed request, an oversized file, or a hash that does not match. */
export async function downloadText(url: string, options: { fetchImpl?: FetchLike; maxBytes?: number; expectedSha256?: string } = {}): Promise<string> {
  const bad = checkPackUrl(url);
  if (bad) throw new PackDownloadError(bad);
  const fetchImpl: FetchLike = options.fetchImpl ?? (fetch as unknown as FetchLike);
  const max = options.maxBytes ?? MAX_PACK_DOWNLOAD_BYTES;
  let response;
  try { response = await fetchImpl(url.trim()); }
  catch (e) { throw new PackDownloadError(`Could not reach ${url.trim()} (${e instanceof Error ? e.message : String(e)}). Check the link and your connection.`); }
  if (!response.ok) throw new PackDownloadError(`The server answered ${response.status}, not a file. Check the link.`);
  const declared = Number(response.headers?.get('content-length') ?? NaN);
  if (Number.isFinite(declared) && declared > max) throw new PackDownloadError(`That file is ${Math.round(declared / 1048576)} MB, more than the ${Math.round(max / 1048576)} MB a pack can be.`);
  const text = await response.text();
  if (text.length > max) throw new PackDownloadError(`That file is larger than the ${Math.round(max / 1048576)} MB a pack can be.`);
  if (options.expectedSha256 && sha256Hex(text) !== options.expectedSha256.toLowerCase()) {
    throw new PackDownloadError('The downloaded file does not match the checksum its catalog lists, so it was changed or damaged. It was not used.');
  }
  return text;
}

/** Reads a catalog file; relative `url`s are resolved against the catalog's own address. Throws a readable message if it is not one. */
export function parseCatalog(text: string, catalogUrl: string): PackCatalog {
  let raw: unknown;
  try { raw = JSON.parse(text); } catch { throw new PackDownloadError('That is not a pack catalog (it is not valid JSON).'); }
  const o = raw as Partial<PackCatalog> | null;
  if (!o || o.format !== 'grimoire-pack-catalog' || o.version !== 1 || !Array.isArray(o.packs)) throw new PackDownloadError('That is not a Grimoire pack catalog.');
  const packs: CatalogEntry[] = [];
  for (const p of o.packs as Partial<CatalogEntry>[]) {
    if (!p || typeof p.id !== 'string' || typeof p.version !== 'string' || typeof p.url !== 'string' || typeof p.sha256 !== 'string' || !/^[0-9a-f]{64}$/i.test(p.sha256)) continue;
    let url = p.url;
    if (!/^https?:\/\//i.test(url)) url = new URL(url, catalogUrl).toString();
    if (checkPackUrl(url)) continue;
    packs.push({ id: p.id, name: p.name ?? p.id, version: p.version, ruleset: p.ruleset ?? '', url, sha256: p.sha256.toLowerCase(), size: Number(p.size) || 0, ...(p.description ? { description: p.description } : {}) });
  }
  return { format: 'grimoire-pack-catalog', version: 1, packs };
}

export type CatalogStatus = CatalogEntry & { status: 'new' | 'update' | 'installed' };

/** Each catalog pack against what is installed: not installed, installed with a newer version listed, or up to date. Newest listed version of an id only. */
export function catalogStatus(catalog: PackCatalog, installed: readonly { id: string; version: string }[]): CatalogStatus[] {
  const newest = new Map<string, CatalogEntry>();
  for (const p of catalog.packs) { const have = newest.get(p.id); if (!have || compareVersions(p.version, have.version) > 0) newest.set(p.id, p); }
  return [...newest.values()].map(p => {
    const mine = installed.find(i => i.id === p.id);
    const status = !mine ? 'new' : compareVersions(p.version, mine.version) > 0 ? 'update' : 'installed';
    return { ...p, status };
  });
}
