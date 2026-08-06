# Sistema theos-admin — resumen ejecutivo

> Documento de referencia para retomar contexto rápido. Generado 2026-07-25 recorriendo el código real (rutas, esquema, permisos, crons); **actualizado el 2026-08-06** con la Fase 7 del plan. Lo que no quedó claro en el código está marcado **por confirmar**.

## 1. Panorama general

**theos-admin** es el sistema administrativo de Theos Place: gestiona el padrón de miembros (~22k+), estudios bíblicos y capacitaciones (planes, grupos, matrícula, folletos), eventos con check-in (160k+ check-ins históricos), estructura de servicio (áreas → comités → puestos → vacantes), empleados, finanzas (pagos, becas, donaciones, devoluciones), comunicaciones masivas por email, formularios y reportes.

**Stack:** Next.js 16 (App Router) en Vercel + Supabase (Postgres, Auth con MFA TOTP, Storage). Email por AWS SES (SMTP/nodemailer) con webhook SNS para rebotes. Sentry para errores. Sin ORM: queries directas con `supabase-js` usando service role en `/api`, con adapters por dominio en `src/lib/*`.

**Arquitectura de acceso:** tres grupos de rutas — `(admin)` protegido con sidebar, `(auth)` login/MFA/recuperación, `(public)` sin sesión (`/calendario`, `/vacantes`, `/completar-perfil`, `/terminos`). El middleware `src/proxy.ts` gatea sesión + MFA + CSP con nonce, pero **excluye `/api`**: cada handler API se autoriza solo con `requireRoles(...)` o `requireModuleView(...)` de `src/lib/auth/guard.ts` (regla de AGENTS.md).

**Estado general:** funcional y en producción. Auditorías de seguridad, backend y best-practices de jun-jul 2026 cerradas. La deuda restante es puntual (ver §6). RLS habilitado en todas las tablas como defensa en profundidad (la app opera vía service role).

## 2. Módulos

### Miembros
Padrón central: búsqueda server-side con filtros avanzados, detalle con histórico, cuentas de acceso, familias, duplicados y merge.

| | |
|---|---|
| Páginas | `/miembros`, `/miembros/nuevo`, `/miembros/[id]` (+`/editar`), `/miembros/listas`, `/miembros/duplicados` |
| APIs | `/api/members` (+`ids`, `by-ids`, `counts`, `export`, `duplicates`), `/api/members/[id]/*` (admin-data, spiritual, studies, payments, family, account-status, create-account, merge, deactivate…), `/api/member-lists`, `/api/families` |
| Tablas | `members`, `member_admin_data`, `member_spiritual_data`, `member_notification_prefs`, `member_recommendations`, `member_lists`, `family_units`, `family_members`, `duplicate_dismissals` |
| Permisos | Escritura: `editor_perfiles`, `direccion`, `encargado_staff`, `coordinador_estudios`. Lectura de padrón: `requireModuleView('miembros', {beyondOwn:true})`. Merge/duplicados: `admin` + `editor_perfiles` |
| Estado | Funcional. **TODO real** en `queries/members.ts:189`: el QueryBar solo combina condiciones con AND; los grupos OR están pendientes |
| Depende de | Estudios (historial), finanzas (pagos del miembro), accesos (cuentas), comunicaciones (audiencias/listas) |

La BD **no** tiene UNIQUE de cédula/correo: el dedup es a nivel app (409 `duplicate` en POST, con `cedula_normalized` y email case-insensitive). Desde INT-1 (2026-07-28) la identificación es **por tipo de documento**: `members.document_type` ('cedula' | 'dni_nie' | 'pasaporte' | 'otro', default 'cedula') + índice único parcial por pareja (tipo, `cedula_normalized`); el número se guarda en MAYÚSCULAS y la validación por tipo vive en `src/lib/cedula.ts` (`isValidDocument`). El lookup TSE/Hacienda solo aplica a tipo 'cedula'.

### Estudios (planes / grupos / dirigentes / solicitudes)
Gestión de estudios y capacitaciones: catálogo de planes con prerequisitos encadenados, grupos con asistencia/sesiones/cierre, dirigentes, bloques de capacitación, análisis y solicitudes.

| | |
|---|---|
| Páginas | `/estudios`, `/estudios/grupos/*` (detalle, editar, asistencia, cierre), `/estudios/plan/*`, `/estudios/dirigentes/*`, `/estudios/bloques`, `/estudios/analisis`, `/estudios/solicitudes` |
| APIs | `/api/studies/groups/*` (attendance, close, enrollments, sessions), `/api/studies/plans`, `/api/studies/dirigentes` (+bulk), `/api/studies/bloques`, `/api/studies/eligibility`, `/api/studies/exceptions`, `/api/studies/invitations`, `/api/studies/requests`, `/api/studies/prematrimonial/*` |
| Tablas | `study_plans`, `study_groups` (incl. `enrollment_restrictions` — GRU-2), `study_leaders`, `study_sessions`, `study_attendance`, `capacitacion_bloques`, `study_invitations`, `study_requirement_exceptions`, `study_requests` (+history), `prematrimonial_requests` (+history), `leader_evaluations` (**esquema sin flujo**: 0 filas, sin pantalla ni correo) |
| Permisos | `STUDY_ADMIN_ROLES` (coordinador_estudios, coordinador_dirigentes, direccion, admin); grupos también `editor_grupos_estudio`; bloques solo coordinador_estudios + admin |
| Estado | Funcional. Rama de "comportamiento histórico" en `/api/studies/groups` (compatibilidad). GRU-2: restricción de audiencia POR GRUPO (se SUMA a los requisitos del plan). BLQ-1: vista de calendario anual en bloques. REU-2: el cambio de grupo se pide desde 4 lugares. EST-11: los planes desactivados solo los ve `STUDY_ADMIN_ROLES`, y no viajan en el payload |
| Depende de | Matrícula, folletos, pagos (matrícula paga), notificaciones (recordatorios, ausencia de dirigentes), sedes |

Cadenas de niveles: **N1→N2→N3→N4** y **DIS1→DIS2→DIS3** (no existe DIS4; DIS1 es de etapa **intermedia**, no inicial). Al cerrar un grupo, el sucesor hereda dirigente/horario/zona (la cohorte avanza junta) — **pero NO la restricción de audiencia** (GRU-2). Cerrar ya no genera folletos (FOL-1).

### Matrícula
Autoservicio o staff: matricular a un miembro en un estudio elegible, con cobro y opción de beca. Wizard prematrimonial aparte (pareja, requiere N2 de ambos).

| | |
|---|---|
| Páginas | `/matricula`, `/matricula/confirmacion`, `/matricula/prematrimonial` |
| APIs | `/api/matricula/eligibility`, `/api/studies/groups/[id]/enrollments`, `/api/studies/prematrimonial/*` |
| Tablas | `study_enrollments`, `payments`, `scholarships`, `prematrimonial_requests` |
| Permisos | Autoservicio (cualquier autenticado sobre sí mismo, con anti-suplantación `resolveTargetMemberId`) o `STUDY_ADMIN_ROLES` sobre terceros |
| Estado | Funcional |
| Depende de | Estudios (elegibilidad), pagos, becas |

### Check-in
Registro de asistencia a eventos, con ventana horaria del día, cobro on-site para eventos pagos y verificación de servidor.

| | |
|---|---|
| Páginas | `/eventos/checkin` (picker del día), `/eventos/[id]/checkin` |
| APIs | `/api/events/[id]/checkins`, `/api/events/[id]/onsite-charge`, `/api/events/[id]/server-check` |
| Tablas | `event_checkins` (method: manual/qr/smart_link), `event_registrations`, `payments` |
| Permisos | `EVENT_CHECKIN_ROLES`: encargado_eventos, direccion, admin |
| Estado | Funcional. Cada check-in dispara el trigger que recalcula la sede del miembro |
| Depende de | Eventos, pagos (cobro on-site), miembros (sede) |

### Eventos
CRUD de eventos con recurrencia (modelo iCalendar de excepciones), tipos, inscripciones, voluntarios y calendario público embebible.

| | |
|---|---|
| Páginas | `/eventos` (list/grid/calendar), `/eventos/nuevo`, `/eventos/[id]` (+`/editar`), `/eventos/tipos`, `/eventos/embed`; pública: `/calendario` |
| APIs | `/api/events/*` (register, registrations, volunteers, checkins), `/api/events/types`, `/api/event-registrations/[id]/comprobante`, `/api/eventos/elegibilidad`, `/api/public/events` |
| Tablas | `events` (incl. `registration_form_id` y `survey_*` — EVE-4), `event_types`, `sub_events`, `event_exceptions`, `event_registrations` (incl. `form_response_id`), `event_checkins`, `event_volunteers`, `event_organizing_committees`, `event_managers` (FRM-1 B) |
| Permisos | Gestión: direccion, encargado_staff, comunicaciones; check-in: encargado_eventos, direccion. **Encargados por evento** (`event_managers`): gestionan ESE evento completo sin el módulo, y heredan su formulario; solo los roles de gestión pueden nombrarlos |
| Estado | Funcional. Param `vista` legacy como fallback en `/eventos`. `events` no tiene `is_public`: hoy **todos** los eventos son públicos en el calendario embebible. EVE-4: formulario de inscripción opcional (la inscripción NO depende de él) y encuesta de satisfacción programada a quienes hicieron check-in |
| Depende de | Check-in, servidores (voluntarios, exención de comité organizador), pagos |

### Servidores / comités
Estructura de servicio: áreas → comités → puestos, vacantes con aplicación pública, solicitudes de puesto, voluntarios y metas de comité.

Tres flujos de solicitud que no hay que confundir:
1. **Solicitud de puesto nuevo** (`/servidores/puestos/solicitar`, tabla `position_requests`): pedir que se **cree** un puesto que no existe aún.
2. **Solicitud de vacante** (`/servidores/vacantes/solicitudes`, flujo `creado → enviado_lider → aprobado/denegado`): pedir que se **abra** una vacante de un puesto existente (ventana abre el día 25 de cada mes).
3. **Aplicaciones** (`/servidores/aplicaciones`, tabla `applications`): servidores que **aplican** a una vacante abierta; de ahí se escoge a quien ocupa el puesto.

| | |
|---|---|
| Páginas | `/servidores`, `/servidores/[committeeId]`, `/servidores/vacantes/*` (detalle, editar, solicitar, solicitudes), `/servidores/aplicaciones`, `/servidores/admin` (+importar-vacantes); pública: `/vacantes` |
| APIs | `/api/servers/areas`, `/api/servers/committees`, `/api/servers/positions`, `/api/servers/position-requests`, `/api/servers/vacancies` (+apply, bulk, import, export-applicants), `/api/servers/applications`, `/api/servers/volunteers`, `/api/servers/goals`, `/api/public/vacancies` |
| Tablas | `areas`, `service_positions`, `position_records`, `position_requests`, `volunteers`, `vacancies`, `applications`, `committee_goals`, `member_role_position_grants` |
| Permisos | `SERVICE_ADMIN_ROLES` (encargado_staff, coordinador_servidores, direccion, admin) + `lider_comite` (scope su comité); import: `STAFF_IMPORT_ROLES` |
| Estado | Funcional. Vocabulario de `vacancies.status` unificado en español (PR #35, migración 20260725120000): `creado/enviado_lider/aprobado/denegado/cerrada` |
| Depende de | Accesos (`position-role-sync` asigna/quita roles al entrar/salir de comités), eventos (voluntarios), miembros |

### Comunicaciones
Envíos masivos de email con selección de audiencia, plantillas, configuración de remitentes/SMTP y tracking de entrega (SES → SNS → webhook).

| | |
|---|---|
| Páginas | `/comunicaciones`, `/comunicaciones/nueva`, `/comunicaciones/[id]`, `/comunicaciones/plantillas/*`, `/comunicaciones/configuracion` |
| APIs | `/api/communications/messages/*` (process, send, recipients), `/api/communications/templates`, `/api/communications/configs`, `/api/communications/audience`, `/api/email/unsubscribe`, `/api/email/resubscribe`, `/api/email/sns-webhook` |
| Tablas | `message_broadcasts`, `message_logs`, `message_templates`, `channel_configs`, `internal_notifications` |
| Permisos | `comunicaciones`, `direccion` |
| Estado | Funcional para email. El canal WhatsApp está solo modelado en el esquema (`channel_configs.type`, prefs de miembro); su implementación está planeada para una fase siguiente |
| Editor de correo | Dos modos. El **visual** (TipTap) solo representa lo básico y DESTRUYE tablas, estilos en línea y contenedores; por eso el contenido con diseño avanzado abre en **modo código** y forzar el visual pide confirmación. La detección vive en `src/components/communications/email-html.ts` — mira el ORIGINAL del servidor, no el estado vivo. `renderEmail` fuerza el color de los botones en línea porque varios clientes ignoran el `<style>` y pintan el enlace de azul |
| Depende de | Miembros (audiencias/listas), formularios (sub-módulo en el sidebar), email (infra) |

### Formularios
Builder de formularios con campos configurables, encabezado con flyer y recolección de respuestas. Vive dentro de Comunicaciones, pero tiene entrada propia de primer nivel para quien alcanza formularios sin alcanzar Comunicaciones (`formsNavPlacement`).

| | |
|---|---|
| Páginas | `/formularios`, `/formularios/nuevo`, `/formularios/[id]` (+preview, respuestas, selección) |
| APIs | `/api/forms`, `/api/forms/[id]`, `/api/forms/[id]/responses`, `/api/forms/[id]/access`, `/api/forms/upload-hero` |
| Tablas | `forms` (incl. `hero_*` — FRM-2), `form_fields`, `form_responses`, `form_response_values`, `form_access_grants` |
| Permisos | Rol `forms` + `comunicaciones`, `direccion`, `encargado_staff` (permiso `formularios`). Además: acceso puntual por formulario (`form_access_grants`) y herencia desde el evento padre (`event_managers`) |
| Quién LLENA | **Solo la audiencia** (2026-08-06, `src/lib/forms/fill-access.ts`): a quien se le mandó el link por correo, inscritos del evento, matriculados del grupo, convocados de una preinscripción, o cualquiera si el form está marcado `is_public` |
| Estado | Funcional. Triggers de BD validan la entidad asociada y desasocian el form si se borra el evento/grupo padre. `form_asignado` **sí está conectada** desde FEA-1 (2026-07-26) |
| Depende de | Eventos y estudios (forms asociados a entidades), email (`form_completado`, `form_asignado`), Storage (`form-heroes`) |

### Folletos
Cola de pedidos de folletos por sede, ligada a bloques de capacitación y al cierre de grupos: al cerrar un grupo N1–N3/DIS1–DIS2 se genera la solicitud del siguiente nivel.

| | |
|---|---|
| Páginas | `/estudios/folletos` |
| APIs | `/api/studies/folletos` (+bulk, manual), cron `/api/cron/folleto-blocks` |
| Tablas | `folleto_requests` (tipos: cierre, preapertura_preliminar/confirmacion/final, reubicacion, manual) |
| Permisos | Permiso `folletos` (rol `folletos`, coordinador_estudios, admin) |
| Estado | Funcional. Estados lineales: `creada → en_impresion → enviado_entregado → cerrada`. Fecha estimada = cierre + 2 semanas |
| Depende de | Estudios (bloques, cierre de grupos), email + notificaciones (aviso en hitos del bloque) |

### Pagos y revisión de pagos
Registro global de pagos y cola de revisión de comprobantes (SINPE/transferencia): aprobar propaga al objeto pagado (matrícula, inscripción, prematrimonial); rechazar pide resubir.

| | |
|---|---|
| Páginas | `/pagos/revision`, `/finanzas/pagos` (+`[id]`) |
| APIs | `/api/payments` (+`[id]/receipt`, `[id]/review`, `bulk`, `queue`), `/api/finance/payments` |
| Tablas | `payments` (status + review_status + concept), `refunds` |
| Permisos | `requireModuleView('revision_pagos', 'edit')`: roles revision_pagos, folletos, coordinador_dirigentes, coordinador_estudios, finanzas, direccion, admin |
| Estado | Funcional. Detección de referencia duplicada (índice único), acciones con guard 409 si el tiquete ya cambió. RPC `approve_payment` propaga por `concept`. La lista muestra **de qué tipo es el cobro y de qué cosa** (`src/lib/finance/payment-label.ts`: "Estudio · Transformados"), derivado de las columnas y no de una descripción escrita |
| Depende de | Matrícula, eventos, folletos, prematrimonial (origen del pago); cron `payment-holds-expire` libera cupos con comprobante rechazado +72h |

### Becas
Becas asignadas y cupones genéricos aplicables a matrícula, con solicitudes y revisión.

| | |
|---|---|
| Páginas | `/finanzas/becas`, `/finanzas/becas/nueva` |
| APIs | `/api/scholarships` (+applicable, coupons, `requests/[id]/review`), `/api/finance/scholarships` |
| Tablas | `scholarships` (kind: asignada/generica; status: active/used/revoked), `scholarship_redemptions` |
| Permisos | `requireModuleView('becas')`: roles becas, finanzas, direccion, admin |
| Estado | Funcional. Un solo uso por beca (guard atómico `status='active'` → `used`, 409 si ya usada). Las solicitudes de beca comparten tabla con `finance_requests` (la vista de becas filtra solo scholarship) |
| Depende de | Matrícula (canje), finanzas (solicitudes), email (beca aprobada/parcial/rechazada) |

### Finanzas
Suite financiera: donaciones (con import CSV por lotes), pagos, devoluciones, solicitudes financieras y reportes.

| | |
|---|---|
| Páginas | `/finanzas`, `/finanzas/donaciones` (+importar), `/finanzas/pagos`, `/finanzas/devoluciones`, `/finanzas/reportes`, `/finanzas/solicitudes`, `/finanzas/becas` |
| APIs | `/api/finance/donations` (+import), `/api/finance/import-batches`, `/api/finance/payments`, `/api/finance/refunds`, `/api/finance/requests` (+assignees, payment-options), `/api/finance/scholarships` |
| Tablas | `donations`, `payments`, `payment_categories`, `refunds`, `finance_requests` (+history), `import_batches`, `scholarships` |
| Permisos | `finanzas`, `direccion` (admin siempre) |
| Estado | Funcional. Import con dedup dentro del archivo y contra BD; trigger marca `members.is_donor` en cada donación |
| Depende de | Miembros, becas, pagos |

### Empleados
RRHH de puestos remunerados: perfiles, salarios, documentos y vacaciones. Separado de servidores (voluntariado).

| | |
|---|---|
| Páginas | `/empleados`, `/empleados/nuevo`, `/empleados/[id]` (+editar), `/empleados/puestos/*` |
| APIs | `/api/employees` (+salary, documents, vacations), `/api/employees/positions`, `/api/employees/documents/[id]/download` |
| Tablas | `employees`, `employee_documents`, `salary_changes`, `vacation_records`, `paid_positions` |
| Permisos | `direccion`, `encargado_staff` |
| Estado | Funcional. Columna legacy `position` eliminada (PR #36) |
| Depende de | Miembros, Storage (`employee-docs`) |

### Accesos / roles
Asignación de roles a miembros. Fuente de verdad de permisos de todo el sistema (`src/lib/auth/roles.ts`).

| | |
|---|---|
| Páginas | `/accesos`, `/accesos/[memberId]` |
| APIs | `/api/accesos`, `/api/accesos/[memberId]/roles` |
| Tablas | `member_roles` (CHECK con los 19 roles), `member_role_position_grants` |
| Permisos | `admin` gestiona todo; `coordinador_estudios` solo asigna los 3 roles delegables (editor_perfiles, editor_grupos_estudio, folletos). Es el único módulo que `direccion` NO ve |
| Estado | Funcional |
| Depende de | Miembros, servidores (`position-role-sync`) |

### Reportes
Reportes agregados: asistencia a charlas, Discípulos Multiplicadores (cohortes con 4 flags) y retención por año de cohorte. Sirven desde una caché (`report_snapshots`) recalculada cada noche.

| | |
|---|---|
| Páginas | `/reportes`, `/reportes/asistencia`, `/reportes/discipulos`, `/reportes/retencion` |
| APIs | `/api/reports/charla-attendance`, `/api/reports/discipulos`, `/api/reports/retencion`, `/api/reports/member-growth`; cron `/api/cron/report-snapshots` |
| Tablas | `report_snapshots`; RPCs `get_dm_flags`, `get_dm_milestones`, `get_group_attendance`, `get_active_today`, `report_charla_attendance`, `report_member_growth` |
| Permisos | `requireModuleView('reportes')`: reportes, coordinadores, direccion, admin, solo_lectura |
| Estado | Funcional. RPCs alineadas a las reglas centrales de asistencia (migración `20260721230000`) |
| Depende de | Check-ins (asistencia), estudios, donaciones, servidores (flags DM) |

### Dashboard
Panel de inicio con KPIs por dominio y feed de actividad, filtrado por permisos del rol.

| | |
|---|---|
| Páginas | `/dashboard`. APIs: `/api/dashboard`, `/api/dashboard/activity` |
| Tablas | Agrega de todas (RPCs `dashboard_sums`, `payment_stats`, `donation_stats`, `study_dashboard_stats_v2`…) |
| Permisos | Cualquier sesión; cada bloque respeta `can()` del rol |
| Estado | Funcional |

### Notificaciones / alertas
Bandeja de notificaciones internas persistidas + alertas calculadas al vuelo (urgente/atención/informativo).

| | |
|---|---|
| Páginas | `/notificaciones`. APIs: `/api/notifications/internal/*`, `/api/notifications/preferences`, `/api/alerts` |
| Tablas | `internal_notifications`, `member_notification_prefs` |
| Estado | Funcional. Despacho respeta preferencias por categoría (`recordatorios_eventos`, `grupo_estudio`, `mensajes_sistema`); las de seguridad se envían siempre |

### Configuración
`/configuracion` es configuración **de la cuenta del usuario** (preferencias de notificación); `/configuracion/seguridad` maneja contraseña, passkeys, TOTP y sesiones. **No existe** un panel de configuración global de org/sedes, y es **intencional**: las sedes se administran directamente en la BD (cambian muy poco); `/api/org` es catálogo de solo lectura y `/api/sedes` solo crea zonas al vuelo desde el combobox de grupos. La estructura de servicio se administra en `/servidores/admin`.

## 3. Reglas de negocio transversales

### Asistencia (fuente única: `src/lib/attendance.ts`)
- **Activo (general):** ≥6 check-ins de charla en los últimos 6 meses calendario completos (excluye el mes en curso) **y** al menos 1 en los últimos 60 días.
- **Reforzado (Etapa Intermedia):** igual pero ≥12 charlas.
- **"Sigue asistiendo" (retención, laxo):** ≥2 charlas en 4 meses, sin recencia.
- Solo cuentan check-ins de **charla**, no de cualquier evento.

### Sede del miembro (SQL única fuente — REF-1, migración 20260728100000)
- Activo: charla más asistida en los últimos 6 meses (empate → la más reciente). Inactivo: lo mismo pero sobre los 6 meses previos a su última asistencia. Nunca asistió → sin sede.
- **Única implementación de producción en SQL**: `refresh_member_sede(member_id)` (trigger en cada check-in) + `refresh_member_sedes()` (pg_cron 6:45 UTC, masiva) — misma regla, mismo archivo de migración. Todo consumidor lee lo persistido (`members.sede_id/sede_case/sede_last_checkin`). `computeMemberSede` (TS) es solo la especificación ejecutable de los fixtures. Frescura: el flip activo→inactivo por paso del tiempo lo corrige el cron (≤24h).

### Elegibilidad de estudios (`src/lib/studies/eligibility.ts`)
- Etapas por nivel de plan: `niveles`, `inicial`, `intermedia`, `campaña`. Requisitos: inicial → asistencia; intermedia → donador + servidor + asistencia reforzada; niveles y campañas → sin compromisos.
- Prerequisito encadenado por plan (`prerequisite`); haber completado un nivel posterior de la cadena también bloquea repetir los previos.
- Prematrimonial: ambos de la pareja con N2 completado + cédula registrada (409 server-side).
- Excepciones por miembro pueden perdonar donor/server/attendance/prerequisite/age/all. Planes invitation-only ocultos sin invitación activa; grupos virtuales solo con autorización; solo se ofrecen grupos `en_matricula` con cupo.

### Máquinas de estado

| Objeto | Estados | Notas |
|---|---|---|
| Pago (`payments`) | status: `paid/pending/failed/refunded/partial_refund` · review_status: `en_revision/aprobado/rechazado` | Acciones approve/reject/start_review/reopen/close; 409 si ya cambió. Aprobar propaga por `concept` |
| Matrícula (`study_enrollments`) | `enrolled/waitlist/completed/dropped/transferred/pendiente_de_pago/expirada/reprobado` | `completed` no se retira ni se resucita; comprobante rechazado +72h → `expirada` (cron) |
| Grupo de estudio | `en_matricula → en_curso → finalizado` | Al cerrar: sucesor hereda dirigente/horario/zona + folletos del siguiente nivel |
| Tiquete de evento (`event_registrations`) | `pending/paid/exempted/expired` | Servidor del comité organizador queda `exempted` |
| Folleto (`folleto_requests`) | `creada → en_impresion → enviado_entregado → cerrada` | Lineal, sin retroceso |
| Vacante (`vacancies`) | `creado → enviado_lider → aprobado/denegado`; `aprobado → cerrada` al cerrar | Vocabulario unificado (PR #35). Ventana de solicitud abre el día 25 de cada mes |
| Beca (`scholarships`) | `active → used/revoked` | Un solo uso, guard atómico 409 |
| Solicitudes (estudio/finanzas/prematrimonial) | `open → in_review → resolved/rejected` (premat: `pago_en_revision/pendiente/grupo_creado/cancelada`) | Una solicitud de estudio abierta a la vez por miembro |
| Broadcast (`message_broadcasts`) | `draft/sending/sent/failed/partial` | Log por destinatario en `message_logs` (hasta delivered/bounced/complained) |

### Regla global de borrado
- **No hay soft-delete** (sin `deleted_at`); el borrado es físico.
- Patrón estándar: DELETE con referencias activas → **409** con código y conteo (`activos`), la UI muestra modal de advertencia. Aplica a grupos, dirigentes, bloques, invitaciones, listas, becas, áreas/puestos (endpoints `/usage` para la consulta previa).
- `is_system` protege plantillas de mensaje y miembros de sistema contra borrado/mutación.

### Otras
- Dedup de miembros por cédula normalizada/correo → 409 (sin UNIQUE en BD); detección de duplicados vía RPC + merge.
- Anti-suplantación: `resolveTargetMemberId()` fuerza a no-privilegiados a operar sobre su propio `member_id`.
- Roles por puesto: entrar/salir de un comité sincroniza roles vía `position-role-sync`.
- Familias: el auth-context arrastra `family_member_ids` para autoservicio sobre familiares.

## 4. Infraestructura

### Crons (vercel.json; auth Bearer `CRON_SECRET` o sesión con rol; ping a Healthchecks si la env existe)

| Cron | Horario (UTC) | Qué hace |
|---|---|---|
| `/api/cron/group-enrollment-windows` | 12:30 diario | Cierra matrícula por ventana (GRU-1): grupo `en_matricula` con `enrollment_end_date` vencida y ya iniciado → `en_curso` (nunca re-abre; lo manual manda) |
| `/api/cron/folleto-blocks` | 13:00 diario | Genera pedidos de folletos si hoy cae en hito de un bloque activo; notifica + correo |
| `/api/studies/start-reminders` | 13:30 diario | Correo `inicio_capacitacion` a estudiantes de grupos por arrancar (dedupe en `start_notified_at`) |
| `/api/notifications/leader-absence-check` | 14:00 diario | Dirigente activo >4 semanas sin check-in de charla → avisa a coordinadores (máx 1/semana) |
| `/api/cron/storage-orphans` | 15:00 lunes | Reporte de consistencia Storage↔BD (solo reporta, no borra) |
| `/api/cron/payment-holds-expire` | 16:00 diario | Comprobante rechazado +72h sin resubir → libera cupo (`expired`/`expirada`) |
| `/api/cron/payment-reminders` | 16:30 lunes | Recordatorio consolidado de pagos pendientes por miembro (notificación interna → /mis-pagos), con prefs y dedupe diario (PAG-3) |
| `/api/cron/report-snapshots` | 06:00 diario | Recalcula datasets de reportes a `report_snapshots` (maxDuration 300s) |
| `/api/cron/event-surveys` | 17:00 diario | EVE-4: despacha las encuestas de satisfacción vencidas a quienes hicieron check-in; dedupe en `events.survey_sent_at` |

**Ya no queda ningún cron sin health check** (2026-08-06) y hay un test que lo vigila (`src/lib/health.test.ts`). Las 9 variables `HEALTHCHECK_URL_*` están listadas en `.env.example` con su horario.

**Verificado 2026-08-06:** el proyecto de Supabase **no tiene ninguna edge function desplegada**, así que la sospecha de que `process-email-queue` duplicara los crons de Vercel queda descartada. Los 3 jobs de pg_cron que sí existen son funciones SQL: `refresh_donor_flags` (6:30), `refresh_member_sedes` (6:45) y `prune_audit_log` (4:00).

### Email
- AWS SES por SMTP (nodemailer, STARTTLS 587), remitente `SES_FROM_EMAIL`. Configuration set para publicar bounces/complaints a SNS; webhook `/api/email/sns-webhook` verifica la firma. Supresión + unsubscribe/resubscribe. Límite diario `EMAIL_DAILY_LIMIT` (default 5000).
- Plantillas de sistema (BD con fallback hardcodeado): `form_asignado` (no conectada), `form_completado`, `matricula_estudiante`, `matricula_dirigente`, `inicio_capacitacion`, `beca_aprobada`, `beca_aprobada_parcial`, `beca_rechazada`, `cupon_asignado`, `encuesta_evento` (EVE-4). Helpers adicionales para cobro de evento, rechazo de pago e inicio de estudio.

### Storage
Buckets referenciados en código: `payment-receipts` (comprobantes de pago, incl. prematrimonial y eventos), `employee-docs` (documentos/contratos de empleados), `email-images` y `email-media` (editor de correos, públicos), `event-flyers` (EVE-2, público) y `form-heroes` (FRM-2, público, 5 MB, MIME limitado a jpeg/png/webp en el propio bucket). En la práctica hoy solo se suben comprobantes de pago y contratos; `email-images` existe como soporte del editor de comunicaciones. No se declaran en migraciones: se crean desde el dashboard de Supabase. No hay más buckets en uso.

### RLS
Habilitado en todas las tablas; la app opera vía service role así que las políticas son defensa en profundidad. Helpers `private.has_any_role()`, `is_admin()`, `is_own_member()`. `vacancies` tiene SELECT público por decisión de negocio; `report_snapshots` es deny-all (solo service role) a propósito.

### CI
Un workflow (`.github/workflows/ci.yml`): push a `main` y PRs. Node 22: typecheck (`tsc --noEmit`), lint con ratchet (`--max-warnings=107`, solo baja), tests (`vitest`). El build de Vercel corre aparte (Next 16 ya no lintea en build, por eso la verja en CI).

### Variables de entorno (solo nombres)

| Grupo | Variables |
|---|---|
| Obligatorias (zod en `env.ts`) | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` o `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SECRET_KEY` o `SUPABASE_SERVICE_ROLE_KEY` |
| Requeridas de facto | `CRON_SECRET`, `SES_SMTP_HOST`, `SES_SMTP_PORT`, `SES_SMTP_USER`, `SES_SMTP_PASSWORD`, `SES_FROM_EMAIL`, `SES_FROM_NAME`, `NEXT_PUBLIC_SITE_URL` |
| Opcionales | `SES_CONFIGURATION_SET`, `SES_SNS_TOPIC_ARN`, `EMAIL_DAILY_LIMIT`, `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN`, `HEALTHCHECK_URL_FOLLETO_BLOCKS`, `HEALTHCHECK_URL_START_REMINDERS`, `HEALTHCHECK_URL_LEADER_ABSENCE`, `HEALTHCHECK_URL_STORAGE_ORPHANS`, `HEALTHCHECK_URL_PAYMENT_HOLDS_EXPIRE`, `HEALTHCHECK_URL_GROUP_WINDOWS`, `HEALTHCHECK_URL_PAYMENT_REMINDERS` |
| Edge function (Deno) | `CRON_SECRET`, `NEXT_PUBLIC_SITE_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` |

## 5. Catálogo de permisos

Fuente: `src/lib/auth/roles.ts` (constante `ROLES`); asignación en `member_roles` (multi-rol; sin filas = `miembro`). `admin` siempre pasa cualquier guard.

| Rol | Habilita |
|---|---|
| `miembro` | Ver su propio perfil, grupos y familia (scope own). Default |
| `solo_lectura` | Ver todo, sin editar |
| `reportes` | Ver y exportar reportes |
| `folletos` | Folletos + revisión de pagos (ver/editar) |
| `revision_pagos` | Cola de revisión de comprobantes (ver/editar) |
| `becas` | Becas (ver/editar) |
| `editor_perfiles` | Miembros: ver, crear, editar |
| `editor_grupos_estudio` | Estudios: ver + gestionar grupos (vía `GROUP_ADMIN_ROLES`) |
| `comunicaciones` | Comunicaciones (ver/crear/editar) + ver miembros |
| `lider_comite` | Servidores de su comité (ver/editar) + ver miembros |
| `dirigente` | Sus grupos de estudio (ver/editar) + ver miembros (scope own) |
| `coordinador_dirigentes` | Estudios (ver/editar) + reportes + revisión de pagos |
| `coordinador_estudios` | Estudios completo (crear/editar/exportar) + reportes + revisión de pagos + delegar 3 roles (editor_perfiles, editor_grupos_estudio, folletos) en `/accesos` |
| `encargado_staff` | Servidores completo + empleados (ver/crear/editar) + formularios |
| `coordinador_servidores` | Servidores (ver/crear/editar) + reportes |
| `encargado_eventos` | Eventos: check-in y cobro on-site |
| `finanzas` | Finanzas completo + revisión de pagos + becas |
| `direccion` | Casi todo, **excepto** borrar y el módulo accesos |
| `admin` | Todo (view/create/edit/delete/export en todos los módulos) |

## 6. Pendientes y deuda técnica

**En el código (verificado):**
1. `/terminos` — el texto legal es borrador y tiene comentario explícito de que un abogado debe revisarlo (acción externa).
2. Multimoneda (INT-2, 2026-07-28): las tablas de dinero llevan `currency` (CRC/USD/EUR, default CRC) y los pagos heredan la moneda de su origen, pero los **reportes y stats agregados siguen sumando sin separar moneda** — decisión de producto pendiente (¿por moneda separada o conversión?) antes de capturar montos EUR reales. Formateo único: `formatMoney` en `src/lib/format.ts`.

**Seguimientos cerrados 2026-07-28:** el param `vista` legacy de /eventos se retiró; el último productor de flyers base64 (detalle de evento) pasó al endpoint de Storage; `data:` en `img-src` se queda **a propósito** — el QR de TOTP en /configuracion/seguridad lo usa (data:image/svg+xml).

3. `leader_evaluations` es **esquema sin flujo**: la tabla existe (grupo, dirigente, nota, comentarios) pero tiene 0 filas y no hay pantalla ni correo que la escriba. Decidir si se implementa la retroalimentación al dirigente o se retira la tabla.

**Operativos (fuera del código, acciones del usuario/administración):**
- Agregar las 9 `HEALTHCHECK_URL_*` en Vercel — la lista completa, con el horario de cada cron, está en `.env.example`. Ya no falta ningún ping del lado del código.
- Env vars de Supabase en Vercel solo están en Production; los deploys Preview fallan por eso.
- Configurar Sentry (`SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN`); hoy no hay reporte de errores en producción.
- Confirmar SMTP de Supabase Auth en producción (lo usa la invitación automática de cuentas).

*(Cerrado 2026-08-06: la edge function `process-email-queue` no existe — el proyecto no tiene ninguna edge function desplegada, así que no duplica nada.)*

**Plan de ejecución:** la cola completa priorizada por fases está en [`docs/plan-desarrollo.md`](plan-desarrollo.md).

**Planeado para fases siguientes (requieren definición de producto):**
- Campañas como tipo de matrícula (CAM-1): ¿sin prerequisitos? ¿cupos? ¿pago?
- Canal WhatsApp en comunicaciones (hoy solo modelado en el esquema); falta elegir proveedor y costos.
- Pagos por tarjeta / SINPE directo: el esquema ya soporta los métodos; la UI se retiró y está marcada FASE FUTURA en el código.

**Decisiones confirmadas (no son deuda):**
- No hay panel admin de sedes/org: intencional, las sedes se administran directamente en la BD.
- El calendario público (`/calendario`, `/api/public/events`) es sin auth y muestra todos los eventos: intencional, sin flag `is_public` (2026-07-26).
- `vacancies.status` unificado (PR #35) y `employees.position` eliminada (PR #36): deuda cerrada.
