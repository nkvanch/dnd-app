# Vision → Reality: Executability Assessment
*Assesses docs/VISION.md and docs/Future/* against the engine as implemented (July 2026).*
*Companion to RELEASE_AUDIT.md and ROADMAP_1.0.md — nothing here changes the 1.0 plan.*

## Headline verdict

The vision is unusually coherent, and — rare for vision docs — the codebase
already follows its core architecture. Entity/Feature/Effect/Choice/Resource/
Condition ARE the engine's real abstractions, progressions and content are
data, and homebrew flows through the same pipeline as official content. The
philosophy is not aspiration; it's the current design.

The gaps are specific and rankable. Below, each major idea gets one of:
**NOW** (buildable on current foundations), **NEXT** (post-1.0, incremental),
**FAR** (needs foundational rework), with the honest cost.

---

## 1. "Rules are data" / generic multi-ruleset engine — FAR (keep as compass)

The RULESET_ENGINE doc wants the engine to never assume AC, HP, six ability
scores, or spell slots. Reality: the typed core hardcodes all of these —
`AbilityScores` is a fixed six-stat record, `DerivedStats` hardcodes
AC/initiative/passives/spellSaveDC, `SkillName` is a closed union,
`SpellSlots` is tiers 1–9, `modifier()` is the 5e formula. Supporting Call of
Cthulhu or Cyberpunk means genericizing the entire typed core — close to an
engine rewrite, and it would trade away the strict typing that currently
catches every content mistake at compile time.

**Recommendation:** treat "engine generic" as a *design compass*, not a plan:
don't add NEW hardcoded assumptions, keep mechanics as data — but do not
spend effort genericizing before or soon after 1.0. The strict 5e types are a
shipping asset, not debt. Multi-ruleset is a v3+ ambition contingent on 5e
success.

## 2. Explainability ("why is my AC 17?") — NEXT, and the best one

The vision's core differentiator, and the most executable big idea. The
pipeline already computes every derived stat from enumerable effect
contributions — it just discards the trace and returns numbers. Modifying
`recomputeDerived` to optionally emit per-stat contribution lists
(source feature + delta) is a medium batch; an AuditModal shell and the
dmOverrides audit trail already exist as UI precedent. Tap AC → see
"10 base + 2 DEX + 3 chain shirt + 2 shield." This is also the perfect demo
moment for creators and matches the "honest engine" pitch exactly.

**Recommendation: make this the 1.1 flagship**, ahead of PDF export.

## 3. Creation as workspace (any order, start anywhere) — mostly DONE

The hub already allows visiting sections in any order with ✓ tracking; rules
live outside the flow; feats/equipment/spells are skippable. The remaining
vision delta (content-first / import-first workflows) is gated on import
maturity (§6), not on creation UX. No action needed.

## 4. Campaigns as first-class entities — NOW (incrementally)

Campaigns already own quests, session log, house rules, membership, and sync.
Locations/loot/encounter-prep are CRUD lists structurally identical to quests
— each is a small batch on existing patterns. The DM initiative screen
(already in the 1.1 backlog) is the highest-value slice of this section.

## 5. Homebrew builders — NOW for small builders; class builder is the mountain

Exists and real: race builder (senses/movement effects), item builder (AC
formulas, weapon damage, stat/sense/movement grants), ad-hoc feats.
The QA doc calls the **class builder "V1 mandatory" — disagree for shipping.**
It's the hardest builder by far (progression tables, spell-slot schedules,
subclass hooks, choice definitions), though genuinely executable since
`ClassProgression` is already pure data the builder would emit. Feat and
spell builders are moderate batches and better 1.x candidates.

**Recommendation:** 1.0 ships with race+item (+feat if cheap); class builder
is a headline 1.2 feature, not a 1.0 gate.

## 6. Import pipeline — V1 slice is NOW (and merges with 1.0 backup work)

The doc's own staging is right. Its V1 (manual entry, JSON import, package
import) overlaps almost entirely with the 1.0 roadmap's backup/export item —
**make `.grimoire-pack` and the backup format one schema** (versioned JSON +
assets) and both features fall out of the same work. Do this consciously in
Phase 3.2 of the roadmap.

The V1.5 website adapters (DandWiki/GMBinder/Homebrewery) are executable but
a grind: the hard part isn't fetching/parsing HTML, it's normalizing
free-text mechanics into structured Effects. Expect 60–70% automatic coverage
at best, with the doc's warning/review/placeholder workflow carrying the
rest — that mitigation design is correct and should be kept. Two cautions:
(a) legal — imported third-party homebrew is fine locally, but *sharing*
packs of others' content needs licensing care; (b) scope — adapters are a
post-1.1 project, minimum.

## 7. Snapshot safety / content versioning — PARTIAL today, NEXT for the rest

Partially true already, by architecture: grants materialize into
FeatureInstances ON the entity, so a character keeps working if its source
homebrew is deleted (spell references degrade gracefully to "?"). What
doesn't exist: content version metadata, v1.2→v1.3 update prompts, explicit
snapshot records. That's meaningful DB + UX work — post-1.0, and it becomes
*required* the moment pack sharing (§6) ships, so schedule them together.

## 8. AI-optional stance — consistent, keep

The import doc's "AI may assist, never required, never bypasses review" is
consistent with the project's no-AI-content principle. No conflict.

---

## Sequencing (how the vision merges into the roadmap)

| When | Vision item |
|---|---|
| 1.0 (already planned) | Backup/export **unified with `.grimoire-pack` schema** |
| 1.1 | **Explainability traces** (flagship), DM initiative screen |
| 1.2 | Class builder; feat/spell builders; content versioning + pack sharing |
| 1.3+ | Website import adapters (DandWiki/Homebrewery) |
| Compass only | Multi-ruleset engine — guides design, not scheduled |

The vision docs need no rewriting — they're direction, and the status note in
VISION.md already says so honestly. This document is the bridge: what's real,
what's next, what's far.
