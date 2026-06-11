# Auditoría completa — theos-admin

**Fecha:** 2026-06-11 · **Alcance:** 104 archivos `route.ts` (150 handlers), 53 migraciones SQL, ~31 páginas admin, componentes y libs · **Modo:** solo lectura, sin fixes aplicados.

> **Actualización 2026-06-11 (misma fecha, post-informe):** corregidos S1 (export solo coordinadores/admin), S2 (anti-suplantación con 403 explícito en los 3 POST), S3 (donaciones del perfil solo finanzas/dirección/admin), S4 (UUID validado en `c.area`), S6 (edge function con CRON_SECRET + claim atómico en la cola, migración 054) y B8 (comparación timing-safe). Decisión de producto sobre C1: la asistencia de matrícula queda DELIBERADAMENTE separada y más estricta — 12 charlas en los últimos 6 meses (`MATRICULA_MIN_CHARLAS`); deja de ser hallazgo.
>
> **Actualización 2 — SEGURIDAD CERRADA (commit 87207f2):** B5 (mitigado: 'miembro' ya no retiene lectura del padrón), B6 (`ROLES` movido a `src/lib/auth/roles.ts`; `requireModuleView` con acción parametrizable y `beyondOwn`), B7 (`/api/accesos` y gestión de roles SOLO admin — decisión: dirección excluida), S5 + medios de RLS (migración 055 aplicada: SELECT por rol en donaciones/salarios, INSERT de solicitudes solo a nombre propio, sin `WITH CHECK (TRUE)`, RLS en `duplicate_dismissals`), `pageSize` con tope 200, `server-only` en admin.ts. Decisión de producto: el padrón (lista/counts/ids) exige módulo miembros con alcance más allá de 'own'; el perfil y la familia solo si es propio o de un familiar (`canViewMemberProfile`).
>
> **Actualización 3 — bajos de seguridad cerrados (commit c813dfe):** HSTS en producción, `img-src` limitado a Supabase, rate limit en export (5/min/usuario), UUID validado en ids de ruta de members/accesos (`src/lib/validate.ts`), `/calendario` ahora consume `GET /api/public/events` (público por decisión documentada: solo cartelera de eventos activos, sin personas, rate limit por IP), migración 056 (SELECT por rol en `leader_evaluations` y `applications`). **Único pendiente de seguridad:** nonces en CSP (`script-src` mantiene `unsafe-inline`) — implementarlos forzaría render dinámico en todas las páginas; deuda aceptada. El resto del Área 4 queda CERRADO; siguen abiertos los hallazgos de UX/estilos/código (Áreas 1–3) del plan de corto plazo y deuda.
>
> **Actualización 4 — corto plazo de Áreas 1–3 cerrado (commits db5f2ca, 695c12c, 45edfca):** E1/E2 (tokens fuera), U1–U5 (estados de error reales, rollback de optimista, toasts), U7 (toast en fallo de envío; el doble envío ya estaba mitigado por ConfirmModal+overlay), U8 (toasts en vacantes/empleados), C2 (criterio único en getEligibleStudiesForMember, corte de mes en fecha local), C3 (mocks vivos eliminados: AdvancedFilters con formularios reales y posiciones de service_positions vía /api/org; EventServersTab y useMemberFilters sin mock-members), A11y altos (~35 inputs y ~20 botones solo-ícono con aria-label, contrastes puntuales /40→/60, touch targets 40px en FormBuilder). **Decisión de producto:** mientras no se configure Brevo, los broadcasts se entregan como ALERTA INTERNA (canal 'interna', migración 057): notificación en la campana para cada destinatario; email/WhatsApp siguen disponibles pero no son el default. **Queda (deuda planificada):** C4 (tipo Member único + tipos generados), C5 (paginar /api/studies/groups y listados), E4 (MemberCombobox compartido), U6/U9/U10, barrido masivo de contraste /40 heredado, consistencia de filtros/paginación, nonces CSP, paridad /finanzas/solicitudes (requiere decisión), formatDate/initials a lib/format.ts.

Severidades: **Crítico** = exposición real de datos o pérdida de datos · **Alto** = afecta seguridad/UX de forma concreta · **Medio** = deuda que muerde pronto · **Bajo** = pulido.

---

## Tabla resumen

| Área | Crítico | Alto | Medio | Bajo |
|---|---|---|---|---|
| Seguimiento auditoría anterior (pendientes) | — | 4 | 4 | 1 |
| 1. Estilos y consistencia visual | — | 4 | 6 | ~10 |
| 2. UX/UI | — | 14 | 12 | ~15 |
| 3. Código y prácticas | — | 5 | 12 | ~10 |
| 4. Seguridad | 1 | 7 | 11 | 10 |
| **Total** | **1** | **34** | **45** | **~46** |

---

## 0. Seguimiento de auditoría anterior

No existe informe previo en el repo (este es el primero en `docs/`); el seguimiento es contra las auditorías de sesión del 2026-06-10 y 2026-06-11.

### Corregido y verificado (sigue bien)

| Ítem | Evidencia |
|---|---|
| Todos los POST de /api con `requireRoles` | events, employees, members, families, registrations, forms verificados |
| Rate limit en login (20/min IP, 5/min identificador) | `src/app/api/auth/login/route.ts:60-61` |
| Filter injection en `findMemberByCedulaOrEmail` (dos `.eq()`) | `src/lib/supabase/queries/members.ts:1087-1093` |
| Validación de uploads (magic bytes, 10MB, whitelist) | `src/app/api/employees/[id]/documents/route.ts:8-58` |
| CSP sin `unsafe-eval` en producción | `next.config.ts:42` |

### Pendiente desde 2026-06-11 (nada se corrigió después)

| Ítem | Sev | Evidencia |
|---|---|---|
| B1 Suplantación de `member_id` en 3 POST | Alto | `finance/requests/route.ts:36`, `studies/requests/route.ts:39`, `forms/[id]/responses/route.ts:31` |
| B2 Export del padrón sesión-only | **Crítico** | `members/export/route.ts:9` |
| B3 Filter injection `c.area` en `.or()` | Alto | `queries/members.ts:296` |
| B4 Edge function sin auth propia + cola sin claim atómico | Alto | `supabase/functions/process-email-queue/index.ts:8`, `queries/communications.ts:357-400` |
| B5 Roles desactivados caen a 'miembro' (retienen lectura) | Medio | `lib/auth/guard.ts:25` |
| B6 `requireModuleView` lee de mock-auth, solo acción 'view' | Medio | `lib/auth/guard.ts:58-61` |
| B7 GET /api/accesos sesión-only (mapa de privilegios) | Medio | `accesos/route.ts:8` |
| B8 CRON_SECRET comparado sin timing-safe | Bajo | `communications/messages/[id]/process/route.ts:11` |
| B9 Accesibilidad (8 sub-ítems: Sidebar /40, RequestBoard /40, analisis /40, configuracion /40, comunicaciones /40, CalendarGrid opacity-45, RequestTabs ARIA parcial, search global sin combobox) | Medio | Todos pendientes; RequestTabs parcial |

---

## Área 1 — Estilos y consistencia visual

### Alto

| # | Hallazgo | Ubicación | Fix |
|---|---|---|---|
| E1 | Token inexistente: `var(--navy, #1e2a45)` — `--navy` no existe, siempre cae a un color fuera de marca | `components/studies/CommitmentIcons.tsx:44` | `bg-navy` |
| E2 | `#c0453a` como hover del botón primario en las 4 páginas de auth — color que no existe en la paleta (coral-deep es `#D94241`), visible en cada login | `(auth)/login/page.tsx:233,354,376`, `recuperar/page.tsx:136`, `verificacion/page.tsx:139`, `nueva-contrasena/page.tsx:146` | `bg-coral hover:bg-coral-deep` |
| E3 | ~45 modales caseros en ~28 archivos con 4 estilos de backdrop distintos y z-index mixto (`z-50`/`z-[60]`/`z-[1000]`); `shared/Modal.tsx` solo se usa en 4 archivos. Además es violación del estándar de accesibilidad del repo | servidores/admin, servidores/vacantes, CommitteeModals, comunicaciones/nueva/Modals, finanzas/devoluciones:333,371, becas:259, donaciones:339, pagos:338, RefundModal:46, eventos varios, FamilyMemberModal:107, accesos:505… | Migrar a `Modal.tsx` (coincide con UX-A11y, es el fix de mayor palanca) |
| E4 | Buscador de miembro implementado 8 veces (2 `MemberPicker` con el mismo nombre + 6 inline) | `estudios/solicitudes/page.tsx:28`, `matricula/page.tsx:379`, `finanzas/donaciones:375`, `becas/nueva:158`, `estudios/dirigentes:250`, `accesos:516`, `EventServersTab:222`, `empleados/nuevo/StepPersonSearch` | Extraer `shared/MemberCombobox.tsx` (molde: DirigentesCombobox) |

### Medio

- `text-[#3DB97A]`/`bg-[rgba(61,185,122,0.12)]` en ~25 sitios existiendo `--color-success` → `text-success`/`bg-success/12` (miembros, finanzas, dashboard, dirigentes, Toast, DirigentesCombobox).
- `PhoneInput.tsx:63` usa `var(--fg,#161440)` (`--fg` no existe) y rgba fijos → `text-navy`, `border-outline`.
- Badge de estado de devolución redefinido junto a `PaymentStatusBadge` (`finanzas/devoluciones/page.tsx:20-27`).
- Config de notificaciones (icono/color) duplicada entre `notificaciones/page.tsx:13` y `NotificationsDropdown.tsx:11`.
- `AVATAR_COLORS` triplicado (incluye `AVATAR_COLORS2` en el mismo `accesos/page.tsx`).
- Pills de filtro de finanzas con `#161440` inline (`reportes:142`, `donaciones:219`) → `cn('bg-navy text-white')`.

### Bajo

~58 `style={{}}` convertibles (de 144 totales; el resto es runtime legítimo): `fontFamily` inline con var() (tiene clase exacta), patrón `borderColor: cond ? undefined : 'var(--outline-variant)'` ×16, `shadow-[var(--shadow-md)]` ×30 en servidores/formularios existiendo `shadow-card`, radios arbitrarios (`rounded-[20px]`, `rounded-[14px]`), spinner ad-hoc en 30 archivos sin `shared/Spinner`.

---

## Área 2 — UX/UI

### Estados loading/vacío/error

Las páginas principales de módulo (dashboard, miembros, eventos, estudios, matrícula, servidores, finanzas, comunicaciones, formularios, empleados, notificaciones, accesos) tienen loading+vacío; **el estado de ERROR es el agujero general**: casi todas tratan el fallo del fetch como lista vacía, indistinguible de "no hay datos".

| # | Hallazgo | Sev | Ubicación | Fix |
|---|---|---|---|---|
| U1 | `fetch('/api/members/counts').catch(() => {})` → header muestra "Cargando…" para siempre si falla | Alto | `miembros/page.tsx:217` | estado de error + mensaje |
| U2 | Error de eligibility en matrícula muestra el MISMO empty state que "no hay grupos" | Alto | `matricula/page.tsx:72` | rama de error |
| U3 | "Marcar leída" optimista sin rollback si el PATCH falla | Alto | `notificaciones/page.tsx:53`, `NotificationsDropdown.tsx:60` | revertir estado en catch |
| U4 | Duplicar/archivar formulario con `.catch(() => {})` — sin feedback de fallo | Alto | `formularios/page.tsx:88,101` | toast de error |
| U5 | Mutaciones con catch vacío | Alto | `miembros/listas/[id]/page.tsx:248`, `miembros/duplicados/page.tsx:295` | toast de error |
| U6 | Subpáginas consumen hooks que exponen `error` pero no lo renderizan (grupos, pagos, donaciones, becas, plantillas, vacantes…) | Medio | transversal | patrón `ErrorState` compartido |

### Formularios

| # | Hallazgo | Sev | Ubicación | Fix |
|---|---|---|---|---|
| U7 | Botón "Enviar ahora" de comunicaciones SIN `disabled={sending}` → doble envío de broadcasts posible | Alto | `comunicaciones/nueva/page.tsx:281-289` | disabled + spinner |
| U8 | `servidores/vacantes/nueva` y `editar`, `empleados/nuevo` y `editar` no usan el Toast central: error en texto plano, éxito sin confirmación | Alto | `vacantes/nueva:39-67`, `vacantes/[id]/editar:37-62`, `empleados/nuevo:113`, `empleados/[id]/editar:37` | `useToast()` |
| U9 | FormBuilder sin "Guardando…" en el botón ni validación visible del nombre | Medio | `formularios/_components/FormBuilder.tsx:94-150` | estado en botón + error inline |
| U10 | Wizards que solo deshabilitan "Siguiente" sin decir qué falta (eventos/nuevo, grupos/nuevo, empleados/nuevo) | Medio | `eventos/nuevo/page.tsx:119` etc. | helper text / mensaje al intentar avanzar |

Referencia positiva: miembros/nuevo, eventos/nuevo (publicar), grupos/nuevo, plan/nuevo y miembros/editar ya implementan el patrón completo (validación visible + disabled + spinner + toast) — es copiar ese patrón.

### Mobile

- 9 touch targets de 24–28px sin padding (8 en FormBuilder/FieldInspector: `FormCanvas.tsx:116,119,227,230,233`, `FieldInspector.tsx:342,408`; `eventos/[id]/editar:453`) — Alto.
- `FamilyMemberModal.tsx:100` sin `max-h-[90vh] overflow-y-auto` (desborda en pantallas chicas) — Alto.
- 1 tabla anidada sin scroll (`estudios/grupos/[id]/page.tsx:483`) — Medio. El resto de tablas (41) y los chips/tabs usan `overflow-x-auto`/`flex-wrap` correctamente.

### Accesibilidad

- **~16 modales ad-hoc sin focus trap/Escape/aria-modal** (mismo listado que E3) — Alto; el `Modal.tsx` compartido ya resuelve todo.
- **15+ inputs sin label/aria-label** (concentrados en servidores/admin, vacantes/editar, comunicaciones/configuracion SMTP) — Alto.
- **~16 botones X de cierre y 9 botones con solo `title=`** sin aria-label (servidores/admin es el peor archivo) — Alto. Incluye `AmountDisplay.tsx:22` (revelar salario) y `QueryBar.tsx:61`.
- **Texto informativo bajo el estándar /60**: 513 usos de `/40` + 340 de `/50` (mucho heredado; los graves: labels de datos en `miembros/duplicados/page.tsx:72-76,209`, descripción de `EmptyState.tsx:19`, "Asignada a" en `RequestBoard.tsx:391`) — Medio en volumen, Alto en los listados.

### Consistencia entre módulos

- `/finanzas/solicitudes` quedó atrás de `/estudios/solicitudes`: sin botón "Crear solicitud", sin asignación (`assigneesUrl`), subtítulo `/50` vs `/70` — Alto si se quiere paridad (la asignación en finanzas requiere decidir a quién se asigna).
- Contador de resultados duplicado en miembros (`page.tsx:517-527` y `561-570`) — Medio.
- Filtros con 3 lenguajes visuales distintos (chips+modal en miembros, botones+selects en grupos, botones inline en eventos/servidores); paginación: server-side (miembros) vs client-side (eventos) vs ninguna (grupos/servidores) — Medio, candidato a patrón único.
- `REQUEST_STATUS_BADGE` con `text-[#A8821F]` hardcodeado (`RequestBoard.tsx:48`) — Bajo.

---

## Área 3 — Código y mejores prácticas

### Alto

| # | Hallazgo | Ubicación | Fix |
|---|---|---|---|
| C1 | **Criterio de asistencia divergente**: `computeEligibility` usa `charla_count >= 4` (total histórico) mientras el criterio único es cobertura mensual — `/api/matricula/eligibility` y `/api/studies/eligibility` pueden dar elegibilidad DISTINTA al mismo miembro | `lib/studies/eligibility.ts:115` | pasar `attendance_active` calculado con el criterio único |
| C2 | `getEligibleStudiesForMember` reimplementa el cálculo de meses localmente (y con `toISOString()` sensible a timezone) en vez de `attendanceMonthsSatisfyCriteria` | `queries/studies.ts:512-562` | usar el helper central |
| C3 | Mocks con DATOS VIVOS en producción: `mockMembers` en RecipientsSection, EventServersTab, eventos/[id], useMemberFilters; `MOCK_GROUPS` en RecipientSelector; `SERVICE_POSITIONS`/`MOCK_FORMS` en AdvancedFilters (ofrece opciones de filtro que no existen en BD) | `components/communications/RecipientsSection.tsx:1`, `RecipientSelector.tsx:6`, `eventos/[id]/_components/EventServersTab.tsx:3`, `hooks/useMemberFilters.ts:4`, `components/members/AdvancedFilters.tsx:9-11` | migrar a APIs reales |
| C4 | Tipo `Member` definido 2 veces (types/member.ts y mock-members) — ~10 páginas usan el contrato mock | `data/mock-members.ts` + importadores | unificar en `@/types/member` |
| C5 | `GET /api/studies/groups` devuelve ~1,680 grupos con enrollments embebidos sin paginación (varios MB; lo consumen useStudies y varios modales) | `queries/studies.ts:92-107` | paginar + agregar conteo en SQL |

### Medio

- Reglas de elegibilidad triplicadas: requisitos por etapa en 3 lugares (`getStudyDemand`, `meetsStage`, flags de `computeEligibility`); recorrido de descendientes en 3 lugares; `LEVEL_TO_STAGE` duplicado → extraer módulo único de reglas.
- `STUDY_CATALOG` estático consumido por 7 archivos cuando `study_plans` es la fuente de verdad (nombres/mentores pueden divergir).
- `closeGroup` hace N+1 (1-2 UPDATEs por miembro); `servidores/admin` hace DELETEs en loop secuencial desde el cliente.
- Queries de listado sin `.range()`/`.limit` en finance, employees, servers, communications, forms (crecerán con la BD).
- `formatDate` ×19 copias, `initials` ×24 copias → `src/lib/format.ts`.
- Tipo `MemberList` (query de producción) importado desde archivo mock.
- 47 casts `as unknown as` en queries → generar tipos de BD (`generate_typescript_types`) y eliminarlos.
- Jerarquía de áreas: fallback `area?.parent?.name ?? area?.name` repetido ×6 → helper.

### Bajo

- 3 `any` en builders de query (dashboard, alerts, members).
- Rutas API español/inglés mezclado; `/api/studies/dirigentes` y `/api/studies/leaders` coexisten con nombres sinónimos para recursos distintos.
- 34 componentes >400 líneas (top: `miembros/page.tsx` 1002, `servidores/admin` 828, `dashboard` 781); 4 funciones >100 líneas (`getMemberFullById` 327).
- Manejo de errores en rutas API: correcto (las 104 respuestas 500 loguean la causa; 0 sin log).

---

## Área 4 — Seguridad

### Crítico

| # | Hallazgo | Ubicación | Fix propuesto |
|---|---|---|---|
| S1 | `GET /api/members/export` con `requireRoles()` SIN roles: cualquier sesión (rol miembro) exporta el padrón completo (22.5k registros: cédulas, teléfonos, emails, direcciones, alergias) sin paginar | `members/export/route.ts:9` | exigir `editor_perfiles`/`direccion`/`encargado_staff` o `requireModuleView('miembros')` + permiso export |

### Alto

| # | Hallazgo | Ubicación | Fix |
|---|---|---|---|
| S2 | Suplantación: POST acepta `member_id` del body sin comparar con `auth.ctx.memberId` (crear solicitudes/respuestas a nombre de otro) | `finance/requests/route.ts:36`, `studies/requests/route.ts:39`, `forms/[id]/responses/route.ts:31` | si el rol no es coordinador/admin, forzar `member_id = ctx.memberId` |
| S3 | `GET /api/members/[id]` sesión-only devuelve perfil COMPLETO incluyendo donaciones y pagos de cualquier miembro | `members/[id]/route.ts:10` | recortar payments/donations salvo finanzas/dirección, o exigir módulo |
| S4 | Filter injection: `q.or(\`id.eq.${c.area},parent_id.eq.${c.area}\`)` con input de usuario sin validar UUID | `queries/members.ts:296` | regex UUID antes de interpolar |
| S5 | RLS sobre-permisiva para Fase 3: `salary_changes`/`vacation_records`/`position_records`/`paid_positions` (017) y `donations`/`refunds`/`import_batches` (014) con SELECT para cualquier `authenticated` — salarios y donaciones visibles a todo usuario logueado cuando se active acceso directo | migraciones 014:105-120, 017:94-105 | policies por rol (como `employees_select` post-034) |
| S6 | Edge function de emails invocable por cualquiera (sin verify_jwt/secret) + `processPendingEmails` sin claim atómico → emails duplicados con ejecuciones concurrentes | `process-email-queue/index.ts:8`, `queries/communications.ts:357-400` | secret en la función; UPDATE…RETURNING para reclamar lote |

### Medio

- `internal_notifications_insert` y los INSERT de solicitudes con `WITH CHECK (TRUE)` (espejo RLS de S2; phishing interno en Fase 3) — migraciones 041/047/048.
- `duplicate_dismissals`: única tabla SIN RLS (confirmado contra la BD viva).
- `GET /api/members` + `ids` + `counts` sesión-only (cédulas/teléfonos a rol miembro); `GET /api/members/[id]/family` igual; `GET /api/accesos` (mapa de privilegios).
- `pageSize` sin tope ni validación en `/api/members` (`?pageSize=abc` → 500; `?pageSize=100000` funciona).
- `admin.ts` sin `import 'server-only'` (un import accidental desde cliente no falla en build).
- CSP con `script-src 'unsafe-inline'` sin nonces; falta HSTS con dominio propio.
- `applyMemberSearch` sanitiza por lista negra (`%,().`) — funciona, pero lista blanca sería más robusta.

### Bajo

- `img-src https:` abierto en CSP; cookies con defaults de @supabase/ssr (correctos pero no explícitos); rate limit solo en login (no en export/emails) y en memoria por instancia; IDs de ruta sin validar UUID (no inyectables, pero 500 ruidosos); `/calendario` pública cuyos fetch exigen sesión (¿página rota sin login?); `leader_evaluations`/`applications` con SELECT authenticated.

### Secretos e historial — LIMPIO

- 0 claves hardcodeadas en src/scripts/supabase; todo por `process.env`.
- `.gitignore` cubre `.env*`, `scripts/data/`, `scripts/output/`, `data-import/`, `.playwright-mcp/`.
- Historial de git: el único `.env*` jamás commiteado es `.env.example` con valores vacíos; **cero CSVs** con datos personales en todo el historial; 0 hits de patrones de API keys.

---

## Plan de corrección priorizado

### Ya (críticos y altos de seguridad — 1 sesión)

1. **S1** Roles en `/api/members/export` (1 línea + decidir roles).
2. **S2** Anti-suplantación en los 3 POST (helper común: `resolveMemberId(ctx, body, rolesQueAsignan)`).
3. **S4** Validar UUID en `c.area` (regex de 1 línea, patrón ya usado en el repo).
4. **S3** Recortar donaciones/pagos del `GET /api/members/[id]` por rol.
5. **S6** Secret en la edge function + claim atómico en la cola (hacerlo ANTES del deploy de Brevo, que sigue pendiente).

### Corto plazo (1–2 semanas)

6. **C1+C2** Unificar el criterio de asistencia (es un bug funcional: matrícula y solicitudes responden distinto) y de paso extraer las reglas de elegibilidad a un módulo único.
7. **C3** Matar los mocks vivos (RecipientSelector/RecipientsSection de comunicaciones, EventServersTab, AdvancedFilters) — comunicaciones está enviando a destinatarios calculados sobre datos falsos.
8. **U7+U8** Doble envío de broadcasts y forms sin toast (vacantes/empleados) — el patrón correcto ya existe en 7 forms.
9. **S5 + RLS medios** Endurecer policies (salarios, donaciones, WITH CHECK TRUE, duplicate_dismissals) — barato ahora, condición para la Fase 3 de RLS; `pageSize` con tope; `server-only` en admin.ts.
10. **E3/A11y modales** Migrar los ~16 modales ad-hoc críticos a `Modal.tsx` (resuelve de un golpe accesibilidad + 4 estilos de backdrop). Empezar por servidores/admin (peor archivo).
11. **B4–B8 de la auditoría anterior** que siguen abiertos y son baratos: timing-safe para CRON_SECRET, roles en /api/accesos.

### Deuda aceptable (planificar, no urgente)

- **C5** Paginar `/api/studies/groups` y los listados de finance/employees/etc. (cuando el payload empiece a doler; grupos ya pesa).
- **C4** Unificar tipo `Member` y mover tipos fuera de `data/mock-*`; generar tipos de BD para matar los 47 casts.
- **E4** `MemberCombobox` compartido; `formatDate`/`initials` a `lib/format.ts`; spinner compartido.
- Barrido de contraste `/40 → /60+` (909 casos, mayoría heredada — hacerlo por módulo al tocar cada pantalla, código nuevo ya cumple).
- Touch targets del FormBuilder; estados de error en subpáginas con `ErrorState` compartido.
- Consistencia de filtros/paginación entre listados; CSP con nonces + HSTS; dividir los 5 archivos >700 líneas cuando se toquen.

### Decisiones que requieren al dueño del producto

- ¿Qué roles pueden ver el listado/detalle de miembros completo? (hoy: cualquier sesión; afecta S3 y los medios de members/*).
- ¿`/finanzas/solicitudes` debe tener asignación como estudios? ¿A quién se asigna (rol finanzas)?
- ¿Se renombra `/api/studies/dirigentes` vs `/api/studies/leaders` o se documenta?
