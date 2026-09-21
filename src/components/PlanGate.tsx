import type { ReactNode } from 'react';
import { Lock } from 'lucide-react';
import { usePlanAccess } from '@/lib/usePlanAccess';
import { paymentWhatsAppLink, type PlanFeature } from '@/lib/subscription';
import { useAuth } from '@/lib/auth';

export default function PlanGate({
  feature,
  label,
  children,
}: {
  feature: PlanFeature;
  label: string;
  children: ReactNode;
}) {
  const { allow, storedPlan, isTrialPro } = usePlanAccess();
  const { activeEstablishment } = useAuth();

  if (allow(feature)) return <>{children}</>;

  const wa = paymentWhatsAppLink(
    `Bonjour, je souhaite passer en Pro/Business pour débloquer : ${label}. Établissement : ${activeEstablishment?.name || ''}`,
  );

  return (
    <div className="max-w-md mx-auto mt-10 card border-amber-500/30 space-y-4 text-center p-6">
      <div className="mx-auto w-14 h-14 rounded-full bg-amber-500/15 flex items-center justify-center">
        <Lock className="text-amber-400" size={28} />
      </div>
      <h1 className="text-xl font-bold text-stone-100">Fonction réservée</h1>
      <p className="text-sm text-stone-400">
        <strong className="text-stone-200">{label}</strong> n’est pas inclus dans l’offre{' '}
        <strong className="text-amber-300">{storedPlan.label}</strong>
        {isTrialPro ? ' (hors essai)' : ''}.
      </p>
      <p className="text-xs text-stone-500">
        Passez en <strong>Pro</strong> (12 000 F/mois) ou <strong>Business</strong> (25 000 F/mois) pour y accéder.
      </p>
      <a href={wa} target="_blank" rel="noreferrer" className="btn-primary inline-flex justify-center w-full">
        Demander l’upgrade (WhatsApp)
      </a>
      <a href="/settings" className="text-sm text-amber-400 hover:underline block">
        Voir mon offre dans Paramètres
      </a>
    </div>
  );
}
