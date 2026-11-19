-- ============================================================
-- GESMAK : Menu du jour / Promos Week-end + Chambres QR + Réservation publique
-- ============================================================

-- 1) Colonnes optionnelles sur menu_items (si pas encore créées)
ALTER TABLE public.menu_items
  ADD COLUMN IF NOT EXISTS is_daily_menu boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_weekend_promo boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS promo_price numeric(12,2);

-- 2) Colonnes optionnelles sur hotel_rooms (nom, description, photo)
ALTER TABLE public.hotel_rooms
  ADD COLUMN IF NOT EXISTS name text,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS image_url text;

-- 3) Lecture publique QR (anon) sur carte & chambres disponibles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'menu_categories' AND policyname = 'menu_categories_public_qr_read'
  ) THEN
    CREATE POLICY menu_categories_public_qr_read ON public.menu_categories
      FOR SELECT TO anon USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'menu_items' AND policyname = 'menu_items_public_qr_read'
  ) THEN
    CREATE POLICY menu_items_public_qr_read ON public.menu_items
      FOR SELECT TO anon USING (is_available = true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'hotel_room_types' AND policyname = 'hotel_room_types_public_qr_read'
  ) THEN
    CREATE POLICY hotel_room_types_public_qr_read ON public.hotel_room_types
      FOR SELECT TO anon USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'hotel_rooms' AND policyname = 'hotel_rooms_public_qr_read'
  ) THEN
    CREATE POLICY hotel_rooms_public_qr_read ON public.hotel_rooms
      FOR SELECT TO anon USING (status = 'available');
  END IF;
END $$;

-- 4) RPC sécurisée pour réservation de chambre depuis QR public (anon)
CREATE OR REPLACE FUNCTION public.create_public_room_booking(
  p_establishment_id uuid,
  p_room_id uuid,
  p_guest_name text,
  p_guest_phone text,
  p_check_in date,
  p_nights int DEFAULT 1,
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_room record;
  v_guest_id uuid;
  v_res_id uuid;
  v_nights int := GREATEST(1, COALESCE(p_nights, 1));
  v_check_out date := COALESCE(p_check_in, CURRENT_DATE) + v_nights;
  v_rate numeric(12,2);
  v_total numeric(12,2);
  v_first text;
  v_last text;
BEGIN
  SELECT r.id, r.number, r.price_per_night, rt.base_price
  INTO v_room
  FROM public.hotel_rooms r
  LEFT JOIN public.hotel_room_types rt ON rt.id = r.room_type_id
  WHERE r.id = p_room_id AND r.establishment_id = p_establishment_id;

  IF v_room.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Chambre introuvable');
  END IF;

  v_rate := COALESCE(NULLIF(v_room.price_per_night, 0), v_room.base_price, 0);
  v_total := v_rate * v_nights;
  v_first := COALESCE(NULLIF(split_part(trim(COALESCE(p_guest_name, 'Client QR')), ' ', 1), ''), 'Client');
  v_last := COALESCE(NULLIF(trim(substring(trim(COALESCE(p_guest_name, '')) from length(v_first) + 2)), ''), 'QR');

  INSERT INTO public.hotel_guests (establishment_id, first_name, last_name, phone)
  VALUES (p_establishment_id, v_first, v_last, NULLIF(trim(COALESCE(p_guest_phone, '')), ''))
  RETURNING id INTO v_guest_id;

  INSERT INTO public.hotel_reservations (
    establishment_id, guest_id, room_id, check_in, check_out, rate, total, status, source, notes
  ) VALUES (
    p_establishment_id, v_guest_id, p_room_id, COALESCE(p_check_in, CURRENT_DATE), v_check_out,
    v_rate, v_total, 'pending', 'qr_table',
    COALESCE(p_notes, 'Réservation QR')
  )
  RETURNING id INTO v_res_id;

  RETURN jsonb_build_object('ok', true, 'reservation_id', v_res_id, 'total', v_total, 'room_number', v_room.number);
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_public_room_booking(uuid, uuid, text, text, date, int, text) TO anon, authenticated;
