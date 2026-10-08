# Level-6 smoke investigation (Creator Alpha final pass)

## Background

The previous creator-readiness pass reported that on a physical device, "Confirm Skills" appeared to leave
the Skill Selection screen unchanged after selecting a level-1 Bard's "choose any 3 skills" for a
level-5 character built on the Tidewalker (Demo) homebrew race (Breadth Test Pack) + College of Lore
(official) + Acolyte (official) background. It was left unresolved whether this was a fixture problem,
a rule/count issue, a state-sync bug, or a real wizard regression.

## Investigation method

The device is not connected during this pass (`adb devices` returns an empty list, checked repeatedly
throughout — see "Device availability" below), so this was diagnosed by reading and directly exercising the
production engine code the screen (`app/creation/skills.tsx`) depends on, rather than by more device taps.

1. Read `skills.tsx` end to end: `canProceed()` (the Confirm button's enable gate), `achievableCount()`
   (the per-choice target under the 'replacement' vs 'warn' overlap house rule — default is `'replacement'`,
   confirmed in `src/engine/houseRules.ts:skillOverlapMode`), and `commit()` (the augmented-pool substitution
   + `resolveChoice()` call that actually resolves the choice and navigates to `/creation/hub`).
2. Read `app/creation/hub.tsx`: there is no forced redirect back to Skills; the "done" check for the
   skills section is exactly "no unresolved `kind: 'skill'` choices remain," matching what `commit()` produces.
3. Read the Bard's real class content (`src/content/classes/index.ts`): the level-1 skill choice is
   `{ id: 'bard_skills_lvl_1', kind: 'skill', count: 3, pool: 'all' }` — confirming the observed "Choose 3
   Skills" / pool of all 18 skills is correct content, not malformed data. At level 3 a Bard also queues a
   `subclass` choice (resolved earlier via the Subclass screen) and an `expertise` choice (`bard_expertise_3`,
   count 2) — both **separate** `ChoiceDefinition.kind`s that `skills.tsx`'s `pendingSkillChoices` filter
   correctly excludes, so they cannot block the Skills screen's own gate.
4. Read the Breadth Test Pack's Tidewalker (Demo) race (`demo/sample-packs/samplePacks.ts`): it grants a
   +1 DEX trait, a cold-resistance trait, and a resourced spell-grant trait — **no skill-related grant at
   all**. It is scoped as a plain `Race`, and its only subclass (`Undertow Vanguard`) requires **Fighter**,
   so the observed device session (Bard + College of Lore) was combining the homebrew *race* with the
   *official* Bard class/subclass — a supported combination, not a malformed one.
5. Wrote `app/creation/__tests__/skillsCommitBard.test.ts`, which builds a level-5 Bard with a
   Tidewalker-shaped homebrew race (built with the same `newDraftTrait`/`buildTraitFeature` calls the real
   pack uses) and the real Acolyte background, using `levelUp()` with the **real** `bardProgression` content
   (not a synthetic stand-in), then reproduces `commit()`'s exact augmented-pool `resolveChoice()` call.

## What the test found

- On the first attempt, the test itself had a bug: it pushed the Acolyte background's `Feature` directly
  onto `entity.features` instead of applying it through `applyGrant()`. `collectAllEffects()`
  (`src/engine/pipeline.ts`) requires `FeatureInstance.isActive === true` before a feature's effects (here,
  the `grant_proficiency skill:insight` / `skill:religion` effects) contribute anything — a raw `Feature`
  object has no such field. `applyGrant({ kind: 'feature', value: f }, ...)` is what stamps `isActive: true`;
  **every real production call site that applies a race or background feature already goes through
  `applyGrant`** (confirmed in `app/creation/race-detail.tsx:324` and `app/creation/background.tsx:452`) —
  this was purely an artifact of my hand-built test fixture skipping that step, not a production code path.
  Fixed the *test* to call `applyGrant()`, exactly matching what `background.tsx`/`race-detail.tsx` do.
- After that fix, all 5 assertions pass: background-trained skills are correctly in place; the real Bard
  choice is queued unresolved with `count: 3, pool: 'all'`; the subclass/expertise choices coexist without
  interfering; resolving the skill choice with the exact `commit()` pattern (augmented pool +
  `resolveChoice()`) succeeds with **no exception**, trains exactly the three chosen skills, leaves the
  choice's own selections correct, and leaves the subclass/expertise choices' resolved-state untouched; and
  the achievable-count gate correctly rejects 2 or 4 selections (only exactly 3 passes), matching the
  Confirm button's `disabled={!ready}` logic.

## ROOT CAUSE

**No engine or `skills.tsx` defect was found.** The `canProceed()` gate and the `commit()` resolution path
work correctly for exactly the scenario reported (homebrew race, official class, `pool: 'all'`, mid-level
creation with other choice kinds simultaneously pending). The most plausible explanation for the earlier
device observation is a **manual UI-automation artifact** from the improvised `uiautomator`/`adb input tap`
script used during that exploratory session (not the purpose-built driver in `scripts/e2e/adb.ts`, which
didn't exist yet at that point) — most likely a stale or mistimed tap coordinate, given the Confirm button
sits in a fixed footer outside the scrolling list and the previous session's script computed tap coordinates
from `uiautomator dump`s taken slightly before each tap rather than immediately before it.

This is a genuinely different conclusion from "fixture was invalid": the Tidewalker fixture and the real
Bard content are both correct; the *test I first wrote* to check them made the same category of mistake
(bypassing `applyGrant`) that a hypothetical bug would need to make, which is why it's worth recording
precisely rather than just asserting "works fine."

## FIX

None. No production file was changed (`app/creation/skills.tsx`, `app/creation/hub.tsx`,
`src/engine/leveling.ts`, and the Bard/background/pack content are all untouched by this investigation).

## AUTOMATED TEST

`app/creation/__tests__/skillsCommitBard.test.ts` — 5 tests, all passing. Added as a permanent regression
guard for a previously-uncovered combination: a homebrew race's features/resources coexisting with a
`pool: 'all'` class skill choice and simultaneously-pending subclass/expertise choices, using the real
`bardProgression` content end to end via `levelUp()`.

```
PASS app/creation/__tests__/skillsCommitBard.test.ts
  Level-6 smoke: Bard skill choice resolves on a Tidewalker-shaped homebrew race at level 5
    √ background-trained skills are in place before the skill choice is resolved
    √ levelUp queues exactly the real Bard level-1 skill choice (pool: "all", count 3), unresolved
    √ other pending choices (subclass, expertise) coexist and do not block or corrupt the skill choice
    √ resolving the skill choice with the augmented pool (the exact commit() pattern) succeeds and trains the chosen skills
    √ the achievable-count gate (replacement mode) requires exactly the choice count, not more or fewer
```

## DEVICE RESULT

**BLOCKED — the physical phone is not connected during this pass.** `adb devices -l` was checked repeatedly
across this pass (start of Phase 1, and again before finalizing this file) and returned an empty device
list each time; `adb kill-server` / `adb start-server` did not change that. Per the task's explicit
fallback instruction, the automated engine test above is the correctness proof for this phase, and no
device-level Level-6 flow (create → confirm skills → complete creation → reach level 6 → open sheet with
no crash) was attempted or claimed. If the device reconnects later in this pass, this section will be
updated with a real on-device confirmation before the final verdict is written; if it does not, the final
verdict records this as an explicit, unfabricated gap rather than a pass.
