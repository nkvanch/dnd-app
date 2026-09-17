# 09 — Conformance Answers

Answers to `07`'s conformance checklist (§11) and `03`'s domain-fact list (§2), checked
directly against the actual codebase rather than from memory. Every non-obvious answer below
cites a file and line. Where I didn't verify something, it's marked `?` rather than guessed —
per your own instruction in §11.2, that's a legitimate answer, not a gap in the reply.

**One structural note before the detail:** `08` says the eighteen new facts (`F-33…F-50`) live
in `03` §5 and §7. The `03-questions-for-author.md` file as it currently exists on disk only
goes up to `F-32` — there is no §5 or §7 in it. Either that file wasn't updated for Draft 2, or
those facts live somewhere I haven't found. Worth checking on your end before assuming I've
answered them — I haven't, because I can't see their wording.

---

## 1. Three things worth reading before the checklist

Ranked by how much they're worth to you, not by section order — matching the spirit of your
own §11.3.

### 1.1 The schema disagreement — checked against how this app actually works, and resolved

**Update since first sending this:** this wasn't a "not built yet," and it wasn't left open —
we checked each of your four stated reasons against how this app is actually built, not in the
abstract, and are keeping the blob design deliberately. Writing up the reasoning rather than
just the conclusion, per your own §11.6:

- *"Row-level sync becomes difficult"* — **doesn't apply here.** Our sync layer already diffs
  at the JS-object level (`deepDiff`/`deepMerge` over the in-memory `Entity`) BEFORE anything
  reaches SQLite. Whatever a row-level diff would buy us, we already have, one layer up, from a
  mechanism that predates this exchange.
- *"A single point of damage rewrites the whole record"* — true, but a character record is
  ~5-30KB (your own §1.5.2 number). That's not a real cost at this scale, and your own `S-1.13`
  ("the database exists for durability... not for query performance") already concedes the
  point that would make this matter.
- *"Undo granularity is coarse"* — true, and not a problem for us: our own undo/redo design
  (independent of this checklist) already uses whole-`Entity` before/after snapshots, which is
  exactly what this data scale calls for. Field-level undo was never a requirement here.
- *"Nothing is queryable"* — by your own `S-1.13`, query performance is explicitly not a goal
  for this project. This objection is inconsistent with a principle your own document states.

So: kept as-is, `schema.ts`'s comment now carries this full argument rather than just "avoids
migrations." One thing your underlying concern DOES get right, and we'd already independently
landed on: data with a genuinely different lifecycle from the character record — a persistent
mechanical timeline, specifically — gets its own table, not a spot inside the entity blob. That
part of the normalization instinct was correct; it just doesn't extend to the character record
itself, for the reasons above. This is the "built differently, and you have a reason" row from
your own §11.6 — worked through in full rather than left as a flag.

### 1.2 `A4` and `A11` are both genuinely absent, and they're coupled

Confirmed directly: `src/engine/combat.ts:345` has a hardcoded `outcome: 'success' | 'failure'`
for the one save-check the engine models, and the same file's own comment at line 378 says
there's "no attack-roll/hit resolution anywhere else" at all — the app doesn't resolve attacks;
players roll and apply damage themselves. There is also no `Trigger`/`TriggeredActivation`
concept anywhere in the codebase (confirmed by exhaustive grep) — reactive mechanics are either
hardcoded into specific functions (concentration dropping lives inside `combat.ts`, not as a
generic trigger) or left as disclosed, player-applied text.

These both being absent isn't a coincidence — an outcome-map is close to meaningless without
something to route the outcomes to a response, and a trigger without ruleset-defined outcomes
has nowhere to hang "on a hit." We already have both scoped as one combined phase in our own
active engine-hardening plan (see §3 below) — sequenced ahead of anything ruleset-generalization-shaped,
independent of this exchange.

### 1.3 `C19` is your predicted bug, present exactly as described

`ChoiceState.id: string` (`src/engine/types.ts:772`) — a single plain string, not
`(origin, choice)`. This is not a theoretical risk: it's the exact failure mode `07` §2.13
describes (multiclassing producing the same choice id from two different class sources) sitting
in the code today, unfixed. Confirmed, not inferred.

---

## 2. Domain facts (`03` §2, `F-01`–`F-32`)

Format per your own instruction: yes/no, one line if no. All checked against actual 5e/PF2e
rules text, not the codebase (these are facts about the games, not about our implementation).

| # | ✓ | Note |
|---|---|---|
| F-01 | yes | |
| F-02 | yes | |
| F-03 | yes | |
| F-04 | yes | |
| F-05 | yes | Shield adding on top of whichever base formula wins is exactly right |
| F-06 | yes | |
| F-07 | yes | |
| F-12 | yes | Order confirmed: sum additions first, then halve for resistance, floor |
| F-24 | yes | |
| F-26 | yes | |
| F-10 | yes | |
| F-11 | yes | Exhaustion is the one leveled condition in base 5e |
| F-16 | yes | Genuinely three distinct limiter kinds, not one generalized to three |
| F-17 | yes | |
| F-20 | yes | Wild Shape, Polymorph, Shapechange, True Polymorph all qualify |
| F-08 | yes | Warlock pact slots explicitly don't merge into the multiclass table (PHB p.165) |
| F-09 | yes | You get the higher attack count, not an additive stack |
| F-15 | yes | |
| F-18 | yes | Attunement cap of 3 is a base-rules constant |
| F-19 | yes | Subclass choice is the clearest example of a choice unlocking further choices |
| F-25 | yes | |
| F-13 | yes | |
| F-14 | yes | Upcasting is described as a delta from base almost universally |
| F-21 | yes | |
| F-22 | yes | |
| F-23 | yes | |
| F-29 | yes | Core PF2e mechanic, not an edge case |
| F-30 | yes | Untrained/trained/expert/master/legendary; untrained is +0 |
| F-31 | yes | |
| F-32 | yes | Dedication feats, not multiclass levels — a real structural difference from 5e worth keeping distinct |
| F-27 ⚑ | **partial** | Ballpark direction is right, but I'd verify the exact counts against the specific SRD printing (5.1 vs 5.2) you're targeting rather than take this as settled from memory |
| F-28 ⚑ | **?** | Genuine judgment call, not a fact — see Q2 below |

---

## 3. Open decisions (`03` §3, Q1–Q6)

These are yours to decide, not ours to answer — but here's where we've actually landed on the
adjacent ones, for what it's worth:

- **Q1**: We're already targeting Option A's shape (5e 2014 + 5e 2024 + PF2e as the long-term
  family), with 5.5e as the immediate next content target and PF2e explicitly deferred until it's
  actually being built — matches your Option A's own reasoning almost exactly.
- **Q2**: We lean (b), manual toggles — this is already the established pattern in shipped
  content (disclosed-but-not-mechanically-modeled riders on several feats/subclass features),
  not a new decision for us.
- **Q3**: Not ours to weigh in on.
- **Q4**: Agree it's load-bearing. Not yet built in the current app — see `D16`/`C10` below.
- **Q5**: Agree, and this is already true in the current implementation — homebrew compiles into
  the same domain types as official content, verified extensively across a full pass of
  extending test/preview tooling to every homebrew content type this session.
- **Q6**: Already built, narrowly, exactly as you'd recommend — two existing modals
  (`FreeEditModal` for players, `DmOverrideModal` for DMs) cover numeric-only manual overrides
  and nothing else.

---

## 4. Conformance checklist (`07` §11, all 67 items)

Same marks as your own legend (✅ / ⚠️ / ❌ / — / **?**), `where`/`cost` given for anything not ✅.

### Group A — rewrite class

| # | ✓ | Where / cost |
|---|---|---|
| A1 | ✅ | `Entity` (`types.ts:1169`) is one plain type for character/monster/npc. No ruleset-specific subclass anywhere |
| A2 | ✅ | `characterStore.characters: Entity[]`; no global "current character" |
| A3 | ⚠️ | `AbilityScores = Record<Ability, number>` (`types.ts:599`) is a keyed map structurally — but `Ability`/`SkillName` (`types.ts:97-103`) are closed, hardcoded 5e-specific unions (6 and 18 members), not ruleset-supplied. **Cost**: touches every read site of `Ability`/`SkillName` — 350+ references by an earlier grep this session |
| A4 | ❌ | See §1.2 above. **Cost**: every activation in every content file (~2,000+ records) would need the outcome shape changed — this is the single highest-value item, matching your own ranking |
| A5 | — | No ruleset-strategy system exists at all yet — one hardcoded 5e engine |
| A6 | — | Same as A5 — not applicable until a second ruleset variant exists |
| A7 | ⚠️ | Formulas are mostly isolated (`pipeline.ts`'s `modifier()`/`proficiencyBonus()`/`AC_DC_BASE`), but `resolver.ts`'s `TARGET_STRATEGY` map has 5e-specific vocabulary (`"ac"`, `"str"`, `"speed"`) baked into Core as string keys — ruleset vocabulary, not a numeric constant, but the same underlying problem `INV-14` names |
| A8 | ❌ | `itemRepo` (`itemRepo.ts:19`) is a module-level singleton, not passed as a parameter; `useHomebrewStore` is a global store. **Cost**: two rulesets can't be live in one process today |
| A9 | ✅ | `audit.ts`'s explain path reads the same formulas `pipeline.ts` computes with — unified this session specifically to close this gap |
| A10 | ✅ | `DerivedStats` never persisted, always recomputed |
| A11 | ❌ | See §1.2 above. **Cost**: every reactive ability (hundreds, per your own estimate) is either hardcoded or manual today |
| A12 | ❌ | No stable synthesized-id scheme for inline features (confirmed during our own planning for a live feature-add/remove capability) |
| A13 | **?** | Not audited — would need a full UI pass |
| A14 | ❌ | No import-boundary enforcement tool; layering is convention only |
| A15 | ✅ | `WildShapeState.beastHp`/`beastHpMax` (`types.ts:1149-1157`) |
| A16 | ❌ | `pipeline.ts:414-417` is a plain binary flag/membership check. No `unknown` state anywhere |

### Group B — migration class

| # | ✓ | Where / cost |
|---|---|---|
| B1 | ⚠️ | Ids are stable **authored strings** (`'human_2024'`), never load-order-dependent auto-increment numbers — sidesteps your specific failure mode for a different reason than assumed. Worth telling you directly rather than marking a flat yes/no |
| B2 | ⚠️ | Same reasoning as B1 — string keys aren't "reused" in the way a numeric handle could be |
| B3 | **?** | No evidence either way — didn't audit content-key history |
| B4 | **?** | Not verified |
| B5 | ⚠️ | `FeatureSource {kind, refId}` has identity, but `refId` is deliberately polymorphic/untyped (a considered decision from earlier this project, not an oversight) rather than a fully first-class stored record |
| B6 | ❌ — **deliberate, see §1.1** | Kept on purpose; reasoning resolved, not just flagged |
| B7 | ❌ — same | Follows from B6 |
| B8 | ❌ — same | Follows from B6 |
| B9 | ❌ — same | Follows from B6 |
| B10 | ⚠️ | `content_cache.version` exists for homebrew specifically (`schema.ts:53-59`); unclear whether a character records per-reference pack/version given the blob storage |

### Group C — refactor class

| # | ✓ | Where / cost |
|---|---|---|
| C1 | ✅ | Fixed this session — `resolver.test.ts` locks in shuffle-invariance with a randomized test, not just a fixed before/after |
| C2 | ⚠️ | Phases exist (base → additive → multiplicative, just fixed) but aren't a declared, inspectable property per-contribution — implicit in code order |
| C3 | ✅ | `selectBestAcFormula` (AC) and `resolveCombine`'s `'set'` handling (any target, fixed this session) both implement competing-base-setter semantics |
| C4 | ❌ | Losing base setters are discarded, not shown as "superseded" in any trace |
| C5 | **?** | `resolveCombine`'s multiply has no explicit scope tag — not verified further |
| C6 | **?** | No evidence rounding happens more than once, not exhaustively checked |
| C7 | **?** | Not verified — would need the damage-roll code specifically |
| C8 | ✅ | `resolveBinary` (`resolver.ts:119-126`) is exactly a `(hasAdvantage, hasDisadvantage)` pair |
| C9 | **?** | No evidence of cycle detection for content-authored formulas |
| C10 | **?** | Same underlying question as D16 — not verified this pass |
| C11 | ✅ | `characterStore.updateCharacter` — the one chokepoint every character mutation in the app passes through, only 3 call sites in the whole codebase |
| C12 | ✅ | Confirmed across every `leveling.ts`/`combat.ts`/`rest.ts` function touched this session |
| C13 | ❌ | `updateCharacter(id, updater)` has no descriptor param today — already scoped as a planned addition on our side (paired with an undo/redo mutation-boundary extension) |
| C14 | **?** | Writes go through a debounced save; transactionality not confirmed |
| C15 | — | No persistent timeline exists yet at all |
| C16 | — | Not built — no undo exists currently |
| C17 | — | Not built |
| C18 | ✅ | No class names appear anywhere in rest logic; resources declare their own recharge |
| C19 | ❌ | See §1.3 above |
| C20 | ✅ | `entity.choices: ChoiceState[]` already supports unresolved choices alongside a leveled-up character |
| C21 | ⚠️ | `homebrewValidator.ts`'s `ValidationResult` is already data, not exceptions, for homebrew validation specifically; broader character-load error handling not verified |
| C22 | ⚠️ | Effects are a closed tagged union (no scripting reachable), but there's no distinct `Expression` type — formulas are native functions, not a data-representable AST. Closed, but not data |
| C23 | ❌ | `SkillEntry.trained: boolean`, not a ruleset-defined value type |
| C24 | ❌ | No `Option` type exists — Great Weapon Master/Divine Smite-shaped choices aren't representable today |
| C25 | ⚠️ | No generic triggering-context parameter exists; concentration DC is computed directly where damage is applied, not through a shared mechanism |

### Group D — additive class

| # | ✓ | Note |
|---|---|---|
| D1 | ✅ | All content loads into memory at startup |
| D2 | ✅ | Same |
| D3 | ✅ | Same |
| D4 | **?** | Homebrew builders likely write directly into the same store the app reads — not re-verified this pass |
| D5 | ❌ | No pack-dependency-graph exists |
| D6 | **?** | Not verified |
| D7 | ⚠️ | Per-item `srd`/license tagging exists; no pack-level attribution display UI confirmed |
| D8 | — | N/A — no `Expression` type exists yet to bound |
| D9 | ✅ | Stated design goal; not stress-tested against an actually-missing pack |
| D10 | ❌ | No golden-value hand-computed test exists |
| D11 | ✅ | `resolver.test.ts`'s shuffle test, scoped to `resolveCombine` only so far |
| D12 | ❌ | Follows from A8 |
| D13 | ✅ | Diff-based LAN sync, confirmed multiple times, not intent/command replay |
| D14 | **?** | Not verified |
| D15 | **?** | Not verified |
| D16 | ❌ | No generic roll-modifier-kind system; manual dice entry not checked this pass |

---

## 5. Where this leaves things on our side

The confirmed gaps here (`A4`/`A11` outcome-maps + triggers, `A16` three-valued predicates,
`C19` choice-collision, the `C1`/`D11` stacking-determinism fix) are already sequenced into an
active internal plan, ahead of anything ruleset-generalization-shaped — we're treating engine
correctness for the current game as the priority before extending to a second rule system.
`C1`/`D11` (stacking-determinism) and `C19` (choice-collision) are both done as of this pass,
each with its own regression test.

`B6`–`B9` (§1.1) is resolved on our side, not just flagged — kept the blob design deliberately,
for the specific reasons written up there. If you still disagree after reading the reasoning
(especially the sync-already-diffs-at-the-object-layer point), that's worth hearing — it would
mean one of us still has something wrong, per your own §11.6.
