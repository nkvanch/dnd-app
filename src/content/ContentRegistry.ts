// src/content/ContentRegistry.ts
// Lazy-loading wrapper around the large content catalogs (spells, items).
// Previously, ALL_SPELLS/ALL_ITEMS computed their classification-merge
// (.map() over 487 spells / 835 items) unconditionally at module import
// time, even on screens that never touch spells or items at all. This
// defers that computation to first actual access, and memoizes it — the
// map only runs once per app session, on whichever screen first needs it,
// rather than always at boot regardless of what the user opens first.
//
// Deliberately NOT a full lazy-import/code-splitting system (Metro's
// bundler doesn't support real dynamic code-splitting the way a web
// bundler does — the module's code is already in the bundle either way).
// The real, measurable win here is deferring the .map() computation itself
// and sharing one memoized result across every caller, not reducing what's
// in the app binary.
export class ContentRegistry<T extends { id: string }> {
  private _all: T[] | null = null;
  private _byId: Map<string, T> | null = null;

  constructor(private readonly loader: () => T[]) {}

  /** Full list, computed on first call and cached after. */
  getAll(): T[] {
    if (this._all === null) {
      this._all = this.loader();
    }
    return this._all;
  }

  /** O(1) lookup by id, building the index lazily alongside getAll(). */
  getById(id: string): T | undefined {
    if (this._byId === null) {
      this._byId = new Map(this.getAll().map(item => [item.id, item]));
    }
    return this._byId.get(id);
  }

  /** For tests or hot-reload scenarios where the underlying data changes. */
  invalidate(): void {
    this._all = null;
    this._byId = null;
  }
}
