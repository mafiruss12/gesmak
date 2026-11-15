import { useEffect, useMemo, useState } from 'react';
import {
  ClipboardList,
  TrendingUp,
  Package,
  Wallet,
  AlertTriangle,
  Users,
  RefreshCw,
  Pencil,
  Building2,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { EmptyState } from '@/components/ui';
import type { Member } from '@/lib/types';
import { ROLE_LABELS } from '@/lib/types';
import { Link } from 'react-router-dom';
import { logAudit, newClientOpId } from '@/lib/audit';

type ProductRow = {
  id: string;
  name: string;
  category: string | null;
  stock: number;
  min_stock: number;
  unit: string | null;
  cost: number | null;
  price: number | null;
};

export default function SuiviGerant() {
  const { member, activeEstablishment, myEstablishments, switchEstablishment, effectiveRole } =
    useAuth();
  const [loading, setLoading] = useState(true);
  const [team, setTeam] = useState<Member[]>([]);
  const [salesToday, setSalesToday] = useState(0);
  const [salesCount, setSalesCount] = useState(0);
  const [expensesToday, setExpensesToday] = useState(0);
  const [lowStock, setLowStock] = useState(0);
  const [reportToday, setReportToday] = useState<Record<string, unknown> | null>(null);
  const [recentSales, setRecentSales] = useState<
    { id: string; total: number; qty: number; created_at: string; created_by: string | null }[]
  >([]);
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [editId, setEditId] = useState<string | null>(null);
  const [editStock, setEditStock] = useState('');
  const [editMin, setEditMin] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [auditRows, setAuditRows] = useState<any[]>([]);
  const [auditError, setAuditError] = useState('');

  const estId = activeEstablishment?.id || member?.establishment_id || null;
  const role = String(effectiveRole || member?.role || '');
  const canView = member && ['super_admin', 'admin', 'owner'].includes(member.role);
  const canEditStock = ['super_admin', 'admin', 'owner', 'manager'].includes(role);

  const nameByUser = useMemo(() => {
    const m = new Map<string, string>();
    for (const t of team) {
      if (t.user_id) m.set(t.user_id, t.full_name || t.email || ROLE_LABELS[t.role] || 'Équipe');
    }
    return m;
  }, [team]);

  async function load() {
    if (!estId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setMsg('');
    const start = new Date();
    start.setHours(0, 0, 0, 0);

    const [teamRes, salesRes, expRes, prodRes, reportRes] = await Promise.all([
      supabase.from('members').select('*').eq('establishment_id', estId).eq('status', 'active'),
      supabase
        .from('sales')
        .select('id, total, qty, created_at, created_by')
        .eq('establishment_id', estId)
        .gte('created_at', start.toISOString())
        .order('created_at', { ascending: false })
        .limit(40),
      supabase
        .from('expenses')
        .select('amount, created_at')
        .eq('establishment_id', estId)
        .gte('created_at', start.toISOString()),
      supabase
        .from('products')
        .select('id, name, category, stock, min_stock, unit, cost, price')
        .eq('establishment_id', estId)
        .order('name')
        .limit(80),
      supabase
        .from('daily_reports')
        .select('*')
        .eq('establishment_id', estId)
        .eq('date', start.toISOString().slice(0, 10))
        .maybeSingle(),
    ]);

    setTeam((teamRes.data ?? []) as Member[]);
    const sales = salesRes.data ?? [];
    setRecentSales(sales as typeof recentSales);
    setSalesCount(sales.length);
    setSalesToday(sales.reduce((s, x) => s + Number(x.total || 0), 0));
    setExpensesToday((expRes.data ?? []).reduce((s, x) => s + Number(x.amount || 0), 0));
    const prods = (prodRes.data ?? []) as ProductRow[];
    setProducts(prods);
    setLowStock(prods.filter((p) => Number(p.stock) <= Number(p.min_stock)).length);
    setReportToday((reportRes.data as Record<string, unknown>) || null);

    const { data: audits, error: audErr } = await supabase
      .from('operation_audit')
      .select('id, action, entity_label, actor_name, old_value, new_value, reason, created_at')
      .eq('establishment_id', estId)
      .order('created_at', { ascending: false })
      .limit(30);
    if (audErr) {
      setAuditError(audErr.message);
      setAuditRows([]);
    } else {
      setAuditError('');
      setAuditRows(audits || []);
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estId]);

  const managers = useMemo(
    () => team.filter((m) => ['manager', 'cashier', 'employee', 'owner'].includes(m.role)),
    [team]
  );

  const salesByStaff = useMemo(() => {
    const map = new Map<string, { name: string; total: number; count: number }>();
    for (const s of recentSales) {
      const uid = s.created_by || 'inconnu';
      const name = nameByUser.get(uid) || (uid === 'inconnu' ? 'Non attribué' : uid.slice(0, 8));
      const cur = map.get(uid) || { name, total: 0, count: 0 };
      cur.total += Number(s.total || 0);
      cur.count += 1;
      map.set(uid, cur);
    }
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [recentSales, nameByUser]);

  async function saveStockEdit(p: ProductRow) {
    if (!canEditStock) return;
    setSaving(true);
    setMsg('');
    const stock = Number(editStock);
    const min_stock = Number(editMin);
    if (Number.isNaN(stock) || stock < 0) {
      setMsg('Quantité invalide');
      setSaving(false);
      return;
    }
    const { error } = await supabase
      .from('products')
      .update({
        stock,
        min_stock: Number.isNaN(min_stock) ? p.min_stock : min_stock,
      })
      .eq('id', p.id)
      .eq('establishment_id', estId);
    setSaving(false);
    if (error) {
      setMsg(error.message);
      return;
    }
    await logAudit({
      establishment_id: estId,
      actor_id: member?.user_id,
      actor_name: member?.full_name || member?.email,
      action: 'stock.adjust',
      entity_type: 'product',
      entity_id: p.id,
      entity_label: p.name,
      old_value: { stock: p.stock, min_stock: p.min_stock },
      new_value: { stock, min_stock: Number.isNaN(min_stock) ? p.min_stock : min_stock },
      reason: 'Correction propriétaire / suivi',
      client_op_id: newClientOpId(),
    });
    setEditId(null);
    setMsg('Stock mis à jour (tracé dans l’audit)');
    await load();
  }

  if (!canView) {
    return (
      <EmptyState
        icon={<ClipboardList size={48} />}
        title="Suivi réservé"
        message="Réservé au propriétaire et à l’administrateur de l’établissement."
      />
    );
  }

  if (!estId) {
    return (
      <EmptyState
        icon={<Building2 size={48} />}
        title="Aucun établissement"
        message="Créez ou sélectionnez un établissement pour suivre le travail de l’équipe."
      />
    );
  }

  if (loading) {
    return <div className="flex justify-center py-20 text-stone-400">Chargement du suivi…</div>;
  }

  const margin = salesToday - expensesToday;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold font-display text-stone-100 flex items-center gap-2">
            <ClipboardList className="text-amber-400" /> Suivi gérant / équipe
          </h1>
          <p className="text-stone-400 text-sm">
            Vue propriétaire — {activeEstablishment?.name || 'Établissement actif'} · activité du jour
          </p>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          {(myEstablishments?.length || 0) > 1 && (
            <select
              className="input-field text-sm max-w-[220px]"
              value={estId}
              onChange={(e) => switchEstablishment(e.target.value)}
            >
              {myEstablishments.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </select>
          )}
          <button type="button" onClick={load} className="btn-secondary flex items-center gap-2 text-sm">
            <RefreshCw size={16} /> Actualiser
          </button>
          <Link to="/inventory" className="btn-primary text-sm flex items-center gap-2">
            <Package size={16} /> Gérer le stock
          </Link>
        </div>
      </div>

      {msg && (
        <div className="text-sm rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-200 px-3 py-2">
          {msg}
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="card">
          <p className="text-xs text-stone-500 flex items-center gap-1">
            <TrendingUp size={12} /> Ventes du jour
          </p>
          <p className="text-xl font-bold text-emerald-400 mt-1">{salesToday.toLocaleString('fr-FR')} F</p>
          <p className="text-xs text-stone-500">{salesCount} ticket(s)</p>
        </div>
        <div className="card">
          <p className="text-xs text-stone-500 flex items-center gap-1">
            <Wallet size={12} /> Dépenses du jour
          </p>
          <p className="text-xl font-bold text-orange-300 mt-1">{expensesToday.toLocaleString('fr-FR')} F</p>
        </div>
        <div className="card">
          <p className="text-xs text-stone-500">Marge brute jour</p>
          <p className={`text-xl font-bold mt-1 ${margin >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {margin.toLocaleString('fr-FR')} F
          </p>
        </div>
        <div className="card">
          <p className="text-xs text-stone-500 flex items-center gap-1">
            <Package size={12} /> Stock bas
          </p>
          <p className="text-xl font-bold text-amber-300 mt-1">{lowStock}</p>
          <p className="text-xs text-stone-500">article(s) ≤ seuil</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="card">
          <h2 className="font-semibold text-stone-100 mb-3 flex items-center gap-2">
            <Users size={18} /> Équipe sur cet établissement
          </h2>
          {managers.length === 0 ? (
            <p className="text-sm text-stone-500">
              Aucun membre. Créez des accès gérant / caissier dans{' '}
              <Link to="/team" className="text-amber-400 hover:underline">
                Mon équipe
              </Link>
              .
            </p>
          ) : (
            <ul className="space-y-2">
              {managers.map((m) => (
                <li
                  key={m.id}
                  className="flex items-center justify-between gap-2 text-sm border-b border-stone-800/80 py-2"
                >
                  <div>
                    <p className="text-stone-100 font-medium">{m.full_name || m.email}</p>
                    <p className="text-xs text-stone-500">{m.email}</p>
                  </div>
                  <span className="text-xs px-2 py-1 rounded-lg bg-stone-800 text-amber-200">
                    {ROLE_LABELS[m.role] || m.role}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card">
          <h2 className="font-semibold text-stone-100 mb-3 flex items-center gap-2">
            <ClipboardList size={18} /> Clôture du jour
          </h2>
          {reportToday ? (
            <div className="space-y-2 text-sm">
              <p className="text-emerald-400 font-medium">Clôture enregistrée</p>
              <p className="text-stone-400">
                Ventes: {Number(reportToday.total_sales || 0).toLocaleString('fr-FR')} F
              </p>
              <p className="text-stone-400">
                Dépenses: {Number(reportToday.total_expenses || 0).toLocaleString('fr-FR')} F
              </p>
              <p className="text-stone-400">Espèces: {Number(reportToday.cash || 0).toLocaleString('fr-FR')} F</p>
              {reportToday.notes ? (
                <p className="text-stone-500 text-xs">Notes: {String(reportToday.notes)}</p>
              ) : null}
              <Link to="/daily-report" className="text-sm text-amber-400 hover:underline">
                Voir détail →
              </Link>
            </div>
          ) : (
            <div className="flex items-start gap-2 text-sm">
              <AlertTriangle className="text-amber-400 shrink-0" size={18} />
              <div>
                <p className="text-amber-200 font-medium">Pas encore de clôture aujourd’hui</p>
                <p className="text-stone-500 text-xs mt-1">Le gérant doit faire la clôture en fin de service.</p>
                <Link to="/daily-report" className="text-amber-400 hover:underline text-xs">
                  Aller à la clôture →
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <h2 className="font-semibold text-stone-100 mb-3">Performance équipe (ventes du jour)</h2>
        {salesByStaff.length === 0 ? (
          <p className="text-sm text-stone-500">Aucune vente attribuée aujourd’hui.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-stone-500 text-left border-b border-stone-800">
                  <th className="py-2">Membre</th>
                  <th className="py-2">Tickets</th>
                  <th className="py-2">Total</th>
                </tr>
              </thead>
              <tbody>
                {salesByStaff.map((row) => (
                  <tr key={row.name} className="border-b border-stone-800/60">
                    <td className="py-2 text-stone-200">{row.name}</td>
                    <td className="py-2 text-stone-400">{row.count}</td>
                    <td className="py-2 text-emerald-400 font-medium">
                      {row.total.toLocaleString('fr-FR')} F
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card">
        <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
          <h2 className="font-semibold text-stone-100 flex items-center gap-2">
            <Package size={18} /> Stock — modification propriétaire
          </h2>
          <Link to="/inventory" className="text-sm text-amber-400 hover:underline">
            Inventaire complet →
          </Link>
        </div>
        <p className="text-xs text-stone-500 mb-3">
          Ajustez les quantités et seuils sans dépendre du gérant. Les changements s’appliquent à{' '}
          <strong className="text-stone-300">{activeEstablishment?.name || 'cet établissement'}</strong>.
        </p>
        {products.length === 0 ? (
          <p className="text-sm text-stone-500">
            Aucun produit. Importez un catalogue dans{' '}
            <Link to="/inventory" className="text-amber-400 hover:underline">
              Inventaire
            </Link>
            .
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[640px]">
              <thead>
                <tr className="text-stone-500 text-left border-b border-stone-800">
                  <th className="py-2 pr-2">Article</th>
                  <th className="py-2 pr-2">Stock</th>
                  <th className="py-2 pr-2">Min</th>
                  <th className="py-2">Action</th>
                </tr>
              </thead>
              <tbody>
                {products.slice(0, 40).map((p) => {
                  const low = Number(p.stock) <= Number(p.min_stock);
                  const editing = editId === p.id;
                  return (
                    <tr key={p.id} className="border-b border-stone-800/60">
                      <td className="py-2 pr-2">
                        <p className="text-stone-100">{p.name}</p>
                        <p className="text-xs text-stone-500">
                          {p.category}
                          {low ? ' · stock bas' : ''}
                        </p>
                      </td>
                      <td className="py-2 pr-2">
                        {editing ? (
                          <input
                            type="number"
                            className="input-field w-24"
                            value={editStock}
                            onChange={(e) => setEditStock(e.target.value)}
                          />
                        ) : (
                          <span className={low ? 'text-amber-300 font-medium' : 'text-stone-300'}>
                            {p.stock}
                          </span>
                        )}
                      </td>
                      <td className="py-2 pr-2">
                        {editing ? (
                          <input
                            type="number"
                            className="input-field w-20"
                            value={editMin}
                            onChange={(e) => setEditMin(e.target.value)}
                          />
                        ) : (
                          <span className="text-stone-400">{p.min_stock}</span>
                        )}
                      </td>
                      <td className="py-2">
                        {canEditStock &&
                          (editing ? (
                            <div className="flex gap-2">
                              <button
                                type="button"
                                disabled={saving}
                                onClick={() => saveStockEdit(p)}
                                className="text-xs px-2 py-1 rounded-lg bg-emerald-600 text-white"
                              >
                                Sauver
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditId(null)}
                                className="text-xs px-2 py-1 rounded-lg border border-stone-600 text-stone-300"
                              >
                                Annuler
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                setEditId(p.id);
                                setEditStock(String(p.stock));
                                setEditMin(String(p.min_stock));
                              }}
                              className="text-xs flex items-center gap-1 text-amber-300 hover:underline"
                            >
                              <Pencil size={12} /> Modifier
                            </button>
                          ))}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card">
        <h2 className="font-semibold text-stone-100 mb-3">Journal d&apos;audit (récent)</h2>
        <p className="text-xs text-stone-500 mb-3">
          Qui a modifié quoi — source de vérité pour le propriétaire (stock, produits).
        </p>
        {auditError ? (
          <p className="text-sm text-amber-200/90 bg-amber-500/10 border border-amber-500/30 rounded-xl px-3 py-2">
            Audit non disponible sur la base pour l&apos;instant ({auditError}). La migration{' '}
            <code className="text-xs">operation_audit</code> doit être appliquée sur Supabase.
          </p>
        ) : auditRows.length === 0 ? (
          <p className="text-sm text-stone-500">Aucune opération sensible enregistrée pour le moment.</p>
        ) : (
          <ul className="space-y-2 max-h-80 overflow-y-auto">
            {auditRows.map((a) => {
              const oldS = a.old_value?.stock;
              const newS = a.new_value?.stock;
              const detail =
                oldS !== undefined && newS !== undefined
                  ? `stock ${oldS} → ${newS}`
                  : a.action;
              return (
                <li key={a.id} className="text-sm border-b border-stone-800/80 pb-2">
                  <p className="text-stone-200">
                    <span className="text-amber-300">{a.entity_label || a.entity_type}</span>
                    {' · '}
                    {detail}
                  </p>
                  <p className="text-xs text-stone-500">
                    {a.actor_name || 'Utilisateur'} · {a.action} ·{' '}
                    {a.created_at
                      ? new Date(a.created_at).toLocaleString('fr-FR', {
                          day: '2-digit',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : ''}
                    {a.reason ? ` · ${a.reason}` : ''}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="card">
        <h2 className="font-semibold text-stone-100 mb-3">Dernières ventes (aujourd’hui)</h2>
        {recentSales.length === 0 ? (
          <p className="text-sm text-stone-500">Aucune vente enregistrée aujourd’hui.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-stone-500 text-left border-b border-stone-800">
                  <th className="py-2 pr-3">Heure</th>
                  <th className="py-2 pr-3">Par</th>
                  <th className="py-2 pr-3">Qté</th>
                  <th className="py-2">Total</th>
                </tr>
              </thead>
              <tbody>
                {recentSales.slice(0, 20).map((s) => (
                  <tr key={s.id} className="border-b border-stone-800/60">
                    <td className="py-2 pr-3 text-stone-400">
                      {new Date(s.created_at).toLocaleTimeString('fr-FR', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="py-2 pr-3 text-stone-300 text-xs">
                      {s.created_by ? nameByUser.get(s.created_by) || '—' : '—'}
                    </td>
                    <td className="py-2 pr-3 text-stone-300">{s.qty}</td>
                    <td className="py-2 text-emerald-400 font-medium">
                      {Number(s.total).toLocaleString('fr-FR')} F
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Link to="/pos" className="inline-block mt-3 text-sm text-primary-400 hover:underline">
          Ouvrir la caisse →
        </Link>
      </div>
    </div>
  );
}
