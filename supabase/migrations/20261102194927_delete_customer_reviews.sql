-- Requiere las dos migraciones previas de reseñas. No borra reseñas existentes.
begin;

grant delete on public.customer_reviews to authenticated;
create policy "Admins delete customer reviews"
  on public.customer_reviews for delete to authenticated
  using (exists (select 1 from public.admin_profiles where user_id = (select auth.uid())));

create table public.review_image_cleanup (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null unique,
  image_path text not null unique check (image_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|png|webp)$'),
  created_at timestamptz not null default now()
);
create index review_image_cleanup_created_idx on public.review_image_cleanup(created_at);
alter table public.review_image_cleanup enable row level security;
revoke all on public.review_image_cleanup from public, anon, authenticated;
grant select, insert, delete on public.review_image_cleanup to authenticated;

create policy "Admins read review image cleanup"
  on public.review_image_cleanup for select to authenticated
  using (exists (select 1 from public.admin_profiles where user_id = (select auth.uid())));

create policy "Admins queue review image cleanup"
  on public.review_image_cleanup for insert to authenticated
  with check (exists (select 1 from public.admin_profiles where user_id = (select auth.uid())));

create policy "Admins finish review image cleanup"
  on public.review_image_cleanup for delete to authenticated
  using (
    exists (select 1 from public.admin_profiles where user_id = (select auth.uid()))
    and not exists (
      select 1 from storage.objects o
      where o.bucket_id = 'review-chats' and o.name = review_image_cleanup.image_path
    )
  );

create function public.queue_deleted_review_image()
returns trigger language plpgsql security invoker set search_path = ''
as $$
begin
  if old.image_path is not null then
    insert into public.review_image_cleanup(review_id, image_path)
      values (old.id, old.image_path)
      on conflict (review_id) do nothing;
  end if;
  return old;
end;
$$;
revoke all on function public.queue_deleted_review_image() from public, anon, authenticated;

create trigger queue_deleted_review_image
  after delete on public.customer_reviews
  for each row execute function public.queue_deleted_review_image();

notify pgrst, 'reload schema';
commit;
