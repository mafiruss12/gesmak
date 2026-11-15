import { supabase } from '@/lib/supabase';
import { buildWhatsAppLink } from '@/lib/businessTypes';

export async function notifyTeam(
  establishmentId: string,
  title: string,
  message: string,
  link = '/rent/orders'
) {
  const { data: members } = await supabase
    .from('members')
    .select('user_id')
    .eq('establishment_id', establishmentId)
    .eq('status', 'active');
  if (!members?.length) return;
  await supabase.from('notifications').insert(
    members.map((m) => ({
      user_id: m.user_id,
      title,
      message,
      read: false,
      type: 'rental',
      link,
      action_label: 'Voir',
    }))
  );
}

export function clientWhatsAppUrl(
  phone: string | null | undefined,
  orderLabel: string,
  extra: string
) {
  if (!phone) return null;
  const msg = `Bonjour, concernant votre commande ${orderLabel}.\n${extra}\nMerci — Location événementielle`;
  return buildWhatsAppLink(phone, msg);
}
