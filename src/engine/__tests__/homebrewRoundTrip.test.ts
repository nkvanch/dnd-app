import { mergeHomebrewDefinition, mergeSubclassDefinition } from '../homebrewRoundTrip';

const feature = {
  id: 'complex_feature', name: 'Complex', description: 'desc',
  source: { kind: 'feat', refId: 'complex' }, level: null,
  effects: [{ type: 'stat_modifier', target: 'ac', operation: 'add', value: 1, condition: null }],
  actions: [{ id: 'action', name: 'Action' }], choices: [{ id: 'choice' }], passive: false,
  activation: { actionType: 'bonus_action', resourceCost: { resourceId: 'pool', quantity: 1 } },
  extensionMechanic: { preserved: true },
};

describe('lossless homebrew editor merge boundary', () => {
  it('Feat no-change and rename-only preserve every mechanic and extension field', () => {
    const original = {
      id: 'feat', name: 'Old', prerequisite: 'Level 4', description: 'D', source: 'Imported',
      feature, abilityChoice: { options: ['str'], amount: 1 },
      skillChoice: { picks: [{ id: 'p', label: 'P', mode: 'expertise', from: 'proficient' }] },
      pendingChoices: [{ id: 'pending', grants: [{ kind: 'resource', value: { resourceId: 'pool', maximum: 2 } }] }],
      rulesetId: 'dnd5e-2024', importedExtension: { keep: ['x'] },
    };
    expect(mergeHomebrewDefinition(original, { ...original })).toEqual(original);
    expect(mergeHomebrewDefinition(original, { ...original, name: 'New' }))
      .toEqual({ ...original, name: 'New' });
  });

  it('Subclass rename-only preserves multi-level features, resources, choices, and unsupported progression data', () => {
    const entries = [
      { level: 3, hpDie: 10, grants: [{ kind: 'feature', value: feature }, { kind: 'resource', value: { resourceId: 'pool', maximum: 2 } }], choices: [{ id: 'pick' }], imported: true },
      { level: 7, hpDie: 10, grants: [{ kind: 'spell_access', value: { spellId: 'shield' } }], choices: [] },
    ];
    const original = { id: 'sub', name: 'Old', classId: 'fighter', entries, rulesetId: 'dnd5e-2014', sourceMeta: { pack: 'import' } };
    const rebuilt = { ...original, name: 'New', entries: [] };
    expect(mergeSubclassDefinition(original, rebuilt, false)).toEqual({ ...original, name: 'New' });
  });

  it('Monster rename-only preserves structured combat sections the editor does not own', () => {
    const original = {
      id: 'monster', name: 'Old', cr: 12, size: 'large', type: 'dragon', alignment: 'neutral',
      stats: { str: 20, dex: 12, con: 18, int: 16, wis: 14, cha: 18 },
      hp: { dice: '20d10+80', average: 190 }, ac: { value: 19, source: 'natural' }, speed: 40,
      features: [feature], savingThrows: ['dex'], skills: { perception: 8 }, senses: ['blindsight 60 ft'],
      languages: ['Draconic'], legendaryActions: 3, lairActions: [feature],
      bonusActions: [{ id: 'bonus' }], reactions: [{ id: 'reaction' }], spellcasting: { ability: 'cha' },
      resources: [{ resourceId: 'breath', maximum: 1 }], rulesetId: 'dnd5e-2014',
    };
    expect(mergeHomebrewDefinition(original, { ...original, name: 'New' }))
      .toEqual({ ...original, name: 'New' });
  });

  it('Class rename and represented-field edits preserve raw progression, multiclass package, and level choices', () => {
    const original = {
      id: 'class', name: 'Old', hitDie: 8, features: [feature], description: 'Old description',
      rawProgression: { classId: 'class', entries: [{ level: 1, grants: [{ kind: 'resource', value: { resourceId: 'focus', maximum: 2 } }], choices: [] }] },
      multiclassProficiencies: { armor: ['light'], weapons: ['simple'] },
      levelChoices: [{ level: 2, choices: [{ id: 'expertise' }] }],
      levelFeatures: [{ level: 1, name: 'Focus' }], asiLevels: [4, 8], casterContribution: 'full',
      importedExtension: { slotTable: [2, 3, 4] },
    };
    const renamed = mergeHomebrewDefinition(original, { ...original, name: 'New' });
    expect(renamed.rawProgression).toEqual(original.rawProgression);
    expect(renamed.multiclassProficiencies).toEqual(original.multiclassProficiencies);
    expect(renamed.levelChoices).toEqual(original.levelChoices);
    const edited = mergeHomebrewDefinition(original, { ...original, description: 'Changed' });
    expect(edited.rawProgression).toEqual(original.rawProgression);
    expect(edited.importedExtension).toEqual(original.importedExtension);
  });

  it.each(['Condition', 'Race', 'Subrace', 'Background', 'Item', 'Spell', 'Feature'])(
    '%s rename-only preserves unsupported valid fields and nested homebrew draft extensions', type => {
      const original: Record<string, unknown> = {
        id: type.toLowerCase(), name: 'Old', features: [feature], rulesetId: 'dnd5e-2024',
        homebrewDraft: { represented: 'value', unsupportedDraftField: { keep: true } },
        unsupportedRuntimeField: { keep: true },
      };
      const renamed = mergeHomebrewDefinition(original, {
        ...original, name: 'New', homebrewDraft: { represented: 'value' },
      });
      expect(renamed).toEqual({ ...original, name: 'New' });
    },
  );
});
