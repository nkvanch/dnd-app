# Emperor Warlock — Playtest v1

Reference copy of the class as designed, 22 September 2026. This is a design document, not an in-app build — see [MODE_TRANSFORMATION_LAYER_PROPOSAL.md](../MODE_TRANSFORMATION_LAYER_PROPOSAL.md) for why the class as a whole cannot be built in Grimoire today, and [HOMEBREW_AUTHORING_LIMITS.md](../HOMEBREW_AUTHORING_LIMITS.md) for the specific gaps.

Not for outreach in this form — too large for a creator stress-test pack (see the outreach guide's 5–6 entry rule). A small slice of it may still go out; that is a separate decision.

## Class identity

A battlefield commander whose power comes from the memories, ambitions, tactics and legends of great historical or mythological figures.

- **Primary ability:** Charisma. **Secondary:** Dexterity or Constitution.
- **Hit Die:** d8. **Armor:** light armor. **Weapons:** simple weapons and one martial weapon of choice.
- **Saving throws:** Wisdom, Charisma.
- **Skills:** choose two from Animal Handling, History, Insight, Intimidation, Investigation, Persuasion, Religion, Survival.
- **Spirit Save DC:** 8 + proficiency bonus + Charisma modifier.
- **Spirit Attack Modifier:** proficiency bonus + Charisma modifier.

## Base class progression

| Level | PB | Class Features | Command Die |
|---|---|---|---|
| 1 | +2 | Legacy Binding, Imperial Command, Spirit I | d6 |
| 2 | +2 | 2 Imperial Edicts | d6 |
| 3 | +2 | Council of Spirits, Historical Expertise | d6 |
| 4 | +2 | ASI / Feat | d6 |
| 5 | +3 | Extra Attack, Spirit II | d6 |
| 6 | +3 | Imperial Edict | d6 |
| 7 | +3 | Commanding Presence | d6 |
| 8 | +3 | ASI / Feat | d6 |
| 9 | +4 | Improved Command | d8 |
| 10 | +4 | Spirit III, Imperial Edict | d8 |
| 11 | +4 | Two Voices | d8 |
| 12 | +4 | ASI / Feat | d8 |
| 13 | +5 | Tireless Command | d8 |
| 14 | +5 | Imperial Edict | d8 |
| 15 | +5 | Spirit IV | d8 |
| 16 | +5 | ASI / Feat | d8 |
| 17 | +6 | Greater Command, Imperial Edict | d10 |
| 18 | +6 | Greater Presence | d10 |
| 19 | +6 | ASI / Feat | d10 |
| 20 | +6 | Crown of Legends, Spirit V | d10 |

ASIs land at 4, 8, 12, 16, 19 — the standard cadence. Spirits should not permanently raise ability scores; temporary transformations are fine.

## Legacy Binding

At level 1, roll a d12 at the start of every in-game month.

| d12 | Spirit |
|---|---|
| 1 | Genghis Khan |
| 2 | Stalin |
| 3 | Hannibal |
| 4 | Napoleon |
| 5 | Alexander the Great |
| 6 | Odysseus |
| 7 | Julius Caesar |
| 8 | Saladin |
| 9 | Montezuma |
| 10 | David IV the Builder |
| 11 | Sun Tzu |
| 12 | Joan of Arc |

You keep that spirit until the next in-game month, gaining every feature from it you meet the level for. When the spirit changes, its abilities disappear and the new spirit's replace them.

## Imperial Command

You have Command Dice equal to your proficiency bonus. As a bonus action, give yourself or a creature within 60 feet that can see or hear you one Command Die; within the next minute it can add the die to an attack roll, ability check, saving throw, or weapon damage roll. Consumed on use. All dice return on a long rest. d8 at level 9, d10 at level 17.

**Level 13 — Tireless Command.** Finishing a short rest with no Command Dice left regains one.

## Imperial Edicts

The class's invocation equivalent. Learn two at level 2, one more at 6, 10, 14, 17. Swap one whenever you gain a level.

| Edict | Effect |
|---|---|
| Scholar of Empires | Expertise in History |
| Voice of Authority | Persuasion proficiency, expertise if already proficient |
| Battlefield Observer | Add CHA to initiative |
| Iron Discipline | Advantage against frightened |
| Mounted Commander | Animal Handling proficiency, advantage controlling mounts |
| Tactical Withdrawal | Disengage as bonus action, PB/long rest |
| Rally | Spend a Command Die to give temp HP instead |
| Unbroken Line | Adjacent ally gets +1 AC while you aren't incapacitated |
| Forced March | Group travels one extra hour before forced-march saves |
| Commander of Many | Command Die range becomes 120 ft |
| Historian | After 10 minutes observing a settlement, learn its approximate military/political history |
| Unshaken | Once/long rest, reroll a failed Wisdom or Charisma save |

More can be added later.

## Level 3 — Council of Spirits

Once per month, after rolling, you may reject the result and roll again — you must keep the second result. Also gain expertise in History or one Emperor Warlock skill.

## Level 5 — Extra Attack

Attack twice when you take the Attack action.

## Level 7 — Commanding Presence

You and allies within 10 feet have advantage on saves against being frightened. 30 feet at level 18.

## Level 11 — Two Voices

When the month changes, roll two d12s and choose which spirit answers. Council of Spirits can reroll one of those dice.

## Level 20 — Crown of Legends

No more random rolls unless you want them — choose any of the twelve spirits each month, and unlock that spirit's level-20 feature.

## The twelve spirits

### 1 — Genghis Khan

- **L1 Steppe Archer.** Shortbow/longbow/Animal Handling proficiency. Mounted: no disadvantage on ranged attacks from an adjacent enemy, bow range +50%, mount/dismount costs 5 ft.
- **L5 Born in the Saddle.** Mount +10 ft speed; advantage on saves/checks to avoid falling from it; can short rest while traveling mounted.
- **L10 Eyes of the Khan.** Once/long rest, summon spectral eagles for 10 minutes, scouting a 1-mile outdoor radius; as an action, see through one eagle (visible creatures, camps, fires, roads, large structures; not through cover or magical concealment).
- **L15 Appoint a Noyan.** Once/month, a willing NPC of CR ½ or lower gains six Sidekick levels for the duration of the current binding, lost when Genghis leaves.
- **L20 Reincarnation of the Khan.** Once per 10 in-game years, spend 24 hours to gain a wholly new appearance and mundane identity; the soul is unchanged and still detectable by soul-reading magic.

### 2 — Stalin

- **L1 Firing Squad.** Once/long rest, target within 60 ft makes a DEX or CON save (its choice) or takes 4d6 piercing (half on success); scales to 6d6 (L5), 8d6 (L10), 10d6 (L15), 12d6 (L20). Twenty riflemen are narrative flavor for one attack.
- **L5 Open the Vodka.** Consume a bottle of alcohol to summon a spectral mob for 1 minute (AC 12, HP 30 + 2×Emperor level, speed 30, 20-ft square; attack 2d6+CHA bludgeoning using your Spirit Attack modifier; enemies in its space take −2 to ability checks; acts right after you).
- **L10 Burn Moscow.** After 10 minutes destroying a defensible structure/base you control, pursuers have disadvantage on tracking/navigation/forced pursuit for 24 hours, your party has advantage evading pursuit.
- **L15 Comrades Provide.** Once per 7 long rests, in a settlement with supporters, requisition mundane goods/services worth up to 50 × Emperor level gp (no magic items, no cash).
- **L20 Take the Country.** A four-stage campaign project (Popular Control → Local Influence → State Power → Coup), each with DM-set obstacles; advantage (doubled proficiency if applicable) on Charisma checks advancing it.

### 3 — Hannibal

- **L1 Enemy of Empire.** Choose one faction; History/Survival proficiency concerning it; once per turn, extra damage equal to PB against its agents.
- **L5 Alpine March.** You and companions within 60 ft ignore nonmagical difficult terrain overland; pace can't drop below half.
- **L10 Double Envelopment.** Reaction: when an ally hits a creature adjacent to you, make one weapon attack against it. PB uses/long rest.
- **L15 Master Campaigner.** Auto-succeed on exhaustion saves from ordinary heat/cold; Survival expertise.
- **L20 Battle on Enemy Ground.** Once/long rest, 1 minute in hostile territory: you and allies within 60 ft get +10 ft speed, +2 AC, advantage vs. frightened; first weapon attack each turn has advantage.

### 4 — Napoleon

- **L1 Scientific Corps.** Add half PB to untrained Intelligence checks; Investigation or History proficiency.
- **L5 Imperial Presence.** CHA +1 (max 20); Persuasion proficiency or expertise.
- **L10 Against the Odds.** Once/long rest, when outnumbered at the start of combat: allies within 30 ft get temp HP = Emperor level for 1 minute, and add half PB to saves on round 1.
- **L15 Chosen Rival.** After 1 hour studying a target, advantage on Investigation/History/Survival about it, +1d8 damage once per turn against it or its agents.
- **L20 Grand Battery.** Once/long rest, point within 1 mile, 60-ft radius, DEX save: 10d8 fire + 10d8 bludgeoning (half on success), double damage to objects/structures.

### 5 — Alexander the Great

- **L1 Hammer and Anvil.** Once per turn, +PB to attack roll against a creature also threatened by an ally (not while 2+ enemies are adjacent to you).
- **L5 Bucephalus.** Once/long rest, summon a spectral warhorse (AC 14, HP 5×Emperor level, speed 120) for 10 minutes; vanishes at 0 HP.
- **L10 War Elephant.** Once/long rest, summon a spectral war elephant (AC 15, HP 60, speed 40) for 10 minutes with three weapon positions; up to three creatures can operate a bow each (range 150/600, 1d8 piercing using the operator's attack mod); it acts right after you, your bonus action commands anything but Dodge.
- **L15 Royal Panoply.** Spend 10 gp, 1 hour: AC becomes 17 (+shield); a 50-point ward absorbs damage before HP; refills on long rest, or spend 10 pp on a short rest to restore 10.
- **L20 Conqueror's Tempo.** Once/long rest, 1 minute: +20 ft speed, weapon ranges double, one extra weapon attack whenever you take the Attack action.

### 6 — Odysseus

- **L1 Cunning.** Insight and Investigation proficiency, expertise in one.
- **L5 Wooden Horse.** Once/long rest, create a Large hidden structure for 8 hours, up to eight Medium creatures inside; others notice only on an Investigation/Insight check vs. your Spirit DC.
- **L10 Silver Tongue.** Animal Handling and Deception proficiency, expertise in one; reroll a failed check with either once/long rest.
- **L15 I Will Return Home.** Always know direction/distance/plane of one chosen home; can't get lost heading there nonmagically; advantage vs. magic that blocks the return.
- **L20 Heroes of the Odyssey.** Once/long rest, summon one hero for 1 minute: **Achilles** (AC 20, HP 80, two attacks 2d10+6 slashing, vanishes if he takes a critical poison hit), **Prometheus** (20-ft radius 10d6 fire DEX-half on arrival, then 3d10 fire ranged attacks), or **Heracles** (STR 26, advantage on STR checks/saves, two attacks 2d12+8 bludgeoning, counts as Huge for lifting/pushing/breaking, will attempt any physical labor ordered).

### 7 — Julius Caesar

- **L1 Pilum Doctrine.** Javelin range 60/240; drawing a thrown weapon to attack needs no object interaction.
- **L5 Twenty-Three Wounds.** Once/long rest, a hit that would drop you to 0 instead leaves you at 1.
- **L10 Forced March.** Allies starting their turn within 30 ft get +10 ft speed until their next turn; group travels one extra hour before forced-march checks.
- **L15 Codifier.** History and (Investigation or Persuasion) expertise; 10 minutes studying a legal/government structure reveals its hierarchy, enforcement and major procedures.
- **L20 Dictator Perpetuo.** Campaign-scale project turning a republic centralized: advantage (doubled proficiency where applicable) on coalition-building, military loyalty, institutional reform, public persuasion checks.

### 8 — Saladin

- **L1 Chivalric Defender.** Religion and Insight proficiency; reaction, PB/long rest, add PB to an adjacent ally's AC against one attack.
- **L5 Cavalry Commander.** You and mounted allies within 30 ft get +15 ft mounted speed.
- **L10 Decisive Charge.** Once per turn, after moving 20+ ft toward a target before a melee hit, +3d8 damage.
- **L15 Siege Master.** Double damage to structures/objects; you and allies within 30 ft have advantage vs. traps, collapsing fortifications, siege weapons.
- **L20 Wisdom of the Sultan.** Wisdom becomes 24 if lower while Saladin is active; Wisdom save proficiency if not already had.

### 9 — Montezuma

- **L1 Trail Reader.** Survival proficiency (expertise if already proficient); advantage following physical tracks.
- **L5 Jungle March.** Ignore nonmagical difficult terrain; party doesn't lose overland speed to ordinary vegetation while traveling with you.
- **L10 Eagle and Jaguar Host.** Once/long rest, summon a warband (AC 14, HP 70, speed 35, 20-ft square, attack = Spirit Attack modifier, 4d8 piercing; representing ~100 warriors as one creature).
- **L15 Tribute.** Every 7 days, receive 10% of legitimate expenditures since the last tribute, max 25 × Emperor level gp; transfers within the party don't count.
- **L20 Avatar of Tenochtitlan.** Once/long rest, 1 minute: scores rise to at least STR 22 / DEX 24 / CON 22 / CHA 24 (INT unaffected if already below 8); revert after.

### 10 — David IV the Builder

- **L1 Royal Authority.** Persuasion and History proficiency, expertise in one.
- **L5 Didgori.** Once/long rest, if outnumbered when initiative is rolled: temp HP = Emperor level; round 1, you and allies within 30 ft get +2 to attacks and saves.
- **L10 Spear Wall.** Once/long rest, a 30×5-ft spectral spear line for 2 rounds; STR save or 5d8 piercing and speed 0 for the turn (half damage on success).
- **L15 Kartvelebi and Khevsurebi.** Once/long rest, 1 minute, summon two units under one command acting right after you: **Kartvelebi** (AC 16, HP 80, speed 30, attack 4d10 slashing, once/summon add 3d8 radiant to a hit) and **Khevsurebi** (AC 15, HP 60, speed 35, bow 300 ft 3d8 piercing or sword 2d8 slashing, reaction +2 AC against one attack).
- **L20 The Four Builders.** Once per year, at a controlled site, construct a permanent fortified tower/keep over 12 months; seizing the site pauses work and adds 6 months on recovery.

### 11 — Sun Tzu

Spell-heavy, tactical. (No combat features listed separately beyond its spirit spells below — deliberately camp, per the design notes.)

### 12 — Joan of Arc

The morale/paladin-like spirit — see spirit spells below; no separate combat feature list given beyond those.

## Spirit Pact Magic

- **Ability:** Charisma. **Save DC:** 8 + PB + CHA. **Attack modifier:** PB + CHA.
- **Warlock-style Pact Magic:** few slots, all the same level, recover on short or long rest; 6th–9th level magic comes through Legacy Arcanum (renamed Mystic Arcanum), once/long rest each.
- **Cantrips.** Eldritch Blast, Mage Hand, Minor Illusion, Prestidigitation, Thaumaturgy, Toll the Dead, Guidance, Message, Mind Sliver, Friends, Blade Ward, True Strike. Eldritch Blast is known automatically at level 1, plus two chosen cantrips.
- **1st level:** Armor of Agathys, Cause Fear, Charm Person, Command, Comprehend Languages, Detect Magic, Disguise Self, Expeditious Retreat, False Life, Hex, Heroism, Illusory Script, Protection from Evil and Good, Silent Image, Unseen Servant.
- **2nd level:** Aid, Augury, Blur, Darkness, Detect Thoughts, Enhance Ability, Enthrall, Hold Person, Invisibility, Locate Object, Misty Step, Pass without Trace, Phantasmal Force, See Invisibility, Silence, Suggestion.
- **3rd level:** Clairvoyance, Counterspell, Dispel Magic, Fear, Fly, Gaseous Form, Hypnotic Pattern, Major Image, Phantom Steed, Protection from Energy, Sending, Speak with Dead, Spirit Guardians, Tongues.
- **4th level:** Banishment, Charm Monster, Confusion, Dimension Door, Divination, Freedom of Movement, Greater Invisibility, Hallucinatory Terrain, Locate Creature, Phantasmal Killer, Private Sanctum, Arcane Eye, a summon spell (placeholder — "Summon Ancestor" considered for later).
- **5th level:** Contact Other Plane, Dream, Geas, Hold Monster, Legend Lore, Mislead, Modify Memory, Scrying, Telepathic Bond, Wall of Force, possibly Greater Restoration/Commune.
- **Legacy Arcanum** (levels 11/13/15/17, one spell each): 6th — Mass Suggestion, True Seeing, Heroes' Feast, Eyebite, Globe of Invulnerability, Guards and Wards, Magic Jar (favorites: Mass Suggestion, True Seeing, Heroes' Feast, Magic Jar). 7th — Etherealness, Forcecage, Plane Shift, Project Image, Sequester, Teleport, Crown of Stars (favorites: Project Image, Teleport, Plane Shift, Sequester). 8th — Antimagic Field, Dominate Monster, Feeblemind, Glibness, Maze, Mind Blank, Power Word Stun (favorites: Glibness, Mind Blank). 9th — Foresight, Gate, Imprisonment, Power Word Kill, Psychic Scream, True Polymorph, Weird (favorite/signature: Foresight).

### Spirit-granted spells

Each spirit grants two bonus spells at L1 (1st level), L5 (3rd level), L10 (5th level), one at L15 (7th level) and one at L20 (9th level), known only while that spirit is active, not counted against normal spells known. 1st–5th level spells still cost a normal Pact Magic slot; 6th+ level ones consume the matching Legacy Arcanum use instead of being free.

| Spirit | L1 | L5 | L10 | L15 | L20 |
|---|---|---|---|---|---|
| Genghis Khan | Longstrider, Hunter's Mark | Phantom Steed, Haste | Swift Quiver, Commune with Nature | Wind Walk | Foresight |
| Stalin | Command, Cause Fear | Fear, Animate Dead | Geas, Modify Memory | Finger of Death | Power Word Kill |
| Hannibal | Longstrider, Fog Cloud | Pass without Trace, Nondetection | Freedom of Movement, Mislead | Reverse Gravity | Foresight |
| Napoleon | Command, Heroism | Sending, Haste | Scrying, Wall of Force | Forcecage | Meteor Swarm |
| Alexander | Heroism, Longstrider | Haste, Phantom Steed | Dominate Person, Steel Wind Strike* | Conjure Celestial (or similar) | Shapechange |
| Odysseus | Disguise Self, Silent Image | Suggestion, Major Image | Modify Memory, Mislead | Project Image | Foresight |
| Julius Caesar | Command, Heroism | Sending, Tongues | Geas, Legend Lore | Teleport | Foresight |
| Saladin | Protection from Evil and Good, Heroism | Beacon of Hope, Aura of Vitality | Greater Restoration, Circle of Power | Holy Aura | Mass Heal |
| Montezuma | Entangle, Hunter's Mark | Plant Growth, Conjure Animals | Commune with Nature, Insect Plague | Animal Shapes | Shapechange |
| David IV | Shield of Faith, Heroism | Crusader's Mantle, Spirit Guardians | Wall of Stone, Greater Restoration | Temple of the Gods* | Invulnerability* |
| Sun Tzu | Fog Cloud, Silent Image | Pass without Trace, Clairvoyance | Mislead, Scrying | Project Image | Foresight |
| Joan of Arc | Heroism, Bless | Beacon of Hope, Crusader's Mantle | Circle of Power, Greater Restoration | Holy Aura | Mass Heal |

\* Not standard SRD/PHB spells as written — check source before building; the app in particular can only depend on SRD 5.1 spells (see HOMEBREW_AUTHORING_LIMITS.md).

## Eldritch Blast Edicts

- **Imperial Blast.** Add CHA modifier to Eldritch Blast damage (the class's Agonizing Blast).
- **Commanding Repulsion.** One Eldritch Blast hit per turn may push a creature 10 feet.
- **Suppressing Fire.** A creature damaged by Eldritch Blast has speed reduced by 10 ft until your next turn.
- **Long-Range Artillery.** Eldritch Blast range becomes 300 ft.
- **Mark of the Emperor.** When you hit with Eldritch Blast, the next ally to attack that creature before your next turn gets a Command Die for free (not from your pool); likely once per turn or PB/long rest.

## Design summary

Eldritch Blast for reliable base offense, Pact Magic for a flexible toolkit, Imperial Edicts as the permanent build, Command Dice as the leadership mechanic, the monthly spirit as randomized specialization, spirit spells as monthly magical specialization, spirit abilities as the big legendary effects.
