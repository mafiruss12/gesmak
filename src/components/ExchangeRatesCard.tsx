import { useEffect, useState } from 'react';
import { RefreshCw, DollarSign } from 'lucide-react';
import { fetchXofRates, type RateSnapshot } from '@/lib/exchangeRates';

/** Taux XOF — API Vault Currency-api (gratuit) */
export default function ExchangeRatesCard() {
  const [rates, setRates] = useState<RateSnapshot | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const r = await fetchXofRates();
    setRates(r);
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, []);

  const fmt = (n: number | null) =>
    n == null ? '—' : n.toLocaleString('fr-FR', { maximumFractionDigits: 0 });

  return (
    <div className="rounded-2xl border border-amber-500/25 bg-stone-900/60 p-4 theme-card-light">
      <div className="flex items-center justify-between gap-2 mb-3">
        <h3 className="text-sm font-semibold text-stone-100 flex items-center gap-2">
          <DollarSign size={16} className="text-amber-400" />
          Taux du jour (XOF)
        </h3>
        <button
          type="button"
          onClick={() => void load()}
          className="p-1.5 rounded-lg text-stone-400 hover:text-amber-300 hover:bg-amber-500/10"
          title="Actualiser"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>
      {loading && !rates ? (
        <p className="text-xs text-stone-500">Chargement…</p>
      ) : (
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="rounded-xl bg-stone-950/40 border border-stone-800 px-3 py-2">
            <p className="text-[10px] uppercase text-stone-500">1 USD</p>
            <p className="font-semibold text-amber-200">{fmt(rates?.xofPerUsd)} F</p>
          </div>
          <div className="rounded-xl bg-stone-950/40 border border-stone-800 px-3 py-2">
            <p className="text-[10px] uppercase text-stone-500">1 EUR</p>
            <p className="font-semibold text-amber-200">{fmt(rates?.xofPerEur)} F</p>
          </div>
        </div>
      )}
      <p className="text-[10px] text-stone-500 mt-2">
        Source API Vault · Currency-api (gratuit, sans clé)
      </p>
    </div>
  );
}
