/**
 * Hub opérationnel maquis :
 * Caisse ↔ Rapport du jour ↔ Clôture Z ↔ Devis / Factures
 */
import { supabase } from '@/lib/supabase';
import { todayISO } from '@/lib/format';

export type DayOpsSummary = {
  date: string;
  posSalesTotal: number;
  posCash: number;
  posMobile: number;
  reportSalesTotal: number;
  reportCash: number;
  reportMobile: number;
  expensesTotal: number;
  /** Total ventes à utiliser (rapport si présent, sinon POS) */
  salesTotal: number;
  cashTotal: number;
  mobileTotal: number;
  byProduct: { product_id: string; name?: string; qty: number; amount: number }[];
  hasReport: boolean;
  reportId: string | null;
  reportSent: boolean;
};

export async function loadDayOpsSummary(estId: string, date = todayISO()): Promise<DayOpsSummary> {
  const start = `${date}T00:00:00`;
  const end = `${date}T23:59:59.999`;

  const [salesRes, reportRes, expRes] = await Promise.all([
    supabase
      .from('sales')
      .select('product_id, qty, total, payment_method, created_at')
      .eq('establishment_id', estId)
      .gte('created_at', start)
      .lte('created_at', end),
    supabase
      .from('daily_reports')
      .select('id, total_sales, cash, mobile_money, total_expenses, sent_at, notes')
      .eq('establishment_id', estId)
      .eq('date', date)
      .maybeSingle(),
    supabase
      .from('expenses')
      .select('amount')
      .eq('establishment_id', estId)
      .gte('created_at', start)
      .lte('created_at', end),
  ]);

  const sales = salesRes.data ?? [];
  let posSalesTotal = 0;
  let posCash = 0;
  let posMobile = 0;
  const byMap = new Map<string, { product_id: string; qty: number; amount: number }>();

  for (const s of sales) {
    const total = Number(s.total) || 0;
    const qty = Number(s.qty) || 0;
    posSalesTotal += total;
    const pm = String(s.payment_method || '').toLowerCase();
    if (pm.includes('mobile') || pm.includes('wave') || pm.includes('orange') || pm.includes('mtn')) {
      posMobile += total;
    } else {
      posCash += total;
    }
    const pid = String(s.product_id || 'unknown');
    const prev = byMap.get(pid) || { product_id: pid, qty: 0, amount: 0 };
    prev.qty += qty;
    prev.amount += total;
    byMap.set(pid, prev);
  }

  const report = reportRes.data;
  const reportSalesTotal = Number(report?.total_sales) || 0;
  const reportCash = Number(report?.cash) || 0;
  const reportMobile = Number(report?.mobile_money) || 0;
  const reportExp = Number(report?.total_expenses) || 0;
  const expensesTotal =
    (expRes.data ?? []).reduce((a, e) => a + (Number(e.amount) || 0), 0) + reportExp;

  // Priorité rapport envoyé / saisi, sinon caisse POS
  const useReport = report && (report.sent_at || reportSalesTotal > 0);
  const salesTotal = useReport ? reportSalesTotal : posSalesTotal;
  const cashTotal = useReport ? reportCash || posCash : posCash;
  const mobileTotal = useReport ? reportMobile || posMobile : posMobile;

  return {
    date,
    posSalesTotal,
    posCash,
    posMobile,
    reportSalesTotal,
    reportCash,
    reportMobile,
    expensesTotal,
    salesTotal,
    cashTotal,
    mobileTotal,
    byProduct: Array.from(byMap.values()),
    hasReport: Boolean(report),
    reportId: report?.id || null,
    reportSent: Boolean(report?.sent_at),
  };
}

/** Convertit un devis en facture (copie business_documents) */
export async function convertDevisToFacture(devisId: string, userId?: string | null) {
  const { data: d, error } = await supabase
    .from('business_documents')
    .select('*')
    .eq('id', devisId)
    .maybeSingle();
  if (error || !d) throw new Error(error?.message || 'Devis introuvable');
  if (d.doc_type !== 'devis') throw new Error('Ce document n’est pas un devis');

  const d0 = new Date();
  const number = `FAC-${d0.getFullYear()}${String(d0.getMonth() + 1).padStart(2, '0')}-${Math.floor(
    1000 + Math.random() * 9000
  )}`;

  const payload = {
    establishment_id: d.establishment_id,
    doc_type: 'facture',
    number,
    client_name: d.client_name,
    client_phone: d.client_phone,
    client_location: d.client_location,
    title: d.title || `Facture depuis ${d.number}`,
    lines: d.lines,
    subtotal: d.subtotal,
    tax_rate: d.tax_rate,
    total: d.total,
    notes: (d.notes || '') + `\nConverti depuis devis ${d.number}`,
    status: 'issued',
    theme: d.theme || 'orange_blue',
    valid_until: null,
    issued_at: new Date().toISOString(),
    created_by: userId || d.created_by || null,
  };

  const { data: fac, error: insErr } = await supabase
    .from('business_documents')
    .insert(payload)
    .select('*')
    .maybeSingle();
  if (insErr) throw new Error(insErr.message);

  // Marquer le devis comme converti
  await supabase.from('business_documents').update({ status: 'converted' }).eq('id', devisId);

  return fac;
}

/** Crée une facture rapide depuis un panier caisse */
export async function createFactureFromCart(opts: {
  estId: string;
  lines: { label: string; qty: number; unit_price: number }[];
  total: number;
  clientName?: string;
  paymentMethod?: string;
  userId?: string | null;
}) {
  const d0 = new Date();
  const number = `FAC-${d0.getFullYear()}${String(d0.getMonth() + 1).padStart(2, '0')}-${Math.floor(
    1000 + Math.random() * 9000
  )}`;
  const { data, error } = await supabase
    .from('business_documents')
    .insert({
      establishment_id: opts.estId,
      doc_type: 'facture',
      number,
      client_name: opts.clientName || 'Client comptoir',
      client_phone: null,
      title: `Vente caisse ${opts.paymentMethod || ''}`.trim(),
      lines: opts.lines,
      subtotal: opts.total,
      tax_rate: 0,
      total: opts.total,
      notes: 'Générée depuis la caisse maquis',
      status: 'issued',
      theme: 'orange_blue',
      issued_at: new Date().toISOString(),
      created_by: opts.userId || null,
    })
    .select('id, number')
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}
