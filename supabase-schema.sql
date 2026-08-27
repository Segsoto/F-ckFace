-- F-ck Face · ejecutar completo en Supabase SQL Editor.
-- 1) Los usuarios del panel se crean en Authentication > Users.
-- 2) Después de crearlos, autorízalos con el bloque de ejemplo al final.

create extension if not exists pgcrypto;

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
  category text not null check (category in ('camisas','pantalones','abrigos','buzos','accesorios','otros')),
  size text,
  condition text,
  description text,
  image_urls text[] not null default '{}',
  status text not null default 'new_drop' check (status in ('new_drop','published')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.admin_profiles where user_id = auth.uid()) $$;

-- Esta función se llama al cargar la tienda y al llegar a cero el contador.
-- Publica las piezas del New Drop en su categoría y cierra ese drop.
create or replace function public.release_due_drops()
returns void language plpgsql security definer set search_path = public
as $$
begin
  if exists (select 1 from public.drops where is_active and release_at <= now()) then
    update public.products set status = 'published', updated_at = now() where status = 'new_drop';
    update public.drops set is_active = false where is_active and release_at <= now();
  end if;
end;
$$;

grant execute on function public.release_due_drops() to anon, authenticated;

alter table public.admin_profiles enable row level security;
alter table public.drops enable row level security;
alter table public.products enable row level security;

create policy "admins can see themselves" on public.admin_profiles for select to authenticated using (user_id = auth.uid());
create policy "public can see active drops" on public.drops for select using (is_active);
create policy "admins manage drops" on public.drops for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "public can see products" on public.products for select using (true);
create policy "admins manage products" on public.products for all to authenticated using (public.is_admin()) with check (public.is_admin());

insert into storage.buckets (id, name, public) values ('product-images', 'product-images', true) on conflict (id) do update set public = true;
create policy "admins upload product images" on storage.objects for insert to authenticated with check (bucket_id = 'product-images' and public.is_admin());
create policy "admins update product images" on storage.objects for update to authenticated using (bucket_id = 'product-images' and public.is_admin());
create policy "admins delete product images" on storage.objects for delete to authenticated using (bucket_id = 'product-images' and public.is_admin());

-- EJEMPLO: corré esto por cada usuario creado (cambiá el email):
-- insert into public.admin_profiles (user_id)
-- select id from auth.users where email = 'admin@tudominio.com'
-- on conflict do nothing;
