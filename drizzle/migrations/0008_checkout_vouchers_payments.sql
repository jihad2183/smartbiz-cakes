ALTER TABLE public.orders
  ADD COLUMN fulfillment_type text NOT NULL DEFAULT 'delivery'
    CHECK (fulfillment_type IN ('delivery', 'pickup')),
  ADD COLUMN delivery_area text,
  ADD COLUMN delivery_charge numeric(10,2) NOT NULL DEFAULT 0 CHECK (delivery_charge >= 0),
  ADD COLUMN discount numeric(10,2) NOT NULL DEFAULT 0 CHECK (discount >= 0),
  ADD COLUMN voucher_id uuid,
  ADD COLUMN payment_method text NOT NULL DEFAULT 'cod',
  ADD COLUMN payment_status text NOT NULL DEFAULT 'pending'
    CHECK (payment_status IN ('pending', 'paid', 'failed', 'refunded')),
  ADD COLUMN transaction_reference text;

CREATE TABLE public.payment_methods (
  id text PRIMARY KEY CHECK (id IN ('bkash', 'nagad', 'rocket', 'cod', 'cash_pickup')),
  label text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  instructions text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.payment_methods (id, label, instructions) VALUES
  ('bkash', 'bKash', 'Ask the shop to confirm the current merchant number before sending payment.'),
  ('nagad', 'Nagad', 'Ask the shop to confirm the current merchant number before sending payment.'),
  ('rocket', 'Rocket', 'Ask the shop to confirm the current merchant number before sending payment.'),
  ('cod', 'Cash on delivery', ''),
  ('cash_pickup', 'Cash on pick-up', '');
GRANT SELECT ON public.payment_methods TO anon, authenticated;
GRANT UPDATE ON public.payment_methods TO authenticated;
ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read enabled payment methods" ON public.payment_methods FOR SELECT TO anon, authenticated
  USING (enabled OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins manage payment methods" ON public.payment_methods FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.cart_items (
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  cake_id uuid NOT NULL REFERENCES public.cakes(id) ON DELETE CASCADE,
  pounds integer NOT NULL CHECK (pounds BETWEEN 1 AND 6),
  cake_name text NOT NULL,
  unit_price numeric(10,2) NOT NULL,
  image_url text,
  quantity integer NOT NULL CHECK (quantity BETWEEN 1 AND 50),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, cake_id, pounds)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cart_items TO authenticated;
ALTER TABLE public.cart_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own or admin carts are readable" ON public.cart_items FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "own or admin carts are writable" ON public.cart_items FOR ALL TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.set_cart_item_cake_snapshot()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
BEGIN
  SELECT name, price, image_url
    INTO NEW.cake_name, NEW.unit_price, NEW.image_url
    FROM public.cakes
    WHERE id = NEW.cake_id AND available;
  IF NOT FOUND THEN RAISE EXCEPTION 'A cake in your cart is unavailable'; END IF;
  RETURN NEW;
END;
$func$;
CREATE TRIGGER set_cart_item_cake_snapshot
  BEFORE INSERT OR UPDATE ON public.cart_items
  FOR EACH ROW EXECUTE FUNCTION public.set_cart_item_cake_snapshot();

CREATE TABLE public.vouchers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE CHECK (length(trim(code)) BETWEEN 1 AND 64),
  discount_type text NOT NULL CHECK (discount_type IN ('percent', 'fixed')),
  discount_value numeric(10,2) NOT NULL CHECK (discount_value > 0),
  min_order numeric(10,2) NOT NULL DEFAULT 0 CHECK (min_order >= 0),
  max_discount numeric(10,2) CHECK (max_discount IS NULL OR max_discount > 0),
  expires_at timestamptz,
  active boolean NOT NULL DEFAULT true,
  eligible_to_all boolean NOT NULL DEFAULT false,
  is_welcome boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT vouchers_percent_range_check
    CHECK (discount_type <> 'percent' OR discount_value <= 100)
);
CREATE INDEX vouchers_active_expiry_idx ON public.vouchers (active, expires_at);
CREATE UNIQUE INDEX vouchers_code_case_insensitive_idx ON public.vouchers (UPPER(TRIM(code)));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vouchers TO authenticated;
ALTER TABLE public.vouchers ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.voucher_eligibility (
  voucher_id uuid NOT NULL REFERENCES public.vouchers(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  PRIMARY KEY (voucher_id, user_id)
);
GRANT SELECT, INSERT, DELETE ON public.voucher_eligibility TO authenticated;
ALTER TABLE public.voucher_eligibility ENABLE ROW LEVEL SECURITY;
CREATE POLICY "customers read own voucher eligibility" ON public.voucher_eligibility FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins manage voucher eligibility" ON public.voucher_eligibility FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "eligible customers and admins read vouchers" ON public.vouchers FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR (
      active
      AND (expires_at IS NULL OR expires_at > now())
      AND (
        eligible_to_all
        OR EXISTS (
          SELECT 1 FROM public.voucher_eligibility e
          WHERE e.voucher_id = vouchers.id AND e.user_id = auth.uid()
        )
      )
    )
  );
CREATE POLICY "admins manage vouchers" ON public.vouchers FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.voucher_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  voucher_id uuid NOT NULL REFERENCES public.vouchers(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  order_id uuid NOT NULL UNIQUE REFERENCES public.orders(id) ON DELETE CASCADE,
  redeemed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (voucher_id, user_id)
);
GRANT SELECT ON public.voucher_redemptions TO authenticated;
ALTER TABLE public.voucher_redemptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "customers and admins read voucher redemptions" ON public.voucher_redemptions FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

ALTER TABLE public.orders
  ADD CONSTRAINT orders_voucher_id_fkey
  FOREIGN KEY (voucher_id) REFERENCES public.vouchers(id) ON DELETE SET NULL;

CREATE TABLE public.welcome_voucher_settings (
  id integer PRIMARY KEY CHECK (id = 1),
  active boolean NOT NULL DEFAULT true,
  discount_type text NOT NULL DEFAULT 'percent' CHECK (discount_type IN ('percent', 'fixed')),
  discount_value numeric(10,2) NOT NULL DEFAULT 10 CHECK (discount_value > 0),
  min_order numeric(10,2) NOT NULL DEFAULT 0 CHECK (min_order >= 0),
  max_discount numeric(10,2) CHECK (max_discount IS NULL OR max_discount > 0),
  validity_days integer NOT NULL DEFAULT 30 CHECK (validity_days BETWEEN 1 AND 3650),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (discount_type <> 'percent' OR discount_value <= 100)
);
INSERT INTO public.welcome_voucher_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
GRANT SELECT, UPDATE ON public.welcome_voucher_settings TO authenticated;
ALTER TABLE public.welcome_voucher_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "customers read welcome voucher settings" ON public.welcome_voucher_settings FOR SELECT TO authenticated
  USING (true);
CREATE POLICY "admins update welcome voucher settings" ON public.welcome_voucher_settings FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

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
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name')
  );
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'customer');

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

CREATE OR REPLACE FUNCTION public.validate_voucher(_code text, _subtotal numeric)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v public.vouchers;
  amount numeric(10,2);
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in to use a voucher'; END IF;
  IF _subtotal IS NULL OR _subtotal < 0 THEN RAISE EXCEPTION 'Order subtotal is invalid'; END IF;

  SELECT * INTO v FROM public.vouchers WHERE UPPER(code) = UPPER(TRIM(_code)) AND active
    AND (expires_at IS NULL OR expires_at > now())
    AND (
      eligible_to_all
      OR EXISTS (
        SELECT 1 FROM public.voucher_eligibility e
        WHERE e.voucher_id = vouchers.id AND e.user_id = auth.uid()
      )
    );
  IF v.id IS NULL THEN RAISE EXCEPTION 'Voucher is invalid, expired, or not available to your account'; END IF;
  IF _subtotal < v.min_order THEN RAISE EXCEPTION 'Order does not meet the voucher minimum'; END IF;
  IF EXISTS (
    SELECT 1 FROM public.voucher_redemptions r
    WHERE r.voucher_id = v.id AND r.user_id = auth.uid()
  ) THEN RAISE EXCEPTION 'This voucher has already been used'; END IF;

  amount := CASE
    WHEN v.discount_type = 'percent' THEN _subtotal * v.discount_value / 100
    ELSE v.discount_value
  END;
  IF v.max_discount IS NOT NULL THEN amount := LEAST(amount, v.max_discount); END IF;
  amount := LEAST(_subtotal, ROUND(amount, 2));
  RETURN jsonb_build_object(
    'id', v.id,
    'code', v.code,
    'discount_type', v.discount_type,
    'discount_value', v.discount_value,
    'discount', amount,
    'min_order', v.min_order,
    'max_discount', v.max_discount,
    'expires_at', v.expires_at
  );
END;
$func$;
REVOKE ALL ON FUNCTION public.validate_voucher(text, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.validate_voucher(text, numeric) TO authenticated;

DROP FUNCTION public.place_order(jsonb, text, text, text, date, text);

CREATE FUNCTION public.place_order(
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
  oid uuid;
  it jsonb;
  c public.cakes;
  v public.vouchers;
  q numeric;
  lb numeric;
  q_int integer;
  lb_int integer;
  subtotal numeric := 0;
  discount_amount numeric := 0;
  delivery_fee numeric := 0;
  final_total numeric;
  selected_payment text := LOWER(TRIM(_payment_method));
  fulfillment_enabled text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in to order'; END IF;
  IF _items IS NULL OR jsonb_typeof(_items) IS DISTINCT FROM 'array' OR jsonb_array_length(_items) = 0 THEN
    RAISE EXCEPTION 'Cart is empty';
  END IF;
  IF NULLIF(TRIM(_name), '') IS NULL OR NULLIF(TRIM(_phone), '') IS NULL THEN
    RAISE EXCEPTION 'Name and phone number are required';
  END IF;
  IF _fulfillment_type IS NULL OR _fulfillment_type NOT IN ('delivery', 'pickup') THEN
    RAISE EXCEPTION 'Choose delivery or pick-up';
  END IF;
  SELECT value INTO fulfillment_enabled FROM public.site_content
    WHERE key = CASE WHEN _fulfillment_type = 'delivery' THEN 'home_delivery_enabled' ELSE 'self_pickup_enabled' END;
  IF NOT COALESCE(NULLIF(fulfillment_enabled, ''), 'true')::boolean THEN
    RAISE EXCEPTION 'This fulfilment option is currently unavailable';
  END IF;
  IF selected_payment IS NULL OR selected_payment NOT IN ('bkash', 'nagad', 'rocket', 'cod', 'cash_pickup') THEN
    RAISE EXCEPTION 'Choose a supported payment method';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.payment_methods WHERE id = selected_payment AND enabled
  ) THEN RAISE EXCEPTION 'This payment method is currently unavailable'; END IF;
  IF selected_payment IN ('bkash', 'nagad', 'rocket') AND NULLIF(TRIM(_transaction_reference), '') IS NULL THEN
    RAISE EXCEPTION 'Enter the mobile payment transaction reference';
  END IF;
  IF _fulfillment_type = 'delivery' THEN
    IF NULLIF(TRIM(_address), '') IS NULL OR NULLIF(TRIM(_delivery_area), '') IS NULL THEN
      RAISE EXCEPTION 'Delivery address and area are required';
    END IF;
    SELECT COALESCE(NULLIF(value, '')::numeric, 0) INTO delivery_fee
      FROM public.site_content WHERE key = 'delivery_charge';
    delivery_fee := COALESCE(delivery_fee, 0);
  ELSIF selected_payment = 'cod' THEN
    RAISE EXCEPTION 'Cash on delivery is available only for home delivery';
  END IF;
  IF selected_payment = 'cash_pickup' AND _fulfillment_type <> 'pickup' THEN
    RAISE EXCEPTION 'Cash on pick-up is available only for self pick-up';
  END IF;

  FOR it IN SELECT * FROM jsonb_array_elements(_items) LOOP
    IF jsonb_typeof(it) IS DISTINCT FROM 'object'
      OR COALESCE(it->>'quantity', '') !~ '^[0-9]+([.]0+)?$' THEN
      RAISE EXCEPTION 'Cake quantity must be a positive whole number from 1 to 50';
    END IF;
    q := (it->>'quantity')::numeric;
    IF q < 1 OR q > 50 OR q <> trunc(q) THEN
      RAISE EXCEPTION 'Cake quantity must be a positive whole number from 1 to 50';
    END IF;
    q_int := q::integer;

    IF COALESCE(it->>'pounds', '') !~ '^[0-9]+([.]0+)?$' THEN
      RAISE EXCEPTION 'Choose a whole-pound cake size from 1 to 6 pounds';
    END IF;
    lb := (it->>'pounds')::numeric;
    IF lb < 1 OR lb > 6 OR lb <> trunc(lb) THEN
      RAISE EXCEPTION 'Choose a whole-pound cake size from 1 to 6 pounds';
    END IF;
    lb_int := lb::integer;

    SELECT * INTO c FROM public.cakes
      WHERE id = (it->>'cake_id')::uuid AND available
      FOR UPDATE;
    IF c.id IS NULL THEN RAISE EXCEPTION 'A cake in your cart is unavailable'; END IF;
    IF c.stock_num IS NOT NULL THEN
      IF c.stock_num < q_int THEN RAISE EXCEPTION 'Only % left of %', c.stock_num, c.name; END IF;
      UPDATE public.cakes
        SET stock_num = stock_num - q_int, available = (stock_num - q_int) > 0
        WHERE id = c.id;
    END IF;

    subtotal := subtotal + c.price * lb_int * q_int;
  END LOOP;

  IF NULLIF(TRIM(_voucher_code), '') IS NOT NULL THEN
    SELECT * INTO v FROM public.vouchers
      WHERE UPPER(code) = UPPER(TRIM(_voucher_code)) AND active
        AND (expires_at IS NULL OR expires_at > now())
      FOR UPDATE;
    IF v.id IS NULL
      OR (NOT v.eligible_to_all AND NOT EXISTS (
        SELECT 1 FROM public.voucher_eligibility e
        WHERE e.voucher_id = v.id AND e.user_id = auth.uid()
      )) THEN
      RAISE EXCEPTION 'Voucher is invalid, expired, or not available to your account';
    END IF;
    IF subtotal < v.min_order THEN RAISE EXCEPTION 'Order does not meet the voucher minimum'; END IF;
    IF EXISTS (
      SELECT 1 FROM public.voucher_redemptions r
      WHERE r.voucher_id = v.id AND r.user_id = auth.uid()
    ) THEN RAISE EXCEPTION 'This voucher has already been used'; END IF;
    discount_amount := CASE
      WHEN v.discount_type = 'percent' THEN subtotal * v.discount_value / 100
      ELSE v.discount_value
    END;
    IF v.max_discount IS NOT NULL THEN discount_amount := LEAST(discount_amount, v.max_discount); END IF;
    discount_amount := LEAST(subtotal, ROUND(discount_amount, 2));
  END IF;

  final_total := subtotal - discount_amount + delivery_fee;
  INSERT INTO public.orders (
    user_id, customer_name, phone, address, delivery_date, note, total,
    fulfillment_type, delivery_area, delivery_charge, discount, voucher_id,
    payment_method, payment_status, transaction_reference
  )
  VALUES (
    auth.uid(), TRIM(_name), TRIM(_phone),
    CASE WHEN _fulfillment_type = 'delivery' THEN TRIM(_address) ELSE NULL END,
    _delivery_date, NULLIF(TRIM(_note), ''), final_total,
    _fulfillment_type,
    CASE WHEN _fulfillment_type = 'delivery' THEN TRIM(_delivery_area) ELSE NULL END,
    delivery_fee, discount_amount, v.id,
    selected_payment, 'pending', NULLIF(TRIM(_transaction_reference), '')
  )
  RETURNING id INTO oid;

  FOR it IN SELECT * FROM jsonb_array_elements(_items) LOOP
    SELECT * INTO c FROM public.cakes WHERE id = (it->>'cake_id')::uuid;
    q_int := (it->>'quantity')::integer;
    lb_int := (it->>'pounds')::integer;
    INSERT INTO public.order_items (
      order_id, cake_id, cake_name, unit_price, quantity, quantity_num, pounds, image_url
    )
    VALUES (oid, c.id, c.name, c.price * lb_int, q_int, q_int, lb_int, c.image_url);
  END LOOP;

  IF v.id IS NOT NULL THEN
    INSERT INTO public.voucher_redemptions (voucher_id, user_id, order_id)
    VALUES (v.id, auth.uid(), oid);
  END IF;
  DELETE FROM public.cart_items WHERE user_id = auth.uid();
  RETURN oid;
END;
$func$;
REVOKE ALL ON FUNCTION public.place_order(jsonb, text, text, text, date, text, text, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.place_order(jsonb, text, text, text, date, text, text, text, text, text, text) TO authenticated;
