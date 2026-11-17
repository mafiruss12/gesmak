import { supabase } from '@/lib/supabase';

export type ServerCandidate = {
  user_id: string;
  full_name: string;
  email?: string | null;
  role?: string | null;
  on_duty: boolean;
  open_tables: number;
  open_orders: number;
  score: number; // plus bas = mieux
  zone_hint?: string | null;
};

/** Charge les membres pouvant servir + charge actuelle */
export async function loadServerCandidates(establishmentId: string): Promise<ServerCandidate[]> {
  const { data: members } = await supabase
    .from('members')
    .select('user_id, full_name, email, role, on_duty, status')
    .eq('establishment_id', establishmentId)
    .eq('status', 'active');

  const list = (members || []).filter((m: any) => {
    if (!m.user_id) return false;
    const role = String(m.role || '').toLowerCase();
    // tous les rôles terrain peuvent servir ; on exclut seulement si explicitement hors service
    return true;
  });

  const { data: tables } = await supabase
    .from('restaurant_tables')
    .select('id, server_id, status, location')
    .eq('establishment_id', establishmentId);

  const { data: orders } = await supabase
    .from('orders')
    .select('id, server_id, status, table_id')
    .eq('establishment_id', establishmentId)
    .in('status', ['pending', 'preparing', 'ready']);

  const tableCount: Record<string, number> = {};
  const orderCount: Record<string, number> = {};
  for (const t of tables || []) {
    if (t.server_id && t.status === 'occupied') {
      tableCount[t.server_id] = (tableCount[t.server_id] || 0) + 1;
    }
  }
  for (const o of orders || []) {
    if (o.server_id) {
      orderCount[o.server_id] = (orderCount[o.server_id] || 0) + 1;
    }
  }

  const candidates: ServerCandidate[] = list.map((m: any) => {
    const open_tables = tableCount[m.user_id] || 0;
    const open_orders = orderCount[m.user_id] || 0;
    const on_duty = m.on_duty !== false;
    // score : hors service pénalisé, puis charge
    const score = (on_duty ? 0 : 1000) + open_tables * 10 + open_orders * 5;
    return {
      user_id: m.user_id,
      full_name: m.full_name || m.email || 'Serveur',
      email: m.email,
      role: m.role,
      on_duty,
      open_tables,
      open_orders,
      score,
    };
  });

  return candidates.sort((a, b) => a.score - b.score || a.full_name.localeCompare(b.full_name));
}

/** Top suggestions (en service d’abord) */
export function suggestServers(candidates: ServerCandidate[], limit = 3): ServerCandidate[] {
  const onDuty = candidates.filter((c) => c.on_duty);
  const pool = onDuty.length ? onDuty : candidates;
  return pool.slice(0, limit);
}

export async function assignServerToTable(opts: {
  tableId: string;
  serverId: string | null;
  serverName: string | null;
}) {
  return supabase
    .from('restaurant_tables')
    .update({ server_id: opts.serverId, server_name: opts.serverName })
    .eq('id', opts.tableId);
}

export async function assignServerToOrder(opts: {
  orderId: string;
  serverId: string | null;
  serverName: string | null;
  tableId?: string | null;
}) {
  const { error } = await supabase
    .from('orders')
    .update({ server_id: opts.serverId, server_name: opts.serverName })
    .eq('id', opts.orderId);
  if (error) return { error };
  if (opts.tableId && opts.serverId) {
    await assignServerToTable({
      tableId: opts.tableId,
      serverId: opts.serverId,
      serverName: opts.serverName,
    });
  }
  // notif au serveur
  if (opts.serverId) {
    await supabase.from('notifications').insert({
      user_id: opts.serverId,
      title: 'Table assignée',
      message: `On vous a confié un service${opts.serverName ? '' : ''}. Ouvrez « Mon service ».`,
      type: 'service',
      link: '/mon-service',
      read: false,
      action_label: 'Mon service',
    });
  }
  return { error: null };
}

/** Auto : serveur le moins chargé en service */
export async function autoAssignOrder(establishmentId: string, orderId: string, tableId?: string | null) {
  const candidates = await loadServerCandidates(establishmentId);
  const top = suggestServers(candidates, 1)[0];
  if (!top) return null;
  await assignServerToOrder({
    orderId,
    serverId: top.user_id,
    serverName: top.full_name,
    tableId,
  });
  return top;
}
