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
  webSearch?: boolean;
};

/** Recherche web gratuite (DuckDuckGo Instant Answer + RelatedTopics) */
async function webSearch(query: string): Promise<string> {
  try {
    const url =
      'https://api.duckduckgo.com/?q=' +
      encodeURIComponent(query.slice(0, 200)) +
      '&format=json&no_html=1&skip_disambig=1';
    const r = await fetch(url, { headers: { 'User-Agent': 'StockManagerAI/1.0' } });
    if (!r.ok) return '';
    const j = (await r.json()) as {
      AbstractText?: string;
      AbstractURL?: string;
      Heading?: string;
      RelatedTopics?: Array<{ Text?: string; FirstURL?: string } | { Topics?: Array<{ Text?: string }> }>;
    };
    const lines: string[] = [];
    if (j.Heading) lines.push('Sujet: ' + j.Heading);
    if (j.AbstractText) {
      lines.push(j.AbstractText);
      if (j.AbstractURL) lines.push('Source: ' + j.AbstractURL);
    }
    const topics = j.RelatedTopics || [];
    let n = 0;
    for (const t of topics) {
      if (n >= 5) break;
      if ('Text' in t && t.Text) {
        lines.push('- ' + t.Text);
        n++;
      } else if ('Topics' in t && Array.isArray(t.Topics)) {
        for (const sub of t.Topics) {
          if (n >= 5) break;
          if (sub.Text) {
            lines.push('- ' + sub.Text);
            n++;
          }
        }
      }
    }
    return lines.join('\n').slice(0, 3000);
  } catch {
    return '';
  }
}


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
  // Vidéo : d’abord sans clé (évite 402 payant), puis avec clé si besoin
  const attempts: Array<Record<string, string>> = [{}];
  if (expect === 'image' && pollKey()) attempts.push(authHeaders());
  if (expect === 'video' && pollKey()) attempts.push(authHeaders());

  let last: { ok: boolean; status: number; url: string; contentType?: string; error?: string } = {
    ok: false,
    status: 0,
    url,
  };

  for (const extra of attempts) {
    try {
      const r = await fetch(url, {
        method: 'GET',
        headers: {
          ...extra,
          Accept: expect === 'video' ? 'video/*,application/octet-stream' : 'image/*',
        },
        redirect: 'follow',
      });
      const ct = (r.headers.get('content-type') || '').toLowerCase();
      const enclosure = extractEnclosure(r.headers.get('link'));
      const finalUrl = enclosure || url;
      if (r.ok || enclosure) {
        return { ok: true, status: r.status, url: finalUrl, contentType: ct };
      }
      last = { ok: false, status: r.status, url: finalUrl, contentType: ct, error: `HTTP ${r.status}` };
    } catch (e) {
      last = {
        ok: false,
        status: 0,
        url,
        error: e instanceof Error ? e.message : 'fetch error',
      };
    }
  }
  return last;
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
  let prompt = String(body.prompt || '').trim();
  // Enrichissement recherche web (optionnel)
  if (body.webSearch && prompt && mode === 'chat') {
    const findings = await webSearch(prompt);
    if (findings) {
      prompt =
        prompt +
        '\n\n[Résultats de recherche web — utilise-les si utiles et cite les sources]\n' +
        findings;
    }
  }
  // System prompt par défaut polyvalent si absent
  if (!body.system) {
    body.system =
      'Tu es un assistant IA polyvalent. Tu peux parler de n\'importe quel sujet (pas seulement le commerce). Français clair, utile, sans limiter le sujet.';
  }

  // ——— VIDEO ———
  // Renvoie tout de suite l’URL de génération ; le navigateur charge/joue la vidéo
  // (Pollinations peut prendre 15–90 s la première fois).
  if (mode === 'video' || model === 'pollinations-video') {
    if (!prompt) return res.status(400).json({ error: 'prompt requis pour vidéo' });
    const url = genVideoUrl(prompt);
    let playUrl = url;
    try {
      // HEAD/GET court sans bloquer trop longtemps
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 25000);
      const r = await fetch(url, {
        method: 'GET',
        headers: { Accept: 'video/*,application/octet-stream' },
        redirect: 'follow',
        signal: controller.signal,
      });
      clearTimeout(timer);
      const enclosure = extractEnclosure(r.headers.get('link'));
      if (enclosure) playUrl = enclosure;
      else if (r.ok) playUrl = url;
    } catch {
      /* client retentera avec l’URL gen */
    }
    return res.status(200).json({
      ok: true,
      mode: 'video',
      provider: 'pollinations',
      video_url: playUrl,
      gen_url: url,
      text: 'Vidéo générée.',
      authenticated: Boolean(pollKey()),
    });
  }

  // ——— IMAGE ———
  if ((mode === 'image' || model === 'pollinations-image') && mode !== 'video') {
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
