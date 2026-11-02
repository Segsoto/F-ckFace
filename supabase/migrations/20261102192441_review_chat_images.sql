-- Requiere 20261102183624_customer_reviews.sql. Aplicar una vez en el proyecto de config.js.
begin;

alter table public.customer_reviews
  add column source text not null default 'customer' check (source in ('customer', 'chat')),
  add column image_path text,
  alter column rating drop not null;

alter table public.customer_reviews drop constraint customer_reviews_comment_check;
alter table public.customer_reviews add constraint customer_reviews_content_check check (
  (source = 'customer' and image_path is null and rating is not null
    and char_length(btrim(comment)) between 10 and 1500)
  or
  (source = 'chat' and rating is null and char_length(btrim(comment)) <= 1500
    and image_path is not null
    and image_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|png|webp)$')
);

create unique index customer_reviews_image_path_idx
  on public.customer_reviews(image_path) where image_path is not null;

-- Los visitantes siguen sin poder enviar adjuntos ni elegir el origen.
drop policy "Customers submit pending reviews" on public.customer_reviews;
create policy "Customers submit pending reviews"
  on public.customer_reviews for insert to anon, authenticated
  with check (status = 'pending' and reviewed_at is null and source = 'customer' and image_path is null);

grant insert (source, image_path) on public.customer_reviews to authenticated;
create policy "Admins submit chat testimonials"
  on public.customer_reviews for insert to authenticated
  with check (
    source = 'chat' and status = 'pending' and reviewed_at is null
    and split_part(image_path, '/', 1) = (select auth.uid())::text
    and exists (select 1 from public.admin_profiles where user_id = (select auth.uid()))
  );

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('review-chats', 'review-chats', false, 1500000, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = false, file_size_limit = 1500000,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

create policy "Admins upload review chat images"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'review-chats'
    and split_part(name, '/', 1) = (select auth.uid())::text
    and exists (select 1 from public.admin_profiles where user_id = (select auth.uid()))
  );

create policy "Admins read review chat images"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'review-chats'
    and exists (select 1 from public.admin_profiles where user_id = (select auth.uid()))
  );

create policy "Public reads approved review chat images"
  on storage.objects for select to anon, authenticated
  using (
    bucket_id = 'review-chats'
    and exists (
      select 1 from public.customer_reviews r
      where r.source = 'chat' and r.status = 'approved' and r.image_path = storage.objects.name
    )
  );

-- Solo limpiar cargas fallidas sin referencias. Nunca borrar imágenes de una reseña guardada.
create policy "Admins remove unreferenced review chat images"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'review-chats'
    and exists (select 1 from public.admin_profiles where user_id = (select auth.uid()))
    and not exists (select 1 from public.customer_reviews r where r.image_path = storage.objects.name)
  );

notify pgrst, 'reload schema';
commit;
