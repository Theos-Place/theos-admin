# QA-3 · Auditoría de código — 2026-10-15

Levantar el mapa, no arreglar. Solo lectura del repo y SELECT/EXPLAIN contra
producción (`pg_stat_user_tables`, `pg_stat_statements` acumulado desde el
2026-06-18). No se tocó `src/` ni la base. Censo completo de endpoints en
`censo-endpoints.md` (generado por `scripts/qa3/censo-endpoints.cjs`).

## Resumen

| Qué | Resultado |
|---|---|
| Endpoints censados | **397 handlers en 299 rutas** |
| Sin guard | **0** (14 públicos por diseño: login, registro, bajas por token, `/api/public/**`) |
| Escrituras solo-sesión | 49; **las 49 acotan por pertenencia** en el handler, 30 sin comentario que lo diga |
| Posible IDOR (heurística) | 8 candidatos, **0 reales** (todos resuelven `member_id` contra la sesión o un permiso) |
| Cuerpos JSON de escritura sin zod | **82** (la convención de AGENTS.md pide zod en todos) |
| `catch` sin `reportarError` | 0 |
| Funciones SQL abiertas (`sec3/auditar`) | 0 |
| Consultas sin paginar sobre tablas >1.000 filas | **0** (las 44 funciones sin `.range()` tocan catálogos de 2 a 570 filas) |
| N+1 reales en rutas calientes | 0 (22 bucles con `await`; son crons, borrados o de 2 iteraciones) |
| Índices candidatos | 73 FK sin índice, ninguna sobre tabla >1.000 filas; 1 índice sin uso (2,6 MB) |
| Exports muertos | **129 exports + 2 archivos + 265 tipos** sin ningún importador (ni tests) |
| TODO/FIXME con más de un mes | 0 (los 33 «TODO» del grep son la palabra en español) |
| Línea base | `tsc` limpio · `eslint --max-warnings=0` limpio · **5.984 tests en 503 archivos, todos pasan** |

**Los cinco que más importan:**

1. **Matrícula carga los 2.222 grupos con embeds cada vez que alguien la abre.** Es la consulta
   más cara de todo prod: 24.615 llamadas · 77 ms · **1.894 s acumulados**, el 1.º del ranking (M1).
2. **La lista de eventos pide 500 eventos con 6 embeds** (check-ins, inscripciones, voluntarios):
   393 ms por llamada · 3.682 llamadas · **1.290 s acumulados** (M2).
3. **`get_group_attendance()` recorre los 176.731 check-ins sin filtro de fecha** en cada
   apertura del reporte de retención: 0,5–2,4 s, 17.945 filas, derrama a disco (M3).
4. **82 escrituras validan el body a mano**, 22 de ellas en estudios y 11 en miembros (M4).
5. **129 exports muertos**, entre ellos seis funciones de ESCRITURA que ya nadie llama
   (`updateEvent`, `deleteEvent`, `importDonations`, `createFolletoRequest`,
   `importServicePositions`, `settlePlanIfPaid`) (M5).

Sin CRÍTICOS.

## CRÍTICO

Ninguno. Los 45 «sin guard» que marcó la primera pasada del censo eran helpers
que el regex no seguía (`autorizar()` con `CRON_SECRET` en los 22 crons,
`requireFormEdit` en formularios, `getAuthContext()` con 401 explícito). Se
leyeron uno por uno; el censo corregido los sigue.

## MEDIO

### M1 · La elegibilidad de matrícula trae todos los grupos del sistema

`src/app/api/matricula/eligibility/route.ts:35` y
`src/app/api/studies/request-options/route.ts:34` llaman `getStudyGroups()` sin
filtro. Sin `page`, `getStudyGroups` (`src/lib/supabase/queries/studies.ts:512`)
pagina de 1.000 en 1.000 hasta traerlo todo: hoy 2.222 grupos con el embed de
dirigentes e inscripciones (`LIST_GROUP_MEMBERS_SELECT`), de los que la
elegibilidad solo puede ofrecer los abiertos o por abrir.

**Evidencia (pg_stat_statements, prod):** la consulta de `study_groups` con ese
select es la 1.ª por tiempo total del sistema: 24.615 llamadas · 77 ms promedio ·
1.894 s. Otra variante del mismo select suma 4.632 llamadas · 88 ms · 408 s.

**Fix:** pasar `filters: { statuses: ['planificado', 'inscripcion_abierta', 'en_curso'] }`
(o el equivalente que use `computeEligibility`) y un select sin inscripciones.
**Esfuerzo:** S.

### M2 · La lista de eventos carga 500 eventos con seis embeds

`src/hooks/useEvents.ts:26` pide `pageSize=500` sin `light=1` para filtrar en el
cliente. `getEvents` sin `light` (`src/lib/supabase/queries/events.ts:132-139`)
embebe excepciones, comités, sub-eventos, inscripciones, **check-ins** (tabla de
176.731 filas) y voluntarios por evento.

**Evidencia:** tres variantes de esa consulta en el top 10 de prod: 1.602 · 393 ms ·
629 s; 1.027 · 333 ms · 342 s; 1.053 · 304 ms · 320 s. Total 1.290 s.

**Fix:** lista con `light=1` más conteos (`inscritos`, `check-ins`) por RPC o
subconsulta `count`, y paginar en servidor. **Esfuerzo:** M.

### M3 · Los reportes de asistencia recorren todos los check-ins en cada apertura

`get_group_attendance()` (baseline, llamada desde `src/lib/reports/retencion.ts`)
no recibe rango de fechas: junta `event_checkins` × `events` × `members`
completo y agrupa por año.

**Evidencia (prod):** `select count(*) from get_group_attendance()` → 17.945 filas
en 2.402 ms en frío; EXPLAIN ANALYZE 565 ms con `temp read=704 written=704`
(derrama a disco). 1.602 llamadas · 542 ms promedio · 868 s acumulados. En la misma
familia: `report_charla_attendance()` 698 ms (680 llamadas, 362 s),
`report_personas_nuevas` 838 ms (321 llamadas), `report_member_growth` 514 ms,
`report_asistentes_de_la_semana` 600 ms, `get_dm_flags` 261 ms × 2.345.

**Fix:** parámetros `p_desde/p_hasta` en las funciones y que el reporte pida solo
los años que muestra; o una vista materializada refrescada por el pg_cron nocturno
que ya corre `refresh_member_sedes()`. **Esfuerzo:** M.

### M4 · 82 escrituras validan el body a mano, sin zod

La convención (AGENTS.md, «Convención de rutas API», punto 2) pide zod en todo
body de escritura. Hoy: 86 con zod, **82 a mano** (`typeof`, `isUuid`, `Number()`),
12 con `formData` (comprobantes y fotos; a mano es razonable). Por módulo:
estudios 22, eventos 11, miembros 11, servidores 10, finanzas 5. La lista exacta
está en `censo-endpoints.md` filtrando «a mano».

**Riesgo:** no es de autorización (todas tienen guard) sino de datos: un campo
inesperado o un tipo cambiado pasa hasta la base. **Fix:** un esquema por
handler, empezando por los que escriben dinero o estado (finanzas, pagos,
matrículas). **Esfuerzo:** L, en tandas por módulo.

### M5 · Código muerto: 129 exports, 2 componentes y 265 tipos sin importador

`npx knip` (sin contar `scripts/` ni el design system). Se comprobó con grep que
tampoco los usan los tests. Lo que pesa:

- Seis funciones de **escritura** que compilan contra la BD y nadie llama:
  `updateEvent` y `deleteEvent` (`src/lib/supabase/queries/events.ts`),
  `importDonations` (`finance.ts`), `createFolletoRequest` (`folletos.ts`),
  `importServicePositions` (`servers.ts`), `settlePlanIfPaid` (`payment-plans.ts`),
  `autoAcceptComprobante` (`payments.ts`). Si alguien las «reusa» corren reglas
  viejas: `deleteEvent` tiene su propio borrado de overrides distinto del vivo.
- Dos componentes enteros: `src/components/finance/AprobarBecaForm.tsx` y
  `OfrecerArregloButton.tsx`.
- 265 tipos exportados sin uso (50 en `lib/studies`, 33 en `lib/supabase`).

**Fix:** borrar en una tanda y dejar `knip` como check de CI (ya hay ratchets de
eslint y de botones). **Esfuerzo:** M.

### M6 · Bloques duplicados: 85 clones exactos (1.275 líneas)

`jscpd --min-tokens 80`. Los que son regla de negocio, no solo UI:

- `src/components/members/MemberPaymentsList.tsx`: 13 clones, tres dentro del
  mismo archivo (89, 32 y 25 líneas: el flujo de comprobante repetido por tipo
  de cobro) y tres contra `src/components/events/useEventRegistration.tsx:283-341`
  (el mismo flujo de subir comprobante, en eventos y en estudios).
- `src/hooks/usePermissions.ts:27` ↔ `src/lib/auth/roles.ts:271`: la resolución
  de alcance (`all`/`committee`/`own`) está escrita dos veces, cliente y servidor.
  Hoy coinciden; el día que diverjan la pantalla y el guard no van a decir lo mismo.
- `escapeHtml` en `src/lib/email/render.ts:13` y `render-vars.ts:8`: iguales hoy,
  pero son dos.
- `norm()` en `src/lib/import/ccb-personal-data.ts` y `src/lib/studies/ccb-form-parse.ts`;
  `EMPTY_RESTRICTION` en `lib/audiencia/restriccion.ts:58` y `lib/studies/group-restrictions.ts`.
- `comunicaciones/plantillas/nueva` ↔ `[id]/editar`: 64 + 29 líneas (el formulario).
- `api/studies/groups/route.ts:167` ↔ `[id]/route.ts:150` (21 líneas),
  `api/finance/requests/route.ts:61` ↔ `api/studies/requests/route.ts:81` (18).

**Fix:** extraer el flujo de comprobante a un hook compartido, y `getScope` a
`lib/auth/roles.ts` importado por el hook. **Esfuerzo:** M.

## MENOR

### N1 · 30 escrituras solo-sesión sin la decisión escrita en el handler

Las 49 escrituras con `requireRoles()` a secas acotan por pertenencia (adelantos
por sede, notificaciones propias, viáticos propios, solicitudes propias, etc.),
así que el riesgo que la regla de AGENTS.md persigue no existe. Pero 30 no dicen
en un comentario por qué basta la sesión, que es lo que la regla pide. Lista: en
`censo-endpoints.md`, guard `sesion` con método distinto de GET. **Fix:** una
línea de comentario por handler. **Esfuerzo:** S.

### N2 · `recharts` va tres veces al bundle del cliente

`.next/static/chunks`: tres chunks de 373 kB que contienen `recharts` (uno por
grupo de rutas que lo importa estático: los 6 reportes de `/reportes/*` y
`/estudios/grupos`). `xlsx` (469 kB) ya entra solo por `import('xlsx')` en
`ExportButton`; `@supabase/supabase-js` 217 kB una vez. Solo 2 usos de
`next/dynamic` en todo `src`. Next 16 ya no imprime «First Load JS» por ruta, así
que no hay número por página. **Fix:** `next/dynamic` para los gráficos.
**Esfuerzo:** S.

### N3 · El Análisis de demanda recorre todas las matrículas de a mil

**Corregido el 2026-10-15** (decía «la ficha del miembro»: era una atribución
equivocada; la ficha trae las matrículas de UNA persona). La consulta es
`src/lib/supabase/queries/studies-demand.ts:212`: pagina las ~37.000 matrículas
con grupo, plan y miembro embebidos para armar el reporte en el servidor.
3.127 llamadas · 186 ms por página · 583 s acumulados. **Fix:** una RPC que
agregue en la base y devuelva los conteos. **Esfuerzo:** M.

### N4 · 73 columnas FK sin índice

Ninguna está en una tabla >1.000 filas, así que hoy no cuesta. Las que sí van a
crecer y se filtran: `support_tickets.member_id`, `scholarships.plan_id`,
`scholarship_redemptions.enrollment_id`, `cdeb_recommendations.enrollment_id`,
`study_requests.resolved_group_id`, `finance_requests.plan_id/event_id`. Las 50
restantes son columnas `*_by` de auditoría: no las índices nadie. Un índice sin
uso desde junio: `members_smart_link_token_key` (2,6 MB; es UNIQUE, se queda).
**Esfuerzo:** S.

### N5 · El filtro de audiencia recorre el padrón de 1.000 en 1.000

`getMemberIds` (vía `audiencia.ts`, `member-lists.ts` y el export) pagina
`members` por id: 33.170 llamadas · 10,8 ms · 359 s. Barato por llamada, caro por
volumen (unos 25 viajes por corrida). **Fix:** una RPC que devuelva los ids en un
viaje. **Esfuerzo:** S.

### N6 · Páginas con varios efectos que disparan fetch

Candidatas por conteo (≥3 `useEffect` con fetch): `eventos/page.tsx` (5),
`servidores/aplicaciones` (4), `estudios/grupos`, `eventos/[id]/checkin`,
`finanzas/pagos` (3). No se verificó que sean cascadas (un efecto que setea
estado que dispara otro); queda para la tanda de M2 revisar la de eventos.

## Lo que pasa limpio

- **Autorización.** 397 handlers, 0 sin guard. Los 14 públicos lo son por
  diseño y cada uno lo documenta (login/registro con `rateLimit`, bajas por
  token impredecible, `/api/public/**` acotado). Los 8 candidatos a IDOR
  resuelven `member_id` contra la sesión o un permiso explícito.
- **Funciones SQL.** `node scripts/sec3/auditar.cjs`: 0 SECURITY DEFINER
  ejecutables por anon, 0 con EXECUTE abierto, 0 sin `search_path`.
- **Tope de 1.000 filas.** Ninguna consulta sin `.range()` toca una tabla que lo
  supere; `getStudyGroups`, `getEvents` y `getMemberIds` paginan en bucle.
- **N+1.** Los 22 `await` dentro de `for` son crons (audit_log por fila),
  borrados con guard, o bucles de 2 elementos (dirigente y co-dirigente).
- **Seq scans.** `event_organizing_committees` (227 filas) y
  `event_registrations` (136) tienen millones de seq scans: es el plan correcto
  para una tabla de una página. `members` 0 %, `study_enrollments` 0 %.
- **Errores.** Los 397 `catch` reportan con `reportarError`/`reportarFalla`.
- **Línea base.** tsc y eslint limpios; 5.984 tests pasan.

## Lo que este informe NO dice

- **EXPLAIN de las consultas REST.** Las genera PostgREST con parámetros
  ligados; se midieron por `pg_stat_statements` (tiempo real en prod), no por
  plan. Las tres RPC más caras sí tienen EXPLAIN ANALYZE.
- **Peso por página.** Next 16 no imprime «First Load JS»; se midió por chunk.
- **`SELECT name FROM pg_timezone_names`**: 395 llamadas · 479 ms en prod y no
  está en `src/`. Es del panel de Supabase o de una extensión; no es nuestro.
- **Cascadas de `useEffect`**: solo conteo, sin trazar dependencias (N6).
- **Validación «a mano»**: el censo distingue zod/a mano/formData por regex; no
  califica si los chequeos a mano son suficientes.
- **Duplicación semántica** (la misma regla escrita distinto): solo se detectó
  la exacta (jscpd) y la que se buscó a mano (escapeHtml, norm, getScope).

## Datos y scripts

- `scripts/qa3/censo-endpoints.cjs` → `censo-endpoints.{md,json}`.
- Mediciones de prod: `pg_stat_user_tables`, `pg_stat_statements` (reset
  2026-06-18), EXPLAIN ANALYZE de `get_group_attendance()`; knip 5 y jscpd 4 con
  `npx`, sin instalar.
