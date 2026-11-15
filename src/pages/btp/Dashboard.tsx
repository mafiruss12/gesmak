import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FileText, Users, Package, Plus, TrendingUp } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { formatMoney, DOC_TYPE_LABELS, DOC_STATUS_LABELS } from '@/lib/btp';
import AdMarquee from '@/components/AdMarquee';

export default function BtpDashboard() {
  const { member, activeEstablishment } = useAuth();
  const [stats, setStats] = useState({ docs: 0, quotes: 0, invoices: 0, clients: 0, materials: 0, ttcMonth: 0 });
  const [recent, setRecent] = useState<any[]>([]);

  useEffect(() => {
    const est = activeEstablishment?.id || member?.establishment_id;
    if (!est) return;
    (async () => {
      const [d, c, m] = await Promise.all([
        supabase.from('btp_documents').select('id, type, status, total_ttc, title, doc_number, date, client_name').eq('establishment_id', est).order('created_at', { ascending: false }),
        supabase.from('btp_clients').select('id', { count: 'exact', head: true }).eq('establishment_id', est),
        supabase.from('btp_materials').select('id', { count: 'exact', head: true }).eq('establishment_id', est),
      ]);
      const docs = d.data || [];
      const startMonth = new Date();
      startMonth.setDate(1);
      const iso = startMonth.toISOString().slice(0, 10);
      const ttcMonth = docs.filter((x) => x.date >= iso && x.type === 'invoice').reduce((s, x) => s + Number(x.total_ttc || 0), 0);
      setStats({
        docs: docs.length,
        quotes: docs.filter((x) => x.type === 'quote').length,
        invoices: docs.filter((x) => x.type === 'invoice').length,
        clients: c.count || 0,
        materials: m.count || 0,
        ttcMonth,
      });
      setRecent(docs.slice(0, 8));
    })();
  }, [member?.establishment_id, activeEstablishment?.id]);

  return (
    <div className="space-y-6">
      <AdMarquee className="mb-2" />
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-sky-400">Mode BTP / BatiDevis</p>
        <h1 className="text-2xl font-bold font-display text-stone-100">{activeEstablishment?.name || 'Tableau de bord BTP'}</h1>
        <p className="text-stone-400 text-sm">Devis, factures et matériaux chantier</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="card"><p className="text-xs text-stone-500">Documents</p><p className="text-2xl font-bold text-stone-100">{stats.docs}</p></div>
        <div className="card"><p className="text-xs text-stone-500">Devis</p><p className="text-2xl font-bold text-sky-400">{stats.quotes}</p></div>
        <div className="card"><p className="text-xs text-stone-500">Factures</p><p className="text-2xl font-bold text-emerald-400">{stats.invoices}</p></div>
        <div className="card"><p className="text-xs text-stone-500">CA factures (mois)</p><p className="text-lg font-bold text-amber-400">{formatMoney(stats.ttcMonth)}</p></div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Link to="/btp/documents" className="card hover:border-sky-500/50 flex items-center gap-3">
          <FileText className="text-sky-400" size={22} />
          <div><p className="font-semibold text-stone-100">Devis & factures</p><p className="text-xs text-stone-500">Créer / gérer</p></div>
        </Link>
        <Link to="/btp/clients" className="card hover:border-sky-500/50 flex items-center gap-3">
          <Users className="text-sky-400" size={22} />
          <div><p className="font-semibold text-stone-100">Clients ({stats.clients})</p><p className="text-xs text-stone-500">Chantiers</p></div>
        </Link>
        <Link to="/btp/materials" className="card hover:border-sky-500/50 flex items-center gap-3">
          <Package className="text-sky-400" size={22} />
          <div><p className="font-semibold text-stone-100">Matériaux ({stats.materials})</p><p className="text-xs text-stone-500">Catalogue</p></div>
        </Link>
      </div>

      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-stone-100 flex items-center gap-2"><TrendingUp size={18} /> Récents</h2>
          <Link to="/btp/documents" className="btn-primary text-xs inline-flex items-center gap-1"><Plus size={14} /> Nouveau</Link>
        </div>
        {recent.length === 0 ? (
          <p className="text-sm text-stone-500">Aucun document. Créez un devis pour démarrer.</p>
        ) : (
          <ul className="space-y-2">
            {recent.map((d) => (
              <li key={d.id} className="flex items-center justify-between gap-2 text-sm border-b border-stone-800 pb-2">
                <div className="min-w-0">
                  <p className="font-medium text-stone-200 truncate">{d.doc_number} — {d.title || DOC_TYPE_LABELS[d.type as keyof typeof DOC_TYPE_LABELS]}</p>
                  <p className="text-xs text-stone-500">{d.client_name || '—'} · {d.date}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-semibold text-stone-100">{formatMoney(d.total_ttc)}</p>
                  <p className="text-[10px] text-stone-500">{DOC_STATUS_LABELS[d.status as keyof typeof DOC_STATUS_LABELS] || d.status}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
