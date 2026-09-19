#!/usr/bin/env node
// ============================================================================
// FILE: scripts/generate-content-db.mjs
// Build-time generator: reads the static spell and item content from
// src/content/** and writes a seed SQLite database (assets/content.db) that
// ships as a bundled asset and is copied into the app's writable SQLite
// directory on first launch — see src/db/contentDb.ts and
// src/content/spellRepo.native.ts / itemRepo.native.ts.
//
// Run with: npx tsx scripts/generate-content-db.mjs
// (tsx is required only to import the .ts content source files directly —
// this script itself never ships in the app bundle, it's build-time-only,
// same role as convert-spells.mjs / parse_items.py.)
//
// Re-run this whenever spell content changes, then re-bundle the app so the
// new assets/content.db is picked up. The `contentVersion` meta row is a deterministic hash of authoritative content
// and changes whenever generated content changes, which is what triggers contentDb.ts to re-copy the asset
// over a stale previously-installed database on a user's device.
// ============================================================================
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import { createHash } from 'node:crypto';

import { FULL_SPELL_LIBRARY } from '../src/content/spells/index.ts';
import { FULL_ITEM_LIBRARY } from '../src/content/items/index.ts';
import { toItemIndexEntry } from '../src/content/itemRepo.types.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR   = path.join(__dirname, '..', 'assets');
const OUT_PATH  = path.join(OUT_DIR, 'content.db');

fs.mkdirSync(OUT_DIR, { recursive: true });
// Start clean each run — this is a generated artifact, not hand-edited.
if (fs.existsSync(OUT_PATH)) fs.rmSync(OUT_PATH);

const db = new DatabaseSync(OUT_PATH);

// `_rowid` is an explicit INTEGER PRIMARY KEY so the table is keyed by a
// fast integer rowid internally; `id` stays the TEXT identifier used
// everywhere in the app (content files, saved characters, sync payloads),
// with its own unique index for O(log n) lookups by string id.
db.exec(`
  CREATE TABLE spells (
    _rowid        INTEGER PRIMARY KEY,
    id            TEXT NOT NULL UNIQUE,
    name          TEXT NOT NULL,
    level         INTEGER NOT NULL,
    school        TEXT NOT NULL,
    castingTime   TEXT NOT NULL,
    ritual        INTEGER NOT NULL,
    concentration INTEGER NOT NULL,
    classes       TEXT,
    srd           INTEGER,
    rulesetId     TEXT,
    components    TEXT,
    data          TEXT NOT NULL
  );
  CREATE INDEX idx_spells_name  ON spells(name);
  CREATE INDEX idx_spells_level ON spells(level);

  CREATE TABLE items (
    _rowid          INTEGER PRIMARY KEY,
    id              TEXT NOT NULL UNIQUE,
    name            TEXT NOT NULL,
    weight          REAL NOT NULL,
    cost            TEXT NOT NULL,
    properties      TEXT NOT NULL,
    hasDamageEffect INTEGER NOT NULL,
    weaponRange     TEXT,
    srd             INTEGER,
    rulesetId       TEXT,
    data            TEXT NOT NULL
  );
  CREATE INDEX idx_items_name ON items(name);

  CREATE TABLE meta (
    key   TEXT PRIMARY KEY NOT NULL,
    value TEXT NOT NULL
  );
`);

const insertSpell = db.prepare(`
  INSERT INTO spells (id, name, level, school, castingTime, ritual, concentration, classes, srd, rulesetId, components, data)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);
const insertItem = db.prepare(`
  INSERT INTO items (id, name, weight, cost, properties, hasDamageEffect, weaponRange, srd, rulesetId, data)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const seenIds = new Set();
let dupCount = 0;
for (const spell of FULL_SPELL_LIBRARY) {
  if (seenIds.has(spell.id)) {
    dupCount++;
    console.warn(`  ! duplicate spell id "${spell.id}" — keeping first occurrence`);
    continue;
  }
  seenIds.add(spell.id);
  insertSpell.run(
    spell.id,
    spell.name,
    spell.level,
    spell.school,
    spell.castingTime,
    spell.ritual ? 1 : 0,
    spell.concentration ? 1 : 0,
    spell.classes && spell.classes.length > 0 ? JSON.stringify(spell.classes) : null,
    spell.srd === undefined ? null : (spell.srd ? 1 : 0),
    spell.rulesetId ?? null,
    spell.components && spell.components.length > 0 ? JSON.stringify(spell.components) : null,
    JSON.stringify(spell)
  );
}

const seenItemIds = new Set();
let itemDupCount = 0;
for (const item of FULL_ITEM_LIBRARY) {
  if (seenItemIds.has(item.id)) {
    itemDupCount++;
    console.warn(`  ! duplicate item id "${item.id}" — keeping first occurrence`);
    continue;
  }
  seenItemIds.add(item.id);
  const entry = toItemIndexEntry(item);
  insertItem.run(
    item.id,
    item.name,
    item.weight,
    item.cost,
    JSON.stringify(item.properties),
    entry.hasDamageEffect ? 1 : 0,
    entry.weaponRange,
    item.srd === undefined ? null : (item.srd ? 1 : 0),
    item.rulesetId ?? null,
    JSON.stringify(item)
  );
}

const contentVersion = createHash('sha256')
  .update(JSON.stringify({ spells: FULL_SPELL_LIBRARY, items: FULL_ITEM_LIBRARY }))
  .digest('hex');
const setMeta = db.prepare('INSERT INTO meta (key, value) VALUES (?, ?)');
setMeta.run('contentVersion', contentVersion);
setMeta.run('schemaVersion', '2');

db.close();

// Written alongside the DB so the app knows, at build time, which version to
// expect on disk — src/db/contentDb.ts compares this constant against the
// app_meta-stored version of whatever's already installed on the device and
// re-imports the bundled asset (overwriting the stale copy) if they differ.
const versionFilePath = path.join(__dirname, '..', 'src', 'content', 'contentDbVersion.ts');
fs.writeFileSync(
  versionFilePath,
  `// AUTO-GENERATED by scripts/generate-content-db.mjs — do not hand-edit.\n` +
  `export const CONTENT_DB_VERSION = '${contentVersion}';\n`
);

const sizeKb = (fs.statSync(OUT_PATH).size / 1024).toFixed(1);
console.log(`Wrote ${seenIds.size} spells (${dupCount} duplicates skipped) and ${seenItemIds.size} items (${itemDupCount} duplicates skipped) to ${OUT_PATH} (${sizeKb} KB)`);
console.log(`contentVersion = ${contentVersion}`);
