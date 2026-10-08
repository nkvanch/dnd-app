# Grimoire Creator Stress-Test Pack

**Pack Type:** Homebrew / Playtest / Creator Demo  
**Recommended Visibility:** Shareable only after public-content validation  
**Purpose:** Demonstrate Grimoire's homebrew authoring, dependency closure, import/export, conflict handling, character integration, DM tools, and mid-campaign modification workflows.

---

## Package Name

**Grimoire Creator Stress-Test Pack**

### Short Description

A compact homebrew pack built to stress-test Grimoire with mechanically unusual but playable content: a species with class-Hit-Die modification, a custom class with Bound Spirits and Edicts, a feat, spell, item, monster, custom condition, and an upgradeable mid-campaign reward.

### Long Description

The Grimoire Creator Stress-Test Pack is a deliberately varied collection of original homebrew designed to exercise the parts of Grimoire that simple content rarely touches.

The pack includes:

- a species with unusual size, movement, Hit Die, and forced-movement rules;
- a full custom class with level progression, resources, spellcasting, Edicts, and twelve Bound Spirits;
- a hybrid defensive/leadership feat;
- a multi-target concentration spell with per-target mode selection;
- a charged magic item with a planted state and Dawn recharge;
- a non-carbon extremophile monster with pressure states and environmental behavior;
- a custom condition/effect;
- a three-tier mid-campaign reward that upgrades without rebuilding a character.

The pack is intended for creator demonstrations, stress tests, import/export testing, and controlled playtests.

---

# Included Content

## 1. Ballast

**Type:** Species  
**Status:** Playtest  
**Hard Dependencies:** None

Key mechanics:

- Medium or Large choice
- +2/+1 flexible ability scores
- 15 ft. speed
- class Hit Die increases by one die size
- d12 classes instead gain +3 maximum HP per class level
- forced-movement resistance
- Reaction-based `No.` defense
- negative buoyancy

---

## 2. Emperor Warlock

**Type:** Class  
**Status:** Playtest  
**Hard Dependencies:** Bound Spirit definitions, Imperial Edict definitions  
**External References:** Publicly permitted spell records only

Key mechanics:

- d8 Hit Die
- Charisma-based Spirit Save DC and Spirit Attack modifier
- Command Dice
- Pact-style spellcasting
- Extra Attack
- Imperial Edicts
- twelve Bound Spirits
- level-gated spirit features
- Legacy Arcanum
- intended monthly Legacy Binding system represented temporarily through subclass machinery

### Bound Spirit Dependency Set

The Emperor Warlock depends on the following Bound Spirit entries:

1. Genghis Khan
2. Stalin
3. Hannibal
4. Napoleon
5. Alexander the Great
6. Odysseus
7. Julius Caesar
8. Saladin
9. Montezuma
10. David IV the Builder
11. Sun Tzu
12. Joan of Arc

Internally these may use subclass records, but all user-facing text should use **Bound Spirit**.

### Imperial Edict Dependency Set

The Emperor Warlock depends on the following Edict definitions:

1. Scholar of Empires
2. Voice of Authority
3. Battlefield Observer
4. Iron Discipline
5. Mounted Commander
6. Tactical Withdrawal
7. Rally
8. Unbroken Line
9. Forced March
10. Commander of Many
11. Historian
12. Unshaken
13. Imperial Blast
14. Commanding Repulsion
15. Suppressing Fire
16. Long-Range Artillery
17. Mark of the Emperor

### Spell Reference Rule

Official spells are **referenced**, not duplicated into the homebrew pack.

If a referenced spell is unavailable in the active public ruleset, the importer should:

- flag the missing reference;
- show which Bound Spirit or class feature uses it;
- allow the pack to import with that dependency unresolved only if Grimoire supports safe partial import;
- otherwise require replacement or removal before public export.

The pack must not silently embed non-public official spell text.

---

## 3. Anchor of Command

**Type:** Feat  
**Status:** Playtest  
**Hard Dependencies:** None

Key mechanics:

- +1 Constitution or Charisma
- advantage against forced movement
- adjacent ally AC support
- `Hold Fast` 1/Long Rest
- temporary speed 0
- forced-movement immunity while planted
- temporary HP for allies
- temporary AC aura

---

## 4. Command the Field

**Type:** Spell  
**Level:** 3rd  
**School:** Enchantment  
**Status:** Playtest  
**Hard Dependencies:** None

Key mechanics:

- concentration
- three willing targets
- per-target mode choice
- mode re-selection every turn
- upcast target scaling

Modes:

- Advance
- Brace
- Press
- Withdraw

The `Brace` mode is intentionally distinct from the separate **Braced** custom effect and does not hard-depend on it.

---

## 5. Standard of the Unyielding Line

**Type:** Wondrous Item  
**Rarity:** Rare  
**Attunement:** Required  
**Status:** Playtest  
**Hard Dependencies:** None

Key mechanics:

- passive fear defense
- ally saving-throw aura
- carried/planted state
- planted AC aura
- forced-movement defense
- 3 charges
- `1d3` recharge at dawn
- Reaction-based 0-HP prevention

---

## 6. Glassback

**Type:** Monster  
**CR:** 7  
**Size:** Large  
**Creature Type:** Aberration  
**Status:** Playtest  
**Hard Dependencies:** None

Key mechanics:

- non-carbon extremophile ecology
- high-pressure cave adaptation
- Pressure resource from 0–3
- Ceramic Shell fracture mechanic
- Compress action
- mineral-targeting behavior
- burrowing
- Abrasive Jet
- Pressure Collapse on death

---

## 7. Braced

**Type:** Custom Condition / Effect  
**Status:** Playtest  
**Hard Dependencies:** None

While Braced:

- speed -10 ft.
- AC +1
- advantage against forced movement
- advantage against being knocked prone
- Dash disabled

The included `Take a Brace` Bonus Action is a demo/test source for the effect rather than part of the universal condition definition.

---

## 8. Weight of Authority

**Type:** Mid-Campaign Reward Feature  
**Status:** Playtest  
**Hard Dependencies:** None

Three upgrade tiers:

- Tier I — Recognized Presence
- Tier II — Proven Commander
- Tier III — Weight of Command

The tiers are authoritative replacements, not cumulative duplicate modifiers.

Key mechanics:

- permanent maximum-HP increase
- permanent initiative increase
- limited-use ally rerolls
- increasing range and uses
- initiative-triggered temporary HP
- Tier III `Stand With Me` Reaction

---

# Dependency Model

## Hard Dependencies

Hard dependencies must be included automatically when exporting or importing an entry that requires them.

For this pack, the main hard-dependency graph is:

`Emperor Warlock`
→ `12 Bound Spirit definitions`
→ `their custom feature definitions`

and:

`Emperor Warlock`
→ `17 Imperial Edict definitions`

Official spell records should be referenced by canonical content identity rather than copied into the homebrew pack.

## Soft / Thematic Relationships

These should be displayed as related content but should **not** force inclusion:

- Ballast ↔ Anchor of Command
- Emperor Warlock ↔ Anchor of Command
- Emperor Warlock ↔ Command the Field
- Emperor Warlock ↔ Standard of the Unyielding Line
- Ballast ↔ Braced
- Weight of Authority ↔ Emperor Warlock
- Weight of Authority ↔ Anchor of Command

Glassback is intentionally mechanically and thematically independent so the pack demonstrates that one package can contain varied content rather than a single tightly coupled rules family.

---

# Export Behavior

When exporting the pack:

1. Start from the entries the author explicitly selects.
2. Resolve hard dependencies recursively.
3. Show a dependency preview before export.
4. Distinguish:
   - explicitly selected entries;
   - automatically included dependencies;
   - external canonical references.
5. Never silently copy official content into the pack.
6. Produce deterministic package metadata and stable semantic IDs where possible.
7. Include provenance/version metadata for every homebrew record.

### Recommended Export Preview

Example:

> **Selected:** Emperor Warlock  
> **Automatically included:** 12 Bound Spirits, 17 Imperial Edicts  
> **External references:** permitted canonical spells  
> **Total homebrew records:** shown before export

The author should be able to expand the dependency tree before confirming.

---

# Import Behavior

Before importing, show:

- pack name
- version
- author
- content count by type
- dependency count
- unresolved external references
- conflicts
- records that will be added
- records that will be replaced
- records that will be imported as copies

Hard dependencies should be selected automatically and should not be silently omitted.

The importer should allow individual top-level entries to be deselected only when doing so does not leave another selected entry with a broken hard dependency.

---

# Conflict Handling

## Same Semantic ID, Same Content

If the incoming entry has the same semantic ID and same content/version:

**Default:** Skip duplicate.

Do not create a second copy.

---

## Same Semantic ID, Different Content

Show an explicit conflict.

Offer:

### Replace Existing

Replace the existing homebrew record with the imported version while preserving appropriate provenance/history.

### Import as Copy

Create a new homebrew identity and preserve both versions.

The copy must receive a new stable ID.

### Cancel / Skip

Leave the existing record unchanged and do not import the conflicting entry.

Never silently overwrite.

---

## Same Name, Different Semantic Identity

Allow both entries.

Show a warning such as:

> Another homebrew entry named `Anchor of Command` already exists, but it is a different content identity.

Do not treat a name collision alone as proof that two records are the same object.

---

## Official Content Conflict

Homebrew must never silently replace canonical official content.

If a homebrew entry intentionally overrides official behavior, that should be represented through explicit homebrew precedence / override metadata rather than destructive replacement of the official record.

---

# Versioning

Recommended package version:

**0.1.0-playtest**

Suggested progression:

- `0.1.x` — creator-demo / mechanical stress testing
- `0.2.x` — external creator feedback
- `0.5.x` — wider playtest
- `1.0.0` — stable homebrew release, if ever desired

Each entry should preserve:

- stable semantic ID
- content version
- created/modified timestamps where appropriate
- pack provenance
- source pack version
- original author attribution

---

# Tags

Recommended pack-level tags:

- `Homebrew`
- `Playtest`
- `Creator Demo`
- `Stress Test`
- `Offline`
- `Shareable`
- `Mixed Content`

Recommended content tags where useful:

### Ballast
- Species
- Large Option
- Durability
- Forced Movement

### Emperor Warlock
- Class
- Pact Magic
- Commander
- Historical Spirits
- Resource Management

### Anchor of Command
- Feat
- Defense
- Leadership

### Command the Field
- Spell
- Concentration
- Multi-Target
- Tactical

### Standard of the Unyielding Line
- Item
- Attunement
- Charges
- Aura

### Glassback
- Monster
- CR 7
- Extremophile
- Pressure
- Burrower

### Braced
- Condition
- Defense
- Movement

### Weight of Authority
- Reward
- Upgradeable
- Mid-Campaign
- Leadership

---

# Public / Creator Demo Safety

Before sharing the pack publicly:

1. Validate every official spell reference against the active public-content rules.
2. Do not bundle private/non-public official descriptions.
3. Keep original homebrew mechanics and prose as pack-owned content.
4. Mark unresolved or unsupported mechanics honestly as reminder/manual behavior.
5. Do not claim automation for mechanics Grimoire cannot currently represent.
6. Preserve the distinction between the Emperor Warlock's intended monthly Legacy Binding design and the temporary Bound-Spirit-as-subclass implementation.

---

# Recommended Demo Import Story

For the creator demo:

1. Export the full pack from the authoring environment.
2. Import it into a clean Grimoire profile.
3. Show the import preview by content type.
4. Expand the Emperor Warlock dependency tree.
5. Confirm that Bound Spirits and Edicts are automatically included.
6. Import.
7. Show Ballast, Emperor Warlock, Anchor of Command, Command the Field, Standard of the Unyielding Line, Glassback, Braced, and Weight of Authority in their normal Compendium locations.
8. Re-import the same pack and show duplicate-safe behavior.
9. Modify one homebrew entry locally.
10. Import a changed pack version and show:
    - Replace Existing
    - Import as Copy
    - Skip
11. Choose `Import as Copy` once to demonstrate that the original remains intact.
12. Show provenance/version information for the imported copy.

This demonstrates that homebrew behaves like first-class Grimoire content rather than a loose collection of JSON files.
