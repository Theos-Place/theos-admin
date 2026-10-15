# Plan de corrida · arreglos de QA-2 y QA-3 — 2026-10-15

Un solo plan para los dos informes (`informe-autenticado.md` y
`informe-codigo.md`). Ordenado por riesgo y esfuerzo: primero lo que afecta a
toda la app con poco cambio, después lo que pesa en prod, al final la deuda.
Cada tanda es un commit a `staging` verificado; a prod cuando se pida.

Regla de cada tanda: medir antes y después (axe para accesibilidad,
`pg_stat_statements` para BD), y dejar un test o un ratchet que impida volver.

## Tanda 1 — Accesibilidad de base (QA-2 M1, M4, M5) · S · HECHA 2026-10-15 (staging)

- Seis tokens de color bajo 4,5:1 → arregla 268 elementos en 39 pantallas.
  Sumar los pares a `src/lib/contrast.test.ts`.
- «Saltar al contenido» en el AppShell (60 Tab hoy hasta llegar a trabajar).
- `Modal.tsx`: devolver el foco al botón que abrió aunque haya `autoFocus`
  (23 archivos se benefician sin tocarlos).

**Resultado medido** (axe sobre las 40 pantallas que tenían contraste bajo,
`axe/despues-tanda1-contraste.json`): de 268 elementos en 39 pantallas a 4 en 1
en escritorio, y de 237 a 4 en móvil; esos 4 se cerraron después y la pantalla
quedó en cero. Saltar al contenido: el primer Tab lo enfoca y Enter + Tab entra
a `<main>` en las 5 pantallas probadas (`scripts/qa/probar-salto.ts`). Modal: el
foco vuelve a «Agregar donación».

**Decisiones de Floriana del 2026-10-15** (ya aplicadas y fijadas en
`contrast.test.ts` y AGENTS.md): el coral como texto es siempre `coral-deep`, y
sobre un tinte teal la letra va en el nuevo `teal-ink` (#2F5E61).

**De paso:** chips de pago y de tipo de evento con variante para la cabecera
navy; pasos futuros del wizard de eventos como botón deshabilitado; planes
archivados sin opacidad; en móvil, los botones de `/estudios/bloques` se salían
de la cabecera y quedaban blancos sobre blanco.

## Tanda 2 — Nombres accesibles y foco (QA-2 M2, M3, M6) · HECHA 2026-10-15 (staging)

- `aria-label` en los 50 botones solo-ícono y las 12 pantallas con selects sin
  etiqueta. Test que barra botones de ícono sin nombre.
- Foco visible en las fechas de `RequestBoard` y revisión de los 43 `outline-none`.

**Resultado medido.** axe en las 19 pantallas con controles sin nombre o
campos sin etiqueta: de 96 elementos a 0. Como axe solo ve las pantallas con
datos, se sumaron tres barridos del código entero en `src/lib/a11y/`, que ahora
son tests: 23 controles solo-ícono o interruptores sin nombre, 50 campos sin
etiqueta y 38 elementos con el foco invisible, los tres en cero. Las únicas
excepciones son los campos del formulario público que etiqueta FormFiller desde
otro archivo (documentadas en el test). Recorrido con teclado de /soporte,
/estudios/solicitudes y /finanzas/pagos: 0 paradas sin foco visible. Los menús
«⋯» de listas, formularios y la ficha cierran con Escape y devuelven el foco.

## Tanda 3 — Las tres consultas que dominan prod (QA-3 M1, M2, M3) · HECHA 2026-10-15 (staging)

- Matrícula: `getStudyGroups` con filtro de estado y select sin inscripciones
  (1.894 s acumulados, la consulta 1.ª del sistema).
- Lista de eventos: `light=1` más conteos; paginar en servidor (1.290 s).
- `get_group_attendance()` y familia con rango de fechas, o vista materializada
  nocturna (868 s + 362 s). Revisar de paso la ficha del miembro (QA-3 N3).
- Medir antes y después con `pg_stat_statements`.

**Resultado medido (contra prod):**

| Consulta | Antes | Después |
|---|---|---|
| Matrícula: grupos que se traen | 2.222 grupos · 1,1 MB · 942 ms | 9 grupos · 4 KB · 105 ms |
| Lista de eventos: check-ins embebidos (500 eventos) | 32.476 · 3,4 MB | solo los de hoy |
| Retención: `get_group_attendance()` | 2.917 ms | 109 ms (17.945 filas idénticas) |

La retención lee una vista materializada que se recalcula cada noche (00:50 CR,
~1 s): los check-ins del día entran al reporte esa noche. La migración se
aplica sola en el build de prod; en staging ya está. El N3 del informe estaba
mal atribuido (no es la ficha, es el Análisis de demanda) y queda pendiente.

## Tanda 4 — Limpieza que evita bugs futuros (QA-3 M5, M6) · M · un día

- Borrar los 129 exports, 2 componentes y 265 tipos muertos; `knip` en CI.
- Flujo de comprobante único entre eventos y estudios; `getScope` una sola vez
  (`lib/auth/roles.ts` importado por `usePermissions`); un `escapeHtml`, un
  `norm`, un `EMPTY_RESTRICTION`.

## Tanda 5 — Menores de los dos informes · S/M · un día

- QA-2 N1–N5: blancos táctiles (SINPE primero), «Limpiar filtros» en vacíos,
  ARIA estructural, enlaces subrayados, `GET /api/travel-requests` con rol.
- QA-3 N1, N2, N4, N5: comentario de decisión en las 30 escrituras solo-sesión,
  `next/dynamic` para recharts, índices en las 6 FK que van a crecer, RPC de ids
  para el filtro de audiencia.

## Tanda 6 — zod en las 82 escrituras (QA-3 M4) · L · por módulo, en el tiempo

No va en una sentada. Orden por riesgo: finanzas y pagos (6) → estudios (22) →
miembros (11) → eventos (11) → servidores (10) → el resto. Cada módulo un
commit, con el test de «cableado» que ya se usa para los guards.

## Lo que queda fuera a propósito

- Las 7 pantallas sin datos en staging (empleados, viajes) y el flujo completo
  de matrícula con comprobante: se cubren cuando haya datos sembrados.
- `pg_timezone_names` (no es nuestro) y las cascadas de `useEffect` (sin
  evidencia de que lo sean).
