create type public.app_role as enum ('admin', 'customer');

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);
grant select, insert, delete on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.user_roles where user_id = _user_id and role = _role) $$;

create policy "own roles readable" on public.user_roles for select to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(), 'admin'));
create policy "admins grant roles" on public.user_roles for insert to authenticated
  with check (public.has_role(auth.uid(), 'admin'));
create policy "admins revoke roles" on public.user_roles for delete to authenticated
  using (public.has_role(auth.uid(), 'admin') and user_id <> auth.uid());

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  phone text,
  address text,
  created_at timestamptz not null default now()
);
grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;
create policy "own profile read" on public.profiles for select to authenticated
  using (id = auth.uid() or public.has_role(auth.uid(), 'admin'));
create policy "own profile update" on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
create policy "own profile insert" on public.profiles for insert to authenticated
  with check (id = auth.uid());

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'));
  insert into public.user_roles (user_id, role) values (new.id, 'customer');
  -- The very first account becomes the owner admin; all later admins need approval.
  if not exists (select 1 from public.user_roles where role = 'admin') then
    insert into public.user_roles (user_id, role) values (new.id, 'admin');
  end if;
  return new;
end; $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

create table public.admin_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique,
  email text,
  message text,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  decided_at timestamptz
);
grant select, insert, update on public.admin_requests to authenticated;
grant all on public.admin_requests to service_role;
alter table public.admin_requests enable row level security;
create policy "read own or admin" on public.admin_requests for select to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(), 'admin'));
create policy "request for self" on public.admin_requests for insert to authenticated
  with check (user_id = auth.uid() and status = 'pending');
create policy "admin decides" on public.admin_requests for update to authenticated
  using (public.has_role(auth.uid(), 'admin'));

create or replace function public.decide_admin_request(_request_id uuid, _approve boolean)
returns void language plpgsql security definer set search_path = public
as $$
declare r public.admin_requests;
begin
  if not public.has_role(auth.uid(), 'admin') then raise exception 'Only admins can decide'; end if;
  select * into r from public.admin_requests where id = _request_id;
  if r.id is null then raise exception 'Request not found'; end if;
  update public.admin_requests set status = case when _approve then 'approved' else 'rejected' end, decided_at = now() where id = _request_id;
  if _approve then
    insert into public.user_roles (user_id, role) values (r.user_id, 'admin') on conflict do nothing;
  end if;
end; $$;

create table public.cakes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null default '',
  price numeric(10,2) not null default 0,
  image_url text,
  category text not null default 'Classic',
  tags text not null default '',
  available boolean not null default true,
  created_at timestamptz not null default now()
);
grant select on public.cakes to anon;
grant select, insert, update, delete on public.cakes to authenticated;
grant all on public.cakes to service_role;
alter table public.cakes enable row level security;
create policy "anyone views cakes" on public.cakes for select to anon, authenticated using (true);
create policy "admins insert cakes" on public.cakes for insert to authenticated with check (public.has_role(auth.uid(), 'admin'));
create policy "admins update cakes" on public.cakes for update to authenticated using (public.has_role(auth.uid(), 'admin'));
create policy "admins delete cakes" on public.cakes for delete to authenticated using (public.has_role(auth.uid(), 'admin'));

create table public.site_content (
  key text primary key,
  value text not null default '',
  updated_at timestamptz not null default now()
);
grant select on public.site_content to anon;
grant select, insert, update, delete on public.site_content to authenticated;
grant all on public.site_content to service_role;
alter table public.site_content enable row level security;
create policy "anyone reads content" on public.site_content for select to anon, authenticated using (true);
create policy "admins write content" on public.site_content for all to authenticated
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  status text not null default 'pending',
  total numeric(10,2) not null default 0,
  customer_name text,
  phone text,
  address text,
  delivery_date date,
  note text,
  created_at timestamptz not null default now()
);
grant select, update, delete on public.orders to authenticated;
grant all on public.orders to service_role;
alter table public.orders enable row level security;
create policy "own or admin orders" on public.orders for select to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(), 'admin'));
create policy "admin updates orders" on public.orders for update to authenticated using (public.has_role(auth.uid(), 'admin'));
create policy "admin deletes orders" on public.orders for delete to authenticated using (public.has_role(auth.uid(), 'admin'));

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  cake_id uuid,
  cake_name text not null,
  unit_price numeric(10,2) not null,
  quantity int not null
);
grant select on public.order_items to authenticated;
grant all on public.order_items to service_role;
alter table public.order_items enable row level security;
create policy "items of visible orders" on public.order_items for select to authenticated
  using (exists (select 1 from public.orders o where o.id = order_id and (o.user_id = auth.uid() or public.has_role(auth.uid(), 'admin'))));

create or replace function public.place_order(_items jsonb, _name text, _phone text, _address text, _delivery_date date, _note text)
returns uuid language plpgsql security definer set search_path = public
as $$
declare oid uuid; it jsonb; c public.cakes; q int; tot numeric := 0;
begin
  if auth.uid() is null then raise exception 'Sign in to order'; end if;
  if jsonb_array_length(_items) = 0 then raise exception 'Cart is empty'; end if;
  insert into public.orders (user_id, customer_name, phone, address, delivery_date, note)
    values (auth.uid(), _name, _phone, _address, _delivery_date, _note) returning id into oid;
  for it in select * from jsonb_array_elements(_items) loop
    q := greatest(1, least(50, (it->>'quantity')::int));
    select * into c from public.cakes where id = (it->>'cake_id')::uuid and available;
    if c.id is null then raise exception 'A cake in your cart is unavailable'; end if;
    insert into public.order_items (order_id, cake_id, cake_name, unit_price, quantity) values (oid, c.id, c.name, c.price, q);
    tot := tot + c.price * q;
  end loop;
  update public.orders set total = tot where id = oid;
  return oid;
end; $$;

insert into public.site_content (key, value) values
  ('hero_title', 'Cakes baked for the moments that matter'),
  ('hero_subtitle', 'Hand-finished cakes, made fresh every morning and delivered to your door.'),
  ('about_text', 'Smart Cake Shop is a small bakery making celebration cakes, everyday treats and custom designs.'),
  ('contact_phone', '+880 1700-000000'),
  ('contact_address', 'Dhaka, Bangladesh');

insert into public.cakes (name, description, price, image_url, category, tags) values
 ('Belgian Chocolate Truffle', 'Layers of dark chocolate sponge with silky truffle ganache.', 1800, 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=800', 'Chocolate', 'chocolate truffle birthday rich'),
 ('Classic Red Velvet', 'Soft cocoa sponge with tangy cream cheese frosting.', 1600, 'https://images.unsplash.com/photo-1616541823729-00fe0aacd32c?w=800', 'Classic', 'red velvet cream cheese anniversary'),
 ('Strawberry Cream', 'Vanilla chiffon with fresh strawberries and whipped cream.', 1500, 'https://images.unsplash.com/photo-1565958011703-44f9829ba187?w=800', 'Fruit', 'strawberry fruit cream light'),
 ('Black Forest', 'Chocolate sponge, cherries and fresh cream with shavings.', 1400, 'https://images.unsplash.com/photo-1606890737304-57a1ca8a5b62?w=800', 'Chocolate', 'black forest cherry chocolate'),
 ('Lemon Blueberry', 'Zesty lemon sponge studded with blueberries.', 1550, 'https://images.unsplash.com/photo-1519915028121-7d3463d20b13?w=800', 'Fruit', 'lemon blueberry citrus summer'),
 ('Wedding Tier Vanilla', 'Three-tier vanilla bean cake with buttercream roses.', 6500, 'https://images.unsplash.com/photo-1535254973040-607b474cb50d?w=800', 'Celebration', 'wedding tier vanilla roses'),
 ('Salted Caramel Crunch', 'Caramel sponge with praline crunch and sea salt.', 1700, 'https://images.unsplash.com/photo-1571115177098-24ec42ed204d?w=800', 'Classic', 'caramel crunch salted'),
 ('Rainbow Birthday', 'Six colourful layers with vanilla frosting and sprinkles.', 1900, 'https://images.unsplash.com/photo-1558636508-e0db3814bd1d?w=800', 'Celebration', 'rainbow birthday kids sprinkles');
