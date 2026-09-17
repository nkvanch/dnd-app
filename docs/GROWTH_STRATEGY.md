# Grimoire — Growth Strategy If Wizards Never Grants a License

### The Question

If Wizards of the Coast never grants Grimoire permission to ship their official book content, is that a major obstacle to reaching a large audience?

**No.** It's a reason to change the product strategy, not the ceiling on it.

Don't try to make Grimoire "the app containing every official D&D book." Make it **the best free, open, offline-first 5e character tool that users can extend themselves.**

---

## The Legal Foundation

The foundation can still be substantial, without a license.

Wizards' SRD 5.2.1 exists specifically so third-party creators can build products from D&D rules content under Creative Commons, without paying Wizards a licensing fee. That's not a loophole — it's the explicit purpose of the document.

Grimoire's bundled installation ships only:

- SRD / CC-licensed material
- Grimoire's own original material

Nothing else needs to be bundled for the app to be genuinely useful.

---

## The Product To Build

Make the data system extremely extensible, so the SRD is a starting point, not a ceiling:

```
Grimoire
 → SRD content built in
 → custom spells
 → custom subclasses
 → custom species
 → custom feats
 → custom backgrounds
 → custom items
 → custom monsters
 → custom rules / features
 → import/export custom content packs
```

That last line matters most.

A user who owns a book can create their own **private** entry instead of Grimoire shipping Wizards' copyrighted database for them. For example:

```
Create Custom Spell

Name:          ______
Level:         ______
School:        ______
Casting time:  ______
Range:         ______
Components:    ______
Duration:      ______
Description:   ______
```

The same architecture works for virtually everything — subclasses, species, feats, backgrounds, items, monsters, rules.

This isn't an unusual concept in the D&D ecosystem. D&D Beyond itself supports private homebrew while explicitly prohibiting users from submitting official D&D material as public homebrew. Grimoire should have its own terms around sharing and copyright, rather than assuming D&D Beyond's rules automatically apply.

---

## Positioning: Not "Free D&D Beyond"

Don't market it as:

> "Free D&D Beyond."

That's both strategically weak and creates unnecessary branding/IP headaches.

The stronger proposition:

> **Grimoire — a free, open-source, offline-first character manager for 5e-compatible games.**

Then differentiate on functionality, not on catalog size.

Imagine someone downloads it and can: create a character without an account, use it completely offline, freely edit practically every field, create custom mechanics, maintain notes, manage inventory and spellcasting, import/export characters as files, make their own backups, and install community-created content packs.

That's interesting precisely *because* it isn't trying to recreate Wizards' database.

---

## Distribution

Don't make GitHub the main consumer download page. GitHub is excellent for source, issue tracking, and release binaries — but ordinary D&D players aren't necessarily GitHub users.

Eventually distribute through: **own website + GitHub + itch.io + major platform stores** where practical.

**itch.io** is particularly interesting for the first public release — it has an established TTRPG-tools category (hundreds of free tools), supports Windows/macOS/Linux/Android/iOS/browser, and handles staged playtests, communities, build distribution, and automatic updates through its own app.

---

## The Killer Feature

Distribution isn't what makes something popular. You need a reason for someone on Reddit/Discord/YouTube/TikTok to say:

> "You should try Grimoire."

That reason should be **freedom/customization**, not merely "it's free."

A killer feature: a visual feature/rule editor where someone can construct something like —

```
When attack hits → target takes +1d6 fire damage
```

— without programming. Then:

```
Export → my-homebrew.grimoire
```

...and their friend imports it.

Suddenly Grimoire isn't merely a character sheet. It's effectively a **5e character-system engine**. D&D Beyond itself maintains homebrew systems across spells, subclasses, species, feats, backgrounds, monsters, and magic items — the demand for this is already proven.

---

## Community Content As The Growth Engine

This is where Grimoire has its best chance of spreading.

Create an open format for original/appropriately-licensed community content — never hosted pirated Wizards books. Someone makes:

- "100 Original Spells"
- "Expanded Firearms Rules"
- "Steampunk Character Pack"
- "My Campaign's 12 Custom Subclasses"

Creators can distribute those packs themselves. Eventually Grimoire could have a community repository for content people actually have the rights to distribute.

The loop:

```
Creator makes content → publishes Grimoire pack → their players install Grimoire
→ players make characters → some become creators → more packs appear
```

That has far more growth potential than hoping people discover just another character-sheet app.

---

## Launch Plan

Don't publicly launch the moment the basic character builder works.

**Phase 1 — Private.** Get 20–50 actual tabletop players/DMs using it privately. Watch where they get confused. Fix onboarding. Make character creation extremely smooth. Make import/export bulletproof. Make crashes and lost character data exceptionally rare.

**Phase 2 — Public, with something demonstrable.** A 30-second clip beats screenshots:

> Create character → add custom subclass → create custom feature → level up → export character → send file → friend imports it

**Phase 3 — Coordinated release.** Simultaneously to the relevant TTRPG communities, itch.io, GitHub, own website, and social/video platforms — but tailor each post to its community rather than spamming identical promotional posts.

---

## The Pitch

Keep it simple:

> **Free. Open source. Offline. No account required. Your characters and homebrew belong to you.**

If Grimoire delivers those promises exceptionally well, not having Wizards' non-SRD content pushes it toward a more distinctive product — not merely a limitation.

---

## What To Design Next

The custom-content architecture and the `.grimoire` package format — because that single decision touches the database, the character builder, the licensing boundaries, modding, the community ecosystem, and ultimately Grimoire's ability to grow.
