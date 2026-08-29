-- submit_form_response: quitarle EXECUTE a anon y authenticated.
--
-- La función es SECURITY DEFINER (corre con los privilegios de su dueño) y
-- estaba expuesta en la API REST a los roles públicos. Es la ÚNICA de las 26
-- SECURITY DEFINER de `public` que lo estaba: las otras 25 ya eran solo
-- service_role, así que esto fue un olvido al crearla (migración 119) y no una
-- decisión.
--
-- QUÉ PERMITÍA. Verificado el 2026-08-29 llamándola con la anon key —la que va
-- en el bundle del navegador y cualquiera puede leer—: la llamada llegó hasta
-- el INSERT y solo falló por la FK del form_id inventado. Con un id válido
-- habría creado la respuesta, y como `p_member_id` es un parámetro, A NOMBRE DE
-- CUALQUIER MIEMBRO.
--
-- Eso salteaba todos los controles de la aplicación: que el formulario esté
-- abierto y vigente, la regla de convocatoria, el tope por IP, la identidad del
-- invitado y el filtro de campos válidos.
--
-- No rompe nada: los dos únicos llamadores (submitResponse en queries/forms.ts
-- y la encuesta al dirigente en queries/leader-feedback.ts) usan service role.

REVOKE EXECUTE ON FUNCTION public.submit_form_response(uuid, uuid, text, text, jsonb, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.submit_form_response(uuid, uuid, text, text, jsonb, uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.submit_form_response(uuid, uuid, text, text, jsonb, uuid) FROM PUBLIC;

-- Explícito, para que se lea de un vistazo quién sí puede.
GRANT EXECUTE ON FUNCTION public.submit_form_response(uuid, uuid, text, text, jsonb, uuid) TO service_role;
