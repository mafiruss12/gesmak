import { Printer, Share2, X } from 'lucide-react';
import { formatFCFA } from '@/lib/format';

export interface ReceiptLineItem {
  name: string;
  qty: number;
  unitPrice: number;
  note?: string | null;
}

export interface GesmakReceiptData {
  id: string;
  kind: 'boisson' | 'nourriture' | 'chambre' | 'mixte';
  establishmentName: string;
  establishmentPhone?: string | null;
  establishmentAddress?: string | null;
  tableOrRoomLabel?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
  serverName?: string | null;
  createdAt: string;
  status: string;
  paymentMethod?: string | null;
  paidAmount?: number | null;
  total: number;
  notes?: string | null;
  items: ReceiptLineItem[];
}

export function triggerReceiptPrint(): void {
  if (typeof document === 'undefined' || typeof window === 'undefined') return;
  document.body.classList.add('printing-gesmak-receipt');
  const cleanup = () => {
    document.body.classList.remove('printing-gesmak-receipt');
    window.removeEventListener('afterprint', cleanup);
  };
  window.addEventListener('afterprint', cleanup);
  setTimeout(() => {
    window.print();
    setTimeout(cleanup, 1200);
  }, 80);
}

export function formatReceiptText(r: GesmakReceiptData): string {
  const pmLabel = paymentLabel(r.paymentMethod);
  const lines = [
    `=== ${r.establishmentName.toUpperCase()} ===`,
    r.establishmentAddress ? r.establishmentAddress : '',
    r.establishmentPhone ? `Tél : ${r.establishmentPhone}` : '',
    `REÇU #${r.id.slice(0, 8).toUpperCase()} · ${kindLabel(r.kind)}`,
    `Date : ${new Date(r.createdAt).toLocaleString('fr-FR')}`,
    r.tableOrRoomLabel ? `Service : ${r.tableOrRoomLabel}` : '',
    r.customerName ? `Client : ${r.customerName}${r.customerPhone ? ` (${r.customerPhone})` : ''}` : '',
    r.serverName ? `Agent : ${r.serverName}` : '',
    '--------------------------------',
    ...r.items.map(
      (i) => `${i.qty}x ${i.name} — ${formatFCFA(i.qty * i.unitPrice)}`,
    ),
    '--------------------------------',
    `TOTAL : ${formatFCFA(r.total)}`,
    r.paidAmount && r.paidAmount > 0 ? `PAYÉ : ${formatFCFA(r.paidAmount)} (${pmLabel})` : `RÈGLEMENT : ${pmLabel}`,
    `STATUT : ${statusLabel(r.status)}`,
    r.notes ? `Note : ${r.notes}` : '',
    'Merci pour votre visite !',
  ].filter(Boolean);
  return lines.join('\n');
}

function kindLabel(k: GesmakReceiptData['kind']): string {
  if (k === 'boisson') return 'Boissons & Bar';
  if (k === 'nourriture') return 'Restauration';
  if (k === 'chambre') return 'Hébergement / Chambre';
  return 'Commande & Services';
}

function paymentLabel(pm?: string | null): string {
  if (!pm) return 'À régler';
  if (pm === 'cash') return 'Espèces';
  if (pm === 'wave') return 'Wave';
  if (pm === 'orange_money') return 'Orange Money';
  if (pm === 'mtn_money') return 'MTN MoMo';
  if (pm === 'mobile_money') return 'Mobile Money';
  if (pm === 'card') return 'Carte bancaire';
  if (pm === 'transfer') return 'Virement';
  return pm;
}

function statusLabel(st: string): string {
  if (st === 'served' || st === 'completed' || st === 'paid') return 'PAYÉ / LIVRÉ';
  if (st === 'ready') return 'PRÊT';
  if (st === 'preparing') return 'EN PRÉPARATION';
  if (st === 'confirmed') return 'CONFIRMÉ';
  if (st === 'cancelled') return 'ANNULÉ';
  return 'EN COURS';
}

export function ReceiptSheet({ receipt }: { receipt: GesmakReceiptData }) {
  const isPaid = receipt.status === 'served' || receipt.status === 'completed' || Boolean(receipt.paidAmount && receipt.paidAmount >= receipt.total);
  return (
    <div className="gesmak-receipt-sheet mx-auto w-full max-w-[360px] bg-white text-stone-900 rounded-2xl border border-stone-200 p-5 shadow-lg font-mono text-xs leading-relaxed">
      <div className="text-center border-b border-dashed border-stone-300 pb-3 mb-3">
        <p className="text-base font-extrabold tracking-wide text-stone-900 uppercase">
          {receipt.establishmentName}
        </p>
        {receipt.establishmentAddress && (
          <p className="text-[11px] text-stone-600 mt-0.5">{receipt.establishmentAddress}</p>
        )}
        {receipt.establishmentPhone && (
          <p className="text-[11px] text-stone-600">Tél : {receipt.establishmentPhone}</p>
        )}
        <p className="mt-2 text-[11px] font-bold tracking-wider uppercase text-stone-800">
          REÇU OFFICIEL · #{receipt.id.slice(0, 8).toUpperCase()}
        </p>
        <p className="text-[11px] text-stone-600">{kindLabel(receipt.kind)}</p>
      </div>

      <div className="space-y-1 border-b border-dashed border-stone-300 pb-3 mb-3 text-[11px]">
        <div className="flex justify-between gap-2">
          <span className="text-stone-500">Date :</span>
          <span className="font-semibold text-right">
            {new Date(receipt.createdAt).toLocaleString('fr-FR', {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
        </div>
        {receipt.tableOrRoomLabel && (
          <div className="flex justify-between gap-2">
            <span className="text-stone-500">Service :</span>
            <span className="font-bold text-right">{receipt.tableOrRoomLabel}</span>
          </div>
        )}
        {receipt.customerName && (
          <div className="flex justify-between gap-2">
            <span className="text-stone-500">Client :</span>
            <span className="font-semibold text-right">
              {receipt.customerName}
              {receipt.customerPhone ? ` · ${receipt.customerPhone}` : ''}
            </span>
          </div>
        )}
        {receipt.serverName && (
          <div className="flex justify-between gap-2">
            <span className="text-stone-500">Agent :</span>
            <span className="text-right">{receipt.serverName}</span>
          </div>
        )}
      </div>

      <div className="space-y-2 border-b border-dashed border-stone-300 pb-3 mb-3">
        {receipt.items.map((item, idx) => (
          <div key={`${item.name}-${idx}`} className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-stone-900">
                {item.qty} × {item.name}
              </p>
              <p className="text-[10px] text-stone-500 tabular-nums">
                {formatFCFA(item.unitPrice)} / u{item.note ? ` · ${item.note}` : ''}
              </p>
            </div>
            <p className="font-bold text-stone-900 tabular-nums shrink-0">
              {formatFCFA(item.qty * item.unitPrice)}
            </p>
          </div>
        ))}
      </div>

      <div className="space-y-1.5 border-b border-dashed border-stone-300 pb-3 mb-3">
        <div className="flex justify-between items-baseline text-sm font-extrabold">
          <span>TOTAL</span>
          <span className="tabular-nums">{formatFCFA(receipt.total)}</span>
        </div>
        <div className="flex justify-between text-[11px]">
          <span className="text-stone-500">Règlement :</span>
          <span className="font-semibold">{paymentLabel(receipt.paymentMethod)}</span>
        </div>
        {receipt.paidAmount != null && receipt.paidAmount > 0 && (
          <div className="flex justify-between text-[11px]">
            <span className="text-stone-500">Montant payé :</span>
            <span className="font-semibold tabular-nums">{formatFCFA(receipt.paidAmount)}</span>
          </div>
        )}
        <div className="flex justify-between text-[11px]">
          <span className="text-stone-500">Statut :</span>
          <span className={`font-extrabold ${isPaid ? 'text-emerald-700' : 'text-amber-700'}`}>
            {statusLabel(receipt.status)}
          </span>
        </div>
      </div>

      {receipt.notes && (
        <p className="text-[11px] text-stone-600 mb-3 break-words">Note : {receipt.notes}</p>
      )}

      <div className="text-center text-[11px] text-stone-500 space-y-0.5">
        <p className="font-semibold text-stone-800">Merci pour votre confiance !</p>
        <p>Ticket généré via GESMAK</p>
      </div>
    </div>
  );
}

export function ReceiptPrintModal({
  receipt,
  onClose,
}: {
  receipt: GesmakReceiptData | null;
  onClose: () => void;
}) {
  if (!receipt) return null;

  const shareText = async () => {
    const text = formatReceiptText(receipt);
    try {
      if (navigator.share) {
        await navigator.share({
          title: `Reçu ${receipt.establishmentName}`,
          text,
        });
        return;
      }
      await navigator.clipboard.writeText(text);
    } catch {
      // Fallback silencieux si partage annulé
    }
  };

  return (
    <div className="gesmak-receipt-print-root fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 overflow-y-auto print:static print:bg-white print:p-0">
      <div className="w-full max-w-md space-y-3 my-auto print:my-0 print:max-w-none">
        <div className="no-print flex items-center justify-between gap-2 bg-stone-900 text-white px-4 py-3 rounded-2xl border border-stone-800">
          <div className="min-w-0">
            <p className="text-sm font-bold truncate">Aperçu du reçu</p>
            <p className="text-xs text-stone-400">Impression thermique 80mm ou A4</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={shareText}
              className="p-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 min-h-[40px] min-w-[40px] inline-flex items-center justify-center"
              aria-label="Partager le reçu"
            >
              <Share2 size={16} />
            </button>
            <button
              type="button"
              onClick={triggerReceiptPrint}
              className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-stone-950 font-bold text-xs inline-flex items-center gap-1.5 min-h-[40px]"
            >
              <Printer size={15} /> Imprimer
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 min-h-[40px] min-w-[40px] inline-flex items-center justify-center"
              aria-label="Fermer"
            >
              <X size={16} />
            </button>
          </div>
        </div>
        <ReceiptSheet receipt={receipt} />
      </div>
    </div>
  );
}
