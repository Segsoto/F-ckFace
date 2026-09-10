-- Ejecutar en el proyecto existente; también incluido en supabase-schema.sql.
begin;
alter table public.drops add column if not exists name text not null default 'New Drop';
create table if not exists public.drop_passwords (
  drop_id uuid primary key references public.drops(id) on delete cascade,
  password text not null
);
alter table public.drop_passwords enable row level security;
revoke all on public.drop_passwords from public, anon, authenticated;
grant select on public.drop_passwords to authenticated;
drop policy if exists "admins read drop passwords" on public.drop_passwords;
create policy "admins read drop passwords" on public.drop_passwords
  for select to authenticated using ((select public.is_admin()));

create or replace function public.save_managed_drop(
  p_drop_id uuid, p_name text, p_exclusive_at timestamptz,
  p_public_at timestamptz, p_password text, p_description text default null
) returns uuid language plpgsql security definer set search_path = '' as $$
declare target_id uuid; existing public.drops;
begin
  if not public.is_admin() then raise exception 'No autorizado.'; end if;
  -- Serializa creación y edición para conservar un único drop activo.
  lock table public.drops in share row exclusive mode;
  if p_drop_id is not null then
    select * into existing from public.drops where id = p_drop_id for update;
    if not found or not existing.is_active or existing.public_at <= now() then
      raise exception 'El drop ya no está activo. Actualizá el panel.';
    end if;
  elsif exists(select 1 from public.drops where is_active) then
    raise exception 'Ya existe un drop activo. Actualizá el panel para editarlo.';
  end if;
  if p_exclusive_at is null or p_public_at is null or p_public_at <= now()
     or p_public_at <= p_exclusive_at
     or (p_drop_id is null and p_exclusive_at <= now()) then
    raise exception 'Las fechas del drop no son válidas.';
  end if;
  if coalesce(trim(p_name), '') = '' or length(p_name) > 160
     or length(coalesce(p_password, '')) > 200 or length(coalesce(p_description, '')) > 2000 then
    raise exception 'Revisá el nombre, la contraseña y la nota del drop.';
  end if;
  if p_drop_id is null then
    if coalesce(trim(p_password), '') = '' then raise exception 'Ingresá una contraseña.'; end if;
    insert into public.drops(name, release_at, exclusive_at, public_at, description, access_password_hash)
    values(trim(p_name), p_public_at, p_exclusive_at, p_public_at, p_description,
      extensions.crypt(p_password, extensions.gen_salt('bf'))) returning id into target_id;
  else
    target_id := p_drop_id;
    update public.drops set name = trim(p_name), release_at = p_public_at,
      exclusive_at = p_exclusive_at, public_at = p_public_at, description = p_description,
      access_password_hash = case when coalesce(trim(p_password), '') = '' then access_password_hash
        else extensions.crypt(p_password, extensions.gen_salt('bf')) end
    where id = target_id;
  end if;
  if coalesce(trim(p_password), '') <> '' then
    insert into public.drop_passwords(drop_id, password) values(target_id, p_password)
    on conflict(drop_id) do update set password = excluded.password;
  end if;
  return target_id;
end;
$$;
revoke all on function public.save_managed_drop(uuid,text,timestamptz,timestamptz,text,text) from public, anon;
grant execute on function public.save_managed_drop(uuid,text,timestamptz,timestamptz,text,text) to authenticated;

create or replace function public.deactivate_drop(p_drop_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'No autorizado.'; end if;
  update public.drops set is_active = false where id = p_drop_id and is_active;
  if not found then raise exception 'El drop ya no está activo. Actualizá el panel.'; end if;
end;
$$;
revoke all on function public.deactivate_drop(uuid) from public, anon;
grant execute on function public.deactivate_drop(uuid) to authenticated;
notify pgrst, 'reload schema';
commit;
