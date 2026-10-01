# Emperor Warlock

## Playtest / Demo-Pack Class

A battlefield commander whose power comes from the memories, ambitions, tactics, legends, and magical echoes of great historical or mythological figures.

> **Important implementation note:** In the intended class design, Legacy Binding changes the active spirit periodically. Grimoire does not yet support that full monthly mode-replacement system cleanly, so each Bound Spirit is currently represented internally as a subclass chosen at level 1. Player-facing UI should say **Bound Spirit**, never **Subclass**.

---

## Class Identity

- **Primary ability:** Charisma
- **Secondary abilities:** Dexterity or Constitution
- **Hit Die:** d8
- **Armor:** light armor
- **Weapons:** simple weapons and one martial weapon of your choice
- **Saving throws:** Wisdom, Charisma
- **Skills:** choose two from Animal Handling, History, Insight, Intimidation, Investigation, Persuasion, Religion, Survival

### Spirit Save DC

`8 + proficiency bonus + Charisma modifier`

### Spirit Attack Modifier

`proficiency bonus + Charisma modifier`

---

## Base Class Progression

| Level | PB | Class Features | Command Die |
|---|---:|---|---|
| 1 | +2 | Legacy Binding, Imperial Command, Bound Spirit I | d6 |
| 2 | +2 | 2 Imperial Edicts | d6 |
| 3 | +2 | Council of Spirits, Historical Expertise | d6 |
| 4 | +2 | ASI / Feat | d6 |
| 5 | +3 | Extra Attack, Bound Spirit II | d6 |
| 6 | +3 | Imperial Edict | d6 |
| 7 | +3 | Commanding Presence | d6 |
| 8 | +3 | ASI / Feat | d6 |
| 9 | +4 | Improved Command | d8 |
| 10 | +4 | Bound Spirit III, Imperial Edict | d8 |
| 11 | +4 | Two Voices | d8 |
| 12 | +4 | ASI / Feat | d8 |
| 13 | +5 | Tireless Command | d8 |
| 14 | +5 | Imperial Edict | d8 |
| 15 | +5 | Bound Spirit IV | d8 |
| 16 | +5 | ASI / Feat | d8 |
| 17 | +6 | Greater Command, Imperial Edict | d10 |
| 18 | +6 | Greater Presence | d10 |
| 19 | +6 | ASI / Feat | d10 |
| 20 | +6 | Crown of Legends, Bound Spirit V | d10 |

ASIs occur at levels **4, 8, 12, 16, and 19**.

Bound Spirit features occur at **1, 5, 10, 15, and 20**.

---

# Legacy Binding

## Intended Full-Class Design

At level 1, roll a d12 at the start of every in-game month.

| d12 | Bound Spirit |
|---:|---|
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

You keep that spirit until the next in-game month and gain every feature from it for which you meet the level requirement. When the spirit changes, the old spirit's abilities disappear and the new spirit's replace them.

## Current Grimoire Representation

Choose a **Bound Spirit at level 1**.

Internally, Grimoire may store this using subclass machinery, but all user-facing text should use:

- **Choose Bound Spirit**
- **Bound Spirit — David IV the Builder**
- **Bound Spirit Feature**

and never present the choice as a conventional subclass.

---

# Imperial Command

You have **Command Dice equal to your proficiency bonus**.

As a **Bonus Action**, choose yourself or one creature within **60 feet** that can see or hear you. Grant that creature one Command Die.

Within the next minute, the creature can roll that die and add it to one:

- attack roll
- ability check
- saving throw
- weapon damage roll

The die is consumed when used.

All expended Command Dice return when you finish a **Long Rest**.

### Command Die Progression

- Levels 1–8: d6
- Levels 9–16: d8
- Levels 17–20: d10

### Level 13 — Tireless Command

When you finish a Short Rest with no Command Dice remaining, regain one Command Die.

---

# Imperial Edicts

Learn 2 Edicts at level 2, then one additional Edict at levels 6, 10, 14, and 17. You know 6 Edicts at level 20. Whenever you gain an Emperor Warlock level, you may replace one Edict you know with another.

## 1. Scholar of Empires
Gain History proficiency. If already proficient, gain expertise.

## 2. Voice of Authority
Gain Persuasion proficiency. If already proficient, gain expertise.

## 3. Battlefield Observer
Add your Charisma modifier to initiative rolls.

## 4. Iron Discipline
You have advantage on saving throws against being frightened.

## 5. Mounted Commander
Gain Animal Handling proficiency, or expertise if already proficient. You have advantage on Animal Handling checks made to control, calm, direct, or remain in control of a mount.

## 6. Tactical Withdrawal
As a Bonus Action, take the Disengage action. Uses equal proficiency bonus per Long Rest.

## 7. Rally
When you would grant a creature a Command Die using Imperial Command, you may instead expend that die to grant temporary hit points equal to:

`one roll of your Command Die + your Charisma modifier`

## 8. Unbroken Line
While you are not incapacitated, **every ally within 5 feet of you gains +1 AC**.

## 9. Forced March
While traveling with you, your group can travel for one additional hour each day before normal forced-march consequences begin.

## 10. Commander of Many
Imperial Command range increases from 60 ft to 120 ft.

## 11. Historian
After spending at least 10 minutes observing and investigating a settlement, ruin, fortress, battlefield, seat of government, or similarly important location, ask the DM for a concise account of its approximate military or political history. The answer reflects what could reasonably be inferred from evidence and common knowledge; it does not reveal unknowable or magically concealed secrets.

## 12. Unshaken
When you fail a Wisdom or Charisma saving throw, reroll it and use the new result. Once per Long Rest. This does not inherently consume your combat Reaction.

---

# Eldritch Blast Edicts

These use the same Edict choice pool.

## 13. Imperial Blast
When you hit with Eldritch Blast, add your Charisma modifier to the damage of that beam.

## 14. Commanding Repulsion
Once on each of your turns when Eldritch Blast hits a creature, you may push that creature up to 10 ft directly away from you.

## 15. Suppressing Fire
When you damage a creature with Eldritch Blast, its speed is reduced by 10 ft until the start of your next turn. Multiple beams against the same target do not stack the reduction.

## 16. Long-Range Artillery
Eldritch Blast range becomes 300 ft.

## 17. Mark of the Emperor
Once on each of your turns when you hit a creature with Eldritch Blast, mark it until the start of your next turn. The next ally other than you to make an attack roll against the marked creature gains one free Command Die for that attack roll. The die does not expend your pool and is consumed on use.

---

# Other Base-Class Features

## Level 3 — Council of Spirits
Once per in-game month, after rolling for Legacy Binding, you may reject the result and roll again; you must keep the second result.

Also gain expertise in History or one Emperor Warlock class skill in which you are proficient.

## Level 5 — Extra Attack
Attack twice when you take the Attack action.

## Level 7 — Commanding Presence
You and allies within 10 ft have advantage on saving throws against being frightened.

At level 18, the radius becomes 30 ft.

## Level 11 — Two Voices
When the month changes, roll two d12s and choose which spirit answers. Council of Spirits can reroll one of those dice.

## Level 20 — Crown of Legends
No more random rolls unless you want them. Choose any of the twelve spirits each month and unlock that spirit's level-20 feature.

---

# Bound Spirits

Each Bound Spirit grants features at levels 1, 5, 10, 15, and 20.

## 1 — Genghis Khan

### L1 — Steppe Archer
Shortbow, longbow, and Animal Handling proficiency. While mounted: no disadvantage on ranged attacks solely from an adjacent enemy, bow range +50%, mount/dismount costs 5 ft.

### L5 — Born in the Saddle
Mount +10 ft speed; advantage on checks/saves to avoid falling; can Short Rest while traveling mounted.

### L10 — Eyes of the Khan
Once/Long Rest, summon spectral eagles for 10 minutes to scout a 1-mile outdoor radius. As an action, see through one eagle. They reveal visible creatures, camps, fires, roads, and large structures, but not through cover or magical concealment.

### L15 — Appoint a Noyan
Once/month, one willing NPC of CR 1/2 or lower gains six Sidekick levels for the duration of the current binding.

### L20 — Reincarnation of the Khan
Once per 10 in-game years, spend 24 hours to gain a wholly new appearance and mundane identity. The soul is unchanged.

---

## 2 — Stalin

### L1 — Firing Squad
Once/Long Rest, target within 60 ft makes DEX or CON save (target chooses). Damage on failed save: 4d6 at L1, 6d6 at L5, 8d6 at L10, 10d6 at L15, 12d6 at L20; half on success.

### L5 — Open the Vodka
Consume a bottle of alcohol to summon a spectral mob for 1 minute: AC 12, HP `30 + 2 × Emperor level`, Speed 30, 20-ft square, attack `2d6 + CHA` bludgeoning using Spirit Attack modifier; enemies in its space take -2 to ability checks; acts immediately after you.

### L10 — Burn Moscow
After 10 minutes destroying a defensible structure/base you control, pursuers have disadvantage on tracking/navigation/forced-pursuit checks for 24 hours and your party has advantage evading pursuit.

### L15 — Comrades Provide
Once per 7 Long Rests, in a settlement with supporters, requisition mundane goods/services worth up to `50 × Emperor level gp`. No magic items or cash.

### L20 — Take the Country
Four-stage campaign project: Popular Control → Local Influence → State Power → Coup. DM sets obstacles. Advantage on Charisma checks advancing it; doubled proficiency where applicable.

---

## 3 — Hannibal

### L1 — Enemy of Empire
Choose one faction; History or Survival proficiency concerning it. Once per turn deal extra damage equal to PB against its agents.

### L5 — Alpine March
You and companions within 60 ft ignore nonmagical difficult terrain overland; pace cannot drop below half due solely to ordinary terrain.

### L10 — Double Envelopment
Reaction when an ally hits a creature adjacent to you: make one weapon attack against it. PB uses/Long Rest.

### L15 — Master Campaigner
Auto-succeed on exhaustion saves from ordinary heat/cold; Survival expertise.

### L20 — Battle on Enemy Ground
Once/Long Rest for 1 minute in hostile territory: you and allies within 60 ft gain +10 ft speed, +2 AC, advantage vs frightened, and advantage on first weapon attack each turn.

---

## 4 — Napoleon

### L1 — Scientific Corps
Add half PB to untrained Intelligence checks; gain Investigation or History proficiency.

### L5 — Imperial Presence
CHA +1 (max 20); Persuasion proficiency or expertise.

### L10 — Against the Odds
Once/Long Rest when outnumbered at combat start: allies within 30 ft gain temp HP = Emperor level for 1 minute and add half PB to saves during round 1.

### L15 — Chosen Rival
After 1 hour studying a target, advantage on Investigation/History/Survival about it and +1d8 damage once per turn against it or its agents.

### L20 — Grand Battery
Once/Long Rest choose point within 1 mile; 60-ft radius DEX save; 10d8 fire + 10d8 bludgeoning, half on success, double damage to objects/structures.

---

## 5 — Alexander the Great

### L1 — Hammer and Anvil
Once per turn, +PB to an attack roll against a creature also threatened by an ally, unless two or more enemies are adjacent to you.

### L5 — Bucephalus
Once/Long Rest summon spectral warhorse for 10 minutes: AC 14, HP `5 × Emperor level`, Speed 120.

### L10 — War Elephant
Once/Long Rest summon spectral war elephant for 10 minutes: AC 15, HP 60, Speed 40. Three weapon positions; up to three creatures operate bows (150/600, 1d8 piercing, operator's attack modifier). Acts immediately after you; your Bonus Action commands any action other than Dodge.

### L15 — Royal Panoply
Spend 10 gp and 1 hour: AC becomes 17 (+shield if applicable); gain 50-point ward absorbing damage before HP. Refill on Long Rest; 10 pp on Short Rest restores 10 ward points.

### L20 — Conqueror's Tempo
Once/Long Rest for 1 minute: +20 ft speed, weapon ranges double, one additional weapon attack whenever you take the Attack action.

---

## 6 — Odysseus

### L1 — Cunning
Insight and Investigation proficiency; expertise in one.

### L5 — Wooden Horse
Once/Long Rest create a Large hidden structure for 8 hours holding up to eight Medium creatures. Others detect it only with Investigation/Insight vs Spirit Save DC.

### L10 — Silver Tongue
Animal Handling and Deception proficiency; expertise in one; reroll one failed check with either once/Long Rest.

### L15 — I Will Return Home
Always know direction, distance, and plane of one chosen home; cannot become lost heading there nonmagically; advantage against magic that blocks return.

### L20 — Heroes of the Odyssey
Once/Long Rest summon one hero for 1 minute:

**Achilles:** AC 20, HP 80, two attacks 2d10+6 slashing; vanishes if hit by a critical poison hit.

**Prometheus:** 20-ft radius 10d6 fire DEX-half on arrival, then ranged 3d10 fire attacks.

**Heracles:** STR 26, advantage on STR checks/saves, two attacks 2d12+8 bludgeoning, counts as Huge for lifting/pushing/breaking, attempts any ordered physical labor.

---

## 7 — Julius Caesar

### L1 — Pilum Doctrine
Javelin range 60/240; drawing a thrown weapon as part of the attack needs no separate object interaction.

### L5 — Twenty-Three Wounds
Once/Long Rest, a hit that would reduce you to 0 HP instead leaves you at 1 HP.

### L10 — Forced March
Allies starting their turn within 30 ft gain +10 ft speed until next turn; group travels one additional hour before forced-march checks.

### L15 — Codifier
History expertise and expertise in Investigation or Persuasion; 10 minutes studying a legal/government structure reveals hierarchy, enforcement, and major procedures.

### L20 — Dictator Perpetuo
Campaign-scale project to centralize a republic. Advantage on coalition-building, military loyalty, institutional reform, and public persuasion checks; doubled proficiency where applicable.

---

## 8 — Saladin

### L1 — Chivalric Defender
Religion and Insight proficiency. Reaction, PB/Long Rest: add PB to adjacent ally's AC against one attack.

### L5 — Cavalry Commander
You and mounted allies within 30 ft gain +15 ft mounted speed.

### L10 — Decisive Charge
Once per turn, after moving 20+ ft toward a target before a melee hit, deal +3d8 damage.

### L15 — Siege Master
Double damage to objects/structures; you and allies within 30 ft have advantage against traps, collapsing fortifications, and siege weapons.

### L20 — Wisdom of the Sultan
Wisdom becomes 24 if lower while Saladin is active; gain Wisdom save proficiency if lacking it.

---

## 9 — Montezuma

### L1 — Trail Reader
Survival proficiency or expertise if already proficient; advantage following physical tracks.

### L5 — Jungle March
Ignore nonmagical difficult terrain; party does not lose overland speed due solely to ordinary vegetation.

### L10 — Eagle and Jaguar Host
Once/Long Rest summon a warband for 1 minute: AC 14, HP 70, Speed 35, 20-ft square, attack uses Spirit Attack modifier, 4d8 piercing; represents ~100 warriors as one creature.

### L15 — Tribute
Every 7 days receive 10% of legitimate expenditures since last tribute, max `25 × Emperor level gp`; transfers within party do not count.

### L20 — Avatar of Tenochtitlan
Once/Long Rest for 1 minute, scores rise to at least STR 22 / DEX 24 / CON 22 / CHA 24; INT unaffected if already below 8; revert afterward.

---

## 10 — David IV the Builder

### L1 — Royal Authority
Persuasion and History proficiency; expertise in one.

### L5 — Didgori
Once/Long Rest, if outnumbered when initiative is rolled: gain temp HP = Emperor level; during round 1, you and allies within 30 ft gain +2 to attacks and saves.

### L10 — Spear Wall
Once/Long Rest create 30×5-ft spectral spear line for 2 rounds. STR save: 5d8 piercing and speed 0 for the turn on failure; half damage on success with no speed reduction.

### L15 — Kartvelebi and Khevsurebi
Once/Long Rest for 1 minute summon two units under one command acting after you.

**Kartvelebi:** AC 16, HP 80, Speed 30, attack 4d10 slashing, once/summon +3d8 radiant on a hit.

**Khevsurebi:** AC 15, HP 60, Speed 35, bow 300 ft 3d8 piercing, sword 2d8 slashing, Reaction +2 AC against one attack.

### L20 — The Four Builders
Once per in-game year, at a controlled site, construct a permanent fortified tower/keep over 12 months. If the site is seized, work pauses; recovering it adds 6 months.

---

## 11 — Sun Tzu

### L1 — Know the Ground
Gain Investigation or Insight proficiency; expertise if already proficient in the chosen skill. After 1 minute observing an area, ask the DM one: most defensible position, safest retreat route, most exploitable visible terrain feature, or best ambush position.

### L5 — Withdraw Before They Know You Were There
When you Hide or Disengage, choose one willing ally within 30 ft who can see/hear you. It may immediately move up to half speed without provoking opportunity attacks. PB uses/Long Rest.

### L10 — Know the Enemy
After observing a creature for 1 minute, learn two chosen facts: highest ability score, lowest ability score, one resistance, one immunity, one vulnerability, one save proficiency, or whether it is healthy/wounded/badly wounded relative to max HP. Once per creature per Long Rest.

### L15 — Shape the Battlefield
Once/Long Rest, action, point within 120 ft; for 1 minute a 30-ft-radius prepared battlefield. You and chosen allies ignore nonmagical difficult terrain, gain +10 ft movement, and cannot be surprised there. Enemies treat it as difficult terrain.

### L20 — Supreme Strategy

**Tactical Plan:** Once/Long Rest after observing enemy/battlefield for 1 minute, for 1 minute you and allies within 60 ft cannot be surprised, have advantage on initiative, and gain advantage on the first attack roll each makes during the effect. Ends for a creature more than 60 ft away.

**Strategic Analysis:** Once per 30 in-game days, after 24 hours studying a known organized enemy, fortification, campaign, or political/military position, the DM reveals one meaningful exploitable weakness in logistics, defenses, leadership, terrain, supply, morale, or strategy, limited to information reasonably knowable.

---

## 12 — Joan of Arc

### L1 — Voices of Conviction
Religion and Persuasion proficiency; if already proficient, expertise in one. Reaction when you or ally within 30 ft fails a save against frightened: reroll. PB uses/Long Rest.

### L5 — Raise the Standard
Once/Long Rest, Bonus Action, spectral standard for 1 minute. On appearance, you and chosen allies within 30 ft gain temp HP = CHA modifier. While within 30 ft, affected creatures gain +1 AC and advantage on saves against frightened.

### L10 — Rally the Fallen
Once/Long Rest, Reaction when a creature within 60 ft would hit 0 HP: it instead drops to 1 HP and may move up to half speed without provoking opportunity attacks.

### L15 — Courage Is Contagious
When you take damage from a hostile creature, choose one ally within 30 ft. It gains temp HP = CHA modifier + PB. A creature can receive this from the feature only once per round.

### L20 — Banner of Orléans
Once/Long Rest, action, legendary standard for 1 minute. Chosen allies within 60 ft are immune to frightened, gain +2 AC and +10 ft speed, and have advantage on death saves. On appearance, each may move up to half speed without provoking opportunity attacks. At start of an affected ally's turn, if below half HP, it gains temp HP = CHA modifier.

---

# Spirit Pact Magic

- Charisma spellcasting
- Save DC = `8 + PB + CHA`
- Spell attack = `PB + CHA`
- Warlock-style Pact Magic: few same-level slots, Short/Long Rest recovery
- 6th–9th-level magic via Legacy Arcanum, once/Long Rest each
- Eldritch Blast known automatically at level 1
- plus two chosen cantrips

Public/demo builds should only include spells permitted by the active public-content rules.

---

# Spirit-Granted Spells

Each spirit grants two bonus spells at L1, two at L5, two at L10, one at L15, and one at L20. They do not count against normal spells known. In the intended monthly system they are known only while that spirit is active.

| Bound Spirit | L1 | L5 | L10 | L15 | L20 |
|---|---|---|---|---|---|
| Genghis Khan | Longstrider, Hunter's Mark | Phantom Steed, Haste | Swift Quiver, Commune with Nature | Wind Walk | Foresight |
| Stalin | Command, Cause Fear | Fear, Animate Dead | Geas, Modify Memory | Finger of Death | Power Word Kill |
| Hannibal | Longstrider, Fog Cloud | Pass without Trace, Nondetection | Freedom of Movement, Mislead | Reverse Gravity | Foresight |
| Napoleon | Command, Heroism | Sending, Haste | Scrying, Wall of Force | Forcecage | Meteor Swarm |
| Alexander the Great | Heroism, Longstrider | Haste, Phantom Steed | Dominate Person, Steel Wind Strike* | Conjure Celestial or similar | Shapechange |
| Odysseus | Disguise Self, Silent Image | Suggestion, Major Image | Modify Memory, Mislead | Project Image | Foresight |
| Julius Caesar | Command, Heroism | Sending, Tongues | Geas, Legend Lore | Teleport | Foresight |
| Saladin | Protection from Evil and Good, Heroism | Beacon of Hope, Aura of Vitality | Greater Restoration, Circle of Power | Holy Aura | Mass Heal |
| Montezuma | Entangle, Hunter's Mark | Plant Growth, Conjure Animals | Commune with Nature, Insect Plague | Animal Shapes | Shapechange |
| David IV the Builder | Shield of Faith, Heroism | Crusader's Mantle, Spirit Guardians | Wall of Stone, Greater Restoration | Temple of the Gods* | Invulnerability* |
| Sun Tzu | Fog Cloud, Silent Image | Pass without Trace, Clairvoyance | Mislead, Scrying | Project Image | Foresight |
| Joan of Arc | Heroism, Bless | Beacon of Hope, Crusader's Mantle | Circle of Power, Greater Restoration | Holy Aura | Mass Heal |

`*` Verify source/public-content availability before using these in an SRD-only demo build.

---

# Grimoire Implementation Notes

## Current Temporary Representation

- Bound Spirits are stored internally using subclass machinery.
- Bound Spirit is chosen at level 1.
- All user-facing text must say **Bound Spirit**, not Subclass.

## Intended Future Mode Representation

When Grimoire supports the necessary generalized mode/transformation system, restore:

- one active spirit at a time
- monthly replacement
- level-gated spirit features
- level-gated spirit spells
- Council of Spirits reroll
- Two Voices choice
- Crown of Legends free spirit selection

## Keep Manual Where Appropriate

Do not fake automation for:

- campaign-scale projects
- monthly calendar tracking
- political/history inference
- terrain judgment
- forced-movement paths
- linked summon armies if the engine lacks authoritative linked-creature support
