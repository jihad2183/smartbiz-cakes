CREATE TABLE public.customer_referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  referred_user_id uuid NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  referral_code text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT customer_referrals_no_self_referral
    CHECK (referrer_user_id <> referred_user_id)
);
CREATE INDEX customer_referrals_referrer_idx
  ON public.customer_referrals (referrer_user_id, created_at DESC);
ALTER TABLE public.customer_referrals ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.customer_referrals TO authenticated;
CREATE POLICY "customers read their own referral relationships"
  ON public.customer_referrals FOR SELECT TO authenticated
  USING (referrer_user_id = auth.uid() OR referred_user_id = auth.uid());

DROP POLICY IF EXISTS "eligible customers and admins read vouchers" ON public.vouchers;
CREATE POLICY "eligible customers and admins read vouchers"
  ON public.vouchers FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR eligible_to_all
    OR EXISTS (
      SELECT 1 FROM public.voucher_eligibility e
      WHERE e.voucher_id = vouchers.id AND e.user_id = auth.uid()
    )
  );

CREATE OR REPLACE FUNCTION public.record_customer_referral(_code text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  referrer_id uuid;
  normalized_code text := UPPER(NULLIF(TRIM(_code), ''));
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in to record an invitation'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = auth.uid() AND created_at >= now() - interval '30 minutes'
  ) THEN
    RETURN;
  END IF;
  IF normalized_code IS NULL THEN RAISE EXCEPTION 'Invitation code is missing'; END IF;

  SELECT id INTO referrer_id
  FROM public.profiles
  WHERE public.profiles.referral_code = normalized_code
    AND id <> auth.uid();
  IF referrer_id IS NULL THEN RAISE EXCEPTION 'Invitation link is invalid'; END IF;

  INSERT INTO public.customer_referrals (referrer_user_id, referred_user_id, referral_code)
  VALUES (referrer_id, auth.uid(), normalized_code)
  ON CONFLICT (referred_user_id) DO NOTHING;
END;
$func$;
REVOKE ALL ON FUNCTION public.record_customer_referral(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_customer_referral(text) TO authenticated;

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
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name')
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
    $find$  IF NULLIF(TRIM(_name), '') IS NULL OR NULLIF(TRIM(_phone), '') IS NULL THEN
    RAISE EXCEPTION 'Name and phone number are required';
  END IF;$find$,
    $replace$  IF NULLIF(TRIM(_name), '') IS NULL THEN
    RAISE EXCEPTION 'Customer name is required';
  END IF;
  IF length(regexp_replace(COALESCE(_phone, ''), '[^0-9]', '', 'g')) NOT BETWEEN 7 AND 15 THEN
    RAISE EXCEPTION 'Enter a valid phone number';
  END IF;$replace$
  );
  updated_definition := replace(
    updated_definition,
    '  RETURN oid;',
    '  UPDATE public.profiles SET phone = TRIM(_phone) WHERE id = auth.uid();'
      || E'\n  RETURN oid;'
  );

  IF updated_definition = original_definition
    OR position('regexp_replace(COALESCE(_phone' IN updated_definition) = 0
    OR position('UPDATE public.profiles SET phone = TRIM(_phone)' IN updated_definition) = 0 THEN
    RAISE EXCEPTION 'Could not safely add server-side checkout phone validation';
  END IF;
  EXECUTE updated_definition;
END;
$migration$;
