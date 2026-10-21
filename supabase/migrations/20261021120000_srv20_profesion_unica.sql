-- SRV-20 · Un solo campo «Formación académica / Profesión», y fuera la
-- trayectoria de servicio. Decisiones de Floriana, 2026-10-21.
--
-- 1) La formación y la ocupación del S.I.R.V.E. se FUNDEN en la Profesión de
--    la ficha (`members.occupation`), que es el campo que la persona edita en
--    Info Personal y ahora también desde el S.I.R.V.E. — un solo lugar, nada
--    de dos copias que se desalinean. Regla «juntar los dos»: la ficha va
--    primero (es lo más reciente), después lo de CCB, sin repetir. Medido
--    antes: 673 fichas vacías se llenan, 23 ya decían lo mismo, 265 quedan
--    unidas («Leyes · Licenciado · Abogado»).
--
-- 2) La trayectoria de servicio (trayectoria, motivo_salida, que_espera) se
--    quita: el sistema ya la sabe por los puestos de servicio. Lo importado de
--    CCB (724/364/369 textos) queda en el respaldo
--    docs/correcciones/2026-10-21-perfil-sirve-profesion-unica.json.
--
-- La unión se hace en SQL con la misma regla que `unirProfesion` (lib): se
-- separa por « · », se quitan vacíos y repetidos sin tildes ni mayúsculas.

create or replace function pg_temp.plano(t text) returns text language sql immutable as $$
  select lower(regexp_replace(translate(coalesce(t,''), 'áéíóúÁÉÍÓÚñÑüÜ', 'aeiouAEIOUnNuU'), '\s+', ' ', 'g'))
$$;

with partes as (
  select s.member_id, x.valor, x.orden
  from member_spiritual_data s
  join members m on m.id = s.member_id
  cross join lateral unnest(array[btrim(m.occupation), btrim(s.formacion), btrim(s.ocupacion)]) with ordinality as x(valor, orden)
  where coalesce(s.formacion, s.ocupacion) is not null
), limpias as (
  select member_id, valor, orden,
         row_number() over (partition by member_id, pg_temp.plano(valor) order by orden) rn
  from partes where nullif(valor, '') is not null
), unidas as (
  select member_id, string_agg(valor, ' · ' order by orden) profesion
  from limpias where rn = 1 group by member_id
)
update members m set occupation = u.profesion, updated_at = now()
  from unidas u
 where m.id = u.member_id
   and m.occupation is distinct from u.profesion;

alter table public.member_spiritual_data
  drop column if exists formacion,
  drop column if exists ocupacion,
  drop column if exists trayectoria,
  drop column if exists motivo_salida,
  drop column if exists que_espera;
