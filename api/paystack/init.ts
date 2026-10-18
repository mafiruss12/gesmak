import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * POST /api/paystack/init
 * Body: { amount, email, reference?, description?, callback_url?, metadata? }
 * Env: PAYSTACK_SECRET_KEY (jamais côté client)
 * Montant en FCFA (XOF) — converti en subunit (* 100) pour Paystack
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const secret = process.env.PAYSTACK_SECRET_KEY || process.env.PAYSTACK_SECRET;
  if (!secret) {
    return res.status(503).json({
      error: 'Paystack non configuré',
      hint: 'Ajoutez PAYSTACK_SECRET_KEY dans Vercel → Settings → Environment Variables',
    });
  }

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
  const amountFcfa = Math.round(Number(body.amount) || 0);
  const email = String(body.email || body.customerEmail || 'client@stock-manager.local').trim();
  const reference = String(body.reference || body.transactionId || `SM-${Date.now()}`).slice(0, 50);
  const description = String(body.description || 'Abonnement Stock Manager AI').slice(0, 200);
  const baseUrl =
    process.env.APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://stock-manager-ktp.vercel.app');
  const callback_url = String(body.callback_url || body.returnUrl || `${baseUrl}/subscription?paystack=1`);

  if (amountFcfa < 100) return res.status(400).json({ error: 'Montant minimum 100 XOF' });
  if (!email.includes('@')) return res.status(400).json({ error: 'Email client requis pour Paystack' });

  // XOF: Paystack attend le montant en subunit (centimes) → * 100
  const amount = amountFcfa * 100;

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
          ],
          ...(typeof body.metadata === 'object' && body.metadata ? body.metadata : {}),
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
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'Erreur réseau Paystack' });
  }
}
