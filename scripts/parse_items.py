#!/usr/bin/env python3
"""
Parse a D&D items markdown file into a TypeScript Item[] module.

Usage:
    python scripts/parse_items.py [SOURCE_MD] [OUTPUT_TS]

Defaults:
    SOURCE_MD = the "Items with descriptions.md" path below (edit to your vault path)
    OUTPUT_TS = src/content/items/importedItems.ts

The markdown format expected (blocks separated by blank lines / "---"):

    # Item Name
    Type: Martial Melee Weapon
    Damage: 1d8 Slashing
    Properties: Versatile (1d10)
    Weight: 4 lb.
    Description: A heavy axe ...

Weapons (anything with a Damage: line) get an attack Feature with an
`activation` block so the engine generates an Action Card for them. Armor
(AC: line or "X Armor" Type) gets a base_ac_formula effect. Everything else
becomes a passive descriptive feature. Magic bonuses (+1/+2/+3) in the name or
a Bonus: line are recorded as properties so the attack-bonus calculation can
pick them up.

Re-run this whenever you add items to the source markdown (e.g. new
sourcebooks). It overwrites importedItems.ts. The id of each item is a slug of
its name; items whose id collides with a hand-authored item in
src/content/items/index.ts are still emitted here, but index.ts dedups them out
(hand-authored wins) when building ALL_ITEMS.
"""
import re, json, sys, os

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(HERE)

# EDIT this default to point at your vault file, or pass it as argv[1].
DEFAULT_SRC = r'D:\Documents\Sort later\YSB\Obsidian Vault\DND\DND ჩემი\Items\Items with descriptions.md'
DEFAULT_OUT = os.path.join(REPO, 'src', 'content', 'items', 'importedItems.ts')

SRC = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_SRC
OUT = sys.argv[2] if len(sys.argv) > 2 else DEFAULT_OUT

with open(SRC, encoding='utf-8') as f:
    raw = f.read()

blocks = []
current = None
for line in raw.splitlines():
    if line.startswith('# '):
        if current:
            blocks.append(current)
        current = {'name': line[2:].strip(), 'lines': []}
    elif current is not None:
        current['lines'].append(line)
if current:
    blocks.append(current)


def clean_desc(text):
    text = re.sub(r':contentReference\[[^\]]*\]\{[^}]*\}', '', text)
    text = re.sub(r'\(\[[^\]]*\]\([^)]*\)\)', '', text)
    text = re.sub(r'\[([^\]]*)\]\([^)]*\)', r'\1', text)
    return text.strip()


def slugify(name):
    s = name.lower()
    s = re.sub(r'[^a-z0-9]+', '_', s)
    return s.strip('_')


DAMAGE_RE = re.compile(r'(\d+d\d+|\d+)\s+(\w+)', re.I)
MAGIC_RE = re.compile(r'\+(\d)\b')

# ── SRD 5.1 legal classification ────────────────────────────────────────────────
# See docs/ROADMAP_1.0.md Phase 1 Step 1.4 for full context. Mirrors the same
# safety-first approach used in scripts/convert-spells.mjs for spells:
#   - Regex-detect Product Identity naming (named-wizard-style items, e.g.
#     "Ring of Winter" isn't PI, but "Draco's Amulet" would be) -> srd: False.
#   - Everything else stays UNCLASSIFIED (no 'srd' key at all) -> the Item
#     type's own contract treats undefined as "not yet audited, unsafe for
#     public builds". This is deliberately conservative: unlike spells, this
#     file has no per-item sourcebook label to lean on yet, and magic items
#     are a much higher Product-Identity-density category than mundane gear.
# NOT YET DONE (flagged honestly, not attempted this pass): a real ALLOW list
# of confirmed-SRD generic magic items (e.g. Bag of Holding, Potion of
# Healing, +1 Weapon, Ring of Protection are classic SRD-legal items) would
# need the same read-and-classify treatment the spell audit got, across
# what's likely several hundred items. Left for a dedicated future session.
PI_NAME_RE = re.compile(
    r"\b(Tasha|Melf|Bigby|Otiluke|Leomund|Otto|Rary|Evard|Nystul|Drawmij|"
    r"Mordenkainen|Tenser|Aganazzar|Snilloc|Abi-Dalzim|Maximilian|Daern|Heward|"
    r"Keoghtom)('s)?\b",
    re.I,
)

# Confirmed non-D&D / out-of-genre content found while reading the vault
# directly (not a Product Identity issue — just not real D&D material at all,
# shouldn't be presented as official content either way).
DENY_NAMES = {
    'Antimatter Rifle',
}

# Mundane, non-magical gear — directly verified while reading the vault.
# Zero Product Identity risk regardless of magic-item SRD questions; this is
# the same equipment-table content already confirmed safe in index.ts.
MUNDANE_ALLOW_NAMES = {
    'Abacus', "Acid (Vial)", "Alchemist's Fire", "Alchemist's Supplies",
    'Amulet', 'Animal Feed (Per Day)', 'Antitoxin', 'Backpack', 'Bagpipes',
    'Ball Bearings', 'Barrel', 'Basic Poison', 'Basket', 'Bedroll', 'Bell',
    'Blanket', 'Block and Tackle', 'Blowgun Needles', 'Bolts', 'Book',
    'Bottle', "Brewer's Supplies", 'Bucket', "Burglar's Key",
    'Burnt Othur Fumes', "Calligrapher's Supplies", 'Candle',
    "Carpenter's Tools", 'Carrion Crawler Mucus', "Cartographer's Tools",
    'Case, Crossbow Bolt', 'Case, Map or Scroll', 'Chalk', 'Chest',
    'Component Pouch', "Cook's Utensils", 'Crossbow Bolt Case', 'Crowbar',
    'Crystal', 'Fine Clothes', 'Fishing Tackle', 'Flask', 'Flute',
    'Forgery Kit', 'Frying Pan', "Glassblower's Tools", 'Gold Piece',
    "Grinder's Tools", "Gunner's Pack", 'Hammer', 'Harp', "Healer's Kit",
    'Herbalism Kit', 'Holy Symbol (Amulet)', 'Holy Symbol (Emblem)',
    'Holy Symbol (Reliquary)', 'Horn', 'Hourglass', 'Hunting Trap',
    'Ink (1 oz Bottle)', 'Ink Pen', "Jeweler's Tools", 'Key',
    'Kitchen Knife', 'Ladle', 'Lantern, Bullseye', 'Lantern, Hooded',
    'Lock', 'Map Case', 'Marble', 'Lyre',
}

# Classic GENERIC DMG magic items — directly verified while reading the vault.
# These have no Product Identity naming (named by function/effect, not by a
# named wizard) and match the generous-inclusion pattern confirmed repeatedly
# elsewhere in this audit (spells/classes/races/backgrounds). Still a judgment
# call, same caveat as everywhere else in the audit: verify against the real
# SRD 5.1 text before a public build ships.
MAGIC_ALLOW_NAMES = {
    'Adamantine Armor', 'Adamantine Breastplate', 'Adamantine Chain Mail',
    'Adamantine Chain Shirt', 'Adamantine Half Plate Armor',
    'Adamantine Plate Armor', 'Adamantine Ring Mail', 'Adamantine Scale Mail',
    'Adamantine Splint Armor', 'Amulet of Health',
    'Amulet of Proof Against Detection and Location', 'Amulet of the Planes',
    'Animated Shield', 'Armor of Invulnerability',
    'Armor of Vulnerability', 'Arrow +1', 'Arrow +2', 'Arrow +3',
    'Arrow of Aberration Slaying', 'Arrow of Beast Slaying',
    'Arrow of Celestial Slaying', 'Arrow of Construct Slaying',
    'Arrow of Dragon Slaying', 'Arrow of Elemental Slaying',
    'Arrow of Fey Slaying', 'Arrow of Fiend Slaying', 'Arrow of Giant Slaying',
    'Arrow of Humanoid Slaying', 'Arrow of Monstrosity Slaying',
    'Arrow of Ooze Slaying', 'Arrow of Plant Slaying', 'Arrow of Undead Slaying',
    'Bag of Beans', 'Bag of Devouring', 'Bag of Holding', 'Bag of Tricks',
    'Battleaxe +1', 'Battleaxe +2', 'Battleaxe +3', 'Battleaxe of Warning',
    'Bead of Force', 'Bead of Nourishment',
    'Belt of Hill Giant Strength', 'Belt of Frost Giant Strength',
    'Belt of Stone Giant Strength', 'Belt of Fire Giant Strength',
    'Belt of Cloud Giant Strength', 'Belt of Storm Giant Strength',
    'Belt of Dwarvenkind', 'Berserker Axe',
    'Black Dragon Scale Mail', 'Blue Dragon Scale Mail',
    'Blowgun +1', 'Blowgun +2', 'Blowgun +3', 'Blowgun of Warning',
    'Blue Sapphire Elemental Gem', 'Boots of Elvenkind', 'Boots of Levitation',
    'Boots of Speed', 'Boots of Striding and Springing',
    'Boots of the Winterlands', 'Boots of False Tracks',
    'Bowl of Commanding Water Elementals', 'Bracers of Archery',
    'Bracers of Defense', 'Brazier of Commanding Fire Elementals',
    'Breastplate +1', 'Breastplate +2', 'Breastplate +3',
    'Breastplate Armor of Resistance', 'Cape of the Mountebank',
    'Carpet of Flying', 'Censer of Controlling Air Elementals',
    'Chain Mail +1', 'Chain Mail +2', 'Chain Mail +3',
    # Chain Shirt / Cloak / Club families
    'Chain Shirt +1', 'Chain Shirt +2', 'Chain Shirt +3', 'Chime of Opening',
    'Cloak of Arachnida', 'Cloak of Displacement', 'Cloak of Elvenkind',
    'Cloak of Protection', 'Cloak of the Bat', 'Cloak of the Manta Ray',
    'Club +1', 'Club +2', 'Club +3', 'Club of Warning',
    # Dragon Scale Mail family (generic + all 10 colors)
    'Dragon Scale Mail', 'Black Dragon Scale Mail', 'Blue Dragon Scale Mail',
    'Brass Dragon Scale Mail', 'Bronze Dragon Scale Mail',
    'Copper Dragon Scale Mail', 'Gold Dragon Scale Mail',
    'Green Dragon Scale Mail', 'Red Dragon Scale Mail',
    'Silver Dragon Scale Mail', 'White Dragon Scale Mail',
    'Cornucopia of Plenty',
    'Crystal Ball', 'Crystal Ball of Mind Reading',
    'Crystal Ball of Telepathy', 'Crystal Ball of True Seeing',
    'Cube of Force', 'Cubic Gate',
    'Dagger +1', 'Dagger +2', 'Dagger +3', 'Dagger of Venom',
    'Dagger of Warning',
    'Dancing Greatsword', 'Dancing Longsword', 'Dancing Rapier',
    'Dancing Scimitar', 'Dancing Shortsword',
    'Dart +1', 'Dart +2', 'Dart +3', 'Dart of Warning',
    'Decanter of Endless Water', 'Deck of Illusions', 'Deck of Many Things',
    # Defender weapon family (17 variants)
    'Defender Club', 'Defender Dagger', 'Defender Greatclub',
    'Defender Handaxe', 'Defender Javelin', 'Defender Light Hammer',
    'Defender Mace', 'Defender Quarterstaff', 'Defender Rapier',
    'Defender Scimitar', 'Defender Shortsword', 'Defender Sickle',
    'Defender Spear', 'Defender Trident', 'Defender War Pick',
    'Defender Warhammer', 'Defender Whip',
    'Demon Armor', 'Dimensional Shackles',
    # Dragon Slayer weapon family (8 variants)
    'Dragon Slayer Battleaxe', 'Dragon Slayer Dagger',
    'Dragon Slayer Greatsword', 'Dragon Slayer Longsword',
    'Dragon Slayer Quarterstaff', 'Dragon Slayer Spear',
    'Dragon Slayer Trident', 'Dragon Slayer Warhammer',
    'Dust of Disappearance', 'Dust of Dryness',
    'Dust of Sneezing and Choking',
    'Dwarven Half Plate Armor', 'Dwarven Plate Armor', 'Dwarven Thrower',
    'Ebony Fly', 'Efficient Quiver',
    'Efreeti Bottle', 'Efreeti Chain Mail', 'Efreeti Chain Shirt',
    # Elemental Gem family (completing all 4 with Blue Sapphire above)
    'Emerald Elemental Gem', 'Red Corundum Elemental Gem',
    'Yellow Diamond Elemental Gem',
    'Elixir of Health', 'Elven Chain', 'Energy Longbow', 'Energy Shortbow',
    'Eversmoking Bottle', 'Eyes of Charming', 'Eyes of Minute Seeing',
    'Eyes of the Eagle',
    # Feather Token family (6)
    'Feather Token (Anchor)', 'Feather Token (Bird)', 'Feather Token (Fan)',
    'Feather Token (Swan Boat)', 'Feather Token (Tree)',
    'Feather Token (Whip)',
    # Figurine of Wondrous Power family (9)
    'Figurine of Wondrous Power (Bronze Griffon)',
    'Figurine of Wondrous Power (Ebony Fly)',
    'Figurine of Wondrous Power (Golden Lions)',
    'Figurine of Wondrous Power (Ivory Goats)',
    'Figurine of Wondrous Power (Marble Elephant)',
    'Figurine of Wondrous Power (Obsidian Steed)',
    'Figurine of Wondrous Power (Onyx Dog)',
    'Figurine of Wondrous Power (Serpentine Owl)',
    'Figurine of Wondrous Power (Silver Raven)',
    # Flame Tongue family (7)
    'Flame Tongue Battleaxe', 'Flame Tongue Glaive',
    'Flame Tongue Greatsword', 'Flame Tongue Longsword',
    'Flame Tongue Rapier', 'Flame Tongue Scimitar',
    'Flame Tongue Shortsword',
    'Flying Carpet (3x5)', 'Flying Carpet (4x6)', 'Flying Carpet (5x7)',
    'Flying Carpet (6x9)', 'Folding Boat',
    # Frost Brand family (6)
    'Frost Brand Battleaxe', 'Frost Brand Greatsword',
    'Frost Brand Longsword', 'Frost Brand Rapier', 'Frost Brand Scimitar',
    'Frost Brand Shortsword',
    'Gauntlets of Ogre Power', 'Gem of Brightness', 'Gem of Seeing',
    'Giant Slayer Battleaxe', 'Giant Slayer Greatsword',
    'Giant Slayer Longsword', 'Giant Slayer Warhammer',
    'Glaive +1', 'Glaive +2', 'Glaive +3', 'Glaive of Warning',
    'Gloves of Missile Snaring', 'Gloves of Swimming and Climbing',
    'Goggles of Night',
    'Greataxe +1', 'Greataxe +2', 'Greataxe +3', 'Greataxe of Sharpness',
    'Greatclub +1', 'Greatclub +2', 'Greatclub +3', 'Greatclub of Warning',
    'Greatsword +1', 'Greatsword +2', 'Greatsword +3',
    'Greatsword of Sharpness',
    'Halberd +1', 'Halberd +2', 'Halberd +3', 'Halberd of Warning',
    'Hammer of Thunderbolts', 'Handaxe +1', 'Handaxe +2', 'Handaxe +3',
    'Handy Haversack', 'Harp of Charming', 'Hat of Disguise',
    'Headband of Intellect', 'Holy Avenger', 'Horn of Blasting',
    'Horn of Silent Alarm', 'Horn of Valhalla (Silver)',
    'Horn of Valhalla (Brass)', 'Horn of Valhalla (Bronze)',
    'Horn of Valhalla (Iron)', 'Horseshoes of Speed',
    'Horseshoes of a Zephyr',
    'Immovable Rod', 'Instrument of Illusions',
    # Instrument of the Bards family (7)
    'Instrument of the Bards (Doss Lute)',
    'Instrument of the Bards (Fochlucan Bandore)',
    'Instrument of the Bards (Mac-Fuirmidh Cittern)',
    'Instrument of the Bards (Canaith Mandolin)',
    'Instrument of the Bards (Cli Lyre)',
    'Instrument of the Bards (Anstruth Harp)',
    'Instrument of the Bards (Ollamh Harp)',
    'Iron Bands of Binding', 'Iron Flask',
    # Ioun Stone family (13)
    'Ioun Stone (Absorption)', 'Ioun Stone (Agility)',
    'Ioun Stone (Awareness)', 'Ioun Stone (Fortitude)',
    'Ioun Stone (Insight)', 'Ioun Stone (Intellect)',
    'Ioun Stone (Leadership)', 'Ioun Stone (Mastery)',
    'Ioun Stone (Protection)', 'Ioun Stone (Regeneration)',
    'Ioun Stone (Reserve)', 'Ioun Stone (Strength)',
    'Ioun Stone (Sustenance)',
    'Javelin +1', 'Javelin +2', 'Javelin +3', 'Javelin of Lightning',
    'Lance +1', 'Lance +2', 'Lance +3', 'Lance of Warning',
    'Lantern of Revealing',
    'Leather Armor +1', 'Leather Armor +2', 'Leather Armor +3',
    'Leather Armor of Resistance',
    'Light Hammer +1', 'Light Hammer +2', 'Light Hammer +3',
    'Light Hammer of Warning',
    'Longbow +1', 'Longbow +2', 'Longbow +3', 'Longbow of Warning',
    'Longsword +1', 'Longsword +2', 'Longsword +3',
    'Longsword of Sharpness', 'Luck Blade',
    'Mace +1', 'Mace +2', 'Mace +3', 'Mace of Disruption',
    'Mace of Smiting', 'Mace of Terror', 'Mantle of Spell Resistance',
    # Manual/Tome family (the 6 permanent-stat-increase books)
    'Manual of Bodily Health', 'Manual of Gainful Exercise',
    'Manual of Quickness of Action', 'Tome of Clear Thought',
    'Tome of Leadership and Influence', 'Tome of Understanding',
    'Marvelous Pigments', 'Medallion of Thoughts', 'Mirror of Life Trapping',
    # Mithral armor family (5)
    'Mithral Armor', 'Mithral Chain Mail', 'Mithral Chain Shirt',
    'Mithral Half Plate', 'Mithral Plate Armor',
    'Morningstar +1', 'Morningstar +2', 'Morningstar +3',
    'Morningstar of Warning',
    'Necklace of Adaptation', 'Necklace of Fireballs',
    'Necklace of Prayer Beads',
}

# NEEDS VERIFICATION — left OFF the allow list pending a real check:
#   'Dark Shard Amulet'   (Warlock focus, no real DMG item by this name —
#                          likely vault-original homebrew)
#   'Green Dragon Mask'   (adventure-module-specific item, likely from
#                          Hoard of the Dragon Queen / Rise of Tiamat, not
#                          core DMG — uncertain SRD status either way)
#   'Lifewell Tattoo'     (doesn't match a real DMG item name)
#   'Mantle of Inspiration' (doesn't match a real DMG item name)
#   'Mask of the Beast'   (doesn't match a real DMG item name)
#   'Mirror of the Past'  (real DMG has "Mirror of Life Trapping" but not this)
#   'Mirror of the Future' (same — not a real DMG item name)

# NEEDS VERIFICATION — real DMG item names differ slightly from the vault's
# versions and might be renamed/modified variants rather than exact SRD text.
# Left OFF the allow list (safe default) pending a real check:
#   'Apparatus of the Crab'   (real item: "Apparatus of the Kwalish")
#   'Cap of Water Breathing'  (uncertain if this matches the real item name)
#   'Boots, Flying'           (real item: "Winged Boots" — different name entirely)


def compute_srd(name):
    """Three-tier safety-first classification, same pattern as
    convert-spells.mjs: explicit DENY/ALLOW first, PI regex next, otherwise
    unclassified (None -> key omitted -> treated as unsafe by the Item type's
    own contract). Most of this ~541KB file has NOT been read yet — see
    docs/ROADMAP_1.0.md Phase 1 Step 1.4 for progress tracking."""
    if name in DENY_NAMES:
        return False
    if name in MUNDANE_ALLOW_NAMES or name in MAGIC_ALLOW_NAMES:
        return True
    if PI_NAME_RE.search(name):
        return False
    return None


def parse_block(b):
    name = b['name']
    fields = {}
    desc_lines = []
    for ln in b['lines']:
        m = re.match(
            r'^(Type|Damage|AC|Properties|Weight|Range|Bonus|Rarity|'
            r'Requires Attunement|Consumable|Capacity|Effect|AC Bonus|Description):\s*(.*)$',
            ln)
        if m:
            fields[m.group(1)] = m.group(2).strip()
        elif ln.strip() and ln.strip() != '---':
            desc_lines.append(ln.strip())

    desc = fields.get('Description', '') or ' '.join(desc_lines)
    desc = re.sub(r'^Description:\s*', '', desc)
    desc = clean_desc(desc)

    item_id = slugify(name)
    itype = fields.get('Type', '')
    tl = itype.lower()
    props = []
    if 'Properties' in fields:
        for p in fields['Properties'].split(','):
            p = p.strip()
            if p and p.lower() != 'none':
                props.append(p.lower())
    if any(k in tl for k in ('magic', 'wondrous', 'artifact', 'legendary', 'rare')):
        props.append('magic item')
    if 'weapon' in tl:
        props.append('magic weapon' if any(k in tl for k in ('magic', 'legendary', 'artifact')) else 'weapon')
    if 'heavy armor' in tl:
        props.append('heavy armor')
    elif 'medium armor' in tl:
        props.append('medium armor')
    elif 'light armor' in tl:
        props.append('light armor')
    elif 'shield' in tl:
        props.append('shield')
    if 'Rarity' in fields:
        props.append(fields['Rarity'].lower())
    if fields.get('Requires Attunement'):
        props.append('requires attunement')
    if 'Bonus' in fields:
        props.append(fields['Bonus'].lower())
    if 'AC' in fields:
        props.append('ac ' + fields['AC'].lower())
    if 'Range' in fields:
        props.append('range ' + fields['Range'])
    seen = set()
    props = [p for p in props if not (p in seen or seen.add(p))]

    weight = 0
    if 'Weight' in fields:
        wm = re.search(r'([\d.]+)', fields['Weight'])
        if wm:
            weight = float(wm.group(1)) if '.' in wm.group(1) else int(wm.group(1))

    features = []
    if 'Damage' in fields:
        dm = DAMAGE_RE.search(fields['Damage'])
        if dm:
            dice = dm.group(1)
            dtype = dm.group(2).lower()
            rng = '5 feet'
            propstr = ' '.join(props)
            if 'Range' in fields or 'ammunition' in propstr or 'thrown' in propstr:
                rng = (fields.get('Range', '30').split('/')[0] + ' feet') if 'Range' in fields else '30 feet'
            features.append({
                'id': item_id + '_attack', 'name': name,
                'description': desc or (name + ' attack.'),
                'source': {'kind': 'item', 'refId': item_id},
                'level': None, 'effects': [], 'actions': [], 'choices': [], 'passive': False,
                'activation': {'actionType': 'action', 'resourceCost': None,
                               'range': rng, 'target': 'single', 'requiresSave': None},
                'abilityEffects': [{'type': 'damage', 'dice': dice, 'damageType': dtype}],
            })
    if not features:
        features.append({
            'id': item_id + '_desc', 'name': name,
            'description': desc or name,
            'source': {'kind': 'item', 'refId': item_id},
            'level': None, 'effects': [], 'actions': [], 'choices': [], 'passive': True,
        })

    result = {'id': item_id, 'name': name, 'weight': weight,
              'cost': '\u2014', 'properties': props, 'features': features}
    srd = compute_srd(name)
    if srd is not None:
        result['srd'] = srd
    return result


items, ids = [], set()
for b in blocks:
    if not b['name']:
        continue
    it = parse_block(b)
    if it['id'] in ids:
        continue
    ids.add(it['id'])
    items.append(it)


def ts(v, indent=0):
    sp = '  ' * indent
    if isinstance(v, dict):
        inner = ',\n'.join(f'{sp}  {json.dumps(k)}: {ts(val, indent + 1)}' for k, val in v.items())
        return '{\n' + inner + f'\n{sp}}}'
    if isinstance(v, list):
        if not v:
            return '[]'
        inner = ',\n'.join(f'{sp}  {ts(x, indent + 1)}' for x in v)
        return '[\n' + inner + f'\n{sp}]'
    if v is None:
        return 'null'
    if isinstance(v, bool):
        return 'true' if v else 'false'
    if isinstance(v, (int, float)):
        return str(v)
    return json.dumps(v, ensure_ascii=False)


out = [
    '// AUTO-GENERATED from "Items with descriptions.md" by scripts/parse_items.py.',
    '// Do NOT edit by hand. Re-run the script to regenerate.',
    "import { Item } from '../../engine/types';",
    '',
    'export const IMPORTED_ITEMS: Item[] = [',
]
for it in items:
    out.append('  ' + ts(it, 1) + ',')
out.append('];')
out.append('')

os.makedirs(os.path.dirname(OUT), exist_ok=True)

# Safety guard — same incident-driven fix already applied to
# scripts/convert-spells.mjs. If the source markdown is missing/empty/moved,
# 'items' would be near-empty and this script would otherwise silently
# overwrite the real ~541KB importedItems.ts with almost nothing. Refuse to
# write if the result is drastically smaller than what's already on disk.
previous_count = 0
if os.path.exists(OUT):
    with open(OUT, encoding='utf-8') as f:
        existing = f.read()
    m = re.search(r'IMPORTED_ITEMS:\s*Item\[\]\s*=\s*\[', existing)
    if m:
        previous_count = existing.count('"id":')

if previous_count > 20 and len(items) < previous_count * 0.5:
    print(
        f'\nREFUSING TO WRITE: parsed only {len(items)} items, but the '
        f'existing file has approximately {previous_count}. This usually '
        f'means SRC ("{SRC}") is wrong or the vault moved. '
        f'importedItems.ts was NOT modified.'
    )
    sys.exit(1)

with open(OUT, 'w', encoding='utf-8') as f:
    f.write('\n'.join(out))

# SRD classification summary — was missing compared to convert-spells.mjs,
# which is why the last two runs looked like "nothing happened" even though
# the classifications were correctly applied both times.
srd_true  = sum(1 for it in items if it.get('srd') is True)
srd_false = sum(1 for it in items if it.get('srd') is False)
srd_unset = len(items) - srd_true - srd_false
print(f'\nSRD classification: {srd_true} allowed, {srd_false} denied, {srd_unset} unaudited (excluded by default).')
print('See docs/ROADMAP_1.0.md Phase 1 for how to extend the ALLOW/DENY lists.')

print(f'Parsed {len(items)} unique items from {len(blocks)} blocks.')
print(f'Wrote {OUT}')
