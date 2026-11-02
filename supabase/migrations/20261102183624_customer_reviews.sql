-- Ejecutar en el proyecto indicado por config.js después del esquema base.
begin;

create table public.customer_reviews (
  id uuid primary key default gen_random_uuid(),
  customer_name text not null check (char_length(btrim(customer_name)) between 1 and 60),
  rating smallint not null check (rating between 1 and 5),
  comment text not null check (char_length(btrim(comment)) between 10 and 1500),
  experience text not null default 'both' check (experience in ('service', 'delivery', 'both')),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  constraint customer_reviews_moderation_check check (
    (status = 'pending' and reviewed_at is null)
    or (status in ('approved', 'rejected') and reviewed_at is not null)
  )
);

create index customer_reviews_status_created_idx
  on public.customer_reviews (status, created_at desc, id desc);

alter table public.customer_reviews enable row level security;

-- Supabase puede otorgar privilegios por defecto: partir de permisos explícitos.
revoke all on public.customer_reviews from public, anon, authenticated;
grant select on public.customer_reviews to anon, authenticated;
grant insert (customer_name, rating, comment, experience)
  on public.customer_reviews to anon, authenticated;
grant update (status, reviewed_at) on public.customer_reviews to authenticated;

create policy "Public reads approved customer reviews"
  on public.customer_reviews for select to anon, authenticated
  using (status = 'approved');

create policy "Customers submit pending reviews"
  on public.customer_reviews for insert to anon, authenticated
  with check (status = 'pending' and reviewed_at is null);

-- El acceso a admin_profiles se evalúa únicamente para usuarios autenticados.
create policy "Admins read all customer reviews"
  on public.customer_reviews for select to authenticated
  using (exists (
    select 1 from public.admin_profiles where user_id = (select auth.uid())
  ));

create policy "Admins moderate customer reviews"
  on public.customer_reviews for update to authenticated
  using (exists (
    select 1 from public.admin_profiles where user_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.admin_profiles where user_id = (select auth.uid())
  ));

comment on table public.customer_reviews is
  'Reseñas voluntarias de servicio y entrega. Solo approved es público; moderación por admin_profiles.';

notify pgrst, 'reload schema';
commit;
