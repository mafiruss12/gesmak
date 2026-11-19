import { useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import {
  BedDouble,
  Beer,
  CalendarDays,
  CheckCircle2,
  Loader2,
  Minus,
  Plus,
  Printer,
  Receipt,
  RefreshCw,
  Send,
  Sparkles,
  UtensilsCrossed,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { formatFCFA } from '@/lib/format';
import ProductThumb from '@/components/ProductThumb';
import {
  ReceiptSheet,
  formatReceiptText,
  triggerReceiptPrint,
  type GesmakReceiptData,
} from '@/components/ReceiptPrint';
import { parseMenuItemMeta, type MenuItem } from '@/lib/restaurant';
import { parseRoomMeta, formatFcfa } from '@/lib/hotel';
import { estimateWaitMinutes, ORDER_STATUS_CLIENT } from '@/lib/orderAlerts';
import { triggerOrderPush } from '@/lib/push';
import { fetchServiceStatus, getActiveSessionId } from '@/lib/serviceDay';

type Est = {
  id: string;
  name: string;
  type?: string | null;
  public_menu?: boolean;
  phone?: string | null;
  address?: string | null;
  logo_url?: string | null;
  cover_url?: string | null;
  qr_config?: Record<string, any> | null;
};

type Prod = {
  id: string;
  name: string;
  category: string | null;
  price: number;
  stock: number;
  image_url?: string | null;
};

type PublicRoom = {
  id: string;
  number: string;
  name: string;
  description: string;
  image_url: string;
  price_per_night: number;
  capacity: number;
  floor: string;
  status: string;
};

type CatalogEntry = {
  key: string;
  kind: 'product' | 'menu';
  id: string;
  linkedProductId?: string | null;
  name: string;
  description?: string;
  category: string;
  section: 'boissons' | 'nourriture';
  price: number;
  originalPrice?: number | null;
  imageUrl?: string | null;
  isDailyMenu?: boolean;
  isWeekendPromo?: boolean;
  soldOut?: boolean;
};

const DRINK_KEYWORDS = [
  'boisson',
  'bière',
  'biere',
  'bierre',
  'soft',
  'jus',
  'eau',
  'vin',
  'cocktail',
  'alcool',
  'soda',
  'coca',
  'café',
  'cafe',
  'thé',
  'the',
  'drink',
  'liqueur',
  'whisky',
  'gin',
  'rhum',
  'castel',
  'flag',
  'bock',
  'guinness',
  'sucrerie',
  'bar',
  'bouteille',
  'canette',
];

function isDrinkNameOrCat(text: string): boolean {
  const lower = text.toLowerCase();
  return DRINK_KEYWORDS.some((k) => lower.includes(k));
}

export default function PublicTableOrder() {
  const { estId: estParam } = useParams<{ estId: string }>();
  const [params] = useSearchParams();
  const initialTable = (params.get('table') || params.get('t') || '').trim();
  const initialSectionParam = (params.get('section') || '').toLowerCase();
  const kioskMode = params.get('kiosk') === '1' || params.get('kiosk') === 'true';

  const [estId, setEstId] = useState<string | null>(null);
  const [est, setEst] = useState<Est | null>(null);
  const [welcome, setWelcome] = useState('Commandez directement depuis votre table ou chambre');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  const [products, setProducts] = useState<Prod[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [menuCats, setMenuCats] = useState<Record<string, string>>({});
  const [rooms, setRooms] = useState<PublicRoom[]>([]);
  const [tablesList, setTablesList] = useState<{ id: string; number: string }[]>([]);
  const [selectedTableNum, setSelectedTableNum] = useState(initialTable);
  const [serviceChoice, setServiceChoice] = useState<'table' | 'takeaway' | 'room'>(
    initialTable ? 'table' : 'table',
  );
  const [tableId, setTableId] = useState<string | null>(null);

  const [cart, setCart] = useState<Record<string, number>>({});
  const [note, setNote] = useState('');
  const [customerName, setCustomerName] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('gesmak_qr_client') || '{}');
      return saved.name || '';
    } catch {
      return '';
    }
  });
  const [customerPhone, setCustomerPhone] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('gesmak_qr_client') || '{}');
      return saved.phone || '';
    } catch {
      return '';
    }
  });

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [serviceOpen, setServiceOpen] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [section, setSection] = useState<'boissons' | 'nourriture' | 'chambres'>(
    initialSectionParam === 'chambres'
      ? 'chambres'
      : initialSectionParam === 'nourriture'
        ? 'nourriture'
        : 'boissons',
  );
  const [cat, setCat] = useState('Tous');

  // Room booking modal state
  const [bookingRoom, setBookingRoom] = useState<PublicRoom | null>(null);
  const [bookingCheckIn, setBookingCheckIn] = useState(new Date().toISOString().slice(0, 10));
  const [bookingNights, setBookingNights] = useState(1);
  const [bookingNotes, setBookingNotes] = useState('');

  // Active order & official receipt state
  const [activeReceipt, setActiveReceipt] = useState<GesmakReceiptData | null>(null);
  const [lastOrderId, setLastOrderId] = useState<string | null>(null);
  const [trackStatus, setTrackStatus] = useState<string>('pending');
  const [trackServer, setTrackServer] = useState<string | null>(null);
  const [savedReceipts, setSavedReceipts] = useState<GesmakReceiptData[]>([]);
  const [showReceiptsDrawer, setShowReceiptsDrawer] = useState(false);

  // Persist customer identity for fast repeat orders
  useEffect(() => {
    try {
      localStorage.setItem(
        'gesmak_qr_client',
        JSON.stringify({ name: customerName, phone: customerPhone }),
      );
    } catch {
      // ignore storage quota errors
    }
  }, [customerName, customerPhone]);

  useEffect(() => {
    document.title = selectedTableNum
      ? `${est?.name || 'Menu'} · Table ${selectedTableNum}`
      : `${est?.name || 'GESMAK'} · Commande & Chambres`;
  }, [selectedTableNum, est?.name]);

  useEffect(() => {
    if (!kioskMode) return;
    try {
      document.documentElement.requestFullscreen?.();
    } catch {
      /* ignore */
    }
  }, [kioskMode]);

  // Initial parallel load (target < 1s)
  useEffect(() => {
    if (!estParam) {
      setError('Lien QR invalide.');
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      let e: Est | null = null;
      const looksUuid = /^[0-9a-f-]{32,36}$/i.test(estParam);
      if (looksUuid) {
        const { data } = await supabase
          .from('establishments')
          .select('id, name, type, public_menu, phone, address, slug, qr_config, logo_url, cover_url')
          .eq('id', estParam)
          .maybeSingle();
        e = data as Est | null;
      }
      if (!e) {
        const { data } = await supabase
          .from('establishments')
          .select('id, name, type, public_menu, phone, address, slug, qr_config, logo_url, cover_url')
          .eq('slug', estParam)
          .maybeSingle();
        e = data as Est | null;
      }
      if (cancelled) return;
      if (!e) {
        setError('Établissement introuvable. Vérifiez le QR code.');
        setLoading(false);
        return;
      }
      setEstId(e.id);
      setEst(e);
      if (e.qr_config?.welcome) setWelcome(String(e.qr_config.welcome));
      if (e.logo_url || e.cover_url) setLogoUrl(e.logo_url || e.cover_url || null);

      try {
        const storedReceipts = JSON.parse(
          localStorage.getItem(`gesmak_qr_receipts_${e.id}`) || '[]',
        );
        if (Array.isArray(storedReceipts)) setSavedReceipts(storedReceipts);
      } catch {
        setSavedReceipts([]);
      }

      const [prodRes, menuRes, catRes, roomRes, tabRes, svcRes] = await Promise.all([
        supabase
          .from('products')
          .select('id, name, category, price, stock, image_url')
          .eq('establishment_id', e.id)
          .order('name'),
        supabase
          .from('menu_items')
          .select('id, establishment_id, category_id, name, description, price, is_available, image_url, linked_product_id, sort_order')
          .eq('establishment_id', e.id)
          .eq('is_available', true)
          .order('sort_order'),
        supabase
          .from('menu_categories')
          .select('id, name')
          .eq('establishment_id', e.id)
          .order('sort_order'),
        supabase
          .from('hotel_rooms')
          .select('id, number, floor, status, notes, price_per_night, capacity, hotel_room_types(name, price_per_night, capacity)')
          .eq('establishment_id', e.id)
          .order('number'),
        supabase
          .from('restaurant_tables')
          .select('id, number')
          .eq('establishment_id', e.id)
          .order('number'),
        fetchServiceStatus(e.id),
      ]);

      if (cancelled) return;
      setServiceOpen(svcRes.status === 'open');
      setProducts(((prodRes.data as Prod[]) || []).filter((p) => Number(p.price) > 0));
      setMenuItems((menuRes.data as MenuItem[]) || []);

      const catMap: Record<string, string> = {};
      for (const c of (catRes.data || []) as { id: string; name: string }[]) {
        catMap[c.id] = c.name;
      }
      setMenuCats(catMap);

      // Prefer live hotel_rooms rows, fallback to qr_config.rooms snapshot
      const dbRooms = (roomRes.data || []) as any[];
      const cfgRooms = Array.isArray(e.qr_config?.rooms) ? (e.qr_config!.rooms as any[]) : [];
      const mergedRooms: PublicRoom[] = (dbRooms.length > 0 ? dbRooms : cfgRooms)
        .map((r: any) => {
          const meta = parseRoomMeta(r);
          return {
            id: String(r.id),
            number: String(r.number || ''),
            name: meta.name || r.name || r.hotel_room_types?.name || `Chambre ${r.number}`,
            description: meta.description || r.description || '',
            image_url: meta.image_url || r.image_url || '',
            price_per_night: Number(
              r.price_per_night || r.hotel_room_types?.price_per_night || 0,
            ),
            capacity: Number(r.capacity || r.hotel_room_types?.capacity || 2),
            floor: String(r.floor || ''),
            status: String(r.status || 'available'),
          };
        })
        .filter((r) => r.status === 'available' || r.status === 'reserved');
      setRooms(mergedRooms);

      const tabs = ((tabRes.data || []) as { id: string; number: string }[]).map((t) => ({
        id: t.id,
        number: String(t.number),
      }));
      setTablesList(tabs);
      if (initialTable) {
        const match = tabs.find((t) => t.number.toLowerCase() === initialTable.toLowerCase());
        if (match) setTableId(match.id);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [estParam, initialTable]);

  // Keep tableId synced if user picks table manually
  useEffect(() => {
    if (!selectedTableNum) {
      setTableId(null);
      return;
    }
    const match = tablesList.find(
      (t) => t.number.toLowerCase() === selectedTableNum.trim().toLowerCase(),
    );
    setTableId(match?.id || null);
  }, [selectedTableNum, tablesList]);

  // Live tracking for submitted order & updating in-app receipt
  useEffect(() => {
    if (!lastOrderId || !activeReceipt) return;
    let cancelled = false;
    async function pull() {
      const { data, error: rpcErr } = await supabase.rpc('get_order_public_status', {
        p_id: lastOrderId,
      });
      if (cancelled || rpcErr || !data) return;
      const row = data as any;
      if (row.status) {
        const nextSt = String(row.status);
        setTrackStatus(nextSt);
        setActiveReceipt((prev) => (prev ? { ...prev, status: nextSt } : prev));
        setSavedReceipts((prev) => {
          const updated = prev.map((r) =>
            r.id === lastOrderId ? { ...r, status: nextSt } : r,
          );
          if (estId) {
            try {
              localStorage.setItem(`gesmak_qr_receipts_${estId}`, JSON.stringify(updated));
            } catch {
              /* ignore */
            }
          }
          return updated;
        });
      }
      if (row.server_name) setTrackServer(String(row.server_name));
    }
    void pull();
    const t = window.setInterval(() => void pull(), 3500);
    return () => {
      cancelled = true;
      window.clearInterval(t);
    };
  }, [lastOrderId, activeReceipt?.id, estId]);

  const catalogEntries = useMemo<CatalogEntry[]>(() => {
    const entries: CatalogEntry[] = [];
    for (const m of menuItems) {
      const meta = parseMenuItemMeta(m);
      const catName = (m.category_id && menuCats[m.category_id]) || 'Cuisine & Plats';
      const sec: 'boissons' | 'nourriture' = isDrinkNameOrCat(`${catName} ${m.name}`)
        ? 'boissons'
        : 'nourriture';
      const activePrice =
        meta.isWeekendPromo && meta.promoPrice && meta.promoPrice > 0
          ? meta.promoPrice
          : Number(m.price) || 0;
      entries.push({
        key: `menu:${m.id}`,
        kind: 'menu',
        id: m.id,
        linkedProductId: m.linked_product_id,
        name: m.name,
        description: meta.cleanDescription,
        category: catName,
        section: sec,
        price: activePrice,
        originalPrice:
          meta.isWeekendPromo && meta.promoPrice && meta.promoPrice < Number(m.price)
            ? Number(m.price)
            : null,
        imageUrl: m.image_url,
        isDailyMenu: meta.isDailyMenu,
        isWeekendPromo: meta.isWeekendPromo,
        soldOut: !m.is_available,
      });
    }
    for (const p of products) {
      const catName = p.category || 'Carte';
      const sec: 'boissons' | 'nourriture' = isDrinkNameOrCat(`${catName} ${p.name}`)
        ? 'boissons'
        : 'nourriture';
      entries.push({
        key: `prod:${p.id}`,
        kind: 'product',
        id: p.id,
        linkedProductId: p.id,
        name: p.name,
        category: catName,
        section: sec,
        price: Math.round(Number(p.price) || 0),
        imageUrl: p.image_url,
        soldOut: Number(p.stock ?? 0) <= 0,
      });
    }
    return entries;
  }, [menuItems, menuCats, products]);

  const sectionEntries = useMemo(() => {
    if (section === 'chambres') return [];
    const drinks = catalogEntries.filter((e) => e.section === 'boissons');
    const foods = catalogEntries.filter((e) => e.section === 'nourriture');
    if (section === 'boissons') return drinks.length ? drinks : catalogEntries;
    return foods;
  }, [catalogEntries, section]);

  const dailyMenuEntries = useMemo(
    () => catalogEntries.filter((e) => e.isDailyMenu && !e.soldOut),
    [catalogEntries],
  );
  const weekendPromoEntries = useMemo(
    () => catalogEntries.filter((e) => e.isWeekendPromo && !e.soldOut),
    [catalogEntries],
  );

  const categories = useMemo(() => {
    const s = new Set(sectionEntries.map((p) => p.category || 'Autres'));
    return ['Tous', ...Array.from(s).sort()];
  }, [sectionEntries]);

  const visibleEntries = useMemo(() => {
    if (cat === 'Tous') return sectionEntries;
    return sectionEntries.filter((p) => (p.category || 'Autres') === cat);
  }, [sectionEntries, cat]);

  const lines = useMemo(() => {
    return catalogEntries
      .filter((e) => (cart[e.key] || 0) > 0)
      .map((e) => ({
        entry: e,
        qty: cart[e.key],
        total: cart[e.key] * Math.round(e.price),
      }));
  }, [catalogEntries, cart]);

  const total = lines.reduce((s, l) => s + l.total, 0);

  function bump(key: string, d: number) {
    setCart((c) => {
      const n = Math.max(0, (c[key] || 0) + d);
      const next = { ...c };
      if (n === 0) delete next[key];
      else next[key] = n;
      return next;
    });
  }

  function saveReceiptToHistory(receipt: GesmakReceiptData) {
    setActiveReceipt(receipt);
    setLastOrderId(receipt.id);
    setTrackStatus(receipt.status);
    setSavedReceipts((prev) => {
      const next = [receipt, ...prev.filter((r) => r.id !== receipt.id)].slice(0, 15);
      if (estId) {
        try {
          localStorage.setItem(`gesmak_qr_receipts_${estId}`, JSON.stringify(next));
        } catch {
          /* ignore */
        }
      }
      return next;
    });
  }

  async function submitCartOrder() {
    if (!estId || lines.length === 0) return;
    if (!serviceOpen) {
      setError('Le service est actuellement clôturé. Revenez après l’ouverture de caisse.');
      return;
    }
    const name = customerName.trim();
    if (name.length < 2) {
      setError('Indiquez votre prénom ou nom pour identifier votre commande.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const svcText =
        serviceChoice === 'takeaway'
          ? 'À emporter'
          : selectedTableNum
            ? `Table ${selectedTableNum}`
            : 'Sur place';
      const noteParts = [
        svcText,
        `Client: ${name}`,
        customerPhone.trim() ? `Tél: ${customerPhone.trim()}` : null,
        note.trim() || null,
      ].filter(Boolean);
      const notesCombined = noteParts.join(' · ');

      const sessionId = await getActiveSessionId(estId);
      const baseOrder: Record<string, unknown> = {
        establishment_id: estId,
        table_id: serviceChoice === 'table' ? tableId : null,
        table_number: serviceChoice === 'table' && selectedTableNum ? selectedTableNum : null,
        status: 'pending',
        order_type: serviceChoice === 'takeaway' ? 'takeaway' : 'dine_in',
        total,
        notes: sessionId ? `${notesCombined} · session:${sessionId}` : notesCombined,
        source: 'qr_table',
        customer_name: name,
      };
      if (sessionId) baseOrder.cash_session_id = sessionId;

      let orderRes = await supabase
        .from('orders')
        .insert(baseOrder)
        .select('id, created_at')
        .maybeSingle();

      if (orderRes.error || !orderRes.data?.id) {
        // Fallback minimal insert if cash_session_id column missing
        orderRes = await supabase
          .from('orders')
          .insert({
            establishment_id: estId,
            table_id: serviceChoice === 'table' ? tableId : null,
            table_number: serviceChoice === 'table' && selectedTableNum ? selectedTableNum : null,
            status: 'pending',
            order_type: serviceChoice === 'takeaway' ? 'takeaway' : 'dine_in',
            total,
            notes: notesCombined,
            source: 'qr_table',
            customer_name: name,
          })
          .select('id, created_at')
          .maybeSingle();
      }
      if (orderRes.error || !orderRes.data?.id) {
        throw new Error(orderRes.error?.message || 'Commande refusée, veuillez réessayer.');
      }

      const oid = orderRes.data.id;
      const itemsBatch = lines.map((l) => ({
        order_id: oid,
        product_id: l.entry.linkedProductId || null,
        menu_item_id: l.entry.kind === 'menu' ? l.entry.id : null,
        product_name: l.entry.name,
        qty: l.qty,
        unit_price: Math.round(l.entry.price),
        status: 'pending',
      }));
      const { error: iErr } = await supabase.from('order_items').insert(itemsBatch);
      if (iErr) throw new Error(iErr.message);

      if (serviceChoice === 'table' && tableId) {
        void supabase.from('restaurant_tables').update({ status: 'occupied' }).eq('id', tableId);
      }
      void triggerOrderPush(oid, estId);

      const hasDrink = lines.some((l) => l.entry.section === 'boissons');
      const hasFood = lines.some((l) => l.entry.section === 'nourriture');
      const kind: GesmakReceiptData['kind'] =
        hasDrink && hasFood ? 'mixte' : hasFood ? 'nourriture' : 'boisson';

      saveReceiptToHistory({
        id: oid,
        kind,
        establishmentName: est?.name || 'GESMAK',
        establishmentPhone: est?.phone,
        establishmentAddress: est?.address,
        tableOrRoomLabel: svcText,
        customerName: name,
        customerPhone: customerPhone.trim() || null,
        createdAt: orderRes.data.created_at || new Date().toISOString(),
        status: 'pending',
        paymentMethod: 'À régler au service / caisse',
        total,
        notes: note.trim() || null,
        items: lines.map((l) => ({
          name: l.entry.name,
          qty: l.qty,
          unitPrice: Math.round(l.entry.price),
        })),
      });
      setCart({});
      setNote('');
    } catch (e: any) {
      setError(e?.message || 'Envoi impossible.');
    } finally {
      setBusy(false);
    }
  }

  async function submitRoomBooking() {
    if (!estId || !bookingRoom) return;
    const name = customerName.trim();
    if (name.length < 2) {
      setError('Indiquez votre prénom ou nom pour réserver la chambre.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const nights = Math.max(1, bookingNights);
      const nightly = Math.round(bookingRoom.price_per_night || 0);
      const stayTotal = nights * nightly;
      const roomLabel = `Ch. ${bookingRoom.number} (${bookingRoom.name})`;
      const bookingSummary = `[CHAMBRE] ${roomLabel} · Arrivée ${bookingCheckIn} · ${nights} nuit(s) · Client: ${name}${
        customerPhone.trim() ? ` · Tél: ${customerPhone.trim()}` : ''
      }${bookingNotes.trim() ? ` · ${bookingNotes.trim()}` : ''}`;

      // 1. Tenter la RPC hotel_reservations si déployée
      try {
        await supabase.rpc('create_public_room_booking', {
          p_establishment_id: estId,
          p_room_id: bookingRoom.id,
          p_guest_name: name,
          p_guest_phone: customerPhone.trim() || '',
          p_check_in: bookingCheckIn,
          p_nights: nights,
          p_notes: bookingNotes.trim() || null,
        });
      } catch {
        // Fallback géré ci-dessous par commande suivie
      }

      // 2. Toujours créer une commande suivie dans orders pour notification immédiate & reçu officiel
      const { data: orderData, error: ordErr } = await supabase
        .from('orders')
        .insert({
          establishment_id: estId,
          table_number: `Ch.${bookingRoom.number}`,
          status: 'pending',
          order_type: 'dine_in',
          total: stayTotal,
          notes: bookingSummary,
          source: 'qr_table',
          customer_name: name,
        })
        .select('id, created_at')
        .maybeSingle();

      if (ordErr || !orderData?.id) {
        throw new Error(ordErr?.message || 'Réservation impossible pour le moment.');
      }

      await supabase.from('order_items').insert([
        {
          order_id: orderData.id,
          product_name: `Réservation ${roomLabel} (${nights} nuit${nights > 1 ? 's' : ''})`,
          qty: nights,
          unit_price: nightly,
          status: 'pending',
          notes: `Arrivée ${bookingCheckIn}`,
        },
      ]);
      void triggerOrderPush(orderData.id, estId);

      saveReceiptToHistory({
        id: orderData.id,
        kind: 'chambre',
        establishmentName: est?.name || 'Hôtel',
        establishmentPhone: est?.phone,
        establishmentAddress: est?.address,
        tableOrRoomLabel: `${roomLabel} · ${bookingCheckIn} (${nights} nuit${nights > 1 ? 's' : ''})`,
        customerName: name,
        customerPhone: customerPhone.trim() || null,
        createdAt: orderData.created_at || new Date().toISOString(),
        status: 'pending',
        paymentMethod: 'À régler à la réception',
        total: stayTotal,
        notes: bookingNotes.trim() || null,
        items: [
          {
            name: `${roomLabel} · Tarif nuitée`,
            qty: nights,
            unitPrice: nightly,
            note: `Arrivée le ${bookingCheckIn}`,
          },
        ],
      });
      setBookingRoom(null);
      setBookingNotes('');
    } catch (e: any) {
      setError(e?.message || 'Réservation refusée.');
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 px-6 bg-stone-50">
        <div className="w-16 h-16 rounded-2xl bg-amber-500/15 flex items-center justify-center">
          <Loader2 className="animate-spin text-amber-600" size={28} />
        </div>
        <p className="text-sm font-semibold text-stone-700">Ouverture du menu…</p>
      </div>
    );
  }

  if (error && !est) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50 text-stone-700 p-6 text-center">
        <div className="max-w-sm space-y-3">
          <p className="font-bold text-stone-900">{error}</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="px-4 py-2.5 rounded-xl bg-amber-500 text-stone-950 font-bold text-sm"
          >
            Réessayer
          </button>
        </div>
      </div>
    );
  }

  if (estId && !serviceOpen) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-stone-50 text-center">
        <p className="text-xl font-bold text-stone-900 mb-2">Service terminé</p>
        <p className="text-sm text-stone-600 max-w-sm">
          {est?.name || 'Cet établissement'} a clôturé le service pour aujourd’hui. Revenez dès l’ouverture de caisse.
        </p>
      </div>
    );
  }

  // Vue Reçu & Suivi Client en direct (avec impression + historique + autre commande)
  if (activeReceipt) {
    const waitMin = estimateWaitMinutes(trackStatus, 0);
    const steps = ['pending', 'preparing', 'ready', 'served'] as const;
    const stepIdx = Math.max(0, steps.indexOf(trackStatus as any));
    return (
      <div className="gesmak-receipt-print-root min-h-screen bg-stone-50 text-stone-900 px-4 py-5 pb-24 print:bg-white print:p-0">
        <div className="max-w-md mx-auto space-y-4">
          <div className="no-print text-center space-y-1.5">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-emerald-100 text-emerald-700">
              <CheckCircle2 size={32} />
            </div>
            <h1 className="text-xl font-extrabold text-stone-900">
              {activeReceipt.kind === 'chambre' ? 'Réservation enregistrée' : 'Commande envoyée'}
            </h1>
            <p className="text-xs text-stone-600">
              {ORDER_STATUS_CLIENT[trackStatus] || 'En cours de traitement'}
              {activeReceipt.kind !== 'chambre' && trackStatus !== 'served' ? ` · ~${waitMin} min` : ''}
              {trackServer ? ` · Agent : ${trackServer}` : ''}
            </p>
          </div>

          {activeReceipt.kind !== 'chambre' && (
            <div className="no-print flex justify-between gap-1.5 px-1">
              {steps.map((s, i) => (
                <div key={s} className="flex-1 text-center">
                  <div
                    className={`h-1.5 rounded-full mb-1 ${
                      i <= stepIdx ? 'bg-amber-500' : 'bg-stone-200'
                    }`}
                  />
                  <p className="text-[10px] font-medium text-stone-600">
                    {s === 'pending' ? 'Reçue' : s === 'preparing' ? 'Prépa' : s === 'ready' ? 'Prête' : 'Livrée'}
                  </p>
                </div>
              ))}
            </div>
          )}

          {/* Reçu officiel dans l'App (imprimable) */}
          <ReceiptSheet receipt={activeReceipt} />

          <div className="no-print grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={triggerReceiptPrint}
              className="min-h-[48px] rounded-xl border border-stone-300 bg-white text-stone-900 font-bold text-sm flex items-center justify-center gap-2 hover:bg-stone-100"
            >
              <Printer size={17} /> Imprimer reçu
            </button>
            <button
              type="button"
              onClick={async () => {
                const txt = formatReceiptText(activeReceipt);
                try {
                  if (navigator.share) await navigator.share({ title: `Reçu ${est?.name}`, text: txt });
                  else await navigator.clipboard.writeText(txt);
                } catch {
                  /* ignore */
                }
              }}
              className="min-h-[48px] rounded-xl border border-stone-300 bg-white text-stone-900 font-bold text-sm flex items-center justify-center gap-2 hover:bg-stone-100"
            >
              <Receipt size={17} /> Partager
            </button>
          </div>

          <button
            type="button"
            onClick={() => {
              setActiveReceipt(null);
              setLastOrderId(null);
            }}
            className="no-print w-full min-h-[52px] rounded-2xl bg-amber-500 hover:bg-amber-600 text-stone-950 font-extrabold text-base shadow-md"
          >
            + Passer une autre commande
          </button>
        </div>
      </div>
    );
  }

  const cartCount = lines.reduce((s, l) => s + l.qty, 0);

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900 pb-36">
      {/* Compact Sticky Header */}
      <header className="sticky top-0 z-20 border-b border-stone-200 bg-white/95 backdrop-blur px-4 py-2.5">
        <div className="max-w-lg mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            {logoUrl ? (
              <img
                src={logoUrl}
                alt={est?.name || 'Logo'}
                referrerPolicy="no-referrer"
                className="w-10 h-10 rounded-xl object-cover shrink-0 border border-stone-200"
              />
            ) : (
              <div className="w-10 h-10 rounded-xl bg-amber-500 text-white font-black flex items-center justify-center shrink-0">
                {(est?.name || 'G').slice(0, 1).toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <h1 className="font-extrabold text-base truncate text-stone-900">{est?.name || 'Menu'}</h1>
              <p className="text-xs text-stone-500 truncate">
                {serviceChoice === 'takeaway'
                  ? 'À emporter'
                  : selectedTableNum
                    ? `Table ${selectedTableNum}`
                    : 'Sur place'}{' '}
                · Commande rapide
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {savedReceipts.length > 0 && (
              <button
                type="button"
                onClick={() => setShowReceiptsDrawer((v) => !v)}
                className="min-h-[40px] px-2.5 rounded-xl border border-stone-200 bg-stone-100 text-stone-800 text-xs font-bold inline-flex items-center gap-1"
              >
                <Receipt size={14} /> Reçus ({savedReceipts.length})
              </button>
            )}
            <button
              type="button"
              onClick={() => window.location.reload()}
              aria-label="Actualiser"
              className="min-h-[40px] min-w-[40px] rounded-xl border border-stone-200 bg-white text-stone-700 inline-flex items-center justify-center"
            >
              <RefreshCw size={15} />
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-lg mx-auto px-3 pt-3 space-y-3">
        {error && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-800">
            {error}
          </div>
        )}

        {/* Historique des reçus client sauvegardés */}
        {showReceiptsDrawer && savedReceipts.length > 0 && (
          <div className="rounded-2xl border border-stone-200 bg-white p-3 space-y-2 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-wider text-stone-600">
                Mes reçus récents
              </p>
              <button
                type="button"
                onClick={() => setShowReceiptsDrawer(false)}
                className="text-xs text-stone-500 font-semibold"
              >
                Fermer
              </button>
            </div>
            {savedReceipts.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => {
                  setActiveReceipt(r);
                  setShowReceiptsDrawer(false);
                }}
                className="w-full text-left flex items-center justify-between rounded-xl border border-stone-200 px-3 py-2 hover:bg-stone-50"
              >
                <div>
                  <p className="text-xs font-bold text-stone-900">
                    Reçu #{r.id.slice(0, 6).toUpperCase()} · {r.tableOrRoomLabel || r.kind}
                  </p>
                  <p className="text-[11px] text-stone-500">
                    {new Date(r.createdAt).toLocaleString('fr-FR')}
                  </p>
                </div>
                <span className="text-xs font-extrabold text-amber-600 tabular-nums">
                  {formatFCFA(r.total)}
                </span>
              </button>
            ))}
          </div>
        )}

        {/* Identité client + Table / Service (enregistrée automatiquement) */}
        <div className="rounded-2xl border border-stone-200 bg-white p-3 space-y-2 shadow-sm">
          <p className="text-xs text-stone-500">{welcome}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <input
              className="w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-2.5 text-sm font-semibold text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-400"
              placeholder="Votre prénom / nom *"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              maxLength={60}
              autoComplete="name"
            />
            <input
              className="w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-2.5 text-sm text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-400"
              placeholder="Téléphone (optionnel)"
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              inputMode="tel"
            />
          </div>
          {!initialTable && section !== 'chambres' && (
            <div className="flex flex-wrap items-center gap-2 pt-0.5">
              <button
                type="button"
                onClick={() => setServiceChoice('table')}
                className={`min-h-[38px] px-3 rounded-xl text-xs font-bold border ${
                  serviceChoice === 'table'
                    ? 'border-amber-500 bg-amber-50 text-amber-800'
                    : 'border-stone-200 bg-white text-stone-600'
                }`}
              >
                Sur place / Table
              </button>
              <button
                type="button"
                onClick={() => setServiceChoice('takeaway')}
                className={`min-h-[38px] px-3 rounded-xl text-xs font-bold border ${
                  serviceChoice === 'takeaway'
                    ? 'border-amber-500 bg-amber-50 text-amber-800'
                    : 'border-stone-200 bg-white text-stone-600'
                }`}
              >
                À emporter
              </button>
              {serviceChoice === 'table' && (
                <input
                  className="flex-1 min-w-[110px] rounded-xl border border-stone-200 bg-stone-50 px-2.5 py-2 text-xs font-semibold text-stone-900"
                  placeholder="N° Table (ex. 5)"
                  value={selectedTableNum}
                  onChange={(e) => setSelectedTableNum(e.target.value)}
                />
              )}
            </div>
          )}
        </div>

        {/* 3 Sections : Boissons | Nourriture | Chambres */}
        <div className="grid grid-cols-3 gap-1.5 p-1 rounded-2xl bg-white border border-stone-200 shadow-sm">
          <button
            type="button"
            onClick={() => {
              setSection('boissons');
              setCat('Tous');
            }}
            className={`min-h-[44px] flex items-center justify-center gap-1.5 rounded-xl text-xs font-extrabold transition ${
              section === 'boissons'
                ? 'bg-amber-500 text-stone-950 shadow-sm'
                : 'text-stone-600 hover:bg-stone-50'
            }`}
          >
            <Beer size={16} /> Boissons
          </button>
          <button
            type="button"
            onClick={() => {
              setSection('nourriture');
              setCat('Tous');
            }}
            className={`min-h-[44px] flex items-center justify-center gap-1.5 rounded-xl text-xs font-extrabold transition ${
              section === 'nourriture'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-stone-600 hover:bg-stone-50'
            }`}
          >
            <UtensilsCrossed size={16} /> Nourriture
          </button>
          <button
            type="button"
            onClick={() => {
              setSection('chambres');
              setCat('Tous');
            }}
            className={`min-h-[44px] flex items-center justify-center gap-1.5 rounded-xl text-xs font-extrabold transition ${
              section === 'chambres'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-stone-600 hover:bg-stone-50'
            }`}
          >
            <BedDouble size={16} /> Chambres
          </button>
        </div>

        {/* SECTION NOURRITURE : Menu du jour & Promos Week-end mis en avant */}
        {section === 'nourriture' && (dailyMenuEntries.length > 0 || weekendPromoEntries.length > 0) && (
          <div className="space-y-2.5">
            {dailyMenuEntries.length > 0 && (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-3 space-y-2">
                <p className="text-xs font-extrabold uppercase tracking-wide text-emerald-800 flex items-center gap-1.5">
                  <Sparkles size={14} /> Menu du jour
                </p>
                <div className="space-y-1.5">
                  {dailyMenuEntries.map((item) => {
                    const q = cart[item.key] || 0;
                    return (
                      <div
                        key={`daily-${item.key}`}
                        className="flex items-center justify-between gap-2 rounded-xl bg-white border border-emerald-100 px-3 py-2"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-bold text-stone-900 truncate">{item.name}</p>
                          {item.description && (
                            <p className="text-[11px] text-stone-500 line-clamp-1">{item.description}</p>
                          )}
                          <p className="text-xs font-extrabold text-emerald-700 tabular-nums">
                            {formatFCFA(item.price)}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => bump(item.key, 1)}
                          className="min-h-[40px] px-3 rounded-xl bg-emerald-600 text-white text-xs font-bold shrink-0"
                        >
                          {q > 0 ? `+1 (${q})` : '+ Ajouter'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {weekendPromoEntries.length > 0 && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-3 space-y-2">
                <p className="text-xs font-extrabold uppercase tracking-wide text-amber-900 flex items-center gap-1.5">
                  <Sparkles size={14} /> Offres spéciales Week-end
                </p>
                <div className="space-y-1.5">
                  {weekendPromoEntries.map((item) => {
                    const q = cart[item.key] || 0;
                    return (
                      <div
                        key={`we-${item.key}`}
                        className="flex items-center justify-between gap-2 rounded-xl bg-white border border-amber-100 px-3 py-2"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-bold text-stone-900 truncate">{item.name}</p>
                          <p className="text-xs font-extrabold text-amber-700 tabular-nums">
                            {formatFCFA(item.price)}
                            {item.originalPrice ? (
                              <span className="ml-1.5 line-through font-normal text-stone-400">
                                {formatFCFA(item.originalPrice)}
                              </span>
                            ) : null}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => bump(item.key, 1)}
                          className="min-h-[40px] px-3 rounded-xl bg-amber-500 text-stone-950 text-xs font-extrabold shrink-0"
                        >
                          {q > 0 ? `+1 (${q})` : '+ Profiter'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* SECTION CHAMBRES D'HÔTEL */}
        {section === 'chambres' ? (
          <div className="space-y-3">
            {rooms.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-stone-300 bg-white p-8 text-center text-stone-500 text-sm">
                Aucune chambre disponible à la réservation pour le moment.
              </div>
            ) : (
              rooms.map((r) => (
                <div
                  key={r.id}
                  className="rounded-2xl border border-stone-200 bg-white overflow-hidden shadow-sm"
                >
                  {r.image_url ? (
                    <img
                      src={r.image_url}
                      alt={`Chambre ${r.number}`}
                      referrerPolicy="no-referrer"
                      className="w-full h-44 object-cover bg-stone-200"
                    />
                  ) : (
                    <div className="w-full h-32 bg-gradient-to-br from-indigo-50 via-stone-100 to-amber-50 flex flex-col items-center justify-center text-indigo-800">
                      <BedDouble size={28} />
                      <span className="text-xs font-bold mt-1">Chambre {r.number}</span>
                    </div>
                  )}
                  <div className="p-3.5 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="font-extrabold text-base text-stone-900">
                          Ch. {r.number} · {r.name}
                        </h3>
                        <p className="text-xs text-stone-500">
                          {r.capacity} personne{r.capacity > 1 ? 's' : ''}
                          {r.floor ? ` · Étage ${r.floor}` : ''} ·{' '}
                          <span className="text-emerald-700 font-semibold">Disponible</span>
                        </p>
                      </div>
                      <p className="text-base font-black text-indigo-700 tabular-nums shrink-0">
                        {formatFcfa(r.price_per_night)}
                        <span className="block text-[10px] font-medium text-stone-500 text-right">
                          / nuit
                        </span>
                      </p>
                    </div>
                    {r.description && (
                      <p className="text-xs text-stone-600 leading-relaxed">{r.description}</p>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setBookingRoom(r);
                        setBookingNights(1);
                      }}
                      className="w-full min-h-[46px] rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm"
                    >
                      Réserver cette chambre
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        ) : (
          <>
            {/* Filtres catégories */}
            {categories.length > 1 && (
              <div className="flex gap-1.5 overflow-x-auto pb-1">
                {categories.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setCat(c)}
                    className={`shrink-0 min-h-[36px] px-3 rounded-xl text-xs font-bold transition ${
                      cat === c
                        ? 'bg-stone-900 text-white'
                        : 'bg-white text-stone-600 border border-stone-200'
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            )}

            {visibleEntries.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-stone-300 bg-white p-8 text-center text-stone-500 text-sm">
                Aucun article disponible dans « {section === 'boissons' ? 'Boissons' : 'Nourriture'} ».
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2.5">
                {visibleEntries.map((item) => {
                  const q = cart[item.key] || 0;
                  return (
                    <div
                      key={item.key}
                      onClick={() => !item.soldOut && bump(item.key, 1)}
                      className={`relative rounded-2xl border bg-white overflow-hidden transition cursor-pointer ${
                        q > 0 ? 'border-amber-500 ring-2 ring-amber-400/30' : 'border-stone-200'
                      } ${item.soldOut ? 'opacity-50' : ''}`}
                    >
                      <div className="aspect-[4/3] w-full bg-stone-100 flex items-center justify-center overflow-hidden">
                        {item.imageUrl ? (
                          <img
                            src={item.imageUrl}
                            alt={item.name}
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <ProductThumb
                            name={item.name}
                            category={item.category}
                            imageUrl={item.imageUrl}
                            size={84}
                          />
                        )}
                      </div>
                      {q > 0 && (
                        <span className="absolute top-2 right-2 min-w-[26px] h-7 px-1.5 rounded-full bg-amber-500 text-stone-950 text-xs font-black flex items-center justify-center shadow">
                          {q}
                        </span>
                      )}
                      <div className="p-2.5 space-y-1">
                        <p className="text-sm font-bold text-stone-900 line-clamp-1">{item.name}</p>
                        {item.description && (
                          <p className="text-[11px] text-stone-500 line-clamp-1">{item.description}</p>
                        )}
                        <p className="text-sm font-black text-amber-600 tabular-nums">
                          {formatFCFA(item.price)}
                          {item.originalPrice ? (
                            <span className="ml-1 text-[10px] line-through text-stone-400 font-normal">
                              {formatFCFA(item.originalPrice)}
                            </span>
                          ) : null}
                        </p>
                      </div>
                      {!item.soldOut && (
                        <div
                          className="flex items-center gap-1 px-2 pb-2"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            onClick={() => bump(item.key, -1)}
                            aria-label={`Retirer ${item.name}`}
                            className="flex-1 min-h-[40px] rounded-xl bg-stone-100 text-stone-700 flex items-center justify-center font-bold"
                          >
                            <Minus size={16} />
                          </button>
                          <button
                            type="button"
                            onClick={() => bump(item.key, 1)}
                            aria-label={`Ajouter ${item.name}`}
                            className="flex-1 min-h-[40px] rounded-xl bg-amber-500 text-stone-950 flex items-center justify-center font-bold"
                          >
                            <Plus size={16} />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            <label className="block text-xs font-semibold text-stone-600 pt-1">
              Note pour le service (optionnel)
              <input
                className="mt-1 w-full rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-sm text-stone-900"
                placeholder="Ex. Bien glacée, peu pimenté, livraison rapide…"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </label>
          </>
        )}
      </div>

      {/* Modal confirmation réservation chambre */}
      {bookingRoom && (
        <div className="fixed inset-0 z-40 bg-black/60 flex items-end sm:items-center justify-center p-3">
          <div className="w-full max-w-md rounded-2xl bg-white p-4 space-y-3 shadow-2xl">
            <div className="flex items-center justify-between">
              <h2 className="font-extrabold text-base text-stone-900">
                Réserver Ch. {bookingRoom.number} · {bookingRoom.name}
              </h2>
              <button
                type="button"
                onClick={() => setBookingRoom(null)}
                className="text-xs font-bold text-stone-500 px-2 py-1"
              >
                Fermer
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <label className="text-xs font-semibold text-stone-600">
                <span className="flex items-center gap-1 mb-1">
                  <CalendarDays size={13} /> Date d’arrivée
                </span>
                <input
                  type="date"
                  className="w-full rounded-xl border border-stone-200 px-2.5 py-2 text-sm text-stone-900"
                  value={bookingCheckIn}
                  onChange={(e) => setBookingCheckIn(e.target.value)}
                />
              </label>
              <label className="text-xs font-semibold text-stone-600">
                <span className="block mb-1">Nombre de nuits</span>
                <input
                  type="number"
                  min={1}
                  max={60}
                  className="w-full rounded-xl border border-stone-200 px-2.5 py-2 text-sm text-stone-900"
                  value={bookingNights}
                  onChange={(e) => setBookingNights(Math.max(1, Number(e.target.value) || 1))}
                />
              </label>
            </div>
            <input
              className="w-full rounded-xl border border-stone-200 px-3 py-2.5 text-sm text-stone-900"
              placeholder="Demande particulière (heure d’arrivée, lit extra…)"
              value={bookingNotes}
              onChange={(e) => setBookingNotes(e.target.value)}
            />
            <div className="rounded-xl bg-indigo-50 p-3 flex items-center justify-between">
              <span className="text-xs font-semibold text-indigo-900">
                Total séjour ({bookingNights} nuit{bookingNights > 1 ? 's' : ''})
              </span>
              <span className="text-lg font-black text-indigo-700 tabular-nums">
                {formatFcfa(bookingNights * (bookingRoom.price_per_night || 0))}
              </span>
            </div>
            <button
              type="button"
              disabled={busy || customerName.trim().length < 2}
              onClick={() => void submitRoomBooking()}
              className="w-full min-h-[50px] rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-sm disabled:opacity-50"
            >
              {busy ? 'Enregistrement…' : 'Confirmer la réservation & obtenir le reçu'}
            </button>
            {customerName.trim().length < 2 && (
              <p className="text-[11px] text-center text-amber-700 font-medium">
                Saisissez votre nom ci-dessus avant de confirmer.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Barre panier fixe en bas (14% max viewport height) */}
      {lines.length > 0 && section !== 'chambres' && (
        <div className="fixed bottom-0 inset-x-0 z-30 border-t border-stone-200 bg-white px-3 py-2.5 shadow-[0_-6px_24px_rgba(0,0,0,0.08)]">
          <div className="max-w-lg mx-auto flex items-center justify-between gap-3">
            <div>
              <p className="text-xs text-stone-500 font-semibold">{cartCount} article(s)</p>
              <p className="text-lg font-black text-amber-600 tabular-nums">{formatFCFA(total)}</p>
            </div>
            <button
              type="button"
              disabled={busy || customerName.trim().length < 2}
              onClick={() => void submitCartOrder()}
              className="flex-1 min-h-[48px] rounded-xl bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-stone-950 font-extrabold text-sm inline-flex items-center justify-center gap-2 px-4"
            >
              {busy ? <Loader2 className="animate-spin" size={18} /> : <Send size={17} />}
              Commander maintenant
            </button>
          </div>
          {customerName.trim().length < 2 && (
            <p className="text-[10px] text-center text-amber-700 font-medium mt-1">
              Indiquez votre nom ci-dessus pour valider la commande
            </p>
          )}
        </div>
      )}
    </div>
  );
}
