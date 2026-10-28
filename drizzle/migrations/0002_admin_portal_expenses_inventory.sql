ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS image_url text;
UPDATE public.order_items oi SET image_url = c.image_url FROM public.cakes c WHERE c.id = oi.cake_id AND oi.image_url IS NULL;
ALTER TABLE public.cakes ADD COLUMN IF NOT EXISTS stock integer;

CREATE TABLE public.expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  category text NOT NULL DEFAULT 'General',
  amount numeric NOT NULL DEFAULT 0,
  spent_on date NOT NULL DEFAULT current_date,
  note text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.expenses TO authenticated;
GRANT ALL ON public.expenses TO service_role;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins manage expenses" ON public.expenses FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.ingredients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  unit text NOT NULL DEFAULT 'kg',
  quantity numeric NOT NULL DEFAULT 0,
  reorder_level numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ingredients TO authenticated;
GRANT ALL ON public.ingredients TO service_role;
ALTER TABLE public.ingredients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins manage ingredients" ON public.ingredients FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.place_order(_items jsonb, _name text, _phone text, _address text, _delivery_date date, _note text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
declare oid uuid; it jsonb; c public.cakes; q int; tot numeric := 0;
begin
  if auth.uid() is null then raise exception 'Sign in to order'; end if;
  if jsonb_array_length(_items) = 0 then raise exception 'Cart is empty'; end if;
  insert into public.orders (user_id, customer_name, phone, address, delivery_date, note)
    values (auth.uid(), _name, _phone, _address, _delivery_date, _note) returning id into oid;
  for it in select * from jsonb_array_elements(_items) loop
    q := greatest(1, least(50, (it->>'quantity')::int));
    select * into c from public.cakes where id = (it->>'cake_id')::uuid and available for update;
    if c.id is null then raise exception 'A cake in your cart is unavailable'; end if;
    if c.stock is not null then
      if c.stock < q then raise exception 'Only % left of %', c.stock, c.name; end if;
      update public.cakes set stock = stock - q, available = (stock - q) > 0 where id = c.id;
    end if;
    insert into public.order_items (order_id, cake_id, cake_name, unit_price, quantity, image_url) values (oid, c.id, c.name, c.price, q, c.image_url);
    tot := tot + c.price * q;
  end loop;
  update public.orders set total = tot where id = oid;
  return oid;
end; $$;