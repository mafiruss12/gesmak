/**
 * Couche hors-ligne : cache local + file d'attente de sync
 * - Prefetch auto périodique
 * - File robuste avec retry
 * - Conflits stock : dernière écriture + application du delta si le serveur a changé
 */

const DB_NAME = 'maquis-offline';
const DB_VERSION = 1;
const STORE_CACHE = 'cache';
const STORE_QUEUE = 'queue';

export type QueueAction = 'insert' | 'update' | 'delete';

export interface QueueItem {
  id: string;
  table: string;
  action: QueueAction;
  payload: Record<string, unknown>;
  match?: Record<string, unknown>;
  createdAt: string;
  retries: number;
  lastError?: string;
  /** Opération financière en échec répété — à résoudre manuellement */
  needs_resolution?: boolean;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_CACHE)) {
        db.createObjectStore(STORE_CACHE);
      }
      if (!db.objectStoreNames.contains(STORE_QUEUE)) {
        db.createObjectStore(STORE_QUEUE, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function cacheSet(key: string, data: unknown): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_CACHE, 'readwrite');
    tx.objectStore(STORE_CACHE).put({ data, savedAt: Date.now() }, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function cacheGet<T = unknown>(key: string): Promise<T | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_CACHE, 'readonly');
    const req = tx.objectStore(STORE_CACHE).get(key);
    req.onsuccess = () => {
      const row = req.result;
      resolve(row ? (row.data as T) : null);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function queueAdd(
  table: string,
  action: QueueAction,
  payload: Record<string, unknown>,
  match?: Record<string, unknown>
): Promise<QueueItem> {
  const item: QueueItem = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    table,
    action,
    payload: { ...payload, _queued_at: new Date().toISOString() },
    match,
    createdAt: new Date().toISOString(),
    retries: 0,
  };
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_QUEUE, 'readwrite');
    tx.objectStore(STORE_QUEUE).put(item);
    tx.oncomplete = () => resolve(item);
    tx.onerror = () => reject(tx.error);
  });
}

export async function queueList(): Promise<QueueItem[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_QUEUE, 'readonly');
    const req = tx.objectStore(STORE_QUEUE).getAll();
    req.onsuccess = () => {
      const list = ((req.result as QueueItem[]) || []).sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );
      resolve(list);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function queueRemove(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_QUEUE, 'readwrite');
    tx.objectStore(STORE_QUEUE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function queueUpdate(item: QueueItem): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_QUEUE, 'readwrite');
    tx.objectStore(STORE_QUEUE).put(item);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function queueCount(): Promise<number> {
  const items = await queueList();
  return items.length;
}

export function isOnline(): boolean {
  return typeof navigator !== 'undefined' ? navigator.onLine : true;
}

export async function isOnlineAsync(): Promise<boolean> {
  try {
    const { getNativeOnlineStatus, isNative } = await import('./mobile');
    if (isNative) return getNativeOnlineStatus();
  } catch {
    /* web */
  }
  return isOnline();
}

function stripMeta(payload: Record<string, unknown>): Record<string, unknown> {
  const out = { ...payload };
  delete out._queued_at;
  delete out._prev_stock;
  delete out._client_op_id;
  delete out._local_id;
  delete out._conflict;
  return out;
}

/**
 * Conflit stock (products) :
 * - Si le payload contient _prev_stock et stock,
 *   et que le stock serveur ≠ _prev_stock → on applique le DELTA
 *   (stock_serveur + (stock_local - prev)) au lieu d'écraser.
 * - Sinon : dernière écriture gagne (valeur absolue du payload).
 */
async function applyProductStockUpdate(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  item: QueueItem
): Promise<{ conflict: boolean }> {
  const id = item.match?.id as string | undefined;
  if (!id) {
    let q = supabase.from('products').update(stripMeta(item.payload));
    if (item.match) {
      for (const [k, v] of Object.entries(item.match)) q = q.eq(k, v);
    }
    const { error } = await q;
    if (error) throw error;
    return { conflict: false };
  }

  const prev = item.payload._prev_stock;
  const nextLocal = item.payload.stock;
  const { data: serverRow } = await supabase
    .from('products')
    .select('id, stock, name')
    .eq('id', id)
    .maybeSingle();

  let finalStock = nextLocal;
  let conflict = false;

  if (
    serverRow &&
    prev !== undefined &&
    prev !== null &&
    nextLocal !== undefined &&
    Number(serverRow.stock) !== Number(prev)
  ) {
    const delta = Number(nextLocal) - Number(prev);
    finalStock = Math.max(0, Number(serverRow.stock) + delta);
    conflict = true;
  } else if (nextLocal !== undefined) {
    finalStock = Math.max(0, Number(nextLocal));
  }

  const payload = stripMeta(item.payload);
  if (nextLocal !== undefined) payload.stock = finalStock;

  const { error } = await supabase.from('products').update(payload).eq('id', id);
  if (error) throw error;

  if (conflict) {
    try {
      await supabase.from('operation_audit').insert({
        establishment_id: serverRow?.establishment_id || item.payload.establishment_id,
        action: 'stock.conflict_resolved',
        entity_type: 'product',
        entity_id: id,
        entity_label: serverRow?.name || 'produit',
        old_value: { server_stock: serverRow?.stock, prev_offline: prev },
        new_value: { applied_stock: finalStock, delta: Number(nextLocal) - Number(prev) },
        reason: 'Conflit offline résolu par application du delta',
        client_op_id: item.payload._client_op_id || item.id,
      });
    } catch {
      /* audit optionnel */
    }
  }
  return { conflict };
}

export async function flushQueue(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any
): Promise<{ ok: number; fail: number; conflicts: number }> {
  if (!isOnline()) return { ok: 0, fail: 0, conflicts: 0 };
  const items = await queueList();
  let ok = 0;
  let fail = 0;
  let conflicts = 0;

  for (const item of items) {
    try {
      if (item.action === 'insert') {
        const payload = stripMeta(item.payload);
        const { error } = await supabase.from(item.table).insert(payload);
        if (error) throw error;
      } else if (item.action === 'update') {
        if (item.table === 'products' && ('stock' in item.payload || item.payload._prev_stock !== undefined)) {
          const r = await applyProductStockUpdate(supabase, item);
          if (r.conflict) conflicts++;
        } else {
          let q = supabase.from(item.table).update(stripMeta(item.payload));
          if (item.match) {
            for (const [k, v] of Object.entries(item.match)) q = q.eq(k, v);
          }
          const { error } = await q;
          if (error) throw error;
        }
      } else if (item.action === 'delete') {
        let q = supabase.from(item.table).delete();
        if (item.match) {
          for (const [k, v] of Object.entries(item.match)) q = q.eq(k, v);
        }
        const { error } = await q;
        if (error) throw error;
      }
      await queueRemove(item.id);
      ok++;
    } catch (e) {
      fail++;
      const msg = e instanceof Error ? e.message : String(e);
      item.retries = (item.retries || 0) + 1;
      item.lastError = msg;
      // Opérations financières / sensibles : ne jamais supprimer silencieusement
      const financialTables = ['sales', 'orders', 'order_items', 'expenses', 'daily_reports', 'cash_sessions', 'stock_movements'];
      if (item.retries >= 8) {
        if (financialTables.includes(item.table)) {
          (item as any).needs_resolution = true;
          item.lastError = `needs_resolution: ${msg}`;
          await queueUpdate(item);
        } else {
          await queueRemove(item.id);
        }
      } else {
        await queueUpdate(item);
      }
    }
  }
  return { ok, fail, conflicts };
}

export async function fetchWithCache<T>(
  key: string,
  fetcher: () => Promise<T>,
  options?: { forceRefresh?: boolean }
): Promise<{ data: T | null; fromCache: boolean }> {
  if (isOnline()) {
    try {
      const data = await fetcher();
      await cacheSet(key, data);
      return { data, fromCache: false };
    } catch {
      const cached = await cacheGet<T>(key);
      return { data: cached, fromCache: true };
    }
  }
  const cached = await cacheGet<T>(key);
  return { data: cached, fromCache: true };
}

export async function cacheAuthProfile(profile: {
  userId: string;
  member: unknown;
  establishments?: unknown;
}): Promise<void> {
  await cacheSet(`auth:profile:${profile.userId}`, profile);
  await cacheSet('auth:lastUserId', profile.userId);
}

export async function getCachedAuthProfile(userId?: string): Promise<{
  userId: string;
  member: unknown;
  establishments?: unknown;
} | null> {
  const uid = userId || (await cacheGet<string>('auth:lastUserId'));
  if (!uid) return null;
  return cacheGet(`auth:profile:${uid}`);
}

/** Prefetch tables critiques pour usage hors ligne */
export async function prefetchForOffline(
  establishmentId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any
): Promise<void> {
  if (!isOnline() || !establishmentId) return;
  try {
    // Données critiques terrain (caisse, stock, rapport)
    const tables: Array<{ name: string; limit: number }> = [
      { name: 'products', limit: 1200 },
      { name: 'expenses', limit: 400 },
      { name: 'sales', limit: 800 },
      { name: 'daily_reports', limit: 60 },
    ];
    for (const { name, limit } of tables) {
      const { data } = await supabase
        .from(name)
        .select('*')
        .eq('establishment_id', establishmentId)
        .limit(limit);
      if (data) await cacheSet(`${name}:${establishmentId}`, data);
    }
    // Membres / rôles de l’établissement (lecture offline des droits)
    try {
      const { data: links } = await supabase
        .from('member_establishments')
        .select('user_id, role, establishment_id')
        .eq('establishment_id', establishmentId)
        .limit(200);
      if (links) await cacheSet(`member_establishments:${establishmentId}`, links);
    } catch {
      /* table absente ou RLS */
    }
    await cacheSet(`prefetch:at:${establishmentId}`, Date.now());
  } catch {
    /* ignore */
  }
}

/** Indique si un cache offline frais existe (< 24 h) */
export async function hasFreshOfflineCache(establishmentId: string, maxAgeMs = 24 * 60 * 60 * 1000): Promise<boolean> {
  try {
    const at = await cacheGet<number>(`prefetch:at:${establishmentId}`);
    if (!at) return false;
    return Date.now() - Number(at) < maxAgeMs;
  } catch {
    return false;
  }
}

/** Bloque une action si hors-ligne et non mise en file (message UX unique) */
export function offlineActionMessage(actionLabel = 'Cette action'): string {
  return `${actionLabel} nécessite Internet, ou sera mise en file d’attente si supportée.`;
}

/** Prefetch toutes les X ms tant que l'onglet est ouvert et en ligne */
export function startPrefetchInterval(
  getEstablishmentId: () => string | null | undefined,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  intervalMs = 3 * 60 * 1000
): () => void {
  const tick = () => {
    if (!isOnline()) return;
    const id = getEstablishmentId();
    if (id) void prefetchForOffline(id, supabase);
  };
  tick();
  const t = setInterval(tick, intervalMs);
  const onVis = () => {
    if (document.visibilityState === 'visible') tick();
  };
  document.addEventListener('visibilitychange', onVis);
  window.addEventListener('online', tick);
  return () => {
    clearInterval(t);
    document.removeEventListener('visibilitychange', onVis);
    window.removeEventListener('online', tick);
  };
}

export function labelQueueAction(item: QueueItem): string {
  const t = item.table;
  const a = item.action;
  if (t === 'products' && a === 'update') return 'Mise à jour stock / produit';
  if (t === 'products' && a === 'insert') return 'Nouveau produit';
  if (t === 'products' && a === 'delete') return 'Suppression produit';
  if (t === 'sales' && a === 'insert') return 'Vente caisse';
  if (t === 'daily_reports') return 'Rapport du jour';
  if (t === 'expenses') return 'Dépense';
  return `${a} → ${t}`;
}
