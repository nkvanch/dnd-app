// The trait editor UI itself offers the mechanics the engine supports (stress-test finding): speed/initiative/
// saves, weapon/armor proficiency, condition immunity, a scalable save DC, and honest recharge choices.
jest.mock('../../../content/spellRepo', () => jest.requireActual('../../../content/spellRepo.ts'));
jest.mock('../../../content/itemRepo', () => jest.requireActual('../../../content/itemRepo.ts'));

import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { TraitEditorModal, newDraftTrait } from '../TraitEditor';
import type { DraftTrait } from '../../../engine/types';

function textsOf(trait: DraftTrait): string[] {
  let r!: TestRenderer.ReactTestRenderer;
  act(() => {
    r = TestRenderer.create(
      <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 400, height: 800 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } }}>
        <TraitEditorModal trait={trait} visible onChange={() => {}} onDone={() => {}} onDelete={() => {}} />
      </SafeAreaProvider>,
    );
  });
  const out: string[] = [];
  const walk = (n: unknown) => {
    if (typeof n === 'string') { out.push(n); return; }
    if (!n || typeof n !== 'object') return;
    const node = n as { children?: unknown[] };
    (node.children ?? []).forEach(walk);
  };
  walk(r.toJSON());
  return out;
}
const has = (texts: string[], needle: string) => texts.some(t => t.includes(needle));
const draft = (patch: Partial<DraftTrait>): DraftTrait => ({ ...newDraftTrait('T'), ...patch });

describe('effect kinds offered', () => {
  const texts = textsOf(draft({}));
  it.each(['Speed, initiative, saves & more', 'Weapon/armor proficiency', 'Condition immunity'])('offers "%s"', label => {
    expect(has(texts, label)).toBe(true);
  });
  it('still offers the original kinds', () => {
    for (const label of ['Ability score bonus', 'AC bonus (+N, stacks)', 'Skill proficiency', 'Resistance', 'Limited-use ability', 'Flavor only']) expect(has(texts, label)).toBe(true);
  });
});

describe('stat modifier panel', () => {
  it('speed offers bonus, set and multiply', () => {
    const t = textsOf(draft({ effectKind: 'stat_bonus', statTarget: 'speed' }));
    for (const s of ['Walking speed', 'Initiative', 'Saving throws', 'Bonus (+N)', 'Set to N', 'Multiply (×N)']) expect(has(t, s)).toBe(true);
  });
  it('a stat without set/multiply support does not offer them (spell save DC)', () => {
    const t = textsOf(draft({ effectKind: 'stat_bonus', statTarget: 'spell_save_dc' }));
    expect(has(t, 'Set to N')).toBe(false);
    expect(has(t, 'Multiply (×N)')).toBe(false);
  });
});

describe('gear proficiency and condition immunity panels', () => {
  it('armor choices', () => {
    const t = textsOf(draft({ effectKind: 'gear_proficiency', gearKind: 'armor' }));
    for (const s of ['Light armor', 'Medium armor', 'Heavy armor', 'Shields']) expect(has(t, s)).toBe(true);
  });
  it('weapon choices', () => {
    const t = textsOf(draft({ effectKind: 'gear_proficiency', gearKind: 'weapon', gearName: 'martial' }));
    for (const s of ['Simple weapons', 'Martial weapons']) expect(has(t, s)).toBe(true);
  });
  it('condition list', () => {
    const t = textsOf(draft({ effectKind: 'condition_immunity' }));
    for (const s of ['Poisoned', 'Charmed', 'Frightened', 'Stunned']) expect(has(t, s)).toBe(true);
  });
});

describe('limited-use ability: save DC and recharge', () => {
  it('offers a save toggle, and its DC choices once enabled', () => {
    expect(has(textsOf(draft({ effectKind: 'resource_ability' })), 'Targets make a saving throw against this')).toBe(true);
    const on = textsOf(draft({ effectKind: 'resource_ability', saveEnabled: true }));
    for (const s of ['8 + proficiency + ability', 'Spell save DC', 'Fixed number', 'Grows with the character']) expect(has(on, s)).toBe(true);
  });
  it('a fixed DC shows a number field hint instead of the scaling note', () => {
    const t = textsOf(draft({ effectKind: 'resource_ability', saveEnabled: true, saveDcMode: 'fixed' }));
    expect(has(t, 'Never changes with level')).toBe(true);
  });
  it('recharge has Dawn as a real option and labels Other as manual, with honest help text', () => {
    const t = textsOf(draft({ effectKind: 'resource_ability', recharge: 'dawn' }));
    expect(has(t, 'Dawn')).toBe(true);
    expect(has(t, 'Other (manual)')).toBe(true);
    expect(has(t, "Restored by the sheet's ☀ Dawn button, not by a rest.")).toBe(true);
    const o = textsOf(draft({ effectKind: 'resource_ability', recharge: 'other' }));
    expect(has(o, 'Not restored automatically: tap + on the sheet when it recharges.')).toBe(true);
  });
  it('the limited-use overlay on another kind also offers the save DC', () => {
    expect(has(textsOf(draft({ effectKind: 'damage_resistance', limitedUse: true })), 'Targets make a saving throw against this')).toBe(true);
  });
});
