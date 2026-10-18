import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const secret = process.env.PAYSTACK_SECRET_KEY || process.env.PAYSTACK_SECRET;
  if (!secret) return res.status(503).json({ error: 'Paystack non configuré' });

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
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
    return res.status(200).json({
      ok: paid,
      status: tx.status,
      amount_fcfa: typeof tx.amount === 'number' ? Math.round(tx.amount / 100) : null,
      currency: tx.currency,
      reference: tx.reference,
      paid_at: tx.paid_at,
      channel: tx.channel,
      metadata: tx.metadata || null,
      customer: tx.customer,
    });
  } catch (e: unknown) {
    return res.status(500).json({ error: e instanceof Error ? e.message : 'Erreur réseau' });
  }
}
