/**
 * Bénéfice métier maquis :
 * bénéfice = Σ qty_vendue × (prix_vente − coût_achat)
 * Les achats (arrivages) = fonds de commerce, PAS une charge du bénéfice.
 */
import { supabase } from '@/lib/supabase';

export type BeverageLineProfit = {
  product_id: string;
  name: string;
  qty_out: number;
  unit_price: number;
  unit_cost: number;
  ca: number;
  cost: number;
  profit: number;
};

export type BeveragePeriodReport = {
  from: string;
  to: string;
  lines: BeverageLineProfit[];
  totalQty: number;
  totalCA: number;
  totalCost: number; // coût des boissons VENDUES (CMV)
  totalProfit: number; // marge = CA − CMV
  daysWithReport: number;
  missingCostLines: number;
};

export type FondsCommerce = {
  stockValueAtCost: number; // capital marchandise
  productCount: number;
  unitsInStock: number;
};

type ReportItem = {
  product_id?: string;
  name?: string;
  price?: number;
  cost?: number;
  qty?: number;
};

function parseItems(notes: string | null | undefined): ReportItem[] {
  if (!notes || typeof notes !== 'string') return [];
  const t = notes.trim();
  if (!t.startsWith('{') && !t.startsWith('[')) return [];
  try {
    const parsed = JSON.parse(t) as { items?: ReportItem[] } | ReportItem[];
    if (Array.isArray(parsed)) return parsed;
    return parsed.items || [];
  } catch {
    return [];
  }
}

/** Bénéfice sur une plage de dates (inclus), uniquement via rapports du jour. */
export async function loadBeverageProfitForRange(
  establishmentId: string,
  fromDate: string,
  toDate: string
): Promise<BeveragePeriodReport> {
  const from = fromDate.slice(0, 10);
  const to = toDate.slice(0, 10);

  const [{ data: reports }, { data: products }] = await Promise.all([
    supabase
      .from('daily_reports')
      .select('date, notes, total_sales')
      .eq('establishment_id', establishmentId)
      .gte('date', from)
      .lte('date', to)
      .order('date', { ascending: true }),
    supabase
      .from('products')
      .select('id, name, cost, price')
      .eq('establishment_id', establishmentId),
  ]);

  const costMap = new Map<string, number>();
  const priceMap = new Map<string, number>();
  const nameMap = new Map<string, string>();
  for (const p of products || []) {
    costMap.set(p.id, Number(p.cost) || 0);
    priceMap.set(p.id, Number(p.price) || 0);
    nameMap.set(p.id, p.name);
  }

  type Acc = {
    qty: number;
    ca: number;
    cost: number;
    name: string;
    unit_price: number;
    unit_cost: number;
  };
  const acc = new Map<string, Acc>();
  let daysWithReport = 0;
  let missingCostLines = 0;

  for (const r of reports || []) {
    const items = parseItems(r.notes as string);
    if (items.length) daysWithReport += 1;
    for (const it of items) {
      const qty = Math.max(0, Math.floor(Number(it.qty) || 0));
      if (!qty) continue;
      const id = String(it.product_id || it.name || 'unknown');
      const unitPrice = Number(it.price) || priceMap.get(id) || 0;
      let unitCost = Number(it.cost);
      if (!Number.isFinite(unitCost) || unitCost < 0) unitCost = costMap.get(id) || 0;
      if (unitCost <= 0) missingCostLines += 1;

      const cur = acc.get(id) || {
        qty: 0,
        ca: 0,
        cost: 0,
        name: it.name || nameMap.get(id) || 'Boisson',
        unit_price: unitPrice,
        unit_cost: unitCost,
      };
      cur.qty += qty;
      cur.ca += qty * unitPrice;
      cur.cost += qty * unitCost;
      cur.unit_price = unitPrice;
      cur.unit_cost = unitCost;
      if (it.name) cur.name = it.name;
      acc.set(id, cur);
    }
  }

  const lines: BeverageLineProfit[] = [...acc.entries()].map(([product_id, v]) => ({
    product_id,
    name: v.name,
    qty_out: v.qty,
    unit_price: v.unit_price,
    unit_cost: v.unit_cost,
    ca: v.ca,
    cost: v.cost,
    profit: v.ca - v.cost,
  }));
  lines.sort((a, b) => b.profit - a.profit);

  const totalQty = lines.reduce((s, l) => s + l.qty_out, 0);
  const totalCA = lines.reduce((s, l) => s + l.ca, 0);
  const totalCost = lines.reduce((s, l) => s + l.cost, 0);

  return {
    from,
    to,
    lines,
    totalQty,
    totalCA,
    totalCost,
    totalProfit: totalCA - totalCost,
    daysWithReport,
    missingCostLines,
  };
}

/** Compat : depuis une date jusqu’à aujourd’hui */
export async function loadBeverageProfitFromReports(
  establishmentId: string,
  sinceISO: string
): Promise<BeveragePeriodReport> {
  const today = new Date().toISOString().slice(0, 10);
  return loadBeverageProfitForRange(establishmentId, sinceISO.slice(0, 10), today);
}

/** Fonds de commerce = valeur du stock au coût d’achat (capital marchandise). */
export async function loadFondsCommerce(establishmentId: string): Promise<FondsCommerce> {
  const { data } = await supabase
    .from('products')
    .select('stock, cost')
    .eq('establishment_id', establishmentId);
  let stockValueAtCost = 0;
  let unitsInStock = 0;
  let productCount = 0;
  for (const p of data || []) {
    const stock = Math.max(0, Math.floor(Number(p.stock) || 0));
    const cost = Math.max(0, Number(p.cost) || 0);
    stockValueAtCost += stock * cost;
    unitsInStock += stock;
    if (stock > 0) productCount += 1;
  }
  return { stockValueAtCost, productCount, unitsInStock };
}

export function mondayOfISO(dateStr?: string): string {
  const d = new Date((dateStr || new Date().toISOString().slice(0, 10)) + 'T12:00:00');
  const day = d.getDay();
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day));
  return d.toISOString().slice(0, 10);
}

export function sundayOfWeek(mondayISO: string): string {
  const d = new Date(mondayISO + 'T12:00:00');
  d.setDate(d.getDate() + 6);
  return d.toISOString().slice(0, 10);
}

export function dateDaysAgo(days: number): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

export function monthStartISO(): string {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

/** Texte WhatsApp / notification rapport semaine */
export function formatWeeklyProfitMessage(
  estName: string,
  report: BeveragePeriodReport,
  fonds?: FondsCommerce
): string {
  const top = report.lines.slice(0, 5).map(
    (l) => `• ${l.name}: ${l.qty_out} × marge ${Math.round(l.unit_price - l.unit_cost)} F = ${Math.round(l.profit).toLocaleString('fr-FR')} F`
  );
  return [
    `📊 *Rapport semaine — ${estName}*`,
    `Du ${report.from} au ${report.to}`,
    '',
    `💰 CA ventes: ${Math.round(report.totalCA).toLocaleString('fr-FR')} F`,
    `📦 Coût boissons vendues: ${Math.round(report.totalCost).toLocaleString('fr-FR')} F`,
    `✅ *Bénéfice (marge): ${Math.round(report.totalProfit).toLocaleString('fr-FR')} F*`,
    `Jours avec rapport: ${report.daysWithReport}`,
    '',
    top.length ? '*Top marges:*\n' + top.join('\n') : '',
    fonds
      ? `\n🏦 Fonds de commerce (stock au coût): ${Math.round(fonds.stockValueAtCost).toLocaleString('fr-FR')} F\n_(Capital à reconduire pour racheter le stock — pas un bénéfice)_`
      : '',
    '',
    'GESMAK',
  ]
    .filter(Boolean)
    .join('\n');
}
