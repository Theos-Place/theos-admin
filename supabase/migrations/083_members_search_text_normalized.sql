-- Columna normalizada (sin acentos, minúscula) que concatena los campos buscables
-- de members; la búsqueda hace ilike contra ella (insensible a tildes/ñ).
alter table members add column if not exists search_text text
  generated always as (
    lower(public.immutable_unaccent(
      coalesce(first_name,'') || ' ' || coalesce(last_name,'') || ' ' ||
      coalesce(cedula,'') || ' ' || coalesce(email,'') || ' ' || coalesce(phone,'')
    ))
  ) stored;

create index if not exists idx_members_search_text on members using gin (search_text extensions.gin_trgm_ops);
