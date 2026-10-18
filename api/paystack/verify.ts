import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * GET  /api/paystack/verify?reference=xxx  → vérifie le statut
 * POST /api/paystack/verify  body { reference, activate?: true }
 *   → vérifie + active l’abonnement si success
 * POST avec header x-paystack-signature → webhook charge.success
 */
async function activateFromTx(secret: string, reference: string, tx: any) {
  const paidAmount = Math.round(Number(tx.amount || 0) / 100);
  const meta = tx.metadata || {};
  let estId = String(meta.establishment_id || '');
  let months = Math.max(1, parseInt(String(meta.months || '1'), 10) || 1);
  let userId = String(meta.user_id || '');
  let planTier = String(meta.plan_tier || 'starter');
  const custom = String(meta.custom_meta || '');
  if (custom.includes('|')) {
    const parts = custom.split('|');
    if (parts[0]) estId = parts[0];
    if (parts[1]) months = Math.max(1, parseInt(parts[1], 10) || months);
    if (parts[2]) userId = parts[2] || userId;
    if (parts[3]) planTier = parts[3] || planTier;
  }
  if (!estId) return { ok: false, error: 'establishment_id manquant dans metadata' };

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) return { ok: false, error: 'Supabase service role manquant' };

  const headers = {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    'Content-Type': 'application/json',
    Prefer: 'return=minimal',
  };

  try {
    const existRes = await fetch(
      `${supabaseUrl}/rest/v1/payment_transactions?transaction_id=eq.${encodeURIComponent(reference)}&select=id,status&limit=1`,
      { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } }
    );
    const existing = await existRes.json();
    if (Array.isArray(existing) && existing.length > 0 && existing[0].status === 'completed') {
      return { ok: true, status: 'ALREADY_PROCESSED', reference };
    }
  } catch { /* */ }

  const end = new Date();
  end.setMonth(end.getMonth() + months);

  await fetch(`${supabaseUrl}/rest/v1/establishments?id=eq.${encodeURIComponent(estId)}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({
      subscription_status: 'active',
      subscription_ends_at: end.toISOString(),
      subscription_months: months,
      plan_tier: planTier,
      last_payment_at: new Date().toISOString(),
    }),
  });

  try {
    await fetch(`${supabaseUrl}/rest/v1/payment_transactions`, {
      method: 'POST',
      headers: { ...headers, Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({
        transaction_id: reference,
        establishment_id: estId,
        user_id: userId || null,
        amount: paidAmount,
        currency: 'XOF',
        months,
        status: 'completed',
        provider: 'paystack',
        raw: tx,
      }),
    });
  } catch { /* */ }

  if (userId) {
    await fetch(`${supabaseUrl}/rest/v1/notifications`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        user_id: userId,
        title: 'Paiement Paystack reçu',
        body: `Abonnement activé ${months} mois (${planTier}) — ${paidAmount} F — réf. ${reference}`,
        message: `Abonnement activé ${months} mois`,
        type: 'payment',
        read: false,
      }),
    }).catch(() => null);
  }

  return {
    ok: true,
    status: 'ACTIVATED',
    reference,
    establishment_id: estId,
    months,
    plan_tier: planTier,
    amount_fcfa: paidAmount,
    ends_at: end.toISOString(),
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-paystack-signature');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const secret = process.env.PAYSTACK_SECRET_KEY || process.env.PAYSTACK_SECRET;
  if (!secret) return res.status(503).json({ error: 'Paystack non configuré' });

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};

  // Webhook Paystack (optionnel)
  if (req.method === 'POST' && req.headers['x-paystack-signature'] && body.event) {
    if (body.event !== 'charge.success') {
      return res.status(200).json({ ok: true, ignored: body.event });
    }
    const reference = String(body?.data?.reference || '').trim();
    if (!reference) return res.status(400).json({ error: 'reference manquante' });
    const r = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
      headers: { Authorization: `Bearer ${secret}` },
    });
    const data = await r.json().catch(() => ({}));
    if (!data?.status || data?.data?.status !== 'success') {
      return res.status(200).json({ ok: false, status: data?.data?.status });
    }
    const result = await activateFromTx(secret, reference, data.data);
    return res.status(200).json(result);
  }

  const reference = String(req.query.reference || body.reference || '').trim();
  if (!reference) return res.status(400).json({ error: 'reference manquante' });

  try {
    const r = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
      headers: { Authorization: `Bearer ${secret}` },
    });
    const data = await r.json().catch(() => ({}));
    if (!data?.status) {
      return res.status(400).json({ ok: false, error: data?.message || 'Vérification échouée', data });
    }
    const tx = data.data || {};
    const paid = tx.status === 'success';

    // POST + activate (ou toujours activer si success en POST)
    const shouldActivate = req.method === 'POST' && (body.activate === true || body.activate === '1' || paid);
    if (shouldActivate && paid) {
      const act = await activateFromTx(secret, reference, tx);
      return res.status(200).json({
        ok: true,
        status: tx.status,
        amount_fcfa: typeof tx.amount === 'number' ? Math.round(tx.amount / 100) : null,
        reference: tx.reference,
        activation: act,
      });
    }

    return res.status(200).json({
      ok: paid,
      status: tx.status,
      amount_fcfa: typeof tx.amount === 'number' ? Math.round(tx.amount / 100) : null,
      currency: tx.currency,
      reference: tx.reference,
      paid_at: tx.paid_at,
      channel: tx.channel,
      metadata: tx.metadata || null,
    });
  } catch (e: unknown) {
    return res.status(500).json({ error: e instanceof Error ? e.message : 'Erreur réseau' });
  }
}
