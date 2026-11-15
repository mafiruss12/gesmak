import { useEffect, useState } from 'react';
import { Truck, Plus, Pencil, Trash2, Phone, Mail, MapPin, Package } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import type { Supplier } from '@/lib/types';
import { Modal, EmptyState } from '@/components/ui';

export default function Suppliers() {
  const { member } = useAuth();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [form, setForm] = useState({ name: '', contact_person: '', phone: '', email: '', address: '', notes: '' });

  async function load() {
    if (!member?.establishment_id) { setLoading(false); return; }
    const { data } = await supabase.from('suppliers').select('*').eq('establishment_id', member.establishment_id).order('name');
    setSuppliers((data ?? []) as Supplier[]);
    setLoading(false);
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [member]);

  function openAdd() {
    setEditing(null);
    setForm({ name: '', contact_person: '', phone: '', email: '', address: '', notes: '' });
    setModalOpen(true);
  }

  function openEdit(s: Supplier) {
    setEditing(s);
    setForm({ name: s.name, contact_person: s.contact_person ?? '', phone: s.phone ?? '', email: s.email ?? '', address: s.address ?? '', notes: s.notes ?? '' });
    setModalOpen(true);
  }

  async function save() {
    if (!member?.establishment_id || !form.name) return;
    const payload = {
      establishment_id: member.establishment_id,
      name: form.name,
      contact_person: form.contact_person || null,
      phone: form.phone || null,
      email: form.email || null,
      address: form.address || null,
      notes: form.notes || null,
    };
    if (editing) {
      await supabase.from('suppliers').update(payload).eq('id', editing.id);
    } else {
      await supabase.from('suppliers').insert(payload);
    }
    setModalOpen(false);
    await load();
  }

  async function remove(s: Supplier) {
    if (!confirm(`Supprimer "${s.name}" ?`)) return;
    await supabase.from('suppliers').delete().eq('id', s.id);
    await load();
  }

  if (loading) return <div className="flex items-center justify-center py-20 text-stone-400">Chargement...</div>;
  if (!member?.establishment_id) return <EmptyState icon={<Truck size={48} />} title="Aucun établissement" message="Vous n'êtes rattaché à aucun établissement." />;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold font-display text-stone-100">Fournisseurs</h1>
          <p className="text-stone-400 text-sm">Gérez vos fournisseurs et leurs contacts</p>
        </div>
        <button onClick={openAdd} className="btn-primary flex items-center gap-2"><Plus size={18} /> Ajouter</button>
      </div>

      {suppliers.length === 0 ? (
        <EmptyState icon={<Truck size={48} />} title="Aucun fournisseur" message="Ajoutez votre premier fournisseur." />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {suppliers.map((s) => (
            <div key={s.id} className="card">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-secondary-500/10 flex items-center justify-center"><Truck size={18} className="text-secondary-400" /></div>
                  <div>
                    <p className="font-medium text-stone-100">{s.name}</p>
                    {s.contact_person && <p className="text-xs text-stone-500">{s.contact_person}</p>}
                  </div>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => openEdit(s)} className="p-1.5 rounded-lg hover:bg-stone-800 text-stone-400"><Pencil size={16} /></button>
                  <button onClick={() => remove(s)} className="p-1.5 rounded-lg hover:bg-error-500/10 text-stone-400 hover:text-error-400"><Trash2 size={16} /></button>
                </div>
              </div>
              <div className="space-y-1.5 text-sm text-stone-400">
                {s.phone && <p className="flex items-center gap-2"><Phone size={12} /> {s.phone}</p>}
                {s.email && <p className="flex items-center gap-2"><Mail size={12} /> {s.email}</p>}
                {s.address && <p className="flex items-center gap-2"><MapPin size={12} /> {s.address}</p>}
                {s.notes && <p className="flex items-center gap-2 text-stone-500"><Package size={12} /> {s.notes}</p>}
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Modifier' : 'Nouveau fournisseur'}>
        <div className="space-y-3">
          <div>
            <label className="label">Nom</label>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input-field" placeholder="Brasserie Ivoirienne" />
          </div>
          <div>
            <label className="label">Personne contact</label>
            <input value={form.contact_person} onChange={(e) => setForm({ ...form, contact_person: e.target.value })} className="input-field" placeholder="M. Dupont" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Téléphone</label>
              <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="input-field" placeholder="+225 ..." />
            </div>
            <div>
              <label className="label">Email</label>
              <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="input-field" placeholder="contact@..." />
            </div>
          </div>
          <div>
            <label className="label">Adresse</label>
            <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className="input-field" placeholder="Zone Industrielle..." />
          </div>
          <div>
            <label className="label">Notes</label>
            <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="input-field min-h-[60px]" placeholder="Conditions, délais..." />
          </div>
          <button onClick={save} className="btn-primary w-full">{editing ? 'Enregistrer' : 'Ajouter'}</button>
        </div>
      </Modal>
    </div>
  );
}
