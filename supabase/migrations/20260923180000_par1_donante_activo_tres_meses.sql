-- PAR-1 · Donante activo: de 6 meses a 3.
--
-- Decisión del usuario (2026-09-23). La ventana pasa a ser el mes actual más
-- los DOS anteriores; antes eran el actual más cinco.
--
-- EFECTO MEDIDO ANTES DE APLICARLO, contra la base real: los donantes activos
-- bajan de **627 a 446**. Ciento ochenta y una personas dejan de serlo y nadie
-- entra —achicar la ventana no puede sumar—. De esas 181, **23 están hoy
-- cursando** alguno de los 14 estudios que exigen donante activo; siguen
-- adentro, porque la elegibilidad se evalúa al matricular, pero no calificarían
-- para el siguiente nivel sin volver a donar.
--
-- EL NÚMERO VIVE EN DOS LADOS y no hay forma de evitarlo: acá, que es quien
-- marca la bandera, y en `src/lib/finance/ventana-de-donante.ts`, que arma el
-- texto de las pantallas. Un `.sql` no puede importar TypeScript. Lo que sí
-- hay es un test (`ventana-de-donante.test.ts`) que LEE esta migración y falla
-- si el INTERVAL deja de coincidir con la constante, así que no se pueden
-- separar en silencio. Si cambia la regla, se cambian los dos y el test avisa.
--
-- Las dos funciones se redefinen enteras con `create or replace` en vez de
-- parchear el intervalo: así el archivo dice qué quedó, y no hay que ir a la
-- base a averiguarlo.

CREATE OR REPLACE FUNCTION public.refresh_donor_flags()
 RETURNS void
 LANGUAGE sql
 SET search_path TO 'public'
AS $function$
  UPDATE members m
  SET is_donor = calc.flag
  FROM (
    SELECT m2.id,
           EXISTS (
             SELECT 1 FROM donations d
             WHERE d.member_id = m2.id
               -- Mes actual + los 2 anteriores (PAR-1, 2026-09-23).
               AND d.donation_date >= (date_trunc('month', CURRENT_DATE) - INTERVAL '2 months')::date
           ) AS flag
    FROM members m2
  ) calc
  WHERE calc.id = m.id
    AND m.is_donor IS DISTINCT FROM calc.flag;
$function$;

-- El trigger que marca al donar. Sin esto, alguien que dona hoy quedaría sin
-- la bandera hasta que corra el refresco.
CREATE OR REPLACE FUNCTION public.set_donor_on_donation()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.member_id IS NOT NULL
     AND NEW.donation_date >= (date_trunc('month', CURRENT_DATE) - INTERVAL '2 months')::date THEN
    UPDATE members SET is_donor = TRUE
    WHERE id = NEW.member_id AND is_donor IS DISTINCT FROM TRUE;
  END IF;
  RETURN NEW;
END;
$function$;

-- AGENTS.md: una función de `public` nace con EXECUTE para PUBLIC. Estas ya
-- existían cerradas, pero `create or replace` conserva los permisos previos
-- solo si los hubo — repetirlo es barato y deja el archivo autocontenido.
revoke execute on function public.refresh_donor_flags()   from public, anon, authenticated;
revoke execute on function public.set_donor_on_donation() from public, anon, authenticated;
grant  execute on function public.refresh_donor_flags()   to service_role;
grant  execute on function public.set_donor_on_donation() to service_role;

-- Y se recalcula la bandera de una vez: si no, las 181 que salen quedarían
-- marcadas como activas hasta el próximo refresco.
SELECT public.refresh_donor_flags();
