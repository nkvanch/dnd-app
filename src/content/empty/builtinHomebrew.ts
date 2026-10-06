// The author's built-in homebrew is not part of the app: it ships as a private homebrew pack file (scripts/build-private-homebrew-pack.ts).
export const BUILTIN_HOMEBREW = { classes: [], races: [], subclasses: [], feats: [], items: [], monsters: [], conditions: [], spells: [], features: [] };
export const BUILTIN_HOMEBREW_IDS: ReadonlySet<string> = new Set();
export const BUILTIN_HOMEBREW_SEED: Array<{ type: 'class' | 'race'; item: unknown }> = [];
