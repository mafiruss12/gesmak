import { useEffect, useState } from 'react';
import { Download, X, RefreshCw } from 'lucide-react';
import {
  APP_VERSION,
  fetchLatestRelease,
  fetchRemoteWebVersion,
  forceAppUpdate,
  isNewerVersion,
  type LatestRelease,
} from '@/lib/appVersion';

const DISMISS_KEY = 'maquis_update_dismissed';

export default function UpdateBanner() {
  const [release, setRelease] = useState<LatestRelease | null>(null);
  const [webNotes, setWebNotes] = useState<string>('');
  const [webNewer, setWebNewer] = useState(false);
  const [visible, setVisible] = useState(false);
  const [checking, setChecking] = useState(false);
  const [updating, setUpdating] = useState(false);

  async function check(force = false) {
    setChecking(true);
    try {
      const [latest, remote] = await Promise.all([fetchLatestRelease(), fetchRemoteWebVersion()]);

      let show = false;
      if (latest?.tag && isNewerVersion(latest.tag, APP_VERSION)) {
        const dismissed = sessionStorage.getItem(DISMISS_KEY);
        if (force || dismissed !== latest.tag) {
          setRelease(latest);
          show = true;
        }
      } else {
        setRelease(null);
      }

      if (remote?.version && isNewerVersion(remote.version, APP_VERSION)) {
        setWebNewer(true);
        setWebNotes(remote.notes || '');
        show = true;
      } else if (remote?.version) {
        // Même version distante : on peut quand même proposer un refresh discret seulement si force
        setWebNewer(false);
      }

      setVisible(show || force);
      if (force && !show) {
        // Pas de nouvelle version : propose quand même de rafraîchir le contenu
        setVisible(true);
        setWebNewer(true);
        setWebNotes('Rafraîchir le contenu et vider le cache local.');
      }
    } finally {
      setChecking(false);
    }
  }

  useEffect(() => {
    check();
    const t = setInterval(() => check(), 1000 * 60 * 30);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function dismiss() {
    if (release) sessionStorage.setItem(DISMISS_KEY, release.tag);
    setVisible(false);
  }

  async function applyWebUpdate() {
    setUpdating(true);
    await forceAppUpdate();
  }

  function downloadApk() {
    const url = release?.apkUrl || release?.htmlUrl;
    if (url) window.open(url, '_blank', 'noopener,noreferrer');
  }

  if (!visible) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-[60] max-w-lg mx-auto">
      <div className="rounded-2xl border border-amber-500/40 bg-stone-900/95 backdrop-blur shadow-2xl p-4 flex gap-3 items-start">
        <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center shrink-0">
          <RefreshCw className="text-amber-400" size={20} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-stone-100">Mise à jour</p>
          <p className="text-xs text-stone-400 mt-0.5">
            Version installée : <span className="text-stone-200">v{APP_VERSION}</span>
            {release?.tag ? (
              <>
                {' '}
                → APK <span className="text-amber-300">v{release.tag}</span>
              </>
            ) : null}
          </p>
          {webNotes ? <p className="text-[11px] text-stone-500 mt-1">{webNotes}</p> : null}
          <div className="flex flex-wrap gap-2 mt-3">
            {(webNewer || !release) && (
              <button
                type="button"
                onClick={applyWebUpdate}
                disabled={updating}
                className="btn-primary text-xs py-2 px-3 flex items-center gap-1.5"
              >
                <RefreshCw size={14} className={updating ? 'animate-spin' : ''} />
                {updating ? 'Mise à jour…' : 'Mettre à jour'}
              </button>
            )}
            {release && (
              <button
                type="button"
                onClick={downloadApk}
                className="btn-secondary text-xs py-2 px-3 flex items-center gap-1.5"
              >
                <Download size={14} /> Télécharger APK
              </button>
            )}
            <button
              type="button"
              onClick={() => check(true)}
              className="btn-ghost text-xs py-2 px-2"
              disabled={checking}
            >
              <RefreshCw size={14} className={checking ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>
        <button type="button" onClick={dismiss} className="text-stone-500 hover:text-stone-300 p-1">
          <X size={18} />
        </button>
      </div>
    </div>
  );
}
