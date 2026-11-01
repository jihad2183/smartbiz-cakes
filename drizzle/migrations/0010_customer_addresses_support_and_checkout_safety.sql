ALTER TABLE public.profiles
  ADD COLUMN avatar_url text,
  ADD COLUMN referral_code text NOT NULL
    DEFAULT UPPER(SUBSTRING(REPLACE(gen_random_uuid()::text, '-', '') FROM 1 FOR 12));

CREATE UNIQUE INDEX profiles_referral_code_key ON public.profiles (referral_code);

CREATE OR REPLACE FUNCTION public.protect_profile_referral_code()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
BEGIN
  IF NEW.referral_code IS DISTINCT FROM OLD.referral_code THEN
    RAISE EXCEPTION 'Referral codes cannot be changed';
  END IF;
  RETURN NEW;
END;
$func$;

CREATE TRIGGER protect_profile_referral_code
  BEFORE UPDATE OF referral_code ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_profile_referral_code();

CREATE TABLE public.customer_addresses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  recipient_name text NOT NULL CHECK (length(trim(recipient_name)) BETWEEN 1 AND 120),
  phone text NOT NULL CHECK (length(trim(phone)) BETWEEN 7 AND 32),
  address_line text NOT NULL CHECK (length(trim(address_line)) BETWEEN 1 AND 500),
  area text NOT NULL CHECK (length(trim(area)) BETWEEN 1 AND 120),
  city text NOT NULL CHECK (length(trim(city)) BETWEEN 1 AND 120),
  postal_code text CHECK (postal_code IS NULL OR length(trim(postal_code)) <= 32),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX customer_addresses_user_idx ON public.customer_addresses (user_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_addresses TO authenticated;
ALTER TABLE public.customer_addresses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "customers manage their own addresses" ON public.customer_addresses FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE TABLE public.support_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  category text NOT NULL CHECK (category IN ('order', 'general', 'complaint', 'other')),
  subject text NOT NULL CHECK (length(trim(subject)) BETWEEN 1 AND 160),
  description text NOT NULL CHECK (length(trim(description)) BETWEEN 1 AND 5000),
  status text NOT NULL DEFAULT 'submitted'
    CHECK (status IN ('submitted', 'in_progress', 'resolved')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT support_request_order_belongs_to_customer
    CHECK ((category = 'order') = (order_id IS NOT NULL))
);
CREATE INDEX support_requests_customer_idx ON public.support_requests (user_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE ON public.support_requests TO authenticated;
ALTER TABLE public.support_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "customers read their own support requests" ON public.support_requests FOR SELECT
  TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "customers submit support requests" ON public.support_requests FOR INSERT
  TO authenticated WITH CHECK (
    user_id = auth.uid()
    AND (
      order_id IS NULL
      OR EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND o.user_id = auth.uid())
    )
  );
CREATE POLICY "admins update support requests" ON public.support_requests FOR UPDATE
  TO authenticated USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.set_support_request_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $func$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$func$;
CREATE TRIGGER set_support_request_updated_at
  BEFORE UPDATE ON public.support_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_support_request_updated_at();

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('profile-photos', 'profile-photos', false, 2097152, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 2097152,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp'];
CREATE POLICY "customers read their own profile photos" ON storage.objects FOR SELECT
  TO authenticated USING (
    bucket_id = 'profile-photos' AND (storage.foldername(name))[1] = auth.uid()::text
  );
CREATE POLICY "customers upload their own profile photos" ON storage.objects FOR INSERT
  TO authenticated WITH CHECK (
    bucket_id = 'profile-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
    AND lower(storage.extension(name)) IN ('jpg', 'jpeg', 'png', 'webp')
  );
CREATE POLICY "customers update their own profile photos" ON storage.objects FOR UPDATE
  TO authenticated USING (
    bucket_id = 'profile-photos' AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'profile-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
    AND lower(storage.extension(name)) IN ('jpg', 'jpeg', 'png', 'webp')
  );
CREATE POLICY "customers delete their own profile photos" ON storage.objects FOR DELETE
  TO authenticated USING (
    bucket_id = 'profile-photos' AND (storage.foldername(name))[1] = auth.uid()::text
  );

ALTER TABLE public.payment_methods DROP CONSTRAINT IF EXISTS payment_methods_id_check;
ALTER TABLE public.payment_methods
  ADD CONSTRAINT payment_methods_id_check
  CHECK (id IN ('bkash', 'nagad', 'rocket', 'upay', 'cod', 'cash_pickup'));
INSERT INTO public.payment_methods (id, label, enabled, instructions)
VALUES ('upay', 'upay', false, 'Setup required. A merchant account and payment instructions must be configured by the shop.')
ON CONFLICT (id) DO NOTHING;

DO $migration$
DECLARE
  original_definition text;
  updated_definition text;
BEGIN
  SELECT pg_get_functiondef(
    'public.place_order(jsonb,text,text,text,date,text,text,text,text,text,text)'::regprocedure
  ) INTO original_definition;
  updated_definition := replace(
    original_definition,
    'NOT IN (''bkash'', ''nagad'', ''rocket'', ''cod'', ''cash_pickup'')',
    'NOT IN (''bkash'', ''nagad'', ''rocket'', ''upay'', ''cod'', ''cash_pickup'')'
  );
  IF updated_definition = original_definition THEN
    RAISE EXCEPTION 'Could not safely extend place_order to support configured upay payments';
  END IF;
  EXECUTE updated_definition;
END;
$migration$;

CREATE TABLE public.order_checkout_requests (
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  idempotency_key uuid NOT NULL,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, idempotency_key)
);
ALTER TABLE public.order_checkout_requests ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.place_order_once(
  _idempotency_key uuid,
  _items jsonb,
  _name text,
  _phone text,
  _address text,
  _delivery_date date,
  _note text,
  _fulfillment_type text,
  _delivery_area text,
  _payment_method text,
  _transaction_reference text,
  _voucher_code text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  request_row public.order_checkout_requests;
  created_order_id uuid;
  phone_digits text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in to order'; END IF;
  IF _idempotency_key IS NULL THEN RAISE EXCEPTION 'Checkout request key is required'; END IF;

  phone_digits := regexp_replace(COALESCE(_phone, ''), '[^0-9]', '', 'g');
  IF length(phone_digits) < 7 OR length(phone_digits) > 15 THEN
    RAISE EXCEPTION 'Enter a valid phone number';
  END IF;
  IF _fulfillment_type = 'delivery'
    AND (NULLIF(TRIM(_address), '') IS NULL OR NULLIF(TRIM(_delivery_area), '') IS NULL) THEN
    RAISE EXCEPTION 'Delivery address and area are required';
  END IF;

  INSERT INTO public.order_checkout_requests (user_id, idempotency_key)
  VALUES (auth.uid(), _idempotency_key)
  ON CONFLICT (user_id, idempotency_key) DO NOTHING;

  SELECT * INTO request_row
  FROM public.order_checkout_requests
  WHERE user_id = auth.uid() AND idempotency_key = _idempotency_key
  FOR UPDATE;
  IF request_row.order_id IS NOT NULL THEN RETURN request_row.order_id; END IF;

  created_order_id := public.place_order(
    _items, _name, _phone, _address, _delivery_date, _note, _fulfillment_type,
    _delivery_area, _payment_method, _transaction_reference, _voucher_code
  );
  UPDATE public.order_checkout_requests
  SET order_id = created_order_id
  WHERE user_id = auth.uid() AND idempotency_key = _idempotency_key;
  RETURN created_order_id;
END;
$func$;
REVOKE ALL ON FUNCTION public.place_order_once(uuid, jsonb, text, text, text, date, text, text, text, text, text, text)
  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.place_order_once(uuid, jsonb, text, text, text, date, text, text, text, text, text, text)
  TO authenticated;
