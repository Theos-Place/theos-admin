-- La fusión deja de copiar las columnas que son ESPEJO de otra cosa.
--
-- QUÉ SE ROMPIÓ, en la primera fusión de verdad. merge_members rellena los
-- huecos del principal con coalesce(principal, duplicado). Entre esas columnas
-- iba `last_sign_in_at`, que no es un dato de la persona: es el espejo de
-- auth.users.last_sign_in_at de SU cuenta.
--
-- Ximena Solórzano tenía dos fichas. La que sobrevivió nunca había entrado; la
-- otra sí, el 8 de setiembre. El coalesce le copió esa fecha a la que
-- sobrevivió, y quedó una ficha diciendo "entró el 8 de setiembre" mientras la
-- cuenta a la que apunta no se usó nunca. El perfil lee Auth directo, así que
-- mostraba "nunca ha entrado" y la lista mostraba lo contrario.
--
-- Peor: esa misma columna es la que mira la regla que decide cuál ficha
-- sobrevive. Contaminarla vuelve la regla ciega justo para la próxima fusión.
--
-- La lista de exclusión ahora incluye todo lo que es espejo, derivado o
-- identificador propio de la fila:
--   · espejos de Auth        → last_sign_in_at, account_confirmed_at
--   · estado de correo       → email_bounced*, email_complained*, newsletter_opt_out*
--   · tokens propios         → smart_link_token, unsubscribe_token, wallet_pass_id
--   · derivados por trigger  → cedula_normalized, search_text
--   · sede calculada         → sede_id, sede_case, sede_last_checkin
-- Ninguno se decide campo por campo en la pantalla, y copiarlos del duplicado
-- produce una ficha que afirma cosas de una cuenta que no es la suya.

CREATE OR REPLACE FUNCTION public.merge_no_copia()
RETURNS text[] LANGUAGE sql IMMUTABLE AS $$
  SELECT ARRAY[
    'id','created_at','updated_at','auth_user_id','external_id',
    'is_active','deactivation_reason','deactivated_at','deactivated_by',
    'last_sign_in_at','account_confirmed_at',
    'email_bounced','email_bounced_at','email_complained','email_complained_at',
    'newsletter_opt_out','newsletter_opt_out_at',
    'smart_link_token','unsubscribe_token','wallet_pass_id',
    'cedula_normalized','search_text',
    'sede_id','sede_case','sede_last_checkin'
  ]
$$;

COMMENT ON FUNCTION public.merge_no_copia() IS
  'Columnas de members que la fusión NO copia del duplicado: espejos de Auth, estado de correo, tokens y derivados. Ver migración 20260914200000.';
