import {
  formatMoney,
  materialIcon,
  DOC_TYPE_LABELS,
  DOC_STATUS_LABELS,
  type BtpBranding,
  type BtpDocType,
  type BtpDocStatus,
} from './btp';

type Company = {
  name?: string;
  address?: string;
  phone?: string;
  logo_url?: string;
};

function esc(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function buildBtpPrintHtml(
  doc: any,
  items: any[],
  company: Company,
  branding: BtpBranding,
): string {
  const typeLabel = DOC_TYPE_LABELS[doc.type as BtpDocType] || doc.type || 'Document';
  const statusLabel = DOC_STATUS_LABELS[doc.status as BtpDocStatus] || doc.status || '';

  const rows = (items || [])
    .map((it: any) => {
      if (it.item_type === 'section') {
        return `<tr class="sec"><td colspan="5">${esc(it.title || 'Section')}</td></tr>`;
      }
      const qty = Number(it.quantity) ? String(it.quantity) : '—';
      const pu = Number(it.unit_price) ? formatMoney(Number(it.unit_price)) : '—';
      const lineTot = Number(it.total_ht) || Number(it.quantity) * Number(it.unit_price) || 0;
      const tot = lineTot ? formatMoney(lineTot) : '—';
      const unit = it.unit ? ` <span class="u">(${esc(it.unit)})</span>` : '';
      return `<tr>
        <td class="ico">${materialIcon(it.title || '')}</td>
        <td>${esc(it.title || '—')}${unit}</td>
        <td class="r">${esc(qty)}</td>
        <td class="r">${esc(pu)}</td>
        <td class="r b">${esc(tot)}</td>
      </tr>`;
    })
    .join('');

  const logo = company.logo_url
    ? `<img class="logo" src="${esc(company.logo_url)}" alt="" crossorigin="anonymous" />`
    : `<div class="logo-ph">${esc((company.name || 'B').slice(0, 1))}</div>`;

  const legalBits = [
    branding.rccm && `RCCM ${branding.rccm}`,
    branding.nif && `NIF ${branding.nif}`,
    branding.tva_number && `TVA ${branding.tva_number}`,
  ]
    .filter(Boolean)
    .join(' · ');

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${esc(typeLabel)} ${esc(doc.doc_number || '')}</title>
<style>
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: #ffffff !important; color: #1c1917 !important; }
  body { font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; padding: 20px; }
  .sheet { max-width: 800px; margin: 0 auto; background: #fff; color: #1c1917; }
  header { display: flex; gap: 16px; border-bottom: 2px solid #0284c7; padding-bottom: 14px; margin-bottom: 18px; align-items: flex-start; }
  .logo { height: 64px; width: 64px; object-fit: contain; border-radius: 8px; }
  .logo-ph { height: 64px; width: 64px; border-radius: 12px; background: linear-gradient(135deg,#0ea5e9,#1d4ed8); color:#fff; font-weight:800; font-size:24px; display:flex; align-items:center; justify-content:center; flex-shrink: 0; }
  h1 { margin: 0; font-size: 20px; color: #0c4a6e; }
  .muted { color: #57534e; font-size: 12px; margin: 2px 0; }
  .right { text-align: right; margin-left: auto; flex-shrink: 0; }
  .badge { font-size: 16px; font-weight: 800; color: #0369a1; text-transform: uppercase; margin: 0; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px; }
  .box { background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 12px; padding: 10px; font-size: 13px; color: #1c1917; }
  .box.g { background: #fafaf9; border-color: #e7e5e4; }
  .lab { font-size: 10px; text-transform: uppercase; color: #0369a1; font-weight: 700; margin-bottom: 4px; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 16px; color: #1c1917; }
  thead th { background: #0369a1; color: #fff; padding: 8px 10px; text-align: left; }
  thead th.r, td.r { text-align: right; }
  tbody td { padding: 8px 10px; border-bottom: 1px solid #e7e5e4; color: #1c1917; }
  tr.sec td { background: #e0f2fe; font-weight: 700; color: #0c4a6e; }
  .ico { width: 28px; text-align: center; font-size: 16px; }
  .u { color: #78716c; font-size: 11px; }
  .b { font-weight: 700; }
  .totals { width: 260px; margin-left: auto; border: 2px solid #0284c7; background: #f0f9ff; border-radius: 12px; padding: 12px; font-size: 13px; color: #1c1917; }
  .totals .row { display: flex; justify-content: space-between; margin: 4px 0; color: #44403c; }
  .totals .grand { border-top: 1px solid #bae6fd; padding-top: 8px; margin-top: 6px; font-weight: 800; font-size: 15px; color: #0c4a6e; }
  footer { border-top: 1px solid #d6d3d1; margin-top: 18px; padding-top: 12px; display: flex; justify-content: space-between; align-items: flex-end; gap: 12px; font-size: 10px; color: #78716c; }
  .stamp { height: 64px; object-fit: contain; }
  .toolbar { margin-bottom: 16px; display: flex; gap: 8px; flex-wrap: wrap; }
  .toolbar button { font-size: 14px; padding: 10px 16px; border-radius: 10px; border: none; cursor: pointer; font-weight: 600; }
  .btn-print { background: #0284c7; color: #fff; }
  .btn-close { background: #e7e5e4; color: #1c1917; }
  @media print {
    body { padding: 0; }
    .toolbar { display: none !important; }
    .sheet { max-width: none; }
  }
</style>
</head>
<body>
  <div class="toolbar">
    <button class="btn-print" onclick="window.print()">Imprimer / enregistrer PDF</button>
    <button class="btn-close" onclick="window.close()">Fermer</button>
  </div>
  <div class="sheet">
  <header>
    ${logo}
    <div>
      <h1>${esc(company.name || 'Entreprise')}</h1>
      ${branding.activity ? `<p class="muted">${esc(branding.activity)}</p>` : ''}
      ${branding.slogan ? `<p class="muted"><em>${esc(branding.slogan)}</em></p>` : ''}
      ${branding.header_note ? `<p class="muted">${esc(branding.header_note)}</p>` : ''}
      <p class="muted">${esc([company.address, branding.city, branding.country].filter(Boolean).join(', '))}</p>
      <p class="muted">${esc([company.phone, branding.email, branding.website].filter(Boolean).join(' · '))}</p>
      ${legalBits ? `<p class="muted">${esc(legalBits)}</p>` : ''}
    </div>
    <div class="right">
      <p class="badge">${esc(typeLabel)}</p>
      <p style="font-weight:700;margin:4px 0;color:#1c1917">${esc(doc.doc_number || '')}</p>
      <p class="muted">Date : ${esc(doc.date || '')}</p>
      ${doc.validity_date ? `<p class="muted">Validité : ${esc(doc.validity_date)}</p>` : ''}
    </div>
  </header>

  <div class="grid">
    <div class="box">
      <div class="lab">Client</div>
      <div style="font-weight:700">${esc(doc.client_name || '—')}</div>
      ${doc.client_phone ? `<div class="muted">${esc(doc.client_phone)}</div>` : ''}
      ${doc.site_location ? `<div class="muted">📍 ${esc(doc.site_location)}</div>` : ''}
    </div>
    <div class="box g">
      <div class="lab">Objet</div>
      <div style="font-weight:600">${esc(doc.title || '—')}</div>
      <div class="muted">${esc(statusLabel)}</div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th></th>
        <th>Désignation</th>
        <th class="r">Qté</th>
        <th class="r">Prix unitaire</th>
        <th class="r">Prix total</th>
      </tr>
    </thead>
    <tbody>${rows || '<tr><td colspan="5" style="text-align:center;color:#78716c;padding:16px">Aucune ligne</td></tr>'}</tbody>
  </table>

  <div class="totals">
    <div class="row"><span>Total HT</span><span>${esc(formatMoney(Number(doc.total_ht) || 0))}</span></div>
    ${Number(doc.total_tax) > 0 ? `<div class="row"><span>TVA</span><span>${esc(formatMoney(Number(doc.total_tax)))}</span></div>` : ''}
    <div class="row grand"><span>Total général</span><span>${esc(formatMoney(Number(doc.total_ttc) || 0))}</span></div>
    ${Number(doc.advance_amount) > 0 ? `<div class="row"><span>Acompte</span><span>${esc(formatMoney(Number(doc.advance_amount)))}</span></div>` : ''}
    ${Number(doc.balance_due) > 0 ? `<div class="row"><span>Reste dû</span><span>${esc(formatMoney(Number(doc.balance_due)))}</span></div>` : ''}
  </div>

  ${(doc.payment_terms || branding.payment_terms_default) ? `<p class="muted" style="margin-top:14px"><strong>Paiement :</strong> ${esc(doc.payment_terms || branding.payment_terms_default)}</p>` : ''}
  ${doc.notes ? `<p class="muted"><strong>Notes :</strong> ${esc(doc.notes)}</p>` : ''}
  ${branding.legal_notice ? `<p class="muted">${esc(branding.legal_notice)}</p>` : ''}

  ${(branding.mobile_money || branding.bank_name || branding.iban) ? `
  <div class="box g" style="margin-top:12px">
    <div class="lab">Règlement</div>
    ${branding.mobile_money ? `<div>📱 Mobile Money : ${esc(branding.mobile_money)}</div>` : ''}
    ${branding.bank_name ? `<div>🏦 Banque : ${esc(branding.bank_name)}</div>` : ''}
    ${branding.iban ? `<div>Compte : ${esc(branding.iban)}</div>` : ''}
  </div>` : ''}

  <footer>
    <div>
      <div>${esc(branding.footer_text || 'Merci de votre confiance.')}</div>
      <div>${esc(company.name || '')} · ${esc([company.phone, branding.email].filter(Boolean).join(' · '))}</div>
    </div>
    ${branding.stamp_url ? `<img class="stamp" src="${esc(branding.stamp_url)}" alt="Cachet"/>` : ''}
  </footer>
  </div>
</body>
</html>`;
}

/** Ouvre une page isolée avec le devis uniquement (pas l’interface KTP) */
export function printBtpDocument(
  doc: any,
  items: any[],
  company: Company,
  branding: BtpBranding,
): void {
  const html = buildBtpPrintHtml(doc, items || [], company || {}, branding || {});
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const w = window.open(url, '_blank');
  if (!w) {
    // Popup bloquée : télécharger le HTML ou imprimer dans un iframe
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    iframe.src = url;
    document.body.appendChild(iframe);
    iframe.onload = () => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } catch {
        // last resort: navigate
        window.location.href = url;
      }
      setTimeout(() => {
        document.body.removeChild(iframe);
        URL.revokeObjectURL(url);
      }, 60_000);
    };
    return;
  }
  // Laisser le temps au blob de charger, puis révoquer plus tard
  setTimeout(() => URL.revokeObjectURL(url), 120_000);
}
