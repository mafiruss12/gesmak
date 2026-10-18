import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const secret = process.env.PAYSTACK_SECRET_KEY || process.env.PAYSTACK_SECRET;
  if (!secret) {
    return res.status(503).json({
      error: 'Paystack non configuré',
      hint: 'Ajoutez PAYSTACK_SECRET_KEY dans Vercel',
    });
  }

  let body: Record<string, unknown> = {};
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  } catch {
    return res.status(400).json({ error: 'JSON invalide' });
  }

  const amountFcfa = Math.round(Number(body.amount) || 0);
  const email = String(body.email || body.customerEmail || '').trim();
  const reference = String(body.reference || body.transactionId || `SM-${Date.now()}`).slice(0, 50);
  const description = String(body.description || 'Abonnement Stock Manager AI').slice(0, 200);
  const baseUrl =
    process.env.APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://stock-manager-ktp.vercel.app');
  const callback_url = String(body.callback_url || body.returnUrl || `${baseUrl}/subscription?paystack=1`);

  if (amountFcfa < 100) return res.status(400).json({ error: 'Montant minimum 100 XOF' });
  if (!email.includes('@')) return res.status(400).json({ error: 'Email client requis pour Paystack' });

  const amount = amountFcfa * 100;
  const metaObj = (typeof body.metadata === 'object' && body.metadata) ? (body.metadata as Record<string, unknown>) : {};
  const customMeta = String(
    metaObj.custom_meta ||
      `${metaObj.establishment_id || ''}|${metaObj.months || 1}|${metaObj.user_id || ''}|${metaObj.plan_tier || 'starter'}`
  );

  try {
    const r = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secret}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        amount,
        currency: 'XOF',
        reference,
        callback_url,
        channels: ['card', 'mobile_money'],
        metadata: {
          custom_fields: [
            { display_name: 'Description', variable_name: 'description', value: description },
            { display_name: 'App', variable_name: 'app', value: 'stock-manager-ai' },
            { display_name: 'Meta', variable_name: 'custom_meta', value: customMeta },
          ],
          custom_meta: customMeta,
          establishment_id: metaObj.establishment_id || null,
          plan_tier: metaObj.plan_tier || 'starter',
          months: metaObj.months || 1,
          user_id: metaObj.user_id || null,
        },
      }),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok || !data?.status) {
      return res.status(400).json({
        error: data?.message || 'Échec initialisation Paystack',
        details: data,
      });
    }
    return res.status(200).json({
      ok: true,
      authorization_url: data.data?.authorization_url,
      access_code: data.data?.access_code,
      reference: data.data?.reference || reference,
      amount_fcfa: amountFcfa,
    });
  } catch (e: unknown) {
    return res.status(500).json({ error: e instanceof Error ? e.message : 'Erreur réseau Paystack' });
  }
}
