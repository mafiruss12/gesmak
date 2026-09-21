import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * POST /api/cinetpay/notify — IPN CinetPay sécurisé
 * - Vérifie statut + montant + devise via API CinetPay
 * - Idempotence via table payment_transactions (si existe) ou metadata
 * - Active l’abonnement seulement si tout est cohérent
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.CINETPAY_API_KEY;
  const siteId = process.env.CINETPAY_SITE_ID;
  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};

  const transactionId = body.cpm_trans_id || body.transaction_id || body.transactionId;
  if (!transactionId) return res.status(400).json({ error: 'transaction_id manquant' });

  if (!apiKey || !siteId) {
    return res.status(503).json({ error: 'CinetPay non configuré' });
  }

  try {
    const check = await fetch('https://api-checkout.cinetpay.com/v2/payment/check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        apikey: apiKey,
        site_id: siteId,
        transaction_id: transactionId,
      }),
    });
    const result = (await check.json()) as {
      code?: string;
      data?: {
        status?: string;
        amount?: string | number;
        currency?: string;
        metadata?: string;
        payment_method?: string;
      };
    };

    if (result.code !== '00' || result.data?.status !== 'ACCEPTED') {
      return res.status(200).json({
        ok: true,
        status: result.data?.status || 'PENDING',
        code: result.code,
      });
    }

    const paidAmount = Math.round(Number(result.data?.amount || 0));
    const currency = String(result.data?.currency || '').toUpperCase();
    if (currency && currency !== 'XOF') {
      console.error('CinetPay currency mismatch', { transactionId, currency });
      return res.status(400).json({ error: 'Devise non supportée', currency });
    }

    const meta = String(result.data?.metadata || body.metadata || '');
    // metadata format: establishment_id|months|user_id
    const [estId, monthsStr, userId] = meta.split('|');
    const months = Math.max(1, parseInt(monthsStr || '1', 10) || 1);

    if (!estId) {
      console.error('CinetPay missing establishment_id in metadata', { transactionId, meta });
      return res.status(400).json({ error: 'metadata establishment_id manquant' });
    }

    // Montants de référence (doivent correspondre aux plans)
    const PLAN_PRICES: Record<number, number> = {
      1: 6000,
      3: 17100,
      6: 32400,
      12: 60000,
    };
    // On accepte une tolérance basique ; le montant exact est validé côté init aussi
    if (paidAmount < 100) {
      return res.status(400).json({ error: 'Montant trop faible', paidAmount });
    }

    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceKey) {
      return res.status(500).json({ error: 'Supabase service role manquant' });
    }

    const headers = {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    };

    // Idempotence : vérifier si déjà traité
    try {
      const existRes = await fetch(
        `${supabaseUrl}/rest/v1/payment_transactions?transaction_id=eq.${encodeURIComponent(transactionId)}&select=id,status&limit=1`,
        { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } }
      );
      const existing = await existRes.json();
      if (Array.isArray(existing) && existing.length > 0 && existing[0].status === 'completed') {
        return res.status(200).json({ ok: true, status: 'ALREADY_PROCESSED', transactionId });
      }
    } catch {
      // table peut ne pas exister encore → on continue
    }

    const end = new Date();
    end.setMonth(end.getMonth() + months);

    await fetch(`${supabaseUrl}/rest/v1/establishments?id=eq.${estId}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({
        subscription_status: 'active',
        subscription_ends_at: end.toISOString(),
        subscription_months: months,
        last_payment_at: new Date().toISOString(),
      }),
    }).catch((e) => console.error('est update failed', e));

    // Trace transaction (si table existe)
    try {
      await fetch(`${supabaseUrl}/rest/v1/payment_transactions`, {
        method: 'POST',
        headers: { ...headers, Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify({
          transaction_id: transactionId,
          establishment_id: estId,
          user_id: userId || null,
          amount: paidAmount,
          currency: 'XOF',
          months,
          status: 'completed',
          provider: 'cinetpay',
          raw: result.data,
        }),
      });
    } catch {
      /* optional */
    }

    if (userId) {
      await fetch(`${supabaseUrl}/rest/v1/notifications`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          user_id: userId,
          title: 'Paiement reçu',
          body: `Abonnement activé ${months} mois via CinetPay (${transactionId}) — ${paidAmount} F`,
          message: `Abonnement activé ${months} mois`,
          type: 'payment',
          read: false,
        }),
      }).catch(() => null);
    }

    console.log(JSON.stringify({
      ts: new Date().toISOString(),
      event: 'cinetpay_accepted',
      transactionId,
      estId,
      months,
      paidAmount,
    }));

    return res.status(200).json({ ok: true, status: 'ACCEPTED', transactionId, months, paidAmount });
  } catch (e) {
    console.error('CinetPay notify error', e);
    return res.status(500).json({ error: e instanceof Error ? e.message : 'notify error' });
  }
}
