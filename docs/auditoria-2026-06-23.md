# Auditoría de código — theos-admin

**Fecha:** 2026-06-23
**Alcance:** repo completo (`src/`, `supabase/`). Auditoría de solo lectura — no se cambió nada.
**Método:** exploración por categoría (seguridad, bugs, código muerto, best practices, UX/UI). Los hallazgos 🔴 se verificaron a mano contra el código.

Leyenda de severidad: 🔴 Crítico · 🟡 Importante · 🟢 Menor.

> **Lo más urgente, de un vistazo:**
> 1. 🔴 `accesos/[memberId]/page.tsx` — asignar/revocar roles es optimista, no chequea `res.ok` ni revierte si falla → confirmación falsa de un cambio de permisos que no se persistió.
> 2. 🔴 `communications.ts` — "hoy" se calcula en UTC, no en hora CR → el rate limit diario de correos cuenta contra la ventana equivocada entre las 18:00 y medianoche.
> 3. 🟡 `studies.ts:199-202` — el `search` se interpola en un `.or()` de PostgREST sin sanitizar (las queries hermanas sí limpian los metacaracteres).

---

## 1 — Seguridad

La cobertura es **buena**: las ~130 rutas API tienen guard, el webhook SNS verifica firma, los crons usan secreto timing-safe y no hay secretos hardcodeados. Hallazgos:

### 1.1 Rutas API / permisos
- 🟢 `src/app/api/auth/login/route.ts:47`, `logout/route.ts:4`, `me/route.ts:10` — sin `requireRoles`, **correcto** (login/logout no pueden exigir sesión previa; `me` devuelve 401 sin sesión). Documentado para descartar.
- 🟢 `src/app/api/public/events/route.ts:11` — endpoint público sin guard, por diseño (expone solo eventos con columnas limitadas). Conviene confirmar que el `select` no filtra campos internos.
- No se encontró ninguna escritura (POST/PUT/PATCH/DELETE) que valide solo sesión donde debería exigir rol, salvo casos intencionales y documentados (`apply` de vacantes, `finance/requests` POST, `studies/requests` POST, `forms/[id]/responses` POST — "cualquier autenticado" a propósito, con anti-suplantación vía `resolveTargetMemberId`).

### 1.2 Inyección / PostgREST filter injection
- 🟡 `src/lib/supabase/queries/studies.ts:199-202` — interpola `f.search.trim()` en `.or(\`first_name.ilike.${like},...\`)` **sin sanitizar**. Las hermanas (`finance.ts:142`, `servers.ts:230`) sí hacen `search.replace(/[%,().*\\]/g, '')`. Un valor con comas/paréntesis puede alterar el árbol de filtros `.or()`. Riesgo SQL crudo bajo (pasa por PostgREST), pero permite manipular la lógica del filtro. **Fix:** aplicar el mismo `replace` de metacaracteres antes de armar el `like`.
- 🟢 `src/lib/supabase/queries/members.ts:380` — interpola en `.or()` pero solo tras `UUID_RE.test(...)`; input acotado. OK.

### 1.3 Webhooks / endpoints públicos — OK
- 🟢 `src/app/api/email/sns-webhook/route.ts:32-71` — verifica firma criptográfica SNS (cert solo desde `sns.*.amazonaws.com`, HTTPS forzado), valida algoritmo según `SignatureVersion`, allowlist opcional por `SES_SNS_TOPIC_ARN`; sin firma → 403.
- 🟢 `email/unsubscribe` y `resubscribe` — autorizan por `unsubscribe_token` impredecible, solo opt-out/in, sin PII.
- 🟢 Crons (`communications/messages/[id]/process`, `notifications/leader-absence-check`) — `CRON_SECRET` por Bearer con `crypto.timingSafeEqual`, o sesión con rol.

### 1.4 Secretos / PII — sin hallazgos materiales
- 🟢 Grep de `AKIA…`, `sb_secret`, `service_role`, `eyJ…`, `SES_SMTP_PASSWORD`, `AWS_SECRET…` en `src/`: nada literal, todo desde `process.env`.
- 🟢 `console.error` en rutas API loguean prefijo + objeto error, sin volcar cédulas/correos/teléfonos. Tokens de baja en query param son secretos de un solo propósito (patrón estándar de unsubscribe).

### 1.5 RLS — deuda conocida (la app corre con service role, que bypassa RLS)
- 🟢 `supabase/migrations/028_member_lists.sql:22` — `member_lists_select … USING (TRUE)`.
- 🟢 `041_study_requests.sql:45,111`, `047_request_status_history.sql:27`, `048_finance_requests.sql:34,81` — varios `INSERT … WITH CHECK (TRUE)` (aceptable), pero verificar que los SELECT correspondientes de `finance_requests` y `request_status_history` filtren por dueño/rol.
- No se encontraron tablas con `CREATE TABLE` sin su `ENABLE ROW LEVEL SECURITY`.

---

## 2 — Bugs y errores potenciales

### 2.1 Error tragado + estado optimista sin rollback
- 🔴 `src/app/(admin)/accesos/[memberId]/page.tsx:61-90` — `handleRevoke` y `handleAddRole` aplican el cambio optimista (`setUser`/`setHistory`) y luego hacen `fetch(DELETE/POST)` en un `try { … } catch { /* el optimista ya se aplicó */ }`. **No chequean `res.ok`** (un 403/500 resuelve sin lanzar, ni siquiera entra al catch) y **no hay rollback**. La UI confirma un cambio de permisos que pudo no persistirse. Es la familia exacta del bug histórico de `createEvent`. **Fix:** chequear `res.ok`, revertir `setUser`/`setHistory` en error y mostrar toast.

### 2.2 Fechas / timezone (runtime Vercel = UTC; el negocio es CR / UTC-6)
- 🔴 `src/lib/supabase/queries/communications.ts:220-227` — `todayStr()` = `new Date().toISOString().split('T')[0]` y `startOfDay = ${todayStr()}T00:00:00.000Z` definen "hoy" en **UTC**. Entre las 18:00 y medianoche CR ya es el día siguiente en UTC → `getDailyEmailsSent()` (rate limit diario) cuenta contra la ventana equivocada: puede resetear el contador antes de tiempo o contar envíos de ayer. **Fix:** calcular el inicio del día en CR (offset -06:00) y convertir a UTC.
- 🟡 `src/lib/supabase/queries/communications.ts:239-262` — `distributeEmailSchedule` usa `now.toISOString().split('T')[0]` para `scheduled_date`; cerca de medianoche desincroniza con el filtro `lte('scheduled_date', today)` del procesador.
- 🟡 `src/lib/supabase/queries/forms.ts:270` — `toLocaleDateString('es-CR', …)` **sin** `timeZone: 'America/Costa_Rica'` (usa la TZ del runtime = UTC). Aplica también a `email/enrollment-notify.ts:13` y otros `toLocaleDateString('es-CR')` server-side.
- 🟡 `src/app/(admin)/accesos/[memberId]/page.tsx:64,79` y `accesos/page.tsx:93` — `granted_at`/`date` con fecha UTC; de noche registra el día siguiente en el historial.

### 2.3 Embeds self-FK `parent:areas!parent_id` sin parchear (mismo bug ya corregido en `servers.ts`)
PostgREST trata el embed self-FK como to-many y devuelve `[]`, dejando vacío el nombre del área padre. Sobrevive en:
- 🟡 `src/lib/supabase/queries/employees.ts:72` — área padre del comité vacía en la lista de empleados.
- 🟡 `src/lib/supabase/queries/employees.ts:89` — `getPaidPositions`, mismo síntoma.
- 🟡 `src/lib/supabase/queries/members.ts:983` — `getMemberFullById`; área padre del voluntariado vacía en el perfil.
- 🟡 `src/lib/supabase/queries/members.ts:745-746` — list view (ramas `!inner` y normal); verificar si el consumidor usa `parent.name`.
- **Fix:** aplicar el patrón `getAreaNameMap` (id→{name, parent_id}) que ya usa `servers.ts`.

### 2.4 `.in()` con arrays potencialmente grandes
- 🟡 `src/lib/supabase/queries/finance.ts:403` — `.in('cedula', cedulas)` con cédulas de todas las filas de un import (miles) → URL gigante / 414-500. Las análogas en `communications.ts` (350/406/593) y `studies.ts` (480/1106) sí batchean en slices de 300-400. **Fix:** trocear en lotes.
- 🟢 `members.ts:1409`, `events.ts:782`, `study-requests.ts:472` — arrays acotados por naturaleza; bajo riesgo.

### 2.5 Otros
- 🟡 `src/components/shared/ColumnSelector.tsx:35,47` — `catch {}` vacíos alrededor de `JSON.parse`/localStorage; el `:35` traga columnas guardadas corruptas sin rastro. **Fix:** comentario + `console.debug`.
- 🟢 `src/lib/supabase/queries/communications.ts:546-552` — `update` sin `await` antes de una lectura dependiente; es por diseño (la fila la recoge el siguiente ciclo), no bug. Anotado.
- 🟡 Varios handlers (`servidores/admin/page.tsx:438,479,514`; `empleados/[id]/page.tsx:108-230`; `comunicaciones/configuracion`) usan `} catch { /* sin cambios si falla */ }`. Revisar uno por uno si mutan estado optimista antes (el comentario sugiere que no, pero en `accesos` ese mismo estilo ocultaba un optimista real).

---

## 3 — Código sin usar / muerto

- ✅ **Brevo:** no queda **nada en código** tras la migración a SES. Solo dos comentarios en migraciones ya aplicadas (`044_email_queue.sql:1`, `057_broadcast_channel_interna.sql:2`) — historial inmutable, cosmético.
- ✅ `npx tsc --noEmit`: **limpio**.

### 3.1 Constantes muertas
- 🟡 `src/lib/constants.ts:8,10,12,18,20` — `MOCK_LOGIN_DELAY_MS`, `MOCK_RECOVERY_DELAY_MS`, `MOCK_PASSWORD_RESET_DELAY_MS`, `MOCK_SEND_DELAY_MS`, `MOCK_LONG_SEND_DELAY_MS`: declaradas, nunca importadas. **Borrar.** (`MOCK_SAVE_DELAY_MS:16` sí se usa en `eventos/embed/page.tsx:99` — dejar, conviene renombrar.)

### 3.2 Componentes huérfanos (nunca importados)
- 🟡 `src/components/studies/LeaderCard.tsx:35` — `LeaderCard` sin usar. **Borrar archivo.**
- 🟡 `src/components/communications/FormatToggle.tsx:5` — `FormatToggle` sin usar. **Borrar archivo.**

### 3.3 Imports / vars sin usar (lint)
- 🟡 `accesos/[memberId]/page.tsx:8,10,12,32` — `cn`, `formatDateLong`, `RoleBadge`, `router` sin usar.
- 🟡 `accesos/page.tsx:3,5` — `useRef`, `ChevronDown` sin usar.
- 🟢 `comunicaciones/[id]/page.tsx:350` (`idx`), `comunicaciones/nueva/_components/ContentSection.tsx:33` (`previewChannel`), `Modals.tsx:4` (tipo `CommunicationMessage`).

### 3.4 Nombres legados (cosmético, datos reales)
- 🟢 Prefijos `MOCK_*` (`MOCK_COMMITTEES`, `MOCK_MESSAGES`, `MOCK_PAYMENTS`, `MOCK_EMPLOYEES`, `MOCK_EVENTS`…) en ~10 páginas ya traen datos reales desde los hooks. Renombrar opcional.
- 🟢 Fallbacks de env intencionales: `…PUBLISHABLE_KEY ?? …ANON_KEY` (`client.ts:6`, `middleware.ts:14`, `server.ts:9`), `SUPABASE_SECRET_KEY ?? SUPABASE_SERVICE_ROLE_KEY` (`admin.ts:15`). Borrar el fallback solo cuando se confirme qué nombre usa Vercel.

---

## 4 — Best practices

### 4.1 Lógica duplicada a centralizar
- 🟡 **`calcAge`/`calcularEdad` × 5:** `miembros/page.tsx:40`, `miembros/listas/[id]/page.tsx:20`, `formularios/[id]/preview/page.tsx:21`, `components/members/FamilyMemberModal.tsx:17`, `lib/members/adapter.ts:9` (+ inline en `miembros/duplicados/page.tsx:51`). **Fix:** una sola `calcAge` en `lib/format.ts` (promover la de `adapter.ts`, que ya maneja `null`).
- 🟡 **Detección de dirigente con `/dirigente/i.test()` × 5:** `lib/members/adapter.ts:27,164`, `lib/supabase/queries/members.ts:830,1313`, `servidores/[committeeId]/page.tsx:41`. Lógica de negocio frágil (depende del nombre del comité) dispersa. **Fix:** `esComiteDirigentes(name)` en `lib/dirigentes.ts`; evaluar basarla en jerarquía de áreas (`committeeInArea` en `lib/org.tsx:19`).
- 🟡 **Formateo de fecha inline:** `miembros/duplicados/page.tsx:46` (es `formatDateNumeric`), helper `ymdLocal` duplicado en `eventos/nuevo/page.tsx:53`, `eventos/[id]/checkin/page.tsx:308`, `components/events/DatePicker.tsx:33`. **Fix:** usar `lib/format.ts`; agregar un `toYmdLocal(date)` centralizado.
- 🟡 `servidores/[committeeId]/_components/MembersTab.tsx:13` — `calcularAntiguedad` (dominio) viviendo en un componente UI. **Fix:** mover a `lib/`.

### 4.2 Reuso de `src/components/shared/`
- 🟡 Export a CSV/Blob propio en vez de `ExportButton`/`lib/export.ts`: `formularios/[id]/respuestas/page.tsx`, `eventos/page.tsx`, `eventos/[id]/_components/EventHeader.tsx`. **Fix:** reusar `ExportButton` o al menos el helper de descarga.
- 🟢 Modales: sin reimplementaciones reales (los `fixed inset-0` de `Topbar`/`Sidebar` son menús móviles, no diálogos).

### 4.3 Lógica de negocio en el cliente
- 🟡 `finanzas/page.tsx:25-65` — KPIs financieros (ingresos, donantes activos, pagos pendientes) con `.filter`/`.reduce` en el cliente sobre mocks. Aún es mock, pero **al migrar a BD NO portar los `reduce` al cliente** — mover a query/RPC server-side (agregar dinero en cliente es propenso a errores de paginación/TZ).
- 🟢 ~30 páginas client con `fetch` en `useEffect` pegan a route handlers con guard — patrón aceptado del proyecto; no se reporta cada una.

### 4.4 Tipos
- 🟡 `(q: any) => any` en builders de query: `members.ts:244,416`, `dashboard.ts:12`, `alerts.ts:20,70`. Desactiva el chequeo dentro de las queries. **Fix:** tipar con `PostgrestFilterBuilder` o genérico.
- 🟢 `as unknown as <DbType>[]` repetido en resultados de Supabase (~20 sitios). Patrón aceptable; reducir generando tipos desde `database.ts`. No urgente. Sin `@ts-ignore`.

### 4.5 Archivos gigantes (>400 líneas)
| Líneas | Archivo |
|---|---|
| 1523 | `lib/supabase/queries/members.ts` |
| 1442 | `lib/supabase/queries/studies.ts` |
| 1034 | `miembros/page.tsx` |
| 912 | `servidores/admin/page.tsx` |
| 850 | `eventos/[id]/checkin/page.tsx` |
| 794 | `dashboard/page.tsx` |
| 789 | `lib/supabase/queries/events.ts` |
| 737 | `lib/supabase/queries/communications.ts` |

🟡 Prioridad: partir `members.ts` y `studies.ts` por subdominio; extraer tabla/modales/columnas de `miembros/page.tsx` a sub-componentes. El resto, anotado pero no bloqueante.

---

## 5 — UX/UI y accesibilidad

En general muy bien: `Modal.tsx` tiene focus-trap + Escape + `aria-modal`; los listados grandes alternan tabla (desktop) / tarjetas (mobile); el check-in maneja loading/empty/error con rollback optimista. Hallazgos acotados:

### 5.1 Errores silenciosos / confirmación falsa
- 🟡 `miembros/page.tsx:327` (`handleSaveList`) — POST a `/api/member-lists` sin chequear `res.ok` ni try/catch; siempre muestra "Lista guardada" (`:360`) aunque falle.
- 🟡 `miembros/listas/page.tsx:45,75,88,110` — las 4 mutaciones (cargar/eliminar/refrescar/editar) solo hacen `console.error`; el modal se cierra y la UI no cambia → el usuario cree que guardó/eliminó. **Fix:** chequear `res.ok` + toast (el patrón de toast ya existe en `miembros/page.tsx:1006`).
- 🟡 `eventos/[id]/checkin/page.tsx:263` (`confirmDelete`) — borrar un check-in que falla solo loguea; el modal queda abierto sin explicar por qué.
- 🟢 `estudios/dirigentes/[id]/page.tsx:89` y `estudios/dirigentes/page.tsx:439` — mismo patrón sin feedback visible.

### 5.2 Estado de carga faltante
- 🟡 `miembros/listas/page.tsx:32,47,182` — sin flag de carga; mientras el fetch está en vuelo muestra "0 listas" y el `EmptyState` como si no hubiera ninguna. **Fix:** `loading` state + skeleton.
- 🟢 `comunicaciones/page.tsx` — usa `useCommunications`/`useForms` sin leer flag de carga; si son async, los stats aparecen en cero sin spinner. Verificar.

### 5.3 Accesibilidad
- 🟡 `eventos/[id]/checkin/page.tsx:778-801` (NewPersonModal) — `style={fieldStyle}` (fondo translúcido) se aplica también a los `<label>`, no solo al input; además los labels no tienen `htmlFor`/`id` (click no enfoca, lectores no vinculan). **Fix:** quitar el `style` del label y asociar con `htmlFor`/`id`.
- 🟡 `comunicaciones/page.tsx:230,240,251,258` — 2 `<select>` y 2 `<input type="date">` sin `aria-label`/`<label>` (los de fecha no anuncian "desde/hasta").
- 🟡 `eventos/[id]/checkin/page.tsx:768` — `placeholder-white/30` sobre panel navy (texto bajo el mínimo del design system). También `placeholder-navy-light/40` en `:397`. **Fix:** subir a `/50`-`/60`.
- 🟢 `members/MemberDigitalPass.tsx:92,106,116` — `text-navy-light/40` en botones (deshabilitados, pero /40 es texto bajo el mínimo).

### 5.4 Responsive / consistencia visual
- 🟢 `comunicaciones/page.tsx:166` — `grid grid-cols-3` sin breakpoint (apretado en pantallas angostas). **Fix:** `grid-cols-1 sm:grid-cols-3`.
- 🟢 `eventos/[id]/checkin/page.tsx:36-41` — `AVATAR_COLORS` usa `bg-purple-700`/`bg-amber-500` (fuera de paleta); el padrón usa solo tokens de marca. Unificar.
- 🟢 `comunicaciones/page.tsx:143,185` y `miembros/page.tsx:918,930,941,953` — typo `tracking-widests` (clase Tailwind inexistente) → `tracking-widest`.
- 🟢 `miembros/page.tsx:775,877` — verde `#3DB97A` hardcodeado como color semántico "activo" (fuera de la paleta documentada). Tokenizar si se reutiliza.
- ✅ Check-in y padrón: responsive correcto (`max-w-2xl`, `overflow-x-auto`, tabla `hidden md:block` + tarjetas `md:hidden`). Botones solo-ícono clave con `aria-label`.

---

## Resumen por severidad

| Categoría | 🔴 Crítico | 🟡 Importante | 🟢 Menor |
|---|---|---|---|
| 1 — Seguridad | 0 | 1 | 6 |
| 2 — Bugs | 2 | 9 | 2 |
| 3 — Código muerto | 0 | 7 | 4 |
| 4 — Best practices | 0 | 8 | 3 |
| 5 — UX/UI | 0 | 6 | 6 |
| **Total** | **2** | **31** | **21** |

### Orden sugerido para arreglar
1. 🔴 `accesos/[memberId]/page.tsx` — `res.ok` + rollback + toast (permisos: confirmación falsa).
2. 🔴 `communications.ts:220-227` — "hoy" en hora CR (rate limit diario de correos).
3. 🟡 `studies.ts:199-202` — sanitizar el `search` del `.or()`.
4. 🟡 Embeds self-FK sin parchear (`employees.ts:72,89`, `members.ts:983,745`) — aplicar `getAreaNameMap`.
5. 🟡 `finance.ts:403` — batchear el `.in('cedula', …)`.
6. 🟡 Errores silenciosos de UX (`miembros/page.tsx:327`, `listas/page.tsx`) — `res.ok` + toast.
7. 🟡 Timezone CR en `forms.ts:270` / `enrollment-notify.ts` / fechas de `accesos`.
8. 🟡 Quick wins de código muerto: 5 `MOCK_*_DELAY_MS`, `LeaderCard.tsx`, `FormatToggle.tsx`, imports de `accesos/`.
9. 🟡 Centralizar `calcAge` y `esComiteDirigentes`; tipar los `(q: any) => any`.

> Nada 🔴 bloquea una vista clave hoy: check-in y padrón funcionan con estados de carga/vacío/error completos. Los dos 🔴 son de corrección puntual.
