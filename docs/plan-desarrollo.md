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

- [ ] Agregar las env `HEALTHCHECK_URL_*` en Vercel. **La lista completa (9, una por cron)
  quedó en `.env.example` con su horario al lado** — antes solo estaban 4 y por eso "las
  faltantes" no se sabía cuáles eran. Crear un check por cron en healthchecks.io y pegar la
  URL. Sin la variable el cron corre igual; solo no avisa si falla.
  · `report-snapshots` **SÍ debe pingear** — decidido e implementado 2026-08-06: su modo de
  fallo es silencioso (los reportes siguen abriendo, con datos viejos). Ya no queda ningún
  cron sin ping, y hay un test que lo vigila (`src/lib/health.test.ts`).
- [ ] Configurar Sentry (`SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN`).
- [ ] Copiar las env vars de Supabase a los deploys **Preview** de Vercel (hoy solo están en Production y los previews fallan).
- [x] Verificar que la edge function `process-email-queue` de Supabase no duplique los crons
  de vercel.json — **VERIFICADO 2026-08-06: no hay ninguna edge function desplegada** en el
  proyecto, así que no existe tal duplicación. Los 3 jobs de pg_cron que sí existen
  (`refresh_donor_flags` 6:30, `refresh_member_sedes` 6:45, `prune_audit_log` 4:00) son
  funciones SQL y no se solapan con ningún cron HTTP de vercel.json.
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

### [x] PRE-1 · Búsqueda de cónyuge por correo — VERIFICADO 2026-07-26: no reproducible
Archivos: `src/app/(admin)/matricula/prematrimonial/page.tsx`, `src/app/api/studies/prematrimonial/spouse-search/route.ts`

> Resultado: la búsqueda por correo **ya funciona** — el form envía el texto tal cual (placeholder
> ya dice "Cédula, correo o teléfono") y `findSpouseByContact` matchea email con `ilike`
> case-insensitive; probado contra datos de producción con mayúsculas mezcladas. Se agregó test
> de regresión (`prematrimonial-spouse-search.test.ts`, 5 casos). Si el reporte persiste,
> conseguir el correo exacto que falló: lo probable es que ese correo no esté registrado en el
> perfil del cónyuge (o esté en otro campo).

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

### [x] PRE-2 · Zonas fijas del form prematrimonial — HECHO 2026-07-26 (se quitó 'Virtual'; las otras 6 ya estaban en el orden pedido; 0 registros viejos en prod)
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

### [x] PRE-3 · Fecha de boda: mínimo y default +6 meses — HECHO 2026-07-26 (módulo puro `premat-dates.ts` con meses calendario + ajuste fin de mes; 400 `boda_muy_pronto` server-side; min/default en el input; 5 tests)
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

### [x] PRE-4 · Cambiar pregunta del oficiante — HECHO 2026-07-26
Archivos: `src/app/(admin)/matricula/prematrimonial/page.tsx`

```
En src/app/(admin)/matricula/prematrimonial/page.tsx, cambiá el texto de la pregunta sobre
quién oficia la ceremonia a exactamente: "¿Quién te gustaría que dirigiera la ceremonia?".
Solo cambia el label/copy; las opciones (OFFICIANTS) quedan igual.
```

### [x] REV-1 · Filtros extra en revisión de pagos — HECHO 2026-07-26 (params `planId`/`leaderId` con embed `!inner`, endpoint nuevo `/api/payments/queue/options` para roles de revisión, selects deshabilitados fuera de Matrícula; verificado contra producción)
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

### [x] EST-3 · Recomendaciones solo en cierres N4+ y capacitaciones — HECHO 2026-07-26 (módulo puro `close-recommendations.ts`: N4+ o DIS*; gate en UI + server ignora recomendaciones de planes no permitidos; 4 tests)
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

### [x] FIN-1 · Donaciones: stat de donadores activos + total al filtrar — HECHO 2026-07-27 (RPC `donation_stats` gana `active_donors` = members.is_donor, migración 20260727150000 aplicada — 694 hoy; card "Sin identificar" reemplazada, banner+modal intactos; suma del filtro completo server-side vía `?with_sum=1` paginado, con AmountDisplay y solo para rol finanzas)

> OJO dato, no bug: las 14,710 donaciones en prod tienen amount=0 (los montos de QuickBooks
> son la tarea de datos pendiente) — el "Total filtrado" mostrará ₡0 hasta importarlos,
> igual que ya pasaba con "Total donado este mes".
Archivos: `src/app/(admin)/finanzas/donaciones/page.tsx` (stat card línea ~131, lista y filtros), `src/app/api/finance/donations/*`, `src/lib/supabase/queries/finance.ts`

```
Dos cambios en la página de donaciones (src/app/(admin)/finanzas/donaciones/page.tsx):
1) Reemplazar la stat card "Sin identificar" (línea ~131) por "Donadores activos": cantidad
   de miembros con members.is_donor = true. Ese flag YA se recalcula como "donó en los
   últimos ~2 trimestres" (ver RPC de is_donor en la migración baseline y el trigger que lo
   marca en cada donación) — usalo, no inventés otra definición. Exponer el conteo desde el
   API/query que alimenta las stats de la página (o donation_stats si es RPC).
   OJO: solo se quita la CARD; el banner de alerta de donaciones sin identificar y el modal
   para identificarlas (líneas ~154 y ~344) se mantienen, porque son accionables.
2) Total al filtrar: cuando la lista tiene cualquier filtro aplicado (búsqueda, fechas,
   identificado/no, etc.), mostrar junto al conteo de resultados la SUMA de los montos
   filtrados (usar AmountDisplay con el mismo comportamiento de ocultar/revelar montos que
   ya tiene la página). Si la lista está paginada server-side, la suma debe calcularse
   server-side sobre el filtro completo, no solo la página visible.
Permisos sin cambio (finanzas, direccion). Test del total filtrado con paginación.
```

### [x] MAT-1 · Resumen de compromisos entendible en matrícula — HECHO 2026-07-27 (computeEligibility expone `requirements` estructurado; módulo puro `stage-requirements-summary.ts`: mínimo real por cadena de prerequisitos + compromisos deduplicados con etiquetas cortas y detalle secundario; mismas dos columnas; 6 tests)
Archivos: `src/app/(admin)/matricula/page.tsx` (`StageRequirementsEmptyState`, líneas ~540-616), `src/lib/studies/eligibility.ts`, referencia de estilo: `RequirementChips` en `src/app/(admin)/estudios/analisis/page.tsx` y `CommitmentRow` en la misma página de matrícula

```
En la página de matrícula, cuando una etapa está bloqueada, el bloque
StageRequirementsEmptyState (src/app/(admin)/matricula/page.tsx líneas ~540-616) une los
textos crudos de reasons_blocked de todos los estudios gateway de la etapa. Resultado
confuso: aparecen prerequisitos mezclados ("Necesitás completar Nivel 4 primero" Y
"Necesitás completar Nivel 2 primero" a la vez) más un párrafo largo de asistencia.
Reemplazá esa unión de strings por un resumen estructurado y mínimo:
1) No agregues strings: usá los datos estructurados del EligibilityResult (o extendé
   computeEligibility en src/lib/studies/eligibility.ts para exponer flags por tipo de
   requisito: prerequisite, donor, server, attendance, age) en vez de parsear texto.
2) Prerequisitos: mostrar solo el MÍNIMO real de la cadena — si entre los gateway faltan
   N2 y N4, el mínimo es el nivel más bajo que le falta al miembro según su avance
   (o un genérico "Completar los estudios de niveles" si aplica a toda la cadena).
   Nunca listar dos niveles de la misma cadena a la vez.
3) Compromisos: mostrarlos con las mismas etiquetas cortas que ya se usan en el resto del
   sistema (CommitmentRow en matrícula y RequirementChips en /estudios/analisis):
   "Donador/a activo/a", "Servidor/a en comité", "Asistencia activa". El detalle largo
   ("al menos 6 charlas con check-in...") va como tooltip o texto secundario, no como
   ítem principal. Deduplicar: cada compromiso aparece una sola vez.
4) Mantener las dos columnas "Ya cumplís" / "Te falta" con el mismo estilo visual.
No cambiés la lógica de elegibilidad, solo cómo se resume y presenta.
Tests del resumen: etapa con gateways que piden N2 y N4 → muestra solo el mínimo;
compromisos repetidos entre estudios → aparecen una vez.
```

### Estudios, solicitudes y comunicaciones (feedback 2026-07-26, segunda tanda)

### [x] EST-4 · Grupo virtual ⇒ zona "Virtual" automática — HECHO 2026-07-27 (seed sede VIRTUAL con is_active=false — no aparece en combos de charlas/activeSedes, migración 20260727170000 aplicada; módulo puro `virtual-zone.ts`: marcar fija la zona y muestra pill fija en vez del combobox, desmarcar limpia solo si era Virtual; aplicado en crear Y editar; el nombre queda "COD — Virtual"; 3 tests)
Archivos: `src/app/(admin)/estudios/grupos/nuevo/page.tsx` (checkbox is_virtual líneas ~346-358, zona ~236-248), `src/app/(admin)/estudios/grupos/[id]/editar/page.tsx` (~271), `src/lib/zones.ts` (`resolveZoneCode`)

```
En crear/editar grupo de estudio, el checkbox "Grupo virtual" (is_virtual) y la zona son
campos independientes; hoy un grupo virtual obliga a elegir una zona geográfica.
Cambio: al marcar "Grupo virtual", la zona debe fijarse automáticamente en "Virtual" y el
selector de zona deshabilitarse (al desmarcar, se rehabilita y limpia). La zona "Virtual" no
existe en el catálogo de sedes: crearla vía resolveZoneCode de src/lib/zones.ts (que ya crea
zonas al vuelo) o con una migración/seed — decidí mirando cómo se listan las sedes en
useSedes y evitá que "Virtual" aparezca como sede de charlas en otros combos si eso genera
ruido (revisá consumidores de activeSedes). El nombre generado del grupo debe quedar tipo
"HER — Virtual". Aplica en nuevo Y editar. No toqués la lógica de autorización de estudios
virtuales (authorized_virtual_studies), solo la zona. Test del comportamiento del form.
```

### [x] EST-5 · Nueva etapa "Avanzada" — HECHO 2026-07-27 (migración 20260727180000 aplicada: CHECK +etapa_avanzada, CDEB/HER/CDC movidos y marcados invitation-only; LEVEL_TO_STAGE + requisitos = intermedia + asistencia reforzada; tipo stage ampliado; catálogo estático + STUDY_STAGES; UI: matrícula (tab/meta), form de grupo nuevo (optgroup), /estudios/plan (sección propia "solo por invitación"), /estudios/analisis (optgroup), StudyTypeBadge; 3 tests de elegibilidad)
Archivos: migración SQL (`study_plans.level` CHECK), `src/lib/studies/eligibility.ts` (`LEVEL_TO_STAGE` líneas 9-14 y requisitos por etapa ~28-30), `src/types/study.ts:13`, `src/data/study-catalog.ts` (HER línea ~238, CDEB ~252, CDC ~253, `STUDY_STAGES` ~262), forms y agrupadores de matrícula/análisis

```
Crear la etapa "Avanzada" y mover ahí CDEB (Cómo Dar Estudios Bíblicos), HER (Hermenéutica)
y CDC (Cómo Dar Charlas), que hoy están en etapa intermedia.
Reglas de la etapa avanzada (decisión confirmada): los MISMOS compromisos que intermedia
(donador activo + servidor en comité + asistencia reforzada de 12 charlas) Y además solo por
invitación (el mecanismo invitation-only ya existe: planes ocultos sin invitación activa en
study_invitations — reutilizalo, no lo dupliqués).
1) Migración: agregar 'etapa_avanzada' al CHECK de study_plans.level y actualizar esos 3
   planes (por code: CDEB, HER, CDC). Marcarlos invitation-only si no lo están ya.
2) src/lib/studies/eligibility.ts: agregar el mapeo en LEVEL_TO_STAGE
   (etapa_avanzada → 'avanzada') y los requisitos de la etapa (iguales a intermedia).
   Actualizar el tipo stage en src/types/study.ts.
3) Catálogo estático src/data/study-catalog.ts: stage 'avanzada' en los 3 y nuevo grupo en
   STUDY_STAGES.
4) UI: agregar el optgroup/tab "Etapa Avanzada" donde se agrupa por etapa — form de nuevo
   grupo (optgroups líneas ~153-155 y ~224-232), página de matrícula (tabs/STAGE_META),
   /estudios/analisis y /estudios/plan.
Ojo: hay dos campos con nombre parecido — study_plans.level es la ETAPA;
study_plans.difficulty ('Básico/Intermedio/Avanzado') es dificultad y NO se toca.
Tests: elegibilidad de un plan etapa_avanzada (compromisos de intermedia + invitación).
```

### [x] EST-6 · Solicitudes de interés: texto claro + solo lectura — HECHO 2026-07-27 (disclaimer/toast/aviso de duplicado sin promesa de contacto y apuntando a Matrícula; RequestBoard gana prop `readOnly` — tab de intereses sin Tomar/Asignar/Resolver/Rechazar; API rechaza acciones para study_interest con 400 `solo_lectura`; reubicaciones intactas; históricas resueltas se siguen mostrando; /estudios/analisis no leía study_requests — sin impacto)
Archivos: `src/components/studies/StudyRequestActions.tsx` (disclaimer ~195-199, toast ~148), `src/app/(admin)/estudios/solicitudes/page.tsx`, `src/components/shared/RequestBoard.tsx`, `src/app/api/studies/requests/*`, `src/lib/supabase/queries/study-requests.ts`

```
Dos cambios sobre las solicitudes de estudio tipo "me interesa" (study_interest). Decisión
confirmada: quedan como DATOS DE DEMANDA de solo lectura, sin flujo de gestión. Las de
REUBICACIÓN (relocation) mantienen su flujo completo tal cual.
BUG REPORTADO (2026-07-28) que este punto debe dejar resuelto: en la vista de reubicaciones
aparecen mezcladas las solicitudes de interés de estudio. Son dos cosas distintas que
comparten la tabla study_requests: la separación por tipo debe ser estricta en TODAS las
vistas — la vista/tab de reubicaciones filtra SOLO relocation, y la de intereses SOLO
study_interest (revisá el filtro por tipo en la página y en el API /api/studies/requests;
lo ideal es que queden como dos vistas claramente separadas, no un board mezclado).
1) Texto del form (src/components/studies/StudyRequestActions.tsx): dejar claro que NO vamos
   a contactar a la persona. Reemplazar el disclaimer (~195-199) por algo como: "Esta
   solicitud es informativa: nos ayuda a ver qué estudios tienen demanda para abrir grupos
   nuevos. No te vamos a contactar — revisá la página de Matrícula, ahí van a aparecer los
   grupos nuevos cuando se abran." Y el toast de éxito (~148) por: "¡Gracias! Registramos tu
   interés. Revisá la página de Matrícula para ver cuándo se abren grupos nuevos." (quitar
   "Un coordinador la revisará pronto"). Ajustar también el mensaje de solicitud duplicada
   para no prometer gestión de un coordinador.
2) Quitar el flujo de gestión SOLO para study_interest en /estudios/solicitudes: sin asignar,
   sin tomar, sin resolver/rechazar — la lista queda de lectura (con sus datos: plan, días,
   horario, zona, fecha) como insumo de demanda. En RequestBoard es genérico: condicioná las
   acciones por tipo o no pasés assigneesUrl/acciones para interest; las relocation siguen
   con take/assign/resolve/reject. En el API (/api/studies/requests/[id]) rechazá las
   acciones de gestión para study_interest con 400 claro (o dejá solo un archivado simple si
   la UI lo necesita para limpiar la lista — decidilo mirando qué usa la página).
   No borrés datos históricos: las interest ya resueltas se muestran igual.
Revisá que /estudios/analisis (demanda) siga leyendo estas solicitudes igual. Tests del guard.
```

### [x] EST-7 · Bug: no deja resolver solicitud — HECHO 2026-07-27 (causa raíz: el submit se deshabilitaba con solo EXISTIR la prop `renderResolveExtra`, aunque devolviera null para ese tipo — quedaba deshabilitado para siempre en tipos sin picker; ahora solo exige `resolveExtra` si el form extra se renderiza. Además el picker ya avisa cuando no hay grupos elegibles, los 409 del server ya llegan al toast, y `direccion` ahora ve la página (podía ejecutar el PATCH sin verla))
Archivos: `src/components/shared/RequestBoard.tsx` (botón deshabilitado línea ~582), `src/components/studies/RelocationResolveGroupPicker.tsx`, `src/app/api/studies/requests/[id]/route.ts`, `src/lib/supabase/queries/study-requests.ts` (`resolveStudyRequest` ~356-522)

```
Bug reportado: "no me deja resolver solicitud de grupo" (reubicación). Diagnosticá y arreglá.
Causas candidatas ya identificadas (verificá en orden):
1) El botón "Confirmar resolución" queda deshabilitado mientras resolveExtra === null
   (RequestBoard ~582); lo llena RelocationResolveGroupPicker — si el picker no encuentra
   grupos elegibles (filtros muy estrictos, grupos no en_matricula, sin cupo), el botón
   nunca se habilita Y NO SE EXPLICA POR QUÉ. Como mínimo: mostrar un mensaje claro cuando
   el picker no tiene opciones ("No hay grupos abiertos elegibles para reubicar...").
2) Guards 409 de resolveStudyRequest: YA_RESUELTA (lista sin refrescar), YA_COMPLETADO,
   PAGO_PENDIENTE, YA_MATRICULADO — verificá que el toast muestre el mensaje del server.
3) Inconsistencia de roles: la página /estudios/solicitudes gatea con
   hasRole('coordinador_estudios','coordinador_dirigentes','admin') pero el PATCH exige
   requireRoles('direccion','coordinador_estudios','coordinador_dirigentes') — admin pasa
   cualquier guard, pero revisá que 'direccion' vea la página y que no haya rol que vea
   botones sin poder ejecutar.
Reproducí el escenario, arreglá la causa raíz y dejá mensajes de error accionables en la UI.
Nota: coordinar con EST-6 — esto aplica solo a reubicaciones, que mantienen su flujo.
```

### [x] EST-8 · Notas de estudios en el perfil — HECHO 2026-07-27 (grade/notes en el select de studyHistory + columna "Nota" ordenable en el historial; regla pura `grade-display.ts`: nota numérica manda, sin nota muestra el resultado, motivo de reprobado como tooltip; misma visibilidad del perfil, sin gate extra; sin migración; 4 tests)
Archivos: `src/lib/supabase/queries/members-detail.ts` (`studyHistory` ~360-382), `src/app/(admin)/miembros/[id]/_components/MemberParticipationTab.tsx` (`StudyRow` ~77, tabla ~186-272)

```
Las notas de los estudiantes ya se guardan al cerrar un grupo (study_enrollments.grade
numérica y study_enrollments.notes con "aprobado"/"reprobado: motivo") pero NO se muestran
en ningún lado del perfil del miembro. Agregalas al historial de estudios:
1) src/lib/supabase/queries/members-detail.ts: incluir grade y notes en el select de
   studyHistory (~360-382).
2) MemberParticipationTab.tsx: agregar grade/notes al tipo StudyRow y una columna "Nota" en
   la tabla de historial de estudios (~186-272): mostrar la nota numérica cuando exista;
   si no hay nota pero hay resultado en notes, mostrar el resultado; vacío → "—".
   El motivo de reprobado puede ir como tooltip o texto secundario.
Visibilidad: el historial ya respeta los permisos del perfil (scope own para miembro,
beyondOwn para staff); las notas siguen esa misma visibilidad, sin gate adicional.
Sin migración: las columnas ya existen. Test del mapeo grade/notes en members-detail.
```

### [x] COM-1 · Configuración de comunicaciones solo admin — HECHO 2026-07-27 (página con gate AccessDenied, link filtrado del sidebar, y POST/PUT/DELETE/verify de configs → requireRoles('admin'); decisión documentada: el GET queda para el módulo porque componer un mensaje elige remitente de ahí y la tabla no guarda secretos — las credenciales SMTP viven en env)
Archivos: `src/app/(admin)/comunicaciones/configuracion/page.tsx`, `src/app/api/communications/configs/route.ts`, sidebar/nav

```
La pantalla /comunicaciones/configuracion (remitentes/SMTP, channel_configs) debe quedar
accesible ÚNICAMENTE para el rol admin. Hoy el módulo de comunicaciones lo ven los roles
comunicaciones y direccion. Cambios:
1) Gate de la página /comunicaciones/configuracion: solo admin (los demás ni la ven en el
   menú/tabs de comunicaciones ni pueden entrar por URL — redirect o 404 consistente con el
   patrón del repo).
2) API /api/communications/configs (GET/POST/PUT): requireRoles('admin') — hoy
   probablemente acepta comunicaciones/direccion; verificá también endpoints hermanos de
   configuración de remitentes si existen.
3) El resto de comunicaciones (mensajes, plantillas, audiencias) queda igual para
   comunicaciones y direccion.
Test del guard (403 para comunicaciones/direccion, 200 para admin).
```

### [x] REV-3 · Unificar página de pagos y revisión de pagos — HECHO 2026-07-28 (página unificada en /finanzas/pagos con pestañas "Todos los pagos" / "En revisión (n)"; la cola completa (filtros REV-1, bulk, comprobante, recordatorio REV-2, modal de acciones) se extrajo a `PaymentReviewQueue` con handle imperativo — desde "Todos" un pago pendiente abre el modal de la cola con acciones, el resto abre detalle plano; /pagos/revision quedó como redirect a /finanzas/pagos?tab=revision; guard de GET /api/finance/payments ahora any-of ['finanzas','revision_pagos'] vía `hasModulePermission` (lógica pura nueva en roles.ts que requireModuleView delegó); excepción en ModuleGuard del layout espejo del guard; sidebar: una sola entrada "Pagos"; Devolver/Confirmar SINPE gateados por finanzas:edit para que los roles de revisión no vean acciones que les darían 403; tests de la matriz de acceso en payments-access.test.ts. BONUS: se arregló el lint roto del repo — el override de reglas react-hooks de eslint.config.mjs aplicaba a scripts/*.cjs donde el plugin no está registrado y ESLint abortaba; se acotó al patrón de eslint-config-next)
Archivos: `src/app/(admin)/finanzas/pagos/page.tsx` (+`[id]`), `src/app/(admin)/pagos/revision/page.tsx` (absorbe y desaparece), `src/app/api/payments/queue/route.ts`, `src/app/api/finance/payments/route.ts`, `src/lib/auth/roles.ts`, sidebar

```
Unificar /pagos/revision dentro de /finanzas/pagos: las dos páginas trabajan sobre la misma
tabla payments y casi la misma funcionalidad; la diferencia es que revisión tiene el modal de
acciones (aprobar/rechazar/iniciar revisión/reabrir/cerrar, vía /api/payments/[id]/review).
Decisiones confirmadas:
- La página unificada vive en /finanzas/pagos; /pagos/revision hace redirect ahí (mantener el
  redirect para links guardados y notificaciones internas que apunten a la ruta vieja).
- Los roles que hoy solo ven revisión (revision_pagos, folletos, coordinador_dirigentes,
  coordinador_estudios) pasan a ver TODOS los pagos en la página unificada. Actualizá el
  módulo/permiso en src/lib/auth/roles.ts para que esos roles tengan view del módulo de pagos
  completo, y el guard del API /api/finance/payments acorde. Las acciones de revisión siguen
  gateadas por requireModuleView('revision_pagos','edit') como hoy.
Implementación:
1) En /finanzas/pagos: integrar la cola de revisión como pestaña o filtro destacado
   ("En revisión" con contador), conservando los filtros que ya tiene revisión (estado de
   cola, concepto, y los de REV-1: plan y dirigente) más los propios de la página de pagos.
2) Traer el modal de detalle/acciones de revisión a la página unificada: cualquier pago se
   abre en el modal; si está en cola de revisión muestra las acciones de cambio de estado y
   el comprobante; si no, solo el detalle. Mantener los guards 409 anti-carrera existentes.
3) Eliminar la página vieja /pagos/revision (dejando el redirect) y actualizar el sidebar:
   una sola entrada "Pagos" visible para todos los roles involucrados.
4) Revisar consumidores: notificaciones internas con links a /pagos/revision, y el punto
   REV-2 pendiente del plan (botón de recordatorio) que ahora se implementa sobre la página
   unificada.
No cambiar la lógica de aprobar/rechazar ni la propagación por concept (RPC approve_payment).
Tests: acceso por rol (revision_pagos ve todos los pagos, miembro común no), redirect, y
que las acciones de revisión sigan funcionando desde la página unificada.
```

### [x] BEC-1 · Cupón/beca en el modal de pagos + correo al asignar cupón — HECHO 2026-07-28 (migración 20260728180000 aplicada: scholarships.email_sent_at/email_sent_to + plantilla `cupon_asignado` en BD. 1) Panel "Aplicar beca / cupón" en el modal de la cola (pagos pendiente/en_revision, roles becas|revision_pagos con edit): precarga la beca asignada vía GET /api/payments/[id]/scholarship-options y acepta código; POST /api/payments/[id]/apply-scholarship reusa resolveScholarshipForApplication + consumeScholarship (guard atómico, 409) con UPDATE optimista del pago y reversión si el cupón pierde la carrera; reglas puras en `scholarship-payment-rules.ts` (elegibilidad por concepto matricula/evento, moneda de becas fijas INT-2). 2) Botón "Enviar por correo"/"Reenviar" en cupones genéricos de /finanzas/becas con MemberCombobox; POST /api/scholarships/[id]/send-email registra email_sent_at/to y la UI avisa antes de reenviar; la aprobación de solicitudes ahora también registra su envío automático de beca_aprobada — decisión de alcance: para becas asignadas NO hay botón aparte porque el correo ya sale automático al aprobar. 3) Beca 100%: monto→0, method='scholarship', review_status='en_revision' y approve_payment (mismo RPC de revisión) — el pago queda aprobado sin comprobante y libera la matrícula/inscripción; parcial queda pendiente por el resto. BONUS: BECA_YA_USADA ahora mapea a 409 (antes caía como 500 en matrícula/eventos). 15 tests nuevos)
Archivos: modal de pagos de REV-3 (`src/app/(admin)/finanzas/pagos/*`), `src/lib/supabase/queries/scholarships.ts`, `src/app/api/scholarships/*`, `src/app/(admin)/finanzas/becas/*`, plantillas de email (`beca_aprobada`, `beca_aprobada_parcial`), `src/lib/supabase/queries/payments.ts`
Depende de: REV-3 (el modal unificado de pagos)

```
Tres mejoras al flujo de becas/cupones sobre pagos:
1) Aplicar cupón o beca desde el modal de pagos: en el modal unificado (REV-3), para un pago
   pendiente, agregar la opción de aplicar una beca asignada del miembro o un código de cupón
   (el canje ya existe para matrícula: /api/scholarships/applicable y el flujo de
   scholarship_redemptions — reutilizalo, incluyendo el guard atómico active→used con 409 si
   ya se usó). Al aplicar, recalcular el monto del pago con el descuento y registrar la
   redención vinculada al pago.
2) Botón "Enviar cupón por correo": cuando finanzas crea un cupón/beca y lo asigna a una
   persona (becas asignadas, y cupones genéricos si se asignan a alguien), agregar en
   /finanzas/becas un botón para mandarle un correo con el código y el mensaje de que la
   beca fue otorgada. Reutilizar las plantillas existentes (beca_aprobada /
   beca_aprobada_parcial, BD con fallback hardcodeado) o crear una hermana "cupon_asignado"
   siguiendo ese mismo patrón. Registrar cuándo se envió (no reenviar sin confirmación) y
   respetar el límite diario de email.
3) Beca completa (100%): al aplicarla en el modal, el monto del pago baja a 0 (o al
   equivalente si la beca es por monto fijo que cubre todo) y el sistema debe confirmar
   explícitamente que NO se necesita comprobante de pago: el pago queda aprobado/pagado sin
   pasar por la cola de revisión, el objeto pagado (matrícula, inscripción) se libera igual
   que con approve_payment, y la UI lo dice claro ("Cubierto por beca — no requiere
   comprobante"). Para becas parciales, el pago queda pendiente por el monto restante y el
   flujo de comprobante sigue normal.
Permisos: aplicar beca/cupón en el modal con los roles de becas/finanzas/revisión según
requireModuleView('becas') + revisión; enviar correo solo becas/finanzas/direccion.
Tests: beca completa → pago 0 aprobado sin comprobante; parcial → pendiente por el resto;
cupón ya usado → 409; correo se registra y no duplica.
```

### [x] REU-1 · Reubicación: días y zonas con selección múltiple — HECHO 2026-07-29 (migración 20260729100000 aplicada: study_requests.proposed_zones text[]; el form de reubicación pregunta día(s) libres (pills, sin el tope de 2 del interés), horario single (consistente con interés) y zona(s) múltiples desde activeSedes + "Cualquiera"; API valida/sanea server-side (dedupe, tope 10, 60 chars); las solicitudes VIEJAS con una zona en proposed_location se leen igual vía regla pura `request-prefs.ts` (requestZones con fallback); la cola muestra días/horario/zonas también para reubicaciones; el RelocationResolveGroupPicker ORDENA los grupos candidatos por coincidencia (zona pedida pesa 2, día 1 — relocationGroupScore mapea nombres de día → iniciales L/M/X/J/V del grupo y resuelve el CODE de sede a nombre con sedeLabel); 9 tests de las reglas puras. Solo flujo relocation — interés intacto)
Archivos: form de solicitar reubicación (flujo relocation en `src/components/studies/StudyRequestActions.tsx` o componente hermano), `src/app/api/studies/requests/route.ts`, esquema de `study_requests`

```
En el form de "Solicitar reubicación" (solicitudes tipo relocation de study_requests), debe
preguntarse qué días y qué zonas le sirven a la persona, ambos con SELECCIÓN MÚLTIPLE
(hoy el patrón del form de interés permite hasta 2 días y una sola zona). Cambios:
1) UI: checkboxes o multi-select de días de la semana y de zonas (zonas desde el catálogo
   activo vía useSedes, más "cualquiera"). Horario (mañana/tarde/noche) puede quedar como
   está o hacerse múltiple también — mantenete consistente con el form de interés.
2) Persistencia: revisar cómo guarda study_requests los días/zona (¿columnas simples o
   jsonb?); si es campo simple, migrar a array/jsonb sin romper las solicitudes existentes
   (las viejas con un solo valor se leen igual).
3) La cola de gestión de reubicaciones y el RelocationResolveGroupPicker (EST-7) deben
   mostrar los múltiples días/zonas y, idealmente, usar esas preferencias para ordenar o
   filtrar los grupos candidatos.
Coordinar con EST-6/EST-7: esto aplica SOLO al flujo relocation, que mantiene su gestión.
Tests del guardado múltiple y de lectura de solicitudes viejas.
```

### [x] PRE-7 · Prematrimonial: validación de género de la pareja + mensaje claro de documento — HECHO 2026-07-29 (1) Género: regla pura `premat-gender.ts` (5 tests) — M+F ok; mismo género → 409 `mismo_genero` con el mensaje de "error de selección" de la spec; género vacío o fuera de M/F → 409 `genero_faltante` que pide completar el perfil (nunca se trata como mismo género). Validado en spouse-search (devuelve FLAGS same_gender/gender_missing, nunca el género — privacidad), en el paso 1 del wizard (aviso + "Continuar" deshabilitado) y server-side en el POST. (2) Documento: la pantalla de bloqueo por cédula ahora captura el documento AHÍ MISMO (selector de tipo INT-1 + número, validación por tipo client-side) y lo guarda vía PATCH /api/members/[id] — que ya normaliza, valida por tipo y dedupea con 409 si pertenece a otro miembro; funciona en autoservicio (self) y onBehalf (staff). Mensaje según spec)
Archivos: `src/app/(admin)/matricula/prematrimonial/page.tsx` (wizard, paso 2), `src/app/api/studies/prematrimonial/route.ts`, `src/app/api/studies/prematrimonial/spouse-search/route.ts`

```
Dos validaciones en el wizard prematrimonial:
1) Género de la pareja: solo se realizan matrimonios entre hombre y mujer. Si la pareja
   seleccionada tiene el mismo género que quien se matricula (members.gender), bloquear con
   una validación clara pensada para el caso de ERROR de selección: mensaje tipo "La persona
   seleccionada tiene el mismo género registrado. Verificá que seleccionaste a la persona
   correcta; si el género en el perfil está incorrecto, contactá al equipo para corregirlo."
   Validar en ambos lados: UI (paso 2, al confirmar la pareja) y server-side en el POST de
   /api/studies/prematrimonial (409 con code, patrón del repo). Contemplar el caso de género
   vacío en alguno de los dos perfiles: en ese caso pedir que se complete el dato en el
   perfil antes de continuar, no bloquear como "mismo género".
   Para spouse-search: evaluar si conviene devolver el gender (o un flag same_gender) en la
   respuesta SIN exponer más datos personales de los necesarios.
2) Documento de identidad al matricular a nombre de otra persona: la regla existente exige
   que ambos tengan cédula registrada. Cuando quien está haciendo la matrícula es staff (o
   un familiar) y la persona matriculada aún no tiene cédula, el form debe pedir que se
   rellene ahí mismo, con mensaje CLARO: "Esta persona no tiene documento registrado. Ingresá
   su cédula o número de documento de identidad para continuar." — y guardar el documento en
   el perfil (normalizado, con el dedup 409 existente si ya pertenece a otro miembro).
   Nota: cuando se implemente INT-1 (documento por tipo), este campo hereda el selector de
   tipo; mientras tanto el texto ya habla de "cédula o número de documento".
Tests: mismo género → 409; género vacío → pide completar perfil; matrícula a tercero sin
cédula → pide documento y lo guarda con dedup.
```

### Feedback 2026-07-28

### [x] PAG-4 · Página de mis pagos: responsive, renombrar y link al historial — HECHO 2026-07-29 (1) full-width responsive: grid 2/3 pagos + 1/3 becas en desktop, apilado en móvil; las filas de MemberPaymentsList se apilan en pantallas angostas. (2) Renombrada a "Pagos pendientes" (título, pageTitles del layout y entrada del menú) — la ruta /mis-pagos NO cambió, así que los deep links de notificaciones siguen intactos sin redirect. (3) "Ver historial de pagos" → /miembros/[id]?tab=participacion&open=pagos; el perfil soporta ?open=<sección> vía regla pura `profile-deeplink.ts` con whitelist (3 tests) — abre el acordeón "Pagos y cobros" al cargar; el link respeta la pestaña de familia seleccionada (scope self/familia del guard existente). (4) Menú: debajo de Matrícula, visible para cualquier sesión. (5) Sección "Mis becas": endpoint nuevo GET /api/members/[id]/scholarships (guard self/familia/staff, espejo del de pagos) que lista solo becas ASIGNADAS (kind asignada) con concepto, descuento y estado; hint de beca activa ("se aplica automáticamente al pagar X"). EXTRA de la sesión: /estudios/plan (currículo) reabierto para cualquier sesión (decisión 2026-07-29 — el ModuleGuard de SEC-1 lo había cerrado y matrícula linkea ahí) + entrada "Plan de Estudios" en el submenú del dirigente.
Archivos: página de mis pagos (`/mis-pagos`, creada en PAG-1), sidebar/nav, `src/app/(admin)/miembros/[id]/_components/MemberParticipationTab.tsx` (acordeón de pagos)
Depende de: PAG-1

```
Cuatro ajustes a la página de mis pagos (la de PAG-1, visible para todos los miembros):
1) Layout full width y responsive: hoy no aprovecha el ancho ni se adapta bien a celular.
   Revisala en móvil (la mayoría de miembros entra desde el teléfono): tabla → cards en
   pantallas angostas, siguiendo el patrón responsive que ya usan otras páginas del admin.
2) Renombrarla a "Pagos pendientes" (título de la página, breadcrumb y entrada del menú).
   Mantener la ruta actual con redirect si se cambia el path, para no romper los deep links
   de las notificaciones de PAG-1/PAG-3.
3) Agregar un link "Ver historial de pagos" que lleve al historial que vive en el perfil
   del miembro, tab Participación, con el acordeón de pagos ABIERTO directamente: agregá
   soporte de query param en el perfil (p. ej. /miembros/[id]?tab=participacion&open=pagos)
   que seleccione el tab y expanda ese acordeón al cargar. Para el miembro común el link va
   a su propio perfil (respetando el scope own existente).
4) Posición en el menú: debajo de "Matrícula", visible para cualquier sesión (rol miembro
   incluido).
5) Sección "Mis becas" (agregado 2026-07-28): dentro de la misma página, una sección donde
   el miembro vea las becas y cupones ASIGNADOS a él: nombre/concepto, monto o porcentaje,
   estado (activa / usada / revocada) y a qué se aplica. Fuente: scholarships del miembro
   (kind asignada; las genéricas con código no se listan). Solo lectura y solo las propias
   (mismo scope self/familia del resto de la página). Si tiene una beca activa aplicable,
   un hint que la conecte con el pago pendiente correspondiente ("Tenés una beca activa
   para X — se aplica al pagar").
Tests: el deep link del acordeón, el acceso self-only y que solo listen becas propias.
```

### [x] EVE-3 · Página de eventos: renombrar "Resumen" a "Calendario" + permisos de botones — HECHO 2026-07-29 (1) el "Resumen" era el label default del primer sub-ítem del sidebar → Eventos usa summaryLabel "Calendario" (los tabs internos ya se llamaban Calendario/Lista/Cuadrícula). (2) Visibilidad para todos ya estaba (sidebar siempre + excepción del ModuleGuard para /eventos raíz; la página tiene vista de solo-inscripción para no-gestores) — verificado. (3) Botones por regla pura `page-actions.ts` (3 tests): "Compartir calendario" SOLO admin+comunicaciones (dirección quedó FUERA — antes la tenía) y /eventos/embed gana gate propio con AccessDenied (antes cualquier rol con módulo eventos entraba por URL); check-in usa EVENT_CHECKIN_ROLES (incluye direccion a propósito — es la constante que ya exigen los endpoints de check-in). El API de check-in ya exigía esos roles; compartir no tiene API (el embed construye el link del calendario público).
Archivos: `src/app/(admin)/eventos/page.tsx`, `src/lib/auth/roles.ts` (visibilidad del módulo), sidebar

```
Tres cambios en la página de eventos del admin (/eventos):
1) La vista/tab que se llama "Resumen" pasa a llamarse "Calendario" (título, tab y cualquier
   referencia en el menú).
2) Visibilidad: la página debe ser visible para TODOS los usuarios autenticados, incluido el
   rol miembro (ya funciona como vista de inscripción para no-gestores — verificá que el
   módulo eventos tenga view para cualquier sesión en roles.ts y que aparezca en el sidebar
   del miembro; cada bloque interno respeta su permiso).
3) Permisos de botones dentro de la página:
   - Botón "Compartir calendario" (el del embed/link público): visible SOLO para admin y
     comunicaciones.
   - Botón de check-in: visible SOLO para los roles de check-in (encargado_eventos y los que
     define EVENT_CHECKIN_ROLES — mantené admin, que siempre pasa; si direccion está en esa
     constante, decidí con el patrón actual y anotalo).
   Los gates son de UI Y de API: verificá que los endpoints detrás de cada botón ya exijan
   esos roles (el de check-in ya usa EVENT_CHECKIN_ROLES; el de compartir/embed revisalo).
Tests: página visible como miembro sin botones de gestión; botones visibles según rol.
```

### [x] SEC-1 · Fugas de permisos para el rol miembro — HECHO 2026-07-29, actualizado mismo día con la spec nueva: el rol miembro NO tiene dashboard — /dashboard lo redirige a su PERFIL (cubre post-login y raíz en un solo punto), el ítem del sidebar pasa a llamarse "Mi perfil", y se eliminó la vista simplificada (eventos y grupos viven en el perfil y /eventos); el punto 6 (ocultar /estudios, /estudios/solicitudes y resúmenes de gestión al miembro) ya quedaba cubierto por el ModuleGuard de la primera pasada. (Detalle de la primera pasada: auditado con 2 barridos + matriz automatizada. (1) DASHBOARD: /api/dashboard recorta el payload por módulo con beyondOwn (403 si nada aplica) y /api/dashboard/activity exige un módulo administrativo — antes cualquier sesión recibía KPIs de finanzas y audit_log; la vista de miembro ya no dispara esos fetches y sus paneles usan datos reales (eventos del endpoint PÚBLICO — antes 403 y bloque siempre vacío — y "Mis grupos" del propio perfil con deep link read-only). (2) ESTUDIOS: raíz del problema = NINGÚN endpoint honraba scope own; nuevo `studies-scope.ts` (puro, 9 tests): lista de grupos filtrada a leader/co-leader para dirigente (todas las variantes: paginada, ?all=1, ?include=enrollments, y la rama sin filtros que se escapaba), detalle+sessions con scope por relación (`viewer_scope`: admin/leader/member/none — miembro inscrito recibe SOLO su inscripción, sin roster ajeno), beyondOwn en leaders (evaluaciones+is_donor), analysis y prematrimonial; ModuleGuard: dirigente solo raíz/grupos/detalle-asistencia, miembro solo detalle de grupo; sidebar acorde. (3) Deep link "Ver grupo": el del perfil ya era correcto; el del dashboard era MOCK — bloque del dirigente reescrito con sus grupos reales y links al detalle; detalle de grupo con modo read-only (sin añadir/desinscribir/perfiles/WhatsApp editable). (4) SERVIDORES: rol miembro ya estaba bloqueado (module servidores); EXTRA hallado y cerrado: lider_comite recibía TODOS los comités con contactos → /api/servers/committees filtra a sus comités liderados (helper `moduleScope` en roles.ts). (5) MIEMBROS: ya estaba bien para miembro; EXTRA cerrado: lider_comite (scope committee) podía listar/EXPORTAR el padrón completo → GET/export/counts/ids exigen scope 'all' + sidebar/ModuleGuard acordes (a su gente la ve en /servidores). MATRIZ: scripts/access-matrix.ts (login real con seed users por rol contra BASE_URL) — 14 endpoints × 5 roles + 2 checks de contenido: verde. Notas: usuario seed estudios@ tenía 3 roles acumulados (limpiado a coordinador_estudios); pendiente conocido: detalle de perfil sigue accesible a lider_comite por URL (scope committee granular = cambio mayor, documentado); páginas de asistencia POST del dirigente siguen coordinador-only como antes — no se otorgaron permisos nuevos))
Archivos: `src/app/(admin)/dashboard/*` + `/api/dashboard`, `src/app/(admin)/estudios/*`, `src/app/(admin)/servidores/*`, `src/app/(admin)/miembros/page.tsx`, `src/lib/auth/roles.ts`, sidebar

```
Probando el sistema logueado como MIEMBRO (sin roles) se encontraron fugas de permisos.
Arreglalas verificando en cada caso el gate en TRES capas: sidebar (no mostrar), página
(redirect/404 al entrar por URL) y API (requireRoles/requireModuleView) — recordá que el
middleware excluye /api, así que cada endpoint debe defenderse solo.

1) DASHBOARD: el rol miembro NO tiene dashboard (decisión actualizada 2026-07-28: se
   elimina para miembros, no se recorta). La página default al loguearse como miembro es
   su PERFIL: cambiar el redirect post-login y el destino raíz según rol (roles de gestión
   siguen aterrizando en /dashboard). /dashboard con rol miembro → redirect al perfil.
   Igual verificá que /api/dashboard y /api/dashboard/activity no devuelvan datos de
   módulos que el rol no ve (defensa del API aunque la UI ya no exista para miembros).
   Los eventos de hoy y "mis grupos" que veía en el dashboard viven en el perfil y en
   /eventos (EVE-3), no se pierden.
2) ESTUDIOS como dirigente: un dirigente solo debe ver SUS grupos (scope own, permiso
   view/edit de sus grupos según ROLES). Hoy puede ver todo el módulo de estudios,
   incluyendo eliminar estudios y páginas internas (plan, bloques, dirigentes, análisis,
   solicitudes, folletos). Auditá TODAS las páginas internas de /estudios/* y sus APIs:
   dirigente accede solo a sus grupos (asistencia, sesiones, cierre de los suyos); el
   resto exige STUDY_ADMIN_ROLES como corresponde. El rol miembro no ve nada de /estudios
   de gestión.
3) "Mis grupos" (dashboard/perfil): el link "Ver grupo" abre la página general de grupos
   en vez del grupo específico. Debe deep-linkear al grupo referenciado
   (/estudios/grupos/[id]) en modo SOLO LECTURA para el miembro: puede VER su grupo
   (horario, dirigente, sesiones), no editar nada. Verificá que la página de detalle de
   grupo tenga vista read-only gateada para miembros del grupo (scope own vía su
   enrollment) sin exponer acciones ni datos de otros estudiantes más allá de lo necesario.
4) SERVIDORES: (a) las solicitudes (/servidores/vacantes/solicitudes, aplicaciones,
   position-requests) NO deben ser visibles para el rol miembro — ni páginas ni APIs.
   (b) La página de resumen de servidores debe mostrar SOLO los comités a los que el
   miembro pertenece; si el miembro no es servidor de ningún comité, NO tiene acceso a esa
   página (ni entrada en el sidebar).
5) MIEMBROS: la página /miembros (padrón) no debe estar disponible para el rol miembro
   (su propio perfil se accede por otra vía). Verificá página + APIs de listado/búsqueda
   (/api/members con beyondOwn ya existe — confirmá que el gate funcione y que el sidebar
   no muestre la entrada).
6) PÁGINAS ADICIONALES ocultas para el rol miembro (agregado 2026-07-28): la página de
   estudios bíblicos (/estudios y su resumen), la página de solicitudes (/estudios/
   solicitudes) y cualquier página de "resumen" de módulos de gestión. El miembro
   interactúa con estudios SOLO vía /matricula, su perfil (historial, mis grupos) y el
   detalle read-only de su grupo (punto 3). Mismas tres capas: sidebar + página + API.
Después de arreglar, hacé una pasada de verificación general: creá un test (o script) de
"matriz de acceso" que recorra las rutas principales con un usuario de cada rol clave
(miembro, dirigente, lider_comite) y confirme qué ve y qué recibe 403 — para que esto no
se vuelva a colar. Correr tsc, lint, vitest.
```

### [x] COM-2 · Tres plantillas de invitación a estudios — HECHO 2026-07-30 (seed `scripts/seed-invitation-templates.mjs`, idempotente): las 3 en message_templates, categoría `inscripcion`, is_system=false (editables/borrables desde /comunicaciones/plantillas). Guardan SOLO el cuerpo — renderEmail pone header navy + logo propio + footer + pie de baja; sin URLs de CCB. CTA coral al link de matrícula (editable) y bloque "¿Primera vez que entrás al sistema?" con los 4 pasos de AUTH-2, SIN links que expiren (solo el link al sistema; el enlace de crear contraseña lo pide cada persona). Cuerpos con placeholders "(editá…)" para fechas/horarios/zona/requisitos y reutilizarlas cada ciclo; las de seleccionados llevan la caja navy con la FECHA LÍMITE de matrícula. Fragmento reutilizable: el editor guarda HTML plano y no soporta includes, así que la fuente única del bloque es la constante FIRST_TIME_BLOCK del seed — re-correrlo actualiza las tres de una vez (documentado en el propio HTML). Verificadas con el pipeline real (applyVars + renderEmail): {nombre} resuelve, CTA a /matricula, bloque presente, sin CCB y sin tokens. PENDIENTE OPERATIVO: envío de prueba por SES (a confirmar con TI antes de mandar un correo real).
Archivos: `message_templates`, `/comunicaciones/plantillas`, referencia de diseño: `docs/referencias/theos_email_campa_servidores_preventa.html`

```
Crear tres plantillas de correo en message_templates (visibles en /comunicaciones/plantillas,
no is_system, editables por quien arma el broadcast). Las tres comparten estructura e
identidad visual de Theos (header navy #161440 con logo, CTA coral #EF5554, footer estándar;
ver docs/referencias/theos_email_campa_servidores_preventa.html como referencia de estilo,
pero SIN las URLs de CCB — logo desde asset propio y links al sistema nuevo):
1) "Invitación a Nivel 1 / Capacitaciones" — invitación abierta a inscribirse.
2) "Invitación seleccionados CDEB" — para quienes fueron elegidos tras la preinscripción
   (ver EST-10): tono de "fuiste seleccionado", con fecha límite de matrícula.
3) "Invitación seleccionados Hermenéutica" — misma idea, para HER.
Las tres llevan:
- CTA principal al link de la página de matrícula (editable).
- Un bloque "¿Primera vez que entrás al sistema?" con el paso a paso corto de AUTH-2:
  entrá al sistema → tocá "Creá tu contraseña" con este mismo correo → abrí el enlace que
  te llega → definí tu contraseña y matriculate. Sin links que expiren en el correo.
- Cuerpo editable (fechas, horarios, grupo, requisitos) para reutilizarlas cada ciclo.
Hacer el bloque de "primera vez" un fragmento reutilizable si el editor lo permite, para no
mantener el mismo texto en tres lugares. Probar el render en el preview y con envío de
prueba (SES).
```

### [x] EST-10 · Flujo de preinscripción CDEB (convocatoria → formulario → selección → invitación) — HECHO 2026-07-30 (compuesto sobre lo que ya existía, sin módulo nuevo. FORMULARIO: `scripts/seed-cdeb-preinscription-form.mjs` crea la preinscripción con el builder (24 campos: 6 bloques informativos con los textos exactos del brief, los 9 compromisos como checkbox obligatorio, la declaración doctrinal de 7 puntos + Sí/No, las 7 abiertas obligatorias, disponibilidad, la pregunta de grupo con OPCIONES DINÁMICAS y comentarios). REUTILIZABLE: título y code del plan salen de argv — `node scripts/seed-cdeb-preinscription-form.mjs "Preinscripción Hermenéutica" HER`; nada de "CDEB Madrid 2026" hardcodeado. Tipos nuevos del builder: `info` (bloque de texto sin input) y `options_source: 'study_groups_open'` (el servidor resuelve los grupos en matrícula del plan al abrir el formulario, más "No me sirve") — migración 20260730100000. Prellenado: `personal_data` trae nombre/teléfono/correo del perfil; `allow_multiple_responses=false` da la pantalla de "ya respondiste". SELECCIÓN: migración 20260730120000 `form_response_reviews` (una por respuesta, status pendiente/aprobado/lista_espera/rechazado, notas internas, trazas de invitación) con RLS y CERO policies. Módulo puro `src/lib/forms/selection-rules.ts` (16 tests): gate `SELECTION_REVIEW_ROLES`, reconocimiento del formulario por el campo de opciones dinámicas (de ahí sale el plan), filtros por doctrina/disponibilidad/grupo/nombre y las reglas de quién se puede invitar. Pantalla `/formularios/[id]/seleccion`: resumen, filtros, decisión por persona, notas internas, respuestas completas en modal y la recomendación de EST-9 al lado de cada uno. INVITACIÓN: botón que crea `study_invitations` (desbloquea el plan invitation-only) y manda la plantilla de COM-2 como broadcast TRANSACCIONAL (queda en Comunicaciones con su cola); marca `invited_at` para no repetir; los rechazados y los de lista de espera no reciben nada. CONVOCATORIA: botón que manda el link del formulario a quienes tienen recomendación ENVIADA y positiva de EST-9 y todavía no se preinscribieron, con la plantilla nueva "Convocatoria a preinscripción de dirigentes" — el sistema inyecta el link donde diga `{link_formulario}`. VISIBILIDAD: todo (GET incluido) gateado a coordinador_dirigentes/coordinador_estudios/admin; las respuestas viajan SOLO por ese endpoint, no por `/api/forms/[id]/responses`.)
Archivos: módulo de formularios (`forms`, `form_fields`, `form_responses`, `form_response_values`), `study_invitations`, cola del comité de dirigentes, `message_templates` (COM-2)
Depende de: COM-2. Relacionado: EST-5 (CDEB invitation-only), EST-9 (recomendaciones como fuente de audiencia)

```
Implementar el flujo completo de preinscripción a CDEB dentro del sistema (hoy vive fuera,
en un formulario de CCB). IMPORTANTE: no construir un módulo nuevo — componé las piezas
existentes: el módulo de FORMULARIOS (forms/form_fields/form_responses, con builder de
campos configurables) para el formulario, y STUDY_INVITATIONS (planes invitation-only) para
la invitación final. Lo único nuevo es el puente de revisión/selección.

Etapas:
1) CONVOCATORIA: se elige una audiencia (lista de miembros; idealmente pre-cargada con las
   recomendaciones de dirigentes de EST-9 que estén enviadas/aprobadas) y se les manda un
   correo con el link al formulario de preinscripción, usando el flujo de broadcasts.
2) FORMULARIO DE PREINSCRIPCIÓN construido con el builder. La persona ya está autenticada:
   nombre y teléfono se PRELLENAN del perfil, no se re-escriben. Contenido:
   - Encabezado de contexto: alegría por la preinscripción, que se evaluarán las respuestas,
     que si es aprobado se le enviará la invitación al curso, e invitación a orar antes de
     responder.
   - "Compromisos del dirigente": 9 checkboxes — comunicación constante con Dios en oración
     y lectura · preparar el estudio semanalmente con antelación · puntualidad en los
     estudios · testimonio ejemplar · escuchar y orar por los estudiantes aun fuera del
     estudio · asistir a las actividades de Theos e invitar al estudio · aportar
     económicamente a la misión de Theos Place · asistir a las charlas mínimo 2 veces al
     mes · usar las redes sociales sabiamente, dando el ejemplo.
   - Declaración Doctrinal de Theos (los 7 puntos completos: Biblia · relación íntima y
     pecado · salvación por gracia como regalo de Dios · Padre, Hijo y Espíritu Santo ·
     madurez espiritual · unión de los creyentes / cuerpo de Cristo · adoración y oración
     solo a Dios) + "¿Estás de acuerdo con la Declaración doctrinal de Theos?" Sí/No.
   - Abiertas obligatorias: cómo describirías tu relación con Dios · por qué querés ser
     dirigente y qué te motiva · si considerás la Biblia autoridad máxima, completa y veraz,
     y por qué · cómo explicarías el plan de salvación a alguien nuevo (con referencias
     bíblicas) · posición sobre relaciones sexuales fuera del matrimonio · posición sobre
     identidad de género · si tu testimonio inspira a otros y qué debés trabajar (con el
     texto de contexto de 1 Cor 11:1 y la invitación a contar luchas con pecado recurrente
     para poder acompañar el proceso).
   - "¿Tenés el tiempo para capacitarte (aprox. 2 meses) y tener a cargo un grupo de estudio
     con compromiso de 1 año luego de la capacitación?" Sí/No.
   - "¿Considerás que tenés el compromiso y el tiempo necesarios para prepararte y dirigir?"
     con el texto de contexto: modalidad presencial, posible pasantía de al menos 8 semanas,
     preparación semanal y seguimiento a estudiantes.
   - "¿Si sos seleccionado, cuál grupo te serviría?" — opciones DINÁMICAS desde los grupos
     CDEB abiertos (dirigente, dirección, día y hora), más "No me sirve".
   - Cierre amable ("si no te considerás listo, no es la última oportunidad — contanos en
     comentarios y más adelante te tomamos en cuenta de nuevo") + campo de comentarios.
   Si el builder actual NO soporta algún tipo de campo (bloque de texto largo informativo,
   grupo de checkboxes, opciones dinámicas desde grupos), decímelo ANTES de improvisar.
3) REVISIÓN Y SELECCIÓN (lo nuevo): pantalla donde el comité vea las respuestas, las compare
   y marque aprobado / rechazado / en espera por persona, con notas internas. Filtros:
   aceptó la declaración doctrinal, disponibilidad, grupo elegido. Si la persona tiene
   recomendación de EST-9, mostrarla al lado de su respuesta.
4) INVITACIÓN: botón que, para los aprobados, genere la invitación en study_invitations (lo
   que desbloquea el plan invitation-only) y dispare el correo "Invitación seleccionados
   CDEB" (COM-2) con link a matrícula. Rechazados/en espera no reciben nada automático.
Permisos: convocar, revisar y seleccionar → coordinador_dirigentes, coordinador_estudios,
admin. Las respuestas traen información personal sensible (luchas con pecado, posiciones
doctrinales): NO visibles para otros roles, mismo criterio de EST-9.
Reutilizable: debe servir para futuras convocatorias y para el mismo esquema en otro estudio
(p. ej. Hermenéutica) — no hardcodear "CDEB Madrid 2026".
Tests: creación de invitación desde la selección, gate de visibilidad, prellenado del perfil.
```

### [x] EST-9 · Cierre especial D3/Panorama: recomendación a CDEB por estudiante — HECHO 2026-07-29 (migración 20260729160000 aplicada: tabla `cdeb_recommendations` (member+group UNIQUE para el upsert del guardado parcial, enrollment_id, filled_by, status borrador/enviada, convicciones en jsonb, 4 escalas, textos y recomendación final) con RLS y CERO policies = deny-by-default, solo service role. Módulo puro `cdeb-recommendation.ts` (17 tests) con los textos exactos: encabezado de contexto, fecha prellenada con la del cierre + hint, convicciones POR EXCEPCIÓN (los 5 temas arrancan en "convicción firme"; marcar dudas/contraria abre su explicación OBLIGATORIA), escalas 1-5 como botones en fila con la etiqueta del nivel visible, opción X "sin información suficiente" SOLO en Panorama y solo para testimonio/pasión, textos libres obligatorios que aceptan "NA" (el de compromiso es el único opcional), recomendación final de 4 opciones. Botón "Recomendar para CDEB" POR ESTUDIANTE (solo aprobados) en la lista de cierre — el form se abre solo al tocarlo; muestra badge de borrador/enviada. NO bloquea el cierre: el borrador no se valida (ni en el cliente ni en el server) y se puede completar después; el envío valida en ambos lados. En DIS3/PAN el bloque simple de EST-3 SE OCULTA (nunca los dos juntos). VISIBILIDAD: `CDEB_REC_VIEW_ROLES` = coordinador_dirigentes/coordinador_estudios/admin — NI el miembro, NI el dirigente que la escribió, NI dirección; panel de solo lectura en la ficha Administrativa del perfil (con 403 no se pinta) y GET de la cola del comité que además marca si la persona YA tiene invitación activa a CDEB (conexión con el flujo invitation-only de EST-5). El dirigente del grupo SÍ puede escribir/editar su borrador (gate por leader/co_leader del grupo).)
Archivos: `src/app/(admin)/estudios/grupos/[id]/cierre/page.tsx`, `src/app/api/studies/groups/[id]/close/route.ts`, migración (tabla nueva), `src/lib/studies/close-recommendations.ts` (gate de EST-3), cola de dirigentes/CDEB

```
Cierre especial para grupos de Discípulos 3 (DIS3) y Panorama (PAN): al cerrar, el dirigente
puede recomendar estudiantes para capacitarse en CDEB (Cómo Dar Estudios de Biblia).
NO es para todos los estudiantes: es un botón "Recomendar para CDEB" POR ESTUDIANTE en la
lista de cierre; solo al tocarlo se abre el formulario de evaluación.

Principio rector: el dirigente llena esto en el celular, al final de un cierre. Que sea
CORTO. Aplicá estas simplificaciones (decididas con la usuaria):
- Prellenar lo que el sistema ya sabe: fecha de finalización = fecha de cierre del grupo
  (editable, con el texto "Si no lo has terminado, ingresá la fecha prevista"); dirigente y
  estudiante vienen del contexto, no se preguntan.
- Convicciones POR EXCEPCIÓN: los 5 temas (sexualidad y relaciones antes del matrimonio,
  mayordomía, autoridad de la Biblia, salvación por gracia, identidad de género) arrancan
  todos en "convicción firme" con la instrucción "Marcá solo los temas donde viste dudas o
  postura contraria". Al marcar "tiene dudas" o "postura contraria" en un tema, se abre su
  campo de explicación (obligatorio solo en ese caso). Sin observaciones = cero toques.
- Escalas 1-5 como botones en fila (no dropdown), con la etiqueta del nivel visible al
  seleccionar. Aplica a: Testimonio, Pasión por enseñar/dar a conocer a Jesús, Conocimiento
  bíblico, Expresión verbal. Testimonio y Pasión tienen además la opción "X - Sin
  información suficiente", disponible SOLO en grupos de Panorama (no en DIS3).
- Textos libres: TODOS obligatorios (decisión confirmada) — "Describa brevemente el
  testimonio del estudiante" (acepta "NA" si no lo compartió), "¿Le ha visto compartir su
  fe o invitar a alguien por iniciativa propia? Describa un ejemplo" (acepta "NA"),
  "Ejemplo o comentario sobre cómo se expresa" y "Comentarios adicionales para el comité de
  dirigentes". El único opcional es "Comentario adicional sobre su compromiso", que en el
  form original ya viene marcado como opcional.
- Recomendación final (obligatoria, una de cuatro): Sí, sin reservas · Sí, pero debería
  llevar otro estudio primero · Sí, con reservas (ver comentarios) · No lo recomiendo.
- Encabezado del form con el texto de contexto: que recomendar es una responsabilidad, que
  se ore antes, y que recomendar no asegura la invitación al curso porque se evalúan otros
  aspectos.

Implementación:
- Migración: tabla nueva (p. ej. cdeb_recommendations) por estudiante, ligada a
  member_id + group_id + enrollment_id, con el dirigente que la llenó, fecha, todos los
  campos anteriores y estado (borrador / enviada).
- El botón/form solo aparece en grupos cuyo plan es DIS3 o PAN. Reutilizá el gate de nivel
  de src/lib/studies/close-recommendations.ts (EST-3) extendiéndolo, no dupliqués la lógica.
- NO bloquear el cierre: el grupo cierra aunque las recomendaciones queden en borrador; el
  dirigente puede completarlas después desde su grupo cerrado. Guardado parcial automático.
- Destino: las recomendaciones enviadas alimentan al comité de dirigentes y se conectan con
  el flujo de invitaciones a planes invitation-only, que es como se entra a CDEB (ver EST-5:
  CDEB pasa a etapa avanzada, solo por invitación).
- VISIBILIDAD (decisión confirmada): la recomendación queda guardada en el PERFIL de la
  persona evaluada, pero visible ÚNICAMENTE para coordinador_dirigentes,
  coordinador_estudios y admin. Nadie más — ni el propio miembro, ni el dirigente que la
  escribió una vez enviada, ni direccion, ni otros coordinadores. Es información sensible.
  Aplicá el gate en la sección del perfil Y en el API que la sirve (el guard del /api es
  obligatorio: el middleware no protege /api).
- Relación con lo existente (decisión confirmada): si el grupo es DIS3 o PAN, el bloque
  simple de "Recomendar para (oración/servicio/dirigente)" de EST-3 SE OCULTA y solo se
  muestra este flujo. En los demás grupos (N4+, capacitaciones) el bloque simple sigue
  igual. No se muestran los dos juntos nunca.
Tests: visibilidad solo en DIS3/PAN, opción X solo en Panorama, convicciones por excepción
(explicación obligatoria solo al marcar dudas/contraria), cierre no bloqueado por borradores.
```

### [x] PRE-8 · Cierre especial para estudios prematrimoniales (evaluación de la pareja) — HECHO 2026-07-29 (migración 20260729120000 aplicada: tabla `prematrimonial_evaluations` ligada a request_id (UNIQUE, una por pareja) + group_id, con RLS habilitado y CERO policies = deny-by-default para clientes con sesión, solo service role — a propósito: la policy premat_select deja que la pareja lea su propia SOLICITUD, así que la evaluación no podía vivir ahí. Catálogos con los TEXTOS EXACTOS de la spec + validación en módulo puro `premat-evaluation.ts` (10 tests: los 10 temas, 6 fortalezas, 3 planes, punto ciego exige descripción). Grupo PREMAT detectado por plan code; el form (`PrematCoupleEvaluation.tsx`) sale en el paso 1 del cierre, UNA evaluación por pareja (parejas desde /premat-pairs = solicitudes con resulting_group_id), y bloquea Continuar hasta completarlas; el POST de cierre las EXIGE server-side (400 `evaluacion_requerida`/`evaluacion_invalida`), ignora request_id ajenos y las guarda ANTES del cierre con upsert por pareja (un retry del cierre no duplica ni pierde la evaluación). Plan de acción != 'listos' ⇒ SEGUIMIENTO: flag `needs_follow_up` en la cola prematrimonial (badge ⚑) y panel de solo lectura en la ficha Administrativa del perfil. VISIBILIDAD: contenido solo para coordinador_estudios/direccion/admin (`PREMAT_EVAL_ROLES`) vía GET /api/studies/prematrimonial/evaluations — coordinador_dirigentes PUEDE cerrar el grupo pero NO ve la evaluación (con 403 el panel simplemente no se pinta) y el plan concreto en la cola también se recorta a esos roles (el flag booleano sí lo ve quien ve la cola). El cierre de grupos no PREMAT no cambió en nada)
Archivos: `src/app/(admin)/estudios/grupos/[id]/cierre/page.tsx` (flujo de cierre actual), `src/app/api/studies/groups/[id]/close/route.ts`, `prematrimonial_requests`, migración para la evaluación

```
Los grupos de estudios tipo prematrimonial necesitan un CIERRE ESPECIAL, distinto del cierre
regular: además del resultado por estudiante, los mentores llenan una evaluación por PAREJA.
Detectá los grupos prematrimoniales por su plan (el flujo prematrimonial ya existe:
prematrimonial_requests, grupos creados desde esa cola) y mostrá este form de evaluación en
el cierre, una por pareja del grupo. Campos exactos (respetar textos y opciones):

1) "¿Sienten que la pareja logró afianzar su compromiso mutuo y con Dios a lo largo del
   curso?" — opciones: Sí / En proceso / Requiere atención.
2) "¿Cuáles son las mayores fortalezas o áreas de mayor madurez que observaron en la
   pareja?" — selección múltiple + texto libre opcional:
   Comunicación y resolución de conflictos · Alineación en principios espirituales y
   relación con Dios · Claridad y acuerdo en finanzas y metas · Manejo del pasado y
   familias de origen · Visión compartida sobre la crianza de hijos y roles · Intimidad y
   expectativas sobre la sexualidad.
3) "¿En cuál(es) de los 10 temas del curso consideran que la pareja necesita profundizar o
   seguir trabajando?" — selección múltiple:
   Relación con Dios · Compromiso matrimonial · Roles en el hogar · Resolución de
   conflictos · Manejo del pasado · Finanzas / Manejo del dinero · Hijos y crianza ·
   Relación con padres y suegros · Sexualidad e intimidad · Metas y plan de vida juntos.
4) "Observaciones específicas sobre las áreas a trabajar" — texto libre.
5) "¿Detectaron algún punto ciego, desacuerdo grave o tema no resuelto que pudiera generar
   fricción en el matrimonio?" — Sí/No; si Sí, campo de descripción breve.
6) "Plan de acción y recomendaciones de mentores" — una de tres:
   Listos para el matrimonio (cierre regular) · Recomendado un tiempo de consejería/
   mentoría enfocada en un tema específico · Se sugiere pausar o posponer la fecha de boda
   para abordar temas críticos.
7) "Bendición final" — texto libre (palabras de bendición).

Implementación:
- Migración: tabla nueva (p. ej. prematrimonial_evaluations) ligada a la pareja
  (prematrimonial_request_id) y al grupo, con quién la llenó y cuándo. No metás esto en
  study_enrollments: la evaluación es por pareja, no por estudiante.
- El resultado del punto 6 puede condicionar el cierre: "listos" → cierre regular de ambos;
  las otras dos opciones cierran el grupo igual pero dejan la pareja marcada para
  seguimiento (visible en la cola prematrimonial y en el perfil de ambos).
- SENSIBLE: esta evaluación contiene información pastoral delicada (punto 5 especialmente).
  Visibilidad restringida: solo coordinador_estudios, direccion y admin — NO aparece en el
  perfil general del miembro ni la ve el propio miembro. Definí el gate explícito en el API.
- El cierre regular de grupos no prematrimoniales no cambia en nada.
Tests: evaluación requerida por pareja al cerrar grupo premat, gate de visibilidad, cierre
normal intacto para otros planes.
```

### [x] PRE-9 · Wizard prematrimonial: ceremonia ajustada + antecedentes + diagnóstico — HECHO 2026-07-29 (migración 20260729140000 aplicada: 7 columnas nuevas en prematrimonial_requests con CHECK en las cerradas; venue_defined/venue_outside_gam NO se borran — datos históricos — y las solicitudes nuevas las guardan en false. (1) Ceremonia: se quitó la pregunta del lugar; queda la fecha con el COPY EXACTO de la spec (CEREMONY_DATE_QUESTION) + el flag definida/aproximada y la validación de +6 meses de PRE-3. (2) Sección "Antecedentes de la pareja" al final del paso 2: tiempo de novios, primer matrimonio (No → detalle obligatorio), hijos (Sí → edades obligatorias) y convivencia — textos y opciones exactos. (3) Sección "Diagnóstico" al inicio del paso 4, antes del pago (texto libre opcional). Validación en módulo puro `premat-background.ts` (11 tests) usada por el wizard (gate del Continuar en el paso 2) Y por el POST (400 `antecedentes_invalidos`) — fuente única; el detalle no se arrastra si la respuesta cambia (no guarda texto huérfano). La cola muestra los antecedentes ("—" en solicitudes viejas). SENSIBLE: previous_marriage_notes y diagnostic_notes se RECORTAN a null en el API de la cola para roles fuera de PREMAT_EVAL_ROLES (mismo criterio que PRE-8; coordinador_dirigentes ve la cola pero no esos dos campos))
Archivos: `src/app/(admin)/matricula/prematrimonial/page.tsx` (wizard), `src/app/api/studies/prematrimonial/route.ts`, migración en `prematrimonial_requests`, `src/components/studies/PrematrimonialQueue.tsx`

```
Tres modificaciones al form de matrícula prematrimonial (aparte de lo ya implementado:
fecha mínima +6 meses, zonas fijas, pregunta del oficiante, búsqueda de pareja):

1) Sección "Ceremonia": QUITAR la pregunta del lugar. Queda solo la fecha, con este copy
   exacto: "¿Tienen fecha definida o aproximada para la boda? (Si ya la tienen, indicá la
   fecha. Recordá que el curso debe iniciar mínimo 6 meses antes)." — mantiene el flag
   existente de fecha definida/aproximada y la validación de +6 meses ya implementada.
   Si el campo lugar existe en prematrimonial_requests, no borrés la columna (datos
   históricos); solo se deja de preguntar y de mostrar en el form.

2) Sección NUEVA "Antecedentes de la pareja" (después de los datos de la pareja):
   - "¿Cuánto tiempo tienen de estar de novios?" — opciones: Menos de 1 año / 1 a 2 años /
     3 a 4 años / Más de 4 años.
   - "¿Es el primer matrimonio para ambos?" — Sí/No; si No, campo de texto: "Por favor
     indicar brevemente la situación previo a este proceso."
   - "¿Tienen hijos de relaciones anteriores o en común?" — Sí/No; si Sí, campo para
     indicar edades.
   - "¿Actualmente viven en casas separadas o ya conviven juntos?" — opciones: Casas
     separadas / Ya convivimos.

3) Sección NUEVA "Diagnóstico" (al final, antes del pago):
   - "¿Existe alguna situación particular o conversación difícil que hayan estado evitando
     o que quisieran abordar con el apoyo de sus futuros dirigentes?" — texto libre,
     opcional.

Implementación:
- Migración: columnas nuevas en prematrimonial_requests (tiempo de novios, primer
  matrimonio + detalle, hijos + edades, convivencia, diagnóstico). Las solicitudes viejas
  quedan con esos campos null y se muestran como "—" en la cola.
- Validación server-side de las opciones cerradas (zod en el POST, patrón del repo).
- La cola prematrimonial (PrematrimonialQueue) muestra los datos nuevos a los gestores.
- SENSIBLE: el detalle de matrimonio previo y el diagnóstico son información pastoral
  delicada. Misma visibilidad restringida que la evaluación de cierre (PRE-8):
  coordinador_estudios, direccion y admin; no visibles para otros roles.
Tests: guardado de secciones nuevas, condicionales (No→detalle, Sí→edades), lectura de
solicitudes viejas sin los campos.
```

### Activación masiva de cuentas (feedback 2026-07-28; hacer en orden: AUTH-1 → AUTH-2)

### [x] AUTH-1 · Cuentas para todos los miembros + flujo "Crear mi contraseña" — HECHO 2026-07-28 (script `scripts/create-member-accounts.ts` (dry-run/--apply, reglas puras testeadas en `account-creation-rules.ts`) EJECUTADO: 18,100 miembros con cuenta (14,897+3,213 creadas hoy con password aleatorio y correo SIN confirmar + 6 enlazadas + las 16 previas); `account_confirmed_at` queda NULL hasta que la persona reclame — verificado que `resetPasswordForEmail` funciona con cuentas sin confirmar y el verify confirma (punto 3 gratis por el trigger espejo). Exclusiones: 5,096 sin correo, 76 MENORES DE 12 (regla agregada a mitad de corrida a pedido de TI; las 16 ya creadas se limpiaron — gotcha: deleteUser del admin API da 500 en este proyecto, se borró por SQL directo), 23 sistema, 4 inactivos, 5 con correo duplicado (decisión TI: duplicados SE IGNORAN — familias bajo un correo; el titular ve a su familia con su cuenta). 3,104 sin fecha de nacimiento se incluyen (edad indeterminable). Login con bloque "¿Primera vez? Creá tu contraseña acá" → `/recuperar?nueva=1` (mismo flujo de recuperación con copy de crear contraseña). PREREQUISITO VIGENTE para reclamar a escala: SMTP propio en Supabase Auth (Fase 0))
Archivos: script nuevo en `scripts/`, endpoint existente de crear cuenta (`/api/members/[id]/create-account`), `src/app/(auth)/login/page.tsx`, flujo de recuperación existente
Prerequisito operativo: SMTP propio configurado en Supabase Auth (pendiente de Fase 0) — sin eso, los correos de reset tienen rate limit y esto no escala.

```
Objetivo: que todos los miembros del padrón puedan entrar al sistema sin invitaciones que
expiran. Estrategia decidida: crear las cuentas masivamente con contraseña ALEATORIA que
nadie conoce (nunca una contraseña genérica compartida), y que cada persona la reclame con
el flujo de recuperación existente cuando quiera entrar.
1) Script one-off en scripts/ (service role, dry-run primero) que recorra members activos
   con correo válido y sin auth_user_id, y les cree el usuario de Supabase Auth con password
   aleatorio fuerte (no guardarlo en ningún lado), vinculando auth_user_id. Reutilizá la
   lógica del endpoint existente /api/members/[id]/create-account si es generalizable.
   Excluir: correos rebotados (email_bounced), con queja (email_complained), miembros
   is_system y desactivados. Reporte: creadas, excluidas por causa, y correos duplicados
   entre miembros (dos personas con el mismo email — listarlos, NO crear esas cuentas
   hasta resolver el duplicado).
2) Login (src/app/(auth)/login/page.tsx): agregar un bloque visible "¿Primera vez en la
   nueva plataforma? Creá tu contraseña acá" que lleve al flujo de recuperación existente
   (mismo mecanismo de forgot password, solo cambia el copy: "crear contraseña" en vez de
   "recuperar"). El correo de reset lo pide la persona a demanda, así la expiración del
   link deja de ser problema.
3) En el primer login exitoso, marcar account_confirmed_at si no lo hace ya el flujo.
Tests: script idempotente (correrlo dos veces no duplica), exclusiones correctas.
```

### [x] AUTH-2 · Correo masivo "Cambiamos de plataforma" + plantilla de cambios de sistema — PLANTILLA Y VERIFICACIONES HECHAS 2026-07-28; queda el ENVÍO (operativo). Plantilla "Cambio de sistema / anuncio de plataforma" creada en message_templates (no is_system, seed `scripts/seed-platform-announcement-template.mjs`): anuncio editable, paso a paso numerado 1-4 para celular, CTA coral al login, nota de confianza con correo de ayuda; SIN links de invitación ni tokens que expiran; verificada con el pipeline real (applyVars+renderEmail). VERIFICADO el límite diario: el sistema ENCOLA solo — `distributeEmailSchedule` reparte los destinatarios en bloques de EMAIL_DAILY_LIMIT (5,000/día) con `scheduled_date` y el cron procesa respetando el cupo del día, así que ~18k salen automáticamente en ~4 días sin batching manual. AUDIENCIA: ya existe el filtro "Cuenta sin activar" en el constructor de segmentos (condición `account`) — es exactamente los 18k de AUTH-1. Pasos operativos pendientes ANTES del envío real: (1) SMTP propio en Supabase Auth (Fase 0) — el broadcast sale por SES, pero los correos de "crear contraseña" que la gente pedirá al recibirlo salen por el SMTP de Auth y sin configurarlo se atascan; (2) prueba con lista pequeña (staff) desde /comunicaciones/nueva con la plantilla y audiencia manual.
Archivos: `message_templates`, `/comunicaciones` (broadcast), depende de AUTH-1
Depende de: AUTH-1 (las cuentas deben existir antes de invitar a la gente a entrar)

```
Crear una plantilla de correo reutilizable "Cambio de sistema / anuncio de plataforma" en
message_templates (la de /comunicaciones/plantillas, no is_system) y usarla para el
broadcast de lanzamiento. Contenido de la plantilla, con la identidad visual de Theos
(header navy #161440 + logo, CTA coral #EF5554, footer estándar):
- Anuncio editable: estamos cambiando de plataforma (de CCB al sistema nuevo).
- Paso a paso numerado, claro y para celular:
  1. Entrá a [URL del sistema] (botón CTA).
  2. Tocá "Creá tu contraseña" e ingresá este mismo correo donde recibiste el mensaje.
  3. Revisá tu correo y abrí el enlace — llega en segundos, usalo de una vez.
  4. Definí tu contraseña y listo: vas a poder ver tu perfil, matricularte y gestionar
     tus pagos.
- Nota de confianza editable: por qué reciben esto (ya eran parte del sistema anterior)
  y a dónde escribir si necesitan ayuda.
IMPORTANTE: el correo NO lleva links de invitación ni tokens que expiren — solo el link
al login. El link de reset lo pide cada persona a demanda.
Envío: usar el flujo normal de broadcasts con audiencia = miembros con cuenta creada en
AUTH-1. Ojo con EMAIL_DAILY_LIMIT (default 5000/día): para ~23k destinatarios planificar
el envío escalonado en tandas por día (por sede o alfabético) y documentarlo en el
broadcast; verificá cómo se comporta el sistema al tocar el límite diario (¿encola o
falla?) antes del envío real. Probar primero con una lista pequeña (staff).
```

### Calendario público y eventos (feedback 2026-07-26)

### [x] EVE-1 · Detalle de evento público + inscribirse con login — HECHO 2026-07-27 (modal con fecha completa, costo en colones y "requiere inscripción" — campos que el endpoint ya exponía con whitelist, sin campos nuevos; botón funcional con login-gate patrón /vacantes → `/login?redirect=/eventos?register=<id>`; deep link `?register=` en /eventos abre el modal de inscripción vía elegibilidad y limpia la URL; botón visible solo con requires_registration y respetando showBtn; 2 tests)
Archivos: `src/app/(public)/calendario/page.tsx` (modal, líneas ~249-264), `src/components/servers/PublicApplyButton.tsx` (patrón a copiar), `src/components/events/useEventRegistration.tsx`, `src/app/api/public/events/route.ts`

```
El calendario público (src/app/(public)/calendario/page.tsx) tiene dos problemas:
1) El modal de detalle muestra muy poca info (flyer, nombre, descripción, lugar, hora).
   El endpoint /api/public/events YA expone requires_registration, requires_payment,
   payment_amount y max_capacity pero el modal no los usa. Agregalos al detalle: costo
   (formateado en colones), si requiere inscripción, y fecha completa. NO agregués campos
   nuevos al endpoint público sin whitelist explícita (ver el comentario de seguridad en
   src/app/api/public/events/route.ts: nunca hacer spread del evento).
2) El botón "Inscribirse" es un <div> decorativo sin onClick (líneas ~96-99 y ~259).
   Hacelo funcional con login-gate, copiando el patrón de
   src/components/servers/PublicApplyButton.tsx (el login-gate de /vacantes):
   - Sin sesión: redirigir a /login?redirect=<destino>. El param redirect ya funciona
     (postLoginDest en src/app/(auth)/login/page.tsx lo valida en password, TOTP y passkey).
   - El destino post-login debe abrir la inscripción del evento: la vista de inscripción
     para miembros vive en /eventos (src/app/(admin)/eventos/page.tsx usa
     useEventRegistration). Agregá soporte de deep link ?register=<eventId> en /eventos
     que abra el modal de inscripción de ese evento al cargar, verificando elegibilidad
     con /api/eventos/elegibilidad como hace el flujo actual.
   - Con sesión activa: el botón lleva directo a /eventos?register=<eventId>.
   Mostrar el botón solo si el evento tiene requires_registration (y respetar el query
   param showBtn existente del widget).
El calendario es un widget embebible controlado por query params (view, types, colores,
showBtn...); no rompás esos params. Tests del deep link y del redirect post-login.
```

### [x] EVE-2 · Flyers de eventos en Supabase Storage — HECHO 2026-07-27 (bucket público `event-flyers` creado; endpoint `/api/events/upload-flyer` con MIME/5MB y roles de eventos; el form de crear sube y guarda la URL pública — editar NO tenía campo de flyer, solo crear; script one-off `scripts/migrate-event-flyers.mjs` ejecutado: 0 flyers base64 en prod; bucket registrado en storage-orphans con normalización URL→path; CSP img-src ya permitía el origen de Supabase. SEGUIMIENTO: quitar `data:` de img-src cuando se confirme que nada más lo usa)
Archivos: `src/app/(admin)/eventos/nuevo/_components/Step1Informacion.tsx` (dropzone, líneas ~116-180), `src/app/(admin)/eventos/nuevo/page.tsx` (~165-170, FileReader), `src/lib/events/form-mapper.ts:58`, patrón: `src/app/api/communications/upload-image/route.ts`

```
Hoy el flyer de eventos se guarda como data URL base64 DENTRO de la columna events.flyer_url
(se lee con FileReader.readAsDataURL en src/app/(admin)/eventos/nuevo/page.tsx línea ~165 y
form-mapper.ts lo guarda tal cual). Migralo a Supabase Storage:
1) Bucket nuevo event-flyers (público, como email-images). Documentar que se crea desde el
   dashboard de Supabase (los buckets no se declaran en migraciones en este repo).
2) Endpoint POST /api/events/upload-flyer siguiendo el patrón exacto de
   src/app/api/communications/upload-image/route.ts (validar MIME PNG/JPG/WebP, máx 5MB,
   createAdminClient, devolver getPublicUrl). Guard: los mismos roles que gestionan eventos
   (direccion, encargado_staff, comunicaciones).
3) Cambiar crear Y editar evento para subir al endpoint y guardar la URL pública en flyer_url
   en vez del base64. La dropzone actual (Step1Informacion.tsx) se mantiene; solo cambia el destino.
4) Migración de datos: script one-off que recorra events con flyer_url que empiece con
   "data:", suba el contenido al bucket y reemplace por la URL pública. Reportar cuántos migró.
5) Registrar el bucket nuevo en el cron de huérfanos src/app/api/cron/storage-orphans/route.ts.
6) CSP (src/lib/csp.ts): verificar que img-src permita el dominio de Storage de Supabase;
   cuando ya no queden flyers base64, anotar como seguimiento quitar data: de img-src.
Tests del endpoint de upload (MIME inválido, tamaño excedido).
```

---

## Fase 2 — Filtros del padrón (hacer los 3 seguidos, misma zona de código)

### [x] FIL-1 · Filtro de miembros: NO asistió a un evento — HECHO 2026-07-26 (negate como anti-join vía sets exclude existentes; eventId puntual con combobox; endpoint liviano `/api/members/event-options`; labels + 4 tests)
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

### [x] FIL-2 · Filtro de miembros: por inscripción a evento — HECHO 2026-07-26 (condición `registration` contra event_registrations: evento puntual/tipo, estado del tiquete, rango sobre fecha del evento, negación anti-join; panel propio en el tab Asistencia; labels + tests)
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

### [x] FIL-3 · Grupos OR en el filtro avanzado — HECHO 2026-07-26 (módulo compartido `filter-units.ts` con la semántica de unidades UI=server; resolución por condición; `groups`/`ops` viajan a /api/members, ids y export; caso status-en-OR relaja el escaneo base; 9 tests)
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

### [x] FEA-1 · Conectar plantilla `form_asignado` — HECHO 2026-07-26 (dispara al crear/guardar form activo asignado a evento/grupo; destinatarios = inscritos no expirados / matriculados enrolled; dedupe por `forms.assignment_notified_key` (migración 20260726150000, aplicada); respeta prefs `mensajes_sistema`; GET /api/forms/[id] relajado a sesión para que el link de llenado funcione a miembros; 4 tests)
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

### [x] PRE-5 · Nuevo requisito prematrimonial — HECHO 2026-07-27 (regla pura `premat-requirement.ts`: N1 completado + N2 enrolled/completed, nivel posterior implica anteriores; profile gana `enrolled_codes`; 409 `requisito_n2` con mensaje nuevo; `has_n2`→`meets_requirement` en spouse-search/enrollee; tarjeta de /matricula y wizard gateados con `premat_ok` server-side; 6 tests)
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

### [x] EST-1 · Dirigente con grupo activo ⇒ activo automático — HECHO 2026-07-27 (create/update de grupo ya activaban; se agregó la excepción de campaña vía `leader-activation.ts`, activación en el grupo sucesor del cierre y en el grupo prematrimonial, y la excepción de campaña en el bloqueo de desactivación individual+bulk; 4 tests)
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

### [x] GRU-1 · Fechas de matrícula en grupos + cierre automático — HECHO 2026-07-27 (migración 20260727100000 aplicada; ventana en elegibilidad + guard `matricula_cerrada` en autoservicio con bypass de staff; cron `group-enrollment-windows` 12:30 UTC cierra en_matricula→en_curso con doble guard; forms crear/editar con precarga desde el bloque vigente para capacitaciones; se eliminó `signup_deadline` muerto; env opcional nueva `HEALTHCHECK_URL_GROUP_WINDOWS`; 5 tests)

> Nota de diseño: los grupos no tienen estado previo a `en_matricula`, así que la "apertura"
> no cambia estado — la VENTANA hace que el grupo aparezca en matrícula el día de
> `enrollment_start_date` (elegibilidad + guard server-side). El cambio manual siempre manda:
> el cron solo transiciona desde el estado esperado y nunca re-abre.
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

### [x] EST-2 · Importar cursos por Excel/CSV — HECHO 2026-07-27 (wizard /estudios/importar con preview server-side vía `dry_run`; validación pura `group-import-rules.ts`; dirigente solo por cédula normalizada → sin match = advertencia sin dirigente; zona debe existir (el import NO crea zonas); plantilla .xlsx con dropdowns de planes/zonas/días; import parcial; activa dirigentes EST-1; botón en /estudios; 6 tests)
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

### [x] PAG-1 · Página "mis pagos pendientes" + notificación clic-para-pagar — HECHO 2026-07-27 (/mis-pagos con pestañas de familia y deep link ?pago=; componente compartido `MemberPaymentsList` extraído del perfil; endpoint de pagos permite familia vía canViewMemberProfile; notificación del auto-enroll ahora linkea /mis-pagos?pago=<id> y respeta prefs mensajes_sistema; ítem "Mis pagos" en sidebar para toda sesión)
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

### [x] PAG-2 · Bloquear matrícula con pago de estudios pendiente — HECHO 2026-07-27 (guard en enrollMember → 409 `pago_pendiente` con conteo; solo concepto matrícula bloquea — regla pura `pending-payments.ts` con tests estudio-bloquea/evento-pasa; excluye el pago del propio plan (caso PAGO_PENDIENTE); banner en /matricula con link a /mis-pagos vía `pending_study_payments` del eligibility; staff con STUDY_ADMIN puede matricular a terceros con override EXPLÍCITO `override_pago_pendiente` confirmado en modal)
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

### [x] PAG-3 · Recordatorio semanal de pagos pendientes — HECHO 2026-07-27 (cron lunes 16:30 UTC, patrón CRON_SECRET + `HEALTHCHECK_URL_PAYMENT_REMINDERS`; regla pura `payment-reminder-rules.ts`: pendientes sí, en_revision no, rechazados solo dentro de las 72h; helper compartido `payment-reminders.ts` con prefs mensajes_sistema + dedupe diario hora CR — REV-2 lo reusa; email queda como punto de extensión documentado; 4 tests)
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

### [x] REV-2 · Recordatorio manual de pago — HECHO 2026-07-27 (POST `/api/payments/[id]/remind` con guard revision_pagos:edit, reusa el helper del cron con deep link `/mis-pagos?pago=<id>`; 409 `ya_recordado` (máx 1/día por pago), `silenciado` (prefs) y `no_recordable` (pagado/en revisión/rechazo vencido); botón "Enviar recordatorio" en el detalle de pagos pendientes con toast de confirmación o del motivo)
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

### [x] PRE-6 · Botón "solicitar beca" en prematrimonial — HECHO 2026-07-27 (reusa ScholarshipRequestModal con destino fijo al plan PREMAT — mismo flujo finance_requests/scholarship de la matrícula normal, sin flujo nuevo; el eligibility expone `premat_plan_id`; funciona en autoservicio y onBehalf; la solicitud queda open y el pago sigue pendiente hasta que becas resuelva — los emails beca_* ya existentes aplican)
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

### [x] FOL-1 · Nuevas reglas de folletos — HECHO 2026-07-27 (migración 20260727200000 aplicada: tipos `cupo_lleno`/`fin_matricula` + índice único parcial = 1 tiquete automático por grupo, race-safe; el tiquete es del PROPIO nivel del grupo con quantity=matriculados; dispara al confirmar la matrícula que llena el cupo y en el cron de ventanas al vencer con ≥5; manual intacto; QUITADO: generación en cierre (route+UI del wizard) y en hitos de bloque. ACOPLAMIENTO reportado: en processBloqueMilestones el aviso por hito, el sello `*_sent_at` y la creación compartían bloque — se quitó solo el insert; el aviso con conteos por sede y su dedupe siguen igual. Gap conocido: la matrícula automática N2-N4 pasa a enrolled vía approve_payment (SQL) sin chequear cupo — lo cubren el cron y el manual; 3 tests)
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

### [x] REF-1 · Regla de sede a fuente única — HECHO 2026-07-28 (migración 20260728100000 aplicada y verificada: SQL es la única implementación de producción — `refresh_member_sede(member_id)` nueva para el trigger + `refresh_member_sedes()` masiva del pg_cron, misma regla en el mismo archivo; el perfil y el export de servidores leen lo PERSISTIDO; `computeMemberSede` queda solo como especificación ejecutable de los fixtures, que pasan idénticos. Smoke en prod: 20/20 miembros idénticos al bulk. BONUS: el trigger por check-in usaba la REGLA VIEJA (sin ventana ni caso) — arreglado; y el muestreo previo (400 miembros, 91% paridad) reveló que el mapeo título→sede de TS no reconocía United (~9%) — al leer lo persistido, el perfil de esa gente deja de mostrar "sin sede". Frescura documentada: el flip activo→inactivo por paso del tiempo lo corrige el cron nocturno, ≤24h)
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

### [x] MNT-1 · Squash de migraciones (nuevo baseline) — HECHO 2026-07-30 (baseline `20260730193000_baseline_consolidado.sql` = volcado completo de producción; el baseline viejo (20260718150236) + las 32 migraciones posteriores quedaron en `supabase/migrations_archive/` (180 archivos de historia). Registro de producción reparado: las 33 viejas a `reverted`, el baseline nuevo a `applied` → `db push` dice "up to date" y `migration list` muestra una sola entrada. PROBADO DESDE CERO en un contenedor `supabase/postgres:17.6.1.127` limpio: aplica sin un solo error y reproduce exactamente lo que hay en producción (71 tablas, 200 policies, 71 con RLS, 42 triggers de public, 40 funciones de public + 4 de private). HUECOS ENCONTRADOS Y CERRADOS en el baseline (el anterior también los tenía: `supabase db dump` solo vuelca public/private): el trigger `trg_sync_member_account_confirmed` sobre `auth.users` (espejo de AUTH-1) y los TRES jobs de pg_cron que sí viven en la BD — refresh-donor-flags (30 6 * * *), refresh-member-sedes (45 6 * * *) y prune-audit-log (0 4 * * *); van en un bloque al final del archivo. Los buckets de Storage siguen fuera de migraciones: documentados en el encabezado del baseline (payment-receipts, employee-docs, email-images). Backup del esquema en `~/theos-backups/schema-2026-07-30.sql`. Nota operativa: el CLI necesita Colima corriendo para `db dump` y hay que pasar las versiones como argumentos separados a `migration repair`.)
Archivos: `supabase/migrations/`, `supabase/migrations_archive/`, tabla de migraciones de Supabase
Cuándo: al final, cuando se calme la ola de migraciones de este plan (GRU-1, EST-5, REV-3, INT-*). No correrlo a mitad de fase.

```
Consolidar las migraciones acumuladas desde el baseline anterior
(20260718150236_baseline_consolidado.sql) en un baseline nuevo, repitiendo el patrón que ya
se usó en este repo:
1) Verificar que producción esté al día con todas las migraciones pendientes.
2) Generar el esquema actual completo como nuevo archivo baseline (supabase db dump del
   schema, o diff limpio), incluyendo tablas, CHECKs, RPCs, triggers, políticas RLS y grants.
3) Mover las migraciones individuales posteriores al baseline viejo a
   supabase/migrations_archive/ (no borrarlas: son historia).
4) Marcar el baseline nuevo como ya aplicado en la tabla de migraciones de Supabase en
   producción (repair/insert del registro) para que no intente ejecutarlo de nuevo.
5) Probar en un proyecto/branch de Supabase limpio que el baseline levanta la BD de cero y
   que los tests pasan contra ese esquema.
OJO: los buckets de Storage no están en migraciones (se crean por dashboard) — documentar en
el baseline un comentario con los buckets requeridos (payment-receipts, employee-docs,
email-images, event-flyers si ya existe EVE-2).
```

### [x] FRM-1 · Rol `forms` + encargados por evento/formulario (feedback 2026-07-30)

> **PARTE A HECHA — 2026-08-04** (migración `20260804120000`, commits `df1ca21` + `dade10e` + `e3ecb0e`).
> Rol `forms` con el módulo formularios (view/create/edit/export, sin delete: borrar se lleva
> las respuestas). Desalineamiento cerrado: `comunicaciones` y `encargado_staff` ya declaran el
> módulo y los guards de escritura usan `requireModuleView('formularios', {action})`.
> Bug encontrado al probar: el rol no veía la entrada del menú porque Formularios cuelga de
> Comunicaciones — resuelto con `formsNavPlacement` (submenu | top_level | none).
>
> **PARTE B, A MEDIAS.** Hecho: acceso puntual **por formulario** (tabla `form_access_grants`,
> `formViewerScope` → admin|grantee|none, UI "Personas con acceso a este formulario" en el
> FormBuilder, aplicado en el listado, el detalle y las respuestas; `granted_form_ids` en
> `/api/auth/me` para el sidebar y el ModuleGuard).
>
> **PARTE B CERRADA — 2026-08-06** (migración `20260806100000_event_managers`).
> Encargados de un evento: tabla `event_managers`, `eventViewerScope` → admin|manager|none,
> `requireEventAccess` / `requireFormEdit` (`src/lib/auth/event-guard.ts`),
> `/api/events/[id]/managers` (GET/POST/DELETE, solo `EVENT_ADMIN_ROLES`), sección
> "⑥ Encargados de este evento" en el editor, `managed_event_ids` en `/api/auth/me`, y los
> tabs completos de SU evento vía `visibleEventTabs({isManager})`. El formulario del evento
> HEREDA el permiso (`formViewerScope({isEventManager})` → `event_manager`, que sí edita).
>
> **DESVÍO DEL PLAN, a propósito:** el plan pedía una tabla polimórfica `entity_managers`
> (entity_type/entity_id). Se hizo `event_managers` específica, con FK reales. Motivo: sin FK
> quedan filas colgando al borrar el evento y cada lectura tiene que validar el tipo a mano.
> Dos tablas chicas (`event_managers` + `form_access_grants`) se leen de un vistazo; la
> herencia evento→formulario vive en la función de permisos, no en la forma de la tabla.
> Decisión de TI, 2026-08-06.
Archivos: `src/lib/auth/roles.ts`, migración (CHECK de `member_roles` + tabla nueva), `src/app/api/forms/*`, configuración de evento y de formulario, patrón a copiar: `src/lib/auth/studies-scope.ts`

```
Dos cosas distintas, no las mezclés:

A) ROL GLOBAL `forms`
   Crear el rol nuevo `forms` (migración: agregarlo al CHECK de member_roles, hoy con 19
   roles) con el módulo `formularios`: view/create/edit/export sobre cualquier formulario.
   Aprovechá para ARREGLAR UN DESALINEAMIENTO existente: hoy el permiso de módulo
   `formularios` en roles.ts SOLO lo declara `direccion`, pero POST/PUT/DELETE de
   /api/forms exigen requireRoles('comunicaciones','direccion','encargado_staff'). O sea:
   comunicaciones puede crear y editar formularios pero no ve el listado ni las respuestas.
   Dejá los guards de escritura y el permiso de módulo consistentes entre sí.

B) ENCARGADOS DE UN OBJETO PUNTUAL (lo nuevo)
   Caso: la encargada de una actividad debe ver TODO de ese evento y su formulario
   (respuestas, inscripciones), y NADA de los demás eventos. Eso no es un rol: es permiso
   sobre un recurso. Hoy no existe el dato — event_volunteers está vacía y
   event_organizing_committees solo se usa para precios, no para autorizar.
   1) Migración: tabla genérica siguiendo el patrón polimórfico que forms ya usa:
      entity_managers (entity_type 'event'|'study_group'|'form', entity_id, member_id,
      granted_by, granted_at; UNIQUE por los tres primeros). Una sola tabla sirve para
      eventos, grupos y formularios sueltos.
   2) DÓNDE SE ADMINISTRA (decisión confirmada): en la configuración de la ENTIDAD, no en
      dos lados. En el evento se agrega la sección "Encargados de este evento". El
      formulario asociado HEREDA: si sos encargado del evento, ves su formulario y sus
      respuestas. Solo los formularios sueltos (entity_type='general', sin padre) tienen
      su propia lista de encargados en la configuración del formulario.
   3) Autorización: función pura tipo formViewerScope({roles, memberId, form, isManager})
      → 'admin' | 'manager' | 'none', copiando el molde de src/lib/auth/studies-scope.ts
      (groupViewerScope) — testeable sin Supabase. Para un form con entity_type='event',
      resolver isManager mirando entity_managers del EVENTO padre, no del form.
      Aplicá el scope en GET /api/forms (el manager ve solo los suyos en el listado),
      GET /api/forms/[id] y GET /api/forms/[id]/responses. El manager LEE y EXPORTA;
      editar la estructura del formulario sigue siendo de los roles globales.
   4) Acceso al evento: el encargado también debe poder ver los datos de SU evento
      (inscripciones, check-ins) sin tener el rol global de eventos. Aplicá el mismo scope
      en los endpoints del evento correspondiente.
   Quién nombra encargados: los roles que gestionan la entidad (para eventos: direccion,
   encargado_staff, comunicaciones, admin).
Tests: el manager de un evento ve solo su formulario y sus respuestas (403/404 en otro);
el rol forms ve todos; miembro sin nada no ve ninguno; nombrar y quitar encargado.
```

---

## Fase 7 — Feedback de agosto (uso real)

> Puntos levantados probando el sistema con usuarios reales, a partir del 2026-08-05.

### [x] GRU-2 · Restricción opcional de audiencia al crear un grupo de estudio

> **HECHO 2026-08-06** (migración `20260806140000_group_enrollment_restrictions`).
> Columna `study_groups.enrollment_restrictions` (jsonb) con el MISMO shape del filtro
> avanzado del padrón. Regla pura en `src/lib/studies/group-restrictions.ts`
> (normalización, resumen legible, mensaje del bloqueo); lectura y evaluación en
> `src/lib/supabase/queries/group-restrictions.ts`. UI: `AudienceRestrictionSection`
> (el MISMO `AdvancedFilters`, con la prop nueva `allowedTypes`) en crear y editar grupo,
> resumen en la ficha, y conteo del padrón en vivo vía `POST /api/studies/groups/restriction-count`.
> Guard server-side en `enrollMember` → 409 `restriccion_grupo` con el motivo. 18 tests.
>
> **DECISIONES CONFIRMADAS CON TI (2026-08-06):**
> · Punto 6 — el staff SÍ puede saltarse la restricción, con confirmación explícita en el
>   modal de "Añadir miembro" y registro en la bitácora (`logAudit`), igual que PAG-2.
> · Condiciones permitidas: solo las de AUDIENCIA (dirigente, servicio, estudio, edad,
>   estado civil, donador). Asistencia, inscripción a eventos, formularios, estado de
>   cuenta y fecha de creación quedan fuera — no describen a quién va dirigido un grupo y
>   son las caras de resolver. Agregar una es una línea en `ALLOWED_RESTRICTION_TYPES`.
>
> **CÓMO SE EVITÓ LA SEGUNDA IMPLEMENTACIÓN** (lo que pedía el plan): `evaluateUnits` ya
> era puro y recibe un callback, así que la semántica AND/OR se reusa tal cual. Lo que
> faltaba era el costo: `resolveAdvancedConditions` barría las ~18 mil fichas por
> condición. Se le agregó un ALCANCE opcional por miembro (`scopeIds`) que se propaga a
> todas las consultas; con eso, "¿esta persona cumple?" y "¿cuánta gente cumple?" son la
> MISMA función (`getMemberIds`). Medido en producción: 4.5 s → 0.26 s (dirigente) y
> 5.7 s → 0.62 s (completó N1).
Archivos: migración (`study_groups`), `src/types/filters.ts`, `src/components/members/AdvancedFilters.tsx`, `src/lib/studies/eligibility.ts`, `src/lib/supabase/queries/studies.ts` (`enrollMember`), forms de crear/editar grupo, `src/lib/condition-labels.ts`

```
FEATURE · Restricción opcional de audiencia al crear un grupo de estudio

Caso: a veces se arma un grupo de una capacitación dirigido solo a cierta gente — solo
dirigentes, solo líderes de comité, o solo quienes ya llevaron cierto estudio. Hoy no se
puede: la elegibilidad se calcula por PLAN (etapa, compromisos, prerequisitos) y todos los
grupos de un mismo plan se le ofrecen a cualquiera que califique.

Lo que quiero: un bloque OPCIONAL en la creación/edición de grupo, "Restringir este grupo
a…", que limite a quién se le ofrece ese grupo en la matrícula. Si no se usa, el grupo se
comporta exactamente como hoy.

REUTILIZAR, NO INVENTAR
El filtro avanzado del padrón (src/types/filters.ts + src/components/members/
AdvancedFilters.tsx) ya tiene un modelo de condiciones con tipos study, leader, service,
donor, attendance, age, status… y su UI de constructor. Usá ESE mismo modelo para las
restricciones del grupo, en vez de crear un esquema paralelo.
Antes de programar, revisá si el evaluador actual sirve o hace falta uno per-persona: el
del padrón trabaja por conjuntos de ids sobre todo el padrón, y acá se necesita responder
"¿esta persona cumple?" para un solo miembro. Si hace falta, extraé una función pura
evaluateConditions(member, conditions) y que ambos caminos la usen — no dos
implementaciones de la misma regla, que después se desincronizan.

1) MIGRACIÓN
Columna enrollment_restrictions (jsonb, nullable) en study_groups, guardando la lista de
condiciones con el mismo shape del filtro del padrón. Null = sin restricción.

⚠️ ALCANCE — NO CONFUNDIR CON LOS REQUISITOS DEL PLAN
La restricción es POR GRUPO, nunca por plan ni por etapa. Son dos cosas separadas que se
evalúan aparte:
  · El PLAN define los compromisos de la etapa (donador, servidor, asistencia,
    prerequisitos, invitación). Eso ya existe y NO se toca.
  · El GRUPO puede tener, además y opcionalmente, su propia restricción de audiencia.
Dos grupos del MISMO plan deben poder tener restricciones distintas, o uno tenerla y el
otro no. Ejemplo concreto que tiene que funcionar: dos grupos de la misma capacitación, uno
abierto a cualquiera que califique para esa etapa y otro restringido a dirigentes — y una
persona que no es dirigente ve solo el primero.
NO agregues la restricción a study_plans, ni la heredes del plan al crear el grupo, ni la
copies al grupo sucesor cuando se cierra un grupo y avanza la cohorte (ver la herencia de
dirigente/horario/zona en el cierre: la restricción NO se hereda salvo que yo lo pida).

2) UI EN CREAR Y EDITAR GRUPO
Sección colapsada "Restringir este grupo a… (opcional)" con el constructor de condiciones.
Casos que deben quedar cubiertos de una:
  - Solo dirigentes
  - Solo líderes de comité
  - Solo quienes completaron el estudio X
  - Combinaciones (por ejemplo dirigentes que además completaron X)
Mostrá un resumen legible de la restricción en la ficha del grupo, usando las mismas
etiquetas de src/lib/condition-labels.ts.

3) ELEGIBILIDAD
En src/lib/studies/eligibility.ts, la restricción del grupo se evalúa ADEMÁS de lo que ya
existe (etapa, compromisos, prerequisitos, invitación, grupo virtual, estado y cupo), nunca
en lugar de. Un grupo restringido no aparece entre las opciones de quien no cumple.

4) GUARD SERVER-SIDE
Al matricular (enrollMember), si la persona no cumple la restricción → 409 con código claro.
No alcanza con esconderlo de la UI: el staff que matricula a terceros pasa por el mismo
endpoint, y el deep link a un grupo también.

5) MENSAJE ÚTIL
Si alguien llega al grupo por deep link, o el staff intenta matricular a quien no cumple, el
mensaje debe decir POR QUÉ ("Este grupo es solo para dirigentes"), no un error genérico.

6) OVERRIDE DEL STAFF — DECIDÍ CONMIGO, no lo resuelvas solo
¿Los STUDY_ADMIN_ROLES pueden matricular a alguien saltándose la restricción del grupo?
Mi inclinación es que sí, pero con confirmación explícita en la UI y quedando registrado,
igual que el override de PAG-2. Preguntame antes de implementarlo.

7) VISTA DE CONTEXTO
En la ficha del grupo (y al guardar la restricción), mostrá cuántas personas del padrón
cumplen esa restricción. Es fácil armar una condición demasiado estrecha y darse cuenta
recién cuando nadie se matriculó; ver el conteo al momento lo evita.

TESTS
- Grupo sin restricción se comporta igual que hoy.
- Grupo restringido a dirigentes no aparece para un no-dirigente.
- El POST de matrícula devuelve 409 para quien no cumple.
- Combinación de dos condiciones.
- La restricción NO reemplaza los compromisos de la etapa (una persona que es dirigente
  pero no cumple la asistencia de la etapa sigue bloqueada).
- Dos grupos del mismo plan con restricciones distintas se ofrecen de forma distinta.
- Al cerrar un grupo, el sucesor NO hereda la restricción.
```

### [x] FRM-2 · Hero/header con flyer en los formularios

> **HECHO 2026-08-06** (migración `20260806160000_form_hero`, bucket `form-heroes` creado).
> Columnas `hero_image_url` / `hero_title` / `hero_subtitle` en `forms`; sección
> "Encabezado (opcional)" en el builder con dropzone, vista previa y quitar;
> `FormHero` compartido por el formulario público y la vista previa;
> `POST /api/forms/upload-hero` con el patrón de EVE-2. 12 tests.
>
> **DECISIONES (las dos que el plan pedía justificar/avisar):**
> · COLUMNAS en `forms`, no un tipo de campo. Una fila de form_fields es una PREGUNTA:
>   arrastra orden, validación de obligatorios, lógica condicional, export y
>   form_response_values. El hero no se responde — es del formulario, como su título y
>   su descripción, que ya son columnas.
> · BUCKET PROPIO `form-heroes`, no `event-flyers`. Los formularios existen aparte de los
>   eventos (hay de estudios, encuestas y sueltos); un bucket llamado "de eventos" con
>   imágenes que no son de eventos hace imposible razonar después sobre qué se puede
>   limpiar. Público, tope 5 MB, MIME limitado a jpeg/png/webp EN EL BUCKET (además de la
>   validación del endpoint). Verificado en producción: sube, se lee anónimo y rechaza GIF.
Archivos: builder de formularios (`src/app/(admin)/formularios/*`), tablas `forms` / `form_fields`, `src/components/forms/FormFiller.tsx`, patrón de upload: `src/app/api/events/upload-flyer/route.ts` (EVE-2)

```
Al crear un formulario hay que poder agregarle un HERO/HEADER con imagen (flyer), para que
el formulario se vea como una pieza de comunicación y no como un cuestionario pelado.
Es un componente nuevo.

1) MODELO: agregá al formulario los campos del hero — imagen (URL), título y subtítulo o
   texto de bienvenida opcionales. Decidí mirando el esquema si van como columnas en `forms`
   (hero_image_url, hero_title, hero_subtitle) o como un tipo de campo nuevo en form_fields;
   mi inclinación es columnas en `forms`, porque el hero es del formulario, no una pregunta
   más — pero justificá lo que elijas.
2) UPLOAD: reutilizá el patrón de EVE-2 (bucket público, validación de MIME PNG/JPG/WebP y
   tamaño máximo, createAdminClient, getPublicUrl). Decidí si va al bucket de event-flyers
   o a uno propio para formularios y decímelo. NO guardes la imagen como base64 en la
   columna: ese fue justamente el problema que EVE-2 vino a arreglar en eventos.
3) BUILDER: sección "Encabezado (opcional)" arriba del constructor de campos, con dropzone
   y vista previa. Debe poder quitarse.
4) FORMULARIO PÚBLICO/LLENADO (FormFiller): renderizar el hero arriba, responsive — la
   mayoría lo abre desde el celular, así que la imagen no puede desbordar ni empujar el
   primer campo fuera de pantalla. Sin hero, el formulario se ve igual que hoy.
5) Que aparezca también en la vista previa del builder.
Tests del upload (MIME inválido, tamaño excedido) y del render sin hero.
```

### [x] COM-3 · Bug: "usar plantilla" desde nueva comunicación no carga el contenido

> **HECHO 2026-08-06**, junto con los bugs del editor de plantillas — era la MISMA causa raíz.
> El `useEffect` de sincronización de `EmailEditor` dependía solo de `[mode]`, no de `[value]`:
> al aplicar una plantilla, el contenido se setea DESPUÉS de que el editor ya montó y el
> editor nunca se enteraba. Se agregó `value` a las dependencias (la guarda
> `getHTML() !== value` evita el reseteo en cada tecla). Además, los dos caminos ahora usan
> UNA sola `applyTemplate(tpl, {setChannelToo})` — antes eran dos bloques casi iguales y ya
> se habían desincronizado: el de esta pantalla no seteaba el canal.
Archivos: `src/app/(admin)/comunicaciones/nueva/page.tsx`, `src/app/(admin)/comunicaciones/plantillas/*`, editor de correos

```
BUG reportado en uso real. Hay dos caminos para usar una plantilla y solo uno funciona:
  · Desde /comunicaciones/plantillas → botón "Usar" → FUNCIONA: el contenido se carga en el
    editor y se puede editar.
  · Desde la pantalla de nueva comunicación → botón "Usar plantilla" → ROTO: el contenido no
    se jala al panel izquierdo donde se muestra el cuerpo del correo, así que la plantilla no
    se puede editar.

Compará los dos caminos y arreglá el segundo para que use el mismo mecanismo que el primero
(probablemente uno pasa el contenido por navegación/estado inicial y el otro lo setea después
de que el editor ya montó, o lo escribe en un estado que el editor no observa). NO dupliques
lógica: extraé la carga de plantilla a una sola función que usen ambos caminos, para que no
se vuelva a desincronizar.
Verificá que después de cargar la plantilla se pueda editar libremente, que el asunto
también se cargue, y que cambiar de plantilla reemplace el contenido en vez de acumularlo.
Test de ambos caminos.
```

### [x] EVE-4 · Evento con formulario de inscripción y encuesta de satisfacción programada

> **HECHO 2026-08-06** (migración `20260806180000_event_form_and_survey`, cron nuevo).
>
> **DECISIONES CONFIRMADAS CON TI (2026-08-06), las dos que el plan pedía:**
> · (A) La inscripción SIGUE siendo `event_registrations` —cupo, pago y check-in— y la
>   respuesta del formulario se le ENLAZA (`event_registrations.form_response_id`). El
>   enlace se hace en `submitResponse`, no en el endpoint, para que valga por cualquier
>   camino: el botón del evento, el link directo o el staff respondiendo por alguien.
> · (B) La encuesta va a quienes hicieron CHECK-IN, no a todos los inscritos. Es fijo, y
>   se dice en la pantalla al programarla.
>
> Columnas: `registration_form_id`, `survey_form_id` / `survey_template_id` (CHECK: uno u
> otro), `survey_offset_hours` (la regla), `survey_send_at` (el momento CALCULADO — es lo
> que mira el cron), `survey_sent_at` + `survey_sent_count` (dedupe y estado).
> Reglas puras en `src/lib/events/survey-schedule.ts`; despacho en
> `src/lib/email/event-survey-notify.ts` (prefs `mensajes_sistema`, dedupe por el sello,
> techo `DAILY_LIMIT` compartido entre eventos); cron `/api/cron/event-surveys` 17:00 UTC
> con el patrón de siempre (CRON_SECRET + `HEALTHCHECK_URL_EVENT_SURVEYS` opcional).
> Plantilla del sistema nueva: `encuesta_evento`. 28 tests.
>
> **Verificado en producción antes de activar el cron:** de 3.372 eventos, 0 quedan en la
> condición de despacho — encender el cron no le manda un correo a nadie por accidente.
Archivos: crear/editar evento (`src/app/(admin)/eventos/nuevo`, `[id]/editar`), `events`, módulo de formularios, `message_templates`, cron nuevo o el de recordatorios

```
Dos capacidades nuevas al crear un evento, ambas OPCIONALES:

A) FORMULARIO DE INSCRIPCIÓN
   Poder elegir un formulario existente (o crear uno) que se use para inscribirse al evento.
   Hoy los formularios ya se asocian a entidades (forms.entity_type = 'event' + entity_id),
   así que la pieza existe — falta el selector en la creación del evento y que la
   inscripción pase por ese formulario.
   Definí y decime cómo queda la relación con event_registrations: ¿la respuesta del
   formulario ES la inscripción, o son dos cosas que se enlazan? Mi inclinación: la
   inscripción sigue siendo event_registrations (que es lo que maneja cupo, pago y check-in)
   y la respuesta del formulario queda enlazada como información adicional. Confirmámelo
   antes de implementar.

B) ENCUESTA DE SATISFACCIÓN PROGRAMADA
   El campo events.requires_survey ya existe pero no tiene flujo. Construilo:
   - Al crear el evento, si se marca que requiere encuesta, poder elegir QUÉ se envía:
     un formulario existente o una plantilla de correo ya creada (message_templates).
   - Y CUÁNDO se envía: momento relativo al fin del evento (por ejemplo "2 horas después",
     "al día siguiente", "3 días después") o una fecha y hora exactas. Guardá el momento
     calculado, no solo la regla, para que el envío sea predecible.
   - A QUIÉNES: definí el default y hacelo visible — mi propuesta es a quienes hicieron
     check-in, no a todos los inscritos (quien no llegó no tiene qué evaluar). Confirmámelo.
   - ENVÍO: un cron que despache las encuestas cuyo momento ya pasó, siguiendo el patrón
     exacto de los crons existentes (vercel.json, auth Bearer CRON_SECRET, ping a
     healthcheck si la env existe, dedupe para no reenviar si corre dos veces).
     Respetá preferencias de notificación y el límite diario de correos.
   - En la ficha del evento, mostrar el estado de la encuesta: programada para tal fecha /
     enviada a N personas / N respuestas.
Permisos: los mismos que gestionan eventos (direccion, encargado_staff, comunicaciones).
Tests: evento sin encuesta se comporta igual; el cron no reenvía; la encuesta programada a
futuro no se manda antes de tiempo.
```

### [x] EST-11 · Plan de estudios: EB desactivados solo para staff + campañas al final

> **HECHO 2026-08-06.** Regla pura en `src/lib/studies/plan-visibility.ts` (orden canónico
> de etapas, `canSeeArchivedPlans`, `visiblePlans`), usada por la página Y por
> `GET /api/studies/plans` — el miembro ya no los recibe en el payload aunque adivine la
> URL. 9 tests.
>
> **CAUSA DEL BUG DEL ORDEN:** no era `STUDY_STAGES` (ya tenía campañas al final) ni las
> secciones visuales (también correctas). Era el listado plano de la tabla: un desempate
> `isInvTail` empujaba CDEB y CDC al fondo de TODA la lista ANTES de comparar la etapa, así
> que las campañas quedaban entre Hermenéutica y esos dos. El orden dentro de la etapa
> avanzada ya lo pone `TAIL` en `withinStage`, así que ese desempate sobraba: se eliminó.
>
> `/matricula` y `/estudios/analisis` se revisaron y ya estaban bien (la primera tiene su
> `STAGE_ORDER` correcto, la segunda no lista niveles ni campañas y ya excluía los
> desactivados).
>
> **Impacto medido en producción:** de 40 planes, 9 están desactivados (LECTPROP, PAREJAS,
> PLANDANIEL, QEJ, TEOAT, APO, EFE, GAL, MDM). Esos 9 los veía cualquiera con sesión,
> incluido el rol miembro; ahora solo los ve quien administra estudios.
Archivos: `src/app/(admin)/estudios/plan/*`, `src/data/study-catalog.ts` (`STUDY_STAGES`), `src/lib/studies/eligibility.ts` (`LEVEL_TO_STAGE`)

```
Dos arreglos en la página del plan de estudios:
1) Los estudios DESACTIVADOS se le muestran hoy a todo el mundo. Deben verlos solo admin,
   direccion y quien tenga acceso al módulo de estudios (STUDY_ADMIN_ROLES). Para el resto
   —incluido el rol miembro— simplemente no aparecen: no es que salgan en gris, no salen.
   Gate en la página Y en el endpoint que sirve los planes (el miembro no debe recibirlos en
   el payload aunque adivine la URL).
2) Las CAMPAÑAS aparecen intercaladas entre Hermenéutica y el resto de los avanzados. Deben
   ir SIEMPRE al final, después de todas las etapas. Corregí el orden en el agrupador de
   etapas (STUDY_STAGES en src/data/study-catalog.ts y donde se ordene en la página).
   Orden correcto: Niveles → Etapa inicial → Etapa intermedia → Etapa avanzada → Campañas.
   Revisá que el mismo orden se respete en /matricula y en /estudios/analisis, no solo acá.
Tests del gate por rol y del orden de etapas.
```

### [x] GRU-3 · Datos de contacto del dirigente en el detalle del grupo

> **HECHO 2026-08-06.** Teléfono y correo del dirigente y del co-dirigente en la ficha del
> grupo, accionables: `tel:`, `wa.me` (helper `waLink` nuevo en `src/lib/phone.ts`, prefija
> 506 a los locales de 8 dígitos) y `mailto:`.
>
> **VISIBILIDAD — se respetó el default del plan, sin consultarlo:** solo lo ve quien
> gestiona el grupo (`viewer_scope` 'admin' o 'leader'). Un estudiante inscrito ve el
> NOMBRE de su dirigente, no su celular. Se implementó borrando los campos del PAYLOAD en
> `GET /api/studies/groups/[id]` (`stripLeaderContact`), no escondiéndolos en la UI: si
> viajan, están expuestos a cualquiera que mire la respuesta.
>
> phone/email se agregaron SOLO al select del detalle (`GROUP_SELECT`), nunca a los tres
> selects de listado — no tiene por qué viajar el contacto de 112 dirigentes por lote.
>
> Datos: de 112 grupos activos con dirigente, los 112 tienen teléfono y 109 correo.
Archivos: detalle de grupo (`src/app/(admin)/estudios/grupos/[id]`), query del grupo

```
En el detalle de un grupo, la sección del dirigente muestra solo el nombre. Agregá teléfono
y correo, para que quien necesite contactarlo no tenga que ir a buscar su perfil.
Incluí también al co-dirigente si el grupo tiene.
Que sean accionables: el teléfono como enlace tel: o de WhatsApp, el correo como mailto.
CUIDADO CON LA VISIBILIDAD: son datos personales. Mostralos solo a quien ya puede ver el
grupo con scope de gestión (STUDY_ADMIN_ROLES, GROUP_ADMIN_ROLES) — un estudiante del grupo
NO debe ver el teléfono de su dirigente en esta pantalla salvo que me lo confirmes.
Sumá los campos al select de la query del grupo; hoy probablemente solo trae el nombre.
```

### [x] BLQ-1 · Calendario anual de bloques

> **HECHO 2026-08-06.** Toggle Lista / Calendario (la lista se mantiene tal cual) + selector
> de año con el actual por defecto. Geometría pura en `src/lib/studies/bloque-calendar.ts`,
> vista en `src/components/studies/BloqueCalendar.tsx`. 15 tests.
>
> · La barra de cada bloque va del PRIMER hito (folleto preliminar, 3 semanas antes de
>   abrir) al cierre de matrícula — esa es la vida real del bloque, no solo los días que
>   está abierto. Los 4 hitos van marcados encima; las fechas salen de `bloqueMilestones`,
>   no se recalculan.
> · Un bloque a caballo entre dos años se recorta al año visible y se marca el corte.
> · GRU-1: carril propio abajo con las ventanas de matrícula de los grupos.
> · Clic en una barra resalta el bloque en el listado.
> · MÓVIL: el calendario y su toggle no se muestran en pantalla angosta (`hidden md:*`) —
>   un año entero en 360 px no se lee. Queda la lista, que ahí sí funciona.
Archivos: `src/app/(admin)/estudios/bloques`, `src/lib/studies/bloques.ts`

```
La pantalla de bloques hoy es un listado. Agregá una vista de CALENDARIO ANUAL que muestre,
sobre los 12 meses del año, los bloques de capacitación con sus hitos: apertura y cierre de
matrícula, inicio y fin del bloque, y los hitos que disparan pedidos de folletos.
- Selector de año, con el actual por defecto.
- Cada bloque como una barra sobre la línea de meses, con su nombre y color propio; los
  hitos marcados sobre la barra.
- Clic en un bloque abre su detalle (o lo resalta en el listado existente).
- El listado actual se mantiene: es una vista alternativa, no un reemplazo. Un toggle
  Lista / Calendario.
- Mobile: en pantalla angosta el calendario anual no funciona — degradá a la lista o a una
  vista vertical por mes.
Las fechas y los hitos salen de src/lib/studies/bloques.ts, no las recalcules aparte.
Si ya se implementó GRU-1 (fechas de matrícula por grupo), mostrá también esos rangos.
Permisos: los mismos de la pantalla de bloques (coordinador_estudios, admin).
```

### [x] REU-2 · Hacer visible la reubicación como plan de contingencia

> **HECHO 2026-08-06.** No se construyó nada nuevo: el flujo de `relocation` es el mismo.
> `StudyRequestActions` ganó dos props —`only` (mostrar un solo acceso) y `variant='link'`
> (enlace discreto)— y con eso el MISMO modal aparece en tres lugares nuevos:
> la confirmación de matrícula, la ficha del grupo en la vista del estudiante y /mis-pagos.
> El perfil sigue igual.
>
> · El modal ahora explica qué pasa después: lo revisa el coordinador, NO es automático, y
>   mientras tanto sigue matriculado en su grupo actual.
> · Coordinador: entrada propia "Cambios de grupo" en el hub de estudios, con contador
>   propio (`?count=relocation`). El conteo general mezclaba reubicaciones con intereses, y
>   los intereses son informativos (EST-6) — un badge que los junta no dice cuánta gente
>   está esperando un cambio.
> · 9 tests: que los tres accesos sigan puestos, que el modal explique el después, y que el
>   deep link `?tab=relocation` abra la sección.
Archivos: `src/components/studies/StudyRequestActions.tsx`, detalle de grupo, confirmación de matrícula, `/estudios/solicitudes`
Depende de: EST-6 y EST-7 (sin esos dos arreglados el flujo existe pero no sirve)

```
Caso: una persona se matricula en el grupo equivocado y necesita cambiarse.
EL FLUJO YA EXISTE — no construyas nada nuevo. Las solicitudes de reubicación viven en
study_requests, el API las acepta de cualquier usuario autenticado (con
resolveTargetMemberId como anti-suplantación) y el coordinador las resuelve desde
/estudios/solicitudes eligiendo el grupo destino, lo que mueve la matrícula.
EL PROBLEMA ES QUE NO SE ENCUENTRA: el botón está enterrado en la pestaña Participación del
perfil. Quien se matriculó mal no va a buscarlo ahí, va a escribirle a alguien por WhatsApp.

Ponelo donde duele:
1) En la ficha del grupo del estudiante (su vista read-only) y en la pantalla de
   confirmación de matrícula: un enlace discreto pero claro, "¿Te matriculaste en el grupo
   equivocado? Pedí un cambio de grupo", que abra el mismo modal de reubicación que ya
   existe.
2) En /mis-pagos o donde el miembro vea sus estudios activos, la misma entrada.
3) Que el modal explique qué pasa después: que lo revisa el coordinador de estudios, que no
   es automático, y que mientras tanto sigue matriculado en su grupo actual.
4) Del lado del coordinador: que la cola de reubicaciones sea visible desde el módulo de
   estudios sin tener que recordar la URL, con contador de pendientes.
NO agregues un sistema de "casos" ni un tipo de solicitud nuevo: es exactamente para esto
que existe relocation.
Ojo con el orden: EST-7 (el botón de resolver que no se habilita) y EST-6 (intereses
mezclados en la vista de reubicaciones) tienen que estar arreglados antes, o vamos a hacer
visible un flujo que no se puede completar.
```

---

## Backlog (fases siguientes, requieren definición de producto)

- **CAM-1 · Matrículas de estudios tipo campaña** — no urge. Definir: ¿sin prerequisitos? ¿cupos? ¿pago? La etapa 'campaña' ya existe en la elegibilidad (campañas sin compromisos) y la excepción de campaña queda implementada en EST-1.
- **WAP-1 · Canal WhatsApp en comunicaciones** — fase mayor. Hoy solo está modelado en el esquema (`channel_configs.type`, prefs de miembro). Requiere decidir proveedor y costos antes de escribir código.
- **PAY-FUT · Pagos por tarjeta (pasarela) y SINPE directo** — decisión 2026-07-28: hoy todo entra por comprobante o manual; la UI de tarjeta/SINPE se retiró de /finanzas/pagos y /finanzas/devoluciones (marcada FASE FUTURA en el código: stat cards, chips de filtro, sección de devoluciones automáticas, botón Confirmar SINPE auto-gateado). El esquema ya soporta los métodos (`refunds.method`, `payment_stats`); al implementarse, reactivar esa UI.

### Internacionalización (Madrid / Colombia) — contemplar ANTES de migrar datos internacionales

- [x] **INT-1 · Documento de identidad por tipo (cédula / DNI-NIE / pasaporte)** — HECHO 2026-07-28.
  Migración `20260728150000_document_type` (aplicada a producción): `members.document_type`
  ('cedula' | 'dni_nie' | 'pasaporte' | 'otro', default 'cedula', los 23,320 registros CR
  quedaron como 'cedula') + índice único por PAREJA (document_type, cedula_normalized)
  reemplazando el de solo cédula. Código: helpers en `src/lib/cedula.ts`
  (`isValidDocument`, `documentFormatMessage`, labels) con tests; números en MAYÚSCULAS al
  guardar (dedup consistente para documentos con letras); POST/PATCH de members validan por
  tipo y dedupean por pareja; alta y edición de miembro con selector de tipo, label y
  placeholder dinámicos; lookup TSE/Hacienda solo aplica a tipo 'cedula'; import de grupos
  acepta encabezado "documento"; mensajes de prematrimonial/matrícula dicen "documento de
  identidad" (los códigos de error `cedula_requerida`/`cedula_invalida` no cambian).
  Nota: la normalización quita solo guiones y espacios (NO puntos) — números tipo CC
  colombiana se capturan sin puntos. Spec original: hoy la
  identificación es solo `cedula` + `cedula_normalized` (deduplicación, imports, match de
  dirigentes, requisito del prematrimonial). Para miembros fuera de CR: agregar
  `document_type` ('cedula' | 'dni_nie' | 'pasaporte' | 'otro', default 'cedula') y
  generalizar la normalización y la deduplicación a la pareja (tipo, número normalizado).
  La UI de perfil muestra un selector de tipo de documento; los flujos que hoy exigen
  "cédula" pasan a exigir "documento de identidad". Los imports aceptan columna de tipo
  opcional (default cédula). Sin romper: `cedula_normalized` sigue alimentado para los
  ~23k registros CR existentes. Decisión recomendada: tipo+número, no solo "pasaporte",
  para cubrir España (DNI/NIE), Colombia (CC) y cualquier país siguiente sin otro cambio
  de esquema.
- [x] **INT-2 · Montos multimoneda** — HECHO 2026-07-28. Migración
  `20260728160000_multicurrency` (aplicada a producción, todo lo existente quedó en CRC):
  columna `currency` (default 'CRC', CHECK CRC/USD/EUR) en donations, refunds,
  scholarships, study_plans y events; el CHECK de payments se amplió con EUR; el RPC
  `create_refund` hereda la moneda del pago. Código: `formatMoney(amount, currency)` +
  `currencySymbol` + `CURRENCIES` en `src/lib/format.ts` (formatCRC delega; con tests);
  los pagos heredan la moneda de su origen (costo del plan en matrícula/auto-matrícula,
  moneda del evento en inscripciones); selectores de moneda en editar plan de estudio y
  en crear/editar evento (símbolo dinámico en inputs y resumen); `AmountDisplay` acepta
  `currency` y las páginas de finanzas (pagos, donaciones, devoluciones, perfil de
  miembro, revisión de pagos) muestran la moneda de cada fila. PENDIENTE (decisión de
  producto con dirección/finanzas): los reportes y stats agregados (finanzas resumen,
  payment_stats, reportes) siguen sumando sin separar moneda — mientras todo sea CRC no
  distorsiona; definir "por moneda separada vs. conversión" antes de capturar montos EUR
  reales. Spec original: hoy todos los montos (payments, donations, scholarships,
  refunds, study_plans.cost, events.payment_amount) son numéricos sin moneda, asumidos en
  colones (₡ hardcodeado en formateo). Agregar columna `currency` (ISO 4217, default 'CRC')
  en las tablas de dinero, formateo por moneda en un helper único, y definir la regla de
  reportes/agregados (¿se reporta por moneda separada o se convierte? — decisión de
  producto pendiente con dirección/finanzas). Alcance inicial recomendado: EUR para Madrid,
  sin conversión automática (los reportes agregan por moneda). Coordinar con la
  integración Tilopay (fase 2 del roadmap) para que nazca multimoneda.
- Relacionado (ya anotado en la respuesta al cuestionario de TI): multi-idioma, zonas
  horarias de crons (hoy UTC pensado para CR) y GDPR para España — definir en la misma
  fase, no requieren código todavía.

---

## Notas para la ejecución en Claude Code

- Un punto por sesión/PR. Pegar el prompt tal cual y pedir además: correr `tsc --noEmit`,
  lint y `vitest` antes de dar por terminado (la verja de CI usa `--max-warnings=107`, solo baja).
- Reglas del repo que ningún cambio debe romper (de AGENTS.md y docs/sistema-overview.md):
  - Todo handler de /api se autoriza solo con `requireRoles(...)` o `requireModuleView(...)`
    (el middleware excluye /api).
  - Sin soft-delete; DELETE con referencias → 409 con conteo.
  - Anti-suplantación con `resolveTargetMemberId()` en autoservicio.
  - La regla de sede vive SOLO en SQL desde REF-1 (refresh_member_sede + refresh_member_sedes,
    migración 20260728100000); computeMemberSede es la spec ejecutable de los fixtures. Si cambia
    la regla: las dos funciones SQL + el espejo TS + los fixtures.
- Después de cada punto completado, marcar el checkbox acá y anotar el commit/PR.
