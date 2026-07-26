# Plan unificado de mejoras — jul 2026

> Une dos fuentes: (a) el feedback de usuarios (filtros, matrícula, prematrimonial, estudios, folletos, pagos) y (b) la deuda técnica/operativa detectada en la auditoría del código (docs/sistema-overview.md §6).
>
> Cada punto con código tiene un prompt listo para pegar en Claude Code. Trabajarlos **uno por uno, en orden dentro de cada fase**. Marcar `[x]` al completar y anotar commit/PR.
>
> Decisiones ya confirmadas:
> - Prematrimonial: la regla nueva es **N1 completado + al menos inscrito en N2** (ambos de la pareja). Relaja la actual (N2 completado).
> - Folletos: las 3 reglas nuevas **reemplazan** la generación por cierre de grupo y por hitos de bloque.
> - Bloqueo de matrícula por pago pendiente: aplica **solo a pagos de estudios/capacitaciones**.

---

## Fase 0 — Operativo (sin código, sesión de configuración)

Checklist de administración; nada de esto pasa por Claude Code:

- [ ] Agregar las env `HEALTHCHECK_URL_*` faltantes en Vercel (incluida `HEALTHCHECK_URL_STORAGE_ORPHANS`) y decidir si `report-snapshots` debe pingear healthcheck.
- [ ] Configurar Sentry (`SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN`).
- [ ] Copiar las env vars de Supabase a los deploys **Preview** de Vercel (hoy solo están en Production y los previews fallan).
- [ ] Verificar que la edge function `process-email-queue` de Supabase no duplique los crons de vercel.json.
- [ ] Confirmar el SMTP de Supabase Auth.

---

## Fase 1 — Deuda rápida + quick wins de UI

### Deuda técnica (de la auditoría)

### [x] DEU-1 · Unificar vocabulario de `vacancies.status` — PR #35 (migración 20260725120000; mapeo draft→creado, published→aprobado, filled/closed→cerrada)

```
En vacancies.status conviven dos vocabularios: legacy (draft/published/filled/closed) y nuevo
(creado/enviado_lider/aprobado/denegado); el código trata published como aprobado. Unificá al
vocabulario nuevo: migración SQL que mapee los valores legacy (published→aprobado; decidí y
documentá el mapeo de draft/filled/closed mirando cómo los consume el código), actualizá el
CHECK de la columna, y limpiá las ramas de compatibilidad en src/app/api/servers/vacancies/* y
componentes de /servidores/vacantes. Revisá también el SELECT público de vacantes
(/api/public/vacancies y la página /vacantes) para que solo exponga aprobadas.
Correr tsc, lint y vitest; agregá test del mapeo si hay lógica de estado.
```

### [x] DEU-2 · Flag `events.is_public` — CERRADO SIN CÓDIGO (decisión 2026-07-26)

> Decisión confirmada: la página de eventos debe ser pública sin auth y mostrar **todos** los
> eventos. Es el comportamiento actual (`/calendario` es ruta pública en el proxy;
> `/api/public/events` expone todo evento no cancelado/archivado, con rate limit y whitelist
> de campos). No se agrega flag `is_public`. Deja de ser deuda.

### [x] DEU-3 · Columna legacy `employees.position` — PR #36 (migración 20260726100000, DROP COLUMN; decisión 2026-07-25: eliminarla, tabla vacía en producción)

```
employees.position es una columna legacy NOT NULL que se rellena desde el puesto por
compatibilidad. Evaluá si ya nada la lee (grep de usos en src/): si es así, migración para
hacerla nullable o eliminarla, y limpiá el código de relleno. Si algo la lee todavía, migrá ese
consumo a paid_positions primero. Cambio pequeño pero tocá con cuidado: es RRHH.
```

### Quick wins del feedback (prematrimonial, revisión de pagos, cierres)

### [ ] PRE-1 · Búsqueda de cónyuge por correo
Archivos: `src/app/(admin)/matricula/prematrimonial/page.tsx`, `src/app/api/studies/prematrimonial/spouse-search/route.ts`

```
En el wizard prematrimonial (src/app/(admin)/matricula/prematrimonial/page.tsx), la búsqueda
de cónyuge del paso 2 solo funciona con cédula, pero el endpoint
src/app/api/studies/prematrimonial/spouse-search/route.ts ya soporta cédula, correo y teléfono.
Arreglá el form para que también acepte correo: revisá si el problema es validación del input,
normalización (la cédula se normaliza, el correo debe compararse case-insensitive) o el payload
que se envía. Ajustá el placeholder/label del campo para indicar "cédula o correo".
No cambiés el contrato de respuesta (solo nombre + has_n2, por privacidad).
Verificá con un test del endpoint buscando por correo con mayúsculas mezcladas.
```

### [ ] PRE-2 · Zonas fijas del form prematrimonial
Archivos: `src/app/(admin)/matricula/prematrimonial/page.tsx` (constante `ZONES`, línea ~13)

```
En src/app/(admin)/matricula/prematrimonial/page.tsx hay un array ZONES hardcodeado.
Reemplazá sus valores por exactamente estas 6 opciones, en este orden:
Este de San José, Oeste de San José, Alajuela, Cartago, Liberia, Heredia.
Revisá que los valores guardados hasta ahora en prematrimonial_requests no se rompan al
mostrarse en la cola (src/components/studies/PrematrimonialQueue.tsx): si un registro viejo
tiene una zona que ya no está en la lista, debe seguir mostrándose tal cual.
No conectés esto al catálogo de sedes; la lista es fija a propósito.
```

### [ ] PRE-3 · Fecha de boda: mínimo y default +6 meses
Archivos: `src/app/(admin)/matricula/prematrimonial/page.tsx` (campo `ceremonyDate`), `src/app/api/studies/prematrimonial/route.ts`

```
Regla de negocio: la fecha de la boda no puede ser menor a 6 meses desde hoy.
En el wizard prematrimonial (src/app/(admin)/matricula/prematrimonial/page.tsx):
1) El input de fecha de boda debe tener min = hoy + 6 meses y su valor default debe
   inicializarse en hoy + 6 meses (respetando el flag dateDefined si la fecha aún no está definida).
2) Agregá la validación server-side en src/app/api/studies/prematrimonial/route.ts:
   si viene fecha definida y es menor a hoy + 6 meses, devolver 400 con código claro
   (patrón del repo: errores con code, como el 409 requisito_n2).
Usá cálculo de meses calendario, no 180 días. Agregá test unitario de la validación.
```

### [ ] PRE-4 · Cambiar pregunta del oficiante
Archivos: `src/app/(admin)/matricula/prematrimonial/page.tsx`

```
En src/app/(admin)/matricula/prematrimonial/page.tsx, cambiá el texto de la pregunta sobre
quién oficia la ceremonia a exactamente: "¿Quién te gustaría que dirigiera la ceremonia?".
Solo cambia el label/copy; las opciones (OFFICIANTS) quedan igual.
```

### [ ] REV-1 · Filtros extra en revisión de pagos
Archivos: `src/app/(admin)/pagos/revision/page.tsx`, `src/app/api/payments/queue/route.ts`, `src/lib/supabase/queries/payments.ts` (`getPendingPaymentsQueue`)

```
En la página de revisión de pagos (src/app/(admin)/pagos/revision/page.tsx) hoy solo se filtra
por estado de cola y concepto. Agregá dos filtros más:
1) Tipo de estudio/capacitación: para pagos de matrícula, filtrar por el plan del grupo
   (study_plans vía study_enrollments -> study_groups). Un select con los planes.
2) Dirigente del grupo: select/búsqueda por dirigente (study_leaders) del grupo asociado al pago.
Extendé el API src/app/api/payments/queue/route.ts (query params planId y leaderId) y la query
getPendingPaymentsQueue en src/lib/supabase/queries/payments.ts. Los filtros aplican solo a
pagos de concepto matrícula; para otros conceptos se ignoran (deshabilitá los selects en la UI
cuando el concepto no aplique). Mantené el guard de permisos existente
(requireModuleView('revision_pagos','edit')). Seguí el patrón de filtros server-side del repo.
```

### [ ] EST-3 · Recomendaciones solo en cierres N4+ y capacitaciones
Archivos: `src/app/(admin)/estudios/grupos/[id]/cierre/page.tsx` (bloque "Recomendar para", líneas ~314-345)

```
En el flujo de cierre de grupo (src/app/(admin)/estudios/grupos/[id]/cierre/page.tsx) el bloque
"Recomendar para (opcional)" (rec_oracion, rec_servicio, rec_dirigente, rec_justification)
debe mostrarse ÚNICAMENTE cuando el plan del grupo es nivel N4 o posterior en la cadena
N1→N2→N3→N4, o cuando es una capacitación (cadena DIS1→DIS3 / bloques de capacitación).
Para N1-N3 el bloque no se muestra ni se envía en el POST. Determiná el nivel desde el plan
del grupo (ver cadenas de niveles en src/lib/studies/, p. ej. la lógica de nextLevelCode en
src/lib/studies/folletos.ts como referencia de cómo se modelan las cadenas). Validá también
server-side: si llega recommendations para un grupo N1-N3, ignorarlas o rechazarlas.
Agregá test de la condición de visibilidad/aceptación.
```

---

## Fase 2 — Filtros del padrón (hacer los 3 seguidos, misma zona de código)

### [ ] FIL-1 · Filtro de miembros: NO asistió a un evento
Archivos: `src/types/filters.ts`, `src/components/members/AdvancedFilters.tsx`, `src/lib/supabase/queries/members.ts` (evaluación `attendance`, líneas ~355-428), `src/lib/condition-labels.ts`

```
El filtro avanzado de miembros tiene condición attendance (por tipo de evento, sede, nombre,
rango de fechas y cantidad) contra event_checkins, pero no permite negación ni apuntar a un
evento puntual. Necesito poder construir: "dirigentes que NO asistieron al evento X"
(ej.: no fueron al campamento).
1) Agregá a la condición attendance en src/types/filters.ts un flag de negación
   (p. ej. negate: boolean) y opcionalmente eventId para un evento puntual.
2) En src/lib/supabase/queries/members.ts implementá la negación como anti-join
   (miembros del conjunto base que NO tienen check-in que cumpla el criterio). Ojo con el
   rendimiento: el padrón es ~22k; resolvé con conjuntos de ids como hace el código actual.
3) UI en src/components/members/AdvancedFilters.tsx (tab Asistencia): toggle "asistió / no asistió"
   y selector de evento puntual. Label del chip en src/lib/condition-labels.ts.
La negación se combina con las demás condiciones con el AND existente (el OR entre grupos se
hace en FIL-3, no lo toqués acá). Agregá tests de la query con negate.
```

### [ ] FIL-2 · Filtro de miembros: por inscripción a evento
Archivos: los mismos de FIL-1 + tabla `event_registrations`. Depende de: FIL-1

```
Siguiendo el patrón de la condición attendance del filtro avanzado de miembros, agregá una
condición nueva de INSCRIPCIÓN a eventos contra event_registrations (hoy solo existe asistencia
vía event_checkins). Debe soportar: evento puntual o tipo de evento, rango de fechas,
estado del tiquete (pending/paid/exempted/expired, con "cualquiera" como default), y el mismo
flag de negación que attendance (no inscrito). Con esto se pueden cruzar "inscritos y asistentes"
o "inscritos que no asistieron" combinando ambas condiciones con AND.
Tocá: src/types/filters.ts (nuevo tipo de condición), src/lib/supabase/queries/members.ts
(evaluación), src/components/members/AdvancedFilters.tsx (UI en el tab de asistencia o tab nuevo
"Eventos"), src/lib/condition-labels.ts (labels). Tests de la evaluación.
```

### [ ] FIL-3 · Grupos OR en el filtro avanzado (TODO del código)
Archivos: `src/lib/supabase/queries/members.ts:189` (TODO), `src/components/members/QueryBar.tsx`, `src/hooks/useMemberFilters.ts`. Depende de: FIL-1 y FIL-2

```
El QueryBar del padrón (src/components/members/QueryBar.tsx) ya renderiza chips en grupos
AND-OR, pero la evaluación en src/lib/supabase/queries/members.ts (TODO en línea ~189) solo
combina condiciones con AND. Implementá los grupos OR: dentro de un grupo las condiciones se
unen con OR (unión de conjuntos de ids, siguiendo el patrón de sets que ya usa la query),
y entre grupos con AND (intersección). Cuidá el rendimiento con ~22k miembros: resolvé cada
condición a un Set de ids y operá en memoria como hace el código actual. Incluí las condiciones
nuevas de FIL-1/FIL-2 (negación y registration) en la lógica OR. Revisá que export, counts y
listas guardadas (/api/members/export, counts, member_lists) usen la misma evaluación.
Tests: (A OR B) AND C con casos de negación incluidos.
```

### [ ] FEA-1 · Conectar plantilla `form_asignado`
Archivos: plantillas de sistema en `src/lib/email/`, `/api/forms`, asignación de forms a entidades

```
La plantilla de correo form_asignado existe (BD con fallback hardcodeado, junto a
form_completado) pero no está conectada a ningún disparador (decisión de 2026-07-17, ahora sí
se implementa). Conectala: cuando se asigna un formulario a una entidad (evento o grupo de
estudio) con destinatarios definidos, enviar el correo form_asignado a esos destinatarios con
el link al formulario. Seguí el patrón de despacho de form_completado y respetá preferencias
de notificación (src/lib/notifications/dispatch.ts) y el límite diario de email. Dedupe: no
reenviar si se re-guarda el form sin cambiar la asignación. Test del disparador.
```

---

## Fase 3 — Reglas de negocio de estudios y matrícula

### [ ] PRE-5 · Nuevo requisito prematrimonial: N1 completado + inscrito en N2
Archivos: `src/lib/supabase/queries/prematrimonial.ts` (`PREMAT_REQUIRED_CODE`, `hasCompletedN2`), `src/app/api/studies/prematrimonial/route.ts` (líneas ~71-75), `src/app/api/studies/prematrimonial/spouse-search/route.ts`, wizard y elegibilidad

```
Cambio de regla de negocio del curso prematrimonial. Regla actual: ambos de la pareja con N2
COMPLETADO. Regla nueva: ambos de la pareja con N1 completado Y al menos INSCRITOS en N2
(enrollment en estado enrolled o completed en un plan N2; waitlist/pendiente_de_pago NO cuentan,
completed de N2 obviamente sí).
1) Actualizá la validación en src/lib/supabase/queries/prematrimonial.ts (hasCompletedN2 →
   renombrala a algo como meetsPrematRequirement) y el 409 requisito_n2 en
   src/app/api/studies/prematrimonial/route.ts con mensaje acorde.
2) spouse-search devuelve has_n2: actualizá el flag al requisito nuevo (renombrar con cuidado
   de actualizar el consumidor en el wizard).
3) La opción de inscripción al prematrimonial NO debe aparecer a quien no cumpla: revisá dónde
   se expone la entrada al wizard (elegibilidad en /api/matricula/eligibility o la página de
   matrícula) y aplicá la misma regla ahí, server-side.
Regla adicional que ya existe y se mantiene: ambos con cédula registrada.
Actualizá los tests existentes de la validación y agregá casos: N1 completado + N2 enrolled (pasa),
N1 completado sin N2 (falla), N2 waitlist (falla).
```

### [ ] EST-1 · Dirigente con grupo activo ⇒ estado activo automático
Archivos: `src/lib/supabase/queries/studies.ts` (`setDirigenteActive`, `bulkSetDirigenteActive`), `src/app/api/studies/dirigentes/bulk-status/route.ts`, asignación de dirigente en grupos (`/api/studies/groups`)

```
Regla: nunca debe haber un dirigente inactivo con un grupo en estado en_matricula o en_curso.
Excepción: estudios tipo campaña quedan fuera de la regla (identificá cómo se marca un plan
como campaña — etapa 'campaña' en la elegibilidad, src/lib/studies/eligibility.ts).
Implementá:
1) Al asignar un dirigente a un grupo (creación/edición de grupo, herencia al cerrar grupo
   sucesor), si el dirigente está inactivo y el grupo no es de campaña, activarlo
   automáticamente reutilizando setDirigenteActive de src/lib/supabase/queries/studies.ts
   (que ya maneja comité Dirigentes + rol dirigente). Registrá el cambio igual que una
   activación manual.
2) Ya existe el bloqueo inverso (bulk-status impide desactivar con grupo activo): verificá que
   cubra también la desactivación individual y la excepción de campaña (sí se puede desactivar
   si su único grupo activo es de campaña).
Tests: asignar dirigente inactivo a grupo normal → queda activo; a grupo campaña → sigue inactivo.
```

### [ ] GRU-1 · Fechas de matrícula (inicio/fin) en grupos + activación automática
Archivos: `src/app/(admin)/estudios/grupos/nuevo/page.tsx`, `src/app/(admin)/estudios/grupos/[id]/editar/page.tsx`, `src/app/api/studies/groups/schema.ts`, migración SQL, `src/lib/studies/bloques.ts`, cron nuevo

```
Hoy el estado en_matricula/en_curso de los grupos se cambia manualmente y no existen fechas de
matrícula (hay un campo signup_deadline muerto en el tipo Step1 del form nuevo: eliminalo o
reutilizalo). Implementá:
1) Migración: agregar enrollment_start_date y enrollment_end_date (date, nullable) a study_groups.
2) Forms de crear/editar grupo: dos campos de fecha "Inicio de matrícula" y "Fin de matrícula",
   editables. Cuando el grupo pertenece a un bloque de capacitación, precargar los defaults
   desde las fechas del bloque (src/lib/studies/bloques.ts define los hitos), pero siempre
   editables. Validación: inicio <= fin, y fin <= fecha de inicio del grupo si existe.
3) Automatización: un cron diario (seguir el patrón de vercel.json + auth CRON_SECRET de
   src/app/api/cron/folleto-blocks/route.ts) que:
   - pase grupos a en_matricula cuando llega enrollment_start_date,
   - los saque de matrícula al pasar enrollment_end_date (pasan a en_curso si su fecha de
     inicio llegó, o dejan de aceptar matrículas).
   El cambio manual de estado sigue existiendo y tiene prioridad (el cron no revierte un
   cambio manual posterior — pensá cómo evitarlo, p. ej. solo transicionar si el estado es el
   esperado para la fecha).
4) La elegibilidad de matrícula (solo se ofrecen grupos en_matricula con cupo,
   src/lib/studies/eligibility.ts) no cambia; se apoya en el estado.
Agregá el cron a vercel.json con horario UTC coherente con los demás. Tests de la transición.
```

### [ ] EST-2 · Importar cursos por Excel/CSV
Patrón a replicar: import de vacantes (`src/app/(admin)/servidores/admin/importar-vacantes/page.tsx`, `src/app/api/servers/vacancies/import/route.ts` + `import-template/route.ts`, `src/lib/supabase/queries/vacancy-import.ts`)

```
Agregá importación masiva de grupos de estudio desde CSV en la página /estudios, replicando el
patrón del import de vacantes (page + route thin + query de validación/upsert + endpoint de
plantilla descargable):
- src/app/(admin)/estudios/importar/page.tsx (wizard: cargar → preview con errores por fila → confirmar)
- src/app/api/studies/groups/import/route.ts y src/app/api/studies/groups/import-template/route.ts
- src/lib/supabase/queries/group-import.ts
Columnas de la plantilla: plan (código, ej. N1), sede/zona (resolver con resolveZoneCode de
src/lib/zones.ts), horario/día, fecha inicio, fecha fin, cupo, cédula del dirigente (opcional),
y las fechas de inicio/fin de matrícula de GRU-1 (opcionales).
Reglas:
- El dirigente SOLO se matchea por cédula normalizada contra members; si la columna viene vacía
  o no matchea, el grupo se crea sin dirigente y se reporta como advertencia en el preview.
- Validar plan existente, sede resoluble, fechas coherentes. Filas inválidas se reportan y no
  se insertan (import parcial permitido, como donaciones).
- Permisos: STUDY_ADMIN_ROLES (mismo guard que crear grupos).
Botón "Importar" en la página /estudios visible con esos roles. Tests de la validación por fila.
```

---

## Fase 4 — Pagos pendientes (bloque con dependencias internas; hacer en orden)

### [ ] PAG-1 · Página "mis pagos pendientes" + notificación clic-para-pagar
Archivos: `src/app/api/members/[id]/payments/route.ts` (ya permite self-access), página nueva, `internal_notifications`, flujo de matrícula automática N2-N4

```
Necesito que un miembro pueda ver y pagar sus pagos pendientes:
1) Página nueva /mis-pagos (grupo (admin), visible para cualquier sesión sobre sí mismo):
   lista de pagos del miembro con estado pending o comprobante rechazado, usando el API
   existente src/app/api/members/[id]/payments/route.ts (ya soporta isSelf). Cada ítem se abre
   y permite subir/resubir comprobante (reutilizá el flujo de comprobantes existente,
   bucket payment-receipts y el patrón de /api/payments/[id]/receipt). Agregala al sidebar
   para el rol miembro.
2) Notificación de pago pendiente: cuando se genera una matrícula automática N2-N4 con pago
   pendiente (herencia de cohorte al cerrar grupo, src/app/api/studies/groups/[id]/close/route.ts),
   crear una notificación interna al miembro (insert en internal_notifications, seguí el patrón
   de src/lib/supabase/queries/payments.ts línea ~243) cuyo link abra directamente el pago
   correspondiente en /mis-pagos (deep link con el id del pago, que abra el modal/detalle de pago).
   Respetá las preferencias de notificación vía src/lib/notifications/dispatch.ts.
3) Las notificaciones internas deben soportar un link de destino si no lo tienen ya (revisá el
   esquema de internal_notifications y la página /notificaciones para que el clic navegue).
Anti-suplantación: la página solo muestra pagos propios o de familiares
(resolveTargetMemberId / family_member_ids del auth-context). Tests del deep link y del self-access.
```

### [ ] PAG-2 · Bloquear matrícula si hay pago de estudios pendiente
Archivos: `src/lib/studies/eligibility.ts`, `/api/matricula/eligibility`, página de matrícula. Depende de: PAG-1

```
Regla: un miembro no puede matricularse en un estudio si tiene algún pago de ESTUDIOS/
capacitaciones pendiente (concepto matrícula con status pending o comprobante rechazado).
Pagos de eventos u otros conceptos NO bloquean.
1) Agregá el chequeo a la elegibilidad server-side (src/lib/studies/eligibility.ts y/o el
   endpoint /api/matricula/eligibility) devolviendo una razón clara (código tipo
   pago_pendiente con el conteo).
2) En la UI de matrícula, mostrar un aviso: "Tenés N pago(s) pendiente(s); para matricular
   debés completarlos" con link a /mis-pagos.
3) El staff con STUDY_ADMIN_ROLES puede matricular a terceros por encima del bloqueo
   (confirmalo con un override explícito en la UI de staff, no silencioso).
Ojo con no romper el flujo de pendiente_de_pago de la propia matrícula en curso: el pago que
la persona está por hacer en el wizard no debe bloquearse a sí mismo.
Tests: con pago de estudio pendiente → bloqueado; con pago de evento pendiente → pasa.
```

### [ ] PAG-3 · Recordatorio semanal de pagos pendientes (lunes)
Archivos: cron nuevo `src/app/api/cron/payment-reminders/route.ts`, `vercel.json`. Depende de: PAG-1

```
Creá un cron semanal (lunes, horario UTC coherente con los demás crons de vercel.json, auth
Bearer CRON_SECRET, ping a healthcheck si la env existe — seguí el patrón exacto de
src/app/api/cron/payment-holds-expire/route.ts) que:
1) Busque todos los pagos con status pending (o comprobante rechazado aún dentro de la ventana
   de 72h del cron payment-holds-expire, para no recordar pagos que van a expirar igual).
2) Envíe a cada miembro UNA notificación interna consolidada ("Tenés N pagos pendientes") con
   link a /mis-pagos, respetando preferencias (src/lib/notifications/dispatch.ts, categoría
   mensajes_sistema o la que corresponda) y evitando duplicados si el cron corre dos veces el
   mismo día (dedupe por fecha).
3) Opcional email: usar el helper de email existente solo si hay plantilla; si no, dejar
   preparado el punto de extensión y enviar solo notificación interna.
Agregá HEALTHCHECK_URL correspondiente a la lista de envs opcionales. Tests del dedupe.
```

### [ ] REV-2 · Botón de recordatorio manual de pago
Archivos: `src/app/(admin)/pagos/revision/page.tsx`, API nueva `/api/payments/[id]/remind`. Depende de: PAG-1 y PAG-3

```
En la página de revisión de pagos (src/app/(admin)/pagos/revision/page.tsx) agregá una acción
por pago "Enviar recordatorio": POST /api/payments/[id]/remind (guard
requireModuleView('revision_pagos','edit')) que reutilice la misma lógica de notificación del
cron semanal de recordatorios (extraela a un helper compartido en src/lib/ si quedó embebida
en el cron): notificación interna al miembro con deep link a su pago en /mis-pagos.
Rate limit simple: no permitir más de un recordatorio manual por pago por día (409 con mensaje).
Mostrar confirmación en la UI y cuándo se envió el último recordatorio.
```

### [ ] PRE-6 · Botón "solicitar beca" en prematrimonial
Archivos: `src/app/(admin)/matricula/prematrimonial/page.tsx` (paso 4, pago), `src/lib/supabase/queries/scholarships.ts`, `src/app/api/scholarships/*`, `finance_requests`

```
El wizard prematrimonial no tiene opción de beca (paso 4 es pago fijo por pareja). Agregá un
botón "Solicitar beca" en el paso de pago que cree una solicitud de beca usando el flujo
existente de solicitudes (las solicitudes de beca viven en finance_requests filtradas como
scholarship — ver src/lib/supabase/queries/scholarships.ts y finance-requests.ts), asociada al
prematrimonial_request. Comportamiento tras solicitar: la solicitud queda open y el pago queda
pendiente hasta que becas la resuelva (revisá cómo lo maneja la matrícula normal con becas para
ser consistente: canje en src/lib, emails beca_aprobada / beca_aprobada_parcial / beca_rechazada
ya existen). No inventés un flujo nuevo: replicá el de matrícula. Test de creación de la solicitud.
```

---

## Fase 5 — Folletos (después de GRU-1)

### [ ] FOL-1 · Nuevas reglas de creación de tiquetes de folletos
Archivos: `src/app/api/studies/groups/[id]/close/route.ts` (líneas ~42-91), `src/app/api/cron/folleto-blocks/route.ts`, `src/lib/supabase/queries/bloques.ts` (`processBloqueMilestones`), `src/lib/supabase/queries/folletos.ts`, `src/lib/studies/folletos.ts`. Depende de: GRU-1

```
Cambio de reglas de generación de folleto_requests. Las reglas nuevas REEMPLAZAN la generación
actual por cierre de grupo y por hitos de bloque. Los tiquetes se crean únicamente cuando:
1) Un grupo llega a su cupo máximo de matrícula (chequeo al confirmar cada matrícula en
   /api/studies/groups/[id]/enrollments: si enrolled == cupo, generar tiquete; idempotente,
   un solo tiquete por grupo).
2) Termina el período de matrícula (enrollment_end_date de GRU-1) Y el grupo tiene >= 5
   estudiantes matriculados (estado enrolled). Esto va en el cron diario de GRU-1 o en uno
   propio; idempotente igual.
3) De forma manual (ya existe: /api/studies/folletos/manual y ManualFolletoRequestButton — se mantiene).
Quitar: la generación en el cierre de grupo (src/app/api/studies/groups/[id]/close/route.ts,
bloque folleto.send) y la generación por hitos de bloque en processBloqueMilestones
(src/lib/supabase/queries/bloques.ts). OJO: el cron folleto-blocks puede tener otras
responsabilidades de notificación — quitá solo la creación de folleto_requests, no los avisos,
y decime si encontrás acoplamientos.
Mantener: estados lineales creada → en_impresion → enviado_entregado → cerrada, fecha estimada,
y las notificaciones a destinatarios (notifyFolletoRecipients). Actualizá los tipos de
folleto_requests si los actuales (cierre, preapertura_*) ya no aplican: agregá tipos nuevos
(cupo_lleno, fin_matricula) sin borrar los viejos de los datos históricos.
Tests: cupo lleno genera 1 tiquete (no 2 si se rematricula), fin de matrícula con 4 estudiantes
no genera, con 5 sí.
```

---

## Fase 6 — Refactor delicado

### [ ] REF-1 · Regla de sede a fuente única
Archivos: `src/lib/sede-attendance.ts`, SQL `refresh_member_sedes`, `sede-rule-fixtures.ts`

```
La regla de sede del miembro vive triplicada: TS (src/lib/sede-attendance.ts), SQL
(refresh_member_sedes, que corre en el trigger de cada check-in) y las fixtures de contrato
(sede-rule-fixtures.ts). Evaluá opciones para reducirla a una fuente única sin perder el
trigger en tiempo real (p. ej. que TS delegue en la RPC, o generar el SQL desde las fixtures).
Antes de tocar nada, presentame un mini-plan con la opción recomendada y su riesgo: hay 160k+
check-ins históricos y el trigger corre en cada check-in, así que el rendimiento importa.
No cambiés la regla de negocio en sí, solo la arquitectura. Las fixtures de contrato deben
seguir pasando idénticas.
```

---

## Backlog (fases siguientes, requieren definición de producto)

- **CAM-1 · Matrículas de estudios tipo campaña** — no urge. Definir: ¿sin prerequisitos? ¿cupos? ¿pago? La etapa 'campaña' ya existe en la elegibilidad (campañas sin compromisos) y la excepción de campaña queda implementada en EST-1.
- **WAP-1 · Canal WhatsApp en comunicaciones** — fase mayor. Hoy solo está modelado en el esquema (`channel_configs.type`, prefs de miembro). Requiere decidir proveedor y costos antes de escribir código.

---

## Notas para la ejecución en Claude Code

- Un punto por sesión/PR. Pegar el prompt tal cual y pedir además: correr `tsc --noEmit`,
  lint y `vitest` antes de dar por terminado (la verja de CI usa `--max-warnings=107`, solo baja).
- Reglas del repo que ningún cambio debe romper (de AGENTS.md y docs/sistema-overview.md):
  - Todo handler de /api se autoriza solo con `requireRoles(...)` o `requireModuleView(...)`
    (el middleware excluye /api).
  - Sin soft-delete; DELETE con referencias → 409 con conteo.
  - Anti-suplantación con `resolveTargetMemberId()` en autoservicio.
  - La regla de sede vive duplicada en TS y SQL con fixtures compartidas; no tocarla de un solo
    lado (hasta REF-1).
- Después de cada punto completado, marcar el checkbox acá y anotar el commit/PR.
