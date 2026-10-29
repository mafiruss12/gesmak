import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Camera, Upload, Loader2, Check, AlertTriangle, Merge, Plus, SkipForward, ArrowLeft, Sparkles,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import type { Product } from '@/lib/types';
import {
  runOcrFrench,
  parseInventoryText,
  type ScannedLine,
} from '@/lib/inventoryScan';
import {
  hasVisionApi,
  recognizeInventoryVision,
  setLocalGeminiKey,
  type VisionScanMode,
} from '@/lib/visionScan';
import { EmptyState } from '@/components/ui';
import { COMMON_PACKAGE_SIZES, defaultUnitsPerPackage, unitsFromPackages } from '@/lib/packageUnits';

export default function ScanInventaire() {
  const { member, activeEstablishment } = useAuth();
  const estId = activeEstablishment?.id || member?.establishment_id;
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [preview, setPreview] = useState<string | null>(null);
  const [ocrText, setOcrText] = useState('');
  const [lines, setLines] = useState<ScannedLine[]>([]);
  const [step, setStep] = useState<'pick' | 'ocr' | 'review' | 'done'>('pick');
  const [busy, setBusy] = useState(false);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [ocrStatus, setOcrStatus] = useState('');
  const [scanMode, setScanMode] = useState<VisionScanMode>('auto');
  const [engineUsed, setEngineUsed] = useState('');
  const [geminiKeyDraft, setGeminiKeyDraft] = useState('');
  const [visionReady, setVisionReady] = useState(() => hasVisionApi());
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState({ updated: 0, created: 0, skipped: 0 });

  useEffect(() => {
    if (!estId) return;
    supabase
      .from('products')
      .select('*')
      .eq('establishment_id', estId)
      .then(({ data }) => setProducts((data ?? []) as Product[]));
  }, [estId]);

  async function onFile(file: File | null) {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Choisissez une image (photo JPG/PNG).');
      return;
    }
    setError(null);
    setPreview(URL.createObjectURL(file));
    setStep('ocr');
    setBusy(true);
    setOcrProgress(0);
    setOcrStatus('Analyse…');
    setEngineUsed('');
    try {
      let lines: ScannedLine[] = [];
      let text = '';

      if (hasVisionApi()) {
        try {
          setOcrStatus(
            scanMode === 'receipt'
              ? 'Gemini lit le reçu d’achat…'
              : scanMode === 'casier'
                ? 'Gemini compte les casiers / bouteilles…'
                : 'Reconnaissance IA Gemini…',
          );
          const vis = await recognizeInventoryVision(file, products, scanMode, (pct, status) => {
            setOcrProgress(pct);
            setOcrStatus(status);
          });
          lines = vis.lines;
          text = vis.rawText;
          setEngineUsed('Gemini Vision');
        } catch (ve: any) {
          console.warn('Vision failed, OCR fallback', ve);
          setOcrStatus('IA indisponible — OCR local…');
          text = await runOcrFrench(file, (pct, status) => {
            setOcrProgress(pct);
            setOcrStatus(status);
          });
          lines = parseInventoryText(text, products);
          setEngineUsed('OCR Tesseract (secours)');
        }
      } else {
        setOcrStatus('OCR local (ajoutez une clé Gemini pour la reconnaissance d’objets)…');
        text = await runOcrFrench(file, (pct, status) => {
          setOcrProgress(pct);
          setOcrStatus(status);
        });
        lines = parseInventoryText(text, products);
        setEngineUsed('OCR Tesseract');
      }

      setOcrText(text);
      if (lines.length === 0) {
        setError(
          text
            ? `Rien d’exploitable. Aperçu : « ${text.slice(0, 140)} ». Photo plus nette ou mode « Objet unique ».`
            : 'Aucun produit détecté. Photo nette, éclairée ; ou configurez Gemini pour la reconnaissance d’objets.',
        );
        setStep('pick');
      } else {
        setLines(
          lines.map((l) => {
            const upp = l.units_per_package || defaultUnitsPerPackage({ name: l.name });
            if (scanMode === 'receipt') {
              const pc = l.package_count && l.package_count > 0 ? l.package_count : 1;
              return {
                ...l,
                package_count: pc,
                units_per_package: upp,
                stock: unitsFromPackages(pc, upp),
                stock_mode: 'add' as const,
              };
            }
            return { ...l, units_per_package: upp, stock_mode: 'set' as const };
          }),
        );
        setStep('review'); // engine shown below
      }
    } catch (e: any) {
      const msg = e?.message || String(e);
      setError(
        msg.includes('fetch') || msg.includes('network') || msg.includes('Failed')
          ? 'Connexion requise pour l’IA / OCR. Vérifiez le réseau.'
          : msg,
      );
      setStep('pick');
    } finally {
      setBusy(false);
      setOcrProgress(0);
      setOcrStatus('');
    }
  }

  function setAction(id: string, action: ScannedLine['action']) {
    setLines((prev) => prev.map((l) => (l.id === id ? { ...l, action } : l)));
  }

  function updateLine(id: string, patch: Partial<ScannedLine>) {
    setLines((prev) =>
      prev.map((l) => {
        if (l.id !== id) return l;
        const next = { ...l, ...patch };
        return next;
      })
    );
  }

  async function integrate() {
    if (!estId) return;
    setBusy(true);
    setError(null);
    let updated = 0;
    let created = 0;
    let skipped = 0;
    try {
      for (const line of lines) {
        if (line.action === 'skip' || !line.name.trim()) {
          skipped++;
          continue;
        }
        const packs = Number(line.package_count) || 0;
        const upp = Number(line.units_per_package) || 0;
        const fromPacks = packs > 0 && upp > 0 ? unitsFromPackages(packs, upp) : 0;
        // Reçu d'achat : on AJOUTE au stock ; inventaire/casier : on POSE le stock compté
        const isArrival =
          scanMode === 'receipt' || line.stock_mode === 'add' || fromPacks > 0;

        if (line.action === 'update' && line.matchId) {
          const existing = products.find((x) => x.id === line.matchId);
          const prevStock = Number(existing?.stock) || 0;
          const addQty = fromPacks > 0 ? fromPacks : Number(line.stock) || 0;
          const nextStock = isArrival ? prevStock + addQty : Number(line.stock) || 0;
          const patch: Record<string, unknown> = {
            stock: nextStock,
            unit: line.unit,
            category: line.category,
          };
          if (upp > 0) patch.units_per_package = upp;
          if (line.cost > 0) patch.cost = line.cost;
          if (line.price > 0) patch.price = line.price;
          const { error: err } = await supabase
            .from('products')
            .update(patch)
            .eq('id', line.matchId);
          if (err) throw err;
          if (isArrival && estId && addQty > 0) {
            try {
              await supabase.from('stock_movements').insert({
                establishment_id: estId,
                product_id: line.matchId,
                product_name: line.name,
                qty: addQty,
                movement_type: 'arrival',
                unit_cost: Number(line.cost) || 0,
                unit_price: Number(line.price) || 0,
                reason: 'scan_receipt',
                note: packs > 0 ? `Scan ${packs}×${upp}` : 'Scan reçu',
                created_by: member?.user_id || null,
              });
            } catch { /* optional */ }
          }
          updated++;
        } else {
          const createStock = fromPacks > 0 ? fromPacks : Number(line.stock) || 0;
          const { error: err } = await supabase.from('products').insert({
            establishment_id: estId,
            name: line.name.trim(),
            category: line.category || 'Autre',
            unit: line.unit || 'unité',
            stock: createStock,
            min_stock: line.min_stock || 12,
            cost: line.cost || 0,
            price: line.price || 0,
            units_per_package: upp > 0 ? upp : defaultUnitsPerPackage({ name: line.name }),
          });
          if (err) throw err;
          created++;
        }
      }
      setStats({ updated, created, skipped });
      setStep('done');
      // notif propriétaire
      if (member.user_id) {
        await supabase.from('notifications').insert({
          user_id: member.user_id,
          title: 'Inventaire mis à jour par photo',
          message: `${updated} mis à jour, ${created} créés (OCR).`,
          read: false,
          link: '/inventory',
          type: 'inventory',
          action_label: 'Voir inventaire',
        });
      }
    } catch (e: any) {
      setError(e?.message || 'Erreur intégration');
    } finally {
      setBusy(false);
    }
  }

  if (!estId) {
    return (
      <EmptyState
        icon={<Camera size={48} />}
        title="Établissement requis"
        message="Rattachez un établissement pour scanner l'inventaire."
      />
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div className="flex items-center gap-3">
        <button type="button" className="btn-ghost p-2" onClick={() => navigate('/inventory')}>
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="text-2xl font-bold font-display text-stone-100 flex items-center gap-2">
            <Sparkles className="text-amber-400" size={22} /> Scanner inventaire (IA)
          </h1>
          <p className="text-sm text-stone-400">
            Gemini analyse photo / galerie : inventaire, reçu d'achat ou casiers pour le point
          </p>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      )}

      {step === 'pick' && (
        <div className="card space-y-4">
          <p className="text-sm text-stone-300">
            Photo d&apos;un <strong>produit</strong> (bouteille, sac, matériel) ou d&apos;un <strong>carnet / tableau</strong>.
            Gemini analyse la photo (reçu, casiers, liste). OCR local en secours si l'IA échoue.
          </p>
          <div className="flex flex-wrap gap-2">
            {([
              ['auto', 'Auto inventaire'],
              ['object', 'Objet unique'],
              ['list', 'Liste / carnet'],
              ['receipt', "Reçu d'achat"],
              ['casier', 'Casiers / point'],
            ] as [VisionScanMode, string][]).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setScanMode(id)}
                className={`text-xs px-3 py-1.5 rounded-full ${scanMode === id ? 'bg-amber-500/20 text-amber-300' : 'bg-stone-800 text-stone-400'}`}
              >
                {label}
              </button>
            ))}
          </div>
          <p className="text-xs text-stone-500">
            Moteur : {visionReady ? '✓ Gemini Vision + OCR secours' : 'OCR seul — ajoutez une clé Gemini ci-dessous'}
          </p>
          {!visionReady && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 space-y-2">
              <p className="text-xs text-amber-200/90">
                Clé Gemini (Google AI Studio) pour reconnaitre les produits sur photo. Stockée localement sur cet appareil.
              </p>
              <input
                className="input-field text-sm"
                type="password"
                placeholder="AIza…"
                value={geminiKeyDraft}
                onChange={(e) => setGeminiKeyDraft(e.target.value)}
              />
              <button
                type="button"
                className="btn-secondary text-xs"
                onClick={() => {
                  if (!geminiKeyDraft.trim()) return;
                  setLocalGeminiKey(geminiKeyDraft.trim());
                  setVisionReady(true);
                  setGeminiKeyDraft('');
                }}
              >
                Activer la reconnaissance d&apos;objets
              </button>
            </div>
          )}
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              className="btn-primary flex items-center gap-2"
              onClick={() => inputRef.current?.click()}
            >
              <Camera size={18} /> Prendre / choisir une photo
            </button>
            <button
              type="button"
              className="btn-secondary flex items-center gap-2"
              onClick={() => inputRef.current?.click()}
            >
              <Upload size={18} /> Galerie
            </button>
          </div>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => onFile(e.target.files?.[0] ?? null)}
          />
          <ul className="text-xs text-stone-500 space-y-1 list-disc pl-4">
            <li>Doublons détectés automatiquement (ex. Flag = FLAG 65cl)</li>
            <li>Vous validez avant toute écriture en base</li>
            <li>Manuscrit : écrire le plus clairement possible</li>
          </ul>
        </div>
      )}

      {step === 'ocr' && (
        <div className="card flex flex-col items-center py-12 gap-3">
          <Loader2 className="animate-spin text-amber-400" size={36} />
          <p className="text-stone-300">OCR français en cours…</p>
          {preview && (
            <img src={preview} alt="scan" className="max-h-40 rounded-xl border border-stone-700 mt-2" />
          )}
        </div>
      )}

      {step === 'review' && (
        <>
        {engineUsed && (
          <p className="text-xs text-amber-400/90">Détecté via : {engineUsed}</p>
        )}

        <div className="space-y-4">
          <div className="card">
            <p className="text-sm text-stone-300 mb-2">
              {lines.length} ligne(s) détectée(s). Corrigez si besoin, puis intégrez.
            </p>
            <details className="text-xs text-stone-500">
              <summary className="cursor-pointer text-stone-400">Texte OCR brut</summary>
              <pre className="mt-2 whitespace-pre-wrap max-h-32 overflow-y-auto bg-stone-950 p-2 rounded-lg">
                {ocrText || '—'}
              </pre>
            </details>
          </div>

          <div className="space-y-2">
            {lines.map((l) => (
              <div key={l.id} className="card p-3 space-y-2">
                <div className="flex flex-wrap items-center gap-2 justify-between">
                  <input
                    className="input-field flex-1 min-w-[140px] text-sm"
                    value={l.name}
                    onChange={(e) => updateLine(l.id, { name: e.target.value })}
                  />
                  <span className="text-[10px] text-stone-500">
                    conf. {Math.round(l.confidence * 100)}%
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div>
                    <label className="text-[10px] text-stone-500">Casiers/packs</label>
                    <input
                      type="number"
                      min={0}
                      className="input-field text-sm py-1"
                      value={l.package_count ?? (scanMode === 'receipt' ? 1 : 0)}
                      onChange={(e) => {
                        const package_count = Number(e.target.value) || 0;
                        const units_per_package = l.units_per_package || defaultUnitsPerPackage({ name: l.name });
                        updateLine(l.id, {
                          package_count,
                          units_per_package,
                          stock: unitsFromPackages(package_count, units_per_package),
                          stock_mode: scanMode === 'receipt' ? 'add' : 'set',
                        });
                      }}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-stone-500">Par casier/pack</label>
                    <select
                      className="input-field text-sm py-1"
                      value={l.units_per_package || defaultUnitsPerPackage({ name: l.name })}
                      onChange={(e) => {
                        const units_per_package = Number(e.target.value) || 12;
                        const package_count = l.package_count ?? (scanMode === 'receipt' ? 1 : 0);
                        updateLine(l.id, {
                          units_per_package,
                          package_count,
                          stock: unitsFromPackages(package_count, units_per_package),
                          stock_mode: scanMode === 'receipt' ? 'add' : 'set',
                        });
                      }}
                    >
                      {COMMON_PACKAGE_SIZES.map((n) => (
                        <option key={n} value={n}>{n}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] text-stone-500">
                      {scanMode === 'receipt' ? 'Total (+)' : 'Stock'}
                    </label>
                    <input
                      type="number"
                      className="input-field text-sm py-1"
                      value={l.stock}
                      onChange={(e) => updateLine(l.id, { stock: Number(e.target.value) || 0, stock_mode: scanMode === 'receipt' ? 'add' : 'set' })}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-stone-500">Coût</label>
                    <input
                      type="number"
                      className="input-field text-sm py-1"
                      value={l.cost}
                      onChange={(e) => updateLine(l.id, { cost: Number(e.target.value) || 0 })}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-stone-500">Prix</label>
                    <input
                      type="number"
                      className="input-field text-sm py-1"
                      value={l.price}
                      onChange={(e) => updateLine(l.id, { price: Number(e.target.value) || 0 })}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-stone-500">Unité</label>
                    <input
                      className="input-field text-sm py-1"
                      value={l.unit}
                      onChange={(e) => updateLine(l.id, { unit: e.target.value })}
                    />
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 items-center text-xs">
                  {l.matchId ? (
                    <span className="text-amber-300 flex items-center gap-1">
                      <Merge size={12} /> Doublon → {l.matchName}
                    </span>
                  ) : (
                    <span className="text-emerald-400 flex items-center gap-1">
                      <Plus size={12} /> Nouveau produit
                    </span>
                  )}
                  <div className="flex gap-1 ml-auto">
                    {l.matchId && (
                      <button
                        type="button"
                        className={`px-2 py-1 rounded-lg border text-[11px] ${
                          l.action === 'update' ? 'border-amber-500/50 bg-amber-500/15 text-amber-200' : 'border-stone-700 text-stone-400'
                        }`}
                        onClick={() => setAction(l.id, 'update')}
                      >
                        Mettre à jour
                      </button>
                    )}
                    <button
                      type="button"
                      className={`px-2 py-1 rounded-lg border text-[11px] ${
                        l.action === 'create' ? 'border-emerald-500/50 bg-emerald-500/15 text-emerald-200' : 'border-stone-700 text-stone-400'
                      }`}
                      onClick={() => setAction(l.id, 'create')}
                    >
                      Créer
                    </button>
                    <button
                      type="button"
                      className={`px-2 py-1 rounded-lg border text-[11px] flex items-center gap-1 ${
                        l.action === 'skip' ? 'border-stone-500 bg-stone-800 text-stone-300' : 'border-stone-700 text-stone-400'
                      }`}
                      onClick={() => setAction(l.id, 'skip')}
                    >
                      <SkipForward size={12} /> Ignorer
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-2 sticky bottom-4">
            <button type="button" className="btn-ghost" onClick={() => setStep('pick')} disabled={busy}>
              Reprendre photo
            </button>
            <button
              type="button"
              className="btn-primary flex items-center gap-2"
              onClick={integrate}
              disabled={busy || lines.every((l) => l.action === 'skip')}
            >
              {busy ? <Loader2 className="animate-spin" size={18} /> : <Check size={18} />}
              Intégrer à mon établissement
            </button>
          </div>
        </div>
        </>
      )}

      {step === 'done' && (
        <div className="card text-center space-y-3 py-10">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-emerald-500/20 flex items-center justify-center">
            <Check className="text-emerald-400" size={28} />
          </div>
          <h2 className="text-xl font-bold text-stone-100">Inventaire mis à jour</h2>
          <p className="text-sm text-stone-400">
            {stats.updated} mis à jour · {stats.created} créés · {stats.skipped} ignorés
          </p>
          <p className="text-xs text-stone-500">Dashboard et alertes stock recalculés à l&apos;ouverture de l&apos;inventaire.</p>
          <button type="button" className="btn-primary" onClick={() => navigate('/inventory')}>
            Voir l&apos;inventaire
          </button>
        </div>
      )}

      {busy && step === 'review' && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-stone-900 rounded-2xl px-6 py-4 flex items-center gap-3 border border-stone-700">
            <Loader2 className="animate-spin text-amber-400" />
            <span className="text-stone-200 text-sm">Intégration en cours…</span>
          </div>
        </div>
      )}
    </div>
  );
}
