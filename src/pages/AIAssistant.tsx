import { useEffect, useRef, useState } from 'react';
import {
  Sparkles, TrendingUp, AlertTriangle, Lightbulb, Brain, Target, Zap,
  Send, Loader2, Bot, User, ImagePlus, FileDown, Video, Paperclip, X, Pencil, History,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import type { Product, Sale } from '@/lib/types';
import { formatFCFA, daysAgoISO } from '@/lib/format';
import { EmptyState } from '@/components/ui';
import { loadKnowledge, matchTrainedAnswer, getPersona, type AiKnowledge } from '@/lib/aiTrainer';
import { SUPPORT_EMAIL, supportMailto } from '@/lib/supportContact';
import { AI_MODELS, modelById, defaultChatModelId, resolveModelId, visionModelId, type AiModelOption } from '@/lib/aiProviders';

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

type SavedChat = {
  id: string;
  title: string;
  updatedAt: number;
  turns: ChatTurn[];
};

const HISTORY_KEY = 'sm_ai_history_v1';
const CURRENT_CHAT_KEY = 'sm_ai_current_chat_id';

function loadHistory(): SavedChat[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw) as SavedChat[];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function saveHistory(list: SavedChat[]) {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(list.slice(0, 40)));
  } catch { /* */ }
}

function titleFromTurns(turns: ChatTurn[]): string {
  const u = turns.find((x) => x.role === 'user' && x.text.trim());
  if (u) return u.text.trim().slice(0, 48) + (u.text.trim().length > 48 ? '…' : '');
  return 'Conversation';
}

function defaultWelcome(): ChatTurn[] {
  return [{ id: 'welcome', role: 'assistant', text: 'Bonjour. Comment puis-je vous aider ?' }];
}



function buildReply(
  question: string,
  _ctx: {
    sales: Sale[];
    products: Product[];
    expensesTotal: number;
    salesTotal: number;
    lowStock: Product[];
    topProduct?: { name: string; revenue: number };
  } | null,
  knowledge: AiKnowledge[] = [],
): string {
  const trained = matchTrainedAnswer(question, knowledge);
  if (trained) return trained.answer;
  return 'L’IA distante est momentanément indisponible. Réessayez, changez de modèle (Grok / Gemini / OpenRouter), ou vérifiez la connexion.';
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

function cleanMediaText(s: string | undefined | null, kind: 'image' | 'video'): string {
  const raw = String(s || '').trim();
  const noUrl = raw.replace(/https?:\/\/\S+/gi, '').replace(/\n{2,}/g, '\n').trim();
  if (!noUrl || /^image générée\.?$/i.test(noUrl) || /^vidéo/i.test(noUrl)) {
    return kind === 'image' ? 'Image générée.' : 'Vidéo générée.';
  }
  return noUrl;
}

function stripMarkdown(s: string): string {
  return s
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .trim();
}

function buildSystemPrompt() {
  return `Tu es Stock AI, un assistant conversationnel polyvalent (comme un assistant général).

Règles d'identité :
- Tu n'es PAS limité au stock, maquis, caisse ou commerce.
- Si on te demande qui tu es : dis que tu es Stock AI, assistant général intégré à l'app, capable de discuter de tout sujet, analyser des fichiers, générer des images/vidéos, et aider à la rédaction.
- Ne propose PAS systématiquement Caisse / Inventaire / Rapport du jour sauf si l'utilisateur parle explicitement de gestion de stock.

Style de réponse (obligatoire) :
- Français clair et professionnel.
- PAS de markdown : n'utilise jamais ** gras **, * italique *, # titres, ni listes avec des tirets markdown.
- Pour les listes, utilise des puces simples "• " ou des numéros "1. 2. 3." sans étoiles.
- N'écris PAS ton nom de modèle, ni le fournisseur (Grok, Gemini, OpenRouter) dans le corps de la réponse.
- Réponses naturelles, comme un humain utile, sans jargon technique inutile.`;
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

  const [turns, setTurns] = useState<ChatTurn[]>(() => defaultWelcome());
  const [chatId, setChatId] = useState<string>(() => {
    try {
      return localStorage.getItem(CURRENT_CHAT_KEY) || `chat-${Date.now()}`;
    } catch {
      return `chat-${Date.now()}`;
    }
  });
  const [history, setHistory] = useState<SavedChat[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState('');

  const [input, setInput] = useState('');
  const [thinking, setThinking] = useState(false);
  const [knowledge, setKnowledge] = useState<AiKnowledge[]>([]);
  const [modelId, setModelId] = useState(() => {
    try {
      return resolveModelId(localStorage.getItem('sm_ai_model'));
    } catch {
      return defaultChatModelId();
    }
  });
  const [mode, setMode] = useState<'chat' | 'image' | 'video' | 'file'>('chat');
  const [lastError, setLastError] = useState('');
  const [attachments, setAttachments] = useState<
    Array<{ name: string; mime: string; dataUrl: string; kind: 'image' | 'text' | 'binary' }>
  >([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [webSearch, setWebSearch] = useState(false);

  useEffect(() => {
    try { localStorage.setItem('sm_ai_model', modelId); } catch { /* */ }
  }, [modelId]);

  // Charger historique + conversation courante (migration ancienne clé)
  useEffect(() => {
    let list = loadHistory();
    try {
      const legacy = localStorage.getItem('sm_ai_chat_v1');
      if (legacy && list.length === 0) {
        const parsed = JSON.parse(legacy) as ChatTurn[];
        if (Array.isArray(parsed) && parsed.some((x) => x.role === 'user')) {
          const id = `chat-${Date.now()}`;
          list = [{ id, title: titleFromTurns(parsed), updatedAt: Date.now(), turns: parsed.slice(-80) }];
          saveHistory(list);
          localStorage.setItem(CURRENT_CHAT_KEY, id);
          setChatId(id);
          setTurns(parsed.slice(-80));
        }
        localStorage.removeItem('sm_ai_chat_v1');
      }
    } catch { /* */ }
    setHistory(list);
    try {
      const cur = localStorage.getItem(CURRENT_CHAT_KEY);
      if (cur) {
        const found = list.find((c) => c.id === cur);
        if (found && found.turns?.length) {
          setChatId(found.id);
          setTurns(found.turns);
        }
      }
    } catch { /* */ }
  }, []);

  // Sauvegarder la conversation active dans l'historique
  useEffect(() => {
    if (!chatId) return;
    const hasUser = turns.some((x) => x.role === 'user');
    setHistory((prev) => {
      const others = prev.filter((c) => c.id !== chatId);
      if (!hasUser && turns.length <= 1) {
        saveHistory(others);
        return others;
      }
      const entry: SavedChat = {
        id: chatId,
        title: titleFromTurns(turns),
        updatedAt: Date.now(),
        turns: turns.slice(-80),
      };
      const next = [entry, ...others].slice(0, 40);
      saveHistory(next);
      try { localStorage.setItem(CURRENT_CHAT_KEY, chatId); } catch { /* */ }
      return next;
    });
  }, [turns, chatId]);


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
              text: 'Bonjour. Comment puis-je vous aider ?',
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

  async function callRemoteAi(
    prompt: string,
    forceMode?: 'chat' | 'image' | 'video' | 'file',
    opts?: { image?: string; mime?: string; modelOverride?: string },
  ) {
    const m = forceMode || mode;
    const mid = resolveModelId(opts?.modelOverride || modelId);
    const mod = modelById(mid);
    const provider = mod?.provider || 'gemini';
    const body: Record<string, unknown> = {
      prompt,
      model: mid,
      provider: m === 'image' ? 'pollinations' : provider,
      mode: m === 'file' ? 'chat' : m,
      system: buildSystemPrompt(),
      temperature: 0.35,
      maxOutputTokens: 4096,
      webSearch: webSearch || /recherche|search|sur le net|internet|actualité|qui est|what is/i.test(prompt),
    };
    if (opts?.image) {
      body.image = opts.image.replace(/^data:[^;]+;base64,/, '');
      body.mime = opts.mime || 'image/jpeg';
      if (!mod?.caps.includes('vision')) {
        body.model = visionModelId();
        body.provider = 'gemini';
      }
    }
    const res = await fetch('/api/ai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(j.error || `Erreur IA (${res.status})`);
    return j as { text?: string; image_url?: string; video_url?: string; provider?: string; model?: string };
  }

  async function onPickFiles(files: FileList | null) {
    if (!files?.length) return;
    const next: Array<{ name: string; mime: string; dataUrl: string; kind: 'image' | 'text' | 'binary' }> = [];
    for (const file of Array.from(files).slice(0, 6)) {
      if (file.size > 8 * 1024 * 1024) {
        setLastError(`Fichier trop volumineux (max 8 Mo) : ${file.name}`);
        continue;
      }
      const mime = file.type || 'application/octet-stream';
      const isImg = mime.startsWith('image/');
      const isText =
        mime.startsWith('text/') ||
        mime.includes('json') ||
        mime.includes('csv') ||
        /\.(txt|md|csv|json|log)$/i.test(file.name);
      const isPdf = mime === 'application/pdf' || /\.pdf$/i.test(file.name);
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result || ''));
        r.onerror = () => reject(new Error('lecture fichier'));
        r.readAsDataURL(file);
      });
      if (isImg) next.push({ name: file.name, mime, dataUrl, kind: 'image' });
      else if (isText) next.push({ name: file.name, mime: mime || 'text/plain', dataUrl, kind: 'text' });
      else if (isPdf) next.push({ name: file.name, mime: 'application/pdf', dataUrl, kind: 'binary' });
      else setLastError(`Type non supporté : ${file.name}. Image, PDF, TXT, CSV ou JSON.`);
    }
    if (next.length) setAttachments((prev) => [...prev, ...next].slice(0, 8));
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  async function ask(opts?: { text?: string; replaceUserId?: string }) {
    const fromEdit = Boolean(opts?.replaceUserId);
    const rawQ = (opts?.text !== undefined ? opts.text : input).trim();
    if ((!rawQ && attachments.length === 0 && !fromEdit) || !ctx) return;
    const q = rawQ || (attachments.length ? 'Analyse le(s) fichier(s) joint(s) et explique clairement en français.' : '');
    const attSnap = fromEdit ? [] : [...attachments];
    if (!fromEdit) {
      setInput('');
      setAttachments([]);
    }
    setEditingId(null);
    setEditDraft('');
    setLastError('');
    const attLabel = attSnap.length ? ('\n\n📎 ' + attSnap.map((a) => a.name).join(', ')) : '';
    const userText = q + attLabel;

    if (opts?.replaceUserId) {
      setTurns((prev) => {
        const idx = prev.findIndex((x) => x.id === opts.replaceUserId);
        if (idx < 0) return prev;
        return [...prev.slice(0, idx), { id: opts.replaceUserId!, role: 'user' as const, text: userText }];
      });
    } else {
      setTurns((prev) => [...prev, { id: `u-${Date.now()}`, role: 'user', text: userText }]);
    }
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
            text: cleanMediaText(j.text, 'image'),
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
        const vurl = j.video_url || (j as { gen_url?: string }).gen_url;
        setTurns((t) => [
          ...t,
          {
            id: `a-${Date.now()}`,
            role: 'assistant',
            text: vurl ? 'Vidéo générée — lecture en cours (peut prendre 15 à 90 s).' : 'Impossible d’obtenir l’URL vidéo.',
            videoUrl: vurl,
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
        setTurns((t) => [...t, { id: `a-${Date.now()}`, role: 'assistant', text: stripMarkdown(reply), escalate }]);
        setThinking(false);
        return;
      }

      // Chat distant + fichiers joints (Grok / Gemini vision)
      let prompt = q;
      let imageB64: string | undefined;
      let imageMime: string | undefined;
      let modelOverride: string | undefined;
      const textParts: string[] = [];
      for (const a of attSnap) {
        if (a.kind === 'text') {
          try {
            const b64 = a.dataUrl.split(',')[1] || '';
            const decoded = atob(b64);
            textParts.push('--- Fichier: ' + a.name + ' ---\n' + decoded.slice(0, 12000));
          } catch {
            textParts.push('(Impossible de lire ' + a.name + ')');
          }
        } else if (a.kind === 'image' && !imageB64) {
          imageB64 = a.dataUrl;
          imageMime = a.mime;
          modelOverride = visionModelId();
        } else if (a.kind === 'binary') {
          textParts.push('--- Fichier joint: ' + a.name + ' (' + a.mime + ') ---');
        }
      }
      if (textParts.length) {
        prompt = q + '\n\nContenu des fichiers joints :\n' + textParts.join('\n\n');
      }
      if (attSnap.some((a) => a.kind === 'image')) {
        prompt =
          (prompt || 'Analyse cette image.') +
          '\n\nAnalyse l’image jointe en détail (texte visible, produits, quantités, anomalies).';
      }
      const j = await callRemoteAi(prompt, 'chat', {
        image: imageB64,
        mime: imageMime,
        modelOverride,
      });
      const reply = (j.text || '').trim() || buildReply(q, ctx, knowledge);
      setTurns((t) => [
        ...t,
        {
          id: `a-${Date.now()}`,
          role: 'assistant',
          text: stripMarkdown(reply),
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
          text: stripMarkdown('IA distante indisponible (' + msg + '). ' + raw.replace(/^__ESCALATE__/, '')),
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


  return (
    <div className="max-w-2xl mx-auto pb-4">
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <Sparkles className="text-primary-400 shrink-0" />
          <div>
            <h1 className="text-xl font-bold font-display text-stone-100">Assistant IA</h1>
            <p className="text-xs text-stone-500">Un chat · plusieurs modèles · fichiers, images, vidéos</p>
          </div>
        </div>
        {(member?.role === 'super_admin' || member?.role === 'owner' || member?.role === 'proprietaire') && (
          <a href="/ai-train" className="text-xs text-primary-400 hover:underline shrink-0">Former l&apos;IA</a>
        )}
      </div>

      {/* Barre unique : modèle + modes */}
      <div className="card mb-3 space-y-3">
        <div className="flex flex-wrap gap-2 items-center">
          <label className="text-xs text-stone-400 shrink-0">Modèle</label>
          <select
            value={modelId}
            onChange={(e) => {
              const id = e.target.value;
              setModelId(id);
              const m = modelById(id);
              if (m?.caps.includes('video') && !m.caps.includes('chat')) setMode('video');
              else if (m?.caps.includes('image') && !m.caps.includes('chat')) setMode('image');
              else if ((mode === 'image' || mode === 'video') && m && !m.caps.includes(mode)) setMode('chat');
            }}
            className="input-field text-sm flex-1 min-w-[180px]"
          >
            {AI_MODELS.filter((m) => m.caps.includes('chat') || m.caps.includes('image') || m.caps.includes('video') || m.caps.includes('file')).map((m) => (
              <option key={m.id} value={m.id}>{m.label}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => { setMode('chat'); if (modelId.startsWith('pollinations')) setModelId(defaultChatModelId()); }}
            className={`text-xs px-3 py-1.5 rounded-full ${mode === 'chat' ? 'bg-primary-600 text-white' : 'bg-stone-800 text-stone-300'}`}>Chat</button>
          <button type="button" onClick={() => { setMode('image'); setModelId('pollinations-image'); }}
            className={`text-xs px-3 py-1.5 rounded-full inline-flex items-center gap-1 ${mode === 'image' ? 'bg-primary-600 text-white' : 'bg-stone-800 text-stone-300'}`}><ImagePlus size={12} /> Image</button>
          <button type="button" onClick={() => { setMode('video'); setModelId('pollinations-video'); }}
            className={`text-xs px-3 py-1.5 rounded-full inline-flex items-center gap-1 ${mode === 'video' ? 'bg-primary-600 text-white' : 'bg-stone-800 text-stone-300'}`}><Video size={12} /> Vidéo</button>
          <button type="button" onClick={() => setMode('file')}
            className={`text-xs px-3 py-1.5 rounded-full inline-flex items-center gap-1 ${mode === 'file' ? 'bg-primary-600 text-white' : 'bg-stone-800 text-stone-300'}`}><FileDown size={12} /> Fichier</button>
        </div>
        <label className="flex items-center gap-2 text-[11px] text-stone-400 cursor-pointer select-none">
          <input type="checkbox" checked={webSearch} onChange={(e) => setWebSearch(e.target.checked)} className="rounded border-stone-600" />
          Recherche web
        </label>
        {lastError ? <p className="text-[11px] text-red-400">{lastError}</p> : null}
      </div>

      {/* Chat unique */}
      <div className="card overflow-hidden flex flex-col min-h-[420px]">
        <div className="px-4 py-3 border-b border-stone-800 flex items-center gap-2 flex-wrap">
          <Bot size={18} className="text-primary-400" />
          <span className="text-sm font-medium text-stone-200">Conversation</span>
          <div className="ml-auto flex items-center gap-3">
            <button
              type="button"
              className="text-[11px] text-stone-400 hover:text-stone-200 underline inline-flex items-center gap-1"
              onClick={() => setShowHistory((v) => !v)}
            >
              <History size={12} /> Historique
            </button>
            <button
              type="button"
              className="text-[11px] text-stone-400 hover:text-stone-200 underline"
              onClick={() => {
                const id = `chat-${Date.now()}`;
                setChatId(id);
                setTurns(defaultWelcome());
                setShowHistory(false);
                try { localStorage.setItem(CURRENT_CHAT_KEY, id); } catch { /* */ }
              }}
            >
              Nouvelle conversation
            </button>
          </div>
        </div>
        {showHistory && (
          <div className="border-b border-stone-800 bg-stone-900/80 max-h-48 overflow-y-auto">
            {history.length === 0 ? (
              <p className="text-xs text-stone-500 px-4 py-3">Aucune conversation enregistrée pour l’instant.</p>
            ) : (
              <ul className="divide-y divide-stone-800">
                {history.map((c) => (
                  <li key={c.id} className="flex items-center gap-2 px-3 py-2 hover:bg-stone-800/60">
                    <button
                      type="button"
                      className={`flex-1 text-left text-xs ${c.id === chatId ? 'text-primary-400' : 'text-stone-300'}`}
                      onClick={() => {
                        setChatId(c.id);
                        setTurns(c.turns?.length ? c.turns : defaultWelcome());
                        setShowHistory(false);
                        try { localStorage.setItem(CURRENT_CHAT_KEY, c.id); } catch { /* */ }
                      }}
                    >
                      <span className="font-medium block truncate">{c.title || 'Conversation'}</span>
                      <span className="text-[10px] text-stone-500">
                        {new Date(c.updatedAt).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </button>
                    <button
                      type="button"
                      className="text-[10px] text-red-400/80 hover:text-red-300 px-1"
                      title="Supprimer"
                      onClick={() => {
                        const next = history.filter((x) => x.id !== c.id);
                        setHistory(next);
                        saveHistory(next);
                        if (c.id === chatId) {
                          const id = `chat-${Date.now()}`;
                          setChatId(id);
                          setTurns(defaultWelcome());
                          try { localStorage.setItem(CURRENT_CHAT_KEY, id); } catch { /* */ }
                        }
                      }}
                    >
                      Suppr.
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <div className="p-4 space-y-3 flex-1 max-h-[55vh] overflow-y-auto">
          {turns.map((t) => (
            <div key={t.id} className={`flex gap-2 ${t.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {t.role === 'assistant' && (
                <div className="w-8 h-8 rounded-full bg-primary-500/20 flex items-center justify-center shrink-0">
                  <Bot size={16} className="text-primary-400" />
                </div>
              )}
              <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap ${
                t.role === 'user' ? 'bg-primary-600 text-white' : 'bg-stone-800 text-stone-200'
              }`}>
                {t.role === 'user' && editingId === t.id ? (
                  <div className="space-y-2">
                    <textarea
                      value={editDraft}
                      onChange={(e) => setEditDraft(e.target.value)}
                      rows={3}
                      className="w-full rounded-xl bg-primary-700/80 text-white text-sm p-2 border border-primary-400/40 outline-none"
                      autoFocus
                    />
                    <div className="flex gap-2 justify-end">
                      <button type="button" className="text-[11px] px-2 py-1 rounded-lg bg-primary-800/80" onClick={() => { setEditingId(null); setEditDraft(''); }} disabled={thinking}>Annuler</button>
                      <button type="button" className="text-[11px] px-2 py-1 rounded-lg bg-white text-primary-700 font-semibold" disabled={thinking || !editDraft.trim()} onClick={() => ask({ text: editDraft.trim(), replaceUserId: t.id })}>Enregistrer & renvoyer</button>
                    </div>
                  </div>
                ) : (
                  <>
                    {t.text}
                    {t.role === 'user' && !thinking && (
                      <button type="button" title="Modifier" className="mt-1 inline-flex items-center gap-1 text-[10px] opacity-80 hover:opacity-100" onClick={() => { setEditingId(t.id); setEditDraft(t.text); }}>
                        <Pencil size={11} /> Modifier
                      </button>
                    )}
                  </>
                )}
                {t.imageUrl ? (
                  <a href={t.imageUrl} target="_blank" rel="noreferrer" className="block mt-2">
                    <img src={t.imageUrl} alt="" className="rounded-xl max-h-64 object-cover border border-stone-700" loading="lazy" />
                  </a>
                ) : null}
                {t.videoUrl ? (
                  <div className="mt-2 space-y-2">
                    <video
                      key={t.videoUrl}
                      src={t.videoUrl}
                      controls
                      playsInline
                      preload="auto"
                      className="rounded-xl max-h-72 w-full bg-black border border-stone-700"
                      onError={(e) => {
                        const el = e.currentTarget;
                        const n = Number(el.dataset.retry || '0');
                        if (n < 6) {
                          el.dataset.retry = String(n + 1);
                          window.setTimeout(() => { el.load(); }, 5000 * (n + 1));
                        }
                      }}
                    />
                    <p className="text-[10px] text-stone-500">
                      Si l’écran reste noir, patientez : la génération peut prendre 15 à 90 secondes.
                    </p>
                  </div>
                ) : null}
                {t.role === 'assistant' && t.escalate && (
                  <a
                    href={supportMailto('Assistance Stock Manager AI', `Bonjour,\n\nÉtablissement : ${member?.establishment_id || ''}\n`)}
                    className="mt-3 inline-flex items-center gap-2 rounded-xl bg-amber-500 text-stone-900 font-semibold text-xs px-3 py-2"
                  >
                    Contacter le support
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
            <div className="flex items-center gap-2 text-stone-400 text-sm">
              <Loader2 size={16} className="animate-spin" /> Réflexion…
            </div>
          )}
          <div ref={endRef} />
        </div>

        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 px-3 pb-1">
            {attachments.map((a, idx) => (
              <span key={a.name + String(idx)} className="inline-flex items-center gap-1 text-[11px] bg-stone-800 text-stone-200 rounded-full pl-2 pr-1 py-1">
                {a.kind === 'image' ? '🖼️' : '📄'} {a.name.slice(0, 22)}
                <button type="button" className="p-0.5 rounded-full hover:bg-stone-700" onClick={() => setAttachments((prev) => prev.filter((_, j) => j !== idx))}>
                  <X size={12} />
                </button>
              </span>
            ))}
          </div>
        )}
        <input ref={fileInputRef} type="file" className="hidden" accept="image/*,.pdf,.txt,.csv,.json,.md,text/plain,application/pdf" multiple onChange={(e) => onPickFiles(e.target.files)} />

        <div className="p-3 border-t border-stone-800 flex gap-2 items-end">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && ask()}
            placeholder={
              mode === 'image' ? 'Décrivez l’image…'
                : mode === 'video' ? 'Décrivez la vidéo…'
                : mode === 'file' ? 'Décrivez le fichier à générer…'
                : 'Écrivez votre message…'
            }
            className="input-field flex-1"
          />
          <button type="button" onClick={() => fileInputRef.current?.click()} className="p-2.5 rounded-xl bg-stone-800 text-stone-200 border border-stone-700 shrink-0" title="Joindre" disabled={thinking}>
            <Paperclip size={18} />
          </button>
          <button type="button" onClick={ask} disabled={thinking || (!input.trim() && attachments.length === 0)} className="btn-primary px-4 flex items-center gap-2">
            <Send size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
