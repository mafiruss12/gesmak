// Deno Edge Function — envoi FCM HTTP v1 ou legacy server key
// Secrets: FCM_SERVER_KEY (legacy) ou GOOGLE_SERVICE_ACCOUNT_JSON + FCM_PROJECT_ID
// SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY fournis par Supabase

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function sendFcmLegacy(serverKey: string, tokens: string[], title: string, body: string, data: Record<string, string>) {
  const results = [];
  for (const token of tokens) {
    const res = await fetch('https://fcm.googleapis.com/fcm/send', {
      method: 'POST',
      headers: {
        Authorization: `key=${serverKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: token,
        priority: 'high',
        notification: { title, body, sound: 'default' },
        data,
      }),
    });
    results.push({ token: token.slice(0, 12), status: res.status, body: await res.text() });
  }
  return results;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  try {
    const { order_id, establishment_id } = await req.json();
    if (!order_id || !establishment_id) {
      return new Response(JSON.stringify({ error: 'order_id et establishment_id requis' }), {
        status: 400,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: order } = await supabase
      .from('orders')
      .select('id, total, notes, customer_name, table_number, source, establishment_id')
      .eq('id', order_id)
      .maybeSingle();

    if (!order) {
      return new Response(JSON.stringify({ error: 'Commande introuvable' }), {
        status: 404,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    // Staff de l'établissement (owner/manager/cashier)
    const { data: members } = await supabase
      .from('member_establishments')
      .select('user_id, role')
      .eq('establishment_id', establishment_id)
      .in('role', ['owner', 'manager', 'cashier', 'admin']);

    const userIds = (members || []).map((m: any) => m.user_id).filter(Boolean);
    if (!userIds.length) {
      return new Response(JSON.stringify({ ok: true, sent: 0, reason: 'no staff' }), {
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    const { data: tokens } = await supabase
      .from('device_push_tokens')
      .select('token, user_id, platform')
      .in('user_id', userIds)
      .eq('enabled', true);

    const tokenList = [...new Set((tokens || []).map((t: any) => t.token).filter(Boolean))];

    const title = 'Nouvelle commande';
    const body = [
      order.customer_name || order.notes || 'Commande',
      order.table_number ? `Table ${order.table_number}` : null,
      order.total != null ? `${Math.round(Number(order.total))} F` : null,
    ]
      .filter(Boolean)
      .join(' · ');

    // notifications in-app pour chaque user
    for (const uid of userIds) {
      await supabase.from('notifications').insert({
        user_id: uid,
        title,
        message: body,
        type: 'qr_order',
        link: '/kitchen',
        read: false,
      });
    }

    const serverKey = Deno.env.get('FCM_SERVER_KEY');
    let fcmResults: any[] = [];
    if (serverKey && tokenList.length) {
      fcmResults = await sendFcmLegacy(serverKey, tokenList, title, body, {
        order_id: String(order_id),
        establishment_id: String(establishment_id),
        link: '/kitchen',
      });
    }

    return new Response(
      JSON.stringify({
        ok: true,
        staff: userIds.length,
        tokens: tokenList.length,
        fcm: serverKey ? fcmResults : 'FCM_SERVER_KEY non configuré',
      }),
      { headers: { ...cors, 'Content-Type': 'application/json' } },
    );
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || String(e) }), {
      status: 500,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }
});
