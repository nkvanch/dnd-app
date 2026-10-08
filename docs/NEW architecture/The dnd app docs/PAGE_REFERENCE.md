# Grimoire — Page & Choice Reference

A detailed walkthrough of every screen, every section, and every choice in the app,
with the exact mechanical text and calculations the user sees. Grouped into the
**Creation flow** and the **Character Sheet**.

---

# PART 1 — CHARACTER CREATION

The creation flow is a hub-and-spoke wizard. You bounce between the **Hub** and each
step screen. Nothing is permanent until you finish — everything edits a single
in-memory `draft` character.

---

## 1. Name screen (`name.tsx`)

The first screen. You enter:

- **Character name** — free text.
- **Starting level** — a number (default 1). Campaigns that begin mid-adventure can
  start higher; the engine will run every level from 1 up to this number when you
  pick a class, applying all HP, features, and choices along the way.

Pressing continue creates a blank character via `makeEmptyEntity()` — all stats 10,
no race, no class, 0 HP — and stores it as the `draft`. Every later step builds on it.

---

## 2. Hub screen (`hub.tsx`)

The control panel. Shows a card for each creation step with a completion indicator:

- **Race** — complete when `identity.raceId` is set.
- **Class** — complete when `identity.classId` is set.
- **Background** — complete when `identity.backgroundId` is set.
- **Ability Scores** — complete when the `scoresConfirmed` flag is in `notes`.
- **Skills** — complete when all skill choices are resolved.
- **Equipment** — complete when the `equipmentVisited` flag is set.
- **Spells** — complete when the `spellsVisited` flag is set (or the class has no spells).

When the required steps are done, a **Create Character** button calls `saveDraft()`,
which moves the draft into the permanent character list and writes it to the local
database. You can revisit any step before finalizing.

---

## 3. Race list (`race.tsx`) → Race detail (`race-detail.tsx`)

The list shows the 9 races. Tapping one opens its detail page, which displays:

- **Description** — flavor text.
- **Size** (Medium / Small) and **Speed** (e.g. 30 ft; dwarves, halflings, gnomes 25 ft).
- **Languages** — e.g. "Common, Elvish".
- **Features** — every racial trait with its description (Darkvision, Fey Ancestry,
  Keen Senses, etc.).
- **Subrace picker** (only when the race has subraces) — a **mandatory** choice. You
  can't confirm until one is selected. Each subrace card shows a short bonus summary
  derived from its effects, e.g.:
  - Hill Dwarf → "+1 WIS" plus its features
  - Mountain Dwarf → "+2 STR"
  - High / Wood / Drow Elf, Lightfoot / Stout Halfling, Forest / Rock Gnome, etc.

**What "Select Race" does:** strips any previously-chosen race's features (so changing
race doesn't stack), writes `raceId` and `subRaceId`, then applies the base race
features and the chosen subrace's features through the grant pipeline.

**Important mechanic:** racial ability bonuses are stored as **effects on features**,
never written into your base ability scores. So a Mountain Dwarf's base STR stays
at whatever you rolled/assigned; the +2 is layered on at calculation time. This is
why the Abilities tab shows the boosted number while the scores screen still lets you
edit the clean base.

---

## 4. Class list (`class.tsx`) → Class detail (`class-detail.tsx`)

The list shows the 12 classes. The detail page shows:

- **Description**.
- **Hit Die** — d6 (wizard/sorcerer), d8 (most), d10 (fighter/paladin/ranger),
  d12 (barbarian).
- **Spellcasting: Yes/No**.
- **Saving Throws** (collapsible) — the two saves this class is proficient in,
  e.g. Fighter → Strength, Constitution.
- **Primary Features** (collapsible) — the signature features, e.g. Barbarian →
  Rage, Unarmored Defense, Reckless Attack, Extra Attack, Fast Movement.
- **Proficiencies** (collapsible) — Armor, Weapons, Tools.

**What "Select Class" does:** this is the heavy step.
1. Clears any previous class's data — class/subclass/feat features, class choices,
   class resources, spellcasting, and resets skills (so switching classes doesn't
   stack skill proficiencies), then re-applies your background's skills.
2. Sets `classId` and the saving-throw proficiencies.
3. Runs `levelUp()` from level 0 up to your starting level. This grants the hit die
   and HP, all class features per level, and **queues the choices** you'll resolve on
   later screens: the skill choice, the equipment choices, the spell setup, and any
   Ability Score Improvements (every class gets ASIs at 4/8/12/16/19).

---

## 5. Background (`background.tsx`)

A list of all 13 PHB backgrounds, then a detail page showing:

- **Skill Proficiencies** — the two skills this background grants, e.g.
  Acolyte → Insight, Religion; Soldier → Athletics, Intimidation; Criminal →
  Deception, Stealth. (Full map: Charlatan→Deception/Sleight of Hand,
  Entertainer→Acrobatics/Performance, Folk Hero→Animal Handling/Survival,
  Guild Artisan→Insight/Persuasion, Hermit→Medicine/Religion, Noble→History/Persuasion,
  Outlander→Athletics/Survival, Sage→Arcana/History, Sailor→Athletics/Perception,
  Urchin→Sleight of Hand/Stealth.)
- **Tool Proficiencies** — e.g. Criminal → Thieves' tools, one gaming set.
- **Feature** — the background's named feature, e.g. Acolyte → Shelter of the Faithful.
- **Personality** — four dropdown pickers (Trait, Ideal, Bond, Flaw), each offering
  the background's suggested options. Your picks are saved as roleplay notes.

**What "Select Background" does:** strips the previous background's skills and features
(so changing background doesn't stack), then applies the new background's features and
marks its two skills as trained. These trained skills then appear pre-checked and locked
on the Skills screen so you can't waste a class pick on them.

---

## 6. Ability Scores (`scores.tsx`)

Four generation methods, chosen by tabs at the top:

- **Standard Array** — assign the fixed set [15, 14, 13, 12, 10, 8]. Tap a value,
  then tap an ability to place it. Tapping a filled ability clears it.
- **Point Buy** — 27-point budget. Each score 8–15 costs points (8=0, 9=1, 10=2,
  11=3, 12=4, 13=5, 14=7, 15=9). A counter shows "Points remaining: X / 27" and
  blocks you from overspending.
- **Manual** — free entry. Use the +/− steppers or type any number directly. No cap
  (for homebrew / custom arrays).
- **4d6** — rolls four six-sided dice and drops the lowest, six times. Tap a rolled
  value, then tap an ability to assign it. "Roll All" re-rolls the set.

**Each ability row shows:** the base value you assigned, the race bonus annotation
(e.g. "+2 race"), and the resulting total with its modifier, e.g. "= 16 (+3)". The
modifier formula is the standard `floor((score − 10) / 2)`.

**What "Confirm Scores" does:** writes the clean base scores into the character,
re-applies any ASI you'd already taken (so editing scores never silently erases a
+2 you picked earlier), recomputes derived stats, then recalculates HP from scratch
using your final Constitution — so HP is correct even if you set scores after picking
your class.

---

## 7. Skills (`skills.tsx`)

Resolves the class's skill choice. Each class grants a different pick — e.g. Rogue
chooses **4** from a list of 11; Wizard chooses **2** from {Arcana, History, Insight,
Investigation, Medicine, Religion}; Bard chooses **any 3**.

The screen shows:

- **Already-owned proficiencies** at the top — skills you already have from background
  or race, listed in green. These also appear in the choice list **disabled and tagged
  "From background"**, so you can't double-spend a pick on a skill you already have.
- **The choice block** — tap to select up to the allowed count. A counter shows
  "Selected: X / N". The confirm button is disabled until exactly N are chosen.

**Three states:**
1. Class has no skill choice → a simple "No additional skill choices for this class"
   with a Continue button.
2. You've already resolved it and come back → a read-only summary listing the skills
   you chose (with checkmarks), plus Continue. (This is the fixed re-entry behavior;
   it used to wrongly say "no choices".)
3. Pending → the interactive picker above.

**What confirming does:** marks each chosen skill as trained, which feeds into all
skill bonus calculations on the Abilities tab.

---

## 8. Equipment (`equipment.tsx`)

Resolves the class's starting-equipment choices. Each class queues several, e.g.
a Cleric chooses a weapon (mace or warhammer), armor (scale / leather / chain), a
ranged option (light crossbow + bolts, or a simple weapon), and a pack (priest's or
explorer's). Each option's value is a set of item IDs.

**What confirming does:** adds the chosen items to your carried inventory. They show
up on the Inventory tab where you can equip them.

---

## 9. Spells (`spells.tsx`)

Only meaningful for spellcasters. The spell list is **filtered to your class** — a
Wizard sees only wizard spells, a Cleric only cleric spells, etc. (drawn from the
487-spell vault, each tagged with the classes that can cast it).

Starting selections by class at level 1:
- Wizard: 3 cantrips, 6 spells
- Sorcerer: 4 cantrips, 2 spells
- Bard: 2 cantrips, 4 spells
- Warlock: 2 cantrips, 2 spells
- Cleric: 3 cantrips (prepares leveled spells later)
- Druid: 2 cantrips (prepares leveled spells later)
- Ranger / Paladin: none at level 1

Each spell row shows name, level/school/casting time, a concentration tag if relevant,
a checkbox to select, and an ⓘ button that expands the full description. A search box
filters by name or school. Counters track "X of N selected" and turn green when complete.

- **Non-spellcasters** see "This class does not use spells" and skip through.
- **Cleric/Druid** (prepared casters) see "Your spells are prepared from the full class
  list on the character sheet" — they only pick cantrips here.

**What confirming does:** writes your cantrips and known spells into the character's
spellcasting block.

---

## 10. Review (`review.tsx`)

A full summary — name, race, class, background, all six ability scores with modifiers,
HP, AC, proficiencies, and features. It recalculates HP one final time so the number is
always correct regardless of the order you did the steps. From here you return to the
Hub to finalize.

---

## 11. Level-Up (creation) (`level-up.tsx`)

Reached when an Ability Score Improvement is pending. It opens the shared ASI/Feat
picker (see the sheet's Combat tab below for the picker's three modes). Used during
creation for characters that start above level 4.

---

# PART 2 — THE CHARACTER SHEET

The sheet (`sheet/[id].tsx`) has a header (name, level/class/race, HP pill), six tabs,
and a persistent rest bar at the bottom. Every number shown is read from the
character's pre-computed `derived` block — tabs never calculate rules themselves.

---

## Tab 1 — Combat (`TabCharacter.tsx`)

The main play screen. Top to bottom:

**Hit Points block.** Large current/max HP with a colored bar (green above 50%, gold
25–50%, red below 25%), plus temp HP shown as "+N tmp". Tapping opens the damage/heal
pad. At 0 HP it switches to a "💀 Dying — Roll Death Saves below" state.

**HP utility row.**
- **Set HP** — manually set current HP (clamped to max).
- **Set Max** — manually override maximum HP (for homebrew or effects the engine
  doesn't model); current HP clamps down if the new max is lower.
- **Temp HP** — add temporary HP. Temp HP doesn't stack; it keeps whichever pool is
  larger. A − button clears it.

**Death Saving Throws** (only at 0 HP). Three success pips and three failure pips.
"Roll Death Save" rolls a d20:
- 20 → regain 1 HP, no longer dying.
- 10–19 → one success.
- 2–9 → one failure.
- 1 → two failures.
Three successes → stable at 1 HP. Three failures → dead. A reset button clears the pips.

**Stat row** — four tappable boxes: **AC**, **Speed**, **Init** (initiative), **Perc**
(passive Perception). Each opens an **audit breakdown** explaining every contribution
(see Audit Modal below). A gold ✱ marks any stat currently affected by a DM override.

**Level Up button** — "⬆ Level Up (→ N)". Confirms, then runs the level-up: grants the
new level's HP, features, and resources. If the new level includes an ASI, the ASI/Feat
picker opens automatically. If other choices are pending (e.g. a subclass), it tells you
to open the Features tab.

The **ASI / Feat picker** has three modes:
- **+2 to one ability** — capped so the effective score can't exceed 20.
- **+1 to two abilities** — same cap.
- **Take a Feat instead** — pick from the feat list; the feat's feature and its
  automated bonuses apply. Feats already taken are disabled.

**Attacks** — one row per equipped weapon, showing the attack bonus and damage. The
attack bonus is proficiency + ability modifier (STR for melee, the better of STR/DEX
for finesse, DEX for ranged). Damage shows the weapon's dice plus the ability modifier
and type, e.g. "1d8+3 slashing". A Melee/Ranged badge is shown.

**Hit Dice** — shows remaining/total and die size, with two buttons:
- **🎲 Roll Hit Die** — the app rolls the die, adds your Constitution modifier, heals
  you, and reports how much. (For digital play.)
- **Use Hit Die** — just spends one from the pool without healing, so you can roll a
  physical die and heal yourself. (For tabletop play.)

**Conditions** — a "+ Add" button opens a searchable list of the 15 standard conditions.
Active conditions show as removable chips. Below them, **mechanical reminders** are
printed for each active condition, exactly like:
- **poisoned:** Disadvantage on attacks and ability checks
- **blinded:** Attacks against you have advantage; you have disadvantage on attacks
- **prone:** Disadvantage on attacks; melee attacks against you have advantage
- **paralyzed:** Speed 0; auto-fail STR/DEX saves; attacks against you have advantage
- **frightened:** Disadvantage on checks and attacks while source is visible
- **stunned:** Speed 0; auto-fail STR/DEX saves; attacks against you have advantage
- **restrained:** Speed 0; disadvantage on attacks; attacks against you have advantage
- **grappled:** Speed 0
- **incapacitated:** Cannot take actions or reactions
- **petrified:** Incapacitated; resistance to all damage; attacks against you have advantage
- **unconscious:** Incapacitated, prone; auto-fail STR/DEX saves; attacks have advantage

**Exhaustion** is tracked separately as a level 1–6 with its own reminder:
1 = Disadvantage on ability checks; 2 = Speed halved; 3 = Disadvantage on attacks and
saving throws; 4 = HP maximum halved; 5 = Speed 0; 6 = Death.

**Concentration** — if you're concentrating on a spell, an indicator shows it. When you
take damage while concentrating, a **Concentration Check** modal pops up automatically:
the DC is the greater of 10 or half the damage, and it rolls a Constitution save —
failure drops the spell.

**Resources** — class resource pools (Rage, Ki, Channel Divinity, Bardic Inspiration,
Sorcery Points, Lay on Hands, etc.), each with current/max and +/− steppers, plus a
recharge label ("short rest" / "long rest").

**Spell Slots** — a grid by level. Each slot is a tappable pip: tap an unused pip to
spend it, tap a used pip to restore it. Shows "remaining/total" per level.

---

## Tab 2 — Actions (`TabActions.tsx`)

Auto-generated **action cards** from your active features and known/prepared spells.
Passive features get no card. Cards are grouped into **Actions**, **Bonus Actions**, and
**Reactions** by activation type, and color-coded by purpose:

- red = damage, green = healing, blue = buff, purple = control/transformation, gray = utility.

Each card has three info layers:
- **Layer 1** — source and type, e.g. "Lv 3 Spell • Evocation • Damage" or
  "Class • Bonus Action • Buff".
- **Layer 2** — the key mechanic, e.g. "8d6 Fire", "Heal 1d8", "Resist Bludgeoning/Piercing/Slashing".
- **Layer 3** — save/concentration/slot notes, e.g. "DEX Save (half)",
  "Concentration • 1 min", "Slot Lv 1+".

A card greys out with a reason when you can't afford it ("No spell slots of level 1+
remaining", "Rage: 0/3 remaining"). The **Use** button consumes the resource/slot and
opens a roll modal: if the card has a dice expression (like 8d6), it rolls and shows the
total with the individual dice. (Targeting and applying damage to others isn't automated
— you announce the roll at the table.)

---

## Tab 3 — Abilities (`TabAbilities.tsx`)

**Ability Scores** — six boxes, each showing the **effective** score (base + racial/feat
bonuses) and its modifier. Tapping opens an audit breakdown. The modifier is
`floor((score − 10) / 2)`.

**Saving Throws** — all six, each = ability modifier + (proficiency bonus if the class
is proficient in that save). A filled dot marks proficiency. Tappable for the breakdown.

**Passive Scores** — Passive Perception, Passive Investigation, Passive Insight. Each =
10 + the relevant skill's total bonus (ability mod + proficiency if trained, ×2 if
expertise, + any bonus).

**Skills** — all 18, each showing its governing ability tag and total bonus. The bonus =
ability modifier + proficiency contribution + any flat bonus, where the proficiency
contribution is 0 if untrained, ×1 if trained, ×2 if expertise. A filled dot marks
trained; a different-colored dot marks expertise. Tappable for the breakdown.

---

## Tab 4 — Features (`TabFeatures.tsx`)

Lists all active features grouped by source — Race, Class, Subclass, Background, Feats —
each with its description.

At the top, a **Pending Choices** section surfaces anything unresolved:
- **Skill choices** resolve inline — tap chips to pick, confirm. Already-trained skills
  are marked and disabled.
- **ASI / Feat choices** open the same picker as the Combat tab.
- Other choice types (e.g. subclass) show an honest "resolve with your DM for now" note
  until a dedicated picker exists.

---

## Tab 5 — Inventory (`TabInventory.tsx`)

**Carry Weight** — a bar showing total weight vs capacity (STR × 15). Turns gold past
75%, red when encumbered, with an "⚠ Encumbered" warning over capacity.

**Currency** — PP / GP / EP / SP / CP.

**Equipped** and **Carried** lists — each item shows its name, properties, and quantity,
with an Equip/Unequip toggle. Equipping armor updates AC immediately (the change flows
through the recompute pipeline). Light and medium armor add your DEX modifier to their
base AC; heavy armor is flat.

---

## Tab 6 — Notes (`TabNotes.tsx`)

A free-text field for character notes and roleplay details. Auto-saves.

---

## Persistent Rest Bar (bottom of every tab)

- **☕ Short Rest** — prompts a short rest. You can spend hit dice to heal; short-rest
  resources (Ki, Channel Divinity, Bardic Inspiration, Warlock slots, etc.) refresh.
- **🌙 Long Rest** — restores HP to full, refills all spell slots, resets the hit-dice
  pool, reduces exhaustion by 1, and clears DM overrides marked "end of session".

---

## The Audit Modal (shared by Combat & Abilities tabs)

Tapping any derived stat (AC, a save, a skill, etc.) opens a breakdown showing the total
and an itemized list of every contribution with its source — e.g. for AC: the base armor
formula, the DEX contribution, a shield's +2, a racial bonus, and any DM override (marked
with a gold ✱). This is the "explain every number" feature: every value can be traced to
its roots. If you're the DM, the modal also offers a **DM Override** button to set or add
to the value, which then shows transparently in the same breakdown.
