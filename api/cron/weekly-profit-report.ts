/**
 * Cron lundi : rapport bénéfice semaine → notifications propriétaire
 * GET/POST /api/cron/weekly-profit-report
 * Header obligatoire: Authorization: Bearer <CRON_SECRET>
 * Schedule: 0 7 * * 1
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';

function getEnv(name: string): string | undefined {
  return process.env[name] || process.env[`VITE_${name}`];
}

function mondayOf(d = new Date()): string {
  const x = new Date(d);
  const day = x.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  x.setUTCDate(x.getUTCDate() + diff);
  return x.toISOString().slice(0, 10);
}

function addDaysISO(iso: string, n: number): string {
  const d = new Date(iso + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const secret = getEnv('CRON_SECRET');
  if (!secret) {
    return res.status(500).json({ error: 'CRON_SECRET manquant (obligatoire)' });
  }

  const auth = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (auth !== secret) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const supabaseUrl = getEnv('SUPABASE_URL') || getEnv('VITE_SUPABASE_URL');
  const serviceKey = getEnv('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceKey) {
    return res.status(503).json({ error: 'SUPABASE_SERVICE_ROLE_KEY manquant' });
  }

  const thisMon = mondayOf(new Date());
  const lastMon = addDaysISO(thisMon, -7);
  const lastSun = addDaysISO(lastMon, 6);

  const headers = {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    'Content-Type': 'application/json',
  };

  const estRes = await fetch(
    `${supabaseUrl}/rest/v1/establishments?select=id,name,owner_id,type&status=eq.active`,
    { headers }
  );
  const establishments = (await estRes.json()) as { id: string; name: string; owner_id?: string }[];
  if (!Array.isArray(establishments)) {
    return res.status(500).json({ error: 'establishments fetch failed', raw: establishments });
  }

  const results: { est: string; profit: number; notified: boolean }[] = [];

  for (const est of establishments) {
    const repRes = await fetch(
      `${supabaseUrl}/rest/v1/daily_reports?establishment_id=eq.${est.id}&date=gte.${lastMon}&date=lte.${lastSun}&select=*`,
      { headers }
    );
    const reports = (await repRes.json()) as any[];

    let totalCA = 0;
    let totalCost = 0;
    let totalProfit = 0;

    if (Array.isArray(reports)) {
      for (const r of reports) {
        try {
          totalCA += Number(r.total_sales || r.ca || 0);
          totalCost += Number(r.total_cost || r.cost || 0);
          totalProfit += Number(r.profit || r.benefice || (Number(r.total_sales || 0) - Number(r.total_cost || 0)));
        } catch {
          totalCA += Number(r.total_sales || 0);
        }
      }
    }

    let ownerUserId = est.owner_id;
    let ownerPhone = '';
    const memRes = await fetch(
      `${supabaseUrl}/rest/v1/members?establishment_id=eq.${est.id}&role=eq.owner&status=eq.active&select=user_id,phone,full_name&limit=1`,
      { headers }
    );
    const members = (await memRes.json()) as { user_id?: string; phone?: string }[];
    if (Array.isArray(members) && members[0]) {
      ownerUserId = members[0].user_id || ownerUserId;
      ownerPhone = members[0].phone || '';
    }

    const msg = [
      `📊 Rapport semaine — ${est.name}`,
      `Du ${lastMon} au ${lastSun}`,
      `CA: ${Math.round(totalCA).toLocaleString('fr-FR')} F`,
      `Coût vendu: ${Math.round(totalCost).toLocaleString('fr-FR')} F`,
      `✅ Bénéfice (marge): ${Math.round(totalProfit).toLocaleString('fr-FR')} F`,
      '',
      'Stock Manager AI',
    ].join('\n');

    let notified = false;
    if (ownerUserId) {
      await fetch(`${supabaseUrl}/rest/v1/notifications`, {
        method: 'POST',
        headers: { ...headers, Prefer: 'return=minimal' },
        body: JSON.stringify({
          user_id: ownerUserId,
          title: `Bénéfice semaine — ${est.name}`,
          body: msg.slice(0, 500),
          message: msg.slice(0, 500),
          type: 'weekly_profit',
          read: false,
        }),
      }).catch(() => null);
      notified = true;
    }

    const waToken = getEnv('WA_TOKEN');
    const waPhoneId = getEnv('WA_PHONE_NUMBER_ID');
    if (waToken && waPhoneId && ownerPhone) {
      let to = ownerPhone.replace(/\D/g, '');
      if (to.startsWith('0') && to.length === 10) to = '225' + to;
      await fetch(`https://graph.facebook.com/v19.0/${waPhoneId}/messages`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${waToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to,
          type: 'text',
          text: { body: msg.slice(0, 4000) },
        }),
      }).catch(() => null);
    }

    results.push({ est: est.name, profit: totalProfit, notified });
  }

  return res.status(200).json({
    ok: true,
    period: { from: lastMon, to: lastSun },
    results,
  });
}
