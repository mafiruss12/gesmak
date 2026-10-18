import { json, env, readBody, noContent } from '../_lib/http';

const SITE = 'https://stock-manager-ai.pages.dev';

export async function onRequest(context: { request: Request; env: Record<string, string | undefined> }) {
  const { request } = context;
  if (request.method === 'OPTIONS') return noContent();
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const secret = env(context, 'PAYSTACK_SECRET_KEY') || env(context, 'PAYSTACK_SECRET');
  if (!secret) {
    return json({
      error: 'Paystack non configure',
      hint: 'Ajoutez PAYSTACK_SECRET_KEY dans Cloudflare Pages Environment variables',
    }, 503);
  }

  const body = await readBody(request);
  const amountFcfa = Math.round(Number(body.amount) || 0);
  const email = String(body.email || body.customerEmail || '').trim();
  const reference = String(body.reference || body.transactionId || `SM-${Date.now()}`).slice(0, 50);
  const description = String(body.description || 'Abonnement Stock Manager AI').slice(0, 200);
  const callback_url = String(body.callback_url || body.returnUrl || `${SITE}/subscription?paystack=1`);

  if (amountFcfa < 100) return json({ error: 'Montant minimum 100 XOF' }, 400);
  if (!email.includes('@')) return json({ error: 'Email client requis pour Paystack' }, 400);

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
        amount: amountFcfa * 100,
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
    const data = (await r.json().catch(() => ({}))) as Record<string, unknown>;
    const status = data.status;
    const dataObj = data.data as Record<string, unknown> | undefined;
    if (!r.ok || !status) {
      return json({ error: (data.message as string) || 'Echec initialisation Paystack', details: data }, 400);
    }
    return json({
      ok: true,
      authorization_url: dataObj?.authorization_url,
      access_code: dataObj?.access_code,
      reference: dataObj?.reference || reference,
      amount_fcfa: amountFcfa,
    });
  } catch (e: unknown) {
    return json({ error: e instanceof Error ? e.message : 'Erreur reseau Paystack' }, 500);
  }
}
