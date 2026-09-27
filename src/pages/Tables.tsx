import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  LayoutGrid, Printer, Plus, Trash2, Users, CheckCircle2, Calendar, UserCircle,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import type { RestaurantTable, Member } from '@/lib/types';
import { Modal, EmptyState, Badge } from '@/components/ui';
import { orderUrl, qrImageUrl, parseQrConfig, type QrConfig } from '@/lib/qrBranding';
import { openOrderForTable } from '@/lib/restaurant';

type TableRow = RestaurantTable & {
  server_id?: string | null;
  server_name?: string | null;
};

const STATUS_STYLE: Record<string, string> = {
  free: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200',
  occupied: 'border-amber-500/40 bg-amber-500/10 text-amber-200',
  reserved: 'border-sky-500/40 bg-sky-500/10 text-sky-200',
  cleaning: 'border-stone-500/40 bg-stone-500/10 text-stone-300',
};
const STATUS_LABEL: Record<string, string> = {
  free: 'Libre',
  occupied: 'Occupée',
  reserved: 'Réservée',
  cleaning: 'Nettoyage',
};

export default function Tables() {

  const navigate = useNavigate();
  const { member, user, activeEstablishment } = useAuth();
  const estId = activeEstablishment?.id || member?.establishment_id || null;
  const orderBase = typeof window !== 'undefined' ? `${window.location.origin}/commander/${estId}` : '';
  const [tables, setTables] = useState<TableRow[]>([]);
  const [servers, setServers] = useState<Pick<Member, 'user_id' | 'full_name' | 'email' | 'role'>[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState<TableRow | null>(null);
  const [form, setForm] = useState({ number: '', seats: '4', location: 'salle' });
  const [estSlug, setEstSlug] = useState<string | null>(null);
  const [qrCfg, setQrCfg] = useState<QrConfig>({});
  const [estName, setEstName] = useState('');

  async function load() {
    if (!estId) {
      setLoading(false);
      return;
    }
    const [tRes, mRes, eRes] = await Promise.all([
      supabase.from('restaurant_tables').select('*').eq('establishment_id', estId).order('number'),
      supabase
        .from('members')
        .select('user_id, full_name, email, role, on_duty')
        .eq('establishment_id', estId)
        .eq('status', 'active'),
      supabase
        .from('establishments')
        .select('name, slug, qr_config')
        .eq('id', estId)
        .maybeSingle(),
    ]);
    setTables((tRes.data ?? []) as TableRow[]);
    setServers((mRes.data ?? []) as Pick<Member, 'user_id' | 'full_name' | 'email' | 'role'>[]);
    if (eRes.data) {
      setEstName(String((eRes.data as any).name || ''));
      setEstSlug((eRes.data as any).slug || null);
      setQrCfg(parseQrConfig((eRes.data as any).qr_config));
    }
    setLoading(false);
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estId]);

  async function save() {
    if (!estId || !form.number) return;
    await supabase.from('restaurant_tables').insert({
      establishment_id: estId,
      number: form.number,
      seats: Number(form.seats) || 4,
      location: form.location,
    });
    setModalOpen(false);
    setForm({ number: '', seats: '4', location: 'salle' });
    await load();
  }

  async function remove(t: TableRow) {
    if (!confirm(`Supprimer la table ${t.number} ?`)) return;
    await supabase.from('restaurant_tables').delete().eq('id', t.id);
    await load();
  }

  async function cycleStatus(t: TableRow) {
    const next: Record<string, string> = { free: 'occupied', occupied: 'reserved', reserved: 'cleaning', cleaning: 'free' };
    await supabase.from('restaurant_tables').update({ status: next[t.status] || 'free' }).eq('id', t.id);
    await load();
  }

  async function startOrder(t: TableRow) {
    if (!estId || !user?.id) return;
    if (!confirm(`Ouvrir une commande pour la table ${t.number} ?`)) return;
    try {
      const orderId = await openOrderForTable({
        estId,
        tableId: t.id,
        tableNumber: String(t.number),
        userId: user.id,
      });
      navigate(`/orders?order=${orderId}&table=${t.number}`);
    } catch (e: any) {
      alert(e?.message || 'Impossible d’ouvrir la commande');
    }
  }

  async function assignServer(table: TableRow, userId: string | null) {
    const srv = servers.find((s) => s.user_id === userId);
    const payload: Record<string, unknown> = {
      server_id: userId,
      server_name: srv ? srv.full_name || srv.email : null,
    };
    const { error } = await supabase.from('restaurant_tables').update(payload).eq('id', table.id);
    if (error && error.message.includes('server_id')) {
      // colonne absente tant que migration non appliquée
      alert('Colonnes serveur absentes — appliquez la migration Phase 2.');
    }
    setAssignOpen(null);
    await load();
  }

  if (loading) {
    return <div className="flex items-center justify-center py-20 text-stone-400">Chargement...</div>;
  }
  if (!estId) {
    return (
      <EmptyState
        icon={<LayoutGrid size={48} />}
        title="Aucun établissement"
        message="Vous n'êtes rattaché à aucun établissement."
      />
    );
  }

  const free = tables.filter((t) => t.status === 'free').length;
  const occupied = tables.filter((t) => t.status === 'occupied').length;
  const reserved = tables.filter((t) => t.status === 'reserved').length;
  const totalSeats = tables.reduce((s, t) => s + Number(t.seats || 0), 0);

  return (
    <div>
      <div className="flex items-center justify-between mb-6 gap-2 flex-wrap">
        <Link to="/print-qr" className="btn-secondary text-sm flex items-center gap-1 order-last">
          Imprimer QR
        </Link>
        <div>
          <p className="text-xs text-amber-400/90 mb-1">QR propre à votre établissement · personnalisable dans Menu / QR</p>
          <h1 className="text-2xl font-bold font-display text-stone-100">Tables & serveurs</h1>
          <p className="text-stone-400 text-sm">
            {tables.length} tables · {totalSeats} places · {free} libres
          </p>
          <p className="text-xs text-stone-500 mt-2">
            Phase A : imprimez le QR de chaque table. Le client commande sur son téléphone → Cuisine / Bar reçoit la commande.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="btn-primary flex items-center gap-2"
        >
          <Plus size={18} /> Ajouter
        </button>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="card flex items-center gap-3">
          <CheckCircle2 size={20} className="text-success-400" />
          <div>
            <p className="text-sm text-stone-400">Libres</p>
            <p className="text-xl font-bold text-stone-100">{free}</p>
          </div>
        </div>
        <div className="card flex items-center gap-3">
          <Users size={20} className="text-error-400" />
          <div>
            <p className="text-sm text-stone-400">Occupées</p>
            <p className="text-xl font-bold text-stone-100">{occupied}</p>
          </div>
        </div>
        <div className="card flex items-center gap-3">
          <Calendar size={20} className="text-warning-400" />
          <div>
            <p className="text-sm text-stone-400">Réservées</p>
            <p className="text-xl font-bold text-stone-100">{reserved}</p>
          </div>
        </div>
      </div>

      {tables.length === 0 ? (
        <EmptyState icon={<LayoutGrid size={48} />} title="Aucune table" message="Ajoutez vos tables (salle, terrasse, VIP…)." />
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {tables.map((t) => (
            <div
              key={t.id}
              className={`relative card text-center transition-all ${
                t.status === 'free'
                  ? 'border-success-500/30 bg-success-500/5'
                  : t.status === 'occupied'
                    ? 'border-error-500/30 bg-error-500/5'
                    : 'border-warning-500/30 bg-warning-500/5'
              } ${STATUS_STYLE[t.status] || ''}`}
            >
              <div className="absolute top-2 right-2 flex gap-1">
                <button
                  type="button"
                  onClick={() => setAssignOpen(t)}
                  className="text-stone-500 hover:text-amber-400"
                  title="Assigner serveur"
                >
                  <UserCircle size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => void remove(t)}
                  className="text-stone-500 hover:text-error-400"
                >
                  <Trash2 size={14} />
                </button>
              </div>
              <button type="button" onClick={() => void cycleStatus(t)}
                  onDoubleClick={() => void startOrder(t)} className="w-full pt-1">
                <div className="text-3xl font-bold font-display text-stone-100 mb-1">{t.number}</div>
                <div className="flex items-center justify-center gap-1 text-sm text-stone-400 mb-2">
                  <Users size={12} /> {t.seats}
                </div>
                <Badge
                  color={
                    t.status === 'free' ? 'success' : t.status === 'occupied' ? 'error' : 'warning'
                  }
                >
                  {t.status === 'free' ? 'Libre' : t.status === 'occupied' ? 'Occupée' : 'Réservée'}
                </Badge>
                <p className="text-xs text-stone-500 mt-2">{t.location}</p>
                {t.server_name && (
                  <p className="text-[11px] text-amber-400/90 mt-1 truncate">👤 {t.server_name}</p>
                )}
              </button>
              {estId && (
                <div className="mt-3 flex flex-col items-center gap-1 border-t border-stone-800 pt-3">
                  {(() => {
                    const estKey = estSlug || estId!;
                    const url = orderUrl({
                      origin: window.location.origin,
                      estKey,
                      table: t.number,
                      kiosk: qrCfg.kiosk_default !== false,
                    });
                    return (
                      <>
                        <img
                          alt={`QR ${estName || 'établissement'} · table ${t.number}`}
                          className="w-28 h-28 rounded-lg bg-white p-1"
                          src={qrImageUrl(url, qrCfg, 160)}
                        />
                        <p className="text-[10px] text-stone-400 text-center font-medium truncate w-full px-1">
                          {estName || 'Mon établissement'}
                        </p>
                        <p className="text-[10px] text-stone-500 text-center">Table {t.number}</p>
                        <button
                          type="button"
                          className="text-[11px] text-amber-400"
                          onClick={() => {
                            void navigator.clipboard?.writeText(url);
                            alert('Lien propre à cet établissement :\n' + url);
                          }}
                        >
                          Copier le lien
                        </button>
                      </>
                    );
                  })()}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Nouvelle table">
        <div className="space-y-3">
          <div>
            <label className="label">Numéro / Nom</label>
            <input
              value={form.number}
              onChange={(e) => setForm({ ...form, number: e.target.value })}
              className="input-field"
              placeholder="T1 ou Terrasse A"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Places</label>
              <input
                type="number"
                value={form.seats}
                onChange={(e) => setForm({ ...form, seats: e.target.value })}
                className="input-field"
              />
            </div>
            <div>
              <label className="label">Zone</label>
              <select
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
                className="input-field"
              >
                <option value="salle">Salle</option>
                <option value="terrasse">Terrasse</option>
                <option value="vip">VIP</option>
                <option value="exterieur">Extérieur</option>
                <option value="bar">Comptoir / Bar</option>
              </select>
            </div>
          </div>
          <p className="text-xs text-stone-500">
            Cliquez = statut · Double-clic = ouvrir commande · 👤 = serveur (Libre → Occupée → Réservée). Icône 👤 pour assigner un serveur.
          </p>
          <button type="button" onClick={() => void save()} className="btn-primary w-full">
            Ajouter
          </button>
        </div>
      </Modal>

      <Modal
        open={!!assignOpen}
        onClose={() => setAssignOpen(null)}
        title={assignOpen ? `Serveur — Table ${assignOpen.number}` : 'Serveur'}
      >
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => assignOpen && void assignServer(assignOpen, null)}
            className="w-full rounded-xl border border-stone-700 px-3 py-2 text-sm text-stone-400 hover:bg-stone-800 text-left"
          >
            Aucun serveur
          </button>
          {servers.map((s) => (
            <button
              key={s.user_id}
              type="button"
              onClick={() => assignOpen && void assignServer(assignOpen, s.user_id)}
              className={`w-full rounded-xl border px-3 py-2 text-sm text-left hover:bg-stone-800 ${
                assignOpen?.server_id === s.user_id
                  ? 'border-amber-500/50 bg-amber-500/10 text-amber-200'
                  : 'border-stone-700 text-stone-200'
              }`}
            >
              {s.full_name || s.email}
              <span className="text-xs text-stone-500 ml-2">{s.role}</span>
            </button>
          ))}
          {servers.length === 0 && (
            <p className="text-sm text-stone-500">Aucun collaborateur. Ajoutez des employés d’abord.</p>
          )}
        </div>
      </Modal>
    </div>
  );
}
