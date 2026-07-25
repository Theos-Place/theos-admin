# Plan de desarrollo — cola de pendientes

> Consolidado 2026-07-25 a partir de las auditorías de jun-jul 2026 y el código actual. Lo ya resuelto no aparece (family_unlink_requests, chunking `.in()`, duplicados de merge_members, nonces CSP, RLS baseline — todo cerrado). Marcar con `[x]` al completar.

## Fase 0 — Operativo (sin código, ~1 sesión de configuración)

- [ ] Configurar Healthchecks.io (o similar) y setear las 5 env `HEALTHCHECK_URL_*` en Vercel (incluida `HEALTHCHECK_URL_STORAGE_ORPHANS`, pendiente desde la auditoría BE).
- [ ] Decidir si `report-snapshots` también debe pingear healthcheck (hoy es el único cron sin ping) y agregarlo si sí.
- [ ] Configurar Sentry (`SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN`) en Vercel.
- [ ] Copiar las env de Supabase a los entornos **Preview** en Vercel (hoy solo Production; los deploys de PR fallan).
- [ ] Verificar que la edge function `process-email-queue` de Supabase no esté corriendo en paralelo con los crons de `vercel.json` (duplicaría envíos). Si duplica, apagar una de las dos.
- [ ] Confirmar que el SMTP de Supabase Auth esté configurado en producción (lo requiere la invitación automática de cuentas, `src/lib/auth/invite.ts`).

## Fase 1 — Deuda rápida de código (chica, independiente entre sí)

- [ ] **Unificar `vacancies.status`**: migrar los registros legacy (`draft/published/filled/closed`) al vocabulario nuevo (`creado/enviado_lider/aprobado/denegado`) y eliminar el doble manejo en `/api/servers/vacancies` y `/api/public/vacancies`.
- [ ] **`events.is_public`**: decidir si el calendario embebible debe seguir exponiendo todos los eventos. Si no, agregar flag + filtro en `/api/public/events`.
- [ ] **`employees.position` legacy**: eliminar la columna NOT NULL redundante (se rellena desde el puesto) o documentar que se queda.

## Fase 2 — Features pendientes decididas

- [ ] **Filtros OR en el padrón**: el QueryBar de miembros solo combina condiciones con AND; implementar grupos OR (`queries/members.ts:189`, único TODO real del código).
- [ ] **Conectar `form_asignado`**: la plantilla de email existe pero no tiene disparador; enviarla al asignar un formulario (decisión 2026-07-17: implementar como feature).

## Fase 3 — Refactor de fondo (delicado, planear aparte)

- [ ] **Regla de sede a fuente única**: hoy vive triplicada (TS `sede-attendance.ts`, SQL `refresh_member_sedes`, fixtures de contrato). Evaluar dejar solo la SQL expuesta por RPC y que TS la consuma. Riesgo: cron masivo sobre 22k+ miembros; requiere plan y pruebas propias.

## Fase 4 — Fase mayor planeada

- [ ] **Canal WhatsApp** en comunicaciones (esquema ya modelado: `channel_configs.type`, prefs de miembro; falta todo el envío).

## Tareas de datos (no son desarrollo)

- [ ] Análisis de demanda: montos de QuickBooks pendientes y 1,192 donaciones sin match de miembro.

## Externo

- [ ] Revisión de `/terminos` por un abogado (el texto actual es borrador, marcado en el propio código).

## Aceptado / sin acción

- A18 de la auditoría BE: aceptado tal cual.
- Sin UNIQUE de cédula/correo en BD: aceptado; el dedup es a nivel app (409).
- Sin panel admin de sedes/org: intencional, se manejan por BD.
