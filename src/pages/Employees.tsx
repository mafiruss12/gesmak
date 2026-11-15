import { useEffect, useState } from 'react';
import { Users, Plus, Pencil, Trash2, Ban, CheckCircle2, Phone } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import type { Employee } from '@/lib/types';
import { formatFCFA } from '@/lib/format';
import { Modal, EmptyState, Badge } from '@/components/ui';

export default function Employees() {
  const { member } = useAuth();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Employee | null>(null);
  const [form, setForm] = useState({ name: '', role: 'serveur', phone: '', salary: '', status: 'active' });

  async function load() {
    if (!member?.establishment_id) { setLoading(false); return; }
    const { data } = await supabase.from('employees').select('*').eq('establishment_id', member.establishment_id).order('name');
    setEmployees((data ?? []) as Employee[]);
    setLoading(false);
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [member]);

  function openAdd() {
    setEditing(null);
    setForm({ name: '', role: 'serveur', phone: '', salary: '', status: 'active' });
    setModalOpen(true);
  }

  function openEdit(e: Employee) {
    setEditing(e);
    setForm({ name: e.name, role: e.role, phone: e.phone ?? '', salary: String(e.salary), status: e.status });
    setModalOpen(true);
  }

  async function save() {
    if (!member?.establishment_id || !form.name) return;
    const payload = {
      establishment_id: member.establishment_id,
      name: form.name,
      role: form.role,
      phone: form.phone || null,
      salary: Number(form.salary) || 0,
      status: form.status as 'active' | 'inactive',
    };
    if (editing) {
      await supabase.from('employees').update(payload).eq('id', editing.id);
    } else {
      await supabase.from('employees').insert(payload);
    }
    setModalOpen(false);
    await load();
  }

  async function remove(e: Employee) {
    if (!confirm(`Supprimer "${e.name}" ?`)) return;
    await supabase.from('employees').delete().eq('id', e.id);
    await load();
  }

  async function toggleStatus(e: Employee) {
    const newStatus = e.status === 'active' ? 'inactive' : 'active';
    await supabase.from('employees').update({ status: newStatus }).eq('id', e.id);
    await load();
  }

  if (loading) return <div className="flex items-center justify-center py-20 text-stone-400">Chargement...</div>;
  if (!member?.establishment_id) return <EmptyState icon={<Users size={48} />} title="Aucun établissement" message="Vous n'êtes rattaché à aucun établissement." />;

  const activeCount = employees.filter((e) => e.status === 'active').length;
  const totalSalaries = employees.filter((e) => e.status === 'active').reduce((s, e) => s + e.salary, 0);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold font-display text-stone-100">Employés</h1>
          <p className="text-stone-400 text-sm">{activeCount} actifs · Masse salariale: {formatFCFA(totalSalaries)}</p>
        </div>
        <button onClick={openAdd} className="btn-primary flex items-center gap-2"><Plus size={18} /> Ajouter</button>
      </div>

      {employees.length === 0 ? (
        <EmptyState icon={<Users size={48} />} title="Aucun employé" message="Ajoutez votre premier employé." />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {employees.map((e) => (
            <div key={e.id} className="card">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-stone-800 flex items-center justify-center">
                    <Users size={18} className="text-stone-400" />
                  </div>
                  <div>
                    <p className="font-medium text-stone-100">{e.name}</p>
                    <Badge color={e.status === 'active' ? 'success' : 'error'}>{e.status === 'active' ? 'Actif' : 'Inactif'}</Badge>
                  </div>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => openEdit(e)} className="p-1.5 rounded-lg hover:bg-stone-800 text-stone-400"><Pencil size={16} /></button>
                  <button onClick={() => remove(e)} className="p-1.5 rounded-lg hover:bg-error-500/10 text-stone-400 hover:text-error-400"><Trash2 size={16} /></button>
                </div>
              </div>
              <div className="space-y-1 text-sm text-stone-400">
                <p>Poste: <span className="text-stone-200 capitalize">{e.role}</span></p>
                {e.phone && <p className="flex items-center gap-1"><Phone size={12} /> {e.phone}</p>}
                <p>Salaire: <span className="text-stone-200">{formatFCFA(e.salary)}</span></p>
              </div>
              <button onClick={() => toggleStatus(e)} className="mt-3 w-full text-xs text-stone-400 hover:text-stone-200 flex items-center justify-center gap-1 py-1.5 rounded-lg hover:bg-stone-800 transition-all">
                {e.status === 'active' ? <><Ban size={12} /> Suspendre</> : <><CheckCircle2 size={12} /> Réactiver</>}
              </button>
            </div>
          ))}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Modifier' : 'Nouvel employé'}>
        <div className="space-y-3">
          <div>
            <label className="label">Nom complet</label>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input-field" placeholder="Jean Kouassi" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Poste</label>
              <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className="input-field">
                <option value="serveur">Serveur</option>
                <option value="cuisinier">Cuisinier</option>
                <option value="barman">Barman</option>
                <option value="caissier">Caissier</option>
                <option value="videur">Videur / Sécurité</option>
                <option value="manager">Manager</option>
                <option value="autre">Autre</option>
              </select>
            </div>
            <div>
              <label className="label">Salaire (FCFA)</label>
              <input type="number" value={form.salary} onChange={(e) => setForm({ ...form, salary: e.target.value })} className="input-field" />
            </div>
          </div>
          <div>
            <label className="label">Téléphone</label>
            <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="input-field" placeholder="+225 ..." />
          </div>
          <div>
            <label className="label">Statut</label>
            <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="input-field">
              <option value="active">Actif</option>
              <option value="inactive">Inactif</option>
            </select>
          </div>
          <button onClick={save} className="btn-primary w-full">{editing ? 'Enregistrer' : 'Ajouter'}</button>
        </div>
      </Modal>
    </div>
  );
}
