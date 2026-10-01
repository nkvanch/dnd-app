// ============================================================================
// FILE: src/session/prep.ts
// DM campaign PREPARATION: persistent, owned by the DM, fully usable with no
// Host running. Deliberately separate from live-session state:
//   CampaignRevision   (this file, DM-local)   vs
//   LiveSessionRevision (host.ts, Host-local)
// Prepared content is definitions/templates only. Nothing here holds live
// values (no live revision, request id/status, or applications); those are
// created only when the DM explicitly activates something (see peer.ts).
// ============================================================================
import {
  CharacterChange, EffectComponent, EffectDefinitionInput, EffectDuration, EffectVisibility,
  LiveCombatant, LiveEncounterInput, SecretEffectMeta, CampaignPolicy, STANDARD_MONSTER_VISIBILITY,
} from './types';
import { KeyValueStore } from './kv';
import { RulesetId } from '../engine/types';

export type PrepCombatant = {
  id:      string;
  name:    string;
  hpState: LiveCombatant['hpState'];
  ac?:     number;
  dmNotes: string;                 // never sent
  /** Hidden combatants are held back from the public projection until revealed. */
  hidden?: boolean;
};

export type PrepEncounter = {
  id:         string;
  name:       string;
  combatants: PrepCombatant[];
  dmNotes:    string;              // never sent
  /** Optional link to the existing Encounter Planner record this was imported from. */
  sourceEncounterId?: string;
};

export type PrepEffect = {
  id:                   string;
  name:                 string;
  description:          string;
  source:               string;
  notes:                string;
  hiddenDurationReason: string;
  visibility:           EffectVisibility;
  components:           EffectComponent[];
  duration:             EffectDuration;
};

export type PrepChangeTemplate = {
  id:      string;
  label:   string;
  changes: CharacterChange[];
};

// DM_SCREEN_SPEC.md item 15's five note kinds. 'encounter' and 'monster' notes tied to a SPECIFIC
// prepared encounter/combatant already have a dedicated home (PrepEncounter.dmNotes and
// PrepCombatant.dmNotes below) — these categories are for the general case: a session-wide
// encounter thought not yet pinned to one prepared encounter, or an NPC/monster that isn't part
// of any prepared encounter at all.
export type NoteCategory = 'session' | 'encounter' | 'player' | 'monster' | 'reminder';

export type PrepNote = {
  id:     string;
  text:   string;
  dmOnly: boolean;
  /** Optional for backward compatibility with notes saved before this field existed; treat a
   *  missing category as 'session' at display time rather than migrating old data on load. */
  category?: NoteCategory;
  /** Free-text subject for 'player' (character/player name) or 'monster' (NPC/monster name)
   *  notes — not a foreign key into `party` or a monster database entry, since this is meant to
   *  stay a quick jotting tool, not a relational one. Ignored for the other three categories. */
  subject?: string;
};

export type SessionPlan = {
  id:          string;
  name:        string;
  encounterIds: string[];
  effectIds:   string[];
  templateIds: string[];
  notes:       string;
};

/**
 * The join-compatibility policy a DM sets while preparing, carried on every `CampaignPrep` and
 * sent to the Host (and from there to a peeking/joining Player — see types.ts's CampaignPolicy,
 * dm.select_campaign, and LiveState.campaign) the moment the DM links this campaign to a live
 * room. `requiredPackIds` stays id-only here (same as `bannedPackIds`) since the DM's own device
 * — the one setting this policy — always has the pack installed to name it from; see
 * toLivePolicyInput below for where a human-readable name gets attached for the wire.
 */
export type ContentManifest = {
  bannedPackIds:      string[];
  bannedSubclassIds:  string[];
  requiredPackIds:    string[];
  rulesetId?:         RulesetId;
  maxLevel?:          number | null;
};

export type CampaignPrep = {
  schema:           1;
  campaignId:       string;
  name:             string;
  /** CampaignRevision: advances on every local preparation edit. */
  campaignRevision: number;
  updatedAt:        number;
  encounters:       PrepEncounter[];
  effects:          PrepEffect[];
  templates:        PrepChangeTemplate[];
  notes:            PrepNote[];
  plans:            SessionPlan[];
  contentManifest:  ContentManifest;
  party:            { name: string }[];
};

export function newCampaignPrep(campaignId: string, name: string, now: number): CampaignPrep {
  return {
    schema: 1, campaignId, name, campaignRevision: 1, updatedAt: now,
    encounters: [], effects: [], templates: [], notes: [], plans: [],
    contentManifest: { bannedPackIds: [], bannedSubclassIds: [], requiredPackIds: [] }, party: [],
  };
}

// ── Inertness check (prepared != live) ───────────────────────────────────────

const LIVE_ONLY_KEYS = new Set([
  'requestId', 'status', 'baseRevision', 'targetId', 'applications', 'liveRevision',
  'appliedAtRevision', 'createdAtRevision', 'resolvedAtRevision', 'finalApplied', 'sessionId',
]);

/** Returns JSON paths of any live-only field found inside prepared content. Empty = clean. */
export function findLiveFields(prep: CampaignPrep): string[] {
  const hits: string[] = [];
  const walk = (v: unknown, path: string): void => {
    if (Array.isArray(v)) { v.forEach((x, i) => walk(x, `${path}[${i}]`)); return; }
    if (v && typeof v === 'object') {
      for (const [k, x] of Object.entries(v as Record<string, unknown>)) {
        if (LIVE_ONLY_KEYS.has(k)) hits.push(`${path}.${k}`);
        walk(x, `${path}.${k}`);
      }
    }
  };
  walk({ encounters: prep.encounters, effects: prep.effects, templates: prep.templates, plans: prep.plans }, '$');
  return hits;
}

// ── Service ──────────────────────────────────────────────────────────────────

const PREP_PREFIX = 'session.prep.';

export class PrepService {
  constructor(private readonly kv: KeyValueStore, private readonly now: () => number = () => Date.now()) {}

  async create(campaignId: string, name: string): Promise<CampaignPrep> {
    const existing = await this.load(campaignId);
    if (existing) return existing;
    const prep = newCampaignPrep(campaignId, name, this.now());
    await this.kv.set(PREP_PREFIX + campaignId, prep);
    return prep;
  }

  load(campaignId: string): Promise<CampaignPrep | null> {
    return this.kv.get<CampaignPrep>(PREP_PREFIX + campaignId);
  }

  async list(): Promise<{ campaignId: string; name: string; campaignRevision: number }[]> {
    const keys = await this.kv.keys(PREP_PREFIX);
    const out: { campaignId: string; name: string; campaignRevision: number }[] = [];
    for (const k of keys) {
      const p = await this.kv.get<CampaignPrep>(k);
      if (p) out.push({ campaignId: p.campaignId, name: p.name, campaignRevision: p.campaignRevision });
    }
    return out;
  }

  /** Applies a pure mutation and advances the CampaignRevision. */
  async edit(campaignId: string, mutate: (p: CampaignPrep) => CampaignPrep): Promise<CampaignPrep> {
    const cur = await this.load(campaignId);
    if (!cur) throw new Error(`No preparation for campaign ${campaignId}`);
    const next = mutate(JSON.parse(JSON.stringify(cur)) as CampaignPrep);
    const live = findLiveFields(next);
    if (live.length > 0) throw new Error(`Preparation must not contain live-session fields: ${live.join(', ')}`);
    next.campaignRevision = cur.campaignRevision + 1;
    next.updatedAt = this.now();
    await this.kv.set(PREP_PREFIX + campaignId, next);
    return next;
  }

  async remove(campaignId: string): Promise<void> {
    await this.kv.delete(PREP_PREFIX + campaignId);
  }
}

// ── Activation builders (prepared -> live payloads) ─────────────────────────

/** Public projection of a prepared encounter: names/coarse state only, never notes. */
export function toLiveEncounterInput(enc: PrepEncounter, liveId: string): LiveEncounterInput {
  return {
    id: liveId, name: enc.name,
    combatants: enc.combatants.filter(c => !c.hidden).map(c => ({
      id: c.id, name: c.name, hpState: c.hpState, visibility: STANDARD_MONSTER_VISIBILITY,
      ...(c.ac !== undefined ? { ac: c.ac } : {}),
    })),
  };
}

/**
 * Splits a prepared effect into what may travel to the Host and what must stay
 * on the DM's device. For 'secret' effects identity fields are stripped.
 */
export function toEffectInput(fx: PrepEffect, liveId: string): { input: EffectDefinitionInput; secret: SecretEffectMeta | null } {
  const secret = fx.visibility === 'secret';
  const input: EffectDefinitionInput = {
    id: liveId,
    name: secret ? null : fx.name,
    description: secret ? null : fx.description,
    source: secret ? null : fx.source,
    visibility: fx.visibility,
    components: fx.components.map(c => ({ ...c })),
    duration: fx.duration.unit === 'rounds' ? { ...fx.duration } : { unit: 'manual' },
  };
  return {
    input,
    secret: secret
      ? { effectId: liveId, name: fx.name, description: fx.description, source: fx.source,
          notes: fx.notes, hiddenDurationReason: fx.hiddenDurationReason }
      : null,
  };
}

/**
 * Prepared policy -> the wire shape a joining Player actually sees (CampaignPolicy). Pack names
 * for `requiredPackIds` are resolved HERE, from the DM's own installed-pack list — a joining
 * device may not have that pack at all, so it can't resolve a name for it itself; the DM's
 * device always can, since it's the one that set the requirement from its own pack list.
 */
export function toLivePolicyInput(
  prep: CampaignPrep, campaignId: string, name: string, installedPacks: { id: string; name: string }[],
): CampaignPolicy {
  const cm = prep.contentManifest;
  const packName = (id: string) => installedPacks.find(p => p.id === id)?.name ?? id;
  return {
    campaignId, name,
    ...(cm.rulesetId ? { rulesetId: cm.rulesetId } : {}),
    ...(cm.maxLevel !== undefined ? { maxLevel: cm.maxLevel } : {}),
    bannedPackIds: cm.bannedPackIds,
    bannedSubclassIds: cm.bannedSubclassIds,
    requiredPacks: cm.requiredPackIds.map(id => ({ id, name: packName(id) })),
  };
}

// ── Secret vault (DM-local, never sent to the Host) ──────────────────────────

const VAULT_PREFIX = 'session.vault.';

export class SecretVault {
  constructor(private readonly kv: KeyValueStore) {}
  put(meta: SecretEffectMeta): Promise<void> { return this.kv.set(VAULT_PREFIX + meta.effectId, meta); }
  get(effectId: string): Promise<SecretEffectMeta | null> { return this.kv.get<SecretEffectMeta>(VAULT_PREFIX + effectId); }
  async all(): Promise<Record<string, SecretEffectMeta>> {
    const out: Record<string, SecretEffectMeta> = {};
    for (const k of await this.kv.keys(VAULT_PREFIX)) {
      const m = await this.kv.get<SecretEffectMeta>(k);
      if (m) out[m.effectId] = m;
    }
    return out;
  }
}
