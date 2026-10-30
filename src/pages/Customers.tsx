import { useEffect, useState } from 'react';
import { UserCircle, Plus, Pencil, Trash2, Phone, Star, TrendingUp } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import type { Customer } from '@/lib/types';
import { formatFCFA } from '@/lib/format';
import { Modal, EmptyState, StatCard } from '@/components/ui';
import { openWhatsApp, buildInvoiceWhatsAppMessage } from '@/lib/integrations';
import { captureClientLocation } from '@/lib/geo';
import { MapPin, MessageCircle, Loader2 } from 'lucide-react';

export default function Customers() {
  const { member } = useAuth();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [form, setForm] = useState({ name: '', phone: '', email: '', notes: '', location: '' });
  const [locating, setLocating] = useState(false);

  async function load() {
    if (!member?.establishment_id) { setLoading(false); return; }
    const { data } = await supabase.from('customers').select('*').eq('establishment_id', member.establishment_id).order('total_spent', { ascending: false });
    setCustomers((data ?? []) as Customer[]);
    setLoading(false);
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [member]);

  function openAdd() {
    setEditing(null);
    setForm({ name: '', phone: '', email: '', notes: '', location: '' });
    setModalOpen(true);
  }

  function openEdit(c: Customer) {
    setEditing(c);
    setForm({
      name: c.name,
      phone: c.phone ?? '',
      email: c.email ?? '',
      notes: (c.notes ?? '').replace(/^LOC:[^\n]*\n?/, ''),
      location: (c.notes ?? '').startsWith('LOC:') ? (c.notes ?? '').split('\n')[0].replace(/^LOC:/, '').trim() : '',
    });
    setModalOpen(true);
  }

  async function save() {
    if (!member?.establishment_id || !form.name) return;
    const payload = {
      establishment_id: member.establishment_id,
      name: form.name,
      phone: form.phone || null,
      email: form.email || null,
      notes: [form.location ? `LOC:${form.location}` : '', form.notes || ''].filter(Boolean).join('\n') || null,
    };
    if (editing) {
      await supabase.from('customers').update(payload).eq('id', editing.id);
    } else {
      await supabase.from('customers').insert(payload);
    }
    setModalOpen(false);
    await load();
  }

  async function remove(c: Customer) {
    if (!confirm(`Supprimer "${c.name}" ?`)) return;
    await supabase.from('customers').delete().eq('id', c.id);
    await load();
  }

  if (loading) return <div className="flex items-center justify-center py-20 text-stone-400">Chargement...</div>;
  if (!member?.establishment_id) return <EmptyState icon={<UserCircle size={48} />} title="Aucun établissement" message="Vous n'êtes rattaché à aucun établissement." />;

  const totalCustomers = customers.length;
  const totalRevenue = customers.reduce((s, c) => s + c.total_spent, 0);
  const totalPoints = customers.reduce((s, c) => s + c.loyalty_points, 0);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold font-display text-stone-100">Clients</h1>
          <p className="text-stone-400 text-sm">Fidélité et historique d'achat</p>
        </div>
        <button onClick={openAdd} className="btn-primary flex items-center gap-2"><Plus size={18} /> Ajouter</button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <StatCard label="Total clients" value={String(totalCustomers)} icon={<UserCircle size={24} />} accent="primary" />
        <StatCard label="CA clients" value={formatFCFA(totalRevenue)} icon={<TrendingUp size={24} />} accent="success" />
        <StatCard label="Points fidélité" value={String(totalPoints)} icon={<Star size={24} />} accent="warning" />
      </div>

      {customers.length === 0 ? (
        <EmptyState icon={<UserCircle size={48} />} title="Aucun client" message="Ajoutez votre premier client." />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {customers.map((c) => (
            <div key={c.id} className="card">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary-500/10 flex items-center justify-center">
                    <UserCircle size={18} className="text-primary-400" />
                  </div>
                  <div>
                    <p className="font-medium text-stone-100">{c.name}</p>
                    {c.phone && <p className="text-xs text-stone-500 flex items-center gap-1"><Phone size={10} /> {c.phone}</p>}
                  </div>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => openEdit(c)} className="p-1.5 rounded-lg hover:bg-stone-800 text-stone-400"><Pencil size={16} /></button>
                  <button onClick={() => remove(c)} className="p-1.5 rounded-lg hover:bg-error-500/10 text-stone-400 hover:text-error-400"><Trash2 size={16} /></button>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-stone-800/50 rounded-lg p-2">
                  <p className="text-xs text-stone-500">Visites</p>
                  <p className="font-bold text-stone-200">{c.total_visits}</p>
                </div>
                <div className="bg-stone-800/50 rounded-lg p-2">
                  <p className="text-xs text-stone-500">Dépensé</p>
                  <p className="font-bold text-success-400 text-sm">{formatFCFA(c.total_spent)}</p>
                </div>
                <div className="bg-warning-500/10 rounded-lg p-2">
                  <p className="text-xs text-stone-500">Points</p>
                  <p className="font-bold text-warning-400 flex items-center justify-center gap-1"><Star size={10} /> {c.loyalty_points}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Modifier' : 'Nouveau client'}>
        <div className="space-y-3">
          <div>
            <label className="label">Nom</label>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input-field" placeholder="Jean Kouassi" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Téléphone / WhatsApp</label>
              <div className="flex gap-2">
                <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="input-field flex-1" placeholder="07 XX XX XX XX" />
                {form.phone && (
                  <button type="button" className="btn-secondary px-3" title="WhatsApp"
                    onClick={() => openWhatsApp(form.phone, buildInvoiceWhatsAppMessage({ businessName: 'GESMAK', clientName: form.name, amount: 0, note: 'Bonjour,' }))}>
                    <MessageCircle size={16} />
                  </button>
                )}
              </div>
              <label className="label mt-3">Localisation</label>
              <div className="flex gap-2">
                <input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} className="input-field flex-1" placeholder="Adresse ou GPS" />
                <button type="button" disabled={locating} className="btn-secondary px-3 flex items-center gap-1"
                  onClick={async () => {
                    setLocating(true);
                    try {
                      const loc = await captureClientLocation();
                      setForm((f) => ({ ...f, location: loc.label }));
                    } catch (e: any) {
                      alert(e?.message || 'Localisation impossible');
                    } finally {
                      setLocating(false);
                    }
                  }}>
                  <MapPin size={16} /> {locating ? '…' : 'Localiser'}
                </button>
              </div>
            </div>
            <div>
              <label className="label">Email</label>
              <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="input-field" placeholder="client@..." />
            </div>
          </div>
          <div>
            <label className="label">Notes</label>
            <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="input-field min-h-[60px]" placeholder="Préférences, allergies..." />
          </div>
          <button onClick={save} className="btn-primary w-full">{editing ? 'Enregistrer' : 'Ajouter'}</button>
        </div>
      </Modal>
    </div>
  );
}
