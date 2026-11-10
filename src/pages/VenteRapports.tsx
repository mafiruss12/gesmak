import { useMemo, useState } from 'react';
import { CalendarDays, FileDown, Printer, BarChart3 } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { formatFCFA } from '@/lib/format';
import { loadTicketsInRange, listLiveDayDates, type LiveSaleTicket } from '@/lib/liveDaySales';

type Period = 'jour' | 'semaine' | 'mois' | 'annee' | 'perso';

function toYMD(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function startOfWeek(d: Date) {
  const x = new Date(d);
  const day = (x.getDay() + 6) % 7; // lundi = 0
  x.setDate(x.getDate() - day);
  return x;
}

function rangeFor(period: Period, anchor: string, from: string, to: string): { from: string; to: string; label: string } {
  const base = new Date(anchor + 'T12:00:00');
  if (Number.isNaN(base.getTime())) {
    const t = toYMD(new Date());
    return { from: t, to: t, label: 'Aujourd’hui' };
  }
  if (period === 'jour') {
    const y = toYMD(base);
    return { from: y, to: y, label: `Jour ${y}` };
  }
  if (period === 'semaine') {
    const s = startOfWeek(base);
    const e = new Date(s);
    e.setDate(s.getDate() + 6);
    return { from: toYMD(s), to: toYMD(e), label: `Semaine ${toYMD(s)} → ${toYMD(e)}` };
  }
  if (period === 'mois') {
    const s = new Date(base.getFullYear(), base.getMonth(), 1);
    const e = new Date(base.getFullYear(), base.getMonth() + 1, 0);
    return { from: toYMD(s), to: toYMD(e), label: `Mois ${s.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}` };
  }
  if (period === 'annee') {
    const s = new Date(base.getFullYear(), 0, 1);
    const e = new Date(base.getFullYear(), 11, 31);
    return { from: toYMD(s), to: toYMD(e), label: `Année ${base.getFullYear()}` };
  }
  return { from, to, label: `Du ${from} au ${to}` };
}

function formatWhen(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { date: '—', time: '—' };
  const date = d.toLocaleDateString('fr-FR', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return { date, time: `${hh}:${mm}:${ss}` };
}

export default function VenteRapports() {
  const { activeEstablishment } = useAuth();
  const estId = activeEstablishment?.id || '';
  const today = toYMD(new Date());
  const [period, setPeriod] = useState<Period>('jour');
  const [anchor, setAnchor] = useState(today);
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);

  const range = useMemo(() => rangeFor(period, anchor, from, to), [period, anchor, from, to]);
  const tickets = useMemo(
    () => (estId ? loadTicketsInRange(estId, range.from, range.to) : []),
    [estId, range.from, range.to],
  );
  const daysWithData = useMemo(() => (estId ? listLiveDayDates(estId) : []), [estId, tickets.length]);

  const stats = useMemo(() => {
    let ca = 0;
    let cost = 0;
    let lines = 0;
    const byProduct: Record<string, { name: string; qty: number; ca: number }> = {};
    for (const tk of tickets) {
      ca += Number(tk.total) || 0;
      for (const l of tk.lines) {
        lines += Number(l.qty) || 0;
        cost += (Number(l.cost) || 0) * (Number(l.qty) || 0);
        const k = l.product_id || l.name;
        if (!byProduct[k]) byProduct[k] = { name: l.name, qty: 0, ca: 0 };
        byProduct[k].qty += Number(l.qty) || 0;
        byProduct[k].ca += (Number(l.price) || 0) * (Number(l.qty) || 0);
      }
    }
    return {
      ca,
      cost,
      margin: ca - cost,
      sales: tickets.length,
      lines,
      top: Object.values(byProduct).sort((a, b) => b.qty - a.qty).slice(0, 12),
    };
  }, [tickets]);

  function printPdf() {
    const rows = tickets
      .map((tk) => {
        const { date, time } = formatWhen(tk.at);
        const pay = tk.pay === 'cash' ? 'Espèces' : tk.pay === 'mobile' ? 'Mobile' : 'Mixte';
        const lines = tk.lines
          .map(
            (l) =>
              `<tr><td>${date}</td><td>${time}</td><td>${l.name}</td><td>${l.category || '—'}</td><td style="text-align:center">${l.qty}</td><td style="text-align:right">${formatFCFA(l.price)}</td><td style="text-align:right">${formatFCFA(l.cost || 0)}</td><td style="text-align:right">${formatFCFA((l.price || 0) * (l.qty || 0))}</td><td>${pay}</td></tr>`,
          )
          .join('');
        return lines;
      })
      .join('');
    const w = window.open('', '_blank', 'width=900,height=720');
    if (!w) return;
    w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Rapport GESMAK</title>
<style>
  @page { margin: 14mm; }
  body{font-family:system-ui,sans-serif;color:#111;padding:12px}
  h1{font-size:20px;margin:0 0 4px;background:linear-gradient(90deg,#f97316,#fbbf24);-webkit-background-clip:text;color:transparent}
  .meta{color:#555;font-size:12px;margin-bottom:14px}
  .cards{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:14px}
  .card{border:1px solid #e5e7eb;border-radius:12px;padding:10px 14px;min-width:120px}
  .card b{display:block;font-size:16px;color:#ea580c}
  table{width:100%;border-collapse:collapse;font-size:11px}
  th,td{border-bottom:1px solid #eee;padding:6px 4px;text-align:left}
  th{background:#fff7ed;color:#9a3412;font-size:10px;text-transform:uppercase}
  .foot{margin-top:16px;font-size:11px;color:#666}
  @media print{ .noprint{display:none} }
</style></head><body>
<h1>GESMAK — Rapport de ventes</h1>
<p class="meta">${activeEstablishment?.name || 'Établissement'} · ${range.label} · Généré le ${new Date().toLocaleString('fr-FR')}</p>
<div class="cards">
  <div class="card">CA<br/><b>${formatFCFA(stats.ca)}</b></div>
  <div class="card">Achats<br/><b>${formatFCFA(stats.cost)}</b></div>
  <div class="card">Marge<br/><b>${formatFCFA(stats.margin)}</b></div>
  <div class="card">Ventes<br/><b>${stats.sales}</b></div>
  <div class="card">Articles<br/><b>${stats.lines}</b></div>
</div>
<table>
<thead><tr><th>Date</th><th>Heure</th><th>Boisson</th><th>Type</th><th>Qté</th><th>P.vente</th><th>P.achat</th><th>Total</th><th>Paiement</th></tr></thead>
<tbody>${rows || '<tr><td colspan="9">Aucune vente sur la période</td></tr>'}</tbody>
</table>
<p class="foot">Rapport GESMAK · ne pas modifier manuellement</p>
<script>window.onload=()=>setTimeout(()=>window.print(),400)</script>
</body></html>`);
    w.document.close();
  }

  const periods: { id: Period; label: string }[] = [
    { id: 'jour', label: 'Journalier' },
    { id: 'semaine', label: 'Hebdo' },
    { id: 'mois', label: 'Mois' },
    { id: 'annee', label: 'Année' },
    { id: 'perso', label: 'Période' },
  ];

  return (
    <div className="space-y-4 rapport-motion">
      <div className="rounded-2xl border border-orange-500/30 bg-gradient-to-br from-orange-500/10 via-stone-900 to-stone-950 p-4 space-y-3">
        <div className="flex items-center gap-2">
          <BarChart3 className="text-orange-400" size={22} />
          <div>
            <h2 className="text-lg font-bold text-stone-100">Rapports de ventes</h2>
            <p className="text-xs text-stone-400">Journalier · hebdo · mois · année · période libre · PDF</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {periods.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setPeriod(p.id)}
              className={`px-3 py-2 rounded-xl text-xs font-bold border transition ${
                period === p.id
                  ? 'bg-orange-500 text-white border-orange-400 shadow-lg shadow-orange-500/20'
                  : 'bg-stone-900 text-stone-400 border-stone-700'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {period !== 'perso' ? (
          <label className="block text-xs text-stone-400">
            <span className="flex items-center gap-1 mb-1 font-semibold text-stone-300">
              <CalendarDays size={14} /> Calendrier (date de référence)
            </span>
            <input
              type="date"
              className="input-field max-w-xs"
              value={anchor}
              onChange={(e) => setAnchor(e.target.value)}
            />
          </label>
        ) : (
          <div className="grid grid-cols-2 gap-2 max-w-md">
            <label className="text-xs text-stone-400">
              Du
              <input type="date" className="input-field mt-1" value={from} onChange={(e) => setFrom(e.target.value)} />
            </label>
            <label className="text-xs text-stone-400">
              Au
              <input type="date" className="input-field mt-1" value={to} onChange={(e) => setTo(e.target.value)} />
            </label>
          </div>
        )}

        <p className="text-sm text-amber-200/90 font-medium">{range.label}</p>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {[
            ['CA', formatFCFA(stats.ca)],
            ['Achats', formatFCFA(stats.cost)],
            ['Marge', formatFCFA(stats.margin)],
            ['Ventes', String(stats.sales)],
            ['Articles', String(stats.lines)],
          ].map(([k, v]) => (
            <div key={k} className="rounded-xl bg-stone-950/80 border border-stone-800 px-3 py-2 rapport-card-pop">
              <p className="text-[10px] uppercase text-stone-500 font-bold">{k}</p>
              <p className="text-sm font-black text-orange-300">{v}</p>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={printPdf} className="btn-primary flex items-center gap-2 text-sm min-h-[44px]">
            <Printer size={16} /> Imprimer / PDF
          </button>
          <button
            type="button"
            onClick={printPdf}
            className="btn-secondary flex items-center gap-2 text-sm min-h-[44px]"
          >
            <FileDown size={16} /> Exporter le rapport
          </button>
        </div>
      </div>

      {daysWithData.length > 0 && (
        <div className="text-xs text-stone-500">
          Jours avec ventes enregistrées :{' '}
          <span className="text-stone-300">{daysWithData.slice(-14).join(' · ')}</span>
        </div>
      )}

      <div className="rounded-2xl border border-stone-800 overflow-hidden">
        <div className="px-3 py-2 bg-stone-900/80 border-b border-stone-800 text-xs font-bold text-stone-300 uppercase tracking-wide">
          Détail des ventes ({tickets.length})
        </div>
        {tickets.length === 0 ? (
          <p className="p-6 text-sm text-stone-500 text-center">Aucune vente sur cette période.</p>
        ) : (
          <div className="overflow-x-auto max-h-[55vh]">
            <table className="w-full text-xs text-left">
              <thead className="sticky top-0 bg-stone-950 text-stone-500">
                <tr>
                  <th className="px-3 py-2">Date</th>
                  <th className="px-2 py-2">Heure</th>
                  <th className="px-2 py-2">Boisson</th>
                  <th className="px-2 py-2">Type</th>
                  <th className="px-2 py-2 text-center">Qté</th>
                  <th className="px-2 py-2 text-right">P.vente</th>
                  <th className="px-2 py-2 text-right">P.achat</th>
                  <th className="px-3 py-2 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {tickets.flatMap((tk: LiveSaleTicket) => {
                  const { date, time } = formatWhen(tk.at);
                  return tk.lines.map((l, i) => (
                    <tr key={`${tk.id}-${i}`} className="border-t border-stone-800/80 text-stone-200">
                      <td className="px-3 py-2 whitespace-nowrap">{date}</td>
                      <td className="px-2 py-2 font-mono text-amber-300 whitespace-nowrap">{time}</td>
                      <td className="px-2 py-2 font-medium">{l.name}</td>
                      <td className="px-2 py-2 text-stone-400">{l.category || '—'}</td>
                      <td className="px-2 py-2 text-center font-bold">{l.qty}</td>
                      <td className="px-2 py-2 text-right font-mono">{formatFCFA(l.price)}</td>
                      <td className="px-2 py-2 text-right font-mono text-stone-400">{formatFCFA(l.cost || 0)}</td>
                      <td className="px-3 py-2 text-right font-mono text-amber-300 font-semibold">
                        {formatFCFA((l.price || 0) * (l.qty || 0))}
                      </td>
                    </tr>
                  ));
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <style
        dangerouslySetInnerHTML={{
          __html: `
        .rapport-motion { animation: rapportIn .45s ease both; }
        .rapport-card-pop { animation: rapportCard .5s ease both; }
        .rapport-card-pop:nth-child(2) { animation-delay: .05s; }
        .rapport-card-pop:nth-child(3) { animation-delay: .1s; }
        .rapport-card-pop:nth-child(4) { animation-delay: .15s; }
        .rapport-card-pop:nth-child(5) { animation-delay: .2s; }
        @keyframes rapportIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: none; }
        }
        @keyframes rapportCard {
          from { opacity: 0; transform: scale(.94); }
          to { opacity: 1; transform: none; }
        }
      `,
        }}
      />
    </div>
  );
}
