-- Búsqueda del padrón insensible a tildes/ñ: extensión unaccent + wrapper inmutable
-- (la forma de 2 args con diccionario es inmutable), necesaria para columna generada.
create extension if not exists unaccent with schema extensions;

create or replace function public.immutable_unaccent(text)
returns text language sql immutable parallel safe
set search_path = extensions
as $func$ select unaccent('unaccent', $1) $func$;
