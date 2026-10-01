import { Phone } from '../adb';
import { NodeTable } from '../table';

export type FlowCtx = {
  phone: Phone;
  table: NodeTable | null;
  /** (Re)starts the Node table: used for Host X -> Host Y scenarios. */
  startTable(spec: TableSpec): Promise<NodeTable>;
  /** Records an assertion from outside the phone UI (Node-side state, wire logs). */
  check(cond: boolean, what: string): void;
  step(msg: string): void;
  /** Starts the screen recording (only when the runner was given --record). Setup happens before this. */
  startRecording(): void;
};

export type TableSpec = {
  policy: 'manual' | 'auto-first' | 'never';
  players?: [string, string][];
  nodeDm?: boolean;
  hostCaps?: ('dm' | 'player')[];
  /** Phone reaches the Host through a fault proxy on this port. */
  proxyPort?: number;
  sessionId?: string;
  /** The phone is the Host; Node peers dial it through `adb forward`. */
  remote?: boolean;
};

export type Flow = {
  name: string;
  description: string;
  table?: TableSpec;
  run(ctx: FlowCtx): Promise<void>;
};

/**
 * The Campaigns tab's "no active campaign" view IS the live-session entry (Create/Join/Plan
 * Campaign buttons) — no separate reveal tap needed to reach it, unlike the previous floating
 * banner this replaced.
 */
export async function openLiveHub(phone: Phone): Promise<void> {
  await phone.tap({ id: 'tab-campaigns' });
  await phone.waitFor({ id: 'live-host-campaign' });
}

/** Signals from the table side that the phone flow waits for. */
export async function waitUntil(cond: () => boolean, what: string, ms = 30000): Promise<void> {
  const start = Date.now();
  while (!cond()) {
    if (Date.now() - start > ms) throw new Error(`timeout waiting for: ${what}`);
    await new Promise(r => setTimeout(r, 100));
  }
}

/**
 * Fills the join form and joins by IP (via the Advanced disclosure) — the test table runs on the
 * PC's localhost, which is an IP, not a real LAN room code scenario, so this intentionally
 * exercises the same "Advanced -> Connect by IP" path a real user falls back to, per
 * CAMPAIGN_DM_AUTHORITY_RULES.md §33 (room code is the normal path; IP is secondary, not a
 * dual-purpose field). The name field lives on the Live Session card; "Join Campaign" opens the
 * join modal, where the rest of the fields live. Chip states are read from the accessibility
 * label, never assumed.
 */
export async function joinSession(phone: Phone, o: { nick: string; address: string; player: boolean; dm: boolean; character?: string }): Promise<void> {
  await phone.typeInto({ id: 'live-nickname' }, o.nick);
  await phone.tap({ id: 'live-join-campaign' });
  await phone.setChip('live-want-player', o.player);
  await phone.setChip('live-want-dm', o.dm);
  if (o.player && o.character) await phone.tap({ id: `live-char-${o.character}` });
  await phone.tap({ id: 'live-join-advanced-toggle' });
  await phone.typeInto({ id: 'live-join-ip' }, o.address);
  await phone.tap({ id: 'live-join-ip-connect' });
}

/** Backs out of stacked screens until the bottom tab bar is showing. */
export async function toTabs(phone: Phone): Promise<void> {
  for (let i = 0; i < 5; i++) {
    if (phone.visible({ id: 'tab-home' })) return;
    phone.back();
    await phone.pause(700);
  }
  await phone.waitFor({ id: 'tab-home' }, 5000);
}
