import { json, env, readBody, noContent } from '../_lib/http';

type Ctx = { request: Request; env: Record<string, string | undefined> };

/** Proxy Gemini — clé serveur uniquement (jamais VITE_) */
export async function onRequest(context: Ctx) {
  const { request } = context;
  if (request.method === 'OPTIONS') return noContent();
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const apiKey = env(context, 'GEMINI_API_KEY');
  if (!apiKey) {
    return json({
      error: 'Gemini non configure',
      hint: 'Ajoutez GEMINI_API_KEY (secret) dans Cloudflare Pages Environment variables',
    }, 503);
  }

  // Auth optionnelle : Bearer JWT utilisateur (recommandé)
  const auth = request.headers.get('Authorization') || '';
  const supabaseUrl = env(context, 'SUPABASE_URL') || env(context, 'VITE_SUPABASE_URL');
  const anon = env(context, 'SUPABASE_ANON_KEY') || env(context, 'VITE_SUPABASE_ANON_KEY');
  if (supabaseUrl && anon && auth.startsWith('Bearer ')) {
    try {
      const ur = await fetch(`${supabaseUrl}/auth/v1/user`, {
        headers: { Authorization: auth, apikey: anon },
      });
      if (!ur.ok) return json({ error: 'Session invalide' }, 401);
    } catch {
      return json({ error: 'Auth indisponible' }, 401);
    }
  }

  const body = await readBody(request);
  const prompt = String(body.prompt || '').slice(0, 8000);
  const model = String(body.model || 'gemini-2.0-flash').slice(0, 80);
  const mime = String(body.mime || body.mime_type || 'image/jpeg');
  const imageB64 = body.image || body.data || null;

  if (!prompt && !imageB64) return json({ error: 'prompt ou image requis' }, 400);

  const parts: Array<Record<string, unknown>> = [];
  if (prompt) parts.push({ text: prompt });
  if (imageB64) {
    parts.push({ inline_data: { mime_type: mime, data: String(imageB64) } });
  }

  try {
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey,
        },
        body: JSON.stringify({
          contents: [{ parts }],
          generationConfig: {
            temperature: Number(body.temperature ?? 0.15),
            maxOutputTokens: Math.min(8192, Number(body.maxOutputTokens || 4096)),
          },
        }),
      },
    );
    const text = await r.text();
    return new Response(text, {
      status: r.status,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, content-type',
      },
    });
  } catch (e: unknown) {
    return json({ error: e instanceof Error ? e.message : 'Erreur Gemini' }, 500);
  }
}
