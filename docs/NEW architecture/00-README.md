# Grimoire — Design Review

These documents are a review of the architecture notes in this vault, plus a proposed way
forward. They were produced from a close reading of all 52 notes.

**This is your project.** Nothing here is a verdict. Every problem is stated with a reason
and a concrete example, and every recommendation comes with the argument for it, so you can
disagree with the argument rather than take the conclusion on faith. Several places are
marked where you are the one who has to decide, because they depend on things only you know.

The short version: **the fundamental instincts in these notes are good — better than most
projects of this kind get.** The gaps are concentrated in five specific places, and all five
are cheap to fix now and expensive to fix later. That is the reason for writing this down.

---

## The documents

| File | What it contains | Read it |
|---|---|---|
| `01-design-review.md` | What is strong, then the problems in order of severity | **First** |
| `02-recommended-approach.md` | The proposed way forward and the reasoning behind it | Second |
| `05-architecture-decisions.md` | 16 structural decisions, each with options, reasoning and its role in the whole | **Third — the core** |
| `03-questions-for-author.md` | 32 domain facts to verify + open decisions | **Needs your answers** |
| `04-reference.md` | Glossary, invariants, data catalog, database implications | Reference — dip in as needed |

If you only read one thing, read `05` — and start with its section 0, which is a diagram of
how the sixteen decisions depend on each other.

## On `05` in particular

That document states positions rather than asking questions, and it is worth being clear
about why, and about where the line falls.

| Kind of question | Who decides |
|---|---|
| **Facts about the games** | You. Only you can supply these. |
| **Product** — what the app is for, what is in v1, how much of the long tail to cover | You. Taking these would make it not your project. |
| **Structure** — where behaviour lives, how classes relate, what the joints are | Proposed in `05`, because the cost of getting these wrong is a rewrite rather than an edit. |
| **Trade-offs** — technology stack, schema details | Recommended with a position, decided by you. |

Every entry in `05` carries its reasoning, the options that were rejected and why, and how
expensive it is to reverse. **Please push back explicitly where you disagree.** Silent
disagreement is the worst outcome — the documents would then describe a system that does not
exist, which is worse than having no documents.

---

## What is already settled

These came out of discussion and are treated as fixed unless you object:

| # | Decision |
|---|---|
| D1 | v1 targets **players only**. DM tools and combat tracking are v2, but v1 must be built so v2 slots in without rework. |
| D2 | Target platforms: Android, iOS, Windows. |
| D3 | The priority is **shipping the app**, not the learning process. |
| D6 | `AbilityDefinition` is renamed to **`ActivationDefinition`** (see `01`, problem P5). |

Plus the sixteen structural decisions **A-01 … A-16** in `05-architecture-decisions.md`,
which are proposed rather than agreed until you have read them.

## What is still open

| # | Open question | Where |
|---|---|---|
| D4 | Technology stack | `02`, section 9 |
| D5 | How many rule systems v1 must accommodate | `03`, Q1 |
| — | Coverage target for unusual content (the "long tail") | `03`, Q2 |
| — | 32 domain facts that need checking by someone who knows the games | `03`, section 2 |

---

## A note on how this was produced

The review was done by someone who understands architecture and formalisation but does not
play these games, working with an assistant that knows the game systems but cannot verify
its own recall.

That is why `03-questions-for-author.md` exists. Every claim in these documents that depends
on knowing D&D is written out as a numbered fact (`F-01` … `F-32`), and each structural
conclusion is traced back to the facts it rests on. **You are the only person in this loop
who can check those facts.** If one of them is wrong, `03` section 4 tells you exactly which
conclusions change — the error stays contained instead of quietly poisoning the design.

Five facts are marked `⚑`, meaning confidence is lower and checking matters more.
