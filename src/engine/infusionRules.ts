// Max simultaneously-infused items, from the Artificer's Infuse Item table (a rule, not catalog content, so it lives in the engine).
export function maxInfusedItems(artificerLevel: number): number {
  if (artificerLevel >= 18) return 6;
  if (artificerLevel >= 14) return 5;
  if (artificerLevel >= 10) return 4;
  if (artificerLevel >= 6)  return 3;
  if (artificerLevel >= 2)  return 2;
  return 0;
}
