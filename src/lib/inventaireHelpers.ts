/** Helpers UI inventaire (extrait de la page pour alléger le bundle page) */

export function aiStockStatus(
  stock: number,
  min: number,
): { label: string; color: 'error' | 'warning' | 'success' | 'primary' } {
  if (stock <= 0) return { label: 'RUPTURE', color: 'error' };
  if (stock <= min) return { label: 'À COMMANDER', color: 'warning' };
  if (stock <= min * 1.5) return { label: 'SURVEILLER', color: 'primary' };
  return { label: 'OK', color: 'success' };
}

export function sortProductsByName<T extends { name?: string | null }>(list: T[]): T[] {
  return [...list].sort((a, b) =>
    String(a.name || '').localeCompare(String(b.name || ''), 'fr', { sensitivity: 'base' }),
  );
}

export function filterProductsBySearch<T extends { name?: string | null; category?: string | null; brand?: string | null }>(
  list: T[],
  search: string,
): T[] {
  const q = search.trim().toLowerCase();
  if (!q) return list;
  return list.filter((p) => {
    const hay = `${p.name || ''} ${p.category || ''} ${p.brand || ''}`.toLowerCase();
    return hay.includes(q);
  });
}
