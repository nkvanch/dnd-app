// ============================================================================
// FILE: src/session/roles.ts
// Capability model + op authorization. This is enforced by the Host core on
// every op; the UI hiding buttons is a convenience, never the security boundary.
// ============================================================================
import { Capability, CharacterChange, OpBody } from './types';

export const ALL_CAPABILITIES: Capability[] = ['host', 'dm', 'player'];
/** Capabilities that can be granted/requested over the network. `host` never is. */
export const GRANTABLE: Capability[] = ['dm', 'player'];

export function requiredCapability(kind: OpBody['kind']): Capability {
  if (kind.startsWith('dm.')) return 'dm';
  if (kind.startsWith('player.')) return 'player';
  return 'host';
}

export function isAuthorized(capabilities: Capability[], kind: OpBody['kind']): boolean {
  return capabilities.includes(requiredCapability(kind));
}

export function sanitizeRequested(requested: unknown): Capability[] {
  if (!Array.isArray(requested)) return [];
  const out: Capability[] = [];
  for (const c of requested) {
    if ((GRANTABLE as unknown[]).includes(c) && !out.includes(c as Capability)) out.push(c as Capability);
  }
  return out;
}

// ── Human-readable text (used by audit entries and UIs) ─────────────────────

const ABILITY_LABEL: Record<string, string> = {
  str: 'STR', dex: 'DEX', con: 'CON', int: 'INT', wis: 'WIS', cha: 'CHA',
};

function signed(n: number): string {
  return n >= 0 ? `+${n}` : `${n}`;
}

export function describeChange(c: CharacterChange): string {
  switch (c.kind) {
    case 'exhaustion': return `Exhaustion ${signed(c.delta)}`;
    case 'max_hp':     return `Max HP ${signed(c.delta)}`;
    case 'ability':    return `${ABILITY_LABEL[c.ability] ?? c.ability} ${signed(c.delta)}`;
    case 'hp':         return c.delta < 0 ? `${-c.delta} damage` : `Heal ${c.delta}`;
    case 'temp_hp':    return `${c.amount} temp HP`;
  }
}

export function describeChanges(changes: CharacterChange[]): string {
  return changes.map(describeChange).join(', ');
}

/** Structural validation of untrusted change lists. */
export function validChanges(changes: unknown): changes is CharacterChange[] {
  if (!Array.isArray(changes) || changes.length === 0 || changes.length > 20) return false;
  return changes.every(c => {
    if (!c || typeof c !== 'object') return false;
    const ch = c as Record<string, unknown>;
    if (ch.kind === 'temp_hp') return typeof ch.amount === 'number' && Number.isFinite(ch.amount) && Number.isInteger(ch.amount) && ch.amount >= 0;
    if (typeof ch.delta !== 'number' || !Number.isFinite(ch.delta) || !Number.isInteger(ch.delta)) return false;
    if (ch.kind === 'exhaustion' || ch.kind === 'max_hp' || ch.kind === 'hp') return true;
    if (ch.kind === 'ability') return typeof ch.ability === 'string' && ch.ability in ABILITY_LABEL;
    return false;
  });
}
