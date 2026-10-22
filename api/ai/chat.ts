import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Multi-provider AI proxy (Gemini / Groq / OpenRouter / Pollinations image)
 * Secrets: GEMINI_API_KEY, GROQ_API_KEY, OPENROUTER_API_KEY
 * Never expose keys to the browser.
 */

type Body = {
  prompt?: string;
  model?: string;
  provider?: string;
  mode?: 'chat' | 'image' | 'file';
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
  if (!r.ok) {
    return { error: j?.error?.message || 'Gemini error', status: r.status, raw: j };
  }
  const text =
    j?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text || '').join('') ||
    '';
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
  const text = j?.choices?.[0]?.message?.content || '';
  return { text, provider, model };
}

function pollinationsImageUrl(prompt: string) {
  const p = encodeURIComponent(prompt.slice(0, 500));
  return `https://image.pollinations.ai/prompt/${p}?width=1024&height=1024&nologo=true`;
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

  // Images: Pollinations (gratuit, sans clé)
  if (mode === 'image' || provider === 'pollinations' || model === 'pollinations-image') {
    const prompt = String(body.prompt || '').trim();
    if (!prompt) return res.status(400).json({ error: 'prompt requis pour image' });
    const url = pollinationsImageUrl(prompt);
    return res.status(200).json({
      ok: true,
      mode: 'image',
      provider: 'pollinations',
      image_url: url,
      text: `Image générée (Pollinations).\n${url}`,
    });
  }

  if (!body.prompt && !body.image) {
    return res.status(400).json({ error: 'prompt ou image requis' });
  }

  // Resolve provider from model id if needed
  let prov = provider;
  if (!prov) {
    if (model.startsWith('gemini') || model.includes('gemini')) prov = 'gemini';
    else if (model.includes('openrouter') || model.includes(':free') || model.includes('/'))
      prov = model.startsWith('llama') || model.includes('gpt-oss') ? 'groq' : 'openrouter';
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
      const m = model && !model.startsWith('openrouter') ? model : 'llama-3.3-70b-versatile';
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
    const msg = e instanceof Error ? e.message : 'Erreur IA';
    return res.status(500).json({ error: msg });
  }
}
