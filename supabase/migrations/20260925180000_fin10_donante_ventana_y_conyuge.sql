-- FIN-10 · Donante activo: la ventana pasa a 4 meses y la donación cuenta
-- también para el cónyuge.
--
-- 1. VENTANA. Mes actual + los 3 CALENDARIO anteriores (antes eran 2, PAR-1).
--    El 25 de setiembre cuenta desde el 1 de junio. Son meses calendario y no
--    «90 días hacia atrás»: con días corridos, quien donó el 2 del mes pasado
--    se cae de la lista a mitad de este, y el criterio deja de poder explicarse
--    en una frase.
--
--    El número vive también en `lib/finance/ventana-de-donante.ts`, y no se
--    pueden separar sin que falle `ventana-de-donante.test.ts`: ese test lee
--    ESTA migración y compara el INTERVAL con la constante.
--
-- 2. CÓNYUGE. Una donación registrada a nombre de alguien marca también a su
--    pareja. SE EXTIENDE EL ESTADO, NO LA PLATA: no se insertan donaciones
--    espejo, así que ningún total ni reporte financiero cambia — lo único que
--    se mueve es el booleano `members.is_donor`.
--
--    Por qué acá y no en cada consulta: `is_donor` es la bandera que leen el
--    filtro de donadores (FIN-1), el compromiso de servidores (SRV-4/REP-7), la
--    elegibilidad de estudios y el dashboard. Poniéndolo en la función que
--    mantiene la bandera, todos se enteran solos y nadie puede quedar con una
--    definición vieja.
--
--    QUIÉN ES «CÓNYUGE»: la otra persona con relación Titular o Cónyuge dentro
--    de la misma unidad familiar. Hijos, «Otro» y «Madre» NO cuentan. El modelo
--    lo permite sin ambigüedad, verificado el 2026-09-25: 825 unidades tienen
--    exactamente dos, 760 tienen una sola, NINGUNA tiene tres o más, y nadie
--    figura como Titular/Cónyuge en dos unidades a la vez.
--
-- EFECTO MEDIDO contra producción el 2026-09-25, antes de aplicar:
--   · hoy, ventana de 3 meses:            547 donantes
--   · solo ampliando la ventana a 4:      547  (no cambia: MAYO Y JUNIO NO
--     TIENEN NINGUNA DONACIÓN REGISTRADA — los meses con datos son abril 548,
--     julio 453, agosto 115 y setiembre 6. El cambio es correcto igual, pero
--     hoy no mueve a nadie, y ese hueco de dos meses merece revisarse aparte.)
--   · ventana de 4 + cónyuge:             577  (+30)

create or replace function public.refresh_donor_flags()
returns void
language sql
set search_path to 'public'
as $$
  with ventana as (
    select (date_trunc('month', current_date) - interval '3 months')::date as desde
  ),
  donantes as (
    select distinct d.member_id as id
    from donations d, ventana v
    where d.member_id is not null
      and d.donation_date >= v.desde
  ),
  parejas as (
    select a.member_id as uno, b.member_id as otro
    from family_members a
    join family_members b
      on b.family_unit_id = a.family_unit_id
     and b.member_id <> a.member_id
    where a.relation in ('Titular', 'Cónyuge')
      and b.relation in ('Titular', 'Cónyuge')
  ),
  con_bandera as (
    select id from donantes
    union
    select p.otro from parejas p join donantes d on d.id = p.uno
  )
  update members m
     set is_donor = calc.flag
    from (
      select m2.id,
             exists (select 1 from con_bandera cb where cb.id = m2.id) as flag
        from members m2
    ) calc
   where calc.id = m.id
     and m.is_donor is distinct from calc.flag;
$$;

-- El trigger marca al donante Y a su pareja en el acto, para que el estado no
-- espere al recálculo. Solo pone TRUE: quitar la bandera cuando la ventana se
-- corre es trabajo de `refresh_donor_flags`, igual que antes.
create or replace function public.set_donor_on_donation()
returns trigger
language plpgsql
set search_path to 'public'
as $$
BEGIN
  IF NEW.member_id IS NOT NULL
     AND NEW.donation_date >= (date_trunc('month', CURRENT_DATE) - INTERVAL '3 months')::date THEN
    UPDATE members SET is_donor = TRUE
     WHERE is_donor IS DISTINCT FROM TRUE
       AND (
         id = NEW.member_id
         OR id IN (
           SELECT b.member_id
             FROM family_members a
             JOIN family_members b
               ON b.family_unit_id = a.family_unit_id
              AND b.member_id <> a.member_id
            WHERE a.member_id = NEW.member_id
              AND a.relation IN ('Titular', 'Cónyuge')
              AND b.relation IN ('Titular', 'Cónyuge')
         )
       );
  END IF;
  RETURN NEW;
END;
$$;

-- Ninguna de las dos es SECURITY DEFINER, pero el `search_path` fijo va igual:
-- sin él resuelven sus nombres contra el path de quien las llama. Y una función
-- de `public` nace con EXECUTE para PUBLIC, que PostgREST publica en
-- /rest/v1/rpc — `create or replace` conserva los permisos, pero se repiten acá
-- para que la migración deje el estado explícito (SEC-3).
revoke execute on function public.refresh_donor_flags() from public, anon, authenticated;
grant  execute on function public.refresh_donor_flags() to service_role;
revoke execute on function public.set_donor_on_donation() from public, anon, authenticated;
grant  execute on function public.set_donor_on_donation() to service_role;

-- Recalcular con la regla nueva, para que la bandera no quede vieja hasta el
-- próximo cron.
select public.refresh_donor_flags();
