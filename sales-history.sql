-- Ejecutar una vez en el SQL Editor del proyecto que usa config.js antes de publicar el panel actualizado.
-- Conserva las prendas existentes y no mueve ni elimina fotos.
alter table public.products add column if not exists sale_price integer;
alter table public.products add column if not exists sold_at timestamptz;
alter table public.products add column if not exists sale_origin_status text;
alter table public.products add column if not exists image_cleanup_pending text[] not null default '{}';
alter table public.products drop constraint if exists products_status_check;
alter table public.products add constraint products_status_check check (status in ('new_drop','published','sold'));
alter table public.products drop constraint if exists products_sale_check;
alter table public.products add constraint products_sale_check check ((status = 'sold' and sale_price is not null and sale_price >= 0 and sold_at is not null and sale_origin_status in ('new_drop','published')) or (status <> 'sold' and sale_price is null and sold_at is null and sale_origin_status is null));
create table if not exists public.deleted_product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null,
  urls text[] not null default '{}',
  available_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
alter table public.deleted_product_images add column if not exists available_at timestamptz not null default now();
revoke all on table public.deleted_product_images from anon;
grant select, insert, update, delete on table public.deleted_product_images to authenticated;
alter table public.deleted_product_images enable row level security;
drop policy if exists "admins manage deleted product images" on public.deleted_product_images;
create policy "admins manage deleted product images" on public.deleted_product_images for all to authenticated using (public.is_admin()) with check (public.is_admin());
create or replace function public.delete_product_for_admin(p_product_id uuid)
returns uuid language plpgsql security invoker set search_path = public
as $$
declare
  photo_urls text[];
  job_id uuid;
begin
  if not public.is_admin() then raise exception 'No autorizado.'; end if;
  select image_urls || image_cleanup_pending into photo_urls
  from public.products where id = p_product_id and status <> 'sold' for update;
  if not found then raise exception 'La prenda no existe en el inventario.'; end if;
  insert into public.deleted_product_images (product_id, urls)
  values (p_product_id, photo_urls) returning id into job_id;
  delete from public.products where id = p_product_id and status <> 'sold';
  return job_id;
end;
$$;
revoke execute on function public.delete_product_for_admin(uuid) from public;
grant execute on function public.delete_product_for_admin(uuid) to authenticated;
-- Cualquier administrador autorizado puede retirar las fotos de prendas vendidas,
-- incluidas las que originalmente subió otra cuenta administradora.
drop policy if exists "admins delete product images" on storage.objects;
create policy "admins delete product images" on storage.objects for delete to authenticated
  using (bucket_id = 'product-images' and public.is_admin());
notify pgrst, 'reload schema';
