alter table public.order_items add column quantity_num numeric(6,1);
update public.order_items set quantity_num = quantity where quantity_num is null;
comment on column public.order_items.quantity is 'DEPRECATED: replaced by quantity_num';

alter table public.cakes add column stock_num numeric(6,1);
update public.cakes set stock_num = stock where stock_num is null;
comment on column public.cakes.stock is 'DEPRECATED: replaced by stock_num';

create or replace function public.place_order(_items jsonb, _name text, _phone text, _address text, _delivery_date date, _note text)
returns uuid
language plpgsql
security definer
set search_path = public
as $func$
declare oid uuid; it jsonb; c public.cakes; q numeric(6,1); tot numeric := 0;
begin
  if auth.uid() is null then raise exception 'Sign in to order'; end if;
  if jsonb_array_length(_items) = 0 then raise exception 'Cart is empty'; end if;
  insert into public.orders (user_id, customer_name, phone, address, delivery_date, note)
    values (auth.uid(), _name, _phone, _address, _delivery_date, _note) returning id into oid;
  for it in select * from jsonb_array_elements(_items) loop
    q := greatest(0.5, least(50, round((it->>'quantity')::numeric * 2) / 2));
    select * into c from public.cakes where id = (it->>'cake_id')::uuid and available for update;
    if c.id is null then raise exception 'A cake in your cart is unavailable'; end if;
    if c.stock_num is not null then
      if c.stock_num < q then raise exception 'Only % left of %', c.stock_num, c.name; end if;
      update public.cakes set stock_num = stock_num - q, available = (stock_num - q) > 0 where id = c.id;
    end if;
    insert into public.order_items (order_id, cake_id, cake_name, unit_price, quantity_num, image_url) values (oid, c.id, c.name, c.price, q, c.image_url);
    tot := tot + c.price * q;
  end loop;
  update public.orders set total = tot where id = oid;
  return oid;
end;
$func$;