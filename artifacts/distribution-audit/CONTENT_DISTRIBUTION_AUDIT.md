# Creator Alpha content-distribution audit

## Final verdict

**INCONCLUSIVE — exact inclusion could not be proven.** Do not distribute any
existing Creator Alpha APK. A clean final artifact scan remains required.

## Git and artifact evidence

- Git HEAD: `9ecc8399b2ae49e7f737492228d7385f949ae9f1`
- Proven-leaking artifact: `D:\Documents\dnd-app\builds\Grimoire-0.1.0-creator-alpha.apk`
- SHA-256: `35c1fec3cc79fc17e2bcb148637ac0d24194b595f2a6281e118c97432cd2032e`
- Staged public-input APK: `D:\Documents\dnd-app\builds\grimoire-local-20261001-1022.apk`
- SHA-256: `f5b1cdcfdbd9df91b719b57cc22611ed347313840a708a980b61bcd9de2c6d18`

## Confirmed leak

The prior Creator Alpha APK contains `res/xm.db`, the Expo SQLite asset.
Direct queries found **891 items** and **489 spells**, including blocked
`mace_of_disruption`, `broom_of_flying`, and `ring_of_protection`. Its Metro
bundle also contains those names plus private representative strings `Blood
Hunter`, `Avernus`, `Githyanki`, and `Beholder`. Runtime filtering was not a
distribution boundary.

## Source to artifact map

| Source | Classification | Previous route | Public-build treatment |
| --- | --- | --- | --- |
| `src/content/items/importedItems.ts` (891 full items) | PRIVATE_DEV_ONLY | static aggregation and SQLite | excluded by public Metro alias; DB uses `ALL_ITEMS` |
| `src/content/spells/generated.ts`, level files | PRIVATE_DEV_ONLY / mixed | static aggregation and SQLite | excluded by public alias; DB uses `ALL_SPELLS` |
| classes/races/backgrounds/feats/subclasses | PRIVATE_DEV_ONLY / mixed | static aggregators then runtime filter | public data-only snapshot alias |
| `generatedSrdItems.json` (95) | PUBLIC_DISTRIBUTED | public item runtime | public snapshot and public DB |
| `assets/content.db` | PRIVATE_DEV_ONLY in checkout | Expo asset require | staged public seed during public build only |
| canonical PDF, converters, provenance scripts | BUILD_TOOL_ONLY | build-time only | not an APK asset |
| tests, demo packs, docs, `artifacts/` | TEST_ONLY / PRIVATE_DEV_ONLY | no APK path identified | exclude from public source/archive release |

## Fixes made

1. Content DB generation now consumes public `ALL_*` collections and supports
   isolated output paths.
2. A generated data-only public snapshot plus Metro public aliases prevent
   top-level private aggregators from becoming native bundle dependencies.
3. Local/EAS public build hooks materialize the 95-item public DB before
   bundling; the local script restores the private 891-item development DB.

## Current verification

- Staged DB: **95 items / 319 spells**; `dagger` exists; the three blocked
  item IDs do not.
- The existing `1022` APK has that 95/319 database, but its bundle still has
  blocked strings. It is **not distributable**.
- The private local DB was restored: **891 items / 489 spells**.

## Source-release finding

A raw repository archive is not safe to publish: it includes full/private
catalogs, audit material, converters, fixtures, docs, demos, and artifacts.
Publish only a sanitized source staging export or explicitly exclude those
paths; preserve the full catalog as private development/audit data.

## Required final step

Complete the active forced Gradle package, extract that exact APK, query its
SQLite asset, scan `assets/index.android.bundle` for the representative blocked
names/description strings, verify 95 public records and public web/native
parity, then update this report with the final path and SHA-256 before PASS.
