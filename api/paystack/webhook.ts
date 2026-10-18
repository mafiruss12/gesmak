import type { VercelRequest, VercelResponse } from '@vercel/node';
import crypto from 'crypto';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const secret = process.env.PAYSTACK_SECRET_KEY || process.env.PAYSTACK_SECRET;
  if (!secret) return res.status(503).json({ error: 'Paystack non configuré' });

  const raw = typeof req.body === 'string' ? req.body : JSON.stringify(req.body || {});
  const signature = String(req.headers['x-paystack-signature'] || '');
  if (signature) {
    const hash = crypto.createHmac('sha512', secret).update(raw).digest('hex');
    if (hash !== signature) {
      return res.status(401).json({ error: 'Signature invalide' });
    }
  }

  const event = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
  if (event.event !== 'charge.success') {
    return res.status(200).json({ ok: true, ignored: event.event });
  }

  const reference = event?.data?.reference;
  if (!reference) return res.status(400).json({ error: 'reference manquante' });

  try {
    const r = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
      headers: { Authorization: `Bearer ${secret}` },
    });
    const data = await r.json().catch(() => ({}));
    if (!data?.status || data?.data?.status !== 'success') {
      return res.status(200).json({ ok: false, status: data?.data?.status });
    }

    const tx = data.data;
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

    if (!estId) return res.status(200).json({ ok: false, error: 'no establishment_id' });

    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceKey) return res.status(500).json({ error: 'Supabase manquant' });

    const headers = {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    };

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

    return res.status(200).json({ ok: true, activated: true, reference, estId, months });
  } catch (e: unknown) {
    return res.status(500).json({ error: e instanceof Error ? e.message : 'webhook error' });
  }
}
