import { useEffect, useState } from 'react';
import { Plus, Trash2, Users, Pencil } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';

export default function BtpClients() {
  const { member, activeEstablishment } = useAuth();
  const est = activeEstablishment?.id || member?.establishment_id;
  const [list, setList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ id: '', name: '', company: '', phone: '', email: '', address: '', site_address: '', notes: '' });
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    if (!est) return;
    setLoading(true);
    const { data } = await supabase.from('btp_clients').select('*').eq('establishment_id', est).order('name');
    setList(data || []);
    setLoading(false);
  }
  useEffect(() => { void load(); }, [est]);

  function startNew() {
    setForm({ id: '', name: '', company: '', phone: '', email: '', address: '', site_address: '', notes: '' });
    setOpen(true);
    setError(null);
  }
  function startEdit(c: any) {
    setForm({
      id: c.id,
      name: c.name || '',
      company: c.company || '',
      phone: c.phone || '',
      email: c.email || '',
      address: c.address || '',
      site_address: c.site_address || '',
      notes: c.notes || '',
    });
    setOpen(true);
  }

  async function save() {
    if (!est || !form.name.trim()) {
      setError('Le nom est obligatoire');
      return;
    }
    const payload = {
      establishment_id: est,
      name: form.name.trim(),
      company: form.company.trim() || null,
      phone: form.phone.trim() || null,
      email: form.email.trim() || null,
      address: form.address.trim() || null,
      site_address: form.site_address.trim() || null,
      notes: form.notes.trim() || null,
    };
    if (form.id) {
      const { error: e } = await supabase.from('btp_clients').update(payload).eq('id', form.id);
      if (e) { setError(e.message); return; }
    } else {
      const { error: e } = await supabase.from('btp_clients').insert(payload);
      if (e) { setError(e.message); return; }
    }
    setOpen(false);
    await load();
  }

  async function remove(id: string) {
    if (!confirm('Supprimer ce client ?')) return;
    await supabase.from('btp_clients').delete().eq('id', id);
    await load();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-stone-100 flex items-center gap-2"><Users className="text-sky-400" /> Clients chantier</h1>
          <p className="text-sm text-stone-500">Coordonnées et adresses de chantier</p>
        </div>
        <button type="button" className="btn-primary text-sm" onClick={startNew}><Plus size={16} /> Ajouter</button>
      </div>
      {open && (
        <div className="card space-y-3">
          {error && <p className="text-sm text-red-300">{error}</p>}
          <input className="input-field" placeholder="Nom *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <input className="input-field" placeholder="Société" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} />
          <input className="input-field" placeholder="Téléphone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <input className="input-field" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <input className="input-field" placeholder="Adresse" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          <input className="input-field" placeholder="Adresse chantier" value={form.site_address} onChange={(e) => setForm({ ...form, site_address: e.target.value })} />
          <textarea className="input-field min-h-[60px]" placeholder="Notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          <div className="flex gap-2">
            <button type="button" className="btn-primary" onClick={() => void save()}>Enregistrer</button>
            <button type="button" className="btn-ghost" onClick={() => setOpen(false)}>Annuler</button>
          </div>
        </div>
      )}
      {loading ? <p className="text-stone-500">Chargement…</p> : list.length === 0 ? (
        <div className="card text-center py-8 text-stone-500">Aucun client</div>
      ) : (
        <ul className="space-y-2">
          {list.map((c) => (
            <li key={c.id} className="card flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="font-medium text-stone-100">{c.name}</p>
                <p className="text-xs text-stone-500">{[c.company, c.phone, c.site_address].filter(Boolean).join(' · ')}</p>
              </div>
              <button type="button" className="p-2 text-stone-400" onClick={() => startEdit(c)}><Pencil size={16} /></button>
              <button type="button" className="p-2 text-red-400" onClick={() => void remove(c.id)}><Trash2 size={16} /></button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
