/** Produces the data-only snapshot used by public-build Metro aliases. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ALL_SPELLS } from '../src/content/spells/index';
import { ALL_ITEMS } from '../src/content/items/index';
import { ALL_CHAR_CLASSES, ALL_CLASS_PROGRESSIONS } from '../src/content/classes/index';
import { ALL_RACES, raceHuman, raceSkeleton } from '../src/content/races/index';
import { ALL_BACKGROUNDS, bgSoldier } from '../src/content/backgrounds/index';
import { ALL_FEATS } from '../src/content/feats/index';
import { ALL_SUBCLASSES } from '../src/content/subclasses/index';
import { ALL_MONSTER_TEMPLATES } from '../src/content/monsters/srd';

if (process.env.EXPO_PUBLIC_SRD_ONLY !== 'true') throw new Error('Requires EXPO_PUBLIC_SRD_ONLY=true.');
const publicClassIds = new Set(ALL_CHAR_CLASSES.map(value => value.id));
const snapshot = {
  spells: ALL_SPELLS, items: ALL_ITEMS, classes: ALL_CHAR_CLASSES,
  progressions: ALL_CLASS_PROGRESSIONS.filter(value => publicClassIds.has(value.classId)),
  races: ALL_RACES, originalRaces: [raceHuman, raceSkeleton],
  backgrounds: ALL_BACKGROUNDS, originalBackgrounds: [bgSoldier],
  feats: ALL_FEATS, subclasses: ALL_SUBCLASSES, monsters: ALL_MONSTER_TEMPLATES,
};
const here = path.dirname(fileURLToPath(import.meta.url));
const output = path.join(here, '..', 'src', 'content', 'public', 'publicContent.json');
fs.writeFileSync(output, `${JSON.stringify(snapshot, null, 2)}\n`);
console.log(`Wrote public snapshot: ${snapshot.items.length} items, ${snapshot.spells.length} spells.`);
