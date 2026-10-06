// Class and species names for a character on a list row, read from the merged content at render time (not their stored ids).
import type { Entity } from '../engine/types';
import { resolveIdentityLabels, IdentityLabels } from '../content/identityLabels';
import { useHomebrewStore } from './homebrewStore';

export function identityLabelsFor(entity: Entity): IdentityLabels {
  const hb = useHomebrewStore.getState();
  return resolveIdentityLabels(entity, hb.getMergedContentDB(entity.rulesetId), hb.subclasses);
}
