ALTER TABLE public.order_items
  ADD CONSTRAINT order_items_quantity_positive_check
  CHECK (quantity >= 1) NOT VALID;

ALTER TABLE public.order_items
  ADD CONSTRAINT order_items_quantity_num_integer_check
  CHECK (
    quantity_num IS NULL
    OR (quantity_num >= 1 AND quantity_num <= 50 AND quantity_num = trunc(quantity_num))
  ) NOT VALID;

ALTER TABLE public.order_items
  ADD CONSTRAINT order_items_pounds_range_check
  CHECK (pounds >= 1 AND pounds <= 6) NOT VALID;

CREATE OR REPLACE FUNCTION public.place_order(
  _items jsonb,
  _name text,
  _phone text,
  _address text,
  _delivery_date date,
  _note text
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
  q numeric;
  lb numeric;
  q_int integer;
  lb_int integer;
  tot numeric := 0;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in to order';
  END IF;
  IF _items IS NULL OR jsonb_typeof(_items) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Cart must contain a list of cake items';
  END IF;
  IF jsonb_array_length(_items) = 0 THEN
    RAISE EXCEPTION 'Cart is empty';
  END IF;

  INSERT INTO public.orders (user_id, customer_name, phone, address, delivery_date, note)
    VALUES (auth.uid(), _name, _phone, _address, _delivery_date, _note)
    RETURNING id INTO oid;

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

    SELECT * INTO c
      FROM public.cakes
      WHERE id = (it->>'cake_id')::uuid AND available
      FOR UPDATE;
    IF c.id IS NULL THEN
      RAISE EXCEPTION 'A cake in your cart is unavailable';
    END IF;
    IF c.stock_num IS NOT NULL THEN
      IF c.stock_num < q_int THEN
        RAISE EXCEPTION 'Only % left of %', c.stock_num, c.name;
      END IF;
      UPDATE public.cakes
        SET stock_num = stock_num - q_int,
            available = (stock_num - q_int) > 0
        WHERE id = c.id;
    END IF;

    INSERT INTO public.order_items (
      order_id, cake_id, cake_name, unit_price, quantity, quantity_num, pounds, image_url
    )
    VALUES (oid, c.id, c.name, c.price * lb_int, q_int, q_int, lb_int, c.image_url);
    tot := tot + c.price * lb_int * q_int;
  END LOOP;

  UPDATE public.orders SET total = tot WHERE id = oid;
  RETURN oid;
END;
$func$;

REVOKE ALL ON FUNCTION public.place_order(jsonb, text, text, text, date, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.place_order(jsonb, text, text, text, date, text) TO authenticated;
