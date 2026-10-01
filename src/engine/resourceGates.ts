// src/engine/resourceGates.ts
// Resource-threshold tests shared by effect collection (pipeline.ts) and
// availability checks (actionCards.ts). Dependency-free on purpose.
import type { Entity, ResourceRange } from './types';

/** Is the entity's resource currently within the range? A missing or hidden (inactive) pool is not. */
export function resourceInRange(entity: Entity, range: ResourceRange): boolean {
  const r = entity.resources.custom.find(x => x.id === range.resourceId);
  if (!r || r.inactive) return false;
  return (range.min === undefined || r.current >= range.min) && (range.max === undefined || r.current <= range.max);
}
