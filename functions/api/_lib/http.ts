export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    },
  });
}
export function noContent(): Response {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    },
  });
}
export function env(context: { env?: Record<string, string | undefined> }, name: string): string | undefined {
  const e = context.env || {};
  return e[name] || e[`VITE_${name}`];
}
export async function readBody(request: Request): Promise<Record<string, unknown>> {
  try {
    const t = await request.text();
    if (!t) return {};
    return JSON.parse(t) as Record<string, unknown>;
  } catch {
    return {};
  }
}
export function bearer(request: Request): string {
  return (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
}
