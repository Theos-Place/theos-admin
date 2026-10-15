# QA-3 · Censo de endpoints — 2026-10-15

398 handlers en 300 rutas. Generado por `node scripts/qa3/censo-endpoints.cjs`.

**Guard:** `roles` = requireRoles con roles explícitos · `modulo` = requireModuleView / requireFormEdit / requireEventAccess · `sesion` = requireRoles() o getAuthContext() a secas (el handler acota por pertenencia; ver informe) · `secreto` = CRON_SECRET · `publico` = sin sesión por diseño.
**Consultas:** llamadas `.from()`/`.rpc()` escritas en el propio handler; las que viven en `src/lib/supabase/queries` no se cuentan acá.

| Guard | Handlers |
|---|---|
| roles | 174 |
| sesion | 93 |
| modulo | 93 |
| publico | 15 |
| secreto | 22 |
| firma | 1 |

| Validación | Handlers |
|---|---|
| a mano | 83 |
| n/a (sin body) | 217 |
| a mano (formData) | 12 |
| zod | 86 |

| Ruta | Método | Guard | Validación | Consultas en el handler | catch sin reportarError |
|---|---|---|---|---|---|
| `/api/accesos/[memberId]/roles` | POST | roles — requireRoles(...ACCESOS_SCREEN_ROLES) | a mano | 0 |  |
| `/api/accesos/[memberId]/roles` | DELETE | roles — requireRoles(...ACCESOS_SCREEN_ROLES) | a mano | 0 |  |
| `/api/accesos` | GET | roles — requireRoles(...ACCESOS_SCREEN_ROLES) | n/a (sin body) | 0 |  |
| `/api/adelantos/[id]/receipts` | POST | sesion — requireRoles() / rateLimit( | a mano (formData) | 0 |  |
| `/api/adelantos/[id]` | GET | sesion — requireRoles() | n/a (sin body) | 0 |  |
| `/api/adelantos/[id]` | PATCH | sesion — requireRoles() | zod | 0 |  |
| `/api/adelantos/export` | GET | modulo — requireModuleView('finanzas', { action: 'export' }) | n/a (sin body) | 0 |  |
| `/api/adelantos` | GET | sesion — requireRoles() | n/a (sin body) | 0 |  |
| `/api/adelantos` | POST | sesion — requireRoles() | zod | 0 |  |
| `/api/alerts` | GET | sesion — requireRoles() | n/a (sin body) | 0 |  |
| `/api/audience/count` | POST | sesion — requireRoles() | a mano | 0 |  |
| `/api/audit/[entityType]/[entityId]` | GET | modulo — requireModuleView(modulo, { beyondOwn: true }) | n/a (sin body) | 0 |  |
| `/api/auth/login` | POST | publico — rateLimit( / rateLimit( | a mano | 0 |  |
| `/api/auth/logout` | POST | publico | n/a (sin body) | 0 |  |
| `/api/auth/me` | GET | publico | n/a (sin body) | 6 |  |
| `/api/auth/password-link` | POST | publico — rateLimit( / rateLimit( / rateLimit( | zod | 1 |  |
| `/api/auth/registro` | POST | publico — rateLimit( / rateLimit( | zod | 3 |  |
| `/api/communications/audience` | GET | roles — requireRoles('comunicaciones', 'direccion') | n/a (sin body) | 0 |  |
| `/api/communications/configs/[id]` | PUT | roles — requireRoles('admin') | zod | 0 |  |
| `/api/communications/configs/[id]` | DELETE | roles — requireRoles('admin') | n/a (sin body) | 0 |  |
| `/api/communications/configs/[id]/verify` | POST | roles — requireRoles('admin') | n/a (sin body) | 0 |  |
| `/api/communications/configs` | GET | modulo — requireModuleView('comunicaciones') | n/a (sin body) | 0 |  |
| `/api/communications/configs` | POST | roles — requireRoles('admin') | zod | 0 |  |
| `/api/communications/email-status` | GET | roles — requireRoles('comunicaciones', 'direccion') | n/a (sin body) | 0 |  |
| `/api/communications/email-status` | POST | roles — requireRoles('comunicaciones', 'direccion') | a mano | 0 |  |
| `/api/communications/messages/[id]/process` | GET | secreto — authorize→secretsMatch( / authorize→CRON_SECRET / authorize→requireRoles('comunicaciones', 'direccio | n/a (sin body) | 0 |  |
| `/api/communications/messages/[id]/process` | POST | secreto — authorize→secretsMatch( / authorize→CRON_SECRET / authorize→requireRoles('comunicaciones', 'direccio | a mano | 1 |  |
| `/api/communications/messages/[id]/recipients` | GET | modulo — requireModuleView('comunicaciones') | n/a (sin body) | 0 |  |
| `/api/communications/messages/[id]` | DELETE | roles — requireRoles('comunicaciones', 'direccion') | n/a (sin body) | 0 |  |
| `/api/communications/messages/[id]` | PATCH | roles — requireRoles('comunicaciones', 'direccion') | zod | 0 |  |
| `/api/communications/messages/[id]/schedule` | POST | roles — requireRoles('comunicaciones', 'direccion') | zod | 0 |  |
| `/api/communications/messages/[id]/schedule` | DELETE | roles — requireRoles('comunicaciones', 'direccion') | n/a (sin body) | 0 |  |
| `/api/communications/messages/[id]/send` | POST | roles — requireRoles('comunicaciones', 'direccion') | a mano | 0 |  |
| `/api/communications/messages` | GET | modulo — requireModuleView('comunicaciones') | n/a (sin body) | 0 |  |
| `/api/communications/messages` | POST | roles — requireRoles('comunicaciones', 'direccion') | zod | 0 |  |
| `/api/communications/summary` | GET | roles — requireRoles('comunicaciones', 'direccion') | n/a (sin body) | 0 |  |
| `/api/communications/system-emails` | GET | roles — requireRoles('comunicaciones', 'direccion') | n/a (sin body) | 0 |  |
| `/api/communications/templates/[id]` | PUT | roles — requireRoles('comunicaciones', 'direccion') | zod | 0 |  |
| `/api/communications/templates/[id]` | DELETE | roles — requireRoles('comunicaciones', 'direccion') | n/a (sin body) | 0 |  |
| `/api/communications/templates` | GET | modulo — requireModuleView('comunicaciones') | n/a (sin body) | 0 |  |
| `/api/communications/templates` | POST | roles — requireRoles('comunicaciones', 'direccion') | zod | 0 |  |
| `/api/communications/upload-image` | POST | roles — requireRoles('comunicaciones', 'direccion') | a mano (formData) | 0 |  |
| `/api/communications/upload-media` | POST | roles — requireRoles('comunicaciones', 'direccion') | a mano (formData) | 0 |  |
| `/api/cron/birthday-greetings` | POST | secreto — authorize→secretsMatch( / authorize→CRON_SECRET / authorize→requireRoles('direccion', 'comunicacione | n/a (sin body) | 2 |  |
| `/api/cron/close-reminders` | POST | secreto — authorize→secretsMatch( / authorize→CRON_SECRET / authorize→requireRoles('coordinador_dirigentes', ' | n/a (sin body) | 0 |  |
| `/api/cron/cuentas-sin-ficha` | POST | secreto — authorize→secretsMatch( / authorize→CRON_SECRET / authorize→requireRoles('admin', 'direccion') | n/a (sin body) | 1 |  |
| `/api/cron/desbloquear-mayores` | GET | secreto — authorize→secretsMatch( / authorize→CRON_SECRET / authorize→requireRoles('direccion', 'admin') | n/a (sin body) | 2 |  |
| `/api/cron/dirigentes-activos` | GET | secreto — authorize→secretsMatch( / authorize→CRON_SECRET / authorize→requireRoles('direccion', 'admin') | n/a (sin body) | 4 |  |
| `/api/cron/evaluation-digest` | POST | secreto — authorize→secretsMatch( / authorize→CRON_SECRET / authorize→requireRoles(...EVALUATION_ROLES) | n/a (sin body) | 0 |  |
| `/api/cron/event-surveys` | POST | secreto — authorize→secretsMatch( / authorize→CRON_SECRET / authorize→requireRoles('direccion', 'encargado_sta | n/a (sin body) | 1 |  |
| `/api/cron/folleto-blocks` | POST | secreto — authorize→secretsMatch( / authorize→CRON_SECRET / authorize→requireRoles('coordinador_estudios', 'di | n/a (sin body) | 0 |  |
| `/api/cron/group-enrollment-windows` | POST | secreto — authorize→secretsMatch( / authorize→CRON_SECRET / authorize→requireRoles('coordinador_estudios', 'di | n/a (sin body) | 2 |  |
| `/api/cron/matriculas-a-medias` | POST | secreto — authorize→secretsMatch( / authorize→CRON_SECRET / authorize→requireRoles('direccion', 'admin') | n/a (sin body) | 0 |  |
| `/api/cron/payment-holds-expire` | POST | secreto — authorize→secretsMatch( / authorize→CRON_SECRET / authorize→requireRoles('direccion', 'admin') | n/a (sin body) | 0 |  |
| `/api/cron/payment-reminders` | POST | secreto — authorize→secretsMatch( / authorize→CRON_SECRET / authorize→requireRoles('direccion', 'finanzas', 'a | n/a (sin body) | 1 |  |
| `/api/cron/report-snapshots` | GET | secreto — authorize→secretsMatch( / authorize→CRON_SECRET / authorize→requireRoles('direccion', 'admin') | n/a (sin body) | 0 |  |
| `/api/cron/scheduled-broadcasts` | POST | secreto — authorize→secretsMatch( / authorize→CRON_SECRET / authorize→requireRoles('comunicaciones', 'direccio | n/a (sin body) | 1 |  |
| `/api/cron/storage-orphans` | POST | secreto — authorize→secretsMatch( / authorize→CRON_SECRET / authorize→requireRoles('direccion', 'admin') | n/a (sin body) | 0 |  |
| `/api/cron/study-requests-expire` | POST | secreto — authorize→secretsMatch( / authorize→CRON_SECRET / authorize→requireRoles('coordinador_estudios', 'co | n/a (sin body) | 3 |  |
| `/api/cron/study-requests-wake` | POST | secreto — authorize→secretsMatch( / authorize→CRON_SECRET / authorize→requireRoles('coordinador_estudios', 'co | n/a (sin body) | 5 |  |
| `/api/cron/study-surveys` | POST | secreto — authorize→secretsMatch( / authorize→CRON_SECRET / authorize→requireRoles('coordinador_estudios', 'co | n/a (sin body) | 1 |  |
| `/api/dashboard/activity` | GET | roles — requireRoles(...DASHBOARD_ROLES) | n/a (sin body) | 0 |  |
| `/api/dashboard` | GET | roles — requireRoles(...DASHBOARD_ROLES) | n/a (sin body) | 0 |  |
| `/api/email/resubscribe` | GET | publico | n/a (sin body) | 2 |  |
| `/api/email/sns-webhook` | POST | firma — verifySignature / verifySignature→verifySignature | zod | 0 |  |
| `/api/email/unsubscribe` | GET | publico | n/a (sin body) | 1 |  |
| `/api/employees/[id]/documents` | POST | roles — requireRoles('direccion', 'encargado_staff') | a mano (formData) | 0 |  |
| `/api/employees/[id]` | PUT | roles — requireRoles('direccion', 'encargado_staff') | zod | 0 |  |
| `/api/employees/[id]/salary` | POST | roles — requireRoles('direccion', 'encargado_staff') | a mano | 0 |  |
| `/api/employees/[id]/vacations` | POST | roles — requireRoles('direccion', 'encargado_staff') | a mano | 0 |  |
| `/api/employees/documents/[id]/download` | GET | modulo — requireModuleView('empleados') | n/a (sin body) | 0 |  |
| `/api/employees/documents/[id]` | DELETE | roles — requireRoles('direccion', 'encargado_staff') | n/a (sin body) | 0 |  |
| `/api/employees/positions/[id]` | PUT | roles — requireRoles('direccion', 'encargado_staff') | zod | 0 |  |
| `/api/employees/positions/[id]` | DELETE | roles — requireRoles('direccion', 'encargado_staff') | n/a (sin body) | 0 |  |
| `/api/employees/positions` | GET | modulo — requireModuleView('empleados') | n/a (sin body) | 0 |  |
| `/api/employees/positions` | POST | roles — requireRoles('direccion', 'encargado_staff') | zod | 0 |  |
| `/api/employees` | GET | modulo — requireModuleView('empleados') | n/a (sin body) | 0 |  |
| `/api/employees` | POST | roles — requireRoles('direccion', 'encargado_staff') | zod | 0 |  |
| `/api/employees/vacations/[id]` | PUT | roles — requireRoles('direccion', 'encargado_staff') | a mano | 0 |  |
| `/api/evaluations/tickets/[id]/participants` | GET | roles — requireRoles(...EVALUATION_ROLES) | n/a (sin body) | 0 |  |
| `/api/evaluations/tickets/[id]` | PATCH | roles — requireRoles(...EVALUATION_ROLES) | zod | 0 |  |
| `/api/evaluations/tickets/assignees` | GET | roles — requireRoles(...EVALUATION_ROLES) | n/a (sin body) | 0 |  |
| `/api/evaluations/tickets` | GET | roles — requireRoles(...EVALUATION_ROLES) | n/a (sin body) | 0 |  |
| `/api/event-registrations/[id]/comprobante` | POST | sesion — requireRoles() / rateLimit( | a mano (formData) | 1 |  |
| `/api/eventos/elegibilidad` | GET | modulo — requireRoles() / requireModuleView('eventos', { beyondOwn: true }) | n/a (sin body) | 1 |  |
| `/api/events/[id]/attendees/export` | GET | modulo — requireEventAccess( | n/a (sin body) | 1 |  |
| `/api/events/[id]/checkins/contact-info` | POST | modulo — requireEventAccess( | zod | 2 |  |
| `/api/events/[id]/checkins` | GET | modulo — requireEventAccess( | n/a (sin body) | 0 |  |
| `/api/events/[id]/checkins` | POST | modulo — requireEventAccess( | a mano | 0 |  |
| `/api/events/[id]/checkins` | DELETE | modulo — requireEventAccess( | n/a (sin body) | 0 |  |
| `/api/events/[id]/duplicate` | POST | roles — requireRoles(...EVENT_WRITE_ROLES) | n/a (sin body) | 0 |  |
| `/api/events/[id]/families` | POST | modulo — requireEventAccess( | zod | 2 |  |
| `/api/events/[id]/managers` | GET | roles — requireRoles(...EVENT_ADMIN_ROLES) | n/a (sin body) | 0 |  |
| `/api/events/[id]/managers` | POST | roles — requireRoles(...EVENT_ADMIN_ROLES) | zod | 0 |  |
| `/api/events/[id]/managers` | DELETE | roles — requireRoles(...EVENT_ADMIN_ROLES) | n/a (sin body) | 0 |  |
| `/api/events/[id]/members/[memberId]` | PATCH | modulo — requireEventAccess( | a mano | 1 |  |
| `/api/events/[id]/members` | POST | modulo — requireEventAccess( | zod | 1 |  |
| `/api/events/[id]/onsite-charge` | POST | modulo — requireEventAccess( | zod | 0 |  |
| `/api/events/[id]/register` | POST | sesion — requireRoles() / rateLimit( | a mano (formData) | 1 |  |
| `/api/events/[id]/registrations/[memberId]` | PATCH | modulo — requireEventAccess( | a mano | 0 |  |
| `/api/events/[id]/registrations/[memberId]` | DELETE | modulo — requireEventAccess( | n/a (sin body) | 0 |  |
| `/api/events/[id]/registrations` | GET | modulo — requireEventAccess( | n/a (sin body) | 0 |  |
| `/api/events/[id]/registrations` | POST | modulo — requireEventAccess( | a mano | 0 |  |
| `/api/events/[id]` | GET | sesion — requireRoles() | n/a (sin body) | 0 |  |
| `/api/events/[id]` | PUT | modulo — requireEventAccess( | a mano | 1 |  |
| `/api/events/[id]` | PATCH | roles — requireRoles('direccion') | a mano | 0 |  |
| `/api/events/[id]` | DELETE | roles — requireRoles(...EVENT_DELETE_ROLES) | a mano | 0 |  |
| `/api/events/[id]/server-check` | GET | modulo — requireEventAccess( | n/a (sin body) | 0 |  |
| `/api/events/[id]/volunteers/[memberId]` | DELETE | modulo — requireEventAccess( | n/a (sin body) | 0 |  |
| `/api/events/[id]/volunteers` | POST | modulo — requireEventAccess( | a mano | 0 |  |
| `/api/events/a-mi-cargo` | GET | sesion — requireRoles() | n/a (sin body) | 2 |  |
| `/api/events/mi-alcance` | GET | sesion — requireRoles() | n/a (sin body) | 0 |  |
| `/api/events` | GET | modulo — requireModuleView('eventos') | n/a (sin body) | 0 |  |
| `/api/events` | POST | roles — requireRoles(...EVENT_WRITE_ROLES) | a mano | 0 |  |
| `/api/events/types/[typeId]` | PATCH | roles — requireRoles(...EVENT_WRITE_ROLES) | a mano | 0 |  |
| `/api/events/types` | GET | sesion — requireRoles() | n/a (sin body) | 0 |  |
| `/api/events/types` | POST | roles — requireRoles(...EVENT_WRITE_ROLES) | a mano | 0 |  |
| `/api/events/upload-flyer` | POST | roles — requireRoles(...EVENT_WRITE_ROLES) | a mano (formData) | 0 |  |
| `/api/families` | POST | roles — requireRoles('editor_perfiles', 'direccion', 'encargado_staf | a mano | 0 |  |
| `/api/finance/creditos/reclasificaciones` | GET | roles — requireRoles('finanzas', 'direccion') | n/a (sin body) | 0 |  |
| `/api/finance/creditos` | GET | roles — requireRoles(...ROLES) | n/a (sin body) | 0 |  |
| `/api/finance/creditos` | POST | roles — requireRoles(...ROLES) | zod | 0 |  |
| `/api/finance/credits` | GET | modulo — requireModuleView('finanzas') | n/a (sin body) | 5 |  |
| `/api/finance/donaciones/reporte` | GET | roles — requireRoles(...ROLES) | n/a (sin body) | 0 |  |
| `/api/finance/donations/[id]` | PATCH | roles — requireRoles('finanzas', 'direccion') | a mano | 0 |  |
| `/api/finance/donations/import` | POST | roles — requireRoles('finanzas', 'direccion') | zod | 0 |  |
| `/api/finance/donations/preview` | POST | roles — requireRoles('finanzas', 'direccion') | zod | 0 |  |
| `/api/finance/donations` | GET | modulo — requireModuleView('finanzas') | n/a (sin body) | 0 |  |
| `/api/finance/donations` | POST | roles — requireRoles('finanzas', 'direccion') | a mano | 0 |  |
| `/api/finance/import-batches` | GET | modulo — requireModuleView('finanzas') | n/a (sin body) | 0 |  |
| `/api/finance/orphan-charges` | GET | roles — requireRoles('admin', 'finanzas', 'direccion') | n/a (sin body) | 0 |  |
| `/api/finance/payments/[id]` | PUT | roles — requireRoles('finanzas', 'direccion') | zod | 0 |  |
| `/api/finance/payments/export` | GET | modulo — requireModuleView(['finanzas', 'revision_pagos']) | n/a (sin body) | 0 |  |
| `/api/finance/payments` | GET | modulo — requireModuleView(['finanzas', 'revision_pagos']) | n/a (sin body) | 0 |  |
| `/api/finance/payments` | POST | roles — requireRoles('finanzas', 'direccion') | zod | 0 |  |
| `/api/finance/refunds/[id]/comments` | GET | sesion — requireRoles() | n/a (sin body) | 0 |  |
| `/api/finance/refunds/[id]/comments` | POST | sesion — requireRoles() | zod | 0 |  |
| `/api/finance/refunds/[id]/convert-to-donation` | POST | roles — requireRoles('finanzas', 'direccion') | zod | 1 |  |
| `/api/finance/refunds/[id]` | PUT | roles — requireRoles('finanzas', 'direccion') | a mano | 0 |  |
| `/api/finance/refunds` | GET | sesion — requireRoles() | n/a (sin body) | 0 |  |
| `/api/finance/refunds` | POST | roles — requireRoles('finanzas', 'direccion') | a mano | 0 |  |
| `/api/finance/requests/[id]/group` | PATCH | sesion — requireRoles() | zod | 0 |  |
| `/api/finance/requests/[id]` | PATCH | roles — requireRoles(...ROLES_QUE_OFRECEN_ARREGLO) | zod | 1 |  |
| `/api/finance/requests/assignees` | GET | roles — requireRoles('finanzas') | n/a (sin body) | 0 |  |
| `/api/finance/requests/payment-options` | GET | sesion — requireRoles() | n/a (sin body) | 0 |  |
| `/api/finance/requests` | GET | modulo — requireRoles() / requireModuleView('finanzas') / requireModuleView('becas') | n/a (sin body) | 0 |  |
| `/api/finance/requests` | POST | sesion — requireRoles() | a mano | 0 |  |
| `/api/finance/scholarships` | GET | modulo — requireModuleView('finanzas') | n/a (sin body) | 0 |  |
| `/api/forms/[id]/access` | GET | modulo — requireFormEdit( | n/a (sin body) | 0 |  |
| `/api/forms/[id]/access` | POST | modulo — requireFormEdit( | zod | 0 |  |
| `/api/forms/[id]/access` | DELETE | modulo — requireFormEdit( | n/a (sin body) | 0 |  |
| `/api/forms/[id]/members/[memberId]` | GET | roles — requireRoles(...FORM_ON_BEHALF_ROLES) | n/a (sin body) | 2 |  |
| `/api/forms/[id]/responses/export` | GET | sesion — getAuthContext() | n/a (sin body) | 1 |  |
| `/api/forms/[id]/responses` | GET | sesion — requireRoles() / getAuthContext() | n/a (sin body) | 1 |  |
| `/api/forms/[id]/responses` | POST | sesion — requireRoles() / rateLimit( | a mano | 3 |  |
| `/api/forms/[id]` | GET | sesion — requireRoles() | n/a (sin body) | 0 |  |
| `/api/forms/[id]` | PUT | modulo — requireFormEdit( | a mano | 0 |  |
| `/api/forms/[id]` | DELETE | roles — requireRoles(...FORM_DELETE_ROLES) | n/a (sin body) | 0 |  |
| `/api/forms/[id]/selection` | GET | roles — requireRoles(...SELECTION_REVIEW_ROLES) | n/a (sin body) | 0 |  |
| `/api/forms/[id]/selection` | PATCH | roles — requireRoles(...SELECTION_REVIEW_ROLES) | zod | 0 |  |
| `/api/forms/[id]/selection` | POST | roles — requireRoles(...SELECTION_REVIEW_ROLES) | zod | 0 |  |
| `/api/forms/attachment` | GET | sesion — requireRoles() | n/a (sin body) | 0 |  |
| `/api/forms` | GET | sesion — getAuthContext() | n/a (sin body) | 0 |  |
| `/api/forms` | POST | modulo — requireModuleView('formularios', { action: 'create' }) | a mano | 0 |  |
| `/api/forms/upload-attachment` | POST | sesion — requireRoles() | a mano (formData) | 0 |  |
| `/api/forms/upload-hero` | POST | modulo — requireModuleView('formularios', { action: 'edit' }) | a mano (formData) | 0 |  |
| `/api/matricula/eligibility` | GET | modulo — requireRoles() / requireModuleView('estudios', { beyondOwn: true }) / requireModuleView('miembros', { beyondOwn: true }) | n/a (sin body) | 0 |  |
| `/api/member-lists/[id]/refresh` | POST | roles — requireRoles('comunicaciones', 'direccion', 'editor_perfiles | n/a (sin body) | 0 |  |
| `/api/member-lists/[id]` | GET | sesion — requireRoles() | n/a (sin body) | 0 |  |
| `/api/member-lists/[id]` | PATCH | roles — requireRoles('comunicaciones', 'direccion', 'editor_perfiles | a mano | 0 |  |
| `/api/member-lists/[id]` | DELETE | roles — requireRoles('comunicaciones', 'direccion', 'editor_perfiles | n/a (sin body) | 0 |  |
| `/api/member-lists` | GET | modulo — requireModuleView('miembros', { beyondOwn: true }) / requireModuleView('comunicaciones') | n/a (sin body) | 0 |  |
| `/api/member-lists` | POST | roles — requireRoles('comunicaciones', 'direccion', 'editor_perfiles | a mano | 0 |  |
| `/api/members/[id]/access-email` | PATCH | roles — requireRoles(...ACCESS_EMAIL_ROLES) | zod | 6 |  |
| `/api/members/[id]/access-link` | POST | roles — requireRoles(...ACCESS_EMAIL_ROLES) | n/a (sin body) | 1 |  |
| `/api/members/[id]/account-status` | GET | roles — requireRoles(...STUDY_ADMIN_ROLES) | n/a (sin body) | 1 |  |
| `/api/members/[id]/admin-data` | GET | sesion — requireRoles() | n/a (sin body) | 1 |  |
| `/api/members/[id]/admin-data` | PUT | sesion — requireRoles() | a mano | 1 |  |
| `/api/members/[id]/create-account` | POST | roles — requireRoles(...STUDY_ADMIN_ROLES) | n/a (sin body) | 1 |  |
| `/api/members/[id]/deactivate` | POST | roles — requireRoles('comunicaciones') | a mano | 0 |  |
| `/api/members/[id]/email-status` | GET | sesion — requireRoles() | n/a (sin body) | 1 |  |
| `/api/members/[id]/email-status` | POST | roles — requireRoles('comunicaciones', 'direccion') | a mano | 1 |  |
| `/api/members/[id]/family` | GET | modulo — requireRoles() / requireModuleView('miembros', { beyondOwn: true }) / requireModuleView('eventos', { action: 'edit' }) | n/a (sin body) | 0 |  |
| `/api/members/[id]/family` | POST | roles — requireRoles(...FAMILY_EDIT_ROLES) | a mano | 0 |  |
| `/api/members/[id]/family` | PATCH | roles — requireRoles(...FAMILY_EDIT_ROLES) | a mano | 0 |  |
| `/api/members/[id]/family` | DELETE | roles — requireRoles(...FAMILY_EDIT_ROLES) | a mano | 0 |  |
| `/api/members/[id]/merge` | POST | roles — requireRoles('admin', 'editor_perfiles') | a mano | 0 |  |
| `/api/members/[id]/password-reset` | POST | roles — requireRoles(...STUDY_ADMIN_ROLES) | n/a (sin body) | 2 |  |
| `/api/members/[id]/payments` | GET | sesion — requireRoles() | n/a (sin body) | 0 |  |
| `/api/members/[id]/recommendations` | GET | roles — requireRoles('coordinador_estudios', 'coordinador_dirigentes | n/a (sin body) | 0 |  |
| `/api/members/[id]/resend-activation` | POST | roles — requireRoles(...STUDY_ADMIN_ROLES, 'soporte_tecnico') | n/a (sin body) | 2 |  |
| `/api/members/[id]` | GET | modulo — requireRoles() / requireModuleView('miembros', { beyondOwn: true }) / requireRoles() / handleUpdate→requireRoles() | a mano | 2 |  |
| `/api/members/[id]/scholarships` | GET | sesion — requireRoles() | n/a (sin body) | 0 |  |
| `/api/members/[id]/spiritual` | GET | sesion — requireRoles() | n/a (sin body) | 1 |  |
| `/api/members/[id]/spiritual` | PUT | sesion — requireRoles() | a mano | 1 |  |
| `/api/members/[id]/studies` | GET | roles — requireRoles(...EXTERNAL_STUDY_ROLES) | n/a (sin body) | 0 |  |
| `/api/members/[id]/studies` | POST | roles — requireRoles(...EXTERNAL_STUDY_ROLES) | zod | 0 |  |
| `/api/members/by-ids` | POST | roles — requireRoles('editor_perfiles', 'direccion', 'encargado_staf | a mano | 0 |  |
| `/api/members/counts` | GET | modulo — requireModuleView('miembros', { beyondOwn: true }) | n/a (sin body) | 0 |  |
| `/api/members/duplicates` | GET | roles — requireRoles('admin', 'editor_perfiles') | n/a (sin body) | 0 |  |
| `/api/members/duplicates` | POST | roles — requireRoles('admin', 'editor_perfiles') | a mano | 0 |  |
| `/api/members/event-options` | GET | modulo — requireModuleView('miembros', { beyondOwn: true }) | n/a (sin body) | 1 |  |
| `/api/members/export` | GET | modulo — requireModuleView('miembros', { beyondOwn: true }) / rateLimit( | zod | 0 |  |
| `/api/members/ids` | GET | modulo — requireModuleView('miembros', { beyondOwn: true }) | zod | 0 |  |
| `/api/members/lookup` | GET | sesion — getAuthContext() | n/a (sin body) | 0 |  |
| `/api/members/notice-dismissals` | POST | sesion — requireRoles() | zod | 1 |  |
| `/api/members` | GET | modulo — requireModuleView('miembros', { beyondOwn: true }) | zod | 0 |  |
| `/api/members` | POST | roles — requireRoles('editor_perfiles', 'direccion', 'encargado_staf | a mano | 0 |  |
| `/api/notifications/internal/[id]` | PATCH | sesion — requireRoles() | n/a (sin body) | 0 |  |
| `/api/notifications/internal/[id]` | DELETE | sesion — requireRoles() | n/a (sin body) | 0 |  |
| `/api/notifications/internal/delete` | POST | sesion — requireRoles() | a mano | 0 |  |
| `/api/notifications/internal/read-all` | POST | sesion — requireRoles() | n/a (sin body) | 0 |  |
| `/api/notifications/internal/read` | POST | sesion — requireRoles() | a mano | 0 |  |
| `/api/notifications/internal` | GET | sesion — requireRoles() | n/a (sin body) | 0 |  |
| `/api/notifications/leader-absence-check` | POST | secreto — authorize→secretsMatch( / authorize→CRON_SECRET / authorize→requireRoles('coordinador_dirigentes', ' | n/a (sin body) | 0 |  |
| `/api/notifications/preferences` | GET | sesion — requireRoles() | n/a (sin body) | 2 |  |
| `/api/notifications/preferences` | PUT | sesion — requireRoles() | a mano | 3 |  |
| `/api/org` | GET | sesion — requireRoles() | n/a (sin body) | 0 |  |
| `/api/payment-plans/[id]` | PATCH | roles — requireRoles(...PLAN_ROLES) | zod | 0 |  |
| `/api/payments/[id]/apply-scholarship` | POST | modulo — requireModuleView(['becas', 'revision_pagos'], { action: 'ed | zod | 0 |  |
| `/api/payments/[id]/payment-plan/enable` | POST | roles — requireRoles(...PLAN_ROLES) | zod | 0 |  |
| `/api/payments/[id]/payment-plan` | GET | roles — requireRoles(...PLAN_ROLES) | n/a (sin body) | 0 |  |
| `/api/payments/[id]/payment-plan` | POST | sesion — requireRoles() | zod | 0 |  |
| `/api/payments/[id]/receipt` | GET | sesion — requireRoles() | n/a (sin body) | 0 |  |
| `/api/payments/[id]/remind` | POST | modulo — requireModuleView('revision_pagos', { action: 'edit' }) | n/a (sin body) | 1 |  |
| `/api/payments/[id]/review` | POST | modulo — requireModuleView('revision_pagos', { action: 'edit' }) | zod | 1 |  |
| `/api/payments/[id]/scholarship-options` | GET | modulo — requireModuleView(['becas', 'revision_pagos'], { action: 'ed | n/a (sin body) | 0 |  |
| `/api/payments/bulk` | POST | modulo — requireModuleView('revision_pagos', { action: 'edit' }) | a mano | 0 |  |
| `/api/payments/queue/options` | GET | modulo — requireModuleView('revision_pagos') | n/a (sin body) | 2 |  |
| `/api/payments/queue` | GET | modulo — requireModuleView('revision_pagos') | n/a (sin body) | 0 |  |
| `/api/payments/receipts` | POST | sesion — requireRoles() / rateLimit( | zod | 2 |  |
| `/api/payments` | POST | modulo — requireModuleView('estudios') / rateLimit( | a mano (formData) | 0 |  |
| `/api/public/events.ics` | GET | publico — rateLimit( | n/a (sin body) | 0 |  |
| `/api/public/events/[id]` | GET | publico — rateLimit( | n/a (sin body) | 2 |  |
| `/api/public/events` | GET | publico — rateLimit( | n/a (sin body) | 0 |  |
| `/api/public/forms/[id]/responder` | POST | publico — rateLimit( | a mano | 4 |  |
| `/api/public/forms/[id]` | GET | publico | n/a (sin body) | 2 |  |
| `/api/public/forms/[id]/upload-attachment` | POST | publico — rateLimit( | a mano (formData) | 1 |  |
| `/api/public/study-groups` | GET | publico — rateLimit( | n/a (sin body) | 0 |  |
| `/api/public/vacancies` | GET | publico — rateLimit( | n/a (sin body) | 0 |  |
| `/api/reports/charla-attendance` | GET | modulo — requireAccesoAReporte( | n/a (sin body) | 0 |  |
| `/api/reports/demografia` | GET | modulo — requireAccesoAReporte( | n/a (sin body) | 0 |  |
| `/api/reports/discipulos` | GET | modulo — requireAccesoAReporte( | n/a (sin body) | 0 |  |
| `/api/reports/estudios` | GET | modulo — requireAccesoAReporte( | n/a (sin body) | 0 |  |
| `/api/reports/exalumnos-perdidos/contacto` | POST | sesion — requireRoles() | zod | 0 |  |
| `/api/reports/exalumnos-perdidos/contacto` | GET | sesion — requireRoles() | n/a (sin body) | 0 |  |
| `/api/reports/exalumnos-perdidos` | GET | modulo — requireAccesoAReporte( | n/a (sin body) | 0 |  |
| `/api/reports/leaders/export` | GET | modulo — requireAccesoAReporte( | n/a (sin body) | 0 |  |
| `/api/reports/leaders/jerarquia` | GET | modulo — requireAccesoAReporte( | n/a (sin body) | 0 |  |
| `/api/reports/leaders` | GET | modulo — requireAccesoAReporte( | n/a (sin body) | 0 |  |
| `/api/reports/member-growth` | GET | modulo — requireAccesoAReporte( | n/a (sin body) | 0 |  |
| `/api/reports/personas-nuevas` | GET | modulo — requireAccesoAReporte( | n/a (sin body) | 0 |  |
| `/api/reports/recurrentes-perdidos` | GET | modulo — requireAccesoAReporte( | n/a (sin body) | 0 |  |
| `/api/reports/retencion` | GET | modulo — requireAccesoAReporte( | n/a (sin body) | 0 |  |
| `/api/reports/semana-asistentes` | GET | modulo — requireAccesoAReporte( | n/a (sin body) | 0 |  |
| `/api/reports/servidores` | GET | modulo — requireAccesoAReporte( | n/a (sin body) | 2 |  |
| `/api/scholarships/[id]` | GET | modulo — requireModuleView('becas') | n/a (sin body) | 2 |  |
| `/api/scholarships/[id]` | PATCH | modulo — requireModuleView('becas', { action: 'edit' }) | zod | 0 |  |
| `/api/scholarships/[id]/send-email` | POST | modulo — requireModuleView(['becas', 'finanzas'], { action: 'edit' }) | zod | 0 |  |
| `/api/scholarships/applicable` | GET | modulo — requireRoles() / requireModuleView('becas', { beyondOwn: true }) | n/a (sin body) | 0 |  |
| `/api/scholarships/coupons` | GET | modulo — requireModuleView('becas') | n/a (sin body) | 0 |  |
| `/api/scholarships/coupons` | POST | modulo — requireModuleView('becas', { action: 'edit' }) | zod | 0 |  |
| `/api/scholarships/requests/[id]/review` | POST | modulo — requireModuleView('becas', { action: 'edit' }) | a mano | 0 |  |
| `/api/sedes` | GET | sesion — requireRoles() | n/a (sin body) | 0 |  |
| `/api/sedes` | POST | roles — requireRoles(...STUDY_ADMIN_ROLES) | a mano | 0 |  |
| `/api/servers/applications/[id]/detalle` | GET | roles — requireRoles(...SERVICE_APPLICATIONS_ROLES) | n/a (sin body) | 0 |  |
| `/api/servers/applications/[id]` | PUT | roles — requireRoles(...GESTIONAN_APLICACIONES) | zod | 1 |  |
| `/api/servers/applications/bulk` | POST | roles — requireRoles('encargado_staff', 'coordinador_servidores', 'd | a mano | 0 |  |
| `/api/servers/applications` | GET | roles — requireRoles(...SERVICE_APPLICATIONS_ROLES) | n/a (sin body) | 0 |  |
| `/api/servers/applications` | POST | roles — requireRoles('encargado_staff', 'direccion', 'lider_comite') | a mano | 0 |  |
| `/api/servers/areas/[id]/director` | PUT | roles — requireRoles(...SERVICE_ADMIN_ROLES) | zod | 0 |  |
| `/api/servers/areas/[id]` | PUT | roles — requireRoles(...SERVICE_ADMIN_ROLES) | zod | 0 |  |
| `/api/servers/areas/[id]` | DELETE | roles — requireRoles(...SERVICE_ADMIN_ROLES) | n/a (sin body) | 0 |  |
| `/api/servers/areas/[id]/usage` | GET | roles — requireRoles(...SERVICE_ADMIN_ROLES) | n/a (sin body) | 0 |  |
| `/api/servers/areas` | GET | modulo — requireModuleView('servidores') | n/a (sin body) | 0 |  |
| `/api/servers/areas` | POST | roles — requireRoles(...SERVICE_ADMIN_ROLES) | zod | 0 |  |
| `/api/servers/committees/[id]/encargados` | PATCH | roles — requireRoles(...SERVICE_ADMIN_ROLES) | zod | 0 |  |
| `/api/servers/committees/[id]` | PUT | roles — requireRoles('encargado_staff', 'direccion', 'lider_comite') | zod | 0 |  |
| `/api/servers/committees` | GET | modulo — requireModuleView('servidores') | n/a (sin body) | 0 |  |
| `/api/servers/goals/[id]` | PUT | roles — requireRoles('encargado_staff', 'direccion', 'lider_comite') | a mano | 0 |  |
| `/api/servers/goals/[id]` | DELETE | roles — requireRoles('encargado_staff', 'direccion', 'lider_comite') | n/a (sin body) | 0 |  |
| `/api/servers/goals` | GET | modulo — requireModuleView('servidores') | n/a (sin body) | 0 |  |
| `/api/servers/goals` | POST | roles — requireRoles('encargado_staff', 'direccion', 'lider_comite') | a mano | 0 |  |
| `/api/servers/manageable-committees` | GET | sesion — requireRoles() | n/a (sin body) | 0 |  |
| `/api/servers/mi-comite` | GET | sesion — requireRoles() | n/a (sin body) | 0 |  |
| `/api/servers/position-requests/[id]` | PATCH | roles — requireRoles(...SERVICE_ADMIN_ROLES) | a mano | 0 |  |
| `/api/servers/position-requests` | GET | roles — requireRoles(...SERVICE_ADMIN_ROLES) | n/a (sin body) | 0 |  |
| `/api/servers/position-requests` | POST | sesion — requireRoles() | zod | 3 |  |
| `/api/servers/positions/[id]` | PUT | roles — requireRoles(...SERVICE_ADMIN_ROLES) | zod | 0 |  |
| `/api/servers/positions/[id]` | DELETE | roles — requireRoles(...SERVICE_ADMIN_ROLES) | n/a (sin body) | 0 |  |
| `/api/servers/positions/[id]/usage` | GET | roles — requireRoles(...SERVICE_ADMIN_ROLES) | n/a (sin body) | 0 |  |
| `/api/servers/positions` | GET | modulo — requireModuleView('servidores') | n/a (sin body) | 0 |  |
| `/api/servers/positions` | POST | roles — requireRoles(...SERVICE_ADMIN_ROLES) | zod | 3 |  |
| `/api/servers/structure-export` | GET | roles — requireRoles(...SERVICE_ADMIN_ROLES) | n/a (sin body) | 0 |  |
| `/api/servers/vacancies/[id]/apply` | POST | sesion — requireRoles() | a mano | 2 |  |
| `/api/servers/vacancies/[id]` | PUT | sesion — requireRoles() | zod | 0 |  |
| `/api/servers/vacancies/[id]` | DELETE | sesion — requireRoles() | n/a (sin body) | 0 |  |
| `/api/servers/vacancies/export-applicants` | POST | roles — requireRoles(...SERVICE_ADMIN_ROLES) | a mano | 0 |  |
| `/api/servers/vacancies/publish` | POST | roles — requireRoles(...PUBLICAN_PUESTOS) | n/a (sin body) | 0 |  |
| `/api/servers/vacancies/request` | POST | sesion — requireRoles() | a mano | 2 |  |
| `/api/servers/vacancies/requests/[id]` | PATCH | roles — requireRoles(...SERVICE_ADMIN_ROLES) | zod | 0 |  |
| `/api/servers/vacancies/requests` | GET | sesion — requireRoles() | n/a (sin body) | 0 |  |
| `/api/servers/vacancies` | GET | modulo — requireRoles() / requireModuleView('servidores') | n/a (sin body) | 0 |  |
| `/api/servers/vacancies` | POST | sesion — requireRoles() | zod | 0 |  |
| `/api/servers/volunteers` | POST | roles — requireRoles('encargado_staff', 'direccion', 'lider_comite') | a mano | 0 |  |
| `/api/servers/volunteers` | DELETE | roles — requireRoles('encargado_staff', 'direccion', 'lider_comite') | a mano | 0 |  |
| `/api/studies/analysis` | GET | modulo — requireModuleView('estudios', { beyondOwn: true }) | n/a (sin body) | 0 |  |
| `/api/studies/bloques/[id]` | PUT | roles — requireRoles('coordinador_estudios', 'admin') | a mano | 1 |  |
| `/api/studies/bloques/[id]` | DELETE | roles — requireRoles('coordinador_estudios', 'admin') | n/a (sin body) | 1 |  |
| `/api/studies/bloques/[id]/usage` | GET | roles — requireRoles('coordinador_estudios', 'admin') | n/a (sin body) | 1 |  |
| `/api/studies/bloques` | GET | roles — requireRoles('coordinador_estudios', 'admin') | n/a (sin body) | 0 |  |
| `/api/studies/bloques` | POST | roles — requireRoles('coordinador_estudios', 'admin') | a mano | 0 |  |
| `/api/studies/cdeb-recommendations` | GET | sesion — requireRoles() | n/a (sin body) | 0 |  |
| `/api/studies/cdeb-recommendations` | POST | sesion — requireRoles() | zod | 0 |  |
| `/api/studies/cuestionario-nivel-1` | GET | sesion — requireRoles() | n/a (sin body) | 1 |  |
| `/api/studies/cuestionario-nivel-1` | POST | sesion — requireRoles() | a mano | 2 |  |
| `/api/studies/dashboard-stats` | GET | roles — requireRoles(...STUDY_ADMIN_ROLES) | n/a (sin body) | 0 |  |
| `/api/studies/dirigentes/[id]/estado` | PATCH | roles — requireRoles(...DIRIGENTES_ADMIN_ROLES) | zod | 1 |  |
| `/api/studies/dirigentes/[id]` | GET | sesion — requireRoles() | n/a (sin body) | 0 |  |
| `/api/studies/dirigentes/[id]` | PATCH | sesion — requireRoles() | zod | 3 |  |
| `/api/studies/dirigentes/bulk-status` | POST | roles — requireRoles(...DIRIGENTES_ADMIN_ROLES) | a mano | 0 |  |
| `/api/studies/dirigentes/bulk-studies` | POST | roles — requireRoles(...DIRIGENTES_ADMIN_ROLES) | a mano | 0 |  |
| `/api/studies/dirigentes/contact` | POST | roles — requireRoles(...DIRIGENTES_ADMIN_ROLES) | a mano | 0 |  |
| `/api/studies/dirigentes/disponibilidad-actual` | GET | roles — requireRoles(...VIEW_ROLES) | n/a (sin body) | 0 |  |
| `/api/studies/dirigentes/disponibilidad` | GET | roles — requireRoles(...VIEW_ROLES) | n/a (sin body) | 0 |  |
| `/api/studies/dirigentes/formacion-reporte` | POST | sesion — requireRoles() | zod | 3 |  |
| `/api/studies/dirigentes` | GET | sesion — requireRoles() | n/a (sin body) | 0 |  |
| `/api/studies/dirigentes` | POST | roles — requireRoles(...DIRIGENTES_ADMIN_ROLES) | a mano | 0 |  |
| `/api/studies/eligibility` | GET | modulo — requireRoles() / requireModuleView('estudios', { beyondOwn: true }) / requireModuleView('miembros', { beyondOwn: true }) | n/a (sin body) | 0 |  |
| `/api/studies/enrollments/[id]/transfer` | GET | roles — requireRoles(...STUDY_ADMIN_ROLES) | n/a (sin body) | 3 |  |
| `/api/studies/enrollments/[id]/transfer` | PATCH | roles — requireRoles(...STUDY_ADMIN_ROLES) | zod | 2 |  |
| `/api/studies/exceptions/[id]` | DELETE | roles — requireRoles(...STUDY_ADMIN_ROLES) | n/a (sin body) | 0 |  |
| `/api/studies/exceptions` | GET | roles — requireRoles(...STUDY_ADMIN_ROLES) | n/a (sin body) | 0 |  |
| `/api/studies/exceptions` | POST | roles — requireRoles(...STUDY_ADMIN_ROLES) | zod | 0 |  |
| `/api/studies/folletos/[id]` | GET | modulo — requireModuleView('folletos') | n/a (sin body) | 0 |  |
| `/api/studies/folletos/[id]` | PATCH | modulo — requireModuleView('folletos', { action: 'edit' }) | a mano | 1 |  |
| `/api/studies/folletos/bulk` | POST | modulo — requireModuleView('folletos', { action: 'edit' }) | a mano | 0 |  |
| `/api/studies/folletos/manual` | POST | roles — requireRoles('folletos', 'admin', 'coordinador_estudios', 'c | a mano | 0 |  |
| `/api/studies/folletos` | GET | modulo — requireModuleView('folletos') | n/a (sin body) | 0 |  |
| `/api/studies/groups/[id]/attendance` | POST | sesion — requireRoles() | a mano | 0 |  |
| `/api/studies/groups/[id]/close-detail` | GET | sesion — requireRoles() | n/a (sin body) | 1 |  |
| `/api/studies/groups/[id]/close` | POST | sesion — requireRoles() | a mano | 4 |  |
| `/api/studies/groups/[id]/enrollments` | POST | sesion — requireRoles() | a mano | 1 |  |
| `/api/studies/groups/[id]/enrollments` | PATCH | roles — requireRoles('coordinador_estudios', 'coordinador_dirigentes | a mano | 2 |  |
| `/api/studies/groups/[id]/enrollments` | DELETE | sesion — requireRoles() | a mano | 0 |  |
| `/api/studies/groups/[id]/folletos` | POST | roles — requireRoles('coordinador_estudios', 'folletos', 'direccion' | n/a (sin body) | 1 |  |
| `/api/studies/groups/[id]/leader-feedback` | GET | sesion — requireRoles() | n/a (sin body) | 0 |  |
| `/api/studies/groups/[id]/leader-feedback` | POST | sesion — requireRoles() | zod | 0 |  |
| `/api/studies/groups/[id]/leader-feedback` | PATCH | roles — requireRoles(...EVALUATION_ROLES) | zod | 1 |  |
| `/api/studies/groups/[id]/leader-sede` | GET | roles — requireRoles('coordinador_estudios', 'coordinador_dirigentes | n/a (sin body) | 0 |  |
| `/api/studies/groups/[id]/premat-pairs` | GET | sesion — requireRoles() | n/a (sin body) | 1 |  |
| `/api/studies/groups/[id]/restriction` | GET | roles — requireRoles(...GROUP_ADMIN_ROLES) | n/a (sin body) | 0 |  |
| `/api/studies/groups/[id]` | GET | sesion — requireRoles() | n/a (sin body) | 0 |  |
| `/api/studies/groups/[id]` | PUT | roles — requireRoles(...GROUP_ADMIN_ROLES) | zod | 0 |  |
| `/api/studies/groups/[id]` | DELETE | roles — requireRoles(...GROUP_ADMIN_ROLES) | n/a (sin body) | 0 |  |
| `/api/studies/groups/[id]/sessions/[sessionId]` | PATCH | sesion — puertaDeEntrada→requireRoles() | zod | 0 |  |
| `/api/studies/groups/[id]/sessions/[sessionId]` | DELETE | sesion — puertaDeEntrada→requireRoles() | n/a (sin body) | 0 |  |
| `/api/studies/groups/[id]/sessions` | GET | sesion — requireRoles() | n/a (sin body) | 0 |  |
| `/api/studies/groups/import-template` | GET | roles — requireRoles(...STUDY_ADMIN_ROLES) | n/a (sin body) | 2 |  |
| `/api/studies/groups/import` | POST | roles — requireRoles(...STUDY_ADMIN_ROLES) | a mano | 0 |  |
| `/api/studies/groups/participantes` | GET | roles — requireRoles(...GROUP_ADMIN_ROLES) | zod | 0 |  |
| `/api/studies/groups/restriction-count` | POST | roles — requireRoles(...GROUP_ADMIN_ROLES) | a mano | 0 |  |
| `/api/studies/groups` | GET | roles — requireRoles(...GROUPS_LIST_ROLES) | zod | 0 |  |
| `/api/studies/groups` | POST | roles — requireRoles(...GROUP_ADMIN_ROLES) | zod | 0 |  |
| `/api/studies/invitations` | GET | roles — requireRoles(...STUDY_ADMIN_ROLES) | n/a (sin body) | 0 |  |
| `/api/studies/invitations` | POST | roles — requireRoles(...STUDY_ADMIN_ROLES) | a mano | 0 |  |
| `/api/studies/invitations` | DELETE | roles — requireRoles(...STUDY_ADMIN_ROLES) | n/a (sin body) | 0 |  |
| `/api/studies/leaders/[id]` | PUT | roles — requireRoles(...DIRIGENTES_ADMIN_ROLES) | zod | 0 |  |
| `/api/studies/leaders` | GET | modulo — requireRoles() / requireModuleView('estudios', { beyondOwn: true }) | n/a (sin body) | 0 |  |
| `/api/studies/leaders` | POST | roles — requireRoles(...DIRIGENTES_ADMIN_ROLES) | zod | 0 |  |
| `/api/studies/plans/[id]` | PUT | roles — requireRoles(...STUDY_ADMIN_ROLES) | zod | 0 |  |
| `/api/studies/plans` | GET | sesion — requireRoles() | n/a (sin body) | 0 |  |
| `/api/studies/plans` | POST | roles — requireRoles(...STUDY_ADMIN_ROLES) | zod | 0 |  |
| `/api/studies/prematrimonial/[id]` | PATCH | roles — requireRoles('coordinador_estudios', 'coordinador_dirigentes | a mano | 0 |  |
| `/api/studies/prematrimonial/cierres/[id]` | GET | roles — requireRoles(...PREMAT_EVAL_ROLES) | n/a (sin body) | 0 |  |
| `/api/studies/prematrimonial/cierres` | GET | roles — requireRoles(...PREMAT_EVAL_ROLES) | n/a (sin body) | 0 |  |
| `/api/studies/prematrimonial/enrollee` | GET | roles — requireRoles('admin', 'direccion') | n/a (sin body) | 1 |  |
| `/api/studies/prematrimonial/evaluations` | GET | roles — requireRoles(...PREMAT_EVAL_ROLES) | n/a (sin body) | 0 |  |
| `/api/studies/prematrimonial` | GET | modulo — requireModuleView('estudios', { beyondOwn: true }) | n/a (sin body) | 0 |  |
| `/api/studies/prematrimonial` | POST | sesion — requireRoles() / rateLimit( | zod | 3 |  |
| `/api/studies/prematrimonial/spouse-search` | POST | sesion — requireRoles() | a mano | 1 |  |
| `/api/studies/refund-requests` | GET | roles — requireRoles(...PUEDEN_SOLICITAR_DEVOLUCION) | n/a (sin body) | 1 |  |
| `/api/studies/refund-requests` | POST | roles — requireRoles(...PUEDEN_SOLICITAR_DEVOLUCION) | zod | 3 |  |
| `/api/studies/request-options` | GET | modulo — requireRoles() / requireModuleView('estudios', { beyondOwn: true }) / requireModuleView('miembros', { beyondOwn: true }) | n/a (sin body) | 1 |  |
| `/api/studies/requests/[id]` | PATCH | sesion — requireRoles() | a mano | 4 |  |
| `/api/studies/requests/assignees` | GET | roles — requireRoles(...REQUEST_COORDINATOR_ROLES) | n/a (sin body) | 0 |  |
| `/api/studies/requests` | GET | sesion — requireRoles() | n/a (sin body) | 0 |  |
| `/api/studies/requests` | POST | sesion — requireRoles() | a mano | 0 |  |
| `/api/studies/start-reminders` | POST | secreto — authorize→secretsMatch( / authorize→CRON_SECRET / authorize→requireRoles('coordinador_dirigentes', ' | n/a (sin body) | 0 |  |
| `/api/support-tickets/[id]` | PATCH | roles — requireRoles(...SOPORTE_ROLES) | zod | 0 |  |
| `/api/support-tickets` | GET | roles — requireRoles(...SOPORTE_ROLES) | n/a (sin body) | 0 |  |
| `/api/support-tickets` | POST | sesion — requireRoles() | zod | 0 |  |
| `/api/travel-requests/[id]/receipts` | POST | sesion — requireRoles() / rateLimit( | a mano (formData) | 0 |  |
| `/api/travel-requests/[id]` | GET | sesion — requireRoles() | n/a (sin body) | 0 |  |
| `/api/travel-requests/[id]` | PUT | sesion — requireRoles() | zod | 0 |  |
| `/api/travel-requests/[id]` | PATCH | sesion — requireRoles() | zod | 0 |  |
| `/api/travel-requests` | GET | sesion — requireRoles() | n/a (sin body) | 0 |  |
| `/api/travel-requests` | POST | sesion — requireRoles() | zod | 0 |  |
