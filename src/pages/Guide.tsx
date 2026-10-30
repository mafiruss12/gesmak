import StartupGuide from '@/components/StartupGuide';
import { Link } from 'react-router-dom';
import { ArrowLeft, BookOpen } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import {
  normalizeBusinessType,
  BUSINESS_LABELS,
  BUSINESS_THEMES,
} from '@/lib/businessTypes';

export default function GuidePage() {
  const { activeEstablishment } = useAuth();
  const bizType = normalizeBusinessType(activeEstablishment?.type);
  const theme = BUSINESS_THEMES[bizType];

  return (
    <div className="max-w-2xl mx-auto pb-16">
      <Link
        to="/dashboard"
        className="inline-flex items-center gap-1 text-sm text-stone-400 hover:text-stone-200 mb-4"
      >
        <ArrowLeft size={16} /> Accueil
      </Link>

      <div className="mb-6">
        <p className="text-xs font-medium uppercase tracking-wide" style={{ color: theme.primary }}>
          Aide · {BUSINESS_LABELS[bizType]}
        </p>
        <h1 className="text-2xl font-bold text-stone-100 flex items-center gap-2 mt-0.5">
          <BookOpen size={24} style={{ color: theme.primary }} />
          Guide de démarrage
        </h1>
        <p className="text-sm text-stone-400 mt-1">
          Suivez ces étapes pour configurer et utiliser GESMAK au quotidien.
        </p>
      </div>

      <StartupGuide compact={false} />

      <div className="mt-8 rounded-2xl border border-stone-800 bg-stone-900/50 p-5 space-y-3">
        <h2 className="font-semibold text-stone-100">Astuces quotidiennes</h2>
        <ul className="space-y-2 text-sm text-stone-400">
          <li>• Commencez par la <strong className="text-stone-300">caisse</strong> et le <strong className="text-stone-300">stock</strong> ; finissez par le <strong className="text-stone-300">rapport du jour</strong>.</li>
          <li>• Enregistrer les ventes <strong className="text-stone-300">en temps réel</strong> via la caisse, ou faire un <strong className="text-stone-300">point manuel</strong> en fin de service.</li>
          <li>• Surveiller les filtres stock : <span className="text-red-400">Épuisé</span> / <span className="text-amber-400">Presque</span> / <span className="text-emerald-400">Normal</span>.</li>
          <li>• Clôturer le soir (Clôture Z) pour figer le rapport du jour.</li>
        </ul>
      </div>
    </div>
  );
}
