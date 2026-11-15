import { sendWhatsAppCloud } from '@/lib/whatsappCloud';
import { supabase } from '@/lib/supabase';
import { openWhatsApp } from '@/lib/integrations';

export type OwnerContacts = {
  owner_user_id: string | null;
  owner_email: string | null;
  owner_phone: string | null;
  name: string;
};

export async function getOwnerContacts(establishmentId: string): Promise<OwnerContacts | null> {
  const { data: est } = await supabase
    .from('establishments')
    .select('id, name, owner_email, owner_phone, owner_user_id, created_by, phone')
    .eq('id', establishmentId)
    .maybeSingle();
  if (!est) return null;
  let ownerUserId = est.owner_user_id || est.created_by || null;
  let ownerEmail = est.owner_email || null;
  let ownerPhone = est.owner_phone || est.phone || null;
  if (!ownerUserId) {
    const { data: own } = await supabase
      .from('members')
      .select('user_id, email')
      .eq('establishment_id', establishmentId)
      .in('role', ['owner', 'admin', 'super_admin'])
      .eq('status', 'active')
      .limit(1)
      .maybeSingle();
    if (own) {
      ownerUserId = own.user_id;
      ownerEmail = ownerEmail || own.email;
    }
  }
  if (ownerUserId && !ownerEmail) {
    const { data: m } = await supabase.from('members').select('email').eq('user_id', ownerUserId).maybeSingle();
    if (m?.email) ownerEmail = m.email;
  }
  return { owner_user_id: ownerUserId, owner_email: ownerEmail, owner_phone: ownerPhone, name: est.name };
}

export async function notifyOwnerOnReport(opts: {
  establishmentId: string;
  senderName: string;
  senderRole: string;
  reportSummary: string;
  reportDate: string;
}): Promise<{ app: boolean; mail: boolean; whatsapp: boolean; owner: OwnerContacts | null }> {
  const owner = await getOwnerContacts(opts.establishmentId);
  const result = { app: false, mail: false, whatsapp: false, owner };
  const title = `Rapport journalier — ${opts.reportDate}`;
  const body = `${opts.senderName} (${opts.senderRole}) a envoyé le rapport de clôture.\n\n${opts.reportSummary}`;
  if (owner?.owner_user_id) {
    const { error } = await supabase.from('notifications').insert({
      user_id: owner.owner_user_id,
      title,
      body,
      message: body,
      type: 'report',
      link: `/daily-report?date=${opts.reportDate}`,
      read: false,
      action_label: 'Ouvrir le rapport',
    });
    result.app = !error;
    await supabase.from('report_notifications').insert({
      establishment_id: opts.establishmentId,
      owner_id: owner.owner_user_id,
      channels: ['app'],
      message: body,
    });
  }
  if (owner?.owner_email) {
    const subject = encodeURIComponent(title);
    const text = encodeURIComponent(body + '\n\nGESMAK');
    (window as any).__ownerMailHref = `mailto:${owner.owner_email}?subject=${subject}&body=${text}`;
    result.mail = true;
  }
  if (owner?.owner_phone) {
    (window as any).__ownerWaPhone = owner.owner_phone;
    (window as any).__ownerWaMsg = `*${owner.name}* — Rapport journalier\nDate : ${opts.reportDate}\nDe : ${opts.senderName} (${opts.senderRole})\n\n${opts.reportSummary}\n\nGESMAK`;
    result.whatsapp = true;
  }
  return result;
}

export function openOwnerMail() {
  const href = (window as any).__ownerMailHref as string | undefined;
  if (href) window.location.href = href;
}

export function openOwnerWhatsApp() {
  const phone = (window as any).__ownerWaPhone as string | undefined;
  const msg = (window as any).__ownerWaMsg as string | undefined;
  if (phone && msg) openWhatsApp(phone, msg);
}


/** Ouvre WhatsApp propriétaire uniquement (pas de mailto / e-mail) */
export function openOwnerChannelsAfterReport() {
  try {
    openOwnerWhatsApp();
  } catch { /* */ }
}
