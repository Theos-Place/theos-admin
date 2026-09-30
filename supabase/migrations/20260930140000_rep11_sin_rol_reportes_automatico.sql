-- REP-11 · Se retira el rol `reportes` que el puesto de anfitrión otorgaba solo.
--
-- PAR-3 (2026-09-23) mapeó el puesto «Anfitrión» de los comités de sede al rol
-- `reportes` para que esa persona viera la asistencia de su sede. El rol abre
-- los SIETE reportes, así que de paso repartió Discípulos Multiplicadores,
-- Retención y Dirigentes, que nadie había pedido.
--
-- MEDIDO EL 2026-09-30, antes de escribir esto: 29 personas tienen el rol
-- activo. 21 por este mapeo (todas anfitrionas, `origen='automatico'`, con su
-- fila en `member_role_position_grants`) y 8 a mano (`origen='manual'`, sin
-- grant). El corte es limpio: ninguna cae en las dos.
--
-- ESTA MIGRACIÓN TOCA SOLO LAS 21. Las asignadas a mano no se tocan — la regla
-- de la casa, y además son cuentas institucionales (Comunicación, Finanzas,
-- RH, Estudios Bíblicos) y personas a las que alguien se lo dio a propósito.
--
-- El acceso de las 21 NO desaparece: el código que va con esta migración les
-- sigue abriendo Crecimiento/Asistencia y Personas Nuevas por su PUESTO, sin
-- rol de por medio. Por eso la migración y el deploy van juntos: aplicada
-- sola, esas 21 personas se quedan sin nada hasta que suba el código.
--
-- El mecanismo de sync se queda intacto: lo que se quitó es la regla de
-- `lib/servers/position-roles.ts`, así que no vuelve a otorgarse.

begin;

-- 1) Los grants por puesto. Sin borrarlos, la próxima sincronización de ese
--    puesto vería el grant y podría reponer el rol.
delete from public.member_role_position_grants
 where role = 'reportes';

-- 2) El rol en sí, SOLO el automático. `origen` es lo que distingue: un
--    `is_active=false` sobre una fila manual le quitaría el acceso a alguien
--    que sí debía tenerlo, y esta migración no tiene forma de devolvérselo.
update public.member_roles
   set is_active  = false,
       revoked_at = now(),
       status_detail = 'REP-11: el puesto de anfitrión ya no otorga el rol reportes; '
                       'el acceso a Crecimiento y Personas Nuevas va por puesto'
 where role = 'reportes'
   and is_active
   and origen = 'automatico';

commit;
