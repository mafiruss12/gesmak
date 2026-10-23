import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Multi-provider AI proxy
 * Secrets: GEMINI_API_KEY, GROQ_API_KEY, OPENROUTER_API_KEY, POLLINATIONS_API_KEY
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
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS, GET');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

function pollKey() {
  return process.env.POLLINATIONS_API_KEY || '';
}

function authHeaders(): Record<string, string> {
  const k = pollKey();
  return k ? { Authorization: `Bearer ${k}` } : {};
}

/** Image : legacy public + fallback gen avec clé */
function publicImageUrl(prompt: string) {
  return `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt.slice(0, 400))}?width=1024&height=1024&nologo=true&enhance=true`;
}

function genImageUrl(prompt: string) {
  return `https://gen.pollinations.ai/image/${encodeURIComponent(prompt.slice(0, 400))}?width=1024&height=1024`;
}

function genVideoUrl(prompt: string) {
  return `https://gen.pollinations.ai/video/${encodeURIComponent(prompt.slice(0, 300))}`;
}

/** Si la réponse a un Link enclosure CDN, on le préfère (lecture directe client) */
function extractEnclosure(linkHeader: string | null): string | null {
  if (!linkHeader) return null;
  const m = linkHeader.match(/<([^>]+)>\s*;\s*rel="enclosure"/i);
  return m?.[1] || null;
}

async function resolveMedia(url: string, expect: 'image' | 'video') {
  const r = await fetch(url, {
    method: 'GET',
    headers: {
      ...authHeaders(),
      Accept: expect === 'video' ? 'video/*,application/octet-stream' : 'image/*',
    },
    redirect: 'follow',
  });
  const ct = (r.headers.get('content-type') || '').toLowerCase();
  const enclosure = extractEnclosure(r.headers.get('link'));
  if (enclosure) {
    return { ok: r.ok, status: r.status, url: enclosure, contentType: ct };
  }
  // Si OK, l’URL d’origine (ou finale après redirect) reste utilisable
  return { ok: r.ok, status: r.status, url, contentType: ct, error: r.ok ? undefined : `HTTP ${r.status}` };
}

async function chatGemini(apiKey: string, body: Body) {
  const model = String(body.model || 'gemini-3.5-flash-lite').replace(/^gemini\//, '');
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
    const hasKey = Boolean(pollKey());
    // 1) Essayer gen + clé si dispo
    if (hasKey) {
      try {
        const resolved = await resolveMedia(genImageUrl(prompt), 'image');
        if (resolved.ok) {
          return res.status(200).json({
            ok: true,
            mode: 'image',
            provider: 'pollinations',
            image_url: resolved.url,
            text: `Image générée.\n${resolved.url}`,
            authenticated: true,
          });
        }
      } catch {
        /* fallback public */
      }
    }
    // 2) Fallback public image.pollinations.ai
    const url = publicImageUrl(prompt);
    return res.status(200).json({
      ok: true,
      mode: 'image',
      provider: 'pollinations',
      image_url: url,
      text: `Image générée.\n${url}`,
      authenticated: false,
      hint: hasKey ? undefined : 'Ajoutez POLLINATIONS_API_KEY pour plus de stabilité.',
    });
  }

  // ——— VIDEO ———
  if (mode === 'video' || model === 'pollinations-video') {
    if (!prompt) return res.status(400).json({ error: 'prompt requis pour vidéo' });
    const url = genVideoUrl(prompt);
    try {
      // Lance la génération côté serveur avec la clé (meilleure fiabilité)
      const resolved = await resolveMedia(url, 'video');
      if (resolved.ok) {
        return res.status(200).json({
          ok: true,
          mode: 'video',
          provider: 'pollinations',
          video_url: resolved.url,
          text: `Vidéo prête (ou en finalisation).\n${resolved.url}`,
          authenticated: Boolean(pollKey()),
        });
      }
      // Même si probe échoue, renvoyer l’URL pour que le lecteur client réessaie
      return res.status(200).json({
        ok: true,
        mode: 'video',
        provider: 'pollinations',
        video_url: url,
        text: `Vidéo en cours (15–60 s). Si ça ne charge pas, réessayez.\n${url}`,
        authenticated: Boolean(pollKey()),
        probe_status: resolved.status,
        probe_error: resolved.error,
      });
    } catch (e) {
      return res.status(200).json({
        ok: true,
        mode: 'video',
        provider: 'pollinations',
        video_url: url,
        text: `Vidéo demandée.\n${url}`,
        error_soft: e instanceof Error ? e.message : 'timeout',
      });
    }
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
      const m = model && !model.includes('/') ? model : 'llama-3.1-8b-instant';
      const out = await chatOpenAICompat('https://api.groq.com/openai/v1', key, m, body, 'groq');
      if ('error' in out && out.error) return res.status(out.status || 502).json(out);
      return res.status(200).json({ ok: true, mode: 'chat', ...out });
    }
    if (prov === 'openrouter') {
      const key = process.env.OPENROUTER_API_KEY || '';
      if (!key) return res.status(503).json({ error: 'OPENROUTER_API_KEY manquant (secret Vercel)' });
      let m = model || 'openrouter/free';
      if (m === 'openrouter/auto') m = 'openrouter/free';
      const out = await chatOpenAICompat('https://openrouter.ai/api/v1', key, m, body, 'openrouter');
      if ('error' in out && out.error) return res.status(out.status || 502).json(out);
      return res.status(200).json({ ok: true, mode: 'chat', ...out });
    }
    return res.status(400).json({ error: `Provider inconnu: ${prov}` });
  } catch (e) {
    return res.status(500).json({ error: e instanceof Error ? e.message : 'Erreur IA' });
  }
}
