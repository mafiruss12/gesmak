import type { BusinessType } from './businessTypes';
import { normalizeBusinessType } from './businessTypes';

export type SeedProduct = {
  name: string;
  category: string;
  unit: string;
  stock: number;
  min_stock: number;
  cost: number;
  price: number;
  /** Marque (Solibra, Brassivoire, Carré d'Or, Autre…) — style Makaya */
  brand?: string;
  /** Ex. Casier 24 - Bière blonde */
  packaging?: string;
  units_per_package?: number;
};

/** Uniquement maquis / boissons : logique casiers */
export function usesCasiers(type: string | null | undefined): boolean {
  // restaurant : casiers seulement si besoin bar — par défaut portions
  const t = normalizeBusinessType(type);
  return t === 'maquis';
}

export function casierSize(type: string | null | undefined): number {
  return usesCasiers(type) ? 24 : 0;
}

/** Infère la marque à partir du nom (style Makaya). */
export function inferBrand(name: string): string {
  const n = (name || '').toLowerCase();
  if (/beaufort|bock|castel|youzou|youki|booster|flag|doppel|dopel|sucrerie|ivoire|orangina/.test(n)) return 'Solibra';
  if (/guinness|heineken|desperados|malta/.test(n)) return 'Brassivoire';
  if (/\bawa\b|carr[eé]/.test(n)) return "Carré d'Or";
  return 'Autre';
}

/**
 * Catalogue maquis / bar — noms & formats style Makaya + facture dépôt.
 * Stock toujours à 0 au seed.
 */
const MAQUIS: SeedProduct[] = [
  // —— Bières Solibra ——
  { name: 'Beaufort 25 cl', category: 'Bière', brand: 'Solibra', packaging: 'Carton 24 - Bière blonde', unit: 'bouteille', units_per_package: 24, stock: 0, min_stock: 24, cost: 0, price: 0 },
  { name: 'Beaufort 33 cl', category: 'Bière', brand: 'Solibra', packaging: 'Casier 24 - Bière blonde', unit: 'bouteille', units_per_package: 24, stock: 0, min_stock: 24, cost: 0, price: 0 },
  { name: 'Beaufort 50 cl', category: 'Bière', brand: 'Solibra', packaging: 'Casier 20 - Bière blonde', unit: 'bouteille', units_per_package: 20, stock: 0, min_stock: 20, cost: 0, price: 0 },
  { name: 'Beaufort canette 33 cl', category: 'Bière', brand: 'Solibra', packaging: 'Carton 24 - Bière blonde 5%', unit: 'canette', units_per_package: 24, stock: 0, min_stock: 24, cost: 0, price: 0 },
  { name: 'Beaufort canette 50 cl', category: 'Bière', brand: 'Solibra', packaging: 'Carton 24 - Bière blonde', unit: 'canette', units_per_package: 24, stock: 0, min_stock: 24, cost: 0, price: 0 },
  { name: 'Bock 25 cl', category: 'Bière', brand: 'Solibra', packaging: 'Carton 24 - Bière blonde 4.8%', unit: 'bouteille', units_per_package: 24, stock: 0, min_stock: 24, cost: 0, price: 0 },
  { name: 'Bock 65 cl', category: 'Bière', brand: 'Solibra', packaging: 'Casier 12 - Bière blonde', unit: 'bouteille', units_per_package: 12, stock: 0, min_stock: 12, cost: 0, price: 0 },
  { name: 'Bock 100 cl', category: 'Bière', brand: 'Solibra', packaging: 'Casier 12 - Bière blonde 4.8%', unit: 'bouteille', units_per_package: 12, stock: 0, min_stock: 12, cost: 0, price: 0 },
  { name: 'Bock canette 50 cl', category: 'Bière', brand: 'Solibra', packaging: 'Carton 24 - Bière blonde 4.8%', unit: 'canette', units_per_package: 24, stock: 0, min_stock: 24, cost: 0, price: 0 },
  { name: 'Castel 33 cl', category: 'Bière', brand: 'Solibra', packaging: 'Casier 24 - Bière blonde', unit: 'bouteille', units_per_package: 24, stock: 0, min_stock: 24, cost: 0, price: 0 },
  { name: 'Castel 50 cl', category: 'Bière', brand: 'Solibra', packaging: 'Casier 20 - Bière blonde', unit: 'bouteille', units_per_package: 20, stock: 0, min_stock: 20, cost: 0, price: 0 },
  { name: 'Castel canette 33 cl', category: 'Bière', brand: 'Solibra', packaging: 'Carton 24 - Bière blonde', unit: 'canette', units_per_package: 24, stock: 0, min_stock: 24, cost: 0, price: 0 },
  { name: 'Flag 33 cl', category: 'Bière', brand: 'Solibra', packaging: 'Casier 24 - Bière blonde', unit: 'bouteille', units_per_package: 24, stock: 0, min_stock: 24, cost: 0, price: 0 },
  { name: 'Flag 50 cl', category: 'Bière', brand: 'Solibra', packaging: 'Casier 20 - Bière blonde', unit: 'bouteille', units_per_package: 20, stock: 0, min_stock: 20, cost: 0, price: 0 },
  { name: 'Booster tequila 33 cl', category: 'Bière', brand: 'Solibra', packaging: 'Casier 24 - Bière aromatisée', unit: 'bouteille', units_per_package: 24, stock: 0, min_stock: 24, cost: 0, price: 0 },
  { name: 'Booster tequila 50 cl', category: 'Bière', brand: 'Solibra', packaging: 'Casier 12 - Bière aromatisée', unit: 'bouteille', units_per_package: 12, stock: 0, min_stock: 12, cost: 0, price: 0 },
  { name: 'Booster tequila canette 33 cl', category: 'Bière', brand: 'Solibra', packaging: 'Pack 24 - Bière aromatisée', unit: 'canette', units_per_package: 24, stock: 0, min_stock: 24, cost: 0, price: 0 },
  { name: 'Racine 50 cl', category: 'Bière', brand: 'Solibra', packaging: 'Casier 12 - Bière locale', unit: 'bouteille', units_per_package: 12, stock: 0, min_stock: 12, cost: 0, price: 0 },
  { name: 'Racine Fort', category: 'Bière', brand: 'Solibra', packaging: 'Casier 12 - Bière locale', unit: 'bouteille', units_per_package: 12, stock: 0, min_stock: 12, cost: 0, price: 0 },
  { name: 'Dopel 50 cl', category: 'Bière', brand: 'Solibra', packaging: 'Casier 12 - Bière locale', unit: 'bouteille', units_per_package: 12, stock: 0, min_stock: 12, cost: 0, price: 0 },
  // —— Bières Brassivoire / import ——
  { name: 'Guinness 33 cl', category: 'Bière', brand: 'Brassivoire', packaging: 'Casier 24 - Stout', unit: 'bouteille', units_per_package: 24, stock: 0, min_stock: 12, cost: 0, price: 0 },
  { name: 'Guinness 65 cl', category: 'Bière', brand: 'Brassivoire', packaging: 'Casier 12 - Stout', unit: 'bouteille', units_per_package: 12, stock: 0, min_stock: 12, cost: 0, price: 0 },
  { name: 'Heineken 33 cl', category: 'Bière', brand: 'Brassivoire', packaging: 'Casier 24 - Bière blonde', unit: 'bouteille', units_per_package: 24, stock: 0, min_stock: 12, cost: 0, price: 0 },
  { name: 'Desperados 33 cl', category: 'Bière', brand: 'Brassivoire', packaging: 'Casier 24 - Bière aromatisée', unit: 'bouteille', units_per_package: 24, stock: 0, min_stock: 12, cost: 0, price: 0 },
  { name: 'Budweiser 33 cl', category: 'Bière', brand: 'Solibra', packaging: 'Casier 24 - Bière blonde', unit: 'bouteille', units_per_package: 24, stock: 0, min_stock: 12, cost: 0, price: 0 },
  { name: 'Bavaria 33 cl', category: 'Bière', brand: 'Autre', packaging: 'Carton 6 - Bière sans alcool', unit: 'bouteille', units_per_package: 6, stock: 0, min_stock: 6, cost: 0, price: 0 },
  // —— Sodas Solibra ——
  { name: 'Youzou 30 cl', category: 'Soda', brand: 'Solibra', packaging: 'Pack 24 - Boisson gazeuse', unit: 'bouteille', units_per_package: 24, stock: 0, min_stock: 24, cost: 0, price: 0 },
  { name: 'Youzou 50 cl', category: 'Soda', brand: 'Solibra', packaging: 'Casier 24 - Boisson gazeuse', unit: 'bouteille', units_per_package: 24, stock: 0, min_stock: 24, cost: 0, price: 0 },
  { name: 'Youzou canette 33 cl', category: 'Soda', brand: 'Solibra', packaging: 'Carton 12 - Boisson gazeuse', unit: 'canette', units_per_package: 12, stock: 0, min_stock: 12, cost: 0, price: 0 },
  { name: 'Youzou pet 1,5 L', category: 'Soda', brand: 'Solibra', packaging: 'Carton 24 - Boisson gazeuse', unit: 'pet', units_per_package: 12, stock: 0, min_stock: 12, cost: 0, price: 0 },
  { name: 'Youzou pet 30 cl', category: 'Soda', brand: 'Solibra', packaging: 'Pack 6 - Boisson gazeuse', unit: 'pet', units_per_package: 6, stock: 0, min_stock: 12, cost: 0, price: 0 },
  { name: 'Youki orange 30 cl', category: 'Soda', brand: 'Solibra', packaging: 'Casier 24 - Boisson gazeuse', unit: 'bouteille', units_per_package: 24, stock: 0, min_stock: 24, cost: 0, price: 0 },
  { name: 'Youki orange 50 cl', category: 'Soda', brand: 'Solibra', packaging: 'Casier 12 - Boisson gazeuse', unit: 'bouteille', units_per_package: 12, stock: 0, min_stock: 12, cost: 0, price: 0 },
  { name: 'Youki orange canette 33 cl', category: 'Soda', brand: 'Solibra', packaging: 'Pack 24 - Boisson gazeuse', unit: 'canette', units_per_package: 24, stock: 0, min_stock: 24, cost: 0, price: 0 },
  { name: 'Youki orange pet 1,5 L', category: 'Soda', brand: 'Solibra', packaging: 'Pack 12 - Boisson gazeuse', unit: 'pet', units_per_package: 12, stock: 0, min_stock: 12, cost: 0, price: 0 },
  { name: 'Youki orange pet 30 cl', category: 'Soda', brand: 'Solibra', packaging: 'Pack 24 - Boisson gazeuse', unit: 'pet', units_per_package: 24, stock: 0, min_stock: 24, cost: 0, price: 0 },
  { name: 'Orangina 33 cl', category: 'Soda', brand: 'Solibra', packaging: 'Casier 24 - Boisson gazeuse', unit: 'bouteille', units_per_package: 24, stock: 0, min_stock: 24, cost: 0, price: 0 },
  { name: 'Orangina 60 cl', category: 'Soda', brand: 'Solibra', packaging: 'Casier 12 - Boisson gazeuse', unit: 'bouteille', units_per_package: 12, stock: 0, min_stock: 12, cost: 0, price: 0 },
  { name: 'Sucrerie 30 cl', category: 'Soda', brand: 'Solibra', packaging: 'Casier 24 - Boisson gazeuse', unit: 'bouteille', units_per_package: 24, stock: 0, min_stock: 24, cost: 0, price: 0 },
  { name: 'Sucrerie 60 cl', category: 'Soda', brand: 'Solibra', packaging: 'Casier 12 - Boisson gazeuse', unit: 'bouteille', units_per_package: 12, stock: 0, min_stock: 12, cost: 0, price: 0 },
  { name: 'Chill', category: 'Soda', brand: 'Solibra', packaging: 'Casier 24 - Boisson gazeuse', unit: 'bouteille', units_per_package: 24, stock: 0, min_stock: 24, cost: 0, price: 0 },
  { name: 'Ivoire', category: 'Soda', brand: 'Solibra', packaging: 'Casier 24 - Boisson gazeuse', unit: 'bouteille', units_per_package: 24, stock: 0, min_stock: 24, cost: 0, price: 0 },
  { name: 'Kunja', category: 'Soda', brand: 'Autre', packaging: 'Casier 24 - Boisson gazeuse', unit: 'bouteille', units_per_package: 24, stock: 0, min_stock: 24, cost: 0, price: 0 },
  { name: 'Malta Guinness', category: 'Soda', brand: 'Brassivoire', packaging: 'Casier 24 - Boisson maltée', unit: 'bouteille', units_per_package: 24, stock: 0, min_stock: 12, cost: 0, price: 0 },
  // —— Énergie ——
  { name: 'Dopel Energie', category: 'Énergie', brand: 'Solibra', packaging: 'Carton 24 - Boisson énergisante', unit: 'canette', units_per_package: 24, stock: 0, min_stock: 24, cost: 0, price: 0 },
  { name: 'Rinoh', category: 'Énergie', brand: 'Autre', packaging: 'Carton 24 - Boisson énergisante', unit: 'canette', units_per_package: 24, stock: 0, min_stock: 24, cost: 0, price: 0 },
  { name: '3X Energy 25 cl', category: 'Énergie', brand: 'Autre', packaging: 'Carton 24 - Boisson énergisante', unit: 'canette', units_per_package: 24, stock: 0, min_stock: 24, cost: 0, price: 0 },
  { name: '3X Energy 33 cl', category: 'Énergie', brand: 'Autre', packaging: 'Carton 24 - Boisson énergisante', unit: 'canette', units_per_package: 24, stock: 0, min_stock: 24, cost: 0, price: 0 },
  { name: '3X Energy 50 cl', category: 'Énergie', brand: 'Autre', packaging: 'Carton 24 - Boisson énergisante', unit: 'canette', units_per_package: 24, stock: 0, min_stock: 24, cost: 0, price: 0 },
  { name: 'BBL Energy Drink 25 cl', category: 'Énergie', brand: 'Autre', packaging: 'Carton 24 - Boisson énergisante', unit: 'canette', units_per_package: 24, stock: 0, min_stock: 24, cost: 0, price: 0 },
  // —— Eau ——
  { name: "Akwaba' 45 cl", category: 'Eau', brand: 'Autre', packaging: 'Pack 12 - Eau minérale', unit: 'bouteille', units_per_package: 12, stock: 0, min_stock: 12, cost: 0, price: 0 },
  { name: "Akwaba' 150 cl", category: 'Eau', brand: 'Autre', packaging: 'Pack 6 - Eau minérale', unit: 'bouteille', units_per_package: 6, stock: 0, min_stock: 12, cost: 0, price: 0 },
  { name: 'Awa 25 cl', category: 'Eau', brand: "Carré d'Or", packaging: 'Pack 9 - Eau minérale', unit: 'bouteille', units_per_package: 9, stock: 0, min_stock: 18, cost: 0, price: 0 },
  { name: 'Awa 50 cl', category: 'Eau', brand: "Carré d'Or", packaging: 'Pack 9 - Eau minérale', unit: 'bouteille', units_per_package: 9, stock: 0, min_stock: 18, cost: 0, price: 0 },
  { name: 'Awa 150 cl', category: 'Eau', brand: "Carré d'Or", packaging: 'Pack 6 - Eau minérale', unit: 'bouteille', units_per_package: 6, stock: 0, min_stock: 12, cost: 0, price: 0 },
  // —— Vin / spiritueux ——
  { name: 'Vin 50 cl', category: 'Vin', brand: 'Autre', packaging: 'Casier 12 - Vin', unit: 'bouteille', units_per_package: 12, stock: 0, min_stock: 6, cost: 0, price: 0 },
  { name: 'Vin 100 cl', category: 'Vin', brand: 'Autre', packaging: 'Casier 6 - Vin', unit: 'bouteille', units_per_package: 6, stock: 0, min_stock: 6, cost: 0, price: 0 },
  { name: "Baron d'Arignac 75 cl", category: 'Vin', brand: 'Autre', packaging: 'Carton 6 - Vin blanc 10.5%', unit: 'bouteille', units_per_package: 6, stock: 0, min_stock: 6, cost: 0, price: 0 },
  { name: "Bailey's 70 cl", category: 'Spiritueux', brand: 'Autre', packaging: 'Carton 6 - Irish cream 17%', unit: 'bouteille', units_per_package: 6, stock: 0, min_stock: 3, cost: 0, price: 0 },
  { name: 'Ballantines 70 cl', category: 'Spiritueux', brand: 'Autre', packaging: 'Carton 6 - Scotch Whisky 40%', unit: 'bouteille', units_per_package: 6, stock: 0, min_stock: 3, cost: 0, price: 0 },
  { name: 'Absolut Vodka Bleu 100 cl', category: 'Spiritueux', brand: 'Autre', packaging: 'Carton 6 - Vodka 40%', unit: 'bouteille', units_per_package: 6, stock: 0, min_stock: 3, cost: 0, price: 0 },
  { name: 'Tequilla 50 cl', category: 'Spiritueux', brand: 'Solibra', packaging: 'Casier 12 - Spiritueux', unit: 'bouteille', units_per_package: 12, stock: 0, min_stock: 6, cost: 0, price: 0 },
];

const MAGASIN: SeedProduct[] = [
  { name: 'Riz 25kg', category: 'Alimentaire', unit: 'Sac 25kg', stock: 0, min_stock: 5, cost: 15000, price: 18000 },
  { name: 'Riz 5kg', category: 'Alimentaire', unit: 'Sac 5kg', stock: 0, min_stock: 10, cost: 3500, price: 4200 },
  { name: 'Huile 5L', category: 'Alimentaire', unit: 'Bidon 5L', stock: 0, min_stock: 6, cost: 4500, price: 5500 },
  { name: 'Sucre 1kg', category: 'Alimentaire', unit: 'Paquet 1kg', stock: 0, min_stock: 20, cost: 700, price: 900 },
  { name: 'Lait en poudre', category: 'Alimentaire', unit: 'Boîte', stock: 0, min_stock: 10, cost: 2500, price: 3200 },
  { name: 'Savon de ménage', category: 'Hygiène', unit: 'Pièce', stock: 0, min_stock: 24, cost: 150, price: 250 },
  { name: 'Lessive 1kg', category: 'Hygiène', unit: 'Paquet', stock: 0, min_stock: 12, cost: 1200, price: 1600 },
  { name: 'Papier toilette (pack)', category: 'Hygiène', unit: 'Pack', stock: 0, min_stock: 10, cost: 1500, price: 2000 },
  { name: 'Piles AA (blister)', category: 'Électronique', unit: 'Blister', stock: 0, min_stock: 10, cost: 800, price: 1200 },
  { name: 'Ampoule LED', category: 'Électronique', unit: 'Pièce', stock: 0, min_stock: 10, cost: 500, price: 900 },
  { name: 'Sac plastique (lot)', category: 'Divers', unit: 'Lot', stock: 0, min_stock: 20, cost: 200, price: 350 },
];

const BOUTIQUE: SeedProduct[] = [
  { name: 'T-shirt homme M', category: 'Homme', unit: 'Pièce', stock: 0, min_stock: 5, cost: 2500, price: 5000 },
  { name: 'T-shirt homme L', category: 'Homme', unit: 'Pièce', stock: 0, min_stock: 5, cost: 2500, price: 5000 },
  { name: 'Pantalon jean', category: 'Homme', unit: 'Pièce', stock: 0, min_stock: 3, cost: 8000, price: 15000 },
  { name: 'Robe femme', category: 'Femme', unit: 'Pièce', stock: 0, min_stock: 3, cost: 7000, price: 14000 },
  { name: 'Top femme', category: 'Femme', unit: 'Pièce', stock: 0, min_stock: 5, cost: 3000, price: 6000 },
  { name: 'Ensemble enfant', category: 'Enfant', unit: 'Pièce', stock: 0, min_stock: 4, cost: 4000, price: 8000 },
  { name: 'Casquette', category: 'Accessoire', unit: 'Pièce', stock: 0, min_stock: 6, cost: 1500, price: 3000 },
  { name: 'Ceinture', category: 'Accessoire', unit: 'Pièce', stock: 0, min_stock: 6, cost: 2000, price: 4000 },
  { name: 'Sac à main', category: 'Accessoire', unit: 'Pièce', stock: 0, min_stock: 3, cost: 5000, price: 10000 },
];

const SUPERETTE: SeedProduct[] = [
  { name: 'Pain de mie', category: 'Épicerie', unit: 'Paquet', stock: 0, min_stock: 10, cost: 600, price: 900 },
  { name: 'Spaghetti 500g', category: 'Épicerie', unit: 'Paquet', stock: 0, min_stock: 20, cost: 400, price: 600 },
  { name: 'Concentré tomate', category: 'Épicerie', unit: 'Boîte', stock: 0, min_stock: 24, cost: 300, price: 500 },
  { name: 'Yaourt nature', category: 'Frais', unit: 'Pot', stock: 0, min_stock: 20, cost: 200, price: 350 },
  { name: 'Œufs (plateau)', category: 'Frais', unit: 'Plateau', stock: 0, min_stock: 5, cost: 2500, price: 3200 },
  { name: 'Jus local 1L', category: 'Boissons', unit: 'Bouteille 1L', stock: 0, min_stock: 12, cost: 700, price: 1000 },
  { name: 'Eau 1.5L', category: 'Boissons', unit: 'Bouteille', stock: 0, min_stock: 24, cost: 250, price: 400 },
  { name: 'Dentifrice', category: 'Hygiène', unit: 'Tube', stock: 0, min_stock: 10, cost: 800, price: 1200 },
  { name: 'Savon liquide', category: 'Hygiène', unit: 'Flacon', stock: 0, min_stock: 8, cost: 1000, price: 1500 },
];

const QUINCAILLERIE: SeedProduct[] = [
  { name: 'Marteau', category: 'Outillage', unit: 'Pièce', stock: 0, min_stock: 5, cost: 2500, price: 4500 },
  { name: 'Tournevis set', category: 'Outillage', unit: 'Set', stock: 0, min_stock: 5, cost: 3000, price: 5500 },
  { name: 'Mètre ruban 5m', category: 'Outillage', unit: 'Pièce', stock: 0, min_stock: 8, cost: 1500, price: 2500 },
  { name: 'Vis assortiment', category: 'Quincaillerie', unit: 'Boîte', stock: 0, min_stock: 10, cost: 1000, price: 1800 },
  { name: 'Serrure porte', category: 'Quincaillerie', unit: 'Pièce', stock: 0, min_stock: 4, cost: 5000, price: 8500 },
  { name: 'Câble électrique 1.5mm', category: 'Électricité', unit: 'Rouleau', stock: 0, min_stock: 5, cost: 8000, price: 12000 },
  { name: 'Prise murale', category: 'Électricité', unit: 'Pièce', stock: 0, min_stock: 12, cost: 800, price: 1500 },
  { name: 'Robinet', category: 'Plomberie', unit: 'Pièce', stock: 0, min_stock: 6, cost: 3500, price: 6000 },
  { name: 'Tuyau PVC 32mm', category: 'Plomberie', unit: 'Barre', stock: 0, min_stock: 10, cost: 1500, price: 2500 },
  { name: 'Peinture 4L blanche', category: 'Peinture', unit: 'Pot 4L', stock: 0, min_stock: 4, cost: 12000, price: 16000 },
  { name: 'Pinceau 50mm', category: 'Peinture', unit: 'Pièce', stock: 0, min_stock: 10, cost: 500, price: 1000 },
];

const LOCATION: SeedProduct[] = [
  { name: 'Chaise pliante', category: 'Chaises', unit: 'Unité', stock: 0, min_stock: 50, cost: 2000, price: 500 },
  { name: 'Chaise présidentielle', category: 'Chaises', unit: 'Unité', stock: 0, min_stock: 20, cost: 8000, price: 1500 },
  { name: 'Table rectangulaire', category: 'Tables', unit: 'Unité', stock: 0, min_stock: 15, cost: 15000, price: 3000 },
  { name: 'Tréteau', category: 'Tables', unit: 'Unité', stock: 0, min_stock: 20, cost: 5000, price: 1000 },
  { name: 'Bâche 4x6', category: 'Chapiteaux', unit: 'Unité', stock: 0, min_stock: 5, cost: 25000, price: 8000 },
  { name: 'Chapiteau 5x10', category: 'Chapiteaux', unit: 'Unité', stock: 0, min_stock: 2, cost: 150000, price: 50000 },
  { name: 'Sono complète', category: 'Sono', unit: 'Kit', stock: 0, min_stock: 2, cost: 200000, price: 75000 },
  { name: 'Micro sans fil', category: 'Sono', unit: 'Unité', stock: 0, min_stock: 4, cost: 25000, price: 10000 },
  { name: 'Nappe', category: 'Décoration', unit: 'Unité', stock: 0, min_stock: 20, cost: 2000, price: 1000 },
  { name: 'Assiettes (lot 50)', category: 'Décoration', unit: 'Lot', stock: 0, min_stock: 10, cost: 5000, price: 3000 },
];


const RESTAURANT: SeedProduct[] = [
  { name: 'Alloco', category: 'Accompagnement', brand: '', packaging: 'Portion', unit: 'portion', units_per_package: 1, stock: 0, min_stock: 10, cost: 0, price: 0 },
  { name: 'Attiéké', category: 'Accompagnement', brand: '', packaging: 'Portion', unit: 'portion', units_per_package: 1, stock: 0, min_stock: 10, cost: 0, price: 0 },
  { name: 'Riz gras', category: 'Plat', brand: '', packaging: 'Assiette', unit: 'portion', units_per_package: 1, stock: 0, min_stock: 8, cost: 0, price: 0 },
  { name: 'Poulet braisé', category: 'Grillade', brand: '', packaging: 'Assiette', unit: 'portion', units_per_package: 1, stock: 0, min_stock: 6, cost: 0, price: 0 },
  { name: 'Poisson braisé', category: 'Grillade', brand: '', packaging: 'Assiette', unit: 'portion', units_per_package: 1, stock: 0, min_stock: 6, cost: 0, price: 0 },
  { name: 'Kedjenou', category: 'Plat', brand: '', packaging: 'Assiette', unit: 'portion', units_per_package: 1, stock: 0, min_stock: 6, cost: 0, price: 0 },
  { name: 'Salade', category: 'Entrée', brand: '', packaging: 'Assiette', unit: 'portion', units_per_package: 1, stock: 0, min_stock: 8, cost: 0, price: 0 },
  { name: 'Frites', category: 'Accompagnement', brand: '', packaging: 'Portion', unit: 'portion', units_per_package: 1, stock: 0, min_stock: 10, cost: 0, price: 0 },
  { name: 'Eau minérale 50 cl', category: 'Eau', brand: '', packaging: 'Bouteille', unit: 'bouteille', units_per_package: 12, stock: 0, min_stock: 12, cost: 0, price: 0 },
  { name: 'Coca 33 cl', category: 'Soda', brand: '', packaging: 'Canette / verre', unit: 'bouteille', units_per_package: 24, stock: 0, min_stock: 12, cost: 0, price: 0 },
  { name: 'Bock 66', category: 'Bière', brand: 'Solibra', packaging: 'Bouteille', unit: 'bouteille', units_per_package: 12, stock: 0, min_stock: 12, cost: 0, price: 0 },
];

const BY_TYPE: Record<BusinessType, SeedProduct[]> = {
  maquis: MAQUIS,
  location_event: [],
  complexe: MAQUIS,
};

export function getSeedCatalog(type: string | null | undefined): SeedProduct[] {
  const t = normalizeBusinessType(type);
  return BY_TYPE[t] || MAQUIS;
}

export function catalogLabel(type: string | null | undefined): string {
  const t = normalizeBusinessType(type);
  const map: Record<BusinessType, string> = {
    maquis: 'Catalogue maquis (boissons)',
    location_event: 'Catalogue location',
    complexe: 'Catalogue établissement',
  };
  return map[t] || 'Catalogue de démarrage';
}
