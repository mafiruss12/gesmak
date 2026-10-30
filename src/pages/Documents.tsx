import { useEffect, useMemo, useState } from 'react';
import {
  FileText, Plus, Loader2, Trash2, Pencil, MessageCircle, Printer, Sparkles,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { formatFCFA } from '@/lib/format';
import { Modal, EmptyState } from '@/components/ui';
import { openWhatsApp, buildInvoiceWhatsAppMessage } from '@/lib/integrations';
import { toWhatsAppNumber } from '@/lib/login';
import { getBusinessUI } from '@/lib/businessTypes';
import { convertDevisToFacture } from '@/lib/opsHub';

type DocType = 'devis' | 'facture' | 'rapport';
type DocLine = { label: string; qty: number; unit_price: number };

interface BizDoc {
  id: string;
  establishment_id: string;
  doc_type: DocType;
  number: string;
  client_name: string;
  client_phone: string | null;
  client_location: string | null;
  title: string | null;
  lines: DocLine[];
  subtotal: number;
  tax_rate: number;
  total: number;
  notes: string | null;
  status: string;
  theme: string;
  valid_until: string | null;
  issued_at: string;
}

const emptyLine = (): DocLine => ({ label: '', qty: 1, unit_price: 0 });

function nextNumber(type: DocType) {
  const prefix = type === 'devis' ? 'DEV' : type === 'facture' ? 'FAC' : 'RAPP';
  const d = new Date();
  return `${prefix}-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}-${Math.floor(1000 + Math.random() * 9000)}`;
}

export default function Documents({ embedded = false }: { embedded?: boolean } = {}) {
  const { member, activeEstablishment } = useAuth();
  const ui = getBusinessUI(activeEstablishment?.type);
  const [tab, setTab] = useState<DocType>('devis');
  const [list, setList] = useState<BizDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<BizDoc | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    client_name: '',
    client_phone: '',
    client_location: '',
    title: '',
    notes: '',
    tax_rate: 0,
    lines: [emptyLine()] as DocLine[],
    theme: 'orange_blue',
  });

  async function load() {
    if (!member?.establishment_id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data } = await supabase
      .from('business_documents')
      .select('*')
      .eq('establishment_id', member.establishment_id)
      .eq('doc_type', tab)
      .order('created_at', { ascending: false });
    setList((data as BizDoc[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [member?.establishment_id, tab]);

  async function convertToFacture(d: BizDoc) {
    if (d.doc_type !== 'devis') return;
    if (!confirm(`Convertir le devis ${d.number} en facture ?`)) return;
    try {
      const fac = await convertDevisToFacture(d.id, member?.user_id);
      alert(`Facture ${fac?.number || ''} créée. Onglet Factures.`);
      setTab('facture');
      await load();
    } catch (e: any) {
      alert(e?.message || 'Conversion impossible');
    }
  }

  const totals = useMemo(() => {
    const sub = form.lines.reduce((s, l) => s + Number(l.qty) * Number(l.unit_price), 0);
    const tax = sub * (Number(form.tax_rate) / 100);
    return { sub, tax, total: sub + tax };
  }, [form.lines, form.tax_rate]);

  function openCreate() {
    setEditing(null);
    setForm({
      client_name: '',
      client_phone: '',
      client_location: '',
      title: tab === 'devis' ? 'Devis' : 'Facture',
      notes: '',
      tax_rate: 0,
      lines: [emptyLine()],
      theme: 'orange_blue',
    });
    setOpen(true);
  }

  function openEdit(d: BizDoc) {
    setEditing(d);
    setForm({
      client_name: d.client_name,
      client_phone: d.client_phone || '',
      client_location: d.client_location || '',
      title: d.title || '',
      notes: d.notes || '',
      tax_rate: Number(d.tax_rate) || 0,
      lines: Array.isArray(d.lines) && d.lines.length ? d.lines : [emptyLine()],
      theme: d.theme || 'orange_blue',
    });
    setOpen(true);
  }

  async function save() {
    if (!member?.establishment_id || !form.client_name.trim()) return;
    setSaving(true);
    const payload = {
      establishment_id: member.establishment_id,
      doc_type: tab,
      number: editing?.number || nextNumber(tab),
      client_name: form.client_name.trim(),
      client_phone: form.client_phone || null,
      client_location: form.client_location || null,
      title: form.title || (tab === 'devis' ? 'Devis' : 'Facture'),
      lines: form.lines.filter((l) => l.label.trim()),
      subtotal: totals.sub,
      tax_rate: form.tax_rate,
      total: totals.total,
      notes: form.notes || null,
      theme: form.theme,
      status: 'issued',
      created_by: member.user_id,
      updated_at: new Date().toISOString(),
    };
    if (editing) {
      await supabase.from('business_documents').update(payload).eq('id', editing.id);
    } else {
      await supabase.from('business_documents').insert(payload);
    }
    setSaving(false);
    setOpen(false);
    await load();
  }

  async function remove(id: string) {
    if (!confirm('Supprimer ce document ?')) return;
    await supabase.from('business_documents').delete().eq('id', id);
    await load();
  }

  function shareWa(d: BizDoc) {
    if (!d.client_phone) {
      alert('Ajoutez un numéro WhatsApp au client.');
      return;
    }
    const msg = buildInvoiceWhatsAppMessage({
      businessName: activeEstablishment?.name || 'GESMAK',
      clientName: d.client_name,
      amount: Number(d.total),
      reference: d.number,
      note: `${d.doc_type === 'devis' ? 'Devis' : 'Facture'} — ${d.title || ''}\n${(d.lines as DocLine[])
        .map((l) => `• ${l.label} x${l.qty} = ${formatFCFA(l.qty * l.unit_price)}`)
        .join('\n')}`,
    });
    openWhatsApp(d.client_phone, msg);
  }

  function printDoc(d: BizDoc) {
    const lines = (d.lines as DocLine[])
      .map(
        (l) =>
          `<tr><td>${l.label}</td><td style="text-align:center">${l.qty}</td><td style="text-align:right">${formatFCFA(l.unit_price)}</td><td style="text-align:right">${formatFCFA(l.qty * l.unit_price)}</td></tr>`
      )
      .join('');
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"/><title>${d.number}</title>
<style>
body{font-family:system-ui,sans-serif;margin:0;padding:24px;background:linear-gradient(135deg,#f59e0b22,#3b82f644);min-height:100vh}
.card{max-width:720px;margin:0 auto;background:#0f172a;color:#f8fafc;border-radius:16px;padding:28px;box-shadow:0 20px 50px #0006}
h1{margin:0 0 4px;background:linear-gradient(90deg,#f59e0b,#3b82f6);-webkit-background-clip:text;color:transparent}
table{width:100%;border-collapse:collapse;margin-top:16px}
td,th{padding:8px;border-bottom:1px solid #334155;font-size:14px}
.muted{color:#94a3b8;font-size:13px}
</style></head><body><div class="card">
<h1>${d.doc_type === 'devis' ? 'DEVIS' : d.doc_type === 'facture' ? 'FACTURE' : 'RAPPORT'} ${d.number}</h1>
<p class="muted">${activeEstablishment?.name || ''} · ${ui.productPlural}</p>
<p><strong>Client :</strong> ${d.client_name}<br/>
${d.client_phone ? 'Tél : ' + d.client_phone + '<br/>' : ''}
${d.client_location ? 'Lieu : ' + d.client_location : ''}</p>
<table><thead><tr><th>Désignation</th><th>Qté</th><th>P.U.</th><th>Total</th></tr></thead><tbody>${lines}</tbody></table>
<p style="text-align:right;margin-top:16px;font-size:18px"><strong>Total : ${formatFCFA(Number(d.total))}</strong></p>
${d.notes ? `<p class="muted">${d.notes}</p>` : ''}
<p class="muted">App créée par Kevin Akoh de Kevin Tech Pro — GESMAK</p>
</div><script>window.print()</script></body></html>`);
    w.document.close();
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="animate-spin text-primary-500" size={28} />
      </div>
    );
  }

  if (!member?.establishment_id) {
    return (
      <EmptyState
        icon={<FileText size={48} />}
        title="Aucun établissement"
        message="Créez ou sélectionnez une activité pour gérer devis et factures."
      />
    );
  }

  return (
    <div className="relative min-h-[70vh]">
      {/* Fond animé orange / bleu */}
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden rounded-3xl">
        <div className="absolute -top-20 -left-20 w-72 h-72 rounded-full bg-amber-500/25 blur-3xl animate-pulse" />
        <div className="absolute top-40 -right-16 w-80 h-80 rounded-full bg-blue-500/25 blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute bottom-10 left-1/3 w-64 h-64 rounded-full bg-orange-400/15 blur-3xl animate-pulse" style={{ animationDelay: '2s' }} />
        <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 via-transparent to-blue-600/10" />
      </div>

      <div className="flex flex-wrap items-end justify-between gap-3 mb-6">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-amber-400 flex items-center gap-1">
            <Sparkles size={12} /> Documents commerciaux
          </p>
          {!embedded && (<h1 className="text-2xl font-bold font-display text-stone-100">Devis & Factures</h1>)}
          <p className="text-xs text-stone-500 mt-1">Synchronisé avec caisse · rapport du jour · clôture Z</p>
          <p className="text-stone-400 text-sm">Modifiables · thème orange / bleu · WhatsApp wa.me/225</p>
        </div>
        {tab !== 'rapport' && (
        <button type="button" onClick={openCreate} className="btn-primary flex items-center gap-2">
          <Plus size={18} /> Nouveau {tab}
        </button>
        )}
      </div>

      <div className="flex gap-2 mb-5">
        {(['devis', 'facture', 'rapport'] as DocType[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-xl text-sm font-medium border transition-all ${
              tab === t
                ? 'border-amber-500/50 bg-gradient-to-r from-amber-500/20 to-blue-500/20 text-amber-100'
                : 'border-stone-700 text-stone-400 hover:bg-stone-800'
            }`}
          >
            {t === 'devis' ? 'Devis' : t === 'facture' ? 'Factures' : 'Rapports journaliers'}
          </button>
        ))}
      </div>

      {list.length === 0 ? (
        <EmptyState
          icon={<FileText size={48} />}
          title={tab === 'devis' ? 'Aucun devis' : tab === 'facture' ? 'Aucune facture' : 'Aucun rapport journalier'}
          message={tab === 'rapport' ? 'Les rapports validés depuis Rapport du jour apparaissent ici automatiquement.' : 'Créez un document, modifiez les lignes, puis envoyez par WhatsApp.'}
        />
      ) : (
        <div className="space-y-3">
          {list.map((d) => (
            <div
              key={d.id}
              className="card border border-amber-500/10 bg-gradient-to-r from-stone-900/90 via-stone-900/80 to-blue-950/40 flex flex-col sm:flex-row sm:items-center gap-3"
            >
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-stone-100">
                  {d.number} · {d.client_name}
                </p>
                <p className="text-xs text-stone-400 truncate">
                  {d.title} · {formatFCFA(Number(d.total))}
                  {d.client_phone ? ` · ${d.client_phone}` : ''}
                </p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button type="button" className="p-2.5 rounded-lg text-emerald-400 hover:bg-emerald-500/10" title="WhatsApp" onClick={() => shareWa(d)}>
                  <MessageCircle size={18} />
                </button>
                <button type="button" className="p-2.5 rounded-lg text-stone-300 hover:bg-stone-800" title="Imprimer" onClick={() => printDoc(d)}>
                  <Printer size={18} />
                </button>
                <button type="button" className="p-2.5 rounded-lg text-stone-300 hover:bg-stone-800" onClick={() => openEdit(d)}>
                  <Pencil size={18} />
                </button>
                    {d.doc_type === 'rapport' && d.notes && (
                      <button
                        type="button"
                        className="btn-secondary text-xs px-2 py-1"
                        onClick={() => {
                          const w = window.open('', '_blank');
                          if (w) {
                            w.document.write(d.notes || '');
                            w.document.close();
                          }
                        }}
                      >
                        Voir / Imprimer
                      </button>
                    )}
                    {d.doc_type === 'devis' && d.status !== 'converted' && (
                      <button type="button" className="btn-secondary text-xs px-2 py-1" onClick={() => void convertToFacture(d)}>
                        → Facture
                      </button>
                    )}
                <button type="button" className="p-2.5 rounded-lg text-error-400 hover:bg-error-500/10" onClick={() => remove(d.id)}>
                  <Trash2 size={18} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? `Modifier ${tab}` : `Nouveau ${tab}`}>
        <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
          <div className="rounded-xl p-3 border border-amber-500/20 bg-gradient-to-r from-amber-500/10 to-blue-500/10">
            <p className="text-xs text-amber-200/80">Thème orange / bleu — document entièrement modifiable</p>
          </div>
          <div>
            <label className="label">Client *</label>
            <input className="input-field" value={form.client_name} onChange={(e) => setForm({ ...form, client_name: e.target.value })} />
          </div>
          <div>
            <label className="label">Téléphone (WhatsApp 225…)</label>
            <input
              className="input-field"
              value={form.client_phone}
              onChange={(e) => setForm({ ...form, client_phone: e.target.value })}
              placeholder="07 XX XX XX XX"
            />
            {form.client_phone && (
              <p className="text-[11px] text-stone-500 mt-1">Lien : wa.me/{toWhatsAppNumber(form.client_phone) || '225…'}</p>
            )}
          </div>
          <div>
            <label className="label">Localisation</label>
            <input className="input-field" value={form.client_location} onChange={(e) => setForm({ ...form, client_location: e.target.value })} />
          </div>
          <div>
            <label className="label">Titre</label>
            <input className="input-field" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </div>
          <div>
            <label className="label">Lignes</label>
            <div className="space-y-2">
              {form.lines.map((line, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2">
                  <input
                    className="input-field col-span-5"
                    placeholder="Désignation"
                    value={line.label}
                    onChange={(e) => {
                      const lines = [...form.lines];
                      lines[idx] = { ...line, label: e.target.value };
                      setForm({ ...form, lines });
                    }}
                  />
                  <input
                    type="number"
                    className="input-field col-span-2"
                    value={line.qty}
                    onChange={(e) => {
                      const lines = [...form.lines];
                      lines[idx] = { ...line, qty: Number(e.target.value) };
                      setForm({ ...form, lines });
                    }}
                  />
                  <input
                    type="number"
                    className="input-field col-span-3"
                    value={line.unit_price}
                    onChange={(e) => {
                      const lines = [...form.lines];
                      lines[idx] = { ...line, unit_price: Number(e.target.value) };
                      setForm({ ...form, lines });
                    }}
                  />
                  <button
                    type="button"
                    className="col-span-2 text-error-400 text-sm"
                    onClick={() => setForm({ ...form, lines: form.lines.filter((_, i) => i !== idx) })}
                  >
                    ✕
                  </button>
                </div>
              ))}
              <button type="button" className="text-sm text-amber-300" onClick={() => setForm({ ...form, lines: [...form.lines, emptyLine()] })}>
                + Ajouter une ligne
              </button>
            </div>
          </div>
          <div className="flex justify-between text-sm text-stone-300">
            <span>Sous-total</span>
            <span>{formatFCFA(totals.sub)}</span>
          </div>
          <div className="flex justify-between text-lg font-bold text-amber-300">
            <span>Total</span>
            <span>{formatFCFA(totals.total)}</span>
          </div>
          <div>
            <label className="label">Notes</label>
            <input className="input-field" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
          <button type="button" onClick={save} disabled={saving} className="btn-primary w-full flex justify-center gap-2">
            {saving ? <Loader2 className="animate-spin" size={18} /> : null}
            Enregistrer
          </button>
        </div>
      </Modal>
    </div>
  );
}
