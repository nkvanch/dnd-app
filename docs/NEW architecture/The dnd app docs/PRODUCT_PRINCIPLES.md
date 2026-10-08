# Grimoire — Product Principles

These principles govern every feature decision. When two choices conflict, the
principle higher on this list wins.

---

## 1. The engine is generic. The experience is D&D.

The rules engine has no opinion about what game is being played.
It resolves Effects, not "Barbarian rules." It speaks in Features, not spells.
It treats official content and homebrew as indistinguishable data.

The user interface has a strong opinion. It speaks in Rage, Spell Slots, and
Darkvision. It shows hit points, not "resource.hp.current." It says "you can't
cast spells while raging" in plain English, not "condition flag suppresses feature
activation." The UI is unapologetically, excellently, premium D&D 5e — and the
engine underneath can support anything because it has no D&D hardcoded into it.

This is the central tension of the product. Never resolve it the wrong way.
The temptation to let engine vocabulary leak into the UI is constant and must be
actively resisted.

---

## 2. Every number is explainable. That is the product.

Most D&D apps show: AC 17.
Grimoire shows: AC 17, and here is exactly why — base 10, leather armor +11,
DEX +2, racial +0, DM override +0.

This is not a nice-to-have feature. It is the core differentiator.
It is what makes the app trustworthy to veterans, educational to beginners,
and useful to DMs verifying homebrew.

Consequence: any number shown in the UI without a working audit trail is a bug,
not a missing feature. The audit trail is load-bearing.

---

## 3. The app adapts to the table. The table does not adapt to the app.

Grimoire must support the way tables actually play, not the way the rules say
they should play. Max level of 10? Allowed. Homebrew race with six ability
bonuses? Allowed. Campaign rule that removes multiclassing? Allowed.
Characters that started at level 7? Allowed.

This is why rules are expressed as data, why CampaignRules exists, and why
the settings screen matters more than its size suggests.

---

## 4. Homebrew is first-class, not an edge case.

Official content and homebrew content use the same engine, the same data
structures, the same creation wizard, and the same character sheet.
A custom race created in the Race Builder should feel identical to a PHB race
during play — same audit trail, same calculated bonuses, same feature display.

The goal is: "I invented a rule that has never existed, and the app
understands it." That goal is what distinguishes Grimoire from a PDF viewer.

---

## 5. Offline is not a feature. It is a requirement.

A table game cannot depend on internet connectivity.
Characters must be fully playable with no signal.
Sync is a convenience. Offline is the baseline.

Any feature that breaks offline play is an architectural regression, not a
product decision.

---

## 6. The DM's authority is transparent, not automated away.

Automation reduces bookkeeping. It does not remove judgment.
When the app changes a number, the user knows what changed, why it changed,
and which rule caused it. DM overrides are visible to players as a ✱ with a
reason. Nothing is hidden.

The app assists the DM's judgment. It does not replace it.

---

## 7. Speed during play beats completeness before play.

The best feature is the one that saves time at the table.
A system that is slightly incomplete but fast to use during an encounter
is more valuable than one that is complete but slow.

This is why the Combat tab is the default sheet view, why AC is always visible,
and why the action card system generates playable UI without authoring each
ability individually.
