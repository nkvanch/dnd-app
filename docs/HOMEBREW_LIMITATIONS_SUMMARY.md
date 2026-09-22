# Grimoire homebrew system: current limitations

A clean, standalone summary of what Grimoire's homebrew and content system cannot do today, drawn from a full investigation across every content type (classes, subclasses, races, spells, items, monsters, and full character builds). Nothing here is built or changed, this is analysis only, as of 22 September 2026.

For the underlying evidence, code citations, and the cases that surfaced each one, see [HOMEBREW_AUTHORING_LIMITS.md](HOMEBREW_AUTHORING_LIMITS.md) and [CANONICAL_STRESS_SUITE.md](CANONICAL_STRESS_SUITE.md) in this folder. This document is the readable summary of that work, not a replacement for it.

## Missing primitives

These need real engine work. Nothing currently in the content model supports them.

1. **Modes and forms.** A character, monster, or item cannot hold more than one independent "which of several states am I in" at a time if any two of those states both want to fully replace the stat block. The one real transformation mechanism (Wild Shape style) is a single slot, not a collection, so a racial form and a spell-based transformation cannot both be active together. A stance-style mode (using conditions) does not have this problem.
2. **Level-gated features beyond character level 1.** Any racial trait, ability, or transformation meant to unlock later as the character levels up does not actually activate. This is not a guess: it is already disclosed in the app's own shipped content, across a dozen or more official races, and in official Aasimar's own signature ability.
3. **No re-selectable choice.** Once a choice (a feat, an invocation-style pick, a subclass option) is resolved, there is no way to swap it for a different option later. Warlock-style "you can change one invocation when you level up" designs are not supported.
4. **No choice dependency.** A choice's available options cannot depend on how an earlier choice was resolved (for example, picking a draconic ancestry color and then only seeing that color's matching options).
5. **No point-budget choice.** Every choice is "pick exactly N from a list." There is no way to spend a shared point budget across options of different costs, the way a build-your-own-lineage system needs.
6. **No persistent state pointing at another creature.** A "Rival," a "Quarry," or a maintained curse on a specific enemy has nothing to attach to. This has failed three unrelated designs already.
7. **No modifying something already granted.** Every grant only adds something new. There is no way to change a property of something the character already has, such as a spell's range, a weapon's damage type, or an existing attack gaining a new property.
8. **No summoned or linked creature that the game state actually tracks.** A companion, a spell-summoned creature, or a boss's minion cannot be tied to a character or monster feature, have its own controlled turn, or scale automatically from its owner's stats. Spell-based summons are the worst case: even the official "Summon X" spell family exists today as placeholder text with no real effect at all.
9. **No monster phases.** A monster template holds exactly one set of stats and actions. There is no way to give a boss a second phase, triggered by HP or anything else.
10. **No HP-threshold trigger of any kind.** "Bloodied" only controls how HP is displayed to players. Nothing can fire off an effect when a creature crosses a health threshold.
11. **No swarm or unit abstraction.** There is no way to represent "one stat block standing in for many creatures." A swarm-flavored monster today behaves like any other single creature.
12. **No real conditional recharge.** "Recharge on a 5 or 6" cannot actually be evaluated. It can only be written as descriptive text.
13. **No item-level mode.** A weapon that switches between configurations (a transforming weapon, for example) has no mechanism to change its own properties.
14. **No forced movement toward a point or object.** An ability that pulls the wielder to a weapon, or otherwise moves a creature to a specific place rather than in a direction, is not supported.
15. **No automatic detection of a fact about a target.** A weapon that deals bonus damage against a category of creature (dragons, fiends) cannot check that automatically. The closest existing tool always requires the player to answer a yes-or-no question by hand.
16. **No cross-character resource sharing.** A resource, die, or use cannot be given from one player's character to another's.

## Real mechanism, but nothing can author it

These are cheaper to fix than the list above: the engine already has the capability, but the builder screens that creators use never expose it.

- **Item charges.** An item's ability to draw from its own resource pool already works at the engine level, using the same mechanism proven by class resources like Rage. The homebrew item builder simply never lets a creator set it.
- **Spell concentration effects.** A spell's ability to apply a real mechanical effect while the caster concentrates already works and is genuinely used by the resolution code. The homebrew spell builder has no way to author it, by the builder's own admission in its code comments.
- **Homebrew companions.** The underlying companion mechanism exists, but only three official companions can ever use it. There is no builder for a creator to define a new one.
- **Homebrew transformation forms.** The mechanism to fully transform into another creature's stats works and is not limited to any one class, but the list of forms to transform into is fixed at seven official animal shapes with no way to add more.

## A note on what isn't a limitation

A fair amount of what looked likely to fail turned out to already work when actually checked against the code: overlapping grants from multiple sources resolve correctly, override precedence is sound and DM overrides genuinely win, shared resource pools with different costs per ability already work, legendary and lair actions are properly implemented, and a conditional effect gated on a yes-or-no question already works. None of those are limitations. They are listed with their evidence in [HOMEBREW_AUTHORING_LIMITS.md](HOMEBREW_AUTHORING_LIMITS.md) so a future review does not waste time re-checking them.
