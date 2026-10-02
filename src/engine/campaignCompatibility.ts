// ============================================================================
// FILE: src/engine/campaignCompatibility.ts
// "Is this character compatible with this campaign?" — the join-time check
// from JOIN_SESSION_FLOW_SPEC.md: homebrew pack not allowed / level above
// campaign max / disallowed subclass / ruleset mismatch / missing required
// content. Pure, no I/O — callers (the Join modal, on the Player's own
// device, before joining) supply the character, the campaign's published
// policy, and this device's own installed-pack list.
//
// Deliberately never blocks joining — there's no reliable way for a Player
// to "fix" a character on the spot, and the spec itself says a mismatched
// character "can still join if the campaign policy allows grandfathered/
// approval-required characters." So this always just reports issues;
// whether to proceed anyway is the caller's decision to surface, same
// "disclosed, not silently repaired" posture as every other diagnostic in
// this app (see homebrewValidator.ts, packDiagnostics.ts).
// ============================================================================
import { Entity } from './types';
import { collectTypedContentRefs } from './packDiagnostics';
import { buildPackOwnershipIndex, InstalledPack } from '../db/packRegistryRepo';

/**
 * What a DM's prepared campaign (session/prep.ts's CampaignPrep.contentManifest) publishes to
 * the room once linked — public, non-secret policy a joining/peeking Player can check their
 * character against. Carried on LiveState.campaign, the dm.select_campaign op, the
 * campaign_linked event, AND the unauthenticated 'peek' reply (JOIN_SESSION_FLOW_SPEC.md: "show
 * it before joining rather than silently rewriting anything").
 */
export type MonsterVisibilityPreset = 'hidden' | 'minimal' | 'standard' | 'full';

export type CampaignPolicy = {
  campaignId:          string;
  name:                string;
  /** Plain string, not engine's RulesetId union — compared by plain equality below; keeps this
   *  type (and session/types.ts, which re-exports it onto the wire) decoupled from the full
   *  ruleset enum. */
  rulesetId?:          string;
  maxLevel?:           number | null;
  bannedPackIds:       string[];
  bannedSubclassIds:   string[];
  requiredPacks:       { id: string; name: string }[];
  /**
   * DM_SCREEN_SPEC.md item 11's Campaign Rules quick panel. All optional for backward
   * compatibility with a campaign linked before these existed — a missing field reads as the
   * stated default at each use site, never a migration. Four of these five mirror settings that
   * already exist fully built on the LEGACY Campaign/CampaignRules object (src/engine/
   * houseRules.ts's lockPlayerFreeEdit/homebrewNeedsApproval/permanentRewardsAutomatic/
   * ruleSuggestionsEnabled, set via the app/(tabs)/campaigns.tsx wizard) but were never wired to
   * the live session at all — that system and this one (CampaignPrep/CampaignPolicy) are
   * deliberately independent (see session/prep.ts's own file header), so these are fresh fields
   * on CampaignPrep, not a bridge into the legacy object.
   */
  monsterHpVisibilityDefault?: MonsterVisibilityPreset;
  /** Whether Players may freely edit their own character sheet without DM approval. DISPLAY-ONLY
   *  here — enforcing it is the character sheet screen's job (the legacy
   *  canPlayerFreeEdit(CampaignRules) check it already has), which this live layer has no
   *  equivalent gate for; a live session never stops a Player from editing their own local
   *  character regardless of this flag. Default true (matches canPlayerFreeEdit's own default). */
  freeEditAllowed?: boolean;
  /** Whether the DM must approve homebrew content before a Player can use it. DISPLAY-ONLY —
   *  homebrew approval happens at pack-install time, before a character ever joins a live
   *  session; there is no live-session-time gate this could enforce. Default false. */
  homebrewNeedsApproval?: boolean;
  /** CAMPAIGN_DM_AUTHORITY_RULES.md's "Permanent DM Rewards" policy — the gap Reward's own doc
   *  comment in session/types.ts calls out by name. ENFORCED: host.ts's dm.grant_reward
   *  auto-resolves a grant to ACCEPTED immediately when true, instead of leaving it PENDING for
   *  the Player's own accept/modify/reject. Default false (require Player approval). */
  permanentRewardsAutomatic?: boolean;
  /** Whether Players may suggest campaign-rule changes at all. ENFORCED: host.ts's
   *  player.suggest_rule rejects when false. Default true. */
  ruleSuggestionsEnabled?: boolean;
  /** Freeform short labels (e.g. "Flanking: advantage", "Crit = max + roll") — table-resolved and
   *  informational only, same as every other reminder-only setting in this app; there is no fixed
   *  taxonomy of "combat variants" defined anywhere in this codebase's own docs to encode as a
   *  closed enum instead. */
  combatVariants?: string[];
};

export type CompatibilityIssueKind = 'ruleset_mismatch' | 'level_cap' | 'banned_subclass' | 'banned_pack' | 'missing_pack';

export type CompatibilityIssue = {
  kind:    CompatibilityIssueKind;
  message: string;
};

/**
 * Compares one character against a campaign's published policy. `installedPacks` is THIS
 * device's own pack registry (src/db/packRegistryRepo.ts's loadInstalledPacks()) — used both to
 * resolve which pack a banned content ref came from, and to check `requiredPacks` (a pack the
 * campaign expects that this device doesn't have — the Host/DM side never sees this device's
 * registry, so this can only be checked here, on the joining device itself).
 */
export function checkCampaignCompatibility(
  entity: Entity,
  policy: CampaignPolicy,
  installedPacks: InstalledPack[],
): CompatibilityIssue[] {
  const issues: CompatibilityIssue[] = [];

  if (policy.rulesetId && entity.rulesetId && entity.rulesetId !== policy.rulesetId) {
    issues.push({
      kind: 'ruleset_mismatch',
      message: `This character is built for ${entity.rulesetId}, but the campaign runs ${policy.rulesetId}.`,
    });
  }

  if (typeof policy.maxLevel === 'number' && entity.identity.level > policy.maxLevel) {
    issues.push({
      kind: 'level_cap',
      message: `Level ${entity.identity.level} is above the campaign's cap of level ${policy.maxLevel}.`,
    });
  }

  const refs = collectTypedContentRefs(entity);

  if (policy.bannedSubclassIds.length > 0) {
    const banned = new Set(policy.bannedSubclassIds);
    const seen = new Set<string>();
    for (const r of refs) {
      if (r.type === 'subclass' && banned.has(r.id) && !seen.has(r.id)) {
        seen.add(r.id);
        issues.push({ kind: 'banned_subclass', message: `The subclass "${r.id}" isn't allowed in this campaign.` });
      }
    }
  }

  if (policy.bannedPackIds.length > 0) {
    const banned = new Set(policy.bannedPackIds);
    const ownership = buildPackOwnershipIndex(installedPacks);
    const seenPacks = new Set<string>();
    for (const r of refs) {
      const owner = ownership.get(`${r.type}:${r.id}`);
      if (owner && banned.has(owner.packId) && !seenPacks.has(owner.packId)) {
        seenPacks.add(owner.packId);
        issues.push({ kind: 'banned_pack', message: `Uses content from "${owner.packName}", which this campaign doesn't allow.` });
      }
    }
  }

  for (const required of policy.requiredPacks) {
    if (!installedPacks.some(p => p.id === required.id)) {
      issues.push({ kind: 'missing_pack', message: `This campaign expects the "${required.name}" pack, which isn't installed on this device.` });
    }
  }

  return issues;
}
