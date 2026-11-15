import { supabase } from '@/lib/supabase';
import { getSeedCatalog } from '@/lib/catalogs';
import { ensureProductImageCatalog, lookupCatalogImage } from '@/lib/productImages';

/**
 * Catalogue de démarrage pour un nouvel établissement.
 * Toutes les quantités sont à 0 — le propriétaire saisit le stock réel ensuite.
 * Ne duplique pas si des produits existent déjà.
 */
export async function seedDefaultStockForEstablishment(
  establishmentId: string,
  businessType: string | null | undefined,
): Promise<{ inserted: number; error?: string }> {
  if (!establishmentId) return { inserted: 0, error: 'établissement manquant' };

  const { count, error: countErr } = await supabase
    .from('products')
    .select('id', { count: 'exact', head: true })
    .eq('establishment_id', establishmentId);

  if (countErr) return { inserted: 0, error: countErr.message };
  if ((count ?? 0) > 0) return { inserted: 0 }; // déjà du stock / catalogue

  await ensureProductImageCatalog();
  const catalog = getSeedCatalog(businessType);
  const rows = catalog.map((s) => ({
    name: s.name,
    category: s.category,
    unit: s.unit,
    stock: 0, // toujours 0 au démarrage
    min_stock: s.min_stock,
    cost: s.cost,
    price: s.price,
    establishment_id: establishmentId,
    units_per_package: s.units_per_package ?? 12,
    image_url: lookupCatalogImage(s.name) || null,
  }));

  // insert par paquets
  let inserted = 0;
  for (let i = 0; i < rows.length; i += 40) {
    const chunk = rows.slice(i, i + 40);
    const { error } = await supabase.from('products').insert(chunk);
    if (error) return { inserted, error: error.message };
    inserted += chunk.length;
  }
  return { inserted };
}
