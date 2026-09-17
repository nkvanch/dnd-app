# Grimoire — Navigation & Screen Map

The complete screen hierarchy and navigation model, verified against the actual
`app/` routing tree. This answers: how you move around, what every screen is, and
where the app is a real TTRPG platform vs. still a character builder.

---

## 1. Navigation model (the answer to "bottom tabs / swipe / sidebar?")

**Bottom tabs at the root, a stack on top, and an in-page tab bar inside the sheet.**
Three different mechanisms, each at a different level:

- **Root = 4 bottom tabs** (`app/(tabs)/_layout.tsx`), gold-highlighted, with emoji
  icons: **⚔️ Home · 🗺️ Campaigns · 👤 Characters · 📜 Homebrew**. This is the
  persistent navigation — always visible on the four main screens.
- **Everything else = a pushed stack** (`app/_layout.tsx`) that slides in from the
  right *over* the tabs and hides the tab bar: the creation wizard, the character
  sheet, the DM screens, and the homebrew builders. You back out of them to return
  to the tabs.
- **Inside the character sheet = a custom in-page tab bar** (not a navigator — just
  state) switching the six content panes (Combat/Actions/Abilities/Features/Inventory/
  Notes). These do **not** swipe; you tap the tab labels. The header and rest bar stay
  fixed above/below.

So: **tap bottom tabs** to move between the four pillars; **tap a card** to push into
a sheet/wizard/dashboard; **tap in-sheet tabs** to switch sheet panes; **back arrow or
swipe-from-edge** to pop the stack.

---

## 2. Complete screen tree

```
ROOT STACK (app/_layout.tsx)  — boots DB, loads stores, then renders:
│
├── (tabs)  ← BOTTOM TAB NAVIGATOR (tab bar visible)
│   │
│   ├── ⚔️ Home  (index.tsx)
│   │     • "Continue Last Character" card (HP bar, AC, Speed) → pushes sheet
│   │     • "Active Campaign" card (currently a stub: "No active campaign")
│   │     • Quick Actions: Create Character / Join Campaign / Roll Dice
│   │     • Dice Roller modal (quick buttons + free expression like 2d6+3, 4d6kh3)
│   │
│   ├── 🗺️ Campaigns  (campaigns.tsx)  ← a state machine, not a list
│   │     • NO CAMPAIGN  → nickname field + [Create Campaign (DM)] / [Join (Player)]
│   │     │                 + "How it works" explainer
│   │     • DM ACTIVE    → campaign name, room code, QR code, connected-player count,
│   │     │                 PARTY list (each player's HP bar), [Open DM Dashboard],
│   │     │                 [End Campaign]
│   │     • PLAYER ACTIVE → campaign name, "Connected to DM" / "Reconnecting…",
│   │                       [Leave Campaign]
│   │     • Create modal (name → starts TCP server, gets room code)
│   │     • Join modal (6-char code OR 📷 QR scan via camera)
│   │
│   ├── 👤 Characters  (characters.tsx)
│   │     • Header with [+ New]
│   │     • FlatList of character cards: Name · "Level 5 · fighter · human" ·
│   │       HP bar · AC badge · Spd badge
│   │     • Tap card → sheet.  Long-press → delete confirm.
│   │     • Empty state → "No characters yet" + Create button
│   │
│   └── 📜 Homebrew  (homebrew.tsx)  ← one scroll with three panels
│         • 📥 Import: URL or Text tabs → "Parse with Claude →" → import-review
│         • 🛠 Create: New Race / Class / Spell / Feature / Background buttons
│         • 📚 Library: list of saved homebrew with type badges + delete
│
├── creation/  ← PUSHED STACK (no tab bar) — the character wizard
│   ├── name           (name + starting level → makes the draft)
│   ├── hub            (control panel; completion marks; "Create Character")
│   ├── race           (race list)
│   ├── race-detail    (description, subrace picker, "Select Race")
│   ├── class          (class list)
│   ├── class-detail   (collapsible saves/features/profs, "Select Class")
│   ├── background     (list + detail with personality dropdowns)
│   ├── scores         (Standard / Point Buy / Manual / 4d6)
│   ├── skills         (class skill picks; re-entry shows summary)
│   ├── equipment      (starting gear choices)
│   ├── spells         (class-filtered cantrip/spell picks)
│   ├── review         (full summary; recalculates HP)
│   └── level-up       (ASI / Feat picker, for starting above L1)
│
├── sheet/[id]  ← PUSHED STACK — the character sheet
│       Header (name, Lv/class/race, HP pill, sync dot)
│       In-page tabs:
│         ├── Combat     (HP, death saves, AC/Speed/Init/Perc, level-up,
│         │               attacks, hit dice, conditions, concentration,
│         │               resources, spell slots)
│         ├── Actions    (action cards: Actions / Bonus Actions / Reactions)
│         ├── Abilities  (scores, saves, passives, 18 skills — all tappable→audit)
│         ├── Features   (features by source + Pending Choices)
│         ├── Inventory  (weight, currency, equipped/carried, equip toggle)
│         └── Notes      (free text)
│       Persistent rest bar (Short Rest / Long Rest)
│
├── dm/  ← PUSHED STACK — DM tools (only when isDm)
│   ├── dashboard       (party overview: HP, AC, PP, conditions, concentration,
│   │                    resource pips per player; [Start Encounter])
│   ├── encounter       (encounter / initiative tracker)
│   ├── monsters        (monster browser)
│   └── character/[id]  (DM read view of one player's character)
│
└── homebrew/  ← PUSHED STACK — the builders
    ├── import-review   (review Claude's parse before saving)
    ├── spell-builder   (full spell form: level, school, components, ritual,
    │                    concentration, upcast → validates → saves to library)
    ├── race-builder    (name, speed, ability bonuses, darkvision, extra trait)
    ├── class-builder   (class scaffold)
    └── feature-editor  (raw Feature/Effect editor)
```

---

## 3. Home screen — what the user sees on launch

Grimoire opens on **Home**, and it's deliberately a *companion dashboard*, not a bare
list. Top to bottom:

1. **App title bar** — "D&D Companion".
2. **Continue Last Character** — a prominent gold-bordered card for your most recent
   character: name, "Level 5 · fighter · human", an HP bar, and AC/Speed pills. One tap
   opens the sheet. (If you have none: "No characters yet.")
3. **Active Campaign** — currently a **stub** ("No active campaign · Join from the
   Campaigns tab"). This is the single biggest "platform vs builder" gap — see §10.
4. **Quick Actions** — Create Character, Join Campaign, Roll Dice (opens a full dice
   roller modal).

So today the home screen leans ~70% "character companion, 30% table tool." The
scaffolding for a party dashboard is there (the card exists) but unpopulated.

---

## 4. Character list — how characters are displayed

A vertical `FlatList` of cards. Each card:

```
+----------------------------------------------+
| Sir Gareth                          [AC ][18]|
| Level 5 · fighter · human           [Spd][30]|
| ▓▓▓▓▓▓▓▓▓▓░░░░  42/42 HP                      |
+----------------------------------------------+
```

Name (bold), the "Level · class · race" line, an HP bar colored by percentage
(green >50%, gold >25%, red below), and AC + Speed badges on the right. **No portraits**
— there's no avatar/image system yet. Tap opens the sheet; long-press deletes.

---

## 5. Character header — how prominent

The sheet header is a single compact bar (not a big hero block):

```
← Back   Sir Gareth                    ● [42/48]
         Lv 5 · fighter · human       sync   HP
```

It shows name, a small "Lv N · class · race" subline, the sync status dot, and an **HP
pill** that turns red below 25%. AC is **not** in the header — it lives in the Combat
tab's stat row. So during play a player glances at the header for **HP and level**, then
the Combat tab's stat row for **AC/Speed/Init/Perception**. (A reasonable future tweak:
promote AC into the header, since players check it as often as HP.)

---

## 6. Actions tab — the detail you asked about

- **Layout:** a vertical scroll grouped into three labeled sections — **ACTIONS**,
  **BONUS ACTIONS**, **REACTIONS** — by each ability's activation type. Empty sections
  are hidden.
- **Cards per screen:** roughly 4–6 visible at once (each card is a ~3-line block with a
  left color stripe and a Use button), then you scroll.
- **Resource visibility:** yes — a card greys out and prints the reason when you can't
  afford it ("No spell slots of level 1+ remaining", "Rage: 0/3 remaining"). The cost
  itself is implied in layer 3 ("Slot Lv 1+").
- **Favoriting / pinning / collapsing:** **none of these exist yet.** Cards aren't
  reorderable, pinnable, or collapsible. This is a real gap for high-level casters with
  20+ spells — the Actions tab will become a long flat scroll. Pinning favorites and
  collapsible sections are the obvious next iteration.
- **Use flow:** tapping **Use** consumes the resource/slot immediately, then opens a
  modal that rolls the card's dice (e.g. 8d6) and shows the total + individual dice.
  Targeting other creatures isn't automated — you announce the roll at the table.

---

## 7. Spellbook experience — the honest state

There is **no dedicated spellbook screen.** Spells live in two places:

- **Creation:** the class-filtered spell picker (cantrips + known/prepared at level 1).
- **During play:** spells become **action cards** on the Actions tab (and feed the
  Spellcasting tab tag internally), and **spell slots** are tracked as tappable pips on
  the Combat tab.

Answering your specific questions:
- **Where do prepared spells live?** In the character's `spellcasting` block; surfaced as
  action cards, not a browsable list.
- **Can spells be cast directly?** Yes, via the spell's action card's Use button.
- **Are slots consumed from the card?** Yes — using a leveled-spell card decrements a
  slot. You can also tap slot pips directly on the Combat tab.
- **Can concentration start from the card?** Indirectly — the Combat tab tracks
  concentration and prompts a save when you take damage, but there's no "start
  concentration" button on the card itself yet.
- **Can ritual spells be filtered?** **No** — there's no ritual filter, and no
  prepare/unprepare management screen, and no "add a spell mid-campaign" flow. This is
  the biggest missing play-time surface. A proper Spellbook tab (browse known/prepared,
  prepare/unprepare, filter by level/school/ritual/concentration, see full text) is a
  strong candidate for the next feature.

---

## 8. Homebrew workflow — it exists, and it's real

This is more built than you thought. The Homebrew tab has three panels, and the builders
are functional forms that validate and save into a homebrew library:

- **Import** — paste a D&D Wiki URL or raw text, "Parse with Claude →" sends it to the
  `import-review` screen (uses the Anthropic SDK / wikiImporter). *Note: untested on real
  input.*
- **Create** — five entry points:
  - **Spell builder** — full form (name, level 0–9, school, casting time, range,
    components, duration, description, upcast, ritual/concentration toggles), runs
    `validateSpell`, saves to library. **Fully functional.**
  - **Race builder** — name, base speed, six ability-bonus inputs, darkvision toggle,
    an extra trait, description. Builds proper `stat_modifier` effects. **Functional.**
  - **Class builder** — class scaffold. **Partial.**
  - **Feature editor** — raw Feature/Effect editing. **Advanced/partial.**
  - **Background** — currently routes to the race builder (placeholder).
- **Library** — lists everything saved with type badges (race/class/spell/background/
  feature) and delete.

**The real gap:** homebrew content saves to its own library but isn't yet fully wired
*back into creation* — a custom race won't necessarily appear in the creation race list.
Closing that loop (homebrew → selectable in creation) is what would make the "I want my
own rules" vision real end-to-end.

---

## 9. Campaign features — what exists

More than you'd expect, focused on **live multiplayer sync** rather than prep tooling:

- **Campaign exists?** Yes. Create (as DM) or join (as player, via 6-digit code or QR).
- **Party management?** Yes — the DM dashboard shows every player's card: HP bar, AC,
  Passive Perception, active conditions, concentration, and resource pips, live-synced
  over local WiFi (TCP). The Campaigns tab also shows a party HP list.
- **Encounter tracker?** Yes — `dm/encounter` (initiative/turn tracking) + `dm/monsters`
  browser. "Start Encounter" launches it from the dashboard.
- **NPCs?** Partial — the entity model supports `npc`/`monster` kinds and there's a
  monster browser, but no dedicated NPC manager UI.
- **Session notes?** **No** — no campaign notes/journal screen.
- **Shared inventory?** **No.**
- **Maps?** **No.**

So campaigns today = **real-time party state + encounters**, but **not** prep/lore
tooling (notes, maps, quests, loot, NPCs-as-cast).

---

## 10. Where it's still a builder vs. a platform — and what's missing

**Platform-grade already:** the entity/engine, live DM↔player sync, the DM party
dashboard, encounters, the homebrew builders.

**Still builder-flavored / missing UX flows:**
1. **Home's "Active Campaign" is a stub** — the dashboard scaffolding exists but isn't
   populated. Making Home show your live party when a campaign is active is the
   single highest-leverage change to make it *feel* like a platform.
2. **No Spellbook** — spell management mid-campaign (prepare/unprepare, ritual filter,
   browse) has no home.
3. **Actions tab doesn't scale** — no pinning/favorites/collapse for high-level casters.
4. **Homebrew → creation loop isn't closed** — custom content saves but isn't selectable
   in the wizard.
5. **No campaign prep surface** — notes, NPCs, maps, quests, shared loot.
6. **No Settings screen at all** — there's no `settings` route; rules (max level, HP
   mode, multiclass) live in code defaults with no UI.
7. **No portraits/identity art** anywhere.
8. **Character list is flat** — no grouping by campaign, no search/sort. Fine at 5
   characters, awkward at 50.

If you want one structural recommendation from the tree: the four bottom tabs are the
right pillars, but **Home should become the live "table" when a campaign is active**
(party dashboard, current encounter, quick dice) and fall back to the character-companion
view when it isn't. That one change flips the felt identity from "builder with sync
bolted on" to "table platform."
