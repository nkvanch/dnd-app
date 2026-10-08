# Effect authoring parity: engine vs homebrew editor

Purpose: a homebrew creator should not be blocked from a mechanic the engine genuinely supports without a good
reason. This table is the source of truth for that decision. It was produced by reading `Effect` in
`src/engine/types.ts`, the consumers in `src/engine/pipeline.ts` / `conditions.ts` / `rest.ts`, and the shared trait
editor (`src/components/homebrew/TraitEditor.tsx`, compiled by `src/content/traitCompiler.ts`).

"Author UI" means the shared trait editor, which the Custom Feature dialog and the race, subrace, class,
subclass, feat, item and condition builders all use.

| Engine capability | Author UI | Runtime | Tests |
|---|---|---|---|
| Ability score bonus (`stat_modifier` add on str..cha) | Yes: Ability score bonus | Yes | `pipeline.test.ts` |
| Ability score set / scale | No. Only magic items set a score (Belt of Giant Strength); not a trait mechanic | Yes | `scaleOperation.test.ts` |
| AC bonus (`stat_modifier` add on ac) | Yes: AC bonus | Yes | `pipeline.test.ts` |
| Base AC formula (`base_ac_formula`) | Yes: Unarmored Defense | Yes | `pipeline.test.ts` |
| AC scale (`scale` on ac) | No. Pack-authored only; no built-in content does it | Yes | `scaleOperation.test.ts` |
| **Walking speed add / set / scale** | **Yes (new): Speed, initiative, saves & more** | Yes | `traitAuthoringParity.test.ts` |
| **Initiative add / scale** | **Yes (new)** | Yes | `traitAuthoringParity.test.ts` |
| **Extra attacks** (`extra_attack`) | **Yes (new)** | Yes | `traitAuthoringParity.test.ts` |
| **Spell save DC / spell attack bonus** | **Yes (new)** | Yes | `traitAuthoringParity.test.ts` |
| **Passive Perception / Investigation / Insight** | **Yes (new)** | Yes | `traitAuthoringParity.test.ts` |
| **Saving throw bonus** (`savingThrows.<ability>`, one or all six) | **Yes (new)** | Yes | `traitAuthoringParity.test.ts` |
| Skill proficiency / expertise (`grant_proficiency` `skill:`) | Yes | Yes | `pipeline.test.ts` |
| Tool proficiency (`tool:`) | Yes | Yes | `pipeline.test.ts` |
| **Weapon proficiency** (`weapon:`) | **Yes (new)** | Yes | `traitAuthoringParity.test.ts` |
| **Armor proficiency** (`armor:`) | **Yes (new)** | Yes | `traitAuthoringParity.test.ts` |
| Language proficiency | No. No effect-level runtime path: languages come from race/background data and language choices, not from `grant_proficiency` | Via choices only | n/a |
| Saving-throw proficiency | No. No effect-level runtime path: it is set from the class (`CharClass.savingThrows`) only | Class only | n/a |
| Damage resistance / immunity / vulnerability | Yes | Yes | `pipeline.test.ts` |
| **Condition immunity** (`condition_immunity`) | **Yes (new)** | Yes (`conditions.ts` refuses the condition) | `traitAuthoringParity.test.ts` |
| Suppress a condition's speed-zeroing (`suppress_condition_effects`) | Yes: Movement conditions | Yes | `conditions.test.ts` |
| Senses (`grant_sense`) | Yes | Yes | `pipeline.test.ts` |
| Fly / swim / climb / burrow (`grant_movement`) | Yes | Yes | `pipeline.test.ts` |
| Advantage / disadvantage (reminder text) | Yes | Yes (shown, never auto-rolled) | `resolver.test.ts` |
| Spell grants (`grant_spell`) | Yes | Yes | `traitCompiler` tests |
| Resource pool (`grant_resource`) with short rest / long rest | Yes: Limited-use ability | Yes | `rest.test.ts` |
| **Resource that recharges at dawn** | **Yes (new): Dawn chip, sheet "Dawn" button** | Yes (`takeDawn`) | `dawnRecharge.test.ts` |
| Resource with any other trigger | Yes: "Other (manual)" | Restored by hand with + (no event the app can detect) | `dawnRecharge.test.ts` |
| **Save DC on an ability: fixed number** | **Yes (new)** | Yes | `traitAuthoringParity.test.ts` |
| **Save DC: 8 + proficiency + an ability modifier (scales)** | **Yes (new)** | Yes (`abilityBasedDC`) | `traitAuthoringParity.test.ts` |
| **Save DC: the character's spell save DC** | **Yes (new)** | Yes | `traitAuthoringParity.test.ts` |
| Save DC as a custom formula | No, on purpose (no expression language) | No | n/a |
| `apply_condition`, `override_rule` as passive effects | No. The types are declared but nothing in the pipeline handles them as passive effects; conditions are applied by abilities (`abilityEffects`) instead | No | n/a |

## Operation semantics worth knowing

- `add`: adds to the stat. `set`: replaces the stat (highest wins, bonuses still add on top).
- `scale` (new): multiplies the fully resolved stat, after every set and add, rounded down. This is what "double your
  speed" means. Supported on ability scores, speed, initiative and AC; inert on anything else.
- `multiply` (older): multiplies the accumulated bonus pool of a target, not the stat itself, so "x2 speed" written
  as `multiply` leaves a 30 ft speed at 30. It is kept exactly as it was because an audit test documents it and
  expertise markers reuse the operation. The trait editor only offers `scale`.

## Deliberately not changed

No caps or warnings were added to Free Edit, manual spell adding, or custom features (the app's "the character is not
limited by the app" principle). Backgrounds stay text-only, spells and monsters get no mechanics editor, and there is
no target model for abilities that apply a condition to another creature. Those are product decisions, not bugs.
