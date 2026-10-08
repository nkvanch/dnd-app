import { filterSpellsForClass, spellSourceLabel } from '../spellLists';
import { collectContentDependencies } from '../../engine/contentDependencies';
import { rewriteContentReferences } from '../../engine/packageConflicts';
import { CharClass, SpellList } from '../../engine/types';

const spells = [
  { id: 'a', classes: ['wizard'] }, { id: 'b', classes: ['cleric'] }, { id: 'c', classes: ['myclass'] }, { id: 'd' },
];
const lists: SpellList[] = [{ id: 'mine', name: 'My List', spellIds: ['b', 'c'] }];
const ids = (xs: { id: string }[]) => xs.map(x => x.id);

describe('a class\'s default spell source', () => {
  it('with no source it keeps using the class\'s own tagged spells (and untagged ones)', () => {
    expect(ids(filterSpellsForClass(spells, 'myclass', null, lists))).toEqual(['c', 'd']);
  });

  it('an existing Spell List replaces the class pool by default', () => {
    expect(ids(filterSpellsForClass(spells, 'myclass', null, lists, { kind: 'list', listId: 'mine' }))).toEqual(['b', 'c']);
  });

  it('another class\'s list can be borrowed', () => {
    expect(ids(filterSpellsForClass(spells, 'myclass', null, lists, { kind: 'class', classId: 'wizard' }))).toEqual(['a', 'd']);
  });

  it('a list the player picks while choosing still wins over the class default', () => {
    expect(ids(filterSpellsForClass(spells, 'myclass', 'mine', lists, { kind: 'class', classId: 'wizard' }))).toEqual(['b', 'c']);
  });

  it('a deleted list falls back to the class\'s own pool instead of showing nothing', () => {
    expect(ids(filterSpellsForClass(spells, 'myclass', null, [], { kind: 'list', listId: 'gone' }))).toEqual(['c', 'd']);
  });

  it('labels the source for the picker', () => {
    expect(spellSourceLabel({ kind: 'list', listId: 'mine' }, lists, [])).toBe('My List');
    expect(spellSourceLabel({ kind: 'class', classId: 'wizard' }, lists, [{ id: 'wizard', name: 'Wizard' }])).toBe('Wizard spell list');
    expect(spellSourceLabel(undefined, lists, [])).toBeNull();
  });
});

describe('exporting a class that uses a Spell List', () => {
  const cls = { id: 'myclass', name: 'My Class', hitDie: 8, features: [], spellListSource: { kind: 'list', listId: 'mine' } } as CharClass;

  it('the list travels with the class as a dependency', () => {
    expect(collectContentDependencies('class', cls)).toContainEqual({ type: 'spellList', id: 'mine' });
    expect(collectContentDependencies('class', { ...cls, spellListSource: { kind: 'class', classId: 'wizard' } } as CharClass))
      .toContainEqual({ type: 'class', id: 'wizard' });
  });

  it('a renamed list is followed on import', () => {
    const remap = new Map([['spellList:mine', 'mine_copy']]);
    const out = rewriteContentReferences('class', cls, remap) as CharClass;
    expect(out.spellListSource).toEqual({ kind: 'list', listId: 'mine_copy' });
  });
});
