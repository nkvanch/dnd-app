// ============================================================================
// FILE: src/session/routing.ts
// Screen routing derives from ACTUAL capabilities, never from "who created the
// room". Pure so it can be unit-tested and reused by the hub and deep links.
// ============================================================================
import { Capability } from './types';

export type LiveDestination = 'host' | 'dm' | 'player';

export const DESTINATION_PATH: Record<LiveDestination, string> = {
  host: '/live/host',
  dm: '/live/dm',
  player: '/live/player',
};

export const DESTINATION_LABEL: Record<LiveDestination, string> = {
  host: 'Host',
  dm: 'DM',
  player: 'Player',
};

/** Every screen this capability set may open, in a stable order. */
export function destinationsFor(caps: readonly Capability[]): LiveDestination[] {
  const out: LiveDestination[] = [];
  if (caps.includes('host')) out.push('host');
  if (caps.includes('dm')) out.push('dm');
  if (caps.includes('player')) out.push('player');
  return out;
}

/** The single screen to open automatically, or null when the user must choose (or there is none). */
export function primaryDestination(caps: readonly Capability[]): LiveDestination | null {
  const d = destinationsFor(caps);
  return d.length === 1 ? d[0] : null;
}

export function capabilityLabel(caps: readonly Capability[]): string {
  const d = destinationsFor(caps).map(x => DESTINATION_LABEL[x]);
  return d.length === 0 ? 'Waiting for a role' : d.join(' + ');
}
