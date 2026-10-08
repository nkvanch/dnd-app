# Closure Pass 4 boundaries

This pass concerns authoritative source grants, class acquisition, caster contribution,
spent spell slots, and spell payment. It does not introduce RulesModule or Custom Rule
Profiles. A44's bundled database and runtime filtering are deliberate and unchanged.

## Future Custom Rule Profiles economy requirement

Preserve base catalog prices. Derive effective and display prices from the active profile.
Future support must allow configurable currency denomination ratios, a general price
multiplier, and category-specific multipliers for food, lodging, adventuring gear,
weapons, armor, tools, services, mounts/vehicles, and magic items where represented.
Also allow optional income/wage and treasure/reward multipliers and a configurable
sell-back percentage.

These requirements are recorded only; no economy scaling is implemented in this pass.
The pass makes no changes to money types or catalog prices and introduces no dependency
that would prevent this profile-based derivation.

Other deferred work: editor round-trip closure, deeper Entity validation/quarantine,
legacy item hydration, native content.db regeneration, Compendium performance, and LAN/sync.
