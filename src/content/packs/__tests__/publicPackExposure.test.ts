// What ships in the app bundle is assets/packs/*.json. A clean public install must carry no non-SRD or private record anywhere in it, nested
// ones included: the first release check only looked at top-level records and missed 55 non-SRD subraces nested inside the SRD races
// (Eberron, Ravnica, Mordenkainen's), which then showed in the Compendium on a clean install.
import fs from 'fs';
import path from 'path';
import { buildNonSrd51Pack, buildSrd51UnverifiedPack } from '../nonSrdPacks';
import { buildSrd51Pack, buildSrd521Pack, serializePack } from '../srdPacks';

const read = (f: string) => JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', '..', '..', 'assets', 'packs', f), 'utf8')) as { manifest: { id: string }; homebrew: Record<string, unknown> };
const shipped = { s51: read('grimoire.srd.5.1.json'), s521: read('grimoire.srd.5.2.1.json') };

type Node = Record<string, unknown>;
/** Every record-like object (has an id) at any depth, with whether a 2024 ruleset record encloses it. */
function walk(n: unknown, inside2024: boolean, out: { node: Node; inside2024: boolean; path: string }[], p = ''): void {
  if (!n || typeof n !== 'object') return;
  if (Array.isArray(n)) { n.forEach((x, i) => walk(x, inside2024, out, `${p}[${i}]`)); return; }
  const o = n as Node;
  const here = inside2024 || o.rulesetId === 'dnd5e-2024';
  if (typeof o.id === 'string') out.push({ node: o, inside2024: here, path: p });
  for (const [k, v] of Object.entries(o)) walk(v, here, out, `${p}.${k}`);
}

/** Every string under a name key, whether or not its object has an id. */
function collectNames(n: unknown, out: Set<string>): void {
  if (!n || typeof n !== 'object') return;
  if (Array.isArray(n)) { n.forEach(x => collectNames(x, out)); return; }
  for (const [k, v] of Object.entries(n as Node)) { if (k === 'name' && typeof v === 'string') out.add(v); else collectNames(v, out); }
}

describe('the public packs in the bundle', () => {
  it('SRD 5.1: no record at any depth is flagged non-SRD', () => {
    const all: { node: Node; inside2024: boolean; path: string }[] = [];
    walk(shipped.s51.homebrew, false, all);
    expect(all.filter(x => x.node.srd === false).map(x => `${x.path}:${x.node.id}`)).toEqual([]);
    // an SRD race carries only subraces that are themselves SRD
    for (const r of shipped.s51.homebrew.races as { id: string; subraces?: { id: string; srd?: boolean }[] }[]) {
      expect([r.id, (r.subraces ?? []).filter(s => s.srd !== true).map(s => s.id)]).toEqual([r.id, []]);
    }
  });

  it('SRD 5.2.1: only the 2024 records themselves carry srd:false (that flag means "not SRD 5.1" there); nothing 2014 does', () => {
    const all: { node: Node; inside2024: boolean; path: string }[] = [];
    walk(shipped.s521.homebrew, false, all);
    expect(all.filter(x => x.node.srd === false && !x.inside2024).map(x => `${x.path}:${x.node.id}`)).toEqual([]);
  });

  it('no name that exists only in a private pack appears in a public pack', () => {
    const publicNames = new Set<string>();
    const publicIds = new Set<string>();
    for (const p of [shipped.s51, shipped.s521]) {
      const all: { node: Node; inside2024: boolean; path: string }[] = [];
      walk(p.homebrew, false, all);
      for (const x of all) publicIds.add(String(x.node.id));
      collectNames(p.homebrew, publicNames);
    }
    const privateOnly = new Map<string, string>();
    for (const pack of [buildNonSrd51Pack(), buildSrd51UnverifiedPack()]) {
      const all: { node: Node; inside2024: boolean; path: string }[] = [];
      walk(JSON.parse(serializePack(pack)).homebrew, false, all);
      for (const x of all) {
        const name = x.node.name;
        // classes, subclasses, species, subraces, backgrounds, feats, spells and items by name; short or generic names (Cunning) are not tested
        if (typeof name === 'string' && name.length >= 9 && !publicIds.has(String(x.node.id)) && !publicNames.has(name) && /^(classes|subclasses|races|backgrounds|feats|spells|items)\b/.test(x.path.replace(/^\./, ''))) {
          privateOnly.set(name, String(x.node.id));
        }
      }
    }
    const text = JSON.stringify([shipped.s51.homebrew, shipped.s521.homebrew]);
    const leaked = [...privateOnly.keys()].filter(n => text.includes(`"name":${JSON.stringify(n)}`));
    expect(leaked).toEqual([]);
  });

  it('the shipped files are what the builders produce today', () => {
    expect(shipped.s51.manifest).toMatchObject({ id: buildSrd51Pack().manifest.id, contentHash: buildSrd51Pack().manifest.contentHash });
    expect(shipped.s521.manifest).toMatchObject({ id: buildSrd521Pack().manifest.id, contentHash: buildSrd521Pack().manifest.contentHash });
  });
});

describe('the private non-SRD pack puts the non-SRD subraces back', () => {
  it('with the public pack alone a Tiefling has no Abyssal subrace; with the private pack installed after it, it does', () => {
    const { packContentProvider } = require('../../provider/contentProvider') as typeof import('../../provider/contentProvider');
    const pub = [buildSrd51Pack(), buildSrd521Pack()].map(p => JSON.parse(serializePack(p)));
    const priv = JSON.parse(serializePack(buildNonSrd51Pack()));
    const subs = (packs: unknown[], race: string) => ((packContentProvider(packs as never).getRace(race) as { subraces?: { id: string }[] } | undefined)?.subraces ?? []).map(s => s.id);
    expect(subs(pub, 'tiefling')).toEqual([]);
    expect(subs([...pub, priv], 'tiefling')).toEqual(expect.arrayContaining(['abyssal_tiefling', 'variant_tiefling']));
    expect(subs(pub, 'elf')).toEqual(['high_elf']);
    expect(subs([...pub, priv], 'elf')).toEqual(expect.arrayContaining(['high_elf', 'drow', 'wood_elf']));
  });
});
