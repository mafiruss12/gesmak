import { useEffect, useRef, useState } from 'react';
import {
  Sparkles, TrendingUp, AlertTriangle, Lightbulb, Brain, Target, Zap,
  Send, Loader2, Bot, User, ImagePlus, FileDown, Video,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import type { Product, Sale } from '@/lib/types';
import { formatFCFA, daysAgoISO } from '@/lib/format';
import { EmptyState } from '@/components/ui';
import { loadKnowledge, matchTrainedAnswer, getPersona, type AiKnowledge } from '@/lib/aiTrainer';
import { SUPPORT_EMAIL, supportMailto } from '@/lib/supportContact';
import { AI_MODELS, modelById, type AiModelOption } from '@/lib/aiProviders';

interface AIInsight {
  type: 'prediction' | 'alert' | 'recommendation' | 'opportunity';
  title: string;
  message: string;
  icon: typeof TrendingUp;
  color: string;
}

interface ChatTurn {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  escalate?: boolean;
  imageUrl?: string;
  videoUrl?: string;
}

function buildReply(
  question: string,
  ctx: {
    sales: Sale[];
    products: Product[];
    expensesTotal: number;
    salesTotal: number;
    lowStock: Product[];
    topProduct?: { name: string; revenue: number };
  },
  knowledge: AiKnowledge[] = [],
): string {
  const trained = matchTrainedAnswer(question, knowledge);
  if (trained) return trained.answer;

  const q = question.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  if (/caisse|vente|pos|encaiss/.test(q)) {
    return "Pour encaisser : menu **Caisse (POS)** → choisissez les produits → validez le paiement (espèces / mobile money). Le stock est déduit automatiquement.";
  }
  if (/inventaire|stock|produit|boisson|ajouter/.test(q)) {
    return "Pour gérer le stock : **Inventaire** → « Ajouter » pour une nouvelle boisson/plat, ou modifiez le stock d'un produit existant. Surveillez le seuil minimum pour éviter les ruptures.";
  }
  if (/depense|dépense|frais/.test(q)) {
    return "Enregistrez une dépense dans **Dépenses** (catégorie, montant, mode de paiement). Elles apparaissent dans la Comptabilité et la Clôture du jour.";
  }
  if (/cloture|clôture|rapport.?jour|fermer.?caisse/.test(q)) {
    return "Allez dans **Clôture du jour** / **Rapport du jour** pour valider les ventes, dépenses et caisse de la journée.";
  }
  if (/employe|employé|personnel|planning|pointage/.test(q)) {
    return "Section **Mes employés** pour créer les accès (gérant, caissier). Le propriétaire contrôle les droits stock.";
  }
  if (/support|aide|kevin|humain|contacter/.test(q)) {
    return `__ESCALATE__Je peux vous orienter vers le support humain Kevin Tech Pro.`;
  }

  return `Voici un résumé de votre établissement (30 j) :
• Ventes : ${formatFCFA(ctx.salesTotal)}
• Dépenses : ${formatFCFA(ctx.expensesTotal)}
• Produits en alerte stock : ${ctx.lowStock.length}
• ${ctx.topProduct ? `Top produit : ${ctx.topProduct.name}` : 'Pas encore de top produit'}

Si ce n’est pas la bonne réponse, reformulez — ou choisissez un modèle IA (Gemini / Groq) ci-dessus.`;
}

function downloadTextFile(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function buildSystemPrompt(persona: string, ctx: NonNullable<Parameters<typeof buildReply>[1]>) {
  return `${persona}

Tu aides un gérant/propriétaire de maquis ou commerce en Côte d'Ivoire (FCFA).
Contexte 30 jours :
- Ventes : ${ctx.salesTotal} FCFA
- Dépenses : ${ctx.expensesTotal} FCFA
- Alertes stock : ${ctx.lowStock.map((p) => p.name).slice(0, 8).join(', ') || 'aucune'}
- Top produit : ${ctx.topProduct?.name || 'n/a'}

Réponds en français simple, concret, actions menu (Caisse, Inventaire, Rapport du jour).
Ne invente pas de chiffres hors contexte. Si tu génères un tableau, utilise du texte clair.`;
}

export default function AIAssistant() {
  const { member } = useAuth();
  const [insights, setInsights] = useState<AIInsight[]>([]);
  const [loading, setLoading] = useState(true);
  const [predictedSales, setPredictedSales] = useState(0);
  const [topDay, setTopDay] = useState('');
  const [ctx, setCtx] = useState<{
    sales: Sale[];
    products: Product[];
    expensesTotal: number;
    salesTotal: number;
    lowStock: Product[];
    topProduct?: { name: string; revenue: number };
  } | null>(null);

  const [turns, setTurns] = useState<ChatTurn[]>([
    {
      id: 'welcome',
      role: 'assistant',
      text: 'Tu es Stock AI Assistant. Français simple, aide concrète pour maquis et gestion de stock.\n\nPosez votre question, ou utilisez **Image** / **Vidéo** ci-dessous.',
    },
  ]);
  const [input, setInput] = useState('');
  const [thinking, setThinking] = useState(false);
  const [knowledge, setKnowledge] = useState<AiKnowledge[]>([]);
  const [modelId, setModelId] = useState('gemini-2.0-flash');
  const [mode, setMode] = useState<'chat' | 'image' | 'video' | 'file'>('chat');
  const [lastError, setLastError] = useState('');

  const endRef = useRef<HTMLDivElement>(null);
  const selected: AiModelOption | undefined = modelById(modelId);

  useEffect(() => {
    (async () => {
      if (!member?.establishment_id) {
        setLoading(false);
        return;
      }
      const estId = member.establishment_id;
      try {
        const kn = await loadKnowledge(estId);
        setKnowledge(kn);
        const persona = getPersona(kn);
        setTurns((prev) => {
          if (prev.length === 1 && prev[0].id === 'welcome') {
            return [{
              id: 'welcome',
              role: 'assistant',
              text: persona.slice(0, 280) + (persona.length > 280 ? '…' : '') +
                '\n\nChoisissez Chat, Image ou Vidéo. Modèles : Gemini, Groq, OpenRouter, Pollinations.',
            }];
          }
          return prev;
        });
      } catch { /* */ }
      const start = daysAgoISO(30);

      const [salesRes, productsRes, expensesRes] = await Promise.all([
        supabase
          .from('sales')
          .select('total, qty, product_id, created_at')
          .eq('establishment_id', estId)
          .gte('created_at', start),
        supabase.from('products').select('*').eq('establishment_id', estId),
        supabase
          .from('expenses')
          .select('amount')
          .eq('establishment_id', estId)
          .gte('created_at', start),
      ]);

      const sales = (salesRes.data || []) as Sale[];
      const products = (productsRes.data || []) as Product[];
      const expensesTotal = (expensesRes.data || []).reduce(
        (s: number, e: { amount?: number }) => s + Number(e.amount || 0),
        0,
      );
      const salesTotal = sales.reduce((s, x) => s + Number(x.total || 0), 0);
      const lowStock = products.filter(
        (p) => Number(p.stock ?? 0) <= Number(p.min_stock ?? 5),
      );

      const byProduct: Record<string, number> = {};
      for (const s of sales) {
        const id = String(s.product_id || '');
        byProduct[id] = (byProduct[id] || 0) + Number(s.total || 0);
      }
      let topProduct: { name: string; revenue: number } | undefined;
      let best = 0;
      for (const p of products) {
        const rev = byProduct[String(p.id)] || 0;
        if (rev > best) {
          best = rev;
          topProduct = { name: p.name, revenue: rev };
        }
      }

      const dayMap: Record<string, number> = {};
      for (const s of sales) {
        const d = new Date(s.created_at).toLocaleDateString('fr-FR', { weekday: 'long' });
        dayMap[d] = (dayMap[d] || 0) + Number(s.total || 0);
      }
      const topD = Object.entries(dayMap).sort((a, b) => b[1] - a[1])[0];
      if (topD) setTopDay(topD[0]);
      setPredictedSales(Math.round(salesTotal / 30));

      const newInsights: AIInsight[] = [];
      if (lowStock.length) {
        newInsights.push({
          type: 'alert',
          title: 'Stock bas',
          message: `${lowStock.length} produit(s) sous le seuil (ex. ${lowStock[0].name}).`,
          icon: AlertTriangle,
          color: 'warning',
        });
      }
      if (topProduct) {
        newInsights.push({
          type: 'opportunity',
          title: 'Produit star',
          message: `"${topProduct.name}" : ${formatFCFA(topProduct.revenue)}. Priorisez son stock.`,
          icon: Brain,
          color: 'primary',
        });
      }
      if (sales.length === 0) {
        newInsights.push({
          type: 'recommendation',
          title: 'Premiers pas',
          message: 'Ajoutez des produits dans Inventaire, puis encaisser via la Caisse.',
          icon: Lightbulb,
          color: 'warning',
        });
      }

      setCtx({ sales, products, expensesTotal, salesTotal, lowStock, topProduct });
      setInsights(newInsights);
      setLoading(false);
    })();
  }, [member]);

  async function callRemoteAi(prompt: string, forceMode?: 'chat' | 'image' | 'video' | 'file') {
    const m = forceMode || mode;
    const mod = modelById(modelId);
    const provider = mod?.provider || 'gemini';
    const res = await fetch('/api/ai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt,
        model: modelId,
        provider: m === 'image' ? 'pollinations' : provider,
        mode: m === 'file' ? 'chat' : m,
        system: ctx ? buildSystemPrompt(getPersona(knowledge), ctx) : getPersona(knowledge),
        temperature: 0.35,
        maxOutputTokens: 2048,
      }),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(j.error || `Erreur IA (${res.status})`);
    }
    return j as { text?: string; image_url?: string; video_url?: string; provider?: string; model?: string };
  }

  async function ask() {
    if (!input.trim() || !ctx) return;
    const q = input.trim();
    setInput('');
    setLastError('');
    setTurns((t) => [...t, { id: `u-${Date.now()}`, role: 'user', text: q }]);
    setThinking(true);

    try {
      // Mode image
      if (mode === 'image' || modelId === 'pollinations-image') {
        const j = await callRemoteAi(q, 'image');
        setTurns((t) => [
          ...t,
          {
            id: `a-${Date.now()}`,
            role: 'assistant',
            text: j.text || 'Image générée.',
            imageUrl: j.image_url,
          },
        ]);
        setThinking(false);
        setTimeout(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
        return;
      }

      // Mode vidéo
      if (mode === 'video' || modelId === 'pollinations-video') {
        const j = await callRemoteAi(q, 'video');
        setTurns((t) => [
          ...t,
          {
            id: `a-${Date.now()}`,
            role: 'assistant',
            text: j.text || 'Vidéo générée (peut prendre 15–60 s à charger).',
            videoUrl: j.video_url,
          },
        ]);
        setThinking(false);
        setTimeout(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
        return;
      }

      // Mode fichier : demander un contenu structuré puis télécharger
      if (mode === 'file') {
        let content = '';
        if (modelId === 'local-rules') {
          content = [
            'Stock Manager AI — Export',
            `Date: ${new Date().toLocaleString('fr-FR')}`,
            `Ventes 30j: ${ctx.salesTotal}`,
            `Dépenses 30j: ${ctx.expensesTotal}`,
            `Alertes: ${ctx.lowStock.map((p) => p.name).join(', ') || 'aucune'}`,
            '',
            `Demande: ${q}`,
            '',
            buildReply(q, ctx, knowledge),
          ].join('\n');
        } else {
          const j = await callRemoteAi(
            `Génère un fichier texte clair (rapport ou CSV simple) pour: ${q}`,
            'file',
          );
          content = j.text || buildReply(q, ctx, knowledge);
        }
        const fname = `stock-ai-${Date.now()}.txt`;
        downloadTextFile(fname, content);
        setTurns((t) => [
          ...t,
          {
            id: `a-${Date.now()}`,
            role: 'assistant',
            text: `Fichier **${fname}** téléchargé.\n\nAperçu :\n${content.slice(0, 800)}${content.length > 800 ? '…' : ''}`,
          },
        ]);
        setThinking(false);
        return;
      }

      // Chat local
      if (modelId === 'local-rules') {
        await new Promise((r) => setTimeout(r, 250));
        const raw = buildReply(q, ctx, knowledge);
        const escalate = raw.startsWith('__ESCALATE__');
        const reply = escalate ? raw.replace(/^__ESCALATE__/, '') : raw;
        setTurns((t) => [...t, { id: `a-${Date.now()}`, role: 'assistant', text: reply, escalate }]);
        setThinking(false);
        return;
      }

      // Chat distant (Gemini / Groq / OpenRouter)
      const j = await callRemoteAi(q, 'chat');
      const reply = (j.text || '').trim() || buildReply(q, ctx, knowledge);
      setTurns((t) => [
        ...t,
        {
          id: `a-${Date.now()}`,
          role: 'assistant',
          text: reply + (j.provider ? `\n\n_(${j.provider}${j.model ? ` · ${j.model}` : ''})_` : ''),
        },
      ]);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Erreur';
      setLastError(msg);
      // fallback local
      const raw = buildReply(q, ctx, knowledge);
      setTurns((t) => [
        ...t,
        {
          id: `a-${Date.now()}`,
          role: 'assistant',
          text: `⚠️ IA distante indisponible (${msg}). Réponse locale :\n\n${raw.replace(/^__ESCALATE__/, '')}`,
        },
      ]);
    }
    setThinking(false);
    setTimeout(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-stone-400">
        <Sparkles className="animate-pulse text-primary-500" size={24} />
      </div>
    );
  }
  if (!member?.establishment_id) {
    return (
      <EmptyState
        icon={<Sparkles size={48} />}
        title="Aucun établissement"
        message="Vous n'êtes rattaché à aucun établissement."
      />
    );
  }

  const colorMap: Record<string, string> = {
    success: 'bg-success-500/10 text-success-400 border-success-500/20',
    warning: 'bg-warning-500/10 text-warning-400 border-warning-500/20',
    error: 'bg-error-500/10 text-error-400 border-error-500/20',
    primary: 'bg-primary-500/10 text-primary-400 border-primary-500/20',
  };

  const quick = [
    'Comment encaisser ?',
    'Stocks bas ?',
    'Comment faire la clôture ?',
    'Résumé des ventes',
  ];

  return (
    <div>
      <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Sparkles className="text-primary-400" />
          <h1 className="text-xl font-bold font-display text-stone-100">Demander de l&apos;aide</h1>
          <p className="text-xs text-stone-500">Stock AI · chat, images &amp; vidéos</p>
        </div>
        {(member?.role === 'super_admin' || member?.role === 'owner' || member?.role === 'proprietaire') && (
          <a href="/ai-train" className="text-sm text-primary-400 hover:underline">Former l&apos;IA</a>
        )}
      </div>
      <p className="text-stone-400 text-sm mb-4">
        Multi-modèles : Gemini, Groq, OpenRouter + images + export fichier
      </p>

      {/* Sélecteurs */}
      <div className="card mb-4 space-y-3">
        <div className="flex flex-wrap gap-2 items-center">
          <label className="text-xs text-stone-400 shrink-0">Modèle</label>
          <select
            value={modelId}
            onChange={(e) => {
              setModelId(e.target.value);
              const m = modelById(e.target.value);
              if (m?.caps.includes('video') && !m.caps.includes('chat')) setMode('video');
              else if (m?.caps.includes('image') && !m.caps.includes('chat')) setMode('image');
              else if ((mode === 'image' || mode === 'video') && m && !m.caps.includes(mode)) setMode('chat');
            }}
            className="input-field text-sm flex-1 min-w-[200px]"
          >
            {AI_MODELS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
        {selected ? (
          <p className="text-xs text-stone-500">{selected.description}</p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setMode('chat')}
            className={`text-xs px-3 py-1.5 rounded-full ${mode === 'chat' ? 'bg-primary-600 text-white' : 'bg-stone-800 text-stone-300'}`}
          >
            Chat
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('image');
              setModelId('pollinations-image');
            }}
            className={`text-xs px-3 py-1.5 rounded-full flex items-center gap-1 ${mode === 'image' ? 'bg-primary-600 text-white' : 'bg-stone-800 text-stone-300'}`}
          >
            <ImagePlus size={12} /> Image
          </button>
          <button
            type="button"
            onClick={() => setMode('file')}
            className={`text-xs px-3 py-1.5 rounded-full flex items-center gap-1 ${mode === 'file' ? 'bg-primary-600 text-white' : 'bg-stone-800 text-stone-300'}`}
          >
            <FileDown size={12} /> Fichier
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('video');
              setModelId('pollinations-video');
            }}
            className={`text-xs px-3 py-1.5 rounded-full flex items-center gap-1 ${mode === 'video' ? 'bg-primary-600 text-white' : 'bg-stone-800 text-stone-300'}`}
          >
            <Video size={12} /> Vidéo
          </button>
        </div>
        {lastError ? (
          <p className="text-xs text-amber-400">Dernière erreur API : {lastError}</p>
        ) : null}
      </div>

      <div className="card mb-6 bg-gradient-to-br from-primary-500/10 to-secondary-500/5 border-primary-500/20">
        <div className="flex items-center gap-4">
          <div className="p-4 rounded-2xl bg-primary-500/15">
            <Brain size={32} className="text-primary-400" />
          </div>
          <div className="flex-1">
            <p className="text-sm text-stone-400">Ventes prédites demain</p>
            <p className="text-3xl font-bold font-display text-stone-100">
              {formatFCFA(predictedSales)}
            </p>
          </div>
          {topDay && (
            <div className="text-right">
              <p className="text-sm text-stone-400">Meilleur jour</p>
              <p className="text-xl font-bold text-primary-400 capitalize">{topDay}</p>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-8">
        {insights.map((ins, i) => {
          const Icon = ins.icon;
          return (
            <div key={i} className={`card border ${colorMap[ins.color]}`}>
              <div className="flex items-start gap-3">
                <div className={`p-2.5 rounded-xl shrink-0 ${colorMap[ins.color]}`}>
                  <Icon size={20} />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-stone-100 mb-1">{ins.title}</p>
                  <p className="text-sm text-stone-400">{ins.message}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="card p-0 overflow-hidden">
        {/* Barre modes toujours visible */}
        <div className="sticky top-0 z-20 bg-stone-950/95 backdrop-blur border-b border-stone-800 px-3 py-2 space-y-2">
          <div className="flex flex-wrap gap-1.5">
            <button type="button" onClick={() => { setMode('chat'); if (modelId.startsWith('pollinations')) setModelId('gemini-2.0-flash'); }}
              className={`text-xs px-3 py-1.5 rounded-full font-medium ${mode === 'chat' ? 'bg-primary-600 text-white' : 'bg-stone-800 text-stone-300'}`}>💬 Chat</button>
            <button type="button" onClick={() => { setMode('image'); setModelId('pollinations-image'); }}
              className={`text-xs px-3 py-1.5 rounded-full font-medium ${mode === 'image' ? 'bg-primary-600 text-white' : 'bg-stone-800 text-stone-300'}`}>🖼️ Image</button>
            <button type="button" onClick={() => { setMode('video'); setModelId('pollinations-video'); }}
              className={`text-xs px-3 py-1.5 rounded-full font-medium ${mode === 'video' ? 'bg-primary-600 text-white' : 'bg-stone-800 text-stone-300'}`}>🎬 Vidéo</button>
            <button type="button" onClick={() => setMode('file')}
              className={`text-xs px-3 py-1.5 rounded-full font-medium ${mode === 'file' ? 'bg-primary-600 text-white' : 'bg-stone-800 text-stone-300'}`}>📄 Fichier</button>
          </div>
          {mode === 'chat' || mode === 'file' ? (
            <select
              value={modelId}
              onChange={(e) => {
                const id = e.target.value;
                setModelId(id);
                const m = modelById(id);
                if (m?.caps.includes('video') && !m.caps.includes('chat')) setMode('video');
                else if (m?.caps.includes('image') && !m.caps.includes('chat')) setMode('image');
              }}
              className="w-full text-xs rounded-xl bg-stone-900 border border-stone-700 text-stone-200 px-3 py-2"
            >
              {AI_MODELS.filter((m) => m.caps.includes('chat') || m.caps.includes('file')).map((m) => (
                <option key={m.id} value={m.id}>{m.label}</option>
              ))}
            </select>
          ) : (
            <p className="text-[11px] text-stone-500">
              {mode === 'image' ? 'Décrivez l’image puis Envoyer (Pollinations).' : 'Décrivez la scène vidéo (15–60 s de génération).'}
            </p>
          )}
          {lastError ? <p className="text-[11px] text-red-400">{lastError}</p> : null}
        </div>

        <div className="px-4 py-3 border-b border-stone-800 flex items-center gap-2">
          <Bot size={18} className="text-primary-400" />
          <span className="text-sm font-medium text-stone-200">Assistant</span>
          <span className="text-xs text-stone-500 ml-auto">{selected?.label || modelId}</span>
        </div>
        <div className="p-4 space-y-3 max-h-[420px] overflow-y-auto">
          {turns.map((t) => (
            <div
              key={t.id}
              className={`flex gap-2 ${t.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {t.role === 'assistant' && (
                <div className="w-8 h-8 rounded-full bg-primary-500/20 flex items-center justify-center shrink-0">
                  <Bot size={16} className="text-primary-400" />
                </div>
              )}
              <div
                className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap ${
                  t.role === 'user'
                    ? 'bg-primary-600 text-white'
                    : 'bg-stone-800 text-stone-200'
                }`}
              >
                {t.text}
                {t.imageUrl ? (
                  <a href={t.imageUrl} target="_blank" rel="noreferrer" className="block mt-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={t.imageUrl}
                      alt="Générée"
                      className="rounded-xl max-h-64 object-cover border border-stone-700"
                      loading="lazy"
                    />
                  </a>
                ) : null}
                {t.videoUrl ? (
                  <div className="mt-2 space-y-2">
                    <video
                      src={t.videoUrl}
                      controls
                      playsInline
                      className="rounded-xl max-h-72 w-full bg-black border border-stone-700"
                    />
                    <a
                      href={t.videoUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-primary-400 underline"
                    >
                      Ouvrir la vidéo
                    </a>
                  </div>
                ) : null}
                {t.role === 'assistant' && t.escalate && (
                  <a
                    href={supportMailto(
                      'Assistance Stock Manager AI',
                      `Bonjour Kevin Tech Pro,\n\nL’assistant IA n’a pas résolu mon problème.\n\nÉtablissement : ${member?.establishment_id || ''}\nCompte : ${member?.email || ''}\n\nDescription :\n`,
                    )}
                    className="mt-3 inline-flex items-center gap-2 rounded-xl bg-amber-500 text-stone-900 font-semibold text-xs px-3 py-2 hover:bg-amber-400"
                  >
                    Écrire au support (email)
                  </a>
                )}
              </div>
              {t.role === 'user' && (
                <div className="w-8 h-8 rounded-full bg-stone-700 flex items-center justify-center shrink-0">
                  <User size={16} className="text-stone-300" />
                </div>
              )}
            </div>
          ))}
          {thinking && (
            <div className="flex items-center gap-2 text-stone-500 text-sm">
              <Loader2 className="animate-spin" size={14} /> Réflexion…
            </div>
          )}
          <div ref={endRef} />
        </div>
        <div className="px-3 pb-2 flex flex-wrap gap-2">
          {quick.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => setInput(q)}
              className="text-xs px-2.5 py-1 rounded-full bg-stone-800 text-stone-300 hover:bg-stone-700"
            >
              {q}
            </button>
          ))}
        </div>
        <div className="p-3 border-t border-stone-800 flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && ask()}
            placeholder={
              mode === 'image'
                ? 'Décrivez l’image à générer…'
                : mode === 'video'
                  ? 'Décrivez la vidéo (ex. maquis animé, bières sur comptoir)…'
                  : mode === 'file'
                    ? 'Ex. Rapport stock bas en texte…'
                    : 'Ex. Comment ajouter une boisson ?'
            }
            className="input-field flex-1"
          />
          <button
            onClick={ask}
            disabled={thinking || !input.trim()}
            className="btn-primary px-4 flex items-center gap-2"
          >
            <Send size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
