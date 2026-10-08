-- Ejecutar en el SQL Editor de Supabase para guardar el largo de mangas (cm).
alter table public.products
  add column if not exists sleeve_length_cm numeric(6,2)
  check (sleeve_length_cm >= 0);

-- Actualizar la caché de columnas de la API.
notify pgrst, 'reload schema';
