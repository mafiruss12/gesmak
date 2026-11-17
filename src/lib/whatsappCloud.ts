/**
 * WhatsApp Cloud API — POST /api/whatsapp/send
 * Fallback gratuit : wa.me (déjà utilisé ailleurs)
 */

export async function sendWhatsAppCloud(opts: {
  to: string;
  message?: string;
  template?: string;
  language?: string;
  components?: unknown[];
}): Promise<{ ok: boolean; detail: string; data?: unknown }> {
  try {
    const res = await fetch('/api/whatsapp/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(opts),
    });
    const data = await res.json();
    if (!res.ok || data.error) {
      return {
        ok: false,
        detail:
          typeof data.error === 'object'
            ? JSON.stringify(data.error)
            : data.error || data.hint || `HTTP ${res.status}`,
        data,
      };
    }
    return { ok: true, detail: 'WhatsApp envoyé', data: data.data };
  } catch (e) {
    return { ok: false, detail: e instanceof Error ? e.message : 'Erreur réseau' };
  }
}

/** Notifie propriétaire (Cloud API si dispo, sinon indique d’utiliser wa.me) */
export async function notifyOwnerWhatsApp(opts: {
  phone: string;
  message: string;
}): Promise<{ ok: boolean; detail: string }> {
  const r = await sendWhatsAppCloud({ to: opts.phone, message: opts.message });
  return r;
}
