// src/components/sheet/__tests__/favorites.test.ts
// Real bug (user report: "in actions I can't choose favorite"): toggling a
// spell-based or synthetic (Unarmed Strike) action card's favorite star
// silently did nothing — Feature.favoriteTag is the only place favorite
// state used to live, and neither of those card types has a backing
// Feature object to store it on (ActionCard.featureId for a spell card is
// the SPELL's id, e.g. 'fire_bolt' — never a Feature.id). Fixed by moving
// favorite state to Entity.favoriteActionIds, keyed by featureId directly,
// independent of whatever (if anything) backs the card.
import { makeEmptyEntity } from '../../../store/characterStore';
import { toggleFavoriteTag, isFavoriteCard } from '../TabActions';
import { Feature } from '../../../engine/types';

function feature(id: string): Feature {
  return {
    id, name: id, description: '', source: { kind: 'class', refId: 'test' },
    level: null, effects: [], actions: [], choices: [], passive: true,
  };
}

describe('toggleFavoriteTag / isFavoriteCard', () => {
  it('favorites a spell-based card (no backing Feature exists) — the reported bug', () => {
    const e = makeEmptyEntity('e1');
    expect(isFavoriteCard(e, 'fire_bolt')).toBe(false);
    const updated = toggleFavoriteTag(e, 'fire_bolt');
    expect(isFavoriteCard(updated, 'fire_bolt')).toBe(true);
    expect(updated.favoriteActionIds).toEqual(['fire_bolt']);
  });

  it('favorites a synthetic card with no backing Feature at all (Unarmed Strike)', () => {
    const e = makeEmptyEntity('e1');
    const updated = toggleFavoriteTag(e, 'unarmed_strike');
    expect(isFavoriteCard(updated, 'unarmed_strike')).toBe(true);
  });

  it('still favorites a Feature-backed card (regression check — this path already worked)', () => {
    const e = { ...makeEmptyEntity('e1'), features: [{ ...feature('second_wind'), isActive: true }] };
    const updated = toggleFavoriteTag(e, 'second_wind');
    expect(isFavoriteCard(updated, 'second_wind')).toBe(true);
    expect(updated.favoriteActionIds).toEqual(['second_wind']);
  });

  it('toggling twice un-favorites', () => {
    const e = makeEmptyEntity('e1');
    const on  = toggleFavoriteTag(e, 'fire_bolt');
    const off = toggleFavoriteTag(on, 'fire_bolt');
    expect(isFavoriteCard(off, 'fire_bolt')).toBe(false);
    expect(off.favoriteActionIds).toEqual([]);
  });

  it('honors a legacy Feature.favoriteTag=true from a character saved before favoriteActionIds existed', () => {
    const e = { ...makeEmptyEntity('e1'), features: [{ ...feature('rage'), isActive: true, favoriteTag: true }] };
    expect(isFavoriteCard(e, 'rage')).toBe(true);
  });

  it('toggling off a legacy favoriteTag clears it (not just adding a no-op favoriteActionIds entry)', () => {
    const e = { ...makeEmptyEntity('e1'), features: [{ ...feature('rage'), isActive: true, favoriteTag: true }] };
    const updated = toggleFavoriteTag(e, 'rage');
    expect(isFavoriteCard(updated, 'rage')).toBe(false);
    expect(updated.features.find(f => f.id === 'rage')?.favoriteTag).toBe(false);
  });
});
