import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Multi-provider AI proxy
 * - Chat: Gemini / Groq / OpenRouter
 * - Image: Pollinations (image.pollinations.ai) + option POLLINATIONS_API_KEY
 * - Video: Pollinations (gen.pollinations.ai/video)
 * Secrets: GEMINI_API_KEY, GROQ_API_KEY, OPENROUTER_API_KEY, POLLINATIONS_API_KEY (optionnel)
 */

type Body = {
  prompt?: string;
  model?: string;
  provider?: string;
  mode?: 'chat' | 'image' | 'video' | 'file';
  system?: string;
  image?: string;
  mime?: string;
  temperature?: number;
  maxOutputTokens?: number;
};

function cors(res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

function pollinationsHeaders() {
  const key = process.env.POLLINATIONS_API_KEY || '';
  return key ? { Authorization: `Bearer ${key}` } : {};
}

function imageUrl(prompt: string) {
  const p = encodeURIComponent(prompt.slice(0, 400));
  return `https://image.pollinations.ai/prompt/${p}?width=1024&height=1024&nologo=true&enhance=true`;
}

function videoUrl(prompt: string) {
  const p = encodeURIComponent(prompt.slice(0, 300));
  // gen.pollinations.ai/video fonctionne (probe 200 video/mp4)
  return `https://gen.pollinations.ai/video/${p}`;
}

async function chatGemini(apiKey: string, body: Body) {
  const model = String(body.model || 'gemini-2.0-flash').replace(/^gemini\//, '');
  const parts: Array<Record<string, unknown>> = [];
  const system = String(body.system || '').slice(0, 4000);
  const prompt = String(body.prompt || '').slice(0, 12000);
  if (system) parts.push({ text: `System: ${system}\n\nUser: ${prompt}` });
  else if (prompt) parts.push({ text: prompt });
  if (body.image) {
    parts.push({
      inline_data: {
        mime_type: String(body.mime || 'image/jpeg'),
        data: String(body.image).replace(/^data:[^;]+;base64,/, ''),
      },
    });
  }
  const r = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: {
          temperature: Number(body.temperature ?? 0.4),
          maxOutputTokens: Math.min(8192, Number(body.maxOutputTokens || 2048)),
        },
      }),
    },
  );
  const j = await r.json();
  if (!r.ok) return { error: j?.error?.message || 'Gemini error', status: r.status, raw: j };
  const text =
    j?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text || '').join('') || '';
  return { text, provider: 'gemini', model };
}

async function chatOpenAICompat(
  baseUrl: string,
  apiKey: string,
  model: string,
  body: Body,
  provider: string,
) {
  const messages: Array<{ role: string; content: string }> = [];
  if (body.system) messages.push({ role: 'system', content: String(body.system).slice(0, 4000) });
  messages.push({ role: 'user', content: String(body.prompt || '').slice(0, 12000) });
  const r = await fetch(`${baseUrl.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      ...(provider === 'openrouter'
        ? {
            'HTTP-Referer': process.env.APP_URL || 'https://stock-manager-ktp.vercel.app',
            'X-Title': 'Stock Manager AI',
          }
        : {}),
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: Number(body.temperature ?? 0.4),
      max_tokens: Math.min(4096, Number(body.maxOutputTokens || 2048)),
    }),
  });
  const j = await r.json();
  if (!r.ok) {
    return { error: j?.error?.message || j?.message || `${provider} error`, status: r.status, raw: j };
  }
  return { text: j?.choices?.[0]?.message?.content || '', provider, model };
}

/** Vérifie qu'une URL média répond (image/jpeg ou video/mp4) */
async function probeMedia(url: string, expect: 'image' | 'video') {
  try {
    const r = await fetch(url, {
      method: 'GET',
      headers: { ...pollinationsHeaders(), Accept: expect === 'video' ? 'video/*' : 'image/*' },
      redirect: 'follow',
    });
    const ct = (r.headers.get('content-type') || '').toLowerCase();
    if (!r.ok) return { ok: false, status: r.status, error: `HTTP ${r.status}` };
    if (expect === 'image' && !ct.includes('image')) {
      return { ok: false, status: r.status, error: `Content-Type inattendu: ${ct}` };
    }
    if (expect === 'video' && !ct.includes('video') && !ct.includes('octet-stream') && !ct.includes('mp4')) {
      // certains CDN renvoient octet-stream
      if (r.status === 200) return { ok: true, status: 200 };
      return { ok: false, status: r.status, error: `Content-Type inattendu: ${ct}` };
    }
    return { ok: true, status: r.status };
  } catch (e) {
    return { ok: false, status: 0, error: e instanceof Error ? e.message : 'probe failed' };
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  let body: Body = {};
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
  } catch {
    return res.status(400).json({ error: 'JSON invalide' });
  }

  const mode = body.mode || 'chat';
  const provider = String(body.provider || '').toLowerCase();
  const model = String(body.model || '');
  const prompt = String(body.prompt || '').trim();

  // ——— IMAGE ———
  if (mode === 'image' || provider === 'pollinations' || model === 'pollinations-image') {
    if (!prompt) return res.status(400).json({ error: 'prompt requis pour image' });
    const url = imageUrl(prompt);
    // Ne bloque pas trop longtemps : on renvoie l’URL (lazy load côté client)
    // Probe court optionnel
    const probe = await probeMedia(url, 'image');
    if (!probe.ok && probe.status === 402) {
      return res.status(402).json({
        error: 'Quota image temporaire (Pollinations). Réessayez dans ~30 s.',
        image_url: url,
      });
    }
    return res.status(200).json({
      ok: true,
      mode: 'image',
      provider: 'pollinations',
      image_url: url,
      text: `Image générée.\n${url}`,
      probe_ok: probe.ok,
    });
  }

  // ——— VIDEO ———
  if (mode === 'video' || model === 'pollinations-video') {
    if (!prompt) return res.status(400).json({ error: 'prompt requis pour vidéo' });
    const url = videoUrl(prompt);
    // La génération vidéo peut être longue : on renvoie l’URL et le client lit le flux
    return res.status(200).json({
      ok: true,
      mode: 'video',
      provider: 'pollinations',
      video_url: url,
      text: `Vidéo en cours de génération (peut prendre 15–60 s).\n${url}`,
      hint: 'Si la lecture échoue, réessayez le même prompt ou créez une clé gratuite sur enter.pollinations.ai (POLLINATIONS_API_KEY).',
    });
  }

  if (!body.prompt && !body.image) {
    return res.status(400).json({ error: 'prompt ou image requis' });
  }

  let prov = provider;
  if (!prov) {
    if (model.startsWith('gemini') || model.includes('gemini')) prov = 'gemini';
    else if (model.includes(':free') || model.includes('/'))
      prov = model.includes('llama') && !model.includes('/') ? 'groq' : 'openrouter';
    else if (model.includes('llama') || model.includes('gpt-oss')) prov = 'groq';
    else prov = 'gemini';
  }

  try {
    if (prov === 'gemini') {
      const key = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY || '';
      if (!key) return res.status(503).json({ error: 'GEMINI_API_KEY manquant (secret Vercel)' });
      const out = await chatGemini(key, body);
      if ('error' in out && out.error) return res.status(out.status || 502).json(out);
      return res.status(200).json({ ok: true, mode: 'chat', ...out });
    }
    if (prov === 'groq') {
      const key = process.env.GROQ_API_KEY || '';
      if (!key) return res.status(503).json({ error: 'GROQ_API_KEY manquant (secret Vercel)' });
      const m = model && !model.includes('/') ? model : 'llama-3.3-70b-versatile';
      const out = await chatOpenAICompat('https://api.groq.com/openai/v1', key, m, body, 'groq');
      if ('error' in out && out.error) return res.status(out.status || 502).json(out);
      return res.status(200).json({ ok: true, mode: 'chat', ...out });
    }
    if (prov === 'openrouter') {
      const key = process.env.OPENROUTER_API_KEY || '';
      if (!key) return res.status(503).json({ error: 'OPENROUTER_API_KEY manquant (secret Vercel)' });
      let m = model || 'meta-llama/llama-3.3-70b-instruct:free';
      if (m === 'openrouter/auto') m = 'meta-llama/llama-3.3-70b-instruct:free';
      const out = await chatOpenAICompat('https://openrouter.ai/api/v1', key, m, body, 'openrouter');
      if ('error' in out && out.error) return res.status(out.status || 502).json(out);
      return res.status(200).json({ ok: true, mode: 'chat', ...out });
    }
    return res.status(400).json({ error: `Provider inconnu: ${prov}` });
  } catch (e) {
    return res.status(500).json({ error: e instanceof Error ? e.message : 'Erreur IA' });
  }
}
