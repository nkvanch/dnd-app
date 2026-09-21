# What Grimoire currently understands mechanically

This is a map of the edges, so you can aim at them. I wrote it from the engine's type definitions and tests (src/engine/types.ts, pipeline.ts, resolver.ts), and I have not exercised every line by hand. If something here is not true, that is a bug in this page and I want to hear about it.

## Modeled, the engine computes it

Passive effects, recomputed after every change. They all go through one resolver, and stacking does not depend on the order effects are collected in:
- Ability score and other numeric modifiers (add, multiply, set), including stat targets such as AC, speed and initiative
- Base AC formulas (armor, unarmored defense style: a base plus chosen abilities, with optional per-ability caps). The highest formula wins and flat AC bonuses stack on top
- Proficiency grants (skills, saves, tools, armor, weapons, languages) and skill expertise
- Damage resistance, immunity and vulnerability, condition immunity, and suppressing a condition's effects
- Senses such as darkvision, and non-walking movement (fly, swim, climb, burrow)
- Advantage and disadvantage on a named target
- Spell grants, either at will, per rest, or paid from slots, plus spells and cantrips added to the known list
- Situational effects that depend on a yes or no question the app cannot observe ("an ally within 5 ft"). An unanswered question counts as no, so a bonus is never overstated

Resources and time:
- Limited-use resources with a maximum and a recharge (short rest, long rest, other), and spending and restoring them
- Spell slots, pact slots, hit dice, exhaustion and temporary HP
- Conditions with durations (rounds, until rest, permanent). Rounds tick down on End Turn
- Concentration, including a round countdown taken from the spell's duration, and a concentration check when damaged (War Caster included)

Structure:
- Level-based progression per class and per subclass (features, resources, spell slots and known spells at chosen levels)
- Choices: skill, tool, language, spell, feat, ability score, feature pool and expertise. Each is recorded against whatever offered it, so two classes cannot overwrite each other's choices
- Multiclassing, with a campaign switch to allow or forbid it
- Dependencies between content, for example a species that grants a spell or an item that applies a condition. Export pulls in what an item needs, and import shows a preview before anything touches your library
- Homebrew classes, subclasses, species, subraces, backgrounds, feats, spells, items, monsters, conditions and standalone features, all using the same types as the built-in content

Configurable per table:
- Campaign rules: ability score cap, level cap, XP on or off, HP per level (fixed, rolled or max), multiclassing allowed, and ability score generation (including point buy settings)
- Named custom rule profiles built from those settings

## Described, not resolved: the app shows it and you decide

- Reactive features and triggers ("when you are hit..."). They appear as a reminder on the sheet and the action card, and are never fired automatically
- Hit, miss, success and failure outcomes. They appear as text under the action, and you roll and apply them
- Attack roll resolution, targeting, and any outcome that depends on dice or table judgment
- Feat prerequisites are matched from their text for filtering, and a player can still take a feat with an unmet prerequisite after a warning
- Anything a designer writes as free text with no matching effect type

## Escape hatches

- Manual override of derived values (free edit for players, an override screen for DMs)
- Custom features: write a one-off feature during play, or add and remove any feature on a character
- Campaign rules and rule profiles, above

## Not there yet, so please do not spend time proving these

- Rulesets other than 5e-compatible. The ability list, the skill list and the d20 model are fixed
- A general formula or expression language for scaling. There is no arbitrary scripting, on purpose
- Rank-based proficiency (trained, expert, master and so on). There is only trained and expertise

## The ask

Please find something on this page that you have designed and that Grimoire cannot express correctly.
