# Homebrew implementation status

Everything in `docs/homebrew/*.md` is now built into the app as **built-in homebrew**: seeded through `BUILTIN_HOMEBREW` (`src/content/builtinHomebrew.ts`), shown under the Homebrew sections of the Compendium, editable and deletable like anything a user made (a built-in the user deletes stays deleted). Content lives in `src/content/homebrewPack/` and `src/content/classes/emperorWarlock/`, each with tests that run it through the real engine.

Written 2 October 2026. Nothing below was checked on a device or an emulator (the phone was not connected); it is covered by jest and the TypeScript compiler.

## What exists

| Spec | Built as | Notes |
|---|---|---|
| Anchor of Command | Feat (+1 CON or CHA choice), `Held Fast` condition, 1/Long Rest pool | `Feat.resources` |
| Braced | Condition: speed -10, +1 AC, advantage vs forced movement and prone, Dash greyed out | "Take a Brace (Braced demo)" feat is the demo source |
| Command the Field | Spell, level 3 enchantment, concentration, upcast text | Per-target mode choice is a reminder (see gaps) |
| Standard of the Unyielding Line | Rare wondrous item, attunement, 3 charges, `1d3` at dawn, planted flag, Last Line reaction | `Item.resources`, `recharge: 'dawn:1d3'` |
| Weight of Authority | Three-tier reward on the Features tab (`+ Reward`); tiers replace, never stack | `Feature.rewardTrack`, derived `max_hp` |
| Ballast (both versions) | Two races: **Ballast** (original joke) and **Ballast (Lesser)** (demo) | Catastrophically Dense = `hit_die_tier` effect, per class, retroactive |
| Glassback | CR 7 monster, Pressure pool 0-3 with real AC/speed/roll tiers, shell fracture, Compress, Abrasive Jet (Recharge 5-6), Pressure Collapse | Resource-gated effects, flat damage reduction |
| The Pressure Vault | Prepared-encounter template, seeded once | Public and secret hazards, DM-only motive note |
| Emperor Warlock (demo) | Class **Emperor Warlock (Demo)**: Bound Spirit chosen once at level 1 | Spirits are subclass records labelled "Bound Spirit" |
| Emperor Warlock (true) | Class **Emperor Warlock**: Legacy Binding is real, a new spirit replaces the old every month | Mode Group, see below |

### Emperor Warlock detail (both versions)

- Levels 1-20, d8, light armor, simple weapons plus one martial weapon (a proficiency pick), Wisdom/Charisma saves, two skills.
- Command Dice equal to proficiency bonus (a resource whose maximum follows PB), d6/d8/d10 as in-place upgrades at 9 and 17.
- 17 Imperial Edicts as a feature pool: two at level 2, one at 6/10/14/17.
- Pact Magic on the standard Warlock slot table (the spec only says "Warlock-style"); spells and cantrips known follow the Warlock schedule; the class spell list is exactly the spec's, tagged onto the library spells.
- Legacy Arcanum at 11/13/15/17 as once-per-Long-Rest casts (starred favorites in the picker).
- Twelve Bound Spirits, each with its level 1/5/10/15/20 features and bonus spells (known only while bound). Summoned units are monster stat blocks in the monster list.
- **True version only:** the Legacy Binding panel on the Features tab. You enter your own d12 result; Two Voices (two dice, you pick) from level 11; Council of Spirits spends a once-per-month reroll from level 3; Crown of Legends lets you simply choose any spirit from level 20. A spirit you leave takes its features, proficiencies, spells and choices with it, and remembers its spent resources for when you come back. Binding at level 12 grants everything the spirit offers up to level 10 immediately.

## Engine work this needed

`Feat.resources`, `Item.resources` (granted on first equip), `Feature.resources`, `Feature.upgradeOf`, `Feature.rewardTrack` and `engine/rewardTracks.ts`, derived max-HP bonus (`max_hp`) and `hit_die_tier`, resource-threshold effect gating (`resource:<id><=n`), flat `damage_reduction:<type>`, `disable_action:<name>`, `dawn:<dice>` partial recharge, `perProficiencyBonus` resources, `expertise_if_proficient`, ability-score floors (`atLeast`), `addAbilityModifier`, typed spell range/damage modifications (`engine/spellModifiers.ts`), exact `+2/+1` ability mode, public/secret environment entries, prepared-combatant starting resources, a registry so abilities can apply homebrew conditions, and **Mode Groups** (`engine/modes.ts`).

## Still not automated (stated plainly)

- **Summoned and linked creatures.** The app has no creature owned by a character feature that acts after you and vanishes when the binding ends. The stat blocks exist and a DM can spawn them; the player's sheet does not own them.
- **Calendar.** There is none. A new month starts when the player presses Change; the "once per month / year / 10 years / 7 days" abilities are pools you mark available yourself.
- **Campaign-scale projects** (Take the Country, Dictator Perpetuo, The Four Builders), history/political inference, terrain judgment, forced-movement paths: text, per the spec's own Keep Manual list.
- **Aura benefits that land on allies** (Unbroken Line, Commanding Presence's allies, the Standard's auras, Hold Fast's allies): the effect is authored on the bearer's sheet; allies' shares are table-resolved.
- **Command the Field's per-target, per-turn mode choice.** There is no per-target state; the four benefits are in the spell text.
- **Edict swap on level-up:** remove the old Edict on the Features tab, then pick the new one. There is no combined swap prompt.
- **Imperial Command's range under Commander of Many** keeps showing 60 ft on the card (the Edict text says 120).
- **Item builder** still cannot author charges; `Item.resources` is available to built-in and imported items only.
- **Summon HP formulas** ("30 + 2 x Emperor level", "5 x level") are fixed at the first level the feature exists; enter the real HP when spawning.
- **Spec gaps filled with plain defaults** (each block says so): ability scores and CR for the summoned units, AC/HP for Prometheus and Heracles, the Pact slot table, spells known.
- Spell references use the library's ids; in a public SRD-only build a spell that is not in the SRD simply does not resolve, and no spell text is copied into the class.

## 5.5e (2024 rules) content

Built 5 October 2026 from the System Reference Document 5.2.1 (Creative Commons Attribution 4.0; attribution is in About). All of it is tagged `dnd5e-2024`, and `srd: false` because that flag here means SRD 5.1 (what the public build is filtered by).

- **Origin feats are granted for real by the background** (`Background.originFeat`, `engine/originFeat.ts`): the feat's feature, pools and picks come with the background as their source, so changing background takes them out again. Alert (initiative + proficiency bonus), Savage Attacker, Skilled (three skill picks), and Magic Initiate as one feat per list (Cleric, Druid, Wizard) with real cantrip and level-1 spell picks and a once-per-Long-Rest cast.
- **Backgrounds:** Acolyte, Criminal, Sage, Soldier, each with its directed ability bonus, two skills, tool proficiency and Origin feat. Equipment (package A or 50 GP) is text, not added automatically.
- **Species:** Dragonborn, Dwarf, Elf, Gnome, Goliath, Halfling, Orc, Tiefling (Human already existed). Level-gated traits (Draconic Flight, Large Form, lineage spells at 3 and 5) unlock at their level; uses equal to the proficiency bonus follow it; Breath Weapon dice scale 1d10 to 4d10; Dwarven Toughness is +1 max HP per level.
- **Stated gaps:** Elf, Gnome and Tiefling lineage spellcasting ability is fixed (Wisdom, Intelligence, Charisma) instead of a free Intelligence/Wisdom/Charisma choice, and Magic Initiate's is fixed per list (Wisdom for Cleric/Druid, Intelligence for Wizard). The level 3 and 5 lineage spells are castable once per Long Rest from their cards, not also with spell slots. Skilled offers skills only. Human's Versatile feat is still a note, and Heroic Inspiration is not built.

### 2024 classes and Weapon Mastery

Built 5 October 2026 from the same SRD 5.2.1: all twelve classes (`src/content/classes2024/`, ids `<name>_2024`, so the 2014 classes keep theirs) with their one SRD subclass each: Barbarian (Path of the Berserker), Bard (College of Lore), Cleric (Life Domain), Druid (Circle of the Land), Fighter (Champion), Monk (Warrior of the Open Hand), Paladin (Oath of Devotion), Ranger (Hunter), Rogue (Thief), Sorcerer (Draconic Sorcery), Warlock (Fiend Patron), Wizard (Evoker). They are real progressions to level 20: resources are pools that scale (Rage, Second Wind, Channel Divinity, Focus Points and Sorcery Points equal to the level, Lay On Hands at five times the level, Bardic Inspiration by Charisma modifier), upgrades replace rather than stack (Bardic die, Unarmored Movement, Martial Arts die), always-prepared and level-gated spells come with the class and subclass, and the choices are real picks (Divine Order, Primal Order, Fighting Style, Metamagic, Eldritch Invocations, Hunter's Prey, Elemental Affinity and so on). The 2024 spell lists are per class (`spellLists2024.ts`), and six spells new in 2024 were added (Divine Smite and Shining Smite as spells, Elementalism, Sorcerous Burst, Starry Wisp, Summon Dragon).

**Weapon Mastery** is a tracked property: each weapon has its mastery property (`content/weaponMastery.ts`, 38 weapons), a class grants capacity and an eligibility rule through effects (Barbarian melee only, Fighter, Paladin and Ranger any weapon, Rogue Simple plus Finesse/Light Martial), the player's picks are stored on the character and edited from the Features tab, and a mastered weapon's attack card shows its property.

New engine pieces these needed: formula pools (`perLevel`, `perAbilityModifier`), resource upgrades that change the recharge, effect level gates (`minLevel`), `addAbilityModifier`/`addProficiencyBonus`/`addPerLevel` on effects, level-gated spell access, and a 2024 Martial Arts die.

### 2024 follow-ups (built 5 October 2026)

- **Heroic Inspiration** is tracked state (`Entity.heroicInspiration`, `engine/heroicInspiration.ts`): never more than one (gaining it while holding it reports the overflow, which is lost unless given to another player), spent to reroll a die, restored by Human's Resourceful on a Long Rest, with a panel on the Character tab (Gain, Spend, Give away).
- **Cross-list spell choices**: a spell choice can carry a `spellFilter` (other classes' lists, exact levels, ritual only, include cantrips, ignore the slot cap) and a feature can open choices (`Feature.grantsChoices`). Magical Secrets (level 10+), Magical Discoveries, Blessed Warrior, Druidic Warrior, Pact of the Tome (three any-list cantrips, two any-list rituals), Mystic Arcanum (levels 6-9), Thaumaturge and Magician are real picks.
- **Prerequisite engine** (`engine/prerequisites.ts`): level, held option, feature, cantrip traits, spell and mutual exclusion on any choice option, enforced by the picker and by the engine. Eldritch Invocations carry their real prerequisites. Cantrip traits (deals damage, needs an attack roll, range 10+) are read from spell text, a disclosed heuristic.
- **Swappable choices**: `replacePoolOption` and a Swappable Choices panel for Fighting Style, Metamagic, Invocations, Hunter's Prey, Defensive Tactics and Fiendish Resilience. It refuses a swap whose prerequisites fail or that another held option needs. The app does not track level-ups or rests, so honoring the timing is the player's (the rule is shown on the confirm step).
- **Movement**: speeds equal to Speed (Roving, Thief), worn-gear conditions (`worn:not_heavy`, `worn:no_armor`, `worn:no_armor_or_shield`), Dragon Wings as a situational Fly 60, and a Speed of 0 zeroes every speed.
- **Spell versions**: the library keeps one record per spell id; a 2024 character resolves the same id to the SRD 5.2.1 version (333 spells, `spells/spellVersions2024.ts`, generated from the SRD text). Wired into the repo, the content resolver, spell cards, the Spells tab, the picker and creation. Monster stat blocks that spells name (Animated Object and so on) are not included.
- **Starting equipment**: every class and background package carries its SRD leftover gold, the gold alternative adds the gold, reopening a choice takes back exactly its items and gold, `item*N` stacks (parchment), and the tool a Monk or Bard names is a real item pick. Six gear items were added to the catalog.

### 2024 follow-ups, second round (built 6 October 2026)

- **Repeatable invocations**: Agonizing Blast, Eldritch Spear, Repelling Blast (a different known cantrip each time, checked against the option's traits) and Lessons of the First Ones (a different Origin feat) can be taken more than once. A pool option carries `repeatable: { target }`; a take is selected as `optionId::target`, validated by the engine, and the target is written on the granted feature's name and text. The picker lists the targets; swaps understand targeted ids.
- **Cantrip replacement**: a resolved spell choice can carry a replace rule. Blessed Warrior and Druidic Warrior use it (`replaceSpellChoiceSelection`, a Swappable Spells panel on the Features tab): the new cantrip must pass the choice's own filter and not be known already. Timing is the player's, as with the other swaps.
- **Compendium spell detail**: expanding a spell now loads the full record and shows casting time, range, components, duration, text and upcast, resolved for the Ruleset filter. With 2024 selected it is the SRD 5.2.1 version, labelled.
- **Heroic Inspiration from the DM**: a new change kind (`heroic_inspiration`) goes through the existing DM change-request flow: the DM proposes it from the party card, the player accepts or rejects, and the player's device applies it. The Reward protocol was not used: it only records a decision and applies nothing to the sheet.
- **Content provider seam** (SRD pack migration step 4, see docs/SRD_PACKS.md): `ContentProvider`, a pack-backed provider and a static one, and `createCharacter`, which builds a 2024 character from a provider alone. Tested from the generated SRD packs, and against the static catalog for parity. The creation screens are not moved onto it yet.

Remaining gaps:
- Lessons of the First Ones records the Origin feat but does not grant the feat's own features. Repeatable invocations that name a cantrip add no damage effect (they were text before too).
- A player who already has Heroic Inspiration keeps one when a DM awards another, and is not told it overflowed.
- Spell-list swaps other than Blessed Warrior and Druidic Warrior (Magic Initiate's Spell Change, Bard's) are not marked swappable yet.
- The Compendium shows the SRD 5.2.1 spell version only when the Ruleset filter is 2024. Monster stat blocks that spells name are not included.

Stated gaps:
- **Druid** Wild Shape forms are limited to the three beast forms the app has. Circle of the Land's land change means removing and re-picking.
- The Paladin aura and Aura of Courage/Devotion apply to the Paladin only; allies are table play.
- Not checked on a device or an emulator.
