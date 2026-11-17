/**
 * Messagerie client : WhatsApp + SMS
 *
 * Modes :
 * - link  : ouvre WhatsApp / SMS natif (gratuit, immédiat)
 * - api   : envoi auto via Edge Function Supabase (Twilio ou Meta Cloud API)
 */

import { buildWhatsAppLink, buildSmsLink } from '@/lib/businessTypes';
import { supabase } from '@/lib/supabase';

export type MessageChannel = 'whatsapp' | 'sms';
export type MessageProvider = 'link' | 'twilio' | 'meta';

export interface MessagingConfig {
  provider: MessageProvider;
  /** Twilio */
  twilioAccountSid?: string;
  twilioAuthToken?: string;
  twilioFromSms?: string;
  twilioFromWhatsApp?: string; // ex: whatsapp:+14155238886
  /** Meta WhatsApp Cloud API */
  metaToken?: string;
  metaPhoneNumberId?: string;
  /** Expéditeur affiché */
  businessName?: string;
}

const STORAGE_KEY = 'mm_messaging_config';

export function loadMessagingConfig(): MessagingConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as MessagingConfig;
  } catch {
    /* */
  }
  return { provider: 'link', businessName: 'Maquis Manager' };
}

export function saveMessagingConfig(cfg: MessagingConfig) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
}

/** Normalise un numéro CI vers E.164 (+225…) */
export function normalizePhoneCI(phone: string | null | undefined): string | null {
  if (!phone) return null;
  let d = phone.replace(/\D/g, '');
  if (!d) return null;
  if (d.startsWith('00')) d = d.slice(2);
  if (d.startsWith('0') && d.length >= 10) d = '225' + d.slice(1);
  if (!d.startsWith('225') && d.length === 10) d = '225' + d;
  if (!d.startsWith('+')) d = '+' + d;
  return d;
}

export interface SendResult {
  ok: boolean;
  mode: 'link' | 'api';
  url?: string; // lien à ouvrir si mode link
  error?: string;
}

/**
 * Envoie ou prépare un message WhatsApp / SMS.
 * - provider=link → retourne url à ouvrir
 * - provider=twilio|meta → appelle l'Edge Function (envoi auto)
 */
export async function sendClientMessage(opts: {
  channel: MessageChannel;
  phone: string;
  message: string;
  config?: MessagingConfig;
}): Promise<SendResult> {
  const cfg = opts.config || loadMessagingConfig();
  const phone = normalizePhoneCI(opts.phone);
  if (!phone) return { ok: false, mode: 'link', error: 'Numéro de téléphone invalide' };

  // Mode lien (toujours dispo, sans serveur)
  if (cfg.provider === 'link') {
    const url =
      opts.channel === 'whatsapp'
        ? buildWhatsAppLink(phone, opts.message)
        : buildSmsLink(phone, opts.message);
    return { ok: true, mode: 'link', url };
  }

  // Mode API via Edge Function Supabase
  try {
    const { data, error } = await supabase.functions.invoke('send-message', {
      body: {
        channel: opts.channel,
        to: phone,
        message: opts.message,
        provider: cfg.provider,
        // Les secrets doivent être côté Edge Function (env Supabase).
        // On n'envoie PAS les tokens depuis le navigateur.
      },
    });
    if (error) {
      // Fallback lien si API indisponible
      const url =
        opts.channel === 'whatsapp'
          ? buildWhatsAppLink(phone, opts.message)
          : buildSmsLink(phone, opts.message);
      return {
        ok: false,
        mode: 'link',
        url,
        error: error.message || 'API indisponible — utilisez le lien',
      };
    }
    if (data?.ok) return { ok: true, mode: 'api' };
    const url =
      opts.channel === 'whatsapp'
        ? buildWhatsAppLink(phone, opts.message)
        : buildSmsLink(phone, opts.message);
    return {
      ok: false,
      mode: 'link',
      url,
      error: data?.error || 'Échec envoi API',
    };
  } catch (e: any) {
    const url =
      opts.channel === 'whatsapp'
        ? buildWhatsAppLink(phone, opts.message)
        : buildSmsLink(phone, opts.message);
    return { ok: false, mode: 'link', url, error: e?.message || 'Erreur réseau' };
  }
}

/** Templates messages location */
export const MessageTemplates = {
  orderCreated: (client: string, date: string, total: string, deposit: string) =>
    `Bonjour ${client},\nVotre commande de location est confirmée pour le ${date}.\nTotal : ${total}\nAcompte : ${deposit}\nMerci de votre confiance.`,
  orderDelivered: (client: string, date: string) =>
    `Bonjour ${client},\nVotre matériel a été livré le ${date}.\nBon événement !`,
  orderReturned: (client: string) =>
    `Bonjour ${client},\nNous confirmons le retour du matériel.\nMerci et à bientôt !`,
  thankYou: (client: string, business: string) =>
    `Merci ${client} pour votre confiance.\n— ${business || 'Votre partenaire location'}`,
  reminder: (client: string, date: string) =>
    `Bonjour ${client},\nRappel : livraison / événement prévu le ${date}.\nÀ très bientôt.`,
};
