alter table public.order_items add column pounds numeric(3,0) not null default 1;
drop policy if exists "request for self" on public.admin_requests;
create or replace function public.place_order(_items jsonb, _name text, _phone text, _address text, _delivery_date date, _note text)
returns uuid language plpgsql security definer set search_path = public as $func$
declare oid uuid; it jsonb; c public.cakes; q numeric(6,1); lb int; tot numeric := 0;
begin
  if auth.uid() is null then raise exception 'Sign in to order'; end if;
  if jsonb_array_length(_items) = 0 then raise exception 'Cart is empty'; end if;
  insert into public.orders (user_id, customer_name, phone, address, delivery_date, note)
    values (auth.uid(), _name, _phone, _address, _delivery_date, _note) returning id into oid;
  for it in select * from jsonb_array_elements(_items) loop
    q := greatest(0.5, least(50, round((it->>'quantity')::numeric * 2) / 2));
    lb := coalesce((it->>'pounds')::int, 1);
    if lb < 1 or lb > 6 then raise exception 'Choose a size from 1 to 6 pounds'; end if;
    select * into c from public.cakes where id = (it->>'cake_id')::uuid and available for update;
    if c.id is null then raise exception 'A cake in your cart is unavailable'; end if;
    if c.stock_num is not null then
      if c.stock_num < q then raise exception 'Only % left of %', c.stock_num, c.name; end if;
      update public.cakes set stock_num = stock_num - q, available = (stock_num - q) > 0 where id = c.id;
    end if;
    insert into public.order_items (order_id, cake_id, cake_name, unit_price, quantity, quantity_num, pounds, image_url)
      values (oid, c.id, c.name, c.price * lb, ceil(q)::int, q, lb, c.image_url);
    tot := tot + c.price * lb * q;
  end loop;
  update public.orders set total = tot where id = oid;
  return oid;
end; $func$;