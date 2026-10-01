import { useEffect, useMemo, useState } from 'react';
import { useSearchParams, useLocation } from 'react-router-dom';
import { ClipboardCheck, Calendar, DollarSign, Smartphone, Loader2, Send, Save, Beer, CheckCircle2, AlertTriangle, MessageCircle, FileText, RefreshCw, History, PackageMinus, Volume2, VolumeX, Mic, MicOff, Camera, ImageIcon } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import {
  uploadProofImage,
  createProofPhoto,
  listProofPhotos,
  deleteProofPhoto,
  pickPhotoFromDevice,
  type StockProofPhoto,
} from '@/lib/proofPhotos';
import { isOnline, queueAdd, cacheSet, cacheGet } from '@/lib/offline';
import { useAuth } from '@/lib/auth';
import { useEstId } from '@/lib/useEstId';
import type { Product } from '@/lib/types';
import { EmptyState, Badge } from '@/components/ui';
import ProductThumb from '@/components/ProductThumb';
import { applyDefaultImagesToProducts, ensureProductImageCatalog } from '@/lib/productImages';
import { formatFCFA } from '@/lib/format';
import { buildWhatsAppLink, normalizeBusinessType } from '@/lib/businessTypes';
import { notifyOwnerOnReport, getOwnerContacts } from '@/lib/notifyOwner';
import { ROLE_LABELS } from '@/lib/types';
import { loadDayOpsSummary } from '@/lib/opsHub';
import { hasVisionApi, recognizeCasierVision, recognizeReceiptVision } from '@/lib/visionScan';
import { Link } from 'react-router-dom';
import {
  speakFrench, stopSpeaking, playTone, buildReportSpeech,
  startQuantityDictation, isSpeechRecognitionSupported,
  recordVoiceNote, shareAudioToWhatsApp, ensureMicrophone,
} from '@/lib/a11yVoice';


function todayISO() {
  return new Date().toISOString().split('T')[0];
}

type Line = { product_id: string; name: string; price: number; cost: number; qty: number };

type SavedPayload = {
  items: Line[];
  cash_counted: number;
  mobile_counted: number;
  theoretical: number;
  match: boolean;
  comment: string;
  signature: string;
  stock_deducted?: boolean;
  sent_at?: string;
};

type HistoryRow = {
  id: string;
  date: string;
  total_sales: number;
  cash: number;
  mobile_money?: number;
  sent_at?: string | null;
  notes?: string | null;
  signature?: string | null;
};

export default function DailyReportPage({ embedded = false }: { embedded?: boolean } = {}) {
  const { member, activeEstablishment } = useAuth();
  const estId = useEstId();
  const bizType = normalizeBusinessType(activeEstablishment?.type);
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const [date, setDate] = useState(() => {
    try {
      const q = new URLSearchParams(window.location.search).get('date');
      if (q && /^\d{4}-\d{2}-\d{2}$/.test(q)) return q;
    } catch { /* */ }
    return todayISO();
  });
  const [products, setProducts] = useState<Product[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [qtyMap, setQtyMap] = useState<Record<string, string>>({});
  const [cashCounted, setCashCounted] = useState('');
  const [mobileCounted, setMobileCounted] = useState('');
  const [comment, setComment] = useState('');
  const [signature, setSignature] = useState(member?.full_name || '');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [reportId, setReportId] = useState<string | null>(null);
  const [pdfPreviewHtml, setPdfPreviewHtml] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [stockDeducted, setStockDeducted] = useState(false);
  const [ownerPhone, setOwnerPhone] = useState<string | null>(null);
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [reportProofs, setReportProofs] = useState<StockProofPhoto[]>([]);
  const [geminiHint, setGeminiHint] = useState<string | null>(null);
  const [geminiBusy, setGeminiBusy] = useState(false);
  const [proofBusy, setProofBusy] = useState(false);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [dictatingId, setDictatingId] = useState<string | null>(null);
  const [dictationHint, setDictationHint] = useState('');
  const [recordingVoice, setRecordingVoice] = useState(false);
  const [recordLeft, setRecordLeft] = useState(0);


  const lines: Line[] = useMemo(() => {
    return products.map((p) => ({
      product_id: p.id,
      name: p.name,
      price: Number(p.price) || 0,
      cost: Number(p.cost) || 0,
      qty: Math.max(0, Math.floor(Number(qtyMap[p.id]) || 0)),
    }));
  }, [products, qtyMap]);

  const soldLines = useMemo(() => lines.filter((l) => l.qty > 0), [lines]);
  const theoretical = useMemo(
    () => soldLines.reduce((s, l) => s + l.qty * l.price, 0),
    [soldLines]
  );
  const cash = Number(cashCounted) || 0;
  const mobile = Number(mobileCounted) || 0;
  const received = cash + mobile;
  const diff = theoretical - received;

  const match = Math.abs(diff) < 1;

  async function dictateQty(productId: string, productName: string) {
    if (!isSpeechRecognitionSupported()) {
      setDictationHint('Dictée : utilisez Chrome sur Android.');
      speakFrench('Dictée non disponible. Utilisez Chrome.');
      return;
    }
    setDictatingId(productId);
    setDictationHint('Autorisation du micro…');
    const mic = await ensureMicrophone();
    if (!mic.ok) {
      setDictationHint(mic.detail);
      speakFrench('Microphone non autorisé.');
      setDictatingId(null);
      return;
    }
    setDictationHint(`Dites la quantité pour ${productName}…`);
    speakFrench(`Quantité pour ${productName} ?`);
    playTone('tap');
    startQuantityDictation({
      onResult: ({ transcript, qty }) => {
        if (qty != null) {
          setQtyMap((m) => ({ ...m, [productId]: String(qty) }));
          setDictationHint(`${productName} : ${qty} (« ${transcript} »)`);
          playTone('ok');
          speakFrench(`${productName}, ${qty}`);
        } else {
          setDictationHint(`Pas compris (« ${transcript} »). Réessayez.`);
          playTone('warn');
        }
      },
      onError: (msg) => setDictationHint(msg),
      onEnd: () => setDictatingId(null),
    });
  }

  async function whatsappVoice() {
    setRecordingVoice(true);
    setRecordLeft(12);
    const mic = await ensureMicrophone();
    if (!mic.ok) {
      setRecordingVoice(false);
      alert(mic.detail);
      return;
    }
    speakFrench('Enregistrement du vocal. Lisez le point ou laissez le silence après le résumé.');
    // D'abord faire écouter le résumé
    listenReport();
    const blob = await recordVoiceNote(12000, (s) => setRecordLeft(s));
    setRecordingVoice(false);
    if (!blob) {
      alert('Micro indisponible ou permission refusée.');
      return;
    }
    const shared = await shareAudioToWhatsApp(blob, `rapport-${date}.webm`);
    // Ouvrir WhatsApp texte aussi
    const msg = reportText();
    const link = buildWhatsAppLink(ownerPhone, msg);
    if (link) window.open(link, '_blank', 'noopener,noreferrer');
    if (shared) {
      alert('Choisissez WhatsApp dans le partage pour envoyer le vocal.');
    } else {
      alert('Vocal téléchargé. Joignez-le dans WhatsApp au propriétaire.');
    }
  }

  function listenReport() {
    const text = buildReportSpeech({
      establishmentName: activeEstablishment?.name,
      date,
      items: soldLines.map((l) => ({ name: l.name, qty: l.qty, total: l.qty * l.price })),
      theoretical,
      cash,
      mobile,
      match,
      diff,
    });
    playTone(match ? 'ok' : 'warn');
    const ok = speakFrench(text);
    if (!ok) alert('La lecture vocale n\'est pas disponible sur cet appareil.');
  }

  // Son quand on arrive sur l'étape caisse avec un écart calculable


  async function loadHistory() {
    if (!estId) return;
    const { data } = await supabase
      .from('daily_reports')
      .select('id, date, total_sales, cash, mobile_money, sent_at, notes, signature')
      .eq('establishment_id', estId)
      .order('date', { ascending: false })
      .limit(30);
    setHistory((data as HistoryRow[]) || []);
  }

  async function load() {
    // Même résolution que l'Inventaire : auth + cache local si member pas encore hydraté
    let resolvedEst =
      estId ||
      activeEstablishment?.id ||
      member?.establishment_id ||
      null;
    if (!resolvedEst) {
      try {
        const uid = member?.user_id;
        const raw =
          (uid && localStorage.getItem(`mm_active_est:${uid}`)) ||
          localStorage.getItem('mm_active_est');
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed?.id) resolvedEst = String(parsed.id);
        }
      } catch {
        /* */
      }
    }
    if (!resolvedEst) {
      setProducts([]);
      setLoadError(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError(null);
    try {
      let prodErr: { message?: string } | null = null;
      let list: Product[] = [];

      // 1) RPC sécurisée (même chemin que Inventaire — contourne RLS fragiles)
      try {
        const rpc = await supabase.rpc('list_products_for_est', { p_est_id: resolvedEst });
        if (!rpc.error && Array.isArray(rpc.data) && rpc.data.length > 0) {
          list = rpc.data as Product[];
        } else if (rpc.error) {
          console.warn('list_products_for_est', rpc.error);
          prodErr = rpc.error;
        }
      } catch (e) {
        console.warn('rpc products daily report', e);
      }

      // 2) Select direct + retries (session/RLS parfois pas prête)
      if (list.length === 0) {
        for (let attempt = 0; attempt < 3; attempt++) {
          const res = await supabase
            .from('products')
            .select(
              'id,establishment_id,name,category,price,cost,stock,min_stock,unit,casier_size,image_url,units_per_package,consigne_unit,empty_bottles',
            )
            .eq('establishment_id', resolvedEst)
            .order('name');
          const prods = (res.data as Product[] | null) ?? null;
          prodErr = res.error;
          if (!prodErr && prods && prods.length > 0) {
            list = prods;
            break;
          }
          if (!prodErr && prods && prods.length === 0) break;
          await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
        }
      }

      // 3) Select * dernier recours
      if (list.length === 0) {
        const res2 = await supabase
          .from('products')
          .select('*')
          .eq('establishment_id', resolvedEst)
          .order('name');
        if (!res2.error && res2.data?.length) {
          list = res2.data as Product[];
          prodErr = null;
        } else if (res2.error) {
          prodErr = res2.error;
        }
      }

      const { data: existing } = await supabase
        .from('daily_reports')
        .select('*')
        .eq('establishment_id', resolvedEst)
        .eq('date', date)
        .maybeSingle();

      if (prodErr && list.length === 0) {
        console.error('products load', prodErr);
        setLoadError(prodErr.message || 'Impossible de charger les boissons (droits ou réseau).');
      } else {
        setLoadError(null);
      }

      // 4) Cache offline — clés alignées Inventaire + ancienne clé rapport
      if (!list.length) {
        try {
          for (const key of [`products:${resolvedEst}`, `products_${resolvedEst}`]) {
            const cached = await cacheGet<Product[]>(key);
            if (cached?.length) {
              list = cached;
              setLoadError(null);
              break;
            }
          }
        } catch {
          /* */
        }
      } else {
        try {
          await cacheSet(`products:${resolvedEst}`, list);
          await cacheSet(`products_${resolvedEst}`, list);
        } catch {
          /* */
        }
      }
      void ensureProductImageCatalog();
      setProducts(
        applyDefaultImagesToProducts(list).sort((a, b) =>
          (a.name || '').localeCompare(b.name || '', 'fr', { sensitivity: 'base' }),
        ) as Product[],
      );
      // Prefill POS : quantités caisse du jour si rapport pas encore saisi
      try {
        const ops = await loadDayOpsSummary(resolvedEst, date);
        if (!existing && ops.byProduct.length) {
          const map: Record<string, string> = {};
          for (const line of ops.byProduct) {
            if (line.product_id && line.qty > 0) map[line.product_id] = String(line.qty);
          }
          if (Object.keys(map).length) {
            setQtyMap(map);
            setDictationHint('Quantités préremplies depuis la caisse du jour.');
          }
        }
        // Si rapport existant sans items, aussi proposer
      } catch { /* */ }


      try {
        const owner = await getOwnerContacts(resolvedEst);
        setOwnerPhone(owner?.owner_phone || null);
      } catch {
        setOwnerPhone(null);
      }

      if (existing) {
        setReportId(existing.id);
        setSent(Boolean((existing as any).sent_at));
        setSignature(existing.signature || member?.full_name || '');
        try {
          const raw = existing.notes || '';
          if (raw.startsWith('{')) {
            const parsed = JSON.parse(raw) as SavedPayload;
            const map: Record<string, string> = {};
            (parsed.items || []).forEach((it) => {
              map[it.product_id] = String(it.qty);
            });
            setQtyMap(map);
            setCashCounted(String(parsed.cash_counted ?? existing.cash ?? ''));
            setMobileCounted(String(parsed.mobile_counted ?? (existing as any).mobile_money ?? ''));
            setComment(parsed.comment || '');
            setStockDeducted(Boolean(parsed.stock_deducted));
            if ((parsed.items || []).some((i) => i.qty > 0)) setStep(1); // rester sur boissons, l'utilisateur enchaîne
          } else {
            setComment(raw);
            setCashCounted(String(existing.cash ?? ''));
            setMobileCounted(String((existing as any).mobile_money ?? ''));
          }
        } catch {
          setComment(existing.notes || '');
        }
      } else {
        setReportId(null);
        setSent(false);
        setStockDeducted(false);
        setQtyMap({});
        setCashCounted('');
        setMobileCounted('');
        setComment('');
        setStep(1);
      }
      await loadHistory();
    } catch (e) {
      console.error('load daily report', e);
    } finally {
      setLoading(false);
    }
  }

  // stop speech on unmount
  useEffect(() => {
    return () => stopSpeaking();
  }, []);

  // Navigation calendrier : ?date=YYYY-MM-DD (évite conflit avec date locale)
  useEffect(() => {
    const q = searchParams.get('date') || new URLSearchParams(location.search).get('date');
    if (!q) return;
    const normalized = q.slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return;
    if (normalized !== date) {
      setDate(normalized);
      setStep(1);
      setSent(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, location.search]);

  useEffect(() => {
    void load();
    const t = window.setTimeout(() => setLoading(false), 12000);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estId, date]);

  function buildPayload(extra?: Partial<SavedPayload>): SavedPayload {
    return {
      items: soldLines,
      cash_counted: cash,
      mobile_counted: mobile,
      theoretical,
      match,
      comment,
      signature,
      stock_deducted: stockDeducted,
      ...extra,
    };
  }

  
  async function loadReportProofs() {
    if (!estId) return;
    const all = await listProofPhotos(estId);
    const day = date;
    // Lier au rapport sélectionné (date du point), pas seulement taken_at serveur
    const filtered = all.filter((p) => {
      const note = String(p.note || '');
      if (note.includes(`report_date:${day}`) || note.includes(`Point ${day}`)) return true;
      const t = (p.taken_at || p.created_at || '').slice(0, 10);
      return t === day && (p.kind === 'sale' || p.kind === 'other' || p.kind === 'stock');
    });
    setReportProofs(filtered);
  }

  async function handleProofFile(file: File | null | undefined) {
    if (!estId) {
      alert('Établissement introuvable.');
      return;
    }
    if (!file) return;
    setProofBusy(true);
    try {
      const names = soldLines.slice(0, 4).map((l) => `${l.name}×${l.qty}`).join(', ');
      const note = `report_date:${date} | Point ${date} — ${names}${soldLines.length > 4 ? '…' : ''}`;
      const { processPickedFile } = await import('@/lib/proofPhotos');
      const r = await processPickedFile(estId, file, {
        productId: soldLines[0]?.product_id || null,
        kind: 'sale',
        note,
        userId: member?.user_id || null,
      });
      if (!r.ok) {
        alert(r.error || 'Enregistrement photo impossible. Réessayez.');
      } else {
        // Affichage immédiat (évite filtre date / latence)
        const localPreview = r.url || URL.createObjectURL(file);
        setReportProofs((prev) => [
          {
            id: r.id || `local-${Date.now()}`,
            establishment_id: estId,
            product_id: soldLines[0]?.product_id || null,
            kind: 'sale',
            image_url: localPreview,
            note,
            taken_at: new Date().toISOString(),
            taken_by: member?.user_id || null,
            created_at: new Date().toISOString(),
          },
          ...prev.filter((x) => x.id !== r.id),
        ]);
        await loadReportProofs();

        // Gemini : compter casiers / boissons sur la photo pour aider le point
        if (hasVisionApi() && products.length > 0) {
          setGeminiBusy(true);
          setGeminiHint('Gemini analyse la photo (casiers / bouteilles)…');
          try {
            const vis = await recognizeCasierVision(file, products, () => {});
            if (vis.lines.length) {
              setQtyMap((prev) => {
                const next = { ...prev };
                let applied = 0;
                for (const line of vis.lines) {
                  const id = line.matchId;
                  if (!id || line.stock <= 0) continue;
                  next[id] = String(line.stock);
                  applied += 1;
                }
                setGeminiHint(
                  applied > 0
                    ? `Gemini a proposé ${applied} quantité(s) depuis la photo. Vérifiez l’étape Boissons.`
                    : `Gemini a lu : ${vis.lines.map((l) => `${l.name}×${l.stock}`).slice(0, 4).join(', ')}. Aucune correspondance stock — ajustez à la main.`,
                );
                return next;
              });
            } else {
              setGeminiHint('Gemini n’a pas détecté de casiers lisibles. Vous pouvez rephotographer ou saisir à la main.');
            }
          } catch (ge: any) {
            setGeminiHint(ge?.message || 'Analyse Gemini indisponible — saisie manuelle.');
          }
          setGeminiBusy(false);
        } else if (!hasVisionApi()) {
          setGeminiHint('Astuce : activez Gemini (Scanner inventaire) pour compter automatiquement les casiers sur photo.');
        }
      }
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Erreur photo');
    }
    setProofBusy(false);
  }

  async function captureReportProof(fromGallery: boolean) {
    if (!estId) {
      alert('Établissement introuvable.');
      return;
    }
    setProofBusy(true);
    try {
      const file = await pickPhotoFromDevice(!fromGallery);
      if (!file) {
        setProofBusy(false);
        return;
      }
      await handleProofFile(file);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Impossible d\'ouvrir la caméra / galerie');
      setProofBusy(false);
    }
  }

  async function removeReportProof(id: string) {
    if (!confirm('Supprimer cette photo ?')) return;
    const r = await deleteProofPhoto(id);
    if (!r.ok) alert(r.error || 'Suppression impossible');
    else await loadReportProofs();
  }

  async function saveReport(markSent: boolean, payloadOverride?: SavedPayload) {
    if (!estId) return null;
    const payload = payloadOverride || buildPayload(markSent ? { sent_at: new Date().toISOString() } : {});
    const row: Record<string, unknown> = {
      establishment_id: estId,
      date,
      total_sales: theoretical,
      total_expenses: 0,
      cash,
      mobile_money: mobile,
      losses: match ? 0 : Math.abs(diff),
      broken: 0,
      notes: JSON.stringify(payload),
      signature,
      locked: false,
    };
    if (markSent) row.sent_at = new Date().toISOString();

    // Hors ligne : file d'attente + cache local
    if (!isOnline()) {
      const localId = reportId || `offline-report-${estId}-${date}`;
      if (reportId && !String(reportId).startsWith('offline-')) {
        await queueAdd('daily_reports', 'update', row, { id: reportId });
      } else {
        await queueAdd('daily_reports', 'insert', { ...row, _local_id: localId });
      }
      setReportId(localId);
      try {
        const key = `daily_reports:${estId}`;
        const cached = (await cacheGet<Record<string, unknown>[]>(key)) || [];
        const filtered = cached.filter((r) => r.date !== date);
        filtered.unshift({ ...row, id: localId });
        await cacheSet(key, filtered.slice(0, 60));
      } catch { /* */ }
      return localId;
    }

    if (reportId && !String(reportId).startsWith('offline-')) {
      const { error } = await supabase.from('daily_reports').update(row).eq('id', reportId);
      if (error && String(error.message).includes('sent_at')) {
        const { sent_at: _s, ...rest } = row;
        await supabase.from('daily_reports').update(rest).eq('id', reportId);
      }
      return reportId;
    }
    const { data, error } = await supabase.from('daily_reports').insert(row).select('id').maybeSingle();
    if (error) {
      const { sent_at: _s, ...rest } = row;
      const { data: d2 } = await supabase.from('daily_reports').insert(rest).select('id').maybeSingle();
      if (d2?.id) {
        setReportId(d2.id);
        return d2.id;
      }
      return null;
    }
    if (data?.id) {
      setReportId(data.id);
      return data.id;
    }
    return null;
  }

  /** Déduit le stock des boissons vendues (une seule fois) */
  async function deductStock(): Promise<boolean> {
    if (!estId || stockDeducted || soldLines.length === 0) return stockDeducted;
    let ok = true;
    for (const line of soldLines) {
      const prod = products.find((p) => p.id === line.product_id);
      if (!prod) continue;
      const next = Math.max(0, Math.floor(Number(prod.stock) || 0) - line.qty);
      if (!isOnline()) {
        await queueAdd('products', 'update', { stock: next, _prev_stock: Math.floor(Number(prod.stock) || 0) }, { id: line.product_id });
      } else {
        const { error } = await supabase.from('products').update({ stock: next }).eq('id', line.product_id);
        if (error) {
          ok = false;
          continue;
        }
      }
      // trace optionnelle
      try {
        await supabase.from('stock_movements').insert({
          establishment_id: estId,
          product_id: line.product_id,
          product_name: line.name,
          qty: -line.qty,
          movement_type: 'report_sale',
          unit_cost: line.cost || Number(prod.cost) || 0,
          unit_price: line.price || Number(prod.price) || 0,
          reason: 'rapport_du_jour',
          note: `Rapport ${date}`,
          created_by: member?.user_id || null,
        });
      } catch {
        /* table peut ne pas exister */
      }
    }
    if (ok) {
      setStockDeducted(true);
      setProducts((prev) =>
        prev.map((p) => {
          const line = soldLines.find((l) => l.product_id === p.id);
          if (!line) return p;
          return { ...p, stock: Math.max(0, Math.floor(Number(p.stock) || 0) - line.qty) };
        })
      );
    }
    return ok;
  }

  function reportText(): string {
    const est = activeEstablishment?.name || 'Maquis';
    const linesTxt = soldLines
      .map((l) => `• ${l.name} × ${l.qty} = ${formatFCFA(l.qty * l.price)}`)
      .join('\n');
    return (
      `📋 *Rapport du jour — ${est}*\n` +
      `📅 Date : ${date}\n\n` +
      `🍺 *Boissons vendues*\n${linesTxt || 'Aucune'}\n\n` +
      `💰 Total théorique : *${formatFCFA(theoretical)}*\n` +
      `💵 Espèces : ${formatFCFA(cash)}\n` +
      `📱 Mobile Money : ${formatFCFA(mobile)}\n` +
      `🧮 Reçu : ${formatFCFA(received)}\n` +
      `${match ? '✅ Caisse OK' : `⚠️ Écart : ${formatFCFA(diff)}`}\n` +
      `${stockDeducted ? '📦 Stock déduit\n' : ''}` +
      (comment ? `📝 ${comment}\n` : '') +
      (signature ? `✍️ ${signature}\n` : '') +
      `\nOuvrir dans l'app : Rapport du jour → ${date}\n— Stock Manager AI`
    );
  }

  function buildReportHtml(): string {
    const est = activeEstablishment?.name || 'Maquis';
    const rows = soldLines
      .map((l, i) => {
        const icons = ['🍺', '🍻', '🥂', '🥤', '🍹'];
        const icon = icons[i % icons.length];
        return `<tr>
          <td class="num">${i + 1}</td>
          <td class="prod"><span class="ico">${icon}</span> ${escapeHtml(l.name)}</td>
          <td class="n">${l.qty}</td>
          <td class="n">${l.price.toLocaleString('fr-FR')}</td>
          <td class="n total-cell">${(l.qty * l.price).toLocaleString('fr-FR')}</td>
        </tr>`;
      })
      .join('');
    const genAt = new Date().toLocaleString('fr-FR');
    return `<!DOCTYPE html>
<html lang="fr"><head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Facture rapport ${date}</title>
<style>
  * { box-sizing: border-box; }
  @page { margin: 12mm; }
  html, body { margin: 0; padding: 0; }
  body {
    font-family: 'Segoe UI', system-ui, sans-serif;
    color: #1c1917;
    background: linear-gradient(165deg, #fff7ed 0%, #fef3c7 35%, #ecfdf5 100%);
    min-height: 100vh;
    padding: 20px 16px 40px;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }
  .sheet {
    max-width: 720px;
    margin: 0 auto;
    background: #fff;
    border-radius: 20px;
    overflow: hidden;
    box-shadow: 0 12px 40px rgba(180, 83, 9, 0.15);
    border: 2px solid #fbbf24;
    position: relative;
  }
  .bubbles { position: absolute; inset: 0; pointer-events: none; overflow: hidden; z-index: 0; }
  .bubbles span {
    position: absolute;
    font-size: 28px;
    opacity: 0.2;
    animation: float 4s ease-in-out infinite;
  }
  .bubbles span:nth-child(1) { left: 6%; top: 12%; animation-delay: 0s; }
  .bubbles span:nth-child(2) { left: 88%; top: 18%; animation-delay: 0.7s; }
  .bubbles span:nth-child(3) { left: 12%; top: 70%; animation-delay: 1.2s; }
  .bubbles span:nth-child(4) { left: 80%; top: 75%; animation-delay: 0.4s; }
  .bubbles span:nth-child(5) { left: 45%; top: 8%; animation-delay: 1.5s; }
  @keyframes float {
    0%, 100% { transform: translateY(0) rotate(0deg); }
    50% { transform: translateY(-12px) rotate(8deg); }
  }
  .hero {
    background: linear-gradient(120deg, #f59e0b 0%, #ea580c 45%, #16a34a 100%);
    color: #fff;
    padding: 28px 24px 22px;
    position: relative;
    z-index: 1;
  }
  .hero h1 {
    margin: 0 0 6px;
    font-size: 26px;
    font-weight: 800;
    letter-spacing: -0.02em;
    text-shadow: 0 2px 8px rgba(0,0,0,0.15);
  }
  .hero .sub { opacity: 0.95; font-size: 14px; margin: 0; }
  .hero .brand {
    display: inline-block;
    margin-top: 12px;
    background: rgba(255,255,255,0.2);
    border: 1px solid rgba(255,255,255,0.35);
    padding: 4px 12px;
    border-radius: 999px;
    font-size: 12px;
    font-weight: 600;
  }
  .beer-row {
    display: flex;
    gap: 8px;
    margin-top: 14px;
    font-size: 26px;
    animation: bounce 2s ease-in-out infinite;
  }
  @keyframes bounce {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-6px); }
  }
  .body { padding: 20px 22px 28px; position: relative; z-index: 1; }
  .meta {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-bottom: 16px;
  }
  .pill {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    border-radius: 999px;
    font-size: 12px;
    font-weight: 600;
  }
  .pill-amber { background: #fef3c7; color: #92400e; }
  .pill-green { background: #dcfce7; color: #166534; }
  .pill-sky { background: #e0f2fe; color: #075985; }
  table {
    width: 100%;
    border-collapse: separate;
    border-spacing: 0;
    margin: 12px 0 18px;
    border-radius: 12px;
    overflow: hidden;
    border: 1px solid #fed7aa;
  }
  th {
    background: linear-gradient(90deg, #f59e0b, #ea580c);
    color: #fff;
    padding: 10px 8px;
    font-size: 12px;
    text-align: left;
  }
  td {
    padding: 10px 8px;
    font-size: 13px;
    border-bottom: 1px solid #ffedd5;
    background: #fffbeb;
  }
  tr:nth-child(even) td { background: #fff7ed; }
  tr:last-child td { border-bottom: none; }
  .n { text-align: right; font-variant-numeric: tabular-nums; }
  .num { width: 36px; color: #a16207; font-weight: 700; }
  .prod { font-weight: 600; color: #292524; }
  .ico { margin-right: 4px; }
  .total-cell { color: #c2410c; font-weight: 700; }
  tfoot td {
    background: linear-gradient(90deg, #fef3c7, #ffedd5) !important;
    font-weight: 700;
    border-top: 2px solid #f59e0b;
  }
  .cards {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
    margin-bottom: 14px;
  }
  .card {
    border-radius: 14px;
    padding: 12px 14px;
    border: 1px solid #fed7aa;
    background: linear-gradient(145deg, #fff7ed, #ffedd5);
  }
  .card.mm { background: linear-gradient(145deg, #ecfdf5, #d1fae5); border-color: #6ee7b7; }
  .card .label { font-size: 11px; color: #78716c; text-transform: uppercase; letter-spacing: 0.04em; }
  .card .val { font-size: 18px; font-weight: 800; color: #9a3412; margin-top: 4px; }
  .card.mm .val { color: #047857; }
  .status {
    border-radius: 14px;
    padding: 14px;
    margin-bottom: 12px;
    font-weight: 700;
    text-align: center;
  }
  .status.ok {
    background: linear-gradient(90deg, #d1fae5, #a7f3d0);
    color: #065f46;
    border: 1px solid #34d399;
  }
  .status.bad {
    background: linear-gradient(90deg, #fee2e2, #fecaca);
    color: #991b1b;
    border: 1px solid #f87171;
  }
  .notes {
    background: #fafaf9;
    border: 1px dashed #d6d3d1;
    border-radius: 12px;
    padding: 12px;
    font-size: 13px;
    color: #44403c;
  }
  .footer {
    margin-top: 18px;
    text-align: center;
    font-size: 11px;
    color: #a8a29e;
  }
  .footer strong { color: #ea580c; }
  .bar {
    height: 6px;
    background: linear-gradient(90deg, #f59e0b, #22c55e, #0ea5e9, #f59e0b);
    background-size: 200% 100%;
    animation: shine 3s linear infinite;
  }
  @keyframes shine {
    0% { background-position: 0% 50%; }
    100% { background-position: 200% 50%; }
  }
  .actions {
    text-align: center;
    padding: 16px;
    background: #fff7ed;
    border-top: 1px solid #fed7aa;
  }
  .actions button {
    background: linear-gradient(90deg, #f59e0b, #ea580c);
    color: #fff;
    border: none;
    padding: 12px 22px;
    border-radius: 999px;
    font-weight: 700;
    font-size: 14px;
    cursor: pointer;
    box-shadow: 0 4px 14px rgba(234, 88, 12, 0.35);
  }
  @media print {
    body { background: #fff !important; padding: 0; }
    .sheet { box-shadow: none; border: 1px solid #f59e0b; }
    .actions, .no-print { display: none !important; }
    .bubbles span { opacity: 0.15; animation: none; }
    .beer-row { animation: none; }
    .bar { animation: none; background: linear-gradient(90deg, #f59e0b, #22c55e, #0ea5e9); }
  }
</style>
</head>
<body>
  <div class="sheet">
    <div class="bubbles" aria-hidden="true">
      <span>🍺</span><span>🍻</span><span>🥂</span><span>🥤</span><span>🍹</span>
    </div>
    <div class="bar"></div>
    <div class="hero">
      <h1>🍺 Facture — Rapport du jour</h1>
      <p class="sub">${escapeHtml(est)}</p>
      <div class="beer-row" aria-hidden="true">🍺 🍻 🥂 🥤 🍹</div>
      <span class="brand">Stock Manager AI</span>
    </div>
    <div class="body">
      <div class="meta">
        <span class="pill pill-amber">📅 ${escapeHtml(date)}</span>
        <span class="pill pill-sky">🏷️ ${escapeHtml(String(bizType))}</span>
        <span class="pill pill-green">🕒 ${escapeHtml(genAt)}</span>
      </div>
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Boisson</th>
            <th class="n">Qté</th>
            <th class="n">P. unit.</th>
            <th class="n">Total</th>
          </tr>
        </thead>
        <tbody>
          ${rows || '<tr><td colspan="5">Aucune vente saisie</td></tr>'}
        </tbody>
        <tfoot>
          <tr>
            <td colspan="4">Total théorique</td>
            <td class="n">${theoretical.toLocaleString('fr-FR')} FCFA</td>
          </tr>
        </tfoot>
      </table>
      <div class="cards">
        <div class="card">
          <div class="label">💵 Espèces</div>
          <div class="val">${cash.toLocaleString('fr-FR')} F</div>
        </div>
        <div class="card mm">
          <div class="label">📱 Mobile Money</div>
          <div class="val">${mobile.toLocaleString('fr-FR')} F</div>
        </div>
      </div>
      <div class="status ${match ? 'ok' : 'bad'}">
        ${match
          ? '✅ Caisse OK — total reçu = théorique (' + received.toLocaleString('fr-FR') + ' FCFA)'
          : '⚠️ Écart caisse : ' + diff.toLocaleString('fr-FR') + ' FCFA (reçu ' + received.toLocaleString('fr-FR') + ')'}
      </div>
      <div class="notes">
        ${stockDeducted ? '<p>📦 Stock inventaire mis à jour</p>' : ''}
        ${comment ? '<p><strong>Commentaire :</strong> ' + escapeHtml(comment) + '</p>' : ''}
        ${signature ? '<p><strong>Signature :</strong> ' + escapeHtml(signature) + '</p>' : '<p><strong>Signature :</strong> —</p>'}
      </div>
      <p class="footer">Document généré par <strong>Stock Manager AI</strong> · Conservez ce rapport comme facture du jour</p>
    </div>
    <div class="actions no-print">
      <button type="button" onclick="window.print()">📄 Enregistrer en PDF / Imprimer</button>
    </div>
  </div>
</body></html>`;
  }

  function openPrintPdf() {
    const html = buildReportHtml();
    // Affichage IN-APP (fiable sur mobile / APK — évite page blanche window.open)
    setPdfPreviewHtml(html);
  }

  function printPreviewNow() {
    const html = pdfPreviewHtml || buildReportHtml();
    // 1) Essayer l'iframe (bureau)
    try {
      const iframe = document.getElementById('report-pdf-frame') as HTMLIFrameElement | null;
      const win = iframe?.contentWindow;
      if (win) {
        win.focus();
        win.print();
      }
    } catch {
      /* */
    }
    // 2) Nouvel onglet depuis le geste utilisateur (mobile / APK)
    try {
      const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const w = window.open(url, '_blank');
      if (w) {
        const t = window.setTimeout(() => {
          try {
            w.focus();
            w.print();
          } catch {
            /* */
          }
        }, 600);
        w.addEventListener('load', () => {
          window.clearTimeout(t);
          try {
            w.focus();
            w.print();
          } catch {
            /* */
          }
        });
        return;
      }
    } catch {
      /* */
    }
    // 3) Fallback téléchargement HTML
    try {
      downloadReportFile();
      alert('Impression bloquée. Fichier rapport téléchargé — ouvrez-le puis Imprimer → Enregistrer en PDF.');
    } catch {
      alert('Impossible d\'imprimer depuis cet appareil. Réessayez sur Chrome.');
    }
  }

  function downloadReportFile() {
    const html = buildReportHtml();
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rapport-${date}-${(activeEstablishment?.name || 'maquis').replace(/\s+/g, '-')}.html`;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      try {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } catch {
        /* */
      }
    }, 1000);
  }

  function escapeHtml(s: string) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }


  /** Image récap du rapport (partage WhatsApp) */
  async function buildReportImageBlob(): Promise<Blob | null> {
    try {
      const W = 720;
      const lineH = 28;
      const lines = [
        activeEstablishment?.name || 'Maquis',
        `Rapport du jour — ${date}`,
        `Par: ${member?.full_name || member?.email || 'Équipe'}`,
        '',
        ...soldLines.slice(0, 12).map((l) => `${l.name}  x${l.qty}  ${formatFCFA(l.qty * l.price)}`),
        soldLines.length > 12 ? `… +${soldLines.length - 12} autres` : '',
        '',
        `Total théorique: ${formatFCFA(theoretical)}`,
        `Espèces: ${formatFCFA(Number(cashCounted) || 0)} · Mobile: ${formatFCFA(Number(mobileCounted) || 0)}`,
        match ? 'Caisse: OK' : `Écart: ${formatFCFA(diff)}`,
        '',
        'Stock Manager AI',
      ].filter((x) => x !== undefined);
      const H = Math.max(480, 40 + lines.length * lineH + 40);
      const canvas = document.createElement('canvas');
      canvas.width = W;
      canvas.height = H;
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;
      // fond
      ctx.fillStyle = '#0c0a09';
      ctx.fillRect(0, 0, W, H);
      // bandeau
      ctx.fillStyle = '#E89B2D';
      ctx.fillRect(0, 0, W, 8);
      ctx.fillStyle = '#fafaf9';
      ctx.font = 'bold 22px system-ui,sans-serif';
      let y = 48;
      for (let i = 0; i < lines.length; i++) {
        const t = lines[i];
        if (i === 0) {
          ctx.font = 'bold 26px system-ui,sans-serif';
          ctx.fillStyle = '#fbbf24';
        } else if (i === 1) {
          ctx.font = '600 20px system-ui,sans-serif';
          ctx.fillStyle = '#e7e5e4';
        } else if (t.startsWith('Total') || t.startsWith('Caisse') || t.startsWith('Écart')) {
          ctx.font = 'bold 20px system-ui,sans-serif';
          ctx.fillStyle = t.startsWith('Écart') ? '#fbbf24' : '#6ee7b7';
        } else {
          ctx.font = '18px system-ui,sans-serif';
          ctx.fillStyle = '#d6d3d1';
        }
        if (t) ctx.fillText(t, 28, y);
        y += lineH;
      }
      return await new Promise((resolve) => canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.9));
    } catch {
      return null;
    }
  }

  async function shareReportToWhatsApp() {
    const msg =
      reportText() +
      '\n\n📎 Rapport du jour — Stock Manager AI\n(Joindre l’image / fichier si le partage l’a proposé)';
    const imageBlob = await buildReportImageBlob();
    const html = buildReportHtml();
    const htmlFile = new File([html], `rapport-${date}.html`, { type: 'text/html' });
    const files: File[] = [];
    if (imageBlob) {
      files.push(new File([imageBlob], `rapport-${date}.jpg`, { type: 'image/jpeg' }));
    }
    files.push(htmlFile);

    // 1) Partage natif (Android : souvent WhatsApp avec image)
    try {
      if (navigator.share && files.length) {
        const payload: ShareData = {
          title: `Rapport ${date}`,
          text: msg,
          files,
        };
        if (!navigator.canShare || navigator.canShare(payload)) {
          await navigator.share(payload);
          return true;
        }
        // essai image seule
        if (files[0] && (!navigator.canShare || navigator.canShare({ files: [files[0]] }))) {
          await navigator.share({ title: `Rapport ${date}`, text: msg, files: [files[0]] });
          return true;
        }
      }
    } catch (e) {
      // utilisateur a annulé ou non supporté
      if (e instanceof Error && e.name === 'AbortError') return true;
    }

    // 2) Télécharger l’image pour joindre manuellement + ouvrir WhatsApp texte
    if (imageBlob) {
      try {
        const url = URL.createObjectURL(imageBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `rapport-${date}.jpg`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 2000);
      } catch { /* */ }
    }

    const link = buildWhatsAppLink(ownerPhone, msg);
    if (link) {
      window.open(link, '_blank', 'noopener,noreferrer');
      return true;
    }
    try {
      await navigator.clipboard.writeText(msg);
      alert('Message copié. Ouvrez WhatsApp et collez-le au propriétaire. (Renseignez le téléphone du propriétaire dans Paramètres.)');
    } catch {
      alert('Rapport enregistré. Ouvrez WhatsApp pour prévenir le propriétaire.');
    }
    return false;
  }

  async function sendReport() {
    if (!estId) return;
    if (soldLines.length === 0) {
      alert('Indiquez au moins une boisson vendue.');
      setStep(1);
      return;
    }
    setSaving(true);

    // 1) Déduction stock
    const deducted = await deductStock();
    const payload = buildPayload({
      stock_deducted: deducted || stockDeducted,
      sent_at: new Date().toISOString(),
    });

    // 2) Sauvegarde rapport
    const id = await saveReport(true, payload);
    if (!id) {
      setSaving(false);
      alert('Impossible d’enregistrer le rapport. Réessayez.');
      return;
    }

    // 3) Notification propriétaire (app + canaux)
    try {
      await notifyOwnerOnReport({
        establishmentId: estId,
        senderName: member?.full_name || member?.email || 'Équipe',
        senderRole: member?.role ? ROLE_LABELS[member.role] || member.role : 'staff',
        reportSummary: reportText(),
        reportDate: date,
      });
      // Pas de mailto — WhatsApp géré après génération du fichier
    } catch {
      // fallback notifications basiques
      try {
        const { data: managers } = await supabase
          .from('members')
          .select('user_id')
          .eq('establishment_id', estId)
          .eq('status', 'active')
          .in('role', ['owner', 'admin', 'super_admin']);
        if (managers?.length) {
          await supabase.from('notifications').insert(
            managers.map((m) => ({
              user_id: m.user_id,
              title: `Rapport du jour — ${date}`,
              message: `${soldLines.length} boisson(s) · ${formatFCFA(theoretical)} · ${match ? 'Caisse OK' : 'Écart'}`,
              read: false,
              type: 'daily_report',
              link: `/daily-report?date=${date}`,
              action_label: 'Ouvrir le rapport',
            }))
          );
        }
      } catch {
        /* */
      }
    }

    setSent(true);
    setStockDeducted(deducted || stockDeducted);

    // Archive PDF/rapport dans Documents (business_documents)
    try {
      const html = buildReportHtml();
      const estName = activeEstablishment?.name || 'Établissement';
      const lines = soldLines.map((l) => ({
        label: `${l.name} × ${l.qty}`,
        qty: l.qty,
        unit_price: l.price,
      }));
      await supabase.from('business_documents').insert({
        establishment_id: estId,
        doc_type: 'rapport',
        number: `RAPP-${date.replace(/-/g, '')}`,
        client_name: estName,
        title: `Rapport journalier — ${estName} — ${date}`,
        lines,
        subtotal: theoretical,
        tax_rate: 0,
        total: theoretical,
        notes: html.slice(0, 50000),
        status: 'archived',
        theme: 'rapport',
        issued_at: new Date().toISOString(),
        report_date: date,
        created_by: member?.user_id || null,
      });
    } catch (e) {
      console.warn('archive rapport documents', e);
    }

    playTone(match ? 'ok' : 'warn');
    // Rappel oral court
    speakFrench(match ? 'Rapport envoyé. Caisse correcte.' : `Rapport envoyé. Attention, écart de ${Math.round(Math.abs(diff))} francs.`);
    setSaving(false);
    await loadHistory();

    // 4) Aperçu in-app
    openPrintPdf();

    // 5) WhatsApp propriétaire + image/fichier du rapport (pas d'e-mail)
    try {
      await shareReportToWhatsApp();
    } catch {
      const link = buildWhatsAppLink(ownerPhone, reportText());
      if (link) window.open(link, '_blank', 'noopener,noreferrer');
    }
  }

  async function saveOnly() {
    setSaving(true);
    await saveReport(false);
    setSaving(false);
    await loadHistory();
    alert('Brouillon enregistré.');
  }

  function openHistoryRow(h: HistoryRow) {
    setDate(h.date);
    setShowHistory(false);
    try {
      window.history.replaceState({}, '', `/daily-report?date=${h.date}`);
    } catch {
      /* */
    }
  }

  if (!estId) {
    return (
      <EmptyState
        icon={<ClipboardCheck size={40} />}
        title="Aucun établissement"
        message="Sélectionnez un établissement (menu Activité) pour le rapport du jour."
      />
    );
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="animate-spin text-primary-500" size={28} />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          {!embedded && (
            <h1 className="text-2xl font-bold font-display text-stone-100 flex items-center gap-2">
            <ClipboardCheck className="text-amber-400" size={26} /> Rapport du jour
          </h1>
          )}
          <p className="text-stone-400 text-sm mt-0.5">
            Point boissons → caisse → stock → envoi propriétaire
          </p>
          <p className="text-stone-500 text-xs mt-1">{activeEstablishment?.name}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            className="btn-secondary text-xs py-2 flex items-center gap-1"
            onClick={() => setShowHistory((v) => !v)}
          >
            <History size={14} /> Historique
          </button>
          <Calendar size={16} className="text-stone-500" />
          <input
            type="date"
            className="input-field py-2"
            value={date}
            onChange={(e) => {
              const v = e.target.value;
              setDate(v);
              try {
                const url = new URL(window.location.href);
                url.searchParams.set('date', v);
                window.history.replaceState({}, '', url.pathname + url.search);
              } catch { /* */ }
            }}
          />
        </div>
      </div>

      {showHistory && (
        <div className="card space-y-2 max-h-64 overflow-y-auto">
          <p className="text-sm font-medium text-stone-200">Rapports enregistrés</p>
          {history.length === 0 ? (
            <p className="text-xs text-stone-500">Aucun rapport pour le moment.</p>
          ) : (
            history.map((h) => {
              let preview = '';
              try {
                if (h.notes?.startsWith('{')) {
                  const p = JSON.parse(h.notes) as SavedPayload;
                  preview = `${(p.items || []).filter((i) => i.qty > 0).length} boisson(s)${p.stock_deducted ? ' · stock OK' : ''}`;
                }
              } catch {
                /* */
              }
              return (
                <button
                  key={h.id}
                  type="button"
                  onClick={() => openHistoryRow(h)}
                  className="w-full text-left flex items-center gap-2 p-2 rounded-xl hover:bg-stone-800 border border-stone-800"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-stone-100 font-medium">{h.date}</p>
                    <p className="text-xs text-stone-500 truncate">
                      {formatFCFA(Number(h.total_sales) || 0)}
                      {preview ? ` · ${preview}` : ''}
                      {h.signature ? ` · ${h.signature}` : ''}
                    </p>
                  </div>
                  {h.sent_at ? (
                    <Badge color="success">Envoyé</Badge>
                  ) : (
                    <Badge color="warning">Brouillon</Badge>
                  )}
                </button>
              );
            })
          )}
        </div>
      )}

      <div className="flex gap-2 text-xs">
        {[
          { n: 1 as const, label: 'Boissons vendues' },
          { n: 2 as const, label: 'Caisse / Mobile Money' },
          { n: 3 as const, label: 'Envoi' },
        ].map((s) => (
          <button
            key={s.n}
            type="button"
            onClick={() => setStep(s.n)}
            className={`flex-1 rounded-xl px-2 py-2 border ${
              step === s.n
                ? 'border-amber-500/50 bg-amber-500/10 text-amber-200'
                : 'border-stone-800 text-stone-500'
            }`}
          >
            {s.n}. {s.label}
          </button>
        ))}
      </div>

      {sent && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300 space-y-2">
          <p>Rapport envoyé pour le {date}.</p>
          <p className="text-xs text-emerald-400/80">
            {stockDeducted ? 'Stock déduit de l’inventaire. ' : ''}
            Le propriétaire peut rouvrir ce rapport via Historique ou la notification.
          </p>
          <button type="button" className="btn-primary text-sm" onClick={openPrintPdf}>
            Voir la facture / rapport PDF
          </button>
        </div>
      )}

      {step === 1 && (
        <div className="space-y-3">
          {dictationHint && (
            <p className="text-sm text-amber-200 bg-amber-500/10 border border-amber-500/30 rounded-xl px-3 py-2">{dictationHint}</p>
          )}
          <p className="text-sm text-stone-400">
            Indiquez le <strong className="text-stone-200">nombre vendu</strong> ou appuyez sur le micro.
          </p>
          {products.length === 0 ? (
            <div className="space-y-2">
              <EmptyState
                icon={<Beer size={40} />}
                title={loadError ? 'Chargement impossible' : 'Aucune boisson'}
                message={
                  loadError
                    ? `${loadError} Appuyez sur Réessayer. Si le problème continue, déconnectez-vous puis reconnectez-vous.`
                    : "Les produits de cet établissement n'apparaissent pas. Ouvrez l'Inventaire pour vérifier, ou actualisez. Vérifiez l'établissement actif."
                }
              />
              {estId && (
                <p className="text-xs text-stone-500 text-center break-all">Établissement : {activeEstablishment?.name || '—'} · {estId.slice(0, 8)}…</p>
              )}
              <a href="/inventory" className="btn-secondary w-full text-center block">Ouvrir l’inventaire</a>
              <button type="button" className="btn-ghost w-full" onClick={() => void load()}>Réessayer le chargement</button>
            </div>
          ) : (
            <div className="space-y-2 max-h-[55vh] overflow-y-auto pr-1">
              {products.map((p) => (
                <div key={p.id} className="card flex items-center gap-3 py-3">
                  <ProductThumb name={p.name} category={p.category} imageUrl={(p as { image_url?: string }).image_url} size={44} />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-stone-100 truncate">{p.name}</p>
                    <p className="text-xs text-stone-500">
                      {formatFCFA(Number(p.price) || 0)}
                      {p.unit ? ` · ${p.unit}` : ''} · stock {Math.floor(Number(p.stock) || 0)}
                    </p>
                  </div>
                  <input
                    type="number"
                    min={0}
                    inputMode="numeric"
                    className="input-field w-24 min-h-[48px] text-center font-mono text-lg"
                    placeholder="0"
                    value={qtyMap[p.id] ?? ''}
                    onChange={(e) => setQtyMap((m) => ({ ...m, [p.id]: e.target.value }))}
                  />
                  <button
                    type="button"
                    title="Dicter la quantité"
                    onClick={() => dictateQty(p.id, p.name)}
                    className={`p-3 rounded-xl min-h-[48px] min-w-[48px] flex items-center justify-center ${
                      dictatingId === p.id ? 'bg-red-500/30 text-red-300 animate-pulse' : 'bg-stone-800 text-amber-300'
                    }`}
                  >
                    <Mic size={20} />
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="card flex items-center justify-between">
            <span className="text-stone-400 text-sm">Total théorique</span>
            <span className="text-xl font-bold text-amber-300">{formatFCFA(theoretical)}</span>
          </div>
          <button
            type="button"
            className="btn-primary w-full"
            onClick={() => {
              if (soldLines.length === 0) {
                alert('Saisissez au moins une quantité vendue.');
                return;
              }
              setStep(2);
            }}
          >
            Continuer → Caisse
          </button>
        </div>
      )}

      

      {step === 2 && (
        <div className="space-y-4">
          <div className="card space-y-2">
            <p className="text-sm text-stone-400">Récap ventes</p>
            {soldLines.map((l) => (
              <div key={l.product_id} className="flex justify-between text-sm">
                <span className="text-stone-300">
                  {l.name} × {l.qty}
                </span>
                <span className="font-mono text-stone-200">{formatFCFA(l.qty * l.price)}</span>
              </div>
            ))}
            <div className="border-t border-stone-800 pt-2 flex justify-between">
              <span className="text-stone-400">À encaisser</span>
              <span className="font-bold text-amber-300">{formatFCFA(theoretical)}</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="card space-y-1">
              <label className="text-xs text-stone-500 flex items-center gap-1">
                <DollarSign size={12} /> Argent liquide compté
              </label>
              <input
                type="number"
                min={0}
                className="input-field font-bold text-lg"
                value={cashCounted}
                onChange={(e) => setCashCounted(e.target.value)}
                placeholder="0"
              />
            </div>
            <div className="card space-y-1">
              <label className="text-xs text-stone-500 flex items-center gap-1">
                <Smartphone size={12} /> Mobile Money reçu
              </label>
              <input
                type="number"
                min={0}
                className="input-field font-bold text-lg"
                value={mobileCounted}
                onChange={(e) => setMobileCounted(e.target.value)}
                placeholder="0"
              />
            </div>
          </div>

          <div
            className={`card border ${
              match ? 'border-emerald-500/40 bg-emerald-500/10' : 'border-amber-500/40 bg-amber-500/10'
            }`}
          >
            <div className="flex items-start gap-2">
              {match ? (
                <CheckCircle2 className="text-emerald-400 shrink-0" size={22} />
              ) : (
                <AlertTriangle className="text-amber-400 shrink-0" size={22} />
              )}
              <div>
                <p className="font-medium text-stone-100">
                  {match ? 'Les montants coïncident' : 'Écart détecté'}
                </p>
                <p className="text-sm text-stone-400 mt-1">
                  Théorique {formatFCFA(theoretical)} · Reçu {formatFCFA(received)}
                  {!match && (
                    <>
                      {' '}
                      · Différence <strong className="text-amber-200">{formatFCFA(diff)}</strong>
                    </>
                  )}
                </p>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={listenReport}
            className="w-full min-h-[56px] rounded-2xl border-2 border-amber-500/50 bg-amber-500/15 text-amber-100 font-semibold text-lg flex items-center justify-center gap-3 active:scale-[0.98]"
          >
            <Volume2 size={28} /> Écouter le point
          </button>

          <div className="flex gap-2">
            <button type="button" className="btn-secondary min-h-[48px]" onClick={() => setStep(1)}>
              ← Boissons
            </button>
            <button type="button" className="btn-primary flex-1 min-h-[48px] text-base" onClick={() => { playTone(match ? 'ok' : 'warn'); setStep(3); }}>
              Continuer → Envoi
            </button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4">
          <div className="card space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-stone-400">Total théorique</span>
              <span className="font-mono text-amber-300">{formatFCFA(theoretical)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-stone-400">Liquide + Mobile Money</span>
              <span className="font-mono text-stone-200">{formatFCFA(received)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-stone-400">Contrôle caisse</span>
              <span className={match ? 'text-emerald-400' : 'text-amber-400'}>
                {match ? 'OK' : `Écart ${formatFCFA(diff)}`}
              </span>
            </div>
            <div className="flex justify-between text-sm items-center">
              <span className="text-stone-400 flex items-center gap-1">
                <PackageMinus size={14} /> Stock inventaire
              </span>
              <span className="text-stone-300 text-xs">
                {stockDeducted ? 'Déjà déduit' : 'Sera déduit à l’envoi'}
              </span>
            </div>
          </div>

          <div>
            <label className="label">Commentaire</label>
            <textarea
              className="input-field min-h-[100px]"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Observations, écarts, incidents du jour…"
            />
          </div>
          <div>
            <label className="label">Signature / responsable</label>
            <input
              className="input-field"
              value={signature}
              onChange={(e) => setSignature(e.target.value)}
              placeholder="Nom du gérant"
            />
          </div>


          <button
            type="button"
            onClick={listenReport}
            className="w-full min-h-[56px] rounded-2xl border-2 border-amber-500/50 bg-amber-500/15 text-amber-100 font-semibold text-lg flex items-center justify-center gap-3 active:scale-[0.98]"
          >
            <Volume2 size={28} /> Écouter le point
          </button>

          <div className="flex flex-col gap-2">
            <button
              type="button"
              className="btn-secondary flex items-center justify-center gap-2"
              disabled={saving}
              onClick={() => void saveOnly()}
            >
              <Save size={16} /> Enregistrer brouillon
            </button>
            <button
              type="button"
              className="btn-primary flex items-center justify-center gap-2"
              disabled={saving}
              onClick={() => void sendReport()}
            >
              {saving ? <Loader2 className="animate-spin" size={18} /> : <Send size={18} />}
              Envoyer le rapport
            </button>
            <button
              type="button"
              className="btn-secondary flex items-center justify-center gap-2"
              onClick={openPrintPdf}
            >
              <FileText size={16} /> PDF / Imprimer
            </button>
            <button
              type="button"
              className="btn-secondary flex items-center justify-center gap-2"
              onClick={downloadReportFile}
            >
              <FileText size={16} /> Télécharger fichier rapport
            </button>
            {ownerPhone && (
              <a
                href={buildWhatsAppLink(ownerPhone, reportText())}
                target="_blank"
                rel="noreferrer"
                className="btn-secondary flex items-center justify-center gap-2 text-emerald-300 border-emerald-700/40"
              >
                <MessageCircle size={16} /> WhatsApp propriétaire
              </a>
            )}
            <button
              type="button"
              disabled={recordingVoice}
              onClick={() => void whatsappVoice()}
              className="btn-secondary flex items-center justify-center gap-2 text-emerald-200 border-emerald-700/40 min-h-[48px]"
            >
              <Mic size={16} /> {recordingVoice ? `Vocal… ${recordLeft}s` : 'Vocal WhatsApp (12s)'}
            </button>
            <button type="button" className="btn-ghost text-stone-500" onClick={() => setStep(3)}>
              ← Retour caisse
            </button>
          </div>

          <p className="text-xs text-stone-500">
            Envoi = sauvegarde + déduction stock + ouverture WhatsApp propriétaire avec image du rapport.
            Sur Android, choisissez WhatsApp dans le menu de partage pour joindre l’image. Sinon l’image est téléchargée et WhatsApp s’ouvre avec le texte.
            téléchargé pour que vous le joigniez, et le message texte est prérempli.
          </p>
        </div>
      )}

      <button
        type="button"
        className="text-xs text-stone-500 flex items-center gap-1 hover:text-stone-300"
        onClick={() => void load()}
      >
        <RefreshCw size={12} /> Recharger
      </button>


      {pdfPreviewHtml && (
        <div className="fixed inset-0 z-[100] bg-stone-950 flex flex-col">
          <div className="flex items-center gap-2 px-3 py-2 border-b border-stone-800 bg-stone-900 shrink-0">
            <p className="text-sm font-medium text-stone-100 flex-1">Rapport du jour — facture</p>
            <button type="button" className="btn-secondary text-xs px-2 py-1" onClick={printPreviewNow}>
              Imprimer / PDF
            </button>
            <button
              type="button"
              className="btn-primary text-xs px-2 py-1"
              onClick={() => setPdfPreviewHtml(null)}
            >
              Fermer
            </button>
          </div>
          <iframe
            id="report-pdf-frame"
            title="Rapport PDF"
            className="flex-1 w-full bg-white"
            srcDoc={pdfPreviewHtml}
          />
        </div>
      )}

    </div>
  );
}
