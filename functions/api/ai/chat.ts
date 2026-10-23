import { json, env, readBody, noContent } from '../_lib/http';

type Ctx = { request: Request; env: Record<string, string | undefined> };

function imageUrl(prompt: string) {
  return `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt.slice(0, 400))}?width=1024&height=1024&nologo=true&enhance=true`;
}
function videoUrl(prompt: string) {
  return `https://gen.pollinations.ai/video/${encodeURIComponent(prompt.slice(0, 300))}`;
}

async function chatGemini(apiKey: string, body: Record<string, unknown>) {
  const model = String(body.model || 'gemini-3.5-flash-lite');
  const parts: Array<Record<string, unknown>> = [];
  const system = String(body.system || '');
  const prompt = String(body.prompt || '');
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
  if (!r.ok) return { error: j?.error?.message || 'Gemini error', status: r.status };
  const text =
    j?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text || '').join('') || '';
  return { text, provider: 'gemini', model };
}

async function chatOpenAICompat(
  baseUrl: string,
  apiKey: string,
  model: string,
  body: Record<string, unknown>,
  provider: string,
  appUrl: string,
) {
  const messages: Array<{ role: string; content: string }> = [];
  if (body.system) messages.push({ role: 'system', content: String(body.system).slice(0, 4000) });
  messages.push({ role: 'user', content: String(body.prompt || '').slice(0, 12000) });
  const r = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      ...(provider === 'openrouter'
        ? { 'HTTP-Referer': appUrl, 'X-Title': 'Stock Manager AI' }
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
  if (!r.ok) return { error: j?.error?.message || j?.message || `${provider} error`, status: r.status };
  return { text: j?.choices?.[0]?.message?.content || '', provider, model };
}

export async function onRequest(context: Ctx) {
  const { request } = context;
  if (request.method === 'OPTIONS') return noContent();
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const body = await readBody(request);
  const mode = String(body.mode || 'chat');
  const provider = String(body.provider || '').toLowerCase();
  const model = String(body.model || '');
  const prompt = String(body.prompt || '').trim();
  const appUrl = env(context, 'APP_URL') || 'https://stock-manager-ktp.vercel.app';

  if (mode === 'image' || provider === 'pollinations' || model === 'pollinations-image') {
    if (!prompt) return json({ error: 'prompt requis pour image' }, 400);
    const url = imageUrl(prompt);
    return json({ ok: true, mode: 'image', provider: 'pollinations', image_url: url, text: `Image générée.\n${url}` });
  }
  if (mode === 'video' || model === 'pollinations-video') {
    if (!prompt) return json({ error: 'prompt requis pour vidéo' }, 400);
    const url = videoUrl(prompt);
    return json({
      ok: true,
      mode: 'video',
      provider: 'pollinations',
      video_url: url,
      text: `Vidéo en cours (15–60 s).\n${url}`,
    });
  }

  if (!body.prompt && !body.image) return json({ error: 'prompt ou image requis' }, 400);

  let prov = provider;
  if (!prov) {
    if (model.includes('gemini')) prov = 'gemini';
    else if (model.includes(':free') || model.includes('/')) prov = 'openrouter';
    else if (model.includes('llama') || model.includes('gpt-oss')) prov = 'groq';
    else prov = 'gemini';
  }

  try {
    if (prov === 'gemini') {
      const key = env(context, 'GEMINI_API_KEY') || env(context, 'GOOGLE_GENERATIVE_AI_API_KEY') || '';
      if (!key) return json({ error: 'GEMINI_API_KEY manquant' }, 503);
      const out = await chatGemini(key, body);
      if ('error' in out && out.error) return json(out, out.status || 502);
      return json({ ok: true, mode: 'chat', ...out });
    }
    if (prov === 'groq') {
      const key = env(context, 'GROQ_API_KEY') || '';
      if (!key) return json({ error: 'GROQ_API_KEY manquant' }, 503);
      const out = await chatOpenAICompat('https://api.groq.com/openai/v1', key, model || 'llama-3.3-70b-versatile', body, 'groq', appUrl);
      if ('error' in out && out.error) return json(out, out.status || 502);
      return json({ ok: true, mode: 'chat', ...out });
    }
    if (prov === 'openrouter') {
      const key = env(context, 'OPENROUTER_API_KEY') || '';
      if (!key) return json({ error: 'OPENROUTER_API_KEY manquant' }, 503);
      let m = model || 'openrouter/free';
      if (m === 'openrouter/auto') m = 'openrouter/free';
      const out = await chatOpenAICompat('https://openrouter.ai/api/v1', key, m, body, 'openrouter', appUrl);
      if ('error' in out && out.error) return json(out, out.status || 502);
      return json({ ok: true, mode: 'chat', ...out });
    }
    return json({ error: `Provider inconnu: ${prov}` }, 400);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'Erreur IA' }, 500);
  }
}
