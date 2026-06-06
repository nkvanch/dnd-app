// ============================================================================
// FILE: src/theme.ts
// Centralized design tokens. Import this everywhere — never hardcode colors.
// ============================================================================

export const Colors = {
  // Backgrounds
  bg:          '#0f0f1a',   // deepest background
  surface:     '#1a1a2e',   // card / sheet surfaces
  surfaceHigh: '#222240',   // elevated surface (modals, headers)
  border:      '#2e2e50',   // subtle dividers

  // Accent
  gold:        '#c9a84c',   // primary action, headers
  goldDim:     '#7a6530',   // inactive / muted gold
  red:         '#c0392b',   // HP, danger
  redDim:      '#7a2020',
  blue:        '#2e86c1',   // spell slots, magic
  blueDim:     '#1a4a6e',
  green:       '#27ae60',   // healing, success
  greenDim:    '#1a6e3a',
  purple:      '#8e44ad',   // conditions, effects

  // Text
  textPrimary:   '#f0e6d3',  // parchment-ish white
  textSecondary: '#9a8f7a',  // muted label
  textDim:       '#5a5a7a',  // placeholder / disabled

  // Utility
  white:       '#ffffff',
  transparent: 'transparent',
};

export const Spacing = {
  xs:  4,
  sm:  8,
  md:  16,
  lg:  24,
  xl:  32,
  xxl: 48,
};

export const Radius = {
  sm: 6,
  md: 10,
  lg: 16,
  full: 999,
};

export const FontSize = {
  xs:   11,
  sm:   13,
  md:   15,
  lg:   18,
  xl:   22,
  xxl:  28,
  hero: 36,
};

export const FontWeight = {
  normal:  '400' as const,
  medium:  '500' as const,
  bold:    '700' as const,
  black:   '900' as const,
};
