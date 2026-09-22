# Third-party reference content — feasibility findings

Status: **ANALYSIS ONLY. Nothing built.** All findings below came from checking public mechanical summaries of other creators' published homebrew against Grimoire's actual engine code, never from building or importing their content. See [MODE_TRANSFORMATION_LAYER_PROPOSAL.md](MODE_TRANSFORMATION_LAYER_PROPOSAL.md) and [HOMEBREW_AUTHORING_LIMITS.md](HOMEBREW_AUTHORING_LIMITS.md) for the underlying gap list this draws on and updates.

**Why analysis-only, on purpose.** These are other people's published, sold homebrew (KibblesTasty, LaserLlama). Unlike [homebrew/EMPEROR_WARLOCK.md](homebrew/EMPEROR_WARLOCK.md), which is the user's own original design and kept as a full reference copy, this file describes only mechanical *categories* — never their written feature text, flavor, or exact numbers. That's enough to answer "can the engine represent this shape," which is the actual question, without reproducing anyone's copyrighted homebrew, even privately.

## KibblesTasty — Inventor

INT-based crafting class: firearms, gadgets, mechanical armor, golem-building; a chosen specialization with a repeated upgrade-choice list at levels 3/5/7/9/11/13/15/17/19; its own spell list. ([kthomebrew.com](https://www.kthomebrew.com/), [GM Binder](https://www.gmbinder.com/share/-LAEn6ZdC6lYUKhQ67Qk))

| | |
|---|---|
| **Buildable** | Specialization-as-subclass with its own repeated upgrade pool — proven pattern, matches Fighter's Battle Master maneuver pool. Gadgets/firearms/armor as homebrew items with charges as a shared resource pool (already supported, see corrections in the limits doc). Spellcasting, if the real slot table matches full/half/pact — the homebrew class builder already exposes `spellcastingStyle` end to end, no engine work needed for a standard shape. |
| **Not buildable** | Golem/mechanical-companion crafting as something the Inventor's own sheet controls with an independent turn — no homebrew companion builder exists. |
| **Unconfirmed** | Whether the real spell-slot progression is a standard shape or genuinely custom (would need an engine change, not just authoring, if custom). Not checked, by design — would require pulling their exact table. |

## LaserLlama — Alternate Artificer

A rebalance of the official Artificer: reworked Infusions, a Steel Defender you infuse and customize directly, Wandslinger replacing Artillerist, 12 selectable Specializations. ([Patreon](https://www.patreon.com/laserllama/posts/alternate-class-107190866), [GM Binder — Expanded](https://www.gmbinder.com/share/-M_Vp0-G2_ELZB3ruaoZ))

| | |
|---|---|
| **Buildable** | Reworked Infusions as homebrew items. Wandslinger as an ordinary subclass swap. The 12 Specializations, same proven pattern as Inventor's. Non-infusion Steel Defender upgrades (new features/resource upgrades on the class). Official (non-SRD) Artificer, Infusions and Steel Defender already exist in `dnd-app`, so only the deltas need authoring. |
| **Not buildable** | Infusing the Steel Defender directly. Checked the type: `Infusion.feature` (`src/content/infusions/index.ts:17-27`) is appended only to an item's features — no path to a companion. Clean failure, not partial. Any brand-new custom companion for a new specialization, same reason as Inventor's golems. |

## LaserLlama — Shifter Ranger

Shift as a bonus action into a beast shape learned by touching a living beast; stats replaced by the beast's, INT/WIS/CHA and proficiencies retained; max CR gated by Ranger level. Functions like Wild Shape. ([Patreon](https://www.patreon.com/posts/shifter-class-126939124), [Ranger Archetypes on GM Binder](https://www.gmbinder.com/share/-M0nXd9bmyuo8_Z55gyl))

| | |
|---|---|
| **New finding, corrects an earlier claim in this doc set** | A real, class-agnostic transformation mechanism already exists: the `transform` effect (`src/engine/types.ts:2072`), resolved identically for any class by `startWildShape` (`src/engine/combat.ts:617`) and rendered generically in `actionCards.ts:380` — not hardcoded to Druid. A homebrew feature granting `{ type: 'transform', formId }` works today. |
| **Buildable** | The shift itself, with correct beast-HP tracking and reversion. |
| **Not buildable** | The actual point of the subclass — shifting into *whatever beast you touched*. `ALL_BEAST_FORMS` (`src/content/beastforms/index.ts`) is a fixed 7-entry official list with no homebrew builder and no merge point in `homebrewStore.ts`. The switching mechanism is real; authoring new things to switch into is the same closed-content gap as the companion builder, one level over. In practice this degrades to "Wild Shape, reskinned," not the designed feature. |

## LaserLlama — Wrangler Ranger

Built on the base Alternate Ranger's Quarry system: mark a creature as your Quarry for ongoing bonuses, add your Quarry Die to a charmed creature's saving throw at range via reaction, mark Beasts/Monstrosities as Quarry for free. Charm/enchantment-focused. ([Alternate Ranger: Expanded, GM Binder](https://www.gmbinder.com/share/-MW4c30CbGMWLRNgJxgb))

| | |
|---|---|
| **Not buildable, root cause** | Everything here sits on persistent per-target state — mark a creature, track it, get an ongoing bonus against it. Confirmed absent: `targetId` exists only as a one-shot field on a grant result or a combat-log event (`src/engine/types.ts:157,2381`), never as durable state a sheet keeps referencing another entity. |
| **Design-rule note** | This is the **third unrelated design** hitting this exact gap — Emperor Warlock's own Rival mechanic, Napoleon's Chosen Rival, and now Ranger's Quarry as a *base-class* feature all three Ranger subclasses below build on. By the project's own rule ("three unrelated failures deserve a primitive"), this has crossed from "future, not urgent" to a real candidate — see the update to [HOMEBREW_AUTHORING_LIMITS.md](HOMEBREW_AUTHORING_LIMITS.md). |

## LaserLlama — Bounty Hunter Ranger

Urban/humanoid-hunting Ranger archetype: Exploit Dice fueling Exploits, a "Half-Exploit" progression variant, Investigation and a Knack at 3rd level. ([Alternate Ranger: Expanded, GM Binder](https://www.gmbinder.com/share/-MW4c30CbGMWLRNgJxgb))

| | |
|---|---|
| **Buildable** | Exploit Dice + Exploits — same proven pattern as Battle Master maneuvers (a resource, a repeat-choice pool, some options with real mechanics). "Half-Exploit" progression is very likely just an authored progression-table shape, not a new primitive. |
| **Unconfirmed** | Exact numbers not checked, by design. If any of its own features reference marking a target beyond the base class's Quarry, that inherits the same confirmed gap above. |

## Señor Eg's Race Compendium — Kitsune (rebalance by shamus_aran)

**Could not read the source document.** The Homebrewery share page (`homebrewery.naturalcrit.com/share/ExV5S3wzaZPH`) renders its actual page content in a way neither `WebFetch` nor the browser's text extraction could reach — only the cover/description page ("Skeleton, Mousefolk, Mothra, Raccoonfolk, Botanature, Vulpes, Ratkin, and a rebalanced Kitsune Race") was retrievable, confirmed by paging through and re-checking, not a first attempt giving up. What follows is the well-known kitsune-homebrew archetype shared by nearly every published version of this race, not a reading of this specific document — flagged clearly because that distinction matters more here than for the classes above, where I could at least confirm mechanics from search summaries.

**The archetype:** a Charisma-leaning race, an innate cantrip from level 1, and (in most published kitsune homebrews, mirroring the SRD's own Tiefling/Genasi/Drow pattern) one or two additional spells that unlock at character level 3 and 5. Many versions also grant a cosmetic fox-form shift.

| | |
|---|---|
| **Confirmed absent — strong evidence, no research needed** | Spells that unlock at a later *character* level beyond the initial cantrip. This isn't speculation about Kitsune specifically: it's already disclosed, in the app's own shipped official content, at over a dozen separate race entries — Tiefling bloodlines, Genasi, Drow, Duergar, Eladrin's seasonal Fey Step, and more (`src/content/races/index.ts`, e.g. line 32: *"At 3rd level you can cast … this app doesn't yet support level-gated racial features"*). If the real Kitsune follows the common pattern (cantrip at 1, a spell at 3rd, another at 5th), only the level-1 cantrip would actually work; the rest would be text on the sheet the player has to self-track. |
| **Depends on the actual design, not confirmed either way** | A cosmetic fox-form shift. If it only changes size/speed/stealth without replacing combat stats, that's likely just a flag and a couple of numeric effects — ordinary work. If it needs to fully replace the stat block, it hits the same closed-content problem as Shifter Ranger above (the `transform` mechanism is real and class-agnostic, but `ALL_BEAST_FORMS` is a fixed, non-homebrew-authorable list, and a "fox" may not even be on it). |

## Custom Race System / modular lineage (general pattern, no single source pinned)

Could not find one specific canonical post under this name. Analyzed as the general, widely-published pattern this phrase describes: build a race from a menu of racial traits (an ability-score package, a movement type, a resistance, a proficiency, a minor spell-like ability, etc.), each with its own point cost, spent from a shared trait-point budget — Tasha's Custom Lineage taken further, the way several community writeups (RPGBot, EN World, various itch.io "build your own race" documents) independently describe it. If there's one specific post in mind, a link would let this be checked precisely instead of generically.

| | |
|---|---|
| **Confirmed absent** | A generic *point-budget* choice — spend a shared pool across options of different costs, choose however many that budget allows. Checked `ChoiceDefinition` (`src/engine/types.ts:1064`): `count` is a fixed number of picks, full stop. The only point-budget mechanism anywhere in the engine is `PointBuyConfig`, hardcoded to ability-score generation specifically (`src/engine/pointBuy.ts`), not a general-purpose choice type. A design where a player picks "2 cheap traits or 1 expensive one" from a shared budget can't be expressed as one choice — it would have to be flattened into a fixed menu of pre-costed bundles (which is itself a real, if less elegant, workaround, not a dead end). |
| **Buildable** | Everything about the trait *options themselves* — an ability-score package, a resistance, a proficiency, a movement type, a minor spell-like ability — are all ordinary grants once picked. The gap is specifically the budget-spending mechanic, not the traits it offers. |

## Scope note shared by all seven

Every one of these is written against its creator's own rewritten base class or system (Inventor's own chassis; LaserLlama's Alternate Ranger with Quarry/Knacks, not the SRD Ranger; a modular lineage system that isn't the SRD race-creation flow at all). Testing any of them meaningfully needs that base chassis modeled first — not a new engine gap, the same "not standalone" situation throughout.

## Summary table

| Content | Core new-primitive ask | Status |
|---|---|---|
| Inventor | Controllable homebrew companion (golem) | Confirmed absent |
| Inventor | Specialization + repeat-choice pool | Already supported |
| Alternate Artificer | Infusion targeting a companion, not an item | Confirmed absent |
| Alternate Artificer | Reworked infusions, extra subclass/specializations | Already supported |
| Shifter Ranger | Homebrew-authorable transformation targets (beast forms) | Confirmed absent — mechanism exists, content authoring doesn't |
| Wrangler Ranger | Persistent per-target/marked-creature state | Confirmed absent, now a 3-for-3 case |
| Kitsune (archetype) | Spells unlocking at a later character level, beyond the 1st-level cantrip | Confirmed absent — disclosed in 15+ places in shipped official content already |
| Custom Race System | Point-budget choice (spend a shared pool across variable-cost options) | Confirmed absent — only fixed-count choices and ability-score-specific point buy exist |
| Bounty Hunter Ranger | Repeat-choice resource pool (Exploits) | Already supported |
