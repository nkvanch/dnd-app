// src/sync/diff.ts
// Recursive diff/merge for entity sync — replaces the old "always send and
// apply the full entity" model, which caused two real problems Nick reported:
//   1. Every minor change (e.g. -1 HP) sent the ENTIRE character over the
//      wire, not just what changed.
//   2. The receiving side did a wholesale replace, not a merge — so if two
//      devices made different small edits close together, whichever full
//      snapshot arrived LAST simply overwrote the other's change entirely,
//      even in completely unrelated fields.
//
// deepDiff computes only the parts of `next` that actually differ from
// `previous`, at any nesting depth. deepMerge applies that patch onto the
// RECEIVER's own current local copy (not the sender's stale base) — so a
// field the receiver already has that the patch doesn't mention is never
// touched. This doesn't solve true same-field concurrent edits (last patch
// to arrive still wins for that specific field — an acceptable trade-off
// without full CRDT machinery), but it fixes the actual reported problem:
// an unrelated field one device just changed no longer gets clobbered by an
// unrelated change from another device.

/**
 * Returns only the parts of `next` that differ from `previous`, recursively.
 * Returns `undefined` if there's no difference at all (nothing to send).
 * Arrays and primitives are compared/replaced as whole values — a
 * fine-grained array diff isn't worth the complexity at this app's scale
 * (entity arrays like conditions/features are small).
 *
 * KNOWN LIMITATION, deliberately not engineered around: a true key REMOVAL
 * (a field present in `previous` but absent in `next`) is represented
 * in-memory as `{ key: undefined }`, which is correct for deepMerge to
 * consume locally — but `JSON.stringify` silently drops `undefined` values,
 * so that removal would NOT survive being sent over the actual TCP sync
 * channel (protocol.ts's encodeMessage). This doesn't affect this app in
 * practice: every field on the Entity type is always initialized (see
 * makeEmptyEntity) and never truly deleted, only ever changed to a
 * different value — so this path is never actually exercised. Flagging it
 * here rather than silently leaving an untested edge case.
 */
export function deepDiff(previous: unknown, next: unknown): unknown {
  if (previous === next) return undefined;

  const prevIsObj = typeof previous === 'object' && previous !== null && !Array.isArray(previous);
  const nextIsObj = typeof next === 'object' && next !== null && !Array.isArray(next);

  if (!prevIsObj || !nextIsObj) {
    // Primitive, null, array, or a type change — compare by value and send
    // the whole new value if different (arrays included: cheap enough here).
    return jsonEqual(previous, next) ? undefined : next;
  }

  const prevObj = previous as Record<string, unknown>;
  const nextObj = next as Record<string, unknown>;
  const patch: Record<string, unknown> = {};
  let changed = false;

  const keys = new Set([...Object.keys(prevObj), ...Object.keys(nextObj)]);
  for (const key of keys) {
    const sub = deepDiff(prevObj[key], nextObj[key]);
    if (sub !== undefined) {
      patch[key] = sub;
      changed = true;
    }
  }
  return changed ? patch : undefined;
}

/**
 * Applies a patch (from deepDiff) onto `local`, recursively. Only the keys
 * present in the patch are touched — everything else in `local` is
 * preserved exactly as-is, which is the core fix for the overwrite problem.
 */
export function deepMerge<T>(local: T, patch: unknown): T {
  if (patch === undefined) return local;

  const patchIsObj = typeof patch === 'object' && patch !== null && !Array.isArray(patch);
  const localIsObj = typeof local === 'object' && local !== null && !Array.isArray(local);

  if (!patchIsObj || !localIsObj) {
    // Primitive, null, or array patch value — replace wholesale.
    return patch as T;
  }

  const result: Record<string, unknown> = { ...(local as Record<string, unknown>) };
  const patchObj = patch as Record<string, unknown>;
  for (const key of Object.keys(patchObj)) {
    result[key] = deepMerge((local as Record<string, unknown>)[key], patchObj[key]);
  }
  return result as T;
}

function jsonEqual(a: unknown, b: unknown): boolean {
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return a === b;
  }
}
