ALTER TABLE public.orders
  ADD COLUMN cancelled_at timestamptz,
  ADD COLUMN cancellation_note text;

CREATE OR REPLACE FUNCTION public.capture_order_cancellation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $func$
BEGIN
  IF NEW.status = 'cancelled' AND OLD.status IS DISTINCT FROM 'cancelled' THEN
    NEW.cancelled_at := COALESCE(NEW.cancelled_at, now());
  ELSIF NEW.status IS DISTINCT FROM 'cancelled' THEN
    NEW.cancelled_at := NULL;
    NEW.cancellation_note := NULL;
  END IF;
  RETURN NEW;
END;
$func$;

CREATE TRIGGER capture_order_cancellation
  BEFORE UPDATE OF status ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.capture_order_cancellation();

CREATE TABLE public.order_payment_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  entry_type text NOT NULL CHECK (entry_type IN ('received', 'refunded')),
  amount numeric(10,2) NOT NULL CHECK (amount > 0),
  reference text,
  note text NOT NULL DEFAULT '',
  recorded_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX order_payment_entries_order_idx
  ON public.order_payment_entries (order_id, created_at);
ALTER TABLE public.order_payment_entries ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.order_payment_entries TO authenticated;
CREATE POLICY "admins read order payment entries"
  ON public.order_payment_entries FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.order_payment_entries (order_id, entry_type, amount, note, recorded_by)
SELECT o.id, 'received', o.total, 'Imported from existing verified paid order status', NULL
FROM public.orders o
WHERE o.payment_status = 'paid'
  AND o.total > 0
  AND NOT EXISTS (
    SELECT 1 FROM public.order_payment_entries e
    WHERE e.order_id = o.id AND e.entry_type = 'received'
  );

CREATE OR REPLACE FUNCTION public.record_order_payment(
  _order_id uuid,
  _entry_type text,
  _amount numeric,
  _reference text DEFAULT NULL,
  _note text DEFAULT ''
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  order_row public.orders;
  current_received numeric(10,2);
  current_refunded numeric(10,2);
  balance numeric(10,2);
  entry_id uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only administrators can record order payments';
  END IF;
  IF _entry_type NOT IN ('received', 'refunded') THEN
    RAISE EXCEPTION 'Choose a valid payment entry type';
  END IF;
  IF _amount IS NULL OR _amount <= 0 OR _amount <> round(_amount, 2) THEN
    RAISE EXCEPTION 'Enter a positive payment amount with no more than two decimal places';
  END IF;

  SELECT * INTO order_row
  FROM public.orders
  WHERE id = _order_id
  FOR UPDATE;
  IF order_row.id IS NULL THEN RAISE EXCEPTION 'Order not found'; END IF;

  SELECT
    COALESCE(sum(amount) FILTER (WHERE entry_type = 'received'), 0),
    COALESCE(sum(amount) FILTER (WHERE entry_type = 'refunded'), 0)
  INTO current_received, current_refunded
  FROM public.order_payment_entries
  WHERE order_id = order_row.id;
  balance := current_received - current_refunded;

  IF _entry_type = 'received' THEN
    IF order_row.status NOT IN ('confirmed', 'preparing', 'out_for_delivery', 'delivered') THEN
      RAISE EXCEPTION 'Payments can only be recorded for confirmed orders';
    END IF;
    IF _amount > GREATEST(0, order_row.total - balance) THEN
      RAISE EXCEPTION 'Payment exceeds the remaining order balance';
    END IF;
  ELSIF _amount > GREATEST(0, balance) THEN
    RAISE EXCEPTION 'Refund exceeds the amount received';
  END IF;

  INSERT INTO public.order_payment_entries (
    order_id, entry_type, amount, reference, note, recorded_by
  )
  VALUES (
    order_row.id, _entry_type, _amount, NULLIF(TRIM(_reference), ''),
    COALESCE(_note, ''), auth.uid()
  )
  RETURNING id INTO entry_id;

  balance := balance + CASE WHEN _entry_type = 'received' THEN _amount ELSE -_amount END;
  UPDATE public.orders
  SET payment_status = CASE
    WHEN balance >= order_row.total THEN 'paid'
    WHEN balance > 0 THEN 'pending'
    WHEN _entry_type = 'refunded' THEN 'refunded'
    WHEN payment_status = 'failed' THEN 'failed'
    ELSE 'pending'
  END
  WHERE id = order_row.id;

  RETURN entry_id;
END;
$func$;
REVOKE ALL ON FUNCTION public.record_order_payment(uuid, text, numeric, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_order_payment(uuid, text, numeric, text, text)
  TO authenticated;

DO $publication$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
    AND NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'order_payment_entries'
    ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.order_payment_entries;
  END IF;
END;
$publication$;
