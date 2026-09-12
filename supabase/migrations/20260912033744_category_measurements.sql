-- Additive only: existing product values and categories are preserved.
alter table public.products add column if not exists waist_width_cm numeric(6,2) check (waist_width_cm >= 0);
alter table public.products add column if not exists inseam_cm numeric(6,2) check (inseam_cm >= 0);
alter table public.products add column if not exists height_cm numeric(6,2) check (height_cm >= 0);
alter table public.products add column if not exists width_cm numeric(6,2) check (width_cm >= 0);
alter table public.products add column if not exists depth_cm numeric(6,2) check (depth_cm >= 0);
