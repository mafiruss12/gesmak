/** Casiers / packs → bouteilles (unités de stock) */

export const COMMON_PACKAGE_SIZES = [6, 12, 20, 24, 32, 48] as const;

export function defaultUnitsPerPackage(product?: {
  units_per_package?: number | null;
  name?: string | null;
  packaging?: string | null;
}): number {
  const u = Number(product?.units_per_package);
  if (u > 0) return Math.floor(u);
  const blob = `${product?.name || ''} ${product?.packaging || ''}`.toLowerCase();
  for (const size of [48, 32, 24, 20, 12, 6]) {
    if (
      new RegExp(`casier\\s*${size}|carton\\s*${size}|pack\\s*${size}|x\\s*${size}|\\b${size}\\s*(bt|bout|bouteilles?)\\b`).test(
        blob,
      )
    ) {
      return size;
    }
  }
  return 12;
}

/** Quantité en bouteilles / unités de stock */
export function unitsFromPackages(packageCount: number, unitsPerPackage: number): number {
  const p = Math.max(0, Math.floor(Number(packageCount) || 0));
  const u = Math.max(1, Math.floor(Number(unitsPerPackage) || 1));
  return p * u;
}
