import { useEffect, useState } from 'react';
import { UserCircle, Plus, Loader2, MessageCircle, Pencil, Trash2, MapPin, Phone } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { openWhatsApp, buildInvoiceWhatsAppMessage } from '@/lib/integrations';
import { captureClientLocation } from '@/lib/geo';
import { useAuth } from '@/lib/auth';
import { EmptyState, Modal } from '@/components/ui';
import type { RentalClient } from '@/lib/rentalTypes';

const empty = { full_name: '', phone: '', whatsapp: '', email: '', location: '', notes: '' };

export default function RentClients() {
  const { member, activeEstablishment } = useAuth();
  const estId = activeEstablishment?.id || member?.establishment_id || null;
  const [list, setList] = useState<RentalClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    if (!estId) {
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from('rental_clients')
      .select('*')
      .eq('establishment_id', estId)
      .order('full_name');
    setList((data ?? []) as RentalClient[]);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estId]);

  function openCreate() {
    setEditId(null);
    setForm(empty);
    setError(null);
    setOpen(true);
  }

  function openEdit(c: RentalClient) {
    setEditId(c.id);
    setForm({
      full_name: c.full_name || '',
      phone: c.phone || '',
      whatsapp: c.whatsapp || c.phone || '',
      email: c.email || '',
      location: c.location || '',
      notes: c.notes || '',
    });
    setError(null);
    setOpen(true);
  }

  async function save() {
    if (!estId || !form.full_name.trim()) {
      setError('Le nom est obligatoire');
      return;
    }
    setSaving(true);
    setError(null);
    const payload = {
      full_name: form.full_name.trim(),
      phone: form.phone || null,
      whatsapp: form.whatsapp || form.phone || null,
      email: form.email || null,
      location: form.location || null,
      notes: form.notes || null,
    };
    let err;
    if (editId) {
      ({ error: err } = await supabase.from('rental_clients').update(payload).eq('id', editId));
    } else {
      ({ error: err } = await supabase.from('rental_clients').insert({
        establishment_id: estId,
        ...payload,
      }));
    }
    setSaving(false);
    if (err) {
      setError(err.message);
      return;
    }
    setOpen(false);
    setEditId(null);
    setForm(empty);
    await load();
  }

  async function removeClient(c: RentalClient, e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm(`Supprimer ${c.full_name} ?`)) return;
    await supabase.from('rental_clients').delete().eq('id', c.id);
    await load();
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="animate-spin text-primary-500" size={28} />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6 gap-3">
        <div>
          <h1 className="text-2xl font-bold font-display text-stone-100">Clients</h1>
          <p className="text-stone-400 text-sm">Fiches livraisons — téléphone, WhatsApp, localisation</p>
        </div>
        <button type="button" onClick={openCreate} className="btn-primary flex items-center gap-2 shrink-0">
          <Plus size={18} /> Ajouter
        </button>
      </div>

      {list.length === 0 ? (
        <EmptyState icon={<UserCircle size={48} />} title="Aucun client" message="Ajoutez un client pour les livraisons." />
      ) : (
        <div className="space-y-2">
          {list.map((c) => {
            const wa = c.whatsapp || c.phone;
            return (
              <div key={c.id} className="card flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => openEdit(c)}
                  className="flex-1 text-left min-w-0 active:scale-[0.99]"
                >
                  <p className="font-medium text-stone-100 flex items-center gap-2">
                    {c.full_name}
                    <Pencil size={14} className="text-stone-500" />
                  </p>
                  <p className="text-xs text-stone-500 flex flex-wrap gap-x-2 gap-y-0.5 mt-0.5">
                    {c.phone && (
                      <span className="inline-flex items-center gap-0.5">
                        <Phone size={10} /> {c.phone}
                      </span>
                    )}
                    {c.location && (
                      <span className="inline-flex items-center gap-0.5">
                        <MapPin size={10} /> {c.location}
                      </span>
                    )}
                    {c.email && <span>{c.email}</span>}
                  </p>
                </button>
                <div className="flex items-center gap-1 shrink-0">
                  {wa && (
                    <button
                      type="button"
                      className="p-2.5 rounded-lg bg-success-500/15 text-success-400"
                      title="WhatsApp"
                      onClick={() =>
                        openWhatsApp(
                          wa,
                          buildInvoiceWhatsAppMessage({
                            businessName: 'GESMAK',
                            clientName: c.full_name,
                            amount: 0,
                            note: `Bonjour ${c.full_name},`,
                          })
                        )
                      }
                    >
                      <MessageCircle size={18} />
                    </button>
                  )}
                  <button
                    type="button"
                    className="p-2.5 rounded-lg hover:bg-error-500/10 text-stone-400"
                    onClick={(e) => removeClient(c, e)}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal
        open={open}
        onClose={() => {
          setOpen(false);
          setEditId(null);
        }}
        title={editId ? 'Modifier le client' : 'Nouveau client'}
      >
        <div className="space-y-3">
          {error && (
            <div className="text-sm text-error-300 bg-error-500/10 border border-error-500/30 rounded-xl p-3">{error}</div>
          )}
          <div>
            <label className="label">Nom complet *</label>
            <input className="input-field" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
          </div>
          <div>
            <label className="label">Téléphone</label>
            <input className="input-field" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+225 …" />
          </div>
          <div>
            <label className="label">WhatsApp</label>
            <input
              className="input-field"
              value={form.whatsapp}
              onChange={(e) => setForm({ ...form, whatsapp: e.target.value })}
              placeholder="Si différent du téléphone"
            />
          </div>
          <div>
            <label className="label">Email</label>
            <input className="input-field" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div>
            <label className="label">Localisation / adresse livraison</label>
            <div className="flex gap-2">
              <input
                className="input-field flex-1"
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
                placeholder="Quartier, ville ou GPS…"
              />
              <button
                type="button"
                disabled={locating}
                className="btn-secondary shrink-0 flex items-center gap-1.5 px-3"
                onClick={async () => {
                  setLocating(true);
                  setError(null);
                  try {
                    const loc = await captureClientLocation();
                    setForm((f) => ({ ...f, location: loc.label }));
                  } catch (e: any) {
                    setError(e?.message || "Impossible d'obtenir la position. Autorisez la localisation.");
                  } finally {
                    setLocating(false);
                  }
                }}
              >
                <MapPin size={16} /> {locating ? '…' : 'Localiser'}
              </button>
            </div>
            <p className="text-[11px] text-stone-500 mt-1">GPS : position exacte du client (autorise la localisation).</p>
          </div>
          <div>
            <label className="label">Notes</label>
            <input className="input-field" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
          <button type="button" onClick={save} disabled={saving} className="btn-primary w-full">
            {saving ? <Loader2 className="animate-spin mx-auto" size={18} /> : editId ? 'Enregistrer' : 'Créer'}
          </button>
        </div>
      </Modal>
    </div>
  );
}
