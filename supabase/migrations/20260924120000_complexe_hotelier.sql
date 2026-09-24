-- Complexe hôtelier — tables additives, non destructives
-- Isolation par establishment_id + RLS alignée membres

-- Services du complexe
CREATE TABLE IF NOT EXISTS public.hotel_services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id uuid NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  code text NOT NULL,
  name text NOT NULL,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (establishment_id, code)
);

-- Types de chambres
CREATE TABLE IF NOT EXISTS public.hotel_room_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id uuid NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  capacity int NOT NULL DEFAULT 2,
  beds int NOT NULL DEFAULT 1,
  price_per_night numeric NOT NULL DEFAULT 0,
  amenities jsonb DEFAULT '[]'::jsonb,
  photo_url text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Chambres
CREATE TABLE IF NOT EXISTS public.hotel_rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id uuid NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  room_type_id uuid REFERENCES public.hotel_room_types(id) ON DELETE SET NULL,
  number text NOT NULL,
  floor text,
  price_per_night numeric,
  capacity int,
  status text NOT NULL DEFAULT 'available'
    CHECK (status IN ('available','occupied','reserved','cleaning','maintenance','out_of_service')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (establishment_id, number)
);

-- Clients hôtel (guests)
CREATE TABLE IF NOT EXISTS public.hotel_guests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id uuid NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  first_name text NOT NULL DEFAULT '',
  last_name text NOT NULL DEFAULT '',
  phone text,
  email text,
  address text,
  id_document text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Réservations
CREATE TABLE IF NOT EXISTS public.hotel_reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id uuid NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  guest_id uuid REFERENCES public.hotel_guests(id) ON DELETE SET NULL,
  room_id uuid REFERENCES public.hotel_rooms(id) ON DELETE SET NULL,
  check_in date NOT NULL,
  check_out date NOT NULL,
  adults int NOT NULL DEFAULT 1,
  children int NOT NULL DEFAULT 0,
  rate numeric NOT NULL DEFAULT 0,
  discount numeric NOT NULL DEFAULT 0,
  taxes numeric NOT NULL DEFAULT 0,
  total numeric NOT NULL DEFAULT 0,
  amount_paid numeric NOT NULL DEFAULT 0,
  payment_method text,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','confirmed','arrived','in_progress','completed','cancelled','no_show')),
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  checked_in_at timestamptz,
  checked_out_at timestamptz
);

-- Consommations rattachées à un séjour (resto, bar, spa…)
CREATE TABLE IF NOT EXISTS public.hotel_consumptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id uuid NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  reservation_id uuid REFERENCES public.hotel_reservations(id) ON DELETE CASCADE,
  room_id uuid REFERENCES public.hotel_rooms(id) ON DELETE SET NULL,
  service_code text,
  description text NOT NULL,
  quantity numeric NOT NULL DEFAULT 1,
  unit_price numeric NOT NULL DEFAULT 0,
  total numeric NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Housekeeping
CREATE TABLE IF NOT EXISTS public.hotel_housekeeping (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id uuid NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  room_id uuid REFERENCES public.hotel_rooms(id) ON DELETE CASCADE,
  assigned_to uuid,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','in_progress','done','inspected')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

-- Maintenance
CREATE TABLE IF NOT EXISTS public.hotel_maintenance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id uuid NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  room_id uuid REFERENCES public.hotel_rooms(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  priority text NOT NULL DEFAULT 'medium'
    CHECK (priority IN ('low','medium','high','urgent')),
  assigned_to uuid,
  cost numeric DEFAULT 0,
  status text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open','in_progress','done','cancelled')),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

-- Événements / salles
CREATE TABLE IF NOT EXISTS public.hotel_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id uuid NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  hall_name text NOT NULL,
  event_name text NOT NULL,
  client_name text,
  client_phone text,
  event_date date,
  capacity int,
  rate numeric DEFAULT 0,
  deposit numeric DEFAULT 0,
  total numeric DEFAULT 0,
  status text NOT NULL DEFAULT 'inquiry'
    CHECK (status IN ('inquiry','confirmed','in_progress','completed','cancelled')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Paramètres complexe (1 ligne / établissement)
CREATE TABLE IF NOT EXISTS public.hotel_complex_settings (
  establishment_id uuid PRIMARY KEY REFERENCES public.establishments(id) ON DELETE CASCADE,
  display_name text,
  logo_url text,
  address text,
  city text,
  country text DEFAULT 'Côte d''Ivoire',
  phone text,
  email text,
  website text,
  description text,
  currency text DEFAULT 'FCFA',
  timezone text DEFAULT 'Africa/Abidjan',
  tax_id text,
  tax_rate numeric DEFAULT 0,
  primary_color text DEFAULT '#7c3aed',
  payment_methods jsonb DEFAULT '["cash","mobile_money","card"]'::jsonb,
  language text DEFAULT 'fr',
  checkin_time text DEFAULT '14:00',
  checkout_time text DEFAULT '12:00',
  updated_at timestamptz DEFAULT now()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_hotel_services_est ON public.hotel_services(establishment_id);
CREATE INDEX IF NOT EXISTS idx_hotel_rooms_est ON public.hotel_rooms(establishment_id);
CREATE INDEX IF NOT EXISTS idx_hotel_rooms_status ON public.hotel_rooms(establishment_id, status);
CREATE INDEX IF NOT EXISTS idx_hotel_reservations_est ON public.hotel_reservations(establishment_id);
CREATE INDEX IF NOT EXISTS idx_hotel_reservations_dates ON public.hotel_reservations(establishment_id, check_in, check_out);
CREATE INDEX IF NOT EXISTS idx_hotel_guests_est ON public.hotel_guests(establishment_id);
CREATE INDEX IF NOT EXISTS idx_hotel_consumptions_res ON public.hotel_consumptions(reservation_id);
CREATE INDEX IF NOT EXISTS idx_hotel_hk_est ON public.hotel_housekeeping(establishment_id);
CREATE INDEX IF NOT EXISTS idx_hotel_maint_est ON public.hotel_maintenance(establishment_id);
CREATE INDEX IF NOT EXISTS idx_hotel_events_est ON public.hotel_events(establishment_id);

-- RLS
ALTER TABLE public.hotel_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hotel_room_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hotel_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hotel_guests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hotel_reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hotel_consumptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hotel_housekeeping ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hotel_maintenance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hotel_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hotel_complex_settings ENABLE ROW LEVEL SECURITY;

-- Policies: membre du même establishment_id
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'hotel_services','hotel_room_types','hotel_rooms','hotel_guests',
    'hotel_reservations','hotel_consumptions','hotel_housekeeping',
    'hotel_maintenance','hotel_events','hotel_complex_settings'
  ]
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS hotel_member_all ON public.%I', t);
    EXECUTE format(
      'CREATE POLICY hotel_member_all ON public.%I FOR ALL TO authenticated
       USING (
         establishment_id IN (
           SELECT m.establishment_id FROM public.members m WHERE m.user_id = auth.uid()
           UNION
           SELECT me.establishment_id FROM public.member_establishments me
           WHERE me.user_id = auth.uid() AND me.status = ''active''
         )
       )
       WITH CHECK (
         establishment_id IN (
           SELECT m.establishment_id FROM public.members m WHERE m.user_id = auth.uid()
           UNION
           SELECT me.establishment_id FROM public.member_establishments me
           WHERE me.user_id = auth.uid() AND me.status = ''active''
         )
       )', t);
  END LOOP;
END $$;
