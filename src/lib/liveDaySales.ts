/**
 * Ventes au fil de l’eau — décrément stock à CHAQUE vente. Clôture = bilan uniquement.
 * Les tickets enregistrés sont verrouillés pour l’équipe ; seul le propriétaire peut annuler/modifier.
 */
export type LivePayMethod = 'cash' | 'mobile' | 'mixed';

export type LiveSaleLine = {
  product_id: string;
  name: string;
  /** Type / catégorie (ex. bière, eau, soda) */
  category?: string;
  price: number;
  /** Prix d'achat unitaire */
  cost: number;
  qty: number;
};

export type LiveSaleTicket = {
  id: string;
  at: string; // ISO
  lines: LiveSaleLine[];
  total: number;
  pay: LivePayMethod;
  note?: string;
  /** id commande / source externe pour éviter les doublons */
  external_id?: string;
  /** Verrouillé dès l’enregistrement — non modifiable sauf propriétaire */
  locked?: boolean;
  /** Stock déjà décrémenté à la vente (ex. caisse POS) */
  stock_applied?: boolean;
  voided?: boolean;
  voided_at?: string;
  voided_by?: string;
};

export type LiveActivity = {
  id: string;
  at: string;
  type: 'sale' | 'void' | 'edit' | 'close' | 'open';
  message: string;
  by?: string;
  ticket_id?: string;
};

export type LiveDayState = {
  establishment_id: string;
  date: string; // YYYY-MM-DD
  tickets: LiveSaleTicket[];
  activity?: LiveActivity[];
  closed_at?: string | null;
  stock_deducted?: boolean;
};

function key(estId: string, date: string) {
  return `mm_live_sales:${estId}:${date}`;
}

function pushActivity(
  state: LiveDayState,
  type: LiveActivity['type'],
  message: string,
  by?: string,
  ticket_id?: string,
) {
  const entry: LiveActivity = {
    id: `a-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    at: new Date().toISOString(),
    type,
    message,
    by,
    ticket_id,
  };
  state.activity = [entry, ...(state.activity || [])].slice(0, 200);
}

export function loadLiveDay(estId: string, date: string): LiveDayState {
  try {
    const raw = localStorage.getItem(key(estId, date));
    if (raw) {
      const p = JSON.parse(raw) as LiveDayState;
      if (p && Array.isArray(p.tickets)) {
        if (!Array.isArray(p.activity)) p.activity = [];
        return p;
      }
    }
  } catch {
    /* */
  }
  return {
    establishment_id: estId,
    date,
    tickets: [],
    activity: [],
    closed_at: null,
    stock_deducted: false,
  };
}

export function saveLiveDay(state: LiveDayState) {
  try {
    localStorage.setItem(key(state.establishment_id, state.date), JSON.stringify(state));
    if (typeof window !== 'undefined') {
      try {
        window.dispatchEvent(
          new CustomEvent('gesmak-live-sales', {
            detail: { establishment_id: state.establishment_id, date: state.date },
          }),
        );
      } catch {
        /* */
      }
    }
  } catch {
    /* */
  }
}

export function addTicket(
  estId: string,
  date: string,
  lines: LiveSaleLine[],
  pay: LivePayMethod,
  note?: string,
  by?: string,
  stockApplied = false,
  externalId?: string,
): LiveDayState {
  const state = loadLiveDay(estId, date);
  // On continue d'enregistrer les traces même après clôture (historique temps réel)
  const clean = lines.filter((l) => l.qty > 0);
  if (!clean.length) return state;
  if (externalId && state.tickets.some((tk) => tk.external_id === externalId && !tk.voided)) {
    return state;
  }
  const total = clean.reduce((s, l) => s + l.qty * l.price, 0);
  const ticket: LiveSaleTicket = {
    id: `t-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    at: new Date().toISOString(),
    lines: clean,
    total,
    pay,
    note,
    locked: true,
    stock_applied: stockApplied,
    external_id: externalId,
  };
  state.tickets = [ticket, ...state.tickets];
  pushActivity(
    state,
    'sale',
    `Vente ${total} F — ${clean.map((l) => `${l.name}×${l.qty}`).join(', ')}`,
    by,
    ticket.id,
  );
  saveLiveDay(state);
  return state;
}

/** Annulation réservée au propriétaire / admin plateforme */
export function voidTicket(
  estId: string,
  date: string,
  ticketId: string,
  by?: string,
  allow = false,
): LiveDayState {
  const state = loadLiveDay(estId, date);
  if (state.closed_at && !allow) return state;
  const t = state.tickets.find((x) => x.id === ticketId);
  if (!t || t.voided) return state;
  if (!allow) return state;
  t.voided = true;
  t.voided_at = new Date().toISOString();
  t.voided_by = by;
  pushActivity(
    state,
    'void',
    `Annulation vente ${t.total} F — ${t.lines.map((l) => `${l.name}×${l.qty}`).join(', ')}`,
    by,
    ticketId,
  );
  saveLiveDay(state);
  return state;
}

/** Alias historique : suppression réelle uniquement si allow (propriétaire) */
export function removeTicketHard(
  estId: string,
  date: string,
  ticketId: string,
  by?: string,
  allow = false,
): LiveDayState {
  const state = loadLiveDay(estId, date);
  if (!allow) return state;
  const t = state.tickets.find((x) => x.id === ticketId);
  state.tickets = state.tickets.filter((x) => x.id !== ticketId);
  if (t) {
    pushActivity(
      state,
      'void',
      `Suppression vente ${t.total} F (propriétaire)`,
      by,
      ticketId,
    );
  }
  saveLiveDay(state);
  return state;
}

export function aggregateDay(state: LiveDayState): {
  byProduct: Record<string, LiveSaleLine>;
  total: number;
  cash: number;
  mobile: number;
  ticketCount: number;
} {
  const byProduct: Record<string, LiveSaleLine> = {};
  let total = 0;
  let cash = 0;
  let mobile = 0;
  for (const t of state.tickets) {
    if (t.voided) continue;
    total += t.total;
    if (t.pay === 'cash') cash += t.total;
    else if (t.pay === 'mobile') mobile += t.total;
    else {
      cash += t.total / 2;
      mobile += t.total / 2;
    }
    for (const l of t.lines) {
      const prev = byProduct[l.product_id];
      if (prev) {
        prev.qty += l.qty;
      } else {
        byProduct[l.product_id] = { ...l };
      }
    }
  }
  return {
    byProduct,
    total,
    cash,
    mobile,
    ticketCount: state.tickets.filter((t) => !t.voided).length,
  };
}

export function openDay(estId: string, date: string, by?: string): LiveDayState {
  const state = loadLiveDay(estId, date);
  state.closed_at = null;
  state.stock_deducted = false;
  pushActivity(state, 'open' as any, 'Journée démarrée', by);
  saveLiveDay(state);
  return state;
}

export function markClosed(estId: string, date: string, by?: string): LiveDayState {
  const state = loadLiveDay(estId, date);
  state.closed_at = new Date().toISOString();
  // Stock déjà décrémenté à chaque vente — clôture = bilan / rapport uniquement
  state.stock_deducted = true;
  pushActivity(state, 'close', 'Journée clôturée (bilan)', by);
  saveLiveDay(state);
  return state;
}

export function verifyDayHeuristics(state: LiveDayState): string[] {
  const warnings: string[] = [];
  const agg = aggregateDay(state);
  if (agg.ticketCount === 0) warnings.push('Aucune vente enregistrée.');
  if (agg.total <= 0 && agg.ticketCount > 0) warnings.push('Total à zéro malgré des tickets.');
  return warnings;
}


/** Dates YYYY-MM-DD avec au moins un ticket pour un établissement */
export function listLiveDayDates(estId: string): string[] {
  const prefix = `mm_live_sales:${estId}:`;
  const out: string[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k || !k.startsWith(prefix)) continue;
      const date = k.slice(prefix.length);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
      const day = loadLiveDay(estId, date);
      if (day.tickets.some((tk) => !tk.voided)) out.push(date);
    }
  } catch {
    /* */
  }
  return out.sort();
}

export function loadTicketsInRange(estId: string, from: string, to: string): LiveSaleTicket[] {
  const tickets: LiveSaleTicket[] = [];
  const start = new Date(from + 'T00:00:00');
  const end = new Date(to + 'T23:59:59');
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return tickets;
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const keyDate = `${y}-${m}-${day}`;
    const state = loadLiveDay(estId, keyDate);
    for (const tk of state.tickets) {
      if (!tk.voided) tickets.push(tk);
    }
  }
  return tickets.sort((a, b) => (a.at < b.at ? 1 : -1));
}
