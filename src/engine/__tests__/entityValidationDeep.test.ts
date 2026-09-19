import { makeEmptyEntity, DEFAULT_RULES } from '../../store/characterStore';
import { validateEntityShape } from '../homebrewValidator';
import { ENTITY_VALIDATION_LIMITS } from '../entityValidation';
import { collectAllEffects, recomputeDerived } from '../pipeline';
import { removeCondition, tickDurations } from '../conditions';
import { takeRest } from '../rest';

const valid = () => makeEmptyEntity('deep-validation');
const resultAfter = (change: (entity: any) => void) => { const entity: any = valid(); change(entity); return validateEntityShape(entity); };

describe('canonical deep Entity validation', () => {
  it('accepts a complete Entity and every accepted baseline recomputes', () => {
    const entity = valid();
    expect(validateEntityShape(entity).valid).toBe(true);
    expect(() => recomputeDerived(entity, DEFAULT_RULES)).not.toThrow();
  });
  it.each([
    ['stats missing', (e: any) => { delete e.stats; }],
    ['resources missing', (e: any) => { delete e.resources; }],
    ['conditionMonitor missing', (e: any) => { delete e.conditionMonitor; }],
    ['conditionMonitor null', (e: any) => { e.conditionMonitor = null; }],
    ['conditionMonitor flags missing', (e: any) => { delete e.conditionMonitor.flags; }],
    ['conditionMonitor flags malformed', (e: any) => { e.conditionMonitor.flags = { rage: 'yes' }; }],
    ['derived malformed', (e: any) => { e.derived.attackBonuses = null; }],
    ['dmOverrides malformed', (e: any) => { e.dmOverrides = {}; }],
    ['wildShape malformed', (e: any) => { e.wildShapeState = { active: true }; }],
    ['hit dice malformed', (e: any) => { e.resources.hitDice.remaining = Infinity; }],
    ['nested action malformed', (e: any) => { e.features = [{ id: 'x', name: 'X', source: { kind: 'feat', refId: 'x' }, effects: [], actions: [{ id: 'a' }], choices: [] }]; }],
    ['nested choice malformed', (e: any) => { e.features = [{ id: 'x', name: 'X', source: { kind: 'feat', refId: 'x' }, effects: [], actions: [], choices: [{ id: 'c' }] }]; }],
    ['nested resource malformed', (e: any) => { e.resources.custom = [{ id: 'x', name: 'X', current: 2, maximum: 1 }]; }],
  ])('rejects %s', (_name, corrupt) => expect(resultAfter(corrupt).valid).toBe(false));
  it.each([NaN, Infinity, -Infinity, 'ten'])('rejects ability %p', value => expect(resultAfter(e => { e.stats.str = value; }).valid).toBe(false));
  it('rejects malformed classes', () => expect(resultAfter(e => { e.identity.classes = [{ level: 'one' }]; }).valid).toBe(false));
  it('rejects malformed entitlements', () => expect(resultAfter(e => { e.entitlements = [{ kind: 'unknown', key: 'x', sourceKind: 'class' }]; }).valid).toBe(false));
  it('rejects invalid normal and pact pools', () => {
    expect(resultAfter(e => { e.spellcasting = { ability: 'int', known: [], prepared: [], cantrips: [], slots: { '1': { total: 1, used: 2 } } }; }).valid).toBe(false);
    expect(resultAfter(e => { e.spellcasting = { ability: 'cha', known: [], prepared: [], cantrips: [], slots: {}, pactSlots: { '10': { total: 1, used: 2 } } }; }).valid).toBe(false);
  });
  it('rejects malformed inventory', () => expect(resultAfter(e => { e.inventory.carried = [{ itemId: 'x', quantity: Infinity, attuned: 'no', features: [] }]; }).valid).toBe(false));
  it.each([
    ['null entry', null], ['number entry', 42], ['missing id', { sourceId: 'manual', duration: null, suppressedBy: [] }],
    ['empty id', { id: '', sourceId: 'manual', duration: null, suppressedBy: [] }],
    ['bad source', { id: 'poisoned', sourceId: 42, duration: null, suppressedBy: [] }],
    ['duration wrong type', { id: 'poisoned', sourceId: 'manual', duration: 'rounds', suppressedBy: [] }],
    ['unknown duration unit', { id: 'poisoned', sourceId: 'manual', duration: { unit: 'turns', remaining: 1 }, suppressedBy: [] }],
    ['nonfinite remaining', { id: 'poisoned', sourceId: 'manual', duration: { unit: 'rounds', remaining: Infinity }, suppressedBy: [] }],
    ['negative remaining', { id: 'poisoned', sourceId: 'manual', duration: { unit: 'rounds', remaining: -1 }, suppressedBy: [] }],
    ['bad suppressedBy', { id: 'poisoned', sourceId: 'manual', duration: null, suppressedBy: [42] }],
  ])('deeply validates every active condition entry: %s', (_label, condition) => {
    expect(resultAfter(e => { e.conditionMonitor.active = [condition]; }).valid).toBe(false);
  });
  it('accepts a complex active condition across recompute, effect collection, ticking, removal, and rest', () => {
    const entity: any = valid();
    entity.conditionMonitor.active = [{ id: 'poisoned', sourceId: 'trap-1', duration: { unit: 'rounds', remaining: 3, expiresAt: 9 }, suppressedBy: ['immunity-1'] }];
    entity.conditions = JSON.parse(JSON.stringify(entity.conditionMonitor.active));
    expect(validateEntityShape(entity).valid).toBe(true);
    expect(() => collectAllEffects(entity)).not.toThrow();
    expect(() => recomputeDerived(entity, DEFAULT_RULES)).not.toThrow();
    expect(() => tickDurations(entity, DEFAULT_RULES)).not.toThrow();
    expect(() => removeCondition(entity, 'poisoned', DEFAULT_RULES)).not.toThrow();
    expect(() => takeRest(entity, 'long', DEFAULT_RULES)).not.toThrow();
  });
  it('rejects oversized collections', () => expect(resultAfter(e => { e.entitlements = Array.from({ length: ENTITY_VALIDATION_LIMITS.maxEntitlements + 1 }, (_, i) => ({ kind: 'language', key: String(i), sourceKind: 'manual' })); }).valid).toBe(false));
});
