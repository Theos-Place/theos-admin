-- Donante activo = donó al menos una vez en los últimos 6 meses, contando el
-- mes actual. Decisión del usuario, 2026-09-16.
--
-- ANTES: la ventana arrancaba en el inicio del trimestre de hace dos
-- trimestres, o sea `date_trunc('quarter', current_date) - 6 months`. Eso hacía
-- que el período se estirara de 6 a 9 meses dentro de cada trimestre y se
-- recortara de golpe el día 1 del siguiente. El 16-set-2026 la ventana llevaba
-- 258 días abiertos (8,5 meses) y marcaba 733 personas.
--
-- AHORA: desde el primer día del mes que está 5 meses atrás, para que el mes en
-- curso cuente como uno de los seis. Hoy eso es el 2026-04-01 y da 614
-- personas.
--
-- LO QUE HAY QUE SABER SOBRE ESTE DATO. Las donaciones NO entran como
-- transacciones individuales: se cargan consolidadas por trimestre, una fila
-- por persona, siempre con fecha del día 1 (1-ene, 1-abr, 1-jul, 1-oct). Sobre
-- ese grano, una ventana de 6 meses alcanza DOS cargas o UNA según el mes:
--
--   set-2026 → agarra las cargas de abr y jul  → 614 personas
--   oct-2026 → solo la de jul, hasta que entre la de oct → 433 personas
--
-- Son 181 personas de diferencia sin que nadie cambie de comportamiento. La
-- regla anterior alineaba la ventana al trimestre justamente para evitar ese
-- salto. Queda escrito acá porque cuando alguien vea el número moverse en
-- octubre va a buscar una explicación, y es esta.

create or replace function public.refresh_donor_flags()
returns void
language sql
set search_path to 'public'
as $function$
  UPDATE members m
  SET is_donor = calc.flag
  FROM (
    SELECT m2.id,
           EXISTS (
             SELECT 1 FROM donations d
             WHERE d.member_id = m2.id
               -- Mes actual + los 5 anteriores.
               AND d.donation_date >= (date_trunc('month', CURRENT_DATE) - INTERVAL '5 months')::date
           ) AS flag
    FROM members m2
  ) calc
  WHERE calc.id = m.id
    AND m.is_donor IS DISTINCT FROM calc.flag;
$function$;

-- La misma ventana al insertar una donación, para no tener dos definiciones que
-- puedan separarse. Esta solo enciende la bandera; apagarla es trabajo del cron
-- diario (pg_cron 'refresh-donor-flags', 06:30 UTC).
create or replace function public.set_donor_on_donation()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
BEGIN
  IF NEW.member_id IS NOT NULL
     AND NEW.donation_date >= (date_trunc('month', CURRENT_DATE) - INTERVAL '5 months')::date THEN
    UPDATE members SET is_donor = TRUE
    WHERE id = NEW.member_id AND is_donor IS DISTINCT FROM TRUE;
  END IF;
  RETURN NEW;
END;
$function$;

-- Dejar el dato consistente con la definición nueva desde ya, sin esperar al
-- cron de la madrugada.
select public.refresh_donor_flags();
