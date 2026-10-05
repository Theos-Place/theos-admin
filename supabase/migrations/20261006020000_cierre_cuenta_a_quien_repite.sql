-- EST-24 · El cierre cuenta a quien está REPITIENDO el nivel.
--
-- EL CASO (reportado el 2026-10-05): Mariela Hernández llevó los cuatro
-- niveles en 2020 y los está volviendo a llevar con Ma. Fernanda Valverde.
-- Mafe cerró el Nivel 3, Mariela aprobó, y no salió en el correo de
-- aprobados — aunque estaba en el grupo y el dirigente la vio en la pantalla
-- de cierre.
--
-- POR QUÉ. La carga masiva del 18 de julio enganchó las aprobaciones viejas
-- a los grupos nuevos: la matrícula de Mariela en el grupo de 2026 nació ya
-- con `status = 'completed'` y `completed_at = 2020-06-29`. Y los dos UPDATE
-- de esta función terminaban en `AND status = 'enrolled'`, así que su fila
-- no calzaba y el cierre la saltaba EN SILENCIO. Su `completed_at` se quedó
-- en 2020, y la regla que separa el arrastre del import —aprobó antes de que
-- el grupo empezara, así que no cuenta en este cierre— la dejó fuera de la
-- lista. La regla está bien; el dato estaba mal.
--
-- POR QUÉ NO ERA RIESGOSO QUITARLO. El candado de la FILA no estaba
-- protegiendo nada que el candado del GRUPO no proteja ya: la primera
-- sentencia exige `status <> 'finalizado'` y devuelve false si el grupo ya
-- se cerró, así que el bucle corre una sola vez en la vida del grupo. Y el
-- bucle solo recorre `p_results`, o sea ÚNICAMENTE las personas que el
-- dirigente evaluó: ampliar los estados no toca a nadie que no haya sido
-- evaluado a propósito.
--
-- QUÉ ESTADOS SE AGREGAN Y CUÁLES NO. Entra `completed`, que es el caso de
-- quien repite. NO entran `dropped`, `cancelada` ni `transferred`: son
-- salidas deliberadas y un cierre no debería revivirlas sin que alguien lo
-- decida. `en_revision` tampoco: ese estado ya se reporta aparte como «quedó
-- sin evaluar» y mezclarlo acá taparía ese aviso.
--
-- Medido en producción el 2026-10-05: 15 personas en 13 grupos de 2026
-- quedaron fuera de su correo de cierre por esto. Sus datos se corrigen
-- aparte, preguntándole a cada dirigente si la persona estaba llevando el
-- estudio; acá se arregla para que no vuelva a pasar.

create or replace function public.close_group(
  p_group_id uuid,
  p_results  jsonb,
  p_closed_by uuid default null::uuid
)
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $function$
DECLARE
  r jsonb;
  v_now timestamptz := now();
BEGIN
  UPDATE study_groups SET status = 'finalizado', closed_at = v_now, closed_by = p_closed_by
  WHERE id = p_group_id AND status <> 'finalizado';
  IF NOT FOUND THEN RETURN false; END IF;

  FOR r IN SELECT * FROM jsonb_array_elements(coalesce(p_results, '[]'::jsonb)) LOOP
    IF r->>'status_result' = 'retirado' THEN
      UPDATE study_enrollments
      SET status = 'dropped', dropped_at = v_now,
          drop_reason = CASE
            WHEN coalesce(trim(r->>'withdraw_reason'), '') <> ''
              THEN 'Retirado en cierre: ' || trim(r->>'withdraw_reason')
            ELSE 'Retirado en cierre'
          END
      WHERE group_id = p_group_id AND member_id = (r->>'member_id')::uuid
        -- EST-24: antes era `status = 'enrolled'`. Quien repetía un nivel ya
        -- venía como 'completed' y el cierre lo saltaba sin avisar.
        AND status IN ('enrolled', 'completed');
    ELSE
      UPDATE study_enrollments
      SET status = 'completed', completed_at = v_now,
          grade = NULLIF(r->>'grade', '')::numeric,
          notes = CASE
            WHEN r->>'status_result' = 'reprobado' AND coalesce(trim(r->>'fail_reason'), '') <> ''
              THEN 'reprobado: ' || trim(r->>'fail_reason')
            ELSE r->>'status_result'
          END
      WHERE group_id = p_group_id AND member_id = (r->>'member_id')::uuid
        AND status IN ('enrolled', 'completed');
    END IF;
  END LOOP;

  RETURN true;
END;
$function$;

-- La función es SECURITY DEFINER y la app la llama con la llave de servicio
-- (AGENTS.md / SEC-3): se vuelve a cerrar porque `create or replace` conserva
-- los permisos, pero dejarlo explícito evita que un `drop` futuro la reabra.
revoke execute on function public.close_group(uuid, jsonb, uuid) from public, anon, authenticated;
grant  execute on function public.close_group(uuid, jsonb, uuid) to service_role;
