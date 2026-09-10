-- F-ck Face · esquema inicial y migración para drops exclusivos.
-- Ejecutar completo en Supabase SQL Editor. Las contraseñas nunca se exponen al navegador.

-- En Supabase las extensiones se instalan en el esquema `extensions`.
-- Las funciones de este archivo usan un search_path seguro, así que se
-- referencian explícitamente más abajo.
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

create table if not exists public.admin_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);  

create table if not exists public.drops (
  id uuid primary key default gen_random_uuid(),
  release_at timestamptz not null,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 160),
  price integer not null check (price >= 0),
  original_price integer check (original_price is null or original_price > 0),
  category text not null check (category in ('jacket_damas','jacket_caballeros','pantalones','chalecos','tallas_plus','ropa_ninos','mochilas','camisas','abrigos','buzos','accesorios','otros')),
  size text,
  condition text,
  description text,
  image_urls text[] not null default '{}',
  status text not null default 'new_drop' check (status in ('new_drop','published')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Campos añadidos para el flujo exclusivo. release_at se conserva por compatibilidad
-- y representa la misma fecha que public_at.
alter table public.drops add column if not exists exclusive_at timestamptz;
alter table public.drops add column if not exists public_at timestamptz;
alter table public.drops add column if not exists access_password_hash text;
update public.drops set public_at = release_at where public_at is null;
update public.drops set exclusive_at = release_at where exclusive_at is null;

alter table public.products add column if not exists drop_id uuid references public.drops(id) on delete set null;
alter table public.products add column if not exists length_cm numeric(6,2);
alter table public.products add column if not exists chest_width_cm numeric(6,2);
alter table public.products add column if not exists availability text not null default 'available';
alter table public.products add column if not exists original_price integer;
alter table public.products drop constraint if exists products_original_price_check;
alter table public.products add constraint products_original_price_check check (original_price is null or (original_price > price and original_price > 0));
-- Categorías vigentes. Se conservan las categorías anteriores para no invalidar inventario ya creado.
alter table public.products drop constraint if exists products_category_check;
alter table public.products add constraint products_category_check check (category in ('jacket_damas','jacket_caballeros','pantalones','chalecos','tallas_plus','ropa_ninos','mochilas','camisas','abrigos','buzos','accesorios','otros'));
alter table public.products drop constraint if exists products_availability_check;
alter table public.products add constraint products_availability_check check (availability in ('available','reserved','payment_pending'));

-- Vincula el inventario pendiente existente al drop activo, si lo hubiera.
update public.products p
set drop_id = d.id
from (
  select id from public.drops where is_active order by created_at desc limit 1
) d
where p.drop_id is null and p.status = 'new_drop';

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.admin_profiles where user_id = auth.uid()) $$;
revoke execute on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

-- En la apertura pública, solo se publican las piezas del drop correspondiente.
create or replace function public.release_due_drops()
returns void language plpgsql security definer set search_path = public
as $$
begin
  update public.products p
  set status = 'published', updated_at = now()
  from public.drops d
  where p.drop_id = d.id
    and p.status = 'new_drop'
    and d.is_active
    and coalesce(d.public_at, d.release_at) <= now();

  update public.drops
  set is_active = false
  where is_active and coalesce(public_at, release_at) <= now();
end;
$$;

-- Crea o actualiza el único drop activo y guarda únicamente el hash de su contraseña.
create or replace function public.save_active_drop(
  p_exclusive_at timestamptz,
  p_public_at timestamptz,
  p_password text,
  p_description text default null
)
returns uuid language plpgsql security definer set search_path = public
as $$
declare active_id uuid;
begin
  if not public.is_admin() then
    raise exception 'No autorizado.';
  end if;
  if p_exclusive_at is null or p_public_at is null or p_exclusive_at <= now() or p_public_at <= p_exclusive_at then
    raise exception 'Las fechas del drop no son válidas.';
  end if;
  if length(coalesce(p_password, '')) > 200 or length(coalesce(p_description, '')) > 2000 then
    raise exception 'Los datos del drop exceden el tamaño permitido.';
  end if;

  select id into active_id from public.drops where is_active order by created_at desc limit 1;
  if active_id is null then
    if coalesce(trim(p_password), '') = '' then
      raise exception 'Ingresá una contraseña para el acceso exclusivo.';
    end if;
    insert into public.drops (release_at, exclusive_at, public_at, access_password_hash, description, is_active)
    values (
      p_public_at,
      p_exclusive_at,
      p_public_at,
      extensions.crypt(p_password, extensions.gen_salt('bf')),
      p_description,
      true
    )
    returning id into active_id;
  else
    update public.drops
    set release_at = p_public_at,
        exclusive_at = p_exclusive_at,
        public_at = p_public_at,
        description = p_description,
        access_password_hash = case
          when coalesce(trim(p_password), '') = '' then access_password_hash
          else extensions.crypt(p_password, extensions.gen_salt('bf'))
        end
    where id = active_id;
  end if;
  return active_id;
end;
$$;

-- Información segura para los contadores. No devuelve la contraseña ni su hash.
create or replace function public.get_current_drop()
returns table (id uuid, exclusive_at timestamptz, public_at timestamptz, description text)
language sql stable security definer set search_path = public
as $$
  select d.id, d.exclusive_at, coalesce(d.public_at, d.release_at), d.description
  from public.drops d
  where d.is_active
  order by d.created_at desc
  limit 1;
$$;

-- Catálogo público: solo piezas ya liberadas. Las apartadas siguen visibles.
create or replace function public.get_public_catalog()
returns setof public.products
language sql stable security definer set search_path = public
as $$
  select * from public.products where status = 'published' order by created_at desc;
$$;

-- Verifica el estado actual de una prenda antes de mostrar sus datos de contacto.
create or replace function public.get_public_product(p_product_id uuid)
returns setof public.products
language sql stable security definer set search_path = public
as $$
  select * from public.products
  where id = p_product_id and status = 'published';
$$;

-- Las prendas exclusivas se devuelven solo si el código es correcto y el período está activo.
create or replace function public.get_exclusive_products(p_drop_id uuid, p_password text)
returns setof public.products
language plpgsql security definer set search_path = public
as $$
begin
  if p_drop_id is null or p_password is null or length(p_password) > 200 then
    raise exception 'Contraseña incorrecta o acceso no disponible.';
  end if;
  if not exists (
    select 1 from public.drops d
    where d.id = p_drop_id
      and d.is_active
      and d.exclusive_at <= now()
      and coalesce(d.public_at, d.release_at) > now()
      and d.access_password_hash is not null
      and extensions.crypt(p_password, d.access_password_hash) = d.access_password_hash
  ) then
    raise exception 'Contraseña incorrecta o acceso no disponible.';
  end if;

  return query
  select * from public.products
  where drop_id = p_drop_id and status = 'new_drop'
  order by created_at desc;
end;
$$;

grant execute on function public.release_due_drops() to anon, authenticated;
grant execute on function public.save_active_drop(timestamptz, timestamptz, text, text) to authenticated;
grant execute on function public.get_current_drop() to anon, authenticated;
grant execute on function public.get_public_catalog() to anon, authenticated;
grant execute on function public.get_public_product(uuid) to anon, authenticated;
grant execute on function public.get_exclusive_products(uuid, text) to anon, authenticated;

-- Las tablas no se consultan directamente desde el navegador público: el catálogo
-- y los drops pasan por las funciones anteriores, que filtran sus resultados.
revoke all on table public.admin_profiles, public.drops, public.products from anon;
grant select on table public.admin_profiles to authenticated;
grant all on table public.drops, public.products to authenticated;

alter table public.admin_profiles enable row level security;
alter table public.drops enable row level security;
alter table public.products enable row level security;

drop policy if exists "admins can see themselves" on public.admin_profiles;
drop policy if exists "public can see active drops" on public.drops;
drop policy if exists "admins manage drops" on public.drops;
drop policy if exists "public can see products" on public.products;
drop policy if exists "admins manage products" on public.products;
create policy "admins can see themselves" on public.admin_profiles for select to authenticated using (user_id = auth.uid());
create policy "admins manage drops" on public.drops for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admins manage products" on public.products for all to authenticated using (public.is_admin()) with check (public.is_admin());

insert into storage.buckets (id, name, public) values ('product-images', 'product-images', true) on conflict (id) do update set public = true;
drop policy if exists "admins upload product images" on storage.objects;
drop policy if exists "admins update product images" on storage.objects;
drop policy if exists "admins delete product images" on storage.objects;
create policy "admins upload product images" on storage.objects for insert to authenticated with check (bucket_id = 'product-images' and public.is_admin() and name like (auth.uid()::text || '/%'));
create policy "admins update product images" on storage.objects for update to authenticated using (bucket_id = 'product-images' and public.is_admin() and name like (auth.uid()::text || '/%')) with check (bucket_id = 'product-images' and public.is_admin() and name like (auth.uid()::text || '/%'));
create policy "admins delete product images" on storage.objects for delete to authenticated using (bucket_id = 'product-images' and public.is_admin() and name like (auth.uid()::text || '/%'));

-- Obliga a PostgREST a detectar los RPC recién creados o actualizados.
-- Sin este aviso, el endpoint /rpc/save_active_drop puede responder 404 hasta
-- que su caché de esquema se actualice.
notify pgrst, 'reload schema';

-- EJEMPLO: autorizar un usuario del panel:
-- insert into public.admin_profiles (user_id)
-- select id from auth.users where email = 'admin@ejemplo.com'
-- on conflict do nothing;
