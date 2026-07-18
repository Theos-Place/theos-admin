-- Detecta pares de miembros probablemente duplicados por email, cédula,
-- teléfono (normalizado) o nombre completo. Excluye los descartados.
create or replace function find_duplicate_pairs()
returns table(member_a uuid, member_b uuid, reasons text[])
language sql stable
set search_path = public
as $$
  with pairs as (
    select least(a.id,b.id) ma, greatest(a.id,b.id) mb, 'email'::text reason
      from members a join members b on a.id < b.id and lower(a.email) = lower(b.email)
      where a.email is not null and a.email <> ''
    union all
    select least(a.id,b.id), greatest(a.id,b.id), 'cedula'
      from members a join members b on a.id < b.id and a.cedula = b.cedula
      where a.cedula is not null and a.cedula <> ''
    union all
    select least(a.id,b.id), greatest(a.id,b.id), 'telefono'
      from members a join members b on a.id < b.id
        and regexp_replace(a.phone,'[^0-9]','','g') = regexp_replace(b.phone,'[^0-9]','','g')
      where a.phone is not null and length(regexp_replace(a.phone,'[^0-9]','','g')) >= 8
    union all
    select least(a.id,b.id), greatest(a.id,b.id), 'nombre'
      from members a join members b on a.id < b.id
        and lower(trim(a.first_name||' '||a.last_name)) = lower(trim(b.first_name||' '||b.last_name))
      where a.first_name <> '' and a.last_name <> ''
  )
  select p.ma, p.mb, array_agg(distinct p.reason)
  from pairs p
  where not exists (select 1 from duplicate_dismissals d where d.member_a = p.ma and d.member_b = p.mb)
  group by p.ma, p.mb
  limit 200;
$$;
revoke execute on function find_duplicate_pairs() from public, anon, authenticated;
grant execute on function find_duplicate_pairs() to service_role;
