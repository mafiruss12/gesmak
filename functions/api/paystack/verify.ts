import { json, env, readBody, noContent } from '../_lib/http';

type Ctx = { request: Request; env: Record<string, string | undefined> };

async function activateFromTx(context: Ctx, reference: string, tx: Record<string, unknown>) {
  const paidAmount = Math.round(Number(tx.amount || 0) / 100);
  const meta = (tx.metadata || {}) as Record<string, unknown>;
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

  const supabaseUrl = env(context, 'SUPABASE_URL') || env(context, 'VITE_SUPABASE_URL');
  const serviceKey = env(context, 'SUPABASE_SERVICE_ROLE_KEY');
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
  } catch {
    /* optional */
  }

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
  } catch {
    /* optional */
  }

  if (userId) {
    await fetch(`${supabaseUrl}/rest/v1/notifications`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        user_id: userId,
        title: 'Paiement Paystack recu',
        body: `Abonnement active ${months} mois (${planTier}) — ${paidAmount} F — ref. ${reference}`,
        message: `Abonnement active ${months} mois`,
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

export async function onRequest(context: Ctx) {
  const { request } = context;
  if (request.method === 'OPTIONS') return noContent();
  if (request.method !== 'GET' && request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  const secret = env(context, 'PAYSTACK_SECRET_KEY') || env(context, 'PAYSTACK_SECRET');
  if (!secret) return json({ error: 'Paystack non configure' }, 503);

  const url = new URL(request.url);
  let body: Record<string, unknown> = {};
  if (request.method === 'POST') body = await readBody(request);

  if (request.method === 'POST' && request.headers.get('x-paystack-signature') && body.event) {
    if (body.event !== 'charge.success') {
      return json({ ok: true, ignored: body.event });
    }
    const dataObj = body.data as Record<string, unknown> | undefined;
    const reference = String(dataObj?.reference || '').trim();
    if (!reference) return json({ error: 'reference manquante' }, 400);
    const r = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
      headers: { Authorization: `Bearer ${secret}` },
    });
    const data = (await r.json().catch(() => ({}))) as Record<string, unknown>;
    const tx = data.data as Record<string, unknown> | undefined;
    if (!data?.status || tx?.status !== 'success') {
      return json({ ok: false, status: tx?.status });
    }
    const result = await activateFromTx(context, reference, tx);
    return json(result);
  }

  const reference = String(url.searchParams.get('reference') || body.reference || '').trim();
  if (!reference) return json({ error: 'reference manquante' }, 400);

  try {
    const r = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
      headers: { Authorization: `Bearer ${secret}` },
    });
    const data = (await r.json().catch(() => ({}))) as Record<string, unknown>;
    if (!data?.status) {
      return json({ ok: false, error: (data.message as string) || 'Verification echouee', data }, 400);
    }
    const tx = (data.data || {}) as Record<string, unknown>;
    const paid = tx.status === 'success';
    const shouldActivate =
      request.method === 'POST' && (body.activate === true || body.activate === '1' || paid);

    if (shouldActivate && paid) {
      const act = await activateFromTx(context, reference, tx);
      return json({
        ok: true,
        status: tx.status,
        amount_fcfa: typeof tx.amount === 'number' ? Math.round(tx.amount / 100) : null,
        reference: tx.reference,
        activation: act,
      });
    }

    return json({
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
    return json({ error: e instanceof Error ? e.message : 'Erreur reseau' }, 500);
  }
}
