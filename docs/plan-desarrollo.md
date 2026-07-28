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

### [ ] EST-6 · Solicitudes de interés: texto claro + quitar flujo de gestión
Archivos: `src/components/studies/StudyRequestActions.tsx` (disclaimer ~195-199, toast ~148), `src/app/(admin)/estudios/solicitudes/page.tsx`, `src/components/shared/RequestBoard.tsx`, `src/app/api/studies/requests/*`, `src/lib/supabase/queries/study-requests.ts`

```
Dos cambios sobre las solicitudes de estudio tipo "me interesa" (study_interest). Decisión
confirmada: quedan como DATOS DE DEMANDA de solo lectura, sin flujo de gestión. Las de
REUBICACIÓN (relocation) mantienen su flujo completo tal cual.
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

### [ ] EST-7 · Bug: no deja resolver solicitud de reubicación de grupo
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

### [ ] EST-8 · Notas de estudios en el perfil del miembro
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

### [ ] COM-1 · Configuración de comunicaciones solo para admin
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

### Calendario público y eventos (feedback 2026-07-26)

### [ ] EVE-1 · Detalle de evento público + botón inscribirse con login
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

### [ ] EVE-2 · Flyers de eventos en Supabase Storage
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

### Internacionalización (Madrid / Colombia) — contemplar ANTES de migrar datos internacionales

- **INT-1 · Documento de identidad por tipo (cédula / DNI-NIE / pasaporte)** — hoy la
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
- **INT-2 · Montos multimoneda** — hoy todos los montos (payments, donations, scholarships,
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
  - La regla de sede vive duplicada en TS y SQL con fixtures compartidas; no tocarla de un solo
    lado (hasta REF-1).
- Después de cada punto completado, marcar el checkbox acá y anotar el commit/PR.
