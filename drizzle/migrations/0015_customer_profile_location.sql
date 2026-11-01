ALTER TABLE public.profiles
  ADD COLUMN location_latitude double precision,
  ADD COLUMN location_longitude double precision,
  ADD COLUMN location_address text,
  ADD COLUMN location_updated_at timestamptz,
  ADD CONSTRAINT profiles_location_coordinates_valid CHECK (
    (location_latitude IS NULL AND location_longitude IS NULL)
    OR (
      location_latitude IS NOT NULL
      AND location_longitude IS NOT NULL
      AND location_latitude BETWEEN -90 AND 90
      AND location_longitude BETWEEN -180 AND 180
    )
  ),
  ADD CONSTRAINT profiles_location_address_length CHECK (
    location_address IS NULL OR length(location_address) <= 1000
  );

CREATE OR REPLACE FUNCTION public.save_profile_location_if_missing(
  _latitude double precision,
  _longitude double precision,
  _address text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  updated_rows integer;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in to save your location'; END IF;
  IF _latitude IS NULL OR _longitude IS NULL
    OR _latitude NOT BETWEEN -90 AND 90
    OR _longitude NOT BETWEEN -180 AND 180 THEN
    RAISE EXCEPTION 'Choose a valid location';
  END IF;
  IF _address IS NOT NULL AND length(_address) > 1000 THEN
    RAISE EXCEPTION 'Location address is too long';
  END IF;

  UPDATE public.profiles
  SET location_latitude = _latitude,
      location_longitude = _longitude,
      location_address = NULLIF(TRIM(_address), ''),
      location_updated_at = now()
  WHERE id = auth.uid()
    AND location_latitude IS NULL
    AND location_longitude IS NULL;

  GET DIAGNOSTICS updated_rows = ROW_COUNT;
  RETURN updated_rows = 1;
END;
$func$;
REVOKE ALL ON FUNCTION public.save_profile_location_if_missing(double precision, double precision, text)
  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_profile_location_if_missing(double precision, double precision, text)
  TO authenticated;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  settings public.welcome_voucher_settings;
  voucher_code text;
  new_voucher_id uuid;
  input_referral_code text;
  referrer_id uuid;
  metadata_latitude text := NEW.raw_user_meta_data->>'location_latitude';
  metadata_longitude text := NEW.raw_user_meta_data->>'location_longitude';
  parsed_latitude numeric;
  parsed_longitude numeric;
  valid_latitude double precision;
  valid_longitude double precision;
BEGIN
  IF length(COALESCE(metadata_latitude, '')) <= 32
    AND length(COALESCE(metadata_longitude, '')) <= 32
    AND metadata_latitude ~ '^-?[0-9]+([.][0-9]+)?$'
    AND metadata_longitude ~ '^-?[0-9]+([.][0-9]+)?$' THEN
    parsed_latitude := metadata_latitude::numeric;
    parsed_longitude := metadata_longitude::numeric;
    IF parsed_latitude BETWEEN -90 AND 90 AND parsed_longitude BETWEEN -180 AND 180 THEN
      valid_latitude := parsed_latitude::double precision;
      valid_longitude := parsed_longitude::double precision;
    END IF;
  END IF;

  INSERT INTO public.profiles (
    id, email, full_name, location_latitude, location_longitude,
    location_address, location_updated_at
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
    valid_latitude,
    valid_longitude,
    CASE
      WHEN valid_latitude IS NOT NULL AND length(COALESCE(NEW.raw_user_meta_data->>'location_address', '')) <= 1000
      THEN NULLIF(TRIM(NEW.raw_user_meta_data->>'location_address'), '')
      ELSE NULL
    END,
    CASE WHEN valid_latitude IS NOT NULL THEN now() END
  );
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'customer');

  input_referral_code := UPPER(NULLIF(TRIM(NEW.raw_user_meta_data->>'referral_code'), ''));
  IF input_referral_code IS NOT NULL THEN
    SELECT id INTO referrer_id
    FROM public.profiles
    WHERE public.profiles.referral_code = input_referral_code
      AND id <> NEW.id;

    IF referrer_id IS NOT NULL THEN
      INSERT INTO public.customer_referrals (referrer_user_id, referred_user_id, referral_code)
      VALUES (referrer_id, NEW.id, input_referral_code)
      ON CONFLICT (referred_user_id) DO NOTHING;
    END IF;
  END IF;

  SELECT * INTO settings FROM public.welcome_voucher_settings WHERE id = 1;
  IF settings.active THEN
    voucher_code := 'WELCOME-' || UPPER(REPLACE(gen_random_uuid()::text, '-', ''));
    INSERT INTO public.vouchers (
      code, discount_type, discount_value, min_order, max_discount, expires_at, active, is_welcome
    )
    VALUES (
      voucher_code,
      settings.discount_type,
      settings.discount_value,
      settings.min_order,
      settings.max_discount,
      now() + make_interval(days => settings.validity_days),
      true,
      true
    )
    RETURNING id INTO new_voucher_id;
    INSERT INTO public.voucher_eligibility (voucher_id, user_id) VALUES (new_voucher_id, NEW.id);
  END IF;
  RETURN NEW;
END;
$func$;
