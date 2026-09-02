# Sistema theos-admin — resumen ejecutivo

> Documento de referencia para retomar contexto rápido. Generado 2026-07-25 recorriendo el código real; **regenerado completo el 2026-08-21** (rutas, esquema, permisos, crons, migraciones — el plan dice qué se pidió; esto documenta qué ES). Lo que no quedó claro en el código está marcado **por confirmar**.

## 1. Panorama general

**theos-admin** es el sistema administrativo de Theos Place: gestiona el padrón de miembros (~23k), estudios bíblicos y capacitaciones (planes, grupos, matrícula, folletos, bloques por cuatrimestre), eventos con check-in (170k+ check-ins históricos), estructura de servicio (áreas → comités → puestos → vacantes), empleados, finanzas (pagos, becas, donaciones, devoluciones), comunicaciones masivas por email, formularios, reportes y un centro de ayuda público con tutoriales grabados.

**Stack:** Next.js 16 (App Router) en Vercel + Supabase (Postgres, Auth con MFA TOTP y passkeys, Storage). Email por AWS SES (SMTP/nodemailer) con webhook SNS para rebotes. Sentry para errores (pendiente de configurar en prod). Sin ORM: queries directas con `supabase-js` usando service role en `/api`, con adapters por dominio en `src/lib/*`.

**Arquitectura de acceso:** tres grupos de rutas — `(admin)` protegido con sidebar, `(auth)` login/MFA/recuperación, `(public)` sin sesión (`/calendario`, `/vacantes`, `/completar-perfil`, `/terminos`, `/ayuda`). El middleware `src/proxy.ts` gatea sesión + MFA + CSP con nonce, pero **excluye `/api`**: cada handler API se autoriza solo con `requireRoles(...)` o `requireModuleView(...)` de `src/lib/auth/guard.ts` (regla de AGENTS.md). 106 páginas y 199 route handlers.

**Regla central (2026-08-04, invierte la original):** **la matrícula es efectiva de inmediato** (`enrolled`) aunque el estudio tenga costo; el pago nace `pending` y lo revisa finanzas por su carril. Nadie queda desmatriculado por un pago sin resolver. En **eventos** sí: el cupo se reserva contra el pago y expira a las 72h del rechazo.

**Estado general:** funcional y en producción. Auditorías de seguridad, backend y best-practices de jun-jul 2026 cerradas; squash de migraciones hecho (baseline 2026-07-30 + 28 migraciones posteriores). La deuda restante es puntual (ver §6).

## 2. Módulos

### Miembros
Padrón central: búsqueda server-side con filtros avanzados, detalle con histórico, cuentas de acceso, familias, duplicados y merge, listas guardadas.

| | |
|---|---|
| Páginas | `/miembros`, `/miembros/nuevo`, `/miembros/[id]` (+`/editar`), `/miembros/listas` (+`[id]`), `/miembros/duplicados` |
| APIs | `/api/members` (+`ids`, `by-ids`, `counts`, `export`, `duplicates`, `lookup`, `event-options`), `/api/members/[id]/*` (account-status, admin-data, create-account, deactivate, email-status, family, merge, password-reset, payments, recommendations, resend-activation, scholarships, spiritual, studies), `/api/member-lists`, `/api/families` |
| Tablas | `members`, `member_admin_data`, `member_spiritual_data`, `member_notification_prefs`, `member_recommendations`, `member_lists`, `family_units`, `family_members`, `duplicate_dismissals` |
| Permisos | Escritura: `editor_perfiles`, `direccion`, `encargado_staff`, `coordinador_estudios`. Lectura de padrón: `requireModuleView('miembros', {beyondOwn:true})`. Merge/duplicados: `admin` + `editor_perfiles`. Guardar listas: también `comunicaciones` (2026-08-21). El GET de familia acepta además `eventos:edit` (check-in en familia, 2026-08-20) |
| Estado | Funcional. **TODO real** en `queries/members.ts`: el QueryBar solo combina condiciones con AND; los grupos OR están pendientes |
| Depende de | Estudios (historial), finanzas (pagos del miembro), accesos (cuentas), comunicaciones (audiencias/listas) |

La BD **no** tiene UNIQUE de cédula/correo: el dedup es a nivel app (409 `duplicate`). Desde INT-1 la identificación es **por tipo de documento**: `members.document_type` ('cedula' | 'dni_nie' | 'pasaporte' | 'otro') + índice único parcial por pareja (tipo, `cedula_normalized`); validación por tipo en `src/lib/cedula.ts`. El banner "Falta tu cédula" (global, AppShell) recuerda completarla; el link lleva al campo con foco (`?completar=cedula`).

**Cuentas y estados**: tres estados derivados (`src/lib/members/account-state.ts`): sin cuenta / nunca ha entrado / activa, visibles en la ficha y como filtro del padrón. Alta en lote hecha (AUTH-1: ~18.100 cuentas; excluye menores de 12, sin correo, rebotados). Alta automática al crear miembro con correo (`send_invite` → correo "tu cuenta está lista", sin token).

### Estudios (planes / grupos / dirigentes / solicitudes / bloques)
Catálogo de planes con prerequisitos encadenados, grupos con asistencia/sesiones/cierre, dirigentes, bloques por cuatrimestre, análisis de demanda, import por CSV y solicitudes.

| | |
|---|---|
| Páginas | `/estudios`, `/estudios/grupos/*` (detalle, editar, asistencia, cierre, **evaluar**), `/estudios/plan/*`, `/estudios/dirigentes/*`, `/estudios/bloques`, `/estudios/analisis`, `/estudios/solicitudes`, `/estudios/importar` |
| APIs | `/api/studies/groups/*` (attendance, close, enrollments, sessions, restriction, leader-feedback, leader-sede, premat-pairs, import), `/api/studies/plans`, `/api/studies/dirigentes` (+bulk), `/api/studies/bloques`, `/api/studies/eligibility`, `/api/studies/exceptions`, `/api/studies/invitations`, `/api/studies/requests`, `/api/studies/cdeb-recommendations`, `/api/studies/prematrimonial/*`, `/api/studies/analysis` |
| Tablas | `study_plans`, `study_groups` (con `enrollment_restrictions`, `bloque_id` por trigger, `folletos_sede`), `study_leaders`, `study_sessions`, `study_attendance`, `capacitacion_bloques`, `study_invitations`, `study_requirement_exceptions`, `study_requests` (+history), `prematrimonial_requests` (+history), `leader_evaluations`, `cdeb_recommendations` |
| Permisos | `STUDY_ADMIN_ROLES` (coordinador_estudios, coordinador_dirigentes, direccion, admin); grupos también `editor_grupos_estudio`; **cerrar un grupo también puede el dirigente/co-dirigente de ESE grupo** (2026-08-20) |
| Estado | Funcional. GRU-2: restricción de audiencia POR GRUPO (se suma a los requisitos del plan; el sucesor NO la hereda). EST-2: import de grupos por CSV/XLSX con dry-run (máx 500 filas). EST-11: planes desactivados solo para STUDY_ADMIN. Al crear un grupo de capacitación, la ventana de matrícula se **precarga del bloque vigente** (apertura−21d → cierre de matrícula) |
| Depende de | Matrícula, folletos, pagos, notificaciones, sedes/zonas |

**Etapas** (dominio): `niveles`, `inicial`, `intermedia`, `avanzada`, `campaña` (BD: `study_plans.level` con `etapa_*`; el valor `externa` existe en el CHECK pero **no está mapeado** en `LEVEL_TO_STAGE` — cae al fallback 'niveles', hueco real). La etapa **avanzada** (EST-5) pide lo mismo que intermedia; sus tres planes activos (CDC, CDEB, HER) son **invitation-only** (`requires_invitation`): no se solicitan, se invita.

**Cadenas de niveles:** N1→N2→N3→N4 y DIS1→DIS2→DIS3 (no existe DIS4; DIS1 es intermedia). Al cerrar, el sucesor hereda dirigente/horario/zona (la cohorte avanza junta). En el **análisis de bloque**, DIS2/DIS3 no se ofrecen (misma cohorte que DIS1).

**Bloques (rediseño 2026-08-17):** 3 bloques por año (cuatrimestres: apertura 15 ene/may/sep; cierre de matrícula = apertura+7 días; **cierre del bloque = cierre de matrícula + 3 meses**). Histórico 2013-2026 sembrado. El **estado** (`en_apertura/activo/archivado`) es derivado por fecha — nunca se edita a mano, el cron lo persiste como cache. `study_groups.bloque_id` lo asigna un **trigger** por `starts_at` (N1-N4/DIS2/DIS3 quedan NULL). Hitos de aviso: preliminar (apertura−21d), confirmación (−14d), final (cierre de matrícula).

**Cierre de grupo:** wizard de 2 pasos (Resultados → Confirmación, modal que exige escribir "cerrar"). Por estudiante: aprobado/reprobado/retirado + nota; justificación obligatoria al reprobar y motivo al retirar. Recomendaciones oración/servicio/dirigente solo N4+/DIS*. **CDEB**: recomendación por aprobado solo en DIS3 y PAN (la ven solo coordinaciones + admin). **Prematrimonial**: cierre especial — exige evaluación de cada pareja (`evaluacion_requerida`). Post-cierre: aprobados se auto-matriculan al siguiente nivel **como `enrolled`** (con su cobro pendiente aparte) y se **programa la encuesta de satisfacción** a los estudiantes. El cierre **ya no genera folletos** (FOL-1). Las notas se muestran en el perfil del miembro (tab Participación).

**Evaluaciones del dirigente (EST-12):** los **estudiantes** evalúan a su dirigente tras el cierre — cron `study-surveys` manda el correo (plantilla `retro_dirigente`) con link a `/estudios/grupos/[id]/evaluar`; la respuesta va a `form_responses` + proyección a `leader_evaluations` (score + comentario). La coordinación revisa en el panel de la ficha del grupo, puede ocultar comentarios y decide **compartir** con el dirigente (`feedback_released_at`); el dirigente no ve detalle con <3 respuestas. No hay pantalla propia de cola ni rol `evaluaciones` (DIR-5 pendiente).

**Solicitudes** (`/estudios/solicitudes`, tabs Prematrimonial / Reubicaciones / Intereses): las **reubicaciones** tienen flujo real — tomar/asignar (notifica al asignado, plantilla `solicitud_asignada`) → resolver eligiendo **grupo destino** (candidatos que calzan zonas/días primero, e incluye **el nivel anterior** de la cadena, 2026-08-20) → matrícula inmediata + transferencia de la inscripción vieja + folleto con pago pendiente si marcó "Ocupo folleto". Los **intereses de estudio** son tablero de solo lectura (datos de demanda). **Preinscripción EST-10** (CDEB/HER) vive en formularios: form con opciones dinámicas → `/formularios/[id]/seleccion` donde el comité aprueba/invita/convoca (crea `study_invitations` + correo).

### Matrícula
Autoservicio o staff. Wizard prematrimonial aparte (pareja, N2 de ambos + documento).

| | |
|---|---|
| Páginas | `/matricula`, `/matricula/confirmacion`, `/matricula/prematrimonial` |
| APIs | `/api/matricula/eligibility`, `/api/studies/groups/[id]/enrollments`, `/api/studies/prematrimonial/*` |
| Tablas | `study_enrollments`, `payments`, `scholarships` |
| Permisos | Autoservicio (anti-suplantación `resolveTargetMemberId`) o `STUDY_ADMIN_ROLES` sobre terceros |
| Estado | Funcional. **La matrícula queda `enrolled` de inmediato** aunque tenga costo; el modal de confirmación ofrece **beca asignada o cupón** (recalcula el monto antes de crear el pago). Con costo NO navega a /confirmacion: abre el modal "Pagar matrícula" |
| Depende de | Estudios (elegibilidad), pagos, becas |

Guards server de `enrollMember` (orden real): grupo existe → ventana (solo autoservicio) → `PAGO_ESTUDIOS_PENDIENTE` (PAG-2: con pagos de estudios pendientes no se matricula OTRO estudio; staff puede override) → `CEDULA_REQUERIDA` (solo PREMAT) → `RESTRICCION_GRUPO` (GRU-2, override staff con bitácora) → grupo virtual autorizado → `PAGO_PENDIENTE` (A3: dropped con pago impago del mismo plan no re-entra) → `YA_COMPLETADO` (terminal) → `CUPO_LLENO`. El dirigente del grupo no paga su propia matrícula.

### Check-in
Registro de asistencia con ventana horaria del día, subeventos, familias, persona nueva, QR y cobro on-site.

| | |
|---|---|
| Páginas | `/eventos/checkin` (picker del día, con búsqueda para registros tardíos), `/eventos/[id]/checkin` |
| APIs | `/api/events/[id]/checkins`, `/api/events/[id]/onsite-charge`, `/api/events/[id]/server-check` |
| Tablas | `event_checkins` (method: manual/qr/smart_link), `sub_events`, `event_registrations`, `payments` |
| Permisos | `EVENT_CHECKIN_ROLES`: encargado_eventos, direccion, admin |
| Estado | Funcional. QR (zxing con carga diferida) o búsqueda por nombre/cédula. **Familia**: registra a varios de una vez, cada quien a su destino (evento general o subevento). **Persona nueva** se crea ahí mismo (con invitación de cuenta si trae correo). Evento pago: solo inscritos; un no inscrito abre el **cobro en sitio** con dos caminos — `pending` (le llega el correo para subir comprobante) o `verified` (pago aprobado en sitio, con quién y cuándo). Ventana: hasta 4h después del fin; registro tardío avisa que queda con fecha de hoy |
| Depende de | Eventos, pagos, miembros (cada check-in de charla recalcula la sede por trigger) |

### Eventos
CRUD con recurrencia (modelo iCalendar de excepciones), tipos, inscripciones, voluntarios, encargados por evento, flyers en Storage, encuestas post-evento y calendario público.

| | |
|---|---|
| Páginas | `/eventos` (list/grid/calendar), `/eventos/nuevo`, `/eventos/[id]` (+`/editar`), `/eventos/tipos`, `/eventos/embed`; pública: `/calendario` |
| APIs | `/api/events/*` (register, registrations, volunteers, checkins, managers, onsite-charge, server-check), `/api/events/types`, `/api/events/upload-flyer`, `/api/event-registrations/[id]/comprobante`, `/api/eventos/elegibilidad`, `/api/public/events` |
| Tablas | `events` (con `registration_form_id`, `survey_*`, `currency`), `event_types`, `sub_events`, `event_exceptions`, `event_registrations`, `event_checkins`, `event_volunteers`, `event_organizing_committees`, `event_managers` |
| Permisos | Gestión: direccion, encargado_staff, comunicaciones (`EVENT_ADMIN_ROLES`). **Encargados por evento** (`event_managers`, no polimórfica a propósito): gestionan ESE evento y heredan su formulario, pero no nombran otros encargados |
| Estado | Funcional. Flyers en el bucket público `event-flyers` (EVE-2; base64 migrado). **Encuesta de satisfacción** (EVE-4): a quienes hicieron **check-in**, formulario o plantilla (mutuamente excluyentes), despachada por cron con offset configurable; `survey_sent_at` se sella siempre para no reintentar. El calendario público muestra **todos** los eventos activos e **inscribe con login-gate** (sin sesión → `/login?redirect=`; con sesión → `/eventos?register={id}`). Ojo: la columna `events.is_public` SÍ existe en la BD (default true) pero **ningún código la usa** — el comentario del route público dice que no existe (desactualizado); **por confirmar** si se quiere filtro real |
| Depende de | Check-in, servidores (voluntarios, exención/precio de servidor del comité organizador), pagos, formularios |

### Servidores / comités
Estructura de servicio: áreas → comités → puestos, vacantes con aplicación pública, solicitudes de puesto, voluntarios y metas.

Tres flujos de solicitud que no hay que confundir:
1. **Solicitud de puesto nuevo** (`/servidores/puestos/solicitar`, `position_requests`): pedir que se **cree** un puesto.
2. **Solicitud de vacante** (`/servidores/vacantes/solicitudes`, `creado → enviado_lider → aprobado/denegado`): pedir que se **abra** una vacante (ventana abre el día 25).
3. **Aplicaciones** (`/servidores/aplicaciones`): servidores que **aplican** a una vacante abierta.

| | |
|---|---|
| Páginas | `/servidores`, `/servidores/[committeeId]`, `/servidores/vacantes/*`, `/servidores/aplicaciones`, `/servidores/admin` (+importar-vacantes), `/servidores/puestos/solicitar`; pública: `/vacantes` |
| APIs | `/api/servers/*` (areas, committees, positions, position-requests, vacancies +apply/bulk/import/export-applicants, applications, volunteers, goals, manageable-committees), `/api/public/vacancies` |
| Tablas | `areas`, `service_positions`, `position_records`, `position_requests`, `volunteers`, `vacancies`, `applications`, `committee_goals`, `member_role_position_grants` |
| Permisos | `SERVICE_ADMIN_ROLES` (encargado_staff, coordinador_servidores, direccion, admin) + `lider_comite` (scope su comité) |
| Estado | Funcional. Migración 20260819100000 (`servers_onboarding`) — **por confirmar** el detalle de su alcance |
| Depende de | Accesos (`position-role-sync`), eventos (voluntarios), miembros |

### Comunicaciones
Envíos masivos por email con audiencias, listas guardadas, plantillas, programación y tracking (SES → SNS → webhook).

| | |
|---|---|
| Páginas | `/comunicaciones`, `/comunicaciones/nueva`, `/comunicaciones/[id]`, `/comunicaciones/plantillas/*`, `/comunicaciones/configuracion` |
| APIs | `/api/communications/messages/*` (process, send, **schedule**, recipients), `/api/communications/templates`, `/api/communications/configs`, `/api/communications/audience`, `/api/communications/upload-image`, `/api/communications/upload-media`, `/api/email/unsubscribe`, `/api/email/resubscribe`, `/api/email/sns-webhook` |
| Tablas | `message_broadcasts`, `message_logs`, `message_templates`, `channel_configs`, `internal_notifications` |
| Permisos | `comunicaciones`, `direccion`. **`/comunicaciones/configuracion` es solo `admin`** (COM-1, UI + API) |
| Estado | Funcional para email. Broadcasts **programados** (cron cada 15 min). Audiencias: todos / por sede / servidonantes / comités / **lista guardada** / manual. WhatsApp solo modelado en el esquema (fase siguiente) |
| Tipo de correo | **No se elige**: se infiere de la plantilla (`email-kind.ts`) — `is_system` o categoría transaccional/inscripción/bienvenida → transaccional; el resto → marketing (con pie de baja + List-Unsubscribe). Sin plantilla → marketing (default seguro) |
| Editor | Dos modos. El visual (TipTap) destruye HTML avanzado; la detección (`email-html.ts`) evalúa señales (tablas, `<style>`, clases, VML, estilos en línea no-básicos) y abre en **modo código** con confirmación explícita para forzar el visual. Plantillas de sistema siempre abren en código y son editables pero **no borrables** ni se les puede cambiar `system_key` |
| Depende de | Miembros (audiencias/listas), formularios, email (infra) |

### Formularios
Builder con campos configurables, hero con flyer, respuestas, accesos puntuales y selección de comité.

| | |
|---|---|
| Páginas | `/formularios`, `/formularios/nuevo`, `/formularios/[id]` (+preview, responder, respuestas, **selección**) |
| APIs | `/api/forms`, `/api/forms/[id]`, `/api/forms/[id]/responses`, `/api/forms/[id]/access`, `/api/forms/[id]/selection`, `/api/forms/upload-hero` |
| Tablas | `forms` (hero_*, assignment_notified_key), `form_fields`, `form_responses`, `form_response_values`, `form_access_grants` |
| Permisos | Rol **`forms`** (módulo completo sin delete) + `comunicaciones`, `direccion`, `encargado_staff`. **Accesos puntuales** (`form_access_grants`): leer/exportar respuestas de UN formulario, sin editar estructura. Herencia desde el evento padre (`event_managers`). La **selección** (EST-10) es solo coordinadores + admin — ni dirección (respuestas con testimonio personal) |
| Quién LLENA | Solo la audiencia (`fill-access.ts`): link por correo, inscritos del evento, matriculados del grupo, convocados — o cualquiera si `is_public`. Cerrado por defecto |
| Estado | Funcional. `form_asignado` conectado (dedupe por `assignment_notified_key`); `form_completado` al responder. Triggers de BD validan la entidad asociada |
| Depende de | Eventos y estudios, email, Storage (`form-heroes`) |

### Folletos
Cola de tiquetes de impresión/entrega por sede. **Las reglas de generación cambiaron por completo** (2026-08): ya no se generan por cierre ni por hitos de bloque.

| | |
|---|---|
| Páginas | `/estudios/folletos` |
| APIs | `/api/studies/folletos` (+bulk, manual), cron `/api/cron/folleto-blocks` |
| Tablas | `folleto_requests` — tipos vigentes: **`cupo_lleno`**, **`fin_matricula`**, **`manual`**, `reubicacion`; (`cierre` y `preapertura_*` solo quedan como datos históricos) |
| Permisos | Permiso `folletos` (rol acotado `folletos` — **coordinador_estudios NO trae el módulo**, lo delega) |
| Estado | Funcional. Automáticos: `cupo_lleno` al confirmarse la matrícula que llena el grupo, `fin_matricula` al vencer la ventana con ≥5 matriculados (idempotente por índice único por grupo); solo planes con folleto propio (N1-N4, DIS1-DIS3, PREMAT). `manual` desde el botón de la cola (nivel, cantidad, sede, dirigente, nota). El cron `folleto-blocks` **ya no crea tiquetes**: solo avisa los hitos del bloque (campana + correo con conteo por sede y desglose) a quienes tienen permiso folletos. Estados lineales: `creada → en_impresion → enviado_entregado → cerrada`. Sede del tiquete: `folletos_sede` del grupo → sede del dirigente → zona del grupo |
| Depende de | Estudios (bloques, matrícula), email + notificaciones |

### Pagos (unificado) y Mis pagos
Página unificada de pagos para gestión y autoservicio del miembro para sus cobros.

| | |
|---|---|
| Páginas | **`/finanzas/pagos`** (tabs `todos` y `revision`; absorbe la vieja `/pagos/revision`, que quedó como redirect), `/finanzas/pagos/[id]` (detalle + devolución), **`/mis-pagos`** (cobros propios y de la familia, subir comprobante, historial, "Mis becas") |
| APIs | `/api/payments` (+`[id]/receipt`, `[id]/review`, `[id]/remind`, `[id]/apply-scholarship`, `[id]/scholarship-options`, `bulk`, `queue`), `/api/finance/payments` |
| Tablas | `payments` (status + review_status + concept + currency), `refunds` |
| Permisos | REV-3: la ven `finanzas` o `revision_pagos` (view) — es decir revision_pagos, folletos, coordinadores, finanzas, direccion, admin, solo_lectura (matriz fijada por test). Acciones por permiso: revisar → `revision_pagos:edit`; devoluciones → `finanzas:edit`; aplicar beca → `becas:edit` o revisor |
| Estado | Funcional. Referencia duplicada detectada por índice único; acciones con guard 409 si el tiquete cambió. RPC `approve_payment` propaga por `concept` (evento → paid; prematrimonial → avanza estado; matrícula/folletos → hoy es no-op porque la matrícula ya nace `enrolled`). La lista deriva "de qué es el cobro" de las columnas (`payment-label.ts`). Recordatorio semanal consolidado (cron lunes) con link a /mis-pagos |
| Depende de | Matrícula, eventos, folletos, prematrimonial; cron `payment-holds-expire` (**solo eventos**: +72h del rechazo libera el cupo) |

**No existen pagos en tractos/cuotas** (FIN-4 pendiente): un pago = una fila con un monto.

### Becas
Becas asignadas y cupones genéricos, totales o **parciales** (porcentaje o monto fijo), con solicitudes y revisión.

| | |
|---|---|
| Páginas | `/finanzas/becas`, `/finanzas/becas/nueva` |
| APIs | `/api/scholarships` (+applicable, coupons, `[id]/send-email`, `requests/[id]/review`), `/api/finance/scholarships` |
| Tablas | `scholarships` (kind asignada/generica; discount_type percentage/fixed; approval_type total/parcial; currency), `scholarship_redemptions` |
| Permisos | `requireModuleView('becas')`: becas, finanzas, direccion, admin |
| Estado | Funcional. Un solo uso por beca (guard atómico). Se aplica en el modal de matrícula (beca asignada o cupón) o **sobre un pago ya creado** (`apply-scholarship`: 100% → pago aprobado sin comprobante; parcial → sigue pendiente por el resto). Descuento fijo en otra moneda → `moneda_distinta` (sin conversión). Las solicitudes viven en `finance_requests` (request_type scholarship) |
| Depende de | Matrícula, finanzas, email (aprobada/parcial/rechazada/cupón) |

### Finanzas
Donaciones (import CSV por lotes), pagos, devoluciones, solicitudes y reportes.

| | |
|---|---|
| Páginas | `/finanzas`, `/finanzas/donaciones` (+importar), `/finanzas/pagos`, `/finanzas/devoluciones`, `/finanzas/reportes`, `/finanzas/solicitudes`, `/finanzas/becas` |
| APIs | `/api/finance/*` (donations +import, import-batches, payments, refunds, requests +assignees +payment-options, scholarships) |
| Tablas | `donations`, `payments`, `payment_categories`, `refunds`, `finance_requests` (+history), `import_batches`, `scholarships` |
| Permisos | `finanzas`, `direccion` (admin siempre) |
| Estado | Funcional. Import con dedup doble; trigger marca `members.is_donor`. **Multimoneda**: los agregados (`payment_stats`, `donation_stats`, `dashboard_sums`) ya devuelven totales POR moneda y la UI los muestra separados (`formatTotalsInline`); en /finanzas/reportes las barras se calculan una moneda a la vez |
| Depende de | Miembros, becas, pagos |

### Empleados
RRHH de puestos remunerados: perfiles, salarios (con `salary_currency`), documentos y vacaciones.

| | |
|---|---|
| Páginas | `/empleados`, `/empleados/nuevo`, `/empleados/[id]` (+editar), `/empleados/puestos/*` |
| APIs | `/api/employees` (+salary, documents, vacations, positions) |
| Tablas | `employees`, `employee_documents`, `salary_changes`, `vacation_records`, `paid_positions` |
| Permisos | `direccion`, `encargado_staff` |
| Estado | Funcional |
| Depende de | Miembros, Storage (`employee-docs`) |

### Accesos / roles
Asignación de roles. Fuente de verdad: `src/lib/auth/roles.ts`.

| | |
|---|---|
| Páginas | `/accesos`, `/accesos/[memberId]` |
| APIs | `/api/accesos`, `/api/accesos/[memberId]/roles` |
| Tablas | `member_roles` (CHECK con los **20 roles**), `member_role_position_grants`, `form_access_grants` (accesos puntuales por formulario) |
| Permisos | `admin` gestiona todo; `coordinador_estudios` entra pero solo asigna los 3 roles delegables (editor_perfiles, editor_grupos_estudio, folletos), validado server-side. `direccion` NO ve accesos |
| Estado | Funcional |
| Depende de | Miembros, servidores (`position-role-sync`) |

### Reportes
Asistencia a charlas, Discípulos Multiplicadores y retención, servidos desde caché (`report_snapshots`) recalculada cada noche.

| | |
|---|---|
| Páginas | `/reportes`, `/reportes/asistencia`, `/reportes/discipulos`, `/reportes/retencion` |
| APIs | `/api/reports/*` (charla-attendance, discipulos, retencion, member-growth); cron `/api/cron/report-snapshots` |
| Tablas | `report_snapshots`; RPCs `get_dm_flags`, `get_dm_milestones`, `report_charla_attendance`, `report_member_growth`… |
| Permisos | `requireModuleView('reportes')`: reportes, coordinadores, direccion, admin, solo_lectura |
| Estado | Funcional |
| Depende de | Check-ins, estudios, donaciones, servidores |

### Dashboard y landing por rol
`/dashboard` con KPIs por dominio filtrados por `can()`. **SEC-1**: no todos aterrizan ahí — `miembro`, `dirigente` y `lider_comite` (y quien no tiene roles) aterrizan en **su perfil**; `encargado_eventos` puro aterriza en `/eventos/checkin`. El `?redirect=` post-login respeta una whitelist anti open-redirect.

### Notificaciones / alertas
Bandeja interna (`/notificaciones`, `internal_notifications`) + alertas calculadas al vuelo (`/api/alerts`). Las alertas se **filtran por los roles de quien pregunta** (2026-08-20) y las de solicitudes de estudio separan reubicaciones e intereses con deep-link al tab correcto. Despacho por correo respeta preferencias por categoría; las de seguridad se envían siempre.

### Centro de ayuda y tutoriales
`/ayuda` es **público por capas**: sin sesión se ven solo los artículos `visibilidad: publica`; con sesión, el índice y cada artículo se filtran por rol (`publica` | `gestion` | `roles: [...]`; default más restrictivo; admin ve todo). Con sesión se envuelve en el AppShell. Contenido en `content/ayuda/*.md` (26 artículos) con frontmatter y **renderer markdown propio** sin dependencias (soporta video mp4 plegado y par infografía+GIF en dos columnas). Assets en `public/ayuda/{infografias,tutoriales}/`.

**Tutoriales grabados** (`scripts/tutoriales/`, Playwright + ffmpeg): 9 flujos (primera-vez, matrícula, cierre, perfil, eventos, mis-pagos, check-in, folletos, reubicación) que corren contra **producción** con cuentas `[prueba]` del seed (dominio `.invalid`, que el provider de correo omite). GUARD: se niegan a correr si `TUTORIAL_USER_EMAIL` no contiene `@prueba.`. Cada corrida produce GIF móvil (<5MB) + mp4 y publica idempotente al centro de ayuda. `npm run tutorial:<flujo>` o `tutorial:all`.

### Configuración
`/configuracion` es configuración **de la cuenta del usuario** (preferencias de notificación); `/configuracion/seguridad` maneja contraseña, passkeys, TOTP y sesiones. **No existe** panel de org/sedes y es intencional: las sedes se administran en la BD; `/api/sedes` solo crea zonas al vuelo desde el combobox de grupos.

## 3. Reglas de negocio transversales

### Asistencia (fuente única: `src/lib/attendance.ts`)
- **Activo (general):** ≥6 check-ins de charla en los últimos 6 meses calendario completos **y** ≥1 en los últimos 60 días.
- **Reforzado (intermedia y avanzada):** igual pero ≥12 charlas.
- **"Sigue asistiendo" (retención, laxo):** ≥2 charlas en 4 meses, sin recencia.
- Solo cuentan check-ins de **charla**.

### Sede del miembro (SQL única fuente — REF-1)
- Activo: charla más asistida en los últimos 6 meses (empate → la más reciente). Inactivo: lo mismo sobre los 6 meses previos a su última asistencia. Nunca asistió → sin sede.
- Única implementación de producción en SQL: `refresh_member_sede(member_id)` (trigger en cada check-in) + `refresh_member_sedes()` (pg_cron 6:45 UTC). Consumidores leen lo persistido. `computeMemberSede` (TS) es solo la especificación ejecutable de los fixtures. Frescura del flip activo→inactivo: ≤24h.
- **Zonas**: `sedes.is_zone` (23 aprobadas 2026-08-17) gobierna los pickers de zona de grupos de estudio, separado de `is_active` (pickers de miembros/eventos/comunicaciones).

### Elegibilidad de estudios (`src/lib/studies/eligibility.ts`)
- Etapas: inicial → asistencia; intermedia y **avanzada** → donante + servidor + asistencia reforzada; niveles y campañas → sin compromisos.
- Prerequisito encadenado por plan; haber completado un nivel posterior bloquea repetir los previos.
- Prematrimonial: ambos con N2 completado + documento registrado (409 server-side).
- Excepciones por miembro (donor/server/attendance/prerequisite/age/all, con motivo obligatorio). Planes invitation-only ocultos sin invitación activa; grupos virtuales solo autorizados; solo grupos `en_matricula` con cupo.

### Pago y matrícula en carriles separados (regla 2026-08-04)
- Matricular escribe `enrolled` SIEMPRE (autoservicio, staff, resolución de reubicación, auto-matrícula post-cierre). El pago nace `pending` aparte; si el insert del pago falla, se revierte la matrícula.
- `pendiente_de_pago` y `expirada` sobreviven solo como datos históricos (siguen en el CHECK y en `OCCUPYING_STATUSES`).
- El cron `payment-holds-expire` **solo expira inscripciones de eventos** (+72h tras el rechazo). En eventos el cupo SÍ se reserva contra el pago.

### Máquinas de estado

| Objeto | Estados | Notas |
|---|---|---|
| Pago (`payments`) | status: `paid/pending/failed/refunded/partial_refund` · review_status: `en_revision/aprobado/rechazado` | approve/reject/start_review/reopen/close; 409 si cambió. Aprobar propaga por `concept` |
| Matrícula (`study_enrollments`) | `enrolled/waitlist/completed/dropped/transferred/reprobado` (+`pendiente_de_pago/expirada` históricos) | `completed` es terminal; el retiro cancela el pago pendiente asociado |
| Grupo de estudio | `en_matricula → en_curso → finalizado` | Cierre por ventana vía cron; el sucesor hereda dirigente/horario/zona |
| Bloque (`capacitacion_bloques`) | `en_apertura → activo → archivado` | Derivado por fecha, nunca manual; cierre = matrícula + 3 meses |
| Tiquete de evento (`event_registrations`) | `pending/paid/exempted/expired` | Servidor del comité organizador exento o con precio propio |
| Folleto (`folleto_requests`) | `creada → en_impresion → enviado_entregado → cerrada` | Lineal, sin retroceso |
| Vacante (`vacancies`) | `creado → enviado_lider → aprobado/denegado`; `aprobado → cerrada` | Ventana de solicitud abre el día 25 |
| Beca (`scholarships`) | `active → used/revoked` | Un solo uso, guard atómico |
| Solicitudes (estudio/finanzas/prematrimonial) | `open → in_review → resolved/rejected` (premat: `pago_en_revision/pendiente/grupo_creado/cancelada`) | Reubicación resuelta = matrícula real; una solicitud de estudio abierta a la vez |
| Broadcast (`message_broadcasts`) | `draft/scheduled/sending/sent/failed/partial` | Programados vía cron cada 15 min; log por destinatario |

### Regla global de borrado
- **No hay soft-delete**; el borrado es físico. DELETE con referencias activas → **409** con código y conteo, modal de advertencia en la UI (endpoints `/usage` para la consulta previa).
- `is_system` protege plantillas y miembros de sistema.

### Otras
- Dedup de miembros por (tipo de documento, número normalizado) y correo → 409.
- Anti-suplantación: `resolveTargetMemberId()`.
- Roles por puesto: `position-role-sync` al entrar/salir de comités.
- Familias: el auth-context arrastra `family_member_ids` para autoservicio sobre familiares (p. ej. pagar sus cobros en /mis-pagos).
- Multimoneda (CRC/USD/EUR): `currency` en payments, donations, events, refunds, scholarships, study_plans, sedes y salarios; los pagos heredan la moneda de su origen; formateo único `formatMoney`.

## 4. Infraestructura

### Crons de Vercel (vercel.json; auth Bearer `CRON_SECRET` o sesión con rol; ping a Healthchecks si la env existe)

| Cron | Horario (UTC) | Qué hace |
|---|---|---|
| `/api/cron/report-snapshots` | 06:00 diario | Recalcula datasets de reportes a `report_snapshots` |
| `/api/cron/group-enrollment-windows` | 12:30 diario | Cierra matrícula por ventana (→ `en_curso`) **y** genera folleto `fin_matricula` (≥5 matriculados) |
| `/api/cron/folleto-blocks` | 13:00 diario | Avisa los hitos del bloque (campana + correo con conteos); **ya no crea tiquetes** |
| `/api/studies/start-reminders` | 13:30 diario | Correo `inicio_capacitacion` a estudiantes de grupos por arrancar |
| `/api/notifications/leader-absence-check` | 14:00 diario | Dirigente activo >4 semanas sin charla → aviso a coordinadores (máx 1/semana) |
| `/api/cron/storage-orphans` | 15:00 lunes | Reporte Storage↔BD (solo `payment-receipts` y `employee-docs`; solo reporta) |
| `/api/cron/payment-holds-expire` | 16:00 diario | **Solo eventos**: comprobante rechazado +72h → inscripción `expired` |
| `/api/cron/payment-reminders` | 16:30 lunes | Recordatorio consolidado de pagos pendientes por miembro → /mis-pagos |
| `/api/cron/event-surveys` | 17:00 diario | Encuestas post-evento a quienes hicieron check-in |
| `/api/cron/study-surveys` | 17:30 diario | Encuesta de satisfacción del dirigente a los estudiantes del grupo cerrado |
| `/api/cron/scheduled-broadcasts` | cada 15 min | Despacha los broadcasts programados |

Las **11** variables `HEALTHCHECK_URL_*` (una por cron) están en `.env.example` y un test vigila la sincronía (`src/lib/health.test.ts`).

**pg_cron (Supabase, 3 jobs SQL):** `refresh_donor_flags` (6:30), `refresh_member_sedes` (6:45), `prune_audit_log` (4:00). No hay edge functions desplegadas.

### Email
- AWS SES por SMTP (nodemailer, STARTTLS 587). Configuration set → SNS → webhook con firma verificada. Supresión + unsubscribe/resubscribe. Límite diario `EMAIL_DAILY_LIMIT` (default 5000). DKIM/DMARC verificados (2026-08-03; el DMARC pasa por DKIM). El provider **omite dominios `.invalid`** (cuentas de prueba) sin llamar a SES.
- **Plantillas de sistema** (BD con fallback hardcodeado, editables pero no borrables): `form_asignado`, `form_completado`, `matricula_estudiante`, `matricula_dirigente`, `inicio_capacitacion`, `beca_aprobada`, `beca_aprobada_parcial`, `beca_rechazada`, `cupon_asignado`, `encuesta_evento`, `retro_dirigente`, `retro_dirigente_resumen`, `solicitud_asignada`. `bienvenida` y `recuperacion_contrasena` las maneja Supabase Auth; la invitación de cuenta y el aviso de hitos de folletos son HTML directo en código (no plantilla).

### Storage
6 buckets referenciados en código: `payment-receipts`, `employee-docs`, `email-images` y `email-media` (editor de correos, públicos), `event-flyers` (público) y `form-heroes` (público, 5 MB, MIME limitado). No se declaran en migraciones (dashboard de Supabase; documentados en el encabezado del baseline).

### RLS
Habilitado en todas las tablas (defensa en profundidad; la app opera vía service role). Helpers `private.has_any_role()`, `is_admin()`, `is_own_member()`. `vacancies` con SELECT público a propósito; `report_snapshots` deny-all.

### CI
`.github/workflows/ci.yml` (push a main y PRs): typecheck, lint con ratchet (`--max-warnings=107`, solo baja), tests (vitest, 957). El build de Vercel corre aparte.

### Migraciones
Baseline consolidado `20260730193000` (squash MNT-1: 71 tablas, 200 policies, probado desde cero en contenedor limpio; histórico en `migrations_archive/`) + **28 migraciones posteriores** (forms/grants, matrícula inmediata, event_managers, restricciones de grupo, hero, encuestas evento/estudio, leader feedback, multimoneda en agregados, broadcasts programados, is_zone, bloques histórico+FK, etc.). Nota operativa: el registro de `db push` está desalineado — el SQL se aplica directo (node+pg al pooler) y la versión se registra a mano.

### Variables de entorno (solo nombres)

| Grupo | Variables |
|---|---|
| Obligatorias (zod en `env.ts`) | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` o `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SECRET_KEY` o `SUPABASE_SERVICE_ROLE_KEY` |
| Requeridas de facto | `CRON_SECRET`, `SES_SMTP_HOST`, `SES_SMTP_PORT`, `SES_SMTP_USER`, `SES_SMTP_PASSWORD`, `SES_FROM_EMAIL`, `SES_FROM_NAME`, `NEXT_PUBLIC_SITE_URL` |
| Opcionales | `SES_CONFIGURATION_SET`, `SES_SNS_TOPIC_ARN`, `EMAIL_DAILY_LIMIT`, `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN`, las 11 `HEALTHCHECK_URL_*` |
| Seeds / tutoriales | `PERMITIR_SEED_PRUEBA`, `PRUEBA_PASSWORD`, `SEED_TEST_PASSWORD`, `TUTORIAL_USER_EMAIL`, `TUTORIAL_USER_PASSWORD`, `TUTORIAL_BASE_URL` |

**Drift real en `.env.example`**: lista `BREVO_API_KEY`/`BREVO_DAILY_LIMIT` (proveedor viejo) y NO lista las `SES_*` que el código sí usa — corregirlo.

## 5. Catálogo de permisos

Fuente: `src/lib/auth/roles.ts` (constante `ROLES`, **20 roles**; el CHECK de `member_roles` coincide); asignación en `member_roles` (multi-rol; sin filas = `miembro`). `admin` siempre pasa cualquier guard.

| Rol | Habilita |
|---|---|
| `miembro` | Su perfil, sus grupos y su familia (scope own). Default. **Aterriza en su perfil**, no en el dashboard |
| `solo_lectura` | Ver todo, sin editar |
| `reportes` | Ver y exportar reportes |
| `folletos` | Cola de folletos + revisión de pagos (ver/editar) |
| `revision_pagos` | Cola de revisión de comprobantes (ver/editar) |
| `becas` | Becas (ver/editar) |
| `editor_perfiles` | Miembros: ver, crear, editar |
| `editor_grupos_estudio` | Estudios: ver módulo + gestionar grupos (vía `GROUP_ADMIN_ROLES`); no plan/bloques/solicitudes |
| `forms` | Formularios completo (ver/crear/editar/exportar), sin borrar |
| `comunicaciones` | Comunicaciones (ver/crear/editar) + ver miembros + formularios (ver/crear/editar/exportar) + guardar listas |
| `lider_comite` | Servidores y miembros de SU comité. Aterriza en su perfil |
| `dirigente` | Sus grupos (ver/editar, incluye asistencia y **cerrar los suyos**) + miembros scope own. Aterriza en su perfil |
| `coordinador_dirigentes` | Estudios (ver/editar) + miembros (ver) + reportes + revisión de pagos |
| `coordinador_estudios` | Estudios completo (crear/editar/exportar) + miembros (ver) + reportes + revisión de pagos + **delegar 3 roles** (editor_perfiles, editor_grupos_estudio, folletos) en /accesos |
| `encargado_staff` | Servidores completo + empleados + miembros (ver) + formularios |
| `coordinador_servidores` | Servidores (ver/crear/editar) + miembros (ver) + reportes |
| `encargado_eventos` | Eventos: ver/editar/exportar (check-in, cobro on-site, reportes del evento). Puro → aterriza en /eventos/checkin |
| `finanzas` | Finanzas completo + miembros (ver) + revisión de pagos + becas |
| `direccion` | Casi todo con crear/editar/exportar, **sin delete y sin el módulo accesos** (tampoco ve la selección de comité EST-10 ni la configuración de comunicaciones) |
| `admin` | Todo |

Permisos fuera del catálogo de roles: `event_managers` (gestionar UN evento) y `form_access_grants` (respuestas de UN formulario) — accesos puntuales por entidad, no roles.

## 6. Pendientes y deuda técnica

**En el código (verificado 2026-08-21):**
1. `/terminos` — texto legal borrador; un abogado debe revisarlo (acción externa).
2. Multimoneda, resto fino: los agregados ya separan por moneda, pero el **modal de confirmación de matrícula** calcula el descuento con `Math.round` propio y formatea con `formatCRC` — asume colones aunque el backend cobra en la moneda del plan.
3. `study_plans.level = 'externa'` existe en el CHECK pero no está mapeado en `LEVEL_TO_STAGE` (cae al fallback 'niveles') — mapearlo o retirarlo.
4. `events.is_public` existe en la BD (default true) pero ningún código la lee; el calendario público muestra todo lo activo y el comentario del route dice que la columna no existe. Decidir: filtro real o retirar la columna.
5. `.env.example` desactualizado: `BREVO_*` en vez de las `SES_*` reales.
6. Menores: `defaultEnrollmentWindow()` es código muerto; el comentario del sidebar sobre accesos dice "admin/direccion" (es admin/coordinador_estudios); QueryBar del padrón solo combina con AND.

**Operativos (fuera del código, acciones del usuario/administración — Fase 0 del plan):**
- Agregar las **11** `HEALTHCHECK_URL_*` en Vercel (lista con horarios en `.env.example`).
- Env vars de Supabase en Vercel solo están en Production; los deploys Preview fallan.
- Configurar Sentry (`SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN`).
- Confirmar el SMTP de Supabase Auth en producción (invitaciones de cuenta).
- **No existe ambiente de staging**: los tutoriales grabados y las pruebas corren contra producción con datos `[prueba]`.

**Del plan (`docs/plan-desarrollo.md`), abierto a hoy:**
- **MIG-1** — limpieza de datos de prueba + reimportación del histórico reciente de CCB (incluye la propuesta de `EMAIL_SILENT_MODE`, que hoy NO existe en el código; lo único implementado es que el provider omite `.invalid`).
- **Fase 8 (reuniones de agosto):** FIN-2 (pedir documento donde falta), FIN-3 (beca visible en el modal de pago + comprobante requerido), FIN-4 (arreglo de pago en tractos), FIN-5 (aprobación parcial de becas con porcentaje libre), FIN-6 (devoluciones: tipos/filtros/convertir en donación), DIR-1 (formulario de disponibilidad desde CCB), DIR-2 (cumpleaños automáticos — hoy no existe ninguna plantilla de cumpleaños), DIR-3 (recordatorio de cierre), DIR-4 (envío automático de la evaluación al cerrar), DIR-5 (página "Evaluaciones" con tiquetes y **rol nuevo** — el rol `evaluaciones` NO existe todavía), DIR-6 (estados administrativos del dirigente), DIR-7 (reporte de dirigentes).
- **Fase 9 (feedback 2026-08-20):** EST-14 (motivo de retiro: verificar por qué no se aplica), EST-15 (dropdown CDEB solo capacitaciones), REU-3 (link de "¿grupo equivocado?" en Matrícula), FRM-3 (exportar respuestas a Excel), PRE-11 (dirigente y co-dirigente obligatorios en premat), UI-1 (legibilidad), FRM-4 (llenar a nombre de otra persona), AYU-1 (dos artículos de ayuda).

**Backlog (requiere definición de producto):** CAM-1 (campañas como tipo de matrícula), WAP-1 (canal WhatsApp — solo modelado), PAY-FUT (tarjeta/SINPE directo — UI retirada, esquema listo), internacionalización fina (multi-idioma, husos de crons, GDPR).

**Decisiones confirmadas (no son deuda):**
- Sedes sin panel admin (se administran en BD).
- El calendario público muestra todos los eventos activos (sin filtro), inscripción con login-gate.
- `event_managers` y `form_access_grants` son tablas por entidad, NO una `entity_managers` polimórfica (decisión 2026-08-06: FKs reales).
- La selección de comité (EST-10) excluye a `direccion` a propósito (respuestas con testimonio personal).
- `/comunicaciones/configuracion` solo admin (COM-1).

**Plan de ejecución:** la cola completa priorizada está en [`docs/plan-desarrollo.md`](plan-desarrollo.md).
