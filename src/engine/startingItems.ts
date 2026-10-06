// A starting-equipment entry is an item id, or `id*N` for N of a stackable item (`parchment*10`) in one inventory row.
// Kept free of imports so build scripts can use it without pulling in the engine.
export function parseStartingItem(entry: string): { itemId: string; quantity: number } {
  const m = /^(.+)\*(\d+)$/.exec(entry);
  return m ? { itemId: m[1], quantity: Math.max(1, Number(m[2])) } : { itemId: entry, quantity: 1 };
}
