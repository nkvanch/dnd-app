// src/__tests__/theme.test.ts
// Creation-flow safe-area closure: locks in scrollBottomPadding's contract —
// a physical Android device (3-button navigation) confirmed that a creation
// screen's terminal CTA (Continue/Select/Confirm/Save), rendered with only
// the ordinary design-system bottom spacing, can end up underneath the
// system navigation bar's touch-interception zone, swallowing taps meant
// for the app. This is the one pure, directly-testable piece of that fix —
// the RN component rendering itself has no existing render-test harness in
// this codebase, and the task this closes explicitly said not to build one
// just for this.
import { Spacing, scrollBottomPadding } from '../theme';

describe('scrollBottomPadding', () => {
  it('insets.bottom = 0 (no device inset) preserves the existing visual spacing exactly', () => {
    expect(scrollBottomPadding(0)).toBe(Spacing.xxl);
  });

  it('insets.bottom > 0 increases total bottom spacing by exactly that inset, on top of the visual spacing', () => {
    expect(scrollBottomPadding(133)).toBe(Spacing.xxl + 133);
    expect(scrollBottomPadding(45)).toBe(Spacing.xxl + 45);
  });

  it('never hardcodes a pixel value in place of the real inset — output scales linearly with whatever inset is passed', () => {
    const a = scrollBottomPadding(20);
    const b = scrollBottomPadding(40);
    expect(b - a).toBe(20);
  });

  it('accepts an explicit visualSpacing override for a caller with different base spacing than Spacing.xxl', () => {
    expect(scrollBottomPadding(30, Spacing.lg)).toBe(Spacing.lg + 30);
  });

  it('keeps a bottom-anchored CTA\'s existing footer spacing and adds the system inset', () => {
    expect(scrollBottomPadding(0, Spacing.md)).toBe(Spacing.md);
    expect(scrollBottomPadding(133, Spacing.md)).toBe(Spacing.md + 133);
  });
});
