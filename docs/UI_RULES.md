# Grimoire — UI Rules

Binding rules for all player-facing UI. These are not style preferences.
Violating them creates a worse product.

---

## Rule 1: Engine vocabulary is forbidden in player-facing text.

The engine has a type system. The player has a game. They are different languages.
Engine vocabulary must never appear in any text the player reads during normal use.

### Forbidden words in player-facing UI:
- Effect / Effects
- Feature (as a category label — "FEATURES" as a tab name is acceptable,
  "FeatureInstance" or "active effects on this feature" is not)
- Grant / Granted
- Resource Type / Resource Pool
- Modifier Pipeline
- Derived Value / Derived Stats
- Effect Resolution
- Base Formula
- Stat Modifier

### Allowed equivalents:
| Engine term | Player-facing equivalent |
|---|---|
| Feature | The feature's actual name (Rage, Darkvision, Sneak Attack) |
| Effect: stat_modifier | "+2 to Strength" or "Strength +2" |
| Effect: base_ac_formula | "Unarmored Defense" or "Chain Mail AC" |
| Resource | The resource's actual name (Rage, Ki Points, Spell Slots) |
| Grant | "You gain..." or just show the thing granted |
| Derived value | The value itself with an audit trail on tap |
| resolveChoice | "Choose your skills" / "Choose a feat or ability increase" |
| grantedAt | Not shown to players at all |

### Enforcement:
Grep the `app/` and `src/components/` directories periodically for the forbidden
words appearing inside JSX `<Text>` elements or string literals passed to UI props.
The homebrew builders and the DM debug screen are the only justified exceptions —
content authors are allowed to see the machinery.

---

## Rule 2: Every interactive number must have an audit trail.

If a player can tap on a number, they must get a meaningful explanation.
"No breakdown available" is not an acceptable state for any value the player
regularly looks at.

### Numbers that must have complete audit trails:
- All six ability scores (effective, not base)
- All six saving throws
- All 18 skills
- AC, Speed, Initiative, Passive Perception
- Passive Investigation, Passive Insight
- Spell Save DC, Spell Attack Bonus
- HP maximum
- Proficiency Bonus

### Minimum audit entry format:
```
Perception
  +2  DEX modifier
  +3  Proficiency (trained)
  +1  Observant feat
 ──
  +6  Total
```

Every entry must show: what it is, where it came from, and what number it contributed.
DM overrides are shown last, labeled "DM Override", and marked with ✱.

---

## Rule 3: Conditions show their mechanical consequences.

When a condition is active, the UI shows both the condition name and what it
means right now for this character. Not a link to a rules lookup. Not a tooltip.
Printed directly in the conditions section.

Standard text per condition:
- **Blinded:** Attacks against you have advantage; you have disadvantage on attacks
- **Charmed:** Can't attack the charmer; charmer has advantage on social checks vs you
- **Deafened:** Can't hear; auto-fail hearing-based checks
- **Frightened:** Disadvantage on checks and attacks while source is visible
- **Grappled:** Speed 0
- **Incapacitated:** Can't take actions or reactions
- **Invisible:** Attacks against you have disadvantage; your attacks have advantage
- **Paralyzed:** Speed 0; auto-fail STR/DEX saves; attacks against you have advantage, and are critical hits on a hit
- **Petrified:** Incapacitated; resistance to all damage; attacks against you have advantage
- **Poisoned:** Disadvantage on attacks and ability checks
- **Prone:** Disadvantage on attacks; melee attacks against you have advantage
- **Restrained:** Speed 0; disadvantage on attacks; attacks against you have advantage
- **Stunned:** Speed 0; auto-fail STR/DEX saves; attacks against you have advantage
- **Unconscious:** Incapacitated, prone; auto-fail STR/DEX saves; attacks have advantage and are critical hits

Exhaustion levels:
- **Level 1:** Disadvantage on ability checks
- **Level 2:** Speed halved
- **Level 3:** Disadvantage on attacks and saving throws
- **Level 4:** Hit point maximum halved
- **Level 5:** Speed reduced to 0
- **Level 6:** Death

---

## Rule 4: Actions speak in game language.

Button labels, action card titles, and confirmations use game language, not
app language.

| Avoid | Use instead |
|---|---|
| "Resolve choice" | "Choose your skills" / "Choose a feat or +2" |
| "Apply ASI" | "Increase Ability Scores" |
| "Consume resource" | "Use Rage" / "Spend 1 Ki Point" |
| "Entity updated" | (silent, or "Saved") |
| "Recompute derived" | (never shown to players) |
| "Select feature" | "Learn Spell" / "Choose Fighting Style" |
| "Grant proficiency" | "You gain proficiency in..." |

---

## Rule 5: The character header must always show HP and AC.

Players look at HP and AC more than any other values.
Both must be visible in the persistent header without switching tabs.

Minimum required header content (always visible):
```
[Name]
[Level] [Class]
[HP current]/[HP max]    AC [value]    Speed [value]
```

Race is secondary information. Class and level are primary.
The header should never show only flavor information (race, background) while
hiding mechanical information (AC, speed).

---

## Rule 6: The spellbook is a first-class surface, not a list.

Spellcasters think "I open my spellbook," not "I open my action card list."
The spell management surface must reflect this mental model.

A spellbook surface must support:
- Browse by level (Cantrips · 1st · 2nd · ...)
- Visual distinction: prepared vs known vs unprepared
- Concentration and ritual tags visible at a glance
- Cast directly from this surface (same code path as the action card Use button)
- Manage prepared spells (for prepared casters: Cleric, Druid, Paladin, Wizard)
- The Spells tab must only render for characters with a spellcasting class
  (Barbarian should not see an empty Spells tab)

---

## Rule 7: The home screen reflects session state.

Home adapts based on whether a campaign session is active:

**No active campaign:**
```
Continue Character    [most recent]
Quick Actions         Create / Join / Roll Dice
```

**Campaign active, between sessions:**
```
[Campaign Name]
Last session summary
Active quests (short list)
Campaign notes (most recent)
Party members (HP bars)
Quick Roll
```

**Campaign active, session live:**
```
[Campaign Name]  ●  [N/N players online]
Current Encounter: [name]
Party Status      [live HP bars]
Quick Roll / Open Character / Open Encounter
```

A home screen that shows "Players Online: 0/5, No encounter" is worse than
showing the between-sessions view. State detection should distinguish "session
is actively happening" from "campaign exists but table isn't playing right now."

---

## Rule 8: Homebrew content is displayed identically to official content.

A custom race from the Race Builder must:
- Appear in the creation race picker alongside PHB races
- Show an audit trail entry for its bonuses exactly as PHB races do
- Display on the Features tab with the same visual treatment as official features
- Be selectable during character creation without any "this is homebrew" friction

The only distinction is provenance (the pack/author label shown in the audit trail
for people who want to know the source). The play experience is identical.
