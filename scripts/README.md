# scripts/

## parse_items.py — import the magic-item catalog

Converts a markdown item list into a TypeScript module the app consumes.

### Run it

```
python scripts/parse_items.py
```

By default it reads:

```
D:\Documents\Sort later\YSB\Obsidian Vault\DND\DND ჩემი\Items\Items with descriptions.md
```

and writes:

```
src/content/items/importedItems.ts
```

To use a different source or output, pass them as arguments:

```
python scripts/parse_items.py "path\to\source.md" "src\content\items\importedItems.ts"
```

### What it produces

- Each `# Item Name` block becomes an `Item` object.
- **Weapons** (blocks with a `Damage:` line) get an attack `Feature` with an
  `activation` block, so the engine generates an Action Card. Equip the weapon
  to see its attack on the Actions/Combat views.
- **Armor** (`AC:` line or an "X Armor" Type) gets a `base_ac_formula` effect.
- Everything else becomes a passive descriptive feature.
- Magic bonuses (`+1`/`+2`/`+3` in the name or a `Bonus:` line) are recorded as
  properties; the attack-bonus calc reads them.
- The `:contentReference{...}` citation junk and markdown links are stripped.

### How it connects

`src/content/items/index.ts` keeps a hand-authored `CORE_ITEMS` list (correct
weights, AC formulas, the special homebrew items) and appends `IMPORTED_ITEMS`,
**dropping any imported item whose id collides with a core item** — so the
mechanically-correct hand-authored version always wins. `importedItems.ts` ships
as an empty-array placeholder so the project compiles before you run the script.

### Adding more sourcebooks later

Append the new books' entries to the same markdown file (same
`# Name` / `Type:` / `Description:` format) and re-run the script. It overwrites
`importedItems.ts` with the full set. No app code changes needed.

### Caveats

- Imported items use a placeholder cost (`—`) and only a generic
  description-derived feature; they don't carry full mechanical automation
  (e.g. a "Belt of Giant Strength" won't auto-set STR). They're catalog entries
  you can add to a sheet; mechanical effects can be hand-authored into
  `index.ts` for the ones you use often.
- Medium-armor DEX cap enforcement depends on pipeline support; imported armor
  records the base AC.
