// ============================================================================
// FILE: src/session/fixtures.ts
// Deterministic DM-preparation fixture ("Automation Campaign") used by the
// in-process tests and, behind the E2E flag only, by the Android automation.
// Names/ids are fixed so scripted flows and assertions can rely on them.
// ============================================================================
import { CampaignPrep } from './prep';

export const AUTOMATION_CAMPAIGN_ID = 'camp-auto';
export const AUTOMATION_CAMPAIGN_NAME = 'Automation Campaign';

export function applyAutomationFixture(p: CampaignPrep): CampaignPrep {
  p.encounters.push({
    id: 'enc-bridge', name: 'Bridge Ambush', dmNotes: 'SECRET: the troll is the bridge warden in disguise',
    combatants: [
      { id: 'c1', name: 'Bandit', hpState: 'healthy', ac: 12, dmNotes: 'carries the ransom letter' },
      { id: 'c2', name: 'Bandit Captain', hpState: 'healthy', ac: 15, dmNotes: 'is a doppelganger' },
    ],
  });
  p.effects.push({
    id: 'fx-blessing', name: 'Blessing', description: 'Divine favour', source: 'Cleric', notes: '', hiddenDurationReason: '',
    visibility: 'public', components: [{ stat: 'save', operation: 'add', value: 1 }], duration: { unit: 'rounds', total: 10, remaining: 3 },
  });
  p.effects.push({
    id: 'fx-curse', name: 'Hidden Curse', description: 'DM ONLY: the amulet is cursed', source: 'Cursed amulet',
    notes: 'reveal at level 5', hiddenDurationReason: 'until remove curse', visibility: 'secret',
    components: [{ stat: 'ac', operation: 'add', value: -1 }], duration: { unit: 'manual' },
  });
  p.templates.push({ id: 'tpl-exh', label: 'Exhaustion Increase', changes: [{ kind: 'exhaustion', delta: 1 }] });
  p.notes.push({ id: 'n1', text: 'automation fixture note', dmOnly: true });
  p.plans.push({ id: 'plan1', name: 'Session 1', encounterIds: ['enc-bridge'], effectIds: ['fx-blessing', 'fx-curse'], templateIds: ['tpl-exh'], notes: '' });
  return p;
}
