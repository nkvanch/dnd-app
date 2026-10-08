// ============================================================================
// FILE: src/content/homebrewPack/pressureVault.ts
// "The Pressure Vault" (docs/homebrew/PREPARED_ENCOUNTER_PRESSURE_VAULT.md) as a reusable prepared
// encounter TEMPLATE (no campaignId): one Glassback, a PUBLIC Unstable Pressure hazard, a SECRET
// Resonant Fracture hazard, the DM-only motive note, and the Weight of Authority Tier I reward.
// It is seeded once by the encounter store (see encounterStore.ts's seedBuiltinEncounters) and is
// inactive until the DM starts it.
//
// Not modelled (the spec itself marks these table-resolved): exact map geometry, how much mineral
// material distracts the Glassback, and the hidden Collapse Counter, which the DM keeps in the notes.
// ============================================================================
import { PreparedEncounter } from '../../engine/types';

export const PRESSURE_VAULT_ID = 'builtin_pressure_vault';

export function pressureVaultEncounter(now: number = Date.now()): PreparedEncounter {
  return {
    id: PRESSURE_VAULT_ID,
    name: 'The Pressure Vault',
    description:
      'Deep beneath an abandoned mining complex lies a sealed high-pressure cavern. A living Glassback has followed an exposed ore vein ' +
      'upward and, at ordinary pressure, is increasingly unstable, confused, and desperate to reach deeper ground. It is not evil and is ' +
      'not hunting the party for food: it seeks metal, salt, crystal, ore, and deeper pressure. Reward players who realize this.',
    location: 'Abandoned mining complex, sealed high-pressure cavern',
    tags: ['demo', 'stress-test', 'environmental', 'levels 6-8'],
    status: 'ready',
    expectedPartyNote: '4 characters, roughly levels 6-8',
    combatants: [
      {
        id: 'pc_pressure_vault_glassback',
        monsterId: 'glassback',
        displayName: 'Glassback',
        quantity: 1,
        hpMode: 'average',
        startingResources: { glassback_pressure: 2 },
        notes: 'Place near the far mineral wall. It starts at 2 Pressure (ordinary surface pressure). Below about one-third HP it prioritizes escape toward the deeper eastern tunnel.',
      },
    ],
    groups: [],
    waves: [],
    environment: [
      {
        id: 'env_unstable_pressure',
        label: 'Unstable Pressure',
        visibility: 'public',
        description:
          'The vault is partially depressurized by mining damage. Stone groans, loose objects vibrate, and the central fractured zone is difficult terrain. ' +
          'A creature that Dashes through the fractured zone must succeed on a DC 12 Dexterity check or fall prone.',
      },
      {
        id: 'env_resonant_fracture',
        label: 'Resonant Fracture (secret)',
        visibility: 'secret',
        description:
          'The roof is close to structural failure. Whenever any creature deals 10 or more thunder damage in the chamber (or a large explosive/bludgeoning ' +
          'impact occurs, at your discretion) raise the hidden Collapse Counter by 1. At 3, the ceiling partially fails: each creature makes a DC 14 Dexterity ' +
          'save, taking 2d10 bludgeoning and falling prone on a failure (half damage, not prone on a success), and one random 10-foot area is blocked by rubble. ' +
          'The Glassback is not immune. Keep the counter on your side of the screen; reveal it only when it triggers or the party investigates.',
      },
    ],
    dmNotes:
      'WHAT THE GLASSBACK WANTS (DM only): it is trying to reach the deeper eastern tunnel and attacks mainly because the party is between it and that route or ' +
      'carries rich mineral gear. Target priority: 1) exposed ore, crystal, salt, or metal stores; 2) heavily armored creatures; 3) creatures blocking the deeper ' +
      'tunnel; 4) creatures that have seriously injured it; 5) lightly equipped creatures only when necessary. If a character drops or throws a significant quantity of ' +
      'metal, salt, crystal, or ore away from the party, it may spend its next turn investigating or consuming it. Given a clear route toward deeper pressure it retreats ' +
      'rather than fight to the death. Do not show this to players unless they infer it.\n\n' +
      'COLLAPSE COUNTER: 0 / 3 (tick manually, see Resonant Fracture).\n\n' +
      'OPTIONAL: the Standard of the Unyielding Line sits wedged in a reinforced staging platform, unattuned and unplanted. Braced can be applied to two or more ' +
      'characters to show a per-target effect lifecycle. Anchor of Command (Hold Fast) and Command the Field both play well against the fractured ground.',
    tacticsNotes:
      'Round 1: identify the richest mineral target; close with a heavily armored character; Abrasive Jet if two or more creatures line up. Round 2: if the party blocks ' +
      'the eastern tunnel, Forelimb Crush to make space; if Pressure has fallen, choose between Compress, fighting on, or retreating. It is not a suicidal boss.',
    victoryNotes:
      'Valid resolutions: kill it (Pressure Collapse triggers), drive it deeper by opening the tunnel and stopping the threat, distract it with enough mineral ' +
      'material, or let the Collapse force a retreat. Salvage (generic): ceramic shell plates, crystallized fluid, mineral nodules, pressure-stable crystal, abrasive residue.',
    rewards: [
      {
        id: 'rwd_weight_of_authority_t1',
        kind: 'custom',
        label: "Optional: grant Weight of Authority, Tier I: Recognized Presence (the + Reward button on the character's Features tab)",
      },
      { id: 'rwd_standard', kind: 'item', label: 'Standard of the Unyielding Line (recoverable treasure)', itemId: 'standard_of_the_unyielding_line' },
    ],
    createdAt: now,
    updatedAt: now,
  };
}
