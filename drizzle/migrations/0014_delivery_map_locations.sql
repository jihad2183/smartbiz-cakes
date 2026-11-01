ALTER TABLE public.orders
  ADD COLUMN delivery_latitude double precision,
  ADD COLUMN delivery_longitude double precision,
  ADD COLUMN delivery_map_address text,
  ADD CONSTRAINT orders_delivery_coordinates_valid CHECK (
    (delivery_latitude IS NULL AND delivery_longitude IS NULL)
    OR (
      delivery_latitude IS NOT NULL
      AND delivery_longitude IS NOT NULL
      AND delivery_latitude BETWEEN -90 AND 90
      AND delivery_longitude BETWEEN -180 AND 180
    )
  ),
  ADD CONSTRAINT orders_delivery_map_address_length CHECK (
    delivery_map_address IS NULL OR length(delivery_map_address) <= 1000
  );

ALTER TABLE public.customer_addresses
  ALTER COLUMN area DROP NOT NULL,
  ALTER COLUMN city DROP NOT NULL;

CREATE OR REPLACE FUNCTION public.place_order_with_location(
  _idempotency_key uuid,
  _items jsonb,
  _name text,
  _phone text,
  _address text,
  _delivery_date date,
  _note text,
  _fulfillment_type text,
  _payment_method text,
  _transaction_reference text,
  _voucher_code text,
  _latitude double precision,
  _longitude double precision,
  _map_address text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  created_order_id uuid;
  legacy_delivery_area text;
  updated_rows integer;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in to order'; END IF;
  IF _fulfillment_type NOT IN ('delivery', 'pickup') THEN
    RAISE EXCEPTION 'Choose delivery or pick-up';
  END IF;

  IF _fulfillment_type = 'delivery' THEN
    IF NULLIF(TRIM(_address), '') IS NULL THEN
      RAISE EXCEPTION 'House and road address is required';
    END IF;
    IF _latitude IS NULL OR _longitude IS NULL
      OR _latitude NOT BETWEEN -90 AND 90
      OR _longitude NOT BETWEEN -180 AND 180 THEN
      RAISE EXCEPTION 'Choose a valid delivery location on the map';
    END IF;
    IF _map_address IS NOT NULL AND length(_map_address) > 1000 THEN
      RAISE EXCEPTION 'Map address is too long';
    END IF;
    legacy_delivery_area := COALESCE(
      NULLIF(TRIM(_map_address), ''),
      format('Map pin: %s, %s', _latitude, _longitude)
    );
  ELSE
    legacy_delivery_area := '';
  END IF;

  created_order_id := public.place_order_once(
    _idempotency_key, _items, _name, _phone, _address, _delivery_date, _note,
    _fulfillment_type, legacy_delivery_area, _payment_method,
    _transaction_reference, _voucher_code
  );

  UPDATE public.orders
  SET delivery_latitude = CASE WHEN _fulfillment_type = 'delivery' THEN _latitude END,
      delivery_longitude = CASE WHEN _fulfillment_type = 'delivery' THEN _longitude END,
      delivery_map_address = CASE
        WHEN _fulfillment_type = 'delivery' THEN NULLIF(TRIM(_map_address), '')
        ELSE NULL
      END
  WHERE id = created_order_id
    AND user_id = auth.uid();
  GET DIAGNOSTICS updated_rows = ROW_COUNT;
  IF updated_rows <> 1 THEN RAISE EXCEPTION 'Could not save this order location'; END IF;

  RETURN created_order_id;
END;
$func$;

REVOKE ALL ON FUNCTION public.place_order_with_location(
  uuid, jsonb, text, text, text, date, text, text, text, text, text,
  double precision, double precision, text
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.place_order_with_location(
  uuid, jsonb, text, text, text, date, text, text, text, text, text,
  double precision, double precision, text
) TO authenticated;
