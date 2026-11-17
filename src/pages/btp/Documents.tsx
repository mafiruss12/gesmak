import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Plus, Trash2, FileText, ArrowRight, Printer, Pencil, Sparkles, Receipt, Eye, EyeOff,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import {
  formatMoney,
  formatMoneyOrEmpty,
  parseOptionalNumber,
  nextDocNumber,
  lineHT,
  materialIcon,
  DOC_TYPE_LABELS,
  DOC_STATUS_LABELS,
  DEFAULT_BRANDING,
  type BtpDocType,
  type BtpDocStatus,
  type BtpBranding,
} from '@/lib/btp';
import { printBtpDocument } from '@/lib/btpPrint';

type Item = {
  id?: string;
  item_type: 'item' | 'section';
  title: string;
  unit: string;
  quantity: number | '';
  unit_price: number | '';
  tax_rate: number | '';
  discount_percent: number;
  total_ht: number;
};

function emptyItem(): Item {
  return {
    item_type: 'item',
    title: '',
    unit: '',
    quantity: '',
    unit_price: '',
    tax_rate: '',
    discount_percent: 0,
    total_ht: 0,
  };
}

export default function BtpDocuments() {
  const { member, activeEstablishment } = useAuth();
  const est = activeEstablishment?.id || member?.establishment_id;
  const [docs, setDocs] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [materials, setMaterials] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | BtpDocType>('all');
  const [printDoc, setPrintDoc] = useState<any | null>(null);
  const [printItems, setPrintItems] = useState<any[]>([]);
  const [branding, setBranding] = useState<BtpBranding>({ ...DEFAULT_BRANDING });
  const [company, setCompany] = useState<{ name?: string; address?: string; phone?: string; logo_url?: string }>({});

  const [form, setForm] = useState({
    id: '' as string,
    type: 'quote' as BtpDocType,
    title: '',
    date: new Date().toISOString().slice(0, 10),
    validity_date: '',
    client_id: '',
    client_name: '',
    client_phone: '',
    site_location: '',
    status: 'draft' as BtpDocStatus,
    notes: '',
    payment_terms: '',
    global_discount_percent: '' as number | '',
    advance_percent: '' as number | '',
    amount_paid: '' as number | '',
  });
  const [items, setItems] = useState<Item[]>([emptyItem()]);
  /** tableau = grille type Excel ; fields = fiche par ligne */
  const [editorMode, setEditorMode] = useState<'table' | 'fields'>('table');
  const [showLivePreview, setShowLivePreview] = useState(false);

  async function load() {
    if (!est) return;
    setLoading(true);
    const [d, c, m, e] = await Promise.all([
      supabase.from('btp_documents').select('*').eq('establishment_id', est).order('created_at', { ascending: false }),
      supabase.from('btp_clients').select('*').eq('establishment_id', est).order('name'),
      supabase.from('btp_materials').select('*').eq('establishment_id', est).order('name'),
      supabase.from('establishments').select('name, address, phone, logo_url, branding').eq('id', est).maybeSingle(),
    ]);
    setDocs(d.data || []);
    setClients(c.data || []);
    setMaterials(m.data || []);
    if (e.data) {
      setCompany({
        name: e.data.name,
        address: e.data.address || '',
        phone: e.data.phone || '',
        logo_url: (e.data as any).logo_url || '',
      });
      const br = (e.data as any).branding;
      if (br && typeof br === 'object') setBranding({ ...DEFAULT_BRANDING, ...br });
    }
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, [est]);

  const totals = useMemo(() => {
    const lines = items.filter((i) => i.item_type === 'item');
    let ht = 0;
    let tax = 0;
    for (const i of lines) {
      const q = parseOptionalNumber(i.quantity);
      const p = parseOptionalNumber(i.unit_price);
      const disc = Number(i.discount_percent) || 0;
      const lht = lineHT(q, p, disc);
      ht += lht;
      tax += lht * (parseOptionalNumber(i.tax_rate) / 100);
    }
    const gDisc = parseOptionalNumber(form.global_discount_percent);
    ht = ht * (1 - gDisc / 100);
    tax = tax * (1 - gDisc / 100);
    const ttc = ht + tax;
    const advance = ttc * (parseOptionalNumber(form.advance_percent) / 100);
    const paid = parseOptionalNumber(form.amount_paid);
    return { ht, tax, ttc, advance, balance: Math.max(0, ttc - paid) };
  }, [items, form.global_discount_percent, form.advance_percent, form.amount_paid]);

  function lineTotal(it: Item): number {
    if (it.item_type === 'section') return 0;
    return lineHT(parseOptionalNumber(it.quantity), parseOptionalNumber(it.unit_price), Number(it.discount_percent) || 0);
  }

  function startNew(type: BtpDocType = 'quote') {
    setForm({
      id: '',
      type,
      title: '',
      date: new Date().toISOString().slice(0, 10),
      validity_date: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
      client_id: '',
      client_name: '',
      client_phone: '',
      site_location: '',
      status: 'draft',
      notes: '',
      payment_terms: branding.payment_terms_default || '',
      global_discount_percent: '',
      advance_percent: '',
      amount_paid: '',
    });
    setItems([emptyItem(), emptyItem(), emptyItem()]);
    setEditing(true);
    setError(null);
  }

  async function openPrint(doc: any) {
    setError(null);
    setPrintDoc(doc);
    setPrintItems([]);
    const { data, error: err } = await supabase
      .from('btp_document_items')
      .select('*')
      .eq('document_id', doc.id)
      .order('sort_order');
    if (err) {
      setError(err.message);
      setPrintItems([]);
    } else {
      setPrintItems(data || []);
    }
    // Recharger branding si besoin
    if (est && (!company.name || !branding.activity)) {
      const { data: e } = await supabase
        .from('establishments')
        .select('name, address, phone, logo_url, branding')
        .eq('id', est)
        .maybeSingle();
      if (e) {
        setCompany({
          name: e.name,
          address: e.address || '',
          phone: e.phone || '',
          logo_url: (e as any).logo_url || '',
        });
        const br = (e as any).branding;
        if (br && typeof br === 'object') setBranding({ ...DEFAULT_BRANDING, ...br });
      }
    }
  }

  async function openEdit(doc: any) {
    setForm({
      id: doc.id,
      type: doc.type,
      title: doc.title || '',
      date: doc.date,
      validity_date: doc.validity_date || '',
      client_id: doc.client_id || '',
      client_name: doc.client_name || '',
      client_phone: doc.client_phone || '',
      site_location: doc.site_location || '',
      status: doc.status,
      notes: doc.notes || '',
      payment_terms: doc.payment_terms || '',
      global_discount_percent: Number(doc.global_discount_percent) || '',
      advance_percent: Number(doc.advance_percent) || '',
      amount_paid: Number(doc.amount_paid) || '',
    });
    const { data } = await supabase.from('btp_document_items').select('*').eq('document_id', doc.id).order('sort_order');
    const mapped: Item[] = (data || []).map((x: any) => ({
      id: x.id,
      item_type: x.item_type === 'section' ? 'section' : 'item',
      title: x.title || '',
      unit: x.unit || '',
      quantity: Number(x.quantity) ? Number(x.quantity) : '',
      unit_price: Number(x.unit_price) ? Number(x.unit_price) : '',
      tax_rate: Number(x.tax_rate) ? Number(x.tax_rate) : '',
      discount_percent: Number(x.discount_percent) || 0,
      total_ht: Number(x.total_ht) || 0,
    }));
    setItems(mapped.length ? mapped : [emptyItem()]);
    setEditing(true);
  }

  async function save() {
    if (!est || !member) return;
    const valid = items.filter((i) => i.item_type === 'section' || i.title.trim());
    if (!valid.length) {
      setError('Ajoutez au moins une désignation');
      return;
    }
    setSaving(true);
    setError(null);
    const payload = {
      establishment_id: est,
      type: form.type,
      doc_number: form.id ? docs.find((d) => d.id === form.id)?.doc_number : nextDocNumber(form.type, docs),
      title: form.title.trim() || DOC_TYPE_LABELS[form.type],
      date: form.date,
      validity_date: form.validity_date || null,
      client_id: form.client_id || null,
      client_name: form.client_name || clients.find((c) => c.id === form.client_id)?.name || null,
      client_phone: form.client_phone || clients.find((c) => c.id === form.client_id)?.phone || null,
      site_location: form.site_location || null,
      global_discount_percent: parseOptionalNumber(form.global_discount_percent),
      total_ht: totals.ht,
      total_tax: totals.tax,
      total_ttc: totals.ttc,
      advance_percent: parseOptionalNumber(form.advance_percent),
      advance_amount: totals.advance,
      amount_paid: parseOptionalNumber(form.amount_paid),
      balance_due: totals.balance,
      status: form.status,
      notes: form.notes || null,
      payment_terms: form.payment_terms || null,
      created_by: member.user_id,
      updated_at: new Date().toISOString(),
    };

    let docId = form.id;
    if (form.id) {
      const { error: e } = await supabase.from('btp_documents').update(payload).eq('id', form.id);
      if (e) {
        setError(e.message);
        setSaving(false);
        return;
      }
      await supabase.from('btp_document_items').delete().eq('document_id', form.id);
    } else {
      const { data, error: e } = await supabase.from('btp_documents').insert(payload).select('id').single();
      if (e || !data) {
        setError(e?.message || 'Erreur');
        setSaving(false);
        return;
      }
      docId = data.id;
    }

    const rows = valid.map((it, idx) => ({
      document_id: docId,
      sort_order: idx,
      item_type: it.item_type,
      title: it.title,
      unit: it.unit || null,
      quantity: parseOptionalNumber(it.quantity),
      unit_price: parseOptionalNumber(it.unit_price),
      tax_rate: parseOptionalNumber(it.tax_rate),
      discount_percent: Number(it.discount_percent) || 0,
      total_ht: it.item_type === 'item' ? lineTotal(it) : 0,
    }));
    const { error: e2 } = await supabase.from('btp_document_items').insert(rows);
    if (e2) setError(e2.message);
    setSaving(false);
    setEditing(false);
    await load();
  }

  async function remove(id: string) {
    if (!confirm('Supprimer ce document ?')) return;
    await supabase.from('btp_documents').delete().eq('id', id);
    await load();
  }

  async function convertToInvoice(doc: any) {
    if (doc.type !== 'quote') return;
    const num = nextDocNumber('invoice', docs);
    const { data: itemsData } = await supabase.from('btp_document_items').select('*').eq('document_id', doc.id).order('sort_order');
    const { data: inv, error } = await supabase
      .from('btp_documents')
      .insert({
        establishment_id: doc.establishment_id,
        type: 'invoice',
        doc_number: num,
        title: `Facture — ${doc.title}`,
        date: new Date().toISOString().slice(0, 10),
        validity_date: doc.validity_date,
        client_id: doc.client_id,
        client_name: doc.client_name,
        client_phone: doc.client_phone,
        site_location: doc.site_location,
        global_discount_percent: doc.global_discount_percent,
        total_ht: doc.total_ht,
        total_tax: doc.total_tax,
        total_ttc: doc.total_ttc,
        advance_percent: doc.advance_percent,
        advance_amount: doc.advance_amount,
        amount_paid: doc.amount_paid,
        balance_due: doc.balance_due,
        status: 'sent',
        notes: doc.notes,
        payment_terms: doc.payment_terms,
        converted_from_quote_id: doc.id,
        created_by: member?.user_id,
        updated_at: new Date().toISOString(),
      })
      .select('id')
      .single();
    if (error || !inv) {
      setError(error?.message || 'Erreur conversion');
      return;
    }
    if (itemsData?.length) {
      await supabase.from('btp_document_items').insert(
        itemsData.map((x: any, idx: number) => ({
          document_id: inv.id,
          sort_order: idx,
          item_type: x.item_type,
          title: x.title,
          unit: x.unit,
          quantity: x.quantity,
          unit_price: x.unit_price,
          tax_rate: x.tax_rate,
          discount_percent: x.discount_percent,
          total_ht: x.total_ht,
        })),
      );
    }
    await supabase.from('btp_documents').update({ status: 'accepted' }).eq('id', doc.id);
    await load();
  }

  function addMaterialLine(mat: any) {
    setItems((prev) => [
      ...prev,
      {
        item_type: 'item',
        title: mat.name,
        unit: mat.unit || '',
        quantity: '',
        unit_price: Number(mat.default_price) || '',
        tax_rate: Number(mat.default_tax_rate) || '',
        discount_percent: 0,
        total_ht: 0,
      },
    ]);
  }

  function updateItem(idx: number, patch: Partial<Item>) {
    setItems((prev) => {
      const n = [...prev];
      n[idx] = { ...n[idx], ...patch };
      return n;
    });
  }

  /** Ajoute N lignes vides au-dessus (where='above') ou en dessous (where='below') de l'index */
  function insertLines(idx: number, count: number, where: 'above' | 'below') {
    const n = Math.max(1, Math.min(20, Math.floor(count) || 1));
    const fresh = Array.from({ length: n }, () => emptyItem());
    setItems((prev) => {
      const copy = [...prev];
      const at = where === 'above' ? idx : idx + 1;
      copy.splice(at, 0, ...fresh);
      return copy;
    });
  }


  function buildDraftDoc() {
    return {
      id: form.id || 'draft',
      type: form.type,
      doc_number: form.id
        ? (docs.find((x) => x.id === form.id)?.doc_number || '…')
        : nextDocNumber(form.type, docs),
      title: form.title || DOC_TYPE_LABELS[form.type],
      date: form.date,
      validity_date: form.validity_date,
      client_name: form.client_name || clients.find((c) => c.id === form.client_id)?.name || '',
      client_phone: form.client_phone,
      site_location: form.site_location,
      status: form.status,
      notes: form.notes,
      payment_terms: form.payment_terms,
      total_ht: totals.ht,
      total_tax: totals.tax,
      total_ttc: totals.ttc,
      advance_amount: totals.advance,
      balance_due: totals.balance,
      advance_percent: parseOptionalNumber(form.advance_percent),
      amount_paid: parseOptionalNumber(form.amount_paid),
    };
  }

  function draftItemsForPrint() {
    return items
      .filter((i) => i.item_type === 'section' || i.title.trim())
      .map((it, idx) => ({
        id: `draft-${idx}`,
        item_type: it.item_type,
        title: it.title,
        unit: it.unit,
        quantity: parseOptionalNumber(it.quantity),
        unit_price: parseOptionalNumber(it.unit_price),
        tax_rate: parseOptionalNumber(it.tax_rate),
        total_ht: it.item_type === 'item' ? lineTotal(it) : 0,
      }));
  }

  function openLivePreviewWindow() {
    printBtpDocument(buildDraftDoc(), draftItemsForPrint(), company, branding);
  }


  const visible = filter === 'all' ? docs : docs.filter((d) => d.type === filter);

  if (printDoc) {
    const d = printDoc;
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2 no-print">
          <button type="button" className="btn-ghost text-sm" onClick={() => setPrintDoc(null)}>
            Retour
          </button>
          <button type="button" className="btn-primary text-sm inline-flex items-center gap-2" onClick={() => printBtpDocument(d, printItems, company, branding)}>
            <Printer size={16} /> Imprimer / enregistrer PDF
          </button>
          <button type="button" className="btn-secondary text-sm" onClick={() => void openEdit(d)}>
            <Pencil size={14} /> Modifier
          </button>
        </div>
        <div className="btp-print-root">
        <div className="btp-print-sheet rounded-2xl p-6 md:p-8 max-w-3xl mx-auto shadow-xl animate-in" style={{ background: "#ffffff", color: "#1c1917" }}>
          <header className="flex gap-4 border-b-2 border-sky-600 pb-4 mb-5">
            {company.logo_url ? (
              <img src={company.logo_url} alt="" className="h-16 w-16 object-contain rounded-lg" />
            ) : (
              <div className="h-16 w-16 rounded-xl bg-gradient-to-br from-sky-500 to-blue-700 flex items-center justify-center text-white font-bold text-2xl shadow">
                {(company.name || 'B').slice(0, 1)}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-bold text-sky-900 leading-tight">{company.name || 'Entreprise'}</h1>
              {branding.activity && <p className="text-sm text-stone-600">{branding.activity}</p>}
              {branding.slogan && <p className="text-xs italic text-stone-500">{branding.slogan}</p>}
              {branding.header_note && <p className="text-xs text-sky-700 mt-0.5">{branding.header_note}</p>}
              <p className="text-xs text-stone-600 mt-1">{[company.address, branding.city, branding.country].filter(Boolean).join(', ')}</p>
              <p className="text-xs text-stone-600">{[company.phone, branding.email, branding.website].filter(Boolean).join(' · ')}</p>
              <p className="text-[10px] text-stone-500 mt-0.5">
                {[branding.rccm && `RCCM ${branding.rccm}`, branding.nif && `NIF ${branding.nif}`, branding.tva_number && `TVA ${branding.tva_number}`]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
            </div>
            <div className="text-right shrink-0">
              <p className="inline-flex items-center gap-1.5 text-lg font-bold text-sky-700 uppercase tracking-wide">
                {d.type === 'invoice' ? <Receipt size={18} /> : <FileText size={18} />}
                {DOC_TYPE_LABELS[d.type as BtpDocType] || d.type}
              </p>
              <p className="text-sm font-semibold text-stone-800">{d.doc_number}</p>
              <p className="text-xs text-stone-500">Date : {d.date}</p>
              {d.validity_date && <p className="text-xs text-stone-500">Validité : {d.validity_date}</p>}
            </div>
          </header>

          <div className="grid grid-cols-2 gap-4 mb-5 text-sm">
            <div className="rounded-xl bg-sky-50 p-3 border border-sky-100">
              <p className="text-[10px] uppercase text-sky-700 font-semibold mb-1">Client</p>
              <p className="font-semibold text-stone-900">{d.client_name || '—'}</p>
              {d.client_phone && <p className="text-xs">{d.client_phone}</p>}
              {d.site_location && <p className="text-xs mt-1">📍 {d.site_location}</p>}
            </div>
            <div className="rounded-xl bg-stone-50 p-3 border border-stone-200">
              <p className="text-[10px] uppercase text-stone-500 font-semibold mb-1">Objet</p>
              <p className="font-medium text-stone-900">{d.title || '—'}</p>
              <p className="text-xs text-stone-500">{DOC_STATUS_LABELS[d.status as BtpDocStatus] || d.status}</p>
            </div>
          </div>

          <table className="w-full text-sm border-collapse mb-4">
            <thead>
              <tr className="bg-gradient-to-r from-sky-700 to-blue-600 text-white">
                <th className="text-left p-2.5 rounded-tl-lg w-8"></th>
                <th className="text-left p-2.5">Désignation</th>
                <th className="text-right p-2.5 whitespace-nowrap">Qté</th>
                <th className="text-right p-2.5 whitespace-nowrap">Prix unitaire</th>
                <th className="text-right p-2.5 rounded-tr-lg whitespace-nowrap">Prix total</th>
              </tr>
            </thead>
            <tbody>
              {printItems.map((it: any, i: number) =>
                it.item_type === 'section' ? (
                  <tr key={it.id || i} className="bg-sky-50">
                    <td colSpan={5} className="p-2.5 font-semibold text-sky-900">
                      {it.title}
                    </td>
                  </tr>
                ) : (
                  <tr key={it.id || i} className="border-b border-stone-200">
                    <td className="p-2 text-lg text-center">{materialIcon(it.title)}</td>
                    <td className="p-2.5 font-medium text-stone-800">
                      {it.title}
                      {it.unit ? <span className="text-stone-400 text-xs ml-1">({it.unit})</span> : null}
                    </td>
                    <td className="p-2.5 text-right tabular-nums">
                      {Number(it.quantity) ? Number(it.quantity) : '—'}
                    </td>
                    <td className="p-2.5 text-right tabular-nums">
                      {Number(it.unit_price) ? formatMoney(it.unit_price) : '—'}
                    </td>
                    <td className="p-2.5 text-right font-semibold tabular-nums text-stone-900">
                      {Number(it.total_ht) || Number(it.quantity) * Number(it.unit_price)
                        ? formatMoney(Number(it.total_ht) || Number(it.quantity) * Number(it.unit_price))
                        : '—'}
                    </td>
                  </tr>
                ),
              )}
            </tbody>
          </table>

          <div className="flex justify-end mb-5">
            <div className="w-64 rounded-xl border-2 border-sky-600 bg-sky-50 p-3 text-sm space-y-1.5 shadow-sm">
              <div className="flex justify-between text-stone-600">
                <span>Total HT</span>
                <span className="tabular-nums">{formatMoney(d.total_ht)}</span>
              </div>
              {Number(d.total_tax) > 0 && (
                <div className="flex justify-between text-stone-600">
                  <span>TVA</span>
                  <span className="tabular-nums">{formatMoney(d.total_tax)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-sky-900 text-base border-t border-sky-200 pt-2">
                <span>Total général</span>
                <span className="tabular-nums">{formatMoney(d.total_ttc)}</span>
              </div>
              {Number(d.advance_amount) > 0 && (
                <div className="flex justify-between text-xs text-stone-500">
                  <span>Acompte</span>
                  <span>{formatMoney(d.advance_amount)}</span>
                </div>
              )}
              {Number(d.balance_due) > 0 && (
                <div className="flex justify-between text-xs font-medium text-amber-800">
                  <span>Reste dû</span>
                  <span>{formatMoney(d.balance_due)}</span>
                </div>
              )}
            </div>
          </div>

          {(d.payment_terms || branding.payment_terms_default) && (
            <p className="text-xs text-stone-600 mb-2">
              <strong>Paiement :</strong> {d.payment_terms || branding.payment_terms_default}
            </p>
          )}
          {d.notes && (
            <p className="text-xs text-stone-600 mb-2">
              <strong>Notes :</strong> {d.notes}
            </p>
          )}
          {branding.legal_notice && <p className="text-[10px] text-stone-500 mb-3">{branding.legal_notice}</p>}

          {(branding.mobile_money || branding.bank_name || branding.iban) && (
            <div className="text-xs text-stone-600 border border-stone-200 rounded-xl p-2.5 mb-3 bg-stone-50">
              <p className="font-semibold text-stone-700 mb-0.5">Règlement</p>
              {branding.mobile_money && <p>📱 Mobile Money : {branding.mobile_money}</p>}
              {branding.bank_name && <p>🏦 Banque : {branding.bank_name}</p>}
              {branding.iban && <p>Compte : {branding.iban}</p>}
            </div>
          )}

          <footer className="border-t border-stone-300 pt-3 mt-4 flex items-end justify-between gap-4">
            <div className="text-[10px] text-stone-500 flex-1">
              <p>{branding.footer_text || 'Merci de votre confiance.'}</p>
              <p className="mt-1">
                {company.name} · {[company.phone, branding.email].filter(Boolean).join(' · ')}
              </p>
            </div>
            {branding.stamp_url && <img src={branding.stamp_url} alt="Cachet" className="h-16 object-contain opacity-90" />}
          </footer>
        </div>
        </div>
        <style dangerouslySetInnerHTML={{ __html: "\n          .animate-in { animation: btpIn 0.45s ease-out; }\n          @keyframes btpIn {\n            from { opacity: 0; transform: translateY(12px) scale(0.98); }\n            to { opacity: 1; transform: none; }\n          }\n        " }} />
      </div>
    );
  }

  if (editing) {
    return (
      <div className="space-y-4 max-w-3xl pb-24">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h1 className="text-xl font-bold text-stone-100 flex items-center gap-2">
            <Sparkles className="text-sky-400" size={20} />
            {form.id ? 'Modifier' : 'Nouveau'} {DOC_TYPE_LABELS[form.type]}
          </h1>
          <div className="flex gap-2">
            <button
              type="button"
              className="btn-secondary text-sm inline-flex items-center gap-1.5"
              onClick={() => setShowLivePreview((v) => !v)}
            >
              {showLivePreview ? <EyeOff size={16} /> : <Eye size={16} />}
              Voir le devis
            </button>
            <button type="button" className="btn-ghost text-sm" onClick={() => setEditing(false)}>
              Retour
            </button>
          </div>
        </div>
        {error && (
          <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">{error}</div>
        )}

        <div className="card space-y-3 border-sky-500/20">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Type</label>
              <select
                className="input-field"
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value as BtpDocType })}
                disabled={!!form.id}
              >
                <option value="quote">Devis</option>
                <option value="invoice">Facture</option>
                <option value="situation">Situation</option>
              </select>
            </div>
            <div>
              <label className="label">Statut</label>
              <select
                className="input-field"
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value as BtpDocStatus })}
              >
                {Object.entries(DOC_STATUS_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="label">Titre / objet</label>
            <input
              className="input-field"
              placeholder="Ex. Construction mur de clôture"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Date</label>
              <input type="date" className="input-field" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            </div>
            <div>
              <label className="label">Validité</label>
              <input type="date" className="input-field" value={form.validity_date} onChange={(e) => setForm({ ...form, validity_date: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="label">Client</label>
            <select
              className="input-field"
              value={form.client_id}
              onChange={(e) => {
                const c = clients.find((x) => x.id === e.target.value);
                setForm({
                  ...form,
                  client_id: e.target.value,
                  client_name: c?.name || '',
                  client_phone: c?.phone || '',
                  site_location: c?.site_address || form.site_location,
                });
              }}
            >
              <option value="">— Choisir ou saisir —</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}{c.phone ? ` (${c.phone})` : ''}
                </option>
              ))}
            </select>
            <input className="input-field mt-2" placeholder="Nom client" value={form.client_name} onChange={(e) => setForm({ ...form, client_name: e.target.value })} />
            <input className="input-field mt-2" placeholder="Téléphone" value={form.client_phone} onChange={(e) => setForm({ ...form, client_phone: e.target.value })} />
          </div>
          <div>
            <label className="label">Chantier / lieu</label>
            <input className="input-field" placeholder="Adresse du chantier" value={form.site_location} onChange={(e) => setForm({ ...form, site_location: e.target.value })} />
          </div>
        </div>

        <div className="card space-y-3 border-sky-500/20">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-semibold text-stone-100">Lignes du document</h2>
            <div className="flex gap-2">
              <button
                type="button"
                className="btn-secondary text-xs"
                onClick={() =>
                  setItems((p) => [
                    ...p,
                    { item_type: 'section', title: '', unit: '', quantity: '', unit_price: '', tax_rate: '', discount_percent: 0, total_ht: 0 },
                  ])
                }
              >
                + Section
              </button>
              <button type="button" className="btn-primary text-xs" onClick={() => setItems((p) => [...p, emptyItem()])}>
                + Ligne
              </button>
            </div>
          </div>

          {/* Choix du mode de saisie */}
          <div className="flex gap-2 p-1 rounded-xl bg-stone-950/80 border border-stone-700/80">
            <button
              type="button"
              onClick={() => setEditorMode('table')}
              className={`flex-1 text-sm py-2.5 rounded-lg font-medium transition ${
                editorMode === 'table'
                  ? 'bg-sky-600 text-white shadow'
                  : 'text-stone-400 hover:text-stone-200'
              }`}
            >
              📊 Tableau de devis
            </button>
            <button
              type="button"
              onClick={() => setEditorMode('fields')}
              className={`flex-1 text-sm py-2.5 rounded-lg font-medium transition ${
                editorMode === 'fields'
                  ? 'bg-sky-600 text-white shadow'
                  : 'text-stone-400 hover:text-stone-200'
              }`}
            >
              📝 Saisie par champs
            </button>
          </div>
          <p className="text-[11px] text-stone-500">
            {editorMode === 'table'
              ? 'Mode tableau : saisie rapide type Excel (tout reste modifiable).'
              : 'Mode champs : une fiche claire par ligne (idéal mobile).'}
          </p>


          {materials.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {materials.slice(0, 16).map((m) => (
                <button
                  key={m.id}
                  type="button"
                  className="text-[11px] px-2.5 py-1 rounded-full bg-stone-800/90 text-stone-300 hover:bg-sky-900/50 hover:text-sky-200 transition border border-stone-700/80"
                  onClick={() => addMaterialLine(m)}
                >
                  {materialIcon(m.name, m.category)} {m.name}
                </button>
              ))}
            </div>
          )}

          {/* ===== MODE TABLEAU ===== */}
          {editorMode === 'table' && (
            <div className="overflow-x-auto rounded-xl border border-stone-700/80">
              <table className="w-full text-sm min-w-[520px]">
                <thead>
                  <tr className="bg-sky-900/40 text-sky-200 text-[11px] uppercase tracking-wide">
                    <th className="p-2 w-8 text-center"></th>
                    <th className="p-2 text-left">Désignation</th>
                    <th className="p-2 text-right w-20">Qté</th>
                    <th className="p-2 text-right w-28">Prix unit.</th>
                    <th className="p-2 text-right w-28">Prix total</th>
                    <th className="p-2 text-left w-16">Unité</th>
                    <th className="p-2 w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((it, idx) =>
                    it.item_type === 'section' ? (
                      <tr key={idx} className="bg-sky-950/40 border-b border-sky-800/50">
                        <td className="p-1.5 text-center">📋</td>
                        <td colSpan={5} className="p-1.5">
                          <input
                            className="input-field py-1.5 font-semibold text-sm"
                            placeholder="Titre de section"
                            value={it.title}
                            onChange={(e) => updateItem(idx, { title: e.target.value })}
                          />
                        </td>
                        <td className="p-1.5">
                          <button type="button" className="text-red-400 p-1" onClick={() => setItems(items.filter((_, i) => i !== idx))}>
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ) : (
                      <tr key={idx} className="border-b border-stone-800 hover:bg-stone-800/40">
                        <td className="p-1.5 text-center text-lg">{materialIcon(it.title)}</td>
                        <td className="p-1">
                          <input
                            className="input-field py-1.5 text-sm"
                            placeholder="Désignation"
                            value={it.title}
                            onChange={(e) => updateItem(idx, { title: e.target.value })}
                          />
                        </td>
                        <td className="p-1">
                          <input
                            type="number"
                            inputMode="decimal"
                            className="input-field py-1.5 text-sm text-right tabular-nums"
                            placeholder="—"
                            value={it.quantity}
                            onChange={(e) => updateItem(idx, { quantity: e.target.value === '' ? '' : Number(e.target.value) })}
                          />
                        </td>
                        <td className="p-1">
                          <input
                            type="number"
                            inputMode="decimal"
                            className="input-field py-1.5 text-sm text-right tabular-nums"
                            placeholder="—"
                            value={it.unit_price}
                            onChange={(e) => updateItem(idx, { unit_price: e.target.value === '' ? '' : Number(e.target.value) })}
                          />
                        </td>
                        <td className="p-1.5 text-right tabular-nums text-sky-300 font-semibold text-sm whitespace-nowrap">
                          {formatMoneyOrEmpty(lineTotal(it)) || '—'}
                        </td>
                        <td className="p-1">
                          <input
                            className="input-field py-1.5 text-xs"
                            placeholder="u"
                            value={it.unit}
                            onChange={(e) => updateItem(idx, { unit: e.target.value })}
                          />
                        </td>
                        <td className="p-1.5">
                          <div className="flex flex-col gap-0.5 items-center">
                            <button type="button" title="Ligne au-dessus" className="text-[10px] text-sky-400 hover:text-sky-300 px-1" onClick={() => insertLines(idx, 1, 'above')}>↑+1</button>
                            <button type="button" className="text-red-400 p-1" onClick={() => setItems(items.filter((_, i) => i !== idx))}>
                              <Trash2 size={14} />
                            </button>
                            <button type="button" title="Ligne en dessous" className="text-[10px] text-sky-400 hover:text-sky-300 px-1" onClick={() => insertLines(idx, 1, 'below')}>↓+1</button>
                          </div>
                        </td>
                      </tr>
                    ),
                  )}
                </tbody>
              </table>
              <div className="px-2 pb-2 flex flex-wrap gap-2 items-center border-t border-stone-800 pt-2">
                <span className="text-[11px] text-stone-500">Insérer en bas :</span>
                {[1, 2, 3, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    className="text-xs px-2.5 py-1 rounded-lg bg-stone-800 text-stone-300 hover:bg-sky-900/50 hover:text-sky-200"
                    onClick={() => setItems((p) => [...p, ...Array.from({ length: n }, () => emptyItem())])}
                  >
                    +{n} ligne{n > 1 ? 's' : ''}
                  </button>
                ))}
              </div>
              <div className="p-2 border-t border-stone-800 flex gap-2">
                <button type="button" className="btn-primary text-xs" onClick={() => setItems((p) => [...p, emptyItem()])}>
                  + Ligne
                </button>
                <button
                  type="button"
                  className="btn-secondary text-xs"
                  onClick={() =>
                    setItems((p) => [
                      ...p,
                      { item_type: 'section', title: '', unit: '', quantity: '', unit_price: '', tax_rate: '', discount_percent: 0, total_ht: 0 },
                    ])
                  }
                >
                  + Section
                </button>
              </div>
            </div>
          )}

          {/* ===== MODE SAISIE PAR CHAMPS ===== */}
          {editorMode === 'fields' && (
            <div className="space-y-3">
              {items.map((it, idx) => (
                <div
                  key={idx}
                  className={`rounded-2xl border p-3 space-y-3 transition-all duration-300 btp-line-card hover:border-sky-500/40 ${
                    it.item_type === 'section'
                      ? 'bg-sky-950/30 border-sky-700/40'
                      : 'bg-stone-900/70 border-stone-700/80'
                  }`}
                  style={{ animationDelay: `${Math.min(idx, 10) * 40}ms` }}
                >
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="text-xs font-semibold uppercase tracking-wide text-sky-400/90">
                      {it.item_type === 'section' ? 'Section' : `Ligne ${idx + 1}`}
                    </span>
                    <div className="flex items-center gap-1 flex-wrap">
                      <button type="button" className="text-[11px] px-2 py-1 rounded-lg bg-stone-800 text-sky-300" onClick={() => insertLines(idx, 1, 'above')}>↑ +1</button>
                      <button type="button" className="text-[11px] px-2 py-1 rounded-lg bg-stone-800 text-sky-300" onClick={() => insertLines(idx, 2, 'above')}>↑ +2</button>
                      <button type="button" className="text-[11px] px-2 py-1 rounded-lg bg-stone-800 text-sky-300" onClick={() => insertLines(idx, 1, 'below')}>↓ +1</button>
                      <button type="button" className="text-[11px] px-2 py-1 rounded-lg bg-stone-800 text-sky-300" onClick={() => insertLines(idx, 2, 'below')}>↓ +2</button>
                      <button type="button" className="text-[11px] px-2 py-1 rounded-lg bg-stone-800 text-sky-300" onClick={() => insertLines(idx, 3, 'below')}>↓ +3</button>
                      <button type="button" className="text-red-400 p-1.5" onClick={() => setItems(items.filter((_, i) => i !== idx))}>
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                  {it.item_type === 'section' ? (
                    <div className="flex gap-2 items-center">
                      <span className="text-xl">📋</span>
                      <input
                        className="input-field font-semibold"
                        placeholder="Titre de section"
                        value={it.title}
                        onChange={(e) => updateItem(idx, { title: e.target.value })}
                      />
                    </div>
                  ) : (
                    <>
                      <div>
                        <label className="label">Désignation</label>
                        <div className="flex gap-2 items-center">
                          <span className="text-2xl">{materialIcon(it.title)}</span>
                          <input
                            className="input-field flex-1"
                            placeholder="Ex. Ciment 50 kg, Fer 8 mm…"
                            value={it.title}
                            onChange={(e) => updateItem(idx, { title: e.target.value })}
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="label">Quantité</label>
                          <input
                            type="number"
                            inputMode="decimal"
                            className="input-field text-right tabular-nums"
                            placeholder="—"
                            value={it.quantity}
                            onChange={(e) => updateItem(idx, { quantity: e.target.value === '' ? '' : Number(e.target.value) })}
                          />
                        </div>
                        <div>
                          <label className="label">Unité</label>
                          <input
                            className="input-field"
                            placeholder="sac, m³, j…"
                            value={it.unit}
                            onChange={(e) => updateItem(idx, { unit: e.target.value })}
                          />
                        </div>
                        <div>
                          <label className="label">Prix unitaire (FCFA)</label>
                          <input
                            type="number"
                            inputMode="decimal"
                            className="input-field text-right tabular-nums"
                            placeholder="—"
                            value={it.unit_price}
                            onChange={(e) => updateItem(idx, { unit_price: e.target.value === '' ? '' : Number(e.target.value) })}
                          />
                        </div>
                        <div>
                          <label className="label">Prix total</label>
                          <div className="input-field text-right tabular-nums text-sky-300 font-bold flex items-center justify-end min-h-[42px] bg-stone-950/60">
                            {formatMoneyOrEmpty(lineTotal(it)) || '—'}
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              ))}
              <div className="flex gap-2">
                <button type="button" className="btn-primary text-sm flex-1" onClick={() => setItems((p) => [...p, emptyItem()])}>
                  + Ajouter une ligne
                </button>
                <button
                  type="button"
                  className="btn-secondary text-sm"
                  onClick={() =>
                    setItems((p) => [
                      ...p,
                      { item_type: 'section', title: '', unit: '', quantity: '', unit_price: '', tax_rate: '', discount_percent: 0, total_ht: 0 },
                    ])
                  }
                >
                  + Section
                </button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 pt-2 border-t border-stone-800">
            <div>
              <label className="label">Remise globale %</label>
              <input
                type="number"
                className="input-field"
                placeholder="—"
                value={form.global_discount_percent}
                onChange={(e) => setForm({ ...form, global_discount_percent: e.target.value === '' ? '' : Number(e.target.value) })}
              />
            </div>
            <div>
              <label className="label">Acompte %</label>
              <input
                type="number"
                className="input-field"
                placeholder="—"
                value={form.advance_percent}
                onChange={(e) => setForm({ ...form, advance_percent: e.target.value === '' ? '' : Number(e.target.value) })}
              />
            </div>
            <div>
              <label className="label">Déjà payé (FCFA)</label>
              <input
                type="number"
                className="input-field"
                placeholder="—"
                value={form.amount_paid}
                onChange={(e) => setForm({ ...form, amount_paid: e.target.value === '' ? '' : Number(e.target.value) })}
              />
            </div>
          </div>

          <div className="rounded-2xl bg-gradient-to-br from-sky-600/20 to-blue-900/30 border border-sky-500/40 p-4 text-right space-y-1 shadow-lg shadow-sky-900/20">
            <p className="text-sm text-stone-400">
              Total HT : <span className="text-stone-200 font-medium tabular-nums">{formatMoney(totals.ht)}</span>
            </p>
            {totals.tax > 0 && (
              <p className="text-sm text-stone-400">
                TVA : <span className="text-stone-200 font-medium tabular-nums">{formatMoney(totals.tax)}</span>
              </p>
            )}
            <p className="text-xl font-bold text-sky-300 tabular-nums tracking-tight">
              Total général : {formatMoney(totals.ttc)}
            </p>
            {(totals.advance > 0 || totals.balance > 0) && (
              <p className="text-xs text-stone-500">
                Acompte : {formatMoney(totals.advance)} · Reste : {formatMoney(totals.balance)}
              </p>
            )}
          </div>

          <textarea className="input-field min-h-[60px]" placeholder="Notes (optionnel)" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          <textarea className="input-field min-h-[50px]" placeholder="Conditions de paiement (optionnel)" value={form.payment_terms} onChange={(e) => setForm({ ...form, payment_terms: e.target.value })} />
          <div className="flex flex-col sm:flex-row gap-2 sticky bottom-2 z-10">
            <button
              type="button"
              className="btn-secondary flex-1 text-sm py-3 inline-flex items-center justify-center gap-2"
              onClick={() => setShowLivePreview((v) => !v)}
            >
              {showLivePreview ? <EyeOff size={18} /> : <Eye size={18} />}
              {showLivePreview ? 'Masquer l’aperçu' : 'Voir le devis'}
            </button>
            <button
              type="button"
              className="btn-secondary flex-1 text-sm py-3 inline-flex items-center justify-center gap-2"
              onClick={() => openLivePreviewWindow()}
            >
              <Printer size={18} /> Aperçu plein écran / PDF
            </button>
            <button type="button" className="btn-primary flex-1 text-base py-3" disabled={saving} onClick={() => void save()}>
              {saving ? 'Enregistrement…' : 'Enregistrer'}
            </button>
          </div>

          {/* Aperçu en direct pendant la saisie */}
          {showLivePreview && (
            <div className="mt-4 space-y-2 border-t border-sky-700/40 pt-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-sky-300 flex items-center gap-2">
                  <Eye size={16} /> Aperçu du devis (mise à jour en direct)
                </p>
                <button type="button" className="text-xs text-stone-400 underline" onClick={() => openLivePreviewWindow()}>
                  Ouvrir en grand
                </button>
              </div>
              <div
                className="rounded-xl overflow-hidden border border-stone-600 shadow-lg max-h-[70vh] overflow-y-auto"
                style={{ background: '#ffffff', color: '#1c1917' }}
              >
                <div className="p-4 text-sm" style={{ color: '#1c1917' }}>
                  <div className="flex gap-3 border-b-2 border-sky-600 pb-3 mb-3">
                    {company.logo_url ? (
                      <img src={company.logo_url} alt="" className="h-12 w-12 object-contain" />
                    ) : (
                      <div className="h-12 w-12 rounded-lg bg-sky-600 text-white font-bold flex items-center justify-center">
                        {(company.name || 'B').slice(0, 1)}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sky-900">{company.name || 'Entreprise'}</p>
                      {branding.activity && <p className="text-xs text-stone-600">{branding.activity}</p>}
                      <p className="text-[10px] text-stone-500">{[company.phone, branding.email].filter(Boolean).join(' · ')}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-bold text-sky-700 uppercase text-sm">{DOC_TYPE_LABELS[form.type]}</p>
                      <p className="text-xs font-semibold">{form.id ? docs.find((x) => x.id === form.id)?.doc_number : 'Brouillon'}</p>
                      <p className="text-[10px] text-stone-500">{form.date}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 mb-3 text-xs">
                    <div className="rounded-lg bg-sky-50 p-2 border border-sky-100">
                      <p className="text-[10px] uppercase text-sky-700 font-semibold">Client</p>
                      <p className="font-semibold">{form.client_name || '—'}</p>
                      {form.site_location && <p className="text-stone-500">📍 {form.site_location}</p>}
                    </div>
                    <div className="rounded-lg bg-stone-50 p-2 border border-stone-200">
                      <p className="text-[10px] uppercase text-stone-500 font-semibold">Objet</p>
                      <p className="font-medium">{form.title || '—'}</p>
                    </div>
                  </div>
                  <table className="w-full text-xs mb-3">
                    <thead>
                      <tr className="bg-sky-700 text-white">
                        <th className="text-left p-1.5"></th>
                        <th className="text-left p-1.5">Désignation</th>
                        <th className="text-right p-1.5">Qté</th>
                        <th className="text-right p-1.5">P.U.</th>
                        <th className="text-right p-1.5">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.filter((i) => i.item_type === 'section' || i.title.trim()).length === 0 ? (
                        <tr>
                          <td colSpan={5} className="p-3 text-center text-stone-400">
                            Saisissez des lignes pour voir l’aperçu…
                          </td>
                        </tr>
                      ) : (
                        items
                          .filter((i) => i.item_type === 'section' || i.title.trim())
                          .map((it, i) =>
                            it.item_type === 'section' ? (
                              <tr key={i} className="bg-sky-50">
                                <td colSpan={5} className="p-1.5 font-semibold text-sky-900">{it.title}</td>
                              </tr>
                            ) : (
                              <tr key={i} className="border-b border-stone-200">
                                <td className="p-1.5 text-center">{materialIcon(it.title)}</td>
                                <td className="p-1.5">{it.title}{it.unit ? ` (${it.unit})` : ''}</td>
                                <td className="p-1.5 text-right">{parseOptionalNumber(it.quantity) || '—'}</td>
                                <td className="p-1.5 text-right">{formatMoneyOrEmpty(parseOptionalNumber(it.unit_price)) || '—'}</td>
                                <td className="p-1.5 text-right font-semibold">{formatMoneyOrEmpty(lineTotal(it)) || '—'}</td>
                              </tr>
                            ),
                          )
                      )}
                    </tbody>
                  </table>
                  <div className="flex justify-end">
                    <div className="w-48 rounded-lg border-2 border-sky-600 bg-sky-50 p-2 text-xs space-y-1">
                      <div className="flex justify-between text-stone-600">
                        <span>Total HT</span>
                        <span>{formatMoney(totals.ht)}</span>
                      </div>
                      <div className="flex justify-between font-bold text-sky-900 text-sm border-t border-sky-200 pt-1">
                        <span>Total général</span>
                        <span>{formatMoney(totals.ttc)}</span>
                      </div>
                    </div>
                  </div>
                  {(form.notes || form.payment_terms || branding.footer_text) && (
                    <div className="mt-3 text-[10px] text-stone-500 space-y-1 border-t border-stone-200 pt-2">
                      {form.payment_terms && <p><strong>Paiement :</strong> {form.payment_terms}</p>}
                      {form.notes && <p><strong>Notes :</strong> {form.notes}</p>}
                      <p>{branding.footer_text || 'Merci de votre confiance.'}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold text-stone-100 flex items-center gap-2">
            <FileText className="text-sky-400" /> Devis & factures
          </h1>
          <p className="text-sm text-stone-500">BatiDevis — documents chantier & PDF</p>
        </div>
        <div className="flex gap-2">
          <button type="button" className="btn-secondary text-sm" onClick={() => startNew('invoice')}>+ Facture</button>
          <button type="button" className="btn-primary text-sm" onClick={() => startNew('quote')}>
            <Plus size={16} /> Devis
          </button>
        </div>
      </div>
      <div className="flex gap-2 flex-wrap">
        {(['all', 'quote', 'invoice', 'situation'] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`text-xs px-3 py-1.5 rounded-full transition ${
              filter === f ? 'bg-sky-500/20 text-sky-300' : 'bg-stone-800 text-stone-400 hover:text-stone-200'
            }`}
          >
            {f === 'all' ? 'Tous' : DOC_TYPE_LABELS[f]}
          </button>
        ))}
      </div>
      {loading ? (
        <p className="text-stone-500">Chargement…</p>
      ) : visible.length === 0 ? (
        <div className="card text-center py-12 text-stone-500 space-y-3">
          <div className="text-4xl">📋</div>
          <p>Aucun document. Créez un devis avec désignation, quantités et prix.</p>
          <button type="button" className="btn-primary text-sm" onClick={() => startNew('quote')}>Créer un devis</button>
        </div>
      ) : (
        <ul className="space-y-2">
          {visible.map((d, i) => (
            <li
              key={d.id}
              className="card flex flex-col sm:flex-row sm:items-center gap-3 hover:border-sky-500/40 hover:shadow-lg hover:shadow-sky-900/20 transition-all duration-300 border border-stone-800/80 btp-doc-card"
              style={{ animationDelay: `${Math.min(i, 8) * 45}ms` }}
            >
              <button type="button" className="flex-1 text-left min-w-0" onClick={() => void openEdit(d)}>
                <p className="font-medium text-stone-100 truncate flex items-center gap-2">
                  <span className="text-lg">{d.type === 'invoice' ? '🧾' : d.type === 'situation' ? '📊' : '📄'}</span>
                  {d.doc_number} · {d.title || DOC_TYPE_LABELS[d.type as BtpDocType]}
                </p>
                <p className="text-xs text-stone-500">
                  {DOC_TYPE_LABELS[d.type as BtpDocType]} · {d.client_name || 'Sans client'} · {d.date}
                </p>
                <p className="text-sm text-sky-400 font-semibold mt-1 tabular-nums">
                  {Number(d.total_ttc) ? formatMoney(d.total_ttc) : 'Total à compléter'} · {DOC_STATUS_LABELS[d.status as BtpDocStatus]}
                </p>
              </button>
              <div className="flex gap-2 shrink-0 flex-wrap">
                <button type="button" className="btn-secondary text-xs inline-flex items-center gap-1" onClick={() => void openPrint(d)}>
                  <Printer size={14} /> PDF
                </button>
                <button type="button" className="btn-secondary text-xs inline-flex items-center gap-1" onClick={() => void openEdit(d)}>
                  <Pencil size={14} /> Modifier
                </button>
                {d.type === 'quote' && (
                  <button type="button" className="btn-secondary text-xs inline-flex items-center gap-1" onClick={() => void convertToInvoice(d)}>
                    <ArrowRight size={14} /> Facturer
                  </button>
                )}
                <button type="button" className="text-red-400 p-2" onClick={() => void remove(d.id)}>
                  <Trash2 size={16} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <style dangerouslySetInnerHTML={{ __html: "\n        .btp-doc-card, .btp-line-card { animation: btpCardIn 0.4s ease-out both; }\n        @keyframes btpCardIn {\n          from { opacity: 0; transform: translateY(10px); }\n          to { opacity: 1; transform: translateY(0); }\n        }\n      " }} />
      <p className="text-xs text-stone-600">
        <Link to="/btp/clients" className="text-sky-400 underline">Clients</Link>
        {' · '}
        <Link to="/btp/materials" className="text-sky-400 underline">Matériaux</Link>
        {' · En-tête dans Paramètres'}
      </p>
    </div>
  );
}
