# QA-2 · Auditoría autenticada contra staging — 2026-10-15

Plan y prompt en `docs/qa-2026-10/plan.md`. Corrido contra el dev server de
**staging** (`localhost:3001`, Supabase de staging, banner STAGING). Nada se
corrió contra producción. No se tocó `src/`: es el mapa; los arreglos van en
tandas, al final.

## Resumen

| Qué | Resultado |
|---|---|
| Pantallas auditadas con axe (WCAG 2.1 A/AA) | **123 de 130** en escritorio y en móvil (7 sin datos en staging, 1 donde axe no terminó) |
| Pantallas con alguna violación | **51** |
| Violaciones críticas (sin nombre / sin label / ARIA roto) | **4 reglas en 18 pantallas, 68 elementos** |
| Contraste bajo | **268 elementos en 39 pantallas**, salen de **6 pares de color** |
| Desborde horizontal en móvil (375 px) | **0 de 123** |
| Chequeos de acceso por rol (14 roles) | **81**, ninguna fuga |
| Flujos críticos por teclado | 5 de 6 completables; el sexto (reubicación) no tenía datos en staging |
| Tab hasta el contenido en cada pantalla | **60** (no hay «saltar al contenido») |
| Cambio de grupo con pago previo | verificado de punta a punta: **no** genera cobro nuevo |

**Lo que más importa**, en orden:

1. **El contraste no es un problema de 39 pantallas, es de 6 colores.** Una
   clase global (`.psub`, 3,18:1) y un badge (`StudyTypeBadge`, 3,06:1) explican
   buena parte. Arreglar los 6 tokens arregla los 268 elementos.
2. **50 botones de ícono no dicen qué hacen** a un lector de pantalla; 37 están
   en una sola pantalla (`/miembros/listas/[id]`).
3. **Sin «saltar al contenido»**: con teclado hay que presionar Tab 60 veces
   para llegar al contenido, en todas las pantallas.
4. **El modal compartido no devuelve el foco** cuando su primer campo tiene
   `autoFocus` (23 archivos lo hacen): al cerrar, el foco cae al principio de
   la página.
5. **Ningún rol entra donde no debe.** Los 81 chequeos de acceso dieron lo
   esperado.

No hay hallazgos CRÍTICOS: ninguna fuga de acceso ni dato expuesto.

---

## MEDIO

### M1 · Seis colores bajo 4,5:1 explican los 268 elementos con contraste bajo

Medido con `src/lib/contrast.ts` (el mismo que usa el test de la marca):

| Par de color | Ratio | Dónde |
|---|---|---|
| `.psub` — navy al 55 % sobre blanco | **3,18** | `src/app/globals.css:221`. Es el subtítulo de las cabeceras de página: aparece en casi todas |
| `StudyTypeBadge` etapa intermedia — `text-coral` sobre `bg-coral/10` | **3,06** | `src/components/studies/StudyTypeBadge.tsx:17`. 56 elementos en `/estudios/plan`; también en grupos y matrícula |
| verde `#3DB97A` como texto sobre su tinte | **2,25** | 12 archivos: `dashboard`, `estudios/dirigentes`, `miembros/listas/[id]`, `finanzas/*`, `DirigentesCombobox`… |
| `--fg-muted` — navy al 50 % | **2,78** | `src/app/globals.css:80`; usado en 4 archivos (`eventos/tipos`, `estudios/plan`, `miembros/[id]/editar`, `servidores/puestos/*`) |
| color del rol `#9CA0B4` sobre su tinte | **2,30** | `src/lib/auth/roles.ts:319`, pintado como texto en `/accesos` (24 elementos) |
| `text-coral` sobre tinte coral | **3,06** | 10 archivos (`mis-pagos`, `finanzas/adelantos`, `comunicaciones/*`, `servidores/*`…) |

**Fix:** `.psub` y `--fg-muted` a `text-navy-light/80`; el badge intermedio y
los coral sobre tinte a `text-coral-deep`; el verde a `#1E6B42` (5,95:1 sobre su
tinte, ya usado en el resumen de finanzas); el gris de rol a un tono de 4,5. ·
**Esfuerzo S.** Son tokens: el arreglo es de pocas líneas y lo cubre el test de
contraste si se suman los pares.

### M2 · 50 botones solo-ícono sin nombre accesible (8 pantallas)

axe `button-name` (crítico) y `link-name`:

- `src/app/(admin)/miembros/listas/[id]/page.tsx:462` — el botón de cada fila
  (37 en la lista de prueba).
- `src/app/(admin)/miembros/listas/page.tsx:255` — el menú «⋯» de cada lista:
  además no tiene `aria-expanded`, no cierra con Escape y mide 28 px.
- `src/app/(admin)/configuracion/page.tsx:12` y
  `comunicaciones/nueva/_components/ScheduleSection.tsx:54` — los interruptores
  (`role="switch"`) sin etiqueta.
- `src/app/(admin)/configuracion/seguridad/page.tsx:150` — «mostrar contraseña»
  sin nombre y con `tabIndex={-1}` (no se alcanza con teclado).
- `src/app/(admin)/finanzas/becas/nueva/page.tsx:99` y
  `finanzas/pagos/[id]/page.tsx:104` — el «volver» de la cabecera.
- `src/app/(admin)/formularios/page.tsx:468,478` y `comunicaciones/plantillas` —
  acciones por fila.

**Fix:** `aria-label` en cada uno (regla de AGENTS.md); al menú, `aria-expanded`
y cierre con Escape. · **S.**

### M3 · Selects e inputs sin etiqueta (12 pantallas)

`select-name` en `/accesos`, `/comunicaciones/plantillas` (y `/nueva`),
`/empleados/puestos`, `/estudios/grupos`, `/formularios/[id]` y
`/formularios/nuevo`. `label` en `/eventos/[id]/editar` (el título grande),
`/eventos/embed` (selector de color), `/finanzas/becas/nueva` (el deslizador de
porcentaje), `/finanzas/donaciones/importar` (el input de archivo oculto) y el
«seleccionar todo» de `/miembros`.

**Fix:** `aria-label` o `<label>` asociado. · **S.**

### M4 · No hay «saltar al contenido»: 60 Tab para empezar a trabajar

Medido en las 9 pantallas de los flujos críticos: la primera parada dentro de
`<main>` llega **siempre en el Tab 60**, después de recorrer todo el menú
lateral y la barra superior. No hay enlace de salto (`AppShell.tsx` ni
`layout.tsx`).

**Fix:** un enlace «Saltar al contenido» visible al recibir foco, primero en el
`AppShell`, que apunte a `<main id="contenido">`. · **S.**

### M5 · El modal no devuelve el foco cuando su primer campo tiene autoFocus

`src/components/shared/Modal.tsx:62`. El modal guarda «a dónde volver» en un
efecto, pero los hijos con `autoFocus` ya movieron el foco antes de que corra:
lo que guarda es su propio input. Al cerrar, ese input ya no existe y el foco
cae al principio de la página.

Reproducido: en `/finanzas/reportes`, abrir «Agregar donación» con Enter y
cerrar con Escape → el foco termina en el banner de STAGING, no en el botón.
El mismo modal, abierto desde el check-in («Tiquete de soporte», sin
`autoFocus`), sí devuelve el foco bien. **23 archivos** abren un modal con un
campo `autoFocus`.

**Fix:** capturar `document.activeElement` en el primer render (inicializador
de `useState`/`useRef`), no en el efecto. · **S.**

### M6 · Foco invisible en campos que quitan el outline sin poner otro

Confirmado en el recorrido de teclado: las fechas «Desde / Hasta» de
`RequestBoard` (`src/components/shared/RequestBoard.tsx:444,452`) tienen
`outline-none` y ningún estilo de foco — afecta a `/soporte`,
`/estudios/solicitudes` y `/estudios/evaluaciones`.

En todo `src/` hay **43** `className` con `outline-none` y sin `focus:` /
`focus-visible:`; los que más tienen: `finanzas/becas/nueva` (5),
`RequestBoard` (4), `RefundModal`, `FormBuilder`, `finanzas/pagos`,
`finanzas/devoluciones` (3 cada uno). Algunos pueden estar cubiertos por un
`focus-within` del contenedor; los dos de `RequestBoard` no.

**Fix:** sumar `focus:ring-1 focus:ring-coral/30` (el estándar de la casa) o
usar la clase `CAMPO` de `reporte-ui`. · **M** (hay que revisar los 43).

---

## MENOR

### N1 · Blancos táctiles chicos en las pantallas de uso diario (375 px)

| Pantalla | < 44 px | < 24 px | El peor |
|---|---|---|---|
| `/mis-pagos` | 15 | 5 | «Copiar número de SINPE»: **21×17** |
| `/finanzas/adelantos` | 29 | 9 | — |
| `/matricula` | 18 | 2 | el buscador de la barra superior: 20 px de alto |
| `/eventos` | 24 | 1 | ídem |
| check-in (selector y evento) | 10 | 1 | «Volver» / «Eventos»: 20 px de alto |
| `/miembros/[id]` | 19 | 1 | «Ver perfil de dirigente»: 20 px |
| `/servidores/mi-comite` | 52 | 0 | — |

El de SINPE es el que importa: lo usa un miembro, en el teléfono, justo antes
de pagar. **Fix:** padding hasta 44×44 en ese botón; el resto, en una pasada. ·
**S/M.** Datos en `blancos-tactiles.json`.

### N2 · Estados vacíos que no dicen cómo salir

De 67 `EmptyState`, ~30 dicen «No hay … con ese filtro» sin un botón para
limpiar los filtros (`servidores/aplicaciones`, `formularios`, `comunicaciones`,
`finanzas/pagos`, `miembros`, `estudios/grupos`, `reportes/*`…). La persona
tiene que adivinar qué filtro la dejó sin resultados. **Fix:** una acción
«Limpiar filtros» en `EmptyState` cuando hay filtros activos. · **M.**

### N3 · Enlaces que solo se distinguen por el color

`link-in-text-block` en `/dashboard` (10, los de la actividad reciente) y en
`/servidores/mi-comite`. **Fix:** subrayado. · **S.**

### N4 · Estructura ARIA mal formada

- `/mis-pagos` y `/estudios/folletos/[id]`: `<dl>` con hijos que no son
  `<dt>/<dd>` (`definition-list`, `dlitem`).
- `/comunicaciones/plantillas/nueva`: botones `role="tab"` sin `tablist`.
- `/matricula`: `aria-label` en un `<span>` sin rol (`aria-prohibited-attr`).
- `/reportes/personas-nuevas` y `/finanzas/donaciones/reporte` (móvil): región
  con scroll horizontal que no se alcanza con teclado
  (`scrollable-region-focusable`).
- `comunicaciones/nueva/_components/Modals.tsx:250`: el aviso «Enviando…» no
  tiene `role="status"`, un lector de pantalla no se entera.

**S.**

### N5 · `GET /api/travel-requests` responde a cualquier sesión

La pantalla de viáticos exige ser empleado, pero el endpoint deja listar a
cualquiera. **No es una fuga:** devuelve solo los viajes de quien pregunta
(vacío para quien no es empleado). Es una inconsistencia entre la puerta y la
API. **Fix:** el mismo `puedeEntrarAViaticos` en el GET. · **S.**

---

## Lo que pasa limpio

- **Accesos.** 81 chequeos en 14 roles (pantallas por URL directa y endpoints
  por fetch): cada rol entra a lo suyo y recibe «Acceso restringido» / 403 en lo
  ajeno. Incluye lo que se cambió esta semana: soporte no ve finanzas,
  reportes ni estudios; revisión de pagos no ve donantes ni saldos; el
  colaborador de adelantos no ve pagos. Datos en `accesos.json`.
- **Móvil.** 0 desbordes horizontales en 123 pantallas a 375 px.
- **Modal compartido.** Atrapa el foco (0 escapes en 25 Tab) y cierra con
  Escape en los dos modales probados.
- **Flujos por teclado.** Matrícula, check-in (con el tiquete de soporte),
  cierre de grupo, revisión de pagos y la cola de soporte se recorren sin
  mouse y la acción principal se alcanza. Datos en `teclado.json`.
- **Lo de esta semana, verificado a propósito:**
  - El check-in por URL directa (QR) ya no manda al dashboard.
  - `/finanzas/donaciones` y `/pagos/revision` redirigen a su pantalla nueva.
  - Admin y dirección ven los montos de donación sin el rol finanzas.
  - Las tres pestañas de Reportes comparten molde (y pasan axe: 0 violaciones
    en `/finanzas/reportes`).
  - **Cambio de grupo con pago previo**: matrícula con pago cancelado en un N3,
    movida por el endpoint a otro N3 del mismo costo → 1 pago movido, 0 cobros
    creados. Reproducible con `scripts/qa/probar-traslado.ts`.

## Lo que este informe NO dice

- **7 pantallas sin datos en staging:** el detalle y la edición de empleados,
  de puestos pagados y de viajes (no hay ninguno en staging) y el detalle de un
  comunicado. Quedan sin auditar.
- **`/comunicaciones/plantillas/[id]/editar`:** axe no terminó en 60 s en
  ninguno de los dos anchos (el editor de correo es pesado). Sin medir.
- **Reubicación por teclado:** staging no tiene solicitudes de reubicación;
  el flujo e) no se pudo recorrer.
- **El flujo completo de matrícula con comprobante** no se ejecutó (solo el
  recorrido de teclado de la pantalla), para no generar cobros en staging.
- **Crear un tiquete por rol** (POST) no se probó por API; lo cubren los tests
  de `sop1-cableado` y `tiquete.test`.
- **El recorrido heurístico** se hizo sobre estados vacíos, mensajes de acceso
  y alcance de la acción principal. No se contaron clics tarea por tarea para
  cada rol.
- **El dev server de Turbopack se cayó** a mitad de la primera corrida (pánicos
  internos con la caché en disco trabada después de horas). Las 4 pantallas de
  Servidores que salieron «sin título ni idioma» eran eso, no un bug de la
  app. Se reinició con la caché limpia y **se repitieron las dos corridas
  completas**; los números de arriba son de la corrida limpia.

## Datos y scripts

- `axe/autenticadas-ti-desktop.json`, `axe/autenticadas-ti-mobile.json` — axe crudo.
- `accesos.json`, `teclado.json`, `blancos-tactiles.json`.
- Scripts reproducibles en `scripts/qa/`: `auditar-autenticadas.ts`,
  `probar-accesos.ts`, `recorrer-teclado.ts`, `blancos-tactiles.ts`,
  `probar-traslado.ts`. Todos abortan si `.env.staging.local` no apunta a staging.

## Qué se creó en staging y se borró

| Qué | Estado |
|---|---|
| Cuenta `qa.roles@prueba.theosplace.invalid` (ficha, usuario de auth y roles rotativos) | borrada (el usuario de auth por SQL: la API admin devuelve 500, gotcha conocido) |
| Evento «[prueba] QA-2 check-in» | borrado |
| Tiquete de soporte de prueba | borrado |
| Matrícula y pago del traslado | borrados por el propio script |
| Roles temporales en la cuenta de prueba de coordinación | ninguno quedó puesto (verificado) |

## Tandas de arreglo propuestas

Ordenadas por riesgo y esfuerzo. Cada una, un commit a staging verificado.

1. **Contraste (M1) — S.** Seis tokens. Arregla 268 elementos en 39 pantallas.
   Sumar los pares nuevos al test de `src/lib/contrast.test.ts`.
2. **Nombres accesibles (M2 + M3) — S.** `aria-label` en ~60 controles. Un test
   que barra los botones solo-ícono sin `aria-label` evita que vuelva.
3. **Teclado de base (M4 + M5) — S.** «Saltar al contenido» y el foco de vuelta
   del modal. Dos cambios en dos archivos compartidos que se notan en todas
   las pantallas.
4. **Foco visible (M6) — M.** Las fechas de `RequestBoard` y la revisión de los
   43 `outline-none`.
5. **Menores (N1–N5) — S/M.** Blancos táctiles (empezando por el SINPE),
   «Limpiar filtros» en los vacíos, ARIA estructural, enlaces subrayados y el
   GET de viáticos.
