import { useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { isReportRequiredRole } from '@/lib/dailyReportGate';
import {
  notifyOwnerReportDelays,
  notifyStaffReportDelays,
} from '@/lib/reportDelayNotifications';

/**
 * Déclenche les notifications de retard (point journalier) une fois par session / jour.
 */
export default function ReportDelayNotifier() {
  const { member, activeEstablishment, effectiveRole } = useAuth();

  useEffect(() => {
    const role = String(effectiveRole || member?.role || '');
    const estId = activeEstablishment?.id || member?.establishment_id;
    const userId = member?.user_id;
    if (!estId || !userId) return;

    const estName = activeEstablishment?.name || 'Établissement';

    if (isReportRequiredRole(role)) {
      void notifyStaffReportDelays({
        userId,
        establishmentId: estId,
        establishmentName: estName,
        staffName: member?.full_name || member?.email || 'Équipe',
      });
    }

    if (['owner', 'admin', 'super_admin'].includes(role)) {
      void notifyOwnerReportDelays({
        ownerUserId: userId,
        establishmentId: estId,
        establishmentName: estName,
      });
    }
  }, [
    member?.user_id,
    member?.full_name,
    member?.email,
    activeEstablishment?.id,
    activeEstablishment?.name,
    member?.establishment_id,
    effectiveRole,
    member?.role,
  ]);

  return null;
}
