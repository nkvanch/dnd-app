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
