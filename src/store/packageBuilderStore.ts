// src/store/packageBuilderStore.ts
// Session-local working state of the Package Builder (Compendium → Packages →
// Create Package): what the user explicitly picked, the package metadata, the
// current step, and the picker's own search/category. Kept in a plain Zustand
// store so the selection survives search/filter changes, opening an editor
// from the picker, and leaving and returning to the screen. Only explicit
// choices are stored: dependencies are always derived (engine/packageBuilder.ts),
// so a stale dependency can never outlive the selection that required it.
import { create } from 'zustand';
import type { ContentCacheType } from '../db/contentCacheRepo';
import type { DependencyRef } from '../engine/contentDependencies';
import { dedupeRefs, removeRef, toggleRef } from '../engine/packageBuilder';

export type PackageBuilderStep = 'select' | 'review';

type PackageBuilderState = {
  explicit: DependencyRef[];
  step: PackageBuilderStep;
  name: string;
  version: string;
  author: string;
  description: string;
  search: string;
  category: ContentCacheType | 'all';

  toggle: (ref: DependencyRef) => void;
  remove: (ref: DependencyRef) => void;
  setStep: (step: PackageBuilderStep) => void;
  setField: (field: 'name' | 'version' | 'author' | 'description' | 'search', value: string) => void;
  setCategory: (c: ContentCacheType | 'all') => void;
  /** Start a fresh builder, optionally pre-seeded (e.g. from the library's Select mode or an installed package). */
  begin: (seed?: { explicit?: DependencyRef[]; name?: string; version?: string; author?: string; description?: string; step?: PackageBuilderStep }) => void;
  reset: () => void;
};

const INITIAL = {
  explicit: [] as DependencyRef[], step: 'select' as PackageBuilderStep,
  name: '', version: '1.0', author: '', description: '', search: '', category: 'all' as ContentCacheType | 'all',
};

export const usePackageBuilderStore = create<PackageBuilderState>(set => ({
  ...INITIAL,
  toggle: ref => set(s => ({ explicit: toggleRef(s.explicit, ref) })),
  remove: ref => set(s => ({ explicit: removeRef(s.explicit, ref) })),
  setStep: step => set({ step }),
  setField: (field, value) => set({ [field]: value } as Partial<PackageBuilderState>),
  setCategory: category => set({ category }),
  begin: seed => set({
    ...INITIAL,
    explicit: dedupeRefs(seed?.explicit ?? []),
    name: seed?.name ?? '', version: seed?.version ?? '1.0', author: seed?.author ?? '', description: seed?.description ?? '',
    step: seed?.step ?? 'select',
  }),
  reset: () => set({ ...INITIAL }),
}));
